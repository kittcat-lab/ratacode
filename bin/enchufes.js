/**
 * LOS ENCHUFES DE SERIE (R32, rehechos para DSH 0.2 en la 0.3).
 *
 * Lo que RATACODE trae puesto además del motor, y cómo se apaga cada cosa.
 * Hay tres clases de enchufe:
 *
 *   · `filas`  — filas del cargador que RATACODE añade AL FINAL del
 *                `cordis.patch.yml` del perfil, siempre dentro de un bloque
 *                «- insert:» (una fila suelta con `name` se ignora sin avisar,
 *                medido el 2-oct-2026 en la 0.1.5). Si el fichero ya tiene una
 *                fila con ese id, la del usuario manda y no se toca: así el
 *                interruptor de la página Plugins del motor (que escribe
 *                `disabled` en «la última fila que coincide» del parche del
 *                perfil) sigue valiendo.
 *   · `bundle` — un bundle opcional que el motor YA trae instalado y apagado
 *                (`OPTIONAL_BUNDLES` de `dsh-app-boot`). Se selecciona en
 *                `package.json` › `dsh.profile.bundles` del perfil UNA vez; si
 *                luego el usuario lo quita en la página Plugins, se respeta (se
 *                apunta en `package.json` › `ratacode.deSerie`).
 *   · `motor`  — algo que el motor ya monta de serie (la terminal del panel
 *                lateral): no se añade nada; apagarlo es apagar su fila.
 *
 * Se apagan en `<casa>\ratacode.yaml` › `enchufes.<clave>: false` (y los que
 * vienen apagados se encienden con `true`). Lo apagado que ya esté en el perfil
 * se apaga con un parche de arranque (`<casa>\perfiles-parche\<perfil>-enchufes.yml`,
 * `disabled: true` por id): el `cordis.patch.yml` del usuario no se reescribe.
 *
 * Todos los paquetes `@deepseek-ai/*` van en la MISMA versión que el motor: los
 * que trae el paquete de RATACODE están fijados en su `package.json` (y los
 * vigila `pruebas/versiones.test.mjs`), y los que se instalan en el perfil
 * (navegador, codex, claude) se piden con la versión del motor que esté
 * instalado. Con una versión distinta el motor no arranca.
 *
 * Por qué el navegador se instala en el perfil y no viene en el paquete: el
 * cargador de la 0.2 sólo importa lo que está en el perfil o lo que trae el
 * propio motor. Un `@deepseek-ai/dsh-browser-use` junto al motor, pero fuera de
 * su árbol, sale «failed to import» (medido).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

/** El parche de un perfil puede llevar `!!js`: aquí sólo se leen ids, así que vale null. */
const ESQUEMA = yaml.DEFAULT_SCHEMA.extend([new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: () => null })]);

/** El puente de Codex fija 0.153.4 y OpenAI la rechaza: se fuerza ésta en el perfil (pnpm 11 sólo lo lee del workspace). */
export const CODEX_FORZADO = '0.160.0';

/**
 * La lista. `perfiles`: dónde va cada uno (`web`, `headless`). `filas` recibe
 * el nombre del perfil. `paquetes`: lo que hay que instalar en el perfil con
 * `dsh plugin add` (sin versión: se pide la del motor).
 */
