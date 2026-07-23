/* ════════════════════════════════════════════════════════════
   DOMINIO CUMBRES — APP.JS  v1.0.0
   Una función por responsabilidad.
════════════════════════════════════════════════════════════ */
window.DC_VERSION='1.0.1';
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
var TAB_KEY='dcPlazaQF42Tab';
var OPEN_CART='dcPlazaL14CartOpen';
var VAC_KEY='dcPlazaL14VaciarOpen';
var OPEN_ORDER='dcPlazaL14OrderOpen';

// ══════════════════════════════════════════════
// CARRITO / ÓRDENES
// ══════════════════════════════════════════════
function cart(){
  return norm(rj(CART_KEY,[]));
}
function saveCart(c){
  c=norm(c);
  wj(CART_KEY,c);
}
function clearCart(){
  wj(CART_KEY,[]);
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
  var html='<div class="dc-l14-card" data-l14-card="order" data-l14-order="'+esc(id)+'"><div class="dc-l14-head" data-l14-toggle-order="'+esc(id)+'"><div class="dc-l14-icon box">📦</div><div class="dc-l14-main"><div class="dc-l14-title">'+esc(o.negocioNombre||'Plaza Online')+'</div><div class="dc-l14-muted">'+esc(o.folio||'Compra')+' · '+fdate(o.fecha)+' · '+items.length+' prod.</div>'+estado+'</div><div class="dc-l14-right"><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'▲':'▼')+'</div></div></div>';
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
  if(changed){saveCart(c);try{_plazaUpdateCartBar();}catch(_){}}
  localStorage.setItem(OPEN_CART,'1'); renderMisCompras(true);
}
function mcDelItem(key){
  saveCart(cart().filter(function(x,i){return keyOf(x,i)!==String(key);}));
  try{_plazaUpdateCartBar();}catch(_){}
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
  window._dcSegFid=null;
  if(window._dcSegUnsub){try{window._dcSegUnsub();}catch(_){} window._dcSegUnsub=null;}
  var o=allOrders().filter(function(x){return idOf(x)===id;})[0]||allOrders()[0];
  if(o){wj(SEL_KEY,o); ORDER_KEYS.forEach(function(k){wj(k,o);});}
  try{if(typeof window.dcPlazaRenderSeguimiento==='function') window.dcPlazaRenderSeguimiento(o);}catch(_){}
  try{if(typeof window.go==='function') window.go('v-plaza-seguimiento','right');}catch(_){}
  return false;
}

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
  if(t.closest('[data-l14-vac-ok]')){stop(e);clearCart();try{_plazaUpdateCartBar();}catch(_){}if(typeof toast==='function')toast('🗑 Carrito vaciado');renderMisCompras(true);return false;}
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
        if(s){window._dcPlazaStoreActual=s;try{localStorage.setItem('dcPlazaNegNombreActual',s.nombrePublico||s.nombreNegocio||s.nombre||'');}catch(_){}}
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
    var _siT=selectedItems(),_negT=_plazaOrderNeg(_siT);
    var o={id:'plaza_'+Date.now(),folio:'#PZ'+String(Date.now()).slice(-6),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',negocioId:_negT.negocioId,negocioNombre:_negT.negocioNombre,clienteId:_negT.clienteId,clienteNombre:_negT.clienteNombre,historialEstados:[{estado:'en_proceso',fecha:Date.now()}],fecha:Date.now(),items:_siT,total:total(_siT),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:'transferencia',referenciaTransferencia:ref};
    saveOrder(o);_plazaSaveOrderFirestore(o);clearCart();
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
// PLAZA — ORDEN: datos negocio/cliente
// ══════════════════════════════════════════════
function _plazaOrderNeg(items){
  var it=(items||[])[0]||{};
  var nid=String(it.negocioId||window._plazaComercioActualId||'');
  var s=window._dcPlazaStoreActual;
  var nom=(s&&(s.nombrePublico||s.nombreNegocio||s.nombre))||localStorage.getItem('dcPlazaNegNombreActual')||'Plaza Online';
  var u=window._fbAuth&&window._fbAuth.currentUser;
  return {negocioId:nid,negocioNombre:nom,clienteId:u?u.uid:'',clienteNombre:(u&&(u.displayName||u.email))||localStorage.getItem('dcuserNombre')||'Cliente'};
}
function _plazaSaveOrderFirestore(o){
  try{
    var db=window._fbDb; if(!db) return;
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(f){
      f.addDoc(f.collection(db,'pedidosPlaza'),Object.assign({},o,{actualizado:Date.now()})).then(function(ref){
        try{
          var cur=rj(ORDER_KEYS[0],null);
          if(cur&&cur.id===o.id){cur.firestoreId=ref.id;wj(ORDER_KEYS[0],cur);}
          wj(SEL_KEY,Object.assign({},rj(SEL_KEY,{}),cur&&cur.id===o.id?{firestoreId:ref.id}:{}));
          HIST_KEYS.forEach(function(hk){
            var h=rj(hk,[]); if(!Array.isArray(h)) return;
            var idx=h.findIndex(function(x){return x&&x.id===o.id;});
            if(idx>-1){h[idx]=Object.assign({},h[idx],{firestoreId:ref.id});wj(hk,h);}
          });
        }catch(_){}
      }).catch(function(){});
    }).catch(function(){});
  }catch(_){}
}

// ══════════════════════════════════════════════
// CONFIRMAR COMPRA
// ══════════════════════════════════════════════
var _confirmLock=false;

// Vistas del flujo de compra que se deben drenar del historial (NO incluye v-plaza — es el destino seguro)
var _PLAZA_DRAIN_VIEWS=/^(v-plaza-det|v-mis-compras-plaza|v-plaza-comprando|v-plaza-seguimiento)$/;
var _dcPlazaCleaningHistory=false;
var _dcPlazaDrainCount=0;

function _dcPlazaLlegarAMisCompras(){
  _dcPlazaCleaningHistory=false;
  _dcPlazaDrainCount=0;
  _navStack=_navStack.filter(function(id){return !_PLAZA_DRAIN_VIEWS.test(id);});
  try{window._misComprasPlazaTab='proceso';}catch(_){}
  // pushState (no replaceState): deja v-plaza como destino de Atrás desde Mis Compras
  // Resultado: Home → Plaza Online → Mis Compras
  try{history.pushState({viewId:'v-mis-compras-plaza'},'','');}catch(_){}
  try{if(typeof window._goCore==='function') window._goCore('v-mis-compras-plaza','left'); else if(typeof _goCore==='function') _goCore('v-mis-compras-plaza','left');}catch(_){}
  setTimeout(function(){try{renderMisCompras(true);}catch(_){}},60);
}

function goSeguimiento(){
  try{window._dcDirtyV=null;}catch(_){}
  _dcPlazaCleaningHistory=true;
  _dcPlazaDrainCount=0;
  setTimeout(function(){_confirmLock=false;},800);
  try{history.go(-1);}catch(_){_dcPlazaLlegarAMisCompras();}
}

// Interceptor post-compra: drena historial de compra hasta v-plaza, luego push Mis Compras
// Historial resultante: [..., v-home, v-plaza, v-mis-compras-plaza]
// Atrás desde Mis Compras → Plaza Online; Atrás desde Plaza → Home. Sin ciclos.
window.addEventListener('popstate',function(e){
  if(_dcPlazaCleaningHistory){
    e.stopImmediatePropagation();
    _dcPlazaDrainCount++;
    if(_dcPlazaDrainCount<15&&e.state&&_PLAZA_DRAIN_VIEWS.test(e.state.viewId)){
      // Seguir drenando — aún estamos en vistas del flujo de compra
      try{history.go(-1);}catch(_){_dcPlazaLlegarAMisCompras();}
    } else {
      // Llegamos a v-plaza (o a home si no había v-plaza) — aquí terminamos
      _dcPlazaLlegarAMisCompras();
    }
    return;
  }
  // Bloqueo normal: comprando no es destino de Atrás fuera del flujo de compra
  if(!e.state||e.state.viewId!=='v-plaza-comprando') return;
  e.stopImmediatePropagation();
  try{history.replaceState({viewId:'v-plaza'},'','');}catch(_){}
  try{if(typeof window._goCore==='function') window._goCore('v-plaza','left'); else if(typeof _goCore==='function') _goCore('v-plaza','left');}catch(_){}
},true);

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
  var _negF=_plazaOrderNeg(items);
  var o={id:'plaza_'+Date.now(),folio:'#PZ'+String(Date.now()).slice(-6),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',negocioId:_negF.negocioId,negocioNombre:_negF.negocioNombre,clienteId:_negF.clienteId,clienteNombre:_negF.clienteNombre,historialEstados:[{estado:'en_proceso',fecha:Date.now()}],fecha:Date.now(),items:items,total:total(items),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:(localStorage.getItem('dcPlazaTipoPago')||'efectivo')};
  saveOrder(o);_plazaSaveOrderFirestore(o);clearCart();
  return _plazaShowCompraOverlay(goSeguimiento),false;
}

window.addEventListener('pointerdown',finalizarCompra,true);
window.addEventListener('touchstart',function(e){if(isConfirmTarget(e)) stop(e);},true);
window.addEventListener('click',function(e){if(isConfirmTarget(e)) return finalizarCompra(e);},true);
window.dcPlazaConfirmarCompra=finalizarCompra;


// ══════════════════════════════════════════════
// PLAZA — BARRA DE CARRITO INFERIOR (como Food)
// ══════════════════════════════════════════════
function _plazaUpdateCartBar(){
  var v=document.getElementById('v-plaza-det');
  if(!v) return;
  var bar=document.getElementById('dc-plaza-cart-bar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='dc-plaza-cart-bar';
    bar.innerHTML=
      '<div id="dc-plaza-cart-count" style="background:#F5C518;color:#5b4300;min-width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;padding:0 5px;">0</div>'+
      '<div style="font-size:13px;font-weight:700;color:#fff;flex:1;margin-left:10px;">Ver carrito</div>'+
      '<div id="dc-plaza-cart-total" style="font-size:13px;font-weight:900;color:#F5C518;">$0</div>';
    bar.style.cssText='background:#0A3055;border-radius:16px;margin:0 14px 10px;padding:12px 16px;align-items:center;cursor:pointer;flex-shrink:0;box-shadow:0 4px 16px rgba(10,48,85,.35);transition:opacity .2s;';
    bar.addEventListener('click',function(){
      localStorage.setItem(OPEN_CART,'1');
      if(typeof window.go==='function') window.go('v-mis-compras-plaza','right');
    });
    var nav=v.querySelector('.nav');
    if(nav) v.insertBefore(bar,nav); else v.appendChild(bar);
  }
  var c=cart();
  var s=window._dcPlazaStoreActual;
  var storeId=s&&String(s._id||s.id||s.uid||s.negocioId||'');
  var sc=storeId?c.filter(function(x){return String(x.negocioId||'')===storeId;}):c;
  var cnt=sc.reduce(function(a,x){return a+qty(x.cantidad);},0);
  var countEl=document.getElementById('dc-plaza-cart-count');
  var totalEl=document.getElementById('dc-plaza-cart-total');
  if(countEl) countEl.textContent=cnt;
  if(totalEl) totalEl.textContent=money(total(sc));
  bar.style.display=cnt>0?'flex':'none';
}

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
  var _sd=window._dcPlazaStoreActual;
  return {id:pid||('dom_'+Date.now()),productoId:pid||('dom_'+Date.now()),nombre:name||'Producto',precio:price,cantidad:1,qty:1,foto:foto,negocioId:String(window._plazaComercioActualId||window._plazaDetalleComercioId||(_sd&&(_sd._id||_sd.id||_sd.uid||_sd.negocioId||''))||'')};
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
function _plazaMostrarModalConflicto(negActual,negNuevo,pid,q){
  var existName=cart().reduce(function(a,x){return a||(x.negocioId===negActual?(x.negocioNombre||negActual):'');},'');
  var s=window._dcPlazaStoreActual;
  var newName=(s&&(s.nombrePublico||s.nombreNegocio||s.nombre))||negNuevo||'esta tienda';
  var ov=document.getElementById('dc-plaza-mix-ov');
  if(!ov){ov=document.createElement('div');ov.id='dc-plaza-mix-ov';ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2147483647;align-items:center;justify-content:center;font-family:inherit;';document.body.appendChild(ov);}
  ov.innerHTML='<div style="background:#fff;border-radius:20px;padding:24px 20px;max-width:300px;width:90%;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.3);">'
    +'<div style="font-size:32px;margin-bottom:12px;">🛒</div>'
    +'<div style="font-size:15px;font-weight:900;color:#111;margin-bottom:8px;">Carrito de otra tienda</div>'
    +'<div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:20px;">Tu carrito tiene productos de <b>'+esc(existName||negActual)+'</b>.<br>¿Deseas vaciarlo y agregar productos de <b>'+esc(newName)+'</b>?</div>'
    +'<button id="dc-plaza-mix-ok" style="width:100%;padding:13px;border:none;border-radius:12px;background:#D63A2A;color:#fff;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer;margin-bottom:8px;">Vaciar y agregar</button>'
    +'<button id="dc-plaza-mix-cancel" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:12px;background:#f5f5f5;color:#555;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;">Cancelar</button>'
    +'</div>';
  window.__dcPlzMixPid=pid;window.__dcPlzMixQ=q;
  ov.style.display='flex';
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t) return;
  if(t.id==='dc-plaza-mix-ok'){
    var ov=document.getElementById('dc-plaza-mix-ov');if(ov)ov.style.display='none';
    var pid=window.__dcPlzMixPid,q=window.__dcPlzMixQ;
    window.__dcPlzMixPid=null;window.__dcPlzMixQ=null;
    saveCart([]);
    try{_plazaUpdateCartBar();}catch(_){}
    if(pid!=null) _plazaDoAdd(pid,q);
  }
  if(t.id==='dc-plaza-mix-cancel'){
    var ov=document.getElementById('dc-plaza-mix-ov');if(ov)ov.style.display='none';
    window.__dcPlzMixPid=null;window.__dcPlzMixQ=null;
  }
},true);
function _plazaDoAdd(pid,q){
  if(window.__dcPlazaAddLock) return false;
  window.__dcPlazaAddLock=true;
  try{
    var p=_plazaProdFromCache(pid)||_plazaProdFromDOM(pid);
    if(!p||p.disponible===false) return false;
    var cnt=qty(q||_plazaGetQty());
    var id=String(p._id||p.id||p.productoId||pid||Date.now());
    var _sa=window._dcPlazaStoreActual;
    var negocio=String(window._plazaComercioActualId||window._plazaDetalleComercioId||p.negocioId||(_sa&&(_sa._id||_sa.id||_sa.uid||_sa.negocioId||''))||'');
    var c=cart(); if(!Array.isArray(c)) c=[];
    var existNeg='';
    if(c.length){var _fi=c[0];existNeg=String(_fi.negocioId||(_fi.key&&_fi.key.indexOf('::')>0?_fi.key.split('::')[0]:'')||'');}
    if(existNeg&&negocio&&existNeg!==negocio){window.__dcPlazaAddLock=false;_plazaMostrarModalConflicto(existNeg,negocio,pid,q);return false;}
    var key=negocio+'::'+id;
    var found=c.find(function(x){return String(x.key||((x.negocioId||'')+'::'+(x.productoId||x.id)))===key;});
    if(found){found.cantidad=qty(Number(found.cantidad||found.qty||0)+cnt);found.qty=found.cantidad;}
    else c.push({id:id,productoId:id,key:key,negocioId:negocio,nombre:p.nombre||'Producto',precio:num(p.precio||p.price||0),cantidad:cnt,qty:cnt,foto:p.foto||p.fotoProducto||p.fotoPublica||''});
    saveCart(c);
    try{_plazaUpdateCartBar();}catch(_){}
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
  if(o.negocioNombre){var hs=document.querySelector('#v-plaza-seguimiento .si21');if(hs)hs.textContent=o.negocioNombre;}
  if(o.firestoreId&&window._fbDb&&!window._dcSegFid){
    window._dcSegFid=o.firestoreId;
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(f){
      if(window._dcSegUnsub){try{window._dcSegUnsub();}catch(_){}}
      window._dcSegUnsub=f.onSnapshot(f.doc(window._fbDb,'pedidosPlaza',o.firestoreId),function(snap){
        if(snap.exists()){var upd=Object.assign({},snap.data(),{firestoreId:o.firestoreId});saveOrder(upd);renderSeguimiento(upd);}
      });
    }).catch(function(){});
  }
  var items=norm(o.items||cart()), t=Number(o.total)||total(items);
  var el=document.getElementById('v-plaza-seguimiento-lista'); if(!el) return false;
  var rows=items.map(function(x){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:.5px solid #eee;"><div><div style="font-size:12px;font-weight:900;color:#111;line-height:1.25;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div style="font-size:10px;color:#777;margin-top:2px;">'+money(num(x.precio))+' c/u</div></div><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty(x.cantidad))+'</div></div>';}).join('');
  var estado=String((o.estado)||'en_proceso').toLowerCase();
  // Mapeo igual que Food: estado → paso (en_proceso≡nuevo, preparando≡aceptado+preparando)
  var pasoActual=0; // en_proceso = recibida, esperando aceptación del negocio
  if(estado==='preparando') pasoActual=1;
  if(estado==='listo') pasoActual=2;
  if(estado==='en_camino') pasoActual=3;
  if(['entregado','finalizado','completado'].indexOf(estado)!==-1) pasoActual=4;
  if(['cancelado','rechazado'].indexOf(estado)!==-1) pasoActual=-1;
  function stepBg(n){return n<=pasoActual?'#20c76a':'#f0f2f3';}
  function stepTx(n){return n<=pasoActual?'#111':'#99a1aa';}
  var _T=['Compra recibida','Preparando tu pedido','¡Listo para entrega!','En camino','¡Compra entregada!'];
  var _S2=['Esperando confirmación del negocio','Tu pedido está en preparación','Ya puede ser recogido o entregado','Tu pedido va en camino','Tu pedido fue entregado exitosamente.'];
  var titulo=pasoActual===-1?'Compra cancelada':(_T[pasoActual]||'Compra recibida');
  var sub=pasoActual===-1?'Esta compra fue cancelada.':(_S2[pasoActual]||'');
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
          if(s){s._dcModulo='negocio';window._dcPlazaStoreActual=s;try{localStorage.setItem('dcPlazaNegNombreActual',s.nombrePublico||s.nombreNegocio||s.nombre||'');}catch(_){}}
          var _pfBtn=document.getElementById('plaza-fav-btn');
          if(_pfBtn&&window._dcPlazaStoreActual){var _pfId=window._dcPlazaStoreActual._id||window._dcPlazaStoreActual.id||window._dcPlazaStoreActual.uid||window._dcPlazaStoreActual.nombre;var _pfIs=window.isFav&&window.isFav(_pfId);_pfBtn.textContent=_pfIs?'❤️':'🤍';}
        }
      }catch(_){}
      try{_plazaUpdateCartBar();}catch(_){}
    },300);}
    if(id==='v-plaza-comprando'){setTimeout(function(){try{renderComprando();}catch(_){}},45);}
    if(id==='v-plaza-seguimiento'){setTimeout(function(){try{renderSeguimiento();}catch(_){}},45);}
    if(id==='vn-home'&&typeof window.dcNeg_resetStack==='function') window.dcNeg_resetStack();
    if(id==='v-favoritos'){window.__dcL33LastBeforeFav=window.__dcL33LastBeforeFav||'';}
    if(id==='v-eventos'){setTimeout(function(){try{window.evCargarPortal&&window.evCargarPortal();}catch(_){}},60);}
    // ── Campañas: cargar banner al entrar a cada sección ──────────────────
    if(window.dcCampanas){
      var _campMap={'v-home':'home','v-food':'food','v-plaza':'plaza',
                    'v-servicios':'servicios','v-informa':'informa','v-eventos':'eventos'};
      if(_campMap[id]){
        setTimeout(function(){
          try{window.dcCampanas.cargar(_campMap[id],'campanas-'+_campMap[id]);}catch(_){}
        },200);
      }
    }
    if(typeof window.__dcNavPatchAll==='function'){setTimeout(window.__dcNavPatchAll,35);setTimeout(window.__dcNavPatchAll,180);}
    _patchFavBack();
    try {
      var fab = document.getElementById('dc-fab-global');
      if (fab) {
        var _fabOcultar = ['v-impulsa','v-impulsa-planes','v-impulsa-pago','v-impulsa-ok',
                           'v-splash','v-login','v-register','v-role','v-loading',
                           'v-admin-login','v-admin-panel','v-admin-config','v-admin-solicitudes',
                           'v-admin-usuarios','v-admin-monetizacion','v-admin-analytics',
                           'v-admin-publicaciones','v-admin-alertas','v-admin-planes','v-admin-campanas',
                           'v-reg-vecino','v-reg-prov','v-reg-ride','v-reg-biz',
                           'v-reg-proveedor','v-reg-restaurante','v-reg-negocio','v-reg-transporte'];
        var _tipoUser = (localStorage.getItem('dcuserTipo') || '').toLowerCase();
        if (_fabOcultar.indexOf(id) !== -1 || _tipoUser === 'vecino' || _tipoUser === 'admin') {
          fab.style.opacity = '0';
          fab.style.pointerEvents = 'none';
        } else if (fab.classList.contains('visible')) {
          fab.style.opacity = '1';
          fab.style.pointerEvents = 'auto';
          var _activeView = document.getElementById(id);
          var _tieneNav = _activeView && _activeView.querySelector('.nav');
          fab.style.bottom = _tieneNav ? '140px' : '80px';
        }
      }
    } catch(_) {}
  }catch(_){}
}

// ── FAB global: estrella flotante IMPULSA ────────────────────────────────
window._dcFabInit = function() {
  var fab = document.getElementById('dc-fab-global');
  if (!fab) return;
  var ROLES_NEGOCIO = ['proveedor','restaurante','negocio'];
  var tipo = (localStorage.getItem('dcuserTipo') || '').toLowerCase();
  // Si no hay tipo en localStorage, intentar leerlo del usuario actual
  if (!tipo) {
    var _u = window._fbAuth && window._fbAuth.currentUser;
    if (!_u) return;
    (async function() {
      try {
        var snap = await _fbGet2('usuarios', _u.uid);
        var d = snap.exists() ? snap.data() : {};
        tipo = (d.tipo || '').toLowerCase();
        if (ROLES_NEGOCIO.indexOf(tipo) !== -1) {
          localStorage.setItem('dcuserTipo', tipo);
          window._dcFabInit();
        }
      } catch(e) {}
    })();
    return;
  }
  if (ROLES_NEGOCIO.indexOf(tipo) === -1) { fab.classList.remove('visible'); return; }
  fab.classList.add('visible');
  fab.style.opacity = '1';
  fab.style.pointerEvents = 'auto';
  var star = document.getElementById('dc-fab-star');
  var lbl  = document.getElementById('dc-fab-label');
  window._dcFabAccion = function() { window._irAImpulsa && window._irAImpulsa(); };
  (async function() {
    try {
      var user = window._fbAuth && window._fbAuth.currentUser;
      if (!user) return;
      var snap = await _fbGet2('usuarios', user.uid);
      var d = snap.exists() ? snap.data() : {};
      var ahora = Date.now();
      var venceMs = d.planVence
        ? (d.planVence.toMillis ? d.planVence.toMillis() : (d.planVence.seconds||0)*1000) : 0;
      var esImpulsa = d.plan === 'impulsa' && venceMs > ahora;
      if (esImpulsa) {
        if (star) { star.textContent = '📢'; star.style.filter = 'drop-shadow(0 0 8px rgba(31,194,106,.9))'; }
        if (lbl)  lbl.textContent = 'PUBLICIDAD';
        window._dcFabAccion = function() { window._dcProximamente && window._dcProximamente('Publicidad','Estadísticas de tus campañas próximamente'); };
      }
    } catch(e) {}
  })();
};
window._actualizarFabHome = window._dcFabInit;

function dcGoOficial(id,dir){
  id=_preHooks(id); dir=dir||'right';
  var cur=document.querySelector('.view.active'), curId=cur&&cur.id?cur.id:'';
  if(curId==='v-reg-vecino'&&id!=='v-reg-vecino'){var bv=document.getElementById('btn-reg-vecino');if(bv){bv.textContent='Crear mi cuenta →';bv.disabled=false;}}
  _resetRegistro(id);
  if(!id||!_viewExists(id)||(curId&&curId===id)){_postHooks(id);return false;}
  if(dir==='left'&&curId&&typeof window._dcConfirmarSalida==='function'){
    window._dcPendingNav={id:id,dir:dir};
    if(!window._dcConfirmarSalida(curId)){window._dcPendingNav=null;return false;}
    window._dcPendingNav=null;
  }
  if(!_navSuppress&&curId&&curId!==id) _pushView(curId);
  try{history.pushState({viewId:id},'','');}catch(_){}
  if(typeof window._goCore==='function') window._goCore(id,dir);
  else if(typeof _goCore==='function') _goCore(id,dir);
  else{if(cur) cur.classList.remove('active');var tgt=document.getElementById(id);if(tgt) tgt.classList.add('active');}
  // Guardar vista actual para restaurar al refrescar la página
  var _noSaveV=['v-splash','v-login','v-register','v-role','v-loading','v-reg-vecino','v-reg-prov','v-reg-ride','v-reg-biz','v-reg-proveedor','v-reg-restaurante','v-reg-negocio','v-reg-transporte','v-espera-revision','v-espera-pago','v-cuenta-suspendida','v-solicitud-rechazada','v-vecino-suspendido','v-admin-login','v-admin-panel'];
  if(_noSaveV.indexOf(id)===-1){try{localStorage.setItem('dc_lastView',id);}catch(_){}}
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
// NAV AUDIT — patchNav
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
      // v-notificaciones conserva su nav original (Reservaciones en posición 4)
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
  setTimeout(patchAll,250);
  var mo=new MutationObserver(function(){clearTimeout(window.__dcNavPatchTimer);window.__dcNavPatchTimer=setTimeout(patchAll,80);});
  if(document.body) mo.observe(document.body,{childList:true,subtree:true});
})();


// ══════════════════════════════════════════════
// FAVORITOS / DETALLE PROVEEDOR BACK
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
  if(detBtn&&detBtn.id!=='det-fav-btn'){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();return _goBack('v-servicios');}
},true);

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
// FREEZE — PLAZA ONLINE CLIENTE
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


// ── Advertencia al salir con carrito activo (Objetivo 2 & 3) ──
function _dcConfirmarSalidaCart(msg, btnSalir, onSalir, onQuedar){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML='<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'
    +'<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:16px;line-height:1.4;">'+msg+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px;">'
    +'<button id="_dcCSC_salir" style="background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">'+btnSalir+'</button>'
    +'<button id="_dcCSC_quedar" style="background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;">Continuar comprando</button>'
    +'</div></div>';
  document.body.appendChild(ov);
  function cerrar(){if(ov.parentNode) document.body.removeChild(ov);}
  ov.querySelector('#_dcCSC_salir').onclick=function(){cerrar();if(onSalir) onSalir();};
  ov.querySelector('#_dcCSC_quedar').onclick=function(){cerrar();if(onQuedar) onQuedar();};
  ov.onclick=function(e){if(e.target===ov){cerrar();if(onQuedar) onQuedar();}};
}

