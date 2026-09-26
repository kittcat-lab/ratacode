/**
 * ratacode-piel — LA PIEL DE RATACODE SOBRE DSH WEB.
 *
 * ── CÓMO ENGANCHA (medido, con el código delante) ───────────────────────────
 * `@deepseek-ai/dsh-host-webserver` expone el servicio `webServer`
 * (`lib/index.js:138,157`) con `tapIndex(transform)` (`lib/index.js:219`), que
 * apunta una transformación pura `html -> html`. El dueño del asiento de
 * respaldo, `@deepseek-ai/dsh-host-frontend-static`, sirve el `index.html` del
 * frontend pasándolo por `ctx.webServer.renderIndex(...)`
 * (`dsh-host-frontend-static/lib/index.js:85`), y `renderIndex` aplica las filas
 * estructuradas y DESPUÉS los taps (`dsh-host-webserver/lib/index.js:360-362`).
 *
 * O sea: no se toca ni un fichero del motor ni del frontend. Se engancha una
 * función al index que se sirve, y ahí dentro van el CSS y los guiones.
 *
 * ── LA VENTANA DE LAS 3 CLAVES ──────────────────────────────────────────────
 * La web de Ajustes > Models guarda cada clave con `ctx.remote.credentials.set`
 * (`dsh-client-ui-settings-models/lib/client.js:2592`), que en el Host llega a
 * `credentials.set(branded, value)` sobre `ctx.get("credentials")`
 * (`dsh-api-settings-controller/lib/index.js:171-179,193`); el proveedor local
 * (`@deepseek-ai/dsh-credentials-local`) escribe `$DSH_HOME/.credentials.yaml`
 * (`lib/index.js:513` → `write()` `:604-629`) y con `describe()` responde
 * `{configured, source, writable}` sin ver nunca el valor (`lib/index.js:491`).
 * La piel usa ESE MISMO SERVICIO Y ESOS MISMOS MÉTODOS desde el servidor del
 * plugin: la ventana de navegador habla con dos rutas propias de la piel
 * (`/ratacode/estado` GET y `/ratacode/guardar` POST), registradas en el mismo
 * `webServer`, protegidas con el cerco del motor (`connection.requestRejection`:
 * Host/Origin + cookie de sesión de navegador, `dsh-client-connection`
 * `lib/index.js:552-556`). El valor de la clave sólo viaja en la dirección
 * navegador→servicio de credenciales; nunca se devuelve, nunca se guarda en
 * fichero de la piel y nunca se imprime en el log.
 *
 * Si algún día el motor cambia de nombre el servicio o el tap, esta piel no
 * engancha: se calla y lo dice por consola, en vez de romper el arranque. Si lo
 * que falta son `credentials` o `connection`, la cara se pone igual y la
 * ventana simplemente no sale (el guion de cliente no recibe estado y no actúa).
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Nombre estable del plugin de cordis. */
export const name = 'ratacode-piel';
/** El tap vive en el servidor web: hasta que no está, no hay nada que enganchar. */
export const inject = ['webServer'];

const AQUI = dirname(fileURLToPath(import.meta.url));
const ACTIVOS = join(AQUI, '..', 'activos');

function leer(nombre) {
  return readFileSync(join(ACTIVOS, nombre), 'utf8');
}

/** El emblema de la rata, en data-URI, para la variable `--mr-emblema`. */
function emblemaCss() {
  const svg = leer('ratacode-emblema.svg');
  return ':root{--mr-emblema:url("data:image/svg+xml,' + encodeURIComponent(svg) + '")}';
}

/** Todo el CSS de la piel, en el orden en que se aplicaba en MODO RATA. */
function cssDeLaPiel() {
  return [leer('ratacode-identidad.css'), emblemaCss(), leer('ratacode-piel.css'), leer('ratacode-claves.css')].join('\n');
}

/** Un guion dentro de un `<script>`: sólo hay que romper el `</script` literal. */
function dentroDeScript(js) {
  return js.replace(/<\/script/gi, '<\\/script');
}

const MARCA = 'id="ratacode-piel"';
/** El título que trae el frontend de DSH y que NUNCA debe verse. */
const TITULO_AJENO = /<title[^>]*>[\s\S]*?<\/title>/i;

/**
 * La transformación: mete el `<style>` en la cabeza y los guiones al final
 * del cuerpo, y cambia el `<title>` por «RATACODE». Idempotente: si la marca
 * ya está, devuelve el html tal cual.
 *
 * El título completo («<sesión> — RATACODE») lo pone el guion de cliente, que
 * intercepta `document.title`: el frontend escribe
 * `${sesión} — DeepSeek Harness` (`dsh-client-ui-layout/lib/client.js:62`), así
 * que se cambia en el único sitio por el que pasan todos los cambios.
 * @param html - el index.html tal y como lo sirve el motor.
 * @returns el index con la cara de RATACODE dentro.
 */
