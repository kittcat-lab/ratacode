#!/usr/bin/env node
/**
 * PRUEBA DE AISLAMIENTO Y DE LAS HERRAMIENTAS DE SÓLO LECTURA (R26) · parte de
 * `npm test`.
 *
 * Qué mide, y con qué montaje:
 *   · una casa de mentira en un directorio temporal (con la trampa de fábrica
 *     `permission.defaultPreset: danger-full-access`), con `mcp.workspaces`
 *     apuntando a UNA carpeta autorizada de nombre largo (para poder probar los
 *     nombres cortos 8.3 de Windows);
 *   · un canario inventado FUERA de esa carpeta, en `..\carpeta de fuera`, con
 *     una UNIÓN de Windows dentro que apunta a él;
 *   · un modelo FALSO OpenAI-compatible en 127.0.0.1:3381 (sin claves y sin
 *     red) que hace lo que dice el guion;
 *   · y el MCP por HTTP en 127.0.0.1:3380 (y un segundo, con el motor «con
 *     huecos», en 3382).
 *
 * Lo que se comprueba: que las tres herramientas de sólo lectura (R26) digan la
 * verdad, que NINGUNA de las trampas de ruta saque nada de fuera de la carpeta
 * autorizada (ni por el servidor, ni por el motor), que el HTTP no se deje
 * llevar por una clave mala, una ruta rara o el `Origin` de otra web, y que el
 * motor no se traiga instrucciones (`AGENTS.md`) ni habilidades (skills) de
 * fuera de la carpeta autorizada.
 *
 * Uso: node pruebas/mcp-lectura.test.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { arrancarLlmFalso, transcripcion } from './llm-falso.mjs';
import { CLAVES_DE_RUTA, canonica, dentroDeAlguna } from '../mcp/lib/lectura.js';
import { listarCarpeta, leerFichero } from '../mcp/lib/carpeta.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const VERSION = JSON.parse(readFileSync(join(PRODUCTO, 'package.json'), 'utf8')).version;
const PUERTO_MCP = 3380;
const PUERTO_MODELO = 3381;
const PUERTO_MCP_HUECOS = 3382;

/** Los canarios, inventados para esta prueba. */
const CANARIO = 'CANARIO-R26-7391';
const CANARIO_DENTRO = 'DENTRO-R26-1184';
const CANARIO_AGENTS = 'CANARIO-AGENTS-R26-5540';
const CANARIO_SKILL = 'CANARIO-SKILL-R26-6628';

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}
/**
 * Lo que sólo tiene sentido con rutas de Windows (`\\`, UNC, mayúsculas que
 * no cuentan). Fuera de Windows NO se da por buena: se apunta como no comprobada.
 */
const sinComprobar = [];
function comprobarEnWindows(condicion, queja) {
  if (process.platform === 'win32') return comprobar(condicion, queja);
  sinComprobar.push(queja);
  process.stdout.write('SOLO WINDOWS  ' + queja + ' (sin comprobar en ' + process.platform + ')\n');
}
const di = (t) => process.stdout.write(t + '\n');

// ── EL MONTAJE ─────────────────────────────────────────────────────────────
const base = mkdtempSync(join(tmpdir(), 'ratacode-r26-'));
/** Nombres LARGOS a propósito: Windows les da un nombre corto 8.3 (`CARPET~1`). */
const NOMBRE_AUTORIZADA = 'carpeta autorizada';
const NOMBRE_FUERA = 'carpeta de fuera';
const taller = join(base, NOMBRE_AUTORIZADA);
const fuera = join(base, NOMBRE_FUERA);
const casa = join(base, 'casa');
const casaHuecos = join(base, 'casa-huecos');
mkdirSync(join(taller, 'sub'), { recursive: true });
mkdirSync(fuera, { recursive: true });
for (const c of [casa, casaHuecos]) mkdirSync(join(c, 'skills', 'canario-r26'), { recursive: true });

