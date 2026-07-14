/* ════════════════════════════════════════════════════════
   MÓDULO FOOD DC
   ════════════════════════════════════════════════════════ */
'use strict';
// ════════════════════════════════════════════════════════
// MÓDULO RESTAURANTES — Dominio Cumbres
// Prefijo funciones: dcFood_   Prefijo IDs: v-  (vistas internas)
// ════════════════════════════════════════════════════════

/* ── Estado ──────────────────────────────────────────── */
var _S = {
  rest: null, carrito:{}, metodoPago:'efectivo',
  recepcion:'domicilio', tipoEntregaInterna:'tienda',
  pedidoId:null, trackUnsub:null,
  starsRest:0, starsRep:0,
  restTab:'activos',
  historial:[], filtro:'todos'
};
var _isDemo = !(window._fbAuth && window._fbDb);

var _DR = [];
var _DM = {};
var _DPrest = [];
var _DPvec = [];
var _DPrep = [];

/* ── XSS helper ──────────────────────────────────────── */
function _fesc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ── Helpers Firestore ───────────────────────────────── */
async function _fb() {
  return await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
}
function _db() { return window._fbDb; }
function _uid() { return window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid; }
function _uname() { return localStorage.getItem('dcuser') || 'Usuario'; }
function _isD() { return !(_uid() && _db()); }

/* ── Navegación ─────────────────────────────────────── */
function _dcfNav(to) {
  // Mapa de IDs internos del módulo → IDs reales del index + dirección
  var MAP = {
    'v-lista':              ['v-food',             'left'],
    'v-detalle':            ['v-food-det',          'right'],
    'v-food-det':           ['v-food-det',          'right'],
    'dcf-carrito':          ['v-carrito',           'right'],
    'v-carrito':            ['v-carrito',           'right'],
    'dcf-tracking':         ['v-tracking',          'right'],
    'v-tracking':           ['v-tracking',          'right'],
    'v-mispedidos':         ['v-mis-pedidos-food',  'right'],
    'v-mis-pedidos-food':   ['v-mis-pedidos-food',  'right'],
    'v-transferencia':      ['v-transferencia',     'right'],
    'v-transferencia-food': ['v-transferencia',     'right'],
  };
  var resolved = MAP[to] || [to, 'right'];
  go(resolved[0], resolved[1]);
}
function _dcfNavRest(to) {
  var cur = document.querySelector('.dcf-view.active');
  var nxt = document.getElementById(to);
  if (!cur || !nxt || cur === nxt) return;
  cur.classList.remove('active'); cur.classList.add('prev');
  nxt.classList.add('active');
  setTimeout(function(){ cur.classList.remove('prev'); }, 320);
  if (to === 'v-pedidos-rest') dcFood_cargarPedidosRest();
  if (to === 'v-menu-admin') dcFood_cargarMenuAdmin();
  if (to === 'v-panel-rest') dcFood_cargarPanelRest();
}

/* ── Filtrar lista ──────────────────────────────────── */
function _dcfFiltrar(cat, btn) {
  document.querySelectorAll('#v-food .dcf-chip').forEach(function(b){b.classList.remove('dcf-on');});
  if (btn && btn.classList) btn.classList.add('dcf-on');
  _S.filtro = cat || 'todos';
  var sel = document.getElementById('dcf-cat-select');
  if (sel && sel.value !== _S.filtro) sel.value = _S.filtro;
  _dcfRenderLista(_S.historial);
}
function _dcfFiltrarSel(cat) {
  _dcfFiltrar(cat || 'todos', null);
  if (window._dcDirtyV === 'v-food') window._dcDirtyV = null;
}

/* ── Restaurantes donde el vecino tiene pedido entregado ── */
var _S_restConPedido = new Set();
async function _cargarRestConPedido() {
  var uid = _uid();
  if (!uid || _isD()) return;
  try {
    var f = await _fb(); var db = _db();
    var snap = await f.getDocs(f.query(
      f.collection(db,'pedidos'),
      f.where('vecinoId','==',uid),
      f.where('estado','==','entregado')
    ));
    _S_restConPedido = new Set();
    snap.forEach(function(d){ var p=d.data(); if(p.restauranteId) _S_restConPedido.add(p.restauranteId); });
  } catch(e) {}
}

/* ── Horario próximo de apertura ── */
function _proximaApertura(horarios) {
  if (!horarios || !horarios.length) return '';
  var now = new Date();
  var hhmm = now.getHours()*60 + now.getMinutes();
  // Ordenar por inicio
  var sorted = horarios.slice().sort(function(a,b){
    var ah=parseInt((a.inicio||'0:0').split(':')[0])*60+parseInt((a.inicio||'0:0').split(':')[1]||0);
    var bh=parseInt((b.inicio||'0:0').split(':')[0])*60+parseInt((b.inicio||'0:0').split(':')[1]||0);
    return ah-bh;
  });
  for (var i=0;i<sorted.length;i++) {
    var parts=(sorted[i].inicio||'').split(':');
    var min=parseInt(parts[0]||0)*60+parseInt(parts[1]||0);
    if (min > hhmm) {
      var h=parseInt(parts[0]||0), m=parseInt(parts[1]||0);
      var ampm=h>=12?'pm':'am'; var h12=h>12?h-12:(h===0?12:h);
      return 'Abre a las '+h12+(m?':'+String(m).padStart(2,'0'):'')+ampm;
    }
  }
  // Todos los horarios ya pasaron — el primero del día siguiente
  var parts2=(sorted[0].inicio||'').split(':');
  var h=parseInt(parts2[0]||0), m=parseInt(parts2[1]||0);
  var ampm=h>=12?'pm':'am'; var h12=h>12?h-12:(h===0?12:h);
  return 'Abre mañana a las '+h12+(m?':'+String(m).padStart(2,'0'):'')+ampm;
}

/* ── Cargar restaurantes ────────────────────────────── */
window.dcFood_cargarRestaurantes = async function() {
  var cont = document.getElementById('lista-cont');
  var subEl = document.getElementById('lista-sub');
  if (!cont) return;
  cont.innerHTML = '<div class="loading">Buscando...</div>';
  if (_isD()) {
    _S.historial = _DR;
    if (subEl) subEl.textContent = _DR.length + ' disponibles';
    _dcfRenderLista(_DR); return;
  }
  var CATS_FOOD=['mexicana','hamburguesas','pizzas','sushi','cafeteria','postres','tacos','mariscos','pollo','desayunos','bebidas','otro_rest'];
  var ESTADOS_OK=['activo','aprobado_pendiente_pago'];
  try {
    var f = await _fb(); var db = _db();
    var [sR,sN] = await Promise.all([
      f.getDocs(f.query(f.collection(db,'usuarios'),f.where('tipo','==','restaurante'))),
      f.getDocs(f.query(f.collection(db,'usuarios'),f.where('tipo','==','negocio')))
    ]);
    var docs=[];
    sR.forEach(function(d){
      var r=d.data();
      if(ESTADOS_OK.indexOf(r.estado)!==-1) docs.push(Object.assign({_id:d.id},r));
    });
    sN.forEach(function(d){
      var r=d.data();
      if(ESTADOS_OK.indexOf(r.estado)===-1) return;
      var cat=(r.categoria||'').toLowerCase();
      if(CATS_FOOD.indexOf(cat)===-1) return;
      docs.push(Object.assign({_id:d.id},r));
    });
    _S.historial = docs;
    if (subEl) subEl.textContent = docs.length > 0 ? docs.length + ' disponibles' : 'Sin restaurantes activos';
    _cargarRestConPedido().then(function(){ _dcfRenderLista(docs); });
  } catch(e) {
    cont.innerHTML = '<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error: '+e.message+'</div></div>';
  }
};

function _entregaLabel(entr) {
  // Mapeo de valores reales del campo 'entrega' a etiquetas legibles
  // recolecta = solo recoger en tienda
  // propia    = repartidor propio de la tienda
  // ride      = Repartidor DC
  // todas     = repartidor propio + Repartidor DC
  if(entr === 'recolecta') return '🏪 Recoger en tienda';
  if(entr === 'propia')    return '🚚 Entrega Repartidor Tienda';
  if(entr === 'ride')      return '🛵 Entrega Repartidor DC';
  if(entr === 'todas')     return '🛵🚚 Entrega Repartidor DC/Tienda';
  return '🛵 Entrega disponible'; // fallback
}
function _deriveFlags(r){
  // Derive permiteRecoger/permiteEntrega/entregaInterna from entrega string
  // Returns object with original fields + derived flags
  if(typeof r.permiteRecoger !== 'undefined') return r; // already has flags
  var entr=r.entrega||'propia'; var flags={};
  if(entr==='recolecta'){flags.permiteRecoger=true; flags.permiteEntrega=false; flags.entregaInterna='recolecta';}
  else if(entr==='propia') {flags.permiteRecoger=false;flags.permiteEntrega=true; flags.entregaInterna='tienda';}
  else if(entr==='ride')   {flags.permiteRecoger=false;flags.permiteEntrega=true; flags.entregaInterna='dc';}
  else if(entr==='todas')  {flags.permiteRecoger=true; flags.permiteEntrega=true; flags.entregaInterna='dc_tienda';}
  else                     {flags.permiteRecoger=false;flags.permiteEntrega=true; flags.entregaInterna='tienda';}
  return Object.assign({},r,flags);
}
function _calcRecepcion(entr){
  if(entr==='recolecta') return {recepcion:'recoger',tipoEntregaInterna:'recolecta'};
  if(entr==='propia')    return {recepcion:'domicilio',tipoEntregaInterna:'tienda'};
  if(entr==='ride')      return {recepcion:'domicilio',tipoEntregaInterna:'dc'};
  if(entr==='todas')     return {recepcion:'domicilio',tipoEntregaInterna:'dc_tienda'};
  return {recepcion:'domicilio',tipoEntregaInterna:'tienda'};
}

