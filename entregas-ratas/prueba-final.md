Ficheros en piel\activos: 6 (medido: Get-ChildItem -LiteralPath 'piel\activos' -File -Force; 0 subcarpetas, así que directo y recursivo dan lo mismo; ocultos incluidos, ninguno había).
Más grande: piel\activos\ratacode-es.js — 66276 bytes (medido: propiedad .Length; el 2º es ratacode-vida.js con 52718 bytes).
SOSPECHA: no he abierto ningún fichero para verificar su contenido; sí comprobé que los 6 son ficheros regulares (ningún enlace) y que el mayor mide 66276 bytes por dos vías (Get-ChildItem .Length y Get-Item); el resto del árbol del repo no se ha mirado.
Más pequeño: piel\activos\ratacode-emblema.svg — 998 bytes (medido: Sort-Object Length sobre los 6, mismo comando; es un SVG, no un .js).
