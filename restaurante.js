/* ════════════════════════════════════════════════════════
   MÓDULO RESTAURANTE DC
   ════════════════════════════════════════════════════════ */

'use strict';
function _resc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ── Cache de pedidos reales para Centro Operativo (Firestore) ── */
var _vrPedidosCache = [];

async function _vrCargarPedidos() {
  if (_vrIsD()) return;
  var uid=_vrUid(); var db=_vrDb(); if(!uid||!db) return;
  try {
    var f=await _vrFb();
    var snap=await f.getDocs(f.query(f.collection(db,'pedidos'),f.where('restauranteId','==',uid)));
    _vrPedidosCache=[];
    snap.forEach(function(d){ _vrPedidosCache.push(Object.assign({_id:d.id},d.data())); });
    _vrPedidosCache.sort(function(a,b){ return (b.fecha||0)-(a.fecha||0); });
  } catch(e) { }
}

function _vrPedidos() { return _vrPedidosCache; }

/* ── Helpers Firebase para Centro Operativo Restaurante ── */
function _vrFb()  { return import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'); }
function _vrDb()  { return window._fbDb; }
function _vrUid() { return window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid; }
function _vrIsD() { return !(_vrUid() && _vrDb()); }

var _vrMenuCache = [];

// Nota: NO usa orderBy para evitar que Firestore excluya documentos sin campo 'orden'
async function _vrCargarMenu() {
  if (_vrIsD()) return;
  var uid = _vrUid(); var db = _vrDb(); if (!uid || !db) return;
  try {
    var f = await _vrFb();
    var snap = await f.getDocs(f.collection(db,'menu',uid,'productos'));
    _vrMenuCache = [];
    snap.forEach(function(d){ _vrMenuCache.push(Object.assign({_id:d.id}, d.data())); });
    _vrMenuCache.sort(function(a,b){
      var oa = (a.orden!=null ? a.orden : 9999);
      var ob = (b.orden!=null ? b.orden : 9999);
      if (oa !== ob) return oa - ob;
      return (a.creado||0) - (b.creado||0);
    });
  } catch(e) { }
}

function _vrMenu() { return _vrMenuCache; }

var _vrNotifsCache = [];
var _vrBannersCache = [];

/* ═══════════════════════════════════════════════════════
   ESTADOS
═══════════════════════════════════════════════════════ */
var DC_ESTADOS = {
  activo:  { ic:'🟢', dot:'verde',    lbl:'ACTIVO',   col:'var(--green)', dotEl:'verde',    desc:'Recibiendo pedidos' },
  ocupado: { ic:'🟡', dot:'amarillo', lbl:'OCUPADO',  col:'#d97706',       dotEl:'amarillo', desc:'Respuesta más lenta' },
  pausado: { ic:'🟠', dot:'naranja',   lbl:'PAUSADO',  col:'#E87722',       dotEl:'naranja',  desc:'Sin nuevos pedidos' },
  cerrado: { ic:'🔴', dot:'rojo',     lbl:'CERRADO',  col:'var(--red)',    dotEl:'rojo',     desc:'No disponible' },
};

/* ── Estado automático por horario ─────────────────────────────
   Calcula si el restaurante está abierto/cerrado según el array
   HORARIOS y la hora local del navegador.
   Retorna 'activo' o 'cerrado'.
   ──────────────────────────────────────────────────────────── */
function _calcEstadoHorario(horariosArr) {
  // Si se pasa null explícito (Food vecino sin horarios): no usar HORARIOS global
  // Si no se pasa argumento (undefined, CO restaurante): usar HORARIOS global como fallback
  var arr = (horariosArr !== undefined && horariosArr !== null)
    ? horariosArr
    : (horariosArr === undefined && typeof HORARIOS !== 'undefined' ? HORARIOS : null);
  if (!arr || !arr.length) return null; // sin horario → sin cálculo
  var DIAS = ['dom','lun','mar','mie','jue','vie','sab'];
  var ahora = new Date();
  var diaKey = DIAS[ahora.getDay()];
  var h = null;
  for (var i=0; i<arr.length; i++) { if (arr[i].id === diaKey) { h = arr[i]; break; } }
  if (!h) return null;
  if (!h.abierto) return 'cerrado'; // día marcado como cerrado
  var hhmm = function(str) {
    var p = (str||'').split(':');
    return parseInt(p[0]||0)*60 + parseInt(p[1]||0);
  };
  var ahMin = ahora.getHours()*60 + ahora.getMinutes();
  var abreMin = hhmm(h.abre);
  var cierraMin = hhmm(h.cierra);
  if (cierraMin <= abreMin) cierraMin += 24*60;
  return (ahMin >= abreMin && ahMin < cierraMin) ? 'activo' : 'cerrado';
}
window._calcEstadoHorario = _calcEstadoHorario; // expuesto globalmente

// REGLA UNIVERSAL DE ESTADO — el estado manual se respeta hasta el siguiente
// cambio de horario (apertura o cierre); a partir de ahí el horario retoma el control.
function _ultimoLimiteHorario(horariosArr) {
  var arr = (horariosArr !== undefined && horariosArr !== null)
    ? horariosArr
    : (horariosArr === undefined && typeof HORARIOS !== 'undefined' ? HORARIOS : null);
  if (!arr || !arr.length) return null;
  var DIAS = ['dom','lun','mar','mie','jue','vie','sab'];
  var ahora = new Date(); var now = ahora.getTime(); var best = null;
  var hhmm = function(s){ var p=(s||'').split(':'); return parseInt(p[0]||0,10)*60+parseInt(p[1]||0,10); };
  for (var back=0; back<8; back++) {
    var d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()-back);
    var key = DIAS[d.getDay()]; var h = null;
    for (var i=0;i<arr.length;i++){ if(arr[i].id===key){ h=arr[i]; break; } }
    if (!h || !h.abierto) continue;
    var abre=hhmm(h.abre), cierra=hhmm(h.cierra);
    if (cierra<=abre) cierra+=24*60;
    var tA = new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,abre).getTime();
    var tC = new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,cierra).getTime();
    if (tC<=now && (best===null||tC>best)) best=tC;
    if (tA<=now && (best===null||tA>best)) best=tA;
    if (best!==null) break;
  }
  return best;
}
// Compartida (restaurante y negocio): ¿el horario indica CERRADO ahora?
window._horarioFuerzaCerrado = function(horariosArr) {
  try { return _calcEstadoHorario(horariosArr) === 'cerrado'; } catch(e){ return false; }
};
window._estadoEfectivoDe = function(manualOp, manualTs, horariosArr) {
  if (window._normEstadoOp) manualOp = window._normEstadoOp(manualOp);
  var porHorario = _calcEstadoHorario(horariosArr);
  // EL HORARIO CONFIGURADO MANDA: si el horario dice cerrado, cerrado gana sin importar el manual.
  if (porHorario === 'cerrado') return 'cerrado';
  // Si el usuario eligió cerrado manualmente con timestamp reciente, se respeta (cae a lógica manual abajo).
  var esManual = (manualOp==='activo'||manualOp==='ocupado'||manualOp==='pausado'||manualOp==='cerrado');
  if (esManual && manualTs) {
    var lim = _ultimoLimiteHorario(horariosArr);
    if (lim === null || manualTs >= lim) return manualOp; // manual vigente hasta el siguiente cambio de horario
    return (porHorario === null) ? manualOp : porHorario;  // el horario retomó el control
  }
  // Datos antiguos sin marca de tiempo: comportamiento previo
  if (manualOp==='ocupado'||manualOp==='pausado'||manualOp==='cerrado') return manualOp;
  return (porHorario === null) ? (manualOp || 'activo') : porHorario;
};
function _estadoEfectivo(horariosArr) {
  return window._estadoEfectivoDe(_rEstadoOp || 'activo', _rEstadoOpTs || 0, horariosArr);
}
window._estadoEfectivo = _estadoEfectivo; // expuesto globalmente
// PINTOR UNIVERSAL DE ESTADO: repinta el indicador del home con el estado EFECTIVO
window.dcPintarEstado = function(){
  try{
    var ef  = _estadoEfectivo();
    var cfg = DC_ESTADOS[ef] || DC_ESTADOS.activo;
    var dot  = document.getElementById('home-estado-dot');
    var lbl_ = document.getElementById('home-estado-lbl');
    if (dot)  dot.className = 'estado-dot ' + cfg.dotEl;
    if (lbl_) lbl_.textContent = cfg.lbl;
    // Sincronizar select de vr-config si está abierto y sin cambios pendientes
    var _vrc = document.getElementById('vr-config');
    if (_vrc && _vrc.classList.contains('active')) {
      var _valR = (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(HORARIOS)) ? 'cerrado' : 'activo';
      var _selR = document.getElementById('cfg-est-sel');
      if (_selR) _selR.value = _valR;
      if (typeof _syncEstadoCfgUI === 'function') _syncEstadoCfgUI(_valR);
    }
  }catch(e){}
};

var GRUPOS = {
  pedidos:    ['nuevo'],
  en_proceso: ['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','en_camino','recogido','ya_estoy_aqui'],
  entregados: ['entregado','rechazado','cancelado']
};

var PASOS = [
  {key:'nuevo',      lbl:'Recibido',     sub:'En espera de confirmación'},
  {key:'aceptado',   lbl:'Aceptado',     sub:'Confirmado por el restaurante'},
  {key:'preparando', lbl:'Preparando',   sub:'En cocina'},
  {key:'listo',      lbl:'Listo',        sub:'Listo para entregar'},
  {key:'en_camino',  lbl:'En camino',    sub:'Salió a entregar'},
  {key:'entregado',  lbl:'Entregado',    sub:'¡Completado!'},
];

var ACCIONES = {
  nuevo:      [{lbl:'✅ Aceptar pedido',                   est:'aceptado',   cls:'btn-red'   },
               {lbl:'❌ Rechazar pedido',                  est:'rechazado',  cls:'btn-ghost' }],
  aceptado:   [{lbl:'Marcar como en preparación',          est:'preparando', cls:'btn-yellow'}],
  preparando: [{lbl:'Marcar como listo para entregar',     est:'listo',      cls:'btn-yellow'}],
  listo:      [{lbl:'Marcar como salió a entregar',        est:'en_camino',  cls:'btn-green' }],
  en_camino:  [{lbl:'Marcar como entregado',               est:'entregado',  cls:'btn-green' }],
};

var ESTADO_LABELS = {
  nuevo:'Nuevo', aceptado:'Aceptado', preparando:'Preparando',
  listo:'Listo', buscando_repartidor:'Buscando rep.', repartidor_asignado:'Rep. asignado',
  en_camino:'En camino', recogido:'Recogido', ya_estoy_aqui:'Llegó',
  entregado:'Entregado', rechazado:'Rechazado', cancelado:'Cancelado'
};
function lbl(e){ return ESTADO_LABELS[e]||e; }

/* ═══════════════════════════════════════════════════════
   ESTADO LOCAL
═══════════════════════════════════════════════════════ */
var _rEstadoOp    = 'activo'; // Se carga desde Firebase en dcRest_init — nunca desde localStorage compartido
var _rEstadoOpTs  = 0;
var _rPedTab      = 'pedidos';
var _rMenuCat     = 'todos';
var _rPedActivo   = null;
var _rPfDisp      = true;
var _rPfFoto      = null; // null | base64 dataURL de fotografía real seleccionada
var _rPagos       = { efectivo:true, transf:true, tarjeta:false };
var _rBannerIdx   = 0;
var _rBannerTimer = null;
var _vnHoraTmp;
  var _rHoraTimer   = null;
var _nHoraTimer   = null; // timer auto-refresco estado negocio
var _vnegPagos = { efectivo:true, transf:true, tarjeta:false };
var _vnegNotif = { pedidos:true, cancel:true, cal:false, resumen:true };
var _vnegBanco = { banco:'', clabe:'', titular:'' };


/* ═══════════════════════════════════════════════════════
   NAVEGACIÓN AISLADA
   Regla: toda vista principal reinicia scroll + estado
   Solo vr-det-pedido conserva contexto de pedido activo
═══════════════════════════════════════════════════════ */
var _rNavStack = ['vr-home'];


/* ── NOTA INTEGRACIÓN v2.4 — navegación ─────────────────────
   RESUELTO en v2.4:
   • navTo() → dcRest_navTo() (scoped a #vr-shell, no afecta index)
   • navBack() → dcRest_navBack()
   • querySelector('.view.active') scoped a #vr-shell en todos los usos
   • Las aliases var navTo / var navBack permiten que los onclick del
     HTML sigan funcionando sin cambiar el HTML.

   PENDIENTE DE INTEGRACIÓN (en integración futura al index):
   • En _goCore agregar:
       if(id==='vr-home') setTimeout(()=>window.dcRest_init&&window.dcRest_init(),200);
   • dcRest_onViewEnter expuesto como window.dcRest_onViewEnter
     para llamarse desde _goCore en cada vista vr-*.
   • Mapa de IDs para referencia futura:
       vr-home       ← home del panel restaurante
       vr-pedidos    ← pedidos
       vr-det-pedido ← detalle de pedido
       vr-menu       ← gestión de menú
       vr-prod-form  ← formulario de producto (rf-pform-*)
       vr-promos     ← promociones
       vr-notif      ← notificaciones
       vr-config     ← configuración
   ──────────────────────────────────────────────────────────── */
/* ── dcRest_navTo: navegación interna del módulo Restaurante ──
   Scoped a #vr-shell para no interferir con .view.active del index.
   En modo aislado: opera sobre el shell propio.
   En modo integrado (futuro): window.go() existirá → usar go() en integración.
   ──────────────────────────────────────────────────────────── */
