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
 *     OJO, y es lo que se midió en R25: fijar `sandbox-policy` NO bastaba. La
 *     casa de fábrica trae `permission.defaultPreset: danger-full-access`
 *     (`fabrica/settings.yaml`) y ese ajuste se aplica AL CREAR la sesión
 *     (`dsh-permission-presets/README.md:64`), así que ganaba al parche. Por eso
 *     el parche APAGA la fila `permission` en el hijo del MCP: sin ese servicio,
 *     el modo que manda es el de `sandbox-policy`, que es el nuestro. El panel
 *     del usuario no se toca: sigue con el preset que él elija.
 *
 * 3 · SIN VÍAS DE ESCAPE. Un modo de escritura no sirve de nada si el agente
 *     puede abrir una terminal y escribir por ella. El parche apaga las filas
 *     de las herramientas que ejecutan, navegan o delegan (abajo, una por una).
 *
 * 4 · LA LECTURA, CON GANCHO. El motor no sabe acotar la lectura (ni un modo,
 *     ni un ajuste, ni un plugin: mira `lib/lectura.js`). Se acota con el gancho
 *     `tools/pre-execute` de `@deepseek-ai/dsh-hooks-claude-code`, que recibe
 *     cada llamada antes de ejecutarse y la puede DENEGAR. El parche monta ese
 *     gancho con las raíces autorizadas, y el guion es `lib/lectura.js`.
 *
 * 5 · LO PELIGROSO SE PIDE DOS VECES. `allow_dangerous` en la llamada no basta:
 *     hace falta que el humano haya encendido `mcp.permitir_peligroso` en la
 *     casa. Si no, se deniega y se explica. Nunca se queda esperando una
 *     aprobación que no existe: en un servidor MCP no hay a quién preguntar.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ajustesMcp } from './casa.js';
import { canonica, comparable, estaDentro, normalizarRuta } from './lectura.js';

/** El fichero del cerco de lectura (el plugin que se copia junto al parche). */
const GUION_DEL_CERCO = fileURLToPath(new URL('./lectura.js', import.meta.url));

/**
 * Las herramientas del motor que SE APAGAN en toda tarea del MCP, con el motivo
 * de cada una (ids reales de la composición `sdk`, volcada con `--dump-config`).
 *
 *   · `tool-pwsh` y `tool-bash` — una terminal escribe fuera del cerco y lee
 *     fuera del cerco: es la vía de escape entera.
 *   · `tool-jobs` — `job_kill` mata procesos que la tarea no arrancó y
 *     `job_output` lee lo que dejaron: control de procesos fuera del cerco.
 *   · `tool-web` — `web_search`/`web_fetch` sacan a la red lo que la tarea lea
 *     (y traen de fuera lo que sea, saltándose el cerco de ficheros).
 *   · `tool-subagent`, `tool-subagent-fork`, `tool-subagent-control`,
 *     `tool-subagent-list-agents` — delegan en otro agente: otra puerta con
 *     herramientas que no son de esta tarea.
 *   · `tool-workflow` — ejecuta un guion de JavaScript que orquesta subagentes.
 *   · `tool-ralph` — el bucle «Ralph» arranca agentes nuevos (subagentes).
 */
export const HERRAMIENTAS_QUE_SE_APAGAN = [
  ['tool-pwsh', 'una terminal ejecuta y lee fuera del cerco'],
  ['tool-bash', 'una terminal ejecuta y lee fuera del cerco'],
  ['tool-jobs', 'job_kill mata procesos ajenos; job_output lee lo que dejaron'],
  ['tool-web', 'la red saca de la máquina lo que la tarea lea'],
  ['tool-subagent', 'delega en otro agente, con sus propias herramientas'],
  ['tool-subagent-fork', 'delega en otro agente heredando esta conversación'],
  ['tool-subagent-control', 'habla con agentes ya lanzados y los interrumpe'],
  ['tool-subagent-list-agents', 'enumera y alcanza agentes de otras sesiones'],
  ['tool-workflow', 'un guion de JavaScript orquesta subagentes a escala'],
  ['tool-ralph', 'el bucle Ralph arranca agentes nuevos'],
];

