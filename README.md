# RATACODE

**Manos baratas para tu agente o tu chat.** RATACODE es la terminal de trabajo bruto:
una terminal de trabajo con IA con la cara de RATACODE —las ratas, las chispas,
los colores— montada sobre un motor libre que no se toca. Le mandas el
trabajo pesado y barato (B.AI, OpenRouter, DeepSeek, cinco proveedores gratuitos y
**dos modelos locales sin clave ni coste** vienen de fábrica) y el resultado vuelve a tu
agente o a tu chat.

**La web:** <https://kittcat.com/ratacode/> — la página del producto, con el botón que
copia el prompt de instalación y lo cuenta en corto.

## Qué trae la 0.2.0

- **Los 9 modos de casa** (MODO-RATA, ARQUITECTO, CAPATAZ, HERO, TIRITA, GEPETO, FARO,
  PIX y NEX) en el selector, con MODO-RATA por defecto y **sin los modos de serie del
  motor**: una casa vieja se pone al día sola al arrancar.
- **Modelos locales de serie, sin clave:** Ollama y LM Studio tienen **su propia pestaña
  en Ajustes → «Modelos locales»** (si están encendidos, qué modelos tienes y cuáles valen
  como agente, su dirección, cómo encenderlos y la tabla «qué modelo local según tu
  tarjeta»). Ajustes → Models se queda para las **8 APIs con clave**.
- **Cada tarea MCP se ve en la barra lateral del panel**, con su conversación: el MCP
  deja de ser una caja negra.
- **La instalación, en un comando:** `npm i -g ratacode`.
- Fuera el nombre del motor de todo lo que ve el usuario (panel, ayuda y mensajes).

## Qué trae la 0.2.1

- **Las claves, en un solo sitio y editables:** la única fuente es **Ajustes → Models** (la
  casa). El motor y el MCP arrancan **sin** las variables de claves de Windows, así que el
  campo de cada proveedor siempre se puede pegar y editar en la web.
- **El MCP deja de mirar el entorno de tu chat:** le pregunta al motor si la credencial está
  puesta en la casa. Si no lo está, dice
  `Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.` Y las altas de MCP
  (Claude Code, Codex, OpenClaw…) ya no llevan `--env` ni `env_vars`: sólo `ratacode mcp`.
- **Arreglado el arranque de una casa de la 0.1:** si su `cordis.patch.yml` se quedó roto (un
  `[]` pegado delante de las filas, de la 0.2.0), se repara solo al arrancar y el motor no se
  cae al leer el overlay.
- **Aviso de migración, una vez:** si tienes variables de claves de proveedores en Windows, el
  panel te lo recuerda en una línea —«RATACODE ya no la usa: pega tu clave en Ajustes ›
  Models»— con su botón de cerrar. No copia ninguna clave y no vuelve.

## Requisitos

- **Windows** (la v1 solo está probada en Windows; Mac y Linux, después).
- **Node 24** — las dependencias nativas de la terminal (`node-pty`, `koffi`) necesitan
  que npm ejecute sus scripts de instalación.

## Instalación (un comando)

```bash
npm i -g ratacode
```

> **Los avisos amarillos de npm 11 al instalar son normales.** npm 11 frena los scripts
> de instalación de las dependencias nativas de la terminal y avisa con
> «allow-scripts» / «Ignored build scripts». Ese aviso **no impide que RATACODE funcione**:
> el paquete ya declara las que hacen falta (`allowScripts` en su `package.json`) y sus
> binarios vienen precompilados para Node 24.

Alternativa, si npm te falla o quieres una versión concreta: la **release de GitHub**
(el `.tgz` que cuelga de ella; no hace falta ni git ni cuenta de npm):

```bash
npm i -g https://github.com/kittcat-lab/ratacode/releases/download/v0.2.0/ratacode-0.2.0.tgz
```

