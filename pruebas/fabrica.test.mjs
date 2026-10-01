#!/usr/bin/env node
/**
 * LA FÁBRICA EN CRLF · parte de `npm test`.
 *
 * En una copia de Windows con `core.autocrlf`, `fabrica/settings.yaml` llega con
 * CRLF. Al estrenar una casa con una clave en el entorno, RATACODE reescribe el
 * bloque `agent-default-model:` buscando `\n`; con `\r\n` no lo encontraba, lo
 * añadía otra vez al final y la casa quedaba con la clave REPETIDA: YAML
 * inválido («duplicated mapping key»), así que el importador lo dejaba sin
 * pasar al perfil y el panel arrancaba sin el modelo elegido.
 *
 *   A · el repositorio: la fábrica sin CR, y `.gitattributes` fuerza LF en YAML;
 *   B · un RATACODE con la fábrica en CRLF (copia del paquete en una carpeta
 *       temporal) estrena una casa con OPENROUTER_API_KEY: el modelo elegido
 *       queda UNA vez y el perfil web lo lleva;
 *   C · una casa ya rota por la 0.2.9 (la clave dos veces) se importa igual:
 *       gana la última, que es la que eligió RATACODE.
 *
 * Arranca contra un puerto OCUPADO: prepara la casa y para antes del motor.
 * Uso: node pruebas/fabrica.test.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const PUERTO_OCUPADO = 3336;
const yaml = createRequire(import.meta.url)('js-yaml');
const ESQUEMA = yaml.DEFAULT_SCHEMA.extend([new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: () => null })]);

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

function arrancar(producto, casa, taller, extra = {}) {
  const env = { ...process.env, RATACODE_SIN_INSTALAR: '1', ...extra };
  return new Promise((listo, rechaza) => {
    const hijo = spawn(process.execPath, [join(producto, 'bin', 'ratacode.js'),
      '--port', String(PUERTO_OCUPADO), '--home', casa, '--carpeta', taller], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '';
    hijo.stdout.on('data', (t) => { salida += t; });
    hijo.stderr.on('data', (t) => { salida += t; });
    hijo.on('error', rechaza);
    hijo.on('exit', () => listo(salida));
  });
}

/** Las veces que sale una clave de primer nivel en un texto YAML. */
const vecesClave = (texto, clave) => (texto.match(new RegExp('^' + clave + ':', 'gm')) ?? []).length;
/** La fila `agent-default-model` del parche del perfil web. */
function modeloDelPerfil(casa) {
  const filas = yaml.load(readFileSync(join(casa, 'profiles', 'web', 'cordis.patch.yml'), 'utf8'), { schema: ESQUEMA }) ?? [];
  return filas.find((f) => f?.id === 'agent-default-model')?.config ?? null;
}

const base = mkdtempSync(join(tmpdir(), 'ratacode-fabrica-'));
const servidor = createServer().listen(PUERTO_OCUPADO, '127.0.0.1');
await new Promise((r) => servidor.once('listening', r));
try {
  // A
  const fabrica = readFileSync(join(PRODUCTO, 'fabrica', 'settings.yaml'), 'utf8');
  comprobar(!fabrica.includes('\r'), 'A · fabrica/settings.yaml va con LF en el repositorio');
  comprobar(vecesClave(fabrica, 'agent-default-model') === 1, 'A · y con `agent-default-model` una sola vez');
  const atributos = spawnSync('git', ['check-attr', 'eol', '--', 'fabrica/settings.yaml', 'piel/cordis.patch.yml'], { cwd: PRODUCTO, encoding: 'utf8' });
  if (atributos.status === 0) {
    comprobar(/settings\.yaml: eol: lf/.test(atributos.stdout) && /cordis\.patch\.yml: eol: lf/.test(atributos.stdout),
      'A · .gitattributes fuerza LF en los YAML (también con core.autocrlf)');
  } else {
    process.stdout.write('(sin git: no miro .gitattributes)\n');
  }

  // B · una copia de RATACODE con la fábrica en CRLF
  const copia = join(base, 'ratacode');
  for (const d of ['bin', 'fabrica', 'mcp', 'piel', 'modos', 'apreton']) cpSync(join(PRODUCTO, d), join(copia, d), { recursive: true });
  cpSync(join(PRODUCTO, 'package.json'), join(copia, 'package.json'));
  symlinkSync(join(PRODUCTO, 'node_modules'), join(copia, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(join(copia, 'fabrica', 'settings.yaml'), fabrica.replace(/\r?\n/g, '\r\n'));
  const taller = join(base, 'taller');
  mkdirSync(taller, { recursive: true });
  const casa = join(base, 'casa');
  const salida = await arrancar(copia, casa, taller, { OPENROUTER_API_KEY: 'x', B_AI_API_KEY: '', DEEPSEEK_API_KEY: '' });
  const importado = join(casa, 'settings.yaml.imported');
  comprobar(existsSync(importado), 'B · la casa se estrena y su settings.yaml se importa: ' + (salida.match(/RATACODE · ajustes: .*/)?.[0] ?? '(no lo dice)'));
  const sinImportar = join(casa, 'settings.yaml');
  const texto = readFileSync(existsSync(importado) ? importado : sinImportar, 'utf8');
  comprobar(vecesClave(texto, 'agent-default-model') === 1, 'B · `agent-default-model` una sola vez (con CRLF salía dos)');
  let valido = true;
  try { yaml.load(texto); } catch { valido = false; }
  comprobar(valido, 'B · el settings.yaml de la casa es YAML válido');
  comprobar(modeloDelPerfil(casa)?.provider === 'openrouter', 'B · el perfil web lleva el modelo del proveedor con clave (openrouter)');

  // C · una casa que ya dejó rota la 0.2.9
  const rota = join(base, 'casa-rota');
  mkdirSync(rota, { recursive: true });
  writeFileSync(join(rota, 'settings.yaml'), 'agent-default-model:\r\n  provider: b-ai\r\n  model: "deepseek-v4.1-flash"\r\n'
    + 'permission:\r\n  defaultPreset: danger-full-access\r\n\nagent-default-model:\n  provider: openrouter\n  model: "qwen/qwen3.8-flash"\n');
  await arrancar(PRODUCTO, rota, taller);
  comprobar(existsSync(join(rota, 'settings.yaml.imported')), 'C · la casa rota se importa (antes: «no lo puedo leer, no lo toco»)');
  comprobar(modeloDelPerfil(rota)?.provider === 'openrouter', 'C · gana el último `agent-default-model`, el que eligió RATACODE');
} finally {
  servidor.close();
  rmSync(base, { recursive: true, force: true });
}

process.stdout.write(fallos.length === 0
  ? '\nVERDE · la fábrica en CRLF ya no rompe la casa: ' + cuantas + ' comprobaciones.\n'
  : '\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
process.exitCode = fallos.length === 0 ? 0 : 1;
