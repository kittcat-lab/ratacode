/**
 * carpeta — LAS DOS HERRAMIENTAS DE SOLO LECTURA DEL MCP (R26).
 *
 * Por qué existe este fichero: ChatGPT (plan Pro) sólo puede usar herramientas
 * de SOLO LECTURA por un conector propio en modo desarrollador, y para que un
 * chat pueda «consultar RATACODE y decir qué hay en la carpeta autorizada»
 * hacen falta dos cosas que el motor no ofrece: listar una carpeta y leer un
 * fichero. Las dos, ENCERRADAS y comprobadas AQUÍ, en el servidor.
 *
 * Tres reglas, y ninguna es adorno:
 *
 * 1 · EL CERCO ES EL MISMO QUE EL DE LAS TAREAS. Se usan las funciones puras de
 *     `lib/lectura.js` (R25): `canonica()` resuelve rutas relativas, `..`,
 *     mayúsculas de Windows, UNC, el prefijo `\\?\` y —importante— sigue los
 *     enlaces del trozo que existe con `realpath`, así que un enlace o una
 *     unión creada DENTRO que apunta FUERA se juzga por dónde acaba de verdad.
 *     Y las raíces se calculan con las MISMAS reglas que `resolverEspacio`
 *     (`raicesAutorizadas`), incluido el apretón del modo HTTP.
 *
 * 2 · LO QUE NO ESTÁ DENTRO, NO SE TOCA. Si la ruta se sale, se lanza el mismo
 *     error de una línea que ve el agente: «Fuera de la carpeta autorizada:
 *     <ruta>». No se dice qué hay fuera, ni si existe.
 *
 * 3 · NADA DE VOLCAR EL DISCO. La lista tiene tope de entradas y la lectura
 *     tope de bytes (y no lee binarios). Un chat no necesita más.
 */
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ajustesMcp } from './casa.js';
import { canonica, dentroDeAlguna, motivoFuera } from './lectura.js';
import { raicesAutorizadas } from './seguridad.js';

/** Cuántas entradas se listan como mucho de una carpeta. */
export const TOPE_ENTRADAS = 500;
/** Cuántos bytes se leen como mucho de un fichero (256 KB: sobra para mirar). */
export const TOPE_BYTES = 262_144;

/**
 * Las carpetas autorizadas de esta casa, con las reglas de las tareas (mismas
 * raíces, mismo apretón en modo HTTP) pero SIN lanzar: `ratacode_status` tiene
 * que poder decir cuáles son aunque la casa esté mal puesta.
 * @param {{casa: string, cwdPorDefecto: string, http?: boolean}} opciones
 * @returns {{raices: string[], raiz: string|null, avisos: string[]}}
 */
export function raicesDeLaCasa({ casa, cwdPorDefecto, http = false }) {
  const ajustes = ajustesMcp(casa);
  const { raices, avisos } = raicesAutorizadas({ ajustes, cwdPorDefecto, http });
  return { raices, raiz: raices.length > 0 ? raices[0] : null, avisos };
}

/**
 * La ruta canónica pedida, o el error de una línea si se sale del cerco. Una
 * ruta vacía NO es «todo»: es que falta la ruta.
 * @param {{ruta: string, raices: string[], cwd?: string}} opciones
 * @returns {string} la ruta canónica.
 */
export function resolverDentro({ ruta, raices, cwd }) {
  const pedida = String(ruta ?? '').trim();
  if (pedida === '') throw new Error('falta la ruta (por ejemplo: "." para la carpeta autorizada)');
  const juicio = dentroDeAlguna(pedida, raices ?? [], cwd);
  if (!juicio.dentro) throw new Error(motivoFuera(juicio.canonica === '' ? pedida : juicio.canonica));
  return juicio.canonica;
}

/**
 * Listar una carpeta autorizada, sin salirse.
 * @param {{ruta?: string, raices: string[], cwd?: string, tope?: number}} opciones
 * @returns {{carpeta: string, raices: string[], total: number, devueltas: number, truncado: boolean, entradas: object[]}}
 */
