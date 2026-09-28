#!/usr/bin/env node
/**
 * PRUEBA DEL REGISTRO DE ESPACIOS (R16 §3) · parte de `npm test`.
 *
 * Lo que se comprueba, sin arrancar el motor ni el panel: que una tarea del MCP
 * deja su sesión apuntada en `<casa>\storages\workspace.json`, en el espacio que
 * le toca por su carpeta de trabajo —que es de donde el panel saca la barra
 * lateral— y que hacerlo dos veces no duplica nada ni pisa el registro.
 *
 * Uso: node pruebas/mcp-espacios.test.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apuntarSesionEnEspacio } from '../mcp/lib/espacios.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRODUCTO = resolve(AQUI, '..');

let cuantas = 0;
const fallos = [];
function comprobar(condicion, queja) {
  cuantas += 1;
  if (!condicion) fallos.push(queja);
  process.stdout.write((condicion ? 'OK   ' : 'MAL  ') + '  ' + queja + '\n');
}
const di = (t) => process.stdout.write(t + '\n');

const base = mkdtempSync(join(tmpdir(), 'ratacode-espacios-'));
const casa = join(base, 'casa');
const taller = join(base, 'taller');
mkdirSync(taller, { recursive: true });
mkdirSync(casa, { recursive: true });
const registro = join(casa, 'storages', 'workspace.json');

try {
  // 1 · una casa sin registro: la sesión lo estrena, con SU espacio.
  const uno = apuntarSesionEnEspacio(casa, taller, 'mcp-t-uno');
  comprobar(uno.apuntada === true && uno.nuevoEspacio === true, 'la primera sesión estrena el registro y su espacio');
  const doc = JSON.parse(readFileSync(registro, 'utf8'));
  comprobar(doc.unit.name === 'workspace' && doc.unit.version === 2, 'el registro sale en el formato del motor (workspace v2)');
  const espacios = Object.values(doc.tables.workspaces);
  comprobar(espacios.length === 1, 'hay un espacio, y uno solo');
  comprobar(espacios[0].sessionIds[0] === 'mcp-t-uno', 'la sesión queda apuntada en el espacio de su carpeta');
  comprobar(doc.global.workspaceIds.length === 1, 'el orden de la barra lleva ese espacio');

  // 2 · la misma sesión otra vez: no se duplica.
  const dos = apuntarSesionEnEspacio(casa, taller, 'mcp-t-uno');
  comprobar(dos.apuntada === true && dos.nueva === false, 'apuntar dos veces la misma sesión no la duplica');
  const otra = JSON.parse(readFileSync(registro, 'utf8'));
  comprobar(Object.values(otra.tables.workspaces)[0].sessionIds.length === 1, 'sigue habiendo una sola entrada');

  // 3 · una segunda sesión: va la primera (el orden de la barra es el de la lista).
  apuntarSesionEnEspacio(casa, taller, 'mcp-t-dos');
  const tres = JSON.parse(readFileSync(registro, 'utf8'));
  comprobar(JSON.stringify(Object.values(tres.tables.workspaces)[0].sessionIds) === '["mcp-t-dos","mcp-t-uno"]',
    'la sesión nueva se apunta por delante: ' + JSON.stringify(Object.values(tres.tables.workspaces)[0].sessionIds));

  // 4 · otra carpeta: otro espacio, sin tocar el primero.
  const otraSala = join(base, 'otra');
  mkdirSync(otraSala, { recursive: true });
  apuntarSesionEnEspacio(casa, otraSala, 'mcp-t-tres');
  const cuatro = JSON.parse(readFileSync(registro, 'utf8'));
  comprobar(Object.keys(cuatro.tables.workspaces).length === 2, 'una carpeta nueva estrena su propio espacio');
  comprobar(Object.values(cuatro.tables.workspaces).some((w) => w.sessionIds.includes('mcp-t-uno'))
    && Object.values(cuatro.tables.workspaces).some((w) => w.sessionIds.includes('mcp-t-tres')),
    'cada sesión queda en el espacio de SU carpeta');

  // 5 · un registro que no sabemos leer: no se toca.
  const casaRara = join(base, 'rara');
  mkdirSync(join(casaRara, 'storages'), { recursive: true });
  writeFileSync(join(casaRara, 'storages', 'workspace.json'), JSON.stringify({ unit: { name: 'workspace', version: 9 }, global: {}, tables: {} }));
  const raro = apuntarSesionEnEspacio(casaRara, taller, 'mcp-t-cuatro');
  comprobar(raro.apuntada === false && /versión 9/.test(raro.motivo ?? ''), 'un registro de otra versión no se toca: ' + (raro.motivo ?? ''));
  comprobar(JSON.parse(readFileSync(join(casaRara, 'storages', 'workspace.json'), 'utf8')).unit.version === 9, 'y se queda tal y como estaba');

  // 6 · sin sesión o sin carpeta, se dice, no se inventa.
  comprobar(apuntarSesionEnEspacio(casa, taller, '').apuntada === false, 'sin id de sesión no se apunta nada');
  comprobar(apuntarSesionEnEspacio(casa, '', 'mcp-t-cinco').apuntada === false, 'sin carpeta de trabajo no se apunta nada');

  di('');
  di(fallos.length === 0
    ? 'VERDE · el registro de espacios apunta las sesiones del MCP donde el panel las lee.'
    : 'ROJO · ' + fallos.length + ' cosa(s) mal.');
  for (const f of fallos) di('  · ' + f);
  process.exitCode = fallos.length === 0 ? 0 : 1;
} finally {
  try { rmSync(base, { recursive: true, force: true }); } catch { /* da igual */ }
  if (existsSync(base)) di('(no pude borrar ' + base + ')');
}
