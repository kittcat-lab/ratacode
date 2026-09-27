#!/usr/bin/env node
/**
 * ratacode-mcp — el servidor MCP de RATACODE.
 *
 *   ratacode-mcp                 habla MCP por stdio (lo que espera un cliente)
 *   ratacode-mcp --status        enseña el estado y sale (sin arrancar el motor)
 *   ratacode-mcp --http          también por Streamable HTTP en 127.0.0.1:<puerto>/mcp/<clave>
 *   ratacode-mcp --acepto-lectura-total  OBLIGATORIO con --http: ver `lib/lectura.js`
 *   ratacode-mcp --home <ruta>   usa otra casa (por defecto %USERPROFILE%\.ratacode)
 *   ratacode-mcp --dsh <ruta>    usa otro binario del motor (para pruebas)
 *
 * Por stdio, stdout es del protocolo: aquí TODO lo que contamos va a stderr.
 * Por HTTP, la clave va en la propia URL y se guarda en la casa (nunca en el
 * repositorio). El puerto por defecto es 3778; el tope de tareas por hora es 30.
 *
 * Y por HTTP hace falta `--acepto-lectura-total`: el motor no sabe encerrar la
 * LECTURA de una tarea (sólo la escritura), así que quien tenga la URL puede
 * pedir que le lean cualquier fichero del PC. Se dice, se acepta por escrito y
 * entonces se abre.
 */
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { binDelMotor, resolverCasa } from '../lib/casa.js';
import { exigirAceptoLecturaTotal } from '../lib/lectura.js';
import { aviso, fallo } from '../lib/registro.js';
import { montarServidor } from '../lib/servidor.js';
import { iniciarServidorHttp } from '../lib/http.js';
import { estadoDeLaCasa } from '../lib/tareas.js';

/** Puerto por defecto del transporte HTTP. */
const PUERTO_HTTP_DEFECTO = 3778;
/** Tope de tareas por hora por defecto. */
const TAREAS_POR_HORA_DEFECTO = 30;

/** La línea de órdenes. */
function uso() {
  return [
    'RATACODE-MCP · el servidor MCP de RATACODE',
    '',
    '  ratacode-mcp [opciones]',
    '',
    '  --home <ruta>        dónde vive la casa de RATACODE (por defecto %USERPROFILE%\\.ratacode)',
    '  --dsh <ruta>         binario del motor DSH a usar (por defecto, el del paquete instalado)',
    '  --status             enseña el estado del MCP y sale',
    '  --http               también por Streamable HTTP en 127.0.0.1:<puerto>/mcp/<clave>',
    '  --acepto-lectura-total  OBLIGATORIO con --http. Aceptas que las tareas pueden LEER',
    '                       cualquier fichero de tu PC (el motor no encierra la lectura)',
    '  --nueva-clave        estrena una clave HTTP nueva (por defecto se reutiliza la guardada)',
    '  --port <n>           puerto HTTP (por defecto ' + PUERTO_HTTP_DEFECTO + ')',
    '  --tareas-por-hora <n> tope de tareas por hora (por defecto ' + TAREAS_POR_HORA_DEFECTO + ')',
    '  -h, --help           esto',
    '',
    'Sin opciones, habla MCP por stdio (lo que espera cualquier cliente MCP local).',
    'Con --http, habla por los dos a la vez; la clave de la URL se genera y se',
    'guarda en la casa (en <casa>\\mcp\\http-secret.txt), nunca en el repositorio.',
    '',
    'Las tareas ESCRIBEN sólo dentro de su espacio autorizado, pero PUEDEN LEER',
    'todo lo que pueda leer tu usuario (incluida <casa>\\.credentials.yaml): por eso',
    'el HTTP no se abre sin --acepto-lectura-total. El detalle, en lib/lectura.js.',
    '',
  ].join('\n');
}

