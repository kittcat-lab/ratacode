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
import { existsSync, readFileSync } from 'node:fs';
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
 * Los ajustes de la casa (`settings.yaml`). Es el MISMO documento que lee el
 * core (dsh-settings-file), así que leerlo aquí no duplica lógica: es leer la
 * configuración del usuario, que es exactamente lo que hace la web.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{documento: object, ruta: string, error: string|null}}
 */
export function leerAjustes(casa) {
  const ruta = join(casa, 'settings.yaml');
  if (!existsSync(ruta)) return { documento: {}, ruta, error: null };
  try {
    const cargado = yaml.load(readFileSync(ruta, 'utf8'));
    if (cargado === null || cargado === undefined) return { documento: {}, ruta, error: null };
    if (typeof cargado !== 'object' || Array.isArray(cargado)) {
      return { documento: {}, ruta, error: 'settings.yaml no es un documento de ajustes (se esperaba un mapa)' };
    }
    return { documento: cargado, ruta, error: null };
  } catch (e) {
    return { documento: {}, ruta, error: 'no pude leer settings.yaml: ' + (e instanceof Error ? e.message : String(e)) };
  }
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

/** Los topes de fábrica del MCP. Se pueden cambiar en `mcp:` de settings.yaml. */
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
