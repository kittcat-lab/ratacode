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
 * @param {{fabricaServidor: () => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer, puerto: number, clave: string, rutaClave?: string, alRotar?: (nueva: string) => void, host?: string, simultaneas?: number}} opciones
 * @returns {Promise<{servidor: import('node:http').Server, claveActual: () => string, parar: () => void}>} ya escuchando.
 */
export function iniciarServidorHttp({ fabricaServidor, puerto, clave, rutaClave, alRotar, host = '127.0.0.1', simultaneas = SIMULTANEAS_DEFECTO }) {
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
    const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
    const partes = url.pathname.split('/').filter(Boolean); // ['mcp', '<clave>']
    if (partes[0] !== 'mcp' || !claveValida(partes[1], claveViva)) {
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
