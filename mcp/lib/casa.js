/**
 * casa — dónde vive RATACODE y dónde está su motor.
 *
 * Se resuelve EXACTAMENTE igual que en `bin/ratacode.js`, para que el MCP mire
 * la misma casa (mismos proveedores, mismos modelos, mismas claves) que la web.
 * Si aquí se resolviera distinto, tendríamos dos RATACODE y eso es justo lo que
 * no queremos.
 *
 *   casa  = --home  >  $RATACODE_HOME  >  %USERPROFILE%\.ratacode
 *   motor = --dsh   >  @deepseek-ai/dsh del paquete (como bin/ratacode.js)
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';

/**
 * La casa de RATACODE.
 * @param {string|undefined} indicada - valor de `--home`, si lo hay.
 * @returns {string} ruta absoluta.
 */
export function resolverCasa(indicada) {
  return resolve(indicada ?? process.env.RATACODE_HOME ?? join(homedir(), '.ratacode'));
}

/**
 * El binario del motor DSH. Mismo criterio que `binDelMotor()` de ratacode.js:
 * se pregunta al paquete instalado, no se adivina una ruta.
 * @param {string|undefined} indicada - valor de `--dsh`, si lo hay.
 * @returns {string} ruta absoluta a `lib/bin.js`.
 */
export function binDelMotor(indicada) {
  if (indicada !== undefined && indicada !== null && indicada !== '') {
    const ruta = resolve(indicada);
    if (!existsSync(ruta)) throw new Error('no encuentro el motor en ' + ruta);
    return ruta;
  }
  const requerir = createRequire(import.meta.url);
  const manifiesto = requerir.resolve('@deepseek-ai/dsh/package.json');
  const pkg = JSON.parse(readFileSync(manifiesto, 'utf8'));
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.dsh;
  if (rel === undefined || rel === null) throw new Error('el motor no declara su binario (¿instalación a medias?)');
  const bin = join(dirname(manifiesto), rel);
  if (!existsSync(bin)) throw new Error('no encuentro el motor en ' + bin);
  return bin;
}

/**
 * DSH 0.2 ya no tiene `settings.yaml`: los ajustes que se tocan en la web
 * (proveedores, modelo por defecto, idioma…) viven como filas `- id: X config:`
 * en el parche del perfil web (`dsh-settings` → `configEditor`). Un
 * `settings.yaml` que quede en la casa lo importa el motor UNA vez, en el perfil
 * que arranque primero, y lo renombra a `settings.yaml.imported`; las secciones
 * que no son del motor (la `mcp:` de RATACODE) se quedan sólo en ese fichero.
 * Por eso RATACODE importa él mismo (`importarAjustes`), siempre al perfil web,
 * y su sección `mcp:` pasa a `<casa>\ratacode.yaml`.
 */
const PARCHE_WEB = ['profiles', 'web', 'cordis.patch.yml'];
/** Las secciones viejas cuya fila tiene otro id (la misma tabla que `dsh-settings`). */
const ID_DE_SECCION = { 'ui-onboarding': 'ui-settings-general', 'ui-developer-tools': 'ui-settings' };
/**
 * Los presets de permiso de `dsh-base`. Una fila por id REEMPLAZA la config
 * entera (no mezcla), así que `permission` tiene que repetirlos.
 * ponytail: copia de dsh-base 0.2.0-rc.2; si el motor cambia sus presets, actualizar aquí.
 */
const PRESETS_DE_PERMISO = {
  'read-only': { sandbox: 'read-only', approval: 'ask' },
  'workspace-write': { sandbox: 'workspace-write', approval: 'ask' },
  'danger-full-access': { sandbox: 'danger-full-access', approval: 'never' },
};
/**
 * La telemetría del motor (Ajustes › General › «Upload Session Log when using the
 * official model API»): la fila `session-log-deepseek` de `dsh-base` sube el
 * registro de la sesión con cada petición a la API oficial de DeepSeek, y de
 * serie viene ENCENDIDA. RATACODE la deja APAGADA de serie: la fila va en el
 * parche del perfil web (que es donde escribe ese interruptor, así que el
 * usuario la puede volver a encender) y, si la casa no dice nada, también en los
 * perfiles sin web (headless, sdk) a través de {@link FILAS_COMPARTIDAS}.
 */
