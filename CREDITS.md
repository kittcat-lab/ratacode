# Créditos y licencias de terceros

RATACODE se reparte bajo **MIT** (ver [`LICENSE`](LICENSE)). Dentro viaja, sin modificar,
un motor de terceros que hace el trabajo de verdad; su licencia es también MIT y su aviso
de copyright tiene que viajar con él. Este fichero es ese aviso.

## RATACODE

MIT License — Copyright (c) 2026 **Patxi**

## Motor de trabajo

MIT License — Copyright (c) 2026 **DeepSeek**

Paquete: `@deepseek-ai/dsh` (DeepSeek Harness). RATACODE lo usa como dependencia, sin
tocarlo: la casa, la piel, los modos y el servidor MCP son de RATACODE; el motor es suyo.
Texto de la licencia, tal y como viene en el paquete:

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## sharp y libvips (LGPL-3.0-or-later)

`sharp` (Apache-2.0) trae dentro los binarios de **libvips**, que son
**LGPL-3.0-or-later**: `@img/sharp-win32-x64` se declara `Apache-2.0 AND
LGPL-3.0-or-later` y en su carpeta viajan `libvips-42.dll` y
`libvips-cpp-8.18.6.dll`. Su texto está en
<https://www.gnu.org/licenses/lgpl-3.0.html>. No se modifica nada de libvips: se
usa el binario tal y como lo publica el paquete, y por eso la licencia se cumple
con este aviso y con el enlace a su texto.

El resto del árbol (587 paquetes, casi todos MIT, Apache-2.0, BSD o ISC) lo
instala **npm** al instalar RATACODE, con las licencias que declara cada paquete
y sus ficheros de licencia dentro de `node_modules`; RATACODE no los copia ni los
modifica, y en el `.tgz` sólo viaja lo que declara `files` en su `package.json`.

## RATACODE

MIT License

Copyright (c) 2026 Patxi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