function dcRest_navTo(id, isBack) {
  // Scope a #vr-shell — nunca toca vistas de otros módulos del index
  var shell = document.getElementById('vr-shell');
  var cur = shell
    ? shell.querySelector('.view.active')
    : document.querySelector('#vr-shell .view.active');
  var nxt = document.getElementById(id);
  if (!cur || !nxt || cur === nxt) return;

  // REGLA: avisar antes de salir con cambios sin guardar (Configuración / Cómo me ve el cliente)
  if (window._dirtyView && cur.id === window._dirtyView) {
    var _seguir = window.confirm('\u26A0\uFE0F Tienes cambios sin guardar.\n\nPresiona CANCELAR para quedarte y guardarlos,\no ACEPTAR para salir sin guardar.');
    if (!_seguir) return;
    window._dirtyView = null;
    // DESCARTAR DE VERDAD: nada se guardó; restaurar la pantalla a lo último guardado
    if (cur.id === 'vr-config') {
      window._cfgEstadoPend = null;
      try {
        if (window._cfgSnapHor) { HORARIOS = JSON.parse(window._cfgSnapHor); }
        var _selR = document.getElementById('cfg-est-sel');
        var _efR = _estadoEfectivo();
        if (_selR) _selR.value = _efR;
        _syncEstadoCfgUI(_efR);
        _renderHorarios();
      } catch(e){}
    }
  }

  // RESET SCROLL — siempre al inicio en la vista destino
  _resetScroll(id);

  // RESET TABS Y FILTROS — siempre al entrar a cada vista
  if (id === 'vr-ventas') { window._vrvMesOffset = 0; window._vrvTopModo = 'dinero'; window._vrvCalc && window._vrvCalc(); }
  if (id === 'vr-pedidos') {
    _rPedTab = 'pedidos';
    _syncTabUI();
    window._marcarPedidosLeidos && window._marcarPedidosLeidos();
  }
  if (id === 'vr-menu') {
    _rMenuCat = 'todos';
    _rMenuBusq = '';
    // Limpiar el input de búsqueda si está visible
    var si = document.getElementById('menu-search-inp');
    if (si) si.value = '';
    var sc = document.getElementById('menu-search-clear');
    if (sc) sc.style.display = 'none';
  }

  if (isBack) {
    // Animación hacia atrás
    cur.classList.add('anim-out');
    cur.style.transform  = 'translateX(100%)';
    cur.style.opacity    = '0';
    nxt.style.transform  = 'translateX(-30%)';
    nxt.style.opacity    = '0.4';
    nxt.classList.add('active');
    requestAnimationFrame(function(){
      nxt.classList.add('anim-in');
      nxt.style.transform = 'translateX(0)';
      nxt.style.opacity   = '1';
    });
    setTimeout(function(){
      cur.classList.remove('active','anim-out');
      cur.style.cssText = '';
      nxt.classList.remove('anim-in');
      nxt.style.cssText = '';
    }, 320);
  } else {
    // Animación hacia adelante
    nxt.style.transform = 'translateX(100%)';
    nxt.style.opacity   = '0';
    nxt.classList.add('active');
    cur.classList.add('anim-out');
    requestAnimationFrame(function(){
      nxt.classList.add('anim-in');
      nxt.style.transform = 'translateX(0)';
      nxt.style.opacity   = '1';
      cur.style.transform  = 'translateX(-30%)';
      cur.style.opacity    = '0';
    });
    setTimeout(function(){
      cur.classList.remove('active','anim-out');
      cur.style.cssText = '';
      nxt.classList.remove('anim-in');
      nxt.style.cssText = '';
    }, 320);
  }

  if (!isBack) _rNavStack.push(id);
  window.dcRest_onViewEnter(id);
}
// Alias público: HTML onclicks usan navTo() — se mantiene para compatibilidad
var navTo = dcRest_navTo;
window.dcRest_navTo = dcRest_navTo;
window.dcRestGoHomeFromMenu = function(){ _rNavStack = ['vr-home','vr-menu']; dcRest_navBack(); };
window.dcRestBackMenuFromProd = function(){ _rNavStack = ['vr-home','vr-menu','vr-prod-form']; dcRest_navBack(); };
window.dcRestGoMenuAfterSave = function(){ _rNavStack = ['vr-home','vr-menu','vr-prod-form']; dcRest_navBack(); setTimeout(function(){ window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-menu'); },160); };

// ══════ NAVEGACIÓN DEL CENTRO OPERATIVO DEL NEGOCIO (vn-shell) ══════
var _nNavStack = ['vn-home'];
function dcNeg_navTo(id, isBack) {
  var shell = document.getElementById('vn-shell');
  var cur = shell ? shell.querySelector('.view.active') : null;
  var nxt = document.getElementById(id);
  if (!cur || !nxt || cur === nxt) return;
  // REGLA #4: avisar antes de salir con cambios sin guardar
  if (window._dirtyView && cur.id === window._dirtyView) {
    var _seguir = window.confirm('\u26A0\uFE0F Tienes cambios sin guardar.\n\nPresiona CANCELAR para quedarte y guardarlos,\no ACEPTAR para salir y descartarlos.');
    if (!_seguir) return;
    window._dirtyView = null;
    // DESCARTAR DE VERDAD: recargar el estado/horarios guardados
    if (cur.id === 'vn-config') { try { window.vnegCargarConfig && window.vnegCargarConfig(); } catch(e){} }
    if (cur.id === 'vn-cmv') { try { window.vnegCmvCargar && window.vnegCmvCargar(); } catch(e){} }
    if (cur.id === 'vn-prod-form') { try { _vnegFotoB64=null; var fi=document.getElementById('vn-pf-file-input'); if(fi) fi.value=''; } catch(e){} }
  }
  // Reset scroll en destino
  try { nxt.scrollTop = 0; var sc = nxt.querySelector('.scr'); if (sc) sc.scrollTop = 0; } catch(e){}
  if (!isBack) _nNavStack.push(id);
  // Hooks de entrada dentro del shell N — equivale a lo que hace _goCore para estas vistas
  if (id === 'vn-config') setTimeout(function(){ window.vnegCargarConfig && window.vnegCargarConfig(); }, 80);
  if (id === 'vn-cmv')    setTimeout(function(){ window.vnegCmvCargar && window.vnegCmvCargar(); window._updateHora && window._updateHora(); }, 80);
  if (id === 'vn-home')   setTimeout(function(){
    window.vnegCargarConfig && window.vnegCargarConfig();
    window._updateHora && window._updateHora();
    // Arrancar timer de auto-refresco de estado para negocio (30s, igual que restaurante)
    if (_nHoraTimer) clearInterval(_nHoraTimer);
    _nHoraTimer = setInterval(function(){ if (window._updateHora) window._updateHora(); }, 30000);
  }, 80);
  if (isBack) {
    cur.classList.add('anim-out'); cur.style.transform='translateX(100%)'; cur.style.opacity='0';
    nxt.style.transform='translateX(-30%)'; nxt.style.opacity='0.4'; nxt.classList.add('active');
    requestAnimationFrame(function(){ nxt.classList.add('anim-in'); nxt.style.transform='translateX(0)'; nxt.style.opacity='1'; });
    setTimeout(function(){ cur.classList.remove('active','anim-out'); cur.style.cssText=''; nxt.classList.remove('anim-in'); nxt.style.cssText=''; }, 320);
  } else {
    nxt.style.transform='translateX(100%)'; nxt.style.opacity='0'; nxt.classList.add('active');
    requestAnimationFrame(function(){ nxt.classList.add('anim-in'); nxt.style.transform='translateX(0)'; nxt.style.opacity='1'; });
    setTimeout(function(){ cur.classList.remove('active'); cur.style.cssText=''; nxt.classList.remove('anim-in'); nxt.style.cssText=''; }, 320);
  }
}
function dcNeg_navBack() {
  if (_nNavStack.length <= 1) { dcNeg_navTo('vn-home', true); _nNavStack = ['vn-home']; return; }
  _nNavStack.pop();
  var prev = _nNavStack[_nNavStack.length - 1] || 'vn-home';
  dcNeg_navTo(prev, true);
}
var negTo = function(id, isBack){ if(isBack) return dcNeg_navBack(); return dcNeg_navTo(id); };
window.dcNeg_navTo = dcNeg_navTo;
window.negTo = negTo;
window.vnegGoHomeFromMenu = function(){ _nNavStack = ['vn-home','vn-menu']; dcNeg_navBack(); };
window.vnegBackMenuFromProd = function(){ _nNavStack = ['vn-home','vn-menu','vn-prod-form']; dcNeg_navBack(); };
window.vnegGoMenuAfterSave = function(){ _nNavStack = ['vn-home','vn-menu','vn-prod-form']; dcNeg_navBack(); setTimeout(function(){ window.vnegCargarMenu&&window.vnegCargarMenu(); },160); };

// UNA sola indicación para repintar el estado del negocio en todos lados (home, chips, vn-home).
// El motor aplica el horario: cuando llega la hora de apertura, abre solo (Activo).
window._vnegRepintarEstado = function(){
  try {
    // Chip header + tarjeta estado del home principal
    if (window.dcPintarEstado) window.dcPintarEstado();
    // Badge del Centro Operativo (vn-home)
    if (window._vnegSyncHomeBadge) window._vnegSyncHomeBadge();
    // Repintar la tarjeta de estado del v-home del negocio (igual que el restaurante con dcPintarEstado)
    var _t = (localStorage.getItem('dcuserTipo')||'').toLowerCase();
    var _vh = document.getElementById('v-home');
    if (_t === 'negocio' && _vh && _vh.classList.contains('active')) {
      var _manual = window._normEstadoOp ? window._normEstadoOp(_vnegEstadoOp) : _vnegEstadoOp;
      var _ef = window._estadoEfectivoDe ? window._estadoEfectivoDe(_manual, _vnegEstadoOpTs || 0, VNEG_HORARIOS) : _manual;
      var _cfg = DC_ESTADOS[_ef] || DC_ESTADOS.activo;
      // Tarjeta de estado (el recuadro grande del home)
      var _card = document.querySelector('#v-home [onclick*="vn-config"]');
      if (_card) {
        var _txt = _card.querySelector('div[style*="font-weight:700"]');
        if (_txt) _txt.textContent = _cfg.ic + ' ' + _cfg.lbl;
      }
      // Chip del header (home-estado-op) ya lo cubre dcPintarEstado/getEstadoEfectivoActual
    }
    // Si el config está abierto Y el usuario NO tiene cambios sin guardar, refrescar badge
    var vc = document.getElementById('vn-config');
    if (vc && vc.classList.contains('active')) {
      var _forzaCerradoN = window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS);
      var ef = _forzaCerradoN ? 'cerrado' : 'activo';
      var sel = document.getElementById('vneg-est-sel');
      if (sel) sel.value = ef;
      if (window.vnegSyncCfgUI) window.vnegSyncCfgUI(ef);
    }
  } catch(e){}
};

// Estado operativo efectivo del usuario actual, aplicando el horario correcto según su tipo
window.getEstadoEfectivoActual = function() {
  var tipo = (localStorage.getItem('dcuserTipo')||'').toLowerCase();
  var manual, horarios, ts;
  if (tipo === 'negocio' && typeof _vnegEstadoOp !== 'undefined') {
    // Negocio: usar _vnegEstadoOp y su timestamp real — no Date.now()
    manual = window._normEstadoOp ? window._normEstadoOp(_vnegEstadoOp) : _vnegEstadoOp;
    horarios = (typeof VNEG_HORARIOS !== 'undefined') ? VNEG_HORARIOS : undefined;
    ts = (typeof _vnegEstadoOpTs !== 'undefined') ? _vnegEstadoOpTs : 0;
  } else {
    manual = window.getEstadoOperativo ? window.getEstadoOperativo() : 'activo';
    if (window._normEstadoOp) manual = window._normEstadoOp(manual);
    horarios = undefined; // restaurante usa HORARIOS global via _calcEstadoHorario
    ts = (typeof _rEstadoOpTs !== 'undefined') ? _rEstadoOpTs : 0;
  }
  if (window._estadoEfectivoDe) { try { return window._estadoEfectivoDe(manual, ts, horarios); } catch(e){} }
  return manual;
};

// Cargar horarios del negocio desde Firebase y repintar el estado del home
window._vnegCargarHorariosYRepintar = async function() {
  try {
    var user = window._fbAuth && window._fbAuth.currentUser; var _db = window._fbDb;
    if (!user || !_db) return;
    var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var ds = await _fb.getDoc(_fb.doc(_db,'usuarios',user.uid));
    if (ds.exists()) {
      var d = ds.data();
      // Actualizar variables del módulo — NO llamar renderHomeM2 aquí
      // para no sobreescribir el render correcto que ya hizo renderHomeM2
      if (d.horarios && d.horarios.length) VNEG_HORARIOS = d.horarios;
      if (d.estadoOp) {
        _vnegEstadoOp = window._normEstadoOp ? window._normEstadoOp(d.estadoOp) : d.estadoOp;
        try { localStorage.setItem('dcRestOpV2', _vnegEstadoOp); } catch(e){}
      }
      // Siempre sincronizar el timestamp — incluso si no hay estadoOp (usuario nuevo)
      _vnegEstadoOpTs = d.estadoOpTs || 0;
    }
    // Sincronizar badge del Centro Operativo
    _vnegSyncHomeBadge();
    // Repintar chip del header (home-estado-dot/lbl) — mismo patrón que restaurante
    if (window.dcPintarEstado) window.dcPintarEstado();
    // Repintar tarjeta del v-home si está activo
    var _vh = document.getElementById('v-home');
    if (_vh && _vh.classList.contains('active')) {
      if (window.renderHomeM2) window.renderHomeM2();
    }
  } catch(e) { }
};

// Cargar horarios del restaurante desde Firebase y repintar el estado del home
// Mismo patrón que _vnegCargarHorariosYRepintar — corrige bug de estado incorrecto en v-home
window._restCargarHorariosYRepintar = async function() {
  try {
    var user = window._fbAuth && window._fbAuth.currentUser; var _db = window._fbDb;
    if (!user || !_db) return;
    var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var ds = await _fb.getDoc(_fb.doc(_db,'usuarios',user.uid));
    if (ds.exists()) {
      var d = ds.data();
      // Actualizar el array HORARIOS global con los del restaurante en Firebase
      if (d.horarios && d.horarios.length) {
        // Reemplazar completo para eliminar días sobrantes de sesión anterior
        d.horarios.forEach(function(dh) {
          var local = HORARIOS.find(function(h){ return h.id === dh.id; });
          if (local) { local.abre = dh.abre; local.cierra = dh.cierra; local.abierto = dh.abierto; }
          else { HORARIOS.push({id:dh.id, dia:dh.dia, abre:dh.abre, cierra:dh.cierra, abierto:dh.abierto}); }
        });
        // Eliminar días que existen en memoria pero no en Firebase (sobrantes del usuario anterior)
        for (var _hi = HORARIOS.length - 1; _hi >= 0; _hi--) {
          if (!d.horarios.find(function(dh){ return dh.id === HORARIOS[_hi].id; })) {
            HORARIOS.splice(_hi, 1);
          }
        }
      }
      // Sincronizar estado operativo
      if (d.estadoOp) {
        _rEstadoOp = window._normEstadoOp ? window._normEstadoOp(d.estadoOp) : d.estadoOp;
        try { localStorage.setItem('dcRestOpV2', _rEstadoOp); } catch(e) {}
      }
      if (d.estadoOpTs) { _rEstadoOpTs = d.estadoOpTs; try { localStorage.setItem('dcRestOpV2Ts', String(d.estadoOpTs)); var _uR=user.uid; if(_uR) localStorage.setItem('dcuserEstadoOpTs_'+_uR, String(d.estadoOpTs)); } catch(e) {} }
    }
    // Repintar el v-home completo con el estado correcto recién cargado de Firebase
    var _vh = document.getElementById('v-home');
    if (_vh && _vh.classList.contains('active')) {
      if (window.renderHomeM2) window.renderHomeM2();
    }
    if (window.dcPintarEstado) window.dcPintarEstado();
  } catch(e) { }
};

// FINAL FELIZ del negocio (mismo que restaurante, IDs propios)
var _vnegOvT1, _vnegOvT2;
window._vnegShowOverlay = function(cfg) {
  cfg = cfg || {};
  var ov = document.getElementById('vneg-overlay');
  var box = document.getElementById('vneg-overlay-box');
  var body = document.getElementById('vneg-overlay-body');
  if (!ov || !box || !body) { if (cfg.onDone) cfg.onDone(); return; }
  clearTimeout(_vnegOvT1); clearTimeout(_vnegOvT2);
  var logo = (typeof _SVG_LOGO !== 'undefined') ? _SVG_LOGO : '';
  box.className = 'ro-box phase-send';
  body.innerHTML = '<div class="ro-logo-wrap">' + logo + '</div>'
    + '<div class="ro-title">' + (cfg.f1tit || 'Guardando cambios...') + '</div>'
    + '<div class="ro-sub">' + (cfg.f1sub || 'Actualizando tu negocio.') + '</div>';
  ov.classList.add('visible');
  _vnegOvT1 = setTimeout(function() {
    box.className = 'ro-box phase-ok';
    body.innerHTML = '<div class="ro-check">✅</div>'
      + '<div class="ro-title">' + (cfg.f2tit || 'Listo') + '</div>'
      + '<div class="ro-sub">' + (cfg.f2sub || 'Cambios guardados.') + '</div>';
    _vnegOvT2 = setTimeout(function() {
      ov.classList.remove('visible');
      if (cfg.onDone) cfg.onDone();
    }, 1600);
  }, 1400);
};

// Ir al Centro Operativo del negocio en una pestaña de pedidos específica
window._irPedidosNegTab = function(tab){
  go('vn-home','right');
  setTimeout(function(){
    if (window.dcNeg_navTo) window.dcNeg_navTo('vn-pedidos');
    setTimeout(function(){ if(window.vnegTabPedidos){var b=document.getElementById('vntab-'+tab);window.vnegTabPedidos(tab,b);} }, 120);
  }, 80);
};

// Calcular métricas del home del negocio (Por aceptar / Pedidos hoy / En proceso)
window._calcMetricasNeg = async function(){
  var user = window._fbAuth && window._fbAuth.currentUser; var _db = window._fbDb;
  if (!user || !_db) return;
  var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
  var ledSet = function(cardId,on){ var c=document.getElementById(cardId); if(c) c.classList.toggle('led-on', !!on); };
  try {
    var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',user.uid)));
    var GP_NUEVO=['nuevo'], GP_PROC=['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','en_camino','recogido'];
    var nAcep=0,nProc=0,nHoy=0, ventaHoy=0, nSem=0, ventaSem=0;
    var hoy0=new Date(); hoy0.setHours(0,0,0,0); var t0=hoy0.getTime();
    var sem0=new Date(); sem0.setHours(0,0,0,0); sem0.setDate(sem0.getDate()-6); var ts0=sem0.getTime();
    snap.forEach(function(d){ var p=d.data(); var e=p.estado||''; var f=p.fecha||0; var tot=p.total||0;
      if(GP_NUEVO.indexOf(e)!==-1)nAcep++; else if(GP_PROC.indexOf(e)!==-1)nProc++;
      if(e==='entregado'&&f>=t0){nHoy++; ventaHoy+=tot;}
      if(e==='entregado'&&f>=ts0){nSem++; ventaSem+=tot;}
    });
    setTxt('vnhome-poraceptar',nAcep); setTxt('vnhome-pedidos',nHoy); setTxt('vnhome-enproceso',nProc);
    setTxt('vnj-pedidos',nHoy); setTxt('vnj-ventas','$'+ventaHoy);
    setTxt('vn-semana-resumen', nSem + ' pedidos · $' + ventaSem + ' · 4.8★');
    ledSet('vncard-poraceptar',nAcep>0); ledSet('vncard-pedidoshoy',nHoy>0); ledSet('vncard-enproceso',nProc>0);
    // Banner de urgencia (igual que restaurante): X pedidos nuevos
    var wrap = document.getElementById('vn-urgencia-wrap');
    if (wrap) {
      if (nAcep > 0) {
        wrap.innerHTML = '<div onclick="window._irPedidosNegTab&&window._irPedidosNegTab(\'pedidos\')" style="cursor:pointer;background:linear-gradient(135deg,#5B2C8A,#7B3FA0);border-radius:16px;padding:16px 18px;color:#fff;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
          + '<div style="display:flex;align-items:center;gap:12px;"><span style="font-size:26px;">\ud83d\udce6</span><div><div style="font-size:15px;font-weight:800;">'+nAcep+(nAcep===1?' pedido nuevo':' pedidos nuevos')+'</div><div style="font-size:11px;opacity:.85;">Toca para atender</div></div></div>'
          + '<span style="font-size:20px;">\u203a</span></div>';
      } else { wrap.innerHTML = ''; }
    }
  } catch(e) { }
};

// ══════ FUNCIONES DE PANTALLAS DEL NEGOCIO (IDs vn- propios, datos por uid) ══════
var _vnegPedTab = 'pedidos';
window.vnegTabPedidos = function(tab, btn){
  _vnegPedTab = tab;
  document.querySelectorAll('#vn-pedidos .chip').forEach(function(b){ b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  window.vnegRenderPedidos();
};
window.vnegRenderPedidos = async function(){
  var cont = document.getElementById('vn-ped-cont'); if(!cont) return;
  var user = window._fbAuth && window._fbAuth.currentUser; var _db = window._fbDb;
  if(!user||!_db){cont.innerHTML='';return;}
  cont.innerHTML='<div style="text-align:center;color:#aaa;padding:30px;font-size:12px;">Cargando…</div>';
  try{
    var _fb=await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap=await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'),_fb.where('restauranteId','==',user.uid)));
    var G={pedidos:['nuevo'],en_proceso:['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','en_camino','recogido'],entregados:['entregado']};
    var perm=G[_vnegPedTab]||[]; var arr=[];
    snap.forEach(function(d){var p=d.data();p._id=d.id;if(perm.indexOf(p.estado)!==-1)arr.push(p);});
    arr.sort(function(a,b){return (b.fecha||0)-(a.fecha||0);});
    if(!arr.length){cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Sin pedidos en esta categoría.</div>';return;}
    cont.innerHTML=arr.map(function(p){
      var items=(p.items||[]).map(function(it){return _resc(it.cantidad)+'x '+_resc(it.nombre);}).join(', ');
      return '<div style="background:#fff;border-radius:12px;padding:14px;margin:0 14px 10px;box-shadow:0 1px 3px rgba(0,0,0,.06);"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-weight:800;font-size:13px;">'+_resc(p.vecinoNombre||'Cliente')+'</span><span style="font-weight:800;color:#7B3FA0;">$'+_resc(p.total||0)+'</span></div><div style="font-size:12px;color:#666;">'+items+'</div></div>';
    }).join('');
  }catch(e){cont.innerHTML='<div style="text-align:center;color:#c00;padding:30px;font-size:12px;">Error.</div>';}
};

window.vnegCrearCategoria = function(){
  window._dcPedirTexto('Nueva categoría', 'Nombre de la categoría', function(nombre){
    var user=window._fbAuth&&window._fbAuth.currentUser; var _db=window._fbDb;
    if(!user||!_db){_vnegToast('⚠️ Sin sesión');return;}
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(_fb){
      return window.vnegResolverMenuUid(false).then(function(uid){
        return _fb.addDoc(_fb.collection(_db,'menu',uid||user.uid,'productos'),{
          nombre:'(Categoría interna)', categoria:nombre, descripcion:'', precio:0,
          disponible:false, foto:null, _esPlaceholder:true, creado:Date.now(), actualizado:Date.now(), orden:9999
        });
      });
    }).then(function(){
      window._vnegMenuCat = nombre;
      _vnegToast('✅ Categoría creada');
      window.vnegCargarMenu&&window.vnegCargarMenu();
    }).catch(function(e){ _vnegToast('⚠️ Error: '+e.message); });
  });
};

var _vnegEditPid=null;
var _vnegFotoB64=null;
var _vnegPfDisp=true;

function _vnegToast(msg){ toast(msg); }
function _vnegSetVal(id,v){ var el=document.getElementById(id); if(el) el.value=(v!==undefined&&v!==null)?String(v):''; }
function _vnegGetVal(id){ var el=document.getElementById(id); return el?String(el.value||'').trim():''; }

function _vnegMarcarProdSucio(){ window._dirtyView = 'vn-prod-form'; }
function _vnegBindProdDirty(){
  ['vn-pf-nombre','vn-pf-cat','vn-pf-desc','vn-pf-precio'].forEach(function(id){
    var el=document.getElementById(id);
    if(el && !el._vnegDirtyBound){
      el.addEventListener('input', _vnegMarcarProdSucio);
      el.addEventListener('change', _vnegMarcarProdSucio);
      el._vnegDirtyBound = true;
    }
  });
}

function _vnegRenderFotoUI(){
  var wrap=document.getElementById('vn-pf-foto-wrap');
  if(!wrap) return;
  if(_vnegFotoB64){
    wrap.innerHTML = ''
      + '<div style="width:100%;height:170px;border-radius:16px;overflow:hidden;position:relative;border:.5px solid var(--border);margin-bottom:6px;background:#f5f5f5;">'
      + '<img src="'+_vnegFotoB64+'" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Foto del producto">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);padding:7px;display:flex;gap:6px;justify-content:center;">'
      + '<button type="button" onclick="vnegTapFoto()" style="flex:1;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">📷 Cambiar</button>'
      + '<button type="button" onclick="vnegEliminarFoto()" style="flex:1;background:rgba(214,58,42,.45);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">🗑 Eliminar</button>'
      + '</div></div>';
  } else {
    wrap.innerHTML = '<div class="prod-img-ph" onclick="vnegTapFoto()">📷<span>Toca para agregar foto</span></div>';
  }
}

function _vnegPoblarCategorias(sel, actual){
  if(!sel) return;
  var cats=[];
  try{
    var menu = (typeof window._vnegMenuCache !== 'undefined' && Array.isArray(window._vnegMenuCache)) ? window._vnegMenuCache : [];
    menu.forEach(function(p){ var c=(p&&p.categoria)?String(p.categoria).trim():''; if(c && cats.indexOf(c)===-1) cats.push(c); });
  }catch(e){}
  if(cats.indexOf('General')===-1) cats.unshift('General');
  sel.innerHTML = '<option value="">— Selecciona categoría —</option>'
    + cats.map(function(c){ return '<option value="'+c.replace(/"/g,'&quot;')+'">'+c+'</option>'; }).join('')
    + '<option value="__nueva__" style="color:var(--green);font-weight:700;">＋ Agregar nueva categoría</option>';
  sel.onchange=function(){
    if(sel.value==='__nueva__'){
      sel.value=actual||'General';
      window._dcPedirTexto('Nueva categoría', 'Nombre de la categoría', function(nueva){
        var opt=document.createElement('option'); opt.value=nueva; opt.textContent=nueva;
        sel.insertBefore(opt, sel.lastChild); sel.value=nueva; _vnegMarcarProdSucio();
      });
    }
  };
  sel.value = actual || 'General';
}

window.vnegEliminarProd = function(){
  if(!_vnegEditPid){window._dirtyView=null;negTo('vn-menu',true);return;}
  window._dcConfirmar('¿Eliminar este producto?', function(){
    window._dirtyView=null;
    var user=window._fbAuth.currentUser; var _db=window._fbDb;
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(_fb){
      return window.vnegResolverMenuUid(true).then(function(uid){
        return _fb.deleteDoc(_fb.doc(_db,'menu',uid||user.uid,'productos',_vnegEditPid));
      });
    }).then(function(){ negTo('vn-menu',true); setTimeout(window.vnegCargarMenu,200); })
      .catch(function(e){ toast('⚠️ Error: '+e.message); });
  });
};
window.vnegTogglePfDisp = function(){ _vnegPfDisp=!_vnegPfDisp; var t=document.getElementById('vn-pf-toggle'); if(t)t.className='toggle'+(_vnegPfDisp?' on':''); _vnegMarcarProdSucio(); };
window.vnegTapFoto = function(){ var i=document.getElementById('vn-pf-file-input'); if(i){ i.value=''; i.click(); } };
window.vnegFotoSeleccionada = function(input){
  var file=input&&input.files&&input.files[0];
  if(!file)return;
  if(!file.type.match(/^image\//)){_vnegToast('⚠️ Solo se aceptan imágenes');return;}
  if(file.size>5*1024*1024){_vnegToast('⚠️ Imagen demasiado grande (máx 5 MB)');return;}
  var r=new FileReader();
  r.onload=function(e){ _vnegFotoB64=e.target.result; _vnegRenderFotoUI(); _vnegBindProdDirty(); _vnegMarcarProdSucio(); _vnegToast('📷 Foto cargada'); };
  r.onerror=function(){ _vnegToast('⚠️ Error al leer la imagen'); };
  r.readAsDataURL(file);
};
window.vnegEliminarFoto=function(){ _vnegFotoB64=null; var i=document.getElementById('vn-pf-file-input'); if(i)i.value=''; _vnegRenderFotoUI(); _vnegBindProdDirty(); _vnegMarcarProdSucio(); };


// VENTAS negocio
window._vnvMesOffset=0;
window._vnvMesCambiar=function(dir){var n=window._vnvMesOffset+dir;if(n>0)n=0;window._vnvMesOffset=n;window._vnvCalc&&window._vnvCalc();};
window._vnvTopTab=function(){};
window._vnvCalc=async function(){
  var user=window._fbAuth&&window._fbAuth.currentUser;var _db=window._fbDb;if(!user||!_db)return;
  var uid=user.uid;var setTxt=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  var M=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var hoy=new Date();var ref=new Date(hoy.getFullYear(),hoy.getMonth()+window._vnvMesOffset,1);
  var ini=ref.getTime();var fin=new Date(ref.getFullYear(),ref.getMonth()+1,1).getTime();
  setTxt('vn-vrv-mes-label',M[ref.getMonth()]+' '+ref.getFullYear());
  setTxt('vn-ventas-mes-label',M[ref.getMonth()]+' '+ref.getFullYear());
  try{var _fb=await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap=await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'),_fb.where('restauranteId','==',uid)));
    var nPed=0,venta=0,acum=0;
    snap.forEach(function(d){var p=d.data();if(p.estado!=='entregado')return;acum+=(p.total||0);var f=p.fecha||0;if(f>=ini&&f<fin){nPed++;venta+=(p.total||0);}});
    setTxt('vn-vrv-pedidos',nPed);setTxt('vn-vrv-ventas','$'+venta);setTxt('vn-vrv-acumulado','$'+acum);
    var vs=await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'),_fb.where('restauranteId','==',uid)));
    var tr=0,cr=0;vs.forEach(function(d){var v=d.data();if(v.ratingRestaurante){tr+=v.ratingRestaurante;cr++;}});
    setTxt('vn-vrv-rating',cr>0?(tr/cr).toFixed(1)+'\u2605':'—');
  } catch(e) { }
};

// ══════ ESTADO Y HORARIOS DEL NEGOCIO (vneg) ══════
var VNEG_HORARIOS = [
  {id:'lun', dia:'Lunes',    abre:'08:00', cierra:'22:00', abierto:true },
  {id:'mar', dia:'Martes',   abre:'08:00', cierra:'22:00', abierto:true },
  {id:'mie', dia:'Mi\u00e9rcoles',abre:'08:00', cierra:'22:00', abierto:true },
  {id:'jue', dia:'Jueves',   abre:'08:00', cierra:'22:00', abierto:true },
  {id:'vie', dia:'Viernes',  abre:'08:00', cierra:'22:00', abierto:true },
  {id:'sab', dia:'S\u00e1bado',   abre:'09:00', cierra:'22:00', abierto:true },
  {id:'dom', dia:'Domingo',  abre:'10:00', cierra:'20:00', abierto:false}
];
var _vnegEstadoOp = 'activo';
var _vnegEstadoOpTs = 0;
var _vnegMeta = {
  activo:  {ic:'\ud83d\udfe2', t:'Activo',  d:'Recibiendo pedidos',          c:'var(--green)'},
  ocupado: {ic:'\ud83d\udfe1', t:'Ocupado', d:'Respuesta m\u00e1s lenta',        c:'#d97706'},
  pausado: {ic:'\ud83d\udfe0', t:'En pausa',d:'Sin nuevos pedidos por ahora', c:'#E87722'},
  cerrado: {ic:'\ud83d\udd34', t:'Cerrado', d:'No disponible hoy',            c:'#D63A2A'}
};

// Estado efectivo del negocio (manual + horario), reusa el motor global
function _vnegEstadoEfectivo() {
  return window._estadoEfectivoDe
    ? window._estadoEfectivoDe(_vnegEstadoOp, _vnegEstadoOpTs, VNEG_HORARIOS)
    : _vnegEstadoOp;
}

// Preview en el selector de config
function vnegSyncCfgUI(val) {
  var m = _vnegMeta[val] || _vnegMeta.activo;
  var tit = document.getElementById('vneg-est-tit');
  var desc = document.getElementById('vneg-est-desc');
  var dot = document.getElementById('vneg-est-dot');
  if (tit) tit.textContent = m.ic + ' ' + m.t;
  if (desc) { desc.textContent = m.d; desc.style.color = m.c; }
  if (dot) dot.style.background = m.c;
}
function vnegPreviewEstado(val) {
  // Si el horario predeterminado fuerza cerrado, bloquear cambio y mostrar aviso
  if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS)) {
    // Resetear el select al valor actual
    var _sel = document.getElementById('vneg-est-sel');
    if (_sel) _sel.value = 'cerrado';
    // Limpiar dirty para que el timer pueda sincronizar el select al abrir
    window._dirtyView = null;
    // Mostrar popup de aviso fuera de horario
    var _ovId = 'dcFueraHorarioOv';
    if (!document.getElementById(_ovId)) {
      var _ov = document.createElement('div');
      _ov.id = _ovId;
      _ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
      _ov.innerHTML = '<div style="background:#fff;border-radius:22px;padding:28px 24px;max-width:300px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.3);">'
        + '<div style="font-size:40px;margin-bottom:12px;">🕐</div>'
        + '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">Fuera de horario laboral</div>'
        + '<div style="font-size:13px;color:#666;line-height:1.5;margin-bottom:22px;">Actualmente estás fuera de tu horario laboral.<br>No se pueden cambiar estados.</div>'
        + '<button onclick="var e=document.getElementById(\'dcFueraHorarioOv\');if(e)e.remove();" style="width:100%;padding:13px;background:#7B3FA0;color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Aceptar</button>'
        + '</div>';
      document.body.appendChild(_ov);
    }
    return;
  }
  window._dirtyView = 'vn-config';
  window._vnegEstadoPendTocado = true;
  vnegSyncCfgUI(val);
  if (window.toast) toast('Estado: ' + (_vnegMeta[val]? _vnegMeta[val].ic+' '+_vnegMeta[val].t : val));
}
window.vnegPreviewEstado = vnegPreviewEstado;

// Pintar el badge de estado en el vn-home
function _vnegSyncHomeBadge() {
  // Usar _vnegEstadoOp y su timestamp real — no Date.now()
  var manual = window._normEstadoOp ? window._normEstadoOp(_vnegEstadoOp) : _vnegEstadoOp;
  var ef = window._estadoEfectivoDe ? window._estadoEfectivoDe(manual, _vnegEstadoOpTs || 0, VNEG_HORARIOS) : manual;
  // Fix 3 N: si el horario fuerza cerrado, siempre mostrar cerrado en el badge
  if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS)) ef = 'cerrado';
  var m = _vnegMeta[ef] || _vnegMeta.activo;
  var dot = document.getElementById('vn-estado-dot');
  var lbl = document.getElementById('vn-estado-lbl');
  if (dot) dot.style.background = m.c;
  if (lbl) lbl.textContent = m.t.toUpperCase();
}
window._vnegSyncHomeBadge = _vnegSyncHomeBadge;

// Render de horarios (editable)
function vnegRenderHorarios() {
  var cont = document.getElementById('vneg-horarios');
  if (!cont) return;
  cont.innerHTML = VNEG_HORARIOS.map(function(h, idx){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:.5px solid var(--border);">'
      + '<div class="toggle' + (h.abierto?' on':'') + '" onclick="vnegToggleDia(' + idx + ')" style="flex-shrink:0;"></div>'
      + '<div style="flex:1;font-size:12px;font-weight:600;color:var(--tx);">' + h.dia + '</div>'
      + (h.abierto
          ? '<select class="inp-sel" style="width:auto;padding:4px 6px;font-size:11px;" onchange="vnegSetHora(' + idx + ',\'abre\',this.value)">' + _vnegHorasOpts(h.abre) + '</select>'
            + '<span style="font-size:11px;color:var(--tx4);">a</span>'
            + '<select class="inp-sel" style="width:auto;padding:4px 6px;font-size:11px;" onchange="vnegSetHora(' + idx + ',\'cierra\',this.value)">' + _vnegHorasOpts(h.cierra) + '</select>'
          : '<span style="font-size:11px;color:var(--tx4);font-style:italic;">Cerrado</span>')
      + '</div>';
  }).join('');
}
window.vnegRenderHorarios = vnegRenderHorarios;
function _vnegHorasOpts(sel) {
  var opts = '';
  for (var h=6; h<=24; h++) {
    ['00','30'].forEach(function(m){
      if (h===24 && m==='30') return;
      var v = String(h).padStart(2,'0') + ':' + m;
      opts += '<option value="' + v + '"' + (v===sel?' selected':'') + '>' + v + '</option>';
    });
  }
  return opts;
}
function vnegToggleDia(idx){ VNEG_HORARIOS[idx].abierto = !VNEG_HORARIOS[idx].abierto; vnegRenderHorarios(); window._dirtyView='vn-config'; }
function vnegSetHora(idx,campo,val){ VNEG_HORARIOS[idx][campo]=val; window._dirtyView='vn-config'; }
window.vnegToggleDia = vnegToggleDia;
window.vnegSetHora = vnegSetHora;

function vnegSyncPagoNotifUI(){
  ['efectivo','transf','tarjeta'].forEach(function(k){
    var el = document.getElementById('vn-pg-' + k);
    if (el) el.classList.toggle('on', !!_vnegPagos[k]);
  });
  ['pedidos','cancel','cal','resumen'].forEach(function(k){
    var el = document.getElementById('vn-nt-' + k);
    if (el) el.classList.toggle('on', !!_vnegNotif[k]);
  });
  var b = document.getElementById('vn-bank-banco');
  var c = document.getElementById('vn-bank-clabe');
  var t = document.getElementById('vn-bank-titular');
  if (b) b.value = _vnegBanco.banco || '';
  if (c) c.value = _vnegBanco.clabe || '';
  if (t) t.value = _vnegBanco.titular || '';
}

function vnegTogglePago(tipo) {
  window._dirtyView = 'vn-config';
  _vnegPagos[tipo] = !_vnegPagos[tipo];
  var el = document.getElementById('vn-pg-' + tipo);
  if (el) el.classList.toggle('on', !!_vnegPagos[tipo]);
  var nombres = {efectivo:'Efectivo', transf:'Transferencia', tarjeta:'Tarjeta'};
  toast((nombres[tipo]||tipo) + ': ' + (_vnegPagos[tipo] ? '✅ Activo' : '⏸️ Desactivado'));
}

function vnegToggleNotif(tipo) {
  window._dirtyView = 'vn-config';
  _vnegNotif[tipo] = !_vnegNotif[tipo];
  var el = document.getElementById('vn-nt-' + tipo);
  if (el) el.classList.toggle('on', !!_vnegNotif[tipo]);
  toast('Notif. ' + tipo + ': ' + (_vnegNotif[tipo] ? '🔔 Activadas' : '🔕 Desactivadas'));
}

// Guardar config del negocio en Firebase (su propio uid)
window.vnegGuardarConfig = async function() {
  var sel = document.getElementById('vneg-est-sel');
  var nuevoEstado = sel ? sel.value : 'activo';
  if (window._normEstadoOp) nuevoEstado = window._normEstadoOp(nuevoEstado);
  // Si el usuario modificó horarios y el horario laboral está abierto,
  // no arrastrar estados manuales viejos (cerrado/pausado/ocupado) desde antes del cambio.
  // Solo se respeta manual si el usuario tocó explícitamente el selector de estado.
  if (!window._vnegEstadoPendTocado && window._horarioFuerzaCerrado && !window._horarioFuerzaCerrado(VNEG_HORARIOS)) {
    nuevoEstado = 'activo';
  }
  // Si el horario fuerza cerrado pero el usuario guardó sin cambiar, conservar el estado manual previo
  // para que cuando el horario abra, el estado efectivo sea el que el usuario configuró (no cerrado manual)
  if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS) && nuevoEstado === 'cerrado') {
    // El select muestra cerrado por horario — preservar el estado manual guardado anteriormente
    nuevoEstado = (_vnegEstadoOp && _vnegEstadoOp !== 'cerrado') ? _vnegEstadoOp : 'activo';
  }
  window._dirtyView = null;

  // Mismo flujo exacto que cambiarEstadoOp del restaurante
  _vnegEstadoOp = nuevoEstado;
  _vnegEstadoOpTs = Date.now();
  localStorage.setItem('dcRestOpV2', nuevoEstado);
  localStorage.setItem('dcRestOpV2Ts', String(_vnegEstadoOpTs));
  try { var _uVN=(window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||localStorage.getItem('dcuserUid')||''; if(_uVN){ localStorage.setItem('dcuserEstadoOpTs_'+_uVN, String(_vnegEstadoOpTs)); } } catch(e){}
  try {
    var _uN = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || localStorage.getItem('dcuserUid') || '';
    if (_uN) localStorage.setItem('dcuserEstadoOp_' + _uN, nuevoEstado);
  } catch(e) {}

  // Actualizar UI — todos los lugares igual que restaurante
  vnegSyncCfgUI(nuevoEstado);
  _vnegSyncHomeBadge();
  if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(nuevoEstado);

  // Guardar pagos, notificaciones y datos bancarios del negocio
  _vnegBanco = {
    banco:   (document.getElementById('vn-bank-banco')   && document.getElementById('vn-bank-banco').value.trim())   || '',
    clabe:   (document.getElementById('vn-bank-clabe')   && document.getElementById('vn-bank-clabe').value.trim())   || '',
    titular: (document.getElementById('vn-bank-titular') && document.getElementById('vn-bank-titular').value.trim()) || ''
  };

  // Guardar en Firebase
  try {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (user && _db) {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var hSer = VNEG_HORARIOS.map(function(h){ return {id:h.id,dia:h.dia,abre:h.abre,cierra:h.cierra,abierto:h.abierto}; });
      await _fb.setDoc(_fb.doc(_db,'usuarios',user.uid), {
        estadoOp:nuevoEstado,
        estadoOpTs:_vnegEstadoOpTs,
        horarios:hSer,
        pagos:_vnegPagos,
        notificacionesCfg:_vnegNotif,
        bancoTransferencia:_vnegBanco
      }, {merge:true});
    }
  } catch(e) { }

  // Overlay y regreso
  if (window._vnegShowOverlay) {
    window._vnegShowOverlay({
      f1tit:'Guardando cambios...', f1sub:'Actualizando tu negocio.',
      f2tit:'¡Listo!', f2sub:'Cambios guardados.',
      onDone: function() {
        // Estado EFECTIVO (horario + manual) — no el manual crudo
        var _efN = window._estadoEfectivoDe
          ? window._estadoEfectivoDe(_vnegEstadoOp, _vnegEstadoOpTs, VNEG_HORARIOS)
          : _vnegEstadoOp;
        // Badge del Centro Operativo con estado efectivo
        var _m = _vnegMeta[_efN] || _vnegMeta.activo;
        var _dot = document.getElementById('vn-estado-dot');
        var _lbl = document.getElementById('vn-estado-lbl');
        if (_dot) { _dot.style.background = _m.c; _dot.className = 'estado-dot'; }
        if (_lbl) _lbl.textContent = _m.t.toUpperCase();
        // SELECT muestra el manual guardado (igual que restaurante en guardarConfig)
        var _estSel = _vnegEstadoOp;
        if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS)) _estSel = 'cerrado';
        var _sel = document.getElementById('vneg-est-sel');
        if (_sel) _sel.value = _estSel;
        vnegSyncCfgUI(_estSel);
        // Repintar home
        window.renderHomeM2 && window.renderHomeM2();
        _vnegSyncHomeBadge();
        if (window.dcPintarEstado) window.dcPintarEstado();
        if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(_vnegEstadoOp);
        negTo('vn-home', true);
      }
    });
  }
};

// Cargar config del negocio al entrar a su Centro Operativo
window.vnegCargarConfig = async function() {
  try {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var ds = await _fb.getDoc(_fb.doc(_db,'usuarios',user.uid));
    if (ds.exists()) {
      var d = ds.data();
      _vnegEstadoOp = d.estadoOp || 'activo';
      _vnegEstadoOpTs = d.estadoOpTs || 0;
      try { var _uVC=user.uid; if(_uVC){ localStorage.setItem('dcuserEstadoOpTs_'+_uVC, String(_vnegEstadoOpTs)); } } catch(e){}
      // Sincronizar con la fuente única (localStorage) para que v-home y vn-home coincidan
      if (window.setEstadoOperativo && d.estadoOp) {
        try { localStorage.setItem('dcRestOpV2', _vnegEstadoOp); } catch(e){}
      }
      if (d.horarios && d.horarios.length) VNEG_HORARIOS = d.horarios;
      var nm = document.getElementById('vn-hdr-name');
      if (nm) nm.textContent = d.nombreNegocio || d.nombre || 'Mi Negocio';
      var cn = document.getElementById('vn-comunidad-nombre');
      if (cn) cn.textContent = d.nombreNegocio || d.nombre || 'Tu negocio';
      if (d.pagos) _vnegPagos = Object.assign({efectivo:true, transf:true, tarjeta:false}, d.pagos);
      if (d.notificacionesCfg) _vnegNotif = Object.assign({pedidos:true, cancel:true, cal:false, resumen:true}, d.notificacionesCfg);
      if (d.bancoTransferencia) _vnegBanco = Object.assign({banco:'', clabe:'', titular:''}, d.bancoTransferencia);
    }
    vnegSyncPagoNotifUI();
    window._vnegEstadoPendTocado = false;
    // Usar _vnegEstadoOp directamente — ya fue cargado desde Firebase arriba
    var estManual = window._normEstadoOp ? window._normEstadoOp(_vnegEstadoOp) : _vnegEstadoOp;
    // El SELECT muestra el estado que el usuario guardó (manual).
    // Si el horario fuerza cerrado, el select muestra cerrado también.
    var estEnSelect = estManual;
    if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS)) estEnSelect = 'cerrado';
    var sel = document.getElementById('vneg-est-sel');
    if (sel) sel.value = estEnSelect;
    vnegSyncCfgUI(estEnSelect);
    vnegRenderHorarios();
    _vnegSyncHomeBadge();
  } catch(e) { }
};

