/**
 * servidor — las herramientas MCP de RATACODE.
 *
 * Esto es una capa FINA: aquí no se decide qué modelo usar (salvo el que la
 * casa ya tiene por defecto, y se dice cuál), no se habla con ningún proveedor
 * y no se toca ninguna clave. Todo el trabajo lo hace el core, por medio del
 * puente (`lib/nucleo.js`).
 *
 * Lo que sí vive aquí son las reglas que el humano pidió: espacio cerrado,
 * nada de acciones peligrosas sin autorización, ni una clave en ninguna
 * respuesta, y un tope de tareas por hora para no gastar de más cuando el
 * servidor está expuesto (sobre todo por el túnel de Cloudflare).
 *
 * R26 · Y TRES HERRAMIENTAS DE SOLO LECTURA, porque hay clientes y planes que
 * sólo dejan usar las que no cambian nada: `ratacode_status`, `list_files` y
 * `read_file`. Las tres van marcadas con `readOnlyHint: true` (es la marca que
 * documenta OpenAI para que el cliente sepa que no cambian estado), no gastan
 * tokens ni claves, y leen SÓLO dentro de las carpetas autorizadas, con el
 * cerco de `lib/lectura.js` comprobado aquí, en el servidor.
 *
 * R27 · Y UNA CORRECCIÓN: con ChatGPT **Pro** y conector propio (modo
 * desarrollador) `run_task` SÍ funciona —medido el 30-sep-2026, con la tarea
 * `mcp-t-mun3aspp-7huh`—, así que el servidor ya no dice en sus instrucciones
 * que la escritura esté vetada por el plan. Las de sólo lectura siguen ahí,
 * porque son más baratas (no gastan nada) y siempre están.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ajustesMcp } from './casa.js';
import { catalogo, credencialDeProveedor, resolverRuta } from './modelos.js';
import { faltaLaClave } from './claves.js';
import { aviso } from './registro.js';
import { resolverEspacio, resolverModo } from './seguridad.js';
import { listarCarpeta, leerFichero, raicesDeLaCasa, TOPE_ENTRADAS } from './carpeta.js';
import { anotarLectura } from './actividad.js';
import { Tareas } from './tareas.js';
import { VERSION } from './version.js';

/** La ventana del tope de tareas. */
const VENTANA_MS = 3600_000;

/**
 * Las marcas de un herramienta de SOLO LECTURA, tal y como las documenta OpenAI
 * (`developers.openai.com/plugins/build/mcp-server`): `readOnlyHint: true` sólo
 * cuando la herramienta NO puede cambiar estado, `destructiveHint: false` y
 * `openWorldHint: false` (lo que se mira es una carpeta acotada de esta
 * máquina, no Internet).
 */
const SOLO_LECTURA = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
/** Y las de una que SÍ cambia cosas (lanza trabajo o lo cancela). */
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

/** Las herramientas que publica este servidor, con si son de sólo lectura. */
const HERRAMIENTAS = [
  ['list_providers', true],
  ['list_models', true],
  ['run_task', false],
  ['get_task_status', true],
  ['get_task_result', true],
  ['cancel_task', false],
  ['ratacode_status', true],
  ['list_files', true],
  ['read_file', true],
];

/** El envoltorio de toda respuesta: JSON legible para cualquier agente. */
function comoTexto(dato) {
  return { content: [{ type: 'text', text: JSON.stringify(dato, null, 2) }] };
}

/** Un error que el agente cliente puede leer y corregir. */
function comoError(mensaje) {
  return { content: [{ type: 'text', text: 'ERROR: ' + mensaje }], isError: true };
}

/** Envolver un manejador para que un fallo salga como error de herramienta. */
function conRed(funcion) {
  return async (args, extra) => {
    try {
      return await funcion(args, extra);
    } catch (e) {
      return comoError(e instanceof Error ? e.message : String(e));
    }
  };
}

/**
 * Envolver un manejador de SÓLO LECTURA para que ADEMÁS quede apuntado en el
 * cuaderno (R27 §1): hora, cliente, herramienta, la ruta que se pidió y si se
 * permitió o se bloqueó. Sin esto, el panel parecía muerto mientras ChatGPT
 * sólo leía (y lo bloqueado —que es lo que el humano quiere ver— no quedaba en
 * ninguna parte).
 *
 * La ruta se saca de los argumentos por las mismas claves que mira el cerco
 * (`CLAVES_DE_RUTA` de `lib/lectura.js`): un texto libre (`prompt`, `context`)
 * no es una ruta.
 * @param {string} casa - la casa de RATACODE.
 * @param {string} herramienta - el nombre de la herramienta.
 * @param {() => string} cliente - el nombre del cliente que está al otro lado.
 * @param {(args: object, extra: object) => Promise<object>} funcion - el manejador de verdad.
 * @returns {Function} el manejador envuelto.
 */
