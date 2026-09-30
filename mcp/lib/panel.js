/**
 * panel — LA PUERTA DEL PANEL, desde el servidor MCP (R28).
 *
 * ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
 * El MCP corre en OTRO proceso que el panel. Para meter un mensaje en una
 * sesión que Patxi tiene abierta hay que hablar con el panel EN MARCHA, porque
 * sólo su proceso puede escribir en el registro durable de esa sesión por la
 * vía de verdad (`sessionController.prompt`, la misma función en la que acaba
 * la caja de escribir del panel). Y esa puerta está cerrada con el cerco del
 * navegador: `Host`/`Origin` de casa y la COOKIE firmada de la sesión del
 * navegador (`dsh-client-connection/lib/index.js:553-556`).
 *
 * ── CÓMO SE ENTRA, SIN NINGÚN SECRETO NUEVO ─────────────────────────────────
 * La misma puerta que usa el navegador cuando Patxi abre el panel:
 *   · `<casa>\url.txt` guarda `http://127.0.0.1:<puerto>/?token=<token>`, que es
 *     la dirección CON TOKEN que el motor imprime al arrancar y que
 *     `bin/ratacode.js:1027-1041` deja escrita sólo cuando el puerto ya escucha;
 *   · al pedir `GET /?token=…` el motor canjea ese token por una cookie firmada
 *     (`dsh-client-connection/README.md:35`: «accepts that token only on `GET /`,
 *     writes an authority-bound signed cookie, and redirects to clean `/`»).
 * Así que aquí se hace ESE canje: un `GET` a la raíz con el token, y la cookie
 * que devuelve el motor es la que se usa para las rutas de la piel.
 *
 * Reglas que se cumplen aquí, y todas importan:
 *   1 · EL TOKEN Y LA COOKIE NO SE REGISTRAN ni se devuelven nunca: no salen de
 *       este módulo, no van a ninguna respuesta de herramienta y no se escriben
 *       en el cuaderno de actividad.
 *   2 · NO SE DEVUELVE NINGÚN ERROR DEL MOTOR CON LA CABECERA DENTRO: los
 *       errores se resumen a un código y una línea.
 *   3 · SÓLO LOOPBACK: la URL del panel tiene que ser 127.0.0.1 / localhost /
 *       ::1. Una casa con la URL del panel apuntando a otro sitio no se usa.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Cuánto se espera a la puerta del panel en cada llamada. */
const TIMEOUT_MS = 20_000;
/** Cuánto vale la cookie canjeada antes de volver a pedirla (el motor firma 30 días). */
const VIDA_COOKIE_MS = 10 * 60_000;

/**
 * La dirección del panel de esta casa, con su token.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{url: string, origen: string, token: string|null, autoridad: string}|null}
 */
export function leerPanel(casa) {
  let crudo;
  try {
    crudo = readFileSync(join(casa, 'url.txt'), 'utf8').trim();
  } catch {
    return null;
  }
  if (crudo === '') return null;
  let url;
  try {
    url = new URL(crudo);
  } catch {
    return null;
  }
  const anfitrion = url.hostname.toLowerCase();
  // Sólo loopback: la puerta del panel es de casa.
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(anfitrion)) return null;
  return {
    url: crudo,
    origen: url.origin,
    token: url.searchParams.get('token'),
    autoridad: url.host,
  };
}

/** La cookie canjeada por casa+origen: se guarda en memoria, no en disco. */
const COOKIES = new Map();

/**
 * Canjear el token de `<casa>\url.txt` por la cookie firmada del navegador.
 * @param {{origen: string, token: string|null}} panel
 * @returns {Promise<{cookie: string|null, motivo: string|null}>}
 */
