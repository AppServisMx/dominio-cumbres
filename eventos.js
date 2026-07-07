// ============ DOMINIO EVENTOS ============
(function(){
'use strict';

var EV_COLOR = '#7C3AED';

var EV_CATS_DEFAULT = ['Todos','🎵 Música','🏃 Deportes','👶 Familiar','🍽️ Gastronomía','📚 Cursos','🐾 Mascotas','🎨 Cultura','🎭 Arte','🌿 Bienestar','🛒 Mercado'];
var EV_CATS = EV_CATS_DEFAULT.slice();

// Precios con fallback (se sobreescriben desde configuracion/eventos)
var EV_PRECIOS = { normal:79, premium:129, destacado30:199, diasPremium:15, diasDestacado30:30 };

var EV_ESTADOS = {
  borrador:       { label:'Borrador',          color:'#64748b', icon:'📝' },
  pendiente_pago: { label:'Pendiente de pago', color:'#F5C518', icon:'⏳' },
  pago_recibido:  { label:'Pago recibido',     color:'#F5A623', icon:'💳' },
  en_revision:    { label:'En revisión',       color:'#64B5F6', icon:'🔍' },
  publicado:      { label:'Publicado',         color:'#1FC26A', icon:'✅' },
  pausado:        { label:'Pausado',           color:'#F5A623', icon:'⏸️' },
  finalizado:     { label:'Finalizado',        color:'#888',    icon:'🏁' },
  rechazado:      { label:'Rechazado',         color:'#D63A2A', icon:'❌' },
  cancelado:      { label:'Cancelado',         color:'#D63A2A', icon:'🚫' }
};

// ─── ANTI-SPAM: REGLAS BLOQUEANTES ────────────────────
var EV_REGLAS_BLOQUEO = [
  { re: /(@(?!\s*$))/,                                                                       msg: '❌ No está permitido mencionar usuarios o redes sociales (@).' },
  { re: /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,                                        msg: '❌ No se permiten correos electrónicos.' },
  { re: /https?:\/\//i,                                                                      msg: '❌ No se permiten enlaces externos.' },
  { re: /\bwww\./i,                                                                          msg: '❌ No se permiten enlaces externos (www).' },
  { re: /\.(com|net|org|edu|gov|mx|io|co|ly|me)\b/i,                                        msg: '❌ No se permiten enlaces externos.' },
  { re: /bit\.ly|tinyurl|cutt\.ly|linktr\.ee|wa\.me|t\.me\/|discord\.gg/i,                  msg: '❌ No se permiten enlaces acortados.' },
  { re: /(\+?[\d][\d\s\-\.\(\)]{8,}[\d])/,                                                  msg: '❌ No se permiten números telefónicos.' },
  { re: /\b(facebook|instagram|tiktok|twitter|telegram|whatsapp|whats app|discord|snapchat|youtube|canal de|grupo de)\b/i, msg: '❌ No se permite promocionar redes sociales.' },
  { re: /\b(gana dinero|hazte rico|hazte millonario|ingresos garantizados|trabaja desde casa|sin esfuerzo|inversión segura|forex|criptomonedas|bitcoin|casino|apuestas)\b/i, msg: '❌ No se permite contenido de venta engañosa.' },
  { re: /\b(sexo|porno|pornograf[ií]a|desnudo|escort|prepago|only fans|onlyfans|xxx|adult[ao])\b/i, msg: '❌ No se permite contenido para adultos.' },
  { re: /\b(vota por|partido pol[ií]tico|campa[ñn]a electoral|candidato|sufragio|propaganda pol[ií]tica)\b/i, msg: '❌ No se permite propaganda política.' },
  { re: /\b(idiota|imb[eé]cil|maldito|put[ao]|cabr[oó]n|pendejo|culero|chinga|verga|pinche)\b/i, msg: '❌ No se permite lenguaje ofensivo.' }
];

function evAdvertencias(val){
  var msgs = [];
  var emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  var emojis  = (val.match(emojiRe)||[]).length;
  if(emojis > 6) msgs.push('⚠️ Demasiados emojis (máx 6).');
  var letras = (val.match(/[a-záéíóúA-ZÁÉÍÓÚ]/g)||[]);
  var mayus  = (val.match(/[A-ZÁÉÍÓÚ]/g)||[]).length;
  if(letras.length > 10 && mayus / letras.length > 0.70) msgs.push('⚠️ Demasiadas mayúsculas. Evita escribir TODO EN MAYÚSCULAS.');
  if(/(.)\1{4,}/.test(val)) msgs.push('⚠️ Evita repetir el mismo carácter muchas veces.');
  return msgs.join(' ');
}

// ─── ESTADO GLOBAL ────────────────────────────────────
window._evDatos      = [];
window._evCategoria  = 'Todos';
window._evFormData   = {};
window._evEditId     = null;
window._evMisActivos = [];
window._evMisRev     = [];
window._evMisPasados = [];

var _evAdminCache  = null; // null=no verificado, true/false=resultado Firestore
var _evBannerTimer = null;
var _evBannerIdx   = 0;
var _evBannerItems = [];
var _evPromoActivo = null; // { codigo, tipo, descripcion, esMaster, docId }

// ─── HELPERS ──────────────────────────────────────────
function get(id){ return document.getElementById(id); }
function txt(id,val){ var el=get(id); if(el) el.textContent=val; }
function html(id,val){ var el=get(id); if(el) el.innerHTML=val; }

function evEsc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function evNorm(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function evImgHtml(url, size, radius, placeholder){
  size = size||60; radius = radius||'12px'; placeholder = placeholder||'🎪';
  if(url) return '<img src="'+evEsc(url)+'" style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';object-fit:cover;flex-shrink:0;" loading="lazy">';
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+';background:linear-gradient(135deg,#2D1B69,#4C1D95);display:flex;align-items:center;justify-content:center;font-size:'+(size*0.45)+'px;flex-shrink:0;">'+placeholder+'</div>';
}

function evFechaRelativa(ts){
  if(!ts) return '';
  try{
    var ms = ts.toMillis ? ts.toMillis() : (typeof ts==='number'?ts:0);
    var diff = Date.now()-ms;
    if(diff<60000) return 'ahora';
    if(diff<3600000) return Math.floor(diff/60000)+'m';
    if(diff<86400000) return Math.floor(diff/3600000)+'h';
    return Math.floor(diff/86400000)+'d';
  }catch(_){ return ''; }
}

// ─── ADMIN VERIFICADO DESDE FIRESTORE ─────────────────
// localStorage solo se usa como indicador visual, NUNCA como autorización real
async function evVerificarAdmin(){
  if(_evAdminCache !== null) return _evAdminCache;
  try {
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    if(!uid){ _evAdminCache=false; return false; }
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'usuarios',uid));
    if(!snap.exists()){ _evAdminCache=false; return false; }
    var data = snap.data();
    _evAdminCache = data.rol==='admin' || data.rol==='maestro' || data.esAdmin===true;
    return _evAdminCache;
  } catch(_){ _evAdminCache=false; return false; }
}

// ─── CARGAR CONFIG DESDE FIRESTORE ────────────────────
// configuracion/eventos: { categorias[], precioNormal, precioPremium, precioImpulsar30, diasPremium, diasImpulsar30 }
async function evCargarConfig(){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'configuracion','eventos'));
    if(!snap.exists()) return;
    var cfg = snap.data();
    if(cfg.categorias && Array.isArray(cfg.categorias) && cfg.categorias.length){
      EV_CATS = ['Todos'].concat(cfg.categorias);
    }
    if(cfg.precioNormal)   EV_PRECIOS.normal      = cfg.precioNormal;
    if(cfg.precioPremium)  EV_PRECIOS.premium     = cfg.precioPremium;
    if(cfg.precioImpulsar30) EV_PRECIOS.destacado30 = cfg.precioImpulsar30;
    if(cfg.diasPremium)    EV_PRECIOS.diasPremium    = cfg.diasPremium;
    if(cfg.diasImpulsar30) EV_PRECIOS.diasDestacado30= cfg.diasImpulsar30;
  } catch(_){} // silently use fallback defaults
}

// ─── VALIDACIÓN DE TEXTO ──────────────────────────────
function evValidarTexto(val){
  for(var i=0;i<EV_REGLAS_BLOQUEO.length;i++){
    if(EV_REGLAS_BLOQUEO[i].re.test(val)) return { error: EV_REGLAS_BLOQUEO[i].msg };
  }
  var warn = evAdvertencias(val);
  if(warn) return { warn: warn };
  return null;
}

function evMostrarErrCampo(id, msg, color){
  var el = get(id); if(!el) return;
  el.style.borderColor = color||'#D63A2A';
  var errEl = get(id+'-err');
  if(errEl){ errEl.textContent=msg; errEl.style.color=color==='#F5A623'?'#F5C518':'#ff6b6b'; errEl.style.display='block'; }
  try{ el.scrollIntoView({behavior:'smooth',block:'center'}); }catch(_){}
}

function evLimpiarErr(id){
  var el=get(id); if(el) el.style.borderColor='rgba(255,255,255,.12)';
  var errEl=get(id+'-err'); if(errEl){ errEl.textContent=''; errEl.style.display='none'; }
}