export const ENCHUFES = [
  {
    clave: 'navegador', tipo: 'filas', porDefecto: true, perfiles: ['web', 'headless'],
    ids: ['browser-use', 'browser-use-playwright'],
    paquetes: ['@deepseek-ai/dsh-browser-use', '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'],
    texto: 'el navegador (Playwright, con su propio Chrome; se instala solo)',
    filas: (perfil) => `
# RATACODE · enchufe «navegador»: el navegador del motor (dsh-browser-use) con Playwright por MCP.
- insert:
    - id: browser-use
      name: '@deepseek-ai/dsh-browser-use'
    - id: browser-use-playwright
      name: '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'
      config:
        mode: launch
        headless: ${perfil === 'web' ? 'false' : 'true'}
        toolCallTimeoutMs: 90000
`,
  },
  {
    clave: 'reloj', tipo: 'filas', porDefecto: true, perfiles: ['web', 'headless'], ids: ['time-context'],
    texto: 'la hora y la zona en cada paso',
    filas: () => `
# RATACODE · enchufe «reloj»: la hora y la zona en cada paso.
- insert:
    - id: time-context
      name: '@deepseek-ai/dsh-time-context'
      config:
        timeZone: Europe/Madrid
`,
  },
  {
    // Sólo en el panel: sin pantalla no hay `sessionController` y la fila se queda
    // esperando (medido con el perfil headless de la 0.2.0-rc.2).
    clave: 'agenda', tipo: 'filas', porDefecto: true, perfiles: ['web'], ids: ['schedule'],
    texto: 'schedule_create / schedule_list / schedule_delete',
    filas: () => `
# RATACODE · enchufe «agenda»: schedule_create / schedule_list / schedule_delete.
- insert:
    - id: schedule
      name: '@deepseek-ai/dsh-schedule'
`,
  },
  {
    clave: 'preguntar', tipo: 'filas', porDefecto: true, perfiles: ['web', 'headless'], ids: ['tool-ask-user'],
    texto: 'ask_user_question (sin pantalla falla con NO_PROVIDER, no se cuelga)',
    filas: () => `
# RATACODE · enchufe «preguntar»: ask_user_question (sin pantalla falla con NO_PROVIDER, no se cuelga).
- insert:
    - id: tool-ask-user
      name: '@deepseek-ai/dsh-tool-ask-user'
`,
  },
  {
    clave: 'voz', tipo: 'bundle', porDefecto: true, perfiles: ['web'],
    bundle: '@deepseek-ai/dsh-experimental-voice-input-bundle',
    texto: 'dictar con la voz (SenseVoice en local; baja su motor la primera vez)',
  },
  {
    clave: 'terminal', tipo: 'motor', porDefecto: true, perfiles: ['web'], ids: ['ui-sidebar-terminal'],
    texto: 'la terminal en el panel lateral (dsh-client-ui-sidebar-terminal)',
  },
  {
    clave: 'codex', tipo: 'filas', porDefecto: true, perfiles: ['web', 'headless'], ids: ['tool-subagent-codex'],
    paquetes: ['@deepseek-ai/dsh-subagent-codex'],
    texto: 'Codex de verdad como subagente (se instala solo; usa el login de Codex de tu PC)',
    filas: () => `
# RATACODE · enchufe «codex»: Codex de verdad como subagente (usa el login de Codex de tu PC).
- insert:
    - id: tool-subagent-codex
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: codex
        toolName: subagent_codex
        backgroundMode: one-shot
        maxDepth: provider-managed
`,
  },
  {
    clave: 'claude', tipo: 'filas', porDefecto: false, perfiles: ['web', 'headless'], ids: ['tool-subagent-claude'],
    paquetes: ['@deepseek-ai/dsh-subagent-claude-code'],
    texto: 'Claude Code de verdad como subagente (usa el login de Claude de tu PC)',
    filas: () => `
# RATACODE · enchufe «claude»: Claude Code de verdad como subagente (usa el login de Claude de tu PC).
- insert:
    - id: tool-subagent-claude
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: claude-code
        toolName: subagent_claude
        backgroundMode: one-shot
        maxDepth: provider-managed
`,
  },
  {
    clave: 'equipos', tipo: 'bundle', porDefecto: false, perfiles: ['web'],
    bundle: '@deepseek-ai/dsh-experimental-agent-team-profile',
    texto: 'equipos de agentes (experimental): compañeros con buzón y tablero de tareas',
  },
];

/**
 * El bloque comentado que se deja en `ratacode.yaml` para que se vea qué se
 * puede apagar. Comentado: mientras no se toque, manda lo de fábrica.
 */
export function bloqueDeAjustes() {
  const ancho = Math.max(...ENCHUFES.map((e) => e.clave.length));
  return '# Enchufes de serie. Para apagar uno, quita el # de `enchufes:` y de su línea\n'
    + '# y pon false; los que vienen apagados se encienden con true.\n'
    + '# enchufes:\n'
    + ENCHUFES.map((e) => '#   ' + (e.clave + ':').padEnd(ancho + 1) + ' ' + String(e.porDefecto).padEnd(5) + '  # ' + e.texto + '\n').join('');
}

/**
 * Deja el bloque comentado en `<casa>\ratacode.yaml` si aún no está (una vez:
 * lo que el usuario cambie ahí no se toca).
 * @returns true si lo ha escrito.
 */
