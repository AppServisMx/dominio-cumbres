/* ════════════════════════════════════════════════════════════
   DOMINIO CUMBRES — APP.JS  v1.0.0
   Una función por responsabilidad.
════════════════════════════════════════════════════════════ */
window.DC_VERSION='1.0.0';
// Suprimir diálogo "cambios sin guardar" del browser en este SPA
window.onbeforeunload=null;
window.addEventListener('beforeunload',function(e){delete e.returnValue;},true);
(function(){

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function rm(k){try{localStorage.removeItem(k);}catch(e){}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(v){var n=Number(String(v||0).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;}
function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
function norm(a){
  if(a&&!Array.isArray(a)&&Array.isArray(a.items)) a=a.items;
  return (Array.isArray(a)?a:[]).filter(Boolean).map(function(x,i){
    x=Object.assign({},x||{});
    x.key=keyOf(x,i); x.id=x.id||x.productoId||x.key;
    x.nombre=x.nombre||x.nombreProducto||x.titulo||x.name||'Producto';
    x.precio=num(x.precio||x.price||x.precioUnitario);
    x.cantidad=qty(x.cantidad||x.qty||1); x.qty=x.cantidad;
    x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';
    return x;
  });
}
function total(items){return norm(items).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
function fdate(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
function idOf(o){return String((o&&(o.id||o.folio||o.fecha))||'');}
function finalState(o){var e=String((o&&o.estado)||'').toLowerCase();return ['entregado','recogido','finalizado','cancelado','anterior','completado'].indexOf(e)>=0;}
function validOrder(o){return !!(o&&o.tipo==='plaza_orden'&&norm(o.items).length);}
function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){} return false;}

// ══════════════════════════════════════════════
// STORAGE KEYS
// ══════════════════════════════════════════════
var CART_KEY='dcPlazaCartV61';
var SEL_KEY='dcPlazaCompraSeleccionada';
var ORDER_KEYS=['dcPlazaOrdenActivaV62'];
var HIST_KEYS=['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62'];
var LEGACY_CART_KEYS=['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart','dcPlazaCompraProceso'];
var META_KEYS=['dcPlazaCartV61Meta','dcPlazaB2AMeta','dcPlazaCartMetaV63'];
var TAB_KEY='dcPlazaQF42Tab';
var OPEN_CART='dcPlazaL14CartOpen';
var VAC_KEY='dcPlazaL14VaciarOpen';
var OPEN_ORDER='dcPlazaL14OrderOpen';

// ══════════════════════════════════════════════
// CARRITO / ÓRDENES
// ══════════════════════════════════════════════
function cart(){
  var c=norm(rj(CART_KEY,[])); if(c.length) return c;
  for(var i=0;i<LEGACY_CART_KEYS.length;i++){
    var raw=rj(LEGACY_CART_KEYS[i],[]), x=norm(raw);
    if(x.length&&!(raw&&raw.tipo==='plaza_orden')) return x;
  }
  return [];
}
function saveCart(c){
  c=norm(c);
  wj(CART_KEY,c);
}
function clearCart(){
  wj(CART_KEY,[]); ['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart'].forEach(function(k){wj(k,[]);});
  rm('dcPlazaCompraProceso'); META_KEYS.forEach(rm);
  try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}
}
function collapseAll(){
  try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}
}
function allOrders(){
  var out=[],seen={};
  function add(o){if(!validOrder(o))return;var id=idOf(o);if(seen[id])return;seen[id]=1;out.push(o);}
  ORDER_KEYS.forEach(function(k){add(rj(k,null));});
  var sel=rj(SEL_KEY,null); if(validOrder(sel)) add(sel);
  HIST_KEYS.forEach(function(k){var h=rj(k,[]); if(Array.isArray(h)) h.forEach(add);});
  out.sort(function(a,b){return (Number(b.fecha)||0)-(Number(a.fecha)||0);});
  return out;
}
function saveOrder(o){
  ORDER_KEYS.forEach(function(k){wj(k,o);}); wj(SEL_KEY,o);
  HIST_KEYS.forEach(function(k){var h=rj(k,[]); h=Array.isArray(h)?h:[]; h=h.filter(function(x){return x&&x.id!==o.id;}); h.unshift(o); wj(k,h.slice(0,30));});
}
function selectedItems(){var s=rj(SEL_KEY,null)||{}; var items=norm(s.items||[]); return items.length?items:cart();}

// ══════════════════════════════════════════════
// MIS COMPRAS — RENDER
// ══════════════════════════════════════════════
var _mcRendering=false;

function mcState(tipo,label){return '<div class="dc-l14-state dc-state dc-state-'+tipo+' dc-l14-'+tipo+'"><span class="dc-state-dot"></span>'+esc(label)+'</div>';}
function mcRowsRead(items){
  return norm(items).map(function(x){return '<div class="dc-l14-row"><div style="min-width:0"><div class="dc-l14-prod">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div class="dc-l14-muted">'+money(num(x.precio))+' c/u</div></div><b>'+money(num(x.precio)*qty(x.cantidad))+'</b></div>';}).join('');
}
function mcCartRows(items){
  return norm(items).map(function(x,i){
    var k=esc(keyOf(x,i)),q=qty(x.cantidad),p=num(x.precio);
    return '<div class="dc-l14-cart-row">'+
      '<div style="flex:1;min-width:0;">'+
        '<div class="dc-l14-prod">'+esc(x.nombre)+'</div>'+
        '<div class="dc-l14-muted" style="margin-top:2px;">'+money(p)+' c/u · Total '+money(p*q)+'</div>'+
      '</div>'+
      '<div class="dc-l14-controls">'+
        '<button type="button" data-l14-qty="-1" data-key="'+k+'">−</button>'+
        '<b>'+q+'</b>'+
        '<button type="button" data-l14-qty="1" data-key="'+k+'">+</button>'+
        '<button type="button" class="del" data-l14-del="1" data-key="'+k+'">×</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
function mcCartCard(c){
  c=norm(c); if(!c.length) return '';
  var open=localStorage.getItem(OPEN_CART)==='1', vac=localStorage.getItem(VAC_KEY)==='1', t=total(c);
  var html='<div class="dc-l14-card dc-l14-pending" data-l14-card="cart"><div class="dc-l14-head" data-l14-toggle-cart="1"><div class="dc-l14-icon">🛒</div><div class="dc-l14-main"><div class="dc-l14-title">Mi carrito</div><div class="dc-l14-muted">'+c.length+' producto(s) · '+money(t)+'</div>'+mcState('pendiente','Pendiente')+'</div><div class="dc-l14-right"><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'▲':'▼')+'</div></div></div>';
  if(open){
    html+='<div class="dc-l14-body">'+mcCartRows(c)+'<button type="button" class="dc-l14-btn" data-l14-continuar="1">Continuar compra →</button>';
    if(vac) html+='<div class="dc-l14-confirm"><b>¿Vaciar carrito?</b><div><button type="button" data-l14-vac-cancel="1">Cancelar</button><button type="button" class="danger" data-l14-vac-ok="1">Sí, vaciar</button></div></div>';
    else html+='<button type="button" class="dc-l14-btn secondary" data-l14-vaciar="1">Vaciar carrito</button>';
    html+='</div>';
  }
  return html+'</div>';
}
function mcOrderCard(o,anterior){
  var items=norm(o.items), t=Number(o.total)||total(items), id=idOf(o), open=localStorage.getItem(OPEN_ORDER)===id;
  var estado=anterior?(String(o.estado).toLowerCase()==='cancelado'?mcState('cancelado','Cancelado'):mcState('finalizado','Finalizado')):mcState('proceso','En proceso');
  var html='<div class="dc-l14-card" data-l14-card="order" data-l14-order="'+esc(id)+'"><div class="dc-l14-head" data-l14-toggle-order="'+esc(id)+'"><div class="dc-l14-icon box">📦</div><div class="dc-l14-main"><div class="dc-l14-title">Plaza Online</div><div class="dc-l14-muted">'+esc(o.folio||'Compra')+' · '+fdate(o.fecha)+' · '+items.length+' prod.</div>'+estado+'</div><div class="dc-l14-right"><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'▲':'▼')+'</div></div></div>';
  if(open){html+='<div class="dc-l14-body">'+mcRowsRead(items)+(anterior?'':'<button type="button" class="dc-l14-btn" data-l14-seguimiento="'+esc(id)+'">Dar seguimiento →</button>')+'</div>';}
  return html+'</div>';
}
function mcSetTabs(t){
  t=t==='anteriores'?'anteriores':'proceso';
  window._misComprasPlazaTab=t; try{localStorage.setItem(TAB_KEY,JSON.stringify(t));}catch(_){}
  var bp=document.getElementById('miscompras-tab-proceso'), ba=document.getElementById('miscompras-tab-anteriores'), sub=document.getElementById('miscompras-plaza-sub');
  if(sub) sub.textContent=t==='anteriores'?'Compras anteriores':'Compras en proceso';
  if(bp&&ba){bp.style.background=t==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';ba.style.background=t==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';bp.style.color=ba.style.color='#fff';}
}
function mcCurrentTab(){
  return (window._misComprasPlazaTab==='anteriores'||rj(TAB_KEY,'proceso')==='anteriores')?'anteriores':'proceso';
}
function renderMisCompras(force){
  if(_mcRendering) return false;
  var v=document.getElementById('v-mis-compras-plaza'), el=document.getElementById('miscompras-plaza-lista');
  if(!v||!el||!v.classList.contains('active')) return false;
  var tab=mcCurrentTab(), html='', os=allOrders(); mcSetTabs(tab);
  if(tab==='anteriores'){
    var ant=os.filter(finalState);
    html=ant.length?ant.map(function(o){return mcOrderCard(o,true);}).join(''):'<div class="dc-l14-empty"><div>📦</div><b>Sin compras anteriores</b></div>';
  }else{
    html+=mcCartCard(cart());
    os.filter(function(o){return !finalState(o);}).forEach(function(o){html+=mcOrderCard(o,false);});
    if(!html) html='<div class="dc-l14-empty"><div>🛒</div><b>Sin compras en proceso</b></div>';
  }
  var sig=String(tab+'|'+html.length+'|'+localStorage.getItem(OPEN_CART)+'|'+localStorage.getItem(OPEN_ORDER)+'|'+localStorage.getItem(VAC_KEY));
  if(!force&&el.getAttribute('data-l14-sig')===sig&&el.querySelector('.dc-l14-card,.dc-l14-empty')) return true;
  _mcRendering=true; el.setAttribute('data-l14-sig',sig); el.innerHTML=html; _mcRendering=false; return true;
}

window.dcPlazaLimpieza15Render=function(){return renderMisCompras(true);};

// ——————————————————————————————————————————————
// MIS COMPRAS — acciones
// ——————————————————————————————————————————————
function mcChangeQty(key,d){
  var c=cart(),changed=false; d=parseInt(d||0,10);
  c=c.map(function(x,i){if(keyOf(x,i)===String(key)){x=Object.assign({},x);x.cantidad=qty(x.cantidad)+d;x.qty=x.cantidad;changed=true;}return x;}).filter(function(x){return qty(x.cantidad)>0;});
  if(changed) saveCart(c);
  localStorage.setItem(OPEN_CART,'1'); renderMisCompras(true);
}
function mcDelItem(key){
  saveCart(cart().filter(function(x,i){return keyOf(x,i)!==String(key);}));
  localStorage.setItem(OPEN_CART,'1'); renderMisCompras(true);
}
function mcGoComprando(){
  var c=cart(); if(!c.length) return false;
  wj(SEL_KEY,{id:'plaza_carrito_l14_'+Date.now(),tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});
  collapseAll();
  try{if(typeof window.dcPlazaRenderComprando==='function') window.dcPlazaRenderComprando();}catch(_){}
  if(typeof window.go==='function') window.go('v-plaza-comprando','right');
  return false;
}
function mcSeguimiento(id){
  collapseAll();
  var o=allOrders().filter(function(x){return idOf(x)===id;})[0]||allOrders()[0];
  if(o){wj(SEL_KEY,o); ORDER_KEYS.forEach(function(k){wj(k,o);});}
  try{if(typeof window.dcPlazaRenderSeguimiento==='function') window.dcPlazaRenderSeguimiento(o);}catch(_){}
  try{if(typeof window.go==='function') window.go('v-plaza-seguimiento','right');}catch(_){}
  return false;
}

window.dcPlazaComprarDesdeMisCompras=mcGoComprando;
window.dcPlazaContinuarCompra=mcGoComprando;

// ——————————————————————————————————————————————
// MIS COMPRAS — click handler
// ——————————————————————————————————————————————
document.addEventListener('click',function(e){
  var t=e.target; if(!t||!t.closest) return;
  if(!t.closest('#v-mis-compras-plaza')) return;
  var b;
  b=t.closest('#miscompras-tab-proceso'); if(b){stop(e);collapseAll();mcSetTabs('proceso');renderMisCompras(true);return false;}
  b=t.closest('#miscompras-tab-anteriores'); if(b){stop(e);collapseAll();mcSetTabs('anteriores');renderMisCompras(true);return false;}
  b=t.closest('[data-l14-toggle-cart]'); if(b){
    stop(e);
    var willOpen=localStorage.getItem(OPEN_CART)!=='1';
    localStorage.setItem(OPEN_CART,willOpen?'1':'0'); localStorage.setItem(VAC_KEY,'0');
    if(willOpen) localStorage.setItem(OPEN_ORDER,'');
    renderMisCompras(true); return false;
  }
  b=t.closest('[data-l14-toggle-order]'); if(b){
    stop(e);
    var oid=b.getAttribute('data-l14-toggle-order');
    var willOpenO=localStorage.getItem(OPEN_ORDER)!==oid;
    localStorage.setItem(OPEN_ORDER,willOpenO?oid:'');
    if(willOpenO){localStorage.setItem(OPEN_CART,'0');localStorage.setItem(VAC_KEY,'0');}
    renderMisCompras(true); return false;
  }
  b=t.closest('[data-l14-qty]'); if(b){stop(e);mcChangeQty(b.getAttribute('data-key'),b.getAttribute('data-l14-qty'));return false;}
  b=t.closest('[data-l14-del]'); if(b){stop(e);mcDelItem(b.getAttribute('data-key'));return false;}
  if(t.closest('[data-l14-vaciar]')){stop(e);localStorage.setItem(VAC_KEY,'1');localStorage.setItem(OPEN_CART,'1');renderMisCompras(true);return false;}
  if(t.closest('[data-l14-vac-cancel]')){stop(e);localStorage.setItem(VAC_KEY,'0');renderMisCompras(true);return false;}
  if(t.closest('[data-l14-vac-ok]')){stop(e);clearCart();if(typeof toast==='function')toast('🗑 Carrito vaciado');renderMisCompras(true);return false;}
  if(t.closest('[data-l14-continuar]')){stop(e);return mcGoComprando();}
  b=t.closest('[data-l14-seguimiento]'); if(b){stop(e);return mcSeguimiento(b.getAttribute('data-l14-seguimiento'));}
},true);

// Poll para asegurar render cuando la vista está activa
setInterval(function(){
  var v=document.getElementById('v-mis-compras-plaza');
  if(v&&v.classList.contains('active')){
    var el=document.getElementById('miscompras-plaza-lista');
    if(el&&!el.querySelector('.dc-l14-card,.dc-l14-empty')) renderMisCompras(true);
  }
},700);


// ══════════════════════════════════════════════
// MIS COMPRAS — STYLES
// ══════════════════════════════════════════════
(function(){
  var old=document.getElementById('dc-plaza-l14-style'); if(old) old.remove();
  var s=document.createElement('style'); s.id='dc-plaza-l14-style';
  s.textContent=
'#miscompras-plaza-lista{padding:12px 10px 90px;background:#F5F6F0;}'+
'#miscompras-plaza-lista .dc-l14-empty{text-align:center;padding:48px 16px;}'+
'#miscompras-plaza-lista .dc-l14-empty div{font-size:36px;margin-bottom:10px;}'+
'#miscompras-plaza-lista .dc-l14-empty b{font-size:13px;font-weight:700;color:#bbb;display:block;}'+
'.dc-l14-card{background:#fff;border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.06);border:.5px solid #e8eaed;}'+
'.dc-l14-card.dc-l14-pending{border-left:4px solid #F5C518;}'+
'.dc-l14-head{display:flex;align-items:center;gap:10px;padding:12px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent;}'+
'.dc-l14-icon{width:38px;height:38px;border-radius:10px;background:#F5F6F0;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}'+
'.dc-l14-icon.box{background:#EAF4FF;}'+
'.dc-l14-main{flex:1;min-width:0;overflow:hidden;}'+
'.dc-l14-title{font-size:13px;font-weight:800;color:#111;line-height:1.2;margin-bottom:2px;}'+
'.dc-l14-muted{font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'+
'.dc-l14-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;margin-left:6px;}'+
'.dc-l14-total{font-size:15px;font-weight:900;color:#111;white-space:nowrap;}'+
'.dc-l14-arrow{font-size:11px;color:#bbb;line-height:1;}'+
'.dc-l14-body{padding:0 12px 12px;border-top:.5px solid #f0f0f0;}'+
'.dc-l14-row{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:.5px solid #f5f5f5;}'+
'.dc-l14-row:last-of-type{border-bottom:none;}'+
'.dc-l14-prod{font-size:12px;font-weight:700;color:#111;line-height:1.3;}'+
'.dc-l14-row .dc-l14-muted{font-size:11px;color:#999;margin-top:2px;white-space:normal;}'+
'.dc-l14-row b{font-size:12px;font-weight:900;color:#111;white-space:nowrap;}'+
'.dc-l14-cart-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:.5px solid #f5f5f5;}'+
'.dc-l14-cart-row:last-of-type{border-bottom:none;}'+
'.dc-l14-cart-row .dc-l14-prod{font-size:12px;font-weight:800;color:#111;line-height:1.35;}'+
'.dc-l14-cart-row .dc-l14-muted{font-size:11px;color:#888;}'+
'.dc-l14-controls{display:flex;align-items:center;gap:3px;flex-shrink:0;}'+
'.dc-l14-controls button{width:24px;height:24px;border-radius:6px;border:1px solid #e0e3e8;background:#f7f8fa;color:#333;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}'+
'.dc-l14-controls button.del{background:#FFF0F0;border-color:#ffd0d0;color:#D63A2A;font-size:12px;}'+
'.dc-l14-controls b{font-size:12px;font-weight:900;color:#111;min-width:16px;text-align:center;}'+
'.dc-l14-btn{width:100%;box-sizing:border-box;margin-top:10px;padding:12px;border:none;border-radius:12px;background:#F5C518;color:#5b4300;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(245,197,24,.28);}'+
'.dc-l14-btn.secondary{background:#f0f0f0;color:#666;box-shadow:none;margin-top:6px;}'+
'.dc-l14-confirm{margin-top:10px;background:#FFF5F5;border:1px solid #ffd0d0;border-radius:12px;padding:12px;text-align:center;}'+
'.dc-l14-confirm b{font-size:12px;color:#D63A2A;display:block;margin-bottom:10px;}'+
'.dc-l14-confirm div{display:flex;gap:8px;}'+
'.dc-l14-confirm button{flex:1;padding:9px;border:none;border-radius:9px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;background:#f0f0f0;color:#555;}'+
'.dc-l14-confirm button.danger{background:#D63A2A;color:#fff;}'+
'.dc-l14-state{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;letter-spacing:.3px;padding:3px 8px;border-radius:20px;margin-top:4px;}'+
'.dc-l14-pendiente{background:#FFF8E1;color:#92400E;}'+
'.dc-l14-proceso{background:#EAF4FF;color:#1a6fbf;}'+
'.dc-l14-finalizado{background:#EAFAF1;color:#166534;}'+
'.dc-l14-cancelado{background:#FFF0F0;color:#D63A2A;}'+
'.dc-state-dot{width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0;}';
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════
// COMPRANDO — STYLES
// ══════════════════════════════════════════════
(function(){
  if(document.getElementById('dc-plaza-l20-style')) return;
  var s=document.createElement('style'); s.id='dc-plaza-l20-style';
  s.textContent=
'#v-plaza-comprando .scroll{background:#F5F6F0!important;}'+
'#v-plaza-comprando .dc-plz-product-row{display:flex;align-items:center;gap:10px;background:#fff;border:.5px solid #e0e6eb;border-radius:14px;padding:10px;margin:8px 8px 10px;box-shadow:0 4px 12px rgba(10,48,85,.045);}'+
'#v-plaza-comprando .dc-plz-product-img{width:45px;height:45px;border-radius:10px;background:#F3F5F7;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;}'+
'#v-plaza-comprando .dc-plz-product-img img{width:100%;height:100%;object-fit:cover;}'+
'#v-plaza-comprando .dc-plz-product-main{flex:1;min-width:0;}'+
'#v-plaza-comprando .dc-plz-product-name{font-size:13px;font-weight:900;color:#111;line-height:1.15;}'+
'#v-plaza-comprando .dc-plz-product-sub{font-size:11px;color:#555;margin-top:3px;}'+
'#v-plaza-comprando .dc-plz-product-price{font-size:13px;font-weight:900;color:#111;white-space:nowrap;}'+
'#v-plaza-comprando .dc-plz-product-x{width:28px;height:28px;border:.5px solid #d5dce3;border-radius:7px;background:#fff;color:#333;font-size:17px;line-height:1;font-weight:600;}'+
'#v-plaza-comprando .dc-plz-sec-label{font-size:11px;color:#666;font-weight:700;margin:10px 10px 7px;display:flex;align-items:center;gap:6px;}'+
'#v-plaza-comprando .dc-plz-option{background:#fff;border:.8px solid #e0e2e4;border-radius:14px;padding:12px;margin:8px 8px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.025);}'+
'#v-plaza-comprando .dc-plz-option.active{border-color:#1FC26A;background:#EAF9F1;}'+
'#v-plaza-comprando .dc-plz-option-ic{width:36px;height:36px;border-radius:10px;background:#FFF6D8;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}'+
'#v-plaza-comprando .dc-plz-option-txt{flex:1;min-width:0;}'+
'#v-plaza-comprando .dc-plz-option-title{font-size:13px;font-weight:900;color:#111;line-height:1.1;}'+
'#v-plaza-comprando .dc-plz-option-sub{font-size:11px;color:#777;margin-top:2px;}'+
'#v-plaza-comprando .dc-plz-radio{width:18px;height:18px;border-radius:50%;border:2px solid #d6d6d6;box-sizing:border-box;position:relative;flex-shrink:0;}'+
'#v-plaza-comprando .dc-plz-option.active .dc-plz-radio{border-color:#1FC26A;}'+
'#v-plaza-comprando .dc-plz-option.active .dc-plz-radio:after{content:"";position:absolute;left:3px;top:3px;width:8px;height:8px;border-radius:50%;background:#1FC26A;}'+
'#v-plaza-comprando .dc-plz-input{width:calc(100% - 16px);margin:8px 8px;border:.8px solid #e0e2e4;border-radius:14px;padding:12px 13px;font-size:12px;font-family:inherit;background:#fff;box-sizing:border-box;outline:none;}'+
'#v-plaza-comprando textarea.dc-plz-input{min-height:78px;resize:none;}'+
'#v-plaza-comprando .dc-plz-info{margin:12px 8px;background:#F1E8FB;border-left:4px solid #7B3FA0;border-radius:12px;padding:12px;color:#4b148c;font-size:11px;line-height:1.45;font-weight:600;}'+
'#v-plaza-comprando .dc-plz-summary{background:#fff;border:.8px solid #e6e0d0;border-radius:14px;margin:14px 8px 10px;padding:12px;}'+
'#v-plaza-comprando .dc-plz-srow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;color:#777;border-bottom:.5px solid #eee;}'+
'#v-plaza-comprando .dc-plz-srow.total{border-bottom:0;font-size:15px;font-weight:900;color:#111;}'+
'#v-plaza-comprando .dc-plz-buy-btn{width:calc(100% - 16px);margin:0 8px 18px;border:none;border-radius:14px;background:#F5C518;color:#5b4300;padding:14px;font-size:13px;font-weight:900;font-family:inherit;box-shadow:0 10px 20px rgba(245,197,24,.26);}';
  document.head.appendChild(s);
})();

// ══════════════════════════════════════════════
// COMPRANDO — RENDER
// ══════════════════════════════════════════════
function ensureComprandoView(){
  var v=document.getElementById('v-plaza-comprando');
  if(!v){
    v=document.createElement('div'); v.className='view go-right'; v.id='v-plaza-comprando'; v.style.flexDirection='column';
    v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button">‹</button><div><div class="si13">🛒 COMPRANDO</div><div class="si21">Plaza Online</div></div></div></div><div class="scroll" id="v-plaza-comprando-lista" style="padding:10px 6px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
    var base=document.getElementById('v-mis-compras-plaza')||document.querySelector('.view:last-of-type');
    if(base&&base.parentNode) base.parentNode.insertBefore(v,base.nextSibling); else document.body.appendChild(v);
  }
  return v;
}
function activeCartData(){
  var c=cart(), s=rj(SEL_KEY,null)||{}, si=norm(s.items||[]);
  var items=c.length?c:si;
  var data={id:(s.id||'plaza_carrito_activo'),tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:(s.fecha||Date.now()),items:items,total:total(items)};
  wj(SEL_KEY,data);
  return data;
}
function _comprandoRestoreHdr(){
  var h=document.querySelector('#v-plaza-comprando .si13');
  var s=document.querySelector('#v-plaza-comprando .si21');
  if(h) h.textContent='🛒 COMPRANDO';
  if(s) s.textContent='Plaza Online';
}
function renderComprando(){
  ensureComprandoView();
  _comprandoRestoreHdr();
  var data=activeCartData(), c=norm(data.items), subtotal=total(c);
  var el=document.getElementById('v-plaza-comprando-lista');
  if(!el) return false;
  if(!c.length){
    el.innerHTML='<div style="background:#fff;border:.5px solid #dde4ea;border-radius:14px;margin:8px;padding:18px;text-align:center;"><div style="font-size:28px;margin-bottom:6px;">🛒</div><div style="font-size:13px;font-weight:900;">Tu carrito está vacío</div></div>';
    return false;
  }

  // Leer selecciones actuales
  var entrega=localStorage.getItem('dcPlazaTipoEntrega')||'domicilio';
  var pago=localStorage.getItem('dcPlazaTipoPago')||'efectivo';

  var html='';
  c.forEach(function(x,i){
    var img=x.foto?'<img src="'+esc(x.foto)+'" onerror="this.parentNode.textContent=\'🛍️\';this.remove();">':'🛍️';
    html+='<div class="dc-plz-product-row"><div class="dc-plz-product-img">'+img+'</div><div class="dc-plz-product-main"><div class="dc-plz-product-name">'+esc(x.nombre)+'</div><div class="dc-plz-product-sub">'+qty(x.cantidad)+' x '+money(num(x.precio))+'</div></div><div class="dc-plz-product-price">'+money(num(x.precio)*qty(x.cantidad))+'</div><button type="button" class="dc-plz-product-x" aria-label="Quitar producto" data-l20-remove="'+esc(x.key||i)+'">×</button></div>';
  });

  html+='<div class="dc-plz-sec-label">📦 ¿Cómo deseas recibir tu compra?</div>';
  html+='<div class="dc-plz-option'+(entrega==='domicilio'?' active':'')+'" data-dc-plaza-entrega="domicilio"><div class="dc-plz-option-ic">🚚</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Entrega a domicilio</div><div class="dc-plz-option-sub">Repartidor DC / Tienda</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(entrega==='recoger'?' active':'')+'" data-dc-plaza-entrega="recoger"><div class="dc-plz-option-ic">🏪</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Pasaré a recoger</div><div class="dc-plz-option-sub">Recoger directamente en tienda</div></div><div class="dc-plz-radio"></div></div>';

  if(entrega==='domicilio'){
    html+='<div class="dc-plz-sec-label">📍 Tu dirección de entrega</div><input id="dc-plaza-dir-compra" class="dc-plz-input" placeholder="Calle, número, colonia, referencias...">';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Color, talla, indicaciones, referencias..."></textarea>';
    html+='<div class="dc-plz-info">🏍️ <b>Compra con entrega local</b><br>Acuerda el pago directamente con el negocio. El repartidor DC sólo realiza la entrega cuando aplique.</div>';
  }else{
    html+='<div class="dc-plz-info">🏪 <b>Recoger en tienda</b><br>Presenta tu folio de compra en el negocio para recoger tu pedido. Coordina el horario directamente con ellos.</div>';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Horario, nombre, indicaciones..."></textarea>';
  }

  html+='<div class="dc-plz-sec-label">💳 Forma de pago</div>';
  html+='<div class="dc-plz-option'+(pago==='efectivo'?' active':'')+'" data-dc-plaza-pago="efectivo"><div class="dc-plz-option-ic">💵</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Efectivo al entregar</div><div class="dc-plz-option-sub">Paga al recibir</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(pago==='tarjeta'?' active':'')+'" data-dc-plaza-pago="tarjeta"><div class="dc-plz-option-ic">💳</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Tarjeta al entregar</div><div class="dc-plz-option-sub">Terminal en la entrega</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(pago==='transferencia'?' active':'')+'" data-dc-plaza-pago="transferencia"><div class="dc-plz-option-ic">🏦</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Transferencia</div><div class="dc-plz-option-sub">SPEI / Nómina</div></div><div class="dc-plz-radio"></div></div>';

  html+='<div class="dc-plz-summary"><div class="dc-plz-srow"><span>Subtotal</span><span>'+money(subtotal)+'</span></div><div class="dc-plz-srow"><span>Envío</span><span>Gratis</span></div><div class="dc-plz-srow total"><span>Total</span><span>'+money(subtotal)+'</span></div></div>';

  if(pago==='transferencia'){
    html+='<button type="button" class="dc-plz-buy-btn" id="dc-plaza-ir-transferencia">Continuar → Pago por transferencia</button>';
  }else{
    html+='<button type="button" class="dc-plz-buy-btn" id="dc-plaza-confirmar-compra">Confirmar y pedir →</button>';
  }

  el.innerHTML=html;
  return false;
}

// Pantalla de captura de referencia de transferencia (diseño igual a Food)
function _renderTransferencia(){
  ensureComprandoView();
  var el=document.getElementById('v-plaza-comprando-lista');
  if(!el) return;
  // Cambiar header a "Transferencia" + nombre de la tienda
  var hdrT=document.querySelector('#v-plaza-comprando .si13');
  var hdrS=document.querySelector('#v-plaza-comprando .si21');
  if(hdrT) hdrT.textContent='📱 Transferencia';
  var store=window._dcPlazaStoreActual||null;
  var storeName=(store&&(store.nombrePublico||store.nombreNegocio||store.nombre))||'Plaza Online';
  if(hdrS) hdrS.textContent='Plaza Online';
  var allItems=norm(activeCartData().items);
  // Filtrar solo productos de la tienda actual
  var storeId=store&&(store._id||store.id||store.uid||'');
  var c=storeId?allItems.filter(function(x){var nid=String(x.negocioId||x.uidNegocio||x.comercioId||'');return nid===storeId||nid==='';})
                :allItems;
  if(!c.length) c=allItems; // fallback: si no filtra nada, mostrar todo
  var subtotal=total(c);
  // Datos bancarios del negocio
  var banco=(store&&store.bancoTransferencia)||{};
  var tieneData=banco.banco||banco.clabe||banco.cuenta||banco.titular;
  var bancoHTML='';
  if(tieneData){
    var rowB=function(lbl,val){return val?'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:.5px solid #f5f5f5;"><span style="font-size:11px;color:#888;">'+lbl+'</span><span style="font-size:12px;font-weight:700;color:#111;">'+esc(val)+'</span></div>':'';};
    bancoHTML=rowB('Banco',banco.banco)+rowB('Titular',banco.titular)+rowB('Cuenta',banco.cuenta)+rowB('CLABE',banco.clabe);
  }else{
    bancoHTML='<div style="font-size:12px;color:#666;line-height:1.6;">El negocio aún no configuró datos de transferencia.<br><span style="color:var(--blue,#1a6fbf);font-weight:700;">Confirma el pedido y coordina el pago por chat o WhatsApp.</span></div>';
  }
  var cartRows=c.map(function(x){
    var qty=num(x.cantidad)||1;
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:.5px solid #f0f0f0;">'+
      '<div style="font-size:12px;color:#555;flex:1;padding-right:8px;">'+qty+'× '+esc(x.nombre||'Producto')+'</div>'+
      '<div style="font-size:12px;font-weight:700;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty)+'</div>'+
    '</div>';
  }).join('');
  el.innerHTML=
    '<div style="background:#fff;border-radius:16px;padding:16px;margin:8px;border:.5px solid #e8e8e8;box-shadow:0 2px 8px rgba(0,0,0,.04);">'+
      '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Resumen</div>'+
      '<div style="font-size:13px;font-weight:800;color:#111;margin-bottom:8px;">Plaza Online</div>'+
      cartRows+
      '<div style="display:flex;justify-content:space-between;padding-top:10px;font-size:14px;font-weight:900;color:#111;">'+
        '<span>Total</span><span>'+money(subtotal)+'</span>'+
      '</div>'+
    '</div>'+
    '<div style="background:#fff;border-radius:16px;padding:16px;margin:8px;border:.5px solid #e8e8e8;box-shadow:0 2px 8px rgba(0,0,0,.04);">'+
      '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Datos bancarios del negocio</div>'+
      bancoHTML+
    '</div>'+
    '<div style="background:#FFF8E1;border-radius:16px;padding:16px;margin:8px;border:2px solid #F59E0B;">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'+
        '<div style="width:28px;height:28px;background:#F59E0B;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">📋</div>'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;color:#92400E;">Captura tu referencia</div>'+
          '<div style="font-size:11px;color:#B45309;">Folio, número de transacción o comentario</div>'+
        '</div>'+
      '</div>'+
      '<textarea id="dc-plaza-transfer-ref" rows="3" style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid #F59E0B;border-radius:12px;padding:12px 14px;font-size:14px;font-family:inherit;color:#111;resize:none;outline:none;line-height:1.5;" placeholder="Ej: folio SPEI 12345, transferí a las 3:15pm..."></textarea>'+
      '<div id="dc-plaza-transfer-msg" style="font-size:11px;margin-top:4px;min-height:16px;color:#D63A2A;"></div>'+
    '</div>'+
    '<button type="button" class="dc-plz-buy-btn" id="dc-plaza-ya-transferi">✅ Ya transferí — Confirmar pedido →</button>'+
    '<button type="button" style="width:calc(100% - 16px);margin:0 8px 24px;border:none;border-radius:14px;background:#f5f5f5;color:#555;padding:12px;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer;" id="dc-plaza-volver-comprando">← Regresar</button>';
  el.scrollTop=0;
}

// Botón "Regresar" desde pantalla de transferencia (restaura header también)
document.addEventListener('click',function(e){
  var btn=e.target&&e.target.closest?e.target.closest('#dc-plaza-volver-comprando'):null;
  if(btn&&btn.closest('#v-plaza-comprando')){stop(e);renderComprando();return false;}
},true);
// En v-plaza-det capturar la tienda actual (respaldo por si _postHooks no alcanza)
document.addEventListener('click',function(e){
  var card=e.target&&e.target.closest?e.target.closest('.plaza-card'):null;
  if(!card) return;
  setTimeout(function(){
    try{
      var el=document.getElementById('plaza-det-nombre');
      var nom=(el&&el.textContent||'').replace(/^\s*🏪\s*/,'').trim();
      if(nom&&Array.isArray(window._plazaDocsCache)){
        var s=window._plazaDocsCache.find(function(x){return nom===(x.nombrePublico||x.nombreNegocio||x.nombre||'');});
        if(s) window._dcPlazaStoreActual=s;
      }
    }catch(_){}
  },400);
},false);

window.dcPlazaRenderComprando=renderComprando;

setTimeout(function(){
  var v=document.getElementById('v-plaza-comprando');
  if(v&&v.classList.contains('active')) renderComprando();
},80);

// ——————————————————————————————————————————————
// COMPRANDO — click handler (quitar item, entrega/pago, transferencia)
// ——————————————————————————————————————————————
document.addEventListener('click',function(e){
  var t=e.target; if(!t||!t.closest) return;

  var rem=t.closest('[data-l20-remove],[data-b2b-remove]');
  if(rem&&rem.closest('#v-plaza-comprando')){
    stop(e);
    var k=rem.getAttribute('data-l20-remove')||rem.getAttribute('data-b2b-remove');
    var c=cart().filter(function(x,i){return keyOf(x,i)!==String(k);});
    wj(CART_KEY,c); wj(SEL_KEY,{id:'plaza_carrito_activo',tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});
    renderComprando();
    try{if(typeof window.dcPlazaLimpieza15Render==='function') window.dcPlazaLimpieza15Render();}catch(_){}
    return false;
  }

  var opt=t.closest('[data-dc-plaza-entrega],[data-dc-plaza-pago]');
  if(opt&&opt.closest('#v-plaza-comprando')){
    stop(e);
    var attr=opt.hasAttribute('data-dc-plaza-entrega')?'data-dc-plaza-entrega':'data-dc-plaza-pago';
    opt.parentNode.querySelectorAll('['+attr+']').forEach(function(x){x.classList.remove('active');});
    opt.classList.add('active');
    localStorage.setItem(attr==='data-dc-plaza-entrega'?'dcPlazaTipoEntrega':'dcPlazaTipoPago',opt.getAttribute(attr));
    // Re-render para mostrar u ocultar campos según selección
    renderComprando();
    return false;
  }

  var btnTrans=t.closest('#dc-plaza-ir-transferencia');
  if(btnTrans&&btnTrans.closest('#v-plaza-comprando')){
    stop(e);
    _renderTransferencia();
    return false;
  }

  var btnYaTransferi=t.closest('#dc-plaza-ya-transferi');
  if(btnYaTransferi&&btnYaTransferi.closest('#v-plaza-comprando')){
    stop(e);
    var refEl=document.getElementById('dc-plaza-transfer-ref');
    var ref=(refEl&&refEl.value||'').trim();
    if(!ref){
      if(refEl){refEl.style.borderColor='#D63A2A';}
      var msg=document.getElementById('dc-plaza-transfer-msg');
      if(msg){msg.textContent='Captura tu referencia de pago para continuar.';msg.style.color='#D63A2A';}
      return false;
    }
    try{localStorage.setItem('dcPlazaTransferenciaRef',ref);}catch(_){}
    // Limpiar textarea ANTES del overlay para que el browser no detecte "dirty form"
    if(refEl) refEl.value='';
    try{['dc-plaza-dir-compra','dc-plaza-nota-compra'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});}catch(_){}
    // Ahora sí confirmar compra
    var o={id:'plaza_'+Date.now(),folio:'#PZ'+String(Date.now()).slice(-6),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:selectedItems(),total:total(selectedItems()),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:'transferencia',referenciaTransferencia:ref};
    saveOrder(o); clearCart();
    return _plazaShowCompraOverlay(goSeguimiento),false;
  }
},true);


// ══════════════════════════════════════════════
// PLAZA — OVERLAY COMPRA REALIZADA
// ══════════════════════════════════════════════
function _plazaShowCompraOverlay(onDone){
  var ov=document.getElementById('dc-plaza-compra-ov');
  if(!ov){
    ov=document.createElement('div');
    ov.id='dc-plaza-compra-ov';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2147483647;align-items:center;justify-content:center;pointer-events:all;font-family:inherit;';
    document.body.appendChild(ov);
  }
  clearTimeout(window._dcPlzOvT1); clearTimeout(window._dcPlzOvT2);
  ov.innerHTML='<div style="background:#0C1A10;border-radius:24px;padding:32px 28px;text-align:center;max-width:280px;width:90%;box-shadow:0 24px 48px rgba(0,0,0,.4);"><div style="font-size:36px;margin-bottom:16px;">⏳</div><div style="color:#F5C518;font-size:18px;font-weight:700;margin-bottom:8px;">Enviando tu compra...</div><div style="color:rgba(245,197,24,.7);font-size:12px;">Estamos procesando tu pedido.</div></div>';
  ov.style.display='flex';
  window._dcPlzOvT1=setTimeout(function(){
    ov.innerHTML='<div style="background:#0C1A10;border-radius:24px;padding:32px 28px;text-align:center;max-width:280px;width:90%;box-shadow:0 24px 48px rgba(0,0,0,.4);"><div style="font-size:48px;margin-bottom:16px;">✅</div><div style="color:#1FC26A;font-size:22px;font-weight:900;margin-bottom:8px;">¡COMPRA REALIZADA!</div><div style="color:rgba(31,194,106,.8);font-size:12px;line-height:1.6;">Tu pedido fue recibido.<br>Continúa al seguimiento.</div></div>';
    window._dcPlzOvT2=setTimeout(function(){
      ov.style.display='none';
      if(typeof onDone==='function') onDone();
    },1800);
  },2000);
}

// ══════════════════════════════════════════════
// CONFIRMAR COMPRA
// ══════════════════════════════════════════════
var _confirmLock=false;

function goSeguimiento(){
  // Limpiar flag "dirty" para que _dcConfirmarSalida no muestre el confirm()
  try{window._dcDirtyV=null;}catch(_){}
  // Tras compra → volver a Plaza Online (limpiar comprando del stack)
  _navStack=_navStack.filter(function(id){return id!=='v-plaza-comprando';});
  _navSuppress=true;
  try{if(typeof window.go==='function') window.go('v-plaza','left');}catch(e){}
  setTimeout(function(){_navSuppress=false;},0);
  setTimeout(function(){_confirmLock=false;},800);
  return false;
}

function isConfirmTarget(e){
  var t=e&&e.target; if(!t||!t.closest) return false;
  return !!t.closest('#dc-plaza-confirmar-compra,#dc-plaza-confirmar-compra-final,#dc-plaza-confirmar-compra-qf38');
}
function goProceso(){
  try{window._misComprasPlazaTab='proceso';}catch(e){}
  try{if(typeof window.go==='function') window.go('v-mis-compras-plaza','right');}catch(e){}
  [40,120,300,650].forEach(function(ms){setTimeout(function(){renderMisCompras(true);},ms);});
  setTimeout(function(){_confirmLock=false;},800);
  return false;
}
function finalizarCompra(e){
  if(!isConfirmTarget(e)) return;
  stop(e);
  if(_confirmLock) return false;
  _confirmLock=true;
  var items=selectedItems();
  if(!items.length){_confirmLock=false;return false;}
  var o={id:'plaza_'+Date.now(),folio:'#PZ'+String(Date.now()).slice(-6),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:items,total:total(items),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:(localStorage.getItem('dcPlazaTipoPago')||'efectivo')};
  saveOrder(o); clearCart();
  return _plazaShowCompraOverlay(goSeguimiento),false;
}

window.addEventListener('pointerdown',finalizarCompra,true);
window.addEventListener('touchstart',function(e){if(isConfirmTarget(e)) stop(e);},true);
window.addEventListener('click',function(e){if(isConfirmTarget(e)) return finalizarCompra(e);},true);
window.dcPlazaConfirmarCompra=finalizarCompra;
window.dcPlazaConfirmarCompraFinal=finalizarCompra;


// ══════════════════════════════════════════════
// PLAZA — AGREGAR AL CARRITO (con DOM fallback)
// ══════════════════════════════════════════════
function _plazaGetQty(){
  var ids=['plaza-det-qty-num','plaza-v36-qty','plaza-v35-qty','plaza-v52-qty','plaza-det-qty'];
  for(var i=0;i<ids.length;i++){var el=document.getElementById(ids[i]);if(el)return qty(el.textContent||el.value||1);}
  return qty(window._plazaDetalleQty||1);
}
function _plazaActiveModal(){
  var ids=['plaza-prod-det-ov','plaza-prod-det-ov-v35','plaza-prod-det-ov-v36','plaza-prod-modal','plaza-detalle-modal','plaza-producto-modal'];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    if(el&&el.style.display!=='none'&&el.style.visibility!=='hidden') return el;
  }
  var qs=document.querySelector('[id^="plaza-prod-det-ov"]');
  return (qs&&qs.style.display!=='none'&&qs.style.visibility!=='hidden')?qs:null;
}
function _plazaPidFrom(btn){
  if(!btn) return '';
  var pid=(btn.getAttribute('data-pid')||btn.getAttribute('data-id')||(btn.dataset&&btn.dataset.pid)||'');
  if(pid) return String(pid);
  var oc=btn.getAttribute('onclick')||'';
  var m=oc.match(/plazaAgregarAlCarritoDetalle\(['"]([^'"]+)/i); if(m) return String(m[1]);
  return String(window._plazaProductoDetalleId||window._plazaDetallePid||'');
}
function _plazaProdFromDOM(pid){
  var modal=_plazaActiveModal();
  var name='Producto';
  var title=modal&&modal.querySelector('h1,h2,h3,[style*="font-size:20"],[style*="font-size:19"],[style*="font-size:18"]');
  if(title) name=(title.textContent||'').replace(/\s+/g,' ').trim();
  if(!name||name==='Producto'){var strong=modal&&modal.querySelector('b,strong'); if(strong) name=(strong.textContent||'').replace(/\s+/g,' ').trim();}
  var allText=((modal||document.body).textContent||'');
  var pm=allText.replace(/,/g,'').match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
  var price=pm?Number(pm[1]||0):0;
  var img=modal&&modal.querySelector('img');
  var foto=img?img.getAttribute('src')||'':'';
  return {id:pid||('dom_'+Date.now()),productoId:pid||('dom_'+Date.now()),nombre:name||'Producto',precio:price,cantidad:1,qty:1,foto:foto,negocioId:String(window._plazaComercioActualId||window._plazaDetalleComercioId||'')};
}
function _plazaProdFromCache(pid){
  var pools=[window._plazaProdDocsCache,window._plazaProductosCache,window._plazaProductosDetalleCache,window._plazaProductosActuales];
  for(var p=0;p<pools.length;p++){
    var arr=pools[p]; if(!Array.isArray(arr)) continue;
    for(var i=0;i<arr.length;i++){var it=arr[i]||{}; if(String(it._id||it.id||it.productoId||it.key)===String(pid)) return it;}
  }
  return null;
}
function _plazaCloseDetail(){
  ['plaza-prod-det-ov','plaza-prod-det-ov-v35','plaza-prod-det-ov-v36','plaza-prod-modal','plaza-detalle-modal','plaza-producto-modal','plaza-modal-producto','plaza-detalle-producto'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){el.style.display='none';el.style.visibility='hidden';el.style.pointerEvents='none';el.classList&&el.classList.remove('active','show','open');}
  });
  try{document.body.style.overflow='';document.body.style.touchAction='';document.documentElement.style.overflow='';}catch(e){}
  if(document.body.dataset)document.body.dataset.dcModalLocked='';
}
function _plazaDoAdd(pid,q){
  if(window.__dcPlazaAddLock) return false;
  window.__dcPlazaAddLock=true;
  try{
    var p=_plazaProdFromCache(pid)||_plazaProdFromDOM(pid);
    if(!p||p.disponible===false) return false;
    var cnt=qty(q||_plazaGetQty());
    var id=String(p._id||p.id||p.productoId||pid||Date.now());
    var negocio=String(window._plazaComercioActualId||window._plazaDetalleComercioId||p.negocioId||'');
    var c=cart(); if(!Array.isArray(c)) c=[];
    var key=negocio+'::'+id;
    var found=c.find(function(x){return String(x.key||((x.negocioId||'')+'::'+(x.productoId||x.id)))===key;});
    if(found){found.cantidad=qty(Number(found.cantidad||found.qty||0)+cnt);found.qty=found.cantidad;}
    else c.push({id:id,productoId:id,key:key,negocioId:negocio,nombre:p.nombre||'Producto',precio:num(p.precio||p.price||0),cantidad:cnt,qty:cnt,foto:p.foto||p.fotoProducto||p.fotoPublica||''});
    saveCart(c);
    _plazaCloseDetail();
    var ff=window.dcPlazaFinalFelizOficial||window.plazaFinalFelizCarrito;
    if(typeof ff==='function') ff(function(){try{if(typeof window.dcPlazaLimpieza15Render==='function')window.dcPlazaLimpieza15Render();}catch(_){}});
  }finally{window.__dcPlazaAddLock=false;}
  return false;
}
// ══════════════════════════════════════════════
// PLAZA — FINAL FELIZ (overlay "Producto agregado")
// ══════════════════════════════════════════════
function _plazaEnsureFF(){
  var ov=document.getElementById('dc-plaza-fficial-v52');
  if(!ov){
    ov=document.createElement('div');
    ov.id='dc-plaza-fficial-v52';
    ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2147483647;align-items:center;justify-content:center;font-family:inherit;';
    ov.innerHTML='<div id="dc-plaza-fficial-box-v52" class="dc-overlay-box phase-send"><div id="dc-plaza-fficial-body-v52"></div></div>';
    document.body.appendChild(ov);
  }
  return {ov:ov,box:document.getElementById('dc-plaza-fficial-box-v52'),body:document.getElementById('dc-plaza-fficial-body-v52')};
}
function _plazaShowFinal(onDone){
  var x=_plazaEnsureFF(),ov=x.ov,box=x.box,body=x.body;
  clearTimeout(window._dcPlazaV52T1); clearTimeout(window._dcPlazaV52T2);
  box.className='dc-overlay-box phase-send';
  body.innerHTML='<div class="dc-logo-wrap"><svg width="110" height="110" viewBox="0 0 106 106" fill="none"><defs><radialGradient id="bgl_plaza_ff" cx="40%" cy="35%" r="65%"><stop offset="0%" stop-color="#1E3A28"/><stop offset="100%" stop-color="#0C1A10"/></radialGradient></defs><circle cx="53" cy="53" r="50" fill="url(#bgl_plaza_ff)"/><g class="dcf-lr-load"><circle cx="53" cy="53" r="49" fill="none" stroke="#1FC26A" stroke-width="1.5" stroke-dasharray="10 5" stroke-linecap="round"/><circle cx="53" cy="4" r="3.5" fill="#2EE07A"/></g><g class="dcf-pg-load"><polygon points="53,14 57,32 53,28 49,32" fill="#1FC26A"/><polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(60 53 53)"/><polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(120 53 53)"/><polygon points="53,14 57,32 53,28 49,32" fill="#D63A2A" transform="rotate(180 53 53)"/><polygon points="53,14 57,32 53,28 49,32" fill="#27AE60" transform="rotate(240 53 53)"/><polygon points="53,14 57,32 53,28 49,32" fill="#F5C518" transform="rotate(300 53 53)"/></g><circle cx="53" cy="53" r="14" fill="#0C1A10"/><circle cx="53" cy="53" r="14" fill="none" stroke="#1FC26A" stroke-width="1"/><polygon points="53,42 55,50 53,48 51,50" fill="#1FC26A"/><polygon points="53,42 55,50 53,48 51,50" fill="#F5C518" transform="rotate(120 53 53)"/><polygon points="53,42 55,50 53,48 51,50" fill="#D63A2A" transform="rotate(240 53 53)"/><circle cx="53" cy="53" r="4" fill="#1FC26A"/></svg></div>'
    +'<div class="dc-ov-title" style="color:var(--yellow);font-size:20px;font-weight:700;margin-top:0;">Agregando al carrito...</div>'
    +'<div class="dc-ov-sub" style="color:rgba(245,197,24,.8);font-size:13px;margin-top:8px;line-height:1.6;">Estamos guardando tu selección.</div>';
  ov.style.display='flex';
  window._dcPlazaV52T1=setTimeout(function(){
    box.className='dc-overlay-box phase-ok';
    body.innerHTML='<div class="dc-check">✅</div>'
      +'<div class="dc-ov-title" style="color:var(--green);font-size:22px;font-weight:700;margin-top:14px;">Producto agregado</div>'
      +'<div class="dc-ov-sub" style="color:rgba(31,194,106,.85);font-size:13px;margin-top:8px;line-height:1.6;">Producto agregado al carrito<br>exitosamente.</div>';
    window._dcPlazaV52T2=setTimeout(function(){
      ov.style.display='none';
      if(typeof onDone==='function') onDone();
    },1600);
  },1400);
}
window.dcPlazaFinalFelizOficial=_plazaShowFinal;
window.plazaFinalFelizCarrito=function(msg,onDone){_plazaShowFinal(onDone);return false;};
window.plazaShowCarritoToast=function(){_plazaShowFinal();return false;};

// pointerdown/touchstart garantizan que el producto se agrega antes que otros listeners de click.
function _plazaPreAdd(ev){
  var btn=ev.target&&ev.target.closest&&ev.target.closest('button');
  if(!btn) return;
  var id=btn.id||'', oc=(btn.getAttribute('onclick')||'').toLowerCase(), txt=(btn.textContent||'').toLowerCase();
  var isAdd=id.indexOf('plaza-btn-add-cart')===0||oc.indexOf('plazaagregaralcarritodetalle')>-1||txt.indexOf('agregar al carrito')>-1;
  if(!isAdd||!_plazaActiveModal()) return;
  _plazaDoAdd(_plazaPidFrom(btn),_plazaGetQty());
}
window.addEventListener('pointerdown',_plazaPreAdd,true);
window.addEventListener('touchstart',_plazaPreAdd,{capture:true,passive:true});
window.plazaAgregarAlCarritoDetalle=function(pid,ev){
  if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}
  return _plazaDoAdd(pid,_plazaGetQty());
};


// ══════════════════════════════════════════════
// PLAZA — SCROLL LOCK HELPERS
// ══════════════════════════════════════════════
function _dcLockBodyForModal(){
  if(document.body.dataset.dcModalLocked==='1') return;
  var y=window.scrollY||document.documentElement.scrollTop||0;
  document.body.dataset.dcModalLocked='1';
  document.body.dataset.dcModalScrollY=String(y);
  document.body.style.overflow='hidden';
  document.body.style.touchAction='none';
}
function _dcUnlockBodyForModal(){
  if(document.body.dataset.dcModalLocked!=='1') return;
  var y=parseInt(document.body.dataset.dcModalScrollY||'0',10)||0;
  document.body.dataset.dcModalLocked='';
  document.body.dataset.dcModalScrollY='';
  document.body.style.overflow='';
  document.body.style.touchAction='';
  try{window.scrollTo(0,y);}catch(e){}
}
window.plazaCerrarProductoDetalle = function(){
  var ov=document.getElementById('plaza-prod-det-ov');
  if(ov) ov.style.display='none';
  _dcUnlockBodyForModal();
};
window.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    var ov=document.getElementById('plaza-prod-det-ov');
    if(ov&&ov.style.display!=='none') window.plazaCerrarProductoDetalle();
  }
});


// ══════════════════════════════════════════════
// SEGUIMIENTO — RENDER
// ══════════════════════════════════════════════
function ensureSegView(){
  var v=document.getElementById('v-plaza-seguimiento');
  if(!v){
    v=document.createElement('div'); v.className='view go-right'; v.id='v-plaza-seguimiento'; v.style.flexDirection='column';
    v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button">‹</button><div><div class="si13">📍 SEGUIMIENTO</div><div class="si21">Plaza Online</div></div></div></div><div class="scroll" id="v-plaza-seguimiento-lista" style="padding:14px 14px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
    var base=document.getElementById('v-plaza-comprando')||document.getElementById('v-mis-compras-plaza')||document.querySelector('.view:last-of-type');
    if(base&&base.parentNode) base.parentNode.insertBefore(v,base.nextSibling); else document.body.appendChild(v);
  }
  return v;
}
function renderSeguimiento(ord){
  ensureSegView();
  var o=ord||rj(ORDER_KEYS[0],null)||rj(SEL_KEY,{})||{};
  var items=norm(o.items||cart()), t=Number(o.total)||total(items);
  var el=document.getElementById('v-plaza-seguimiento-lista'); if(!el) return false;
  var rows=items.map(function(x){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:.5px solid #eee;"><div><div style="font-size:12px;font-weight:900;color:#111;line-height:1.25;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div style="font-size:10px;color:#777;margin-top:2px;">'+money(num(x.precio))+' c/u</div></div><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty(x.cantidad))+'</div></div>';}).join('');
  var estado=String((o.estado)||'en_proceso').toLowerCase();
  var PASOS=['recibido','en_proceso','listo','en_camino','entregado'];
  var pasoActual=0;
  if(['aceptado','preparando','en_proceso'].indexOf(estado)!==-1) pasoActual=1;
  if(estado==='listo') pasoActual=2;
  if(['en_camino','repartidor_asignado','buscando_repartidor'].indexOf(estado)!==-1) pasoActual=3;
  if(['entregado','recogido','finalizado','completado','anterior'].indexOf(estado)!==-1) pasoActual=4;
  if(['cancelado','rechazado'].indexOf(estado)!==-1) pasoActual=-1;
  function stepBg(n){return n<=pasoActual?'#20c76a':'#f0f2f3';}
  function stepTx(n){return n<=pasoActual?'#111':'#99a1aa';}
  var titulo=pasoActual===4?'¡Compra entregada!':pasoActual===-1?'Compra cancelada':'Compra recibida';
  var sub=pasoActual===4?'Tu pedido fue entregado exitosamente.':pasoActual===-1?'Esta compra fue cancelada.':'Esperando confirmación del negocio';
  var headBg=pasoActual===4?'#e8f9f0':pasoActual===-1?'#fff0f0':'#fff';
  var headBorder=pasoActual===4?'#20c76a':pasoActual===-1?'#e53935':'#dfe5eb';
  el.innerHTML=
    '<div style="background:'+headBg+';border:1.5px solid '+headBorder+';border-radius:16px;padding:24px 14px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:34px;margin-bottom:8px;">'+(pasoActual===4?'✅':pasoActual===-1?'❌':'📦')+'</div><div style="font-size:17px;font-weight:900;color:#111;">'+titulo+'</div><div style="font-size:12px;color:#777;margin-top:5px;">'+sub+'</div></div>'+
    '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:20px 14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);">'+
      '<div style="display:grid;grid-template-columns:34px 1fr;row-gap:18px;align-items:center;">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+stepBg(0)+';color:#fff;display:flex;align-items:center;justify-content:center;">📦</div><div style="font-size:13px;font-weight:900;color:'+stepTx(0)+';">Compra recibida</div>'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+stepBg(1)+';color:#fff;display:flex;align-items:center;justify-content:center;">📋</div><div style="font-size:13px;font-weight:900;color:'+stepTx(1)+';">Preparando pedido</div>'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+stepBg(2)+';color:#fff;display:flex;align-items:center;justify-content:center;">🛍️</div><div style="font-size:13px;font-weight:900;color:'+stepTx(2)+';">Listo</div>'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+stepBg(3)+';color:#fff;display:flex;align-items:center;justify-content:center;">🚚</div><div style="font-size:13px;font-weight:900;color:'+stepTx(3)+';">En camino</div>'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+stepBg(4)+';color:#fff;display:flex;align-items:center;justify-content:center;">🏠</div><div style="font-size:13px;font-weight:900;color:'+stepTx(4)+';">Entregado</div>'+
      '</div>'+
    '</div>'+
    '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:10px;font-weight:900;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Tu compra</div>'+rows+'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:3px;"><div style="font-size:15px;font-weight:900;color:#111;">Total</div><div style="font-size:18px;font-weight:900;color:#111;">'+money(t)+'</div></div><div style="font-size:11px;color:#777;margin-top:12px;">Orden '+esc(o.id||'—')+' · '+fdate(o.fecha)+'</div></div>';
  return false;
}

window.dcPlazaRenderSeguimiento=renderSeguimiento;


// ══════════════════════════════════════════════
// NAVEGACIÓN — go() + dcBack
// ══════════════════════════════════════════════
var _navStack=[];
var _navSuppress=false;

function _activeViewId(){var v=document.querySelector('.view.active');return v&&v.id?v.id:'';}
function _viewExists(id){return !!(id&&document.getElementById(id));}
function _pushView(id){
  if(!id||!_viewExists(id)) return;
  if(_navStack[_navStack.length-1]===id) return;
  _navStack.push(id);
  if(_navStack.length>40) _navStack.splice(0,_navStack.length-40);
}
function _plazaCollapseAll(){
  try{localStorage.setItem('dcPlazaL14CartOpen','0');localStorage.setItem('dcPlazaL14VaciarOpen','0');localStorage.setItem('dcPlazaL14OrderOpen','');}catch(_){}
}
function _resetRegistro(id){
  if(['v-reg-vecino','v-reg-prov','v-reg-ride','v-reg-biz'].indexOf(id)!==-1){
    document.querySelectorAll('.check-row .chk.on').forEach(function(el){el.classList.remove('on');});
    var bv=document.getElementById('btn-reg-vecino');
    if(bv){bv.textContent='Crear mi cuenta →';bv.disabled=false;}
  }
}
function _preHooks(id){
  if(id==='v-reg-prov'&&localStorage.getItem('dcuserEstado')==='aprobado_pendiente_pago') return 'v-espera-pago';
  return id;
}
function _closeFloatingOverlays(){
  try{
    var rp=document.getElementById('dc-rp-overlay');
    if(rp&&rp.style.display==='flex'){rp.style.pointerEvents='none';var rs=document.getElementById('dc-rp-sheet');if(rs)rs.style.transform='translateY(100%)';setTimeout(function(){rp.style.display='none';rp.style.pointerEvents='';},320);}
    var cp=document.getElementById('dc-com-overlay');
    if(cp&&cp.style.display==='flex'){cp.style.pointerEvents='none';var cs=document.getElementById('dc-com-sheet');if(cs)cs.style.transform='translateY(100%)';setTimeout(function(){cp.style.display='none';cp.style.pointerEvents='';},320);}
    var pp=document.getElementById('plaza-prod-det-ov');
    if(pp&&pp.style.display==='flex'){pp.style.display='none';_dcUnlockBodyForModal();}
  }catch(_){}
}
function _postHooks(id){
  _closeFloatingOverlays();
  try{if(id!=='v-mis-compras-plaza') _plazaCollapseAll();}catch(_){}
  try{
    if(id==='v-mis-compras-plaza'){
      window._misComprasPlazaTab='proceso';
      try{localStorage.setItem('dcPlazaQF42Tab',JSON.stringify('proceso'));}catch(_){}
      _plazaCollapseAll();
      setTimeout(function(){try{renderMisCompras(true);}catch(_){}},45);
    }
    if(id==='v-plaza-det'){setTimeout(function(){
      try{
        var el=document.getElementById('plaza-det-nombre');
        var nom=(el&&el.textContent||'').replace(/^\s*🏪\s*/,'').trim();
        if(nom&&Array.isArray(window._plazaDocsCache)){
          var s=window._plazaDocsCache.find(function(x){return nom===(x.nombrePublico||x.nombreNegocio||x.nombre||'');});
          if(s) window._dcPlazaStoreActual=s;
        }
      }catch(_){}
    },300);}
    if(id==='v-plaza-comprando'){setTimeout(function(){try{renderComprando();}catch(_){}},45);}
    if(id==='v-plaza-seguimiento'){setTimeout(function(){try{renderSeguimiento();}catch(_){}},45);}
    if(id==='v-favoritos'){window.__dcL33LastBeforeFav=window.__dcL33LastBeforeFav||'';}
    if(typeof window.__dcNavPatchAll==='function'){setTimeout(window.__dcNavPatchAll,35);setTimeout(window.__dcNavPatchAll,180);}
    _patchFavBack();
  }catch(_){}
}

function dcGoOficial(id,dir){
  id=_preHooks(id); dir=dir||'right';
  var cur=document.querySelector('.view.active'), curId=cur&&cur.id?cur.id:'';
  if(curId==='v-reg-vecino'&&id!=='v-reg-vecino'){var bv=document.getElementById('btn-reg-vecino');if(bv){bv.textContent='Crear mi cuenta →';bv.disabled=false;}}
  _resetRegistro(id);
  if(!id||!_viewExists(id)||(curId&&curId===id)){_postHooks(id);return false;}
  if(dir==='left'&&curId&&typeof window._dcConfirmarSalida==='function'&&!window._dcConfirmarSalida(curId)) return false;
  if(!_navSuppress&&curId&&curId!==id) _pushView(curId);
  try{history.pushState({viewId:id},'','');}catch(_){}
  if(typeof window._goCore==='function') window._goCore(id,dir);
  else if(typeof _goCore==='function') _goCore(id,dir);
  else{if(cur) cur.classList.remove('active');var tgt=document.getElementById(id);if(tgt) tgt.classList.add('active');}
  _postHooks(id);
  return false;
}
dcGoOficial.__dcGoUnicaOficial=true;
dcGoOficial.__dcFrozenAt='2026-06-26';

window.dcBack=function(fallback){
  var cur=_activeViewId(), target='';
  while(_navStack.length){var c=_navStack.pop();if(c&&c!==cur&&_viewExists(c)){target=c;break;}}
  if(!target) target=fallback||'v-home';
  // Safety: from seguimiento never go back to comprando (purchase already done)
  if(target==='v-plaza-comprando'&&(cur==='v-plaza-seguimiento'||cur==='v-mis-compras-plaza')){
    target='';
    while(_navStack.length){var nx=_navStack.pop();if(nx&&nx!=='v-plaza-comprando'&&_viewExists(nx)){target=nx;break;}}
    if(!target) target='v-mis-compras-plaza';
  }
  _navSuppress=true;
  try{dcGoOficial(target,'left');}finally{setTimeout(function(){_navSuppress=false;},0);}
  return false;
};

try{Object.defineProperty(window,'go',{value:dcGoOficial,writable:false,configurable:false});}catch(_){window.go=dcGoOficial;}



// ══════════════════════════════════════════════
// PLAZA NAV BAR (L30)
// ══════════════════════════════════════════════
(function(){
  var PLAZA_VIEWS=/^(v-plaza|v-plaza-det|v-mis-compras-plaza|v-plaza-comprando|v-plaza-seguimiento)$/;
  document.addEventListener('click',function(ev){
    var item=ev.target&&ev.target.closest?ev.target.closest('.nav .ni'):null;
    if(!item) return;
    var view=item.closest('.view');
    if(!view||!PLAZA_VIEWS.test(view.id||'')) return;
    var txt=((item.innerText||item.textContent||'').toLowerCase());
    if(txt.indexOf('inicio')!==-1){ev.preventDefault();ev.stopPropagation();window.go('v-home','left');return;}
    if(txt.indexOf('plaza')!==-1&&txt.indexOf('mis')===-1){ev.preventDefault();ev.stopPropagation();window.go('v-plaza','left');return;}
    if(txt.indexOf('mis compras')!==-1||txt.indexOf('compras')!==-1){ev.preventDefault();ev.stopPropagation();window._misComprasPlazaTab='proceso';window.go('v-mis-compras-plaza','right');return;}
    if(txt.indexOf('reservaciones')!==-1){ev.preventDefault();ev.stopPropagation();window.go('v-mi-agenda','right');setTimeout(function(){try{window._renderMiAgenda&&window._renderMiAgenda();}catch(e){}},200);return;}
    if(txt.indexOf('perfil')!==-1){ev.preventDefault();ev.stopPropagation();window.go('v-mipanel','right');setTimeout(function(){try{window.cargarMiPerfil&&window.cargarMiPerfil();}catch(e){}},180);return;}
  },true);
})();


// ══════════════════════════════════════════════
// NAV AUDIT — patchNav (L33)
// ══════════════════════════════════════════════
(function(){
  function activeId(){var v=document.querySelector('.view.active');return v&&v.id||'';}
  function setItem(item,ic,label,fn,color){
    if(!item) return;
    var i=item.querySelector('.ni-ic,.dcf-ni-ic'), l=item.querySelector('.ni-lb,.dcf-ni-lb');
    if(i) i.textContent=ic;
    if(l){l.textContent=label;l.style.color=color||'';l.classList.remove('dcf-on','si04');}
    item.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();} fn&&fn(); return false;};
  }
  function goTo(id,dir,after){if(typeof window.go==='function') window.go(id,dir||'right');if(after) setTimeout(after,180);}
  function patchNav(root){
    var id=(root&&root.id)||activeId();
    var v=root||document.getElementById(id); if(!v) return;
    var items=v.querySelectorAll('.nav .ni,.dcf-nav .dcf-ni');
    if(!items||!items.length) return;
    items.forEach(function(item){
      var t=((item.querySelector('.ni-lb,.dcf-ni-lb')||{}).textContent||'').trim().toLowerCase();
      if(id==='v-plaza'&&t.indexOf('plaza')!==-1){setItem(item,'🛒','Mis compras',function(){goTo('v-mis-compras-plaza','right',function(){try{window.cargarMisComprasPlaza&&window.cargarMisComprasPlaza();}catch(_){}});},'var(--blue)');}
      if(id==='v-mis-compras-plaza'&&(t.indexOf('mis compras')!==-1||t.indexOf('compras')!==-1)){setItem(item,'🏪','Plaza Online',function(){goTo('v-plaza','left');},'var(--blue)');}
      if(id==='v-food'&&t==='food'){setItem(item,'🛒','Mis pedidos',function(){goTo('v-mis-pedidos-food','right');},'');}
      if(id==='v-mis-pedidos-food'&&(t.indexOf('pedido')!==-1||t.indexOf('mis pedido')!==-1)){setItem(item,'🔔','Alertas',function(){goTo('v-notificaciones','right',function(){try{window.renderNotificaciones&&window.renderNotificaciones();}catch(_){}});},'');}
      if(id==='v-mis-reportes'&&(t.indexOf('solicitud')!==-1||t.indexOf('mis solicitudes')!==-1)){setItem(item,'🔧','Servicios',function(){goTo('v-servicios','left');},'var(--green)');}
      if(id==='v-favoritos'&&t.indexOf('favoritos')!==-1){setItem(item,'🔧','Servicios',function(){goTo('v-servicios','left');},'');}
      if(id==='v-notificaciones'&&t.indexOf('reservaciones')!==-1){setItem(item,'🏠','Inicio',function(){goTo('v-home','left');},'');}
    });
  }
  function patchAll(){
    ['v-plaza','v-mis-compras-plaza','v-food','v-mis-pedidos-food','v-servicios','v-mis-reportes','v-favoritos','v-notificaciones'].forEach(function(id){patchNav(document.getElementById(id));});
    _patchFavBack();
  }
  window.__dcNavPatchAll=patchAll;
  var oldAbrir=window.abrirDetalleProveedor;
  if(typeof oldAbrir==='function'&&!oldAbrir.__dcNavAuditWrap){
    var abrir=function(p){
      window.__dcL33ProviderFromFav=activeId()==='v-favoritos';
      var r=oldAbrir.apply(this,arguments);
      setTimeout(_patchFavBack,90); setTimeout(_patchFavBack,260);
      return r;
    };
    abrir.__dcNavAuditWrap=true;
    window.abrirDetalleProveedor=abrir;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patchAll); else setTimeout(patchAll,0);
  setTimeout(patchAll,250);
  var mo=new MutationObserver(function(){clearTimeout(window.__dcNavPatchTimer);window.__dcNavPatchTimer=setTimeout(patchAll,80);});
  if(document.body) mo.observe(document.body,{childList:true,subtree:true});
})();


// ══════════════════════════════════════════════
// FAVORITOS / DETALLE PROVEEDOR BACK (L35)
// ══════════════════════════════════════════════
function _goBack(fallback){
  if(typeof window.dcBack==='function') return window.dcBack(fallback||'v-home');
  if(typeof window.go==='function') window.go(fallback||'v-home','left');
  return false;
}
function _patchFavBack(){
  var fav=document.getElementById('v-favoritos');
  if(fav){
    var btn=fav.querySelector('.si07 button, button.btn-back');
    if(btn){
      btn.classList.add('btn-back'); btn.textContent='‹'; btn.setAttribute('aria-label','Regresar');
      btn.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();} return _goBack('v-home');};
    }
  }
  var det=document.getElementById('v-serv-det');
  if(det){
    var b2=det.querySelector('#det-header button, .btn-back');
    if(b2){
      b2.classList.add('btn-back'); b2.setAttribute('aria-label','Regresar');
      b2.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();} return _goBack('v-servicios');};
    }
  }
}

