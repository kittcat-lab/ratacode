/**
 * servidor — las seis herramientas MCP de RATACODE.
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
import { z } from 'zod';
import { ajustesMcp } from './casa.js';
import { catalogo, credencialDeProveedor, resolverRuta } from './modelos.js';
import { faltaEnElEntorno } from './claves.js';
import { aviso } from './registro.js';
import { resolverEspacio, resolverModo } from './seguridad.js';
import { leerActividad, Tareas } from './tareas.js';

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

/** El texto que el cliente MCP lee al conectar: cómo se usa esto. */
function instrucciones(casa) {
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
    'RATACODE sólo mira el ENTORNO del proceso para las credenciales: no lee ficheros de claves. Si falta una, lo dirá tal cual («falta B_AI_API_KEY en el entorno del cliente MCP») y no arrancará nada.',
    'Las tareas ESCRIBEN sólo dentro del espacio de trabajo autorizado; si necesitas algo fuera, pídelo al humano.',
    'AVISO IMPORTANTE: el motor no sabe encerrar la LECTURA. Una tarea puede leer cualquier fichero que pueda leer el usuario que arrancó este servidor (incluida la casa de RATACODE y su .credentials.yaml), y lo que lea se manda al proveedor del modelo. NO leas ficheros de claves ni nada que el humano no te haya dado; si el encargo lo pide, pregúntale antes.',
    'Casa de RATACODE: ' + casa,
  ].join('\n');
}

/**
 * Registrar las seis herramientas en un `McpServer`. Extraído de
 * `montarServidor` para poder crear un servidor por sesión HTTP que COMPARTA
 * el mismo registro de tareas (así `get_task_result` ve las tareas de otras
 * sesiones).
 * @param {McpServer} servidor - el servidor donde registrar.
 * @param {object} ctx - casa, dshBin, cwdPorDefecto, tareas, marcasTarea.
 */
