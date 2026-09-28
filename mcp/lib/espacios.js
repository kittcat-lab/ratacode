/**
 * espacios — que una tarea del MCP SALGA en la barra lateral del panel.
 *
 * ── EL PROBLEMA (medido en R12) ─────────────────────────────────────────────
 * Una tarea del MCP SÍ crea su sesión de motor
 * (`<casa>\sessions\<espacio>\mcp-<task>\session.v3.jsonl.zstd`, con su
 * conversación dentro), pero en el panel NO salía: la barra lateral lista las
 * sesiones que el REGISTRO DE ESPACIOS tiene apuntadas, y nadie apuntaba las del
 * MCP. El MCP era una caja negra.
 *
 * ── LA VÍA (la que usa el propio motor) ─────────────────────────────────────
 * El registro es `<casa>\storages\workspace.json`, el documento del dominio
 * `workspace` versión 2 de `dsh-workspace` (`lib/index.js`: spec con
 * `global.workspaceIds` —el orden de la barra— y la tabla `workspaces` con
 * `{path, title, sessionIds, createdAt, updatedAt}`; `path` es el `fs.realpath`
 * del sitio y `sessionIds` es la cuenta de propiedad EN ORDEN DE PANTALLA).
 * `bin/ratacode.js` ya escribe este mismo fichero para registrar el espacio;
 * aquí sólo se añade la sesión a la cuenta del espacio que le toca.
 *
 * La escritura es atómica (fichero temporal + rename) y NUNCA pisa lo que haya:
 * si el documento no es el que sabemos leer, se deja como está y se dice por qué.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';

/** La ruta canónica de una carpeta (la única canon de identidad del registro). */
function canonica(ruta) {
  try {
    return realpathSync(ruta);
  } catch {
    return resolve(ruta).replace(/[\\/]+$/, '');
  }
}

/** El fichero del registro de espacios de una casa. */
export function rutaDelRegistro(casa) {
  return join(casa, 'storages', 'workspace.json');
}

/**
 * Apuntar la sesión de una tarea en el espacio de su carpeta de trabajo.
 *
 * @param {string} casa - la casa de RATACODE.
 * @param {string} espacio - la carpeta de trabajo de la tarea (`cwd` del motor).
 * @param {string} sessionId - el id de la sesión del motor (aquí, `mcp-<task>`).
 * @returns {{apuntada: boolean, nueva?: boolean, espacioId?: string, motivo?: string}}
 */
export function apuntarSesionEnEspacio(casa, espacio, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    return { apuntada: false, motivo: 'sin id de sesión que apuntar' };
  }
  if (typeof espacio !== 'string' || espacio.trim() === '') {
    return { apuntada: false, motivo: 'la tarea no trae carpeta de trabajo' };
  }
  const ruta = rutaDelRegistro(casa);
  let doc = null;
  if (existsSync(ruta)) {
    try {
      doc = JSON.parse(readFileSync(ruta, 'utf8'));
    } catch {
      doc = null;
    }
  }
  if (doc !== null && doc?.unit?.name !== 'workspace') doc = null;
  if (doc !== null && doc.unit.version !== 2) {
    return {
      apuntada: false,
      motivo: 'el registro de espacios de esta casa es versión ' + doc.unit.version
        + ', y yo sé escribir la 2: no lo toco',
    };
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

  const canon = canonica(espacio);
  let espacioId = Object.keys(doc.tables.workspaces)
    .find((clave) => doc.tables.workspaces[clave]?.path === canon);
  const ahora = new Date().toISOString();
  let nuevoEspacio = false;
  if (espacioId === undefined) {
    espacioId = randomUUID();
    doc.tables.workspaces[espacioId] = {
      path: canon,
      title: basename(canon) || canon,
      sessionIds: [],
      createdAt: ahora,
      updatedAt: ahora,
    };
    doc.global.workspaceIds = [espacioId, ...doc.global.workspaceIds];
    doc.global.initialized = true;
    nuevoEspacio = true;
  }
  const registro = doc.tables.workspaces[espacioId];
  if (!Array.isArray(registro.sessionIds)) registro.sessionIds = [];
  if (registro.sessionIds.includes(sessionId)) {
    return { apuntada: true, nueva: false, espacioId, nuevoEspacio };
  }
  registro.sessionIds = [sessionId, ...registro.sessionIds];
  registro.updatedAt = ahora;

  mkdirSync(dirname(ruta), { recursive: true });
  const temporal = ruta + '.' + process.pid + '.tmp';
  writeFileSync(temporal, JSON.stringify(doc, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporal, ruta);
  return { apuntada: true, nueva: true, espacioId, nuevoEspacio };
}
