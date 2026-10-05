#!/usr/bin/env node
/**
 * PRUEBA DE LA PIEL · `npm test` de RATACODE.
 *
 * Hace estas cosas, en este orden, y sale 0 sólo si todas están verdes:
 *
 *   A · ARRANCA de verdad: levanta `bin/ratacode.js` en el puerto 3140 con una
 *       casa NUEVA (`producto\_pruebaR3-piel`) y una carpeta de trabajo nueva,
 *       y espera a que el motor anuncie su URL.
 *   B · PIDE EL INDEX por HTTP y comprueba que la PIEL ESTÁ puesta: el
 *       `<style id="ratacode-piel">`, las variables de la identidad, los dos
 *       guiones y el emblema en data-URI. También pide, por sus rutas
 *       protegidas: el texto de la conexión (GET/POST `/ratacode/handshake`, que
 *       deja `<casa>\handshake.md` en 40 líneas o menos) y el MCP para chats
 *       web (`/ratacode/mcp`, con los dos comandos y el texto del chat), y
 *       comprueba que el plugin de CLIENTE —la sección «Conexiones» de
 *       Ajustes— se sirve de verdad en `/plugins/??ratacode-piel/client.js`.
 *       R29: ese mismo texto tiene que mandar leer `apreton/tutor.md` CON su
 *       ruta real (la guía del tutor viaja en el paquete, 120 líneas o menos).
 *   B6 · R17: `/ratacode/clave` dice si al modelo por DEFECTO de la casa (esta
 *       prueba la estrena SIN claves en su entorno) le falta la clave, con el
 *       `describe` del servicio de credenciales del motor y sin devolver jamás
 *       el valor de ninguna.
 *   B8 · R18: `/ratacode/runtimes` devuelve los DOS runtimes locales (Ollama y
 *       LM Studio) con su baseURL, si están encendidos (sondeo corto, que aquí
 *       contesta «apagado» sin bloquear) y la tabla del README por tarjeta; y el
 *       bundle del plugin trae la pestaña «Modelos locales» y la piel esconde
 *       los dos locales de Ajustes › Models (filtro de la piel).
 *   C · COMPRUEBA QUE LA PIEL ENCAJA: cada selector `[class*='_algo']` de
 *       `piel/activos/ratacode-piel.css` tiene que existir en el CSS del
 *       frontend de DSH INSTALADO.
 *   D · LOS PROVEEDORES de fábrica: `fabrica/settings.yaml` declara los 7 que
 *       se declaran (B.AI, OpenRouter, Groq, Gemini, NVIDIA NIM, SambaNova y
 *       Cloudflare Workers AI) más los DOS locales de R16 (Ollama y LM Studio,
 *       que van sin apiKeyEnv y desde R18 viven en Ajustes › Modelos locales)
 *       con su baseURL y su apiKeyEnv oficiales, y NO
 *       declara «deepseek» (lo sirve el adaptador nativo: 8 en Ajustes › Models).
 *   E · R34 · EL BOTÓN «AUTORIZAR ESTA CARPETA» (el puente con GPT):
 *       E1 · la función PURA `ponerWorkspaceEnTexto` —con `mcp:` y
 *            `workspaces:`, con `mcp:` sin `workspaces:` y sin `mcp:`— y que
 *            nada del fichero se pierde (comentarios, claves, CRLF).
 *       E2 · la ruta `POST /ratacode/sesiones/autorizar`: SIN la cabecera
 *            `Sec-Fetch-Site: same-origin` contesta 403: cerco de Fetch Metadata
 *            frente a peticiones de otra web, no identidad humana (Node puede
 *            enviar esa cabecera); sin cookie, 401; y NO se autorizan ni la
 *            carpeta de usuario, ni su padre, ni la
 *            raíz del disco, ni lo que no existe o no es carpeta; y la que ya
 *            está dentro de una autorizada se dice, no se añade.
 *       E3 · el dos pasos entero: el paso 1 da el nonce y NO escribe, el paso 2
 *            escribe (con copia `.bak`, releyendo el YAML y sin perder ni una
 *            línea), el nonce se gasta al usarlo y la piel ve la carpeta nueva
 *            sin reiniciar nada. Todo sobre la casa TEMPORAL de esta prueba.
 *
 * ── QUÉ ES «EL CSS DEL FRONTEND DE DSH INSTALADO» (medido, 24-sep-2026) ─────
 * No es sólo `@deepseek-ai/dsh-web-frontend/dist/assets/*.css`. Los nombres de
 * clase con hash de la interfaz son de CSS-modules y viven en el bundle de
 * cada plugin de cliente, que es lo que el navegador recibe en
 * `/plugins/<id>/client.js`. Medido: `_sidebarCol` aparece en
 * `dsh-client-ui-layout/lib/client.js`, `_logoRow` en
 * `dsh-client-ui-sidebar/lib/client.js`, y NINGUNO de los dos en el `dist` del
 * frontend. Así que «el CSS instalado» = el `dist` del frontend + TODOS los
 * `client.js` de los plugins de cliente del árbol de DSH instalado. Mirar sólo
 * el `dist` daría 17 falsos negativos.
 *
 * Uso:
 *   node pruebas/piel.test.mjs             (o: npm test)
 *   node pruebas/piel.test.mjs --puerto 3101 --casa <ruta> --taller <ruta> --temp <ruta>
 *
 * De fábrica, la casa y el taller de prueba viven en
 * `..\trabajo\puente-temp` (fuera del producto), y el proceso hijo arranca con
 * TEMP y TMP apuntando ahí.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import yaml from 'js-yaml';
import { ponerWorkspaceEnTexto } from '../piel/lib/index.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const RATACODE = join(PRODUCTO, 'bin', 'ratacode.js');
const PIEL_CSS = join(PRODUCTO, 'piel', 'activos', 'ratacode-piel.css');

/**
 * Los temporales de ESTA prueba: SIEMPRE aquí dentro (ni la carpeta temporal del
 * sistema ni el árbol del producto). La casa y el taller de prueba se crean
 * dentro, y el proceso hijo de RATACODE arranca con TEMP y TMP apuntando aquí —
 * sólo el hijo: el entorno de este proceso no se toca.
 */
const TEMP_POR_DEFECTO = resolve(PRODUCTO, '..', 'trabajo', 'puente-temp');

// ── la línea de órdenes ─────────────────────────────────────────────────────
function leerArgumentos(argv) {
  const args = { puerto: 3140, temp: TEMP_POR_DEFECTO, casa: null, taller: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--puerto') args.puerto = Number(argv[++i]);
    else if (argv[i] === '--temp') args.temp = resolve(argv[++i]);
    else if (argv[i] === '--casa') args.casa = resolve(argv[++i]);
    else if (argv[i] === '--taller') args.taller = resolve(argv[++i]);
    else throw new Error('no entiendo «' + argv[i] + '»');
  }
  if (args.casa === null) args.casa = join(args.temp, 'casa');
  if (args.taller === null) args.taller = join(args.temp, 'taller');
  // Estos árboles se borran al arrancar: solo bancos bajo trabajo, sin solaparse.
  const dentro = (padre, ruta) => {
    const tramo = relative(padre, resolve(ruta));
    return tramo !== '' && tramo !== '..' && !tramo.startsWith('..' + sep) && !isAbsolute(tramo);
  };
  const trabajo = resolve(PRODUCTO, '..', 'trabajo');
  if (!dentro(trabajo, args.temp) || !dentro(args.temp, args.casa) || !dentro(args.temp, args.taller)
    || args.casa === args.taller || dentro(args.casa, args.taller) || dentro(args.taller, args.casa)) {
    throw new Error('el banco debe usar --temp bajo ratacode\\trabajo y casa/taller distintos dentro de ese temporal');
  }
  return args;
}

// ── el informe de la prueba ─────────────────────────────────────────────────
const fallos = [];
const lineas = [];

function di(texto) {
  lineas.push(texto);
  process.stdout.write(texto + '\n');
}

function comprobar(condicion, queja) {
  if (condicion) return true;
  fallos.push(queja);
  return false;
}

