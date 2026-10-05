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
      '.mr-cx-tarjeta{border:1px solid var(--dsw-alias-border-secondary,#373248);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:9px}',
      '.mr-cx-cabeza{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mr-cx-nombre{font-weight:600;font-size:15px}',
      '.mr-hs-pre{margin:0;padding:10px;border-radius:8px;background:#0e1012;color:#dfe3e6;font-family:ui-monospace,Consolas,monospace;',
      'font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}',
      '.mr-hs-acciones{display:flex;gap:8px;flex-wrap:wrap}',
      '.mr-hs-accion{cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-secondary,#373248);',
      'background:var(--dsw-alias-bg-secondary,#18151f);color:inherit;font:inherit;font-size:12px}',
      '.mr-hs-accion:hover{border-color:#e4f226}',
      '.mr-hs-accion[data-copiado="si"]{border-color:#a6e22e;color:#a6e22e}',
      // R23 · Ajustes › Modelos locales
      '.mr-ml{display:flex;flex-direction:column;gap:12px;padding:4px 0 18px;max-width:760px}',
      '.mr-ml-tarjeta{border:1px solid var(--dsw-alias-border-secondary,#373248);border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:8px}',
      '.mr-ml-cabeza{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mr-ml-nombre{font-weight:600;font-size:15px}',
      '.mr-ml-pildora{border:1px solid var(--dsw-alias-border-secondary,#373248);border-radius:999px;padding:1px 9px;font-size:12px}',
      '.mr-ml-encendido{color:#a6e22e;border-color:#a6e22e}',
      '.mr-ml-apagado{color:#ffb4b4;border-color:#ff6b6b}',
      '.mr-ml-sin{color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      '.mr-ml-paso{display:flex;align-items:baseline;gap:8px;font-size:13px;line-height:19px}',
      '.mr-ml-num{font-weight:700;color:#e4f226;min-width:12px}',
      '.mr-ml-pasoTxt{min-width:0}',
      '.mr-ml-modelo{display:flex;align-items:baseline;gap:8px;font-size:13px;cursor:pointer;text-align:left;',
      'background:none;border:0;border-radius:8px;padding:3px 6px;color:inherit;font-family:inherit}',
      '.mr-ml-modelo:hover{background:var(--dsw-alias-bg-secondary,#18151f)}',
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
      'border:1px solid var(--dsw-alias-border-secondary,#373248);background:var(--dsw-alias-bg-secondary,#18151f);',
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
      // R28 §3b · el interruptor «Abierta a ChatGPT» de la cabecera del chat.
      '.mr-chatgpt{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:12px;line-height:17px}',
      '.mr-chatgpt-rotulo{color:var(--dsw-alias-label-tertiary,#9aa0a6);white-space:nowrap}',
      '.mr-chatgpt-boton{cursor:pointer;border-radius:999px;padding:1px 8px;font:inherit;font-size:11px;',
      'border:1px solid var(--dsw-alias-border-secondary,#373248);background:var(--dsw-alias-bg-secondary,#18151f);color:inherit}',
      '.mr-chatgpt-boton[data-abierta="si"]{border-color:#a6e22e;color:#a6e22e}',
      '.mr-chatgpt-boton:disabled{cursor:not-allowed;opacity:.55}',
      // R34 · el botón «Autorizar esta carpeta» y su confirmación (Sí / Cancelar).
      '.mr-chatgpt-aut{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
      '.mr-chatgpt-pregunta{color:var(--dsw-alias-text-secondary,#c9ced3);font-size:11px}',
      '.mr-chatgpt-aviso{color:var(--mr-detalle);font-size:11px;padding:2px 9px;border-radius:999px;cursor:help;border:1px solid color-mix(in srgb,var(--mr-detalle) 40%,transparent)}',
      // R28 §2 · la marca «GPT WEB →» de un mensaje que entró desde un chat web.
      '.mr-gptweb{margin:0 0 3px;font-size:11px;font-weight:600;letter-spacing:.03em;color:#e4f226}',
      '.mr-cx-ejemplo{margin:0;padding:8px 10px;border-radius:8px;background:#0e1012;color:#dfe3e6;',
      'font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word}',
      '.mr-cx-acciones{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.mr-cx-plan{display:flex;flex-direction:column;gap:6px}',
      // R27 · Ajustes › Actividad: la tabla de lo que pasó por el MCP.
      '.mr-ac{display:flex;flex-direction:column;gap:8px;padding:4px 0 18px;max-width:900px}',
      '.mr-ac-intro{margin:0;font-size:13px;line-height:19px;color:var(--dsw-alias-text-secondary,#9aa0a6)}',
      '.mr-ac-tabla{width:100%;border-collapse:collapse;font-size:12px;line-height:17px}',
      '.mr-ac-tabla th{text-align:left;font-weight:600;color:var(--dsw-alias-label-tertiary,#9aa0a6);',
      'border-bottom:1px solid var(--dsw-alias-border-secondary,#373248);padding:4px 8px 5px 0}',
      '.mr-ac-tabla td{border-bottom:1px solid var(--dsw-alias-border-secondary,#262233);padding:5px 8px 5px 0;vertical-align:top}',
      '.mr-ac-hora{white-space:nowrap;font-family:ui-monospace,Consolas,monospace;font-size:11px}',
      '.mr-ac-si{color:#a6e22e}',
      '.mr-ac-no{color:#ffb4b4}',
      '.mr-ac-tipo{border-radius:6px;padding:1px 7px;font-size:11px;white-space:nowrap}',
      '.mr-ac-tipo-tarea{background:rgba(228,242,38,.14);color:#e4f226}',
      '.mr-ac-tipo-lectura{background:rgba(154,160,166,.16);color:#c9ced3}',
      '.mr-ac-tipo-sesion{background:rgba(255,38,142,.16);color:#ff7ab8}',
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
        sesion: 'chat web',
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
        sesion: 'web chat',
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
        sesion: '网页聊天',
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
     * Una fila de la tabla de Actividad. Las tres clases de línea del cuaderno
     * (`tarea`, `lectura` y —desde R28— `sesion`, que es un mensaje que entró
     * desde un chat web a una sesión del panel) se pintan con las mismas
     * columnas, que es lo que hace que se lean de un vistazo.
     */
    function FilaDeActividad(props) {
      const { fila, t } = props;
      const esTarea = fila.tipo === 'tarea' || fila.tipo === undefined;
      const esSesion = fila.tipo === 'sesion';
      const permitido = fila.permitido === true;
      const bloqueada = esTarea ? (fila.estado === 'failed' || fila.estado === 'cancelled') : !permitido;
      const donde = esTarea
        ? (fila.tarea ?? fila.task_id ?? '')
        : (fila.ruta ?? '');
      const etiqueta = esTarea ? t('tarea') : (esSesion ? t('sesion') : t('lectura'));
      const clase = 'mr-ac-tipo mr-ac-tipo-' + (esTarea ? 'tarea' : (esSesion ? 'sesion' : 'lectura'));
      return e('tr', { className: 'mr-ac-fila' },
        e('td', { className: 'mr-ac-hora' }, horaCorta(fila.hora)),
        e('td', {}, fila.cliente ?? 'MCP'),
        e('td', {}, e('span', { className: clase }, etiqueta)),
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
        etiqueta: 'MULTICOLOR',
        nota: 'Aurora, quesos de colores y todo encendido.',
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
        etiqueta: 'GRIS Y AMARILLO',
        nota: 'Fondo gris y un solo acento: el amarillo.',
        // R33: gris de verdad (sin el tinte violeta) y el amarillo como único color
        neutro: true,
        principal: '#e4f226', detalle: '#e4f226', acento: '#e4f226',
        textoDelBoton: '#141612',
        hover: '#f1ff45',
        suave: '#34361c',
        seleccion: '#2b2c22',
        filoActivo: '#e4f226',
        brillo: { 200: '#f7ffb0', 300: '#eef86a', 400: '#e4f226', 450: '#e4f226', 500: '#cddb16', 600: '#9aa50f' },
        marca: '#e4f226',
      },
      {
        id: 'minimal',
        etiqueta: 'SOBRIO',
        nota: 'Todo apagado. La rata, y poco más.',
        neutro: true,
        // todo negro y gris: sólo líneas y pequeños detalles
        principal: '#e8e6df', detalle: '#8c9396', acento: '#b8bdbb',
        textoDelBoton: '#0c0a12',
        hover: '#f5f4ef',
        suave: '#211e2b',
        seleccion: '#262233',
        filoActivo: '#8c9396',
        brillo: { 200: '#e8e6df', 300: '#b8bdbb', 400: '#9ba3a5', 450: '#8c9396', 500: '#6f7679', 600: '#545a5d' },
        marca: '#e8e6df',
      },
    ];
    /** El tema de fábrica de RATACODE (el primero de la lista). */
    const TEMA_POR_DEFECTO = TEMAS[0].id;

    /** Los grises de la casa: los mismos en los tres temas (negro y gris). */
    const GRISES = {
      '--dsw-alias-bg-base': '#0c0a12',
      '--dsw-alias-bg-layer-1': '#15121d',
      '--dsw-alias-bg-layer-2': '#1d1a27',
      '--dsw-alias-bg-layer-3': '#262233',
      '--dsw-alias-bg-overlay': '#211e2b',
      '--dsw-alias-bg-module-platform': '#262233',
      '--dsw-alias-bg-multi-select': '#1a1724',
      '--dsw-alias-bg-skeleton': '#ffffff14',
      '--dsw-alias-border-l1': '#221f2d',
      '--dsw-alias-border-l2': '#322d42',
      '--dsw-alias-border-l3': '#453f58',
      '--dsw-alias-border-l4': '#625b78',
      '--dsw-alias-label-primary': '#f0eee6',
      '--dsw-alias-label-secondary': '#b8bdbb',
      '--dsw-alias-label-tertiary': '#9ba3a5',
      '--dsw-alias-label-dimmed': '#818a8e',
      '--dsw-alias-markdown-code-block': '#100e17',
      '--dsw-alias-markdown-code-block-banner': '#1d1a27',
      '--dsw-alias-markdown-inline-code': '#24202f',
      '--dsw-alias-markdown-placeholder': '#1d1a27',
      '--dsw-alias-markdown-tag': '#1d1a27',
      '--dsw-alias-scrollbar-bg-l1': '#3c3c3d',
      '--dsw-alias-scrollbar-bg-l2': '#545557',
      '--dsw-alias-scrollbar-hover-l1': '#545557',
      '--dsw-alias-scrollbar-hover-l2': '#65676b',
      '--dsw-specific-bubble': '#1d1a27',
      '--dsw-specific-bubble-highlight': '#453f58',
      '--dsw-specific-input-major': '#1d1a27',
      '--dsw-specific-selector': '#262233',
      '--dsw-specific-tip': '#262233',
      '--dsw-specific-menu': '#262233',
      '--dsw-specific-sidebar-fill': '#110f18',
      '--dsw-static-neutral-900': '#09080e',
      '--dsw-static-neutral-850': '#1a1724',
      '--dsw-static-neutral-800': '#24202f',
      '--dsw-static-neutral-bluish-950': '#0c0a12',
      '--dsw-static-neutral-bluish-900': '#15121d',
      '--dsw-static-neutral-bluish-875': '#15121d',
      '--dsw-static-neutral-bluish-850': '#1d1a27',
      '--dsw-static-neutral-bluish-800': '#262233',
      '--dsw-static-neutral-bluish-750': '#373248',
      '--dsw-static-neutral-bluish-700': '#453f58',
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
      const ficha = fichaDelTema(nivel);
      return nivel.neutro ? sinTinte(ficha) : ficha;
    }
    /**
     * R33 · Quita el tinte violeta de una ficha: todo color casi gris (poca
     * diferencia entre sus tres canales) pasa a gris puro de la misma luz. Los
     * colores de verdad (amarillo, rojo de error) no se tocan.
     */
    function sinTinte(ficha) {
      const salida = {};
      for (const [k, v] of Object.entries(ficha)) {
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
        if (m === null) { salida[k] = v; continue; }
        const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
        if (Math.max(r, g, b) - Math.min(r, g, b) > 40) { salida[k] = v; continue; }
        const gris = Math.round(0.299 * r + 0.587 * g + 0.114 * b).toString(16).padStart(2, '0');
        salida[k] = '#' + gris + gris + gris;
      }
      return salida;
    }
    function fichaDelTema(nivel) {
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
        '--dsw-alias-button-elevated-fill': '#1d1a27',
        '--dsw-alias-button-floating-fill': '#1d1a27',
        '--dsw-alias-button-floating-hover': '#262233',
        '--dsw-alias-button-contrast-fill': '#f0eee6',
        '--dsw-alias-button-tool-bar-fill': '#1d1a27',
        '--dsw-alias-button-tool-bar-hover': '#2e2a3c',
        '--dsw-alias-interactive-bg-hover': '#24202f',
        '--dsw-alias-interactive-bg-active': nivel.seleccion,
        '--dsw-alias-interactive-bg-hover-solid': '#262233',
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
        '--dsw-alias-toast-bg': '#262233',
        '--dsw-alias-tooltip-bg': '#262233',
        '--dsw-specific-sidebar-nav-item-active': nivel.suave,
        '--dsw-specific-sidebar-nav-item-active-accent': nivel.filoActivo,
        '--dsw-specific-sidebar-nav-item-hover': '#1a1724',
        '--dsw-specific-login-input': '#15121d',
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
        for (const avisar of temaVivo.oyentes) avisar(bueno);
      };
      // Lo que usa la pestaña Aspecto: cuál está puesto y cómo se elige otro
      // (se pone, y la casa lo apunta en `tema.txt`).
      temaVivo.estado = estado;
      temaVivo.elegir = (id) => {
        pon(id);
        fetch('/ratacode/tema', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tema: id }),
        }).catch(() => { /* sin casa que apunte: el tema sigue puesto en esta ventana */ });
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
      });
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

    /** El tema, compartido entre quien lo pone (`paqueteDeTemas`) y la pestaña Aspecto. */
    const temaVivo = { estado: { activo: TEMA_POR_DEFECTO }, elegir: () => {}, oyentes: new Set() };

    /**
     * R33 · AJUSTES › ASPECTO. Una pestaña de la casa con lo visual: los tres
     * ESTILOS (cada uno con su muestra en miniatura) y el interruptor de las
     * ratas de fondo. El estilo se guarda en la casa, como siempre; lo de las
     * ratas, en este navegador (`localStorage`), que es una comodidad de quien
     * mira y no un ajuste de la casa. La fila nativa Claro/Oscuro/Sistema de
     * General sigue escondida por la hoja.
     */
    function SeccionAspecto() {
      const [activo, setActivo] = React.useState(temaVivo.estado.activo);
      const [ratas, setRatas] = React.useState(document.documentElement.dataset.mrRatas !== 'no');
      React.useEffect(() => {
        temaVivo.oyentes.add(setActivo);
        return () => { temaVivo.oyentes.delete(setActivo); };
      }, []);
      const [datos, setDatos] = React.useState(document.documentElement.dataset.mrDatos === 'si');
      const cambiarDatos = () => {
        const salen = !datos;
        setDatos(salen);
        if (salen) document.documentElement.dataset.mrDatos = 'si'; else delete document.documentElement.dataset.mrDatos;
        try { if (salen) localStorage.setItem('mr-datos', 'si'); else localStorage.removeItem('mr-datos'); } catch { /* sin almacén: vale para esta ventana */ }
      };
      const cambiarRatas = () => {
        const siguen = !ratas;
        setRatas(siguen);
        if (siguen) delete document.documentElement.dataset.mrRatas; else document.documentElement.dataset.mrRatas = 'no';
        try { if (siguen) localStorage.removeItem('mr-ratas'); else localStorage.setItem('mr-ratas', 'no'); } catch { /* sin almacén: vale para esta ventana */ }
      };
      return e('div', { className: 'mr-as' },
        e('h3', { className: 'mr-as-titulo' }, 'Estilo'),
        e('div', { className: 'mr-as-estilos' }, TEMAS.map((nivel) => e('button', {
          key: nivel.id, type: 'button', className: 'mr-estilo', 'data-tema': nivel.id,
          'aria-pressed': nivel.id === activo ? 'true' : 'false',
          onClick: () => { temaVivo.elegir(nivel.id); },
        },
        e('span', { className: 'mr-estilo-muestra', 'aria-hidden': 'true' }, e('i'), e('i'), e('i')),
        e('b', null, nivel.etiqueta),
        e('span', { className: 'mr-estilo-nota' }, nivel.nota)))),
        e('h3', { className: 'mr-as-titulo' }, 'Ratas en pantalla'),
        e('div', { className: 'mr-as-fila' },
          e('p', null, 'Las ratas de fondo: el logo, los quesos y lo que hacen mientras la IA trabaja.'),
          e('button', { type: 'button', className: 'mr-interruptor', role: 'switch', 'aria-checked': ratas ? 'true' : 'false', onClick: cambiarRatas },
            e('span', null, ratas ? 'Sí' : 'No'))),
        e('h3', { className: 'mr-as-titulo' }, 'Datos técnicos'),
        e('div', { className: 'mr-as-fila' },
          e('p', null, 'Tokens gastados, velocidad y caché: la línea de debajo de la caja de escribir y el uso de cada respuesta.'),
          e('button', { type: 'button', className: 'mr-interruptor', role: 'switch', 'aria-checked': datos ? 'true' : 'false', onClick: cambiarDatos },
            e('span', null, datos ? 'Sí' : 'No'))));
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

    /**
     * R28 §3b · EL INTERRUPTOR DE LA CABECERA DEL CHAT: «Abierta a ChatGPT».
     *
     * Por qué está aquí y no en Ajustes: porque es de UNA sesión, y la sesión
     * que manda es la que Patxi tiene delante. Va en el asiento que el motor
     * tiene para esto (`conversation.session.header.utilities`, un asiento
     * «list» de ámbito de sesión: `dsh-client-ui-conversation/lib/client.js:
     * 16695-16698` y `:15077`), así que el dueño de la cabecera nos pasa el
     * `sessionId` (`dsh-client-ui-session/lib/client.js:64-69`).
     *
     * APAGADO POR DEFECTO, y se enciende A MANO: es lo ÚNICO que decide si
     * ChatGPT puede escribir en esta sesión por el MCP. Hasta R32, además, los
     * turnos de esa sesión iban encerrados (sin terminal, sin procesos, sin red y
     * sin subagentes); R32 lo derogó: la sesión conserva su permiso y todas sus
     * herramientas. Lo que se dice aquí, en la cabecera, es eso.
     *
     * Y deja el id de la sesión a la vista en `<html data-ratacode-sesion>`:
     * de ahí tira el guion de la piel para pintar «GPT WEB →» en la fila que
     * toca (por TURNO, nunca por el texto del mensaje).
     *
     * R34 · y, cuando la carpeta de la sesión no está autorizada, aquí mismo
     * sale «Autorizar esta carpeta»: la mete en `mcp.workspaces` de la casa sin
     * abrir el fichero a mano, en dos pasos y con confirmación (Sí / Cancelar).
     */
    function ConfirmacionAutorizar(props) {
      const dialogo = React.useRef(null);
      const preguntaId = 'mr-autorizar-pregunta-' + encodeURIComponent(props.sessionId);
      React.useEffect(() => {
        const nodo = dialogo.current;
        if (nodo === null || typeof document === 'undefined') return;
        const focoAnterior = document.activeElement;
        if (typeof nodo.showModal === 'function' && !nodo.open) nodo.showModal();
        nodo.querySelector('[data-autorizar-cancelar]')?.focus();
        return () => {
          if (nodo.open && typeof nodo.close === 'function') nodo.close();
          if (props.volverAlBoton() !== true && focoAnterior?.isConnected === true) focoAnterior.focus?.();
        };
      }, []);
      return e('dialog', {
        ref: dialogo,
        className: 'mr-chatgpt-dialogo',
        'aria-label': 'Autorizar esta carpeta',
        'aria-describedby': preguntaId,
        onCancel: (evento) => { evento.preventDefault(); props.onCancelar(); },
      }, [
        e('h2', { className: 'mr-chatgpt-dialogo-titulo', key: 'titulo' }, 'Autorizar esta carpeta'),
        e('p', { className: 'mr-chatgpt-pregunta', id: preguntaId, key: 'pregunta' }, props.pregunta),
        e('div', { className: 'mr-chatgpt-dialogo-acciones', key: 'acciones' }, [
          e('button', {
            type: 'button', className: 'mr-chatgpt-boton', key: 'cancelar',
            'data-autorizar-cancelar': '', onClick: props.onCancelar,
          }, 'Cancelar'),
          e('button', {
            type: 'button', className: 'mr-chatgpt-boton mr-chatgpt-dialogo-confirmar', key: 'confirmar',
            onClick: props.onConfirmar,
          }, 'Sí'),
        ]),
      ]);
    }

    function InterruptorSesion(props) {
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
      const [estado, setEstado] = React.useState({ fase: 'cargando' });
      const [enCurso, setEnCurso] = React.useState(false);
      // R34 · el botón «Autorizar esta carpeta»: `null` mientras no se toca, y
      // luego la fase del dos pasos (mirar → confirmar → escribir).
      const [aut, setAut] = React.useState(null);
      const botonAutorizar = React.useRef(null);
      const vigente = React.useRef({ sessionId, montado: true, autorizando: false });
      if (vigente.current.sessionId !== sessionId) {
        vigente.current = { sessionId, montado: true, autorizando: false };
      }
      const actual = vigente.current;
      const deEstaSesion = () => vigente.current === actual && actual.montado;
      React.useEffect(() => {
        actual.montado = true;
        setEstado({ fase: 'cargando' });
        setEnCurso(false);
        setAut(null);
        if (sessionId !== '') document.documentElement.dataset.ratacodeSesion = sessionId;
        return () => { actual.montado = false; };
      }, [sessionId]);
      const mirar = React.useCallback(() => {
        if (sessionId === '') return;
        pedir('/ratacode/sesiones', 'GET').then((r) => {
          if (!deEstaSesion()) return;
          if (r.ok !== true) { setEstado({ fase: 'error', error: r.error ?? 'error' }); return; }
          const suya = (Array.isArray(r.sesiones) ? r.sesiones : []).find((s) => s.session_id === sessionId);
          setEstado(suya === undefined ? { fase: 'sin-sesion' } : { fase: 'listo', sesion: suya });
        });
      }, [sessionId]);
      React.useEffect(() => {
        mirar();
        const reloj = setInterval(mirar, 3000);
        return () => clearInterval(reloj);
      }, [mirar]);
      if (sessionId === '') return null;
      const sesion = estado.fase === 'listo' && estado.sesion?.session_id === sessionId ? estado.sesion : null;
      const abierta = sesion?.abierta_a_chatgpt === true;
      const puede = sesion !== null && sesion.en_espacio_autorizado === true;
      const cambiar = () => {
        if (enCurso || sesion === null) return;
        setEnCurso(true);
        pedir('/ratacode/sesiones/abierta', 'POST', { session_id: sessionId, abierta: !abierta }).then((r) => {
          if (!deEstaSesion()) return;
          setEnCurso(false);
          if (r.ok !== true) {
            setEstado({ fase: 'listo', sesion: { ...sesion, aviso: r.motivo ?? r.error ?? 'no se pudo cambiar' } });
            return;
          }
          mirar();
        });
      };
      // R34 · EL BOTÓN «Autorizar esta carpeta». Dos pasos, y el primero NO
      // escribe nada: `POST /ratacode/sesiones/autorizar` sin `confirmar`
      // devuelve la ruta canónica y un nonce de un solo uso (2 minutos); con
      // `confirmar:true` y ese nonce, la piel escribe la carpeta en el
      // `settings.yaml` de la casa (con copia `.bak` y releyendo el YAML).
      // Si la carpeta ya estaba autorizada, la ruta lo dice y no se añade nada.
      const pedirAutorizar = () => {
        const carpeta = sesion?.carpeta;
        if (enCurso || actual.autorizando || typeof carpeta !== 'string' || carpeta === ''
          || (aut !== null && aut.fase !== 'error' && aut.fase !== 'ya')) return;
        actual.autorizando = true;
        setAut({ fase: 'mirando' });
        pedir('/ratacode/sesiones/autorizar', 'POST', { ruta: carpeta }).then((r) => {
          if (!deEstaSesion()) return;
          actual.autorizando = false;
          if (r.ok !== true) { setAut({ fase: 'error', motivo: r.motivo ?? r.error ?? 'no se pudo mirar la carpeta' }); return; }
          if (r.ya_autorizada === true) { setAut({ fase: 'ya', motivo: r.motivo }); mirar(); return; }
          setAut({ fase: 'confirmar', sessionId, nonce: r.nonce, ruta: r.ruta ?? carpeta, pregunta: r.pregunta });
        });
      };
      const confirmarAutorizar = () => {
        if (actual.autorizando || aut?.fase !== 'confirmar' || aut.sessionId !== sessionId || typeof aut.nonce !== 'string') return;
        actual.autorizando = true;
        const nonce = aut.nonce;
        setAut({ ...aut, fase: 'escribiendo' });
        pedir('/ratacode/sesiones/autorizar', 'POST', { confirmar: true, nonce }).then((r) => {
          if (!deEstaSesion()) return;
          actual.autorizando = false;
          if (r.ok !== true) { setAut({ fase: 'error', motivo: r.motivo ?? r.error ?? 'no se pudo escribir' }); return; }
          setAut({ fase: 'hecho', ruta: r.ruta ?? aut.ruta });
          // Y se abre el chat a ChatGPT: era para lo que se pidió autorizar.
          pedir('/ratacode/sesiones/abierta', 'POST', { session_id: sessionId, abierta: true }).then((r2) => {
            if (!deEstaSesion()) return;
            if (r2.ok !== true) setAut({ fase: 'error', motivo: 'Carpeta autorizada, pero no se pudo abrir el chat: ' + (r2.motivo ?? r2.error ?? 'error') });
            mirar();
          });
        });
      };
      // UN SOLO CONTROL: el interruptor «Abierta a ChatGPT» (Sí / No, se apaga igual
      // que se enciende). Si la carpeta aún no está autorizada, encenderlo abre la
      // confirmación («Autorizar esta carpeta») y, al decir Sí, autoriza Y abre. El
      // paso 1 sólo MIRA la carpeta (y devuelve el nonce); no se escribe nada
      // hasta que el usuario confirma en el paso 2.
      const hayCarpeta = typeof sesion?.carpeta === 'string' && sesion.carpeta !== '';
      const faseAut = aut === null || (aut.sessionId !== undefined && aut.sessionId !== sessionId) ? 'quieto' : aut.fase;
      const autorizando = faseAut === 'mirando' || faseAut === 'confirmar' || faseAut === 'escribiendo';
      const hijos = [
        e('span', { className: 'mr-chatgpt-rotulo', key: 'r' }, 'Abierta a ChatGPT'),
        e('button', {
          key: 'b',
          type: 'button',
          className: 'mr-chatgpt-boton',
          ref: botonAutorizar,
          'data-abierta': abierta ? 'si' : 'no',
          'aria-pressed': abierta ? 'true' : 'false',
          disabled: enCurso || autorizando || (sesion !== null && !abierta && !puede && !hayCarpeta),
          title: puede || abierta
            ? 'Con esto encendido, ChatGPT puede escribir en ESTA sesión por el MCP (sus mensajes salen marcados «GPT WEB →»). No le quita nada a la sesión: conserva su permiso y todas sus herramientas.'
            : (hayCarpeta
              ? 'Para abrir este chat a ChatGPT hay que autorizar antes su carpeta. Te pido confirmación antes de escribir nada.'
              : (sesion?.motivo ?? 'esta sesión todavía no se puede abrir')),
          onClick: abierta || puede ? cambiar : pedirAutorizar,
        }, abierta ? 'Sí' : 'No'),
      ];
      if (sesion?.aviso !== undefined) hijos.push(e('span', { className: 'mr-chatgpt-aviso', key: 'a' }, sesion.aviso));
      if (faseAut === 'confirmar') {
        hijos.push(e(ConfirmacionAutorizar, {
          key: 'aut-2', sessionId,
          pregunta: aut.pregunta ?? ('¿Autorizar ' + (aut.ruta ?? '') + '? ChatGPT podrá leer y escribir en ella'),
          onConfirmar: confirmarAutorizar,
          onCancelar: () => { if (deEstaSesion()) setAut(null); },
          volverAlBoton: () => {
            if (!deEstaSesion()) return true;
            const boton = botonAutorizar.current;
            if (boton === null || boton.isConnected !== true || boton.disabled) return false;
            boton.focus();
            return true;
          },
        }));
      } else if (faseAut === 'mirando' || faseAut === 'escribiendo') {
        hijos.push(e('span', { className: 'mr-chatgpt-aviso', key: 'aut-3' },
          faseAut === 'mirando' ? 'mirando la carpeta…' : 'autorizando…'));
      } else if (faseAut === 'hecho') {
        hijos.push(e('span', { className: 'mr-chatgpt-aviso', key: 'aut-4' }, 'Carpeta autorizada y chat abierto a ChatGPT: ' + (aut.ruta ?? '')));
      } else if (faseAut === 'ya' || faseAut === 'error') {
        hijos.push(e('span', { className: 'mr-chatgpt-aviso', key: 'aut-5' }, aut.motivo ?? 'no se pudo autorizar'));
      }
      return e('div', { className: 'mr-chatgpt' }, hijos);
    }

    /** Partición estable: confirmar una clave nunca cambia modelos ni selección. */
    function conClavesPrimero(entradas, tieneClave) {
      const ordenadas = entradas.filter(tieneClave).concat(entradas.filter((entrada) => !tieneClave(entrada)));
      return ordenadas.every((entrada, indice) => entrada === entradas[indice]) ? entradas : ordenadas;
    }

    /** Ordena el snapshot público, conservando el orden que publicó su dueño. */
    function vigilarOrdenConClaves(store, campo, tieneClave) {
      let original = store.getSnapshot()[campo];
      let publicado = original;
      let cerrado = false;
      const aplicar = () => {
        if (cerrado) return;
        const estado = store.getSnapshot();
        const entradas = estado[campo];
        if (!Array.isArray(entradas)) return;
        if (entradas !== publicado) original = entradas;
        const ordenadas = conClavesPrimero(original, tieneClave);
        if (ordenadas.length === entradas.length && ordenadas.every((entrada, indice) => entrada === entradas[indice])) {
          publicado = entradas;
          return;
        }
        publicado = ordenadas;
        store.set({ ...estado, [campo]: ordenadas });
      };
      const soltar = store.subscribe(aplicar);
      aplicar();
      return {
        aplicar,
        cerrar: () => {
          if (cerrado) return;
          cerrado = true;
          soltar();
          const estado = store.getSnapshot();
          if (estado[campo] === publicado && publicado !== original) store.set({ ...estado, [campo]: original });
        },
      };
    }

    /**
     * R35 · claves confirmadas primero, sobre los DOS stores del motor.
     * Selector: directorio público por sesión. Ajustes: ModelsSectionInjected
     * (exportado por ui-settings-models/client), desde la inyección pública de
     * su asiento; controller.store es SnapshotStore, no un campo privado.
     * No se toca el DOM: ratón, teclado y /model ven el mismo orden.
     */
    function ordenarModelosConClave(ctx) {
      let cerrado = false;
      let generacion = 0;
      let conClave = new Set();
      const observados = new Map();
      const disposers = [];
      const aplicar = () => { for (const observador of observados.values()) observador.vigilante.aplicar(); };
      const observar = (store, campo, tieneClave) => {
        if (cerrado || typeof store?.getSnapshot !== 'function' || typeof store?.subscribe !== 'function'
          || typeof store?.set !== 'function') return () => {};
        let observador = observados.get(store);
        if (observador === undefined) {
          observador = { usos: 0, vigilante: vigilarOrdenConClaves(store, campo, tieneClave) };
          observados.set(store, observador);
        }
        observador.usos += 1;
        let suelto = false;
        return () => {
          if (suelto) return;
          suelto = true;
          observador.usos -= 1;
          if (observador.usos === 0) {
            observador.vigilante.cerrar();
            observados.delete(store);
          }
        };
      };
      // La página de Ajustes ya une filas con credentials.describe: reutilizar
      // ESA confirmación. configured del perfil y derivedCredential no son ella.
      let entradaModels = null;
      let soltarModels = () => {};
      const mirarModels = () => {
        if (cerrado) return;
        const entrada = ctx.slots.entriesOfSlot('settings.section').find((item) => item.options.id === 'models') ?? null;
        if (entrada === entradaModels) return;
        soltarModels();
        soltarModels = () => {};
        entradaModels = entrada;
        // StoredEntry separa la función inject de options (como runInject del
        // renderer). Su resultado es la interfaz pública ModelsSectionInjected.
        if (typeof entrada?.inject !== 'function') return;
        const controller = entrada.inject().controller;
        soltarModels = observar(controller?.store, 'rows', (row) =>
          typeof row.apiKeyEnv === 'string' && row.apiKeyEnv !== '' && row.credential?.configured === true);
      };
      disposers.push(ctx.slots.subscribe('settings.section', mirarModels));
      mirarModels();
      // La consulta oficial de ajustes viene redactada; describe devuelve solo
      // presencia/origen/escritura. Ni resolve(), ni archivos, ni sondeos de API.
      const actualizar = async () => {
        const turno = ++generacion;
        conClave = new Set();
        aplicar();
        try {
          const [directorio, ajustes] = await Promise.all([
            ctx.remote.llm.listConfigurableProviders(), ctx.remote.settings.describe(),
          ]);
          if (!directorio.ok || !ajustes.ok) throw new Error('metadatos no disponibles');
          const namespaces = new Map(ajustes.value.namespaces.map((vista) => [vista.ns, vista.value]));
          const referencias = new Map();
          for (const entrada of directorio.value) {
            const perfil = entrada.settingsPath.reduce((valor, tramo) => valor?.[tramo], namespaces.get(entrada.settingsNs));
            const ref = perfil?.apiKeyEnv;
            if (typeof ref === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) referencias.set(entrada.provider, ref);
          }
          const refs = [...new Set(referencias.values())];
          const respuestas = await Promise.all(Array.from({ length: Math.ceil(refs.length / 64) }, (_v, i) =>
            ctx.remote.credentials.describe(refs.slice(i * 64, (i + 1) * 64))));
          if (respuestas.some((respuesta) => !respuesta.ok)) throw new Error('confirmación no disponible');
          const confirmadas = new Set(respuestas.flatMap((respuesta) => Object.entries(respuesta.value)
            .filter(([_ref, info]) => info.configured === true).map(([ref]) => ref)));
          if (cerrado || turno !== generacion) return;
          conClave = new Set([...referencias].filter(([_proveedor, ref]) => confirmadas.has(ref)).map(([proveedor]) => proveedor));
          aplicar();
        } catch {
          // Sin confirmación, el selector conserva el orden original del motor.
          // Una respuesta antigua no puede retirar las claves de una más nueva.
          if (!cerrado && turno === generacion) { conClave = new Set(); aplicar(); }
        }
      };
      function OrdenDelSelector(props) {
        React.useEffect(() => {
          if (cerrado || typeof props.sessionId !== 'string' || props.sessionId === '') return;
          const directorio = ctx.modelDirectories.directoryFor(props.sessionId);
          return observar(directorio.store, 'groups', (grupo) => conClave.has(grupo.id));
        }, [props.sessionId]);
        return null;
      }
      disposers.push(ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities', id: 'ratacode-orden-modelos', order: 31,
      }, OrdenDelSelector)));
      for (const evento of ['settings/document-updated', 'credentials/reference-updated', 'llm/adapters-updated']) {
        disposers.push(ctx.remote.$on(evento, actualizar));
      }
      disposers.push(ctx.on('connection/reset', actualizar));
      actualizar();
      return () => {
        if (cerrado) return;
        cerrado = true;
        generacion += 1;
        for (const dispose of disposers) dispose();
        soltarModels();
        for (const observador of observados.values()) observador.vigilante.cerrar();
        observados.clear();
      };
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
      // R35 · el orden es una presentación del catálogo, nunca otro catálogo.
      ctx.inject(['remote', 'remote.llm', 'remote.settings', 'remote.credentials', 'modelDirectories'], (c) => {
        c.effect(() => ordenarModelosConClave(c), 'ratacode-piel.orden-modelos');
      });
      // R28 §3b · el interruptor «Abierta a ChatGPT», en la cabecera del chat,
      // por la vía oficial de asientos del motor.
      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'ratacode-chatgpt',
        order: 30,
      }, InterruptorSesion));
      // R33 · Ajustes › Aspecto, justo detrás de General (que es el 0).
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'aspecto',
        order: 5,
        label: () => 'Aspecto',
      }, SeccionAspecto));
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
    exports.ordenarModelosConClave = ordenarModelosConClave;
    exports.inject = inject;
    return module.exports;
  },
});
