// ============ DOMINIO INFORMA ============
(function(){
'use strict';

var IN_COLOR  = '#1a1f7a';
var IN_COLOR2 = '#1A7AB5';

var IN_TIPOS = {
  noticia:  { label:'Noticia',          icon:'📰', color:'#1A7AB5', colecccion:'noticias' },
  proyecto: { label:'Proyecto',         icon:'🏗️', color:'#1a1f7a', colecccion:'proyectos' },
  reporte:  { label:'Reporte ciudadano',icon:'⚠️', color:'#D63A2A', colecccion:'reportesCiudadanos' }
};

var IN_ESTADOS = {
  borrador:    { label:'Borrador',     color:'#64748b', icon:'📝' },
  en_revision: { label:'En revisión',  color:'#64B5F6', icon:'🔍' },
  publicado:   { label:'Publicado',    color:'#1FC26A', icon:'✅' },
  rechazado:   { label:'Rechazado',    color:'#D63A2A', icon:'❌' }
};

// Anti-spam (mismo patrón que eventos.js)
var IN_REGLAS_BLOQUEO = [
  { re: /(@(?!\s*$))/,                                                                       msg: '❌ No está permitido mencionar usuarios o redes sociales (@).' },
  { re: /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,                                        msg: '❌ No se permiten correos electrónicos.' },
  { re: /https?:\/\//i,                                                                      msg: '❌ No se permiten enlaces externos.' },
  { re: /\bwww\./i,                                                                          msg: '❌ No se permiten enlaces externos (www).' },
  { re: /\.(com|net|org|edu|gov|mx|io|co|ly|me)\b/i,                                        msg: '❌ No se permiten enlaces externos.' },
  { re: /bit\.ly|tinyurl|cutt\.ly|linktr\.ee|wa\.me|t\.me\/|discord\.gg/i,                  msg: '❌ No se permiten enlaces acortados.' },
  { re: /(\+?[\d][\d\s\-\.\(\)]{8,}[\d])/,                                                  msg: '❌ No se permiten números telefónicos.' },
  { re: /\b(facebook|instagram|tiktok|twitter|telegram|whatsapp|whats app|discord|snapchat|youtube)\b/i, msg: '❌ No se permite promocionar redes sociales.' },
  { re: /\b(idiota|imb[eé]cil|maldito|put[ao]|cabr[oó]n|pendejo|culero|chinga|verga|pinche)\b/i, msg: '❌ No se permite lenguaje ofensivo.' }
];

// ─── ESTADO GLOBAL ────────────────────────────────────
var _inAdminCache   = null;
var _inTabActual    = 'noticia';
var _inFormData     = {};
var _inDetActual    = null; // doc actual en detalle
var _inMisDocs      = [];
var _inCacheNoticias  = [];
var _inCacheProyectos = [];
var _inCacheReportes  = [];

// ─── HELPERS ──────────────────────────────────────────
function get(id){ return document.getElementById(id); }
function txt(id,v){ var e=get(id); if(e) e.textContent=v; }
function html(id,v){ var e=get(id); if(e) e.innerHTML=v; }

function inEsc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function inNorm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
}

function inFechaRel(ts){
  if(!ts) return '';
  try{
    var ms = ts.toMillis ? ts.toMillis() : (typeof ts==='number'?ts:0);
    var d = Date.now()-ms;
    if(d<60000) return 'ahora';
    if(d<3600000) return Math.floor(d/60000)+'m';
    if(d<86400000) return Math.floor(d/3600000)+'h';
    return Math.floor(d/86400000)+'d';
  }catch(_){ return ''; }
}

function inImgHtml(url, size, radius, placeholder){
  size=size||60; radius=radius||'12px'; placeholder=placeholder||'📰';
  if(url) return '<img src="'+inEsc(url)+'" style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';object-fit:cover;flex-shrink:0;" loading="lazy">';
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';background:linear-gradient(135deg,#1a1f7a,#0a0f4a);display:flex;align-items:center;justify-content:center;font-size:'+(size*0.45)+'px;flex-shrink:0;">'+placeholder+'</div>';
}

function inValidarTexto(val){
  for(var i=0;i<IN_REGLAS_BLOQUEO.length;i++){
    if(IN_REGLAS_BLOQUEO[i].re.test(val)) return { error: IN_REGLAS_BLOQUEO[i].msg };
  }
  var emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  var emojis = (val.match(emojiRe)||[]).length;
  if(emojis > 6) return { warn: '⚠️ Demasiados emojis (máx 6).' };
  var letras = (val.match(/[a-záéíóúA-ZÁÉÍÓÚ]/g)||[]);
  var mayus  = (val.match(/[A-ZÁÉÍÓÚ]/g)||[]).length;
  if(letras.length > 10 && mayus/letras.length > 0.70) return { warn: '⚠️ Evita escribir TODO EN MAYÚSCULAS.' };
  return null;
}

// ─── ADMIN ────────────────────────────────────────────
async function inVerificarAdmin(){
  if(_inAdminCache !== null) return _inAdminCache;
  try {
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    if(!uid){ _inAdminCache=false; return false; }
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'usuarios',uid));
    if(!snap.exists()){ _inAdminCache=false; return false; }
    var d = snap.data();
    _inAdminCache = d.rol==='admin' || d.rol==='maestro' || d.esAdmin===true;
    return _inAdminCache;
  } catch(_){ _inAdminCache=false; return false; }
}

