#!/usr/bin/env node
/**
 * PRUEBA DE CARGA DE LOS 3 MODOS · parte de `npm test`.
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
const CASA = join(PRODUCTO, '_pruebaR3-modos');
const TALLER = join(PRODUCTO, '_pruebaR3-modos-taller');
const NOMBRES = ['enlazador', 'promptista', 'escritor'];

const require = createRequire(join(PRODUCTO, 'package.json'));
const yaml = require('js-yaml');

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

/** Las filas de un modo, sin la persona y con los grupos aplanados. */
function filasProbables(fichero, prefijo) {
  const filas = yaml.load(readFileSync(fichero, 'utf8'));
  const esPersona = (f) => f.name === '@deepseek-ai/dsh-persona';
  const aplanar = (f) => (f.group === true && Array.isArray(f.config) ? f.config : [f]);
  return filas.filter((f) => !esPersona(f)).flatMap(aplanar).map((f) => ({ ...f, id: prefijo + f.id }));
}

/** La persona de un modo: tiene que existir y traer su propio texto. */
function personaDe(fichero) {
  const filas = yaml.load(readFileSync(fichero, 'utf8'));
  const fila = filas.find((f) => f.name === '@deepseek-ai/dsh-persona');
  return typeof fila?.config?.prefix === 'string' ? fila.config.prefix.trim() : null;
}

/** Arranca el panel con las filas del modo metidas por parche. Espera al «dsh web:». */
function cargarModo(nombre, puerto) {
  const fichero = join(MODOS, nombre, 'agent.cordis.yml');
  const parche = join(CASA, 'parche-' + nombre + '.yml');
  mkdirSync(CASA, { recursive: true });
  writeFileSync(parche, yaml.dump([{ insert: filasProbables(fichero, nombre + '-') }], { lineWidth: 200 }));

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
      spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'taskkill /pid ' + hijo.pid + '/T /F'],
        { windowsHide: true, stdio: 'ignore' });
    } catch { /* ya se fue */ }
    return resultado;
  });
}

async function main() {
  let puerto = 3141;
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--puerto-base') puerto = Number(process.argv[i + 1]);
  }
  rmSync(CASA, { recursive: true, force: true });
  rmSync(TALLER, { recursive: true, force: true });
  mkdirSync(TALLER, { recursive: true });

  di('RATACODE · prueba de carga de los 3 modos');
  di('  casa de la prueba: ' + CASA);

  const personas = new Map();
  for (let i = 0; i < NOMBRES.length; i += 1) {
    const nombre = NOMBRES[i];
    const fichero = join(MODOS, nombre, 'agent.cordis.yml');
    if (!comprobar(existsSync(fichero), 'no encuentro ' + fichero)) continue;

    const persona = personaDe(fichero);
    personas.set(nombre, persona);
    comprobar(typeof persona === 'string' && persona.length > 80,
      'la persona de ' + nombre + ' falta o es demasiado corta (cada modo tiene que traer la suya)');

    const resultado = await cargarModo(nombre, puerto + i);
    di('  · ' + nombre + ': ' + (resultado.bien ? 'CARGA' : 'NO CARGA') + ' — ' + resultado.motivo);
    if (!resultado.bien) {
      const culpables = resultado.salida.split(/\r?\n/)
        .filter((l) => /invalid config|missing required|failed to apply loader entry|did not activate|waiting for/i.test(l))
        .map((l) => l.trim())
        .slice(0, 8);
      for (const l of culpables) di('      ' + l);
      comprobar(false, 'el modo ' + nombre + ' no carga: ' + (culpables[0] ?? resultado.motivo));
    }
  }

  // «Solo cambian la persona»: los tres textos tienen que ser distintos.
  const textos = [...personas.values()].filter((p) => typeof p === 'string');
  comprobar(new Set(textos).size === textos.length,
    'dos modos comparten la misma persona: no se distinguirían');

  if (fallos.length > 0) {
    di('');
    di('ROJO · ' + fallos.length + ' cosa(s) mal:');
    for (const f of fallos) di('  · ' + f);
  } else {
    di('');
    di('VERDE · los 3 modos cargan en el cargador de DSH y cada uno trae su persona.');
  }
  // Salida explícita: las tuberías del hijo dejarían vivo el bucle de eventos.
  process.exit(fallos.length === 0 ? 0 : 1);
}

await main();