window._dcConfirmarSalida=function(curId){
  if(window._dcSalidaBypass){window._dcSalidaBypass=false;return true;}
  var nav=window._dcPendingNav||{};
  // Plaza: advertir si hay productos en el carrito
  if(curId==='v-plaza-det'&&cart().length>0){
    _dcConfirmarSalidaCart(
      'Si sales de esta tienda perderás los productos agregados al carrito.',
      'Salir y vaciar carrito',
      function(){clearCart();try{_plazaUpdateCartBar();}catch(e){}window._dcSalidaBypass=true;if(typeof window.go==='function') window.go(nav.id||'v-plaza',nav.dir||'left');},
      function(){}
    );
    return false;
  }
  // Food: advertir si hay productos en el carrito
  if(curId==='v-food-det'){
    var bar=document.getElementById('dcf-cart-bar');
    if(bar&&bar.style.display==='flex'){
      _dcConfirmarSalidaCart(
        'Si sales de este restaurante perderás los productos agregados al carrito.',
        'Salir y vaciar carrito',
        function(){if(typeof window.dcFood_vaciarCarrito==='function') window.dcFood_vaciarCarrito();window._dcSalidaBypass=true;if(typeof window.go==='function') window.go(nav.id||'v-food',nav.dir||'left');},
        function(){}
      );
      return false;
    }
  }
  // Fallback: dirty-form (comportamiento original de chat.js)
  if(window._dcDirtyV&&window._dcDirtyV===curId){
    var ok=window.confirm('⚠️ Tienes cambios sin guardar.\n\nPresiona CANCELAR para quedarte,\no ACEPTAR para salir sin guardar.');
    if(ok) window._dcDirtyV=null;
    return ok;
  }
  return true;
};

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

/* ======= RATING — proveedor: delegates to generic engine con blockId='det' ======= */
window.dcProvRatingCargar = function(pUid){ window.dcRatingCargar(pUid,'det','⭐ Calificar a este proveedor'); };
window.dcProvRatingEnviar = function(){ window.dcRatingEnviar('det'); };
window.dcProvRatingSet    = function(n){ window.dcRatingSet(n,'det'); };

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
  if(!nr){if(window.toast)toast('⭐ Selecciona una calificación');return;}
  var pUid=window._dcRatingUid[blockId]||''; if(!pUid)return;
  var auth=window._fbAuth; var myUid=auth&&auth.currentUser&&auth.currentUser.uid;
  if(!myUid){window._dcAlerta&&window._dcAlerta('Inicia sesión para calificar');return;}
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
    if(window._dcAlerta) window._dcAlerta('⚠️ Error al guardar: '+e.message);
    else if(window.toast) toast('⚠️ Error: '+e.message);
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
    window.dcComprimirFoto(e.target.result, function(compressed){
      window._cmvFotoB64=compressed;
      var pv=document.getElementById('vprov-cmv-foto-prev');
      if(pv)pv.innerHTML='<img src="'+window._cmvFotoB64+'" style="width:100%;height:100%;object-fit:cover;">';
      window.vprovCmvRenderPreview();
    });
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
    var r=new FileReader(); r.onload=function(e){window.dcComprimirFoto(e.target.result,function(c){window._cmvFotos.push(c);_cmvRenderGrid();});}; r.readAsDataURL(f);
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
    btn.style.cssText='background:#E8F5E9;border:1px solid #A5D6A7;border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:#388E3C;cursor:pointer;font-family:inherit;white-space:nowrap;';
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
              +   '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px;">'+window.dcEscHTML(p.nombre||'—')+'</div>'
              +   '<div style="font-size:11px;color:#888;">'+window.dcEscHTML(p.descripcion||p.categoria||'Proveedor')+'</div>'
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
      + '<div><div style="font-size:13px;font-weight:700;color:#111;">' + window.dcEscHTML(p.nombre||'—') + '</div>'
      + '<div style="font-size:11px;color:#888;">' + window.dcEscHTML(p.categoria||'Proveedor') + '</div></div>'
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
        + '<b>' + window.dcEscHTML(p.nombre||'El proveedor') + '</b> recibirá tu solicitud:<br>'
        + '<b>' + diaLbl + ' a las ' + _horaSel + '</b>'
        + (nota ? '<br><span style="color:#888;">Nota: ' + window.dcEscHTML(nota) + '</span>' : '')
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
    // Campana = solo notificaciones de sistema/admin/promocion.
    notifs = (notifs||[]).filter(function(n){
      var m = (n.modulo||'').toLowerCase();
      var t = (n.tipo||'').toLowerCase();
      var tit = (n.titulo||'').toLowerCase();
      var EXCLUIR = ['pedido','chat','compra','reserva','proveedor','solicitud','proveedor_interesado','postulacion','agenda'];
      if (EXCLUIR.indexOf(m) !== -1) return false;
      if (EXCLUIR.indexOf(t) !== -1) return false;
      if (tit.indexOf('proveedor') !== -1) return false;
      if (tit.indexOf('reserva') !== -1) return false;
      if (tit.indexOf('pedido') !== -1) return false;
      return true;
    });

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
        + '<span style="font-size:13px;font-weight:'+(n.leida?'600':'700')+';color:#111;">'+window.dcEscHTML(n.titulo||n.tipo||'Notificación')+'</span>'
        + (n.leida ? '' : '<span style="width:7px;height:7px;border-radius:50%;background:#D63A2A;flex-shrink:0;display:inline-block;"></span>')
        + '</div>'
        + '<div style="font-size:11px;color:#666;line-height:1.45;margin-bottom:3px;">'+window.dcEscHTML(n.mensaje||'')+'</div>'
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
      +'<div class="si05"><div class="si17">'+window.dcEscHTML(r.nombrePublico||r.nombreNegocio||r.nombre||'—')+'</div>'
      +'<span class="si44" style="background:'+meta.bg+';color:'+meta.col+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;">'+window.dcEscHTML(meta.lbl)+'</span></div>'
      +'<div class="si10">'+window.dcEscHTML(r.descripcionPublica||r.descripcion||cat||'Comercio local')+'</div>'
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


// ── HOME MULTIROL — renderHomeM2 ──────────────────────────
window.renderHomeM2 = function() {
  var DC_ESTADOS = window._DC_ESTADOS || {};
    var tipo   = (localStorage.getItem('dcuserTipo')   || 'vecino').toLowerCase();
    var estado = (localStorage.getItem('dcuserEstado') || '').toLowerCase();
    var nombre = localStorage.getItem('dcuser') || 'Usuario';

    // ── 1. Header dinámico ──────────────────────────────────────
    var h = new Date().getHours();
    var saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    // Actualizar saludo en el badge existente
    var elS = document.getElementById('home-saludo');
    if (elS) elS.textContent = saludo + ',';

    // Paleta por rol
    var PALETA = {
      vecino:      { color:'#1FC26A', bg:'#e8f5e1', label:'Vecino',                  ic:'🏠' },
      proveedor:   { color:'#F5C518', bg:'#FFF8DC', label:'Proveedor',               ic:'🔧' },
      transporte:  { color:'#1A7AB5', bg:'#E8F0F8', label:'Transporte / Repartidor', ic:'🚗' },
      repartidor:  { color:'#1A7AB5', bg:'#E8F0F8', label:'Repartidor',              ic:'🏍️' },
      ambos:       { color:'#1A7AB5', bg:'#E8F0F8', label:'Transporte / Reparto',    ic:'🚗' },
      restaurante: { color:'#D63A2A', bg:'#FDECEA', label:'Restaurante',             ic:'🍽️' },
      negocio:     { color:'#7B3FA0', bg:'#F0EBF8', label:'Negocio',                 ic:'🏪' },
    };
    var pal = PALETA[tipo] || PALETA.vecino;

    // Actualizar badge de tipo
    var elT = document.getElementById('home-tipo-label');
    if (elT) {
      elT.style.background = pal.bg;
      elT.style.color = pal.color;
      elT.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:'+pal.color+';display:inline-block;flex-shrink:0;margin-right:5px;"></span>'
        + pal.ic + ' ' + pal.label;
    }

    // ── M2-D: Estado operativo en Home ────────────────────────
    // Solo para no-vecino. Vecino no tiene estado de operación.
    var elEst = document.getElementById('home-estado-op');
    if (tipo !== 'vecino') {
      var estKey = window.getEstadoEfectivoActual ? window.getEstadoEfectivoActual() : window.getEstadoOperativo();
      var estCfg = DC_ESTADOS[estKey] || DC_ESTADOS.activo;
      if (!elEst) {
        // Crear el label si no existe (primera carga)
        var wrapper = document.getElementById('home-tipo-label') &&
                      document.getElementById('home-tipo-label').parentNode;
        if (wrapper) {
          var newEl = document.createElement('span');
          newEl.id = 'home-estado-op';
          newEl.style.cssText = 'display:inline-flex;align-items:center;margin-left:6px;border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;';
          wrapper.appendChild(newEl);
          elEst = newEl;
        }
      }
      if (elEst) {
        elEst.textContent = estCfg.ic + ' ' + estCfg.lbl;
        elEst.style.background = estCfg.bg;
        elEst.style.color = estCfg.col;
      }
    } else if (elEst) {
      elEst.style.display = 'none';
    }

    // Barra de búsqueda removida del Home — cada módulo tiene la suya
    var searchWrap = document.getElementById('home-search-wrap');
    if (searchWrap) searchWrap.style.display = 'none';

    // ── 2. Banners de publicidad: rotar según rol ───────────────
    var track = document.getElementById('home-ads-track');
    if (track) {
      // Reordenar: poner el banner relevante al rol primero
      var relevante = { vecino:'comida', proveedor:'servicios', transporte:'ride',
                        repartidor:'ride', ambos:'ride', restaurante:'comida', negocio:'plaza' };
      var cat = relevante[tipo] || 'comida';
      var slides = Array.from(track.children);
      var first = slides.find(function(s){ return s.dataset.adCategory === cat; });
      if (first && first !== slides[0]) track.insertBefore(first, slides[0]);
    }
    // Insertar promos activas al inicio del carrusel
    window.renderPromoEnCarrusel && window.renderPromoEnCarrusel();

    // ── 2b. Campañas del home ──────────────────────────────────
    try{window.dcCampanas&&window.dcCampanas.cargar('home','campanas-home');}catch(_){}

    // ── 3. Contenido del scroll ────────────────────────────────
    var scroll = document.querySelector('#v-home .scroll');
    if (!scroll) return;
    var _adsWrap = document.getElementById('home-ads-wrap');

    // ══════════════════════════════════════════════════════════
    // ── M2-C: SISTEMA DE BADGES ───────────────────────────────
    // Badges solo se muestran si existen en localStorage via setBadge().
    // No se siembra nada automáticamente.
    var BADGE_KEY = 'dc_badges_v1';

    window.getBadges = function() {
      try { return JSON.parse(localStorage.getItem(BADGE_KEY) || '{}'); }
      catch(e) { return {}; }
    };

    window.setBadge = function(m, count, urgencia) {
      var all = window.getBadges();
      if (count <= 0) { delete all[m]; }
      else { all[m] = { count: count, urgencia: urgencia || 'normal', ts: Date.now() }; }
      localStorage.setItem(BADGE_KEY, JSON.stringify(all));
    };

    // Limpia datos de sesión anterior que no correspondan al tipo actual
    // Evita mostrar badges de otro rol o de mocks previos
    (function limpiarBadgesExpirados() {
      // Módulos válidos por rol
      var modulosPorRol = {
        vecino:      ['informa', 'solicitudes_vecino', 'pedidos'],
        proveedor:   ['solicitudes','chats'],
        transporte:  ['solicitudes','chats'],
        repartidor:  ['solicitudes','chats'],
        ambos:       ['solicitudes','chats'],
        restaurante: ['pedidos','chats'],
        negocio:     ['solicitudes','chats','pedidos'],
      };
      var validos = modulosPorRol[tipo] || [];
      var all = window.getBadges();
      var changed = false;
      Object.keys(all).forEach(function(k) {
        if (validos.indexOf(k) === -1) { delete all[k]; changed = true; }
      });
      if (changed) localStorage.setItem(BADGE_KEY, JSON.stringify(all));
    })();

    // M2-I: actualizar badges con datos reales de Firestore (async, no bloquea render)
    window.actualizarBadgesReales && window.actualizarBadgesReales();

    window.marcarModuloVisto = function(m) {
      var all = window.getBadges();
      delete all[m];
      localStorage.setItem(BADGE_KEY, JSON.stringify(all));
      var vh = document.getElementById('v-home');
      if (vh && vh.classList.contains('active')) {
        window.renderHomeM2 && window.renderHomeM2();
      }
    };

    window.renderBadge = function(m) {
      var b = window.getBadges()[m];
      if (!b || b.count <= 0) return '';
      var n = b.count > 9 ? '9+' : String(b.count);
      return n + (b.urgencia === 'critical' ? '🔥' : b.urgencia === 'aged' ? '⏳' : '');
    };

    // ── helpers de layout ─────────────────────────────────────
    function chip(ic, lbl, ruta, badgeKey) {
      var txt = badgeKey ? window.renderBadge(badgeKey) : '';
      var b = txt ? '<span style="position:absolute;top:-5px;right:-5px;background:#D63A2A;color:#fff;font-size:8px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;white-space:nowrap;">' + txt + '</span>' : '';
      return '<div onclick="' + ruta + '" style="position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:4px;background:#fff;border-radius:14px;padding:10px 14px;border:.5px solid #e8e8e8;cursor:pointer;min-width:58px;box-shadow:0 1px 3px rgba(0,0,0,.04);">'
        + b + '<span style="font-size:20px;">' + ic + '</span>'
        + '<span style="font-size:10px;font-weight:600;color:#444;">' + lbl + '</span></div>';
    }

    function modulo(ic, bg, lbl, sub, ruta, badgeKey) {
      var txt = badgeKey ? window.renderBadge(badgeKey) : '';
      var dot = txt ? '<div style="position:absolute;top:8px;right:8px;background:#D63A2A;color:#fff;font-size:8px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;white-space:nowrap;">' + txt + '</div>' : '';
      return '<div onclick="' + ruta + '" ontouchstart="this.style.transform=\'scale(.96)\';this.style.boxShadow=\'none\'" ontouchend="this.style.transform=\'\';this.style.boxShadow=\'0 2px 8px rgba(0,0,0,.08)\'" style="position:relative;background:#fff;border-radius:20px;padding:16px 14px 15px;display:flex;flex-direction:column;gap:10px;border:none;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer;transition:transform .15s,box-shadow .15s;overflow:hidden;">'
        + '<div style="position:absolute;top:-10px;right:-10px;width:60px;height:60px;border-radius:50%;background:' + bg + ';opacity:.35;"></div>'
        + dot
        + '<div style="width:44px;height:44px;border-radius:14px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">' + ic + '</div>'
        + '<div><div style="font-size:14px;font-weight:800;color:#1a1a1a;line-height:1.2;">' + lbl + '</div>'
        + (sub ? '<div style="font-size:10px;color:#888;margin-top:3px;font-weight:500;">' + sub + '</div>' : '')
        + '</div></div>';
    }

    function secLabel(txt) {
      return '<div style="font-size:13px;font-weight:800;color:#111;padding:0 16px;margin-bottom:12px;letter-spacing:-.1px;">'+txt+'</div>';
    }

    function panelBtn(ruta) {
      return '<div onclick="'+ruta+'" style="margin:0 14px 18px;background:#f8f8f8;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;border:.5px solid #eee;cursor:pointer;" ontouchstart="this.style.opacity=\'.8\'" ontouchend="this.style.opacity=\'1\'">'
        + '<div style="width:36px;height:36px;border-radius:10px;background:'+pal.bg+';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">👤</div>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#111;">Mi Panel</div><div style="font-size:10px;color:#888;margin-top:1px;">Perfil · métricas · cuenta</div></div>'
        + '<div style="font-size:18px;color:#ccc;">›</div>'
        + '</div>';
    }

    function descubrimiento(tieneActividad) {
      if (tieneActividad) return '';
      return '<div style="margin:0 0 18px;">'
        + '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;padding:0 18px;margin-bottom:10px;">✨ Descubre hoy</div>'
        + '<div id="home-discover-list" style="padding:0 14px;"></div>'
        + '<div style="padding:0 18px;"><div style="font-size:11px;font-weight:700;color:#1f7a38;cursor:pointer;" onclick="go(\'v-busqueda\',\'right\')">Ver más →</div></div>'
        + '</div>';
    }

    // ── CONTENIDO POR ROL ─────────────────────────────────────
    var html = '';
    var tieneActividad = false;

    // ── VECINO ────────────────────────────────────────────────
    if (tipo === 'vecino') {
      html += secLabel('¿Qué necesitas hoy?');
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 14px;margin-bottom:16px;">'
        + modulo('🍽️','#FDECEA','Pedir Comida','<span id="hm-mod-food">...</span>',"go('v-food','right')")
        + modulo('🔧','#e8f5e1','Servicios','<span id="hm-mod-serv">...</span>',"go('v-servicios','right')")
        + modulo('🚗','#F0F0F0','Ride','Próximamente',"window._dcProximamente('Ride estará disponible próximamente.')")
        + modulo('🏪','#E3F0FF','Plaza Online','<span id="hm-mod-plaza">...</span>',"go('v-plaza','right')")
        + '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px;margin-bottom:18px;">'
        + chip('📰','Informa', "window.marcarModuloVisto('informa');go('v-informa','right')", 'informa')
        + chip('🎪','Eventos', "go('v-eventos','right')")
        + chip('🚨','Seguridad',"go('v-seguridad','right')")
        + chip('❤️','Favoritos',"go('v-favoritos','right');setTimeout(cargarFavoritos,400)")
        + '</div>';

      html += descubrimiento(tieneActividad);
      html += secLabel('Actividad reciente');
      html += '<div id="home-actividad" style="padding:0 14px;">'
        + '<div style="background:#F5F6F0;border-radius:14px;padding:14px;text-align:center;border:.5px solid #e0e0e0;">'
        + '<div style="font-size:22px;margin-bottom:6px;">📋</div>'
        + '<div style="font-size:12px;font-weight:700;color:#222;margin-bottom:4px;">Sin actividad aún</div>'
        + '<div style="font-size:11px;color:#999;">Tus pedidos y servicios aparecerán aquí</div>'
        + '</div></div>';
      // Actualizar contadores reales en diferido (no bloquea render)
      setTimeout(function(){ _actualizarContadoresHome(); }, 300);
    }

    // ── PROVEEDOR ─────────────────────────────────────────────
    else if (tipo === 'proveedor') {
      html += secLabel('Operación');
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:0 14px;margin-bottom:18px;">'
        + modulo('📋','#FFF8DC','Solicitudes','Ver pedidos',
            "window.marcarModuloVisto('solicitudes');go('v-reportes-disponibles','right');setTimeout(function(){window.cargarReportesDisponibles&&window.cargarReportesDisponibles();},300)",
            'solicitudes')
        + modulo('💬','#e8f5e1','Mis Chats','Mensajes activos',
            "window.marcarModuloVisto('chats');go('v-mis-chats','right');setTimeout(cargarMisChats,200)",
            'chats')
        + modulo('🔧','#FFF8DC','Mi Servicio','Editar perfil',"go('v-mipanel','right')")
        + '</div>';


      // Banner CMV — igual estilo que otros banners del home
      html += '<div onclick="go(\'v-prov-cmv\',\'right\');setTimeout(window.vprovCmvCargar,200)" style="margin:0 14px 14px;background:linear-gradient(120deg,#0d3d24,#1a6640);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;cursor:pointer;box-shadow:0 4px 18px rgba(31,194,106,.25);">'
        + '<div style="width:48px;height:48px;border-radius:13px;background:rgba(31,194,106,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:26px;">👁</div>'
        + '<div style="flex:1;"><div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:2px;">Cómo me ve el cliente</div><div style="font-size:11px;color:rgba(255,255,255,.65);">Foto · descripción · galería de trabajos</div></div>'
        + '<div style="color:rgba(255,255,255,.5);font-size:20px;">›</div>'
        + '</div>';

      // Accesos rápidos proveedor
      html += secLabel('Accesos rápidos');
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px;margin-bottom:18px;">'
        + chip('📰','Informa', "window.marcarModuloVisto('informa');go('v-informa','right')", 'informa')
        + chip('🎪','Eventos', "go('v-eventos','right')")
        + chip('🚨','Seguridad', "go('v-seguridad','right')")
        + chip('📅','Agenda', "go('v-agenda','right');setTimeout(function(){window._renderAgenda&&window._renderAgenda();},100)")
        + '</div>';

      html += descubrimiento(tieneActividad);
      html += secLabel('Actividad reciente');
      html += '<div id="home-actividad" style="padding:0 14px;">'
        + '<div style="background:#FFFDF5;border-radius:14px;padding:14px;text-align:center;border:.5px solid #f0e8c0;">'
        + '<div style="font-size:22px;margin-bottom:6px;">📋</div>'
        + '<div style="font-size:12px;font-weight:700;color:#7a5000;margin-bottom:4px;">Sin solicitudes nuevas</div>'
        + '<div style="font-size:11px;color:#999;">Cuando lleguen pedidos aparecerán aquí</div>'
        + '</div></div>';
    }

    // ── TRANSPORTE / REPARTIDOR ───────────────────────────────
    else if (['transporte','repartidor','ambos'].includes(tipo)) {
      html += secLabel('Mi operación');
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:0 14px;margin-bottom:18px;">'
        + modulo('🗺️','#E8F0F8','Mi Cobertura','Modulo en pausa',"window._dcProximamente('El módulo Ride está temporalmente en pausa.')")
        + modulo('💬','#E8F0F8','Mis Chats','Mensajes',
            "window.marcarModuloVisto('chats');go('v-mis-chats','right');setTimeout(cargarMisChats,200)",
            'chats')
        + modulo('📋','#E8F0F8','Solicitudes','Pedidos disp.',
            "window.marcarModuloVisto('solicitudes');window.irASolicitudes&&window.irASolicitudes()",
            'solicitudes')
        + modulo('📊','#E8F0F8','Estadísticas','Mi semana',"go('v-mipanel','right')")
        + '</div>';

      html += '<div style="margin:0 14px 18px;background:linear-gradient(120deg,#0A3055,#1A7AB5);border-radius:14px;padding:13px 14px;display:flex;align-items:center;gap:12px;">'
        + '<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚗</div>'
        + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">$0.00 hoy</div><div style="font-size:10px;color:rgba(255,255,255,.65);">Ganancias del día · Dominio Cumbres</div></div>'
        + '<div style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.15);border-radius:20px;padding:3px 9px;"><div style="width:6px;height:6px;border-radius:50%;background:#1FC26A;"></div><span style="font-size:10px;color:#fff;font-weight:700;">En línea</span></div>'
        + '</div>';

      html += descubrimiento(tieneActividad);
      html += secLabel('Actividad reciente');
      html += '<div id="home-actividad" style="padding:0 14px;">'
        + '<div style="background:#F5F8FC;border-radius:14px;padding:14px;text-align:center;border:.5px solid #c0d4e8;">'
        + '<div style="font-size:22px;margin-bottom:6px;">🚗</div>'
        + '<div style="font-size:12px;font-weight:700;color:#0A3055;margin-bottom:4px;">Sin viajes hoy</div>'
        + '<div style="font-size:11px;color:#999;">Activa tu disponibilidad para recibir solicitudes</div>'
        + '</div></div>';
    }

    // ── RESTAURANTE ───────────────────────────────────────────
    else if (tipo === 'restaurante') {
      // Estado operativo clicable → abre vr-shell (Centro Operativo) en config
      var estKey2 = window.getEstadoEfectivoActual ? window.getEstadoEfectivoActual() : (window.getEstadoOperativo ? window.getEstadoOperativo() : 'activo');
      var estCfg2 = DC_ESTADOS[estKey2] || DC_ESTADOS.activo;
      html += '<div onclick="go(\'vr-config\',\'right\')" style="margin:0 14px 14px;background:'+estCfg2.bg+';border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;border:1px solid '+estCfg2.col+'22;">'
        + '<div style="width:10px;height:10px;border-radius:50%;background:'+estCfg2.col+';flex-shrink:0;box-shadow:0 0 6px '+estCfg2.col+'88;"></div>'
        + '<div style="flex:1;font-size:13px;font-weight:700;color:'+estCfg2.col+';">'+estCfg2.ic+' '+estCfg2.lbl+'</div>'
        + '<div style="font-size:11px;color:'+estCfg2.col+';opacity:.7;">Toca para cambiar ›</div>'
        + '</div>';

      // Métricas HOY reales: Pedidos · Ventas · Calificación (se llenan tras render)
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 14px;margin-bottom:18px;">'
        + '<div id="card-poraceptar" onclick="window._irPedidosRestTab&&window._irPedidosRestTab(\'pedidos\')" class="rhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-poraceptar" style="font-size:20px;font-weight:800;color:#c8940a;">0</div><div style="font-size:9px;color:#999;">🔴 Por aceptar</div></div>'
        + '<div id="card-pedidoshoy" class="rhome-card" style="background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-pedidos" style="font-size:20px;font-weight:800;color:#c8940a;">0</div><div style="font-size:9px;color:#999;">Pedidos hoy</div></div>'
        + '<div id="card-enproceso" onclick="window._irPedidosRestTab&&window._irPedidosRestTab(\'en_proceso\')" class="rhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-enproceso" style="font-size:20px;font-weight:800;color:#c8940a;">0</div><div style="font-size:9px;color:#999;">👨‍🍳 En proceso</div></div>'
        + '</div>';

      // Botón principal CENTRO OPERATIVO
      html += '<div style="padding:0 14px;margin-bottom:16px;">'
        + '<button onclick="go(\'vr-home\',\'right\')" '
        + 'style="width:100%;background:linear-gradient(135deg,#6B4200,#c8940a);border:none;border-radius:16px;padding:18px 14px;font-size:16px;font-weight:800;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 20px rgba(200,148,10,.35);letter-spacing:.3px;">'
        + '<span style="font-size:22px;">🚀</span> CENTRO OPERATIVO'
        + '</button>'
        + '</div>';

      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px;margin-bottom:18px;">'
        + chip('📰','Informa', "window.marcarModuloVisto('informa');go('v-informa','right')", 'informa')
        + chip('🎪','Eventos', "go('v-eventos','right')")
        + chip('🚨','Seguridad', "go('v-seguridad','right')")
        + chip('📊','Ventas', "go('vr-home','right');setTimeout(function(){navTo&&navTo('vr-ventas');},80)")
        + '</div>';


      html += descubrimiento(tieneActividad);
      html += secLabel('Actividad reciente');
      html += '<div id="home-actividad" style="padding:0 14px;">'
        + '<div style="background:#FDF5F5;border-radius:14px;padding:14px;text-align:center;border:.5px solid #f0c8c8;">'
        + '<div style="font-size:22px;margin-bottom:6px;">📋</div>'
        + '<div style="font-size:12px;font-weight:700;color:#7A1810;margin-bottom:4px;">Sin pedidos nuevos</div>'
        + '<div style="font-size:11px;color:#999;">Los pedidos del día aparecerán aquí</div>'
        + '</div></div>';
    }

    // ── NEGOCIO ─────────────────────────
  else if (tipo === 'negocio') {
    // Usar _vnegEstadoOp directamente — es la variable del módulo negocio, ya cargada
    // desde Firebase en el login. Evita leer dcRestOpV2 compartido que puede tener
    // el estado del restaurante u otro usuario anterior.
    var _vnegMan = (typeof _vnegEstadoOp !== 'undefined' ? _vnegEstadoOp : null)
                   || (window.getEstadoOperativo ? window.getEstadoOperativo() : 'activo')
                   || 'activo';
    var estManN = window._normEstadoOp ? window._normEstadoOp(_vnegMan) : _vnegMan;
    // El horario del negocio manda: calcular efectivo con VNEG_HORARIOS
    var estKeyN = estManN;
    if (window._estadoEfectivoDe && typeof VNEG_HORARIOS !== 'undefined') {
      try { estKeyN = window._estadoEfectivoDe(estManN, (typeof _vnegEstadoOpTs !== 'undefined' ? _vnegEstadoOpTs : 0), VNEG_HORARIOS); } catch(e){}
    }
    var estCfgN = DC_ESTADOS[estKeyN] || DC_ESTADOS.activo;
    html += '<div onclick="go(\'vn-config\',\'right\')" style="margin:0 14px 14px;background:'+(estCfgN.bg||'#F0EBF8')+';border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;">'
      + '<div style="width:10px;height:10px;border-radius:50%;background:'+estCfgN.col+';flex-shrink:0;"></div>'
      + '<div style="flex:1;font-size:13px;font-weight:700;color:'+estCfgN.col+';">'+estCfgN.ic+' '+estCfgN.lbl+'</div>'
      + '<div style="font-size:11px;color:'+estCfgN.col+';opacity:.7;">Toca para cambiar ›</div>'
      + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 14px;margin-bottom:16px;">'
      + '<div id="vncard-poraceptar" onclick="window._irPedidosNegTab&&window._irPedidosNegTab(\'pedidos\')" class="vnhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="vnhome-poraceptar" style="font-size:20px;font-weight:800;color:#7B3FA0;">0</div><div style="font-size:9px;color:#999;">\ud83d\udfe3 Por aceptar</div></div>'
      + '<div id="vncard-pedidoshoy" class="vnhome-card" style="background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="vnhome-pedidos" style="font-size:20px;font-weight:800;color:#7B3FA0;">0</div><div style="font-size:9px;color:#999;">Pedidos hoy</div></div>'
      + '<div id="vncard-enproceso" onclick="window._irPedidosNegTab&&window._irPedidosNegTab(\'en_proceso\')" class="vnhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="vnhome-enproceso" style="font-size:20px;font-weight:800;color:#7B3FA0;">0</div><div style="font-size:9px;color:#999;">\ud83d\udce6 En proceso</div></div>'
      + '</div>';
    html += '<div style="padding:0 14px;margin-bottom:16px;">'
      + '<button onclick="go(\'vn-home\',\'right\')" style="width:100%;background:linear-gradient(135deg,#4A1A70,#7B3FA0);border:none;border-radius:16px;padding:16px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;">'
      + '<span style="font-size:22px;">\ud83d\ude80</span> CENTRO OPERATIVO'
      + '</button>'
      + '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 14px;margin-bottom:18px;">'
      + chip('\ud83d\udcf0','Informa', "window.marcarModuloVisto('informa');go('v-informa','right')", 'informa')
      + chip('\ud83c\udfaa','Eventos', "go('v-eventos','right')")
      + chip('\ud83d\udea8','Seguridad', "go('v-seguridad','right')")
      + chip('\ud83d\udcca','Ventas', "go('vn-home','right');setTimeout(function(){negTo&&negTo('vn-ventas');},80)")
      + '</div>';


    html += descubrimiento(tieneActividad);
    html += secLabel('Actividad reciente');
    html += '<div id="home-actividad" style="padding:0 14px;">'
      + '<div style="background:#F8F5FC;border-radius:14px;padding:14px;text-align:center;border:.5px solid #EADDF5;">'
      + '<div style="font-size:22px;margin-bottom:6px;">📋</div>'
      + '<div style="font-size:12px;font-weight:700;color:#4A1A70;margin-bottom:4px;">Sin actividad nueva</div>'
      + '<div style="font-size:11px;color:#999;">Las solicitudes del día aparecerán aquí</div>'
      + '</div></div>';
  }

    else {
      html += '<div id="home-actividad" style="padding:0 14px;"></div>';
    }

    html += '<div style="height:14px;"></div>';
    scroll.innerHTML = html;
    if (_adsWrap) { _adsWrap.style.display = ''; var _adIdx = (tipo==='restaurante'||tipo==='negocio') ? 3 : 2; var _ref = scroll.children[_adIdx]; _ref ? scroll.insertBefore(_adsWrap, _ref) : scroll.appendChild(_adsWrap); }
    // M2-G: poblar descubrimiento si el contenedor fue inyectado
    window.renderDescubrimiento && window.renderDescubrimiento('home-discover-list');
    // Actualizar nav inferior según rol del operador
    var nav = document.getElementById('v-home-nav') || document.querySelector('#v-home .nav');
    if (nav) {
      if (tipo === 'restaurante') {
        nav.innerHTML =
          '<div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb on">Inicio</div></div>'
          + '<div class="ni" onclick="go(\'vr-home\',\'right\');navTo&&navTo(\'vr-pedidos\')">'
          + '<div class="ni-ic">📦</div><div class="ni-lb">Pedidos</div></div>'
          + '<div class="ni" onclick="go(\'vr-home\',\'right\');setTimeout(function(){navTo&&navTo(\'vr-menu\');},80)">'
          + '<div class="ni-ic">✏️</div><div class="ni-lb">Menú</div></div>'
          + '<div class="ni" onclick="go(\'vr-home\',\'right\');setTimeout(function(){navTo&&navTo(\'vr-notif\');},80)">'
          + '<div class="ni-ic">🔔</div><div class="ni-lb">Alertas</div></div>'
          + '<div class="ni" onclick="go(\'v-mipanel\',\'right\')">'
          + '<div class="ni-ic">👤</div><div class="ni-lb">Mi Panel</div></div>';
      } else if (tipo === 'negocio') {
        nav.innerHTML =
          '<div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb on">Inicio</div></div>'
          + '<div class="ni" onclick="go(\'vn-home\',\'right\');setTimeout(function(){negTo&&negTo(\'vn-pedidos\');},80)">'
          + '<div class="ni-ic">📦</div><div class="ni-lb">Pedidos</div></div>'
          + '<div class="ni" onclick="go(\'vn-home\',\'right\');setTimeout(function(){negTo&&negTo(\'vn-menu\');},80)">'
          + '<div class="ni-ic">✏️</div><div class="ni-lb">Productos</div></div>'
          + '<div class="ni" onclick="go(\'v-mipanel\',\'right\')">'
          + '<div class="ni-ic">👤</div><div class="ni-lb">Mi Panel</div></div>';
      } else if (tipo === 'proveedor') {
        nav.innerHTML =
          '<div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb on">Inicio</div></div>'
          + '<div class="ni" onclick="go(\'v-mis-chats\',\'right\');setTimeout(cargarMisChats,200)">'
          + '<div class="ni-ic">💬</div><div class="ni-lb">Chats</div></div>'
          + '<div class="ni" onclick="go(\'v-mis-reportes\',\'right\');setTimeout(function(){window.cargarMisReportes&&window.cargarMisReportes();},300)">'
          + '<div class="ni-ic">📋</div><div class="ni-lb">Solicitudes</div></div>'
          + '<div class="ni" onclick="go(\'v-mipanel\',\'right\')">'
          + '<div class="ni-ic">👤</div><div class="ni-lb">Mi Panel</div></div>';
      } else {
        nav.innerHTML =
          '<div class="ni"><div class="ni-ic">🏠</div><div class="si04 ni-lb">Inicio</div></div>'
          + '<div class="ni" onclick="var _t=(localStorage.getItem(\'dcuserTipo\')||\'vecino\').toLowerCase();go(_t===\'vecino\'?\'v-mis-pedidos-food\':\'vr-pedidos\',\'right\')">'
          + '<div class="notif-w"><div class="ni-ic">🍽️</div><span class="notif-dot nav-ped-dot" style="display:none;"></span></div><div class="ni-lb">Pedidos</div></div>'
          + '<div class="ni" onclick="go(\'v-mis-compras-plaza\',\'right\')"><div class="ni-ic">🛍️</div><div class="ni-lb">Mis Compras</div></div>'
          + '<div class="ni" onclick="go(\'v-mi-agenda\',\'right\');setTimeout(function(){window._renderMiAgenda&&window._renderMiAgenda();},200);"><div class="notif-w"><div class="ni-ic">📅</div><span class="notif-dot nav-agenda-dot" style="display:none;"></span></div><div class="ni-lb">Reservaciones</div></div>'
          + '<div class="ni" onclick="go(\'v-mipanel\',\'right\')"><div class="ni-ic">👤</div><div class="ni-lb">Mi Panel</div></div>';
      }
    }
  };

