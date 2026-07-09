// CENTRO DE CONTENIDO — Admin Module v=20260709g
(function(){ 'use strict';

var _FBFS = "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

var COL_NOTICIAS  = 'noticias';
var COL_PROYECTOS = 'proyectos';
var COL_REPORTES  = 'reportesCiudadanos';
var COL_EVENTOS   = 'eventos';
var COL_EMERG     = 'emergencias';
var COL_BITACORA  = 'bitacoraContenido';

var _cntSec      = 'noticia';
var _cntFiltro   = 'en_revision';
var _cntItems    = [];
var _cntEditing  = null;
var _cntEmerg    = [];
var _cntEmergEdit= null;
var _cntEvFiltro = 'todas';
var _cntEvItems  = [];
var _cntEvEditing= null;
var _cntBulkMode  = false;
var _cntSelected  = [];
var _cntEditMode  = false; // modo edición en vista de ítem
var _cntEvEditMode= false; // modo edición en vista de evento
var _cntLoadSeq   = 0;
var _cntEvLoadSeq = 0;

function get(id){ return document.getElementById(id); }

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

function _fmtDT(ts){
  if(!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function _fechaHoyISO(){
  var d = new Date(); var mm = String(d.getMonth()+1).padStart(2,'0'); var dd = String(d.getDate()).padStart(2,'0');
  return d.getFullYear()+'-'+mm+'-'+dd;
}

function _estadoBadge(e){
  var map = {
    publicado:           'background:#1FC26A22;color:#1FC26A',
    programado:          'background:#7C3AED22;color:#a78bfa',
    borrador:            'background:rgba(255,255,255,.08);color:rgba(255,255,255,.5)',
    rechazado:           'background:#D63A2A22;color:#D63A2A',
    pendiente:           'background:#F5C51822;color:#c8940a',
    revision:            'background:#1A7AB522;color:#1A7AB5',
    en_revision:         'background:#1A7AB522;color:#1A7AB5',
    requiere_correccion: 'background:#F5C51822;color:#e09000',
    finalizado:          'background:rgba(255,255,255,.06);color:rgba(255,255,255,.4)',
    eliminado:           'background:rgba(255,60,60,.1);color:rgba(255,100,100,.8)',
  };
  var labelMap = { en_revision:'En revisión', requiere_correccion:'Requiere corrección' };
  var s = map[e] || 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.5)';
  var label = labelMap[e] || (e||'—');
  return '<span style="'+s+';border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">'+label+'</span>';
}

function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _statChip(icon, val, label){
  return '<div style="display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:8px 10px;min-width:52px;">'
    +'<span style="font-size:14px;">'+icon+'</span>'
    +'<span style="font-size:13px;font-weight:700;color:#fff;margin-top:2px;">'+val+'</span>'
    +'<span style="font-size:9px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.3px;">'+label+'</span>'
    +'</div>';
}

function _uid(){ return (window._fbAuth && window._fbAuth.currentUser) ? window._fbAuth.currentUser.uid : '(sin_sesion)'; }

// ── Permisos (punto 8) ────────────────────────────────────────────────────────
window.cntPuedeEditar    = function(){ return true; };
window.cntPuedePublicar  = function(){ return true; };
window.cntPuedeEliminar  = function(){ return true; };

// ── Bitácora (puntos 1 y 10) ──────────────────────────────────────────────────
async function _guardarBitacora(col, id, accion, antes, despues){
  var db = window._fbDb; if(!db) return;
  try {
    var F = await import(_FBFS);
    await F.addDoc(F.collection(db, COL_BITACORA), {
      coleccion: col, documentoId: id, accion: accion,
      antes: antes||null, despues: despues||null,
      realizadoPor: _uid(), fecha: F.serverTimestamp()
    });
  } catch(e){ console.warn('[Bitacora]', e); }
}

// ── Firestore query con fallback ──────────────────────────────────────────────
async function _cargarCol(col, filtro){
  var db = window._fbDb;
  if(!db) return { err:'Sin conexión a Firebase (_fbDb no disponible)' };
  try {
    var F = await import(_FBFS);
    var snap;
    try {
      var q;
      if(filtro){
        q = F.query(F.collection(db,col), F.where('estado','==',filtro), F.orderBy('creadoEn','desc'), F.limit(80));
      } else {
        q = F.query(F.collection(db,col), F.orderBy('creadoEn','desc'), F.limit(80));
      }
      snap = await F.getDocs(q);
    } catch(e1){
      var q2 = F.query(F.collection(db,col), F.limit(80));
      snap = await F.getDocs(q2);
    }
    return snap.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
  } catch(e){
    return { err: e.message || 'Error Firestore' };
  }
}

// ── Items visibles (respeta filtro y búsqueda actuales) ──────────────────────
function _getItemsFiltrados(){
  var q = (get('cnt-lista-search')||{}).value || '';
  var items = q
    ? _cntItems.filter(function(it){ return (it.titulo||'').toLowerCase().includes(q.toLowerCase()); })
    : _cntItems.slice();
  // Filtro cliente: cubre el caso de fallback Firestore sin índice compuesto
  if(_cntFiltro === 'todas'){
    items = items.filter(function(it){ return it.estado !== 'eliminado'; });
  } else {
    items = items.filter(function(it){ return it.estado === _cntFiltro; });
  }
  return items;
}

// ── Conteos para menú Dominio Informa ────────────────────────────────────────
window.cntCargarConteos = async function(){
  var db = window._fbDb; if(!db) return;
  try {
    var F = await import(_FBFS);
    var defs = [
      { col: COL_NOTICIAS,  estado: 'en_revision', id: 'cnt-badge-noticia'  },
      { col: COL_PROYECTOS, estado: 'en_revision', id: 'cnt-badge-proyecto' },
      { col: COL_REPORTES,  estado: 'pendiente',   id: 'cnt-badge-reporte'  },
    ];
    defs.forEach(async function(d){
      try {
        var snap = await F.getCountFromServer(F.query(F.collection(db, d.col), F.where('estado','==',d.estado)));
        var n = snap.data().count;
        var el = get(d.id);
        if(!el) return;
        if(n > 0){ el.textContent = n; el.style.display = ''; }
        else { el.style.display = 'none'; }
      } catch(_){}
    });
  } catch(e){}
};

// ══════════════════════════════════════════════════════════════════════════════
// HUB
// ══════════════════════════════════════════════════════════════════════════════
window.cntIrInforma     = function(){ _nav('v-cnt-informa'); };
window.cntIrEventos     = function(){ _nav('v-cnt-eventos'); window.cntCargarEventos&&window.cntCargarEventos(); };
window.cntIrEmergencias = function(){ _nav('v-cnt-emergencias'); window.cntCargarEmergencias&&window.cntCargarEmergencias(); };

// ══════════════════════════════════════════════════════════════════════════════
// INFORMA — navegación a listas
// ══════════════════════════════════════════════════════════════════════════════
var _secMeta = {
  noticia:  { label:'Noticias',  icon:'📰', col: COL_NOTICIAS,  sub:'Gestionar noticias' },
  proyecto: { label:'Proyectos', icon:'🏗️', col: COL_PROYECTOS, sub:'Gestionar proyectos' },
  reporte:  { label:'Reportes',  icon:'⚠️', col: COL_REPORTES,  sub:'Reportes ciudadanos' },
};

window.cntIrNoticias  = function(){ _cntSec='noticia';  _cntFiltro='en_revision'; _cntBulkMode=false; _cntSelected=[]; _nav('v-cnt-lista'); window.cntCargarLista&&window.cntCargarLista(); };
window.cntIrProyectos = function(){ _cntSec='proyecto'; _cntFiltro='en_revision'; _cntBulkMode=false; _cntSelected=[]; _nav('v-cnt-lista'); window.cntCargarLista&&window.cntCargarLista(); };
window.cntIrReportes  = function(){ _cntSec='reporte';  _cntFiltro='pendiente';   _cntBulkMode=false; _cntSelected=[]; _nav('v-cnt-lista'); window.cntCargarLista&&window.cntCargarLista(); };

// ══════════════════════════════════════════════════════════════════════════════
// LISTA GENÉRICA
// ══════════════════════════════════════════════════════════════════════════════
window.cntCargarLista = async function(){
  var m = _secMeta[_cntSec];
  if(!m) return;
  var seq = ++_cntLoadSeq;

  var h = get('cnt-lista-titulo'); if(h) h.textContent = m.label;
  var s = get('cnt-lista-sub');    if(s) s.textContent = m.sub;

  var sel = get('cnt-filtro-select');
  if(sel){
    var _opts = [
      {v:'en_revision', l:'🔵 En revisión'},
      {v:'publicado',   l:'🟢 Publicadas'},
    ];
    if(_cntSec === 'reporte'){
      _opts.push({v:'pendiente',  l:'🟡 Pendientes'});
    } else {
      _opts.push({v:'programado', l:'🟣 Programadas'});
    }
    _opts.push({v:'rechazado',  l:'🔴 Rechazadas'});
    _opts.push({v:'eliminado',  l:'🗑 Papelera'});
    _opts.push({v:'todas',      l:'⚪ Todas'});
    sel.innerHTML = _opts.map(function(o){
      return '<option value="'+o.v+'">'+o.l+'</option>';
    }).join('');
    sel.value = _cntFiltro;
  }

  var btnBulk = get('cnt-btn-seleccionar');
  if(btnBulk) btnBulk.textContent = _cntBulkMode ? 'Cancelar' : 'Seleccionar';
  _actualizarBulkBar();

  var listEl = get('cnt-lista-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  var filtroFs = (_cntFiltro === 'todas') ? null : _cntFiltro;
  var res = await _cargarCol(m.col, filtroFs);
  if(seq !== _cntLoadSeq) return; // descarta respuesta de carga anterior

  if(res && res.err){
    listEl.innerHTML = '<div style="padding:30px 20px;text-align:center;"><div style="font-size:28px;margin-bottom:10px;">⚠️</div>'
      +'<div style="color:#D63A2A;font-size:12px;font-weight:700;">Error al cargar datos</div>'
      +'<div style="color:rgba(255,255,255,.3);font-size:11px;margin-top:6px;line-height:1.5;">'+_esc(res.err)+'</div></div>';
    return;
  }

  _cntItems = res || [];
  var items = _getItemsFiltrados();

  if(!items.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;">'
      +'<div style="font-size:32px;margin-bottom:12px;">📭</div>'
      +'<div style="color:rgba(255,255,255,.35);font-size:13px;">Sin resultados</div>'
      +'<div style="color:rgba(255,255,255,.2);font-size:11px;margin-top:6px;">Prueba otro filtro</div></div>';
    return;
  }

  listEl.innerHTML = _renderListItems(items, m);
};

function _renderListItems(items, m){
  return items.map(function(it, i){
    var imgs = it.imagenes || (it.imagen ? [it.imagen] : []);
    var img = imgs[0] || '';
    var imgHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentNode.innerHTML=\'<span style=font-size:20px>'+m.icon+'</span>\'">'
      : '<span style="font-size:20px;">'+m.icon+'</span>';
    var isSel = _cntSelected.indexOf(it._id) >= 0;
    var checkHtml = _cntBulkMode
      ? '<div onclick="event.stopPropagation();cntBulkToggleItem(\''+it._id+'\')" style="width:22px;height:22px;border-radius:50%;border:2px solid '+(isSel?'#7ac8ff':'rgba(255,255,255,.3)')+';background:'+(isSel?'#1A7AB5':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;">'+(isSel?'<span style="color:#fff;font-size:12px;font-weight:700;">✓</span>':'')+'</div>'
      : '';
    var trashBtn = it.estado === 'eliminado'
      ? '<button class="cnt-3dot" onclick="event.stopPropagation();cntRestaurarItem(\''+it._id+'\')" title="Restaurar" style="font-size:12px;color:#1FC26A;">↩</button>'
      : '<button class="cnt-3dot" onclick="event.stopPropagation();cntMenuItem(\''+it._id+'\')" title="Opciones">⋮</button>';
    return '<div class="cnt-item-card" onclick="'+(_cntBulkMode?'cntBulkToggleItem(\''+it._id+'\')':'cntAbrirItem(\''+it._id+'\')')+'">'
      +(_cntBulkMode ? '<div style="display:flex;align-items:center;padding:0 4px 0 0;">'+checkHtml+'</div>' : '')
      +'<div class="cnt-item-img">'+imgHtml+'</div>'
      +'<div class="cnt-item-info">'
        +'<div class="cnt-item-titulo">'+_esc(it.titulo||'Sin título')+'</div>'
        +'<div class="cnt-item-meta">'+_fmt(it.creadoEn)+'</div>'
        +'<div style="margin-top:4px;">'+_estadoBadge(it.estado||'borrador')+'</div>'
      +'</div>'
      +(_cntBulkMode ? '' : trashBtn)
    +'</div>';
  }).join('');
}

window.cntFiltrarLista = function(f){
  _cntFiltro = f;
  window.cntCargarLista();
};

window.cntBuscarLista = function(v){
  if(!_cntItems.length){ window.cntCargarLista(); return; }
  var m = _secMeta[_cntSec]||{icon:'📄'};
  var items = _getItemsFiltrados();
  var listEl = get('cnt-lista-body');
  if(!listEl) return;
  if(!items.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Sin resultados</div>';
    return;
  }
  listEl.innerHTML = _renderListItems(items, m);
};

// ══════════════════════════════════════════════════════════════════════════════
// ACCIONES MASIVAS (punto 6)
// ══════════════════════════════════════════════════════════════════════════════
window.cntBulkActivar = function(){
  _cntBulkMode = !_cntBulkMode;
  _cntSelected = [];
  var btn = get('cnt-btn-seleccionar');
  if(btn) btn.textContent = _cntBulkMode ? 'Cancelar' : 'Seleccionar';
  _actualizarBulkBar();
  var m = _secMeta[_cntSec]||{icon:'📄'};
  var listEl = get('cnt-lista-body');
  var items = _getItemsFiltrados();
  if(listEl && items.length) listEl.innerHTML = _renderListItems(items, m);
};

window.cntBulkToggleItem = function(id){
  var idx = _cntSelected.indexOf(id);
  if(idx >= 0) _cntSelected.splice(idx,1); else _cntSelected.push(id);
  _actualizarBulkBar();
  var m = _secMeta[_cntSec]||{icon:'📄'};
  var listEl = get('cnt-lista-body');
  var items = _getItemsFiltrados();
  if(listEl && items.length) listEl.innerHTML = _renderListItems(items, m);
};

function _actualizarBulkBar(){
  var bar = get('cnt-bulk-bar'); if(!bar) return;
  if(!_cntBulkMode || _cntSelected.length === 0){
    bar.style.display = 'none'; return;
  }
  bar.style.display = 'flex';
  var cntEl = get('cnt-bulk-count');
  if(cntEl) cntEl.textContent = _cntSelected.length+' seleccionados';
}

async function _bulkCambiarEstado(estado){
  if(!_cntSelected.length) return;
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var F = await import(_FBFS);
  var proms = _cntSelected.map(function(id){
    var it = _cntItems.find(function(x){ return x._id===id; }) || {};
    var estadoAntes = it.estado;
    var upd = {estado:estado, actualizadoEn:F.serverTimestamp()};
    if(estado==='publicado') upd.publicadoEn = F.serverTimestamp();
    if(estado==='eliminado'){ upd.eliminadoEn = F.serverTimestamp(); upd.eliminadoPor = _uid(); }
    return F.updateDoc(F.doc(db, m.col, id), upd).then(function(){
      _guardarBitacora(m.col, id, 'bulk_'+estado, {estado:estadoAntes}, {estado:estado});
    });
  });
  try {
    await Promise.all(proms);
    _showToast('✓ '+_cntSelected.length+' elementos → '+estado);
    _cntSelected = [];
    _cntBulkMode = false;
    var btn = get('cnt-btn-seleccionar'); if(btn) btn.textContent = 'Seleccionar';
    _actualizarBulkBar();
    window.cntCargarLista();
  } catch(e){ _showToast('Error: '+e.message); }
}

window.cntBulkPublicar  = function(){ if(!cntPuedePublicar()) return; _bulkCambiarEstado('publicado'); };
window.cntBulkRechazar  = function(){ if(!cntPuedeEditar())   return; _bulkCambiarEstado('rechazado'); };
window.cntBulkBorrador  = function(){ if(!cntPuedeEditar())   return; _bulkCambiarEstado('borrador'); };
window.cntBulkEliminar  = function(){
  if(!cntPuedeEliminar()) return;
  if(!_cntSelected.length) return;
  if(!confirm('¿Mover '+_cntSelected.length+' elemento(s) a la papelera?')) return;
  _bulkCambiarEstado('eliminado');
};

// ── Abrir item para editar ────────────────────────────────────────────────────
window.cntAbrirItem = function(id){
  var it = _cntItems.find(function(x){ return x._id === id; });
  if(!it) return;
  _cntEditing = it;
  _cntEditMode = false;
  _renderEdit(it);
  _nav('v-cnt-edit');
};

function _renderEdit(it){
  var m = _secMeta[_cntSec] || {};
  var h = get('cnt-edit-titulo'); if(h) h.textContent = _cntSec==='reporte' ? 'Reporte Ciudadano' : (m.label||'Noticia').slice(0,-1)||'Noticia';
  var s = get('cnt-edit-sub');    if(s) s.textContent = (it.titulo||'').slice(0,45)||'—';
  var body = get('cnt-edit-body');
  if(!body) return;

  var imgs = it.imagenes||(it.imagen?[it.imagen]:[]);
  var imgHtml = imgs.length
    ? '<img src="'+imgs[0]+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:14px;" onerror="this.style.display=\'none\'">'
    : '<div style="width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px;">'+(m.icon||'📄')+'</div>';

  var stats = it.estadisticas || {};
  var statsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0;">'
    +_statChip('👁',''+( stats.visitas||it.visitas||0),'vistas')
    +_statChip('↗',''+( stats.compartidos||it.compartidos||0),'comp.')
    +_statChip('🖱',''+( stats.clics||it.clics||0),'clics')
    +_statChip('❤️',''+( stats.favoritos||it.favoritos||0),'favs')
    +_statChip('💬',''+( stats.comentarios||it.comentarios||0),'coment.')
    +'</div>';

  var esEliminado = it.estado === 'eliminado';

  // ── Contenido: modo lectura (vista previa) o modo edición ──
  var contentHtml;
  if(!esEliminado && _cntEditMode && cntPuedeEditar()){
    contentHtml =
      '<div class="cnt-field-row"><div class="cnt-field-lbl">Título</div>'
      +'<div class="cnt-field-val cnt-field-edit cnt-field-area" contenteditable="true" id="cnt-ef-titulo">'+_esc(it.titulo||'')+'</div></div>'
      +'<div class="cnt-field-row"><div class="cnt-field-lbl">Descripción</div>'
      +'<div class="cnt-field-val cnt-field-edit cnt-field-area" contenteditable="true" id="cnt-ef-desc">'+_esc(it.descripcion||'')+'</div></div>'
      +'<div style="margin-top:12px;display:flex;gap:8px;">'
        +'<button onclick="cntGuardarEdicion(\''+it._id+'\')" class="cnt-btn-save" style="flex:1;">💾 Guardar cambios</button>'
        +'<button onclick="_cntEditMode=false;_renderEdit(_cntEditing)" style="background:rgba(255,255,255,.08);border:.5px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 14px;font-size:13px;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit;">✕</button>'
      +'</div>';
  } else {
    // Vista como la vería el público
    contentHtml =
      '<div style="font-size:17px;font-weight:700;color:#fff;line-height:1.3;margin:12px 0 8px;">'+_esc(it.titulo||'Sin título')+'</div>'
      +(it.descripcion?'<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:12px;white-space:pre-wrap;">'+_esc(it.descripcion)+'</div>':'')
      +(it.ubicacion?'<div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:4px;">📍 '+_esc(it.ubicacion)+'</div>':'')
      +(it.autorNombre?'<div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:4px;">✍️ '+_esc(it.autorNombre)+'</div>':'')
      +'<div style="font-size:12px;color:rgba(255,255,255,.25);margin-bottom:4px;">📅 '+_fmt(it.creadoEn)+'</div>'
      +(it.publicadoEn?'<div style="font-size:12px;color:rgba(31,194,106,.5);">🟢 Publicado '+_fmtDT(it.publicadoEn)+'</div>':'')
      +(it.observacionesAdmin?'<div style="margin-top:10px;padding:10px;background:rgba(245,197,24,.06);border:.5px solid rgba(245,197,24,.15);border-radius:10px;">'
          +'<div style="font-size:10px;font-weight:700;color:#e09000;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;">Observaciones</div>'
          +'<div style="font-size:12px;color:rgba(255,255,255,.5);white-space:pre-wrap;">'+_esc(it.observacionesAdmin)+'</div>'
        +'</div>':'');
  }

  // ── Botones principales: Publicar primero ──
  var btnsHtml;
  if(esEliminado){
    btnsHtml = '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">'
      +(cntPuedeEditar()?'<button onclick="cntRestaurarItem(\''+it._id+'\')" class="cnt-btn-ok">↩ Restaurar</button>':'')
      +'</div>';
  } else {
    btnsHtml = '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">'
      +(cntPuedePublicar()&&it.estado!=='publicado'?'<button onclick="cntCambiarEstado(\''+it._id+'\',\'publicado\')" class="cnt-btn-ok">✓ Publicar</button>':'')
      +(cntPuedeEditar()&&it.estado!=='rechazado'?'<button onclick="cntCambiarEstado(\''+it._id+'\',\'rechazado\')" class="cnt-btn-del">✕ Rechazar</button>':'')
      +(cntPuedeEditar()&&_cntSec!=='reporte'&&it.estado!=='borrador'?'<button onclick="cntCambiarEstado(\''+it._id+'\',\'borrador\')" class="cnt-btn-neu">◷ Borrador</button>':'')
      +'</div>';
  }

  // ── Acciones secundarias ──
  var progHtml = !esEliminado
    ? '<div id="cnt-prog-section" style="display:none;margin-top:10px;background:rgba(124,58,237,.1);border-radius:12px;padding:12px;">'
        +'<div style="font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">📅 Publicar el día</div>'
        +'<input type="date" id="cnt-prog-fecha" min="'+_fechaHoyISO()+'" value="'+(it.fechaProgramada||'')+'" style="background:rgba(255,255,255,.08);border:.5px solid rgba(124,58,237,.4);border-radius:8px;padding:7px 10px;font-size:13px;color:#fff;outline:none;font-family:inherit;width:100%;box-sizing:border-box;">'
        +'<button onclick="cntGuardarProgramado(\''+it._id+'\')" style="margin-top:8px;background:#7C3AED;border:none;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;width:100%;">✓ Confirmar programación</button>'
      +'</div>'
    : '';

  var corrHtml = !esEliminado
    ? '<div id="cnt-corr-section" style="display:none;margin-top:10px;background:rgba(245,197,24,.08);border-radius:12px;padding:12px;">'
        +'<div style="font-size:11px;font-weight:700;color:#e09000;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">📝 Observaciones para el autor</div>'
        +'<textarea id="cnt-corr-obs" placeholder="Describe qué debe corregirse..." style="background:rgba(255,255,255,.07);border:.5px solid rgba(245,197,24,.3);border-radius:8px;padding:8px 10px;font-size:12px;color:#fff;outline:none;font-family:inherit;width:100%;box-sizing:border-box;min-height:80px;resize:vertical;">'+_esc(it.observacionesAdmin||'')+'</textarea>'
        +'<button onclick="cntEnviarCorreccion(\''+it._id+'\')" style="margin-top:8px;background:#c8940a;border:none;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;width:100%;">↩ Enviar al autor</button>'
      +'</div>'
    : '';

  var accionesHtml = !esEliminado
    ? '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">'
        +(!_cntEditMode&&cntPuedeEditar()?'<button onclick="cntModoEditar()" style="background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.15);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,.75);cursor:pointer;font-family:inherit;">✏️ Editar</button>':'')
        +(_cntSec!=='reporte'&&cntPuedePublicar()?'<button onclick="cntMostrarProgramar()" style="background:rgba(124,58,237,.15);border:.5px solid rgba(124,58,237,.3);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#a78bfa;cursor:pointer;font-family:inherit;">📅 Programar</button>':'')
        +(cntPuedeEditar()?'<button onclick="cntSolicitarCorreccion()" style="background:rgba(245,197,24,.1);border:.5px solid rgba(245,197,24,.2);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#e09000;cursor:pointer;font-family:inherit;">📝 Solicitar corrección</button>':'')
        +(cntPuedeEditar()?'<button onclick="cntDuplicar(\''+it._id+'\')" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.1);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit;">⧉ Duplicar</button>':'')
        +(cntPuedeEliminar()?'<button onclick="cntSoftDelete(\''+it._id+'\')" style="background:rgba(214,58,42,.1);border:.5px solid rgba(214,58,42,.2);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#D63A2A;cursor:pointer;font-family:inherit;">🗑 Papelera</button>':'')
      +'</div>'
    : '';

  body.innerHTML =
    imgHtml
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Estado</div><div class="cnt-field-val" id="cnt-ef-estado-badge">'+_estadoBadge(it.estado||'—')+'</div></div>'
    +statsHtml
    +contentHtml
    +btnsHtml
    +accionesHtml
    +progHtml
    +corrHtml;
}

window.cntModoEditar = function(){
  _cntEditMode = true;
  if(_cntEditing) _renderEdit(_cntEditing);
};

window.cntGuardarEdicion = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var tEl = get('cnt-ef-titulo'), dEl = get('cnt-ef-desc');
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var antes = { titulo: it.titulo, descripcion: it.descripcion };
  var upd = {};
  if(tEl) upd.titulo      = tEl.textContent.trim();
  if(dEl) upd.descripcion = dEl.textContent.trim();
  try {
    var F = await import(_FBFS);
    upd.actualizadoEn = F.serverTimestamp();
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    if(_cntEditing && _cntEditing._id===id) Object.assign(_cntEditing, upd);
    _guardarBitacora(m.col, id, 'editar', antes, {titulo:upd.titulo, descripcion:upd.descripcion});
    _showToast('✓ Guardado');
  } catch(e){ _showToast('Error: '+e.message); }
};

window.cntCambiarEstado = async function(id, estado){
  if(estado==='publicado' && !cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  if(estado!=='publicado' && !cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var antes = { estado: it.estado };
  try {
    var F = await import(_FBFS);
    var upd = { estado:estado, actualizadoEn:F.serverTimestamp() };
    if(estado==='publicado') upd.publicadoEn = F.serverTimestamp();
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    if(_cntEditing && _cntEditing._id===id){ Object.assign(_cntEditing, upd); }
    var badge = get('cnt-ef-estado-badge'); if(badge) badge.innerHTML = _estadoBadge(estado);
    _guardarBitacora(m.col, id, 'cambio_estado', antes, {estado:estado});
    _showToast('Estado → '+estado);
    if(_cntEditing && _cntEditing._id===id) _renderEdit(_cntEditing);
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Publicación programada (punto 2) ─────────────────────────────────────────
window.cntMostrarProgramar = function(){
  var sec = get('cnt-prog-section'); if(!sec) return;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cntGuardarProgramado = async function(id){
  if(!cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var fechaEl = get('cnt-prog-fecha');
  var fecha = fechaEl ? fechaEl.value : '';
  if(!fecha){ _showToast('Selecciona una fecha'); return; }
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;  // capturar ANTES de Object.assign
  try {
    var F = await import(_FBFS);
    var upd = { estado:'programado', fechaProgramada:fecha, actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    if(_cntEditing && _cntEditing._id===id) Object.assign(_cntEditing, upd);
    _guardarBitacora(m.col, id, 'programar', {estado:estadoAntes}, {estado:'programado', fechaProgramada:fecha});
    _showToast('✓ Programado para '+fecha);
    var sec = get('cnt-prog-section'); if(sec) sec.style.display='none';
    var badge = get('cnt-ef-estado-badge'); if(badge) badge.innerHTML = _estadoBadge('programado');
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Revisión con comentarios (punto 3) ───────────────────────────────────────
window.cntSolicitarCorreccion = function(){
  var sec = get('cnt-corr-section'); if(!sec) return;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cntEnviarCorreccion = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var obsEl = get('cnt-corr-obs');
  var obs = obsEl ? obsEl.value.trim() : '';
  if(!obs){ _showToast('Escribe las observaciones'); return; }
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;  // capturar ANTES de Object.assign
  try {
    var F = await import(_FBFS);
    var upd = { estado:'requiere_correccion', observacionesAdmin:obs, actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    if(_cntEditing && _cntEditing._id===id) Object.assign(_cntEditing, upd);
    _guardarBitacora(m.col, id, 'solicitar_correccion', {estado:estadoAntes}, {estado:'requiere_correccion', observaciones:obs});
    _showToast('↩ Enviado al autor');
    var sec = get('cnt-corr-section'); if(sec) sec.style.display='none';
    var badge = get('cnt-ef-estado-badge'); if(badge) badge.innerHTML = _estadoBadge('requiere_correccion');
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Vista previa (punto 4) ────────────────────────────────────────────────────
window.cntVistaPrevia = function(id){
  var it = _cntItems.find(function(x){ return x._id===id; }) || _cntEditing || {};
  var m = _secMeta[_cntSec] || {};
  _mostrarPreviewOverlay(it, m.icon||'📄');
};

function _mostrarPreviewOverlay(it, icon){
  var el = get('cnt-preview-overlay'); if(!el) return;
  var imgs = it.imagenes||(it.imagen?[it.imagen]:[]);
  var imgHtml = imgs.length
    ? '<img src="'+imgs[0]+'" style="width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:14px;" onerror="this.style.display=\'none\'">'
    : '<div style="width:100%;height:120px;border-radius:14px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:14px;">'+icon+'</div>';
  el.innerHTML =
    '<div style="position:absolute;inset:0;background:rgba(0,0,0,.7);" onclick="cntCerrarPrevia()"></div>'
    +'<div style="position:absolute;bottom:0;left:0;right:0;background:#0f1c14;border-radius:20px 20px 0 0;padding:20px 18px 30px;max-height:80%;overflow-y:auto;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
        +'<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.5px;">Vista previa</div>'
        +'<button onclick="cntCerrarPrevia()" style="background:rgba(255,255,255,.08);border:none;border-radius:50%;width:28px;height:28px;font-size:14px;color:#fff;cursor:pointer;font-family:inherit;">✕</button>'
      +'</div>'
      +imgHtml
      +'<div style="font-size:16px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:8px;">'+_esc(it.titulo||it.nombre||'Sin título')+'</div>'
      +'<div style="margin-bottom:10px;">'+_estadoBadge(it.estado||'borrador')+'</div>'
      +(it.descripcion?'<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:10px;">'+_esc(it.descripcion)+'</div>':'')
      +((it.ubicacion||it.lugar)?'<div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:6px;">📍 '+_esc(it.ubicacion||it.lugar)+'</div>':'')
      +(it.fecha?'<div style="font-size:12px;color:rgba(255,255,255,.3);">📅 '+_fmt(it.fecha)+'</div>':'<div style="font-size:12px;color:rgba(255,255,255,.3);">📅 '+_fmt(it.creadoEn)+'</div>')
    +'</div>';
  el.style.display = 'block';
}

window.cntCerrarPrevia = function(){
  var el = get('cnt-preview-overlay'); if(el) el.style.display='none';
};

// ── Soft delete / Papelera (punto 7) ─────────────────────────────────────────
window.cntSoftDelete = async function(id){
  if(!cntPuedeEliminar()){ _showToast('Sin permiso'); return; }
  if(!confirm('¿Mover a la papelera?')) return;
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;  // capturar ANTES de Object.assign
  try {
    var F = await import(_FBFS);
    var upd = { estado:'eliminado', eliminadoEn:F.serverTimestamp(), eliminadoPor:_uid() };
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    if(_cntEditing && _cntEditing._id===id) Object.assign(_cntEditing, upd);
    _guardarBitacora(m.col, id, 'papelera', {estado:estadoAntes}, {estado:'eliminado'});
    _showToast('🗑 Movido a papelera');
    setTimeout(function(){ _nav('v-cnt-lista','left'); }, 500);
  } catch(e){ _showToast('Error: '+e.message); }
};

window.cntSoftDeleteLista = async function(id){
  cntCerrarMenu();
  if(!cntPuedeEliminar()){ _showToast('Sin permiso'); return; }
  if(!confirm('¿Mover a la papelera?')) return;
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;  // capturar ANTES de Object.assign
  try {
    var F = await import(_FBFS);
    var upd = { estado:'eliminado', eliminadoEn:F.serverTimestamp(), eliminadoPor:_uid() };
    await F.updateDoc(F.doc(db, m.col, id), upd);
    Object.assign(it, upd);
    _guardarBitacora(m.col, id, 'papelera', {estado:estadoAntes}, {estado:'eliminado'});
    _showToast('🗑 Movido a papelera');
    window.cntCargarLista();
  } catch(e){ _showToast('Error'); }
};

window.cntRestaurarItem = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var it = _cntItems.find(function(x){ return x._id===id; }) || {};
  try {
    var F = await import(_FBFS);
    var upd = { estado:'borrador', eliminadoEn:F.deleteField(), eliminadoPor:F.deleteField(), actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, m.col, id), upd);
    if(it){ it.estado='borrador'; delete it.eliminadoEn; delete it.eliminadoPor; }
    if(_cntEditing && _cntEditing._id===id){ _cntEditing.estado='borrador'; _renderEdit(_cntEditing); }
    _guardarBitacora(m.col, id, 'restaurar', {estado:'eliminado'}, {estado:'borrador'});
    _showToast('↩ Restaurado como borrador');
    window.cntCargarLista();
  } catch(e){ _showToast('Error: '+e.message); }
};

// cntEliminarItem — compatibilidad, delegada a soft delete
window.cntEliminarItem = function(id){ cntSoftDeleteLista(id); };

// ── Duplicar publicación (punto 9) ────────────────────────────────────────────
window.cntDuplicar = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var it = _cntItems.find(function(x){ return x._id===id; }) || _cntEditing || {};
  if(!it._id) return;
  try {
    var F = await import(_FBFS);
    var copia = {};
    ['titulo','descripcion','imagenes','imagen','ubicacion','autorNombre','autorId','categoria','tags'].forEach(function(k){
      if(it[k] !== undefined) copia[k] = it[k];
    });
    copia.titulo    = 'Copia de '+(it.titulo||'sin título');
    copia.estado    = 'borrador';
    copia.creadoEn  = F.serverTimestamp();
    copia.visitas   = 0; copia.compartidos = 0; copia.clics = 0;
    copia.favoritos = 0; copia.comentarios  = 0;
    copia.estadisticas = { visitas:0, compartidos:0, clics:0, favoritos:0, comentarios:0 };
    delete copia.publicadoEn; delete copia.fechaProgramada; delete copia.observacionesAdmin;
    var ref = await F.addDoc(F.collection(db, m.col), copia);
    _guardarBitacora(m.col, ref.id, 'duplicar', null, {copiadoDe:id, titulo:copia.titulo});
    _showToast('⧉ Duplicado como borrador');
    window.cntCargarLista();
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Menú contextual 3 puntos ─────────────────────────────────────────────────
window.cntMenuItem = function(id){
  var it = _cntItems.find(function(x){ return x._id===id; });
  if(!it) return;
  var overlay = get('cnt-menu-overlay'), sheet = get('cnt-menu-sheet');
  if(!overlay||!sheet) return;
  sheet.innerHTML =
    '<div style="text-align:center;padding:10px 0 14px;">'
    +'<div style="width:36px;height:4px;background:rgba(255,255,255,.12);border-radius:4px;margin:0 auto 12px;"></div>'
    +'<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;">'+_esc((it.titulo||'').slice(0,40))+'</div>'
    +_estadoBadge(it.estado)+'</div>'
    +'<div class="cnt-menu-row" onclick="cntAbrirItem(\''+id+'\');cntCerrarMenu()">✏️ Ver / Editar</div>'
    +(cntPuedePublicar()&&it.estado!=='publicado'?'<div class="cnt-menu-row ok" onclick="cntCambiarEstadoLista(\''+id+'\',\'publicado\')">✓ Publicar</div>':'')
    +(cntPuedeEditar()&&_cntSec!=='reporte'&&it.estado!=='borrador'?'<div class="cnt-menu-row" onclick="cntCambiarEstadoLista(\''+id+'\',\'borrador\')">◷ Mover a borrador</div>':'')
    +(cntPuedeEditar()&&it.estado!=='rechazado'?'<div class="cnt-menu-row del" onclick="cntCambiarEstadoLista(\''+id+'\',\'rechazado\')">✕ Rechazar</div>':'')
    +(cntPuedeEliminar()?'<div class="cnt-menu-row del" onclick="cntSoftDeleteLista(\''+id+'\')">🗑 Mover a papelera</div>':'');
  overlay.style.display = 'flex';
  setTimeout(function(){ sheet.style.transform='translateY(0)'; }, 10);
};

window.cntCerrarMenu = function(){
  var sheet = get('cnt-menu-sheet'), overlay = get('cnt-menu-overlay');
  if(!sheet||!overlay) return;
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function(){ overlay.style.display='none'; }, 280);
};

window.cntCambiarEstadoLista = async function(id, estado){
  cntCerrarMenu();
  if(estado==='publicado' && !cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  if(estado!=='publicado' && !cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var it = _cntItems.find(function(x){ return x._id===id; });
  var db = window._fbDb; if(!db) return;
  var m = _secMeta[_cntSec]; if(!m) return;
  var estadoAntes = it ? it.estado : null;
  try {
    var F = await import(_FBFS);
    var upd = { estado:estado, actualizadoEn:F.serverTimestamp() };
    if(estado==='publicado') upd.publicadoEn = F.serverTimestamp();
    await F.updateDoc(F.doc(db, m.col, id), upd);
    if(it) Object.assign(it, upd);
    _guardarBitacora(m.col, id, 'cambio_estado', {estado:estadoAntes}, {estado:estado});
    _showToast('Estado → '+estado);
    window.cntCargarLista();
  } catch(e){ _showToast('Error'); }
};

// ══════════════════════════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════════════════════════
window.cntCargarEventos = async function(filtro){
  if(filtro !== undefined) _cntEvFiltro = filtro;
  var seq = ++_cntEvLoadSeq;
  var evSel = get('cnt-ev-filtro-select');
  if(evSel) evSel.value = _cntEvFiltro;
  var listEl = get('cnt-ev-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  var f2 = (_cntEvFiltro==='todas') ? null : _cntEvFiltro;
  var res = await _cargarCol(COL_EVENTOS, f2);
  if(seq !== _cntEvLoadSeq) return; // descarta respuesta de carga anterior

  if(res && res.err){
    listEl.innerHTML = '<div style="padding:30px 20px;text-align:center;"><div style="font-size:28px;margin-bottom:10px;">⚠️</div>'
      +'<div style="color:#D63A2A;font-size:12px;font-weight:700;">Error al cargar eventos</div>'
      +'<div style="color:rgba(255,255,255,.3);font-size:11px;margin-top:6px;">'+_esc(res.err)+'</div></div>';
    return;
  }
  _cntEvItems = res || [];

  // En filtro "todas" excluir eliminados
  var items = _cntEvFiltro === 'todas'
    ? _cntEvItems.filter(function(it){ return it.estado !== 'eliminado'; })
    : _cntEvItems;

  if(!items.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;"><div style="font-size:32px;margin-bottom:12px;">📭</div><div style="color:rgba(255,255,255,.35);font-size:13px;">Sin eventos</div></div>';
    return;
  }

  listEl.innerHTML = items.map(function(it, i){
    var imgs = it.imagenes||(it.imagen?[it.imagen]:[]);
    var img = imgs[0]||it.portada||'';
    var imgHtml = img
      ? '<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'">'
      : '<span style="font-size:22px;">🎉</span>';
    var trashBtn = it.estado === 'eliminado'
      ? '<button class="cnt-3dot" onclick="event.stopPropagation();cntRestaurarEvento(\''+it._id+'\')" title="Restaurar" style="font-size:12px;color:#1FC26A;">↩</button>'
      : '<button class="cnt-3dot" onclick="event.stopPropagation();cntMenuEvento(\''+it._id+'\')" title="Opciones">⋮</button>';
    return '<div class="cnt-item-card" onclick="cntAbrirEvento(\''+it._id+'\')">'
      +'<div class="cnt-item-img">'+imgHtml+'</div>'
      +'<div class="cnt-item-info">'
        +'<div class="cnt-item-titulo">'+_esc(it.nombre||it.titulo||'Sin nombre')+'</div>'
        +'<div class="cnt-item-meta">'+(it.fecha?_fmt(it.fecha):_fmt(it.creadoEn))+'</div>'
        +'<div style="margin-top:4px;">'+_estadoBadge(it.estado||'pendiente')+'</div>'
      +'</div>'
      +trashBtn
    +'</div>';
  }).join('');
};

window.cntAbrirEvento = function(id){
  var it = _cntEvItems.find(function(x){ return x._id===id; });
  if(!it) return;
  _cntEvEditing = it;
  _cntEditing   = it;
  _cntEvEditMode = false;
  _renderEvEdit(it);
  _nav('v-cnt-ev-edit');
};

function _renderEvEdit(it){
  var h = get('cnt-ev-edit-titulo'); if(h) h.textContent = it.nombre||it.titulo||'Evento';
  var s = get('cnt-ev-edit-sub');    if(s) s.textContent = _fmt(it.creadoEn);
  var body = get('cnt-ev-edit-body'); if(!body) return;
  var imgs = it.imagenes||(it.imagen?[it.imagen]:[it.portada||'']);
  var imgHtml = imgs[0]
    ? '<img src="'+imgs[0]+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:14px;" onerror="this.style.display=\'none\'">'
    : '<div style="width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px;">🎉</div>';

  var stats = it.estadisticas || {};
  var statsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0;">'
    +_statChip('👁',''+( stats.visitas||it.visitas||0),'vistas')
    +_statChip('↗',''+( stats.compartidos||it.compartidos||0),'comp.')
    +_statChip('🖱',''+( stats.clics||it.clics||0),'clics')
    +_statChip('❤️',''+( stats.favoritos||it.favoritos||0),'favs')
    +_statChip('💬',''+( stats.comentarios||it.comentarios||0),'coment.')
    +'</div>';

  var esEliminado = it.estado === 'eliminado';

  var btnsHtml = esEliminado
    ? '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">'
        +(cntPuedeEditar()?'<button onclick="cntRestaurarEvento(\''+it._id+'\')" class="cnt-btn-ok">↩ Restaurar</button>':'')
      +'</div>'
    : '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">'
        +(cntPuedePublicar()&&it.estado!=='publicado'?'<button onclick="cntCambiarEstadoEv(\''+it._id+'\',\'publicado\')" class="cnt-btn-ok">✓ Publicar</button>':'')
        +(cntPuedeEditar()&&it.estado!=='rechazado'?'<button onclick="cntCambiarEstadoEv(\''+it._id+'\',\'rechazado\')" class="cnt-btn-del">✕ Rechazar</button>':'')
      +'</div>';

  var progHtml = !esEliminado
    ? '<div id="cnt-ev-prog-section" style="display:none;margin-top:10px;background:rgba(124,58,237,.1);border-radius:12px;padding:12px;">'
        +'<div style="font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">📅 Publicar el día</div>'
        +'<input type="date" id="cnt-ev-prog-fecha" min="'+_fechaHoyISO()+'" value="'+(it.fechaProgramada||'')+'" style="background:rgba(255,255,255,.08);border:.5px solid rgba(124,58,237,.4);border-radius:8px;padding:7px 10px;font-size:13px;color:#fff;outline:none;font-family:inherit;width:100%;box-sizing:border-box;">'
        +'<button onclick="cntGuardarProgramadoEv(\''+it._id+'\')" style="margin-top:8px;background:#7C3AED;border:none;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;width:100%;">✓ Confirmar programación</button>'
      +'</div>'
    : '';

  var corrHtml = !esEliminado
    ? '<div id="cnt-ev-corr-section" style="display:none;margin-top:10px;background:rgba(245,197,24,.08);border-radius:12px;padding:12px;">'
        +'<div style="font-size:11px;font-weight:700;color:#e09000;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">📝 Observaciones para el organizador</div>'
        +'<textarea id="cnt-ev-corr-obs" placeholder="Describe qué debe corregirse..." style="background:rgba(255,255,255,.07);border:.5px solid rgba(245,197,24,.3);border-radius:8px;padding:8px 10px;font-size:12px;color:#fff;outline:none;font-family:inherit;width:100%;box-sizing:border-box;min-height:80px;resize:vertical;">'+_esc(it.observacionesAdmin||'')+'</textarea>'
        +'<button onclick="cntEnviarCorreccionEv(\''+it._id+'\')" style="margin-top:8px;background:#c8940a;border:none;border-radius:10px;padding:9px 16px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;width:100%;">↩ Enviar al organizador</button>'
      +'</div>'
    : '';

  var accionesHtml = !esEliminado
    ? '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">'
        +(cntPuedePublicar()?'<button onclick="cntMostrarProgramarEv()" style="background:rgba(124,58,237,.15);border:.5px solid rgba(124,58,237,.3);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#a78bfa;cursor:pointer;font-family:inherit;">📅 Programar</button>':'')
        +(cntPuedeEditar()?'<button onclick="cntSolicitarCorreccionEv()" style="background:rgba(245,197,24,.1);border:.5px solid rgba(245,197,24,.2);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#e09000;cursor:pointer;font-family:inherit;">📝 Solicitar corrección</button>':'')
        +(cntPuedeEditar()?'<button onclick="cntDuplicarEvento(\''+it._id+'\')" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.1);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit;">⧉ Duplicar</button>':'')
        +(cntPuedeEliminar()?'<button onclick="cntSoftDeleteEvento(\''+it._id+'\')" style="background:rgba(214,58,42,.1);border:.5px solid rgba(214,58,42,.2);border-radius:10px;padding:7px 12px;font-size:11px;font-weight:600;color:#D63A2A;cursor:pointer;font-family:inherit;">🗑 Papelera</button>':'')
      +'</div>'
    : '';

  // Contenido en vista previa (layout público)
  var previewContent =
    '<div style="font-size:17px;font-weight:700;color:#fff;line-height:1.3;margin:12px 0 8px;">'+_esc(it.nombre||it.titulo||'Sin nombre')+'</div>'
    +(it.descripcion?'<div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:12px;white-space:pre-wrap;">'+_esc(it.descripcion)+'</div>':'')
    +(it.fecha?'<div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:4px;">📅 '+_fmt(it.fecha)+'</div>':'')
    +((it.lugar||it.ubicacion)?'<div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:4px;">📍 '+_esc(it.lugar||it.ubicacion)+'</div>':'')
    +(it.organizadorNombre?'<div style="font-size:12px;color:rgba(255,255,255,.25);margin-bottom:4px;">🎪 '+_esc(it.organizadorNombre)+'</div>':'')
    +(it.publicadoEn?'<div style="font-size:12px;color:rgba(31,194,106,.5);">🟢 Publicado '+_fmtDT(it.publicadoEn)+'</div>':'')
    +(it.observacionesAdmin?'<div style="margin-top:10px;padding:10px;background:rgba(245,197,24,.06);border:.5px solid rgba(245,197,24,.15);border-radius:10px;">'
        +'<div style="font-size:10px;font-weight:700;color:#e09000;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;">Observaciones</div>'
        +'<div style="font-size:12px;color:rgba(255,255,255,.5);white-space:pre-wrap;">'+_esc(it.observacionesAdmin)+'</div>'
      +'</div>':'');

  body.innerHTML =
    imgHtml
    +'<div class="cnt-field-row"><div class="cnt-field-lbl">Estado</div><div class="cnt-field-val" id="cnt-ev-estado-badge">'+_estadoBadge(it.estado||'pendiente')+'</div></div>'
    +statsHtml
    +previewContent
    +btnsHtml
    +accionesHtml
    +progHtml
    +corrHtml;
}

window.cntCambiarEstadoEv = async function(id, estado){
  if(estado==='publicado' && !cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  if(estado!=='publicado' && !cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;
  try {
    var F = await import(_FBFS);
    var upd = { estado:estado, actualizadoEn:F.serverTimestamp() };
    if(estado==='publicado') upd.publicadoEn = F.serverTimestamp();
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    Object.assign(it, upd);
    if(_cntEvEditing && _cntEvEditing._id===id) Object.assign(_cntEvEditing, upd);
    var badge = get('cnt-ev-estado-badge'); if(badge) badge.innerHTML = _estadoBadge(estado);
    _guardarBitacora(COL_EVENTOS, id, 'cambio_estado', {estado:estadoAntes}, {estado:estado});
    _showToast('Estado → '+estado);
    if(_cntEvEditing && _cntEvEditing._id===id) _renderEvEdit(_cntEvEditing);
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Eventos: programar ────────────────────────────────────────────────────────
window.cntMostrarProgramarEv = function(){
  var sec = get('cnt-ev-prog-section'); if(!sec) return;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cntGuardarProgramadoEv = async function(id){
  if(!cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var fechaEl = get('cnt-ev-prog-fecha');
  var fecha = fechaEl ? fechaEl.value : '';
  if(!fecha){ _showToast('Selecciona una fecha'); return; }
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;
  try {
    var F = await import(_FBFS);
    var upd = { estado:'programado', fechaProgramada:fecha, actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    Object.assign(it, upd);
    if(_cntEvEditing && _cntEvEditing._id===id) Object.assign(_cntEvEditing, upd);
    _guardarBitacora(COL_EVENTOS, id, 'programar', {estado:estadoAntes}, {estado:'programado', fechaProgramada:fecha});
    _showToast('✓ Programado para '+fecha);
    var sec = get('cnt-ev-prog-section'); if(sec) sec.style.display='none';
    var badge = get('cnt-ev-estado-badge'); if(badge) badge.innerHTML = _estadoBadge('programado');
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Eventos: solicitar corrección ─────────────────────────────────────────────
window.cntSolicitarCorreccionEv = function(){
  var sec = get('cnt-ev-corr-section'); if(!sec) return;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window.cntEnviarCorreccionEv = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var obsEl = get('cnt-ev-corr-obs');
  var obs = obsEl ? obsEl.value.trim() : '';
  if(!obs){ _showToast('Escribe las observaciones'); return; }
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;
  try {
    var F = await import(_FBFS);
    var upd = { estado:'requiere_correccion', observacionesAdmin:obs, actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    Object.assign(it, upd);
    if(_cntEvEditing && _cntEvEditing._id===id) Object.assign(_cntEvEditing, upd);
    _guardarBitacora(COL_EVENTOS, id, 'solicitar_correccion', {estado:estadoAntes}, {estado:'requiere_correccion', observaciones:obs});
    _showToast('↩ Enviado al organizador');
    var sec = get('cnt-ev-corr-section'); if(sec) sec.style.display='none';
    var badge = get('cnt-ev-estado-badge'); if(badge) badge.innerHTML = _estadoBadge('requiere_correccion');
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Eventos: vista previa ─────────────────────────────────────────────────────
window.cntVistaPreviaEv = function(id){
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || _cntEvEditing || {};
  _mostrarPreviewOverlay(it, '🎉');
};

// ── Eventos: soft delete ──────────────────────────────────────────────────────
window.cntSoftDeleteEvento = async function(id){
  if(!cntPuedeEliminar()){ _showToast('Sin permiso'); return; }
  if(!confirm('¿Mover evento a la papelera?')) return;
  var db = window._fbDb; if(!db) return;
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;
  try {
    var F = await import(_FBFS);
    var upd = { estado:'eliminado', eliminadoEn:F.serverTimestamp(), eliminadoPor:_uid() };
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    Object.assign(it, upd);
    if(_cntEvEditing && _cntEvEditing._id===id) Object.assign(_cntEvEditing, upd);
    _guardarBitacora(COL_EVENTOS, id, 'papelera', {estado:estadoAntes}, {estado:'eliminado'});
    _showToast('🗑 Movido a papelera');
    setTimeout(function(){ _nav('v-cnt-eventos','left'); }, 500);
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Eventos: restaurar ────────────────────────────────────────────────────────
window.cntRestaurarEvento = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  try {
    var F = await import(_FBFS);
    var upd = { estado:'pendiente', eliminadoEn:F.deleteField(), eliminadoPor:F.deleteField(), actualizadoEn:F.serverTimestamp() };
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    if(it){ it.estado='pendiente'; delete it.eliminadoEn; delete it.eliminadoPor; }
    if(_cntEvEditing && _cntEvEditing._id===id){ _cntEvEditing.estado='pendiente'; _renderEvEdit(_cntEvEditing); }
    _guardarBitacora(COL_EVENTOS, id, 'restaurar', {estado:'eliminado'}, {estado:'pendiente'});
    _showToast('↩ Restaurado como pendiente');
    window.cntCargarEventos();
  } catch(e){ _showToast('Error: '+e.message); }
};

// ── Eventos: duplicar ─────────────────────────────────────────────────────────
window.cntDuplicarEvento = async function(id){
  if(!cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var db = window._fbDb; if(!db) return;
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || _cntEvEditing || {};
  if(!it._id) return;
  try {
    var F = await import(_FBFS);
    var copia = {};
    ['nombre','titulo','descripcion','imagenes','imagen','portada','lugar','ubicacion','organizadorNombre','organizadorId','categoria','tags'].forEach(function(k){
      if(it[k] !== undefined) copia[k] = it[k];
    });
    copia.nombre    = 'Copia de '+(it.nombre||it.titulo||'sin nombre');
    copia.estado    = 'pendiente';
    copia.creadoEn  = F.serverTimestamp();
    copia.visitas   = 0; copia.compartidos = 0; copia.clics = 0;
    copia.favoritos = 0; copia.comentarios  = 0;
    copia.estadisticas = { visitas:0, compartidos:0, clics:0, favoritos:0, comentarios:0 };
    delete copia.publicadoEn; delete copia.fechaProgramada; delete copia.observacionesAdmin;
    var ref = await F.addDoc(F.collection(db, COL_EVENTOS), copia);
    _guardarBitacora(COL_EVENTOS, ref.id, 'duplicar', null, {copiadoDe:id, nombre:copia.nombre});
    _showToast('⧉ Duplicado como pendiente');
    window.cntCargarEventos();
  } catch(e){ _showToast('Error: '+e.message); }
};

window.cntMenuEvento = function(id){
  var it = _cntEvItems.find(function(x){ return x._id===id; });
  if(!it) return;
  var overlay = get('cnt-menu-overlay'), sheet = get('cnt-menu-sheet');
  if(!overlay||!sheet) return;
  sheet.innerHTML =
    '<div style="text-align:center;padding:10px 0 14px;">'
    +'<div style="width:36px;height:4px;background:rgba(255,255,255,.12);border-radius:4px;margin:0 auto 12px;"></div>'
    +'<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;">'+_esc((it.nombre||it.titulo||'').slice(0,40))+'</div>'
    +_estadoBadge(it.estado)+'</div>'
    +'<div class="cnt-menu-row" onclick="cntAbrirEvento(\''+id+'\');cntCerrarMenu()">👁 Ver detalle</div>'
    +(cntPuedePublicar()&&it.estado!=='publicado'?'<div class="cnt-menu-row ok" onclick="cntCambiarEstadoEvLista(\''+id+'\',\'publicado\')">✓ Publicar</div>':'')
    +(cntPuedeEditar()&&it.estado!=='rechazado'?'<div class="cnt-menu-row del" onclick="cntCambiarEstadoEvLista(\''+id+'\',\'rechazado\')">✕ Rechazar</div>':'')
    +(cntPuedeEliminar()?'<div class="cnt-menu-row del" onclick="cntSoftDeleteEventoLista(\''+id+'\')">🗑 Mover a papelera</div>':'');
  overlay.style.display = 'flex';
  setTimeout(function(){ sheet.style.transform='translateY(0)'; }, 10);
};

window.cntCambiarEstadoEvLista = async function(id, estado){
  cntCerrarMenu();
  if(estado==='publicado' && !cntPuedePublicar()){ _showToast('Sin permiso'); return; }
  if(estado!=='publicado' && !cntPuedeEditar()){ _showToast('Sin permiso'); return; }
  var it = _cntEvItems.find(function(x){ return x._id===id; });
  var db = window._fbDb; if(!db) return;
  var estadoAntes = it ? it.estado : null;
  try {
    var F = await import(_FBFS);
    var upd = { estado:estado, actualizadoEn:F.serverTimestamp() };
    if(estado==='publicado') upd.publicadoEn = F.serverTimestamp();
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    if(it) Object.assign(it, upd);
    _guardarBitacora(COL_EVENTOS, id, 'cambio_estado', {estado:estadoAntes}, {estado:estado});
    _showToast('Estado → '+estado);
    window.cntCargarEventos();
  } catch(e){ _showToast('Error'); }
};

window.cntSoftDeleteEventoLista = async function(id){
  cntCerrarMenu();
  if(!cntPuedeEliminar()){ _showToast('Sin permiso'); return; }
  if(!confirm('¿Mover evento a la papelera?')) return;
  var db = window._fbDb; if(!db) return;
  var it = _cntEvItems.find(function(x){ return x._id===id; }) || {};
  var estadoAntes = it.estado;
  try {
    var F = await import(_FBFS);
    var upd = { estado:'eliminado', eliminadoEn:F.serverTimestamp(), eliminadoPor:_uid() };
    await F.updateDoc(F.doc(db, COL_EVENTOS, id), upd);
    if(it) Object.assign(it, upd);
    _guardarBitacora(COL_EVENTOS, id, 'papelera', {estado:estadoAntes}, {estado:'eliminado'});
    _showToast('🗑 Movido a papelera');
    window.cntCargarEventos();
  } catch(e){ _showToast('Error'); }
};

// cntEliminarEvento — mantenida por compatibilidad, delegada a soft delete desde lista
window.cntEliminarEvento = function(id){ cntSoftDeleteEventoLista(id); };

// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCIAS
// ══════════════════════════════════════════════════════════════════════════════
window.cntCargarEmergencias = async function(){
  var listEl = get('cnt-emerg-body');
  if(!listEl) return;
  listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px;">Cargando...</div>';

  var db = window._fbDb;
  if(!db){ listEl.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);">Sin conexión</div>'; return; }

  try {
    var F = await import(_FBFS);
    var snap;
    try {
      var q = F.query(F.collection(db, COL_EMERG), F.orderBy('orden','asc'));
      snap = await F.getDocs(q);
    } catch(_){
      snap = await F.getDocs(F.collection(db, COL_EMERG));
    }
    _cntEmerg = snap.docs.map(function(d){ return Object.assign({_id:d.id}, d.data()); });
    _cntEmerg.sort(function(a,b){ return (a.orden||0)-(b.orden||0); });
  } catch(e){
    listEl.innerHTML = '<div style="padding:30px 20px;text-align:center;"><div style="font-size:28px;margin-bottom:10px;">⚠️</div>'
      +'<div style="color:#D63A2A;font-size:12px;font-weight:700;">Error al cargar</div>'
      +'<div style="color:rgba(255,255,255,.3);font-size:11px;margin-top:6px;">'+_esc(e.message)+'</div></div>';
    return;
  }
  _renderEmergencias();
};

function _renderEmergencias(){
  var listEl = get('cnt-emerg-body');
  if(!listEl) return;
  if(!_cntEmerg.length){
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;">'
      +'<div style="font-size:36px;margin-bottom:12px;">🚨</div>'
      +'<div style="color:rgba(255,255,255,.35);font-size:13px;margin-bottom:20px;">Sin contactos de emergencia</div>'
      +'<button onclick="cntNuevaEmergencia()" style="background:#D63A2A;border:none;border-radius:12px;padding:12px 20px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;">+ Agregar contacto</button>'
      +'</div>';
    return;
  }
  listEl.innerHTML = _cntEmerg.map(function(em, i){
    var activo = em.estado !== 'inactivo';
    return '<div class="cnt-emerg-row">'
      +'<div class="cnt-emerg-num">'+String(i+1).padStart(2,'0')+'</div>'
      +'<div class="cnt-emerg-drag">⠿</div>'
      +'<div class="cnt-emerg-ic">'+_esc(em.icono||'🚨')+'</div>'
      +'<div class="cnt-emerg-info">'
        +'<div class="cnt-emerg-nombre">'+_esc(em.nombre||'Sin nombre')+'</div>'
        +'<div class="cnt-emerg-desc">'+_esc((em.descripcion||em.categoria||'').slice(0,40))+'</div>'
      +'</div>'
      +(activo
        ? '<span class="cnt-emerg-badge">Activo</span>'
        : '<span class="cnt-emerg-badge inactivo">Inactivo</span>')
      +'<button class="cnt-3dot" style="font-size:18px;" onclick="cntEditarEmergencia(\''+em._id+'\')">›</button>'
    +'</div>';
  }).join('');
}

window.cntEditarEmergencia = function(id){
  var em = _cntEmerg.find(function(x){ return x._id===id; });
  if(!em) return;
  _cntEmergEdit = JSON.parse(JSON.stringify(em));
  _renderEmergEdit(false);
  _nav('v-cnt-emerg-edit');
};

window.cntNuevaEmergencia = function(){
  _cntEmergEdit = { icono:'🚨', nombre:'', descripcion:'', categoria:'Emergencias', estado:'activo', acciones:[], orden:_cntEmerg.length };
  _renderEmergEdit(true);
  _nav('v-cnt-emerg-edit');
};

function _tipoIcon(t){
  return {llamada:'📞',whatsapp:'💬',maps:'📍',correo:'✉️',web:'🌐',otro:'⚡'}[t]||'⚡';
}

function _renderEmergEdit(isNew){
  var em = _cntEmergEdit || {};
  var h = get('cnt-emerg-edit-titulo'); if(h) h.textContent = isNew ? 'Nuevo Contacto' : 'Editar Contacto';
  var s = get('cnt-emerg-edit-sub');    if(s) s.textContent = em.nombre||'';
  var body = get('cnt-emerg-edit-body'); if(!body) return;

  var acciones = em.acciones||[];
  var accionesHtml = acciones.map(function(ac, i){
    return '<div style="display:flex;gap:6px;align-items:center;background:rgba(255,255,255,.04);border-radius:10px;padding:8px 10px;margin-bottom:6px;">'
      +'<select onchange="_cntAcTipo('+i+',this.value)" style="background:#0C1A10;border:.5px solid rgba(255,255,255,.1);border-radius:8px;padding:5px 6px;font-size:11px;color:#fff;outline:none;font-family:inherit;flex-shrink:0;">'
        +['llamada','whatsapp','maps','correo','web','otro'].map(function(t){
          return '<option value="'+t+'"'+(ac.tipo===t?' selected':'')+'>'+_tipoIcon(t)+' '+t+'</option>';
        }).join('')
      +'</select>'
      +'<input placeholder="Etiqueta" value="'+_esc(ac.etiqueta||'')+'" oninput="_cntAcEtiqueta('+i+',this.value)" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 8px;font-size:12px;color:#fff;outline:none;font-family:inherit;flex:1;min-width:0;">'
      +'<input placeholder="Teléfono / URL..." value="'+_esc(ac.valor||'')+'" oninput="_cntAcValor('+i+',this.value)" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.08);border-radius:8px;padding:5px 8px;font-size:12px;color:#fff;outline:none;font-family:inherit;flex:1;min-width:0;">'
      +'<button onclick="_cntEliminarAccion('+i+')" style="background:none;border:none;color:rgba(255,255,255,.3);font-size:14px;cursor:pointer;padding:0 4px;font-family:inherit;">✕</button>'
    +'</div>';
  }).join('');

  body.innerHTML =
    '<div class="cnt-form-group"><div class="cnt-form-lbl">Ícono</div>'
    +'<input class="cnt-form-input" id="cnt-ef-icono" value="'+_esc(em.icono||'🚨')+'" maxlength="4" style="font-size:22px;text-align:center;width:60px;"></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Nombre del servicio</div>'
    +'<input class="cnt-form-input" id="cnt-ef-nombre" value="'+_esc(em.nombre||'')+'" placeholder="Cruz Roja, Bomberos..."></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Descripción</div>'
    +'<input class="cnt-form-input" id="cnt-ef-desc" value="'+_esc(em.descripcion||'')+'" placeholder="Descripción corta"></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Categoría</div>'
    +'<select class="cnt-form-input" id="cnt-ef-cat">'
      +['Emergencias','Seguridad','Salud','Bomberos','Municipio','Otro'].map(function(c){
        return '<option'+(em.categoria===c?' selected':'')+'>'+c+'</option>';
      }).join('')
    +'</select></div>'
    +'<div class="cnt-form-group"><div class="cnt-form-lbl">Estado</div>'
    +'<select class="cnt-form-input" id="cnt-ef-estado">'
      +'<option value="activo"'+(em.estado!=='inactivo'?' selected':'')+'>Activo</option>'
      +'<option value="inactivo"'+(em.estado==='inactivo'?' selected':'')+'>Inactivo</option>'
    +'</select></div>'
    +'<div style="margin-top:16px;">'
    +'<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Acciones de contacto</div>'
    +'<div id="cnt-acciones-list">'+accionesHtml+'</div>'
    +'<button onclick="cntAgregarAccion()" style="background:rgba(255,255,255,.06);border:.5px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 14px;font-size:12px;color:rgba(255,255,255,.6);cursor:pointer;font-family:inherit;margin-top:6px;">+ Agregar acción</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:20px;">'
    +'<button onclick="cntGuardarEmergencia()" class="cnt-btn-save" style="flex:1;">💾 Guardar</button>'
    +(!isNew?'<button onclick="cntEliminarEmergencia(\''+em._id+'\')" class="cnt-btn-del">🗑</button>':'')
    +'</div>';
}

window._cntAcTipo      = function(i,v){ if(_cntEmergEdit&&_cntEmergEdit.acciones[i]) _cntEmergEdit.acciones[i].tipo=v; };
window._cntAcEtiqueta  = function(i,v){ if(_cntEmergEdit&&_cntEmergEdit.acciones[i]) _cntEmergEdit.acciones[i].etiqueta=v; };
window._cntAcValor     = function(i,v){ if(_cntEmergEdit&&_cntEmergEdit.acciones[i]) _cntEmergEdit.acciones[i].valor=v; };

window.cntAgregarAccion = function(){
  if(!_cntEmergEdit) return;
  if(!_cntEmergEdit.acciones) _cntEmergEdit.acciones = [];
  _cntEmergEdit.acciones.push({tipo:'llamada',etiqueta:'',valor:'',orden:_cntEmergEdit.acciones.length,estado:'activo'});
  _renderEmergEdit(!_cntEmergEdit._id);
};

window._cntEliminarAccion = function(i){
  if(!_cntEmergEdit||!_cntEmergEdit.acciones) return;
  _cntEmergEdit.acciones.splice(i,1);
  _renderEmergEdit(!_cntEmergEdit._id);
};

window.cntGuardarEmergencia = async function(){
  if(!_cntEmergEdit) return;
  var db = window._fbDb; if(!db) return;

  var icono  = (get('cnt-ef-icono')||{}).value  || '🚨';
  var nombre = (get('cnt-ef-nombre')||{}).value || '';
  var desc   = (get('cnt-ef-desc')||{}).value   || '';
  var cat    = (get('cnt-ef-cat')||{}).value     || 'Emergencias';
  var estado = (get('cnt-ef-estado')||{}).value  || 'activo';

  if(!nombre.trim()){ alert('El nombre es obligatorio'); return; }

  var data = {
    icono:icono.trim(), nombre:nombre.trim(), descripcion:desc.trim(),
    categoria:cat, estado:estado, acciones:_cntEmergEdit.acciones||[], orden:_cntEmergEdit.orden||0,
  };

  try {
    var F = await import(_FBFS);
    if(_cntEmergEdit._id){
      await F.updateDoc(F.doc(db, COL_EMERG, _cntEmergEdit._id), data);
      var idx = _cntEmerg.findIndex(function(x){ return x._id===_cntEmergEdit._id; });
      if(idx>=0) _cntEmerg[idx] = Object.assign({_id:_cntEmergEdit._id}, data);
    } else {
      data.creadoEn = F.serverTimestamp();
      var ref = await F.addDoc(F.collection(db, COL_EMERG), data);
      _cntEmerg.push(Object.assign({_id:ref.id}, data));
    }
    _showToast('✓ Guardado');
    if(window._goCore) window._goCore('v-cnt-emergencias','left');
    else if(window.go) window.go('v-cnt-emergencias','left');
    setTimeout(function(){ _renderEmergencias(); }, 320);
  } catch(e){ _showToast('Error: '+e.message); }
};

window.cntEliminarEmergencia = async function(id){
  if(!confirm('¿Eliminar este contacto?')) return;
  var db = window._fbDb; if(!db) return;
  try {
    var F = await import(_FBFS);
    await F.deleteDoc(F.doc(db, COL_EMERG, id));
    _cntEmerg = _cntEmerg.filter(function(x){ return x._id!==id; });
    _showToast('Eliminado');
    if(window._goCore) window._goCore('v-cnt-emergencias','left');
    else if(window.go) window.go('v-cnt-emergencias','left');
    setTimeout(function(){ _renderEmergencias(); }, 320);
  } catch(e){ _showToast('Error'); }
};

// ── Toast ─────────────────────────────────────────────────────────────────────
var _toastTimer = null;
function _showToast(msg){
  var t = get('cnt-toast'); if(!t) return;
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2500);
}

})();