function dcRest_navBack() {
  if (_rNavStack.length <= 1) { dcRest_navTo('vr-home', true); _rNavStack = ['vr-home']; return; }
  _rNavStack.pop();
  var prev = _rNavStack[_rNavStack.length - 1] || 'vr-home';
  dcRest_navTo(prev, true);
}
// Alias público: HTML onclicks usan navBack() — se mantiene para compatibilidad
var navBack = dcRest_navBack;
window.dcRest_navBack = dcRest_navBack;

/* ── CAMBIOS SIN GUARDAR — aviso antes de salir ─────────────── */
window._dirtyView = null;
function _marcarSucio(viewId) { window._dirtyView = viewId; }
// Inputs, selects y textareas dentro de las dos pantallas (el estado NO cuenta: se guarda al instante)
document.addEventListener('change', _dcDirtyEv, true);
document.addEventListener('input',  _dcDirtyEv, true);
function _dcDirtyEv(ev) {
  var t = ev.target; if (!t || !t.closest) return;
  if (t.closest('#vr-config')) _marcarSucio('vr-config');
  else if (t.closest('#vn-config')) _marcarSucio('vn-config');
  else if (t.closest('#vr-cmv')) _marcarSucio('vr-cmv');
  else if (t.closest('#vn-cmv')) _marcarSucio('vn-cmv');
  else if (t.closest('#vr-prod-form')) _marcarSucio('vr-prod-form');
}

function _resetScroll(id) {
  var SCROLLABLE = {
    'vr-home':'home-scr', 'vr-pedidos':'ped-scr', 'vr-det-pedido':'det-scr',
    'vr-menu':'menu-scr', 'vr-promos':'promos-scr', 'vr-notif':'notif-scr',
    'vr-config':'config-scr', 'vr-prod-form':'rf-pform-scr'
  };
  var scrId = SCROLLABLE[id];
  if (scrId) {
    var el = document.getElementById(scrId);
    if (el) el.scrollTop = 0;
  }
}

