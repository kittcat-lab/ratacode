# RATACODE · Conexiones: cuál elegir según tu app

| Tu app | Qué usar | Por qué |
|---|---|---|
| Claude Code, Codex, OpenClaw, Rowboat | **mcp.md** (recomendado) o **navegador.md** | **El MCP es la vía recomendada**: más barata (dos llamadas y texto, sin capturas), con estado explícito y con cada tarea visible en la barra lateral del panel. El navegador sigue valiendo si tu app prefiere mirar la pantalla. |
| ChatGPT web (el chat) | **mcp.md** con túnel | ChatGPT web habla MCP por HTTP. Necesitas el túnel de Cloudflare: `node mcp/tunel.mjs --home <casa>` (lo cuenta mcp.md). La clave va en la URL. |
| Cualquier chat sin MCP ni navegador | **headless.md** | `ratacode headless "encargo"` hace el trabajo sin pantalla y deja el resultado en un fichero. |
| Cualquier agente que no sea de los anteriores | **mcp.md** (genérico) | Si tu agente habla MCP por stdio, usa la configuración genérica de mcp.md. |

## Instalación (un comando)
```bash
npm i -g ratacode
```
Los avisos amarillos «allow-scripts» de npm 11 al instalar son normales y **no impiden que
funcione**. Alternativa, si quieres una versión concreta: el `.tgz` de la release de GitHub
(sin git ni cuenta de npm):

```bash
npm i -g https://github.com/kittcat-lab/ratacode/releases/download/v0.2.0/ratacode-0.2.0.tgz
```

Último recurso, si la descarga falla:
`git clone https://github.com/kittcat-lab/ratacode && cd ratacode && npm pack && npm i -g ./ratacode-0.2.0.tgz`.
Después, `ratacode` (necesita Windows y Node 24).

La web del producto, con el prompt listo para copiar: <https://kittcat.com/ratacode/>.

## Dónde están los prompts
- **navegador.md** — para agentes con navegador (Claude Code, Codex, OpenClaw, Rowboat…)
- **headless.md** — para `ratacode headless "encargo"`
- **mcp.md** — para apps con MCP (Claude Code, Codex, OpenClaw, Rowboat, ChatGPT web con túnel, genérico)

## Qué hace RATACODE
Una terminal de trabajo con IA con la cara de RATACODE, montada sobre un motor libre que no se toca. Los modelos baratos (B.AI: deepseek-v4.1-flash, glm-5.3-flash, qwen3.8-flash, hy3, mimo-v2.5) —o los tuyos, en local con Ollama o LM Studio— hacen el trabajo pesado. Tú planificas, revisas y cierras.

## Cómo funciona el ciclo
1. **Diagnóstico** — solo mirar, sin tocar ficheros.
2. **Revisión** — comprueba los fallos que más pesen.
3. **Arreglo** — de uno en uno, cambio mínimo, misma prueba antes/después.
4. **Cierre** — lee el diff, repite la prueba, abre la app y lo ve.

**No arranques servidores. No publiques. Si falta algo, dilo.**

## Las trampas que ya costaron
- **T2:** el espacio de trabajo ya viene puesto; no abras diálogos nativos.
- **T4:** no uses capturas; lee ficheros o usa `get_task_result`.
- **T11:** nunca leas `.credentials.yaml`, `.env` ni bóvedas.
- **T12:** las claves NO se le pasan al servidor MCP: están en RATACODE › Ajustes › Models y el servidor las lee de ahí. Si falta una, sale `Falta la clave de <proveedor>. Pégala en RATACODE › Ajustes › Models.`
- **T13:** si el tutor dice algo falso, corrígelo con la prueba.
- **T16:** `url.txt` se borra al arrancar y se escribe cuando el puerto contesta. Si no carga, espera 15 s y vuelve a leerla; si el puerto no escucha, arranca `ratacode` otra vez. El porqué de un cierre queda en `<casa>\ratacode.log`.
- **T17:** no termines el turno con la tarea en marcha: usa `run_task` con `esperar_segundos` o no pares hasta que `get_task_status` diga `completed`/`failed`. Por stdio, la tarea vive lo que vive el cliente.
- **T18:** un encargo grande, en sesión/chat nuevo: los encargos van en ficheros y no necesitan historial.

Elige el prompt que mejor encaje con tu app. Copia, pega, adapta y ejecuta.