// ─── IMAGEN FONDO ─────────────────────────────────────
async function _inUploadImagenFondo(file){
  if(!file) return '';
  try {
    var S = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
    var uid = (window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||'anon';
    var ext = (file.name.split('.').pop()||'jpg').toLowerCase();
    var ref = S.ref(window._fbStorage,'informa/'+uid+'_'+Date.now()+'.'+ext);
    await S.uploadBytes(ref, file);
    return await S.getDownloadURL(ref);
  } catch(e){
    console.error('[Dominio Informa] Error subiendo imagen:', e.message||e);
    return '';
  }
}

// ─── COLECCIÓN POR TIPO ────────────────────────────────
function _inColeccion(tipo){
  return IN_TIPOS[tipo] ? IN_TIPOS[tipo].colecccion : 'noticias';
}

// ─── BADGE TAG HTML ────────────────────────────────────
function _inBadge(tipo){
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  return '<span style="background:'+t.color+'22;color:'+t.color+';border:1px solid '+t.color+'44;border-radius:8px;padding:2px 8px;font-size:10px;font-weight:700;">'+t.icon+' '+t.label+'</span>';
}

// ─── CARD HTML ────────────────────────────────────────
function _inCardHtml(doc, tipo){
  var d = doc.data ? doc.data() : doc;
  var id = doc.id || d._id || '';
  var tipo2 = d.tipo || tipo || 'noticia';
  var t = IN_TIPOS[tipo2] || IN_TIPOS.noticia;
  var fecha = inFechaRel(d.creadoEn||d.publicadoEn||null);
  var vistas = d.vistas ? '· 👁️ '+d.vistas+' vistas' : '';
  var util = d.util || d.util_count || 0;
  return '<div class="in-card" onclick="window.inAbrirDetalle(\''+inEsc(id)+'\',\''+inEsc(tipo2)+'\')" style="background:#fff;border-radius:16px;margin:0 14px 12px;box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;cursor:pointer;">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;">'
    +inImgHtml(d.imagen||'', 56, '12px', t.icon)
    +'<div style="flex:1;min-width:0;">'
    +'<div style="margin-bottom:4px;">'+_inBadge(tipo2)+'</div>'
    +'<div style="font-size:13px;font-weight:700;color:#111;line-height:1.3;margin-bottom:3px;">'+inEsc(d.titulo||d.title||'Sin título')+'</div>'
    +'<div style="font-size:11px;color:#888;">📅 '+fecha+' '+vistas+'</div>'
    +'</div></div>'
    +(d.descripcion||d.resumen ? '<div style="font-size:12px;color:#555;line-height:1.5;padding:0 12px 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+inEsc((d.descripcion||d.resumen||'').substring(0,120))+'</div>' : '')
    +'<div style="display:flex;gap:6px;padding:0 12px 12px;">'
    +'<span style="font-size:11px;color:#1A7AB5;font-weight:700;">👍 '+util+' útil</span>'
    +'</div>'
    +'</div>';
}

// ─── RENDER LISTAS ────────────────────────────────────
function _inRenderLista(colId, docs, tipo, emptyIcon, emptyTxt, emptyBtn){
  var el = get(colId);
  if(!el) return;
  if(!docs || !docs.length){
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;">'
      +'<div style="font-size:48px;margin-bottom:10px;">'+emptyIcon+'</div>'
      +'<div style="font-size:14px;font-weight:700;color:#333;margin-bottom:6px;">'+emptyTxt+'</div>'
      +'<div style="font-size:11px;color:#888;margin-bottom:16px;">Las publicaciones aprobadas aparecerán aquí</div>'
      +(emptyBtn||'')
      +'</div>';
    return;
  }
  el.innerHTML = docs.map(function(doc){ return _inCardHtml(doc, tipo); }).join('');
}

// ─── PORTAL ───────────────────────────────────────────
window.inCargarPortal = async function(){
  _inAdminCache = null;
  var tab = _inTabActual || 'noticia';
  // Mostrar loading en la pestaña activa
  var tabMap = { noticia:'in-lista-noticias', proyecto:'in-lista-proyectos', reporte:'in-lista-reportes' };
  html(tabMap[tab]||'in-lista-noticias','<div style="text-align:center;padding:32px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var isAdmin = await inVerificarAdmin();

    // Noticias
    (async function(){
      try {
        var q = F.query(F.collection(window._fbDb,'noticias'), F.where('estado','==','publicado'), F.orderBy('creadoEn','desc'), F.limit(30));
        var snap = await F.getDocs(q);
        _inCacheNoticias = snap.docs;
        _inRenderLista('in-lista-noticias', snap.docs, 'noticia', '📰','Sin noticias publicadas aún',
          '<button onclick="window.inIrCrear(\'noticia\')" style="background:#1a1f7a;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Enviar noticia</button>');
      } catch(e){
        html('in-lista-noticias','<div style="text-align:center;padding:32px;color:#aaa;font-size:12px;">Error cargando noticias</div>');
      }
    })();

    // Proyectos
    (async function(){
      try {
        var q = F.query(F.collection(window._fbDb,'proyectos'), F.where('estado','==','publicado'), F.orderBy('creadoEn','desc'), F.limit(30));
        var snap = await F.getDocs(q);
        _inCacheProyectos = snap.docs;
        _inRenderLista('in-lista-proyectos', snap.docs, 'proyecto', '🏗️','Sin proyectos publicados aún',
          '<button onclick="window.inIrCrear(\'proyecto\')" style="background:#1a1f7a;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Enviar proyecto</button>');
      } catch(e){
        html('in-lista-proyectos','<div style="text-align:center;padding:32px;color:#aaa;font-size:12px;">Error cargando proyectos</div>');
      }
    })();

    // Reportes
    (async function(){
      try {
        var q = F.query(F.collection(window._fbDb,'reportesCiudadanos'), F.where('estado','==','publicado'), F.orderBy('creadoEn','desc'), F.limit(30));
        var snap = await F.getDocs(q);
        _inCacheReportes = snap.docs;
        _inRenderLista('in-lista-reportes', snap.docs, 'reporte', '⚠️','Sin reportes publicados aún',
          '<button onclick="window.inIrCrear(\'reporte\')" style="background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Enviar reporte</button>');
      } catch(e){
        html('in-lista-reportes','<div style="text-align:center;padding:32px;color:#aaa;font-size:12px;">Error cargando reportes</div>');
      }
    })();

    // Botón admin
    var adminBtn = get('in-admin-btn');
    if(adminBtn) adminBtn.style.display = isAdmin ? 'flex' : 'none';

  } catch(e){
    console.error('[Dominio Informa] Error cargando portal:', e);
  }
};

// ─── CAMBIO DE TAB ────────────────────────────────────
window.inCambiarTab = function(tab){
  _inTabActual = tab;
  // Tabs botones
  ['noticia','proyecto','reporte'].forEach(function(t){
    var btn = get('in-tab-'+t);
    if(btn) btn.classList.toggle('on', t===tab);
  });
  // Contenido
  ['noticia','proyecto','reporte'].forEach(function(t){
    var el = get('in-cont-'+t);
    if(el) el.classList.toggle('show', t===tab);
  });
};

// ─── DETALLE ──────────────────────────────────────────
window.inAbrirDetalle = async function(id, tipo){
  _inDetActual = { id:id, tipo:tipo };
  var t = IN_TIPOS[tipo] || IN_TIPOS.noticia;
  var hdrEl = get('in-det-hdr');
  if(hdrEl) hdrEl.style.background = 'linear-gradient(135deg,'+t.color+','+t.color+'cc)';
  html('in-det-body','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  go('v-inf-det','right');
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var col = _inColeccion(tipo);
    var snap = await F.getDoc(F.doc(window._fbDb, col, id));
    if(!snap.exists()){
      html('in-det-body','<div style="padding:24px;color:#888;text-align:center;">Publicación no encontrada.</div>');
      return;
    }
    var d = snap.data();
    d._id = snap.id;
    // Incrementar vistas
    F.updateDoc(F.doc(window._fbDb,col,id),{ vistas: F.increment(1) }).catch(function(){});
    var fecha = inFechaRel(d.creadoEn||d.publicadoEn||null);
    var util = d.util||0;
    var b = '';
    b += d.imagen ? '<img src="'+inEsc(d.imagen)+'" style="width:100%;height:180px;object-fit:cover;border-radius:16px;margin-bottom:14px;">'
                  : '<div style="width:100%;height:100px;background:linear-gradient(135deg,'+t.color+','+t.color+'aa);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:54px;margin-bottom:14px;">'+t.icon+'</div>';
    b += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'+_inBadge(tipo)+'</div>';
    b += '<div style="font-size:18px;font-weight:800;color:#111;margin-bottom:6px;line-height:1.3;">'+inEsc(d.titulo||'Sin título')+'</div>';
    b += '<div style="font-size:11px;color:#888;margin-bottom:12px;">📅 '+fecha+(d.ubicacion?' · 📍 '+inEsc(d.ubicacion):'')+'</div>';
    if(d.descripcion) b += '<div style="font-size:13px;color:#333;line-height:1.75;margin-bottom:14px;">'+inEsc(d.descripcion).replace(/\n/g,'<br>')+'</div>';
    b += '<div style="background:#EBF4FF;border-radius:12px;padding:10px 12px;font-size:11px;color:#1a1f7a;margin-bottom:14px;">✅ Información verificada y aprobada por el administrador antes de publicarse</div>';
    b += '<div style="display:flex;gap:8px;">'
      +'<button id="in-util-btn" onclick="window.inMarcarUtil(\''+inEsc(id)+'\',\''+inEsc(tipo)+'\')" style="flex:1;background:#EBF4FF;color:#1a1f7a;border:none;border-radius:12px;padding:12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">👍 Útil ('+util+')</button>'
      +'<button onclick="window.inCompartir(\''+inEsc(id)+'\',\''+inEsc(tipo)+'\')" style="flex:1;background:#f5f5f5;color:#555;border:none;border-radius:12px;padding:12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">📤 Compartir</button>'
      +'</div>';
    b += '<div style="height:32px;"></div>';
    html('in-det-body', b);
  } catch(e){
    html('in-det-body','<div style="padding:24px;color:#888;text-align:center;">Error cargando detalle.</div>');
    console.error('[Dominio Informa] Error detalle:', e);
  }
};

window.inMarcarUtil = async function(id, tipo){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await F.updateDoc(F.doc(window._fbDb, _inColeccion(tipo), id),{ util: F.increment(1) });
    var btn = get('in-util-btn');
    if(btn) btn.style.background = '#c8e6ff';
  } catch(_){}
};

window.inCompartir = function(id, tipo){
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  if(navigator.share){
    navigator.share({ title:'Dominio Informa', text:t.icon+' Publicación en Dominio Cumbres', url: window.location.href }).catch(function(){});
  } else {
    alert('Comparte este contenido con tus vecinos.');
  }
};

// ─── MIS PUBLICACIONES ─────────────────────────────────
window.inCargarMis = async function(){
  html('in-mis-lista','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  try {
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    if(!uid){
      html('in-mis-lista','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Debes iniciar sesión.</div>');
      return;
    }
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var cols = ['noticias','proyectos','reportesCiudadanos'];
    var tipos = ['noticia','proyecto','reporte'];
    var todos = [];
    for(var i=0;i<cols.length;i++){
      try {
        var q = F.query(F.collection(window._fbDb,cols[i]), F.where('autorUid','==',uid), F.orderBy('creadoEn','desc'), F.limit(20));
        var snap = await F.getDocs(q);
        snap.docs.forEach(function(doc){ todos.push({ doc:doc, tipo:tipos[i] }); });
      } catch(_){}
    }
    _inMisDocs = todos;
    if(!todos.length){
      html('in-mis-lista','<div style="text-align:center;padding:48px;">'
        +'<div style="font-size:48px;margin-bottom:10px;">📭</div>'
        +'<div style="font-size:14px;font-weight:700;color:#333;margin-bottom:6px;">Sin publicaciones</div>'
        +'<div style="font-size:11px;color:#888;margin-bottom:16px;">Tus publicaciones enviadas aparecerán aquí</div>'
        +'<button onclick="window.inIrCrear(\'noticia\')" style="background:#1a1f7a;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nueva publicación</button>'
        +'</div>');
      return;
    }
    var b = '<div style="padding:14px 14px 0;font-size:11px;font-weight:700;color:#1a1f7a;letter-spacing:.3px;">MIS PUBLICACIONES ('+todos.length+')</div>';
    todos.forEach(function(item){
      var d = item.doc.data();
      var id = item.doc.id;
      var tipo = item.tipo;
      var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
      var est = IN_ESTADOS[d.estado]||IN_ESTADOS.borrador;
      b += '<div style="background:#fff;border-radius:14px;margin:8px 14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:flex-start;gap:10px;" onclick="window.inAbrirDetalle(\''+inEsc(id)+'\',\''+inEsc(tipo)+'\')">'
        +inImgHtml(d.imagen||'', 44, '10px', t.icon)
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:13px;font-weight:700;color:#111;line-height:1.3;margin-bottom:4px;">'+inEsc(d.titulo||'Sin título')+'</div>'
        +'<div style="display:flex;gap:6px;align-items:center;">'
        +'<span style="font-size:10px;font-weight:700;color:'+est.color+';">'+est.icon+' '+est.label+'</span>'
        +'<span style="font-size:10px;color:#aaa;">·</span>'
        +_inBadge(tipo)
        +'</div>'
        +'</div>'
        +'</div>';
    });
    b += '<div style="height:24px;"></div>';
    html('in-mis-lista', b);
  } catch(e){
    html('in-mis-lista','<div style="text-align:center;padding:32px;color:#aaa;font-size:12px;">Error cargando publicaciones.</div>');
    console.error('[Dominio Informa] Error mis publicaciones:', e);
  }
};

// ─── FLUJO CREAR ──────────────────────────────────────
window.inIrCrear = function(tipo){
  _inFormData = { tipo: tipo||'noticia', paso:1, titulo:'', descripcion:'', ubicacion:'', imagen:'', _imagenFile:null };
  _inRenderPaso1();
  go('v-inf-crear','right');
};

function _inStepBar(paso){
  var pasos = ['Tipo','Contenido','Imagen'];
  return '<div style="display:flex;gap:6px;align-items:center;padding:0 0 14px;">'
    + pasos.map(function(lbl,i){
        var n=i+1, active=n===paso, done=n<paso;
        var bg = done?'#1a1f7a':active?'#1A7AB5':'#e0e0e0';
        var color = (done||active)?'#fff':'#aaa';
        return '<div style="display:flex;align-items:center;gap:4px;flex:1;">'
          +'<div style="width:22px;height:22px;border-radius:50%;background:'+bg+';color:'+color+';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">'+(done?'✓':n)+'</div>'
          +'<span style="font-size:10px;font-weight:700;color:'+(active?'#1a1f7a':'#aaa')+';">'+lbl+'</span>'
          +(i<2?'<div style="flex:1;height:2px;background:'+(done?'#1a1f7a':'#e0e0e0')+';border-radius:2px;"></div>':'')
          +'</div>';
      }).join('')
    +'</div>';
}

function _inRenderPaso1(){
  var b = _inStepBar(1);
  b += '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:16px;">¿Qué tipo de publicación es?</div>';
  Object.keys(IN_TIPOS).forEach(function(key){
    var t = IN_TIPOS[key];
    var sel = _inFormData.tipo===key;
    b += '<div onclick="window._inSelTipo(\''+key+'\')" style="background:'+(sel?'#EBF4FF':'#f9f9f9')+';border:2px solid '+(sel?'#1A7AB5':'#e0e0e0')+';border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:12px;">'
      +'<div style="font-size:28px;">'+t.icon+'</div>'
      +'<div><div style="font-size:13px;font-weight:700;color:#111;">'+t.label+'</div>'
      + (key==='reporte' ? '<div style="font-size:11px;color:#888;margin-top:2px;">Tu nombre nunca aparece públicamente</div>' : '')
      + (key==='proyecto' ? '<div style="font-size:11px;color:#888;margin-top:2px;">Info sobre obras o desarrollos de la zona</div>' : '')
      + (key==='noticia' ? '<div style="font-size:11px;color:#888;margin-top:2px;">Noticias relevantes para la comunidad</div>' : '')
      +'</div>'
      +'<div style="margin-left:auto;width:22px;height:22px;border-radius:50%;border:2px solid '+(sel?'#1A7AB5':'#ccc')+';display:flex;align-items:center;justify-content:center;">'+(sel?'<div style="width:12px;height:12px;border-radius:50%;background:#1A7AB5;"></div>':'')+'</div>'
      +'</div>';
  });
  b += '<div style="background:#FFF8E1;border-radius:12px;padding:10px 12px;font-size:11px;color:#7a5800;margin-top:4px;line-height:1.5;">⏳ Todo lo que envíes será revisado por el administrador antes de publicarse.</div>';
  b += '<div style="height:16px;"></div>';
  b += '<button onclick="window.inSiguientePaso(2)" style="width:100%;background:#1a1f7a;color:#fff;border:none;border-radius:14px;padding:15px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Continuar →</button>';
  html('in-crear-body', b);
  var ttl = get('in-crear-titulo');
  if(ttl){ var t2=IN_TIPOS[_inFormData.tipo]||IN_TIPOS.noticia; ttl.textContent=t2.icon+' Nueva publicación'; }
}

window._inSelTipo = function(tipo){
  _inFormData.tipo = tipo;
  _inRenderPaso1();
};

function _inRenderPaso2(){
  var tipo = _inFormData.tipo;
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  var b = _inStepBar(2);
  b += '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:16px;">'+t.icon+' Contenido</div>';
  // Título
  b += '<div style="margin-bottom:12px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">TÍTULO *</label>'
    +'<input id="in-f-titulo" class="inp" placeholder="Título claro y descriptivo..." value="'+inEsc(_inFormData.titulo||'')+'" oninput="window._inValidarCampoF(this)" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;">'
    +'<div id="in-f-titulo-err" style="display:none;font-size:11px;color:#D63A2A;margin-top:4px;"></div>'
    +'</div>';
  // Descripción
  b += '<div style="margin-bottom:12px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">DESCRIPCIÓN *</label>'
    +'<textarea id="in-f-desc" class="inp" rows="5" placeholder="Describe con detalle..." oninput="window._inValidarCampoF(this)" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;resize:none;">'+inEsc(_inFormData.descripcion||'')+'</textarea>'
    +'<div id="in-f-desc-err" style="display:none;font-size:11px;color:#D63A2A;margin-top:4px;"></div>'
    +'</div>';
  // Ubicación
  b += '<div style="margin-bottom:16px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">UBICACIÓN <span style="font-weight:400;color:#aaa;">(opcional)</span></label>'
    +'<input id="in-f-ubic" class="inp" placeholder="Ej. Calle principal, entrada norte..." value="'+inEsc(_inFormData.ubicacion||'')+'" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;">'
    +'</div>';
  if(tipo==='reporte'){
    b += '<div style="background:#FFF3CD;border-radius:12px;padding:10px 12px;font-size:11px;color:#7a5800;margin-bottom:14px;line-height:1.5;">🔒 Si es reporte, tu nombre nunca aparecerá públicamente.</div>';
  }
  b += '<div style="display:flex;gap:10px;">'
    +'<button onclick="window.inSiguientePaso(1)" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">← Atrás</button>'
    +'<button onclick="window.inSiguientePaso(3)" style="flex:2;background:#1a1f7a;color:#fff;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Continuar →</button>'
    +'</div>';
  html('in-crear-body', b);
  var ttl = get('in-crear-titulo');
  if(ttl){ ttl.textContent=t.icon+' Nueva publicación'; }
}

window._inValidarCampoF = function(el){
  var val=(el.value||'').trim();
  var errId = el.id+'-err';
  var errEl = get(errId);
  if(!val){ if(errEl){errEl.style.display='none';} el.style.borderColor='#e0e0e0'; return true; }
  var res=inValidarTexto(val);
  if(res&&res.error){
    el.style.borderColor='#D63A2A';
    if(errEl){errEl.textContent=res.error;errEl.style.color='#D63A2A';errEl.style.display='block';}
    return false;
  }
  if(res&&res.warn){
    el.style.borderColor='#F5A623';
    if(errEl){errEl.textContent=res.warn;errEl.style.color='#F5A623';errEl.style.display='block';}
    return true;
  }
  el.style.borderColor='#1A7AB5';
  if(errEl){errEl.style.display='none';}
  return true;
};

function _inRenderPaso3(){
  var b = _inStepBar(3);
  b += '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:6px;">Foto <span style="font-weight:400;color:#aaa;font-size:13px;">(opcional)</span></div>';
  b += '<div style="font-size:12px;color:#888;margin-bottom:16px;">Agregar una foto ayuda a que más vecinos lean tu publicación.</div>';
  // Preview imagen o upload box
  if(_inFormData._imagenFile || _inFormData.imagen){
    var src = _inFormData._imagenFile ? URL.createObjectURL(_inFormData._imagenFile) : _inFormData.imagen;
    b += '<div style="position:relative;margin-bottom:14px;">'
      +'<img src="'+inEsc(src)+'" style="width:100%;height:160px;object-fit:cover;border-radius:14px;">'
      +'<button onclick="window._inQuitarImagen()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:28px;height:28px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>'
      +'</div>';
  } else {
    b += '<label for="in-f-foto" style="display:block;background:#f5f5f5;border:2px dashed #1A7AB5;border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;margin-bottom:14px;">'
      +'<div style="font-size:36px;margin-bottom:8px;">📷</div>'
      +'<div style="font-size:13px;font-weight:700;color:#1A7AB5;">Toca para agregar foto</div>'
      +'<div style="font-size:11px;color:#aaa;margin-top:4px;">JPG, PNG · Máx 10MB</div>'
      +'</label>'
      +'<input id="in-f-foto" type="file" accept="image/*" style="display:none;" onchange="window._inSeleccionarImagen(this)">';
  }
  b += '<div style="display:flex;gap:10px;margin-top:8px;">'
    +'<button onclick="window.inSiguientePaso(2)" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">← Atrás</button>'
    +'<button onclick="window.inMostrarPreview()" style="flex:2;background:#1a1f7a;color:#fff;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Vista previa →</button>'
    +'</div>';
  html('in-crear-body', b);
}

window._inSeleccionarImagen = function(input){
  var file = input && input.files && input.files[0];
  if(!file) return;
  if(file.size > 10*1024*1024){ alert('La imagen supera 10MB.'); return; }
  _inFormData._imagenFile = file;
  _inRenderPaso3();
};

window._inQuitarImagen = function(){
  _inFormData._imagenFile = null;
  _inFormData.imagen = '';
  _inRenderPaso3();
};

window.inSiguientePaso = function(paso){
  // Guardar datos del paso actual antes de ir al siguiente
  if(paso===2 || (paso===1 && _inFormData.paso===2)){
    // desde paso 2 hacia 3, o desde 3 hacia 2: validar
  }
  if(paso===3 || paso===2){
    // Capturar campos del paso 2
    var tit = get('in-f-titulo');
    var desc = get('in-f-desc');
    var ubic = get('in-f-ubic');
    if(tit) _inFormData.titulo = tit.value.trim();
    if(desc) _inFormData.descripcion = desc.value.trim();
    if(ubic) _inFormData.ubicacion = ubic.value.trim();
    if(paso===3){
      // Validar paso 2
      if(!_inFormData.titulo){ alert('El título es obligatorio.'); return; }
      var r1 = inValidarTexto(_inFormData.titulo);
      if(r1&&r1.error){ alert(r1.error); return; }
      if(!_inFormData.descripcion){ alert('La descripción es obligatoria.'); return; }
      var r2 = inValidarTexto(_inFormData.descripcion);
      if(r2&&r2.error){ alert(r2.error); return; }
    }
  }
  _inFormData.paso = paso;
  if(paso===1) _inRenderPaso1();
  else if(paso===2) _inRenderPaso2();
  else if(paso===3) _inRenderPaso3();
};

// ─── PREVIEW ──────────────────────────────────────────
window.inMostrarPreview = function(){
  var tipo = _inFormData.tipo || 'noticia';
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  var imgSrc = _inFormData._imagenFile ? URL.createObjectURL(_inFormData._imagenFile) : (_inFormData.imagen||'');
  var b = '';
  b += imgSrc ? '<img src="'+inEsc(imgSrc)+'" style="width:100%;height:160px;object-fit:cover;border-radius:14px;margin-bottom:12px;">'
             : '<div style="width:100%;height:80px;background:linear-gradient(135deg,'+t.color+','+t.color+'aa);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:12px;">'+t.icon+'</div>';
  b += '<div style="margin-bottom:8px;">'+_inBadge(tipo)+'</div>';
  b += '<div style="font-size:17px;font-weight:800;color:#111;margin-bottom:6px;line-height:1.3;">'+inEsc(_inFormData.titulo||'Sin título')+'</div>';
  if(_inFormData.ubicacion) b += '<div style="font-size:11px;color:#888;margin-bottom:8px;">📍 '+inEsc(_inFormData.ubicacion)+'</div>';
  b += '<div style="font-size:13px;color:#333;line-height:1.7;margin-bottom:12px;">'+inEsc(_inFormData.descripcion||'').replace(/\n/g,'<br>')+'</div>';
  b += '<div style="background:#EBF4FF;border-radius:12px;padding:10px 12px;font-size:11px;color:#1a1f7a;margin-bottom:16px;">🔍 Pendiente de revisión por el administrador</div>';
  html('in-preview-body', b);
  go('v-inf-preview','right');
};

// ─── PUBLICAR ─────────────────────────────────────────
window.inPublicar = async function(){
  var btn = get('in-pub-btn');
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }
  try {
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    var user = window._fbAuth && window._fbAuth.currentUser;
    if(!uid){ alert('Debes iniciar sesión.'); if(btn){btn.disabled=false;btn.textContent='Enviar para revisión';} return; }
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var col = _inColeccion(_inFormData.tipo||'noticia');
    var datos = {
      tipo:        _inFormData.tipo||'noticia',
      titulo:      _inFormData.titulo||'',
      descripcion: _inFormData.descripcion||'',
      ubicacion:   _inFormData.ubicacion||'',
      imagen:      '',
      estado:      'en_revision',
      autorUid:    uid,
      autorNombre: (user&&user.displayName)||localStorage.getItem('dcuser')||'Vecino',
      creadoEn:    F.serverTimestamp(),
      vistas:      0,
      util:        0
    };
    // si es reporte, ocultar nombre
    if(_inFormData.tipo==='reporte') datos.autorNombre = 'Anónimo';

    var docRef = await F.addDoc(F.collection(window._fbDb, col), datos);
    var docId = docRef.id;

    // subir imagen en fondo
    if(_inFormData._imagenFile){
      (function(file, id, colRef){
        _inUploadImagenFondo(file).then(function(url){
          if(!url) return;
          import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js").then(function(F2){
            F2.updateDoc(F2.doc(window._fbDb, colRef, id),{ imagen:url }).catch(function(){});
          }).catch(function(){});
        });
      })(_inFormData._imagenFile, docId, col);
    }

    // Ir a pantalla de éxito
    go('v-inf-ok','right');
    // Reset
    _inFormData = {};

  } catch(e){
    console.error('[Dominio Informa] Error publicando:', e);
    alert('Error al enviar. Verifica tu conexión.');
    if(btn){ btn.disabled=false; btn.textContent='Enviar para revisión'; }
  }
};

// ─── INIT ─────────────────────────────────────────────
// Exponer inCargarPortal para que go() / data-onenter lo llame
window.inCargarPortal = window.inCargarPortal; // ya está asignado

})();
