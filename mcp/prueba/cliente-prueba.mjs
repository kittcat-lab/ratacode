/**
 * cliente-prueba — un cliente MCP de verdad, para probar RATACODE-MCP.
 *
 * Arranca el servidor por stdio (como haría Claude Code, Codex u OpenClaw),
 * lista las herramientas, pide el catálogo, lanza el encargo «Responde
 * solamente PONG», vigila el estado y recoge el resultado.
 *
 *   node mcp/prueba/cliente-prueba.mjs --home <casa> [--provider b-ai] [--model deepseek-v4.1-flash]
 *
 * Sale con código 0 sólo si el resultado contiene PONG. Todo lo demás es un
 * fallo, y se dice por qué.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binDelMotor, resolverCasa } from '../lib/casa.js';

/** Leer la línea de órdenes, sencilla a propósito. */
function ordenes(argv) {
  const salida = { casa: undefined, motor: undefined, provider: 'b-ai', model: 'deepseek-v4.1-flash', espacio: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) salida.casa = valor;
    else if (a === '--dsh' || a.startsWith('--dsh=')) salida.motor = valor;
    else if (a === '--provider' || a.startsWith('--provider=')) salida.provider = valor;
    else if (a === '--model' || a.startsWith('--model=')) salida.model = valor;
    else if (a === '--espacio' || a.startsWith('--espacio=')) salida.espacio = valor;
    else throw new Error('no entiendo «' + a + '»');
  }
  return salida;
}

/** Sacar el JSON de una respuesta de herramienta. */
function datoDe(respuesta) {
  const texto = respuesta?.content?.find((b) => b.type === 'text')?.text ?? '';
  try {
    return JSON.parse(texto);
  } catch {
    return { texto_crudo: texto };
  }
}

const args = ordenes(process.argv.slice(2));
const casa = resolverCasa(args.casa);
const dshBin = binDelMotor(args.motor);
const aqui = dirname(fileURLToPath(import.meta.url));
const espacio = resolve(args.espacio ?? join(aqui, 'espacio'));
mkdirSync(espacio, { recursive: true });

const transporte = new StdioClientTransport({
  command: process.execPath,
  args: [join(aqui, '..', 'bin', 'ratacode-mcp.js'), '--home', casa, '--dsh', dshBin],
  cwd: espacio,
  // EL ENTORNO SE PASA A PROPÓSITO. El transporte stdio del SDK, si no le das
  // uno, sólo hereda su lista blanca (PATH, TEMP, USERPROFILE…) y NINGUNA
  // clave: así el servidor no podría autenticar nada. Un cliente real (Claude
  // Code, Codex) entrega su entorno al servidor MCP, y esto imita eso.
  env: { ...process.env },
  stderr: 'inherit',
});
const cliente = new Client({ name: 'prueba-ratacode', version: '0.0.1' });

const paso = (titulo, dato) => {
  process.stdout.write('\n=== ' + titulo + ' ===\n');
  process.stdout.write(typeof dato === 'string' ? dato + '\n' : JSON.stringify(dato, null, 2) + '\n');
};

try {
  await cliente.connect(transporte);
  paso('conectado', { casa, motor: dshBin, espacio });

  const herramientas = await cliente.listTools();
  paso('herramientas', herramientas.tools.map((h) => h.name));

  const catalogo = datoDe(await cliente.callTool({ name: 'list_models', arguments: {} }));
  paso('list_models', catalogo);

  const lanzada = datoDe(await cliente.callTool({
    name: 'run_task',
    arguments: {
      prompt: 'Responde solamente PONG',
      provider: args.provider,
      model: args.model,
      working_directory: espacio,
      timeout: 120000,
    },
  }));
  paso('run_task', lanzada);
  if (lanzada.task_id === undefined) {
    process.stdout.write('\nRESULTADO: no se pudo lanzar la tarea.\n');
    process.exit(1);
  }

  let estado;
  for (let intento = 0; intento < 60; intento += 1) {
    await new Promise((listo) => setTimeout(listo, 2000));
    estado = datoDe(await cliente.callTool({ name: 'get_task_status', arguments: { task_id: lanzada.task_id } }));
    process.stdout.write('· estado: ' + estado.estado + (estado.pasos ? ' (pasos ' + estado.pasos + ')' : '') + '\n');
    if (estado.estado === 'completed' || estado.estado === 'failed' || estado.estado === 'cancelled') break;
  }

  const resultado = datoDe(await cliente.callTool({ name: 'get_task_result', arguments: { task_id: lanzada.task_id } }));
  paso('get_task_result', resultado);

  const respuesta = String(resultado.respuesta ?? '');
  const bien = estado?.estado === 'completed' && /PONG/i.test(respuesta);
  paso('VEREDICTO', bien ? 'VERDE: el resultado trae PONG' : 'ROJO: ' + (resultado.errores?.join(' | ') || 'sin PONG en la respuesta'));
  await cliente.close();
  process.exit(bien ? 0 : 1);
} catch (e) {
  paso('FALLO', e instanceof Error ? (e.stack ?? e.message) : String(e));
  try { await cliente.close(); } catch { /* da igual */ }
  process.exit(1);
}
