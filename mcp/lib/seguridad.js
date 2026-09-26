/**
 * seguridad — el espacio de trabajo manda, y lo peligroso se pide.
 *
 * Tres ideas, y ninguna es adorno:
 *
 * 1 · ESPACIO CERRADO. Una tarea sólo puede trabajar dentro de las raíces
 *     autorizadas (`mcp.workspaces` en los ajustes de la casa). Si no hay
 *     ninguna declarada, la única raíz es el espacio por defecto o la carpeta
 *     desde la que arrancó el servidor. Todo lo demás se rechaza con un error
 *     que dice qué hacer. Esto es lo que evita que un agente se ponga a
 *     trabajar por todo el disco.
 *
 * 2 · EL SANDBOX LO IMPONE EL CORE, no nosotros. El modo por defecto es
 *     `workspace-write` y el cwd de la sesión es su frontera de escritura
 *     (medido en `dsh-sandbox-policy/lib/types/index.d.ts:40-55`). Nosotros no
 *     reimplementamos nada: le pasamos al hijo un parche que FIJA el modo, para
 *     que ni un `DSH_PERMISSION_MODE` heredado del entorno pueda aflojarlo.
 *
 * 3 · LO PELIGROSO SE PIDE DOS VECES. `allow_dangerous` en la llamada no basta:
 *     hace falta que el humano haya encendido `mcp.permitir_peligroso` en la
 *     casa. Si no, se deniega y se explica. Nunca se queda esperando una
 *     aprobación que no existe: en un servidor MCP no hay a quién preguntar.
 */
import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { ajustesMcp } from './casa.js';

/** ¿Es Windows? (allí las rutas no distinguen mayúsculas) */
const ES_WINDOWS = process.platform === 'win32';

/** Una ruta absoluta y canónica: sin `..`, sin enlaces, sin sorpresas. */
export function normalizarRuta(ruta) {
  const absoluta = resolve(ruta);
  try {
    return realpathSync.native(absoluta);
  } catch {
    try {
      return realpathSync(absoluta);
    } catch {
      return absoluta;
    }
  }
}

/** La forma comparable de una ruta (en Windows, sin distinguir mayúsculas). */
function comparable(ruta) {
  const limpia = ruta.endsWith(sep) && ruta.length > 1 ? ruta.slice(0, -1) : ruta;
  return ES_WINDOWS ? limpia.toLowerCase() : limpia;
}

/**
 * ¿`hijo` está dentro de `raiz` (o es `raiz`)?
 * @param {string} hijo - ruta ya normalizada.
 * @param {string} raiz - ruta ya normalizada.
 * @returns {boolean}
 */
export function estaDentro(hijo, raiz) {
  const a = comparable(hijo);
  const b = comparable(raiz);
  if (a === b) return true;
  return a.startsWith(b.endsWith(sep) ? b : b + sep);
}

/**
 * Resolver el espacio de una tarea, o negarse con un motivo útil.
 * @param {{casa: string, pedido?: string, cwdPorDefecto: string}} opciones
 * @returns {{espacio: string, raiz: string, raices: string[], avisos: string[]}}
 */
export function resolverEspacio({ casa, pedido, cwdPorDefecto }) {
  const ajustes = ajustesMcp(casa);
  const avisos = [...ajustes.avisos];
  const raices = ajustes.workspaces.length > 0
    ? ajustes.workspaces.map(normalizarRuta)
    : [normalizarRuta(ajustes.workspacePorDefecto ?? cwdPorDefecto)];
  if (ajustes.workspaces.length === 0) {
    avisos.push('la casa no tiene `mcp.workspaces`: sólo se permite ' + raices[0]);
  }

  const candidato = pedido === undefined || pedido === null || String(pedido).trim() === ''
    ? raices[0]
    : normalizarRuta(String(pedido));

  if (!existsSync(candidato)) {
    throw new Error('el espacio de trabajo no existe: ' + candidato);
  }
  if (!statSync(candidato).isDirectory()) {
    throw new Error('el espacio de trabajo no es una carpeta: ' + candidato);
  }

  const raiz = raices.find((r) => estaDentro(candidato, r));
  if (raiz === undefined) {
    throw new Error(
      'el espacio de trabajo ' + candidato + ' está fuera de los espacios autorizados ('
      + raices.join(', ') + '). Si de verdad quieres trabajar ahí, añádelo a `mcp.workspaces` en '
      + casa + '\\settings.yaml y vuelve a llamarme.',
    );
  }
  return { espacio: candidato, raiz, raices, avisos };
}

/**
 * Qué modo de sandbox se usará, y por qué.
 * @param {{casa: string, allowDangerous?: boolean}} opciones
 * @returns {{modo: 'workspace-write'|'danger-full-access', motivo: string}}
 */
export function resolverModo({ casa, allowDangerous }) {
  if (allowDangerous !== true) {
    return { modo: 'workspace-write', motivo: 'por defecto: escritura sólo dentro del espacio de trabajo' };
  }
  const ajustes = ajustesMcp(casa);
  if (!ajustes.permitirPeligroso) {
    throw new Error(
      'me pides `allow_dangerous` pero la casa no lo tiene permitido. Para habilitarlo, pon '
      + '`mcp: { permitir_peligroso: true }` en ' + casa + '\\settings.yaml. Hasta entonces, la tarea '
      + 'corre en `workspace-write`: puede leer fuera, pero sólo escribe dentro del espacio de trabajo.',
    );
  }
  return { modo: 'danger-full-access', motivo: 'autorizado por la casa (`mcp.permitir_peligroso`) y pedido en la llamada' };
}

/** Un valor YAML entre comillas simples, sin sorpresas con las barras de Windows. */
function yamlSeguro(texto) {
  return "'" + String(texto).replace(/'/g, "''") + "'";
}

/**
 * El parche que se le pasa al hijo para FIJAR su política, pase lo que pase en
 * el entorno heredado. Es la única pieza que el MCP le añade al perfil `sdk`.
 * @param {{modo: string, espacio: string}} opciones
 * @returns {string} contenido YAML del overlay `--patch`.
 */
export function parcheDePolitica({ modo, espacio }) {
  return [
    '# Generado por RATACODE-MCP para UNA tarea. No editar: se reescribe en cada llamada.',
    '# Fija el modo del sandbox y la raíz del espacio de trabajo de esta tarea, por encima',
    '# de lo que diga el entorno heredado.',
    '- id: sandbox-policy',
    '  config:',
    '    mode: ' + modo,
    '    workspaceRoot: ' + yamlSeguro(espacio),
    '',
  ].join('\n');
}
