// CENTRO DE CONTENIDO — Admin Module
(function(){ 'use strict';

// ── Firestore refs ──────────────────────────────────────────────────────────
var COL_NOTICIAS   = 'noticias';
var COL_PROYECTOS  = 'proyectos';
var COL_REPORTES   = 'reportesCiudadanos';
var COL_EVENTOS    = 'eventos';
var COL_EMERG      = 'emergencias';

// ── Module state ────────────────────────────────────────────────────────────
var _cntSec     = 'noticia';   // current informa section
var _cntFiltro  = 'todas';     // list filter tab
var _cntItems   = [];          // current list data
var _cntEditing = null;        // {id, data} being edited
var _cntEmerg   = [];          // emergencias list cache
var _cntEmergEdit = null;      // emergencia being edited
var _cntEvFiltro  = 'todas';   // eventos filter
var _cntEvItems   = [];

// ── Helpers ─────────────────────────────────────────────────────────────────
function get(id){ return document.getElementById(id); }
function _F(){ return window._fbFirestore; }
function _db(){ return window._fbDb; }

function _nav(id, dir){
  try{ history.pushState({viewId:id},'',''); }catch(_){}
  if(window._goCore) window._goCore(id, dir||'right');
  else if(window.go) window.go(id, dir||'right');
}

function _fmt(ts){
  if(!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
}

function _estadoBadge(e){
  var map = {
    publicado:  'background:#1FC26A22;color:#1FC26A',
    programado: 'background:#F5C51822;color:#c8940a',
    borrador:   'background:rgba(255,255,255,.08);color:rgba(255,255,255,.5)',
    rechazado:  'background:#D63A2A22;color:#D63A2A',
    pendiente:  'background:#F5C51822;color:#c8940a',
    revision:   'background:#1A7AB522;color:#1A7AB5',
    finalizado: 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.4)',
  };
  var s = map[e] || 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.5)';
  return '<span style="'+s+';border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">'+e+'</span>';
}

async function _cargarCol(col, filtro){
  var F = _F(), db = _db();
  if(!F || !db) return [];
  try {
    var q;
    if(filtro && filtro !== 'todas'){
      q = F.query(F.collection(db,col), F.where('estado','==',filtro), F.orderBy('creadoEn','desc'), F.limit(80));
    } else {
      q = F.query(F.collection(db,col), F.orderBy('creadoEn','desc'), F.limit(80));
    }
    var snap = await F.getDocs(q);
    return snap.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
  } catch(_){
    try {
      var q2 = F.query(F.collection(db,col), F.limit(80));
      var snap2 = await F.getDocs(q2);
      return snap2.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
    } catch(__){ return []; }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HUB — v-cnt-contenido
// ══════════════════════════════════════════════════════════════════════════════
window.cntIrInforma    = function(){ _nav('v-cnt-informa'); };
window.cntIrEventos    = function(){ _nav('v-cnt-eventos'); };
window.cntIrEmergencias= function(){ _nav('v-cnt-emergencias'); cntCargarEmergencias(); };

// ══════════════════════════════════════════════════════════════════════════════
// INFORMA — v-cnt-informa
// ══════════════════════════════════════════════════════════════════════════════
window.cntIrNoticias  = function(){ _cntSec='noticia';  _cntFiltro='todas'; _nav('v-cnt-lista'); cntCargarLista(); };
window.cntIrProyectos = function(){ _cntSec='proyecto'; _cntFiltro='todas'; _nav('v-cnt-lista'); cntCargarLista(); };
window.cntIrReportes  = function(){ _cntSec='reporte';  _cntFiltro='todas'; _nav('v-cnt-lista'); cntCargarLista(); };

// ══════════════════════════════════════════════════════════════════════════════
// LISTA GENÉRICA (Noticias / Proyectos / Reportes)
// ══════════════════════════════════════════════════════════════════════════════
var _secMeta = {
  noticia:  { label:'Noticias',  icon:'📰', color:'#1A7AB5', col: COL_NOTICIAS,  sub:'Gestionar publicaciones de noticias' },
  proyecto: { label:'Proyectos', icon:'🏗️', color:'#1a1f7a', col: COL_PROYECTOS, sub:'Gestionar proyectos comunitarios' },
  reporte:  { label:'Reportes',  icon:'⚠️', color:'#D63A2A', col: COL_REPORTES,  sub:'Reportes ciudadanos recibidos' },
};

window.cntCargarLista = async function(){
  var m = _secMeta[_cntSec];
  if(!m) return;

  // Update header
  var h = get('cnt-lista-titulo');   if(h) h.textContent = m.label;
  var s = get('cnt-lista-sub');      if(s) s.textContent = m.sub;

  // Active tab
  ['todas','publicado','programado','borrador','rechazado','pendiente'].forEach(function(f){
    var b = get('cnt-ftab-'+f);
    if(b) b.classList.toggle('on', f === _cntFiltro);
  });

  // Tabs visibility (reportes doesn't have programado/borrador)
  var tabsRow = get('cnt-ftabs');
  if(tabsRow){
    ['programado','borrador'].forEach(function(f){
      var b = get('cnt-ftab-'+f);
      if(b) b.style.display = _cntSec === 'reporte' ? 'none' : '';
    });
    var bp = get('cnt-ftab-pendiente');
    if(bp) bp.style.display = _cntSec === 'reporte' ? '' : 'none';
  }

  var listEl = get('cnt-lista-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  _cntItems = await _cargarCol(m.col, _cntFiltro === 'todas' ? null : _cntFiltro);

  // Filter by search
  var q = (get('cnt-lista-search')||{}).value || '';
  var items = q ? _cntItems.filter(function(it){ return (it.titulo||'').toLowerCase().includes(q.toLowerCase()); }) : _cntItems;

  if(!items.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📭</div><div style="color:rgba(255,255,255,.35);font-size:13px;">Sin resultados</div></div>';
    return;
  }

  listEl.innerHTML = items.map(function(it, i){
    var img = (it.imagenes && it.imagenes[0]) || it.imagen || '';
    var imgHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentNode.innerHTML=\''+(_secMeta[_cntSec]||{icon:'📄'}).icon+'\'">'
      : '<span style="font-size:20px;">'+(m.icon||'📄')+'</span>';
    return '<div class="cnt-item-card" onclick="cntAbrirItem(\''+it._id+'\')">'
      +'<div class="cnt-item-img">'+imgHtml+'</div>'
      +'<div class="cnt-item-info">'
        +'<div class="cnt-item-titulo">'+_esc(it.titulo||'Sin título')+'</div>'
        +'<div class="cnt-item-meta">'+_fmt(it.creadoEn)+'</div>'
        +'<div style="margin-top:4px;">'+_estadoBadge(it.estado||'borrador')+'</div>'
      +'</div>'
      +'<button class="cnt-3dot" onclick="event.stopPropagation();cntMenuItem(\''+it._id+'\','+i+')" title="Opciones">⋮</button>'
    +'</div>';
  }).join('');
};

window.cntFiltrarLista = function(f){
  _cntFiltro = f;
  window.cntCargarLista();
};

window.cntBuscarLista = function(v){
  if(!_cntItems.length) return;
  var items = v ? _cntItems.filter(function(it){ return (it.titulo||'').toLowerCase().includes(v.toLowerCase()); }) : _cntItems;
  var listEl = get('cnt-lista-body');
  if(!listEl) return;
  if(!items.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Sin resultados para "'+_esc(v)+'"</div>';
    return;
  }
  var m = _secMeta[_cntSec]||{icon:'📄'};
  listEl.innerHTML = items.map(function(it,i){
    var img = (it.imagenes&&it.imagenes[0])||it.imagen||'';
    var imgHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentNode.innerHTML=\''+m.icon+'\'">'
      : '<span style="font-size:20px;">'+m.icon+'</span>';
    return '<div class="cnt-item-card" onclick="cntAbrirItem(\''+it._id+'\')">'
      +'<div class="cnt-item-img">'+imgHtml+'</div>'
      +'<div class="cnt-item-info">'
        +'<div class="cnt-item-titulo">'+_esc(it.titulo||'Sin título')+'</div>'
        +'<div class="cnt-item-meta">'+_fmt(it.creadoEn)+'</div>'
        +'<div style="margin-top:4px;">'+_estadoBadge(it.estado||'borrador')+'</div>'
      +'</div>'
      +'<button class="cnt-3dot" onclick="event.stopPropagation();cntMenuItem(\''+it._id+'\','+i+')" title="Opciones">⋮</button>'
    +'</div>';
  }).join('');
};

function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Open item ────────────────────────────────────────────────────────────────
window.cntAbrirItem = function(id){
  var it = _cntItems.find(function(x){ return x._id === id; });
  if(!it) return;
  _cntEditing = it;
  _renderEdit(it);
  _nav('v-cnt-edit');
};

function _renderEdit(it){
  var m = _secMeta[_cntSec] || {};

  // Header
  var h = get('cnt-edit-titulo'); if(h) h.textContent = _cntSec === 'reporte' ? 'Reporte Ciudadano' : 'Editar '+m.label.slice(0,-1);
  var s = get('cnt-edit-sub');    if(s) s.textContent = it.titulo ? it.titulo.slice(0,40) : '—';

  // Body
  var body = get('cnt-edit-body');
  if(!body) return;

  var imgs = it.imagenes || (it.imagen ? [it.imagen] : []);
  var imgHtml = imgs.length
    ? imgs.map(function(u){ return '<img src="'+u+'" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:.5px solid rgba(255,255,255,.1);">'; }).join('')
    : '<div style="width:80px;height:80px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:28px;">'+m.icon+'</div>';

  var acciones = '';
  if(_cntSec === 'reporte'){
    acciones = '<div style="display:flex;gap:8px;margin-top:14px;">'
      +'<button onclick="cntCambiarEstado(\''+it._id+'\',\'publicado\')" class="cnt-btn-ok">✓ Publicar</button>'
      +'<button onclick="cntCambiarEstado(\''+it._id+'\',\'rechazado\')" class="cnt-btn-del">✕ Rechazar</button>'
      +'</div>';
  } else {
    acciones = '<div style="display:flex;gap:8px;margin-top:14px;">'
      +'<button onclick="cntCambiarEstado(\''+it._id+'\',\'publicado\')" class="cnt-btn-ok">✓ Publicar</button>'
      +'<button onclick="cntCambiarEstado(\''+it._id+'\',\'borrador\')" class="cnt-btn-neu">◷ Borrador</button>'
      +'<button onclick="cntCambiarEstado(\''+it._id+'\',\'rechazado\')" class="cnt-btn-del">✕ Rechazar</button>'
      +'</div>';
  }

  var ubicRow = it.ubicacion ? '<div class="cnt-field-row"><div class="cnt-field-lbl">Ubicación</div><div class="cnt-field-val">'+_esc(it.ubicacion)+'</div></div>' : '';
  var autoRow = it.autorNombre ? '<div class="cnt-field-row"><div class="cnt-field-lbl">Autor</div><div class="cnt-field-val">'+_esc(it.autorNombre)+'</div></div>' : '';

  body.innerHTML =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'+imgHtml+'</div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Estado actual</div><div class="cnt-field-val">'+_estadoBadge(it.estado||'—')+'</div></div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Título</div><div class="cnt-field-val cnt-field-edit" contenteditable="true" id="cnt-ef-titulo" oninput="_cntEditing.titulo=this.textContent">'+_esc(it.titulo||'')+'</div></div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Descripción</div><div class="cnt-field-val cnt-field-edit cnt-field-area" contenteditable="true" id="cnt-ef-desc" oninput="_cntEditing.descripcion=this.textContent">'+_esc(it.descripcion||'')+'</div></div>'
    +ubicRow+autoRow
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Publicado</div><div class="cnt-field-val">'+_fmt(it.creadoEn)+'</div></div>'
    +'<div style="margin-top:16px;"><button onclick="cntGuardarEdicion(\''+it._id+'\')" class="cnt-btn-save">💾 Guardar cambios</button></div>'
    +acciones;
}

window.cntGuardarEdicion = async function(id){
  var it = _cntEditing;
  if(!it) return;
  var F = _F(), db = _db();
  if(!F || !db) return;
  var tituloEl = get('cnt-ef-titulo');
  var descEl   = get('cnt-ef-desc');
  var upd = {};
  if(tituloEl) upd.titulo      = tituloEl.textContent.trim();
  if(descEl)   upd.descripcion = descEl.textContent.trim();
  if(!Object.keys(upd).length) return;
  try {
    await F.updateDoc(F.doc(db, _secMeta[_cntSec].col, id), upd);
    Object.assign(it, upd);
    _showToast('✓ Cambios guardados');
  } catch(e){ _showToast('Error al guardar'); }
};

window.cntCambiarEstado = async function(id, estado){
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.updateDoc(F.doc(db, _secMeta[_cntSec].col, id), {estado:estado});
    if(_cntEditing && _cntEditing._id === id) _cntEditing.estado = estado;
    var s = get('cnt-edit-sub'); if(s && _cntEditing) s.textContent = _cntEditing.titulo||'';
    _showToast('Estado → '+estado);
    // Refresh badge in edit view
    var body = get('cnt-edit-body');
    if(body){
      var badge = body.querySelector('.cnt-field-val');
      if(badge) badge.innerHTML = _estadoBadge(estado);
    }
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── 3-dot context menu ───────────────────────────────────────────────────────
window.cntMenuItem = function(id, idx){
  var it = _cntItems[idx] || _cntItems.find(function(x){ return x._id === id; });
  if(!it) return;
  var sheet = get('cnt-menu-sheet');
  var overlay = get('cnt-menu-overlay');
  if(!sheet || !overlay) return;

  get('cnt-menu-lbl').textContent = (it.titulo||'Sin título').slice(0,40);
  sheet.innerHTML = ''
    +'<div style="text-align:center;padding:8px 0 14px;"><div style="width:36px;height:4px;background:rgba(255,255,255,.12);border-radius:4px;margin:0 auto 12px;"></div>'
    +'<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:2px;" id="cnt-menu-lbl">'+(it.titulo||'').slice(0,40)+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.35);">'+_estadoBadge(it.estado)+'</div></div>'
    +'<div class="cnt-menu-row" onclick="cntAbrirItem(\''+id+'\');cntCerrarMenu()">✏️ Editar contenido</div>'
    +(it.estado!=='publicado'?'<div class="cnt-menu-row ok" onclick="cntCambiarEstadoLista(\''+id+'\',\'publicado\')">✓ Publicar</div>':'')
    +(it.estado!=='borrador'&&_cntSec!=='reporte'?'<div class="cnt-menu-row" onclick="cntCambiarEstadoLista(\''+id+'\',\'borrador\')">◷ Mover a borrador</div>':'')
    +(it.estado!=='rechazado'?'<div class="cnt-menu-row del" onclick="cntCambiarEstadoLista(\''+id+'\',\'rechazado\')">✕ Rechazar</div>':'')
    +'<div class="cnt-menu-row del" onclick="cntEliminarItem(\''+id+'\')">🗑 Eliminar</div>';

  overlay.style.display = 'flex';
  setTimeout(function(){ sheet.style.transform = 'translateY(0)'; }, 10);
};

window.cntCerrarMenu = function(){
  var sheet = get('cnt-menu-sheet');
  var overlay = get('cnt-menu-overlay');
  if(!sheet || !overlay) return;
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function(){ overlay.style.display = 'none'; }, 280);
};

window.cntCambiarEstadoLista = async function(id, estado){
  cntCerrarMenu();
  var it = _cntItems.find(function(x){ return x._id === id; });
  if(!it) return;
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.updateDoc(F.doc(db, _secMeta[_cntSec].col, id), {estado:estado});
    it.estado = estado;
    _showToast('Estado → '+estado);
    window.cntCargarLista();
  } catch(e){ _showToast('Error'); }
};

window.cntEliminarItem = async function(id){
  cntCerrarMenu();
  if(!confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.deleteDoc(F.doc(db, _secMeta[_cntSec].col, id));
    _cntItems = _cntItems.filter(function(x){ return x._id !== id; });
    _showToast('Eliminado');
    window.cntCargarLista();
  } catch(e){ _showToast('Error al eliminar'); }
};

// ══════════════════════════════════════════════════════════════════════════════
// EVENTOS — v-cnt-eventos
// ══════════════════════════════════════════════════════════════════════════════
window.cntCargarEventos = async function(filtro){
  if(filtro !== undefined) _cntEvFiltro = filtro;

  // Active tab
  ['todas','pendiente','publicado','rechazado','finalizado'].forEach(function(f){
    var b = get('cnt-ev-ftab-'+f);
    if(b) b.classList.toggle('on', f === _cntEvFiltro);
  });

  var listEl = get('cnt-ev-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  _cntEvItems = await _cargarCol(COL_EVENTOS, _cntEvFiltro === 'todas' ? null : _cntEvFiltro);

  if(!_cntEvItems.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📭</div><div style="color:rgba(255,255,255,.35);font-size:13px;">Sin eventos</div></div>';
    return;
  }

  listEl.innerHTML = _cntEvItems.map(function(it, i){
    var img = (it.imagenes&&it.imagenes[0])||it.imagen||it.portada||'';
    var imgHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'">'
      : '<span style="font-size:22px;">🎉</span>';
    return '<div class="cnt-item-card" onclick="cntAbrirEvento(\''+it._id+'\')">'
      +'<div class="cnt-item-img">'+imgHtml+'</div>'
      +'<div class="cnt-item-info">'
        +'<div class="cnt-item-titulo">'+_esc(it.nombre||it.titulo||'Sin nombre')+'</div>'
        +'<div class="cnt-item-meta">'+(it.fecha?_fmt(it.fecha):_fmt(it.creadoEn))+'</div>'
        +'<div style="margin-top:4px;">'+_estadoBadge(it.estado||'pendiente')+'</div>'
      +'</div>'
      +'<button class="cnt-3dot" onclick="event.stopPropagation();cntMenuEvento(\''+it._id+'\','+i+')" title="Opciones">⋮</button>'
    +'</div>';
  }).join('');
};

window.cntAbrirEvento = function(id){
  var it = _cntEvItems.find(function(x){ return x._id === id; });
  if(!it) return;
  _cntEditing = it;
  _renderEvEdit(it);
  _nav('v-cnt-ev-edit');
};

function _renderEvEdit(it){
  var h = get('cnt-ev-edit-titulo'); if(h) h.textContent = it.nombre||it.titulo||'Evento';
  var s = get('cnt-ev-edit-sub');    if(s) s.textContent = _fmt(it.creadoEn);
  var body = get('cnt-ev-edit-body');
  if(!body) return;

  var imgs = it.imagenes||(it.imagen?[it.imagen]:[]);
  var imgHtml = imgs.length
    ? imgs.map(function(u){ return '<img src="'+u+'" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:.5px solid rgba(255,255,255,.1);">'; }).join('')
    : '<div style="width:80px;height:80px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:28px;">🎉</div>';

  body.innerHTML =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">'+imgHtml+'</div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Estado</div><div class="cnt-field-val">'+_estadoBadge(it.estado||'pendiente')+'</div></div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Nombre</div><div class="cnt-field-val">'+_esc(it.nombre||it.titulo||'—')+'</div></div>'
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Descripción</div><div class="cnt-field-val" style="white-space:pre-wrap;font-size:12px;line-height:1.5;">'+_esc(it.descripcion||'—')+'</div></div>'
    +(it.fecha?'<div class="cnt-field-row"><div class="cnt-field-lbl">Fecha</div><div class="cnt-field-val">'+_fmt(it.fecha)+'</div></div>':'')
    +(it.lugar||it.ubicacion?'<div class="cnt-field-row"><div class="cnt-field-lbl">Lugar</div><div class="cnt-field-val">'+_esc(it.lugar||it.ubicacion)+'</div></div>':'')
    +(it.organizadorNombre?'<div class="cnt-field-row"><div class="cnt-field-lbl">Organizador</div><div class="cnt-field-val">'+_esc(it.organizadorNombre)+'</div></div>':'')
    +'<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">'
    +'<button onclick="cntCambiarEstadoEv(\''+it._id+'\',\'publicado\')" class="cnt-btn-ok">✓ Publicar</button>'
    +'<button onclick="cntCambiarEstadoEv(\''+it._id+'\',\'rechazado\')" class="cnt-btn-del">✕ Rechazar</button>'
    +'</div>';
}

window.cntCambiarEstadoEv = async function(id, estado){
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), {estado:estado});
    if(_cntEditing && _cntEditing._id === id) _cntEditing.estado = estado;
    _showToast('Estado → '+estado);
    var it = _cntEditing;
    if(it){ it.estado = estado; _renderEvEdit(it); }
  } catch(e){ _showToast('Error'); }
};

