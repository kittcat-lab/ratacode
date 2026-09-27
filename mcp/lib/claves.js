/**
 * claves — ¿está la credencial? Sólo sí o no, y sin leer nunca el valor.
 *
 * ── REGLA DE LA CASA (24-sep, por indicación del tutor) ─────────────────────
 * Este servidor NO lee ficheros de credenciales. Ni `.credentials.yaml`, ni
 * `.env`, ni bóvedas, ni nada por el estilo. Las fuentes que mira son dos, y
 * ninguna abre nada:
 *
 *   1 · el ENTORNO del proceso (lo que el cliente MCP le ha dado al arrancarlo);
 *   2 · y si el fichero de credenciales de la casa EXISTE —eso, y nada más: ni
 *      se abre ni se parsea—, se deja que sea el MOTOR (que es su dueño) quien
 *      resuelva la clave de ahí. Así valen las claves guardadas con
 *      Ajustes → Models sin que este servidor toque un secreto.
 *
 * Si no hay ni una cosa ni la otra, se para y se dice con todas las letras.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ¿Está esta credencial en el entorno del servidor?
 * @param {string} nombre - nombre de la variable (p. ej. `B_AI_API_KEY`).
 * @returns {boolean}
 */
export function estaEnElEntorno(nombre) {
  if (typeof nombre !== 'string' || nombre.trim() === '') return false;
  const valor = process.env[nombre];
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * ¿Tiene la casa un fichero de credenciales? SÓLO se mira si existe: este
 * servidor no lo abre, no lo parsea y no lee ningún valor. Quien resuelve la
 * clave de ahí es el motor, cuando arranca la tarea.
 * @param {string} casa - la casa de RATACODE.
 * @returns {boolean}
 */
export function hayCredencialesEnLaCasa(casa) {
  try {
    return existsSync(join(casa, '.credentials.yaml'));
  } catch {
    return false;
  }
}

/**
 * El mensaje exacto cuando falta una clave. Se usa tal cual, sin adornos.
 * @param {string} nombre - nombre de la variable que falta.
 * @returns {string} p. ej. `falta B_AI_API_KEY en el entorno del cliente MCP`.
 */
export function faltaEnElEntorno(nombre) {
  return 'falta ' + nombre + ' en el entorno del cliente MCP';
}
