/**
 * http — transporte Streamable HTTP para RATACODE-MCP.
 *
 * El MISMO servidor de herramientas que habla por stdio, ahora también por
 * HTTP en `127.0.0.1:<puerto>/mcp/<clave>`. La clave va en la propia URL
 * (nunca en el repositorio: se genera y se guarda en la casa). Cada petición
 * se atiende con un `McpServer` nuevo que COMPARTE el registro de tareas, así
 * `get_task_result` ve las tareas de otras sesiones y el tope por hora es
 * global. Modo sin estado (stateless): cada POST es independiente, que es justo
 * lo que necesitan estas siete herramientas.
 *
 * Sólo escucha en loopback. La exposición a Internet es cosa del túnel
 * (tunel.mjs), que lo decide el usuario. Y lo que se expone va encerrado: cada
 * tarea lee y escribe sólo dentro de las carpetas autorizadas, sin terminal y
 * sin red (mira `lib/lectura.js`), así que aquí no hay nada que aceptar.
 *
 * Cuatro reglas que se cumplen aquí, y todas se prueban:
 *   1 · LA CLAVE NO SE REGISTRA. Ni en los avisos ni en los errores: en el
 *       registro la ruta sale como `/mcp/<oculta>`. (Antes, un error escribía
 *       `req.url` con la clave dentro, y los clientes MCP guardan ese stderr.)
 *   2 · LA CLAVE SE COMPARA EN TIEMPO CONSTANTE (`crypto.timingSafeEqual`).
 *   3 · EL CUERPO TIENE TOPE, Y AL PASARSE SE CONTESTA 413 (no se mata el
 *       socket antes de contestar: el cliente se merece una respuesta).
 *   4 · HAY TOPE DE PETICIONES A LA VEZ: cada POST autenticado crea un servidor
 *       MCP y un transporte; sin tope, la URL abierta es una fábrica de ellos.
 *
 * Y una quinta, para poder rotar la clave SIN reiniciar: si se le da la ruta
 * del fichero de la clave, este módulo la relee cada pocos segundos y adopta la
 * nueva. Así `tunel.mjs` puede estrenar clave al abrir el túnel y el servidor
 * que ya está en marcha la acepta.
 *
 * R26 · DOS COSAS MÁS, por ChatGPT:
 *   · LA CLAVE SE PUEDE PRESENTAR DE TRES FORMAS: en la ruta (`/mcp/<clave>`,
 *     lo de siempre), en la consulta (`/mcp?clave=<clave>`) o en la cabecera
 *     `Authorization: Bearer <clave>`. Sin dato de si ChatGPT acepta la clave
 *     dentro de la ruta, se dejan preparadas las otras dos: la ruta sigue
 *     siendo la forma que se le da a Patxi.
 *   · EL `Origin` DE OTRA WEB SE CORTA CON UN 403. Un navegador con una página
 *     abierta no tiene por qué hablarle a este servidor. Se permite el origen
 *     propio (loopback, cualquier puerto: el inspector de MCP vive en otro) y
 *     los de OpenAI (por si su backend mandara `Origin` alguna vez).
 */
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { aviso } from './registro.js';

/** Tope del cuerpo de una petición (5 MB: ningún prompt legítimo se acerca). */
const TOPE_CUERPO = 5_000_000;
/** Tope por defecto de peticiones atendidas a la vez. */
const SIMULTANEAS_DEFECTO = 8;
/** Cada cuánto se mira si la clave del fichero ha cambiado. */
const MS_REVISION_CLAVE = 2000;

/** Los nombres del parámetro de la clave en la consulta, para los clientes que no puedan usar la ruta. */
const CLAVES_EN_CONSULTA = ['clave', 'key'];

/**
 * ¿Este `Origin` es de casa (loopback) o de OpenAI? Cualquier otra web: no.
 * @param {string|undefined} origen - la cabecera `Origin`.
 * @returns {boolean} true si se admite.
 */