Último recurso, si la descarga falla: `git clone https://github.com/kittcat-lab/ratacode && cd ratacode && npm pack && npm i -g ./ratacode-0.2.0.tgz`.

Y para abrirla (lo mismo en los tres casos):

```bash
ratacode
```

Arranca el panel con la cara de RATACODE en el puerto **3777** (fijo y conocido; `--port` lo
cambia), imprime la URL **con su token** y la guarda en `<casa>\url.txt` — la de la vez
anterior se borra al arrancar y la nueva sólo se escribe **cuando el puerto ya escucha**.
Cada arranque y cada cierre del motor quedan apuntados en `<casa>\ratacode.log`, con su
código de salida y su señal (para saber por qué se cerró).

## Las claves: Ajustes → Models (ocho APIs de fábrica)

Cada usuario pone las suyas; **nunca viajan dentro del paquete**. Se ponen donde el motor
las pone siempre: en la web, **Ajustes → Models**, con el campo «API key» de cada proveedor
(quedan en `<casa>\.credentials.yaml`), o exportando su variable de entorno. RATACODE trae
**ocho APIs** ya declaradas (los dos motores locales, que no piden clave, están en
**Ajustes → «Modelos locales»**):

| Proveedor | Variable | Notas |
|---|---|---|
| B.AI | `B_AI_API_KEY` | de fábrica, con `deepseek-v4.1-flash` y más modelos baratos |
| OpenRouter | `OPENROUTER_API_KEY` | |
| DeepSeek | `DEEPSEEK_API_KEY` | adaptador nativo del motor (`deepseek-official`) |
| Groq | `GROQ_API_KEY` | gratis (30 RPM / 1.000 RPD); `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` |
| Google Gemini | `GEMINI_API_KEY` | gratis, pero **entrena con tus datos**: no lo uses con código confidencial |
| NVIDIA NIM | `NVIDIA_API_KEY` | gratis sólo para prototipar; uso comercial prohibido sin licencia |
| SambaNova | `SAMBANOVA_API_KEY` | gratis permanente (20 RPM / 20 RPD / 200K TPD) |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` | **cambia `{account_id}` a mano**: Ajustes → Models → ese proveedor → *Customized settings* → **Base URL** |
| **Ollama (local)** | *ninguna* | `http://127.0.0.1:11434/v1`, sin clave y sin coste ([ollama.com/download](https://ollama.com/download)) |
| **LM Studio (local)** | *ninguna* | `http://127.0.0.1:1234/v1`, sin clave (`lms server start`); pon el id que devuelva `GET /v1/models` |

Los dos locales **no piden clave**: van declarados sin credencial y el motor deja la ruta
sin autenticar. Nada sale de tu ordenador cuando trabajas con ellos, y por eso **no salen
en Ajustes → Models**: tienen su pestaña, **Ajustes → «Modelos locales»**, donde se ve si
están encendidos, qué modelos tienes, cuáles valen como agente, su dirección (y cómo
cambiarla si usas otro puerto) y el enlace de descarga.

### Qué modelo local según tu tarjeta

Bájalo con `ollama pull <id>` y elígelo en el selector de modelos de la caja. Medido en el
informe R15 (tool calling = que el modelo sepa **usar** las herramientas, no sólo hablar):

| Tu tarjeta | Modelo (`ollama pull`) | Tamaño | Por qué ése |
|---|---|---|---|
| **8 GB** | `qwen3:8b` | 5,2 GB | la mejor evidencia independiente de uso de herramientas (F1 0,919 en el banco de Docker; medido aquí: devuelve `tool_calls` de verdad) |
| **12 GB** | `gemma4:12b` | 7,6 GB | cifra agéntica publicada (τ² 69,0) y function calling nativo; a ≤16K de contexto |
| **16 GB** | `gpt-oss:20b` | 14 GB | `tools` nativo y Apache-2.0; **súbele el contexto** (con 4K por defecto las herramientas se rompen) y no hace llamadas en paralelo |
| **24 GB** | `muse-glimmer:30b` (o `qwen3.6:27b`) | 18 GB | los dos con cifras de trabajo real (SWE-bench Verified 76-77) |
| **Solo CPU** | `granite4.1:3b` (2,1 GB) o `lfm2.5:8b` (1B activo) | 2-5 GB | caben en RAM sin tarjeta; con 32 GB, `nemotron-3.5-lightning:30b` |

