// ============ DOMINIO EVENTOS ============
(function(){
'use strict';

var EV_COLOR = '#7C3AED';

var EV_CATS = ['Todos','🎵 Música','🏃 Deportes','👶 Familiar','🍽️ Gastronomía','📚 Cursos','🐾 Mascotas','🎨 Cultura','🎭 Arte','🌿 Bienestar','🛒 Mercado'];

var EV_ESTADOS = {
  borrador:        { label:'Borrador',          color:'#64748b', icon:'📝' },
  pendiente_pago:  { label:'Pendiente de pago', color:'#F5C518', icon:'⏳' },
  pago_recibido:   { label:'Pago recibido',     color:'#F5A623', icon:'💳' },
  en_revision:     { label:'En revisión',       color:'#64B5F6', icon:'🔍' },
  publicado:       { label:'Publicado',          color:'#1FC26A', icon:'✅' },
  pausado:         { label:'Pausado',            color:'#F5A623', icon:'⏸️' },
  finalizado:      { label:'Finalizado',         color:'#888',    icon:'🏁' },
  rechazado:       { label:'Rechazado',          color:'#D63A2A', icon:'❌' },
  cancelado:       { label:'Cancelado',          color:'#D63A2A', icon:'🚫' }
};

var EV_REGEX_PROHIBIDOS = [
  /https?:\/\//i, /www\./i, /bit\.ly/i, /tinyurl/i,
  /whatsapp/i, /t\.me\//i, /telegram\.me/i,
  /instagram\.com/i, /facebook\.com/i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\b\d{10,}\b/
];

window._evDatos      = [];
window._evCategoria  = 'Todos';
window._evFormData   = {};
window._evEditId     = null;
window._evMisActivos = [];
window._evMisRev     = [];
window._evMisPasados = [];

// ─── HELPERS ─────────────────────────────────────────
function css(id,prop,val){ var el=document.getElementById(id); if(el) el.style[prop]=val; }
function txt(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
function html(id,val){ var el=document.getElementById(id); if(el) el.innerHTML=val; }
function get(id){ return document.getElementById(id); }

function evImgHtml(url, size, radius, placeholder){
  size = size||60; radius = radius||'12px'; placeholder = placeholder||'🎪';
  if(url) return '<img src="'+url+'" style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';object-fit:cover;flex-shrink:0;">';
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';background:linear-gradient(135deg,#2D1B69,#4C1D95);display:flex;align-items:center;justify-content:center;font-size:'+(size*0.45)+'px;flex-shrink:0;">'+placeholder+'</div>';
}

function evValidarTexto(txt){
  for(var i=0;i<EV_REGEX_PROHIBIDOS.length;i++){
    if(EV_REGEX_PROHIBIDOS[i].test(txt)) return false;
  }
  var caps=(txt.match(/[A-ZÁÉÍÓÚ]/g)||[]).length;
  if(caps > txt.length*0.65 && txt.length>12) return false;
  return true;
}

function evIsAdmin(){
  return localStorage.getItem('dcAdminSes')==='1';
}

// ─── PORTAL ──────────────────────────────────────────
window.evCargarPortal = async function(){
  html('ev-lista','<div style="text-align:center;padding:32px;color:rgba(255,255,255,.3);font-size:13px;">Cargando eventos... ⏳</div>');
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var q = F.query(F.collection(window._fbDb,'eventos'), F.where('estado','==','publicado'));
    var snap = await F.getDocs(q);
    window._evDatos = [];
    snap.forEach(function(d){ window._evDatos.push(Object.assign({id:d.id},d.data())); });
    evRenderCats();
    evRenderBanner();
    evRenderLista();
  } catch(e){
    html('ev-lista','<div style="color:#D63A2A;font-size:12px;padding:12px;text-align:center;">Error: '+e.message+'</div>');
  }
};

function evRenderCats(){
  var cont = get('ev-cats');
  if(!cont) return;
  cont.innerHTML = EV_CATS.map(function(c){
    var active = c === window._evCategoria;
    return '<button class="ev-cat-btn" onclick="evFiltrarCat(this,\''+c+'\')" style="flex-shrink:0;border:none;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;background:'+(active?EV_COLOR:'rgba(255,255,255,.08)')+';color:'+(active?'#fff':'rgba(255,255,255,.6)')+';">'+c+'</button>';
  }).join('');
}

function evRenderBanner(){
  var cont = get('ev-banner');
  if(!cont) return;
  var dest = window._evDatos.filter(function(e){ return e.tipo==='oficial'||e.tipo==='premium'; });
  if(!dest.length){
    cont.innerHTML = '<div style="height:190px;background:linear-gradient(135deg,#1E0A3C,#4C1D95,#2D1B69);border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;position:relative;overflow:hidden;">'
      +'<div style="position:absolute;inset:0;opacity:.3;background:radial-gradient(circle at 30% 50%,#7C3AED,transparent 60%)"></div>'
      +'<div style="text-align:center;position:relative;"><div style="font-size:48px;">🎪</div><div style="font-size:16px;font-weight:800;color:#fff;margin-top:8px;">Dominio Eventos</div><div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:4px;">Descubre y vive tu comunidad</div></div>'
      +'</div>';
    return;
  }
  var ev = dest[0];
  var bg = ev.imagen ? 'url('+ev.imagen+') center/cover' : 'linear-gradient(135deg,#2D1B69,#7C3AED)';
  var badge = ev.tipo==='oficial'
    ? '<div style="position:absolute;top:12px;left:12px;background:#7C3AED;color:#fff;font-size:9px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:.5px;">✦ OFICIAL</div>'
    : '<div style="position:absolute;top:12px;left:12px;background:#F5C518;color:#000;font-size:9px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:.5px;">⭐ PREMIUM</div>';
  cont.innerHTML = '<div style="height:200px;background:'+bg+';border-radius:18px;position:relative;overflow:hidden;margin-bottom:16px;cursor:pointer;" onclick="evAbrirDetalle(\''+ev.id+'\')">'
    +'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.1) 55%,transparent 100%);"></div>'
    + badge
    +'<div style="position:absolute;bottom:0;left:0;right:0;padding:14px 16px;">'
    +'<div style="font-size:17px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:4px;">'+ev.titulo+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:8px;">📅 '+ev.fecha+(ev.horaInicio?' · '+ev.horaInicio:'')+(ev.lugar?' · 📍 '+ev.lugar:'')+'</div>'
    +'<button style="background:#7C3AED;border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;padding:7px 18px;cursor:pointer;">Ver más →</button>'
    +'</div></div>';
}

function evRenderLista(){
  var q=(get('ev-search')&&get('ev-search').value||'').toLowerCase().trim();
  var cat=window._evCategoria||'Todos';
  var datos=window._evDatos.filter(function(e){
    if(cat!=='Todos'&&e.categoria!==cat) return false;
    if(q){
      var h=((e.titulo||'')+(e.lugar||'')+(e.organizador||'')+(e.categoria||'')).toLowerCase();
      if(!h.includes(q)) return false;
    }
    return true;
  });
  if(!datos.length){
    html('ev-lista','<div style="text-align:center;padding:40px 20px;"><div style="font-size:40px;margin-bottom:12px;">🔍</div><div style="font-size:14px;color:rgba(255,255,255,.3);">No hay eventos en esta categoría</div></div>');
    return;
  }
  html('ev-lista','<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:12px;text-transform:uppercase;letter-spacing:.6px;">Eventos próximos</div>'
    +datos.map(function(ev){
      var precio = ev.precio&&ev.precio>0
        ? '<span style="font-size:12px;font-weight:800;color:#F5C518;">$'+ev.precio+' MXN</span>'
        : '<span style="font-size:12px;font-weight:800;color:#1FC26A;">GRATIS</span>';
      var badge = ev.tipo==='oficial'
        ? '<span style="background:#7C3AED;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:5px;white-space:nowrap;">OFICIAL</span>'
        : ev.tipo==='premium'
        ? '<span style="background:#F5C518;color:#000;font-size:8px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:5px;white-space:nowrap;">⭐ PREMIUM</span>' : '';
      return '<div onclick="evAbrirDetalle(\''+ev.id+'\')" style="background:var(--card-dark);border-radius:16px;padding:13px;display:flex;gap:12px;margin-bottom:10px;cursor:pointer;border:.5px solid rgba(124,58,237,.18);">'
        +evImgHtml(ev.imagen,70,'14px')
        +'<div style="flex:1;min-width:0;">'
        +'<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">'
        +'<span style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">'+ev.titulo+'</span>'+badge+'</div>'
        +'<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:2px;">📅 '+ev.fecha+(ev.horaInicio?' · '+ev.horaInicio:'')+'</div>'
        +'<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:7px;">📍 '+(ev.lugar||'—')+'</div>'
        +'<div style="display:flex;justify-content:space-between;align-items:center;">'
        +precio+'<span style="font-size:10px;color:rgba(255,255,255,.25);">👥 '+(ev.stats&&ev.stats.confirmaciones||0)+'</span>'
        +'</div></div></div>';
    }).join(''));
}

window.evFiltrarCat = function(el,cat){
  document.querySelectorAll('.ev-cat-btn').forEach(function(b){ b.style.background='rgba(255,255,255,.08)'; b.style.color='rgba(255,255,255,.6)'; });
  el.style.background=EV_COLOR; el.style.color='#fff';
  window._evCategoria=cat;
  evRenderLista();
};

window.evBuscar = function(){ evRenderLista(); };

// ─── DETALLE ─────────────────────────────────────────
window.evAbrirDetalle = async function(id){
  var ev = window._evDatos.find(function(e){ return e.id===id; });
  if(!ev) return;
  window._evActual = ev;
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    F.updateDoc(F.doc(window._fbDb,'eventos',id),{'stats.vistas':F.increment(1)}).catch(function(){});
    if(ev.stats) ev.stats.vistas=(ev.stats.vistas||0)+1;
  } catch(_){}
  var badge = ev.tipo==='oficial'
    ? '<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">✦ EVENTO OFICIAL</span>'
    : ev.tipo==='premium'
    ? '<span style="background:#F5C518;color:#000;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">⭐ EVENTO PREMIUM</span>'
    : '<span style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:10px;font-weight:600;padding:4px 12px;border-radius:20px;">EVENTO DE LA COMUNIDAD</span>';
  var precio = ev.precio&&ev.precio>0
    ? '<div style="background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.3);border-radius:14px;padding:12px 16px;margin-bottom:16px;"><span style="font-size:22px;font-weight:800;color:#F5C518;">$'+ev.precio+' MXN</span></div>'
    : '<div style="background:rgba(31,194,106,.1);border:1px solid rgba(31,194,106,.3);border-radius:14px;padding:12px 16px;margin-bottom:16px;"><span style="font-size:20px;font-weight:800;color:#1FC26A;">GRATIS</span></div>';
  var imgTop = ev.imagen
    ? '<div style="height:240px;background:url('+ev.imagen+') center/cover;position:relative;"></div>'
    : '<div style="height:180px;background:linear-gradient(135deg,#1E0A3C,#4C1D95);display:flex;align-items:center;justify-content:center;font-size:72px;position:relative;">🎪</div>';
  html('ev-det-cont',
    '<div style="position:relative;">'
    +imgTop
    +'<button onclick="go(\'v-eventos\',\'left\')" style="position:absolute;top:46px;left:12px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);border:none;border-radius:50%;width:38px;height:38px;color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">‹</button>'
    +'</div>'
    +'<div style="padding:16px;">'
    +'<div style="margin-bottom:12px;">'+badge+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:10px;">'+ev.titulo+'</div>'
    +'<div style="background:var(--card-dark);border-radius:14px;padding:14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;">'
    +'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">📅</span><span>'+ev.fecha+(ev.horaInicio?' · '+ev.horaInicio+(ev.horaFin?' – '+ev.horaFin:''):'')+'</span></div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">📍</span><span>'+(ev.lugar||'Por confirmar')+'</span></div>'
    +(ev.organizador?'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">👤</span><span>'+ev.organizador+'</span></div>':'')
    +(ev.cupo?'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">👥</span><span>Cupo: '+ev.cupo+' personas</span></div>':'')
    +'</div>'
    +'<div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);border-radius:14px;padding:14px;margin-bottom:14px;">'
    +'<div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.75;">'+(ev.descripcion||'')+'</div>'
    +'</div>'
    +precio
    +'<div style="display:flex;justify-content:space-around;background:var(--card-dark);border-radius:14px;padding:14px;margin-bottom:16px;">'
    +['Vistas','Interesados','Asistirán','Compartidos'].map(function(lbl,i){
      var keys=['vistas','interesados','confirmaciones','compartidos'];
      return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#fff;">'+(ev.stats&&ev.stats[keys[i]]||0)+'</div><div style="font-size:10px;color:rgba(255,255,255,.35);">'+lbl+'</div></div>';
    }).join('')
    +'</div>'
    +'<button onclick="evCompartir()" style="width:100%;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.35);border-radius:14px;color:#a78bfa;font-size:13px;font-weight:700;padding:14px;cursor:pointer;margin-bottom:8px;">📤 Compartir evento</button>'
    +'<div style="height:16px;"></div></div>'
  );
  go('v-ev-det','right');
};

window.evCompartir = function(){
  var ev = window._evActual||{};
  if(navigator.share){
    navigator.share({ title:ev.titulo||'Evento', text:(ev.titulo||'Evento')+'\n📅 '+ev.fecha+'\n📍 '+(ev.lugar||''), url: window.location.href }).catch(function(){});
  } else {
    try{ navigator.clipboard.writeText(window.location.href); alert('¡Enlace copiado!'); }catch(_){}
  }
};

// ─── CREAR EVENTO ─────────────────────────────────────
window.evIniciarCrear = function(){
  var auth = window._fbAuth && window._fbAuth.currentUser;
  if(!auth && !evIsAdmin()){ alert('Inicia sesión para crear un evento'); return; }
  window._evFormData = {};
  window._evEditId   = null;
  go('v-ev-crear-tipo','right');
};

window.evElegirTipo = function(tipo){
  if(tipo==='oficial' && !evIsAdmin()){ alert('Solo los administradores pueden crear eventos oficiales.'); return; }
  window._evFormData.tipo = tipo;
  go('v-ev-reglas','right');
};

window.evAceptarReglas = function(){
  window._evFormData._reglasAceptadas = true;
  evIrFormStep(1);
};

function evIrFormStep(step){
  document.querySelectorAll('.ev-form-step').forEach(function(el){ el.style.display='none'; });
  var s = get('ev-step-'+step); if(s) s.style.display='block';
  [1,2,3].forEach(function(i){
    var d=get('ev-sd-'+i);
    if(d){ d.style.background=i<=step?EV_COLOR:'rgba(255,255,255,.15)'; d.style.color=i<=step?'#fff':'rgba(255,255,255,.3)'; }
    var l=get('ev-sl-'+i);
    if(l) l.style.color=i<=step?'#fff':'rgba(255,255,255,.3)';
  });
  window._evFormStep=step;
  go('v-ev-form','right');
}

window.evValidarCampo = function(el){
  var val=el.value||'';
  var err=get(el.id+'-err');
  if(!val.trim()){ if(err){err.textContent='';err.style.display='none';} el.style.borderColor='rgba(255,255,255,.12)'; return; }
  if(!evValidarTexto(val)){
    el.style.borderColor='#D63A2A';
    if(err){ err.textContent='⚠️ No se permiten links, teléfonos, correos ni contacto directo.'; err.style.display='block'; }
  } else {
    el.style.borderColor='rgba(124,58,237,.4)';
    if(err){ err.textContent=''; err.style.display='none'; }
  }
};

window.evSiguienteStep = function(){
  var step=window._evFormStep||1;
  if(step===1){
    var titulo=(get('ev-titulo')&&get('ev-titulo').value||'').trim();
    var desc=(get('ev-desc')&&get('ev-desc').value||'').trim();
    var cat=get('ev-cat')&&get('ev-cat').value;
    var tipoEv=get('ev-tipo-ev')&&get('ev-tipo-ev').value;
    if(!titulo||!desc||!cat||!tipoEv){ alert('Completa todos los campos requeridos.'); return; }
    if(!evValidarTexto(titulo)||!evValidarTexto(desc)){ alert('El texto contiene información no permitida (links, teléfonos, etc.).'); return; }
    window._evFormData.titulo=titulo; window._evFormData.descripcion=desc;
    window._evFormData.categoria=cat; window._evFormData.tipoEvento=tipoEv;
    evIrFormStep(2);
  } else if(step===2){
    var fecha=get('ev-fecha')&&get('ev-fecha').value;
    var lugar=(get('ev-lugar')&&get('ev-lugar').value||'').trim();
    var hi=get('ev-hora-i')&&get('ev-hora-i').value;
    if(!fecha||!lugar||!hi){ alert('Fecha, lugar y hora de inicio son obligatorios.'); return; }
    if(!evValidarTexto(lugar)){ alert('El lugar contiene información no permitida.'); return; }
    window._evFormData.fecha=fecha; window._evFormData.lugar=lugar;
    window._evFormData.horaInicio=hi;
    window._evFormData.horaFin=(get('ev-hora-f')&&get('ev-hora-f').value)||'';
    window._evFormData.precio=parseFloat(get('ev-precio')&&get('ev-precio').value)||0;
    window._evFormData.cupo=parseInt(get('ev-cupo')&&get('ev-cupo').value)||0;
    var org=(get('ev-org')&&get('ev-org').value||'').trim();
    window._evFormData.organizador=org||(window._userNombre||localStorage.getItem('dcuserNombre')||'');
    evMostrarPreview();
  }
};

window.evSubirImagen = function(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var max = 3*1024*1024;
  if(file.size>max){ alert('La imagen no puede superar 3 MB.'); return; }
  var prev = get('ev-img-preview');
  var lbl  = get('ev-img-label');
  if(prev) prev.style.display='block';
  if(lbl)  lbl.style.display='none';
  var reader = new FileReader();
  reader.onload = function(e){
    window._evFormData._imagenFile = file;
    window._evFormData._imagenPreview = e.target.result;
    if(prev){ prev.style.backgroundImage='url('+e.target.result+')'; prev.style.backgroundSize='cover'; prev.style.backgroundPosition='center'; prev.innerHTML=''; }
  };
  reader.readAsDataURL(file);
};

async function evUploadImagen(){
  if(!window._evFormData._imagenFile) return window._evFormData._imagenUrl||'';
  try {
    var S = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
    var uid = (window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||'anon';
    var ref = S.ref(window._fbStorage,'eventos/'+uid+'_'+Date.now());
    await S.uploadBytes(ref, window._evFormData._imagenFile);
    var url = await S.getDownloadURL(ref);
    return url;
  } catch(e){ return ''; }
}

function evMostrarPreview(){
  var d = window._evFormData;
  var imgHtml = d._imagenPreview
    ? '<div style="height:200px;background:url('+d._imagenPreview+') center/cover;border-radius:16px;margin-bottom:14px;"></div>'
    : evImgHtml('',null,'16px')+'<!-- no img --><div style="height:14px;"></div>';
  var badge = d.tipo==='oficial'
    ? '<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">✦ EVENTO OFICIAL</span>'
    : '<span style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:10px;font-weight:600;padding:4px 12px;border-radius:20px;">EVENTO DE LA COMUNIDAD</span>';
  html('ev-preview-cont',
    '<div style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#a78bfa;font-weight:600;">✦ ¡Se ve increíble! Así es como verá tu evento la comunidad.</div>'
    +imgHtml
    +'<div style="margin-bottom:12px;">'+badge+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:8px;">'+d.titulo+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:3px;">📅 '+d.fecha+(d.horaInicio?' · '+d.horaInicio:'')+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:14px;">📍 '+d.lugar+'</div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.78);line-height:1.75;margin-bottom:16px;">'+d.descripcion+'</div>'
    +'<div style="display:flex;justify-content:space-around;background:var(--card-dark);border-radius:12px;padding:12px;margin-bottom:14px;">'
    +['Vistas','Interesados','Asistirán','Compartidos'].map(function(l){ return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#fff;">0</div><div style="font-size:10px;color:rgba(255,255,255,.35);">'+l+'</div></div>'; }).join('')
    +'</div>'
    +(d.precio>0?'<div style="font-size:16px;font-weight:800;color:#F5C518;">💰 $'+d.precio+' MXN</div>':'<div style="font-size:16px;font-weight:800;color:#1FC26A;">GRATIS</div>')
  );
  go('v-ev-preview','right');
}

window.evContinuarDesdePreview = function(){
  go('v-ev-publicar','right');
  evRenderPublicar();
};

function evRenderPublicar(){
  var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
  var cortesia = uid && localStorage.getItem('ev_cortesia_'+uid)==='1';
  if(evIsAdmin()){
    html('ev-pub-cont','<div style="text-align:center;padding:20px 0;">'
      +'<div style="font-size:40px;margin-bottom:12px;">🛡️</div>'
      +'<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:8px;">Publicación de Administrador</div>'
      +'<div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:24px;">Tu evento se publicará inmediatamente sin revisión.</div>'
      +'<button onclick="evPublicarDirecto(\'publicado\',\'oficial\')" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;padding:16px;cursor:pointer;">✦ Publicar como Evento Oficial</button>'
      +'</div>');
    return;
  }
  if(cortesia){
    html('ev-pub-cont','<div style="text-align:center;padding:20px 0;">'
      +'<div style="font-size:48px;margin-bottom:12px;">🎁</div>'
      +'<div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;">¡Buenas noticias!</div>'
      +'<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:24px;">Tienes <strong style="color:#7C3AED;">1 Publicación de Cortesía</strong> disponible.<br>Úsala para publicar este evento gratis.</div>'
      +'<div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);border-radius:12px;padding:12px;margin-bottom:20px;font-size:11px;color:rgba(255,255,255,.5);text-align:left;">Válida por 30 días · Solo 1 uso</div>'
      +'<button onclick="evPublicarCortesia()" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;padding:16px;cursor:pointer;margin-bottom:10px;">🎁 Publicar Gratis</button>'
      +'<button onclick="evMostrarOpciones()" style="width:100%;background:transparent;border:none;color:rgba(255,255,255,.4);font-size:12px;cursor:pointer;padding:10px;">Ver otras opciones</button>'
      +'</div>');
    return;
  }
  evMostrarOpciones();
}

window.evMostrarOpciones = function(){
  html('ev-pub-cont','<div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;">Elige cómo publicar tu evento:</div>'
    +'<div onclick="evPublicarDirecto(\'en_revision\',\'normal\')" style="background:var(--card-dark);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">📋 Publicación Normal</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.5;margin-bottom:8px;">Aparece en el listado general. Pasa por revisión antes de publicarse.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#7C3AED;">$79 MXN</div>'
    +'</div>'
    +'<div onclick="evPublicarDirecto(\'en_revision\',\'premium\')" style="background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(91,33,182,.08));border:1.5px solid '+EV_COLOR+';border-radius:16px;padding:16px;cursor:pointer;position:relative;">'
    +'<div style="position:absolute;top:-1px;right:14px;background:#F5C518;color:#000;font-size:8px;font-weight:800;padding:3px 8px;border-radius:0 0 8px 8px;letter-spacing:.3px;">MÁS POPULAR</div>'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">⭐ Publicación Premium</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);line-height:1.5;margin-bottom:8px;">Aparece en el banner principal · Insignia Premium · Prioridad en resultados.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#F5C518;">$129 MXN</div>'
    +'</div>'
    +'<div onclick="evPublicarDirecto(\'en_revision\',\'premium\')" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;margin-top:12px;cursor:pointer;">'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">🚀 Destacar 30 días</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.5;margin-bottom:8px;">Máxima exposición · Mejor valor.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#fff;">$199 MXN</div>'
    +'</div>'
    +'</div>');
};

window.evPublicarCortesia = async function(){
  await evGuardarEvento('en_revision','normal');
  var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
  if(uid) localStorage.removeItem('ev_cortesia_'+uid);
};

window.evPublicarDirecto = async function(estado, tipoPub){
  await evGuardarEvento(estado, tipoPub);
};

async function evGuardarEvento(estado, tipoPub){
  var btn = get('ev-pub-btn');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  var d = window._evFormData;
  var auth = window._fbAuth && window._fbAuth.currentUser;
  var uid  = auth && auth.uid;
  var userTipo = localStorage.getItem('dcuserTipo')||'vecino';
  var estadoFinal = evIsAdmin() ? 'publicado' : estado;
  try {
    var imagenUrl = await evUploadImagen();
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var data = {
      titulo:      d.titulo,
      descripcion: d.descripcion,
      categoria:   d.categoria,
      tipoEvento:  d.tipoEvento,
      fecha:       d.fecha,
      horaInicio:  d.horaInicio,
      horaFin:     d.horaFin||'',
      lugar:       d.lugar,
      precio:      d.precio||0,
      cupo:        d.cupo||0,
      organizador: d.organizador||'',
      imagen:      imagenUrl,
      tipo:        tipoPub||d.tipo||'normal',
      estado:      estadoFinal,
      autorUid:    uid||'',
      autorTipo:   userTipo,
      creadoEn:    F.serverTimestamp(),
      stats:       { vistas:0, interesados:0, confirmaciones:0, compartidos:0 }
    };
    if(window._evEditId){
      await F.updateDoc(F.doc(window._fbDb,'eventos',window._evEditId), data);
    } else {
      await F.addDoc(F.collection(window._fbDb,'eventos'), data);
    }
    txt('ev-ok-msg', estadoFinal==='publicado'
      ? '¡Tu evento está publicado! Ya puede verlo toda la comunidad.'
      : '¡Evento enviado a revisión! Te notificaremos cuando sea aprobado.');
    txt('ev-ok-sub', estadoFinal==='publicado' ? 'Aparecerá en el portal de eventos de inmediato.' : 'El proceso toma menos de 24 horas.');
    go('v-ev-ok','right');
  } catch(e){ alert('Error: '+e.message); if(btn){ btn.disabled=false; btn.textContent='Reintentar'; } }
}

// ─── MIS EVENTOS ─────────────────────────────────────
window.evAbrirMisEventos = function(){
  go('v-ev-mis','right');
  evCargarMisEventos();
};

window.evCargarMisEventos = async function(){
  var auth = window._fbAuth && window._fbAuth.currentUser;
  if(!auth){ html('ev-mis-activos','<div style="text-align:center;padding:24px;color:rgba(255,255,255,.35);font-size:13px;">Inicia sesión para ver tus eventos</div>'); return; }
  var uid = auth.uid;
  ['activos','revision','pasados'].forEach(function(t){ html('ev-mis-'+t,'<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Cargando...</div>'); });
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var q = F.query(F.collection(window._fbDb,'eventos'), F.where('autorUid','==',uid));
    var snap = await F.getDocs(q);
    var activos=[], revision=[], pasados=[];
    snap.forEach(function(d){
      var ev = Object.assign({id:d.id},d.data());
      if(ev.estado==='publicado'||ev.estado==='pausado') activos.push(ev);
      else if(ev.estado==='en_revision'||ev.estado==='pago_recibido'||ev.estado==='pendiente_pago'||ev.estado==='borrador') revision.push(ev);
      else pasados.push(ev);
    });
    window._evMisActivos=activos; window._evMisRev=revision; window._evMisPasados=pasados;
    evRenderMisTab('activos',activos,true,false);
    evRenderMisTab('revision',revision,false,false);
    evRenderMisTab('pasados',pasados,false,true);
  } catch(e){
    html('ev-mis-activos','<div style="color:#D63A2A;font-size:12px;padding:12px;">'+e.message+'</div>');
  }
};

function evRenderMisTab(tabId,datos,showStats,showRepublicar){
  var cont = get('ev-mis-'+tabId);
  if(!cont) return;
  if(!datos.length){ cont.innerHTML='<div style="text-align:center;padding:32px 20px;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div style="font-size:13px;color:rgba(255,255,255,.3);">Sin eventos aquí</div></div>'; return; }
  cont.innerHTML = datos.map(function(ev){
    var est = EV_ESTADOS[ev.estado]||{label:ev.estado,color:'#aaa',icon:'•'};
    var statsHtml = showStats
      ? '<div style="display:flex;gap:10px;margin-top:8px;">'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">👀 '+(ev.stats&&ev.stats.vistas||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">❤️ '+(ev.stats&&ev.stats.interesados||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">👥 '+(ev.stats&&ev.stats.confirmaciones||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">📤 '+(ev.stats&&ev.stats.compartidos||0)+'</span>'
        +'</div>' : '';
    var acciones = showRepublicar
      ? '<button onclick="evRepublicar(\''+ev.id+'\')" style="font-size:11px;font-weight:700;color:#7C3AED;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:8px;padding:5px 12px;cursor:pointer;margin-top:8px;">🔁 Republicar</button>'
      : (showStats ? '<button onclick="evImpulsarEvento(\''+ev.id+'\')" style="font-size:11px;font-weight:700;color:#F5C518;background:rgba(245,197,24,.08);border:1px solid rgba(245,197,24,.3);border-radius:8px;padding:5px 12px;cursor:pointer;margin-top:8px;">🚀 Destacar</button>' : '');
    return '<div style="background:var(--card-dark);border-radius:14px;padding:12px;margin-bottom:10px;display:flex;gap:12px;border:.5px solid rgba(124,58,237,.15);">'
      +evImgHtml(ev.imagen,56,'10px')
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">'+ev.titulo+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:2px;">📅 '+ev.fecha+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px;">📍 '+(ev.lugar||'—')+'</div>'
      +'<span style="font-size:9px;font-weight:800;color:'+est.color+';background:'+est.color+'20;border:1px solid '+est.color+'40;border-radius:10px;padding:2px 8px;">'+est.icon+' '+est.label.toUpperCase()+'</span>'
      +statsHtml+acciones
      +'</div></div>';
  }).join('');
}

window.evMisTab = function(tab){
  ['activos','revision','pasados'].forEach(function(t){
    var btn=get('ev-mis-btn-'+t); var cont=get('ev-mis-'+t); var active=t===tab;
    if(btn){ btn.style.background=active?EV_COLOR:'transparent'; btn.style.color=active?'#fff':'rgba(255,255,255,.4)'; btn.style.borderColor=active?EV_COLOR:'rgba(255,255,255,.15)'; }
    if(cont) cont.style.display=active?'block':'none';
  });
};

window.evRepublicar = async function(id){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'eventos',id));
    if(!snap.exists()) return;
    var ev = snap.data();
    window._evFormData = {
      titulo:ev.titulo, descripcion:ev.descripcion, categoria:ev.categoria,
      tipoEvento:ev.tipoEvento, lugar:ev.lugar, precio:ev.precio, cupo:ev.cupo,
      organizador:ev.organizador, _imagenUrl:ev.imagen, tipo:ev.tipo||'normal', _republicar:true
    };
    window._evEditId = null;
    evIrFormStep(2);
  } catch(e){ alert('Error: '+e.message); }
};

window.evImpulsarEvento = function(id){
  window._evImpulsarId = id;
  go('v-ev-impulsar','right');
};

})();
