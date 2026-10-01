#!/usr/bin/env node
/**
 * PRUEBA DEL TOPE DE PETICIONES A LA VEZ (lib/http.js) · parte de `npm test`.
 *
 * Con `simultaneas: 1`, una petición que aún está mandando su cuerpo ya cuenta:
 * la segunda tiene que recibir 503. Antes se contaba DESPUÉS de leer el cuerpo
 * y las dos pasaban.
 *
 * Uso: node pruebas/mcp-http-tope.test.mjs
 */
import { request } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { iniciarServidorHttp } from '../mcp/lib/http.js';

const PUERTO = 3398;
const CLAVE = 'a'.repeat(64);

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

const { parar } = await iniciarServidorHttp({
  fabricaServidor: () => new McpServer({ name: 'prueba', version: '0.0.0' }),
  puerto: PUERTO,
  clave: CLAVE,
  simultaneas: 1,
});

const opciones = {
  host: '127.0.0.1',
  port: PUERTO,
  path: '/mcp/' + CLAVE,
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
};

// A · manda la mitad del cuerpo y se queda esperando.
const lenta = request(opciones);
lenta.on('error', () => {});
lenta.write('{"jsonrpc":"2.0",');
await new Promise((listo) => setTimeout(listo, 300));

// B · una petición completa mientras A sigue a medias.
const codigoB = await new Promise((listo, rechaza) => {
  const r = request(opciones, (res) => { res.resume(); listo(res.statusCode); });
  r.on('error', rechaza);
  r.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }));
});
comprobar(codigoB === 503, 'con una petición a medias, la segunda recibe 503 (recibió ' + codigoB + ')');

lenta.destroy();
parar();

if (fallos.length > 0) {
  process.stdout.write('\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
  process.exit(1);
}
process.stdout.write('\nVERDE · el tope de peticiones a la vez cuenta desde el principio: ' + cuantas + ' comprobaciones.\n');
process.exit(0);
