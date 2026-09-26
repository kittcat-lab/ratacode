/**
 * nucleo — el puente al core de DSH. Aquí NO hay lógica de modelos.
 *
 * Lo que hace: lanza UN hijo `dsh --profile sdk` por tarea, le habla el
 * protocolo JSON-RPC por stdio que el propio DSH publica
 * (`dsh-sdk-protocol`), y traduce lo que pasa dentro a un resultado.
 *
 * Por qué así, y no dentro del proceso de la web:
 *   · el aislamiento: la tarea no comparte proceso con tu sesión de trabajo;
 *   · cancelar es matar: inmediato y sin efectos raros en la web;
 *   · el sandbox se fija por tarea con un parche, y no depende del entorno;
 *   · y el core es EL MISMO: mismo binario, misma casa, mismos proveedores,
 *     mismas claves. No se duplica nada.
 *
 * Medido antes de escribir esto (sonda del 24-sep): el perfil `sdk` se
 * autocrea, resuelve sus bundles desde la instalación, contesta el handshake
 * `initialize` y acepta `session/prompt`, avisando por notificaciones
 * `session.event` y `session.status`.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parcheDePolitica } from './seguridad.js';

/** Cuánto se espera a que un hijo termine de irse antes de matarlo. */
const GRACIA_MS = 2500;
/** Cuántos bytes de stderr guardamos para poder explicar un fallo. */
const TOPE_STDERR = 4096;

/** Las variables que describen a ESTA sesión y que el hijo no debe heredar. */
const NO_HEREDAR = ['DSH_SESSION_ID', 'DSH_SHELL', 'DSH_WEB_URL'];

/**
 * Lanzar una tarea. Devuelve el mando (para cancelar) y la promesa del resultado.
 * @param {object} opciones - casa, motor, espacio, ruta de modelo, prompt, límites.
 * @returns {{promesa: Promise<object>, cancelar: (motivo?: string) => void, pid: number|undefined}}
 */
