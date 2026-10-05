# Puente GPT · botón «Autorizar esta carpeta» (informe, sin tocar código)

Todo lo que va sin marca está leído en el código de esta carpeta (`producto\`). Lo no comprobado va como **SOSPECHA**.

## 1 · Dónde se lee `mcp.workspaces`

Hay **dos lectores distintos**, a propósito:

- **MCP** (proceso aparte, con `js-yaml`): `mcp\lib\casa.js:96-135` (`ajustesMcp`) lee `mcp.workspaces`; la ruta del fichero se arma en `mcp\lib\casa.js:57` = `<casa>\settings.yaml`, y la casa se resuelve en `mcp\lib\casa.js:23-25` (`--home` > `$RATACODE_HOME` > `%USERPROFILE%\.ratacode`).
  El **apretón** vive en `mcp\lib\seguridad.js:113-134` (`raicesAutorizadas`): en modo HTTP se tiran la raíz de disco y la carpeta de usuario (`esRaizDeDisco` `:87-90`, `esCarpetaDeUsuario` `:99-102`), y sin lista no se trabaja (`:148-155`).
  Y se **relee por tarea**: `seguridad.js:141-192` (`resolverEspacio`) → el parche de política se escribe por tarea con esas raíces (`mcp\lib\nucleo.js:62`) y `mcp\lib\lectura.js` las aplica.
- **Panel/piel** (sin dependencias, lee el TEXTO): `piel\lib\index.js:337-371` (`ajustesDeLaCasa`), clave `workspaces` en `:357` y sus elementos de lista en `:368`. Casa: `piel\lib\index.js:183-185`.
  Uso: `/ratacode/sesiones` (`index.js:2087`) → `listarSesiones` (`piel\lib\sesiones.js:246-295`), que calcula `en_espacio_autorizado` en `:270` y `:282` con `dentroDeAlguna` (`sesiones.js:226-238`; compara canónico y, en Windows, sin mayúsculas).
  Y la puerta que de verdad decide abrir: `POST /ratacode/sesiones/abierta` (`index.js:2127-2173`), que niega con `SESSION_NOT_ALLOWED` en `:2152-2159`.

No confundir con la tabla `workspaces` de `storages\workspace.json` (`mcp\lib\espacios.js:77-104`, `bin\ratacode.js:608-645`): ésa es la barra lateral, no autoriza nada.
## 2 · Dónde se pinta «Carpeta sin autorizar»

`piel\lib\cliente.js:1458-1462`, dentro del componente `InterruptorSesion` (cabecera del chat, registrado en `cliente.js:1493-1497`). Sale cuando `sesion.en_espacio_autorizado !== true`; el botón «Abierta a ChatGPT» queda deshabilitado por lo mismo en `cliente.js:1450`. Los datos se sondean cada 3 s (`cliente.js:1413-1425`), así que la etiqueta se va sola en cuanto la carpeta entra en la lista.
## 3 · Cómo se autoriza hoy, paso a paso

1. Se ve «Carpeta sin autorizar» en la cabecera de ese chat; la ruta exacta está en `GET /ratacode/sesiones` → campo `carpeta` (`sesiones.js:269,274`).
2. Se abre **a mano** `<casa>\settings.yaml` (casa = lo de §1; la UI ya enseña esa ruta para el túnel en `index.js:1687`).
3. Se añade bajo `mcp:` la clave `workspaces:` y la carpeta como elemento de lista (`- C:\...`). Formato de fábrica, comentado: `fabrica\settings.yaml:255-258`.
4. Se guarda. **No hace falta reiniciar**: la piel relee el texto en cada petición (`index.js:340`) y el MCP por tarea (`seguridad.js:142`).
5. Aparte, en la cabecera del chat se enciende «Abierta a ChatGPT» (`cliente.js:1444-1455` → `index.js:2127`).

Hoy **no existe** ninguna ruta del panel que escriba `workspaces`: la piel sólo escribe `handshake.md`, `cloudflared.yml`, la clave/url del MCP, `tema.txt`, `aviso-claves-visto` y `actividad.jsonl` (`index.js:1828-1833, 1416-1420, 1464, 1657, 1978, 2015`).
## 4 · Cambio mínimo propuesto (esbozo, NO aplicado)

Ficheros: **`piel\lib\index.js`** (ruta nueva + escritura sobre el texto), **`piel\lib\cliente.js`** (botón y confirmación), opcional `piel\activos\ratacode-es.js` (2 textos) y `pruebas\piel.test.mjs`.

```
--- a/piel/lib/index.js     +++ b/piel/lib/index.js   (junto a /ratacode/sesiones/abierta)
+// Escribe `mcp.workspaces` sobre el TEXTO, como `ponerModeloEnTexto`
+// (bin\ratacode.js:459-465): no se lleva por delante comentarios ni el orden.
+function ponerWorkspaceEnTexto(texto, ruta) {
+  // si hay `mcp:` + `workspaces:` → añade `  - <ruta>`
+  // si hay `mcp:` sin `workspaces:`  → lo añade dentro
+  // si no hay `mcp:`                  → bloque nuevo al final
+}
+// POST /ratacode/sesiones/autorizar
+const autorizarCarpeta = (req, res) => {
+  if (!autorizada(req, res)) return;                    // mismo cerco que las demás
+  // NIEGA si: no existe / no es carpeta; es raíz de disco o carpeta de usuario
+  // (misma regla que mcp\lib\seguridad.js:87-102, con `canonica` de lectura.js:70);
+  // o si ya está DENTRO de una autorizada (dentroDeAlguna, sesiones.js:226).
+  // PASO 1 (`confirmar` ausente): no escribe; devuelve la ruta canónica + `nonce`
+  //        de un solo uso (2 min, en memoria). El navegador pinta «¿Autorizar X?».
+  // PASO 2 (`confirmar:true` + `nonce` válido): escribe `<casa>\settings.yaml`
+  //        (mode 0o600, copia previa .bak) y devuelve {ok:true}.
+};
+c.effect(() => servidor.register({ kind: 'exact',
+  path: '/ratacode/sesiones/autorizar', handler: autorizarCarpeta }), 'ratacode-piel.sesiones-autorizar');

--- a/piel/lib/cliente.js  +++ b/piel/lib/cliente.js   (InterruptorSesion, 1458-1462)
-      }, 'Carpeta sin autorizar'));
+      }, 'Carpeta sin autorizar'),
+      e('button', { className: 'mr-chatgpt-boton', onClick: pedirAutorizar }, 'Autorizar esta carpeta'));
+// pedirAutorizar: paso 1 sin `confirmar` → «¿Autorizar <ruta>?» con Sí / Cancelar;
+// el Sí manda `confirmar:true` + `nonce` y luego llama a `mirar()`.
```
## 5 · Qué habría que reiniciar

- **Una vez**, para estrenar el código nuevo: el **panel** (`piel\lib\index.js` se carga al arrancar; cerrar y volver a abrir RATACODE). `cliente.js` es plugin de navegador: se recarga con la página y en caliente sólo si corre `pnpm run dev:web`.
- **Al usar el botón, nada**: piel y MCP releen el fichero (ver §3.4).
- Sólo si quieres que **ChatGPT vea la carpeta nueva en su guía**: el texto de instrucciones y los topes del MCP se congelan al arrancar (`mcp\lib\servidor.js:254,761`) → apagar y encender el MCP en Ajustes › Conexiones. **SOSPECHA**: no he medido si algún otro estado del proceso MCP cachea raíces; el cerco de rutas, desde luego, no (se escribe por tarea).
## 6 · Riesgos de seguridad

- **Quién puede pulsarlo**: `autorizada` = `c.connection.requestRejection(req)` (`index.js:1817-1825`): Host/Origin + cookie de sesión firmada con un secreto de `<casa>\.credentials.yaml` (no he abierto ese fichero). Desde otra máquina por la red no se llega… **pero el proceso MCP SÍ tiene esa credencial**: canjea el token de `url.txt` por la cookie del panel (`mcp\lib\panel.js:85-102,111-120`) y llama a rutas de la piel. Hoy sólo usa `/ratacode/sesiones*` (`mcp\lib\panel.js:210`, `mcp\lib\sesiones.js:68,87,121,141`), pero una ruta de autorizar con el **mismo cerco** quedaría al alcance de quien tenga esa credencial. Mitigación mínima: además del nonce, exigir `Origin`/`Sec-Fetch-Site` del navegador y no exponer nunca el panel por el túnel.
- **Qué NO debe poder autorizarse**: raíz de disco (`C:\`), la carpeta de usuario (`C:\Users\<tú>`) y su padre (`C:\Users`) — ya es la regla del MCP (`seguridad.js:99-102`); y cualquier ruta que **resuelva** ahí por `..`, enlace o unión (por eso hay que validar con `canonica`, `lectura.js:70-81`, que sigue enlaces; y con la lista de claves de ruta del parche).
- **Padres ya autorizados**: si `C:\...\DEVAPPS` ya está en la lista, sus hijas ya cuentan como autorizadas (`sesiones.js:235`); el botón debe decirlo en vez de añadir ruido.
- **El dos pasos es contra el clic humano, no contra quien tiene la cookie**: no lo vendas como seguridad fuerte.
- **Autorizar no encierra a nadie**: desde R32 una sesión «abierta a ChatGPT» conserva su permiso y TODAS sus herramientas (`index.js:2226-2234`); el cerco de `mcp.workspaces` es sólo de las tareas del MCP. Añadir una carpeta amplía de verdad lo que el MCP puede leer y **escribir**.
- **YAML**: escribir mal el fichero rompe la casa entera. Reglas: sólo texto, copia `.bak`, `mode 0o600`, y si el documento no se puede releer como YAML, no se escribe (patrón `bin\ratacode.js:505-524`).
## 7 · SOSPECHAS (no visto en el código)

- Que DSH añada carpetas solo: no lo he visto; no encontré ningún camino.
- Que el panel quede publicado por el túnel: el túnel apunta al puerto del MCP (`fabrica\settings.yaml:260`); el ingress real de esta máquina no lo he mirado.
- No he ejecutado ninguna prueba (las de `pruebas\mcp-*.test.mjs` sí siembran `workspaces:` en un `settings.yaml` temporal).
