#!/usr/bin/env node
/**
 * R32 · LOS ENCHUFES DE SERIE (rehecha para DSH 0.2 en la 0.3) · parte de `npm test`.
 *
 * Arranca `bin/ratacode.js` contra un puerto OCUPADO (prepara la casa y para
 * antes del motor, como parche.test) y mira los ficheros que deja:
 *   A · casa nueva: reloj, agenda y preguntar en el perfil web, una vez cada
 *       uno y dentro de un «- insert:»; en headless reloj y preguntar (la agenda
 *       es sólo del panel); navegador y codex sin instalar no se ponen; la voz,
 *       seleccionada como bundle del perfil web; equipos no; la telemetría del
 *       motor, apagada; y `ratacode.yaml` enseña los interruptores;
 *   B · segundo arranque: no duplica nada;
 *   C · con los paquetes en el perfil: navegador y codex se ponen, y el
 *       pnpm-workspace.yaml fuerza @openai/codex;
 *   D · una fila del usuario con el mismo id manda: no se toca ni se duplica;
 *   E · apagados en ratacode.yaml: el cordis.patch.yml no se toca, el parche de
 *       arranque lleva `disabled: true` (también la terminal, que la monta el
 *       motor) y la voz sale de los bundles;
 *   F · la voz quitada en la página Plugins (sin decir nada en ratacode.yaml)
 *       no se vuelve a poner;
 *   G · una casa de la 0.2.9 con `ratacode.enchufes` en settings.yaml: pasa a
 *       ratacode.yaml y no acaba como fila del motor;
 *   H · la telemetría encendida a mano en el panel se queda encendida.
 * Con RATACODE_SIN_INSTALAR=1: nada de pnpm ni red.
 *
 * Uso: node pruebas/enchufes.test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const CASA = join(PRODUCTO, '_pruebaR32-enchufes');
const CASA_USUARIO = join(PRODUCTO, '_pruebaR32-enchufes-usuario');
const CASA_VIEJA = join(PRODUCTO, '_pruebaR32-enchufes-029');
const TALLER = join(PRODUCTO, '_pruebaR32-enchufes-taller');
const PUERTO_OCUPADO = 3335;
const VOZ = '@deepseek-ai/dsh-experimental-voice-input-bundle';
const EQUIPOS = '@deepseek-ai/dsh-experimental-agent-team-profile';
const yaml = createRequire(import.meta.url)('js-yaml');
const ESQUEMA = yaml.DEFAULT_SCHEMA.extend([new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: () => null })]);

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

function arrancar(casa) {
  const env = { ...process.env, RATACODE_SIN_INSTALAR: '1' };
  // Sin claves: así el estreno no reescribe el modelo por defecto.
  for (const k of ['B_AI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY']) delete env[k];
  return new Promise((listo, rechaza) => {
    const hijo = spawn(process.execPath, [join(PRODUCTO, 'bin', 'ratacode.js'),
      '--port', String(PUERTO_OCUPADO), '--home', casa, '--carpeta', TALLER], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '';
    hijo.stdout.on('data', (t) => { salida += t; });
    hijo.stderr.on('data', (t) => { salida += t; });
    hijo.on('error', rechaza);
    hijo.on('exit', () => listo(salida));
  });
}

const parche = (casa, perfil) => join(casa, 'profiles', perfil, 'cordis.patch.yml');
const leer = (ruta) => yaml.load(readFileSync(ruta, 'utf8'), { schema: ESQUEMA });
const bundles = (casa) => JSON.parse(readFileSync(join(casa, 'profiles', 'web', 'package.json'), 'utf8')).dsh.profile.bundles;
/** Cuántas veces sale cada id (también dentro de los insert), o null si el YAML está roto. */
function cuentaIds(ruta) {
  let filas;
  try { filas = leer(ruta); } catch { return null; }
  if (!Array.isArray(filas)) return null;
  const cuenta = {};
  for (const f of filas) {
    for (const x of [f, ...(Array.isArray(f?.insert) ? f.insert : [])]) if (x?.id) cuenta[x.id] = (cuenta[x.id] ?? 0) + 1;
  }
  return cuenta;
}
/** Un paquete de mentira en el node_modules del perfil (como si pnpm ya lo hubiera puesto). */
function fingirPaquete(casa, perfil, nombre) {
  const carpeta = join(casa, 'profiles', perfil, 'node_modules', ...nombre.split('/'));
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'package.json'), JSON.stringify({ name: nombre, version: '0.2.0-rc.2' }) + '\n');
}
const DE_SERIE = { web: ['time-context', 'schedule', 'tool-ask-user'], headless: ['time-context', 'tool-ask-user'] };