export function anunciarEnAjustes(casa, cabecera) {
  const ruta = join(casa, 'ratacode.yaml');
  const actual = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
  if (/^#?\s*enchufes\s*:/m.test(actual)) return false;
  mkdirSync(casa, { recursive: true });
  writeFileSync(ruta, (actual === '' ? cabecera : actual.replace(/\s*$/, '\n')) + '\n' + bloqueDeAjustes(), { mode: 0o600 });
  return true;
}

/** Las filas de un parche, o null si no es una lista YAML. */
function filasDe(texto) {
  let cargado;
  try { cargado = yaml.load(texto, { schema: ESQUEMA }); } catch { return null; }
  if (cargado === null || cargado === undefined) return [];
  return Array.isArray(cargado) ? cargado : null;
}

/** Los ids de las filas de un parche, también los de dentro de cada `insert:`. */
export function idsDelParche(filas) {
  const ids = new Set();
  for (const fila of filas) {
    if (fila === null || typeof fila !== 'object') continue;
    if (typeof fila.id === 'string') ids.add(fila.id);
    if (Array.isArray(fila.insert)) for (const f of fila.insert) if (typeof f?.id === 'string') ids.add(f.id);
  }
  return ids;
}

/** ¿Este enchufe va encendido? Lo dice `ratacode.yaml`; si no dice nada, la fábrica. */
function encendido(enchufe, elegidos) {
  return typeof elegidos[enchufe.clave] === 'boolean' ? elegidos[enchufe.clave] : enchufe.porDefecto;
}

/** ¿El paquete ya está en el perfil? */
function paqueteEnPerfil(perfil, nombre) {
  return existsSync(join(perfil, 'node_modules', ...nombre.split('/'), 'package.json'));
}

/** Escribe un fichero de texto entero, creando la carpeta que haga falta. */
function escribir(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, { mode: 0o600 });
}

/** Fuerza `@openai/codex` en el `pnpm-workspace.yaml` del perfil, si el usuario no fuerza ya otra. */
export function forzarCodex(perfil) {
  const ruta = join(perfil, 'pnpm-workspace.yaml');
  let doc;
  try { doc = yaml.load(readFileSync(ruta, 'utf8')) ?? {}; } catch { return; }
  if (doc.overrides?.['@openai/codex']) return;
  doc.overrides = { ...(doc.overrides ?? {}), '@openai/codex': CODEX_FORZADO };
  // pnpm 11 no deja instalar lo publicado hace poco: la forzada y sus binarios, fuera de esa espera.
  const v = CODEX_FORZADO;
  doc.minimumReleaseAgeExclude = [...(doc.minimumReleaseAgeExclude ?? []),
    `@openai/codex@${v}-darwin-arm64 || ${v}-darwin-x64 || ${v}-linux-arm64 || ${v}-linux-x64 || ${v}-win32-arm64 || ${v}-win32-x64 || ${v}`];
  escribir(ruta, yaml.dump(doc));
}

/**
 * Instala lo que falte con `dsh plugin add <paquete>@<versión del motor>`
 * (pnpm dentro del perfil, a la vista en stderr). Con RATACODE_SIN_INSTALAR no
 * se instala nada (las pruebas: ni pnpm ni red).
 * @returns true si queda todo.
 */
function instalarPaquetes({ motor, casa, nombre, perfil, paquetes, entorno }) {
  for (const paquete of paquetes) {
    if (paqueteEnPerfil(perfil, paquete)) continue;
    if (process.env.RATACODE_SIN_INSTALAR) return false;
    const spec = paquete + '@' + motor.version;
    process.stderr.write('RATACODE · instalando ' + spec + ' en el perfil ' + nombre + ' (pnpm; la primera vez tarda)\n');
    const r = spawnSync(process.execPath, [motor.bin, 'plugin', '--profile', nombre, 'add', spec], {
      env: { ...entorno, DSH_HOME: casa }, stdio: ['ignore', 2, 2], windowsHide: true,
    });
    if (r.status !== 0) return false;
  }
  return true;
}

