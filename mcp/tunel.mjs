#!/usr/bin/env node
/**
 * tunel.mjs — el túnel de Cloudflare para ChatGPT web.
 *
 * ⚠️ NO lo ejecutes tú solo: lo arranca el usuario cuando quiera abrir RATACODE a
 * ChatGPT. Este script SÓLO es transporte: el servidor MCP (con su clave en la
 * URL y su tope de tareas) ya funciona sin esto; el túnel sólo lo expone a
 * Internet mientras corre.
 *
 * Y exponerlo ya NO expone nada de más: cada tarea va encerrada en las carpetas
 * de `mcp.workspaces` (lee y escribe sólo ahí, sin terminal ni red ni
 * subagentes), así que quien tenga la URL puede mandar trabajo, pero no sacar
 * ficheros de fuera de esas carpetas. Antes hacía falta `--acepto-lectura-total`
 * porque el motor no encerraba la LECTURA; desde R25 sí está encerrada (mira
 * `lib/lectura.js`) y la bandera es un no-op que se acepta por no romper nada.
 *
 * Qué hace al ejecutarlo:
 *   1. Lee la URL local del MCP (http://127.0.0.1:<puerto>/mcp/<clave>) de la
 *      casa (<casa>/mcp/http-url.txt, o la reconstruye desde http-secret.txt).
 *   2. Comprueba que `cloudflared` está instalado.
 *   3. Si existe el túnel nombrado `mcp.mod-rat.com` (lo da de alta el usuario en
 *      su Cloudflare), lo usa con ese hostname fijo (por fichero de config, no
 *      por argumentos).
 *   4. Si no, usa un quick tunnel sin cuenta (URL efímera).
 *   5. Imprime la URL pública COMPLETA para pegar en ChatGPT (dominio + /mcp/<clave>).
 *
 * Uso:
 *   node mcp/tunel.mjs --home <casa> [--port <puerto>] [--host 127.0.0.1] [--misma-clave]
 *
 * Al abrirlo estrena clave (el servidor que ya corre la adopta sin reiniciar);
 * con `--misma-clave` reutiliza la que había.
 *
 * Para pararlo: Ctrl+C (mata cloudflared y deja de exponer el puerto).
 */
import { randomBytes } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolverCasa } from './lib/casa.js';

const TUNEL_NOMBRADO = 'mcp.mod-rat.com';

/** Escribir un secreto con permisos de sólo-dueño (en POSIX el `mode` no se
 *  aplica si el fichero ya existía: por eso el `chmod` detrás). */
function escribirSoloDueno(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
  try { chmodSync(ruta, 0o600); } catch { /* Windows: el modo es decorativo */ }
}

function leerOrdenes(argv) {
  const o = { casa: undefined, port: 3778, aceptoLecturaTotal: false, mismaClave: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--acepto-lectura-total') { o.aceptoLecturaTotal = true; continue; }
    if (a === '--misma-clave') { o.mismaClave = true; continue; }
    const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) o.casa = v;
    else if (a === '--port' || a.startsWith('--port=')) o.port = Number(v);
    else if (a === '--host' || a.startsWith('--host=')) o.host = v;
    else throw new Error('no entiendo ' + a);
  }
  return o;
}

const o = leerOrdenes(process.argv.slice(2));

// R25 · `--acepto-lectura-total` ya no hace falta (y no hace nada): la lectura
// va encerrada por el mismo cerco que en el MCP local. Se sigue aceptando para
// no romper los comandos antiguos.

const casa = resolverCasa(o.casa);
const host = o.host ?? '127.0.0.1';
const puerto = o.port;

/** Dónde queda constancia de que el túnel está ABIERTO: `<casa>\mcp\tunel-url.txt`.
 *  Lo lee Ajustes > Conexiones (la piel, ruta /ratacode/conexion) para decir si el
 *  túnel está abierto y enseñar la URL pública. Se borra al cerrar el túnel, así
 *  que su presencia es señal de que hay alguien exponiendo el puerto. */
const RUTA_TUNEL_ABIERTO = join(casa, 'mcp', 'tunel-url.txt');
/** La de la vez anterior no vale: hasta que cloudflared no dé la URL, no hay túnel. */
try { rmSync(RUTA_TUNEL_ABIERTO, { force: true }); } catch { /* no había nada */ }

/** El origen y la clave del MCP, tal como los dejó `ratacode mcp --http`. */
function urlLocal() {
  const rutaUrl = join(casa, 'mcp', 'http-url.txt');
  let deFichero = null;
  if (existsSync(rutaUrl)) {
    const u = readFileSync(rutaUrl, 'utf8').trim();
    if (u.startsWith('http') && u.includes('/mcp/')) deFichero = u;
  }
  if (deFichero === null) {
    const rutaClave = join(casa, 'mcp', 'http-secret.txt');
    if (!existsSync(rutaClave)) {
      throw new Error('no encuentro la clave del MCP en ' + rutaClave + '. Arranca primero: ratacode mcp --http --port ' + puerto + ' --home ' + casa);
    }
    const leida = readFileSync(rutaClave, 'utf8').trim();
    return { origen: 'http://' + host + ':' + puerto, clave: leida };
  }
  const corte = deFichero.indexOf('/mcp/');
  return { origen: deFichero.slice(0, corte), clave: deFichero.slice(corte + '/mcp/'.length) };
}

let { origen, clave } = urlLocal();