writeFileSync(join(taller, 'dentro.txt'), CANARIO_DENTRO + '\n');
writeFileSync(join(taller, 'sub', 'nota.txt'), 'nota de dentro\n');
writeFileSync(join(taller, 'binario.bin'), Buffer.from([0, 1, 2, 3, 0, 255]));
writeFileSync(join(fuera, 'canario.txt'), CANARIO + ' fuera de la carpeta\n');
/** Un enlace (unión de Windows, sin permisos de administrador) que sale del taller. */
const ENLACE = join(taller, 'enlace');
let hayEnlace = false;
try {
  symlinkSync(fuera, ENLACE, 'junction');
  hayEnlace = true;
} catch { /* sin permiso para enlazar: esa trampa se salta, y se dice */ }
/** Instrucciones y habilidades FUERA de la carpeta autorizada (en la casa) con canario dentro. */
for (const c of [casa, casaHuecos]) {
  writeFileSync(join(c, 'AGENTS.md'), '# Reglas de la casa\n\n' + CANARIO_AGENTS + '\n');
  writeFileSync(join(c, 'skills', 'canario-r26', 'SKILL.md'), [
    '---',
    'name: canario-r26',
    "description: 'Habilidad de prueba " + CANARIO_SKILL + " que vive FUERA de la carpeta autorizada.'",
    '---',
    '',
    'Cuerpo de la habilidad: ' + CANARIO_SKILL,
    '',
  ].join('\n'));
}
/** Y lo mismo en la carpeta de ARRIBA del taller (la que el motor recorre hacia arriba). */
writeFileSync(join(base, 'AGENTS.md'), '# Reglas de arriba\n\n' + CANARIO_AGENTS + '\n');

/** El nombre corto 8.3 de una carpeta, si el volumen lo tiene (`dir /x`). */
function nombreCorto(de, nombreLargo) {
  const r = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'dir', '/x', de], { encoding: 'utf8', windowsHide: true });
  for (const linea of String(r.stdout ?? '').split(/\r?\n/)) {
    const m = /<DIR>\s+(\S+)\s+(.+?)\s*$/.exec(linea);
    if (m !== null && m[2] === nombreLargo) return m[1];
  }
  return null;
}
const CORTO_TALLER = nombreCorto(base, NOMBRE_AUTORIZADA);
const CORTO_FUERA = nombreCorto(base, NOMBRE_FUERA);

/** Los ajustes de la casa: el modelo falso, la trampa de fábrica / trailing content. */
function ajustes(carpetaCasa) {
  writeFileSync(join(carpetaCasa, 'settings.yaml'), [
    '# Casa de la prueba de R26. La trampa de fábrica a propósito:',
    '# `permission.defaultPreset: danger-full-access`.',
    'permission:',
    '  defaultPreset: danger-full-access',
    'agent-default-model:',
    '  provider: r26-falso',
    '  model: r26-falso-1',
    'llm-pi-ai:',
    '  providers:',
    '    r26-falso:',
    '      displayName: R26 falso',
    '      api: openai-completions',
    '      baseURL: http://127.0.0.1:' + PUERTO_MODELO + '/v1',
    '      timeoutMs: 30000',
    '      headers:',
    "        Authorization: 'Bearer r26-falso-sin-clave'",
    '      models:',
    '        - id: r26-falso-1',
    '          name: R26 falso',
    '          contextWindow: 100000',
    '          maxTokens: 4096',
    '          compat:',
    '            supportsDeveloperRole: false',
    'mcp:',
    '  workspaces:',
    "    - '" + taller + "'",
    '',
  ].join('\n'));
}
ajustes(casa);
ajustes(casaHuecos);

const guiones = {
  tapado: [{ herramienta: { nombre: 'read', argumentos: { file_path: join(taller, 'dentro.txt') } } }, { texto: 'fin-tapado' }],
  huecos: [{ herramienta: { nombre: 'read', argumentos: { file_path: join(taller, 'dentro.txt') } } }, { texto: 'fin-huecos' }],
  // Los patrones de glob/grep, que también pueden apuntar hacia fuera.
  glob: [
    { herramienta: { nombre: 'glob', argumentos: { pattern: '**/*.txt', path: taller } } },
    { herramienta: { nombre: 'glob', argumentos: { pattern: '..\\..\\**', path: taller } } },
    { herramienta: { nombre: 'glob', argumentos: { pattern: '**', path: fuera } } },
    { herramienta: { nombre: 'grep', argumentos: { pattern: 'DENTRO-R26', path: taller, include: '**/*.txt' } } },
    { herramienta: { nombre: 'grep', argumentos: { pattern: 'CANARIO-R26', path: taller, include: '..\\..\\*.txt' } } },
    { texto: 'fin-glob' },
  ],
};

const llm = await arrancarLlmFalso({ puerto: PUERTO_MODELO, guiones });

/** Una petición HTTP cruda (para poder mandar cabeceras raras como `Origin`). */
function peticion({ puerto, metodo = 'POST', ruta, cabeceras = {}, cuerpo }) {
  return new Promise((listo, rechaza) => {
    const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
    const req = request({
      host: '127.0.0.1',
      port: puerto,
      method: metodo,
      path: ruta,
      headers: { ...(datos === null ? {} : { 'content-type': 'application/json', 'content-length': datos.length }), ...cabeceras },
    }, (res) => {
      let texto = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { texto += t; });
      res.on('end', () => listo({ codigo: res.statusCode, texto }));
    });
    req.on('error', rechaza);
    if (datos !== null) req.write(datos);
    req.end();
  });
}

