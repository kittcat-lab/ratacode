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
 *       protegidas: el apretón de manos (GET/POST `/ratacode/handshake`, que
 *       deja `<casa>\handshake.md` en 40 líneas o menos) y el MCP para chats
 *       web (`/ratacode/mcp`, con los dos comandos y el texto del chat), y
 *       comprueba que el plugin de CLIENTE —la sección «Handshakes» de
 *       Ajustes— se sirve de verdad en `/plugins/??ratacode-piel/client.js`.
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
 *   node pruebas/piel.test.mjs --puerto 3101 --casa <ruta> --taller <ruta>
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const RATACODE = join(PRODUCTO, 'bin', 'ratacode.js');
const PIEL_CSS = join(PRODUCTO, 'piel', 'activos', 'ratacode-piel.css');

// ── la línea de órdenes ─────────────────────────────────────────────────────
function leerArgumentos(argv) {
  const args = {
    puerto: 3140,
    casa: join(PRODUCTO, '_pruebaR3-piel'),
    taller: join(PRODUCTO, '_pruebaR3-piel-taller'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--puerto') args.puerto = Number(argv[++i]);
    else if (argv[i] === '--casa') args.casa = resolve(argv[++i]);
    else if (argv[i] === '--taller') args.taller = resolve(argv[++i]);
    else throw new Error('no entiendo «' + argv[i] + '»');
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

// ── A · arrancar RATACODE de verdad ─────────────────────────────────────────
function arrancar(args) {
  rmSync(args.casa, { recursive: true, force: true });
  rmSync(args.taller, { recursive: true, force: true });
  mkdirSync(args.taller, { recursive: true });
  // SIN CLAVES a propósito, en el entorno de ESTE proceso (R17): así la casa se
  // estrena con el modelo de fábrica (B.AI) y la prueba del aviso «falta la
  // clave» es la misma en cualquier PC, tenga o no credenciales de verdad.
  const entorno = { ...process.env, B_AI_API_KEY: '', OPENROUTER_API_KEY: '', DEEPSEEK_API_KEY: '' };
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

function matar(hijo) {
  if (hijo === null || hijo.killed || hijo.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + '/T /F'],
        { windowsHide: true, stdio: 'ignore' });
    } else hijo.kill('SIGTERM');
  } catch { /* ya se fue */ }
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
  ['R12: el plugin de cliente que monta la sección Handshakes', 'ratacode-piel/client.js'],
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
  ['R18: el aviso del runtime apagado, en español', ' no está encendido: arráncalo con «'],
  ['R18: el botón que abre la pestaña de los locales', 'Abrir Ajustes › Modelos locales'],
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

    // B2 · el apretón de manos (Ajustes > Handshakes), por su ruta protegida
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
    comprobar(/handshake\.md|Apretón de manos: RATACODE/i.test(textoApreton), 'el apretón servido no es apreton/handshake.md');
    di('      ' + (textoApreton.includes(url) ? 'OK   ' : 'MAL  ') + '  el apretón trae la URL de esta casa');
    di('      ' + (lineasApreton > 0 && lineasApreton <= 40 ? 'OK   ' : 'MAL  ') + '  el apretón tiene ' + lineasApreton + ' líneas (tope 40)');
    const sinClaves = !/sk-[A-Za-z0-9]|API_KEY\s*[:=]\s*[A-Za-z0-9_-]{8}/.test(textoApreton);
    comprobar(sinClaves, 'el apretón servido parece llevar una clave dentro');
    di('      ' + (sinClaves ? 'OK   ' : 'MAL  ') + '  el apretón no lleva claves');

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

    // B3 · el MCP para chats web: estado, los dos comandos y el texto del chat
    const estadoMcp = await fetch(new URL('/ratacode/mcp', destino), conGalleta);
    const cuerpoMcp = await estadoMcp.json().catch(() => ({}));
    di('  B3 · GET /ratacode/mcp → ' + estadoMcp.status + ' · http:' + (cuerpoMcp.http?.abierto === true)
      + ' · túnel:' + (cuerpoMcp.tunel?.abierto === true));
    comprobar(estadoMcp.status === 200 && cuerpoMcp.ok === true, '/ratacode/mcp contestó ' + estadoMcp.status);
    comprobar(cuerpoMcp.http?.abierto === false && cuerpoMcp.tunel?.abierto === false,
      'en una casa recién estrenada el MCP y el túnel tienen que salir CERRADOS');
    const comandos = String(cuerpoMcp.comandos ?? '');
    comprobar(comandos.includes('ratacode mcp --http --acepto-lectura-total'), 'los comandos no arrancan el MCP por HTTP');
    comprobar(comandos.includes('tunel.mjs') && comandos.includes('--acepto-lectura-total'), 'los comandos no arrancan el túnel con su acepto');
    comprobar(/^cd .+; /m.test(comandos) && comandos.split('\n').length === 2,
      'los dos comandos tienen que ir en un bloque pegable «cd <ruta>; comando» (2 líneas)');
    comprobar(typeof cuerpoMcp.instalacion === 'string' && resolve(cuerpoMcp.instalacion) === resolve(PRODUCTO),
      'los comandos no llevan la ruta de ESTA instalación: «' + cuerpoMcp.instalacion + '» (esperaba ' + PRODUCTO + ')');
    const pegar = String(cuerpoMcp.pegar ?? '');
    comprobar(pegar.includes('list_models') && pegar.includes('run_task') && pegar.includes('esperar_segundos'),
      'el texto para pegar en el chat no cuenta las herramientas ni esperar_segundos');
    comprobar(/AVISO/.test(pegar), 'el texto para pegar no lleva el aviso de lectura total');
    di('      ' + (pegar.includes('esperar_segundos') ? 'OK   ' : 'MAL  ') + '  el texto del chat cuenta herramientas y esperar_segundos');
    di('      ' + (comandos.split('\n').length === 2 ? 'OK   ' : 'MAL  ') + '  los dos comandos van en un bloque pegable');

    // B4 · el plugin de CLIENTE (la sección «Handshakes» de Ajustes) se sirve
    const urlBundle = /\/plugins\/\?\?ratacode-piel\/client\.js&rev=([\w-]+)/.exec(html);
    comprobar(urlBundle !== null, 'el index no trae el plugin de cliente ratacode-piel en el grafo de arranque');
    if (urlBundle !== null) {
      const respuestaBundle = await fetch(new URL('/plugins/??ratacode-piel/client.js&rev=' + urlBundle[1], destino), conGalleta);
      const textoBundle = await respuestaBundle.text();
      di('  B4 · GET el bundle del plugin → ' + respuestaBundle.status + ' · ' + Buffer.byteLength(textoBundle, 'utf8') + ' bytes');
      comprobar(respuestaBundle.status === 200, 'el bundle del plugin contestó ' + respuestaBundle.status);
      comprobar(textoBundle.includes('settings.section'), 'el bundle no registra la sección por el slot settings.section');
      comprobar(textoBundle.includes("id: 'handshakes'"), 'el bundle no registra la sección «handshakes»');
      comprobar(textoBundle.includes('Handshakes'), 'el bundle no lleva el rótulo «Handshakes»');
      comprobar(textoBundle.includes('Agentes con navegador') && textoBundle.includes('Chats web'),
        'el bundle no trae los dos botones de la sección');
      // R18 · la pestaña nueva, por la MISMA vía oficial (settings.section)
      comprobar(textoBundle.includes("id: 'modelos-locales'"), 'el bundle no registra la sección «modelos-locales»');
      comprobar(textoBundle.includes('Modelos locales'), 'el bundle no lleva el rótulo «Modelos locales»');
      comprobar(textoBundle.includes('/ratacode/runtimes'), 'la sección nueva no pregunta por los runtimes locales');
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

    // B7 · sin cookie, ni el apretón ni el MCP ni la clave ni los runtimes: el cerco del motor
    for (const ruta of ['/ratacode/handshake', '/ratacode/mcp', '/ratacode/clave', '/ratacode/runtimes']) {
      const sinGalleta = await fetch(new URL(ruta, destino), { redirect: 'manual' });
      comprobar(sinGalleta.status === 401, ruta + ' sin cookie contestó ' + sinGalleta.status + ' (debía ser 401)');
      di('      ' + (sinGalleta.status === 401 ? 'OK   ' : 'MAL  ') + '  ' + ruta + ' sin cookie contesta 401');
    }

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
    matar(hijo);
  }
  // Salida explícita: el hijo y su tubería pueden dejar el bucle de eventos
  // vivo un rato de más, y una prueba que no termina no es una prueba.
  await new Promise((seguir) => setTimeout(seguir, 750));
  process.exit(codigo);
}

await main();
