/**
 * sesiones — CHATGPT HABLA CON UNA SESIÓN YA ABIERTA DEL PANEL (R28).
 *
 * ── QUÉ ES ESTO, Y POR QUÉ VIVE AQUÍ ────────────────────────────────────────
 * `run_task` (el MCP) lanza trabajo INDEPENDIENTE: un hijo del motor, con su
 * propia sesión `mcp-<task_id>`. Eso no sirve para lo que pidió Patxi en R28:
 * «manda este mensaje al chat ESTO SERA UN TEST DI» tiene que entrar EN ESA
 * MISMA SESIÓN —la que él tiene abierta en el panel—, verse aparecer en ese
 * chat y que el agente conteste AHÍ.
 *
 * Y eso sólo se puede hacer DESDE DENTRO del proceso del panel: la caja de
 * escribir del panel acaba en la MISMA función del motor
 * (`@deepseek-ai/dsh-api-session-controller/lib/index.js:736`, `prompt(request)`),
 * y es esa función la que escribe el mensaje en el registro durable de la
 * sesión, que es de donde el panel pinta el chat en vivo. Un proceso de fuera
 * (el MCP) sólo puede llamar a esa función por la puerta que el panel ya tiene
 * abierta: las rutas de esta piel, con el mismo cerco que las demás
 * (`connection.requestRejection`: Host/Origin + cookie de sesión del navegador).
 *
 * Así que el reparto de R28 es este:
 *   · el MCP (`mcp/lib/sesiones.js`) es un CLIENTE FINO de estas rutas;
 *   · aquí, en el proceso del panel, se decide, se encierra y se escribe.
 *
 * ── LA VÍA, MEDIDA CON EL CÓDIGO DELANTE ────────────────────────────────────
 *   · la caja de escribir del panel → `dsh-client-ui-conversation/lib/client.js:2958`
 *     → `dsh-api-session-controller/lib/client.js:1650` (`prompt()`)
 *     → `:1659` `remote.session.prompt({requestId, sessionId, mode, content, clientTimeZone})`
 *     → `POST /api/session/prompt` con la cookie del navegador
 *     (`dsh-client-connection/lib/client.js:6197-6216`)
 *     → `dsh-api-session-controller/lib/index.js:736` `prompt(request)`.
 *   Aquí se llama a ESA MISMA función del motor, en el mismo proceso. No hay
 *   sesión nueva, ni fork, ni copia de la conversación, ni cambio de modelo,
 *   persona o carpeta: se le añade un mensaje de usuario a la sesión que ya
 *   está.
 *
 * ── LO QUE SE VE (R28 §2) ───────────────────────────────────────────────────
 * El mensaje entra con un `requestId` que se apunta en `<casa>\mcp\enviados.jsonl`
 * junto a `sender=openai-mcp` y `source=chatgpt-web`. Eso —y no el texto, que
 * puede escribir cualquiera— es lo que hace que el chat lo marque «GPT WEB →»:
 * la cara de cliente pide `/ratacode/sesiones/marcas` y pinta el rótulo en la
 * fila de ESA sesión y ESE turno (`data-chat-flow-kind="user"` +
 * `data-chat-turn`, `dsh-client-ui-chat/lib/client.js:1608-1609`).
 *
 * ── LA SEGURIDAD (R28 §3), que es lo más importante ─────────────────────────
 * Las sesiones del panel van, de fábrica, en «A rienda suelta»
 * (`fabrica/settings.yaml`: `permission.defaultPreset: danger-full-access`) y
 * SIN el cerco del MCP. Un mensaje de ChatGPT no puede convertirse en acceso a
 * todo el PC. Por eso, aquí:
 *   a) sólo se atiende a sesiones cuya carpeta esté en `mcp.workspaces`;
 *   b) y sólo a las que Patxi haya marcado «Abierta a ChatGPT» en la cabecera
 *      del chat (apagado por defecto);
 *   c) mientras una sesión está abierta, sus turnos van ENCERRADOS: se le fija
 *      el permiso en `workspace-write` (si el motor deja) y, sobre todo, se
 *      monta EL MISMO gancho de rutas del MCP (`mcp/lib/lectura.js`, el fichero
 *      de verdad, importado desde la instalación) más la lista de herramientas
 *      de escape (terminal, procesos, red, subagentes y guiones), que se
 *      deniegan por nombre. El motor no deja aplicar el gancho SÓLO a los turnos
 *      de ChatGPT —el gancho ve la llamada, no el remitente—, así que se aplica
 *      a TODA la sesión mientras esté abierta: eso se dice en la cabecera y en
 *      cada respuesta;
 *   d) cualquier otra sesión: `SESSION_NOT_ALLOWED`, y no se envía nada.
 * El TEXTO del mensaje no da nunca permisos: no se lee para decidir nada.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ── 1 · EL ESTADO: QUÉ SESIONES ESTÁN ABIERTAS A CHATGPT ───────────────────

/** Dónde se apunta qué sesiones están abiertas (una por sesión, con su fecha). */
export function rutaDeAbiertas(casa) {
  return join(casa, 'mcp', 'sesiones-abiertas.json');
}