document.addEventListener('click',function(ev){
  var favBtn=ev.target&&ev.target.closest&&ev.target.closest('#v-favoritos .si07 button');
  if(favBtn){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();return _goBack('v-home');}
  var detBtn=ev.target&&ev.target.closest&&ev.target.closest('#v-serv-det #det-header button');
  if(detBtn){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();return _goBack('v-servicios');}
},true);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_patchFavBack); else setTimeout(_patchFavBack,0);
setTimeout(_patchFavBack,120); setTimeout(_patchFavBack,400);
var _favMo=new MutationObserver(function(){clearTimeout(window.__dcFavBackTimer);window.__dcFavBackTimer=setTimeout(_patchFavBack,60);});
if(document.body) _favMo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','onclick']});


// ══════════════════════════════════════════════
// ESTADOS GLOBALES UI
// ══════════════════════════════════════════════
if(!window.DC_ESTADOS_GLOBALES_UI){
  window.DC_ESTADOS_GLOBALES_UI={
    pendiente:{dot:'🔵',label:'Pendiente',color:'#1A7AB5'},
    esperando:{dot:'🟡',label:'Esperando',color:'#F5C518'},
    proceso:{dot:'🟢',label:'En proceso',color:'#1FC26A'},
    finalizado:{dot:'⚪',label:'Finalizado',color:'#EAEAEA'},
    cancelado:{dot:'🔴',label:'Cancelado',color:'#D63A2A'},
    pausado:{dot:'🟠',label:'Pausado',color:'#E87722'}
  };
  window.dcEstadoKey=function(txt){
    txt=String(txt||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    if(/cancelad|rechazad|suspendid|cerrad|no aprobado/.test(txt)) return 'cancelado';
    if(/pausad|temporalmente no disponible/.test(txt)) return 'pausado';
    if(/finalizad|completad|entregad|realizada/.test(txt)) return 'finalizado';
    if(/en proceso|prepar|en camino|activo|disponible|confirmad|aceptad|abierto/.test(txt)) return 'proceso';
    if(/esperando|revision|revisi|validacion|validaci|pago pendiente|pendiente de pago|ocupado/.test(txt)) return 'esperando';
    if(/pendiente|nuevo|continuar compra|accion requerida/.test(txt)) return 'pendiente';
    return '';
  };
  function _looksLikeBadge(el){
    if(!el||el.nodeType!==1) return false;
    if(el.closest('script,style,input,textarea,select,option')) return false;
    if(el.classList.contains('dc-state')||el.classList.contains('dc-l14-state')||el.classList.contains('dc-estado-plaza')) return true;
    var cls=' '+(el.className||'')+' ';
    if(/\b(si44|tag|a-badge|chip|admin-badge|prov-badge)\b/.test(cls)) return true;
    var st=(el.getAttribute('style')||'').toLowerCase();
    if(st.indexOf('border-radius')>-1&&st.indexOf('font')>-1) return true;
    return false;
  }
  function _normalizeOne(el){
    if(!_looksLikeBadge(el)) return;
    var txt=(el.textContent||'').trim();
    if(!txt||txt.length>80) return;
    var key=window.dcEstadoKey(txt); if(!key) return;
    ['pendiente','esperando','proceso','finalizado','cancelado','pausado'].forEach(function(k){el.classList.remove('dc-auto-'+k);});
    el.classList.add('dc-state-auto','dc-auto-'+key);
    if(!el.querySelector('.dc-state-dot')&&!/^[🔵🟡🟢⚪🔴🟠]/.test(txt)){
      var s=document.createElement('span'); s.className='dc-state-dot'; el.insertBefore(s,el.firstChild);
    }
  }
  window.dcAplicarEstadosGlobales=function(root){
    root=root||document;
    var sel='.dc-state,.dc-l14-state,.dc-estado-plaza,.si44,.tag,.a-badge,.chip,.admin-badge,.prov-badge,span,div';
    root.querySelectorAll(sel).forEach(function(el){var txt=(el.textContent||'').trim();if(txt.length<=80&&window.dcEstadoKey(txt))_normalizeOne(el);});
  };
  setTimeout(function(){window.dcAplicarEstadosGlobales(document);},60);
  document.addEventListener('click',function(){setTimeout(function(){window.dcAplicarEstadosGlobales(document);},80);},true);
  var _estadoMo=new MutationObserver(function(){if(window.__dcEstadoTimer) clearTimeout(window.__dcEstadoTimer);window.__dcEstadoTimer=setTimeout(function(){window.dcAplicarEstadosGlobales(document);},80);});
  if(document.body) _estadoMo.observe(document.body,{childList:true,subtree:true});
}


// ══════════════════════════════════════════════
// FREEZE — PLAZA ONLINE CLIENTE (Limpieza 2)
// ══════════════════════════════════════════════
(function(){
  var oficiales={
    dcEsComercioPlaza:window.dcEsComercioPlaza,
    _plazaFiltrarSel:window._plazaFiltrarSel,
    _plazaRenderLista:window._plazaRenderLista,
    cargarPlaza:window.cargarPlaza,
    plazaAbrirComercio:window.plazaAbrirComercio,
    plazaCargarProductos:window.plazaCargarProductos,
    _plazaSetProdFiltro:window._plazaSetProdFiltro,
    _plazaRenderProductos:window._plazaRenderProductos
  };
  function congelar(nombre,fn){
    if(typeof fn!=='function') return;
    try{Object.defineProperty(window,nombre,{value:fn,writable:false,configurable:false});}
    catch(e){try{window[nombre]=fn;}catch(_){}}
  }
  Object.keys(oficiales).forEach(function(n){congelar(n,oficiales[n]);});
  document.addEventListener('DOMContentLoaded',function(){
    try{
      var sel=document.getElementById('plaza-cat-select');
      if(sel&&!sel.__dcPlazaFiltroOficial){
        sel.__dcPlazaFiltroOficial=true;
        sel.addEventListener('change',function(){if(typeof window._plazaFiltrarSel==='function') window._plazaFiltrarSel(sel.value||'todos');});
      }
    }catch(e){}
    // Envolver plazaCargarProductos (módulo carga después) para capturar la tienda activa
    setTimeout(function(){
      var orig=window.plazaCargarProductos;
      if(typeof orig==='function'&&!orig._dcStoreWrap){
        window.plazaCargarProductos=function(uidNegocio,negocio,estOp){
          if(negocio) window._dcPlazaStoreActual=negocio;
          return orig.apply(this,arguments);
        };
        window.plazaCargarProductos._dcStoreWrap=true;
      }
    },300);
  });
})();


// ══════════════════════════════════════════════
// FREEZE — FOOD PEDIDOS (Limpieza 8A)
// ══════════════════════════════════════════════
(function(){
  var oficiales=['dcFood_renderCarrito','dcFood_iniciarConfirmacion','dcFood_confirmarTransferencia','dcFood_confirmarPedido','dcFood_iniciarTracking','_renderTracking','dcFood_cancelarPedido','dcFood_cargarMisPedidos','_renderMisPedidos','dcFood_verTracking','dcFood_seguirComprando'];
  window.__DC_FOOD_PEDIDOS_OFICIALES__=window.__DC_FOOD_PEDIDOS_OFICIALES__||{};
  oficiales.forEach(function(nombre){
    var fn=window[nombre]; if(typeof fn!=='function') return;
    window.__DC_FOOD_PEDIDOS_OFICIALES__[nombre]=fn;
    try{Object.defineProperty(window,nombre,{configurable:false,enumerable:true,get:function(){return window.__DC_FOOD_PEDIDOS_OFICIALES__[nombre];},set:function(nueva){if(typeof nueva==='function'){}}});}catch(e){}
  });
})();


// ══════════════════════════════════════════════
// FREEZE — RESTAURANTE PANEL (Limpieza 7B)
// ══════════════════════════════════════════════
(function(){
  var oficiales={
    _renderMenuRest:window._renderMenuRest,
    _renderMenuRestFiltrado:window._renderMenuRestFiltrado,
    filtrarMenu:window.filtrarMenu,
    filtrarMenuBusqueda:window.filtrarMenuBusqueda,
    crearCategoria:window.crearCategoria,
    eliminarCategoria:window.eliminarCategoria,
    abrirFormProd:window.abrirFormProd,
    guardarProducto:window.guardarProducto,
    eliminarProducto:window.eliminarProducto,
    toggleDisp:window.toggleDisp,
    _vrCargarMenu:window._vrCargarMenu,
    _vrMenu:window._vrMenu,
    _pfCatNueva:window._pfCatNueva
  };
  Object.keys(oficiales).forEach(function(nombre){
    if(typeof oficiales[nombre]!=='function') return;
    try{Object.defineProperty(window,nombre,{value:oficiales[nombre],writable:false,configurable:false});}
    catch(e){try{window[nombre]=oficiales[nombre];}catch(_){}}
  });
  window.__DC_REST_PANEL_7B_KEYS__=Object.keys(oficiales).filter(function(k){return typeof oficiales[k]==='function';});
})();


})(); // fin IIFE principal


