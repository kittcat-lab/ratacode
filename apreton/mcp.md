# MCP: cómo conectar tu app a RATACODE

RATACODE es una terminal de trabajo con IA con la cara de RATACODE, montada sobre un motor libre que no se toca. El MCP (Model Context Protocol) deja que cualquier app con MCP (Claude Code, Codex, OpenClaw, Rowboat, ChatGPT web con túnel) le mande trabajo a los modelos que ya tienes configurados en RATACODE —incluidos los locales, con Ollama o LM Studio—. Los modelos baratos hacen el trabajo; tú planificas, revisas y cierras.

**Es la vía recomendada** para cualquier app que hable MCP: cuesta menos que mirar la pantalla (dos llamadas y texto, sin capturas), tiene estado explícito (`run_task` con `esperar_segundos` + `get_task_status`) y **cada tarea sale en la barra lateral del panel**, con su conversación.

## Cómo darlo de alta (por app)

El servidor es `ratacode mcp` (subcomando del mismo binario). Si `ratacode` no está en el PATH,
usa `node <ruta>\bin\ratacode.js mcp`.

**Las claves NO van por aquí.** Están en un solo sitio —RATACODE › Ajustes › Models— y el MCP las
lee de ahí (preguntándole al motor). No hay que pasarle ninguna variable de entorno: su alta es
`ratacode mcp` y nada más. `<casa>` es tu casa (`%USERPROFILE%\.ratacode` si no le has dicho otra
cosa con `--home`).

### Claude Code — COMPROBADO
Documentación oficial: <https://code.claude.com/docs/en/mcp> (opción 3, servidor stdio local).
Todo lo que va detrás de `--` es el comando del servidor, sin tocarlo.

```sh
claude mcp add --transport stdio ratacode -- ratacode mcp
```

Lo que NO hay que hacer es terminar el turno con la tarea en marcha: por stdio el servidor vive lo
que vive el cliente (mira «La regla del tropiezo 17», abajo).

### Codex — COMPROBADO
Documentación oficial: <https://learn.chatgpt.com/docs/extend/mcp> (Codex CLI → *Configure with the CLI*).

```toml
[mcp_servers.ratacode]
command = "ratacode"
args = ["mcp"]
```

Ni `--env` ni `env_vars`: la clave no se le pasa al servidor, se lee de Ajustes › Models.

**Codex y las aprobaciones.** Codex no ejecuta herramientas MCP con la política de aprobación en
«never»: sale `MCP tool call requires approval, but approval policy is never`, y el encargo no llega
a RATACODE. Se arregla aprobando: `codex exec --approve-for-me "…"` (comprobado el 26-sep), o
aprobando la herramienta en la sesión interactiva. Sin una de las dos cosas, Codex se queda mirando.

### OpenClaw — COMPROBADO
Documentación oficial: <https://docs.openclaw.ai/cli/mcp/registry>. Aquí no hay `--`: cada cosa va
con su bandera (`--command`, un `--arg` por argumento, `--cwd`).

```sh
openclaw mcp add ratacode --command ratacode --arg mcp
```

### Rowboat — SOSPECHA
Lo único que dice la documentación oficial (<https://github.com/rowboatlabs/rowboat>, *Extend Rowboat
with tools (MCP)*) es: **Settings → MCP Servers**, añadir la entrada al objeto `mcpServers` y *Save*.
El ejemplo que publican es de un servidor HTTP (`url`), así que **no está comprobado que su editor
acepte un servidor stdio** con `command`/`args`. Si lo acepta, la entrada sería:

```json
{
  "mcpServers": {
    "ratacode": {
      "command": "ratacode",
      "args": ["mcp"]
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
      ]
    }
  }
}
```

**Las claves están en la casa, no en tu entorno.** El servidor no mira las variables del cliente ni
abre ficheros de claves: le pregunta al motor si la credencial de esa ruta está puesta. Si no lo
está, se para y dice: `Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.`

## Lo que una tarea puede LEER (y por qué el HTTP pide permiso)

