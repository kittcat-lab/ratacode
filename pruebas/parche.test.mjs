#!/usr/bin/env node
/**
 * R22 §0 · LA CASA QUE ACTUALIZA DESDE LA 0.1 NO PUEDE QUEDARSE MUERTA.
 *
 * El fallo publicado en la 0.2.0: al actualizar una casa vieja, `bin/ratacode.js`
 * añadía la capa `- id: agent-presets …` al final del `cordis.patch.yml` del
 * perfil, que traía `[]` (lista vacía en formato FLUJO) → YAML INVÁLIDO y el
 * motor se caía al parsear el overlay:
 *   «dsh: failed to parse overlay …: YAMLException: end of the stream or a
 *    document separator is expected (6:1)»
 *
 * Esta prueba escribe ese fichero roto (y los otros casos) en una casa de
 * verdad, arranca `bin/ratacode.js` —que es quien repara— y mira cómo queda el
 * fichero: tiene que ser YAML válido, con la capa UNA sola vez y sin perder ni
 * una fila del usuario. Para que el arranque no levante el motor, se le da un
 * puerto OCUPADO a propósito: el programa prepara la casa y para ahí.
 *
 * Uso: node pruebas/parche.test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
// R32 · sin instalar los enchufes con paquete (pnpm, red): eso lo mira enchufes.test.
process.env.RATACODE_SIN_INSTALAR = '1';
const CASA = join(PRODUCTO, '_pruebaR23-parche');
const TALLER = join(PRODUCTO, '_pruebaR23-parche-taller');
const PUERTO_OCUPADO = 3333;

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const fallos = [];
const di = (t) => process.stdout.write(t + '\n');
function comprobar(condicion, queja) {
  if (!condicion) fallos.push(queja);
  di((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja);
  return condicion;
}

/** El parche del perfil web de la casa de prueba. */
const PARCHE = () => join(CASA, 'profiles', 'web', 'cordis.patch.yml');

/**
 * Arranca RATACODE contra un puerto ocupado: prepara la casa (y con ella el
 * parche del perfil) y PARA antes de levantar el motor.
 * @returns la salida del programa.
 */
