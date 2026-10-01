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
 *   · el CSS y los guiones de la cara (identidad, piel, vida, y el ESPAÑOL de
 *     RATACODE como paquete de idioma oficial; ver `activos/ratacode-es.js`), y
 *   · el TEXTO DE LA CONEXIÓN de ESTA casa, que vive en Ajustes > Conexiones:
 *       GET  /ratacode/handshake  → el texto corto, con la URL de esta casa.
 *       POST /ratacode/handshake  → además lo deja en `<casa>\handshake.md`.
 *       GET  /ratacode/conexion   → (R23) el estado de la conexión de los chats
 *                                   web: si está encendida (el túnel abierto),
 *                                   la dirección que se pega y si la encendió
 *                                   RATACODE (entonces el botón puede apagarla).
 *       POST /ratacode/conexion/encender y /apagar → los botones del usuario.
 *       GET  /ratacode/mcp        → el MCP para chats web: estado del HTTP y
 *                                   del túnel, la carpeta autorizada (que es la
 *                                   línea que enseña la tarjeta), los dos
 *                                   comandos y el texto para pegar en el chat.
 *       GET  /ratacode/clave      → (R17) si al modelo por DEFECTO de la casa le
 *                                   falta la clave, con el `describe` del
 *                                   servicio de credenciales del motor (nunca
 *                                   se lee un fichero de claves) y el nombre
 *                                   visible de cada proveedor. Desde R18 dice
 *                                   también si ese modelo es LOCAL y, si lo es,
 *                                   si su runtime está encendido.
 *       GET  /ratacode/runtimes   → (R18) los dos runtimes locales (Ollama y LM
 *                                   Studio): si están encendidos (sondeo corto
 *                                   de `/v1/models`; en Ollama también
 *                                   `/api/tags`), sus modelos y cuáles valen
 *                                   como agente, su `baseURL`, cómo encenderlos
 *                                   en una línea y la tabla del README (qué
 *                                   modelo según tu tarjeta).
 *     Las cuatro van con el cerco del motor (`connection.requestRejection`:
 *     Host/Origin + cookie de sesión de navegador, `dsh-client-connection`
 *     `lib/index.js:552-556`), igual que los canales del propio DSH.
 *
 * La SECCIÓN «Conexiones» del menú de Ajustes NO la pinta este fichero: la
 * registra el plugin de cliente `lib/cliente.js` por la vía OFICIAL de DSH
 * (`ctx.slots.register({name:'settings.section', …}, Component)`, la misma que
 * usa `dsh-client-ui-agent-preset/lib/client.js:1519`). Ver `package.json`
 * (`exports["./client"]` + `dsh.client.platform = "web"`).
 *
 * Si algún día el motor cambia de nombre el servicio o el tap, esta piel no
 * engancha: se calla y lo dice por consola, en vez de romper el arranque.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cargarCerco,
  devolverPermiso,
  enviarMensaje,
  leerAbiertas,
  leerEnviados,
  listarSesiones,
  marcarAbierta,
  montarCerco,
  respuestaDe,
} from './sesiones.js';

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
  // El español va PRIMERO: deja los diccionarios en `window.__RATACODE_ES` antes
  // de que arranque el módulo de la piel, que es quien los registra por la vía
  // oficial de idiomas de DSH (`ctx.locale`). Así no se ve ni un parpadeo en
  // inglés al abrir el panel.
  const guiones = '<script>' + dentroDeScript(leer('ratacode-es.js')) + '</script>'
    + '<script>' + dentroDeScript(leer('ratacode-piel.js')) + '</script>'
    + '<script>' + dentroDeScript(leer('ratacode-vida.js')) + '</script>';
  let salida = html;
  if (TITULO_AJENO.test(salida)) salida = salida.replace(TITULO_AJENO, '<title>RATACODE</title>');
  const cabeza = /<head(?:\s[^>]*)?>/i.exec(salida);
  salida = cabeza === null ? estilo + salida : salida.slice(0, cabeza.index + cabeza[0].length) + estilo + salida.slice(cabeza.index + cabeza[0].length);
  const cuerpo = /<\/body>/i.exec(salida);
  salida = cuerpo === null ? salida + guiones : salida.slice(0, cuerpo.index) + guiones + salida.slice(cuerpo.index);
  return salida;
}

// ── el texto de la conexión (Ajustes > Conexiones) ─────────────────────────

/**
 * Dónde está `apreton\handshake.md`. Se busca en dos sitios porque el plugin
 * viaja COPIADO dentro del perfil de la casa: ahí `bin\ratacode.js` deja una
 * copia del texto junto al plugin; en el repositorio está dos carpetas más
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
 * La ruta de `apreton\tutor.md` —la guía del tutor— que el agente puede abrir en
 * ESTA instalación (R29). Se prefiere la del PAQUETE (la que deja
 * `bin\ratacode.js` en `instalacion.txt`, con `mcp\` al lado); si esa pista no
 * está (instalación antigua), vale la copia que viaja junto al plugin, que es
 * este mismo `apreton\`. Nunca se inventa una ruta: son las dos que existen.
 */
function rutaDelTutor() {
  const instalacion = instalacionDeEstaCasa();
  return instalacion === null
    ? join(AQUI, '..', 'apreton', 'tutor.md')
    : join(instalacion, 'apreton', 'tutor.md');
}

/**
 * El texto de la conexión para ESTA casa: el `handshake.md` corto, con la casa y
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
    '> Pégalo en tu chat tal cual: con esto, el chat sabe trabajar con RATACODE.',
    '',
    '',
  ].join('\n');
  // `<casa>` y `<tutor>` se cambian por rutas de VERDAD de esta instalación: el
  // texto que se copia no lleva marcadores que el agente tenga que adivinar.
  const texto = cabecera + crudo.split('<casa>').join(casa).split('<tutor>').join(rutaDelTutor());
  return { texto, url, casa };
}

// ── el MCP para chats web ──────────────────────────────────────────────────

/** El nombre del túnel nombrado de la casa, si el usuario lo tiene dado de alta. */
const TUNEL_NOMBRADO = 'mcp.mod-rat.com';

/** R27 · el puerto del MCP por HTTP si la casa no dice otra cosa (`mcp.puerto`). */
const PUERTO_MCP_POR_DEFECTO = 3778;

/** Lee un fichero de la casa sin reventar si no está; '' si no se puede. */
function leerDeLaCasa(...trozos) {
  try { return readFileSync(join(casaDeEstaCasa(), ...trozos), 'utf8').trim(); } catch { return ''; }
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
    'Y SI QUIERES HABLAR CON UNA SESIÓN QUE YA TENGO ABIERTA EN EL PANEL (eso NO',
    'es run_task: aquí el mensaje entra en ESA conversación, se ve aparecer en ese',
    'chat y yo leo la respuesta ahí):',
    '- list_sessions: las sesiones del panel, con su id, título y si están',
    '  «Abiertas a ChatGPT».',
    '- get_session: una sesión, por su id o por su título exacto.',
    '- send_to_session: manda un mensaje a UNA de esas sesiones. Tiene que estar',
    '  marcada «Abierta a ChatGPT» en la cabecera de su chat (lo enciendo yo) y su',
    '  carpeta tiene que estar en mis carpetas autorizadas; si no, te dirá',
    '  SESSION_NOT_ALLOWED y no manda nada. Espera 25 s por defecto y te devuelve',
    '  la respuesta si el turno acaba dentro.',
    '- get_session_reply: la respuesta de un mensaje ya mandado (por su turn_id).',
    '  Si dice que sigue en marcha, no preguntes en bucle: una vez cada 20 s.',
    '  Si el título coincide con más de una sesión, send_to_session NO elige: te',
    '  devuelve AMBIGUOUS_SESSION con los ids.',
    '',
    'Si yo he elegido modelo, no lo cambies. Si no, usa el de por defecto de la',
    'casa y dime cuál es. Con un encargo largo, usa esperar_segundos y no cierres',
    'tu turno hasta que get_task_status diga completed o failed.',
    '',
    'AVISO: cada tarea trabaja ENCERRADA en las carpetas autorizadas de mi casa',
    '(mcp.workspaces): lee y escribe solo ahí, sin terminal, sin red y sin',
    'subagentes. Fuera de ahí la herramienta se para y lo dice. No la compartas',
    'y no la dejes abierta más de lo necesario.',
  ].join('\n');
}

/**
 * Los ajustes de `mcp:` que necesita la piel, leídos del TEXTO de `settings.yaml`
 * (esta piel viaja copiada dentro del perfil del motor y no lleva dependencias:
 * no tiene js-yaml). Son cuatro valores sencillos, todos de una línea:
 *   · `puerto` — el puerto del MCP por HTTP de esta casa (3778 de fábrica). Se
 *     usa para encender el MCP Y el túnel, así la dirección es siempre la misma.
 *   · `tunel_nombre` y `tunel_host` — el «túnel con nombre» de Cloudflare (lo
 *     da de alta el humano en su cuenta), para una dirección FIJA.
 *   · `workspaces` — la lista de carpetas autorizadas (su lector de siempre).
 * @returns {{puerto: number, tunelNombre: string|null, tunelHost: string|null, workspaces: string[]}}
 */
