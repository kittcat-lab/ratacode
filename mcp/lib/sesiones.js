/**
 * sesiones — LAS CUATRO HERRAMIENTAS DE R28, del lado del MCP.
 *
 * `run_task` (lo de siempre) lanza trabajo INDEPENDIENTE: un hijo del motor con
 * su propia sesión `mcp-<task_id>`. Esto es OTRA capacidad, y la pidió Patxi
 * para un caso muy concreto: desde ChatGPT, «manda este mensaje al chat ESTO
 * SERA UN TEST DI» tiene que entrar EN ESA MISMA SESIÓN —la que él tiene
 * abierta en el panel—, verse aparecer en ese chat y que el agente conteste ahí.
 *
 * Aquí no hay ninguna decisión de seguridad: este módulo es un CLIENTE FINO de
 * las rutas de la piel (`<casa>\url.txt` → cookie del navegador → `/ratacode/
 * sesiones/...`), y quien decide es el proceso del panel, que es el único que
 * puede escribir en una sesión viva. Las reglas (carpeta autorizada,
 * interruptor «Abierta a ChatGPT», turnos encerrados, `SESSION_NOT_ALLOWED`)
 * viven allí; aquí sólo se traducen a algo que un agente pueda leer.
 *
 * Y una cosa que NO se hace nunca: leer el texto del mensaje para decidir nada.
 * El texto es del humano que lo escribió en el chat; los permisos los da el
 * interruptor del panel, no un mensaje.
 */
import { pedirAlPanel } from './panel.js';

/** Las respuestas de negocio que el MCP devuelve tal cual (con su código). */
const CODIGOS = [
  'AMBIGUOUS_SESSION',
  'SESSION_NOT_FOUND',
  'SESSION_NOT_ALLOWED',
  'TURN_NOT_FOUND',
  'SESSION_NOT_LIVE',
  'MENSAJE_VACIO',
  'MOTOR_SIN_SESIONES',
  'PROMPT_RECHAZADO',
];

/**
 * Convertir la respuesta de la piel en la de la herramienta. Si el panel dijo
 * que no, se devuelve un error LEGIBLE con su código, sin inventarse nada.
 * @param {object} dicho - lo que contestó la piel.
 * @param {string} siFalla - qué decir si no hay panel.
 * @returns {object}
 */
function comoResultado(dicho, siFalla) {
  if (dicho.ok === true) return { ok: true, datos: sinRuido(dicho) };
  const codigo = typeof dicho.error === 'string' && dicho.error !== '' ? dicho.error : 'SIN_PANEL';
  return {
    ok: false,
    codigo,
    motivo: dicho.motivo ?? siFalla,
    ...(Array.isArray(dicho.ids) && dicho.ids.length > 0 ? { ids: dicho.ids } : {}),
    ...(dicho.session_id === undefined ? {} : { session_id: dicho.session_id }),
  };
}

/** Quitar el ruido interno (`_http`) de lo que se le enseña al agente. */
function sinRuido(dicho) {
  const { _http: _ignorado, ...resto } = dicho;
  return resto;
}

/**
 * `list_sessions`: las sesiones del panel, con lo que hace falta para elegir.
 * @param {string} casa
 * @returns {Promise<object>}
 */
export async function listarLasSesiones(casa) {
  const dicho = await pedirAlPanel(casa, '/ratacode/sesiones');
  const dicho2 = comoResultado(dicho, 'no pude preguntar al panel por sus sesiones');
  if (dicho2.ok !== true) return dicho2;
  return {
    ok: true,
    sesiones: dicho2.datos.sesiones ?? [],
    total: dicho2.datos.total ?? (dicho2.datos.sesiones ?? []).length,
    nota: 'Para poder mandar un mensaje, la sesión tiene que estar marcada «Abierta a ChatGPT» en la cabecera de su chat (apagado por defecto) y su carpeta tiene que estar en `mcp.workspaces`.',
  };
}

/**
 * `get_session`: una sola sesión, por `session_id` o por título exacto. Con
 * varias coincidencias NO elige: devuelve los ids (`AMBIGUOUS_SESSION`).
 * @param {string} casa
 * @param {{session_id?: string, titulo?: string}} pedido
 * @returns {Promise<object>}
 */
export async function unaSesion(casa, { session_id, titulo }) {
  const dicho = await pedirAlPanel(casa, '/ratacode/sesiones');
  const dicho2 = comoResultado(dicho, 'no pude preguntar al panel por sus sesiones');
  if (dicho2.ok !== true) return dicho2;
  const lista = Array.isArray(dicho2.datos.sesiones) ? dicho2.datos.sesiones : [];
  if (typeof session_id === 'string' && session_id.trim() !== '') {
    const suya = lista.find((s) => s.session_id === session_id.trim());
    if (suya === undefined) return { ok: false, codigo: 'SESSION_NOT_FOUND', motivo: 'no hay ninguna sesión con ese id' };
    return { ok: true, sesion: suya };
  }
  const nombre = typeof titulo === 'string' ? titulo.trim() : '';
  if (nombre === '') {
    return { ok: false, codigo: 'SESSION_NOT_FOUND', motivo: 'hace falta `session_id` o un título exacto (míralos con list_sessions)' };
  }
  const candidatas = lista.filter((s) => s.titulo === nombre);
  if (candidatas.length === 0) return { ok: false, codigo: 'SESSION_NOT_FOUND', motivo: 'no hay ninguna sesión titulada exactamente «' + nombre + '»' };
  if (candidatas.length > 1) {
    return {
      ok: false,
      codigo: 'AMBIGUOUS_SESSION',
      motivo: 'hay ' + candidatas.length + ' sesiones tituladas «' + nombre + '»: elige una por su `session_id`',
      ids: candidatas.map((s) => s.session_id),
    };
  }
  return { ok: true, sesion: candidatas[0] };
}

/**
 * `send_to_session`: el mensaje, a ESA sesión. Lo escribe el panel por la misma
 * vía que su caja de escribir, así que aparece en ese chat.
 * @param {string} casa
 * @param {{session_id?: string, titulo?: string, message: string, wait_seconds?: number, cliente?: string}} pedido
 * @returns {Promise<object>}
 */
export async function mandarALaSesion(casa, { session_id, titulo, message, wait_seconds, cliente }) {
  const dicho = await pedirAlPanel(casa, '/ratacode/sesiones/enviar', {
    metodo: 'POST',
    cuerpo: {
      ...(session_id === undefined ? {} : { session_id }),
      ...(titulo === undefined ? {} : { titulo }),
      mensaje: message,
      ...(wait_seconds === undefined ? {} : { esperar_segundos: wait_seconds }),
      cliente: cliente ?? 'MCP',
    },
  });
  return comoResultado(dicho, 'no pude mandar el mensaje al panel');
}

/**
 * `get_session_reply`: la respuesta de un mensaje ya mandado.
 * @param {string} casa
 * @param {{turn_id?: string, session_id?: string}} pedido
 * @returns {Promise<object>}
 */
export async function respuestaDeLaSesion(casa, { turn_id, session_id }) {
  const dicho = await pedirAlPanel(casa, '/ratacode/sesiones/respuesta', {
    consulta: {
      ...(turn_id === undefined ? {} : { turn_id }),
      ...(session_id === undefined ? {} : { session_id }),
    },
  });
  return comoResultado(dicho, 'no pude preguntar por la respuesta al panel');
}

/** Los códigos que este módulo puede devolver (para las instrucciones y las pruebas). */
export const CODIGOS_POSIBLES = [...CODIGOS];
