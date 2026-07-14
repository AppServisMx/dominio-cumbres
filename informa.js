// ============ DOMINIO INFORMA ============
(function(){
'use strict';

var IN_COLOR  = '#1a1f7a';
var IN_COLOR2 = '#1A7AB5';

var IN_TIPOS = {
  noticia:  { label:'Noticia',           icon:'📰', color:'#1A7AB5', coleccion:'noticias' },
  proyecto: { label:'Proyecto',          icon:'🏗️', color:'#1a1f7a', coleccion:'proyectos' },
  reporte:  { label:'Reporte ciudadano', icon:'⚠️', color:'#D63A2A', coleccion:'reportesCiudadanos' }
};

var IN_ESTADOS = {
  borrador:    { label:'Borrador',    color:'#64748b', icon:'📝' },
  en_revision: { label:'En revisión', color:'#64B5F6', icon:'🔍' },
  publicado:   { label:'Publicado',   color:'#1FC26A', icon:'✅' },
  rechazado:   { label:'Rechazado',   color:'#D63A2A', icon:'❌' }
};

// Anti-spam
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
var _inAdminCache     = null;
var _inTabActual      = 'noticia';
var _inFormData       = {};
var _inDetActual      = null;
var _inMisDocs        = [];
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

// ─── SUBIR IMAGEN EN FONDO ────────────────────────────
async function _inSubirImagen(file){
  if(!file) return '';
  try {
    var S = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
    var uid = (window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||'anon';
    var ext = (file.name.split('.').pop()||'jpg').toLowerCase();
    var ref = S.ref(window._fbStorage,'informa/'+uid+'_'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext);
    await S.uploadBytes(ref, file);
    return await S.getDownloadURL(ref);
  } catch(e){
    console.error('[Dominio Informa] Error subiendo imagen:', e.message||e);
    return '';
  }
}

// ─── LOADING OVERLAY (mismo SVG oficial que Eventos) ─────
function _inMostrarCargando(){
  if(get('in-save-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'in-save-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:#0a0f0a;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;';
  ov.innerHTML =
    '<div style="animation:in-spin 2s linear infinite;">'
    +'<svg width="90" height="90" viewBox="0 0 106 106" fill="none">'
    +'<defs><radialGradient id="inbgl2" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#1E3A28"/><stop offset="100%" stop-color="#0C1A10"/></radialGradient></defs>'
    +'<circle cx="53" cy="53" r="50" fill="url(#inbgl2)"/>'
    +'<circle cx="53" cy="53" r="49" fill="none" stroke="#1FC26A" stroke-width="1.5" stroke-dasharray="10 5" stroke-linecap="round"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#1FC26A"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(60 53 53)"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(120 53 53)"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#D63A2A" transform="rotate(180 53 53)"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(240 53 53)"/>'
    +'<polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(300 53 53)"/>'
    +'<circle cx="53" cy="53" r="14" fill="#0C1A10"/>'
    +'<circle cx="53" cy="53" r="14" fill="none" stroke="#1FC26A" stroke-width="1"/>'
    +'<polygon points="53,42 55,50 53,48 51,50" fill="#1FC26A"/>'
    +'<polygon points="53,42 55,50 53,48 51,50" fill="#F5C518" transform="rotate(120 53 53)"/>'
    +'<polygon points="53,42 55,50 53,48 51,50" fill="#D63A2A" transform="rotate(240 53 53)"/>'
    +'<circle cx="53" cy="53" r="4" fill="#1FC26A"/>'
    +'</svg></div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.55);letter-spacing:1px;">Enviando publicación...</div>'
    +'<style>#in-save-overlay svg{filter:drop-shadow(0 0 18px rgba(31,194,106,.45));}@keyframes in-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>';
  document.body.appendChild(ov);
}
function _inOcultarCargando(){
  var ov = get('in-save-overlay');
  if(ov) ov.remove();
}

// ─── COLECCIÓN POR TIPO ────────────────────────────────
function _inColeccion(tipo){
  return IN_TIPOS[tipo] ? IN_TIPOS[tipo].coleccion : 'noticias';
}

// ─── BADGE HTML ───────────────────────────────────────
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
  var vistas = d.vistas ? ' · 👁️ '+d.vistas : '';
  var util = d.util || 0;
  // primera imagen disponible
  var imgUrl = (d.imagenes&&d.imagenes[0]) || d.imagen || '';
  return '<div onclick="window.inAbrirDetalle(\''+inEsc(id)+'\',\''+inEsc(tipo2)+'\')" style="background:#fff;border-radius:16px;margin:0 14px 12px;box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;cursor:pointer;">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;">'
    +inImgHtml(imgUrl, 56, '12px', t.icon)
    +'<div style="flex:1;min-width:0;">'
    +'<div style="margin-bottom:4px;">'+_inBadge(tipo2)+'</div>'
    +'<div style="font-size:13px;font-weight:700;color:#111;line-height:1.3;margin-bottom:3px;">'+inEsc(d.titulo||'Sin título')+'</div>'
    +'<div style="font-size:11px;color:#888;">📅 '+fecha+vistas+'</div>'
    +'</div></div>'
    +(d.descripcion ? '<div style="font-size:12px;color:#555;line-height:1.5;padding:0 12px 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+inEsc(d.descripcion.substring(0,120))+'</div>' : '')
    +'<div style="padding:0 12px 12px;"><span style="font-size:11px;color:#1A7AB5;font-weight:700;">👍 '+util+' útil</span></div>'
    +'</div>';
}

// ─── PLACEHOLDER BONITO (sin publicaciones) ────────────
function _inEmptyState(tipo, icon, titulo){
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  return '<div style="padding:14px 14px 0;">'
    // Card ejemplo (simulada)
    +'<div style="background:#fff;border-radius:16px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;opacity:.45;pointer-events:none;">'
    +'<div style="display:flex;align-items:flex-start;gap:10px;padding:12px;">'
    +'<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,'+t.color+','+t.color+'88);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">'+t.icon+'</div>'
    +'<div style="flex:1;">'
    +'<div style="height:10px;background:#e8eaf0;border-radius:6px;width:55%;margin-bottom:8px;"></div>'
    +'<div style="height:13px;background:#d0d3dd;border-radius:6px;width:85%;margin-bottom:6px;"></div>'
    +'<div style="height:10px;background:#e8eaf0;border-radius:6px;width:40%;"></div>'
    +'</div></div>'
    +'<div style="height:10px;background:#f0f1f4;margin:0 12px 6px;border-radius:4px;"></div>'
    +'<div style="height:10px;background:#f0f1f4;margin:0 12px 12px;border-radius:4px;width:70%;"></div>'
    +'</div>'
    // Mensaje
    +'<div style="text-align:center;padding:20px 20px 28px;">'
    +'<div style="font-size:42px;margin-bottom:10px;">'+icon+'</div>'
    +'<div style="font-size:14px;font-weight:800;color:#1a1f7a;margin-bottom:6px;">'+titulo+'</div>'
    +'<div style="font-size:12px;color:#888;margin-bottom:18px;line-height:1.5;">Las publicaciones aprobadas por el<br>administrador aparecerán aquí</div>'
    +'<button onclick="window.inIrCrear(\''+tipo+'\')" style="background:'+t.color+';color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Enviar '+t.label.toLowerCase()+'</button>'
    +'</div>'
    +'</div>';
}

// ─── RENDER LISTAS ────────────────────────────────────
function _inRenderLista(colId, docs, tipo){
  var el = get(colId);
  if(!el) return;
  if(!docs || !docs.length){
    var map = { noticia:['📰','Sé el primero en publicar'], proyecto:['🏗️','Sin proyectos publicados aún'], reporte:['⚠️','Sin reportes publicados aún'] };
    var info = map[tipo]||map.noticia;
    el.innerHTML = _inEmptyState(tipo, info[0], info[1]);
    return;
  }
  el.innerHTML = docs.map(function(doc){ return _inCardHtml(doc, tipo); }).join('');
}

// ─── CARGAR COLECCIÓN CON FALLBACK SIN ÍNDICE ─────────
async function _inCargarCol(F, nombre, tipo, listId){
  try {
    // Intento con índice compuesto
    var q = F.query(F.collection(window._fbDb, nombre), F.where('estado','==','publicado'), F.orderBy('creadoEn','desc'), F.limit(30));
    var snap = await F.getDocs(q);
    return snap.docs;
  } catch(e1){
    try {
      // Fallback: sin orderBy (no requiere índice)
      var q2 = F.query(F.collection(window._fbDb, nombre), F.where('estado','==','publicado'), F.limit(30));
      var snap2 = await F.getDocs(q2);
      return snap2.docs;
    } catch(e2){
      console.error('[Dominio Informa] Error cargando '+nombre+':', e2.message||e2);
      return null; // null = error real
    }
  }
}

// ─── PORTAL ───────────────────────────────────────────
window.inCargarPortal = async function(){
  _inAdminCache = null;
  html('in-lista-noticias','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  html('in-lista-proyectos','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  html('in-lista-reportes','<div style="text-align:center;padding:48px;color:#aaa;font-size:13px;">Cargando... ⏳</div>');
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var isAdmin = await inVerificarAdmin();
    var adminBtn = get('in-admin-btn');
    if(adminBtn) adminBtn.style.display = isAdmin ? 'flex' : 'none';

    // Noticias
    (async function(){
      var docs = await _inCargarCol(F,'noticias','noticia','in-lista-noticias');
      _inCacheNoticias = docs||[];
      if(docs===null) html('in-lista-noticias', _inEmptyState('noticia','📰','Sin noticias publicadas aún'));
      else _inRenderLista('in-lista-noticias', docs, 'noticia');
    })();

    // Proyectos
    (async function(){
      var docs = await _inCargarCol(F,'proyectos','proyecto','in-lista-proyectos');
      _inCacheProyectos = docs||[];
      if(docs===null) html('in-lista-proyectos', _inEmptyState('proyecto','🏗️','Sin proyectos publicados aún'));
      else _inRenderLista('in-lista-proyectos', docs, 'proyecto');
    })();

    // Reportes
    (async function(){
      var docs = await _inCargarCol(F,'reportesCiudadanos','reporte','in-lista-reportes');
      _inCacheReportes = docs||[];
      if(docs===null) html('in-lista-reportes', _inEmptyState('reporte','⚠️','Sin reportes publicados aún'));
      else _inRenderLista('in-lista-reportes', docs, 'reporte');
    })();

  } catch(e){
    console.error('[Dominio Informa] Error cargando portal:', e);
  }
};

// ─── CAMBIO DE TAB ────────────────────────────────────
window.inCambiarTab = function(tab){
  _inTabActual = tab;
  ['noticia','proyecto','reporte'].forEach(function(t){
    var btn = get('in-tab-'+t);
    if(btn) btn.classList.toggle('on', t===tab);
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
    F.updateDoc(F.doc(window._fbDb,col,id),{ vistas: F.increment(1) }).catch(function(){});
    var fecha = inFechaRel(d.creadoEn||d.publicadoEn||null);
    var util = d.util||0;
    var imagenes = d.imagenes && d.imagenes.length ? d.imagenes : (d.imagen ? [d.imagen] : []);
    var b = '';
    // Galería de imágenes
    if(imagenes.length){
      if(imagenes.length===1){
        b += '<img src="'+inEsc(imagenes[0])+'" style="width:100%;height:200px;object-fit:cover;border-radius:16px;margin-bottom:14px;" loading="lazy">';
      } else {
        b += '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:14px;padding-bottom:2px;">';
        imagenes.forEach(function(url){
          b += '<img src="'+inEsc(url)+'" style="height:140px;min-width:180px;object-fit:cover;border-radius:12px;flex-shrink:0;" loading="lazy">';
        });
        b += '</div>';
      }
    } else {
      b += '<div style="width:100%;height:100px;background:linear-gradient(135deg,'+t.color+','+t.color+'88);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:54px;margin-bottom:14px;">'+t.icon+'</div>';
    }
    b += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">'+_inBadge(tipo)+'</div>';
    b += '<div style="font-size:18px;font-weight:800;color:#111;margin-bottom:6px;line-height:1.3;">'+inEsc(d.titulo||'Sin título')+'</div>';
    b += '<div style="font-size:11px;color:#888;margin-bottom:12px;">📅 '+fecha+(d.ubicacion?' · 📍 '+inEsc(d.ubicacion):'')+'</div>';
    if(d.descripcion) b += '<div style="font-size:13px;color:#333;line-height:1.75;margin-bottom:14px;">'+inEsc(d.descripcion).replace(/\n/g,'<br>')+'</div>';
    b += '<div style="background:#EBF4FF;border-radius:12px;padding:10px 12px;font-size:11px;color:#1a1f7a;margin-bottom:14px;">✅ Información verificada y aprobada por el administrador</div>';
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
    if(btn){ btn.style.background='#c8e6ff'; btn.disabled=true; }
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
        var q = F.query(F.collection(window._fbDb,cols[i]), F.where('autorUid','==',uid), F.limit(20));
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
      var imgUrl = (d.imagenes&&d.imagenes[0])||d.imagen||'';
      b += '<div style="background:#fff;border-radius:14px;margin:8px 14px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:flex-start;gap:10px;cursor:pointer;" onclick="window.inAbrirDetalle(\''+inEsc(id)+'\',\''+inEsc(tipo)+'\')">'
        +inImgHtml(imgUrl, 44, '10px', t.icon)
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:13px;font-weight:700;color:#111;line-height:1.3;margin-bottom:4px;">'+inEsc(d.titulo||'Sin título')+'</div>'
        +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">'
        +'<span style="font-size:10px;font-weight:700;color:'+est.color+';">'+est.icon+' '+est.label+'</span>'
        +'<span style="font-size:10px;color:#aaa;">·</span>'
        +_inBadge(tipo)
        +'</div></div></div>';
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
  // Sin tipo → mostrar paso 1 (selección de tipo, desde botón "+ Publicar" arriba)
  // Con tipo → saltar directo a paso 2 (desde botones de pestaña)
  _inFormData = { tipo:tipo||'noticia', paso:tipo?2:1, titulo:'', descripcion:'', ubicacion:'', _imagenFiles:[] };
  if(tipo){ _inRenderPaso2(); } else { _inRenderPaso1(); }
  // replaceState: el flujo de creación reemplaza el slot de historial actual
  // para que el botón atrás no regrese a pantallas intermedias del flujo
  try{ history.replaceState({viewId:'v-inf-crear'},'',''); }catch(_){}
  if(window._goCore) window._goCore('v-inf-crear','right');
  else go('v-inf-crear','right');
};

function _inStepBar(paso){
  var pasos = ['Tipo','Contenido','Fotos'];
  return '<div style="display:flex;gap:6px;align-items:center;padding:0 0 16px;">'
    + pasos.map(function(lbl,i){
        var n=i+1, active=n===paso, done=n<paso;
        var bg = done?'#1a1f7a':active?'#1A7AB5':'#e0e0e0';
        var color = (done||active)?'#fff':'#aaa';
        return '<div style="display:flex;align-items:center;gap:4px;flex:1;">'
          +'<div style="width:22px;height:22px;border-radius:50%;background:'+bg+';color:'+color+';font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(done?'✓':n)+'</div>'
          +'<span style="font-size:10px;font-weight:700;color:'+(active?'#1a1f7a':'#aaa')+';">'+lbl+'</span>'
          +(i<2?'<div style="flex:1;height:2px;background:'+(done?'#1a1f7a':'#e0e0e0')+';border-radius:2px;min-width:8px;"></div>':'')
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
      +'<div style="flex:1;">'
      +'<div style="font-size:13px;font-weight:700;color:#111;">'+t.label+'</div>'
      +(key==='reporte'?'<div style="font-size:11px;color:#888;margin-top:2px;">Tu nombre nunca aparece públicamente</div>':'')
      +(key==='proyecto'?'<div style="font-size:11px;color:#888;margin-top:2px;">Info sobre obras o desarrollos de la zona</div>':'')
      +(key==='noticia'?'<div style="font-size:11px;color:#888;margin-top:2px;">Noticias relevantes para la comunidad</div>':'')
      +'</div>'
      +'<div style="width:22px;height:22px;border-radius:50%;border:2px solid '+(sel?'#1A7AB5':'#ccc')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
      +(sel?'<div style="width:12px;height:12px;border-radius:50%;background:#1A7AB5;"></div>':'')
      +'</div></div>';
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
  b += '<div style="margin-bottom:12px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">TÍTULO *</label>'
    +'<input id="in-f-titulo" class="inp" placeholder="Título claro y descriptivo..." value="'+inEsc(_inFormData.titulo||'')+'" oninput="window._inValidarCampoF(this)" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;">'
    +'<div id="in-f-titulo-err" style="display:none;font-size:11px;color:#D63A2A;margin-top:4px;"></div>'
    +'</div>';
  b += '<div style="margin-bottom:12px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">DESCRIPCIÓN *</label>'
    +'<textarea id="in-f-desc" class="inp" rows="5" placeholder="Describe con detalle..." oninput="window._inValidarCampoF(this)" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;resize:none;">'+inEsc(_inFormData.descripcion||'')+'</textarea>'
    +'<div id="in-f-desc-err" style="display:none;font-size:11px;color:#D63A2A;margin-top:4px;"></div>'
    +'</div>';
  b += '<div style="margin-bottom:16px;">'
    +'<label style="font-size:11px;font-weight:700;color:#1a1f7a;display:block;margin-bottom:6px;">UBICACIÓN <span style="font-weight:400;color:#aaa;">(opcional)</span></label>'
    +'<input id="in-f-ubic" class="inp" placeholder="Ej. Calle principal, entrada norte..." value="'+inEsc(_inFormData.ubicacion||'')+'" style="background:#f5f5f5;border:1.5px solid #e0e0e0;color:#111;border-radius:12px;padding:12px;">'
    +'</div>';
  if(tipo==='reporte'){
    b += '<div style="background:#FFF3CD;border-radius:12px;padding:10px 12px;font-size:11px;color:#7a5800;margin-bottom:14px;line-height:1.5;">🔒 Tu nombre nunca aparecerá públicamente en un reporte.</div>';
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
  var errEl = get(el.id+'-err');
  if(!val){ if(errEl) errEl.style.display='none'; el.style.borderColor='#e0e0e0'; return true; }
  var res = inValidarTexto(val);
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
  if(errEl) errEl.style.display='none';
  return true;
};

// ─── PASO 3: FOTOS (máx 5) ────────────────────────────
function _inRenderPaso3(){
  var files = _inFormData._imagenFiles || [];
  var max = 5;
  var b = _inStepBar(3);
  b += '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:4px;">Fotos <span style="font-weight:400;color:#aaa;font-size:13px;">(opcional)</span></div>';
  b += '<div style="font-size:12px;color:#888;margin-bottom:14px;">Agrega hasta '+max+' fotos. Las publicaciones con fotos generan más atención.</div>';

  // Grid de fotos seleccionadas
  if(files.length){
    b += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px;">';
    files.forEach(function(file, i){
      var src = URL.createObjectURL(file);
      b += '<div style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;">'
        +'<img src="'+inEsc(src)+'" style="width:100%;height:100%;object-fit:cover;">'
        +'<button onclick="window._inQuitarFoto('+i+')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>'
        +'</div>';
    });
    // Botón agregar más si no llegó al límite
    if(files.length < max){
      b += '<label for="in-f-fotos" style="aspect-ratio:1;border:2px dashed #1A7AB5;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:#f5f9ff;">'
        +'<div style="font-size:24px;">➕</div>'
        +'<div style="font-size:10px;color:#1A7AB5;font-weight:700;margin-top:4px;">Agregar</div>'
        +'</label>';
    }
    b += '</div>';
    b += '<div style="font-size:11px;color:#aaa;text-align:center;margin-bottom:14px;">'+files.length+' de '+max+' fotos</div>';
  } else {
    // Sin fotos — upload box grande
    b += '<label for="in-f-fotos" style="display:block;background:#f5f5f5;border:2px dashed #1A7AB5;border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;margin-bottom:14px;">'
      +'<div style="font-size:36px;margin-bottom:8px;">📷</div>'
      +'<div style="font-size:13px;font-weight:700;color:#1A7AB5;">Toca para agregar fotos</div>'
      +'<div style="font-size:11px;color:#aaa;margin-top:4px;">Máx '+max+' fotos · JPG, PNG · 10MB c/u</div>'
      +'</label>';
  }
  b += '<input id="in-f-fotos" type="file" accept="image/*" multiple style="display:none;" onchange="window._inSeleccionarFotos(this)">';

  b += '<div style="display:flex;gap:10px;margin-top:4px;">'
    +'<button onclick="window.inSiguientePaso(2)" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">← Atrás</button>'
    +'<button onclick="window.inMostrarPreview()" style="flex:2;background:#1a1f7a;color:#fff;border:none;border-radius:14px;padding:14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Vista previa →</button>'
    +'</div>';
  html('in-crear-body', b);
}

window._inSeleccionarFotos = function(input){
  var files = input && input.files ? Array.from(input.files) : [];
  var actual = _inFormData._imagenFiles || [];
  var disponible = 5 - actual.length;
  if(disponible <= 0){ alert('Ya tienes 5 fotos. Elimina alguna para agregar otra.'); return; }
  var nuevas = files.filter(function(f){ return f.size <= 10*1024*1024; }).slice(0, disponible);
  var rechazadas = files.length - nuevas.length;
  if(rechazadas > 0) alert(rechazadas+' foto(s) superan los 10MB y no se agregaron.');
  _inFormData._imagenFiles = actual.concat(nuevas);
  _inRenderPaso3();
};

window._inQuitarFoto = function(idx){
  var files = _inFormData._imagenFiles || [];
  files.splice(idx, 1);
  _inFormData._imagenFiles = files;
  _inRenderPaso3();
};

window.inSiguientePaso = function(paso){
  if(paso===3 || paso===2){
    var tit = get('in-f-titulo');
    var desc = get('in-f-desc');
    var ubic = get('in-f-ubic');
    if(tit) _inFormData.titulo = tit.value.trim();
    if(desc) _inFormData.descripcion = desc.value.trim();
    if(ubic) _inFormData.ubicacion = ubic.value.trim();
    if(paso===3){
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
  // Resetear botón SIEMPRE antes de mostrar preview
  var btn = get('in-pub-btn');
  if(btn){ btn.disabled=false; btn.textContent='Enviar para revisión'; }

  var tipo = _inFormData.tipo || 'noticia';
  var t = IN_TIPOS[tipo]||IN_TIPOS.noticia;
  var files = _inFormData._imagenFiles || [];
  var b = '';

  // Galería preview
  if(files.length){
    if(files.length===1){
      b += '<img src="'+inEsc(URL.createObjectURL(files[0]))+'" style="width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:12px;">';
    } else {
      b += '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;">';
      files.forEach(function(f){
        b += '<img src="'+inEsc(URL.createObjectURL(f))+'" style="height:130px;min-width:160px;object-fit:cover;border-radius:10px;flex-shrink:0;">';
      });
      b += '</div>';
    }
  } else {
    b += '<div style="width:100%;height:80px;background:linear-gradient(135deg,'+t.color+','+t.color+'aa);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:12px;">'+t.icon+'</div>';
  }
  b += '<div style="margin-bottom:8px;">'+_inBadge(tipo)+'</div>';
  b += '<div style="font-size:17px;font-weight:800;color:#111;margin-bottom:6px;line-height:1.3;">'+inEsc(_inFormData.titulo||'Sin título')+'</div>';
  if(_inFormData.ubicacion) b += '<div style="font-size:11px;color:#888;margin-bottom:8px;">📍 '+inEsc(_inFormData.ubicacion)+'</div>';
  b += '<div style="font-size:13px;color:#333;line-height:1.7;margin-bottom:12px;">'+inEsc(_inFormData.descripcion||'').replace(/\n/g,'<br>')+'</div>';
  b += '<div style="background:#EBF4FF;border-radius:12px;padding:10px 12px;font-size:11px;color:#1a1f7a;">🔍 Pendiente de revisión por el administrador</div>';
  html('in-preview-body', b);
  // replaceState: preview reemplaza crear en el historial (flujo lineal sin retorno)
  try{ history.replaceState({viewId:'v-inf-preview'},'',''); }catch(_){}
  if(window._goCore) window._goCore('v-inf-preview','right');
  else go('v-inf-preview','right');
};

// ─── PUBLICAR (con overlay 2 segundos) ────────────────
window.inPublicar = async function(){
  var btn = get('in-pub-btn');
  if(btn && btn.disabled) return; // evitar doble click
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }

  _inMostrarCargando();
  var minPromise = new Promise(function(r){ setTimeout(r, 2000); });

  try {
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    var user = window._fbAuth && window._fbAuth.currentUser;
    if(!uid){
      await minPromise;
      _inOcultarCargando();
      alert('Debes iniciar sesión.');
      if(btn){ btn.disabled=false; btn.textContent='Enviar para revisión'; }
      return;
    }
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var col = _inColeccion(_inFormData.tipo||'noticia');
    var datos = {
      tipo:        _inFormData.tipo||'noticia',
      titulo:      _inFormData.titulo||'',
      descripcion: _inFormData.descripcion||'',
      ubicacion:   _inFormData.ubicacion||'',
      imagenes:    [],
      estado:      'en_revision',
      autorUid:    uid,
      autorNombre: _inFormData.tipo==='reporte' ? 'Anónimo' : ((user&&user.displayName)||localStorage.getItem('dcuser')||'Vecino'),
      creadoEn:    F.serverTimestamp(),
      vistas:      0,
      util:        0
    };

    var savePromise = F.addDoc(F.collection(window._fbDb, col), datos);
    var results = await Promise.all([savePromise, minPromise]);
    var docRef = results[0];
    var docId = docRef.id;

    _inOcultarCargando();

    // Subir fotos en fondo, actualizar Firestore al terminar cada una
    var files = _inFormData._imagenFiles || [];
    if(files.length){
      (function(fileArr, id, colRef){
        var urls = [];
        var pendiente = fileArr.length;
        fileArr.forEach(function(file){
          _inSubirImagen(file).then(function(url){
            if(url) urls.push(url);
            pendiente--;
            if(pendiente === 0 && urls.length){
              import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js").then(function(F2){
                F2.updateDoc(F2.doc(window._fbDb,colRef,id),{ imagenes:urls }).catch(function(){});
              }).catch(function(){});
            }
          });
        });
      })(files, docId, col);
    }

    // replaceState a v-informa: al terminar, el historial queda como si nunca
    // hubiéramos entrado al flujo de creación — back regresa al portal
    try{ history.replaceState({viewId:'v-informa'},'',''); }catch(_){}
    if(window._goCore) window._goCore('v-inf-ok','right');
    else go('v-inf-ok','right');
    _inFormData = {};

  } catch(e){
    await minPromise;
    _inOcultarCargando();
    console.error('[Dominio Informa] Error publicando:', e);
    alert('Error al enviar. Verifica tu conexión.');
    if(btn){ btn.disabled=false; btn.textContent='Enviar para revisión'; }
  }
};

// Resetea el botón de publicar cada vez que se entra a la preview
window._inResetPubBtn = function(){
  var btn = get('in-pub-btn');
  if(btn){ btn.disabled=false; btn.textContent='Enviar para revisión'; }
};

})();