function ajustesDeLaCasa() {
  const casa = casaDeEstaCasa();
  let texto;
  try { texto = readFileSync(join(casa, 'settings.yaml'), 'utf8'); } catch {
    return { puerto: PUERTO_MCP_POR_DEFECTO, tunelNombre: null, tunelHost: null, workspaces: [] };
  }
  const salida = { puerto: PUERTO_MCP_POR_DEFECTO, tunelNombre: null, tunelHost: null, workspaces: [] };
  let enMcp = false;
  let enLista = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (/^\S/.test(linea)) { // una clave de primer nivel: empieza (o acaba) `mcp:`
      enMcp = /^mcp:/.test(linea);
      enLista = false;
      continue;
    }
    if (!enMcp) continue;
    const clave = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(linea);
    if (clave !== null) {
      const nombre = clave[1];
      const valor = clave[2].replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '');
      enLista = nombre === 'workspaces';
      if (nombre === 'puerto') {
        const n = Number(valor);
        if (Number.isInteger(n) && n > 0 && n < 65536) salida.puerto = n;
      }
      if (nombre === 'tunel_nombre' && valor !== '') salida.tunelNombre = valor;
      if (nombre === 'tunel_host' && valor !== '') salida.tunelHost = valor;
      continue;
    }
    if (!enLista) continue;
    const punto = /^\s*-\s+(.+?)\s*$/.exec(linea);
    if (punto !== null) salida.workspaces.push(punto[1].replace(/^['"]|['"]$/g, ''));
  }
  return salida;
}

/**
 * El estado del MCP de esta casa y lo que hay que pegar/ejecutar.
 * - El MCP por HTTP está ARRANCADO si su URL **contesta**, y contesta como
 *   NUESTRO servidor (R27 §2: mirar que exista el fichero no basta — un fichero
 *   de un proceso muerto, o de OTRA casa que se haya quedado con el puerto,
 *   diría «conectado» mintiendo).
 * - El túnel está ABIERTO si hay URL y el proceso de cloudflared sigue vivo
 *   (`<casa>\mcp\tunel.pid`).
 * @param req - el pedido, para el caso de que falte el `url.txt` del panel.
 * @returns {Promise<object>} el estado, los dos comandos y el texto para el chat.
 */
async function estadoDelMcp(req) {
  const casa = casaDeEstaCasa();
  const ajustes = ajustesDeLaCasa();
  // R27 §2 · VIVOS, no sólo escritos.
  const mcpVivo = await vivoElMcp();
  const tunelVivo = vivoElTunel();
  const urlLocal = mcpVivo.url;
  const urlTunel = tunelVivo.url;
  const instalacion = instalacionDeEstaCasa();
  const donde = instalacion === null ? '<ruta de RATACODE>' : instalacion;
  const conecta = urlTunel !== '' ? urlTunel : (urlLocal !== '' ? urlLocal : null);
  // Los comandos, con el puerto DE ESTA CASA (R27 §3: misma dirección siempre).
  const comandos = [
    'cd ' + donde + '; ratacode mcp --http --port ' + ajustes.puerto,
    'cd ' + donde + '; node mcp/tunel.mjs --home ' + casa,
  ].join('\n');
  const carpetas = ajustes.workspaces;
  return {
    ok: true,
    casa,
    instalacion,
    http: {
      abierto: urlLocal !== '',
      url: urlLocal === '' ? null : urlLocal,
      puerto: mcpVivo.puerto ?? ajustes.puerto,
      // Si hay URL escrita pero no contesta (o contesta OTRO), se dice por qué.
      motivo: mcpVivo.motivo ?? null,
    },
    tunel: {
      abierto: urlTunel !== '',
      url: urlTunel === '' ? null : urlTunel,
      pid: tunelVivo.pid,
      // R27 §8 · el túnel con nombre (dirección fija), si el humano lo configuró.
      nombre: ajustes.tunelNombre,
      host: ajustes.tunelHost,
      fijo: ajustes.tunelHost === null ? null : 'https://' + ajustes.tunelHost,
    },
    panel: urlDeEstaCasa(req),
    // R25 · las carpetas donde ESTE chat puede leer y escribir, tal y como las
    // declara la casa. Sin lista no hay conexión posible (el MCP no arranca por
    // HTTP sin `mcp.workspaces`), así que aquí siempre hay al menos una.
    carpetas,
    carpeta: carpetas[0] ?? null,
    comandos,
    pegar: textoParaPegar(conecta),
  };
}

// ── R27 · LO QUE ESTÁ HACIENDO EL MCP, PARA QUE EL PANEL LO VEA ────────────
/**
 * Una foto barata de la casa para el panel (R27 §1): las tareas del MCP (las
 * que estén apuntadas en `<casa>\mcp\tareas\`) y las últimas llamadas del
 * cuaderno (`<casa>\mcp\actividad.jsonl`), que desde R27 incluye también las de
 * SÓLO LECTURA. Es lo que la cara de cliente sondea cada pocos segundos para
 * saber si hay una sesión nueva que refrescar y para pintar en Actividad lo que
 * hizo el chat (ChatGPT) aunque no lanzara ninguna tarea.
 *
 * Sin casa, sin claves y sin el contenido de los ficheros: sólo lo justo.
 * @param {number} cuantas - cuántas líneas del cuaderno devolver.
 * @returns {object} la foto.
 */
function fotoDelMcp(cuantas = 30) {
  const casa = casaDeEstaCasa();
  const carpeta = join(casa, 'mcp', 'tareas');
  const tareas = [];
  try {
    for (const nombre of readdirSync(carpeta)) {
      if (!nombre.endsWith('.json')) continue;
      try {
        const t = JSON.parse(readFileSync(join(carpeta, nombre), 'utf8'));
        tareas.push({
          task_id: t.task_id ?? null,
          estado: t.estado ?? null,
          cliente: t.cliente ?? null,
          model: t.model ?? null,
          provider: t.provider ?? null,
          empezada: t.empezada ?? null,
          terminada: t.terminada ?? null,
          sesion: 'mcp-' + (t.task_id ?? ''),
        });
      } catch { /* una tarea ilegible no invalida la lista */ }
    }
  } catch { /* sin carpeta de tareas: no hay nada */ }
  tareas.sort((a, b) => String(b.empezada).localeCompare(String(a.empezada)));
  return {
    ok: true,
    actualizado: new Date().toISOString(),
    sello: selloDeLaCasa(),
    tareas: tareas.slice(0, 20),
    actividad: ultimasDelCuaderno(carpeta, cuantas),
  };
}

/**
 * Un sello que cambia cuando aparece una tarea nueva: es lo que la cara de
 * cliente mira para NO pedir un refresco de más. Se compone del número de
 * ficheros de tarea y del de la última tarea (por nombre, que lleva el sello de
 * tiempo), sin leer ninguno.
 * @returns {string} el sello.
 */
function selloDeLaCasa() {
  const carpeta = join(casaDeEstaCasa(), 'mcp', 'tareas');
  try {
    const nombres = readdirSync(carpeta).filter((n) => n.endsWith('.json')).sort();
    return nombres.length + '·' + (nombres[nombres.length - 1] ?? '');
  } catch {
    return '0·';
  }
}

/** Las últimas líneas del cuaderno de actividad, la más reciente primero. */
function ultimasDelCuaderno(carpeta, cuantas) {
  let lineas;
  try {
    lineas = readFileSync(join(carpeta, '..', 'actividad.jsonl'), 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  } catch {
    return [];
  }
  const salida = [];
  for (const linea of lineas.slice(-cuantas).reverse()) {
    try { salida.push(JSON.parse(linea)); } catch { /* una línea rota no invalida el cuaderno */ }
  }
  return salida;
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
  // R18 · si el modelo elegido es LOCAL, no le falta ninguna clave: lo que puede
  // pasar es que su runtime esté APAGADO. Se sondea aquí (1,5 s de tope) y el
  // aviso de la piel dice eso otro: «Ollama no está encendido: …».
  const runtime = RUNTIMES_LOCALES.find((r) => r.id === proveedor);
  let local = null;
  if (runtime !== undefined) {
    const sondeado = await sondearRuntime(c, runtime);
    local = {
      id: sondeado.id,
      nombre: sondeado.nombre,
      encendido: sondeado.encendido,
      arranque: sondeado.arranque,
      enlace: sondeado.enlace,
      baseURL: sondeado.baseURL,
      modelos: sondeado.modelos.map((m) => m.id),
    };
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
    local,
    encendido: local === null ? null : local.encendido,
    arranque: local === null ? null : local.arranque,
    enlace: local === null ? null : local.enlace,
  };
}

// ── R18 · los DOS runtimes locales (Ajustes › Modelos locales) ─────────────

/**
 * Los dos runtimes locales que RATACODE declara de fábrica (`fabrica/settings.yaml`,
 * proveedores `ollama` y `lmstudio`): su arranque en UNA línea pegable y su
 * enlace de descarga. `baseURL` y `models` salen de los ajustes vivos de la casa
 * (por eso, si el usuario cambia el puerto, aquí se ve el puerto de verdad); los
 * valores de `defecto`/`puerto` son sólo el respaldo cuando no hay ajustes.
 */
const RUNTIMES_LOCALES = [
  {
    id: 'ollama',
    nombre: 'Ollama',
    defecto: 'http://127.0.0.1:11434/v1',
    puerto: 11434,
    arranque: 'ollama serve',
    enlace: 'https://ollama.com/download',
    descarga: 'Descargar Ollama',
    pull: (modelo) => 'ollama pull ' + modelo,
    /** Busca su programa en el PC: primero en el PATH, luego donde se instala. */
    ejecutable: 'ollama',
    rutas: ['%LOCALAPPDATA%/Programs/Ollama/ollama.exe'],
    argsArranque: ['serve'],
    argsParada: null,
    /** Cómo se apaga sin tocar nada que no hayamos arrancado nosotros. */
    apagadoAMano: 'Se apaga desde el icono de Ollama en la bandeja: botón derecho → Quit.',
  },
  {
    id: 'lmstudio',
    nombre: 'LM Studio',
    defecto: 'http://127.0.0.1:1234/v1',
    puerto: 1234,
    arranque: 'lms server start',
    enlace: 'https://lmstudio.ai/download',
    descarga: 'Descargar LM Studio',
    pull: null,
    ejecutable: 'lms',
    rutas: ['%USERPROFILE%/.lmstudio/bin/lms.exe', '%LOCALAPPDATA%/LM-Studio/lms.exe', '%LOCALAPPDATA%/Programs/LM Studio/lms.exe'],
    argsArranque: ['server', 'start'],
    argsParada: ['server', 'stop'],
    apagadoAMano: null,
  },
];

/** Los runtimes que ha arrancado ESTA piel (y por tanto puede parar ella). */
const ARRANCADOS = new Map();

/** Expande `%VARIABLE%` y `~` en una ruta de Windows. */
function expandir(ruta) {
  return ruta.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_todo, nombre) => process.env[nombre] ?? '');
}

/** ¿Existe este fichero? Sin lanzar nada. */
function existe(ruta) {
  try { return statSync(ruta).isFile(); } catch { return false; }
}

/**
 * Su programa en el PC: primero el PATH (que es lo que usa el usuario al
 * escribirlo a mano), después las carpetas donde se instala. Sin bloquear: son
 * comprobaciones de fichero, y el PATH se mira una vez por runtime.
 * @param runtime - la ficha del runtime.
 * @returns la ruta del ejecutable, o null si no está instalado.
 */
function ejecutableDe(runtime) {
  const carpetas = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').filter((c) => c !== '');
  const nombres = process.platform === 'win32' ? [runtime.ejecutable + '.exe', runtime.ejecutable + '.cmd', runtime.ejecutable] : [runtime.ejecutable];
  for (const carpeta of carpetas) {
    for (const nombre of nombres) {
      const ruta = join(carpeta, nombre);
      if (existe(ruta)) return ruta;
    }
  }
  for (const plantilla of runtime.rutas ?? []) {
    const ruta = expandir(plantilla);
    if (ruta !== '' && existe(ruta)) return ruta;
  }
  return null;
}

/** La tarjeta del PC (VRAM), mirada UNA vez. `null` si no se puede saber. */
let tarjetaCache;
function tarjetaDelPc() {
  if (tarjetaCache !== undefined) return tarjetaCache;
  tarjetaCache = null;
  try {
    const salida = execFileSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader'], {
      encoding: 'utf8', timeout: 4000, windowsHide: true,
    });
    const primera = salida.split(/\r?\n/).find((l) => l.trim() !== '');
    const m = /^(.*?),\s*(\d+)\s*MiB/.exec(primera ?? '');
    if (m !== null) {
      tarjetaCache = { nombre: m[1].trim(), gb: Math.round(Number(m[2]) / 1024) };
    }
  } catch { /* sin nvidia-smi (o sin tarjeta NVIDIA): no se sabe, y se dice */ }
  return tarjetaCache;
}

/**
 * El modelo recomendado para una tarjeta: el más grande de la tabla que quepa.
 * @param gb - los GB de VRAM, o null si no se sabe.
 * @returns el id del modelo, o null si no hay tarjeta que mirar.
 */
function modeloParaTarjeta(gb) {
  if (gb === null) return null;
  const caben = TARJETAS_LOCALES.filter((t) => Number.parseInt(t.tarjeta, 10) <= gb);
  if (caben.length === 0) return TARJETAS_LOCALES[TARJETAS_LOCALES.length - 1].modelo;
  return caben[caben.length - 1].modelo;
}


/**
 * La tabla del README («qué modelo local según tu tarjeta»), en una línea por
 * tarjeta. R15 la midió: es la recomendación que enseña la pestaña nueva.
 */
const TARJETAS_LOCALES = [
  { tarjeta: '8 GB', modelo: 'qwen3:8b', tamano: '5,2 GB', nota: 'la mejor evidencia independiente de uso de herramientas (F1 0,919); aquí devuelve tool_calls de verdad' },
  { tarjeta: '12 GB', modelo: 'gemma4:12b', tamano: '7,6 GB', nota: 'cifra agéntica publicada (τ² 69,0); a ≤16K de contexto' },
  { tarjeta: '16 GB', modelo: 'gpt-oss:20b', tamano: '14 GB', nota: '`tools` nativo; SÚBELE el contexto (con 4K por defecto las herramientas se rompen)' },
  { tarjeta: '24 GB', modelo: 'muse-glimmer:30b', tamano: '18 GB', nota: 'o `qwen3.6:27b`: los dos con cifras de trabajo real (SWE-bench 76-77)' },
  { tarjeta: 'Solo CPU', modelo: 'granite4.1:3b', tamano: '2,1 GB', nota: 'o `lfm2.5:8b` (1B activo): caben en RAM sin tarjeta' },
];

/**
 * Qué modelos locales valen como AGENTE (que llamen bien a las herramientas, no
 * que hablen de ellas). Las dos listas salen de la tabla y de los avisos de R15,
 * que es lo que publica el README; `re` casa por delante para que valga también
 * con etiquetas (`qwen3:8b-q4_K_M`, `gemma4:12b-instruct`…).
 */
const MODELOS_QUE_VALEN = [
  { re: /^qwen3:8b/i, nota: 'la mejor evidencia independiente (F1 0,919 en el banco de Docker); medido aquí: devuelve tool_calls' },
  { re: /^lfm2\.5:8b/i, nota: 'badge `tools thinking`, hecho para tool calling (sin cifras publicadas)' },
  { re: /^gemma4:12b/i, nota: 'function calling nativo con cifra agéntica publicada (τ² 69,0)' },
  { re: /^qwen3:14b/i, nota: 'F1 0,971, empatado con GPT-4 (no entra en 10 GB)' },
  { re: /^gpt-oss:20b/i, nota: '`tools` nativo y Apache-2.0; SÚBELE el contexto y no hace llamadas en paralelo' },
  { re: /^mistral-small3\.2:24b/i, nota: 'el mejor «agentic» de BFCL v4 entre los de su talla (31,0)' },
  { re: /^muse-glimmer:30b/i, nota: 'entrenado para recuperarse de fallos (MCP Atlas 75,5)' },
  { re: /^qwen3\.6:27b/i, nota: '`vision tools thinking`; SWE-bench Verified 77,2' },
  { re: /^gemma4:26b/i, nota: 'τ²-retail 85,5' },
  { re: /^granite4\.1:3b/i, nota: '`tools` + JSON estructurado, Apache-2.0' },
  { re: /^nemotron-3\.5-lightning:30b/i, nota: '3B activos y 1M de contexto: cabe en 32 GB de RAM' },
];