// ══════════════════════════════════════════════
// FIREBASE HELPERS + RATING + CMV + MEMBRESÍA
// (migrados desde index.html)
// ══════════════════════════════════════════════
var _FBFS='https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
async function _fbGet4(a,b,c,d){var m=await import(_FBFS);return m.getDoc(m.doc(window._fbDb,a,b,c,d));}
async function _fbGet2(a,b){var m=await import(_FBFS);return m.getDoc(m.doc(window._fbDb,a,b));}
async function _fbSet4(a,b,c,d,data){var m=await import(_FBFS);return m.setDoc(m.doc(window._fbDb,a,b,c,d),data);}
async function _fbMerge2(a,b,data){var m=await import(_FBFS);return m.setDoc(m.doc(window._fbDb,a,b),data,{merge:true});}
async function _fbUpd2(a,b,data){var m=await import(_FBFS);return m.updateDoc(m.doc(window._fbDb,a,b),data);}
async function _fbColSub3(a,b,c){var m=await import(_FBFS);return m.getDocs(m.collection(window._fbDb,a,b,c));}

function _feliz(msg){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:20px;padding:28px 24px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.22);z-index:9999;min-width:240px;font-family:Inter,sans-serif;';
  t.innerHTML='<div style="font-size:40px;margin-bottom:12px;">&#x2705;</div><div style="font-size:15px;font-weight:700;color:#111;margin-bottom:6px;">'+msg+'</div><button onclick="this.parentNode.remove()" style="margin-top:14px;background:#1fc26a;color:#fff;border:none;border-radius:12px;padding:10px 28px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Aceptar</button>';
  document.body.appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},3000);
}

