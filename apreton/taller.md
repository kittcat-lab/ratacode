# El taller: guía para un chat recién nacido

No sabes nada de esta casa y no hace falta: con esta página basta. `<taller>` es la carpeta de
trabajo del taller —la que contiene `COLA\`— y `<R>` es el nombre de la sesión que te toque
(por ejemplo `R34`).

## 1 · Quién es quién

| Quién | Qué es | Qué hace |
|---|---|---|
| **el dueño** | la persona | ordena y decide. No hace de recadero: nadie le pide copiar y pegar entre chats |
| **la Rata** | este modo (MODO-RATA) | ejecuta encargos y **despacha en RCC1**. Es la jefa del taller: si hay duda o decisión, la resuelve ella y se sigue |
| **RCC1** | la sala común, no un agente | donde la Rata despacha: lee la orden, escribe el JOB y contesta el ACK en el mismo turno |
| **AGENTE CLAUDE** | agente independiente | organiza el plan, redacta cada encargo y hace lo que necesite terminal o red |
| **Codex** | agente independiente | comprueba lo que no hizo él y firma `COMPROBADO` |
| **Harvys** | el chat de ChatGPT visto desde el panel: **GPT WEB por MCP** | habla con el dueño desde el móvil y manda órdenes por MCP |

Ojo con este error, que ya costó uno: `HARVYS` y `HARVYS CODEX` **son el mismo chat en dos
interfaces**, no dos agentes. Y cada uno firma con su identidad real: nadie firma por otro.

## 2 · Las tuberías (todo dentro de `<taller>`)

- **COLA** — `<taller>\COLA\`
  - `JOB-<job_id>.json` — un trabajo = un fichero, y **el nombre del fichero ES el id**. El id lo
    genera **quien ordena**, nunca la Rata. Campos: `job_id`, `orden`, `de`, `para`, `estado`,
    `creado`, `worker`, `resultado`, `notas` (los JOBs de verdad llevan además misión, entregable
    y criterio de aceptación).
  - Los **nueve estados**: `no_recibido` · `recibido` · `en_cola` · `en_marcha` · `parcial` ·
    `completado` · `fallido` · `cancelado` · `entrega_desconocida`. Regla de oro: **espera agotada
    ≠ error**; si el trabajo sigue, es `en_marcha`. `completado` **solo** con cierre real, jamás
    con un preámbulo.
  - `LEDGER.jsonl` — append-only, **una línea por transición** de estado. Nunca se reescribe.
  - `ESTADO_ACTUAL.json` — foto de la cola y de los permisos, **con su fecha**. Es un dato
    **caducable**: mira la fecha antes de creértelo.
  - `README.md` — las reglas de la cola, enteras.
- **SALA** — `<taller>\RCC1\SALA\<voz>.jsonl` — un fichero por voz (`ratacode.jsonl`,
  `claude.jsonl`…), append-only, una línea por mensaje con su `n`, su `de` y el `texto`. Para leer
  la sala: recuerda el último `n` que leíste y sigue desde ahí. **Un fichero = un escritor.**
- **ESTADO** — `trabajo\<R>\ESTADO`, **una línea**:
  `R-XXX · estado · quién · fecha · nota`. Es lo que se lee para saber por dónde va una R sin
  abrirla.

## 3 · Coger un JOB, entregarlo y avisar

1. **Mirar qué hay**: `COLA\ESTADO_ACTUAL.json` y los `COLA\JOB-*.json`. Los que están `en_cola`
   (o con tu `worker_id`) son los que están libres. Una **consulta** de estado no crea trabajo: se
   responde leyendo el fichero.
2. **Cogerlo**: escribe en **tu** JOB `estado: en_marcha` y el `worker` con tu nombre. Un solo
   escritor por fichero: quien creó el JOB no reescribe tu fichero, y tú no reescribes el suyo.
3. **Entregarlo**: el resultado va en `COLA\<job_id>.resultado.md`, y el `estado` de tu fichero
   pasa a `completado`, `fallido` o `parcial`. Y el informe, en `trabajo\<R>\INFORME.md`, con la
   **salida literal** de la prueba.
4. **Avisar**: una línea en `SALA\<tu-voz>.jsonl` con tu `n` siguiente, y tu `trabajo\<R>\ESTADO`
   actualizado. Eso es el aviso: no hay campana, hay fichero.
5. **Nunca reenviar por timeout**: se pregunta por el `job_id` (o por el `turn_id`). Y si ya hay un
   `JOB-<id>.json`, no se crea otro: se responde su estado.

## 4 · Recetas de conexión

`<taller>\R-CONECTAR-001\RECETAS.md`: cómo se enchufa el navegador por MCP, las MANOS y cualquier
otro MCP, con el comando copiable y su salida. Lo que no se haya probado se marca SOSPECHA.

## 5 · Cómo se trabaja aquí (la regla que manda)

- **Movimiento siempre.** Si hay duda o decisión, la resuelve **la Rata de RCC1** y se sigue: al
  dueño no se le para esperando.
- Una R = **una sesión nueva y pequeña**, con su carpeta `trabajo\<R>\` y su ESTADO de una línea.
  Cuando pasa de ~2 M tokens, se traspasa por fichero y se abre otra.
- «Hecho» solo con **prueba real abierta y usada**, y la salida literal pegada en el informe.
- Etiqueta todo: **MEDIDO / LEÍDO / SOSPECHA**. «No lo sé» vale más que un número inventado.
- Sin claves: nunca leas ficheros de credenciales. Si falta una, para y dilo.
- Cambios en la casa: primero el perfil **headless** con prueba headless, y dentro de `- insert:`.

## 6 · La voz de una sesión nueva, y qué hacer si no hay JOB

*(lo destapó la primera prueba real de arranque, R34-GUIA, 2-oct-2026)*

- **Tu voz en la SALA es tuya.** Si eres una sesión nueva, tu fichero es `RCC1\SALA\<tu-nombre>.jsonl`
  (por ejemplo `r34-guia.jsonl`): se crea si no está, y a partir de ahí **solo escribes tú**. Nunca
  escribas en el fichero de otra voz (`ratacode.jsonl` es de la Rata). Si dudas de cuál es la tuya, no
  toques la SALA y dilo en tu `ESTADO`.
- **Si no hay JOB libre** (ningún `en_cola` con `worker_id: POR_ASIGNAR` ni con el tuyo), no te
  inventes trabajo: deja tu `ESTADO` diciéndolo y pide trabajo en tu voz de SALA. La Rata (RCC1) reparte.

Esta guía viaja en `apreton\taller.md`. Si algo no cuadra con un fichero, **manda el fichero**.

## 7 · Las herramientas de la casa, y sus trampas (2-oct-2026)

Lo que dejó enchufado la noche del 2 de octubre, y lo que hay que saber para no romperlo.

| Pieza | Estado | Cómo se comprueba |
|---|---|---|
| Navegador (Playwright por MCP) | funciona | pide abrir `https://example.com` y que te diga el título |
| Ojos (`app_list`, `screen_read`, `screen_shot`) | funciona | cuenta las ventanas que ve |
| Manos: clic | funciona | clic en una ventana propia, con su resultado literal |
| Manos: escribir (`type`) | funciona **con nuestro parche** | escribe y **relee** para confirmar |
| Voz que habla (`dsh-kitt-voice`) | funciona | voz del sistema en español (Microsoft Helena). Piper no está instalado |
| Voz que escucha | **sí, con el reconocedor del navegador** | el plugin de la casa trae reconocedor «Navegador» de serie, sin cuenta (solo Chrome y Edge): permite el micrófono a la página y habla. El paquete **oficial** de voz sí espera al motor 0.2.0 |
| Reloj, agenda, pregunta al humano, Codex | funcionan | R31 los probó en headless y en el panel |