/** R35 · el plugin real con stores/RPC simulados: ninguna casa ni proveedor. */
async function probarOrdenModelos() {
  let plugin;
  let selector;
  const desmontajes = [];
  const react = {
    createElement: () => null,
    useEffect: (montar) => { const soltar = montar(); if (typeof soltar === 'function') desmontajes.push(soltar); },
  };
  runInNewContext(readFileSync(join(PRODUCTO, 'piel', 'lib', 'cliente.js'), 'utf8'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory((nombre) => {
      if (nombre !== 'react') throw new Error('módulo inesperado en el banco: ' + nombre);
      return react;
    }); } } },
  });
  const crearStore = (valor) => {
    const oyentes = new Set();
    let cambios = 0;
    return {
      getSnapshot: () => valor,
      subscribe: (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); },
      set: (nuevo) => { valor = nuevo; cambios += 1; for (const fn of [...oyentes]) fn(); },
      oyentes, cambios: () => cambios,
    };
  };
  const grupos = ['deepseek', 'b-ai', 'alias', 'ollama'].map((id) => ({ id, models: [{ id: id + '-modelo' }] }));
  const seleccion = { provider: 'deepseek', model: 'deepseek-modelo' };
  const catalogo = crearStore({ groups: grupos, current: seleccion, failures: [], status: 'ready' });
  const filas = [
    { entry: { provider: 'deepseek' }, configured: true, apiKeyEnv: 'DEEPSEEK_API_KEY', credential: { configured: false } },
    { entry: { provider: 'b-ai' }, configured: true, apiKeyEnv: 'B_AI_API_KEY', credential: { configured: true } },
    { entry: { provider: 'ollama' }, configured: true, derivedCredential: { configured: true } },
  ];
  const modelos = crearStore({ rows: filas, status: 'ready', error: null, credentialError: null });
  const eventos = new Map();
  const slotsOyentes = new Set();
  const refsPedidas = [];
  const pendientes = [];
  const escuchar = (nombre, fn) => {
    const lista = eventos.get(nombre) ?? new Set();
    eventos.set(nombre, lista); lista.add(fn);
    return () => lista.delete(fn);
  };
  const entrada = { options: { id: 'models' }, inject: () => ({ controller: { store: modelos } }) };
  const ctx = {
    slots: {
      entriesOfSlot: () => [entrada],
      subscribe: (_nombre, fn) => { slotsOyentes.add(fn); return () => slotsOyentes.delete(fn); },
      inject: (_nombre, montar) => montar(),
      register: (_opciones, componente) => { selector = componente; return () => {}; },
    },
    modelDirectories: { directoryFor: () => ({ store: catalogo }) },
    on: escuchar,
    remote: {
      $on: escuchar,
      llm: { listConfigurableProviders: async () => ({ ok: true, value: [
        { provider: 'deepseek', settingsNs: 'nativo', settingsPath: [] },
        { provider: 'b-ai', settingsNs: 'api', settingsPath: ['providers', 'b-ai'] },
        { provider: 'alias', settingsNs: 'api', settingsPath: ['providers', 'alias'] },
        { provider: 'ollama', settingsNs: 'api', settingsPath: ['providers', 'ollama'] },
      ] }) },
      settings: { describe: async () => ({ ok: true, value: { namespaces: [
        { ns: 'nativo', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } },
        { ns: 'api', value: { providers: {
          'b-ai': { apiKeyEnv: 'B_AI_API_KEY' }, alias: { apiKeyEnv: 'B_AI_API_KEY' }, ollama: {},
        } } },
      ] } }) },
      credentials: { describe: (refs) => {
        refsPedidas.push([...refs]);
        return new Promise((resolver) => pendientes.push(resolver));
      } },
    },
  };
  const asentar = async () => { for (let i = 0; i < 24; i += 1) await Promise.resolve(); };
  const responder = (resolver, nativa, bai) => resolver({ ok: true, value: {
    DEEPSEEK_API_KEY: { configured: nativa }, B_AI_API_KEY: { configured: bai },
  } });
  const emitir = (nombre) => { for (const fn of eventos.get(nombre) ?? []) fn(); };
  const ids = () => catalogo.getSnapshot().groups.map((grupo) => grupo.id).join(',');
  const cerrar = plugin.ordenarModelosConClave(ctx);
  try {
    selector({ sessionId: 'sesion' });
    selector({ sessionId: 'sesion' });
    await asentar();
    comprobar(catalogo.oyentes.size === 1, 'R35: dos montajes de la misma sesión comparten una sola suscripción');
    comprobar(refsPedidas[0]?.length === 2 && refsPedidas[0].includes('B_AI_API_KEY'),
      'R35: describe consulta referencias reales únicas, incluido el alias, sin tratar el local como clave');
    responder(pendientes.shift(), false, true);
    await asentar();
    comprobar(ids() === 'b-ai,alias,deepseek,ollama', 'R35: claves confirmadas primero, orden estable entre iguales');
    comprobar(catalogo.getSnapshot().current === seleccion
      && catalogo.getSnapshot().groups.find((grupo) => grupo.id === 'b-ai').models === grupos[1].models,
      'R35: ordenar no cambia selección, identidades ni orden interno de modelos');
    comprobar(modelos.getSnapshot().rows.map((row) => row.entry.provider).join(',') === 'b-ai,deepseek,ollama',
      'R35: Ajustes ordena por credential.configured, nunca por perfil ni derivedCredential');
    for (const fn of slotsOyentes) fn();
    comprobar(modelos.oyentes.size === 1, 'R35: repintar Ajustes no duplica su suscripción');
    emitir('credentials/reference-updated');
    await asentar();
    const antigua = pendientes.shift();
    emitir('connection/reset');
    await asentar();
    const nueva = pendientes.shift();
    responder(nueva, true, false);
    await asentar();
    responder(antigua, false, true);
    await asentar();
    comprobar(ids() === 'deepseek,b-ai,alias,ollama', 'R35: la respuesta previa a reconectar no sobrescribe la confirmación nueva');
    const nuevosGrupos = [grupos[3], grupos[0], grupos[1], grupos[2]];
    catalogo.set({ ...catalogo.getSnapshot(), groups: nuevosGrupos });
    comprobar(ids() === 'deepseek,ollama,b-ai,alias', 'R35: un catálogo renovado mantiene su orden entre proveedores sin clave');
    emitir('settings/document-updated');
    await asentar();
    responder(pendientes.shift(), false, false);
    await asentar();
    comprobar(ids() === 'ollama,deepseek,b-ai,alias', 'R35: al retirar las claves se recupera el orden nuevo del motor');
    desmontajes.shift()();
    comprobar(catalogo.oyentes.size === 1, 'R35: desmontar una cabecera conserva la otra');
    emitir('credentials/reference-updated');
    await asentar();
    const tardia = pendientes.shift();
    cerrar();
    const cambios = catalogo.cambios();
    responder(tardia, false, true);
    await asentar();
    comprobar(catalogo.cambios() === cambios && catalogo.oyentes.size === 0 && modelos.oyentes.size === 0
      && slotsOyentes.size === 0 && [...eventos.values()].every((lista) => lista.size === 0),
      'R35: al descargar el plugin no quedan oyentes ni escrituras de respuestas tardías');
    comprobar(modelos.getSnapshot().rows === filas, 'R35: descargar restaura el orden del dueño de Ajustes');
    di('  R35 · orden por claves confirmadas, alias, reconexión y desmontaje (datos simulados).');
  } finally {
    cerrar();
    for (const soltar of desmontajes) soltar();
  }
}

// ── A · arrancar RATACODE de verdad ─────────────────────────────────────────
function arrancar(args) {
  rmSync(args.casa, { recursive: true, force: true });
  rmSync(args.taller, { recursive: true, force: true });
  mkdirSync(args.temp, { recursive: true });
  mkdirSync(args.taller, { recursive: true });
  // SIN CLAVES a propósito, en el entorno de ESTE proceso (R17): así la casa se
  // estrena con el modelo de fábrica (B.AI) y la prueba del aviso «falta la
  // clave» es la misma en cualquier PC, tenga o no credenciales de verdad.
  // Y con TEMP/TMP dentro de `trabajo\puente-temp`: los temporales del hijo se
  // quedan donde se pueden mirar (y borrar), ni en %TEMP% ni en el producto.
  const entorno = {
    ...process.env,
    TEMP: args.temp,
    TMP: args.temp,
    B_AI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    DEEPSEEK_API_KEY: '',
  };
  const hijo = spawn(process.execPath, [
    RATACODE, '--port', String(args.puerto), '--home', args.casa, '--carpeta', args.taller,
  ], { cwd: PRODUCTO, env: entorno, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const rutaUrl = join(args.casa, 'url.txt');
  const espera = new Promise((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Error(
      'RATACODE no dio URL en 120 s (¿puerto ' + args.puerto + ' ocupado? mira la salida de arriba)')), 120000);
    const mirar = setInterval(() => {
      if (!existsSync(rutaUrl)) return;
      const url = readFileSync(rutaUrl, 'utf8').trim();
      if (url === '') return;
      clearInterval(mirar);
      clearTimeout(reloj);
      resolver(url);
    }, 250);
    hijo.on('exit', (codigo) => {
      clearInterval(mirar);
      clearTimeout(reloj);
      rechazar(new Error('RATACODE se cerró antes de dar URL (código ' + codigo + ')'));
    });
  });
  return { hijo, espera };
}

async function matar(hijo) {
  if (hijo === null || hijo.pid === undefined || hijo.exitCode !== null || hijo.signalCode !== null) return;
  // Esperar el cierre de nuestras tuberías, no solo haber solicitado terminar.
  let reloj;
  const cerrado = new Promise((seguir, rechazar) => {
    hijo.once('close', seguir);
    reloj = setTimeout(() => rechazar(new Error('el proceso de esta prueba no se cerró en 15 segundos')), 15000);
  });
  // El rechazo puede llegar mientras taskkill termina: se recoge al esperar abajo.
  cerrado.catch(() => {});
  try {
    if (process.platform === 'win32') {
      const comando = new Promise((seguir, rechazar) => {
        const cierre = spawn('taskkill', ['/PID', String(hijo.pid), '/T', '/F'],
          { windowsHide: true, stdio: 'ignore' });
        cierre.once('error', rechazar);
        cierre.once('close', (codigo) => {
          if (codigo === 0 || hijo.exitCode !== null || hijo.signalCode !== null) seguir();
          else rechazar(new Error('taskkill no cerró el proceso de la prueba (código ' + codigo + ')'));
        });
      });
      await Promise.all([comando, cerrado]);
    } else hijo.kill('SIGTERM');
    await cerrado;
  } finally { clearTimeout(reloj); }
}

// ── B · el index servido ────────────────────────────────────────────────────
/**
 * El motor NO sirve el index a la primera: el `?token=` de la URL se cambia
 * por una galleta. Medido: `GET /?token=…` → 303 con `Location: /` y un
 * `Set-Cookie: dsh-auth-…`; `GET /` con esa galleta → 200 con el index. Node no
 * guarda galletas solo, así que se hace a mano, siguiendo como mucho 3 saltos.
 */
async function pedirIndex(url) {
  const galletas = new Map();
  let destino = url;
  let respuesta = null;
  for (let salto = 0; salto <= 3; salto += 1) {
    const cabeceras = {};
    if (galletas.size > 0) {
      cabeceras.cookie = [...galletas.entries()].map(([n, v]) => n + '=' + v).join('; ');
    }
    respuesta = await fetch(destino, { redirect: 'manual', headers: cabeceras });
    const puestas = (respuesta.headers.getSetCookie ? respuesta.headers.getSetCookie() : [respuesta.headers.get('set-cookie')])
      .filter(Boolean);
    for (const galleta of puestas) {
      const [nombre, ...resto] = galleta.split(';')[0].split('=');
      galletas.set(nombre, resto.join('='));
    }
    if (respuesta.status < 300 || respuesta.status >= 400) break;
    const location = respuesta.headers.get('location');
    if (!location) break;
    destino = new URL(location, destino).toString();
  }
  const html = await respuesta.text();
  return { estado: respuesta.status, html, galletas, destino };
}

/** Las piezas de la piel que TIENEN que verse en el index servido. */
const MARCAS_DEL_INDEX = [
  ['el <style> de la piel', '<style id="ratacode-piel">'],
  ['las variables de la identidad', '--mr-emblema'],
  ['el emblema de la rata en data-URI', '--mr-emblema:url("data:image/svg+xml,'],
  ['el color de marca de RATACODE', '#e4f226'],
  ['el adaptador de la columna', "_sidebarCol"],
  ['el botón de sesión nueva', '_newSession'],
  ['el guion de la piel', 'mr-dsh-word'],
  ['el guion de las chispas', 'mr-vida-salida'],
  ['la caja del encargo, en español (sesión)', 'Escribe tu encargo… / comandos · @ archivos y sesiones'],
  ['la portada, en español', 'Describe lo que quieres construir…'],
  ['«elige espacio de trabajo», en español', 'Elige un espacio de trabajo para empezar'],
  ['la caja se traduce en TODAS las cajas montadas', "querySelectorAll('[data-composer-placeholder]')"],
  ['la caja también por atributo (data-placeholder y aria-label)', "querySelectorAll('[data-placeholder]')"],
  ['la nota de la ventana nativa (no la tapa: la lleva a Models)', 'mr-guia'],
  ['el botón que lleva a Ajustes › Models', 'Ajustes › Models'],
  ['R12/R23: el plugin de cliente que monta la sección Conexiones', 'ratacode-piel/client.js'],
  ['el observador mira también el texto (React lo reescribe)', 'characterData:true'],
  ['el observador mira los ATRIBUTOS que reescribe React', "attributeFilter:['data-placeholder','aria-label']"],
  ['el rebote no depende de requestAnimationFrame', 'setTimeout(correr,16)'],
  ['R17: la piel pregunta si falta la clave (ruta del motor)', '/ratacode/clave'],
  ['R17: el aviso, en español, encima de la caja', 'Falta la clave de '],
  ['R17: la ruta del aviso dice «Abrir Ajustes › Models»', 'Abrir Ajustes › Models'],
  ['R17: la piel reescribe el error MISSING_CREDENTIAL del motor', 'MISSING_CREDENTIAL'],
  ['R17: el aviso se vuelve a mirar cada 3 s (se va solo)', 'setInterval(mirarClave,3000)'],
  ['R18: la piel esconde los locales de Ajustes › Models', 'Ollama (local, sin clave)'],
  ['R18: y deja la nota que lleva a su pestaña', 'mr-locales-nota'],
  ['R23: el aviso del runtime apagado es UNA línea', "' está apagado.'"],
  ['R23: el botón que abre la pestaña de los locales', 'Abrir Ajustes › Modelos locales'],
  ['R23: los Modos, marcados por la piel para la cuadrícula 3×3', 'mr-modos'],
  ['R23: el título de la pestaña de modos', "const MODOS_TITULO='Modos'"],
  ['R23: el aviso de migración de claves (una vez)', '/ratacode/migracion'],
  ['R21: el paquete de español va en el index, antes del módulo de la piel', 'window.__RATACODE_ES'],
  ['R21: y trae los textos de verdad (la portada, en español)', '"Describe lo que quieres construir'],
  ['R21: el tema activo se apunta en el documento', 'data-ratacode-tema'],
];