// CLAVE NUEVA AL ABRIR EL TÚNEL (esto es lo que se expone a Internet). El
// servidor que ya está en marcha la adopta solo (mira `lib/http.js`): relee
// `<casa>\mcp\http-secret.txt` cada dos segundos. Con `--misma-clave` se
// reutiliza la que había (útil si el cliente ya la tiene pegada).
if (o.mismaClave !== true) {
  const nueva = randomBytes(32).toString('hex');
  escribirSoloDueno(join(casa, 'mcp', 'http-secret.txt'), nueva + '\n');
  clave = nueva;
  console.log('Clave NUEVA para esta sesión del túnel (la anterior ya no vale).');
} else {
  console.log('Reutilizando la clave que ya había (--misma-clave).');
}
escribirSoloDueno(join(casa, 'mcp', 'http-url.txt'), origen + '/mcp/' + clave + '\n');

console.log('URL local del MCP: ' + origen + '/mcp/<oculta> (la clave está en ' + join(casa, 'mcp', 'http-url.txt') + ')');

// 1) ¿Está cloudflared?
const donde = spawnSync('where', ['cloudflared'], { encoding: 'utf8' });
if (donde.status !== 0) {
  console.log('\n✋ cloudflared NO está instalado en este equipo.');
  console.log('   Instálalo (Windows): winget install Cloudflare.cloudflared');
  console.log('   o descárgalo de https://github.com/cloudflare/cloudflared/releases');
  console.log('   Luego vuelve a ejecutar este script.');
  process.exit(2);
}
console.log('cloudflared encontrado: ' + donde.stdout.trim().split('\n')[0]);

// 2) ¿Existe el túnel nombrado del usuario?
let modo = 'quick';
let args;
const lista = spawnSync('cloudflared', ['tunnel', 'list'], { encoding: 'utf8' });
if (lista.status === 0 && lista.stdout.includes(TUNEL_NOMBRADO)) {
  modo = 'nombrado';
  // Un túnel nombrado necesita una regla de entrada (hostname → servicio) y su
  // credencial; se pasa por FICHERO de configuración, no por argumentos (los
  // argumentos de cualquier proceso los ve cualquier proceso local).
  const rutaConfig = join(casa, 'mcp', 'cloudflared.yml');
  mkdirSync(join(casa, 'mcp'), { recursive: true });
  writeFileSync(rutaConfig, [
    '# RATACODE · config del túnel nombrado. Lo escribe mcp/tunel.mjs.',
    'tunnel: ' + TUNEL_NOMBRADO,
    'ingress:',
    '  - hostname: ' + TUNEL_NOMBRADO,
    '    service: ' + origen,
    '  - service: http_status:404',
    '',
  ].join('\n'), { mode: 0o600 });
  args = ['tunnel', '--config', rutaConfig, 'run', TUNEL_NOMBRADO];
  console.log('\nUsando túnel nombrado fijo: ' + TUNEL_NOMBRADO + ' (config: ' + rutaConfig + ')');
} else {
  modo = 'quick';
  // A cloudflared se le pasa SÓLO el origen (sin la clave): el prefijo /mcp/<clave>
  // viaja en la URL pública que se imprime abajo, no en los argumentos.
  args = ['tunnel', '--url', origen];
  console.log('\nNo hay túnel nombrado configurado; usando quick tunnel (URL efímera).');
}

console.log('\nArrancando cloudflared ' + (modo === 'nombrado' ? '(hostname fijo ' + TUNEL_NOMBRADO + ')' : '(quick tunnel)') + '...');
console.log('En cuanto dé la URL pública, aquí abajo saldrá COMPLETA (dominio + /mcp/<clave>).\n');

/**
 * De la salida de cloudflared, la URL pública que sirve. El quick tunnel la
 * escribe como `https://<algo>.trycloudflare.com`; el nombrado es el hostname.
 */
function dominioPublico(trozo) {
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(trozo);
  if (m !== null) return m[0];
  if (modo === 'nombrado' && trozo.includes(TUNEL_NOMBRADO)) return 'https://' + TUNEL_NOMBRADO;
  return null;
}

// 3) Arrancar cloudflared y dejarlo vivo; Ctrl+C para parar.
// La salida va por tubería (no heredada) para poder CAZAR el dominio público y
// enseñar la URL completa; se reenvía tal cual a la consola.
let visto = '';
let anunciada = false;
const proc = spawn('cloudflared', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
const mirar = (trozo, destino) => {
  destino.write(trozo);
  if (anunciada) return;
  visto = (visto + trozo).slice(-16384);
  const dominio = dominioPublico(visto);
  if (dominio === null) return;
  anunciada = true;
  // La URL pública COMPLETA (dominio + /mcp/<clave>) queda en la casa, para que
  // Ajustes > Conexiones pueda decir «conectado» y enseñarla sin que nadie
  // tenga que copiarla de la consola. Sólo-dueño, y se borra al cerrar.
  try { escribirSoloDueno(RUTA_TUNEL_ABIERTO, dominio + '/mcp/' + clave + '\n'); } catch { /* la casa manda, pero no es imprescindible */ }
  process.stdout.write('\n============================================================\n');
  process.stdout.write('URL PÚBLICA DEL MCP (pégala en ChatGPT, modo desarrollador):\n');
  process.stdout.write('  ' + dominio + '/mcp/' + clave + '\n');
  process.stdout.write('============================================================\n\n');
};
proc.stdout.setEncoding('utf8');
proc.stdout.on('data', (t) => mirar(t, process.stdout));
proc.stderr.setEncoding('utf8');
proc.stderr.on('data', (t) => mirar(t, process.stderr));
proc.on('exit', (code) => {
  try { rmSync(RUTA_TUNEL_ABIERTO, { force: true }); } catch { /* da igual */ }
  console.log('\ncloudflared terminó (código ' + code + '). El túnel está cerrado; el puerto ya no se expone.');
  process.exit(code ?? 0);
});
process.on('SIGINT', () => { proc.kill('SIGINT'); });
process.on('SIGTERM', () => { proc.kill('SIGTERM'); });
