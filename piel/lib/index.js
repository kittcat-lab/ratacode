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
    despues: 'Ollama ya se queda escuchando al instalar y al arrancar el PC; `ollama serve` lo levanta a mano.',
  },
  {
    id: 'lmstudio',
    nombre: 'LM Studio',
    defecto: 'http://127.0.0.1:1234/v1',
    puerto: 1234,
    arranque: 'lms server start',
    enlace: 'https://lmstudio.ai/download',
    despues: 'En LM Studio también vale el botón «Start server» de la pestaña Developer.',
  },
];

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
 * @returns la ficha con `baseURL`, `encendido` y la lista de modelos.
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
  return {
    id: runtime.id,
    nombre: runtime.nombre,
    baseURL,
    puerto: Number((/:(\d+)(?:\/|$)/.exec(baseURL) ?? [null, null])[1]) || runtime.puerto,
    encendido: v1 !== null || etiquetas !== null,
    respondeV1: v1 !== null,
    respondeApi: etiquetas !== null,
    modelos,
    arranque: runtime.arranque,
    enlace: runtime.enlace,
    despues: runtime.despues,
    cambiar: comoCambiarLaDireccion(c, runtime, baseURL),
  };
}

/** ¿Este proveedor es uno de los dos runtimes locales? */
function esProveedorLocal(id) {
  return RUNTIMES_LOCALES.some((r) => r.id === id);
}

/**
 * El estado de los dos runtimes locales, tal y como lo pinta Ajustes › Modelos
 * locales: encendido/apagado, sus modelos (y cuáles valen como agente), su
 * dirección, cómo encenderlos y la recomendación por tarjeta del README.
 * @param c - contexto de cordis.
 * @returns el estado completo; nunca lanza (si un sondeo falla, sale apagado).
 */
async function estadoDeLosRuntimes(c) {
  const runtimes = await Promise.all(RUNTIMES_LOCALES.map((r) => sondearRuntime(c, r)));
  return {
    ok: true,
    casa: casaDeEstaCasa(),
    runtimes,
    tarjetas: TARJETAS_LOCALES,
    aviso: 'Una ruta sin `apiKeyEnv` (Ollama y LM Studio) NO pide clave: nada de lo que hables con ellos '
      + 'sale de tu ordenador, y por eso no están en Ajustes › Models, donde sólo se ponen claves.',
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
 * Monta las rutas del apretón, del MCP, de la clave que falta y de los runtimes
 * locales sobre el `webServer`, autenticadas con el mismo cerco que el motor
 * aplica a sus canales (`connection.requestRejection`).
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

  // GET /ratacode/runtimes → (R18) Ollama y LM Studio: encendido/apagado, sus
  // modelos y cuáles valen como agente, su dirección, cómo encenderlos y la
  // recomendación por tarjeta. Lo pinta la sección Ajustes › Modelos locales.
  const runtimes = (req, res) => {
    if (!autorizada(req, res)) return;
    if (req.method !== 'GET') { json(res, 405, { ok: false, error: 'Usa GET.' }); return; }
    estadoDeLosRuntimes(c).then((estado) => json(res, 200, estado),
      (e) => json(res, 500, { ok: false, error: String(e?.message ?? e) }));
  };
  c.effect(() => servidor.register({ kind: 'exact', path: '/ratacode/runtimes', handler: runtimes }), 'ratacode-piel.runtimes');
  c.logger?.info?.('ratacode-piel: el apretón se sirve en /ratacode/handshake, el MCP en /ratacode/mcp, la clave que falta en /ratacode/clave y los runtimes locales en /ratacode/runtimes');
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
