#!/usr/bin/env node
/**
 * PRUEBA DEL CERCO DEL MCP (R25) · parte de `npm test`.
 *
 * Repite, con un modelo FALSO y un canario inventado, lo que midió REV-MCP-WEB
 * (por el MCP una tarea leía y escribía fuera de su carpeta) y comprueba que ya
 * NO puede: la tarea va encerrada en las carpetas de `mcp.workspaces`, sin
 * terminal y con la LECTURA encerrada por el gancho `tools/pre-execute`.
 *
 * Cómo se mide DE VERDAD, sin claves y sin red:
 *   · una casa de mentira en un directorio temporal, con el mismo
 *     `permission.defaultPreset: danger-full-access` que trae la fábrica (la
 *     trampa: ese ajuste ganaba al parche del MCP);
 *   · un modelo falso OpenAI-compatible en 127.0.0.1:3372 (`pruebas/llm-falso.mjs`)
 *     que hace EXACTAMENTE las llamadas que dice el guion de cada prueba;
 *   · el MCP por HTTP en 127.0.0.1:3378, arrancado SIN `--acepto-lectura-total`
 *     (que ya no hace falta y no hace nada);
 *   · y lo que se comprueba es lo que el motor contestó a cada herramienta, que
 *     se lee de la conversación que vio el modelo (no de lo que el motor diga
 *     de sí mismo).
 *
 * Uso: node pruebas/mcp-cerrado.test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { arrancarLlmFalso, transcripcion } from './llm-falso.mjs';
import { canonica, decidir, dentroDeAlguna, estaDentro, rutasDe } from '../mcp/lib/lectura.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const PUERTO_MCP = 3378;
const PUERTO_MODELO = 3372;

/** El canario, inventado para esta prueba. */
const CANARIO = 'CANARIO-R25-4471';
/** Y lo que hay dentro de la carpeta autorizada. */
const DENTRO = 'DENTRO-R25-8823';

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}
const di = (t) => process.stdout.write(t + '\n');

const base = mkdtempSync(join(tmpdir(), 'ratacode-cerco-'));
const casa = join(base, 'casa');
const taller = join(base, 'taller');
const fuera = join(base, 'fuera');
mkdirSync(casa, { recursive: true });
mkdirSync(taller, { recursive: true });
mkdirSync(fuera, { recursive: true });
writeFileSync(join(fuera, 'canario.txt'), CANARIO + ' fuera de la carpeta\n');
writeFileSync(join(taller, 'dentro.txt'), DENTRO + '\n');
/** Un enlace (unión de Windows, sin permisos de administrador) que sale del taller. */
const ENLACE = join(taller, 'enlace');
let hayEnlace = false;
try {
  symlinkSync(fuera, ENLACE, 'junction');
  hayEnlace = true;
} catch { /* sin permiso para enlazar: esa trampa se salta, y se dice */ }

const CANARIO_CRUDO = join(fuera, 'canario.txt');
const TRAMPAS = [
  ['con ..\\', join(taller, '..', 'fuera', 'canario.txt')],
  ['con mayúsculas', join(fuera, 'CANARIO.TXT')],
  ['con \\\\?\\', '\\\\?\\' + CANARIO_CRUDO],
  ...(hayEnlace ? [['por un enlace', join(ENLACE, 'canario.txt')]] : []),
];

writeFileSync(join(casa, 'settings.yaml'), [
  '# Casa de la prueba del cerco (R25). La trampa a propósito: el ajuste de fábrica',
  '# `permission.defaultPreset: danger-full-access`, que es el que ganaba al parche.',
  'permission:',
  '  defaultPreset: danger-full-access',
  'agent-default-model:',
  '  provider: r25-falso',
  '  model: r25-falso-1',
  'llm-pi-ai:',
  '  providers:',
  '    r25-falso:',
  '      displayName: R25 falso',
  '      api: openai-completions',
  '      baseURL: http://127.0.0.1:' + PUERTO_MODELO + '/v1',
  '      timeoutMs: 30000',
  '      headers:',
  "        Authorization: 'Bearer r25-falso-sin-clave'",
  '      models:',
  '        - id: r25-falso-1',
  '          name: R25 falso',
  '          contextWindow: 100000',
  '          maxTokens: 4096',
  '          compat:',
  '            supportsDeveloperRole: false',
  'mcp:',
  '  workspaces:',
  "    - '" + taller + "'",
  '',
].join('\n'));