Si tienes 8 GB, `lfm2.5:8b` también vale (125K de contexto, hecho para tool calling).

> **Ojo con `qwen2.5-coder:7b`.** Devuelve las herramientas **como texto** dentro del
> mensaje en vez de llamarlas: el modelo no llega a ejecutar nada y el agente se queda
> mirando. Medido en R15 con Ollama; no lo pongas como modo de trabajo. (Lo mismo, por
> la misma razón, con `qwen3.5:9b` y el *thinking* activado.)

Para LM Studio el id de modelo lo pone la aplicación: míralo con
`curl http://127.0.0.1:1234/v1/models` y escríbelo en el selector de modelos de la caja
(la pestaña **Modelos locales** te dice cuál devuelve tu servidor).

Los dos lados de la mano están en **Ajustes → Conexiones**: el texto que se copia para
los agentes con navegador (Claude Code, Codex, OpenClaw, Rowboat…) —lo copia y lo deja en
`<casa>\handshake.md`— y el **MCP para chats web**, con la carpeta autorizada («Este chat
solo puede leer y escribir en `<carpeta>`.») y el texto que se pega en el chat.
**El MCP es la vía recomendada**: cuesta menos (dos llamadas y texto, sin capturas de
pantalla), tiene estado explícito y **cada tarea sale en la barra lateral del panel** con
su conversación, así que no es una caja negra.

**Las claves del MCP.** Están en UN solo sitio: **Ajustes → Models** (la casa). El servidor
MCP no mira las variables de entorno del cliente ni abre ficheros de claves: le pregunta al
motor si la credencial de esa ruta está puesta. Si no lo está, se para y lo dice:
`Falta la clave de B.AI. Pégala en RATACODE › Ajustes › Models.` Alta típica, sin nada más:
`claude mcp add --transport stdio ratacode -- ratacode mcp`.

## Los 9 modos de la casa

El selector del panel trae los **nueve modos de RATACODE y ninguno de los de serie del
motor**; el de por defecto es **MODO-RATA**:

| Modo | Oficio |
|---|---|
| MODO-RATA | generalista: el de por defecto |
| ARQUITECTO | decidir CÓMO se construye |
| CAPATAZ | objetivo → plan ejecutable |
| HERO | las manos: implementar |
| TIRITA | curar fallos |
| GEPETO | segunda opinión y pesquisa |
| FARO | escribir claro |
| PIX | la vía rápida: varias operaciones en un programa |
| NEX | hacer y probar modos y plugins |

## Las 3 formas de usarlo

1. **Navegador** — `ratacode`: la terminal en tu navegador, sin «Permitir» en cada paso
   (`danger-full-access` de fábrica). `--home` cambia la casa y `--open` abre el navegador.
2. **Headless** — `ratacode headless "encargo"`: mandas el encargo por terminal, sin
   pantalla, y la entrega queda en un fichero.
3. **MCP** — `ratacode mcp` (o `node mcp/bin/ratacode-mcp.js --home <casa>`): servidor MCP
   por stdio para Claude Code, Codex, ChatGPT web, Rowboat u OpenClaw. Nueve herramientas:
   `list_providers` → `list_models` → `run_task` → `get_task_status` → `get_task_result` →
   `cancel_task` y `ratacode_status`, más **`list_files`** y **`read_file`** (sólo lectura, que no
   gastan nada). Por HTTP (para ChatGPT web) hace falta `ratacode mcp --http` y `mcp.workspaces`
   declarado; el túnel es `node mcp/tunel.mjs --home <casa>` (el puerto del MCP lo dice
   `mcp.puerto`: 3778 de fábrica). `run_task` **espera solo** unos segundos (25 de fábrica) y, si
   la tarea acaba dentro, devuelve el resultado en la misma respuesta; cada tarea lleva topes de
   pasos y de tokens (`mcp.pasos_max`, `mcp.tokens_max`).
   La guía para Patxi, en [`apreton/chatgpt.md`](apreton/chatgpt.md).