window.cntMenuEvento = function(id, idx){
  var it = _cntEvItems[idx] || _cntEvItems.find(function(x){ return x._id === id; });
  if(!it) return;
  var sheet = get('cnt-menu-sheet');
  var overlay = get('cnt-menu-overlay');
  if(!sheet || !overlay) return;
  sheet.innerHTML = ''
    +'<div style="text-align:center;padding:8px 0 14px;"><div style="width:36px;height:4px;background:rgba(255,255,255,.12);border-radius:4px;margin:0 auto 12px;"></div>'
    +'<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;">'+(it.nombre||it.titulo||'').slice(0,40)+'</div>'
    +_estadoBadge(it.estado)+'</div>'
    +'<div class="cnt-menu-row" onclick="cntAbrirEvento(\''+id+'\');cntCerrarMenu()">👁 Ver detalle</div>'
    +(it.estado!=='publicado'?'<div class="cnt-menu-row ok" onclick="cntCambiarEstadoEvLista(\''+id+'\',\'publicado\')">✓ Publicar</div>':'')
    +(it.estado!=='rechazado'?'<div class="cnt-menu-row del" onclick="cntCambiarEstadoEvLista(\''+id+'\',\'rechazado\')">✕ Rechazar</div>':'')
    +'<div class="cnt-menu-row del" onclick="cntEliminarEvento(\''+id+'\')">🗑 Eliminar</div>';
  overlay.style.display = 'flex';
  setTimeout(function(){ sheet.style.transform = 'translateY(0)'; }, 10);
};

