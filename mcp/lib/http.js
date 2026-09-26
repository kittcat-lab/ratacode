/**
 * http — transporte Streamable HTTP para RATACODE-MCP.
 *
 * El MISMO servidor de herramientas que habla por stdio, ahora también por
 * HTTP en `127.0.0.1:<puerto>/mcp/<clave>`. La clave va en la propia URL
 * (nunca en el repositorio: se genera y se guarda en la casa). Cada petición
 * se atiende con un `McpServer` nuevo que COMPARTE el registro de tareas, así
 * `get_task_result` ve las tareas de otras sesiones y el tope por hora es
 * global. Modo sin estado (stateless): cada POST es independiente, que es justo
 * lo que necesitan estas seis herramientas.
 *
 * Sólo escucha en loopback. La exposición a Internet es cosa del túnel
 * (tunel.mjs), que lo decide el usuario.
 */
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { aviso } from './registro.js';

/** Leer el cuerpo JSON de una petición. */
function leerCuerpo(req) {
  return new Promise((listo, rechaza) => {
    const trozos = [];
    let total = 0;
    req.on('data', (t) => {
      total += t.length;
      if (total > 5_000_000) { rechaza(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      trozos.push(t);
    });
    req.on('end', () => {
      const texto = Buffer.concat(trozos).toString('utf8').trim();
      if (texto === '') return listo(undefined);
      try { listo(JSON.parse(texto)); } catch { rechaza(new Error('cuerpo JSON inválido')); }
    });
    req.on('error', rechaza);
  });
}

/**
 * Arrancar el servidor HTTP.
 * @param {{fabricaServidor: () => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer, puerto: number, clave: string, host?: string}} opciones
 * @returns {Promise<import('node:http').Server>} el servidor ya escuchando.
 */
export function iniciarServidorHttp({ fabricaServidor, puerto, clave, host = '127.0.0.1' }) {
  const server = createServer((req, res) => {
    manejar(req, res).catch((e) => {
      aviso('http: error manejando ' + req.method + ' ' + req.url + ': ' + (e?.message ?? e));
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Error interno');
      else res.end();
    });
  });

  async function manejar(req, res) {
    const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
    const partes = url.pathname.split('/').filter(Boolean); // ['mcp', '<clave>']
    if (partes[0] !== 'mcp' || partes[1] !== clave) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    if (req.method === 'POST') {
      let cuerpo;
      try { cuerpo = await leerCuerpo(req); } catch {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request');
        return;
      }
      const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const servidor = fabricaServidor();
      await servidor.connect(transporte);
      res.on('close', () => { servidor.close().catch(() => {}); transporte.close().catch(() => {}); });
      await transporte.handleRequest(req, res, cuerpo);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      // Sin estado: no hay sesiones que mantener ni stream SSE persistente.
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
        .end('Método no permitido en modo sin estado (usa POST)');
      return;
    }

    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' }).end('Método no permitido');
  }

  return new Promise((listo, rechaza) => {
    server.once('error', rechaza);
    server.listen(puerto, host, () => {
      server.removeListener('error', rechaza);
      listo(server);
    });
  });
}
