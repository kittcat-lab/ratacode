/**
 * claves — ¿está la credencial en el entorno? Sólo sí o no.
 *
 * ── REGLA DE LA CASA (24-sep, por indicación del tutor) ─────────────────────
 * Este servidor NO lee ficheros de credenciales. Ni `.credentials.yaml`, ni
 * `.env`, ni bóvedas, ni nada por el estilo. La ÚNICA fuente que mira es el
 * entorno del proceso, que es exactamente lo que el cliente MCP le ha dado al
 * arrancarlo. Si falta una clave, se para y se dice con todas las letras; no se
 * va a buscar por ahí ni se rodea el problema.
 *
 * Y nunca se lee el VALOR para nada: sólo se comprueba si está.
 */

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
 * El mensaje exacto cuando falta una clave. Se usa tal cual, sin adornos.
 * @param {string} nombre - nombre de la variable que falta.
 * @returns {string} p. ej. `falta B_AI_API_KEY en el entorno del cliente MCP`.
 */
export function faltaEnElEntorno(nombre) {
  return 'falta ' + nombre + ' en el entorno del cliente MCP';
}