function conCuaderno(casa, herramienta, cliente, funcion) {
  return async (args, extra) => {
    const quien = cliente();
    let ruta = null;
    try { ruta = rutasDeLectura(args ?? {})[0] ?? null; } catch { ruta = null; }
    let respuesta;
    try {
      respuesta = await funcion(args, extra);
    } catch (e) {
      anotarLectura(casa, { cliente: quien, herramienta, ruta, permitido: false, motivo: 'la herramienta falló', detalle: e instanceof Error ? e.message : String(e) });
      throw e;
    }
    const fallo = respuesta?.isError === true;
    anotarLectura(casa, {
      cliente: quien,
      herramienta,
      ruta,
      permitido: !fallo,
      motivo: fallo ? 'bloqueado por el cerco' : null,
      detalle: fallo ? primeraLineaDe(respuesta) : null,
    });
    return respuesta;
  };
}

/** El primer texto de una respuesta de herramienta, para el cuaderno. */
function primeraLineaDe(respuesta) {
  const texto = respuesta?.content?.find?.((b) => b?.type === 'text')?.text ?? '';
  const linea = String(texto).split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
  return linea.replace(/^ERROR:\s*/i, '').slice(0, 200) || null;
}

/**
 * Las claves de los argumentos que llevan una ruta, las MISMAS que mira el
 * cerco (`CLAVES_DE_RUTA` en `lib/lectura.js`, medido en las herramientas del
 * motor) MÁS `ruta`, que es el nombre que usa este servidor en `list_files` y
 * `read_file` (R26). Se repiten aquí a propósito: `lectura.js` viaja copiado al
 * hijo por el parche y no se carga en el servidor. Lo que se apunta con esto es
 * sólo para el cuaderno (la línea de Actividad); el cerco lo aplica el motor.
 */
const CLAVES_DE_RUTA = ['file_path', 'path', 'ruta', 'dir', 'directory', 'cwd', 'working_directory', 'root', 'workspace', 'files', 'paths'];

/** Las rutas que lleva una llamada (primer nivel y objetos de dentro, nunca texto libre). */
function rutasDeLectura(entrada, profundidad = 2) {
  const salida = [];
  if (entrada === null || typeof entrada !== 'object' || profundidad < 0) return salida;
  for (const [clave, valor] of Object.entries(entrada)) {
    if (CLAVES_DE_RUTA.includes(clave)) {
      if (typeof valor === 'string' && valor.trim() !== '') salida.push(valor);
      continue;
    }
    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) salida.push(...rutasDeLectura(valor, profundidad - 1));
  }
  return salida;
}

/**
 * Las marcas del tope por hora, EN LA CASA (`<casa>\mcp\marcas.json`).
 * Antes vivían sólo en memoria: dos servidores, o un reinicio, multiplicaban el
 * tope. Al arrancar se cuentan las de la última hora; al lanzar una tarea se
 * apunta y se guarda.
 */
function cargarMarcas(casa, ahora = Date.now()) {
  try {
    const leidas = JSON.parse(readFileSync(join(casa, 'mcp', 'marcas.json'), 'utf8'));
    if (Array.isArray(leidas)) {
      return leidas
        .filter((t) => typeof t === 'number' && Number.isFinite(t) && ahora - t <= VENTANA_MS)
        .sort((a, b) => a - b);
    }
  } catch { /* sin fichero (o roto): no hay marcas */ }
  return [];
}

/** Guardar las marcas. Si no se puede escribir, la tarea sigue: no es un requisito. */
function guardarMarcas(casa, marcas) {
  try {
    mkdirSync(join(casa, 'mcp'), { recursive: true });
    writeFileSync(join(casa, 'mcp', 'marcas.json'), JSON.stringify(marcas) + '\n', { mode: 0o600 });
  } catch { /* el cuaderno no puede tumbar el servicio */ }
}

