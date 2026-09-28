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
 * La sección son DOS BOTONES, los dos en español:
 *   1) «Agentes con navegador (Claude Code, Codex, OpenClaw, Rowboat…)»: copia
 *      el apretón de manos de ESTA casa (corto, con su URL) y lo deja en
 *      `<casa>\handshake.md`.
 *   2) «Chats web (ChatGPT, Claude…)»: el MCP para chats web — arrancar
 *      `ratacode mcp --http --acepto-lectura-total` y `node mcp/tunel.mjs`, el
 *      aviso de lectura total, y el texto que se pega en el chat.
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
      '.mr-hs{display:flex;flex-direction:column;gap:10px;padding:4px 0 18px;max-width:760px}',
      '.mr-hs-intro{margin:0;color:var(--dsw-alias-text-secondary,#9aa0a6);font-size:13px;line-height:19px}',
      '.mr-hs-botones{display:flex;flex-direction:column;gap:8px}',
      '.mr-hs-boton{display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;width:100%;cursor:pointer;',
      'padding:11px 13px;border-radius:10px;border:1px solid var(--dsw-alias-border-secondary,#3a3f45);',
      'background:var(--dsw-alias-bg-secondary,#1b1e21);color:inherit;font:inherit}',
      '.mr-hs-boton:hover{border-color:#e4f226}',
      '.mr-hs-boton[data-abierto="si"]{border-color:#e4f226}',
      '.mr-hs-titulo{font-weight:600;font-size:14px}',
      '.mr-hs-sub{font-size:12px;opacity:.75}',
      '.mr-hs-caja{border:1px solid var(--dsw-alias-border-secondary,#3a3f45);border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:9px}',
      '.mr-hs-linea{margin:0;font-size:13px;line-height:19px}',
      '.mr-hs-aviso{margin:0;font-size:13px;line-height:19px;color:#ffb4b4;border-left:3px solid #ff6b6b;padding-left:9px}',
      '.mr-hs-ok{color:#a6e22e}',
      '.mr-hs-mal{color:#ffb4b4}',
      '.mr-hs-pre{margin:0;padding:10px;border-radius:8px;background:#0e1012;color:#dfe3e6;font-family:ui-monospace,Consolas,monospace;',
      'font-size:12px;line-height:17px;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}',
      '.mr-hs-acciones{display:flex;gap:8px;flex-wrap:wrap}',
      '.mr-hs-accion{cursor:pointer;padding:6px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-secondary,#3a3f45);',
      'background:var(--dsw-alias-bg-secondary,#1b1e21);color:inherit;font:inherit;font-size:12px}',
      '.mr-hs-accion:hover{border-color:#e4f226}',
      '.mr-hs-accion[data-copiado="si"]{border-color:#a6e22e;color:#a6e22e}',
    ].join('');

    if (typeof document !== 'undefined') {
      const tagId = 'ratacode-piel/handshakes.css';
      if (document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'ratacode-piel';
        tag.dataset.pluginCss = tagId;
        tag.textContent = CSS;
        document.head.appendChild(tag);
      }
    }

    /** Un pedido a las rutas de la piel; nunca revienta: devuelve el error. */
    async function pedir(ruta, metodo) {
      try {
        const res = await fetch(ruta, { method: metodo, credentials: 'same-origin', cache: 'no-store' });
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

    /** Un botón grande de la sección (el título y su explicación). */
    function Boton(props) {
      return e('button', {
        type: 'button',
        className: 'mr-hs-boton',
        'data-abierto': props.abierto ? 'si' : 'no',
        'aria-expanded': props.abierto ? 'true' : 'false',
        onClick: props.onClick,
      }, e('span', { className: 'mr-hs-titulo' }, props.titulo), e('span', { className: 'mr-hs-sub' }, props.sub));
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
     * La sección «Handshakes» de Ajustes.
     * @param props - props del asiento (renderSlot, close…) más lo inyectado.
     * @returns el árbol de la sección.
     */
    function SeccionHandshakes() {
      const [vista, setVista] = React.useState(null);
      const [nav, setNav] = React.useState({ fase: 'quieto' });
      const [mcp, setMcp] = React.useState({ fase: 'quieto' });
      const [aviso, setAviso] = React.useState('');

      const pulsarNavegador = () => {
        setVista(vista === 'navegador' ? null : 'navegador');
        if (nav.fase === 'cargando' || nav.fase === 'listo') return;
        setNav({ fase: 'cargando' });
        setAviso('');
        pedir('/ratacode/handshake', 'POST').then((r) => {
          if (!r.ok) { setNav({ fase: 'error', error: r.error ?? 'error' }); return; }
          setNav({ fase: 'listo', texto: r.texto, ruta: r.ruta, url: r.url, casa: r.casa });
          Promise.resolve(copiarAlPortapapeles(r.texto)).then((ok) => {
            setAviso(ok ? 'Copiado al portapapeles. ' : '');
          });
        });
      };

      const pulsarMcp = () => {
        setVista(vista === 'mcp' ? null : 'mcp');
        if (mcp.fase === 'cargando') return;
        setMcp({ fase: 'cargando' });
        pedir('/ratacode/mcp', 'GET').then((r) => {
          if (!r.ok) { setMcp({ fase: 'error', error: r.error ?? 'error' }); return; }
          setMcp({ fase: 'listo', datos: r });
        });
      };

      const hijos = [];

      hijos.push(e('p', { className: 'mr-hs-intro', key: 'intro' },
        'Aquí se dan la mano los dos que trabajan con RATACODE: los agentes con navegador '
        + '(por el apretón de manos) y los chats web (por el MCP). Las claves de los modelos no se '
        + 'piden aquí: se ponen en Ajustes › Models, como siempre.'));

      hijos.push(e('div', { className: 'mr-hs-botones', key: 'botones' },
        e(Boton, {
          key: 'navegador',
          abierto: vista === 'navegador',
          titulo: 'Agentes con navegador (Claude Code, Codex, OpenClaw, Rowboat…)',
          sub: 'Copia el apretón de manos de esta casa y lo deja en <casa>\\handshake.md',
          onClick: pulsarNavegador,
        }),
        vista === 'navegador' ? e('div', { className: 'mr-hs-caja', key: 'navegador-caja' }, panelNavegador(nav, aviso)) : null,
        e(Boton, {
          key: 'mcp',
          abierto: vista === 'mcp',
          titulo: 'Chats web (ChatGPT, Claude…)',
          sub: 'El MCP por HTTP + túnel, el aviso de lectura total y el texto para pegar en el chat',
          onClick: pulsarMcp,
        }),
        vista === 'mcp' ? e('div', { className: 'mr-hs-caja', key: 'mcp-caja' }, panelMcp(mcp)) : null));

      return e('div', { className: 'mr-hs' }, hijos);
    }

    /** El panel del apretón de manos (agentes con navegador). */
    function panelNavegador(nav, aviso) {
      if (nav.fase === 'cargando') return [e('p', { className: 'mr-hs-linea', key: 'l' }, 'Escribiendo el apretón de esta casa…')];
      if (nav.fase === 'error') return [e('p', { className: 'mr-hs-aviso', key: 'l' }, 'No pude preparar el apretón: ' + nav.error)];
      if (nav.fase !== 'listo') return [e('p', { className: 'mr-hs-linea', key: 'l' }, 'Pulsa el botón: se copia y se deja en el fichero de la casa.')];
      return [
        e('p', { className: 'mr-hs-linea mr-hs-ok', key: 'ruta' },
          (aviso ?? '') + 'Dejado en ' + nav.ruta + ' (' + nav.texto.split('\n').length + ' líneas).'),
        e('p', { className: 'mr-hs-linea', key: 'uso' },
          'Quien lo reciba abre el panel de esta casa, pregunta primero «¿qué porcentaje del trabajo quieres '
          + 'que descargue en RATACODE?» y trabaja según tu respuesta.'),
        e('pre', { className: 'mr-hs-pre', key: 'texto' }, nav.texto),
        e(Bloque, { key: 'copiar', texto: nav.texto, etiqueta: 'Copiar otra vez' }),
      ];
    }

    /** El panel del MCP para chats web. */
    function panelMcp(mcp) {
      if (mcp.fase === 'cargando') return [e('p', { className: 'mr-hs-linea', key: 'l' }, 'Mirando si el MCP y el túnel están abiertos…')];
      if (mcp.fase === 'error') return [e('p', { className: 'mr-hs-aviso', key: 'l' }, 'No pude mirar el MCP: ' + mcp.error)];
      if (mcp.fase !== 'listo') return [e('p', { className: 'mr-hs-linea', key: 'l' }, 'Pulsa el botón para ver el estado y el texto que se pega en el chat.')];
      const d = mcp.datos;
      const abierto = d.tunel && d.tunel.abierto === true;
      const hijos = [];
      hijos.push(e('p', { className: 'mr-hs-linea', key: 'estado' },
        'MCP por HTTP: ', e('b', { key: 'h' }, d.http && d.http.abierto ? 'arrancado' : 'parado'),
        d.http && d.http.url ? ' (' + d.http.url.replace(/\/mcp\/.*$/, '/mcp/<oculta>') + ')' : '',
        ' · Túnel de Cloudflare: ', e('b', { key: 't' }, abierto ? 'ABIERTO' : 'cerrado'),
        abierto ? ' (' + d.tunel.url.replace(/\/mcp\/.*$/, '/mcp/<oculta>') + ')' : ''));
      if (abierto) {
        hijos.push(e('p', { className: 'mr-hs-linea', key: 'url' },
          'URL pública para pegar en el chat (modo desarrollador → conector MCP): ', e('code', { key: 'c' }, d.tunel.url)));
      } else {
        hijos.push(e('p', { className: 'mr-hs-aviso', key: 'cerrado' },
          'El túnel NO está abierto, así que ningún chat web puede llegar a este PC. Arranca los dos comandos, '
          + 'cada uno en su ventana (el primero deja el MCP por HTTP escuchando en 3778; el segundo abre el túnel):'));
        hijos.push(e('pre', { className: 'mr-hs-pre', key: 'comandos' }, d.comandos));
        hijos.push(e(Bloque, { key: 'copiar-comandos', texto: d.comandos, etiqueta: 'Copiar los dos comandos' }));
      }
      hijos.push(e('p', { className: 'mr-hs-aviso', key: 'lectura' },
        'AVISO DE LECTURA TOTAL: el motor de RATACODE no sabe acotar lo que una tarea LEE, así que quien tenga '
        + 'esa URL puede pedir que le lea ficheros de este PC. Por eso el MCP por HTTP y el túnel exigen '
        + '--acepto-lectura-total. No la compartas y ciérralo (Ctrl+C) al acabar.'));
      hijos.push(e('p', { className: 'mr-hs-linea', key: 'pegar-intro' },
        'Esto es lo que se pega en el chat (dice qué es RATACODE, las herramientas y cómo esperar a que acabe):'));
      hijos.push(e('pre', { className: 'mr-hs-pre', key: 'pegar' }, d.pegar));
      hijos.push(e(Bloque, { key: 'copiar-pegar', texto: d.pegar, etiqueta: 'Copiar el texto del chat' }));
      return hijos;
    }

    /** Servicios que necesita el plugin de cliente. */
    const inject = ['slots'];

    /**
     * Monta la sección «Handshakes» en el menú de Ajustes.
     * @param ctx - contexto del plugin de navegador.
     */
    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'handshakes',
        order: 25,
        label: () => 'Handshakes',
      }, SeccionHandshakes));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