/** Los que NO valen como agente, y por qué (medido en R15). */
const MODELOS_QUE_NO = [
  { re: /^qwen2\.5-coder/i, nota: 'devuelve las herramientas como TEXTO dentro del mensaje: el agente se queda mirando (medido en R15)' },
  { re: /^qwen3\.5:9b/i, nota: 'con el *thinking* activado imprime el tool call en XML y no llega a ejecutarlo' },
];

/**
 * ¿Este modelo local vale como agente? `clase` es `agente` (sí), `no` (medido
 * que no) o `sin-datos` (no hay ninguna cifra publicada: no se promete nada).
 * @param id - el id que devuelve el runtime (`qwen3:8b`, `gemma4:12b`…).
 * @returns la clase y la nota, en español.
 */
function clasificarModeloLocal(id) {
  for (const regla of MODELOS_QUE_NO) {
    if (regla.re.test(id)) return { clase: 'no', nota: regla.nota };
  }
  for (const regla of MODELOS_QUE_VALEN) {
    if (regla.re.test(id)) return { clase: 'agente', nota: regla.nota };
  }
  return { clase: 'sin-datos', nota: 'sin cifras publicadas de uso de herramientas: pruébalo antes de fiarte' };
}

/** Una petición corta que NUNCA revienta: `null` si no contesta a tiempo. */
async function pedirCorto(url, ms) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/**
 * La `baseURL` viva de un runtime local: la que la casa tiene puesta en sus
 * ajustes (así se ve el puerto de verdad si el usuario lo cambió) o la de
 * fábrica si no hay ajustes que la declaren.
 * @param c - contexto de cordis (para `settings` y `llm`, los dos opcionales).
 * @param runtime - la ficha del runtime (`RUNTIMES_LOCALES`).
 * @returns la URL base, sin barra final.
 */
function baseURLDelRuntime(c, runtime) {
  const llm = c.get?.('llm');
  const settings = c.get?.('settings');
  if (llm !== undefined && settings !== undefined) {
    try {
      const entrada = llm.listConfigurableProviders().find((e) => e.provider === runtime.id);
      if (entrada !== undefined) {
        const perfil = porCamino(settings.get(entrada.settingsNs), entrada.settingsPath);
        if (typeof perfil?.baseURL === 'string' && perfil.baseURL !== '') return perfil.baseURL.replace(/\/+$/, '');
      }
    } catch { /* ajustes raros: se usa la de fábrica */ }
  }
  return runtime.defecto;
}

/**
 * Cómo se cambia la dirección de un runtime local. La pestaña «Modelos locales»
 * lo dice con la ruta de ESTA casa, porque en Ajustes › Models ya no está (R18):
 * se toca el `baseURL` de su bloque en `settings.yaml` (o se levanta el runtime
 * escuchando en otro puerto).
 * @param c - contexto de cordis.
 * @param runtime - la ficha del runtime.
 * @param baseURL - la baseURL viva.
 * @returns el texto, en español, con la ruta real del fichero.
 */
function comoCambiarLaDireccion(c, runtime, baseURL) {
  const casa = casaDeEstaCasa();
  const puerto = /:(\d+)\//.exec(baseURL + '/');
  return 'Se cambia en ' + join(casa, 'settings.yaml') + ' → llm-pi-ai.providers.'
    + runtime.id + '.baseURL (hoy ' + baseURL + (puerto === null ? '' : ', puerto ' + puerto[1]) + '). '
    + 'Para otro puerto, cambia las dos cosas: esa línea y el arranque del runtime (por ejemplo '
    + '`' + (runtime.id === 'ollama' ? 'OLLAMA_HOST=127.0.0.1:11435 ollama serve' : 'lms server start --port 1235') + '`).';
}

/**
 * Sondea un runtime local: ¿está encendido?, ¿qué modelos tiene?, ¿cuáles valen
 * como agente? Se mira `/v1/models` (la API de OpenAI que usan los dos) y, en
 * Ollama, también `/api/tags` (su API propia). Si no contesta en 1,5 s, se dice
 * que está apagado y NO se espera más: la página no se bloquea.
 * @param c - contexto de cordis.
 * @param runtime - la ficha del runtime.
 * @returns la ficha con `baseURL`, `encendido`, `instalado` y la lista de modelos.
 */
async function sondearRuntime(c, runtime) {
  const baseURL = baseURLDelRuntime(c, runtime);
  const raiz = baseURL.replace(/\/v1$/, '');
  const [v1, etiquetas] = await Promise.all([
    pedirCorto(baseURL + '/models', 1500),
    runtime.id === 'ollama' ? pedirCorto(raiz + '/api/tags', 1500) : Promise.resolve(null),
  ]);
  let ids = Array.isArray(v1?.data) ? v1.data.map((m) => m?.id).filter((x) => typeof x === 'string' && x !== '') : [];
  if (ids.length === 0 && Array.isArray(etiquetas?.models)) {
    ids = etiquetas.models.map((m) => m?.name).filter((x) => typeof x === 'string' && x !== '');
  }
  const modelos = [...new Set(ids)].sort((a, b) => a.localeCompare(b)).map((id) => ({ id, ...clasificarModeloLocal(id) }));
  const ejecutable = ejecutableDe(runtime);
  const tarjeta = tarjetaDelPc();
  const encendido = v1 !== null || etiquetas !== null;
  return {
    id: runtime.id,
    nombre: runtime.nombre,
    baseURL,
    puerto: Number((/:(\d+)(?:\/|$)/.exec(baseURL) ?? [null, null])[1]) || runtime.puerto,
    encendido,
    respondeV1: v1 !== null,
    respondeApi: etiquetas !== null,
    /** ¿Su programa está en el PC? Se mira el PC, no la red: sin bloquear. */
    instalado: ejecutable !== null || encendido,
    ejecutable,
    /** Se puede encender desde aquí si sabemos dónde está su programa. */
    puedeEncender: ejecutable !== null && !encendido,
    /** Se puede apagar sin matar nada ajeno: lo arrancamos nosotros, o tiene orden propia. */
    puedeApagar: encendido && (ARRANCADOS.has(runtime.id) || runtime.argsParada !== null),
    loArrancamos: ARRANCADOS.has(runtime.id),
    apagadoAMano: runtime.apagadoAMano,
    modelos,
    arranque: runtime.arranque,
    enlace: runtime.enlace,
    descarga: runtime.descarga,
    pull: runtime.pull === null ? null : runtime.pull(modeloParaTarjeta(tarjeta === null ? null : tarjeta.gb) ?? 'qwen3:8b'),
    recomendado: modeloParaTarjeta(tarjeta === null ? null : tarjeta.gb) ?? 'qwen3:8b',
    cambiar: comoCambiarLaDireccion(c, runtime, baseURL),
  };
}

/**
 * Enciende un runtime local a petición del usuario (el botón «Encender»): se
 * lanza SU programa, con sus argumentos, sin shell. Si no sabemos dónde está, no
 * se lanza nada y se dice. Sólo se arranca lo que se pueda parar después.
 * @param runtime - la ficha del runtime.
 * @returns `{ok, motivo}`.
 */
function encenderRuntime(runtime) {
  const ejecutable = ejecutableDe(runtime);
  if (ejecutable === null) return { ok: false, motivo: 'no encuentro el programa de ' + runtime.nombre + ' en este PC' };
  if (ARRANCADOS.has(runtime.id)) return { ok: true, motivo: 'ya lo había encendido RATACODE' };
  try {
    const hijo = spawn(ejecutable, runtime.argsArranque, { detached: true, stdio: 'ignore', windowsHide: true });
    hijo.on('error', () => { ARRANCADOS.delete(runtime.id); });
    hijo.unref();
    ARRANCADOS.set(runtime.id, { hijo, cuando: Date.now() });
    return { ok: true, motivo: 'encendido desde RATACODE' };
  } catch (e) {
    return { ok: false, motivo: 'no pude encenderlo: ' + (e?.message ?? e) };
  }
}

/**
 * Apaga un runtime local a petición del usuario (el botón «Apagar»). Regla de la
 * casa: NUNCA se mata un proceso que no haya arrancado RATACODE. Si lo arrancó
 * RATACODE, se para ese proceso (y su árbol). Si no, sólo se para si el propio
 * runtime trae su orden (`lms server stop`); si no, se dice cómo se apaga a mano.
 * @param runtime - la ficha del runtime.
 * @returns `{ok, motivo, aMano}`.
 */
function apagarRuntime(runtime) {
  const nuestro = ARRANCADOS.get(runtime.id);
  if (nuestro !== undefined) {
    ARRANCADOS.delete(runtime.id);
    try {
      if (process.platform === 'win32' && nuestro.hijo.pid !== undefined) {
        spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + nuestro.hijo.pid + ' /T /F'], { windowsHide: true, stdio: 'ignore' });
      } else {
        nuestro.hijo.kill('SIGTERM');
      }
      return { ok: true, motivo: 'parado (lo había encendido RATACODE)' };
    } catch (e) {
      return { ok: false, motivo: 'no pude pararlo: ' + (e?.message ?? e) };
    }
  }
  const ejecutable = ejecutableDe(runtime);
  if (runtime.argsParada !== null && ejecutable !== null) {
    try {
      execFileSync(ejecutable, runtime.argsParada, { timeout: 15000, windowsHide: true, stdio: 'ignore' });
      return { ok: true, motivo: runtime.nombre + ' ha parado su servidor' };
    } catch (e) {
      return { ok: false, motivo: 'no pude pararlo: ' + (e?.message ?? e) };
    }
  }
  return { ok: false, aMano: true, motivo: runtime.apagadoAMano ?? ('Para apagar ' + runtime.nombre + ', ciérralo desde su propia ventana.') };
}

/** El runtime por su id, o null. */
function runtimePorId(id) {
  return RUNTIMES_LOCALES.find((r) => r.id === id) ?? null;
}

/** Un runtime por su id, esperando un poco a que arranque o se apague. */
async function esperarCambio(c, id, queremosEncendido, plazoMs) {
  const limite = Date.now() + plazoMs;
  let ultimo = null;
  for (;;) {
    ultimo = await sondearRuntime(c, runtimePorId(id));
    if (ultimo.encendido === queremosEncendido || Date.now() >= limite) return ultimo;
    await new Promise((listo) => setTimeout(listo, 400));
  }
}

/** ¿Este proveedor es uno de los dos runtimes locales? */
function esProveedorLocal(id) {
  return RUNTIMES_LOCALES.some((r) => r.id === id);
}

/**
 * El estado de los dos runtimes locales, tal y como lo pinta Ajustes › Modelos
 * locales: si están instalados, encendidos o apagados, sus modelos (y cuáles
 * valen como agente), su dirección, cómo encenderlos y la recomendación según la
 * tarjeta de ESTE PC.
 * @param c - contexto de cordis.
 * @returns el estado completo; nunca lanza (si un sondeo falla, sale apagado).
 */
async function estadoDeLosRuntimes(c) {
  const runtimes = await Promise.all(RUNTIMES_LOCALES.map((r) => sondearRuntime(c, r)));
  const tarjeta = tarjetaDelPc();
  return {
    ok: true,
    casa: casaDeEstaCasa(),
    runtimes,
    tarjeta,
    recomendado: modeloParaTarjeta(tarjeta === null ? null : tarjeta.gb),
    tarjetas: TARJETAS_LOCALES,
    aviso: 'Una ruta sin `apiKeyEnv` (Ollama y LM Studio) NO pide clave: nada de lo que hables con ellos '
      + 'sale de tu ordenador, y por eso no están en Ajustes › Models, donde sólo se ponen claves.',
  };
}

// ── R22 · el aviso de migración de claves (una línea, y no vuelve) ─────────

/**
 * El aviso de migración: la PRIMERA vez que una casa arranca con la versión que
 * ya no lee claves del entorno, `bin\ratacode.js` deja los NOMBRES de las
 * variables de claves que hay en Windows en `<casa>\aviso-claves.txt` (nunca sus
 * valores). Aquí se mira si esa clave **no** está ya puesta en la casa —con el
 * `describe` del servicio de credenciales del motor, sin leer ningún fichero— y,
 * si no lo está, se devuelve el aviso en una línea. Cuando el usuario lo cierra,
 * se deja `<casa>\aviso-claves-visto` y no vuelve más.
 * @param c - contexto de cordis, ya con `credentials`.
 * @returns `{ok, aviso: {variable, texto}|null}`.
 */
async function estadoDeLaMigracion(c) {
  const casa = casaDeEstaCasa();
  let nombres = [];
  try {
    nombres = readFileSync(join(casa, 'aviso-claves.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l !== '');
  } catch {
    return { ok: true, aviso: null };
  }
  if (nombres.length === 0) return { ok: true, aviso: null };
  if (existsSync(join(casa, 'aviso-claves-visto'))) return { ok: true, aviso: null };
  const credentials = c.get('credentials');
  for (const nombre of nombres) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre)) continue;
    let puesta = null;
    if (credentials !== undefined) {
      try { puesta = (await credentials.describe(nombre)).configured === true; } catch { puesta = null; }
    }
    // Si la clave YA está en la casa, no hay nada que avisar: el usuario ya la pegó.
    if (puesta !== false) continue;
    return {
      ok: true,
      aviso: {
        variable: nombre,
        texto: 'Tienes ' + nombre + ' en Windows. RATACODE ya no la usa: pega tu clave en Ajustes › Models.',
      },
    };
  }
  return { ok: true, aviso: null };
}