/** El texto que el cliente MCP lee al conectar: cómo se usa esto. */
function instrucciones(ajustes) {
  return [
    'RATACODE está disponible como servidor MCP: úsalo para delegar trabajos a los modelos configurados en esta máquina.',
    '',
    'LEER ES GRATIS Y ESCRIBIR TAMBIÉN ESTÁ: ChatGPT Pro (conector propio en modo desarrollador) SÍ puede lanzar `run_task` —medido el 30-sep-2026, con la tarea `mcp-t-mun3aspp-7huh`—, además de las de sólo lectura. Si un plan o un cliente no deja usar `run_task`, quedan `ratacode_status`, `list_files` y `read_file`, que van marcadas como de sólo lectura y no gastan tokens ni claves.',
    '',
    'Antes de ejecutar una tarea:',
    '1. consulta list_models',
    '2. lanza run_task con el modelo que te hayan pedido',
    '3. si la respuesta ya trae el resultado, ya está; si trae un task_id, consulta get_task_status',
    '',
    'NO PREGUNTES EN BUCLE. `run_task` espera solo ' + ajustes.esperaPorDefectoSegundos + ' s: si la tarea acaba dentro, el resultado completo viene en ESA misma respuesta. Si no acaba, devuelve el task_id: entonces llama a get_task_status como mucho UNA VEZ CADA 20 SEGUNDOS (no en bucle), y recoge el resultado con get_task_result cuando diga `completed` o `failed`.',
    'Si no vas a poder volver (un chat de una sola vuelta, un `claude -p`, un `codex exec`), lanza run_task con `esperar_segundos` (1-600) y la MISMA llamada te espera y te devuelve el resultado completo.',
    'Por stdio, las tareas viven lo que vive el cliente: si el cliente se cierra, el servidor se va y la tarea muere a medias. Por eso, con clientes de una sola vuelta, espera dentro de la llamada.',
    '',
    'Cada tarea lleva sus TOPES: ' + ajustes.pasosMax + ' pasos y ' + ajustes.tokensMax + ' tokens (se cambian en la casa, `mcp.pasos_max` y `mcp.tokens_max`). Al llegar a uno, la tarea se para sola y lo dice en `tope_alcanzado`: no la relances en bucle, cuéntaselo al humano.',
    '',
    'No cambies de modelo automáticamente si el usuario ha indicado uno. Si pides un modelo que esta casa no tiene, la herramienta te lo dirá y te dará la lista de los que sí hay.',
    'RATACODE nunca devuelve claves: las guarda él y hace las llamadas.',
    'Las claves de los modelos están en UN solo sitio: RATACODE › Ajustes › Models (la casa). Este servidor NO mira el entorno del cliente ni abre ficheros de claves: le pregunta al motor si la credencial de esa ruta está puesta. Si no lo está, lo dirá tal cual («Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.») y no arrancará nada.',
    'Cada tarea del MCP trabaja ENCERRADA en las carpetas autorizadas de la casa (`mcp.workspaces`): lee y escribe sólo ahí. Fuera de ahí la herramienta se para y te lo dice («Fuera de la carpeta autorizada: <ruta>»). No hay terminal, ni red, ni subagentes, ni guiones: no hay forma de saltar el cerco. Si necesitas algo de fuera, pídelo al humano.',
  ].join('\n');
}

/**
 * Registrar las siete herramientas en un `McpServer`. Extraído de
 * `montarServidor` para poder crear un servidor por sesión HTTP que COMPARTA
 * el mismo registro de tareas (así `get_task_result` ve las tareas de otras
 * sesiones).
 * @param {McpServer} servidor - el servidor donde registrar.
 * @param {object} ctx - casa, dshBin, cwdPorDefecto, tareas, marcasTarea, tareasPorHora, http.
 */