export function vestir(html) {
  if (html.includes(MARCA)) return html;
  const estilo = '<style ' + MARCA + '>' + cssDeLaPiel() + '</style>';
  const guiones = '<script>' + dentroDeScript(leer('ratacode-piel.js')) + '</script>'
    + '<script>' + dentroDeScript(leer('ratacode-vida.js')) + '</script>'
    + '<script>' + dentroDeScript(leer('ratacode-claves.js')) + '</script>';
  let salida = html;
  if (TITULO_AJENO.test(salida)) salida = salida.replace(TITULO_AJENO, '<title>RATACODE</title>');
  const cabeza = /<head(?:\s[^>]*)?>/i.exec(salida);
  salida = cabeza === null ? estilo + salida : salida.slice(0, cabeza.index + cabeza[0].length) + estilo + salida.slice(cabeza.index + cabeza[0].length);
  const cuerpo = /<\/body>/i.exec(salida);
  salida = cuerpo === null ? salida + guiones : salida.slice(0, cuerpo.index) + guiones + salida.slice(cuerpo.index);
  return salida;
}

// ── el apretón de manos: el botón «Copiar apretón» de la barra lateral ──────

/**
 * Dónde está `apreton\navegador.md`. Se busca en dos sitios porque el plugin
 * viaja COPIADO dentro del perfil de la casa: ahí `bin\ratacode.js` deja una
 * copia del apretón junto al plugin; en el repositorio está dos carpetas más
 * arriba. Si no aparece en ninguno, la ruta simplemente no se monta.
 */
const APRETON_CANDIDATOS = [
  join(AQUI, '..', 'apreton', 'navegador.md'),
  join(AQUI, '..', '..', 'apreton', 'navegador.md'),
];

/** La casa de ESTE motor, la misma que usa `bin/ratacode.js`. */
function casaDeEstaCasa() {
  return process.env.DSH_HOME ?? process.env.RATACODE_HOME ?? join(homedir(), '.ratacode');
}

/**
 * La URL real de ESTA casa: la que `ratacode` dejó en `<casa>\url.txt` (con su
 * token). Si no está, se compone con el `Host` del pedido — que el cerco ya ha
 * dado por bueno — y sin token.
 */
function urlDeEstaCasa(req) {
  try {
    const leida = readFileSync(join(casaDeEstaCasa(), 'url.txt'), 'utf8').trim();
    if (leida !== '') return leida;
  } catch { /* sin url.txt: se compone */ }
  const host = req.headers.host;
  return typeof host === 'string' && host !== '' ? 'http://' + host + '/' : null;
}

/**
 * El texto del apretón para ESTA casa: el mismo `navegador.md`, con la casa y
 * la URL ya puestas arriba, para que quien lo reciba no tenga que buscar nada.
 * No lleva ninguna clave: el token de la URL es el de la sesión del navegador,
 * que sólo se sirve por esta ruta protegida con el mismo cerco que `/ratacode/estado`.
 */
function textoDelApreton(req) {
  let crudo = null;
  for (const candidato of APRETON_CANDIDATOS) {
    try {
      crudo = readFileSync(candidato, 'utf8');
      break;
    } catch { /* se prueba el siguiente */ }
  }
  if (crudo === null) return null;
  const casa = casaDeEstaCasa();
  const url = urlDeEstaCasa(req);
  const cabecera = [
    '> **Esta casa, ya puesta.**',
    '>',
    '> - Carpeta de la casa: `' + casa + '`',
    '> - URL del panel: ' + (url === null ? '(mira `' + join(casa, 'url.txt') + '`)' : url),
    '>',
    '> Lo de abajo es el apretón de manos: pégalo en tu chat tal cual.',
    '',
    '',
  ].join('\n');
  return cabecera + crudo.split('<casa>').join(casa);
}

// ── la ventana de las 3 claves: las dos rutas del servidor de la piel ───────

/** Las tres referencias de clave que pregunta y guarda RATACODE (nombres de
 *  variable de entorno que maneja el servicio de credenciales de DSH). */
const CLAVES = [
  { ref: 'B_AI_API_KEY' },
  { ref: 'OPENROUTER_API_KEY' },
  { ref: 'DEEPSEEK_API_KEY' },
];
const BLANCO = new Set(CLAVES.map((c) => c.ref));
/** Tope del cuerpo de /ratacode/guardar: una clave no ocupa más de 16 KB. */
const CUERPO_MAXIMO = 16384;

function json(res, codigo, objeto) {
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(objeto));
}

/** Lee un cuerpo JSON con tope de bytes; nunca se registra ni una coma del valor. */
function leerCuerpo(req) {
  return new Promise((resuelve) => {
    let bytes = 0;
    const partes = [];
    let corto = false;
    req.on('data', (trozo) => {
      bytes += trozo.length;
      if (bytes > CUERPO_MAXIMO) { corto = true; partes.length = 0; return; }
      partes.push(trozo);
    });
    req.on('end', () => {
      if (corto) { resuelve({ ok: false, error: 'El pedido es demasiado grande.' }); return; }
      try { resuelve({ ok: true, cuerpo: JSON.parse(Buffer.concat(partes).toString('utf8')) }); }
      catch { resuelve({ ok: false, error: 'El pedido no es JSON válido.' }); }
    });
    req.on('error', () => resuelve({ ok: false, error: 'El pedido se cortó.' }));
  });
}

