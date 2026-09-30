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
 *   3. Si la casa tiene TÚNEL CON NOMBRE (`mcp.tunel_nombre` y `mcp.tunel_host`,
 *      que el usuario da de alta en su Cloudflare), lo arranca con
 *      `cloudflared tunnel run --url <origen> <nombre>` y la dirección es FIJA:
 *      `https://<host>/mcp/<clave>`. Aquí no se hace login ni se crea nada, y
 *      las credenciales de `%USERPROFILE%\.cloudflared` no se leen.
 *   4. Si no, usa el túnel rápido sin cuenta (URL efímera, cambia cada vez).
 *   5. Imprime la URL pública COMPLETA para pegar en ChatGPT (dominio + /mcp/<clave>).
 *
 * Uso:
 *   node mcp/tunel.mjs --home <casa> [--port <puerto>] [--host 127.0.0.1] [--misma-clave]
 *                      [--tunel-nombre <nombre>] [--tunel-host <host>] [--cloudflared <ruta>]
 *
 * Al abrirlo estrena clave (el servidor que ya corre la adopta sin reiniciar);
 * con `--misma-clave` reutiliza la que había (que es lo que usa el botón
 * «Encender» del panel, para que la dirección no cambie). Dónde está el
 * `cloudflared` se puede decir con `--cloudflared <ruta>` o con la variable
 * `RATACODE_CLOUDFLARED`; si no, se busca en el PATH.
 *
 * Para pararlo: Ctrl+C (mata cloudflared y deja de exponer el puerto).
 */
import { randomBytes } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ajustesMcp, resolverCasa } from './lib/casa.js';

/** Escribir un secreto con permisos de sólo-dueño (en POSIX el `mode` no se
 *  aplica si el fichero ya existía: por eso el `chmod` detrás). */
function escribirSoloDueno(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
  try { chmodSync(ruta, 0o600); } catch { /* Windows: el modo es decorativo */ }
}

