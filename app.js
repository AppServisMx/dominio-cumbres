/* ════════════════════════════════════════════════════════════
   DOMINIO CUMBRES — APP.JS
   Sin parches, sin stacked IIFEs, sin guard flags.
   Una función por responsabilidad.
════════════════════════════════════════════════════════════ */
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
var ORDER_KEYS=['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'];
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
  wj(CART_KEY,c); wj('dcPlazaCarrito',c); wj('dcPlazaCarritoEnProceso',c);
  if(c.length){wj('dcPlazaCompraProceso',{id:'plaza_carrito_l14',tipo:'plaza_carrito',estado:'proceso',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});}
  else{rm('dcPlazaCompraProceso');}
}
function clearCart(){
  wj(CART_KEY,[]); ['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart'].forEach(function(k){wj(k,[]);});
  rm('dcPlazaCompraProceso'); META_KEYS.forEach(rm);
  try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');localStorage.setItem('dcPlazaQF36Open','0');localStorage.setItem('dcPlazaQF36VaciarOpen','0');}catch(_){}
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
    return '<div class="dc-l14-cart-row"><div class="dc-l14-thumb">'+(x.foto?'<img src="'+esc(x.foto)+'">':'🛒')+'</div><div style="flex:1;min-width:0"><div class="dc-l14-prod">'+esc(x.nombre)+'</div><div class="dc-l14-muted">'+money(p)+' × '+q+' = '+money(p*q)+'</div></div><div class="dc-l14-controls"><button type="button" data-l14-qty="-1" data-key="'+k+'">−</button><b>'+q+'</b><button type="button" data-l14-qty="1" data-key="'+k+'">+</button><button type="button" class="del" data-l14-del="1" data-key="'+k+'">×</button></div></div>';
  }).join('');
}
function mcCartCard(c){
  c=norm(c); if(!c.length) return '';
  var open=localStorage.getItem(OPEN_CART)==='1', vac=localStorage.getItem(VAC_KEY)==='1', t=total(c);
  var html='<div class="dc-l14-card dc-l14-pending" data-l14-card="cart"><div class="dc-l14-head" data-l14-toggle-cart="1"><div class="dc-l14-icon">🛒</div><div class="dc-l14-main"><div class="dc-l14-title">Continuar compra Plaza Online</div><div class="dc-l14-muted">'+c.length+' producto(s) · '+money(t)+'</div>'+mcState('pendiente','Pendiente')+'</div><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'⌃':'⌄')+'</div></div>';
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
  var html='<div class="dc-l14-card" data-l14-card="order" data-l14-order="'+esc(id)+'"><div class="dc-l14-head" data-l14-toggle-order="'+esc(id)+'"><div class="dc-l14-icon box">📦</div><div class="dc-l14-main"><div class="dc-l14-title">Plaza Online</div><div class="dc-l14-muted">'+esc(o.folio||'Compra')+' · '+fdate(o.fecha)+' · '+items.length+' producto(s)</div>'+estado+'</div><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'⌃':'⌄')+'</div></div>';
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

window.cargarMisComprasPlaza=function(){
  window._misComprasPlazaTab='proceso';
  try{localStorage.setItem(TAB_KEY,JSON.stringify('proceso'));}catch(_){}
  setTimeout(function(){renderMisCompras(true);},0);
  return renderMisCompras(true);
};
window.cambiarTabMisComprasPlaza=function(t){mcSetTabs(t);renderMisCompras(true);return false;};
window.dcPlazaLimpieza15Render=function(){return renderMisCompras(true);};
window.dcPlazaLimpieza14Render=window.dcPlazaLimpieza15Render;
window.dcPlazaRenderMisComprasQF42=function(){return renderMisCompras(true);};

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

  // Fix C — opciones de entrega con estado activo según selección actual
  html+='<div class="dc-plz-sec-label">📦 ¿Cómo deseas recibir tu compra?</div>';
  html+='<div class="dc-plz-option'+(entrega==='domicilio'?' active':'')+'" data-dc-plaza-entrega="domicilio"><div class="dc-plz-option-ic">🚚</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Entrega a domicilio</div><div class="dc-plz-option-sub">Repartidor DC / Tienda</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(entrega==='recoger'?' active':'')+'" data-dc-plaza-entrega="recoger"><div class="dc-plz-option-ic">🏪</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Pasaré a recoger</div><div class="dc-plz-option-sub">Recoger directamente en tienda</div></div><div class="dc-plz-radio"></div></div>';

  // Fix C — campos condicionales según entrega
  if(entrega==='domicilio'){
    html+='<div class="dc-plz-sec-label">📍 Tu dirección de entrega</div><input id="dc-plaza-dir-compra" class="dc-plz-input" placeholder="Calle, número, colonia, referencias...">';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Color, talla, indicaciones, referencias..."></textarea>';
    html+='<div class="dc-plz-info">🏍️ <b>Compra con entrega local</b><br>Acuerda el pago directamente con el negocio. El repartidor DC sólo realiza la entrega cuando aplique.</div>';
  }else{
    html+='<div class="dc-plz-info">🏪 <b>Recoger en tienda</b><br>Presenta tu folio de compra en el negocio para recoger tu pedido. Coordina el horario directamente con ellos.</div>';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Horario, nombre, indicaciones..."></textarea>';
  }

  // Fix C — opciones de pago con estado activo según selección actual
  html+='<div class="dc-plz-sec-label">💳 Forma de pago</div>';
  html+='<div class="dc-plz-option'+(pago==='efectivo'?' active':'')+'" data-dc-plaza-pago="efectivo"><div class="dc-plz-option-ic">💵</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Efectivo al entregar</div><div class="dc-plz-option-sub">Paga al recibir</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(pago==='tarjeta'?' active':'')+'" data-dc-plaza-pago="tarjeta"><div class="dc-plz-option-ic">💳</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Tarjeta al entregar</div><div class="dc-plz-option-sub">Terminal en la entrega</div></div><div class="dc-plz-radio"></div></div>';
  html+='<div class="dc-plz-option'+(pago==='transferencia'?' active':'')+'" data-dc-plaza-pago="transferencia"><div class="dc-plz-option-ic">🏦</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Transferencia</div><div class="dc-plz-option-sub">SPEI / Nómina</div></div><div class="dc-plz-radio"></div></div>';

  html+='<div class="dc-plz-summary"><div class="dc-plz-srow"><span>Subtotal</span><span>'+money(subtotal)+'</span></div><div class="dc-plz-srow"><span>Envío</span><span>Gratis</span></div><div class="dc-plz-srow total"><span>Total</span><span>'+money(subtotal)+'</span></div></div>';

  // Fix D — botón diferente si pago es transferencia
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
  if(hdrS) hdrS.textContent=storeName;
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
      '<div style="font-size:13px;font-weight:800;color:#111;margin-bottom:8px;">'+esc(storeName)+'</div>'+
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
window.dcPlazaRenderComprandoRestaurant=renderComprando;

setTimeout(function(){
  var v=document.getElementById('v-plaza-comprando');
  if(v&&v.classList.contains('active')) renderComprando();
},80);

// ——————————————————————————————————————————————
// COMPRANDO — click handler (quitar item, entrega/pago, transferencia)
// ——————————————————————————————————————————————
document.addEventListener('click',function(e){
  var t=e.target; if(!t||!t.closest) return;

  // Fix B: usar closest sin selector compuesto para mayor compatibilidad
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

  // Fix C: al cambiar entrega/pago re-renderiza para mostrar campos correctos
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

  // Fix D: botón "Continuar → transferencia" abre pantalla de referencia
  var btnTrans=t.closest('#dc-plaza-ir-transferencia');
  if(btnTrans&&btnTrans.closest('#v-plaza-comprando')){
    stop(e);
    _renderTransferencia();
    return false;
  }

  // Fix D: validar referencia antes de confirmar cuando es transferencia
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
  try{window._misComprasPlazaTab='proceso';localStorage.setItem('dcPlazaQF36Open','0');localStorage.setItem('dcPlazaQF36VaciarOpen','0');}catch(e){}
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
window.dcPlazaIrMisComprasProcesoQF39=goProceso;


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
  el.innerHTML=
    '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:24px 14px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:34px;margin-bottom:8px;">📦</div><div style="font-size:17px;font-weight:900;color:#111;">Compra recibida</div><div style="font-size:12px;color:#777;margin-top:5px;">Esperando confirmación del negocio</div></div>'+
    '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:20px 14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="display:grid;grid-template-columns:34px 1fr;row-gap:18px;align-items:center;"><div style="width:28px;height:28px;border-radius:50%;background:#20c76a;color:#fff;display:flex;align-items:center;justify-content:center;">📦</div><div style="font-size:13px;font-weight:900;color:#111;">Compra recibida</div><div style="width:28px;height:28px;border-radius:50%;background:#1A7AB5;color:#fff;display:flex;align-items:center;justify-content:center;">📋</div><div style="font-size:13px;font-weight:900;color:#111;">Preparando pedido</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🛍️</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">Listo</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🚚</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">En camino</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🏠</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">Entregado</div></div></div>'+
    '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:10px;font-weight:900;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Tu compra</div>'+rows+'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:3px;"><div style="font-size:15px;font-weight:900;color:#111;">Total</div><div style="font-size:18px;font-weight:900;color:#111;">'+money(t)+'</div></div><div style="font-size:11px;color:#777;margin-top:12px;">Orden '+esc(o.id||'plaza_demo')+' · '+fdate(o.fecha)+'</div></div>';
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
function _postHooks(id){
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

// Handler global de flechas .btn-back
document.addEventListener('click',function(e){
  var btn=e.target&&e.target.closest?e.target.closest('.btn-back'):null;
  if(!btn) return;
  if(btn.closest('#vr-shell')||btn.closest('#vn-shell')) return;
  var oc=(btn.getAttribute('onclick')||'');
  if(oc.indexOf('navTo')!==-1||oc.indexOf('navBack')!==-1) return;
  e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
  if(btn.closest('#v-mis-compras-plaza')){try{window.go('v-plaza','left');}catch(_){} return false;}
  window.dcBack('v-home');
},true);


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
    if(txt.indexOf('mis compras')!==-1||txt.indexOf('compras')!==-1){ev.preventDefault();ev.stopPropagation();window._misComprasPlazaTab='proceso';window.go('v-mis-compras-plaza','right');setTimeout(function(){try{window.cargarMisComprasPlaza&&window.cargarMisComprasPlaza();}catch(e){}},120);return;}
    if(txt.indexOf('alertas')!==-1){ev.preventDefault();ev.stopPropagation();window.go('v-notificaciones','right');setTimeout(function(){try{window.renderNotificaciones&&window.renderNotificaciones();}catch(e){}},180);return;}
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
      if(id==='v-notificaciones'&&t.indexOf('alertas')!==-1){setItem(item,'🏠','Inicio',function(){goTo('v-home','left');},'');}
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