export const TELEMETRIA = { id: 'session-log-deepseek', config: { enabled: false } };
/** Las filas que los perfiles sin web (headless, sdk) necesitan del perfil web. */
export const FILAS_COMPARTIDAS = ['permission', 'agent-default-model', 'llm-pi-ai', 'llm-deepseek', TELEMETRIA.id];
/** El parche de un perfil puede llevar `!!js`: aquí sólo se leen datos, así que vale null. */
const ESQUEMA = yaml.DEFAULT_SCHEMA.extend([new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: () => null })]);

/**
 * Un mapa YAML de un fichero; {} si no está; lanza si está roto.
 * Con `tolerante`, una clave repetida no lo rompe: gana la ÚLTIMA. Es para el
 * `settings.yaml` de las casas que estrenó la 0.2.9 con la fábrica en CRLF: el
 * modelo elegido se añadía al final como un segundo `agent-default-model`.
 */
function mapaDe(ruta, { tolerante = false } = {}) {
  if (!existsSync(ruta)) return {};
  const cargado = yaml.load(readFileSync(ruta, 'utf8'), { schema: ESQUEMA, json: tolerante });
  if (cargado === null || cargado === undefined) return {};
  if (typeof cargado !== 'object' || Array.isArray(cargado)) throw new Error(ruta + ' no es un mapa');
  return cargado;
}

/** Las filas `- id: X config: {…}` de primer nivel del parche web, como `{X: config}`. */
function filasDelPerfilWeb(casa) {
  const ruta = join(casa, ...PARCHE_WEB);
  if (!existsSync(ruta)) return {};
  const filas = yaml.load(readFileSync(ruta, 'utf8'), { schema: ESQUEMA }) ?? [];
  if (!Array.isArray(filas)) throw new Error(ruta + ' no es una lista de filas');
  const salida = {};
  for (const fila of filas) {
    if (fila === null || typeof fila !== 'object' || typeof fila.id !== 'string') continue;
    if (fila.config !== null && typeof fila.config === 'object' && !Array.isArray(fila.config)) salida[fila.id] = fila.config;
  }
  return salida;
}

/**
 * Los ajustes de la casa, con la forma de siempre (`{'llm-pi-ai': …, mcp: …}`):
 * las filas del perfil web, encima un `settings.yaml` aún sin importar, y la
 * sección `mcp:` de `<casa>\ratacode.yaml`.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{documento: object, ruta: string, error: string|null}}
 */
