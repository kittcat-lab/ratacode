#!/usr/bin/env node
/**
 * ratacode — LA TERMINAL DE TRABAJO BRUTO.
 *
 * Arranca `dsh` (el motor de DSH, MIT) con una casa PROPIA
 * (`%USERPROFILE%\.ratacode`, nunca `~/.dsh`) y con la cara de RATACODE puesta
 * por el plugin `ratacode-piel`. Puerto fijo y conocido: 3777.
 *
 * Lo que hace, en orden:
 *   0 · PUERTA: si Node es menor que 24, PARA con un mensaje claro (no arranca).
 *   1 · Prepara la casa: `profiles/web` (bundles `dsh-base`, `dsh-web-app` y
 *       `ratacode-piel`, copiado dentro del perfil, que es como el cargador de
 *       DSH resuelve un plugin fuera del árbol) y `profiles/headless`
 *       (`dsh-base` + `dsh-headless`, el modo sin pantalla que DSH ya trae).
 *   2 · ESTRENA la casa (sólo la primera vez, si no hay `settings.yaml`):
 *       copia `fabrica\settings.yaml` — B.AI y OpenRouter de fábrica, el aviso
 *       «Internal Testing» ya aceptado y `permission.defaultPreset:
 *       danger-full-access` (sin «Permitir» en cada paso) — copia los nueve
 *       modos de `modos\` a `<casa>/.agent-presets`, y pone el modelo por
 *       defecto del PRIMER PROVEEDOR CON CLAVE en el entorno (orden: B.AI,
 *       OpenRouter, DeepSeek). Si la casa YA existe, no se pisa nada del
 *       usuario.
 *   3 · ESPACIO DE TRABAJO: la carpeta desde la que se lanza `ratacode` (o la
 *       de `--carpeta <ruta>`) queda REGISTRADA en `<casa>\storages\workspace.json`
 *       — el formato del registro de espacios de DSH — y es el `cwd` del motor.
 *       Además se fija el selector de carpeta EN LA WEB: se apaga la fila
 *       adaptativa de DSH (`dsh-host-directory-picker-auto`, que en Windows
 *       resuelve «native» y abre un diálogo del sistema que nadie que maneje
 *       RATACODE desde fuera puede ver) y se compone el par «browse».
 *   4 · Arranca el motor, coge la URL CON TOKEN que imprime y la guarda en
 *       `<casa>/url.txt` SÓLO cuando el puerto ya escucha de verdad (al
 *       empezar borra la de la vez anterior, para que nadie se lleve una URL
 *       muerta). Y deja en `<casa>\ratacode.log` por qué se cierra el motor
 *       (código de salida y señal): una instancia que se cae sola tiene que
 *       dejar rastro.
 *
 * Y `ratacode headless "encargo" [--modelo X]`: el MISMO motor, la MISMA casa,
 * el perfil `headless` de DSH, sin pantalla ni puerto. `--modelo` vale sólo
 * para ese encargo: se le pasa al motor un documento de ajustes copia con el
 * modelo cambiado, así NO se toca el que el usuario tenga guardado.
 *
 * Ninguna clave viaja dentro: las pone el usuario (web Ajustes > Models →
 * `<casa>/.credentials.yaml`, o exportando la variable de entorno de cada
 * proveedor). Los proveedores de fábrica son los 9 declarados en
 * `fabrica\settings.yaml` (B.AI, OpenRouter, Groq, Google Gemini, NVIDIA NIM,
 * SambaNova, Cloudflare Workers AI y DOS LOCALES sin clave: Ollama y LM Studio)
 * más DeepSeek, que lo sirve el adaptador nativo de DSH (ruta
 * `deepseek-official`, `https://api.deepseek.com`, `DEEPSEEK_API_KEY`): 10 en
 * Ajustes > Models.
 * De las claves SÓLO se mira si la variable existe: nunca su valor.
 *
 * El texto de la conexión y el MCP para chats web viven en Ajustes > Conexiones
 * (la piel los sirve en `/ratacode/handshake` y `/ratacode/mcp`); para eso el
 * plugin se lleva copiado `apreton\` y la ruta de ESTA instalación en
 * `instalacion.txt` (para que los comandos del MCP lleven la ruta de verdad).
 *
 * Nada de esto toca `~/.dsh` ni el DSH de nadie más.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAQUETE = resolve(AQUI, '..');
const PIEL_ORIGEN = join(PAQUETE, 'piel');
const NOMBRE_PLUGIN = 'ratacode-piel';
/** Los ajustes que se copian a una casa nueva (proveedores, aviso, permiso). */
const FABRICA_ORIGEN = join(PAQUETE, 'fabrica', 'settings.yaml');
/** Los nueve modos de fábrica, que van a `<casa>/.agent-presets`. */
const MODOS_ORIGEN = join(PAQUETE, 'modos');
/** El texto de la conexión y su guía, que viajan copiados junto al plugin de la piel. */
const APRETON_ORIGEN = join(PAQUETE, 'apreton');

/** Puerto fijo y conocido de RATACODE. `--port` lo cambia. */
const PUERTO_POR_DEFECTO = 3777;
/** La versión del aviso «Internal Testing» que el cliente da por aceptada. */
const AVISO_ACEPTADO = '2026-08-13.1';
/** Node mínimo: por debajo, los módulos nativos del motor no son los suyos. */
const NODE_MINIMO = 24;
/**
 * La capa que deja SÓLO los 9 modos de RATACODE en el selector: apaga la raíz
 * de fábrica del motor (sus 4 modos de serie no salen) y pone `modo-rata` por
 * defecto. Va en la COMPOSICIÓN porque el namespace de ajustes del motor sólo
 * admite `default` (`dsh-agent-presets/lib/index.js:1151`); `includeShippedRoot`
 * no cabe en `settings.yaml` y su única puerta es esta capa (`:1246`).
 * Va DESPUÉS de los bundles: la fila `agent-presets` la inserta `dsh-web-app`,
 * así que un `config` por id sólo la alcanza si se aplica por encima.
 */
const CAPA_PRESETS = `# RATACODE · los 9 modos de la casa, y NINGUNO de los que trae el motor de serie.
- id: agent-presets
  config:
    default: modo-rata
    includeShippedRoot: false
`;
/** El preset de RATACODE que una casa usa si no dice otra cosa. */
const PRESET_POR_DEFECTO = 'modo-rata';
/**
 * El idioma de RATACODE (R21): español. Los otros dos que trae el motor
 * (inglés y chino) siguen donde estaban: se eligen en Ajustes › General ›
 * Language. Aquí sólo se apunta el de la casa cuando no hay ninguno apuntado.
 */
const IDIOMA_POR_DEFECTO = 'es';
/**
 * Los TRES temas de RATACODE (R21), en su orden, y el de fábrica: el primero.
 * El id tiene que ser el mismo que registra `piel\lib\cliente.js` por la vía
 * oficial de temas de DSH.
 */
const TEMAS_DE_LA_CASA = ['ratacode-pink', 'ratacode-yellow', 'minimal'];
const TEMA_POR_DEFECTO = TEMAS_DE_LA_CASA[0];
/** Los presets que salieron en versiones anteriores de RATACODE y ya no existen. */
const PRESETS_VIEJOS = ['enlazador', 'promptista', 'escritor'];
/**
 * Los valores de `agent-presets.default` que hay que MIGRAR a modo-rata, y sólo
 * éstos: los que traía RATACODE de fábrica (`standard`), los que ya no existen
 * (los tres de arriba) y los de serie del motor (`minimal`, `ptc`, `cordis`),
 * que con `includeShippedRoot: false` no resuelven y dejan la sesión sin
 * componer (`preset "standard" not found`, medido en R14). Cualquier otro valor
 * —uno de los 9 modos, o un preset del usuario— NO se toca: es su elección.
 */
