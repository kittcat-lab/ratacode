/**
 * cliente-http-tope — verifica el tope de tareas/hora por HTTP.
 * Llama run_task 31 veces (sin clave, así cada una cae en la verja de clave
 * DESPUÉS del chequeo de tope) y comprueba que la 31.ª se rechaza con el
 * mensaje de tope. Demuestra que el límite es global y se aplica sobre HTTP.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolverCasa } from '../lib/casa.js';

const casa = resolverCasa(process.argv[2]);
const puerto = Number(process.argv[3] ?? '3103');
const clave = readFileSync(join(casa, 'mcp', 'http-secret.txt'), 'utf8').trim();
const url = 'http://127.0.0.1:' + puerto + '/mcp/' + clave;

const cliente = new Client({ name: 'prueba-tope', version: '0.0.1' });
await cliente.connect(new StreamableHTTPClientTransport(new URL(url)));

let ultimo = null;
let conTope = 0;
for (let i = 1; i <= 31; i += 1) {
  const r = await cliente.callTool({ name: 'run_task', arguments: { prompt: 'x' + i, provider: 'b-ai', model: 'deepseek-v4.1-flash' } });
  const texto = r?.content?.find((b) => b.type === 'text')?.text ?? '';
  ultimo = texto;
  if (/tope de tareas/i.test(texto)) conTope += 1;
  if (i <= 2 || i >= 30) process.stdout.write('llamada ' + i + ': ' + texto.replace(/\n/g, ' ') + '\n');
}
process.stdout.write('\nllamadas con mensaje de tope: ' + conTope + '\n');
process.stdout.write('último mensaje: ' + ultimo.replace(/\n/g, ' ') + '\n');
await cliente.close();
process.exit(0);
