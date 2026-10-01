#!/usr/bin/env node
/**
 * R32 · LOS ENCHUFES DE SERIE.
 *
 * Arranca `bin/ratacode.js` contra un puerto OCUPADO (prepara la casa y para
 * antes del motor, como parche.test) y mira los ficheros que deja:
 *   A · casa nueva: navegador, reloj, agenda y preguntar en los dos perfiles,
 *       una vez cada uno, dentro de un «- insert:»; codex sin instalar no se pone;
 *   B · segundo arranque: no duplica nada;
 *   C · con el paquete de codex en el perfil: se pone su fila y el
 *       pnpm-workspace.yaml fuerza @openai/codex 0.160.0;
 *   D · una fila del usuario con el mismo id manda: no se toca ni se duplica;
 *   E · apagado en settings.yaml: el cordis.patch.yml no se toca y el parche de
 *       arranque lleva `disabled: true` para ese id.
 * Con RATACODE_SIN_INSTALAR=1: nada de pnpm ni red.
 *
 * Uso: node pruebas/enchufes.test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const CASA = join(PRODUCTO, '_pruebaR32-enchufes');
const CASA_USUARIO = join(PRODUCTO, '_pruebaR32-enchufes-usuario');
const TALLER = join(PRODUCTO, '_pruebaR32-enchufes-taller');
const PUERTO_OCUPADO = 3335;
const yaml = createRequire(import.meta.url)('js-yaml');

const fallos = [];
function comprobar(condicion, queja) {
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
/** Cuántas veces sale cada id (también dentro de los insert), o null si el YAML está roto. */
function cuentaIds(ruta) {
  let filas;
  try { filas = yaml.load(readFileSync(ruta, 'utf8')); } catch { return null; }
  if (!Array.isArray(filas)) return null;
  const cuenta = {};
  for (const f of filas) {
    for (const x of [f, ...(Array.isArray(f?.insert) ? f.insert : [])]) if (x?.id) cuenta[x.id] = (cuenta[x.id] ?? 0) + 1;
  }
  return cuenta;
}
const DE_SERIE = ['mcp-navegador', 'time-context', 'schedule', 'tool-ask-user'];

const servidor = createServer().listen(PUERTO_OCUPADO, '127.0.0.1');
await new Promise((r) => servidor.once('listening', r));
for (const d of [CASA, CASA_USUARIO, TALLER]) rmSync(d, { recursive: true, force: true });
mkdirSync(TALLER, { recursive: true });

try {
  // A
  let salida = await arrancar(CASA);
  for (const perfil of ['web', 'headless']) {
    const c = cuentaIds(parche(CASA, perfil));
    comprobar(c !== null, `A · ${perfil}: el cordis.patch.yml es YAML válido`);
    comprobar(DE_SERIE.every((id) => c?.[id] === 1), `A · ${perfil}: ${DE_SERIE.join(', ')} una vez cada uno`);
    comprobar(c?.['agent-presets'] === 1, `A · ${perfil}: la capa de presets sigue, una vez`);
    comprobar(!c?.['tool-subagent-codex'] && !c?.['tool-subagent-claude'] && !c?.['agent-team'],
      `A · ${perfil}: sin paquete no hay fila de codex, ni claude ni equipos (apagados de fábrica)`);
  }
  comprobar(/enchufes \(web\): puestos navegador, reloj, agenda, preguntar · SIN INSTALAR codex/.test(salida), 'A · la salida dice qué se puso y qué falta');

  // B
  await arrancar(CASA);
  const b = cuentaIds(parche(CASA, 'web'));
  comprobar(DE_SERIE.every((id) => b?.[id] === 1), 'B · segundo arranque: nada duplicado');

  // C
  const codex = join(CASA, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-subagent-codex');
  mkdirSync(codex, { recursive: true });
  writeFileSync(join(codex, 'package.json'), '{"name":"@deepseek-ai/dsh-subagent-codex","version":"0.1.5-rc.3"}\n');
  salida = await arrancar(CASA);
  comprobar(cuentaIds(parche(CASA, 'web'))?.['tool-subagent-codex'] === 1, 'C · con el paquete, la fila de codex está una vez');
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
  comprobar(cuentaIds(propio)?.['mcp-navegador'] === 1, 'D · lo que el usuario no tenía, sí se añade');

  // E
  appendFileSync(join(CASA, 'settings.yaml'), '\nratacode:\n  enchufes:\n    navegador: false\n    claude: true\n');
  const antes = readFileSync(parche(CASA, 'web'), 'utf8');
  salida = await arrancar(CASA);
  comprobar(readFileSync(parche(CASA, 'web'), 'utf8') === antes, 'E · apagar no reescribe el cordis.patch.yml');
  const apagado = join(CASA, 'perfiles-parche', 'web-enchufes.yml');
  const filasApagado = existsSync(apagado) ? yaml.load(readFileSync(apagado, 'utf8')) : null;
  comprobar(Array.isArray(filasApagado) && filasApagado.some((f) => f.id === 'mcp-navegador' && f.disabled === true),
    'E · el parche de arranque apaga mcp-navegador');
  comprobar(/apagados navegador/.test(salida) && /SIN INSTALAR claude/.test(salida), 'E · la salida dice lo apagado y que claude falta por instalar');
} finally {
  servidor.close();
  for (const d of [CASA, CASA_USUARIO, TALLER]) rmSync(d, { recursive: true, force: true });
}

process.stdout.write(fallos.length === 0 ? '\nENCHUFES: todo bien\n' : '\nENCHUFES: ' + fallos.length + ' fallo(s)\n');
process.exitCode = fallos.length === 0 ? 0 : 1;