window.evValidarCampo = function(el){
  var val=(el.value||'').trim();
  var errEl=get(el.id+'-err');
  if(!val){ if(errEl){errEl.textContent='';errEl.style.display='none';} el.style.borderColor='rgba(255,255,255,.12)'; return true; }
  var res=evValidarTexto(val);
  if(res&&res.error){
    el.style.borderColor='#D63A2A';
    if(errEl){errEl.textContent=res.error;errEl.style.color='#ff6b6b';errEl.style.display='block';}
    return false;
  }
  if(res&&res.warn){
    el.style.borderColor='#F5A623';
    if(errEl){errEl.textContent=res.warn;errEl.style.color='#F5C518';errEl.style.display='block';}
    return true;
  }
  el.style.borderColor='rgba(124,58,237,.4)';
  if(errEl){errEl.textContent='';errEl.style.display='none';}
  return true;
};

// ─── PORTAL ───────────────────────────────────────────
window.evCargarPortal = async function(){
  _evAdminCache = null; // reset cache on each portal load
  html('ev-lista','<div style="text-align:center;padding:32px;color:rgba(255,255,255,.3);font-size:13px;">Cargando eventos... ⏳</div>');
  try {
    await evCargarConfig();
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap;
    try {
      // Intento con índice compuesto (estado + orderBy creadoEn)
      var q1 = F.query(
        F.collection(window._fbDb,'eventos'),
        F.where('estado','==','publicado'),
        F.orderBy('creadoEn','desc')
      );
      snap = await F.getDocs(q1);
    } catch(indexErr){
      console.error('[Dominio Eventos] evCargarPortal índice no disponible, usando fallback:', indexErr.message||indexErr);
      // Fallback: query sin orderBy, ordenar en JS
      var q2 = F.query(
        F.collection(window._fbDb,'eventos'),
        F.where('estado','==','publicado')
      );
      snap = await F.getDocs(q2);
    }
    window._evDatos = [];
    snap.forEach(function(d){
      var ev = Object.assign({id:d.id}, d.data());
      if(!ev.eliminado) window._evDatos.push(ev);
    });
    // Ordenar por creadoEn desc en JS siempre (refuerzo del fallback)
    window._evDatos.sort(function(a,b){
      var ta = a.creadoEn&&a.creadoEn.toMillis ? a.creadoEn.toMillis() : 0;
      var tb = b.creadoEn&&b.creadoEn.toMillis ? b.creadoEn.toMillis() : 0;
      return tb - ta;
    });
    evRenderCats();
    evRenderBanner();
    evRenderLista();
  } catch(e){
    console.error('[Dominio Eventos] Error evCargarPortal:', e);
    // Mostrar empty state bonito, no pantalla de error rota
    evRenderBannerVacio(get('ev-banner'));
    html('ev-lista',
      '<div style="text-align:center;padding:40px 20px;">'
      +'<div style="font-size:40px;margin-bottom:12px;">🎪</div>'
      +'<div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:6px;">Dominio Eventos</div>'
      +'<div style="font-size:12px;color:rgba(255,255,255,.25);">No hay eventos disponibles por el momento</div>'
      +'</div>'
    );
  }
};

function evRenderCats(){
  var cont = get('ev-cats');
  if(!cont) return;
  cont.innerHTML = EV_CATS.map(function(c){
    var active = c === window._evCategoria;
    return '<button class="ev-cat-btn" onclick="evFiltrarCat(this,\''+evEsc(c)+'\')" style="flex-shrink:0;border:none;border-radius:20px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;background:'+(active?EV_COLOR:'rgba(255,255,255,.08)')+';color:'+(active?'#fff':'rgba(255,255,255,.6)')+';">'+evEsc(c)+'</button>';
  }).join('');
}

function evRenderBannerVacio(cont){
  if(!cont) return;
  cont.innerHTML = '<div style="height:190px;background:linear-gradient(135deg,#1E0A3C,#4C1D95,#2D1B69);border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;position:relative;overflow:hidden;">'
    +'<div style="position:absolute;inset:0;opacity:.3;background:radial-gradient(circle at 30% 50%,#7C3AED,transparent 60%)"></div>'
    +'<div style="text-align:center;position:relative;"><div style="font-size:48px;">🎪</div>'
    +'<div style="font-size:16px;font-weight:800;color:#fff;margin-top:8px;">Dominio Eventos</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:4px;">Descubre y vive tu comunidad</div></div>'
    +'</div>';
}

function evRenderBannerSlide(cont){
  if(!cont || !_evBannerItems.length) return;
  var ev = _evBannerItems[_evBannerIdx];
  var imgStyle = ev.imagen ? 'url('+evEsc(ev.imagen)+') center/cover' : 'linear-gradient(135deg,#2D1B69,#7C3AED)';
  var badge = ev.tipo==='oficial'
    ? '<div style="position:absolute;top:12px;left:12px;background:#7C3AED;color:#fff;font-size:9px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:.5px;">✦ OFICIAL</div>'
    : '<div style="position:absolute;top:12px;left:12px;background:#F5C518;color:#000;font-size:9px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:.5px;">⭐ PREMIUM</div>';
  var dots = _evBannerItems.length > 1
    ? '<div style="position:absolute;bottom:50px;left:0;right:0;display:flex;justify-content:center;gap:5px;pointer-events:none;">'
      + _evBannerItems.map(function(_,i){
          return '<div style="width:'+(i===_evBannerIdx?16:5)+'px;height:5px;border-radius:3px;background:'+(i===_evBannerIdx?'#fff':'rgba(255,255,255,.35)')+';"></div>';
        }).join('')
      +'</div>'
    : '';
  cont.innerHTML = '<div style="height:200px;background:'+imgStyle+';border-radius:18px;position:relative;overflow:hidden;margin-bottom:16px;cursor:pointer;" onclick="evAbrirDetalle(\''+evEsc(ev.id)+'\')">'
    +'<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.1) 55%,transparent 100%);"></div>'
    +badge+dots
    +'<div style="position:absolute;bottom:0;left:0;right:0;padding:14px 16px;">'
    +'<div style="font-size:17px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:4px;">'+evEsc(ev.titulo)+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:8px;">📅 '+evEsc(ev.fecha)+(ev.horaInicio?' · '+evEsc(ev.horaInicio):'')+(ev.lugar?' · 📍 '+evEsc(ev.lugar):'')+'</div>'
    +'<button style="background:#7C3AED;border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;padding:7px 18px;cursor:pointer;">Ver más →</button>'
    +'</div></div>';
}