export function registrarHerramientas(servidor, ctx) {
  const { casa, dshBin, cwdPorDefecto, tareas, marcasTarea } = ctx;
  const ajustes = ajustesMcp(casa);

  /** El nombre del cliente que está al otro lado, para el cuaderno. Primero el
   *  del protocolo (`getClientVersion`, que en stdio siempre está); si no, el que
   *  se presentó por HTTP (R27: en modo sin estado el `initialize` viene en otra
   *  petición, así que `lib/http.js` lo pasa al fabricar el servidor). */
  const cliente = () => {
    const quien = servidor.server.getClientVersion();
    if (typeof quien?.name === 'string' && quien.name.trim() !== '') return quien.name;
    return typeof ctx.quien === 'string' && ctx.quien.trim() !== '' ? ctx.quien : 'MCP';
  };

  servidor.server.oninitialized = () => {
    const nombre = cliente();
    tareas.verCliente(nombre);
    tareas.resumir();
    aviso('cliente conectado: ' + nombre);
  };

  /**
   * Registrar una herramienta. Si es de SÓLO LECTURA, además queda apuntada en
   * el cuaderno de la casa (R27 §1): hora, cliente, herramienta, ruta y
   * permitido/bloqueado. Las que escriben ya se apuntan al terminar la tarea.
   * @param {string} nombre - el nombre de la herramienta.
   * @param {object} ficha - título, descripción, esquema y marcas.
   * @param {Function} manejador - el manejador.
   */
  const apuntar = (nombre, ficha, manejador) => {
    const soloLectura = ficha?.annotations?.readOnlyHint === true;
    servidor.registerTool(
      nombre,
      ficha,
      soloLectura ? conCuaderno(casa, nombre, cliente, conRed(manejador)) : conRed(manejador),
    );
  };

  // ── list_providers ────────────────────────────────────────────────────────
  apuntar(
    'list_providers',
    {
      title: 'Proveedores de RATACODE',
      description: 'Los proveedores configurados en RATACODE, con si tienen la credencial puesta en la casa (RATACODE › Ajustes › Models). Nunca devuelve ninguna clave.',
      inputSchema: {},
      annotations: SOLO_LECTURA,
    },
    conRed(async () => {
      const { proveedores, porDefecto, avisos } = await catalogo(casa);
      return comoTexto({
        proveedores: proveedores.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          api: p.api,
          base_url: p.base_url,
          tiene_clave: p.tiene_clave,
          credencial: p.credencial,
          ...(p.falta === null ? {} : { problema: p.falta }),
        })),
        modelo_por_defecto: porDefecto,
        avisos,
        nota: 'La única fuente de claves es la casa (RATACODE › Ajustes › Models).'
          + ' Lo que mira este servidor es si la credencial está puesta ahí, preguntándoselo al motor;'
          + ' nunca lee valores ni mira el entorno del cliente.',
      });
    }),
  );

  // ── list_models ───────────────────────────────────────────────────────────
  apuntar(
    'list_models',
    {
      title: 'Modelos de RATACODE',
      description: 'Los modelos disponibles, con proveedor, id, contexto, capacidades, coste declarado y estado. Úsalo ANTES de run_task para elegir modelo.',
      inputSchema: {
        provider: z.string().optional().describe('Filtra por proveedor (por ejemplo "b-ai").'),
      },
      annotations: SOLO_LECTURA,
    },
    conRed(async ({ provider }) => {
      const { modelos, porDefecto, avisos } = await catalogo(casa);
      const filtrados = provider === undefined ? modelos : modelos.filter((m) => m.provider === provider);
      return comoTexto({
        modelos: filtrados,
        total: filtrados.length,
        modelo_por_defecto: porDefecto,
        avisos: provider !== undefined && filtrados.length === 0
          ? [...avisos, 'no hay modelos declarados para el proveedor «' + provider + '»; mira list_providers']
          : avisos,
        nota: 'El coste sólo aparece si el humano declaró precios en `mcp.precios` de settings.yaml. RATACODE no se inventa precios.',
      });
    }),
  );

  // ── run_task ──────────────────────────────────────────────────────────────
  apuntar(
    'run_task',
    {
      title: 'Lanzar una tarea en RATACODE',
      description: 'Manda un trabajo a un modelo de RATACODE. La llamada ESPERA sola ' + ajustes.esperaPorDefectoSegundos + ' s (lo que diga la casa): si la tarea acaba dentro, el resultado completo va en ESTA respuesta y no hay que preguntar nada más. Si tarda más, devuelve el `task_id` y entonces se pregunta con get_task_status, SIN bucle (como mucho una vez cada 20 s). Con `esperar_segundos` (1-600) se espera lo que digas tú, hasta 600 s: úsalo para un encargo largo si no vas a poder volver. Si no indicas modelo, se usa el de por defecto de la casa y se te dice cuál; si indicas uno, tiene que estar en `list_models`. Cada tarea lleva topes de pasos y tokens (' + ajustes.pasosMax + ' pasos, ' + ajustes.tokensMax + ' tokens): al llegar, se para y lo dice.',
      inputSchema: {
        prompt: z.string().min(1).describe('El encargo, en texto. Tope: ' + ajustes.promptMaxCaracteres + ' caracteres (configurable en `mcp.prompt_max_caracteres`).'),
        esperar_segundos: z.number().int().min(0).max(600).optional().describe('Cuántos segundos espera ESTA llamada a que la tarea acabe antes de contestar (0-600). Si no lo pones, se esperan ' + ajustes.esperaPorDefectoSegundos + ' s (lo que diga `mcp.espera_por_defecto_segundos`): si la tarea acaba dentro, el resultado va en la MISMA respuesta; si no, vuelve el task_id. Ponlo sólo si quieres esperar más (por ejemplo 300 para un encargo largo).'),
        provider: z.string().optional().describe('Proveedor (por ejemplo "b-ai"). Si lo omites, el de por defecto.'),
        model: z.string().optional().describe('Id del modelo (por ejemplo "deepseek-v4.1-flash").'),
        working_directory: z.string().optional().describe('Carpeta donde trabaja la tarea. Debe estar dentro de los espacios autorizados.'),
        context: z.string().optional().describe('Contexto extra que se pone delante del encargo.'),
        max_tokens: z.number().int().positive().optional().describe('Tope de tokens de salida.'),
        timeout: z.number().int().positive().optional().describe('Tiempo máximo en milisegundos antes de cancelar la tarea. Por defecto ' + ajustes.timeoutPorDefectoMs + ' ms (' + Math.round(ajustes.timeoutPorDefectoMs / 60000) + ' min); máximo ' + ajustes.timeoutMaximoMs + ' ms.'),
        allow_dangerous: z.boolean().optional().describe('Pedir acceso total al disco. Requiere que el humano lo haya permitido en la casa; si no, se deniega.'),
      },
      annotations: ESCRIBE,
    },
    conRed(async (args) => {
      // Tope del encargo: un prompt enorme es un gasto enorme y una espera peor.
      if (args.prompt.length > ajustes.promptMaxCaracteres) {
        throw new Error(
          'el encargo es demasiado largo: ' + args.prompt.length + ' caracteres (máximo '
          + ajustes.promptMaxCaracteres + ', `mcp.prompt_max_caracteres` en ' + casa + '\\settings.yaml).'
          + ' Pásame el encargo en un fichero dentro del espacio de trabajo y pídeme que lo lea.',
        );
      }

      // Tope de tareas EN MARCHA a la vez: la URL abierta no puede ser una
      // fábrica de procesos del motor.
      const enMarcha = tareas.listar().filter((t) => t.estado === 'queued' || t.estado === 'running').length;
      if (enMarcha >= ajustes.tareasALaVez) {
        throw new Error(
          'ya hay ' + enMarcha + ' tareas en marcha (máximo ' + ajustes.tareasALaVez + ' a la vez,'
          + ' `mcp.tareas_a_la_vez` en ' + casa + '\\settings.yaml). Espera a que termine alguna'
          + ' (get_task_status) o cancélala (cancel_task).',
        );
      }

      // Tope de tareas por hora: falla cerrado antes de lanzar nada. Las marcas
      // viven en la casa, así que un reinicio no regala cuota.
      const ahora = Date.now();
      while (marcasTarea.length > 0 && ahora - marcasTarea[0] > VENTANA_MS) marcasTarea.shift();
      if (marcasTarea.length >= ctx.tareasPorHora) {
        throw new Error(
          'tope de tareas alcanzado: ' + marcasTarea.length + ' en la última hora'
          + ' (máximo ' + ctx.tareasPorHora + '/h). Espera a que pasen las primeras antes de lanzar más.',
        );
      }

      const ruta = resolverRuta(casa, args.provider, args.model);
      // R27 §7c · EL MODELO SE VALIDA CONTRA EL CATÁLOGO. Si el chat pide un
      // modelo que esta casa no tiene, mejor decírselo AHORA (con la lista de
      // los que sí hay) que lanzar un motor que va a fallar más tarde y peor.
      // Si no pide ninguno, se usa el de la casa y se dice cuál (`ruta.origen`).
      if (typeof args.model === 'string' && args.model.trim() !== '') {
        const { modelos } = await catalogo(casa);
        const suyos = modelos.filter((m) => m.provider === ruta.provider);
        const pedido = args.model.trim();
        const conocido = suyos.some((m) => m.id === pedido || m.model === pedido);
        if (!conocido) {
          return comoError(
            'esta casa no tiene el modelo «' + pedido + '» en el proveedor «' + ruta.provider + '».'
            + ' Los que sí hay: ' + (suyos.length === 0 ? '(ninguno declarado)' : suyos.slice(0, 20).map((m) => m.id).join(', '))
            + '. Míralo con list_models (y no lo cambies por tu cuenta si el humano ha elegido uno).',
          );
        }
      }
      // La credencial: la de la casa (Ajustes › Models), que es la única fuente.
      // Se le pregunta al motor. Si no está, se PARA aquí: nada de arrancar un
      // motor que va a fallar peor y más tarde.
      const credencial = await credencialDeProveedor(casa, ruta.provider);
      if (credencial !== null && credencial.motivo === null && credencial.configurada === false) {
        return comoError(faltaLaClave(credencial.nombreVisible));
      }
      const { espacio, raiz, raices, avisos } = resolverEspacio({ casa, pedido: args.working_directory, cwdPorDefecto, http: ctx.http === true });
      const { modo, motivo } = resolverModo({ casa, allowDangerous: args.allow_dangerous });
      const prompt = args.context === undefined || args.context.trim() === ''
        ? args.prompt
        : 'Contexto:\n' + args.context.trim() + '\n\nTarea:\n' + args.prompt;

      // El tiempo: si el cliente no dice nada, el de la casa (media hora); si
      // dice, se respeta pero nunca por encima del techo.
      const timeoutPedido = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : null;
      const timeoutMs = timeoutPedido === null
        ? ajustes.timeoutPorDefectoMs
        : Math.min(timeoutPedido, ajustes.timeoutMaximoMs);
      const timeoutRecortado = timeoutPedido !== null && timeoutPedido > ajustes.timeoutMaximoMs;

      // Sólo contabiliza la tarea si de verdad se lanza (no los intentos
      // denegados por falta de clave o espacio no autorizado).
      marcasTarea.push(Date.now());
      guardarMarcas(casa, marcasTarea);
      const recibo = tareas.crear({
        prompt,
        provider: ruta.provider,
        model: ruta.model,
        espacio,
        raices,
        modo,
        maxTokens: args.max_tokens,
        timeoutMs,
        // R27 §7b · los topes de la tarea: al llegar, la tarea se para y lo dice.
        pasosMax: ajustes.pasosMax,
        tokensMax: ajustes.tokensMax,
        cliente: cliente(),
      });
      const comun = {
        ...recibo,
        ruta_elegida: ruta.origen,
        sandbox: { modo, motivo },
        espacio_autorizado_por: raiz,
        tiempo: {
          timeout_ms: timeoutMs,
          origen: timeoutPedido === null ? 'por_defecto_de_la_casa' : 'peticion',
          ...(timeoutRecortado ? { recortado_al_maximo_ms: ajustes.timeoutMaximoMs } : {}),
        },
        topes: {
          pasos_max: ajustes.pasosMax,
          tokens_max: ajustes.tokensMax,
          nota: 'Si la tarea llega a uno de estos topes, se para sola y lo dice en «tope_alcanzado».',
        },
        avisos,
      };

      // R27 §7a · LO QUE SE ESPERA, POR DEFECTO. Antes, sin `esperar_segundos`,
      // esta llamada volvía al momento con el task_id y el chat tenía que
      // preguntar en bucle (cuota y tiempo perdidos). Ahora se espera lo que
      // diga la casa (`mcp.espera_por_defecto_segundos`, 25 s de fábrica): si la
      // tarea acaba dentro, el resultado va en ESTA respuesta; si no, se devuelve
      // el task_id y se dice que no pregunte en bucle.
      const esperaSegundos = typeof args.esperar_segundos === 'number' && args.esperar_segundos > 0
        ? args.esperar_segundos
        : ajustes.esperaPorDefectoSegundos;
      const espera = await tareas.esperar(recibo.task_id, esperaSegundos * 1000);
      if (espera.terminada) {
        return comoTexto({
          ...comun,
          estado: espera.estado,
          espera: {
            pedida_segundos: esperaSegundos,
            por_defecto: args.esperar_segundos === undefined,
            esperada_ms: espera.esperada_ms,
            agotada: false,
          },
          resultado: tareas.resultado(recibo.task_id),
          siguiente: 'La tarea ya terminó: el resultado completo va en «resultado». No hace falta get_task_status.',
        });
      }
      return comoTexto({
        ...comun,
        estado: espera.estado,
        espera: {
          pedida_segundos: esperaSegundos,
          por_defecto: args.esperar_segundos === undefined,
          esperada_ms: espera.esperada_ms,
          agotada: true,
        },
        resultado: null,
        siguiente: 'Se agotaron los ' + esperaSegundos + ' s de espera y la tarea sigue en «' + espera.estado
          + '». NO preguntes en bucle: espera al menos 20 s entre get_task_status (o usa get_task_status con la tarea ya cerrada).'
          + ' Y por stdio la tarea vive lo que vive el cliente: no cierres hasta verla terminada.',
      });
    }),
  );

  // ── get_task_status ───────────────────────────────────────────────────────
  apuntar(
    'get_task_status',
    {
      title: 'Estado de una tarea',
      description: 'Estado de una tarea: queued, running, completed, failed o cancelled.',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
      annotations: SOLO_LECTURA,
    },
    conRed(async ({ task_id }) => comoTexto(tareas.estado(task_id))),
  );

  // ── get_task_result ───────────────────────────────────────────────────────
  apuntar(
    'get_task_result',
    {
      title: 'Resultado de una tarea',
      description: 'La respuesta de una tarea terminada, con modelo, proveedor, tokens, coste (si está declarado), duración y errores.',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
      annotations: SOLO_LECTURA,
    },
    conRed(async ({ task_id }) => comoTexto(tareas.resultado(task_id))),
  );

  // ── cancel_task ───────────────────────────────────────────────────────────
  apuntar(
    'cancel_task',
    {
      title: 'Cancelar una tarea',
      description: 'Detiene una tarea en marcha de inmediato (se mata el proceso que la ejecuta).',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
      annotations: ESCRIBE,
    },
    conRed(async ({ task_id }) => comoTexto(await tareas.cancelar(task_id))),
  );

  // ── ratacode_status (extra de casa, para no depender de la pantalla) ──────
  apuntar(
    'ratacode_status',
    {
      title: 'Estado de RATACODE MCP',
      description: 'Estado del propio servidor: si está vivo, su versión, las herramientas que publica, las carpetas autorizadas, las sesiones (clientes) que han hablado con él y los topes. No devuelve la casa, ni las claves, ni la actividad de otros clientes. Úsalo al empezar, para saber con qué cuentas.',
      inputSchema: {},
      annotations: SOLO_LECTURA,
    },
    conRed(async () => {
      const resumen = tareas.resumir();
      const { raices, raiz, avisos } = raicesDeLaCasa({ casa, cwdPorDefecto, http: ctx.http === true });
      // Ni la casa (el dato que sirve en bandeja para ir a leer
      // `.credentials.yaml`), ni el motor, ni el cuaderno de actividad (lleva los
      // encargos de TODOS los clientes): cada cliente ve lo suyo, lo que puede
      // tocar y cómo está el servidor.
      const { casa: _casa, motor: _motor, ...servidor } = resumen.mcp;
      return comoTexto({
        vivo: true,
        version: VERSION,
        servidor: { ...servidor, transporte: ctx.http === true ? ['stdio', 'http'] : ['stdio'] },
        herramientas: HERRAMIENTAS.map(([nombre, soloLectura]) => ({ nombre, solo_lectura: soloLectura })),
        carpeta_autorizada: { raiz, raices },
        sesiones: { clientes: resumen.clientes, tareas_totales: resumen.tareas_totales, tareas_activas: resumen.tareas_activas },
        permitir_peligroso: ajustes.permitirPeligroso,
        topes: {
          tareas_por_hora: ctx.tareasPorHora,
          marcas_ultima_hora: marcasTarea.length,
          tareas_a_la_vez: ajustes.tareasALaVez,
          timeout_por_defecto_ms: ajustes.timeoutPorDefectoMs,
          timeout_maximo_ms: ajustes.timeoutMaximoMs,
          prompt_max_caracteres: ajustes.promptMaxCaracteres,
          entradas_por_listado: TOPE_ENTRADAS,
          // R27 §7a/7b · la espera de fábrica y los topes de cada tarea.
          espera_por_defecto_segundos: ajustes.esperaPorDefectoSegundos,
          pasos_max: ajustes.pasosMax,
          tokens_max: ajustes.tokensMax,
        },
        avisos,
        nota: 'Esta herramienta es de SÓLO LECTURA, como list_files y read_file. Para ver el cuaderno de actividad y las tareas de todos los clientes, míralo en la casa (o en el panel), no por MCP.'
          + ' Y una corrección de R27, medida el 30-sep-2026: ChatGPT Pro (conector propio en modo desarrollador) SÍ puede llamar a run_task; las herramientas de escritura no están vetadas por el plan.',
      });
    }),
  );

  // ── list_files (R26 · sólo lectura, para ChatGPT) ─────────────────────────
  apuntar(
    'list_files',
    {
      title: 'Listar una carpeta autorizada',
      description: 'Lista lo que hay en una carpeta de las autorizadas (por defecto, la primera). Sólo lectura: no cambia nada. Si la ruta se sale de las carpetas autorizadas, la herramienta se para y lo dice. Devuelve nombre, tipo, tamaño y fecha de cada entrada.',
      inputSchema: {
        ruta: z.string().optional().describe('Carpeta a listar: relativa a la carpeta autorizada, o absoluta pero DENTRO de ella. Por defecto, la carpeta autorizada.'),
      },
      annotations: SOLO_LECTURA,
    },
    conRed(async ({ ruta }) => {
      const { raices, raiz, avisos } = raicesDeLaCasa({ casa, cwdPorDefecto, http: ctx.http === true });
      if (raices.length === 0) throw new Error('esta casa no tiene ninguna carpeta autorizada: mira los avisos en ratacode_status');
      const listado = listarCarpeta({ ruta: ruta ?? raiz, raices, cwd: raiz });
      return comoTexto({ ...listado, avisos });
    }),
  );

  // ── read_file (R26 · sólo lectura, para ChatGPT) ──────────────────────────
  apuntar(
    'read_file',
    {
      title: 'Leer un fichero autorizado',
      description: 'Devuelve el texto de un fichero que esté DENTRO de las carpetas autorizadas. Sólo lectura: no cambia nada. Si la ruta se sale, la herramienta se para y lo dice; si es binario o muy grande, también (y en ese caso devuelve el principio y avisa).',
      inputSchema: {
        ruta: z.string().min(1).describe('Fichero a leer: relativo a la carpeta autorizada, o absoluto pero DENTRO de ella.'),
      },
      annotations: SOLO_LECTURA,
    },
    conRed(async ({ ruta }) => {
      const { raices, raiz, avisos } = raicesDeLaCasa({ casa, cwdPorDefecto, http: ctx.http === true });
      if (raices.length === 0) throw new Error('esta casa no tiene ninguna carpeta autorizada: mira los avisos en ratacode_status');
      const leido = leerFichero({ ruta, raices, cwd: raiz });
      return comoTexto({ ...leido, raices, avisos });
    }),
  );
}

