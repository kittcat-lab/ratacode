/**
 * tareas — el registro de trabajos del MCP.
 *
 * Estados: `queued` → `running` → `completed` | `failed` | `cancelled`.
 * Se guardan en `<casa>/mcp/tareas/<id>.json` (para poder mirarlos sin
 * pantalla y para que el panel los lea) y se resume el conjunto en
 * `<casa>/mcp/estado.json`.
 *
 * Una tarea = un hijo del motor. Cancelar = matar ese hijo. Por eso el estado
 * nunca miente: si el hijo se fue, la tarea está terminada.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { anotar } from './actividad.js';
import { ajustesMcp } from './casa.js';
import { apuntarSesionEnEspacio } from './espacios.js';
import { lanzarTarea } from './nucleo.js';

/** Un id corto y ordenable. */
function nuevoId() {
  const sello = Date.now().toString(36);
  const azar = Math.random().toString(36).slice(2, 6);
  return 't-' + sello + '-' + azar;
}

/** El registro de tareas de una casa. */
export class Tareas {
  /**
   * @param {{casa: string, dshBin: string}} opciones - la casa y el motor.
   */
  constructor({ casa, dshBin }) {
    this.casa = casa;
    this.dshBin = dshBin;
    /** @type {Map<string, object>} */
    this.mapa = new Map();
    /** @type {Set<string>} */
    this.clientes = new Set();
  }

  /** La carpeta de tareas. */
  get carpeta() {
    return join(this.casa, 'mcp', 'tareas');
  }

  /** Anotar que un cliente se ha presentado (para el panel). */
  verCliente(nombre) {
    if (typeof nombre === 'string' && nombre.trim() !== '') this.clientes.add(nombre.trim());
  }

  /**
   * Lanzar una tarea.
   * @param {object} peticion - prompt, ruta de modelo, espacio, modo y límites.
   * @returns {object} el recibo (task_id y estado).
   */
  crear(peticion) {
    const taskId = nuevoId();
    const registro = {
      task_id: taskId,
      estado: 'queued',
      prompt: peticion.prompt,
      prompt_resumen: peticion.prompt.replace(/\s+/g, ' ').trim().slice(0, 200),
      provider: peticion.provider,
      model: peticion.model,
      espacio: peticion.espacio,
      modo: peticion.modo,
      max_tokens: peticion.maxTokens ?? null,
      timeout_ms: peticion.timeoutMs ?? null,
      // R27 · los topes de la tarea (pasos y tokens): viajan con ella para que
      // `get_task_result` pueda decir POR QUÉ se paró.
      pasos_max: peticion.pasosMax ?? null,
      tokens_max: peticion.tokensMax ?? null,
      tope_alcanzado: null,
      cliente: peticion.cliente ?? 'MCP',
      creada: new Date().toISOString(),
      empezada: null,
      terminada: null,
      duracion_ms: null,
      respuesta: null,
      pasos: 0,
      tokens: null,
      coste: null,
      motivo: null,
      errores: [],
      cancelada: false,
      session_id: null,
    };
    this.mapa.set(taskId, registro);
    this.persistir(registro);
    this.resumir();

    const mando = lanzarTarea({
      id: taskId,
      casa: this.casa,
      dshBin: this.dshBin,
      espacio: peticion.espacio,
      raices: peticion.raices,
      provider: peticion.provider,
      model: peticion.model,
      prompt: peticion.prompt,
      maxTokens: peticion.maxTokens,
      timeoutMs: peticion.timeoutMs,
      modo: peticion.modo,
      pasosMax: peticion.pasosMax,
      tokensMax: peticion.tokensMax,
    });
    registro._mando = mando;
    registro.estado = 'running';
    registro.empezada = new Date().toISOString();
    this.apuntarEnElPanel(registro);
    this.persistir(registro);
    this.resumir();

    const cierre = mando.promesa.then((salida) => {
      registro.session_id = salida.session_id;
      registro.duracion_ms = salida.duracion_ms;
      registro.respuesta = salida.texto === '' ? null : salida.texto;
      registro.pasos = salida.pasos;
      registro.tokens = salida.tokens?.informado === true
        ? { input: salida.tokens.input, output: salida.tokens.output, total: salida.tokens.total, cache_read: salida.tokens.cache_read, cache_write: salida.tokens.cache_write, reasoning: salida.tokens.reasoning }
        : null;
      registro.motivo = salida.motivo;
      // R27 · si la paró un tope (pasos o tokens), se apunta con la tarea.
      registro.tope_alcanzado = salida.tope_alcanzado ?? null;
      registro.errores = salida.errores;
      registro.cancelada = salida.cancelada === true;
      registro.codigo_salida = salida.codigo_salida;
      registro.coste = this.calcularCoste(registro);
      registro.terminada = new Date().toISOString();
      if (registro.cancelada) registro.estado = 'cancelled';
      else if (salida.ok === true) registro.estado = 'completed';
      else registro.estado = 'failed';
      delete registro._mando;
      // Y otra vez, ya cerrada: el panel puede haber reescrito su copia del
      // registro mientras la tarea corría, y la sesión tiene que seguir ahí.
      this.apuntarEnElPanel(registro);
      this.persistir(registro);
      this.resumir();
      anotar(this.casa, {
        cliente: registro.cliente,
        modelo: registro.model,
        proveedor: registro.provider,
        tarea: registro.prompt,
        duracion_ms: registro.duracion_ms,
        tokens_input: registro.tokens?.input ?? null,
        tokens_output: registro.tokens?.output ?? null,
        coste: registro.coste?.total ?? null,
        estado: registro.estado,
        espacio: registro.espacio,
        task_id: registro.task_id,
      });
    });
    /** Se resuelve cuando la tarea ha cerrado de verdad (lo espera `cancelar`). */
    registro._cierre = cierre;

    return this.recibo(registro);
  }