/* ======= RATING ======= */
var _ratingSel=0;
window._ratingVotoActual={nr:0,comentario:''};
function _ratingMostrarVotado(nr,comentario,prom,cnt){
  window._ratingVotoActual={nr:nr,comentario:comentario||''};
  var blk=document.getElementById('det-rating-block'); if(!blk)return;
  var comHtml=comentario?'<div style="font-size:11px;color:#7a5000;background:#fffbe6;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-style:italic;">&ldquo;'+comentario.replace(/</g,'&lt;')+'&rdquo;</div>':'';
  blk.innerHTML='<div style="font-size:12px;font-weight:700;color:#7a5000;margin-bottom:6px;">&#x2B50; Tu calificaci&#xF3;n</div>'
    +'<div style="font-size:22px;margin-bottom:6px;">'+'&#x2B50;'.repeat(nr)+'&#x2606;'.repeat(5-nr)+'</div>'
    +comHtml
    +(prom!==null?'<div style="font-size:11px;color:#9a7020;margin-bottom:10px;">Promedio: &#x2B50; '+prom+' ('+cnt+' opiniones)</div>':'')
    +'<button onclick="dcProvRatingModoEditar()" style="background:none;border:1px solid #d4a020;border-radius:10px;padding:7px 16px;font-size:12px;font-weight:700;color:#9a7020;cursor:pointer;font-family:inherit;">&#x270F;&#xFE0F; Editar calificaci&#xF3;n</button>';
}

window.dcProvRatingModoEditar=function(){
  var b=document.getElementById('det-rating-block'); if(!b)return;
  var nr=window._ratingVotoActual.nr||0; var com=window._ratingVotoActual.comentario||'';
  _ratingSel=nr;
  var estrellas='';
  for(var i=1;i<=5;i++) estrellas+='<span onclick="dcProvRatingSet('+i+')" style="font-size:28px;cursor:pointer;">'+(i<=nr?'&#x2B50;':'&#x2606;')+'</span>';
  b.innerHTML='<div style="font-size:12px;font-weight:700;color:#7a5000;margin-bottom:4px;">&#x2B50; Calificar proveedor</div>'
    +'<div id="det-stars" style="display:flex;gap:6px;margin-bottom:10px;">'+estrellas+'</div>'
    +'<textarea id="det-rating-com" class="nota" rows="2" placeholder="Comentario opcional...">'+com+'</textarea>'
    +'<button onclick="dcProvRatingEnviar()" style="width:100%;margin-top:8px;background:#F5C518;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;color:#1a1200;cursor:pointer;font-family:inherit;">Enviar calificaci&#xF3;n &#x2192;</button>';
};


window.dcProvRatingSet=function(n){
  _ratingSel=n;
  document.querySelectorAll('#det-stars span').forEach(function(s,i){s.innerHTML=i<n?'&#x2B50;':'&#x2606;';});
};

window.dcProvRatingEnviar=async function(){
  if(!_ratingSel){alert('Selecciona estrellas');return;}
  var p=window._proveedorActual||{}; var pUid=p.uid||p.id||''; if(!pUid)return;
  var auth=window._fbAuth; var myUid=auth&&auth.currentUser&&auth.currentUser.uid;
  if(!myUid){alert('Inicia sesión');return;}
  var com=(document.getElementById('det-rating-com')||{}).value||'';
  var btn=document.querySelector('#det-rating-block button:last-child');
  if(btn){btn.disabled=true;btn.textContent='&#x23F3; Guardando...';}
  try{
    var miNombre=localStorage.getItem('dcuser')||'Vecino';
    await _fbSet4('calificaciones',pUid,'votos',myUid,{rating:_ratingSel,comentario:com,fecha:new Date().toISOString(),nombre:miNombre});
    var snap=await _fbColSub3('calificaciones',pUid,'votos');
    var tot=0,cnt=0; snap.forEach(function(d){tot+=(d.data().rating||0);cnt++;});
    var prom=cnt?Math.round((tot/cnt)*10)/10:0;
    await _fbSet4('calificaciones',pUid,'resumen','datos',{promedio:prom,total:cnt});
    try{await _fbUpd2('usuarios',pUid,{ratingPromedio:prom,ratingTotal:cnt});}catch(e){}
    var nr=_ratingSel; var c=com; _ratingSel=0;
    _ratingMostrarVotado(nr,c,prom,cnt);
    _feliz('&#xA1;Gracias por calificar!');
  }catch(e){
    console.error('rating',e);
    if(btn){btn.disabled=false;btn.textContent='Enviar calificación →';}
    alert('Error: '+e.message);
  }
};

window.dcProvRatingCargar=async function(pUid){
  var blk=document.getElementById('det-rating-block'); if(!blk)return;
  var tipo=(localStorage.getItem('dcuserTipo')||'').toLowerCase();
  if(tipo!=='vecino'){blk.style.display='none';return;}
  blk.style.display='block'; _ratingSel=0;
  blk.innerHTML='<div style="text-align:center;padding:20px;color:#cca020;font-size:12px;">Cargando...</div>';
  if(!pUid||!window._fbDb){dcProvRatingModoEditar();return;}
  try{
    var promSnap=await _fbGet4('calificaciones',pUid,'resumen','datos');
    var prom=null,cnt=0;
    if(promSnap.exists()){var pd=promSnap.data();prom=pd.promedio||null;cnt=pd.total||0;}
    var avg=document.getElementById('det-rating-avg');
    if(avg) avg.textContent=prom!==null?'&#x2B50; '+prom+' ('+cnt+' opiniones)':'Sé el primero en calificar';
    var auth2=window._fbAuth; var myUid2=auth2&&auth2.currentUser&&auth2.currentUser.uid;
    if(myUid2){
      var mv=await _fbGet4('calificaciones',pUid,'votos',myUid2);
      if(mv.exists()){
        var vd=mv.data();
        _ratingMostrarVotado(vd.rating||0,vd.comentario||'',prom,cnt);
        _ratingMostrarOpiniones(pUid,myUid2);
        return;
      }
    }
    dcProvRatingModoEditar();
    _ratingMostrarOpiniones(pUid,myUid2||'');
  }catch(e){console.error('rating-cargar',e);dcProvRatingModoEditar();}
};

async function _ratingMostrarOpiniones(pUid,myUid){
  var ob=document.getElementById('det-opiniones-block'); if(!ob)return;
  try{
    var snap=await _fbColSub3('calificaciones',pUid,'votos');
    var items=[];
    snap.forEach(function(d){
      var v=d.data();
      if(d.id!==myUid&&(v.comentario||'').trim()) items.push(v);
    });
    if(!items.length){ob.style.display='none';return;}
    ob.style.display='block';
    var html='<div style="font-size:12px;font-weight:700;color:#555;margin-bottom:8px;">Opiniones de clientes</div>';
    items.forEach(function(v){
      var nr=v.rating||0;
      var fecha=v.fecha?new Date(v.fecha).toLocaleDateString('es-MX'):'';
      html+='<div style="background:#fff;border-radius:12px;padding:12px;margin-bottom:8px;border:.5px solid #e8e8e8;">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
        +'<span style="font-size:13px;">'+('⭐'.repeat(nr)+'☆'.repeat(5-nr))+'</span>'
        +'<span style="font-size:10px;color:#aaa;">'+fecha+'</span></div>'
        +(v.comentario?'<div style="font-size:12px;color:#444;line-height:1.5;margin-bottom:4px;font-style:italic;">&ldquo;'+v.comentario.replace(/</g,'&lt;')+'&rdquo;</div>':'')
        +'<div style="font-size:11px;color:#888;">'+( v.nombre||'Vecino')+'</div>'
        +'</div>';
    });
    ob.innerHTML=html;
  }catch(e){ob.style.display='none';}
};

/* ======= GENERIC RATING ENGINE (restaurantes + negocios) ======= */
window._dcRatingUid={};
window._dcRatingSelGen={};
window._dcRatingVotoGen={};

function _dcGenRatingMostrarVotado(nr,comentario,prom,cnt,blockId){
  window._dcRatingVotoGen[blockId]={nr:nr,comentario:comentario||''};
  var blk=document.getElementById(blockId+'-rating-block'); if(!blk)return;
  var comHtml=comentario?'<div style="font-size:11px;color:#7a5000;background:#fffbe6;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-style:italic;">&ldquo;'+comentario.replace(/</g,'&lt;')+'&rdquo;</div>':'';
  blk.innerHTML='<div style="font-size:12px;font-weight:700;color:#7a5000;margin-bottom:6px;">&#x2B50; Tu calificaci&#xF3;n</div>'
    +'<div style="font-size:22px;margin-bottom:6px;">'+'&#x2B50;'.repeat(nr)+'&#x2606;'.repeat(5-nr)+'</div>'
    +comHtml
    +(prom!==null?'<div style="font-size:11px;color:#9a7020;margin-bottom:10px;">Promedio: &#x2B50; '+prom+' ('+cnt+' opiniones)</div>':'')
    +'<button onclick="window.dcRatingModoEditar(\''+blockId+'\')" style="background:none;border:1px solid #d4a020;border-radius:10px;padding:7px 16px;font-size:12px;font-weight:700;color:#9a7020;cursor:pointer;font-family:inherit;">&#x270F;&#xFE0F; Editar calificaci&#xF3;n</button>';
}

window.dcRatingModoEditar=function(blockId){
  var b=document.getElementById(blockId+'-rating-block'); if(!b)return;
  var voto=window._dcRatingVotoGen[blockId]||{}; var nr=voto.nr||0; var com=voto.comentario||'';
  window._dcRatingSelGen[blockId]=nr;
  var estrellas='';
  for(var i=1;i<=5;i++) estrellas+='<span onclick="window.dcRatingSet('+i+',\''+blockId+'\')" style="font-size:28px;cursor:pointer;">'+(i<=nr?'&#x2B50;':'&#x2606;')+'</span>';
  b.innerHTML='<div style="font-size:12px;font-weight:700;color:#7a5000;margin-bottom:4px;">&#x2B50; Calificar</div>'
    +'<div id="'+blockId+'-stars" style="display:flex;gap:6px;margin-bottom:10px;">'+estrellas+'</div>'
    +'<textarea id="'+blockId+'-rating-com" class="nota" rows="2" placeholder="Comentario opcional...">'+com+'</textarea>'
    +'<button onclick="window.dcRatingEnviar(\''+blockId+'\')" style="width:100%;margin-top:8px;background:#F5C518;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;color:#1a1200;cursor:pointer;font-family:inherit;">Enviar calificaci&#xF3;n &#x2192;</button>';
};

window.dcRatingSet=function(n,blockId){
  window._dcRatingSelGen[blockId]=n;
  document.querySelectorAll('#'+blockId+'-stars span').forEach(function(s,i){s.innerHTML=i<n?'&#x2B50;':'&#x2606;';});
};

window.dcRatingEnviar=async function(blockId){
  var nr=window._dcRatingSelGen[blockId]||0;
  if(!nr){alert('Selecciona estrellas');return;}
  var pUid=window._dcRatingUid[blockId]||''; if(!pUid)return;
  var auth=window._fbAuth; var myUid=auth&&auth.currentUser&&auth.currentUser.uid;
  if(!myUid){alert('Inicia sesión');return;}
  var com=(document.getElementById(blockId+'-rating-com')||{}).value||'';
  var btn=document.querySelector('#'+blockId+'-rating-block button:last-child');
  if(btn){btn.disabled=true;btn.textContent='⏳ Guardando...';}
  try{
    var miNombre=localStorage.getItem('dcuser')||'Vecino';
    await _fbSet4('calificaciones',pUid,'votos',myUid,{rating:nr,comentario:com,fecha:new Date().toISOString(),nombre:miNombre});
    var snap=await _fbColSub3('calificaciones',pUid,'votos');
    var tot=0,cnt=0; snap.forEach(function(d){tot+=(d.data().rating||0);cnt++;});
    var prom=cnt?Math.round((tot/cnt)*10)/10:0;
    await _fbSet4('calificaciones',pUid,'resumen','datos',{promedio:prom,total:cnt});
    try{await _fbUpd2('usuarios',pUid,{ratingPromedio:prom,ratingTotal:cnt});}catch(e){}
    var avgEl=document.getElementById(blockId+'-rating-avg');
    if(avgEl) avgEl.textContent='⭐ '+prom+' ('+cnt+' opiniones)';
    var savedNr=nr; var savedCom=com; window._dcRatingSelGen[blockId]=0;
    _dcGenRatingMostrarVotado(savedNr,savedCom,prom,cnt,blockId);
    _feliz('¡Gracias por calificar!');
    _dcGenRatingMostrarOpiniones(pUid,myUid,blockId);
  }catch(e){
    console.error('rating-gen',e);
    if(btn){btn.disabled=false;btn.textContent='Enviar calificación →';}
    alert('Error: '+e.message);
  }
};

