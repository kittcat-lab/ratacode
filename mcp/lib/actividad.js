/**
 * actividad — el cuaderno de lo que pasa por el MCP.
 *
 * Una línea JSON por llamada, en `<casa>/mcp/actividad.jsonl`. Es lo que luego
 * enseña el panel y es también lo que permite mirar atrás sin pantalla.
 *
 * DOS CLASES DE LÍNEA (R27), y las dos importan:
 *   · `tipo: 'tarea'` — una tarea TERMINADA (lo de siempre): hora, cliente,
 *     modelo, proveedor, tarea, duración, tokens, coste y estado.
 *   · `tipo: 'lectura'` — una llamada de SÓLO LECTURA (`ratacode_status`,
 *     `list_files`, `read_file`, `list_providers`, `list_models`,
 *     `get_task_status`, `get_task_result`): hora, cliente, herramienta, la
 *     ruta que se pidió y si se permitió o se bloqueó. Sin esto, el panel
 *     parecía muerto mientras ChatGPT sólo leía.
 *
 * Regla de la casa: aquí se escribe el NOMBRE de la credencial si hace falta,
 * nunca su valor. Y el prompt se guarda recortado, para que un encargo enorme
 * no infle el cuaderno.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Cuántos caracteres del encargo (y de la ruta) se guardan en el cuaderno. */
const TOPE_TAREA = 120;
/** Tope de la ruta que se apunta (una ruta larga no infla el cuaderno). */
const TOPE_RUTA = 300;

/**
 * Apuntar una tarea terminada.
 * @param {string} casa - la casa de RATACODE.
 * @param {object} fila - los campos de la línea.
 * @returns {void}
 */
export function anotar(casa, fila) {
  escribir(casa, {
    tipo: 'tarea',
    hora: new Date().toISOString(),
    cliente: fila.cliente ?? 'MCP',
    modelo: fila.modelo ?? null,
    proveedor: fila.proveedor ?? null,
    tarea: recortar(fila.tarea),
    duracion_ms: fila.duracion_ms ?? null,
    tokens_input: fila.tokens_input ?? null,
    tokens_output: fila.tokens_output ?? null,
    coste: fila.coste ?? null,
    estado: fila.estado ?? null,
    espacio: fila.espacio ?? null,
    task_id: fila.task_id ?? null,
  });
}

/**
 * Apuntar una llamada de SÓLO LECTURA (R27 §1). Una línea por llamada: hora,
 * cliente (ChatGPT), herramienta, la ruta que se pidió y si se permitió o se
 * bloqueó. Se escribe SIEMPRE, también cuando se bloquea: lo bloqueado es
 * justo lo que el humano quiere ver.
 * @param {string} casa - la casa de RATACODE.
 * @param {{cliente?: string, herramienta: string, ruta?: string|null, permitido: boolean, motivo?: string|null, detalle?: string|null}} fila - la llamada.
 * @returns {void}
 */
export function anotarLectura(casa, fila) {
  escribir(casa, {
    tipo: 'lectura',
    hora: new Date().toISOString(),
    cliente: fila.cliente ?? 'MCP',
    herramienta: fila.herramienta,
    ruta: recortarRuta(fila.ruta),
    permitido: fila.permitido === true,
    motivo: fila.permitido === true ? null : (fila.motivo ?? 'bloqueado'),
    detalle: fila.detalle ?? null,
  });
}

/** Una línea al cuaderno. Nunca puede tumbar el servicio: si no se puede escribir, se calla. */
function escribir(casa, linea) {
  try {
    const carpeta = join(casa, 'mcp');
    mkdirSync(carpeta, { recursive: true });
    appendFileSync(join(carpeta, 'actividad.jsonl'), JSON.stringify(linea) + '\n');
  } catch { /* el cuaderno no puede tumbar el servicio */ }
}

/** La ruta, recortada a una línea corta (sin tocarla: el usuario la pegó así). */
function recortarRuta(ruta) {
  if (typeof ruta !== 'string' || ruta.trim() === '') return null;
  return ruta.length <= TOPE_RUTA ? ruta : ruta.slice(0, TOPE_RUTA - 1) + '…';
}

/** Recortar un texto a una línea corta. */
function recortar(texto) {
  if (typeof texto !== 'string') return null;
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length <= TOPE_TAREA ? plano : plano.slice(0, TOPE_TAREA - 1) + '…';
}
