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
 // desmontarla con su «Configure later» (:2745). RATACODE tiene 10 proveedores
 // (los 9 declarados en fabrica/settings.yaml + el DeepSeek nativo), así que esa
 // ventana estorba a quien use Groq, Gemini, SambaNova…: en vez de taparla (lo
 // que hacía la ventana de las 3 claves, ya retirada), se le mete una nota en
 // español y un botón que la cierra y abre Ajustes › Models.
 const TITULOS_NATIVOS=['Add an API key to get started','添加一个 API Key 开始使用'];
 const ATRAS_NATIVOS=['Configure later','稍后配置'];
 const PROVEEDORES='B.AI, OpenRouter, DeepSeek, Groq, Google Gemini, NVIDIA NIM, SambaNova, Cloudflare Workers AI y dos locales sin clave: Ollama y LM Studio';
 function contenedorNativo(hijo){
  const h2s=hijo.querySelectorAll?hijo.querySelectorAll('h2'):[];
  for(const t of h2s){if(TITULOS_NATIVOS.indexOf((t.textContent||'').trim())!==-1)return true;}
  return false;
 }
 /** Abre Ajustes y deja seleccionado «Models» (el panel abre en General). */
 function abrirAjustesModels(){
  const disparador=Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
   .find(b=>['Ajustes','Settings'].indexOf((b.getAttribute('aria-label')||'').trim())!==-1);
  if(!disparador)return false;
  disparador.click();
  const buscar=()=>{
   const fila=Array.from(document.querySelectorAll('[class*="_navList"] button'))
    .find(b=>(b.textContent||'').trim()==='Models');
   if(fila)fila.click();
  };
  setTimeout(buscar,60);setTimeout(buscar,240);
  return true;
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
   const fuerte=document.createElement('b');fuerte.textContent='10 proveedores';linea.append(fuerte);
   linea.append(': '+PROVEEDORES+'. Esta ventana sólo pide la clave de DeepSeek.');
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
})();
