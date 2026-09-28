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
 * ── LAS CLAVES: DONDE LAS PONE DSH (R12) ────────────────────────────────────
 * Aquí hubo una ventana propia con las 3 claves. Ya no: las claves se ponen
 * donde DSH las pone SIEMPRE, en **Ajustes > Models** (cada proveedor con su
 * campo «API key»), y el valor lo escribe el motor en `<casa>\.credentials.yaml`
 * con `ctx.remote.credentials.set` → `dsh-api-settings-controller` →
 * `@deepseek-ai/dsh-credentials-local`. Esta piel ya no lee, no pide ni guarda
 * ninguna clave: no queda ni una ruta de claves.
 *
 * ── LO QUE SÍ SIRVE ESTA PIEL (R12) ────────────────────────────────────────
 *   · el CSS y los guiones de la cara (identidad, piel, vida), y
 *   · el APRETÓN DE MANOS de ESTA casa, que vive en Ajustes > Handshakes:
 *       GET  /ratacode/handshake  → el texto corto, con la URL de esta casa.
 *       POST /ratacode/handshake  → además lo deja en `<casa>\handshake.md`.
 *       GET  /ratacode/mcp        → el MCP para chats web: estado del HTTP y
 *                                   del túnel, aviso de lectura total, los dos
 *                                   comandos y el texto para pegar en el chat.
 *       GET  /ratacode/clave      → (R17) si al modelo por DEFECTO de la casa le
 *                                   falta la clave, con el `describe` del
 *                                   servicio de credenciales del motor (nunca
 *                                   se lee un fichero de claves) y el nombre
 *                                   visible de cada proveedor.
 *     Las tres van con el cerco del motor (`connection.requestRejection`:
 *     Host/Origin + cookie de sesión de navegador, `dsh-client-connection`
 *     `lib/index.js:552-556`), igual que los canales del propio DSH.
 *
 * La SECCIÓN «Handshakes» del menú de Ajustes NO la pinta este fichero: la
 * registra el plugin de cliente `lib/cliente.js` por la vía OFICIAL de DSH
 * (`ctx.slots.register({name:'settings.section', …}, Component)`, la misma que
 * usa `dsh-client-ui-agent-preset/lib/client.js:1519`). Ver `package.json`
 * (`exports["./client"]` + `dsh.client.platform = "web"`).
 *
 * Si algún día el motor cambia de nombre el servicio o el tap, esta piel no
 * engancha: se calla y lo dice por consola, en vez de romper el arranque.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Todo el CSS de la piel, en el orden en que se aplica (identidad, emblema, piel). */
function cssDeLaPiel() {
  return [leer('ratacode-identidad.css'), emblemaCss(), leer('ratacode-piel.css')].join('\n');
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
    + '<script>' + dentroDeScript(leer('ratacode-vida.js')) + '</script>';
  let salida = html;
  if (TITULO_AJENO.test(salida)) salida = salida.replace(TITULO_AJENO, '<title>RATACODE</title>');
  const cabeza = /<head(?:\s[^>]*)?>/i.exec(salida);
  salida = cabeza === null ? estilo + salida : salida.slice(0, cabeza.index + cabeza[0].length) + estilo + salida.slice(cabeza.index + cabeza[0].length);
  const cuerpo = /<\/body>/i.exec(salida);
  salida = cuerpo === null ? salida + guiones : salida.slice(0, cuerpo.index) + guiones + salida.slice(cuerpo.index);
  return salida;
}

// ── el apretón de manos (Ajustes > Handshakes) ─────────────────────────────

/**
 * Dónde está `apreton\handshake.md`. Se busca en dos sitios porque el plugin
 * viaja COPIADO dentro del perfil de la casa: ahí `bin\ratacode.js` deja una
 * copia del apretón junto al plugin; en el repositorio está dos carpetas más
 * arriba. Si no aparece en ninguno, la ruta lo dice en vez de inventarse nada.
 */
const HANDSHAKE_CANDIDATOS = [
  join(AQUI, '..', 'apreton', 'handshake.md'),
  join(AQUI, '..', '..', 'apreton', 'handshake.md'),
];

