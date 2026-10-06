# CONTRATO DEL ECOSISTEMA · encargo para el agente de RATABROWSER

> Pega este texto entero como primer mensaje al agente que trabaja en RATABROWSER.
> El acento de RATABROWSER es el **VERDE MENTA**. Todo lo demás (fondos, letra,
> formas, movimiento y manera de trabajar) es el de la casa, el mismo de RATACODE
> y RATACLAW. La fuente de verdad es `piel/activos/ratacode-identidad.css` y
> `piel/activos/ratacode-piel.css` del repo `kittcat-lab/ratacode`.

---

## El encargo

Eres el agente de **RATABROWSER**, el navegador de la familia RATA (RATACODE,
RATACLAW, RATABROWSER). Tu trabajo es que RATABROWSER **parezca de la misma casa**
nada más abrirlo y que se distinga solo por su color: el **verde menta**. No
rehagas lo que ya funciona. Cambia la cara, no las tripas.

Antes de tocar nada:

1. Lee el código que hay y apunta en una lista **qué pinta cada cosa**: dónde se
   definen los colores, la letra, los botones, las tarjetas, el foco y el icono.
2. Busca colores escritos a mano (`#…`, `rgb(…)`) fuera del bloque de tokens.
   Todos tienen que acabar llamando a un token.
3. Si hay algo que no entiendes, lo dices. No lo adivines.

## 1) Los tokens: copia estos, no inventes otros

La base es la de la casa. Mismos nombres (`--mr-*`) para que una hoja sirva en
los tres productos.

```css
:root{
 /* Base común: los negros con un toque violeta, los textos y las líneas (no se tocan) */
 --mr-black:#0c0a12; --mr-panel:#15121d; --mr-raised:#1d1a27; --mr-line:#322d42;
 --mr-white:#f0eee6; --mr-muted:#a8adae; --mr-cyan:#26c6cc;
 --bg-0:var(--mr-black); --bg-1:var(--mr-panel); --bg-2:#1a1724; --bg-3:#262233;
 --border:var(--mr-line); --border-soft:#221f2d;
 --text-1:var(--mr-white); --text-2:var(--mr-muted); --text-3:#8c9396;

 /* Identidad de RATABROWSER: verde menta */
 --mr-menta:#3df5b4;          /* menta viva: el color de marca */
 --mr-menta-clara:#a6ffd9;    /* menta pálida: la segunda voz */

 /* Las tres palabras de la casa, en menta */
 --mr-principal:var(--mr-menta);        /* botones, marca, lo que pide el dedo */
 --mr-detalle:var(--mr-menta-clara);    /* filos, realces, estados */
 --mr-acento:var(--mr-menta);           /* foco y enlaces */
 --mr-principal-suave:#123a2d;          /* fondo de seleccionado/activo */
 --mr-sombra:var(--mr-menta); --mr-filo:var(--mr-menta-clara);

 /* Cristal nocturno: la aurora violeta es el pegamento del ecosistema (no se cambia) */
 --mr-aurora:#8b5cff;
 --mr-sobre:#06140f;          /* tinta OSCURA encima de la menta (el blanco no se lee) */
 --mr-degradado:linear-gradient(120deg,var(--mr-principal),var(--mr-aurora));

 --mr-letra:'Segoe UI Variable Display','Segoe UI Variable Text','Segoe UI',system-ui,sans-serif;
 --mr-mono:'Cascadia Code','Cascadia Mono',Consolas,monospace;
 color-scheme:dark;
}
```

Reglas de color:

- **El rosa `#ff268e` y el amarillo `#e4f226` son de RATACODE.** En RATABROWSER
  no aparecen como color de marca. Si los ves en el código, cámbialos por la menta.
- **Texto sobre menta, siempre `--mr-sobre` (oscuro).** Nunca blanco sobre menta.
- La menta es para **lo que se pulsa y lo que importa**: botón principal, pestaña
  activa, foco, marca. No pintes fondos grandes de menta. Los fondos son los negros.
- Seleccionado o activo: `--mr-principal-suave` de fondo y un filo menta. No uses
  menta sólida.
- Enlaces y foco: `--mr-acento`. El cian `--mr-cyan` se queda solo como detalle de
  información, igual que en RATACODE.

## 2) Letra, formas y cristal

- Letra: `--mr-letra` en todo, `--mr-mono` en `code, pre, kbd, samp` y en la barra
  de direcciones si muestra URL cruda.
- Wordmark: `RATA` + `BROWSER`, peso 800, `letter-spacing:-.7px` (en grande
  `-1.2px`), `RATA` en `--mr-principal` y `BROWSER` en `--mr-detalle` y peso 900.
  Es la misma regla que `.mr-dsh-word` en RATACODE.
- Radios: pastillas `999px` para el botón principal y los chips; `10px` para filas y
  pestañas; `12px` para tarjetas; `14px`–`16px` para avisos; `22px` para la caja
  grande de entrada (la barra de direcciones/búsqueda hace de «composer»).
- Bordes: `1px solid #ffffff1a` sobre cristal, o `--mr-line` sobre panel.
- Botón principal: `background:var(--mr-degradado)`, `color:var(--mr-sobre)`,
  `border-radius:999px`, `box-shadow:0 8px 24px -10px var(--mr-principal), inset 0 1px 0 #ffffff40`.
  Al pasar por encima sube `1px` y gana un halo `0 0 0 4px` de menta al 14 %.