// ══════════════════════════════════════════════════════════════
// EXTRAÍDO DE firebase.js — lógica UI/negocio movida al módulo correcto
// ══════════════════════════════════════════════════════════════
  // Abrir detalle de proveedor con datos reales
  window.abrirDetalleProveedor = function(p) {
    window._proveedorActual = p;
    const ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
    const cat = (p.categoria||'otro').toLowerCase();
    document.getElementById('det-ic').textContent      = ICONOS[cat]||'🔧';
    document.getElementById('det-nombre').textContent  = p.nombre || '—';
    document.getElementById('det-badge').textContent   = p.membresia==='premium' ? '💎 Premium' : '✅ Verificado';
    document.getElementById('det-badge').style.background = p.membresia==='premium' ? 'var(--yellow-light)' : '#E8F5EE';
    document.getElementById('det-badge').style.color   = p.membresia==='premium' ? '#9A6800' : '#0A4220';
    document.getElementById('det-cat').textContent     = p.categoria ? '🔧 '+p.categoria : '';
    document.getElementById('det-tel').textContent     = p.telefono ? '📞 '+p.telefono : '';
    document.getElementById('det-desc').textContent    = p.descripcion || 'Proveedor verificado de Dominio Cumbres.';
    document.getElementById('det-correo').textContent  = p.correo ? '✉️ '+p.correo : '';
    document.getElementById('det-tel2').textContent    = p.telefono ? '📞 '+p.telefono : '';
    // M2-H: registrar como reciente y actualizar botón favorito
    window.addReciente && window.addReciente(p);
    var btn = document.getElementById('det-fav-btn');
    if (btn) {
      var pid = p._id || p.id || p.uid || p.nombre;
      var _isF = window.isFav && window.isFav(pid);
      btn.textContent = _isF ? '❤️' : '🤍';
    }
    // M2-J: cargar agenda del proveedor (clave por su uid)
    window._cargarAgendaProveedor(p);
    go('v-serv-det','right');
    setTimeout(function(){ window.dcProvRatingCargar && window.dcProvRatingCargar(p.uid||p._id||p.id||''); }, 250);
  };

  // M2-J: leer agenda del proveedor y mostrar disponibilidad en v-serv-det
  window._cargarAgendaProveedor = async function(p) {
    var block   = document.getElementById('det-agenda-block');
    var elEst   = document.getElementById('det-agenda-estado');
    var elDias  = document.getElementById('det-agenda-dias');
    var elHors  = document.getElementById('det-agenda-horarios');
    if (!block) return;

    var pid = p._id || p.id || p.uid || p.nombre || '';

    // 1. Intentar localStorage primero (mismo dispositivo, sin latencia)
    var ag = null;
    if (pid) {
      try { ag = JSON.parse(localStorage.getItem('dcAgenda_' + pid) || 'null'); } catch(e) {}
    }

    // 2. Si no hay en localStorage, leer Firestore agendas/{pid}
    if ((!ag || !ag.horarios || !ag.horarios.length) && pid && window._fbDb) {
      try {
        var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
        var snap = await _fb.getDoc(_fb.doc(window._fbDb, 'agendas', pid));
        if (snap.exists()) ag = snap.data();
      } catch(e) { }
    }

    // No mostrar bloque si no hay agenda o no hay horarios
    if (!ag || !ag.horarios || !ag.horarios.length) {
      block.style.display = 'none';
      return;
    }

    block.style.display = 'block';
    var pausado = ag.estado === 'pausado';

    if (elEst) {
      elEst.textContent = pausado ? '⏸ Temporalmente no disponible' : '✅ Disponible para reservas';
      elEst.style.color = pausado ? '#D63A2A' : '#1FC26A';
    }

    var DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    if (elDias) {
      if (ag.dias && ag.dias.length) {
        elDias.innerHTML = '<div style="display:flex;gap:5px;flex-wrap:wrap;">'
          + ag.dias.map(function(i){ return '<span style="background:#e8f5e1;color:#1FC26A;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">' + (DIAS[i]||i) + '</span>'; }).join('')
          + '</div>';
      } else { elDias.innerHTML = ''; }
    }

    if (elHors) {
      elHors.innerHTML = ag.horarios.map(function(h) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:.5px solid #e8f0e8;">'
          + '<span style="font-size:12px;color:#1FC26A;">🕐</span>'
          + '<span style="font-size:12px;font-weight:600;color:#111;">' + h.inicio + ' – ' + h.fin + '</span>'
          + (h.nota ? '<span style="font-size:10px;color:#888;">· ' + h.nota + '</span>' : '')
          + '</div>';
      }).join('');
    }

    // Ocultar botón Reservar si pausado
    var btnReservar = block.querySelector('button');
    if (btnReservar) btnReservar.style.display = pausado ? 'none' : 'block';

    // Guardar referencia a agenda para v-reservar
    window._agendaProveedorActual = ag;
  };

  // ===== CATÁLOGO OFICIAL DE OFICIOS =====
  const _DC_OFICIOS_CATALOGO = [
    {key:'plomero',     label:'Plomero',     ic:'💧'},
    {key:'electricista',label:'Eléctrico',   ic:'⚡'},
    {key:'jardinero',   label:'Jardín',      ic:'🌿'},
    {key:'limpieza',    label:'Limpieza',    ic:'🧹'},
    {key:'pintura',     label:'Pintura',     ic:'🎨'},
    {key:'ac',          label:'A/C',         ic:'❄️'},
    {key:'cerrajero',   label:'Cerrajero',   ic:'🔒'},
    {key:'mascotas',    label:'Mascotas',    ic:'🐾'},
    {key:'tecnologia',  label:'Tecnología',  ic:'🖥️'},
    {key:'belleza',     label:'Belleza',     ic:'💆'},
    {key:'albanileria', label:'Albañilería', ic:'🧱'},
    {key:'otro',        label:'Otro',        ic:'🔧'},
  ];

  // ===== REDEFINIR cargarProveedores con acceso directo a window._fbDb =====
  // (sobreescribe la versión en el script no-module que no puede acceder a window._fbDb)
  window.cargarProveedores = async function(categoria) {
    const lista = document.getElementById('servicios-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si24">Cargando proveedores... ⏳</div>';
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const q = query(collection(window._fbDb,'usuarios'), where('tipo','==','proveedor'));
      const snap = await getDocs(q);
      const docs = [];
      snap.forEach(d => {
        const p = d.data();
        if(['activo','aprobado'].indexOf(p.estado) !== -1) docs.push({id: d.id, ...p});
      });
      // Impulsa primero
      docs.sort((a,b) => {
        const ai = (window._planEsImpulsa && window._planEsImpulsa(a)) ? 0 : 1;
        const bi = (window._planEsImpulsa && window._planEsImpulsa(b)) ? 0 : 1;
        return ai - bi;
      });
      const filtro = (categoria || 'todos').toLowerCase();
      // Actualizar el select desplegable
      const sel = document.getElementById('cat-sel-servicios');
      if(sel) sel.value = filtro;
      const visibles = filtro === 'todos' ? docs : docs.filter(p => {
        return [p.oficio1, p.oficio2, p.oficio3, p.categoria]
          .some(o => (o||'').toLowerCase() === filtro);
      });
      if(visibles.length === 0) {
        lista.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:10px;">🔧</div><div class="si33">'+(filtro==='todos'?'Próximamente':'Sin resultados')+'</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">'+(filtro==='todos'?'Los primeros proveedores se están registrando':'No hay proveedores para esta especialidad')+'</div></div>';
        return;
      }
      lista.innerHTML = '';
      const ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
      const BGS    = {plomero:'#E8F0F8',electricista:'#FFF8E1',jardinero:'#E8F5EE',limpieza:'#F0EBF8',pintura:'#FDECEA',ac:'#E8F0F8',cerrajero:'#FFF8E1',otro:'#E8F5EE'};
      visibles.forEach(p => {
        const cat = (p.oficio1 || p.categoria || 'otro').toLowerCase();
        const ic  = ICONOS[cat]||'🔧';
        const bg  = BGS[cat]||'#E8F5EE';
        const esImpulsa = window._planEsImpulsa && window._planEsImpulsa(p);
        const cnt  = p.ratingTotal || 0;
        const prom = p.ratingPromedio || 0;
        const ratingHtml = cnt > 0
          ? `⭐ ${prom} <span onclick="event.stopPropagation();window.dcRatingVerComentarios&&window.dcRatingVerComentarios('${p.id}','proveedor',event)" style="color:var(--blue,#1a6fbf);text-decoration:underline;cursor:pointer;font-weight:700;">(${cnt} opinión${cnt>1?'es':''})</span>`
          : 'Nuevo';
        const div = document.createElement('div');
        div.className = 'prov-card';
        if (esImpulsa) div.style.cssText += 'border:1.5px solid #F5C518;box-shadow:0 2px 12px rgba(245,197,24,.18);';
        div.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div class="prov-av" style="background:${bg};">${ic}<div class="prov-badge" style="background:${esImpulsa?'#F5C518':'var(--green)'};">${esImpulsa?'⭐':'✓'}</div></div>
            <div class="si03">
              <div class="si17">${window.dcEscHTML(p.nombre||'—')}</div>
              <div class="si01">${window.dcEscHTML(p.descripcion||p.oficio1||p.categoria||'Proveedor')}</div>
              <div class="si59">★ ${ratingHtml}</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
            ${esImpulsa?'<span class="tag tag-y">⭐ Impulsa</span>':''}
            <span class="tag tag-g">✅ Verificado</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:.5px solid #f0f0f0;">
            <span class="si16">${window.dcEscHTML(p.precio||'Consultar precio')}</span>
            <span style="font-size:11px;font-weight:700;color:var(--green);">Disponible</span>
          </div>`;
        div.onclick = () => abrirDetalleProveedor(p);
        lista.appendChild(div);
      });
    } catch(e) {
      lista.innerHTML = '<div class="si60">Error: '+e.message+'</div>';
    }
  };

  // ===== CARGAR SOLICITUDES =====
  window.cargarSolicitudes = async function() {
    const lista = document.getElementById('admin-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si61">Cargando... ⏳</div>';
    try {
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(window._fbDb, 'usuarios'));
      window._todosUsuarios = [];
      snap.forEach(d => { const u = d.data(); u._id = d.id; window._todosUsuarios.push(u); });
      // Recalcular badge de pendientes en tiempo real
      const _pend = window._todosUsuarios.filter(u => u.estado === 'pendiente_revision').length;
      const _nb = document.getElementById('notif-solicitudes');
      const _sc = document.getElementById('stat-pendientes-count');
      if(_nb){ if(_pend>0){_nb.textContent=_pend;_nb.style.display='flex';}else{_nb.style.display='none';} }
      if(_sc) _sc.textContent = _pend;
      if(window.aplicarFiltros) window.aplicarFiltros();
    } catch(e) {
      lista.innerHTML = '<div class="si60">Error: '+e.message+'</div>';
    }
  };

  // ===== CARGAR MI PERFIL REAL =====
  // ── M2-B: cargarMiPerfil — panel unificado por rol ──────────
  // Escribe en #mp2-scroll. Absorbe Mi Perfil. Sin duplicidad.
  window.cargarMiPerfil = async function() {
    var scroll = document.getElementById('mp2-scroll');
    var subtitle = document.getElementById('mp2-subtitle');
    var estadoBadge = document.getElementById('mp2-estado-badge');
    if (!scroll) return;

    var tipo   = (localStorage.getItem('dcuserTipo')   || 'vecino').toLowerCase();
    var nombre = localStorage.getItem('dcuser') || 'Usuario';

    // Mostrar estado operativo en badge del header inmediatamente (no esperar Firebase)
    if (tipo !== 'vecino' && estadoBadge) {
      var _estNow = window.getEstadoEfectivoActual ? window.getEstadoEfectivoActual() : window.getEstadoOperativo();
      var _cfgNow = DC_ESTADOS[_estNow] || DC_ESTADOS.activo;
      estadoBadge.textContent = _cfgNow.ic + ' ' + _cfgNow.lbl;
      estadoBadge.style.background = _cfgNow.bg;
      estadoBadge.style.color = _cfgNow.col;
      estadoBadge.style.display = 'inline-flex';
    }

    var LABELS = { vecino:'Vecino', proveedor:'Proveedor', transporte:'Transporte',
                   repartidor:'Repartidor', ambos:'Transporte / Repartidor',
                   restaurante:'Restaurante', negocio:'Negocio' };
    var COLORES = { vecino:'#1FC26A', proveedor:'#F5C518', transporte:'#1A7AB5',
                    repartidor:'#1A7AB5', ambos:'#1A7AB5', restaurante:'#D63A2A', negocio:'#7B3FA0' };
    var color = COLORES[tipo] || '#1FC26A';

    if (subtitle) subtitle.textContent = LABELS[tipo] || tipo;

    // Helpers de layout
    var SEC = function(t) {
      return '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;padding:16px 18px 8px;">'+t+'</div>';
    };
    var CARD = function(inner) {
      return '<div style="background:#fff;border-radius:16px;padding:14px 16px;border:.5px solid #e8e8e8;margin:0 14px 12px;">'+inner+'</div>';
    };
    var ROW = function(lbl, val, id) {
      var v = (val === null || val === undefined || val === '') ? '—' : String(val);
      var idAttr = id ? ' id="'+id+'"' : '';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:.5px solid #f5f5f5;">'
        + '<span style="font-size:12px;color:#888;font-weight:600;flex-shrink:0;margin-right:12px;">'+lbl+'</span>'
        + '<span'+idAttr+' style="font-size:13px;color:#111;font-weight:500;text-align:right;word-break:break-word;">'+v+'</span>'
        + '</div>';
    };
    var ROWLAST = function(lbl, val, id) {
      // Same as ROW but no bottom border
      return ROW(lbl, val, id).replace('border-bottom:.5px solid #f5f5f5;','');
    };
    var METRIC = function(num, lbl, id) {
      return '<div style="flex:1;text-align:center;padding:10px 4px;">'
        + '<div style="font-size:22px;font-weight:700;color:'+color+';" '+(id?'id="'+id+'"':'')+'>'+num+'</div>'
        + '<div style="font-size:10px;color:#888;margin-top:2px;">'+lbl+'</div>'
        + '</div>';
    };
    var ACCION = function(ic, lbl, onclick) {
      return '<div onclick="'+onclick+'" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:.5px solid #f5f5f5;cursor:pointer;" ontouchstart="this.style.background=\'#f8f8f8\'" ontouchend="this.style.background=\'#fff\'">'
        + '<span style="font-size:13px;font-weight:600;color:#111;">'+ic+' '+lbl+'</span>'
        + '<span style="font-size:16px;color:#ccc;">›</span>'
        + '</div>';
    };
    var ACCION_LAST = function(ic, lbl, onclick, col) {
      col = col || '#111';
      return '<div onclick="'+onclick+'" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" ontouchstart="this.style.background=\'#f8f8f8\'" ontouchend="this.style.background=\'#fff\'">'
        + '<span style="font-size:13px;font-weight:600;color:'+col+';">'+ic+' '+lbl+'</span>'
        + '<span style="font-size:16px;color:#ccc;">›</span>'
        + '</div>';
    };

    // Mostrar estructura inmediata con placeholders
    var html = '';

    // ── 1. RESUMEN (métricas placeholder, Firebase las rellena) ──
    html += SEC('Resumen');
    if (tipo === 'vecino') {
      html += CARD(
        '<div style="display:flex;">'
        + METRIC('0', 'Pedidos', 'panel-pedidos')
        + METRIC('$0', 'Gastado este mes', 'panel-gastado')
        + '<div style="flex:1;text-align:center;padding:10px 4px;cursor:pointer;" onclick="go(\'v-favoritos\',\'right\')">'
        + '<div style="font-size:22px;font-weight:700;color:'+color+';" id="panel-favs">0</div>'
        + '<div style="font-size:10px;color:#1a6fbf;margin-top:2px;text-decoration:underline;">Favoritos</div>'
        + '</div>'
        + '</div>'
      );
    } else {
      html += CARD(
        '<div style="display:flex;">'
        + METRIC('0', 'Solicitudes', 'panel-pedidos')
        + METRIC('0', 'Chats activos', 'panel-chats')
        + METRIC('—', 'Reputación', 'panel-rep')
        + '</div>'
      );
    }

    // ── 2. MI INFORMACIÓN ──────────────────────────────────────
    html += SEC('Mi información');
    html += '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:0 14px 12px;overflow:hidden;">'
      + ROW('Nombre', nombre, 'panel-nombre')
      + ROW('Correo', '—', 'panel-correo')
      + ROW('Usuario', '—', 'panel-usuario')
      + ROW('Teléfono', '—', 'panel-tel')
      + ROWLAST('Zona', '—', 'panel-frac')
      + '</div>';

    // ── 3. MI SERVICIO / NEGOCIO (solo no-vecino) ──────────────
    if (tipo !== 'vecino') {
      var secTit = tipo === 'restaurante' ? 'Mi restaurante'
                 : tipo === 'negocio'     ? 'Mi negocio'
                 : ['transporte','repartidor','ambos'].includes(tipo) ? 'Mi vehículo'
                 : 'Mi servicio';
      html += SEC(secTit);
      html += '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:0 14px 12px;overflow:hidden;" id="mp2-servicio">'
        + ROW('Descripción','—','mp2-srv-desc')
        + ROW('Estado de cuenta','—','mp2-srv-estado')
        + ROWLAST('Dirección del negocio','—','mp2-srv-dir')
        + '</div>';
      // Campo editable para guardar/actualizar dirección
      if (tipo === 'restaurante' || tipo === 'negocio') {
        html += '<div style="margin:0 14px 12px;display:flex;gap:8px;">'
          + '<input id="mp2-dir-input" class="inp" style="flex:1;font-size:12px;" placeholder="Ej: Av. Paseo 123, Col. Cumbres">'
          + '<button onclick="window._guardarDireccionNegocio()" style="padding:9px 14px;background:var(--green);color:#fff;border:none;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0;">Guardar</button>'
          + '</div>';
      }
    }

    // ── 4. ACTIVIDAD ───────────────────────────────────────────
    html += SEC('Actividad reciente');
    html += '<div id="panel-actividad" style="margin:0 14px 12px;background:#F5F6F0;border-radius:14px;padding:14px;text-align:center;border:.5px solid #e0e0e0;">'
      + '<div style="font-size:20px;margin-bottom:6px;">📋</div>'
      + '<div style="font-size:12px;font-weight:600;color:#444;margin-bottom:4px;" id="mp2-notif-resumen">Cargando actividad…</div>'
      + '<div style="font-size:11px;color:#999;" id="mp2-notif-sub"></div>'
      + '</div>';

    // ── 5. REPUTACIÓN ──────────────────────────────────────────
    if (tipo !== 'vecino') {
      html += SEC('Reputación');
      html += CARD(
        '<div style="display:flex;align-items:center;gap:14px;">'
        + '<div style="width:52px;height:52px;border-radius:50%;background:'+color+'18;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:'+color+';flex-shrink:0;" id="mp2-rep-score">—</div>'
        + '<div style="flex:1;">'
        + '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px;">Puntuación de confianza</div>'
        + '<div style="font-size:11px;color:#888;" id="mp2-rep-frase">Escala 1–10 · Últimos 3 meses pesan 70%</div>'
        + '</div>'
        + '</div>'
      );
    }

    // ── 6. MÉTRICAS ────────────────────────────────────────────
    if (tipo !== 'vecino') {
      html += SEC('Métricas (últimos 7 días)');
      html += CARD(
        '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-vis">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Vistas</div></div>'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-cont">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Contactos</div></div>'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-conv">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Conversiones</div></div>'
        + '</div>'
        + '<div style="font-size:11px;color:#888;line-height:1.45;" id="mp2-met-insight">Estadísticas en tiempo real.</div>'
      );
    }

    // Estado de operación: se gestiona únicamente desde Configuración del Centro Operativo

    html += SEC('Cuenta');
    html += '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:0 14px 12px;overflow:hidden;">';
    if (tipo === 'vecino') {
      html += ACCION('👤','Mi Perfil',"go('v-mi-perfil','right');setTimeout(function(){window.cargarMiPerfilDetalle&&window.cargarMiPerfilDetalle();},300)");
      html += ACCION('❤️','Mis favoritos',"go('v-favoritos','right')");
      html += ACCION('📅','Mi Agenda',"go('v-mi-agenda','right');setTimeout(function(){window._initMiAgenda&&window._initMiAgenda();},200)");
    } else {
      html += ACCION('💳','Métodos de pago',"go('vr-config','right')");
      html += ACCION('⭐','Plan IMPULSA',"go('v-impulsa','right');setTimeout(window.impulsaCargar,200)");
      html += ACCION('📣','Crear promoción',"window.irACrearPromo&&window.irACrearPromo()");
      if (tipo === 'proveedor') {
        html += ACCION('📅','Mis horarios',"go('v-agenda','right');setTimeout(function(){window._renderAgenda&&window._renderAgenda();},100)");
        html += ACCION('📋','Reservas recibidas',"go('v-agenda-reservas','right');setTimeout(function(){window._renderAgendaReservas&&window._renderAgendaReservas();},100)");
        html += ACCION('👁','Cómo me ve el cliente',"go('v-prov-cmv','right');setTimeout(window.vprovCmvCargar,200)");
      }
    }
    html += ACCION('🔔','Notificaciones',"go('v-notificaciones','right');setTimeout(window.renderNotificaciones,300)");
    html += ACCION_LAST('🚪','Cerrar sesión','cerrarSesion()','#D63A2A');
    html += '</div>';

    html += '<div style="height:8px;"></div>';
    scroll.innerHTML = html;

    // Actualizar contador de favoritos con dato real desde localStorage
    var panelFavs = document.getElementById('panel-favs');
    if (panelFavs) panelFavs.textContent = String(window.getFavs ? window.getFavs().length : 0);

    // ── Firebase: poblar campos reales ──────────────────────────
    try {
      var user = window._fbAuth.currentUser;
      if (!user) return;
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDoc(_fb.doc(window._fbDb, 'usuarios', user.uid));
      if (!snap.exists()) return;
      var u = snap.data();

      var set = function(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = (v !== null && v !== undefined && v !== '') ? String(v) : '—';
      };

      set('panel-nombre',  u.nombre || u.nombreNegocio);
      set('panel-correo',  u.correo || user.email);
      set('panel-usuario', u.usuario);
      set('panel-tel',     u.whatsapp || (u.prefijoWhatsapp && u.telefono ? u.prefijoWhatsapp + u.telefono : u.telefono));
      set('panel-frac',    u.fraccionamiento || u.zona);

      // Nombre en header global
      if (u.nombre || u.nombreNegocio) {
        var nombreReal = u.nombre || u.nombreNegocio;
        localStorage.setItem('dcuser', nombreReal);
        document.querySelectorAll('.user-name-display').forEach(function(el){ el.textContent = nombreReal; });
        if (subtitle) subtitle.textContent = (LABELS[u.tipo] || u.tipo || '') + ' · ' + nombreReal;
      }

      // Estado badge
      var estadoMap = {
        activo:'Activo ✓', pendiente_revision:'En revisión', aprobado_pendiente_pago:'Pago pendiente',
        rechazado:'No aprobado', suspendido:'Suspendido'
      };
      var colorEstado = {
        activo:'#1FC26A', pendiente_revision:'#F5C518', aprobado_pendiente_pago:'#1A7AB5',
        rechazado:'#D63A2A', suspendido:'#D63A2A'
      };
      if (u.estado && estadoBadge) {
        // mp2-estado-badge muestra el ESTADO OPERATIVO (no el estado de cuenta)
        var estOp = window.getEstadoEfectivoActual ? window.getEstadoEfectivoActual() : window.getEstadoOperativo();
        var cfgOp = DC_ESTADOS[estOp] || DC_ESTADOS.activo;
        estadoBadge.textContent = cfgOp.ic + ' ' + cfgOp.lbl;
        estadoBadge.style.background = cfgOp.bg;
        estadoBadge.style.color = cfgOp.col;
        estadoBadge.style.display = 'inline-flex';
      }

      // Sección servicio/negocio
      if (tipo !== 'vecino') {
        var srvDesc = u.descripcion || u.oficio1 || u.categoria || '—';
        set('mp2-srv-desc', srvDesc);
        var el = document.getElementById('mp2-srv-estado');
        if (el && u.estado) {
          el.textContent = estadoMap[u.estado] || u.estado;
          el.style.color = '#555';
          el.style.fontWeight = '500';
        }
        // Cargar dirección del negocio si existe
        var elDir = document.getElementById('mp2-srv-dir');
        var inpDir = document.getElementById('mp2-dir-input');
        if (elDir) elDir.textContent = u.direccionNegocio || '—';
        if (inpDir && u.direccionNegocio) inpDir.value = u.direccionNegocio;
        // Re-aplicar estado operativo ahora que el uid está disponible
        // (la primera pasada puede haber usado el fallback por tipo)
        var estReal = window.getEstadoEfectivoActual ? window.getEstadoEfectivoActual() : window.getEstadoOperativo();
        var cfgReal = DC_ESTADOS[estReal] || DC_ESTADOS.activo;
        var elTitle = document.getElementById('mp2-estado-lbl-title');
        if (elTitle) elTitle.textContent = cfgReal.ic + ' ' + cfgReal.lbl;
        var elDesc = document.getElementById('mp2-estado-lbl');
        if (elDesc) { elDesc.textContent = cfgReal.desc; elDesc.style.color = cfgReal.col; }
        var elDot = document.getElementById('mp2-estado-dot');
        if (elDot) elDot.style.background = cfgReal.col;
        var elSel = document.getElementById('mp2-estado-sel');
        if (elSel) elSel.value = estReal;
      }

    } catch(e) { }

    // M2-I: cargar resumen de notificaciones reales para Mi Panel
    window.cargarNotificaciones && window.cargarNotificaciones().then(function(notifs) {
      var noLeidas = notifs.filter(function(n){ return !n.leida; }).length;
      var res = document.getElementById('mp2-notif-resumen');
      var sub = document.getElementById('mp2-notif-sub');
      if (res) res.textContent = noLeidas > 0
        ? noLeidas + ' notificacion' + (noLeidas !== 1 ? 'es' : '') + ' sin leer'
        : 'Sin actividad reciente';
      if (sub) {
        if (notifs.length > 0) {
          var ultima = notifs[0];
          sub.textContent = ultima.titulo || ultima.mensaje || 'Última notificación disponible';
        } else {
          sub.textContent = 'Tus pedidos y servicios aparecerán aquí';
        }
      }
    });
  };
  // ── FIN M2-B cargarMiPerfil ──────────────────────────────────

  // ── cargarMiPerfilDetalle — vista v-mi-perfil (solo lectura por tipo) ──
  window.cargarMiPerfilDetalle = async function() {
    const user = window._fbAuth.currentUser;
    if (!user) return;

    const cont   = document.getElementById('mip-contenido');
    const subtit = document.getElementById('mip-tipo-sub');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--white-50);font-size:13px;">Cargando tu perfil...</div>';

    try {
      const { getDoc, doc: _mipDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDoc(_mipDoc(window._fbDb, 'usuarios', user.uid));
      if (!snap.exists()) {
        cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--white-50);">No se encontraron datos de perfil.</div>';
        return;
      }

      const u = snap.data();
      const tipo = (u.tipo || '').toLowerCase();

      // Helper: field row always shows, empty -> em-dash
      const FR = (label, val) => {
        const v = (val === null || val === undefined || val === '') ? '&#8212;' : window.dcEscHTML(String(val));
        return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:.5px solid #f5f5f5;">'
          + '<span style="font-size:12px;color:#888;font-weight:600;flex-shrink:0;margin-right:12px;">' + label + '</span>'
          + '<span style="font-size:13px;color:var(--text-primary);font-weight:500;text-align:right;word-break:break-word;">' + v + '</span>'
          + '</div>';
      };
      const SEC = t => '<div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin:16px 0 8px;">' + t + '</div>';
      const CARD = inner => '<div style="background:#fff;border-radius:16px;padding:14px 16px;border:.5px solid #e0e0e0;margin-bottom:12px;">' + inner + '</div>';

      const fecha = u.creadoEn ? new Date(u.creadoEn).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'}) : '&#8212;';
      const esRide = ['transporte','repartidor','ambos'].includes(tipo);
      const esNeg  = ['negocio','restaurante'].includes(tipo);
      const esProv = tipo === 'proveedor';

      // Tipo label for subtitle
      const _tipoLabel = {
        'vecino':'Vecino', 'proveedor':'Proveedor de servicios',
        'transporte':'Transporte', 'repartidor':'Repartidor', 'ambos':'Transporte / Repartidor',
        'negocio':'Negocio', 'restaurante':'Restaurante'
      };
      if (subtit) subtit.textContent = _tipoLabel[tipo] || tipo;

      // Estado badge
      const _estadoBadge = (e) => {
        const lbl = {
          'activo':'Activo &#10003;', 'pendiente_revision':'En revisi&#243;n &#8987;',
          'aprobado_pendiente_pago':'Pago pendiente &#128274;',
          'rechazado':'No aprobado &#10060;', 'suspendido':'Suspendido &#128683;'
        };
        const col = {
          'activo':'#1FC26A', 'pendiente_revision':'#F5C518',
          'aprobado_pendiente_pago':'#1A7AB5', 'rechazado':'#D63A2A', 'suspendido':'#D63A2A'
        };
        const ee = (e||'').toLowerCase();
        return '<span style="font-size:12px;font-weight:700;color:'+(col[ee]||'#888')+';">'+(lbl[ee]||window.dcEscHTML(e||'')||'&#8212;')+'</span>';
      };

      let html = '';

      // ── BLOQUE COMUN ────────────────────────────────────────────
      html += SEC('Datos personales');
      if (esNeg) {
        html += CARD(
          FR('Nombre comercial', u.nombreNegocio) +
          FR('Responsable', u.nombre) +
          FR('Usuario', u.usuario) +
          FR('Correo', u.correo) +
          FR('WhatsApp', u.whatsapp || ((u.prefijoWhatsapp && u.telefono) ? u.prefijoWhatsapp + u.telefono : null))
        );
      } else {
        html += CARD(
          FR('Nombre', u.nombre) +
          FR('Usuario', u.usuario) +
          FR('Correo', u.correo) +
          FR('WhatsApp', u.whatsapp || ((u.prefijoWhatsapp && u.telefono) ? u.prefijoWhatsapp + u.telefono : null))
        );
      }

      // ── BLOQUE ESPECIFICO ────────────────────────────────────────
      if (tipo === 'vecino') {
        html += SEC('Mi ubicaci&#243;n');
        html += CARD(
          FR('Zona', u.zona) +
          FR('Fraccionamiento', u.fraccionamiento)
        );

      } else if (esProv) {
        const oficios = [u.oficio1, u.oficio2, u.oficio3].filter(Boolean).join(' &middot; ');
        html += SEC('Mi servicio');
        html += CARD(
          FR('Oficio(s)', oficios) +
          (u.oficiosExtra ? FR('Oficios adicionales', u.oficiosExtra) : '') +
          FR('Descripci&#243;n / Especialidad', u.descripcion) +
          FR('A&#241;os de experiencia', u.experiencia)
        );

      } else if (esRide) {
        const tipoSvcLabel = {'transporte':'Transporte','repartidor':'Repartidor','ambos':'Transporte y Repartidor'};
        html += SEC('Mi veh&#237;culo');
        html += CARD(
          FR('Tipo de servicio', tipoSvcLabel[tipo] || tipo) +
          FR('Veh&#237;culo', [u.tipoVehiculo, u.marca, u.modelo].filter(Boolean).join(' &middot; ')) +
          FR('Color', u.color) +
          FR('Placas', u.placas) +
          FR('Cobertura', u.cobertura === 'cumbres_garcia' ? 'Toda Cumbres Garc&#237;a' : u.cobertura === 'dominio_cumbres' ? 'Solo Dominio Cumbres' : u.cobertura) +
          FR('Descripci&#243;n', u.descripcion)
        );

      } else if (esNeg) {
        html += SEC('Mi negocio');
        html += CARD(
          FR('Tipo', tipo === 'restaurante' ? 'Restaurante' : 'Negocio') +
          FR('Categor&#237;a', u.categoria + (u.categoriaOtro ? ' &mdash; ' + u.categoriaOtro : '')) +
          FR('Operaci&#243;n', u.operacion) +
          FR('Entrega', u.entrega) +
          FR('Cobertura', u.cobertura === 'cumbres_garcia' ? 'Toda Cumbres Garc&#237;a' : u.cobertura === 'dominio_cumbres' ? 'Solo Dominio Cumbres' : u.cobertura) +
          FR('Descripci&#243;n', u.descripcion) +
          FR('A&#241;os operando', u.aniosOperando)
        );
      }

      // ── ESTADO + MEMBRESIA ───────────────────────────────────────
      if (tipo !== 'vecino') {
        html += SEC('Estado de cuenta');
        html += '<div style="background:#fff;border-radius:16px;padding:14px 16px;border:.5px solid #e0e0e0;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:12px;color:#888;font-weight:600;">Estado</span>'
          + _estadoBadge(u.estado)
          + '</div>';
      }

      // ── PIE ───────────────────────────────────────────────────────
      html += '<div style="text-align:center;padding:8px 0 24px;font-size:11px;color:var(--white-30);">Miembro desde ' + fecha + '</div>';

      cont.innerHTML = html;

    } catch(e) {
      if (cont) cont.innerHTML = '<div style="padding:20px;text-align:center;color:#D63A2A;font-size:13px;">Error al cargar perfil: ' + e.message + '</div>';
    }
  };

  // ===== CARGAR RESTAURANTES (Food) con acceso directo a window._fbDb =====

/* ═══════════════════════════════════════════════════════
   DC TEXT GUARDS — Sanitización visual universal
   Protege tarjetas/detalles de textos largos, HTML pegado,
   emojis repetidos, saltos excesivos y caracteres de control.
═══════════════════════════════════════════════════════ */
// Comprime cualquier foto a máx 400KB, 1200px, calidad adaptativa
window.dcComprimirFoto = function(dataUrl, cb) {
  var img = new Image();
  img.onload = function() {
    var MAX_PX = 1200, MAX_KB = 400;
    var w = img.width, h = img.height;
    if (w > MAX_PX || h > MAX_PX) {
      if (w > h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
      else { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    var q = 0.82, result;
    do { result = canvas.toDataURL('image/jpeg', q); q -= 0.08; }
    while (result.length > MAX_KB * 1024 * 1.37 && q > 0.3);
    cb(result);
  };
  img.onerror = function() { cb(dataUrl); };
  img.src = dataUrl;
};

window.dcCleanText = function(v, max) {
  var t = String(v == null ? '' : v);
  t = t.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  t = t.replace(/<[^>]*>/g, ' ');
  t = t.replace(/[\u0000-\u001F\u007F]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  // Reduce emojis/símbolos repetidos para que no rompan tarjetas.
  t = t.replace(/([🔥⭐❤️😍👍🙏💥✨✅❌⚠️📦🛍️])\1{3,}/g, '$1$1$1');
  max = max || 500;
  if (t.length > max) t = t.slice(0, max).trim();
  return t;
};
window.dcEscHTML = function(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
window.dcShortText = function(v, max) {
  var t = window.dcCleanText(v, max || 120);
  if (t.length > (max || 120)) t = t.slice(0, (max || 120) - 1).trim() + '…';
  return t;
};
window.cargarPlaza = async function() {
  const lista = document.getElementById('plaza-lista');
  const demo  = document.getElementById('plaza-demo');
  const sel   = document.getElementById('plaza-cat-select');
  if(!lista) return;
  if (sel) sel.value = 'todos';
  window._plazaFiltro = 'todos';
  lista.innerHTML = '<div class="si24">Cargando comercios... ⏳</div>';
  try {
    const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(window._fbDb,'usuarios'), where('tipo','==','negocio')));
    const docs = [];
    snap.forEach(d => {
      const r = d.data();
      const estadoOk = (r.estado === 'activo' || r.estado === 'aprobado_pendiente_pago');
      if(estadoOk && window.dcEsComercioPlaza(r)) docs.push(Object.assign({_id:d.id}, r));
    });
    window._plazaDocsCache = docs;
    if(docs.length === 0) {
      lista.innerHTML = '';
      if(demo) demo.style.display='block';
      return;
    }
    window._plazaRenderLista(docs);
  } catch(e) {
    lista.innerHTML = '<div class="si24">Error al cargar Plaza Online: '+e.message+'</div>';
  }
};

window.plazaAbrirComercio = async function(id) {
  var r = window._plazaDocsCache.find(function(x){ return x._id === id; });
  if (!r) return;
  var estOp = (typeof window._estadoEfectivoDe === 'function')
    ? window._estadoEfectivoDe(r.estadoOp, r.estadoOpTs || 0, r.horarios && r.horarios.length ? r.horarios : null)
    : (r.estadoOp || 'activo');
  var g = function(id){ return document.getElementById(id); };
  if (g('plaza-det-nombre')) g('plaza-det-nombre').textContent = '🏪 ' + (r.nombrePublico || r.nombreNegocio || r.nombre || 'Comercio');
  if (g('plaza-det-desc')) g('plaza-det-desc').textContent = window.dcCleanText(r.descripcionPublica || r.descripcion || 'Productos disponibles', 140);
  if (g('plaza-det-cat')) g('plaza-det-cat').textContent = window._plazaCatLabel(window._plazaCatBase(r));
  if (g('plaza-det-estado')) {
    var meta = estOp==='cerrado' ? {lbl:'🔴 Cerrado',col:'#D63A2A'} : estOp==='pausado' ? {lbl:'🟠 En pausa',col:'#E87722'} : estOp==='ocupado' ? {lbl:'🟡 Ocupado',col:'#d97706'} : {lbl:'🟢 Abierto',col:'var(--green-dk)'};
    g('plaza-det-estado').textContent = meta.lbl;
    g('plaza-det-estado').style.color = meta.col;
  }
  go('v-plaza-det','right');
  var detScr = document.getElementById('plaza-prod-lista'); if (detScr) detScr.scrollTop = 0;
  await window.plazaCargarProductos(id, r, estOp);

};

window._plazaProdDocsCache = [];
window._plazaProdFiltro = 'todos';
window._plazaSetProdFiltro = window._plazaSetProdFiltro || function(ev, cat) {
  // Soporta llamada desde onclick(event,'cat') y llamada directa _plazaSetProdFiltro('cat').
  if (ev && typeof ev === 'object' && ev.preventDefault) {
    ev.preventDefault();
    ev.stopPropagation();
  } else {
    cat = ev;
  }
  window._plazaProdFiltro = cat || 'todos';
  window._plazaRenderProductos && window._plazaRenderProductos();
  if (window._dcDirtyV === 'v-plaza-det') window._dcDirtyV = null;
  return false;
};

window._plazaCarrito = window._plazaCarrito || [];
window._plazaDetalleQty = 1;

window.plazaCambiarQtyDetalle = window.plazaCambiarQtyDetalle || function(delta){
  var q = Number(window._plazaDetalleQty || 1) + Number(delta || 0);
  if (q < 1) q = 1;
  if (q > 99) q = 99;
  window._plazaDetalleQty = q;
  var el = document.getElementById('plaza-det-qty-num');
  if (el) el.textContent = String(q);
  return false;
};

window.plazaAbrirProductoDetalle = window.plazaAbrirProductoDetalle || function(pid){
  if(document.body.dataset.dcModalLocked!=='1'){var _sy=window.scrollY||0;document.body.dataset.dcModalLocked='1';document.body.dataset.dcModalScrollY=String(_sy);document.body.style.overflow='hidden';document.body.style.touchAction='none';}
  var p = (window._plazaProdDocsCache || []).find(function(x){ return String(x._id) === String(pid); });
  if (!p) return;
  window._plazaDetalleQty = 1;
  var ov = document.getElementById('plaza-prod-det-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'plaza-prod-det-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.50);z-index:99999;display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;overflow:hidden;touch-action:none;';
    ov.innerHTML = '<div id="plaza-prod-det-card" style="width:100%;max-width:390px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 14px 42px rgba(0,0,0,.30);"></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) window.plazaCerrarProductoDetalle(); });
  }
  var card = document.getElementById('plaza-prod-det-card');
  var foto = p.foto || p.fotoProducto || p.fotoPublica || '';
  var agotado = p.disponible === false;
  var nombre = window.dcEscHTML ? window.dcEscHTML(window.dcShortText(p.nombre||'Producto',80)) : (p.nombre||'Producto');
  var cat = window.dcEscHTML ? window.dcEscHTML(window.dcShortText(p.categoria||p.categoriaPublica||'Producto',60)) : (p.categoria||'Producto');
  var desc = window.dcEscHTML ? window.dcEscHTML(window.dcCleanText(p.descripcion||p.descripcionPublica||'Sin descripción adicional.',500)) : (p.descripcion||'Sin descripción adicional.');
  var precio = (Number(p.precio||0)).toFixed(0);
  card.innerHTML =
    '<div style="max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;overscroll-behavior:contain;">'
    + '<div style="height:160px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:40px;position:relative;overflow:hidden;">'
    + (foto && String(foto).indexOf('data:image')===0 ? '<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">' : '📦')
    + '<button type="button" onclick="window.plazaCerrarProductoDetalle()" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border:none;border-radius:13px;background:rgba(255,255,255,.96);font-size:21px;font-weight:900;color:#13384f;box-shadow:0 2px 8px rgba(0,0,0,.12);">‹</button>'
    + '</div>'
    + '<div style="padding:15px 18px 18px;">'
    + '<div style="font-size:18px;font-weight:900;color:#111;line-height:1.18;margin-bottom:3px;">'+nombre+'</div>'
    + '<div style="font-size:11px;color:#777;margin-bottom:8px;">'+cat+'</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;">'
      + '<div style="font-size:24px;font-weight:900;color:var(--blue);">$'+precio+'</div>'
      + (agotado?'<div style="background:#f0f0f0;color:#777;border-radius:13px;padding:6px 10px;font-size:10px;font-weight:900;">⛔ No disponible</div>':'<div style="background:#E8F0F8;color:var(--blue);border-radius:13px;padding:6px 10px;font-size:10px;font-weight:900;">✅ Disponible</div>')
    + '</div>'
    + '<div style="font-size:12px;color:#444;line-height:1.42;margin:4px 0 12px;max-height:60px;overflow-y:auto;padding-right:3px;border-top:.5px solid #eef2f5;padding-top:10px;">'+desc+'</div>'
    + (!agotado ? '<div style="display:flex;align-items:center;justify-content:center;gap:18px;margin:4px 0 14px;">'
        + '<button type="button" onclick="return window.plazaCambiarQtyDetalle(-1)" style="width:40px;height:40px;border:none;border-radius:12px;background:var(--yellow);color:#111;font-size:22px;font-weight:900;font-family:inherit;line-height:40px;box-shadow:0 2px 7px rgba(0,0,0,.10);">−</button>'
        + '<div id="plaza-det-qty-num" style="min-width:24px;text-align:center;font-size:18px;font-weight:900;color:#111;">1</div>'
        + '<button type="button" onclick="return window.plazaCambiarQtyDetalle(1)" style="width:40px;height:40px;border:none;border-radius:12px;background:var(--yellow);color:#111;font-size:22px;font-weight:900;font-family:inherit;line-height:40px;box-shadow:0 2px 7px rgba(0,0,0,.10);">+</button>'
        + '</div>' : '')
    + '<button type="button" '+(agotado?'disabled':'')+' onclick="return window.plazaAgregarAlCarritoDetalle(\''+String(pid).replace(/'/g,"\\'")+'\')" style="width:100%;padding:14px;border:none;border-radius:17px;background:'+(agotado?'#ddd':'var(--blue)')+';color:#fff;font-size:13px;font-weight:900;font-family:inherit;cursor:'+(agotado?'not-allowed':'pointer')+';box-shadow:0 8px 16px rgba(26,122,181,.20);letter-spacing:.2px;">'+(agotado?'No disponible':'🛒 AGREGAR AL CARRITO')+'</button>'
    + '</div></div>';
  ov.style.visibility = '';
  ov.style.pointerEvents = '';
  ov.style.display = 'flex';
  try { document.body.style.overflow='hidden'; document.body.style.touchAction='none'; } catch(e) {}
};

window.plazaCargarProductos = async function(uidNegocio, negocio, estOp) {
  var el = document.getElementById('plaza-prod-lista');
  if (!el) return;
  el.innerHTML = '<div class="si24">Cargando productos... ⏳</div>';
  if (estOp === 'cerrado' || estOp === 'pausado') {
    el.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">'+(estOp==='pausado'?'⏸️':'🔴')+'</div><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:6px;">'+window.dcEscHTML(negocio.nombrePublico||negocio.nombreNegocio||'El comercio')+' no está disponible</div><div style="font-size:12px;color:#777;line-height:1.5;">Puedes ver sus productos más tarde cuando esté abierto.</div></div>';
    return;
  }
  try {
    var f = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    var snap = await f.getDocs(f.query(f.collection(window._fbDb,'menu',uidNegocio,'productos'), f.orderBy('orden','asc')));
    if (snap.empty) {
      el.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">🛍️</div><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:6px;">Sin productos publicados</div><div style="font-size:12px;color:#777;line-height:1.5;">Este comercio aún no tiene productos disponibles.</div></div>';
      return;
    }
    var items = [];
    snap.forEach(function(d){ var x=d.data(); items.push(Object.assign({_id:d.id},x)); });
    if (!items.length) {
      el.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">🛍️</div><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:6px;">Productos no disponibles</div><div style="font-size:12px;color:#777;">Vuelve más tarde.</div></div>';
      return;
    }
    window._plazaProdDocsCache = items;
    window._plazaProdFiltro = 'todos';
    window._plazaRenderProductos && window._plazaRenderProductos();
  } catch(e) {
    el.innerHTML = '<div class="si24">Error al cargar productos: '+e.message+'</div>';
  }
};

var _misComprasPlazaTab = 'proceso';
window.cambiarTabMisComprasPlaza = function(tab) {
  _misComprasPlazaTab = tab || 'proceso';
  window._misComprasPlazaTab = _misComprasPlazaTab;
  try { if (typeof window.dcPlazaLimpieza15Render === 'function') window.dcPlazaLimpieza15Render(); } catch(e) {}
};

window.cargarMisComprasPlaza = function() {
  try { if (typeof window.dcPlazaLimpieza15Render === 'function') window.dcPlazaLimpieza15Render(); } catch(e) {}
};
  function showMsg(id, text, tipo) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    el.style.background = tipo === 'error' ? '#FDECEA' : tipo === 'warn' ? '#FFF8E1' : '#E8F5EE';
    el.style.color     = tipo === 'error' ? '#D63A2A' : tipo === 'warn' ? '#6B4200' : '#0A4220';
    el.textContent = text;
  }
  function setBtn(id, txt, disabled) {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = txt; b.disabled = disabled;
  }
  window.setBtn = setBtn; // exponer globalmente para onclick attrs
  function todosChecks(ids) {
    return ids.every(id => { const el=document.getElementById(id); return el && el.classList.contains('on'); });
  }
  function setNombre(nombre) {
    localStorage.setItem('dcuser', nombre);
    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = nombre);
    const lb = document.getElementById('login-nombre-bienvenido');
    if (lb) lb.textContent = nombre;
  }
  window.setNombre = setNombre;
  function firebaseError(code) {
    if (code === 'auth/email-already-in-use')    return '📧 Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
    if (code === 'auth/weak-password')           return '🔐 La contraseña debe tener mínimo 6 caracteres.';
    if (code === 'auth/invalid-email')           return '📧 Ese correo no tiene formato válido.';
    if (code === 'auth/invalid-credential')      return '❌ Correo o contraseña incorrectos.';
    if (code === 'auth/network-request-failed')  return '⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    if (!navigator.onLine)                       return '⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    return '❌ Error: ' + code;
  }

  // ─── REGISTRO VECINO ────────────────────────────────────
  // ── Modal de errores para registro vecino ──────────────────
  // Cierre del modal — también resetea el botón de registro
  window._cerrarModalErroresV = function() {
    var _b = document.getElementById('btn-reg-vecino');
    if (_b) { _b.textContent = 'Crear mi cuenta →'; _b.disabled = false; }
    var _m = document.getElementById('modal-errores-v');
    if (_m) _m.style.display = 'none';
  };

  function mostrarErroresVecino(errores) {
    // Siempre resetear el btn al mostrar errores
    var _b = document.getElementById('btn-reg-vecino');
    if (_b) { _b.textContent = 'Crear mi cuenta →'; _b.disabled = false; }
    const ya = document.getElementById('modal-errores-v');
    const lista = errores.map(e => '<li style="padding:3px 0;">'+e+'</li>').join('');
    const html = '<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">⚠️ Corrige lo siguiente</div>'
      + '<ul style="padding-left:18px;font-size:13px;color:#444;line-height:1.8;margin-bottom:16px;">'+lista+'</ul>'
      + '<button onclick="window._cerrarModalErroresV()" '
      + 'style="width:100%;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Entendido</button>';
    if (ya) { ya.querySelector('.modal-errores-body').innerHTML = html; ya.style.display='flex'; return; }
    const m = document.createElement('div');
    m.id = 'modal-errores-v';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML = '<div class="modal-errores-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;">'+html+'</div>';
    m.addEventListener('click', e => { if(e.target===m) window._cerrarModalErroresV(); });
    document.body.appendChild(m);
  }

  window.registrarVecino = async function() {
    // ── Leer y normalizar campos ──────────────────────────────
    const _nomRaw    = (document.getElementById('v-nombre')?.value || '').trim();
    const nombre     = _nomRaw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const usrEl      = document.getElementById('v-usr');
    if (usrEl) usrEl.value = usrEl.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
    const usuario    = (usrEl?.value || '').trim();
    const correo     = (document.getElementById('v-correo')?.value || '').trim();
    const tel        = (document.getElementById('v-tel')?.value || '').trim();
    const pass1      = document.getElementById('vp1')?.value || '';
    const pass2      = document.getElementById('vp2')?.value || '';
    const calle      = (document.getElementById('v-calle')?.value || '').trim();
    const numero     = (document.getElementById('v-numero')?.value || '').trim();
    const _prefijo   = (document.getElementById('v-tel-prefijo')?.value || '+52').replace('-CA','');
    const _numLimpio = tel.replace(/[^0-9]/g,'');
    const _telFull   = _prefijo + _numLimpio;

    // ── Recolectar TODOS los errores ─────────────────────────
    const errores = [];
    if (!nombre)                                          errores.push('Escribe tu nombre completo');
    if (!usuario)                                         errores.push('Escribe un nombre de usuario');
    else if (!/^[a-z0-9_-]+$/.test(usuario))             errores.push('Usuario: solo minúsculas, números, _ y -');
    // Correo: formato básico
    const _correoErr = vValidarCorreo(correo);
    if (_correoErr) errores.push(_correoErr.replace(/^[📧⚠️]\s*/,''));
    // Correo: typo conocido → modal de sugerencia (no bloqueante si usuario elige continuar)
    if (!_correoErr && !window._omitirTypoCorreo) {
      const _typo = _detectarTypoCorreo(correo);
      if (_typo) {
        window._mostrarSugerenciaCorreo(correo, _typo);
        return;
      }
    }
    // WhatsApp: validar dígitos según prefijo
    const _waReglas = {
      '+52': { digitos: 10, msg: 'WhatsApp México debe tener 10 dígitos' },
      '+1':  { digitos: 10, msg: 'WhatsApp USA/Canadá debe tener 10 dígitos' },
      '+34': { digitos:  9, msg: 'WhatsApp España debe tener 9 dígitos' },
      '+57': { digitos: 10, msg: 'WhatsApp Colombia debe tener 10 dígitos' }
    };
    if (!_numLimpio) {
      errores.push('Escribe tu número de WhatsApp');
    } else {
      const _waRegla = _waReglas[_prefijo];
      if (_waRegla) {
        if (_numLimpio.length !== _waRegla.digitos) errores.push(_waRegla.msg);
      } else {
        if (!/^[0-9]{8,15}$/.test(_numLimpio)) errores.push('WhatsApp debe tener entre 8 y 15 dígitos');
      }
    }
    if (!pass1 || pass1.length < 6)                      errores.push('Contraseña: mínimo 6 números');
    else if (pass1 !== pass2)                             errores.push('Las contraseñas no coinciden');
    // Validación condicional — basada en selects, no en display
    const _zona = document.getElementById('zona-sel')?.value || '';
    const _frac = document.getElementById('frac-sel')?.value || '';
    if (!_zona) {
      errores.push('Selecciona tu zona');
    } else if (!_frac) {
      errores.push('Selecciona tu fraccionamiento');
    } else {
      // Zona y fraccionamiento completos — validar calle
      if (!calle)  errores.push('Escribe la calle');
      if (!numero) errores.push('Escribe el número');
    }
    if (!todosChecks(['v-chk1','v-chk2']))                errores.push('Acepta los Términos y Condiciones');

    if (errores.length > 0) return mostrarErroresVecino(errores);

    // ── Crear cuenta ─────────────────────────────────────────
    setBtn('btn-reg-vecino','Creando cuenta... ⏳',true);
    try {
      const cred = await window._fbCreateUser(window._fbAuth, correo, pass1);
      await window._fs.setDoc(window._fs.doc(window._fbDb,'usuarios',cred.user.uid),{
        nombre, usuario, correo,
        prefijoWhatsapp:_prefijo, telefono:_numLimpio, whatsapp:_telFull,
        calle, numero, direccion: calle + ' ' + numero, tipo:'vecino', estado:'activo',
        zona: document.getElementById('zona-sel')?.value||'',
        fraccionamiento: (function(){
          const sel = document.getElementById('frac-sel')?.value||'';
          if(sel==='agregar'){
            const nuevo=(document.getElementById('frac-nuevo-inp')?.value||'').trim();
            const zona=document.getElementById('zona-sel')?.value||'';
            if(nuevo&&zona&&typeof fracs!=='undefined'){
              if(!fracs[zona])fracs[zona]=[];
              if(!fracs[zona].includes(nuevo))fracs[zona].push(nuevo);
            }
            return nuevo;
          }
          return sel;
        })(),
        creadoEn: new Date().toISOString()
      });
      notificarBienvenido(nombre, correo, 'vecino');
      setNombre(nombre);
      go('v-ok-vecino','right');
    } catch(e) {
      mostrarErroresVecino([firebaseError(e.code)]);
    } finally {
      setBtn('btn-reg-vecino','Crear mi cuenta →',false);
    }
  };

  // ─── REGISTRO PROVEEDOR ─────────────────────────────────
  // ── Modal de errores proveedor ──────────────────────────────
  // Correo typo — proveedor (reutiliza _detectarTypoCorreo y lógica de vecino)
  window._omitirTypoCorreoProv = false;
  window._mostrarSugerenciaCorreoProv = function(correoOrig, domCorr){
    const partes = correoOrig.split('@');
    const correoSug = partes[0] + '@' + domCorr;
    const ya = document.getElementById('modal-correo-typo-p');
    const html =
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">⚠️ Revisa tu correo</div>'
      +'<div style="font-size:13px;color:#555;margin-bottom:6px;">Escribiste:</div>'
      +'<div style="font-size:13px;font-weight:700;color:#D63A2A;margin-bottom:12px;">'+correoOrig+'</div>'
      +'<div style="font-size:13px;color:#555;margin-bottom:6px;">¿Quisiste decir?</div>'
      +'<div style="font-size:13px;font-weight:700;color:#1FC26A;margin-bottom:20px;">'+correoSug+'</div>'
      +'<button onclick="window._corregirCorreoProv(\''+correoSug+'\')" '
      +'style="width:100%;background:#F5C518;color:#1a1a1a;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:8px;">Corregir</button>'
      +'<button onclick="window._continuarConCorreoProv()" '
      +'style="width:100%;background:#f0f0f0;color:#333;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:10px;">Continuar con mi correo</button>'
      +'<div style="font-size:11px;color:#aaa;text-align:center;">Solo es una sugerencia. Algunos dominios personalizados pueden ser válidos.</div>';
    if(ya){ya.querySelector('.modal-ct-p-body').innerHTML=html;ya.style.display='flex';return;}
    const m=document.createElement('div');
    m.id='modal-correo-typo-p';
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML='<div class="modal-ct-p-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'+html+'</div>';
    document.body.appendChild(m);
  };
  window._corregirCorreoProv = function(c){
    const el=document.getElementById('p-correo');
    if(el)el.value=c;
    const m=document.getElementById('modal-correo-typo-p');
    if(m)m.style.display='none';
  };
  window._continuarConCorreoProv = function(){
    const m=document.getElementById('modal-correo-typo-p');
    if(m)m.style.display='none';
    window._omitirTypoCorreoProv=true;
    window.registrarProv && window.registrarProv();
    window._omitirTypoCorreoProv=false;
  };

  // Correo typo — negocio/restaurante
  window._omitirTypoCorreoBiz = false;
  window._mostrarSugerenciaCorreoBiz = function(correoOrig, domCorr){
    const partes=correoOrig.split('@');
    const correoSug=partes[0]+'@'+domCorr;
    const ya=document.getElementById('modal-correo-typo-b');
    const html=
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">⚠️ Revisa tu correo</div>'
      +'<div style="font-size:13px;color:#555;margin-bottom:6px;">Escribiste:</div>'
      +'<div style="font-size:13px;font-weight:700;color:#D63A2A;margin-bottom:12px;">'+correoOrig+'</div>'
      +'<div style="font-size:13px;color:#555;margin-bottom:6px;">¿Quisiste decir?</div>'
      +'<div style="font-size:13px;font-weight:700;color:#1FC26A;margin-bottom:20px;">'+correoSug+'</div>'
      +'<button onclick="window._corregirCorreoBiz(\''+correoSug+'\')" '
      +'style="width:100%;background:#1A7AB5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:8px;">Corregir</button>'
      +'<button onclick="window._continuarConCorreoBiz()" '
      +'style="width:100%;background:#f0f0f0;color:#333;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:10px;">Continuar con mi correo</button>'
      +'<div style="font-size:11px;color:#aaa;text-align:center;">Solo es una sugerencia. Algunos dominios personalizados pueden ser válidos.</div>';
    if(ya){ya.querySelector('.modal-ct-b-body').innerHTML=html;ya.style.display='flex';return;}
    const m=document.createElement('div');
    m.id='modal-correo-typo-b';
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML='<div class="modal-ct-b-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'+html+'</div>';
    document.body.appendChild(m);
  };
  window._corregirCorreoBiz = function(c){
    const el=document.getElementById('b-correo');
    if(el)el.value=c;
    const m=document.getElementById('modal-correo-typo-b');
    if(m)m.style.display='none';
  };
  window._continuarConCorreoBiz = function(){
    const m=document.getElementById('modal-correo-typo-b');
    if(m)m.style.display='none';
    window._omitirTypoCorreoBiz=true;
    window.registrarBiz&&window.registrarBiz();
    window._omitirTypoCorreoBiz=false;
  };

  window._cerrarModalErrProv = function(){
    var b=document.getElementById('btn-reg-prov');
    if(b){b.textContent='Enviar solicitud →';b.disabled=false;}
    var m=document.getElementById('modal-errores-p');
    if(m)m.style.display='none';
  };
  function mostrarErroresProv(errores) {
    const lista = errores.map(e => '<li style="padding:3px 0;">'+e+'</li>').join('');
    const html = '<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">⚠️ Corrige lo siguiente</div>'
      + '<ul style="padding-left:18px;font-size:13px;color:#444;line-height:1.8;margin-bottom:16px;">'+lista+'</ul>'
      + '<button onclick="window._cerrarModalErrProv()" '
      + 'style="width:100%;background:#F5C518;color:#1a1a1a;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Entendido</button>';
    const ya = document.getElementById('modal-errores-p');
    if (ya) { ya.querySelector('.modal-ep-body').innerHTML = html; ya.style.display='flex'; return; }
    const m = document.createElement('div');
    m.id = 'modal-errores-p';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML = '<div class="modal-ep-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;">'+html+'</div>';
    m.addEventListener('click', e => { if(e.target===m) m.style.display='none'; });
    document.body.appendChild(m);
  }

  window.registrarProv = async function() {
    // ── Leer campos ──────────────────────────────────────────
    const _nomRawP    = (document.getElementById('p-nombre')?.value||'').trim();
    const nombre      = _nomRawP.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase());
    const usrEl       = document.getElementById('p-usr');
    if(usrEl) usrEl.value = usrEl.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
    const usuario     = (usrEl?.value||'').trim();
    const correo      = (document.getElementById('p-correo')?.value||'').trim();
    const _pref       = (document.getElementById('p-tel-prefijo')?.value||'+52').replace('-CA','');
    const _numP       = (document.getElementById('p-tel')?.value||'').replace(/[^0-9]/g,'');
    const whatsapp    = _pref + _numP;
    const pass1       = document.getElementById('pp1')?.value||'';
    const pass2       = document.getElementById('pp2')?.value||'';
    const oficio1     = document.getElementById('p-oficio1')?.value||'';
    const oficio2     = document.getElementById('p-oficio2')?.value||'';
    const oficio3     = document.getElementById('p-oficio3')?.value||'';
    const otroDesc    = (document.getElementById('p-otro-desc')?.value||'').trim();
    const oficiosExtra= (document.getElementById('p-oficios-extra')?.value||'').trim();
    const descripcion = (document.getElementById('p-descripcion')?.value||'').trim();
    // precio eliminado del formulario
    const experiencia = document.getElementById('p-experiencia')?.value||'';
    const calle       = (document.getElementById('p-calle')?.value||'').trim();
    const numeroProv  = (document.getElementById('p-numero-prov')?.value||'').trim();
    const colonia     = (document.getElementById('p-colonia')?.value||'').trim();

    // ── Recolectar errores ───────────────────────────────────
    const errores = [];
    if (!nombre)       errores.push('Escribe tu nombre completo');
    if (!usuario)      errores.push('Escribe un nombre de usuario');
    else if (!/^[a-z0-9_-]+$/.test(usuario)) errores.push('Usuario: solo minúsculas, números, _ y -');
    const _cerrP = vValidarCorreo(correo);
    if (_cerrP) errores.push(_cerrP.replace(/^[📧⚠️]\s*/,''));
    // Correo: typo conocido → modal de sugerencia (reutiliza misma lógica que vecino)
    if (!_cerrP && !window._omitirTypoCorreoProv) {
      const _typoP = _detectarTypoCorreo(correo);
      if (_typoP) {
        window._mostrarSugerenciaCorreoProv(correo, _typoP);
        return;
      }
    }
    // WhatsApp
    const _waR = {'+52':10,'+1':10,'+34':9,'+57':10};
    const _waM = {'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá debe tener 10 dígitos','+34':'WhatsApp España debe tener 9 dígitos','+57':'WhatsApp Colombia debe tener 10 dígitos'};
    if (!_numP) errores.push('Escribe tu número de WhatsApp');
    else if (_waR[_pref] ? _numP.length!==_waR[_pref] : !/^[0-9]{8,15}$/.test(_numP))
      errores.push(_waM[_pref]||'WhatsApp debe tener entre 8 y 15 dígitos');
    // Contraseña
    if (!pass1||pass1.length<6) errores.push('Contraseña: mínimo 6 números');
    else if (pass1!==pass2)     errores.push('Las contraseñas no coinciden');
    // Oficio
    if (!oficio1) errores.push('Selecciona tu oficio principal');
    if (oficio1==='otro'&&!otroDesc) errores.push('Describe tu servicio (selección: Otro)');
    // Descripción mínimo 20 chars
    if (!descripcion||descripcion.length<20) errores.push('Descripción: mínimo 20 caracteres');
    // Experiencia
    if (!experiencia) errores.push('Selecciona tus años de experiencia');
    // Dirección
    if (!calle)      errores.push('Escribe tu calle');
    if (!numeroProv) errores.push('Escribe tu número');
    if (!colonia)    errores.push('Escribe tu colonia o fraccionamiento');
    // Checks — ahora son 4
    if (!todosChecks(['p-chk1','p-chk2','p-chk3','p-chk4']))
      errores.push('Acepta todos los acuerdos para continuar');

    if (errores.length > 0) { mostrarErroresProv(errores); return; }

    // ── Crear cuenta ─────────────────────────────────────────
    setBtn('btn-reg-prov','Enviando... ⏳',true);
    try {
      const cred = await window._fbCreateUser(window._fbAuth, correo, pass1);
      await window._fs.setDoc(window._fs.doc(window._fbDb,'usuarios',cred.user.uid),{
        nombre, usuario, correo,
        prefijoWhatsapp: _pref, telefono: _numP, whatsapp,
        tipo: 'proveedor',
        estado: 'pendiente_revision',
        oficio1, oficio2: oficio2||null, oficio3: oficio3||null,
        otroDesc: oficio1==='otro'||oficio2==='otro'||oficio3==='otro' ? otroDesc : '',
        oficiosExtra,
        descripcion,
        experiencia,
        calle, numero: numeroProv, colonia,
        calificacion: null, totalCalificaciones: 0,
        creadoEn: new Date().toISOString()
      });
      notificarBienvenido(nombre, correo, 'proveedor');
      notificarAdmin('Proveedor', nombre, correo, whatsapp);
      setNombre(nombre);
      go('v-ok-rev','right');
    } catch(e) {
      mostrarErroresProv([firebaseError(e.code)]);
    } finally {
      setBtn('btn-reg-prov','Enviar solicitud →',false);
    }
  };

  // ─── REGISTRO TRANSPORTE ────────────────────────────────
  // Modal errores ride
  function mostrarErroresRide(errores) {
    const lista=errores.map(e=>'<li style="padding:3px 0;">'+e+'</li>').join('');
    const html='<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">⚠️ Corrige lo siguiente</div>'
      +'<ul style="padding-left:18px;font-size:13px;color:#444;line-height:1.8;margin-bottom:16px;">'+lista+'</ul>'
      +'<button onclick="(function(){var b=document.getElementById(\'btn-reg-ride\');if(b){b.textContent=\'Enviar solicitud →\';b.disabled=false;}document.getElementById(\'modal-errores-r\').style.display=\'none\';})()" '
      +'style="width:100%;background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Entendido</button>';
    const ya=document.getElementById('modal-errores-r');
    if(ya){ya.querySelector('.modal-er-body').innerHTML=html;ya.style.display='flex';return;}
    const m=document.createElement('div');
    m.id='modal-errores-r';
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML='<div class="modal-er-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;">'+html+'</div>';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none';});
    document.body.appendChild(m);
  }

  window.registrarRide = async function() {
    const _nomRawR=(document.getElementById('r-nombre')?.value||'').trim();
    const nombre=_nomRawR.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    const usrEl=document.getElementById('r-usr');
    if(usrEl)usrEl.value=usrEl.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
    const usuario=(usrEl?.value||'').trim();
    const correo=(document.getElementById('r-correo')?.value||'').trim();
    const _prefR=(document.getElementById('r-tel-prefijo')?.value||'+52').replace('-CA','');
    const _numR=(document.getElementById('r-tel')?.value||'').replace(/[^0-9]/g,'');
    const whatsapp=_prefR+_numR;
    const pass1=document.getElementById('rp1')?.value||'';
    const pass2=document.getElementById('rp2')?.value||'';
    const tipoServ=document.getElementById('r-tipo-servicio')?.value||'';
    const tipoVeh=document.getElementById('r-tipo-vehiculo')?.value||'';
    const marca=(document.getElementById('r-marca')?.value||'').trim();
    const modelo=(document.getElementById('r-modelo')?.value||'').trim();
    const color=(document.getElementById('r-color')?.value||'').trim();
    const placas=(document.getElementById('r-placas')?.value||'').trim().toUpperCase();
    const cobertura=document.getElementById('r-cobertura')?.value||'';
    const descripcion=(document.getElementById('r-descripcion')?.value||'').trim();

    const errores=[];
    if(!tipoServ)   errores.push('Selecciona tu tipo de servicio');
    if(!nombre)     errores.push('Escribe tu nombre completo');
    if(!usuario)    errores.push('Escribe un nombre de usuario');
    else if(!/^[a-z0-9_-]+$/.test(usuario)) errores.push('Usuario: solo minúsculas, números, _ y -');
    const _cerrR=vValidarCorreo(correo);
    if(_cerrR) errores.push(_cerrR.replace(/^[\u{1f4e7}⚠️]\s*/u,''));
    const _waRR={'+52':10,'+1':10,'+34':9,'+57':10};
    const _waMR={'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá debe tener 10 dígitos','+34':'WhatsApp España debe tener 9 dígitos','+57':'WhatsApp Colombia debe tener 10 dígitos'};
    if(!_numR) errores.push('Escribe tu número de WhatsApp');
    else if(_waRR[_prefR]?_numR.length!==_waRR[_prefR]:!/^[0-9]{8,15}$/.test(_numR))
      errores.push(_waMR[_prefR]||'WhatsApp debe tener entre 8 y 15 dígitos');
    if(!pass1||pass1.length<6) errores.push('Contraseña: mínimo 6 números');
    else if(pass1!==pass2)     errores.push('Las contraseñas no coinciden');
    if(!tipoVeh)    errores.push('Selecciona el tipo de vehículo');
    if(!marca)      errores.push('Escribe la marca del vehículo');
    if(!modelo)     errores.push('Escribe el modelo del vehículo');
    if(!color)      errores.push('Escribe el color del vehículo');
    if(!placas)     errores.push('Escribe las placas del vehículo');
    if(!cobertura)  errores.push('Selecciona tu zona de cobertura');
    if(!descripcion||descripcion.length<20) errores.push('Descripción: mínimo 20 caracteres');
    if(!todosChecks(['r-chk1','r-chk2','r-chk3','r-chk4'])) errores.push('Acepta los 4 acuerdos para continuar');

    if(errores.length>0){mostrarErroresRide(errores);return;}

    setBtn('btn-reg-ride','Enviando... ⏳',true);
    try{
      const cred=await window._fbCreateUser(window._fbAuth,correo,pass1);
      await window._fs.setDoc(window._fs.doc(window._fbDb,'usuarios',cred.user.uid),{
        nombre,usuario,correo,
        prefijoWhatsapp:_prefR,telefono:_numR,whatsapp,
        tipo:tipoServ,
        tipoVehiculo:tipoVeh,marca,modelo,color,placas,
        cobertura,descripcion,
        estado:'pendiente_revision',
        creadoEn:new Date().toISOString()
      });
      notificarBienvenido(nombre,correo,'transportista');
      notificarAdmin('Transporte/Repartidor',nombre,correo,whatsapp);
      setNombre(nombre);
      go('v-ok-rev','right');
    }catch(e){
      mostrarErroresRide([firebaseError(e.code)]);
    }finally{
      setBtn('btn-reg-ride','Enviar solicitud →',false);
    }
  };

  // ─── REGISTRO NEGOCIO ───────────────────────────────────
  // Modal errores biz
  function mostrarErroresBiz(errores) {
    const lista=errores.map(e=>'<li style="padding:3px 0;">'+e+'</li>').join('');
    const html='<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">⚠️ Corrige lo siguiente</div>'
      +'<ul style="padding-left:18px;font-size:13px;color:#444;line-height:1.8;margin-bottom:16px;">'+lista+'</ul>'
      +'<button onclick="(function(){var b=document.getElementById(\'btn-reg-biz\');if(b){b.textContent=\'Enviar solicitud →\';b.disabled=false;}document.getElementById(\'modal-errores-b\').style.display=\'none\';})()" '
      +'style="width:100%;background:#1A7AB5;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Entendido</button>';
    const ya=document.getElementById('modal-errores-b');
    if(ya){ya.querySelector('.modal-eb-body').innerHTML=html;ya.style.display='flex';return;}
    const m=document.createElement('div');
    m.id='modal-errores-b';
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML='<div class="modal-eb-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:70vh;overflow-y:auto;">'+html+'</div>';
    m.addEventListener('click',e=>{if(e.target===m)m.style.display='none';});
    document.body.appendChild(m);
  }

  window.registrarBiz = async function() {
    // ── Leer y normalizar ───────────────────────────
    const tipoNeg  = document.getElementById('b-tipo-negocio')?.value||'';
    const catEl    = tipoNeg==='restaurante' ? document.getElementById('b-cat-restaurante') : document.getElementById('b-cat-negocio');
    const categoria= catEl?.value||'';
    const _isOtroB = categoria==='otro_rest'||categoria==='otro_neg';
    const _otroId  = categoria==='otro_rest'?'b-cat-otro-rest':'b-cat-otro-neg';
    const categoriaOtro = _isOtroB ? (document.getElementById(_otroId)?.value||'').trim() : '';

    const nombreCom= (document.getElementById('b-nombre-comercial')?.value||'').trim();
    const _nomBRaw = (document.getElementById('b-nombre')?.value||'').trim();
    const nombre   = _nomBRaw.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    const usrEl    = document.getElementById('b-usr');
    if(usrEl) usrEl.value=usrEl.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
    const usuario  = (usrEl?.value||'').trim();
    const correo   = (document.getElementById('b-correo')?.value||'').trim();
    const _prefB   = (document.getElementById('b-tel-prefijo')?.value||'+52').replace('-CA','');
    const _numB    = (document.getElementById('b-tel')?.value||'').replace(/[^0-9]/g,'');
    const whatsapp = _prefB+_numB;
    const pass1    = document.getElementById('bp1')?.value||'';
    const pass2    = document.getElementById('bp2')?.value||'';
    const operacion= document.getElementById('b-operacion')?.value||'';
    const entrega  = document.getElementById('b-entrega')?.value||'';
    const cobertura= document.getElementById('b-cobertura')?.value||'';
    const calle    = (document.getElementById('b-calle')?.value||'').trim();
    const numero   = (document.getElementById('b-numero')?.value||'').trim();
    const colonia  = (document.getElementById('b-colonia')?.value||'').trim();
    const descripcion=(document.getElementById('b-descripcion')?.value||'').trim();
    const aniosOperando=document.getElementById('b-anios')?.value||'';

    // ── Validar ─────────────────────────────────
    const errores=[];
    if(!tipoNeg)      errores.push('Selecciona el tipo: Restaurante o Negocio');
    if(!categoria)    errores.push('Selecciona una categoría');
    if(_isOtroB&&!categoriaOtro) errores.push('Escribe la categoría');
    if(!nombreCom)    errores.push('Escribe el nombre comercial');
    if(!nombre)       errores.push('Escribe tu nombre completo');
    if(!usuario)      errores.push('Escribe un nombre de usuario');
    else if(!/^[a-z0-9_-]+$/.test(usuario)) errores.push('Usuario: solo minúsculas, números, _ y -');
    const _cerrB=vValidarCorreo(correo);
    if(_cerrB) errores.push(_cerrB.replace(/^[\u26a0\ufe0f\u{1f4e7}]\s*/u,''));
    if(!_cerrB&&!window._omitirTypoCorreoBiz){
      const _typoB=_detectarTypoCorreo(correo);
      if(_typoB){window._mostrarSugerenciaCorreoBiz&&window._mostrarSugerenciaCorreoBiz(correo,_typoB);return;}
    }
    const _waRB={'+52':10,'+1':10,'+34':9,'+57':10};
    const _waMB={'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá debe tener 10 dígitos','+34':'WhatsApp España debe tener 9 dígitos','+57':'WhatsApp Colombia debe tener 10 dígitos'};
    if(!_numB)        errores.push('Escribe tu número de WhatsApp');
    else if(_waRB[_prefB]?_numB.length!==_waRB[_prefB]:!/^[0-9]{8,15}$/.test(_numB))
      errores.push(_waMB[_prefB]||'WhatsApp debe tener entre 8 y 15 dígitos');
    if(!pass1||pass1.length<6) errores.push('Contraseña: mínimo 6 números');
    else if(pass1!==pass2)     errores.push('Las contraseñas no coinciden');
    if(!operacion)    errores.push('Selecciona la modalidad de operación');
    if(!entrega)      errores.push('Selecciona el tipo de entrega');
    if(!cobertura)    errores.push('Selecciona la cobertura');
    if(!calle)        errores.push('Escribe tu calle');
    if(!numero)       errores.push('Escribe tu número');
    if(!colonia)      errores.push('Escribe tu colonia o fraccionamiento');
    if(!descripcion||descripcion.length<20) errores.push('Descripción: mínimo 20 caracteres');
    if(!aniosOperando)errores.push('Selecciona los años operando');
    if(!todosChecks(['b-chk1','b-chk2','b-chk3','b-chk4'])) errores.push('Acepta los 4 acuerdos para continuar');

    if(errores.length>0){mostrarErroresBiz(errores);return;}

    // ── Crear cuenta ─────────────────────────────
    setBtn('btn-reg-biz','Enviando... ⏳',true);
    try{
      const cred=await window._fbCreateUser(window._fbAuth,correo,pass1);
      await window._fs.setDoc(window._fs.doc(window._fbDb,'usuarios',cred.user.uid),{
        nombre, usuario, correo,
        prefijoWhatsapp:_prefB, telefono:_numB, whatsapp,
        tipo: tipoNeg,
        nombreNegocio: nombreCom,
        categoria, categoriaOtro: categoriaOtro||null,
        operacion, entrega, cobertura,
        calle, numero, colonia,
        descripcion, aniosOperando,
        estado:'pendiente_revision',
        creadoEn:new Date().toISOString()
      });
      notificarBienvenido(nombreCom||nombre,correo,tipoNeg);
      notificarAdmin('Negocio/Restaurante',nombreCom||nombre,correo,whatsapp);
      setNombre(nombreCom||nombre);
      go('v-ok-rev','right');
    }catch(e){
      mostrarErroresBiz([firebaseError(e.code)]);
    }finally{
      setBtn('btn-reg-biz','Enviar solicitud →',false);
    }
  };

  // ── M2-D: ESTADO OPERATIVO ──────────────────────────────────
  // Persiste en localStorage. Preparado para Firestore futuro.
  window._normEstadoOp = function(v){
    if (v==='vacaciones'||v==='invisible'||v==='fuera_horario') return 'pausado';
    return v;
  };

  // Devuelve la clave estable para el estado operativo.
  // Usa uid de Firebase si está disponible (nunca cambia).
  // Fallback: dcuserTipo, que también es estable por sesión.
  function _estadoKey() {
    var uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || '';
    if (uid) return 'dcuserEstadoOp_' + uid;
    var tipo = localStorage.getItem('dcuserTipo') || 'u';
    return 'dcuserEstadoOp_t_' + tipo;
  }

  window.getEstadoOperativo = function() {
    var v = localStorage.getItem(_estadoKey()) || localStorage.getItem('dcRestOpV2') || 'activo';
    if (window._normEstadoOp) v = window._normEstadoOp(v);
    // Usar ts por uid para evitar contaminación cruzada entre negocio y restaurante
    var _uid8 = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || localStorage.getItem('dcuserUid') || '';
    var _tsKey8 = _uid8 ? ('dcuserEstadoOpTs_' + _uid8) : 'dcRestOpV2Ts';
    var ts = parseInt(localStorage.getItem(_tsKey8) || localStorage.getItem('dcRestOpV2Ts') || '0', 10);
    if (window._estadoEfectivoDe) { try { return window._estadoEfectivoDe(v, ts, undefined); } catch(e){} }
    return v;
  };

  window.setEstadoOperativo = function(estado) {
    estado = window._normEstadoOp ? window._normEstadoOp(estado) : estado;
    localStorage.setItem(_estadoKey(), estado);
    // Sincronizar con módulo Centro Operativo
    if (typeof _rEstadoOp !== 'undefined') { _rEstadoOp = estado; }
    // Sincronizar también módulo negocio para evitar desincronía entre roles
    if (typeof _vnegEstadoOp !== 'undefined') { _vnegEstadoOp = estado; }
    localStorage.setItem('dcRestOpV2', estado);
    // REGLA UNIVERSAL DE ESTADO: todo cambio se guarda SIEMPRE en Firebase con marca de tiempo
    try{
      var _tsE = Date.now();
      localStorage.setItem('dcRestOpV2Ts', String(_tsE));
      if (typeof _rEstadoOpTs !== 'undefined') { _rEstadoOpTs = _tsE; }
      if (typeof _vnegEstadoOpTs !== 'undefined') { _vnegEstadoOpTs = _tsE; }
      var _uidE = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid)
                 || localStorage.getItem('dcuserUid');
      // Guardar ts por uid para evitar contaminación cruzada entre roles
      if (_uidE) { try { localStorage.setItem('dcuserEstadoOpTs_' + _uidE, String(_tsE)); } catch(e){} }
      if (_uidE && window._fbDb) {
        import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js").then(function(F){
          return F.setDoc(F.doc(window._fbDb,'usuarios',_uidE),{estadoOp:estado,estadoOpTs:_tsE},{merge:true});
        }).catch(function(e){ });
      }
    }catch(e){}
    if (window.dcPintarEstado) { try{ window.dcPintarEstado(); }catch(e){} }
    var cfg = DC_ESTADOS[estado] || DC_ESTADOS.activo;
    // Home label
    var el = document.getElementById('home-estado-op');
    if (el) { el.textContent = cfg.ic + ' ' + cfg.lbl; el.style.background = cfg.bg; el.style.color = cfg.col; }
    // Mi Panel header badge (arriba a la derecha)
    var badge = document.getElementById('mp2-estado-badge');
    if (badge) { badge.textContent = cfg.ic + ' ' + cfg.lbl; badge.style.background = cfg.bg; badge.style.color = cfg.col; badge.style.display = 'inline-flex'; }
    // Mi Panel — título del estado
    var t = document.getElementById('mp2-estado-lbl-title');
    if (t) t.textContent = cfg.ic + ' ' + cfg.lbl;
    // Mi Panel — descripción del estado
    var lbl = document.getElementById('mp2-estado-lbl');
    if (lbl) { lbl.textContent = cfg.desc; lbl.style.color = cfg.col; }
    // Mi Panel — punto de color
    var dot = document.getElementById('mp2-estado-dot');
    if (dot) dot.style.background = cfg.col;
    // Mi Panel — selector
    var sel = document.getElementById('mp2-estado-sel');
    if (sel) sel.value = estado;
    // Centro Operativo — home estado dot/lbl (vr-home dentro de vr-shell)
    var coDot = document.getElementById('home-estado-dot');
    var coLbl = document.getElementById('home-estado-lbl');
    if (coDot) coDot.className = 'estado-dot ' + (cfg.dotEl || '');
    if (coLbl) coLbl.textContent = cfg.lbl;
    // CO — selector cfg (solo si no hay cambios sin guardar en config)
    var cfgSel = document.getElementById('cfg-est-sel');
    if (cfgSel && window._dirtyView !== 'vr-config') cfgSel.value = estado;
    if (typeof _syncEstadoCfgUI === 'function' && window._dirtyView !== 'vr-config') _syncEstadoCfgUI(estado);
  };
  // ── FIN M2-D helpers ─────────────────────────────────────────

  // ── DIRECCIÓN DEL NEGOCIO: guardar en usuarios/{uid} ─────────
  window._guardarDireccionNegocio = async function() {
    var inp = document.getElementById('mp2-dir-input');
    var dir = inp ? inp.value.trim() : '';
    if (!dir) { return; }
    var uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid)
              || localStorage.getItem('dcuserUid');
    if (!uid || !window._fbDb) { return; }
    try {
      var f = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      await f.setDoc(f.doc(window._fbDb,'usuarios',uid),{direccionNegocio:dir},{merge:true});
      var elDir2 = document.getElementById('mp2-srv-dir');
      if (elDir2) elDir2.textContent = dir;
      // Tostar confirmación si existe función toast en scope global
      if (typeof toast === 'function') toast('✅ Dirección guardada');
      else if (typeof window.toast === 'function') window.toast('✅ Dirección guardada');
    } catch(e) { }
  };
  // ── FIN DIRECCIÓN DEL NEGOCIO ────────────────────────────────

  // ── CONTADORES REALES HOME VECINO ────────────────────────────
  // Usa los mismos filtros que Food, Plaza y Servicios respectivamente.
  // No toca los listados reales. Solo actualiza los textos de los contadores.
  window._actualizarContadoresHome = async function() {
    var _db2 = window._fbDb;
    if (!_db2) return; // sin Firebase — mantener fallback estático
    try {
      var f = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var CATS_FOOD = ['mexicana','hamburguesas','pizzas','sushi','cafeteria','postres','tacos','mariscos','pollo','desayunos','bebidas','otro_rest'];
      var ESTADOS_OK = ['activo','aprobado_pendiente_pago'];

      // Consultas paralelas — igual que los listados reales
      var results = await Promise.all([
        f.getDocs(f.query(f.collection(_db2,'usuarios'), f.where('tipo','==','restaurante'))),
        f.getDocs(f.query(f.collection(_db2,'usuarios'), f.where('tipo','==','negocio'))),
        f.getDocs(f.query(f.collection(_db2,'usuarios'), f.where('tipo','==','proveedor')))
      ]);

      // Food: tipo=restaurante con ESTADOS_OK + tipo=negocio con CATS_FOOD y ESTADOS_OK
      var cntFood = 0;
      results[0].forEach(function(d){ var r=d.data(); if(ESTADOS_OK.indexOf(r.estado)!==-1) cntFood++; });
      results[1].forEach(function(d){ var r=d.data(); if(ESTADOS_OK.indexOf(r.estado)===-1) return; var cat=(r.categoria||'').toLowerCase(); if(CATS_FOOD.indexOf(cat)!==-1) cntFood++; });

      // Plaza: misma regla que cargarPlaza para que Home y listado cuenten igual.
      var cntPlaza = 0;
      results[1].forEach(function(d){
        var r=d.data();
        if(ESTADOS_OK.indexOf(r.estado)!==-1 && window.dcEsComercioPlaza && window.dcEsComercioPlaza(r)) cntPlaza++;
      });

      // Servicios: tipo=proveedor + estado=activo
      var cntServ = 0;
      results[2].forEach(function(d){ var r=d.data(); if(r.estado==='activo') cntServ++; });

      // Actualizar módulos en "¿Qué necesitas hoy?"
      var mFood  = document.getElementById('hm-mod-food');
      var mPlaza = document.getElementById('hm-mod-plaza');
      var mServ  = document.getElementById('hm-mod-serv');
      if (mFood)  mFood.textContent  = cntFood  > 0 ? cntFood  + ' restaurante' + (cntFood  !== 1 ? 's' : '') : 'Ver menú';
      if (mPlaza) mPlaza.textContent = cntPlaza > 0 ? cntPlaza + ' comercio'   + (cntPlaza !== 1 ? 's' : '') : 'Plaza Online';
      if (mServ)  mServ.textContent  = cntServ  > 0 ? cntServ  + ' verificado' + (cntServ  !== 1 ? 's' : '') : 'Ver servicios';

      // Actualizar banners del carrusel
      var bFood  = document.getElementById('hm-cnt-food');
      var bPlaza = document.getElementById('hm-cnt-plaza');
      var bServ  = document.getElementById('hm-cnt-serv');
      if (bFood)  bFood.textContent  = cntFood  > 0 ? cntFood  + ' restaurante' + (cntFood  !== 1 ? 's' : '') + ' disponibles' : 'Descubre restaurantes';
      if (bPlaza) bPlaza.textContent = cntPlaza > 0 ? cntPlaza + ' comercio'   + (cntPlaza !== 1 ? 's' : '') + ' · ofertas esta semana' : 'Comercios de tu zona';
      if (bServ)  bServ.textContent  = cntServ  > 0 ? cntServ  + ' proveedor'  + (cntServ  !== 1 ? 'es' : '') + ' verificados' : 'Encuentra un servicio';

    } catch(e) { /* falla silenciosa — fallback estático queda visible */ }
  };
  // ── FIN CONTADORES HOME VECINO ───────────────────────────────
  // localStorage keys: dcPromoDraft | dcPromoCarrito | dcPromoActivas
  // Sin pagos reales. Flujo: crear → preview → carrito → activar mock.


  // ── M2-G: BÚSQUEDA Y DESCUBRIMIENTO ─────────────────────────
  var SEARCH_KEY   = 'dcSearchRecent';
  var DISCOVER_KEY = 'dcDiscover';

  // Mock de contenido descubrible
  // buscarItems: consulta Firestore real (misma fuente que v-servicios).
  // Sin mocks. Sin arrays hardcodeados.
  // Retorna promesa. _renderBusqueda lo maneja con .then().
  window.buscarItems = async function(q) {
    if (!q || !q.trim()) return [];
    var lq = q.toLowerCase();
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(
        _fb.query(_fb.collection(window._fbDb,'usuarios'), _fb.where('tipo','==','proveedor'))
      );
      var results = [];
      snap.forEach(function(d) {
        var p = d.data(); p._id = d.id;
        if (p.estado !== 'activo') return;
        var haystack = [p.nombre||'', p.descripcion||'', p.categoria||'', p.oficio1||''].join(' ').toLowerCase();
        if (haystack.indexOf(lq) !== -1) results.push(p);
      });
      return results;
    } catch(e) {
      return [];
    }
  };

  window.getSearchRecent = function() {
    try { return JSON.parse(localStorage.getItem(SEARCH_KEY) || '[]'); } catch(e) { return []; }
  };

  window.addSearchRecent = function(q) {
    if (!q || !q.trim()) return;
    var list = window.getSearchRecent().filter(function(s){ return s !== q.trim(); });
    list.unshift(q.trim());
    localStorage.setItem(SEARCH_KEY, JSON.stringify(list.slice(0,5)));
  };

  // Descubrimiento: sin datos reales cargados aún → estado vacío elegante.
  window.renderDescubrimiento = function(contenedorId) {
    var el = document.getElementById(contenedorId);
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px 14px;">'
      + '<div style="font-size:28px;margin-bottom:8px;">🔎</div>'
      + '<div style="font-size:12px;font-weight:700;color:#444;margin-bottom:4px;">Aún no hay resultados disponibles</div>'
      + '<div style="font-size:11px;color:#999;line-height:1.5;">Cuando haya negocios o servicios<br>registrados aparecerán aquí.</div>'
      + '</div>';
  };

    // ── FIN M2-G helpers ─────────────────────────────────────────

  // ── M2-H: FAVORITOS + RECIENTES ─────────────────────────────
  // Clave por usuario: usa uid de Firebase si está disponible.
  // Fallback: dcuserTipo. Mismo patrón que _estadoKey() en M2-D.
  function _favKey() {
    var uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || '';
    return uid ? 'dcFavoritos_' + uid : 'dcFavoritos_t_' + (localStorage.getItem('dcuserTipo')||'u');
  }

  function _recKey() {
    var uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || '';
    return uid ? 'dcRecientes_' + uid : 'dcRecientes_t_' + (localStorage.getItem('dcuserTipo')||'u');
  }

  window.getFavs = function() {
    try { return JSON.parse(localStorage.getItem(_favKey()) || '[]'); } catch(e) { return []; }
  };

  window.isFav = function(provId) {
    return window.getFavs().some(function(f){ return f.id === provId; });
  };

  window.toggleFav = function(p) {
    var id = p._id || p.id || p.uid || p.nombre;
    var favs = window.getFavs();
    var idx = favs.findIndex ? favs.findIndex(function(f){ return f.id === id; })
              : (function(){ for(var i=0;i<favs.length;i++) if(favs[i].id===id) return i; return -1; })();
    if (idx !== -1) {
      favs.splice(idx, 1); // quitar
    } else {
      // agregar sin duplicados
      favs.unshift({ id:id, tipo:p._dcModulo||p._favTipo||'proveedor', nombre:p.nombreNegocio||p.nombrePublico||p.nombre||'—',
                     categoria:p.categoria||'', descripcion:p.descripcion||'',
                     datos: p, fecha: Date.now() });
    }
    localStorage.setItem(_favKey(), JSON.stringify(favs));
    // Actualizar botones de favorito visibles
    var _isFavNow = window.isFav(id);
    function _applyFavStyle(btn, active) {
      if (!btn) return;
      btn.textContent = active ? '❤️' : '🤍';
    }
    _applyFavStyle(document.getElementById('det-fav-btn'), _isFavNow);
    _applyFavStyle(document.getElementById('dcf-fav-btn'), _isFavNow);
    _applyFavStyle(document.getElementById('plaza-fav-btn'), _isFavNow);
    // Actualizar contador en Mi Panel si está visible
    var panelFavs = document.getElementById('panel-favs');
    if (panelFavs) panelFavs.textContent = String(window.getFavs().length);
    // Refrescar lista si v-favoritos está activo
    if (typeof cargarFavoritos === 'function') {
      var favVista = document.getElementById('v-favoritos');
      if (favVista && favVista.classList.contains('active')) cargarFavoritos();
    }
  };

  window.addReciente = function(p) {
    var id = p._id || p.id || p.uid || p.nombre;
    try {
      var list = JSON.parse(localStorage.getItem(_recKey()) || '[]');
      list = list.filter(function(r){ return r.id !== id; });
      list.unshift({ id:id, tipo:'proveedor', nombre:p.nombre||'—',
                     categoria:p.categoria||'', datos:p, fecha:Date.now() });
      localStorage.setItem(_recKey(), JSON.stringify(list.slice(0, 10)));
    } catch(e) {}
  };
  // ── FIN M2-H helpers ─────────────────────────────────────────

  // ── M2-I: NOTIFICACIONES REALES ──────────────────────────────
  // Fuente: Firestore colección 'notificaciones', campo uid = currentUser.uid
  // Sin seeds. Sin mocks. Vacío elegante si colección vacía o inexistente.

  window.cargarNotificaciones = async function() {
    var user = (window._fbAuth && window._fbAuth.currentUser) || null;
    if (!user) {
      user = await new Promise(function(resolve) {
        var done = false;
        var t = setTimeout(function(){ if(!done){done=true;resolve(null);} }, 3000);
        if (window._fbAuth && window._fbAuth.onAuthStateChanged) {
          window._fbAuth.onAuthStateChanged(function(u){
            if(!done){done=true;clearTimeout(t);resolve(u||null);}
          });
        } else { clearTimeout(t); resolve(null); }
      });
    }
    if (!user) return [];
    var _db = window._fbDb;
    if (!_db) return [];
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var q = _fb.query(
        _fb.collection(_db, 'notificaciones'),
        _fb.where('uid', '==', user.uid),
        _fb.limit(50)
      );
      var snap = await _fb.getDocs(q);
      var notifs = [];
      snap.forEach(function(d){ var n=d.data(); n._id=d.id; if(!n.eliminada) notifs.push(n); });
      notifs.sort(function(a,b){
        var ta=a.fecha&&a.fecha.toMillis?a.fecha.toMillis():0;
        var tb=b.fecha&&b.fecha.toMillis?b.fecha.toMillis():0;
        return tb-ta;
      });
      return notifs;
    } catch(e){ console.error('[NOTIF]',e.code||'',e.message); return []; }
  };

  window.marcarNotifLeida = async function(id) {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !id || !_db) return;
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      await _fb.updateDoc(_fb.doc(_db, 'notificaciones', id), { leida: true });
      window.actualizarBadgesReales && window.actualizarBadgesReales();
    } catch(e){ console.error('[NOTIF]',e.message); }
  };

  if (!window._badgeTimer) {
    window._badgeTimer = setInterval(function() {
      if (window._fbAuth && window._fbAuth.currentUser) {
        window.actualizarBadgesReales && window.actualizarBadgesReales();
        // Si el restaurante está en su home, recalcular sus tarjetas sin refresh
        var _hv = document.getElementById('v-home');
        var _t = (localStorage.getItem('dcuserTipo')||'').toLowerCase();
        if (_t==='restaurante' && _hv && _hv.classList.contains('active')) {
          window._calcMetricasRest && window._calcMetricasRest('hoy');
        }
        // Si el negocio está en su Centro Operativo, refrescar su estado/badge sin refresh
        var _vnh = document.getElementById('vn-home');
        if (_vnh && _vnh.classList.contains('active')) {
          window._vnegSyncHomeBadge && window._vnegSyncHomeBadge();
        }
        // Si el negocio está en su home principal, recalcular métricas
        var _vh = document.getElementById('v-home');
        if (_t==='negocio' && _vh && _vh.classList.contains('active')) {
          window._calcMetricasNeg && window._calcMetricasNeg();
        }
        // REGLA #3: si el vecino está en Dominio Food, refrescar estados de la lista sin salir
        var _fv = document.getElementById('v-food');
        if (_fv && _fv.classList.contains('active')) {
          window.dcFood_cargarRestaurantes && window.dcFood_cargarRestaurantes();
        }
        // Si restaurante O negocio está viendo su pantalla de Ventas, recalcular en vivo
        var _vv = document.getElementById('vr-ventas');
        if (_vv && _vv.classList.contains('active')) {
          window._vrvCalc && window._vrvCalc();
        }
      }
    }, 45000);
  }

  window._marcarPedidosLeidos = async function() {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var q = _fb.query(
        _fb.collection(_db, 'notificaciones'),
        _fb.where('uid', '==', user.uid),
        _fb.where('leida', '==', false),
        _fb.where('modulo', '==', 'pedidos')
      );
      var snap = await _fb.getDocs(q);
      if (snap.empty) return;
      var batch = _fb.writeBatch(_db);
      snap.forEach(function(d) { batch.update(d.ref, { leida: true }); });
      await batch.commit();
      window.actualizarBadgesReales && window.actualizarBadgesReales();
    } catch(e) { }
  };

  window.marcarTodasLeidas = async function() {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var q = _fb.query(
        _fb.collection(_db, 'notificaciones'),
        _fb.where('uid', '==', user.uid),
        _fb.where('leida', '==', false)
      );
      var snap = await _fb.getDocs(q);
      var batch = _fb.writeBatch(_db);
      snap.forEach(function(d) { batch.update(d.ref, { leida: true }); });
      await batch.commit();
    } catch(e) { }
  };

  // Actualiza badges del home con conteos reales de Firestore
  window.actualizarBadgesReales = async function() {
    var notifs = await window.cargarNotificaciones();
    // Contar no leídas por módulo
    var counts = {};
    notifs.forEach(function(n) {
      if (!n.leida && n.modulo) {
        counts[n.modulo] = (counts[n.modulo] || 0) + 1;
      }
    });
    // Actualizar badge de cada módulo
    var MODULOS = ['chats','solicitudes','pedidos','promocion','sistema'];
    MODULOS.forEach(function(m) {
      if (counts[m]) {
        window.setBadge && window.setBadge(m, counts[m], 'normal');
      } else {
        window.setBadge && window.setBadge(m, 0, 'normal'); // limpia
      }
    });
    window._lastBadgeCheck = Date.now();
    // Badge pedidos
    var totPed = notifs.filter(function(n){ return !n.leida && (n.modulo||'') === 'pedidos'; }).length;
    document.querySelectorAll('.nav-ped-dot').forEach(function(el) {
      el.style.display = totPed > 0 ? 'inline-block' : 'none';
      el.textContent = totPed > 99 ? '99+' : (totPed || '');
    });
    // Badge agenda: solo respuestas de reserva que le llegaron al vecino
    var totAgenda = notifs.filter(function(n){
      var m = (n.modulo||'').toLowerCase();
      var t = (n.tipo||'').toLowerCase();
      return !n.leida && (m==='reserva'||m==='agenda'||m==='proveedor_interesado'||t==='reserva'||t==='agenda'||t==='proveedor_interesado');
    }).length;
    document.querySelectorAll('.nav-agenda-dot').forEach(function(el) {
      el.style.display = totAgenda > 0 ? 'inline-block' : 'none';
    });
    // Badge campana: solo sistema/admin/promocion
    var total = notifs.filter(function(n){
      var m = (n.modulo||'').toLowerCase();
      var t = (n.tipo||'').toLowerCase();
      return !n.leida && (m==='sistema'||m==='admin'||m==='promocion'||t==='sistema'||t==='admin'||t==='promocion');
    }).length;
    document.querySelectorAll('.notif-dot:not(.nav-ped-dot):not(.nav-agenda-dot)').forEach(function(el) {
      el.style.display = total > 0 ? 'inline-block' : 'none';
    });
    return notifs;
  };

  // Ruta de módulo para notificación
  window._notifRuta = function(n) {
    var m = n.modulo || n.tipo || '';
    if (m === 'chat')               return function(){ go('v-mis-chats','right'); setTimeout(cargarMisChats,200); };
    if (m === 'solicitud')          return function(){ go('v-reportes-disponibles','right'); };
    if (m === 'solicitudes_vecino') return function(){ go('v-mis-reportes','right'); setTimeout(function(){ window.cargarMisReportes&&window.cargarMisReportes(); },300); };
    if (m === 'pedido' || m === 'pedidos') return function(){
      // Si el usuario es restaurante (tiene vr-home), ir a sus pedidos
      // Si es vecino, ir a sus pedidos de Food
      var esRest = document.getElementById('vr-home') && typeof navTo === 'function';
      if (esRest && window._fbAuth && window._fbAuth.currentUser) {
        var tipo = (localStorage.getItem('dcuserTipo') || '').toLowerCase();
        if (tipo === 'restaurante' || tipo === 'negocio') { navTo('vr-pedidos'); return; }
      }
      go('v-mis-pedidos-food','right');
    };
    if (m === 'promocion')          return function(){ window.irACrearPromo && window.irACrearPromo(); };
    if (m === 'agenda')             return function(){ go('v-agenda-reservas','right'); setTimeout(function(){ window._initAgendaReservas&&window._initAgendaReservas(); },200); };
    if (m === 'mi_agenda')          return function(){ go('v-mi-agenda','right'); setTimeout(function(){ window._initMiAgenda&&window._initMiAgenda(); },200); };
    return null; // sin ruta específica
  };
  // ── FIN M2-I helpers ─────────────────────────────────────────

  // ── M2-J: AGENDA / RESERVAS ──────────────────────────────────
  // localStorage por ahora. Preparado para Firestore.
  // Clave: dcAgenda_[uid] o dcAgenda_t_[tipo] como fallback.

  function _agendaKey() {
    var _a = window._fbAuth;
    var uid = (_a && _a.currentUser && _a.currentUser.uid) || localStorage.getItem('dcuserUid') || '';
    return uid ? 'dcAgenda_' + uid : 'dcAgenda_t_' + (localStorage.getItem('dcuserTipo')||'u');
  }

  window.getAgenda = function() {
    try {
      var raw = localStorage.getItem(_agendaKey());
      if (!raw) return { dias:[], horarios:[], estado:'activo', reservas:[] };
      return JSON.parse(raw);
    } catch(e) { return { dias:[], horarios:[], estado:'activo', reservas:[] }; }
  };

  window.saveAgenda = function(agenda) {
    try { localStorage.setItem(_agendaKey(), JSON.stringify(agenda)); } catch(e) {}
    // Sync to Firestore so vecinos on other devices can read it
    var _a = window._fbAuth;
    var uid = (_a && _a.currentUser && _a.currentUser.uid) || localStorage.getItem('dcuserUid') || '';
    if (uid && window._fbDb) {
      import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js').then(function(_fb) {
        _fb.setDoc(_fb.doc(window._fbDb, 'agendas', uid), agenda).catch(function(e){ });
      });
    }
  };

  // ── FIN M2-J helpers ─────────────────────────────────────────

  // ── M2-J: RESERVAS (vecino → proveedor) ──────────────────────
  function _reservasKey() {
    var uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || '';
    return uid ? 'dcReservas_' + uid : 'dcReservas_t_' + (localStorage.getItem('dcuserTipo')||'u');
  }

  window.getReservas = function() {
    try { return JSON.parse(localStorage.getItem(_reservasKey()) || '[]'); } catch(e) { return []; }
  };

  window.guardarReserva = async function(reserva) {
    try {
      // Validar proveedorUid antes de cualquier operación
      if (!reserva.proveedorUid) {
        return { ok: false, msg: 'No se pudo identificar al proveedor.' };
      }

      // Resolver identidad del vecino:
      // 1. window._fbAuth.currentUser.uid si ya está disponible
      // 2. Esperar hasta 3s a que Firebase inicialice window._fbAuth
      // 3. Fallback: uid derivado de localStorage (usuario logueado en la app)
      var vecinoUid = '';
      var vecinoNombre = reserva.vecinoNombre || localStorage.getItem('dcuser') || 'Vecino';

      // Intento 1: currentUser ya disponible
      if (window._fbAuth && window._fbAuth.currentUser) {
        vecinoUid = window._fbAuth.currentUser.uid;
      } else {
        // Intento 2: esperar onAuthStateChanged hasta 3 segundos
        vecinoUid = await new Promise(function(resolve) {
          var resolved = false;
          var timer = setTimeout(function() {
            if (!resolved) { resolved = true; resolve(''); }
          }, 3000);
          if (window._fbAuth && window._fbAuth.onAuthStateChanged) {
            window._fbAuth.onAuthStateChanged(function(u) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(u ? u.uid : '');
              }
            });
          } else {
            clearTimeout(timer);
            resolve('');
          }
        });
      }

      // Fallback: uid guardado en localStorage durante el login
      if (!vecinoUid) {
        vecinoUid = localStorage.getItem('dcuserUid') || '';
      }

      // Sin uid real — sesión expirada
      if (!vecinoUid) {
        return { ok: false, msg: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
      }

      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');

      // Verificar duplicado
      var qDup = _fb.query(
        _fb.collection(window._fbDb, 'reservas'),
        _fb.where('vecinoUid', '==', vecinoUid),
        _fb.where('proveedorUid', '==', reserva.proveedorUid),
        _fb.where('dia', '==', reserva.dia),
        _fb.where('hora', '==', reserva.hora)
      );
      var dupSnap = await _fb.getDocs(qDup);
      if (!dupSnap.empty) return { ok: false, msg: 'Ya tienes una reserva con este proveedor ese día y hora.' };

      // LOG DIAGNÓSTICO
      // Guardar reserva en Firestore
      var docRef = await _fb.addDoc(_fb.collection(window._fbDb, 'reservas'), {
        proveedorUid:    reserva.proveedorUid,
        proveedorNombre: reserva.proveedorNombre || '—',
        vecinoUid:       vecinoUid,
        vecinoNombre:    vecinoNombre,
        dia:             reserva.dia,
        hora:            reserva.hora,
        nota:            reserva.nota || '',
        estado:          'pendiente',
        creada:          _fb.serverTimestamp(),
        expiresAt:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 días
      });

      // Notificación para el proveedor
      try {
        await _fb.addDoc(_fb.collection(window._fbDb, 'notificaciones'), {
          uid:       reserva.proveedorUid,
          tipo:      'reserva',
          modulo:    'agenda',
          titulo:    'Nueva reserva',
          mensaje:   vecinoNombre + ' solicitó ' + reserva.dia + ' a las ' + reserva.hora,
          leida:     false,
          eliminada: false,
          prioridad: 'normal',
          reservaId: docRef.id,
          fecha:     _fb.serverTimestamp(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)  // 14 días
        });
      } catch(ne) {
        // Notificación es secundaria — no bloquear si falla
        console.error('[NOTIF ERROR]', ne.code || '', ne.message);
      }

      return { ok: true, id: docRef.id };
    } catch(e) {
      console.error('[RESERVA ERROR]', e.code || '', e.message);
      return { ok: false, msg: 'No se pudo guardar: ' + e.message };
    }
  };

  window._actualizarEstadoReserva = async function(reservaId, nuevoEstado) {
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      await _fb.updateDoc(_fb.doc(window._fbDb, 'reservas', reservaId), { estado: nuevoEstado });
      window._renderAgenda && window._renderAgenda();
    } catch(e) { toast('⚠️ No se pudo actualizar: ' + e.message); }
  };

  // Abre v-reservar — SIN Firestore. Firestore solo se usa al confirmar.
  window._irAReservar = function() {
    var p  = window._proveedorActual;
    var ag = window._agendaProveedorActual;
    if (!p || !ag || !ag.horarios || !ag.horarios.length) return;
    go('v-reservar', 'right');
    setTimeout(function() { window._renderReservar && window._renderReservar(); }, 150);
  };
  // ── FIN M2-J reservas ────────────────────────────────────────


  // ── Helpers globales DC — definidos una sola vez ──────────────
  window._dcProximamente = function(msg) { toast('🔧 ' + (msg || 'Próximamente disponible.')); };

  // Reemplaza confirm() — modal bottom-sheet con Cancelar / Confirmar
  window._dcConfirmar = function(msg, onSi, onNo, opts) {
    opts = opts || {};
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'
      + '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:16px;line-height:1.4;">' + msg + '</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="_dcCNo" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;">' + (opts.lblNo||'Cancelar') + '</button>'
      + '<button id="_dcCSi" style="flex:1;background:' + (opts.colorSi||'#D63A2A') + ';color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">' + (opts.lblSi||'Confirmar') + '</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cerrar(){ if(ov.parentNode) document.body.removeChild(ov); }
    ov.querySelector('#_dcCSi').onclick = function(){ cerrar(); if(onSi) onSi(); };
    ov.querySelector('#_dcCNo').onclick = function(){ cerrar(); if(onNo) onNo(); };
    ov.onclick = function(e){ if(e.target===ov){ cerrar(); if(onNo) onNo(); } };
  };

  // Diálogo informativo con un solo botón — reemplaza alert()
  window._dcAlerta = function(msg, onOk) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'
      + '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:16px;line-height:1.4;">' + msg + '</div>'
      + '<button id="_dcAOk" style="width:100%;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Entendido</button>'
      + '</div>';
    document.body.appendChild(ov);
    function cerrar(){ if(ov.parentNode) document.body.removeChild(ov); }
    ov.querySelector('#_dcAOk').onclick = function(){ cerrar(); if(onOk) onOk(); };
    ov.onclick = function(e){ if(e.target===ov){ cerrar(); if(onOk) onOk(); } };
  };

  // Versión Promise de _dcConfirmar para usar con await en funciones async
  window._dcConfirmarAsync = function(msg, opts) {
    return new Promise(function(resolve){
      window._dcConfirmar(msg, function(){ resolve(true); }, function(){ resolve(false); }, opts);
    });
  };

  // Reemplaza prompt() — modal bottom-sheet con input de texto
  window._dcPedirTexto = function(titulo, placeholder, onOk, onCancel) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'
      + '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:14px;">' + titulo + '</div>'
      + '<input id="_dcPTInp" type="text" placeholder="' + (placeholder||'') + '" style="width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid #e0e0e0;font-size:14px;font-family:\'Inter\',sans-serif;outline:none;margin-bottom:14px;box-sizing:border-box;">'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="_dcPTNo" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;">Cancelar</button>'
      + '<button id="_dcPTOk" style="flex:1;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Agregar</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('#_dcPTInp');
    setTimeout(function(){ inp.focus(); }, 80);
    function cerrar(){ if(ov.parentNode) document.body.removeChild(ov); }
    ov.querySelector('#_dcPTOk').onclick = function(){ var v=inp.value.trim(); if(!v) return; cerrar(); if(onOk) onOk(v); };
    ov.querySelector('#_dcPTNo').onclick = function(){ cerrar(); if(onCancel) onCancel(); };
    ov.onclick = function(e){ if(e.target===ov){ cerrar(); if(onCancel) onCancel(); } };
    inp.addEventListener('keydown', function(e){
      if(e.key==='Enter'){ var v=inp.value.trim(); if(v){ cerrar(); if(onOk) onOk(v); } }
      if(e.key==='Escape'){ cerrar(); if(onCancel) onCancel(); }
    });
  };


// ══════════════════════════════════════════════════════════════════════════════
// ── PASO 10: PANEL PLANES IMPULSA + CAMPAÑAS (Maestro) ───────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Estilos ───────────────────────────────────────────────────────────────────
(function(){
  var s=document.createElement('style');
  s.textContent=[
    '.camp-tab{padding:7px 14px;font-size:11px;font-weight:700;color:rgba(255,255,255,.45);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;cursor:pointer;font-family:"Inter",sans-serif;white-space:nowrap;flex-shrink:0;}',
    '.camp-tab.on{color:#2E86C1;background:rgba(46,134,193,.15);border-color:rgba(46,134,193,.4);}',
    '.impulsa-card{background:rgba(245,197,24,.07);border:1px solid rgba(245,197,24,.2);border-radius:14px;padding:13px 14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;}',
    '.impulsa-card.basico{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08);}',
    '.camp-item{background:rgba(46,134,193,.07);border:1px solid rgba(46,134,193,.2);border-radius:14px;padding:13px 14px;margin-bottom:10px;}',
    '.camp-item.vencida{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.06);opacity:.6;}',
  ].join('');
  document.head.appendChild(s);
})();

// ═══════════════════════════════════════════
// PLANES IMPULSA
// ═══════════════════════════════════════════
var _planesCache = [];
var _planesFiltro = 'activos';
var _planesSearch = '';

window.adminPlanesCargar = async function() {
  var db = window._fbDb; if(!db) return;
  var lista = document.getElementById('planes-lista');
  if(lista) lista.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:13px;">Cargando... ⏳</div>';
  try {
    var f = await import(_FBFS);
    var snap = await f.getDocs(f.query(f.collection(db,'usuarios'), f.where('esAdmin','!=',true)));
    _planesCache = [];
    snap.forEach(function(doc){
      var d = doc.data();
      if(['proveedor','restaurante','negocio'].indexOf((d.tipo||'').toLowerCase()) >= 0 ||
         (d.plan && d.plan==='impulsa')){
        _planesCache.push(Object.assign({uid:doc.id}, d));
      }
    });
    window.adminPlanesRender();
  } catch(e) { if(lista) lista.innerHTML='<div style="color:#ff6b6b;padding:20px;text-align:center;">Error: '+e.message+'</div>'; }
};

window.adminPlanesMostrar = function(filtro) {
  _planesFiltro = filtro;
  document.getElementById('ptab-activos').style.color = filtro==='activos'?'#F5C518':'rgba(255,255,255,.5)';
  document.getElementById('ptab-activos').style.background = filtro==='activos'?'rgba(245,197,24,.12)':'rgba(255,255,255,.05)';
  document.getElementById('ptab-todos').style.color = filtro==='todos'?'#fff':'rgba(255,255,255,.5)';
  document.getElementById('ptab-todos').style.background = filtro==='todos'?'rgba(255,255,255,.1)':'rgba(255,255,255,.05)';
  window.adminPlanesRender();
};

window.adminPlanesFiltrar = function(q) {
  _planesSearch = (q||'').toLowerCase();
  window.adminPlanesRender();
};

window.adminPlanesRender = function() {
  var ahora = Date.now();
  var lista = document.getElementById('planes-lista');
  if(!lista) return;
  var items = _planesCache.filter(function(u){
    var esImpulsa = (u.plan==='impulsa') && u.planVence &&
      ((u.planVence.toMillis?u.planVence.toMillis():(u.planVence.seconds||0)*1000) > ahora);
    if(_planesFiltro==='activos' && !esImpulsa) return false;
    if(_planesSearch){
      var nom=(u.nombrePublico||u.nombreNegocio||u.nombre||u.correo||'').toLowerCase();
      if(nom.indexOf(_planesSearch)<0) return false;
    }
    return true;
  });
  if(items.length===0){
    lista.innerHTML='<div style="text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:13px;">'
      +(_planesFiltro==='activos'?'No hay planes Impulsa activos':'Sin negocios registrados')+'</div>';
    return;
  }
  var html = items.map(function(u){
    var ahora2 = Date.now();
    var esImpulsa = (u.plan==='impulsa') && u.planVence &&
      ((u.planVence.toMillis?u.planVence.toMillis():(u.planVence.seconds||0)*1000) > ahora2);
    var venceStr = '';
    if(esImpulsa && u.planVence){
      var ms = u.planVence.toMillis?u.planVence.toMillis():(u.planVence.seconds||0)*1000;
      var dias = Math.ceil((ms-ahora2)/86400000);
      venceStr = 'Vence en '+dias+' día'+(dias!==1?'s':'');
    }
    var nom = u.nombrePublico||u.nombreNegocio||u.nombre||'Sin nombre';
    var tipo = u.tipo||'';
    return '<div class="impulsa-card'+(esImpulsa?'':' basico')+'" onclick="window.adminPlanesEditar(\''+u.uid+'\')">'
      +'<div style="width:40px;height:40px;border-radius:10px;background:'+(esImpulsa?'rgba(245,197,24,.2)':'rgba(255,255,255,.06)')+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">'
      +(esImpulsa?'⭐':'🏪')+'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(nom)+'</div>'
      +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;">'+_esc(tipo)
      +(esImpulsa?' · <span style="color:#F5C518;">'+_esc(venceStr)+'</span>':' · Plan Básico')+'</div>'
      +'</div>'
      +'<span style="color:rgba(255,255,255,.3);font-size:18px;">›</span>'
      +'</div>';
  }).join('');
  lista.innerHTML = html;
};

window.adminPlanesEditar = function(uid) {
  var u = _planesCache.find(function(x){return x.uid===uid;});
  if(!u) return;
  window._adminPlanesUidActual = uid;
  document.getElementById('pf-nombre-neg').textContent = u.nombrePublico||u.nombreNegocio||u.nombre||'Sin nombre';
  document.getElementById('pf-uid-neg').textContent = 'UID: '+uid;
  document.getElementById('pf-titulo').textContent = u.nombrePublico||u.nombreNegocio||u.nombre||'Negocio';
  // Pre-seleccionar plan actual
  var sel = document.getElementById('pf-plan-tipo');
  if(u.plan==='impulsa') sel.value='impulsa_mes';
  else sel.value='basico';
  // Fecha de hoy como default
  var hoy = new Date(); var mm=String(hoy.getMonth()+1).padStart(2,'0'); var dd=String(hoy.getDate()).padStart(2,'0');
  document.getElementById('pf-inicio').value = hoy.getFullYear()+'-'+mm+'-'+dd;
  _adminPlanesActualizarResumen();
  document.getElementById('pf-error').style.display='none';
  go('v-admin-planes-form','right');
};

function _adminPlanesActualizarResumen(){
  var tipo = document.getElementById('pf-plan-tipo').value;
  var inicioVal = document.getElementById('pf-inicio').value;
  var res = document.getElementById('pf-resumen');
  var btn = document.getElementById('pf-guardar-btn');
  if(tipo==='basico'){
    res.textContent='El negocio pasará al Plan Básico (sin costo). Se eliminarán los campos de plan Impulsa.';
    btn.textContent='Pasar a Plan Básico';
    btn.style.background='rgba(255,255,255,.1)';
    btn.style.color='rgba(255,255,255,.7)';
    return;
  }
  btn.style.background='linear-gradient(135deg,#c8940a,#F5C518)';
  btn.style.color='#1A3A5C';
  btn.textContent='⭐ Activar Plan Impulsa';
  if(!inicioVal){res.textContent='Selecciona fecha de inicio.';return;}
  var dias = tipo==='impulsa_mes'?30:365;
  var precio = tipo==='impulsa_mes'?'$199':'$1,999';
  var inicio = new Date(inicioVal+'T12:00:00');
  var fin = new Date(inicio.getTime()+dias*86400000);
  var opts={day:'numeric',month:'long',year:'numeric'};
  res.innerHTML='Plan: <b style="color:#F5C518;">Impulsa '+(tipo==='impulsa_mes'?'Mensual':'Anual')+'</b><br>'
    +'Precio: <b>'+precio+'</b><br>'
    +'Inicio: '+inicio.toLocaleDateString('es-MX',opts)+'<br>'
    +'Vence: '+fin.toLocaleDateString('es-MX',opts);
}

// Escuchar cambios en el form de planes
(function(){
  var bindPlan = function(){
    var sel=document.getElementById('pf-plan-tipo');
    var ini=document.getElementById('pf-inicio');
    if(sel) sel.addEventListener('change',_adminPlanesActualizarResumen);
    if(ini) ini.addEventListener('change',_adminPlanesActualizarResumen);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bindPlan);
  else bindPlan();
})();

window.adminPlanesGuardar = async function() {
  var db = window._fbDb; if(!db) return;
  var uid = window._adminPlanesUidActual; if(!uid) return;
  var tipo = document.getElementById('pf-plan-tipo').value;
  var inicioVal = document.getElementById('pf-inicio').value;
  var errEl = document.getElementById('pf-error');
  errEl.style.display='none';
  if(tipo!=='basico' && !inicioVal){ errEl.textContent='Selecciona la fecha de inicio.';errEl.style.display='block';return; }
  var btn = document.getElementById('pf-guardar-btn');
  btn.disabled=true; btn.textContent='Guardando...';
  try {
    var f = await import(_FBFS);
    var datos;
    if(tipo==='basico'){
      datos={ plan:'basico', planTipo:f.deleteField(), planInicio:f.deleteField(), planVence:f.deleteField() };
    } else {
      var dias = tipo==='impulsa_mes'?30:365;
      var inicio = new Date(inicioVal+'T12:00:00');
      var fin = new Date(inicio.getTime()+dias*86400000);
      datos = { plan:'impulsa', planTipo:tipo==='impulsa_mes'?'mensual':'anual', planInicio:inicio, planVence:fin };
    }
    await f.updateDoc(f.doc(db,'usuarios',uid), datos);
    var idx = _planesCache.findIndex(function(x){return x.uid===uid;});
    if(idx>=0) Object.assign(_planesCache[idx], datos);
    btn.disabled=false;
    window.toast && window.toast('✅ Plan actualizado correctamente');
    go('v-admin-planes','left');
    window.adminPlanesCargar();
  } catch(e) {
    btn.disabled=false; btn.textContent='⭐ Activar Plan Impulsa';
    errEl.textContent='Error: '+e.message; errEl.style.display='block';
  }
};

// ═══════════════════════════════════════════
// CAMPAÑAS
// ═══════════════════════════════════════════
var _campanasCache = [];
var _campanasSec = 'todas';

window.adminCampanasCargar = async function() {
  var db = window._fbDb; if(!db) return;
  var lista = document.getElementById('campanas-admin-lista');
  if(lista) lista.innerHTML='<div style="text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:13px;">Cargando... ⏳</div>';
  try {
    var f = await import(_FBFS);
    var snap = await f.getDocs(f.query(f.collection(db,'campanas'), f.orderBy('orden','asc')));
    _campanasCache = [];
    snap.forEach(function(doc){ _campanasCache.push(Object.assign({id:doc.id}, doc.data())); });
    window.adminCampanasRender();
  } catch(e) { if(lista) lista.innerHTML='<div style="color:#ff6b6b;padding:20px;text-align:center;">Error: '+e.message+'</div>'; }
};

window.adminCampanasTab = function(sec) {
  _campanasSec = sec;
  document.querySelectorAll('.camp-tab').forEach(function(b){
    var on = b.dataset.sec===sec;
    b.classList.toggle('on',on);
  });
  window.adminCampanasRender();
};

window.adminCampanasRender = function() {
  var lista = document.getElementById('campanas-admin-lista');
  if(!lista) return;
  var ahora = Date.now();
  var items = _campanasCache.filter(function(c){
    if(_campanasSec!=='todas' && c.ubicacion!==_campanasSec) return false;
    return true;
  });
  if(items.length===0){
    lista.innerHTML='<div style="text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:13px;">No hay campañas'
      +(_campanasSec!=='todas'?' en esta sección':'')+'</div>';
    return;
  }
  lista.innerHTML = items.map(function(c){
    var finMs = c.fin && c.fin.toMillis ? c.fin.toMillis() : (c.fin&&c.fin.seconds?c.fin.seconds*1000:0);
    var activa = finMs > ahora && c.estado==='activa';
    var diasRest = activa?Math.ceil((finMs-ahora)/86400000):0;
    var secLabel={home:'Home',food:'Food',plaza:'Plaza',servicios:'Servicios',informa:'Informa',eventos:'Eventos'}[c.ubicacion]||c.ubicacion;
    return '<div class="camp-item'+(activa?'':' vencida')+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      +'<div style="display:flex;align-items:center;gap:8px;">'
      +'<div style="background:'+(activa?'rgba(46,134,193,.2)':'rgba(255,255,255,.05)')+';border-radius:8px;padding:3px 10px;font-size:10px;font-weight:700;color:'+(activa?'#7ac8ff':'rgba(255,255,255,.3)')+';letter-spacing:.3px;">'+_esc(secLabel)+'</div>'
      +(activa?'<div style="font-size:10px;color:rgba(255,255,255,.4);">'+diasRest+' días restantes</div>':'<div style="font-size:10px;color:rgba(255,255,255,.25);">Vencida</div>')
      +'</div>'
      +'<button onclick="window.adminCampanasEliminar(\''+c.id+'\')" style="background:rgba(214,58,42,.15);border:1px solid rgba(214,58,42,.25);border-radius:8px;padding:4px 10px;font-size:10px;font-weight:700;color:#ff6b6b;cursor:pointer;font-family:\'Inter\',sans-serif;">Eliminar</button>'
      +'</div>'
      +'<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:2px;">'+_esc(c.nombre||'Sin nombre')+'</div>'
      +(c.texto?'<div style="font-size:11px;color:rgba(255,255,255,.5);">'+_esc(c.texto)+'</div>':'')
      +'</div>';
  }).join('');
};

window._cfUrlManual = function(val) {
  var prev = document.getElementById('cf-img-preview');
  var img  = document.getElementById('cf-img-preview-img');
  if (val && prev && img) { img.src = val; prev.style.display = 'block'; }
  else if (prev) { prev.style.display = 'none'; }
};

window.adminCampanasSubirImagen = async function(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var storage = window._fbStorage;
  if (!storage) { window.toast && window.toast('Firebase Storage no disponible'); return; }

  var btn = document.getElementById('cf-upload-btn');
  var prog = document.getElementById('cf-upload-progress');
  var bar  = document.getElementById('cf-upload-bar');
  var pct  = document.getElementById('cf-upload-pct');
  var prev = document.getElementById('cf-img-preview');
  var prevImg = document.getElementById('cf-img-preview-img');

  if (btn)  { btn.disabled = true; btn.textContent = '⏳ Subiendo...'; }
  if (prog) prog.style.display = 'block';
  if (bar)  bar.style.width = '0%';

  try {
    var { ref, uploadBytesResumable, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js');
    var nombre = 'campanas/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    var storRef = ref(storage, nombre);
    var task = uploadBytesResumable(storRef, file);

    task.on('state_changed',
      function(snap) {
        var p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (bar) bar.style.width = p + '%';
        if (pct) pct.textContent = p + '%';
      },
      function(err) {
        if (btn)  { btn.disabled = false; btn.textContent = '📷 Seleccionar imagen'; }
        if (prog) prog.style.display = 'none';
        window.toast && window.toast('Error al subir: ' + err.message);
      },
      async function() {
        var url = await getDownloadURL(task.snapshot.ref);
        var inpUrl = document.getElementById('cf-imagen');
        if (inpUrl) inpUrl.value = url;
        if (prev && prevImg) { prevImg.src = url; prev.style.display = 'block'; }
        if (btn)  { btn.disabled = false; btn.innerHTML = '✅ Imagen lista'; }
        if (prog) prog.style.display = 'none';
        window.toast && window.toast('✅ Imagen subida');
      }
    );
  } catch(e) {
    if (btn)  { btn.disabled = false; btn.textContent = '📷 Seleccionar imagen'; }
    if (prog) prog.style.display = 'none';
    window.toast && window.toast('Error: ' + e.message);
  }
};

window.adminCampanasNueva = function() {
  // Limpiar form
  ['cf-nombre','cf-texto','cf-imagen','cf-negocio-id'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var hoy=new Date(); var mm=String(hoy.getMonth()+1).padStart(2,'0'); var dd=String(hoy.getDate()).padStart(2,'0');
  var finDate=new Date(hoy.getTime()+30*86400000);
  var mm2=String(finDate.getMonth()+1).padStart(2,'0'); var dd2=String(finDate.getDate()).padStart(2,'0');
  var ini=document.getElementById('cf-inicio'); if(ini) ini.value=hoy.getFullYear()+'-'+mm+'-'+dd;
  var fin=document.getElementById('cf-fin'); if(fin) fin.value=finDate.getFullYear()+'-'+mm2+'-'+dd2;
  var err=document.getElementById('cf-error'); if(err) err.style.display='none';
  var prev=document.getElementById('cf-img-preview'); if(prev) prev.style.display='none';
  var btn=document.getElementById('cf-upload-btn'); if(btn){btn.disabled=false;btn.innerHTML='📷 Seleccionar imagen';}
  var prog=document.getElementById('cf-upload-progress'); if(prog) prog.style.display='none';
  var fi=document.getElementById('cf-imagen-file'); if(fi) fi.value='';
  go('v-admin-campanas-form','right');
};

window.adminCampanasGuardar = function() {
  var db = window._fbDb; if(!db) return;
  var nombre = (document.getElementById('cf-nombre').value||'').trim();
  var texto  = (document.getElementById('cf-texto').value||'').trim();
  var imagen = (document.getElementById('cf-imagen').value||'').trim();
  var ubic   = document.getElementById('cf-ubicacion').value;
  var iniVal = document.getElementById('cf-inicio').value;
  var finVal = document.getElementById('cf-fin').value;
  var negId  = (document.getElementById('cf-negocio-id').value||'').trim();
  var errEl  = document.getElementById('cf-error');
  errEl.style.display='none';
  if(!nombre){ errEl.textContent='El nombre del negocio es obligatorio.'; errEl.style.display='block'; return; }
  if(!iniVal||!finVal){ errEl.textContent='Las fechas de inicio y fin son obligatorias.'; errEl.style.display='block'; return; }
  // Contar slots activos en esa ubicación
  var ahora=Date.now();
  var slotsActivos=_campanasCache.filter(function(c){
    if(c.ubicacion!==ubic||c.estado!=='activa') return false;
    var ms=c.fin&&c.fin.toMillis?c.fin.toMillis():(c.fin&&c.fin.seconds?c.fin.seconds*1000:0);
    return ms>ahora;
  }).length;
  if(slotsActivos>=10){ errEl.textContent='Esta sección ya tiene 10 banners activos (máximo permitido).'; errEl.style.display='block'; return; }

  var orden = slotsActivos+1;
  var inicio=new Date(iniVal+'T12:00:00');
  var fin=new Date(finVal+'T23:59:59');
  var doc={
    ubicacion:ubic, nombre:nombre, estado:'activa',
    orden:orden, inicio:inicio, fin:fin,
  };
  if(texto)  doc.texto=texto;
  if(imagen) doc.imagen=imagen;
  if(negId)  doc.negocioId=negId;

  var btn=document.getElementById('cf-guardar-btn');
  if(btn){btn.disabled=true;btn.textContent='Guardando...';}

  db.collection('campanas').add(doc)
    .then(function(ref){
      if(btn){btn.disabled=false;btn.textContent='📢 Activar campaña';}
      window.toast&&window.toast('✅ Campaña activada');
      go('v-admin-campanas','left');
      window.adminCampanasCargar();
    })
    .catch(function(e){
      if(btn){btn.disabled=false;btn.textContent='📢 Activar campaña';}
      errEl.textContent='Error: '+e.message; errEl.style.display='block';
    });
};

window.adminCampanasEliminar = function(id) {
  var db=window._fbDb; if(!db) return;
  window._dcPrompt && window._dcPrompt('¿Eliminar esta campaña?','Esta acción no se puede deshacer.',function(){
    db.collection('campanas').doc(id).delete()
      .then(function(){
        _campanasCache=_campanasCache.filter(function(c){return c.id!==id;});
        window.adminCampanasRender();
        window.toast&&window.toast('Campaña eliminada');
      })
      .catch(function(e){ window.toast&&window.toast('Error: '+e.message); });
  });
};

function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ══════════════════════════════════════════════════════════════════════════
// ── MÓDULO IMPULSA — user-facing (negocios, proveedores, restaurantes) ───
// ══════════════════════════════════════════════════════════════════════════

var _impulsaPlanSel = null; // 'mensual' | 'anual'
var _impulsaBrick   = null; // MP brick controller
var MP_PUBLIC_KEY   = 'TEST-78934cff-df1d-4e84-bbd8-66bb3f704881';
var _MP_PLANES = {
  mensual: { monto: 199,  label: 'Plan Impulsa Mensual', meses: 1  },
  anual:   { monto: 1999, label: 'Plan Impulsa Anual',   meses: 12 }
};

// Punto de entrada desde home o mipanel
window._irAImpulsa = function() {
  go('v-impulsa', 'right');
  setTimeout(window.impulsaCargar, 200);
};

// ── Pantalla 1: Estado del plan ──────────────────────────────────────────
window.impulsaCargar = async function() {
  var cont = document.getElementById('impulsa-cont');
  if (!cont) return;
  cont.innerHTML = '<div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,.3);font-size:13px;">⏳</div>';

  try {
    var user = window._fbAuth && window._fbAuth.currentUser;
    if (!user) { cont.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,.4);">Sin sesión</div>'; return; }

    var snap = await _fbGet2('usuarios', user.uid);
    var d = snap.exists() ? snap.data() : {};

    var ahora = Date.now();
    var venceMs = d.planVence
      ? (d.planVence.toMillis ? d.planVence.toMillis() : (d.planVence.seconds || 0) * 1000)
      : 0;
    var activo = d.plan === 'impulsa' && venceMs > ahora;

    if (activo) {
      var dias = Math.ceil((venceMs - ahora) / 86400000);
      var venceFecha = new Date(venceMs).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
      var tipoLabel = d.planTipo === 'anual' ? 'Anual' : 'Mensual';

      cont.innerHTML = [
        '<div style="margin:20px 16px 0;background:linear-gradient(135deg,#2a1f00,#4d3900);border-radius:20px;padding:24px;text-align:center;border:1px solid rgba(245,197,24,.35);">',
          '<div style="font-size:52px;margin-bottom:8px;">⭐</div>',
          '<div style="font-size:20px;font-weight:900;color:#F5C518;margin-bottom:6px;">Impulsa ' + tipoLabel + '</div>',
          '<div style="display:inline-block;background:#F5C518;color:#3d2900;font-size:10px;font-weight:900;padding:4px 18px;border-radius:20px;margin-bottom:18px;letter-spacing:.5px;">ACTIVO</div>',
          '<div style="font-size:36px;font-weight:900;color:#fff;line-height:1;">' + dias + '</div>',
          '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:4px;">días restantes · vence ' + venceFecha + '</div>',
        '</div>',
        '<div style="margin:14px 16px 0;background:rgba(245,197,24,.06);border:1px solid rgba(245,197,24,.15);border-radius:16px;padding:16px;">',
          '<div style="font-size:10px;font-weight:800;color:#F5C518;letter-spacing:.6px;margin-bottom:12px;">BENEFICIOS ACTIVOS</div>',
          _impBeneficios(),
        '</div>',
        '<div style="padding:16px;">',
          '<button onclick="window.impulsaCargar()" style="width:100%;background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.35);border-radius:14px;padding:14px;color:#F5C518;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">🔄 Renovar plan</button>',
        '</div>',
      ].join('');
    } else {
      var badge = document.getElementById('impulsa-plan-badge');
      if (badge) badge.textContent = '🏪 Plan Básico · activo';

      cont.innerHTML = [
        // Plan actual — resaltado
        '<div style="margin:14px 14px 0;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;">',
          '<div style="font-size:24px;">🏪</div>',
          '<div>',
            '<div style="font-size:10px;font-weight:800;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Plan actual</div>',
            '<div style="font-size:15px;font-weight:900;color:#fff;">Básico <span style="font-size:13px;font-weight:700;color:#1FC26A;">· activo</span></div>',
          '</div>',
        '</div>',

        // Título principal
        '<div style="padding:20px 14px 4px;">',
          '<div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:4px;">Adquiere!!</div>',
          '<div style="font-size:28px;font-weight:900;color:#F5C518;letter-spacing:-.5px;">⭐ PLAN IMPULSA</div>',
          '<div style="font-size:12px;color:rgba(255,255,255,.4);margin-top:4px;">Elige el plan que más te convenga</div>',
        '</div>',

        // Plan Anual — destacado
        '<div onclick="window.impulsaSeleccionarPlan(\'anual\')" style="position:relative;background:linear-gradient(135deg,#2a1f00,#4d3900);border:2px solid #F5C518;border-radius:20px;padding:20px 18px 18px;margin:16px 14px 0;cursor:pointer;">',
          '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#F5C518;color:#3d2900;font-size:10px;font-weight:900;padding:4px 16px;border-radius:20px;white-space:nowrap;letter-spacing:.5px;">⚡ MEJOR VALOR · AHORRA $389</div>',
          '<div style="display:flex;align-items:center;gap:14px;margin-top:8px;">',
            '<div style="font-size:36px;">⭐</div>',
            '<div style="flex:1;">',
              '<div style="font-size:16px;font-weight:900;color:#F5C518;">Impulsa Anual</div>',
              '<div style="font-size:28px;font-weight:900;color:#fff;line-height:1.1;">$1,999 <span style="font-size:12px;font-weight:500;color:rgba(255,255,255,.5);">MXN / año</span></div>',
              '<div style="font-size:11px;color:rgba(255,255,255,.55);">$166/mes · equivale a 2 meses gratis</div>',
            '</div>',
            '<div style="width:26px;height:26px;border-radius:50%;border:2px solid #F5C518;display:flex;align-items:center;justify-content:center;font-size:14px;color:#F5C518;">›</div>',
          '</div>',
        '</div>',

        // Plan Mensual
        '<div onclick="window.impulsaSeleccionarPlan(\'mensual\')" style="background:rgba(31,194,106,.08);border:1.5px solid rgba(31,194,106,.4);border-radius:20px;padding:18px;margin:14px 14px 0;cursor:pointer;display:flex;align-items:center;gap:14px;">',
          '<div style="font-size:36px;">⭐</div>',
          '<div style="flex:1;">',
            '<div style="font-size:15px;font-weight:800;color:#fff;">Impulsa Mensual</div>',
            '<div style="font-size:26px;font-weight:900;color:#fff;line-height:1.1;">$199 <span style="font-size:12px;font-weight:500;color:rgba(255,255,255,.5);">MXN / mes</span></div>',
            '<div style="font-size:11px;color:rgba(255,255,255,.45);">Renueva cada mes · Cancela cuando quieras</div>',
          '</div>',
          '<div style="width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:14px;color:rgba(255,255,255,.5);">›</div>',
        '</div>',

        // Beneficios
        '<div style="font-size:11px;font-weight:800;color:rgba(255,255,255,.35);letter-spacing:.8px;text-transform:uppercase;margin:22px 14px 12px;">INCLUYE TODOS ESTOS BENEFICIOS</div>',
        '<div style="background:rgba(255,255,255,.04);border-radius:14px;padding:14px;margin:0 14px;">',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);"><span style="font-size:16px;">🔝</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Primero en resultados de búsqueda</span></div>',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);"><span style="font-size:16px;">📢</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Banners en Home, Food, Servicios, Plaza, Informa</span></div>',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);"><span style="font-size:16px;">⭐</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Badge "Impulsa" visible en tu perfil</span></div>',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);"><span style="font-size:16px;">🎯</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Sección "Destacados" en todas las vistas</span></div>',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);"><span style="font-size:16px;">📊</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Estadísticas avanzadas: vistas, contactos, conversiones</span></div>',
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;"><span style="font-size:16px;">💬</span><span style="font-size:12px;color:rgba(255,255,255,.8);">Soporte prioritario del equipo DC</span></div>',
        '</div>',

        '<div style="margin:14px 14px 0;padding:10px 14px;background:rgba(255,255,255,.04);border-radius:10px;font-size:10px;color:rgba(255,255,255,.35);text-align:center;line-height:1.6;">',
          'Pago procesado de forma segura por MercadoPago.<br>Puedes cancelar en cualquier momento desde tu panel.',
        '</div>',
        '<div style="height:24px;"></div>',
      ].join('');
    }
  } catch(e) {
    console.error('impulsaCargar', e);
    if (cont) cont.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b;font-size:13px;">Error al cargar plan.<br><small>' + e.message + '</small></div>';
  }
};

function _impBeneficios() {
  var items = [
    ['🔝','Primero en búsquedas'],
    ['📢','Banners en toda la app'],
    ['⭐','Badge Impulsa en tu perfil'],
    ['🎯','Sección Destacados'],
    ['📊','Estadísticas avanzadas'],
    ['💬','Soporte prioritario DC'],
  ];
  return items.map(function(i, idx) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;' + (idx < items.length - 1 ? 'border-bottom:.5px solid rgba(255,255,255,.06);' : '') + '">'
      + '<span style="font-size:15px;">' + i[0] + '</span>'
      + '<span style="font-size:12px;color:rgba(255,255,255,.8);">' + i[1] + '</span>'
      + '</div>';
  }).join('');
}

function _impComparativa(label, esI) {
  var c = esI ? '#F5C518' : 'rgba(255,255,255,.45)';
  var bg = esI ? 'rgba(245,197,24,.08)' : 'rgba(255,255,255,.03)';
  var bd = esI ? '1px solid rgba(245,197,24,.25)' : '.5px solid rgba(255,255,255,.07)';
  var its = esI
    ? ['✅ Primero', '✅ Banners', '✅ Badge ⭐', '✅ Destacado']
    : ['📍 Estándar', '❌ Sin banners', '❌ Sin badge', '❌ Sin destacado'];
  return '<div style="background:' + bg + ';border:' + bd + ';border-radius:14px;padding:12px;">'
    + '<div style="font-size:11px;font-weight:800;color:' + c + ';margin-bottom:10px;">' + label + '</div>'
    + its.map(function(i) { return '<div style="font-size:10px;color:rgba(255,255,255,.55);padding:3px 0;">' + i + '</div>'; }).join('')
    + '</div>';
}

// ── Pantalla 2: Selección → va al pago ──────────────────────────────────
window.impulsaSeleccionarPlan = function(tipo) {
  _impulsaPlanSel = tipo;
  var plan = _MP_PLANES[tipo];
  var resumen = document.getElementById('impulsa-pago-resumen');
  if (resumen) {
    resumen.innerHTML = '<div style="display:flex;align-items:center;gap:14px;">'
      + '<div style="font-size:32px;">⭐</div>'
      + '<div><div style="font-size:13px;font-weight:800;color:#F5C518;">' + plan.label + '</div>'
      + '<div style="font-size:26px;font-weight:900;color:#fff;line-height:1.2;">$' + plan.monto.toLocaleString('es-MX') + ' <span style="font-size:12px;font-weight:500;color:rgba(255,255,255,.5);">MXN</span></div>'
      + '<div style="font-size:10px;color:rgba(255,255,255,.45);">' + (tipo === 'anual' ? '12 meses de visibilidad máxima' : 'Renueva cada mes automáticamente') + '</div>'
      + '</div></div>';
  }
  go('v-impulsa-pago', 'right');
  setTimeout(function() { window.impulsaIniciarBrick && window.impulsaIniciarBrick(); }, 350);
};

// ── Pantalla 3: Opciones de pago ─────────────────────────────────────────
window.impulsaIniciarBrick = function() {
  var cont = document.getElementById('impulsa-brick-cont');
  if (!cont) return;
  var plan = _MP_PLANES[_impulsaPlanSel];
  if (!plan) return;

  cont.innerHTML = [
    '<div style="padding:4px 0 8px;">',

    // Opción MercadoPago
    '<div style="background:#fff;border-radius:16px;padding:18px;margin-bottom:12px;border:1.5px solid #e0e0e0;">',
      '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Tarjeta / Efectivo</div>',
      '<button onclick="window.impulsaIniciarMP()" style="width:100%;background:#009ee3;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;">',
        '<span style="font-size:20px;">💳</span> Pagar con MercadoPago',
      '</button>',
      '<div style="font-size:11px;color:#aaa;text-align:center;margin-top:8px;">Tarjeta de crédito, débito o OXXO</div>',
    '</div>',

    // Opción Transferencia SPEI
    '<div style="background:#fff;border-radius:16px;padding:18px;border:1.5px solid #e0e0e0;">',
      '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Transferencia bancaria</div>',
      '<button onclick="window.impulsaIniciarTransferencia()" style="width:100%;background:#1a6fbf;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;">',
        '<span style="font-size:20px;">🏦</span> Pagar por SPEI',
      '</button>',
      '<div style="font-size:11px;color:#aaa;text-align:center;margin-top:8px;">Te mostramos la CLABE para transferir</div>',
    '</div>',

    '</div>'
  ].join('');
};

// ── MercadoPago Checkout Pro ──────────────────────────────────────────────
window.impulsaIniciarMP = async function() {
  var cont = document.getElementById('impulsa-brick-cont');
  if (!cont) return;
  cont.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:13px;">⏳ Iniciando pago seguro...</div>';

  if (typeof MercadoPago === 'undefined') {
    cont.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;font-size:13px;">SDK de pago no disponible. Recarga la página.</div>';
    return;
  }

  if (_impulsaBrick) {
    try { await _impulsaBrick.unmount(); } catch(_e) {}
    _impulsaBrick = null;
  }

  var plan = _MP_PLANES[_impulsaPlanSel];
  if (!plan) return;

  cont.innerHTML = '<div id="impulsa-brick-inner" style="min-height:420px;"></div>';

  // Timeout fallback: if brick doesn't render in 12s, show error
  var _brickTimeout = setTimeout(function() {
    var inner = document.getElementById('impulsa-brick-inner');
    if (inner && inner.children.length === 0) {
      cont.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;font-size:13px;">No se pudo cargar el módulo de pago.<br><br><button onclick="window.impulsaIniciarBrick()" style="background:#009ee3;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;cursor:pointer;">← Volver a opciones</button></div>';
    }
  }, 12000);

  try {
    var mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' });
    var userEmail = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.email) || '';

    _impulsaBrick = await mp.bricks().create('payment', 'impulsa-brick-inner', {
      initialization: { amount: plan.monto, payer: { email: userEmail } },
      customization: { paymentMethods: { creditCard: 'all', debitCard: 'all', ticket: 'all' } },
      callbacks: {
        onReady: function() { clearTimeout(_brickTimeout); },
        onSubmit: function(_ref) {
          var formData = _ref.formData;
          return new Promise(async function(resolve, reject) {
            try {
              var user = window._fbAuth && window._fbAuth.currentUser;
              if (!user) { reject(new Error('Sin sesión.')); return; }
              var _fns = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js');
              var fn = _fns.httpsCallable(window._fbFunctions, 'mpActivarImpulsa');
              var result = await fn({ formData: formData, planTipo: _impulsaPlanSel, email: userEmail });
              if (result.data && result.data.ok) {
                var okVence = document.getElementById('impulsa-ok-vence');
                if (okVence && result.data.planVence) {
                  var fStr = new Date(result.data.planVence).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
                  okVence.textContent = 'Plan activo hasta el ' + fStr;
                }
                resolve();
                setTimeout(function() { go('v-impulsa-ok', 'right'); }, 100);
              } else {
                reject(new Error((result.data && result.data.msg) || 'Error en el pago'));
              }
            } catch(e) { reject(e); }
          });
        },
        onError: function(error) {
          clearTimeout(_brickTimeout);
          console.error('[MP Brick error]', error);
          var c = document.getElementById('impulsa-brick-cont');
          if (c) c.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;font-size:13px;">Error al cargar el módulo de pago.<br><small style="color:#aaa;">' + (error && error.message || JSON.stringify(error)) + '</small><br><br><button onclick="window.impulsaIniciarBrick()" style="background:#009ee3;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;cursor:pointer;">← Volver a opciones</button></div>';
        }
      }
    });
  } catch(e) {
    clearTimeout(_brickTimeout);
    console.error('impulsaIniciarMP', e);
    if (cont) cont.innerHTML = '<div style="padding:20px;text-align:center;color:#c00;font-size:13px;">Error al iniciar pago:<br>' + e.message + '<br><br><button onclick="window.impulsaIniciarBrick()" style="background:#009ee3;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;cursor:pointer;">← Volver a opciones</button></div>';
  }
};

// ── SPEI / Transferencia ──────────────────────────────────────────────────
window.impulsaIniciarTransferencia = async function() {
  var cont = document.getElementById('impulsa-brick-cont');
  if (!cont) return;

  var plan = _MP_PLANES[_impulsaPlanSel];
  if (!plan) return;

  // Leer datos bancarios de Firebase
  var banco = '', clabe = '', beneficiario = '';
  try {
    var _fs = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap = await _fs.getDoc(_fs.doc(window._fbDb, 'config', 'spei'));
    if (snap.exists()) {
      var d = snap.data();
      banco = d.banco || '';
      clabe = d.clabe || '';
      beneficiario = d.beneficiario || '';
    }
  } catch(e) {}

  var user = window._fbAuth && window._fbAuth.currentUser;
  var uid = user ? user.uid : '';

  cont.innerHTML = [
    '<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;">',
      '<div style="font-size:14px;font-weight:800;color:#1a1a1a;margin-bottom:16px;">🏦 Datos para transferir</div>',
      '<div style="margin-bottom:12px;padding:12px;background:#f5f5f5;border-radius:10px;">',
        '<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px;">Banco</div>',
        '<div style="font-size:15px;font-weight:800;color:#111;">' + (banco || '—') + '</div>',
      '</div>',
      '<div style="margin-bottom:12px;padding:12px;background:#f5f5f5;border-radius:10px;">',
        '<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px;">CLABE</div>',
        '<div style="font-size:18px;font-weight:900;color:#1a6fbf;letter-spacing:2px;">' + (clabe || '—') + '</div>',
      '</div>',
      '<div style="margin-bottom:16px;padding:12px;background:#f5f5f5;border-radius:10px;">',
        '<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px;">Beneficiario</div>',
        '<div style="font-size:15px;font-weight:800;color:#111;">' + (beneficiario || '—') + '</div>',
      '</div>',
      '<div style="padding:12px;background:#fff8e1;border-radius:10px;border-left:3px solid #F5C518;font-size:12px;color:#555;line-height:1.6;margin-bottom:16px;">',
        '<strong>Monto a transferir:</strong> $' + plan.monto.toLocaleString('es-MX') + ' MXN<br>',
        '<strong>Concepto:</strong> Impulsa ' + (_impulsaPlanSel === 'anual' ? 'Anual' : 'Mensual') + ' · ' + uid.slice(0,8),
      '</div>',
      '<div style="font-size:11px;color:#888;margin-bottom:16px;line-height:1.6;">',
        'Después de transferir, envía tu comprobante por WhatsApp o a través de soporte. Tu plan se activará en menos de 24 horas.',
      '</div>',
      '<button onclick="window.impulsaIniciarBrick()" style="width:100%;background:#f0f0f0;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;color:#555;cursor:pointer;font-family:\'Inter\',sans-serif;">← Volver a opciones de pago</button>',
    '</div>'
  ].join('');
};

// ── Admin: Guardar/Cargar datos SPEI ─────────────────────────────────────
function _icSetReadonly(on) {
  ['ic-banco','ic-clabe','ic-beneficiario'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.readOnly = on;
    el.style.opacity = on ? '0.55' : '1';
    el.style.cursor = on ? 'default' : 'text';
  });
  var btn = document.getElementById('ic-guardar-btn');
  var editBtn = document.getElementById('ic-editar-btn');
  if (btn) btn.style.display = on ? 'none' : 'block';
  if (editBtn) editBtn.style.display = on ? 'block' : 'none';
}

window.adminImpulsaConfigCargar = async function() {
  try {
    var _fs = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    var snap = await _fs.getDoc(_fs.doc(window._fbDb, 'config', 'spei'));
    if (snap.exists()) {
      var d = snap.data();
      var b = document.getElementById('ic-banco');
      var c = document.getElementById('ic-clabe');
      var ben = document.getElementById('ic-beneficiario');
      if (b) b.value = d.banco || '';
      if (c) c.value = d.clabe || '';
      if (ben) ben.value = d.beneficiario || '';
      _icSetReadonly(true);
    }
  } catch(e) { console.error('adminImpulsaConfigCargar', e); }
};

window.adminImpulsaConfigEditar = function() {
  _icSetReadonly(false);
  var status = document.getElementById('ic-status');
  if (status) status.style.display = 'none';
  var el = document.getElementById('ic-banco');
  if (el) el.focus();
};

window.adminImpulsaConfigGuardar = async function() {
  var status = document.getElementById('ic-status');
  var banco = (document.getElementById('ic-banco')?.value || '').trim();
  var clabe = (document.getElementById('ic-clabe')?.value || '').trim();
  var beneficiario = (document.getElementById('ic-beneficiario')?.value || '').trim();

  if (!banco || !clabe || !beneficiario) {
    if (status) { status.style.display='block'; status.style.background='#fee'; status.style.color='#c00'; status.textContent='Completa todos los campos.'; }
    return;
  }
  if (clabe.length !== 18 || !/^\d+$/.test(clabe)) {
    if (status) { status.style.display='block'; status.style.background='#fee'; status.style.color='#c00'; status.textContent='La CLABE debe tener exactamente 18 dígitos.'; }
    return;
  }

  var btn = document.getElementById('ic-guardar-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    var _fs = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
    await _fs.setDoc(_fs.doc(window._fbDb, 'config', 'spei'), { banco: banco, clabe: clabe, beneficiario: beneficiario }, { merge: true });
    if (status) { status.style.display='block'; status.style.background='#e8f5e1'; status.style.color='#1a6a2a'; status.textContent='✅ Datos guardados correctamente.'; }
    try { window._dcDirtyV = null; } catch(_) {}
    _icSetReadonly(true);
  } catch(e) {
    if (status) { status.style.display='block'; status.style.background='#fee'; status.style.color='#c00'; status.textContent='Error al guardar: ' + e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar datos bancarios'; }
  }
};
