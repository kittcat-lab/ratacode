#!/usr/bin/env node
/**
 * UNA SOLA VERSIÓN DEL MOTOR · parte de `npm test`.
 *
 * Con un paquete `@deepseek-ai/dsh*` en otra versión que la del motor, el motor
 * no arranca. Así que se mira, en los tres sitios donde se puede colar otra:
 *   1 · `package.json`: cada `@deepseek-ai/*` que declara RATACODE va FIJADO
 *       (sin ^ ni ~) a la versión del motor;
 *   2 · `package-lock.json`: cada `@deepseek-ai/dsh*` del árbol, en esa versión;
 *   3 · `node_modules`: lo instalado de verdad, igual.
 * Y que lo que `bin/enchufes.js` instala en los perfiles sea `@deepseek-ai/dsh*`
 * (se pide con la versión del motor instalado).
 *
 * Lo de `@deepseek-ai/*` que NO es `dsh*` (cordis, schemastery, cosmokit,
 * libreoffice-kit, node-addon-system…) son librerías con su propia numeración:
 * no tienen versión 0.2.0-rc.2 publicada y las fija el propio motor.
 *
 * Uso: node pruebas/versiones.test.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENCHUFES } from '../bin/enchufes.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

const pkg = leerJson(join(PRODUCTO, 'package.json'));
const motor = pkg.dependencies['@deepseek-ai/dsh'];
comprobar(/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(motor ?? ''), 'el motor va fijado a una versión exacta: ' + motor);

// 1
const declarados = Object.entries(pkg.dependencies).filter(([n]) => n.startsWith('@deepseek-ai/'));
for (const [nombre, version] of declarados) {
  comprobar(version === motor, 'package.json · ' + nombre + ' ' + version + (version === motor ? '' : ' (el motor es ' + motor + ')'));
}

// 2
const lock = leerJson(join(PRODUCTO, 'package-lock.json'));
const enLock = Object.entries(lock.packages ?? {}).filter(([ruta]) => /(^|\/)node_modules\/@deepseek-ai\/dsh[^/]*$/.test(ruta));
const distintosLock = enLock.filter(([, d]) => d.version !== motor);
comprobar(enLock.length > 0 && distintosLock.length === 0, 'package-lock.json · ' + enLock.length + ' paquetes @deepseek-ai/dsh*, todos en ' + motor
  + (distintosLock.length > 0 ? ' — distintos: ' + distintosLock.map(([r, d]) => r + '@' + d.version).join(', ') : ''));
for (const [nombre] of declarados) {
  comprobar(lock.packages?.['node_modules/' + nombre]?.version === motor, 'package-lock.json · ' + nombre + ' resuelto a ' + motor);
}

// 3
const raiz = join(PRODUCTO, 'node_modules', '@deepseek-ai');
if (existsSync(raiz)) {
  const instalados = readdirSync(raiz).filter((n) => n.startsWith('dsh'))
    .map((n) => [n, leerJson(join(raiz, n, 'package.json')).version]);
  const distintos = instalados.filter(([, v]) => v !== motor);
  comprobar(distintos.length === 0, 'node_modules · ' + instalados.length + ' paquetes @deepseek-ai/dsh* instalados, todos en ' + motor
    + (distintos.length > 0 ? ' — distintos: ' + distintos.map(([n, v]) => n + '@' + v).join(', ') : ''));
} else {
  comprobar(false, 'node_modules · no hay nada instalado (npm ci)');
}

// 4
const paquetes = ENCHUFES.flatMap((e) => e.paquetes ?? []);
comprobar(paquetes.length > 0 && paquetes.every((p) => /^@deepseek-ai\/dsh[^@]*$/.test(p)),
  'enchufes · lo que se instala en el perfil es @deepseek-ai/dsh* sin versión (se pide la del motor): ' + paquetes.join(', '));
const bundles = ENCHUFES.filter((e) => e.tipo === 'bundle').map((e) => e.bundle);
comprobar(bundles.every((b) => existsSync(join(raiz, b.split('/')[1], 'package.json'))),
  'enchufes · los bundles de serie vienen con el motor: ' + bundles.join(', '));

process.stdout.write(fallos.length === 0
  ? '\nVERDE · una sola versión del motor (' + motor + '): ' + cuantas + ' comprobaciones.\n'
  : '\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
process.exitCode = fallos.length === 0 ? 0 : 1;
