import { productImages } from './product-images.js';
// El navegador conserva únicamente el token de esta pestaña. Nunca guarda contraseñas.
const root=document.querySelector('#app');
let token=sessionStorage.getItem('jaguar-panel-token'), user=null, page='overview', search='';
let data={clients:[],models:[],units:[],summary:{}}, pending=false;
let requests=new AbortController();
const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={overview:'◫',units:'▣',models:'◇',clients:'◎'};
const titles={overview:'Vista general',units:'Unidades',models:'Catálogo',clients:'Clientes'};

// Todas las llamadas usan el mismo origen y el permiso interno lo decide la API.
async function api(path,options={}) {
  const response=await fetch(`/api${path}`,{...options,signal:requests.signal,
    headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}});
  if (!response.ok) {
    const message=(await response.json().catch(()=>null))?.error || 'No se ha podido completar la operación.';
    if (response.status===401 && user) reset();
    throw new Error(message);
  }
  return options.pdf?response.blob():response.json();
}
function reset() {
  requests.abort(); requests=new AbortController(); token=null; user=null;
  sessionStorage.removeItem('jaguar-panel-token'); data={clients:[],models:[],units:[],summary:{}};
  login();
}
function brand() { return '<span class="brand-mark">J</span><span>JAGUAR<small>INDUSTRIAS · PANEL INTERNO</small></span>'; }
// Pantalla de acceso: primero autentica la contraseña y después comprueba el permiso
// del panel. Si falta ese permiso, revoca la sesión recién creada y muestra el motivo.
function login(message='') {
  root.innerHTML=`<main class="login"><section class="login-story"><a class="brand" href="/">${brand()}</a>
    <div><p class="eyebrow">EQUIPOS CON HISTORIA</p><h1>Todo el equipo.<br>En un solo lugar.</h1>
    <p>Del catálogo a cada unidad. Gestiona los equipos Jaguar y su relación con cada cliente.</p></div>
    <footer>Elevación · Tracción · Sujeción</footer></section>
    <section class="login-form"><div class="login-box"><p class="eyebrow">ÁREA DE GESTIÓN</p><h2>Bienvenido a Jaguar</h2>
    <p class="muted">Accede con tu cuenta autorizada para el panel interno.</p>
    <form id="login"><label>Correo electrónico<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="nombre@empresa.com"></label>
    <label>Contraseña<input name="password" type="password" autocomplete="current-password" required maxlength="1024"></label>
    <p class="error" role="alert" id="login-error">${esc(message)}</p><button class="primary" type="submit">Entrar al panel <span>→</span></button></form>
    <p class="login-note">¿Necesitas acceso? Solicítalo al responsable de Jaguar.</p></div></section></main>`;
  document.querySelector('#login').onsubmit=async event=>{
    event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button'); button.disabled=true; button.textContent='Comprobando acceso…';
    try {
      const fields=new FormData(form);
      const session=await api('/auth/login',{method:'POST',body:JSON.stringify({email:fields.get('email'),password:fields.get('password')})});
      form.reset(); token=session.token;
      try { user=(await api('/panel/me')).user; }
      catch(error) { await api('/auth/logout',{method:'POST'}).catch(()=>{}); token=null; throw error; }
      sessionStorage.setItem('jaguar-panel-token',token); await load();
    } catch(error) { document.querySelector('#login-error')?.replaceChildren(document.createTextNode(error.message)); }
    finally { if (button.isConnected) { button.disabled=false; button.innerHTML='Entrar al panel <span>→</span>'; } }
  };
}
// Recorre los cursores: las opciones de formularios y búsquedas incluyen todas las páginas.
async function list(section) {
  const items=[]; let cursor=null;
  do { const result=await api(`/panel/${section}${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`); items.push(...result.items); cursor=result.nextCursor; } while(cursor);
  return items;
}
async function load() {
  shell('<p class="loading">Cargando datos de Jaguar…</p>');
  try {
    const [clients,models,units,summary]=await Promise.all([list('clients'),list('models'),list('units'),api('/panel/summary')]);
    if (!user) return;
    data={clients,models,units,summary}; render();
  } catch(error) { if (user) { shell(`<div class="empty"><h2>No se han podido cargar los datos</h2><p>${esc(error.message)}</p><button id="retry">Reintentar</button></div>`); document.querySelector('#retry').onclick=load; } }
}
// Marco común de las pantallas. La navegación cambia solo el contenido y el buscador;
// el perfil procede de la sesión comprobada, nunca de datos introducidos en el formulario.
function shell(content) {
  if (!user) return;
  root.innerHTML=`<div class="layout"><aside class="sidebar"><a class="brand" href="/">${brand()}</a><p class="nav-label">ESPACIO DE TRABAJO</p>
    <nav aria-label="Principal">${Object.keys(titles).map(key=>`<button data-page="${key}" class="nav-item ${page===key?'active':''}" ${page===key?'aria-current="page"':''}><span aria-hidden="true">${icons[key]}</span>${titles[key]}</button>`).join('')}</nav>
    <div class="sidebar-foot"><span class="status-dot"></span>Panel interno de Jaguar<p>Gestión de equipos y clientes</p></div></aside>
    <div class="workspace"><header class="topbar"><span>JAGUAR <span class="muted">/ ${titles[page]}</span></span><div class="account"><span class="avatar">${esc(user.name.slice(0,1).toUpperCase())}</span><span>${esc(user.name)}<small>Gestión interna</small></span><button class="logout" id="logout">Salir</button></div></header>
    <main class="content">${content}</main><footer class="page-footer">INDUSTRIAS JAGUAR<span>Catálogo compartido. Trazabilidad por unidad.</span></footer></div></div>`;
  document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{page=button.dataset.page; search=''; render();});
  document.querySelector('#logout').onclick=async event=>{
    const button=event.currentTarget; button.disabled=true;
    try { await api('/auth/logout',{method:'POST'}); reset(); }
    catch(error) { if (user) { button.disabled=false; alert(`No se ha podido cerrar la sesión en el servidor. ${error.message}`); } }
  };
}
function badge(text,kind='') { return `<span class="badge ${kind}">${esc(text)}</span>`; }
function unitRow(unit) {
  const status=unit.assignment_kind==='sale'?'Vendido':unit.assignment_kind==='rental'?'En alquiler':'En Jaguar';
  return `<tr><td><strong>${esc(unit.variant_name)}</strong><small>${esc(unit.reference)} · ${esc(unit.model_name)}</small></td><td class="serial">${esc(unit.serial_number)}${unit.is_demo?badge('DEMO','demo'):''}</td><td>${esc(unit.client_name || '—')}${data.clients.find(c=>c.id===unit.client_id)?.is_demo?' '+badge('DEMO','demo'):''}</td><td>${badge(status,unit.assignment_kind || '')}</td><td>${unit.nfc_linked?`${badge('Vinculada')}<small class="serial">${esc(unit.nfc_uid)}</small>`:unit.is_demo?'<span class="muted">Sin etiqueta</span>':`<button class="text-button" data-nfc="${unit.id}">Vincular etiqueta NFC</button>`}</td><td>${unit.is_demo?'<span class="muted">Demostración</span>':unit.assignment_kind==='rental'?`<button class="text-button" data-end="${unit.assignment_id}">Finalizar alquiler</button>`:!unit.assignment_id?`<button class="text-button" data-assign="${unit.id}">Asignar →</button>`:'<span class="muted">Venta registrada</span>'}</td></tr>`;
}
function unitTable(units) {
  return units.length?`<div class="table-scroll"><table><thead><tr><th>Equipo / referencia</th><th>N.º de serie</th><th>Cliente</th><th>Situación</th><th>NFC</th><th>Gestión</th></tr></thead><tbody>${units.map(unitRow).join('')}</tbody></table></div>`:'<div class="empty"><h3>No hay unidades que mostrar</h3><p>Registra una unidad desde una referencia del catálogo.</p></div>';
}
// Los indicadores excluyen las unidades y clientes ficticios. El catálogo sí reúne
// modelos reales compartidos, aunque de momento solo haya unidades de demostración.
function overview() {
  const s=data.summary;
  return `<div class="page-heading"><div><p class="eyebrow">CENTRO DE OPERACIONES</p><h1>Vista general</h1><p class="muted">El catálogo, los equipos y tus clientes, conectados.</p></div><button class="primary" data-new="unit">＋ Registrar unidad</button></div>
    <section class="metrics" aria-label="Resumen de datos reales">${[['Unidades registradas',s.units,'units'],['Alquileres vigentes',s.rentals,'units'],['Clientes',s.clients,'clients'],['Modelos del catálogo',s.models,'models']].map(([label,value,target])=>`<button class="metric" data-target="${target}"><span>${label}</span><strong>${value}</strong><small>Ver ${titles[target].toLowerCase()} <span>↗</span></small></button>`).join('')}</section>
    <section class="workflow"><div><p class="eyebrow">DE MODELO A UNIDAD</p><h2>La información común, siempre conectada.</h2><p>Los modelos reúnen características y documentos. Cada unidad añade su número de serie, propietario y asignación.</p><button class="text-button" data-target="models">Explorar el catálogo →</button></div><div class="workflow-steps"><span>01 <strong>Modelo</strong><small>Documentación común</small></span><b>→</b><span>02 <strong>Unidad</strong><small>Serie individual</small></span><b>→</b><span>03 <strong>Cliente</strong><small>Venta o alquiler</small></span></div></section>
    <section class="panel"><div class="section-heading"><div><h2>Inventario de equipos</h2><p class="muted">${s.all_units-s.units} unidades DEMO identificadas y excluidas de los indicadores de actividad.</p></div><button class="text-button" data-target="units">Ver todas →</button></div>${unitTable(data.units.slice(0,6))}</section>`;
}
function matches(...values) { return values.some(v=>String(v || '').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))); }
// Construye tablas, tarjetas y documentos usando exclusivamente datos autorizados.
// esc() convierte los textos en contenido seguro antes de insertarlos en el HTML.
function filteredContent() {
  if (page==='units') return unitTable(data.units.filter(u=>matches(u.serial_number,u.reference,u.variant_name,u.client_name)));
  if (page==='clients') {
    const clients=data.clients.filter(c=>matches(c.name));
    return clients.length?`<div class="client-grid">${clients.map(c=>`<article class="client-card"><span class="client-icon">${esc(c.name.slice(0,1))}</span><div><h2>${esc(c.name)}</h2>${c.is_demo?badge('DEMO','demo'):badge('Cliente')}<p class="muted">${c.app_users || 0} usuarios con acceso a la app</p><p class="muted">${data.units.filter(u=>u.client_id===c.id).length} unidades asignadas</p></div></article>`).join('')}</div>`:'<div class="empty"><h3>No hay clientes que mostrar</h3><p>Da de alta el primer cliente o cambia la búsqueda.</p></div>';
  }
  const models=data.models.filter(m=>matches(m.code,m.name,m.category,...m.variants.map(v=>v.reference)));
  return models.length?`<div class="model-grid">${models.map(m=>`<article class="model-card"><div class="model-image">${productImages[m.code]?`<img loading="lazy" src="/assets/${esc(productImages[m.code])}" alt="${esc(m.name)}">`:'<span aria-hidden="true">◇</span>'}<span class="model-code">${esc(m.code)}</span></div><div class="model-body"><p class="eyebrow">${esc(m.category)}</p><h2>${esc(m.name)}</h2><p class="muted">${esc(m.description)}</p><h3>Referencias</h3>${m.variants.map(v=>`<details><summary><strong>${esc(v.reference)}</strong> · ${esc(v.name)}</summary><dl>${v.specifications.map(s=>`<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl></details>`).join('') || '<p class="muted">Sin referencias todavía.</p>'}<button class="text-button" data-variant="${m.id}">＋ Añadir referencia</button><h3>Documentación común</h3><div class="documents">${m.documents.map(d=>`<button data-document="${d.id}"><span>↧</span>${esc(d.title)} <small>${esc(d.language.toUpperCase())} · PDF</small></button>`).join('') || '<p class="muted">Sin documentos vinculados.</p>'}</div></div></article>`).join('')}</div>`:'<div class="empty"><h3>No hay modelos que mostrar</h3><p>Añade un modelo o cambia la búsqueda.</p></div>';
}
function render() {
  if (!user) return;
  if (page==='overview') shell(overview());
  else {
    const notes={units:'Cada unidad tiene su propia serie y asignación.',models:'Características y documentos compartidos por todas las unidades del modelo.',clients:'Organizaciones destinatarias de ventas y alquileres. Puedes crear un acceso a la app al dar de alta la empresa.'};
    const actions={units:['unit','Registrar unidad'],models:['model','Añadir modelo'],clients:['client','Añadir cliente']};
    shell(`<div class="page-heading"><div><p class="eyebrow">GESTIÓN JAGUAR</p><h1>${titles[page]}</h1><p class="muted">${notes[page]}</p></div><button class="primary" data-new="${actions[page][0]}">＋ ${actions[page][1]}</button></div><label class="search"><span>Buscar en ${titles[page].toLowerCase()}</span><input id="search" type="search" value="${esc(search)}" placeholder="${page==='units'?'Serie, referencia o cliente…':'Escribe para filtrar…'}"></label><section id="results" class="${page==='units'?'panel':''}">${filteredContent()}</section>`);
    document.querySelector('#search').oninput=event=>{search=event.target.value; document.querySelector('#results').innerHTML=filteredContent(); bindContent();};
  }
  document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>openForm(b.dataset.new));
  document.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{page=b.dataset.target;search='';render();});
  bindContent();
}
// Las descargas llevan Bearer como cualquier consulta: conocer la URL no basta.
// El enlace temporal permite guardar el PDF sin publicar archivos ni tokens en la URL.
function bindContent() {
  document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>openForm('variant',b.dataset.variant));
  document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>openForm('assignment',b.dataset.assign));
  document.querySelectorAll('[data-nfc]').forEach(b=>b.onclick=()=>openForm('nfc',b.dataset.nfc));
  document.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>openForm('end',b.dataset.end));
  document.querySelectorAll('[data-document]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try {
      const blob=await api(`/panel/documents/${b.dataset.document}`,{pdf:true});
      const href=URL.createObjectURL(blob), link=document.createElement('a'); link.href=href; link.download=`jaguar-${b.dataset.document}.pdf`; link.click(); setTimeout(()=>URL.revokeObjectURL(href),60000);
    } catch(error) { if (user) alert(error.message); }
    finally { b.disabled=false; }
  });
}
const field=(label,name,max=200,extra='')=>`<label>${label}<input name="${name}" required maxlength="${max}" ${extra}></label>`;
// Un único diálogo resuelve las altas y asignaciones. El botón queda bloqueado mientras
// se guarda y el servidor confirma datos y auditoría juntos antes de refrescar la vista.
function openForm(kind,target) {
  const definitions={
    client:['Nuevo cliente','Registra la empresa y, si lo necesitas, su primer usuario. Este acceso no permite entrar en el panel interno de Jaguar.',field('Nombre de la empresa','name')+
      '<label class="access-toggle"><input type="checkbox" name="createAppAccess">Crear acceso a la app</label><fieldset class="app-access" hidden disabled><legend>Primer usuario de la empresa</legend>'+field('Nombre de la persona','userName',200,'autocomplete="name"')+field('Email de acceso','userEmail',254,'type="email" autocomplete="off" autocapitalize="none"')+field('Contraseña inicial','userPassword',1024,'type="password" minlength="12" autocomplete="new-password"')+'<small>Mínimo 12 caracteres. Solo se guarda el hash de la contraseña; no se podrá consultar después.</small></fieldset>'],
    model:['Nuevo modelo','La documentación común se vincula al modelo; sus referencias definen las características.',field('Código del modelo','code',50)+field('Nombre','name')+field('Categoría','category')+'<label>Descripción<textarea name="description" required maxlength="2000" rows="3"></textarea></label>'],
    variant:['Nueva referencia','Añade una variante al modelo seleccionado.',field('Referencia comercial','reference',80)+field('Nombre de la variante','name')+'<label>Características<textarea name="specifications" rows="5" placeholder="Capacidad: 1.000 kg&#10;Peso: 11 kg"></textarea><small>Una por línea, con formato Etiqueta: valor. Hasta 30.</small></label>'],
    unit:['Registrar unidad','La unidad se registra como propiedad de Jaguar, sin etiqueta NFC hasta su vinculación física.',`<label>Referencia del catálogo<select name="variantId" required><option value="">Selecciona una referencia</option>${data.models.flatMap(m=>m.variants.map(v=>`<option value="${v.id}">${esc(v.reference)} · ${esc(v.name)}</option>`)).join('')}</select></label>`+field('Número de serie','serialNumber',150)],
    assignment:['Asignar unidad','La venta transfiere la propiedad al cliente. El alquiler mantiene a Jaguar como propietario.',`<label>Cliente<select name="clientId" required><option value="">Selecciona un cliente</option>${data.clients.map(c=>`<option value="${c.id}">${esc(c.name)}${c.is_demo?' · DEMO':''}</option>`).join('')}</select></label><label>Tipo de asignación<select name="kind" required><option value="rental">Alquiler</option><option value="sale">Venta</option></select></label><p class="form-note">La asignación empieza ahora. Una venta se registra como definitiva; revisa cliente y unidad antes de guardar.</p>`],
    nfc:['Vincular etiqueta NFC','Introduce el UID mostrado por Jaguar al leer la etiqueta física. Se admiten ambos órdenes de bytes; no hace falta escribir en el chip. Una etiqueta solo puede identificar una unidad.',field('UID ISO 15693','uid',64,'autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="24369B21090104E0"')],
    end:['Finalizar alquiler','El cliente dejará de tener acceso a esta unidad mediante este alquiler. La unidad vuelve a quedar disponible en Jaguar.','<p>Se conservará el registro del alquiler con su fecha de finalización.</p>'],
  };
  const [title,note,fields]=definitions[kind];
  const unit=['assignment','nfc'].includes(kind)?data.units.find(u=>u.id===target):null;
  const dialog=document.createElement('dialog'); dialog.className='form-dialog';
  dialog.innerHTML=`<form><div class="dialog-heading"><h2>${title}</h2><button type="button" id="close-dialog" aria-label="Cerrar">×</button></div><p class="muted">${note}</p>${unit?`<p><strong>${esc(unit.variant_name)}</strong><br>Serie: ${esc(unit.serial_number)}</p>`:''}${fields}<p class="error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel-dialog">Cancelar</button><button type="submit" class="primary">${kind==='end'?'Finalizar alquiler':'Guardar'}</button></div></form>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('input,select,textarea')?.focus();
  // Los campos de acceso solo son obligatorios y se envían si se activa la opción.
  const accessToggle=dialog.querySelector('[name="createAppAccess"]');
  if (accessToggle) accessToggle.onchange=()=>{
    const fields=dialog.querySelector('.app-access');
    fields.hidden=!accessToggle.checked; fields.disabled=!accessToggle.checked;
  };
  const close=()=>{if(!pending)dialog.close();};
  dialog.querySelector('#close-dialog').onclick=close; dialog.querySelector('#cancel-dialog').onclick=close;
  dialog.oncancel=event=>{if(pending)event.preventDefault();}; dialog.onclose=()=>dialog.remove();
  dialog.querySelector('form').onsubmit=async event=>{
    event.preventDefault(); if(pending)return;
    const input=Object.fromEntries(new FormData(event.currentTarget));
    try {
      if(kind==='variant') { input.modelId=target; input.specifications=input.specifications.split('\n').filter(s=>s.trim()).map(line=>{ const index=line.indexOf(':'); if(index<1 || !line.slice(index+1).trim())throw new Error('Usa Etiqueta: valor en cada característica.'); return {label:line.slice(0,index).trim(),value:line.slice(index+1).trim()}; }); }
      if(kind==='assignment')input.equipmentId=target;
      if(kind==='client') {
        if(input.createAppAccess)input.appUser={name:input.userName,email:input.userEmail,password:input.userPassword};
        delete input.createAppAccess; delete input.userName; delete input.userEmail; delete input.userPassword;
      }
      pending=true; dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      const endpoint={client:'clients',model:'models',variant:'variants',unit:'units',assignment:'assignments',end:`assignments/${target}/end`,nfc:`units/${target}/nfc`}[kind];
      await api(`/panel/${endpoint}`,{method:'POST',body:JSON.stringify(input)});
      pending=false; dialog.close(); await load();
    } catch(error) { if(!user){dialog.close();return;} dialog.querySelector('.error').textContent=error.message; }
    finally { pending=false; dialog.querySelectorAll('button').forEach(b=>b.disabled=false); }
  };
}
// Restaurar exige consultar de nuevo el permiso, incluso si hay un token guardado.
if(token) {
  try { user=(await api('/panel/me')).user; await load(); }
  catch(error) { token=null; user=null; sessionStorage.removeItem('jaguar-panel-token'); login(error.message); }
} else login();