/**
 * ¿Es la raíz de un disco (`C:\`, `/`)? Un espacio de trabajo así es todo el
 * disco, y en modo HTTP eso no se admite.
 * @param {string} ruta - ruta ya normalizada.
 * @returns {boolean}
 */
export function esRaizDeDisco(ruta) {
  const limpia = ruta.endsWith(sep) && ruta.length > 1 ? ruta.slice(0, -1) : ruta;
  return /^[a-z]:$/i.test(limpia) || limpia === '' || limpia === '/';
}

/**
 * ¿Es la carpeta del usuario (o la que los contiene a todos)? En modo HTTP no se
 * admite como espacio de trabajo: con la URL en la mano sería el PC entero a un
 * `working_directory` de distancia.
 * @param {string} ruta - ruta ya normalizada.
 * @returns {boolean}
 */
export function esCarpetaDeUsuario(ruta) {
  const a = comparable(ruta);
  return a === comparable(normalizarRuta(homedir())) || a === comparable(normalizarRuta(dirname(homedir())));
}

/**
 * Resolver el espacio de una tarea, o negarse con un motivo útil.
 * @param {{casa: string, pedido?: string, cwdPorDefecto: string, http?: boolean}} opciones
 * @returns {{espacio: string, raiz: string, raices: string[], avisos: string[]}}
 */
