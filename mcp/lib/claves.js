/**
 * claves — ¿está la credencial? Sólo sí o no, y sin leer nunca el valor.
 *
 * ── REGLA DE LA CASA (R22, 28-sep) ──────────────────────────────────────────
 * La ÚNICA fuente de claves de RATACODE es el almacén de la casa
 * (`<casa>\.credentials.yaml`), que es lo que escribe Ajustes › Models. Este
 * servidor NO mira el entorno del cliente MCP —daba igual que la clave fuera
 * vieja o estuviera rotada, el motor la daba por puesta— y tampoco lee ficheros
 * de claves por su cuenta.
 *
 * La pregunta la contesta el MOTOR, con su propio código: se carga su
 * `LocalCredentialProvider` (el mismo que resuelve las claves cuando corre una
 * tarea) y se le pregunta `describe(<variable>)` → `configured: sí/no`. De ahí
 * no sale ningún valor: sólo si está o no está.
 *
 * Y el hijo del motor que ejecuta cada tarea arranca SIN esas variables (ver
 * {@link variablesDeClaves} y `nucleo.js`), para que resuelva las de la casa.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { leerAjustes } from './casa.js';
import { pathToFileURL } from 'node:url';

/** Las variables de claves que RATACODE conoce de fábrica. */
export const VARIABLES_CONOCIDAS = [
  'B_AI_API_KEY', 'BAI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
  'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'SAMBANOVA_API_KEY', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_API_TOKEN',
];

/** Cómo detener el hijo: si el paquete del motor no se puede cargar, se dice. */
let avisoDelMotor = null;

/**
 * La ruta del `package.json` del motor instalado (la misma que usa `casa.js`).
 * @returns {string} ruta absoluta.
 */
function manifiestoDelMotor() {
  const requerir = createRequire(import.meta.url);
  return requerir.resolve('@deepseek-ai/dsh/package.json');
}

/** El `LocalCredentialProvider` del motor, cargado de SU paquete. Se carga una vez. */
let proveedorPrometido = null;
function proveedorDelMotor() {
  if (proveedorPrometido === null) {
    proveedorPrometido = (async () => {
      const manifiesto = manifiestoDelMotor();
      const requerir = createRequire(manifiesto);
      const ruta = requerir.resolve('@deepseek-ai/dsh-credentials-local');
      const modulo = await import(pathToFileURL(ruta).href);
      return modulo.LocalCredentialProvider;
    })();
  }
  return proveedorPrometido;
}

/**
 * Un entorno de arranque VACÍO: el almacén del motor mira primero las variables
 * del proceso que lo arranca, y aquí lo que queremos es justo lo contrario —
 * que sólo cuente lo guardado en la casa (Ajustes › Models).
 */
const SIN_ENTORNO = {
  get: () => undefined,
  getFrom: () => undefined,
};

/** Lo mínimo que toca el constructor del servicio del motor (no se registra en ningún sitio). */
const CONTEXTO_SUELTO = {
  get: (clave) => (clave === 'launchEnvironment' ? SIN_ENTORNO : undefined),
  reflect: { provide() { /* un servicio suelto: no se registra */ } },
  logger: { info() {}, warn() {}, error() {} },
  effect: () => {},
};

/**
 * ¿Está esta credencial guardada en la casa? Se lo pregunta al almacén del
 * motor, con su `describe`: nunca se lee el fichero a mano y nunca sale un valor.
 * @param {string} casa - la casa de RATACODE.
 * @param {string} nombre - nombre de la variable (p. ej. `B_AI_API_KEY`).
 * @returns {Promise<{configurada: boolean, motivo: string|null}>} `motivo` sólo
 *   cuando NO se ha podido preguntar (y entonces no se puede afirmar nada).
 */
export async function describeEnLaCasa(casa, nombre) {
  if (typeof nombre !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre)) {
    return { configurada: false, motivo: '«' + String(nombre) + '» no es un nombre de variable' };
  }
  try {
    const Proveedor = await proveedorDelMotor();
    const proveedor = new Proveedor(CONTEXTO_SUELTO, {
      path: join(casa, '.credentials.yaml'),
      watch: false,
    });
    await proveedor.loadInitial();
    const dicho = await proveedor.describe(nombre);
    return { configurada: dicho?.configured === true, motivo: null };
  } catch (e) {
    avisoDelMotor = e instanceof Error ? e.message : String(e);
    return { configurada: false, motivo: 'no pude preguntar al almacén de la casa: ' + avisoDelMotor };
  }
}

/**
 * El mensaje exacto cuando falta una clave, con el nombre que ve el humano.
 * @param {string} nombreVisible - el nombre del proveedor («B.AI») o, si no se
 *   sabe, el de la variable.
 * @returns {string} p. ej. `Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.`
 */
export function faltaLaClave(nombreVisible) {
  return 'Falta la clave de ' + nombreVisible + '. Pégala en RATACODE › Ajustes › Models.';
}

/**
 * Las variables de claves que declara ESTA casa (más las conocidas de fábrica):
 * el hijo del motor que ejecuta una tarea arranca sin ninguna de ellas, para
 * que resuelva las claves del almacén de la casa y no las del entorno.
 * @param {string} casa - la casa de RATACODE.
 * @returns {string[]} nombres de variable (nunca un valor).
 */
export function variablesDeClaves(casa) {
  const nombres = new Set(VARIABLES_CONOCIDAS);
  const { documento } = leerAjustes(casa);
  const rutas = [documento['llm-deepseek'], ...Object.values(documento['llm-pi-ai']?.providers ?? {})];
  for (const ruta of rutas) {
    const nombre = ruta?.apiKeyEnv;
    if (typeof nombre === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre)) nombres.add(nombre);
  }
  return [...nombres];
}

/**
 * El entorno de un hijo del motor SIN las variables de claves (se borran por
 * nombre, en mayúsculas: en Windows no distinguen mayúsculas de minúsculas).
 * @param {string} casa - la casa de RATACODE.
 * @param {object} base - el entorno de partida.
 * @returns {object} una copia sin esas variables.
 */
export function entornoDelMotorSinClaves(casa, base) {
  const fuera = new Set(variablesDeClaves(casa).map((n) => n.toUpperCase()));
  const entorno = { ...base };
  for (const nombre of Object.keys(entorno)) {
    if (fuera.has(nombre.toUpperCase())) delete entorno[nombre];
  }
  return entorno;
}

/** La ruta del manifiesto del motor (para mensajes y para las pruebas). */
export { manifiestoDelMotor };
