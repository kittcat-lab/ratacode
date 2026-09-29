/**
 * lectura — LA LECTURA, ENCERRADA DE VERDAD (R25).
 *
 * ── LO QUE DICE EL MOTOR (medido, con el código delante) ───────────────────
 *   · `dsh-fs-sandbox/lib/types/index.d.ts:7-8` — «Reads pass through
 *     untouched: every mode permits reading.»
 *   · `dsh-sandbox/lib/types/roots.d.ts:28-36` — la ÚNICA lista de raíces que
 *     el motor sabe derivar es la de ESCRITURA (`writableRoots`).
 *   · `dsh-sandbox-windows-acl/lib/types/index.d.ts:24-25` — «writes are
 *     restricted; reads, network, and process visibility are NOT».
 *   · El vocabulario de modos (`read-only | workspace-write |
 *     danger-full-access`) es un eje de EFECTOS SOBRE FICHEROS: `read-only`
 *     deniega toda MUTACIÓN, no toda lectura.
 *
 * O sea: NO hay modo, ni ajuste, ni plugin del motor que encierre la LECTURA.
 * Lo que SÍ hay es un gancho de permiso POR HERRAMIENTA: `tools/pre-execute`
 * (`dsh-tools/lib/types/index.d.ts:29-38`), que ve cada llamada antes de
 * ejecutarse y puede contestar `{kind:'deny', reason}` (`dsh-tools/lib/index.js:3116-3135`).
 *
 * ── ESTE FICHERO ES DOS COSAS A LA VEZ ─────────────────────────────────────
 *   1 · las funciones PURAS que deciden si una ruta está dentro de las
 *       carpetas autorizadas, normalizando de verdad: rutas relativas, `..`,
 *       mayúsculas/minúsculas de Windows, enlaces y uniones (realpath del trozo
 *       que existe), UNC (`\\servidor\recurso`) y el prefijo de rutas largas
 *       (`\\?\C:\…`, `\\?\UNC\…`);
 *   2 · el PLUGIN DE CORDIS que el motor monta en cada tarea del MCP: se
 *       inserta por parche y engancha `tools/pre-execute`. Deniega con UNA
 *       línea: «Fuera de la carpeta autorizada: <ruta>».
 *
 * El MCP copia este fichero junto al parche (`<casa>\mcp\tmp\lectura.js`) y el
 * parche lo inserta por su nombre relativo: el motor resuelve `./lectura.js`
 * desde la CARPETA DEL PARCHE (`cordis-plugin-loader/lib/index.js:273-278`),
 * medido. Por eso el fichero es autosuficiente: sólo usa módulos de Node.
 */
import { realpathSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

/** ¿Es Windows? (allí las rutas no distinguen mayúsculas) */
const ES_WINDOWS = process.platform === 'win32';

/** La línea que ve el agente cuando la herramienta se para. Una, y con la ruta. */
export function motivoFuera(ruta) {
  return 'Fuera de la carpeta autorizada: ' + ruta;
}

/**
 * Las claves de los argumentos que llevan una ruta, medidas en las herramientas
 * del motor: `file_path` (dsh-tool-fs: read, read_image, write, edit), `path`
 * (dsh-tool-fs-search: glob, grep) y `files[].path` (dsh-tool-present).
 * Un nombre que NO esté aquí no se mira: el cuerpo de un texto (`old_string`,
 * `content`, un encargo) no es una ruta y no se toca.
 */
export const CLAVES_DE_RUTA = [
  'file_path', 'path', 'dir', 'directory', 'cwd', 'working_directory',
  'root', 'workspace', 'files', 'paths',
];

/**
 * La forma canónica de una ruta:
 *   · quita el prefijo de rutas largas de Windows (`\\?\`, `\\?\UNC\`);
 *   · resuelve lo relativo contra `cwd` (el espacio de la tarea);
 *   · resuelve `..`, barras repetidas y barras al revés (lo hace `resolve`);
 *   · sigue los enlaces/uniones del trozo que EXISTE (realpath), y deja el
 *     resto tal cual: una ruta que aún no existe (un `write`) también se juzga,
 *     y se juzga por dónde va a caer de verdad.
 * @param {string} ruta - lo que pidió la herramienta.
 * @param {string} [cwd] - desde dónde se resuelve lo relativo.
 * @returns {string} la ruta canónica.
 */
export function canonica(ruta, cwd = process.cwd()) {
  let texto = String(ruta ?? '').trim();
  if (texto === '') return '';
  // \\?\UNC\servidor\recurso\… → \\servidor\recurso\…
  if (/^\\\\\?\\UNC\\/i.test(texto)) texto = '\\\\' + texto.slice(8);
  // \\?\C:\… → C:\…
  else if (/^\\\\\?\\/.test(texto)) texto = texto.slice(4);
  // Y lo mismo con barras normales (una ruta copiada de un chat).
  if (/^\/\/\?\/UNC\//i.test(texto)) texto = '\\\\' + texto.slice(8);
  else if (/^\/\/\?\//.test(texto)) texto = texto.slice(4);
  return realDe(resolve(cwd, texto));
}

/** Un alias del nombre que usa `seguridad.js` para lo mismo. */
export const normalizarRuta = canonica;

/**
 * `realpath` del trozo que existe. Si `C:\a\enlace\no-existe.txt` tiene el
 * enlace en medio, lo que importa es dónde acaba el enlace, no el nombre.
 * @param {string} absoluta - ruta absoluta ya resuelta.
 * @returns {string} la ruta con los enlaces resueltos.
 */
function realDe(absoluta) {
  let actual = absoluta;
  const cola = [];
  for (;;) {
    try {
      const real = realpathSync.native(actual);
      return cola.length === 0 ? real : join(real, ...cola.reverse());
    } catch {
      const padre = dirname(actual);
      // Se llegó a la raíz (o a algo que no se puede mirar): se devuelve la ruta
      // resuelta tal cual, que ya no tiene `..` ni prefijos raros.
      if (padre === actual) return absoluta;
      cola.push(basename(actual));
      actual = padre;
    }
  }
}

/** La forma comparable de una ruta (en Windows, sin distinguir mayúsculas). */
export function comparable(ruta) {
  const limpia = ruta.endsWith(sep) && ruta.length > 1 ? ruta.slice(0, -1) : ruta;
  return ES_WINDOWS ? limpia.toLowerCase() : limpia;
}

/**
 * ¿`hijo` está dentro de `raiz` (o es `raiz`)? Las dos, ya normalizadas.
 * @param {string} hijo - ruta normalizada.
 * @param {string} raiz - ruta normalizada.
 * @returns {boolean}
 */
export function estaDentro(hijo, raiz) {
  const a = comparable(hijo);
  const b = comparable(raiz);
  if (a === b) return true;
  return a.startsWith(b.endsWith(sep) ? b : b + sep);
}

/**
 * ¿La ruta cae dentro de ALGUNA de las raíces autorizadas?
 * @param {string} ruta - la ruta pedida (cruda).
 * @param {string[]} raices - las carpetas autorizadas (crudas).
 * @param {string} [cwd] - desde dónde se resuelve lo relativo.
 * @returns {{dentro: boolean, canonica: string}}
 */
export function dentroDeAlguna(ruta, raices, cwd) {
  const suya = canonica(ruta, cwd);
  if (suya === '') return { dentro: true, canonica: suya };
  for (const raiz of raices ?? []) {
    const canonRaiz = canonica(raiz, cwd);
    if (canonRaiz === '') continue;
    if (estaDentro(suya, canonRaiz)) return { dentro: true, canonica: suya };
  }
  return { dentro: false, canonica: suya };
}

/**
 * Las rutas que lleva una llamada a herramienta. Se miran las claves conocidas
 * ({@link CLAVES_DE_RUTA}) en el primer nivel y en los objetos de dentro
 * (`files: [{path: …}]`), nunca el texto libre.
 * @param {object} entrada - los argumentos de la herramienta.
 * @param {number} [profundidad] - cuántos niveles de objeto se miran.
 * @returns {string[]} las rutas encontradas, tal cual venían.
 */
export function rutasDe(entrada, profundidad = 2) {
  const salida = [];
  if (entrada === null || typeof entrada !== 'object' || profundidad < 0) return salida;
  for (const [clave, valor] of Object.entries(entrada)) {
    if (CLAVES_DE_RUTA.includes(clave)) {
      if (typeof valor === 'string') {
        if (valor.trim() !== '') salida.push(valor);
      } else if (Array.isArray(valor)) {
        for (const uno of valor) {
          if (typeof uno === 'string' && uno.trim() !== '') salida.push(uno);
          else if (uno !== null && typeof uno === 'object' && typeof uno.path === 'string' && uno.path.trim() !== '') salida.push(uno.path);
        }
      }
      continue;
    }
    if (valor !== null && typeof valor === 'object') salida.push(...rutasDe(valor, profundidad - 1));
  }
  return salida;
}

/**
 * La decisión del cerco para UNA llamada.
 * @param {{entrada: object, raices: string[], cwd?: string}} opciones
 * @returns {{fuera: string}|null} la ruta que se sale, o null si todo está dentro.
 */
export function decidir({ entrada, raices, cwd }) {
  if (!Array.isArray(raices) || raices.length === 0) return { fuera: '(sin carpetas autorizadas)' };
  for (const ruta of rutasDe(entrada)) {
    const juicio = dentroDeAlguna(ruta, raices, cwd);
    if (!juicio.dentro) return { fuera: ruta };
  }
  return null;
}

// ── EL PLUGIN ──────────────────────────────────────────────────────────────
// Esto es lo que el motor monta: una fila insertada por el parche del MCP.

/** El nombre del plugin en la composición del motor. */
export const name = 'ratacode-cerco';

/**
 * Engancha `tools/pre-execute` y deniega la herramienta que lleve una ruta
 * fuera de las carpetas autorizadas. Sin raíces NO deja pasar nada (falla
 * cerrado): una tarea del MCP siempre las trae.
 * @param {object} ctx - el contexto de cordis.
 * @param {{raices?: string[]}} [config] - las carpetas autorizadas, del parche.
 */
export function apply(ctx, config) {
  const raices = Array.isArray(config?.raices) ? config.raices.filter((r) => typeof r === 'string' && r.trim() !== '') : [];
  ctx.on('tools/pre-execute', async (exec, next) => {
    const cwd = exec?.agent?.session?.header?.cwd ?? process.cwd();
    const juicio = decidir({ entrada: exec?.arguments ?? {}, raices, cwd });
    if (juicio === null) return next();
    return { kind: 'deny', reason: motivoFuera(juicio.fuera) };
  });
}
