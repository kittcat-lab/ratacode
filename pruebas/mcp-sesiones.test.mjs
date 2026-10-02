/**
 * mcp-sesiones — R28 · LAS PIEZAS PURAS DE «CHATGPT HABLA CON UNA SESIÓN ABIERTA».
 *
 * Lo que se prueba aquí es lo que DECIDE, sin panel y sin motor delante:
 *   · elegir la sesión sin adivinar (por id, por título exacto, y con el
 *     AMBIGUOUS_SESSION cuando hay dos iguales —que es el caso que pidió el dueño:
 *     «si hay más de una coincidencia, NO envía y devuelve error»);
 *   · leer el registro durable de una sesión para encontrar el mensaje que
 *     entró por aquí (por su `requestId`, que es METADATA) y lo que vino
 *     después: el turno y la respuesta;
 *   · las herramientas que se cierran a una sesión abierta (las vías de escape)
 *     y las que no;
 *   · qué carpetas están dentro de las autorizadas;
 *   · y el estado del interruptor «Abierta a ChatGPT», que viene APAGADO.
 *
 * El módulo que se prueba es el MISMO que viaja copiado dentro del perfil del
 * panel (`piel/lib/sesiones.js`): no hay una copia para el test.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buscarEnElRegistro,
  dentroDeAlguna,
  elegirSesion,
  esEscape,
  estaAbierta,
  leerAbiertas,
  leerEnviados,
  marcarAbierta,
  motivoEscape,
  rutaDeAbiertas,
  textoAsistente,
} from '../piel/lib/sesiones.js';

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK     ' : 'MAL    ') + queja + '\n');
}
/**
 * Lo que sólo tiene sentido con rutas de Windows (`\\`, UNC, mayúsculas que
 * no cuentan). Fuera de Windows NO se da por buena: se apunta como no comprobada.
 */
const sinComprobar = [];
function comprobarEnWindows(condicion, queja) {
  if (process.platform === 'win32') return comprobar(condicion, queja);
  sinComprobar.push(queja);
  process.stdout.write('SOLO WINDOWS  ' + queja + ' (sin comprobar en ' + process.platform + ')\n');
}
const di = (t) => process.stdout.write(t + '\n');

const casa = mkdtempSync(join(tmpdir(), 'ratacode-r28-'));
const taller = join(casa, 'taller');
const fuera = join(casa, 'fuera');