function evRenderBanner(){
  var cont = get('ev-banner');
  if(!cont) return;
  if(_evBannerTimer){ clearInterval(_evBannerTimer); _evBannerTimer=null; }
  _evBannerItems = window._evDatos.filter(function(e){
    return e.tipo==='oficial'||e.tipo==='premium'||e.esPremium||e.apareceEnBanner;
  });
  if(!_evBannerItems.length){ evRenderBannerVacio(cont); return; }
  _evBannerIdx = 0;
  evRenderBannerSlide(cont);
  if(_evBannerItems.length > 1){
    _evBannerTimer = setInterval(function(){
      _evBannerIdx = (_evBannerIdx+1) % _evBannerItems.length;
      var c = get('ev-banner');
      if(c) evRenderBannerSlide(c);
      else { clearInterval(_evBannerTimer); _evBannerTimer=null; }
    }, 4000);
  }
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
        ? '<span style="font-size:12px;font-weight:800;color:#F5C518;">$'+evEsc(String(ev.precio))+' MXN</span>'
        : '<span style="font-size:12px;font-weight:800;color:#1FC26A;">GRATIS</span>';
      var badge = ev.tipo==='oficial'
        ? '<span style="background:#7C3AED;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:5px;white-space:nowrap;">OFICIAL</span>'
        : ev.tipo==='premium'
        ? '<span style="background:#F5C518;color:#000;font-size:8px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:5px;white-space:nowrap;">⭐ PREMIUM</span>'
        : '';
      return '<div onclick="evAbrirDetalle(\''+evEsc(ev.id)+'\')" style="background:var(--card-dark);border-radius:16px;padding:13px;display:flex;gap:12px;margin-bottom:10px;cursor:pointer;border:.5px solid rgba(124,58,237,.18);">'
        +evImgHtml(ev.imagen,70,'14px')
        +'<div style="flex:1;min-width:0;">'
        +'<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">'
        +'<span style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">'+evEsc(ev.titulo)+'</span>'+badge+'</div>'
        +'<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:2px;">📅 '+evEsc(ev.fecha)+(ev.horaInicio?' · '+evEsc(ev.horaInicio):'')+'</div>'
        +'<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:7px;">📍 '+evEsc(ev.lugar||'—')+'</div>'
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

// ─── DETALLE ──────────────────────────────────────────
window.evAbrirDetalle = async function(id){
  var ev = window._evDatos.find(function(e){ return e.id===id; });
  if(!ev) return;
  window._evActual = ev;
  var F;
  try {
    F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    F.updateDoc(F.doc(window._fbDb,'eventos',id),{
      'stats.vistas': F.increment(1),
      ultimaVistaEn:  F.serverTimestamp()
    }).catch(function(){});
    if(ev.stats) ev.stats.vistas=(ev.stats.vistas||0)+1;
  } catch(_){}

  var badge = ev.tipo==='oficial'
    ? '<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">✦ EVENTO OFICIAL</span>'
    : ev.tipo==='premium'
    ? '<span style="background:#F5C518;color:#000;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">⭐ EVENTO PREMIUM</span>'
    : '<span style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:10px;font-weight:600;padding:4px 12px;border-radius:20px;">EVENTO DE LA COMUNIDAD</span>';
  var precio = ev.precio&&ev.precio>0
    ? '<div style="background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.3);border-radius:14px;padding:12px 16px;margin-bottom:16px;"><span style="font-size:22px;font-weight:800;color:#F5C518;">$'+evEsc(String(ev.precio))+' MXN</span></div>'
    : '<div style="background:rgba(31,194,106,.1);border:1px solid rgba(31,194,106,.3);border-radius:14px;padding:12px 16px;margin-bottom:16px;"><span style="font-size:20px;font-weight:800;color:#1FC26A;">GRATIS</span></div>';
  var imgTop = ev.imagen
    ? '<div style="height:240px;background:url('+evEsc(ev.imagen)+') center/cover;position:relative;"></div>'
    : '<div style="height:180px;background:linear-gradient(135deg,#1E0A3C,#4C1D95);display:flex;align-items:center;justify-content:center;font-size:72px;position:relative;">🎪</div>';
  var eventoPublicId = ev.eventoPublicId ? '<div style="font-size:10px;color:rgba(255,255,255,.2);margin-bottom:14px;">Folio: '+evEsc(ev.eventoPublicId)+'</div>' : '';

  html('ev-det-cont',
    '<div style="position:relative;">'
    +imgTop
    +'<button onclick="go(\'v-eventos\',\'left\')" style="position:absolute;top:46px;left:12px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);border:none;border-radius:50%;width:38px;height:38px;color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">‹</button>'
    +'</div>'
    +'<div style="padding:16px;">'
    +'<div style="margin-bottom:12px;">'+badge+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:10px;">'+evEsc(ev.titulo)+'</div>'
    +'<div style="background:var(--card-dark);border-radius:14px;padding:14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px;">'
    +'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">📅</span><span>'+evEsc(ev.fecha)+(ev.horaInicio?' · '+evEsc(ev.horaInicio)+(ev.horaFin?' – '+evEsc(ev.horaFin):''):'')+'</span></div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">📍</span><span>'+evEsc(ev.lugar||'Por confirmar')+'</span></div>'
    +(ev.organizador?'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">👤</span><span>'+evEsc(ev.organizador)+(ev.organizadorVerificado?' <span style="font-size:10px;background:rgba(124,58,237,.2);color:#a78bfa;border-radius:8px;padding:1px 6px;">✓ verificado</span>':'')+'</span></div>':'')
    +(ev.cupo?'<div style="font-size:13px;color:rgba(255,255,255,.75);display:flex;gap:8px;align-items:center;"><span style="font-size:16px;">👥</span><span>Cupo: '+evEsc(String(ev.cupo))+' personas</span></div>':'')
    +'</div>'
    +'<div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.2);border-radius:14px;padding:14px;margin-bottom:14px;">'
    +'<div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.75;">'+evEsc(ev.descripcion||'')+'</div>'
    +'</div>'
    +precio
    +'<div style="display:flex;justify-content:space-around;background:var(--card-dark);border-radius:14px;padding:14px;margin-bottom:16px;">'
    +['Vistas','Interesados','Asistirán','Compartidos'].map(function(lbl,i){
      var keys=['vistas','interesados','confirmaciones','compartidos'];
      return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#fff;">'+(ev.stats&&ev.stats[keys[i]]||0)+'</div><div style="font-size:10px;color:rgba(255,255,255,.35);">'+lbl+'</div></div>';
    }).join('')
    +'</div>'
    +'<button id="ev-interes-btn" onclick="evMeInteresa()" style="width:100%;background:rgba(214,58,42,.1);border:1px solid rgba(214,58,42,.3);border-radius:14px;color:#ff6b6b;font-size:13px;font-weight:700;padding:14px;cursor:pointer;margin-bottom:8px;font-family:inherit;">❤️ Me interesa</button>'
    +'<button onclick="evCompartir()" style="width:100%;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.35);border-radius:14px;color:#a78bfa;font-size:13px;font-weight:700;padding:14px;cursor:pointer;margin-bottom:8px;font-family:inherit;">📤 Compartir evento</button>'
    +eventoPublicId
    +'<div style="height:16px;"></div></div>'
  );
  go('v-ev-det','right');

  // Verificar si el usuario ya marcó interés (async, actualiza botón)
  var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
  if(uid && F){
    evVerificarInteres(id, uid, F).then(function(yaInteresa){
      var btn = get('ev-interes-btn');
      if(btn && yaInteresa){
        btn.textContent='❤️ Ya te interesa';
        btn.disabled=true;
        btn.style.opacity='0.6';
        btn.style.cursor='default';
      }
    }).catch(function(){});
  }
};

async function evVerificarInteres(eventoId, uid, F){
  try {
    if(!F) F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'eventos',eventoId,'interesados',uid));
    return snap.exists();
  } catch(_){ return false; }
}

window.evMeInteresa = async function(){
  var ev = window._evActual||{};
  if(!ev.id) return;
  var auth = window._fbAuth && window._fbAuth.currentUser;
  if(!auth){ alert('Inicia sesión para marcar interés.'); return; }
  var uid = auth.uid;
  var btn = get('ev-interes-btn');
  if(btn){ btn.disabled=true; btn.textContent='Registrando...'; }
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var intRef = F.doc(window._fbDb,'eventos',ev.id,'interesados',uid);
    var snap = await F.getDoc(intRef);
    if(snap.exists()){
      if(btn){ btn.textContent='❤️ Ya te interesa'; btn.style.opacity='0.6'; btn.style.cursor='default'; }
      return;
    }
    await F.setDoc(intRef,{ uid:uid, en:F.serverTimestamp() });
    await F.updateDoc(F.doc(window._fbDb,'eventos',ev.id),{
      'stats.interesados': F.increment(1),
      ultimaInteraccionEn: F.serverTimestamp()
    });
    if(ev.stats) ev.stats.interesados=(ev.stats.interesados||0)+1;
    if(btn){ btn.textContent='❤️ Ya te interesa'; btn.style.opacity='0.6'; btn.style.cursor='default'; }
  } catch(e){
    if(btn){ btn.disabled=false; btn.textContent='❤️ Me interesa'; }
    console.error('[Dominio Eventos] evMeInteresa:', e);
  }
};

window.evCompartir = async function(){
  var ev = window._evActual||{};
  var compartido = false;
  if(navigator.share){
    try{
      await navigator.share({ title:ev.titulo||'Evento', text:(ev.titulo||'Evento')+'\n📅 '+(ev.fecha||'')+'\n📍 '+(ev.lugar||''), url:window.location.href });
      compartido = true;
    }catch(_){}
  } else {
    try{ await navigator.clipboard.writeText(window.location.href); alert('¡Enlace copiado!'); compartido=true; }catch(_){}
  }
  if(compartido && ev.id){
    try{
      var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      F.updateDoc(F.doc(window._fbDb,'eventos',ev.id),{
        'stats.compartidos': F.increment(1),
        ultimaInteraccionEn: F.serverTimestamp()
      }).catch(function(){});
      if(ev.stats) ev.stats.compartidos=(ev.stats.compartidos||0)+1;
    }catch(_){}
  }
};

// ─── CREAR EVENTO ─────────────────────────────────────
window.evIniciarCrear = function(){
  var auth = window._fbAuth && window._fbAuth.currentUser;
  if(!auth){ alert('Inicia sesión para crear un evento.'); return; }
  window._evFormData = {};
  window._evEditId   = null;
  _evPromoActivo     = null;
  go('v-ev-crear-tipo','right');
};

window.evElegirTipo = async function(tipo){
  if(tipo==='oficial'){
    var esAdmin = await evVerificarAdmin();
    if(!esAdmin){ alert('Solo los administradores pueden crear eventos oficiales.'); return; }
  }
  window._evFormData.tipo = tipo;
  go('v-ev-reglas','right');
};

window.evAceptarReglas = function(){
  window._evFormData._reglasAceptadas = true;
  evLimpiarFormulario();
  evIrFormStep(1);
};

function evLimpiarFormulario(){
  ['ev-titulo','ev-desc','ev-cat','ev-tipo-ev','ev-fecha','ev-hora-i','ev-hora-f','ev-lugar','ev-precio','ev-cupo','ev-org'].forEach(function(id){
    var el=get(id); if(el) el.value='';
    evLimpiarErr(id);
  });
  var prev=get('ev-img-preview'), lbl=get('ev-img-label');
  if(prev){prev.style.display='none';prev.style.backgroundImage='';}
  if(lbl) lbl.style.display='flex';
  window._evFormData._imagenFile=null;
  window._evFormData._imagenPreview=null;
  window._evFormData._imagenUrl=null;
}

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

