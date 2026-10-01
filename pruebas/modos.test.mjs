#!/usr/bin/env node
/**
 * PRUEBA DE CARGA DE LOS 9 MODOS · parte de `npm test`.
 *
 * ── POR QUÉ ASÍ ─────────────────────────────────────────────────────────────
 * El tutor lo vio en pantalla: al elegir PROMPTISTA salía
 * «Could not switch to PROMPTISTA: loader entries failed to apply - … invalid
 * config: - $.sampleOverCapGlobResults missing required value …». O sea: el
 * cargador de DSH rechaza una fila del preset AL APLICARLA.
 *
 * Validar eso sin navegador no vale con leer el fichero: el descubrimiento de
 * presets de DSH comprueba que la composición parsea y que cada fila nombra un
 * paquete que existe, pero **nunca importa ni aplica una fila**
 * (`dsh-agent-presets/README.md:178`), así que un preset con la config mal
 * sale «sano» en el selector y revienta al elegirlo. Y una sesión `headless` o
 * `sdk` tampoco sirve: esos perfiles NO componen desde el preset (el roster
 * sólo avisa por consola cuando un agente no se une a ninguno,
 * `dsh-agent-presets/lib/index.js:1320-1323`).
 *
 * Lo que sí sirve: meter las filas del preset en el MISMO cargador de Cordis
 * que usa el cambio de modo, con `--patch`, y arrancar el panel. Si una fila
 * tiene la config mal, el arranque se cae con el error literal; si arranca, las
 * filas se aplicaron. Sin navegador, sin modelo y sin claves.
 *
 * Dos ajustes del banco de pruebas, para no confundir un artefacto con un fallo:
 *   · la fila `persona` no entra: registra una sección de prompt en el contexto
 *     del AGENTE, y montada en el host choca con la persona de despliegue
 *     («prompt section "deployment:persona-prefix" is already registered»). De
 *     la persona se comprueba aparte que existe y que cada modo trae la suya.
 *   · los grupos (`cordis:group` con los hijos en `config`) se aplanan: metidos
 *     por parche el cargador los rechaza con «entry._await is not a function»,
 *     que es cosa del parche, no del preset.
 *
 * R14: son NUEVE modos, no tres. Además de cargar, se comprueba EN EL FICHERO lo
 * que el selector no puede ver: que cada `preset.yml` trae nombre en mayúsculas,
 * descripción y orden (sin repetir), y que las dos configuraciones que R3 vio
 * reventar (`tool-fs-search.sampleOverCapGlobResults` y
 * `tool-todo.allowParallelInProgress`) están puestas en los 9.
 *
 * OJO al leer los ficheros: los modos que ejecutan cosas llevan
 * `disabled: !!js process.platform …` (la puerta de plataforma de DSH), y
 * js-yaml NO entiende `!!js` con su esquema de serie — hay que registrar el
 * tipo. Se lee como texto y se devuelve tal cual al escribir el parche.
 *
 * Uso: node pruebas/modos.test.mjs [--puerto-base 3141]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const MODOS = join(PRODUCTO, 'modos');
const CASA = join(PRODUCTO, '_pruebaR14-modos');
const TALLER = join(PRODUCTO, '_pruebaR14-modos-taller');
/** Los 9 modos de R14, en el orden del selector. */
const NOMBRES = [
  'modo-rata', 'arquitecto', 'capataz', 'hero', 'tirita', 'gepeto', 'faro', 'pix', 'nex',
];
/** Nombre visible de cada uno (el de `preset.yml`). */
const ESPERADOS = {
  'modo-rata': 'MODO-RATA',
  arquitecto: 'ARQUITECTO',
  capataz: 'CAPATAZ',
  hero: 'HERO',
  tirita: 'TIRITA',
  gepeto: 'GEPETO',
  faro: 'FARO',
  pix: 'PIX',
  nex: 'NEX',
};

const require = createRequire(join(PRODUCTO, 'package.json'));
const yaml = require('js-yaml');

// `!!js` (la puerta de plataforma de DSH) no existe en el esquema de serie de
// js-yaml: se registra para poder LEER, y se marca con un prefijo que se
// devuelve a `!!js ` al escribir el parche (así el cargador recibe lo mismo).
const MARCA_JS = 'RSJS';
const ESQUEMA_JS = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type('tag:yaml.org,2002:js', {
    kind: 'scalar',
    resolve: () => true,
    construct: (texto) => MARCA_JS + texto,
  }),
]);
const leerYaml = (texto) => yaml.load(texto, { schema: ESQUEMA_JS });
const volcarYaml = (valor) => yaml
  .dump(valor, { lineWidth: 200, noRefs: true })
  .split(MARCA_JS).join('!!js ');

