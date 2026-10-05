# Puente GPT · botón «Autorizar esta carpeta» (hecho)

**Qué cambié**
- `piel\lib\index.js:1735-1910` · R34: `ponerWorkspaceEnTexto()` (pura, exportada), `canonicaDeCarpeta`, `esRaizDeDisco`/`esCarpetaDeUsuario` (misma regla que `mcp\lib\seguridad.js:87-102`), `raizQueCubre`, `cargadorDeYaml()` (pide prestado js-yaml), nonces de 2 min de un solo uso en memoria.
- `piel\lib\index.js:2363-2517` · `POST /ratacode/sesiones/autorizar`: cerco `autorizada` + **403 `NO_ES_EL_NAVEGADOR`** si falta `Sec-Fetch-Site: same-origin`; paso 1 da ruta canónica + nonce y NO escribe; paso 2 (`confirmar:true`+nonce) escribe con copia `.bak` y releyendo el YAML antes de escribir. Niega raíz de disco, carpeta de usuario y su padre, lo que no existe o no es carpeta (400), y «ya está autorizada» se dice sin añadir. Import `dentroDeAlguna` (`:73`), `realpathSync`, `resolve`.
- `piel\lib\cliente.js:1419,1452-1477,1499-1529` · botón «Autorizar esta carpeta» en la cabecera del chat; confirmación «¿Autorizar X? ChatGPT podrá leer y escribir en ella» + Sí / Cancelar (CSS `:124-126`).
- `pruebas\piel.test.mjs:301-360` (E1, función pura), `:686-770` (E2/E3, HTTP), `:538-541` (bundle).
- NO toqué `bin\ratacode.js`, `mcp\` ni `ratacode-es.js`: los textos de este componente ya iban en español duro, como «Abierta a ChatGPT».

**Qué probé** · `node pruebas\piel.test.mjs --puerto 3140` → **VERDE, exit 0** (59/59 selectores, 83 ficheros de frontend, todo lo de antes sigue verde).
- E1: los 3 casos (mcp con/sin workspaces, sin mcp), sin perder comentarios ni claves, `mcp:` en una línea se niega, CRLF se respeta.
- E2: 403 sin cabecera (contestó `NO_ES_EL_NAVEGADOR`), 401 sin cookie, 5 negaciones (usuario, su padre, `C:\`, inexistente, fichero), y la ya autorizada se dice. Ninguna escribió el fichero.
- E3: paso 1 → 200 con nonce de 32 car. y el `settings.yaml` intacto; paso 2 → 200, `.bak` con el texto previo, `mcp.workspaces` con 2 carpetas, solo cambia una línea; reusar el nonce → 409; `/ratacode/mcp` ya ve las 2 sin reiniciar.

**Desvíos (declarados, pedidos por Codex)** · TEMP y TMP del proceso hijo, y casa/taller de prueba, en `..\trabajo\puente-temp` (`--temp`, default en `:92`). Escribí un temporal `producto\_sonda-yaml.mjs` para medir cómo lee js-yaml y **lo borré**; la sonda de `%TEMP%` no la he tocado.

**Falta / SOSPECHA**
- SOSPECHA: que el navegador real mande `Sec-Fetch-Site: same-origin` no lo he medido (aquí no hay navegador); en Safari <16.4 no existe → el botón daría 403.
- No probado en una casa REAL ni con el clic de verdad en el panel: 3120 y 3098 no se han tocado. Estrenar el botón exige reabrir RATACODE (el `index.js` se carga al arrancar).