// ── C · la piel contra el frontend instalado ────────────────────────────────
/** Todos los ficheros de texto del frontend de DSH instalado. */
function ficherosDelFrontend() {
  const require = createRequire(import.meta.url);
  const raices = new Set();
  try {
    raices.add(dirname(require.resolve('@deepseek-ai/dsh/package.json')));
  } catch { /* sin motor instalado: se dirá abajo */ }
  try {
    raices.add(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')));
  } catch { /* el frontend puede colgar del motor */ }

  const ficheros = [];
  const visitar = (dir, profundidad) => {
    if (profundidad > 12) return;
    let entradas;
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entrada of entradas) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        visitar(ruta, profundidad + 1);
        continue;
      }
      // Los bundles de cliente son lo que el navegador recibe: sí entran. No
      // todos se llaman `dsh-client-*` (`dsh-session-log-export` también monta
      // superficie de navegador), así que el criterio es el fichero, no el nombre.
      const esCliente = /[/\\]lib[/\\]client\.js$/.test(ruta);
      const esFrontend = /[/\\]dsh-web-frontend[/\\]dist[/\\].*\.(css|js|html)$/.test(ruta);
      if (esCliente || esFrontend) ficheros.push(ruta);
    }
  };
  for (const raiz of raices) {
    const abuelo = dirname(raiz);
    visitar(abuelo, 0);
  }
  return [...new Set(ficheros)];
}