const fallos = [];
const di = (t) => process.stdout.write(t + '\n');
const comprobar = (condicion, queja) => {
  if (condicion) return true;
  fallos.push(queja);
  return false;
};

/** El binario del motor, preguntándoselo al paquete instalado. */
function binDelMotor() {
  const manifiesto = require.resolve('@deepseek-ai/dsh/package.json');
  const pkg = JSON.parse(readFileSync(manifiesto, 'utf8'));
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.bin ?? pkg.bin?.dsh;
  return join(dirname(manifiesto), rel);
}

/**
 * Las filas de un modo, sin la persona y con los grupos aplanados.
 *
 * Tercer ajuste del banco (R14): a `tool-subagent` se le quita
 * `modelSelectionSettings`. Es una capacidad ATADA AL MODO (deja elegir
 * proveedor y modelo al subagente desde el panel) y el cargador la rechaza
 * montada «de pie» en el host: «tool-subagent: standing
 * `modelSelectionSettings` requires a scoped preset Context». En el modo sí
 * vale — el modo ES ese contexto—, y aquí sólo se comprueba que la fila aplica.
 */
function filasProbables(fichero, prefijo) {
  const filas = leerYaml(readFileSync(fichero, 'utf8'));
  const esPersona = (f) => f.name === '@deepseek-ai/dsh-persona';
  const aplanar = (f) => (f.group === true && Array.isArray(f.config) ? f.config : [f]);
  const sinSelectora = (f) => {
    if (f.config?.modelSelectionSettings === undefined) return f;
    const config = { ...f.config };
    delete config.modelSelectionSettings;
    return { ...f, config };
  };
  return filas.filter((f) => !esPersona(f)).flatMap(aplanar).map(sinSelectora).map((f) => ({ ...f, id: prefijo + f.id }));
}

/** La persona de un modo: tiene que existir y traer su propio texto. */
function personaDe(fichero) {
  const filas = leerYaml(readFileSync(fichero, 'utf8'));
  const fila = filas.find((f) => f.name === '@deepseek-ai/dsh-persona');
  return typeof fila?.config?.prefix === 'string' ? fila.config.prefix.trim() : null;
}

/** Arranca el panel con las filas del modo metidas por parche. Espera al «dsh web:». */
function cargarModo(nombre, puerto) {
  const fichero = join(MODOS, nombre, 'agent.cordis.yml');
  const parche = join(CASA, 'parche-' + nombre + '.yml');
  mkdirSync(CASA, { recursive: true });
  writeFileSync(parche, volcarYaml([{ insert: filasProbables(fichero, nombre + '-') }]));

  const hijo = spawn(process.execPath, [
    binDelMotor(), '--profile', 'web', '--patch', parche, '--port', String(puerto), '--no-open',
  ], { cwd: PRODUCTO, env: { ...process.env, DSH_HOME: CASA }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  let salida = '';
  const guardar = (t) => { salida += t; };
  hijo.stdout.setEncoding('utf8'); hijo.stdout.on('data', guardar);
  hijo.stderr.setEncoding('utf8'); hijo.stderr.on('data', guardar);

  return new Promise((listo) => {
    const reloj = setTimeout(() => listo({ bien: false, motivo: 'no arrancó en 90 s', salida }), 90000);
    const mirar = setInterval(() => {
      if (!/dsh web:\s+\S+/.test(salida)) return;
      clearInterval(mirar); clearTimeout(reloj);
      listo({ bien: true, motivo: 'arrancó (las filas se aplicaron)', salida });
    }, 200);
    hijo.on('exit', (codigo) => {
      clearInterval(mirar); clearTimeout(reloj);
      listo({ bien: false, motivo: 'el cargador lo tumbó (código ' + codigo + ')', salida });
    });
    hijo.on('error', (e) => {
      clearInterval(mirar); clearTimeout(reloj);
      listo({ bien: false, motivo: 'no se pudo lanzar: ' + e.message, salida });
    });
  }).then((resultado) => {
    try {
      if (process.platform === 'win32') {
        spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + '/T /F'],
          { windowsHide: true, stdio: 'ignore' });
      } else if (hijo.exitCode === null) {
        hijo.kill('SIGKILL');
      }
    } catch { /* ya se fue */ }
    return resultado;
  });
}