/** Leer la línea de órdenes. */
function leerOrdenes(argv) {
  const ordenes = { casa: undefined, motor: undefined, estado: false, ayuda: false, http: false, aceptoLecturaTotal: false, nuevaClave: false, puerto: PUERTO_HTTP_DEFECTO, tareasPorHora: TAREAS_POR_HORA_DEFECTO };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-h' || a === '--help') ordenes.ayuda = true;
    else if (a === '--status') ordenes.estado = true;
    else if (a === '--http') ordenes.http = true;
    else if (a === '--acepto-lectura-total') ordenes.aceptoLecturaTotal = true;
    else if (a === '--nueva-clave') ordenes.nuevaClave = true;
    else if (a === '--port' || a.startsWith('--port=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('--port debe ser un puerto 1-65535');
      ordenes.puerto = n;
    } else if (a === '--tareas-por-hora' || a.startsWith('--tareas-por-hora=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1) throw new Error('--tareas-por-hora debe ser un entero positivo');
      ordenes.tareasPorHora = n;
    } else if (a === '--home' || a.startsWith('--home=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!valor) throw new Error('--home necesita una ruta');
      ordenes.casa = valor;
    } else if (a === '--dsh' || a.startsWith('--dsh=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!valor) throw new Error('--dsh necesita una ruta');
      ordenes.motor = valor;
    } else throw new Error('no entiendo «' + a + '» (mira: ratacode-mcp --help)');
  }
  return ordenes;
}

/**
 * La clave larga de la URL HTTP. Se guarda en la casa (nunca en el repositorio)
 * con permisos de sólo-dueño; si ya existe se reutiliza, salvo que se pida una
 * nueva (`--nueva-clave`, y `tunel.mjs` la estrena al abrir el túnel).
 * @param {string} casa - la casa de RATACODE.
 * @param {boolean} nueva - true para estrenar clave aunque ya haya una.
 * @returns {string} la clave (hex).
 */
function claveHttp(casa, nueva = false) {
  const ruta = join(casa, 'mcp', 'http-secret.txt');
  if (nueva !== true) {
    try {
      const leida = readFileSync(ruta, 'utf8').trim();
      if (/^[0-9a-f]{16,}$/.test(leida)) return leida;
    } catch { /* la generamos */ }
  }
  const clave = randomBytes(32).toString('hex');
  escribirSecreto(ruta, clave + '\n');
  return clave;
}

/**
 * Escribir un fichero de secretos con permisos de sólo-dueño. En POSIX el `mode`
 * de `writeFileSync` no se aplica si el fichero YA existía, así que después se
 * fuerza con `chmod` (en Windows el modo es casi decorativo, pero se pone igual).
 */
function escribirSecreto(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
  try { chmodSync(ruta, 0o600); } catch { /* Windows, o sin permisos: da igual */ }
}

async function main() {
  const ordenes = leerOrdenes(process.argv.slice(2));
  if (ordenes.ayuda) {
    process.stdout.write(uso());
    return;
  }
  const casa = resolverCasa(ordenes.casa);

  if (ordenes.estado) {
    process.stdout.write(JSON.stringify(estadoDeLaCasa(casa), null, 2) + '\n');
    return;
  }

  // LA PUERTA DE LA LECTURA: sin aceptación explícita no se abre el HTTP. Se
  // comprueba antes de estrenar la casa y antes de arrancar el motor, para que
  // negarse no deje ningún efecto detrás. (`--help` y `--status` no abren nada:
  // esos dos siguen funcionando sin la bandera.)
  if (ordenes.http && !exigirAceptoLecturaTotal({
    aceptado: ordenes.aceptoLecturaTotal,
    mando: 'ratacode mcp --http --acepto-lectura-total',
  })) {
    process.exit(1);
  }

  const dshBin = binDelMotor(ordenes.motor);
  const { servidor, tareas, fabricaServidor } = montarServidor({
    casa,
    dshBin,
    cwdPorDefecto: process.cwd(),
    tareasPorHora: ordenes.tareasPorHora,
    // En modo HTTP el espacio se aprieta: hacen falta `mcp.workspaces` y no vale
    // ni la raíz del disco ni la carpeta del usuario (mira `resolverEspacio`).
    http: ordenes.http,
  });

  // stdio: siempre (es el transporte de siempre).
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);

  aviso('en marcha · casa: ' + casa);
  aviso('en marcha · motor: ' + dshBin);
  aviso('en marcha · herramientas: list_providers, list_models, run_task, get_task_status, get_task_result, cancel_task, ratacode_status');
  aviso('en marcha · tope de tareas: ' + ordenes.tareasPorHora + '/h');
  tareas.resumir();

  // HTTP: además del stdio, si se pidió.
  if (ordenes.http) {
    const rutaClave = join(casa, 'mcp', 'http-secret.txt');
    const rutaUrl = join(casa, 'mcp', 'http-url.txt');
    const clave = claveHttp(casa, ordenes.nuevaClave);
    /** La URL con la clave, al fichero. Se reescribe si la clave rota. */
    const guardarUrl = (c) => {
      try { escribirSecreto(rutaUrl, 'http://127.0.0.1:' + ordenes.puerto + '/mcp/' + c + '\n'); }
      catch { /* no es crítico */ }
    };
    const http = await iniciarServidorHttp({
      fabricaServidor,
      puerto: ordenes.puerto,
      clave,
      rutaClave,
      alRotar: guardarUrl,
      host: '127.0.0.1',
    });
    // La clave NO se escribe en stderr: los clientes MCP guardan ese stderr en
    // sus registros. Se dice dónde está y ya.
    aviso('en marcha · HTTP en http://127.0.0.1:' + ordenes.puerto + '/mcp/<oculta>');
    aviso('en marcha · la URL COMPLETA (con la clave) está en ' + rutaUrl);
    guardarUrl(http.claveActual());
    http.servidor.on('clientError', () => {});
  }

  // Al irnos, no dejamos tareas huérfanas trabajando por detrás.
  const recoger = () => {
    for (const recibo of tareas.listar()) {
      if (recibo.estado === 'queued' || recibo.estado === 'running') {
        try { tareas.cancelar(recibo.task_id); } catch { /* ya no está */ }
      }
    }
  };
  process.on('SIGINT', () => { recoger(); process.exit(130); });
  process.on('SIGTERM', () => { recoger(); process.exit(143); });
  process.on('exit', recoger);
}

try {
  await main();
} catch (e) {
  fallo('no pude arrancar', e);
  process.exitCode = 1;
}