// ─── PASO 1 y 2: VALIDAR INFO ─────────────────────────
window.evSiguienteStep = function(){
  var step = window._evFormStep||1;
  if(step===1){
    var titulo  = (get('ev-titulo')&&get('ev-titulo').value||'').trim();
    var desc    = (get('ev-desc')&&get('ev-desc').value||'').trim();
    var cat     = (get('ev-cat')&&get('ev-cat').value)||'';
    var tipoEv  = (get('ev-tipo-ev')&&get('ev-tipo-ev').value)||'';
    var ok = true;

    if(!titulo){
      evMostrarErrCampo('ev-titulo','❌ El título es obligatorio.'); ok=false;
    } else if(titulo.length<5){
      evMostrarErrCampo('ev-titulo','❌ El título debe tener al menos 5 caracteres.'); ok=false;
    } else if(titulo.length>120){
      evMostrarErrCampo('ev-titulo','❌ El título no puede superar 120 caracteres.'); ok=false;
    } else {
      var rTit = evValidarTexto(titulo);
      if(rTit&&rTit.error){ evMostrarErrCampo('ev-titulo',rTit.error); ok=false; }
      else if(rTit&&rTit.warn){ evMostrarErrCampo('ev-titulo',rTit.warn,'#F5A623'); }
      else evLimpiarErr('ev-titulo');
    }

    if(!desc){
      evMostrarErrCampo('ev-desc','❌ La descripción es obligatoria.'); ok=false;
    } else if(desc.length<30){
      evMostrarErrCampo('ev-desc','❌ La descripción debe tener al menos 30 caracteres ('+desc.length+'/30).'); ok=false;
    } else if(desc.length>2000){
      evMostrarErrCampo('ev-desc','❌ La descripción no puede superar 2000 caracteres.'); ok=false;
    } else {
      var rDesc = evValidarTexto(desc);
      if(rDesc&&rDesc.error){ evMostrarErrCampo('ev-desc',rDesc.error); ok=false; }
      else if(rDesc&&rDesc.warn){ evMostrarErrCampo('ev-desc',rDesc.warn,'#F5A623'); }
      else evLimpiarErr('ev-desc');
    }

    if(!cat){
      var ce=get('ev-cat-err'); if(ce){ce.textContent='❌ Selecciona una categoría.';ce.style.color='#ff6b6b';ce.style.display='block';} ok=false;
    } else { var ce2=get('ev-cat-err'); if(ce2) ce2.style.display='none'; }

    if(!tipoEv){
      var te=get('ev-tipo-ev-err'); if(te){te.textContent='❌ Selecciona el tipo de evento.';te.style.color='#ff6b6b';te.style.display='block';} ok=false;
    } else { var te2=get('ev-tipo-ev-err'); if(te2) te2.style.display='none'; }

    if(!ok) return;
    window._evFormData.titulo      = titulo;
    window._evFormData.descripcion = desc;
    window._evFormData.categoria   = cat;
    window._evFormData.tipoEvento  = tipoEv;
    evIrFormStep(2);

  } else if(step===2){
    var fecha  = (get('ev-fecha')&&get('ev-fecha').value)||'';
    var hi     = (get('ev-hora-i')&&get('ev-hora-i').value)||'';
    var hf     = (get('ev-hora-f')&&get('ev-hora-f').value)||'';
    var lugar  = (get('ev-lugar')&&get('ev-lugar').value||'').trim();
    var org    = (get('ev-org')&&get('ev-org').value||'').trim();
    var precio = parseFloat(get('ev-precio')&&get('ev-precio').value)||0;
    var cupo   = parseInt(get('ev-cupo')&&get('ev-cupo').value)||0;
    var ok2 = true;

    if(!fecha){
      evMostrarErrCampo('ev-fecha','❌ La fecha es obligatoria.'); ok2=false;
    } else {
      var hoy=new Date(); hoy.setHours(0,0,0,0);
      var fEv=new Date(fecha+'T00:00:00');
      if(fEv<hoy){ evMostrarErrCampo('ev-fecha','❌ La fecha no puede ser anterior al día de hoy.'); ok2=false; }
      else evLimpiarErr('ev-fecha');
    }

    if(!hi){ evMostrarErrCampo('ev-hora-i','❌ La hora de inicio es obligatoria.'); ok2=false; }
    else evLimpiarErr('ev-hora-i');

    if(hi&&hf&&hf<=hi){ evMostrarErrCampo('ev-hora-f','❌ La hora de fin debe ser posterior a la de inicio.'); ok2=false; }
    else if(hf) evLimpiarErr('ev-hora-f');

    if(!lugar){
      evMostrarErrCampo('ev-lugar','❌ El lugar es obligatorio.'); ok2=false;
    } else if(lugar.length>200){
      evMostrarErrCampo('ev-lugar','❌ El lugar no puede superar 200 caracteres.'); ok2=false;
    } else {
      var rLug = evValidarTexto(lugar);
      if(rLug&&rLug.error){ evMostrarErrCampo('ev-lugar',rLug.error); ok2=false; }
      else evLimpiarErr('ev-lugar');
    }

    if(org){
      if(org.length>100){ evMostrarErrCampo('ev-org','❌ El nombre del organizador no puede superar 100 caracteres.'); ok2=false; }
      else {
        var rOrg = evValidarTexto(org);
        if(rOrg&&rOrg.error){ evMostrarErrCampo('ev-org',rOrg.error); ok2=false; }
        else evLimpiarErr('ev-org');
      }
    } else evLimpiarErr('ev-org');

    if(isNaN(precio)||precio<0||precio>99999){ evMostrarErrCampo('ev-precio','❌ Precio inválido (0–99,999).'); ok2=false; }
    if(isNaN(cupo)||cupo<0||cupo>99999){ evMostrarErrCampo('ev-cupo','❌ Cupo inválido (0–99,999).'); ok2=false; }

    if(!window._evFormData._imagenFile && !window._evFormData._imagenUrl){
      var ie=get('ev-img-err');
      if(ie){ie.textContent='❌ Agrega una imagen para el evento.';ie.style.color='#ff6b6b';ie.style.display='block';}
      ok2=false;
    } else { var ie2=get('ev-img-err'); if(ie2) ie2.style.display='none'; }

    if(!ok2) return;
    window._evFormData.fecha       = fecha;
    window._evFormData.horaInicio  = hi;
    window._evFormData.horaFin     = hf;
    window._evFormData.lugar       = lugar;
    window._evFormData.precio      = precio;
    window._evFormData.cupo        = cupo;
    window._evFormData.organizador = org || (localStorage.getItem('dcuserNombre')||'');
    evMostrarPreview();
  }
};

// ─── IMAGEN ───────────────────────────────────────────
window.evSubirImagen = function(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var TIPOS_OK = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
  if(TIPOS_OK.indexOf(file.type)===-1){ alert('Formato no permitido. Usa JPG, PNG, WEBP o GIF.'); input.value=''; return; }
  if(file.size > 3*1024*1024){ alert('La imagen no puede superar 3 MB.'); input.value=''; return; }
  var prev=get('ev-img-preview'), lbl=get('ev-img-label'), err=get('ev-img-err');
  if(err) err.style.display='none';
  var reader = new FileReader();
  reader.onload = function(e){
    window._evFormData._imagenFile    = file;
    window._evFormData._imagenPreview = e.target.result;
    if(prev){ prev.style.display='block'; prev.style.backgroundImage='url('+e.target.result+')'; prev.style.backgroundSize='cover'; prev.style.backgroundPosition='center'; prev.innerHTML=''; }
    if(lbl) lbl.style.display='none';
  };
  reader.readAsDataURL(file);
};