function prepararCasa() {
  return new Promise((listo, rechaza) => {
    const hijo = spawn(process.execPath, [
      join(PRODUCTO, 'bin', 'ratacode.js'), '--port', String(PUERTO_OCUPADO), '--home', CASA, '--carpeta', TALLER,
    ], { cwd: PRODUCTO, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '';
    hijo.stdout.setEncoding('utf8');
    hijo.stderr.setEncoding('utf8');
    hijo.stdout.on('data', (t) => { salida += t; });
    hijo.stderr.on('data', (t) => { salida += t; });
    hijo.on('error', rechaza);
    hijo.on('exit', () => listo(salida));
  });
}

/** Las filas del parche, o null si el YAML está roto (que es el fallo). */
function filas() {
  try {
    const cargado = yaml.load(readFileSync(PARCHE(), 'utf8'));
    return Array.isArray(cargado) ? cargado : null;
  } catch {
    return null;
  }
}

// DSH 0.2 · la capa es la fila del registro de modos; la de la 0.1.x (`agent-presets`) se quita.
const capas = (f) => (f ?? []).filter((x) => x !== null && typeof x === 'object' && x.id === 'agent-preset-registry');
const viejas = (f) => (f ?? []).filter((x) => x !== null && typeof x === 'object' && x.id === 'agent-presets');
const ids = (f) => (f ?? []).map((x) => (x !== null && typeof x === 'object' ? x.id : String(x)));

/** Escribe el parche de la casa ANTES de arrancar (como lo dejó la versión vieja). */
function escribirParche(texto) {
  mkdirSync(dirname(PARCHE()), { recursive: true });
  writeFileSync(PARCHE(), texto);
}

async function main() {
  rmSync(CASA, { recursive: true, force: true });
  rmSync(TALLER, { recursive: true, force: true });
  mkdirSync(TALLER, { recursive: true });

  const ocupado = createServer(() => {});
  await new Promise((listo) => ocupado.listen(PUERTO_OCUPADO, '127.0.0.1', listo));

  try {
    // ── caso 1 · el fallo publicado: `[]` pegado delante de la capa ─────────
    di('R22 §0 · el parche ROTO de la 0.2.0 (un `[]` delante de las filas)');
    escribirParche([
      '# Tu capa de parches de este perfil, aplicada después de cada capa de bundle:',
      '# una lista YAML de filas del cargador (config por id, desactivaciones, inserts).',
      '[]',
      '- id: agent-presets',
      '  config:',
      '    default: modo-rata',
      '    includeShippedRoot: false',
      '',
    ].join('\n'));
    let salida = await prepararCasa();
    let f = filas();
    comprobar(f !== null, 'el parche queda como YAML VÁLIDO (antes: «end of the stream or a document separator is expected»)');
    comprobar(capas(f).length === 1, 'y con la capa agent-preset-registry UNA sola vez (' + capas(f).length + ')');
    comprobar(viejas(f).length === 0, 'y sin la fila vieja agent-presets de la 0.1.x (' + viejas(f).length + ')');
    comprobar(/reparado/.test(salida), 'RATACODE dice que lo ha reparado');
    di('     ' + (salida.split(/\r?\n/).filter((l) => /reparad/.test(l))[0] ?? '(sin línea de reparación)'));

    // ── caso 2 · `[]` a secas: la capa sola, válida ─────────────────────────
    di('');
    di('R22 §0 · el parche vacío (`[]`, como lo deja DSH)');
    rmSync(CASA, { recursive: true, force: true });
    await prepararCasa();                    // estrena la casa y deja el parche de la plantilla
    escribirParche('[]\n');
    salida = await prepararCasa();
    f = filas();
    comprobar(f !== null && capas(f).length === 1, 'con `[]`, el parche queda válido y con la capa puesta');
    // DSH 0.2 · el parche es también donde viven los ajustes: RATACODE vuelve a
    // poner el aviso aceptado y el idioma si faltan, pero nada se repite.
    // R32 · los enchufes de serie van en sus propios bloques «- insert:» (sin id): no cuentan aquí.
    const sueltas = (f ?? []).filter((x) => !Array.isArray(x?.insert));
    comprobar(new Set(ids(sueltas)).size === ids(sueltas).length, 'y sin filas repetidas: ' + JSON.stringify(ids(sueltas)));

    // ── caso 3 · filas del usuario: se respetan ─────────────────────────────
    di('');
    di('R22 §0 · el parche con filas DEL USUARIO');
    escribirParche([
      '# lo mío',
      '- id: mi-experimento',
      '  disabled: true',
      '',
    ].join('\n'));
    await prepararCasa();
    f = filas();
    comprobar(f !== null, 'sigue siendo YAML válido');
    comprobar(ids(f).includes('mi-experimento'), 'la fila del usuario sigue ahí: ' + JSON.stringify(ids(f)));
    comprobar(capas(f).length === 1, 'y la capa va UNA vez, al final');

    // ── caso 4 · arrancar otra vez no duplica ───────────────────────────────
    di('');
    di('R22 §0 · arrancar dos veces');
    await prepararCasa();
    const f2 = filas();
    comprobar(ids(f2).length === ids(f).length && capas(f2).length === 1,
      'no se duplica nada al volver a arrancar: ' + JSON.stringify(ids(f2)));

    // ── caso 5 · el fichero que no se puede leer: NO se toca ────────────────
    di('');
    di('R22 §0 · un parche que no es una lista de filas');
    escribirParche('esto: no es una lista\n');
    const antes = readFileSync(PARCHE(), 'utf8');
    await prepararCasa();
    comprobar(readFileSync(PARCHE(), 'utf8') === antes, 'lo que no se entiende se deja como estaba (no se pisa a ciegas)');
  } finally {
    ocupado.close();
    rmSync(CASA, { recursive: true, force: true });
    rmSync(TALLER, { recursive: true, force: true });
  }

  di('');
  if (fallos.length > 0) {
    di('ROJO · ' + fallos.length + ' cosa(s) mal:');
    for (const queja of fallos) di('  · ' + queja);
  } else {
    di('VERDE · el parche del perfil queda SIEMPRE como YAML válido y la casa que actualiza arranca.');
  }
  process.exit(fallos.length === 0 ? 0 : 1);
}

await main();