window.dcRatingCargar=async function(pUid,blockId,titulo){
  window._dcRatingUid[blockId]=pUid;
  var blk=document.getElementById(blockId+'-rating-block');
  if(!blk)return;
  var tipo=(localStorage.getItem('dcuserTipo')||'').toLowerCase();
  if(tipo!=='vecino')return;
  window._dcRatingSelGen[blockId]=0;
  blk.innerHTML='<div style="text-align:center;padding:20px;color:#cca020;font-size:12px;">Cargando...</div>';
  if(!pUid||!window._fbDb){window.dcRatingModoEditar(blockId);return;}
  try{
    var promSnap=await _fbGet4('calificaciones',pUid,'resumen','datos');
    var prom=null,cnt=0;
    if(promSnap.exists()){var pd=promSnap.data();prom=pd.promedio||null;cnt=pd.total||0;}
    var avgEl=document.getElementById(blockId+'-rating-avg');
    if(avgEl) avgEl.textContent=prom!==null?'⭐ '+prom+' ('+cnt+' opiniones)':'Sé el primero en calificar';
    var auth2=window._fbAuth; var myUid2=auth2&&auth2.currentUser&&auth2.currentUser.uid;
    if(myUid2){
      var mv=await _fbGet4('calificaciones',pUid,'votos',myUid2);
      if(mv.exists()){
        var vd=mv.data();
        _dcGenRatingMostrarVotado(vd.rating||0,vd.comentario||'',prom,cnt,blockId);
        _dcGenRatingMostrarOpiniones(pUid,myUid2,blockId);
        return;
      }
    }
    window.dcRatingModoEditar(blockId);
    _dcGenRatingMostrarOpiniones(pUid,myUid2||'',blockId);
  }catch(e){console.error('rating-gen-cargar',e);window.dcRatingModoEditar(blockId);}
};

async function _dcGenRatingMostrarOpiniones(pUid,myUid,blockId){
  var ob=document.getElementById(blockId+'-opiniones-block'); if(!ob)return;
  try{
    var snap=await _fbColSub3('calificaciones',pUid,'votos');
    var items=[];
    snap.forEach(function(d){var v=d.data();if(d.id!==myUid&&(v.comentario||'').trim())items.push(v);});
    if(!items.length){ob.style.display='none';return;}
    ob.style.display='block';
    var html='<div style="font-size:12px;font-weight:700;color:#555;margin-bottom:8px;">Opiniones de clientes</div>';
    items.forEach(function(v){
      var nr=v.rating||0; var fecha=v.fecha?new Date(v.fecha).toLocaleDateString('es-MX'):'';
      html+='<div style="background:#fff;border-radius:12px;padding:12px;margin-bottom:8px;border:.5px solid #e8e8e8;">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:4px;">'
        +'<span style="font-size:13px;">'+('⭐'.repeat(nr)+'☆'.repeat(5-nr))+'</span>'
        +'<span style="font-size:10px;color:#aaa;">'+fecha+'</span></div>'
        +(v.comentario?'<div style="font-size:12px;color:#444;line-height:1.5;margin-bottom:4px;font-style:italic;">&ldquo;'+v.comentario.replace(/</g,'&lt;')+'&rdquo;</div>':'')
        +'<div style="font-size:11px;color:#888;">'+(v.nombre||'Vecino')+'</div>'
        +'</div>';
    });
    ob.innerHTML=html;
  }catch(e){ob.style.display='none';}
}

/* ======= CMV PROVEEDOR ======= */
window._cmvFotoB64=null;
window._cmvFotos=[];

window.vprovCmvRenderPreview=function(){
  var nm=(document.getElementById('vprov-cmv-nombre')||{}).value||'Mi nombre';
  var ds=(document.getElementById('vprov-cmv-desc')||{}).value||'Descripción';
  var ofs=(document.getElementById('vprov-cmv-oficios')||{}).textContent||'';
  var foto=window._cmvFotoB64||((document.getElementById('vprov-cmv-foto-prev')||{}).dataset||{}).src||'';
  var fHtml=foto
    ?'<img src="'+foto+'" style="width:54px;height:54px;object-fit:cover;border-radius:13px;border:2px solid #e8e8e8;flex-shrink:0;">'
    :'<div style="width:54px;height:54px;border-radius:13px;background:#e8f5ee;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">&#x1F527;</div>';
  var p=document.getElementById('vprov-cmv-preview'); if(!p)return;
  p.innerHTML='<div style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff;border-radius:16px;border:.5px solid #e8e8e8;">'
    +fHtml+'<div style="flex:1;min-width:0;">'
    +'<div style="font-size:15px;font-weight:700;color:#111;margin-bottom:2px;">'+nm+'</div>'
    +'<div style="font-size:11px;color:#555;margin-bottom:4px;">'+ofs+'</div>'
    +'<div style="font-size:11px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+ds+'</div>'
    +'</div><div style="flex-shrink:0;"><div style="background:#1fc26a;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;border-radius:9px;">Contactar</div></div></div>';
};

window.vprovCmvFotoChange=function(inp){
  if(!inp.files||!inp.files[0])return;
  var r=new FileReader(); r.onload=function(e){
    window._cmvFotoB64=e.target.result;
    var pv=document.getElementById('vprov-cmv-foto-prev');
    if(pv)pv.innerHTML='<img src="'+window._cmvFotoB64+'" style="width:100%;height:100%;object-fit:cover;">';
    window.vprovCmvRenderPreview();
  }; r.readAsDataURL(inp.files[0]);
};

function _cmvRenderGrid(){
  var g=document.getElementById('vprov-cmv-fotos-grid'); if(!g)return;
  g.innerHTML='';
  window._cmvFotos.forEach(function(src,i){
    var d=document.createElement('div');
    d.style.cssText='position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;background:#eee;flex-shrink:0;display:inline-block;margin:2px;';
    var img=document.createElement('img');
    img.src=src; img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
    var btn=document.createElement('button');
    btn.innerHTML='&times;';
    btn.style.cssText='position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.7);border:none;color:#fff;font-size:16px;line-height:22px;text-align:center;cursor:pointer;padding:0;';
    (function(idx){btn.onclick=function(ev){ev.stopPropagation();window.vprovCmvQuitarFoto(idx);};})(i);
    d.appendChild(img); d.appendChild(btn);
    g.appendChild(d);
  });
}
window.vprovCmvQuitarFoto=function(i){window._cmvFotos.splice(i,1);_cmvRenderGrid();};
window.vprovCmvFotosChange=function(inp){
  if(!inp.files||!inp.files.length)return;
  Array.from(inp.files).forEach(function(f){
    var r=new FileReader(); r.onload=function(e){window._cmvFotos.push(e.target.result);_cmvRenderGrid();}; r.readAsDataURL(f);
  });
};

window.vprovCmvCargar=async function(){
  window._cmvFotoB64=null; window._cmvFotos=[];
  var g=document.getElementById('vprov-cmv-fotos-grid'); if(g)g.innerHTML='';
  window.vprovCmvRenderPreview();
  var auth=window._fbAuth; if(!auth||!auth.currentUser||!window._fbDb)return;
  var uid=auth.currentUser.uid;
  try{
    var snap=await _fbGet2('usuarios',uid); if(!snap.exists())return;
    var d=snap.data();
    var nm=document.getElementById('vprov-cmv-nombre'); if(nm)nm.value=d.nombre||'';
    var ds=document.getElementById('vprov-cmv-desc'); if(ds)ds.value=d.descripcion||'';
    var ofs=[d.oficio1,d.oficio2,d.oficio3].filter(Boolean).join(' · ')||d.categoria||'—';
    var oEl=document.getElementById('vprov-cmv-oficios'); if(oEl)oEl.textContent=ofs;
    if(d.fotoUrl){
      window._cmvFotoB64=d.fotoUrl;
      var pv=document.getElementById('vprov-cmv-foto-prev');
      if(pv){pv.innerHTML='<img src="'+d.fotoUrl+'" style="width:100%;height:100%;object-fit:cover;">';}
    }
    window.vprovCmvRenderPreview();
  }catch(e){console.error('cmv-cargar',e);}
};

window.vprovCmvGuardar=async function(){
  var auth=window._fbAuth; if(!auth||!auth.currentUser){alert('Sin sesión');return;}
  var uid=auth.currentUser.uid;
  var nm=(document.getElementById('vprov-cmv-nombre')||{}).value||'';
  var ds=(document.getElementById('vprov-cmv-desc')||{}).value||'';
  var btn=document.getElementById('vprov-cmv-btn-guardar');
  if(btn){btn.disabled=true;btn.textContent='&#x23F3; Guardando...';}
  try{
    var datos={nombre:nm,descripcion:ds};
    if(window._cmvFotoB64) datos.fotoUrl=window._cmvFotoB64;
    await _fbMerge2('usuarios',uid,datos);
    if(btn){btn.disabled=false;btn.textContent='Guardar cambios';}
    window.vprovCmvRenderPreview();
    _feliz('&#xA1;Perfil actualizado!');
  }catch(e){
    console.error('cmv-guardar',e);
    if(btn){btn.disabled=false;btn.textContent='Guardar cambios';}
    alert('Error al guardar: '+e.message);
  }
};

/* ======= MEMBRESIA ======= */
window.cargarMembresia=async function(){
  var cont=document.getElementById('memb-cont'); if(!cont)return;
  cont.innerHTML='<div style="text-align:center;padding:40px;color:#aaa;">Cargando...</div>';
  var auth=window._fbAuth;
  if(!auth||!auth.currentUser){cont.innerHTML='<div style="text-align:center;padding:40px;color:#aaa;">Sin sesión</div>';return;}
  var uid=auth.currentUser.uid;
  try{
    var snap=await _fbGet2('usuarios',uid);
    var d=snap.exists()?snap.data():{};
    var memb=d.membresia||{};
    var est=memb.estado||'pendiente_pago';
    var fv=memb.fechaVencimiento;
    var vence=fv?new Date(fv.seconds?fv.seconds*1000:fv).toLocaleDateString('es-MX'):'—';
    var plan=memb.plan||'Básico', monto=memb.monto||150;
    var cActivo='#0A4220',cVencido='#D63A2A',cPend='#9A6800';
    var col=est==='activo'?cActivo:est==='vencido'?cVencido:cPend;
    var bg=est==='activo'?'#E8F5EE':est==='vencido'?'#FDECEA':'#FFF8E1';
    var lbl=est==='activo'?'&#x2705; Activa':est==='vencido'?'&#x1F534; Vencida':'&#x23F3; Pendiente de pago';
    cont.innerHTML='<div style="background:'+bg+';border-radius:16px;padding:22px;margin-bottom:16px;text-align:center;">'
      +'<div style="font-size:36px;margin-bottom:10px;">&#x1F48E;</div>'
      +'<div style="font-size:18px;font-weight:800;color:'+col+';margin-bottom:6px;">Plan '+plan+'</div>'
      +'<div style="display:inline-block;background:'+col+';color:#fff;font-size:11px;font-weight:700;padding:4px 16px;border-radius:20px;">'+lbl+'</div></div>'
      +'<div style="background:#fff;border-radius:14px;border:.5px solid #e8e8e8;padding:16px;margin-bottom:14px;">'
      +'<div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:.5px solid #f0f0f0;margin-bottom:10px;">'
      +'<span style="font-size:12px;color:#888;">Vigencia hasta</span><span style="font-size:13px;font-weight:700;">'+vence+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;">'
      +'<span style="font-size:12px;color:#888;">Monto mensual</span><span style="font-size:15px;font-weight:800;color:#1fc26a;">'+monto+' MXN</span></div></div>'
      +(est==='activo'?''
        :'<div style="background:#FFF8E1;border-radius:14px;padding:16px;margin-bottom:14px;">'
        +'<div style="font-size:12px;font-weight:700;color:#9A6800;margin-bottom:8px;">&#x1F4B3; Cómo pagar</div>'
        +'<div style="font-size:12px;color:#7a5000;line-height:1.8;">1. Transferencia o depósito<br>2. Monto: <strong>'+monto+' MXN/mes</strong><br>3. Envía comprobante por WhatsApp al equipo DC App Servis<br>4. Activación en menos de 24 hrs</div></div>')
      +'<div style="background:#f8f8f8;border-radius:14px;padding:14px;font-size:11px;color:#888;">¿Dudas? <strong>zonadominiocumbres@gmail.com</strong></div>';
  }catch(e){
    console.error('membresia',e);
    cont.innerHTML='<div style="text-align:center;padding:40px;color:#aaa;">Error: '+e.message+'</div>';
  }
};

// ══════════════════════════════════════════════
// RATING POPUP
// ══════════════════════════════════════════════
(function(){
  var _rpUid='', _rpSel=0, _rpVotadoCom='', _rpComOpen=false;
  var _rpCache={}, _RP_TTL=300000; // cache votos 5 min por bizId
  function _rpCacheGet(id){ var c=_rpCache[id]; return c&&(Date.now()-c.ts<_RP_TTL)?c.votos:null; }
  function _rpCacheSet(id,votos){ _rpCache[id]={ts:Date.now(),votos:votos}; }
  function _rpCacheDel(id){ delete _rpCache[id]; }

  function _rpSetBody(html){ var b=document.getElementById('dc-rp-body'); if(b)b.innerHTML=html; }
  function _rpSetSub(t){ var s=document.getElementById('dc-rp-subtitulo'); if(s)s.textContent=t; }

  function _rpEstiloBtnCalificado(btn){
    btn.innerHTML='✅ Calificado';
    btn.style.cssText='background:#FFEBEE;border:1px solid #E53935;border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:#C62828;cursor:pointer;font-family:inherit;white-space:nowrap;';
  }

  function _rpMarcarBotonesCalificado(bizId){
    document.querySelectorAll('[data-rate-id="'+bizId+'"]').forEach(function(btn){ _rpEstiloBtnCalificado(btn); });
    var myUid=(window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||localStorage.getItem('dcuserUid')||'';
    if(!myUid)return;
    var key='dcVotado_'+myUid, votados={};
    try{votados=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
    votados[bizId]=1;
    try{localStorage.setItem(key,JSON.stringify(votados));}catch(e){}
  }

  window._rpIniciarBotonesVecino=function(){
    var tipo=(localStorage.getItem('dcuserTipo')||'').toLowerCase();
    if(tipo!=='vecino')return;
    var myUid=(window._fbAuth&&window._fbAuth.currentUser&&window._fbAuth.currentUser.uid)||localStorage.getItem('dcuserUid')||'';
    if(!myUid)return;
    var key='dcVotado_'+myUid, votados={};
    try{votados=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
    document.querySelectorAll('[data-rate-id]').forEach(function(btn){
      if(votados[btn.getAttribute('data-rate-id')])_rpEstiloBtnCalificado(btn);
    });
  };

  window.dcRatingAbrirPopup=function(pUid,nombre,e){
    if(e)e.stopPropagation();
    var tipo=(localStorage.getItem('dcuserTipo')||'').toLowerCase();
    if(tipo!=='vecino'){alert('Solo los vecinos pueden calificar.');return;}
    _rpUid=pUid; _rpSel=0; _rpVotadoCom=''; _rpComOpen=false;
    var ov=document.getElementById('dc-rp-overlay'), sh=document.getElementById('dc-rp-sheet');
    if(!ov||!sh)return;
    document.getElementById('dc-rp-nombre').textContent=nombre||'—';
    _rpSetSub('Cargando...');
    var avg=document.getElementById('dc-rp-avg'); avg.textContent=''; avg.style.display='none';
    document.getElementById('dc-rp-com-wrap').style.display='none';
    document.getElementById('dc-rp-comentarios').style.display='none';
    _rpSetBody('<div style="text-align:center;padding:28px 0;color:#ccc;font-size:13px;">⏳</div>');
    ov.style.display='flex';
    requestAnimationFrame(function(){sh.style.transform='translateY(0)';sh.scrollTop=0;});
    _rpCargarDatos(pUid);
  };

  window.dcRatingCerrarPopup=function(){
    var sh=document.getElementById('dc-rp-sheet'), ov=document.getElementById('dc-rp-overlay');
    if(!sh||!ov)return;
    sh.style.transform='translateY(100%)';
    ov.style.pointerEvents='none';
    setTimeout(function(){ov.style.display='none';ov.style.pointerEvents='';},320);
  };

  function _rpStarsHtml(sel,interactive){
    var h='';
    for(var i=1;i<=5;i++){
      if(interactive) h+='<span onclick="window._rpSetStar('+i+')" style="font-size:38px;cursor:pointer;transition:transform .12s;line-height:1;user-select:none;">'+(i<=sel?'⭐':'☆')+'</span>';
      else h+='<span style="font-size:28px;line-height:1;">'+(i<=sel?'⭐':'<span style="opacity:.22;">☆</span>')+'</span>';
    }
    return h;
  }

  window._rpSetStar=function(n){
    _rpSel=n;
    var cont=document.getElementById('dc-rp-stars-live'); if(!cont)return;
    cont.innerHTML='';
    for(var i=1;i<=5;i++){
      var s=document.createElement('span');
      s.innerHTML=i<=n?'⭐':'☆';
      s.style.cssText='font-size:38px;cursor:pointer;transition:transform .12s;line-height:1;user-select:none;';
      (function(nn,el){
        el.onmouseenter=function(){el.style.transform='scale(1.2)';};
        el.onmouseleave=function(){el.style.transform='scale(1)';};
        el.onclick=function(){window._rpSetStar(nn);};
      })(i,s);
      cont.appendChild(s);
    }
  };

  function _rpMostrarFormulario(nr, com, esEdicion){
    _rpSel=nr||0;
    _rpSetSub(esEdicion?'Editar tu calificación':'Comparte tu experiencia');
    _rpSetBody(
      '<div id="dc-rp-stars-live" style="display:flex;gap:10px;justify-content:center;margin:4px 0 2px;"></div>'
      +'<textarea id="dc-rp-ta" class="nota" rows="2" placeholder="Comentario opcional..." style="resize:none;">'+(com||'')+'</textarea>'
      +'<button onclick="window.dcRatingPopupEnviar&&window.dcRatingPopupEnviar()" style="background:#F5C518;border:none;border-radius:14px;padding:13px;font-size:14px;font-weight:800;color:#1a1200;cursor:pointer;font-family:inherit;width:100%;">'+(esEdicion?'Actualizar calificación →':'Guardar calificación →')+'</button>'
    );
    window._rpSetStar(_rpSel);
  }

  function _rpMostrarYaVotado(nr, com){
    _rpSel=nr||0; _rpVotadoCom=com||'';
    _rpSetSub('Tu calificación guardada');
    var est='⭐'.repeat(nr)+'☆'.repeat(5-nr);
    _rpSetBody(
      '<div style="background:linear-gradient(135deg,#FFF8E1,#FFF3E0);border-radius:16px;padding:20px 18px;border:1px solid #FFE082;text-align:center;margin-bottom:14px;">'
      +'<div style="font-size:10px;font-weight:800;color:#F57F17;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">✅ Tu opinión está registrada</div>'
      +'<div style="font-size:32px;margin-bottom:6px;">'+est+'</div>'
      +'<div style="font-size:13px;font-weight:800;color:#E65100;margin-bottom:'+(com?'10':'0')+'px;">'+nr+' '+(nr===1?'estrella':'estrellas')+'</div>'
      +(com?'<div style="font-size:12px;color:#6D4C41;font-style:italic;line-height:1.5;background:rgba(255,255,255,.65);border-radius:10px;padding:8px 12px;margin-top:8px;">&ldquo;'+com.replace(/</g,'&lt;')+'&rdquo;</div>':'')
      +'</div>'
      +'<button onclick="window._rpIniciarEdicion&&window._rpIniciarEdicion()" style="width:100%;background:none;border:1.5px solid #E53935;border-radius:12px;padding:11px;font-size:13px;font-weight:700;color:#C62828;cursor:pointer;font-family:inherit;">✏️ Editar calificación</button>'
    );
  }

  window._rpIniciarEdicion=function(){
    _rpMostrarFormulario(_rpSel, _rpVotadoCom, true);
  };

  async function _rpCargarDatos(pUid){
    try{
      var snap=await _fbGet4('calificaciones',pUid,'resumen','datos');
      var avg=document.getElementById('dc-rp-avg'), totalCnt=0;
      if(snap.exists()&&snap.data().promedio){
        var d=snap.data(); totalCnt=d.total||0;
        if(avg){avg.textContent='⭐ '+d.promedio+' promedio · '+totalCnt+' opiniones';avg.style.display='block';}
      } else {
        if(avg){avg.textContent='Sé el primero en calificar';avg.style.display='block';}
      }
      var auth=window._fbAuth, myUid=auth&&auth.currentUser&&auth.currentUser.uid;
      var yaVotado=false, vdSaved=null;
      if(myUid){
        var mv=await _fbGet4('calificaciones',pUid,'votos',myUid);
        if(mv.exists()){yaVotado=true; vdSaved=mv.data();}
      }
      if(yaVotado) _rpMostrarYaVotado(vdSaved.rating||0, vdSaved.comentario||'');
      else _rpMostrarFormulario(0,'',false);
      _rpCargarComentariosInterno(pUid, myUid||'');
    }catch(e){ _rpMostrarFormulario(0,'',false); }
  }

  function _rpRenderComentariosInterno(allVotos, myUid){
    var items=allVotos.filter(function(v){return v._id!==myUid&&(v.comentario||'').trim();});
    var wrap=document.getElementById('dc-rp-com-wrap'), ob=document.getElementById('dc-rp-comentarios'), tog=document.getElementById('dc-rp-com-toggle');
    if(!wrap||!ob)return;
    if(!items.length){wrap.style.display='none';return;}
    wrap.style.display='block';
    if(tog)tog.textContent='💬 Ver comentarios ('+items.length+') ▾';
    var html='';
    items.forEach(function(v){
      var nr=v.rating||0, fecha=v.fecha?new Date(v.fecha).toLocaleDateString('es-MX'):'';
      html+='<div style="background:#f9f9f9;border-radius:12px;padding:11px 12px;margin-bottom:8px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        +'<span style="font-size:14px;">'+'⭐'.repeat(nr)+'☆'.repeat(5-nr)+'</span>'
        +'<span style="font-size:10px;color:#bbb;">'+fecha+'</span></div>'
        +'<div style="font-size:12px;color:#444;line-height:1.5;font-style:italic;">&ldquo;'+v.comentario.replace(/</g,'&lt;')+'&rdquo;</div>'
        +'</div>';
    });
    ob.innerHTML=html;
  }

  async function _rpCargarComentariosInterno(pUid, myUid){
    try{
      var cached=_rpCacheGet(pUid);
      if(cached){ _rpRenderComentariosInterno(cached,myUid); }
      var snap=await _fbColSub3('calificaciones',pUid,'votos');
      var votos=[];
      snap.forEach(function(d){var v=d.data(); v._id=d.id; votos.push(v);});
      _rpCacheSet(pUid,votos);
      _rpRenderComentariosInterno(votos,myUid);
    }catch(e){}
  }

  window._rpToggleComentarios=function(){
    _rpComOpen=!_rpComOpen;
    var ob=document.getElementById('dc-rp-comentarios'), tog=document.getElementById('dc-rp-com-toggle');
    if(ob)ob.style.display=_rpComOpen?'block':'none';
    if(tog)tog.textContent=tog.textContent.replace(_rpComOpen?'▾':'▴',_rpComOpen?'▴':'▾');
  };

  window.dcRatingPopupEnviar=async function(){
    if(!_rpSel){alert('Selecciona una calificación');return;}
    var auth=window._fbAuth, myUid=auth&&auth.currentUser&&auth.currentUser.uid;
    if(!myUid){alert('Inicia sesión');return;}
    var ta=document.getElementById('dc-rp-ta'), com=ta?ta.value.trim():'';
    var btn=document.querySelector('#dc-rp-body button:last-child');
    if(btn){btn.disabled=true;btn.textContent='⏳ Guardando...';}
    try{
      var miNombre=localStorage.getItem('dcuser')||'Vecino';
      await _fbSet4('calificaciones',_rpUid,'votos',myUid,{rating:_rpSel,comentario:com,fecha:new Date().toISOString(),nombre:miNombre});
      var snap=await _fbColSub3('calificaciones',_rpUid,'votos');
      var tot=0,cnt=0; snap.forEach(function(d){tot+=(d.data().rating||0);cnt++;});
      var prom=cnt?Math.round((tot/cnt)*10)/10:0;
      await _fbSet4('calificaciones',_rpUid,'resumen','datos',{promedio:prom,total:cnt});
      try{await _fbUpd2('usuarios',_rpUid,{ratingPromedio:prom,ratingTotal:cnt});}catch(e){}
      _rpCacheDel(_rpUid);
      _rpMarcarBotonesCalificado(_rpUid);
      var avg=document.getElementById('dc-rp-avg');
      if(avg){avg.textContent='⭐ '+prom+' promedio · '+cnt+' opiniones';avg.style.display='block';}
      _rpSetSub('¡Calificación enviada!');
      _rpSetBody('<div style="text-align:center;padding:20px 0;">'
        +'<div style="font-size:40px;margin-bottom:8px;">✅</div>'
        +'<div style="font-size:14px;font-weight:800;color:#111;margin-bottom:8px;">¡Gracias por calificar!</div>'
        +'<div style="font-size:24px;">'+('⭐'.repeat(_rpSel)+'☆'.repeat(5-_rpSel))+'</div>'
        +(com?'<div style="font-size:12px;color:#666;font-style:italic;margin-top:8px;">&ldquo;'+com.replace(/</g,'&lt;')+'&rdquo;</div>':'')
        +'</div>');
      setTimeout(function(){window.dcRatingCerrarPopup&&window.dcRatingCerrarPopup();},1800);
    }catch(e){
      if(btn){btn.disabled=false;btn.textContent='Guardar calificación →';}
      alert('Error: '+e.message);
    }
  };

  function _rpRenderComBody(votos, bd, tipo){
    var etiqueta={restaurante:'restaurante',proveedor:'proveedor',negocio:'negocio'}[tipo]||'negocio';
    var resumenHtml='';
    if(votos.length){
      var tot=0; votos.forEach(function(v){tot+=(v.rating||0);});
      var prom=Math.round((tot/votos.length)*10)/10;
      var comCnt=votos.filter(function(v){return (v.comentario||'').trim();}).length;
      resumenHtml='<div style="background:linear-gradient(135deg,#FFFBEB,#FFF3E0);border-radius:14px;padding:14px 16px;margin-bottom:16px;border:1px solid #FFE082;">'
        +'<div style="font-size:12px;color:#9a6000;line-height:1.6;">'
        +'Este '+etiqueta+' tiene <strong style="color:#E65100;">⭐ '+prom+'</strong> en promedio'
        +' y <strong style="color:#1a6fbf;">'+comCnt+' comentario'+(comCnt!==1?'s':'')+'</strong> de vecinos.'
        +'</div></div>';
    }
    if(!votos.length){bd.innerHTML=resumenHtml+'<div style="text-align:center;padding:24px 0;color:#aaa;font-size:13px;">Aún no hay opiniones</div>';return;}
    var sorted=votos.slice().sort(function(a,b){return (b.fecha||'')>(a.fecha||'')?1:-1;});
    var html=resumenHtml;
    sorted.forEach(function(v){
      var nr=v.rating||0, com=(v.comentario||'').trim(), fecha=v.fecha?new Date(v.fecha).toLocaleDateString('es-MX'):'';
      html+='<div style="background:#f9f9f9;border-radius:14px;padding:13px 14px;margin-bottom:10px;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
        +'<span style="font-size:16px;">'+'⭐'.repeat(nr)+'<span style="opacity:.2;">☆</span>'.repeat(5-nr)+'</span>'
        +'<span style="font-size:10px;color:#bbb;">'+fecha+'</span></div>'
        +(com?'<div style="font-size:13px;color:#444;line-height:1.5;font-style:italic;">&ldquo;'+com.replace(/</g,'&lt;')+'&rdquo;</div>':'<div style="font-size:11px;color:#ccc;">Sin comentario</div>')
        +'</div>';
    });
    bd.innerHTML=html;
  }

  window.dcRatingVerComentarios=async function(bizId,tipo,e){
    if(e)e.stopPropagation(); else if(tipo&&tipo.stopPropagation){e=tipo;tipo='negocio';e.stopPropagation();}
    var ov=document.getElementById('dc-com-overlay'), sh=document.getElementById('dc-com-sheet'), bd=document.getElementById('dc-com-body');
    if(!ov||!sh||!bd)return;
    var cached=_rpCacheGet(bizId);
    if(cached){ _rpRenderComBody(cached,bd,tipo); }
    else { bd.innerHTML='<div style="text-align:center;padding:24px 0;color:#ccc;">⏳ Cargando...</div>'; }
    ov.style.display='flex';
    requestAnimationFrame(function(){sh.style.transform='translateY(0)';sh.scrollTop=0;});
    try{
      var snap=await _fbColSub3('calificaciones',bizId,'votos');
      var votos=[];
      snap.forEach(function(d){var v=d.data(); v._id=d.id; votos.push(v);});
      _rpCacheSet(bizId,votos);
      _rpRenderComBody(votos,bd,tipo);
    }catch(err){ if(!cached)bd.innerHTML='<div style="text-align:center;padding:24px 0;color:#aaa;font-size:13px;">No se pudieron cargar</div>'; }
  };

  window.dcComCerrar=function(){
    var sh=document.getElementById('dc-com-sheet'), ov=document.getElementById('dc-com-overlay');
    if(!sh||!ov)return;
    sh.style.transform='translateY(100%)';
    ov.style.pointerEvents='none';
    setTimeout(function(){ov.style.display='none';ov.style.pointerEvents='';},320);
  };

})();

// ══════════════════════════════════════════════
// CARRUSEL DE ANUNCIOS — AUTO + SWIPE
// ══════════════════════════════════════════════
(function() {
  var track  = document.getElementById('home-ads-track');
  var dots   = document.getElementById('home-ads-dots');
  if (!track || !dots) return;
  var total  = track.children.length;
  var cur    = 0;
  var timer  = null;
  var startX = 0;
  var dragging = false;

  function show(n) {
    cur = (n + total) % total;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    track.style.transition = 'transform .38s cubic-bezier(.4,0,.2,1)';
    var ds = dots.children;
    for (var i = 0; i < ds.length; i++) {
      ds[i].style.background = i === cur ? '#1f7a38' : '#d0d0d0';
      ds[i].style.width  = i === cur ? '16px' : '6px';
      ds[i].style.borderRadius = '4px';
    }
  }

  function next() { show(cur + 1); }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(next, 6000);
  }

  track.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    dragging = true;
    clearInterval(timer);
  }, {passive:true});

  track.addEventListener('touchend', function(e) {
    if (!dragging) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 30) show(dx < 0 ? cur + 1 : cur - 1);
    dragging = false;
    startAuto();
  }, {passive:true});

  track.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    dragging = true;
    clearInterval(timer);
    track.style.cursor = 'grabbing';
  });
  document.addEventListener('mouseup', function(e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 30) show(dx < 0 ? cur + 1 : cur - 1);
    dragging = false;
    track.style.cursor = 'grab';
    startAuto();
  });

  track.style.transform = 'translateX(0)';
  show(0);
  startAuto();
})();


