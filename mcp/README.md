# RATACODE-MCP · el servidor MCP de RATACODE

Deja que **el agente que ya usas** (ChatGPT web, Codex, Claude Code, Rowboat,
OpenClaw, o cualquier cliente MCP) mande trabajo a **los modelos que ya tienes
configurados en RATACODE**.

```
ChatGPT / Codex / Claude Code / Rowboat / OpenClaw
        ↓  MCP
   RATACODE-MCP   (esta capa)
        ↓  JSON-RPC stdio  (el protocolo que DSH ya publica)
   core DSH        (mismo binario, misma casa, mismos proveedores y claves)
        ↓
   proveedor elegido → modelo elegido → resultado
```

RATACODE **no es otro agente** y no se reescribe nada del núcleo: esto es una
capa fina encima. El trabajo lo hace el core por medio del perfil `sdk` de DSH,
que es su entrada oficial para conductores externos.

## Arrancarlo

Es un **subcomando del binario principal**, así que no hay que buscar rutas:

```sh
ratacode mcp                              # habla MCP por stdio (lo que espera un cliente)
ratacode mcp --status                     # estado y sale, sin arrancar el motor
ratacode mcp --http                       # además, Streamable HTTP en 127.0.0.1:<puerto>/mcp/<clave>
ratacode mcp --help                       # la ayuda del MCP
```

El puerto por defecto del HTTP es **3778** (se cambia con `--port`). `--http` exige
`mcp.workspaces` declarado. Con `--nueva-clave` se estrena una clave nueva en vez de
reutilizar la guardada.

Si `ratacode` no está en el PATH (o trabajas desde el repositorio), vale la ruta
directa: `node <ruta>\bin\ratacode.js mcp`.

Por stdio, **stdout es del protocolo**: todo lo que contamos va a stderr.

## Conectar un cliente

Cualquier cliente MCP local (stdio):

```json
{
  "mcpServers": {
    "ratacode": {
      "command": "ratacode",
      "args": [
        "mcp",
        "--home",
        "C:\\Users\\tu-usuario\\.ratacode"
      ]
    }
  }
}
```

Las sintaxis exactas por app (Claude Code, Codex, OpenClaw, Rowboat y el genérico)
están en [`..\apreton\mcp.md`](../apreton/mcp.md).

> **Las claves están en UN solo sitio: RATACODE › Ajustes › Models.** Este servidor
> no mira las variables de entorno del cliente ni abre ficheros de claves: le
> pregunta al motor si la credencial de esa ruta está puesta en la casa
> (`<casa>\.credentials.yaml`). Si no lo está, **se para y lo dice**:
> `Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.`
>
> Por eso su alta es `ratacode mcp` y nada más: no hay ninguna variable que
> pasarle, y la clave no queda escrita en la configuración de tu app.
>
> En ningún caso la clave sale por MCP: el servidor la usa, no la cuenta.

## ChatGPT web: el túnel (`mcp/tunel.mjs`)

ChatGPT web (y cualquier app que hable MCP por URL) necesita HTTP. El túnel es **sólo
transporte**: expone el MCP local con Cloudflare mientras corre y no cambia nada del servidor.

```sh
ratacode mcp --http --port <mcp.puerto>    # el MCP por HTTP (local)
node mcp/tunel.mjs --home <casa>           # el túnel, en otra ventana
```

`tunel.mjs` imprime la **URL pública completa** (dominio + `/mcp/<clave>`) para pegar en el
cliente. Con `--misma-clave` reutiliza la clave que había (es lo que usa el botón «Encender» del
panel, para que la dirección no cambie); sin él estrena una, y el servidor **adopta la clave nueva
sin reiniciar** (relee `<casa>\mcp\http-secret.txt` cada dos segundos) y reescribe la URL en
`<casa>\mcp\http-url.txt`. A cloudflared se le pasa sólo el origen: la clave no viaja en los
argumentos de ningún proceso.

**Dos modos, y el de fábrica es el rápido (R27):**
- **Túnel rápido** (sin cuenta): URL efímera `https://<algo>.trycloudflare.com`, **distinta cada
  vez**. Es lo que hay si no declaras nada.
- **Túnel CON NOMBRE**: si la casa declara `mcp.tunel_nombre` y `mcp.tunel_host`, se arranca
  `cloudflared tunnel run --url <origen> <nombre>` y la dirección es **FIJA**
  (`https://<host>/mcp/<clave>`), así que el conector de ChatGPT se crea una sola vez. El túnel y
  su DNS los das de alta tú en Cloudflare (los tres comandos, en
  [`..\apreton\chatgpt.md`](../apreton/chatgpt.md)); RATACODE no hace login y no lee
  `%USERPROFILE%\.cloudflared`.

