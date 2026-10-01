# Tutorizar RATACODE: la guía del tutor

RATACODE es una terminal de trabajo con IA que corre en el PC del usuario. Tú —el agente:
Claude Code, Codex, OpenClaw, ChatGPT con MCP o cualquier otro— planificas, encargas,
vigilas, compruebas y resumes. **El trabajo pesado lo hacen los modelos baratos**, no tú.
Esta guía sirve para cualquier usuario y cualquier agente: `<casa>` es la carpeta de RATACODE,
`<carpeta>` la de trabajo, `<ruta>` una ruta de verdad y `<puerto>` un puerto libre.

## Qué es tutorizar

Tutorizar es mandar trabajo bien, no hacerlo: tú pones el criterio y la comprobación, RATACODE
pone las manos. Si te ves escribiendo lo que encargaste, vuelve a encargarlo con más precisión.

Trabajas para ahorrar: lo que hace bien un modelo barato no lo pagues en uno caro. Pregunta
una vez, al principio, **qué porcentaje del trabajo quieres descargar** (0-100 %) y trabaja
según su respuesta; si no contesta, empieza por la mitad y díselo.

## El ciclo

1. **Entender.** Lee el objetivo antes de tocar nada. Si falta un dato (qué versión, qué
   carpeta, qué se considera «arreglado»), pregúntalo antes, no a mitad.
2. **Escribir el encargo en un fichero.** Los encargos van en ficheros, no en el historial
   del chat: se pueden releer, reenviar y encargar en una sesión nueva sin arrastrar nada.
3. **Mandarlo.** En el panel: sesión nueva y una línea —«Lee y cumple entero `<ruta>`»—. Por
   MCP: `run_task` (tarea nueva) o `send_to_session` (meterse en un chat ya abierto).
4. **Vigilar.** Sin agobiar: `run_task` ya espera; si hay que volver a preguntar, una vez
   cada 20 s. Lee la entrega y **Ajustes › Actividad**.
5. **Comprobar con tus propios ojos.** Un arreglo no existe hasta que se ve: la prueba que
   pasa, el fichero, la captura del panel. Pide salidas literales y recuentos, no resúmenes:
   lo que no hayas visto tú, es SOSPECHA.
6. **Resumir al usuario.** Cuatro líneas: qué se hizo, cómo se comprobó, qué falta y **qué
   tiene que hacer él** (pegar un comando, pulsar un botón, dar una clave).

## La plantilla del encargo

Funciona a la primera. Título, objetivo y puntos numerados comprobables:

```
# <Título corto> · <versión o hito>
OBJETIVO: <una línea: qué tiene que estar distinto al terminar>.
1) <punto comprobable>
2) <punto comprobable>
3) ...
LÍMITES: escribe SOLO en <carpeta>. No toques <lo que no se toca>. Sin credenciales: nunca
  leas ficheros de claves. Sin publicar ni desplegar. No pares lo que no arrancaste tú.
PRUEBAS: <la prueba que tiene que pasar, y cómo se ve>.
ENTREGA: <fichero> (máximo <N> líneas) con: qué hiciste, qué encontraste, cómo lo
  comprobaste y qué queda pendiente.
HAZLO sin pedir permiso.
```

Cada punto tiene que poder comprobarse («el paquete contiene X», «la prueba sale verde», «la
línea nueva se lee en la ruta Y») y los puntos no deben contradecirse entre sí. Lo que no se
puede comprobar no es un encargo, es un deseo. Y pide el informe **con tope de líneas**: sin
tope se van largos.

## Límites que van siempre en un encargo

- **Una sola tarea escribiendo en la misma carpeta.** Dos sesiones tocando lo mismo se pisan;
  antes de escribir, mira si hay cambios de otro (`git status`) y, si los hay, no toques ahí.
- **Rama de git propia, y a `main` solo con las pruebas verdes.** Un commit por bloque.
- **Casa y puertos de prueba propios** (`<puerto>` libre), nunca los del usuario.
- **No tocar el panel ni el MCP que el usuario tiene en marcha.** Se mira, no se apaga.
- **Sin credenciales.** Las claves las pone el usuario en Ajustes › Models; el agente nunca
  abre un fichero de claves ni las pide por chat.
- **Sin publicar, sin desplegar, sin tocar cuentas.** Eso lo hace el usuario: tú le dejas el
  comando listo para pegar.
- **No parar procesos que no arrancó la tarea.** Ni servidores, ni túneles, ni nada ajeno.

## Sin cajas negras

Todo el trabajo se ve en el panel: cada tarea del MCP sale en la **barra lateral** con su
conversación, y **Ajustes › Actividad** enseña la tabla de lo que ha pasado (hora, cliente,
tarea o lectura, permitido o bloqueado). Nada de pruebas ocultas que gasten saldo a escondidas.

## Modelo y gasto

- **Leer no gasta; las tareas sí.** `list_models`, `read_file` y mirar el panel son gratis.
- **Empieza por el modelo barato y estable.** Si el usuario eligió uno, no lo cambies.
- **Topes siempre:** pasos y tokens (la casa los declara; `mcp.pasos_max`, `mcp.tokens_max`).
  Si una tarea se para por tope, no la relances igual: mira qué daba vueltas.
- **Los precios cambian.** No los inventes: pídeselos al usuario o míralos en el panel antes
  de prometer un gasto.

## Tropiezos conocidos

- **La ventana que lanzó el panel se cierra** → el panel se para y la tarea se queda a
  medias. Se retoma la sesión diciendo «sigue donde lo dejaste».
- **Para ver código nuevo hay que reiniciar el panel.** Lo que corre es lo instalado, no lo
  escrito en el disco.
- **Comprueba la versión instalada antes de diagnosticar.** Muchos «fallos» son una versión
  vieja: la de RATACODE está en el `package.json` de la instalación, y la dice `ratacode_status`.
- **Ficheros de ajustes con finales de línea Unix.** Editarlos desde Windows con el fin de
  línea equivocado los rompe.
- **Cuidado con las barras invertidas de Windows** al escribir rutas desde un guion: una
  barra suelta se come el carácter siguiente.
- **Las herramientas MCP pueden necesitar aprobación en el cliente.** Si el encargo no
  llega, mira ahí antes de culpar a RATACODE.
- **No termines tu turno con la tarea en marcha** (por stdio la tarea vive lo que vive el
  cliente): o esperas dentro de la llamada, o no paras hasta que diga `completed`/`failed`.
- **No preguntes en bucle.** Preguntar cada segundo no acelera nada y gasta cuota.

## Cómo se comporta RATACODE

Es honesto consigo mismo: con encargos concretos, con límites y con pruebas, rinde mucho y
barato. Con encargos vagos se va por las ramas y gasta. Sus informes tienden a ser largos,
así que ponles tope. **Comprueba siempre lo que dice que comprobó**: cuando escribe «la
prueba pasa», mira la prueba; cuando escribe «no hay rastros de X», busca tú. Y pídele lo que
falló por su parte: lo que no se le pregunta, no lo cuenta.

Si te dice que algo es imposible, pídele la prueba (fichero y línea) antes de aceptarlo. Si
se equivoca, corrígele con el dato delante: una premisa falsa no se obedece.

## Textos de interfaz

Lo que pidas que se escriba en el panel va en el estilo de OpenAI y Anthropic: **pasos
1-2-3**, un botón por acción, frases cortas en presente, nada de explicar las tripas. El
usuario tiene que saber qué hace y qué le va a pasar sin leer un manual.
