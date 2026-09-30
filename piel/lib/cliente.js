/**
 * ratacode-piel · LA CARA DE CLIENTE (mitad de navegador).
 *
 * Ésta es la vía OFICIAL de DSH para añadir una sección al menú de Ajustes:
 * el servicio `slots` del frontend, con
 *   ctx.slots.inject('settings.section', () => ctx.slots.register({...}, Component))
 * (el mismo camino que usa `@deepseek-ai/dsh-client-ui-agent-preset`,
 * `lib/client.js:1519-1526`, y `dsh-client-ui-settings-general`, `:651-661`).
 * El plugin se declara en `package.json` como `dsh.client.platform = "web"` con
 * `exports["./client"]`, y `@deepseek-ai/dsh-client-modules` lo sirve en
 * `/plugins/ratacode-piel/client.js` y lo monta como plugin del navegador.
 *
 * La sección «Conexiones» (R23; en R12 se llamaba de otra manera) son DOS TARJETAS,
 * las dos en español y con pasos 1-2-3:
 *   1) «Claude Code, Codex, OpenClaw…»: copia el texto de ESTA casa (corto, con su
 *      URL) y lo deja en `<casa>\handshake.md`.
 *   2) «ChatGPT y Claude web»: enciende y apaga la conexión (el MCP por HTTP y su
 *      túnel, que los arranca la piel cuando el usuario pulsa), dice su estado en
 *      una palabra, copia la dirección que se pega en ChatGPT y avisa en UNA
 *      línea.
 *
 * R18 · Añade una SEGUNDA sección por la misma vía oficial, «Modelos locales»,
 * con los dos runtimes que corren en el ordenador (Ollama y LM Studio): si están
 * instalados, encendidos o apagados (lo pregunta a `/ratacode/runtimes`, que
 * sondea `/v1/models` sin bloquear la página), sus modelos con una etiqueta
 * corta, el botón de encender/apagar y la recomendación según la tarjeta del PC.
 * Así Ajustes › Models queda SÓLO para las APIs con clave, que es lo que pidió
 * Patxi.
 *
 * R21 · Añade, por la vía OFICIAL de idiomas de DSH (`ctx.locale`), el IDIOMA
 * ESPAÑOL: `addLanguage({id:'es', label:'Español', fallback:'en'})` y un
 * diccionario `es` por CADA espacio de nombres de la interfaz (38 espacios,
 * 1038 textos, medidos del motor instalado). Los textos llegan en
 * `window.__RATACODE_ES`, que deja el index antes que este módulo. El inglés y
 * el chino siguen donde estaban.
 *
 * R21 · Y registra los TRES TEMAS de la casa por la vía OFICIAL de temas
 * (`ctx.theme.register`), con sus fichas de color (los tokens `--dsw-*`); el
 * aspecto se cambia desde Ajustes › General › Appearance y se recuerda.
 *
 * R24 · Añade TRES AVISOS de una línea, en los tres idiomas: bajo el permiso de
 * Ajustes › General (sólo con «A rienda suelta» puesto), arriba en
 * Ajustes › Modelos y bajo la caja del encargo. Los textos van por la vía
 * oficial de idiomas (`ctx.locale.register` de `es`, `en` y `zh` en un espacio
 * de nombres propio) y se pintan en el sitio que les toca; no se toca ningún
 * componente del motor ni ningún ajuste.
 *
 * Este fichero NO es un módulo ES: es un bundle en el formato del cargador de
 * módulos del navegador de DSH (`window.__ModuleLoader__.load({id, factory})`),
 * que sólo REGISTRA una fábrica; el cuerpo se materializa al importarlo.
 * Sólo se piden módulos de la tabla fija de la cáscara (`react`).
 */
