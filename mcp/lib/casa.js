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
 * @param {string} casa - la casa de RATACODE.
 * @returns {{workspaces: string[], workspacePorDefecto: string|undefined, permitirPeligroso: boolean, precios: object, timeoutPorDefectoMs: number, timeoutMaximoMs: number, tareasALaVez: number, promptMaxCaracteres: number, avisos: string[]}}
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
  return {
    workspaces,
    workspacePorDefecto: porDefecto === undefined ? undefined : resolve(porDefecto),
    permitirPeligroso: seccion.permitir_peligroso === true,
    precios,
    timeoutPorDefectoMs: enteroPositivo(seccion.timeout_por_defecto_ms, TIMEOUT_POR_DEFECTO_MS),
    timeoutMaximoMs: enteroPositivo(seccion.timeout_maximo_ms, TIMEOUT_MAXIMO_MS),
    tareasALaVez: enteroPositivo(seccion.tareas_a_la_vez, TAREAS_A_LA_VEZ),
    promptMaxCaracteres: enteroPositivo(seccion.prompt_max_caracteres, PROMPT_MAX_CARACTERES),
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

/** Un entero positivo de los ajustes, o el valor de fábrica. */
function enteroPositivo(valor, porDefecto) {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 ? valor : porDefecto;
}