const servidor = createServer().listen(PUERTO_OCUPADO, '127.0.0.1');
await new Promise((r) => servidor.once('listening', r));
for (const d of [CASA, CASA_USUARIO, CASA_VIEJA, TALLER]) rmSync(d, { recursive: true, force: true });
mkdirSync(TALLER, { recursive: true });

try {
  // A
  let salida = await arrancar(CASA);
  for (const perfil of ['web', 'headless']) {
    const c = cuentaIds(parche(CASA, perfil));
    comprobar(c !== null, `A · ${perfil}: el cordis.patch.yml es YAML válido`);
    comprobar(DE_SERIE[perfil].every((id) => c?.[id] === 1), `A · ${perfil}: ${DE_SERIE[perfil].join(', ')} una vez cada uno`);
    comprobar(c?.['agent-preset-registry'] === 1, `A · ${perfil}: la capa de presets sigue, una vez`);
    comprobar(!c?.['browser-use'] && !c?.['tool-subagent-codex'] && !c?.['tool-subagent-claude'],
      `A · ${perfil}: sin paquete no hay fila de navegador ni de codex (ni de claude, apagado de fábrica)`);
  }
  comprobar(!cuentaIds(parche(CASA, 'headless'))?.schedule, 'A · headless: sin agenda (sin pantalla no hay sessionController)');
  const tele = leer(parche(CASA, 'web')).find((f) => f?.id === 'session-log-deepseek');
  comprobar(tele?.config?.enabled === false, 'A · web: la telemetría del motor (session-log-deepseek) apagada de serie');
  comprobar(bundles(CASA).includes(VOZ) && !bundles(CASA).includes(EQUIPOS), 'A · web: la voz seleccionada como bundle; equipos no');
  comprobar(/^# enchufes:/m.test(readFileSync(join(CASA, 'ratacode.yaml'), 'utf8')), 'A · ratacode.yaml enseña los interruptores (comentados)');
  comprobar(!existsSync(join(CASA, 'perfiles-parche', 'web-enchufes.yml')), 'A · nada apagado: sin parche de arranque');
  comprobar(/enchufes \(web\): puestos reloj, agenda, preguntar, voz · SIN INSTALAR navegador, codex/.test(salida), 'A · la salida dice qué se puso y qué falta');
  comprobar(/telemetría del motor \(Upload Session Log\): apagada de serie/.test(salida), 'A · la salida dice que la telemetría va apagada');

  // B
  await arrancar(CASA);
  const b = cuentaIds(parche(CASA, 'web'));
  comprobar(DE_SERIE.web.every((id) => b?.[id] === 1) && b?.['session-log-deepseek'] === 1, 'B · segundo arranque: nada duplicado');
  comprobar(bundles(CASA).filter((x) => x === VOZ).length === 1, 'B · la voz, una vez en los bundles');

  // C
  for (const p of ['@deepseek-ai/dsh-subagent-codex', '@deepseek-ai/dsh-browser-use', '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp']) {
    fingirPaquete(CASA, 'web', p);
  }
  salida = await arrancar(CASA);
  const cc = cuentaIds(parche(CASA, 'web'));
  comprobar(cc?.['tool-subagent-codex'] === 1 && cc?.['browser-use'] === 1 && cc?.['browser-use-playwright'] === 1,
    'C · con los paquetes, las filas de codex y del navegador están una vez');
  const navegador = leer(parche(CASA, 'web')).flatMap((f) => f?.insert ?? []).find((f) => f.id === 'browser-use-playwright');
  comprobar(navegador?.config?.mode === 'launch' && navegador?.config?.headless === false, 'C · el navegador del panel se lanza con ventana');
  const ws = yaml.load(readFileSync(join(CASA, 'profiles', 'web', 'pnpm-workspace.yaml'), 'utf8'));
  comprobar(ws?.overrides?.['@openai/codex'] === '0.160.0' && ws?.nodeLinker === 'hoisted', 'C · pnpm-workspace.yaml fuerza @openai/codex 0.160.0 y conserva lo que tenía');

  // D
  const propio = parche(CASA_USUARIO, 'web');
  mkdirSync(dirname(propio), { recursive: true });
  writeFileSync(propio, '# mi reloj\n- insert:\n    - id: time-context\n      name: \'@deepseek-ai/dsh-time-context\'\n      config:\n        timeZone: America/Lima\n');
  await arrancar(CASA_USUARIO);
  const texto = readFileSync(propio, 'utf8');
  comprobar(cuentaIds(propio)?.['time-context'] === 1 && texto.includes('America/Lima') && !texto.includes('Europe/Madrid'),
    'D · la fila del usuario manda: su reloj sigue y no se duplica');
  comprobar(cuentaIds(propio)?.['tool-ask-user'] === 1, 'D · lo que el usuario no tenía, sí se añade');

  // E
  writeFileSync(join(CASA, 'ratacode.yaml'), readFileSync(join(CASA, 'ratacode.yaml'), 'utf8')
    + '\nenchufes:\n  reloj: false\n  navegador: false\n  terminal: false\n  voz: false\n  claude: true\n');
  const antes = readFileSync(parche(CASA, 'web'), 'utf8');
  salida = await arrancar(CASA);
  comprobar(readFileSync(parche(CASA, 'web'), 'utf8') === antes, 'E · apagar no reescribe el cordis.patch.yml');
  const apagado = join(CASA, 'perfiles-parche', 'web-enchufes.yml');
  const filasApagado = existsSync(apagado) ? leer(apagado) : null;
  const apagadas = new Set((filasApagado ?? []).filter((f) => f.disabled === true).map((f) => f.id));
  comprobar(['time-context', 'browser-use', 'browser-use-playwright', 'ui-sidebar-terminal'].every((id) => apagadas.has(id)),
    'E · el parche de arranque apaga reloj, navegador y la terminal del motor: ' + [...apagadas].join(', '));
  comprobar(!bundles(CASA).includes(VOZ), 'E · la voz sale de los bundles del perfil');
  comprobar(/apagados navegador, reloj, voz, terminal/.test(salida) && /SIN INSTALAR claude/.test(salida),
    'E · la salida dice lo apagado y que claude falta por instalar');
  const apagadoHeadless = join(CASA, 'perfiles-parche', 'headless-enchufes.yml');
  comprobar(existsSync(apagadoHeadless) && leer(apagadoHeadless).some((f) => f.id === 'time-context' && f.disabled === true),
    'E · también en headless');

  // F
  writeFileSync(join(CASA, 'ratacode.yaml'), '# sin opiniones\n');
  await arrancar(CASA);
  comprobar(!bundles(CASA).includes(VOZ), 'F · la voz que ya se ofreció una vez y no está (quitada en Plugins) no se vuelve a poner');
  comprobar(!existsSync(apagado), 'F · sin nada apagado, el parche de arranque se va');
  writeFileSync(join(CASA, 'ratacode.yaml'), 'enchufes:\n  voz: true\n');
  await arrancar(CASA);
  comprobar(bundles(CASA).includes(VOZ), 'F · con `voz: true` explícito, vuelve');

  // G
  mkdirSync(CASA_VIEJA, { recursive: true });
  writeFileSync(join(CASA_VIEJA, 'settings.yaml'), 'permission:\n  defaultPreset: danger-full-access\n'
    + 'ratacode:\n  enchufes:\n    agenda: false\n');
  salida = await arrancar(CASA_VIEJA);
  const viejo = yaml.load(readFileSync(join(CASA_VIEJA, 'ratacode.yaml'), 'utf8'));
  comprobar(viejo?.enchufes?.agenda === false, 'G · `ratacode.enchufes` de la 0.2.9 pasa a ratacode.yaml');
  comprobar(!cuentaIds(parche(CASA_VIEJA, 'web'))?.ratacode, 'G · y no acaba como fila del motor');
  comprobar(!cuentaIds(parche(CASA_VIEJA, 'web'))?.schedule, 'G · y se respeta: sin agenda');

  // H
  const encendida = readFileSync(parche(CASA_USUARIO, 'web'), 'utf8')
    .replace(/(- id: session-log-deepseek\n\s+config:\n\s+enabled:) false/, '$1 true');
  writeFileSync(parche(CASA_USUARIO, 'web'), encendida);
  salida = await arrancar(CASA_USUARIO);
  const t = leer(parche(CASA_USUARIO, 'web')).filter((f) => f?.id === 'session-log-deepseek');
  comprobar(t.length === 1 && t[0].config?.enabled === true, 'H · la telemetría encendida a mano se queda encendida (y una sola fila)');
  comprobar(/Upload Session Log\): ENCENDIDA/.test(salida), 'H · y la salida lo dice');
} finally {
  servidor.close();
  for (const d of [CASA, CASA_USUARIO, CASA_VIEJA, TALLER]) rmSync(d, { recursive: true, force: true });
}

process.stdout.write(fallos.length === 0
  ? '\nVERDE · los enchufes de serie: ' + cuantas + ' comprobaciones.\n'
  : '\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
process.exitCode = fallos.length === 0 ? 0 : 1;
