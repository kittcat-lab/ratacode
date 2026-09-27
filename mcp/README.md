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
ratacode mcp --http --acepto-lectura-total   # además, Streamable HTTP en 127.0.0.1:<puerto>/mcp/<clave>
ratacode mcp --help                       # la ayuda del MCP
```

El puerto por defecto del HTTP es **3778** (se cambia con `--port`). `--http` exige
`--acepto-lectura-total` (abajo se explica por qué) y `mcp.workspaces` declarado. Con
`--nueva-clave` se estrena una clave nueva en vez de reutilizar la guardada.

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

> **Las claves van por el ENTORNO, y este servidor no lee ficheros de claves.**
> Ni `.credentials.yaml`, ni `.env`, ni bóvedas: sólo mira las variables de
> entorno que le ha dado el cliente que lo ha arrancado. Si falta una, **se para
> y lo dice**: `falta B_AI_API_KEY en el entorno del cliente MCP`.
>
> Por eso el cliente tiene que entregarle su entorno al servidor. Un cliente
> real (Claude Code, Codex) lo hace. Ojo con los que no: el transporte stdio del
> SDK de MCP, **si no le pasas un entorno, sólo hereda una lista blanca**
> (`PATH`, `TEMP`, `USERPROFILE`… y ninguna clave; `client/stdio.js:8-24`), así
> que el servidor se quedaría sin credenciales. Nuestro cliente de prueba se lo
> pasa a propósito (`env: { ...process.env }`) para imitar a un cliente real.
>
> En ningún caso la clave sale por MCP: el servidor la usa, no la cuenta.

## ChatGPT web: el túnel (`mcp/tunel.mjs`)

ChatGPT web (y cualquier app que hable MCP por URL) necesita HTTP. El túnel es **sólo
transporte**: expone el MCP local con Cloudflare mientras corre y no cambia nada del servidor.

```sh
ratacode mcp --http --acepto-lectura-total                 # el MCP por HTTP (local)
node mcp/tunel.mjs --home <casa> --acepto-lectura-total     # el túnel, en otra ventana
```

`tunel.mjs` imprime la **URL pública completa** (dominio + `/mcp/<clave>`) para pegar en el
cliente. Al abrirlo estrena clave (`--misma-clave` para reutilizar la que había); el servidor
**adopta la clave nueva sin reiniciar** (relee `<casa>\mcp\http-secret.txt` cada dos segundos) y
reescribe la URL en `<casa>\mcp\http-url.txt`. A cloudflared se le pasa sólo el origen: la clave
no viaja en los argumentos de ningún proceso. Si el túnel nombrado `mcp.mod-rat.com` existe en tu
Cloudflare, lo usa con hostname fijo mediante un fichero de configuración
(`<casa>\mcp\cloudflared.yml`); si no, un quick tunnel con URL efímera. Ctrl+C lo cierra.

Y **sí, `--acepto-lectura-total` es obligatorio** aquí y en `--http`: mientras el túnel esté
abierto, quien tenga esa URL puede pedir una tarea que lea cualquier fichero que pueda leer tu
usuario (más abajo, «La LECTURA no se puede cerrar»).

## Las herramientas

| Herramienta | Para qué |
|---|---|
| `list_providers` | Proveedores configurados, si tienen credencial y **de dónde sale** (el entorno del cliente, o la casa si la guardaste con Ajustes → Models). Nunca la clave. |
| `list_models` | Modelos con proveedor, id, contexto, capacidades, coste declarado y estado. Se llama **antes** de `run_task`. |
| `run_task` | Lanza el encargo. Sin `esperar_segundos`, devuelve `task_id` al momento y el trabajo sigue en segundo plano. Con `esperar_segundos` (1-600), la llamada **espera y devuelve el resultado completo** en esa misma respuesta. |
| `get_task_status` | `queued` · `running` · `completed` · `failed` · `cancelled`. |
| `get_task_result` | Respuesta, modelo, proveedor, tokens, coste (si está declarado), duración y errores. |
| `cancel_task` | Detiene la tarea de inmediato (se mata el proceso que la ejecuta). |
| `ratacode_status` | Estado del propio servidor: casa, motor, tareas vivas, clientes y últimas líneas del cuaderno. |

`run_task` acepta: `prompt`, `esperar_segundos`, `provider`, `model`,
`working_directory`, `context`, `max_tokens`, `timeout`, `allow_dangerous`.

**Esperar dentro de la llamada (tropiezo 17).** Por stdio, la tarea vive lo que
vive el cliente: si el cliente se cierra, el servidor se va y el fichero se queda
a medias. Un cliente de una sola vuelta (`claude -p`, `codex exec`, una llamada
suelta) no puede volver a preguntar por el estado, así que tiene dos salidas:
`run_task` con `esperar_segundos` (máximo 600 s) y el resultado en la misma
respuesta, o no terminar el turno hasta que `get_task_status` diga `completed` o
`failed`. Si el plazo se agota, la respuesta lo dice (`espera.agotada: true`) y
queda el `task_id` para seguir preguntando.

**Sin routing oculto.** Si no dices modelo, se usa el `agent-default-model` de
la casa **y se te dice cuál** (`ruta_elegida: "por_defecto"`). El humano o el
agente deciden el modelo; esta capa no elige por nadie.

## Seguridad

- **Espacio cerrado (para ESCRIBIR).** Una tarea sólo **escribe** dentro de las raíces
  autorizadas. Si la casa no declara `mcp.workspaces`, la única raíz permitida es el
  espacio por defecto (o la carpeta desde la que arrancó el servidor). Cualquier otra
  ruta se rechaza con un error que dice qué hacer.
- **La LECTURA no se puede cerrar (por eso el HTTP pide permiso).** El motor no tiene
  ningún modo que acote lo que se lee: `read-only` deniega toda MUTACIÓN, no toda
  lectura, y el vocabulario del sandbox es de efectos sobre ficheros
  (`dsh-fs-sandbox/lib/types/index.d.ts:7-8`: «Reads pass through untouched: every mode
  permits reading»; `dsh-sandbox/lib/types/roots.d.ts:28-36`: la única lista de raíces
  que existe es la de ESCRITURA). Una tarea MCP puede leer cualquier fichero que pueda
  leer tu usuario —incluida `<casa>\.credentials.yaml`— y lo que lea viaja al proveedor
  del modelo. Por eso `--http` **no arranca** sin `--acepto-lectura-total`, y
  `tunel.mjs` tampoco. Por stdio no hace falta: la superficie la controla quien arranca
  su propio cliente local.
- **El sandbox lo impone el core.** Cada tarea arranca en `workspace-write` con
  su cwd como frontera de escritura, y el MCP le pasa al hijo un parche que
  **fija** el modo, para que ni un `DSH_PERMISSION_MODE` heredado del entorno
  pueda aflojarlo.
- **Lo peligroso se pide dos veces.** `allow_dangerous` en la llamada **no
  basta**: hace falta que el humano haya puesto `mcp.permitir_peligroso: true`.
  Si no, se deniega y se explica. Nunca se queda esperando una aprobación que
  en un servidor MCP no existe: falla cerrado.
- **Claves.** Nunca se devuelven, nunca se escriben en el cuaderno, nunca van
  al agente cliente. El servidor las usa y hace la llamada. Además, el propio
  DSH lava el entorno de los shells de sus agentes
  (`dsh-subprocess`: `/KEY|PASSWORD|SECRET|TOKEN/i`), así que la tarea
  delegada tampoco las ve desde dentro. **De dónde salen:** del entorno del
  cliente MCP, y si no están ahí, de la casa —las que guardaste con
  Ajustes → Models—; de esas se encarga el motor, que es quien sabe leerlas.
  Este servidor no abre el fichero de claves ni para comprobar que existe.

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
  precios:                        # opcional: el core no trae precios de texto
    b-ai:
      deepseek-v4.1-flash:
        entrada_por_millon: 0.14
        salida_por_millon: 0.28
        moneda: EUR
```