function leerOrdenes(argv) {
  const o = { casa: undefined, port: 3778, aceptoLecturaTotal: false, mismaClave: false, cloudflared: process.env.RATACODE_CLOUDFLARED, tunelNombre: undefined, tunelHost: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--acepto-lectura-total') { o.aceptoLecturaTotal = true; continue; }
    if (a === '--misma-clave') { o.mismaClave = true; continue; }
    const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) o.casa = v;
    else if (a === '--port' || a.startsWith('--port=')) o.port = Number(v);
    else if (a === '--host' || a.startsWith('--host=')) o.host = v;
    else if (a === '--nombre' || a.startsWith('--nombre=')) o.tunelNombre = v;
    else if (a === '--tunel-nombre' || a.startsWith('--tunel-nombre=')) o.tunelNombre = v;
    else if (a === '--tunel-host' || a.startsWith('--tunel-host=')) o.tunelHost = v;
    else if (a === '--cloudflared' || a.startsWith('--cloudflared=')) o.cloudflared = v;
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

/**
 * R27 §8 · EL TÚNEL CON NOMBRE de esta casa (dirección fija), si lo tiene:
 * `mcp.tunel_nombre` y `mcp.tunel_host` de `settings.yaml`. Los `--tunel-nombre`
 * y `--tunel-host` de la línea de órdenes mandan sobre los ajustes (es lo que
 * usa la piel, que los lee del mismo sitio).
 */
const ajustesTunel = (() => {
  try { return ajustesMcp(casa); } catch { return { tunelNombre: undefined, tunelHost: undefined }; }
})();
const nombreTunel = o.tunelNombre ?? ajustesTunel.tunelNombre ?? null;
const hostTunel = o.tunelHost ?? ajustesTunel.tunelHost ?? null;

/** Dónde queda constancia de que el túnel está ABIERTO: `<casa>\mcp\tunel-url.txt`.
 *  Lo lee Ajustes > Conexiones (la piel, ruta /ratacode/conexion) para decir si el
 *  túnel está abierto y enseñar la URL pública. Se borra al cerrar el túnel, así
 *  que su presencia es señal de que hay alguien exponiendo el puerto. */
const RUTA_TUNEL_ABIERTO = join(casa, 'mcp', 'tunel-url.txt');
/** R27 · y `<casa>\mcp\tunel.pid`: el pid de cloudflared. El puerto del MCP se
 *  puede sondear (escucha o no escucha), pero un túnel no: su dominio contesta
 *  aunque no haya nadie detrás. Lo que SÍ es verdad local es que cloudflared
 *  siga existiendo, y eso es lo que mira la piel para no decir «Conectado» con
 *  el túnel muerto. Se borra al cerrar, como la URL. */
const RUTA_TUNEL_PID = join(casa, 'mcp', 'tunel.pid');
/** La de la vez anterior no vale: hasta que cloudflared no dé la URL, no hay túnel. */
try { rmSync(RUTA_TUNEL_ABIERTO, { force: true }); } catch { /* no había nada */ }
try { rmSync(RUTA_TUNEL_PID, { force: true }); } catch { /* no había nada */ }

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
// R27 · dónde está cloudflared: se puede decir con `--cloudflared <ruta>` o con
// la variable `RATACODE_CLOUDFLARED` (útil si lo tienes en un sitio raro, y es
// también lo que usan las pruebas para poner uno de mentira y NO abrir un túnel
// público). Si no se dice nada, se busca en el PATH, como siempre.
const donde = o.cloudflared !== undefined
  ? { status: 0, stdout: o.cloudflared + '\n' }
  : spawnSync('where', ['cloudflared'], { encoding: 'utf8' });
if (donde.status !== 0 || String(donde.stdout ?? '').trim() === '') {
  console.log('\n✋ cloudflared NO está instalado en este equipo.');
  console.log('   Instálalo (Windows): winget install Cloudflare.cloudflared');
  console.log('   o descárgalo de https://github.com/cloudflare/cloudflared/releases');
  console.log('   Luego vuelve a ejecutar este script.');
  process.exit(2);
}
const exeCloudflared = String(donde.stdout).trim().split('\n')[0].trim();
console.log('cloudflared encontrado: ' + exeCloudflared);
/**
 * Cómo se lanza lo que haya en `exeCloudflared`:
 *   · un `.cmd`/`.bat` de Windows necesita shell (si no, `spawn` da EFTYPE);
 *   · un `.js`/`.mjs`/`.cjs` es un guion de Node: se lanza CON node (con shell
 *     no vale: `cmd` no ejecuta un `.cjs`, y en Windows un `.mjs` no es
 *     ejecutable). Sirve para tener un cloudflared de pruebas sin inventar un
 *     binario.
 *   · lo demás se lanza tal cual.
 */
const esGuionWindows = /\.(cmd|bat)$/i.test(exeCloudflared);
const esGuionNode = /\.(c?js|mjs)$/i.test(exeCloudflared);
const comoSeLanza = esGuionNode
  ? { orden: process.execPath, args: [exeCloudflared], shell: false }
  : { orden: exeCloudflared, args: [], shell: esGuionWindows };

// 2) ¿TÚNEL CON NOMBRE O TÚNEL RÁPIDO? (R27 §8)
//
// El túnel RÁPIDO (sin cuenta) da un dominio NUEVO cada vez, así que la
// dirección que ChatGPT tiene pegada deja de valer. El túnel CON NOMBRE da una
// dirección FIJA (`https://<host>/mcp/<clave>`), y se declara en la casa:
//
//   mcp:
//     tunel_nombre: ratacode
//     tunel_host: ratacode.kittcat.com
//
// El túnel y su DNS los da de alta el HUMANO en su Cloudflare (aquí no se hace
// login ni se crea nada, y las credenciales de `%USERPROFILE%\.cloudflared` no
// se leen: las usa cloudflared). Si no hay nombre y host, se usa el rápido.
let modo = 'quick';
let args;
let urlFija = null;
if (nombreTunel !== null && hostTunel !== null) {
  modo = 'nombrado';
  // Un túnel con nombre necesita una regla de entrada (hostname → servicio); se
  // pasa por FICHERO de configuración, no por argumentos (los argumentos de
  // cualquier proceso los ve cualquier proceso local).
  const rutaConfig = join(casa, 'mcp', 'cloudflared.yml');
  mkdirSync(join(casa, 'mcp'), { recursive: true });
  writeFileSync(rutaConfig, [
    '# RATACODE · config del túnel con nombre. Lo escribe mcp/tunel.mjs.',
    '# La misma que deja Ajustes › Conexiones (ruta /ratacode/conexion/tunel-nombrado).',
    'tunnel: ' + nombreTunel,
    'ingress:',
    '  - hostname: ' + hostTunel,
    '    service: ' + origen,
    '  - service: http_status:404',
    '',
  ].join('\n'), { mode: 0o600 });
  // `tunnel run --url <origen> <nombre>`: la forma corta y la que pidió Patxi.
  args = ['tunnel', '--config', rutaConfig, 'run', '--url', origen, nombreTunel];
  urlFija = 'https://' + hostTunel + '/mcp/' + clave;
  console.log('\nTúnel CON NOMBRE: ' + nombreTunel + ' → https://' + hostTunel + ' (config: ' + rutaConfig + ')');
  console.log('La dirección es FIJA: ' + 'https://' + hostTunel + '/mcp/<oculta>');
} else {
  modo = 'quick';
  // A cloudflared se le pasa SÓLO el origen (sin la clave): el prefijo /mcp/<clave>
  // viaja en la URL pública que se imprime abajo, no en los argumentos.
  args = ['tunnel', '--url', origen];
  console.log('\nNo hay túnel con nombre configurado (mcp.tunel_nombre y mcp.tunel_host); usando el túnel rápido (URL efímera).');
}

console.log('\nArrancando cloudflared ' + (modo === 'nombrado' ? '(hostname fijo ' + hostTunel + ')' : '(quick tunnel)') + '...');
if (modo === 'nombrado') {
  console.log('La URL pública es la de siempre: no hay que volver a pegarla en ChatGPT.\n');
} else {
  console.log('En cuanto dé la URL pública, aquí abajo saldrá COMPLETA (dominio + /mcp/<clave>).\n');
}

/**
 * De la salida de cloudflared, la URL pública que sirve. El quick tunnel la
 * escribe como `https://<algo>.trycloudflare.com`; el de nombre, su hostname.
 */
function dominioPublico(trozo) {
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(trozo);
  if (m !== null) return m[0];
  if (modo === 'nombrado' && hostTunel !== null && trozo.includes(hostTunel)) return 'https://' + hostTunel;
  return null;
}

// 3) Arrancar cloudflared y dejarlo vivo; Ctrl+C para parar.
// La salida va por tubería (no heredada) para poder CAZAR el dominio público y
// enseñar la URL completa; se reenvía tal cual a la consola.
let visto = '';
let anunciada = false;
const proc = spawn(comoSeLanza.orden, [...comoSeLanza.args, ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false, shell: comoSeLanza.shell });
// R27 · el pid de cloudflared, a la casa: es lo que permite decir «el túnel está
// vivo» sin adivinar (el dominio de un quick tunnel contesta aunque no haya
// nadie detrás). Sólo-dueño, como el resto de la casa.
try { escribirSoloDueno(RUTA_TUNEL_PID, String(proc.pid ?? '') + '\n'); } catch { /* la casa manda, pero no es imprescindible */ }
/**
 * Dejar la URL pública en la casa y anunciarla. Con el túnel CON NOMBRE la
 * dirección se sabe YA (no hay que esperar a cloudflared): se apunta antes de
 * arrancar nada, que es lo que hace que la tarjeta diga «Conectado» en cuanto
 * el túnel esté en pie.
 */
function anunciar(dominio) {
  if (anunciada) return;
  anunciada = true;
  try { escribirSoloDueno(RUTA_TUNEL_ABIERTO, dominio + '/mcp/' + clave + '\n'); } catch { /* la casa manda, pero no es imprescindible */ }
  process.stdout.write('\n============================================================\n');
  process.stdout.write('URL PÚBLICA DEL MCP (pégala en ChatGPT, modo desarrollador):\n');
  process.stdout.write('  ' + dominio + '/mcp/' + clave + '\n');
  process.stdout.write('============================================================\n\n');
}
if (urlFija !== null) anunciar('https://' + hostTunel);
const mirar = (trozo, destino) => {
  destino.write(trozo);
  if (anunciada) return;
  visto = (visto + trozo).slice(-16384);
  const dominio = dominioPublico(visto);
  if (dominio === null) return;
  anunciar(dominio);
};
proc.stdout.setEncoding('utf8');
proc.stdout.on('data', (t) => mirar(t, process.stdout));
proc.stderr.setEncoding('utf8');
proc.stderr.on('data', (t) => mirar(t, process.stderr));
proc.on('exit', (code) => {
  try { rmSync(RUTA_TUNEL_ABIERTO, { force: true }); } catch { /* da igual */ }
  try { rmSync(RUTA_TUNEL_PID, { force: true }); } catch { /* da igual */ }
  console.log('\ncloudflared terminó (código ' + code + '). El túnel está cerrado; el puerto ya no se expone.');
  process.exit(code ?? 0);
});
process.on('SIGINT', () => { proc.kill('SIGINT'); });
process.on('SIGTERM', () => { proc.kill('SIGTERM'); });
// R27 · si a ESTE guion lo matan (o se va con el panel), no se deja el pid ni la
// URL escritos: la piel dice «Conectado» mirando esos dos ficheros.
for (const senal of ['exit', 'SIGHUP', 'SIGBREAK']) {
  try {
    process.on(senal, () => {
      try { rmSync(RUTA_TUNEL_ABIERTO, { force: true }); } catch { /* da igual */ }
      try { rmSync(RUTA_TUNEL_PID, { force: true }); } catch { /* da igual */ }
    });
  } catch { /* esa señal no existe en este sistema */ }
}
