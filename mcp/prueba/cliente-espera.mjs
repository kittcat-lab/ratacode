/**
 * cliente-espera — prueba de UNA SOLA LLAMADA: `run_task` con `esperar_segundos`.
 *
 * Es el tropiezo 17 convertido en prueba: un cliente MCP de una sola vuelta
 * (como `claude -p` o `codex exec`) NO puede volver a preguntar por el estado.
 * Aquí se lanza el encargo UNA vez con `esperar_segundos` y se exige que esa
 * MISMA respuesta traiga el resultado completo con PONG.
 *
 *   node mcp/prueba/cliente-espera.mjs --home <casa> [--dsh <ruta>] \
 *        [--provider ollama] [--model "qwen2.5-coder:7b"] [--esperar 300] [--peticion "Responde solamente PONG"]
 *
 * Banderas de prueba:
 *   --sin-entorno   arranca el servidor SIN pasarle el entorno (la lista blanca
 *                   del SDK): sirve para ver el error «falta … en el entorno
 *                   del cliente MCP» del tropiezo 12.
 *
 * Sale con código 0 SÓLO si, en una única llamada a run_task con
 * `esperar_segundos`, el resultado viene `completed` y trae PONG. Todo lo demás
 * es un fallo, y se dice por qué.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { binDelMotor, resolverCasa } from '../lib/casa.js';

/** Leer la línea de órdenes, sencilla a propósito. */
function ordenes(argv) {
  const salida = {
    casa: undefined,
    motor: undefined,
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    esperar: 300,
    peticion: 'Responde solamente PONG',
    espacio: undefined,
    entorno: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    // Las banderas de una sola pieza no comen el argumento siguiente.
    if (a === '--sin-entorno') { salida.entorno = false; continue; }
    const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) salida.casa = valor;
    else if (a === '--dsh' || a.startsWith('--dsh=')) salida.motor = valor;
    else if (a === '--provider' || a.startsWith('--provider=')) salida.provider = valor;
    else if (a === '--model' || a.startsWith('--model=')) salida.model = valor;
    else if (a === '--esperar' || a.startsWith('--esperar=')) salida.esperar = Number(valor);
    else if (a === '--peticion' || a.startsWith('--peticion=')) salida.peticion = valor;
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
  // EL ENTORNO SE PASA A PROPÓSITO (como Claude Code): si el cliente no lo
  // pasa, el servidor no ve ninguna clave y lo dice. Con `--sin-entorno` se
  // quita, para ver justo ese error.
  ...(args.entorno ? { env: { ...process.env } } : {}),
  stderr: 'inherit',
});
const cliente = new Client({ name: 'prueba-espera-r7', version: '0.0.1' });

const paso = (titulo, dato) => {
  process.stdout.write('\n=== ' + titulo + ' ===\n');
  process.stdout.write(typeof dato === 'string' ? dato + '\n' : JSON.stringify(dato, null, 2) + '\n');
};

try {
  await cliente.connect(transporte);
  paso('conectado', {
    casa,
    motor: dshBin,
    espacio,
    entorno_pasado: args.entorno,
    empresa: args.entorno ? 'el cliente MCP SÍ le pasa su entorno' : 'el cliente MCP NO le pasa el entorno',
  });

  const herramientas = await cliente.listTools();
  const runTask = herramientas.tools.find((h) => h.name === 'run_task');
  paso('run_task, tal como lo lista el servidor', {
    herramientas: herramientas.tools.map((h) => h.name),
    parametros: Object.keys(runTask?.inputSchema?.properties ?? {}),
    descripcion_esperar_segundos: runTask?.inputSchema?.properties?.esperar_segundos?.description ?? '(NO ESTÁ)',
  });
  if (runTask?.inputSchema?.properties?.esperar_segundos === undefined) {
    paso('VEREDICTO', 'ROJO: run_task no declara esperar_segundos al listarlo');
    await cliente.close();
    process.exit(1);
  }

  // ── LA LLAMADA ÚNICA: run_task con esperar_segundos ──────────────────────
  const empezado = Date.now();
  const respuesta = await cliente.callTool({
    name: 'run_task',
    arguments: {
      prompt: args.peticion,
      provider: args.provider,
      model: args.model,
      working_directory: espacio,
      esperar_segundos: args.esperar,
      timeout: (args.esperar + 30) * 1000,
    },
  });
  const lanzada = datoDe(respuesta);
  paso('run_task (UNA sola llamada, con esperar_segundos)', lanzada);

  const llamadasDeEstado = 0; // a propósito: en esta prueba no se pregunta nada más
  const respuestaDelModelo = String(lanzada?.resultado?.respuesta ?? '');
  const bien = lanzada?.estado === 'completed'
    && /PONG/i.test(respuestaDelModelo)
    && llamadasDeEstado === 0
    && lanzada?.espera?.agotada === false;

  paso('VEREDICTO', bien
    ? 'VERDE: run_task con esperar_segundos devolvió PONG en UNA sola llamada ('
      + (Date.now() - empezado) + ' ms de reloj, ' + (lanzada?.espera?.esperada_ms ?? '?')
      + ' ms esperando), sin get_task_status ni get_task_result'
    : 'ROJO: ' + JSON.stringify({
      estado: lanzada?.estado,
      respuesta: respuestaDelModelo,
      espera: lanzada?.espera,
      errores: lanzada?.resultado?.errores ?? lanzada?.errores ?? lanzada?.texto_crudo,
    }));

  await cliente.close();
  process.exit(bien ? 0 : 1);
} catch (e) {
  paso('FALLO', e instanceof Error ? (e.stack ?? e.message) : String(e));
  try { await cliente.close(); } catch { /* da igual */ }
  process.exit(1);
}