/** Dónde se apunta cada mensaje que entra por aquí (la marca «GPT WEB →»). */
export function rutaDeEnviados(casa) {
  return join(casa, 'mcp', 'enviados.jsonl');
}

/**
 * El estado de las sesiones abiertas. Si el fichero no está (o está roto), la
 * respuesta es la de fábrica: NINGUNA abierta. Falla cerrado, siempre.
 * @param {string} casa - la casa de RATACODE.
 * @returns {{version: number, sesiones: Record<string, object>}}
 */
export function leerAbiertas(casa) {
  const vacio = { version: 1, sesiones: {} };
  try {
    const leido = JSON.parse(readFileSync(rutaDeAbiertas(casa), 'utf8'));
    if (leido === null || typeof leido !== 'object' || Array.isArray(leido)) return vacio;
    const sesiones = leido.sesiones;
    if (sesiones === null || typeof sesiones !== 'object' || Array.isArray(sesiones)) return vacio;
    return { version: 1, sesiones };
  } catch {
    return vacio;
  }
}

/** Guardar el estado (0600: es de la casa y de nadie más). */
export function guardarAbiertas(casa, estado) {
  const ruta = rutaDeAbiertas(casa);
  mkdirSync(join(casa, 'mcp'), { recursive: true });
  writeFileSync(ruta, JSON.stringify({ version: 1, sesiones: estado.sesiones ?? {} }, null, 2) + '\n', { mode: 0o600 });
  return ruta;
}

/** ¿Está ESTA sesión abierta a ChatGPT? (la única pregunta que decide si se atiende). */
export function estaAbierta(casa, sessionId) {
  const abiertas = leerAbiertas(casa).sesiones;
  return abiertas[String(sessionId)]?.abierta === true;
}

/**
 * Abrir o cerrar una sesión. Al abrir se apunta quién y cuándo; al cerrar se
 * quita la entrada (no se deja basura que pudiera reabrirla sola).
 * @param {string} casa
 * @param {string} sessionId
 * @param {boolean} abierta
 * @param {object} [datos] - título, carpeta y el permiso que tenía la sesión.
 * @returns {object} la entrada como quedó.
 */
export function marcarAbierta(casa, sessionId, abierta, datos = {}) {
  const estado = leerAbiertas(casa);
  const clave = String(sessionId);
  if (abierta !== true) {
    delete estado.sesiones[clave];
    guardarAbiertas(casa, estado);
    return { abierta: false };
  }
  estado.sesiones[clave] = {
    abierta: true,
    desde: new Date().toISOString(),
    titulo: datos.titulo ?? null,
    carpeta: datos.carpeta ?? null,
    // El permiso que tenía la sesión ANTES de encerrarla, para poder devolvérselo.
    permiso_previo: datos.permisoPrevio ?? null,
    encerrada: datos.encerrada === true,
  };
  guardarAbiertas(casa, estado);
  return estado.sesiones[clave];
}

// ── 2 · EL CUADERNO DE LO QUE ENTRA POR AQUÍ ───────────────────────────────

/**
 * Apuntar un mensaje de un chat web. El `request_id` es la MARCA: es lo que va
 * en el evento durable (`source.rpcId`) y lo que permite decir «esto vino de
 * ChatGPT» sin mirar el texto de nadie.
 * @param {string} casa
 * @param {{request_id: string, session_id: string, turno?: number|null, cliente?: string, sender?: string, source?: string, permitido: boolean, motivo?: string|null}} fila
 * @returns {void}
 */
export function apuntarEnviado(casa, fila) {
  try {
    mkdirSync(join(casa, 'mcp'), { recursive: true });
    appendFileSync(rutaDeEnviados(casa), JSON.stringify({
      hora: new Date().toISOString(),
      request_id: fila.request_id ?? null,
      session_id: fila.session_id ?? null,
      turno: fila.turno ?? null,
      cliente: fila.cliente ?? 'MCP',
      sender: fila.sender ?? 'openai-mcp',
      source: fila.source ?? 'chatgpt-web',
      permitido: fila.permitido === true,
      motivo: fila.permitido === true ? null : (fila.motivo ?? null),
    }) + '\n');
  } catch { /* el cuaderno no puede tumbar el panel */ }
}

