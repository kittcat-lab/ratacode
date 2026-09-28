/**
 * servidor — las siete herramientas MCP de RATACODE.
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
import { Tareas } from './tareas.js';

/** La ventana del tope de tareas. */
const VENTANA_MS = 3600_000;

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
function instrucciones() {
  return [
    'RATACODE está disponible como servidor MCP: úsalo para delegar trabajos a los modelos configurados en esta máquina.',
    '',
    'Antes de ejecutar una tarea:',
    '1. consulta list_models',
    '2. lanza run_task con el modelo que te hayan pedido',
    '3. consulta get_task_status hasta que termine',
    '4. recoge el resultado con get_task_result',
    '',
    'Si no vas a poder volver (un chat de una sola vuelta, un `claude -p`, un `codex exec`), NO uses ese ciclo: lanza run_task con `esperar_segundos` (1-600) y la MISMA llamada te espera y te devuelve el resultado completo. Si no, no termines tu turno hasta que get_task_status diga `completed` o `failed`.',
    'Por stdio, las tareas viven lo que vive el cliente: si el cliente se cierra, el servidor se va y la tarea muere a medias. Por eso, con clientes de una sola vuelta, espera dentro de la llamada.',
    '',
    'No cambies de modelo automáticamente si el usuario ha indicado uno.',
    'RATACODE nunca devuelve claves: las guarda él y hace las llamadas.',
    'Las claves de los modelos están en UN solo sitio: RATACODE › Ajustes › Models (la casa). Este servidor NO mira el entorno del cliente ni abre ficheros de claves: le pregunta al motor si la credencial de esa ruta está puesta. Si no lo está, lo dirá tal cual («Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.») y no arrancará nada.',
    'Las tareas ESCRIBEN sólo dentro del espacio de trabajo autorizado; si necesitas algo fuera, pídelo al humano.',
    'AVISO IMPORTANTE: el motor no sabe encerrar la LECTURA. Una tarea puede leer cualquier fichero que pueda leer el usuario que arrancó este servidor (incluida la casa de RATACODE y su .credentials.yaml), y lo que lea se manda al proveedor del modelo. NO leas ficheros de claves ni nada que el humano no te haya dado; si el encargo lo pide, pregúntale antes.',
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

  /** El nombre del cliente que está al otro lado, para el cuaderno. */
  const cliente = () => {
    const quien = servidor.server.getClientVersion();
    return typeof quien?.name === 'string' && quien.name.trim() !== '' ? quien.name : 'MCP';
  };

  servidor.server.oninitialized = () => {
    const nombre = cliente();
    tareas.verCliente(nombre);
    tareas.resumir();
    aviso('cliente conectado: ' + nombre);
  };

  // ── list_providers ────────────────────────────────────────────────────────
  servidor.registerTool(
    'list_providers',
    {
      title: 'Proveedores de RATACODE',
      description: 'Los proveedores configurados en RATACODE, con si tienen la credencial puesta en la casa (RATACODE › Ajustes › Models). Nunca devuelve ninguna clave.',
      inputSchema: {},
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
  servidor.registerTool(
    'list_models',
    {
      title: 'Modelos de RATACODE',
      description: 'Los modelos disponibles, con proveedor, id, contexto, capacidades, coste declarado y estado. Úsalo ANTES de run_task para elegir modelo.',
      inputSchema: {
        provider: z.string().optional().describe('Filtra por proveedor (por ejemplo "b-ai").'),
      },
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
  servidor.registerTool(
    'run_task',
    {
      title: 'Lanzar una tarea en RATACODE',
      description: 'Manda un trabajo a un modelo de RATACODE. Sin `esperar_segundos` devuelve un task_id al momento y el trabajo sigue en segundo plano (consulta get_task_status y recoge con get_task_result). CON `esperar_segundos` (1-600) la llamada ESPERA hasta que la tarea termine o se agote ese tiempo, y si terminó devuelve el resultado completo en la MISMA respuesta, sin más llamadas: úsalo cuando no puedas volver después (una sola vuelta de chat). Por stdio, la tarea vive lo que vive el cliente: si cierras el cliente, se muere. Si no indicas modelo, se usa el de por defecto de la casa y se te dice cuál.',
      inputSchema: {
        prompt: z.string().min(1).describe('El encargo, en texto. Tope: ' + ajustes.promptMaxCaracteres + ' caracteres (configurable en `mcp.prompt_max_caracteres`).'),
        esperar_segundos: z.number().int().min(0).max(600).optional().describe('Si lo das, esta llamada espera hasta ese máximo (segundos, 0-600) a que la tarea termine y devuelve el resultado completo en la misma respuesta. Sin este parámetro, vuelve al momento con el task_id y hay que preguntar con get_task_status.'),
        provider: z.string().optional().describe('Proveedor (por ejemplo "b-ai"). Si lo omites, el de por defecto.'),
        model: z.string().optional().describe('Id del modelo (por ejemplo "deepseek-v4.1-flash").'),
        working_directory: z.string().optional().describe('Carpeta donde trabaja la tarea. Debe estar dentro de los espacios autorizados.'),
        context: z.string().optional().describe('Contexto extra que se pone delante del encargo.'),
        max_tokens: z.number().int().positive().optional().describe('Tope de tokens de salida.'),
        timeout: z.number().int().positive().optional().describe('Tiempo máximo en milisegundos antes de cancelar la tarea. Por defecto ' + ajustes.timeoutPorDefectoMs + ' ms (' + Math.round(ajustes.timeoutPorDefectoMs / 60000) + ' min); máximo ' + ajustes.timeoutMaximoMs + ' ms.'),
        allow_dangerous: z.boolean().optional().describe('Pedir acceso total al disco. Requiere que el humano lo haya permitido en la casa; si no, se deniega.'),
      },
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
      // La credencial: la de la casa (Ajustes › Models), que es la única fuente.
      // Se le pregunta al motor. Si no está, se PARA aquí: nada de arrancar un
      // motor que va a fallar peor y más tarde.
      const credencial = await credencialDeProveedor(casa, ruta.provider);
      if (credencial !== null && credencial.motivo === null && credencial.configurada === false) {
        return comoError(faltaLaClave(credencial.nombreVisible));
      }
      const { espacio, raiz, avisos } = resolverEspacio({ casa, pedido: args.working_directory, cwdPorDefecto, http: ctx.http === true });
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
        modo,
        maxTokens: args.max_tokens,
        timeoutMs,
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
        avisos,
      };

      // Sin `esperar_segundos`: recibo y a otra cosa (como siempre).
      if (args.esperar_segundos === undefined) {
        return comoTexto({
          ...comun,
          siguiente: 'Consulta get_task_status con este task_id y recoge el resultado con get_task_result. Si no vas a poder volver (una sola vuelta de chat), repite run_task con esperar_segundos (1-600) y te doy el resultado en la misma llamada.',
        });
      }

      // Con `esperar_segundos`: se espera aquí, y si terminó se devuelve TODO.
      const espera = await tareas.esperar(recibo.task_id, args.esperar_segundos * 1000);
      if (espera.terminada) {
        return comoTexto({
          ...comun,
          estado: espera.estado,
          espera: { pedida_segundos: args.esperar_segundos, esperada_ms: espera.esperada_ms, agotada: false },
          resultado: tareas.resultado(recibo.task_id),
          siguiente: 'La tarea ya terminó: el resultado completo va en «resultado». No hace falta get_task_status.',
        });
      }
      return comoTexto({
        ...comun,
        estado: espera.estado,
        espera: { pedida_segundos: args.esperar_segundos, esperada_ms: espera.esperada_ms, agotada: true },
        resultado: null,
        siguiente: 'Se agotaron los ' + args.esperar_segundos + ' s de espera y la tarea sigue en «' + espera.estado + '»: llama a get_task_status (o a get_task_result) hasta que diga completed o failed. Y por stdio la tarea vive lo que vive el cliente: no cierres hasta verla terminada.',
      });
    }),
  );

  // ── get_task_status ───────────────────────────────────────────────────────
  servidor.registerTool(
    'get_task_status',
    {
      title: 'Estado de una tarea',
      description: 'Estado de una tarea: queued, running, completed, failed o cancelled.',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
    },
    conRed(async ({ task_id }) => comoTexto(tareas.estado(task_id))),
  );

  // ── get_task_result ───────────────────────────────────────────────────────
  servidor.registerTool(
    'get_task_result',
    {
      title: 'Resultado de una tarea',
      description: 'La respuesta de una tarea terminada, con modelo, proveedor, tokens, coste (si está declarado), duración y errores.',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
    },
    conRed(async ({ task_id }) => comoTexto(tareas.resultado(task_id))),
  );

  // ── cancel_task ───────────────────────────────────────────────────────────
  servidor.registerTool(
    'cancel_task',
    {
      title: 'Cancelar una tarea',
      description: 'Detiene una tarea en marcha de inmediato (se mata el proceso que la ejecuta).',
      inputSchema: { task_id: z.string().min(1).describe('El task_id que devolvió run_task.') },
    },
    conRed(async ({ task_id }) => comoTexto(await tareas.cancelar(task_id))),
  );

  // ── ratacode_status (extra de casa, para no depender de la pantalla) ──────
  servidor.registerTool(
    'ratacode_status',
    {
      title: 'Estado de RATACODE MCP',
      description: 'Estado del propio servidor: tareas vivas, tope por hora y espacios autorizados. No devuelve la casa ni la actividad de otros clientes.',
      inputSchema: {},
    },
    conRed(async () => {
      const resumen = tareas.resumir();
      // Ni la casa (el dato que sirve en bandeja para ir a leer
      // `.credentials.yaml`), ni el cuaderno de actividad (lleva los encargos de
      // TODOS los clientes), ni las últimas tareas de otros: cada cliente ve lo
      // suyo y el estado del servidor.
      return comoTexto({
        mcp: resumen.mcp,
        actualizado: resumen.actualizado,
        espacios_autorizados: ajustes.workspaces.length > 0 ? ajustes.workspaces : ['(sin lista; sólo el espacio por defecto)'],
        permitir_peligroso: ajustes.permitirPeligroso,
        topes: {
          tareas_por_hora: ctx.tareasPorHora,
          marcas_ultima_hora: marcasTarea.length,
          tareas_a_la_vez: ajustes.tareasALaVez,
          timeout_por_defecto_ms: ajustes.timeoutPorDefectoMs,
          timeout_maximo_ms: ajustes.timeoutMaximoMs,
          prompt_max_caracteres: ajustes.promptMaxCaracteres,
        },
        nota: 'Para ver el cuaderno de actividad y las tareas de todos los clientes, míralo en la casa (o en el panel), no por MCP.',
      });
    }),
  );
}

/**
 * Montar el servidor MCP con sus siete herramientas.
 * @param {{casa: string, dshBin: string, cwdPorDefecto: string, tareasPorHora?: number, http?: boolean}} opciones - la casa, el motor, el cwd, el tope y si se habla por HTTP.
 * @returns {{servidor: McpServer, tareas: Tareas, fabricaServidor: () => McpServer}}
 */
export function montarServidor({ casa, dshBin, cwdPorDefecto, tareasPorHora = 30, http = false }) {
  const tareas = new Tareas({ casa, dshBin });
  /** Marcas de tiempo de creación de tareas, para el tope por hora. Viven en la casa. */
  const marcasTarea = cargarMarcas(casa);
  if (marcasTarea.length > 0) {
    aviso('tope de tareas: ' + marcasTarea.length + ' marca(s) de la última hora, contadas al arrancar');
  }

  /** Crear un servidor MCP nuevo que COMPARTE el registro de tareas. Sirve para
   * atender cada sesión HTTP con su propio servidor (el SDK no permite conectar
   * un mismo servidor a varios transportes a la vez) sin perder el estado. */
  function fabricaServidor() {
    const servidor = new McpServer(
      { name: 'ratacode', version: '0.1.0' },
      { instructions: instrucciones() },
    );
    registrarHerramientas(servidor, { casa, dshBin, cwdPorDefecto, tareas, marcasTarea, tareasPorHora, http });
    return servidor;
  }

  const servidor = fabricaServidor();
  return { servidor, tareas, fabricaServidor };
}
