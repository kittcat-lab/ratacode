# RATACODE

**Manos baratas para tu agente o tu chat.** RATACODE es la terminal de trabajo bruto:
un DSH web (`@deepseek-ai/dsh`, MIT) con la cara de RATACODE —las ratas, las chispas,
los colores— puesta por un plugin que no toca ni el motor ni el frontend. Le mandas el
trabajo pesado y barato (B.AI, OpenRouter y DeepSeek vienen de fábrica) y el resultado
vuelve a tu agente o a tu chat.

## Requisitos

- **Windows** (la v1 solo está probada en Windows; Mac y Linux, después).
- **Node 24** — las dependencias nativas de la terminal (`node-pty`, `koffi`) necesitan
  que npm ejecute sus scripts de instalación.

## Instalación (un comando)

Mientras el paquete no esté publicado en npm, se instala desde la release de GitHub
(el `.tgz` que cuelga de ella; no hace falta ni git ni cuenta de npm):

```bash
npm i -g https://github.com/kittcat-lab/ratacode/releases/download/v0.1.0/ratacode-0.1.0.tgz
```

Cuando esté en npm, bastará con:

```bash
npm i -g ratacode
```

Último recurso, si la descarga falla: `git clone https://github.com/kittcat-lab/ratacode && cd ratacode && npm pack && npm i -g ./ratacode-0.1.0.tgz`.

Y para abrirla (lo mismo en los dos casos):

```bash
ratacode
```

Arranca DSH con la cara de RATACODE en el puerto **3777** (fijo y conocido; `--port` lo
cambia), imprime la URL **con su token** y la guarda en `<casa>\url.txt` — la de la vez
anterior se borra al arrancar y la nueva sólo se escribe **cuando el puerto ya escucha**.
Cada arranque y cada cierre del motor quedan apuntados en `<casa>\ratacode.log`, con su
código de salida y su señal (para saber por qué se cerró).

## Las 3 claves

Cada usuario pone las suyas; **nunca viajan dentro del paquete**:

| Variable | Proveedor |
|---|---|
| `B_AI_API_KEY` | B.AI (de fábrica, con `deepseek-v4.1-flash` y más modelos baratos) |
| `OPENROUTER_API_KEY` | OpenRouter |
| `DEEPSEEK_API_KEY` | DeepSeek (adaptador nativo de DSH) |

Se ponen en la web (**Ajustes → Models**; quedan en `<casa>\.credentials.yaml`) o
exportándolas como variables de entorno. La primera vez que abres RATACODE te las pide.

**Las claves del MCP.** El servidor MCP las mira en el **entorno del cliente** que lo arranca
(`B_AI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`); si no están ahí, deja que lo haga
**el motor**, que sí resuelve las guardadas con Ajustes → Models en la casa. En resumen: si has
guardado la clave en la web, `ratacode mcp` funciona sin exportar nada. Lo que este servidor no
hace nunca es abrir el fichero de claves él mismo. Alta típica con entorno explícito:
`claude mcp add ratacode -- ratacode mcp`.

## Las 3 formas de usarlo

1. **Navegador** — `ratacode`: la terminal en tu navegador, sin «Permitir» en cada paso
   (`danger-full-access` de fábrica). `--home` cambia la casa y `--open` abre el navegador.
2. **Headless** — `ratacode headless "encargo"`: mandas el encargo por terminal, sin
   pantalla, y la entrega queda en un fichero.
3. **MCP** — `ratacode mcp` (o `node mcp/bin/ratacode-mcp.js --home <casa>`): servidor MCP
   por stdio para Claude Code, Codex, ChatGPT web, Rowboat u OpenClaw. Siete herramientas:
   `list_providers` → `list_models` → `run_task` → `get_task_status` → `get_task_result` →
   `cancel_task` y `ratacode_status`. Por HTTP (para ChatGPT web) hace falta
   `ratacode mcp --http --acepto-lectura-total` y `mcp.workspaces` declarado; el túnel es
   `node mcp/tunel.mjs --home <casa> --acepto-lectura-total` (puerto por defecto del MCP: 3778).

> El panel es DSH con la piel de RATACODE puesta: los rótulos propios y la ventana de las claves
> están en español, pero Ajustes → Models y los menús del motor siguen en inglés (los pone DSH,
> y RATACODE no reescribe el frontend a propósito).