async function evUploadImagen(){
  if(!window._evFormData._imagenFile) return window._evFormData._imagenUrl||'';
  try {
    var S   = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
    var uid = (window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||'anon';
    var ext = (window._evFormData._imagenFile.name.split('.').pop()||'jpg').toLowerCase();
    var ref = S.ref(window._fbStorage,'eventos/'+uid+'_'+Date.now()+'.'+ext);
    await S.uploadBytes(ref, window._evFormData._imagenFile);
    return await S.getDownloadURL(ref);
  } catch(e){
    console.error('[Dominio Eventos] Error subiendo imagen:', e);
    return '';
  }
}

// ─── PREVIEW ──────────────────────────────────────────
function evMostrarPreview(){
  var d = window._evFormData;
  var imgHtml = d._imagenPreview
    ? '<div style="height:200px;background:url('+d._imagenPreview+') center/cover;border-radius:16px;margin-bottom:14px;"></div>'
    : evImgHtml('',null,'16px')+'<div style="height:14px;"></div>';
  var badge = d.tipo==='oficial'
    ? '<span style="background:#7C3AED;color:#fff;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">✦ EVENTO OFICIAL</span>'
    : d.tipo==='premium'
    ? '<span style="background:#F5C518;color:#000;font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;">⭐ EVENTO PREMIUM</span>'
    : '<span style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:10px;font-weight:600;padding:4px 12px;border-radius:20px;">EVENTO DE LA COMUNIDAD</span>';
  html('ev-preview-cont',
    '<div style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:#a78bfa;font-weight:600;">✦ Así verá tu evento la comunidad. Revisa antes de publicar.</div>'
    +imgHtml
    +'<div style="margin-bottom:12px;">'+badge+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;margin-bottom:8px;">'+evEsc(d.titulo)+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:3px;">📅 '+evEsc(d.fecha)+(d.horaInicio?' · '+evEsc(d.horaInicio)+(d.horaFin?' – '+evEsc(d.horaFin):''):'')+'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:14px;">📍 '+evEsc(d.lugar)+'</div>'
    +(d.organizador?'<div style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:14px;">👤 '+evEsc(d.organizador)+'</div>':'')
    +'<div style="background:rgba(124,58,237,.07);border:1px solid rgba(124,58,237,.15);border-radius:12px;padding:14px;margin-bottom:14px;">'
    +'<div style="font-size:13px;color:rgba(255,255,255,.78);line-height:1.75;">'+evEsc(d.descripcion)+'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-around;background:var(--card-dark);border-radius:12px;padding:12px;margin-bottom:14px;">'
    +['Vistas','Interesados','Asistirán','Compartidos'].map(function(l){ return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:#fff;">0</div><div style="font-size:10px;color:rgba(255,255,255,.35);">'+l+'</div></div>'; }).join('')
    +'</div>'
    +(d.precio>0?'<div style="font-size:16px;font-weight:800;color:#F5C518;margin-bottom:4px;">💰 $'+evEsc(String(d.precio))+' MXN</div>':'<div style="font-size:16px;font-weight:800;color:#1FC26A;margin-bottom:4px;">GRATIS</div>')
    +(d.cupo?'<div style="font-size:12px;color:rgba(255,255,255,.4);">👥 Cupo: '+evEsc(String(d.cupo))+' personas</div>':'')
  );
  go('v-ev-preview','right');
}

window.evContinuarDesdePreview = async function(){
  var auth = window._fbAuth && window._fbAuth.currentUser;
  var uid  = auth && auth.uid;
  if(uid){
    var esAdmin = await evVerificarAdmin();
    if(!esAdmin){
      var uTipo = localStorage.getItem('dcuserTipo')||'vecino';
      var limRes = await evVerificarLimiteActivos(uid, uTipo);
      if(!limRes.ok){
        alert('Has alcanzado el límite de '+limRes.limite+' evento(s) activo(s) para tu cuenta. Espera a que alguno finalice antes de publicar uno nuevo.');
        return;
      }
    }
  }
  go('v-ev-publicar','right');
  evRenderPublicar();
};

// ─── LÍMITE EVENTOS ACTIVOS ───────────────────────────
// vecino: máx 1 activo. restaurante/negocio/servicio/ride: máx 3. admin: sin límite.
async function evVerificarLimiteActivos(uid, uTipo){
  var ACTIVOS = ['publicado','en_revision','pendiente_pago','pago_recibido'];
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    // Query sin orderBy para evitar índice compuesto
    var snap = await F.getDocs(F.query(F.collection(window._fbDb,'eventos'), F.where('autorUid','==',uid)));
    var count = 0;
    snap.forEach(function(d){
      var ev = d.data();
      if(ACTIVOS.indexOf(ev.estado)!==-1 && !ev.eliminado) count++;
    });
    var limite = (uTipo==='vecino'||!uTipo) ? 1 : 3;
    if(count>=limite) return { ok:false, limite:limite, activos:count };
    return { ok:true };
  } catch(_){ return { ok:true }; } // si falla, no bloquear
}

// ─── PUBLICAR ─────────────────────────────────────────
async function evLeerCortesia(uid){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'usuarios',uid,'beneficios','eventos'));
    if(!snap.exists()) return 0;
    return snap.data().cortesiasDisponibles||0;
  } catch(_){ return 0; }
}

async function evDescontarCortesia(uid){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await F.updateDoc(F.doc(window._fbDb,'usuarios',uid,'beneficios','eventos'),{
      cortesiasDisponibles: F.increment(-1),
      cortesiasUsadas:      F.increment(1),
      ultimaCortesiaUsada:  F.serverTimestamp()
    });
  } catch(_){}
}

async function evLeerVerificado(uid){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'usuarios',uid));
    if(!snap.exists()) return false;
    return snap.data().organizadorVerificado===true;
  } catch(_){ return false; }
}

async function evRenderPublicar(){
  var esAdmin = await evVerificarAdmin();
  if(esAdmin){
    html('ev-pub-cont','<div style="text-align:center;padding:20px 0;">'
      +'<div style="font-size:40px;margin-bottom:12px;">🛡️</div>'
      +'<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:8px;">Publicación de Administrador</div>'
      +'<div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:24px;">Tu evento se publicará inmediatamente como Evento Oficial.</div>'
      +'<button onclick="evPublicarDirecto(\'publicado\',\'oficial\')" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;padding:16px;cursor:pointer;font-family:inherit;">✦ Publicar como Evento Oficial</button>'
      +'</div>');
    return;
  }
  var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
  if(!uid){ evMostrarOpciones(); return; }
  html('ev-pub-cont','<div style="text-align:center;padding:32px;color:rgba(255,255,255,.3);font-size:13px;">Verificando beneficios... ⏳</div>');
  evLeerCortesia(uid).then(function(disponibles){
    if(disponibles>0){
      html('ev-pub-cont','<div style="text-align:center;padding:20px 0;">'
        +'<div style="font-size:48px;margin-bottom:12px;">🎁</div>'
        +'<div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;">¡Tienes una Publicación de Cortesía!</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:24px;">Disponibles: <strong style="color:#7C3AED;">'+disponibles+'</strong><br>Publica este evento gratis. Pasa por revisión antes de aparecer.</div>'
        +'<button onclick="evPublicarCortesia()" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;padding:16px;cursor:pointer;font-family:inherit;margin-bottom:10px;">🎁 Usar Cortesía</button>'
        +'<button onclick="evMostrarOpciones()" style="width:100%;background:transparent;border:none;color:rgba(255,255,255,.4);font-size:12px;cursor:pointer;padding:10px;font-family:inherit;">Ver otras opciones</button>'
        +'</div>');
    } else {
      evMostrarOpciones();
    }
  });
}

window.evMostrarOpciones = function(){
  // Usa EV_PRECIOS que puede venir de Firestore o del fallback
  html('ev-pub-cont','<div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;">Elige cómo publicar tu evento:</div>'
    +'<div onclick="evSeleccionarPlan(\'normal\')" style="background:var(--card-dark);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px;margin-bottom:12px;cursor:pointer;">'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">📋 Publicación Normal</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.5;margin-bottom:8px;">Aparece en el listado general. Pasa por revisión antes de publicarse.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#7C3AED;">$'+EV_PRECIOS.normal+' MXN</div>'
    +'</div>'
    +'<div onclick="evSeleccionarPlan(\'premium\')" style="background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(91,33,182,.08));border:1.5px solid '+EV_COLOR+';border-radius:16px;padding:16px;cursor:pointer;position:relative;">'
    +'<div style="position:absolute;top:-1px;right:14px;background:#F5C518;color:#000;font-size:8px;font-weight:800;padding:3px 8px;border-radius:0 0 8px 8px;letter-spacing:.3px;">MÁS POPULAR</div>'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">⭐ Destacar evento</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);line-height:1.5;margin-bottom:8px;">Aparece en el banner principal · Insignia Premium · Prioridad en resultados · '+EV_PRECIOS.diasPremium+' días.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#F5C518;">$'+EV_PRECIOS.premium+' MXN</div>'
    +'</div>'
    +'<div onclick="evSeleccionarPlan(\'destacado30\')" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;margin-top:12px;cursor:pointer;">'
    +'<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">🚀 Impulsar 30 días</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.45);line-height:1.5;margin-bottom:8px;">Máxima exposición · '+EV_PRECIOS.diasDestacado30+' días · Mejor valor.</div>'
    +'<div style="font-size:20px;font-weight:800;color:#fff;">$'+EV_PRECIOS.destacado30+' MXN</div>'
    +'</div>'
    // ─── TARJETA CÓDIGO PROMOCIONAL — estilo cupón punteado ──
    +'<div style="background:rgba(124,58,237,.07);border:2.5px dashed rgba(180,140,255,.75);border-radius:16px;padding:16px;margin-top:12px;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">'
    +'<div style="display:flex;align-items:center;gap:9px;">'
    +'<div style="width:32px;height:32px;background:rgba(124,58,237,.25);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🏷️</div>'
    +'<span style="font-size:14px;font-weight:700;color:#fff;">¿Tienes código promocional?</span>'
    +'</div>'
    +'<span style="font-size:16px;color:rgba(255,255,255,.25);cursor:default;">ⓘ</span>'
    +'</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:12px;padding-left:41px;">Ingresa tu código para aplicar beneficios exclusivos.</div>'
    +'<div style="position:relative;margin-bottom:10px;">'
    +'<span style="position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:14px;color:rgba(255,255,255,.25);pointer-events:none;">🏷️</span>'
    +'<input id="ev-promo-input" type="text" placeholder="Ej. ABC123456" maxlength="9"'
    +' style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.14);border-radius:12px;color:#fff;font-size:14px;font-weight:600;padding:13px 13px 13px 40px;box-sizing:border-box;font-family:inherit;letter-spacing:1.5px;text-transform:uppercase;outline:none;"'
    +' oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,\'\')"></div>'
    +'<button onclick="evAplicarCodigoPromo()" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:12px;color:#fff;font-size:13px;font-weight:700;padding:13px;cursor:pointer;font-family:inherit;">Aplicar código</button>'
    +'<div id="ev-promo-err" style="display:none;font-size:11px;color:#ff6b6b;margin-top:8px;"></div>'
    +'</div>'
    // ─── AVISO PAGO ────────────────────────────────────────
    +'<div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:12px;padding:10px;margin-top:16px;font-size:10px;color:rgba(255,255,255,.35);text-align:center;line-height:1.6;">'
    +'⚠️ El pago se realiza por transferencia o en efectivo. Al confirmar, tu evento quedará en <strong>Pendiente de pago</strong> hasta que el administrador confirme el depósito.'
    +'</div>'
    +'</div>');
};

