/* RATACODE · sólo rótulos de interfaz; nunca recorrer el contenido de las conversaciones. */
(() => {
 // ── el título de la pestaña: SIEMPRE «<sesión> — RATACODE» ────────────────
 // El frontend escribe el título desde `dsh-client-ui-layout/lib/client.js:62`:
 //   document.title = title === undefined ? productTitle : `${title} — ${productTitle}`
 // y su `productTitle` es la cadena "DeepSeek Harness" (:263). En vez de pelearse
 // con React, se intercepta la PROPIEDAD: cualquier asignación pasa por aquí y
 // sale con RATACODE. Así nunca se ve «DeepSeek Harness», póngalo quien lo ponga.
 try{
  const d=Object.getOwnPropertyDescriptor(Document.prototype,'title');
  if(d&&d.set&&d.get){
   Object.defineProperty(document,'title',{configurable:true,enumerable:true,
    get(){return d.get.call(document)},
    set(v){d.set.call(document,String(v).replace(/DeepSeek Harness/gi,'RATACODE'))}});
   document.title=document.title; // normaliza lo que ya estuviera puesto
  }
 }catch(e){/* si no se puede, queda el reemplazo del index y el de apply() */}
 window.__ratacodeSkinObserver?.disconnect();
 document.documentElement.dataset.ratacodePiel='punk-1';
 const labels=new Map([['New Session','Nueva sesión'],['New session','Nueva sesión'],['Workspaces','Espacios de trabajo'],['Settings','Ajustes'],['Session log','Registro'],['Trajectory','Actividad'],['Collapse sidebar','Recoger barra lateral'],['Expand sidebar','Mostrar barra lateral'],['Search sessions','Buscar sesiones'],['Add workspace','Añadir espacio de trabajo'],['View options','Opciones de vista'],['No sessions yet','Todavía no hay sesiones'],['Choose workspace','Elegir espacio de trabajo']]);
 // La caja del encargo pone su texto desde el diccionario del frontend
 // (`dsh-client-ui-conversation/lib/client.js`, claves `placeholder.default`,
 // `placeholder.hero` y `placeholder.workspace`) y React lo reescribe al
 // cambiar de vista. Por eso NO se fuerza un texto fijo: se traduce el que
 // haya, para no pisar el estado (hero, sesión o «elige espacio»).
 const PLACEHOLDERS=new Map([
  ['Message or run a task, / commands, @ files or sessions','Escribe tu encargo… / comandos · @ archivos y sesiones'],
  ['Describe what you want to build, / commands, @ files or sessions','Describe lo que quieres construir… / comandos · @ archivos y sesiones'],
  ['Choose a workspace to start','Elige un espacio de trabajo para empezar'],
  ['Session unavailable','Sesión no disponible'],
 ]);
 const placeholder='Escribe tu encargo… / comandos · @ archivos y sesiones';
 const normalizar=(t)=>String(t==null?'':t).replace(/\s+/g,' ').trim();
 // El frontend pone el texto de la caja en TRES sitios a la vez
 // (`dsh-client-ui-conversation/lib/client.js`: el div `[data-composer-placeholder]`,
 // el atributo `data-placeholder` del editor y su `aria-label`), y puede tener
 // MÁS DE UNA caja montada (la portada y la de la sesión): traducir sólo la
 // primera —que es lo que se hacía— dejaba la de la sesión en inglés. Se
 // traducen todas, y por el texto que ponga el frontend, sin forzar uno fijo.
 function traducirCajas(){
  document.querySelectorAll('[data-composer-placeholder]').forEach(el=>{
   const suyo=normalizar(el.textContent);
   const traducido=PLACEHOLDERS.get(suyo);
   if(traducido){if(normalizar(el.textContent)!==traducido)el.textContent=traducido;}
   else if(suyo==='')el.textContent=placeholder;
  });
  document.querySelectorAll('[data-placeholder]').forEach(el=>{
   const suyo=normalizar(el.getAttribute('data-placeholder'));
   const traducido=PLACEHOLDERS.get(suyo);
   if(traducido&&suyo!==traducido)el.setAttribute('data-placeholder',traducido);
   const etiqueta=normalizar(el.getAttribute('aria-label'));
   const traducida=PLACEHOLDERS.get(etiqueta)||labels.get(etiqueta);
   if(traducida&&etiqueta!==traducida)el.setAttribute('aria-label',traducida);
  });
 }
 function wordmark(){
  const word=document.createElement('span');word.className='mr-wordmark mr-dsh-word';word.append('RATA');
  const code=document.createElement('b');code.textContent='CODE';word.append(code);
  return word;
 }
 // ── R12 · LA VENTANA NATIVA DE DSH, QUE LLEVE A AJUSTES › MODELS ───────────
 // DSH saca su propia ventana de primera vez, «Add an API key to get started»,
 // PERO SÓLO PIDE LA CLAVE DE DEEPSEEK («Configure the official DeepSeek
 // provider…», dsh-client-ui-settings-models/lib/client.js:2743-2747) y hay que
 // desmontarla con su «Configure later» (:2745). RATACODE tiene 8 APIs y 2
 // motores locales (los locales tienen su pestaña desde R18), así que esa
 // ventana estorba a quien use Groq, Gemini, SambaNova…: en vez de taparla (lo
 // que hacía la ventana de las 3 claves, ya retirada), se le mete una nota en
 // español y un botón que la cierra y abre Ajustes › Models.
 const TITULOS_NATIVOS=['Add an API key to get started','添加一个 API Key 开始使用'];
 const ATRAS_NATIVOS=['Configure later','稍后配置'];
 const PROVEEDORES='B.AI, OpenRouter, DeepSeek, Groq, Google Gemini, NVIDIA NIM, SambaNova y Cloudflare Workers AI (las APIs, que van con clave)';
 /** Abre Ajustes y deja seleccionada una sección del menú (el panel abre en General). */
 function abrirAjustesSeccion(nombre){
  const disparador=Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
   .find(b=>['Ajustes','Settings'].indexOf((b.getAttribute('aria-label')||'').trim())!==-1);
  if(!disparador)return false;
  disparador.click();
  const buscar=()=>{
   const fila=Array.from(document.querySelectorAll('[class*="_navList"] button'))
    .find(b=>(b.textContent||'').trim()===nombre);
   if(fila)fila.click();
  };
  setTimeout(buscar,60);setTimeout(buscar,240);
  return true;
 }
 /** Abre Ajustes y deja seleccionado «Models». */
 function abrirAjustesModels(){return abrirAjustesSeccion('Models');}
 /** R18 · Abre Ajustes y deja seleccionado «Modelos locales». */
 function abrirAjustesLocales(){return abrirAjustesSeccion('Modelos locales');}
 /** ¿Ese nodo es la ventana nativa de DSH que sólo pide la clave de DeepSeek? */
 function contenedorNativo(hijo){
  const h2s=hijo.querySelectorAll?hijo.querySelectorAll('h2'):[];
  for(const t of h2s){if(TITULOS_NATIVOS.indexOf((t.textContent||'').trim())!==-1)return true;}
  return false;
 }
 function guiarNativa(){
  for(const hijo of Array.from(document.body.children)){
   if(hijo.nodeType!==1||!contenedorNativo(hijo))continue;
   if(hijo.querySelector('.mr-guia'))continue;
   // La nota va DENTRO del cuadro del diálogo, no al lado: el contenedor de la
   // ventana nativa es un flex de pantalla completa con la máscara dentro
   // (`_root_…` → `_mask_…` + `_dialog_…`), y añadida al lado desplazaba el
   // cuadro y quedaba a merced de la máscara. Medido el 28-sep-2026.
   const caja=hijo.querySelector('[role="dialog"]')||hijo;
   const nota=document.createElement('div');
   nota.className='mr-guia';
   const linea=document.createElement('div');
   linea.append('RATACODE trae ');
   const fuerte=document.createElement('b');fuerte.textContent='8 APIs y 2 motores locales';linea.append(fuerte);
   linea.append(': '+PROVEEDORES+'; Ollama y LM Studio, que no piden clave, tienen su propia pestaña (Ajustes › Modelos locales). Esta ventana sólo pide la clave de DeepSeek.');
   const boton=document.createElement('button');
   boton.type='button';boton.className='mr-guia-boton';
   boton.textContent='Usar otro proveedor: abrir Ajustes › Models';
   boton.addEventListener('click',()=>{
    let atras=null;
    for(const b of caja.querySelectorAll('button')){
     if(ATRAS_NATIVOS.indexOf((b.textContent||'').trim())!==-1){atras=b;break;}
    }
    if(atras){try{atras.click();}catch(e){/* da igual: el botón de Ajustes abre igual */}}
    const raiz=document.getElementById('root');
    if(raiz&&raiz.inert)raiz.inert=false;
    setTimeout(()=>{abrirAjustesModels();},120);
   });
   nota.append(linea,boton);
   caja.append(nota);
   return true;
  }
  return false;
 }
 function vigilarNativa(){
  guiarNativa();
  let pendiente=false;
  const mo=new MutationObserver(()=>{
   if(pendiente)return;
   pendiente=true;
   setTimeout(()=>{pendiente=false;guiarNativa();},60);
  });
  mo.observe(document.body,{childList:true,subtree:true});
 }
 // ── R17 · LA CLAVE QUE FALTA (y el error del motor, en español) ─────────────
 // El motor ya NO saca su ventana «Add an API key to get started»: con Ollama y
 // LM Studio declarados sin clave, `providerUsable` da la casa por lista, así
 // que un usuario sin claves abría el panel con el modelo de fábrica (B.AI) y se
 // comía el MISSING_CREDENTIAL en inglés. La piel pregunta por su ruta
 // `/ratacode/clave` —que responde con el `describe` del servicio de credenciales
 // del motor: aquí no se lee ningún fichero de claves— si al modelo por defecto
 // de la casa le falta la clave, y avisa en español ENCIMA de la caja de escribir.
 // El aviso se va solo: cada 3 s (y al volver a la pestaña) se vuelve a mirar.
 const AVISO_CLAVE='mr-clave';
 const MENCION_PROVEEDOR=/provider route "([^"]+)"/;
 let claveVista=null; // lo último que dijo el motor; null = no hay nada que avisar
 let nombresVistos={}; // ruta del proveedor → nombre visible, aunque no falte clave
 function textoDeLaClave(d){
  // R23 · una línea y un botón, y nada más:
  //   · un modelo LOCAL no necesita clave: lo que pasa es que su motor está apagado;
  //   · una API, si le falta la clave, se dice en cuatro palabras.
  if(d.local&&d.local.encendido===false){
   return (d.local.nombre||d.nombre||d.proveedor)+' está apagado.';
  }
  return 'Falta la clave de '+(d.nombre||d.proveedor)+'.';
 }
 /** El botón del aviso: al runtime local apagado se le lleva a SU pestaña. */
 function botonDeAviso(esLocal){
  const boton=document.createElement('button');
  boton.type='button';boton.className='mr-clave-boton';boton.dataset.tipo=esLocal?'local':'clave';
  boton.textContent=esLocal?'Abrir Ajustes › Modelos locales':'Abrir Ajustes › Models';
  boton.addEventListener('click',()=>{if(esLocal)abrirAjustesLocales();else abrirAjustesModels();});
  return boton;
 }
 /** ¿Este aviso es por una clave que falta (no por un runtime local apagado)? */
 function esAvisoDeClave(d){return !(d&&d.local&&d.local.encendido===false);}
 function botonDeAjustes(){return botonDeAviso(false);}
 function quitarAvisoClave(){
  document.querySelectorAll('.'+AVISO_CLAVE).forEach(n=>n.remove());
 }
 /** El aviso, encima de CADA caja de escribir montada (la portada y la sesión). */
 function pintarAvisoClave(){
  if(claveVista===null){quitarAvisoClave();return;}
  const texto=textoDeLaClave(claveVista);
  const esLocal=!esAvisoDeClave(claveVista);
  for(const caja of document.querySelectorAll('[data-composer-card]')){
   const padre=caja.parentElement;if(!padre)continue;
   // Se busca entre los hermanos, no sólo el de justo antes: el aviso de
   // migración también va encima de la caja y, si no, se duplican sin fin.
   let aviso=padre.querySelector(':scope > .'+AVISO_CLAVE);
   if(!aviso){
    aviso=document.createElement('div');aviso.className=AVISO_CLAVE;
    aviso.append(Object.assign(document.createElement('span'),{className:'mr-clave-texto'}));
    padre.insertBefore(aviso,caja);
   }
   const suyo=aviso.querySelector('.mr-clave-texto');
   if(suyo&&suyo.textContent!==texto)suyo.textContent=texto;
   let boton=aviso.querySelector('.mr-clave-boton');
   if(boton&&boton.dataset.tipo!==(esLocal?'local':'clave')){boton.remove();boton=null;}
   if(!boton)aviso.append(botonDeAviso(esLocal));
  }
 }
 /** Pregunta a la piel del motor si falta la clave (o si el local está apagado). */
 function mirarClave(){
  return fetch('/ratacode/clave',{credentials:'same-origin',cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(d=>{
    if(d&&d.proveedores)nombresVistos=d.proveedores;
    const apagadoLocal=d&&d.ok===true&&d.local&&d.local.encendido===false;
    claveVista=d&&d.ok===true&&(d.falta===true||apagadoLocal)?d:null;
    pintarAvisoClave();arreglarErrorDeClave();
   })
   .catch(()=>{/* sin ruta (motor viejo) o sin conexión: ni un aviso de más */});
 }
 // El error del turno (R17 §2): el motor lo pinta con su código en inglés
 // (`dsh-client-ui-chat`: `turnErrorRow` + `turnErrorCopy` + `turnErrorCode`).
 // Se reescribe ESE cuadro —y sólo ése: no se recorre ninguna conversación—
 // para que diga lo mismo, en español, con el botón.
 function arreglarErrorDeClave(){
  document.querySelectorAll('[class*="_turnErrorRow"]').forEach(fila=>{
   const codigo=fila.querySelector('[class*="_turnErrorCode"]');
   if(!codigo||(codigo.textContent||'').trim()!=='MISSING_CREDENTIAL')return;
   const copia=fila.querySelector('[class*="_turnErrorCopy"]');if(!copia)return;
   if(copia.querySelector('.mr-clave-boton'))return;
   const mensaje=(fila.querySelector('[class*="_turnErrorMessage"]')||{}).textContent||'';
   const m=MENCION_PROVEEDOR.exec(mensaje);
   const proveedor=m?m[1]:null;
   const nombre=nombresVistos[proveedor]||proveedor||'el modelo';
   const titulo=copia.querySelector('[class*="_turnErrorTitle"]');
   const cuerpo=copia.querySelector('[class*="_turnErrorMessage"]');
   const suTitulo='Falta la clave de '+nombre+'.';
   const suCuerpo='Pégala en RATACODE › Ajustes › Models.';
   // Sólo se escribe si de verdad cambia: escribir lo mismo dispara otra vuelta
   // del observador y esto se quedaría girando sin parar.
   if(titulo&&titulo.textContent!==suTitulo)titulo.textContent=suTitulo;
   if(cuerpo&&cuerpo.textContent!==suCuerpo)cuerpo.textContent=suCuerpo;
   copia.append(botonDeAjustes());
  });
 }
 // ── R18 · LOS LOCALES NO SE MEZCLAN CON LAS APIs ───────────────────────────
 // Ajustes › Models los pinta el frontend desde `llm/listProviders` +
 // `llm/listConfigurableProviders` (dsh-client-ui-settings-models/lib/client.js:
 // 991-995 y 2013, `_rowCard`), y esa lista NO tiene ningún gancho oficial para
 // filtrar filas (medido: no hay slot ni campo `hidden` en el esquema,
 // dsh-llm/lib/typert.host.js:17-28). La vía limpia que queda es el filtro de la
 // PIEL sobre la lista ya pintada: se esconden las DOS filas de los locales
 // (por su nombre visible, el de fabrica/settings.yaml) y se deja una nota que
 // lleva a su pestaña. Los locales SIGUEN declarados en la casa, así que el
 // selector de modelos de la caja los sigue ofreciendo igual.
 const NOMBRES_LOCALES=['Ollama (local, sin clave)','LM Studio (local, sin clave)'];
 const NOTA_LOCALES='mr-locales-nota';
 function ocultarLocalesEnModels(){
  let seccion=null;
  document.querySelectorAll('[class*="_rowCard"]').forEach(fila=>{
   const nombre=fila.querySelector('[class*="_rowName"]');
   const suyo=nombre?(nombre.textContent||'').trim():'';
   if(suyo==='')return;
   // El prefijo vale también para nombres largos («Ollama (local, sin clave)»).
   const local=NOMBRES_LOCALES.some(n=>suyo===n||suyo.indexOf(n)===0);
   if(local){
    if(fila.style.display!=='none')fila.style.display='none';
    if(seccion===null)seccion=fila.closest('[class*="_section"]');
    return;
   }
   // Si el usuario vuelve a Models tras un cambio, ninguna otra fila se toca.
   if(fila.style.display==='none')fila.style.display='';
  });
  if(seccion===null||seccion.querySelector('.'+NOTA_LOCALES))return;
  const lista=seccion.querySelector('[class*="_rows"]');
  const nota=document.createElement('p');
  nota.className=NOTA_LOCALES;
  nota.append('Ollama y LM Studio (sin clave) están en ');
  const boton=document.createElement('button');
  boton.type='button';boton.className='mr-clave-boton';
  boton.textContent='Abrir Ajustes › Modelos locales';
  boton.addEventListener('click',()=>{abrirAjustesLocales();});
  nota.append(boton);
  if(lista&&lista.parentElement)lista.parentElement.insertBefore(nota,lista);
  else seccion.append(nota);
 }
 // ── R22 §4 · EL AVISO DE MIGRACIÓN DE CLAVES (una línea, y no vuelve) ──────
 // La primera vez que esta casa arranca con la versión que ya NO lee claves del
 // entorno, si en Windows hay variables de claves de proveedores, la piel lo dice
 // en UNA línea encima de la caja —«Tienes B_AI_API_KEY en Windows. RATACODE ya
 // no la usa: pega tu clave en Ajustes › Models.»— con su botón de cerrar. Al
 // cerrarlo se apunta en la casa y no vuelve nunca más.
 const AVISO_MIGRACION='mr-migracion';
 function quitarAvisoMigracion(){
  document.querySelectorAll('.'+AVISO_MIGRACION).forEach(n=>n.remove());
 }
 function pintarAvisoMigracion(texto){
  for(const caja of document.querySelectorAll('[data-composer-card]')){
   const padre=caja.parentElement;if(!padre)continue;
   const previo=padre.querySelector(':scope > .'+AVISO_MIGRACION);
   if(previo){
    const suyo=previo.querySelector('.mr-migracion-texto');
    if(suyo&&suyo.textContent!==texto)suyo.textContent=texto;
    continue;
   }
   const aviso=document.createElement('div');aviso.className=AVISO_MIGRACION;
   aviso.append(Object.assign(document.createElement('span'),{className:'mr-migracion-texto',textContent:texto}));
   const cerrar=document.createElement('button');
   cerrar.type='button';cerrar.className='mr-migracion-cerrar';cerrar.textContent='Cerrar';
   cerrar.addEventListener('click',()=>{
    quitarAvisoMigracion();
    fetch('/ratacode/migracion',{method:'POST',credentials:'same-origin',cache:'no-store'}).catch(()=>{});
   });
   aviso.append(cerrar);
   padre.insertBefore(aviso,caja);
  }
 }
 function mirarMigracion(){
  return fetch('/ratacode/migracion',{credentials:'same-origin',cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .then(d=>{
    if(d&&d.aviso&&typeof d.aviso.texto==='string')pintarAvisoMigracion(d.aviso.texto);
    else quitarAvisoMigracion();
   })
   .catch(()=>{/* motor viejo o sin conexión: ni un aviso de más */});
 }
 // ── R23 · LOS MODOS, EN 3×3 ────────────────────────────────────────────────
 // La pestaña de modos la pinta el plugin de presets del motor: tarjetas en dos
 // columnas con scroll, la etiqueta «Custom», el id técnico, los iconos de
 // carpeta/duplicar/borrar y una frase en inglés. No hay slot para sustituirla,
 // así que la piel la ORDENA encima: se marca la sección (sólo lo marcado se
 // toca), se renombra a «Modos», cada tarjeta se queda con su NOMBRE grande (con
 // el color de su personaje), su oficio en UNA línea y «En uso» en el que manda,
 // y los iconos se esconden detrás de un «⋯». El CSS hace la cuadrícula de 3×3.
 // R21 §6: la sección se reconoce por su frase de entrada, y desde que el panel
 // va en español (vía oficial de idiomas) la frase llega en español: se
 // reconocen las DOS, para que la cuadrícula 3×3 no se caiga al traducir.
 const MODOS_TITULO='Modos';
 const MODOS_ORIGEN=/^(A preset is the plugin composition|Un preset es la composición de plugins)/;
 const MODOS_COLOR={
  'MODO-RATA':'#ff268e','ARQUITECTO':'#e4f226','CAPATAZ':'#26c6cc','HERO':'#ff8a3d','TIRITA':'#7dd3fc',
  'GEPETO':'#c084fc','FARO':'#f5d90a','PIX':'#4ade80','NEX':'#f87171'
 };
 const MODOS_LINEA={
  'MODO-RATA':'Tareas normales.',
  'ARQUITECTO':'Decide cómo se construye.',
  'CAPATAZ':'Convierte el objetivo en plan.',
  'HERO':'Las manos: implementa.',
  'TIRITA':'Cura fallos: causa y arreglo.',
  'GEPETO':'Segunda opinión y pesquisa.',
  'FARO':'Escribe claro y sin inventar.',
  'PIX':'Un solo programa.',
  'NEX':'Modos y plugins.'
 };
 function arreglarModos(){
  // El menú de Ajustes: «Agent presets» se llama «Modos». R21 §6: el rótulo se
  // cambia SÓLO en su texto —antes se pisaba `textContent` del botón entero, y
  // eso se llevaba por delante el ICONO de la fila—. El nombre puede llegar en
  // inglés (motor sin diccionario) o ya en español (R21, vía oficial de
  // idiomas: `settings.agentPreset.nav` = «Presets de agente»); los dos valen.
  const NOMBRES_MODOS=['Agent presets','Presets de agente'];
  for(const b of document.querySelectorAll('[class*="_navList"] button')){
   const etiqueta=b.querySelector('[class*="_navLabel"]')||b;
   if(NOMBRES_MODOS.indexOf((etiqueta.textContent||'').trim())!==-1&&etiqueta.textContent!==MODOS_TITULO)etiqueta.textContent=MODOS_TITULO;
  }
  // La sección: se reconoce por su frase de entrada (en inglés o ya en español,
  // que es como llega desde R21 por la vía oficial de idiomas), y se marca.
  let seccion=null;
  for(const p of document.querySelectorAll('p[class*="_intro"]')){
   if(MODOS_ORIGEN.test((p.textContent||'').trim())){seccion=p.closest('[class*="_section"]');break;}
  }
  if(!seccion)return;
  seccion.classList.add('mr-modos');
  const titulo=seccion.querySelector('h2[class*="_title"]');
  if(titulo&&(titulo.textContent||'').trim()!==MODOS_TITULO)titulo.textContent=MODOS_TITULO;
  for(const cab of seccion.querySelectorAll('[class*="_groupHead"]')){if(cab.style.display!=='none')cab.style.display='none';}
  for(const tarjeta of seccion.querySelectorAll('li[class*="_card"]')){
   const nombre=(tarjeta.querySelector('[class*="_cardName"]')?.textContent||'').trim();
   const elNombre=tarjeta.querySelector('[class*="_cardName"]');
   const color=MODOS_COLOR[nombre];
   if(elNombre&&color!==undefined&&elNombre.style.color!=='rgb('+[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(', ')+')'){
    elNombre.style.color=color;
   }
   // Fuera las etiquetas «Custom»/«Built-in» —y sus versiones en español—;
   // «In use» pasa a «En uso» (aquí ya llega traducido, pero se deja por si el
   // motor vuelve a pintarlo en inglés al cambiar de idioma).
   for(const etiqueta of tarjeta.querySelectorAll('[class*="_cardHead"] > span')){
    const suyo=(etiqueta.textContent||'').trim();
    if(suyo==='Custom'||suyo==='Built-in'||suyo==='Personalizado'||suyo==='De serie'){if(etiqueta.style.display!=='none')etiqueta.style.display='none';}
    else if(suyo==='In use')etiqueta.textContent='En uso';
   }
   // El oficio, en UNA línea (el suyo, corto; el del fichero es un párrafo).
   const desc=tarjeta.querySelector('[class*="_cardDesc"]');
   const linea=MODOS_LINEA[nombre];
   if(desc&&linea!==undefined&&(desc.textContent||'').trim()!==linea)desc.textContent=linea;
   // Los iconos, detrás de un «⋯» discreto.
   const pie=tarjeta.querySelector('[class*="_cardFoot"]');
   if(pie&&!tarjeta.querySelector('.mr-modos-puntos')){
    const puntos=document.createElement('button');
    puntos.type='button';puntos.className='mr-modos-puntos';puntos.textContent='⋯';
    puntos.setAttribute('aria-label','Más acciones: '+nombre);
    puntos.addEventListener('click',(ev)=>{
     ev.stopPropagation();
     tarjeta.dataset.abierto=tarjeta.dataset.abierto==='si'?'no':'si';
    });
    tarjeta.insertBefore(puntos,pie);
   }
  }
 }
 function apply(){
  const title=document.title.replace(/DeepSeek Harness/gi,'RATACODE');if(title!==document.title)document.title=title;
  // Sólo el saludo nativo del motor: nunca mensajes, nombres de modelo ni errores.
  const hero=document.querySelector('[data-phase="hero"] [class*="_headline"]');
  if(hero){
   hero.classList.add('mr-welcome');
   const mark=hero.querySelector('[class*="_fishHitbox"]');
   if(mark){mark.classList.add('mr-welcome-mark');mark.setAttribute('role','img');mark.setAttribute('aria-label','Emblema RATACODE');}
   const group=hero.querySelector('[class*="_titleGroup"]');
   const heading=group?.firstElementChild;
   if(heading&&heading.textContent!=='RATACODE'){heading.textContent='RATACODE';heading.classList.add('mr-welcome-title');}
   const badge=hero.querySelector('[class*="_previewBadge"]');
   if(badge&&badge.textContent!=='TRABAJO BRUTO. CONTROL TOTAL.')badge.textContent='TRABAJO BRUTO. CONTROL TOTAL.';
  }
  document.querySelectorAll('[class*="_sidebarCol"] button, [class*="_sidebarCol"] [class*="_empty"], [data-phase="hero"] [class*="_workspace"]').forEach(e=>{
   for(const attr of ['aria-label','title']){const value=e.getAttribute(attr);if(labels.has(value))e.setAttribute(attr,labels.get(value));}
   if(!e.childElementCount&&labels.has(e.textContent.trim()))e.textContent=labels.get(e.textContent.trim());
  });
  const brand=document.querySelector('[class*="_brandName"]');
  if(brand&&!brand.querySelector('.mr-dsh-word')){
   const word=document.createElement('span');word.className='mr-dsh-word';word.append('RATA');
   const code=document.createElement('b');code.textContent='CODE';word.append(code);
   brand.append(word);
  }
  const header=document.querySelector('header[class*="_header"]');
  if(header&&!header.querySelector('.mr-dsh-kicker')){const kicker=document.createElement('div');kicker.className='mr-dsh-kicker';kicker.append(wordmark(),' / TRABAJO BRUTO. CONTROL TOTAL.');header.prepend(kicker)}
  // Los rótulos también viven en la portada y en la tarjeta de la caja, no sólo
  // en la columna y la cabecera: «Choose workspace» sale en la portada.
  document.querySelectorAll('[class*="_sidebarCol"] button, header button, [data-phase="hero"] button, [data-phase="hero"] [role="button"], [data-composer-card] button').forEach(root=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
   while((n=walker.nextNode())){const text=n.nodeValue.trim();if(labels.has(text))n.nodeValue=n.nodeValue.replace(text,labels.get(text));}
  });
  document.querySelectorAll('[data-slot="sidebar.workspaces"] [class*="_sectionLabel"]').forEach(e=>{if(e.textContent==='Workspaces')e.textContent='Espacios de trabajo';});
  document.querySelectorAll('[data-slot="sidebar.workspaces"] [class*="_projectRow"] [class*="_title"]').forEach(e=>{if(e.textContent==='Ungrouped')e.textContent='Sin agrupar';});
  // «Show N more sessions», en cristiano: el número CAMBIA, así que no vale un rótulo fijo: se lee.
  document.querySelectorAll('[class*="_sessionOverflowButton"], [data-slot="sidebar.workspaces"] button, [data-slot="sidebar.workspaces"] span').forEach(e=>{
   if(e.childElementCount)return;
   const m=(e.textContent||'').trim().match(/^Show\s+(\d+)\s+more\s+sessions?$/i);
   if(m)e.textContent=(m[1]==='1')?'Ver 1 sesión más':('Ver '+m[1]+' sesiones más');
  });
  // La caja: se traduce el texto que ponga el frontend, no se fuerza uno fijo.
  traducirCajas();
  // R17: el aviso de la clave que falta y el error del motor, en español. Se
  // repintan aquí porque React reescribe el cuadro de la caja al re-renderizar.
  pintarAvisoClave();
  arreglarErrorDeClave();
  // R18: en Ajustes › Models sólo quedan las APIs con clave.
  ocultarLocalesEnModels();
  // R23: los modos, en 3×3 y en cristiano.
  arreglarModos();
  const input=document.querySelector('[data-composer-input]');if(input)input.setAttribute('aria-label','Mensaje para RATACODE');
  const search=document.querySelector('[class*="_searchInput"]');if(search)search.setAttribute('placeholder','Buscar sesiones…');
 }
 apply();
 // ── volver a aplicar cuando el frontend reescribe ────────────────────────
 // Dos cosas aprendidas a golpes (R5, medido en el DOM real):
 //  1) React escribe el texto de la caja en ATRIBUTOS (`data-placeholder`,
 //     `aria-label`) al re-renderizar. Un observador sólo de
 //     `childList`/`characterData` no ve eso: los valores se quedaban en inglés.
 //  2) El rebote con `requestAnimationFrame` se queda colgado cuando la pestaña
 //     deja de pintar (segundo plano, ventana tapada): `pending` se quedaba en
 //     true y el observador dejaba de aplicar NADA. Con `setTimeout` no pasa.
 let pending=false;
 const correr=()=>{if(!pending)return;pending=false;apply()};
 const programar=()=>{if(pending)return;pending=true;setTimeout(correr,16)};
 const observer=new MutationObserver(programar);
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-placeholder','aria-label']});
 window.__ratacodeSkinObserver=observer;
 // Y si la pestaña vuelve a primer plano, una pasada más: barato y cierra el
 // hueco de lo que pasó mientras no se pintaba.
 document.addEventListener('visibilitychange',programar);
 window.addEventListener('focus',programar);
 // R12: la ventana nativa de DSH (sólo DeepSeek) lleva una nota y un botón a
 // Ajustes › Models. Un solo vigilante, montado una sola vez.
 vigilarNativa();
 // R17: la clave que falta, mirada al abrir, cada 3 s y al volver a la pestaña.
 // Así el aviso se va SOLO en cuanto se guarda la clave o se elige un modelo
 // que la tenga (y vuelve si se elige uno que no la tenga), sin recargar nada.
 mirarClave();
 setInterval(mirarClave,3000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)mirarClave();});
 window.addEventListener('focus',()=>{mirarClave();});
 // R22 §4: el aviso de migración de claves, al abrir y cada 5 s (se va en cuanto
 // el usuario lo cierra: la casa apunta que ya lo ha visto).
 mirarMigracion();
 setInterval(mirarMigracion,5000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)mirarMigracion();});
})();