Para manejar RATACODE desde otro chat sin ayuda, pega uno de los prompts de la carpeta
[`apreton`](https://github.com/kittcat-lab/ratacode) del repositorio (navegador, headless o MCP).

## Seguridad

- **Casa propia y cerrada.** Todo vive en `%USERPROFILE%\.ratacode` (nunca `~/.dsh` ni el
  DSH de nadie). Una tarea MCP **solo ESCRIBE** dentro de su `working_directory`: el sandbox
  lo impone el core (`workspace-write` fijado) y lo que intenta escribir fuera falla.
- **Pero puede LEER todo tu PC.** El motor no tiene ningún modo que acote la lectura: el
  vocabulario del sandbox (`read-only` · `workspace-write` · `danger-full-access`) es de
  ESCRITURA, y `dsh-fs-sandbox/lib/types/index.d.ts:7-8` lo dice con todas las letras —
  *«Reads pass through untouched: every mode permits reading»*. Una tarea MCP puede leer
  cualquier fichero que puedas leer tú (incluido `<casa>\.credentials.yaml` y tu `.ssh`), y
  lo que lea viaja al proveedor del modelo. Por eso `ratacode mcp --http` y `mcp/tunel.mjs`
  **no arrancan** sin `--acepto-lectura-total`: abrir esa URL a Internet es abrir tu disco a
  quien tenga la URL.
- **Las claves no salen.** Nunca van dentro del paquete. El servidor MCP no lee ficheros
  de credenciales (solo mira el entorno que le entrega su cliente), las usa y no las
  devuelve ni las escribe en el cuaderno. DSH, además, lava el entorno de los shells de
  sus agentes (`/KEY|PASSWORD|SECRET|TOKEN/i`). Ojo: eso no impide que una tarea LEA el
  fichero de claves (punto anterior).
- **Nada hacia fuera por sí solo:** sin telemetría, sin cuentas; de tu PC solo sale lo que
  tus llamadas a tu proveedor de modelos.

## Desinstalar y borrar datos

Nada de RATACODE queda fuera de estas dos cosas: el paquete y la casa.

```bash
# 1. El programa (y su comando `ratacode`)
npm uninstall -g ratacode

# 2. La casa: ajustes, claves, perfiles, sesiones y registros
#    (en Windows, la carpeta por defecto; si usaste --home, la que le dijeras)
rmdir /s /q "%USERPROFILE%\.ratacode"
#   PowerShell:  Remove-Item -Recurse -Force "$env:USERPROFILE\.ratacode"
#   Mac/Linux:   rm -rf ~/.ratacode
```

Dentro de esa carpeta van, en claro, **tus claves** (`<casa>\.credentials.yaml`), la clave del
MCP por HTTP (`<casa>\mcp\http-secret.txt`), la URL del panel con su token (`<casa>\url.txt`),
los ajustes (`<casa>\settings.yaml`) y los perfiles con la piel copiada. Borrar la carpeta lo
borra todo; no hay nada más que limpiar (RATACODE nunca escribe en `~/.dsh`, y si algún día
exportaste `B_AI_API_KEY` en tu shell, eso se quita de tu perfil de shell).

## Licencia y créditos

MIT © 2026 **Patxi** (ver [`LICENSE`](LICENSE)).

RATACODE es una piel sobre **DSH** — DeepSeek Harness (`@deepseek-ai/dsh`, MIT) — que es
quien hace el trabajo de verdad. Gracias por dejarla engancharse sin tocar nada.

---

### English summary

**RATACODE — cheap hands for your agent or your chat.** A web DSH terminal
(`@deepseek-ai/dsh`, MIT) wearing the RATACODE skin. Send heavy work to cheap models
(B.AI, OpenRouter, DeepSeek) and get the result back in your agent or chat.

- **Requires:** Windows and Node 24.
- **Install (one command):** `npm i -g https://github.com/kittcat-lab/ratacode/releases/download/v0.1.0/ratacode-0.1.0.tgz`
  — the release tarball, no git and no npm account needed; once it is on npm, `npm i -g ratacode`
  (last resort: `git clone` the repo, `npm pack` and `npm i -g ./ratacode-0.1.0.tgz`) — then run `ratacode`.
- **Bring your own keys:** `B_AI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` — set
  them in the web UI (Settings → Models) or as environment variables; they are never bundled.
  The MCP server reads them from its client's environment, or lets the engine resolve the ones
  you saved in the web UI.
- **Three ways to use it:** browser (`ratacode`), headless (`ratacode headless "task"`),
  and MCP (`ratacode mcp`) so ChatGPT web, Claude Code, Codex, Rowboat or OpenClaw can
  delegate tasks (`list_models`, `run_task`, `get_task_status`, `get_task_result`, `cancel_task`).
- **Security:** its own locked home (`%USERPROFILE%\.ratacode`, never `~/.dsh`); MCP tasks can only
  **WRITE** inside their `working_directory` but can **READ** any file your user can read (the engine
  cannot fence reads: `dsh-fs-sandbox`, *"Reads pass through untouched: every mode permits reading"*),
  so the HTTP transport and the tunnel refuse to start without `--acepto-lectura-total`; and the keys
  never travel inside the package.
- **Uninstall:** `npm uninstall -g ratacode`, then delete the home folder
  (`%USERPROFILE%\.ratacode`; `rm -rf ~/.ratacode` on Mac/Linux). That folder holds your keys
  (`.credentials.yaml`), the MCP key (`mcp\http-secret.txt`) and the panel URL with its token
  (`url.txt`); nothing else is written anywhere (never `~/.dsh`).
- **License:** MIT © 2026 Patxi. Built on top of DSH (`@deepseek-ai/dsh`, MIT).