window.evSeleccionarPlan = function(plan){
  var tipoPub = (plan==='premium'||plan==='destacado30') ? plan : 'normal';
  evGuardarEvento('pendiente_pago', tipoPub, null);
};

// ─── SISTEMA DE CÓDIGOS PROMOCIONALES ─────────────────
// Colección Firestore: codigosPromocionalesEventos
// Campos: codigo, activo, usado, usoMultiple, usadoPor, eventoId,
//         fechaCreacion, fechaVigencia, fechaUso, tipo, creadoPor, descripcion
// tipos futuros: publicacion_gratuita | descuento_parcial | destacar_evento |
//               impulsar_evento | evento_oficial | campana

// Código maestro interno — no expuesto en texto plano
var _EV_MP = 'QVlIMTUxMTE1'; // base64, no modificar

function _evEsMasterCodigo(c){
  try{ return typeof atob==='function' && atob(_EV_MP)===c; }catch(_){ return false; }
}

// Valida formato AAA999999 (3 letras + 6 números)
function evValidarFormatoCodigo(c){
  return /^[A-Z]{3}[0-9]{6}$/.test(c);
}

// Consulta Firestore para códigos normales (no master)
async function evValidarCodigoFirestore(codigo){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDocs(F.query(
      F.collection(window._fbDb,'codigosPromocionalesEventos'),
      F.where('codigo','==',codigo),
      F.where('activo','==',true)
    ));
    if(snap.empty) return { valido:false, msg:'❌ Código promocional inválido.' };
    var doc = null;
    snap.forEach(function(d){ if(!doc) doc = Object.assign({_id:d.id}, d.data()); });
    if(!doc) return { valido:false, msg:'❌ Código promocional inválido.' };
    // Un solo uso: verificar si ya fue usado
    if(!doc.usoMultiple && doc.usado){
      return { valido:false, msg:'❌ Este código ya fue utilizado.' };
    }
    // Verificar vigencia (los códigos normales duran 7 días)
    if(doc.fechaVigencia){
      var vigencia = doc.fechaVigencia.toDate ? doc.fechaVigencia.toDate() : new Date(doc.fechaVigencia);
      if(vigencia < new Date()){
        return { valido:false, msg:'❌ Este código ha expirado.' };
      }
    }
    return { valido:true, tipo:doc.tipo||'publicacion_gratuita', descripcion:doc.descripcion||'Publicación sin costo (pago exonerado)', docId:doc._id };
  } catch(e){
    console.error('[Dominio Eventos] evValidarCodigoFirestore:', e);
    return { valido:false, msg:'❌ Error al verificar el código. Intenta de nuevo.' };
  }
}

window.evAplicarCodigoPromo = async function(){
  var input = get('ev-promo-input');
  var errEl = get('ev-promo-err');
  if(!input || !errEl) return;

  var codigo = (input.value||'').trim().toUpperCase();

  if(!codigo){
    errEl.textContent='❌ Ingresa un código promocional.';
    errEl.style.display='block'; return;
  }
  if(!evValidarFormatoCodigo(codigo)){
    errEl.textContent='❌ El formato del código es incorrecto. Debe tener 3 letras + 6 números (Ej: ABC123456).';
    errEl.style.display='block';
    input.style.borderColor='#D63A2A'; return;
  }
  errEl.style.display='none';
  input.style.borderColor='rgba(124,58,237,.4)';

  // Código maestro interno: sin límite de uso, sin vigencia, sin registro en Firestore
  if(_evEsMasterCodigo(codigo)){
    _evPromoActivo = { codigo:codigo, tipo:'publicacion_gratuita', descripcion:'Publicación sin costo (pago exonerado)', esMaster:true };
    evMostrarModalPromoOk(codigo, _evPromoActivo.descripcion);
    return;
  }

  // Códigos normales: verificar en Firestore
  errEl.textContent='Verificando código... ⏳';
  errEl.style.color='rgba(255,255,255,.4)';
  errEl.style.display='block';
  var resultado = await evValidarCodigoFirestore(codigo);
  errEl.style.color='#ff6b6b';
  if(!resultado.valido){
    errEl.textContent=resultado.msg;
    errEl.style.display='block';
    input.style.borderColor='#D63A2A'; return;
  }
  errEl.style.display='none';
  _evPromoActivo = { codigo:codigo, tipo:resultado.tipo, descripcion:resultado.descripcion, esMaster:false, docId:resultado.docId };
  evMostrarModalPromoOk(codigo, _evPromoActivo.descripcion);
};

function evMostrarModalPromoOk(codigo, desc){
  var existing = document.getElementById('ev-promo-modal');
  if(existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ev-promo-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
  overlay.innerHTML =
    '<div style="background:#12121e;border:1px solid rgba(124,58,237,.35);border-radius:24px;padding:28px 22px;width:100%;max-width:360px;text-align:center;position:relative;">'
    // Ícono check con decoración
    +'<div style="position:relative;display:inline-block;margin-bottom:18px;">'
    +'<div style="width:76px;height:76px;background:linear-gradient(135deg,#1FC26A,#16A357);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:38px;color:#fff;font-weight:900;margin:0 auto;">✓</div>'
    +'<div style="position:absolute;top:-6px;left:-10px;width:9px;height:9px;background:#7C3AED;border-radius:50%;"></div>'
    +'<div style="position:absolute;top:2px;right:-8px;width:6px;height:6px;background:#F5C518;border-radius:50%;"></div>'
    +'<div style="position:absolute;bottom:0;left:-14px;width:5px;height:5px;background:#1FC26A;border-radius:50%;"></div>'
    +'<div style="position:absolute;top:-4px;right:-14px;width:4px;height:4px;background:#ff6b6b;border-radius:3px;transform:rotate(45deg);"></div>'
    +'<div style="position:absolute;bottom:-4px;right:-6px;width:7px;height:7px;background:#a78bfa;border-radius:50%;"></div>'
    +'</div>'
    +'<div style="font-size:21px;font-weight:800;color:#fff;margin-bottom:7px;">¡Código aplicado!</div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.45);line-height:1.55;margin-bottom:20px;">El código promocional se aplicó<br>correctamente a tu evento.</div>'
    // Caja del código
    +'<div style="background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.18);border-radius:14px;padding:14px 20px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:10px;">'
    +'<span style="font-size:17px;">🏷️</span>'
    +'<span style="font-size:21px;font-weight:800;color:#fff;letter-spacing:2px;">'+evEsc(codigo)+'</span>'
    +'</div>'
    // Beneficio
    +'<div style="background:rgba(31,194,106,.07);border:1px solid rgba(31,194,106,.22);border-radius:13px;padding:12px 14px;margin-bottom:10px;text-align:left;">'
    +'<div style="font-size:12px;font-weight:700;color:#1FC26A;margin-bottom:5px;">✅ Beneficio aplicado</div>'
    +'<div style="font-size:12px;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:6px;"><span>✅</span><span>'+evEsc(desc||'Publicación sin costo (pago exonerado)')+'</span></div>'
    +'</div>'
    // Importante
    +'<div style="background:rgba(100,181,246,.05);border:1px solid rgba(100,181,246,.18);border-radius:13px;padding:12px 14px;margin-bottom:20px;text-align:left;">'
    +'<div style="font-size:12px;font-weight:700;color:#64B5F6;margin-bottom:4px;">ℹ️ Importante</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.42);line-height:1.65;">Tu evento será enviado a revisión y no se publicará de inmediato. Te notificaremos por alerta cuando el administrador lo revise.</div>'
    +'</div>'
    +'<button id="ev-promo-cont-btn" onclick="evConfirmarCodigoPromo()" style="width:100%;background:linear-gradient(135deg,#7C3AED,#5B21B6);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:700;padding:16px;cursor:pointer;font-family:inherit;">Continuar</button>'
    +'<div id="ev-promo-modal-err" style="display:none;margin-top:10px;font-size:12px;color:#ff6b6b;text-align:center;"></div>'
    +'</div>';
  document.body.appendChild(overlay);
}

function _evMostrarOverlayCargando(){
  var ex = document.getElementById('ev-save-overlay');
  if(ex) return;
  var ov = document.createElement('div');
  ov.id = 'ev-save-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:#0a0f0a;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;';
  ov.innerHTML =
    '<div style="animation:ev-spin 2s linear infinite;">'
    +'<svg width="90" height="90" viewBox="0 0 106 106" fill="none">'
    +'<defs><radialGradient id="bgl2" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#1E3A28"/><stop offset="100%" stop-color="#0C1A10"/></radialGradient></defs>'
    +'<circle cx="53" cy="53" r="50" fill="url(#bgl2)"/>'
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
    +'<div style="font-size:13px;color:rgba(255,255,255,.55);letter-spacing:1px;">Guardando tu evento...</div>'
    +'<style>#ev-save-overlay svg{filter:drop-shadow(0 0 18px rgba(31,194,106,.45));}@keyframes ev-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>';
  document.body.appendChild(ov);
}
function _evOcultarOverlayCargando(){
  var ov = document.getElementById('ev-save-overlay');
  if(ov) ov.remove();
}

window.evConfirmarCodigoPromo = async function(){
  if(!_evPromoActivo){ var m=document.getElementById('ev-promo-modal'); if(m)m.remove(); evMostrarOpciones(); return; }
  var modal = document.getElementById('ev-promo-modal');
  if(modal) modal.remove();
  _evMostrarOverlayCargando();
  var promoSnap = _evPromoActivo;
  var timedOut = false;
  var timeoutId;
  var savePromise = evGuardarEvento('en_revision','codigo_promocional', promoSnap, true);
  var timeoutPromise = new Promise(function(resolve){
    timeoutId = setTimeout(function(){ timedOut=true; resolve(false); }, 30000);
  });
  var eventoId = await Promise.race([savePromise, timeoutPromise]);
  clearTimeout(timeoutId);
  _evOcultarOverlayCargando();
  if(eventoId){
    if(!promoSnap.esMaster){
      var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
      await evConsumirCodigo(promoSnap, uid||'', eventoId);
    }
    _evPromoActivo = null;
    // evGuardarEvento ya llamó go('v-ev-ok') internamente
  } else {
    // Falló o timeout → mostrar modal de nuevo con error
    evMostrarModalPromoOk(promoSnap.codigo, promoSnap.descripcion);
    setTimeout(function(){
      var errEl = document.getElementById('ev-promo-modal-err');
      var btn   = document.getElementById('ev-promo-cont-btn');
      if(errEl){ errEl.textContent = timedOut ? '❌ Tiempo agotado. Verifica tu conexión e intenta de nuevo.' : '❌ Error al guardar. Verifica tu conexión e intenta de nuevo.'; errEl.style.display='block'; }
      if(btn){ btn.disabled=false; btn.textContent='Reintentar'; }
    }, 50);
  }
};

// Marca el código como utilizado en Firestore (solo códigos normales, no master)
async function evConsumirCodigo(promo, uid, eventoId){
  if(promo.esMaster||!promo.docId) return;
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await F.updateDoc(F.doc(window._fbDb,'codigosPromocionalesEventos',promo.docId),{
      usado:    true,
      usadoPor: uid||'',
      eventoId: eventoId||'',
      fechaUso: F.serverTimestamp()
    });
  } catch(e){ console.error('[Dominio Eventos] evConsumirCodigo:', e); }
}

