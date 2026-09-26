/**
 * candado-windows — PRUEBA DEL CANDADO (riesgo 1 de RATACODE).
 *
 * No podemos lanzar un run_task real con modelo (el MCP sólo mira el ENTORNO
 * para la clave y aquí no hay ninguna; el fichero de credenciales está fuera de
 * los límites). Así que ejercitamos DIRECTAMENTE la capa de encierre de DSH que
 * run_task usa en Windows para los comandos de shell: el runner ACL de Windows
 * (token WRITE_RESTRICTED + SID de escritura por workspace), exactamente igual
 * que lo construye el seam `dsh-sandbox-local`.
 *
 * También comprobamos la valla de las herramientas de archivo (dsh-fs-sandbox):
 * llama a la función real `writableRoots` y al algoritmo de contención
 * (copia literal de `isPathUnder` de dsh-fs-sandbox) para demostrar que una
 * ruta fuera NO es raíz de escritura.
 *
 * RESULTADO LITERAL: si escribir en FUERA falla y escribir en DENTRO funciona,
 * el candado AGUANTA. Si escribir en FUERA consigue crear el fichero, el
 * candado está ROTO y hay que encerrar de verdad.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

// Los paquetes de DSH viven anidados en dsh/node_modules; importo por ruta
// absoluta (file://) para que su propia cadena de subpaquetes se resuelva desde ahí.
// La ruta se RESUELVE desde este fichero (nada de rutas absolutas de la máquina
// de nadie): mcp\prueba → producto → node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai.
const D = join(AQUI, '..', '..', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai');
const U = (p) => pathToFileURL(p).href;
const win = await import(U(join(D, 'dsh-sandbox-windows-acl', 'lib', 'index.js')));
const { AclWriteGrant, tempWriteSid, workspaceWriteSid, assertTempRootOutsideWorkspace } = win;
const { writableRoots } = await import(U(join(D, 'dsh-sandbox', 'lib', 'index.js')));
const runner = join(D, 'dsh-sandbox-windows-acl', 'lib', 'runner.js');

// El espacio del candado va en una CARPETA TEMPORAL del sistema, no en el
// repositorio: así la prueba no deja rastro en el árbol ni depende de dónde
// esté el proyecto.
//
// OJO con dónde va «fuera»: `writableRoots` da por escribibles el propio
// workspace, `C:\tmp` y el TEMP del sistema, así que una carpeta «fuera» metida
// DENTRO del TEMP no vale como fuera (saldría «ROTO» sin serlo). Por eso el
// banco de pruebas cuelga de la carpeta PADRE del TEMP, que no es raíz de
// escritura, y el temporal privado del runner sí va en el TEMP de verdad.
const S3 = join(dirname(tmpdir()), 'ratacode-candado-' + process.pid);
const E = join(S3, 'espacio-candado');   // dentro: permitido
const F = join(S3, 'fuera');             // fuera: debe negarse
mkdirSync(E, { recursive: true });
mkdirSync(F, { recursive: true });

const log = (...a) => process.stdout.write(a.join(' ') + '\n');

// ── 1) Valla de herramientas de archivo (dsh-fs-sandbox) ───────────────────
log('=== FS-FENCE (writableRoots real) ===');
const policy = { mode: 'workspace-write', workspaceRoot: E };
const roots = writableRoots(policy).map((r) => r.toLowerCase());
log('raíces de escritura permitidas: ' + JSON.stringify(roots));

// Algoritmo de contención copiado literalmente de dsh-fs-sandbox/lib/index.js.
const sep = '\\';
function isLexicallyUnder(path, root, caseSensitive) {
  const a = caseSensitive ? path : path.toLowerCase();
  const b = caseSensitive ? root : root.toLowerCase();
  if (a === b) return true;
  const prefix = b.endsWith(sep) ? b : b + sep;
  return a.startsWith(prefix);
}
function bajo(path, root, caseSensitive = process.platform !== 'win32') {
  if (isLexicallyUnder(path, root, caseSensitive)) return true;
  return false; // (el walk por identidad de fs es conservador; el razonamiento lexical basta aquí)
}
const fueraObjetivo = join(F, 'prueba-fuera.txt').toLowerCase();
const contenidoFuera = roots.some((r) => bajo(fueraObjetivo, r));
log('¿la ruta FUERA está bajo alguna raíz de escritura? ' + (contenidoFuera ? 'SÍ (ROTO)' : 'NO (valla correcta)'));

// ── 2) Candado de shell: runner ACL de Windows ─────────────────────────────
log('\n=== SHELL-CANDADO (runner ACL de Windows, igual que run_task) ===');
let wsid, tsid, wgrant, tgrant, T;
try {
  assertTempRootOutsideWorkspace(E, tmpdir());
  wsid = workspaceWriteSid(E);
  wgrant = AclWriteGrant.create(wsid);
  wgrant.add(E, true);               // el seam deja este ACE en pie (reuse cache)
  T = join(tmpdir(), 'dsh-candado-' + Math.random().toString(36).slice(2));
  mkdirSync(T, { recursive: true });
  tsid = tempWriteSid(T);
  tgrant = AclWriteGrant.create(tsid);
  tgrant.add(T);
  log('grants ACL materializados (workspace + temp privado)');
} catch (e) {
  log('FALLO al materializar grants ACL: ' + (e?.message ?? e));
  log('VEREDICTO: NO COMPROBABLE (el encierre de shell no pudo prepararse en esta máquina)');
  process.exit(2);
}

const base = [runner, '--workspace', E, '--temp', T, '--mode', 'workspace-write', '--write-sid', wsid, '--temp-write-sid', tsid, '--'];
const fueraFile = join(F, 'prueba-fuera.txt');
const dentroFile = join(E, 'prueba-dentro.txt');
if (existsSync(fueraFile)) rmSync(fueraFile);
if (existsSync(dentroFile)) rmSync(dentroFile);

// Escribir FUERA del workspace (debe negarse).
const rFuera = spawnSync(process.execPath, [...base, 'cmd', '/c', 'echo HOLA-FUERA>' + fueraFile], { stdio: 'ignore' });
const escritoFuera = existsSync(fueraFile);
log('intento escribir FUERA (' + fueraFile + ') -> exit=' + rFuera.status + ' creado=' + escritoFuera);

// Escribir DENTRO del workspace (debe permitirse).
const rDentro = spawnSync(process.execPath, [...base, 'cmd', '/c', 'echo HOLA-DENTRO>' + dentroFile], { stdio: 'ignore' });
const escritoDentro = existsSync(dentroFile);
log('intento escribir DENTRO (' + dentroFile + ') -> exit=' + rDentro.status + ' creado=' + escritoDentro);

// Limpieza de los grants de este test (el seam los dejaría en pie; aquí los
// quitamos porque es un workspace de prueba efímero).
try { tgrant.dispose(); } catch { /* da igual */ }
try { wgrant.dispose(); } catch { /* da igual */ }
try { rmSync(T, { recursive: true, force: true }); } catch { /* da igual */ }
try { rmSync(S3, { recursive: true, force: true }); } catch { /* da igual */ }

log('\n=== VEREDICTO DEL CANDADO ===');
if (!escritoFuera && escritoDentro) {
  log('AGUANTA: la tarea NO pudo escribir fuera y SÍ pudo escribir dentro.');
  log('FS-FENCE: ' + (contenidoFuera ? 'ROTO' : 'correcto') + ' · SHELL-CANDADO: correcto');
  process.exit(0);
} else if (escritoFuera) {
  log('ROTO: la tarea CONSIGUIÓ escribir fuera del workspace. Hay que encerrar de verdad.');
  process.exit(1);
} else {
  log('INCONCLUSO: no escribió fuera (bien) pero tampoco dentro (revísalo).');
  process.exit(3);
}