window.cntCambiarEstadoEvLista = async function(id, estado){
  cntCerrarMenu();
  var it = _cntEvItems.find(function(x){ return x._id === id; });
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), {estado:estado});
    if(it) it.estado = estado;
    _showToast('Estado → '+estado);
    window.cntCargarEventos();
  } catch(e){ _showToast('Error'); }
};

window.cntEliminarEvento = async function(id){
  cntCerrarMenu();
  if(!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.deleteDoc(F.doc(db, COL_EVENTOS, id));
    _cntEvItems = _cntEvItems.filter(function(x){ return x._id !== id; });
    _showToast('Eliminado');
    window.cntCargarEventos();
  } catch(e){ _showToast('Error'); }
};

// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCIAS — v-cnt-emergencias
// ══════════════════════════════════════════════════════════════════════════════
window.cntCargarEmergencias = async function(){
  var listEl = get('cnt-emerg-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  var F = _F(), db = _db();
  if(!F || !db){ listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);">Sin conexión</div>'; return; }

  try {
    var q = F.query(F.collection(db, COL_EMERG), F.orderBy('orden','asc'));
    var snap = await F.getDocs(q);
    _cntEmerg = snap.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
  } catch(_){
    try {
      var snap2 = await F.getDocs(F.collection(db, COL_EMERG));
      _cntEmerg = snap2.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
      _cntEmerg.sort(function(a,b){ return (a.orden||0)-(b.orden||0); });
    } catch(__){ _cntEmerg = []; }
  }

  _renderEmergencias();
};

function _renderEmergencias(){
  var listEl = get('cnt-emerg-body');
  if(!listEl) return;

  if(!_cntEmerg.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;"><div style="font-size:36px;margin-bottom:12px;">🚨</div><div style="color:rgba(255,255,255,.35);font-size:13px;">Sin contactos de emergencia<br><br></div>'
      +'<button onclick="cntNuevaEmergencia()" style="background:#D63A2A;border:none;border-radius:12px;padding:12px 20px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;">+ Agregar contacto</button></div>';
    return;
  }

  listEl.innerHTML = _cntEmerg.map(function(em, i){
    var activo = em.estado !== 'inactivo';
    return '<div class="cnt-emerg-row" id="cnt-emerg-row-'+em._id+'">'
      +'<div class="cnt-emerg-num">'+String(i+1).padStart(2,'0')+'</div>'
      +'<div class="cnt-emerg-drag">⠿</div>'
      +'<div class="cnt-emerg-ic">'+_esc(em.icono||'🚨')+'</div>'
      +'<div class="cnt-emerg-info">'
        +'<div class="cnt-emerg-nombre">'+_esc(em.nombre||'Sin nombre')+'</div>'
        +'<div class="cnt-emerg-desc">'+_esc((em.descripcion||em.categoria||'').slice(0,40))+'</div>'
      +'</div>'
      +(activo?'<span class="cnt-emerg-badge">Activo</span>':'<span class="cnt-emerg-badge inactivo">Inactivo</span>')
      +'<button class="cnt-3dot" onclick="cntEditarEmergencia(\''+em._id+'\')">›</button>'
    +'</div>';
  }).join('');
}

window.cntEditarEmergencia = function(id){
  var em = _cntEmerg.find(function(x){ return x._id === id; });
  if(!em) return;
  _cntEmergEdit = em;
  _renderEmergEdit(em, false);
  _nav('v-cnt-emerg-edit');
};

window.cntNuevaEmergencia = function(){
  _cntEmergEdit = null;
  _renderEmergEdit(null, true);
  _nav('v-cnt-emerg-edit');
};

function _renderEmergEdit(em, isNew){
  var h = get('cnt-emerg-edit-titulo'); if(h) h.textContent = isNew ? 'Nuevo Contacto' : 'Editar Contacto';
  var s = get('cnt-emerg-edit-sub');    if(s) s.textContent = em ? (em.nombre||'') : 'Nuevo contacto de emergencia';

  var body = get('cnt-emerg-edit-body');
  if(!body) return;

  var acciones = em && em.acciones ? em.acciones : [];
  var accionesHtml = acciones.map(function(ac, i){
    return '<div class="cnt-accion-row" id="cnt-ac-'+i+'">'
      +'<select class="cnt-accion-tipo" onchange="_cntEmergEdit.acciones['+i+'].tipo=this.value">'
        +['llamada','whatsapp','maps','correo','web','otro'].map(function(t){
          return '<option value="'+t+'"'+(ac.tipo===t?' selected':'')+'>'+_tipoIcon(t)+' '+t+'</option>';
        }).join('')
      +'</select>'
      +'<input class="cnt-accion-input" placeholder="Etiqueta" value="'+_esc(ac.etiqueta||'')+'" oninput="_cntEmergEdit.acciones['+i+'].etiqueta=this.value">'
      +'<input class="cnt-accion-input" placeholder="Valor (teléfono/URL...)" value="'+_esc(ac.valor||'')+'" oninput="_cntEmergEdit.acciones['+i+'].valor=this.value">'
      +'<button onclick="_cntEliminarAccion('+i+')" class="cnt-accion-del">✕</button>'
    +'</div>';
  }).join('');

  body.innerHTML =
    '<div class="cnt-form-group"><div class="cnt-form-lbl">Ícono (emoji)</div>'
    +'<input class="cnt-form-input" id="cnt-ef-icono" value="'+_esc(em&&em.icono||'🚨')+'" maxlength="4" style="font-size:24px;text-align:center;width:60px;"></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Nombre del servicio</div>'
    +'<input class="cnt-form-input" id="cnt-ef-nombre" value="'+_esc(em&&em.nombre||'')+'" placeholder="Ej: Cruz Roja, Bomberos..."></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Descripción corta</div>'
    +'<input class="cnt-form-input" id="cnt-ef-desc" value="'+_esc(em&&em.descripcion||'')+'" placeholder="Descripción opcional"></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Categoría</div>'
    +'<select class="cnt-form-input" id="cnt-ef-cat">'
      +['Emergencias','Seguridad','Salud','Bomberos','Municipio','Otro'].map(function(c){
        return '<option'+(em&&em.categoria===c?' selected':'')+'>'+c+'</option>';
      }).join('')
    +'</select></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Estado</div>'
    +'<select class="cnt-form-input" id="cnt-ef-estado">'
      +'<option value="activo"'+(em&&em.estado!=='inactivo'?' selected':'')+'>Activo</option>'
      +'<option value="inactivo"'+(em&&em.estado==='inactivo'?' selected':'')+'>Inactivo</option>'
    +'</select></div>'
    +'<div style="margin-top:16px;">'
    +'<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Acciones de contacto</div>'
    +'<div id="cnt-acciones-list">'+accionesHtml+'</div>'
    +'<button onclick="_cntAgregarAccion()" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 14px;font-size:12px;color:rgba(255,255,255,.6);cursor:pointer;font-family:inherit;margin-top:8px;">+ Agregar acción</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:20px;">'
    +'<button onclick="cntGuardarEmergencia()" class="cnt-btn-save" style="flex:1;">💾 Guardar</button>'
    +(em?'<button onclick="cntEliminarEmergencia(\''+em._id+'\')" class="cnt-btn-del">🗑</button>':'')
    +'</div>';

  if(!em) _cntEmergEdit = { icono:'🚨', nombre:'', descripcion:'', categoria:'Emergencias', estado:'activo', acciones:[], orden: _cntEmerg.length };
};

function _tipoIcon(t){
  var m = {llamada:'📞',whatsapp:'💬',maps:'📍',correo:'✉️',web:'🌐',otro:'⚡'};
  return m[t]||'⚡';
}

window._cntAgregarAccion = function(){
  if(!_cntEmergEdit) return;
  if(!_cntEmergEdit.acciones) _cntEmergEdit.acciones = [];
  _cntEmergEdit.acciones.push({tipo:'llamada',etiqueta:'',valor:'',orden:_cntEmergEdit.acciones.length,estado:'activo'});
  _renderEmergEdit(_cntEmergEdit, !_cntEmergEdit._id);
};

window._cntEliminarAccion = function(i){
  if(!_cntEmergEdit || !_cntEmergEdit.acciones) return;
  _cntEmergEdit.acciones.splice(i,1);
  _renderEmergEdit(_cntEmergEdit, !_cntEmergEdit._id);
};

window.cntGuardarEmergencia = async function(){
  if(!_cntEmergEdit) return;
  var F = _F(), db = _db();
  if(!F || !db) return;

  // Collect form values
  var icono   = (get('cnt-ef-icono')||{}).value || '🚨';
  var nombre  = (get('cnt-ef-nombre')||{}).value || '';
  var desc    = (get('cnt-ef-desc')||{}).value || '';
  var cat     = (get('cnt-ef-cat')||{}).value || 'Emergencias';
  var estado  = (get('cnt-ef-estado')||{}).value || 'activo';

  if(!nombre.trim()){ alert('El nombre es obligatorio'); return; }

  var data = {
    icono: icono.trim(),
    nombre: nombre.trim(),
    descripcion: desc.trim(),
    categoria: cat,
    estado: estado,
    acciones: _cntEmergEdit.acciones || [],
    orden: _cntEmergEdit.orden || 0,
  };

  try {
    if(_cntEmergEdit._id){
      await F.updateDoc(F.doc(db, COL_EMERG, _cntEmergEdit._id), data);
      var idx = _cntEmerg.findIndex(function(x){ return x._id === _cntEmergEdit._id; });
      if(idx >= 0) _cntEmerg[idx] = Object.assign({_id:_cntEmergEdit._id}, data);
    } else {
      data.creadoEn = F.serverTimestamp();
      var ref = await F.addDoc(F.collection(db, COL_EMERG), data);
      _cntEmerg.push(Object.assign({_id:ref.id}, data));
    }
    _showToast('✓ Guardado');
    if(window._goCore) window._goCore('v-cnt-emergencias','left');
    else if(window.go) window.go('v-cnt-emergencias','left');
    setTimeout(function(){ _renderEmergencias(); }, 300);
  } catch(e){ _showToast('Error: '+e.message); }
};

window.cntEliminarEmergencia = async function(id){
  if(!confirm('¿Eliminar este contacto?')) return;
  var F = _F(), db = _db();
  if(!F || !db) return;
  try {
    await F.deleteDoc(F.doc(db, COL_EMERG, id));
    _cntEmerg = _cntEmerg.filter(function(x){ return x._id !== id; });
    _showToast('Eliminado');
    if(window._goCore) window._goCore('v-cnt-emergencias','left');
    else if(window.go) window.go('v-cnt-emergencias','left');
    setTimeout(function(){ _renderEmergencias(); }, 300);
  } catch(e){ _showToast('Error'); }
};

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════
var _toastTimer = null;
function _showToast(msg){
  var t = get('cnt-toast');
  if(!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
  }, 2500);
}

})();