window.evPublicarCortesia = async function(){
  var uid = window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid;
  if(!uid){ alert('Debes iniciar sesión.'); return; }
  var disponibles = await evLeerCortesia(uid);
  if(disponibles<=0){ alert('Ya no tienes cortesías disponibles.'); evMostrarOpciones(); return; }
  // Guardar evento PRIMERO, descontar cortesía SOLO si el guardado tuvo éxito
  var ok = await evGuardarEvento('en_revision','normal',null);
  if(ok) await evDescontarCortesia(uid);
};

window.evPublicarDirecto = async function(estado, tipoPub){
  await evGuardarEvento(estado, tipoPub, null);
};

// ─── ID PÚBLICO DEL EVENTO ────────────────────────────
function evGenerarPublicId(){
  var year = new Date().getFullYear();
  var rand = Math.floor(Math.random()*900000)+100000;
  return 'DCE-'+year+'-'+rand;
}

// ─── FECHAS PREMIUM ───────────────────────────────────
function evCalcFechasPremium(plan){
  var dias = plan==='premium' ? (EV_PRECIOS.diasPremium||15) : (EV_PRECIOS.diasDestacado30||30);
  var inicio = new Date();
  var fin    = new Date(inicio.getTime() + dias*24*60*60*1000);
  return { fechaInicioPremium: inicio.toISOString(), fechaFinPremium: fin.toISOString() };
}

// ─── GUARDAR EVENTO ───────────────────────────────────
// Retorna el ID del evento guardado (string) si fue exitoso, false si falló
async function evGuardarEvento(estado, tipoPub, promoData, sinAlert){
  var btn = get('ev-pub-btn');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  var d       = window._evFormData;
  var auth    = window._fbAuth && window._fbAuth.currentUser;
  var uid     = auth && auth.uid;
  var uNombre = localStorage.getItem('dcuserNombre')||'';
  var uTipo   = localStorage.getItem('dcuserTipo')||'vecino';
  // Admin real verificado desde Firestore
  var esAdminReal = await evVerificarAdmin();
  var estadoFinal = esAdminReal ? 'publicado' : estado;
  try {
    var esDup = await evDetectarDuplicado(uid, d.titulo, d.fecha, d.lugar);
    if(esDup && estadoFinal==='publicado') estadoFinal='en_revision';

    // Subir imagen primero; si falla no guardamos el evento
    var imagenUrl = '';
    if(window._evFormData._imagenFile){
      imagenUrl = await evUploadImagen();
      if(!imagenUrl){
        if(!sinAlert) alert('Error al subir la imagen. Intenta de nuevo.');
        if(btn){ btn.disabled=false; btn.textContent='Reintentar'; }
        return false;
      }
    } else {
      imagenUrl = window._evFormData._imagenUrl||'';
    }

    var verificado = uid ? await evLeerVerificado(uid) : false;
    // Organizador verificado + plan pagado puede saltarse revisión al confirmar pago,
    // pero NO puede saltar el pago en sí. Eso lo gestiona el admin.

    var esPromo   = !!(promoData && promoData.codigo);
    var esPremium = !esPromo && (tipoPub==='premium'||tipoPub==='destacado30');
    var fechasPremium = esPremium ? evCalcFechasPremium(tipoPub) : { fechaInicioPremium:null, fechaFinPremium:null };

    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var ahora = F.serverTimestamp();
    var data = {
      titulo:       d.titulo,
      descripcion:  d.descripcion,
      categoria:    d.categoria,
      tipoEvento:   d.tipoEvento,
      fecha:        d.fecha,
      horaInicio:   d.horaInicio,
      horaFin:      d.horaFin||'',
      lugar:        d.lugar,
      precio:       d.precio||0,
      cupo:         d.cupo||0,
      organizador:  d.organizador||'',
      imagen:       imagenUrl,
      tipo:         esPromo ? 'normal' : (tipoPub||d.tipo||'normal'),
      esPremium:    esPremium,
      destacado:    false,
      destacadoHasta:       null,
      apareceEnBanner:      !esPromo && (tipoPub==='premium'||d.tipo==='oficial'),
      planDestacado:        esPromo ? 'codigo_promocional' : (tipoPub||'normal'),
      // Código promocional
      codigoPromocional:    esPromo ? promoData.codigo : null,
      requierePago:         !esPromo,
      publicacionAutorizada: esPromo,
      fechaInicioPremium:   fechasPremium.fechaInicioPremium,
      fechaFinPremium:      fechasPremium.fechaFinPremium,
      estado:               estadoFinal,
      // Soft delete
      eliminado:            false,
      eliminadoEn:          null,
      eliminadoPor:         null,
      // Moderación
      motivoRechazo:        '',
      revisadoPor:          null,
      revisadoEn:           null,
      // Campos normalizados para duplicados
      tituloNorm:           evNorm(d.titulo),
      lugarNorm:            evNorm(d.lugar),
      // Autor
      autorUid:             uid||'',
      autorNombre:          uNombre,
      autorTipo:            uTipo,
      organizadorVerificado: verificado,
      // ID público legible
      eventoPublicId:       evGenerarPublicId(),
      // Timestamps
      creadoEn:             ahora,
      actualizadoEn:        ahora,
      ultimaVistaEn:        null,
      ultimaInteraccionEn:  null,
      // Estadísticas
      stats: { vistas:0, interesados:0, confirmaciones:0, compartidos:0 }
    };
    var eventoIdResultado;
    if(window._evEditId){
      delete data.creadoEn;
      delete data.eventoPublicId; // no sobreescribir ID público en edición
      delete data.stats;          // no reiniciar estadísticas en edición
      delete data.eliminado;      // no tocar soft delete en edición normal
      data.actualizadoEn = ahora;
      await F.updateDoc(F.doc(window._fbDb,'eventos',window._evEditId), data);
      eventoIdResultado = window._evEditId;
    } else {
      var docRef = await F.addDoc(F.collection(window._fbDb,'eventos'), data);
      eventoIdResultado = docRef.id;
    }

    var msgPrincipal, msgSub;
    if(estadoFinal==='publicado'){
      msgPrincipal='¡Tu evento está publicado! Ya puede verlo toda la comunidad.';
      msgSub='Aparecerá en el portal de eventos de inmediato.';
    } else if(estadoFinal==='pendiente_pago'){
      msgPrincipal='¡Evento registrado! Está pendiente de pago.';
      msgSub='Una vez que el administrador confirme tu pago, pasará a revisión y será publicado.';
    } else {
      msgPrincipal='¡Evento enviado a revisión!';
      msgSub='El proceso toma menos de 24 horas. Te notificaremos cuando sea aprobado.'+(esDup?' (posible duplicado detectado — revisión manual)':'');
    }
    txt('ev-ok-msg', msgPrincipal);
    txt('ev-ok-sub', msgSub);
    go('v-ev-ok','right');
    return eventoIdResultado; // string truthy = éxito
  } catch(e){
    console.error('[Dominio Eventos] Error evGuardarEvento:', e);
    if(!sinAlert) alert('Error al guardar: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Reintentar'; }
    return false;
  }
}