const PRESETS_A_MIGRAR = ['standard', 'minimal', 'ptc', 'cordis', ...PRESETS_VIEJOS];
const PLANTILLA_PARCHE = `# Tu capa de parches de este perfil, aplicada después de cada capa de bundle:
# una lista YAML de filas del cargador (config por id, desactivaciones, inserts).
${CAPA_PRESETS}`;
/** Los ajustes que DSH espera en un perfil para resolver plugins de fuera del árbol. */
const PLANTILLA_PNPM = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`;

/**
 * El primer proveedor con clave en el entorno, en este orden, y el modelo con
 * el que se estrena la casa. Si el proveedor declara modelos en el
 * `settings.yaml` de la casa, manda el PRIMERO que declare; este de aquí es
 * sólo el respaldo cuando no declara ninguno (DeepSeek no se declara: lo sirve
 * el adaptador nativo de DSH, cuyo modelo por defecto es `deepseek-flash`).
 */
const PROVEEDORES_POR_ORDEN = [
  { variable: 'B_AI_API_KEY', proveedor: 'b-ai', modelo: 'deepseek-v4.1-flash' },
  { variable: 'OPENROUTER_API_KEY', proveedor: 'openrouter', modelo: 'qwen/qwen3.8-flash' },
  { variable: 'DEEPSEEK_API_KEY', proveedor: 'deepseek-official', modelo: 'deepseek-flash' },
];

// ── 0 · la puerta: Node 24 ──────────────────────────────────────────────────
/**
 * Para ANTES de tocar nada si Node es más viejo que {@link NODE_MINIMO}. El
 * motor y sus módulos nativos (`node-pty`, `koffi`, `dsh-subprocess-local`)
 * están probados y precompilados para Node 24; con menos, el fallo saldría más
 * tarde y peor (una terminal que no arranca, un módulo que no carga).
 */
function exigirNode() {
  const version = process.versions.node;
  const mayor = Number.parseInt(String(version).split('.')[0], 10);
  if (Number.isFinite(mayor) && mayor >= NODE_MINIMO) return;
  process.stderr.write([
    '',
    'RATACODE · PARA.',
    '',
    '  Hace falta Node ' + NODE_MINIMO + ' o más nuevo, y aquí hay Node ' + version + '.',
    '  El motor de RATACODE y sus módulos nativos (node-pty, koffi,',
    '  subprocess-local) están compilados y probados para Node ' + NODE_MINIMO + ': con menos,',
    '  el panel puede arrancar pero la terminal y los subprocesos fallan.',
    '',
    '  Qué hacer:',
    '    1. Instala Node ' + NODE_MINIMO + ':  https://nodejs.org/es/download',
    '       (con nvm-windows:  nvm install ' + NODE_MINIMO + '  &&  nvm use ' + NODE_MINIMO + ')',
    '    2. Vuelve a poner RATACODE:  npm i -g ratacode',
    '    3. Arranca:  ratacode',
    '',
    '  Comprueba tu versión con:  node -v',
    '  (este RATACODE se está ejecutando con: ' + process.execPath + ')',
    '',
  ].join('\n'));
  process.exit(1);
}

// ── la línea de órdenes ─────────────────────────────────────────────────────
function uso() {
  return [
    'RATACODE · la terminal de trabajo bruto',
    '',
    '  ratacode [opciones]',
    '  ratacode headless "encargo" [opciones]',
    '',
    '  --port <n>       puerto del panel (por defecto ' + PUERTO_POR_DEFECTO + '; 0 = el que dé el sistema)',
    '  --home <ruta>    dónde vive la casa de RATACODE (por defecto %USERPROFILE%\\.ratacode)',
    '  --carpeta <ruta> espacio de trabajo (por defecto, la carpeta desde la que lanzas ratacode)',
    '  --modelo <x>     SÓLO headless: el modelo de ese encargo (p. ej. deepseek-v4.1-flash)',
    '  --open           abre además la URL en el navegador de siempre',
    '  -h, --help       esto',
    '',
    '  ratacode mcp [opciones]',
    '',
    '  El servidor MCP de RATACODE, como subcomando del mismo binario:',
    '  habla MCP por stdio (lo que espera cualquier cliente) y, con --http,',
    '  también por Streamable HTTP. Todo lo que va detrás de «mcp» es suyo.',
    '',
    '    ratacode mcp                     MCP por stdio',
    '    ratacode mcp --http             MCP por stdio Y por HTTP (puerto 3778; ver mcp/README.md)',
    '    ratacode mcp --status            enseña el estado de la casa y sale',
    '    ratacode mcp --help              la ayuda del MCP',
    '',
    '  headless no abre panel ni puerto: hace el encargo, imprime la respuesta y termina.',
    '',
  ].join('\n');
}

/**
 * Las órdenes de RATACODE. `mcp` es un subcomando PASO A PASO: todo lo que va
 * detrás es del servidor MCP (incluido su `--help` y su `--home`), porque por
 * stdio stdout es del protocolo y no se puede tocar.
 */
function leerOrdenes(argv) {
  if (argv[0] === 'mcp') {
    const resto = argv.slice(1);
    let casa = null;
    for (let i = 0; i < resto.length; i += 1) {
      const a = resto[i];
      if (a === '--home') casa = resolve(resto[i + 1] ?? '');
      else if (a.startsWith('--home=')) casa = resolve(a.slice(a.indexOf('=') + 1));
    }
    return { modo: 'mcp', mcpArgv: resto, casa, ayuda: false, puerto: PUERTO_POR_DEFECTO, abrir: false, carpeta: null, encargo: null, modelo: null };
  }
  const ordenes = {
    puerto: PUERTO_POR_DEFECTO, casa: null, abrir: false, ayuda: false,
    carpeta: null, modo: 'web', encargo: null, modelo: null, mcpArgv: null,
  };
  const sueltos = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-h' || a === '--help') ordenes.ayuda = true;
    else if (a === '--open') ordenes.abrir = true;
    else if (a === 'headless') ordenes.modo = 'headless';
    else if (a === '--port' || a.startsWith('--port=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!/^\d+$/.test(String(valor))) throw new Error('--port tiene que ser un número, y me has dado ' + JSON.stringify(valor));
      ordenes.puerto = Number(valor);
    } else if (a === '--home' || a.startsWith('--home=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!valor) throw new Error('--home necesita una ruta');
      ordenes.casa = resolve(valor);
    } else if (a === '--carpeta' || a.startsWith('--carpeta=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!valor) throw new Error('--carpeta necesita una ruta');
      ordenes.carpeta = resolve(valor);
    } else if (a === '--modelo' || a.startsWith('--modelo=')) {
      const valor = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
      if (!valor) throw new Error('--modelo necesita un nombre de modelo');
      ordenes.modelo = valor;
    } else if (a.startsWith('-')) throw new Error('no entiendo «' + a + '» (mira: ratacode --help)');
    else sueltos.push(a);
  }
  if (ordenes.modo === 'headless') {
    if (sueltos.length === 0) {
      throw new Error('headless necesita el encargo entre comillas, por ejemplo: ratacode headless "lista los ficheros"');
    }
    ordenes.encargo = sueltos.join(' ');
    if (ordenes.abrir) throw new Error('--open es del panel; headless no abre nada');
  } else {
    if (sueltos.length > 0) throw new Error('no entiendo «' + sueltos[0] + '» (mira: ratacode --help)');
    if (ordenes.modelo !== null) throw new Error('--modelo es de headless: ratacode headless "encargo" --modelo ' + ordenes.modelo);
  }
  return ordenes;
}

// ── 1 · la casa y los perfiles ──────────────────────────────────────────────
function escribirSiFalta(ruta, texto) {
  if (existsSync(ruta)) return false;
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto);
  return true;
}

/** Una lista YAML vacía en formato FLUJO, sola en su línea: `[]` (o `[ ]`). */
const LINEA_VACIA_FLUJO = /^[ \t]*\[[ \t]*\][ \t]*$/;

/**
 * Las filas de un `cordis.patch.yml`, o `null` si ese texto NO es una lista
 * YAML válida (que es el caso roto de la 0.2.0). Un fichero vacío es la lista
 * vacía; un documento que no sea una lista tampoco vale.
 * @param texto - el contenido del fichero.
 * @returns las filas, o null.
 */
function filasDelParche(texto) {
  let cargado;
  try {
    cargado = yaml.load(texto);
  } catch {
    return null;
  }
  if (cargado === null || cargado === undefined) return [];
  return Array.isArray(cargado) ? cargado : null;
}

/** ¿Estas filas ya traen la capa de presets? */
function tieneLaCapa(filas) {
  return filas.some((fila) => fila !== null && typeof fila === 'object' && !Array.isArray(fila) && fila.id === 'agent-presets');
}

/**
 * Deja la capa de presets en el `cordis.patch.yml` de un perfil, SIEMPRE como
 * lista YAML válida. La plantilla sólo se escribe cuando el fichero falta
 * (`escribirSiFalta`), así que sin esto una casa estrenada con una versión
 * anterior seguiría enseñando los modos de serie del motor.
 *
 * Tres casos, los tres medidos:
 *   · el fichero trae `[]` o va vacío → se escribe la capa sola;
 *   · el fichero trae filas del usuario → se respetan y la capa se añade al
 *     final (que es donde manda);
 *   · el fichero se quedó ROTO por la 0.2.0 —un `[]` pegado delante de las
 *     filas, que no es YAML— → se quita esa línea suelta y se reescribe válido,
 *     sin perder ni una fila del usuario. Pasaba al actualizar una casa de la
 *     0.1 y el motor moría: «YAMLException: end of the stream or a document
 *     separator is expected».
 * @param perfil - la carpeta del perfil (`<casa>/profiles/web`).
 * @returns `{puesto, reparado, motivo}`.
 */
function asegurarCapaPresets(perfil) {
  const ruta = join(perfil, 'cordis.patch.yml');
  let texto = '';
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return { puesto: false, reparado: false, motivo: 'sin cordis.patch.yml' };
  }
  let filas = filasDelParche(texto);
  let reparado = false;
  if (filas === null) {
    const limpio = texto.split('\n').filter((linea) => !LINEA_VACIA_FLUJO.test(linea)).join('\n');
    filas = filasDelParche(limpio);
    if (filas === null) return { puesto: false, reparado: false, motivo: 'el cordis.patch.yml del perfil no se puede leer como YAML: no lo toco' };
    reparado = true;
    texto = limpio;
  }
  if (tieneLaCapa(filas)) {
    if (reparado) escribir(ruta, texto);
    return { puesto: false, reparado, motivo: reparado ? 'ya tenía la capa' : 'ya estaba' };
  }
  if (filas.length === 0) {
    escribir(ruta, PLANTILLA_PARCHE);
    return { puesto: true, reparado, motivo: reparado ? 'estaba vacío' : 'estaba vacío' };
  }
  escribir(ruta, (texto.endsWith('\n') ? texto + '\n' : texto + '\n\n') + CAPA_PRESETS);
  return { puesto: true, reparado, motivo: reparado ? 'capa añadida al final' : 'añadida al final' };
}

/** El perfil: sus bundles, en orden. Si ya existe, NO se pisa: se completa. */
function prepararPerfil(perfil, nombre, bundles, patchReload) {
  const manifest = join(perfil, 'package.json');
  let pkg;
  if (existsSync(manifest)) {
    pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  } else {
    pkg = { name: nombre, private: true, dependencies: {} };
  }
  pkg.dsh = pkg.dsh ?? {};
  pkg.dsh.profile = pkg.dsh.profile ?? {};
  const lista = (pkg.dsh.profile.bundles = pkg.dsh.profile.bundles ?? []);
  for (const b of bundles) {
    if (!lista.includes(b)) lista.push(b);
  }
  pkg.dsh.profile.patchReload = pkg.dsh.profile.patchReload ?? patchReload;
  mkdirSync(perfil, { recursive: true });
  writeFileSync(manifest, JSON.stringify(pkg, null, 2) + '\n');
  escribirSiFalta(join(perfil, 'cordis.patch.yml'), PLANTILLA_PARCHE);
  escribirSiFalta(join(perfil, 'pnpm-workspace.yaml'), PLANTILLA_PNPM);
  const capa = asegurarCapaPresets(perfil);
  return capa;
}

/**
 * Copia un árbol de ficheros escribiendo SÓLO lo que cambia: lo que ya está
 * igual no se toca (y se cuenta aparte). Se usa para la piel dentro del perfil
 * y para los modos dentro de la casa.
 */
function copiarArbol(origen, destino, cuenta) {
  mkdirSync(destino, { recursive: true });
  for (const entrada of readdirSync(origen, { withFileTypes: true })) {
    if (entrada.name === 'node_modules' || entrada.name === '.git') continue;
    const o = join(origen, entrada.name);
    const d = join(destino, entrada.name);
    if (entrada.isDirectory()) {
      copiarArbol(o, d, cuenta);
      continue;
    }
    const contenido = readFileSync(o);
    if (existsSync(d) && statSync(d).isFile() && Buffer.compare(readFileSync(d), contenido) === 0) {
      cuenta.iguales += 1;
      continue;
    }
    writeFileSync(d, contenido);
    cuenta.copiados += 1;
  }
  return cuenta;
}

/** Escribe un fichero de texto entero, creando la carpeta que haga falta. */
function escribir(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
}

// ── 2 · la casa: estreno, aviso, modos y modelo por defecto ─────────────────
/** 2a · El aviso «Internal Testing», dado por aceptado (sin pisar lo que ya haya). */
function aceptarAviso(casa) {
  const ruta = join(casa, 'settings.yaml');
  let actual = '';
  try { actual = readFileSync(ruta, 'utf8'); } catch { actual = ''; }
  if (/welcomeNoticeVersion\s*:/.test(actual)) return 'ya estaba';
  const seccion = (actual.trim() === '' ? '' : actual.replace(/\s*$/, '\n'))
    + 'ui-onboarding:\n  welcomeNoticeVersion: ' + AVISO_ACEPTADO + '\n';
  mkdirSync(casa, { recursive: true });
  writeFileSync(ruta, seccion, { mode: 0o600 });
  return 'puesto';
}

/** El primer proveedor con clave en el entorno. SÓLO se mira si existe. */
function primerProveedorConClave(entorno) {
  for (const candidato of PROVEEDORES_POR_ORDEN) {
    const valor = entorno[candidato.variable];
    // Un export vacío es «no puesta» por convención del shell. Nunca se mira
    // el contenido: sólo si hay algo.
    if (typeof valor === 'string' && valor.trim() !== '') return candidato;
  }
  return null;
}

/** El `settings.yaml` de una casa, como objeto; null si no se puede leer. */
function leerAjustes(casa) {
  try {
    return yaml.load(readFileSync(join(casa, 'settings.yaml'), 'utf8')) ?? {};
  } catch {
    return null;
  }
}

/** El primer modelo que la casa declara para un proveedor, si declara alguno. */
function primerModeloDeclarado(ajustes, proveedor) {
  const declarado = ajustes?.['llm-pi-ai']?.providers?.[proveedor]?.models;
  if (!Array.isArray(declarado) || declarado.length === 0) return null;
  const primero = declarado[0];
  return typeof primero === 'string' ? primero : (primero?.id ?? null);
}

/**
 * Reescribe el bloque `agent-default-model:` de un `settings.yaml` sin tocar
 * nada más: ni los comentarios, ni los proveedores, ni el orden del documento.
 * Si el bloque no está, se añade al final.
 */
function ponerModeloEnTexto(texto, proveedor, modelo) {
  const bloque = 'agent-default-model:\n  provider: ' + proveedor + '\n  model: ' + JSON.stringify(modelo) + '\n';
  const bloqueActual = /^agent-default-model:[ \t]*\n(?:[ \t]+[^\n]*\n)*/m;
  if (bloqueActual.test(texto)) return texto.replace(bloqueActual, bloque);
  return (texto.trim() === '' ? '' : texto.replace(/\s*$/, '\n')) + '\n' + bloque;
}

/**
 * La casa: la PRIMERA vez se estrena con los ajustes de fábrica (proveedores,
 * aviso aceptado y permiso sin preguntar) y con el modelo del primer proveedor
 * con clave. Si ya existe, NO se pisa nada del usuario.
 */
function estrenarCasa(casa, entorno) {
  const ruta = join(casa, 'settings.yaml');
  if (existsSync(ruta)) return { nueva: false, aviso: aceptarAviso(casa), modelo: null };
  mkdirSync(casa, { recursive: true });
  let texto = readFileSync(FABRICA_ORIGEN, 'utf8');
  const elegido = primerProveedorConClave(entorno);
  if (elegido !== null) {
    const ajustes = yaml.load(texto) ?? {};
    const modelo = primerModeloDeclarado(ajustes, elegido.proveedor) ?? elegido.modelo;
    texto = ponerModeloEnTexto(texto, elegido.proveedor, modelo);
    writeFileSync(ruta, texto, { mode: 0o600 });
    return {
      nueva: true,
      aviso: 'puesto (fábrica)',
      modelo: { proveedor: elegido.proveedor, modelo, variable: elegido.variable },
    };
  }
  writeFileSync(ruta, texto, { mode: 0o600 });
  return { nueva: true, aviso: 'puesto (fábrica)', modelo: null };
}

/**
 * Deja el `settings.yaml` de una casa con `agent-presets.default: modo-rata`
 * cuando el valor que hay es uno de los que HAY QUE migrar
 * ({@link PRESETS_A_MIGRAR}: el `standard` de fábrica, los tres modos que ya no
 * existen y los de serie del motor, que no resuelven con la raíz de serie
 * apagada). Un valor elegido por el usuario —uno de los 9 modos de la casa, o su
 * propio preset— se respeta: no se pelea con quien manda en su casa.
 * Se hace sobre el TEXTO (como `ponerModeloEnTexto`) para no llevarse por
 * delante comentarios ni el orden del documento.
 */
function ponerPresetPorDefecto(casa, preset = PRESET_POR_DEFECTO) {
  const ruta = join(casa, 'settings.yaml');
  if (!existsSync(ruta)) return { cambiado: false, motivo: 'la casa no tiene settings.yaml' };
  const texto = readFileSync(ruta, 'utf8');
  let actual;
  try {
    actual = (yaml.load(texto) ?? {})?.['agent-presets']?.default;
  } catch {
    return { cambiado: false, motivo: 'el settings.yaml de la casa no se puede leer como YAML: no lo toco' };
  }
  if (actual === preset) return { cambiado: false, motivo: 'ya estaba en ' + preset };
  if (typeof actual === 'string' && actual.trim() !== '' && !PRESETS_A_MIGRAR.includes(actual)) {
    return { cambiado: false, motivo: 'la casa tiene «' + actual + '» puesto a mano: se respeta' };
  }
  const bloque = 'agent-presets:\n  default: ' + preset + '\n';
  const bloqueActual = /^agent-presets:[ \t]*\n(?:[ \t]+[^\n]*\n)*/m;
  let nuevo;
  if (bloqueActual.test(texto)) nuevo = texto.replace(bloqueActual, bloque);
  else if (/^agent-presets:[ \t]*\S.*$/m.test(texto)) nuevo = texto.replace(/^agent-presets:[ \t]*\S.*$/m, bloque.trimEnd());
  else nuevo = (texto.trim() === '' ? '' : texto.replace(/\s*$/, '\n')) + '\n' + bloque;
  writeFileSync(ruta, nuevo, { mode: 0o600 });
  return { cambiado: true, antes: actual ?? '(no estaba)', motivo: (actual ?? '(no estaba)') + ' → ' + preset };
}

/**
 * El IDIOMA de la casa: español (R21). DSH guarda el idioma elegido en
 * `settings.yaml` → `locale.preference` (esquema del paquete
 * `@deepseek-ai/dsh-client-locale`: `{preference: <etiqueta BCP 47>}`) y, si no
 * hay nada apuntado, se lo pregunta al navegador. RATACODE es una casa en
 * español, así que se apunta «es» —pero SÓLO si la casa no ha elegido ya otro
 * idioma: la elección del usuario no se toca nunca—. Se escribe sobre el TEXTO,
 * como `ponerPresetPorDefecto`, para no llevarse por delante comentarios ni el
 * orden del documento.
 * @param casa - la casa de RATACODE.
 * @returns `{cambiado, motivo}`.
 */
function ponerIdiomaPorDefecto(casa, idioma = IDIOMA_POR_DEFECTO) {
  const ruta = join(casa, 'settings.yaml');
  if (!existsSync(ruta)) return { cambiado: false, motivo: 'la casa no tiene settings.yaml' };
  const texto = readFileSync(ruta, 'utf8');
  let actual;
  try {
    actual = (yaml.load(texto) ?? {})?.locale?.preference;
  } catch {
    return { cambiado: false, motivo: 'el settings.yaml de la casa no se puede leer como YAML: no lo toco' };
  }
  if (actual === idioma) return { cambiado: false, motivo: 'ya estaba en ' + idioma };
  if (typeof actual === 'string' && actual.trim() !== '') {
    return { cambiado: false, motivo: 'la casa tiene «' + actual + '» puesto a mano: se respeta' };
  }
  const bloque = 'locale:\n  preference: ' + idioma + '\n';
  const bloqueActual = /^locale:[ \t]*\n(?:[ \t]+[^\n]*\n)*/m;
  let nuevo;
  if (bloqueActual.test(texto)) nuevo = texto.replace(bloqueActual, bloque);
  else nuevo = (texto.trim() === '' ? '' : texto.replace(/\s*$/, '\n')) + '\n' + bloque;
  writeFileSync(ruta, nuevo, { mode: 0o600 });
  return { cambiado: true, antes: actual ?? '(no estaba)', motivo: (actual ?? '(no estaba)') + ' → ' + idioma };
}

/**
 * El ASPECTO de la casa (R21): los tres temas (RATACODE PINK, RATACODE YELLOW
 * y MINIMAL) los aplica la vía OFICIAL de temas de DSH, pero el motor no admite
 * un id de tema de fuera en su esquema de ajustes (`light`/`dark`/`system`,
 * `dsh-client-ui-theme`: `THEME_PREFERENCES`), así que CUÁL está puesto se
 * apunta en `<casa>\tema.txt` (una palabra) y la piel lo vuelve a poner al
 * abrir. Aquí sólo se deja apuntado el de fábrica: no se pisa una elección.
 */
function ponerTemaPorDefecto(casa, tema = TEMA_POR_DEFECTO) {
  const ruta = join(casa, 'tema.txt');
  if (existsSync(ruta)) {
    const leido = readFileSync(ruta, 'utf8').trim();
    if (TEMAS_DE_LA_CASA.includes(leido)) return { cambiado: false, motivo: 'ya estaba en ' + leido };
  }
  mkdirSync(casa, { recursive: true });
  writeFileSync(ruta, tema + '\n', { mode: 0o600 });
  return { cambiado: true, motivo: tema };
}

/**
 * Los modos, EN TODA CASA (no sólo al estrenar): copia los 9 de RATACODE,
 * borra los presets que salieron en versiones anteriores (el enlazador, el
 * promptista y el escritor: `copiarArbol` sólo escribe, nunca borra) y pasa
 * `agent-presets.default` a `modo-rata` si apunta a algo que ya no resuelve
 * (ver {@link ponerPresetPorDefecto}). La elección del usuario se respeta.
 */
function asegurarModos(casa) {
  const presets = join(casa, '.agent-presets');
  const cuenta = copiarArbol(MODOS_ORIGEN, presets, { copiados: 0, iguales: 0 });
  const borrados = [];
  for (const viejo of PRESETS_VIEJOS) {
    const ruta = join(presets, viejo);
    if (!existsSync(ruta)) continue;
    try {
      rmSync(ruta, { recursive: true, force: true });
      borrados.push(viejo);
    } catch { /* si no se deja borrar, el aviso de abajo lo dice */ }
  }
  return { cuenta, borrados, preset: ponerPresetPorDefecto(casa), presets };
}

// ── 3 · el espacio de trabajo ───────────────────────────────────────────────
/**
 * Registra una carpeta en el registro de espacios de DSH
 * (`<casa>\storages\workspace.json`), con el formato medido de
 * `@deepseek-ai/dsh-workspace` (`lib/types/spec.js`): dominio `workspace`
 * versión 2, tabla `workspaces` con `{path,title,sessionIds,createdAt,updatedAt}`
 * y el global `{initialized, workspaceIds, archivedSessionIds}` donde
 * `workspaceIds` es el orden de la barra lateral (el nuevo va el primero).
 *
 * La ruta se guarda CANÓNICA (`fs.realpath`), que es la única canon de
 * identidad del registro: si no, DSH crearía un segundo espacio para el mismo
 * sitio. Si el espacio ya está, no se toca (ni el orden ni el título).
 */
function registrarEspacio(casa, carpeta) {
  const canonica = realpathSync(carpeta);
  const ruta = join(casa, 'storages', 'workspace.json');
  let doc = null;
  if (existsSync(ruta)) {
    try { doc = JSON.parse(readFileSync(ruta, 'utf8')); } catch { doc = null; }
  }
  if (doc !== null && doc?.unit?.name !== 'workspace') doc = null;
  if (doc !== null && doc.unit.version !== 2) {
    return { registrado: false, motivo: 'el registro de espacios de esta casa es versión ' + doc.unit.version
      + ', y yo sé escribir la 2: no lo toco' };
  }
  if (doc === null) {
    doc = {
      unit: { name: 'workspace', version: 2 },
      global: { initialized: true, workspaceIds: [], archivedSessionIds: [] },
      tables: { workspaces: {} },
    };
  }
  doc.global = doc.global ?? {};
  if (!Array.isArray(doc.global.workspaceIds)) doc.global.workspaceIds = [];
  if (!Array.isArray(doc.global.archivedSessionIds)) doc.global.archivedSessionIds = [];
  doc.tables = doc.tables ?? {};
  doc.tables.workspaces = doc.tables.workspaces ?? {};
  for (const [id, registro] of Object.entries(doc.tables.workspaces)) {
    if (registro?.path === canonica) return { registrado: true, nuevo: false, id, canonica };
  }
  const id = randomUUID();
  const ahora = new Date().toISOString();
  doc.tables.workspaces[id] = {
    path: canonica,
    title: basename(canonica) || canonica,
    sessionIds: [],
    createdAt: ahora,
    updatedAt: ahora,
  };
  doc.global.workspaceIds = [id, ...doc.global.workspaceIds];
  doc.global.initialized = true;
  mkdirSync(dirname(ruta), { recursive: true });
  const temporal = ruta + '.' + process.pid + '.tmp';
  writeFileSync(temporal, JSON.stringify(doc, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporal, ruta);
  return { registrado: true, nuevo: true, id, canonica };
}

/** Comprueba que una carpeta existe y es una carpeta, o para con un mensaje claro. */
function exigirCarpeta(carpeta) {
  if (!existsSync(carpeta)) throw new Error('la carpeta de trabajo no existe: ' + carpeta);
  if (!statSync(carpeta).isDirectory()) throw new Error('la carpeta de trabajo no es una carpeta: ' + carpeta);
  return carpeta;
}

// ── 4 · el motor ────────────────────────────────────────────────────────────
function binDelMotor() {
  const require = createRequire(import.meta.url);
  const manifiesto = require.resolve('@deepseek-ai/dsh/package.json');
  const pkg = JSON.parse(readFileSync(manifiesto, 'utf8'));
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.dsh;
  if (!rel) throw new Error('el motor no declara su binario (¿instalación a medias?)');
  const bin = join(dirname(manifiesto), rel);
  if (!existsSync(bin)) throw new Error('no encuentro el motor en ' + bin);
  return { bin, version: pkg.version };
}

/**
 * El parche que fija el selector de carpeta EN LA WEB. `dsh-web-app` trae
 * `dsh-host-directory-picker-auto`, que resuelve «native» en Windows y abre el
 * diálogo del sistema: una ventana que quien maneja RATACODE desde fuera (un
 * agente, un chat) no puede ver ni contestar. DSH documenta el punto de
 * intercambio: componer el backend «browse» directamente. Hay que montar las
 * DOS caras (backend de host + superficie de cliente); con una sola, la
 * ventana no sale o la fila «Añadir espacio…» no aparece.
 */
function parcheSelectorCarpeta(casa) {
  const ruta = join(casa, 'perfiles-parche', 'web-selector-carpeta.yml');
  escribir(ruta, [
    '# RATACODE · el selector de carpeta, EN LA WEB (nunca una ventana de Windows).',
    '# Se apaga la fila adaptativa de dsh-web-app y se compone el par «browse».',
    '- id: directory-picker',
    '  disabled: true',
    '',
    '- insert:',
    "    - id: directory-picker-browse",
    "      name: '@deepseek-ai/dsh-host-directory-picker-browse'",
    '',
    "    - id: ui-directory-picker-browse",
    "      name: '@deepseek-ai/dsh-client-ui-directory-picker-browse'",
    '',
  ].join('\n'));
  return ruta;
}

/**
 * Resuelve `--modelo X` contra los proveedores que la casa declara.
 * Acepta `proveedor:modelo` y, si no, busca qué proveedor declara ese modelo.
 * Si no lo declara ninguno, usa el proveedor por defecto con ese modelo.
 */
function resolverModelo(casa, pedido, porDefecto) {
  if (pedido.includes(':')) {
    const [proveedor, ...resto] = pedido.split(':');
    return { proveedor, modelo: resto.join(':') };
  }
  const ajustes = leerAjustes(casa) ?? {};
  const proveedores = ajustes?.['llm-pi-ai']?.providers ?? {};
  for (const [proveedor, perfil] of Object.entries(proveedores)) {
    const modelos = Array.isArray(perfil?.models) ? perfil.models : [];
    for (const m of modelos) {
      if ((typeof m === 'string' ? m : m?.id) === pedido) return { proveedor, modelo: pedido };
    }
  }
  const actual = ajustes?.['agent-default-model'] ?? porDefecto ?? PROVEEDORES_POR_ORDEN[0];
  return { proveedor: actual.provider ?? actual.proveedor, modelo: pedido };
}

/**
 * El parche de `--modelo`: el documento de ajustes del motor pasa a ser una
 * COPIA con el modelo cambiado. Así el encargo usa el modelo pedido sin tocar
 * el `settings.yaml` del usuario (la capa de usuario de DSH manda sobre la
 * composición, así que un parche de composición no bastaría).
 */
function parcheModelo(casa, eleccion) {
  const original = join(casa, 'settings.yaml');
  const texto = existsSync(original) ? readFileSync(original, 'utf8') : '';
  const copia = join(casa, 'perfiles-parche', 'headless-' + process.pid + '-settings.yaml');
  escribir(copia, ponerModeloEnTexto(texto, eleccion.proveedor, eleccion.modelo));
  const ruta = join(casa, 'perfiles-parche', 'headless-modelo.yml');
  escribir(ruta, [
    '# RATACODE · sólo para ESTE encargo: los ajustes son una copia con el modelo',
    '# cambiado, así no se toca el modelo que el usuario tenga guardado.',
    '- id: settings',
    '  config:',
    '    path: ' + JSON.stringify(copia),
    '',
  ].join('\n'));
  return { parche: ruta, copia };
}

function matarArbol(hijo) {
  if (!hijo || hijo.killed || hijo.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + '/T /F'], { windowsHide: true, stdio: 'ignore' });
    } else hijo.kill('SIGTERM');
  } catch { /* el hijo ya se fue */ }
}

/**
 * ¿Hay alguien escuchando ya en ese puerto? Se pregunta ANTES de arrancar el
 * motor: si está ocupado, el fallo del motor son 45 líneas de traza en inglés
 * con rutas internas (`EADDRINUSE`), y el usuario nuevo se come todas.
 * @param {number} puerto - puerto a probar.
 * @param {string} host - a quién preguntar (loopback).
 * @returns {Promise<boolean>}
 */
function puertoOcupado(puerto, host = '127.0.0.1') {
  return new Promise((listo) => {
    const s = connect({ host, port: puerto });
    s.setTimeout(1000);
    const terminar = (ocupado) => { s.destroy(); listo(ocupado); };
    s.once('connect', () => terminar(true));
    s.once('error', () => terminar(false));
    s.once('timeout', () => terminar(false));
  });
}

/**
 * ¿Hay credencial para este proveedor? Se mira el ENTORNO y, si el fichero de
 * claves de la casa existe, se da por buena (la resuelve el motor). Nunca se lee
 * el valor de nada.
 * @param {string} casa - la casa de RATACODE.
 * @param {object} ajustes - el settings.yaml ya leído.
 * @param {string} proveedor - la ruta del proveedor.
 * @returns {{nombre: string, esta: boolean, enLaCasa: boolean}|null} null si la ruta no declara credencial.
 */
function credencialDe(casa, ajustes, proveedor) {
  const enLaCasa = existsSync(join(casa, '.credentials.yaml'));
  if (proveedor === 'deepseek-official') {
    const nombre = ajustes?.['llm-deepseek']?.apiKeyEnv ?? 'DEEPSEEK_API_KEY';
    return { nombre, esta: hayVariable(nombre), enLaCasa };
  }
  const perfil = ajustes?.['llm-pi-ai']?.providers?.[proveedor];
  const nombre = perfil && typeof perfil === 'object' ? perfil.apiKeyEnv : undefined;
  if (typeof nombre !== 'string' || nombre.trim() === '') return null;
  return { nombre, esta: hayVariable(nombre), enLaCasa };
}

/** Las claves ya NO vienen del entorno: el motor arranca sin ellas (ver `entornoSinClaves`). */
function hayVariable() {
  return false;
}

/** Dónde el panel deja dicho que el usuario ya vio el aviso de migración. */
function rutaAvisoVisto(casa) {
  return join(casa, 'aviso-claves-visto');
}

/** Dónde se dejan los NOMBRES de las variables de claves que hay en Windows. */
function rutaAvisoClaves(casa) {
  return join(casa, 'aviso-claves.txt');
}

/**
 * R22 §4 · La migración, dicha UNA vez. La primera vez que una casa arranca con
 * esta versión, si en Windows hay variables de claves de proveedores (de las que
 * RATACODE ya NO hace caso), se dejan sus NOMBRES —nunca sus valores— en
 * `<casa>\aviso-claves.txt`, y el panel lo enseña en una línea. El panel
 * comprueba además que esa clave no esté ya puesta en la casa: si está, no hay
 * nada que avisar. Cuando el usuario lo cierra, queda `<casa>\aviso-claves-visto`
 * y no vuelve.
 * @param {string} casa - la casa de RATACODE.
 * @returns {string[]} los nombres encontrados (para el registro).
 */
function anotarVariablesDeClaves(casa) {
  const ruta = rutaAvisoClaves(casa);
  if (existsSync(rutaAvisoVisto(casa))) {
    try { rmSync(ruta, { force: true }); } catch { /* da igual */ }
    return [];
  }
  const nombres = new Set([
    'B_AI_API_KEY', 'BAI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
    'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'SAMBANOVA_API_KEY', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_API_TOKEN',
  ]);
  const ajustes = leerAjustes(casa) ?? {};
  const nativa = ajustes?.['llm-deepseek']?.apiKeyEnv;
  if (typeof nativa === 'string' && nativa.trim() !== '') nombres.add(nativa.trim());
  for (const perfil of Object.values(ajustes?.['llm-pi-ai']?.providers ?? {})) {
    if (perfil && typeof perfil.apiKeyEnv === 'string' && perfil.apiKeyEnv.trim() !== '') nombres.add(perfil.apiKeyEnv.trim());
  }
  // SÓLO se mira si la variable existe: su valor no se lee ni se copia a ningún sitio.
  const puestas = [...nombres].filter((nombre) => {
    const valor = process.env[nombre];
    return typeof valor === 'string' && valor.trim() !== '';
  });
  try {
    if (puestas.length === 0) rmSync(ruta, { force: true });
    else writeFileSync(ruta, puestas.join('\n') + '\n', { mode: 0o600 });
  } catch { /* el aviso es una ayuda, no un requisito para arrancar */ }
  return puestas;
}

/**
 * El entorno del motor SIN las variables de claves de proveedores. Si llegan del
 * entorno, el motor las da por puestas y NO deja editarlas en Ajustes › Models.
 * La única fuente de claves es la casa (lo que se pega en Ajustes › Models).
 */
function entornoSinClaves(casa) {
  const fuera = new Set(['B_AI_API_KEY', 'BAI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
    'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'SAMBANOVA_API_KEY', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_API_TOKEN']);
  const ajustes = leerAjustes(casa) ?? {};
  const nativa = ajustes?.['llm-deepseek']?.apiKeyEnv;
  if (typeof nativa === 'string') fuera.add(nativa);
  for (const perfil of Object.values(ajustes?.['llm-pi-ai']?.providers ?? {})) {
    if (perfil && typeof perfil.apiKeyEnv === 'string') fuera.add(perfil.apiKeyEnv);
  }
  const env = { ...process.env, DSH_HOME: casa };
  for (const k of Object.keys(env)) if (fuera.has(k.toUpperCase())) delete env[k];
  return env;
}

// ── el encargo sin pantalla ─────────────────────────────────────────────────
function correrHeadless({ motor, casa, carpeta, perfilHeadless, encargo, modelo }) {
  const parches = [];
  let temporales = [];
  if (modelo !== null) {
    const ajustes = leerAjustes(casa) ?? {};
    const porDefecto = ajustes?.['agent-default-model'];
    const eleccion = resolverModelo(casa, modelo, porDefecto);
    const { parche, copia } = parcheModelo(casa, eleccion);
    parches.push(parche);
    temporales = [copia, parche];
    process.stdout.write('RATACODE · headless · modelo de este encargo: ' + eleccion.modelo
      + ' (proveedor ' + eleccion.proveedor + ')\n');
  }
  process.stdout.write('RATACODE · headless · ' + motor.version + ' · casa: ' + casa + '\n');
  process.stdout.write('RATACODE · headless · carpeta de trabajo: ' + carpeta + '\n');
  process.stdout.write('RATACODE · headless · perfil: ' + perfilHeadless + '\n');

  const args = [motor.bin, '--profile', 'headless'];
  for (const p of parches) args.push('--patch', p);
  args.push(encargo);
  const empezo = Date.now();
  anotar(casa, 'RATACODE headless arranca · carpeta ' + carpeta);
  const hijo = spawn(process.execPath, args, {
    cwd: carpeta,
    env: entornoSinClaves(casa),
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  const limpiar = () => {
    for (const ruta of temporales) {
      try { rmSync(ruta, { force: true }); } catch { /* da igual: son temporales */ }
    }
    temporales = [];
  };
  hijo.on('error', (e) => {
    process.stderr.write('RATACODE · el motor no arrancó: ' + e.message + '\n');
    anotar(casa, 'el motor headless no arrancó · ' + e.message);
    limpiar();
    process.exitCode = 1;
  });
  hijo.on('exit', (codigo, senal) => {
    anotar(casa, 'el motor headless se cerró · ' + cierre(codigo, senal)
      + ' · vivió ' + Math.round((Date.now() - empezo) / 1000) + ' s');
    limpiar();
    process.exitCode = typeof codigo === 'number' ? codigo : 1;
  });
  process.on('SIGINT', () => { anotar(casa, 'paro el motor headless (SIGINT)'); matarArbol(hijo); limpiar(); process.exit(130); });
  process.on('SIGTERM', () => { anotar(casa, 'paro el motor headless (SIGTERM)'); matarArbol(hijo); limpiar(); process.exit(143); });
}

// ── el registro de la casa ──────────────────────────────────────────────────
/** La ruta del registro: `<casa>\ratacode.log`. */
function rutaDelLog(casa) {
  return join(casa, 'ratacode.log');
}

/**
 * Deja una línea en `<casa>\ratacode.log`. Sirve para saber POR QUÉ se cerró
 * el motor: hasta hoy, una instancia que se caía sola no dejaba ni rastro.
 * Si el registro no se puede escribir, eso NO para el motor.
 */
function anotar(casa, texto) {
  try {
    mkdirSync(casa, { recursive: true });
    appendFileSync(rutaDelLog(casa), new Date().toISOString() + ' · ' + texto + '\n');
  } catch { /* el registro es una ayuda, no un requisito */ }
}

/** El texto de un cierre, con código de salida y señal. */
function cierre(codigo, senal) {
  // En Windows, un proceso matado a la fuerza no deja señal: deja 0xFFFFFFFF.
  const nota = codigo === 4294967295 ? ' (0xFFFFFFFF: matado a la fuerza)' : '';
  return 'código ' + (codigo === null || codigo === undefined ? '(ninguno)' : codigo) + nota
    + ' · señal ' + (senal === null || senal === undefined ? '(ninguna)' : senal);
}

// ── el panel ────────────────────────────────────────────────────────────────
/**
 * Espera a que el puerto de la URL conteste DE VERDAD. DSH imprime la URL en
 * cuanto monta el servidor, pero hasta que el puerto no escucha esa URL no
 * abre: escribir `url.txt` antes deja un fichero que no lleva a ninguna parte.
 */
function esperarPuerto(url, plazoMs = 20000) {
  return new Promise((listo) => {
    let host;
    let puerto;
    try {
      const u = new URL(url);
      host = u.hostname === 'localhost' ? '127.0.0.1' : u.hostname.replace(/^\[|\]$/g, '');
      puerto = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    } catch {
      listo(false);
      return;
    }
    if (!Number.isInteger(puerto) || puerto <= 0) { listo(false); return; }
    const limite = Date.now() + plazoMs;
    const intento = () => {
      const s = connect({ host, port: puerto });
      s.setTimeout(1000);
      const fallo = () => {
        s.destroy();
        if (Date.now() >= limite) { listo(false); return; }
        setTimeout(intento, 150);
      };
      s.once('connect', () => { s.destroy(); listo(true); });
      s.once('error', fallo);
      s.once('timeout', fallo);
    };
    intento();
  });
}

function correrPanel({ motor, casa, carpeta, ordenes }) {
  const parche = parcheSelectorCarpeta(casa);
  const conClavesEnWindows = anotarVariablesDeClaves(casa);
  const args = [motor.bin, '--profile', 'web', '--patch', parche, '--port', String(ordenes.puerto)];
  if (!ordenes.abrir) args.push('--no-open');
  const rutaUrl = join(casa, 'url.txt');
  const empezo = Date.now();
  anotar(casa, 'RATACODE arranca · puerto ' + ordenes.puerto + ' · carpeta ' + carpeta
    + (conClavesEnWindows.length > 0 ? ' · variables de claves en Windows: ' + conClavesEnWindows.join(', ') : ''));
  if (conClavesEnWindows.length > 0) {
    process.stdout.write('RATACODE · en Windows tienes ' + conClavesEnWindows.join(', ')
      + ': RATACODE ya no las usa (las claves se ponen en Ajustes › Models). El panel te lo recuerda una vez.\n');
  }
  const hijo = spawn(process.execPath, args, {
    cwd: carpeta,
    env: entornoSinClaves(casa),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let visto = '';
  let anunciada = false;
  /** La URL está dicha y el puerto escucha: ahora sí se escribe url.txt. */
  const cuandoEscuche = async (url) => {
    const escucha = await esperarPuerto(url);
    if (hijo.exitCode !== null) return; // se cerró mientras mirábamos
    if (!escucha) {
      process.stderr.write('RATACODE · el motor dio su URL, pero el puerto ' + ordenes.puerto
        + ' no contesta: NO escribo url.txt (' + url + ')\n');
      anotar(casa, 'el motor dio URL pero el puerto no contestó en 20 s: no se escribió url.txt');
      return;
    }
    try {
      mkdirSync(casa, { recursive: true });
      // La URL de la vez anterior se quita AQUÍ, no al arrancar: si esta
      // instancia no llega a escuchar, la del panel que ya estaba vivo no se
      // toca (antes, un segundo `ratacode` sobre la misma casa dejaba al primero
      // sin url.txt antes de saber siquiera si podría escuchar).
      try { rmSync(rutaUrl, { force: true }); } catch { /* no había nada que borrar */ }
      writeFileSync(rutaUrl, url + '\n');
    } catch (e) {
      process.stderr.write('RATACODE · no pude escribir ' + rutaUrl + ': ' + e.message + '\n');
      anotar(casa, 'no se pudo escribir url.txt · ' + e.message);
    }
    process.stdout.write('\nRATACODE · ABIERTO EN: ' + url + '\n');
    process.stdout.write('RATACODE · la URL (con su token) está guardada en: ' + rutaUrl + '\n\n');
    anotar(casa, 'el motor escucha en el puerto ' + ordenes.puerto + ': url.txt escrito');
  };
  const cazar = (trozo) => {
    if (anunciada) return;
    visto = (visto + trozo).slice(-8192);
    const m = /dsh web:\s+(\S+)/.exec(visto);
    if (!m) return;
    anunciada = true;
    cuandoEscuche(m[1]);
  };
  hijo.stdout.setEncoding('utf8');
  hijo.stdout.on('data', (t) => { process.stdout.write(t); cazar(t); });
  hijo.stderr.setEncoding('utf8');
  hijo.stderr.on('data', (t) => { process.stderr.write(t); cazar(t); });
  hijo.on('error', (e) => {
    process.stderr.write('RATACODE · el motor no arrancó: ' + e.message + '\n');
    anotar(casa, 'el motor no arrancó · ' + e.message);
    process.exitCode = 1;
  });
  hijo.on('exit', (codigo, senal) => {
    anotar(casa, 'el motor se cerró · ' + cierre(codigo, senal)
      + ' · URL ' + (anunciada ? 'sí' : 'no')
      + ' · vivió ' + Math.round((Date.now() - empezo) / 1000) + ' s');
    if (!anunciada) {
      process.stderr.write('RATACODE · el motor se cerró sin dar URL (' + cierre(codigo, senal) + '). '
        + 'Si el puerto ' + ordenes.puerto + ' está ocupado, prueba: ratacode --port 3778\n');
    } else if (senal) {
      process.stderr.write('RATACODE · el motor se cerró por la señal ' + senal + '\n');
    }
    process.exitCode = typeof codigo === 'number' ? codigo : 1;
  });

  const fuera = (motivo) => {
    if (hijo.exitCode === null && !hijo.killed) anotar(casa, 'paro el motor (' + motivo + ')');
    matarArbol(hijo);
  };
  process.on('SIGINT', () => { fuera('SIGINT'); process.exit(130); });
  process.on('SIGTERM', () => { fuera('SIGTERM'); process.exit(143); });
  process.on('exit', (codigo) => { fuera('RATACODE se cierra, código ' + codigo); });
}

/**
 * `ratacode mcp`: el servidor MCP, como subcomando del mismo binario. Se lanza
 * como hijo con la entrada y la salida HEREDADAS: por stdio, stdout es del
 * protocolo MCP y RATACODE no puede escribir ni una letra ahí.
 *
 * Antes de arrancarlo se estrena la casa (si es nueva) para que el MCP tenga
 * los mismos proveedores y modelos que la web, pero TODO lo que cuenta
 * RATACODE va a stderr.
 */
function correrMcp({ casa, argv }) {
  const bin = join(PAQUETE, 'mcp', 'bin', 'ratacode-mcp.js');
  if (!existsSync(bin)) {
    process.stderr.write('RATACODE · no encuentro el servidor MCP en ' + bin
      + ' (¿instalación sin la carpeta mcp?)\n');
    process.exitCode = 1;
    return;
  }
  // `--help` y `--status` no arrancan nada: no se toca la casa (estrenarla en un
  // «--help» sería un efecto raro, y encima fuera de donde el usuario mira).
  const soloMira = argv.some((a) => a === '-h' || a === '--help' || a === '--status');
  if (!soloMira) {
    const estreno = estrenarCasa(casa, process.env);
    // Los 9 modos, también en una casa que ya existía: el MCP compone sesiones
    // por el mismo camino que el panel y necesita el mismo roster.
    const modos = asegurarModos(casa);
    process.stderr.write('RATACODE · casa ' + (estreno.nueva ? 'NUEVA estrenada: ' : 'ya existía: ') + casa
      + ' · modos por defecto: ' + PRESET_POR_DEFECTO
      + (modos.borrados.length > 0 ? ' · fuera los viejos: ' + modos.borrados.join(', ') : '') + '\n');
  }
  const hijo = spawn(process.execPath, [bin, ...argv], { env: entornoSinClaves(casa), stdio: 'inherit', windowsHide: true });
  hijo.on('error', (e) => {
    process.stderr.write('RATACODE · el MCP no arrancó: ' + e.message + '\n');
    process.exitCode = 1;
  });
  hijo.on('exit', (codigo) => { process.exitCode = typeof codigo === 'number' ? codigo : 1; });
  const fuera = () => { matarArbol(hijo); };
  process.on('SIGINT', () => { fuera(); process.exit(130); });
  process.on('SIGTERM', () => { fuera(); process.exit(143); });
  process.on('exit', fuera);
}

async function main() {
  exigirNode();
  const ordenes = leerOrdenes(process.argv.slice(2));
  if (ordenes.ayuda) {
    process.stdout.write(uso());
    return;
  }
  const casa = ordenes.casa ?? resolve(process.env.RATACODE_HOME || join(homedir(), '.ratacode'));
  if (ordenes.modo === 'mcp') {
    correrMcp({ casa, argv: ordenes.mcpArgv });
    return;
  }
  const perfilWeb = join(casa, 'profiles', 'web');
  const perfilHeadless = join(casa, 'profiles', 'headless');
  const motor = binDelMotor();

  const cuenta = copiarArbol(PIEL_ORIGEN, join(perfilWeb, 'node_modules', NOMBRE_PLUGIN), { copiados: 0, iguales: 0 });
  // El texto de la conexión viaja CON el plugin: la piel lo sirve en
  // /ratacode/handshake (Ajustes > Conexiones) y, copiada dentro del perfil, no
  // tiene el repositorio al lado. Se copia en <plugin>\apreton\.
  const cuentaApreton = copiarArbol(APRETON_ORIGEN, join(perfilWeb, 'node_modules', NOMBRE_PLUGIN, 'apreton'), { copiados: 0, iguales: 0 });
  // Y la ruta de ESTA instalación (la carpeta del paquete, con `mcp\tunel.mjs`
  // dentro), para que los dos comandos del MCP que enseña Ajustes > Conexiones
  // lleven la ruta de verdad y no un «<ruta>» que el usuario tenga que buscar.
  writeFileSync(join(perfilWeb, 'node_modules', NOMBRE_PLUGIN, 'instalacion.txt'), PAQUETE + '\n');
  const capaWeb = prepararPerfil(perfilWeb, 'dsh-profile-web',
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', NOMBRE_PLUGIN], 'live');
  prepararPerfil(perfilHeadless, 'dsh-profile-headless',
    ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'], 'startup');
  const estreno = estrenarCasa(casa, process.env);
  // Los 9 modos se copian SIEMPRE, también en una casa que ya existía: los de
  // versiones anteriores salieron con dos campos obligatorios sin poner y NO
  // cargaban («invalid config: - $.x missing required value»). `asegurarModos`
  // sólo escribe lo que cambia, borra los presets de RATACODE que ya no existen
  // (enlazador, promptista, escritor) y deja `agent-presets.default` en
  // modo-rata; los presets del USUARIO no se rozan.
  const modos = asegurarModos(casa);
  // R21 · el español de la casa: se apunta `locale.preference: es` si la casa no
  // ha elegido ya otro idioma (el inglés y el chino siguen en Ajustes › General ›
  // Language, y la elección del usuario se respeta siempre).
  const idioma = ponerIdiomaPorDefecto(casa);
  // R21 · el aspecto: se apunta el tema de fábrica (RATACODE PINK) si la casa no
  // tiene ninguno apuntado. La elección del usuario no se toca.
  const aspecto = ponerTemaPorDefecto(casa);

  const carpeta = exigirCarpeta(ordenes.carpeta ?? process.cwd());
  const espacio = registrarEspacio(casa, carpeta);

  process.stdout.write('RATACODE · ' + (motor.version ? 'v' + motor.version : '')
    + (ordenes.modo === 'headless' ? ' · headless' : ' · puerto ' + ordenes.puerto) + '\n');
  process.stdout.write('RATACODE · casa: ' + casa + (estreno.nueva ? ' (NUEVA)' : ' (ya existía)')
    + ' · aviso Internal Testing: ' + estreno.aviso + '\n');
  process.stdout.write('RATACODE · espacio de trabajo: ' + carpeta
    + (espacio.registrado
      ? (espacio.nuevo ? ' (registrado en el registro de espacios)' : ' (ya estaba registrado)')
      : ' (NO registrado: ' + espacio.motivo + ')') + '\n');
  process.stdout.write('RATACODE · modelo por defecto: ' + (estreno.modelo
    ? estreno.modelo.modelo + ' (proveedor ' + estreno.modelo.proveedor + ', porque existe '
      + estreno.modelo.variable + ' en el entorno)'
    : (estreno.nueva
      ? 'el de fábrica (ninguna clave en el entorno: B_AI_API_KEY, OPENROUTER_API_KEY ni DEEPSEEK_API_KEY)'
      : 'el que ya tuviera la casa (no se toca settings.yaml)')) + '\n');
  process.stdout.write('RATACODE · piel: ' + cuenta.copiados + ' fichero(s) puesto(s), ' + cuenta.iguales + ' ya estaban igual'
    + ' · conexiones: ' + cuentaApreton.copiados + ' puesto(s), ' + cuentaApreton.iguales + ' igual\n');
  process.stdout.write('RATACODE · modos: ' + modos.cuenta.copiados + ' fichero(s) puesto(s), ' + modos.cuenta.iguales
    + ' ya estaban igual en ' + modos.presets
    + (modos.borrados.length > 0 ? ' · fuera los viejos: ' + modos.borrados.join(', ') : '')
    + ' · por defecto: ' + (modos.preset.cambiado ? 'puesto en ' + PRESET_POR_DEFECTO + ' (' + modos.preset.motivo + ')' : modos.preset.motivo) + '\n');
  if (capaWeb.reparado) {
    process.stdout.write('RATACODE · tu perfil tenía el parche roto (un `[]` pegado delante de las filas, de la 0.2.0):'
      + ' reparado · ' + capaWeb.motivo + '\n');
  }
  process.stdout.write('RATACODE · proveedores: ' + (estreno.nueva
    ? 'Ajustes › Models: las 8 APIs con clave (B.AI, OpenRouter, Groq, Google Gemini, NVIDIA NIM, SambaNova, Cloudflare Workers AI y DeepSeek nativo) · Ajustes › Modelos locales: Ollama y LM Studio, sin clave'
    : 'los que ya tuviera la casa (no se toca settings.yaml): añade a mano los que falten de las 8 APIs') + '\n');
  process.stdout.write('RATACODE · manos: el texto de la conexión y el MCP viven en Ajustes › Conexiones\n');
  process.stdout.write('RATACODE · idioma: ' + (idioma.cambiado
    ? 'español puesto por defecto (' + idioma.motivo + ')'
    : 'el que ya tuviera la casa (' + idioma.motivo + ')')
    + ' · inglés y chino siguen en Ajustes › General › Language\n');
  process.stdout.write('RATACODE · aspecto: ' + (aspecto.cambiado
    ? 'RATACODE PINK puesto por defecto (' + aspecto.motivo + ')'
    : 'el que ya tuviera la casa (' + aspecto.motivo + ')')
    + ' · los tres (PINK, YELLOW, MINIMAL) en Ajustes › General › Aspecto\n');

  if (ordenes.modo === 'headless') {
    // Antes de arrancar el motor, mira si hay con qué: si el modelo por defecto
    // apunta a un proveedor sin clave por ningún lado, el motor falla en inglés
    // y con tripas (`MISSING_CREDENTIAL: llm-pi-ai: no credential for provider
    // route "b-ai"…`). Mejor dos líneas en español y no arrancar nada.
    const ajustesCasa = leerAjustes(casa) ?? {};
    const porDefecto = ajustesCasa['agent-default-model'] ?? {};
    const eleccion = ordenes.modelo === null
      ? { proveedor: porDefecto.provider, modelo: porDefecto.model }
      : resolverModelo(casa, ordenes.modelo, porDefecto);
    if (typeof eleccion.proveedor === 'string' && eleccion.proveedor !== '') {
      const credencial = credencialDe(casa, ajustesCasa, eleccion.proveedor);
      if (credencial !== null && !credencial.esta && !credencial.enLaCasa) {
        process.stderr.write([
          '',
          'RATACODE · PARA.',
          '',
          '  El modelo «' + (eleccion.modelo ?? '(sin nombre)') + '» va por el proveedor «' + eleccion.proveedor
            + '», y no encuentro su clave (' + credencial.nombre + ').',
          '  Ponla en la web (Ajustes → Models: queda en ' + join(casa, '.credentials.yaml')
            + ') o expórtala: ' + credencial.nombre + '=... (y vuelve a lanzarlo).',
          '',
        ].join('\n'));
        process.exitCode = 1;
        return;
      }
    }
    correrHeadless({ motor, casa, carpeta, perfilHeadless, encargo: ordenes.encargo, modelo: ordenes.modelo });
    return;
  }
  // El puerto, ANTES de arrancar el motor: si está ocupado, el fallo crudo del
  // motor (EADDRINUSE en inglés, 45 líneas) no le sirve a nadie.
  if (ordenes.puerto !== 0 && await puertoOcupado(ordenes.puerto)) {
    process.stderr.write([
      '',
      'RATACODE · PARA.',
      '',
      '  El puerto ' + ordenes.puerto + ' ya está ocupado (¿tienes otro RATACODE abierto?).',
      '  Prueba con otro:  ratacode --port ' + (ordenes.puerto === 3778 ? 3779 : 3778),
      '  O mira quién lo tiene:  Get-NetTCPConnection -LocalPort ' + ordenes.puerto,
      '',
    ].join('\n'));
    process.exitCode = 1;
    return;
  }
  correrPanel({ motor, casa, carpeta, ordenes });
}

main().catch((e) => {
  process.stderr.write('RATACODE · ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exitCode = 1;
});