try {
  // ── 1 · ELEGIR LA SESIÓN: SIN ADIVINAR ───────────────────────────────────
  di('· elegir la sesión (id canónico, título exacto y el caso ambiguo)');
  const lista = [
    { session_id: 'session-aaa', titulo: 'ESTO SERA UN TEST DI' },
    { session_id: 'session-bbb', titulo: 'Otra cosa' },
    { session_id: 'session-ccc', titulo: 'ESTO SERA UN TEST DI' },
  ];
  const porId = elegirSesion(lista, { sessionId: 'session-bbb' });
  comprobar(porId.ok === true && porId.sesion.session_id === 'session-bbb', 'por `session_id` elige ESA y sólo ésa');
  const porTitulo = elegirSesion(lista, { titulo: 'Otra cosa' });
  comprobar(porTitulo.ok === true && porTitulo.sesion.session_id === 'session-bbb', 'por título único, la encuentra');
  const ambiguo = elegirSesion(lista, { titulo: 'ESTO SERA UN TEST DI' });
  comprobar(ambiguo.ok === false && ambiguo.error === 'AMBIGUOUS_SESSION', 'con DOS sesiones del mismo título: AMBIGUOUS_SESSION (no envía)');
  comprobar(JSON.stringify(ambiguo.ids) === JSON.stringify(['session-aaa', 'session-ccc']), 'y devuelve los DOS ids: ' + JSON.stringify(ambiguo.ids));
  const sinNada = elegirSesion(lista, {});
  comprobar(sinNada.ok === false && sinNada.error === 'SESSION_NOT_FOUND', 'sin id y sin título: SESSION_NOT_FOUND (no adivina)');
  const inexistente = elegirSesion(lista, { sessionId: 'session-zzz' });
  comprobar(inexistente.ok === false && inexistente.error === 'SESSION_NOT_FOUND', 'con un id que no está: SESSION_NOT_FOUND');
  const tituloDistinto = elegirSesion(lista, { titulo: 'esto sera un test di' });
  comprobar(tituloDistinto.ok === false, 'el título tiene que ser EXACTO (no vale en minúsculas ni parecido)');

  // ── 2 · EL REGISTRO: LA MARCA ES EL `requestId`, NO EL TEXTO ─────────────
  di('· leer el registro durable por el `requestId` (metadata, nunca por el texto)');
  const eventos = [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'm1', content: [{ type: 'text', text: 'hola' }], source: { kind: 'user', rpcId: 'rpc-otro' } } },
    { type: 'assistant/message', seq: 2, data: { message: { content: [{ type: 'text', text: 'buenas' }] } } },
    { type: 'turn/end', seq: 3, data: { reason: { kind: 'completed' } } },
    { type: 'turn/start', seq: 4, data: { turn: 2 } },
    { type: 'user/message', seq: 5, data: { id: 'm2', content: [{ type: 'text', text: 'MENSAJE DE GPT WEB' }], source: { kind: 'user', rpcId: 'rpc-nuestro' } } },
    { type: 'assistant/message', seq: 6, data: { message: { content: [{ type: 'text', text: 'TEST RECIBIDO 3009' }] } } },
    { type: 'turn/end', seq: 7, data: { reason: { kind: 'completed' } } },
  ];
  const visto = buscarEnElRegistro(eventos, 'rpc-nuestro');
  comprobar(visto.seq === 5, 'encuentra NUESTRO mensaje por su `rpcId` (seq 5), no el otro');
  comprobar(visto.turno === 2, 'y dice el TURNO en el que cayó (2), que es lo que pinta «GPT WEB →»');
  comprobar(visto.terminado === true && visto.respuesta === 'TEST RECIBIDO 3009', 'y devuelve la respuesta del agente: ' + JSON.stringify(visto.respuesta));
  const enMarcha = buscarEnElRegistro(eventos.slice(0, 6), 'rpc-nuestro');
  comprobar(enMarcha.seq === 5 && enMarcha.terminado === false && enMarcha.respuesta === null, 'sin respuesta todavía: «en marcha» (y se sabe que entró)');
  const conError = buscarEnElRegistro([
    ...eventos.slice(0, 6),
    { type: 'turn/end', seq: 6, data: { reason: { kind: 'error', error: { message: 'se cayó el modelo' } } } },
  ], 'rpc-nuestro');
  comprobar(conError.terminado === true && /se cayó el modelo/.test(String(conError.error)), 'si el turno acaba en error, se dice el error');
  const noEsta = buscarEnElRegistro(eventos, 'rpc-que-no-existe');
  comprobar(noEsta.seq === null && noEsta.terminado === false, 'un `rpcId` que no está en el registro: ni mensaje ni respuesta');
  comprobar(textoAsistente({ content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] }) === 'a\nb',
    'de un mensaje del asistente sólo se sacan los bloques de texto');

  // ── 3 · LAS VÍAS DE ESCAPE, CERRADAS ─────────────────────────────────────
  di('· las vías de escape que se cierran a una sesión abierta (R28 §3c)');
  for (const nombre of ['bash', 'pwsh', 'shell', 'terminal', 'job_kill', 'job_output', 'web_fetch', 'web_search', 'subagent', 'subagent_fork', 'workflow', 'mcp__algo']) {
    comprobar(esEscape(nombre) === true, 'se cierra: ' + nombre);
  }
  for (const nombre of ['read', 'write', 'edit', 'glob', 'grep', 'todo_write', 'read_image', 'skill']) {
    comprobar(esEscape(nombre) === false, 'NO se cierra (es trabajo normal): ' + nombre);
  }
  comprobar(/abierta a ChatGPT/.test(motivoEscape('bash')), 'y el motivo lo dice claro: ' + motivoEscape('bash').slice(0, 60) + '…');

  // ── 4 · LAS CARPETAS ─────────────────────────────────────────────────────
  di('· dentro de las carpetas autorizadas (con `..`, y sin distinguir mayúsculas en Windows)');
  comprobar(dentroDeAlguna(taller, [taller]) === true, 'la carpeta autorizada, ella misma');
  comprobar(dentroDeAlguna(join(taller, 'sub', 'x.txt'), [taller]) === true, 'algo de dentro');
  comprobar(dentroDeAlguna(join(taller, 'sub', '..', 'x.txt'), [taller]) === true, 'con `..` que no se sale');
  comprobar(dentroDeAlguna(join(taller, '..', 'fuera', 'x.txt'), [taller]) === false, 'con `..` que SÍ se sale: fuera');
  comprobar(dentroDeAlguna(fuera, [taller]) === false, 'otra carpeta: fuera');
  comprobarEnWindows(dentroDeAlguna(taller.toUpperCase(), [taller]) === true, 'las mayúsculas no cuentan (Windows)');
  comprobar(dentroDeAlguna('', [taller]) === false, 'sin carpeta, no hay permiso');

  // ── 5 · EL INTERRUPTOR: APAGADO POR DEFECTO ──────────────────────────────
  di('· el interruptor «Abierta a ChatGPT» (apagado por defecto, y se apunta)');
  comprobar(estaAbierta(casa, 'session-aaa') === false, 'sin fichero, NINGUNA sesión está abierta');
  comprobar(JSON.stringify(leerAbiertas(casa).sesiones) === '{}', 'y el estado de fábrica es el vacío');
  marcarAbierta(casa, 'session-aaa', true, { titulo: 'ESTO SERA UN TEST DI', carpeta: taller, permisoPrevio: 'danger-full-access' });
  comprobar(estaAbierta(casa, 'session-aaa') === true, 'al abrirla, queda abierta');
  comprobar(estaAbierta(casa, 'session-bbb') === false, 'y las demás siguen cerradas');
  const guardado = JSON.parse(readFileSync(rutaDeAbiertas(casa), 'utf8'));
  comprobar(guardado.sesiones['session-aaa'].permiso_previo === 'danger-full-access',
    'se apunta el permiso que tenía, para devolvérselo al cerrar');
  marcarAbierta(casa, 'session-aaa', false);
  comprobar(estaAbierta(casa, 'session-aaa') === false, 'al cerrarla, deja de estar abierta');
  comprobar(leerAbiertas(casa).sesiones['session-aaa'] === undefined, 'y no se queda basura que pudiera reabrirla sola');

  // ── 6 · EL CUADERNO: LA MARCA Y LO BLOQUEADO ─────────────────────────────
  di('· el cuaderno de envíos (la marca «GPT WEB →», con permitido/bloqueado)');
  const { apuntarEnviado } = await import('../piel/lib/sesiones.js');
  apuntarEnviado(casa, { request_id: 'rpc-nuestro', session_id: 'session-aaa', turno: 2, cliente: 'ChatGPT', permitido: true });
  apuntarEnviado(casa, { request_id: 'rpc-no', session_id: 'session-bbb', cliente: 'ChatGPT', permitido: false, motivo: 'SESSION_NOT_ALLOWED' });
  const enviados = leerEnviados(casa);
  comprobar(enviados.length === 2, 'las dos líneas quedan apuntadas');
  comprobar(enviados.some((e) => e.request_id === 'rpc-nuestro' && e.sender === 'openai-mcp' && e.source === 'chatgpt-web' && e.turno === 2),
    'la del mensaje bueno va con sender=openai-mcp, source=chatgpt-web y su turno');
  comprobar(enviados.some((e) => e.permitido === false && e.motivo === 'SESSION_NOT_ALLOWED'),
    'y la BLOQUEADA también queda (es la que el humano quiere ver)');
} finally {
  rmSync(casa, { recursive: true, force: true });
}

di('');
if (fallos.length === 0) {
  di('VERDE · las piezas de R28 (elegir sesión, leer el registro, el cerco y el interruptor): ' + cuantas + ' comprobaciones.'
    + (sinComprobar.length > 0 ? ' (' + sinComprobar.length + ' sólo de Windows, sin comprobar aquí)' : ''));
} else {
  di('ROJO · ' + fallos.length + ' cosa(s) mal de ' + cuantas + ':');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = 1;
}
