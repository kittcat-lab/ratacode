/**
 * llm-falso — un modelo de mentira, para poder MEDIR el cerco del MCP sin
 * claves, sin red y sin depender de ningún proveedor.
 *
 * Por qué existe: las pruebas del cerco tienen que hacer que el motor LLAME a
 * herramientas de verdad (leer fuera, escribir fuera, intentar una terminal…).
 * Quien llama a las herramientas es el modelo, así que hace falta un modelo que
 * haga exactamente lo que dice el guion de la prueba. Este es: un servidor
 * OpenAI-compatible (`POST /v1/chat/completions`, con streaming SSE, que es lo
 * que habla `@earendil-works/pi-ai`) que contesta lo que le manda el guion.
 *
 * El guion se elige por la ETIQUETA que lleve el primer mensaje del usuario
 * (`[R25:a]`, `[R25:b]`…), así que cada tarea del MCP puede llevar su propia
 * secuencia de llamadas. Y todo lo que pasa por aquí queda en el diario
 * (`peticiones`), que es de donde la prueba saca lo que cada herramienta
 * contestó DE VERDAD.
 */
import { createServer } from 'node:http';

/** Leer el cuerpo entero de una petición. */
function leerCuerpo(req) {
  return new Promise((listo, rechaza) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => listo(Buffer.concat(trozos).toString('utf8')));
    req.on('error', rechaza);
  });
}

/** El texto de un mensaje, sea cadena o lista de bloques. */
function textoDe(mensaje) {
  const contenido = mensaje?.content;
  if (typeof contenido === 'string') return contenido;
  if (Array.isArray(contenido)) {
    return contenido
      .filter((b) => b !== null && typeof b === 'object' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
  }
  return '';
}

/** La etiqueta de la prueba, del primer mensaje del usuario (`[R25:a]`, `[R26:tapado]`…). */
function etiquetaDe(mensajes) {
  const usuario = (mensajes ?? []).find((m) => m.role === 'user');
  const encontrada = /\[[a-z]*\d*:([a-z0-9-]+)\]/i.exec(textoDe(usuario));
  return encontrada === null ? 'sin-etiqueta' : encontrada[1].toLowerCase();
}

/**
 * El diario de una conversación: cada llamada a herramienta con lo que
 * contestó el motor. Se reconstruye de los mensajes, que es lo que el modelo
 * vio de verdad (no lo que el motor dice que pasó).
 * @param {object[]} peticiones - las peticiones de ESA conversación, en orden.
 * @returns {{nombre: string, argumentos: object, resultado: string}[]}
 */
export function transcripcion(peticiones) {
  const llamadas = new Map();
  for (const peticion of peticiones) {
    for (const mensaje of peticion.messages ?? []) {
      if (mensaje.role === 'assistant' && Array.isArray(mensaje.tool_calls)) {
        for (const llamada of mensaje.tool_calls) {
          // Cada petición repite la conversación entera: una llamada ya vista no
          // se apunta dos veces (sólo se le completa el resultado).
          if (llamadas.has(llamada.id)) continue;
          llamadas.set(llamada.id, {
            id: llamada.id,
            nombre: llamada.function?.name ?? '',
            argumentos: (() => {
              try { return JSON.parse(llamada.function?.arguments ?? '{}'); } catch { return {}; }
            })(),
            resultado: null,
          });
        }
      }
      if (mensaje.role === 'tool' && llamadas.has(mensaje.tool_call_id)) {
        llamadas.get(mensaje.tool_call_id).resultado = textoDe(mensaje);
      }
    }
  }
  return [...llamadas.values()];
}

/** Las peticiones de UNA etiqueta, en orden, con lo que llevaban dentro. */
export function peticionesDe(diario, etiqueta) {
  return diario.filter((p) => p.etiqueta === etiqueta);
}

/**
 * Arrancar el modelo falso.
 * @param {{puerto: number, guiones: Record<string, object[]>}} opciones
 *   cada guion es una lista de pasos: `{herramienta: {nombre, argumentos}}` o `{texto}`.
 * @returns {Promise<{diario: object[], parar: () => void, url: string}>}
 */
export function arrancarLlmFalso({ puerto, guiones }) {
  /** Todo lo que ha pasado, para que la prueba lo mire. */
  const diario = [];
  const cuentas = new Map();
  let contador = 0;

  const servidor = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('no');
      return;
    }
    leerCuerpo(req).then((crudo) => {
      let peticion;
      try { peticion = JSON.parse(crudo); } catch { peticion = {}; }
      const etiqueta = etiquetaDe(peticion.messages);
      const paso = cuentas.get(etiqueta) ?? 0;
      cuentas.set(etiqueta, paso + 1);
      diario.push({
        etiqueta,
        paso,
        messages: peticion.messages ?? [],
        tools: (peticion.tools ?? []).map((t) => t.function?.name),
        // R26: los ESQUEMAS completos, para poder auditar qué herramientas ve el
        // modelo y con qué nombre piden la ruta (el cerco sólo mira las claves
        // conocidas: `lib/lectura.js` → CLAVES_DE_RUTA).
        esquemas: peticion.tools ?? [],
      });

      const guion = guiones[etiqueta] ?? guiones['*'] ?? [];
      const siguiente = guion.length === 0 ? { texto: 'sin guion' } : guion[Math.min(paso, guion.length - 1)];
      responder(res, siguiente, () => { contador += 1; return 'call-' + etiqueta + '-' + contador; });
    }).catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('error leyendo el cuerpo');
    });
  });

  return new Promise((listo, rechaza) => {
    servidor.once('error', rechaza);
    servidor.listen(puerto, '127.0.0.1', () => {
      servidor.removeListener('error', rechaza);
      listo({ diario, parar: () => servidor.close(), url: 'http://127.0.0.1:' + puerto + '/v1', peticionesDe: (e) => peticionesDe(diario, e) });
    });
  });
}

/** La contestación en streaming SSE, como la de cualquier API OpenAI. */
function responder(res, paso, nuevoId) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const base = { id: 'chatcmpl-r25', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'r25-falso-1' };
  const trozo = (delta, finish) => JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: finish ?? null }] });
  const manda = (texto) => res.write('data: ' + texto + '\n\n');

  manda(trozo({ role: 'assistant', content: '' }));
  if (paso.herramienta !== undefined) {
    manda(trozo({
      tool_calls: [{
        index: 0,
        id: paso.herramienta.id ?? nuevoId(),
        type: 'function',
        function: { name: paso.herramienta.nombre, arguments: JSON.stringify(paso.herramienta.argumentos ?? {}) },
      }],
    }));
    manda(trozo({}, 'tool_calls'));
  } else {
    manda(trozo({ content: String(paso.texto ?? '') }));
    manda(trozo({}, 'stop'));
  }
  // El cierre con el uso, como pide `stream_options.include_usage`.
  manda(JSON.stringify({ ...base, choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }));
  res.write('data: [DONE]\n\n');
  res.end();
}