  /**
   * Apuntar la sesión de ESTA tarea en el registro de espacios de la casa, que
   * es de donde el panel saca la barra lateral: así cada tarea del MCP se ve en
   * el panel, con su conversación, y deja de ser una caja negra (R12 §3, R16 §3).
   * Nunca puede tumbar una tarea: si el registro no se deja escribir, se apunta
   * el motivo y se sigue.
   * @param {object} registro - la tarea.
   */
  apuntarEnElPanel(registro) {
    try {
      const salida = apuntarSesionEnEspacio(this.casa, registro.espacio, 'mcp-' + registro.task_id);
      registro.en_panel = salida.apuntada === true;
      if (salida.apuntada === true) delete registro.aviso_panel;
      else registro.aviso_panel = salida.motivo ?? 'no se pudo apuntar la sesión en el panel';
    } catch (e) {
      registro.en_panel = false;
      registro.aviso_panel = e instanceof Error ? e.message : String(e);
    }
    if (registro.session_id === null) registro.session_id = 'mcp-' + registro.task_id;
    return registro.en_panel;
  }

  /** El estado de una tarea, o un error claro si no existe. */
  estado(taskId) {
    const registro = this.exigir(taskId);
    return {
      task_id: registro.task_id,
      estado: registro.estado,
      provider: registro.provider,
      model: registro.model,
      espacio: registro.espacio,
      modo: registro.modo,
      cliente: registro.cliente,
      creada: registro.creada,
      empezada: registro.empezada,
      terminada: registro.terminada,
      duracion_ms: registro.duracion_ms,
      pasos: registro.pasos,
      cancelada: registro.cancelada,
      motivo: registro.motivo,
      tope_alcanzado: registro.tope_alcanzado ?? null,
      errores: registro.errores,
      coste: registro.coste,
      sesion_en_el_panel: registro.en_panel === true,
      aviso_panel: registro.aviso_panel ?? null,
    };
  }