/**
 * La instalación de RATACODE (la carpeta del paquete, con `mcp\tunel.mjs`
 * dentro). `bin\ratacode.js` deja la ruta en `instalacion.txt`, junto a este
 * plugin; así los comandos del MCP llevan la ruta de verdad y no un `<ruta>`
 * que el usuario tenga que adivinar. Si no está, se dice `cd <ruta de
 * RATACODE>` y que lo mire en el README.
 */
function instalacionDeEstaCasa() {
  try {
    const leida = readFileSync(join(AQUI, '..', 'instalacion.txt'), 'utf8').trim();
    if (leida !== '') return leida;
  } catch { /* instalación antigua: no hay pista */ }
  return null;
}

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
 * El texto del apretón para ESTA casa: el `handshake.md` corto, con la casa y
 * la URL ya puestas arriba, para que quien lo reciba no tenga que buscar nada.
 * No lleva ninguna clave: el token de la URL es el de la sesión del navegador,
 * que sólo se sirve por esta ruta protegida con el mismo cerco que el resto.
 * @param req - el pedido, para poder componer la URL si no hay `url.txt`.
 * @returns {{texto: string, url: string|null}|null} null si no hay handshake.md.
 */
function textoDelHandshake(req) {
  let crudo = null;
  for (const candidato of HANDSHAKE_CANDIDATOS) {
    try {
      crudo = readFileSync(candidato, 'utf8');
      break;
    } catch { /* se prueba el siguiente */ }
  }
  if (crudo === null) return null;
  const casa = casaDeEstaCasa();
  const url = urlDeEstaCasa(req);
  const cabecera = [
    '> **Esta casa, ya puesta.** Carpeta: `' + casa + '` · Panel: '
      + (url === null ? '(mira `' + join(casa, 'url.txt') + '`)' : url),
    '> Pégalo en tu chat tal cual: es el apretón de manos de RATACODE.',
    '',
    '',
  ].join('\n');
  return { texto: cabecera + crudo.split('<casa>').join(casa), url, casa };
}

// ── el MCP para chats web ──────────────────────────────────────────────────

/** Lee un fichero de la casa sin reventar si no está; '' si no se puede. */
function leerDeLaCasa(...trozos) {
  try { return readFileSync(join(casaDeEstaCasa(), ...trozos), 'utf8').trim(); } catch { return ''; }
}

/** El puerto del MCP por HTTP, tal y como quedó en su URL local. */
function puertoDeLaUrlMCP(url) {
  const m = /^https?:\/\/[^/]+:(\d+)\//.exec(url);
  return m === null ? null : Number(m[1]);
}

/**
 * El texto que se pega en un chat web (ChatGPT, Claude…) para que sepa qué es
 * RATACODE, qué herramientas tiene y cómo se espera a que acabe una tarea.
 * @param url - la URL del conector MCP que va a usar ese chat.
 * @returns el texto, en español, listo para pegar.
 */
function textoParaPegar(url) {
  return [
    'Trabajo con RATACODE por MCP. RATACODE es mi terminal de trabajo: un motor',
    'que corre en MI ordenador, con los modelos que yo',
    'tengo configurados (baratos) y herramientas de verdad: leer y escribir',
    'ficheros, shell, búsqueda, subagentes. Tú planificas y revisas; el trabajo',
    'pesado se descarga en RATACODE.',
    '',
    'URL del conector MCP: ' + (url ?? '(el MCP todavía no está arrancado)'),
    '',
    'Herramientas:',
    '- list_models: lista los modelos disponibles (proveedor, id, contexto).',
    '  Llámala primero para saber con qué cuenta RATACODE.',
    '- run_task: lanza un encargo. Con esperar_segundos (1-600) la llamada ESPERA',
    '  y devuelve el resultado completo en esa misma respuesta (usa 300 para un',
    '  encargo normal). Sin esperar_segundos devuelve un task_id al momento y el',
    '  trabajo sigue en segundo plano.',
    '- get_task_status: estado de una tarea (queued, running, completed, failed,',
    '  cancelled).',
    '- get_task_result: la respuesta, el modelo, los tokens, el coste y la',
    '  duración.',
    '',
    'Si yo he elegido modelo, no lo cambies. Si no, usa el de por defecto de la',
    'casa y dime cuál es. Con un encargo largo, usa esperar_segundos y no cierres',
    'tu turno hasta que get_task_status diga completed o failed.',
    '',
    'AVISO: RATACODE no puede acotar lo que una tarea LEE (el motor no tiene modo',
    'de sólo lectura), así que quien tenga esta URL puede pedir que le lea',
    'ficheros de mi PC. No la compartas y no la dejes abierta más de lo necesario.',
  ].join('\n');
}

