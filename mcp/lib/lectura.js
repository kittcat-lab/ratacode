/**
 * lectura — la verdad incómoda sobre LEER, y la puerta que la hace explícita.
 *
 * Medido en el motor (no es opinión, y está comprobado con el código delante):
 *   · `dsh-fs-sandbox/lib/types/index.d.ts:7-8` — «this package adds only the
 *     per-call POLICY fence on the two mutations. Reads pass through untouched:
 *     every mode permits reading.»
 *   · `dsh-sandbox/lib/types/roots.d.ts:28-36` — la ÚNICA lista de raíces que
 *     el motor sabe derivar es la de ESCRITURA (`writableRoots`).
 *   · `dsh-sandbox-windows-acl/lib/types/index.d.ts:24-25` — «writes are
 *     restricted; reads, network, and process visibility are NOT
 *     (WRITE_RESTRICTED intersects only write accesses)».
 *   · El vocabulario de modos es `read-only | workspace-write |
 *     danger-full-access` (`dsh-sandbox/lib/types/index.d.ts:19`) y es un eje de
 *     EFECTOS SOBRE FICHEROS: `read-only` deniega toda MUTACIÓN, no toda
 *     lectura.
 *
 * O sea: NO hay modo, ni ajuste, ni plugin en DSH que encierre la LECTURA. Ni
 * por las herramientas de ficheros ni por el shell. Por eso el espacio de
 * trabajo de una tarea MCP encierra lo que ESCRIBE, y no lo que LEE: una tarea
 * puede leer cualquier fichero que pueda leer el usuario que arrancó el
 * servidor — incluida `<casa>\.credentials.yaml` y las claves del SSH.
 *
 * Consecuencia, y es la razón de este módulo: el MCP por HTTP (y con él el
 * túnel) NO se abre solo. Exige que el humano escriba `--acepto-lectura-total`
 * después de leer lo que implica. Por stdio no hace falta: la superficie la
 * controla quien arranca su propio cliente MCP local.
 *
 * Comprobado en vivo (R9, 27-sep, con un modelo local): una tarea con
 * `working_directory` dentro del espacio autorizado leyó un fichero de FUERA y
 * devolvió su contenido exacto en `respuesta`.
 */

/** El texto que se enseña al negarse, con el mando exacto que hay que escribir. */
export function textoNegativa(mando) {
  return [
    'RATACODE-MCP · PARA.',
    '',
    '  Me pides abrir el MCP más allá de tu propio PC (por HTTP o por el túnel) y no',
    '  puedo darte la promesa que querrías: el motor NO sabe encerrar la LECTURA.',
    '  Con la URL en la mano (la clave va en la URL), quien la tenga puede pedir una',
    '  tarea que lea CUALQUIER fichero que pueda leer tu usuario: las claves de',
    '  <casa>\\.credentials.yaml, tu .ssh, tus documentos. El espacio de trabajo',
    '  encierra lo que la tarea ESCRIBE; lo que LEE, no. Y esa tarea manda lo que',
    '  lea al proveedor del modelo.',
    '',
    '  Medido en el motor, no es opinión:',
    '    · dsh-fs-sandbox/lib/types/index.d.ts:7-8',
    '      «Reads pass through untouched: every mode permits reading.»',
    '    · dsh-sandbox/lib/types/roots.d.ts:28-36: la única lista de raíces que',
    '      existe es la de ESCRITURA (writableRoots).',
    '    · dsh-sandbox-windows-acl/lib/types/index.d.ts:24-25',
    '      «writes are restricted; reads, network, and process visibility are NOT».',
    '',
    '  Si aun así lo quieres (por ejemplo, para ChatGPT web en TU PC), dilo tú',
    '  mismo en la línea de órdenes:',
    '',
    '      ' + mando,
    '',
    '  Y no lo dejes abierto más de lo que dure el trabajo.',
    '',
  ].join('\n');
}

/**
 * La puerta: sin aceptación explícita, se para y se explica.
 * @param {{aceptado: boolean, mando: string, salida?: {write: (t: string) => void}}} opciones
 * @returns {boolean} true si se puede seguir.
 */
export function exigirAceptoLecturaTotal({ aceptado, mando, salida = process.stderr }) {
  if (aceptado === true) return true;
  salida.write(textoNegativa(mando));
  return false;
}