export function leerAjustes(casa) {
  const ruta = join(casa, 'ratacode.yaml');
  try {
    const documento = filasDelPerfilWeb(casa);
    const { mcp, ratacode, ...delMotor } = mapaDe(join(casa, 'settings.yaml'), { tolerante: true });
    for (const [seccion, valor] of Object.entries(delMotor)) {
      documento[ID_DE_SECCION[seccion] ?? seccion] = valor;
    }
    if (documento[TELEMETRIA.id] === undefined) documento[TELEMETRIA.id] = TELEMETRIA.config;
    const propio = mapaDe(ruta);
    const enchufes = propio.enchufes ?? ratacode?.enchufes;
    if (propio.mcp !== undefined) documento.mcp = propio.mcp;
    else if (mcp !== undefined) documento.mcp = mcp;
    if (enchufes !== undefined) documento.enchufes = enchufes;
    return { documento, ruta, error: null };
  } catch (e) {
    return { documento: {}, ruta, error: 'no pude leer los ajustes de la casa: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * Pasa un `settings.yaml` de la casa (el de fábrica de una casa nueva, o el de
 * una casa de la 0.2.9) a donde lo quiere DSH 0.2, ANTES de arrancar el motor:
 * cada sección del motor, como fila del parche web (las que ya estén no se
 * pisan); `mcp:` a `ratacode.yaml`; `agent-presets` se tira (los modos van en
 * el parche de la piel). El original queda como `settings.yaml.imported`.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{importado: boolean, filas?: string[], motivo?: string}}
 */
export function importarAjustes(casa) {
  const original = join(casa, 'settings.yaml');
  if (!existsSync(original)) return { importado: false, motivo: 'no hay settings.yaml' };
  const propio = join(casa, 'ratacode.yaml');
  let secciones;
  let yaHay;
  let yaTiene;
  try {
    secciones = mapaDe(original, { tolerante: true });
    yaHay = filasDelPerfilWeb(casa);
    yaTiene = mapaDe(propio);
  } catch (e) {
    return { importado: false, motivo: 'no lo puedo leer, no lo toco: ' + (e instanceof Error ? e.message : String(e)) };
  }
  const { mcp, ratacode, 'agent-presets': _modos, ...delMotor } = secciones;
  // Lo de RATACODE (`mcp:` y los enchufes, que en la 0.2.9 iban en
  // `ratacode.enchufes`) va a `ratacode.yaml`, sin pisar lo que ya tenga.
  const nuevo = {};
  if (mcp !== undefined && yaTiene.mcp === undefined) nuevo.mcp = mcp;
  if (ratacode?.enchufes !== undefined && yaTiene.enchufes === undefined) nuevo.enchufes = ratacode.enchufes;
  if (Object.keys(nuevo).length > 0) {
    const antes = existsSync(propio) ? readFileSync(propio, 'utf8').replace(/\s*$/, '\n\n') : CABECERA_RATACODE_YAML;
    writeFileSync(propio, antes + yaml.dump(nuevo, { lineWidth: -1 }), { mode: 0o600 });
  }
  const filas = [];
  for (const [seccion, valor] of Object.entries(delMotor)) {
    const id = ID_DE_SECCION[seccion] ?? seccion;
    if (id in yaHay) continue;
    filas.push({ id, config: id === 'permission' ? { presets: PRESETS_DE_PERMISO, ...valor } : valor });
  }
  if (filas.length > 0) {
    const parche = join(casa, ...PARCHE_WEB);
    mkdirSync(dirname(parche), { recursive: true });
    let base = existsSync(parche) ? readFileSync(parche, 'utf8') : '';
    if ((yaml.load(base, { schema: ESQUEMA }) ?? []).length === 0) base = ''; // un `[]` no admite filas detrás
    writeFileSync(parche, (base === '' ? '' : base.replace(/\s*$/, '\n\n'))
      + '# RATACODE · importado de settings.yaml\n' + yaml.dump(filas, { lineWidth: -1 }), { mode: 0o600 });
  }
  const destino = original + '.imported';
  renameSync(original, existsSync(destino) ? destino + '-' + Date.now() : destino);
  return { importado: true, filas: filas.map((f) => f.id) };
}

/** La primera línea de `<casa>\ratacode.yaml`. */
export const CABECERA_RATACODE_YAML = '# RATACODE · los ajustes propios de la casa (el motor no los lee).\n';

/**
 * El overlay `--patch` con las filas compartidas del perfil web, para los
 * perfiles que no las tienen (headless, sdk).
 * @param {string} casa - la casa de RATACODE.
 * @param {string} nombre - nombre del fichero dentro de `<casa>\perfiles-parche`.
 * @param {{ids?: string[], cambios?: object}} [opciones] - qué filas, y cuáles se cambian sólo para esta vez.
 * @returns {string} la ruta del overlay.
 */
export function parcheDeAjustes(casa, nombre, { ids = FILAS_COMPARTIDAS, cambios = {} } = {}) {
  const { documento } = leerAjustes(casa);
  const filas = ids.filter((id) => documento[id] !== undefined || cambios[id] !== undefined)
    .map((id) => ({ id, config: cambios[id] ?? documento[id] }));
  const ruta = join(casa, 'perfiles-parche', nombre);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, '# Generado por RATACODE en cada arranque: las filas del perfil web.\n'
    + (filas.length === 0 ? '[]\n' : yaml.dump(filas, { lineWidth: -1 })), { mode: 0o600 });
  return ruta;
}

/** Un texto no vacío, o undefined. */
function texto(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined;
}

/**
 * La sección `mcp:` de los ajustes, con sus valores por defecto.
 * Todo lo que limita el daño se lee de aquí, para que el humano lo pueda
 * cambiar sin tocar código.
 *
 * R27 · Y cuatro ajustes más, por lo que pidió el dueño («que vaya rápido y no
 * gaste»):
 *   · `espera_por_defecto_segundos` — lo que `run_task` espera dentro de la
 *     MISMA llamada si el cliente no dice otra cosa (25 s de fábrica). Así el
 *     chat normal recibe el resultado sin preguntar en bucle.
 *   · `pasos_max` y `tokens_max` — el tope de una tarea: al llegar, la tarea se
 *     para y lo dice. Sin tope, un encargo confuso puede dar vueltas gastando.
 *   · `puerto` — el puerto del MCP por HTTP de esta casa (3778 de fábrica). La
 *     piel lo usa para encender el MCP y el túnel, y así la dirección es
 *     siempre la misma.
 * Y dos para la DIRECCIÓN FIJA (el «túnel con nombre» de Cloudflare, que da de
 * alta el humano en su cuenta): `tunel_nombre` y `tunel_host`.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{workspaces: string[], workspacePorDefecto: string|undefined, permitirPeligroso: boolean, precios: object, timeoutPorDefectoMs: number, timeoutMaximoMs: number, tareasALaVez: number, promptMaxCaracteres: number, esperaPorDefectoSegundos: number, pasosMax: number, tokensMax: number, puerto: number, tunelNombre: string|undefined, tunelHost: string|undefined, avisos: string[]}}
 */