  /** El resultado de una tarea. Si aún no terminó, se dice, no se inventa. */
  resultado(taskId) {
    const registro = this.exigir(taskId);
    if (registro.estado === 'queued' || registro.estado === 'running') {
      throw new Error('la tarea ' + taskId + ' sigue en «' + registro.estado + '». Espera y vuelve a preguntar (get_task_status).');
    }
    return {
      task_id: registro.task_id,
      estado: registro.estado,
      respuesta: registro.respuesta,
      modelo: registro.model,
      proveedor: registro.provider,
      espacio: registro.espacio,
      tokens: registro.tokens,
      coste: registro.coste,
      duracion_ms: registro.duracion_ms,
      pasos: registro.pasos,
      motivo: registro.motivo,
      tope_alcanzado: registro.tope_alcanzado ?? null,
      errores: registro.errores,
      cancelada: registro.cancelada,
      session_id: registro.session_id,
      sesion_en_el_panel: registro.en_panel === true,
    };
  }

  /**
   * Esperar a que una tarea cierre, como mucho `ms`. Si ya había cerrado, se
   * resuelve al momento: no se duerme de más. Nunca lanza por tardar — devuelve
   * si terminó o no, y quien llama decide qué contar.
   * @param {string} taskId - el id que devolvió `crear`.
   * @param {number} ms - tope de espera, en milisegundos.
   * @returns {Promise<{terminada: boolean, esperada_ms: number, estado: string}>}
   */
  async esperar(taskId, ms) {
    const registro = this.exigir(taskId);
    const empezado = Date.now();
    const viva = registro.estado === 'queued' || registro.estado === 'running';
    if (viva && registro._cierre !== undefined) {
      let temporizador;
      try {
        await Promise.race([
          registro._cierre,
          new Promise((listo) => { temporizador = setTimeout(listo, ms); }),
        ]);
      } finally {
        if (temporizador !== undefined) clearTimeout(temporizador);
      }
    }
    return {
      terminada: registro.estado !== 'queued' && registro.estado !== 'running',
      esperada_ms: Date.now() - empezado,
      estado: registro.estado,
    };
  }

  /** Cancelar: se mata el hijo de esa tarea. El recibo no miente: se espera a que la tarea cierre. */
  async cancelar(taskId) {
    const registro = this.exigir(taskId);
    if (registro.estado === 'queued' || registro.estado === 'running') {
      if (registro._mando !== undefined) {
        // `cancelar` mata el árbol y termina la tarea; el estado se escribe cuando
        // la promesa se resuelve, así que aquí se espera antes de contestar.
        registro._mando.cancelar('cancelada por el cliente');
        await registro._cierre;
      } else {
        registro.cancelada = true;
        registro.estado = 'cancelled';
        this.persistir(registro);
        this.resumir();
      }
    }
    return this.estado(taskId);
  }

  /** Todas las tareas de esta sesión del servidor (las últimas primero). */
  listar() {
    return [...this.mapa.values()]
      .sort((a, b) => (a.creada < b.creada ? 1 : -1))
      .map((registro) => this.recibo(registro));
  }

  /** El recibo corto de una tarea. */
  recibo(registro) {
    return {
      task_id: registro.task_id,
      estado: registro.estado,
      provider: registro.provider,
      model: registro.model,
      espacio: registro.espacio,
      modo: registro.modo,
      cliente: registro.cliente,
    };
  }

  /** Una tarea del registro, o un error que dice qué ids hay. */
  exigir(taskId) {
    const registro = this.mapa.get(String(taskId));
    if (registro === undefined) {
      const conocidas = [...this.mapa.keys()].slice(-10);
      throw new Error('no conozco la tarea «' + taskId + '»'
        + (conocidas.length === 0 ? ' (todavía no hay ninguna)' : '. Las últimas que he visto: ' + conocidas.join(', ')));
    }
    return registro;
  }