/**
 * El estado del MCP de esta casa y lo que hay que pegar/ejecutar.
 * - El MCP por HTTP está ARRANCADO si existe `<casa>\mcp\http-url.txt` (lo
 *   escribe el propio servidor al escuchar, `mcp/bin/ratacode-mcp.js:179-183`).
 * - El túnel está ABIERTO si existe `<casa>\mcp\tunel-url.txt` (lo escribe
 *   `mcp/tunel.mjs` cuando cloudflared da la URL pública, y lo borra al cerrar).
 * @param req - el pedido, para el caso de que falte el `url.txt` del panel.
 * @returns el estado, los dos comandos y el texto para el chat.
 */
function estadoDelMcp(req) {
  const casa = casaDeEstaCasa();
  const urlLocal = leerDeLaCasa('mcp', 'http-url.txt');
  const urlTunel = leerDeLaCasa('mcp', 'tunel-url.txt');
  const instalacion = instalacionDeEstaCasa();
  const donde = instalacion === null ? '<ruta de RATACODE>' : instalacion;
  const conecta = urlTunel !== '' ? urlTunel : (urlLocal !== '' ? urlLocal : null);
  const comandos = [
    'cd ' + donde + '; ratacode mcp --http --acepto-lectura-total',
    'cd ' + donde + '; node mcp/tunel.mjs --home ' + casa + ' --acepto-lectura-total',
  ].join('\n');
  return {
    ok: true,
    casa,
    instalacion,
    http: {
      abierto: urlLocal !== '',
      url: urlLocal === '' ? null : urlLocal,
      puerto: puertoDeLaUrlMCP(urlLocal),
    },
    tunel: {
      abierto: urlTunel !== '',
      url: urlTunel === '' ? null : urlTunel,
    },
    panel: urlDeEstaCasa(req),
    lecturaTotal: true,
    comandos,
    pegar: textoParaPegar(conecta),
  };
}

// ── R17 · la clave que le falta al modelo por defecto ──────────────────────

/**
 * Un valor dentro de un objeto, por su camino de claves (`['providers','b-ai']`).
 * El `settingsPath` que declara cada proveedor configurable es justo eso.
 */
function porCamino(objeto, camino) {
  let actual = objeto;
  for (const trozo of camino ?? []) {
    if (actual === null || typeof actual !== 'object') return undefined;
    actual = actual[trozo];
  }
  return actual;
}

/**
 * ¿Al modelo por DEFECTO de esta casa le falta la clave? Se responde con la vía
 * OFICIAL del motor y sin leer un solo fichero de claves:
 *   · el proveedor y el modelo, por `ctx.agentDefaultModel.currentSelection()`;
 *   · la credencial que esa ruta nombra (`apiKeyEnv`), por el `settingsPath` que
 *     declara el directorio de proveedores (`ctx.llm.listConfigurableProviders`)
 *     y el valor resuelto de su namespace (`ctx.settings.get`);
 *   · si está puesta o no, por `ctx.credentials.describe` (`configured`).
 * Una ruta que NO nombra credencial (Ollama y LM Studio de fábrica) no pide
 * clave: esa es la regla del propio motor (`dsh-llm-pi-ai`: `namesCredential`).
 * @param c - contexto de cordis, ya con `connection`.
 * @returns el estado; `ok:false` cuando a este motor le falta alguna pieza.
 */
