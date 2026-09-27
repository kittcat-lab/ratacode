# MCP: cómo conectar tu app a RATACODE

RATACODE es un DSH con la cara de RATACODE. El MCP (Model Context Protocol) deja que cualquier app con MCP (Claude Code, Codex, OpenClaw, Rowboat, ChatGPT web con túnel) le mande trabajo a los modelos que ya tienes configurados en RATACODE. Los modelos baratos hacen el trabajo; tú planificas, revisas y cierras.

## Cómo darlo de alta (por app)

El servidor es `ratacode mcp` (subcomando del mismo binario). Si `ratacode` no está en el PATH,
usa `node <ruta>\bin\ratacode.js mcp`.

Las claves van por el ENTORNO del cliente. Sustituye `<tu-clave>` por la tuya y `<casa>` por tu
casa (`%USERPROFILE%\.ratacode` si no le has dicho otra cosa con `--home`).

### Claude Code — COMPROBADO
Documentación oficial: <https://code.claude.com/docs/en/mcp> (opción 3, servidor stdio local).
`--env` acepta varios `CLAVE=valor`, y **entre el último `--env` y el nombre del servidor tiene que
ir otra opción** (`--transport stdio`): si no, Claude Code lee el nombre como otro par y lo rechaza.
Todo lo que va detrás de `--` es el comando del servidor, sin tocarlo.

```sh
claude mcp add --env B_AI_API_KEY=<tu-clave> --env OPENROUTER_API_KEY=<tu-clave> --transport stdio ratacode -- ratacode mcp
```

Claude Code SÍ le pasa al servidor su propio entorno (comprobado el 26-sep con `claude -p --mcp-config`),
así que la clave que tengas exportada llega. Lo que NO hay que hacer es terminar el turno con la tarea
en marcha: por stdio el servidor vive lo que vive el cliente (mira «La regla del tropiezo 17», abajo).

### Codex — COMPROBADO
Documentación oficial: <https://learn.chatgpt.com/docs/extend/mcp> (Codex CLI → *Configure with the CLI*).
`codex mcp add … --env CLAVE=valor` funciona, pero **escribe la clave dentro de
`~/.codex/config.toml`**. Mejor `env_vars`: Codex copia al servidor esas variables de SU entorno,
y la clave no queda escrita en ningún fichero (comprobado el 26-sep:
`codex exec -c "mcp_servers.ratacode.env_vars=['B_AI_API_KEY']"` → COMPLETED).

```toml
[mcp_servers.ratacode]
command = "ratacode"
args = ["mcp"]

# La clave NO se escribe aquí: se copia del entorno de Codex al servidor MCP.
env_vars = ["B_AI_API_KEY", "OPENROUTER_API_KEY"]
```

**Codex y las aprobaciones.** Codex no ejecuta herramientas MCP con la política de aprobación en
«never»: sale `MCP tool call requires approval, but approval policy is never`, y el encargo no llega
a RATACODE. Se arregla aprobando: `codex exec --approve-for-me "…"` (comprobado el 26-sep), o
aprobando la herramienta en la sesión interactiva. Sin una de las dos cosas, Codex se queda mirando.

### OpenClaw — COMPROBADO
Documentación oficial: <https://docs.openclaw.ai/cli/mcp/registry>. Aquí no hay `--`: cada cosa va
con su bandera (`--command`, un `--arg` por argumento, `--env CLAVE=valor`, `--cwd`).

```sh
openclaw mcp add ratacode --command ratacode --arg mcp --env B_AI_API_KEY=<tu-clave> --env OPENROUTER_API_KEY=<tu-clave>
```

### Rowboat — SOSPECHA
Lo único que dice la documentación oficial (<https://github.com/rowboatlabs/rowboat>, *Extend Rowboat
with tools (MCP)*) es: **Settings → MCP Servers**, añadir la entrada al objeto `mcpServers` y *Save*.
El ejemplo que publican es de un servidor HTTP (`url`), así que **no está comprobado que su editor
acepte un servidor stdio** con `command`/`args`/`env`. Si lo acepta, la entrada sería:

