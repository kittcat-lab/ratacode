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

```bash
npm i -g ratacode
```

Mientras el paquete no esté publicado en npm, se instala desde el repositorio:

```bash
npm i -g github:kittcat-lab/ratacode
```

Si esa falla (npm resuelve GitHub por git y en Windows puede atascarse con árboles
grandes: medido el 26-sep-2026), la vía comprobada es el tarball del propio repositorio:

```bash
git clone https://github.com/kittcat-lab/ratacode
cd ratacode && npm pack && npm i -g ./ratacode-0.1.0.tgz
```

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

## Las 3 formas de usarlo

1. **Navegador** — `ratacode`: la terminal en tu navegador, sin «Permitir» en cada paso
   (`danger-full-access` de fábrica). `--home` cambia la casa y `--open` abre el navegador.
2. **Headless** — `ratacode headless "encargo"`: mandas el encargo por terminal, sin
   pantalla, y la entrega queda en un fichero.
3. **MCP** — `ratacode mcp` (o `node mcp/bin/ratacode-mcp.js --home <casa>`): servidor MCP
   por stdio para Claude Code, Codex, ChatGPT web, Rowboat u OpenClaw. Herramientas:
   `list_models` → `run_task` → `get_task_status` → `get_task_result` → `cancel_task`.
   Alta típica: `claude mcp add ratacode -- ratacode mcp`.

Para manejar RATACODE desde otro chat sin ayuda, pega uno de los prompts de la carpeta
[`apreton`](https://github.com/kittcat-lab/ratacode) del repositorio (navegador, headless o MCP).

## Seguridad

- **Casa propia y cerrada.** Todo vive en `%USERPROFILE%\.ratacode` (nunca `~/.dsh` ni el
  DSH de nadie). Una tarea MCP trabaja SOLO dentro de su `working_directory`: el sandbox
  lo impone el core (`workspace-write` fijado) y lo que intenta escribir fuera falla.
- **Las claves no salen.** Nunca van dentro del paquete. El servidor MCP no lee ficheros
  de credenciales (solo mira el entorno que le entrega su cliente), las usa y no las
  devuelve ni las escribe en el cuaderno. DSH, además, lava el entorno de los shells de
  sus agentes (`/KEY|PASSWORD|SECRET|TOKEN/i`).
- **Nada hacia fuera por sí solo:** sin telemetría, sin cuentas; de tu PC solo sale lo que
  tus llamadas a tu proveedor de modelos.

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
- **Install (one command):** `npm i -g ratacode` — or, while it is not on npm yet,
  `npm i -g github:kittcat-lab/ratacode` (fallback: clone the repo, `npm pack` and
  `npm i -g ./ratacode-0.1.0.tgz`) — then run `ratacode`.
- **Bring your own keys:** `B_AI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` — set
  them in the web UI (Settings → Models) or as environment variables; they are never bundled.
- **Three ways to use it:** browser (`ratacode`), headless (`ratacode headless "task"`),
  and MCP (`ratacode mcp`) so ChatGPT web, Claude Code, Codex, Rowboat or OpenClaw can
  delegate tasks (`list_models`, `run_task`, `get_task_status`, `get_task_result`, `cancel_task`).
- **Security:** its own locked home (`%USERPROFILE%\.ratacode`, never `~/.dsh`), MCP tasks
  sandboxed to their `working_directory`, and keys that never leave your machine.
- **License:** MIT © 2026 Patxi. Built on top of DSH (`@deepseek-ai/dsh`, MIT).