export function resolverEspacio({ casa, pedido, cwdPorDefecto, http = false }) {
  const ajustes = ajustesMcp(casa);
  const avisos = [...ajustes.avisos];

  // En modo HTTP (el del túnel) el espacio se aprieta: sin `mcp.workspaces`
  // declarados no se trabaja. Si no, la única raíz sería la carpeta desde la que
  // arrancó el servidor —que puede ser la carpeta de usuario entera— y con la
  // URL en la mano eso es el disco ajeno.
  if (http && ajustes.workspaces.length === 0) {
    throw new Error(
      'en modo HTTP hacen falta espacios declarados: pon `mcp.workspaces:` en ' + casa
      + '\\settings.yaml con las carpetas donde puede trabajar (y `workspace_por_defecto:` si quieres'
      + ' una por defecto). Sin esa lista, la única raíz sería la carpeta desde la que arrancó el'
      + ' servidor, y eso, con la URL en la mano de cualquiera, es demasiado.',
    );
  }

  let raices = ajustes.workspaces.length > 0
    ? ajustes.workspaces.map(normalizarRuta)
    : [normalizarRuta(ajustes.workspacePorDefecto ?? cwdPorDefecto)];
  if (ajustes.workspaces.length === 0) {
    avisos.push('la casa no tiene `mcp.workspaces`: sólo se permite ' + raices[0]);
  }

  // Ni la raíz de un disco ni la carpeta del usuario como espacio: se niegan en
  // modo HTTP, que es el que se expone. (En local el humano arrancó el servidor
  // en su propia carpeta a propósito, y ahí manda él.)
  if (http) {
    const permitidas = raices.filter((r) => !esRaizDeDisco(r) && !esCarpetaDeUsuario(r));
    for (const fuera of raices.filter((r) => !permitidas.includes(r))) {
      avisos.push('espacio demasiado ancho, lo ignoro: ' + fuera
        + ' (ni la raíz de un disco ni tu carpeta de usuario valen como espacio de trabajo en modo HTTP)');
    }
    if (permitidas.length === 0) {
      throw new Error(
        'no queda ningún espacio de trabajo admisible: ni la raíz de un disco ni tu carpeta de usuario ('
        + homedir() + ' y ' + dirname(homedir()) + ') valen. Declara `mcp.workspaces` en '
        + casa + '\\settings.yaml con carpetas de trabajo de verdad.',
      );
    }
    raices = permitidas;
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
  if (http && (esRaizDeDisco(candidato) || esCarpetaDeUsuario(candidato))) {
    throw new Error(
      'el espacio de trabajo ' + candidato + ' es demasiado ancho para modo HTTP: ni la raíz de un'
      + ' disco ni tu carpeta de usuario valen. Usa una carpeta de trabajo de verdad.',
    );
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
      + 'corre en `workspace-write`: escribe sólo dentro del espacio de trabajo (y lee, en los dos casos,'
      + ' sólo dentro de las carpetas autorizadas: mira `lib/lectura.js`).',
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
 *
 * Cinco bloques, y cada uno está por un motivo medido:
 *   1. el modo y la raíz de escritura de esta tarea;
 *   2. `permission` APAGADO: la casa puede tener
 *      `permission.defaultPreset: danger-full-access` (es lo que trae la fábrica,
 *      y es lo que el panel del usuario necesita), y ese ajuste se aplica al
 *      crear la sesión y ganaría a (1). Sin ese servicio manda (1);
 *   3. las herramientas que ejecutan, navegan o delegan, apagadas una a una
 *      ({@link HERRAMIENTAS_QUE_SE_APAGAN});
 *   4. el cerco de la LECTURA: se inserta `./lectura.js` (el plugin que copia
 *      {@link copiarCerco}) con las carpetas autorizadas dentro;
 *   5. nada más: no se toca ni un fichero del motor.
 *
 * El `insert` es la única forma de AÑADIR una fila (un parche con `id` sólo
 * retoca una que ya exista: `cordis-plugin-include/lib/index.js:67-89`), y el
 * nombre `./lectura.js` se resuelve desde la CARPETA DEL PARCHE
 * (`cordis-plugin-loader/lib/index.js:273-278`), o sea, `<casa>\mcp\tmp\`.
 * @param {{modo: string, espacio: string, raices?: string[]}} opciones
 * @returns {string} contenido YAML del overlay `--patch`.
 */
export function parcheDePolitica({ modo, espacio, raices }) {
  const lineas = [
    '# Generado por RATACODE-MCP para UNA tarea. No editar: se reescribe en cada llamada.',
    '# Fija el modo del sandbox, apaga las vías de escape y monta el cerco de lectura,',
    '# por encima de lo que diga el entorno heredado o los ajustes de la casa.',
    '- id: sandbox-policy',
    '  config:',
    '    mode: ' + modo,
    '    workspaceRoot: ' + yamlSeguro(espacio),
    '',
    '# La casa de fábrica trae `permission.defaultPreset: danger-full-access` y ese ajuste',
    '# se aplica AL CREAR la sesión, ganando al modo de arriba. Aquí se apaga el servicio de',
    '# presets en el hijo del MCP: sin él, el modo que manda es el de `sandbox-policy`.',
    '- id: permission',
    '  disabled: true',
    '',
    '# Sin terminal, sin red, sin subagentes y sin guiones: nada con lo que saltar el cerco.',
  ];
  for (const [id, motivo] of HERRAMIENTAS_QUE_SE_APAGAN) {
    lineas.push('', '# ' + id + ': ' + motivo, '- id: ' + id, '  disabled: true');
  }
  lineas.push(
    '',
    '# El cerco de la LECTURA: un plugin de cordis que engancha `tools/pre-execute` y',
    '# deniega la herramienta que lleve una ruta fuera de estas carpetas.',
    '- insert:',
    '    - name: ' + yamlSeguro(NOMBRE_DEL_CERCO),
    '      config:',
    '        raices:',
  );
  const limpias = [...new Set((raices ?? [espacio]).map((r) => normalizarRuta(r)).filter((r) => r !== ''))];
  for (const raiz of limpias) lineas.push('          - ' + yamlSeguro(raiz));
  lineas.push('');
  return lineas.join('\n') + '\n';
}

/** El nombre del fichero del cerco, copiado junto al parche (mismo directorio). */
const NOMBRE_DEL_CERCO = './lectura.js';

/**
 * Dejar el plugin del cerco junto al parche: el motor lo busca por su nombre
 * relativo (`./lectura.js`) desde la carpeta del parche, así que tiene que estar
 * ahí. Se copia el fichero de verdad (el mismo que se prueba), no una copia
 * escrita a mano: lo que se prueba es lo que se monta.
 * @param {string} casa - la casa de RATACODE.
 * @returns {string} la ruta del plugin copiado.
 */
export function copiarCerco(casa) {
  const carpeta = join(casa, 'mcp', 'tmp');
  mkdirSync(carpeta, { recursive: true });
  const destino = join(carpeta, 'lectura.js');
  copyFileSync(GUION_DEL_CERCO, destino);
  return destino;
}

