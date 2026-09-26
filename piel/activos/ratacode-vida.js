/* ============================================================
   RATACODE · «vida» (13-sep-2026 · chispa liviana)
   La nube de chispas, traída de la web de Push & Lift
   (`WEB_PL\publica\js\vida.js`, de su autor — gracias).
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
  const CUADRO = 1000 / 61, CUADRO_EN_REPOSO = 1000 / 17, USO = 3000, PASO_MAX = 1000 / 12;

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
  function ratita(color, giro) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.translate(32, 32); g.rotate(giro);
    g.fillStyle = g.strokeStyle = color; g.lineCap = 'round';
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, 11); g.bezierCurveTo(-9, 19, 13, 19, 4, 28); g.stroke();
    g.beginPath(); g.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-6, -7); g.quadraticCurveTo(-5, -15, 0, -23);
    g.quadraticCurveTo(5, -15, 6, -7); g.closePath(); g.fill();
    g.beginPath(); g.arc(-6, -9, 3.6, 0, Math.PI * 2); g.arc(6, -9, 3.6, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-6, -1); g.lineTo(-10, 2); g.moveTo(6, -1); g.lineTo(10, 2);
    g.moveTo(-6, 9); g.lineTo(-10, 12); g.moveTo(6, 9); g.lineTo(10, 12); g.stroke();
    return c;
  }
  /* Una sola rata, así que los sellos se hacen una vez al arrancar y ya está.
     Antes había un `Map` con hasta 4 juegos (uno por personaje de la casa) y un
     chequeo de identidad cada 150 ms que leía `localStorage` y la lista de la casa. */
  const BRILLO = {}, RATITA = {};
  for (const [tinte, hex] of Object.entries(TINTAS)) {
    BRILLO[tinte] = brillo([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(','));
    RATITA[tinte] = Array.from({ length: 16 }, (_, i) => ratita(hex, i * Math.PI / 8));
  }

  let caja = null, lienzo = null, ctx = null;
  let W = 0, H = 0, parts = [], ambiente = [], vivo = true, emblema = null, forma = 'RATACODE', ultimoCuadro = 0;
  let tiempo = 0, cargaEmblema = 0, ultimoUso = -1e9, ultimaOla = 0, fotograma = 0;
  const partesDelDia = [];   // la lista de trabajo, reutilizada vuelta tras vuelta (c)
  const raton = { x: -9999, y: -9999, px: -9999, py: -9999, activo: false, vel: 0 };
  const vigia = new ResizeObserver(() => { clearTimeout(vigia._t); vigia._t = setTimeout(() => medir(true), 200); });

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
  function puedeVerse() { return !document.hidden && enPantalla; }
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
    const asiento = caja.querySelector('[class*="_composerSeat"]') || document.querySelector('[data-composer-card]');
    const entrada = asiento?.getBoundingClientRect();
    const alto = entrada && entrada.top > r.top ? Math.min(r.height, entrada.top - r.top) : r.height;
    if (!r.width || alto < 24) { W = H = 0; return; }
    if (!forzar && Math.abs(r.width - W) < 2 && Math.abs(alto - H) < 2 && parts.length) return;
    const dpr = 1;                             // dpr 1: el 44 % de los píxeles que a 1,5 (1/1,5²); el navegador ya escala el CSS
    W = r.width; H = alto;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    lienzo.style.width = W + 'px'; lienzo.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ambiente = [];

    parts = [];
    /* 1 · la nube con forma del emblema: se dibuja a escondidas y se mira qué píxel está lleno */
    {
      const lado = Math.min(H * 0.90, W * 0.78, 740);
      const tmp = document.createElement('canvas');
      tmp.width = Math.round(W); tmp.height = Math.round(H);
      const tc = tmp.getContext('2d');
      if (emblema) {
        forma = 'logo';
        tc.drawImage(emblema, (W - lado) / 2, (H - lado) / 2, lado, lado);
      } else {
        forma = 'RATACODE';
        const marca = document.querySelector('.mr-dsh-word');
        const familia = marca ? getComputedStyle(marca).fontFamily : '"Segoe UI", sans-serif';
        tc.font = `italic 900 100px ${familia}`;
        const tam = Math.min(H * 0.48, W * 0.9 / tc.measureText('RATACODE').width * 100);
        tc.font = `italic 900 ${tam}px ${familia}`;
        tc.textAlign = 'center'; tc.textBaseline = 'middle'; tc.fillStyle = '#ffffff';
        tc.fillText('RATACODE', W / 2, H / 2);
      }
      const datos = tc.getImageData(0, 0, tmp.width, tmp.height).data;
      // Sólo trazos luminosos: la cara negra del SVG no se convierte en una mancha.
      const trazo = k => datos[k + 3] > 128 && Math.max(datos[k], datos[k + 1], datos[k + 2]) > 105;
      let llenos = 0;
      for (let i = 0; i < datos.length; i += 16) if (trazo(i)) llenos++;
      const objetivo = tactil ? 500 : 700;
      const paso = Math.max(3, Math.ceil(Math.sqrt((llenos * 4) / objetivo)));
      for (let y = 0; y < tmp.height; y += paso) {
        for (let x = 0; x < tmp.width; x += paso) {
          const k = (y * tmp.width + x) * 4;
          if (!trazo(k)) continue;
          // Color propio a la izquierda; el MISMO amarillo de la casa a la derecha.
          const color = x < W / 2 ? 'personal' : 'amarillo';
          const hx = x + (Math.random() - 0.5) * paso * 0.9, hy = y + (Math.random() - 0.5) * paso * 0.9;
          parts.push({
            hx, hy, x: hx + (Math.random() - 0.5) * W * 0.5, y: hy + (Math.random() - 0.5) * H * 0.9, vx: 0, vy: 0,
            masa: 0.45 + Math.random() * 2.2, muelle: 0.006 + Math.random() * 0.034,
            roce: 0.86 + Math.random() * 0.1, fase: Math.random() * Math.PI * 2,
            amp: 0.6 + Math.random() * 1.8, r: 0.7 + Math.random() * 0.8, color, grupo: 0, rumbo: Math.floor(Math.random() * 16)
          });
        }
      }
    }
    /* 2 · chispas sueltas, con más presencia en los lados: donde no hay texto, más nítidas */
    if (parts.length > 900) parts = parts.filter((_, i) => i % Math.ceil(parts.length / 900) === 0);
    const nSueltas = Math.min(40, Math.round((W / 945) * (tactil ? 14 : 20)));
    for (let i = 0; i < nSueltas; i++) {
      const enElLado = Math.random() < 0.7;
      const hx = enElLado
        ? (Math.random() < 0.5 ? Math.random() * W * 0.17 : W * 0.83 + Math.random() * W * 0.17)
        : Math.random() * W;
      const hy = Math.random() * H;
      ambiente.push({
        hx, hy, x: hx, y: hy, vx: 0, vy: 0, grupo: -1, masa: 1, rumbo: Math.floor(Math.random() * 16),
        fase: Math.random() * Math.PI * 2, amp: 3 + Math.random() * 10,
        r: 0.7 + Math.random() * 1.1, alfa: 0.3 + Math.random() * 0.35,
        color: Math.random() < 0.5 ? 'personal' : 'amarillo',
        muelle: 0.01 + Math.random() * 0.02, roce: 0.9 + Math.random() * 0.06
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
    const enUso = t - ultimoUso < USO;
    if (t - ultimoCuadro < (enUso ? CUADRO : CUADRO_EN_REPOSO)) { programar(); return; }
    const delta = Math.min(ultimoCuadro ? t - ultimoCuadro : CUADRO, PASO_MAX) * VELOCIDAD;
    ultimoCuadro = t;
    tiempo += delta;
    try { pasoDentro(tiempo, delta / (1000 / 60), enUso); }
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
    for (const p of todos) {
      if (empuja) empujar(p, mx, my, ALCANCE, (p.grupo < 0 ? 2.2 : 30) * dt);
      const casaX = p.hx + Math.sin(t / 1100 + p.fase) * p.amp;
      const casaY = p.hy + Math.cos(t / 1300 + p.fase) * p.amp;
      p.vx += (casaX - p.x) * p.muelle * dt; p.vy += (casaY - p.y) * p.muelle * dt;
      const roce = Math.pow(p.roce, dt);
      p.vx *= roce; p.vy *= roce;
      const v = Math.hypot(p.vx, p.vy);
      if (v > 70) { p.vx *= 70 / v; p.vy *= 70 / v; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      const excitada = Math.min(1, v / 14);
      ctx.globalAlpha = (p.alfa === undefined ? 0.5 : p.alfa) + excitada * 0.4;
      // El halo sólo se pinta con la chispa revuelta: en reposo, un dibujo menos por chispa.
      if (excitada > 0.04) {
        const tam = 8 + excitada * 9;
        ctx.drawImage(BRILLO[p.color], p.x - tam, p.y - tam, tam * 2, tam * 2);
      }
      // Corren de hocico, no de lado; al descansar conservan su orientación.
      if (v > 0.8) p.rumbo = (Math.round((Math.atan2(p.vy, p.vx) + Math.PI / 2) / (Math.PI / 8)) + 16) % 16;
      const talla = (p.grupo < 0 ? 11 : 7) + p.r * 1.3 + excitada * 10;
      ctx.drawImage(RATITA[p.color][p.rumbo], p.x - talla / 2, p.y - talla / 2, talla, talla);
    }
    ctx.globalAlpha = 1;
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
      if (!montar.aviso) { console.warn('[ratacode] No encuentro el panel de salida: fondo pausado; revisar selectores DSH.'); montar.aviso = true; }
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