/**
 * Monta las rutas de la ventana sobre el `webServer`, autenticadas con el mismo
 * cerco que el motor aplica a sus canales (`connection.requestRejection`).
 * @param c - contexto de cordis con `webServer`, `credentials` y `connection`.
 */
function montarVentana(c) {
  const servidor = c.webServer;
  const credenciales = c.credentials;

  const autorizada = (req, res) => {
    let rechazo;
    try { rechazo = c.connection.requestRejection(req); }
    catch { rechazo = 500; }
    if (rechazo === undefined) return true;
    res.writeHead(rechazo, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(rechazo === 401 ? 'sin autorización' : 'prohibido');
    return false;
  };

  // GET /ratacode/estado → {casa, claves:{REF:{configurada,origen,editable}}}
  // Sólo estados del `describe()` de DSH: el valor jamás sale por aquí. La casa
  // va para que el navegador pueda recordar por casa lo que el usuario decide
  // (p. ej. «Luego»): el localStorage es por origen, y el puerto no distingue
  // una casa de otra.
  const estado = async (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    const claves = {};
    for (const { ref } of CLAVES) {
      let info;
      try { info = await credenciales.describe(ref); }
      catch { info = { configured: false, writable: true }; }
      claves[ref] = {
        configurada: info.configured === true,
        origen: typeof info.source === 'string' ? info.source : null,
        editable: info.writable !== false,
      };
    }
    json(res, 200, { casa: casaDeEstaCasa(), claves });
  };

  // POST /ratacode/guardar {ref, valor} → la MISMA llamada que hace el controlador
  // de Ajustes > Models: ctx.credentials.set(ref, valor) (dsh-credentials-local
  // escribe <casa>\.credentials.yaml). Refs sólo las tres del blanco.
  const guardar = async (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      json(res, 415, { ok: false, error: 'Falta content-type: application/json.' }); return;
    }
    const pedido = await leerCuerpo(req);
    if (!pedido.ok) { json(res, 400, { ok: false, error: pedido.error }); return; }
    const { ref, valor } = pedido.cuerpo || {};
    if (typeof ref !== 'string' || !BLANCO.has(ref)) {
      json(res, 400, { ok: false, error: 'Esa clave no es de las tres de RATACODE.' }); return;
    }
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      json(res, 400, { ok: false, error: 'La clave está vacía; no se guarda nada vacío.' }); return;
    }
    if (valor.length > 4096) { json(res, 400, { ok: false, error: 'Eso no parece una clave (demasiado largo).' }); return; }
    let info;
    try { info = await credenciales.describe(ref); } catch { info = void 0; }
    if (info && info.configured === true && info.source === 'env') {
      json(res, 400, { ok: false, error: 'ya-entorno' }); return;
    }
    try {
      // La llamada exacta del servicio de credenciales de DSH:
      await credenciales.set(ref, valor.trim());
    } catch (e) {
      const m = e && e.message ? String(e.message) : String(e);
      // El mensaje del motor nombra la referencia y el entorno, nunca el valor.
      json(res, 500, { ok: false, error: m.includes('launching environment') ? 'ya-entorno' : 'No se pudo guardar: ' + m });
      return;
    }
    c.logger?.info?.('ratacode-piel: clave guardada por la ventana (ref ' + ref + ', valor no registrado)');
    json(res, 200, { ok: true, ref });
  };

  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/estado', handler: estado }), 'ratacode-piel.claves.estado');
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/guardar', handler: guardar }), 'ratacode-piel.claves.guardar');
  c.logger?.info?.('ratacode-piel: la ventana de las 3 claves escucha en /ratacode/estado y /ratacode/guardar');

  // GET /ratacode/apreton → el apretón de manos de ESTA casa, en texto plano,
  // con la URL ya puesta. Mismo cerco que /ratacode/estado: Host/Origin + cookie.
  const apreton = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    const texto = textoDelApreton(req);
    if (texto === null) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('no encuentro apreton/navegador.md en esta instalación');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(texto);
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/apreton', handler: apreton }), 'ratacode-piel.apreton');
  c.logger?.info?.('ratacode-piel: el apretón de manos se sirve en /ratacode/apreton');
}

/**
 * Monta la piel sobre el servidor web del motor.
 * @param ctx - contexto de cordis con el servicio `webServer`.
 */
export function apply(ctx) {
  const servidor = ctx.webServer;
  if (servidor === undefined || typeof servidor.tapIndex !== 'function') {
    ctx.logger?.warn?.('ratacode-piel: este motor no tiene webServer.tapIndex; la piel no se pone');
    return;
  }
  ctx.effect(() => servidor.tapIndex(vestir), 'ratacode-piel.tapIndex');
  // La ventana necesita el servicio de credenciales y el cerco del canal del
  // navegador. Si el día de mañana faltaran, la cara se pone igual y la
  // ventana no sale: el guion de cliente no recibe estado y no actúa.
  ctx.inject(['credentials', 'connection'], (c) => montarVentana(c));
  ctx.logger?.info?.('ratacode-piel: enganchada al index que sirve DSH web');
}