export function ajustesMcp(casa) {
  const { documento, error } = leerAjustes(casa);
  const avisos = error === null ? [] : [error];
  const bruto = documento.mcp;
  const seccion = bruto !== null && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {};
  const listaBruta = Array.isArray(seccion.workspaces) ? seccion.workspaces : [];
  const workspaces = [];
  for (const entrada of listaBruta) {
    const ruta = texto(entrada);
    if (ruta === undefined) {
      avisos.push('mcp.workspaces tiene una entrada que no es una ruta de texto; la salto');
      continue;
    }
    workspaces.push(resolve(ruta));
  }
  const porDefecto = texto(seccion.workspace_por_defecto);
  const precios = seccion.precios !== null && typeof seccion.precios === 'object' && !Array.isArray(seccion.precios) ? seccion.precios : {};
  const tunelNombre = texto(seccion.tunel_nombre);
  const tunelHost = texto(seccion.tunel_host);
  if ((tunelNombre === undefined) !== (tunelHost === undefined)) {
    avisos.push('mcp.tunel_nombre y mcp.tunel_host van juntos: hace falta el nombre del túnel Y su hostname. Sin los dos, se usa el túnel rápido');
  }
  return {
    workspaces,
    workspacePorDefecto: porDefecto === undefined ? undefined : resolve(porDefecto),
    permitirPeligroso: seccion.permitir_peligroso === true,
    precios,
    timeoutPorDefectoMs: enteroPositivo(seccion.timeout_por_defecto_ms, TIMEOUT_POR_DEFECTO_MS),
    timeoutMaximoMs: enteroPositivo(seccion.timeout_maximo_ms, TIMEOUT_MAXIMO_MS),
    tareasALaVez: enteroPositivo(seccion.tareas_a_la_vez, TAREAS_A_LA_VEZ),
    promptMaxCaracteres: enteroPositivo(seccion.prompt_max_caracteres, PROMPT_MAX_CARACTERES),
    esperaPorDefectoSegundos: enteroPositivo(seccion.espera_por_defecto_segundos, ESPERA_POR_DEFECTO_SEGUNDOS),
    pasosMax: enteroPositivo(seccion.pasos_max, PASOS_MAX),
    tokensMax: enteroPositivo(seccion.tokens_max, TOKENS_MAX),
    puerto: enteroPositivo(seccion.puerto, PUERTO_POR_DEFECTO),
    tunelNombre: tunelNombre === undefined || tunelHost === undefined ? undefined : tunelNombre,
    tunelHost: tunelNombre === undefined || tunelHost === undefined ? undefined : tunelHost,
    avisos,
  };
}

/** Los topes de fábrica del MCP. Se pueden cambiar en `mcp:` de ratacode.yaml. */
/** Media hora por tarea si el cliente no dice otra cosa. */
export const TIMEOUT_POR_DEFECTO_MS = 1_800_000;
/** Y una hora como techo, aunque el cliente pida más. */
export const TIMEOUT_MAXIMO_MS = 3_600_000;
/** Cuántas tareas pueden estar en marcha a la vez. */
export const TAREAS_A_LA_VEZ = 3;
/** Tope del encargo (caracteres). Un prompt de verdad no llega ni de lejos. */
export const PROMPT_MAX_CARACTERES = 100_000;
/**
 * R27 · Lo que `run_task` espera DENTRO de la llamada si el cliente no dice
 * otra cosa. 25 s es lo que tarda un «responde PONG» o un recado corto: con
 * esto, el chat normal recibe el resultado sin preguntar en bucle (que es lo
 * que gasta cuota y tiempo). Si la tarea no acaba, se devuelve el `task_id`.
 */
export const ESPERA_POR_DEFECTO_SEGUNDOS = 25;
/** R27 · Tope de PASOS (vueltas del modelo) de una tarea. */
export const PASOS_MAX = 40;
/** R27 · Tope de TOKENS (entrada + salida) de una tarea. */
export const TOKENS_MAX = 400_000;
/** El puerto del MCP por HTTP de una casa. La piel lo usa para encenderlo. */
export const PUERTO_POR_DEFECTO = 3778;

/** Un entero positivo de los ajustes, o el valor de fábrica. */
function enteroPositivo(valor, porDefecto) {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 ? valor : porDefecto;
}
