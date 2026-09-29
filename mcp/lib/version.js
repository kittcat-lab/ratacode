/**
 * version — la versión de RATACODE, leída del manifiesto (R26).
 *
 * Por qué un fichero para esto: el cliente MCP (y ChatGPT, al enseñar el
 * conector) ven el nombre y la VERSIÓN del servidor en el handshake, y
 * `ratacode_status` la publica. Estaba escrita a mano («0.1.0») y se quedó
 * vieja; leerla del `package.json` que de verdad se instaló es lo único que no
 * miente.
 *
 * Dos sitios, en orden: el paquete del producto (`../../package.json`, que es
 * como viaja dentro de `ratacode`) y el del MCP suelto (`../package.json`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** La carpeta de `mcp/lib`. */
const AQUI = dirname(fileURLToPath(import.meta.url));

/** La versión, o `0.0.0` si no hay manifiesto legible (no se inventa). */
export const VERSION = leer();

/** Leer la versión del primer manifiesto que se deje. */
function leer() {
  for (const relativa of ['../../package.json', '../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(join(AQUI, relativa), 'utf8'));
      if (typeof pkg.version === 'string' && pkg.version.trim() !== '') return pkg.version.trim();
    } catch { /* se prueba el siguiente */ }
  }
  return '0.0.0';
}