export function registrarHerramientas(servidor, ctx) {
  const { casa, dshBin, cwdPorDefecto, tareas, marcasTarea } = ctx;

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
      description: 'Los proveedores configurados en RATACODE, con si tienen credencial disponible y de dónde sale. Nunca devuelve ninguna clave.',
      inputSchema: {},
    },
    conRed(async () => {
      const { proveedores, porDefecto, avisos } = catalogo(casa);
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
        nota: 'Sólo se mira el ENTORNO del proceso. Este servidor no lee ficheros de credenciales: si falta una clave, se dice y se para.',
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
      const { modelos, porDefecto, avisos } = catalogo(casa);
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
        prompt: z.string().min(1).describe('El encargo, en texto.'),
        esperar_segundos: z.number().int().min(0).max(600).optional().describe('Si lo das, esta llamada espera hasta ese máximo (segundos, 0-600) a que la tarea termine y devuelve el resultado completo en la misma respuesta. Sin este parámetro, vuelve al momento con el task_id y hay que preguntar con get_task_status.'),
        provider: z.string().optional().describe('Proveedor (por ejemplo "b-ai"). Si lo omites, el de por defecto.'),
        model: z.string().optional().describe('Id del modelo (por ejemplo "deepseek-v4.1-flash").'),
        working_directory: z.string().optional().describe('Carpeta donde trabaja la tarea. Debe estar dentro de los espacios autorizados.'),
        context: z.string().optional().describe('Contexto extra que se pone delante del encargo.'),
        max_tokens: z.number().int().positive().optional().describe('Tope de tokens de salida.'),
        timeout: z.number().int().positive().optional().describe('Tiempo máximo en milisegundos antes de cancelar la tarea.'),
        allow_dangerous: z.boolean().optional().describe('Pedir acceso total al disco. Requiere que el humano lo haya permitido en la casa; si no, se deniega.'),
      },
    },
    conRed(async (args) => {
      // Tope de tareas por hora: falla cerrado antes de lanzar nada.
      const ahora = Date.now();
      while (marcasTarea.length > 0 && ahora - marcasTarea[0] > 3600_000) marcasTarea.shift();
      if (marcasTarea.length >= ctx.tareasPorHora) {
        throw new Error(
          'tope de tareas alcanzado: ' + marcasTarea.length + ' en la última hora'
          + ' (máximo ' + ctx.tareasPorHora + '/h). Espera a que pasen las primeras antes de lanzar más.',
        );
      }

      const ruta = resolverRuta(casa, args.provider, args.model);
      // Si la ruta declara una credencial y no está en el entorno, se PARA aquí.
      // Nada de arrancar un motor que va a fallar con un error más oscuro.
      const credencial = credencialDeProveedor(casa, ruta.provider);
      if (credencial !== null && !credencial.esta) {
        return comoError(faltaEnElEntorno(credencial.nombre));
      }
      const { espacio, raiz, avisos } = resolverEspacio({ casa, pedido: args.working_directory, cwdPorDefecto });
      const { modo, motivo } = resolverModo({ casa, allowDangerous: args.allow_dangerous });
      const prompt = args.context === undefined || args.context.trim() === ''
        ? args.prompt
        : 'Contexto:\n' + args.context.trim() + '\n\nTarea:\n' + args.prompt;

      // Sólo contabiliza la tarea si de verdad se lanza (no los intentos
      // denegados por falta de clave o espacio no autorizado).
      marcasTarea.push(Date.now());
      const recibo = tareas.crear({
        prompt,
        provider: ruta.provider,
        model: ruta.model,
        espacio,
        modo,
        maxTokens: args.max_tokens,
        timeoutMs: args.timeout,
        cliente: cliente(),
      });
      const comun = {
        ...recibo,
        ruta_elegida: ruta.origen,
        sandbox: { modo, motivo },
        espacio_autorizado_por: raiz,
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
      description: 'Estado del propio servidor: casa, motor, tareas vivas, clientes conectados y las últimas líneas del cuaderno de actividad.',
      inputSchema: {
        ultimas: z.number().int().min(0).max(50).optional().describe('Cuántas líneas del cuaderno devolver (por defecto 10).'),
      },
    },
    conRed(async ({ ultimas }) => {
      const resumen = tareas.resumir();
      const ajustes = ajustesMcp(casa);
      return comoTexto({
        ...resumen,
        espacios_autorizados: ajustes.workspaces.length > 0 ? ajustes.workspaces : ['(sin lista; sólo el espacio por defecto)'],
        permitir_peligroso: ajustes.permitirPeligroso,
        actividad: leerActividad(casa, ultimas ?? 10),
      });
    }),
  );
}

/**
 * Montar el servidor MCP con sus seis herramientas.
 * @param {{casa: string, dshBin: string, cwdPorDefecto: string, tareasPorHora?: number}} opciones - la casa, el motor, el cwd y el tope.
 * @returns {{servidor: McpServer, tareas: Tareas, fabricaServidor: () => McpServer}}
 */
export function montarServidor({ casa, dshBin, cwdPorDefecto, tareasPorHora = 30 }) {
  const tareas = new Tareas({ casa, dshBin });
  /** Marcas de tiempo de creación de tareas, para el tope por hora. */
  const marcasTarea = [];

  /** Crear un servidor MCP nuevo que COMPARTE el registro de tareas. Sirve para
   * atender cada sesión HTTP con su propio servidor (el SDK no permite conectar
   * un mismo servidor a varios transportes a la vez) sin perder el estado. */
  function fabricaServidor() {
    const servidor = new McpServer(
      { name: 'ratacode', version: '0.1.0' },
      { instructions: instrucciones(casa) },
    );
    registrarHerramientas(servidor, { casa, dshBin, cwdPorDefecto, tareas, marcasTarea, tareasPorHora });
    return servidor;
  }

  const servidor = fabricaServidor();
  return { servidor, tareas, fabricaServidor };
}