export function lanzarTarea({
  id,
  casa,
  dshBin,
  espacio,
  provider,
  model,
  prompt,
  maxTokens,
  timeoutMs,
  modo,
  alEvento,
}) {
  const carpetaTemporal = join(casa, 'mcp', 'tmp');
  mkdirSync(carpetaTemporal, { recursive: true });
  const rutaParche = join(carpetaTemporal, 'politica-' + id + '.yml');
  writeFileSync(rutaParche, parcheDePolitica({ modo, espacio }));

  const entorno = { ...process.env, DSH_HOME: casa, DSH_PERMISSION_MODE: modo };
  for (const nombre of NO_HEREDAR) delete entorno[nombre];

  const hijo = spawn(process.execPath, [dshBin, '--profile', 'sdk', '--patch', rutaParche], {
    cwd: espacio,
    env: entorno,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const sessionId = 'mcp-' + id;
  let buffer = '';
  let stderr = '';
  let terminado = false;
  let cancelada = false;
  let motivoCancelacion = null;
  let promptAceptado = false;
  let texto = '';
  let pasos = 0;
  let ultimoMotivo = null;
  const errores = [];
  const uso = { input: 0, output: 0, total: 0, cache_read: 0, cache_write: 0, reasoning: 0, informado: false };
  const empezado = Date.now();

  let resolver;
  let temporizador;
  const promesa = new Promise((listo) => { resolver = listo; });

  /** Cerrar una vez, con lo que haya. */
  const terminar = (extra = {}) => {
    if (terminado) return;
    terminado = true;
    if (temporizador !== undefined) clearTimeout(temporizador);
    const resultado = {
      ok: extra.ok ?? (errores.length === 0 && !cancelada),
      texto,
      pasos,
      provider,
      model,
      session_id: sessionId,
      duracion_ms: Date.now() - empezado,
      tokens: { ...uso },
      motivo: ultimoMotivo,
      errores,
      cancelada,
      motivo_cancelacion: motivoCancelacion,
      codigo_salida: extra.codigoSalida ?? null,
      ...extra.extra,
    };
    // El hijo se va por las buenas; si no se va, se le mata.
    cerrar()
      .catch(() => { /* da igual: abajo se le mata si sigue vivo */ })
      .finally(() => {
        try { rmSync(rutaParche, { force: true }); } catch { /* da igual */ }
        resolver(resultado);
      });
  };

  const enviar = (idPeticion, method, params) => {
    if (hijo.stdin.destroyed) return;
    const frame = { jsonrpc: '2.0', id: idPeticion, method };
    if (params !== undefined) frame.params = params;
    try {
      hijo.stdin.write(JSON.stringify(frame) + '\n');
    } catch {
      // El hijo se fue entre medias: quien tenga que enterarse, se enterará por `exit`.
    }
  };

  const anotarUso = (u) => {
    if (u === null || typeof u !== 'object') return;
    uso.informado = true;
    uso.input += numeroSeguro(u.inputTokens);
    uso.output += numeroSeguro(u.outputTokens);
    uso.total += numeroSeguro(u.totalTokens);
    uso.cache_read += numeroSeguro(u.cacheReadTokens);
    uso.cache_write += numeroSeguro(u.cacheWriteTokens);
    uso.reasoning += numeroSeguro(u.reasoningTokens);
  };

  const alEventoDeSesion = (evento) => {
    if (evento === null || typeof evento !== 'object') return;
    if (alEvento !== undefined) alEvento(evento);
    if (evento.type === 'assistant/message') {
      pasos += 1;
      const trozos = textoDeMensaje(evento.data?.message);
      if (trozos !== '') texto = trozos;
      anotarUso(evento.data?.usage);
      return;
    }
    if (evento.type === 'turn/end') {
      const motivo = evento.data?.reason;
      if (motivo !== null && typeof motivo === 'object') {
        ultimoMotivo = motivo.kind ?? null;
        if (motivo.kind === 'error') {
          errores.push(motivo.error?.message ?? 'la tarea falló sin mensaje');
        }
      }
    }
  };

  const manejarFrame = (frame) => {
    if (frame.method === 'session.event') {
      alEventoDeSesion(frame.params?.event);
      return;
    }
    if (frame.method === 'session.status') {
      if (frame.params?.status === 'idle' && promptAceptado) terminar();
      return;
    }
    if (frame.id === 1) {
      if (frame.error !== undefined) {
        errores.push('el motor rechazó el arranque: ' + (frame.error.message ?? JSON.stringify(frame.error)));
        terminar({ ok: false });
        return;
      }
      enviar(2, 'session/prompt', {
        sessionId,
        contentBlocks: [{ type: 'text', text: prompt }],
      });
      return;
    }
    if (frame.id === 2) {
      if (frame.error !== undefined) {
        errores.push('el motor rechazó la tarea: ' + (frame.error.message ?? JSON.stringify(frame.error)));
        terminar({ ok: false });
        return;
      }
      promptAceptado = true;
      return;
    }
    if (frame.id === 3) {
      terminar();
    }
  };

  hijo.stdout.setEncoding('utf8');
  hijo.stdout.on('data', (trozo) => {
    buffer += trozo;
    let corte;
    while ((corte = buffer.indexOf('\n')) >= 0) {
      const linea = buffer.slice(0, corte).trim();
      buffer = buffer.slice(corte + 1);
      if (linea === '') continue;
      let frame;
      try {
        frame = JSON.parse(linea);
      } catch {
        errores.push('el motor escribió algo que no es protocolo por stdout: ' + linea.slice(0, 200));
        continue;
      }
      try {
        manejarFrame(frame);
      } catch (e) {
        errores.push('error manejando un frame del motor: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
  });

  hijo.stderr.setEncoding('utf8');
  hijo.stderr.on('data', (trozo) => {
    stderr = (stderr + trozo).slice(-TOPE_STDERR);
  });

  hijo.on('error', (e) => {
    errores.push('no pude arrancar el motor: ' + e.message);
    terminar({ ok: false });
  });

  hijo.on('exit', (codigo) => {
    if (terminado) return;
    if (cancelada) {
      terminar({ ok: false, codigoSalida: codigo });
      return;
    }
    if (errores.length === 0) {
      errores.push('el motor se cerró antes de terminar (código ' + codigo + ')'
        + (stderr.trim() === '' ? '' : ': ' + ultimaLinea(stderr)));
    }
    terminar({ ok: false, codigoSalida: codigo });
  });

  /** Pedirle al hijo que se vaya por las buenas. */
  const cerrar = async () => {
    // Cancelar es inmediato: el árbol ya está muerto y no se le espera cortesías.
    if (cancelada) return;
    if (hijo.exitCode !== null || hijo.signalCode !== null) return;
    enviar(3, 'shutdown');
    await esperar(GRACIA_MS);
    if (hijo.exitCode === null && hijo.signalCode === null) matarArbol(hijo);
  };

  /** Cancelar: matar el árbol del hijo. Inmediato y sin efectos en la web. */
  const cancelar = (motivo = 'cancelada por el cliente') => {
    if (terminado) return;
    cancelada = true;
    motivoCancelacion = motivo;
    matarArbol(hijo);
    terminar({ ok: false, extra: { motivo_cancelacion: motivo } });
  };

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    temporizador = setTimeout(() => cancelar('se agotó el tiempo (' + timeoutMs + ' ms)'), timeoutMs);
  }

  enviar(1, 'initialize', {
    cwd: espacio,
    provider,
    model,
    ...(typeof maxTokens === 'number' && maxTokens > 0 ? { maxTokens } : {}),
  });

  return { promesa, cancelar, pid: hijo.pid };
}

/** Un número seguro (los contadores que falten cuentan como 0). */
function numeroSeguro(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

/** El texto de un mensaje del asistente, sin las partes que no son texto. */
function textoDeMensaje(mensaje) {
  const contenido = mensaje?.content;
  if (!Array.isArray(contenido)) return '';
  return contenido
    .filter((bloque) => bloque !== null && typeof bloque === 'object' && bloque.type === 'text' && typeof bloque.text === 'string')
    .map((bloque) => bloque.text)
    .join('\n')
    .trim();
}

/** La última línea con algo de un texto. */
function ultimaLinea(texto) {
  const lineas = texto.trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  return lineas.length === 0 ? '' : lineas[lineas.length - 1];
}

/** Esperar, sin más. */
function esperar(ms) {
  return new Promise((listo) => setTimeout(listo, ms));
}

/** Matar el árbol entero del hijo (en Windows, `taskkill /T`). */
function matarArbol(hijo) {
  if (hijo === undefined || hijo === null || hijo.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + ' /T /F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      hijo.kill('SIGTERM');
    }
  } catch { /* ya se fue */ }
}
