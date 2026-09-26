# Headless: cómo manejar RATACODE sin navegador

RATACODE es un DSH con la cara de RATACODE. En modo headless no hay pantalla: mandas el encargo por terminal y el resultado llega a un fichero. Los modelos baratos hacen el trabajo; tú planificas, revisas y cierras.

## Cómo usarlo
```sh
ratacode headless "tu encargo aquí"
```
El resultado se escribe en un fichero que tú elijas dentro del encargo. `headless` hace el trabajo y termina.

## Dónde está la URL (si la necesitas)
Lee `<casa>\url.txt`. La casa es la carpeta desde la que se arrancó `ratacode` (o `%USERPROFILE%\.ratacode` por defecto). En headless no la abres, pero si necesitas ver el estado, abre la URL en otro momento. **Ojo (T16):** ese fichero se escribe cuando el panel arranca y escucha, no en headless; si lo lees y no carga, espera 15 s y vuelve a leerlo, y mira `<casa>\ratacode.log` para saber por qué se cerró el motor.

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

**Después de enviar**, comprueba que el proceso terminó y que el fichero de entrega existe. Si no termina, mira por qué antes de repetir.

## Cómo comprobar que llegó
- El proceso `ratacode headless` termina con código 0.
- El fichero de entrega existe y tiene contenido.
- Si hay error, el código de salida no es 0 y el stderr dice qué pasó.

## Cómo vigilar sin capturas
No mires la pantalla. Lee el fichero de entrega directamente. Un captura gasta cuota; un fichero no. En headless no hay pantalla que mirar.

## Trampas que ya costaron (tropiezos 2, 4, 6, 7, 11, 13, 16, 17, 18)

- **T2 · Espacio de trabajo:** arranca `ratacode headless` desde la carpeta de trabajo; el espacio ya viene puesto.
- **T4 · Capturas gastan cuota:** en headless no hay pantalla; pide la entrega en un fichero.
- **T6 · No aplica:** en headless no hay caja de chat.
- **T7 · No aplica:** en headless no hay caja de chat.
- **T11 · Credenciales:** nunca leas `.credentials.yaml`, `.env` ni bóvedas. Si falta una clave, para y dilo.
- **T13 · Tutor equivocado:** si el tutor dice algo falso, corrígelo con la prueba (fichero:línea); no obedezcas una premisa falsa.
- **T16 · La URL a medias y el cierre sin rastro:** `url.txt` se borra al arrancar el PANEL y se escribe cuando el puerto contesta; headless no lo toca. Si lo lees y no carga, espera 15 s y vuelve a leerlo. El motivo de un cierre del motor queda en `<casa>\ratacode.log` (código de salida y señal).
- **T17 · No aplica (y por eso headless es la salida de emergencia):** `ratacode headless` no termina su turno antes que la tarea: el proceso no sale hasta que el motor acaba, así que el fichero de entrega no se queda a medias. Si no puede volver a preguntar, pide la entrega en un fichero.
- **T18 · Un encargo grande, en sesión nueva:** cada `ratacode headless` es una sesión nueva del motor (no arrastra historial), que es justo lo que hay que hacer: los encargos van en ficheros y no necesitan historial. Lo que NO hay que hacer es encadenar encargos grandes en el mismo chat que los lanza.

## El ciclo (diagnóstico → revisión → arreglo → cierre)

1. **Diagnóstico** (tu sesión headless): solo mirar, sin tocar ficheros. Lee lo que te den, pasa pruebas, busca fallos y comprueba cada uno. Lo no comprobado, SOSPECHA.
2. **Revisión** (tú): comprueba los fallos que más pesen. Marca falsos positivos.
3. **Arreglo** (tu sesión headless): de uno en uno, cambio mínimo, misma prueba antes/después. Sin commit.
4. **Cierre** (tú): lee el diff, repite la prueba, abre la app y lo ve. Commit solo si toca.

**No arranques servidores. No publiques. Si falta algo, dilo.**