/**
 * prueba-cancelar-y-espacio — las promesas de seguridad, comprobadas.
 *
 * Comprueba cuatro cosas que el humano pidió por escrito:
 *   1. `list_providers` dice la verdad sobre la credencial (y no la enseña).
 *   2. Una carpeta FUERA de los espacios autorizados se rechaza con un motivo.
 *   3. `cancel_task` detiene una tarea en marcha de verdad (estado `cancelled`).
 *   4. `allow_dangerous` sin permiso de la casa se deniega, no se concede.
 *
 *   node mcp/prueba/prueba-cancelar-y-espacio.mjs --home <casa> --espacio <carpeta> [--provider falso] [--model pong]
 *
 * Sale 0 sólo si las cuatro pasan.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binDelMotor, resolverCasa } from '../lib/casa.js';

function ordenes(argv) {
  const salida = { casa: undefined, motor: undefined, provider: 'falso', model: 'pong', espacio: undefined, fuera: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) salida.casa = valor;
    else if (a === '--dsh' || a.startsWith('--dsh=')) salida.motor = valor;
    else if (a === '--provider' || a.startsWith('--provider=')) salida.provider = valor;
    else if (a === '--model' || a.startsWith('--model=')) salida.model = valor;
    else if (a === '--espacio' || a.startsWith('--espacio=')) salida.espacio = valor;
    else if (a === '--fuera' || a.startsWith('--fuera=')) salida.fuera = valor;
    else throw new Error('no entiendo «' + a + '»');
  }
  return salida;
}

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
const fuera = resolve(args.fuera ?? join(aqui, 'espacio-fuera'));
mkdirSync(espacio, { recursive: true });
mkdirSync(fuera, { recursive: true });

const transporte = new StdioClientTransport({
  command: process.execPath,
  args: [join(aqui, '..', 'bin', 'ratacode-mcp.js'), '--home', casa, '--dsh', dshBin],
  cwd: espacio,
  // Se pasa el entorno a propósito: es lo que hace un cliente real. Sin esto,
  // el SDK sólo hereda su lista blanca y el servidor se queda sin credenciales.
  env: { ...process.env },
  stderr: 'inherit',
});
const cliente = new Client({ name: 'prueba-seguridad', version: '0.0.1' });

const resultados = [];
function comprobar(nombre, bien, detalle) {
  resultados.push({ nombre, bien });
  process.stdout.write((bien ? '  VERDE  ' : '  ROJO   ') + nombre + (detalle === undefined ? '' : ' · ' + detalle) + '\n');
}

try {
  await cliente.connect(transporte);

  // 1 · proveedores: dice si hay credencial y de dónde sale, sin enseñarla
  const catalogo = datoDe(await cliente.callTool({ name: 'list_providers', arguments: {} }));
  const proveedor = catalogo.proveedores?.find((p) => p.id === args.provider);
  const textoCatalogo = JSON.stringify(catalogo);
  comprobar('list_providers conoce el proveedor', proveedor !== undefined);
  comprobar('list_providers no enseña ninguna clave',
    !/clave-de-mentira/.test(textoCatalogo) && !/sk-/.test(textoCatalogo));
  comprobar('list_providers ve la credencial en el entorno',
    proveedor?.tiene_clave === true,
    'credencial: ' + proveedor?.credencial + ' · ' + (proveedor?.problema ?? 'presente'));

  // 2 · una carpeta de fuera se rechaza
  const rechazo = await cliente.callTool({
    name: 'run_task',
    arguments: { prompt: 'no debería llegar a correr', provider: args.provider, model: args.model, working_directory: fuera },
  });
  const textoRechazo = rechazo?.content?.find((b) => b.type === 'text')?.text ?? '';
  comprobar('una carpeta fuera de los espacios autorizados se rechaza',
    rechazo?.isError === true && /fuera de los espacios autorizados/.test(textoRechazo),
    textoRechazo.slice(0, 120));

  // 3 · allow_dangerous sin permiso de la casa se deniega
  const peligro = await cliente.callTool({
    name: 'run_task',
    arguments: { prompt: 'no debería llegar a correr', provider: args.provider, model: args.model, allow_dangerous: true },
  });
  const textoPeligro = peligro?.content?.find((b) => b.type === 'text')?.text ?? '';
  comprobar('allow_dangerous sin permiso de la casa se deniega',
    peligro?.isError === true && /permitir_peligroso/.test(textoPeligro),
    textoPeligro.slice(0, 120));

  // 4 · cancelar de verdad
  const lanzada = datoDe(await cliente.callTool({
    name: 'run_task',
    arguments: { prompt: 'LENTO: espera sin contestar', provider: args.provider, model: args.model, working_directory: espacio, timeout: 120000 },
  }));
  await new Promise((listo) => setTimeout(listo, 4000));
  const antes = datoDe(await cliente.callTool({ name: 'get_task_status', arguments: { task_id: lanzada.task_id } }));
  const cancelada = datoDe(await cliente.callTool({ name: 'cancel_task', arguments: { task_id: lanzada.task_id } }));
  await new Promise((listo) => setTimeout(listo, 1500));
  const despues = datoDe(await cliente.callTool({ name: 'get_task_status', arguments: { task_id: lanzada.task_id } }));
  comprobar('la tarea estaba corriendo antes de cancelar', antes.estado === 'running', 'estado: ' + antes.estado);
  comprobar('cancel_task la deja en cancelled', cancelada.estado === 'cancelled' && despues.estado === 'cancelled',
    'antes: ' + antes.estado + ' → después: ' + despues.estado);

  await cliente.close();
} catch (e) {
  comprobar('la prueba corrió entera', false, e instanceof Error ? e.message : String(e));
  try { await cliente.close(); } catch { /* da igual */ }
}

const rojos = resultados.filter((r) => !r.bien).length;
process.stdout.write('\n' + (resultados.length - rojos) + '/' + resultados.length + ' comprobaciones en verde\n');
process.exit(rojos === 0 ? 0 : 1);