export function listarCarpeta({ ruta, raices, cwd, tope = TOPE_ENTRADAS }) {
  const lista = Array.isArray(raices) ? raices : [];
  const carpeta = resolverDentro({ ruta, raices: lista, cwd });
  if (!existsSync(carpeta)) throw new Error('no existe: ' + carpeta);
  if (!statSync(carpeta).isDirectory()) throw new Error('no es una carpeta: ' + carpeta);

  const todas = readdirSync(carpeta, { withFileTypes: true });
  const entradas = [];
  for (const entrada of todas) {
    if (entradas.length >= tope) break;
    entradas.push(describir(join(carpeta, entrada.name), entrada, lista, carpeta));
  }
  return {
    carpeta,
    raices: lista,
    total: todas.length,
    devueltas: entradas.length,
    truncado: todas.length > entradas.length,
    entradas,
  };
}

/**
 * Describir UNA entrada. Si es un enlace (o una unión de Windows) se mira a
 * DÓNDE va de verdad: un enlace de dentro que apunta fuera se dice tal cual y
 * no se toca.
 * @param {string} completa - ruta completa de la entrada.
 * @param {import('node:fs').Dirent} entrada - la entrada del directorio.
 * @param {string[]} raices - carpetas autorizadas.
 * @param {string} carpeta - la carpeta que se está listando.
 * @returns {object}
 */
function describir(completa, entrada, raices, carpeta) {
  const base = { nombre: entrada.name };
  const destino = canonica(completa, carpeta);
  const dentro = dentroDeAlguna(completa, raices, carpeta).dentro;
  if (entrada.isSymbolicLink()) {
    return { ...base, tipo: 'enlace', destino_dentro: dentro, ...(dentro ? {} : { aviso: 'el enlace apunta FUERA de la carpeta autorizada: no se sigue' }) };
  }
  if (!dentro) return { ...base, tipo: 'otro', aviso: 'sin resolver dentro de la carpeta autorizada' };
  if (entrada.isDirectory()) return { ...base, tipo: 'carpeta' };
  if (entrada.isFile()) {
    try {
      const info = statSync(destino);
      return { ...base, tipo: 'fichero', bytes: info.size, modificado: info.mtime.toISOString() };
    } catch {
      return { ...base, tipo: 'fichero' };
    }
  }
  return { ...base, tipo: 'otro' };
}

/**
 * Leer un fichero autorizado, sin salirse y sin volcar un disco.
 * @param {{ruta: string, raices: string[], cwd?: string, maxBytes?: number}} opciones
 * @returns {{fichero: string, bytes: number, bytes_totales: number, truncado: boolean, texto: string}}
 */
export function leerFichero({ ruta, raices, cwd, maxBytes = TOPE_BYTES }) {
  const lista = Array.isArray(raices) ? raices : [];
  const fichero = resolverDentro({ ruta, raices: lista, cwd });
  if (!existsSync(fichero)) throw new Error('no existe: ' + fichero);
  const info = statSync(fichero);
  if (info.isDirectory()) throw new Error('es una carpeta, no un fichero: ' + fichero + ' (usa list_files)');

  const tope = Math.min(Math.max(1, Number(maxBytes) || TOPE_BYTES), TOPE_BYTES);
  const trozo = Buffer.alloc(Math.min(tope, Math.max(1, info.size)));
  const descriptor = openSync(fichero, 'r');
  let leidos = 0;
  try {
    leidos = trozo.length === 0 ? 0 : readSync(descriptor, trozo, 0, trozo.length, 0);
  } finally {
    closeSync(descriptor);
  }
  const datos = trozo.subarray(0, leidos);
  if (datos.includes(0)) throw new Error('es un fichero binario (no texto): ' + fichero);
  return {
    fichero,
    bytes: leidos,
    bytes_totales: info.size,
    truncado: info.size > leidos,
    texto: datos.toString('utf8'),
  };
}