function _onViewEnter(id) {
  window._dirtyView = null;
  if (id === 'vr-home') {
    if (!_vrIsD()) {
      _vrCargarPedidos().then(function(){ _renderHome(); });
    } else {
      _renderHome();
    }
  }
  if (id === 'vr-pedidos') {
    if (!_vrIsD()) {
      _vrCargarPedidos().then(function(){ _renderPedidos(); });
    } else {
      _renderPedidos();
    }
  }
  if (id === 'vr-menu') {
    if (!_vrIsD()) {
      _vrCargarMenu().then(function(){ _renderMenuRest(); });
    } else {
      _renderMenuRest();
    }
  }
  if (id === 'vr-notif')      _renderNotif();
  if (id === 'vr-config')     _initConfig();
  if (id === 'vr-cmv')        { cmvCargar(); cmvRenderPreview(); }
}
// Expuesto para que _goCore del index pueda llamarlo en integración futura
window.dcRest_onViewEnter = _onViewEnter;

/* ═══════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════ */
var _rToastTimer;
function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.classList.remove('show');
  if (el.parentNode !== document.body) document.body.appendChild(el);
  el.textContent = msg;
  void el.offsetWidth; // fuerza reflow — garantiza transición CSS en cualquier contexto
  el.classList.add('show');
  clearTimeout(_rToastTimer);
  _rToastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2800);
}

/* ═══════════════════════════════════════════════════════
   HORA LIVE
═══════════════════════════════════════════════════════ */
function _updateHora() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2,'0');
  var m = String(now.getMinutes()).padStart(2,'0');
  var hora = h + ':' + m;
  var el = document.getElementById('home-hora');
  if (el) el.textContent = hora;
  var eln = document.getElementById('vn-hora');
  if (eln) eln.textContent = hora;
  var sbars = document.querySelectorAll('.vn-sbar-hora');
  for (var _i=0; _i<sbars.length; _i++) sbars[_i].textContent = hora;
  if (!el && !eln) return;
  if (window.dcPintarEstado) window.dcPintarEstado(); // el horario puede retomar el control
  if (window._vnegRepintarEstado) window._vnegRepintarEstado(); // negocio: abre solo al llegar la hora con el tiempo
}

/* ═══════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════ */
function _renderHome() {
  _updateHora();
  // Reset scroll al inicio
  var homeScr = document.getElementById('home-scr');
  if (homeScr) homeScr.scrollTop = 0;

  // Estado op — calculado por horario con prioridad de estado manual
  var estEfectivo = _estadoEfectivo();
  var cfg = DC_ESTADOS[estEfectivo] || DC_ESTADOS.activo;
  var dot  = document.getElementById('home-estado-dot');
  var lbl_ = document.getElementById('home-estado-lbl');
  if (dot)  { dot.className = 'estado-dot ' + cfg.dotEl; }
  if (lbl_) lbl_.textContent = cfg.lbl;

  // Pedidos urgentes
  var nuevos  = (_vrPedidos()).filter(function(p){ return p.estado === 'nuevo'; });
  var activos = (_vrPedidos()).filter(function(p){ return GRUPOS.pedidos.indexOf(p.estado)!==-1; });
  var enProc  = (_vrPedidos()).filter(function(p){ return GRUPOS.en_proceso.indexOf(p.estado)!==-1; });
  var totalUrgente = activos.length + enProc.length;

  var urgWrap = document.getElementById('home-urgencia-wrap');
  if (nuevos.length > 0) {
    urgWrap.innerHTML = '<div class="urgencia-card hay-pedidos" onclick="navTo(\'vr-pedidos\')">'
      + '<div class="urg-ic">📦</div>'
      + '<div class="urg-body">'
      + '<div class="urg-title">' + nuevos.length + ' pedido' + (nuevos.length!==1?'s':'') + ' nuevo' + (nuevos.length!==1?'s':'') + '</div>'
      + '<div class="urg-sub">' + nuevos.map(function(p){return p.vecinoNombre;}).join(', ') + ' • Toca para atender</div>'
      + '</div><div class="urg-arrow">›</div></div>';
  } else if (totalUrgente > 0) {
    urgWrap.innerHTML = '<div class="urgencia-card" style="background:linear-gradient(120deg,#4a3200,#8a6000);box-shadow:0 4px 16px rgba(100,60,0,.25);" onclick="navTo(\'vr-pedidos\')">'
      + '<div class="urg-ic">👨‍🍳</div>'
      + '<div class="urg-body">'
      + '<div class="urg-title">' + totalUrgente + ' pedido' + (totalUrgente!==1?'s':'') + ' en proceso</div>'
      + '<div class="urg-sub">Sin pedidos nuevos · ' + activos.length + ' aceptados · ' + enProc.length + ' en cocina</div>'
      + '</div><div class="urg-arrow">›</div></div>';
  } else {
    urgWrap.innerHTML = '<div class="urgencia-card sin-pedidos" onclick="navTo(\'vr-pedidos\')">'
      + '<div class="urg-ic">✅</div>'
      + '<div class="urg-body">'
      + '<div class="urg-title">Sin pedidos pendientes</div>'
      + '<div class="urg-sub">Estás activo y listo para recibir</div>'
      + '</div><div class="urg-arrow">›</div></div>';
  }

  // Jornada
  var pedHoy  = (_vrPedidos()).filter(function(p){ return p.estado !== 'cancelado'; }).length;
  var ventHoy = (_vrPedidos()).filter(function(p){ return p.estado === 'entregado'; })
                            .reduce(function(s,p){ return s+p.total; }, 0);
  var elPed = document.getElementById('hj-pedidos');
  var elVen = document.getElementById('hj-ventas');
  var elAp  = document.getElementById('hj-apertura');
  if (elPed) elPed.textContent = pedHoy;
  if (elVen) elVen.textContent = '$' + ventHoy;
  if (elAp)  elAp.textContent  = '09:00';

  // Badges quick-icons + nav
  // Badge ALERTA solo para pedidos 'nuevo' (sin atender)
  // Badge pedidos (icono) para todos los activos
  var bPed  = document.getElementById('qi-badge-ped');
  var bNotif = document.getElementById('qi-badge-notif');
  var nbPed  = document.getElementById('nav-badge-ped');
  var nbNot  = document.getElementById('nav-badge-notif');
  var nSinLeer = _vrNotifsCache.filter(function(n){ return !n.leida; }).length;
  var nNuevos = nuevos.length; // solo 'nuevo' — alerta real

  if (bPed)  { bPed.style.display  = nNuevos>0 ? 'flex':'none'; bPed.textContent  = nNuevos||''; }
  if (bNotif){ bNotif.style.display = nSinLeer>0 ? 'flex':'none'; bNotif.textContent = nSinLeer||''; }
  if (nbPed) { nbPed.style.display  = nNuevos>0 ? 'flex':'none'; nbPed.textContent  = nNuevos||''; }
  if (nbNot) { nbNot.style.display  = nSinLeer>0 ? 'flex':'none'; nbNot.textContent  = nSinLeer||''; }

  // Semana
  var elSem = document.getElementById('semana-resumen');
  if (elSem) elSem.textContent = pedHoy + ' pedidos · $' + ventHoy + ' · 4.8★';

  // Oportunidad contextual
  _renderOportunidad();

  // Banners
  _renderBanners();
}

/* ═══════════════════════════════════════════════════════
   OPORTUNIDAD CONTEXTUAL (basada en hora real, sin datos inventados)
═══════════════════════════════════════════════════════ */
function _renderOportunidad() {
  var wrap = document.getElementById('home-oportunidad');
  if (!wrap) return;
  var hora = new Date().getHours();
  var cfg;
  if (hora >= 11 && hora <= 14) {
    cfg = { ic:'🔥', title:'Hora pico · ' + hora + ':xx', sub:'Puedes destacar tu menú ahora para más pedidos', cta:'Crear promo →' };
  } else if (hora >= 18 && hora <= 21) {
    cfg = { ic:'🌙', title:'Cena en Cumbres', sub:'Activa una promo vespertina y llega a más vecinos', cta:'Crear promo →' };
  } else {
    cfg = { ic:'📣', title:'¿Quieres más pedidos?', sub:'Crea una promoción y aparece primero en Cumbres', cta:'Ver opciones →' };
  }
  wrap.innerHTML = '<div class="sec-lbl">Oportunidad de hoy</div>'
    + '<div class="oportunidad-card" onclick="navTo(\'vr-promos\')">'
    + '<div class="op-ic">' + cfg.ic + '</div>'
    + '<div class="op-body"><div class="op-title">' + cfg.title + '</div>'
    + '<div class="op-sub">' + cfg.sub + '</div></div>'
    + '<div class="op-cta">' + cfg.cta + '</div>'
    + '</div>';
}

/* ═══════════════════════════════════════════════════════
   BANNERS — carrusel auto-avance
═══════════════════════════════════════════════════════ */
function _renderBanners() {
  var track = document.getElementById('banners-track');
  var dots  = document.getElementById('banner-dots');
  var wrap  = document.getElementById('banners-wrap') || (track && track.closest && track.closest('.banners-wrap'));
  if (!track || !dots) return;

  // Sin banners: ocultar toda la sección
  if (!_vrBannersCache.length) {
    track.innerHTML = '';
    dots.innerHTML  = '';
    clearInterval(_rBannerTimer);
    // Ocultar la zona 5 completa si no hay banners
    var zona5 = track.parentElement && track.parentElement.parentElement;
    if (zona5) zona5.style.display = 'none';
    var zona5wrap = document.getElementById('banners-wrap');
    if (zona5wrap) zona5wrap.closest && (zona5wrap.closest('div[style]') || zona5wrap.parentElement).style && (zona5wrap.parentElement.style.display = 'none');
    return;
  }

  track.innerHTML = _vrBannersCache.map(function(b) {
    return '<div class="banner-slide" style="background:' + b.bg + ';" onclick="toast(\'📌 Banner DC — comunidad activa\')">'
      + '<div class="banner-inner">'
      + '<div class="banner-ico">' + b.ic + '</div>'
      + '<div class="banner-txt">'
      + '<div class="banner-title">' + b.title + '</div>'
      + '<div class="banner-sub">'   + b.sub   + '</div>'
      + '</div></div>'
      + (b.cta ? '<div class="banner-cta">' + b.cta + '</div>' : '')
      + (b.pat ? '<div class="banner-pat">Patrocinado</div>'   : '')
      + '</div>';
  }).join('');

  dots.innerHTML = _vrBannersCache.map(function(_,i){
    return '<div class="bd' + (i===0?' on':'') + '" id="bd-'+i+'"></div>';
  }).join('');

  clearInterval(_rBannerTimer);
  _rBannerTimer = setInterval(function(){
    _rBannerIdx = (_rBannerIdx + 1) % _vrBannersCache.length;
    _advanceBanner(_rBannerIdx);
  }, 4000);
}

function _advanceBanner(idx) {
  var track = document.getElementById('banners-track');
  if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
  document.querySelectorAll('.bd').forEach(function(d,i){
    d.className = 'bd' + (i===idx ? ' on' : '');
  });
}

/* ═══════════════════════════════════════════════════════
   PEDIDOS
═══════════════════════════════════════════════════════ */
window._irPedidosRestTab = function(tab){
    go('vr-home','right');                                  // entra al Centro Operativo (igual que el botón)
    setTimeout(function(){
      if (window.dcRest_navTo) window.dcRest_navTo('vr-pedidos');  // navega a Pedidos dentro del shell
      setTimeout(function(){
        if (window.tabPedidos) { var btn=document.getElementById('tab-'+tab); window.tabPedidos(tab, btn); }
      }, 120);
    }, 80);
  };
  window.tabPedidos = function tabPedidos(tab, btn) {
  _rPedTab = tab;
  _syncTabUI();
  _renderPedidos();
};

function _syncTabUI() {
  ['pedidos','en_proceso','entregados'].forEach(function(t){
    var el = document.getElementById('tab-' + t);
    if (el) el.className = 'chip' + (t === _rPedTab ? ' on' : '');
  });
}