// ── R23 · la conexión de los chats web, con botón (Encender / Apagar) ───────

/** Los dos hijos que ha arrancado RATACODE para abrir la conexión. */
const CONEXION = { mcp: null, tunel: null, ultimoError: null };

/** ¿Ese hijo sigue vivo? */
function vivo(hijo) {
  return hijo !== null && hijo.exitCode === null && hijo.killed !== true;
}

// ── R27 §2 · «CONECTADO» TIENE QUE SER VERDAD ──────────────────────────────
// El estado se decidía por la EXISTENCIA de `<casa>\mcp\http-url.txt` y
// `<casa>\mcp\tunel-url.txt`. El problema medido: si los procesos se mueren
// (se cierra la ventana del túnel, se apaga el MCP a mano), los ficheros se
// quedan escritos, la tarjeta sigue diciendo «Conectado» y «Apagar» no hace
// nada (no hay ningún hijo al que apagar). Ahora se comprueba que estén VIVOS
// —el puerto del MCP escucha y el proceso del túnel existe— y, si no lo están,
// se LIMPIAN los ficheros y se dice «Sin conectar». Los ficheros son lo que
// leen `estadoDelMcp` y la tarjeta, así que limpiarlos es lo que hace que el
// estado no mienta.

/** El puerto de una URL (`http://127.0.0.1:3778/mcp/<clave>`). */
function puertoDe(url) {
  try {
    const u = new URL(String(url));
    if (u.port !== '') return Number(u.port);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

/** ¿Ese pid es un proceso vivo? */
function pidVivo(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: el proceso existe pero es de otro usuario (cuenta como vivo).
    return e?.code === 'EPERM';
  }
}

/** Leer un pid de la casa (`<casa>\mcp\tunel.pid`). */
function leerPid(ruta) {
  try {
    const n = Number(readFileSync(ruta, 'utf8').trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * ¿Está VIVO el MCP por HTTP de esta casa? Y no basta con que «escuche alguien»:
 * tiene que contestar COMO NUESTRO SERVIDOR.
 *
 * ── POR QUÉ ASÍ (medido el 30-sep-2026) ────────────────────────────────────
 * Con la comprobación anterior («¿hay alguien escuchando en ese puerto?») salía
 * un «Conectado» falso de verdad: Patxi tenía su propio MCP en el puerto por
 * defecto (3778, de la casa `casa-camel`), y el MCP de la casa de pruebas no
 * pudo escuchar (puerto ocupado), murió... y su `http-url.txt` se quedó escrito
 * apuntando a un puerto donde SÍ había alguien: el MCP de OTRA casa, con OTRA
 * clave. La URL no habría funcionado.
 *
 * ── LA PRUEBA QUE SÍ VALE ──────────────────────────────────────────────────
 * Un `GET` a la URL del conector, con la clave de ESTA casa:
 *   · 405 → es NUESTRO servidor: la clave vale y está en modo sin estado (es lo
 *     que contesta `mcp/lib/http.js` a un GET con la clave buena).
 *   · 404 → hay alguien, pero no es esta casa (la clave no vale ahí).
 *   · sin respuesta → no hay nadie.
 * Es la única comprobación que mide lo que de verdad importa: que la dirección
 * que se pega en ChatGPT FUNCIONE. Esta consulta NO BORRA NADA (lo que esté
 * muerto se limpia en `limpiarLoMuerto` y al encender).
 * @returns {Promise<{vivo: boolean, url: string, puerto: number|null, motivo: string|null}>}
 */
async function vivoElMcp() {
  const url = leerDeLaCasa('mcp', 'http-url.txt');
  if (url === '') return { vivo: false, url: '', puerto: null, motivo: null };
  const puerto = puertoDe(url);
  const clave = leerDeLaCasa('mcp', 'http-secret.txt');
  const enLaUrl = /\/mcp\/([^/?#]+)/.exec(url)?.[1] ?? '';
  if (clave !== '' && enLaUrl !== '' && enLaUrl !== clave) {
    // La URL lleva una clave que ya no es la de la casa (un «Cambiar clave» a
    // medias, o un fichero viejo): esa dirección no vale, y ese fichero no sirve
    // para nada. Se limpia.
    limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'http-url.txt'));
    return { vivo: false, url: '', puerto, motivo: 'la URL del MCP llevaba una clave que ya no es la de esta casa: se ha limpiado; vuelve a copiar la dirección (o a encender)' };
  }
  // R28 §4b · SI LA URL ES RECIÉN ESCRITA, SE INSISTE. Es el caso de «Cambiar
  // clave»: el fichero lleva la clave nueva y el MCP que está en marcha tarda
  // hasta 2 s en adoptarla, así que en ese hueco contesta 404 y antes se decía
  // «en el puerto X contesta otro servidor» con nuestro propio MCP. Se mira la
  // fecha del fichero: sólo se espera cuando de verdad puede estar cambiando.
  const edad = antiguedadDe(join(casaDeEstaCasa(), 'mcp', 'http-url.txt'));
  const ventana = edad !== null && edad < 15000 ? 6000 : 0;
  const dicho = await sondearLaUrl(url, ventana);
  if (dicho === 'nuestro') return { vivo: true, url, puerto, motivo: null };
  if (dicho === 'ajeno') {
    // En ese puerto contesta OTRO servidor (el MCP de otra casa, otro programa,
    // o el propio panel si `mcp.puerto` es el suyo): esta URL no va a funcionar
    // nunca. Se limpia y se dice QUÉ se ha visto, sin inventarse nada.
    limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'http-url.txt'));
    const puertoDelPanel = puertoDe(urlDeEstaCasa({ headers: {} }) ?? '') ?? null;
    const esElPanel = puertoDelPanel !== null && puertoDelPanel === puerto;
    return {
      vivo: false,
      url: '',
      puerto,
      motivo: esElPanel
        ? 'en el puerto ' + puerto + ' está el PROPIO PANEL, no el MCP: `mcp.puerto` no puede ser el mismo que el del panel. Pon otro en settings.yaml'
        : 'en el puerto ' + puerto + ' contesta otro servidor (no contesta como el MCP de esta casa: la clave no vale ahí); cierra lo que tengas en ese puerto o cambia `mcp.puerto` en settings.yaml',
    };
  }
  if (dicho === 'sin-clave') {
    // Hay un servidor, pero la clave de esta casa no vale ahí TODAVÍA. No se
    // borra nada: puede ser el nuestro adoptando la clave nueva, y borrar la
    // dirección dejaría al usuario sin saber a quién pegarle el conector.
    return {
      vivo: false,
      url: '',
      puerto,
      motivo: 'en el puerto ' + puerto + ' hay un servidor, pero la clave de esta casa no vale ahí (HTTP 404). Si acabas de cambiar la clave, espera unos segundos y vuelve a copiar la dirección; si no, es el MCP de otra casa: cierra lo que tengas en ese puerto o cambia `mcp.puerto` en settings.yaml',
    };
  }
  // No contesta nadie. El fichero se limpia SÓLO si tampoco hay un hijo nuestro
  // vivo: entre escribir la URL y empezar a escuchar hay un instante, y borrar
  // el fichero de un MCP que está arrancando dejaría al panel diciendo «no hay
  // MCP» para siempre.
  if (!vivo(CONEXION.mcp)) limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'http-url.txt'));
  return { vivo: false, url: '', puerto, motivo: null };
}

/**
 * Sondear la URL del conector: la misma petición que haría ChatGPT, en pequeño.
 *
 * R28 §4b · Y ESPERANDO, PORQUE SI NO MIENTE. Lo que decía antes (30-sep-2026)
 * era: «405 → es nuestro, cualquier otra cosa → hay otro servidor». Y eso daba
 * un «en el puerto 3778 contesta otro servidor» con NUESTRO PROPIO MCP justo
 * después de «Cambiar clave»: la clave se escribe en el fichero y el MCP que
 * está en marcha la adopta hasta 2 s después (`mcp/lib/http.js:52`,
 * `MS_REVISION_CLAVE`), así que en ese hueco contesta 404 —que NO es «otro
 * servidor», es «todavía no»— y la tarjeta ponía en rojo una dirección que sí
 * funcionaba un segundo más tarde.
 *
 * Ahora hay CUATRO respuestas posibles, y cada una dice la verdad:
 *   · `nuestro`   — 405: es el MCP de esta casa y la clave vale.
 *   · `sin-clave` — 404: hay alguien, pero esa clave no vale ahí TODAVÍA (el MCP
 *                   puede estar adoptando la nueva). No prueba que sea ajeno.
 *   · `ajeno`     — cualquier otro código (200 de un panel, 401, 502…): ahí
 *                   contesta otro servidor, y esta URL no va a funcionar.
 *   · `nadie`     — no contesta nadie.
 * @param {string} url - la URL completa del MCP (con su clave).
 * @param {number} [ventanaMs] - cuánto se insiste cuando la respuesta es
 *   «todavía no» (0 = una sola sonda).
 * @returns {Promise<'nuestro'|'sin-clave'|'ajeno'|'nadie'>} qué ha contestado.
 */
async function sondearLaUrl(url, ventanaMs = 0) {
  const limite = Date.now() + Math.max(0, ventanaMs);
  for (;;) {
    let dicho = 'nadie';
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000), redirect: 'manual' });
      dicho = res.status === 405 ? 'nuestro' : (res.status === 404 ? 'sin-clave' : 'ajeno');
    } catch {
      dicho = 'nadie';
    }
    // Sólo se insiste con «todavía no»: un servidor ajeno o la ausencia de
    // respuesta no cambian por esperar.
    if (dicho !== 'sin-clave' || Date.now() >= limite) return dicho;
    await new Promise((listo) => setTimeout(listo, 500));
  }
}

/** ¿Cuánto hace que se escribió un fichero de la casa? `null` si no se puede. */
function antiguedadDe(ruta) {
  try { return Date.now() - statSync(ruta).mtimeMs; } catch { return null; }
}

/**
 * ¿Está VIVO el túnel? El túnel rápido de Cloudflare no se puede sondear desde
 * aquí (su dominio contesta siempre, aunque no haya nadie detrás), así que se
 * mira lo que SÍ es verdad local: `tunel-url.txt` (lo escribe el túnel cuando
 * cloudflared le dio la URL y lo borra al cerrar) y el pid que deja `tunel.mjs`
 * en `<casa>\mcp\tunel.pid`, que tiene que seguir existiendo. Como
 * {@link vivoElMcp}, esta consulta no borra nada.
 * @returns {{vivo: boolean, url: string, pid: number|null}}
 */
function vivoElTunel() {
  const url = leerDeLaCasa('mcp', 'tunel-url.txt');
  if (url === '') return { vivo: false, url: '', pid: null };
  const pid = leerPid(join(casaDeEstaCasa(), 'mcp', 'tunel.pid'));
  if (pid !== null && pidVivo(pid)) return { vivo: true, url, pid };
  // La URL está escrita pero el proceso del túnel no existe: eso es un túnel
  // muerto (o el fichero de una vez anterior). Se limpian los dos.
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel-url.txt'));
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel.pid'));
  return { vivo: false, url: '', pid };
}

/**
 * R27 §2 · LIMPIAR LO MUERTO: los ficheros de un MCP o de un túnel que ya no
 * existen se borran, para que el estado no mienta. Se llama en dos sitios y
 * sólo en dos: al arrancar la piel y al encender la conexión.
 * @returns {Promise<{mcp: boolean, tunel: boolean}>} si había algo vivo (y por tanto, no se tocó).
 */
async function limpiarLoMuerto() {
  const casa = casaDeEstaCasa();
  const mcp = await vivoElMcp();
  const tunel = vivoElTunel();
  if (mcp.vivo !== true) limpiarFichero(join(casa, 'mcp', 'http-url.txt'));
  if (tunel.vivo !== true) {
    limpiarFichero(join(casa, 'mcp', 'tunel-url.txt'));
    limpiarFichero(join(casa, 'mcp', 'tunel.pid'));
  }
  return { mcp: mcp.vivo === true, tunel: tunel.vivo === true };
}

/** Borrar un fichero de la casa sin reventar si no está. */
function limpiarFichero(ruta) {
  try { rmSync(ruta, { force: true }); } catch { /* da igual: sin permiso se queda, pero el estado ya dice que no */ }
}

/** La raíz de la instalación de RATACODE (donde vive `mcp\`). */
function raizDeLaInstalacion() {
  return instalacionDeEstaCasa() ?? join(AQUI, '..', '..');
}

/** La primera línea con algo de la salida de un hijo, para poder decir qué falló. */
function primeraLineaUtil(texto) {
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  return lineas.length === 0 ? '' : lineas[0];
}