/**
 * Montar el servidor MCP con sus herramientas.
 * @param {{casa: string, dshBin: string, cwdPorDefecto: string, tareasPorHora?: number, http?: boolean}} opciones - la casa, el motor, el cwd, el tope y si se habla por HTTP.
 * @returns {{servidor: McpServer, tareas: Tareas, fabricaServidor: () => McpServer}}
 */
export function montarServidor({ casa, dshBin, cwdPorDefecto, tareasPorHora = 30, http = false }) {
  const tareas = new Tareas({ casa, dshBin });
  /** Los ajustes de la casa: los usan las herramientas y las instrucciones. */
  const ajustes = ajustesMcp(casa);
  /** Marcas de tiempo de creación de tareas, para el tope por hora. Viven en la casa. */
  const marcasTarea = cargarMarcas(casa);
  if (marcasTarea.length > 0) {
    aviso('tope de tareas: ' + marcasTarea.length + ' marca(s) de la última hora, contadas al arrancar');
  }

  /** Crear un servidor MCP nuevo que COMPARTE el registro de tareas. Sirve para
   * atender cada sesión HTTP con su propio servidor (el SDK no permite conectar
   * un mismo servidor a varios transportes a la vez) sin perder el estado.
   * @param {string|null} [quien] - el cliente que se ha presentado (R27): en modo
   *   sin estado el `initialize` viene en OTRA petición, así que el nombre llega
   *   desde fuera (`lib/http.js`) y con él el cuaderno dice quién llamó. */
  function fabricaServidor(quien = null) {
    const servidor = new McpServer(
      { name: 'ratacode', version: VERSION },
      { instructions: instrucciones(ajustes) },
    );
    registrarHerramientas(servidor, { casa, dshBin, cwdPorDefecto, tareas, marcasTarea, tareasPorHora, http, quien });
    return servidor;
  }

  const servidor = fabricaServidor();
  return { servidor, tareas, fabricaServidor };
}
