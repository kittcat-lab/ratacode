#!/usr/bin/env node
/**
 * PRUEBA DE ACEPTACIÓN de R26 (a mano, NO va en `npm test`).
 *
 * Hace lo que pide la entrega, con la carpeta de verdad del usuario:
 *   1 · crea `MCP_PRUEBA.txt` con «RATACODE MCP OK 7429» dentro de la carpeta
 *       autorizada (`C:\Users\patxi\Desktop\DEVAPPS\prueba-usuario`);
 *   2 · arranca el MCP por HTTP (127.0.0.1:3385) con una casa temporal que
 *       autoriza SÓLO esa carpeta;
 *   3 · como cliente MCP: lista la carpeta (tiene que traerlo), lo lee (tiene
 *       que ser exacto) y prueba a leer un canario de FUERA (tiene que
 *       rechazarlo EL SERVIDOR).
 *
 * Uso: node pruebas/mcp-aceptacion.mjs [carpeta-autorizada]
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
const PUERTO = 3385;
const AUTORIZADA = resolve(process.argv[2] ?? 'C:\\Users\\patxi\\Desktop\\DEVAPPS\\prueba-usuario');
const CONTENIDO = 'RATACODE MCP OK 7429';
const CANARIO = 'CANARIO-R26-ACEPTACION-9917';

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

// ── 1 · EL FICHERO DE LA PRUEBA ────────────────────────────────────────────
mkdirSync(AUTORIZADA, { recursive: true });
const PRUEBA = join(AUTORIZADA, 'MCP_PRUEBA.txt');
writeFileSync(PRUEBA, CONTENIDO + '\n');
di('· creado ' + PRUEBA + ' con «' + CONTENIDO + '»');
comprobar(existsSync(PRUEBA), 'el fichero de la prueba existe');

/** El canario, en un directorio temporal: FUERA de la carpeta autorizada. */
const base = mkdtempSync(join(tmpdir(), 'ratacode-r26-aceptacion-'));
const canario = join(base, 'canario-fuera.txt');
writeFileSync(canario, CANARIO + ' (esto NO se puede leer)\n');
di('· el canario de fuera: ' + canario);

// ── 2 · LA CASA Y EL MCP ───────────────────────────────────────────────────
const casa = join(base, 'casa');
mkdirSync(casa, { recursive: true });
writeFileSync(join(casa, 'settings.yaml'), [
  'mcp:',
  '  workspaces:',
  "    - '" + AUTORIZADA + "'",
  '',
].join('\n'));

const mcp = spawn(process.execPath, [
  join(PRODUCTO, 'mcp', 'bin', 'ratacode-mcp.js'),
  '--home', casa,
  '--http',
  '--port', String(PUERTO),
], { cwd: AUTORIZADA, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
    await new Promise((listo) => setTimeout(listo, 500));
    try {
      const leida = readFileSync(rutaUrl, 'utf8').trim();
      if (leida.startsWith('http')) url = leida;
    } catch { /* todavía no */ }
  }
  comprobar(url !== null, 'el MCP por HTTP escucha en 127.0.0.1:' + PUERTO);
  if (url === null) throw new Error('el MCP no arrancó:\n' + salida);
  di('· dirección (con la clave oculta): ' + url.replace(/\/mcp\/.*$/, '/mcp/<oculta>'));

  cliente = new Client({ name: 'aceptacion-r26', version: '0.0.1' });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(url)));

  // ── 3 · LO QUE SE LE PIDE ────────────────────────────────────────────────
  const estado = datoDe(await cliente.callTool({ name: 'ratacode_status', arguments: {} }));
  di('· ratacode_status: vivo=' + estado.vivo + ' · versión=' + estado.version + ' · carpeta=' + JSON.stringify(estado.carpeta_autorizada?.raices));
  comprobar(estado.vivo === true, 'el servidor está vivo y lo dice');
  comprobar((estado.carpeta_autorizada?.raices ?? []).includes(AUTORIZADA.toLowerCase()) || (estado.carpeta_autorizada?.raices ?? []).some((r) => r.toLowerCase() === AUTORIZADA.toLowerCase()),
    'la carpeta autorizada es la de la prueba: ' + JSON.stringify(estado.carpeta_autorizada?.raices));

  const listado = datoDe(await cliente.callTool({ name: 'list_files', arguments: {} }));
  di('· list_files → ' + (listado.entradas ?? []).map((e) => e.nombre + ' (' + e.tipo + ')').join(', '));
  comprobar((listado.entradas ?? []).some((e) => e.nombre === 'MCP_PRUEBA.txt'), 'listar la carpeta autorizada TRAE MCP_PRUEBA.txt');

  const leido = datoDe(await cliente.callTool({ name: 'read_file', arguments: { ruta: 'MCP_PRUEBA.txt' } }));
  di('· read_file("MCP_PRUEBA.txt") → «' + String(leido.texto ?? '').trim() + '»');
  comprobar(String(leido.texto ?? '').trim() === CONTENIDO, 'leerlo devuelve EXACTAMENTE «' + CONTENIDO + '»');

  const listadoCorto = datoDe(await cliente.callTool({ name: 'list_files', arguments: { ruta: 'C:\\Users\\patxi\\Desktop\\DEVAPPS\\PRUEBA~1' } }));
  comprobar((listadoCorto.entradas ?? []).some((e) => e.nombre === 'MCP_PRUEBA.txt'), 'y por el nombre corto 8.3 (PRUEBA~1) también: es la misma carpeta');

  const porFuera = await cliente.callTool({ name: 'read_file', arguments: { ruta: canario } });
  const textoFuera = porFuera.content?.[0]?.text ?? '';
  di('· read_file del canario de fuera → ' + textoFuera.replace(/\s+/g, ' ').slice(0, 140));
  comprobar(porFuera.isError === true && /Fuera de la carpeta autorizada/.test(textoFuera), 'leer el canario de FUERA lo rechaza EL SERVIDOR');
  comprobar(!textoFuera.includes(CANARIO), 'y no suelta ni una letra del canario');

  const listarFuera = await cliente.callTool({ name: 'list_files', arguments: { ruta: base } });
  comprobar(listarFuera.isError === true, 'y listar la carpeta de fuera también se rechaza');

  di('');
  di(fallos.length === 0
    ? 'VERDE · la aceptación de R26: ChatGPT (o cualquier cliente MCP) puede consultar la carpeta autorizada y nada más.'
    : 'ROJO · ' + fallos.length + ' cosa(s) mal de ' + cuantas + '.');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = fallos.length === 0 ? 0 : 1;
} catch (e) {
  di('ROJO · la prueba de aceptación se rompió: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exitCode = 1;
} finally {
  try { if (cliente !== null) await cliente.close(); } catch { /* da igual */ }
  try {
    spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + mcp.pid + ' /T /F'], { windowsHide: true, stdio: 'ignore' });
  } catch { /* ya se fue */ }
  await new Promise((listo) => setTimeout(listo, 1500));
  try { rmSync(base, { recursive: true, force: true }); } catch { /* da igual */ }
  if (existsSync(base)) di('(no pude borrar ' + base + ')');
}