/**
 * Enciende la conexión de los chats web: el MCP por HTTP (local) y el túnel, que
 * es lo que deja entrar a ChatGPT. Lo hace A PEDIDO DEL USUARIO —su botón— y ya
 * no hay nada que aceptar al pulsarlo: desde R25 cada tarea del MCP va encerrada
 * en las carpetas de `mcp.workspaces` (lee y escribe sólo ahí, sin terminal, sin
 * red, sin subagentes y sin guiones). Aquí no hay ningún reloj que abra esto
 * solo.
 * @param casa - la casa de RATACODE.
 * @returns `{ok, motivo}`.
 */
async function encenderConexion(casa, opciones = {}) {
  const raiz = raizDeLaInstalacion();
  const guionMcp = join(raiz, 'mcp', 'bin', 'ratacode-mcp.js');
  const guionTunel = join(raiz, 'mcp', 'tunel.mjs');
  if (!existsSync(guionMcp) || !existsSync(guionTunel)) {
    return { ok: false, motivo: 'no encuentro el MCP en esta instalación (' + raiz + ')' };
  }
  CONEXION.ultimoError = null;
  // R27 §2 · LAS DOS MITADES SON INDEPENDIENTES. Antes, si el túnel no llegaba a
  // abrirse (por ejemplo, sin `cloudflared` instalado), se apagaba TAMBIÉN el MCP
  // local y el botón «Encender» no dejaba nada: eso es lo que hacía que pareciera
  // que no hacía nada. Ahora el MCP local se queda encendido y se dice, en una
  // línea, que falta el túnel.
  const mcp = await encenderElMcp(casa, guionMcp, opciones.nuevaClave === true);
  if (mcp.ok !== true) return mcp;
  const tunel = await encenderElTunel(casa, guionTunel);
  return {
    ok: true,
    motivo: tunel.ok === true
      ? ((opciones.nuevaClave === true) ? 'encendida desde RATACODE, con clave nueva' : 'encendida desde RATACODE')
      : ('el MCP local está encendido; el túnel no: ' + tunel.motivo),
    mcp,
    tunel,
  };
}

/**
 * Encender SÓLO el MCP por HTTP (la mitad local). Reutiliza la clave guardada,
 * salvo que se pida una nueva (`opciones.nuevaClave`), que es lo que hace el
 * botón «Cambiar clave» al final de la vía.
 *
 * R27 §3 · Y SIEMPRE AL MISMO PUERTO (`mcp.puerto` de la casa, 3778 de
 * fábrica): si el puerto cambiara, la dirección que ChatGPT tiene pegada
 * dejaría de valer. Antes se arrancaba sin `--port`, así que tomaba el de
 * fábrica del MCP... que puede estar ocupado por el MCP de OTRA casa (medido:
 * el panel de Patxi tenía el 3778): ahí el hijo moría y quedaba un «conectado»
 * falso. Ahora, si el puerto de la casa está ocupado por otra cosa, se dice.
 * @param casa - la casa de RATACODE.
 * @param guionMcp - la ruta del guion del MCP.
 * @param {boolean} nuevaClave - true para estrenar clave.
 * @returns `{ok, motivo, url, puerto}`.
 */
async function encenderElMcp(casa, guionMcp, nuevaClave) {
  if (vivo(CONEXION.mcp)) return { ok: true, motivo: 'ya estaba encendido' };
  const puerto = ajustesDeLaCasa().puerto;
  // Si en ese puerto contesta OTRA cosa (el MCP de otra casa, otro programa, o
  // el propio panel), mejor decirlo que arrancar un hijo que va a morir sin
  // decir por qué. R28 §4b: además de `ajeno`, cuenta `sin-clave` —hay alguien
  // que no contesta a la clave de esta casa—, que es lo que se ve cuando el
  // puerto lo tiene el MCP de OTRA casa.
  const ocupado = await sondearLaUrl('http://127.0.0.1:' + puerto + '/mcp/' + leerDeLaCasa('mcp', 'http-secret.txt'));
  if (ocupado === 'ajeno' || ocupado === 'sin-clave') {
    return {
      ok: false,
      motivo: 'el puerto ' + puerto + ' lo tiene otro programa (y no contesta como el MCP de esta casa).'
        + ' Cierra lo que lo esté usando, o pon otro puerto en `mcp.puerto` de settings.yaml.',
    };
  }
  // R27 · se borra la URL de ANTES de arrancar: si el MCP de la vez pasada se
  // murió sin borrarla, su fichero es una mentira con la que no se puede
  // distinguir si el que escucha es el nuevo. Se limpia y se espera a que el
  // nuevo escriba la suya.
  limpiarFichero(join(casa, 'mcp', 'http-url.txt'));
  let salida = '';
  CONEXION.mcp = arrancarHijo((t) => { salida = (salida + t).slice(-4000); },
    guionMcp, ['--home', casa, '--http', '--port', String(puerto), ...(nuevaClave ? ['--nueva-clave'] : [])]);
  // Se espera a que la URL CONTESTE como nuestra (misma comprobación que el
  // estado): entre escribir `http-url.txt` y estar escuchando hay un instante.
  const limite = Date.now() + 20000;
  let estado = { vivo: false, url: '', puerto };
  for (;;) {
    if (!vivo(CONEXION.mcp)) break;
    estado = await vivoElMcp();
    if (estado.vivo === true) break;
    if (Date.now() >= limite) break;
    await new Promise((listo) => setTimeout(listo, 500));
  }
  if (estado.vivo !== true) {
    const motivo = primeraLineaUtil(salida) || estado.motivo || 'el MCP por HTTP no llegó a escuchar';
    apagarConexion();
    return { ok: false, motivo };
  }
  return { ok: true, motivo: nuevaClave ? 'encendido, con clave nueva' : 'encendido', url: estado.url, puerto: estado.puerto };
}

/**
 * Encender SÓLO el túnel. SIEMPRE con `--misma-clave` (R27 §3): la clave del
 * MCP no cambia al apagar y encender, así que el conector de ChatGPT sigue
 * valiendo y no hay que recrearlo.
 *
 * R27 §8 · Y CON EL TÚNEL CON NOMBRE SI LA CASA LO TIENE (`mcp.tunel_nombre` y
 * `mcp.tunel_host`): entonces la dirección es FIJA (`https://<host>/mcp/<clave>`)
 * en vez del dominio efímero del túnel rápido. El túnel lo da de alta el humano
 * en su Cloudflare; aquí no se hace login ni se crea nada.
 * @param casa - la casa de RATACODE.
 * @param guionTunel - la ruta del guion del túnel.
 * @returns `{ok, motivo, url}`.
 */
async function encenderElTunel(casa, guionTunel) {
  if (vivo(CONEXION.tunel)) return { ok: true, motivo: 'ya estaba abierto' };
  const ajustes = ajustesDeLaCasa();
  const args = ['--home', casa, '--misma-clave'];
  if (ajustes.tunelNombre !== null) args.push('--tunel-nombre', ajustes.tunelNombre, '--tunel-host', ajustes.tunelHost);
  let salida = '';
  CONEXION.tunel = arrancarHijo((t) => { salida = (salida + t).slice(-4000); }, guionTunel, args);
  // R27 · se espera a que el túnel esté vivo Y haya escrito su URL, y se vigila
  // que el hijo no se haya muerto por el camino (si se muere, `esperarFichero`
  // solo se enteraría al agotar el plazo).
  const rutaTunel = join(casa, 'mcp', 'tunel-url.txt');
  const limite = Date.now() + 30000;
  for (;;) {
    if (!vivo(CONEXION.tunel)) break;
    if (leerDeLaCasa('mcp', 'tunel-url.txt') !== '') {
      return { ok: true, motivo: 'abierto', url: leerDeLaCasa('mcp', 'tunel-url.txt') };
    }
    if (Date.now() >= limite) break;
    await new Promise((listo) => setTimeout(listo, 500));
  }
  // Lo que cuente el túnel: las líneas de cloudflared son largas, así que se
  // buscan las que EXPLICAN algo (el aviso de cloudflared que falta, el error
  // del túnel con nombre...) y no la primera línea cualquiera.
  CONEXION.ultimoError = explicarElTunel(salida) || null;
  const motivo = explicarElTunel(salida) || 'el túnel no llegó a abrirse';
  // El túnel no llegó: se para su hijo (si sigue) y se limpia lo que haya
  // escrito, pero el MCP local NO se toca — es local y no expone nada.
  apagarElTunel();
  limpiarFichero(rutaTunel);
  return { ok: false, motivo };
}

/** La línea del túnel que explica algo (o la primera con algo, si no hay otra). */
function explicarElTunel(texto) {
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const util = lineas.find((l) => /✋|ERR|error|failed|no está|no encuentro|denied/i.test(l));
  return util ?? (lineas[0] ?? '');
}

/** Arrancar un hijo y quedarse con lo que cuente (para poder explicar un fallo). */
function arrancarHijo(guardar, guion, args) {
  const hijo = spawn(process.execPath, [guion, ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  hijo.stdout.setEncoding('utf8');
  hijo.stderr.setEncoding('utf8');
  hijo.stdout.on('data', guardar);
  hijo.stderr.on('data', guardar);
  return hijo;
}

/**
 * R27 §3 · CAMBIAR LA CLAVE, a petición del usuario. Es lo único que la cambia:
 * apagar y encender no la toca. Se hace donde siempre — `<casa>\mcp\http-secret.txt`
 * y la URL completa—, con el formato del propio MCP (hex de 64).
 *
 * Y NO se toca ninguna cuenta ni se hace ningún login: aquí sólo se cambia una
 * clave local.
 * @param casa - la casa de RATACODE.
 * @param {string} puerto - el puerto del MCP local, tal y como está en su URL.
 * @returns `{ok, motivo, url}`.
 */
function cambiarLaClave(casa, puerto) {
  const carpeta = join(casa, 'mcp');
  mkdirSync(carpeta, { recursive: true });
  const nueva = randomBytes(32).toString('hex');
  const p = typeof puerto === 'number' && Number.isInteger(puerto) ? puerto : 3778;
  try {
    const rutaClave = join(carpeta, 'http-secret.txt');
    writeFileSync(rutaClave, nueva + '\n', { mode: 0o600 });
    // El MCP que esté en marcha adopta la clave nueva sin reiniciar (relee este
    // fichero cada dos segundos: `mcp/lib/http.js`), y su `alRotar` reescribe la
    // URL. Aquí se deja ya escrita, para que la tarjeta la lea al momento.
    writeFileSync(join(carpeta, 'http-url.txt'), 'http://127.0.0.1:' + p + '/mcp/' + nueva + '\n', { mode: 0o600 });
  } catch (e) {
    return { ok: false, motivo: 'no pude cambiar la clave: ' + (e?.message ?? e) };
  }
  // R28 §4a · Y LA DIRECCIÓN DEL TÚNEL, TAMBIÉN. Lo que pasaba (medido el
  // 30-sep-2026): tras «Cambiar clave», `tunel-url.txt` se quedaba con la clave
  // VIEJA, así que «Copiar dirección» daba una dirección que devuelve 404 —
  // porque la clave va DENTRO de la ruta (`/mcp/<clave>`) y `mcp/tunel.mjs` sólo
  // escribe ese fichero UNA vez, cuando cloudflared le da el dominio
  // (`mcp/tunel.mjs:264`); no vigila el fichero de la clave. Aquí se reescribe
  // con la clave vigente, conservando el dominio que ya tenía.
  const tunel = cambiarLaClaveDelTunel(casa, nueva);
  return { ok: true, motivo: 'clave nueva', url: 'http://127.0.0.1:' + p + '/mcp/<oculta>', tunel };
}

/**
 * R28 §4a · Reescribir la dirección del túnel con la clave VIGENTE.
 *
 * Con túnel CON NOMBRE (`mcp.tunel_nombre` + `mcp.tunel_host`) la dirección es
 * fija y se construye del host: `https://<host>/mcp/<clave>`. Con el túnel
 * rápido (dominio efímero) se conserva el dominio que ya estaba escrito y sólo
 * se cambia la clave: el dominio lo dio cloudflared y no se puede adivinar.
 * Si no hay túnel escrito, no hay nada que reescribir.
 * @param {string} casa - la casa de RATACODE.
 * @param {string} clave - la clave vigente.
 * @returns {{reescrita: boolean, url: string|null, motivo: string|null}}
 */
function cambiarLaClaveDelTunel(casa, clave) {
  const ruta = join(casa, 'mcp', 'tunel-url.txt');
  const escrita = leerDeLaCasa('mcp', 'tunel-url.txt');
  const ajustes = ajustesDeLaCasa();
  let url = null;
  if (ajustes.tunelHost !== null) {
    // Túnel con nombre: la dirección se construye del host + la clave vigente.
    url = 'https://' + ajustes.tunelHost + '/mcp/' + clave;
  } else if (escrita !== '') {
    // Túnel rápido: mismo dominio, clave nueva.
    const corte = escrita.indexOf('/mcp/');
    if (corte < 0) return { reescrita: false, url: null, motivo: 'la dirección del túnel no tiene la forma /mcp/<clave>; no la toco' };
    url = escrita.slice(0, corte) + '/mcp/' + clave;
  } else {
    return { reescrita: false, url: null, motivo: 'no hay túnel abierto: no hay dirección que reescribir' };
  }
  try {
    writeFileSync(ruta, url + '\n', { mode: 0o600 });
    return { reescrita: true, url, motivo: null };
  } catch (e) {
    return { reescrita: false, url: null, motivo: 'no pude reescribir la dirección del túnel: ' + (e?.message ?? e) };
  }
}

/**
 * Apaga la conexión. Sólo se para lo que arrancó RATACODE: un MCP o un túnel
 * abiertos a mano (en su ventana) NO se tocan — eso lo dice la tarjeta.
 * @returns `{ok, motivo, nuestro}`.
 */
function apagarConexion() {
  const nuestros = [CONEXION.mcp, CONEXION.tunel].filter((h) => vivo(h));
  const dichos = [];
  CONEXION.mcp = null;
  CONEXION.tunel = null;
  if (nuestros.length === 0) {
    return { ok: false, nuestro: false, motivo: 'la conexión no la encendió RATACODE: ciérrala donde la lanzaste (Ctrl+C)' };
  }
  for (const hijo of nuestros) {
    const parado = matarHijo(hijo);
    dichos.push(parado.dicho);
  }
  // R27 · se limpia lo que escribieron: si un fichero se queda, el estado
  // siguiente diría que hay conexión.
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel-url.txt'));
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel.pid'));
  CONEXION.ultimoApagado = dichos.join(' | ') || null;
  return { ok: true, nuestro: true, motivo: 'apagada' };
}

/**
 * R27 §2 · Apagar SÓLO el túnel (la mitad pública). Sirve para el botón «Apagar
 * túnel» de la tarjeta: el MCP local es local, y no hay razón para apagarlo
 * cuando lo que se quiere es dejar de estar expuesto.
 * @returns `{ok, motivo}`.
 */
function apagarElTunel() {
  const nuestro = CONEXION.tunel;
  CONEXION.tunel = null;
  if (!vivo(nuestro)) {
    limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel-url.txt'));
    limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel.pid'));
    return { ok: true, motivo: 'el túnel no lo encendió RATACODE (o ya estaba cerrado)' };
  }
  const parado = matarHijo(nuestro);
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel-url.txt'));
  limpiarFichero(join(casaDeEstaCasa(), 'mcp', 'tunel.pid'));
  return { ok: true, motivo: 'túnel cerrado (' + parado.dicho + ')' };
}

/**
 * Matar un hijo que arrancamos nosotros (en Windows, el árbol entero).
 *
 * R27 · se ESPERA a que el sistema termine de matarlo y se apunta lo que diga
 * `taskkill`: si no se pudiera (permisos, un sandbox por medio), el botón
 * «Apagar» no puede contestar «apagada» tan tranquilo. Antes se lanzaba el
 * `taskkill` sin esperar y sin mirar su salida, y un fallo quedaba invisible.
 * @param {object} hijo - el proceso hijo.
 * @returns {{ok: boolean, dicho: string}} si se pudo y qué dijo el sistema.
 */
function matarHijo(hijo) {
  if (hijo === null || hijo === undefined || hijo.pid === undefined) return { ok: false, dicho: 'sin pid' };
  if (process.platform === 'win32') {
    try {
      const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + ' /T /F'],
        { windowsHide: true, encoding: 'utf8', timeout: 8000 });
      const dicho = String(r.stdout ?? '').trim() || String(r.stderr ?? '').trim();
      // `taskkill` devuelve 128 si el proceso ya no existía: eso también es «está parado».
      return { ok: r.status === 0 || /no se encuentra|not found|no running/i.test(dicho), dicho: dicho.replace(/\s+/g, ' ').slice(0, 200) };
    } catch (e) {
      return { ok: false, dicho: String(e?.message ?? e).slice(0, 200) };
    }
  }
  try {
    hijo.kill('SIGTERM');
    return { ok: true, dicho: 'SIGTERM' };
  } catch (e) {
    return { ok: false, dicho: String(e?.message ?? e).slice(0, 200) };
  }
}