Escríbelo en tu cabeza antes de abrir el túnel: **una tarea MCP lee y escribe solo dentro de las
carpetas que tú autorizas** (`mcp.workspaces`). No es un descuido del motor: DSH no tiene ningún
modo que acote la lectura —`read-only`, `workspace-write` y `danger-full-access` son ejes de
ESCRITURA, y su propio código lo dice: «Reads pass through untouched: every mode permits
reading»—, y su encierre de Windows restringe el token a la escritura («`WRITE_RESTRICTED`
intersects only write accesses»). Por eso la lectura la encierra RATACODE, con el gancho
`tools/pre-execute` del motor: cada herramienta que lleve una ruta fuera de tus carpetas se para
y el agente ve una línea: «Fuera de la carpeta autorizada: `<ruta>`».

Y no hay puertas por detrás: en una tarea del MCP no hay terminal, ni trabajos en segundo plano,
ni red, ni subagentes, ni guiones.

Consecuencias, claras:

- Lo que la tarea lea **viaja al proveedor del modelo** que hayas elegido, así que la carpeta
  autorizada es, de verdad, todo lo que ese chat puede ver. No pongas ahí claves de otros sitios.
- `ratacode mcp --http` y `node mcp/tunel.mjs` **ya no piden nada**: antes exigían
  `--acepto-lectura-total` porque la lectura no estaba encerrada; desde R25 sí lo está, y esa
  bandera se acepta como no-op (para no romper los comandos viejos).
- Por stdio, igual: la superficie la controlas tú (es tu propio cliente local el que arranca el
  servidor).
- Si además quieres aislarlo del sistema operativo (un usuario o una máquina virtual solo para
  esto), mejor: son dos cierres, no uno.

## ChatGPT web (y cualquier app que hable MCP por HTTP): el túnel

ChatGPT web no arranca procesos: necesita una **URL** de MCP por HTTP. Por eso existe
`mcp/tunel.mjs`: expone el MCP de tu PC a Internet con Cloudflare mientras corre.

```sh
# 1) el MCP por HTTP (local), con espacios declarados en `mcp.workspaces`
ratacode mcp --http

# 2) el túnel, en otra ventana
node mcp/tunel.mjs --home <casa>
```

`tunel.mjs` te imprime la **URL pública completa** (dominio + `/mcp/<clave>`): esa es la que se
pega en ChatGPT (modo desarrollador → conector MCP) o en la app que sea. Al abrirlo **estrena
clave** (el servidor que ya corre la adopta sin reiniciar; con `--misma-clave` reutiliza la
anterior). La clave vive en `<casa>\mcp\http-url.txt` y `<casa>\mcp\http-secret.txt`, con permisos
de sólo-dueño; no se imprime en los registros. Con `Ctrl+C` se cierra el túnel y el puerto deja de
estar expuesto.

Si tienes dado de alta el túnel nombrado `mcp.mod-rat.com` en tu Cloudflare, lo usa con ese
hostname fijo (por fichero de configuración, nunca pasando la URL por argumentos); si no, abre un
quick tunnel con URL efímera.

**Lo que implica abrirlo:** el túnel expone el MCP a Internet, así que quien tenga esa URL puede
mandar tareas. Lo que **no** puede es salirse de tus carpetas: la tarea lee y escribe solo dentro
de `mcp.workspaces` y no tiene terminal ni red (mira el apartado de arriba). No lo dejes abierto
más de lo que dure el trabajo, y cámbiale la clave (basta con volver a lanzar `tunel.mjs`) cuando
cierres.

**Rowboat.** Su editor documenta servidores por `url`, no por `command`; con el túnel o con el MCP
por HTTP puedes darle la URL con la clave y no depender de que acepte un servidor stdio (que es lo
que sigue sin estar comprobado, ver arriba).

## ChatGPT web con TU cuenta (Pro): conector propio, sólo lectura (R26)

