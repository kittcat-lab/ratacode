#!/usr/bin/env node
/**
 * dsh-con-huecos — el motor SIN el apagado de R26, para MEDIR el agujero.
 *
 * Esto no es un motor: es un envoltorio de prueba. Quita del parche de la tarea
 * las dos filas que apagan las lecturas que no pasan por ninguna herramienta
 * (las instrucciones `AGENTS.md` de las carpetas de arriba y las habilidades de
 * fuera) y arranca el motor DE VERDAD con ese parche. Así la prueba de R26 mide,
 * con el mismo montaje, el antes (el canario llega al modelo) y el después (no
 * llega).
 *
 * No va en el paquete: `files` de package.json no incluye `pruebas`.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const argumentos = process.argv.slice(2);
const rutaParche = argumentos[argumentos.indexOf('--patch') + 1];
const lineas = readFileSync(rutaParche, 'utf8').split('\n');

/** Quitar una fila `- id: X` con su `config:` y sus hijos. */
function sinLaFila(lineas, ids) {
  const salida = [];
  for (let i = 0; i < lineas.length; i += 1) {
    if (ids.some((id) => lineas[i] === '- id: ' + id)) {
      i += 1;
      while (i < lineas.length && /^ {2,}\S/.test(lineas[i])) i += 1;
      i -= 1;
      continue;
    }
    salida.push(lineas[i]);
  }
  return salida;
}

const nueva = join(dirname(rutaParche), 'sin-apagado-' + process.pid + '.yml');
writeFileSync(nueva, sinLaFila(lineas, ['agent-instructions', 'skill-filesystem']).join('\n'));

const requerir = createRequire(import.meta.url);
const manifiesto = requerir.resolve('@deepseek-ai/dsh/package.json');
const pkg = JSON.parse(readFileSync(manifiesto, 'utf8'));
const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.dsh;
const motor = join(dirname(manifiesto), rel);

const hijo = spawn(process.execPath, [motor, ...argumentos.map((a) => (a === rutaParche ? nueva : a))], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
hijo.on('exit', (codigo) => process.exit(codigo ?? 0));