// ══════════════════════════════════════════════
// M2-E: LÓGICA DE VISTAS DE PROMO
// ══════════════════════════════════════════════
(function() {
  var _tipo = '', _dur = '';

  var TIPO_CFG = {
    destacado: { ic:'⭐', bg:'linear-gradient(120deg,#1a3a2a,#2d6e3a)', col:'#2a7a40' },
    promocion:  { ic:'🏷️', bg:'linear-gradient(120deg,#2a1a3a,#5a2a80)', col:'#5a2a80' },
    oferta:     { ic:'🔥', bg:'linear-gradient(120deg,#3a1a1a,#8a2020)', col:'#8a2020' },
    impulso:    { ic:'🚀', bg:'linear-gradient(120deg,#1a2a3a,#1a5a8a)', col:'#1a5a8a' },
  };

  window._promoSelTipo = function(el, tipo) {
    _tipo = tipo;
    Array.from(document.querySelectorAll('#promo-tipo-grid > div')).forEach(function(d) {
      d.style.border = '1.5px solid transparent';
      d.style.background = '#f8f8f8';
    });
    var cfg = TIPO_CFG[tipo] || TIPO_CFG.promocion;
    el.style.border = '1.5px solid ' + cfg.col;
    el.style.background = cfg.col + '18';
  };

  window._promoSelDur = function(el, dur) {
    _dur = dur;
    Array.from(document.querySelectorAll('#promo-dur-grid > div')).forEach(function(d) {
      d.style.border = '1.5px solid transparent';
      d.style.background = '#f8f8f8';
    });
    el.style.border = '1.5px solid #5a2a80';
    el.style.background = '#f0eafc';
  };

  window._promoIrPreview = function() {
    var titulo = (document.getElementById('promo-titulo') || {}).value || '';
    var err = document.getElementById('promo-crear-err');
    if (!_tipo) { if(err){err.textContent='Selecciona un tipo de promoción.';err.style.display='block';} return; }
    if (!titulo.trim()) { if(err){err.textContent='Escribe un título para tu promoción.';err.style.display='block';} return; }
    if (!_dur) { if(err){err.textContent='Selecciona la duración.';err.style.display='block';} return; }
    if(err) err.style.display='none';

    var sub = (document.getElementById('promo-subtitulo') || {}).value || '';
    var draft = { tipo:_tipo, titulo:titulo.trim(), subtitulo:sub.trim(), duracion:_dur };
    window.crearPromoDraft && window.crearPromoDraft(draft);

    var cfg = TIPO_CFG[_tipo] || TIPO_CFG.promocion;
    var slide = document.getElementById('promo-preview-slide');
    if (slide) slide.style.background = cfg.bg;
    var ic = document.getElementById('promo-prev-ic');
    if (ic) ic.textContent = cfg.ic;
    var t = document.getElementById('promo-prev-titulo');
    if (t) t.textContent = titulo;
    var s = document.getElementById('promo-prev-sub');
    if (s) s.textContent = sub;

    var DUR_LBL = {'24h':'1 día','3d':'3 días','7d':'7 días'};
    var info = document.getElementById('promo-preview-info');
    if (info) info.innerHTML = '<div style="font-size:12px;color:#555;line-height:1.8;">'
      + '<b>Tipo:</b> ' + _tipo.charAt(0).toUpperCase()+_tipo.slice(1) + '<br>'
      + '<b>Duración:</b> ' + (DUR_LBL[_dur]||_dur) + '<br>'
      + '<b>Aparece en:</b> Carrusel del Home<br>'
      + '<b>Marcado como:</b> Patrocinado (discreto)</div>';

    go('v-promo-preview', 'right');
  };

  window._promoIrCarrito = function() {
    var ok = window.activarPromo && window.activarPromo();
    if (!ok) return;
    var all = [];
    try { all = JSON.parse(localStorage.getItem('dcPromoActivas') || '[]'); } catch(e) {}
    var p = all[0];
    if (!p) { go('v-promo-activa','right'); return; }

    var DUR_LBL = {'24h':'1 día','3d':'3 días','7d':'7 días'};
    var det = document.getElementById('promo-activa-detail');
    if (det) det.innerHTML = '<div style="font-size:12px;color:#444;line-height:1.8;">'
      + '<b>Título:</b> ' + p.titulo + (p.subtitulo ? '<br><b>Subtítulo:</b> ' + p.subtitulo : '') + '<br>'
      + '<b>Tipo:</b> ' + p.tipo.charAt(0).toUpperCase()+p.tipo.slice(1) + '<br>'
      + '<b>Duración:</b> ' + (DUR_LBL[p.duracion]||p.duracion) + '<br>'
      + '<b>Estado:</b> <span style="color:#d97706;font-weight:700;">Pendiente de pago</span><br>'
      + '<b>Se activa al:</b> confirmar pago</div>';

    go('v-promo-activa', 'right');
  };
})();