// ── EL GUION DE CADA PRUEBA ────────────────────────────────────────────────
// Cada paso es una herramienta que pide el modelo (y que el motor ejecutará de
// verdad), y el último es el texto con el que cierra.
const guiones = {
  // a) leer el canario de fuera
  a: [{ herramienta: { nombre: 'read', argumentos: { file_path: CANARIO_CRUDO } } }, { texto: 'fin-a' }],
  // b) listar el escritorio de fuera: por búsqueda (ruta) y por terminal
  b: [
    { herramienta: { nombre: 'glob', argumentos: { pattern: '*', path: fuera } } },
    { herramienta: { nombre: 'pwsh', argumentos: { command: 'Get-ChildItem "' + fuera + '"' } } },
    { texto: 'fin-b' },
  ],
  // c) la terminal, para leer el canario
  c: [{ herramienta: { nombre: 'pwsh', argumentos: { command: 'Get-Content "' + CANARIO_CRUDO + '"' } } }, { texto: 'fin-c' }],
  // d) escribir fuera (NO debe poder)
  d: [{ herramienta: { nombre: 'write', argumentos: { file_path: join(fuera, 'hola.txt'), content: 'hola' } } }, { texto: 'fin-d' }],
  // e) escribir dentro (sí debe poder)
  e: [{ herramienta: { nombre: 'write', argumentos: { file_path: join(taller, 'hola.txt'), content: 'hola' } } }, { texto: 'fin-e' }],
  // f) leer dentro (sí debe poder)
  f: [{ herramienta: { nombre: 'read', argumentos: { file_path: join(taller, 'dentro.txt') } } }, { texto: 'fin-f' }],
  // g) las rutas trampa, y una de dentro con mayúsculas (esa sí pasa)
  g: [
    ...TRAMPAS.map(([, ruta]) => ({ herramienta: { nombre: 'read', argumentos: { file_path: ruta } } })),
    { herramienta: { nombre: 'read', argumentos: { file_path: join(taller.toUpperCase(), 'DENTRO.TXT') } } },
    { texto: 'fin-g' },
  ],
};