  /**
   * El coste, sólo si el humano declaró precios en `mcp.precios`.
   * Si no hay precios o no hay tokens, se devuelve null: no se inventa.
   */
  calcularCoste(registro) {
    if (registro.tokens === null) return null;
    const precios = ajustesMcp(this.casa).precios;
    const porProveedor = precios[registro.provider];
    if (porProveedor === null || typeof porProveedor !== 'object') return null;
    const entrada = porProveedor[registro.model];
    if (entrada === null || typeof entrada !== 'object') return null;
    const porEntrada = typeof entrada.entrada_por_millon === 'number' ? entrada.entrada_por_millon : null;
    const porSalida = typeof entrada.salida_por_millon === 'number' ? entrada.salida_por_millon : null;
    if (porEntrada === null || porSalida === null) return null;
    const deEntrada = (registro.tokens.input / 1_000_000) * porEntrada;
    const deSalida = (registro.tokens.output / 1_000_000) * porSalida;
    return {
      moneda: typeof entrada.moneda === 'string' ? entrada.moneda : 'EUR',
      entrada: Number(deEntrada.toFixed(6)),
      salida: Number(deSalida.toFixed(6)),
      total: Number((deEntrada + deSalida).toFixed(6)),
      origen: 'mcp.precios (declarado a mano en la casa)',
    };
  }

  /** Guardar una tarea en disco (sin el mando ni la promesa de cierre, que son de memoria). */
  persistir(registro) {
    try {
      mkdirSync(this.carpeta, { recursive: true });
      const { _mando, _cierre, ...guardable } = registro;
      writeFileSync(join(this.carpeta, registro.task_id + '.json'), JSON.stringify(guardable, null, 2) + '\n');
    } catch {
      // Que no poder escribir el cuaderno no tumbe la tarea.
    }
  }

  /** El estado del servidor, para el panel y para `--status`. */
  resumir() {
    const tareas = [...this.mapa.values()];
    const activas = tareas.filter((t) => t.estado === 'queued' || t.estado === 'running').length;
    const estado = {
      mcp: 'on',
      casa: this.casa,
      motor: this.dshBin,
      actualizado: new Date().toISOString(),
      tareas_totales: tareas.length,
      tareas_activas: activas,
      clientes: [...this.clientes],
      ultima: tareas.length === 0 ? null : {
        task_id: tareas[tareas.length - 1].task_id,
        estado: tareas[tareas.length - 1].estado,
        cliente: tareas[tareas.length - 1].cliente,
        model: tareas[tareas.length - 1].model,
        terminada: tareas[tareas.length - 1].terminada,
      },
    };
    try {
      mkdirSync(join(this.casa, 'mcp'), { recursive: true });
      writeFileSync(join(this.casa, 'mcp', 'estado.json'), JSON.stringify(estado, null, 2) + '\n');
    } catch {
      // Igual que arriba: el cuaderno no puede tumbar el servicio.
    }
    return estado;
  }
}

/**
 * Leer el cuaderno de actividad de la casa (lo que ya pasó, aunque el servidor
 * se haya reiniciado). Sólo lectura.
 * @param {string} casa - la casa de RATACODE.
 * @param {number} cuantas - cuántas líneas devolver (las últimas).
 * @returns {object[]} las líneas más recientes primero.
 */
export function leerActividad(casa, cuantas = 20) {
  const ruta = join(casa, 'mcp', 'actividad.jsonl');
  if (!existsSync(ruta)) return [];
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
  const salida = [];
  for (const linea of lineas.slice(-cuantas).reverse()) {
    try {
      salida.push(JSON.parse(linea));
    } catch {
      // Una línea rota no invalida el cuaderno.
    }
  }
  return salida;
}

/**
 * Un resumen de la casa para `ratacode-mcp --status`, sin arrancar el motor.
 * @param {string} casa - la casa de RATACODE.
 * @returns {object} estado del MCP y del cuaderno.
 */
export function estadoDeLaCasa(casa) {
  const ruta = join(casa, 'mcp', 'estado.json');
  const guardado = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null;
  const carpetaTareas = join(casa, 'mcp', 'tareas');
  const cuantas = existsSync(carpetaTareas) ? readdirSync(carpetaTareas).filter((n) => n.endsWith('.json')).length : 0;
  return {
    mcp: guardado === null ? 'sin_arrancar' : 'on',
    casa,
    estado_guardado: guardado,
    tareas_en_disco: cuantas,
    ultimas: leerActividad(casa, 5),
  };
}