async function canjearCookie(panel) {
  if (panel.token === null || panel.token === '') {
    return { cookie: null, motivo: 'en `url.txt` no hay token: vuelve a abrir el panel con RATACODE (la dirección con token se escribe al arrancar)' };
  }
  let respuesta;
  try {
    respuesta = await fetch(panel.origen + '/?token=' + encodeURIComponent(panel.token), {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { cookie: null, motivo: 'no pude hablar con el panel en ' + panel.origen + ': ' + (e?.message ?? e) };
  }
  const puestas = typeof respuesta.headers.getSetCookie === 'function'
    ? respuesta.headers.getSetCookie()
    : [respuesta.headers.get('set-cookie')].filter((v) => typeof v === 'string' && v !== '');
  if (puestas.length === 0) {
    return { cookie: null, motivo: 'el panel no me dio cookie (HTTP ' + respuesta.status + '): el token de `url.txt` ya no vale, vuelve a abrir el panel' };
  }
  // Sólo el par `nombre=valor`: los atributos (Path, HttpOnly, Max-Age…) no se mandan.
  const cookie = puestas.map((c) => String(c).split(';')[0].trim()).filter((c) => c !== '').join('; ');
  if (cookie === '') return { cookie: null, motivo: 'el panel devolvió una cookie vacía' };
  return { cookie, motivo: null };
}

/**
 * La cookie buena para esta casa (se cachea; ante un 401 se vuelve a canjear).
 * @param {{origen: string, token: string|null}} panel
 * @param {boolean} [forzar]
 * @returns {Promise<{cookie: string|null, motivo: string|null}>}
 */
async function cookieDe(panel, forzar = false) {
  const clave = panel.origen;
  const guardada = COOKIES.get(clave);
  if (forzar !== true && guardada !== undefined && Date.now() - guardada.cuando < VIDA_COOKIE_MS) {
    return { cookie: guardada.cookie, motivo: null };
  }
  const canjeada = await canjearCookie(panel);
  if (canjeada.cookie !== null) COOKIES.set(clave, { cookie: canjeada.cookie, cuando: Date.now() });
  return canjeada;
}

/** Vaciar la cookie recordada (para las pruebas y para una casa que se muda). */
export function olvidarCookie() {
  COOKIES.clear();
}

/**
 * Una llamada a una ruta de la piel, con la cookie del navegador.
 *
 * Nunca lanza: devuelve `{ok:false, error}` para que la herramienta MCP pueda
 * contar QUÉ pasó sin enseñar cabeceras ni tokens.
 * @param {string} casa - la casa de RATACODE.
 * @param {string} ruta - la ruta (`/ratacode/sesiones`, …).
 * @param {{metodo?: string, cuerpo?: object, consulta?: object}} [opciones]
 * @returns {Promise<object>}
 */
export async function pedirAlPanel(casa, ruta, opciones = {}) {
  const panel = leerPanel(casa);
  if (panel === null) {
    return {
      ok: false,
      error: 'SIN_PANEL',
      motivo: 'esta casa no tiene una dirección de panel en ' + join(casa, 'url.txt')
        + ': el panel tiene que estar ABIERTO con RATACODE para poder hablar con una sesión suya',
    };
  }
  let canje = await cookieDe(panel);
  if (canje.cookie === null) return { ok: false, error: 'SIN_PANEL', motivo: canje.motivo };
  const url = new URL(ruta, panel.origen);
  for (const [clave, valor] of Object.entries(opciones.consulta ?? {})) {
    if (valor !== undefined && valor !== null) url.searchParams.set(clave, String(valor));
  }
  const metodo = opciones.metodo ?? 'GET';
  const hacer = async (cookie) => fetch(url, {
    method: metodo,
    headers: {
      // Sin `Origin`: un cliente no es un navegador, y el motor deja pasar las
      // peticiones sin `Origin` que vengan de casa (`isTrustedApiRequest`).
      cookie,
      ...(opciones.cuerpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(opciones.cuerpo === undefined ? {} : { body: JSON.stringify(opciones.cuerpo) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let respuesta;
  try {
    respuesta = await hacer(canje.cookie);
  } catch (e) {
    return { ok: false, error: 'SIN_PANEL', motivo: 'no pude hablar con el panel (' + panel.origen + '): ' + (e?.message ?? e) };
  }
  // La cookie caduca (o el panel se reinició): se canjea OTRA VEZ y se reintenta una sola vez.
  if (respuesta.status === 401) {
    canje = await cookieDe(panel, true);
    if (canje.cookie === null) return { ok: false, error: 'SIN_PANEL', motivo: canje.motivo };
    try {
      respuesta = await hacer(canje.cookie);
    } catch (e) {
      return { ok: false, error: 'SIN_PANEL', motivo: 'no pude hablar con el panel: ' + (e?.message ?? e) };
    }
  }
  if (respuesta.status === 403) {
    return { ok: false, error: 'SIN_PANEL', motivo: 'el panel me rechazó por el Host/Origin (HTTP 403): abre su dirección desde esta máquina' };
  }
  if (respuesta.status === 401) {
    return { ok: false, error: 'SIN_PANEL', motivo: 'el panel me pidió autorización (HTTP 401) y el token de `url.txt` no la dio: vuelve a abrir el panel con RATACODE' };
  }
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    return { ok: false, error: 'SIN_PANEL', motivo: 'el panel contestó algo que no es JSON (HTTP ' + respuesta.status + ')' };
  }
  if (datos === null || typeof datos !== 'object') {
    return { ok: false, error: 'SIN_PANEL', motivo: 'el panel contestó una respuesta vacía (HTTP ' + respuesta.status + ')' };
  }
  return { ...datos, _http: respuesta.status };
}

/**
 * ¿Hay panel vivo en esta casa y atiende las rutas de sesiones? Se usa en
 * `ratacode_status` para poder decir la verdad sin lanzar nada.
 * @param {string} casa
 * @returns {Promise<object>}
 */
export async function estadoDelPanel(casa) {
  const panel = leerPanel(casa);
  if (panel === null) {
    return { hay_direccion: false, vivo: false, motivo: 'esta casa no tiene `url.txt` (el panel no está abierto)' };
  }
  const dicho = await pedirAlPanel(casa, '/ratacode/sesiones');
  if (dicho.ok !== true) {
    return { hay_direccion: true, origen: panel.origen, vivo: false, motivo: dicho.motivo ?? dicho.error ?? 'sin respuesta' };
  }
  const sesiones = Array.isArray(dicho.sesiones) ? dicho.sesiones : [];
  return {
    hay_direccion: true,
    origen: panel.origen,
    vivo: true,
    sesiones: sesiones.length,
    abiertas_a_chatgpt: sesiones.filter((s) => s.abierta_a_chatgpt === true).map((s) => ({ session_id: s.session_id, titulo: s.titulo })),
  };
}