async function estadoDeLaClave(c) {
  const llm = c.get('llm');
  const settings = c.get('settings');
  if (llm === undefined || settings === undefined) {
    return { ok: false, falta: false, motivo: 'este motor no expone llm/settings' };
  }
  const entradas = llm.listConfigurableProviders();
  const proveedores = {};
  for (const entrada of entradas) proveedores[entrada.provider] = entrada.displayName;
  const seleccion = c.get('agentDefaultModel')?.currentSelection?.() ?? null;
  const proveedor = seleccion?.provider ?? null;
  const entrada = entradas.find((e) => e.provider === proveedor);
  const perfil = entrada === undefined ? undefined : porCamino(settings.get(entrada.settingsNs), entrada.settingsPath);
  const variable = typeof perfil?.apiKeyEnv === 'string' && perfil.apiKeyEnv !== '' ? perfil.apiKeyEnv : null;
  // Un nombre que no es un identificador de shell no puede ser una referencia:
  // `describe` lo rechazaría, así que se trata como «esta ruta no pide clave».
  const conForma = variable !== null && /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable);
  let tieneClave = null;
  if (conForma) {
    const credentials = c.get('credentials');
    if (credentials === undefined) return { ok: false, falta: false, motivo: 'este motor no monta el servicio de credenciales' };
    try { tieneClave = (await credentials.describe(variable)).configured === true; }
    catch (e) { return { ok: false, falta: false, motivo: 'no pude preguntar por la credencial: ' + (e?.message ?? e) }; }
  }
  return {
    ok: true,
    falta: conForma && tieneClave === false,
    necesitaClave: conForma,
    tieneClave,
    proveedor,
    nombre: (proveedor !== null ? proveedores[proveedor] : null) ?? proveedor,
    variable: conForma ? variable : null,
    modelo: seleccion?.model ?? null,
    proveedores,
  };
}

// ── las rutas del servidor de la piel ──────────────────────────────────────

function json(res, codigo, objeto) {
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(objeto));
}

/**
 * Monta las rutas del apretón y del MCP sobre el `webServer`, autenticadas con
 * el mismo cerco que el motor aplica a sus canales
 * (`connection.requestRejection`).
 * @param c - contexto de cordis con `webServer` y `connection`.
 */
function montarRutas(c) {
  const servidor = c.webServer;

  const autorizada = (req, res) => {
    let rechazo;
    try { rechazo = c.connection.requestRejection(req); }
    catch { rechazo = 500; }
    if (rechazo === undefined) return true;
    res.writeHead(rechazo, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(rechazo === 401 ? 'sin autorización' : 'prohibido');
    return false;
  };

  /** Escribe `<casa>\handshake.md` (0600) y devuelve dónde quedó. */
  const escribirHandshake = (texto) => {
    const ruta = join(casaDeEstaCasa(), 'handshake.md');
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, texto, { mode: 0o600 });
    return ruta;
  };

  // GET /ratacode/handshake → el apretón corto de ESTA casa, sin escribir nada.
  // POST /ratacode/handshake → lo mismo, y además lo deja en `<casa>\handshake.md`.
  const handshake = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa GET o POST.' }); return; }
    const hecha = textoDelHandshake(req);
    if (hecha === null) {
      json(res, 404, { ok: false, error: 'no encuentro apreton/handshake.md en esta instalación' });
      return;
    }
    let ruta = null;
    if (req.method === 'POST') {
      try { ruta = escribirHandshake(hecha.texto); }
      catch (e) { json(res, 500, { ok: false, error: 'no pude escribir handshake.md: ' + (e?.message ?? e) }); return; }
      c.logger?.info?.('ratacode-piel: apretón de manos dejado en ' + ruta);
    }
    json(res, 200, { ok: true, url: hecha.url, casa: hecha.casa, ruta, texto: hecha.texto });
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/handshake', handler: handshake }), 'ratacode-piel.handshake');

  // GET /ratacode/mcp → estado del MCP + los dos comandos + el texto del chat.
  const mcp = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    json(res, 200, estadoDelMcp(req));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/mcp', handler: mcp }), 'ratacode-piel.mcp');

  // GET /ratacode/clave → ¿le falta la clave al modelo por defecto de la casa?
  // Lo pregunta el guion de la piel para avisar en español encima de la caja.
  const clave = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDeLaClave(c).then((estado) => json(res, 200, estado), (e) => json(res, 500, { ok: false, falta: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/clave', handler: clave }), 'ratacode-piel.clave');
  c.logger?.info?.('ratacode-piel: el apretón se sirve en /ratacode/handshake, el MCP en /ratacode/mcp y la clave que falta en /ratacode/clave');
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
  // Las rutas necesitan el cerco del canal del navegador. Si faltara, la cara se
  // pone igual y las rutas no salen: la sección de Ajustes lo dirá al pedirlas.
  ctx.inject(['connection'], (c) => montarRutas(c));
  ctx.logger?.info?.('ratacode-piel: enganchada a la web del panel');
}