El coste sólo aparece si lo declaras aquí. **RATACODE no se inventa precios**:
si no está, devuelve `null` y lo dice.

## Qué deja escrito

```
<casa>\mcp\
  estado.json       estado del servidor (para el panel y para --status)
  actividad.jsonl   una línea por tarea: hora, cliente, modelo, proveedor,
                    tarea (recortada), duración, tokens, coste, estado
  marcas.json       las marcas del tope de tareas por hora (sobreviven al reinicio)
  http-secret.txt   la clave del MCP por HTTP (sólo dueño)
  http-url.txt      la URL completa con la clave (sólo dueño)
  cloudflared.yml   la config del túnel nombrado, si se usa (sólo dueño)
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
# misma respuesta, sin get_task_status. Con --sin-entorno, el error del tropiezo 12.
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
completo con PONG. Con `--sin-entorno` se arranca el servidor sin pasarle el
entorno, para ver el `falta … en el entorno del cliente MCP`.

`prueba-cancelar-y-espacio.mjs` comprueba cuatro cosas por escrito: que
`list_providers` no enseña ninguna clave, que una carpeta fuera de los espacios
autorizados se rechaza, que `allow_dangerous` sin permiso de la casa se deniega
y que `cancel_task` deja la tarea en `cancelled` de verdad.

> Las dos pruebas escriben su carpeta de trabajo en `mcp/prueba/espacio` salvo
> que les pases `--espacio`. No tocan la casa salvo el cuaderno (`<casa>\mcp\`).

## Lo que falta (a propósito)

- **Del MCP:** nada de transporte. El stdio y el Streamable HTTP están hechos, y el túnel
  (`mcp/tunel.mjs`) también; las siete herramientas y sus topes, en marcha.
- **Del lanzador:** arranque/parada del MCP desde el panel con `MCP: ON/OFF`, la sección
  **Connections** en Ajustes (puerto, clientes, última actividad) y el botón que explique el MCP
  dentro de la web. Hoy eso se hace por línea de órdenes y se mira en `<casa>\mcp\`.
- **Y una frontera que no es nuestra:** la LECTURA de las tareas. DSH no la sabe acotar
  (mira «La LECTURA no se puede cerrar»), así que quien quiera encerrarla de verdad tiene que
  hacerlo por fuera del motor (un usuario de Windows distinto, una máquina virtual, permisos
  NTFS). Si algún día DSH trae raíces de lectura, esto se aprieta.