/** Selecciona o quita un bundle opcional en el `package.json` del perfil. */
function ponerBundle(perfil, enchufe, quiere, explicito, salida) {
  const ruta = join(perfil, 'package.json');
  let pkg;
  try { pkg = JSON.parse(readFileSync(ruta, 'utf8')); } catch { return; }
  const lista = pkg?.dsh?.profile?.bundles;
  if (!Array.isArray(lista)) return;
  pkg.ratacode = pkg.ratacode ?? {};
  const deSerie = (pkg.ratacode.deSerie = Array.isArray(pkg.ratacode.deSerie) ? pkg.ratacode.deSerie : []);
  const esta = lista.includes(enchufe.bundle);
  let cambia = false;
  if (!quiere) {
    if (esta) { lista.splice(lista.indexOf(enchufe.bundle), 1); salida.apagados.push(enchufe.clave); cambia = true; }
  } else if (!esta && (explicito || !deSerie.includes(enchufe.bundle))) {
    lista.push(enchufe.bundle);
    salida.puestos.push(enchufe.clave);
    cambia = true;
  } else if (!esta) {
    salida.quitadosEnPlugins.push(enchufe.clave);
  }
  if (quiere && !deSerie.includes(enchufe.bundle)) { deSerie.push(enchufe.bundle); cambia = true; }
  if (cambia) writeFileSync(ruta, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Los enchufes de un perfil (ver la cabecera del fichero).
 * @param {{motor: {bin: string, version: string}, casa: string, perfil: string, nombre: string, elegidos: object, entorno?: object}} opciones
 * @returns `{puestos, apagados, sinInstalar, quitadosEnPlugins, parche}` (parche: ruta o null).
 */
export function asegurarEnchufes({ motor, casa, perfil, nombre, elegidos, entorno = process.env }) {
  const salida = { puestos: [], apagados: [], sinInstalar: [], quitadosEnPlugins: [], parche: null };
  const ruta = join(perfil, 'cordis.patch.yml');
  let texto;
  try { texto = readFileSync(ruta, 'utf8'); } catch { return salida; }
  const filas = filasDe(texto);
  if (filas === null) return salida;
  const hay = idsDelParche(filas);
  const eleccion = elegidos !== null && typeof elegidos === 'object' && !Array.isArray(elegidos) ? elegidos : {};
  const apagarIds = [];
  let cambiaParche = false;
  for (const e of ENCHUFES) {
    if (!e.perfiles.includes(nombre)) continue;
    const quiere = encendido(e, eleccion);
    if (e.tipo === 'bundle') {
      ponerBundle(perfil, e, quiere, typeof eleccion[e.clave] === 'boolean', salida);
      continue;
    }
    if (e.tipo === 'motor') {
      if (!quiere) { salida.apagados.push(e.clave); apagarIds.push(...e.ids); }
      continue;
    }
    const presentes = e.ids.filter((id) => hay.has(id));
    if (!quiere) {
      if (presentes.length > 0) { salida.apagados.push(e.clave); apagarIds.push(...presentes); }
      continue;
    }
    if (presentes.length > 0) continue;
    if (e.paquetes) {
      if (e.clave === 'codex') forzarCodex(perfil);
      if (!instalarPaquetes({ motor, casa, nombre, perfil, paquetes: e.paquetes, entorno })) { salida.sinInstalar.push(e.clave); continue; }
    }
    texto = (texto.endsWith('\n') ? texto : texto + '\n') + e.filas(nombre);
    cambiaParche = true;
    salida.puestos.push(e.clave);
  }
  if (cambiaParche) escribir(ruta, texto);
  const rutaApagados = join(casa, 'perfiles-parche', nombre + '-enchufes.yml');
  if (apagarIds.length > 0) {
    salida.parche = rutaApagados;
    escribir(rutaApagados, '# RATACODE · enchufes apagados en ratacode.yaml (enchufes).\n'
      + apagarIds.map((id) => '- id: ' + id + '\n  disabled: true\n').join(''));
  } else {
    rmSync(rutaApagados, { force: true });
  }
  return salida;
}

/** Una línea para la consola con lo que ha pasado en un perfil. */
export function resumen(nombre, e) {
  return 'RATACODE · enchufes (' + nombre + '): '
    + (e.puestos.length > 0 ? 'puestos ' + e.puestos.join(', ') : 'nada nuevo')
    + (e.apagados.length > 0 ? ' · apagados ' + e.apagados.join(', ') : '')
    + (e.quitadosEnPlugins.length > 0 ? ' · quitados en Plugins (se respeta) ' + e.quitadosEnPlugins.join(', ') : '')
    + (e.sinInstalar.length > 0 ? ' · SIN INSTALAR ' + e.sinInstalar.join(', ') + ' (se reintenta al próximo arranque)' : '')
    + ' · se apagan en ratacode.yaml › enchufes\n';
}
