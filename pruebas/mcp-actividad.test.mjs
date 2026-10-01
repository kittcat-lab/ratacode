#!/usr/bin/env node
/**
 * PRUEBA DE LA ACTIVIDAD Y DE LOS TOPES (R27) · parte de `npm test`.
 *
 * Lo que se comprueba, con el SERVIDOR MCP de verdad por HTTP (sin motor y sin
 * claves, que aquí no hacen falta):
 *
 *   A · EL CUADERNO APUNTA LAS LECTURAS. `read_file` (dentro) y `read_file`
 *       (fuera de la carpeta autorizada) dejan DOS líneas `tipo: 'lectura'` en
 *       `<casa>/mcp/actividad.jsonl`, con su hora, el cliente («ChatGPT»), la
 *       herramienta, la ruta y `permitido` / no. Sin esto, el panel no tenía
 *       nada que enseñar mientras ChatGPT sólo leía.
 *   B · EL CLIENTE TIENE NOMBRE, también en modo sin estado (donde el
 *       `initialize` viene en otra petición que la herramienta).
 *   C · LOS TOPES NUEVOS salen en `ratacode_status` y en el esquema de
 *       `run_task` (la espera por defecto, los pasos y los tokens).
 *   D · EL MODELO SE VALIDA: pedir uno que la casa no tiene se contesta con un
 *       error claro y la lista de los que sí hay, antes de lanzar nada.
 *
 * Uso: node pruebas/mcp-actividad.test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const PUERTO = 3397;

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}
const di = (t) => process.stdout.write(t + '\n');
const datoDe = (r) => {
  const texto = r?.content?.find((b) => b.type === 'text')?.text ?? '';
  try { return JSON.parse(texto); } catch { return { crudo: texto }; }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const base = mkdtempSync(join(tmpdir(), 'ratacode-actividad-'));
const casa = join(base, 'casa');
const taller = join(base, 'taller');
const fuera = join(base, 'fuera');
mkdirSync(casa, { recursive: true });
mkdirSync(taller, { recursive: true });
mkdirSync(fuera, { recursive: true });
writeFileSync(join(taller, 'dentro.txt'), 'DENTRO R27\n');
writeFileSync(join(fuera, 'canario.txt'), 'CANARIO R27 · no se puede leer\n');

// Los ajustes de fábrica + una carpeta autorizada + topes PEQUEÑOS, para poder
// ver que los valores de la casa mandan (y que salen en el estado).
writeFileSync(join(casa, 'settings.yaml'), readFileSync(join(PRODUCTO, 'fabrica', 'settings.yaml'), 'utf8') + '\n' + [
  'mcp:',
  '  workspaces:',
  "    - '" + taller + "'",
  '  puerto: ' + PUERTO,
  '  espera_por_defecto_segundos: 7',
  '  pasos_max: 11',
  '  tokens_max: 1234',
  '',
].join('\n'));

const mcp = spawn(process.execPath, [
  join(PRODUCTO, 'mcp', 'bin', 'ratacode-mcp.js'), '--home', casa, '--http', '--port', String(PUERTO),
], { cwd: taller, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let salida = '';
mcp.stdout.setEncoding('utf8');
mcp.stderr.setEncoding('utf8');
mcp.stdout.on('data', (t) => { salida += t; });
mcp.stderr.on('data', (t) => { salida += t; });

let cliente = null;
try {
  const rutaUrl = join(casa, 'mcp', 'http-url.txt');
  let url = null;
  for (let i = 0; i < 60 && url === null; i += 1) {
    await esperar(500);
    try {
      const leida = readFileSync(rutaUrl, 'utf8').trim();
      if (leida.startsWith('http')) url = leida;
    } catch { /* todavía no */ }
  }
  comprobar(url !== null, 'el MCP por HTTP arranca en 127.0.0.1:' + PUERTO);
  if (url === null) throw new Error('el MCP no llegó a escuchar:\n' + salida);

  // El cliente se llama «ChatGPT», como el de verdad: así se comprueba que el
  // nombre llega al cuaderno aunque cada POST lo atienda un servidor nuevo.
  cliente = new Client({ name: 'ChatGPT', version: '0.0.1' });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(url)));

  // ── C · LOS TOPES NUEVOS ────────────────────────────────────────────────
  di('');
  di('C · LOS TOPES NUEVOS, EN EL ESTADO Y EN EL ESQUEMA');
  const estado = datoDe(await cliente.callTool({ name: 'ratacode_status', arguments: {} }));
  const topes = estado.topes ?? {};
  comprobar(topes.espera_por_defecto_segundos === 7, 'la casa manda en la espera por defecto (7): ' + topes.espera_por_defecto_segundos);
  comprobar(topes.pasos_max === 11, 'y en los pasos máximos (11): ' + topes.pasos_max);
  comprobar(topes.tokens_max === 1234, 'y en los tokens máximos (1234): ' + topes.tokens_max);
  comprobar(/ChatGPT/.test(JSON.stringify(estado.sesiones?.clientes ?? [])), 'el estado apunta el cliente por su nombre: ' + JSON.stringify(estado.sesiones?.clientes));

  const herramientas = await cliente.listTools();
  const runTask = herramientas.tools.find((t) => t.name === 'run_task');
  const esquema = JSON.stringify(runTask ?? {});
  comprobar(/7 s/.test(esquema), 'y el esquema de run_task dice lo que espera solo (7 s)');
  comprobar(/20 s/.test(esquema), 'y el esquema de run_task dice lo del bucle (una vez cada 20 s)');
  comprobar(/11 pasos/.test(esquema) && /1234 tokens/.test(esquema), 'y sus topes (11 pasos, 1234 tokens)');
  const deSoloLectura = herramientas.tools.filter((t) => t.annotations?.readOnlyHint === true).map((t) => t.name);
  comprobar(!deSoloLectura.includes('run_task') && deSoloLectura.includes('read_file'),
    'las de sólo lectura van marcadas (y run_task no lo es): ' + JSON.stringify(deSoloLectura));

  // ── D · EL MODELO SE VALIDA ─────────────────────────────────────────────
  di('');
  di('D · EL MODELO SE VALIDA CONTRA EL CATÁLOGO');
  const malModelo = await cliente.callTool({
    name: 'run_task',
    arguments: { prompt: 'prueba', provider: 'b-ai', model: 'no-existe-este-modelo' },
  });
  const dicho = malModelo.content?.[0]?.text ?? '';
  di('  · ' + dicho.replace(/\s+/g, ' ').slice(0, 150));
  comprobar(malModelo.isError === true, 'un modelo que la casa no tiene se rechaza');
  comprobar(/no tiene el modelo/.test(dicho), 'y se dice con esa frase');
  comprobar(/deepseek-v4\.1-flash/.test(dicho), 'y trae la lista de los que SÍ hay');

  // ── A · LAS LECTURAS, AL CUADERNO ───────────────────────────────────────
  di('');
  di('A · EL CUADERNO APUNTA LAS LECTURAS');
  const dentro = datoDe(await cliente.callTool({ name: 'read_file', arguments: { ruta: 'dentro.txt' } }));
  comprobar(String(dentro.texto ?? '').includes('DENTRO R27'), 'read_file de dentro lee el fichero');
  const rechazada = await cliente.callTool({ name: 'read_file', arguments: { ruta: join(fuera, 'canario.txt') } });
  comprobar(rechazada.isError === true, 'read_file de fuera se bloquea en el servidor');
  datoDe(await cliente.callTool({ name: 'list_files', arguments: {} }));

  const rutaCuaderno = join(casa, 'mcp', 'actividad.jsonl');
  comprobar(existsSync(rutaCuaderno), 'el cuaderno existe: ' + rutaCuaderno);
  const lineas = existsSync(rutaCuaderno)
    ? readFileSync(rutaCuaderno, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x !== null)
    : [];
  const lecturas = lineas.filter((l) => l.tipo === 'lectura');
  di('  · líneas: ' + JSON.stringify(lecturas.map((l) => [l.cliente, l.herramienta, l.ruta, l.permitido])));
  comprobar(lecturas.length >= 3, 'quedan las tres lecturas apuntadas (' + lecturas.length + ')');
  const laDeDentro = lecturas.find((l) => l.ruta === 'dentro.txt');
  comprobar(laDeDentro !== undefined, 'y está la de dentro.txt');
  comprobar(laDeDentro?.permitido === true && laDeDentro?.cliente === 'ChatGPT', 'con cliente ChatGPT y permitido: ' + JSON.stringify([laDeDentro?.cliente, laDeDentro?.permitido]));
  comprobar(laDeDentro?.herramienta === 'read_file', 'y con su herramienta: ' + laDeDentro?.herramienta);
  comprobar(typeof laDeDentro?.hora === 'string' && !Number.isNaN(Date.parse(laDeDentro.hora)), 'y con su hora: ' + laDeDentro?.hora);
  const laDeFuera = lecturas.find((l) => l.ruta === join(fuera, 'canario.txt'));
  comprobar(laDeFuera !== undefined, 'y la de fuera también se apunta (lo bloqueado es lo que interesa ver)');
  comprobar(laDeFuera?.permitido === false, 'y sale como NO permitida');
  comprobar(/Fuera de la carpeta autorizada/.test(String(laDeFuera?.detalle ?? '')), 'con el motivo del cerco: ' + JSON.stringify(String(laDeFuera?.detalle ?? '').slice(0, 80)));
  comprobar(!lineas.some((l) => typeof l.tarea === 'string' && l.tipo === 'lectura'),
    'una línea de lectura NO lleva tarea (no se mezclan las dos clases)');

  // Y `estadoDeLaCasa` (lo que enseña `--status`) lee el cuaderno sin reventar.
  const { estadoDeLaCasa } = await import('../mcp/lib/tareas.js');
  const resumen = estadoDeLaCasa(casa);
  comprobar(Array.isArray(resumen.ultimas) && resumen.ultimas.length > 0, 'y --status puede leer el cuaderno (' + resumen.ultimas.length + ' líneas)');

  di('');
  di(fallos.length === 0
    ? 'VERDE · el cuaderno apunta las lecturas, el cliente tiene nombre y los topes se publican.'
    : 'ROJO · ' + fallos.length + ' cosa(s) mal de ' + cuantas + '.');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = fallos.length === 0 ? 0 : 1;
} catch (e) {
  di('ROJO · la prueba se rompió: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exitCode = 1;
} finally {
  try { if (cliente !== null) await cliente.close(); } catch { /* da igual */ }
  try {
    if (process.platform === 'win32') {
      spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + mcp.pid + ' /T /F'], { windowsHide: true, stdio: 'ignore' });
    } else mcp.kill('SIGTERM');
  } catch { /* ya se fue */ }
  await esperar(1200);
  try { rmSync(base, { recursive: true, force: true }); } catch { /* da igual */ }
  if (existsSync(base)) di('(no pude borrar ' + base + ')');
}
