# ENCARGO · acabar RATABROWSER y poner los iconos nuevos a toda la familia RATA

> Pega este texto entero como primer mensaje al agente que trabaja en tu PC
> (Windows), con acceso a las carpetas de las apps y a `Descargas`.

---

Trabajas en mi PC con Windows. Tengo una familia de apps: **RATACODE**,
**RATACLAW**, **RATABOAT** y **RATABROWSER**. Hay dos trabajos:

1. **Acabar RATABROWSER** con la línea visual del ecosistema y su color, el verde.
2. **Cambiar el icono de todas las apps** por los nuevos, para que se vean así en
   el escritorio, en la barra de tareas, al anclarlas y en el menú Inicio.

La sesión anterior se quedó sin saldo y no llegó a hacer nada. Empiezas de cero:
no des nada por hecho y comprueba tú mismo lo que hay.

## 0) Lee el contrato del ecosistema

Las reglas de color, letra, formas, aurora y manera de entregar están en
`CONTRATO-ECOSISTEMA.md` del repo `kittcat-lab/ratacode`:

- Si ya está en `main`: https://raw.githubusercontent.com/kittcat-lab/ratacode/main/CONTRATO-ECOSISTEMA.md
- Si no: https://raw.githubusercontent.com/kittcat-lab/ratacode/claude/determined-ramanujan-a536k2/CONTRATO-ECOSISTEMA.md

Léelo entero antes de tocar nada. Manda él. Si este encargo y el contrato
chocan, gana el contrato, salvo en los iconos: ahí gana este encargo.

## 1) Los iconos: dónde están y de quién es cada uno

Están en mi carpeta **Descargas** (`%USERPROFILE%\Downloads`). Son cuatro
imágenes cuadradas (unos 1254×1254 px) con la **misma rata negra** con corona y
bigotes amarillos dentro de un cuadrado redondeado amarillo. Solo cambia el
color del círculo de dentro:

| Círculo | Color (medido) | App |
|---|---|---|
| **verde** | `#00f845` | **RATABROWSER**, y es su color de acento |
| **turquesa** | `#00fbfa` | **RATACLAW** |
| **rosa** | `#fc0384` | **RATACODE** |
| **naranja** | `#fc5b02` | **RATABOAT** |

Para encontrarlos:

1. Lista las imágenes de Descargas de los últimos días (`.png`, `.webp`, `.jpg`),
   de la más nueva a la más vieja.
2. Abre cada candidata y **mide el color** de un píxel del círculo (a un 12 % del
   borde izquierdo, a media altura). Así sabes cuál es cuál. No te fíes del nombre
   del fichero.
3. Si hay más de una candidata por color, o falta alguno, para y pregúntame.
4. **Cópialos, no los muevas.** Los originales se quedan en Descargas.

## 2) Prepara los iconos (una vez, y valen para todas las apps)

Para cada icono:

1. **No lo redibujes ni lo recolorees.** Solo se recorta, se escala y se exporta.
2. **Esquinas transparentes.** Lo de fuera del cuadrado redondeado viene en negro
   o en blanco. Hay que dejarlo transparente (máscara de cuadrado redondeado del
   tamaño de la imagen, con el radio que tiene el dibujo). Si no, en el escritorio
   y en la barra sale un cuadrado con picos.
3. Exporta:
   - **`.ico`** con 16, 20, 24, 32, 40, 48, 64, 96, 128 y 256 px dentro (el de 256
     en PNG). Es lo que usa Windows para el escritorio, la barra y el menú Inicio.
   - **PNG** de 16, 32, 48, 64, 128, 192, 256 y 512 px. Son para las apps web o
     instalables y para los empaquetadores.
4. Usa Python con Pillow (`pip install --user pillow`) o ImageMagick si ya está.
   No instales nada más sin preguntarme.
5. **Mira los tamaños pequeños** (16, 24, 32) con tus ojos y ponlos en el
   informe. La rata tiene que seguir reconociéndose.
