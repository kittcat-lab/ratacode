#!/usr/bin/env node
/**
 * ESTRENAR UNA CASA CON UNA CLAVE EN EL ENTORNO NO PUEDE ROMPER EL settings.yaml.
 *
 * El fallo (5-oct-2026): con `B_AI_API_KEY` puesta, `bin/ratacode.js` añadía
 * OTRO bloque `agent-default-model:` al final del `settings.yaml` de la casa
 * nueva en vez de sustituir el de fábrica (la fábrica viene en CRLF y la
 * búsqueda del bloque sólo entendía LF) → el motor se caía con
 *   «settings-file: invalid document … DUPLICATE_KEY»
 *
 * Esta prueba estrena una casa de verdad con la variable puesta y mira el
 * fichero: YAML válido y cada bloque UNA sola vez. Como en `parche.test.mjs`,
 * se arranca contra un puerto OCUPADO para que prepare la casa y pare ahí.
 *
 * Uso: node pruebas/estreno.test.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const CASA = join(PRODUCTO, '_prueba-estreno');
const TALLER = join(PRODUCTO, '_prueba-estreno-taller');
const PUERTO_OCUPADO = 3334;

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const fallos = [];
const di = (t) => process.stdout.write(t + '\n');
function comprobar(condicion, queja) {
  if (!condicion) fallos.push(queja);
  di((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja);
  return condicion;
}

/** Arranca RATACODE con SÓLO la clave de b-ai en el entorno (una de mentira). */
function estrenar() {
  const entorno = { ...process.env, B_AI_API_KEY: 'clave-de-mentira' };
  delete entorno.OPENROUTER_API_KEY;
  delete entorno.DEEPSEEK_API_KEY;
  return new Promise((listo, rechaza) => {
    const hijo = spawn(process.execPath, [
      join(PRODUCTO, 'bin', 'ratacode.js'), '--port', String(PUERTO_OCUPADO), '--home', CASA, '--carpeta', TALLER,
    ], { cwd: PRODUCTO, env: entorno, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '';
    hijo.stdout.setEncoding('utf8');
    hijo.stderr.setEncoding('utf8');
    hijo.stdout.on('data', (t) => { salida += t; });
    hijo.stderr.on('data', (t) => { salida += t; });
    hijo.on('error', rechaza);
    hijo.on('exit', () => listo(salida));
  });
}

const veces = (texto, clave) => (texto.match(new RegExp('^' + clave + ':', 'gm')) ?? []).length;

async function main() {
  rmSync(CASA, { recursive: true, force: true });
  rmSync(TALLER, { recursive: true, force: true });
  mkdirSync(TALLER, { recursive: true });

  const ocupado = createServer(() => {});
  await new Promise((listo) => ocupado.listen(PUERTO_OCUPADO, '127.0.0.1', listo));

  try {
    di('Estrenar una casa con B_AI_API_KEY puesta');
    const salida = await estrenar();
    const texto = readFileSync(join(CASA, 'settings.yaml'), 'utf8');
    let ajustes = null;
    try { ajustes = yaml.load(texto); } catch (e) { di('     ' + String(e.message).split('\n')[0]); }
    comprobar(ajustes !== null, 'el settings.yaml de la casa nueva se lee como YAML');
    for (const clave of ['agent-default-model', 'agent-presets', 'locale']) {
      comprobar(veces(texto, clave) === 1, '`' + clave + ':` está UNA sola vez (' + veces(texto, clave) + ')');
    }
    comprobar(ajustes?.['agent-default-model']?.provider === 'b-ai', 'y el modelo por defecto es del proveedor con clave (b-ai)');
    comprobar(!/no lo toco/.test(salida), 'ningún paso posterior se queja de que no puede leerlo');
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
    di('VERDE · la casa recién estrenada tiene un settings.yaml válido y sin claves repetidas.');
  }
  process.exit(fallos.length === 0 ? 0 : 1);
}

await main();
