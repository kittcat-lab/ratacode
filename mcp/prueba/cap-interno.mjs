/**
 * cap-interno — demuestra el tope de tareas/hora sin necesidad de clave ni red.
 *
 * Arranca el servidor HTTP real con un `tareas.crear` sustituido (stub: no
 * lanza dsh) y un proveedor sin `apiKeyEnv`, así la verja de credencial no
 * bloquea y la tarea se "lanza" (cuenta). Llama run_task 31 veces y comprueba
 * que la 31.ª se rechaza con el mensaje de tope. Puerto 3104 (pruebas).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { montarServidor } from '../lib/servidor.js';
import { iniciarServidorHttp } from '../lib/http.js';
import { resolverCasa } from '../lib/casa.js';

const casa = resolverCasa(process.argv[2]);
const { tareas, fabricaServidor } = montarServidor({ casa, dshBin: 'x', cwdPorDefecto: process.cwd(), tareasPorHora: 30 });
// Stub: registrar la tarea pero NO lanzar el motor (evita red y procesos).
tareas.crear = function () { return { task_id: 'stub-' + Math.random().toString(36).slice(2), estado: 'running' }; };

// Generar la clave si no existe (igual que el bin: se guarda en la casa).
const rutaClave = join(casa, 'mcp', 'http-secret.txt');
let clave;
try { clave = readFileSync(rutaClave, 'utf8').trim(); } catch {
  clave = randomBytes(32).toString('hex');
  mkdirSync(join(casa, 'mcp'), { recursive: true });
  writeFileSync(rutaClave, clave + '\n');
}
const server = await iniciarServidorHttp({ fabricaServidor, puerto: 3104, clave, host: '127.0.0.1' });

const cliente = new Client({ name: 'cap-interno', version: '0.0.1' });
await cliente.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3104/mcp/' + clave)));

let conTope = 0;
let ultimo = null;
for (let i = 1; i <= 31; i += 1) {
  const r = await cliente.callTool({ name: 'run_task', arguments: { prompt: 'x' + i, provider: 'sin-clave', model: 'm1' } });
  const texto = r?.content?.find((b) => b.type === 'text')?.text ?? '';
  ultimo = texto;
  if (/tope de tareas/i.test(texto)) conTope += 1;
  if (i <= 2 || i >= 29) process.stdout.write('llamada ' + i + ': ' + texto.replace(/\n/g, ' ').slice(0, 80) + '\n');
}
process.stdout.write('\nllamadas con mensaje de tope: ' + conTope + '\n');
process.stdout.write('último mensaje: ' + ultimo.replace(/\n/g, ' ').slice(0, 120) + '\n');
await cliente.close();
server.close();
process.exit(0);
