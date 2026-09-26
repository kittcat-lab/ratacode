#!/usr/bin/env node
/**
 * instalación de RATACODE · el paso que npm 11 deja «pendiente».
 *
 * ── QUÉ PASA (medido el 24-sep-2026, npm 11.16.0 / Node 24.18.0) ────────────
 * npm 11 estrenó la política `allow-scripts` (RFC npm/rfcs#868). Al instalar,
 * recorre el árbol y lista los paquetes con guiones de instalación que NO están
 * cubiertos por `allowScripts`:
 *
 *   npm warn allow-scripts 5 packages have install scripts not yet covered by allowScripts:
 *   npm warn allow-scripts   @deepseek-ai/dsh-subprocess-local@0.1.5-rc.3 (postinstall: …)
 *   npm warn allow-scripts   koffi@3.3.1 (install: node ./cnoke.cjs …)
 *   npm warn allow-scripts   node-pty@1.2.0-beta.15 (install: …; postinstall: …)
 *
 * Con la configuración por defecto (`strict-allow-scripts=false`) esos guiones
 * SÍ se ejecutan: el aviso es una lista de «pendientes de aprobar», no un
 * salto. Medido en una instalación global recién hecha y sin `--foreground-scripts`:
 * `node-pty` arranca un PTY y `koffi` llama a kernel32 (trabajo\S1\comprobar-nativos.mjs).
 *
 * ── POR QUÉ HACE FALTA ESTE FICHERO ─────────────────────────────────────────
 * La capa `package.json#allowScripts` se ignora en las instalaciones globales
 * (`npm.global === true` ⇒ npm no mira el package.json del «proyecto»; medido:
 * un paquete con `allowScripts` en su tarball sigue saliendo en el aviso). En
 * cambio, los guiones del PAQUETE RAÍZ sí corren siempre en `npm i -g`.
 *
 * Así que aquí, en el postinstall de RATACODE, se comprueba cada uno de los
 * tres y se ejecuta SU guion de instalación si le falta el fruto. Es
 * idempotente (si ya está, no hace nada), best-effort (nunca tumba la
 * instalación) y no imprime ningún valor de credencial.
 *
 * ── LO QUE SE COMPRUEBA, PAQUETE A PAQUETE ──────────────────────────────────
 * · node-pty                → `build/Release/conpty/conpty.dll` (lo copia su
 *                             postinstall desde `third_party/conpty`). Los
 *                             `.node` viajan en `prebuilds/<plataforma>-<arch>/`.
 * · koffi                   → `build/koffi/<toolchain>/koffi.node`, o el
 *                             paquete de plataforma `@koromix/koffi-*` (que es
 *                             lo normal: por eso su guion no construye nada).
 * · dsh-subprocess-local    → `chmod 0755` sobre el `spawn-helper` de node-pty
 *                             (sólo POSIX: en Windows no existe y es un no-op).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Desde dónde se busca cada paquete. `koffi` y `node-pty` cuelgan de la raíz,
 * pero `@deepseek-ai/dsh-subprocess-local` cuelga DENTRO de `@deepseek-ai/dsh`,
 * así que hay que resolver también desde ahí o no se encuentra.
 */
const BASES = [require];
try {
  BASES.push(createRequire(require.resolve('@deepseek-ai/dsh/package.json')));
} catch { /* sin motor instalado: las otras bases bastan */ }

/**
 * La carpeta de un paquete del árbol, resolviendo su entrada y subiendo hasta
 * el `package.json` que lleva su nombre (algunos no exportan `./package.json`,
 * como `koffi`). Devuelve null si no está.
 */
function carpetaDe(nombre) {
  for (const base of BASES) {
    let entrada = null;
    try {
      entrada = base.resolve(nombre);
    } catch {
      try { entrada = base.resolve(nombre + '/package.json'); } catch { continue; }
    }
    let dir = dirname(entrada);
    for (let saltos = 0; saltos < 6; saltos += 1) {
      const manifiesto = join(dir, 'package.json');
      if (existsSync(manifiesto)) {
        try {
          if (JSON.parse(readFileSync(manifiesto, 'utf8')).name === nombre) return dir;
        } catch { /* package.json ilegible: se sigue subiendo */ }
      }
      const padre = dirname(dir);
      if (padre === dir) break;
      dir = padre;
    }
  }
  return null;
}

/** ¿Está ya el fruto del guion de instalación de este paquete? */
function yaEsta(nombre, carpeta) {
  if (carpeta === null) return false;
  if (nombre === 'node-pty') {
    return existsSync(join(carpeta, 'build', 'Release', 'conpty', 'conpty.dll'));
  }
  if (nombre === 'koffi') {
    if (existsSync(join(carpeta, 'build'))) {
      for (const toolchain of readdirSync(join(carpeta, 'build'))) {
        if (existsSync(join(carpeta, 'build', toolchain, 'koffi.node'))) return true;
      }
    }
    // El paquete de plataforma es la vía normal y suficiente.
    for (const plataforma of ['win32', 'linux', 'darwin', 'freebsd', 'openbsd', 'android']) {
      if (carpetaDe('@koromix/koffi-' + plataforma + '-' + process.arch)) return true;
    }
    return false;
  }
  // dsh-subprocess-local sólo repara permisos de un fichero POSIX.
  return process.platform === 'win32';
}

const PENDIENTES = [
  { nombre: 'node-pty', guion: 'install' },
  { nombre: 'koffi', guion: 'install' },
  { nombre: '@deepseek-ai/dsh-subprocess-local', guion: 'postinstall' },
];

const hechos = [];
const fallos = [];

for (const { nombre, guion } of PENDIENTES) {
  const carpeta = carpetaDe(nombre);
  if (carpeta === null) {
    fallos.push(nombre + ': no está en el árbol (¿instalación incompleta?)');
    continue;
  }
  if (yaEsta(nombre, carpeta)) {
    hechos.push(nombre + ': ya estaba');
    continue;
  }
  // `npm run <guion>` dentro de la carpeta del paquete: es exactamente lo que
  // npm habría ejecutado, con su mismo entorno (npm_config_* incluidos).
  const r = spawnSync('npm', ['run', guion], {
    cwd: carpeta,
    stdio: 'inherit',
    shell: true,
    windowsHide: true,
  });
  if (r.status === 0 && yaEsta(nombre, carpeta)) hechos.push(nombre + ': ejecutado ahora');
  else if (r.status === 0) hechos.push(nombre + ': ejecutado (su guion no deja fruto en esta plataforma)');
  else fallos.push(nombre + ': su guion «' + guion + '» salió con ' + r.status);
}

process.stdout.write('RATACODE · instalación: ' + hechos.join(' · ') + '\n');
if (fallos.length > 0) {
  process.stdout.write('RATACODE · instalación: AVISO, no pude completar: ' + fallos.join(' · ') + '\n');
  process.stdout.write('RATACODE · instalación: RATACODE arranca igual; si la terminal falla, '
    + 'ejecuta a mano «npm run install» en la carpeta de cada paquete.\n');
}
// Nunca se tumba la instalación por esto: el panel web no necesita estos guiones.
process.exitCode = 0;
