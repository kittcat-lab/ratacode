#!/usr/bin/env node
/**
 * tunel.mjs — prepara el túnel de Cloudflare para ChatGPT web (paso 4c).
 *
 * ⚠️ NO lo ejecutes tú solo: lo arranca el usuario cuando quiera abrir RATACODE a
 * ChatGPT. Este script SÓLO es transporte: el servidor MCP (con su clave en la
 * URL y su tope de tareas) ya funciona sin esto; el túnel sólo lo expone a
 * Internet mientras corre.
 *
 * Qué hace al ejecutarlo:
 *   1. Lee la URL local del MCP (http://127.0.0.1:<puerto>/mcp/<clave>) de la
 *      casa (<casa>/mcp/http-url.txt, o la reconstruye desde http-secret.txt).
 *   2. Comprueba que `cloudflared` está instalado.
 *   3. Si existe el túnel nombrado `mcp.mod-rat.com` (lo da de alta el usuario en
 *      su Cloudflare), lo usa con ese hostname fijo.
 *   4. Si no, usa un quick tunnel sin cuenta (URL efímera).
 *   5. Imprime la URL COMPLETA para pegar en ChatGPT (modo desarrollador).
 *
 * Uso:
 *   node mcp/tunel.mjs --home <casa> [--port <puerto>] [--host 127.0.0.1]
 *
 * Para pararlo: Ctrl+C (mata cloudflared y deja de exponer el puerto).
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolverCasa } from './lib/casa.js';

const TUNEL_NOMBRADO = 'mcp.mod-rat.com';

function leerOrdenes(argv) {
  const o = { casa: undefined, port: 3778 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
    if (a === '--home' || a.startsWith('--home=')) o.casa = v;
    else if (a === '--port' || a.startsWith('--port=')) o.port = Number(v);
    else if (a === '--host' || a.startsWith('--host=')) o.host = v;
    else throw new Error('no entiendo ' + a);
  }
  return o;
}

const o = leerOrdenes(process.argv.slice(2));
const casa = resolverCasa(o.casa);
const host = o.host ?? '127.0.0.1';
const puerto = o.port;

// Reconstruir la URL local del MCP (misma clave que guardó ratacode-mcp.js).
function urlLocal() {
  const rutaUrl = join(casa, 'mcp', 'http-url.txt');
  if (existsSync(rutaUrl)) {
    const u = readFileSync(rutaUrl, 'utf8').trim();
    if (u.startsWith('http')) return u;
  }
  const rutaClave = join(casa, 'mcp', 'http-secret.txt');
  if (!existsSync(rutaClave)) {
    throw new Error('no encuentro la clave del MCP en ' + rutaClave + '. Arranca primero: ratacode-mcp.js --http --port ' + puerto + ' --home ' + casa);
  }
  const clave = readFileSync(rutaClave, 'utf8').trim();
  return 'http://' + host + ':' + puerto + '/mcp/' + clave;
}

const local = urlLocal();
console.log('URL local del MCP: ' + local);

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
  args = ['tunnel', 'run', '--url', local, TUNEL_NOMBRADO];
  console.log('\nUsando túnel nombrado fijo: ' + TUNEL_NOMBRADO);
} else {
  modo = 'quick';
  args = ['tunnel', '--url', local];
  console.log('\nNo hay túnel nombrado configurado; usando quick tunnel (URL efímera).');
}

console.log('\nArrancando cloudflared ' + (modo === 'nombrado' ? '(hostname fijo mcp.mod-rat.com)' : '(quick tunnel)') + '...');
console.log('La URL pública aparecerá abajo. Pégala en ChatGPT (modo desarrollador).\n');

// 3) Arrancar cloudflared y dejarlo vivo; Ctrl+C para parar.
const proc = spawn('cloudflared', args, { stdio: 'inherit', windowsHide: false });
proc.on('exit', (code) => {
  console.log('\ncloudflared terminó (código ' + code + '). El túnel está cerrado; el puerto ya no se expone.');
  process.exit(code ?? 0);
});
process.on('SIGINT', () => { proc.kill('SIGINT'); });
process.on('SIGTERM', () => { proc.kill('SIGTERM'); });
