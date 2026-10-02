#!/usr/bin/env node
/**
 * HEADLESS CON EL MODELO FALSO · parte de `npm test`.
 *
 * `ratacode headless "encargo"` de verdad, con el motor de verdad, contra el
 * modelo falso del repositorio (`pruebas/llm-falso.mjs`): sin claves y sin red.
 *   A · casa nueva: arranca, contesta lo que dice el guion y sale con 0; el
 *       modelo ve `ask_user_question` (enchufe «preguntar») y la hora de Madrid
 *       (enchufe «reloj»), y ninguna fila se queda sin activar;
 *   B · la telemetría del motor viaja APAGADA al perfil headless (el overlay de
 *       ajustes lleva `session-log-deepseek` con `enabled: false`);
 *   C · con `preguntar` y `reloj` apagados en ratacode.yaml, el modelo ya no
 *       ve ni la herramienta ni la hora.
 * Con RATACODE_SIN_INSTALAR=1: los enchufes que se instalan con pnpm (navegador,
 * codex) no se ponen aquí; eso se mide a mano (ver el PR).
 *
 * Uso: node pruebas/headless.test.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parcheDeAjustes } from '../mcp/lib/casa.js';
import { arrancarLlmFalso } from './llm-falso.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');
const PUERTO_MODELO = 3392;
const yaml = createRequire(import.meta.url)('js-yaml');

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}

function headless(casa, taller, encargo) {
  const env = { ...process.env, RATACODE_SIN_INSTALAR: '1' };
  return new Promise((listo, rechaza) => {
    const hijo = spawn(process.execPath, [join(PRODUCTO, 'bin', 'ratacode.js'), 'headless', encargo, '--home', casa, '--carpeta', taller],
      { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let salida = '';
    hijo.stdout.on('data', (t) => { salida += t; });
    hijo.stderr.on('data', (t) => { salida += t; });
    const reloj = setTimeout(() => hijo.kill(), 180000);
    hijo.on('error', rechaza);
    hijo.on('exit', (codigo) => { clearTimeout(reloj); listo({ codigo, salida }); });
  });
}

const base = mkdtempSync(join(tmpdir(), 'ratacode-headless-'));
const casa = join(base, 'casa');
const taller = join(base, 'taller');
mkdirSync(casa, { recursive: true });
mkdirSync(taller, { recursive: true });
writeFileSync(join(casa, 'settings.yaml'), yaml.dump({
  'agent-default-model': { provider: 'falso', model: 'falso-1' },
  'llm-pi-ai': {
    providers: {
      falso: {
        displayName: 'Falso', api: 'openai-completions', baseURL: 'http://127.0.0.1:' + PUERTO_MODELO + '/v1', timeoutMs: 30000,
        headers: { Authorization: 'Bearer sin-clave' },
        models: [{ id: 'falso-1', name: 'Falso', contextWindow: 100000, maxTokens: 4096, compat: { supportsDeveloperRole: false } }],
      },
    },
  },
}));

const llm = await arrancarLlmFalso({ puerto: PUERTO_MODELO, guiones: { '*': [{ texto: 'HOLA-DESDE-EL-FALSO' }] } });
/** Lo que vio el modelo en la primera petición de una etiqueta (la del encargo, no la del título). */
const vista = (etiqueta) => llm.peticionesDe(etiqueta)[0] ?? { tools: [], messages: [] };
const horaDe = (peticion) => peticion.messages.some((m) => typeof m.content === 'string' && /Time sampled.*\[Europe\/Madrid\]/.test(m.content));
try {
  // A
  const a = await headless(casa, taller, '[H:a] saluda');
  comprobar(a.codigo === 0, 'A · headless sale con 0 (salió con ' + a.codigo + ')');
  comprobar(a.salida.includes('HOLA-DESDE-EL-FALSO'), 'A · imprime lo que contesta el modelo');
  comprobar(!/did not activate|failed to import/.test(a.salida), 'A · ninguna fila del motor se queda sin activar'
    + (/did not activate/.test(a.salida) ? ': ' + a.salida.slice(a.salida.indexOf('did not activate'), a.salida.indexOf('did not activate') + 300) : ''));
  comprobar(vista('a').tools.includes('ask_user_question'), 'A · el modelo ve ask_user_question (enchufe «preguntar»)');
  comprobar(horaDe(vista('a')), 'A · el modelo recibe la hora de Madrid (enchufe «reloj»)');

  // B
  const overlay = parcheDeAjustes(casa, 'prueba-headless.yml');
  const filas = yaml.load(readFileSync(overlay, 'utf8'));
  rmSync(overlay, { force: true });
  comprobar(filas.some((f) => f.id === 'session-log-deepseek' && f.config?.enabled === false),
    'B · el overlay del perfil headless lleva la telemetría apagada');

  // C
  writeFileSync(join(casa, 'ratacode.yaml'), 'enchufes:\n  preguntar: false\n  reloj: false\n');
  const c = await headless(casa, taller, '[H:c] saluda');
  comprobar(c.codigo === 0, 'C · con enchufes apagados también arranca (salió con ' + c.codigo + ')');
  comprobar(!vista('c').tools.includes('ask_user_question') && !horaDe(vista('c')), 'C · y el modelo ya no ve ni ask_user_question ni la hora');
} finally {
  llm.parar();
  rmSync(base, { recursive: true, force: true });
}

process.stdout.write(fallos.length === 0
  ? '\nVERDE · headless arranca con el modelo falso: ' + cuantas + ' comprobaciones.\n'
  : '\nROJO · ' + fallos.length + ' de ' + cuantas + ' comprobaciones fallan.\n');
process.exitCode = fallos.length === 0 ? 0 : 1;