Dónde está `cloudflared` se puede decir con `--cloudflared <ruta>` o con `RATACODE_CLOUDFLARED` (y un
`.mjs` se lanza con node: en Windows un `.mjs` no es ejecutable). Ctrl+C lo cierra, y también borra
sus dos ficheros de la casa (`tunel-url.txt` y `tunel.pid`), que son los que dicen si el túnel está
vivo.

Y **ya no hay nada que aceptar**: cada tarea va encerrada en las carpetas de
`mcp.workspaces` (lee y escribe sólo ahí, sin terminal y sin red), así que la
bandera `--acepto-lectura-total` de antes es un no-op: se acepta para no romper
los comandos viejos, y no hace nada (más abajo, «La LECTURA, encerrada»).

### ChatGPT web con tu cuenta (R26): conector propio y túnel

ChatGPT **no acepta claves propias** ni cabeceras que le inventes
([docs de autenticación](https://developers.openai.com/plugins/build/auth): no admite claves de API
de cliente), así que la clave viaja **dentro de la URL**: es una URL-capacidad. El servidor la
admite de tres formas —en la ruta `/mcp/<clave>`, en la consulta `/mcp?clave=<clave>` o en
`Authorization: Bearer <clave>`— por si un cliente no traga con una de ellas; la que se le da a
Patxi es la de la ruta. Y **el `Origin` de otra web se corta con un 403**: sólo se atiende desde
loopback y desde OpenAI.

Pasos (documentación oficial de hoy: [conectar y probar](https://developers.openai.com/plugins/deploy/connect-chatgpt)):

1. En ChatGPT: **Ajustes › Seguridad e inicio de sesión › Modo desarrollador**.
2. En el PC: **Ajustes › Conexiones › ChatGPT y Claude web › Encender** (o, a mano,
   `ratacode mcp --http --port <mcp.puerto>` y, en otra ventana,
   `node mcp/tunel.mjs --home <casa>`). En ChatGPT, el conector se crea con **«URL del servidor»** y
   **Autenticación: «Sin autenticación»**.
3. En ChatGPT: **ChatGPT › Plugins** (`https://chatgpt.com/plugins`) → **+** → nombre y descripción
   → en **Conexión**, pegar la dirección que da RATACODE → marcar la casilla → **Crear**.
4. Crear y revisar las herramientas que descubre. La guía corta, en
   [`..\apreton\chatgpt.md`](../apreton/chatgpt.md).

> **R27 · CORRECCIÓN (medido el 30-sep-2026):** con **ChatGPT Pro** y este mismo conector,
> `run_task` **SÍ funciona** —la tarea `mcp-t-mun3aspp-7huh` creó `PLAN.md` en la carpeta
> autorizada—. Lo que decía antes esta página («`CHATGPT_PRO_WRITE = NO DISPONIBLE POR PLAN`) era
> falso. Las tres de sólo lectura (`ratacode_status`, `list_files`, `read_file`) se quedan, porque
> no gastan nada, y bastan para mirar.

**Y no gasta de más (R27).** `run_task` **espera solo** `mcp.espera_por_defecto_segundos` (25 s de
fábrica): si la tarea acaba dentro, el resultado va en ESA misma respuesta y el chat no tiene que
preguntar nada; si no, devuelve el `task_id` y las instrucciones del servidor le dicen que **no
pregunte en bucle** (como mucho, `get_task_status` cada 20 s). Cada tarea lleva además dos topes —
`mcp.pasos_max` (40 de fábrica) y `mcp.tokens_max` (400 000)—: al llegar, la tarea se para sola y lo
dice en `tope_alcanzado`.

**La misma dirección, siempre.** El MCP se enciende al puerto de la casa (`mcp.puerto`) y la clave
**no cambia** al apagar y encender (sólo la cambia el botón «Cambiar clave»), así que el conector de
ChatGPT se crea **una vez**. Si quieres además que el DOMINIO no cambie, mira
`mcp.tunel_nombre` y `mcp.tunel_host` más abajo (el túnel con nombre de Cloudflare).

Alternativa nativa (en vez de cloudflared): **Secure MCP Tunnel** de OpenAI
([guía](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)), que necesita un
`tunnel_id` de la Platform y `tunnel-client`; no sustituye a la URL pública si algún día se publica
el conector.

## Las herramientas

| Herramienta | Para qué |
|---|---|
| `list_providers` | Proveedores configurados y si tienen la credencial puesta en la casa (Ajustes → Models). Nunca la clave. |
| `list_models` | Modelos con proveedor, id, contexto, capacidades, coste declarado y estado. Se llama **antes** de `run_task`. |
| `run_task` | Lanza el encargo. **Espera solo** `mcp.espera_por_defecto_segundos` (25 s de fábrica): si la tarea acaba dentro, el resultado completo va en esa misma respuesta. Si no, devuelve `task_id` (y no hay que preguntar en bucle). Con `esperar_segundos` (1-600) se espera lo que digas. Lleva topes de pasos y tokens. |
| `get_task_status` | `queued` · `running` · `completed` · `failed` · `cancelled`. |
| `get_task_result` | Respuesta, modelo, proveedor, tokens, coste (si está declarado), duración y errores. |
| `cancel_task` | Detiene la tarea de inmediato (se mata el proceso que la ejecuta). |
| `ratacode_status` | Estado del servidor: si está vivo, versión, herramientas, **carpetas autorizadas**, sesiones (clientes) y topes. Ni la casa ni ninguna clave. |
| `list_files` | **Sólo lectura (R26).** Lista una carpeta autorizada (entradas con tipo, tamaño y fecha). Fuera de las carpetas autorizadas, se para. |
| `read_file` | **Sólo lectura (R26).** Devuelve el texto de un fichero de dentro (256 KB como mucho; si es binario, lo dice). Fuera, se para. |
| `list_sessions` | **Sólo lectura (R28).** Las sesiones que hay abiertas en el panel de RATACODE: id, título, carpeta, modo, modelo, proveedor, estado y si están «Abiertas a ChatGPT». |
| `get_session` | **Sólo lectura (R28).** Una sesión, por su `session_id` o por su título **exacto**. Con más de una coincidencia devuelve `AMBIGUOUS_SESSION` con los ids. |
| `send_to_session` | **R28.** Mete un mensaje EN UNA SESIÓN QUE YA EXISTE en el panel (no crea ninguna, no copia la conversación y no le cambia modelo, modo ni carpeta). Entra por la misma vía que la caja de escribir del panel, así que **se ve aparecer en ese chat** con la marca «GPT WEB →», y el agente contesta ahí. Espera 25 s (`wait_seconds`, hasta 120) y devuelve la respuesta si el turno acaba dentro; si no, el `turn_id`. |
| `get_session_reply` | **Sólo lectura (R28).** La respuesta de un mensaje mandado con `send_to_session`, por su `turn_id` (o por `session_id`). Si sigue en marcha, se pregunta como mucho una vez cada 20 s. |

Las diez de sólo lectura (`ratacode_status`, `list_files`, `read_file`, `list_sessions`, `get_session`,
`get_session_reply`, `list_providers`, `list_models`, `get_task_status`, `get_task_result`) van marcadas con
`readOnlyHint: true`, `destructiveHint: false` y `openWorldHint: false`, que es lo que OpenAI
documenta para que el cliente sepa que no cambian nada. **No gastan claves ni tokens**, y el cerco
de la ruta se comprueba EN EL SERVIDOR con `lib/lectura.js` (el mismo de las tareas): `..`, rutas
absolutas, uniones que apuntan fuera, nombres cortos 8.3, `\\?\`, UNC y variables de entorno caen
todos del mismo lado. Son las más baratas para mirar, en cualquier plan.

### Hablar con una sesión ya abierta (R28)

`run_task` lanza **trabajo independiente**: un hijo del motor con su propia sesión `mcp-<task_id>`.
Las cuatro de R28 son OTRA capacidad: hablan con una sesión que **ya existe** en el panel.

`send_to_session` llama a las rutas de la piel del panel
(`/ratacode/sesiones/enviar`), y el panel —que es el único proceso que puede escribir en el
registro durable de una sesión viva— llama a la MISMA función del motor en la que acaba su caja de
escribir (`sessionController.prompt`). Por eso el mensaje aparece en ese chat, sin sesión nueva, sin
fork y sin copiar la conversación.

Dos condiciones, y las dos las decide el humano (el TEXTO del mensaje no da permisos nunca):

1. la carpeta de la sesión tiene que estar en `mcp.workspaces` de la casa, y
2. Patxi tiene que haberla marcado **«Abierta a ChatGPT»** en la cabecera de ese chat. Está
   **apagado por defecto**.

Si no se cumplen, la herramienta devuelve `SESSION_NOT_ALLOWED` y **no envía nada**. Y mientras una
sesión está abierta, sus turnos van **encerrados en la carpeta de esa sesión**: sin terminal, sin
procesos, sin red y sin subagentes, y con el mismo gancho de rutas del MCP
(`lib/lectura.js`). El motor no deja aplicar el gancho sólo a los turnos del chat —el gancho ve la
llamada, no el remitente—, así que vale para **toda la sesión** mientras esté abierta: el panel lo
dice en su cabecera y la herramienta en `encierro`. Al cerrar el interruptor se le devuelve a la
sesión el permiso que tenía.

Para que esto funcione, el panel tiene que estar **abierto**: el MCP canjea el token de
`<casa>\url.txt` por la cookie de sesión del navegador (el mismo camino que hace el navegador al
abrir el panel) y llama a sus rutas. Ni el token ni la cookie salen de la casa.

`run_task` acepta: `prompt`, `esperar_segundos`, `provider`, `model`,
`working_directory`, `context`, `max_tokens`, `timeout`, `allow_dangerous`.

**Esperar dentro de la llamada (tropiezo 17, y R27).** Por stdio, la tarea vive lo que
vive el cliente: si el cliente se cierra, el servidor se va y el fichero se queda
a medias. Un cliente de una sola vuelta (`claude -p`, `codex exec`, una llamada
suelta) no puede volver a preguntar por el estado, así que tiene dos salidas:
`run_task` con `esperar_segundos` (máximo 600 s) y el resultado en la misma
respuesta, o no terminar el turno hasta que `get_task_status` diga `completed` o
`failed`. Desde R27, además, **no hace falta pedirlo**: `run_task` espera solo
`mcp.espera_por_defecto_segundos` (25 s) y devuelve el resultado en la misma
respuesta si la tarea acaba dentro. Si el plazo se agota, la respuesta lo dice
(`espera.agotada: true`, `espera.por_defecto: true`) y queda el `task_id` para
seguir preguntando — **sin bucle**: una vez cada 20 s como mucho.

**Sin routing oculto.** Si no dices modelo, se usa el `agent-default-model` de
la casa **y se te dice cuál** (`ruta_elegida: "por_defecto"`). El humano o el
agente deciden el modelo; esta capa no elige por nadie.

## Seguridad

- **Espacio cerrado, para LEER y para ESCRIBIR.** Una tarea trabaja sólo dentro de las
  raíces autorizadas (`mcp.workspaces`). Si la casa no las declara, la única raíz
  permitida es el espacio por defecto (o la carpeta desde la que arrancó el servidor).
  Cualquier otra ruta se rechaza, y el agente ve una línea: **«Fuera de la carpeta
  autorizada: `<ruta>`».**
- **La LECTURA, encerrada con un gancho.** El motor no sabe acotar la lectura (`read-only`
  deniega toda MUTACIÓN, no toda lectura: `dsh-fs-sandbox/lib/types/index.d.ts:7-8`,
  «Reads pass through untouched: every mode permits reading»; y la única lista de raíces
  que existe es la de ESCRITURA, `dsh-sandbox/lib/types/roots.d.ts:28-36`). Se acota con
  el gancho de permiso por herramienta `tools/pre-execute` (`dsh-tools`), que ve cada
  llamada antes de ejecutarse y puede denegarla. El plugin que lo engancha es
  `mcp/lib/lectura.js`, y el MCP lo monta en cada tarea por parche. Normaliza de verdad:
  rutas relativas, `..`, mayúsculas/minúsculas de Windows, enlaces (realpath del trozo que
  existe), UNC y el prefijo `\\?\`.
- **Sin vías de escape.** En la tarea no hay terminal (`tool-pwsh`, `tool-bash`), ni
  trabajos en segundo plano (`tool-jobs`), ni red (`tool-web`), ni subagentes
  (`tool-subagent*`), ni guiones (`tool-workflow`) ni bucles de agentes (`tool-ralph`).
  Se apagan una a una en el parche de cada tarea, con su motivo escrito al lado.
- **Y las dos lecturas que no pasan por ninguna herramienta (R26).** El motor carga solo las
  instrucciones `AGENTS.md` de la carpeta de trabajo **y de todas las de arriba** (y del
  `<casa>\AGENTS.md`) y las habilidades (*skills*) de `<raíz>/.dsh/skills`, `<raíz>/.agents/skills`,
  `<casa>\skills` y `~/.agents/skills`: eso NO lo ve el gancho, porque no es una llamada a
  herramienta. Medido: sin apagarlas, un canario puesto en el `AGENTS.md` de la casa **y** una
  habilidad de fuera **llegaban al modelo**. Se apagan con sus ajustes documentados
  (`agent-instructions` → `maxBytes: 0`; `skill-filesystem` → `includeDefaultRoots: false`), y la
  prueba `pruebas/mcp-lectura.test.mjs` mide el antes y el después con el mismo montaje.
- **El sandbox lo impone el core.** Cada tarea arranca en `workspace-write` con su cwd
  como frontera de escritura, y el MCP le pasa al hijo un parche que **fija** el modo.
  Ojo con el detalle que costó una ronda: la casa de fábrica trae
  `permission.defaultPreset: danger-full-access` (es lo que el panel necesita), y ese
  ajuste se aplica AL CREAR la sesión, así que ganaba al parche. Por eso el parche apaga
  la fila `permission` en el hijo del MCP: sin ese servicio, manda el modo del MCP. El
  panel del usuario no se toca: sigue con el preset que él elija.
- **Lo peligroso se pide dos veces.** `allow_dangerous` en la llamada **no
  basta**: hace falta que el humano haya puesto `mcp.permitir_peligroso: true`.
  Si no, se deniega y se explica. Nunca se queda esperando una aprobación que
  en un servidor MCP no existe: falla cerrado. Y aun con `allow_dangerous`, la
  lectura sigue encerrada en `mcp.workspaces`: lo que se abre es la ESCRITURA.
- **Claves.** Nunca se devuelven, nunca se escriben en el cuaderno, nunca van
  al agente cliente. El servidor las usa y hace la llamada. Además, el propio
  DSH lava el entorno de los shells de sus agentes
  (`dsh-subprocess`: `/KEY|PASSWORD|SECRET|TOKEN/i`), así que la tarea
  delegada tampoco las ve desde dentro. **De dónde salen:** de la casa —las que
  guardaste con Ajustes → Models—, que es la única fuente; el servidor le
  pregunta al motor si están puestas (con su `describe`: configurada sí/no, sin
  leer ningún valor) y el hijo del motor arranca SIN las variables de claves,
  para que resuelva las de la casa y no una vieja del entorno.

## Ajustes (en `<casa>\settings.yaml`)

```yaml
mcp:
  workspaces:                     # obligatorio en modo HTTP (--http/túnel)
    - C:\Users\tu-usuario\Projects\mi-app
  workspace_por_defecto: C:\Users\tu-usuario\Projects\mi-app
  permitir_peligroso: false
  timeout_por_defecto_ms: 1800000   # 30 min: lo que dura una tarea si no dices otra cosa
  timeout_maximo_ms: 3600000        # 1 h: techo, aunque el cliente pida más
  tareas_a_la_vez: 3                # cuántas pueden estar en marcha a la vez
  prompt_max_caracteres: 100000     # tope del encargo
  puerto: 3778                      # (R27) el puerto del MCP por HTTP de esta casa
  espera_por_defecto_segundos: 25    # (R27) lo que espera run_task dentro de la llamada
  pasos_max: 40                      # (R27) tope de vueltas del modelo por tarea
  tokens_max: 400000                 # (R27) tope de tokens (entrada + salida) por tarea
  tunel_nombre: ratacode             # (R27) túnel CON NOMBRE: dirección fija (opcional)
  tunel_host: ratacode.kittcat.com   # (R27) su hostname público (van los dos juntos)
  precios:                        # opcional: el core no trae precios de texto
    b-ai:
      deepseek-v4.1-flash:
        entrada_por_millon: 0.14
        salida_por_millon: 0.28
        moneda: EUR
```

El coste sólo aparece si lo declaras aquí. **RATACODE no se inventa precios**:
si no está, devuelve `null` y lo dice.

**La DIRECCIÓN FIJA (R27).** El túnel rápido de Cloudflare da un dominio nuevo cada vez que se
enciende, así que la dirección de ChatGPT cambia. Si declaras `tunel_nombre` y `tunel_host`, el
panel arranca `cloudflared tunnel run --url http://127.0.0.1:<puerto> <nombre>` y la dirección es
siempre `https://<host>/mcp/<clave>`. El túnel y su DNS los das de alta tú, en tu Cloudflare (los
tres comandos están en [`..\apreton\chatgpt.md`](../apreton/chatgpt.md)); RATACODE **no hace login,
no crea túneles y no lee** `%USERPROFILE%\.cloudflared` (eso son tus credenciales).

## Qué deja escrito

```
<casa>\mcp\
  estado.json       estado del servidor (para el panel y para --status)
  actividad.jsonl   una línea por llamada: tipo 'tarea' (hora, cliente, modelo,
                    proveedor, tarea recortada, duración, tokens, coste, estado)
                    o tipo 'lectura' (hora, cliente, herramienta, ruta y
                    permitido/bloqueado) — R27
  marcas.json       las marcas del tope de tareas por hora (sobreviven al reinicio)
  http-secret.txt   la clave del MCP por HTTP (sólo dueño)
  http-url.txt      la URL completa con la clave (sólo dueño)
  tunel-url.txt     la URL pública del túnel, mientras está abierto (sólo dueño)
  tunel.pid         el pid de cloudflared (R27: es lo que dice si el túnel vive)
  cloudflared.yml   la config del túnel con nombre, si se usa (sólo dueño)
  tareas\<id>.json  el registro completo de cada tarea
  tmp\              parches de política de una tarea (se borran al terminar)
```

## Las pruebas

Estas pruebas viven en el **repositorio** (`mcp/prueba/` viaja excluido del `.tgz`,
así que en una instalación desde el paquete no las encontrarás).

```sh
# el camino entero: list_models → run_task → get_task_result, con PONG
node mcp/prueba/cliente-prueba.mjs --home <casa> --provider b-ai --model deepseek-v4.1-flash

# UNA sola llamada: run_task con esperar_segundos, y el resultado (PONG) en esa
# misma respuesta, sin get_task_status.
node mcp/prueba/cliente-espera.mjs --home <casa> --provider b-ai --model deepseek-v4.1-flash --esperar 300

# las promesas de seguridad: credencial sin enseñarla, espacio cerrado,
# allow_dangerous denegado y cancelación de verdad
node mcp/prueba/prueba-cancelar-y-espacio.mjs --home <casa> --provider b-ai --model deepseek-v4.1-flash
```

`cliente-prueba.mjs` arranca el servidor **como lo haría un cliente real** (con
el entorno recortado del SDK), lanza `Responde solamente PONG`, vigila el estado
y recoge el resultado. Sale con código 0 sólo si la respuesta trae PONG.

`cliente-espera.mjs` es la prueba del tropiezo 17: enseña `run_task` tal como lo
lista el servidor (con `esperar_segundos` y su descripción), lanza el encargo UNA
vez con `esperar_segundos` y exige que esa misma respuesta traiga el resultado
completo con PONG. Se le puede pasar un entorno o no: da igual, porque las claves
salen de la casa.

`prueba-cancelar-y-espacio.mjs` comprueba cuatro cosas por escrito: que
`list_providers` no enseña ninguna clave, que una carpeta fuera de los espacios
autorizados se rechaza, que `allow_dangerous` sin permiso de la casa se deniega
y que `cancel_task` deja la tarea en `cancelled` de verdad.

> Las dos pruebas escriben su carpeta de trabajo en `mcp/prueba/espacio` salvo
> que les pases `--espacio`. No tocan la casa salvo el cuaderno (`<casa>\mcp\`).

## Lo que falta (a propósito)

- **Del MCP:** nada de transporte. El stdio y el Streamable HTTP están hechos, y el túnel
  (`mcp/tunel.mjs`) también; las nueve herramientas (siete de trabajo y estado, dos de sólo
  lectura) y sus topes, en marcha.
- **Del lanzador:** arranque/parada del MCP desde el panel con `MCP: ON/OFF`, la sección
  **Connections** en Ajustes (puerto, clientes, última actividad) y el botón que explique el MCP
  dentro de la web. Hoy eso se hace por línea de órdenes y se mira en `<casa>\mcp\`.
- **Y una frontera que ya SÍ está puesta (R25):** la LECTURA de las tareas. DSH no la
  sabe acotar (mira «La LECTURA, encerrada con un gancho»), así que RATACODE la encierra
  con el gancho `tools/pre-execute`: cada herramienta con una ruta fuera de
  `mcp.workspaces` se para y lo dice. Lo que queda fuera de nuestras manos es lo que DSH
  no exponga por una herramienta (no hay ninguna: sin terminal, sin red y sin subagentes,
  no hay puerta). Si algún día DSH trae raíces de lectura, esto se aprieta todavía más.
