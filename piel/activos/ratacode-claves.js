/* RATACODE · LA VENTANA DE LAS 3 CLAVES (S2).
   Sale la primera vez EN LUGAR DEL «Add an API key to get started» de DSH
   (que sólo pide DeepSeek; dispara dsh-client-ui-settings-models con
   onboardingReadiness → «credential-missing»). Pide B.AI, OpenRouter y
   DeepSeek. Cada clave se guarda por el MISMO camino que Ajustes > Models:
   el servidor de esta piel llama a ctx.credentials.set(ref, valor) — el
   servicio de credenciales de DSH, que escribe <casa>\.credentials.yaml.
   Aquí en el navegador sólo se habla con las rutas propias /ratacode/estado
   y /ratacode/guardar, autenticadas con la cookie de sesión del motor.
   Nunca se registra el valor de una clave en consola. */
(() => {
  'use strict';
  if (window.__ratacodeClaves) return;
  window.__ratacodeClaves = true;

  const CAMPOS = [
    { ref: 'B_AI_API_KEY', nombre: 'B.AI', donde: 'Saca tu clave de B.AI (pide abrirse cuenta)', url: 'https://b.ai' },
    { ref: 'OPENROUTER_API_KEY', nombre: 'OpenRouter', donde: 'Saca tu clave en openrouter.ai/keys', url: 'https://openrouter.ai/keys' },
    { ref: 'DEEPSEEK_API_KEY', nombre: 'DeepSeek', donde: 'Saca tu clave en platform.deepseek.com/api_keys', url: 'https://platform.deepseek.com/api_keys' },
  ];
  // Títulos con los que DSH dispara su ventana nativa de primera vez
  // (dsh-client-ui-settings-models/lib/client.js: onboardingTitle en inglés y chino).
  const TITULOS_NATIVOS = ['Add an API key to get started', '添加一个 API Key 开始使用'];
  // El botón «atras» de esa ventana nativa (onboardingLater), para que se
  // desmonte ella sola y libere el `inert` que pone sobre #root.
  const ATRAS_NATIVOS = ['Configure later', '稍后配置'];

  // ── tapar la ventana nativa de DSH (la nuestra va en su lugar) ──────────
  function contenedorNativo(hijo) {
    const h2s = hijo.querySelectorAll ? hijo.querySelectorAll('h2') : [];
    for (const t of h2s) {
      const s = (t.textContent || '').trim();
      if (TITULOS_NATIVOS.indexOf(s) !== -1) return true;
    }
    return false;
  }
  function taparNativa() {
    let hay = false;
    for (const hijo of Array.from(document.body.children)) {
      if (hijo.nodeType !== 1) continue;
      if (hijo.id === 'ratacode-claves-fondo') continue;
      if (hijo.id === 'root') continue; // jamás ocultamos la app entera
      if (!contenedorNativo(hijo)) continue;
      hay = true;
      if (hijo.style.display !== 'none') hijo.style.setProperty('display', 'none', 'important');
      hijo.setAttribute('aria-hidden', 'true');
      // Que la nativa se cierre sola (su botón «Configure later» → complete()
      // → desmontaje → #root deja de estar inert). Si no aparece, recurso:
      let atras = null;
      for (const b of hijo.querySelectorAll('button')) {
        const s = (b.textContent || '').trim();
        if (ATRAS_NATIVOS.indexOf(s) !== -1) { atras = b; break; }
      }
      if (atras) { try { atras.click(); } catch (e) { /* da igual: sigue tapada */ } }
      const raiz = document.getElementById('root');
      if (raiz && raiz.inert) raiz.inert = false;
    }
    return hay;
  }
  function vigilarNativa() {
    taparNativa();
    let pendiente = false;
    const mo = new MutationObserver(() => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => { pendiente = false; taparNativa(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ── hablar con el servidor de la piel ───────────────────────────────────
  async function leerEstado() {
    for (let intento = 0; intento < 4; intento += 1) {
      try {
        const res = await fetch('/ratacode/estado', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
        if (res.status === 401 || res.status === 403) return { sinAutorizacion: true };
        if (res.status === 404) { await new Promise((r) => setTimeout(r, 900)); continue; } // montando aún
        const datos = await res.json().catch(() => null);
        if (!datos || !datos.claves) return { error: true };
        return { claves: datos.claves, casa: typeof datos.casa === 'string' ? datos.casa : '' };
      } catch (e) {
        await new Promise((r) => setTimeout(r, 900));
      }
    }
    return { error: true };
  }
  async function guardarClave(ref, valor) {
    try {
      const res = await fetch('/ratacode/guardar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref, valor }),
      });
      const datos = await res.json().catch(() => null);
      if (datos && datos.ok) return { ok: true };
      return { ok: false, error: (datos && datos.error) || ('HTTP ' + res.status) };
    } catch (e) {
      return { ok: false, error: 'sin conexión con el servidor' };
    }
  }

  // ── «Luego» se recuerda POR CASA ────────────────────────────────────────
  // Sin esto, quien pulsa «Luego» (típicamente porque ya tiene la clave en el
  // entorno) se encontraba la ventana otra vez en CADA recarga. El localStorage
  // del navegador es por origen (esquema://host:puerto), y el puerto no
  // distingue una casa de otra: por eso la clave lleva dentro la casa, que la
  // dice /ratacode/estado.
  function claveDeLuego(casa) {
    return 'ratacode.luego.' + (casa || 'casa');
  }
  function recordarLuego(casa) {
    try { window.localStorage.setItem(claveDeLuego(casa), '1'); } catch (e) { /* sin localStorage: se vuelve a preguntar */ }
  }
  function yaDijoLuego(casa) {
    try { return window.localStorage.getItem(claveDeLuego(casa)) === '1'; } catch (e) { return false; }
  }

  function debeSalir(claves, casa) {
    // «La ventana no sale si ya hay al menos una clave»: por clave «que ya
    // hay» se entiende una guardada en el almacén de la casa (origen 'file'
    // o un .env): si el usuario ya guardó una, no es la primera vez. Las que
    // «vienen del entorno» (origen 'env', read-only) NO cuentan como
    // guardadas: salen como campo bloqueado «ya puesta (entorno)», y la
    // ventana sigue pidiendo las que faltan.
    for (const campo of CAMPOS) {
      const c = claves[campo.ref];
      if (c && c.configurada === true && c.origen !== 'env') return false;
    }
    // Si el usuario ya pulsó «Luego» en ESTA casa, no se le vuelve a salir
    // sola: para volver a verla está el enlace «Claves» de la barra lateral.
    // Es lo que pasa cuando tiene la clave en el entorno: la ventana salía en
    // cada recarga pidiendo las otras dos.
    if (yaDijoLuego(casa)) return false;
    // Si no queda ninguna por pedir (las tres ya del entorno), no hay nada
    // que recoger: no se sale.
    const pendientes = CAMPOS.filter((campo) => {
      const c = claves[campo.ref];
      return !(c && c.configurada === true);
    });
    return pendientes.length > 0;
  }

  // ── la ventana ──────────────────────────────────────────────────────────
  function nombreDe(ref) {
    const c = CAMPOS.find((x) => x.ref === ref);
    return c ? c.nombre : ref;
  }
  function mensajeDe(r) {
    if (!r) return 'no hubo respuesta';
    if (r.error === 'ya-entorno') return 'ya la trae el entorno de este proceso';
    return r.error || 'error';
  }

  function construir(claves, casa) {
    const fondo = document.createElement('div');
    fondo.id = 'ratacode-claves-fondo';

    const caja = document.createElement('div');
    caja.className = 'rc-claves';
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-modal', 'true');
    caja.setAttribute('aria-labelledby', 'rc-titulo');

    const cab = document.createElement('div');
    cab.className = 'rc-cab';
    const emblema = document.createElement('span');
    emblema.className = 'mr-emblema';
    emblema.setAttribute('role', 'img');
    emblema.setAttribute('aria-label', 'Rata de RATACODE');
    const titulo = document.createElement('div');
    titulo.className = 'rc-titulo';
    titulo.id = 'rc-titulo';
    titulo.append('Las 3 claves de RATACODE');
    const kicker = document.createElement('div');
    kicker.className = 'rc-kicker';
    kicker.textContent = 'TRABAJO BRUTO · CONTROL TOTAL';
    cab.append(emblema, titulo, kicker);
    caja.append(cab);

    const des = document.createElement('p');
    des.className = 'rc-des';
    const code = document.createElement('code');
    code.textContent = '.credentials.yaml';
    des.append('Pégalas aquí. Cada clave se guarda en tu casa (', code,
      '), igual que desde Ajustes › Models. Ninguna clave viaja dentro del paquete.');
    caja.append(des);

    const inputs = {};
    for (const campo of CAMPOS) {
      const info = claves[campo.ref] || {};
      const bloque = document.createElement('div');
      bloque.className = 'rc-campo';

      const fila = document.createElement('div');
      fila.className = 'rc-fila';
      const nombre = document.createElement('span');
      nombre.className = 'rc-nombre';
      nombre.textContent = campo.nombre;
      const varc = document.createElement('span');
      varc.className = 'rc-var';
      varc.textContent = ' ' + campo.ref;
      nombre.append(varc);
      const enlace = document.createElement('a');
      enlace.className = 'rc-enlace';
      enlace.href = campo.url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = 'dónde sacarla ↗';
      enlace.title = campo.donde;
      fila.append(nombre, enlace);
      bloque.append(fila);

      if (info.configurada === true && info.origen === 'env') {
        const puesta = document.createElement('div');
        puesta.className = 'rc-puesta';
        puesta.textContent = 'ya puesta (entorno)';
        const small = document.createElement('small');
        small.textContent = 'te la da el entorno de arranque: no se puede editar aquí';
        puesta.append(small);
        bloque.append(puesta);
      } else {
        const inp = document.createElement('input');
        inp.className = 'rc-input';
        inp.type = 'password';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.placeholder = 'pega tu clave de ' + campo.nombre;
        inp.setAttribute('aria-label', 'Clave de ' + campo.nombre);
        inputs[campo.ref] = inp;
        bloque.append(inp);
      }
      caja.append(bloque);
    }

    const error = document.createElement('p');
    error.className = 'rc-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    caja.append(error);

    const acciones = document.createElement('div');
    acciones.className = 'rc-acciones';
    const luego = document.createElement('button');
    luego.className = 'rc-luego';
    luego.type = 'button';
    luego.textContent = 'Luego';
    const guardar = document.createElement('button');
    guardar.className = 'rc-guardar';
    guardar.type = 'button';
    guardar.textContent = 'Guardar';
    acciones.append(luego, guardar);
    caja.append(acciones);
    fondo.append(caja);

    const cerrar = () => fondo.remove();
    // «Luego» se recuerda en esta casa: la ventana no vuelve a salir sola.
    luego.addEventListener('click', () => { recordarLuego(casa); cerrar(); });
    fondo.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(); });

    let guardando = false;
    guardar.addEventListener('click', async () => {
      if (guardando) return;
      const pendientes = [];
      for (const campo of CAMPOS) {
        const inp = inputs[campo.ref];
        if (!inp) continue;
        const v = inp.value.trim();
        if (v.length > 0) pendientes.push({ ref: campo.ref, valor: v });
      }
      if (pendientes.length === 0) {
        error.textContent = 'No has escrito ninguna clave: guarda al menos una o pulsa «Luego».';
        error.hidden = false;
        return;
      }
      guardando = true;
      guardar.disabled = true;
      error.hidden = true;
      const fallos = [];
      let ok = 0;
      for (const p of pendientes) {
        const r = await guardarClave(p.ref, p.valor);
        if (r.ok) { ok += 1; const inp = inputs[p.ref]; if (inp) inp.value = ''; }
        else fallos.push(nombreDe(p.ref) + ': ' + mensajeDe(r));
      }
      guardando = false;
      guardar.disabled = false;
      if (fallos.length === 0) {
        cerrar(); // ya no es la primera vez: hay al menos una clave guardada
      } else {
        error.textContent = 'Guardadas ' + ok + ' de ' + pendientes.length + '. Fallo — ' + fallos.join(' · ') + '.';
        error.hidden = false;
      }
    });

    return { fondo, primeraInput: Object.values(inputs)[0] };
  }

  /**
   * Abre la ventana. `porBoton` la abre a mano (desde el enlace «Claves» de la
   * barra lateral): entonces se salta el «ya dijo Luego» y el «ya hay clave»,
   * porque el usuario la está pidiendo a propósito.
   */
  async function abrirVentana(porBoton) {
    const st = await leerEstado();
    if (st.error || st.sinAutorizacion) return false; // sin canal o sin sesión: no forzar nada
    if (!porBoton && !debeSalir(st.claves, st.casa)) return false;
    taparNativa();
    vigilarNativa();
    const { fondo, primeraInput } = construir(st.claves, st.casa);
    document.body.append(fondo);
    if (primeraInput) primeraInput.focus();
    return true;
  }
  // El enlace «Claves» de la piel (ratacode-piel.js) llama aquí.
  window.__ratacodeAbrirClaves = () => { abrirVentana(true); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { abrirVentana(false); });
  } else {
    abrirVentana(false);
  }
})();