/** Lo que el selector no puede ver: el `preset.yml` y las dos configs de R3. */
function revisarFicheros(nombre) {
  const carpeta = join(MODOS, nombre);
  const preset = join(carpeta, 'preset.yml');
  const compo = join(carpeta, 'agent.cordis.yml');
  if (!comprobar(existsSync(preset), 'no encuentro ' + preset)) return;
  if (!comprobar(existsSync(compo), 'no encuentro ' + compo)) return;

  const meta = leerYaml(readFileSync(preset, 'utf8'));
  comprobar(meta.name === ESPERADOS[nombre],
    'el nombre de ' + nombre + ' no es el esperado (dice «' + meta.name + '», tocaba «' + ESPERADOS[nombre] + '»)');
  comprobar(meta.name === String(meta.name).toUpperCase(), 'el nombre de ' + nombre + ' no está en MAYÚSCULAS');
  comprobar(typeof meta.description === 'string' && meta.description.trim().length > 30,
    'a ' + nombre + ' le falta la descripción (o es demasiado corta)');
  comprobar(Number.isInteger(meta.order), 'a ' + nombre + ' le falta el `order`');

  const texto = readFileSync(compo, 'utf8');
  comprobar(/sampleOverCapGlobResults:\s*false/.test(texto),
    nombre + ': tool-fs-search sin `sampleOverCapGlobResults` (R3: el modo NO carga al elegirlo)');
  comprobar(/allowParallelInProgress:\s*true/.test(texto),
    nombre + ': tool-todo sin `allowParallelInProgress` (R3: el modo NO carga al elegirlo)');
  const persona = personaDe(compo);
  comprobar(typeof persona === 'string' && persona.length > 300,
    'la persona de ' + nombre + ' falta o es demasiado corta (cada modo trae la suya)');
  return { meta, persona };
}

async function main() {
  let puerto = 3141;
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--puerto-base') puerto = Number(process.argv[i + 1]);
  }
  rmSync(CASA, { recursive: true, force: true });
  rmSync(TALLER, { recursive: true, force: true });
  mkdirSync(TALLER, { recursive: true });

  di('RATACODE · prueba de carga de los ' + NOMBRES.length + ' modos');
  di('  casa de la prueba: ' + CASA);

  const personas = new Map();
  const ordenes = new Map();
  for (let i = 0; i < NOMBRES.length; i += 1) {
    const nombre = NOMBRES[i];
    const revision = revisarFicheros(nombre);
    if (revision !== undefined) {
      personas.set(nombre, revision.persona);
      ordenes.set(nombre, revision.meta.order);
    }

    const resultado = await cargarModo(nombre, puerto + i);
    di('  · ' + nombre.padEnd(10) + ': ' + (resultado.bien ? 'CARGA' : 'NO CARGA') + ' — ' + resultado.motivo);
    if (!resultado.bien) {
      const culpables = resultado.salida.split(/\r?\n/)
        .filter((l) => /invalid config|missing required|failed to apply loader entry|did not activate|waiting for|already registered/i.test(l))
        .map((l) => l.trim())
        .slice(0, 8);
      for (const l of culpables) di('      ' + l);
      comprobar(false, 'el modo ' + nombre + ' no carga: ' + (culpables[0] ?? resultado.motivo));
    }
  }

  // «Solo cambian la persona»: los nueve textos tienen que ser distintos.
  const textos = [...personas.values()].filter((p) => typeof p === 'string');
  comprobar(new Set(textos).size === textos.length,
    'dos modos comparten la misma persona: no se distinguirían');

  // Y el orden del selector, sin repetir.
  const numeros = [...ordenes.values()];
  comprobar(new Set(numeros).size === numeros.length,
    'dos modos traen el mismo `order` en preset.yml: el selector los ordenaría al azar');

  if (fallos.length > 0) {
    di('');
    di('ROJO · ' + fallos.length + ' cosa(s) mal:');
    for (const f of fallos) di('  · ' + f);
  } else {
    di('');
    di('VERDE · los ' + NOMBRES.length + ' modos cargan en el cargador de DSH y cada uno trae su persona.');
  }
  // Salida explícita: las tuberías del hijo dejarían vivo el bucle de eventos.
  process.exit(fallos.length === 0 ? 0 : 1);
}

await main();