/** El `initialize` del protocolo, como lo manda un cliente. */
const INICIALIZAR = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba-r26', version: '0.0.1' } },
};
const ACEPTA = { accept: 'application/json, text/event-stream' };

/** Arrancar un MCP por HTTP y esperar a su URL. */
async function arrancarMcp({ carpetaCasa, puerto, motor }) {
  const proceso = spawn(process.execPath, [
    join(PRODUCTO, 'mcp', 'bin', 'ratacode-mcp.js'),
    '--home', carpetaCasa,
    '--http',
    '--port', String(puerto),
    ...(motor === undefined ? [] : ['--dsh', motor]),
  ], { cwd: taller, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let salida = '';
  proceso.stdout.setEncoding('utf8');
  proceso.stderr.setEncoding('utf8');
  proceso.stdout.on('data', (t) => { salida += t; });
  proceso.stderr.on('data', (t) => { salida += t; });
  const rutaUrl = join(carpetaCasa, 'mcp', 'http-url.txt');
  let url = null;
  for (let i = 0; i < 60 && url === null; i += 1) {
    await new Promise((listo) => setTimeout(listo, 500));
    try {
      const leida = readFileSync(rutaUrl, 'utf8').trim();
      if (leida.startsWith('http')) url = leida;
    } catch { /* todavía no */ }
  }
  if (url === null) throw new Error('el MCP del puerto ' + puerto + ' no llegó a escuchar:\n' + salida);
  return { proceso, url, clave: url.split('/').pop(), salida: () => salida };
}

/** El JSON de una respuesta de herramienta del MCP. */
function datoDe(respuesta) {
  const texto = respuesta?.content?.find((b) => b.type === 'text')?.text ?? '';
  try { return JSON.parse(texto); } catch { return { crudo: texto }; }
}

const mcp = await arrancarMcp({ carpetaCasa: casa, puerto: PUERTO_MCP });
let cliente = null;
let clienteHuecos = null;
const mcpHuecos = { proceso: null };

try {
  // ── 0 · EN FRÍO: EL JUICIO DE RUTAS, SIN MOTOR ──────────────────────────
  di('· en frío (sin motor): el juicio de rutas del cerco');
  const CRUDO_FUERA = join(fuera, 'canario.txt');
  comprobarEnWindows(!dentroDeAlguna('..\\..\\x.txt', [taller], taller).dentro, 'una relativa con `..` que sale queda fuera');
  comprobar(!dentroDeAlguna('../../x.txt', [taller], taller).dentro, 'una relativa con `../` que sale queda fuera');
  comprobar(dentroDeAlguna('sub\\nota.txt', [taller], taller).dentro, 'una relativa de dentro queda dentro');
  comprobar(!dentroDeAlguna(CRUDO_FUERA, [taller]).dentro, 'una ruta ABSOLUTA de fuera queda fuera');
  comprobar(!dentroDeAlguna('\\\\?\\' + CRUDO_FUERA, [taller]).dentro, 'el prefijo `\\\\?\\` no salta el cerco');
  comprobar(!dentroDeAlguna('\\\\otro-pc\\recurso\\x.txt', [taller]).dentro, 'una UNC de otro equipo queda fuera');
  comprobar(!dentroDeAlguna('\\\\?\\UNC\\otro-pc\\recurso\\x.txt', [taller]).dentro, 'una UNC con `\\\\?\\UNC\\` también');
  if (hayEnlace) {
    comprobar(!dentroDeAlguna(join(ENLACE, 'canario.txt'), [taller]).dentro, 'una UNIÓN de dentro que apunta fuera se juzga por donde ACABA: fuera');
  } else {
    di('(sin permiso para crear la unión: esa trampa se salta)');
  }
  // El nombre corto 8.3: `C:\…\CARPET~1` es la MISMA carpeta con otro nombre.
  if (CORTO_TALLER !== null && CORTO_FUERA !== null) {
    comprobar(dentroDeAlguna(join(base, CORTO_TALLER, 'dentro.txt'), [taller]).dentro, 'el nombre corto ' + CORTO_TALLER + ' de la carpeta autorizada cuenta como dentro');
    comprobar(!dentroDeAlguna(join(base, CORTO_FUERA, 'canario.txt'), [taller]).dentro, 'y el nombre corto ' + CORTO_FUERA + ' de la de fuera, como fuera');
  } else {
    di('(este volumen no da nombres 8.3 en `dir /x`: esa trampa se salta)');
  }
  // Una variable de entorno NO se expande: es un nombre literal dentro del taller.
  const conVariable = dentroDeAlguna('%USERPROFILE%\\secreto.txt', [taller], taller);
  comprobar(conVariable.dentro && !existsSync(conVariable.canonica), '`%USERPROFILE%` NO se expande: se busca un nombre literal dentro (no existe)');
  comprobar(leerFicheroSeguro(CRUDO_FUERA) === null, 'leerFichero() del canario de fuera → rechazado por el cerco');
  comprobar(leerFicheroSeguro(join(taller, 'dentro.txt')) === CANARIO_DENTRO + '\n', 'leerFichero() de dentro → su contenido, exacto');
  const listadoFrio = listarCarpeta({ ruta: taller, raices: [taller], cwd: taller });
  comprobar(listadoFrio.entradas.some((e) => e.nombre === 'dentro.txt' && e.tipo === 'fichero'), 'listarCarpeta() ve `dentro.txt` como fichero');
  if (hayEnlace) {
    const enlace = listadoFrio.entradas.find((e) => e.nombre === 'enlace');
    comprobar(enlace?.tipo === 'enlace' && enlace?.destino_dentro === false, 'y a la unión la marca como enlace que apunta FUERA (no se sigue)');
  }

  // ── 1 · EL HTTP: LA CLAVE, LAS RUTAS RARAS Y EL `Origin` ────────────────
  di('· el HTTP: clave, rutas raras y cabecera Origin');
  const conClave = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/' + mcp.clave, cabeceras: ACEPTA, cuerpo: INICIALIZAR });
  comprobar(conClave.codigo === 200 && conClave.texto.includes('ratacode'), 'la clave en la RUTA (/mcp/<clave>) se acepta (200) y el servidor se presenta');
  const mala = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/' + 'f'.repeat(mcp.clave.length), cabeceras: ACEPTA, cuerpo: INICIALIZAR });
  comprobar(mala.codigo === 404, 'una clave INCORRECTA (misma longitud) → 404: ' + mala.codigo + ' ' + mala.texto.trim());
  const sinClave = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp', cabeceras: ACEPTA, cuerpo: INICIALIZAR });
  comprobar(sinClave.codigo === 404, 'sin clave ninguna → 404: ' + sinClave.codigo);
  const enConsulta = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp?clave=' + mcp.clave, cabeceras: ACEPTA, cuerpo: INICIALIZAR });
  comprobar(enConsulta.codigo === 200 && enConsulta.texto.includes('ratacode'), 'alternativa 1: la clave en la CONSULTA (/mcp?clave=<clave>) también vale');
  const enCabecera = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp', cabeceras: { ...ACEPTA, authorization: 'Bearer ' + mcp.clave }, cuerpo: INICIALIZAR });
  comprobar(enCabecera.codigo === 200 && enCabecera.texto.includes('ratacode'), 'alternativa 2: la clave en `Authorization: Bearer` también vale');
  const raras = [
    ['/mcp/' + mcp.clave + '/extra', 404],
    ['/MCP/' + mcp.clave, 404],
    ['/otra/' + mcp.clave, 404],
    ['/' + mcp.clave, 404],
    ['/mcp/' + mcp.clave + '%20', 404],
  ];
  for (const [ruta, esperado] of raras) {
    const r = await peticion({ puerto: PUERTO_MCP, ruta, cabeceras: ACEPTA, cuerpo: INICIALIZAR });
    comprobar(r.codigo === esperado, 'ruta rara ' + ruta.replace(mcp.clave, '<clave>') + ' → ' + r.codigo + ' (se esperaba ' + esperado + ')');
  }
  const conPuntos = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/../mcp/' + mcp.clave, cabeceras: ACEPTA, cuerpo: INICIALIZAR });
  comprobar(conPuntos.codigo === 200, '`/mcp/../mcp/<clave>` se normaliza a la buena → 200 (y sin la clave buena no pasa nada)');
  const conGet = await peticion({ puerto: PUERTO_MCP, metodo: 'GET', ruta: '/mcp/' + mcp.clave });
  comprobar(conGet.codigo === 405, 'un GET (sin estado no hay stream) → 405: ' + conGet.codigo);
  const origenAjeno = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/' + mcp.clave, cabeceras: { ...ACEPTA, origin: 'https://mala.example' }, cuerpo: INICIALIZAR });
  comprobar(origenAjeno.codigo === 403, 'el `Origin` de OTRA web → 403, aunque traiga la clave buena: ' + origenAjeno.texto.trim());
  const origenChatgpt = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/' + mcp.clave, cabeceras: { ...ACEPTA, origin: 'https://chatgpt.com' }, cuerpo: INICIALIZAR });
  comprobar(origenChatgpt.codigo === 200, 'el `Origin` de OpenAI (chatgpt.com) SÍ se admite (por si su backend lo manda)');
  const origenLocal = await peticion({ puerto: PUERTO_MCP, ruta: '/mcp/' + mcp.clave, cabeceras: { ...ACEPTA, origin: 'http://localhost:6274' }, cuerpo: INICIALIZAR });
  comprobar(origenLocal.codigo === 200, 'y el de casa (localhost:6274, el inspector de MCP) también');

  // ── 2 · LO QUE PUBLICA EL SERVIDOR: HERRAMIENTAS Y MARCAS ───────────────
  di('· lo que publica el servidor (herramientas, marcas y versión)');
  cliente = new Client({ name: 'prueba-r26', version: '0.0.1' });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
  const { tools } = await cliente.listTools();
  const nombres = tools.map((t) => t.name).sort();
  // R28 · las CUATRO de hablar con una sesión abierta del panel (list_sessions,
  // get_session, send_to_session y get_session_reply) suben el censo a 13.
  comprobar(nombres.length === 13, 'publica 13 herramientas: ' + nombres.join(', '));
  comprobar(['list_files', 'read_file', 'ratacode_status'].every((n) => nombres.includes(n)), 'están las tres de sólo lectura de R26 (ratacode_status, list_files, read_file)');
  comprobar(['list_sessions', 'get_session', 'send_to_session', 'get_session_reply'].every((n) => nombres.includes(n)),
    'y están las cuatro de R28 (hablar con una sesión abierta del panel)');
  const deSoloLectura = ['ratacode_status', 'list_files', 'read_file', 'list_providers', 'list_models', 'get_task_status', 'get_task_result', 'list_sessions', 'get_session', 'get_session_reply'];
  const malMarcadas = tools.filter((t) => deSoloLectura.includes(t.name) && t.annotations?.readOnlyHint !== true);
  comprobar(malMarcadas.length === 0, 'las 10 de sólo lectura van con `readOnlyHint: true`' + (malMarcadas.length === 0 ? '' : ' (faltan: ' + malMarcadas.map((t) => t.name).join(', ') + ')'));
  const deEscritura = tools.filter((t) => ['run_task', 'cancel_task', 'send_to_session'].includes(t.name));
  comprobar(deEscritura.every((t) => t.annotations?.readOnlyHint === false), 'y las 3 que cambian cosas van con `readOnlyHint: false` (run_task, cancel_task, send_to_session)');
  comprobar(tools.every((t) => t.annotations?.openWorldHint === false), 'ninguna dice que salga a Internet (`openWorldHint: false` en todas)');
  comprobar(typeof cliente.getServerVersion()?.version === 'string' && cliente.getServerVersion().version === VERSION,
    'el servidor se presenta con la versión del paquete (' + VERSION + '), no con una escrita a mano: ' + cliente.getServerVersion()?.version);
  let recursos = null;
  try { recursos = await cliente.listResources(); } catch (e) { recursos = { error: String(e.message ?? e) }; }
  comprobar(recursos?.error !== undefined || (recursos?.resources?.length ?? 0) === 0, 'no publica `resources` (ni falta que hace): ' + JSON.stringify(recursos).slice(0, 90));

  // ── 3 · ratacode_status: VIVO, CON VERSIÓN, SIN SECRETOS ────────────────
  di('· ratacode_status');
  const estado = datoDe(await cliente.callTool({ name: 'ratacode_status', arguments: {} }));
  comprobar(estado.vivo === true && estado.version === VERSION, 'dice que está vivo y con la versión ' + VERSION);
  comprobar(estado.carpeta_autorizada?.raices?.includes(canonica(taller)), 'dice cuál es la carpeta autorizada: ' + JSON.stringify(estado.carpeta_autorizada?.raices));
  comprobar(Array.isArray(estado.herramientas) && estado.herramientas.length === 13, 'lista sus 13 herramientas, con cuáles son de sólo lectura');
  comprobar(Array.isArray(estado.sesiones?.clientes) && estado.sesiones.clientes.includes('prueba-r26'), 'dice las sesiones (clientes) que han hablado con él: ' + JSON.stringify(estado.sesiones?.clientes));
  const comoTexto = JSON.stringify(estado);
  comprobar(!comoTexto.includes(casa) && !comoTexto.includes('credentials') && !/"casa"|"motor"/.test(comoTexto), 'NO publica la casa ni el motor ni ninguna clave');

  // ── 4 · LAS DOS HERRAMIENTAS DE SÓLO LECTURA, CON TRAMPAS ───────────────
  di('· list_files y read_file, contra cada trampa');
  const listado = datoDe(await cliente.callTool({ name: 'list_files', arguments: {} }));
  comprobar(listado.carpeta === canonica(taller) && listado.entradas.some((e) => e.nombre === 'dentro.txt'), 'list_files sin ruta lista la carpeta autorizada');
  const sub = datoDe(await cliente.callTool({ name: 'list_files', arguments: { ruta: 'sub' } }));
  comprobar(sub.entradas?.some((e) => e.nombre === 'nota.txt'), 'y con `ruta: "sub"` (relativa) lista la subcarpeta');
  const leido = datoDe(await cliente.callTool({ name: 'read_file', arguments: { ruta: 'dentro.txt' } }));
  comprobar(leido.texto === CANARIO_DENTRO + '\n' && leido.truncado === false, 'read_file de `dentro.txt` devuelve el contenido EXACTO');
  const leidoAbsoluto = datoDe(await cliente.callTool({ name: 'read_file', arguments: { ruta: join(taller, 'sub', 'nota.txt') } }));
  comprobar(String(leidoAbsoluto.texto ?? '').includes('nota de dentro'), 'read_file con ruta ABSOLUTA de dentro también vale');
  const binario = await respuestaDe(cliente, 'read_file', { ruta: 'binario.bin' });
  comprobar(binario.isError === true && /binario/.test(binario.content?.[0]?.text ?? ''), 'un fichero binario → error claro, no un volcado: ' + String(binario.content?.[0]?.text ?? '').slice(0, 70));
  const esCarpeta = await respuestaDe(cliente, 'read_file', { ruta: 'sub' });
  comprobar(esCarpeta.isError === true && /es una carpeta/.test(datoDe(esCarpeta).texto ?? esCarpeta.content?.[0]?.text ?? ''), 'pedir un fichero que es carpeta → error claro, no un volcado');

  const trampas = [
    ['relativa con `..`', '..\\' + NOMBRE_FUERA + '\\canario.txt'],
    ['absoluta', CRUDO_FUERA],
    ['prefijo `\\\\?\\`', '\\\\?\\' + CRUDO_FUERA],
    ['UNC de otro equipo', '\\\\otro-pc\\recurso\\canario.txt'],
    ...(hayEnlace ? [['por la unión de dentro', join(ENLACE, 'canario.txt')]] : []),
    ...(CORTO_FUERA === null ? [] : [['por el nombre corto 8.3', join(base, CORTO_FUERA, 'canario.txt')]]),
    ['el fichero de la casa (ratacode.yaml)', join(casa, 'ratacode.yaml')],
    ['un fichero de la casa por `..`', '..\\casa\\AGENTS.md'],
    // Las mismas por `/`, que es lo que separa en todas partes.
    ['relativa con `../`', '../' + NOMBRE_FUERA + '/canario.txt'],
    ['un fichero de la casa por `../`', '../casa/AGENTS.md'],
  ];
  /** Las trampas con `\\` sólo son rutas en Windows: en otro sitio son un nombre raro. */
  const deWindows = (ruta) => ruta.includes('\\') && !ruta.includes('/');
  for (const [como, ruta] of trampas) {
    const r = await respuestaDe(cliente, 'read_file', { ruta });
    const texto = r.content?.[0]?.text ?? '';
    (deWindows(ruta) ? comprobarEnWindows : comprobar)(r.isError === true && /Fuera de la carpeta autorizada/.test(texto) && !texto.includes(CANARIO),
      'read_file · ' + como + ' → rechazado por el SERVIDOR: ' + texto.slice(0, 100).replace(/\s+/g, ' '));
  }
  if (CORTO_TALLER !== null) {
    const porCorto = datoDe(await cliente.callTool({ name: 'read_file', arguments: { ruta: join(base, CORTO_TALLER, 'dentro.txt') } }));
    comprobar(porCorto.texto === CANARIO_DENTRO + '\n', 'read_file · por el nombre corto 8.3 ' + CORTO_TALLER + ' (que ES la carpeta autorizada) → sí lee');
  }
  const listarFuera = await respuestaDe(cliente, 'list_files', { ruta: '..' });
  comprobar(listarFuera.isError === true && /Fuera de la carpeta autorizada/.test(listarFuera.content?.[0]?.text ?? ''), 'list_files · con `..` → rechazado por el SERVIDOR');
  if (hayEnlace) {
    const listarEnlace = await respuestaDe(cliente, 'list_files', { ruta: 'enlace' });
    comprobar(listarEnlace.isError === true, 'list_files · por la unión que apunta fuera → rechazado');
  }
  const sinRuta = await respuestaDe(cliente, 'read_file', {});
  comprobar(sinRuta.isError === true, 'read_file sin ruta → error (no «todo el disco»)');

  // ── 5 · EL MOTOR: LO QUE CARGA SOLO, DESDE FUERA (AGENTS.md Y SKILLS) ───
  di('· el motor de verdad: instrucciones y habilidades de fuera');
  const huecos = await arrancarMcp({
    carpetaCasa: casaHuecos,
    puerto: PUERTO_MCP_HUECOS,
    motor: join(AQUI, 'dsh-con-huecos.mjs'),
  });
  mcpHuecos.proceso = huecos.proceso;
  clienteHuecos = new Client({ name: 'prueba-r26-huecos', version: '0.0.1' });
  await clienteHuecos.connect(new StreamableHTTPClientTransport(new URL(huecos.url)));
  const antes = await tarea(clienteHuecos, 'huecos');
  const conHuecos = JSON.stringify(llm.peticionesDe('huecos'));
  const fugaAgents = conHuecos.includes(CANARIO_AGENTS);
  const fugaSkill = conHuecos.includes(CANARIO_SKILL);
  di('   (sin el apagado: AGENTS.md ' + (fugaAgents ? 'LLEGA' : 'no llega') + ' al modelo, skill ' + (fugaSkill ? 'LLEGA' : 'no llega') + ')');
  comprobar(antes.recibo.task_id !== undefined, 'la tarea del motor «con huecos» corre igual (el montaje del antes funciona)');

  const despues = await tarea(cliente, 'tapado');
  const tapado = JSON.stringify(llm.peticionesDe('tapado'));
  comprobar(!tapado.includes(CANARIO_AGENTS), 'con el MCP de verdad, el AGENTS.md de FUERA no llega al modelo');
  comprobar(!tapado.includes(CANARIO_SKILL), 'y la habilidad (skill) de FUERA tampoco');
  comprobar(!tapado.includes(CANARIO), 'ni el canario de la carpeta de fuera, por ninguna vía');
  const pasos = transcripcion(llm.peticionesDe('tapado'));
  comprobar(pasos.length >= 1 && String(pasos[0].resultado ?? '').includes(CANARIO_DENTRO), 'y leer DENTRO sigue funcionando (la tarea leyó `dentro.txt`): ' + String(pasos[0]?.resultado ?? '').slice(0, 70));
  comprobar(despues.recibo.modo === 'workspace-write', 'la tarea sigue en `workspace-write` (la trampa de la casa no manda)');
  comprobar(despues.resultado?.estado === 'completed', 'y la tarea del MCP termina bien (' + despues.resultado?.estado + ')');
  if (fugaAgents || fugaSkill) {
    di('   (el agujero era REAL: sin el apagado, el motor se traía ' + [fugaAgents ? 'las instrucciones' : null, fugaSkill ? 'las habilidades' : null].filter(Boolean).join(' y ') + ' de fuera)');
    const donde = fugaAgents ? conHuecos.indexOf(CANARIO_AGENTS) : conHuecos.indexOf(CANARIO_SKILL);
    di('   (literal de lo que el modelo recibió entonces: …' + conHuecos.slice(Math.max(0, donde - 150), donde + 60).replace(/\\[nrt]/g, ' ').replace(/\s+/g, ' ') + '…)');
  } else {
    di('   (aviso: con este montaje el agujero NO se reprodujo; el apagado sigue puesto como defensa)');
  }

  // ── 6 · LOS PATRONES DE GLOB/GREP, QUE TAMBIÉN PUEDEN APUNTAR HACIA FUERA ─
  di('· los patrones de glob y grep');
  const conGlob = await tarea(cliente, 'glob');
  const pasosGlob = transcripcion(llm.peticionesDe('glob'));
  const texto = (i) => String(pasosGlob[i]?.resultado ?? '');
  comprobar(texto(0).includes('dentro.txt'), 'glob con `pattern: **/*.txt` y `path` dentro → lista lo de dentro');
  comprobar(texto(2).length > 0 && /Fuera de la carpeta autorizada/.test(texto(2)), 'glob con `path` FUERA → denegado por el cerco: ' + texto(2).slice(0, 90).replace(/\s+/g, ' '));
  comprobar(texto(3).includes(CANARIO_DENTRO), 'grep dentro encuentra el contenido de dentro');
  const fugaGlob = [texto(1), texto(4)].join('\n');
  comprobar(!fugaGlob.includes('canario.txt') && !fugaGlob.includes(NOMBRE_FUERA) && !fugaGlob.includes('AGENTS.md'),
    'y ni `..\\..\\**` como PATRÓN ni `..\\..\\*.txt` como INCLUDE sacan nada de fuera («' + texto(1).trim() + '» / «' + texto(4).trim() + '»)');
  comprobar(conGlob.recibo.task_id !== undefined && conGlob.resultado?.estado === 'completed', 'la tarea de glob/grep termina bien');

  // ── 7 · ¿ALGUNA HERRAMIENTA DEL MOTOR PIDE LA RUTA CON OTRO NOMBRE? ─────
  di('· el nombre del parámetro de ruta en las herramientas del motor');
  const esquemas = llm.peticionesDe('tapado')[0]?.esquemas ?? [];
  const sospechosas = [];
  let claves = 0;
  for (const t of esquemas) {
    for (const clave of Object.keys(t.function?.parameters?.properties ?? {})) {
      claves += 1;
      // Sólo el NOMBRE del parámetro: si se llama como una ruta, el cerco tiene
      // que mirarlo (`CLAVES_DE_RUTA`); si no se llama así, no es una ruta.
      if (/path|file|dir|folder|carpeta|ruta|root|workspace/i.test(clave) && !CLAVES_DE_RUTA.includes(clave)) {
        sospechosas.push(t.function.name + '.' + clave);
      }
    }
  }
  comprobar(sospechosas.length === 0, 'ninguna herramienta del motor pide la ruta con un nombre que el cerco NO mire'
    + (sospechosas.length === 0 ? ' (' + esquemas.length + ' herramientas, ' + claves + ' parámetros mirados)' : ': ' + sospechosas.join(', ')));
  comprobar(!esquemas.some((t) => ['pwsh', 'bash', 'web_search', 'web_fetch', 'job_kill', 'subagent'].includes(t.function?.name)),
    'y no hay terminal, ni red, ni subagentes (herramientas apagadas): ' + esquemas.map((t) => t.function?.name).join(', '));

  di('');
  di(fallos.length === 0
    ? 'VERDE · el MCP lee lo suyo y nada más: sólo lectura de verdad, con el cerco en el servidor, y sin traerse nada de fuera.'
      + (sinComprobar.length > 0 ? ' (' + sinComprobar.length + ' comprobación(es) sólo de Windows, sin comprobar aquí)' : '')
    : 'ROJO · ' + fallos.length + ' cosa(s) mal.');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = fallos.length === 0 ? 0 : 1;
} catch (e) {
  di('ROJO · la prueba se rompió: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exitCode = 1;
} finally {
  try { if (cliente !== null) await cliente.close(); } catch { /* da igual */ }
  try { if (clienteHuecos !== null) await clienteHuecos.close(); } catch { /* da igual */ }
  matar(mcp.proceso);
  matar(mcpHuecos.proceso);
  try { llm.parar(); } catch { /* da igual */ }
  try { rmSync(base, { recursive: true, force: true }); } catch { /* da igual */ }
  if (existsSync(base)) di('(no pude borrar ' + base + ')');
}

/** Matar SÓLO el árbol de un proceso que hemos arrancado nosotros. */
function matar(proceso) {
  if (proceso === null || proceso?.pid === undefined || proceso.killed) return;
  try {
    if (process.platform === 'win32') spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + proceso.pid + ' /T /F'], { windowsHide: true, stdio: 'ignore' });
    else proceso.kill('SIGTERM');
  } catch { /* ya se fue */ }
}

/** El resultado de una herramienta, tal cual (para poder mirar `isError`). */
function respuestaDe(cli, nombre, argumentos) {
  return cli.callTool({ name: nombre, arguments: argumentos });
}

/** Leer un fichero con el cerco, sin que un error pare la prueba. */
function leerFicheroSeguro(ruta) {
  try { return leerFichero({ ruta, raices: [taller], cwd: taller }).texto; } catch { return null; }
}

/** Lanzar una tarea con su etiqueta y esperar a que termine. */
async function tarea(cli, etiqueta) {
  const lanzada = datoDe(await cli.callTool({
    name: 'run_task',
    arguments: {
      prompt: '[R26:' + etiqueta + '] prueba de R26',
      working_directory: taller,
      esperar_segundos: 120,
      timeout: 120000,
    },
  }));
  if (lanzada.task_id === undefined) return { recibo: lanzada, resultado: null };
  const resultado = lanzada.resultado ?? datoDe(await cli.callTool({ name: 'get_task_result', arguments: { task_id: lanzada.task_id } }));
  return { recibo: lanzada, resultado };
}
