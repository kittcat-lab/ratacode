#!/usr/bin/env node
/**
 * PRUEBA DE LOS TOPES DE run_task CON LLAMADAS A LA VEZ · parte de `npm test`.
 *
 * Con `tareasPorHora: 1`, dos `run_task` lanzadas a la vez sólo pueden lanzar
 * UNA tarea. Antes el tope se miraba antes de las esperas (catálogo y
 * credencial) y las dos pasaban.
 *
 * El motor es de mentira (un guion que se queda quieto): aquí sólo se mira
 * cuántas tareas se lanzan.
 *
 * Uso: node pruebas/mcp-topes-carrera.test.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { montarServidor } from '../mcp/lib/servidor.js';

const PRODUCTO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}
const textoDe = (r) => r?.content?.find((b) => b.type === 'text')?.text ?? '';

const base = mkdtempSync(join(tmpdir(), 'ratacode-topes-'));
const casa = join(base, 'casa');
const taller = join(base, 'taller');
mkdirSync(casa, { recursive: true });
mkdirSync(taller, { recursive: true });

// La casa de fábrica, con el modelo por defecto en Ollama (sin clave: así no
// hace falta ningún almacén de claves) y una carpeta autorizada.
const fabrica = readFileSync(join(PRODUCTO, 'fabrica', 'settings.yaml'), 'utf8')
  .replace(/agent-default-model:\r?\n\s+provider: b-ai\r?\n\s+model: "deepseek-v4\.1-flash"/, 'agent-default-model:\n  provider: ollama\n  model: "qwen3:8b"');
writeFileSync(join(casa, 'settings.yaml'), fabrica + '\nmcp:\n  workspaces:\n    - \'' + taller + '\'\n');

// Un «motor» que no hace nada durante unos segundos.
const motorFalso = join(base, 'motor-falso.mjs');
writeFileSync(motorFalso, 'setTimeout(() => {}, 4000);\n');

const { servidor, tareas } = montarServidor({ casa, dshBin: motorFalso, cwdPorDefecto: taller, tareasPorHora: 1 });
const [lado1, lado2] = InMemoryTransport.createLinkedPair();
await servidor.connect(lado1);
const cliente = new Client({ name: 'prueba-topes', version: '0.0.1' });
await cliente.connect(lado2);

try {
  const [a, b] = await Promise.all([
    cliente.callTool({ name: 'run_task', arguments: { prompt: 'uno' } }),
    cliente.callTool({ name: 'run_task', arguments: { prompt: 'dos' } }),
  ]);
  const textos = [textoDe(a), textoDe(b)];
  const lanzadas = textos.filter((t) => /"task_id"/.test(t)).length;
  const conTope = textos.filter((t) => /tope de tareas/i.test(t)).length;
  comprobar(lanzadas === 1, 'de dos llamadas a la vez con tope 1/h, se lanza UNA (se lanzaron ' + lanzadas + ')');
  comprobar(conTope === 1, 'y la otra dice que se alcanzó el tope');
} finally {
  for (const t of tareas.listar()) await tareas.cancelar(t.task_id).catch(() => {});
  await cliente.close();
  rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

if (fallos.length > 0) {
  process.stdout.write('\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
  process.exit(1);
}
process.stdout.write('\nVERDE · los topes de run_task aguantan llamadas a la vez: ' + cuantas + ' comprobaciones.\n');
process.exit(0);