/** Las últimas líneas del cuaderno de envíos (para la marca y para Actividad). */
export function leerEnviados(casa, cuantas = 200) {
  try {
    const lineas = readFileSync(rutaDeEnviados(casa), 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
    const salida = [];
    for (const linea of lineas.slice(-cuantas).reverse()) {
      try { salida.push(JSON.parse(linea)); } catch { /* una línea rota no invalida el cuaderno */ }
    }
    return salida;
  } catch {
    return [];
  }
}

// ── 3 · LEER LAS SESIONES DEL PANEL ────────────────────────────────────────

/** El servicio de sesiones del motor, o null si este motor no lo monta. */
export function controlDeSesiones(ctx) {
  const servicio = typeof ctx.get === 'function' ? ctx.get('sessionController') : ctx.sessionController;
  return servicio === undefined || servicio === null || typeof servicio.list !== 'function' ? null : servicio;
}

/** El servicio de sesiones (el de los objetos vivos), o null. */
export function sesionesVivas(ctx) {
  const servicio = typeof ctx.get === 'function' ? ctx.get('sessions') : ctx.sessions;
  return servicio === undefined || servicio === null || typeof servicio.get !== 'function' ? null : servicio;
}

/** Un valor de las proyecciones de una sesión, si está cacheado. */
function proyeccion(fila, clave) {
  const valores = fila?.projections?.values;
  return valores === null || typeof valores !== 'object' ? undefined : valores[clave];
}

/** La ruta canónica de una carpeta (con enlaces resueltos), sin reventar. */
function canonica(ruta) {
  if (typeof ruta !== 'string' || ruta.trim() === '') return null;
  try {
    const resuelta = resolve(ruta);
    // El realpath del trozo que EXISTE: una carpeta que aún no está se juzga por
    // dónde va a caer, que es como lo juzga el cerco del MCP (`lectura.js`).
    try { return realpathSync.native(resuelta); } catch { return resuelta; }
  } catch {
    return null;
  }
}

/** ¿Esta carpeta está dentro de alguna de las autorizadas? (comparación sin distinguir mayúsculas en Windows). */
export function dentroDeAlguna(carpeta, raices) {
  const suya = canonica(carpeta);
  if (suya === null) return false;
  const a = process.platform === 'win32' ? suya.toLowerCase() : suya;
  for (const raiz of raices ?? []) {
    const canon = canonica(raiz);
    if (canon === null) continue;
    const b = process.platform === 'win32' ? canon.toLowerCase() : canon;
    if (a === b) return true;
    if (a.startsWith(b.endsWith('\\') || b.endsWith('/') ? b : b + (process.platform === 'win32' ? '\\' : '/'))) return true;
  }
  return false;
}

/**
 * La foto de las sesiones del panel, con lo que hace falta para decidir.
 * Sin secretos: ni claves, ni contenido de la conversación, ni la casa.
 * @param {{ctx: object, casa: string, raices: string[]}} opciones
 * @returns {Promise<object[]>}
 */
export async function listarSesiones({ ctx, casa, raices }) {
  const control = controlDeSesiones(ctx);
  if (control === null) throw new Error('este motor no publica el servicio de sesiones (`sessionController`): no puedo mirar las sesiones del panel');
  // `list()` devuelve la lista de resúmenes (`dsh-api-session-controller/lib/
  // index.js:1829-1847`). Medido: en el primerísimo momento tras arrancar el
  // panel puede devolver `undefined` (el índice de sesiones todavía se está
  // montando), así que se reintenta UNA vez antes de dar un error; y si aun así
  // no es una lista, se dice QUÉ llegó en vez de un «no es iterable» vacío.
  let filas = null;
  for (let intento = 0; intento < 2 && filas === null; intento += 1) {
    const crudo = await control.list();
    if (Array.isArray(crudo)) filas = crudo;
    else if (Array.isArray(crudo?.items)) filas = crudo.items;
    else if (intento === 0) await new Promise((listo) => setTimeout(listo, 400));
    else throw new Error('la lista de sesiones del motor no es una lista (me llegó: ' + String(JSON.stringify(crudo)).slice(0, 300) + ')');
  }
  const abiertas = leerAbiertas(casa).sesiones;
  const salida = [];
  for (const fila of filas) {
    const id = String(fila.sessionId ?? '');
    if (id === '') continue;
    const modelo = proyeccion(fila, 'modelSelection');
    const eleccion = modelo?.next ?? modelo?.lastUsed ?? null;
    const carpeta = typeof fila.cwd === 'string' && fila.cwd !== '' ? fila.cwd : null;
    const enEspacio = carpeta === null ? false : dentroDeAlguna(carpeta, raices);
    salida.push({
      session_id: id,
      titulo: textoDe(proyeccion(fila, 'title')),
      carpeta,
      persona: textoDe(proyeccion(fila, 'agentPreset')),
      modelo: textoDe(eleccion?.model),
      proveedor: textoDe(eleccion?.provider),
      estado: fila.running === true ? 'en_marcha' : (fila.blank === true ? 'nueva' : 'parada'),
      actualizada: new Date(Number(fila.updatedAt ?? 0)).toISOString(),
      origen: textoDe(fila.origin),
      abierta_a_chatgpt: abiertas[id]?.abierta === true,
      en_espacio_autorizado: enEspacio,
      // Y por qué NO se puede atender, si no se puede: el MCP lo dirá tal cual.
      motivo: abiertas[id]?.abierta !== true
        ? 'no está marcada «Abierta a ChatGPT» en el panel'
        : (enEspacio ? null : 'su carpeta no está en `mcp.workspaces`'),
    });
  }
  return salida;
}

/** Un texto de verdad, o null. */
function textoDe(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

// ── 4 · EL CERCO DE LAS SESIONES ABIERTAS (R28 §3c) ────────────────────────

/**
 * Las herramientas que se DENIEGAN a una sesión abierta a ChatGPT, por nombre.
 * Es la lista de «vías de escape» del MCP (`mcp/lib/seguridad.js:68-79`) vista
 * desde el otro lado: allí se apagan FILAS del motor, aquí se deniegan NOMBRES
 * de herramienta, que es lo único que ve `tools/pre-execute`.
 */
const ESCAPES = [
  'bash', 'pwsh', 'powershell', 'shell', 'terminal', 'cmd', 'exec',
  'job_list', 'job_output', 'job_kill', 'jobs',
  'web_search', 'web_fetch', 'web',
  'subagent', 'subagent_fork', 'subagent_control', 'list_agents', 'send_message', 'interrupt_agent',
  'workflow', 'ralph',
];

/**
 * ¿Esta herramienta es una vía de escape? Además de la lista, se miran los
 * prefijos que el motor usa de verdad (`job_*`, `web_*`, `subagent*`), porque
 * un nombre nuevo de la misma familia no puede colarse por no estar apuntado.
 * @param {string} nombre
 * @returns {boolean}
 */
export function esEscape(nombre) {
  const n = String(nombre ?? '').toLowerCase();
  if (n === '') return false;
  if (ESCAPES.includes(n)) return true;
  return n.startsWith('job_') || n.startsWith('web_') || n.startsWith('subagent') || n.startsWith('mcp__');
}

/** La línea que ve el agente cuando una vía de escape se para. */
export function motivoEscape(nombre) {
  return 'Esta sesión está abierta a ChatGPT: «' + nombre + '» está cerrada mientras lo esté (sin terminal, sin procesos, sin red y sin subagentes).';
}

/**
 * Cargar el gancho de rutas DE VERDAD, el del MCP: `mcp/lib/lectura.js` de la
 * instalación. No se copia ni se reescribe: se importa el mismo fichero que
 * montan las tareas del MCP, así lo que se prueba es lo que se monta.
 * @param {string} instalacion - la carpeta del paquete RATACODE.
 * @returns {Promise<object|null>}
 */
export async function cargarCerco(instalacion) {
  if (typeof instalacion !== 'string' || instalacion === '') return null;
  const ruta = join(instalacion, 'mcp', 'lib', 'lectura.js');
  if (!existsSync(ruta)) return null;
  try {
    const modulo = await import(pathToFileURL(ruta).href);
    return typeof modulo.decidir === 'function' ? modulo : null;
  } catch {
    return null;
  }
}

/**
 * Montar el gancho `tools/pre-execute` para las sesiones abiertas a ChatGPT.
 *
 * Es el MISMO gancho que llevan las tareas del MCP (`mcp/lib/lectura.js:202`),
 * con una diferencia que aquí es la clave: la lista de carpetas no es fija, se
 * resuelve POR LLAMADA a partir de la sesión que la hace. Una llamada de una
 * sesión que NO está abierta pasa de largo sin tocarla.
 *
 * `cerco` es una FUNCIÓN que devuelve el módulo del gancho (o null mientras se
 * carga): así el gancho queda montado desde el primer instante y, si el módulo
 * no estuviera, una sesión abierta falla CERRADO en vez de quedarse sin cerco.
 * @param {object} ctx - contexto de cordis del panel.
 * @param {{casa: string, raices: () => string[], cerco: () => object|null, alDenegar?: Function}} opciones
 * @returns {Function} el desmontaje.
 */
export function montarCerco(ctx, { casa, raices, cerco, alDenegar }) {
  const apuntar = (juicio) => {
    try { alDenegar?.(juicio); } catch { /* el cuaderno no puede tumbar el turno */ }
  };
  return ctx.on('tools/pre-execute', async (exec, next) => {
    const sesion = exec?.agent?.session;
    const id = sesion?.id ?? sesion?.header?.id;
    if (typeof id !== 'string' || id === '') return next();
    if (!estaAbierta(casa, id)) return next();
    const nombre = String(exec?.name ?? '');
    if (esEscape(nombre)) {
      apuntar({ session_id: id, herramienta: nombre, fuera: null, motivo: 'vía de escape' });
      return { kind: 'deny', reason: motivoEscape(nombre) };
    }
    const modulo = typeof cerco === 'function' ? cerco() : cerco;
    if (modulo === null || modulo === undefined) {
      apuntar({ session_id: id, herramienta: nombre, fuera: null, motivo: 'sin cerco de rutas' });
      return { kind: 'deny', reason: 'Esta sesión está abierta a ChatGPT y el cerco de rutas no está montado: no dejo pasar ninguna herramienta.' };
    }
    // La carpeta de ESA sesión es su única raíz: ni las demás de `mcp.workspaces`.
    const cwd = sesion?.header?.cwd;
    const propias = typeof cwd === 'string' && cwd !== '' ? [cwd] : raices();
    const juicio = modulo.decidir({ entrada: exec?.arguments ?? {}, raices: propias, cwd });
    if (juicio === null) return next();
    apuntar({ session_id: id, herramienta: nombre, fuera: juicio.fuera, motivo: 'fuera de su carpeta' });
    return { kind: 'deny', reason: modulo.motivoFuera(juicio.fuera) };
  });
}

// ── 5 · LEER EL REGISTRO DE UNA SESIÓN (la respuesta y el turno) ────────────

/** Los eventos durables de una sesión viva, o null si no está viva. */
export function eventosDe(ctx, sessionId) {
  const vivas = sesionesVivas(ctx);
  if (vivas === null) return null;
  const sesion = vivas.get(String(sessionId));
  if (sesion === undefined || sesion === null || typeof sesion.snapshotEvents !== 'function') return null;
  try {
    const eventos = sesion.snapshotEvents();
    return Array.isArray(eventos) ? eventos : null;
  } catch {
    return null;
  }
}

/** El texto de un mensaje del asistente (sólo los bloques de texto). */
export function textoAsistente(mensaje) {
  const contenido = mensaje?.content;
  if (!Array.isArray(contenido)) return '';
  return contenido
    .filter((b) => b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Buscar en el registro de una sesión el mensaje que entró por aquí (por su
 * `requestId`, que es METADATA) y lo que vino después.
 * @param {object[]} eventos - los eventos durables, en orden.
 * @param {string} requestId - la marca del mensaje que mandó ChatGPT.
 * @returns {{seq: number|null, turno: number|null, respuesta: string|null, terminado: boolean, error: string|null}}
 */
export function buscarEnElRegistro(eventos, requestId) {
  let propio = null;
  let turno = null;
  let ultimoTurno = null;
  for (const evento of eventos ?? []) {
    if (evento?.type === 'turn/start' && typeof evento.data?.turn === 'number') ultimoTurno = evento.data.turn;
    if (propio === null) {
      if (evento?.type === 'user/message' && evento.data?.source?.rpcId === requestId) {
        propio = evento.seq;
        turno = ultimoTurno;
      }
      continue;
    }
    if (evento?.type === 'assistant/message' && evento.seq > propio) {
      const texto = textoAsistente(evento.data?.message);
      if (texto !== '') return { seq: propio, turno, respuesta: texto, terminado: true, error: null };
    }
    if (evento?.type === 'turn/end' && evento.seq > propio) {
      const motivo = evento.data?.reason;
      if (motivo !== null && typeof motivo === 'object' && motivo.kind === 'error') {
        return { seq: propio, turno, respuesta: null, terminado: true, error: String(motivo.error?.message ?? 'el turno falló') };
      }
      if (motivo !== null && typeof motivo === 'object' && motivo.kind === 'aborted') {
        return { seq: propio, turno, respuesta: null, terminado: true, error: 'el turno se canceló' };
      }
    }
  }
  return { seq: propio, turno, respuesta: null, terminado: false, error: null };
}

// ── 6 · EL PERMISO DE UNA SESIÓN ABIERTA (workspace-write) ──────────────────

/** El servicio de presets de permiso del motor, o null. */
function presetsDe(ctx) {
  const servicio = typeof ctx.get === 'function' ? ctx.get('permissionPresets') : ctx.permissionPresets;
  return servicio === undefined || servicio === null || typeof servicio.set !== 'function' ? null : servicio;
}

/** El preset que la sesión tiene puesto ahora (o 'custom'). */
export function permisoActual(ctx, sessionId) {
  const servicio = presetsDe(ctx);
  const vivas = sesionesVivas(ctx);
  if (servicio === null || vivas === null) return null;
  const sesion = vivas.get(String(sessionId));
  if (sesion === undefined || sesion === null) return null;
  try { return servicio.current(sesion) ?? null; } catch { return null; }
}

/**
 * Encerrar el permiso de una sesión en `workspace-write` (lo que pide R28 §3c).
 *
 * Se hace con la vía del propio motor: el servicio de presets escribe el
 * evento durable `permission/preset` + `sandbox/mode` + `approval/policy` en la
 * sesión (`dsh-permission-presets/lib/index.js:274-286`), así que el modo lo
 * aplican TODAS las capacidades que confinan (bash, ficheros, terminal).
 *
 * Es BEST EFFORT a propósito: si este motor no monta el servicio, o la sesión
 * no está viva, se dice y se sigue —porque el cerco que de verdad para las
 * cosas es el gancho de rutas de {@link montarCerco}, que no depende de esto.
 * @returns {{encerrada: boolean, permiso_previo: string|null, motivo: string|null}}
 */
export function encerrarPermiso(ctx, sessionId) {
  const servicio = presetsDe(ctx);
  const vivas = sesionesVivas(ctx);
  if (servicio === null) return { encerrada: false, permiso_previo: null, motivo: 'este motor no publica `permissionPresets`' };
  if (vivas === null) return { encerrada: false, permiso_previo: null, motivo: 'este motor no publica `sessions`' };
  const sesion = vivas.get(String(sessionId));
  if (sesion === undefined || sesion === null) return { encerrada: false, permiso_previo: null, motivo: 'la sesión no está viva en el panel: el cerco queda sólo en el gancho de rutas' };
  let previo = null;
  try { previo = servicio.current(sesion) ?? null; } catch { previo = null; }
  if (previo === 'workspace-write') return { encerrada: true, permiso_previo: previo, motivo: null };
  try {
    servicio.set(sesion, 'workspace-write');
    return { encerrada: true, permiso_previo: previo, motivo: null };
  } catch (e) {
    return { encerrada: false, permiso_previo: previo, motivo: 'no pude fijar `workspace-write`: ' + (e?.message ?? e) };
  }
}

/**
 * Devolverle a la sesión el permiso que tenía antes de encerrarla. Sólo si
 * está viva (si no, no se toca nada: se apunta y lo dice el estado).
 * @returns {{devuelto: boolean, motivo: string|null}}
 */
export function devolverPermiso(ctx, sessionId, previo) {
  const servicio = presetsDe(ctx);
  const vivas = sesionesVivas(ctx);
  if (servicio === null || vivas === null) return { devuelto: false, motivo: 'este motor no publica los servicios de permiso' };
  if (typeof previo !== 'string' || previo === '' || previo === 'custom') {
    return { devuelto: false, motivo: 'no hay permiso previo apuntado que devolver' };
  }
  const sesion = vivas.get(String(sessionId));
  if (sesion === undefined || sesion === null) return { devuelto: false, motivo: 'la sesión no está viva: su permiso se queda como está' };
  try {
    servicio.set(sesion, previo);
    return { devuelto: true, motivo: null };
  } catch (e) {
    return { devuelto: false, motivo: 'no pude devolver el permiso «' + previo + '»: ' + (e?.message ?? e) };
  }
}

// ── 7 · ATENDER EL ENVÍO: ELEGIR LA SESIÓN, ENCERRARLA Y ESCRIBIR ──────────

/** Cuánto se espera entre dos miradas al registro mientras corre el turno. */
const MS_ENTRE_MIRADAS = 400;
/** El tope de la espera, aunque el cliente pida más (R28: ~25 s por defecto). */
export const ESPERA_MAXIMA_SEGUNDOS = 120;

/** La respuesta de espera: dormir, sin más. */
function esperar(ms) {
  return new Promise((listo) => setTimeout(listo, ms));
}

/**
 * Elegir la sesión: por `session_id` (lo canónico) o por título EXACTO como
 * ayuda. Con más de una coincidencia NO se envía nada y se devuelven los ids
 * (`AMBIGUOUS_SESSION`): adivinar sería escribir en el chat equivocado.
 * @returns {{ok: true, sesion: object}|{ok: false, error: string, ids?: string[], motivo: string}}
 */
export function elegirSesion(lista, { sessionId, titulo }) {
  if (typeof sessionId === 'string' && sessionId.trim() !== '') {
    const buscada = sessionId.trim();
    const suya = lista.find((s) => s.session_id === buscada);
    if (suya === undefined) return { ok: false, error: 'SESSION_NOT_FOUND', motivo: 'no hay ninguna sesión con ese id en esta casa', ids: [] };
    return { ok: true, sesion: suya };
  }
  const nombre = typeof titulo === 'string' ? titulo.trim() : '';
  if (nombre === '') {
    return { ok: false, error: 'SESSION_NOT_FOUND', motivo: 'hace falta `session_id` (míralo con list_sessions) o un título exacto', ids: [] };
  }
  const candidatas = lista.filter((s) => s.titulo === nombre);
  if (candidatas.length === 0) {
    return { ok: false, error: 'SESSION_NOT_FOUND', motivo: 'no hay ninguna sesión titulada exactamente «' + nombre + '»', ids: [] };
  }
  if (candidatas.length > 1) {
    return {
      ok: false,
      error: 'AMBIGUOUS_SESSION',
      motivo: 'hay ' + candidatas.length + ' sesiones tituladas «' + nombre + '»: elige una por su `session_id`',
      ids: candidatas.map((s) => s.session_id),
    };
  }
  return { ok: true, sesion: candidatas[0] };
}

/**
 * MANDAR UN MENSAJE A UNA SESIÓN YA ABIERTA (R28 §1-§3). Esto es lo que llaman
 * las rutas de la piel cuando el MCP llama a `send_to_session`.
 *
 * El orden importa y es el de la seguridad:
 *   1 · elegir la sesión (sin adivinar: `AMBIGUOUS_SESSION`);
 *   2 · comprobar que está ABIERTA y que su carpeta está autorizada
 *       (`SESSION_NOT_ALLOWED`): el texto del mensaje no da permisos nunca;
 *   3 · ENCERRARLA (permiso `workspace-write` si el motor deja) — el gancho de
 *       rutas ya está montado desde que se abrió, así que el cerco no depende
 *       de que esto salga bien;
 *   4 · escribir el mensaje con la MISMA función del motor que la caja 🔲 del
 *       panel (`sessionController.prompt`), con un `requestId` propio;
 *   5 · esperar `esperar_segundos` a que el turno acabe, y devolver la
 *       respuesta si acabó.
 * @param {{ctx: object, casa: string, raices: string[], sessionId?: string, titulo?: string, mensaje: string, esperarSegundos?: number, cliente?: string}} opciones
 * @returns {Promise<object>}
 */
export async function enviarMensaje({ ctx, casa, raices, sessionId, titulo, mensaje, esperarSegundos, cliente }) {
  const control = controlDeSesiones(ctx);
  if (control === null) return { ok: false, error: 'MOTOR_SIN_SESIONES', motivo: 'este motor no publica el servicio de sesiones: no puedo escribir en el panel' };
  const texto = typeof mensaje === 'string' ? mensaje : '';
  if (texto.trim() === '') return { ok: false, error: 'MENSAJE_VACIO', motivo: 'el mensaje no puede ir vacío' };

  const lista = await listarSesiones({ ctx, casa, raices });
  const elegida = elegirSesion(lista, { sessionId, titulo });
  if (elegida.ok !== true) return elegida;
  const sesion = elegida.sesion;

  if (sesion.abierta_a_chatgpt !== true) {
    apuntarEnviado(casa, { session_id: sesion.session_id, cliente, permitido: false, motivo: 'SESSION_NOT_ALLOWED' });
    return {
      ok: false,
      error: 'SESSION_NOT_ALLOWED',
      session_id: sesion.session_id,
      motivo: 'esa sesión no está marcada «Abierta a ChatGPT»: Patxi tiene que encenderlo en la cabecera de ese chat',
    };
  }
  if (sesion.en_espacio_autorizado !== true) {
    apuntarEnviado(casa, { session_id: sesion.session_id, cliente, permitido: false, motivo: 'SESSION_NOT_ALLOWED' });
    return {
      ok: false,
      error: 'SESSION_NOT_ALLOWED',
      session_id: sesion.session_id,
      motivo: 'la carpeta de esa sesión (' + (sesion.carpeta ?? '(sin carpeta)') + ') no está en `mcp.workspaces` de la casa: añádela allí para poder abrirla a ChatGPT',
    };
  }

  // El agente, VIVO antes de encerrar y de escribir: si la sesión estaba fría,
  // esto la levanta (es lo mismo que hace `prompt` por dentro,
  // `dsh-api-session-controller/lib/index.js:740`).
  try { await control.resolveAgent?.(sesion.session_id); } catch { /* si no se puede, `prompt` lo dirá */ }

  const cerco = encerrarPermiso(ctx, sesion.session_id);
  const estado = leerAbiertas(casa);
  if (estado.sesiones[sesion.session_id] !== undefined) {
    estado.sesiones[sesion.session_id].encerrada = cerco.encerrada === true;
    estado.sesiones[sesion.session_id].permiso_previo = cerco.permiso_previo ?? estado.sesiones[sesion.session_id].permiso_previo ?? null;
    guardarAbiertas(casa, estado);
  }

  const requestId = randomUUID();
  const esperaSegundos = Number.isFinite(esperarSegundos) && esperarSegundos > 0
    ? Math.min(Math.floor(esperarSegundos), ESPERA_MAXIMA_SEGUNDOS)
    : 25;
  const antes = Date.now();
  try {
    await control.prompt({
      requestId,
      sessionId: sesion.session_id,
      mode: 'queue',
      content: [{ type: 'text', text: texto }],
    });
  } catch (e) {
    apuntarEnviado(casa, { request_id: requestId, session_id: sesion.session_id, cliente, permitido: false, motivo: 'el motor rechazó el mensaje' });
    return {
      ok: false,
      error: 'PROMPT_RECHAZADO',
      session_id: sesion.session_id,
      motivo: String(e?.message ?? e),
      codigo_del_motor: String(e?.code ?? ''),
    };
  }
  apuntarEnviado(casa, { request_id: requestId, session_id: sesion.session_id, cliente, permitido: true });

  // Y se espera a que el turno acabe, mirando el registro durable de ESA sesión.
  let ultimo = { seq: null, turno: null, respuesta: null, terminado: false, error: null };
  const limite = antes + esperaSegundos * 1000;
  for (;;) {
    const eventos = eventosDe(ctx, sesion.session_id);
    if (eventos !== null) {
      ultimo = buscarEnElRegistro(eventos, requestId);
      if (ultimo.terminado === true) break;
    }
    if (Date.now() >= limite) break;
    await esperar(MS_ENTRE_MIRADAS);
  }
  // El turno, apuntado con la marca: es lo que pinta «GPT WEB →» en esa fila.
  if (ultimo.turno !== null) apuntarEnviado(casa, { request_id: requestId, session_id: sesion.session_id, turno: ultimo.turno, cliente, permitido: true });

  const comun = {
    ok: true,
    session_id: sesion.session_id,
    turn_id: requestId,
    turno: ultimo.turno,
    titulo: sesion.titulo,
    carpeta: sesion.carpeta,
    remitente: { sender: 'openai-mcp', source: 'chatgpt-web', cliente: cliente ?? 'MCP' },
    encierro: {
      permiso: cerco.encerrada === true ? 'workspace-write' : null,
      permiso_previo: cerco.permiso_previo ?? null,
      motivo: cerco.motivo ?? null,
      aviso: 'Mientras esta sesión esté abierta a ChatGPT sus turnos van encerrados en su carpeta, sin terminal, sin procesos, sin red y sin subagentes. El motor no deja aplicarlo sólo a los turnos del chat, así que vale para toda la sesión.',
    },
    espera: { pedida_segundos: esperaSegundos, agotada: ultimo.terminado !== true, esperada_ms: Date.now() - antes },
  };
  if (ultimo.error !== null) {
    return { ...comun, estado: 'fallido', respuesta: null, motivo: ultimo.error };
  }
  if (ultimo.respuesta !== null) {
    return { ...comun, estado: 'completado', respuesta: ultimo.respuesta };
  }
  return {
    ...comun,
    estado: 'en_marcha',
    respuesta: null,
    motivo: 'se agotaron los ' + esperaSegundos + ' s y el turno sigue: no preguntes en bucle, usa get_session_reply con el turn_id como mucho una vez cada 20 s',
  };
}

/**
 * La respuesta de un mensaje que entró por aquí, por su `turn_id` (o por
 * `session_id`, que devuelve la del último envío de esa sesión).
 * @param {{ctx: object, casa: string, turnId?: string, sessionId?: string}} opciones
 * @returns {Promise<object>}
 */
export async function respuestaDe({ ctx, casa, turnId, sessionId }) {
  const enviados = leerEnviados(casa, 500);
  let fila = null;
  if (typeof turnId === 'string' && turnId.trim() !== '') {
    fila = enviados.find((e) => e.request_id === turnId.trim() && e.permitido === true) ?? null;
    if (fila === null) {
      return { ok: false, error: 'TURN_NOT_FOUND', motivo: 'no encuentro ningún mensaje con ese turn_id en esta casa (¿lo mandó otro cliente, o es de antes de reiniciar el cuaderno?)' };
    }
  } else if (typeof sessionId === 'string' && sessionId.trim() !== '') {
    fila = enviados.find((e) => e.session_id === sessionId.trim() && e.permitido === true && e.turno !== null && e.turno !== undefined)
      ?? enviados.find((e) => e.session_id === sessionId.trim() && e.permitido === true)
      ?? null;
    if (fila === null) return { ok: false, error: 'TURN_NOT_FOUND', motivo: 'esa sesión no tiene ningún mensaje mandado por aquí' };
  } else {
    return { ok: false, error: 'TURN_NOT_FOUND', motivo: 'hace falta `turn_id` o `session_id`' };
  }
  const eventos = eventosDe(ctx, fila.session_id);
  if (eventos === null) {
    return { ok: false, error: 'SESSION_NOT_LIVE', session_id: fila.session_id, turn_id: fila.request_id, motivo: 'esa sesión no está viva en el panel: ábrela para poder leer su respuesta' };
  }
  const visto = buscarEnElRegistro(eventos, fila.request_id);
  return {
    ok: true,
    session_id: fila.session_id,
    turn_id: fila.request_id,
    turno: visto.turno ?? fila.turno ?? null,
    estado: visto.error !== null ? 'fallido' : (visto.terminado === true ? 'completado' : 'en_marcha'),
    respuesta: visto.respuesta,
    motivo: visto.error,
  };
}