> **Corregido en R27 (30-sep-2026):** con **ChatGPT Pro** y conector propio (modo desarrollador)
> `run_task` **SÍ funciona** (medido: la tarea `mcp-t-mun3aspp-7huh` creó `PLAN.md`). Hasta ahora
> aquí decía que el plan Pro sólo dejaba leer: era falso. Las de sólo lectura se quedan, porque no
> gastan nada.

> Los rótulos propios y las secciones **Conexiones**, **Modelos locales**, **Actividad** y
> **Modos** están en español, pero Ajustes → Models y los menús del motor siguen en inglés (los
> pone el motor, y RATACODE no reescribe la interfaz a propósito).

Para manejar RATACODE desde otro chat sin ayuda, abre **Ajustes → Conexiones** y usa sus dos
tarjetas (el texto para los agentes con navegador y el MCP para chats web); los textos largos
están en la carpeta [`apreton`](https://github.com/kittcat-lab/ratacode) del repositorio
(navegador, headless o MCP).

## Seguridad

- **Casa propia y cerrada.** Todo vive en `%USERPROFILE%\.ratacode`, **su** carpeta (nunca
  la de ajustes de ningún otro programa). Una tarea MCP trabaja **solo dentro de las
  carpetas autorizadas** (`mcp.workspaces`): escribe y lee ahí, y ni una cosa ni la otra
  fuera. Lo impone el core (sandbox fijado en `workspace-write`) más el cerco de lectura
  del MCP, y la tarea se para con una línea: «Fuera de la carpeta autorizada: `<ruta>`».
- **Y sin puertas por detrás.** En una tarea del MCP no hay terminal, ni trabajos en
  segundo plano, ni red, ni subagentes, ni guiones: se apagan una a una en el parche de
  cada tarea. Lo que la tarea lea viaja al proveedor del modelo, así que la carpeta
  autorizada es, de verdad, todo lo que ese chat puede ver.
- **La lectura, encerrada desde R25.** El motor sigue sin saber acotarla (su sandbox es de
  ESCRITURA: *«Reads pass through untouched: every mode permits reading»*), así que
  RATACODE la encierra con el gancho `tools/pre-execute` del motor: cada herramienta con
  una ruta fuera de `mcp.workspaces` se deniega. Antes, `ratacode mcp --http` y
  `mcp/tunel.mjs` **no arrancaban** sin `--acepto-lectura-total`; ya no hace falta nada de
  eso (la bandera se acepta como no-op, por no romper comandos viejos).
- **Las claves no salen.** Nunca van dentro del paquete. El servidor MCP no lee ficheros
  de credenciales (le pregunta al motor si la credencial está puesta en la casa), las usa
  y no las devuelve ni las escribe en el cuaderno. El motor, además, lava el entorno de
  los shells de sus agentes (`/KEY|PASSWORD|SECRET|TOKEN/i`). Y con el cerco de lectura,
  una tarea MCP tampoco puede abrir `<casa>\.credentials.yaml`.
- **Lo que adjuntes viaja al proveedor del modelo, igual que el texto.** El panel deja
  adjuntar ficheros e imágenes, y eso también sale de tu PC.
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
borra todo; no hay nada más que limpiar (RATACODE nunca escribe fuera de su casa, y si algún
día exportaste `B_AI_API_KEY` en tu shell, eso se quita de tu perfil de shell).

## Licencia y créditos

MIT © 2026 **Patxi** (ver [`LICENSE`](LICENSE)). Créditos y licencias de terceros, con su
texto completo, en [`CREDITS.md`](CREDITS.md).

**RATACODE no está afiliado ni avalado por DeepSeek, OpenAI, Anthropic ni Google.** Los
nombres de sus productos y modelos se usan solo para decir con qué se puede trabajar.

---

### English summary

**RATACODE — cheap hands for your agent or your chat.** A terminal for AI work wearing
the RATACODE skin, built on a free engine it never modifies. Send heavy work to cheap
models (B.AI, OpenRouter, DeepSeek, five free providers and **two local, key-free ones**)
and get the result back in your agent or chat.

- **Requires:** Windows and Node 24.
- **Web:** <https://kittcat.com/ratacode/> — the product page, with the install prompt ready to copy.
- **Install (one command):** `npm i -g ratacode`
  (the yellow npm 11 «allow-scripts» warnings during install are normal and do not stop it
  from working; alternative: the GitHub release tarball
  `https://github.com/kittcat-lab/ratacode/releases/download/v0.2.0/ratacode-0.2.0.tgz`
  — last resort: `git clone` the repo, `npm pack` and `npm i -g ./ratacode-0.2.0.tgz`) — then run `ratacode`.
- **Bring your own keys:** eight APIs ship declared (`B.AI`, `OpenRouter`, `DeepSeek`,
  `Groq`, `Google Gemini`, `NVIDIA NIM`, `SambaNova`, `Cloudflare Workers AI` — the last one
  needs your `{account_id}` pasted into *Customized settings → Base URL*). Set each key in the
  web UI (Settings → Models) or as its environment variable; keys are never bundled.
  The MCP server asks the engine whether the credential is set in the house — it never reads your
  chat's environment or any credentials file.
- **Local models live in their own tab (Settings → "Modelos locales"):** **Ollama** and
  **LM Studio**, local and key-free — whether they are installed, running or off, the button to
  turn them on and off, which models you have and which ones work as an agent, and your card's
  recommendation ("your GPU: 10 GB → recommended: qwen3:8b"). They stay declared in the house, so
  the box's model picker still offers them.
- **Nine modes** ship in the picker (MODO-RATA by default) and none of the engine's own: three
  columns by three rows, each with its character's colour and "En uso" on the one in charge.
- **Conexiones (Settings → Conexiones):** one button copies the text that tells an agent how to
  work with RATACODE; the other card turns the web-chat connection on and off, with the address
  to paste in ChatGPT › Settings › Connectors and its one-line warning. **MCP is the recommended
  route** (cheaper and more reliable), and every MCP task shows up in the panel sidebar with its
  conversation.
- **Three ways to use it:** browser (`ratacode`), headless (`ratacode headless "task"`),
  and MCP (`ratacode mcp`) so ChatGPT web, Claude Code, Codex, Rowboat or OpenClaw can
  delegate tasks (`list_models`, `run_task`, `get_task_status`, `get_task_result`, `cancel_task`).
- **Security:** its own locked home (`%USERPROFILE%\.ratacode`, never any other program's settings
  folder); MCP tasks work only inside the folders you authorise (`mcp.workspaces`) — they **read
  and write there and nowhere else** — with no terminal, no network, no subagents and no scripts,
  and the read fence is the engine's own `tools/pre-execute` hook, so the HTTP transport and the
  tunnel no longer need `--acepto-lectura-total` (it is a no-op now); and the keys never travel
  inside the package.
- **Uninstall:** `npm uninstall -g ratacode`, then delete the home folder
  (`%USERPROFILE%\.ratacode`; `rm -rf ~/.ratacode` on Mac/Linux). That folder holds your keys
  (`.credentials.yaml`), the MCP key (`mcp\http-secret.txt`) and the panel URL with its token
  (`url.txt`); nothing else is written anywhere.
- **License:** MIT © 2026 Patxi. Third-party credits and licences: [`CREDITS.md`](CREDITS.md).
