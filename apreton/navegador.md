# Navegador: cómo manejar RATACODE desde tu chat

RATACODE es un DSH (DeepSeek Harness) con la cara de RATACODE. Se abre en el navegador (puerto 3777) y recibe encargos de cualquier agente. Los modelos baratos hacen el trabajo; tú planificas, revisas y cierras.

## Dónde está la URL
Lee `<casa>\url.txt` y ábrela en tu navegador. La casa es la carpeta desde la que se arrancó `ratacode` (o `%USERPROFILE%\.ratacode` por defecto).

`ratacode` borra ese fichero al empezar y sólo lo escribe cuando el puerto ya escucha de verdad, así
que la URL que leas es la de ESTA vez (no la de la vez anterior). Si no carga, o el fichero todavía no
está: espera 15 s, vuelve a leerlo y, si el puerto no escucha, arranca `ratacode` otra vez. El motivo
de cada cierre del motor queda en `<casa>\ratacode.log` (código de salida y señal).

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

**Antes de escribir**, comprueba que la caja del chat está visible y es la del título correcto (el usuario puede tener ajustes abiertos, la caja puede estar fuera de pantalla).
**Después de enviar**, comprueba que la sesión avanza (fichero de sesión o respuesta). Si no avanza, mira por qué antes de repetir.

## Cómo comprobar que llegó
- El fichero de sesión crece (cada turno añade líneas).
- El encargo aparece en la lista de tareas de la web.
- Si el modelo contesta, la respuesta sale en el panel.

## Cómo vigilar sin capturas
No mires la pantalla. Lee los ficheros de sesión directamente: estado, herramientas usadas, permisos pedidos, último mensaje. Un captura cada vez gasta cuota; un fichero no.

## Trampas que ya costaron (tropiezos 2, 4, 6, 7, 11, 13, 16, 17, 18)

- **T2 · Espacio de trabajo:** el diálogo nativo de Windows no lo ves. Arranca `ratacode` desde la carpeta de trabajo; el espacio ya viene puesto.
- **T4 · Capturas gastan cuota:** pide la entrega en un fichero y vigila ese fichero, no la pantalla.
- **T6 · La caja no recibe:** el usuario puede tener los Ajustes abiertos o la caja fuera de pantalla. Antes de escribir, comprueba que la caja es la correcta y está visible.
- **T7 · Caja fuera de pantalla:** haz clic en la caja, escribe con el teclado y pulsa Enter. Si no llega, el div editable no cuenta como texto escrito; usa el teclado, no el formulario.
- **T11 · Credenciales:** nunca leas `.credentials.yaml`, `.env` ni bóvedas. Si falta una clave, para y dilo.
- **T13 · Tutor equivocado:** si el tutor dice algo falso, corrígelo con la prueba (fichero:línea); no obedezcas una premisa falsa.
- **T16 · La URL a medias y el cierre sin rastro:** `url.txt` se borra al empezar y se escribe SÓLO cuando el puerto contesta, así que si lo lees y no carga, espera 15 s y vuelve a leerlo; si el puerto no escucha, arranca `ratacode` otra vez. Si el panel se cierra solo, el motivo está en `<casa>\ratacode.log` (código de salida y señal): no lo cierres tú antes de leerlo.
- **T17 · El panel es el cliente:** aquí la tarea vive lo que viva el panel. Si cierras la ventana con una tarea en marcha, se queda sin quien la recoja. Pide la entrega en un fichero y no cierres hasta que esté.
- **T18 · Un encargo grande, en chat nuevo:** un chat con 6 turnos y 519 pasos acumulados acaba con un 400 del proveedor (`read body failed`). Los encargos van en ficheros y no necesitan historial: abre chat nuevo para cada encargo grande.

## El ciclo (diagnóstico → revisión → arreglo → cierre)

1. **Diagnóstico** (tu chat): solo mirar, sin tocar ficheros. Lee lo que te den, pasa pruebas, busca fallos y comprueba cada uno. Lo no comprobado, SOSPECHA.
2. **Revisión** (tú): comprueba los fallos que más pesen. Marca falsos positivos.
3. **Arreglo** (tu chat): de uno en uno, cambio mínimo, misma prueba antes/después. Sin commit.
4. **Cierre** (tú): lee el diff, repite la prueba, abre la app y lo ve. Commit solo si toca.

**No arranques servidores. No publiques. Si falta algo, dilo.**