// ══════════════════════════════════════════════
// M2-G: LÓGICA DE V-BUSQUEDA
// ══════════════════════════════════════════════
(function() {
  window._renderBusqueda = function() {
    var inp  = document.getElementById('busqueda-input');
    var clr  = document.getElementById('busqueda-clear');
    var res  = document.getElementById('busqueda-resultados');
    var rec  = document.getElementById('busqueda-recientes');
    var emp  = document.getElementById('busqueda-vacio');
    var disc = document.getElementById('busqueda-discover');
    if (!inp || !res) return;

    var q = (inp.value || '').trim();
    if (clr)  clr.style.display  = q ? 'block' : 'none';
    if (disc) disc.style.display = q ? 'none'  : 'block';

    if (!q) {
      res.style.display = 'none';
      emp.style.display = 'none';
      var recent = window.getSearchRecent ? window.getSearchRecent() : [];
      if (recent.length && rec) {
        rec.style.display = 'block';
        var rl = rec.querySelector('.rec-list');
        if (rl) rl.innerHTML = recent.map(function(s) {
          var safe = s.replace(/['"<>]/g,'');
          return '<div onclick="var i=document.getElementById(\'busqueda-input\');if(i){i.value=\''+safe+'\';window._renderBusqueda();}" '
            + 'style="padding:9px 0;border-bottom:.5px solid #f0f0f0;display:flex;align-items:center;gap:10px;cursor:pointer;">'
            + '<span style="color:#bbb;font-size:14px;">🕐</span>'
            + '<span style="font-size:13px;color:#444;">'+safe+'</span>'
            + '</div>';
        }).join('');
      } else if (rec) { rec.style.display = 'none'; }
      return;
    }

    if (window.addSearchRecent) window.addSearchRecent(q);
    if (rec) rec.style.display = 'none';
    res.style.display = 'block';
    res.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">Buscando…</div>';
    emp.style.display = 'none';

    var ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};

    Promise.resolve(window.buscarItems ? window.buscarItems(q) : []).then(function(items) {
      var current = (document.getElementById('busqueda-input') || {}).value || '';
      if (current.trim() !== q) return;
      if (!items || !items.length) {
        res.style.display = 'none';
        emp.style.display = 'block';
        return;
      }
      window._searchResults = items;
      res.innerHTML = '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;">'
        + items.length + ' resultado' + (items.length !== 1 ? 's' : '') + '</div>'
        + items.map(function(p, idx) {
            var cat = (p.categoria||'otro').toLowerCase();
            var ic  = ICONOS[cat] || '🔧';
            return '<div onclick="var p=window._searchResults&&window._searchResults['+idx+'];if(p&&window.abrirDetalleProveedor)window.abrirDetalleProveedor(p);" '
              + 'style="background:#fff;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;margin-bottom:8px;border:.5px solid #e8e8e8;cursor:pointer;">'
              + '<div style="width:40px;height:40px;border-radius:11px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">'+ic+'</div>'
              + '<div style="flex:1;min-width:0;">'
              +   '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px;">'+(p.nombre||'—')+'</div>'
              +   '<div style="font-size:11px;color:#888;">'+(p.descripcion||p.categoria||'Proveedor')+'</div>'
              + '</div>'
              + '<div style="font-size:11px;color:#bbb;flex-shrink:0;">Servicios ›</div>'
              + '</div>';
          }).join('');
    }).catch(function() {
      res.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:12px;">Error al buscar. Intenta de nuevo.</div>';
    });
  };

  window._initBusqueda = function() {
    var inp = document.getElementById('busqueda-input');
    var clr = document.getElementById('busqueda-clear');
    var disc = document.getElementById('busqueda-discover');
    if (inp) inp.value = '';
    if (clr) clr.style.display = 'none';
    if (disc) disc.style.display = 'block';
    window._renderBusqueda && window._renderBusqueda();
    window.renderDescubrimiento && window.renderDescubrimiento('busqueda-discover-list');
  };
})();


// ══════════════════════════════════════════════
// M2-J: LÓGICA DE V-RESERVAR
// ══════════════════════════════════════════════
(function() {
  var _diaSel  = null;
  var _horaSel = null;

  function _slots(inicio, fin) {
    var out = [];
    var toMin = function(t) { var p=t.split(':'); return parseInt(p[0])*60+parseInt(p[1]); };
    var toStr = function(m) { return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
    var s = toMin(inicio), e = toMin(fin);
    for (var m = s; m <= e; m += 60) out.push(toStr(m));
    return out;
  }

  window._renderReservar = function() {
    var scroll = document.getElementById('reservar-scroll');
    var sub    = document.getElementById('reservar-subtitle');
    if (!scroll) return;
    _diaSel = null; _horaSel = null;

    var p  = window._proveedorActual;
    var ag = window._agendaProveedorActual;

    if (!p || !ag) {
      scroll.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:10px;">📅</div><div style="font-size:13px;color:#888;">No hay disponibilidad cargada.</div></div>';
      return;
    }
    if (sub) sub.textContent = p.nombre || 'Proveedor';

    var DIAS_LBL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    var DIAS_COR = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    var html = '';

    html += '<div style="background:#fff;border-radius:14px;padding:13px 14px;border:.5px solid #e8e8e8;margin-bottom:16px;display:flex;align-items:center;gap:12px;">'
      + '<div style="width:40px;height:40px;border-radius:11px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🔧</div>'
      + '<div><div style="font-size:13px;font-weight:700;color:#111;">' + (p.nombre||'—') + '</div>'
      + '<div style="font-size:11px;color:#888;">' + (p.categoria||'Proveedor') + '</div></div>'
      + '</div>';

    if (!ag.horarios || !ag.horarios.length || ag.estado === 'pausado') {
      html += '<div style="background:#F5F6F0;border-radius:14px;padding:20px;text-align:center;">'
        + '<div style="font-size:28px;margin-bottom:8px;">📅</div>'
        + '<div style="font-size:13px;font-weight:700;color:#444;margin-bottom:4px;">No hay horarios disponibles</div>'
        + '<div style="font-size:11px;color:#888;">' + (ag.estado==='pausado' ? 'El proveedor está temporalmente no disponible.' : 'Este proveedor aún no configuró su agenda.') + '</div>'
        + '</div>';
      scroll.innerHTML = html; return;
    }

    html += '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">1. Elige un día</div>'
      + '<div id="res-dias-grid" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px;">';
    if (ag.dias && ag.dias.length) {
      ag.dias.forEach(function(i) {
        html += '<button onclick="window._resDiaSelect(' + i + ',this)"'
          + ' style="padding:7px 13px;border-radius:20px;border:1.5px solid #e0e0e0;background:#fff;font-size:12px;font-weight:600;color:#555;cursor:pointer;font-family:\'Inter\',sans-serif;">'
          + DIAS_COR[i] + '</button>';
      });
    } else {
      DIAS_COR.forEach(function(d, i) {
        html += '<button onclick="window._resDiaSelect(' + i + ',this)"'
          + ' style="padding:7px 13px;border-radius:20px;border:1.5px solid #e0e0e0;background:#fff;font-size:12px;font-weight:600;color:#555;cursor:pointer;font-family:\'Inter\',sans-serif;">'
          + d + '</button>';
      });
    }
    html += '</div>';

    html += '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">2. Elige una hora</div>'
      + '<div id="res-horas-empty" style="background:#f8f8f8;border-radius:12px;padding:12px;text-align:center;font-size:12px;color:#bbb;margin-bottom:16px;">Primero elige un día</div>'
      + '<div id="res-horas-grid" style="display:none;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>';

    html += '<div id="res-confirm-wrap" style="display:none;">'
      + '<div style="background:#fff;border-radius:14px;border:.5px solid #e8e8e8;padding:13px 14px;margin-bottom:12px;">'
      + '<label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:6px;">Nota para el proveedor (opcional)</label>'
      + '<input id="reservar-nota" type="text" maxlength="60" placeholder="Ej. Fuga en cocina, piso 2"'
      + ' style="width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:10px;padding:9px 10px;font-size:13px;font-family:\'Inter\',sans-serif;color:#111;outline:none;-webkit-appearance:none;">'
      + '</div>'
      + '<div id="reservar-err" style="display:none;font-size:11px;color:#D63A2A;margin-bottom:8px;text-align:center;"></div>'
      + '<button id="reservar-confirm-btn" onclick="window._confirmarReserva()" style="width:100%;background:#1FC26A;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;">Confirmar reserva →</button>'
      + '</div>';

    html += '<div style="height:14px;"></div>';
    scroll.innerHTML = html;
  };

  window._resDiaSelect = function(idx, el) {
    _diaSel  = idx;
    _horaSel = null;
    document.querySelectorAll('#res-dias-grid > button').forEach(function(b) {
      b.style.border = '1.5px solid #e0e0e0'; b.style.background = '#fff'; b.style.color = '#555';
    });
    el.style.border = '1.5px solid #1FC26A'; el.style.background = '#e8f5e1'; el.style.color = '#1FC26A';

    var ag = window._agendaProveedorActual;
    var grid = document.getElementById('res-horas-grid');
    var empty = document.getElementById('res-horas-empty');
    var confirmWrap = document.getElementById('res-confirm-wrap');
    if (!grid || !ag) return;

    var slots = [];
    ag.horarios.forEach(function(h) {
      _slots(h.inicio, h.fin).forEach(function(s) {
        if (slots.indexOf(s) === -1) slots.push(s);
      });
    });
    slots.sort();

    empty.style.display = 'none';
    grid.style.display = 'flex';
    if (confirmWrap) confirmWrap.style.display = 'none';

    grid.innerHTML = slots.map(function(s) {
      return '<button onclick="window._resHoraSelect(\'' + s + '\',this)"'
        + ' style="padding:8px 14px;border-radius:20px;border:1.5px solid #e0e0e0;background:#fff;font-size:13px;font-weight:600;color:#333;cursor:pointer;font-family:\'Inter\',sans-serif;">'
        + s + '</button>';
    }).join('');
  };

  window._resHoraSelect = function(hora, el) {
    _horaSel = hora;
    document.querySelectorAll('#res-horas-grid > button').forEach(function(b) {
      b.style.border = '1.5px solid #e0e0e0'; b.style.background = '#fff'; b.style.color = '#333';
    });
    el.style.border = '1.5px solid #1FC26A'; el.style.background = '#e8f5e1'; el.style.color = '#1FC26A';
    var w = document.getElementById('res-confirm-wrap');
    if (w) w.style.display = 'block';
  };

  window._confirmarReserva = async function() {
    var err  = document.getElementById('reservar-err');
    var confirmBtn = document.getElementById('reservar-confirm-btn');
    var p    = window._proveedorActual;
    var ag   = window._agendaProveedorActual;
    var DIAS_LBL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

    if (_diaSel === null) {
      if (err) { err.textContent = 'Elige un día.'; err.style.display = 'block'; } return;
    }
    if (!_horaSel) {
      if (err) { err.textContent = 'Elige una hora.'; err.style.display = 'block'; } return;
    }
    if (!p || !ag || ag.estado === 'pausado') {
      if (err) { err.textContent = 'El proveedor no está disponible.'; err.style.display = 'block'; } return;
    }
    if (err) err.style.display = 'none';
    if (confirmBtn) confirmBtn.textContent = 'Guardando…';

    var nota    = (document.getElementById('reservar-nota') || {}).value || '';
    var nombre  = localStorage.getItem('dcuser') || 'Vecino';
    var diaLbl  = DIAS_LBL[_diaSel] || String(_diaSel);
    var provUid = p._id || p.uid || p.id || p.nombre || '';

    var reserva = {
      proveedorUid:    provUid,
      proveedorNombre: p.nombre || '—',
      vecinoNombre:    nombre,
      dia:             diaLbl,
      hora:            _horaSel,
      nota:            nota.trim()
    };

    var result = await (window.guardarReserva && window.guardarReserva(reserva));

    if (confirmBtn) confirmBtn.textContent = 'Confirmar reserva →';

    if (!result || !result.ok) {
      if (err) { err.textContent = (result && result.msg) || 'No se pudo guardar la reserva.'; err.style.display = 'block'; }
      return;
    }

    var reservaId = result.id || '';
    var scroll = document.getElementById('reservar-scroll');
    if (scroll) {
      scroll.innerHTML = '<div style="text-align:center;padding:40px 20px;">'
        + '<div style="font-size:48px;margin-bottom:14px;">✅</div>'
        + '<div style="font-size:18px;font-weight:700;color:#111;margin-bottom:6px;">¡Reserva enviada!</div>'
        + '<div style="font-size:13px;color:#555;line-height:1.6;margin-bottom:16px;">'
        + '<b>' + (p.nombre||'El proveedor') + '</b> recibirá tu solicitud:<br>'
        + '<b>' + diaLbl + ' a las ' + _horaSel + '</b>'
        + (nota ? '<br><span style="color:#888;">Nota: ' + nota + '</span>' : '')
        + '</div>'
        + '<div id="reserva-estado-live" style="margin-bottom:20px;padding:10px 16px;border-radius:12px;background:#FFF8DC;font-size:12px;font-weight:700;color:#d97706;">⏳ Pendiente de confirmación</div>'
        + '<button onclick="go(\'v-home\',\'left\')" style="width:100%;background:#1FC26A;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:10px;">Ir al inicio</button>'
        + '<button onclick="go(\'v-serv-det\',\'left\')" style="width:100%;background:#f0f0f0;border:none;border-radius:14px;padding:12px;font-size:13px;font-weight:600;color:#555;cursor:pointer;font-family:\'Inter\',sans-serif;">Volver al proveedor</button>'
        + '</div>';
      if (reservaId && window._fbDb) {
        import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(_fb) {
          var unsub = _fb.onSnapshot(_fb.doc(window._fbDb, 'reservas', reservaId), function(snap) {
            var liveEl = document.getElementById('reserva-estado-live');
            if (!liveEl) { unsub(); return; }
            if (!snap.exists()) return;
            var est = snap.data().estado;
            if (est === 'aceptada') {
              liveEl.style.background = '#e8f5e1'; liveEl.style.color = '#1FC26A';
              liveEl.textContent = '✅ ¡Tu reserva fue aceptada!';
            } else if (est === 'rechazada') {
              liveEl.style.background = '#FDECEA'; liveEl.style.color = '#D63A2A';
              liveEl.textContent = '✕ Tu reserva fue rechazada.';
            }
          });
        });
      }
    }
    _diaSel = null; _horaSel = null;
  };
})();


// ══════════════════════════════════════════════
// M2-J: LÓGICA DE V-AGENDA
// ══════════════════════════════════════════════
(function() {
  var DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  window._renderAgenda = function() {
    var scroll = document.getElementById('agenda-scroll');
    var sub    = document.getElementById('agenda-subtitle');
    if (!scroll) return;

    var ag = window.getAgenda ? window.getAgenda() : { dias:[], horarios:[], estado:'activo', reservas:[] };
    var pausado = ag.estado === 'pausado';
    if (sub) sub.textContent = pausado ? 'Disponibilidad pausada' : 'Tu disponibilidad';

    var html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px;">'
      + '<div>'
      + '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px;">Disponibilidad</div>'
      + '<div style="font-size:11px;color:' + (pausado ? '#D63A2A' : '#1FC26A') + ';">' + (pausado ? '⏸ Pausada' : '✅ Activa') + '</div>'
      + '</div>'
      + '<button onclick="window._togglePausaAgenda()" style="background:' + (pausado ? '#e8f5e1' : '#FDECEA') + ';border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;color:' + (pausado ? '#1FC26A' : '#D63A2A') + ';cursor:pointer;font-family:\'Inter\',sans-serif;">'
      + (pausado ? '▶ Reactivar' : '⏸ Pausar') + '</button>'
      + '</div>';

    html += '<div style="padding:0 18px;margin-bottom:12px;">'
      + '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Días disponibles</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;" id="agenda-dias-grid">'
      + DIAS.map(function(d, i) {
          var activo = ag.dias.indexOf(i) !== -1;
          return '<button onclick="window._toggleDia('+i+')" style="padding:6px 12px;border-radius:20px;border:1.5px solid ' + (activo ? '#1FC26A' : '#e0e0e0') + ';background:' + (activo ? '#e8f5e1' : '#fff') + ';font-size:12px;font-weight:' + (activo ? '700' : '500') + ';color:' + (activo ? '#1FC26A' : '#888') + ';cursor:pointer;font-family:\'Inter\',sans-serif;">' + d + '</button>';
        }).join('')
      + '</div>'
      + '</div>';

    html += '<div style="padding:0 18px;margin-bottom:16px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
      + '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;">Horarios</div>'
      + '</div>';

    if (!ag.horarios.length) {
      html += '<div style="background:#F5F6F0;border-radius:12px;padding:16px;text-align:center;">'
        + '<div style="font-size:24px;margin-bottom:6px;">📅</div>'
        + '<div style="font-size:12px;font-weight:700;color:#444;margin-bottom:4px;">Aún no tienes horarios configurados</div>'
        + '<div style="font-size:11px;color:#888;line-height:1.5;">Agrega tus horarios para que los vecinos<br>sepan cuándo estás disponible.</div>'
        + '</div>';
    } else {
      html += '<div style="background:#fff;border-radius:14px;border:.5px solid #e8e8e8;overflow:hidden;">';
      ag.horarios.forEach(function(h, idx) {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:.5px solid #f5f5f5;">'
          + '<div>'
          + '<div style="font-size:13px;font-weight:600;color:#111;">🕐 ' + h.inicio + ' – ' + h.fin + '</div>'
          + (h.nota ? '<div style="font-size:10px;color:#888;margin-top:2px;">' + h.nota + '</div>' : '')
          + '</div>'
          + '<button onclick="window._quitarHorario(' + idx + ')" style="background:none;border:none;font-size:16px;cursor:pointer;color:#ccc;padding:4px;">✕</button>'
          + '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:0 14px 16px;padding:14px 16px;">'
      + '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;">Agregar horario</div>'
      + '<div style="display:flex;gap:10px;margin-bottom:10px;">'
      + '<div style="flex:1;">'
      + '<label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px;">Inicio</label>'
      + '<input id="agenda-inicio" type="time" style="width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:10px;padding:9px 10px;font-size:13px;font-family:\'Inter\',sans-serif;color:#111;outline:none;-webkit-appearance:none;">'
      + '</div>'
      + '<div style="flex:1;">'
      + '<label style="font-size:11px;font-weight:600;color:#666;display:block;margin-bottom:4px;">Fin</label>'
      + '<input id="agenda-fin" type="time" style="width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:10px;padding:9px 10px;font-size:13px;font-family:\'Inter\',sans-serif;color:#111;outline:none;-webkit-appearance:none;">'
      + '</div>'
      + '</div>'
      + '<input id="agenda-nota" type="text" maxlength="40" placeholder="Nota opcional (ej. Solo urgencias)"'
      + ' style="width:100%;box-sizing:border-box;border:1px solid #e0e0e0;border-radius:10px;padding:9px 10px;font-size:13px;font-family:\'Inter\',sans-serif;color:#111;outline:none;margin-bottom:10px;">'
      + '<div id="agenda-err" style="display:none;font-size:11px;color:#D63A2A;margin-bottom:8px;"></div>'
      + '<button onclick="window._agregarHorario()" style="width:100%;background:#1FC26A;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;">+ Agregar horario</button>'
      + '</div>';

    html += '<div style="height:14px;"></div>';
    scroll.innerHTML = html;
  };

  window._togglePausaAgenda = function() {
    var ag = window.getAgenda();
    ag.estado = ag.estado === 'pausado' ? 'activo' : 'pausado';
    window.saveAgenda(ag);
    window._renderAgenda();
  };

  window._toggleDia = function(idx) {
    var ag = window.getAgenda();
    var pos = ag.dias.indexOf(idx);
    if (pos !== -1) ag.dias.splice(pos, 1);
    else ag.dias.push(idx);
    window.saveAgenda(ag);
    window._renderAgenda();
  };

  window._agregarHorario = function() {
    var inicio = (document.getElementById('agenda-inicio') || {}).value || '';
    var fin    = (document.getElementById('agenda-fin')    || {}).value || '';
    var nota   = (document.getElementById('agenda-nota')   || {}).value || '';
    var err    = document.getElementById('agenda-err');
    var msg = (function() {
      if (!inicio || !fin) return 'Completa ambos campos de horario.';
      if (fin <= inicio) return 'La hora de fin debe ser mayor que la de inicio.';
      return null;
    })();
    if (msg) { if (err) { err.textContent = msg; err.style.display = 'block'; } return; }
    if (err) err.style.display = 'none';
    var ag = window.getAgenda();
    var dup = ag.horarios.some(function(h){ return h.inicio === inicio && h.fin === fin; });
    if (dup) { if (err) { err.textContent = 'Ya existe ese horario.'; err.style.display = 'block'; } return; }
    ag.horarios.push({ inicio: inicio, fin: fin, nota: nota.trim() });
    window.saveAgenda(ag);
    window._renderAgenda();
  };

  window._quitarHorario = function(idx) {
    var ag = window.getAgenda();
    ag.horarios.splice(idx, 1);
    window.saveAgenda(ag);
    window._renderAgenda();
  };
})();


// ══════════════════════════════════════════════
// M2-I: LÓGICA DE V-NOTIFICACIONES
// ══════════════════════════════════════════════
(function() {
  var TIPO_IC = {
    solicitud:  { ic:'📋', col:'#d97706', bg:'#FFF8DC' },
    pedido:     { ic:'📦', col:'#D63A2A', bg:'#FDECEA' },
    chat:       { ic:'💬', col:'#1FC26A', bg:'#e8f5e1' },
    sistema:    { ic:'⚙️', col:'#666',    bg:'#f5f5f5' },
    promocion:  { ic:'📣', col:'#7B3FA0', bg:'#F0EBF8' },
  };

  window.renderNotificaciones = async function() {
    var lista   = document.getElementById('vn-lista');
    var sub     = document.getElementById('vn-subtitle');
    if (!lista) return;

    lista.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:12px;">Cargando…</div>';

    var notifs = await (window.cargarNotificaciones ? window.cargarNotificaciones() : Promise.resolve([]));
    notifs = (notifs||[]).filter(function(n){ var m=n.modulo||''; var t=n.tipo||''; return m!=='pedidos' && m!=='chat' && m!=='compra' && t!=='chat' && t!=='pedido' && t!=='compra'; });

    if (!notifs || notifs.length === 0) {
      if (sub) sub.textContent = 'Sin notificaciones';
      lista.innerHTML = '<div style="text-align:center;padding:50px 20px;">'
        + '<div style="font-size:40px;margin-bottom:12px;">🔔</div>'
        + '<div style="font-size:14px;font-weight:700;color:#222;margin-bottom:6px;">Todavía no tienes notificaciones</div>'
        + '<div style="font-size:12px;color:#888;line-height:1.5;">Cuando haya actividad en tu cuenta<br>aparecerá aquí.</div>'
        + '</div>';
      return;
    }

    var noLeidas = notifs.filter(function(n){ return !n.leida; }).length;
    if (sub) sub.textContent = noLeidas > 0
      ? noLeidas + ' sin leer · ' + notifs.length + ' total'
      : notifs.length + ' notificacion' + (notifs.length !== 1 ? 'es' : '');

    lista.innerHTML = '';
    notifs.forEach(function(n) {
      var cfg = TIPO_IC[n.tipo] || TIPO_IC.sistema;
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:13px 16px;border-bottom:.5px solid #f5f5f5;cursor:pointer;'
        + (n.leida ? '' : 'background:#fafcff;');

      var fecha = '';
      try {
        var d = n.fecha && n.fecha.toDate ? n.fecha.toDate() : new Date(n.fecha);
        fecha = d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      } catch(e) {}

      div.innerHTML = '<div style="width:40px;height:40px;border-radius:12px;background:'+cfg.bg+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">'+cfg.ic+'</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
        + '<span style="font-size:13px;font-weight:'+(n.leida?'600':'700')+';color:#111;">'+(n.titulo||n.tipo||'Notificación')+'</span>'
        + (n.leida ? '' : '<span style="width:7px;height:7px;border-radius:50%;background:#D63A2A;flex-shrink:0;display:inline-block;"></span>')
        + '</div>'
        + '<div style="font-size:11px;color:#666;line-height:1.45;margin-bottom:3px;">'+(n.mensaje||'')+'</div>'
        + '<div style="font-size:10px;color:#bbb;">'+fecha+'</div>'
        + '</div>';

      div.onclick = function() {
        if (!n.leida) {
          window.marcarNotifLeida && window.marcarNotifLeida(n._id);
          n.leida = true;
          div.style.background = '';
        }
        var ruta = window._notifRuta && window._notifRuta(n);
        if (ruta) ruta();
      };

      lista.appendChild(div);
    });
  };

  window._marcarTodasLeidasYRecargar = async function() {
    await (window.marcarTodasLeidas ? window.marcarTodasLeidas() : Promise.resolve());
    await window.renderNotificaciones();
    window.actualizarBadgesReales && window.actualizarBadgesReales();
  };
})();


// ══════════════════════════════════════════════
// M2-J: V-AGENDA-RESERVAS (proveedor)
// ══════════════════════════════════════════════
(function() {
  async function _resolverUid() {
    var _auth = window._fbAuth;
    if (_auth && _auth.currentUser) return _auth.currentUser.uid;
    var uid = await new Promise(function(resolve) {
      var done = false;
      var t = setTimeout(function(){ if(!done){done=true;resolve('');} }, 4000);
      if (_auth && _auth.onAuthStateChanged) {
        _auth.onAuthStateChanged(function(u){
          if(!done){done=true;clearTimeout(t);resolve(u?u.uid:'');}
        });
      } else { clearTimeout(t); resolve(''); }
    });
    return uid || localStorage.getItem('dcuserUid') || '';
  }

  var _arTab = 'solicitudes';

  window._initAgendaReservas = function() {
    _arTab = 'solicitudes';
    window._renderAgendaReservas && window._renderAgendaReservas();
  };

  window._arSetTab = function(tab) {
    _arTab = tab;
    window._renderAgendaReservas && window._renderAgendaReservas();
  };

  window._renderAgendaReservas = async function() {
    var scroll = document.getElementById('ar-scroll');
    var sub    = document.getElementById('ar-subtitle');
    if (!scroll) return;

    var provUid = await _resolverUid();
    if (!provUid) {
      if (sub) sub.textContent = 'Sin sesión';
      scroll.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:28px;margin-bottom:10px;">🔒</div><div style="font-size:13px;color:#888;">Sesión no disponible.<br>Vuelve a iniciar sesión.</div></div>';
      return;
    }

    scroll.innerHTML = '<div style="text-align:center;padding:30px;color:#999;font-size:12px;">Cargando…</div>';

    try {
      var _db = window._fbDb;
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      if (!_db) throw new Error('Base de datos no lista. Recarga la app.');
      var q = _fb.query(_fb.collection(_db, 'reservas'), _fb.where('proveedorUid', '==', provUid), _fb.limit(100));
      var snap = await _fb.getDocs(q);

      var docs = [];
      snap.forEach(function(d){ var r = d.data(); r._fbid = d.id; docs.push(r); });
      docs.sort(function(a,b){
        var ta = a.creada && a.creada.toMillis ? a.creada.toMillis() : (typeof a.creada==='number'?a.creada:0);
        var tb = b.creada && b.creada.toMillis ? b.creada.toMillis() : (typeof b.creada==='number'?b.creada:0);
        return tb - ta;
      });

      var pendientes = docs.filter(function(r){ return r.estado === 'pendiente'; });
      var aceptadas  = docs.filter(function(r){ return r.estado === 'aceptada'; });
      var rechazadas = docs.filter(function(r){ return r.estado === 'rechazada'; });

      var total = docs.length;
      if (sub) sub.textContent = total + ' reserva' + (total !== 1 ? 's' : '');

      function _tabBtn(id, lbl, count) {
        var sel = _arTab === id;
        return '<button onclick="window._arSetTab(\''+id+'\')" style="flex:1;padding:10px 4px;border:none;background:'+(sel?'#fff':'transparent')+';border-bottom:2.5px solid '+(sel?'#1FC26A':'transparent')+';font-size:12px;font-weight:'+(sel?'700':'500')+';color:'+(sel?'#1FC26A':'#888')+';cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:5px;">'
          + lbl
          + (count > 0 ? '<span style="background:'+(sel?'#1FC26A':'#ddd')+';color:'+(sel?'#fff':'#666')+';border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;">'+count+'</span>' : '')
          + '</button>';
      }

      var tabsHtml = '<div style="display:flex;background:#F5F6F0;border-bottom:.5px solid #e0e0e0;flex-shrink:0;">'
        + _tabBtn('solicitudes','Solicitudes',pendientes.length)
        + _tabBtn('aceptadas','Aceptadas',aceptadas.length)
        + _tabBtn('rechazadas','Rechazadas',rechazadas.length)
        + '</div>';

      function _item(r, conBotones) {
        var fecha = '';
        try {
          var d = r.creada && r.creada.toDate ? r.creada.toDate() : (r.creada ? new Date(r.creada) : null);
          if (d) fecha = d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
        } catch(e) {}
        var col = r.estado==='aceptada'?'#1FC26A':r.estado==='rechazada'?'#D63A2A':'#d97706';
        var lbl = r.estado==='aceptada'?'Aceptada':r.estado==='rechazada'?'Rechazada':'Pendiente';
        var h = '<div style="padding:14px 16px;border-bottom:.5px solid #f5f5f5;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
          + '<div style="font-size:13px;font-weight:700;color:#111;">'+(r.vecinoNombre||'Vecino')+'</div>'
          + '<span style="font-size:10px;font-weight:700;color:'+col+';background:'+col+'18;padding:2px 8px;border-radius:20px;">'+lbl+'</span>'
          + '</div>'
          + '<div style="font-size:12px;color:#555;margin-bottom:2px;">📅 '+(r.dia||'—')+' &nbsp;🕐 '+(r.hora||'—')+'</div>'
          + (r.nota ? '<div style="font-size:11px;color:#888;margin-bottom:2px;">📝 '+r.nota+'</div>' : '')
          + (fecha ? '<div style="font-size:10px;color:#bbb;margin-bottom:'+(conBotones?'10':'0')+'px;">Solicitada: '+fecha+'</div>' : '');
        if (conBotones) {
          h += '<div style="display:flex;gap:8px;">'
            + '<button onclick="window._arActualizar(\''+r._fbid+'\',\'aceptada\')" style="flex:1;background:#e8f5e1;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:700;color:#1FC26A;cursor:pointer;font-family:\'Inter\',sans-serif;">✓ Aceptar</button>'
            + '<button onclick="window._arActualizar(\''+r._fbid+'\',\'rechazada\')" style="flex:1;background:#fdecea;border:none;border-radius:10px;padding:9px;font-size:12px;font-weight:700;color:#D63A2A;cursor:pointer;font-family:\'Inter\',sans-serif;">✕ Rechazar</button>'
            + '</div>';
        }
        h += '</div>';
        return h;
      }

      function _empty(msg) {
        return '<div style="text-align:center;padding:50px 20px;"><div style="font-size:36px;margin-bottom:10px;">📋</div><div style="font-size:13px;font-weight:700;color:#aaa;">'+msg+'</div></div>';
      }

      var lista = '';
      if (_arTab === 'solicitudes') {
        lista = pendientes.length === 0 ? _empty('Sin solicitudes pendientes') : '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:12px 14px;overflow:hidden;">' + pendientes.map(function(r){ return _item(r, true); }).join('') + '</div>';
      } else if (_arTab === 'aceptadas') {
        lista = aceptadas.length === 0 ? _empty('Sin reservas aceptadas') : '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:12px 14px;overflow:hidden;">' + aceptadas.map(function(r){ return _item(r, false); }).join('') + '</div>';
      } else {
        lista = rechazadas.length === 0 ? _empty('Sin reservas rechazadas') : '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:12px 14px;overflow:hidden;">' + rechazadas.map(function(r){ return _item(r, false); }).join('') + '</div>';
      }

      scroll.innerHTML = tabsHtml + '<div style="overflow-y:auto;flex:1;">' + lista + '<div style="height:14px;"></div></div>';

    } catch(e) {
      if (sub) sub.textContent = 'Error al cargar';
      scroll.innerHTML = '<div style="text-align:center;padding:30px;font-size:12px;color:#D63A2A;">No pudimos cargar las reservas.<br>' + e.message + '</div>';
    }
  };

  window._arActualizar = async function(reservaId, nuevoEstado) {
    var btn = event && event.target;
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      var _db = window._fbDb;
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      await _fb.updateDoc(_fb.doc(_db, 'reservas', reservaId), { estado: nuevoEstado });
      try {
        var rSnap = await _fb.getDoc(_fb.doc(_db, 'reservas', reservaId));
        if (rSnap.exists()) {
          var rData = rSnap.data();
          var vecinoUid = rData.vecinoUid || '';
          if (vecinoUid) {
            var titulo = nuevoEstado === 'aceptada' ? 'Reserva aceptada ✅' : 'Reserva rechazada';
            var mensaje = nuevoEstado === 'aceptada'
              ? 'Tu reserva con ' + (rData.proveedorNombre||'el proveedor') + ' para el ' + (rData.dia||'') + ' a las ' + (rData.hora||'') + ' fue aceptada.'
              : 'Tu reserva con ' + (rData.proveedorNombre||'el proveedor') + ' para el ' + (rData.dia||'') + ' fue rechazada.';
            await _fb.addDoc(_fb.collection(_db, 'notificaciones'), {
              uid: vecinoUid, tipo: 'reserva', modulo: 'mi_agenda',
              titulo: titulo, mensaje: mensaje, leida: false, eliminada: false,
              reservaId: reservaId, fecha: _fb.serverTimestamp(),
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
          }
        }
      } catch(ne) {}
      _arTab = nuevoEstado === 'aceptada' ? 'aceptadas' : 'rechazadas';
      window._renderAgendaReservas && window._renderAgendaReservas();
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = nuevoEstado === 'aceptada' ? '✓ Aceptar' : '✕ Rechazar'; }
      toast('⚠️ No se pudo actualizar: ' + e.message);
    }
  };
})();


// ══════════════════════════════════════════════
// MI AGENDA (VECINO)
// ══════════════════════════════════════════════
(function() {
  var _maTab = 'pendientes';

  window._initMiAgenda = function() {
    _maTab = 'pendientes';
    _renderTabs();
    _renderLista();
    window._renderMiAgenda();
  };

  window._maSetTab = function(tab) {
    _maTab = tab;
    _renderTabs();
    _renderLista();
  };

  function _renderTabs() {
    var tabs = document.getElementById('ma-tabs');
    if (!tabs) return;
    var counts = window._maCounts || {p:0,c:0,r:0};
    function _btn(id, lbl, n) {
      var sel = _maTab === id;
      var badge = n > 0
        ? '<span style="background:' + (sel ? '#1FC26A' : '#ccc') + ';color:' + (sel ? '#fff' : '#666') + ';border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px;">' + n + '</span>'
        : '';
      return '<button onclick="window._maSetTab(\'' + id + '\')" style="flex:1;padding:10px 4px;border:none;border-bottom:2.5px solid ' + (sel ? '#1FC26A' : 'transparent') + ';background:' + (sel ? '#fff' : 'transparent') + ';font-size:12px;font-weight:' + (sel ? '700' : '500') + ';color:' + (sel ? '#1FC26A' : '#888') + ';cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;">' + lbl + badge + '</button>';
    }
    tabs.innerHTML = _btn('pendientes','Pendientes', counts.p) + _btn('confirmadas','Confirmadas', counts.c) + _btn('rechazadas','Rechazadas', counts.r);
  }

  function _renderLista() {
    var lista = document.getElementById('ma-lista');
    if (!lista) return;
    var all = window._maDocs || null;
    if (all === null) {
      lista.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-size:13px;">Cargando&#x2026;</div>';
      return;
    }
    var grupo, emptyMsg;
    if (_maTab === 'pendientes') {
      grupo = all.filter(function(r){ return r.estado === 'pendiente'; });
      emptyMsg = 'Sin reservas pendientes';
    } else if (_maTab === 'confirmadas') {
      grupo = all.filter(function(r){ return r.estado === 'aceptada'; });
      emptyMsg = 'Sin reservas confirmadas';
    } else {
      grupo = all.filter(function(r){ return r.estado === 'rechazada'; });
      emptyMsg = 'Sin reservas rechazadas';
    }
    if (grupo.length === 0) {
      lista.innerHTML = '<div style="text-align:center;padding:50px 20px;"><div style="font-size:36px;margin-bottom:10px;">&#x1F4C5;</div><div style="font-size:13px;font-weight:700;color:#aaa;">' + emptyMsg + '</div></div>';
      return;
    }
    var html = '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:12px 14px;overflow:hidden;">';
    grupo.forEach(function(r) {
      var fecha = '';
      try {
        var d = r.creada && r.creada.toDate ? r.creada.toDate() : (r.creada ? new Date(r.creada) : null);
        if (d && !isNaN(d)) fecha = d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      } catch(e2) {}
      var col = r.estado === 'aceptada' ? '#1FC26A' : r.estado === 'rechazada' ? '#D63A2A' : '#d97706';
      var lbl = r.estado === 'aceptada' ? 'Confirmada' : r.estado === 'rechazada' ? 'Rechazada' : 'Pendiente';
      html += '<div style="padding:14px 16px;border-bottom:.5px solid #f5f5f5;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
        + '<div style="font-size:13px;font-weight:700;color:#111;">' + (r.proveedorNombre || 'Proveedor') + '</div>'
        + '<span style="font-size:10px;font-weight:700;color:' + col + ';background:' + col + '18;padding:2px 8px;border-radius:20px;">' + lbl + '</span>'
        + '</div>'
        + '<div style="font-size:12px;color:#555;margin-bottom:2px;">&#x1F4C5; ' + (r.dia || '&#x2014;') + ' &nbsp;&#x1F550; ' + (r.hora || '&#x2014;') + '</div>'
        + (r.nota ? '<div style="font-size:11px;color:#888;margin-bottom:2px;">&#x1F4DD; ' + r.nota + '</div>' : '')
        + (fecha ? '<div style="font-size:10px;color:#bbb;">Solicitada: ' + fecha + '</div>' : '')
        + '</div>';
    });
    html += '</div><div style="height:14px;"></div>';
    lista.innerHTML = html;
  }

  window._renderMiAgenda = async function() {
    var sub = document.getElementById('ma-subtitle');
    var lista = document.getElementById('ma-lista');
    if (!lista) return;

    window._maDocs = null;
    window._maCounts = {p:0,c:0,r:0};
    _renderTabs();
    _renderLista();

    var user = (window._fbAuth && window._fbAuth.currentUser) || null;
    if (!user) {
      user = await new Promise(function(resolve) {
        var done = false;
        var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, 3000);
        if (window._fbAuth && window._fbAuth.onAuthStateChanged) {
          var unsub = window._fbAuth.onAuthStateChanged(function(u) {
            if (!done) { done = true; clearTimeout(t); unsub(); resolve(u || null); }
          });
        } else { clearTimeout(t); resolve(null); }
      });
    }

    if (!user) {
      if (sub) sub.textContent = 'Sin sesión';
      if (lista) lista.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:28px;margin-bottom:10px;">&#x1F512;</div><div style="font-size:13px;color:#888;">Sesión no disponible.</div></div>';
      return;
    }

    try {
      var _db = window._fbDb;
      if (!_db) throw new Error('Base de datos no lista.');
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var q = _fb.query(_fb.collection(_db, 'reservas'), _fb.where('vecinoUid', '==', user.uid), _fb.limit(100));
      var snap = await _fb.getDocs(q);

      var docs = [];
      snap.forEach(function(d){ var r = d.data(); r._fbid = d.id; docs.push(r); });
      docs.sort(function(a, b) {
        var ta = a.creada && a.creada.toMillis ? a.creada.toMillis() : 0;
        var tb = b.creada && b.creada.toMillis ? b.creada.toMillis() : 0;
        return tb - ta;
      });

      window._maDocs = docs;
      window._maCounts = {
        p: docs.filter(function(r){ return r.estado === 'pendiente'; }).length,
        c: docs.filter(function(r){ return r.estado === 'aceptada'; }).length,
        r: docs.filter(function(r){ return r.estado === 'rechazada'; }).length
      };

      if (sub) sub.textContent = docs.length + ' reserva' + (docs.length !== 1 ? 's' : '');
      _renderTabs();
      _renderLista();

    } catch(e) {
      if (sub) sub.textContent = 'Error';
      if (lista) lista.innerHTML = '<div style="text-align:center;padding:30px;font-size:12px;color:#D63A2A;">No se pudieron cargar tus reservas.<br>' + e.message + '</div>';
    }
  };
})();

// ══════════════════════════════════════════════
// PLAZA ONLINE — UI (helpers y renders)
// Separado de firebase.js: solo presentación.
// firebase.js carga datos y llama estas funciones.
// ══════════════════════════════════════════════
(function() {

window._plazaFiltro     = window._plazaFiltro     || 'todos';
window._plazaDocsCache  = window._plazaDocsCache  || [];

function _plazaCatNorm(v) {
  return String(v || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/&/g,' y ')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'');
}
function _plazaCatKey(v) {
  var n = _plazaCatNorm(v);
  if (!n) return 'otro';
  if (n.indexOf('belleza')!=-1||n.indexOf('estetica')!=-1||n.indexOf('barber')!=-1||n.indexOf('salon')!=-1||n.indexOf('unas')!=-1) return 'belleza';
  if (n.indexOf('tecnolog')!=-1||n.indexOf('comput')!=-1||n.indexOf('celular')!=-1||n.indexOf('electron')!=-1) return 'tecnologia';
  if (n.indexOf('mascota')!=-1||n.indexOf('veterin')!=-1||n.indexOf('pet')!=-1) return 'mascotas';
  if (n.indexOf('hogar')!=-1||n.indexOf('mueble')!=-1||n.indexOf('decor')!=-1||n.indexOf('casa')!=-1) return 'hogar';
  if (n.indexOf('ferreter')!=-1||n.indexOf('herramient')!=-1) return 'ferreteria';
  if (n.indexOf('papeler')!=-1||n.indexOf('escolar')!=-1) return 'papeleria';
  if (n.indexOf('regalo')!=-1||n.indexOf('detalle')!=-1) return 'regalos';
  if (n.indexOf('moda')!=-1||n.indexOf('ropa')!=-1||n.indexOf('boutique')!=-1||n.indexOf('zapato')!=-1) return 'moda';
  if (n.indexOf('salud')!=-1||n.indexOf('farmacia')!=-1||n.indexOf('medic')!=-1) return 'salud';
  if (n.indexOf('abarrote')!=-1||n.indexOf('tienda')!=-1||n.indexOf('miscelanea')!=-1) return 'tienda';
  if (n.indexOf('servicio')!=-1) return 'servicios';
  if (['moda','belleza','salud','mascotas','tecnologia','hogar','ferreteria','papeleria','regalos','servicios','tienda','comercio','plaza','otro'].indexOf(n)!==-1) return n;
  return n;
}
function _plazaCatLabel(cat) {
  var MAP = {moda:'👗 Moda',belleza:'✂️ Belleza',salud:'💊 Salud',mascotas:'🐾 Mascotas',tecnologia:'💻 Tecnología',hogar:'🏠 Hogar',ferreteria:'🛠 Ferretería',papeleria:'📚 Papelería',regalos:'🎁 Regalos',servicios:'🔧 Servicios',tienda:'🏪 Tienda',comercio:'🏪 Comercio',plaza:'🏪 Plaza Online',otro:'🏪 Comercio'};
  var k = _plazaCatKey(cat);
  return MAP[k] || (cat ? '🏪 ' + cat : '🏪 Comercio');
}
function _plazaCatBase(r) {
  return r.categoriaPublica || r.giroPublico || r.conceptoPublico || r.categoriaNegocio || r.giro || r.categoria || r.tipoNegocio || 'otro';
}
function _plazaCoincideFiltro(r, filtro) {
  var f = _plazaCatKey(filtro || 'todos');
  if (!f || f === 'todos') return true;
  var n = _plazaCatKey(_plazaCatBase(r));
  if (n === f) return true;
  var principales = ['moda','belleza','salud','mascotas','tecnologia','hogar','ferreteria','papeleria','regalos','servicios','tienda'];
  return f === 'otro' && principales.indexOf(n) === -1;
}
function dcEsComercioPlaza(r) {
  r = r || {};
  var catNorm = _plazaCatKey(_plazaCatBase(r));
  var foodCats = ['mexicana','hamburguesas','pizzas','pizza','sushi','cafeteria','cafe','postres','tacos','mariscos','pollo','desayunos','bebidas','otro_rest'];
  var plazaCats = ['moda','belleza','salud','mascotas','tecnologia','hogar','ferreteria','papeleria','regalos','servicios','tienda','otro','plaza','comercio'];
  var tipoNorm = _plazaCatNorm(r.tipoNegocio || '');
  var esFood = foodCats.indexOf(catNorm) !== -1 || tipoNorm === 'food' || tipoNorm === 'restaurante';
  var esPlaza = tipoNorm === 'plaza' || plazaCats.indexOf(catNorm) !== -1 || !esFood;
  return esPlaza && !esFood;
}

window._plazaCatNorm        = _plazaCatNorm;
window._plazaCatKey         = _plazaCatKey;
window._plazaCatLabel       = _plazaCatLabel;
window._plazaCatBase        = _plazaCatBase;
window._plazaCoincideFiltro = _plazaCoincideFiltro;
window.dcEsComercioPlaza    = dcEsComercioPlaza;

window._plazaFiltrarSel = function(cat) {
  window._plazaFiltro = cat || 'todos';
  window._plazaRenderLista && window._plazaRenderLista(window._plazaDocsCache);
  var scr = document.getElementById('plaza-scroll'); if (scr) scr.scrollTop = 0;
  if (window._dcDirtyV === 'v-plaza') window._dcDirtyV = null;
};

window._plazaRenderLista = function(docs) {
  var lista = document.getElementById('plaza-lista');
  var demo  = document.getElementById('plaza-demo');
  var sub   = document.getElementById('plaza-sub');
  if (!lista) return;
  docs = docs || [];
  var filtrados = docs.filter(function(r){ return _plazaCoincideFiltro(r, window._plazaFiltro); });
  if (sub) sub.textContent = docs.length > 0 ? docs.length + ' comercio' + (docs.length !== 1 ? 's' : '') + ' de tu zona' : 'Comercios de tu zona';
  if (!filtrados.length) {
    if (demo) demo.style.display = 'none';
    lista.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">🏪</div><div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Sin comercios en esta categoría</div><div style="font-size:11px;color:var(--text-muted);line-height:1.6;">Prueba con otra categoría de Plaza Online.</div></div>';
    return;
  }
  if (demo) demo.style.display = 'none';
  lista.innerHTML = filtrados.map(function(r){
    var estOp = (typeof window._estadoEfectivoDe === 'function')
      ? window._estadoEfectivoDe(r.estadoOp, r.estadoOpTs || 0, r.horarios && r.horarios.length ? r.horarios : null)
      : (r.estadoOp || 'activo');
    var meta = {
      activo:  {lbl:'🟢 Abierto', col:'var(--green-dk)',bg:'var(--green-lt)'},
      ocupado: {lbl:'🟡 Ocupado', col:'#d97706',        bg:'#FFF8E1'},
      pausado: {lbl:'🟠 En pausa',col:'#E87722',         bg:'#FFF0E6'},
      cerrado: {lbl:'🔴 Cerrado', col:'#D63A2A',         bg:'#FDECEA'}
    }[estOp] || {lbl:'🟢 Abierto',col:'var(--green-dk)',bg:'var(--green-lt)'};
    var foto = r.fotoPerfil || r.fotoPublica || r.logo || '';
    var cat  = _plazaCatBase(r) || 'Comercio local';
    return '<div class="plaza-card" onclick="window.plazaAbrirComercio(\''+r._id+'\')" style="overflow:hidden;cursor:pointer;'+(estOp==='cerrado'?'opacity:.65;filter:grayscale(.35);':'')+'">'
      +'<div style="height:118px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:42px;position:relative;overflow:hidden;">'
      +(foto&&String(foto).indexOf('data:image')===0?'<img src="'+foto+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">':'🏪')
      +(estOp==='cerrado'?'<div style="position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><span style="background:#D63A2A;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;">🔴 CERRADO</span></div>':'')
      +'<span style="position:absolute;right:10px;top:10px;background:rgba(255,255,255,.92);color:var(--blue);font-size:10px;font-weight:800;padding:4px 8px;border-radius:10px;">✓ Verificado</span>'
      +'</div>'
      +'<div class="si45">'
      +'<div class="si05"><div class="si17">'+(r.nombrePublico||r.nombreNegocio||r.nombre||'—')+'</div>'
      +'<span class="si44" style="background:'+meta.bg+';color:'+meta.col+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;">'+meta.lbl+'</span></div>'
      +'<div class="si10">'+(r.descripcionPublica||r.descripcion||cat||'Comercio local')+'</div>'
      +'<div class="si46">'+_plazaCatLabel(cat)+(r.ratingPromedio?' · ⭐ '+Number(r.ratingPromedio).toFixed(1)+' <span onclick="event.stopPropagation();window.dcRatingVerComentarios&&window.dcRatingVerComentarios(\''+r._id+'\',\'negocio\',event)" style="color:var(--blue,#1a6fbf);text-decoration:underline;cursor:pointer;font-weight:700;">('+( r.ratingTotal||0)+' op.)</span>':'')+'</div>'
      +'<div class="si47"><button data-rate-id="'+r._id+'" onclick="event.stopPropagation();window.dcRatingAbrirPopup&&window.dcRatingAbrirPopup(\''+r._id+'\',\''+(r.nombrePublico||r.nombreNegocio||r.nombre||'').replace(/'/g,'&#39;')+'\',event)" style="background:#FFF8DC;border:1px solid #F5C518;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:700;color:#9a7020;cursor:pointer;font-family:inherit;white-space:nowrap;">⭐ Calificar</button><button class="si48">Ver productos →</button></div>'
      +'</div></div>';
  }).join('');
  setTimeout(function(){window._rpIniciarBotonesVecino&&window._rpIniciarBotonesVecino();},50);
};

window._plazaSetProdFiltro = function(ev, cat) {
  if (ev && typeof ev === 'object' && ev.preventDefault) { ev.preventDefault(); ev.stopPropagation(); } else { cat = ev; }
  window._plazaProdFiltro = cat || 'todos';
  window._plazaRenderProductos && window._plazaRenderProductos();
  if (window._dcDirtyV === 'v-plaza-det') window._dcDirtyV = null;
  return false;
};

window._plazaRenderProductos = function() {
  var el = document.getElementById('plaza-prod-lista');
  if (!el) return;
  var prods = window._plazaProdDocsCache || [];
  var cats = [];
  prods.forEach(function(p){
    var c = _plazaCatKey(p.categoria || p.categoriaPublica || 'general');
    if (cats.indexOf(c) === -1) cats.push(c);
  });
  var f = window._plazaProdFiltro || 'todos';
  var tabBtn = function(cat, label) {
    var sel = f === cat;
    return '<button type="button" data-no-dirty="1" onclick="return window._plazaSetProdFiltro(event,\''+cat+'\')" style="white-space:nowrap;border:none;border-radius:18px;padding:8px 13px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;background:'+(sel?'var(--blue)':'#E8F0F8')+';color:'+(sel?'#fff':'var(--blue)')+';">'+label+'</button>';
  };
  var tabs = '<div style="display:flex;gap:8px;overflow-x:auto;padding:0 14px 10px;">'+tabBtn('todos','Todos')+cats.map(function(c){return tabBtn(c,_plazaCatLabel(c));}).join('')+'</div>';
  var visibles = prods.filter(function(p){ return f==='todos'||_plazaCatKey(p.categoria||p.categoriaPublica||'general')===f; });
  var html = tabs + visibles.map(function(p){
    var foto = p.foto || p.fotoProducto || p.fotoPublica || '';
    var agotado = p.disponible === false;
    return '<div class="plaza-card" onclick="window.plazaAbrirProductoDetalle(\''+p._id+'\')" style="padding:12px;display:flex;gap:12px;align-items:center;cursor:pointer;'+(agotado?'opacity:.72;filter:grayscale(.18);':'')+'">'
      +'<div style="width:64px;height:64px;border-radius:14px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;flex-shrink:0;">'
      +(foto&&String(foto).indexOf('data:image')===0?'<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">':'📦')+'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:14px;font-weight:800;color:#111;">'+window.dcEscHTML(window.dcShortText(p.nombre||'Producto',80))+'</div>'
      +'<div style="font-size:12px;color:#777;line-height:1.4;margin-top:2px;">'+window.dcEscHTML(window.dcShortText(p.descripcion||p.descripcionPublica||p.categoria||'Producto disponible',110))+'</div>'
      +'<div style="font-size:14px;font-weight:900;color:var(--blue);margin-top:6px;">$'+(Number(p.precio||0)).toFixed(0)+'</div>'
      +'<div style="margin-top:5px;">'+(agotado?'<span style="background:#f0f0f0;color:#777;border-radius:8px;padding:3px 7px;font-size:9px;font-weight:800;">⛔ No disponible</span>':'<span style="background:#E8F0F8;color:var(--blue);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:800;">✅ Disponible</span>')+'</div>'
      +'</div>'
      +'<div style="color:#bbb;font-size:20px;">›</div>'
      +'</div>';
  }).join('');
  if (!visibles.length) html += '<div style="padding:28px 20px;text-align:center;font-size:12px;color:#777;">Sin productos en esta pestaña.</div>';
  el.innerHTML = html + '<div style="height:70px;"></div>';
};

window.plazaCambiarQtyDetalle = function(delta){
  var q = Number(window._plazaDetalleQty||1) + Number(delta||0);
  if (q < 1) q = 1; if (q > 99) q = 99;
  window._plazaDetalleQty = q;
  var el = document.getElementById('plaza-det-qty-num');
  if (el) el.textContent = String(q);
  return false;
};

window.plazaAbrirProductoDetalle = function(pid){
  if(document.body.dataset.dcModalLocked!=='1'){var _sy=window.scrollY||0;document.body.dataset.dcModalLocked='1';document.body.dataset.dcModalScrollY=String(_sy);document.body.style.overflow='hidden';document.body.style.touchAction='none';}
  var p = (window._plazaProdDocsCache||[]).find(function(x){return String(x._id)===String(pid);});
  if (!p) return;
  window._plazaDetalleQty = 1;
  var ov = document.getElementById('plaza-prod-det-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'plaza-prod-det-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.50);z-index:99999;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;overflow:hidden;touch-action:none;';
    ov.innerHTML = '<div id="plaza-prod-det-card" style="width:100%;max-width:390px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 14px 42px rgba(0,0,0,.30);"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)window.plazaCerrarProductoDetalle();});
  }
  var card = document.getElementById('plaza-prod-det-card');
  var foto = p.foto||p.fotoProducto||p.fotoPublica||'';
  var agotado = p.disponible===false;
  var nombre = window.dcEscHTML?window.dcEscHTML(window.dcShortText(p.nombre||'Producto',80)):(p.nombre||'Producto');
  var cat    = window.dcEscHTML?window.dcEscHTML(window.dcShortText(p.categoria||p.categoriaPublica||'Producto',60)):(p.categoria||'Producto');
  var desc   = window.dcEscHTML?window.dcEscHTML(window.dcCleanText(p.descripcion||p.descripcionPublica||'Sin descripción adicional.',500)):(p.descripcion||'Sin descripción adicional.');
  var precio = (Number(p.precio||0)).toFixed(0);
  card.innerHTML =
    '<div style="max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;overscroll-behavior:contain;">'
    +'<div style="height:160px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:40px;position:relative;overflow:hidden;">'
    +(foto&&String(foto).indexOf('data:image')===0?'<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">':'📦')
    +'<button type="button" onclick="window.plazaCerrarProductoDetalle()" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border:none;border-radius:13px;background:rgba(255,255,255,.96);font-size:21px;font-weight:900;color:#13384f;box-shadow:0 2px 8px rgba(0,0,0,.12);">‹</button>'
    +'</div>'
    +'<div style="padding:15px 18px 18px;">'
    +'<div style="font-size:18px;font-weight:900;color:#111;line-height:1.18;margin-bottom:3px;">'+nombre+'</div>'
    +'<div style="font-size:11px;color:#777;margin-bottom:8px;">'+cat+'</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">'
      +'<div style="font-size:24px;font-weight:900;color:var(--blue);">$'+precio+'</div>'
      +(agotado?'<div style="background:#f0f0f0;color:#777;border-radius:13px;padding:6px 10px;font-size:10px;font-weight:900;">⛔ No disponible</div>':'<div style="background:#E8F0F8;color:var(--blue);border-radius:13px;padding:6px 10px;font-size:10px;font-weight:900;">✅ Disponible</div>')
    +'</div>'
    +'<div style="font-size:12px;color:#444;line-height:1.42;margin:4px 0 12px;max-height:60px;overflow-y:auto;padding-right:3px;border-top:.5px solid #eef2f5;padding-top:10px;">'+desc+'</div>'
    +(!agotado?'<div style="display:flex;align-items:center;justify-content:center;gap:18px;margin:4px 0 14px;">'
        +'<button type="button" onclick="return window.plazaCambiarQtyDetalle(-1)" style="width:40px;height:40px;border:none;border-radius:12px;background:var(--yellow);color:#111;font-size:22px;font-weight:900;font-family:inherit;line-height:40px;box-shadow:0 2px 7px rgba(0,0,0,.10);">−</button>'
        +'<div id="plaza-det-qty-num" style="min-width:24px;text-align:center;font-size:18px;font-weight:900;color:#111;">1</div>'
        +'<button type="button" onclick="return window.plazaCambiarQtyDetalle(1)" style="width:40px;height:40px;border:none;border-radius:12px;background:var(--yellow);color:#111;font-size:22px;font-weight:900;font-family:inherit;line-height:40px;box-shadow:0 2px 7px rgba(0,0,0,.10);">+</button>'
        +'</div>':'')
    +'<button type="button" '+(agotado?'disabled':'')+' onclick="return window.plazaAgregarAlCarritoDetalle(\''+String(pid).replace(/'/g,"\\'")+'\''+')" style="width:100%;padding:14px;border:none;border-radius:17px;background:'+(agotado?'#ddd':'var(--blue)')+';color:#fff;font-size:13px;font-weight:900;font-family:inherit;cursor:'+(agotado?'not-allowed':'pointer')+';box-shadow:0 8px 16px rgba(26,122,181,.20);letter-spacing:.2px;">'+(agotado?'No disponible':'🛒 AGREGAR AL CARRITO')+'</button>'
    +'</div></div>';
  ov.style.visibility=''; ov.style.pointerEvents=''; ov.style.display='flex';
  try{document.body.style.overflow='hidden';document.body.style.touchAction='none';}catch(e){}
};

})();