```json
{
  "mcpServers": {
    "ratacode": {
      "command": "ratacode",
      "args": ["mcp"],
      "env": {
        "B_AI_API_KEY": "<tu-clave>",
        "OPENROUTER_API_KEY": "<tu-clave>"
      }
    }
  }
}
```

**SOSPECHA:** no he encontrado un `rowboat mcp add` por línea de órdenes ni un fichero de
configuración documentado; compruébalo en tu versión de Rowboat.

### Genérico (cualquier cliente MCP por stdio)
Añade esto a la configuración MCP de tu app:

```json
{
  "mcpServers": {
    "ratacode": {
      "command": "ratacode",
      "args": [
        "mcp",
        "--home",
        "C:\\Users\\tu-usuario\\.ratacode"
      ],
      "env": {
        "B_AI_API_KEY": "<tu-clave>",
        "OPENROUTER_API_KEY": "<tu-clave>"
      }
    }
  }
}
```

**Las claves van por el ENTORNO.** El servidor no lee ficheros de claves. Si falta una, se para y dice: `falta B_AI_API_KEY en el entorno del cliente MCP`. Si tu cliente no pasa el entorno, el servidor no tiene credenciales. Si tu app sabe copiar variables del entorno (como `env_vars` de Codex), úsalo: la clave no queda escrita en la configuración.

## Lo que una tarea puede LEER (y por qué el HTTP pide permiso)

Escríbelo en tu cabeza antes de abrir el túnel: **una tarea MCP escribe solo dentro de su espacio
autorizado, pero LEE lo que quiera**. No es un descuido de RATACODE: el motor (DSH) no tiene ningún
modo que acote la lectura —`read-only`, `workspace-write` y `danger-full-access` son ejes de
ESCRITURA (`dsh-fs-sandbox/lib/types/index.d.ts:7-8`: «Reads pass through untouched: every mode permits
reading»)—, y su sandbox de Windows restringe el token a la escritura («`WRITE_RESTRICTED` intersects
only write accesses», `dsh-sandbox-windows-acl/lib/types/index.d.ts:24-25`). Ni las herramientas de
ficheros ni el shell tienen lista blanca de lectura.

Consecuencias, claras:

- Una tarea puede leer `<casa>\.credentials.yaml`, tu `.ssh` o tus documentos, y lo que lea **viaja al
  proveedor del modelo** que hayas elegido. No le mandes encargos que vayan a buscar claves.
- Por eso `ratacode mcp --http` y `node mcp/tunel.mjs` **no arrancan** sin `--acepto-lectura-total`:
  abrir la URL (o el túnel) es abrir tu disco a quien tenga esa URL.
- Por stdio la superficie la controlas tú (es tu propio cliente local el que arranca el servidor), y
  no hace falta aceptar nada.
- Si quieres cerrarlo de verdad, la frontera tiene que ser del sistema operativo (un usuario o una
  máquina virtual solo para esto), no del motor.

## Cómo usarlo

1. **`list_models`** — llama primero para ver qué modelos hay, con proveedor, id, contexto, capacidades y estado.
2. **`run_task`** — lanza el encargo. Sin `esperar_segundos` devuelve `task_id` al momento y el trabajo sigue en segundo plano. **Con `esperar_segundos` (1-600), la llamada ESPERA y devuelve el resultado completo en esa misma respuesta**, sin llamar a nada más.
3. **`get_task_status`** — consulta el estado: `queued`, `running`, `completed`, `failed`, `cancelled`.
4. **`get_task_result`** — recoge la respuesta, modelo, proveedor, tokens, coste (si está declarado), duración y errores.

**Si el usuario eligió un modelo, no lo cambies.** Si no eligió, se usa el modelo por defecto de la casa y se te dice cuál.

### La regla del tropiezo 17: no dejes la tarea a medias

Por stdio, **las tareas viven lo que vive el cliente**: si el cliente se cierra, el servidor se va y la
tarea muere donde esté (así quedó un `hola.txt` con un «hola» y nada más: el cliente había terminado su
turno con «despiertas en 60 s», y a los 60 s ya no había nadie). Con un cliente de una sola vuelta
(`claude -p`, `codex exec`, una llamada suelta), haz UNA de estas dos cosas:

- lanza `run_task` **con `esperar_segundos`** (p. ej. 300) y recoge el resultado de esa misma respuesta; o
- **no termines tu turno hasta que `get_task_status` diga `completed` o `failed`**.

Con `esperar_segundos`, si la tarea no acaba dentro del plazo, la respuesta lo dice (`espera.agotada:
true`) y queda el `task_id` para seguir preguntando. El máximo son 600 s (10 minutos); si tu cliente
corta las llamadas largas antes, usa un valor por debajo de ese corte.

## Cómo escribir un encargo
Usa esta plantilla (funcionó a la primera):

```
Soy [tu nombre], [tu rol]. Lee [fichero o carpeta].
LÍMITES: escribe SOLO en [carpeta]. [Lo que NO toques]. No leas ficheros de credenciales. Sin git, sin publicar.
TAREA:
1) [Primer paso]
2) [Segundo paso]
3) ...
Comprueba cada paso o marca SOSPECHA.
ENTREGA: [fichero con tope de líneas].
HAZLO sin pedir permiso.
```

## Cómo comprobar que llegó
- Con `esperar_segundos`, la respuesta de `run_task` ya trae `estado` y el `resultado` completo: si `estado` es `completed`, no hay nada más que preguntar.
- `get_task_status` pasa de `queued` a `running` a `completed`.
- `get_task_result` devuelve la respuesta con tokens y duración.
- Si falla, `get_task_result` devuelve el error.

## Cómo vigilar sin capturas
No mires la pantalla. Usa `get_task_status` y `get_task_result` directamente. Un captura gasta cuota; una llamada MCP no.

## Trampas que ya costaron (tropiezos 2, 4, 6, 7, 11, 12, 13, 16, 17, 18)

- **T2 · Espacio de trabajo:** el servidor arranca con `--home <casa>`; el espacio ya viene puesto.
- **T4 · Capturas gastan cuota:** usa `get_task_result`, no capturas de pantalla.
- **T6 · No aplica:** en MCP no hay caja de chat.
- **T7 · No aplica:** en MCP no hay caja de chat.
- **T11 · Credenciales:** nunca leas `.credentials.yaml`, `.env` ni bóvedas. Si falta una clave, el servidor se para y lo dice.
- **T12 · El entorno del cliente:** si tu app no le pasa el entorno al servidor MCP, la llamada sale con `falta B_AI_API_KEY en el entorno del cliente MCP`. Dilo al darlo de alta (Claude Code: `--env`; Codex: `env_vars`). No vayas a buscar la clave a ningún fichero.
- **T13 · Tutor equivocado:** si el tutor dice algo falso, corrígelo con la prueba (fichero:línea); no obedezcas una premisa falsa.
- **T16 · No aplica:** el MCP no usa `url.txt` (eso es el panel). Aquí no hay URL que caduque.
- **T17 · Cliente de una sola vuelta:** no termines el turno con la tarea en marcha. Usa `run_task` con `esperar_segundos`, o no pares hasta que `get_task_status` diga `completed`/`failed`. Por stdio la tarea vive lo que vive el cliente.
- **T18 · Un encargo grande, en sesión nueva:** cada tarea del MCP es una sesión nueva del motor (no arrastra historial), pero TU chat acumula: con muchos turnos y pasos, el proveedor acaba devolviendo un 400 (`read body failed`). Encargos en fichero y chat nuevo cuando toque.

## El ciclo (diagnóstico → revisión → arreglo → cierre)

1. **Diagnóstico** (tu sesión MCP): solo mirar, sin tocar ficheros. Lee lo que te den, pasa pruebas, busca fallos y comprueba cada uno. Lo no comprobado, SOSPECHA.
2. **Revisión** (tú): comprueba los fallos que más pesen. Marca falsos positivos.
3. **Arreglo** (tu sesión MCP): de uno en uno, cambio mínimo, misma prueba antes/después. Sin commit.
4. **Cierre** (tú): lee el diff, repite la prueba, abre la app y lo ve. Commit solo si toca.

**No arranques servidores. No publiques. Si falta algo, dilo.**