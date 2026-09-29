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
     * R23 · La sección «Conexiones» de Ajustes: dos tarjetas, cada una con sus
     * pasos 1-2-3 y un botón por acción. Lo que se explica largo va plegado.
     */
    function SeccionConexiones() {
      const [texto, setTexto] = React.useState(null);
      const [copiado, setCopiado] = React.useState('');
      const [conexion, setConexion] = React.useState({ fase: 'cargando' });
      const [enCurso, setEnCurso] = React.useState('');
      const [dicho, setDicho] = React.useState('');

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
      const tarjeta = [
        e('div', { className: 'mr-cx-cabeza', key: 'cabeza' },
          e('span', { className: 'mr-cx-nombre' }, 'ChatGPT y Claude web'),
          e('span', { className: 'mr-ml-pildora ' + (conectado ? 'mr-ml-encendido' : 'mr-ml-sin') },
            conectado ? 'Conectado' : 'Sin conectar')),
        e(Paso, { n: '1', key: 'p1' }, 'Enciende la conexión',
          conectado
            ? e('button', { type: 'button', className: 'mr-ml-boton', onClick: () => botonConexion('apagar') },
              enCurso === 'apagar' ? 'Apagando…' : 'Apagar')
            : e('button', { type: 'button', className: 'mr-ml-boton', 'data-accion': 'encender', onClick: () => botonConexion('encender') },
              enCurso === 'encender' ? 'Encendiendo…' : 'Encender')),
        e(Paso, { n: '2', key: 'p2' }, 'Copia la dirección',
          conectado
            ? e('button', { type: 'button', className: 'mr-ml-boton', onClick: () => copiarConAviso('direccion', d.direccion) },
              copiado === 'direccion' ? 'Copiada ✓' : 'Copiar dirección')
            : null),
        e(Paso, { n: '3', key: 'p3' }, 'Pégala en ChatGPT › Ajustes › Conectores'),
        e('p', { className: 'mr-ml-nota', key: 'aviso' },
          'Mientras está encendida, quien tenga la dirección puede leer tus ficheros. Apágala al terminar.'),
      ];
      if (conexion.fase === 'error') {
        tarjeta.push(e('p', { className: 'mr-ml-aviso', key: 'error' }, 'No pude mirar la conexión: ' + conexion.error));
      }
      if (d !== null && !d.nuestro && conectado) {
        tarjeta.push(e('p', { className: 'mr-ml-nota', key: 'ajena' },
          'La encendiste tú (en una ventana): se apaga con Ctrl+C ahí.'));
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

    /** Servicios que necesita el plugin de cliente. */
    const inject = ['slots', 'locale'];

    /**
     * Monta las secciones de la piel en el menú de Ajustes: «Modelos locales» (R18,
     * justo detrás de Models) y «Conexiones» (R12/R23).
     * @param ctx - contexto del plugin de navegador.
     */
    function apply(ctx) {
      // R21 · el español, por la vía oficial de idiomas. Va LO PRIMERO: cuanto
      // antes esté el diccionario, antes sale la pantalla en cristiano.
      const idiomas = paqueteDeIdioma(ctx);
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
      if (typeof console !== 'undefined') {
        console.info('RATACODE · Ajustes › General › Language: ' + IDIOMA_ETIQUETA
          + ' (' + IDIOMA + ', ' + idiomas.length + ' diccionarios)');
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
