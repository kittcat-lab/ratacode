/* ============================================================
   RATACODE · «vida» (13-sep-2026 · chispa liviana)
   La nube de chispas: un efecto propio de RATACODE (canvas fino, sin dependencias).
   Va DETRÁS de las respuestas, nunca dentro de la caja de escribir: las chispas
   forman el emblema de RATACODE, se apartan cuando pasa el ratón y vuelven a su
   sitio con un muelle. No recoge clics: no estorba al escribir.
   Va lo más liviana posible SIN perder la gracia:
     · la mitad de chispas (objetivo 700, tope 900, sueltas 20 por cada 945 px)
     · lienzo a dpr 1 y brillo sólo con la chispa revuelta
     · 15 imágenes/s en reposo; 60 mientras hay uso (ratón o teclado) y 3 s más
     · UN solo vigilante (un reloj de 500 ms) en vez de tres redes que se pisaban
     · una sola rata: la de RATACODE (fuera nombres e identidades de la casa)
   Se apaga con «reducir movimiento» y se pausa con la pestaña oculta.
   ============================================================ */
(() => {
  const MARCA = 'mr-vida';                     // lo esperan ratacode-piel.css:84-89
  window.__mrVidaDispose?.();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tactil = matchMedia('(hover: none)').matches;
  const eventos = new AbortController();
  const VELOCIDAD = 0.8; // Mismo movimiento, con el reloj un 20 % más lento.
  /* (d) Dos frecuencias, una sola velocidad. Con uso (ratón moviéndose dentro o
     tecla pulsada) se dibuja a 60; sin uso, a 15. El reloj de la animación sigue
     contando tiempo de verdad, así que esto cambia la FRECUENCIA, no el
     movimiento: lo que se aprobó no se toca. Los dos umbrales van un pelín POR
     DEBAJO del salto del monitor a propósito: clavados en 16,67 ms el reloj
     empata con el salto y se pierde un fotograma de cada dos (medido en el banco:
     salía a 43,6 imágenes en vez de 60). Con 1000/17 = 58,8 ms el reposo cae en el
     4.º salto de un monitor de 60 Hz (66,7 ms) y en el 9.º de uno de 144 → 15
     imágenes por segundo en ambos. Y 3 s de cortesía tras el último uso, para que
     el regreso con muelle se vea entero y no a saltos. */
  /* R33: en reposo se sube de 15 a 30 imágenes. Las ratas ahora CORREN (no
     tiemblan sobre un muelle) y a 15 una carrera se ve a saltos; como son la
     mitad de ratas, el pincel trabaja lo mismo que antes. */
  const CUADRO = 1000 / 61, CUADRO_EN_REPOSO = 1000 / 31, USO = 3000, PASO_MAX = 1000 / 12;

  /* ---------- los dos tintes: el rosa y el amarillo de la casa ---------- */
  const raiz = getComputedStyle(document.documentElement);
  function cssColor(nombre, defecto) {
    const v = (raiz.getPropertyValue(nombre) || '').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : defecto;
  }
  const TINTAS = {
    personal: cssColor('--mr-pink', '#ff268e'),
    amarillo: cssColor('--mr-yellow', '#e4f226')
  };
  const NOMBRE_RATA = 'RATACODE';              // la única rata: no hay personajes

  /* ---------- la luz redonda que va detrás de cada chispa ---------- */
  function brillo(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const g = c.getContext('2d'), gr = g.createRadialGradient(12, 12, 0, 12, 12, 12);
    gr.addColorStop(0, `rgba(${rgb},0.55)`); gr.addColorStop(0.35, `rgba(${rgb},0.18)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 24, 24); return c;
  }
  // Ratita entera vista desde el cielo: lomo, orejas, hocico y cola curva.
  // Las 16 orientaciones se dibujan UNA vez; el movimiento reutiliza sellos.
  // `cola` (1 o -1) dobla la cola a un lado o al otro: son las dos zancadas.
  /* R33 · VOLUMEN. Sobre la silueta ya pintada (y sólo sobre ella: `source-atop`)
     va un reflejo arriba a la izquierda y el borde oscurecido, como una bolita
     iluminada. La luz se pone con el lienzo SIN girar, así que viene del mismo
     lado mire a donde mire la rata. */
  function volumen(g) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
    const sombra = g.createRadialGradient(32, 32, 6, 32, 32, 30);
    sombra.addColorStop(0, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = sombra; g.fillRect(0, 0, 64, 64);
    const luz = g.createRadialGradient(25, 23, 0, 25, 23, 17);
    luz.addColorStop(0, 'rgba(255,255,255,0.75)'); luz.addColorStop(0.45, 'rgba(255,255,255,0.22)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = luz; g.fillRect(0, 0, 64, 64);
  }
  // `postura`: 'pie' (alzada a mirar: cuerpo corto, cabeza grande, manos arriba)
  // o 'bola' (acurrucada, con la cola alrededor). Sin postura, la de correr.
  function ratita(color, giro, cola, postura) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.translate(32, 32); g.rotate(giro);
    g.fillStyle = g.strokeStyle = color; g.lineCap = 'round';
    g.lineWidth = 2.4;
    if (postura === 'pie') {
      g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(7, 16, 3, 22); g.stroke();
      g.beginPath(); g.ellipse(0, 4, 8, 8, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, -7, 7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(-7, -12, 4.2, 0, Math.PI * 2); g.arc(7, -12, 4.2, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(-11, -6); g.moveTo(6, 0); g.lineTo(11, -6); g.stroke();
      volumen(g); return c;
    }
    if (postura === 'bola') {
      g.beginPath(); g.arc(0, 2, 10, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(-5, -7, 3.4, 0, Math.PI * 2); g.arc(4, -8, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, 2, 14, Math.PI * 0.15, Math.PI * 1.25); g.stroke();
      volumen(g); return c;
    }
    g.beginPath(); g.moveTo(0, 11); g.bezierCurveTo(-9 * cola, 19, 13 * cola, 19, 4 * cola, 28); g.stroke();
    g.beginPath(); g.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-6, -7); g.quadraticCurveTo(-5, -15, 0, -23);
    g.quadraticCurveTo(5, -15, 6, -7); g.closePath(); g.fill();
    g.beginPath(); g.arc(-6, -9, 3.6, 0, Math.PI * 2); g.arc(6, -9, 3.6, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-6, -1); g.lineTo(-10, 2); g.moveTo(6, -1); g.lineTo(10, 2);
    g.moveTo(-6, 9); g.lineTo(-10, 12); g.moveTo(6, 9); g.lineTo(10, 12); g.stroke();
    volumen(g); return c;
  }
  /* Una sola rata, así que los sellos se hacen una vez al arrancar y ya está.
     Antes había un `Map` con hasta 4 juegos (uno por personaje de la casa) y un
     chequeo de identidad cada 150 ms que leía `localStorage` y la lista de la casa. */
  const BRILLO = {}, RATITA = {};
  for (const [tinte, hex] of Object.entries(TINTAS)) {
    BRILLO[tinte] = brillo([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(','));
    // Cuatro juegos de 16 sellos: las dos zancadas, de pie (2) y hecha una bola (3).
    RATITA[tinte] = [[1], [-1], [1, 'pie'], [1, 'bola']].map(([cola, postura]) =>
      Array.from({ length: 16 }, (_, i) => ratita(hex, i * Math.PI / 8, cola, postura)));
  }
  /* R33 · qué hace la IA, para que las ratas hagan otra cosa en cada caso. Lo
     mira el vigilante cada 500 ms y lo apunta en `<html data-mr-estado>` (la
     hoja lo usa para encender el lienzo y el borde de la caja):
       reposo    en formación, dibujando el emblema, pero vivas: cada una hace
                 de vez en cuando un GESTO (ver `GESTOS`) y cada tanto pasa una
                 ola por todo el emblema. Con el botón derecho en el fondo
                 vacío aparece un QUESO y van todas a comérselo. Las sueltas
                 merodean a su aire.
       pensando  hay botón de parar: BUSCAN QUESO. Cada cosa que pasa en la
                 conversación (una fila nueva: razonar, leer, escribir, un
                 comando…) suelta un queso DE SU COLOR a su altura, y mientras
                 esa fila sigue en marcha, otro cada 2,5 s. A cada queso sale
                 de la formación un GRUPO de vecinas, se lo come y vuelve; las
                 demás siguen dibujando el emblema. Ver `COLOR_QUESO`.
       hablando  hay `data-streaming` (también mientras razona): se CUADRAN en el
                 emblema, quietas, mirando hacia fuera y con un temblor mínimo,
                 listas para salir corriendo (antes el emblema latía: mareaba). Por cada
                 LÍNEA de texto que sale nace junto al texto un quesito rosa
                 con puntos amarillos que cae y REBOTA sobre la caja de escribir
                 (espantando a las ratas que pille cerca) hasta apagarse.
       espera    hay una tarjeta que te pide algo (permiso, pregunta o plan): se
                 quedan en su sitio, DE PIE y mirándola; si es una pregunta,
                 gira un «?» de alambre en el centro.
     Y cuatro cosas sueltas, que pasan una vez y se van:
       fallo        una fila o una vuelta fallan: queso ROJO que tiembla y se
                    deshace solo; su grupo se queda a distancia, de pie, y huye
       reintento    «petición reintentada»: un queso naranja bota en el sitio
       compactación se apiñan todas en el centro un momento y se vuelven a abrir
       terminó      al volver a reposo, una ola rápida recorre el emblema */
  let estadoIA = 'reposo', previo = 'reposo';
  // La tarjeta que espera respuesta: dónde está (en el lienzo) y si es una pregunta.
  const ESPERA = '[data-approval-key],[data-question-key],[data-plan-review-key]';
  const esperaEn = { x: 0, y: 0, pregunta: false };
  const PARAR = "[data-composer-card] button:is([aria-label*='Detener'],[aria-label*='Stop'],[aria-label*='停止'])";
  const entre = (v, a, b) => Math.min(b, Math.max(a, v));
  function otroDestino(p) {
    if (p.grupo >= 0 && Math.random() < 0.3) {
      const o = parts[(Math.random() * parts.length) | 0]; p.tx = o.x; p.ty = o.y;
    } else {
      const a = Math.random() * Math.PI * 2, l = 50 + Math.random() * 190;
      p.tx = entre(p.x + Math.cos(a) * l, 16, W - 16); p.ty = entre(p.y + Math.sin(a) * l, 16, H - 16);
    }
    p.paso = 0.7 + Math.random() * 1.5;
  }
  /* LOS GESTOS DEL REPOSO: lo que le puede dar a una rata que está en su sitio
     sin hacer nada. Nombre, peso (cuánto sale) y lo que dura en ms (mín, máx):
       aseo     hecha una bola, sacude la cabeza      pie      se alza a mirar
       duerme   hecha una bola, respira despacio      brinco   dos saltos seguidos
       tiembla  un escalofrío                         gira     se persigue la cola
       paseo    sale de la fila a olfatear y vuelve   pelea    vueltas contra la vecina
       caza     persigue a la vecina, que huye        cambio   se cambia el sitio con la vecina
     Los tres últimos necesitan vecina libre; si no la hay, no pasa nada. */
  const GESTOS = [['aseo', 22, 700, 2000], ['pie', 14, 1000, 2500], ['duerme', 10, 3000, 7000], ['brinco', 10, 800, 800],
    ['tiembla', 10, 500, 900], ['gira', 8, 900, 900], ['paseo', 8, 4000, 8000], ['pelea', 7, 900, 1600],
    ['caza', 6, 2000, 3500], ['cambio', 5, 0, 0]];
  const PESO_GESTOS = GESTOS.reduce((s, g) => s + g[1], 0);
  // La vecina de formación más cercana que esté libre. Una pasada, sólo al empezar el gesto.
  function vecina(p) {
    let otra = null, cerca = 45 * 45;
    for (const o of parts) {
      if (o === p || o.gesto) continue;
      const dd = (o.hx - p.hx) ** 2 + (o.hy - p.hy) ** 2;
      if (dd < cerca) { cerca = dd; otra = o; }
    }
    return otra;
  }
  function nuevoGesto(p, t) {
    let n = Math.random() * PESO_GESTOS, g = GESTOS[0];
    for (const cual of GESTOS) { if ((n -= cual[1]) < 0) { g = cual; break; } }
    const nombre = g[0], fin = t + g[2] + Math.random() * (g[3] - g[2]);
    if (nombre === 'pelea' || nombre === 'caza' || nombre === 'cambio') {
      const o = vecina(p);
      if (!o) return;
      if (nombre === 'cambio') { [p.hx, o.hx] = [o.hx, p.hx]; [p.hy, o.hy] = [o.hy, p.hy]; return; }
      o.gesto = nombre === 'caza' ? 'huye' : 'pelea'; o.otra = p; o.ini = t; o.fin = fin; p.otra = o;
    }
    if (nombre === 'paseo') {
      const a = Math.random() * Math.PI * 2, l = 80 + Math.random() * 140;
      p.gx = entre(p.hx + Math.cos(a) * l, 16, W - 16); p.gy = entre(p.hy + Math.sin(a) * l, 16, H - 16);
    }
    p.gesto = nombre; p.ini = t; p.fin = fin;
  }
  /* La ola: cada 15-30 s de reposo sale de un punto y recorre el emblema; cada
     rata da un brinco cuando le pasa por encima. */
  let ola = null, proximaOla = 12000;
  /* El contador de quesos: se guarda en el navegador y se enseña un momento al
     acabarse cada queso. Sin almacén (ventana privada) cuenta desde cero. */
  let rotulo = null;
  function otroQuesoComido() {
    let n = 1;
    try { n = (Number(localStorage.getItem('mr-quesos')) || 0) + 1; localStorage.setItem('mr-quesos', String(n)); } catch { /* sin almacén */ }
    return n;
  }
  /* LOS QUESOS. `resto` va de 1 a 0 según se lo comen; `todas` marca el del
     botón derecho (van todas y cuenta para el marcador). Cada rata apunta en
     `p.queso` a cuál va. */
  let quesos = [], proximoQueso = 0;
  /* De qué color es el queso de cada tipo de fila (líneas, lunares). Los mismos
     colores llevan las palabras de las filas en la hoja. */
  const AZUL = '#26c6cc', NARANJA = '#ff9b2e', VIOLETA = '#b79cff', ROJO = '#ff5c7a';
  const COLOR_QUESO = {
    think: [TINTAS.amarillo, TINTAS.personal], write: [TINTAS.personal, TINTAS.amarillo], edit: [TINTAS.personal, TINTAS.amarillo],
    read: [AZUL, TINTAS.personal], search: [AZUL, TINTAS.personal], bash: [NARANJA, TINTAS.amarillo], others: [VIOLETA, TINTAS.amarillo]
  };
  /* Cuatro veces por segundo se miran las filas de la conversación. Fila que no
     se había visto, o que sigue en marcha desde hace 2,5 s: un queso (como mucho
     6 a la vez). Sólo si la IA está trabajando: con ella parada las filas se
     apuntan como vistas y ya está (así no llueven quesos al abrir una sesión). */
  const vistas = new WeakMap();                 // fila → { t, estado } de la última vez que se miró
  let ultimoTrabajo = -1e9, apina = 0;
  const FILAS = '[data-variant],[data-chat-flow-kind="turn-error"],[data-chat-flow-kind="model-retry"],[data-compaction-disclosure]';
  function mirarEventos(t) {
    proximoQueso = t + 250;
    if (!lienzo) return;
    if (estadoIA !== 'reposo') ultimoTrabajo = t;
    const activo = t - ultimoTrabajo < 3000;    // trabajando, o recién acabado (el fallo de vuelta llega al final)
    const l = lienzo.getBoundingClientRect();
    const tarjeta = document.querySelector('[data-composer-card]')?.getBoundingClientRect();
    suelo = tarjeta ? entre(tarjeta.top - l.top - 8, 60, H - 8) : H - 8;
    for (const fila of document.querySelectorAll(FILAS)) {
      const antes = vistas.get(fila), estado = fila.dataset.state || '';
      const nueva = !antes, cambia = !nueva && antes.estado !== estado;
      if (!nueva && !cambia && !(estado === 'running' && t - antes.t > 2500)) continue;
      vistas.set(fila, { t, estado });
      if (!activo) continue;
      const r = fila.getBoundingClientRect(), y = entre(r.top - l.top + (Math.random() - 0.5) * 120, 40, H - 40);
      const tipo = fila.dataset.chatFlowKind;
      if (tipo === 'model-retry') {               // reintento: un queso naranja que bota en el sitio
        if (nueva && rebotes.length < 12) rebotes.push({ x: 40 + Math.random() * (W - 80), y: Math.min(y, suelo - 12), vx: 0, vy: -5, t0: t, colores: [NARANJA, TINTAS.amarillo] });
        continue;
      }
      if (fila.hasAttribute('data-compaction-disclosure')) { if (nueva) apina = t + 1600; continue; }
      const falla = tipo === 'turn-error' || estado === 'error';
      if (cambia && !falla) continue;             // de «en marcha» a «hecha»: su queso ya salió
      const colores = falla ? [ROJO, '#7a1830'] : COLOR_QUESO[fila.dataset.variant];
      if (!colores || quesos.length >= 6) continue;
      const grupo = grupoLibre(12 + (Math.random() * 14 | 0));
      if (grupo) ponerQueso(40 + Math.random() * (W - 80), y, grupo, colores).malo = falla;
    }
  }
  const radioDe = q => 5 + 13 * Math.sqrt(Math.max(q.resto, 0));
  /* LOS QUESITOS DE HABLAR: uno por línea de texto nueva. Cuatro veces por
     segundo se mide lo que ha crecido el texto que está saliendo (unos 20 px
     por línea); medir más a menudo obligaría a la página a recalcularse. */
  let rebotes = [], altoTexto = 0, suelo = 0, proximaMedida = 0;
  function medirTexto(t) {
    proximaMedida = t + 250;
    const el = document.querySelector('[data-streaming]');
    if (!el || !lienzo) return;
    const r = el.getBoundingClientRect(), l = lienzo.getBoundingClientRect();
    if (!altoTexto || r.height < altoTexto) { altoTexto = r.height; return; }
    const nuevas = Math.floor((r.height - altoTexto) / 20);
    altoTexto += nuevas * 20;
    for (let i = 0; i < Math.min(nuevas, 3) && rebotes.length < 12; i++) {
      rebotes.push({
        x: entre(r.left - l.left + Math.random() * r.width, 20, W - 20), y: entre(r.bottom - l.top, 20, suelo - 12),
        vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 2.5, t0: t, colores: [TINTAS.personal, TINTAS.amarillo]
      });
    }
  }
  // `grupo`: las ratas que van a por él; sin grupo, van todas (también las sueltas).
  function ponerQueso(x, y, grupo, colores = COLOR_QUESO.think) {
    const q = { x, y, resto: 1, roen: false, todas: !grupo, colores, t0: tiempo };
    for (const p of grupo || parts.concat(ambiente)) p.queso = q;
    quesos.push(q);
    document.documentElement.dataset.mrQueso = '';
    return q;
  }
  // Un grupo de vecinas de formación que estén libres: una al azar y las `n` de su alrededor.
  function grupoLibre(n) {
    const libres = parts.filter(p => !p.queso);
    if (!libres.length) return null;
    const s = libres[(Math.random() * libres.length) | 0];
    return libres.sort((a, b) => ((a.hx - s.hx) ** 2 + (a.hy - s.hy) ** 2) - ((b.hx - s.hx) ** 2 + (b.hy - s.hy) ** 2)).slice(0, n);
  }
  /* El queso, en alambre: una cuña en 3D hecha sólo de líneas (dos triángulos y
     tres aristas), con dos agujeros en la cara de arriba y puntitos en las tres
     paredes. Gira sobre su eje, cabecea y flota, con un poco de perspectiva (lo
     de cerca, más grande). Lima con resplandor y lo demás rosa: la casa. */
  const CUÑA = [[1, 0], [-1, -0.75], [-1, 0.75]];   // la planta: punta y dos esquinas (x, z)
  const PECAS = [[0.25, -0.15], [0.55, 0.12], [0.8, -0.05]];   // en cada pared: a lo largo (0-1) y altura
  function pintarQueso(x0, y0, R, alfa, lineas = TINTAS.amarillo, puntos = TINTAS.personal) {
    const giro = tiempo / 600, cg = Math.cos(giro), sg = Math.sin(giro);
    const cabeceo = 0.55 + 0.35 * Math.sin(tiempo / 850), cc = Math.cos(cabeceo), sc = Math.sin(cabeceo);
    const punto = (x, y, z) => {
      const x1 = x * cg - z * sg, z1 = x * sg + z * cg;         // gira sobre el eje vertical
      const y2 = y * cc + z1 * sc, z2 = z1 * cc - y * sc;       // cabecea hacia quien mira
      const cerca = R / (1 - z2 * 0.22);                        // perspectiva
      return [x1 * cerca, y2 * cerca];
    };
    const arriba = CUÑA.map(([x, z]) => punto(x, -0.4, z)), abajo = CUÑA.map(([x, z]) => punto(x, 0.4, z));
    ctx.save(); ctx.translate(x0, y0 + Math.sin(tiempo / 400) * 2); ctx.globalAlpha = alfa;
    ctx.strokeStyle = ctx.shadowColor = lineas; ctx.lineWidth = 1.4; ctx.lineJoin = ctx.lineCap = 'round';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const cara of [arriba, abajo]) { ctx.moveTo(cara[0][0], cara[0][1]); ctx.lineTo(cara[1][0], cara[1][1]); ctx.lineTo(cara[2][0], cara[2][1]); ctx.closePath(); }
    for (let i = 0; i < 3; i++) { ctx.moveTo(arriba[i][0], arriba[i][1]); ctx.lineTo(abajo[i][0], abajo[i][1]); }
    ctx.stroke();
    ctx.strokeStyle = ctx.fillStyle = ctx.shadowColor = puntos; ctx.lineWidth = 1.1;
    for (const [x, z, r] of [[-0.45, 0.15, 0.2], [0.2, -0.05, 0.13]]) {
      const [hx, hy] = punto(x, -0.4, z);
      ctx.beginPath(); ctx.ellipse(hx, hy, r * R, r * R * sc, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const [ax, az] = CUÑA[i], [bx, bz] = CUÑA[(i + 1) % 3];
      for (const [u, y] of PECAS) {
        const [qx, qy] = punto(ax + (bx - ax) * u, y, az + (bz - az) * u);
        ctx.moveTo(qx + 1.1, qy); ctx.arc(qx, qy, 1.1, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  let caja = null, lienzo = null, ctx = null;
  let W = 0, H = 0, parts = [], ambiente = [], vivo = true, emblema = null, forma = 'RATACODE', ultimoCuadro = 0;
  let tiempo = 0, cargaEmblema = 0, ultimoUso = -1e9, ultimaOla = 0, fotograma = 0;
  const partesDelDia = [];   // la lista de trabajo, reutilizada vuelta tras vuelta (c)
  const raton = { x: -9999, y: -9999, px: -9999, py: -9999, activo: false, vel: 0 };
  const paralaje = { x: 0, y: 0 };   // cuánto se desplazan las capas según dónde esté el ratón
  /* R33: SIN forzar. Antes resembraba a todas las ratas con cualquier cambio de
     tamaño, también de la caja de escribir (que ya no cuenta para el alto): las
     ratas volvían a nacer repartidas y perdían el queso que tenían asignado. */
  const vigia = new ResizeObserver(() => { clearTimeout(vigia._t); vigia._t = setTimeout(() => medir(false), 200); });

  /* ---------- (a) si no se ve, no se trabaja; (b) si se ve a medias, sólo esa parte ----------
     Tres formas de no verse: la pestaña oculta (`document.hidden`), el lienzo sin
     caja o invisible (`checkVisibility`) y el lienzo fuera de la ventana. La
     comprobación cara se hace desde EL UNICO vigilante, cada 500 ms, y no en cada
     vuelta: leer estilos y rectángulos fuerza el cálculo de la página, y eso sí
     que atasca. Parar es cancelar el fotograma Y no volver a pedirlo. */
  let enPantalla = true, recorteVisible = null;
  function puestoEnPantalla() {
    if (!caja || !caja.isConnected || !lienzo || !lienzo.isConnected) return null;
    if (typeof lienzo.checkVisibility === 'function' &&
        !lienzo.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
    const r = lienzo.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? r : null;
  }
  /* R21 · el tema MINIMAL va sin ratitas de fondo: ni se pinta el lienzo (lo
     esconde el CSS) ni se le da una vuelta de reloj (esto). Se mira el
     documento cada vez, así que cambiar de tema en Ajustes para y arranca el
     fotograma sin recargar nada. */
  function conRatitas() { return document.documentElement.dataset.mrRatas !== 'no'; }   // Ajustes › Aspecto › Ratas en pantalla
  function puedeVerse() { return !document.hidden && enPantalla && conRatitas(); }
  function parar() {
    cancelAnimationFrame(fotograma); fotograma = 0; ultimoCuadro = 0;
  }
  /* Un solo vigilante para los tres oficios que antes iban en relojes sueltos
     (250 ms al dormirse, 300 ms dentro del fotograma y 1 500 ms para el remonte,
     más 150 ms de identidad): mirar si el hueco sigue en su sitio y remontarse si
     la casa cambió, leer qué banda se ve, y arrancar o parar el fotograma. Con la
     pestaña oculta no toca el DOM: `document.hidden` no fuerza maquetación. */
  function vigilar() {
    if (!vivo) return;
    if (document.hidden) { enPantalla = false; recorteVisible = null; parar(); return; }
    const tarjetaQueEspera = document.querySelector(ESPERA);
    estadoIA = tarjetaQueEspera ? 'espera' : document.querySelector('[data-streaming]') ? 'hablando' : document.querySelector(PARAR) ? 'pensando' : 'reposo';
    if (tarjetaQueEspera && lienzo) {
      const e = tarjetaQueEspera.getBoundingClientRect(), l = lienzo.getBoundingClientRect();
      esperaEn.pregunta = tarjetaQueEspera.hasAttribute('data-question-key');
      // A la pregunta se la mira en el centro, donde gira el «?»; a lo demás, en su tarjeta.
      esperaEn.x = esperaEn.pregunta ? W / 2 : e.left + e.width / 2 - l.left;
      esperaEn.y = esperaEn.pregunta ? H * 0.42 : e.top + e.height / 2 - l.top;
    }
    document.documentElement.dataset.mrEstado = estadoIA;
    const destino = document.querySelector('[class*="_scrollBody"]')?.parentElement;
    if (caja !== destino || (destino && !lienzo?.isConnected)) montar();
    const r = puestoEnPantalla();
    if (!r) { enPantalla = false; recorteVisible = null; parar(); return; }
    enPantalla = true;
    /* La banda que de verdad se ve, en coordenadas del lienzo. Si se ve entero,
       no hay recorte que valga: ni una cuenta de más. */
    const arriba = Math.max(r.top, 0), abajo = Math.min(r.bottom, window.innerHeight);
    const izquierda = Math.max(r.left, 0), derecha = Math.min(r.right, window.innerWidth);
    const completo = arriba <= r.top + 0.5 && abajo >= r.bottom - 0.5 &&
                     izquierda <= r.left + 0.5 && derecha >= r.right - 0.5;
    recorteVisible = completo ? null : { x: izquierda - r.left, y: arriba - r.top, w: Math.max(0, derecha - izquierda), h: Math.max(0, abajo - arriba) };
    if (!W || !H) medir(true);
    programar();
  }

  function sacarEmblema() {
    const carga = ++cargaEmblema;
    const valor = getComputedStyle(document.documentElement).getPropertyValue('--mr-emblema') || '';
    // La identidad usa SVG percent-encoded, no necesariamente base64.
    const m = valor.trim().match(/^url\(["']?(data:image\/svg\+xml[^"')]+)["']?\)$/);
    if (!m) return;
    const img = new Image();
    img.onload = () => { if (vivo && carga === cargaEmblema) { emblema = img; medir(true); } };
    img.onerror = () => { if (vivo && carga === cargaEmblema) { emblema = null; medir(true); } };
    img.src = m[1];
  }

  /* ---------- medir el hueco y sembrar las chispas ---------- */
  function medir(forzar) {
    if (!vivo || !caja || !lienzo || !caja.isConnected) return;
    const r = caja.getBoundingClientRect();
    /* R33: el lienzo ocupa TODO el alto. Antes acababa donde empieza el asiento
       de la caja de escribir, y en la bienvenida ese asiento incluye el logo: la
       nube se cortaba en seco por encima. La caja es opaca y va por delante, así
       que las ratas que pasan por detrás no se ven dentro de ella. */
    const alto = r.height;
    if (!r.width || alto < 24) { W = H = 0; return; }
    if (!forzar && Math.abs(r.width - W) < 2 && Math.abs(alto - H) < 2 && parts.length) return;
    const dpr = 1;                             // dpr 1: el 44 % de los píxeles que a 1,5 (1/1,5²); el navegador ya escala el CSS
    W = r.width; H = alto;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    lienzo.style.width = W + 'px'; lienzo.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ambiente = [];

    parts = [];
    quesos = [];                               // ratas nuevas: los quesos de las de antes ya no son de nadie
    /* 1 · la nube con forma del emblema: se dibuja a escondidas y se mira qué píxel está lleno */
    {
      const lado = Math.min(H * 0.62, W * 0.6, 560);
      const tmp = document.createElement('canvas');
      tmp.width = Math.round(W); tmp.height = Math.round(H);
      const tc = tmp.getContext('2d');
      if (emblema) {
        forma = 'logo';
        tc.drawImage(emblema, (W - lado) / 2, H * 0.42 - lado / 2, lado, lado);
      } else {
        forma = 'RATACODE';
        const marca = document.querySelector('.mr-dsh-word');
        const familia = marca ? getComputedStyle(marca).fontFamily : '"Segoe UI", sans-serif';
        tc.font = `italic 900 100px ${familia}`;
        const tam = Math.min(H * 0.48, W * 0.9 / tc.measureText('RATACODE').width * 100);
        tc.font = `italic 900 ${tam}px ${familia}`;
        tc.textAlign = 'center'; tc.textBaseline = 'middle'; tc.fillStyle = '#ffffff';
        tc.fillText('RATACODE', W / 2, H * 0.42);
      }
      const datos = tc.getImageData(0, 0, tmp.width, tmp.height).data;
      // Sólo trazos luminosos: la cara negra del SVG no se convierte en una mancha.
      const trazo = k => datos[k + 3] > 128 && Math.max(datos[k], datos[k + 1], datos[k + 2]) > 105;
      let llenos = 0;
      for (let i = 0; i < datos.length; i += 16) if (trazo(i)) llenos++;
      const objetivo = tactil ? 240 : 360;      // R33: menos ratas y más grandes, que se vea que lo son
      const paso = Math.max(3, Math.ceil(Math.sqrt((llenos * 4) / objetivo)));
      for (let y = 0; y < tmp.height; y += paso) {
        for (let x = 0; x < tmp.width; x += paso) {
          const k = (y * tmp.width + x) * 4;
          if (!trazo(k)) continue;
          // Color propio a la izquierda; el MISMO amarillo de la casa a la derecha.
          const color = x < W / 2 ? 'personal' : 'amarillo';
          const hx = x + (Math.random() - 0.5) * paso * 0.9, hy = y + (Math.random() - 0.5) * paso * 0.9;
          // Nacen repartidas por todo el hueco: su sitio en el emblema (`hx`,`hy`)
          // sólo lo ocupan cuando la IA habla.
          const x0 = 16 + Math.random() * (W - 32), y0 = 16 + Math.random() * (H - 32);
          parts.push({
            hx, hy, x: x0, y: y0, tx: x0, ty: y0, vx: 0, vy: 0, vel: 0, ang: Math.random() * Math.PI * 2,
            hasta: Math.random() * 3000, paso: 1, zanca: 0, k: Math.random(), z: Math.random(), queso: null, gesto: '', ini: 0, fin: 0, otra: null, gx: 0, gy: 0,
            masa: 0.45 + Math.random() * 2.2, roce: 0.86 + Math.random() * 0.1, fase: Math.random() * Math.PI * 2,
            r: 0.7 + Math.random() * 0.8, color, grupo: 0, rumbo: 0
          });
        }
      }
    }
    /* 2 · chispas sueltas, con más presencia en los lados: donde no hay texto, más nítidas */
    if (parts.length > 480) parts = parts.filter((_, i) => i % Math.ceil(parts.length / 480) === 0);
    /* R33 · PROFUNDIDAD. Se ordenan UNA vez del fondo hacia delante: así las de
       delante tapan a las de atrás sin ordenar nada en cada fotograma. */
    parts.sort((a, b) => a.z - b.z);
    const nSueltas = Math.min(40, Math.round((W / 945) * (tactil ? 14 : 20)));
    for (let i = 0; i < nSueltas; i++) {
      const enElLado = Math.random() < 0.7;
      const hx = enElLado
        ? (Math.random() < 0.5 ? Math.random() * W * 0.17 : W * 0.83 + Math.random() * W * 0.17)
        : Math.random() * W;
      const hy = Math.random() * H;
      // Las sueltas van a su aire: merodean siempre, haga lo que haga la IA.
      ambiente.push({
        hx, hy, x: hx, y: hy, tx: hx, ty: hy, vx: 0, vy: 0, vel: 0, ang: Math.random() * Math.PI * 2,
        hasta: Math.random() * 3000, paso: 1, zanca: 0, k: Math.random(), z: 0.75 + Math.random() * 0.25, grupo: -1, masa: 1, rumbo: 0,
        fase: Math.random() * Math.PI * 2,
        r: 0.7 + Math.random() * 1.1, alfa: 0.3 + Math.random() * 0.35,
        color: Math.random() < 0.5 ? 'personal' : 'amarillo',
        roce: 0.9 + Math.random() * 0.06
      });
    }
  }

  /* ---------- el empujón: el ratón abre un círculo que las aparta ---------- */
  function empujar(p, mx, my, alcance, fuerza) {
    const ddx = p.x - mx, ddy = p.y - my, d2 = ddx * ddx + ddy * ddy;
    if (d2 >= alcance * alcance) return;
    const d = Math.sqrt(d2) || 1, f = 1 - d / alcance;
    const golpe = ((f * f * fuerza) / p.masa) * (0.35 + Math.random() * 1.5);
    const ang = Math.atan2(ddy, ddx) + (Math.random() - 0.5) * 1.6;
    p.vx += Math.cos(ang) * golpe; p.vy += Math.sin(ang) * golpe;
  }
  /* Teclear también revuelve la nube: un empujón suave desde un punto al azar,
     como mucho uno cada 120 ms. Cuesta una pasada por tecla, no un cálculo en
     cada fotograma, y es lo que hace que se NOTE que alguien escribe. */
  function revolver(t) {
    if (!W || !parts.length || t - ultimaOla < 120) return;
    ultimaOla = t;
    const mx = W * (0.3 + Math.random() * 0.4), my = H * (0.3 + Math.random() * 0.4);
    for (const p of parts) empujar(p, mx, my, 190, 12);
    for (const p of ambiente) empujar(p, mx, my, 190, 3);
  }

  // Un solo dueño del próximo cuadro. Programarlo también en pasoDentro
  // duplicaba la cola en cada vuelta hasta congelar toda la conversación.
  function programar() {
    if (!vivo || fotograma) return;
    if (!puedeVerse()) { parar(); return; }   // (a): sin verlo, ni una vuelta de reloj
    fotograma = requestAnimationFrame(paso);
  }
  function paso(t) {
    fotograma = 0;
    if (!vivo) return;
    if (!puedeVerse()) { parar(); return; }
    // Física como la referencia a 60 Hz; no acelerar en monitores de 144/240 Hz.
    // (d) Con uso (ratón moviéndose dentro o tecla pulsada) se va a 60 y durante
    // los 3 s siguientes; sin uso, a 15. El ratón QUIETO dentro ya no sube el
    // reloj: no hay nada que seguir.
    const enUso = t - ultimoUso < USO || estadoIA !== 'reposo' || quesos.length > 0 || rebotes.length > 0;
    if (t - ultimoCuadro < (enUso ? CUADRO : CUADRO_EN_REPOSO)) { programar(); return; }
    const delta = Math.min(ultimoCuadro ? t - ultimoCuadro : CUADRO, PASO_MAX) * VELOCIDAD;
    ultimoCuadro = t;
    tiempo += delta;
    // El empujón del ratón sólo con uso DE VERDAD (no porque la IA trabaje), y
    // nunca con el queso del botón derecho: el cursor se queda encima tras el clic y las espantaría.
    try { pasoDentro(tiempo, delta / (1000 / 60), t - ultimoUso < USO && !quesos.some(q => q.todas)); }
    catch (e) { window.__mrVidaFallo = String(e && e.stack || e).slice(0, 400); }
    programar();
  }
  function pasoDentro(t, dt, enUso) {
    if (!lienzo || !lienzo.isConnected) montar();
    if (!ctx || !W) { return; }

    const vel = Math.hypot(raton.x - raton.px, raton.y - raton.py);
    raton.px = raton.x; raton.py = raton.y;
    raton.vel += (Math.min(vel, 40) - raton.vel) * (1 - Math.pow(0.85, dt));
    const pulso = (0.5 + 0.5 * Math.sin(t / 620)) * (0.7 + 0.3 * Math.sin(t / 1730 + 1.3));
    const ALCANCE = Math.min(250, 80 + 140 * pulso + raton.vel * 1.2);
    const mx = raton.x, my = raton.y;

    ctx.clearRect(0, 0, W, H);

    /* (b) sólo se dibuja lo que está en la vista. La física la sigue haciendo
       todo el mundo —una chispa de fuera tiene que estar en su sitio al
       volver—, pero el pincel no gasta en lo que nadie mira. */
    const vx0 = (recorteVisible ? recorteVisible.x : 0) - 34;
    const vy0 = (recorteVisible ? recorteVisible.y : 0) - 34;
    const vx1 = (recorteVisible ? recorteVisible.x + recorteVisible.w : W) + 34;
    const vy1 = (recorteVisible ? recorteVisible.y + recorteVisible.h : H) + 34;

    /* (c) la lista de trabajo se reutiliza: antes se hacía `parts.concat(ambiente)`
       en cada vuelta, o sea un array nuevo de 1.200 huecos sesenta veces por
       segundo. Eso no se ve, pero se paga en basura y en paradas del recolector,
       y el recolector es el mismo que atiende al chat. */
    partesDelDia.length = 0;
    for (let i = 0; i < parts.length; i++) partesDelDia[i] = parts[i];
    for (let i = parts.length, j = 0; j < ambiente.length; i++, j++) partesDelDia[i] = ambiente[j];
    const todos = partesDelDia;
    // Sin comparar cada chispa con todas las demás: coste lineal y acotado.
    // El empujón sólo corre en los cuadros de uso: a 15 imágenes el golpe valdría
    // por cuatro (lleva el `dt` dentro) y la nube temblaría bajo un ratón quieto.
    const empuja = raton.activo && enUso;
    const cx = W / 2, cy = H * 0.42;
    // La IA se pone a trabajar: el queso del botón derecho desaparece (se acabó el recreo).
    if (estadoIA !== 'reposo') for (const q of quesos) if (q.todas) q.resto = 0;
    if (t > proximoQueso) mirarEventos(t);
    // El queso malo (un fallo) tiembla cada vez más y se va apagando.
    for (const q of quesos) if (q.resto > 0) pintarQueso(q.x + (q.malo ? Math.sin(t / 22) * 2.5 * (1 - q.resto) : 0), q.y, radioDe(q), q.malo ? 0.35 + 0.65 * q.resto : 1, q.colores[0], q.colores[1]);
    if (estadoIA === 'espera' && esperaEn.pregunta) {   // el «?» de alambre, girando sobre sí mismo
      ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.cos(t / 700), 1);
      ctx.font = '800 ' + Math.round(Math.min(W, H) * 0.3) + 'px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 1.6; ctx.strokeStyle = ctx.shadowColor = TINTAS.amarillo; ctx.shadowBlur = 10; ctx.globalAlpha = 0.9;
      ctx.strokeText('?', 0, 0); ctx.restore();
    }
    // Terminó: al volver a reposo, una ola rápida desde el centro.
    if (previo !== 'reposo' && estadoIA === 'reposo') ola = { x: cx, y: cy, t0: t, v: 1.1 };
    previo = estadoIA;
    // Hablando: un quesito por línea nueva; caen, rebotan en el suelo y en las paredes, y a los 4,5 s se apagan.
    if (estadoIA !== 'hablando') altoTexto = 0;
    else if (t > proximaMedida) medirTexto(t);
    for (const b of rebotes) {
      b.vy += 0.28 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > suelo) {
        b.y = suelo; b.vy *= -0.68; b.vx *= 0.92;
        if (Math.abs(b.vy) > 1.2) for (const p of todos) empujar(p, b.x, b.y, 60, 4);
      }
      if (b.x < 12 || b.x > W - 12) { b.vx *= -1; b.x = entre(b.x, 12, W - 12); }
      pintarQueso(b.x, b.y, 8, Math.min(1, (1 - (t - b.t0) / 4500) * 4), b.colores[0], b.colores[1]);
    }
    if (rebotes.length && t - rebotes[0].t0 >= 4500) rebotes = rebotes.filter(b => t - b.t0 < 4500);
    /* Paralaje: las capas de delante se van hacia el ratón y las de atrás al
       revés (hasta ±14 px en los extremos). Se acerca poco a poco a su sitio,
       y vuelve a cero cuando el ratón sale. */
    const haciaX = raton.activo ? (mx - cx) / W * 56 : 0, haciaY = raton.activo ? (my - H / 2) / H * 56 : 0;
    paralaje.x += (haciaX - paralaje.x) * Math.min(1, 0.08 * dt); paralaje.y += (haciaY - paralaje.y) * Math.min(1, 0.08 * dt);
    if (ola && (t - ola.t0) * ola.v > Math.hypot(W, H)) { ola = null; proximaOla = t + 15000 + Math.random() * 15000; }
    if (!ola && !quesos.length && estadoIA === 'reposo' && t > proximaOla) ola = { x: cx + (Math.random() - 0.5) * W * 0.5, y: cy, t0: t, v: 0.35 };
    for (const p of todos) {
      if (empuja) empujar(p, mx, my, ALCANCE, (p.grupo < 0 ? 2.2 : 30) * dt);
      /* A dónde va esta rata y con cuánta prisa, según lo que haga la IA. */
      const modo = p.grupo < 0 ? 'reposo' : estadoIA;
      let tx, ty, prisa, merodea = false;
      if (p.queso && p.queso.resto <= 0) p.queso = null;
      const q = p.queso;
      if (p.gesto && (modo !== 'reposo' || q || t >= p.fin)) p.gesto = '';
      const g = p.gesto || '';
      if (q) {                                      // tiene queso asignado: a su borde, corriendo
        const rq = radioDe(q) * (q.malo ? 2.8 + p.k : 0.9 + p.k * 1.5);   // al malo no se arriman
        tx = q.x + Math.cos(p.fase) * rq; ty = q.y + Math.sin(p.fase) * rq; prisa = 6; p.hasta = 0;
      } else if (modo === 'hablando') {
        tx = p.hx; ty = p.hy; prisa = 4.5; p.hasta = 0;   // a su sitio, y ahí se cuadra
      } else if (p.grupo < 0) { merodea = true; tx = p.tx; ty = p.ty; prisa = p.paso; }
      else if (g === 'pelea') {                     // dan vueltas una contra otra
        const o = p.otra;
        tx = (p.hx + o.hx) / 2 + Math.cos(t / 70 + p.fase) * 9; ty = (p.hy + o.hy) / 2 + Math.sin(t / 70 + p.fase) * 9; prisa = 3;
      } else if (g === 'caza') { tx = p.otra.x; ty = p.otra.y; prisa = 3.1; }
      else if (g === 'huye') { tx = p.hx + Math.cos(t / 220 + p.fase) * 34; ty = p.hy + Math.sin(t / 220 + p.fase) * 34; prisa = 3.4; }
      else if (g === 'paseo') { tx = p.gx; ty = p.gy; prisa = 1.4; }
      else {                                        // su sitio en el emblema (apiñado, si se está compactando)
        const junta = t < apina ? 0.15 : 1;
        tx = cx + (p.hx - cx) * junta + Math.sin(t / 1900 + p.fase) * 1.5; ty = cy + (p.hy - cy) * junta; prisa = 4.5;
      }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const parada = merodea && t < p.hasta;
      const come = q && !q.malo && d < 14;          // ya está en el corro
      const mira = (modo === 'espera' && d < 3) || (q && q.malo && d < 12);   // quieta y atenta
      const lista = modo === 'hablando' && !q && d < 3;   // cuadrada: mirando hacia fuera, a punto de salir
      const enCasa = modo === 'reposo' && !merodea && !q && g === '' && d < 3;
      if (parada) p.ang += Math.sin(t / 260 + p.fase) * 0.02 * dt;        // olfatea
      else if (come) {                              // roe mirando al queso
        p.ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.sin(t / 45 + p.fase) * 0.25;
        q.roen = true;
      } else if (mira) {                            // se vuelve hacia lo que mira: la tarjeta o el queso malo
        const a = Math.atan2((q ? q.y : esperaEn.y) - p.y, (q ? q.x : esperaEn.x) - p.x) - p.ang;
        p.ang += Math.atan2(Math.sin(a), Math.cos(a)) * Math.min(1, 0.1 * dt);
      } else if (lista) {
        const a = Math.atan2(p.hy - cy, p.hx - cx) - p.ang;
        p.ang += Math.atan2(Math.sin(a), Math.cos(a)) * Math.min(1, 0.12 * dt);
      } else if (g === 'aseo') p.ang += Math.sin(t / 45 + p.fase) * 0.1 * dt;      // sacude la cabeza
      else if (g === 'pie') p.ang += Math.sin(t / 300 + p.fase) * 0.03 * dt;       // mira a los lados
      else if (g === 'gira') p.ang += 0.23 * dt;                                   // dos vueltas tras su cola
      else if (g === 'paseo' && d < 6) p.ang += Math.sin(t / 260 + p.fase) * 0.03 * dt;   // olfatea donde ha llegado
      else if (d > 1.5 && g !== 'duerme' && g !== 'brinco' && g !== 'tiembla') {
        // Gira poco a poco hacia su destino, culebreando: no va en línea recta.
        const g = Math.atan2(dy, dx) - p.ang;
        p.ang += Math.atan2(Math.sin(g), Math.cos(g)) * Math.min(1, 0.16 * dt) + Math.sin(t / 90 + p.fase) * 0.03 * dt;
      }
      if (merodea && !parada && d < 6) { p.hasta = t + 400 + Math.random() * 2600; otroDestino(p); }
      if (enCasa && Math.random() < 0.000125 * dt) nuevoGesto(p, t);   // en su sitio y sin hacer nada: a ver qué le da
      p.vel += ((parada ? 0 : Math.min(prisa, d * 0.12)) - p.vel) * Math.min(1, 0.12 * dt);
      // El susto (ratón o tecla) es un empujón aparte, que se gasta con el roce.
      const roce = Math.pow(p.roce, dt);
      p.vx *= roce; p.vy *= roce;
      const v = Math.hypot(p.vx, p.vy);
      if (v > 70) { p.vx *= 70 / v; p.vy *= 70 / v; }
      if (v > 3) {                                  // asustada: deja de olfatear y huye de hocico
        p.ang = Math.atan2(p.vy, p.vx);
        p.gesto = '';
        if (modo === 'reposo') { p.hasta = 0; p.tx = entre(p.x + p.vx * 14, 16, W - 16); p.ty = entre(p.y + p.vy * 14, 16, H - 16); p.paso = 2.2; }
      }
      p.x += (Math.cos(p.ang) * p.vel + p.vx) * dt; p.y += (Math.sin(p.ang) * p.vel + p.vy) * dt;
      p.zanca += (p.vel + v) * dt;
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      // Asustada o trabajando (la IA piensa o habla) brilla; merodeando, no.
      // Cómo se pinta el gesto: postura, tamaño, temblor y brillo.
      let postura = (p.zanca / 5 | 0) & 1, escala = 1, ox = 0, brilla = 0, alfa = p.alfa === undefined ? 0.5 : p.alfa;
      if (q) brilla = 0.4;                          // las que van a por queso se encienden
      if (g === 'pie' || mira) { postura = 2; escala = 1.15; }
      else if (lista) ox = Math.sin(t / 30 + p.fase) * 0.45;   // el temblor de la que va a arrancar
      else if (g === 'aseo') postura = 3;
      else if (g === 'duerme') { postura = 3; escala = 1 + 0.06 * Math.sin(t / 500 + p.fase); alfa *= 0.7; }
      else if (g === 'brinco') { escala = 1 + 0.6 * Math.abs(Math.sin((t - p.ini) / 127)); brilla = 0.3; }
      else if (g === 'tiembla') ox = Math.sin(t / 16) * 1.3;
      else if (g === 'pelea' || g === 'caza' || g === 'huye') brilla = 0.3;
      if (ola && p.grupo >= 0 && modo === 'reposo') {
        const f = (t - ola.t0) * ola.v - Math.hypot(p.hx - ola.x, p.hy - ola.y);
        if (f > 0 && f < 70) { const s = Math.sin(Math.PI * f / 70); escala += 0.55 * s; brilla = Math.max(brilla, 0.35 * s); }
      }
      const excitada = Math.max(Math.min(1, v / 14), brilla, modo === 'hablando' ? 0.2 : 0);
      // Las del fondo, más pequeñas y apagadas; las de delante, grandes y vivas.
      const fondo = 0.62 + 0.76 * p.z;
      const px = p.x + ox + paralaje.x * (p.z - 0.5), py = p.y + paralaje.y * (p.z - 0.5);
      ctx.globalAlpha = Math.min(1, (alfa + excitada * 0.4) * (0.5 + 0.75 * p.z));
      // El halo sólo se pinta con la rata encendida: en reposo, un dibujo menos por rata.
      if (excitada > 0.04) {
        const tam = (8 + excitada * 9) * fondo;
        ctx.drawImage(BRILLO[p.color], px - tam, py - tam, tam * 2, tam * 2);
      }
      // Corren de hocico, no de lado, y mueven la cola a cada zancada.
      p.rumbo = (Math.round((p.ang + Math.PI / 2) / (Math.PI / 8)) % 16 + 16) % 16;
      const talla = ((p.grupo < 0 ? 15 : 11) + p.r * 1.5 + excitada * 8) * escala * fondo;
      ctx.drawImage(RATITA[p.color][postura][p.rumbo], px - talla / 2, py - talla / 2, talla, talla);
    }
    ctx.globalAlpha = 1;
    /* En cuanto llega la primera a roer, un queso dura 2 s (con la carrera, unos
       3). Al acabarse, su grupo sale en estampida y vuelve cada una a su sitio;
       el del botón derecho, además, cuenta para el marcador. */
    for (const q of quesos) {
      if (q.resto > 0 && (q.roen || q.malo)) q.resto -= dt / (60 * (q.malo ? 1.8 : 2));   // el malo se deshace solo
      if (q.resto > 0 && t - q.t0 > 8000) q.resto = 0;   // seguro: a los 8 s sin acabarse, se retira
      if (q.resto > 0) continue;
      for (const p of todos) if (p.queso === q) empujar(p, q.x, q.y, 140, 9);
      if (q.todas && q.roen) rotulo = { x: q.x, y: q.y, t0: t, n: otroQuesoComido() };
      if (q.roen) cuadernoDeABordo().comidos = (cuadernoDeABordo().comidos || 0) + 1;   // para la puerta de depuración
    }
    if (quesos.some(q => q.resto <= 0)) quesos = quesos.filter(q => q.resto > 0);
    if (!quesos.length && !rotulo) delete document.documentElement.dataset.mrQueso;
    if (rotulo) {                                   // la cuenta: un circulito rosa por queso comido (hasta 12), que suben y se apagan
      const e = (t - rotulo.t0) / 1600;
      if (e >= 1) rotulo = null;
      else {
        const n = Math.min(rotulo.n, 12), fila = Math.min(n, 6);
        ctx.globalAlpha = 1 - e; ctx.strokeStyle = ctx.shadowColor = TINTAS.personal; ctx.lineWidth = 1.2; ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = rotulo.x + ((i % 6) - (fila - 1) / 2) * 9, y = rotulo.y - 10 - e * 26 - (i / 6 | 0) * 9;
          ctx.moveTo(x + 2.6, y); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
    }
    /* (c) el cuaderno de a bordo no se rehace en cada vuelta: se escribe UNA vez
       y luego sólo se refresca lo barato. El desplazamiento medio costaba
       recorrer las mil y pico chispas en cada fotograma para un número que no se
       ve en ninguna parte; ahora se calcula sólo si alguien lo lee (la puerta de
       depuración, que es quien lo mira). */
    const cuaderno = cuadernoDeABordo();
    cuaderno.W = Math.round(W); cuaderno.H = Math.round(H);
    cuaderno.nube = parts.length; cuaderno.sueltas = ambiente.length;
    cuaderno.forma = forma; cuaderno.tiempo = Math.round(t);
    cuaderno.dentro = !!(caja && caja.isConnected); cuaderno.recorte = recorteVisible;
    cuaderno.cuadros++;
  }
  function cuadernoDeABordo() {
    const guardado = window.__mrVida;
    if (guardado && guardado.marca === MARCA) return guardado;
    const cuaderno = {
      W: Math.round(W), H: Math.round(H), nube: parts.length, sueltas: ambiente.length, forma,
      particula: 'ratita-cenital', zona: 'salida', agente: NOMBRE_RATA,
      colores: [TINTAS.personal, TINTAS.amarillo], velocidad: VELOCIDAD, tiempo: 0, cuadros: 0,
      dentro: !!(caja && caja.isConnected), recorte: null
    };
    Object.defineProperty(cuaderno, 'marca', { value: MARCA, enumerable: false });
    Object.defineProperty(cuaderno, 'desplazamiento', {
      enumerable: true, configurable: true,
      get() {
        if (!parts.length) return 0;
        let suma = 0;
        for (const p of parts) suma += Math.hypot(p.x - p.hx, p.y - p.hy);
        return Math.round(suma / parts.length);
      }
    });
    window.__mrVida = cuaderno;
    return cuaderno;
  }

  /* ---------- fondo fijo del panel de salida, separado del editor ---------- */
  function montar() {
    const nueva = document.querySelector('[class*="_scrollBody"]')?.parentElement;
    if (!nueva) {
      if (!montar.aviso) { console.warn('[ratacode] No encuentro el panel de salida: fondo pausado; revisar selectores del panel.'); montar.aviso = true; }
      caja = null; ctx = null; W = H = 0; return;
    }
    montar.aviso = false;
    const viejo = document.getElementById(MARCA);
    if (viejo && viejo !== lienzo) viejo.remove();
    if (caja !== nueva) caja?.classList.remove('mr-vida-salida');
    caja = nueva; caja.classList.add('mr-vida-salida');
    lienzo = document.getElementById(MARCA);
    if (!lienzo || lienzo.parentElement !== caja) {
      lienzo?.remove(); // One canvas: do not leave the previous resident's background behind.
      lienzo = document.createElement('canvas');
      lienzo.id = MARCA; lienzo.className = MARCA;
      lienzo.setAttribute('aria-hidden', 'true');
      caja.prepend(lienzo);
      emblema = null; sacarEmblema();
    }
    ctx = lienzo.getContext('2d');
    ambiente = [];
    medir(true);
    /* si la caja cambia de tamaño (o de forma), se siembra otra vez para que no quede torcido */
    vigia.disconnect();
    vigia.observe(caja);
    const entrada = caja.querySelector('[class*="_composerSeat"]'); if (entrada) vigia.observe(entrada);
    programar();
  }

  addEventListener('resize', () => { clearTimeout(montar._t); montar._t = setTimeout(medir, 200); }, { signal: eventos.signal });
  addEventListener('pointermove', e => {
    if (!caja) return;
    const r = caja.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.left + W || e.clientY < r.top || e.clientY > r.top + H) { raton.activo = false; return; }
    if (!raton.activo) { raton.px = e.clientX - r.left; raton.py = e.clientY - r.top; }
    raton.x = e.clientX - r.left; raton.y = e.clientY - r.top; raton.activo = true;
    ultimoUso = performance.now();                 // (d): el ratón aquí es uso → 60 imágenes por segundo
  }, { passive: true, signal: eventos.signal });
  addEventListener('pointerleave', () => { raton.activo = false; }, { signal: eventos.signal });
  addEventListener('blur', () => { raton.activo = false; }, { signal: eventos.signal });
  addEventListener('keydown', () => {              // escribir: sube el reloj y revuelve la nube
    if (!puedeVerse()) return;
    const t = performance.now(); ultimoUso = t; revolver(t);
  }, { signal: eventos.signal });
  /* El queso: botón derecho en el FONDO VACÍO, y sólo en reposo. Encima de un
     mensaje, de código, de un botón o de la caja de escribir el botón derecho
     sigue siendo el del navegador (copiar, pegar…): ahí no se toca. */
  const NO_ES_FONDO = 'a,button,input,textarea,select,pre,code,img,[contenteditable],[data-composer-card],[data-chat-flow-kind],[role="dialog"],[role="menu"]';
  addEventListener('contextmenu', e => {
    if (!caja || !W || estadoIA !== 'reposo' || !puedeVerse()) return;
    if (!(e.target instanceof Element) || !caja.contains(e.target) || e.target.closest(NO_ES_FONDO)) return;
    if (String(getSelection?.() ?? '') !== '') return;
    const r = caja.getBoundingClientRect();
    e.preventDefault();
    ponerQueso(entre(e.clientX - r.left, 40, W - 40), entre(e.clientY - r.top, 40, H - 40), null);
    ultimoUso = performance.now(); programar();
  }, { signal: eventos.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) parar(); else vigilar();
  }, { signal: eventos.signal });

  window.__mrVidaDispose = () => {
    vivo = false;
    cancelAnimationFrame(fotograma); fotograma = 0;
    clearTimeout(montar._t); clearTimeout(vigia._t); clearInterval(vigilante);
    eventos.abort(); vigia.disconnect();
    lienzo?.remove(); caja?.classList.remove('mr-vida-salida'); caja = lienzo = ctx = null;
    parts = []; ambiente = [];
  };

  montar();
  vigilar();
  /* la casa se repinta sola: si la caja vuelve a montarse, el lienzo vuelve con
     ella. Es EL UNICO reloj que queda (antes había tres). */
  const VIGÍA_MS = 500;
  const vigilante = setInterval(vigilar, VIGÍA_MS);
})();