/** Los selectores `[class*='...']` de la piel, tal y como están escritos. */
function selectoresDeLaPiel() {
  const css = readFileSync(PIEL_CSS, 'utf8');
  return [...new Set([...css.matchAll(/\[class\*='([^']+)'\]/g)].map((m) => m[1]))];
}

// ── el recorrido ────────────────────────────────────────────────────────────
async function main() {
  const args = leerArgumentos(process.argv.slice(2));
  let hijo = null;
  let codigo = 0;
  try {
    di('RATACODE · prueba de la piel');
    di('  puerto ' + args.puerto + ' · casa ' + args.casa);
    di('  taller ' + args.taller);

    // ── E1 · R34 · LA FUNCIÓN PURA DEL BOTÓN «AUTORIZAR ESTA CARPETA» ──────
    // `ponerWorkspaceEnTexto(texto, ruta)` es la que mete la carpeta en el TEXTO
    // del `settings.yaml` de la casa. Se prueba aquí, sin servidor de por medio:
    // los tres casos del fichero (con `mcp:` y `workspaces:`, con `mcp:` sin
    // `workspaces:`, y sin `mcp:`), que NADA se pierde, y lo que NO se escribe.
    const CARPETA_1 = join(args.temp, 'carpeta-uno');
    const CARPETA_2 = join(args.temp, 'carpeta-dos');
    const leerYaml = (texto, quien) => {
      try { return yaml.load(texto); }
      catch (e) { comprobar(false, 'el texto que sale del botón no se puede releer como YAML (' + quien + '): ' + e.message); return null; }
    };
    di('  E1 · R34 · la función pura que mete la carpeta en el TEXTO del settings.yaml');

    // E1a · hay `mcp:` con `workspaces:` → la carpeta va al final de SU lista.
    const textoA = [
      '# la casa de Patxi: estos comentarios NO se pierden',
      'agent-default-model:',
      '  provider: b-ai',
      'mcp:',
      '  puerto: 3778',
      '  workspaces:',
      "    - '" + CARPETA_1 + "'",
      '  permitir_peligroso: false',
      '',
      'locale:',
      '  preference: es',
      '',
    ].join('\n');
    const nuevoA = ponerWorkspaceEnTexto(textoA, CARPETA_2);
    const leidoA = leerYaml(nuevoA, 'mcp con workspaces');
    const wsA = Array.isArray(leidoA?.mcp?.workspaces) ? leidoA.mcp.workspaces : [];
    comprobar(nuevoA !== textoA, 'con `mcp.workspaces` puesto, el botón tiene que cambiar el texto');
    comprobar(wsA.length === 2 && wsA[0] === CARPETA_1 && wsA[1] === CARPETA_2,
      'con `mcp.workspaces` puesto, la carpeta tiene que quedar AL FINAL de la lista: ' + JSON.stringify(wsA));
    comprobar(nuevoA.includes('# la casa de Patxi') && leidoA?.mcp?.puerto === 3778
      && leidoA?.mcp?.permitir_peligroso === false && leidoA?.['agent-default-model']?.provider === 'b-ai'
      && leidoA?.locale?.preference === 'es',
      'el botón no puede llevarse por delante comentarios ni las demás claves del fichero');
    di('      ' + (wsA.length === 2 ? 'OK   ' : 'MAL  ') + '  mcp con workspaces → ' + wsA.length + ' carpetas, sin perder nada');

    // E1b · hay `mcp:` SIN `workspaces:` → el bloque se añade dentro del `mcp:`.
    const textoB = ['# casa', 'mcp:', '  puerto: 3778', '', 'locale:', '  preference: es', ''].join('\n');
    const nuevoB = ponerWorkspaceEnTexto(textoB, CARPETA_2);
    const leidoB = leerYaml(nuevoB, 'mcp sin workspaces');
    const wsB = Array.isArray(leidoB?.mcp?.workspaces) ? leidoB.mcp.workspaces : [];
    comprobar(wsB.length === 1 && wsB[0] === CARPETA_2, 'con `mcp:` sin `workspaces:`, la carpeta tiene que entrar dentro: ' + JSON.stringify(wsB));
    comprobar(leidoB?.mcp?.puerto === 3778 && leidoB?.locale?.preference === 'es' && nuevoB.includes('# casa'),
      'al añadir `workspaces` dentro del `mcp:` no se puede perder lo que ya había');
    di('      ' + (wsB.length === 1 ? 'OK   ' : 'MAL  ') + '  mcp sin workspaces → lo añade dentro');

    // E1c · NO hay `mcp:` → se añade el bloque entero al final.
    const textoC = ['# sin mcp', 'agent-default-model:', '  provider: b-ai', ''].join('\n');
    const nuevoC = ponerWorkspaceEnTexto(textoC, CARPETA_2);
    const leidoC = leerYaml(nuevoC, 'sin mcp');
    const wsC = Array.isArray(leidoC?.mcp?.workspaces) ? leidoC.mcp.workspaces : [];
    comprobar(wsC.length === 1 && wsC[0] === CARPETA_2 && leidoC?.['agent-default-model']?.provider === 'b-ai',
      'sin `mcp:`, el botón tiene que añadir el bloque al final y no tocar lo de arriba: ' + JSON.stringify(wsC));
    di('      ' + (wsC.length === 1 ? 'OK   ' : 'MAL  ') + '  sin mcp → bloque nuevo al final');

    // E1d · y lo que NO se toca: un `mcp:` en una línea no se escribe a ciegas.
    let lanzoD = false;
    try { ponerWorkspaceEnTexto('mcp: {puerto: 3778}\n', CARPETA_2); } catch { lanzoD = true; }
    comprobar(lanzoD, 'un `mcp:` escrito en una línea tiene que hacer que el botón se niegue, no adivinar');
    // E1e · los finales de línea del fichero se respetan (CRLF se queda CRLF).
    const nuevoE = ponerWorkspaceEnTexto('mcp:\r\n  puerto: 3778\r\n', CARPETA_2);
    comprobar(nuevoE.includes('\r\n') && !/[^\r]\n/.test(nuevoE),
      'el botón tiene que respetar los finales de línea del fichero (CRLF)');

    // Comentarios de cualquier sangría no cortan ni anidan el bloque.
    const textoComentarios = "mcp:\n    # nota con otra sangría\n  puerto: 3778\n# carpetas\n  workspaces:\n    - '" + CARPETA_1 + "'\n# sigue mcp\n  permitir_peligroso: false\nlocale:\n  preference: es\n";
    const conComentarios = leerYaml(ponerWorkspaceEnTexto(textoComentarios, CARPETA_2), 'comentarios dentro de mcp');
    comprobar(conComentarios?.mcp?.workspaces?.length === 2 && conComentarios?.mcp?.permitir_peligroso === false
      && conComentarios?.locale?.preference === 'es', 'los comentarios sin sangría no pueden cortar mcp ni duplicar workspaces');
    const textoAnidado = "mcp:\n  precios:\n    workspaces:\n      - 'dato-anidado'\n  workspaces:\n    - '" + CARPETA_1 + "'\n";
    const conAnidado = leerYaml(ponerWorkspaceEnTexto(textoAnidado, CARPETA_2), 'workspaces anidado');
    comprobar(conAnidado?.mcp?.workspaces?.length === 2 && conAnidado?.mcp?.precios?.workspaces?.[0] === 'dato-anidado',
      'solo se amplía el workspaces directo de mcp, sin tocar el anidado');
    const sinDirecto = leerYaml(ponerWorkspaceEnTexto("mcp:\n  precios:\n    workspaces:\n      - 'dato-anidado'\n", CARPETA_2), 'solo workspaces anidado');
    comprobar(sinDirecto?.mcp?.workspaces?.[0] === CARPETA_2 && sinDirecto?.mcp?.precios?.workspaces?.[0] === 'dato-anidado',
      'si solo hay workspaces anidado, se crea el directo al nivel correcto');
    const conComillas = leerYaml(ponerWorkspaceEnTexto('mcp:\n  puerto: 3778\n', CARPETA_2 + " # O'Brien"), 'ruta con comillas y numeral');
    comprobar(conComillas?.mcp?.workspaces?.[0] === CARPETA_2 + " # O'Brien", 'se conservan comillas y # dentro de una ruta YAML');

    await probarOrdenModelos();

    // A · arrancar
    const arranque = arrancar(args);
    hijo = arranque.hijo;
    const eco = (texto) => {
      for (const linea of String(texto).split(/\r?\n/)) {
        if (linea.trim() !== '') process.stdout.write('  [ratacode] ' + linea + '\n');
      }
    };
    hijo.stdout.setEncoding('utf8');
    hijo.stdout.on('data', eco);
    hijo.stderr.setEncoding('utf8');
    hijo.stderr.on('data', eco);
    const url = await arranque.espera;
    di('  A · RATACODE arrancó y dio URL: ' + url);

    // B · el index
    const { estado, html, galletas, destino } = await pedirIndex(url);
    di('  B · GET ' + url + ' → ' + estado + ' · ' + Buffer.byteLength(html, 'utf8') + ' bytes');
    comprobar(estado === 200, 'el index no contestó 200, sino ' + estado);
    for (const [nombre, marca] of MARCAS_DEL_INDEX) {
      const esta = html.includes(marca);
      comprobar(esta, 'falta en el index: ' + nombre + ' («' + marca + '»)');
      di('      ' + (esta ? 'OK   ' : 'FALTA') + '  ' + nombre);
    }
    // El título de la pestaña: nunca «DeepSeek Harness».
    const titulo = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) ?? [null, '(sin <title>)'])[1].trim();
    const tituloOk = titulo === 'RATACODE' && !/DeepSeek Harness/i.test(html.slice(0, 2000));
    comprobar(tituloOk, 'el <title> del index es «' + titulo + '» (tiene que ser RATACODE, y el frontend no debe '
      + 'traer «DeepSeek Harness» antes de la piel)');
    di('      ' + (tituloOk ? 'OK   ' : 'MAL  ') + '  el <title> es «' + titulo + '»');
    const guionOk = html.includes("replace(/DeepSeek Harness/gi,'RATACODE')");
    comprobar(guionOk, 'el guion de la piel no lleva el interceptor de document.title');
    di('      ' + (guionOk ? 'OK   ' : 'MAL  ') + '  el guion intercepta document.title');
    // El panel se puede instalar como app (Chrome › Instalar): manifest propio sin nada del
    // motor, y los dos iconos PNG del emblema.
    const manifiestoOk = html.includes('href="/ratacode/manifest.webmanifest"');
    comprobar(manifiestoOk, 'el index no enlaza el manifest propio de RATACODE');
    di('      ' + (manifiestoOk ? 'OK   ' : 'MAL  ') + '  el index enlaza el manifest propio');
    for (const ruta of ['/ratacode/manifest.webmanifest', '/ratacode/icono-192.png', '/ratacode/icono-512.png']) {
      const r = await fetch(new URL(ruta, url));
      const cuerpo = Buffer.from(await r.arrayBuffer());
      const texto = cuerpo.toString('utf8');
      const bueno = r.status === 200 && (ruta.endsWith('.png')
        ? cuerpo.subarray(1, 4).toString('latin1') === 'PNG'
        : /"name":"RATACODE"/.test(texto) && !/DeepSeek|DSH/i.test(texto));
      comprobar(bueno, ruta + ' no sirve lo esperado (estado ' + r.status + ')');
      di('      ' + (bueno ? 'OK   ' : 'MAL  ') + '  ' + ruta + ' → ' + r.status);
    }

    // B2 · el texto de la conexión (Ajustes > Conexiones), por su ruta protegida
    const cabeceraGalleta = [...galletas.entries()].map(([n, v]) => n + '=' + v).join('; ');
    const conGalleta = { redirect: 'manual', headers: { cookie: cabeceraGalleta } };
    const apreton = await fetch(new URL('/ratacode/handshake', destino), conGalleta);
    const cuerpoApreton = await apreton.json().catch(() => ({}));
    const textoApreton = String(cuerpoApreton.texto ?? '');
    const lineasApreton = textoApreton === '' ? 0 : textoApreton.split('\n').length;
    di('  B2 · GET /ratacode/handshake → ' + apreton.status + ' · ' + Buffer.byteLength(textoApreton, 'utf8')
      + ' bytes · ' + lineasApreton + ' líneas');
    comprobar(apreton.status === 200, 'la ruta del apretón contestó ' + apreton.status);
    comprobar(cuerpoApreton.ruta === null && cuerpoApreton.ruta !== undefined,
      'GET /ratacode/handshake no debe escribir el fichero (ruta: ' + JSON.stringify(cuerpoApreton.ruta) + ')');
    comprobar(textoApreton.includes(url), 'el apretón servido no trae la URL real de esta casa');
    comprobar(lineasApreton > 0 && lineasApreton <= 40, 'el apretón servido tiene ' + lineasApreton + ' líneas (tope: 40)');
    comprobar(/¿qué porcentaje del trabajo/i.test(textoApreton), 'el apretón no manda preguntar por el porcentaje de trabajo');
    comprobar(/RATACODE corre en MI ordenador/i.test(textoApreton), 'el texto servido no es apreton/handshake.md');
    di('      ' + (textoApreton.includes(url) ? 'OK   ' : 'MAL  ') + '  el apretón trae la URL de esta casa');
    di('      ' + (lineasApreton > 0 && lineasApreton <= 40 ? 'OK   ' : 'MAL  ') + '  el apretón tiene ' + lineasApreton + ' líneas (tope 40)');
    const sinClaves = !/sk-[A-Za-z0-9]|API_KEY\s*[:=]\s*[A-Za-z0-9_-]{8}/.test(textoApreton);
    comprobar(sinClaves, 'el apretón servido parece llevar una clave dentro');
    di('      ' + (sinClaves ? 'OK   ' : 'MAL  ') + '  el apretón no lleva claves');
    // R29 · la guía del tutor viaja CON el apretón: el agente que lo recibe tiene
    // que poder abrirla, y con la ruta de ESTA instalación (ningún `<tutor>` suelto).
    const guiaTutor = join(PRODUCTO, 'apreton', 'tutor.md');
    const existeGuia = existsSync(guiaTutor);
    const lineasGuia = existeGuia ? readFileSync(guiaTutor, 'utf8').split('\n').length : 0;
    comprobar(textoApreton.includes('apreton/tutor.md'), 'el apretón servido no manda leer apreton/tutor.md');
    comprobar(!textoApreton.includes('<tutor>'), 'el apretón servido deja el marcador <tutor> sin cambiar');
    comprobar(textoApreton.includes(guiaTutor),
      'el apretón servido no trae la ruta REAL de la guía del tutor («' + guiaTutor + '»)');
    comprobar(existeGuia, 'no existe apreton/tutor.md');
    comprobar(lineasGuia > 0 && lineasGuia <= 120, 'apreton/tutor.md tiene ' + lineasGuia + ' líneas (tope: 120)');
    di('      ' + (textoApreton.includes('apreton/tutor.md') ? 'OK   ' : 'MAL  ')
      + '  el apretón manda leer apreton/tutor.md (' + lineasGuia + ' líneas)');

    // B2b · POST: además lo DEJA en <casa>\handshake.md
    const guardado = await fetch(new URL('/ratacode/handshake', destino), { ...conGalleta, method: 'POST' });
    const cuerpoGuardado = await guardado.json().catch(() => ({}));
    const rutaHandshake = join(args.casa, 'handshake.md');
    const existeHandshake = existsSync(rutaHandshake);
    const ficheroHandshake = existeHandshake ? readFileSync(rutaHandshake, 'utf8') : '';
    const lineasFichero = ficheroHandshake === '' ? 0 : ficheroHandshake.split('\n').length;
    di('  B2b · POST /ratacode/handshake → ' + guardado.status + ' · ' + (cuerpoGuardado.ruta ?? '(sin ruta)'));
    comprobar(guardado.status === 200 && cuerpoGuardado.ok === true, 'POST /ratacode/handshake contestó ' + guardado.status);
    comprobar(resolve(String(cuerpoGuardado.ruta ?? '')) === resolve(rutaHandshake),
      'el POST dejó el apretón en «' + cuerpoGuardado.ruta + '» y no en ' + rutaHandshake);
    comprobar(existeHandshake, 'no quedó <casa>\\handshake.md');
    comprobar(ficheroHandshake === String(cuerpoGuardado.texto ?? ''),
      'el handshake.md de la casa no es el mismo texto que devolvió la ruta');
    comprobar(lineasFichero > 0 && lineasFichero <= 40, 'el handshake.md de la casa tiene ' + lineasFichero + ' líneas (tope: 40)');
    di('      ' + (existeHandshake ? 'OK   ' : 'MAL  ') + '  <casa>\\handshake.md escrito (' + lineasFichero + ' líneas)');

    // B2c · R29 · sin `instalacion.txt` (instalación a medias o antigua), la ruta
    // de la guía se busca donde vive la copia del plugin: es la otra que el
    // agente puede abrir, y la que el producto deja ahí al arrancar.
    const rutaInstalacion = join(args.casa, 'profiles', 'web', 'node_modules', 'ratacode-piel', 'instalacion.txt');
    const instalacionGuardada = readFileSync(rutaInstalacion, 'utf8');
    rmSync(rutaInstalacion, { force: true });
    const sinPista = await (await fetch(new URL('/ratacode/handshake', destino), conGalleta)).json().catch(() => ({}));
    const textoSinPista = String(sinPista.texto ?? '');
    writeFileSync(rutaInstalacion, instalacionGuardada);
    const copiaDelPlugin = join(args.casa, 'profiles', 'web', 'node_modules', 'ratacode-piel', 'apreton', 'tutor.md');
    const rutaDicha = (/`([^`]*tutor\.md)`/.exec(textoSinPista.split('Está en ')[1] ?? '') ?? [null, '(sin ruta)'])[1];
    comprobar(existeGuia && textoSinPista.includes(copiaDelPlugin),
      'sin instalacion.txt el apretón no manda la guía a la copia del plugin: «' + rutaDicha + '»');
    comprobar(!textoSinPista.includes('<tutor>'), 'sin instalacion.txt queda el marcador <tutor> sin cambiar');
    di('  B2c · sin instalacion.txt → ' + (textoSinPista.includes(copiaDelPlugin) ? 'OK   ' : 'MAL  ') + '  ' + rutaDicha);

    // B3 · el MCP para chats web: estado, los dos comandos y el texto del chat
    // R25 · la casa declara su carpeta autorizada ANTES de preguntar: la tarjeta
    // de Conexiones tiene que decir ESA carpeta (la lee el plugin en cada
    // petición, así que vale escribirla aquí).
    const rutaAjustes = join(args.casa, 'settings.yaml');
    writeFileSync(rutaAjustes, readFileSync(rutaAjustes, 'utf8')
      + '\nmcp:\n  workspaces:\n    - ' + JSON.stringify(args.taller) + '\n');
    const estadoMcp = await fetch(new URL('/ratacode/mcp', destino), conGalleta);
    const cuerpoMcp = await estadoMcp.json().catch(() => ({}));
    di('  B3 · GET /ratacode/mcp → ' + estadoMcp.status + ' · http:' + (cuerpoMcp.http?.abierto === true)
      + ' · túnel:' + (cuerpoMcp.tunel?.abierto === true));
    comprobar(estadoMcp.status === 200 && cuerpoMcp.ok === true, '/ratacode/mcp contestó ' + estadoMcp.status);
    comprobar(cuerpoMcp.http?.abierto === false && cuerpoMcp.tunel?.abierto === false,
      'en una casa recién estrenada el MCP y el túnel tienen que salir CERRADOS');
    const comandos = String(cuerpoMcp.comandos ?? '');
    comprobar(comandos.includes('ratacode mcp --http'), 'los comandos no arrancan el MCP por HTTP');
    comprobar(!comandos.includes('--acepto-lectura-total'), 'R25 · los comandos ya no piden --acepto-lectura-total (la lectura va encerrada)');
    comprobar(comandos.includes('tunel.mjs'), 'los comandos no arrancan el túnel');
    comprobar(/^cd .+; /m.test(comandos) && comandos.split('\n').length === 2,
      'los dos comandos tienen que ir en un bloque pegable «cd <ruta>; comando» (2 líneas)');
    comprobar(typeof cuerpoMcp.instalacion === 'string' && resolve(cuerpoMcp.instalacion) === resolve(PRODUCTO),
      'los comandos no llevan la ruta de ESTA instalación: «' + cuerpoMcp.instalacion + '» (esperaba ' + PRODUCTO + ')');
    // R25 · la carpeta autorizada, que es lo que el panel enseña en la tarjeta.
    comprobar(Array.isArray(cuerpoMcp.carpetas) && cuerpoMcp.carpetas.length === 1,
      'el estado del MCP no trae las carpetas autorizadas de la casa: ' + JSON.stringify(cuerpoMcp.carpetas));
    comprobar(typeof cuerpoMcp.carpeta === 'string' && resolve(cuerpoMcp.carpeta) === resolve(args.taller),
      'el estado del MCP no dice la carpeta autorizada de la casa: «' + cuerpoMcp.carpeta + '» (esperaba ' + args.taller + ')');
    const pegar = String(cuerpoMcp.pegar ?? '');
    comprobar(pegar.includes('list_models') && pegar.includes('run_task') && pegar.includes('esperar_segundos'),
      'el texto para pegar en el chat no cuenta las herramientas ni esperar_segundos');
    comprobar(/AVISO/.test(pegar) && /ENCERRADA|encerrada/.test(pegar), 'el texto para pegar no lleva el aviso nuevo (la tarea va encerrada)');
    di('      ' + (pegar.includes('esperar_segundos') ? 'OK   ' : 'MAL  ') + '  el texto del chat cuenta herramientas y esperar_segundos');
    di('      ' + (comandos.split('\n').length === 2 ? 'OK   ' : 'MAL  ') + '  los dos comandos van en un bloque pegable');

    // B4 · el plugin de CLIENTE (la sección «Conexiones» de Ajustes) se sirve
    const urlBundle = /\/plugins\/\?\?ratacode-piel\/client\.js&rev=([\w-]+)/.exec(html);
    comprobar(urlBundle !== null, 'el index no trae el plugin de cliente ratacode-piel en el grafo de arranque');
    if (urlBundle !== null) {
      const respuestaBundle = await fetch(new URL('/plugins/??ratacode-piel/client.js&rev=' + urlBundle[1], destino), conGalleta);
      const textoBundle = await respuestaBundle.text();
      di('  B4 · GET el bundle del plugin → ' + respuestaBundle.status + ' · ' + Buffer.byteLength(textoBundle, 'utf8') + ' bytes');
      comprobar(respuestaBundle.status === 200, 'el bundle del plugin contestó ' + respuestaBundle.status);
      comprobar(textoBundle.includes('settings.section'), 'el bundle no registra la sección por el slot settings.section');
      comprobar(textoBundle.includes("id: 'conexiones'"), 'el bundle no registra la sección «conexiones»');
      comprobar(textoBundle.includes('Conexiones'), 'el bundle no lleva el rótulo «Conexiones»');
      // R25 · la línea del espacio, en los TRES idiomas (el texto lo pone el
      // servicio de idiomas del motor, no la piel).
      comprobar(textoBundle.includes('conexion.espacio')
        && textoBundle.includes('Este chat solo puede leer y escribir en {carpeta}.')
        && textoBundle.includes('This chat can only read and write in {carpeta}.')
        && textoBundle.includes('此对话只能在 {carpeta} 中读写。'),
        'el bundle no trae la línea «Este chat solo puede leer y escribir en <carpeta>» en los tres idiomas');
      comprobar(textoBundle.includes('Claude Code, Codex, OpenClaw') && textoBundle.includes('ChatGPT y Claude web'),
        'el bundle no trae las dos tarjetas de Conexiones');
      comprobar(!/apretón de manos|Handshakes/.test(textoBundle),
        'el bundle sigue hablando de «apretón de manos» o de «Handshakes»');
      // R18 · la pestaña nueva, por la MISMA vía oficial (settings.section)
      comprobar(textoBundle.includes("id: 'modelos-locales'"), 'el bundle no registra la sección «modelos-locales»');
      comprobar(textoBundle.includes('Modelos locales'), 'el bundle no lleva el rótulo «Modelos locales»');
      comprobar(textoBundle.includes('/ratacode/runtimes'), 'la sección nueva no pregunta por los runtimes locales');
      // R23 · el botón que no logra encenderlo deja el COMANDO a mano (la otra
      // vía del encargo: «si no se puede lanzar, botón Copiar comando»).
      comprobar(textoBundle.includes("etiqueta: 'Copiar comando'"),
        'el bundle no deja el botón «Copiar comando» cuando no puede encender el runtime');
      comprobar(textoBundle.includes('A mano'),
        'el bundle no trae el comando plegado («A mano») de la tarjeta de Conexiones');
      // R34 · el botón «Autorizar esta carpeta» de la cabecera del chat, con su
      // confirmación en español: el bundle es lo que recibe el navegador.
      comprobar(textoBundle.includes('Autorizar esta carpeta') && textoBundle.includes('ChatGPT podrá leer y escribir en ella'),
        'el bundle de cliente no trae el botón «Autorizar esta carpeta» ni su confirmación');
      comprobar(textoBundle.includes('/ratacode/sesiones/autorizar'),
        'el bundle de cliente no llama a la ruta de autorizar la carpeta');
      // R21 · el idioma español y los tres temas, por las vías OFICIALES.
      comprobar(textoBundle.includes('addLanguage'), 'el bundle no declara el idioma por la vía oficial (ctx.locale.addLanguage)');
      comprobar(textoBundle.includes("ctx.locale.register(ns, IDIOMA, dict)"),
        'el bundle no registra los diccionarios por la vía oficial (ctx.locale.register)');
      comprobar(textoBundle.includes('ratacode-yellow') && textoBundle.includes("id: 'minimal'"),
        'el bundle no registra los TRES temas (ratacode-pink, ratacode-yellow, minimal)');
      comprobar(textoBundle.includes('ctx.theme.register'), 'el bundle no registra los temas por la vía oficial (ctx.theme.register)');
      comprobar(textoBundle.includes("const inject = ['slots', 'locale', 'theme']"),
        'el bundle no pide los servicios locale/theme además de slots');
      comprobar(textoBundle.includes("'/ratacode/tema'"),
        'el bundle no pregunta a la casa por el aspecto recordado (/ratacode/tema)');
      comprobar(textoBundle.includes("id: 'ratacode-pink'") && textoBundle.includes('MULTICOLOR'),
        'el bundle no trae el estilo MULTICOLOR (el primero de la lista)');
      // R24 · los TRES avisos de una línea, en los tres idiomas, por la vía oficial.
      comprobar(textoBundle.includes("const AVISOS_NS = 'ratacode-avisos'"),
        'el bundle no declara el espacio de nombres de los avisos (ratacode-avisos)');
      comprobar(/AVISOS = \{[^]*?es: \{[^]*?en: \{[^]*?zh: \{/.test(textoBundle),
        'los avisos no están en los TRES idiomas (es, en, zh)');
      comprobar(textoBundle.includes("ctx.locale.register(AVISOS_NS, AVISOS)"),
        'los avisos no van por la vía oficial de idiomas (ctx.locale.register)');
      comprobar(textoBundle.includes('El agente actúa sin pedirte permiso. Úsalo solo en carpetas tuyas.'),
        'el bundle no trae el aviso de «A rienda suelta» (Ajustes › General y la caja)');
      comprobar(textoBundle.includes('Lo que envías va al proveedor que elijas y se rige por sus condiciones.'),
        'el bundle no trae el aviso de Ajustes › Modelos');
      comprobar(textoBundle.includes("permiso('preset.fullAccess')") && textoBundle.includes("conversacion('access.preset.fullAccess')"),
        'el aviso del permiso no se cuelga del rótulo del motor (así sale en los tres idiomas)');
      const dondeSePintan = ['mr-aviso-permiso', 'mr-aviso-modelos', 'mr-aviso-caja'].filter((c) => textoBundle.includes(c));
      comprobar(dondeSePintan.length === 3,
        'el bundle no pinta los tres avisos en sus tres sitios: ' + JSON.stringify(dondeSePintan));
      di('      ' + (textoBundle.includes('addLanguage') ? 'OK   ' : 'MAL  ') + '  el español va por la vía oficial de idiomas');
      di('      ' + (textoBundle.includes('ctx.theme.register') ? 'OK   ' : 'MAL  ') + '  los tres temas van por la vía oficial de temas');
      di('      ' + (textoBundle.includes('settings.section') ? 'OK   ' : 'MAL  ') + '  la sección se registra por el slot oficial');
    }

    // B6 · R17: ¿le falta la clave al modelo por defecto? La casa de esta prueba
    // se estrena SIN claves en su entorno, así que la respuesta es que sí: el
    // aviso en español y el botón a Ajustes › Models tienen que salir.
    const estadoClave = await fetch(new URL('/ratacode/clave', destino), conGalleta);
    const cuerpoClave = await estadoClave.json().catch(() => ({}));
    di('  B6 · GET /ratacode/clave → ' + estadoClave.status + ' · ' + JSON.stringify({
      falta: cuerpoClave.falta,
      proveedor: cuerpoClave.proveedor,
      nombre: cuerpoClave.nombre,
      variable: cuerpoClave.variable,
      tieneClave: cuerpoClave.tieneClave,
    }));
    comprobar(estadoClave.status === 200 && cuerpoClave.ok === true, '/ratacode/clave contestó ' + estadoClave.status);
    comprobar(cuerpoClave.falta === true, 'sin claves en el entorno, el modelo por defecto tiene que salir «falta la clave»');
    comprobar(cuerpoClave.proveedor === 'b-ai' && cuerpoClave.nombre === 'B.AI',
      'el modelo por defecto sin claves es el de fábrica (B.AI): salió ' + JSON.stringify(cuerpoClave.proveedor));
    comprobar(cuerpoClave.variable === 'B_AI_API_KEY' && cuerpoClave.tieneClave === false,
      'la credencial que falta tiene que ser B_AI_API_KEY, y no estar puesta');
    comprobar(cuerpoClave.necesitaClave === true, 'una ruta que nombra credencial necesita clave');
    comprobar(cuerpoClave.local === null, 'R18: B.AI NO es un runtime local, así que `local` tiene que ir a null');
    comprobar(cuerpoClave.proveedores?.['b-ai'] === 'B.AI' && cuerpoClave.proveedores?.ollama === 'Ollama (local, sin clave)',
      'la ruta devuelve el nombre visible de cada proveedor (para el aviso y para el error)');
    const clavesEnLaRespuesta = JSON.stringify(cuerpoClave);
    comprobar(!/"valor"|sk-[A-Za-z0-9]{8}/.test(clavesEnLaRespuesta),
      '/ratacode/clave NUNCA devuelve el valor de una clave, sólo si está puesta');

    // B8 · R18: los DOS runtimes locales, con su dirección y su tabla de tarjetas.
    // El sondeo es corto (1,5 s por runtime, en paralelo) y NUNCA bloquea: si el
    // runtime no está encendido, lo dice y sigue.
    const relojRuntimes = Date.now();
    const estadoRuntimes = await fetch(new URL('/ratacode/runtimes', destino), conGalleta);
    const cuerpoRuntimes = await estadoRuntimes.json().catch(() => ({}));
    const tardo = Date.now() - relojRuntimes;
    const runtimes = Array.isArray(cuerpoRuntimes.runtimes) ? cuerpoRuntimes.runtimes : [];
    di('  B8 · GET /ratacode/runtimes → ' + estadoRuntimes.status + ' en ' + tardo + ' ms · '
      + runtimes.map((r) => r.id + ':' + (r.encendido ? 'encendido(' + r.modelos.length + ' modelos)' : 'apagado')).join(' · '));
    comprobar(estadoRuntimes.status === 200 && cuerpoRuntimes.ok === true, '/ratacode/runtimes contestó ' + estadoRuntimes.status);
    comprobar(tardo < 8000, 'el sondeo de los runtimes tardó ' + tardo + ' ms: tiene que ser corto (la página no se bloquea)');
    comprobar(runtimes.length === 2 && runtimes[0].id === 'ollama' && runtimes[1].id === 'lmstudio',
      'los dos runtimes locales tienen que salir (ollama y lmstudio): salió ' + JSON.stringify(runtimes.map((r) => r.id)));
    const porId = Object.fromEntries(runtimes.map((r) => [r.id, r]));
    comprobar(porId.ollama?.baseURL === 'http://127.0.0.1:11434/v1' && porId.lmstudio?.baseURL === 'http://127.0.0.1:1234/v1',
      'cada runtime tiene que traer su baseURL de fábrica: ' + JSON.stringify([porId.ollama?.baseURL, porId.lmstudio?.baseURL]));
    comprobar(porId.ollama?.arranque === 'ollama serve' && porId.lmstudio?.arranque === 'lms server start',
      'cada runtime tiene que traer su arranque en UNA línea pegable');
    comprobar(String(porId.ollama?.enlace ?? '').includes('ollama.com/download')
      && String(porId.lmstudio?.enlace ?? '').includes('lmstudio.ai'),
      'cada runtime tiene que traer su enlace de descarga');
    comprobar(typeof porId.ollama?.encendido === 'boolean' && Array.isArray(porId.ollama?.modelos),
      'el estado de encendido y la lista de modelos tienen que venir siempre (aunque esté apagado)');
    comprobar(/settings\.yaml/.test(String(porId.ollama?.cambiar ?? '')) && /baseURL/.test(String(porId.ollama?.cambiar ?? '')),
      'la ruta tiene que decir CÓMO se cambia la dirección (settings.yaml → baseURL)');
    const tarjetas = Array.isArray(cuerpoRuntimes.tarjetas) ? cuerpoRuntimes.tarjetas : [];
    comprobar(tarjetas.map((t) => t.tarjeta).join('|') === '8 GB|12 GB|16 GB|24 GB|Solo CPU',
      'la recomendación por tarjeta tiene que ser la del README: ' + JSON.stringify(tarjetas.map((t) => t.tarjeta)));
    comprobar(tarjetas[0]?.modelo === 'qwen3:8b' && tarjetas[3]?.modelo === 'muse-glimmer:30b',
      'los modelos por tarjeta tienen que ser los del README (qwen3:8b … muse-glimmer:30b)');
    if (porId.ollama?.encendido === true && porId.ollama.modelos.length > 0) {
      const conClase = porId.ollama.modelos.every((m) => ['agente', 'no', 'sin-datos'].includes(m.clase));
      comprobar(conClase, 'cada modelo del runtime tiene que venir clasificado (vale como agente sí/no/sin datos)');
    }

    // B9 · R23: cuando el botón «Encender» no logra encender el runtime, la ruta
    // no lo da por bueno: lo dice y deja la tarjeta con el comando a mano.
    const fuenteDeLaPiel = readFileSync(join(PRODUCTO, 'piel', 'lib', 'index.js'), 'utf8');
    comprobar(fuenteDeLaPiel.includes('no llegó a encenderse'),
      'la ruta de los botones tiene que decir cuándo un runtime no llegó a encenderse');

    // B10 · R21: el ASPECTO que la casa recuerda. La casa se estrena sin
    // `tema.txt`… pero `bin/ratacode.js` lo deja apuntado al arrancar, así que
    // aquí sale el de fábrica; se cambia a otro de los tres y se comprueba que
    // queda escrito; y un tema que no existe NO se acepta (y no rompe nada).
    const estadoTema = await fetch(new URL('/ratacode/tema', destino), conGalleta);
    const cuerpoTema = await estadoTema.json().catch(() => ({}));
    di('  B10 · GET /ratacode/tema → ' + estadoTema.status + ' · tema:' + cuerpoTema.tema
      + ' · temas:' + JSON.stringify(cuerpoTema.temas));
    comprobar(estadoTema.status === 200 && cuerpoTema.ok === true, '/ratacode/tema contestó ' + estadoTema.status);
    const TEMAS = ['ratacode-pink', 'ratacode-yellow', 'minimal'];
    comprobar(JSON.stringify(cuerpoTema.temas) === JSON.stringify(TEMAS),
      'los tres temas, en su orden: ' + JSON.stringify(cuerpoTema.temas));
    comprobar(TEMAS.includes(cuerpoTema.tema), 'el tema de la casa es uno de los tres: ' + cuerpoTema.tema);
    const maloTema = await fetch(new URL('/ratacode/tema', destino), {
      ...conGalleta, method: 'POST', headers: { cookie: cabeceraGalleta, 'content-type': 'application/json' },
      body: JSON.stringify({ tema: 'light' }),
    });
    comprobar(maloTema.status === 400, 'un tema que no es de la casa se rechaza (' + maloTema.status + ')');
    const buenTema = await fetch(new URL('/ratacode/tema', destino), {
      ...conGalleta, method: 'POST', headers: { cookie: cabeceraGalleta, 'content-type': 'application/json' },
      body: JSON.stringify({ tema: 'minimal' }),
    });
    const cuerpoBuenTema = await buenTema.json().catch(() => ({}));
    comprobar(buenTema.status === 200 && cuerpoBuenTema.tema === 'minimal', 'elegir MINIMAL se acepta (' + buenTema.status + ')');
    const ficheroTema = join(args.casa, 'tema.txt');
    comprobar(existsSync(ficheroTema) && readFileSync(ficheroTema, 'utf8').trim() === 'minimal',
      'la casa apunta el aspecto elegido en tema.txt');
    di('      ' + (existsSync(ficheroTema) ? 'OK   ' : 'MAL  ') + '  <casa>\\tema.txt = '
      + (existsSync(ficheroTema) ? readFileSync(ficheroTema, 'utf8').trim() : '(no está)'));

    // B7 · sin cookie, ni el apretón ni el MCP ni la clave ni los runtimes ni el
    // aspecto: el cerco del motor
    for (const ruta of ['/ratacode/handshake', '/ratacode/mcp', '/ratacode/clave', '/ratacode/runtimes', '/ratacode/tema']) {
      const sinGalleta = await fetch(new URL(ruta, destino), { redirect: 'manual' });
      comprobar(sinGalleta.status === 401, ruta + ' sin cookie contestó ' + sinGalleta.status + ' (debía ser 401)');
      di('      ' + (sinGalleta.status === 401 ? 'OK   ' : 'MAL  ') + '  ' + ruta + ' sin cookie contesta 401');
    }

    // ── E2/E3 · R34 · EL BOTÓN «AUTORIZAR ESTA CARPETA», POR HTTP ──────────
    // Se prueba contra la casa de ESTA prueba (que es temporal, en
    // `trabajo\puente-temp`): ningún `settings.yaml` de verdad se toca.
    const cabeceraNavegador = { cookie: cabeceraGalleta, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
    const pedirAutorizar = (cuerpo, cabeceras) => fetch(new URL('/ratacode/sesiones/autorizar', destino), {
      redirect: 'manual', method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo),
    });
    const rutaAjustesCasa = join(args.casa, 'settings.yaml');
    const antesDeAutorizar = readFileSync(rutaAjustesCasa, 'utf8');
    const sinSaltos = (t) => t.split(/\r?\n/).join('\n').trim();

    // E2a · cerco CSRF: ausencia y origen ajeno se rechazan. Esta cabecera no
    // identifica a un humano: este propio banco Node puede enviarla.
    const sinNavegador = await pedirAutorizar({ ruta: args.taller }, { cookie: cabeceraGalleta, 'content-type': 'application/json' });
    const cuerpoSinNavegador = await sinNavegador.json().catch(() => ({}));
    comprobar(sinNavegador.status === 403 && cuerpoSinNavegador.error === 'NO_ES_EL_NAVEGADOR',
      'sin `Sec-Fetch-Site: same-origin` el botón tiene que contestar 403 NO_ES_EL_NAVEGADOR (contestó '
      + sinNavegador.status + ' ' + JSON.stringify(cuerpoSinNavegador.error) + ')');
    di('  E2 · R34 · POST /ratacode/sesiones/autorizar → ' + sinNavegador.status
      + ' sin la cabecera del navegador (' + (cuerpoSinNavegador.error ?? '-') + ')');
    for (const sitio of ['cross-site', 'same-site']) {
      const ajena = await pedirAutorizar({ ruta: args.taller }, { ...cabeceraNavegador, 'sec-fetch-site': sitio });
      comprobar(ajena.status === 403, 'Sec-Fetch-Site ' + sitio + ' debe rechazarse');
    }

    // E2b · sin cookie manda el cerco de siempre (401), antes que nada.
    const sinCookieAutorizar = await pedirAutorizar({ ruta: args.taller }, { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' });
    comprobar(sinCookieAutorizar.status === 401,
      '/ratacode/sesiones/autorizar sin cookie tiene que contestar 401 (contestó ' + sinCookieAutorizar.status + ')');

    // E2c · las rutas que NO se pueden autorizar, y una que ya lo está.
    const casosQueSeNiegan = [
      [homedir(), 'DEMASIADO_ANCHO', 'la carpeta de usuario'],
      [resolve(homedir(), '..'), 'DEMASIADO_ANCHO', 'el padre de la carpeta de usuario'],
      [process.platform === 'win32' ? 'C:\\' : '/', 'DEMASIADO_ANCHO', 'la raíz del disco'],
      [join(args.temp, 'no-existe-' + process.pid), 'ESA_CARPETA_NO_EXISTE', 'una carpeta que no existe'],
      [join(PRODUCTO, 'package.json'), 'NO_ES_UNA_CARPETA', 'un fichero'],
    ];
    for (const [ruta, esperado, quien] of casosQueSeNiegan) {
      const respuesta = await pedirAutorizar({ ruta }, cabeceraNavegador);
      const cuerpo = await respuesta.json().catch(() => ({}));
      const bien = respuesta.status === 400 && cuerpo.error === esperado;
      comprobar(bien, 'autorizar ' + quien + ' tiene que negarse con 400 ' + esperado
        + ' (contestó ' + respuesta.status + ' ' + JSON.stringify(cuerpo.error ?? cuerpo.motivo) + ')');
      di('      ' + (bien ? 'OK   ' : 'MAL  ') + '  se niega con ' + quien + ' → ' + respuesta.status + ' ' + (cuerpo.error ?? '-'));
    }
    // Ya autorizada: lo DICE y no añade nada (el taller lo dejó autorizado B3).
    const yaAutorizada = await pedirAutorizar({ ruta: args.taller }, cabeceraNavegador);
    const cuerpoYa = await yaAutorizada.json().catch(() => ({}));
    comprobar(yaAutorizada.status === 200 && cuerpoYa.ya_autorizada === true
      && String(cuerpoYa.motivo ?? '').includes('ya está autorizada'),
      'una carpeta ya autorizada tiene que decirse, no añadirse otra vez: '
      + yaAutorizada.status + ' ' + JSON.stringify(cuerpoYa.motivo ?? cuerpoYa.error));
    di('      ' + (cuerpoYa.ya_autorizada === true ? 'OK   ' : 'MAL  ') + '  la que ya está autorizada se dice, no se añade');
    comprobar(readFileSync(rutaAjustesCasa, 'utf8') === antesDeAutorizar,
      'ninguno de los casos que se niegan (ni la ya autorizada) puede escribir el settings.yaml');

    // E3 · el dos pasos entero, con escritura de verdad: paso 1 mira (y NO
    // escribe), paso 2 escribe con el nonce, y el nonce se gasta al usarlo.
    const carpetaNueva = join(args.temp, 'para-autorizar');
    rmSync(carpetaNueva, { recursive: true, force: true });
    mkdirSync(carpetaNueva, { recursive: true });
    const paso1 = await pedirAutorizar({ ruta: carpetaNueva }, cabeceraNavegador);
    const cuerpo1 = await paso1.json().catch(() => ({}));
    comprobar(paso1.status === 200 && cuerpo1.ok === true && cuerpo1.ya_autorizada === false
      && typeof cuerpo1.nonce === 'string' && cuerpo1.nonce.length >= 16,
      'el paso 1 tiene que contestar la ruta y el nonce, sin escribir: ' + paso1.status + ' ' + JSON.stringify(cuerpo1));
    comprobar(resolve(String(cuerpo1.ruta ?? '')) === resolve(carpetaNueva),
      'el paso 1 tiene que devolver la ruta CANÓNICA: «' + cuerpo1.ruta + '» (esperaba ' + carpetaNueva + ')');
    comprobar(String(cuerpo1.pregunta ?? '') === '¿Autorizar ' + carpetaNueva + '? ChatGPT podrá leer y escribir en ella',
      'la pregunta del paso 1 no es la de la casa: «' + cuerpo1.pregunta + '»');
    comprobar(readFileSync(rutaAjustesCasa, 'utf8') === antesDeAutorizar, 'el paso 1 NO puede escribir el settings.yaml');
    di('  E3 · R34 · paso 1 → ' + paso1.status + ' · nonce de ' + String(cuerpo1.nonce ?? '').length
      + ' caracteres · sin escribir');

    const paso2 = await pedirAutorizar({ confirmar: true, nonce: cuerpo1.nonce }, cabeceraNavegador);
    const cuerpo2 = await paso2.json().catch(() => ({}));
    comprobar(paso2.status === 200 && cuerpo2.ok === true && cuerpo2.autorizada === true,
      'el paso 2 con el nonce tiene que escribir: ' + paso2.status + ' ' + JSON.stringify(cuerpo2));
    const despuesDeAutorizar = readFileSync(rutaAjustesCasa, 'utf8');
    const leidoCasa = yaml.load(despuesDeAutorizar) ?? {};
    const carpetasCasa = Array.isArray(leidoCasa?.mcp?.workspaces) ? leidoCasa.mcp.workspaces.map((r) => String(r)) : [];
    comprobar(carpetasCasa.length === 2 && carpetasCasa.some((r) => resolve(r) === resolve(carpetaNueva)),
      'la carpeta nueva tiene que quedar en `mcp.workspaces`: ' + JSON.stringify(carpetasCasa));
    comprobar(sinSaltos(despuesDeAutorizar.split(/\r?\n/).filter((l) => !l.includes(carpetaNueva)).join('\n')) === sinSaltos(antesDeAutorizar),
      'lo ÚNICO que cambia en el fichero es la línea de la carpeta nueva: ni un comentario ni una clave se pierde');
    const rutaBak = rutaAjustesCasa + '.bak';
    comprobar(existsSync(rutaBak) && sinSaltos(readFileSync(rutaBak, 'utf8')) === sinSaltos(antesDeAutorizar),
      'el botón tiene que dejar la copia previa `settings.yaml.bak` con el fichero de antes');
    di('  E3 · R34 · paso 2 → ' + paso2.status + ' · carpetas en la casa: ' + carpetasCasa.length
      + ' · copia .bak: ' + existsSync(rutaBak));

    // El nonce es de UN SOLO USO: con el mismo, otra vez, no se escribe nada.
    const otraVez = await pedirAutorizar({ confirmar: true, nonce: cuerpo1.nonce }, cabeceraNavegador);
    const cuerpoOtraVez = await otraVez.json().catch(() => ({}));
    comprobar(otraVez.status === 409 && cuerpoOtraVez.error === 'NONCE_CADUCADO',
      'un nonce ya usado tiene que contestar 409 NONCE_CADUCADO (contestó ' + otraVez.status + ')');
    comprobar(readFileSync(rutaAjustesCasa, 'utf8') === despuesDeAutorizar, 'el nonce gastado no puede volver a escribir');
    di('      ' + (otraVez.status === 409 ? 'OK   ' : 'MAL  ') + '  el nonce se gasta al usarlo → ' + otraVez.status);

    // Y la piel lo VE sin reiniciar nada: `/ratacode/mcp` lee el texto en cada
    // petición, así que la carpeta nueva sale ya en la tarjeta de Conexiones.
    const mcpTrasAutorizar = await (await fetch(new URL('/ratacode/mcp', destino), conGalleta)).json().catch(() => ({}));
    const carpetasVistas = Array.isArray(mcpTrasAutorizar.carpetas) ? mcpTrasAutorizar.carpetas.map((r) => String(r)) : [];
    comprobar(carpetasVistas.some((r) => resolve(r) === resolve(carpetaNueva)),
      'la piel tiene que ver la carpeta nueva sin reiniciar: ' + JSON.stringify(carpetasVistas));
    di('      ' + (carpetasVistas.length === 2 ? 'OK   ' : 'MAL  ') + '  la piel ya ve las ' + carpetasVistas.length + ' carpetas autorizadas');
    rmSync(carpetaNueva, { recursive: true, force: true });

    // E4 · dos confirmaciones simultáneas conservan las dos altas y una .bak reciente.
    const carpetaA = join(args.temp, 'concurrente-a'), carpetaB = join(args.temp, 'concurrente-b');
    mkdirSync(carpetaA, { recursive: true }); mkdirSync(carpetaB, { recursive: true });
    const preparar = async (ruta) => (await pedirAutorizar({ ruta }, cabeceraNavegador)).json();
    const [preA, preB] = await Promise.all([preparar(carpetaA), preparar(carpetaB)]);
    const confirmaciones = await Promise.all([
      pedirAutorizar({ confirmar: true, nonce: preA.nonce, ruta: carpetaB }, cabeceraNavegador),
      pedirAutorizar({ confirmar: true, nonce: preB.nonce }, cabeceraNavegador),
    ]);
    comprobar(confirmaciones.every((r) => r.status === 200), 'dos nonces distintos se pueden confirmar a la vez');
    const simultaneas = yaml.load(readFileSync(rutaAjustesCasa, 'utf8'))?.mcp?.workspaces ?? [];
    comprobar(simultaneas.includes(carpetaA) && simultaneas.includes(carpetaB), 'las dos altas concurrentes se conservan, sin sustituir la ruta ligada al nonce');
    const copiaSimultanea = yaml.load(readFileSync(rutaBak, 'utf8'))?.mcp?.workspaces ?? [];
    comprobar(copiaSimultanea.includes(carpetaA) !== copiaSimultanea.includes(carpetaB), 'la .bak es la versión inmediatamente anterior a la última alta');
    const intactoConcurrente = readFileSync(rutaAjustesCasa, 'utf8');
    const desconocido = await pedirAutorizar({ confirmar: true, nonce: 'no-existe' }, cabeceraNavegador);
    comprobar(desconocido.status === 409 && readFileSync(rutaAjustesCasa, 'utf8') === intactoConcurrente, 'nonce desconocido no escribe nada');
    const repetida = await preparar(carpetaA);
    comprobar(repetida.ya_autorizada === true && readFileSync(rutaAjustesCasa, 'utf8') === intactoConcurrente, 'la carpeta recién autorizada no se duplica');
    di('  E4 · simultáneas conservadas y nonce ligado a su ruta');

    // E5 · volver a validar: desaparición, sustitución por fichero y junction cambiada.
    const mutable = join(args.temp, 'ruta-mutable');
    rmSync(mutable, { recursive: true, force: true }); mkdirSync(mutable);
    const borrada = await preparar(mutable);
    rmSync(mutable, { recursive: true });
    const confirmaBorrada = await pedirAutorizar({ confirmar: true, nonce: borrada.nonce }, cabeceraNavegador);
    comprobar(confirmaBorrada.status === 400 && (await confirmaBorrada.json()).error === 'ESA_CARPETA_NO_EXISTE', 'una carpeta borrada entre pasos no se autoriza');
    mkdirSync(mutable);
    const fichero = await preparar(mutable);
    rmSync(mutable, { recursive: true }); writeFileSync(mutable, 'ahora soy un fichero');
    const confirmaFichero = await pedirAutorizar({ confirmar: true, nonce: fichero.nonce }, cabeceraNavegador);
    comprobar(confirmaFichero.status === 400 && (await confirmaFichero.json()).error === 'NO_ES_UNA_CARPETA', 'una carpeta reemplazada por fichero no se autoriza');
    rmSync(mutable); mkdirSync(mutable);
    const cambiada = await preparar(mutable);
    rmSync(mutable, { recursive: true });
    symlinkSync(carpetaA, mutable, process.platform === 'win32' ? 'junction' : 'dir');
    const confirmaCambiada = await pedirAutorizar({ confirmar: true, nonce: cambiada.nonce }, cabeceraNavegador);
    comprobar(confirmaCambiada.status === 409 && (await confirmaCambiada.json()).error === 'RUTA_CAMBIADA', 'un nuevo destino de junction exige otra confirmación');
    // Quitar únicamente el enlace: nunca borrar recursivamente su destino.
    unlinkSync(mutable);
    comprobar(readFileSync(rutaAjustesCasa, 'utf8') === intactoConcurrente, 'ningún cambio de ruta puede alterar settings.yaml');
    di('  E5 · rutas revalidadas al confirmar');

    // E6 · error de copia: original entero y temporal retirado.
    const paraFallo = join(args.temp, 'fallo-de-copia'); mkdirSync(paraFallo, { recursive: true });
    const falloCopia = await preparar(paraFallo);
    const copiaGuardada = rutaBak + '.guardada';
    renameSync(rutaBak, copiaGuardada); mkdirSync(rutaBak);
    try {
      const fallaEscritura = await pedirAutorizar({ confirmar: true, nonce: falloCopia.nonce }, cabeceraNavegador);
      comprobar(fallaEscritura.status === 500 && (await fallaEscritura.json()).error === 'NO_SE_PUDO_ESCRIBIR', 'el error de copia se devuelve sin anunciar autorización');
      comprobar(readFileSync(rutaAjustesCasa, 'utf8') === intactoConcurrente, 'si falla la copia, el fichero original queda entero');
      comprobar(!readdirSync(args.casa).some((n) => /^settings\.yaml\.autorizar-.*\.tmp$/.test(n)), 'el temporal se retira tras el fallo');
    } finally {
      rmSync(rutaBak, { recursive: true }); renameSync(copiaGuardada, rutaBak);
    }
    const reintenta = await preparar(paraFallo);
    const despuesDelFallo = await pedirAutorizar({ confirmar: true, nonce: reintenta.nonce }, cabeceraNavegador);
    comprobar(despuesDelFallo.status === 200, 'tras fallar la copia se puede preparar y confirmar de nuevo');
    di('  E6 · fallo de copia conserva original y permite reintento');

    // E7 · un YAML inválido se conserva exactamente, y la lectura de rutas
    // entrecomilladas coincide con la configuración escrita por el botón.
    const especial = join(args.temp, "O'Brien # carpeta"); mkdirSync(especial, { recursive: true });
    const antesDelYamlRoto = readFileSync(rutaAjustesCasa, 'utf8');
    const paraYaml = await preparar(especial);
    const roto = antesDelYamlRoto + '\nmcp:\n  puerto: 3778\n';
    writeFileSync(rutaAjustesCasa, roto);
    try {
      const rechazaYaml = await pedirAutorizar({ confirmar: true, nonce: paraYaml.nonce }, cabeceraNavegador);
      comprobar(rechazaYaml.status === 500 && (await rechazaYaml.json()).error === 'YAML_ROTO', 'una clave mcp duplicada se rechaza antes de escribir');
      comprobar(readFileSync(rutaAjustesCasa, 'utf8') === roto, 'el YAML inválido no se modifica ni se intenta reparar');
    } finally { writeFileSync(rutaAjustesCasa, antesDelYamlRoto); }
    const preparaEspecial = await preparar(especial);
    const confirmaEspecial = await pedirAutorizar({ confirmar: true, nonce: preparaEspecial.nonce }, cabeceraNavegador);
    comprobar(confirmaEspecial.status === 200, 'una carpeta con comilla y # se autoriza con YAML válido');
    const vistaEspecial = await (await fetch(new URL('/ratacode/mcp', destino), conGalleta)).json();
    comprobar(vistaEspecial.carpetas?.includes(especial), 'la piel relee la ruta exacta, sin duplicar comillas ni quitar el #');
    di('  E7 · YAML inválido intacto y ruta con comilla/# leída correctamente');


    // C · la piel contra el frontend instalado
    const ficheros = ficherosDelFrontend();
    if (!comprobar(ficheros.length > 0, 'no encontré el frontend de DSH instalado (¿npm install hecho?)')) {
      throw new Error('sin frontend instalado no hay nada que comprobar');
    }
    let texto = '';
    let bytes = 0;
    for (const fichero of ficheros) {
      if (!statSync(fichero).isFile()) continue;
      const contenido = readFileSync(fichero, 'utf8');
      texto += contenido;
      bytes += Buffer.byteLength(contenido, 'utf8');
    }
    di('  C · frontend instalado: ' + ficheros.length + ' fichero(s), ' + Math.round(bytes / 1024) + ' KiB de CSS/JS');
    const selectores = selectoresDeLaPiel();
    const muertos = [];
    for (const selector of selectores) {
      const vive = texto.includes(selector);
      if (!vive) muertos.push(selector);
      di('      ' + (vive ? 'OK   ' : 'MUERTO') + '  [class*=\'' + selector + '\']');
    }
    comprobar(muertos.length === 0, 'la piel tiene ' + muertos.length + ' selector(es) que YA NO existen en el '
      + 'frontend instalado: ' + muertos.join(', '));
    di('  C · selectores vivos: ' + (selectores.length - muertos.length) + '/' + selectores.length);

    // D · los proveedores de fábrica: las 8 APIs en Ajustes > Models (los 7
    // declarados + el DeepSeek nativo de DSH, que no se declara a propósito) y
    // los DOS locales (Ollama y LM Studio) declarados pero fuera de esa lista
    // (R18: la piel los esconde y tienen su pestaña). Cada baseURL y
    // cada id de modelo, comprobados en su documentación oficial (R12), y los
    // DOS locales de R16 (Ollama y LM Studio), que van SIN `apiKeyEnv`: una
    // ruta que no nombra credencial queda sin autenticar (`dsh-llm-pi-ai`,
    // `namesCredential`), que es justo lo que hacen los dos en localhost.
    const fabrica = yaml.load(readFileSync(join(PRODUCTO, 'fabrica', 'settings.yaml'), 'utf8')) ?? {};
    const proveedores = fabrica?.['llm-pi-ai']?.providers ?? {};
    const ESPERADOS = [
      ['b-ai', 'https://api.b.ai/v1', 'B_AI_API_KEY', ['deepseek-v4.1-flash']],
      ['openrouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', ['deepseek/deepseek-v4-flash-vision-exp']],
      ['groq', 'https://api.groq.com/openai/v1', 'GROQ_API_KEY', ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b']],
      ['gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/', 'GEMINI_API_KEY', ['gemini-3.8-flash']],
      ['nvidia-nim', 'https://integrate.api.nvidia.com/v1', 'NVIDIA_API_KEY', ['deepseek-ai/deepseek-v4-flash']],
      ['sambanova', 'https://api.sambanova.ai/v1', 'SAMBANOVA_API_KEY', ['MiniMax-M2.7']],
      ['cloudflare-workers-ai', 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1', 'CLOUDFLARE_API_KEY', ['@cf/openai/gpt-oss-120b']],
      ['ollama', 'http://127.0.0.1:11434/v1', undefined, ['qwen3:8b', 'lfm2.5:8b']],
      ['lmstudio', 'http://127.0.0.1:1234/v1', undefined, []],
    ];
    di('  D · proveedores declarados en fabrica\\settings.yaml: ' + Object.keys(proveedores).length
      + ' (7 APIs declaradas + DeepSeek nativo = 8 en Ajustes › Models, y los 2 locales en su pestaña)');
    comprobar(Object.keys(proveedores).length === ESPERADOS.length,
      'fabrica/settings.yaml declara ' + Object.keys(proveedores).length + ' proveedores y deberían ser ' + ESPERADOS.length);
    comprobar(proveedores.deepseek === undefined,
      'fabrica/settings.yaml NO debe declarar «deepseek»: lo sirve el adaptador nativo de DSH');
    for (const [id, baseURL, apiKeyEnv, modelos] of ESPERADOS) {
      const perfil = proveedores[id];
      const bien = perfil !== undefined && perfil.baseURL === baseURL && perfil.apiKeyEnv === apiKeyEnv;
      comprobar(bien, 'el proveedor «' + id + '» no está como toca (baseURL/apiKeyEnv): ' + JSON.stringify(perfil?.baseURL));
      const ids = (perfil?.models ?? []).map((m) => (typeof m === 'string' ? m : m?.id));
      for (const modelo of modelos) {
        comprobar(ids.includes(modelo), 'el proveedor «' + id + '» no declara el modelo «' + modelo + '»');
      }
      di('      ' + (bien ? 'OK   ' : 'MAL  ') + '  ' + id + ' → ' + (perfil?.baseURL ?? '(falta)') + ' · ' + (apiKeyEnv ?? 'SIN CLAVE (local)'));
    }
    comprobar(String(proveedores['cloudflare-workers-ai']?.displayName ?? '').includes('account_id'),
      'el nombre visible de Cloudflare tiene que avisar de que {account_id} se cambia a mano');

    if (fallos.length > 0) {
      di('');
      di('ROJO · ' + fallos.length + ' cosa(s) mal:');
      for (const fallo of fallos) di('  · ' + fallo);
      codigo = 1;
    } else {
      di('');
      di('VERDE · la piel está puesta y encaja con el frontend instalado.');
    }
  } catch (e) {
    di('');
    di('ROJO · ' + (e && e.message ? e.message : String(e)));
    codigo = 1;
  } finally {
    try { await matar(hijo); }
    catch (e) { di('ROJO · cierre de la prueba: ' + e.message); codigo = 1; }
  }
  // Salida explícita: el hijo y su tubería pueden dejar el bucle de eventos
  // vivo un rato de más, y una prueba que no termina no es una prueba.
  process.exit(codigo);
}

await main();