const llm = await arrancarLlmFalso({ puerto: PUERTO_MODELO, guiones });
const mcpBin = join(PRODUCTO, 'mcp', 'bin', 'ratacode-mcp.js');
// A PROPÓSITO sin `--acepto-lectura-total`: ya no hace falta para nada.
const mcp = spawn(process.execPath, [mcpBin, '--home', casa, '--http', '--port', String(PUERTO_MCP)], {
  cwd: taller,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let salidaMcp = '';
mcp.stdout.setEncoding('utf8');
mcp.stderr.setEncoding('utf8');
mcp.stdout.on('data', (t) => { salidaMcp += t; });
mcp.stderr.on('data', (t) => { salidaMcp += t; });

/** El JSON de una respuesta de herramienta del MCP. */
function datoDe(respuesta) {
  const texto = respuesta?.content?.find((b) => b.type === 'text')?.text ?? '';
  try { return JSON.parse(texto); } catch { return { crudo: texto }; }
}

/** Lanzar un encargo con su etiqueta y esperar a que termine. */
async function tarea(cliente, etiqueta) {
  const lanzada = datoDe(await cliente.callTool({
    name: 'run_task',
    arguments: {
      prompt: '[R25:' + etiqueta + '] prueba del cerco',
      working_directory: taller,
      esperar_segundos: 120,
      timeout: 120000,
    },
  }));
  if (lanzada.task_id === undefined) return { recibo: lanzada, resultado: null };
  const resultado = lanzada.resultado ?? datoDe(await cliente.callTool({ name: 'get_task_result', arguments: { task_id: lanzada.task_id } }));
  return { recibo: lanzada, resultado };
}

let cliente = null;
try {
  // ── 0 · LO QUE SE PUEDE COMPROBAR SIN MOTOR ─────────────────────────────
  di('· el juicio de rutas, en frío (sin motor)');
  comprobar(!dentroDeAlguna('\\\\otro-pc\\recurso\\x.txt', [taller]).dentro, 'una ruta UNC de otro equipo queda fuera');
  comprobar(!dentroDeAlguna('..\\..\\otro\\x.txt', [taller], taller).dentro, 'una ruta relativa con `..` que sale queda fuera');
  comprobar(dentroDeAlguna('sub\\x.txt', [taller], taller).dentro, 'una ruta relativa de dentro queda dentro');
  comprobar(dentroDeAlguna(join(taller.toUpperCase(), 'x.txt'), [taller]).dentro, 'en Windows las mayúsculas no cambian de carpeta');
  comprobar(!dentroDeAlguna('\\\\?\\' + CANARIO_CRUDO, [taller]).dentro, 'el prefijo `\\\\?\\` no salta el cerco');
  comprobar(canonica('C:\\a\\..\\b\\c.txt').toLowerCase() === 'c:\\b\\c.txt', 'la forma canónica quita el `..`');
  comprobar(estaDentro(taller + '\\x.txt', taller) && !estaDentro(taller + 'ajena\\x.txt', taller), 'la frontera es la carpeta, no el prefijo de su nombre');
  comprobar(rutasDe({ file_path: 'x', files: [{ path: 'y' }], content: 'C:\\no-es-ruta' }).join(',') === 'x,y', 'las rutas se sacan de sus claves, no del texto libre');
  comprobar(decidir({ entrada: { file_path: 'x' }, raices: [] }) !== null, 'sin carpetas autorizadas no pasa nada (falla cerrado)');

  // ── 1 · EL MCP, POR HTTP Y SIN LA BANDERA DE ANTES ──────────────────────
  const rutaUrl = join(casa, 'mcp', 'http-url.txt');
  let url = null;
  for (let i = 0; i < 60 && url === null; i += 1) {
    await new Promise((listo) => setTimeout(listo, 500));
    try {
      const leida = readFileSync(rutaUrl, 'utf8').trim();
      if (leida.startsWith('http')) url = leida;
    } catch { /* todavía no */ }
  }
  comprobar(url !== null, 'el MCP por HTTP arranca SIN --acepto-lectura-total (' + PUERTO_MCP + ')');
  if (url === null) throw new Error('el MCP no llegó a escuchar:\n' + salidaMcp);

  cliente = new Client({ name: 'prueba-cerco', version: '0.0.1' });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(url)));

  // ── 2 · LAS PRUEBAS a-g, CON EL MOTOR DE VERDAD ─────────────────────────
  const hechos = {};
  for (const etiqueta of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const { recibo, resultado } = await tarea(cliente, etiqueta);
    const pasos = transcripcion(llm.peticionesDe(etiqueta));
    hechos[etiqueta] = { recibo, resultado, pasos };
    di('· ' + etiqueta + ' · modo ' + (recibo.modo ?? '?') + ' · pasos ' + pasos.length
      + ' · ' + (resultado === null ? 'sin resultado' : String(resultado.respuesta ?? '').slice(0, 40).replace(/\s+/g, ' ')));
  }

  const DENEGADO = /Fuera de la carpeta autorizada/;

  // a) leer fuera → denegado, y el canario no sale en la respuesta
  comprobar(hechos.a.pasos.length >= 1 && DENEGADO.test(hechos.a.pasos[0].resultado ?? ''),
    'a · leer el canario de FUERA se deniega: ' + String(hechos.a.pasos[0]?.resultado ?? '').slice(0, 120));
  comprobar(!String(hechos.a.resultado?.respuesta ?? '').includes(CANARIO), 'a · el canario no aparece en la respuesta');

  // b) listar fuera: por búsqueda (denegado) y por terminal (no existe)
  comprobar(DENEGADO.test(hechos.b.pasos[0]?.resultado ?? ''),
    'b · listar fuera con glob se deniega: ' + String(hechos.b.pasos[0]?.resultado ?? '').slice(0, 120));
  const terminalB = String(hechos.b.pasos[1]?.resultado ?? '');
  comprobar(/unknown tool/i.test(terminalB), 'b · la terminal no existe en la tarea (la herramienta está apagada): ' + terminalB.slice(0, 120));

  // c) la terminal, para leer el canario
  const terminalC = String(hechos.c.pasos[0]?.resultado ?? '');
  comprobar(/unknown tool/i.test(terminalC) && !terminalC.includes(CANARIO), 'c · PowerShell no lee el canario (no hay herramienta): ' + terminalC.slice(0, 120));

  // d) escribir fuera → denegado, y el fichero NO está en disco
  comprobar(DENEGADO.test(hechos.d.pasos[0]?.resultado ?? ''),
    'd · escribir fuera se deniega: ' + String(hechos.d.pasos[0]?.resultado ?? '').slice(0, 120));
  comprobar(!existsSync(join(fuera, 'hola.txt')), 'd · y el fichero de fuera no existe (comprobado en disco)');

  // e) escribir dentro → sí, y el fichero está
  const escritoDentro = join(taller, 'hola.txt');
  comprobar(!DENEGADO.test(hechos.e.pasos[0]?.resultado ?? '') && existsSync(escritoDentro),
    'e · escribir DENTRO funciona y el fichero está: ' + String(hechos.e.pasos[0]?.resultado ?? '').slice(0, 80));
  comprobar(existsSync(escritoDentro) && readFileSync(escritoDentro, 'utf8').trim() === 'hola', 'e · con el contenido que se pidió');

  // f) leer dentro → sí, y con el contenido
  comprobar(String(hechos.f.pasos[0]?.resultado ?? '').includes(DENTRO),
    'f · leer DENTRO funciona y devuelve el contenido');

  // g) las trampas, una a una (y la de dentro con mayúsculas, que sí pasa)
  for (let i = 0; i < TRAMPAS.length; i += 1) {
    const [como, ruta] = TRAMPAS[i];
    comprobar(DENEGADO.test(hechos.g.pasos[i]?.resultado ?? ''),
      'g · ruta trampa ' + como + ' → denegada: ' + String(hechos.g.pasos[i]?.resultado ?? '').slice(0, 110));
  }
  const ultimo = hechos.g.pasos[TRAMPAS.length];
  comprobar(!DENEGADO.test(ultimo?.resultado ?? '') && String(ultimo?.resultado ?? '').includes(DENTRO),
    'g · pero la de DENTRO con mayúsculas sí pasa (Windows no distingue)');

  // ── 3 · EL PANEL NO SE TOCA: la casa sigue con «A rienda suelta» ────────
  comprobar(readFileSync(join(casa, 'profiles', 'web', 'cordis.patch.yml'), 'utf8').includes('defaultPreset: danger-full-access'),
    'el ajuste de la casa (el del panel) sigue siendo danger-full-access: el MCP no lo toca');
  comprobar(['a', 'b', 'c', 'd', 'e', 'f', 'g'].every((e) => hechos[e].recibo.modo === 'workspace-write'),
    'las 7 tareas corren en workspace-write aunque la casa diga danger-full-access');

  di('');
  di(fallos.length === 0
    ? 'VERDE · el MCP va encerrado: ni lee ni escribe fuera, ni tiene terminal, ni rutas trampa.'
    : 'ROJO · ' + fallos.length + ' cosa(s) mal.');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = fallos.length === 0 ? 0 : 1;
} catch (e) {
  di('ROJO · la prueba se rompió: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exitCode = 1;
} finally {
  try { if (cliente !== null) await cliente.close(); } catch { /* da igual */ }
  try { mcp.kill(); } catch { /* da igual */ }
  try { llm.parar(); } catch { /* da igual */ }
  try { rmSync(base, { recursive: true, force: true }); } catch { /* da igual */ }
  if (existsSync(base)) di('(no pude borrar ' + base + ')');
}