- Caja de entrada con foco: borde menta al 55 % y halo de 4px al 11 %, como
  `[data-composer-card]:focus-within` en `ratacode-piel.css`.
- Foco de teclado en todo lo pulsable:
  `outline:1.5px solid color-mix(in srgb,var(--mr-principal) 70%,transparent); outline-offset:2px`.
- Casillas, radios y deslizadores: `accent-color:var(--mr-principal)`.
- Barra de scroll: pulgar `#453f58`, radio `5px`.
- Selección de texto: `background:var(--mr-principal-suave); color:#fffaf1`.

## 3) La aurora y la vida

- La **aurora** es una capa `body::after` fija, `pointer-events:none`,
  `mix-blend-mode:screen`, opacidad `.55`, con tres manchas radiales (principal
  42 %, aurora 40 %, detalle 12 %). Se mueve con `@keyframes mr-aurora` en 22 s.
  Cópiala tal cual de `ratacode-identidad.css`. Con la menta queda un degradado
  menta y violeta.
- **Las ratitas de fondo**, si RATABROWSER las lleva, se pintan en menta y menta
  pálida y se pueden apagar en Ajustes (`<html data-mr-ratas="no">`).
- Si el usuario pide menos movimiento (`prefers-reduced-motion: reduce`), se apaga
  toda animación y transición. Eso no es opcional.
- Transiciones cortas: `transform .12s`, `background-color/border-color .15s`,
  `box-shadow .2s`. Nada de rebotes.

## 4) El emblema

- La misma rata geométrica de `piel/activos/ratacode-emblema.svg` (cabeza
  partida en dos mitades, orejas, ojos `#f0eee6`, nariz cian, bigotes grises,
  arcos alrededor). **No dibujes otra rata.**
- Cambia solo el color de los trazos: la mitad izquierda y su arco en
  `#3df5b4`, y la mitad derecha, su arco y las orejas en `#a6ffd9`. El relleno
  oscuro `#151619`, los ojos, la nariz y los bigotes no cambian.
- Haz el icono de la app (192 y 512 px) y el favicon con ese emblema sobre `#101113`
  con esquinas redondeadas, y pon `theme-color` a `#101113`.

## 5) Temas (si RATABROWSER tiene selector de aspecto)

Los mismos tres que RATACODE, en menta:

| Tema | principal | detalle | acento | aurora |
|---|---|---|---|---|
| **RATABROWSER MENTA** (por defecto) | `#3df5b4` | `#a6ffd9` | `#3df5b4` | `#8b5cff`, visible |
| **MENTA SOBRE GRIS** | `#3df5b4` | `#3df5b4` | `#3df5b4` | apagada; negros grises `#0d0d0e/#151516/#1d1d1f/#323234` |
| **MINIMAL** | `#e8e6df` | `#8c9396` | `#b8bdbb` | apagada, y sin ratitas |

El tema activo se marca en `<html data-ratabrowser-tema="…">` y solo cambia las
tres palabras (`--mr-principal`, `--mr-detalle`, `--mr-acento`) y la aurora.
Nada más.

## 6) Lo que NO se hace

- No cambies cómo funciona el navegador: navegación, pestañas, permisos y
  almacenamiento se quedan como están. Esto es una capa de piel.
- No metas librerías nuevas ni fuentes descargadas para esto. La letra es la del
  sistema.
- No dejes colores sueltos fuera de los tokens.
- No pongas el rosa ni el amarillo de RATACODE como marca.
- No pongas blanco sobre menta.
- No pongas nombres de personas ni de empresas ajenas en lo que ve el usuario.

## 7) Cómo se trabaja y cómo se entrega

- **Por rondas pequeñas.** Cada commit hace una sola cosa y se titula como en
  RATACODE: `RNN · lo que cambia, dicho en llano` (por ejemplo
  `R01 · los tokens de la casa, en menta`). En español.
- Orden recomendado:
  **R01** tokens → **R02** letra y wordmark → **R03** botones, foco y
  entrada → **R04** pestañas, filas y tarjetas → **R05** aurora y movimiento
  reducido → **R06** emblema e iconos → **R07** temas (si los hay).
- Después de cada ronda, **mira la pantalla de verdad**: haz una captura de la
  ventana principal, de una pestaña activa, del foco con teclado y de un aviso.
  Si no puedes verla, dilo.
- Pasa las pruebas que ya existan después de cada ronda. Si alguna falla, para y
  lo cuentas con la salida literal.
- **Informe final** (en un `.md`, con el estilo de `entregas-ratas/`):
  1. Qué cambiaste, por ronda, con el commit.
  2. **Visto con mis ojos**: lo que comprobaste en pantalla o con pruebas.
  3. **SOSPECHAS**: lo que no pudiste comprobar, marcado así, sin disfrazarlo.
  4. Colores escritos a mano que quedaron (debería ser ninguno) y por qué.
  5. Contraste: menta sobre `--mr-black` y `--mr-sobre` sobre menta, con el
     cálculo WCAG. Los dos deben pasar AA.

Hecho = RATABROWSER puesto al lado de RATACODE parece de la misma familia,
cambia solo el color (menta donde allí es rosa) y el informe dice la verdad
sobre lo que se vio y lo que no.