6. Guarda el resultado en una carpeta estable dentro de cada app (por ejemplo
   `iconos\` o la carpeta de recursos que ya use la app). **Nunca** apuntes un
   acceso directo a Descargas.

## 3) Acaba RATABROWSER

1. **Inventario primero.** Recorre el proyecto y escribe una lista corta:
   - qué funciona ya;
   - qué está a medias (busca `TODO`, funciones vacías, botones sin acción y
     pantallas sin estilo);
   - dónde se pintan los colores, la letra, los botones, el foco y el icono.

   Enséñame la lista antes de seguir si hay algo grande o dudoso.
2. **Termina lo que está a medias**, sin rehacer lo que funciona.
3. **Ponle la piel del contrato** en rondas pequeñas, en este orden:
   - **R01:** tokens en verde (`--mr-principal:#00f845`, `--mr-detalle:#e4f226`,
     tinta oscura `#06140f` sobre el verde);
   - **R02:** letra y wordmark;
   - **R03:** botones, foco y barra de direcciones;
   - **R04:** pestañas, filas y tarjetas;
   - **R05:** aurora y movimiento reducido;
   - **R06:** el icono verde (punto 4).
4. Ningún color escrito a mano fuera de los tokens. Nada de blanco sobre verde.
5. Después de cada ronda, arráncalo, haz captura y pasa las pruebas que tenga.
   Si algo falla, para y me lo cuentas con la salida literal.

## 4) Pon el icono a cada app

Primero averigua **cómo arranca cada app**, porque de eso depende dónde va el
icono. Para cada una dime qué es: Electron, Tauri, app web instalada (PWA), un
`.exe` o un script con acceso directo.

- **Electron:** el `icon` de `BrowserWindow` (el `.ico`), el `win.icon` del
  empaquetador (electron-builder o forge) y `app.setAppUserModelId(...)`. El ID
  tiene que ser **el mismo** que el del acceso directo. Si no, al anclarla sale
  otro icono o se duplica en la barra.
- **Tauri:** `npx tauri icon <png de 1024 o del más grande>` y comprueba
  `src-tauri/tauri.conf.json`.
- **App web instalada (PWA):** los PNG de 192 y 512 del manifiesto. Edge y Chrome
  **guardan el icono viejo**: hay que desinstalar la app instalada y volver a
  instalarla (y volver a anclarla) para que salga el nuevo.
  - **RATACODE es de este tipo:** sustituye `piel/activos/ratacode-icono-192.png`
    y `piel/activos/ratacode-icono-512.png` (los sirve el manifiesto en
    `/ratacode/manifest.webmanifest`) por el icono rosa. **No toques**
    `piel/activos/ratacode-emblema.svg`, que es la marca dentro del panel, salvo
    que yo lo pida. Pasa `npm test` después.
- **`.exe` o script con acceso directo:** cambia el `IconLocation` de cada `.lnk`
  (PowerShell con `WScript.Shell`) para que apunte al `.ico` estable de su app.

Después revisa **todos los sitios donde vive cada acceso directo**:

- el escritorio (`%USERPROFILE%\Desktop` y `%PUBLIC%\Desktop`);
- el menú Inicio (`%APPDATA%\Microsoft\Windows\Start Menu\Programs`);
- **los anclados de la barra de tareas**
  (`%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar`).

Antes de cambiar cada `.lnk`, apunta su `IconLocation` viejo en el informe para
poder deshacerlo.

Al final, **refresca la caché de iconos**: `ie4uinit.exe -show`. Si aun así sale
el viejo, avísame **antes** de reiniciar el Explorador de Windows.

## 5) Lo que NO se hace

- No borres nada de Descargas ni de las apps.
- No cambies cómo funcionan las apps: solo la cara y el icono, y en RATABROWSER
  lo que esté a medias.
- No toques el registro de Windows ni instales programas sin preguntarme.
- No hagas `push` sin preguntarme. Haz `commit` en cada repo, uno por ronda,
  titulado `RNN · lo que cambia, en llano`.
- No adivines: si algo no lo sabes o no lo puedes ver, lo dices.

## 6) Hecho es esto (y el informe)

**Hecho** quiere decir dos cosas:

- RATABROWSER está acabado y parece de la familia, en verde.
- Cada app enseña su icono nuevo en el escritorio, en la barra de tareas
  (abierta y anclada) y en el menú Inicio, **sin cuadrado con picos** y **sin
  duplicarse** al anclarla.

Entrégame un `.md` con:

1. Qué cambiaste, por app y por ronda, con el commit.
2. **Visto con mis ojos:** capturas del escritorio, la barra (abierta y anclada)
   y el menú Inicio, más los iconos de 16/24/32 px ampliados.
3. **SOSPECHAS:** lo que no pudiste comprobar, marcado así.
4. Tabla de accesos directos: ruta, icono viejo e icono nuevo.
5. Contraste del verde: `#00f845` sobre `#0c0a12` y `#06140f` sobre `#00f845`
   (los dos pasan AA: dan 13,6 y 13,0).