window.__ModuleLoader__.load({
  id: 'ratacode-piel',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    /** Alias corto de createElement, para no llenar el fichero de React.… */
    const e = React.createElement;

    /** El CSS de la sección (se inyecta una sola vez, como hace todo plugin). */
    const CSS = [
      // R23 · Conexiones y Modelos locales: lo mínimo para que se lea claro.
      '.mr-cx{display:flex;flex-direction:column;gap:12px;padding:4px 0 18px;max-width:640px}',
      '.mr-cx-tarjeta{border:1px solid var(--dsw-alias-border-secondary,#3a3f45);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:9px}',
      '.mr-cx-cabeza{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mr-cx-nombre{font-weight:600;font-size:15px}',
      '.mr-hs-pre{margin:0;padding:10px;border-radius:8px;background:#0e1012;color:#dfe3e6;font-family:ui-monospace,Consolas,monospace;',
      'font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}',
      '.mr-hs-acciones{display:flex;gap:8px;flex-wrap:wrap}',
      '.mr-hs-accion{cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-secondary,#3a3f45);',
      'background:var(--dsw-alias-bg-secondary,#1b1e21);color:inherit;font:inherit;font-size:12px}',
      '.mr-hs-accion:hover{border-color:#e4f226}',
      '.mr-hs-accion[data-copiado="si"]{border-color:#a6e22e;color:#a6e22e}',
      // R23 · Ajustes › Modelos locales
      '.mr-ml{display:flex;flex-direction:column;gap:12px;padding:4px 0 18px;max-width:760px}',
      '.mr-ml-tarjeta{border:1px solid var(--dsw-alias-border-secondary,#3a3f45);border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:8px}',
      '.mr-ml-cabeza{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mr-ml-nombre{font-weight:600;font-size:15px}',
      '.mr-ml-pildora{border:1px solid var(--dsw-alias-border-secondary,#3a3f45);border-radius:999px;padding:1px 9px;font-size:12px}',
      '.mr-ml-encendido{color:#a6e22e;border-color:#a6e22e}',
      '.mr-ml-apagado{color:#ffb4b4;border-color:#ff6b6b}',
      '.mr-ml-sin{color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      '.mr-ml-paso{display:flex;align-items:baseline;gap:8px;font-size:13px;line-height:19px}',
      '.mr-ml-num{font-weight:700;color:#e4f226;min-width:12px}',
      '.mr-ml-pasoTxt{min-width:0}',
      '.mr-ml-modelo{display:flex;align-items:baseline;gap:8px;font-size:13px;cursor:pointer;text-align:left;',
      'background:none;border:0;border-radius:8px;padding:3px 6px;color:inherit;font-family:inherit}',
      '.mr-ml-modelo:hover{background:var(--dsw-alias-bg-secondary,#1b1e21)}',
      '.mr-ml-id{font-family:ui-monospace,Consolas,monospace;font-size:12px}',
      '.mr-ml-clase{border-radius:6px;padding:1px 7px;font-size:11px}',
      '.mr-ml-si{background:rgba(166,226,46,.14);color:#a6e22e}',
      '.mr-ml-no{background:rgba(255,107,107,.14);color:#ffb4b4}',
      '.mr-ml-duda{background:rgba(154,160,166,.16);color:#c9ced3}',
      '.mr-ml-nota{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      '.mr-ml-aviso{margin:0;font-size:13px;line-height:19px;color:#ffb4b4}',
      '.mr-ml-tarjeta-pc{margin:0;font-size:13px;line-height:20px;font-weight:600}',
      '.mr-ml-acciones{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.mr-ml-boton{display:inline-block;cursor:pointer;text-decoration:none;padding:7px 14px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-secondary,#3a3f45);background:var(--dsw-alias-bg-secondary,#1b1e21);',
      'color:inherit;font:inherit;font-size:13px}',
      '.mr-ml-boton:hover{border-color:#e4f226}',
      '.mr-ml-pre{margin:0;padding:9px;border-radius:8px;background:#0e1012;color:#dfe3e6;font-family:ui-monospace,Consolas,monospace;',
      'font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word}',
      '.mr-ml-avanzado{margin-top:2px}',
      '.mr-ml-avanzado>summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      // R24 · los tres avisos de una línea: el del permiso (Ajustes › General y
      // la caja del encargo) y el de los proveedores (Ajustes › Modelos).
      '.mr-aviso-permiso{margin:0;color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:12px;font-weight:400;line-height:18px}',
      '.mr-aviso-modelos{margin:0 0 4px;color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:13px;font-weight:400;line-height:20px}',
      '.mr-aviso-caja{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width,780px);',
      'margin:0 auto;padding:2px 12px 0;color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:12px;line-height:18px}',
      // R27 §4 · Conexiones: el gasto, los ejemplos y la fila de acciones.
      '.mr-cx-gasto{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a6)}',
      '.mr-cx-ejemplo{margin:0;padding:8px 10px;border-radius:8px;background:#0e1012;color:#dfe3e6;',
      'font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word}',
      '.mr-cx-acciones{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.mr-cx-plan{display:flex;flex-direction:column;gap:6px}',
      // R27 · Ajustes › Actividad: la tabla de lo que pasó por el MCP.
      '.mr-ac{display:flex;flex-direction:column;gap:8px;padding:4px 0 18px;max-width:900px}',
      '.mr-ac-intro{margin:0;font-size:13px;line-height:19px;color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      '.mr-ac-tabla{width:100%;border-collapse:collapse;font-size:12px;line-height:17px}',
      '.mr-ac-tabla th{text-align:left;font-weight:600;color:var(--dsw-alias-label-tertiary,#9aa0a6);',
      'border-bottom:1px solid var(--dsw-alias-border-secondary,#3a3f45);padding:4px 8px 5px 0}',
      '.mr-ac-tabla td{border-bottom:1px solid var(--dsw-alias-border-secondary,#2a2d31);padding:5px 8px 5px 0;vertical-align:top}',
      '.mr-ac-hora{white-space:nowrap;font-family:ui-monospace,Consolas,monospace;font-size:11px}',
      '.mr-ac-si{color:#a6e22e}',
      '.mr-ac-no{color:#ffb4b4}',
      '.mr-ac-tipo{border-radius:6px;padding:1px 7px;font-size:11px;white-space:nowrap}',
      '.mr-ac-tipo-tarea{background:rgba(228,242,38,.14);color:#e4f226}',
      '.mr-ac-tipo-lectura{background:rgba(154,160,166,.16);color:#c9ced3}',
      '.mr-ac-ruta{font-family:ui-monospace,Consolas,monospace;font-size:11px;word-break:break-all}',
      '.mr-ac-pie{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mr-ac-vivo{margin:0;font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6)}',
    ].join('');

    if (typeof document !== 'undefined') {
      const tagId = 'ratacode-piel/secciones.css';
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'ratacode-piel';
        tag.dataset.pluginCss = tagId;
        tag.textContent = CSS;
        document.head.appendChild(tag);
      }
    }

    // ── R24 · LOS TRES AVISOS DE LA CASA, EN LOS TRES IDIOMAS ───────────────
    // Una línea llana cada uno (como los textos de OpenAI y Anthropic), por la
    // vía OFICIAL de idiomas: se registran los diccionarios de `es`, `en` y `zh`
    // en un espacio de nombres propio y el texto que se pinta sale de
    // `ctx.locale.bind`, así que cambia solo al cambiar el idioma en
    // Ajustes › General › Language. El español NO va en `ratacode-es.js`: ese
    // fichero es el diccionario del MOTOR, medido del motor instalado, y aquí
    // son textos nuestros.
    const AVISOS_NS = 'ratacode-avisos';
    const AVISOS = {
      es: {
        'permiso.fullAccess': 'El agente actúa sin pedirte permiso. Úsalo solo en carpetas tuyas.',
        'modelos.proveedor': 'Lo que envías va al proveedor que elijas y se rige por sus condiciones.',
        'conexion.espacio': 'Este chat solo puede leer y escribir en {carpeta}.',
      },
      en: {
        'permiso.fullAccess': 'The agent acts without asking your permission. Use it only in folders of your own.',
        'modelos.proveedor': 'What you send goes to the provider you choose and is governed by its terms.',
        'conexion.espacio': 'This chat can only read and write in {carpeta}.',
      },
      zh: {
        'permiso.fullAccess': '智能体不经你许可就会直接操作。请只在属于你自己的文件夹里使用。',
        'modelos.proveedor': '你发送的内容会交给你选择的提供商，并受其条款约束。',
        'conexion.espacio': '此对话只能在 {carpeta} 中读写。',
      },
    };

    /**
     * R27 §1 · EL TEXTO DE «ACTIVIDAD», en los tres idiomas. Va en su propio
     * espacio de nombres porque es una sección NUEVA de la casa (el motor no
     * tiene ninguna «Actividad»): ahí se ve TODO lo que ha pasado por el MCP,
     * tareas y llamadas de sólo lectura, con su hora, su cliente y su ruta.
     */
    const ACTIVIDAD_NS = 'ratacode-actividad';
    const ACTIVIDAD = {
      es: {
        nav: 'Actividad',
        intro: 'Todo lo que ha pasado por el MCP de esta casa: lo que hicieron los chats (ChatGPT) y las tareas.',
        cuando: 'Hora',
        cliente: 'Cliente',
        que: 'Qué',
        donde: 'Tarea o ruta',
        como: 'Estado',
        tarea: 'tarea',
        lectura: 'lectura',
        permitido: 'permitido',
        bloqueado: 'bloqueado',
        vacio: 'Todavía no hay nada apuntado. En cuanto un chat lea algo o lance una tarea, sale aquí.',
        sinMirar: 'No pude mirar la actividad: ' + '{error}',
        mirando: 'Mirando…',
        ahora: 'en vivo',
      },
      en: {
        nav: 'Activity',
        intro: 'Everything that went through this home’s MCP: what the chats (ChatGPT) did, and the tasks.',
        cuando: 'Time',
        cliente: 'Client',
        que: 'What',
        donde: 'Task or path',
        como: 'State',
        tarea: 'task',
        lectura: 'read',
        permitido: 'allowed',
        bloqueado: 'blocked',
        vacio: 'Nothing recorded yet. As soon as a chat reads something or runs a task, it shows up here.',
        sinMirar: 'I could not read the activity: ' + '{error}',
        mirando: 'Looking…',
        ahora: 'live',
      },
      zh: {
        nav: '活动',
        intro: '本机 MCP 上发生过的一切：聊天（ChatGPT）做过什么，以及任务。',
        cuando: '时间',
        cliente: '客户端',
        que: '类型',
        donde: '任务或路径',
        como: '状态',
        tarea: '任务',
        lectura: '读取',
        permitido: '允许',
        bloqueado: '已阻止',
        vacio: '还没有记录。聊天一读取或运行任务，就会出现在这里。',
        sinMirar: '无法读取活动记录：' + '{error}',
        mirando: '正在查看…',
        ahora: '实时',
      },
    };

    /**
     * El traductor de {@link AVISOS_NS}, en una variable de este ámbito: lo pone
     * `avisosDeLaCasa` (que es quien registra los diccionarios) y lo usa también
     * la tarjeta de «Conexiones», que se pinta en otro momento. Si todavía no
     * está, se dice en español: nunca se queda en blanco.
     */
    let tAvisos = null;
    const AVISO_ESPACIO_ES = 'Este chat solo puede leer y escribir en {carpeta}.';

    /** El traductor de {@link ACTIVIDAD_NS}, puesto por `avisosDeLaCasa`. */
    let tActividad = null;

    /**
     * Un pedido a las rutas de la piel; nunca revienta: devuelve el error.
     * @param {string} ruta - la ruta de la piel.
     * @param {string} metodo - GET o POST.
     * @param {object} [cuerpo] - lo que se manda (JSON), si toca.
     */
    async function pedir(ruta, metodo, cuerpo) {
      try {
        const res = await fetch(ruta, {
          method: metodo,
          credentials: 'same-origin',
          cache: 'no-store',
          ...(cuerpo === undefined ? {} : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(cuerpo),
          }),
        });
        const datos = await res.json().catch(() => null);
        if (datos === null) return { ok: false, error: 'HTTP ' + res.status };
        return datos;
      } catch (err) {
        return { ok: false, error: 'sin conexión con el servidor de la piel (' + (err?.message ?? err) + ')' };
      }
    }

    /** Copiar al portapapeles, con el recurso clásico si no hay API. */
    function copiarAlPortapapeles(texto) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto).then(() => true, () => recursoClasico(texto));
      }
      return Promise.resolve(recursoClasico(texto));
    }
    function recursoClasico(texto) {
      try {
        const caja = document.createElement('textarea');
        caja.value = texto;
        caja.setAttribute('readonly', '');
        caja.style.position = 'fixed';
        caja.style.left = '-9999px';
        document.body.append(caja);
        caja.select();
        const ok = document.execCommand('copy');
        caja.remove();
        return ok;
      } catch { return false; }
    }

    /** Un bloque de texto con su botón de copiar. */
    function Bloque(props) {
      const [copiado, setCopiado] = React.useState(false);
      const copiar = () => {
        Promise.resolve(copiarAlPortapapeles(props.texto)).then((ok) => {
          setCopiado(ok);
          if (ok) setTimeout(() => setCopiado(false), 2200);
        });
      };
      return e('div', { className: 'mr-hs-acciones' },
        e('button', {
          type: 'button',
          className: 'mr-hs-accion',
          'data-copiado': copiado ? 'si' : 'no',
          onClick: copiar,
        }, copiado ? 'Copiado ✓' : props.etiqueta));
    }

    /**
     * La línea de la tarjeta de «Conexiones» (R25): dónde puede leer y escribir
     * ESTE chat. La carpeta la dice el MCP (`/ratacode/conexion` la saca de
     * `mcp.workspaces`), y el idioma lo pone el servicio de idiomas del motor.
     * @param {{carpeta?: string}|null} d - el estado de la conexión, o null.
     * @returns {string} la línea.
     */
    function avisoDeEspacio(d) {
      const carpeta = typeof d?.carpeta === 'string' && d.carpeta !== '' ? d.carpeta : 'la carpeta autorizada';
      if (tAvisos !== null) return tAvisos('conexion.espacio', { carpeta });
      return AVISO_ESPACIO_ES.replace('{carpeta}', carpeta);
    }

    /**
     * R27 · LA BARRA LATERAL, EN CALIENTE.
     *
     * ── EL PROBLEMA (medido en R12 y otra vez en R27) ─────────────────────────
     * Una tarea del MCP SÍ deja su sesión apuntada en `<casa>\storages\workspace.json`
     * (lo hace `mcp\lib\espacios.js`), con su conversación en
     * `<casa>\sessions\mcp-<task>\`, pero el panel en marcha NO la veía: la barra
     * lateral pinta la foto que le dio el servidor al abrir la página, y esa foto
     * no vuelve a pedirse sola. Había que RECARGAR (y por eso parecía que hacía
     * falta reiniciar).
     *
     * ── LA VÍA (la oficial del motor) ─────────────────────────────────────────
     * El servicio de sesiones del motor tiene `refresh()`
     * (`dsh-api-session-controller/lib/client.js`, `ClientSessions.refresh` →
     * `SessionManager.refreshList`), que vuelve a pedir `session.list` al
     * servidor: es lo mismo que hace el panel al reconectar, y con eso la barra
     * lateral se repinta sola. Aquí NO se pinta nada a mano ni se toca ningún
     * componente: se le dice al motor que mire otra vez.
     *
     * Y se le dice CUANDO TOCA: esta skin sondea `/ratacode/mcp/vivo` (barato: dos
     * `readdir`), que trae un SELLO de las tareas de la casa. Si el sello cambió,
     * hay una tarea nueva y se pide el refresco; si no, no se pide nada.
     * @param ctx - contexto del plugin de navegador.
     */
    function vigilarElMcp(ctx) {
      const cada = 2000;
      let selloVisto = null;
      let enCurso = false;
      const mirar = () => {
        if (enCurso) return;
        enCurso = true;
        pedir('/ratacode/mcp/vivo', 'GET').then((r) => {
          if (r.ok !== true) return;
          if (selloVisto === null) { selloVisto = r.sello ?? ''; return; }
          if ((r.sello ?? '') === selloVisto) return;
          selloVisto = r.sello ?? '';
          const sesiones = ctx.get('sessions');
          // Un gancho de DIAGNÓSTICO en la propia ventana (`window.__RATACODE`):
          // deja ver la lista de sesiones del motor y pedir un refresco desde la
          // consola. Es la misma sesión del navegador que ya está mirando esto,
          // así que no enseña nada que la pantalla no enseñe; sirve para poder
          // comprobar la barra lateral SIN recargar (R27).
          if (typeof window !== 'undefined' && sesiones !== undefined) {
            window.__RATACODE = {
              ...(window.__RATACODE ?? {}),
              sesiones: () => sesiones.list?.getSnapshot?.() ?? null,
              refrescarSesiones: () => sesiones.refresh?.(),
            };
          }
          if (sesiones === undefined || typeof sesiones.refresh !== 'function') {
            if (typeof console !== 'undefined') console.info('RATACODE · el MCP tiene una tarea nueva, pero este motor no da el servicio `sessions`: la barra se quedará como estaba hasta recargar');
            return;
          }
          // Se pide el refresco AHORA y OTRA VEZ dentro de unos segundos: la
          // tarea deja su registro al arrancar y su fichero de sesión un momento
          // después, y el panel tiene que ver los dos (si no, la sesión sale sin
          // su conversación).
          Promise.resolve(sesiones.refresh()).then(() => {
            if (typeof console === 'undefined') return;
            const lista = sesiones.list?.getSnapshot?.();
            console.info('RATACODE · el MCP tiene una tarea nueva: lista de sesiones refrescada · ' + JSON.stringify((lista?.ids ?? []).slice(0, 8)));
          }).catch((e) => {
            if (typeof console !== 'undefined') console.info('RATACODE · no pude refrescar la lista de sesiones: ' + (e?.message ?? e));
          });
          setTimeout(() => {
            Promise.resolve(sesiones.refresh()).catch(() => { /* da igual: ya se pidió una vez */ });
          }, 3000);
        }).catch(() => { /* sin servidor de piel: no hay nada que vigilar */ })
          .finally(() => { enCurso = false; });
      };
      mirar();
      setInterval(mirar, cada);
    }

    /**
     * R27 §1 · AJUSTES › ACTIVIDAD: todo lo que ha pasado por el MCP.
     *
     * El cuaderno de la casa (`<casa>\mcp\actividad.jsonl`) llevaba SÓLO las
     * tareas terminadas: mientras ChatGPT leía (que es lo que más hace: mirar,
     * listar y leer ficheros), el panel no enseñaba nada y parecía muerto. Desde
     * R27 el servidor apunta también las llamadas de SÓLO LECTURA —hora, cliente,
     * herramienta, ruta y permitido/bloqueado—, y aquí se ven las dos clases de
     * fila, en vivo (`/ratacode/mcp/vivo` cada 2 s mientras la sección está
     * abierta). Lo bloqueado también sale: es justo lo que el humano quiere ver.
     */
    function SeccionActividad() {
      const t = React.useCallback((clave, vars) => (tActividad === null ? clave : tActividad(clave, vars)), []);
      const [estado, setEstado] = React.useState({ fase: 'cargando' });
      React.useEffect(() => {
        let vivo = true;
        const mirar = () => {
          pedir('/ratacode/mcp/vivo', 'GET').then((r) => {
            if (!vivo) return;
            if (r.ok !== true) { setEstado({ fase: 'error', error: r.error ?? 'error' }); return; }
            setEstado({ fase: 'listo', datos: r });
          });
        };
        mirar();
        const reloj = setInterval(mirar, 2000);
        return () => { vivo = false; clearInterval(reloj); };
      }, []);

      if (estado.fase === 'cargando') return e('div', { className: 'mr-ac' }, e('p', { className: 'mr-ac-intro' }, t('mirando')));

      const filas = estado.fase === 'listo' && Array.isArray(estado.datos.actividad) ? estado.datos.actividad : [];
      const hijos = [
        e('p', { className: 'mr-ac-intro', key: 'intro' }, t('intro')),
      ];
      if (estado.fase === 'error') {
        hijos.push(e('p', { className: 'mr-ml-aviso', key: 'error' }, t('sinMirar', { error: estado.error })));
      }
      if (filas.length === 0) {
        hijos.push(e('p', { className: 'mr-ml-nota', key: 'vacio' }, t('vacio')));
      } else {
        hijos.push(e('table', { className: 'mr-ac-tabla', key: 'tabla' },
          e('thead', {}, e('tr', {},
            e('th', {}, t('cuando')),
            e('th', {}, t('cliente')),
            e('th', {}, t('que')),
            e('th', {}, t('donde')),
            e('th', {}, t('como')))),
          e('tbody', {}, filas.map((f, i) => e(FilaDeActividad, { key: i, fila: f, t })))));
      }
      hijos.push(e('div', { className: 'mr-ac-pie', key: 'pie' },
        e('p', { className: 'mr-ac-vivo' }, t('ahora'))));
      return e('div', { className: 'mr-ac' }, hijos);
    }

    /**
     * Una fila de la tabla de Actividad. Las dos clases de línea del cuaderno
     * (`tarea` y `lectura`) se pintan con las mismas columnas, que es lo que
     * hace que se lean de un vistazo.
     */
    function FilaDeActividad(props) {
      const { fila, t } = props;
      const esTarea = fila.tipo === 'tarea' || fila.tipo === undefined;
      const permitido = fila.permitido === true;
      const bloqueada = esTarea ? (fila.estado === 'failed' || fila.estado === 'cancelled') : !permitido;
      const donde = esTarea
        ? (fila.tarea ?? fila.task_id ?? '')
        : (fila.ruta ?? '');
      const clase = 'mr-ac-tipo mr-ac-tipo-' + (esTarea ? 'tarea' : 'lectura');
      return e('tr', { className: 'mr-ac-fila' },
        e('td', { className: 'mr-ac-hora' }, horaCorta(fila.hora)),
        e('td', {}, fila.cliente ?? 'MCP'),
        e('td', {}, e('span', { className: clase }, esTarea ? t('tarea') : t('lectura'))),
        e('td', { className: 'mr-ac-ruta', title: donde }, donde),
        e('td', { className: bloqueada ? 'mr-ac-no' : 'mr-ac-si' },
          esTarea ? (fila.estado ?? '?') : (permitido ? t('permitido') : t('bloqueado'))));
    }

    /** La hora de una línea del cuaderno, en corto (`HH:MM:SS`). */
    function horaCorta(iso) {
      const cuando = Date.parse(String(iso ?? ''));
      if (!Number.isFinite(cuando)) return String(iso ?? '');
      const d = new Date(cuando);
      const dos = (n) => String(n).padStart(2, '0');
      return dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds());
    }

    /**
     * R23 · La sección «Conexiones» de Ajustes: dos tarjetas, cada una con sus
     * pasos 1-2-3 y un botón por acción. Lo que se explica largo va plegado.
     *
     * R27 §4 · La tarjeta de «ChatGPT y Claude web», con los pasos REALES de
     * ChatGPT (los que se midieron con Patxi) y un plegable «Cómo usarlo» con
     * tres ejemplos listos para pegar. Lo que NO cambia: aquí no se inventa nada
     * —los pasos son los de la documentación de OpenAI y los del propio ChatGPT—
     * y todo lo largo va plegado, como en OpenAI y Anthropic.
     */
    /** R27 · los tres ejemplos que se pegan en ChatGPT. */
    const EJEMPLOS = [
      'Usa RATACODE: dime qué hay en la carpeta',
      'Usa RATACODE: lee <fichero>',
      'Usa RATACODE: pide a RATACODE que <tarea> y enséñame el resultado',
    ];

    function SeccionConexiones() {
      const [texto, setTexto] = React.useState(null);
      const [copiado, setCopiado] = React.useState('');
      const [conexion, setConexion] = React.useState({ fase: 'cargando' });
      const [enCurso, setEnCurso] = React.useState('');
      const [dicho, setDicho] = React.useState('');
      const [plan, setPlan] = React.useState(null);

      const mirarConexion = () => {
        setConexion((previo) => (previo.fase === 'listo' ? { ...previo, fase: 'remirando' } : { fase: 'cargando' }));
        pedir('/ratacode/conexion', 'GET').then((r) => {
          if (!r.ok) { setConexion({ fase: 'error', error: r.error ?? 'error' }); return; }
          setConexion({ fase: 'listo', datos: r });
        });
      };
      React.useEffect(() => { mirarConexion(); }, []);

      const copiarConAviso = (etiqueta, valor) => {
        Promise.resolve(copiarAlPortapapeles(valor)).then((ok) => {
          setCopiado(ok ? etiqueta : '');
          if (ok) setTimeout(() => setCopiado(''), 2200);
        });
      };

      /** El botón «Copiar» de la primera tarjeta: copia y deja el texto en la casa. */
      const pulsarCopiar = () => {
        setDicho('');
        pedir('/ratacode/handshake', 'POST').then((r) => {
          if (!r.ok) { setDicho('No pude prepararlo: ' + (r.error ?? 'error')); return; }
          setTexto(r.texto);
          copiarConAviso('texto', r.texto);
        });
      };

      const botonConexion = (cual) => {
        setDicho('');
        setEnCurso(cual);
        fetch('/ratacode/conexion/' + cual, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
          .then((res) => res.json().catch(() => null))
          .then((r) => {
            setEnCurso('');
            if (r === null) setDicho('No pude hablar con RATACODE.');
            else if (r.ok !== true) setDicho(r.motivo ?? 'No pude hacerlo.');
            if (r !== null && r.estado !== undefined) setConexion({ fase: 'listo', datos: r.estado });
            else mirarConexion();
          })
          .catch(() => { setEnCurso(''); setDicho('No pude hablar con RATACODE.'); });
      };

      /**
       * R27 §3 · «Cambiar clave»: lo ÚNICO que cambia la clave (apagar y
       * encender ya no la toca, para que el conector de ChatGPT siga valiendo).
       */
      const cambiarClave = () => {
        setDicho('');
        setEnCurso('clave');
        fetch('/ratacode/conexion/clave', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
          .then((res) => res.json().catch(() => null))
          .then((r) => {
            setEnCurso('');
            if (r === null) { setDicho('No pude hablar con RATACODE.'); return; }
            setDicho(r.ok === true
              ? 'Clave nueva. Vuelve a copiar la dirección en ChatGPT (el conector viejo ya no vale).'
              : (r.motivo ?? 'No pude cambiar la clave.'));
            if (r.estado !== undefined) setConexion({ fase: 'listo', datos: r.estado });
            else mirarConexion();
          })
          .catch(() => { setEnCurso(''); setDicho('No pude hablar con RATACODE.'); });
      };

      /** R27 §3 · los tres pasos del túnel con nombre (dirección fija). */
      const verPlanDelTunel = () => {
        setDicho('');
        pedir('/ratacode/conexion/tunel-nombrado', 'GET').then((r) => {
          if (r.ok !== true) { setDicho('No pude prepararlo: ' + (r.error ?? 'error')); return; }
          setPlan(r);
        });
      };

      const hijos = [];

      // ── tarjeta 1 · los agentes con navegador ─────────────────────────────
      hijos.push(e('div', { className: 'mr-cx-tarjeta', key: 'agentes' },
        e('div', { className: 'mr-cx-cabeza' }, e('span', { className: 'mr-cx-nombre' }, 'Claude Code, Codex, OpenClaw…')),
        e(Paso, { n: '1' }, 'Copia esto',
          e('button', { type: 'button', className: 'mr-ml-boton', onClick: pulsarCopiar }, copiado === 'texto' ? 'Copiado ✓' : 'Copiar')),
        e(Paso, { n: '2' }, 'Pégalo en tu chat'),
        e(Paso, { n: '3' }, 'Listo'),
        texto === null ? null : e('details', { className: 'mr-ml-avanzado', key: 'ver' },
          e('summary', {}, 'Ver lo que se copia'),
          e('pre', { className: 'mr-hs-pre' }, texto))));

      // ── tarjeta 2 · los chats web (ChatGPT y Claude web) ──────────────────
      const d = conexion.fase === 'listo' ? conexion.datos : null;
      const conectado = d !== null && d.conectado === true;
      // R27 §2 · las dos mitades, por separado: el MCP local puede estar
      // encendido sin túnel (lo normal si no hay `cloudflared`), y eso se dice.
      const localEncendido = d !== null && d.mcpLocal === true;
      const encendida = conectado || localEncendido;
      const tarjeta = [
        e('div', { className: 'mr-cx-cabeza', key: 'cabeza' },
          e('span', { className: 'mr-cx-nombre' }, 'ChatGPT y Claude web'),
          e('span', { className: 'mr-ml-pildora ' + (conectado ? 'mr-ml-encendido' : 'mr-ml-sin'), 'data-estado': conectado ? 'conectado' : 'sin-conectar' },
            conectado ? 'Conectado' : 'Sin conectar'),
          localEncendido && !conectado
            ? e('span', { className: 'mr-ml-pildora mr-ml-duda', 'data-estado': 'local' }, 'MCP local encendido')
            : null),
        e(Paso, { n: '1', key: 'p1' }, 'Enciende la conexión',
          conectado
            ? e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'apagar', onClick: () => botonConexion('apagar') },
              enCurso === 'apagar' ? 'Apagando…' : 'Apagar')
            : e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'encender', onClick: () => botonConexion('encender') },
              enCurso === 'encender' ? 'Encendiendo…' : 'Encender')),
        e(Paso, { n: '2', key: 'p2' }, 'Copia la dirección',
          conectado
            ? e('button', { type: 'button', className: 'mr-ml-boton', onClick: () => copiarConAviso('direccion', d.direccion) },
              copiado === 'direccion' ? 'Copiada ✓' : 'Copiar dirección')
            : null),
        e(Paso, { n: '3', key: 'p3' }, 'En ChatGPT: chatgpt.com/plugins › + › «URL del servidor»: pega la dirección, Autenticación «Sin autenticación», marca la casilla y Crear.'),
        e('p', { className: 'mr-cx-gasto', key: 'gasto' },
          'Leer es gratis; las tareas gastan tu saldo del modelo.'),
        e('p', { className: 'mr-ml-nota', key: 'aviso' }, avisoDeEspacio(d)),
      ];
      // El botón «Apagar» tiene que estar SIEMPRE a la vista cuando está
      // encendida: va también aquí, fuera del paso 1 (que puede quedar estrecho
      // con la dirección copiada al lado).
      if (encendida) {
        tarjeta.push(e('div', { className: 'mr-cx-acciones', key: 'acciones' },
          conectado
            ? e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'apagar-tunel', onClick: () => botonConexion('apagar-tunel') },
              enCurso === 'apagar-tunel' ? 'Cerrando…' : 'Apagar túnel')
            : e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'apagar', onClick: () => botonConexion('apagar') },
              enCurso === 'apagar' ? 'Apagando…' : 'Apagar MCP'),
          e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'cambiar-clave', onClick: () => cambiarClave() },
            enCurso === 'clave' ? 'Cambiando…' : 'Cambiar clave')));
      }
      // Si el túnel no está pero el MCP local sí, se dice POR QUÉ y qué hacer.
      if (d !== null && d.pistaTunel !== null && d.pistaTunel !== undefined) {
        tarjeta.push(e('p', { className: 'mr-ml-nota', key: 'pista' }, d.pistaTunel));
      }
      tarjeta.push(e('details', { className: 'mr-ml-avanzado', key: 'usar' },
        e('summary', {}, 'Cómo usarlo'),
        e('p', { className: 'mr-ml-nota' }, 'Pega uno de estos en ChatGPT (donde «RATACODE» es el nombre que le pusiste al conector):'),
        ...EJEMPLOS.map((uno, i) => e('pre', { className: 'mr-cx-ejemplo', key: 'e' + i }, uno))));
      if (conexion.fase === 'error') {
        tarjeta.push(e('p', { className: 'mr-ml-aviso', key: 'error' }, 'No pude mirar la conexión: ' + conexion.error));
      }
      if (d !== null && !d.nuestro && conectado) {
        tarjeta.push(e('p', { className: 'mr-ml-nota', key: 'ajena' },
          'La encendiste tú (en una ventana): se apaga con Ctrl+C ahí.'));
      }
      // R27 §3 · la dirección del túnel rápido cambia cada vez: se dice en UNA
      // línea, y al lado va el plegable del túnel con nombre (dirección fija).
      const tieneFija = d !== null && d.tunel !== undefined && typeof d.tunel?.fijo === 'string' && d.tunel.fijo !== '';
      tarjeta.push(e('p', { className: 'mr-ml-nota', key: 'efimero', 'data-tunel': tieneFija ? 'fijo' : 'rapido' },
        tieneFija
          ? 'Esta casa tiene túnel con nombre: la dirección NO cambia (https://' + d.tunel.host + '/mcp/…).'
          : 'El túnel rápido (sin cuenta) cambia de dominio cada vez que se enciende; con un túnel con nombre, la dirección es siempre la misma.'));
      tarjeta.push(e('details', { className: 'mr-ml-avanzado', key: 'nombrado' },
        e('summary', {}, 'Dirección fija (túnel con nombre)'),
        e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'plan-tunel', onClick: () => verPlanDelTunel() },
          plan === null ? 'Ver los 3 pasos' : 'Volver a mirar los 3 pasos'),
        plan === null ? null : e('div', { className: 'mr-cx-plan' },
          ...plan.pasos.map((p, i) => e('p', { className: 'mr-ml-nota', key: 'paso' + i }, p)),
          e('p', { className: 'mr-ml-nota', key: 'comandos-titulo' }, 'Los tres comandos, en tu PC:'),
          ...(Array.isArray(plan.comandos) ? plan.comandos : []).map((c, i) => e('pre', { className: 'mr-cx-ejemplo', key: 'cmd' + i }, c)),
          e('p', { className: 'mr-ml-nota', key: 'ajustes-titulo' }, 'Y estas dos líneas en settings.yaml:'),
          e('pre', { className: 'mr-cx-ejemplo', key: 'ajustes' }, (Array.isArray(plan.ajustes) ? plan.ajustes : []).join('\n')),
          e('p', { className: 'mr-ml-nota', key: 'nota' }, plan.nota))));
      // R27 §2 · si la URL del MCP está escrita pero NO contesta como la nuestra
      // (otro programa en ese puerto, o una clave vieja), se dice tal cual: es la
      // diferencia entre «Conectado» y «hay un fichero que miente».
      if (d !== null && d.http !== undefined && d.http !== null && typeof d.http.motivo === 'string' && d.http.motivo !== '') {
        tarjeta.push(e('p', { className: 'mr-ml-aviso', key: 'motivo-http' }, d.http.motivo));
      }
      if (d !== null && !conectado && d.comandos !== undefined) {
        tarjeta.push(e('details', { className: 'mr-ml-avanzado', key: 'comandos' },
          e('summary', {}, 'A mano'),
          e('pre', { className: 'mr-hs-pre' }, d.comandos)));
      }
      if (dicho !== '') tarjeta.push(e('p', { className: 'mr-ml-aviso', key: 'dicho' }, dicho));
      hijos.push(e('div', { className: 'mr-cx-tarjeta', key: 'web' }, tarjeta));

      return e('div', { className: 'mr-cx' }, hijos);
    }

    // ── R23 · Ajustes › Modelos locales (una tarjeta por programa) ──────────

    /** Las tres palabras de estado. Una, y corta. */
    function estadoDe(runtime) {
      if (runtime.encendido) return 'Encendido';
      return runtime.instalado ? 'Apagado' : 'No instalado';
    }

    /** La píldora del estado: verde si está encendido, gris si no. */
    function Pildora(props) {
      const clase = props.estado === 'Encendido' ? 'mr-ml-encendido' : (props.estado === 'Apagado' ? 'mr-ml-apagado' : 'mr-ml-sin');
      return e('span', { className: 'mr-ml-pildora ' + clase, 'data-estado': props.estado }, props.estado);
    }

    /**
     * «1 · Enciéndelo»: el número, el texto y, si toca, su botón al lado.
     */
    function Paso(props) {
      const hijos = Array.isArray(props.children) ? props.children : [props.children];
      return e('div', { className: 'mr-ml-paso' },
        e('span', { className: 'mr-ml-num' }, props.n),
        e('span', { className: 'mr-ml-pasoTxt' }, hijos[0]),
        hijos.slice(1));
    }

    /**
     * Un modelo del runtime: su id, su etiqueta corta y, al pulsarlo, se elige en
     * la caja si se puede.
     */
    function ModeloLocal(props) {
      const m = props.modelo;
      const etiqueta = m.clase === 'agente' ? 'Recomendado' : (m.clase === 'no' ? 'No sirve para agentes' : 'Sin datos');
      const clase = m.clase === 'agente' ? 'mr-ml-si' : (m.clase === 'no' ? 'mr-ml-no' : 'mr-ml-duda');
      return e('button', {
        type: 'button',
        className: 'mr-ml-modelo',
        'data-modelo': m.id,
        title: 'Ponlo en la caja',
        onClick: () => props.onElegir(m.id),
      },
        e('span', { className: 'mr-ml-id' }, m.id),
        e('span', { className: 'mr-ml-clase ' + clase }, etiqueta));
    }

    /** Una tarjeta de programa: nombre, estado, sus pasos y sus botones. */
    function TarjetaRuntime(props) {
      const r = props.runtime;
      const estado = estadoDe(r);
      const hijos = [];
      hijos.push(e('div', { className: 'mr-ml-cabeza', key: 'cabeza' },
        e('span', { className: 'mr-ml-nombre' }, r.nombre),
        e(Pildora, { key: 'p', estado })));

      if (estado === 'No instalado') {
        hijos.push(e(Paso, { key: 'p1', n: '1' }, 'Descárgalo'));
        hijos.push(e('div', { className: 'mr-ml-acciones', key: 'a1' },
          e('a', { className: 'mr-ml-boton', href: r.enlace, target: '_blank', rel: 'noreferrer' }, r.descarga)));
        hijos.push(e(Paso, { key: 'p2', n: '2' }, 'Instálalo y ábrelo'));
        hijos.push(e(Paso, { key: 'p3', n: '3' }, r.pull === null ? 'Descarga un modelo desde la app' : 'Descarga un modelo'));
        if (r.pull !== null) {
          hijos.push(e('div', { className: 'mr-ml-acciones', key: 'a3' },
            e(Bloque, { key: 'c', texto: r.pull, etiqueta: 'Copiar «' + r.pull + '»' })));
        }
      } else if (estado === 'Apagado') {
        if (r.puedeEncender && props.aMano !== true) {
          hijos.push(e('div', { className: 'mr-ml-acciones', key: 'enc' },
            e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'encender', 'data-runtime': r.id, onClick: () => props.onEncender() }, props.encendiendo ? 'Encendiendo…' : 'Encender')));
        } else {
          // No se puede encender desde aquí (o lo hemos intentado y su programa no
          // arrancó): el comando, en UN bloque y con su botón de copiar.
          hijos.push(e(Paso, { key: 'p1', n: '1' }, 'Enciéndelo con este comando'));
          hijos.push(e('pre', { className: 'mr-ml-pre', key: 'pre' }, r.arranque));
          hijos.push(e('div', { className: 'mr-ml-acciones', key: 'acc' },
            e(Bloque, { key: 'c', texto: r.arranque, etiqueta: 'Copiar comando' })));
        }
      } else {
        hijos.push(e('div', { className: 'mr-ml-acciones', key: 'apag' },
          r.puedeApagar
            ? e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'apagar', 'data-runtime': r.id, onClick: () => props.onApagar() }, props.apagando ? 'Apagando…' : 'Apagar')
            : e('span', { className: 'mr-ml-nota', key: 'amano' }, r.apagadoAMano ?? '')));
        if (r.modelos.length === 0) {
          hijos.push(e('p', { className: 'mr-ml-nota', key: 'vacio' },
            r.pull === null ? 'Sin modelos: descarga uno desde la app.' : 'Sin modelos: ' + r.pull));
        } else {
          for (const m of r.modelos) hijos.push(e(ModeloLocal, { key: m.id, modelo: m, onElegir: props.onElegir }));
        }
      }

      hijos.push(e('details', { className: 'mr-ml-avanzado', key: 'avanzado' },
        e('summary', {}, 'Avanzado'),
        e('p', { className: 'mr-ml-nota' }, r.cambiar)));
      return e('div', { className: 'mr-ml-tarjeta', key: r.id, 'data-runtime': r.id, 'data-estado': estado }, hijos);
    }

    /**
     * La pestaña «Modelos locales»: una tarjeta por programa (Ollama y LM Studio),
     * con su estado, sus pasos 1-2-3 y un botón por acción. Nada de explicar
     * tripas: lo avanzado (dirección y puerto) va plegado.
     */
    function SeccionModelosLocales() {
      const [estado, setEstado] = React.useState({ fase: 'cargando' });
      const [enCurso, setEnCurso] = React.useState({});
      const [aMano, setAMano] = React.useState({});
      const [dicho, setDicho] = React.useState('');

      const mirar = () => {
        setEstado((previo) => (previo.fase === 'listo' ? { fase: 'remirando', datos: previo.datos } : { fase: 'cargando' }));
        pedir('/ratacode/runtimes', 'GET').then((r) => {
          if (!r.ok) { setEstado({ fase: 'error', error: r.error ?? 'error' }); return; }
          setEstado({ fase: 'listo', datos: r });
        });
      };
      React.useEffect(() => { mirar(); }, []);

      const accion = (id, cual) => {
        setDicho('');
        setAMano((previo) => ({ ...previo, [id]: false }));
        setEnCurso((previo) => ({ ...previo, [id]: cual }));
        fetch('/ratacode/runtimes/' + cual, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        }).then((res) => res.json().catch(() => null)).then((r) => {
          setEnCurso((previo) => ({ ...previo, [id]: null }));
          if (r === null) { setDicho('No pude hablar con RATACODE.'); mirar(); return; }
          if (r.ok !== true) {
            setDicho(r.motivo ?? 'No pude hacerlo.');
            // No se ha podido desde aquí: la tarjeta deja el COMANDO, que es la
            // otra vía (y así el usuario no se queda sin nada que hacer).
            if (r.aMano === true) setAMano((previo) => ({ ...previo, [id]: true }));
          }
          mirar();
        }).catch(() => {
          setEnCurso((previo) => ({ ...previo, [id]: null }));
          setDicho('No pude hablar con RATACODE.');
        });
      };

      const elegir = (id) => {
        setDicho('');
        elegirModeloEnLaCaja(id).then((ok) => {
          if (!ok) setDicho('No pude ponerlo en la caja: elígelo en el selector de modelos.');
        });
      };

      if (estado.fase === 'cargando') return e('div', { className: 'mr-ml' }, e('p', { className: 'mr-ml-nota' }, 'Mirando…'));
      if (estado.fase === 'error') {
        return e('div', { className: 'mr-ml' },
          e('p', { className: 'mr-ml-aviso' }, 'No pude mirar los programas locales: ' + estado.error),
          e('button', { type: 'button', className: 'mr-ml-boton', onClick: mirar }, 'Volver a mirar'));
      }

      const d = estado.datos;
      const runtimes = Array.isArray(d.runtimes) ? d.runtimes : [];
      return e('div', { className: 'mr-ml' },
        runtimes.map((r) => e(TarjetaRuntime, {
          key: r.id,
          runtime: r,
          encendiendo: enCurso[r.id] === 'encender',
          apagando: enCurso[r.id] === 'apagar',
          aMano: aMano[r.id] === true,
          onEncender: () => accion(r.id, 'encender'),
          onApagar: () => accion(r.id, 'apagar'),
          onElegir: elegir,
        })),
        e('p', { className: 'mr-ml-tarjeta-pc', key: 'pc' },
          d.tarjeta === null || d.tarjeta === undefined
            ? 'No sé qué tarjeta tienes. Recomendados: 8 GB → qwen3:8b · 12 GB → gemma4:12b · 16 GB → gpt-oss:20b · 24 GB → muse-glimmer:30b · Solo CPU → granite4.1:3b'
            : 'Tu tarjeta: ' + d.tarjeta.gb + ' GB → recomendado: ' + (d.recomendado ?? 'qwen3:8b')),
        dicho === '' ? null : e('p', { className: 'mr-ml-aviso', key: 'dicho' }, dicho),
        e('div', { className: 'mr-ml-acciones', key: 'mirar' },
          e('button', { type: 'button', className: 'mr-ml-boton', onClick: mirar }, estado.fase === 'remirando' ? 'Mirando otra vez…' : 'Volver a mirar')));
    }

    /**
     * R23 · Poner un modelo local en la CAJA: se abre el selector de modelos del
     * propio motor y se pulsa el suyo. Es lo que hace un dedo, hecho por código.
     * Si no se puede (el modelo no está en el catálogo de la casa, o el selector
     * no está montado), se devuelve `false` y la pestaña lo dice en una línea.
     * @param id - el id del modelo (`qwen3:8b`).
     * @returns si se ha podido elegir.
     */
    async function elegirModeloEnLaCaja(id) {
      const normal = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
      try {
        const caja = document.querySelector('[data-composer-card]');
        if (caja === null) return false;
        const disparador = [...caja.querySelectorAll('button[aria-haspopup="menu"]')].find((b) => /trigger/.test(String(b.className)));
        if (disparador === undefined) return false;
        disparador.click();
        await esperar(300);
        const celda = [...document.querySelectorAll('[role="menuitem"]')]
          .find((x) => ((x.querySelector('[class*="cellLabel"]')?.textContent ?? '').trim()) === 'Model');
        if (celda !== undefined) { celda.click(); await esperar(400); }
        const opciones = [...document.querySelectorAll('[role="menuitemradio"]')];
        const buscado = normal(id);
        const suyo = opciones.find((o) => normal(o.querySelector('[class*="modelName"]')?.textContent) === buscado)
          ?? opciones.find((o) => normal(o.textContent).includes(buscado));
        if (suyo === undefined) { document.body.click(); return false; }
        suyo.click();
        return true;
      } catch { return false; }
    }

    // ── R21 · EL ESPAÑOL, POR LA VÍA OFICIAL DE IDIOMAS DE DSH ─────────────
    // DSH tiene su propio servicio de idiomas (`ctx.locale`, paquete
    // `@deepseek-ai/dsh-client-locale`) y su fila en Ajustes › General ›
    // Language. Añadir un idioma es EXACTAMENTE esto: declararlo con
    // `addLanguage` y registrar un diccionario por espacio de nombres con
    // `register(ns, 'es', {…})` (README del paquete: «Registering a language
    // pack»). Aquí no se traduce nada sobre la pantalla: eso sería deuda, y
    // cada clave nueva del motor volvería a salir en inglés.
    //
    // Los textos los deja el index en `window.__RATACODE_ES` (activo
    // `piel\activos\ratacode-es.js`, medido del motor instalado). Si no
    // estuviera —una instalación vieja, o el index sin vestir—, se declara el
    // idioma igual y los textos caen al inglés por la cadena de respaldo.
    const IDIOMA = 'es';
    const IDIOMA_ETIQUETA = 'Español';

    /**
     * Declara el español y registra todos sus diccionarios.
     * @param ctx - contexto del plugin de navegador (con `locale`).
     * @returns la lista de espacios de nombres registrados.
     */
    function paqueteDeIdioma(ctx) {
      const diccionarios = (typeof window === 'undefined' ? null : window.__RATACODE_ES) ?? null;
      ctx.effect(
        () => ctx.locale.addLanguage({ id: IDIOMA, label: IDIOMA_ETIQUETA, fallback: 'en' }),
        'ratacode-piel: idioma español',
      );
      if (diccionarios === null) return [];
      const puestos = [];
      for (const [ns, dict] of Object.entries(diccionarios)) {
        if (typeof ns !== 'string' || ns === '' || dict === null || typeof dict !== 'object') continue;
        ctx.effect(() => ctx.locale.register(ns, IDIOMA, dict), 'ratacode-piel: diccionario es · ' + ns);
        puestos.push(ns);
      }
      return puestos;
    }

    // ── R21 · LOS TRES TEMAS, POR LA VÍA OFICIAL DE TEMAS DE DSH ───────────
    // El motor tiene su registro de temas (`ctx.theme`, paquete
    // `@deepseek-ai/dsh-client-ui-theme`): un tema es un id, un `colorScheme` y
    // una ficha de tokens `--dsw-*` que el presentador del propio DSH escribe
    // como estilo en línea en el `body`. Con eso cambia TODO el panel —fondos,
    // textos, botones y su reacción, bordes, iconos— sin repintar nada a mano:
    // los componentes del motor ya leen esos tokens. La paleta de partida es la
    // oscura de verdad del motor (`trabajo\R21\sacar-paleta.mjs`), así que sólo
    // se cambia lo que tiene que cambiar.
    //
    // Lo que el motor NO da (y por eso lo pone la piel, y se dice):
    //   · la fila «Aspecto» nativa está fija a Claro/Oscuro/Sistema
    //     (`AppearanceRow.js`: `CUBES`), sin ranura para sustituirla. Se esconde
    //     por CSS y en su sitio va la fila de RATACODE;
    //   · un id de tema de fuera NO se guarda en los ajustes del motor (su
    //     esquema sólo admite `light`/`dark`/`system`: `THEME_PREFERENCES`), así
    //     que el aspecto elegido se recuerda en la casa (`<casa>\tema.txt`, por
    //     `/ratacode/tema`) y se vuelve a aplicar al abrir.
    const TEMAS = [
      {
        id: 'ratacode-pink',
        etiqueta: 'RATACODE PINK',
        // rosa principal · detalles en amarillo, negro y gris
        principal: '#ff268e', detalle: '#e4f226', acento: '#e4f226',
        // El rosa manda: el botón principal es rosa con texto negro.
        textoDelBoton: '#141612',
        hover: '#ff5aa8',
        suave: '#4a1c33',
        seleccion: '#33232d',
        filoActivo: '#ff268e',
        brillo: { 200: '#ffd6ea', 300: '#ffa8d2', 400: '#ff268e', 450: '#ff268e', 500: '#ff268e', 600: '#c01a68' },
        marca: '#ff268e',
      },
      {
        id: 'ratacode-yellow',
        etiqueta: 'RATACODE YELLOW',
        // amarillo principal · secundarios en rosa, negro y gris
        principal: '#e4f226', detalle: '#ff268e', acento: '#ff268e',
        textoDelBoton: '#141612',
        hover: '#f1ff45',
        suave: '#3a3320',
        seleccion: '#382333',
        filoActivo: '#e4f226',
        brillo: { 200: '#f7ffb0', 300: '#eef86a', 400: '#e4f226', 450: '#e4f226', 500: '#cddb16', 600: '#9aa50f' },
        marca: '#e4f226',
      },
      {
        id: 'minimal',
        etiqueta: 'MINIMAL',
        // todo negro y gris: sólo líneas y pequeños detalles (y sin ratitas)
        principal: '#e8e6df', detalle: '#8c9396', acento: '#b8bdbb',
        textoDelBoton: '#101113',
        hover: '#f5f4ef',
        suave: '#26282b',
        seleccion: '#2a2d31',
        filoActivo: '#8c9396',
        brillo: { 200: '#e8e6df', 300: '#b8bdbb', 400: '#9ba3a5', 450: '#8c9396', 500: '#6f7679', 600: '#545a5d' },
        marca: '#e8e6df',
      },
    ];
    /** El tema de fábrica de RATACODE (el primero de la lista). */
    const TEMA_POR_DEFECTO = TEMAS[0].id;

    /** Los grises de la casa: los mismos en los tres temas (negro y gris). */
    const GRISES = {
      '--dsw-alias-bg-base': '#101113',
      '--dsw-alias-bg-layer-1': '#181a1d',
      '--dsw-alias-bg-layer-2': '#222529',
      '--dsw-alias-bg-layer-3': '#2a2d31',
      '--dsw-alias-bg-overlay': '#26282c',
      '--dsw-alias-bg-module-platform': '#2a2d31',
      '--dsw-alias-bg-multi-select': '#212123',
      '--dsw-alias-bg-skeleton': '#ffffff14',
      '--dsw-alias-border-l1': '#282c30',
      '--dsw-alias-border-l2': '#353a3d',
      '--dsw-alias-border-l3': '#464d52',
      '--dsw-alias-border-l4': '#626b70',
      '--dsw-alias-label-primary': '#f0eee6',
      '--dsw-alias-label-secondary': '#b8bdbb',
      '--dsw-alias-label-tertiary': '#9ba3a5',
      '--dsw-alias-label-dimmed': '#818a8e',
      '--dsw-alias-markdown-code-block': '#15171a',
      '--dsw-alias-markdown-code-block-banner': '#222529',
      '--dsw-alias-markdown-inline-code': '#292d31',
      '--dsw-alias-markdown-placeholder': '#222529',
      '--dsw-alias-markdown-tag': '#222529',
      '--dsw-alias-scrollbar-bg-l1': '#3c3c3d',
      '--dsw-alias-scrollbar-bg-l2': '#545557',
      '--dsw-alias-scrollbar-hover-l1': '#545557',
      '--dsw-alias-scrollbar-hover-l2': '#65676b',
      '--dsw-specific-bubble': '#222529',
      '--dsw-specific-bubble-highlight': '#464d52',
      '--dsw-specific-input-major': '#222529',
      '--dsw-specific-selector': '#2a2d31',
      '--dsw-specific-tip': '#2a2d31',
      '--dsw-specific-menu': '#2a2d31',
      '--dsw-specific-sidebar-fill': '#16181b',
      '--dsw-static-neutral-900': '#0f0f0f',
      '--dsw-static-neutral-850': '#212123',
      '--dsw-static-neutral-800': '#292929',
      '--dsw-static-neutral-bluish-950': '#101113',
      '--dsw-static-neutral-bluish-900': '#181a1d',
      '--dsw-static-neutral-bluish-875': '#181a1d',
      '--dsw-static-neutral-bluish-850': '#222529',
      '--dsw-static-neutral-bluish-800': '#2a2d31',
      '--dsw-static-neutral-bluish-750': '#3a3d42',
      '--dsw-static-neutral-bluish-700': '#464d52',
      '--dsw-static-neutral-bluish-600': '#818a8e',
      '--dsw-static-neutral-bluish-500': '#9ba3a5',
      '--dsw-static-neutral-bluish-400': '#b8bdbb',
      '--dsw-static-neutral-bluish-300': '#c9ced3',
      '--dsw-static-neutral-bluish-200': '#dfe3e6',
      '--dsw-static-neutral-bluish-150': '#e9ecf2',
      '--dsw-static-neutral-bluish-100': '#f0eee6',
      '--dsw-static-neutral-bluish-75': '#f4f2ec',
      '--dsw-static-neutral-bluish-60': '#f7f5ef',
      '--dsw-static-neutral-bluish-50': '#f0eee6',
      '--dsw-static-neutral-600': '#545557',
      '--dsw-static-neutral-550': '#65676b',
      '--dsw-static-neutral-500': '#7f8287',
      '--dsw-static-neutral-400': '#a2a4a6',
      '--dsw-static-neutral-300': '#d4d4d4',
      '--dsw-static-neutral-250': '#dcdcdc',
      '--dsw-static-neutral-200': '#e5e5e5',
      '--dsw-static-neutral-150': '#ededed',
      '--dsw-static-neutral-100': '#f5f5f5',
      '--dsw-static-neutral-50': '#fafafa',
    };

    /**
     * La ficha de tokens de un tema: los grises de la casa + lo que cambia con
     * el color de la marca (marca, botones y su reacción, enlaces, estados,
     * realces, barra lateral y el brillo de «trabajando», que en DSH es azul).
     * @param nivel - una ficha de {@link TEMAS}.
     * @returns el mapa `--dsw-*` → valor.
     */
    function tokensDelTema(nivel) {
      return {
        ...GRISES,
        '--dsw-alias-brand-primary': nivel.principal,
        '--dsw-alias-brand-text': nivel.principal,
        '--dsw-alias-brand-primary-invert': nivel.principal,
        '--dsw-alias-button-primary-fill': nivel.principal,
        '--dsw-alias-button-primary-hover': nivel.hover,
        '--dsw-alias-button-primary-dimmed': nivel.suave,
        '--dsw-alias-label-primary-foreground': nivel.textoDelBoton,
        '--dsw-alias-button-ghost-active-fill': nivel.suave,
        '--dsw-alias-button-ghost-active-border': nivel.principal,
        '--dsw-alias-button-ghost-active-hover': nivel.seleccion,
        '--dsw-alias-button-elevated-fill': '#222529',
        '--dsw-alias-button-floating-fill': '#222529',
        '--dsw-alias-button-floating-hover': '#2a2d31',
        '--dsw-alias-button-contrast-fill': '#f0eee6',
        '--dsw-alias-button-tool-bar-fill': '#222529',
        '--dsw-alias-button-tool-bar-hover': '#30353a',
        '--dsw-alias-interactive-bg-hover': '#292c30',
        '--dsw-alias-interactive-bg-active': nivel.seleccion,
        '--dsw-alias-interactive-bg-hover-solid': '#2a2d31',
        '--dsw-alias-interactive-bg-hover-accent': nivel.suave,
        '--dsw-alias-state-success-primary': nivel.detalle,
        '--dsw-alias-state-success-secondary': nivel.detalle,
        '--dsw-alias-state-success-tertiary': nivel.suave,
        '--dsw-alias-state-warn-primary': nivel.detalle,
        '--dsw-alias-state-warn-secondary': nivel.detalle,
        '--dsw-alias-state-warn-tertiary': nivel.suave,
        '--dsw-alias-state-warn-label': nivel.detalle,
        // El error SÍ tiene que leerse como error en los tres temas: en MINIMAL
        // es un rojo apagado, que es lo más «negro y gris» que sigue avisando.
        '--dsw-alias-state-error-primary': nivel.id === 'minimal' ? '#c9707a' : '#ff5c7a',
        '--dsw-alias-state-error-secondary': nivel.id === 'minimal' ? '#c9707a' : '#ff5c7a',
        '--dsw-alias-state-business-primary': nivel.detalle,
        '--dsw-alias-state-business-tertiary': nivel.suave,
        '--dsw-alias-link': nivel.acento,
        '--dsw-alias-toast-bg': '#2a2d31',
        '--dsw-alias-tooltip-bg': '#2a2d31',
        '--dsw-specific-sidebar-nav-item-active': nivel.suave,
        '--dsw-specific-sidebar-nav-item-active-accent': nivel.filoActivo,
        '--dsw-specific-sidebar-nav-item-hover': '#202225',
        '--dsw-specific-login-input': '#181a1d',
        // El brillo de «trabajando» del motor es azul DeepSeek puro
        // (`--dsw-static-deepseek-*`): aquí pasa a ser el color de la casa.
        '--dsw-static-deepseek-200': nivel.brillo[200],
        '--dsw-static-deepseek-300': nivel.brillo[300],
        '--dsw-static-deepseek-400': nivel.brillo[400],
        '--dsw-static-deepseek-450': nivel.brillo[450],
        '--dsw-static-deepseek-500': nivel.brillo[500],
        '--dsw-static-deepseek-600': nivel.brillo[600],
      };
    }

    /** ¿Es uno de los tres temas de RATACODE? */
    function esTemaNuestro(id) {
      return TEMAS.some((t) => t.id === id);
    }

    /**
     * Registra los tres temas y deja puesto el que la casa recuerde.
     * @param ctx - contexto del plugin de navegador (con `theme`).
     * @returns el id que ha quedado activo.
     */
    function paqueteDeTemas(ctx) {
      for (const nivel of TEMAS) {
        ctx.effect(
          () => ctx.theme.register({ id: nivel.id, colorScheme: 'dark', tokens: tokensDelTema(nivel) }),
          'ratacode-piel: tema ' + nivel.id,
        );
      }
      // El que la casa recuerde. Mientras llega la respuesta se pone el de
      // fábrica, para que no haya un parpadeo con el tema del motor.
      const estado = { activo: TEMA_POR_DEFECTO };
      const pon = (id) => {
        const bueno = esTemaNuestro(id) ? id : TEMA_POR_DEFECTO;
        estado.activo = bueno;
        try { ctx.theme.setTheme(bueno); } catch { /* tema no registrado: se queda el que haya */ }
        marcarEnElDocumento(bueno);
        pintarFilaDeTemas(ctx, estado);
      };
      pon(TEMA_POR_DEFECTO);
      pedir('/ratacode/tema', 'GET').then((r) => {
        if (r.ok === true && typeof r.tema === 'string') pon(r.tema);
      });
      // El motor re-adopta SU preferencia durable (`light`/`dark`/`system`) cada
      // vez que su ámbito de ajustes cambia —y cambia al tocar el tamaño de
      // letra—, y como un id de tema de fuera NO cabe en su esquema, al adoptar
      // se cae el nuestro. Por eso, cuando el que llega es uno de los suyos, se
      // vuelve a poner el nuestro; cuando el que llega es uno de los tres de la
      // casa, es que lo hemos puesto nosotros y sólo hay que apuntarlo. Termina
      // solo: `setTheme` con el mismo valor no publica nada, así que esto no
      // puede quedarse girando.
      ctx.on('theme/change', (instantanea) => {
        const suyo = instantanea?.preference;
        if (suyo === 'light' || suyo === 'dark' || suyo === 'system') { pon(estado.activo); return; }
        if (esTemaNuestro(suyo)) estado.activo = suyo;
        marcarEnElDocumento(estado.activo);
        pintarFilaDeTemas(ctx, estado);
      });
      // La fila del aspecto la repinta el motor al re-renderizar: se vuelve a
      // poner sin prisa, y sólo si de verdad falta.
      setInterval(() => pintarFilaDeTemas(ctx, estado), 900);
      return estado.activo;
    }

    /**
     * Apunta el tema en el documento: `<html data-ratacode-tema="…">`. De ahí
     * tiran el CSS de la casa (los colores de la marca y las ratitas de fondo) y
     * `ratacode-vida.js`, que para su fotograma en MINIMAL.
     * @param id - el tema activo.
     */
    function marcarEnElDocumento(id) {
      if (typeof document === 'undefined') return;
      if (document.documentElement.dataset.ratacodeTema !== id) document.documentElement.dataset.ratacodeTema = id;
    }

    /**
     * La fila «Aspecto» de RATACODE, en su sitio: la nativa (Claro · Oscuro ·
     * Sistema) la esconde el CSS (`.mr-temas` la sustituye) y aquí se monta la
     * nuestra, con los tres temas EN SU ORDEN y su color a la vista. Se vuelve a
     * montar si el motor repinta la sección.
     * @param ctx - contexto del plugin (para el servicio de temas).
     * @param estado - `{activo}`: el tema que está puesto (se actualiza aquí al pulsar).
     */
    function pintarFilaDeTemas(ctx, estado) {
      if (typeof document === 'undefined') return;
      const cuboNativo = document.querySelector('[class*="_themeCube"]');
      if (cuboNativo === null) return; // Ajustes no está abierto
      const grupo = cuboNativo.closest('[class*="_group"]');
      if (grupo === null) return;
      let fila = grupo.parentElement?.querySelector(':scope > .mr-temas');
      if (!fila) {
        fila = document.createElement('div');
        fila.className = 'mr-temas';
        const titulo = document.createElement('div');
        titulo.className = 'mr-temas-titulo';
        titulo.textContent = 'Aspecto';
        const filaCubos = document.createElement('div');
        filaCubos.className = 'mr-temas-fila';
        for (const nivel of TEMAS) {
          const boton = document.createElement('button');
          boton.type = 'button';
          boton.className = 'mr-tema';
          boton.dataset.tema = nivel.id;
          const punto = document.createElement('span');
          punto.className = 'mr-tema-punto';
          punto.style.background = nivel.principal;
          boton.append(punto, document.createTextNode(nivel.etiqueta));
          boton.addEventListener('click', () => {
            estado.activo = nivel.id;
            try { ctx.theme.setTheme(nivel.id); } catch { /* sin servicio: se apunta igual */ }
            marcarEnElDocumento(nivel.id);
            pintarFilaDeTemas(ctx, estado);
            fetch('/ratacode/tema', {
              method: 'POST', credentials: 'same-origin', cache: 'no-store',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ tema: nivel.id }),
            }).catch(() => { /* sin casa que apunte: el tema sigue puesto en esta ventana */ });
          });
          filaCubos.append(boton);
        }
        fila.append(titulo, filaCubos);
        grupo.after(fila);
      }
      for (const boton of fila.querySelectorAll('.mr-tema')) {
        boton.setAttribute('aria-pressed', boton.dataset.tema === estado.activo ? 'true' : 'false');
      }
    }

    /**
     * R24 · Registra los avisos en los tres idiomas y los pinta (y los vuelve a
     * pintar si el motor repinta la pantalla, cada 900 ms, como la fila
     * «Aspecto»): no se toca ningún componente del motor ni ningún fichero de
     * ajustes, sólo se añade una línea donde toca.
     * @param ctx - contexto del plugin de navegador (con `locale`).
     */
    function avisosDeLaCasa(ctx) {
      ctx.effect(() => ctx.locale.register(AVISOS_NS, AVISOS), 'ratacode-piel: los avisos, en los tres idiomas');
      // R27 §1 · y los textos de Ajustes › Actividad, por la misma vía.
      ctx.effect(() => ctx.locale.register(ACTIVIDAD_NS, ACTIVIDAD), 'ratacode-piel: los textos de Actividad');
      const t = ctx.locale.bind(AVISOS_NS);
      tAvisos = t;
      tActividad = ctx.locale.bind(ACTIVIDAD_NS);
      const pintar = () => { try { pintarAvisos(ctx, t); } catch { /* un aviso nunca tumba la pantalla */ } };
      pintar();
      setInterval(pintar, 900);
    }

    /**
     * Las tres líneas, cada una en su sitio:
     *   A · bajo el permiso de Ajustes › General, SÓLO si está «A rienda suelta»
     *       (con los otros dos modos la frase no sería verdad);
     *   B · arriba en Ajustes › Modelos, bajo su rótulo y su intro, encima de
     *       todos los proveedores;
     *   C · bajo la caja del encargo, alineada con ella, SÓLO si su selector de
     *       permiso está en «A rienda suelta».
     * El texto lo pone el servicio de idiomas del motor: aquí no se traduce nada.
     * @param ctx - contexto del plugin (para los diccionarios del motor).
     * @param t - el traductor de {@link AVISOS_NS}.
     */
    function pintarAvisos(ctx, t) {
      if (typeof document === 'undefined') return;
      const permiso = ctx.locale.bind('settings.permission');
      const conversacion = ctx.locale.bind('conversation');
      const modelos = ctx.locale.bind('settings.models');
      const riendaSuelta = permiso('preset.fullAccess');
      const enLaCaja = conversacion('access.preset.fullAccess');

      // A · Ajustes › General: la fila del permiso, por su rótulo (en el idioma puesto).
      const texto = [...document.querySelectorAll('[class*="_rowText"]')]
        .find((c) => (c.querySelector('[class*="_title"]')?.textContent ?? '').trim() === permiso('title'));
      if (texto !== undefined) {
        const fila = texto.parentElement;
        const puesto = (fila?.querySelector('[class*="_selector"]')?.textContent ?? '').trim();
        let linea = texto.querySelector(':scope > .mr-aviso-permiso');
        if (puesto !== riendaSuelta) {
          if (linea !== null) linea.remove();
        } else {
          if (linea === null) {
            linea = document.createElement('p');
            linea.className = 'mr-aviso-permiso';
            texto.append(linea);
          }
          if (linea.textContent !== t('permiso.fullAccess')) linea.textContent = t('permiso.fullAccess');
        }
      }

      // B · Ajustes › Modelos: arriba del todo lo que se lee del proveedor.
      const rotulo = [...document.querySelectorAll('h2[class*="_title"]')]
        .find((h) => (h.textContent ?? '').trim() === modelos('title'));
      const seccion = rotulo?.parentElement;
      if (seccion !== undefined && seccion !== null) {
        const intro = seccion.querySelector(':scope > [class*="_intro"]');
        if (intro !== null) {
          let linea = seccion.querySelector(':scope > .mr-aviso-modelos');
          if (linea === null) {
            linea = document.createElement('p');
            linea.className = 'mr-aviso-modelos';
            intro.after(linea);
          }
          if (linea.textContent !== t('modelos.proveedor')) linea.textContent = t('modelos.proveedor');
        }
      }

      // C · La caja del encargo: el mismo aviso, bajo ella, si su selector está
      //     en «A rienda suelta». Se busca el rótulo del selector (el del motor),
      //     nunca se pulsa nada.
      for (const caja of document.querySelectorAll('[data-composer-card]')) {
        const padre = caja.parentElement;
        if (padre === null) continue;
        const suyo = [...caja.querySelectorAll('[class*="_triggerLabel"]')]
          .some((s) => (s.textContent ?? '').trim() === enLaCaja);
        let linea = padre.querySelector(':scope > .mr-aviso-caja');
        if (!suyo) {
          if (linea !== null) linea.remove();
          continue;
        }
        if (linea === null) {
          linea = document.createElement('div');
          linea.className = 'mr-aviso-caja';
          padre.insertBefore(linea, caja.nextSibling);
        }
        if (linea.textContent !== t('permiso.fullAccess')) linea.textContent = t('permiso.fullAccess');
      }
    }

    /** Servicios que necesita el plugin de cliente. */
    const inject = ['slots', 'locale', 'theme'];

    /**
     * Monta las secciones de la piel en el menú de Ajustes: «Modelos locales» (R18,
     * justo detrás de Models) y «Conexiones» (R12/R23).
     * @param ctx - contexto del plugin de navegador.
     */
    function apply(ctx) {
      // R21 · el español, por la vía oficial de idiomas. Va LO PRIMERO: cuanto
      // antes esté el diccionario, antes sale la pantalla en cristiano.
      const idiomas = paqueteDeIdioma(ctx);
      // R21 · los tres temas, por la vía oficial de temas, y el que la casa
      // recuerde puesto. Va detrás del idioma a propósito: el tema se apunta en
      // `<html data-ratacode-tema>`, que es de donde tira el CSS de la casa.
      const tema = paqueteDeTemas(ctx);
      // R24 · los tres avisos de una línea (el del permiso, DOS veces: en
      // Ajustes › General y bajo la caja del encargo; y el de los proveedores,
      // arriba en Ajustes › Modelos), en los tres idiomas. Van detrás del
      // idioma: los pinta el traductor, que tiene que estar puesto.
      avisosDeLaCasa(ctx);
      // R27 §1 · la barra lateral, en caliente: si el MCP deja una tarea nueva
      // en la casa, la sesión sale sin recargar (por la vía oficial del motor,
      // `ctx.get('sessions').refresh()`).
      vigilarElMcp(ctx);
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'modelos-locales',
        order: 12,
        label: () => 'Modelos locales',
      }, SeccionModelosLocales));
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'conexiones',
        order: 25,
        label: () => 'Conexiones',
      }, SeccionConexiones));
      // R27 §1 · Ajustes › Actividad: lo que ha pasado por el MCP, en vivo.
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'actividad',
        order: 26,
        label: () => (tActividad === null ? 'Actividad' : tActividad('nav')),
      }, SeccionActividad));
      if (typeof console !== 'undefined') {
        console.info('RATACODE · Ajustes › General › Language: ' + IDIOMA_ETIQUETA
          + ' (' + IDIOMA + ', ' + idiomas.length + ' diccionarios)'
          + ' · Aspecto: ' + tema);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