// ─── DETECCIÓN DE DUPLICADOS ──────────────────────────
async function evDetectarDuplicado(uid, titulo, fecha, lugar){
  if(!uid) return false;
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var tNorm = evNorm(titulo);
    var lNorm = evNorm(lugar);
    var q = F.query(
      F.collection(window._fbDb,'eventos'),
      F.where('autorUid','==',uid),
      F.where('tituloNorm','==',tNorm),
      F.where('fecha','==',fecha)
    );
    var snap = await F.getDocs(q);
    var dup = false;
    snap.forEach(function(d){
      var ev = d.data();
      if(evNorm(ev.lugar)===lNorm && d.id!==(window._evEditId||'') && !ev.eliminado) dup=true;
    });
    return dup;
  } catch(_){ return false; } // si falla el índice, no bloquear
}

// ─── MIS EVENTOS ──────────────────────────────────────
window.evAbrirMisEventos = function(){
  go('v-ev-mis','right');
  evCargarMisEventos();
};

window.evCargarMisEventos = async function(){
  var auth = window._fbAuth && window._fbAuth.currentUser;
  if(!auth){
    html('ev-mis-activos','<div style="text-align:center;padding:24px;color:rgba(255,255,255,.35);font-size:13px;">Inicia sesión para ver tus eventos</div>');
    html('ev-mis-revision','');
    html('ev-mis-pasados','');
    return;
  }
  var uid = auth.uid;
  ['activos','revision','pasados'].forEach(function(t){
    html('ev-mis-'+t,'<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Cargando...</div>');
  });
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap;
    try {
      // Intento con orderBy (requiere índice compuesto)
      var q1 = F.query(
        F.collection(window._fbDb,'eventos'),
        F.where('autorUid','==',uid),
        F.orderBy('creadoEn','desc')
      );
      snap = await F.getDocs(q1);
    } catch(indexErr){
      console.error('[Dominio Eventos] evCargarMisEventos índice no disponible, usando fallback:', indexErr.message||indexErr);
      // Fallback: sin orderBy, ordenar en JS
      var q2 = F.query(F.collection(window._fbDb,'eventos'), F.where('autorUid','==',uid));
      snap = await F.getDocs(q2);
    }
    var todos = [];
    snap.forEach(function(d){
      var ev = Object.assign({id:d.id}, d.data());
      if(!ev.eliminado) todos.push(ev);
    });
    // Ordenar por creadoEn desc en JS
    todos.sort(function(a,b){
      var ta = a.creadoEn&&a.creadoEn.toMillis ? a.creadoEn.toMillis() : 0;
      var tb = b.creadoEn&&b.creadoEn.toMillis ? b.creadoEn.toMillis() : 0;
      return tb - ta;
    });
    var activos=[], revision=[], pasados=[];
    todos.forEach(function(ev){
      if(ev.estado==='publicado'||ev.estado==='pausado') activos.push(ev);
      else if(['en_revision','pago_recibido','pendiente_pago','borrador'].indexOf(ev.estado)!==-1) revision.push(ev);
      else pasados.push(ev);
    });
    window._evMisActivos=activos; window._evMisRev=revision; window._evMisPasados=pasados;
    evRenderMisTab('activos',  activos,  true,  false);
    evRenderMisTab('revision', revision, false, false);
    evRenderMisTab('pasados',  pasados,  false, true);
  } catch(e){
    console.error('[Dominio Eventos] Error evCargarMisEventos:', e);
    // Mostrar empty state, no pantalla de error rota
    ['activos','revision','pasados'].forEach(function(t){
      html('ev-mis-'+t,'<div style="text-align:center;padding:32px 20px;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div style="font-size:13px;color:rgba(255,255,255,.3);">Sin eventos aquí</div></div>');
    });
  }
};

function evRenderMisTab(tabId, datos, showStats, showRepublicar){
  var cont = get('ev-mis-'+tabId);
  if(!cont) return;
  if(!datos.length){
    cont.innerHTML='<div style="text-align:center;padding:32px 20px;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div style="font-size:13px;color:rgba(255,255,255,.3);">Sin eventos aquí</div></div>';
    return;
  }
  cont.innerHTML = datos.map(function(ev){
    var est = EV_ESTADOS[ev.estado]||{label:ev.estado||'—',color:'#aaa',icon:'•'};
    var statsHtml = showStats
      ? '<div style="display:flex;gap:10px;margin-top:8px;">'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">👀 '+(ev.stats&&ev.stats.vistas||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">❤️ '+(ev.stats&&ev.stats.interesados||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">👥 '+(ev.stats&&ev.stats.confirmaciones||0)+'</span>'
        +'<span style="font-size:10px;color:rgba(255,255,255,.35);">📤 '+(ev.stats&&ev.stats.compartidos||0)+'</span>'
        +'</div>' : '';
    var motivoHtml = ev.motivoRechazo
      ? '<div style="font-size:10px;color:#ff6b6b;margin-top:4px;background:rgba(214,58,42,.08);border-radius:6px;padding:4px 8px;">Motivo: '+evEsc(ev.motivoRechazo)+'</div>' : '';
    var publicIdHtml = ev.eventoPublicId
      ? '<div style="font-size:9px;color:rgba(255,255,255,.18);margin-top:2px;">'+evEsc(ev.eventoPublicId)+'</div>' : '';
    var acciones = showRepublicar
      ? '<button onclick="evRepublicar(\''+evEsc(ev.id)+'\')" style="font-size:11px;font-weight:700;color:#7C3AED;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:8px;padding:5px 12px;cursor:pointer;margin-top:8px;font-family:inherit;">🔁 Republicar</button>'
      : (showStats ? '<button onclick="evImpulsarEvento(\''+evEsc(ev.id)+'\')" style="font-size:11px;font-weight:700;color:#F5C518;background:rgba(245,197,24,.08);border:1px solid rgba(245,197,24,.3);border-radius:8px;padding:5px 12px;cursor:pointer;margin-top:8px;font-family:inherit;">🚀 Impulsar</button>' : '');
    return '<div style="background:var(--card-dark);border-radius:14px;padding:12px;margin-bottom:10px;display:flex;gap:12px;border:.5px solid rgba(124,58,237,.15);">'
      +evImgHtml(ev.imagen,56,'10px')
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">'+evEsc(ev.titulo||'Sin título')+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:2px;">📅 '+evEsc(ev.fecha||'—')+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px;">📍 '+evEsc(ev.lugar||'—')+'</div>'
      +'<span style="font-size:9px;font-weight:800;color:'+est.color+';background:'+est.color+'20;border:1px solid '+est.color+'40;border-radius:10px;padding:2px 8px;">'+est.icon+' '+evEsc(est.label.toUpperCase())+'</span>'
      +publicIdHtml+motivoHtml+statsHtml+acciones
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

// ─── REPUBLICAR ───────────────────────────────────────
window.evRepublicar = async function(id){
  try {
    var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await F.getDoc(F.doc(window._fbDb,'eventos',id));
    if(!snap.exists()){ alert('Evento no encontrado.'); return; }
    var ev = snap.data();
    window._evFormData = {
      tipo:           ev.tipo||'normal',
      titulo:         ev.titulo||'',
      descripcion:    ev.descripcion||'',
      categoria:      ev.categoria||'',
      tipoEvento:     ev.tipoEvento||'',
      lugar:          ev.lugar||'',
      precio:         ev.precio||0,
      organizador:    ev.organizador||'',
      _imagenUrl:     ev.imagen||'',
      _imagenPreview: ev.imagen||'',
      _republicar:    true
    };
    window._evEditId = null;
    evIrFormStep(1);
    setTimeout(function(){
      var t=get('ev-titulo'); if(t) t.value=ev.titulo||'';
      var de=get('ev-desc');  if(de) de.value=ev.descripcion||'';
      var c=get('ev-cat');    if(c) c.value=ev.categoria||'';
      var te=get('ev-tipo-ev'); if(te) te.value=ev.tipoEvento||'';
    },80);
  } catch(e){ alert('Error al republicar: '+e.message); }
};

// ─── IMPULSAR ─────────────────────────────────────────
window.evImpulsarEvento = function(id){
  window._evImpulsarId = id;
  go('v-ev-impulsar','right');
};

})();