var _EMOJIS={tacos:'🌮',mexicana:'🌮',pizzas:'🍕',sushi:'🍣',hamburguesas:'🍔',cafeteria:'☕',mariscos:'🦞',pollo:'🍗',postres:'🧁',desayunos:'🍳',bebidas:'🥤',otro_rest:'🍽️',otro:'🍽️'};
function _dcfRenderLista(docs) {
  var cont = document.getElementById('lista-cont');
  if (!cont) return;
  var f = _S.filtro;
  var lista = f==='todos' ? docs : docs.filter(function(r){return (r.categoria||'').toLowerCase()===f;});
  if (!lista.length) { cont.innerHTML='<div class="empty"><div class="empty-ic">🍽️</div><div class="empty-tit">Sin restaurantes en esta categoría</div></div>'; return; }
  cont.innerHTML = lista.map(function(r) {
    var cat=(r.categoria||'otro_rest').toLowerCase();
    var em=_EMOJIS[cat]||'🍽️';
    var entr=r.entrega||'propia';
    var envStr=_entregaLabel(entr);
    var catBg={tacos:'#FFF3E0',mexicana:'#FFF3E0',pizzas:'#FBE9E7',hamburguesas:'#FFF8E1',sushi:'#E3F2FD',cafeteria:'#EFEBE9',mariscos:'#E0F7FA',pollo:'#FFF9C4',postres:'#FCE4EC',desayunos:'#F9FBE7',bebidas:'#E8F5E9'};
    var bg=catBg[cat]||'#FFF8E1';

    // Estado efectivo — usa el helper canónico window._calcEstadoHorario
    // Misma fuente que "Cómo me ve el cliente" (cmvRenderPreview → _estadoEfectivo → _calcEstadoHorario)
    // Recibe r.horarios del DOC de este restaurante — no variables globales, no localStorage
    // REGLA UNIVERSAL DE ESTADO — mismo helper canónico para todos los usuarios
    var estOp = (typeof window._estadoEfectivoDe === 'function')
      ? window._estadoEfectivoDe(r.estadoOp, r.estadoOpTs || 0, r.horarios && r.horarios.length ? r.horarios : null)
      : (r.estadoOp || 'activo');

    var estLabel, estStyle;
    // Cierre automático por horario vs cierre manual
    var cierreManual = (r.estadoOp === 'cerrado');
    var proximaApert = (estOp === 'cerrado' && !cierreManual) ? _proximaApertura(r.horarios) : '';
    if (estOp === 'cerrado') {
      estLabel = '🔴 Cerrado';
      estStyle = 'background:#FDECEA;color:#D63A2A;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;';
    } else if (estOp === 'pausado') {
      estLabel = '🟠 Pausado';
      estStyle = 'background:#FFF0E6;color:#E87722;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;';
    } else if (estOp === 'ocupado') {
      estLabel = '🟡 Ocupado';
      estStyle = 'background:#FFF8E1;color:#d97706;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;';
    } else {
      estLabel = '🟢 Abierto';
      estStyle = 'background:var(--green-lt);color:var(--green-dk);font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;';
    }
    // Calificar: solo si el vecino tiene un pedido entregado de este restaurante
    var puedeCal = _S_restConPedido.has(r._id);
    var calBtn = puedeCal
      ? '<button data-rate-id="'+_fesc(r._id)+'" onclick="event.stopPropagation();window.dcRatingAbrirPopup&&window.dcRatingAbrirPopup(\''+_fesc(r._id)+'\',\''+_fesc(r.nombreNegocio||r.nombre||'')+'\',event)" style="background:#FFF8DC;border:1px solid #F5C518;border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:#9a7020;cursor:pointer;font-family:inherit;white-space:nowrap;">⭐ Calificar</button>'
      : '<span style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:#bbb;white-space:nowrap;" title="Pide aquí para poder calificar">⭐ Calificar</span>';
    return '<div class="dcf-rcard" onclick="dcFood_abrirRest(\''+r._id+'\')" style="'+(estOp==='cerrado'?'opacity:.6;filter:grayscale(.4);':'')+'">'
      +'<div class="rbanner" style="background:'+bg+';">'
      +(r.fotoPerfil && r.fotoPerfil.indexOf('data:image')===0
        ? '<img src="'+r.fotoPerfil+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:0;">'
        : em)
      +(estOp==='cerrado' ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="background:#D63A2A;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;letter-spacing:.3px;">🔴 CERRADO</span>'+(proximaApert?'<span style="background:rgba(0,0,0,.5);color:#fff;font-size:10px;font-weight:600;padding:2px 10px;border-radius:20px;">'+_fesc(proximaApert)+'</span>':'')+'</div>' : '')
      +'<span class="rbadge">'+(r.estado==='aprobado_pendiente_pago'?'⏳ Pend. pago':'✓ Verificado')+'</span></div>'
      +'<div class="rbody">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;">'
      +'<div class="rname">'+_fesc(r.nombreNegocio||r.nombre||'—')+'</div>'
      +'<span style="'+estStyle+'">'+estLabel+'</span></div>'
      +(proximaApert && estOp==='cerrado' ? '<div style="font-size:10px;color:#D63A2A;font-weight:600;margin-top:2px;">'+_fesc(proximaApert)+'</div>' : '')
      +'<div style="font-size:11px;color:var(--tx2);margin-top:3px;">'+(r.ratingPromedio?'⭐ '+Number(r.ratingPromedio).toFixed(1)+' <span onclick="event.stopPropagation();window.dcRatingVerComentarios&&window.dcRatingVerComentarios(\''+_fesc(r._id)+'\',\'restaurante\',event)" style="color:var(--blue,#1a6fbf);text-decoration:underline;cursor:pointer;font-weight:700;">('+( r.ratingTotal||0)+' op.)</span> ·':'')+_fesc(r.descripcion||cat)+'</div>'
      +'<div class="rfooter" style="align-items:center;">'
      +calBtn
      +'<span class="link-green">Pedir →</span>'
      +'</div></div></div>';
  }).join('');
  setTimeout(function(){window._rpIniciarBotonesVecino&&window._rpIniciarBotonesVecino();},50);
}

/* ── Abrir restaurante ───────────────────────────────── */
window.dcFood_abrirRest = async function(restId) {
  dcFood_scrollReset('v-food-det');
  var r = _S.historial.find(function(x){return x._id===restId;});
  if (!r) return;

  // ── Calcular estado efectivo — mismo helper canónico que cmvRenderPreview
  var estEfect = (typeof window._estadoEfectivoDe === 'function')
    ? window._estadoEfectivoDe(r.estadoOp, r.estadoOpTs || 0, r.horarios && r.horarios.length ? r.horarios : null)
    : (r.estadoOp || 'activo');

  // ── Bloquear entrada si cerrado o pausado — mostrar modal propio
  if (estEfect === 'cerrado' || estEfect === 'pausado') {
    var _esPausa = (estEfect === 'pausado');
    // Quitar overlay anterior si existe
    var prevOv = document.getElementById('dcf-cerrado-ov');
    if (prevOv) prevOv.remove();
    var ov = document.createElement('div');
    ov.id = 'dcf-cerrado-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9990;display:flex;align-items:center;justify-content:center;padding:24px;';
    ov.innerHTML = '<div style="background:#fff;border-radius:22px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.3);">'
      + '<div style="font-size:42px;margin-bottom:12px;">' + (_esPausa ? '⏸️' : '🔴') + '</div>'
      + '<div style="font-size:17px;font-weight:800;color:#111;margin-bottom:8px;">' + _fesc(r.nombreNegocio||r.nombre||'Restaurante') + '</div>'
      + '<div style="font-size:13px;color:#666;line-height:1.5;margin-bottom:22px;">' + (_esPausa ? 'Por el momento no está atendiendo.<br>Vuelve en un rato.' : 'Este restaurante ya cerró por hoy.<br>Vuelve mañana.') + '</div>'
      + '<button onclick="document.getElementById(\'dcf-cerrado-ov\').remove()" style="width:100%;padding:13px;background:#111;color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Entendido</button>'
      + '</div>';
    document.body.appendChild(ov);
    return; // NO navegar al restaurante
  }

  // ── Restaurante abierto — flujo normal
  if (_S.rest && _S.rest._id !== restId) _S.carrito = {};
  _S.rest = _deriveFlags(r);
  _S.rest._estadoEfectivo = estEfect;
  _S._avisoOcupadoOk = false;
  window._dcfPintarBadgeEstado && window._dcfPintarBadgeEstado(estEfect);
  // REGLA UNIVERSAL #3: escuchar en vivo el estado del restaurante (sin refresh)
  window._dcfConectarEstadoVivo && window._dcfConectarEstadoVivo(restId);
  _S.recepcion = _S.rest.permiteEntrega ? 'domicilio' : 'recoger';
  var g=function(id){return document.getElementById(id);};
  if(g('dcf-det-nombre'))g('dcf-det-nombre').textContent=r.nombreNegocio||r.nombre||'—';
  if(g('dcf-det-desc'))g('dcf-det-desc').textContent=r.descripcion||'';
  if(g('det-tiempo'))g('det-tiempo').textContent='🍳 Preparación: por confirmar';
  var _entr=r.entrega||'propia';
  if(g('det-envio'))g('det-envio').textContent=_entregaLabel(_entr);
  // Mostrar dirección de recogida si existe (direccionNegocio es la fuente principal)
  var elDirR = g('det-dir-recogida');
  if (elDirR) {
    var _dirNegRest = r.direccionNegocio || r.direccionRecogida || '';
    if (_dirNegRest) {
      elDirR.textContent = '📍 Recoger en: ' + _dirNegRest;
      elDirR.style.display = 'inline-flex';
    } else {
      elDirR.style.display = 'none';
    }
  }
  _dcfNav('v-food-det');
  await dcFood_cargarMenu(restId);
};

/* ── Cargar menú ────────────────────────────────────── */
window.dcFood_cargarMenu = async function(restId) {
  var el = document.getElementById('det-menu');
  if (!el) return;
  el.innerHTML = '<div class="loading">Cargando menú...</div>';

  // ── MODO DEMO ────────────────────────────────────────────────
  if (_isD()) {
    var prods = _DM[restId] || [];
    if (!prods.length) {
      el.innerHTML='<div class="empty"><div class="empty-ic">🍽️</div><div class="empty-tit">Sin menú disponible</div><div class="empty-sub">Este restaurante aún no tiene menú disponible.</div></div><div style="height:80px;"></div>';
      _updateCartBar(); return;
    }
    _renderMenu(el, prods); return;
  }

  // ── MODO FIRESTORE ───────────────────────────────────────────
  try {
    var f=await _fb();
    var snap=await f.getDocs(f.query(f.collection(_db(),'menu',restId,'productos'),f.orderBy('orden','asc')));
    if (snap.empty) {
      el.innerHTML='<div class="empty"><div class="empty-ic">🍽️</div><div class="empty-tit">Sin menú disponible</div><div class="empty-sub">Este restaurante aún no tiene menú disponible.</div></div><div style="height:80px;"></div>';
      _updateCartBar(); return;
    }
    var prods=[]; snap.forEach(function(d){prods.push(Object.assign({_id:d.id},d.data()));});
    _renderMenu(el, prods);
  } catch(e) {
    el.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error al cargar</div><div class="empty-sub">'+e.message+'</div></div>';
  }
};

function _renderMenu(el, prods) {
  var cats={};
  prods.forEach(function(p){var c=p.categoria||'General';if(!cats[c])cats[c]=[];cats[c].push(p);});
  var html='';
  Object.keys(cats).forEach(function(cat){
    html+='<div class="msec">'+cat+'</div>';
    cats[cat].forEach(function(p){
      var qty=(_S.carrito[p._id]&&_S.carrito[p._id].cantidad)||0;
      var disp=p.disponible!==false;
      var n=(p.nombre||'').replace(/'/g,"&#39;");
      var c=(p.categoria||'').replace(/'/g,"&#39;");
      var tieneFoto = p.foto && (p.foto.indexOf('data:image')===0 || p.foto.indexOf('https://')===0);

      if (tieneFoto) {
        // Layout vertical con foto grande arriba
        html+='<div class="mitem'+(disp?'':' agotado')+'" style="flex-direction:column;align-items:stretch;padding:0;overflow:hidden;">'
          +'<div style="width:100%;height:160px;overflow:hidden;cursor:pointer;position:relative;" onclick="_dcfZoomFoto(\''+p._id+'\')">'
          +'<img id="mfoto-'+p._id+'" src="'+p.foto+'" style="width:100%;height:100%;object-fit:cover;display:block;" alt="">'
          +(disp?'':'<div style="position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;"><span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:.5px;">AGOTADO</span></div>')
          +'</div>'
          +'<div style="padding:10px 12px;display:flex;align-items:center;gap:8px;">'
          +'<div class="minfo">'
          +'<div class="mname" id="mn-'+p._id+'">'+(disp?'':' <span style="font-size:10px;color:var(--red);">(Agotado)</span>')+'</div>'
          +'<div class="mdesc" id="md-'+p._id+'"></div>'
          +'<div class="mprice">$'+(p.precio||0)+'</div>'
          +'</div>'
          +'<div class="qwrap">'
          +'<button class="qbtn" onclick="dcFood_qtyChange(\''+p._id+'\',-1,'+p.precio+',\''+n+'\',\''+c+'\')">−</button>'
          +'<span class="qnum" id="q-'+p._id+'">'+qty+'</span>'
          +'<button class="qbtn" onclick="dcFood_qtyChange(\''+p._id+'\',1,'+p.precio+',\''+n+'\',\''+c+'\')">+</button>'
          +'</div></div></div>';
      } else {
        // Layout horizontal original (sin foto)
        html+='<div class="mitem'+(disp?'':' agotado')+'">'
          +'<div class="mic">🍽️</div>'
          +'<div class="minfo">'
          +'<div class="mname" id="mn-'+p._id+'">'+(disp?'':' <span style="font-size:10px;color:var(--red);">(Agotado)</span>')+'</div>'
          +'<div class="mdesc" id="md-'+p._id+'"></div>'
          +'<div class="mprice">$'+(p.precio||0)+'</div>'
          +'</div>'
          +'<div class="qwrap">'
          +'<button class="qbtn" onclick="dcFood_qtyChange(\''+p._id+'\',-1,'+p.precio+',\''+n+'\',\''+c+'\')">−</button>'
          +'<span class="qnum" id="q-'+p._id+'">'+qty+'</span>'
          +'<button class="qbtn" onclick="dcFood_qtyChange(\''+p._id+'\',1,'+p.precio+',\''+n+'\',\''+c+'\')">+</button>'
          +'</div></div>';
      }
    });
  });
  html+='<div style="height:40px;"></div>';
  el.innerHTML=html;
  // XSS-SAFE: rellenar nombre y descripción con textContent después del render
  Object.keys(cats).forEach(function(cat){
    cats[cat].forEach(function(p){
      var mn = document.getElementById('mn-'+p._id);
      var md = document.getElementById('md-'+p._id);
      if(mn) mn.insertBefore(document.createTextNode(p.nombre||'—'), mn.firstChild);
      if(md) md.textContent = p.descripcion||'';
    });
  });
  _updateCartBar();
}

// Lightbox simple para foto de producto
window._dcfZoomFoto = function(pid) {
  var img = document.getElementById('mfoto-'+pid);
  if (!img) return;
  var ov = document.createElement('div');
  ov.id = 'dcf-foto-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  ov.onclick = function(){ document.body.removeChild(ov); };
  var im = document.createElement('img');
  im.src = img.src;
  im.style.cssText = 'max-width:95vw;max-height:85vh;object-fit:contain;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.6);';
  var cls = document.createElement('div');
  cls.textContent = '✕';
  cls.style.cssText = 'position:absolute;top:18px;right:20px;color:#fff;font-size:24px;font-weight:700;cursor:pointer;';
  cls.onclick = function(e){ e.stopPropagation(); document.body.removeChild(ov); };
  ov.appendChild(im); ov.appendChild(cls);
  document.body.appendChild(ov);
};

/* ── Carrito ─────────────────────────────────────────── */
function _selRecepcion(val){
  if(!_S.rest) return;
  _S.recepcion=val;
  _S.tipoEntregaInterna=val==='recoger'?'recolecta':(_S.rest.entregaInterna||'tienda');
  // Mostrar campo dirección cliente solo en domicilio; ocultar aviso sin-dir al cambiar
  var dirSec = document.getElementById('carr-dir-section');
  var avisoEl = document.getElementById('carr-sindir-aviso');
  if (dirSec) dirSec.style.display = val === 'domicilio' ? 'block' : 'none';
  if (avisoEl) avisoEl.style.display = 'none'; // ocultar aviso al cambiar modalidad
  dcFood_renderCarrito();
}
window.dcFood_qtyChange = function(id,delta,precio,nombre,cat) {
  if(!_S.carrito[id]) _S.carrito[id]={nombre:nombre,precio:precio,cantidad:0,categoria:cat};
  _S.carrito[id].cantidad=Math.max(0,_S.carrito[id].cantidad+delta);
  if(_S.carrito[id].cantidad===0) delete _S.carrito[id];
  // Update qty counter in menu view if visible
  var el=document.getElementById('q-'+id);
  if(el) el.textContent=(_S.carrito[id]&&_S.carrito[id].cantidad)||0;
  _updateCartBar();
  // If carrito view is active, re-render immediately
  var carritoView = document.getElementById('v-carrito');
  if(carritoView && carritoView.classList.contains('active')) {
    dcFood_renderCarrito();
  }
};
function _updateCartBar() {
  var vs=Object.values(_S.carrito);
  var n=vs.reduce(function(a,i){return a+i.cantidad;},0);
  var s=vs.reduce(function(a,i){return a+i.cantidad*i.precio;},0);
  var bar=document.getElementById('dcf-cart-bar');
  if(!bar)return;
  if(n>0){
    bar.style.display='flex';
    var bc=document.getElementById('dcf-cart-count');
    var bt=document.getElementById('dcf-cart-total');
    if(bc)bc.textContent=n;
    if(bt)bt.textContent='$'+s;
  }else{bar.style.display='none';var dm2=document.getElementById('det-menu');if(dm2)dm2.style.paddingBottom='0';}
}
window.dcFood_renderCarrito = function() {
  dcFood_scrollReset('v-carrito');
  var cont=document.getElementById('carr-items');
  var g=function(id){return document.getElementById(id);};
  if(g('carr-rest')&&_S.rest)g('carr-rest').textContent=_S.rest.nombreNegocio||_S.rest.nombre||'—';
  // Recepcion section
  // ── Sección recepción ────────────────────────────────────────────
  var recSec=g('carr-recepcion-section'); var recOpt=g('carr-recepcion-opt');
  if(_S.rest&&recSec&&recOpt){
    var r2=_S.rest;
    var pR=r2.permiteRecoger, pE=r2.permiteEntrega, eI=r2.entregaInterna||'tienda';
    var subD=eI==='dc'?'Repartidor DC':eI==='dc_tienda'?'Repartidor DC/Tienda':'Repartidor de la tienda';
    recSec.style.display='block';
    function _optC(ic,tit,sub,on,fn){
      var bg=on?'var(--green-lt)':'#fff';
      var bd=on?'1.5px solid var(--green)':'.5px solid var(--border)';
      var dot=on?'<div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--green);margin-left:auto;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:var(--green);"></div></div>':'<div style="width:16px;height:16px;border-radius:50%;border:2px solid #ccc;margin-left:auto;flex-shrink:0;"></div>';
      return '<div style="background:'+bg+';border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;border:'+bd+';cursor:pointer;margin-bottom:8px;"'+(fn?' onclick="'+fn+'"':'')+'>'+
        '<div style="width:32px;height:32px;border-radius:9px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:18px;">'+ic+'</div>'+
        '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--tx);">'+tit+'</div><div style="font-size:11px;color:var(--tx2);">'+sub+'</div></div>'+dot+'</div>';
    }
    if(!pR&&pE){
      _S.recepcion='domicilio'; _S.tipoEntregaInterna=eI;
      recOpt.innerHTML=_optC('🚚','Entrega a domicilio',subD,true,'');
    } else if(pR&&!pE){
      _S.recepcion='recoger'; _S.tipoEntregaInterna='recolecta';
      var _dirNeg = r2.direccionNegocio || r2.direccionRecogida || '';
      var _subRec = _dirNeg ? ('📍 '+_dirNeg) : 'Pasa a recoger tu pedido';
      recOpt.innerHTML=_optC('🏪','Recoger en tienda',_subRec,true,'');
    } else {
      if(!_S.recepcion)_S.recepcion='domicilio';
      if(_S.recepcion==='domicilio')_S.tipoEntregaInterna=eI;
      else _S.tipoEntregaInterna='recolecta';
      var _dirNeg2 = r2.direccionNegocio || r2.direccionRecogida || '';
      var _subRec2 = _dirNeg2 ? ('📍 '+_dirNeg2) : 'Pasa a recoger tu pedido';
      recOpt.innerHTML=_optC('🚚','Entrega a domicilio',subD,_S.recepcion==='domicilio',"_selRecepcion('domicilio')")
        +_optC('🏪','Recoger en tienda',_subRec2,_S.recepcion==='recoger',"_selRecepcion('recoger')");
    }
    // Mostrar campo dirección cliente solo para domicilio
    var dirSec2 = document.getElementById('carr-dir-section');
    if (dirSec2) dirSec2.style.display = _S.recepcion === 'domicilio' ? 'block' : 'none';
  }
  var items=Object.entries(_S.carrito).filter(function(e){return e[1].cantidad>0;});
  var btnC=document.getElementById('btn-confirmar');
  if(!cont)return;
  if(!items.length){
    cont.innerHTML='<div class="empty"><div class="empty-ic">🛒</div><div class="empty-tit">Carrito vacío</div></div>';
    if(btnC)btnC.style.display='none';
    // Hide totals and clear values so stale data doesn't show
    var tc=g('carr-tcard'); if(tc)tc.style.display='none';
    if(g('c-sub'))g('c-sub').textContent='$0';
    if(g('c-envio'))g('c-envio').textContent='—';
    if(g('c-total'))g('c-total').textContent='$0';
    var dcAviso=g('carr-dc-aviso'); if(dcAviso)dcAviso.style.display='none';
    return;
  }
  // Show totals card when items exist
  var tc2=g('carr-tcard'); if(tc2)tc2.style.display='block';
  if(btnC)btnC.style.display='block';
  var sub=items.reduce(function(a,e){return a+e[1].cantidad*e[1].precio;},0);
  var env=0; // costoEnvio no existe en datos reales
  cont.innerHTML=items.map(function(e){
    var id=e[0];var v=e[1];
    var n=v.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var c=(v.categoria||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="citem">'
      +'<div style="font-size:24px;width:38px;text-align:center;">🍽️</div>'
      +'<div style="flex:1;"><div style="font-size:13px;font-weight:700;">'+v.nombre+'</div>'
      +'<div style="font-size:11px;color:var(--tx2);">'+v.cantidad+' x $'+v.precio+'</div></div>'
      +'<div style="font-size:13px;font-weight:700;margin-right:6px;">$'+(v.cantidad*v.precio)+'</div>'
      +'<button class="dcf-del-dcf-btn" onclick="dcFood_qtyChange(\''+id+'\',-'+v.cantidad+','+v.precio+',\''+n+'\',\''+c+'\')">✕</button>'
      +'</div>';
  }).join('');
  if(g('c-sub'))g('c-sub').textContent='$'+sub;
  if(g('c-envio'))g('c-envio').textContent=env>0?'$'+env:'Gratis';
  if(g('c-total'))g('c-total').textContent='$'+(sub+env);
  // Mostrar/ocultar aviso Repartidor DC
  var dcAviso = g('carr-dc-aviso');
  var entr = _S.rest ? (_S.rest.entrega||'propia') : 'propia';
  var usaDC = entr==='ride'||entr==='todas';
  if(dcAviso) dcAviso.style.display = usaDC ? 'block' : 'none';
};
function _setPago(el) {
  document.querySelectorAll('.dcf-pago-opt').forEach(function(p){p.classList.remove('dcf-on');});
  el.classList.add('dcf-on');
  _S.metodoPago=el.getAttribute('data-pago')||'efectivo';
}

/* ── Confirmar pedido ────────────────────────────────── */
/* ── Gatekeeper: intercepta transferencia ─────────────── */
window.dcFood_iniciarConfirmacion = function() {
  // AJUSTE 1/5 — Si recoger sin dirección: aviso inline, no bloquear
  if (_S.recepcion === 'recoger') {
    var dirNeg = _S.rest && (_S.rest.direccionNegocio || _S.rest.direccionRecogida) ? (_S.rest.direccionNegocio || _S.rest.direccionRecogida) : '';
    if (!dirNeg) {
      // Aviso inline dentro del carrito — no modal, no return, no borrar datos
      var avisoEl = document.getElementById('carr-sindir-aviso');
      if (avisoEl) { avisoEl.style.display = 'block'; }
      return; // solo detener confirmación, no salir del flujo
    }
  }
  // Ocultar aviso si existía
  var avisoEl2 = document.getElementById('carr-sindir-aviso');
  if (avisoEl2) avisoEl2.style.display = 'none';
  if(_S.metodoPago === 'transferencia') {
    var sub=Object.entries(_S.carrito).reduce(function(a,e){return a+e[1].cantidad*e[1].precio;},0);
    var g=function(id){return document.getElementById(id);};
    var rNom=_S.rest?(_S.rest.nombreNegocio||_S.rest.nombre||'—'):'—';
    if(g('transf-rest-nombre'))g('transf-rest-nombre').textContent=rNom;
    if(g('transf-sub'))g('transf-sub').textContent=rNom;
    if(g('transf-total'))g('transf-total').textContent='$'+sub;
    if(g('transf-referencia'))g('transf-referencia').value='';
    var banco=g('transf-banco-contenido');
    if(banco){
      var r=_S.rest||{};
      var tieneData=r.banco||r.clabe||r.cuenta||r.titular;
      if(tieneData){
        var row=function(lbl,val){return val?'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid #f5f5f5;"><span style="font-size:11px;color:#888;">'+lbl+'</span><span style="font-size:12px;font-weight:700;color:#111;">'+val+'</span></div>':'';};
        banco.innerHTML=row('Banco',r.banco)+row('Titular',r.titular)+row('Cuenta',r.cuenta)+row('CLABE',r.clabe)+row('WhatsApp',r.whatsapp||r.telefono)||'<div style="font-size:12px;color:#888;">Sin datos adicionales.</div>';
      } else {
        banco.innerHTML='<div style="font-size:12px;color:#666;line-height:1.6;">El restaurante aún no configuró datos de transferencia.<br>Confirma el pedido y coordina el pago por chat o WhatsApp.</div>';
      }
    }
    _dcfNav('v-transferencia');
  } else {
    dcFood_confirmarPedido();
  }
};
window.dcFood_confirmarTransferencia = function() {
  dcFood_scrollReset('v-transferencia');
  var refEl=document.getElementById('transf-referencia');
  var ref=refEl?refEl.value.trim():'';
  if(!ref){
    // Validation: referencia is required for transfer
    if(refEl){
      refEl.style.border='2px solid var(--red)';
      refEl.style.background='#FFF0EE';
      refEl.focus();
      setTimeout(function(){ refEl.style.border=''; refEl.style.background=''; }, 3000);
    }
    toast('⚠️ Debes capturar el folio o referencia de la transferencia para continuar.');
    return;
  }
  _S._transferenciaRef=ref;
  dcFood_confirmarPedido();
};

// Aviso discreto y elegante para estados del restaurante
// Pinta el badge de estado del restaurante en la vista del vecino
window._dcfPintarBadgeEstado = function(estado){
  var meta = {
    activo:  {ic:'\ud83d\udfe2', txt:'Activo',   col:'#1FC26A'},
    ocupado: {ic:'\ud83d\udfe1', txt:'Ocupado',  col:'#d97706'},
    pausado: {ic:'\u23f8\ufe0f', txt:'En pausa',  col:'#888'},
    cerrado: {ic:'\ud83d\udd34', txt:'Cerrado',  col:'#D63A2A'}
  };
  var m = meta[estado] || meta.activo;
  var b = document.getElementById('dcf-det-estado');
  if (b) { b.textContent = m.ic + ' ' + m.txt; b.style.color = m.col; }
};
// Refleja en vivo el cambio de estado del restaurante en la vista del vecino
// Conecta (o reconecta) el listener en vivo del estado del restaurante actual
window._dcfConectarEstadoVivo = function(restId){
  try {
    if (window._restEstadoUnsub) { window._restEstadoUnsub(); window._restEstadoUnsub = null; }
    var _fbL = window._fs;
    if (_fbL && window._fbDb && restId) {
      window._restEstadoUnsub = _fbL.onSnapshot(_fbL.fsDoc(window._fbDb,'usuarios',restId), function(ds){
        if (!ds.exists()) return;
        var rr = ds.data();
        var nuevoEf = (typeof window._estadoEfectivoDe === 'function')
          ? window._estadoEfectivoDe(rr.estadoOp, rr.estadoOpTs || 0, rr.horarios && rr.horarios.length ? rr.horarios : null)
          : (rr.estadoOp || 'activo');
        if (!_S.rest || _S.rest._id !== restId) return;
        if (nuevoEf === _S.rest._estadoEfectivo) return;
        _S.rest._estadoEfectivo = nuevoEf;
        window._dcfActualizarEstadoVista && window._dcfActualizarEstadoVista(nuevoEf);
      });
    }
  } catch(e) { }
};
window._dcfActualizarEstadoVista = function(estado){
  window._dcfPintarBadgeEstado && window._dcfPintarBadgeEstado(estado);
  if (estado === 'pausado' || estado === 'cerrado') {
    // Sacar al vecino al listado y avisar (acaba de pausar/cerrar mientras estaba dentro)
    var cur = document.querySelector('.view.active');
    var dentro = cur && (cur.id === 'v-food-det' || cur.id === 'v-carrito');
    if (dentro) {
      // Cerrar cualquier overlay y vaciar carrito de ese restaurante
      var ovs=['dcf-ocupado-ov','dcf-cerrado-ov']; ovs.forEach(function(o){var e=document.getElementById(o);if(e)e.remove();});
      go('v-food','left');
      setTimeout(function(){ window._dcfToastSalida && window._dcfToastSalida(estado); }, 350);
    } else {
      window._dcfAvisoEstado && window._dcfAvisoEstado(estado);
    }
  }
};
// Toast al ser expulsado a Dominio Food
window._dcfToastSalida = function(estado){
  var pausa = (estado === 'pausado');
  var txt = pausa ? 'Lo sentimos, el negocio acaba de pausar sus pedidos.' : 'Lo sentimos, el negocio acaba de cerrar.';
  var prev = document.getElementById('dcf-toast-salida'); if (prev) prev.remove();
  var t = document.createElement('div'); t.id = 'dcf-toast-salida';
  t.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%) translateY(-10px);background:#1c1c1e;color:#fff;padding:13px 20px;border-radius:14px;font-size:13px;font-weight:600;font-family:inherit;box-shadow:0 6px 24px rgba(0,0,0,.3);z-index:99999;display:flex;align-items:center;gap:9px;opacity:0;transition:opacity .25s,transform .25s;max-width:320px;text-align:center;';
  t.innerHTML = '<span style="font-size:16px;">'+(pausa?'\u23f8\ufe0f':'\ud83d\udd34')+'</span><span>'+txt+'</span>';
  document.body.appendChild(t);
  requestAnimationFrame(function(){ t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(-10px)'; setTimeout(function(){ t.remove(); }, 260); }, 3400);
};
window._dcfAvisoEstado = function(estado){
  var pausa = (estado === 'pausado');
  var ic = pausa ? '\u23f8\ufe0f' : '\ud83d\udd34';
  var txt = pausa ? 'Por el momento no est\u00e1 atendiendo. Vuelve en un rato.' : 'Este restaurante ya cerr\u00f3 por hoy.';
  var prev = document.getElementById('dcf-toast-estado'); if (prev) prev.remove();
  var t = document.createElement('div'); t.id = 'dcf-toast-estado';
  t.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(10px);background:#1c1c1e;color:#fff;padding:13px 20px;border-radius:14px;font-size:13px;font-weight:600;font-family:inherit;box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:99999;display:flex;align-items:center;gap:9px;opacity:0;transition:opacity .25s,transform .25s;max-width:300px;';
  t.innerHTML = '<span style="font-size:16px;">'+ic+'</span><span>'+txt+'</span>';
  document.body.appendChild(t);
  requestAnimationFrame(function(){ t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(10px)'; setTimeout(function(){ t.remove(); }, 260); }, 3000);
};
// Aviso de demora para 'ocupado' — pide confirmar, discreto
window._dcfOcupadoContinuar = function(){
  _S._avisoOcupadoOk = true;
  var ov = document.getElementById('dcf-ocupado-ov'); if (ov) ov.remove();
  window.dcFood_confirmarPedido && window.dcFood_confirmarPedido();
};
window._dcfAvisoOcupado = function(){
  var prev = document.getElementById('dcf-ocupado-ov'); if (prev) prev.remove();
  var ov = document.createElement('div'); ov.id = 'dcf-ocupado-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9990;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML = '<div style="background:#fff;border-radius:22px 22px 0 0;padding:26px 24px 30px;max-width:420px;width:100%;text-align:center;animation:dcfUp .25s ease;">'
    + '<div style="font-size:34px;margin-bottom:10px;">\u23f1\ufe0f</div>'
    + '<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:6px;">Mayor demora</div>'
    + '<div style="font-size:13px;color:#666;line-height:1.5;margin-bottom:20px;">Este restaurante tiene alta demanda ahora mismo, tu pedido podr\u00eda tardar un poco m\u00e1s de lo normal.</div>'
    + '<button onclick="window._dcfOcupadoContinuar&&window._dcfOcupadoContinuar();" style="width:100%;padding:14px;background:#D63A2A;color:#fff;border:none;border-radius:13px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:9px;">Entiendo, continuar</button>'
    + '<button onclick="document.getElementById(\'dcf-ocupado-ov\').remove();" style="width:100%;padding:12px;background:none;color:#999;border:none;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Cancelar</button>'
    + '</div>';
  document.body.appendChild(ov);
  if (!document.getElementById('dcf-up-kf')) {
    var st=document.createElement('style'); st.id='dcf-up-kf';
    st.textContent='@keyframes dcfUp{from{transform:translateY(100%);}to{transform:translateY(0);}}';
    document.head.appendChild(st);
  }
};
window.dcFood_confirmarPedido = async function() {
  var items=Object.entries(_S.carrito).filter(function(e){return e[1].cantidad>0;});
  if(!items.length){toast('⚠️ Carrito vacío.');return;}
  if(!_S.rest){toast('⚠️ Sin restaurante.');return;}
  var _estR = (_S.rest && _S.rest._estadoEfectivo) || 'activo';
  if (_estR === 'cerrado' || _estR === 'pausado') {
    window._dcfAvisoEstado && window._dcfAvisoEstado(_estR);
    return;
  }
  if (_estR === 'ocupado' && !_S._avisoOcupadoOk) {
    window._dcfAvisoOcupado && window._dcfAvisoOcupado();
    return;
  }
  var btnC=document.getElementById('btn-confirmar');
  if(btnC){btnC.disabled=true;btnC.textContent='Enviando...';}
  if(_isD()){
    // Crear pedido demo real con los datos del carrito actual
    var _sub=items.reduce(function(a,e){return a+e[1].cantidad*e[1].precio;},0);
    var _nota=document.getElementById('carr-nota');
    var _demoId='demo-'+Date.now();
    var _demoPedido={
      _id:_demoId,
      vecinoId:'demo-vec',vecinoNombre:'Tú',
      restauranteId:_S.rest._id,
      restauranteNombre:_S.rest.nombreNegocio||_S.rest.nombre||'—',
      items:items.map(function(e){return{productoId:e[0],nombre:e[1].nombre,precio:e[1].precio,cantidad:e[1].cantidad,categoria:e[1].categoria||''};} ),
      subtotal:_sub,envio:0,total:_sub,
      metodoPago:_S.metodoPago,
      estadoPago:_S.metodoPago==='transferencia'?'pendiente_confirmacion':'por_cobrar_entrega',
      referenciaPago:_S.metodoPago==='transferencia'?(_S._transferenciaRef||''):'',
      recepcion:_S.recepcion,
      tipoEntregaInterna:_S.tipoEntregaInterna,
      tipoEntrega:_S.rest.entrega||'propia',
      direccionEntregaCliente:_S.recepcion==='domicilio'?(document.getElementById('carr-dir-cliente')||{value:''}).value.trim():'',
      direccionRecogidaRestaurante:_S.recepcion==='recoger'?(_S.rest.direccionNegocio||_S.rest.direccionRecogida||''):'',
      requiereRepartidor:(_S.rest.entrega==='ride'||_S.rest.entrega==='todas'),
      repartidorId:null,repartidorNombre:null,
      estado:'nuevo',tiempoEstimado:null,
      notas:_nota?_nota.value.trim():'',
      fecha:Date.now(),actualizado:Date.now(),
      calificadoRestaurante:false,calificadoRepartidor:false
    };
    _DPvec.unshift(_demoPedido); // agregar al inicio para que aparezca primero
    _S.carrito={};_S.pedidoId=_demoId;
    if(_nota)_nota.value='';
    _showPedidoOverlay(function(){
      _dcfNav('v-tracking');
      dcFood_iniciarTracking(_demoId);
    });
    if(btnC){btnC.disabled=false;btnC.textContent='Confirmar y pedir →';}
    return;
  }
  var uid=_uid(); var db=_db();
  if(!uid||!db){toast('⚠️ Inicia sesión.');if(btnC){btnC.disabled=false;btnC.textContent='Confirmar y pedir →';}return;}
  var sub=items.reduce(function(a,e){return a+e[1].cantidad*e[1].precio;},0);
  var env=0;
  var nota=document.getElementById('carr-nota');
  var _dirCliente = _S.recepcion==='domicilio' ? ((document.getElementById('carr-dir-cliente')||{value:''}).value||'').trim() : '';
  var _dirRest = _S.recepcion==='recoger' ? (_S.rest.direccionNegocio||_S.rest.direccionRecogida||'') : '';
  var pedido={vecinoId:uid,vecinoNombre:_uname(),restauranteId:_S.rest._id,restauranteNombre:_S.rest.nombreNegocio||_S.rest.nombre||'—',items:items.map(function(e){return{productoId:e[0],nombre:e[1].nombre,precio:e[1].precio,cantidad:e[1].cantidad,categoria:e[1].categoria||''};}),subtotal:sub,envio:env,total:sub+env,metodoPago:_S.metodoPago,estadoPago:_S.metodoPago==='transferencia'?'pendiente_confirmacion':'por_cobrar_entrega',referenciaPago:_S.metodoPago==='transferencia'?(_S._transferenciaRef||''):'',comprobanteTexto:'',recepcion:_S.recepcion,tipoEntregaInterna:_S.tipoEntregaInterna,tipoEntrega:_S.rest.entrega||'propia',direccionEntregaCliente:_dirCliente,direccionRecogidaRestaurante:_dirRest,requiereRepartidor:(_S.rest.entrega==='ride'||_S.rest.entrega==='todas'),repartidorId:null,repartidorNombre:null,estado:'nuevo',tiempoEstimado:null,notas:nota?nota.value.trim():'',fecha:Date.now(),actualizado:Date.now(),calificadoRestaurante:false,calificadoRepartidor:false};
  try{
    var f=await _fb();
    var ref=await f.addDoc(f.collection(db,'pedidos'),pedido);
    try{await f.addDoc(f.collection(db,'notificaciones'),{uid:pedido.restauranteId,tipo:'pedido',modulo:'pedidos',titulo:'Nuevo pedido',mensaje:pedido.vecinoNombre+' realizó un pedido de $'+pedido.total,leida:false,eliminada:false,prioridad:'alta',pedidoId:ref.id,fecha:f.serverTimestamp()});}catch(ne){}
    try{await f.addDoc(f.collection(db,'notificaciones'),{uid:uid,tipo:'pedido',modulo:'pedidos',titulo:'Pedido enviado',mensaje:'Tu pedido en '+pedido.restauranteNombre+' fue recibido.',leida:false,eliminada:false,prioridad:'normal',pedidoId:ref.id,fecha:f.serverTimestamp()});}catch(ne2){}
    _S.carrito={};_S.pedidoId=ref.id;if(nota)nota.value='';
    _showPedidoOverlay(function(){ _dcfNav('v-tracking');dcFood_iniciarTracking(ref.id); });
  }catch(e){toast('⚠️ Error: '+e.message);}
  finally{if(btnC){btnC.disabled=false;btnC.textContent='Confirmar y pedir →';}}
};

/* ── Tracking ────────────────────────────────────────── */
window.dcFood_iniciarTracking = async function(pid) {
  dcFood_scrollReset('v-tracking');
  if(_S.trackUnsub){_S.trackUnsub();_S.trackUnsub=null;}
  _S.pedidoId=pid;
  if(_isD()){
    var todos=_DPvec.concat(_DPrest).concat(_DPrep);
    var p=todos.find(function(x){return x._id===pid;});
    if(p)_renderTracking(p);
    else _renderTracking({estado:'nuevo',restauranteNombre:'—',tiempoEstimado:null,repartidorNombre:null,repartidorId:null,calificadoRestaurante:false});
    return;
  }
  try{
    var f=await _fb();
    _S.trackUnsub=f.onSnapshot(f.doc(_db(),'pedidos',pid),function(snap){
      if(snap.exists()) _renderTracking(snap.data());
    });
  } catch(e) { }
};
var _EST={
  nuevo:{ic:'📦',txt:'Pedido enviado',sub:'Esperando confirmación'},
  aceptado:{ic:'✅',txt:'Aceptado',sub:'El restaurante confirmó'},
  rechazado:{ic:'❌',txt:'Rechazado',sub:'El restaurante no pudo aceptarlo'},
  preparando:{ic:'👨‍🍳',txt:'Preparando',sub:''},
  listo:{ic:'🛎️',txt:'¡Listo!',sub:'En espera de entrega'},
  buscando_repartidor:{ic:'🔍',txt:'Buscando repartidor DC',sub:''},
  repartidor_asignado:{ic:'🏍️',txt:'Repartidor asignado',sub:''},
  recogido:{ic:'🛵',txt:'Recogido',sub:'En camino'},
  en_camino:{ic:'🏍️',txt:'En camino',sub:'Tu pedido va hacia ti'},
  ya_estoy_aqui:{ic:'📍',txt:'¡Llegó!',sub:'En tu puerta'},
  entregado:{ic:'🎉',txt:'¡Entregado!',sub:'Disfruta tu pedido'},
  cancelado:{ic:'🚫',txt:'Cancelado',sub:''}
};
// Tracking domicilio (entrega a domicilio)
var _PASOS=[
  {est:['nuevo','aceptado','rechazado','preparando','listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui','entregado','cancelado'],ic:'📦',lbl:'Recibido'},
  {est:['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui','entregado'],ic:'✅',lbl:'Aceptado'},
  {est:['preparando','listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui','entregado'],ic:'👨‍🍳',lbl:'Preparando'},
  {est:['listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui','entregado'],ic:'🛎️',lbl:'Listo'},
  {est:['en_camino','recogido','ya_estoy_aqui','entregado'],ic:'🏍️',lbl:'En camino'},
  {est:['entregado'],ic:'🏠',lbl:'Entregado'}
];
// Tracking recoger en tienda
var _PASOS_RECOGER=[
  {est:['nuevo','aceptado','rechazado','preparando','listo','entregado','cancelado'],ic:'📦',lbl:'Pedido recibido'},
  {est:['preparando','listo','entregado'],ic:'👨‍🍳',lbl:'Preparando'},
  {est:['listo','entregado'],ic:'✅',lbl:'Listo para recoger'},
  {est:['entregado'],ic:'🏪',lbl:'Recogido'}
];
// _EST override para recoger en tienda
var _EST_RECOGER={
  nuevo:      {ic:'📦',txt:'Pedido enviado',      sub:'Esperando confirmación del negocio'},
  aceptado:   {ic:'✅',txt:'Aceptado',            sub:'El negocio confirmó tu pedido'},
  rechazado:  {ic:'❌',txt:'Rechazado',           sub:'El negocio no pudo aceptarlo'},
  preparando: {ic:'👨‍🍳',txt:'Preparando',        sub:'Tu pedido está en preparación'},
  listo:      {ic:'✅',txt:'¡Listo para recoger!',sub:'Ya puedes pasar a recogerlo en el negocio.'},
  entregado:  {ic:'🏪',txt:'¡Recogido!',          sub:'Gracias por tu pedido'},
  cancelado:  {ic:'🚫',txt:'Cancelado',           sub:''}
};
function _renderTracking(d) {
  var esRecoger = d.recepcion === 'recoger';
  var e = esRecoger ? (_EST_RECOGER[d.estado]||_EST_RECOGER.nuevo) : (_EST[d.estado]||_EST.nuevo);
  var sub=e.sub;
  if(!esRecoger&&d.estado==='preparando'&&d.tiempoEstimado)sub='~'+d.tiempoEstimado+' min';
  if(!esRecoger&&d.estado==='repartidor_asignado'&&d.repartidorNombre)sub=_fesc(d.repartidorNombre)+' en camino';
  var g=function(id){return document.getElementById(id);};
  if(g('trk-ic'))g('trk-ic').textContent=e.ic;
  if(g('trk-txt'))g('trk-txt').textContent=e.txt;
  if(g('trk-sub'))g('trk-sub').textContent=sub;
  if(g('trk-rest'))g('trk-rest').textContent=d.restauranteNombre||'Tu pedido';
  // Resumen del pedido
  var resumen=g('trk-resumen'),resItems=g('trk-resumen-items'),resTotales=g('trk-resumen-totales');
  if(resumen){
    if(d.items&&d.items.length){
      resumen.style.display='block';
      if(resItems) resItems.innerHTML=(d.items||[]).map(function(i){return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:.5px solid #f5f5f5;"><span style="font-size:12px;color:#111;">'+_fesc(i.cantidad)+'× '+_fesc(i.nombre)+'</span><span style="font-size:12px;font-weight:700;">$'+_fesc(i.cantidad*i.precio)+'</span></div>';}).join('');
      if(resTotales){
        var sub=d.subtotal||0,env=d.envio||0,tot=d.total||(sub+env);
        var pb=d.estadoPago==='pendiente_confirmacion'?'<span style="background:#EDE7F6;color:#4527A0;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:6px;">⏳ Pendiente</span>':d.estadoPago==='por_cobrar_entrega'?'<span style="background:#FFF8E1;color:#7a5000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:6px;">💵 Al entregar</span>':'';
        var recLabel=d.recepcion==='recoger'?'🏪 Recoger en tienda':'🚚 Entrega a domicilio';
        resTotales.innerHTML='<div style="margin-top:8px;padding-top:6px;">'+(env>0?'<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;padding:3px 0;"><span>Envío</span><span>$'+env+'</span></div>':'')+'<div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:5px 0;border-top:.5px solid #f0f0f0;margin-top:4px;"><span>Total</span><span>$'+tot+'</span></div><div style="font-size:11px;color:#888;margin-top:4px;">📦 Recepción: '+recLabel+'</div><div style="font-size:11px;color:#888;margin-top:2px;">💳 '+(d.metodoPago||'—')+pb+'</div></div>';
      }
    } else { resumen.style.display='none'; }
  }
  var pasosEl=g('trk-pasos');
  if(pasosEl){
    var activePasos = esRecoger ? _PASOS_RECOGER : _PASOS;
    pasosEl.innerHTML=activePasos.map(function(p,i){
      var done=p.est.indexOf(d.estado)!==-1;
      return '<div class="tstep">'
        +(i<activePasos.length-1?'<div class="tline'+(done?' done':'')+'"></div>':'')
        +'<div class="tdot'+(done?' done':'')+'">'+p.ic+'</div>'
        +'<div style="font-size:12px;font-weight:'+(done?700:500)+';color:'+(done?'#111':'#aaa')+';">'+p.lbl+'</div>'
        +'</div>';
    }).join('');
  }
  var rc=g('trk-rep-card');
  if(rc){
    var showR=!esRecoger&&['repartidor_asignado','recogido','en_camino','ya_estoy_aqui'].indexOf(d.estado)!==-1&&d.repartidorNombre;
    rc.style.display=showR?'block':'none';
    if(g('trk-rep-nom')&&d.repartidorNombre)g('trk-rep-nom').textContent=d.repartidorNombre;
  }
  var cal=g('trk-cal');
  var volver=g('trk-volver');
  if(cal)cal.style.display=(d.estado==='entregado'&&!d.calificadoRestaurante)?'block':'none';
  // For recoger, adapt calificacion label
  if(esRecoger){var qLabel=document.querySelector('#trk-cal>div:first-child');if(qLabel)qLabel.textContent='¿Cómo estuvo tu pedido?';}
  if(d.repartidorId){var rw=g('stars-rep-wrap');if(rw)rw.style.display='block';}
  // trk-volver: solo en estados finales (entregado/rechazado/cancelado)
  if(volver)volver.style.display=['entregado','rechazado','cancelado'].indexOf(d.estado)!==-1?'block':'none';
  // trk-nav-pedido: visible siempre una vez que el pedido existe (todos los estados)
  var navPedido=g('trk-nav-pedido');
  if(navPedido) navPedido.style.display='block';
  // trk-cancelar-wrap: solo cuando estado === 'nuevo'
  var cancelWrap=g('trk-cancelar-wrap');
  if(cancelWrap) cancelWrap.style.display=d.estado==='nuevo'?'block':'none';
  // trk-no-cancelar: info cuando ya no se puede cancelar (aceptado en adelante)
  var noCancelar=g('trk-no-cancelar');
  var NO_CANCEL=['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui','entregado','rechazado','cancelado'];
  if(noCancelar) noCancelar.style.display=NO_CANCEL.indexOf(d.estado)!==-1?'block':'none';
}

/* ── Cancelar pedido (vecino) ────────────────────────── */
window.dcFood_cancelarPedido = function() {
  var pid=_S.pedidoId; if(!pid){toast('⚠️ Sin pedido activo.');return;}

  window._dcConfirmar('¿Cancelar este pedido?', function() {
    function _irAnteriores(){
      _mpTabActual='anteriores';
      document.querySelectorAll('#v-mis-pedidos-food .dcf-chip').forEach(function(b){b.classList.remove('on');});
      var chipAnt=document.querySelector('#v-mis-pedidos-food .dcf-chip:nth-child(2)');
      if(chipAnt) chipAnt.classList.add('on');
      _dcfNav('v-mis-pedidos-food');
      dcFood_cargarMisPedidos();
    }

    if(_isD()){
      var p=_DPvec.find(function(x){return x._id===pid;});
      if(p&&p.estado==='nuevo'){p.estado='cancelado';p.actualizado=Date.now();}
      _irAnteriores();
      return;
    }
    var db=_db(); if(!db) return;
    _fb().then(function(f){
      return f.getDoc(f.doc(db,'pedidos',pid)).then(function(snap){
        if(!snap.exists()) return;
        var pd=snap.data();
        if(pd.estado!=='nuevo'){toast('⚠️ Este pedido ya no se puede cancelar.');return;}
        return f.updateDoc(f.doc(db,'pedidos',pid),{estado:'cancelado',actualizado:Date.now()}).then(function(){
          try{f.addDoc(f.collection(db,'notificaciones'),{uid:pd.restauranteId,tipo:'pedido',modulo:'pedidos',titulo:'Pedido cancelado',mensaje:(pd.vecinoNombre||'Vecino')+' canceló su pedido.',leida:false,eliminada:false,prioridad:'normal',pedidoId:pid,fecha:f.serverTimestamp()});}catch(ne){}
          _irAnteriores();
        });
      });
    }).catch(function(e){toast('⚠️ Error: '+e.message);});
  });
};

/* ── Calificaciones ──────────────────────────────────── */
window.dcFood_setStarsRest=function(n){_S.starsRest=n;document.querySelectorAll('#stars-rest span').forEach(function(s,i){s.textContent=i<n?'⭐':'☆';});};
window.dcFood_setStarsRep=function(n){_S.starsRep=n;document.querySelectorAll('#stars-rep span').forEach(function(s,i){s.textContent=i<n?'⭐':'☆';});};
window.dcFood_enviarCalificacion=async function(){
  if(!_S.starsRest){toast('⚠️ Califica el restaurante primero.');return;}
  if(_isD()){
    var cal=document.getElementById('trk-cal');
    if(cal)cal.innerHTML='<div style="text-align:center;padding:16px;"><div style="font-size:32px;">✅</div><div style="font-size:13px;font-weight:700;margin-top:8px;">¡Gracias por tu calificación!</div></div>';
    return;
  }
  var pid=_S.pedidoId;var uid=_uid();var db=_db();
  if(!pid||!uid||!db)return;
  try{
    var f=await _fb();
    var pSnap=await f.getDoc(f.doc(db,'pedidos',pid));
    if(!pSnap.exists())return;
    var p=pSnap.data();
    await f.addDoc(f.collection(db,'valoraciones'),{pedidoId:pid,vecinoId:uid,restauranteId:p.restauranteId,repartidorId:p.repartidorId||null,ratingRestaurante:_S.starsRest,ratingRepartidor:_S.starsRep||null,comentario:document.getElementById('trk-comentario')?document.getElementById('trk-comentario').value.trim():'',fecha:Date.now()});
    await f.updateDoc(f.doc(db,'pedidos',pid),{calificadoRestaurante:true});
    var cal=document.getElementById('trk-cal');
    if(cal)cal.innerHTML='<div style="text-align:center;padding:16px;"><div style="font-size:32px;">✅</div><div style="font-size:13px;font-weight:700;margin-top:8px;">¡Gracias por tu calificación!</div></div>';
  }catch(e){toast('⚠️ Error: '+e.message);}
};

/* ── Mis pedidos vecino ──────────────────────────────── */
var _mpTabActual = 'encurso';
var _ENCURSO = ['nuevo','aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','recogido','en_camino','ya_estoy_aqui'];
var _ANTERIORES = ['entregado','rechazado','cancelado'];

function _mpTab(tab, btn) {
  _mpTabActual = tab;
  document.querySelectorAll('#v-mis-pedidos-food .dcf-chip').forEach(function(b){b.classList.remove('dcf-on');});
  if(btn) btn.classList.add('dcf-on');
  _renderMisPedidos(window._mpDocsCache || []);
}

function _renderMisPedidos(docs) {
  window._mpDocsCache = docs;
  var cont = document.getElementById('mispedidos-cont');
  var subEl = document.getElementById('mispedidos-sub');
  if (!cont) return;
  var grupo = docs.filter(function(p){
    return _mpTabActual === 'encurso'
      ? _ENCURSO.indexOf(p.estado) !== -1
      : _ANTERIORES.indexOf(p.estado) !== -1;
  });
  var enCursoCount = docs.filter(function(p){ return _ENCURSO.indexOf(p.estado) !== -1; }).length;
  if (subEl) subEl.textContent = enCursoCount > 0 ? enCursoCount + ' en curso' : 'Sin pedidos activos';
  if (!grupo.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-ic">'
      + (_mpTabActual==='encurso' ? '🛒' : '📬') + '</div>'
      + '<div class="empty-tit">' + (_mpTabActual==='encurso' ? 'Sin pedidos en curso' : 'Sin pedidos anteriores') + '</div>'
      + '<div class="empty-sub">' + (_mpTabActual==='encurso' ? 'Haz tu primer pedido en Dominio Food' : 'Tus pedidos completados aparecerán aquí') + '</div></div>';
    return;
  }
  var IC={nuevo:'📦',aceptado:'✅',rechazado:'❌',preparando:'👨‍🍳',listo:'🛎️',
          buscando_repartidor:'🔍',repartidor_asignado:'🏍️',recogido:'🛵',
          en_camino:'🏍️',ya_estoy_aqui:'📍',entregado:'🎉',cancelado:'🚫'};
  cont.innerHTML = grupo.map(function(p){
    var fecha=p.fecha?new Date(p.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    var cls='badge b-'+(p.estado||'nuevo');
    return '<div class="card" onclick="dcFood_verTracking(\''+p._id+'\')">' 
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">'
      +'<div style="font-size:14px;font-weight:700;">'+(IC[p.estado]||'📦')+' '+(p.restauranteNombre||'—')+'</div>'
      +'<span style="font-size:10px;color:var(--tx2);">'+fecha+'</span></div>'
      +'<div style="font-size:12px;color:var(--tx4);margin-bottom:6px;">'+(p.items||[]).slice(0,3).map(function(i){return i.nombre;}).join(', ')+'</div>'
      +(p.recepcion==='recoger' ? '<div style="font-size:11px;color:var(--green-dk);font-weight:700;margin-bottom:4px;">🏪 '+(p.direccionRecogidaRestaurante||p.direccionRecogida ? 'Recoger en: '+(p.direccionRecogidaRestaurante||p.direccionRecogida) : 'Recoger en tienda')+'</div>' : '')
      +'<div style="display:flex;justify-content:space-between;align-items:center;">'
      +'<span style="font-size:13px;font-weight:700;">$'+(p.total||0)+'</span>'
      +'<span class="'+cls+'">'+(p.estado||'nuevo')+'</span>'
      +'</div></div>';
  }).join('');
}

window.dcFood_cargarMisPedidos=async function(){
  var cont=document.getElementById('mispedidos-cont');
  if(!cont)return;
  // Reset tab "En curso" al entrar a v-mis-pedidos-food
  _mpTabActual = 'encurso';
  document.querySelectorAll('#v-mis-pedidos-food .dcf-chip').forEach(function(b){ b.classList.remove('dcf-on'); });
  var encursoChip = document.querySelector('#v-mis-pedidos-food .dcf-chip');
  if (encursoChip) encursoChip.classList.add('dcf-on');
  dcFood_scrollReset('v-mis-pedidos-food');
  cont.innerHTML='<div class="loading">Cargando...</div>';
  var docs=_isD()?_DPvec:null;
  if(!_isD()){
    try{var f=await _fb();var snap=await f.getDocs(f.query(f.collection(_db(),'pedidos'),f.where('vecinoId','==',_uid())));docs=[];snap.forEach(function(d){docs.push(Object.assign({_id:d.id},d.data()));});}
    catch(e){cont.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error</div></div>';return;}
  }
  docs = docs || [];
  docs.sort(function(a,b){return(b.fecha||0)-(a.fecha||0);});
  _renderMisPedidos(docs);
};
window.dcFood_verTracking=function(pid){
  _dcfNav('v-tracking');
  dcFood_iniciarTracking(pid);
};

/* ── Panel restaurante ───────────────────────────────── */
window.dcFood_cargarPanelRest=async function(){
  dcFood_scrollReset('v-panel-rest');
  var g=function(id){return document.getElementById(id);};
  if(_isD()){
    if(g('st-pedidos'))g('st-pedidos').textContent=_DPrest.length;
    if(g('st-ventas'))g('st-ventas').textContent='$0';
    if(g('st-rating'))g('st-rating').textContent='4.8★';
    var act=_DPrest.filter(function(p){return['nuevo','aceptado','preparando','listo'].indexOf(p.estado)!==-1;}).length;
    if(g('panel-sub'))g('panel-sub').textContent=act>0?act+' pedido'+(act!==1?'s':'')+' activo'+(act!==1?'s':''):'Sin pedidos activos';
    var badge=g('badge-act');if(badge){badge.style.display=act>0?'inline':'none';badge.textContent=act;}
    return;
  }
  var uid=_uid();var db=_db();if(!uid||!db)return;
  try{
    var f=await _fb();
    var snap=await f.getDocs(f.query(f.collection(db,'pedidos'),f.where('restauranteId','==',uid)));
    var ped=0,ven=0,act=0;
    snap.forEach(function(d){var p=d.data();ped++;if(p.estado==='entregado')ven+=p.total||0;if(['nuevo','aceptado','preparando','listo'].indexOf(p.estado)!==-1)act++;});
    if(g('st-pedidos'))g('st-pedidos').textContent=ped;
    if(g('st-ventas'))g('st-ventas').textContent='$'+ven;
    if(g('panel-sub'))g('panel-sub').textContent=act>0?act+' activo'+(act!==1?'s':''):'Sin pedidos activos';
    var badge=g('badge-act');if(badge){badge.style.display=act>0?'inline':'none';badge.textContent=act;}
    var vs=await f.getDocs(f.query(f.collection(db,'valoraciones'),f.where('restauranteId','==',uid)));
    var tr=0,cr=0;vs.forEach(function(d){var v=d.data();if(v.ratingRestaurante){tr+=v.ratingRestaurante;cr++;}});
    if(g('st-rating'))g('st-rating').textContent=cr>0?(tr/cr).toFixed(1)+'★':'—';
  } catch(e) { }
};

/* ── Pedidos restaurante ─────────────────────────────── */
window.dcFood_cargarPedidosRest=async function(){
  dcFood_scrollReset('v-pedidos-rest');
  var cont=document.getElementById('pedrest-cont');
  var subEl=document.getElementById('pedrest-sub');
  if(!cont)return;
  cont.innerHTML='<div class="loading">Cargando...</div>';
  var docs=_isD()?_DPrest:null;
  if(!_isD()){
    var uid=_uid();var db=_db();if(!uid||!db){cont.innerHTML='<div class="loading">—</div>';return;}
    try{var f=await _fb();var snap=await f.getDocs(f.query(f.collection(db,'pedidos'),f.where('restauranteId','==',uid)));docs=[];snap.forEach(function(d){docs.push(Object.assign({_id:d.id},d.data()));});}
    catch(e){cont.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error</div></div>';return;}
  }
  var ACTIVOS=['nuevo','aceptado','preparando'];
  var LISTOS=['listo','buscando_repartidor','repartidor_asignado'];
  var HIST=['en_camino','recogido','ya_estoy_aqui','entregado','rechazado','cancelado'];
  var grupos={activos:docs.filter(function(p){return ACTIVOS.indexOf(p.estado)!==-1;}),listos:docs.filter(function(p){return LISTOS.indexOf(p.estado)!==-1;}),historial:docs.filter(function(p){return HIST.indexOf(p.estado)!==-1;})};
  var grupo=grupos[_S.restTab]||grupos.activos;
  var act=grupos.activos.length+grupos.listos.length;
  if(subEl)subEl.textContent=act>0?act+' activo'+(act!==1?'s':''):'Sin pedidos activos';
  if(!grupo.length){cont.innerHTML='<div class="empty"><div class="empty-ic">📭</div><div class="empty-tit">Sin pedidos aquí</div></div>';return;}
  cont.innerHTML=grupo.map(function(p){
    var hora=p.fecha?new Date(p.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'';
    var its=(p.items||[]).map(function(i){return i.cantidad+'x '+i.nombre;}).join(', ');
    return '<div class="card" onclick="dcFood_abrirDetallePedido(\''+p._id+'\')">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">'
      +'<div style="font-size:13px;font-weight:700;">📦 '+(p.vecinoNombre||'Vecino')+'</div>'
      +'<span style="font-size:10px;color:var(--tx2);">'+hora+'</span></div>'
      +'<div style="font-size:11px;color:var(--tx4);margin-bottom:6px;">'+its+'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;">'
      +'<span style="font-size:13px;font-weight:700;">$'+(p.total||0)+' · '+(p.metodoPago||'efectivo')+'</span>'
      +'<span class="badge b-'+(p.estado||'nuevo')+'">'+(p.estado||'nuevo')+'</span>'
      +'</div></div>';
  }).join('');
};
function _tabRest(tab,btn){
  _S.restTab=tab;
  document.querySelectorAll('#v-pedidos-rest .dcf-chip').forEach(function(b){b.classList.remove('dcf-on');});
  if(btn)btn.classList.add('dcf-on');
  dcFood_cargarPedidosRest();
}

/* ── Detalle pedido restaurante ──────────────────────── */
window.dcFood_abrirDetallePedido=async function(pid){
  dcFood_scrollReset('v-pedido-det');
  window._foodPedActivo=pid;
  var cont=document.getElementById('pdet-cont');
  var sub=document.getElementById('pdet-sub');
  if(!cont)return;
  cont.innerHTML='<div class="loading">Cargando...</div>';
  _dcfNavRest('v-pedido-det');
  var p=null;
  if(_isD()){
    p=_DPrest.concat(_DPvec).find(function(x){return x._id===pid;});
    if(!p){cont.innerHTML='<div class="empty"><div class="empty-ic">❌</div><div class="empty-tit">No encontrado</div></div>';return;}
    if(sub)sub.textContent='Pedido #'+pid.slice(-6).toUpperCase();
    _renderDetallePedido(p); return;
  }
  try{
    var f=await _fb();var snap=await f.getDoc(f.doc(_db(),'pedidos',pid));
    if(!snap.exists()){cont.innerHTML='<div class="empty"><div class="empty-ic">❌</div><div class="empty-tit">No encontrado</div></div>';return;}
    p=Object.assign({_id:snap.id},snap.data());
    if(sub)sub.textContent='Pedido #'+pid.slice(-6).toUpperCase();
    _renderDetallePedido(p);
  }catch(e){cont.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error</div><div class="empty-sub">'+e.message+'</div></div>';}
};
function _renderDetallePedido(p){
  var cont=document.getElementById('pdet-cont');if(!cont)return;
  var its=(p.items||[]).map(function(i){return'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:.5px solid #f5f5f5;"><span style="font-size:12px;">'+i.cantidad+'x '+i.nombre+'</span><span style="font-size:12px;font-weight:700;">$'+(i.cantidad*i.precio)+'</span></div>';}).join('');
  var ACC={
    nuevo:[{l:'✅ Aceptar',f:"dcFood_cambiarEstado('aceptado')"},{l:'❌ Rechazar',f:"dcFood_cambiarEstado('rechazado')"}],
    aceptado:[{l:'👨‍🍳 Preparando',f:"dcFood_cambiarEstado('preparando')"}],
    preparando:[{l:'🛎️ Listo',f:"dcFood_cambiarEstado('listo')"}],
    listo:p.requiereRepartidor?[{l:'🔍 Buscar repartidor DC',f:"dcFood_cambiarEstado('buscando_repartidor')"}]:[{l:'🏍️ Salió a entregar',f:"dcFood_cambiarEstado('en_camino')"}],
    en_camino:[{l:'🏠 Entregado',f:"dcFood_cambiarEstado('entregado')"}]
  };
  var acc=ACC[p.estado]||[];
  cont.innerHTML='<div class="card" style="margin-bottom:12px;cursor:default;">'
    +'<div style="font-size:13px;font-weight:700;margin-bottom:2px;">👤 '+(p.vecinoNombre||'—')+'</div>'
    +'<div style="font-size:11px;color:var(--tx2);">💳 '+(p.metodoPago||'—')+' · '+(p.tipoEntrega||'propia')+'</div>'
    +(p.notas?'<div style="font-size:11px;color:var(--tx4);margin-top:6px;font-style:italic;">📝 '+p.notas+'</div>':'')
    +'</div>'
    +'<div class="card" style="margin-bottom:12px;cursor:default;">'+its
    +'<div style="display:flex;justify-content:space-between;padding:10px 0 0;"><span style="font-size:13px;font-weight:700;">Total</span><span style="font-size:14px;font-weight:700;color:var(--red);">$'+(p.total||0)+'</span></div></div>'
    +(p.estado==='nuevo'?'<div style="margin-bottom:12px;"><label class="lbl">Tiempo estimado (min)</label><input type="number" id="pdet-tiempo" class="dcf-inp" value="25" min="5" max="120"></div>':'')
    +acc.map(function(a){return'<button class="dcf-btn dcf-btn-red" style="margin-bottom:8px;" onclick="'+a.f+'">'+a.l+'</button>';}).join('')
    +'<div id="pdet-msg" style="font-size:12px;color:var(--red);margin-top:8px;display:none;"></div>';
}
window.dcFood_cambiarEstado=async function(estado){
  var pid=window._foodPedActivo;if(!pid)return;
  if(_isD()){
    var todos=_DPrest.concat(_DPvec);
    var p=todos.find(function(x){return x._id===pid;});
    if(p){p.estado=estado;p.actualizado=Date.now();}
    _dcfNavRest('v-pedidos-rest');
    setTimeout(dcFood_cargarPedidosRest,100); return;
  }
  try{
    var f=await _fb();var snap=await f.getDoc(f.doc(_db(),'pedidos',pid));if(!snap.exists())return;
    var p=snap.data();
    var upd={estado:estado,actualizado:Date.now()};
    if(estado==='aceptado'){var tel=document.getElementById('pdet-tiempo');upd.tiempoEstimado=tel?(parseInt(tel.value)||25):25;}
    if(estado==='buscando_repartidor'){try{await f.addDoc(f.collection(_db(),'notificaciones'),{uid:'__repartidores__',tipo:'pedido_disponible',modulo:'pedidos',titulo:'Pedido disponible',mensaje:'Pedido en '+(p.restauranteNombre||'—')+' · $'+(p.total||0),leida:false,eliminada:false,prioridad:'alta',pedidoId:pid,fecha:f.serverTimestamp()});}catch(ne){}}
    await f.updateDoc(f.doc(_db(),'pedidos',pid),upd);
    var msgs={aceptado:'¡Tu pedido fue aceptado!',rechazado:'Tu pedido fue rechazado.',listo:'Tu pedido está listo.',en_camino:'Tu pedido va en camino.',entregado:'¡Tu pedido fue entregado!'};
    if(msgs[estado]&&p.vecinoId){try{await f.addDoc(f.collection(_db(),'notificaciones'),{uid:p.vecinoId,tipo:'pedido',modulo:'pedidos',titulo:'Actualización',mensaje:msgs[estado],leida:false,eliminada:false,prioridad:'normal',pedidoId:pid,fecha:f.serverTimestamp()});}catch(ne2){}}
    _dcfNavRest('v-pedidos-rest');setTimeout(dcFood_cargarPedidosRest,300);
  }catch(e){var msg=document.getElementById('pdet-msg');if(msg){msg.textContent='Error: '+e.message;msg.style.display='block';}}
};

/* ── Menú admin ──────────────────────────────────────── */
window.dcFood_cargarMenuAdmin=async function(){
  dcFood_scrollReset('v-menu-admin');
  var cont=document.getElementById('menuadmin-cont');if(!cont)return;
  cont.innerHTML='<div class="loading">Cargando...</div>';
  var uid=_isD()?'rest1':_uid();
  var prods=_isD()?(_DM[uid]||[]):null;
  if(!_isD()){
    var db=_db();if(!uid||!db){cont.innerHTML='<div class="loading">—</div>';return;}
    try{var f=await _fb();var snap=await f.getDocs(f.query(f.collection(db,'menu',uid,'productos'),f.orderBy('orden','asc')));prods=[];snap.forEach(function(d){prods.push(Object.assign({_id:d.id},d.data()));});}
    catch(e){cont.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error</div></div>';return;}
  }
  if(!prods||!prods.length){cont.innerHTML='<div class="empty"><div class="empty-ic">📋</div><div class="empty-tit">Sin productos</div><div class="empty-sub">Agrega tu primer producto arriba</div></div>';return;}
  cont.innerHTML='';
  prods.forEach(function(p){
    var div=document.createElement('div');div.className='card';div.style.cursor='default';
    div.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      +'<div style="flex:1;"><div style="font-size:13px;font-weight:700;">'+(p.nombre||'—')+'</div>'
      +'<div style="font-size:11px;color:var(--tx2);margin-top:2px;">'+(p.categoria||'')+(p.descripcion?' · '+p.descripcion:'')+'</div>'
      +'<div style="font-size:14px;font-weight:700;color:var(--red);margin-top:4px;">$'+(p.precio||0)+'</div></div>'
      +'<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">'
      +'<span class="badge '+(p.disponible!==false?'b-aceptado':'b-rechazado')+'">'+(p.disponible!==false?'✅ Disponible':'⛔ Agotado')+'</span>'
      +'<button onclick="dcFood_abrirFormProducto(\''+p._id+'\')" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Editar</button>'
      +'</div></div>';
    cont.appendChild(div);
  });
};
window.dcFood_abrirFormProducto=async function(pid){
  dcFood_scrollReset('v-prod-form');
  var t=document.getElementById('pform-titulo');
  if(t)t.textContent=pid?'Editar producto':'Nuevo producto';
  document.getElementById('pform-id').value=pid||'';
  ['pform-nombre','pform-cat','pform-desc','pform-precio'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var d=document.getElementById('pform-disp');if(d)d.checked=true;
  var err=document.getElementById('pform-err');if(err)err.style.display='none';
  if(pid&&!_isD()){
    var uid=_uid();var db=_db();
    if(uid&&db){try{var f=await _fb();var snap=await f.getDoc(f.doc(db,'menu',uid,'productos',pid));if(snap.exists()){var p=snap.data();var s=function(id,v){var el=document.getElementById(id);if(el)el.value=v||'';};s('pform-nombre',p.nombre);s('pform-cat',p.categoria);s('pform-desc',p.descripcion);s('pform-precio',p.precio);if(d)d.checked=p.disponible!==false;}}catch(e){}}
  }
  _dcfNavRest('v-prod-form');
};
window.dcFood_guardarProducto=async function(){
  var nombre=document.getElementById('pform-nombre').value.trim();
  var cat=document.getElementById('pform-cat').value.trim();
  var precio=parseFloat(document.getElementById('pform-precio').value)||0;
  var desc=document.getElementById('pform-desc').value.trim();
  var disp=document.getElementById('pform-disp').checked;
  var err=document.getElementById('pform-err');
  if(!nombre||!cat||precio<=0){if(err){err.textContent='Nombre, categoría y precio son obligatorios.';err.style.display='block';}return;}
  if(err)err.style.display='none';
  if(_isD()){toast('✅ (Demo) Producto guardado: '+nombre);_dcfNavRest('v-menu-admin');return;}
  var pid=document.getElementById('pform-id').value.trim();
  var uid=_uid();var db=_db();if(!uid||!db)return;
  try{
    var f=await _fb();
    var data={nombre:nombre,categoria:cat,descripcion:desc,precio:precio,disponible:disp,actualizado:Date.now()};
    if(pid){await f.setDoc(f.doc(db,'menu',uid,'productos',pid),data,{merge:true});}
    else{var cs=await f.getDocs(f.collection(db,'menu',uid,'productos'));data.orden=cs.size;data.creado=Date.now();await f.addDoc(f.collection(db,'menu',uid,'productos'),data);}
    _dcfNavRest('v-menu-admin');setTimeout(dcFood_cargarMenuAdmin,300);
  }catch(e){if(err){err.textContent='Error: '+e.message;err.style.display='block';}}
};

/* ── Repartidor DC ───────────────────────────────────── */
window.dcFood_cargarPedidosRep=async function(){
  dcFood_scrollReset('v-repartidor');
  var cont=document.getElementById('rep-cont');
  var sub=document.getElementById('rep-sub');
  if(!cont)return;
  cont.innerHTML='<div class="loading">Cargando...</div>';
  var docs=_isD()?_DPrep:null;
  if(!_isD()){
    var db=_db();if(!db){cont.innerHTML='<div class="loading">—</div>';return;}
    try{var f=await _fb();var snap=await f.getDocs(f.query(f.collection(db,'pedidos'),f.where('estado','==','buscando_repartidor')));docs=[];snap.forEach(function(d){docs.push(Object.assign({_id:d.id},d.data()));});}
    catch(e){cont.innerHTML='<div class="empty"><div class="empty-ic">⚠️</div><div class="empty-tit">Error</div></div>';return;}
  }
  if(sub)sub.textContent=docs.length>0?docs.length+' disponible'+(docs.length!==1?'s':''):'Sin pedidos';
  if(!docs.length){cont.innerHTML='<div class="empty"><div class="empty-ic">🏍️</div><div class="empty-tit">Sin pedidos disponibles</div><div class="empty-sub">Cuando un restaurante pida repartidor DC aparecerá aquí</div></div>';return;}
  cont.innerHTML=docs.map(function(p){
    return '<div class="card">'
      +'<div style="font-size:13px;font-weight:700;margin-bottom:4px;">📦 '+(p.restauranteNombre||'—')+'</div>'
      +'<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;">Para: '+(p.vecinoNombre||'—')+' · $'+(p.total||0)+'</div>'
      +'<button class="dcf-btn dcf-btn-green" style="font-size:12px;padding:10px;" onclick="dcFood_tomarPedido(\''+p._id+'\')">🏍️ Tomar este pedido →</button>'
      +'</div>';
  }).join('');
};
window.dcFood_tomarPedido=async function(pid){
  if(_isD()){
    var p=_DPrep.find(function(x){return x._id===pid;});
    if(p){p.estado='repartidor_asignado';}
    _mostrarControlRep(pid,p||{restauranteNombre:'Demo',vecinoNombre:'Demo',total:0});return;
  }
  var uid=_uid();var db=_db();if(!uid||!db)return;
  try{
    var f=await _fb();var snap=await f.getDoc(f.doc(db,'pedidos',pid));if(!snap.exists()){toast('⚠️ No encontrado.');return;}
    var p=snap.data();if(p.estado!=='buscando_repartidor'){toast('⚠️ Ya fue tomado.');dcFood_cargarPedidosRep();return;}
    await f.updateDoc(f.doc(db,'pedidos',pid),{estado:'repartidor_asignado',repartidorId:uid,repartidorNombre:_uname(),actualizado:Date.now()});
    if(p.vecinoId){try{await f.addDoc(f.collection(db,'notificaciones'),{uid:p.vecinoId,tipo:'pedido',modulo:'pedidos',titulo:'Repartidor asignado',mensaje:_uname()+' va en camino.',leida:false,eliminada:false,prioridad:'normal',pedidoId:pid,fecha:f.serverTimestamp()});}catch(ne){}}
    _mostrarControlRep(pid,p);
  }catch(e){toast('⚠️ Error: '+e.message);}
};
function _mostrarControlRep(pid,p){
  var cont=document.getElementById('rep-cont');if(!cont)return;
  cont.innerHTML='<div class="card">'
    +'<div style="font-size:14px;font-weight:700;margin-bottom:4px;">📦 '+(p.restauranteNombre||'—')+'</div>'
    +'<div style="font-size:12px;color:var(--tx2);margin-bottom:12px;">Para: '+(p.vecinoNombre||'—')+' · $'+(p.total||0)+'</div>'
    +'<button class="dcf-btn dcf-btn-green" style="margin-bottom:8px;" onclick="dcFood_avanzarRep(\''+pid+'\',\'recogido\')">✅ Ya recogí el pedido</button>'
    +'<button class="dcf-btn dcf-btn-blue" style="margin-bottom:8px;" onclick="dcFood_avanzarRep(\''+pid+'\',\'ya_estoy_aqui\')">📍 Ya estoy aquí</button>'
    +'<button class="dcf-btn dcf-btn-yellow" onclick="dcFood_avanzarRep(\''+pid+'\',\'entregado\')">🏠 Entregado</button>'
    +'</div>';
}
window.dcFood_avanzarRep=async function(pid,estado){
  if(_isD()){toast('Demo: estado → '+estado);setTimeout(dcFood_cargarPedidosRep,300);return;}
  var db=_db();if(!db)return;
  try{
    var f=await _fb();var snap=await f.getDoc(f.doc(db,'pedidos',pid));if(!snap.exists())return;
    var p=snap.data();
    await f.updateDoc(f.doc(db,'pedidos',pid),{estado:estado,actualizado:Date.now()});
    var msgs={recogido:'Repartidor recogió tu pedido.',ya_estoy_aqui:'¡El repartidor está en tu puerta!',entregado:'¡Tu pedido fue entregado!'};
    if(msgs[estado]&&p.vecinoId){try{await f.addDoc(f.collection(db,'notificaciones'),{uid:p.vecinoId,tipo:'pedido',modulo:'pedidos',titulo:'Actualización',mensaje:msgs[estado],leida:false,eliminada:false,prioridad:'alta',pedidoId:pid,fecha:f.serverTimestamp()});}catch(ne){}}
    if(estado==='entregado')setTimeout(dcFood_cargarPedidosRep,500);
  }catch(e){toast('⚠️ Error: '+e.message);}
};

/* ── Seguir comprando ──────────────────────────────────── */
window.dcFood_seguirComprando = function() {
  _S.filtro = 'todos';
  document.querySelectorAll('#v-lista .dcf-chip').forEach(function(b){ b.classList.remove('on'); });
  var todosChip = document.querySelector('#v-lista .dcf-chip');
  if(todosChip) todosChip.classList.add('on');
  _dcfRenderLista(_S.historial);
  _dcfNav('v-food');
};


/* ── Overlay premium confirmación de pedido ─────────────── */
function _showPedidoOverlay(onDone) {
  var ov  = document.getElementById('dc-pedido-overlay');
  var box = document.getElementById('dc-pedido-box');
  var ttl = document.getElementById('dc-ov-title');
  var sub = document.getElementById('dc-ov-sub');
  var body= document.getElementById('dc-ov-body');
  if(!ov) { if(onDone) onDone(); return; }
  clearTimeout(window._ovTimer1); clearTimeout(window._ovTimer2);

  // FASE 1: amarillo — enviando
  box.className = 'dc-overlay-box phase-send';
  var _svgLogo='<svg width="110" height="110" viewBox="0 0 106 106" fill="none"><defs><radialGradient id=\"bgl3\" cx=\"40%\" cy=\"35%\" r=\"65%\"><stop offset=\"0%\" stop-color=\"#1E3A28\"/><stop offset=\"100%\" stop-color=\"#0C1A10\"/></radialGradient></defs><circle cx=\"53\" cy=\"53\" r=\"50\" fill=\"url(#bgl3)\"/><g class=\"dcf-lr-load\"><circle cx=\"53\" cy=\"53\" r=\"49\" fill=\"none\" stroke=\"#1FC26A\" stroke-width=\"1.5\" stroke-dasharray=\"10 5\" stroke-linecap=\"round\"/><circle cx=\"53\" cy=\"4\" r=\"3.5\" fill=\"#2EE07A\"/></g><g class=\"dcf-pg-load\"><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#1FC26A\"/><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#27AE60\" transform=\"rotate(60 53 53)\"/><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#F5C518\" transform=\"rotate(120 53 53)\"/><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#D63A2A\" transform=\"rotate(180 53 53)\"/><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#27AE60\" transform=\"rotate(240 53 53)\"/><polygon points=\"53,14 57,32 53,28 49,32\" fill=\"#F5C518\" transform=\"rotate(300 53 53)\"/></g><circle cx=\"53\" cy=\"53\" r=\"14\" fill=\"#0C1A10\"/><circle cx=\"53\" cy=\"53\" r=\"14\" fill=\"none\" stroke=\"#1FC26A\" stroke-width=\"1\"/><polygon points=\"53,42 55,50 53,48 51,50\" fill=\"#1FC26A\"/><polygon points=\"53,42 55,50 53,48 51,50\" fill=\"#F5C518\" transform=\"rotate(120 53 53)\"/><polygon points=\"53,42 55,50 53,48 51,50\" fill=\"#D63A2A\" transform=\"rotate(240 53 53)\"/><circle cx=\"53\" cy=\"53\" r=\"4\" fill=\"#1FC26A\"/></svg>';
  body.innerHTML = '<div class="dc-logo-wrap">'+_svgLogo+'</div>'
    + '<div class="dc-ov-title" style="color:var(--yellow);font-size:20px;font-weight:700;margin-top:0;">Enviando tu pedido...</div>'
    + '<div class="dc-ov-sub" style="color:rgba(245,197,24,.8);font-size:13px;margin-top:8px;line-height:1.6;">Estamos notificando al restaurante.</div>';
  ov.style.display = 'flex';

  // FASE 2: verde — éxito (después de 2.2s)
  window._ovTimer1 = setTimeout(function(){
    box.className = 'dc-overlay-box phase-ok';
    body.innerHTML = '<div class="dc-check">✅</div>'
      + '<div class="dc-ov-title" style="color:var(--green);font-size:22px;font-weight:700;margin-top:14px;">Pedido enviado</div>'
      + '<div class="dc-ov-sub" style="color:rgba(31,194,106,.85);font-size:13px;margin-top:8px;line-height:1.6;">Continúa al seguimiento<br>de tu pedido.</div>';
    // Ocultar y navegar (después de 1.2s más)
    window._ovTimer2 = setTimeout(function(){
      ov.style.display = 'none';
      if(onDone) onDone();
    }, 2000);
  }, 3000);
}
function _hideOverlay(){
  var ov=document.getElementById('dc-pedido-overlay');
  clearTimeout(window._ovTimer1); clearTimeout(window._ovTimer2);
  if(ov) ov.style.display='none';
}

/* ── Init (llamado desde _goCore al navegar a v-food) ── */
window.dcFood_init = function() {
  _isDemo = _isD();
  var tipo = localStorage.getItem('dcuserTipo') || 'vecino';
  if (tipo === 'restaurante' || tipo === 'negocio') {
    setTimeout(window.dcFood_cargarPanelRest, 200);
  } else if (tipo === 'repartidor' || tipo === 'transporte' || tipo === 'ambos') {
    setTimeout(window.dcFood_cargarPedidosRep, 200);
  } else {
    // Reset filtro y selector "Todos" al entrar a v-food
    _S.filtro = 'todos';
    var sel = document.getElementById('dcf-cat-select');
    if (sel) sel.value = 'todos';
    if (window._dcDirtyV === 'v-food') window._dcDirtyV = null;
    document.querySelectorAll('#v-food .dcf-chip').forEach(function(b){ b.classList.remove('dcf-on'); });
    var todosChip = document.querySelector('#v-food .dcf-chip');
    if (todosChip) todosChip.classList.add('dcf-on');
    dcFood_scrollReset('v-food');
    window.dcFood_cargarRestaurantes();
  }
};

/* ── Scroll reset helper ─────────────────────────────────── */
function dcFood_scrollReset(viewId) {
  var view = document.getElementById(viewId);
  if (!view) return;
  var sc = view.querySelector('.dcf-scroll');
  if (sc) sc.scrollTop = 0;
}

/* ── Alias y exposes al final del script Food ─────────── */
// Alias: mantiene compatibilidad con _goCore existente y cargarRestaurantes v1/v2
window.cargarRestaurantes = window.dcFood_cargarRestaurantes;

// Vaciar carrito de Food desde app.js (usado por advertencia al salir)
window.dcFood_vaciarCarrito = function() { _S.carrito = {}; _updateCartBar(); };


