/**
 * actividad — el cuaderno de lo que pasa por el MCP.
 *
 * Una línea JSON por tarea, en `<casa>/mcp/actividad.jsonl`. Es lo que luego
 * enseña el panel (hora, cliente, modelo, proveedor, tarea, duración, tokens,
 * coste, estado) y es también lo que permite mirar atrás sin pantalla.
 *
 * Regla de la casa: aquí se escribe el NOMBRE de la credencial si hace falta,
 * nunca su valor. Y el prompt se guarda recortado, para que un encargo enorme
 * no infle el cuaderno.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Cuántos caracteres del encargo se guardan en el cuaderno. */
const TOPE_TAREA = 120;

/**
 * Apuntar una tarea terminada.
 * @param {string} casa - la casa de RATACODE.
 * @param {object} fila - los campos de la línea.
 * @returns {void}
 */
export function anotar(casa, fila) {
  const carpeta = join(casa, 'mcp');
  mkdirSync(carpeta, { recursive: true });
  const linea = {
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
  };
  appendFileSync(join(carpeta, 'actividad.jsonl'), JSON.stringify(linea) + '\n');
}

/** Recortar un texto a una línea corta. */
function recortar(texto) {
  if (typeof texto !== 'string') return null;
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length <= TOPE_TAREA ? plano : plano.slice(0, TOPE_TAREA - 1) + '…';
}