**Las cinco trampas que ya han mordido:**

1. **Antes de tocar la casa, arranque de prueba.** `lanzador\probar-arranque.ps1` copia la casa, la
   levanta en el puerto 3427 y dice si arranca. Tarda 4 segundos. Reiniciar a ciegas ya nos costó un
   susto: la voz 0.1.7-alpha.1 **impedía arrancar** RATACODE entero.
2. **No mezcles versiones del motor.** Solo paquetes `@deepseek-ai/*` de la versión que ya tiene la
   casa (hoy `0.1.5-rc.x`). Otro número, otra familia, y no arranca.
3. **El bloque va DENTRO de `- insert:`.** Una fila suelta en `cordis.patch.yml` se ignora **sin
   avisar**: el agente dirá que tiene «0 herramientas» y parecerá que el paquete está roto.
4. **En PowerShell, dentro de comillas dobles, la tilde invertida escapa.** Escribir un YAML así
   metió caracteres de control y dejó la casa sin arrancar hasta que se restauró de la copia. En
   PowerShell, para texto literal: here-string de **comillas simples**.
5. **El ayudante de `dsh-click` lleva un parche nuestro** (`native/win32/dsh-click-helper.ps1`).
   Arregla que `type` escriba. Un `dsh plugin add dsh-click` **lo borra**: si deja de escribir, mira
   primero eso. Está contado en `trabajo\RATACODE-TOP\PARCHE-dsh-click.md`.

**Y la regla que ata todo:** **el reinicio de RATACODE se lleva por delante la sesión que lo pide**.
Lo que haya que comprobar después del reinicio se **encarga por escrito antes** (por eso existe
`JOB-000015`, la verificación post-reinicio). No se deja nada «para cuando reinicie».

