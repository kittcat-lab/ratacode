/**
 * registro — hablar sin romper el protocolo.
 *
 * El transporte stdio de MCP es DUEÑO de stdout: un solo `console.log` nuestro
 * dentro de stdout y el cliente deja de entender los frames. Por eso aquí todo
 * lo que contamos va a stderr, y stdout sólo lo toca el SDK.
 *
 * Regla de la casa, además: aquí NUNCA se escribe el valor de una clave. Sólo
 * su nombre y de dónde sale.
 */

/** Un aviso para el humano (stderr, nunca stdout). */
export function aviso(...trozos) {
  process.stderr.write('RATACODE-MCP · ' + trozos.join(' ') + '\n');
}

/** Un error con pila, también por stderr. */
export function fallo(que, error) {
  const texto = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write('RATACODE-MCP · ' + que + ': ' + texto + '\n');
}