Con la cuenta de ChatGPT (plan Pro) sí se puede tener el MCP propio: se llama **modo desarrollador**
y se activa en ChatGPT › **Ajustes › Seguridad e inicio de sesión › Modo desarrollador** (en
Enterprise/Edu lo concede un administrador; la política por plan está en el
[artículo de ayuda de OpenAI](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta)).
Después se crea el conector en **ChatGPT › Plugins** (`https://chatgpt.com/plugins`) → **+** →
nombre y descripción → en **Conexión**, la **URL pública** del MCP.

Tres cosas que conviene saber antes de pelearse con la URL:

- **ChatGPT no acepta claves propias.** No puede mandar `Authorization: Bearer <tu-clave>` ni una
  cabecera inventada ([docs de autenticación](https://developers.openai.com/plugins/build/auth):
  «ChatGPT does **not** support … custom API keys»). Por eso la clave va **dentro de la URL**, que
  es una URL-capacidad: quien la tenga, entra. El MCP la admite en la ruta (`/mcp/<clave>`, la de
  siempre), en la consulta (`/mcp?clave=<clave>`) o en la cabecera `Bearer`, por si un cliente no
  traga con una de las tres.
- **`localhost` no le sirve a ChatGPT**: hay que exponerlo. O con el túnel público de siempre
  (`node mcp/tunel.mjs`, abajo), o con el **Secure MCP Tunnel** de OpenAI
  ([guía](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)), que pide un
  `tunnel_id` de la Platform y `tunnel-client`. **El túnel lo enciende el humano, no RATACODE.**
- **Con Pro, sólo lectura.** El MCP publica ahora tres herramientas de sólo lectura, marcadas como
  tales (`readOnlyHint: true`, que es la marca que documenta OpenAI): `ratacode_status` (estado,
  versión, carpetas autorizadas, herramientas y sesiones), `list_files` (listar una carpeta
  autorizada) y `read_file` (leer un fichero de dentro). No gastan claves ni tokens, y el cerco de
  la ruta lo comprueba **el servidor**, con el mismo `lib/lectura.js` de las tareas.

> **`CHATGPT_PRO_WRITE = NO DISPONIBLE POR PLAN`.** `run_task` y `cancel_task` siguen ahí y siguen
> funcionando por stdio y por HTTP, pero un conector de ChatGPT Pro no puede usarlas: el plan sólo
> habilita herramientas que no cambian nada. Para mandar trabajo, usa Codex, Claude Code o el propio
> panel de RATACODE.

Lo que se puede pedirle a ChatGPT, entonces: «consulta RATACODE y dime qué hay en la carpeta
autorizada», «léeme `notas.md` de ahí». Y lo que NO puede: nada de fuera de `mcp.workspaces` —ni
por `..`, ni por ruta absoluta, ni por una unión de Windows, ni por el nombre corto 8.3, ni por
`\\?\`, ni con una variable de entorno—, ni traerse las instrucciones `AGENTS.md` o las habilidades
de carpetas de arriba (eso se apaga en cada tarea desde R26; mira «Lo que una tarea puede LEER»).

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
No mires la pantalla. Usa `get_task_status` y `get_task_result` directamente. Una captura gasta cuota; una llamada MCP no.

## Trampas que ya costaron (tropiezos 2, 4, 6, 7, 11, 12, 13, 16, 17, 18)

- **T2 · Espacio de trabajo:** el servidor arranca con `--home <casa>`; el espacio ya viene puesto.
- **T4 · Capturas gastan cuota:** usa `get_task_result`, no capturas de pantalla.
- **T6 · No aplica:** en MCP no hay caja de chat.
- **T7 · No aplica:** en MCP no hay caja de chat.
- **T11 · Credenciales:** nunca leas `.credentials.yaml`, `.env` ni bóvedas. Si falta una clave, el servidor se para y lo dice.
- **T12 · Las claves NO van por el entorno:** están en RATACODE › Ajustes › Models, y el MCP las lee de ahí. Si falta una, la llamada sale con `Falta la clave de <proveedor>. Pégala en RATACODE › Ajustes › Models.` No hay que pasarle ninguna variable al servidor, y la clave NO se escribe en la configuración de tu app.
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