export function origenAdmitido(origen) {
  if (typeof origen !== 'string' || origen.trim() === '') return true; // sin cabecera: un cliente, no un navegador
  let anfitrion;
  try {
    anfitrion = new URL(origen).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (anfitrion === '127.0.0.1' || anfitrion === 'localhost' || anfitrion === '::1' || anfitrion === '[::1]') return true;
  if (anfitrion === 'chatgpt.com' || anfitrion.endsWith('.chatgpt.com')) return true;
  if (anfitrion === 'openai.com' || anfitrion.endsWith('.openai.com')) return true;
  return false;
}

/** El valor de un `Authorization: Bearer <clave>`, si lo hay. */
function portador(cabecera) {
  if (typeof cabecera !== 'string') return null;
  const trozos = cabecera.trim().split(/\s+/);
  return trozos.length === 2 && trozos[0].toLowerCase() === 'bearer' ? trozos[1] : null;
}

/** Leer el cuerpo JSON de una petición, con tope. */
function leerCuerpo(req) {
  return new Promise((listo, rechaza) => {
    const trozos = [];
    let total = 0;
    let pasado = false;
    req.on('data', (t) => {
      if (pasado) return;
      total += t.length;
      if (total > TOPE_CUERPO) {
        pasado = true;
        trozos.length = 0;
        const error = new Error('cuerpo demasiado grande');
        error.codigo = 413;
        rechaza(error);
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => {
      if (pasado) return;
      const texto = Buffer.concat(trozos).toString('utf8').trim();
      if (texto === '') return listo(undefined);
      try { listo(JSON.parse(texto)); } catch { rechaza(new Error('cuerpo JSON inválido')); }
    });
    req.on('error', rechaza);
  });
}

/** ¿Es esta la clave buena? En tiempo constante, y sin decir por qué falla. */
function claveValida(recibida, buena) {
  if (typeof recibida !== 'string' || typeof buena !== 'string' || buena === '') return false;
  const a = Buffer.from(recibida, 'utf8');
  const b = Buffer.from(buena, 'utf8');
  // Longitudes distintas: no se puede comparar en tiempo constante, y una clave
  // con otra longitud no es la clave. (La nuestra es hex de 64: no filtra nada.)
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Arrancar el servidor HTTP.
 * @param {{fabricaServidor: () => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer, puerto: number, clave: string, rutaClave?: string, alRotar?: (nueva: string) => void, host?: string, simultaneas?: number, alPresentarse?: (nombre: string) => void}} opciones
 * @returns {Promise<{servidor: import('node:http').Server, claveActual: () => string, parar: () => void}>} ya escuchando.
 */
export function iniciarServidorHttp({ fabricaServidor, puerto, clave, rutaClave, alRotar, host = '127.0.0.1', simultaneas = SIMULTANEAS_DEFECTO, alPresentarse }) {
  /** La clave viva: puede cambiar si `tunel.mjs` estrena una. */
  let claveViva = clave;
  let atendiendose = 0;
  let temporizadorClave;

  if (typeof rutaClave === 'string' && rutaClave !== '') {
    temporizadorClave = setInterval(() => {
      try {
        const leida = readFileSync(rutaClave, 'utf8').trim();
        if (leida !== '' && leida !== claveViva) {
          claveViva = leida;
          aviso('http: clave rotada (la nueva está en ' + rutaClave + '); la URL ha cambiado');
          if (typeof alRotar === 'function') alRotar(leida);
        }
      } catch { /* sin fichero legible se sigue con la que había */ }
    }, MS_REVISION_CLAVE);
    if (typeof temporizadorClave.unref === 'function') temporizadorClave.unref();
  }

  const server = createServer((req, res) => {
    manejar(req, res).catch((e) => {
      // NUNCA `req.url`: lleva la clave. Y nunca el valor de la clave.
      aviso('http: error manejando ' + req.method + ' /mcp/<oculta>: ' + (e?.message ?? e));
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Error interno');
      else res.end();
    });
  });

  async function manejar(req, res) {
    // El origen, lo PRIMERO: una web ajena no llega ni a probar la clave.
    if (!origenAdmitido(req.headers.origin)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        .end('Origen no permitido: sólo se atiende desde esta máquina (o desde OpenAI).');
      return;
    }

    const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
    const partes = url.pathname.split('/').filter(Boolean); // ['mcp', '<clave>']
    // La clave vale por la ruta (lo de siempre), por la consulta o por la
    // cabecera `Authorization: Bearer`. Ninguna de las tres se registra.
    const candidatas = [partes[1], ...CLAVES_EN_CONSULTA.map((n) => url.searchParams.get(n)), portador(req.headers.authorization)];
    // Una sola pieza de ruta después de `/mcp`: si hay más (`/mcp/<clave>/otra`),
    // es una URL equivocada y se dice, en vez de atenderla como si fuera la buena.
    if (partes[0] !== 'mcp' || partes.length > 2 || !candidatas.some((c) => claveValida(c, claveViva))) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    if (req.method === 'POST') {
      if (atendiendose >= simultaneas) {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '5' })
          .end('Demasiadas peticiones a la vez (máximo ' + simultaneas + '). Prueba dentro de un momento.');
        return;
      }
      let cuerpo;
      try {
        cuerpo = await leerCuerpo(req);
      } catch (e) {
        const codigo = e?.codigo === 413 ? 413 : 400;
        res.writeHead(codigo, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' })
          .end(codigo === 413 ? 'Cuerpo demasiado grande (máximo 5 MB)' : 'Bad request');
        // Se contesta PRIMERO y se cierra DESPUÉS: matar el socket antes deja al
        // cliente sin respuesta (medido: `curl` terminaba en exit 56 sin HTTP).
        res.on('finish', () => req.destroy());
        return;
      }
      atendiendose += 1;
      try {
        // Quién llama, del propio `initialize`: sin estado, el servidor que
        // atiende el `notifications/initialized` es OTRO distinto del que vio el
        // `initialize`, así que allí no hay nombre que preguntar y el cuaderno se
        // quedaba en «MCP». Se apunta aquí, de la petición que sí lo trae.
        const nombre = cuerpo?.params?.clientInfo?.name;
        if (cuerpo?.method === 'initialize' && typeof nombre === 'string' && nombre.trim() !== '' && typeof alPresentarse === 'function') {
          alPresentarse(nombre.trim().slice(0, 80));
        }
        const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        const servidor = fabricaServidor();
        await servidor.connect(transporte);
        res.on('close', () => { servidor.close().catch(() => {}); transporte.close().catch(() => {}); });
        await transporte.handleRequest(req, res, cuerpo);
      } finally {
        atendiendose -= 1;
      }
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      // Sin estado: no hay sesiones que mantener ni stream SSE persistente.
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
        .end('Método no permitido en modo sin estado (usa POST)');
      return;
    }

    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' }).end('Método no permitido');
  }

  const escuchando = new Promise((listo, rechaza) => {
    server.once('error', rechaza);
    server.listen(puerto, host, () => {
      server.removeListener('error', rechaza);
      listo(server);
    });
  });

  return escuchando.then(() => ({
    servidor: server,
    claveActual: () => claveViva,
    parar: () => {
      if (temporizadorClave !== undefined) clearInterval(temporizadorClave);
      server.close();
    },
  }));
}