function _renderPedidos() {
  var cont  = document.getElementById('ped-cont');
  var subEl = document.getElementById('ped-sub');
  if (!cont) return;

  var grupo = _vrPedidos().filter(function(p){
    return GRUPOS[_rPedTab].indexOf(p.estado) !== -1;
  });
  var totalAct = _vrPedidos().filter(function(p){
    return GRUPOS.pedidos.indexOf(p.estado)!==-1 || GRUPOS.en_proceso.indexOf(p.estado)!==-1;
  }).length;
  if (subEl) subEl.textContent = totalAct > 0 ? totalAct + ' activo' + (totalAct!==1?'s':'') : 'Sin pedidos activos';

  if (!grupo.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-ic">📭</div>'
      + '<div class="empty-tit">Sin pedidos en esta sección</div>'
      + '<div class="empty-sub">Cambia el filtro para ver otros estados</div></div>';
    return;
  }
  cont.innerHTML = grupo.map(function(p) {
    var hora = new Date(p.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    var its  = p.items.map(function(i){ return _resc(i.cantidad)+'× '+_resc(i.nombre); }).join(', ');
    var esNuevo = p.estado === 'nuevo';
    var cardStyle = esNuevo
      ? 'background:#fff5f5;border:1.5px solid rgba(214,58,42,.3);border-radius:16px;margin:0 14px 10px;padding:14px;cursor:pointer;'
      : '';
    return '<div class="card' + (esNuevo ? '' : '') + '" style="' + cardStyle + '" onclick="abrirDetalle(\''+_resc(p._id)+'\')">'
      + (esNuevo ? '<div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#D63A2A;display:inline-block;animation:pulse-red 1.2s infinite;"></span><span style="font-size:10px;font-weight:800;color:#D63A2A;letter-spacing:.4px;">NUEVO</span></div>' : '')
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--tx);">👤 ' + _resc(p.vecinoNombre) + '</div>'
      + '<span style="font-size:10px;color:var(--tx4);">' + hora + '</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--tx3);margin-bottom:6px;">' + its + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:13px;font-weight:700;color:var(--tx2);">$' + _resc(p.total) + ' · ' + _resc(p.metodoPago) + '</span>'
      + '<span class="badge b-' + _resc(p.estado) + '">' + lbl(p.estado) + '</span>'
      + '</div>'
      + (p.notas ? '<div style="font-size:11px;color:#777;margin-top:6px;font-style:italic;">📝 ' + _resc(p.notas) + '</div>' : '')
      + '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   DETALLE PEDIDO
═══════════════════════════════════════════════════════ */
function abrirDetalle(pid) {
  _rPedActivo = pid;
  var p = _vrPedidos().find(function(x){ return x._id === pid; });
  if (!p) return;
  document.getElementById('det-num').textContent = 'Pedido #' + pid.slice(-4).toUpperCase();
  _renderDetalle(p);
  // Navegación directa sin acumular stack — el detalle siempre vuelve a pedidos
  var _vrShell = document.getElementById('vr-shell');
  var cur = _vrShell ? _vrShell.querySelector('.view.active') : document.querySelector('#vr-shell .view.active');
  var nxt = document.getElementById('vr-det-pedido');
  if (!cur || !nxt || cur === nxt) return;
  _resetScroll('vr-det-pedido');
  nxt.style.transform = 'translateX(100%)';
  nxt.style.opacity   = '0';
  nxt.classList.add('active');
  cur.classList.add('anim-out');
  requestAnimationFrame(function(){
    nxt.classList.add('anim-in');
    nxt.style.transform = 'translateX(0)';
    nxt.style.opacity   = '1';
    cur.style.transform  = 'translateX(-30%)';
    cur.style.opacity    = '0';
  });
  setTimeout(function(){
    cur.classList.remove('active','anim-out');
    cur.style.cssText = '';
    nxt.classList.remove('anim-in');
    nxt.style.cssText = '';
  }, 320);
  // Stack siempre queda limpio: [... , vr-pedidos] — nunca apilamos det-pedido
  var stackTop = _rNavStack[_rNavStack.length - 1];
  if (stackTop !== 'vr-pedidos') _rNavStack.push('vr-pedidos');
}

function _renderDetalle(p) {
  var cont = document.getElementById('det-cont');
  if (!cont) return;

  // Fuente única de verdad — p.estado siempre ya actualizado
  var hora        = new Date(p.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  var esCancelado = ['rechazado','cancelado'].indexOf(p.estado) !== -1;
  var esFinal     = ['entregado','en_camino','recogido','ya_estoy_aqui','rechazado','cancelado'].indexOf(p.estado) !== -1;

  // ── A) Cliente — compacto, badge refleja p.estado ─────────
  var clienteHTML = '<div class="comanda-cliente">'
    + '<div class="comanda-cliente-ic">👤</div>'
    + '<div class="comanda-cliente-info">'
    + '<div class="comanda-cliente-nombre">' + p.vecinoNombre + '</div>'
    + '<div class="comanda-cliente-meta">💳 ' + p.metodoPago + '  ·  🕐 ' + hora + '</div>'
    + '</div>'
    + '<span class="badge b-' + p.estado + '">' + lbl(p.estado) + '</span>'
    + '</div>';

  // ── B) Entrega — posición crítica ANTES de la comanda ─────
  var entrega = p.entrega || {};
  var esRecoger = p.recepcion === 'recoger' || (!p.recepcion && entrega.tipo !== 'domicilio');
  var esDomicilio = !esRecoger;
  var entregaHTML = '<div class="comanda-entrega">'
    + '<div class="comanda-entrega-tipo">'
    + (esDomicilio ? '🛵 A domicilio' : '🏪 Recoger en tienda')
    + '</div>'
    + (esDomicilio && entrega.direccion
        ? '<div class="comanda-entrega-dir">' + entrega.direccion + '</div>'
          + (entrega.referencia ? '<div class="comanda-entrega-ref">' + entrega.referencia + '</div>' : '')
        : (esRecoger
            ? '<div class="comanda-entrega-ref">'
              + ((p.direccionRecogidaRestaurante||p.direccionRecogida)
                  ? '📍 Dirección indicada al cliente: ' + (p.direccionRecogidaRestaurante||p.direccionRecogida)
                  : 'El cliente recogerá en tu negocio')
              + '</div>'
            : '')
      )
    + '</div>';

  // ── C) Comanda — protagonista visual ──────────────────────
  var itemsHTML = p.items.map(function(it) {
    return '<div class="comanda-item">'
      + '<span class="comanda-item-qty">' + it.cantidad + '</span>'
      + '<span class="comanda-item-nombre">' + it.nombre + '</span>'
      + '<span class="comanda-item-precio">$' + (it.cantidad * it.precio) + '</span>'
      + '</div>';
  }).join('');

  var notaHTML = p.notas
    ? '<div class="comanda-nota">📝 ' + p.notas + '</div>'
    : '';

  var comandaHTML = '<div class="comanda-items">'
    + '<div class="comanda-items-title">Comanda</div>'
    + itemsHTML
    + '<div class="comanda-total">'
    + '<span class="comanda-total-lbl">Total a cobrar</span>'
    + '<span class="comanda-total-val">$' + p.total + '</span>'
    + '</div>'
    + notaHTML
    + '</div>';

  // ── D) Tiempo estimado — [-5] TIEMPO [+5] ─────────────────
  // AJUSTE 7: siempre visible; botones bloqueados cuando ya salió a entregar
  var tiempoHTML = '';
  if (!esCancelado) {
    var tActual = p.tiempoEstimado != null ? p.tiempoEstimado : 20;
    var editable = !esFinal; // false cuando en_camino, entregado, etc.
    var atMin = tActual <= 0;
    var atMax = tActual >= 60;
    tiempoHTML = '<div class="tiempo-wrap">'
      + '<div class="tiempo-title">⏱ Tiempo estimado de entrega</div>'
      + '<div class="tiempo-ctrl">'
      + '<button class="tiempo-step-btn" id="btn-menos"'
        + (!editable ? ' disabled style="opacity:.3;pointer-events:none;"'
           : atMin   ? ' disabled style="opacity:.3;pointer-events:none;"' : '')
        + ' onclick="ajustarTiempo(-5)">−5</button>'
      + '<div class="tiempo-display">'
      + '<div class="tiempo-val" id="det-tiempo-val">' + tActual + '</div>'
      + '<div class="tiempo-unit">min</div>'
      + '</div>'
      + '<button class="tiempo-step-btn" id="btn-mas"'
        + (!editable ? ' disabled style="opacity:.3;pointer-events:none;"'
           : atMax   ? ' disabled style="opacity:.3;pointer-events:none;"' : '')
        + ' onclick="ajustarTiempo(5)">+5</button>'
      + '</div>'
      + (!editable
          ? '<div class="tiempo-reset" style="color:var(--tx4);pointer-events:none;">Bloqueado — pedido en camino</div>'
          : '<div class="tiempo-reset" onclick="resetTiempo()">Restablecer a 20 min</div>')
      + '</div>';
  }

  // ── E) Acciones — única fuente de verdad: p.estado ────────
  var accsHTML = '';
  if (esCancelado) {
    accsHTML = '<div class="det-acciones">'
      + '<div style="background:var(--red-lt);border-radius:14px;padding:14px;text-align:center;border:.5px solid #f0b0b0;">'
      + '<div style="font-size:20px;margin-bottom:4px;">' + (p.estado==='rechazado'?'❌':'🚫') + '</div>'
      + '<div style="font-size:13px;font-weight:700;color:var(--red);">Pedido ' + lbl(p.estado) + '</div>'
      + '</div></div>';
  } else if (p.estado === 'nuevo') {
    accsHTML = '<div class="det-acciones">'
      + '<button class="det-accion-aceptar" onclick="cambiarEstado(\'' + p._id + '\',\'aceptado\')">✅ Aceptar pedido</button>'
      + '<button class="det-accion-rechazar" onclick="cambiarEstado(\'' + p._id + '\',\'rechazado\')">❌ Rechazar pedido</button>'
      + '</div>';
  } else if (p.estado === 'entregado') {
    accsHTML = '<div class="det-acciones">'
      + '<div style="background:var(--green-lt);border-radius:14px;padding:13px;text-align:center;border:.5px solid rgba(31,194,106,.3);">'
      + '<div style="font-size:18px;margin-bottom:3px;">🏠</div>'
      + '<div style="font-size:13px;font-weight:700;color:var(--green-dk);">Pedido entregado</div>'
      + '</div></div>';
  } else {
    var accs = ACCIONES[p.estado] || [];
    if (accs.length) {
      accsHTML = '<div class="det-acciones">'
        + accs.map(function(a){
            var bg = a.cls==='btn-yellow'?'var(--yellow)':a.cls==='btn-green'?'var(--green)':'var(--blue)';
            var co = a.cls==='btn-yellow'?'var(--amber-dk)':'#fff';
            return '<button class="det-accion-std" style="background:' + bg + ';color:' + co + ';" onclick="cambiarEstado(\'' + p._id + '\',\'' + a.est + '\')">' + a.lbl + '</button>';
          }).join('')
        + '</div>';
    }
  }

  // ── F) Progreso — mini dots, misma fuente de verdad p.estado
  var progresoHTML = '';
  if (!esCancelado) {
    var orden = ['nuevo','aceptado','preparando','listo','en_camino','entregado'];
    var idx   = orden.indexOf(p.estado);
    progresoHTML = '<div class="comanda-progreso">'
      + '<div class="comanda-progreso-title">Progreso</div>'
      + PASOS.map(function(paso, i){
          var done   = idx >= i;
          var active = orden[idx] === paso.key;
          return '<div class="paso-mini">'
            + '<div class="paso-mini-dot' + (active?' active':done?' done':'') + '"></div>'
            + '<div class="paso-mini-lbl' + (active?' active':done?' done':'') + '">' + paso.lbl + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  // Orden: A cliente · B entrega · C comanda · D tiempo · E progreso · F acción siguiente
  cont.innerHTML = clienteHTML + entregaHTML + comandaHTML + tiempoHTML + progresoHTML + accsHTML;
}

function ajustarTiempo(delta) {
  var el    = document.getElementById('det-tiempo-val');
  var bMenos = document.getElementById('btn-menos');
  var bMas   = document.getElementById('btn-mas');
  if (!el) return;
  var actual = parseInt(el.textContent) || 20;
  var nuevo  = Math.max(0, Math.min(60, actual + delta));
  el.textContent = nuevo;
  // Sincronizar con el pedido
  var p = _vrPedidos().find(function(x){ return x._id === _rPedActivo; });
  if (p) p.tiempoEstimado = nuevo;
  // Actualizar estado disabled de los botones
  if (bMenos) { var atMin = nuevo <= 0;  bMenos.disabled = atMin; bMenos.style.opacity = atMin?'0.3':'1'; bMenos.style.pointerEvents = atMin?'none':''; }
  if (bMas)   { var atMax = nuevo >= 60; bMas.disabled   = atMax; bMas.style.opacity   = atMax?'0.3':'1'; bMas.style.pointerEvents   = atMax?'none':''; }
}

function resetTiempo() {
  var el = document.getElementById('det-tiempo-val');
  if (el) el.textContent = '20';
  var p = _vrPedidos().find(function(x){ return x._id === _rPedActivo; });
  if (p) p.tiempoEstimado = 20;
  toast('⏱ Tiempo restablecido a 20 min');
}


/* ═══════════════════════════════════════════════════════
   FINAL FELIZ — overlay parametrizable
   cfg = { f1tit, f1sub, f2tit, f2sub, onDone }
   Timings: 1400ms fase1 → 1600ms fase2 → onDone
   NO toca _rNavStack. NO es una vista.
═══════════════════════════════════════════════════════ */
var _rOvT1, _rOvT2;
var _SVG_LOGO = '<svg width="100" height="100" viewBox="0 0 106 106" fill="none" xmlns="http://www.w3.org/2000/svg">'
  + '<defs><radialGradient id="rbgl" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#1E3A28"/><stop offset="100%" stop-color="#0C1A10"/></radialGradient></defs>'
  + '<circle cx="53" cy="53" r="50" fill="url(#rbgl)"/>'
  + '<g class="ro-ring"><circle cx="53" cy="53" r="49" fill="none" stroke="#1FC26A" stroke-width="1.5" stroke-dasharray="10 5" stroke-linecap="round"/>'
  + '<circle cx="53" cy="4" r="3.5" fill="#2EE07A"/></g>'
  + '<g class="ro-gear">'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#1FC26A"/>'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(60 53 53)"/>'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(120 53 53)"/>'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#D63A2A" transform="rotate(180 53 53)"/>'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(240 53 53)"/>'
  + '<polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(300 53 53)"/>'
  + '</g>'
  + '<circle cx="53" cy="53" r="14" fill="#0C1A10"/>'
  + '<circle cx="53" cy="53" r="14" fill="none" stroke="#1FC26A" stroke-width="1"/>'
  + '<polygon points="53,42 55,50 53,48 51,50" fill="#1FC26A"/>'
  + '<polygon points="53,42 55,50 53,48 51,50" fill="#F5C518" transform="rotate(120 53 53)"/>'
  + '<polygon points="53,42 55,50 53,48 51,50" fill="#D63A2A" transform="rotate(240 53 53)"/>'
  + '<circle cx="53" cy="53" r="4" fill="#1FC26A"/>'
  + '</svg>';

window._showOverlay = _showOverlay;
function _showOverlay(cfg) {
  var ov   = document.getElementById('rest-overlay');
  var box  = document.getElementById('rest-overlay-box');
  var body = document.getElementById('rest-overlay-body');
  if (!ov || !box || !body) {
    // Fallback: si por alguna razón el overlay no existe, ejecutar onDone directamente
    if (cfg.onDone) cfg.onDone();
    return;
  }

  // Limpiar timers anteriores por si se dispara dos veces seguidas
  clearTimeout(_rOvT1);
  clearTimeout(_rOvT2);

  // ── FASE 1 — proceso (amarillo oscuro, logo animado) ──────
  box.className = 'ro-box phase-send';
  body.innerHTML = '<div class="ro-logo-wrap">' + _SVG_LOGO + '</div>'
    + '<div class="ro-title">' + (cfg.f1tit || 'Procesando...') + '</div>'
    + '<div class="ro-sub">'  + (cfg.f1sub || '') + '</div>';

  ov.classList.add('visible');

  // ── FASE 2 — éxito (verde oscuro, check animado) ─────────
  _rOvT1 = setTimeout(function() {
    box.className = 'ro-box phase-ok';
    body.innerHTML = '<div class="ro-check">✅</div>'
      + '<div class="ro-title">' + (cfg.f2tit || 'Listo') + '</div>'
      + '<div class="ro-sub">'  + (cfg.f2sub || '') + '</div>';

    // ── Cerrar y ejecutar callback ────────────────────────
    _rOvT2 = setTimeout(function() {
      ov.classList.remove('visible');
      if (cfg.onDone) cfg.onDone();
    }, 1600);

  }, 1400);
}

function cambiarEstado(pid, nuevoEst) {
  var p = _vrPedidos().find(function(x){ return x._id === pid; });
  if (!p) return;
  p.estado = nuevoEst;
  p.actualizado = Date.now();
  if (nuevoEst === 'aceptado') {
    var tel = document.getElementById('det-tiempo-val');
    p.tiempoEstimado = tel ? Math.max(0, Math.min(60, parseInt(tel.textContent)||20)) : 20;
  }

  // Persistir en Firestore si usuario real
  if (!_vrIsD()) {
    var _db2=_vrDb();
    if (_db2 && pid) {
      (async function(){
        try {
          var f=await _vrFb();
          var upd={estado:nuevoEst,actualizado:Date.now()};
          if(nuevoEst==='aceptado') upd.tiempoEstimado=p.tiempoEstimado;
          await f.updateDoc(f.doc(_db2,'pedidos',pid),upd);
          // Notificar al vecino el cambio de estado (mismo formato que el resto de la app)
          var _msgsV={aceptado:'\u00a1Tu pedido fue aceptado!',rechazado:'Tu pedido fue rechazado.',preparando:'Tu pedido se est\u00e1 preparando.',listo:'Tu pedido est\u00e1 listo.',en_camino:'Tu pedido va en camino.',entregado:'\u00a1Tu pedido fue entregado!',cancelado:'Tu pedido fue cancelado.'};
          if(_msgsV[nuevoEst]&&p.vecinoId){try{await f.addDoc(f.collection(_db2,'notificaciones'),{uid:p.vecinoId,tipo:'pedido',modulo:'pedidos',titulo:'Actualizaci\u00f3n de tu pedido',mensaje:_msgsV[nuevoEst],leida:false,eliminada:false,prioridad:'normal',pedidoId:pid,fecha:f.serverTimestamp()});} catch(_ne) { }}
        } catch(e) { }
      })();
    }
  }

  // Rechazado — no merece overlay, solo toast
  if (nuevoEst === 'rechazado' || nuevoEst === 'cancelado') {
    toast('❌ Pedido ' + lbl(nuevoEst).toLowerCase());
    _renderDetalle(p);
    _renderHome();
    return;
  }

  // Configurar overlay según estado destino
  var OVERLAY_CFG = {
    aceptado: {
      f1tit: 'Aceptando pedido...',
      f1sub: 'Estamos notificando al vecino.',
      f2tit: 'Pedido aceptado',
      f2sub: 'Ya aparece en En proceso.',
      onDone: function() {
        _rPedTab = 'en_proceso';
        _syncTabUI();
        navTo('vr-pedidos', true);
      }
    },
    preparando: {
      f1tit: 'Actualizando pedido...',
      f1sub: 'Estamos avisando al vecino.',
      f2tit: 'Pedido actualizado',
      f2sub: 'El vecino ya puede ver el avance.',
      onDone: function() { _renderDetalle(p); _renderHome(); }
    },
    listo: {
      f1tit: 'Actualizando pedido...',
      f1sub: 'Estamos avisando al vecino.',
      f2tit: 'Pedido actualizado',
      f2sub: 'El vecino ya puede ver el avance.',
      onDone: function() { _renderDetalle(p); _renderHome(); }
    },
    en_camino: {
      f1tit: 'Actualizando pedido...',
      f1sub: 'Estamos avisando al vecino.',
      f2tit: 'Pedido actualizado',
      f2sub: 'El vecino ya puede ver el avance.',
      onDone: function() { _renderDetalle(p); _renderHome(); }
    },
    entregado: {
      f1tit: 'Cerrando pedido...',
      f1sub: 'Registrando la venta.',
      f2tit: 'Pedido completado',
      f2sub: 'Venta registrada correctamente.',
      onDone: function() {
        _rPedTab = 'entregados';
        _syncTabUI();
        navTo('vr-pedidos', true);
      }
    }
  };

  var cfg = OVERLAY_CFG[nuevoEst];
  if (cfg) {
    _showOverlay(cfg);
  } else {
    toast('✅ Estado actualizado: ' + lbl(nuevoEst));
    _renderDetalle(p);
    _renderHome();
  }
}

/* ═══════════════════════════════════════════════════════
   MENÚ
═══════════════════════════════════════════════════════ */
// Emojis por categoría — fallback visual para foto
var CAT_EMOJI = {
  'Tacos':'🌮','Pizzas':'🍕','Sushi':'🍱','Rolls':'🍣',
  'Antojitos':'🫔','Bebidas':'🥤','Postres':'🍮','Entradas':'🥗',
  'Platos principales':'🍽️','Extras':'➕','Hamburguesas':'🍔',
  'Ensaladas':'🥗','Sopas':'🍲','Mariscos':'🦐'
};
function _catEmoji(cat) { return CAT_EMOJI[cat] || '🍴'; }

// Categorías por defecto disponibles
var CATS_DEFAULT = ['Tacos','Antojitos','Platos principales','Bebidas','Postres','Entradas','Extras'];

function _renderMenuRest() {
  var catsEl = document.getElementById('menu-cats');
  var cont   = document.getElementById('menu-cont');
  var subEl  = document.getElementById('menu-sub');

  // Unir categorías default + las del menú actual
  var catsMock = [];
  _vrMenu().forEach(function(p){
    if (catsMock.indexOf(p.categoria)===-1) catsMock.push(p.categoria);
  });
  var cats = ['todos'].concat(catsMock);

  // Chips sticky con botón eliminar por categoría (excepto "todos")
  if (catsEl) catsEl.innerHTML = cats.map(function(c){
    if (c === 'todos') {
      return '<button class="chip' + (c===_rMenuCat?' on':'') + '" onclick="filtrarMenu(\'todos\')">Todos</button>';
    }
    return '<span style="display:inline-flex;align-items:center;gap:0;">'
      + '<button class="chip' + (c===_rMenuCat?' on':'') + '" style="border-radius:10px 0 0 10px;padding-right:6px;" onclick="filtrarMenu(\'' + c + '\')">' + c + '</button>'
      + '<button onclick="eliminarCategoria(\'' + c.replace(/'/g,"\\'") + '\')" style="height:30px;padding:0 7px;font-size:12px;border:none;border-left:.5px solid rgba(0,0,0,.1);border-radius:0 10px 10px 0;background:' + (c===_rMenuCat?'var(--green-lt)':'#f0f0f0') + ';color:#888;cursor:pointer;font-family:inherit;line-height:1;" title="Eliminar categoría">×</button>'
      + '</span>';
  }).join('') + '<button class="chip" style="border:1px dashed #ccc;color:var(--tx4);" onclick="crearCategoria()">+ Nueva</button>';

  var lista = _rMenuCat === 'todos'
    ? _vrMenu()
    : _vrMenu().filter(function(p){ return p.categoria === _rMenuCat; });

  var nDisp = lista.filter(function(p){ return p.disponible; }).length;
  var nAgot = lista.filter(function(p){ return !p.disponible; }).length;
  if (subEl) subEl.textContent = nDisp + ' disponibles' + (nAgot?' · '+nAgot+' agotados':'');

  if (!lista.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-ic">📋</div>'
      + '<div class="empty-tit">Sin productos en esta categoría</div>'
      + '<div class="empty-sub">Agrega el primero con el botón "+ Agregar"</div></div>';
    return;
  }

  // Agrupar por categoría
  var grupos = {};
  lista.forEach(function(p){
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  cont.innerHTML = Object.keys(grupos).map(function(cat){
    var emoji = _catEmoji(cat);
    // Color de fondo por categoría
    var colores = ['#FFF0E8','#E8F5EE','#E8F0F8','#FFF8E1','#F0EBF8','#F5F0E8','#E8FAFF'];
    var colorIdx = Math.abs(cat.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0)) % colores.length;
    var bg = colores[colorIdx];

    var items = '<div class="menu-grid">' + grupos[cat].map(function(p){
      // Zona de imagen: foto real (base64), o emoji/placeholder como fallback
      var imgContent;
      var agotadoOverlay = p.disponible ? '' : '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(214,58,42,.85);color:#fff;font-size:11px;font-weight:800;padding:4px 0;text-align:center;letter-spacing:.5px;">AGOTADO</div>';
      if (p.foto && p.foto !== 'mock' && p.foto.indexOf('data:image') === 0) {
        // Foto real — mostrar imagen
        imgContent = '<div class="menu-pcard-img" style="background:#f0f0f0;padding:0;">'
          + '<img src="' + p.foto + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px 10px 0 0;" alt="' + p.nombre + '">'
          + agotadoOverlay
          + '</div>';
      } else {
        // Sin foto — placeholder emoji de categoría
        imgContent = '<div class="menu-pcard-img" style="background:' + bg + ';">'
          + emoji
          + '<div class="menu-pcard-img-inner"></div>'
          + agotadoOverlay
          + '</div>';
      }
      // Borde de disponibilidad — verde o rojo
      var cardBorder = p.disponible
        ? 'border:.5px solid rgba(31,194,106,.25);'
        : 'border:1.5px solid rgba(214,58,42,.3);';
      return '<div class="menu-pcard' + (p.disponible?'':' agotado') + '" style="' + cardBorder + '" onclick="abrirFormProd(\'' + p._id + '\')">'
        + imgContent
        + '<div class="menu-pcard-body">'
        + '<div class="menu-pcard-nombre">' + p.nombre + '</div>'
        + '<div class="menu-pcard-precio"' + (p.disponible?'':' style="color:#bbb;"') + '>$' + p.precio + '</div>'
        + '<div class="menu-pcard-footer">'
        + (p.disponible
            ? '<span style="font-size:9px;font-weight:700;color:var(--green-dk);background:var(--green-lt);padding:2px 7px;border-radius:8px;">✅ Disponible</span>'
            : '<span style="font-size:10px;font-weight:800;color:#fff;background:#D63A2A;padding:3px 9px;border-radius:8px;letter-spacing:.5px;">AGOTADO</span>'
          )
        + '<button class="btn-sm" style="font-size:10px;padding:3px 8px;background:' + (p.disponible?'#f0f0f0':'var(--green-lt)') + ';color:' + (p.disponible?'#666':'var(--green-dk)') + ';" onclick="event.stopPropagation();toggleDisp(\'' + p._id + '\')">'
        + (p.disponible?'Agotado':'Activar') + '</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('') + '</div>';

    return '<div class="sec-lbl" style="padding-top:12px;">' + emoji + ' ' + cat + '</div>' + items;
  }).join('');
}

function filtrarMenu(cat) {
  _rMenuCat = cat;
  // Limpiar buscador al cambiar categoría
  var si = document.getElementById('menu-search-inp');
  if (si) si.value = '';
  var sc = document.getElementById('menu-search-clear');
  if (sc) sc.style.display = 'none';
  _rMenuBusq = '';
  _renderMenuRest();
}

var _rMenuBusq = '';
function filtrarMenuBusqueda(q) {
  _rMenuBusq = (q || '').trim().toLowerCase();
  var cl = document.getElementById('menu-search-clear');
  if (cl) cl.style.display = _rMenuBusq ? 'block' : 'none';
  _renderMenuRestFiltrado();
}

function _renderMenuRestFiltrado() {
  var cont   = document.getElementById('menu-cont');
  var subEl  = document.getElementById('menu-sub');
  if (!cont) return;

  var q = _rMenuBusq;
  // Si no hay búsqueda, render normal
  if (!q) { _renderMenuRest(); return; }

  // Filtrar por nombre o categoría
  var lista = _vrMenu().filter(function(p){
    return (p.nombre||'').toLowerCase().indexOf(q) !== -1
        || (p.categoria||'').toLowerCase().indexOf(q) !== -1;
  });

  if (subEl) subEl.textContent = lista.length + ' resultado' + (lista.length!==1?'s':'');

  if (!lista.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-ic">🔎</div>'
      + '<div class="empty-tit">Sin resultados</div>'
      + '<div class="empty-sub">Intenta con otro término</div></div>';
    return;
  }

  // Agrupar por categoría (mismo render que _renderMenuRest)
  var grupos = {};
  lista.forEach(function(p){
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  var colores = ['#FFF0E8','#E8F5EE','#E8F0F8','#FFF8E1','#F0EBF8','#F5F0E8','#E8FAFF'];
  cont.innerHTML = Object.keys(grupos).map(function(cat){
    var emoji = _catEmoji(cat);
    var colorIdx = Math.abs(cat.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0)) % colores.length;
    var bg = colores[colorIdx];
    var items = '<div class="menu-grid">' + grupos[cat].map(function(p){
      var agotadoOverlay = p.disponible ? '' : '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(214,58,42,.85);color:#fff;font-size:11px;font-weight:800;padding:4px 0;text-align:center;letter-spacing:.5px;">AGOTADO</div>';
      var imgContent;
      if (p.foto && p.foto !== 'mock' && p.foto.indexOf('data:image') === 0) {
        imgContent = '<div class="menu-pcard-img" style="background:#f0f0f0;padding:0;">'
          + '<img src="' + p.foto + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px 10px 0 0;" alt="' + p.nombre + '">'
          + agotadoOverlay + '</div>';
      } else {
        imgContent = '<div class="menu-pcard-img" style="background:' + bg + ';">'
          + emoji + '<div class="menu-pcard-img-inner"></div>' + agotadoOverlay + '</div>';
      }
      var cardBorder = p.disponible ? 'border:.5px solid rgba(31,194,106,.25);' : 'border:1.5px solid rgba(214,58,42,.3);';
      return '<div class="menu-pcard' + (p.disponible?'':' agotado') + '" style="' + cardBorder + '" onclick="abrirFormProd(\'' + p._id + '\')">'
        + imgContent
        + '<div class="menu-pcard-body">'
        + '<div class="menu-pcard-nombre">' + p.nombre + '</div>'
        + '<div class="menu-pcard-precio"' + (p.disponible?'':' style="color:#bbb;"') + '>$' + p.precio + '</div>'
        + '<div class="menu-pcard-footer">'
        + (p.disponible
            ? '<span style="font-size:9px;font-weight:700;color:var(--green-dk);background:var(--green-lt);padding:2px 7px;border-radius:8px;">✅ Disponible</span>'
            : '<span style="font-size:10px;font-weight:800;color:#fff;background:#D63A2A;padding:3px 9px;border-radius:8px;letter-spacing:.5px;">AGOTADO</span>'
          )
        + '<button class="btn-sm" style="font-size:10px;padding:3px 8px;background:' + (p.disponible?'#f0f0f0':'var(--green-lt)') + ';color:' + (p.disponible?'#666':'var(--green-dk)') + ';" onclick="event.stopPropagation();toggleDisp(\'' + p._id + '\')">'
        + (p.disponible?'Agotado':'Activar') + '</button>'
        + '</div></div></div>';
    }).join('') + '</div>';
    return '<div class="sec-lbl" style="padding-top:12px;">' + emoji + ' ' + cat + '</div>' + items;
  }).join('');
}

function crearCategoria() {
  window._dcPedirTexto('Nueva categoría', 'Nombre de la categoría', function(nombre) {
    // Verificar que no exista ya
    var exists = _vrMenu().some(function(p){ return p.categoria === nombre; });
    if (exists) { toast('⚠️ Esa categoría ya existe'); return; }

    if (_vrIsD()) {
      // Demo: agregar en _vrMenuCache
      _vrMenuCache.push({_id:'cat_ph_'+Date.now(),nombre:'(Ejemplo — edita o elimina)',categoria:nombre,descripcion:'',precio:0,disponible:true,_esPlaceholder:true});
      _rMenuCat = nombre; _renderMenuRest();
      toast('✅ Categoría "' + nombre + '" creada — agrega tus productos');
    } else {
      // Firebase: crear producto placeholder para que la categoría quede visible
      (async function(){
        var uid=_vrUid(); var db=_vrDb(); if(!uid||!db){toast('⚠️ Sin sesión'); return;}
        try {
          var f=await _vrFb();
          var cs=await f.getDocs(f.collection(db,'menu',uid,'productos'));
          await f.addDoc(f.collection(db,'menu',uid,'productos'),{nombre:'(Ejemplo — edita o elimina)',categoria:nombre,descripcion:'',precio:0,disponible:true,_esPlaceholder:true,orden:cs.size,creado:Date.now()});
          _rMenuCat=nombre;
          await _vrCargarMenu(); _renderMenuRest();
          toast('✅ Categoría "'+nombre+'" creada — agrega tus productos');
        } catch(e){ toast('⚠️ Error: '+e.message); }
      })();
    }
  });
}

// Crear categoría nueva desde el select del formulario de producto
// Reutiliza EXACTAMENTE la misma fuente y lógica que crearCategoria()
function _pfCatNueva(catSel) {
  catSel.value = ''; // resetear mientras espera al usuario
  window._dcPedirTexto('Nueva categoría', 'Nombre de la categoría', function(nombre) {
    // Validar duplicado
    var exists = _vrMenu().some(function(p){ return p.categoria === nombre; });
    if (exists) {
      toast('⚠️ Esa categoría ya existe — quedará seleccionada');
      _pfCatRecargar(catSel, nombre);
      return;
    }
    // Guardar usando la misma lógica que crearCategoria()
    if (_vrIsD()) {
      _vrMenuCache.push({_id:'cat_ph_'+Date.now(),nombre:'(Ejemplo — edita o elimina)',categoria:nombre,descripcion:'',precio:0,disponible:true,_esPlaceholder:true});
      _pfCatRecargar(catSel, nombre);
      toast('✅ Categoría "'+nombre+'" creada');
    } else {
      (async function(){
        var uid=_vrUid(); var db=_vrDb(); if(!uid||!db){ toast('⚠️ Sin sesión'); catSel.value=''; return; }
        try {
          var f=await _vrFb();
          var cs=await f.getDocs(f.collection(db,'menu',uid,'productos'));
          await f.addDoc(f.collection(db,'menu',uid,'productos'),{nombre:'(Ejemplo — edita o elimina)',categoria:nombre,descripcion:'',precio:0,disponible:true,_esPlaceholder:true,orden:cs.size,creado:Date.now()});
          await _vrCargarMenu();
          _pfCatRecargar(catSel, nombre);
          toast('✅ Categoría "'+nombre+'" creada');
        } catch(e){ toast('⚠️ Error: '+e.message); catSel.value=''; }
      })();
    }
  }, function() {
    catSel.value = ''; // canceló — dejar select en blanco
  });
}

// Recarga las opciones del select pf-cat desde _vrMenu() y selecciona la categoría indicada
function _pfCatRecargar(catSel, seleccionar) {
  var cats = [];
  _vrMenu().forEach(function(p){ if (cats.indexOf(p.categoria) === -1) cats.push(p.categoria); });
  catSel.innerHTML = '<option value="">— Selecciona categoría —</option>'
    + cats.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('')
    + '<option value="__nueva__" style="color:var(--green);font-weight:700;">＋ Agregar nueva categoría</option>';
  catSel.onchange = function() { if (catSel.value === '__nueva__') _pfCatNueva(catSel); };
  if (seleccionar) catSel.value = seleccionar;
}

function eliminarCategoria(nombre) {
  // Verificar si tiene productos reales (excluyendo placeholders)
  var prods = _vrMenu().filter(function(p){ return p.categoria === nombre && !p._esPlaceholder; });
  if (prods.length > 0) {
    toast('⚠️ Primero elimina o mueve los productos de esta categoría.');
    return;
  }
  window._dcConfirmar('¿Eliminar la categoría "' + nombre + '"?', function() {
    if (_vrIsD()) {
      // Demo: eliminar del _vrMenuCache
      var idx = _vrMenuCache.findIndex(function(p){ return p.categoria === nombre; });
      if (idx !== -1) _vrMenuCache.splice(idx, 1);
      if (_rMenuCat === nombre) _rMenuCat = 'todos';
      _renderMenuRest();
      toast('🗑 Categoría "' + nombre + '" eliminada');
    } else {
      // Firebase: eliminar placeholder(s) de esa categoría
      (async function(){
        var uid=_vrUid(); var db=_vrDb(); if(!uid||!db){toast('⚠️ Sin sesión'); return;}
        try {
          var f=await _vrFb();
          var snap=await f.getDocs(f.collection(db,'menu',uid,'productos'));
          var batch=f.writeBatch(db);
          snap.forEach(function(d){
            if(d.data().categoria===nombre && d.data()._esPlaceholder) batch.delete(d.ref);
          });
          await batch.commit();
          if (_rMenuCat === nombre) _rMenuCat = 'todos';
          await _vrCargarMenu(); _renderMenuRest();
          toast('🗑 Categoría "' + nombre + '" eliminada');
        } catch(e){ toast('⚠️ Error: '+e.message); }
      })();
    }
  });
}

function toggleDisp(pid) {
  var p = _vrMenu().find(function(x){ return x._id===pid; });
  if (!p) return;
  var nuevoVal = !p.disponible;
  if (_vrIsD()) {
    p.disponible = nuevoVal;
    toast((nuevoVal?'✅ ':'⛔ ') + p.nombre + ' — ' + (nuevoVal?'disponible':'agotado'));
    _renderMenuRest();
  } else {
    (async function(){
      var uid=_vrUid(); var db=_vrDb(); if(!uid||!db) return;
      try {
        var f=await _vrFb();
        await f.setDoc(f.doc(db,'menu',uid,'productos',pid),{disponible:nuevoVal},{merge:true});
        p.disponible=nuevoVal; // actualizar cache inmediatamente
        toast((nuevoVal?'✅ ':'⛔ ') + p.nombre + ' — ' + (nuevoVal?'disponible':'agotado'));
        _renderMenuRest();
      } catch(e){ toast('⚠️ Error: '+e.message); }
    })();
  }
}

/* ═══════════════════════════════════════════════════════
   FORM PRODUCTO
═══════════════════════════════════════════════════════ */
function abrirFormProd(pid) {
  document.getElementById('rf-pform-id').value = pid || '';
  document.getElementById('rf-pform-titulo').textContent = pid ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('pf-err').style.display = 'none';
  var delBtn = document.getElementById('pf-del-btn');

  // Poblar select de categorías con las existentes en el menú
  var catSel = document.getElementById('pf-cat');
  if (catSel) {
    var cats = [];
    _vrMenu().forEach(function(p){ if (p && p.categoria && cats.indexOf(p.categoria) === -1) cats.push(p.categoria); });
    if (!cats.length) cats = ['General'];
    catSel.innerHTML = '<option value="">— Selecciona categoría —</option>'
      + cats.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('')
      + '<option value="__nueva__" style="color:var(--green);font-weight:700;">＋ Agregar nueva categoría</option>';
    // Detectar selección de "nueva categoría"
    catSel.onchange = function() {
      if (catSel.value === '__nueva__') _pfCatNueva(catSel);
    };
  }

  if (pid) {
    var p = _vrMenu().find(function(x){ return x._id===pid; });
    // Si el nombre es el texto placeholder interno, dejar el campo vacío
    var nomVal = (p && p.nombre && p.nombre !== '(Ejemplo — edita o elimina)') ? p.nombre : '';
    document.getElementById('pf-nombre').value = nomVal;
    if (catSel) catSel.value = p?p.categoria:'';
    document.getElementById('pf-desc').value   = p?p.descripcion:'';
    document.getElementById('pf-precio').value = p?p.precio:'';
    _rPfDisp = p ? p.disponible : true;
    // Cargar foto: solo si es base64 real; ignorar valor 'mock' legacy
    _rPfFoto = (p && p.foto && p.foto !== 'mock' && p.foto.indexOf('data:image') === 0) ? p.foto : null;
    delBtn.style.display = 'block';
  } else {
    document.getElementById('pf-nombre').value='';
    if (catSel) catSel.value = (catSel.options && catSel.options.length === 3 && catSel.options[1] ? catSel.options[1].value : '');
    document.getElementById('pf-desc').value='';
    document.getElementById('pf-precio').value='';
    _rPfDisp = true;
    _rPfFoto = null;
    delBtn.style.display = 'none';
  }
  // Limpiar input de archivo al abrir el form
  var fileInp = document.getElementById('pf-file-input');
  if (fileInp) fileInp.value = '';
  var tog = document.getElementById('pf-toggle');
  if (tog) tog.className = 'toggle' + (_rPfDisp?' on':'');
  _renderFotoUI();
  try { _rNavStack = ['vr-home','vr-menu']; } catch(e) {}

  // Navegación directa al form: stack siempre queda [..., vr-menu]
  // NO reseteamos _rMenuCat aquí — excepción operativa documentada
  var _vrShell = document.getElementById('vr-shell');
  var cur = _vrShell ? _vrShell.querySelector('.view.active') : document.querySelector('#vr-shell .view.active');
  var nxt = document.getElementById('vr-prod-form');
  if (!cur || !nxt || cur === nxt) return;
  _resetScroll('vr-prod-form');
  nxt.style.transform = 'translateX(100%)';
  nxt.style.opacity   = '0';
  nxt.classList.add('active');
  cur.classList.add('anim-out');
  requestAnimationFrame(function(){
    nxt.classList.add('anim-in');
    nxt.style.transform = 'translateX(0)';
    nxt.style.opacity   = '1';
    cur.style.transform  = 'translateX(-30%)';
    cur.style.opacity    = '0';
  });
  setTimeout(function(){
    cur.classList.remove('active','anim-out');
    cur.style.cssText = '';
    nxt.classList.remove('anim-in');
    nxt.style.cssText = '';
  }, 320);
  var stackTop = _rNavStack[_rNavStack.length - 1];
  if (stackTop !== 'vr-menu') _rNavStack.push('vr-menu');
}

/* ── Gestión de foto de producto — fotografías reales ── */
// _rPfFoto: null | string base64 (dataURL de la imagen real seleccionada)

function _renderFotoUI() {
  var wrap = document.getElementById('pf-foto-wrap');
  if (!wrap) return;
  if (_rPfFoto && _rPfFoto !== 'mock') {
    // Foto real: mostrar imagen + botones cambiar/eliminar
    wrap.innerHTML = '<div style="width:100%;height:150px;border-radius:14px;overflow:hidden;'
      + 'position:relative;border:.5px solid var(--border);margin-bottom:6px;">'
      + '<img src="' + _rPfFoto + '" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Foto del producto">'
      + '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);'
      + 'padding:7px;display:flex;gap:6px;justify-content:center;">'
      + '<button onclick="tapFoto()" style="flex:1;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);'
      + 'color:#fff;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">📷 Cambiar</button>'
      + '<button onclick="eliminarFoto()" style="flex:1;background:rgba(214,58,42,.45);border:1px solid rgba(255,255,255,.2);'
      + 'color:#fff;border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">🗑 Eliminar</button>'
      + '</div></div>';
  } else {
    // Sin foto: placeholder con instrucción
    wrap.innerHTML = '<div class="prod-img-ph" onclick="tapFoto()">📷<span>Toca para agregar foto</span></div>';
  }
}

function tapFoto() {
  // Abre el selector de archivos real del sistema y asegura el onchange en móviles
  var inp = document.getElementById('pf-file-input');
  if (!inp) { toast('⚠️ No se encontró el selector de foto'); return; }
  inp.onchange = function(){ onFotoSeleccionada(this); };
  inp.value = '';
  inp.click();
}

function onFotoSeleccionada(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  if (!file.type || !file.type.match(/^image\//)) {
    toast('⚠️ Solo se aceptan imágenes');
    return;
  }
  // Limit size ~5MB
  if (file.size > 5 * 1024 * 1024) {
    toast('⚠️ Imagen demasiado grande (máx 5 MB)');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var dataUrl = e && e.target && e.target.result;
    if (!dataUrl || String(dataUrl).indexOf('data:image') !== 0) {
      toast('⚠️ No se pudo leer la imagen');
      return;
    }
    _rPfFoto = dataUrl; // base64 dataURL
    _renderFotoUI();
    toast('📷 Foto cargada');
  };
  reader.onerror = function() {
    toast('⚠️ Error al leer la imagen');
  };
  reader.readAsDataURL(file);
}
window.tapFoto = tapFoto;
window.onFotoSeleccionada = onFotoSeleccionada;

function eliminarFoto() {
  _rPfFoto = null;
  var inp = document.getElementById('pf-file-input');
  if (inp) inp.value = '';
  _renderFotoUI();
  toast('🗑 Foto eliminada');
}
function togglePfDisp() {
  _rPfDisp = !_rPfDisp;
  var tog = document.getElementById('pf-toggle');
  if (tog) tog.className = 'toggle' + (_rPfDisp?' on':'');
}

function guardarProducto() {
  window._dirtyView = null;
  var nombre = window.dcCleanText(document.getElementById('pf-nombre').value, 80);
  var cat    = window.dcCleanText(document.getElementById('pf-cat').value, 40);
  var precio = parseFloat(document.getElementById('pf-precio').value)||0;
  var desc   = window.dcCleanText(document.getElementById('pf-desc').value, 500);
  var pid    = document.getElementById('rf-pform-id').value.trim();
  var err    = document.getElementById('pf-err');

  if (!nombre||!cat||precio<=0||!_rPfFoto) {
    err.textContent = '⚠️ Nombre, categoría, precio y foto son obligatorios.';
    err.style.display='block'; return;
  }
  err.style.display = 'none';

  if (_vrIsD()) {
    // Demo: mutar _vrMenuCache
    if (pid) {
      var p = _vrMenuCache.find(function(x){ return x._id===pid; });
      if (p) { p.nombre=nombre; p.categoria=cat; p.descripcion=desc; p.precio=precio; p.disponible=_rPfDisp; p.foto=_rPfFoto; }
      toast('✅ Producto actualizado');
    } else {
      _vrMenuCache.push({_id:'p_'+Date.now(),nombre:nombre,categoria:cat,descripcion:desc,precio:precio,disponible:_rPfDisp,foto:_rPfFoto});
      _rMenuCat = cat;
      toast('✅ Producto agregado al menú');
    }
    _renderMenuRest();
    if(window._showOverlay){
      window._showOverlay({f1tit:'Guardando producto...',f1sub:'Actualizando Mi Menú.',f2tit:'¡Producto guardado!',f2sub:'Tu producto ya aparece en Mi Menú.',onDone:function(){ window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }});
    } else { window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }
    return;
  }

  // Firebase: guardar en menu/{uid}/productos
  var uid=_vrUid(); var db=_vrDb(); if(!uid||!db){ toast('⚠️ Sin sesión'); return; }
  (async function(){
    try {
      var f=await _vrFb();
      var data={nombre:nombre,categoria:cat,categoriaPublica:cat,descripcion:desc,descripcionPublica:desc,precio:precio,disponible:_rPfDisp,foto:_rPfFoto||null,fotoProducto:_rPfFoto||null,actualizado:Date.now()};
      if (pid) {
        await f.setDoc(f.doc(db,'menu',uid,'productos',pid),data,{merge:true});
        toast('✅ Producto actualizado');
      } else {
        var cs=await f.getDocs(f.collection(db,'menu',uid,'productos'));
        data.orden=cs.size; data.creado=Date.now();
        await f.addDoc(f.collection(db,'menu',uid,'productos'),data);
        _rMenuCat=cat;
        toast('✅ Producto agregado al menú');
      }
      await _vrCargarMenu();
      _renderMenuRest();
      if(window._showOverlay){
        window._showOverlay({f1tit:'Guardando producto...',f1sub:'Actualizando Mi Menú.',f2tit:'¡Producto guardado!',f2sub:'Tu producto ya aparece en Mi Menú.',onDone:function(){ window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }});
      } else { window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }
    } catch(e){ if(err){err.textContent='⚠️ Error: '+e.message;err.style.display='block';} }
  })();
}

function eliminarProducto() {
  var pid = document.getElementById('rf-pform-id').value.trim();
  if (!pid) return;

  if (_vrIsD()) {
    var idx = _vrMenuCache.findIndex(function(x){ return x._id===pid; });
    if (idx!==-1) _vrMenuCache.splice(idx,1);
    toast('🗑 Producto eliminado');
    navTo('vr-menu');
    return;
  }

  // Firebase: borrar en menu/{uid}/productos/{pid}
  var uid=_vrUid(); var db=_vrDb(); if(!uid||!db){ toast('⚠️ Sin sesión'); return; }
  (async function(){
    try {
      var f=await _vrFb();
      await f.deleteDoc(f.doc(db,'menu',uid,'productos',pid));
      toast('🗑 Producto eliminado');
      await _vrCargarMenu();
      _renderMenuRest();
      if(window._showOverlay){
        window._showOverlay({f1tit:'Guardando producto...',f1sub:'Actualizando Mi Menú.',f2tit:'¡Producto guardado!',f2sub:'Tu producto ya aparece en Mi Menú.',onDone:function(){ window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }});
      } else { window.dcRestGoMenuAfterSave&&window.dcRestGoMenuAfterSave(); }
    } catch(e){ toast('⚠️ Error al eliminar: '+e.message); }
  })();
}

/* ═══════════════════════════════════════════════════════
   NOTIFICACIONES
═══════════════════════════════════════════════════════ */
function _renderNotif() {
  var cont  = document.getElementById('notif-cont');
  var subEl = document.getElementById('notif-sub');
  var sinLeer = _vrNotifsCache.filter(function(n){ return !n.leida; }).length;
  if (subEl) subEl.textContent = sinLeer>0 ? sinLeer+' sin leer' : 'Todo al día';

  // Marcar como leídas al abrir
  _vrNotifsCache.forEach(function(n){ n.leida=true; });
  var nbNot = document.getElementById('nav-badge-notif');
  var qiNot = document.getElementById('qi-badge-notif');
  if (nbNot) nbNot.style.display='none';
  if (qiNot) qiNot.style.display='none';

  if (!_vrNotifsCache.length) {
    cont.innerHTML='<div class="empty"><div class="empty-ic">🔔</div><div class="empty-tit">Sin notificaciones</div></div>';
    return;
  }
  var TIPOS_IC = {membresia:'🏷️', promo:'📣', pago:'💳', sistema:'⚙️', dc:'🏘️', info:'⭐'};
  cont.innerHTML = _vrNotifsCache.map(function(n){
    var t = new Date(n.ts);
    var ts = t.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) + ' · ' + t.toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
    return '<div class="notif-item">'
      + (n.leida?'':'<div class="notif-unread"></div>')
      + '<div class="notif-ic">' + (TIPOS_IC[n.tipo]||'🔔') + '</div>'
      + '<div style="flex:1;">'
      + '<div class="notif-tit">' + n.titulo + '</div>'
      + '<div class="notif-msg">' + n.mensaje + '</div>'
      + '<div class="notif-time">' + ts + '</div>'
      + '</div></div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════ */
function _initConfig() {
  window._dirtyView = null;
  window._cfgEstadoPend = null;
  window._cfgEstadoPendTocado = false;
  try { window._cfgSnapHor = JSON.stringify(HORARIOS); } catch(e){}
  var sel = document.getElementById('cfg-est-sel');
  // El SELECT muestra el estado manual guardado; si el horario fuerza cerrado, muestra cerrado.
  var estEnSel = (typeof _rEstadoOp !== 'undefined' ? _rEstadoOp : 'activo') || 'activo';
  if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(HORARIOS)) estEnSel = 'cerrado';
  if (sel) sel.value = estEnSel;
  _syncEstadoCfgUI(estEnSel);
  _renderHorarios();
}

function cfgPreviewEstado(val) {
  // Si el horario predeterminado fuerza cerrado, bloquear cambio y mostrar aviso
  if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(HORARIOS)) {
    // Resetear el select al valor actual (no dejar el cambio visualmente)
    var _sel = document.getElementById('cfg-est-sel');
    if (_sel) _sel.value = 'cerrado';
    // Limpiar dirty para que el timer pueda sincronizar el select al abrir
    window._dirtyView = null;
    // Mostrar popup de aviso fuera de horario
    var _ovId = 'dcFueraHorarioOv';
    if (!document.getElementById(_ovId)) {
      var _ov = document.createElement('div');
      _ov.id = _ovId;
      _ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
      _ov.innerHTML = '<div style="background:#fff;border-radius:22px;padding:28px 24px;max-width:300px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.3);">'
        + '<div style="font-size:40px;margin-bottom:12px;">🕐</div>'
        + '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;">Fuera de horario laboral</div>'
        + '<div style="font-size:13px;color:#666;line-height:1.5;margin-bottom:22px;">Actualmente estás fuera de tu horario laboral.<br>No se pueden cambiar estados.</div>'
        + '<button onclick="var e=document.getElementById(\'dcFueraHorarioOv\');if(e)e.remove();" style="width:100%;padding:13px;background:#D63A2A;color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Aceptar</button>'
        + '</div>';
      document.body.appendChild(_ov);
    }
    return;
  }
  // Solo vista previa — NO guarda nada; el guardado ocurre con el botón Guardar
  window._cfgEstadoPendTocado = true;
  window._cfgEstadoPend = val;
  _syncEstadoCfgUI(val);
  _marcarSucio('vr-config');
}
function cambiarEstadoOp(val) {
  _rEstadoOp = val;
  _rEstadoOpTs = Date.now();
  localStorage.setItem('dcRestOpV2', val);
  localStorage.setItem('dcRestOpV2Ts', String(_rEstadoOpTs));
  // Sincronizar con la llave del index
  try { (function(){ var _uS=_vrUid(); if(_uS){ localStorage.setItem('dcuserEstadoOp_'+_uS, val); localStorage.setItem('dcuserEstadoOpTs_'+_uS, String(_rEstadoOpTs)); } })(); } catch(e){}
  _syncEstadoCfgUI(val);
  toast('Estado: ' + DC_ESTADOS[val].ic + ' ' + DC_ESTADOS[val].lbl.charAt(0) + DC_ESTADOS[val].lbl.slice(1).toLowerCase());
  // Centro Operativo — home estado dot/lbl
  var dot  = document.getElementById('home-estado-dot');
  var lbl_ = document.getElementById('home-estado-lbl');
  var cfg  = DC_ESTADOS[val] || DC_ESTADOS.activo;
  if (dot)  dot.className = 'estado-dot ' + cfg.dotEl;
  if (lbl_) lbl_.textContent = cfg.lbl;
  // Index: Mi Panel y home-estado-op
  if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(val);
  // Persistir en Firestore para que el vecino vea el estado real
  (async function(){
    var uid=_vrUid(); var db=_vrDb(); if(!uid||!db) return;
    try {
      var f=await _vrFb();
      await f.setDoc(f.doc(db,'usuarios',uid),{estadoOp:val, estadoOpTs:_rEstadoOpTs},{merge:true});
    } catch(e) { }
  })();
}

function _syncEstadoCfgUI(val) {
  var cfg  = DC_ESTADOS[val] || DC_ESTADOS.activo;
  var tit  = document.getElementById('cfg-est-tit');
  var desc = document.getElementById('cfg-est-desc');
  var dot  = document.getElementById('cfg-est-dot');
  if (tit)  tit.textContent  = cfg.ic + ' ' + cfg.lbl.charAt(0) + cfg.lbl.slice(1).toLowerCase();
  if (desc) { desc.textContent = cfg.desc; desc.style.color = cfg.col; }
  if (dot)  dot.style.background = cfg.col;
}

// Horarios
var HORARIOS = [
  {id:'lun', dia:'Lunes',    abre:'08:00', cierra:'22:00', abierto:true },
  {id:'mar', dia:'Martes',   abre:'08:00', cierra:'22:00', abierto:true },
  {id:'mie', dia:'Miércoles',abre:'08:00', cierra:'22:00', abierto:true },
  {id:'jue', dia:'Jueves',   abre:'08:00', cierra:'22:00', abierto:true },
  {id:'vie', dia:'Viernes',  abre:'08:00', cierra:'23:00', abierto:true },
  {id:'sab', dia:'Sábado',   abre:'09:00', cierra:'23:00', abierto:true },
  {id:'dom', dia:'Domingo',  abre:'10:00', cierra:'20:00', abierto:false},
];

// Opciones de hora en steps de 30 min
function _horasOpts(sel) {
  var opts = '';
  for (var h=6; h<=24; h++) {
    ['00','30'].forEach(function(m){
      if (h===24 && m==='30') return;
      var v = String(h).padStart(2,'0') + ':' + m;
      opts += '<option value="' + v + '"' + (v===sel?' selected':'') + '>' + v + '</option>';
    });
  }
  return opts;
}

function _renderHorarios() {
  var wrap = document.getElementById('horarios-wrap');
  if (!wrap) return;
  wrap.innerHTML = HORARIOS.map(function(h){
    return '<div class="hor-row" id="hor-' + h.id + '">'
      + '<div style="display:flex;align-items:center;gap:6px;width:80px;flex-shrink:0;">'
      + '<div class="toggle' + (h.abierto?' on':'') + '" onclick="toggleDia(\'' + h.id + '\')"></div>'
      + '<span class="hor-dia" style="font-size:11px;width:auto;">' + h.dia.slice(0,3) + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:4px;flex:1;justify-content:flex-end;"' + (h.abierto?'':'style="opacity:.35;pointer-events:none;"') + '>'
      + '<select class="inp-sel" style="padding:5px 6px;font-size:11px;width:68px;font-family:\'DM Mono\',monospace;" onchange="cambiarHora(\'' + h.id + '\',\'abre\',this.value)">' + _horasOpts(h.abre) + '</select>'
      + '<span style="font-size:10px;color:var(--tx4);">–</span>'
      + '<select class="inp-sel" style="padding:5px 6px;font-size:11px;width:68px;font-family:\'DM Mono\',monospace;" onchange="cambiarHora(\'' + h.id + '\',\'cierra\',this.value)">' + _horasOpts(h.cierra) + '</select>'
      + '</div>'
      + '</div>';
  }).join('');
}

function toggleDia(diaId) {
  _marcarSucio('vr-config');
  var h = HORARIOS.find(function(x){ return x.id===diaId; });
  if (!h) return;
  h.abierto = !h.abierto;
  _renderHorarios();
  toast(h.dia + ': ' + (h.abierto ? '✅ Abierto' : '🔴 Cerrado'));
}

function cambiarHora(diaId, campo, val) {
  var h = HORARIOS.find(function(x){ return x.id===diaId; });
  if (!h) return;
  h[campo] = val;
  toast(h.dia + ' ' + (campo==='abre'?'abre':'cierra') + ' a las ' + val);
}

function aplicarHorarioATodos() {
  var luv = HORARIOS[0];
  HORARIOS.forEach(function(h){ h.abre = luv.abre; h.cierra = luv.cierra; });
  _renderHorarios();
  toast('✅ Horario del Lunes (' + luv.abre + ' – ' + luv.cierra + ') aplicado a todos los días');
}

var _rCfgConfirmTimer; // conservado — código muerto desde el cambio a overlay, documentado
function guardarConfig() {
  window._dirtyView = null;
  // Si el usuario modificó horarios y el horario laboral está abierto,
  // no arrastrar estados manuales viejos (cerrado/pausado/ocupado) desde antes del cambio.
  // Solo se respeta manual si el usuario tocó explícitamente el selector de estado.
  if (!window._cfgEstadoPendTocado && window._horarioFuerzaCerrado && !window._horarioFuerzaCerrado(HORARIOS)) {
    window._cfgEstadoPend = 'activo';
  }
  // Protección E8: si el horario fuerza cerrado y el usuario guardó sin cambiar el select,
  // no grabar "cerrado" como estado manual — preservar el estado manual anterior
  if (window._cfgEstadoPend === 'cerrado' && window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(HORARIOS)) {
    window._cfgEstadoPend = (_rEstadoOp && _rEstadoOp !== 'cerrado') ? _rEstadoOp : 'activo';
  }
  if (window._cfgEstadoPend) { cambiarEstadoOp(window._cfgEstadoPend); window._cfgEstadoPend = null; }
  // Actualizar timestamp del estado al guardar — asegura que el horario pueda retomar control correctamente
  if (!_rEstadoOpTs) { _rEstadoOpTs = Date.now(); localStorage.setItem('dcRestOpV2Ts', String(_rEstadoOpTs)); }
  window._cfgSnapHor = JSON.stringify(HORARIOS);
  localStorage.setItem('dcRestOpV2', _rEstadoOp);
  // Persistir horarios y estado en Firestore — fuente para cálculo automático
  if (!_vrIsD()) {
    (async function(){
      var uid=_vrUid(); var db=_vrDb(); if(!uid||!db) return;
      try {
        var f=await _vrFb();
        // Serializar HORARIOS como array limpio (sin funciones)
        var hSer = HORARIOS.map(function(h){
          return {id:h.id, dia:h.dia, abre:h.abre, cierra:h.cierra, abierto:h.abierto};
        });
        await f.setDoc(f.doc(db,'usuarios',uid),{estadoOp:_rEstadoOp, estadoOpTs:(_rEstadoOpTs||Date.now()), horarios:hSer},{merge:true});
      } catch(e) { }
    })();
  }
  _showOverlay({
    f1tit: 'Guardando cambios...',
    f1sub: 'Actualizando tu restaurante.',
    f2tit: 'Configuración guardada',
    f2sub: 'Tus cambios están activos.',
    onDone: function() {
      // Badge vr-home: usa estado efectivo (horario + manual)
      var _ef = _estadoEfectivo();
      // Actualizar tarjeta de estado en v-home (la grande clicable)
      if (window.renderHomeM2) window.renderHomeM2();
      var _cfg = DC_ESTADOS[_ef] || DC_ESTADOS.activo;
      var _dot = document.getElementById('home-estado-dot');
      var _lbl = document.getElementById('home-estado-lbl');
      if (_dot) { _dot.className = 'estado-dot ' + _cfg.dotEl; }
      if (_lbl) _lbl.textContent = _cfg.lbl;
      // Config select: muestra el estado manual guardado
      var _selEst = (typeof _rEstadoOp !== 'undefined' ? _rEstadoOp : 'activo') || 'activo';
      if (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(HORARIOS)) _selEst = 'cerrado';
      var _sel = document.getElementById('cfg-est-sel');
      if (_sel) _sel.value = _selEst;
      _syncEstadoCfgUI(_selEst);
      if (window.dcPintarEstado) window.dcPintarEstado();
      if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(_rEstadoOp);
      dcRest_navTo('vr-home', true);
    }
  });
}
function togglePago(tipo) {
  _marcarSucio('vr-config');
  _rPagos[tipo] = !_rPagos[tipo];
  var el = document.getElementById('pg-' + tipo);
  if (!el) return;
  el.classList.toggle('on', _rPagos[tipo]);
  var nombres = {efectivo:'Efectivo', transf:'Transferencia', tarjeta:'Tarjeta'};
  toast((nombres[tipo]||tipo) + ': ' + (_rPagos[tipo] ? '✅ Activo' : '⏸️ Desactivado'));
}

function toggleNotif(tipo) {
  var el = document.getElementById('nt-' + tipo);
  if (!el) return;
  el.classList.toggle('on');
  toast('Notif. ' + tipo + ': ' + (el.classList.contains('on') ? '🔔 Activadas' : '🔕 Desactivadas'));
}

/* ═══════════════════════════════════════════════════════
   CÓMO ME VEN LOS CLIENTES — CMV
   Lee/escribe en usuarios/{uid} los datos públicos del restaurante
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   VN-CMV — Cómo me ve el cliente para NEGOCIO
   Copia funcional del flujo Restaurante, con IDs propios.
   No toca vr-cmv ni Configuración.
═══════════════════════════════════════════════════════ */
var _vnCmvFotoData = null;
var _vnCmvFotoNueva = null;
var _vnCmvFotoExistente = null;

function vnegCmvFotoChange(inp) {
  var file = inp && inp.files && inp.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { toast('⚠️ Imagen demasiado grande (máx 1 MB)'); inp.value=''; return; }
  var rd = new FileReader();
  rd.onload = function(e){
    _vnCmvFotoNueva = e.target.result;
    _vnCmvFotoData = _vnCmvFotoNueva;
    var fprev = document.getElementById('vn-cmv-foto-prev');
    if (fprev) fprev.innerHTML = '<img src="'+_vnCmvFotoData+'" style="width:100%;height:100%;object-fit:cover;">';
    vnegCmvRenderPreview();
    window._dirtyView = 'vn-cmv';
  };
  rd.readAsDataURL(file);
}

function vnegCmvRenderPreview() {
  var prev = document.getElementById('vn-cmv-preview'); if (!prev) return;
  var nombre = window.dcCleanText((document.getElementById('vn-cmv-nombre')||{}).value || 'Mi Negocio', 70);
  var desc   = window.dcCleanText((document.getElementById('vn-cmv-desc')||{}).value || 'Productos y servicios para la comunidad', 140);
  var cat    = window.dcCleanText((document.getElementById('vn-cmv-cat')||{}).value || 'tienda', 40);
  var selVal = (document.getElementById('vn-cmv-estado')||{}).value || 'activo';
  var manual = window._normEstadoOp ? window._normEstadoOp(_vnegEstadoOp || 'activo') : (_vnegEstadoOp || 'activo');
  var estOp = manual;
  if (window._estadoEfectivoDe) { try { estOp = window._estadoEfectivoDe(manual, _vnegEstadoOpTs || 0, VNEG_HORARIOS); } catch(e){} }
  if (selVal && selVal !== 'activo') estOp = selVal;
  if (selVal === 'activo') estOp = (window._horarioFuerzaCerrado && window._horarioFuerzaCerrado(VNEG_HORARIOS)) ? 'cerrado' : 'activo';
  var EMOJIS = {tienda:'🏪',abarrotes:'🛒',belleza:'💅',papeleria:'📚',ferreteria:'🔧',farmacia:'💊',mascotas:'🐾',hogar:'🏠',servicios:'✨',otro:'🏪'};
  var em = EMOJIS[cat] || '🏪';
  var estLabel, estStyle;
  if (estOp === 'cerrado')      { estLabel='🔴 Cerrado'; estStyle='background:#FDECEA;color:#D63A2A;'; }
  else if (estOp === 'pausado') { estLabel='🟠 Pausado'; estStyle='background:#FFF0E6;color:#E87722;'; }
  else if (estOp === 'ocupado') { estLabel='🟡 Ocupado'; estStyle='background:#FFF8E1;color:#d97706;'; }
  else                          { estLabel='🟢 Abierto'; estStyle='background:#E8F5EE;color:#1a7a42;'; }
  var fotoHtml = _vnCmvFotoData
    ? '<div style="width:56px;height:56px;border-radius:14px;overflow:hidden;flex-shrink:0;"><img src="'+_vnCmvFotoData+'" style="width:100%;height:100%;object-fit:cover;"></div>'
    : '<div style="width:56px;height:56px;border-radius:14px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">'+em+'</div>';
  prev.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;">'
    + fotoHtml
    + '<div style="flex:1;">'
    + '<div style="font-size:14px;font-weight:800;color:#111;margin-bottom:2px;">'+nombre+'</div>'
    + '<div style="font-size:11px;color:#888;margin-bottom:6px;">'+desc+'</div>'
    + '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;'+estStyle+'">'+estLabel+'</span>'
    + '</div></div>';
}

function vnegCmvSyncEstado(val) {
  val = window._normEstadoOp ? window._normEstadoOp(val) : val;
  _vnegEstadoOp = val;
  _vnegEstadoOpTs = Date.now();
  try {
    localStorage.setItem('dcRestOpV2', val);
    localStorage.setItem('dcRestOpV2Ts', String(_vnegEstadoOpTs));
    var uid = window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid;
    if (uid) { localStorage.setItem('dcuserEstadoOp_'+uid, val); localStorage.setItem('dcuserEstadoOpTs_'+uid, String(_vnegEstadoOpTs)); }
  } catch(e){}
  if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(val);
}

function vnegCmvPreviewEstado(val) { window._dirtyView = 'vn-cmv'; }

async function vnegCmvCargar() {
  window._dirtyView = null;
  _vnCmvFotoData = null; _vnCmvFotoNueva = null; _vnCmvFotoExistente = null;
  var fprev = document.getElementById('vn-cmv-foto-prev');
  var elNom = document.getElementById('vn-cmv-nombre');
  var elDes = document.getElementById('vn-cmv-desc');
  var elCat = document.getElementById('vn-cmv-cat');
  var selEst = document.getElementById('vn-cmv-estado');
  var elDir = document.getElementById('vn-cmv-dir');
  var btn = document.getElementById('vn-cmv-btn-guardar');
  if (fprev) fprev.innerHTML = '🏪';
  if (elNom) elNom.value = '';
  if (elDes) elDes.value = '';
  if (elCat) elCat.value = 'tienda';
  if (selEst) selEst.value = _vnegEstadoOp || 'activo';
  if (elDir) elDir.value = '';
  if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  var inp = document.getElementById('vn-cmv-foto-inp');
  if (inp) { inp.value=''; inp.onchange=function(){ vnegCmvFotoChange(inp); }; }
  var user = window._fbAuth && window._fbAuth.currentUser;
  var db = window._fbDb;
  if (!user || !db) { vnegCmvRenderPreview(); return; }
  try {
    var f = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap = await f.getDoc(f.doc(db, 'usuarios', user.uid));
    if (!snap.exists()) { vnegCmvRenderPreview(); return; }
    var d = snap.data();
    if (elNom) elNom.value = d.nombreNegocio || d.nombre || '';
    if (elDes) elDes.value = d.descripcion || '';
    if (elCat && d.categoria) { try { elCat.value = d.categoria; } catch(e){} }
    if (selEst && d.estadoOp) { selEst.value = d.estadoOp; _vnegEstadoOp = window._normEstadoOp ? window._normEstadoOp(d.estadoOp) : d.estadoOp; }
    if (d.estadoOpTs) _vnegEstadoOpTs = d.estadoOpTs;
    if (d.horarios && d.horarios.length) VNEG_HORARIOS = d.horarios;
    if (elDir && d.direccionNegocio) elDir.value = d.direccionNegocio;
    if (d.fotoPerfil) {
      _vnCmvFotoExistente = d.fotoPerfil;
      _vnCmvFotoData = d.fotoPerfil;
      if (fprev) fprev.innerHTML = '<img src="'+d.fotoPerfil+'" style="width:100%;height:100%;object-fit:cover;">';
    }
    vnegCmvRenderPreview();
  } catch(e) { }
}
window.vnegCmvCargar = vnegCmvCargar;

async function vnegCmvGuardar() {
  window._dirtyView = null;
  var btn    = document.getElementById('vn-cmv-btn-guardar');
  var nombre = window.dcCleanText((document.getElementById('vn-cmv-nombre')||{}).value || '', 70);
  var desc   = window.dcCleanText((document.getElementById('vn-cmv-desc')||{}).value || '', 140);
  var cat    = window.dcCleanText((document.getElementById('vn-cmv-cat')||{}).value || '', 40);
  var estado = (document.getElementById('vn-cmv-estado')||{}).value || 'activo';
  var dir    = window.dcCleanText((document.getElementById('vn-cmv-dir')||{}).value || '', 120);
  vnegCmvSyncEstado(estado);
  var user = window._fbAuth && window._fbAuth.currentUser;
  var db = window._fbDb;
  if (!user || !db) { vnegCmvRenderPreview(); _vnegCmvFinalFeliz(); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    var f = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var data = { estadoOp: estado, estadoOpTs: (_vnegEstadoOpTs || Date.now()) };
    if (nombre) { data.nombreNegocio = nombre; data.nombrePublico = nombre; }
    if (desc) { data.descripcion = desc; data.descripcionPublica = desc; }
    if (cat) { data.categoria = cat; data.categoriaPublica = cat; }
    if (dir) data.direccionNegocio = dir;
    var fotoAGuardar = _vnCmvFotoNueva || _vnCmvFotoExistente;
    if (fotoAGuardar) { data.fotoPerfil = fotoAGuardar; data.fotoPublica = fotoAGuardar; }
    await Promise.race([
      f.setDoc(f.doc(db, 'usuarios', user.uid), data, { merge:true }),
      new Promise(function(res){ setTimeout(res, 8000); })
    ]);
    if (nombre) {
      var nm = document.getElementById('vn-hdr-name'); if (nm) nm.textContent = nombre;
      var cn = document.getElementById('vn-comunidad-nombre'); if (cn) cn.textContent = nombre;
    }
    if (window._vnegSyncHomeBadge) window._vnegSyncHomeBadge();
    _vnegCmvFinalFeliz();
  } catch(e) {
    toast('⚠️ Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}
window.vnegCmvGuardar = vnegCmvGuardar;

function _vnegCmvFinalFeliz() {
  var b = document.getElementById('vn-cmv-btn-guardar');
  if (b) { b.disabled = false; b.textContent = 'Guardar cambios'; }
  window._dirtyView = null;
  if (window._vnegShowOverlay) {
    window._vnegShowOverlay({
      f1tit:'Guardando cambios...',
      f1sub:'Actualizando cómo te ven tus clientes.',
      f2tit:'¡Listo!',
      f2sub:'Tus clientes ya ven tu información actualizada.',
      onDone:function(){ negTo('vn-home', true); }
    });
  } else {
    toast('✅ ¡Listo! Tus clientes ya ven tu información actualizada');
    negTo('vn-home', true);
  }
}

var _cmvFotoData     = null;
var _cmvFotoExistente = null; // foto cargada desde Firestore del usuario actual
var _cmvFotoNueva     = null; // foto recién seleccionada por el usuario en esta sesión

function cmvFotoChange(inp) {
  var file = inp.files[0]; if (!file) return;
  if (file.size > 1200000) { toast('⚠️ Imagen demasiado grande (máx 1 MB)'); inp.value=''; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    _cmvFotoNueva = e.target.result; // nueva foto seleccionada
    _cmvFotoData  = _cmvFotoNueva;  // sincronizar para que cmvRenderPreview la use
    var prev = document.getElementById('cmv-foto-prev');
    if (prev) prev.innerHTML = '<img src="'+_cmvFotoNueva+'" style="width:100%;height:100%;object-fit:cover;">';
    cmvRenderPreview();
  };
  reader.readAsDataURL(file);
}

function cmvRenderPreview() {
  var prev = document.getElementById('cmv-preview');
  if (!prev) return;
  var nombre  = window.dcCleanText((document.getElementById('cmv-nombre')||{}).value || 'Mi Restaurante', 70);
  var desc    = window.dcCleanText((document.getElementById('cmv-desc')||{}).value   || 'Descripción del restaurante', 140);
  var cat     = window.dcCleanText((document.getElementById('cmv-cat')||{}).value    || 'tacos', 40);
  var estOp   = _estadoEfectivo(); // prioridad: manual especial > horario > fallback
  // Si el selector CMV tiene un estado manual especial seleccionado, respetarlo en preview
  var selVal  = (document.getElementById('cmv-estado')||{}).value;
  if (selVal && selVal !== 'activo') estOp = selVal; // override de preview para el editor
  var EMOJIS  = {tacos:'🌮',mexicana:'🌮',pizzas:'🍕',hamburguesas:'🍔',sushi:'🍣',cafeteria:'☕',mariscos:'🦞',pollo:'🍗',postres:'🧁',desayunos:'🍳',bebidas:'🥤',otro_rest:'🍽️'};
  var em      = EMOJIS[cat] || '🍽️';
  var estLabel, estStyle;
  if (estOp === 'cerrado')      { estLabel='🔴 Cerrado'; estStyle='background:#FDECEA;color:#D63A2A;'; }
  else if (estOp === 'pausado') { estLabel='🟠 Pausado'; estStyle='background:#FFF0E6;color:#E87722;'; }
  else if (estOp === 'ocupado') { estLabel='🟡 Ocupado'; estStyle='background:#FFF8E1;color:#d97706;'; }
  else                          { estLabel='🟢 Abierto'; estStyle='background:#E8F5EE;color:#1a7a42;'; }
  var fotoHtml = _cmvFotoData
    ? '<div style="width:56px;height:56px;border-radius:14px;overflow:hidden;flex-shrink:0;"><img src="'+_cmvFotoData+'" style="width:100%;height:100%;object-fit:cover;"></div>'
    : '<div style="width:56px;height:56px;border-radius:14px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">'+em+'</div>';
  prev.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;">'
    + fotoHtml
    + '<div style="flex:1;">'
    + '<div style="font-size:14px;font-weight:800;color:#111;margin-bottom:2px;">'+nombre+'</div>'
    + '<div style="font-size:11px;color:#888;margin-bottom:6px;">'+desc+'</div>'
    + '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;'+estStyle+'">'+estLabel+'</span>'
    + '</div></div>';
}

function cmvSyncEstado(val) {
  // COMMIT del estado — SOLO se llama desde el botón Guardar
  val = window._normEstadoOp ? window._normEstadoOp(val) : val;
  _rEstadoOp = val;
  _rEstadoOpTs = Date.now();
  localStorage.setItem('dcRestOpV2', val);
  localStorage.setItem('dcRestOpV2Ts', String(_rEstadoOpTs));
  try { (function(){ var _uS=_vrUid(); if(_uS){ localStorage.setItem('dcuserEstadoOp_'+_uS, val); localStorage.setItem('dcuserEstadoOpTs_'+_uS, String(_rEstadoOpTs)); } })(); } catch(e){}
  if (typeof window.setEstadoOperativo === 'function') window.setEstadoOperativo(val);
}
function cmvPreviewEstado(val) {
  // Solo vista previa — NO guarda nada; el guardado ocurre con el botón Guardar
  window._dirtyView = 'vr-cmv';
}

async function cmvCargar() {
  window._dirtyView = null;
  // SIEMPRE resetear estado visual antes de cargar — evita mezcla entre usuarios
  _cmvFotoData      = null;
  _cmvFotoNueva     = null; // ninguna foto nueva seleccionada aún
  _cmvFotoExistente = null; // se poblará con lo que venga de Firestore
  var fprev = document.getElementById('cmv-foto-prev');
  var elNom = document.getElementById('cmv-nombre');
  var elDes = document.getElementById('cmv-desc');
  var elCat = document.getElementById('cmv-cat');
  var selEst = document.getElementById('cmv-estado');
  var elDir = document.getElementById('cmv-dir-recogida');
  var btn = document.getElementById('cmv-btn-guardar');
  // Limpiar campos a estado vacío/default
  if (fprev)  fprev.innerHTML = '\uD83C\uDF7D\uFE0F';
  if (elNom)  elNom.value = '';
  if (elDes)  elDes.value = '';
  if (elCat)  elCat.value = 'tacos';
  if (selEst) selEst.value = _rEstadoOp || 'activo';
  if (elDir)  elDir.value = '';
  if (btn)    { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  // Resetear input y reasignar listener programáticamente para garantizar que dispara
  var inp = document.getElementById('cmv-foto-inp');
  if (inp) {
    inp.value = '';
    inp.onchange = function() { cmvFotoChange(inp); };
  }

  if (_vrIsD()) { cmvRenderPreview(); return; }
  var uid = _vrUid(); var db = _vrDb(); if (!uid || !db) { cmvRenderPreview(); return; }
  try {
    var f = await _vrFb();
    // Cargar SOLO desde usuarios/{uidActual} — sin ninguna fuente alternativa
    var snap = await f.getDoc(f.doc(db, 'usuarios', uid));
    if (!snap.exists()) { cmvRenderPreview(); return; }
    var d = snap.data();
    if (elNom) elNom.value = d.nombreNegocio || d.nombre || '';
    if (elDes) elDes.value = d.descripcion || '';
    if (elCat && d.categoria) elCat.value = d.categoria;
    if (selEst && d.estadoOp) { selEst.value = d.estadoOp; _rEstadoOp = d.estadoOp; }
    if (elDir && (d.direccionNegocio || d.direccionRecogida)) elDir.value = d.direccionNegocio || d.direccionRecogida;
    if (d.fotoPerfil) {
      _cmvFotoExistente = d.fotoPerfil; // guardar la foto existente en su propia variable
      _cmvFotoData      = d.fotoPerfil; // sincronizar para cmvRenderPreview
      if (fprev) fprev.innerHTML = '<img src="'+d.fotoPerfil+'" style="width:100%;height:100%;object-fit:cover;">';
    }
    cmvRenderPreview();
  } catch(e) { }
}

async function cmvGuardar() {
  window._dirtyView = null;
  var btn    = document.getElementById('cmv-btn-guardar');
  var nombre = window.dcCleanText((document.getElementById('cmv-nombre')||{}).value || '', 70);
  var desc   = window.dcCleanText((document.getElementById('cmv-desc')||{}).value   || '', 140);
  var cat    = window.dcCleanText((document.getElementById('cmv-cat')||{}).value    || '', 40);
  var estado = (document.getElementById('cmv-estado')||{}).value || 'activo';
  var dirRec = window.dcCleanText((document.getElementById('cmv-dir-recogida')||{}).value || '', 120);

  cmvSyncEstado(estado);

  if (_vrIsD()) {
    cmvRenderPreview();
    _cmvFinalFeliz(); return;
  }
  var uid = _vrUid(); var db = _vrDb(); if (!uid || !db) { toast('⚠️ Sin sesión'); return; }
  if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }
  try {
    var f = await _vrFb();
    var data = { estadoOp: estado, estadoOpTs: (_rEstadoOpTs||Date.now()) };
    if (nombre) { data.nombreNegocio = nombre; data.nombrePublico = nombre; }
    if (desc)   { data.descripcion   = desc; data.descripcionPublica = desc; }
    if (cat)    { data.categoria     = cat; data.categoriaPublica = cat; }
    if (dirRec) data.direccionNegocio = dirRec; // campo principal para dirección del negocio
    var fotoAGuardar = _cmvFotoNueva || _cmvFotoExistente;
    if (fotoAGuardar) { data.fotoPerfil = fotoAGuardar; data.fotoPublica = fotoAGuardar; }
    // Esperar la confirmación de Firebase MÁXIMO 8 segundos; el dato ya va en camino
    // (desde archivo local la confirmación a veces tarda o no llega, pero el guardado sí ocurre)
    await Promise.race([
      f.setDoc(f.doc(db, 'usuarios', uid), data, { merge: true }),
      new Promise(function(res){ setTimeout(res, 8000); })
    ]);
    // Actualizar encabezado del Centro Operativo con el nuevo nombre
    if (nombre) {
      var hdBiz = document.getElementById('hdr-biz-name');
      if (hdBiz) hdBiz.textContent = nombre;
    }
    _cmvFinalFeliz();
  } catch(e) {
    toast('⚠️ Error: ' + e.message);
    if (btn) { btn.disabled=false; btn.textContent='Guardar cambios'; }
  }
}

function _cmvFinalFeliz() {
  // Final feliz reutilizando el overlay oficial de Configuración Restaurante
  var _b = document.getElementById('cmv-btn-guardar');
  if (_b) { _b.disabled = false; _b.textContent = 'Guardar cambios'; }
  window._dirtyView = null;
  if (window._showOverlay) {
    window._showOverlay({
      f1tit:'Guardando cambios...',
      f1sub:'Actualizando cómo te ven tus clientes.',
      f2tit:'¡Listo!',
      f2sub:'Tus clientes ya ven tu información actualizada.',
      onDone:function(){ navTo('vr-home', true); }
    });
  } else {
    toast('✅ ¡Listo! Tus clientes ya ven tu información actualizada');
    navTo('vr-home', true);
  }
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
/* ── dcRest_init ───────────────────────────────────────────
   En modo aislado: se auto-llama al cargar (ver abajo).
   En modo integrado: _goCore del index llamará window.dcRest_init()
   cuando el usuario navegue a vr-home.
   ──────────────────────────────────────────────────────────── */
window.dcRest_init = function() {
  // Cargar pedidos + horarios + nombre desde Firebase antes de renderizar home
  if (!_vrIsD()) {
    var uid=_vrUid(); var db=_vrDb();
    Promise.all([
      _vrCargarPedidos(),
      // Cargar datos del doc del restaurante (nombre, estadoOp, horarios)
      (async function(){
        if(!uid||!db) return;
        try {
          var f=await _vrFb();
          var snap=await f.getDoc(f.doc(db,'usuarios',uid));
          if(!snap.exists()) return;
          var d=snap.data();
          // Actualizar nombre en encabezado
          var nombre=d.nombreNegocio||d.nombre||'';
          if(nombre){ var hdBiz=document.getElementById('hdr-biz-name'); if(hdBiz) hdBiz.textContent=nombre; }
          // Cargar estado operativo guardado
          if(d.estadoOp){ _rEstadoOp=(window._normEstadoOp?window._normEstadoOp(d.estadoOp):d.estadoOp); localStorage.setItem('dcRestOpV2',_rEstadoOp);
            try{ var _uK=_vrUid(); if(_uK){ localStorage.setItem('dcuserEstadoOp_'+_uK, _rEstadoOp); } }catch(e){} }
          if(d.estadoOpTs){ _rEstadoOpTs=d.estadoOpTs; localStorage.setItem('dcRestOpV2Ts',String(d.estadoOpTs)); try{ if(_uK){ localStorage.setItem('dcuserEstadoOpTs_'+_uK,String(d.estadoOpTs)); } }catch(e){} }
          else if(_rEstadoOp && _rEstadoOp !== 'activo') {
            // El doc no tiene estadoOp pero localmente hay uno — sincronizar a Firestore
            (async function(_uid,_db,_est){
              try { var _f=await _vrFb(); await _f.setDoc(_f.doc(_db,'usuarios',_uid),{estadoOp:_est},{merge:true}); } catch(e){}
            })(uid,db,_rEstadoOp);
          }
          // Cargar horarios guardados en HORARIOS array (para cálculo automático)
          if(d.horarios && d.horarios.length){
            d.horarios.forEach(function(dh){
              var local=HORARIOS.find(function(h){ return h.id===dh.id; });
              if(local){ local.abre=dh.abre; local.cierra=dh.cierra; local.abierto=dh.abierto; }
              else { HORARIOS.push({id:dh.id,dia:dh.dia,abre:dh.abre,cierra:dh.cierra,abierto:dh.abierto}); }
            });
            // Eliminar días sobrantes de sesión anterior
            for(var _hj=HORARIOS.length-1;_hj>=0;_hj--){
              if(!d.horarios.find(function(dh){return dh.id===HORARIOS[_hj].id;})) HORARIOS.splice(_hj,1);
            }
          }
        } catch(e) { }
      })()
    ]).then(function(){ _renderHome(); });
  } else {
    _renderHome();
  }

  // Hora live
  if (_rHoraTimer) clearInterval(_rHoraTimer);
  _rHoraTimer = setInterval(_updateHora, 30000);

  // Sync pagos UI inicial
  Object.keys(_rPagos).forEach(function(k){
    var el = document.getElementById('pg-' + k);
    if (el) el.classList.toggle('on', _rPagos[k]);
  });
};

// Auto-llamada SOLO en modo aislado (standalone).
// En el index, window.go está definido antes de este script → no auto-ejecutar.
if (typeof window.go !== 'function') {
  window.dcRest_init();
};


// ══════════════════════════════════════════════════════════════
// EXTRAÍDO DE firebase.js — métricas restaurante
// ══════════════════════════════════════════════════════════════
  // offset 0 = mes actual, -1 = mes anterior, etc.
  window._vmrMesOffset = 0;
  window._cargarRestStats = function() {
    window._vmrMesOffset = 0;
    window._calcMetricasMes && window._calcMetricasMes();
  };
  window._vmrMesCambiar = function(dir) {
    var nuevo = window._vmrMesOffset + dir;
    if (nuevo > 0) nuevo = 0;               // no hay futuro
    window._vmrMesOffset = nuevo;
    window._calcMetricasMes && window._calcMetricasMes();
  };
  // Métricas del MES seleccionado + acumulado total. Todo Firestore real.
  window._calcMetricasMes = async function() {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    var uid = user.uid;
    var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var hoy = new Date();
    var ref = new Date(hoy.getFullYear(), hoy.getMonth() + window._vmrMesOffset, 1);
    var ini = ref.getTime();
    var fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime();
    setTxt('vmr-mes-label', MESES[ref.getMonth()] + ' ' + ref.getFullYear());
    var btnNext = document.getElementById('vmr-mes-next');
    if (btnNext) btnNext.style.opacity = window._vmrMesOffset >= 0 ? '.35' : '1';
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',uid)));
      var nPed=0, venta=0, acum=0;
      snap.forEach(function(d){
        var p = d.data();
        if (p.estado !== 'entregado') return;
        acum += (p.total||0);                          // acumulado de siempre
        var fch = p.fecha||0;
        if (fch >= ini && fch < fin) { nPed++; venta += (p.total||0); } // del mes
      });
      setTxt('vmr-pedidos', nPed);
      setTxt('vmr-ventas', '$'+venta);
      setTxt('vmr-acumulado', '$'+acum);
      var vs = await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'), _fb.where('restauranteId','==',uid)));
      var tr=0, cr=0; vs.forEach(function(d){ var v=d.data(); if(v.ratingRestaurante){ tr+=v.ratingRestaurante; cr++; } });
      setTxt('vmr-rating', cr>0 ? (tr/cr).toFixed(1)+'\u2605' : '—');
    } catch(e) { }
  };

  // Métricas reales del restaurante desde Firestore. modo: 'hoy' | 'acumulado'
  window._calcMetricasRest = async function(modo) {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    var uid = user.uid;
    var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',uid)));
      var hoy0 = new Date(); hoy0.setHours(0,0,0,0); var hoyMs = hoy0.getTime();
      var nPed = 0, venta = 0;
      snap.forEach(function(d){
        var p = d.data();
        if (p.estado !== 'entregado') return;            // solo entregados cuentan
        if (modo === 'hoy' && (p.fecha||0) < hoyMs) return; // solo de hoy
        nPed++; venta += (p.total||0);
      });
      // Rating: promedio acumulado real (mismo en ambos modos)
      var vs = await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'), _fb.where('restauranteId','==',uid)));
      var tr=0, cr=0; vs.forEach(function(d){ var v=d.data(); if(v.ratingRestaurante){ tr+=v.ratingRestaurante; cr++; } });
      var rating = cr>0 ? (tr/cr).toFixed(1) : '—';
      if (modo === 'hoy') {
        setTxt('rhome-pedidos', nPed);  // entregados hoy (lo ya vendido)
        // Por aceptar y En proceso: mismos grupos que Mis Pedidos (coinciden exacto)
        var GP_NUEVO = ['nuevo'];
        var GP_PROC  = ['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','en_camino','recogido'];
        var nAcep=0, nProc=0;
        snap.forEach(function(d){
          var e = (d.data().estado)||'';
          if (GP_NUEVO.indexOf(e)!==-1) nAcep++;
          else if (GP_PROC.indexOf(e)!==-1) nProc++;
        });
        setTxt('rhome-poraceptar', nAcep);
        setTxt('rhome-enproceso', nProc);
        var ledSet = function(cardId, on){ var c=document.getElementById(cardId); if(c){ c.classList.toggle('led-on', !!on); } };
        ledSet('card-poraceptar', nAcep>0);
        ledSet('card-pedidoshoy', nPed>0);
        ledSet('card-enproceso', nProc>0);
      } else {
        setTxt('vmr-pedidos', nPed);
        setTxt('vmr-ventas', '$'+venta);
        setTxt('vmr-rating', rating==='—'?'—':rating+'\u2605');
      }
    } catch(e) { }
  };
  // ── FIN M2-F helpers ─────────────────────────────────────────
