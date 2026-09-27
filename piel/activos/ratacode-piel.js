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
 // ── «Copiar apretón» (paso 4a), discreto al pie de la barra lateral ────────
 // El texto lo sirve la propia piel en /ratacode/apreton, con la URL de ESTA
 // casa ya puesta. Aquí sólo se copia al portapapeles.
 function marcar(boton,texto){
  const antes=boton.textContent;
  boton.textContent=texto;boton.dataset.copiado='si';
  setTimeout(()=>{boton.textContent=antes;delete boton.dataset.copiado},2200);
 }
 function copiarAlPortapapeles(texto){
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(texto);
  return new Promise((resuelve,rechaza)=>{
   const caja=document.createElement('textarea');caja.value=texto;caja.setAttribute('readonly','');
   caja.style.position='fixed';caja.style.left='-9999px';document.body.append(caja);caja.select();
   const ok=document.execCommand('copy');caja.remove();
   ok?resuelve():rechaza(new Error('el portapapeles no dejó'));
  });
 }
 async function copiarApreton(boton){
  try{
   const respuesta=await fetch('/ratacode/apreton',{credentials:'same-origin'});
   if(!respuesta.ok)throw new Error('respuesta '+respuesta.status);
   await copiarAlPortapapeles(await respuesta.text());
   marcar(boton,'Copiado ✓');
  }catch(e){marcar(boton,'No se pudo');}
 }
 function montarApreton(){
  const sitio=document.querySelector('[class*="_footArea"]')||document.querySelector('[class*="_sidebarCol"]');
  if(!sitio)return;
  let pie=sitio.querySelector('.mr-pie');
  if(!pie){pie=document.createElement('div');pie.className='mr-pie';sitio.append(pie);}
  if(!pie.querySelector('.mr-apreton')){
   const boton=document.createElement('button');
   boton.type='button';boton.className='mr-apreton';boton.textContent='Copiar apretón';
   boton.title='Copia el apretón de manos de esta casa, con su URL, para pegarlo en un chat';
   boton.setAttribute('aria-label','Copiar el apretón de manos de RATACODE');
   boton.addEventListener('click',()=>{copiarApreton(boton)});
   pie.append(boton);
  }
  // Enlace discreto «Claves»: vuelve a abrir la ventana de las 3 claves, que ya
  // no sale sola si el usuario pulsó «Luego» (ratacode-claves.js).
  if(!pie.querySelector('.mr-claves')){
   const boton=document.createElement('button');
   boton.type='button';boton.className='mr-claves';boton.textContent='Claves';
   boton.title='Volver a abrir la ventana de las 3 claves de RATACODE';
   boton.setAttribute('aria-label','Abrir la ventana de las 3 claves de RATACODE');
   boton.addEventListener('click',()=>{if(typeof window.__ratacodeAbrirClaves==='function')window.__ratacodeAbrirClaves();});
   pie.append(boton);
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
  const input=document.querySelector('[data-composer-input]');if(input)input.setAttribute('aria-label','Mensaje para RATACODE');
  const search=document.querySelector('[class*="_searchInput"]');if(search)search.setAttribute('placeholder','Buscar sesiones…');
  montarApreton();
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
})();
