# ChatGPT y RATACODE, en corto

**1 · Enciende.** En RATACODE: **Ajustes › Conexiones › «ChatGPT y Claude web» › Encender**.
Queda `Conectado` y aparece una dirección. El MCP local se queda encendido aunque el túnel falle.

**2 · Conecta (una vez).** En ChatGPT: **Ajustes › Seguridad e inicio de sesión › Modo
desarrollador** (si no aparece, tu plan no lo tiene). Luego **chatgpt.com/plugins › +** → ponle
nombre y descripción → en **Conexión**, elige **«URL del servidor»** y pega la dirección (botón
**Copiar dirección**) → **Autenticación: «Sin autenticación»** → marca la casilla → **Crear**.
Ya está: **no hay que repetirlo cada vez** (la clave y el puerto no cambian al apagar y encender).

**3 · Pídeselo así** (5 ejemplos; cambia `RATACODE` por el nombre que le pusiste al conector):
- `Usa RATACODE: dime qué hay en la carpeta`
- `Usa RATACODE: lee PLAN.md y resúmelo`
- `Usa RATACODE: pide a RATACODE que arregle el fallo del login y enséñame el resultado`
- `Usa RATACODE: busca "TODO" en el proyecto y hazme una lista`
- `Usa RATACODE: pide a RATACODE que escriba las pruebas del fichero utils.js`

**4 · Mira lo que hace.** **Ajustes › Actividad**: una tabla con hora, cliente, qué (tarea o
lectura), la tarea o la ruta, y si se permitió o se bloqueó. Se actualiza sola. Y cada tarea sale
en la **barra lateral** del panel, con su conversación, **sin recargar**.

**5 · Apaga.** «Apagar túnel» (deja de estar expuesto y el MCP local sigue) o «Apagar MCP» (lo
para todo). Se apaga de verdad: si quedara algo vivo, el panel lo dice.

**6 · Qué gasta.** **Leer es gratis; las tareas gastan tu saldo del modelo.** Y no se va de las
manos: cada tarea lleva topes (40 pasos y 400 000 tokens de fábrica) y `run_task` espera solo 25 s,
así que ChatGPT te da el resultado en la misma respuesta sin preguntar en bucle.

## La dirección fija (opcional, 10 minutos, una vez)

El túnel rápido **cambia de dominio cada vez**, así que hay que volver a pegar la dirección. Con un
túnel **con nombre** la dirección es siempre la misma (`https://ratacode.tudominio.com/mcp/…`).
Los tres comandos, en tu PC (hacen falta tu cuenta de Cloudflare y un dominio tuyo en ella):

```sh
cloudflared tunnel login
cloudflared tunnel create ratacode
cloudflared tunnel route dns ratacode ratacode.tudominio.com
```

Y en `<casa>\settings.yaml` (la casa es `%USERPROFILE%\.ratacode` salvo que uses `--home`):

```yaml
mcp:
  tunel_nombre: ratacode
  tunel_host: ratacode.tudominio.com
```

Después, **Encender** otra vez: la dirección ya no cambia. RATACODE **no hace login, no crea
túneles y no lee tus credenciales** (las de `%USERPROFILE%\.cloudflared` las usa cloudflared).

**Límites:** cada tarea trabaja **sólo** dentro de las carpetas de `mcp.workspaces` (fuera de ahí
se para y lo dice), y la dirección lleva la clave dentro: no la compartas. El detalle largo, en
`mcp\README.md`.
