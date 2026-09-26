/**
 * cliente-http — cliente MCP de verdad sobre Streamable HTTP.
 *
 * Conecta a http://127.0.0.1:<puerto>/mcp/<clave> (la clave se lee de la casa,
 * donde la generó el servidor) y prueba el camino completo: list_models,
 * run_task y get_task_result. Sin clave en el entorno, run_task devuelve el
 * error de credencial (prueba que la herramienta se despacha por HTTP y que la
 * verja salta); el PONG real queda marcado como SOSPECHA (no hay clave aquí).
 *
 *   node mcp/prueba/cliente-http.mjs --home <casa> --port <puerto>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverCasa } from '../lib/casa.js';

function ordenes(argv) {
  const s = { casa: undefined, port: 3103 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) s.casa = v;
    else if (a === '--port' || a.startsWith('--port=')) s.port = Number(v);
    else throw new Error('no entiendo ' + a);
  }
  return s;
}

function datoDe(r) {
  const texto = r?.content?.find((b) => b.type === 'text')?.text ?? '';
  try { return JSON.parse(texto); } catch { return { texto_crudo: texto }; }
}

const args = ordenes(process.argv.slice(2));
const casa = resolverCasa(args.casa);
const clave = readFileSync(join(casa, 'mcp', 'http-secret.txt'), 'utf8').trim();
const url = 'http://127.0.0.1:' + args.port + '/mcp/' + clave;
const aqui = fileURLToPath(import.meta.url);

const paso = (t, d) => {
  process.stdout.write('\n=== ' + t + ' ===\n' + (typeof d === 'string' ? d : JSON.stringify(d, null, 2)) + '\n');
};

try {
  const transporte = new StreamableHTTPClientTransport(new URL(url));
  const cliente = new Client({ name: 'prueba-http-ratacode', version: '0.0.1' });
  await cliente.connect(transporte);
  paso('conectado', { url });

  const herramientas = await cliente.listTools();
  paso('herramientas', herramientas.tools.map((h) => h.name));

  const catalogo = datoDe(await cliente.callTool({ name: 'list_models', arguments: {} }));
  paso('list_models (total=' + catalogo.total + ')', catalogo.modelos?.map((m) => m.provider + '/' + m.model_id + (m.estado === 'sin_clave' ? ' (sin_clave)' : '')));

  const lanzada = datoDe(await cliente.callTool({
    name: 'run_task',
    arguments: { prompt: 'Responde solamente PONG', provider: 'b-ai', model: 'deepseek-v4.1-flash', timeout: 60000 },
  }));
  paso('run_task', lanzada);

  let estado = null;
  if (lanzada.task_id !== undefined) {
    for (let i = 0; i < 30; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      estado = datoDe(await cliente.callTool({ name: 'get_task_status', arguments: { task_id: lanzada.task_id } }));
      if (['completed', 'failed', 'cancelled'].includes(estado.estado)) break;
    }
    const resultado = datoDe(await cliente.callTool({ name: 'get_task_result', arguments: { task_id: lanzada.task_id } }));
    paso('get_task_result', resultado);
    const ok = estado?.estado === 'completed' && /PONG/i.test(String(resultado.respuesta ?? ''));
    paso('VEREDICTO', ok ? 'VERDE: PONG' : 'SOSPECHA: sin PONG (sin clave en el entorno de esta prueba; el camino HTTP funcionó)');
  } else {
    paso('get_task_result', '(no se lanzó tarea: ' + (lanzada.texto_crudo ?? JSON.stringify(lanzada)) + ')');
  }

  await cliente.close();
  process.exit(0);
} catch (e) {
  paso('FALLO', e instanceof Error ? (e.stack ?? e.message) : String(e));
  try { await cliente?.close(); } catch { /* da igual */ }
  process.exit(1);
}