/**
 * El estado de la conexión, para la tarjeta «ChatGPT y Claude web»: si hay una
 * dirección pública que pegar (el túnel VIVO), cuál es, y si quien la abrió
 * fue RATACODE (entonces el botón «Apagar» puede cerrarla).
 *
 * R27 §2 · `conectado` es VERDAD sólo si el túnel está vivo (su proceso existe)
 * y `mcpLocal` sólo si el MCP por HTTP **contesta como el nuestro** (mira
 * `vivoElMcp`: que el puerto escuche no basta, puede ser el MCP de otra casa).
 * Los ficheros de un proceso muerto se limpian al arrancar y al encender
 * (`limpiarLoMuerto`), así que «Conectado» no puede quedarse puesto cuando ya no
 * hay nadie.
 * @param req - el pedido, para componer la URL del panel si falta.
 * @returns {Promise<object>} el estado, con `conectado`, `direccion` y `nuestro`.
 */
async function estadoDeLaConexion(req) {
  const base = await estadoDelMcp(req);
  const conectado = base.tunel.abierto;
  // R27 §2 · las dos mitades se cuentan por separado: el MCP local puede estar
  // encendido sin túnel (es lo normal si `cloudflared` no está instalado), y la
  // tarjeta lo dice en vez de fingir que no hay nada.
  const mcpLocal = base.http.abierto;
  let pistaTunel = null;
  if (!conectado) {
    try {
      execFileSync('where', ['cloudflared'], { timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    } catch {
      pistaTunel = 'El túnel necesita cloudflared: instálalo con «winget install Cloudflare.cloudflared» y vuelve a pulsar Encender. Mientras tanto, el MCP local ya funciona (para Claude Code, Codex o el panel).';
    }
    // R27 §8 · si la casa tiene túnel con nombre configurado, se dice que la
    // dirección puede ser fija (y no la efímera del túnel rápido).
    const ajustes = ajustesDeLaCasa();
    if (pistaTunel === null && ajustes.tunelHost !== null) {
      pistaTunel = 'Esta casa tiene túnel con nombre (' + ajustes.tunelNombre + ' → https://' + ajustes.tunelHost + '): al encender, la dirección será siempre la misma.';
    }
  }
  return {
    ok: true,
    conectado,
    direccion: conectado ? base.tunel.url : null,
    // `nuestro` es «lo encendió RATACODE»: hace falta que el hijo siga vivo.
    nuestro: vivo(CONEXION.mcp) || vivo(CONEXION.tunel),
    // Y si el túnel está abierto pero NO lo encendió esta ventana, se dice: se
    // apaga donde se lanzó (Ctrl+C), y la tarjeta lo cuenta en una línea.
    mcpLocal,
    pistaTunel,
    // R27 · los dos hijos que ha arrancado RATACODE (para poder comprobarlo y
    // para poder decir «lo encendió RATACODE» sin adivinar).
    procesos: {
      mcp: vivo(CONEXION.mcp) ? CONEXION.mcp.pid : null,
      tunel: vivo(CONEXION.tunel) ? CONEXION.tunel.pid : null,
      ultimoError: CONEXION.ultimoError ?? null,
      ultimoApagado: CONEXION.ultimoApagado ?? null,
    },
    http: base.http,
    tunel: base.tunel,
    carpeta: base.carpeta,
    carpetas: base.carpetas,
    comandos: base.comandos,
    panel: base.panel,
    pegar: base.pegar,
  };
}

/**
 * R27 §8 · LA DIRECCIÓN FIJA, en TRES PASOS (sin hacer login ni tocar cuentas).
 *
 * El túnel rápido da un dominio NUEVO cada vez que se enciende, así que la
 * dirección que ChatGPT tiene pegada deja de valer. La solución es un túnel
 * NOMBRADO sobre un subdominio del usuario: entonces la dirección es siempre la
 * misma. `mcp\tunel.mjs` lo arranca con `--nombre` y `--host` (que vienen de
 * `mcp.tunel_nombre` y `mcp.tunel_host`); lo que falta es que la cuenta lo tenga
 * dado de alta, y eso lo hace el humano en su Cloudflare.
 *
 * Aquí NO se lee `%USERPROFILE%\.cloudflared` (son credenciales del usuario), no
 * se hace login y no se crea ningún túnel: se dicen los tres pasos, se deja
 * escrito el fichero de configuración que el túnel leerá, y se enseña el comando.
 * @param req - el pedido, para el caso de que falte el `url.txt` del panel.
 * @returns {Promise<object>} el plan, con sus tres pasos y los comandos.
 */
async function planDelTunelNombrado(req) {
  const casa = casaDeEstaCasa();
  const ajustes = ajustesDeLaCasa();
  const raiz = raizDeLaInstalacion();
  // El nombre y el host: los de la casa si están puestos; si no, el de la casa
  // de RATACODE de siempre, para que el ejemplo sea real y no un `<tu-nombre>`.
  const nombre = ajustes.tunelNombre ?? TUNEL_NOMBRADO;
  const host = ajustes.tunelHost ?? (ajustes.tunelNombre === null ? TUNEL_NOMBRADO : nombre + '.kittcat.com');
  const puerto = ajustes.puerto;
  const rutaConfig = join(casa, 'mcp', 'cloudflared.yml');
  let tieneCloudflared;
  try {
    execFileSync('where', ['cloudflared'], { timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    tieneCloudflared = true;
  } catch {
    tieneCloudflared = false;
  }
  const base = await estadoDelMcp(req);
  const lineas = [
    '# RATACODE · config del túnel nombrado. La escribe Ajustes › Conexiones.',
    '# La usa `mcp\\tunel.mjs` cuando la casa declara mcp.tunel_nombre y mcp.tunel_host.',
    'tunnel: ' + nombre,
    'ingress:',
    '  - hostname: ' + host,
    '    service: http://127.0.0.1:' + puerto,
    '  - service: http_status:404',
    '',
  ];
  let escrito = false;
  try {
    mkdirSync(join(casa, 'mcp'), { recursive: true });
    writeFileSync(rutaConfig, lineas.join('\n'), { mode: 0o600 });
    escrito = true;
  } catch { /* sin permiso: se dicen los pasos y ya */ }
  return {
    ok: true,
    nombre,
    host,
    hostname: host,
    puerto,
    fichero: escrito ? rutaConfig : null,
    tiene_cloudflared: tieneCloudflared,
    configurado: ajustes.tunelHost !== null,
    // Los TRES comandos que haría Patxi, tal cual (el paso 2 es en la web de
    // Cloudflare: ahí no se puede entrar desde aquí, ni se debe).
    comandos: [
      'cloudflared tunnel login',
      'cloudflared tunnel create ' + nombre,
      'cloudflared tunnel route dns ' + nombre + ' ' + host,
    ],
    ajustes: [
      'mcp:',
      '  tunel_nombre: ' + nombre,
      '  tunel_host: ' + host,
    ],
    pasos: [
      '1 · En tu PC, con tu cuenta de Cloudflare (esto lo haces tú; aquí no se hace login): '
        + '`cloudflared tunnel login` y luego `cloudflared tunnel create ' + nombre + '`. '
        + 'Las credenciales quedan en %USERPROFILE%\\.cloudflared y RATACODE no las lee.',
      '2 · En Cloudflare: añade el hostname ' + host + ' al túnel (o `cloudflared tunnel route dns ' + nombre + ' ' + host + '`) '
        + 'y apunta el servicio a http://127.0.0.1:' + puerto + '.',
      '3 · En ' + join(casa, 'settings.yaml') + ' pon las dos líneas de abajo y pulsa «Encender»: '
        + 'la dirección será SIEMPRE https://' + host + '/mcp/<clave>, y el conector de ChatGPT se crea una sola vez.',
    ],
    nota: tieneCloudflared
      ? 'Con el túnel con nombre, la dirección no cambia: el conector de ChatGPT se crea UNA vez.'
      : 'cloudflared no está instalado en este equipo: instálalo con «winget install Cloudflare.cloudflared» antes del paso 3.',
    efimero: 'El túnel rápido (sin cuenta) da un dominio NUEVO cada vez que se enciende: la dirección de ChatGPT cambia y hay que volver a pegarla. El túnel con nombre es lo que la deja fija.',
    estado: base.tunel.fijo,
  };
}

// ── R21 · EL ASPECTO QUE LA CASA RECUERDA ──────────────────────────────────
/**
 * Los TRES temas de RATACODE, en su orden, con el nombre que se ve y el color
 * que los identifica. Los aplica la vía OFICIAL de temas de DSH
 * (`piel\lib\cliente.js`: `ctx.theme.register` con su ficha de tokens); aquí
 * sólo se guarda CUÁL, porque el motor no admite un id de tema de fuera en su
 * esquema de ajustes (`light`/`dark`/`system`).
 */
const TEMAS_DE_LA_CASA = [
  { id: 'ratacode-pink', nombre: 'RATACODE PINK', principal: '#ff268e', detalle: '#e4f226' },
  { id: 'ratacode-yellow', nombre: 'RATACODE YELLOW', principal: '#e4f226', detalle: '#ff268e' },
  { id: 'minimal', nombre: 'MINIMAL', principal: '#e8e6df', detalle: '#8c9396' },
];
/** El tema de fábrica: el primero de la lista. */
const TEMA_POR_DEFECTO = TEMAS_DE_LA_CASA[0].id;
/** Los tres temas, tal cual (para la ruta). */
function sistemaDeTemas() {
  return TEMAS_DE_LA_CASA;
}
/** Dónde se apunta el tema elegido: `<casa>\tema.txt`, una palabra. */
function rutaDelTema() {
  return join(casaDeEstaCasa(), 'tema.txt');
}
/**
 * El tema que la casa recuerda. Si no hay nada apuntado —o lo apuntado no es
 * uno de los tres— se responde el de fábrica; NUNCA se inventa otro.
 * @returns el id del tema.
 */
function leerTema() {
  try {
    const leido = readFileSync(rutaDelTema(), 'utf8').trim();
    if (TEMAS_DE_LA_CASA.some((t) => t.id === leido)) return leido;
  } catch { /* sin fichero: el de fábrica */ }
  return TEMA_POR_DEFECTO;
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
 * R28 · Leer el cuerpo JSON de una petición, con tope. Igual que el `leerCuerpo`
 * del MCP (`mcp/lib/http.js:86`): al pasarse se rechaza, no se come la memoria.
 * @param {object} req - el pedido.
 * @param {number} tope - bytes máximos.
 * @returns {Promise<object>}
 */
function leerPedido(req, tope) {
  return new Promise((listo, rechaza) => {
    const trozos = [];
    let total = 0;
    let pasado = false;
    req.on('data', (t) => {
      if (pasado) return;
      total += t.length;
      if (total > tope) { pasado = true; trozos.length = 0; rechaza(new Error('cuerpo demasiado grande')); return; }
      trozos.push(t);
    });
    req.on('end', () => {
      if (pasado) return;
      const texto = Buffer.concat(trozos).toString('utf8').trim();
      if (texto === '') return listo({});
      try { listo(JSON.parse(texto)); } catch { rechaza(new Error('cuerpo JSON inválido')); }
    });
    req.on('error', rechaza);
  });
}

/**
 * R28 · El estado del cerco en ESTE proceso: el módulo del gancho de rutas
 * (`mcp/lib/lectura.js`, cargado por `cargarCerco`) vive aquí porque el gancho
 * se monta al arrancar la piel y el módulo se carga en paralelo.
 */
const CERCO = { cerco: null };

/** R28 · Una línea al cuaderno de Actividad por cada herramienta que se para. */
function anotarCerco(casa, juicio) {
  try {
    appendFileSync(join(casa, 'mcp', 'actividad.jsonl'), JSON.stringify({
      tipo: 'lectura',
      hora: new Date().toISOString(),
      cliente: 'ChatGPT (sesión abierta)',
      herramienta: juicio.herramienta ?? 'herramienta',
      ruta: juicio.fuera ?? (juicio.session_id ?? ''),
      permitido: false,
      motivo: 'sesión abierta a ChatGPT: ' + (juicio.motivo ?? 'bloqueado'),
      detalle: null,
    }) + '\n');
  } catch { /* el cuaderno no puede tumbar el turno */ }
}

/**
 * R28 §2 · Una línea al cuaderno por cada mensaje que entra desde un chat web.
 * Sale en Actividad con hora, cliente, sesión y permitido/bloqueado.
 */
function anotarSesion(casa, fila) {
  try {
    mkdirSync(join(casa, 'mcp'), { recursive: true });
    appendFileSync(join(casa, 'mcp', 'actividad.jsonl'), JSON.stringify({
      tipo: 'sesion',
      hora: fila.hora ?? new Date().toISOString(),
      cliente: fila.cliente ?? 'MCP',
      herramienta: fila.herramienta ?? 'send_to_session',
      ruta: fila.sesion ?? '',
      permitido: fila.permitido === true,
      motivo: fila.permitido === true ? null : (fila.motivo ?? 'no permitido'),
      detalle: fila.detalle ?? null,
    }) + '\n');
  } catch { /* el cuaderno no puede tumbar el panel */ }
}

/** R28 · Devolver el permiso que tenía una sesión (best effort; se dice qué pasó). */
function devolverPermisoDeLaSesion(c, sessionId, previo) {
  try { return devolverPermiso(c, sessionId, previo); }
  catch (e) { return { devuelto: false, motivo: 'no pude devolver el permiso: ' + (e?.message ?? e) }; }
}

/**
 * Monta las rutas del texto de la conexión, del MCP, de la conexión con botón,
 * de la clave que falta y de los runtimes locales sobre el `webServer`,
 * autenticadas con el mismo cerco que el motor aplica a sus canales
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

  // GET /ratacode/handshake → el texto corto de ESTA casa, sin escribir nada.
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
      c.logger?.info?.('ratacode-piel: el texto de la conexión dejado en ' + ruta);
    }
    json(res, 200, { ok: true, url: hecha.url, casa: hecha.casa, ruta, texto: hecha.texto });
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/handshake', handler: handshake }), 'ratacode-piel.handshake');

  // GET /ratacode/mcp → estado del MCP + los dos comandos + el texto del chat.
  const mcp = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDelMcp(req).then((estado) => json(res, 200, estado),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/mcp', handler: mcp }), 'ratacode-piel.mcp');

  // GET /ratacode/mcp/vivo → (R27 §1) la foto barata de lo que está haciendo el
  // MCP: las tareas de la casa (con su sesión `mcp-<task_id>`) y las últimas
  // líneas del cuaderno, con las de SÓLO LECTURA dentro. La cara de cliente la
  // sondea cada pocos segundos para (a) refrescar la barra lateral EN CALIENTE
  // cuando aparece una tarea nueva —sin recargar la página— y (b) pintar en
  // Actividad lo que hizo el chat aunque no lanzara ninguna tarea.
  const mcpVivo = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    try { json(res, 200, fotoDelMcp()); }
    catch (e) { json(res, 500, { ok: false, error: String(e?.message ?? e) }); }
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/mcp/vivo', handler: mcpVivo }), 'ratacode-piel.mcp-vivo');

  // GET /ratacode/clave → ¿le falta la clave al modelo por defecto de la casa?
  // Lo pregunta el guion de la piel para avisar en español encima de la caja.
  const clave = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDeLaClave(c).then((estado) => json(res, 200, estado), (e) => json(res, 500, { ok: false, falta: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/clave', handler: clave }), 'ratacode-piel.clave');

  // GET /ratacode/runtimes → (R18) Ollama y LM Studio: encendido/apagado, sus
  // modelos y cuáles valen como agente, su dirección, cómo encenderlos y la
  // recomendación por tarjeta. Lo pinta la sección Ajustes › Modelos locales.
  const runtimes = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDeLosRuntimes(c).then((estado) => json(res, 200, estado),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  // GET /ratacode/conexion → (R23) el estado de la conexión de los chats web.
  // POST /ratacode/conexion/encender y /apagar → los botones del usuario.
  const conexion = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDeLaConexion(req).then((estado) => json(res, 200, estado),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion', handler: conexion }), 'ratacode-piel.conexion');

  const botonConexion = (cual) => (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    const casa = casaDeEstaCasa();
    /** Contestar con el estado ya recalculado (el botón enseña la verdad nueva). */
    const contestar = (dicho) => {
      estadoDeLaConexion(req).then(
        (estado) => json(res, 200, { ...dicho, estado }),
        (e) => json(res, 500, { ok: false, motivo: String(e?.message ?? e) }),
      );
    };
    if (cual === 'apagar') {
      contestar(apagarConexion());
      return;
    }
    // R27 §2 · «Apagar túnel»: cierra SÓLO la mitad pública y deja el MCP local
    // en pie (que es local, y no expone nada).
    if (cual === 'apagar-tunel') {
      contestar(apagarElTunel());
      return;
    }
    encenderConexion(casa).then(contestar,
      (e) => json(res, 500, { ok: false, motivo: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion/encender', handler: botonConexion('encender') }), 'ratacode-piel.conexion-encender');
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion/apagar', handler: botonConexion('apagar') }), 'ratacode-piel.conexion-apagar');
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion/apagar-tunel', handler: botonConexion('apagar-tunel') }), 'ratacode-piel.conexion-apagar-tunel');
  // R27 §2 · AL ABRIR EL PANEL, la conexión se mira de verdad: si los ficheros
  // de un MCP o de un túnel muertos siguen escritos, se limpian AQUÍ (una vez),
  // para que lo primero que vea el usuario sea la verdad y no un «Conectado» de
  // un proceso que ya no existe.
  limpiarLoMuerto().catch(() => { /* sin casa todavía: se mirará al pedir el estado */ });

  // POST /ratacode/conexion/clave → (R27 §3) el botón «Cambiar clave»: cambia la
  // clave del MCP por HTTP y su URL, y NADA MÁS. El MCP que esté en marcha la
  // adopta sin reiniciar (relee el fichero cada 2 s). No toca ninguna cuenta, no
  // hace ningún login y no enciende ni apaga nada.
  const cambiarClave = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    const casa = casaDeEstaCasa();
    // El puerto es el de la casa (el mismo en el que está escuchando, si está):
    // así la URL nueva sigue valiendo para el conector de ChatGPT.
    const dicho = cambiarLaClave(casa, ajustesDeLaCasa().puerto);
    estadoDeLaConexion(req).then((estado) => json(res, 200, { ...dicho, estado }),
      (e) => json(res, 500, { ok: false, motivo: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion/clave', handler: cambiarClave }), 'ratacode-piel.conexion-clave');

  // GET /ratacode/conexion/tunel-nombrado → (R27 §8) los TRES pasos y los TRES
  // comandos que haría Patxi para tener una dirección FIJA (un subdominio suyo)
  // en vez del dominio efímero del túnel rápido, que cambia cada vez que se
  // enciende. Aquí NO se hace login, ni se toca ninguna cuenta, ni se crea
  // ningún túnel, ni se leen las credenciales de `%USERPROFILE%\.cloudflared`:
  // sólo se prepara el fichero de configuración del TÚNEL CON NOMBRE
  // (`<casa>\mcp\cloudflared.yml`, el mismo que `tunel.mjs` usa) y se dicen los
  // pasos. Si no hay cloudflared instalado, se dice.
  const tunelNombrado = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa GET o POST.' }); return; }
    planDelTunelNombrado(req).then((plan) => json(res, 200, plan),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/conexion/tunel-nombrado', handler: tunelNombrado }), 'ratacode-piel.tunel-nombrado');
  // Si la piel se va (el panel se cierra), no se dejan el MCP ni el túnel
  // abiertos por detrás: se paran los dos, que los arrancó RATACODE.
  c.effect(() => () => { apagarConexion(); }, 'ratacode-piel.conexion-cierre');
  // POST /ratacode/migracion → el usuario lo ha cerrado: no vuelve.
  const migracion = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method === 'POST') {
      try {
        writeFileSync(join(casaDeEstaCasa(), 'aviso-claves-visto'), new Date().toISOString() + '\n', { mode: 0o600 });
      } catch (e) {
        json(res, 500, { ok: false, error: 'no pude apuntar que el aviso está visto: ' + (e?.message ?? e) });
        return;
      }
      json(res, 200, { ok: true, aviso: null });
      return;
    }
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET o POST.' }); return; }
    estadoDeLaMigracion(c).then((estado) => json(res, 200, estado),
      (e) => json(res, 500, { ok: false, aviso: null, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/migracion', handler: migracion }), 'ratacode-piel.migracion');

  // GET  /ratacode/tema → (R21) el aspecto que la casa recuerda (los tres temas
  //                       de RATACODE; `ratacode-pink` si no hay nada apuntado).
  // POST /ratacode/tema → los botones de Ajustes › General › Aspecto.
  // El motor NO guarda un id de tema de fuera (su esquema sólo admite
  // `light`/`dark`/`system`: `THEME_PREFERENCES`), así que el recuerdo lo pone
  // la casa, en UN fichero con una palabra dentro. El TEMA en sí lo aplica la
  // vía oficial (`ctx.theme.register` + `setTheme`), no esta ruta.
  const temas = sistemaDeTemas();
  const tema = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method === 'GET') { json(res, 200, { ok: true, tema: leerTema(), temas: temas.map((t) => t.id) }); return; }
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa GET o POST.' }); return; }
    let cuerpo = '';
    req.on('data', (trozo) => { cuerpo += trozo; if (cuerpo.length > 1024) req.destroy(); });
    req.on('end', () => {
      let pedido = {};
      try { pedido = JSON.parse(cuerpo === '' ? '{}' : cuerpo); } catch { /* sin cuerpo: se dice */ }
      const cual = typeof pedido.tema === 'string' ? pedido.tema : '';
      if (!temas.some((t) => t.id === cual)) {
        json(res, 400, { ok: false, error: 'no conozco el tema «' + cual + '»' });
        return;
      }
      try {
        writeFileSync(rutaDelTema(), cual + '\n', { mode: 0o600 });
      } catch (e) {
        json(res, 500, { ok: false, error: 'no pude apuntar el tema: ' + (e?.message ?? e) });
        return;
      }
      c.logger?.info?.('ratacode-piel: el aspecto de la casa queda en ' + cual);
      json(res, 200, { ok: true, tema: cual });
    });
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/tema', handler: tema }), 'ratacode-piel.tema');

  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/runtimes', handler: runtimes }), 'ratacode-piel.runtimes');

  // POST /ratacode/runtimes/encender y /apagar → (R23) el botón del usuario, y
  // NADA MÁS: aquí no hay ningún reloj que encienda ni apague por su cuenta. Al
  // apagar sólo se para lo que arrancó RATACODE (o lo que el runtime sabe parar
  // por su cuenta: `lms server stop`); un proceso ajeno no se toca jamás.
  const accionRuntime = (accion) => (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    let cuerpo = '';
    req.on('data', (trozo) => { cuerpo += trozo; if (cuerpo.length > 4096) req.destroy(); });
    req.on('end', () => {
      let pedido = {};
      try { pedido = JSON.parse(cuerpo === '' ? '{}' : cuerpo); } catch { /* sin cuerpo: se dice */ }
      const runtime = runtimePorId(pedido.id);
      if (runtime === null) { json(res, 400, { ok: false, error: 'no conozco el runtime «' + String(pedido.id) + '»' }); return; }
      const dicho = accion === 'encender' ? encenderRuntime(runtime) : apagarRuntime(runtime);
      if (!dicho.ok) {
        // No se ha podido encender desde aquí (su programa no arrancó): se dice en
        // UNA línea, CON el comando, y la tarjeta deja ese comando para copiar —
        // que es la otra vía del encargo («si no, botón Copiar comando»).
        json(res, 200, accion === 'encender'
          ? { ok: false, aMano: true, motivo: 'no llegó a encenderse: ' + dicho.motivo + ' — a mano, «' + runtime.arranque + '»' }
          : { ok: false, motivo: dicho.motivo, aMano: dicho.aMano === true });
        return;
      }
      esperarCambio(c, runtime.id, accion === 'encender', 12000).then((estado) => {
        // El botón no da por bueno lo que no ha pasado: si le hemos pedido que se
        // encienda y sigue apagado (su programa no arrancó, o tardó más de la
        // cuenta), se dice —y la tarjeta deja el COMANDO a mano, que es la otra
        // vía del encargo— en vez de dejar al usuario mirando una pantalla igual.
        if (estado.encendido !== (accion === 'encender')) {
          json(res, 200, {
            ok: false,
            aMano: true,
            motivo: accion === 'encender'
              ? 'no llegó a encenderse: pruébalo a mano con «' + runtime.arranque + '»'
              : 'sigue encendido: páralo a mano' + (runtime.apagadoAMano === null ? '' : ' (' + runtime.apagadoAMano + ')'),
            runtime: estado,
          });
          return;
        }
        json(res, 200, { ok: true, motivo: dicho.motivo, runtime: estado });
      }, (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
    });
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/runtimes/encender', handler: accionRuntime('encender') }), 'ratacode-piel.runtimes-encender');
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/runtimes/apagar', handler: accionRuntime('apagar') }), 'ratacode-piel.runtimes-apagar');

  // ── R28 · CHATGPT HABLA CON UNA SESIÓN YA ABIERTA DEL PANEL ─────────────
  // Estas cuatro rutas son la puerta por la que el MCP (otro proceso) llega a
  // ESTE proceso, que es el único que puede escribir en una sesión del panel
  // por la vía de verdad (`sessionController.prompt`). Van con el mismo cerco
  // que las demás (`autorizada`: Host/Origin + cookie de sesión del navegador),
  // así que desde fuera de esta máquina no se llega: la cookie es de la sesión
  // del navegador de ESTA casa y se firma con un secreto que vive en
  // `<casa>\.credentials.yaml`.
  const sesiones = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    const casa = casaDeEstaCasa();
    const raices = ajustesDeLaCasa().workspaces;
    listarSesiones({ ctx: c, casa, raices }).then(
      (lista) => json(res, 200, { ok: true, casa, sesiones: lista, total: lista.length }),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }),
    );
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/sesiones', handler: sesiones }), 'ratacode-piel.sesiones');

  // GET /ratacode/sesiones/marcas → las marcas «GPT WEB →» de una sesión: el
  // turno y la hora de cada mensaje que entró por aquí. Sin texto de nadie.
  const marcas = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    const pedido = new URL(req.url ?? '/', 'http://localhost');
    const sessionId = pedido.searchParams.get('session_id');
    const casa = casaDeEstaCasa();
    const todas = leerEnviados(casa, 500).filter((f) => f.permitido === true);
    const suyas = sessionId === null ? todas : todas.filter((f) => f.session_id === sessionId);
    const abiertas = leerAbiertas(casa).sesiones;
    json(res, 200, {
      ok: true,
      marcas: suyas.map((f) => ({
        turn_id: f.request_id,
        session_id: f.session_id,
        turno: f.turno ?? null,
        hora: f.hora,
        sender: f.sender ?? 'openai-mcp',
        source: f.source ?? 'chatgpt-web',
        etiqueta: 'GPT WEB →',
      })),
      abiertas: Object.keys(abiertas),
      cerco: {
        montado: CERCO.cerco !== null,
        motivo: CERCO.cerco === null ? 'el gancho de rutas del MCP todavía no está cargado' : null,
      },
    });
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/sesiones/marcas', handler: marcas }), 'ratacode-piel.sesiones-marcas');

  // POST /ratacode/sesiones/abierta → EL INTERRUPTOR de la cabecera del chat.
  // Es lo único que abre una sesión a ChatGPT, y lo enciende Patxi a mano.
  const abierta = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    leerPedido(req, 8192).then(async (pedido) => {
      const casa = casaDeEstaCasa();
      const raices = ajustesDeLaCasa().workspaces;
      const sessionId = typeof pedido.session_id === 'string' ? pedido.session_id : '';
      if (sessionId === '') { json(res, 400, { ok: false, error: 'hace falta `session_id`' }); return; }
      if (pedido.abierta !== true) {
        // Cerrar: se le devuelve el permiso que tenía, si se le cambió.
        const previo = leerAbiertas(casa).sesiones[sessionId]?.permiso_previo ?? null;
        marcarAbierta(casa, sessionId, false);
        const devuelto = devolverPermisoDeLaSesion(c, sessionId, previo);
        json(res, 200, { ok: true, session_id: sessionId, abierta: false, permiso_devuelto: devuelto });
        return;
      }
      // Abrir: la carpeta TIENE que estar en `mcp.workspaces` (R28 §3a).
      let lista;
      try { lista = await listarSesiones({ ctx: c, casa, raices }); }
      catch (e) { json(res, 500, { ok: false, error: String(e?.message ?? e) }); return; }
      const suya = lista.find((s) => s.session_id === sessionId);
      if (suya === undefined) { json(res, 404, { ok: false, error: 'no hay ninguna sesión con ese id' }); return; }
      if (suya.en_espacio_autorizado !== true) {
        json(res, 403, {
          ok: false,
          error: 'SESSION_NOT_ALLOWED',
          motivo: 'la carpeta de esta sesión (' + (suya.carpeta ?? '(sin carpeta)') + ') no está en `mcp.workspaces` de la casa: añádela allí antes de abrirla a ChatGPT',
        });
        return;
      }
      marcarAbierta(casa, sessionId, true, { titulo: suya.titulo, carpeta: suya.carpeta });
      json(res, 200, {
        ok: true,
        session_id: sessionId,
        abierta: true,
        encierro: {
          aviso: 'Mientras esté abierta a ChatGPT, los turnos de esta sesión van encerrados en su carpeta: sin terminal, sin procesos, sin red y sin subagentes, y con el gancho de rutas del MCP. Vale para toda la sesión, no sólo para los mensajes del chat (el motor no deja separarlo).',
          cerco_montado: CERCO.cerco !== null,
          motivo: CERCO.cerco === null ? 'el gancho de rutas del MCP todavía no está cargado: hasta que lo esté, esta sesión no deja pasar ninguna herramienta' : null,
        },
      });
    }, () => json(res, 400, { ok: false, error: 'cuerpo JSON inválido' }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/sesiones/abierta', handler: abierta }), 'ratacode-piel.sesiones-abierta');

  // POST /ratacode/sesiones/enviar → el mensaje de ChatGPT, a ESA sesión.
  const enviar = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'Usa POST.' }); return; }
    leerPedido(req, 262_144).then(async (pedido) => {
      const casa = casaDeEstaCasa();
      const raices = ajustesDeLaCasa().workspaces;
      const cliente = typeof pedido.cliente === 'string' && pedido.cliente !== '' ? pedido.cliente : 'MCP';
      const dicho = await enviarMensaje({
        ctx: c,
        casa,
        raices,
        sessionId: typeof pedido.session_id === 'string' ? pedido.session_id : undefined,
        titulo: typeof pedido.titulo === 'string' ? pedido.titulo : undefined,
        mensaje: typeof pedido.mensaje === 'string' ? pedido.mensaje : '',
        esperarSegundos: typeof pedido.esperar_segundos === 'number' ? pedido.esperar_segundos : undefined,
        cliente,
      });
      // R28 §2 · y queda en Actividad: hora, cliente, sesión y permitido/bloqueado.
      anotarSesion(casa, {
        cliente,
        herramienta: 'send_to_session',
        sesion: dicho.session_id ?? (typeof pedido.session_id === 'string' ? pedido.session_id : (pedido.titulo ?? '')),
        permitido: dicho.ok === true,
        motivo: dicho.ok === true ? null : (dicho.error ?? 'no permitido'),
        detalle: dicho.ok === true
          ? ('turno ' + (dicho.turno ?? '?') + ' · ' + (dicho.estado ?? ''))
          : (dicho.motivo ?? null),
      });
      // Un «no» de negocio (AMBIGUOUS_SESSION, SESSION_NOT_ALLOWED…) sale con
      // 200 a propósito: el cliente MCP lo lee como la respuesta de la
      // herramienta y puede corregir. Lo que NO se hace es enviar nada.
      json(res, 200, dicho);
    }, () => json(res, 400, { ok: false, error: 'cuerpo JSON inválido' }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/sesiones/enviar', handler: enviar }), 'ratacode-piel.sesiones-enviar');

  // GET /ratacode/sesiones/respuesta → la respuesta de un mensaje ya mandado.
  const respuesta = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    const pedido = new URL(req.url ?? '/', 'http://localhost');
    respuestaDe({
      ctx: c,
      casa: casaDeEstaCasa(),
      turnId: pedido.searchParams.get('turn_id') ?? undefined,
      sessionId: pedido.searchParams.get('session_id') ?? undefined,
    }).then((dicho) => json(res, 200, dicho), (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/sesiones/respuesta', handler: respuesta }), 'ratacode-piel.sesiones-respuesta');

  // ── R28 §3c · EL CERCO DE LAS SESIONES ABIERTAS ─────────────────────────
  // Se monta UNA vez, al arrancar la piel, y no hace nada mientras no haya
  // ninguna sesión abierta a ChatGPT. El módulo del gancho (`mcp/lib/lectura.js`
  // de la instalación) se carga en paralelo: hasta que esté, una sesión abierta
  // falla cerrada (`montarCerco` lo dice).
  const raizInstalacion = raizDeLaInstalacion();
  cargarCerco(raizInstalacion).then((modulo) => {
    CERCO.cerco = modulo;
    c.logger?.[modulo === null ? 'warn' : 'info']?.(
      modulo === null
        ? 'ratacode-piel: no encuentro el gancho de rutas del MCP en ' + join(raizInstalacion, 'mcp', 'lib', 'lectura.js')
          + ': las sesiones abiertas a ChatGPT no dejarán pasar ninguna herramienta'
        : 'ratacode-piel: cerco de sesiones abiertas montado con el gancho de rutas del MCP (mcp/lib/lectura.js)',
    );
  });
  c.effect(() => montarCerco(c, {
    casa: casaDeEstaCasa(),
    raices: () => ajustesDeLaCasa().workspaces,
    cerco: () => CERCO.cerco,
    alDenegar: (juicio) => anotarCerco(casaDeEstaCasa(), juicio),
  }), 'ratacode-piel.cerco-sesiones');

  c.logger?.info?.('ratacode-piel: el texto de la conexión se sirve en /ratacode/handshake, el MCP en /ratacode/mcp, la conexión con botón en /ratacode/conexion, la clave que falta en /ratacode/clave, los runtimes locales en /ratacode/runtimes y el aspecto en /ratacode/tema');}

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
