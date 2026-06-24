
(function(){
  if(window.__dcPlaza2B2CRealNavFix) return;
  window.__dcPlaza2B2CRealNavFix = true;

  var CART_KEYS = ['dcPlazaCartV61','dcPlazaCompraProceso','dcPlazaCarrito','dcPlazaCart'];
  var COMPRA_SEL = 'dcPlazaCompraSeleccionada';
  var COMPRA_ORDER = 'dcPlazaCompraPlazaActiva';

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function n(v){v=Number(v);return isFinite(v)?v:0;}
  function money(v){try{return '$'+n(v).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:2});}catch(e){return '$'+n(v);}}
  function today(){try{return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return '';}}

  function readCart(){
    for(var i=0;i<CART_KEYS.length;i++){
      var v=rj(CART_KEYS[i],null);
      if(Array.isArray(v) && v.length) return v;
      if(v && Array.isArray(v.items) && v.items.length) return v.items;
      if(v && Array.isArray(v.productos) && v.productos.length) return v.productos;
    }
    return [];
  }
  function getQty(x){return Math.max(1,n(x.qty||x.cantidad||x.cant||1));}
  function getPrice(x){return n(x.precio||x.price||x.costo||0);}
  function getName(x){return x.nombre||x.name||x.titulo||x.producto||'Producto';}
  function total(cart){return cart.reduce(function(s,x){return s + getPrice(x)*getQty(x);},0);}

  function addStyle(){
    if(document.getElementById('dc-plaza-2b2c-real-nav-style')) return;
    var st=document.createElement('style');st.id='dc-plaza-2b2c-real-nav-style';
    st.textContent =
      '#v-plaza-comprando,#v-plaza-seguimiento{background:#F5F6F0;}'+
      '#v-plaza-comprando .dc-buy-card,#v-plaza-seguimiento .dc-buy-card{background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;box-shadow:0 12px 26px rgba(0,0,0,.075);margin-bottom:12px;}'+
      '.dc-buy-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:.5px solid #f1f1f1;}'+
      '.dc-buy-row:last-child{border-bottom:none;}'+
      '.dc-buy-title{font-size:14px;font-weight:900;color:#111;}'+
      '.dc-buy-sub{font-size:11px;color:#777;font-weight:700;line-height:1.35;}'+
      '.dc-buy-pill{border:none;border-radius:14px;padding:10px 12px;font-size:12px;font-weight:900;background:#eef3f8;color:#334;cursor:pointer;font-family:inherit;}'+
      '.dc-buy-pill.active{background:var(--blue,#1A7AB5);color:#fff;}'+
      '.dc-buy-primary{width:100%;margin-top:12px;border:none;border-radius:16px;background:var(--green,#1FC26A);color:#fff;padding:14px;font-size:13px;font-weight:900;font-family:inherit;box-shadow:0 10px 22px rgba(31,194,106,.22);cursor:pointer;}'+
      '.dc-buy-input{width:100%;box-sizing:border-box;border:.5px solid #dfe5eb;border-radius:14px;padding:12px;font-size:12px;font-family:inherit;outline:none;background:#fff;}';
    document.head.appendChild(st);
  }

  function insertAfter(base,v){
    if(base && base.parentNode) base.parentNode.insertBefore(v,base.nextSibling);
    else (document.querySelector('.app')||document.body).appendChild(v);
  }
  function makeView(id,title,sub){
    var v=document.getElementById(id);
    if(!v){
      v=document.createElement('div');
      v.className='view go-right';
      v.id=id;
      v.style.flexDirection='column';
      v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button" onclick="go(\'v-mis-compras-plaza\',\'left\')">‹</button><div><div class="si13">'+title+'</div><div class="si21">'+sub+'</div></div></div></div><div class="scroll" id="'+id+'-lista" style="padding:14px 14px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
      insertAfter(document.getElementById('v-mis-compras-plaza')||document.querySelector('.view.active'),v);
    }
    return v;
  }
  function ensureViews(){addStyle();makeView('v-plaza-comprando','🛒 COMPRANDO','Plaza Online');makeView('v-plaza-seguimiento','📍 SEGUIMIENTO','Plaza Online');}

  function selected(){return rj(COMPRA_SEL,null)||{items:readCart(),fecha:Date.now(),total:total(readCart())};}
  function renderComprando(){
    ensureViews();
    var c=readCart();
    var m=selected();
    var el=document.getElementById('v-plaza-comprando-lista');
    if(!el) return;
    var html='<div class="dc-buy-card"><div class="dc-buy-title">Plaza Online</div><div class="dc-buy-sub">Carrito '+today()+' · '+c.length+' producto(s)</div></div>';
    html+='<div class="dc-buy-card"><div class="dc-buy-title" style="margin-bottom:8px;">Detalle de productos</div>';
    if(!c.length){html+='<div class="dc-buy-sub">Tu carrito está vacío.</div>';}
    c.forEach(function(x){html+='<div class="dc-buy-row"><div><div style="font-size:13px;font-weight:900;color:#111;">'+esc(getName(x))+'</div><div class="dc-buy-sub">Cantidad '+getQty(x)+' · '+money(getPrice(x))+'</div></div><div style="font-size:13px;font-weight:900;color:#111;">'+money(getPrice(x)*getQty(x))+'</div></div>';});
    html+='</div>';
    html+='<div class="dc-buy-card"><div class="dc-buy-title" style="margin-bottom:10px;">Entrega</div><div style="display:flex;gap:8px;margin-bottom:10px;"><button type="button" class="dc-buy-pill active" data-dc-plaza-entrega="domicilio">Entrega a domicilio</button><button type="button" class="dc-buy-pill" data-dc-plaza-entrega="recoger">Pasaré a recoger</button></div><input class="dc-buy-input" id="dc-legacy-dc-plaza-dir-compra-1" data-dc-legacy-id="dc-plaza-dir-compra" placeholder="Dirección de entrega"><textarea class="dc-buy-input" id="dc-legacy-dc-plaza-nota-compra-1" data-dc-legacy-id="dc-plaza-nota-compra" style="margin-top:8px;min-height:70px;resize:none;" placeholder="Nota para el negocio"></textarea></div>';
    html+='<div class="dc-buy-card"><div class="dc-buy-title" style="margin-bottom:8px;">Pago</div><div class="dc-buy-sub">Forma de pago pendiente de conexión real. Por ahora queda como compra local/demo.</div><div class="dc-buy-row" style="margin-top:8px;"><div class="dc-buy-title">Total</div><div class="dc-buy-title">'+money(total(c))+'</div></div><button type="button" class="dc-buy-primary" id="dc-plaza-confirmar-compra">Comprar</button></div>';
    el.innerHTML=html;
  }
  function renderSeguimiento(order){
    ensureViews();
    order=order||rj(COMPRA_ORDER,null)||selected();
    var el=document.getElementById('v-plaza-seguimiento-lista');
    if(!el) return;
    var pasos=['Compra enviada','Recibida por el negocio','Preparando','Lista / en camino','Entregada'];
    var html='<div class="dc-buy-card"><div class="dc-buy-title">Compra en seguimiento</div><div class="dc-buy-sub">Plaza Online · '+today()+'</div><div class="dc-buy-row"><div class="dc-buy-title">Total</div><div class="dc-buy-title">'+money(order.total||0)+'</div></div></div><div class="dc-buy-card">';
    pasos.forEach(function(p,i){html+='<div class="dc-buy-row"><div><div style="font-size:13px;font-weight:900;color:#111;">'+(i===0?'✅':'○')+' '+p+'</div><div class="dc-buy-sub">'+(i===0?'Confirmado':'Pendiente')+'</div></div></div>';});
    html+='</div>';
    el.innerHTML=html;
  }
  function forceGo(id,dir){
    ensureViews();
    if(id==='v-plaza-comprando') renderComprando();
    if(id==='v-plaza-seguimiento') renderSeguimiento();
    if(typeof window.go==='function') window.go(id,dir||'right');
    setTimeout(function(){
      var t=document.getElementById(id);
      if(!t) return;
      if(!t.classList.contains('active')){
        document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
        t.classList.add('active');
        t.style.display='flex';
      }
      if(id==='v-plaza-comprando') renderComprando();
      if(id==='v-plaza-seguimiento') renderSeguimiento();
    },60);
  }
  function closeExpanded(){
    try{localStorage.removeItem('dcPlazaMisComprasOpen');localStorage.removeItem('dcPlazaCarritoAbierto');localStorage.removeItem('dcPlaza2AOpen');}catch(e){}
  }
  function buyFromMis(e){
    if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}
    var c=readCart();
    if(!c.length) return false;
    var compra={id:'plaza_carrito_activo_v61',tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)};
    wj(COMPRA_SEL,compra);
    closeExpanded();
    forceGo('v-plaza-comprando','right');
    return false;
  }
  function finishCompra(e){
    if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}
    var c=readCart();
    var order={id:'plaza_'+Date.now(),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio')};
    wj(COMPRA_ORDER,order);
    wj(COMPRA_SEL,order);
    function goSeg(){forceGo('v-plaza-seguimiento','right');}
    try{
      if(typeof window.dcPlazaFinalFelizOficial==='function') return window.dcPlazaFinalFelizOficial(goSeg), false;
      if(typeof window.plazaFinalFelizCarrito==='function') return window.plazaFinalFelizCarrito('Compra exitosa',goSeg), false;
    }catch(ex){}
    goSeg();
    return false;
  }
  function isMisBuyTarget(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,[role="button"],.btn,.dc-plaza-buy-final');
    if(!b) return false;
    if(b.id==='dc-plaza-confirmar-compra') return false;
    var txt=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    var inMis=!!(b.closest('#v-mis-compras-plaza')||b.closest('#miscompras-plaza-lista')||b.closest('#dc-plaza-b2a-card'));
    return inMis && txt==='comprar';
  }
  var lastBuy=0;
  function buyCapture(e){
    if(!isMisBuyTarget(e)) return;
    var now=Date.now();
    if(now-lastBuy<500){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();return false;}
    lastBuy=now;
    return buyFromMis(e);
  }
  document.addEventListener('pointerdown',buyCapture,true);
  document.addEventListener('click',buyCapture,true);
  document.addEventListener('click',function(e){
    var ent=e.target&&e.target.closest&&e.target.closest('[data-dc-plaza-entrega]');
    if(ent){e.preventDefault();e.stopPropagation();document.querySelectorAll('[data-dc-plaza-entrega]').forEach(function(x){x.classList.remove('active');});ent.classList.add('active');localStorage.setItem('dcPlazaTipoEntrega',ent.getAttribute('data-dc-plaza-entrega'));return false;}
    var conf=e.target&&e.target.closest&&e.target.closest('#dc-plaza-confirmar-compra');
    if(conf) return finishCompra(e);
  },true);

  window.dcPlazaAsegurarVistaComprando=ensureViews;
  window.dcPlazaRenderComprando=renderComprando;
  window.dcPlazaComprarDesdeMisCompras=buyFromMis;
  window.dcPlazaContinuarCompra=buyFromMis;
  window.dcPlazaConfirmarCompraFinal=finishCompra;
  ensureViews();
})();


(function(){
  if(window.__dcPlaza2ABCStabilityFixFinal) return;
  window.__dcPlaza2ABCStabilityFixFinal = true;
  var CART_KEY='dcPlazaCartV61', META_KEY='dcPlazaB2AMeta', OPEN_KEY='dcPlazaB2AOpen';
  var SEL_KEY='dcPlazaCompraSeleccionada', ORDER_KEY='dcPlazaCompraPlazaActiva', HIST_KEY='dcPlazaOrdenesPlazaV62';
  var tab='proceso', lastTap=0;
  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){return (Array.isArray(a)?a:[]).map(function(x,i){x=Object.assign({},x||{});x.key=keyOf(x,i);x.id=x.id||x.productoId||x.key;x.nombre=x.nombre||x.titulo||x.name||'Producto';x.precio=num(x.precio||x.price||x.precioUnitario);x.cantidad=qty(x.cantidad||x.qty||1);x.qty=x.cantidad;x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';return x;});}
  function cart(){return norm(rj(CART_KEY,[]));}
  function save(c){c=norm(c);wj(CART_KEY,c);var m=meta(), compra={id:'plaza_carrito_activo_v61',tipo:'plaza_carrito',estado:'proceso',titulo:'Plaza Online',fecha:m.fechaCreacion,items:c,total:total(c)};wj('dcPlazaCompraProceso',compra);wj('dcPlazaCompras',c.length?[compra]:[]);return c;}
  function total(c){return norm(c).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function meta(){var m=rj(META_KEY,null);if(!m||!m.fechaCreacion){m={fechaCreacion:Date.now()};wj(META_KEY,m);}return m;}
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){}}
  function closeOpen(){['dcPlazaB2AOpen','dcPlazaMisComprasOpen','dcPlazaCarritoAbierto','dcPlaza2AOpen','dcPlazaCartV61OpenFinal','dcPlazaCartV61Open','dcPlazaCartOpen'].forEach(function(k){try{localStorage.setItem(k,'0');}catch(_){}});}
  function setOpen(v){try{localStorage.setItem(OPEN_KEY,v?'1':'0');}catch(_){}}
  function isOpen(){return localStorage.getItem(OPEN_KEY)==='1';}
  function style(){if(document.getElementById('dc-plaza-2abc-stability-style'))return;var s=document.createElement('style');s.id='dc-plaza-2abc-stability-style';s.textContent='@keyframes dcPlazaWaterDrop{0%{opacity:0;transform:translateY(-7px) scale(.992)}100%{opacity:1;transform:translateY(0) scale(1)}}#dc-plaza-b2a-panel{animation:dcPlazaWaterDrop .28s cubic-bezier(.22,1,.36,1) both}.dc-plaza-b2a-shadow{box-shadow:0 18px 38px rgba(10,48,85,.18),0 3px 10px rgba(10,48,85,.08),inset 0 1px 0 rgba(255,255,255,.96)!important}.dc-plaza-buy-card{background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;box-shadow:0 12px 26px rgba(0,0,0,.075);margin-bottom:12px}.dc-plaza-buy-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:.5px solid #f1f1f1}.dc-plaza-buy-row:last-child{border-bottom:0}.dc-plaza-buy-title{font-size:14px;font-weight:900;color:#111}.dc-plaza-buy-sub{font-size:11px;color:#777;font-weight:700;line-height:1.35}.dc-plaza-buy-input{width:100%;box-sizing:border-box;border:.5px solid #dfe5eb;border-radius:14px;padding:12px;font-size:12px;font-family:inherit;outline:none;background:#fff}.dc-plaza-buy-primary{width:100%;margin-top:12px;border:none;border-radius:16px;background:var(--green,#1FC26A);color:#fff;padding:14px;font-size:13px;font-weight:900;font-family:inherit;box-shadow:0 10px 22px rgba(31,194,106,.22);cursor:pointer}.dc-plaza-buy-pill{border:0;border-radius:14px;padding:10px 12px;font-size:12px;font-weight:900;background:#eef3f8;color:#334;font-family:inherit}.dc-plaza-buy-pill.active{background:var(--blue,#1A7AB5);color:#fff}';document.head.appendChild(s);}
  function renderMis(){style();var el=document.getElementById('miscompras-plaza-lista');if(!el)return false;var sub=document.getElementById('miscompras-plaza-sub');if(sub)sub.textContent=tab==='anteriores'?'Compras anteriores':'Compras en proceso';var bp=document.getElementById('miscompras-tab-proceso'),ba=document.getElementById('miscompras-tab-anteriores');if(bp&&ba){bp.style.background=tab==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';ba.style.background=tab==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';bp.style.color=ba.style.color='#fff';}
    if(tab==='anteriores'){var hist=rj(HIST_KEY,[]);closeOpen();if(!hist.length){el.innerHTML='<div style="padding:36px 20px;text-align:center;"><div style="font-size:42px;margin-bottom:12px;">📦</div><div style="font-size:15px;font-weight:900;color:#111;margin-bottom:6px;">Sin compras anteriores</div><div style="font-size:12px;color:#777;">Cuando confirmes compras aparecerán aquí.</div></div>';return true;}el.innerHTML=hist.map(function(o){return '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;margin:14px 10px;box-shadow:0 6px 18px rgba(0,0,0,.05);"><div style="display:flex;justify-content:space-between;gap:10px;"><div><div style="font-size:14px;font-weight:900;color:#111;">📦 Plaza Online</div><div style="font-size:11px;color:#777;margin-top:3px;font-weight:700;">Compra '+date(o.fecha)+' · '+((o.items||[]).length)+' producto(s)</div><div style="font-size:10px;color:var(--green);font-weight:900;margin-top:5px;">Histórico local</div></div><div style="font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap;">'+money(o.total)+'</div></div></div>';}).join('');return true;}
    var c=cart();if(!c.length){el.innerHTML='<div style="padding:36px 20px;text-align:center;"><div style="font-size:42px;margin-bottom:12px;">🛒</div><div style="font-size:15px;font-weight:900;color:#111;margin-bottom:6px;">Sin compras en proceso</div><div style="font-size:12px;color:#777;">Tu carrito aparecerá aquí.</div></div>';return true;}var m=meta(), open=isOpen(), t=total(c), rows='';
    if(open){rows='<div id="dc-plaza-b2a-panel" class="dc-plaza-b2a-shadow" style="margin-top:14px;padding:12px 10px 13px;border-radius:18px;background:linear-gradient(180deg,#ffffff 0%,#f8fbfd 100%);border:.5px solid rgba(16,83,127,.12);overflow:hidden;"><div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;color:var(--blue);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.25px;"><span>▾</span><span>Detalle desplegado</span></div>'+c.map(function(x,i){var k=esc(keyOf(x,i)), q=qty(x.cantidad), p=num(x.precio);return '<div class="dc-b2a-item" data-key="'+k+'" style="display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:.5px solid #edf0f3;"><div style="width:42px;height:42px;border-radius:12px;background:#f3f6f8;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.08);">'+(x.foto?'<img src="'+esc(x.foto)+'" style="width:100%;height:100%;object-fit:cover;">':'')+'</div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:900;color:#111;line-height:1.18;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(x.nombre)+'</div><div class="dc-b2a-line" style="font-size:10px;color:#777;margin-top:3px;">'+money(p)+' × <span class="dc-b2a-qtext">'+q+'</span> = <span class="dc-b2a-sub">'+money(p*q)+'</span></div></div><div data-b2a-control="1" style="display:flex;align-items:center;gap:5px;flex-shrink:0;"><button type="button" class="dc-b2a-qty" data-key="'+k+'" data-d="-1" style="width:28px;height:28px;border:0;border-radius:10px;background:#eef6ff;color:var(--blue);font-weight:900;font-size:14px;">−</button><span class="dc-b2a-count" style="min-width:17px;text-align:center;font-size:12px;font-weight:900;">'+q+'</span><button type="button" class="dc-b2a-qty" data-key="'+k+'" data-d="1" style="width:28px;height:28px;border:0;border-radius:10px;background:#eef6ff;color:var(--blue);font-weight:900;font-size:14px;">+</button><button type="button" class="dc-b2a-del" data-key="'+k+'" aria-label="Eliminar" style="width:28px;height:28px;border:0;border-radius:10px;background:#fff0f0;color:#D63A2A;font-weight:900;font-size:13px;">🗑️</button></div></div>';}).join('')+'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:13px;"><span style="font-size:13px;font-weight:900;color:#111;">Total</span><span class="dc-b2a-total" style="font-size:21px;font-weight:900;color:var(--blue);">'+money(t)+'</span></div><button type="button" class="dc-b2abc-buy" data-b2a-control="1" style="width:100%;margin-top:12px;border:0;border-radius:14px;background:var(--blue);color:#fff;padding:13px;font-size:12px;font-weight:900;font-family:inherit;box-shadow:0 9px 18px rgba(26,122,181,.24);">Comprar →</button></div>';}
    el.innerHTML='<div id="dc-plaza-b2a-card" style="background:#fff;border:.5px solid '+(open?'rgba(16,83,127,.16)':'#dfe5eb')+';border-radius:18px;padding:14px;margin:14px 10px;box-shadow:'+(open?'0 16px 34px rgba(10,48,85,.13)':'0 5px 18px rgba(0,0,0,.05)')+';transition:box-shadow .22s ease,border-color .22s ease;"><div class="dc-b2a-toggle" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;cursor:pointer;"><div style="min-width:0;"><div style="font-size:14px;font-weight:900;color:#111;line-height:1.2;">🛒 Plaza Online</div><div style="font-size:11px;color:#777;margin-top:3px;font-weight:700;">Carrito '+date(m.fechaCreacion)+' · '+c.length+' producto(s)</div><div style="font-size:11px;color:var(--blue);font-weight:900;margin-top:4px;">'+(open?'Toca para contraer':'Toca para desplegar')+'</div></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0;"><div class="dc-b2a-head-total" style="font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap;">'+money(t)+'</div><div style="width:22px;height:22px;border-radius:50%;background:'+(open?'#eef6ff':'#f3f6f8')+';display:flex;align-items:center;justify-content:center;font-size:14px;color:#7b8b9a;">'+(open?'⌃':'⌄')+'</div></div></div>'+rows+'</div>';return true;}
  function patchQty(k,d){var c=cart(), changed=false, newQty=1, price=0; c=c.map(function(x,i){if(keyOf(x,i)===String(k)){x.cantidad=qty(qty(x.cantidad)+Number(d||0));x.qty=x.cantidad;newQty=x.cantidad;price=num(x.precio);changed=true;}return x;});if(!changed)return false;save(c);var row=document.querySelector('.dc-b2a-item[data-key="'+CSS.escape(String(k))+'"]');if(row){var a=row.querySelector('.dc-b2a-count'),b=row.querySelector('.dc-b2a-qtext'),s=row.querySelector('.dc-b2a-sub');if(a)a.textContent=newQty;if(b)b.textContent=newQty;if(s)s.textContent=money(price*newQty);}document.querySelectorAll('.dc-b2a-total,.dc-b2a-head-total').forEach(function(el){el.textContent=money(total(c));});return false;}
  function delItem(k){save(cart().filter(function(x,i){return keyOf(x,i)!==String(k);}));setOpen(true);return renderMis();}
  function ensureView(id,title,sub){style();var v=document.getElementById(id);if(!v){v=document.createElement('div');v.className='view go-right';v.id=id;v.style.flexDirection='column';v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button" onclick="go(\'v-mis-compras-plaza\',\'left\')">‹</button><div><div class="si13">'+title+'</div><div class="si21">'+sub+'</div></div></div></div><div class="scroll" id="'+id+'-lista" style="padding:14px 14px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';var base=document.getElementById('v-mis-compras-plaza')||document.querySelector('.view.active');if(base&&base.parentNode)base.parentNode.insertBefore(v,base.nextSibling);else document.body.appendChild(v);}return v;}
  function renderComprando(){ensureView('v-plaza-comprando','🛒 COMPRANDO','Plaza Online');var el=document.getElementById('v-plaza-comprando-lista')||document.getElementById('plaza-comprando-lista');if(!el)return;var sel=rj(SEL_KEY,null)||{}, c=norm(sel.items||cart());var html='<div class="dc-plaza-buy-card"><div class="dc-plaza-buy-title">Plaza Online</div><div class="dc-plaza-buy-sub">Carrito '+date(sel.fecha||meta().fechaCreacion)+' · '+c.length+' producto(s)</div></div><div class="dc-plaza-buy-card"><div class="dc-plaza-buy-title" style="margin-bottom:8px;">Detalle de productos</div>';if(!c.length)html+='<div class="dc-plaza-buy-sub">Tu carrito está vacío.</div>';c.forEach(function(x){html+='<div class="dc-plaza-buy-row"><div><div style="font-size:13px;font-weight:900;color:#111;">'+esc(x.nombre)+'</div><div class="dc-plaza-buy-sub">Cantidad '+qty(x.cantidad)+' · '+money(num(x.precio))+'</div></div><div style="font-size:13px;font-weight:900;color:#111;">'+money(qty(x.cantidad)*num(x.precio))+'</div></div>';});html+='</div><div class="dc-plaza-buy-card"><div class="dc-plaza-buy-title" style="margin-bottom:10px;">Entrega</div><div style="display:flex;gap:8px;margin-bottom:10px;"><button type="button" class="dc-plaza-buy-pill active" data-dc-plaza-entrega="domicilio">Entrega a domicilio</button><button type="button" class="dc-plaza-buy-pill" data-dc-plaza-entrega="recoger">Pasaré a recoger</button></div><input class="dc-plaza-buy-input" id="dc-legacy-dc-plaza-dir-compra-2" data-dc-legacy-id="dc-plaza-dir-compra" placeholder="Dirección de entrega"><textarea class="dc-plaza-buy-input" id="dc-legacy-dc-plaza-nota-compra-2" data-dc-legacy-id="dc-plaza-nota-compra" style="margin-top:8px;min-height:70px;resize:none;" placeholder="Nota para el negocio"></textarea></div><div class="dc-plaza-buy-card"><div class="dc-plaza-buy-title" style="margin-bottom:8px;">Pago</div><div class="dc-plaza-buy-sub">Forma de pago local/demo.</div><div class="dc-plaza-buy-row" style="margin-top:8px;"><div class="dc-plaza-buy-title">Total</div><div class="dc-plaza-buy-title">'+money(total(c))+'</div></div><button type="button" class="dc-plaza-buy-primary" id="dc-legacy-dc-plaza-confirmar-compra-3" data-dc-legacy-id="dc-plaza-confirmar-compra">Comprar</button></div>';el.innerHTML=html;}
  function forceGo(id){if(id==='v-plaza-comprando')renderComprando();if(typeof window.go==='function')window.go(id,'right');setTimeout(function(){var v=document.getElementById(id);if(!v)return;if(!v.classList.contains('active')){document.querySelectorAll('.view').forEach(function(x){x.classList.remove('active');});v.classList.add('active');v.style.display='flex';}if(id==='v-plaza-comprando')renderComprando();},70);}
  function buy(){var c=cart();if(!c.length)return false;wj(SEL_KEY,{id:'plaza_carrito_activo_v61',tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:meta().fechaCreacion,items:c,total:total(c)});closeOpen();forceGo('v-plaza-comprando');return false;}
  function finish(e){stop(e);var c=norm((rj(SEL_KEY,{})||{}).items||cart());var order={id:'plaza_'+Date.now(),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)};wj(ORDER_KEY,order);var h=rj(HIST_KEY,[]);h.unshift(order);wj(HIST_KEY,h.slice(0,20));if(typeof window.dcPlazaFinalFelizOficial==='function'){try{return window.dcPlazaFinalFelizOficial(function(){ensureView('v-plaza-seguimiento','📍 SEGUIMIENTO','Plaza Online');forceGo('v-plaza-seguimiento');}),false;}catch(_){}}ensureView('v-plaza-seguimiento','📍 SEGUIMIENTO','Plaza Online');forceGo('v-plaza-seguimiento');return false;}
  function handler(e){var t=e.target;if(!t||!t.closest)return;var tabBtn=t.closest('#dc-plaza-tabs-old-disabled');if(tabBtn&&tabBtn.closest('#v-mis-compras-plaza')){stop(e);var now=Date.now();if(now-lastTap<260)return false;lastTap=now;tab=tabBtn.id==='miscompras-tab-anteriores'?'anteriores':'proceso';closeOpen();renderMis();return false;}var conf=t.closest('#dc-plaza-confirmar-compra');if(conf)return finish(e);if(!t.closest('#v-mis-compras-plaza'))return;var qbtn=t.closest('.dc-b2a-qty');if(qbtn){stop(e);return patchQty(qbtn.getAttribute('data-key'),qbtn.getAttribute('data-d'));}var del=t.closest('.dc-b2a-del');if(del){stop(e);return delItem(del.getAttribute('data-key'));}var b=t.closest('.dc-b2abc-buy,.dc-b2a-buy,.dc-plaza-2a-comprar');if(b){stop(e);return buy();}if(t.closest('[data-b2a-control="1"],button,input,textarea,select'))return;var card=t.closest('.dc-b2a-toggle,#dc-plaza-b2a-card');if(card){stop(e);setOpen(!isOpen());renderMis();return false;}}
  window.addEventListener('pointerdown',handler,true);window.addEventListener('click',handler,true);window.addEventListener('touchstart',handler,true);
  window.cargarMisComprasPlaza=renderMis;window.cambiarTabMisComprasPlaza=function(t){tab=t||'proceso';closeOpen();return renderMis();};window.dcPlazaComprarDesdeMisCompras=buy;window.dcPlazaRenderComprando=renderComprando;
})();


(function(){
  if(window.__dcPlaza2BComprandoRestaurantStyleFix) return;
  window.__dcPlaza2BComprandoRestaurantStyleFix = true;

  var CART_KEY='dcPlazaCartV61';
  var SEL_KEY='dcPlazaCompraSeleccionada';

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){return (Array.isArray(a)?a:[]).map(function(x,i){x=Object.assign({},x||{});x.key=keyOf(x,i);x.nombre=x.nombre||x.titulo||x.name||'Producto';x.precio=num(x.precio||x.price||x.precioUnitario);x.cantidad=qty(x.cantidad||x.qty||1);x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';return x;});}
  function cart(){return norm(rj(CART_KEY,[]));}
  function total(c){return norm(c).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function selected(){var s=rj(SEL_KEY,null)||{};var items=norm(s.items||cart());return {meta:s,items:items,total:total(items)};}
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}

  function ensureStyle(){
    if(document.getElementById('dc-plaza-2b-rest-style')) return;
    var s=document.createElement('style');
    s.id='dc-plaza-2b-rest-style';
    s.textContent=''+
      '#v-plaza-comprando .scroll{background:#F5F6F0!important;}'+
      '.dc-plz-order-card{background:#fff;border:.5px solid #dde4ea;border-radius:14px;margin:8px 8px 10px;padding:12px;box-shadow:0 4px 14px rgba(10,48,85,.055);}'+
      '.dc-plz-product-row{display:flex;align-items:center;gap:10px;background:#fff;border:.5px solid #e0e6eb;border-radius:14px;padding:10px;margin:8px 8px 10px;box-shadow:0 4px 12px rgba(10,48,85,.045);}'+
      '.dc-plz-product-img{width:45px;height:45px;border-radius:10px;background:#F3F5F7;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}'+
      '.dc-plz-product-main{flex:1;min-width:0;}'+
      '.dc-plz-product-name{font-size:13px;font-weight:900;color:#111;line-height:1.15;}'+
      '.dc-plz-product-sub{font-size:11px;color:#555;margin-top:3px;}'+
      '.dc-plz-product-price{font-size:13px;font-weight:900;color:#111;white-space:nowrap;}'+
      '.dc-plz-product-x{width:28px;height:28px;border:.5px solid #d5dce3;border-radius:7px;background:#fff;color:#333;font-size:17px;line-height:1;font-weight:600;}'+
      '.dc-plz-sec-label{font-size:11px;color:#666;font-weight:700;margin:10px 10px 7px;display:flex;align-items:center;gap:6px;}'+
      '.dc-plz-option{background:#fff;border:.8px solid #e0e2e4;border-radius:14px;padding:12px;margin:8px 8px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.025);}'+
      '.dc-plz-option.active{border-color:#1FC26A;background:#EAF9F1;}'+
      '.dc-plz-option-ic{width:36px;height:36px;border-radius:10px;background:#FFF6D8;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}'+
      '.dc-plz-option-txt{flex:1;min-width:0;}'+
      '.dc-plz-option-title{font-size:13px;font-weight:900;color:#111;line-height:1.1;}'+
      '.dc-plz-option-sub{font-size:11px;color:#777;margin-top:2px;}'+
      '.dc-plz-radio{width:18px;height:18px;border-radius:50%;border:2px solid #d6d6d6;box-sizing:border-box;position:relative;flex-shrink:0;}'+
      '.dc-plz-option.active .dc-plz-radio{border-color:#1FC26A;}'+
      '.dc-plz-option.active .dc-plz-radio:after{content:"";position:absolute;left:3px;top:3px;width:8px;height:8px;border-radius:50%;background:#1FC26A;}'+
      '.dc-plz-input{width:calc(100% - 16px);margin:8px 8px;border:.8px solid #e0e2e4;border-radius:14px;padding:12px 13px;font-size:12px;font-family:inherit;background:#fff;box-sizing:border-box;outline:none;}'+
      'textarea.dc-plz-input{min-height:78px;resize:none;}'+
      '.dc-plz-info{margin:12px 8px;background:#F1E8FB;border-left:4px solid #7B3FA0;border-radius:12px;padding:12px;color:#4b148c;font-size:11px;line-height:1.45;font-weight:600;}'+
      '.dc-plz-summary{background:#fff;border:.8px solid #e6e0d0;border-radius:14px;margin:14px 8px 10px;padding:12px;}'+
      '.dc-plz-srow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;color:#777;border-bottom:.5px solid #eee;}'+
      '.dc-plz-srow.total{border-bottom:0;font-size:15px;font-weight:900;color:#111;}'+
      '.dc-plz-buy-btn{width:calc(100% - 16px);margin:0 8px 18px;border:none;border-radius:14px;background:#F5C518;color:#5b4300;padding:14px;font-size:13px;font-weight:900;font-family:inherit;box-shadow:0 10px 20px rgba(245,197,24,.26);}';
    document.head.appendChild(s);
  }

  function ensureView(){
    var v=document.getElementById('v-plaza-comprando');
    if(!v){
      v=document.createElement('div');
      v.className='view go-right';
      v.id='dc-legacy-v-plaza-comprando-2' data-dc-legacy-id="v-plaza-comprando";
      v.style.flexDirection='column';
      v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button" onclick="go(\'v-mis-compras-plaza\',\'left\')">‹</button><div><div class="si13">🛒 COMPRANDO</div><div class="si21">Plaza Online</div></div></div></div><div class="scroll" id="dc-legacy-v-plaza-comprando-lista-1" data-dc-legacy-id="v-plaza-comprando-lista" style="padding:10px 6px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
      var base=document.getElementById('v-mis-compras-plaza')||document.querySelector('.view:last-of-type');
      if(base&&base.parentNode) base.parentNode.insertBefore(v,base.nextSibling); else document.body.appendChild(v);
    }
    return v;
  }

  function renderComprandoRestaurant(){
    ensureStyle();ensureView();
    var data=selected(), c=data.items, subtotal=data.total, envio=0, el=document.getElementById('v-plaza-comprando-lista');
    if(!el) return false;
    var html='';
    if(!c.length){
      html='<div class="dc-plz-order-card"><div style="font-size:22px;text-align:center;margin-bottom:6px;">🛒</div><div style="font-size:13px;font-weight:900;text-align:center;">Tu carrito está vacío</div><div style="font-size:11px;color:#777;text-align:center;margin-top:3px;">Regresa a Plaza Online para agregar productos.</div></div>';
      el.innerHTML=html; return false;
    }
    c.forEach(function(x,i){
      var img=x.foto?'<img class="dc-plz-product-img" src="'+esc(x.foto)+'" onerror="this.outerHTML=\'<div class=&quot;dc-plz-product-img&quot;>🛍️</div>\'">':'<div class="dc-plz-product-img">🛍️</div>';
      html+='<div class="dc-plz-product-row">'+img+'<div class="dc-plz-product-main"><div class="dc-plz-product-name">'+esc(x.nombre)+'</div><div class="dc-plz-product-sub">'+qty(x.cantidad)+' x '+money(num(x.precio))+'</div></div><div class="dc-plz-product-price">'+money(num(x.precio)*qty(x.cantidad))+'</div><button type="button" class="dc-plz-product-x" aria-label="Quitar producto" data-b2b-remove="'+esc(x.key||i)+'">×</button></div>';
    });
    html+='<div class="dc-plz-sec-label">📦 ¿Cómo deseas recibir tu compra?</div>';
    html+='<div class="dc-plz-option active" data-dc-plaza-entrega="domicilio"><div class="dc-plz-option-ic">🚚</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Entrega a domicilio</div><div class="dc-plz-option-sub">Repartidor DC / Tienda</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-entrega="recoger"><div class="dc-plz-option-ic">🏪</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Pasaré a recoger</div><div class="dc-plz-option-sub">Recoger directamente en tienda</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-sec-label">📍 Tu dirección de entrega</div><input id="dc-legacy-dc-plaza-dir-compra-3" data-dc-legacy-id="dc-plaza-dir-compra" class="dc-plz-input" placeholder="Calle, número, colonia, referencias...">';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-legacy-dc-plaza-nota-compra-3" data-dc-legacy-id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Color, talla, indicaciones, referencias..."></textarea>';
    html+='<div class="dc-plz-info">🏍️ <b>Compra con entrega local</b><br>Acuerda el pago directamente con el negocio. El repartidor DC sólo realiza la entrega cuando aplique.</div>';
    html+='<div class="dc-plz-sec-label">💳 Forma de pago</div>';
    html+='<div class="dc-plz-option active" data-dc-plaza-pago="efectivo"><div class="dc-plz-option-ic">💵</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Efectivo al entregar</div><div class="dc-plz-option-sub">Paga al recibir</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-pago="tarjeta"><div class="dc-plz-option-ic">💳</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Tarjeta al entregar</div><div class="dc-plz-option-sub">Terminal en la entrega</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-pago="transferencia"><div class="dc-plz-option-ic">🏦</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Transferencia</div><div class="dc-plz-option-sub">SPEI / Nómina</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-summary"><div class="dc-plz-srow"><span>Subtotal</span><span>'+money(subtotal)+'</span></div><div class="dc-plz-srow"><span>Envío</span><span>'+(envio?money(envio):'Gratis')+'</span></div><div class="dc-plz-srow total"><span>Total</span><span>'+money(subtotal+envio)+'</span></div></div>';
    html+='<button type="button" class="dc-plz-buy-btn" id="dc-plaza-confirmar-compra">Comprar →</button>';
    el.innerHTML=html;
    return false;
  }

  document.addEventListener('click',function(e){
    var ent=e.target&&e.target.closest&&e.target.closest('[data-dc-plaza-entrega]');
    if(ent&&ent.closest('#v-plaza-comprando')){e.preventDefault();e.stopPropagation();document.querySelectorAll('#v-plaza-comprando [data-dc-plaza-entrega]').forEach(function(x){x.classList.remove('active');});ent.classList.add('active');localStorage.setItem('dcPlazaTipoEntrega',ent.getAttribute('data-dc-plaza-entrega'));return false;}
    var pay=e.target&&e.target.closest&&e.target.closest('[data-dc-plaza-pago]');
    if(pay&&pay.closest('#v-plaza-comprando')){e.preventDefault();e.stopPropagation();document.querySelectorAll('#v-plaza-comprando [data-dc-plaza-pago]').forEach(function(x){x.classList.remove('active');});pay.classList.add('active');localStorage.setItem('dcPlazaTipoPago',pay.getAttribute('data-dc-plaza-pago'));return false;}
  },true);

  window.dcPlazaRenderComprando = renderComprandoRestaurant;
  window.dcPlazaRenderComprandoRestaurant = renderComprandoRestaurant;

  if(document.getElementById('v-plaza-comprando')&&document.getElementById('v-plaza-comprando').classList.contains('active')) setTimeout(renderComprandoRestaurant,50);
})();


(function(){
  if(window.__dcPlaza2CPostCompraOrdenFixQuirurgico) return;
  window.__dcPlaza2CPostCompraOrdenFixQuirurgico = true;

  var CART_KEY='dcPlazaCartV61';
  var META_KEY='dcPlazaB2AMeta';
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var ORDER_KEY='dcPlazaCompraPlazaActiva';
  var ORDER_KEY2='dcPlazaOrdenPlazaEnProceso';
  var LOCK_FLAG='dcPlazaOrdenProcesoActivaV62';
  var OPEN_KEY='dcPlazaB2AOpen';
  var prevRenderMis=window.cargarMisComprasPlaza;
  var prevGo=window.go;

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function rm(k){try{localStorage.removeItem(k);}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){return (Array.isArray(a)?a:[]).map(function(x,i){x=Object.assign({},x||{});x.key=keyOf(x,i);x.nombre=x.nombre||x.titulo||x.name||'Producto';x.precio=num(x.precio||x.price||x.precioUnitario);x.cantidad=qty(x.cantidad||x.qty||1);x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';return x;});}
  function cart(){return norm(rj(CART_KEY,[]));}
  function total(c){return norm(c).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function order(){var o=rj(ORDER_KEY,null)||rj(ORDER_KEY2,null)||rj(SEL_KEY,null);if(o&&o.tipo==='plaza_orden'&&o.estado!=='entregado'&&o.estado!=='recogido'&&o.estado!=='finalizado')return o;return null;}
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){}}
  function closeOpen(){['dcPlazaB2AOpen','dcPlazaMisComprasOpen','dcPlazaCarritoAbierto','dcPlaza2AOpen','dcPlazaCartV61OpenFinal','dcPlazaCartV61Open','dcPlazaCartOpen'].forEach(function(k){try{localStorage.setItem(k,'0');}catch(_){}});}
  function setTabs(tab){var bp=document.getElementById('miscompras-tab-proceso'),ba=document.getElementById('miscompras-tab-anteriores'),sub=document.getElementById('miscompras-plaza-sub');if(sub)sub.textContent=tab==='anteriores'?'Compras anteriores':'Compras en proceso';if(bp&&ba){bp.style.background=tab==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';ba.style.background=tab==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';bp.style.color=ba.style.color='#fff';}}

  function ensureSegView(){
    var v=document.getElementById('v-plaza-seguimiento');
    if(!v){
      v=document.createElement('div');v.className='view go-right';v.id='v-plaza-seguimiento';v.style.flexDirection='column';
      v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back" type="button" id="dc-plaza-seg-back">‹</button><div><div class="si13">📍 SEGUIMIENTO</div><div class="si21">Plaza Online</div></div></div></div><div class="scroll" id="v-plaza-seguimiento-lista" style="padding:14px 14px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
      var base=document.getElementById('v-plaza-comprando')||document.getElementById('v-mis-compras-plaza')||document.querySelector('.view:last-of-type');
      if(base&&base.parentNode)base.parentNode.insertBefore(v,base.nextSibling);else document.body.appendChild(v);
    }
    var b=document.getElementById('dc-plaza-seg-back');
    if(b)b.onclick=function(ev){stop(ev);goMisProceso();return false;};
    return v;
  }

  function renderSeg(){
    var o=order()||rj(SEL_KEY,{})||{}, items=norm(o.items||cart()), t=Number(o.total)||total(items), el;
    ensureSegView(); el=document.getElementById('v-plaza-seguimiento-lista'); if(!el)return false;
    var rows=items.map(function(x){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:.5px solid #eee;"><div><div style="font-size:12px;font-weight:900;color:#111;line-height:1.25;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div style="font-size:10px;color:#777;margin-top:2px;">'+money(num(x.precio))+' c/u</div></div><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty(x.cantidad))+'</div></div>';}).join('');
    el.innerHTML='<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:24px 14px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:34px;margin-bottom:8px;">📦</div><div style="font-size:17px;font-weight:900;color:#111;">Compra recibida</div><div style="font-size:12px;color:#777;margin-top:5px;">Esperando confirmación del negocio</div></div>'+
      '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:20px 14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="display:grid;grid-template-columns:34px 1fr;row-gap:18px;align-items:center;"><div style="width:28px;height:28px;border-radius:50%;background:#20c76a;color:#fff;display:flex;align-items:center;justify-content:center;">📦</div><div style="font-size:13px;font-weight:900;color:#111;">Compra recibida</div><div style="width:28px;height:28px;border-radius:50%;background:#1A7AB5;color:#fff;display:flex;align-items:center;justify-content:center;">📋</div><div style="font-size:13px;font-weight:900;color:#111;">Preparando pedido</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🛍️</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">Listo</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🚚</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">En camino</div><div style="width:28px;height:28px;border-radius:50%;background:#f0f2f3;display:flex;align-items:center;justify-content:center;">🏠</div><div style="font-size:13px;font-weight:900;color:#99a1aa;">Entregado</div></div></div>'+
      '<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:16px;padding:14px;margin-top:14px;box-shadow:0 8px 20px rgba(0,0,0,.055);"><div style="font-size:10px;font-weight:900;color:#999;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;">Tu compra</div>'+rows+'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:3px;"><div style="font-size:15px;font-weight:900;color:#111;">Total</div><div style="font-size:18px;font-weight:900;color:#111;">'+money(t)+'</div></div><div style="font-size:11px;color:#777;margin-top:12px;">Orden '+esc(o.id||'plaza_demo')+' · '+date(o.fecha)+'</div></div>';
    return false;
  }

  function activate(id,dir){
    if(id==='v-plaza-seguimiento')renderSeg();
    var r=(typeof prevGo==='function')?prevGo.call(window,id,dir||'right'):undefined;
    setTimeout(function(){var v=document.getElementById(id);if(v&&!v.classList.contains('active')){document.querySelectorAll('.view').forEach(function(x){x.classList.remove('active');});v.classList.add('active');v.style.display='flex';}if(id==='v-plaza-seguimiento')renderSeg();if(id==='v-mis-compras-plaza')renderMis('proceso');},80);
    return r;
  }
  function goMisProceso(){closeOpen();renderMis('proceso');activate('v-mis-compras-plaza','left');setTimeout(function(){renderMis('proceso');},120);return false;}

  function renderLockedOrder(o){
    var el=document.getElementById('miscompras-plaza-lista'); if(!el)return false; o=o||order(); if(!o)return false; var items=norm(o.items||[]), t=Number(o.total)||total(items);
    setTabs('proceso'); closeOpen();
    el.innerHTML='<div style="background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;margin:14px 10px;box-shadow:0 9px 24px rgba(10,48,85,.075);"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;"><div style="min-width:0;"><div style="font-size:14px;font-weight:900;color:#111;line-height:1.2;">📦 Plaza Online</div><div style="font-size:11px;color:#777;margin-top:3px;font-weight:700;">Compra '+date(o.fecha)+' · '+items.length+' producto(s)</div><div style="display:inline-flex;margin-top:7px;padding:5px 9px;border-radius:999px;background:#EAF9F1;color:#0b8d44;font-size:10px;font-weight:900;">Compra recibida</div></div><div style="font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap;">'+money(t)+'</div></div><div style="margin-top:12px;padding-top:10px;border-top:.5px solid #edf0f2;">'+items.slice(0,3).map(function(x){return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;color:#111;margin:5px 0;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</span><span>'+money(num(x.precio)*qty(x.cantidad))+'</span></div>';}).join('')+'</div><button type="button" id="dc-plaza-ver-proceso" style="width:100%;margin-top:12px;border:0;border-radius:14px;background:var(--blue);color:#fff;padding:13px;font-size:12px;font-weight:900;font-family:inherit;box-shadow:0 9px 18px rgba(26,122,181,.24);">Ver proceso →</button></div>';
    return false;
  }
  function renderMis(tab){
    var o=order();
    if(tab==='anteriores'){setTabs('anteriores');if(typeof prevRenderMis==='function')return prevRenderMis.call(window);return false;}
    if(o)return renderLockedOrder(o);
    if(typeof prevRenderMis==='function')return prevRenderMis.call(window);
    return false;
  }

  function finalize(e){
    stop(e);
    var sel=rj(SEL_KEY,null)||{}, items=norm(sel.items&&sel.items.length?sel.items:cart());
    if(!items.length)return false;
    var o={id:'plaza_'+Date.now(),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:items,total:total(items),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:(localStorage.getItem('dcPlazaTipoPago')||'efectivo')};
    wj(ORDER_KEY,o); wj(ORDER_KEY2,o); wj(SEL_KEY,o); localStorage.setItem(LOCK_FLAG,'1');
    wj(CART_KEY,[]); wj('dcPlazaCompraProceso',null); wj('dcPlazaCompras',[]); rm(META_KEY); closeOpen();
    function after(){renderSeg();activate('v-plaza-seguimiento','right');}
    try{if(typeof window.dcPlazaFinalFelizOficial==='function'){window.dcPlazaFinalFelizOficial(after);return false;}if(typeof window.plazaFinalFelizCarrito==='function'){window.plazaFinalFelizCarrito('Compra exitosa',after);return false;}}catch(_){ }
    after(); return false;
  }

  function normalizeConfirmButton(){
    var b=document.querySelector('#v-plaza-comprando #dc-plaza-confirmar-compra');
    if(b){b.id='dc-plaza-confirmar-compra-final';b.setAttribute('type','button');}
  }
  var oldRenderComprando=window.dcPlazaRenderComprandoRestaurant||window.dcPlazaRenderComprando;
  function renderComprandoSafe(){if(typeof oldRenderComprando==='function')oldRenderComprando();setTimeout(normalizeConfirmButton,0);setTimeout(normalizeConfirmButton,70);setTimeout(normalizeConfirmButton,150);setTimeout(normalizeConfirmButton,250);return false;}

  document.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    var fin=t.closest('#dc-plaza-confirmar-compra-final'); if(fin)return finalize(e);
    var ver=t.closest('#dc-plaza-ver-proceso'); if(ver){stop(e);renderSeg();activate('v-plaza-seguimiento','right');return false;}
  },true);
  document.addEventListener('pointerdown',function(e){var t=e.target;if(t&&t.closest&&t.closest('#dc-plaza-confirmar-compra-final,#dc-plaza-ver-proceso'))stop(e);},true);

  window.cargarMisComprasPlaza=function(){return renderMis('proceso');};
  window.cambiarTabMisComprasPlaza=function(t){closeOpen();return renderMis(t||'proceso');};
  window.dcPlazaRenderSeguimiento=renderSeg;
  window.dcPlazaRenderComprando=renderComprandoSafe;
  window.dcPlazaRenderComprandoRestaurant=renderComprandoSafe;
  window.dcPlazaConfirmarCompraFinal=finalize;
  var moTarget=document.getElementById('miscompras-plaza-lista');
  if(moTarget){var mo=new MutationObserver(function(){if(window.__dcPlazaL14GoWrap)return;var txt=(moTarget.textContent||'').toLowerCase();if(order()&&txt.indexOf('sin compras en proceso')>=0)setTimeout(function(){renderLockedOrder(order());},30);});mo.observe(moTarget,{childList:true,subtree:true});}
  if(document.getElementById('v-plaza-comprando')&&document.getElementById('v-plaza-comprando').classList.contains('active'))renderComprandoSafe();
  if(document.getElementById('v-mis-compras-plaza')&&document.getElementById('v-mis-compras-plaza').classList.contains('active'))setTimeout(function(){renderMis('proceso');},80);
})();


(function(){
  if(window.__dcPlazaV62QF36RenderDuenoUnico) return;
  window.__dcPlazaV62QF36RenderDuenoUnico = true;

  var CART_KEY='dcPlazaCartV61';
  var LEGACY_CART_KEYS=['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart','dcPlazaCompraProceso'];
  var META_KEY='dcPlazaCartV61Meta';
  var META_ALT='dcPlazaB2AMeta';
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var ORDER_KEY='dcPlazaOrdenPlazaEnProceso';
  var ORDER_ALT='dcPlazaCompraPlazaActiva';
  var ORDER_ACTIVE_ALT='dcPlazaOrdenActivaV62';
  var HIST_KEY='dcPlazaComprasHistorial';
  var HIST_ALT='dcPlazaOrdenesPlazaV62';
  var OPEN_KEY='dcPlazaQF36Open';
  var VAC_KEY='dcPlazaQF36VaciarOpen';
  var OWNER='qf36';
  var rendering=false;
  var currentTab='proceso';

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function rm(k){try{localStorage.removeItem(k);}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){
    if(a && !Array.isArray(a) && Array.isArray(a.items)) a=a.items;
    return (Array.isArray(a)?a:[]).filter(Boolean).map(function(x,i){
      x=Object.assign({},x||{}); x.key=keyOf(x,i); x.id=x.id||x.productoId||x.key;
      x.nombre=x.nombre||x.titulo||x.name||'Producto'; x.precio=num(x.precio||x.price||x.precioUnitario);
      x.cantidad=qty(x.cantidad||x.qty||1); x.qty=x.cantidad; x.foto=x.foto||x.img||x.imagen||x.fotoProducto||''; return x;
    });
  }
  function total(c){return norm(c).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function sameItems(a,b){a=norm(a);b=norm(b);if(!a.length||a.length!==b.length)return false;var A=a.map(function(x,i){return keyOf(x,i)+'|'+qty(x.cantidad)+'|'+num(x.precio);}).sort().join(';;');var B=b.map(function(x,i){return keyOf(x,i)+'|'+qty(x.cantidad)+'|'+num(x.precio);}).sort().join(';;');return A===B;}
  function setOpen(v){try{localStorage.setItem(OPEN_KEY,v?'1':'0');['dcPlazaB2AOpen','dcPlaza2AOpen','dcPlazaCartV61OpenFinal','dcPlazaCartV61Open','dcPlazaCartOpen','dcPlazaMisComprasOpen','dcPlazaCarritoAbierto'].forEach(function(k){localStorage.setItem(k,'0');});}catch(e){}}
  function isOpen(){return localStorage.getItem(OPEN_KEY)==='1';}
  function setVac(v){try{localStorage.setItem(VAC_KEY,v?'1':'0');}catch(e){}}
  function isVac(){return localStorage.getItem(VAC_KEY)==='1';}
  function collapseAll(){
    try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}
  }
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){} return false;}
  function listEl(){return document.getElementById('miscompras-plaza-lista');}
  function viewActive(){var v=document.getElementById('v-mis-compras-plaza');return !!(v&&v.classList.contains('active'));}
  function meta(){var m=rj(META_KEY,null)||rj(META_ALT,null)||{fechaCreacion:Date.now()}; if(!m.fechaCreacion)m.fechaCreacion=Date.now(); wj(META_KEY,m); wj(META_ALT,m); return m;}
  function activeOrder(){
    var keys=[ORDER_KEY,ORDER_ALT,ORDER_ACTIVE_ALT,SEL_KEY];
    for(var i=0;i<keys.length;i++){var o=rj(keys[i],null); if(o&&o.tipo==='plaza_orden'&&['entregado','recogido','finalizado','cancelado'].indexOf(o.estado)<0) return o;}
    return null;
  }
  function clearCartOnly(){
    wj(CART_KEY,[]); LEGACY_CART_KEYS.forEach(function(k){ if(k==='dcPlazaCompraProceso') rm(k); else wj(k,[]); });
    rm(META_KEY); rm(META_ALT); setOpen(false); setVac(false);
  }
  function saveCart(c){
    c=norm(c); wj(CART_KEY,c); wj('dcPlazaCarrito',c); wj('dcPlazaCarritoEnProceso',c);
    if(c.length){var m=meta(); wj('dcPlazaCompraProceso',{id:'plaza_carrito_activo_qf36',tipo:'plaza_carrito',estado:'proceso',titulo:'Plaza Online',fecha:m.fechaCreacion,items:c,total:total(c)});} else {rm('dcPlazaCompraProceso');}
    return c;
  }
  function cart(){
    var o=activeOrder();
    var c=norm(rj(CART_KEY,[]));
    if(c.length){ return c; }
    for(var i=0;i<LEGACY_CART_KEYS.length;i++){
      var l=norm(rj(LEGACY_CART_KEYS[i],[]));
      if(l.length){ saveCart(l); return l; }
    }
    return [];
  }
  function history(){var h=rj(HIST_KEY,[]); var a=rj(HIST_ALT,[]); if(!h.length&&a.length)h=a; return Array.isArray(h)?h:[];}
  function saveOrder(o){wj(ORDER_KEY,o); wj(ORDER_ALT,o); wj(ORDER_ACTIVE_ALT,o); wj(SEL_KEY,o); var h=history().filter(function(x){return x&&x.id!==o.id;}); h.unshift(o); wj(HIST_KEY,h.slice(0,30)); wj(HIST_ALT,h.slice(0,30));}

  function style(){ if(document.getElementById('dc-plaza-qf36-style')) return; var s=document.createElement('style'); s.id='dc-plaza-qf36-style'; s.textContent='[data-dc-plaza-owner="qf36"] button{font-family:inherit}.dc-qf36-card{background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;margin:14px 10px;box-shadow:0 9px 24px rgba(10,48,85,.075)}.dc-qf36-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:.5px solid #edf0f2}.dc-qf36-row:last-child{border-bottom:0}.dc-qf36-btn{width:100%;margin-top:12px;border:0;border-radius:14px;background:var(--blue);color:#fff;padding:13px;font-size:12px;font-weight:900;box-shadow:0 9px 18px rgba(26,122,181,.24)}.dc-qf36-muted{font-size:11px;color:#777;font-weight:700;line-height:1.35}.dc-qf36-title{font-size:14px;font-weight:900;color:#111;line-height:1.2}.dc-qf36-pill{display:inline-flex;margin-top:7px;padding:5px 9px;border-radius:999px;background:#EAF9F1;color:#0b8d44;font-size:10px;font-weight:900}.dc-qf36-item{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:.5px solid #edf0f2}.dc-qf36-qty,.dc-qf36-del{width:28px;height:28px;border:0;border-radius:10px;font-weight:900}.dc-qf36-qty{background:#eef6ff;color:var(--blue);font-size:14px}.dc-qf36-del{background:#fff0f0;color:#D63A2A;font-size:13px}'; document.head.appendChild(s); }
  function setTabs(t){currentTab=t||currentTab||'proceso'; window._misComprasPlazaTab=currentTab; var bp=document.getElementById('miscompras-tab-proceso'),ba=document.getElementById('miscompras-tab-anteriores'),sub=document.getElementById('miscompras-plaza-sub'); if(sub)sub.textContent=currentTab==='anteriores'?'Compras anteriores':'Compras en proceso'; if(bp&&ba){bp.style.background=currentTab==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';ba.style.background=currentTab==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';bp.style.color=ba.style.color='#fff';}}
  function rowsRead(items){items=norm(items); return items.map(function(x){return '<div class="dc-qf36-row"><div style="min-width:0"><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div class="dc-qf36-muted">'+money(num(x.precio))+' c/u</div></div><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty(x.cantidad))+'</div></div>';}).join('');}
  function orderCard(o){o=o||activeOrder(); if(!o)return ''; var items=norm(o.items||[]),t=Number(o.total)||total(items); return '<div class="dc-qf36-card" data-qf36-order="1"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div style="min-width:0"><div class="dc-qf36-title">📦 Plaza Online</div><div class="dc-qf36-muted" style="margin-top:3px">Compra '+date(o.fecha)+' · '+items.length+' producto(s)</div><div class="dc-qf36-pill">Compra en proceso</div></div><div style="font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap">'+money(t)+'</div></div><div style="margin-top:12px;padding-top:10px;border-top:.5px solid #edf0f2">'+rowsRead(items)+'</div><button type="button" class="dc-qf36-btn" id="dc-qf36-seguimiento">Dar seguimiento →</button></div>'; }
  function cartItems(c){return norm(c).map(function(x,i){var k=esc(keyOf(x,i)),q=qty(x.cantidad),p=num(x.precio);return '<div class="dc-qf36-item"><div style="width:42px;height:42px;border-radius:12px;background:#f3f6f8;overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.08)">'+(x.foto?'<img src="'+esc(x.foto)+'" style="width:100%;height:100%;object-fit:cover">':'')+'</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:900;color:#111;line-height:1.18;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+esc(x.nombre)+'</div><div class="dc-qf36-muted">'+money(p)+' × '+q+' = '+money(p*q)+'</div></div><div data-qf36-control="1" style="display:flex;align-items:center;gap:5px;flex-shrink:0"><button type="button" class="dc-qf36-qty" data-key="'+k+'" data-d="-1">−</button><span style="min-width:17px;text-align:center;font-size:12px;font-weight:900">'+q+'</span><button type="button" class="dc-qf36-qty" data-key="'+k+'" data-d="1">+</button><button type="button" class="dc-qf36-del" data-key="'+k+'">🗑️</button></div></div>';}).join('');}
  function cartCard(c){c=norm(c||cart()); if(!c.length)return ''; var open=isOpen(),t=total(c); var html='<div class="dc-qf36-card" data-qf36-cart="1"><div id="dc-qf36-cart-toggle" style="cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div class="dc-qf36-title">🛒 Carrito nuevo Plaza Online</div><div class="dc-qf36-muted" style="margin-top:3px">'+c.length+' producto(s) · '+money(t)+'</div><div style="font-size:11px;color:var(--blue);font-weight:900;margin-top:4px">'+(open?'Toca para contraer':'Toca para desplegar')+'</div></div><div style="font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap">'+(open?'⌃':'⌄')+'</div></div>'; if(open){html+='<div style="margin-top:12px;padding-top:10px;border-top:.5px solid #edf0f2">'+cartItems(c)+'</div><button type="button" class="dc-qf36-btn" id="dc-legacy-dc-qf36-continuar-1" data-dc-legacy-id="dc-qf36-continuar">Continuar compra →</button>'; if(isVac())html+='<div style="margin-top:10px;background:#FDECEA;border-radius:14px;padding:12px;text-align:center"><div style="font-size:12px;font-weight:900;color:#D63A2A;margin-bottom:9px">¿Vaciar carrito?</div><div style="display:flex;gap:8px"><button type="button" id="dc-qf36-vac-cancel" style="flex:1;border:0;border-radius:12px;background:#fff;color:#555;padding:10px;font-size:11px;font-weight:900">Cancelar</button><button type="button" id="dc-qf36-vac-ok" style="flex:1;border:0;border-radius:12px;background:#D63A2A;color:#fff;padding:10px;font-size:11px;font-weight:900">Sí, vaciar</button></div></div>'; else html+='<button type="button" id="dc-qf36-vaciar" style="width:100%;margin-top:8px;border:0;border-radius:14px;background:#f5f5f5;color:#D63A2A;padding:11px;font-size:12px;font-weight:900">Vaciar carrito</button>'; } return html+'</div>';}
  function empty(){return '<div data-dc-plaza-owner="qf36" style="padding:36px 20px;text-align:center"><div style="font-size:42px;margin-bottom:12px">🛒</div><div style="font-size:15px;font-weight:900;color:#111;margin-bottom:6px">Sin compras en proceso</div><div style="font-size:12px;color:#888;line-height:1.4">Cuando agregues productos de Plaza Online aparecerán aquí.</div></div>';}
  function render(t){
    if(rendering) return false; rendering=true; style(); if(t) currentTab=t; setTabs(currentTab); var el=listEl(); if(!el){rendering=false;return false;} var html='';
    if(currentTab==='anteriores'){ var h=history().filter(function(o){return o&&o.tipo==='plaza_orden';}); if(h.length) html=h.map(orderCard).join(''); else html='<div style="padding:36px 20px;text-align:center"><div style="font-size:38px;margin-bottom:12px">📦</div><div style="font-size:15px;font-weight:900;color:#111;margin-bottom:6px">Sin compras anteriores</div></div>'; }
    else { var o=activeOrder(), c=cart(); if(o)html+=orderCard(o); if(c.length)html+=cartCard(c); if(!html)html=empty(); }
    el.setAttribute('data-dc-plaza-owner',OWNER); el.innerHTML=html; rendering=false; return false;
  }
  function changeQty(key,d){var c=cart(),changed=false; d=parseInt(d||0,10); c=c.map(function(x,i){ if(keyOf(x,i)===String(key)){x=Object.assign({},x); x.cantidad=qty(x.cantidad)+d; x.qty=x.cantidad; changed=true;} return x;}).filter(function(x){return qty(x.cantidad)>0;}); if(changed)saveCart(c); setOpen(true); return render('proceso');}
  function delItem(key){saveCart(cart().filter(function(x,i){return keyOf(x,i)!==String(key);})); setOpen(true); return render('proceso');}
  function continuar(){var c=cart(); if(!c.length)return false; var m=meta(); wj(SEL_KEY,{id:'plaza_carrito_qf36_'+Date.now(),tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:m.fechaCreacion,items:c,total:total(c)}); setOpen(false); setVac(false); try{if(typeof window.dcPlazaRenderComprando==='function')window.dcPlazaRenderComprando();}catch(_){} if(typeof window.go==='function')window.go('v-plaza-comprando','right'); return false;}
  function finalizarCompra(){var sel=rj(SEL_KEY,null)||{}, items=norm(sel.items&&sel.items.length?sel.items:cart()); if(!items.length)return null; var o={id:'plaza_'+Date.now(),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:items,total:total(items),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:(localStorage.getItem('dcPlazaTipoPago')||'efectivo')}; saveOrder(o); clearCartOnly(); return o;}
  function seguimiento(){ if(typeof window.dcPlazaRenderSeguimiento==='function'){try{window.dcPlazaRenderSeguimiento();}catch(_){}} if(typeof window.go==='function')window.go('v-plaza-seguimiento','right'); return false; }

  function handler(e){var t=e.target; if(!t||!t.closest)return; var b;
    b=t.closest('#dc-plaza-confirmar-compra,#dc-plaza-confirmar-compra-final'); if(b){stop(e); var o=finalizarCompra(); var after=function(){seguimiento();}; try{ if(o&&typeof window.dcPlazaFinalFelizOficial==='function') return window.dcPlazaFinalFelizOficial(after),false; }catch(_){} after(); return false;}
    if(!t.closest('#v-mis-compras-plaza')) return;
    b=t.closest('#dc-plaza-tabs-old-disabled'); if(b){ return false; } /* QF43: tabs delegados exclusivamente a QF42 para evitar cruce Proceso/Anteriores */
    b=t.closest('.dc-qf36-qty'); if(b){stop(e); return changeQty(b.getAttribute('data-key'),b.getAttribute('data-d'));}
    b=t.closest('.dc-qf36-del'); if(b){stop(e); return delItem(b.getAttribute('data-key'));}
    if(t.closest('#dc-qf36-cart-toggle')){stop(e); setOpen(!isOpen()); setVac(false); return render('proceso');}
    if(t.closest('#dc-qf36-continuar')){stop(e); return continuar();}
    if(t.closest('#dc-qf36-vaciar')){stop(e); setVac(true); setOpen(true); return render('proceso');}
    if(t.closest('#dc-qf36-vac-ok')){stop(e); clearCartOnly(); return render('proceso');}
    if(t.closest('#dc-qf36-vac-cancel')){stop(e); setVac(false); setOpen(true); return render('proceso');}
    if(t.closest('#dc-qf36-seguimiento')){stop(e); return seguimiento();}
  }
  document.addEventListener('pointerdown',handler,true); document.addEventListener('click',handler,true); document.addEventListener('touchstart',handler,true);

  var oldGo=window.go;

  window.cargarMisComprasPlaza=function(){ window._misComprasPlazaTab='proceso'; return render('proceso');};
  window.cambiarTabMisComprasPlaza=function(t){setOpen(false);setVac(false);return render(t||'proceso');};
  window.dcPlazaAbrirDetalleCarrito=function(){setOpen(!isOpen());setVac(false);return render('proceso');};
  window.dcPlazaCerrarDetalleCarrito=function(){setOpen(false);setVac(false);return render('proceso');};
  window.dcPlazaEliminarItem=function(key){return delItem(key);};
  window.dcPlazaSetCantidadItem=function(key,d){return changeQty(key,d);};
  window.dcPlazaContinuarCompra=continuar;
  window.dcPlazaComprarDesdeMisCompras=continuar;
  window.dcPlazaVaciarCarrito=function(){ window._dcConfirmar('¿Deseas vaciar el carrito?', function(){ setVac(true);setOpen(true);render('proceso'); toast('🗑 Carrito vaciado'); }); return false;};
  window.dcPlazaQF36Auditoria=function(){return {version:'QF36 render dueño único',tab:currentTab,carrito:cart().length,orden:!!activeOrder(),owner:(listEl()&&listEl().getAttribute('data-dc-plaza-owner'))||null};};

  var target=document.getElementById('miscompras-plaza-lista');
  if(viewActive()) setTimeout(function(){render(window._misComprasPlazaTab||'proceso');},30);
})();


/* DC PLAZA QF39 — Guard temprano de confirmación
   Base segura QF36. No toca Food, Firebase, catálogo ni render visual.
   Objetivo único: Comprar en COMPRANDO -> Final Feliz -> Mis Compras / En proceso.
*/
(function(){
  if(window.__dcPlazaQF39FinalProcesoGuard) return;
  window.__dcPlazaQF39FinalProcesoGuard = true;

  var LOCK=false;
  var CART_KEY='dcPlazaCartV61';
  var LEGACY_CART_KEYS=['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart','dcPlazaCompraProceso'];
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var ORDER_KEYS=['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'];
  var HIST_KEYS=['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62'];
  var META_KEYS=['dcPlazaCartV61Meta','dcPlazaB2AMeta','dcPlazaCartMetaV63'];

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function rm(k){try{localStorage.removeItem(k);}catch(e){}}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function norm(a){
    if(a && !Array.isArray(a) && Array.isArray(a.items)) a=a.items;
    return (Array.isArray(a)?a:[]).filter(Boolean).map(function(x,i){x=x||{};return {
      id:x.id||x.productoId||x._id||x.key||('p_'+i), productoId:x.productoId||x.id||x._id||x.key||('p_'+i), key:x.key||x.id||x.productoId||x._id||('p_'+i),
      nombre:x.nombre||x.nombreProducto||x.titulo||'Producto', precio:num(x.precio||x.price||x.precioUnitario), cantidad:qty(x.cantidad||x.qty||1), qty:qty(x.cantidad||x.qty||1),
      foto:x.foto||x.img||x.imagen||x.fotoProducto||'', negocioId:x.negocioId||x.tiendaId||'', negocioNombre:x.negocioNombre||x.tiendaNombre||'Plaza Online'
    };});
  }
  function total(a){return norm(a).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function cart(){var c=norm(rj(CART_KEY,[])); if(c.length)return c; for(var i=0;i<LEGACY_CART_KEYS.length;i++){var x=norm(rj(LEGACY_CART_KEYS[i],[])); if(x.length)return x;} return [];}
  function selected(){var s=rj(SEL_KEY,null)||{}; var items=norm(s.items||[]); return items.length?items:cart();}
  function clearCart(){wj(CART_KEY,[]); LEGACY_CART_KEYS.forEach(function(k){ if(k==='dcPlazaCompraProceso') rm(k); else wj(k,[]); }); META_KEYS.forEach(rm); try{localStorage.setItem('dcPlazaQF36Open','0');localStorage.setItem('dcPlazaQF36VaciarOpen','0');localStorage.setItem('dcPlazaB2AOpen','0');}catch(e){}}
  function saveOrder(o){ORDER_KEYS.forEach(function(k){wj(k,o);}); wj(SEL_KEY,o); HIST_KEYS.forEach(function(k){var h=rj(k,[]); h=Array.isArray(h)?h:[]; h=h.filter(function(x){return x&&x.id!==o.id;}); h.unshift(o); wj(k,h.slice(0,30));});}
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){ } return false;}
  function isConfirmTarget(e){var t=e&&e.target; if(!t||!t.closest) return false; return !!t.closest('#dc-plaza-confirmar-compra,#dc-plaza-confirmar-compra-final,#dc-plaza-confirmar-compra-qf38');}
  function goProceso(){
    try{window._misComprasPlazaTab='proceso';localStorage.setItem('dcPlazaQF36Open','0');localStorage.setItem('dcPlazaQF36VaciarOpen','0');}catch(e){}
    try{if(typeof window.go==='function')window.go('v-mis-compras-plaza','right');}catch(e){}
    [40,120,300,650].forEach(function(ms){setTimeout(function(){try{if(typeof window.cambiarTabMisComprasPlaza==='function')window.cambiarTabMisComprasPlaza('proceso');else if(typeof window.cargarMisComprasPlaza==='function')window.cargarMisComprasPlaza();}catch(e){}},ms);});
    setTimeout(function(){LOCK=false;},800);
    return false;
  }
  function finalizar(e){
    if(!isConfirmTarget(e)) return;
    stop(e);
    if(LOCK) return false;
    LOCK=true;
    var items=selected();
    if(!items.length){LOCK=false;return false;}
    var o={id:'plaza_'+Date.now(),folio:'#PZ'+String(Date.now()).slice(-6),tipo:'plaza_orden',estado:'en_proceso',titulo:'Plaza Online',fecha:Date.now(),items:items,total:total(items),entrega:(localStorage.getItem('dcPlazaTipoEntrega')||'domicilio'),pago:(localStorage.getItem('dcPlazaTipoPago')||'efectivo')};
    saveOrder(o);
    clearCart();
    try{if(typeof window.dcPlazaFinalFelizOficial==='function')return window.dcPlazaFinalFelizOficial(goProceso),false;}catch(_e){}
    return goProceso();
  }

  window.addEventListener('pointerdown',finalizar,true);
  window.addEventListener('touchstart',function(e){if(isConfirmTarget(e))stop(e);},true);
  window.addEventListener('click',function(e){if(isConfirmTarget(e))return finalizar(e);},true);
  window.dcPlazaConfirmarCompra=finalizar;
  window.dcPlazaConfirmarCompraFinal=finalizar;
  window.dcPlazaIrMisComprasProcesoQF39=goProceso;
})();


/* QF42 sobre QF39.
   Único objetivo:
   - Mis Compras / En proceso muestra TODAS las órdenes plaza en_proceso.
   - Anteriores responde y muestra solo finalizadas/canceladas.
   - No toca Food, Firebase, catálogo, detalle ni Final Feliz.
*/
(function(){
  // LIMPIEZA 10: compra pendiente arriba + badge azul DC; no toca tabs/anteriores/final feliz.
  if(window.__dcPlazaQF42MultiplesProcesoTabsSeguro) return;
  window.__dcPlazaQF42MultiplesProcesoTabsSeguro = true;

  var OWNER='qf36';
  var CART_KEY='dcPlazaCartV61';
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var ORDER_KEYS=['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'];
  var HIST_KEYS=['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62'];
  var LEGACY_CART_KEYS=['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart','dcPlazaCompraProceso'];
  var TAB_KEY='dcPlazaQF42Tab';
  var OPEN_KEY='dcPlazaQF36Open';
  var rendering=false;

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function norm(a){
    if(a && !Array.isArray(a) && Array.isArray(a.items)) a=a.items;
    return (Array.isArray(a)?a:[]).filter(Boolean).map(function(x,i){
      x=Object.assign({},x||{});
      x.key=x.key||x.id||x.productoId||x._id||('p_'+i);
      x.id=x.id||x.productoId||x.key;
      x.nombre=x.nombre||x.nombreProducto||x.titulo||'Producto';
      x.precio=num(x.precio||x.price||x.precioUnitario);
      x.cantidad=qty(x.cantidad||x.qty||1);
      x.qty=x.cantidad;
      x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';
      return x;
    });
  }
  function total(items){return norm(items).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function idOf(o){return String((o&&(o.id||o.folio||o.fecha))||'');}
  function finalState(o){var e=String((o&&o.estado)||'').toLowerCase();return ['entregado','recogido','finalizado','cancelado','anterior','completado'].indexOf(e)>=0;}
  function validOrder(o){return !!(o&&o.tipo==='plaza_orden'&&norm(o.items).length);}
  function allOrders(){
    var out=[], seen={};
    function add(o){if(!validOrder(o))return;var id=idOf(o);if(seen[id])return;seen[id]=1;out.push(o);}
    ORDER_KEYS.forEach(function(k){add(rj(k,null));});
    var sel=rj(SEL_KEY,null); if(validOrder(sel)) add(sel);
    HIST_KEYS.forEach(function(k){var h=rj(k,[]); if(Array.isArray(h)) h.forEach(add);});
    out.sort(function(a,b){return (Number(b.fecha)||0)-(Number(a.fecha)||0);});
    return out;
  }
  function cart(){
    var c=norm(rj(CART_KEY,[])); if(c.length)return c;
    for(var i=0;i<LEGACY_CART_KEYS.length;i++){var x=norm(rj(LEGACY_CART_KEYS[i],[])); if(x.length && !(rj(LEGACY_CART_KEYS[i],null)||{}).tipo) return x;}
    return [];
  }
  function setTabs(tab){
    tab=tab||'proceso';
    window._misComprasPlazaTab=tab;
    wj(TAB_KEY,tab);
    var p=document.getElementById('miscompras-tab-proceso'), a=document.getElementById('miscompras-tab-anteriores'), sub=document.getElementById('miscompras-plaza-sub');
    if(sub) sub.textContent=tab==='anteriores'?'Compras anteriores':'Compras en proceso';
    if(p&&a){
      p.style.background=tab==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';
      a.style.background=tab==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';
      p.style.color=a.style.color='#fff';
    }
  }
  function rows(items){return norm(items).map(function(x){return '<div class="dc-qf36-row"><div style="min-width:0"><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div class="dc-qf36-muted">'+money(num(x.precio))+' c/u</div></div><div style="font-size:12px;font-weight:900;color:#111;white-space:nowrap;">'+money(num(x.precio)*qty(x.cantidad))+'</div></div>';}).join('');}
  function estadoPlaza(tipo,label){
    tipo=tipo||'proceso'; label=label||'En proceso';
    return '<div class="dc-estado-plaza dc-state dc-state-'+tipo+' dc-estado-'+tipo+'"><span class="dc-state-dot dc-estado-dot" aria-hidden="true"></span><span>'+esc(label)+'</span></div>';
  }
  function orderCard(o,anterior){
    var items=norm(o.items), t=Number(o.total)||total(items);
    var estado=anterior?estadoPlaza('finalizado','Finalizado'):estadoPlaza('proceso','En proceso');
    return '<div class="dc-qf36-card dc-plaza-card-pro" data-qf36-order="1" data-order-id="'+esc(idOf(o))+'"><div class="dc-plaza-card-head"><div class="dc-plaza-icon dc-plaza-icon-box">📦</div><div class="dc-plaza-card-main"><div class="dc-qf36-title">Plaza Online</div><div class="dc-qf36-muted" style="margin-top:3px">'+esc(o.folio||'Compra')+' · '+date(o.fecha)+' · '+items.length+' producto(s)</div>'+estado+'</div><div class="dc-plaza-card-total">'+money(t)+'</div></div><div style="margin-top:12px;padding-top:10px;border-top:.5px solid #edf0f2">'+rows(items)+'</div>'+(anterior?'':'<button type="button" class="dc-qf36-btn dc-qf42-seguimiento" data-order-id="'+esc(idOf(o))+'">Dar seguimiento →</button>')+'</div>';
  }
  function cartCard(c){
    c=norm(c); if(!c.length)return '';
    return '<div class="dc-qf36-card dc-plaza-card-pro dc-plaza-card-pending" data-qf36-cart="1"><div class="dc-plaza-card-head"><div class="dc-plaza-icon dc-plaza-icon-cart">🛒</div><div class="dc-plaza-card-main"><div class="dc-qf36-title">Continuar compra Plaza Online</div><div class="dc-qf36-muted" style="margin-top:3px">'+c.length+' producto(s) · '+money(total(c))+'</div>'+estadoPlaza('pendiente','Pendiente')+'</div><div class="dc-plaza-card-total">'+money(total(c))+'</div></div><button type="button" class="dc-qf36-btn" id="dc-qf36-continuar">Continuar compra →</button></div>';
  }
  function empty(tab){
    return '<div data-qf36-cart="1" style="padding:36px 20px;text-align:center"><div style="font-size:38px;margin-bottom:12px">📦</div><div style="font-size:15px;font-weight:900;color:#111;margin-bottom:6px">'+(tab==='anteriores'?'Sin compras anteriores':'Sin compras en proceso')+'</div></div>';
  }
  function render(tab){
    if(rendering)return false; rendering=true;
    tab = (tab === 'anteriores') ? 'anteriores' : 'proceso';
    window._misComprasPlazaTab = tab;
    try{localStorage.setItem(TAB_KEY, JSON.stringify(tab));}catch(_){}
    setTabs(tab);
    var el=document.getElementById('miscompras-plaza-lista');
    if(!el){rendering=false;return false;}
    var orders=allOrders();
    var html='';
    if(tab==='anteriores'){
      var anteriores=orders.filter(finalState);
      html=anteriores.length?anteriores.map(function(o){return orderCard(o,true);}).join(''):empty('anteriores');
    }else{
      var proceso=orders.filter(function(o){return !finalState(o);});
      html+=cartCard(cart());
      if(proceso.length) html+=proceso.map(function(o){return orderCard(o,false);}).join('');
      if(!html) html=empty('proceso');
    }
    el.setAttribute('data-dc-plaza-owner',OWNER);
    el.innerHTML=html;
    rendering=false;
    return false;
  }
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){}return false;}
  function onTab(e){
    var t=e.target; if(!t||!t.closest)return;
    var b=t.closest('#miscompras-tab-proceso,#miscompras-tab-anteriores');
    if(!b||!b.closest('#v-mis-compras-plaza'))return;
    stop(e);
    var nextTab = b.id==='miscompras-tab-anteriores' ? 'anteriores' : 'proceso';
    try{localStorage.setItem(OPEN_KEY,'0');localStorage.setItem('dcPlazaQF36VaciarOpen','0');}catch(_){}
    window._misComprasPlazaTab = nextTab;
    try{localStorage.setItem(TAB_KEY, JSON.stringify(nextTab));}catch(_){}
    setTabs(nextTab);
    render(nextTab);
    setTimeout(function(){
      var v=document.getElementById('v-mis-compras-plaza');
      if(v&&v.classList&&v.classList.contains('active')&&window._misComprasPlazaTab===nextTab) render(nextTab);
    },60);
    return false;
  }
  function onSeg(e){
    var t=e.target; if(!t||!t.closest)return;
    var b=t.closest('.dc-qf42-seguimiento'); if(!b)return;
    stop(e);
    var id=b.getAttribute('data-order-id');
    var o=allOrders().filter(function(x){return idOf(x)===id;})[0]||allOrders()[0];
    if(o){wj(SEL_KEY,o); ORDER_KEYS.forEach(function(k){wj(k,o);});}
    try{if(typeof window.dcPlazaRenderSeguimiento==='function')window.dcPlazaRenderSeguimiento(o);}catch(_){}
    try{if(typeof window.go==='function')window.go('v-plaza-seguimiento','right');}catch(_){}
    return false;
  }


  window.cargarMisComprasPlaza=function(){var t=window._misComprasPlazaTab||rj(TAB_KEY,'proceso'); return render(t==='anteriores'?'anteriores':'proceso');};
  window.cambiarTabMisComprasPlaza=function(t){t=(t==='anteriores')?'anteriores':'proceso'; window._misComprasPlazaTab=t; try{localStorage.setItem(TAB_KEY,JSON.stringify(t));}catch(_){} setTabs(t); return render(t);};
  window.dcPlazaRenderMisComprasQF42=render;

})();


/* ═══════════════════════════════════════════════════════
   PLAZA ONLINE — CIERRE TÉCNICO / NO OVERRIDE GUARD
   Objetivo único:
   - Congelar las funciones Plaza oficiales ya activas al final de V62 QF39/QF42.
   - Evitar que nuevos parches redefinan funciones Plaza por accidente.
   - No rediseña, no reconstruye, no toca Food/Servicios/Agenda/Chat/Perfil.

   Fuente oficial activa al momento del cierre:
   - Mis Compras / Tabs: QF42.
   - Confirmación compra: QF39 guard temprano.
   - Final Feliz: componente oficial expuesto en dcPlazaFinalFelizOficial.
   - Carrito/detalle: última función activa previa al cierre.
═══════════════════════════════════════════════════════ */
(function(){
  if (window.__dcPlazaCierreTecnicoNoOverrideGuard) return;
  window.__dcPlazaCierreTecnicoNoOverrideGuard = true;

  var manifest = {
    modulo: 'Plaza Online',
    archivoBase: 'V62_QF39_MULTIPLES_PROCESO_TABS_SEGURO',
    cierre: 'LIMPIEZA_6_TABS_ANTIGUOS_DESACTIVADOS_QF42_UNICO_20260617',
    regla: 'SI FUNCIONA NO SE TOCA',
    funcionesOficiales: {
      cargarMisComprasPlaza: 'QF42 — render oficial Mis Compras Plaza',
      cambiarTabMisComprasPlaza: 'QF42 — tabs oficiales proceso/anteriores; QF36 y listeners antiguos de tabs desactivados; QF42 único dueño',
      dcPlazaRenderMisComprasQF42: 'QF42 — render interno oficial',
      dcPlazaConfirmarCompra: 'QF39 — confirmar compra / orden / Final Feliz',
      dcPlazaConfirmarCompraFinal: 'QF39 — alias oficial confirmación final',
      dcPlazaFinalFelizOficial: 'QF39/QF42 — Final Feliz oficial reutilizado',
      plazaFinalFelizCarrito: 'Final Feliz oficial Plaza',
      plazaAgregarAlCarritoDetalle: 'Última función activa validada antes del cierre'
    },
    localStorageCanonico: {
      carrito: 'dcPlazaCartV61',
      tabMisCompras: 'dcPlazaQF42Tab',
      seleccionCompra: 'dcPlazaCompraSeleccionada',
      ordenesProceso: ['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'],
      historial: ['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62']
    },
    prohibido: [
      'No crear funciones Fix/V2/Nuevo/Real para Plaza.',
      'No redefinir funciones oficiales Plaza después de este cierre.',
      'Toda corrección futura debe editar la fuente oficial identificada, no montar override posterior.'
    ]
  };

  try { window.DC_PLAZA_OFICIAL = Object.freeze(manifest); }
  catch(e) { window.DC_PLAZA_OFICIAL = manifest; }

  function lockWindowFunction(name) {
    var fn = window[name];
    if (typeof fn !== 'function') return;
    try {
      Object.defineProperty(window, name, {
        configurable: false,
        enumerable: true,
        get: function(){ return fn; },
        set: function(nuevoValor){
          var msg = '[PLAZA NO-OVERRIDE] Bloqueada redefinición de ' + name + '. Edita la función oficial, no agregues parche posterior.';
          return true;
        }
      });
    } catch(e) {
    }
  }

  [
    'cargarMisComprasPlaza',
    'cambiarTabMisComprasPlaza',
    'dcPlazaRenderMisComprasQF42',
    'dcPlazaConfirmarCompra',
    'dcPlazaConfirmarCompraFinal',
    'dcPlazaFinalFelizOficial',
    'plazaFinalFelizCarrito',
    'plazaAgregarAlCarritoDetalle'
  ].forEach(lockWindowFunction);

  // Marca visible para auditoría en consola sin alterar UI.
  try {
  } catch(e) {}
})();


/* LIMPIEZA 18 — Anti-flash y anti-rebote final para Mis Compras Plaza.
   Base: LIMPIEZA_17. No toca catálogo, carrito Food, Final Feliz ni Firebase.
*/
(function(){
  if(window.__dcPlazaLimpieza18SinFlashSinRebote) return;
  window.__dcPlazaLimpieza18SinFlashSinRebote = true;

  var OPEN_CART='dcPlazaL14CartOpen';
  var VAC_KEY='dcPlazaL14VaciarOpen';
  var OPEN_ORDER='dcPlazaL14OrderOpen';
  var TAB_KEY='dcPlazaQF42Tab';
  var guardTimer=null;

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function setClosed(){try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}}
  function viewActive(){var v=document.getElementById('v-mis-compras-plaza');return !!(v&&v.classList&&v.classList.contains('active'));}
  function list(){return document.getElementById('miscompras-plaza-lista');}
  function isFinal(){var el=list();return !!(el&&el.querySelector('.dc-l14-card,.dc-l14-empty'));}
  function setSafeTab(t){t=t==='anteriores'?'anteriores':'proceso';window._misComprasPlazaTab=t;try{localStorage.setItem(TAB_KEY,JSON.stringify(t));}catch(_){}}
  function finalRender(closed){
    if(closed) setClosed();
    var el=list();
    if(el){el.setAttribute('data-l18-rendering','1');el.style.opacity='0';}
    try{ if(typeof window.dcPlazaLimpieza15Render==='function') window.dcPlazaLimpieza15Render(); else if(typeof window.cargarMisComprasPlaza==='function') window.cargarMisComprasPlaza(); }catch(_){ }
    setTimeout(function(){var e=list(); if(e){e.style.opacity='1';e.removeAttribute('data-l18-rendering');}},35);
  }
  function scheduleFinal(closed){
    clearTimeout(guardTimer);
    guardTimer=setTimeout(function(){ if(viewActive()) finalRender(!!closed); },20);
  }

  function addStyle(){
    if(document.getElementById('dc-plaza-l18-style')) return;
    var st=document.createElement('style');st.id='dc-plaza-l18-style';st.textContent='\
#v-mis-compras-plaza #miscompras-plaza-lista{transition:opacity .08s linear;}\
#v-mis-compras-plaza #miscompras-plaza-lista[data-l18-rendering="1"]{opacity:0!important;}\
#v-mis-compras-plaza #miscompras-plaza-lista:not(:has(.dc-l14-card)):not(:has(.dc-l14-empty)){opacity:0;}\
';document.head.appendChild(st);
  }

  function installObserver(){
    var el=list(); if(!el||el.__dcL18Obs) return;
    el.__dcL18Obs=true;
    new MutationObserver(function(){
      if(!viewActive()) return;
      // Si cualquier script viejo repinta formato no-final, repintar una sola vez al formato oficial.
      if(!isFinal()) scheduleFinal(true);
    }).observe(el,{childList:true,subtree:false});
  }

  var oldGo=window.go;
  window.go=function(id,dir){
    // Para Mis Compras y COMPRANDO, saltamos wrappers viejos de Plaza que repintaban formato anterior.
    if(id==='v-mis-compras-plaza' || id==='v-plaza-comprando'){
      try{
        if(id==='v-mis-compras-plaza'){
          setClosed();
          var el=list(); if(el){el.style.opacity='0';el.setAttribute('data-l18-rendering','1');}
        }
        var cur=document.querySelector('.view.active');
        if(!id||!document.getElementById(id)||(cur&&cur.id===id)){
          if(id==='v-mis-compras-plaza') scheduleFinal(true);
          return;
        }
        try{history.pushState({viewId:id},'','');}catch(_){ }
        if(typeof window._goCore==='function') window._goCore(id,dir||'right');
        else if(typeof _goCore==='function') _goCore(id,dir||'right');
        if(id==='v-mis-compras-plaza') setTimeout(function(){installObserver();scheduleFinal(true);},45);
        if(id==='v-plaza-comprando') setTimeout(function(){try{if(typeof window.dcPlazaRenderComprando==='function')window.dcPlazaRenderComprando();}catch(_){ }},45);
        return;
      }catch(e){try{return oldGo.apply(this,arguments);}catch(_e){}}
    }
    return (typeof oldGo==='function')?oldGo.apply(this,arguments):undefined;
  };

  // Tabs: captura final sobre botones; al cambiar tab siempre cierra y pinta una sola vez.
  document.addEventListener('click',function(e){
    var t=e.target; if(!t||!t.closest||!viewActive()) return;
    var b=t.closest('#miscompras-tab-proceso,#miscompras-tab-anteriores');
    if(!b) return;
    try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){ }
    setSafeTab(b.id==='miscompras-tab-anteriores'?'anteriores':'proceso');
    scheduleFinal(true);
    return false;
  },true);

  // Al entrar por data-onenter o por botones viejos, asegurar formato final sin flash.
  var oldCargar=window.cargarMisComprasPlaza;
  window.cargarMisComprasPlaza=function(){installObserver();scheduleFinal(true);return false;};
  var oldTab=window.cambiarTabMisComprasPlaza;
  window.cambiarTabMisComprasPlaza=function(t){setSafeTab(t);scheduleFinal(true);return false;};

  addStyle();
  setTimeout(function(){installObserver(); if(viewActive()) scheduleFinal(true);},60);
  setTimeout(function(){installObserver(); if(viewActive()) scheduleFinal(true);},220);
})();


(function(){
  if (window.__DC_PLAZA_NAV_L30__) return;
  window.__DC_PLAZA_NAV_L30__ = true;

  function isPlazaView(view){
    return view && /^(v-plaza|v-plaza-det|v-mis-compras-plaza|v-plaza-comprando)$/.test(view.id || '');
  }
  function goSafe(id, dir){
    try {
      if (typeof window.go === 'function') window.go(id, dir || 'right');
    } catch(e) { }
  }
  function openMisCompras(){
    window._misComprasPlazaTab = 'proceso';
    goSafe('v-mis-compras-plaza','right');
    setTimeout(function(){
      try { window.cargarMisComprasPlaza && window.cargarMisComprasPlaza(); } catch(e) {}
    }, 120);
  }

  document.addEventListener('click', function(ev){
    var item = ev.target && ev.target.closest ? ev.target.closest('.nav .ni') : null;
    if (!item) return;
    var view = item.closest('.view');
    if (!isPlazaView(view)) return;

    var txt = (item.innerText || item.textContent || '').toLowerCase();

    if (txt.indexOf('inicio') !== -1) {
      ev.preventDefault(); ev.stopPropagation();
      goSafe('v-home','left');
      return;
    }
    if (txt.indexOf('plaza') !== -1 && txt.indexOf('mis') === -1) {
      ev.preventDefault(); ev.stopPropagation();
      goSafe('v-plaza','left');
      return;
    }
    if (txt.indexOf('mis compras') !== -1) {
      ev.preventDefault(); ev.stopPropagation();
      openMisCompras();
      return;
    }
    if (txt.indexOf('alertas') !== -1) {
      ev.preventDefault(); ev.stopPropagation();
      goSafe('v-notificaciones','right');
      setTimeout(function(){
        try { window.renderNotificaciones && window.renderNotificaciones(); } catch(e) {}
      }, 180);
      return;
    }
    if (txt.indexOf('perfil') !== -1) {
      ev.preventDefault(); ev.stopPropagation();
      goSafe('v-mipanel','right');
      setTimeout(function(){
        try { window.cargarMiPerfil && window.cargarMiPerfil(); } catch(e) {}
      }, 180);
      return;
    }
  }, true);
})();


(function(){
  if(window.__DC_L33_NAV_AUDIT__) return;
  window.__DC_L33_NAV_AUDIT__=true;

  function activeId(){var v=document.querySelector('.view.active');return v&&v.id||'';}
  function txt(el){return ((el&&el.textContent)||'').trim().toLowerCase();}
  function setItem(item,ic,label,fn,color){
    if(!item) return;
    var i=item.querySelector('.ni-ic,.dcf-ni-ic');
    var l=item.querySelector('.ni-lb,.dcf-ni-lb');
    if(i) i.textContent=ic;
    if(l){l.textContent=label;l.style.color=color||'';l.classList.remove('dcf-on','si04');}
    item.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation();} fn&&fn(); return false;};
  }
  function goTo(id,dir,after){
    if(typeof window.go==='function') window.go(id,dir||'right');
    if(after) setTimeout(after,180);
  }
  function patchNav(root){
    var id=(root&&root.id)||activeId();
    var v=root||document.getElementById(id); if(!v) return;
    var items=v.querySelectorAll('.nav .ni,.dcf-nav .dcf-ni');
    if(!items||!items.length) return;

    items.forEach(function(item){
      var t=txt(item.querySelector('.ni-lb,.dcf-ni-lb'));

      // Plaza principal: no repetir Plaza Online; acción útil = Mis compras.
      if(id==='v-plaza' && t.indexOf('plaza')!==-1){
        setItem(item,'🛒','Mis compras',function(){goTo('v-mis-compras-plaza','right',function(){try{window.cargarMisComprasPlaza&&window.cargarMisComprasPlaza();}catch(_){}});},'var(--blue)');
      }

      // Mis compras: no repetir Mis compras; acción útil = volver a Plaza Online.
      if(id==='v-mis-compras-plaza' && (t.indexOf('mis compras')!==-1 || t.indexOf('compras')!==-1)){
        setItem(item,'🏪','Plaza Online',function(){goTo('v-plaza','left');},'var(--blue)');
      }

      // Food: no repetir Food; acción útil = Mis pedidos.
      if(id==='v-food' && t==='food'){
        setItem(item,'🛒','Mis pedidos',function(){goTo('v-mis-pedidos-food','right');},'');
      }

      // Mis pedidos Food: no repetir Pedidos; acción útil = Alertas.
      if(id==='v-mis-pedidos-food' && (t.indexOf('pedido')!==-1 || t.indexOf('mis pedido')!==-1)){
        setItem(item,'🔔','Alertas',function(){goTo('v-notificaciones','right',function(){try{window.renderNotificaciones&&window.renderNotificaciones();}catch(_){}});},'');
      }

      // Servicios: está correcto; Mis solicitudes es acción útil.
      // Mis solicitudes: no repetir Solicitudes; acción útil = Servicios.
      if(id==='v-mis-reportes' && (t.indexOf('solicitud')!==-1 || t.indexOf('mis solicitudes')!==-1)){
        setItem(item,'🔧','Servicios',function(){goTo('v-servicios','left');},'var(--green)');
      }

      // Favoritos: no repetir Favoritos; acción útil = Servicios.
      if(id==='v-favoritos' && t.indexOf('favoritos')!==-1){
        setItem(item,'🔧','Servicios',function(){goTo('v-servicios','left');},'');
      }

      // Notificaciones: no repetir Alertas cuando exista barra.
      if(id==='v-notificaciones' && t.indexOf('alertas')!==-1){
        setItem(item,'🏠','Inicio',function(){goTo('v-home','left');},'');
      }
    });
  }

  function patchAll(){
    ['v-plaza','v-mis-compras-plaza','v-food','v-mis-pedidos-food','v-servicios','v-mis-reportes','v-favoritos','v-notificaciones'].forEach(function(id){patchNav(document.getElementById(id));});
    patchFavBack();
  }

  // Favoritos → Proveedor: evitar ciclo Favoritos/Proveedor.
  // El detalle conserva el regreso visual a Favoritos, pero usa history.back() para NO meter otra entrada al historial.
  function patchFavBack(){
    var fav=document.getElementById('v-favoritos');
    if(fav){
      var fb=fav.querySelector('.btn-back');
      if(fb){
        fb.classList.remove('btn-back');
        fb.onclick=function(ev){
          if(ev){ev.preventDefault();ev.stopPropagation();}
          var prev=window.__dcL33LastBeforeFav||'v-home';
          // Si el historial quedó contaminado con proveedor, sal directo a Home para romper el ciclo.
          if(prev==='v-serv-det') prev='v-home';
          goTo(prev||'v-home','left');
          return false;
        };
      }
    }
    var det=document.getElementById('v-serv-det');
    var b=det&&det.querySelector('#det-header button');
    if(b && window.__dcL33ProviderFromFav){
      b.onclick=function(ev){
        if(ev){ev.preventDefault();ev.stopPropagation();}
        try{history.back();}catch(_){goTo('v-favoritos','left',function(){try{window.cargarFavoritos&&window.cargarFavoritos();}catch(e){}});}
        setTimeout(function(){try{window.cargarFavoritos&&window.cargarFavoritos();}catch(e){}},220);
        return false;
      };
    }
  }

  // Recordar origen limpio antes de Favoritos para que su flecha no regrese al proveedor.
  var oldGo=window.go;
  if(typeof oldGo==='function' && !oldGo.__dcL33NavAudit){
    var wrapped=function(view,dir){
      var cur=activeId();
      if(view==='v-favoritos' && cur && cur!=='v-favoritos') window.__dcL33LastBeforeFav=cur;
      var r=oldGo.apply(this,arguments);
      setTimeout(patchAll,35);
      setTimeout(patchAll,180);
      return r;
    };
    wrapped.__dcL33NavAudit=true;
    window.go=wrapped;
  }

  // Marcar si un proveedor fue abierto desde Favoritos.
  var oldAbrir=window.abrirDetalleProveedor;
  if(typeof oldAbrir==='function' && !oldAbrir.__dcL33FavWrap){
    var abrir=function(p){
      window.__dcL33ProviderFromFav = activeId()==='v-favoritos';
      var r=oldAbrir.apply(this,arguments);
      setTimeout(patchFavBack,90);
      setTimeout(patchFavBack,260);
      return r;
    };
    abrir.__dcL33FavWrap=true;
    window.abrirDetalleProveedor=abrir;
  }

  document.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest&&ev.target.closest('#v-serv-det #det-header button');
    if(b && window.__dcL33ProviderFromFav){
      ev.preventDefault();ev.stopPropagation(); if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
      try{history.back();}catch(_){goTo('v-favoritos','left');}
      setTimeout(function(){try{window.cargarFavoritos&&window.cargarFavoritos();}catch(e){}},220);
      return false;
    }
  },true);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patchAll); else setTimeout(patchAll,0);
  setTimeout(patchAll,250);
  var mo=new MutationObserver(function(){clearTimeout(window.__dcL33PatchTimer);window.__dcL33PatchTimer=setTimeout(patchAll,80);});
  if(document.body) mo.observe(document.body,{childList:true,subtree:true});
})();


(function(){
  if (window.__DC_UNIVERSAL_BACK_STACK_V34) return;
  window.__DC_UNIVERSAL_BACK_STACK_V34 = true;

  var stack = window.__dcNavStack = window.__dcNavStack || [];
  var suppress = false;
  var oldGo = window.go;

  function activeViewId(){
    var v = document.querySelector('.view.active');
    return v && v.id ? v.id : '';
  }

  function viewExists(id){
    return !!(id && document.getElementById(id));
  }

  function pushView(id){
    if (!id || !viewExists(id)) return;
    if (stack[stack.length - 1] === id) return;
    stack.push(id);
    if (stack.length > 30) stack.splice(0, stack.length - 30);
  }

  window.go = function(id, dir){
    var cur = activeViewId();
    if (!suppress && id && cur && id !== cur) pushView(cur);
    if (typeof oldGo === 'function') return oldGo.apply(this, arguments);
  };

  window.dcBack = function(fallback){
    var cur = activeViewId();
    var target = '';

    while (stack.length) {
      var candidate = stack.pop();
      if (candidate && candidate !== cur && viewExists(candidate)) {
        target = candidate;
        break;
      }
    }

    if (!target) target = fallback || 'v-home';

    suppress = true;
    try {
      if (typeof window.go === 'function') window.go(target, 'left');
    } finally {
      setTimeout(function(){ suppress = false; }, 0);
    }
    return false;
  };

  // Intercepta flechas globales para evitar ciclos por onclick fijos antiguos.
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('.btn-back') : null;
    if (!btn) return;

    // No tocar shells internos que tienen navegación propia aislada.
    if (btn.closest && (btn.closest('#vr-shell') || btn.closest('#vn-shell'))) return;

    // Si no hay historial, dejamos que el onclick original actúe.
    if (!stack.length) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.dcBack('v-home');
  }, true);
})();


/*
  Limpieza 2 — Plaza Online Cliente.
  Alcance:
  - Congela la fuente oficial de Plaza Online cliente: cargarPlaza, listado, filtro,
    abrir comercio, cargar productos y render de productos.
  - No toca Mis Compras Plaza, Comprando, Seguimiento, Final Feliz, Food,
    Restaurante, Servicios, Chat, Agenda ni Perfil.
  - Este bloque debe vivir al final para capturar la versión activa validada
    después de todos los parches históricos.
*/
(function(){
  if (window.__dcLimpieza2PlazaOnlineClienteOficial) return;
  window.__dcLimpieza2PlazaOnlineClienteOficial = true;

  var oficiales = {
    dcEsComercioPlaza: window.dcEsComercioPlaza,
    _plazaFiltrarSel: window._plazaFiltrarSel,
    _plazaRenderLista: window._plazaRenderLista,
    cargarPlaza: window.cargarPlaza,
    plazaAbrirComercio: window.plazaAbrirComercio,
    plazaCargarProductos: window.plazaCargarProductos,
    _plazaSetProdFiltro: window._plazaSetProdFiltro,
    _plazaRenderProductos: window._plazaRenderProductos
  };

  function congelar(nombre, fn){
    if (typeof fn !== 'function') return false;
    try {
      Object.defineProperty(window, nombre, {
        value: fn,
        writable: false,
        configurable: false
      });
      return true;
    } catch(e) {
      try { window[nombre] = fn; return true; } catch(_) { return false; }
    }
  }

  var estado = {};
  Object.keys(oficiales).forEach(function(nombre){
    estado[nombre] = congelar(nombre, oficiales[nombre]) ? 'oficial_congelada' : 'no_disponible';
  });

  window.DC_PLAZA_ONLINE_CLIENTE_OFICIAL = Object.freeze({
    modulo: 'Plaza Online Cliente',
    limpieza: 'LIMPIEZA_2_PLAZA_ONLINE_CLIENTE_OFICIAL',
    regla: 'Una sola fuente oficial para listado/filtro/detalle/productos',
    noToca: ['Mis Compras', 'Comprando', 'Seguimiento', 'Final Feliz', 'Food', 'Restaurante', 'Servicios'],
    funciones: Object.freeze(estado)
  });

  document.addEventListener('DOMContentLoaded', function(){
    try {
      var sel = document.getElementById('plaza-cat-select');
      if (sel && !sel.__dcPlazaFiltroOficial) {
        sel.__dcPlazaFiltroOficial = true;
        sel.addEventListener('change', function(){
          if (typeof window._plazaFiltrarSel === 'function') {
            window._plazaFiltrarSel(sel.value || 'todos');
          }
        });
      }
    } catch(e) {}
  });
})();


/* ═══════════════════════════════════════════════════════
   LIMPIEZA 3 — MIS COMPRAS PLAZA OFICIAL VALIDADO
   Objetivo único:
   - Dejar como fuente oficial Mis Compras Plaza el render QF42 ya activo.
   - No crear otro render, no reescribir tabs, no tocar Plaza Online, Food, Restaurante ni Negocio.
   - Este bloque es candado/auditoría: verifica que las funciones oficiales existan y registra manifiesto.
═══════════════════════════════════════════════════════ */
(function(){
  if(window.__DC_LIMPIEZA_3_MIS_COMPRAS_OFICIAL__) return;
  window.__DC_LIMPIEZA_3_MIS_COMPRAS_OFICIAL__ = true;

  var ok = (typeof window.cargarMisComprasPlaza === 'function')
        && (typeof window.cambiarTabMisComprasPlaza === 'function')
        && (typeof window.dcPlazaRenderMisComprasQF42 === 'function');

  window.DC_MIS_COMPRAS_PLAZA_OFICIAL = Object.freeze ? Object.freeze({
    modulo: 'Mis Compras Plaza',
    limpieza: 'PUNTO_3',
    fuenteOficial: 'QF42',
    estado: ok ? 'VALIDADO' : 'REVISAR',
    funcionesOficiales: [
      'cargarMisComprasPlaza',
      'cambiarTabMisComprasPlaza',
      'dcPlazaRenderMisComprasQF42'
    ],
    localStorageCanonico: {
      tab: 'dcPlazaQF42Tab',
      carrito: 'dcPlazaCartV61',
      seleccionCompra: 'dcPlazaCompraSeleccionada',
      ordenesProceso: ['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'],
      historial: ['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62']
    },
    prohibido: [
      'No agregar otra función de render para Mis Compras Plaza.',
      'No montar listeners nuevos de tabs si QF42 ya controla Proceso/Anteriores.',
      'No tocar Food, Restaurante, Negocio ni Plaza Online cliente en este punto.'
    ]
  }) : {modulo:'Mis Compras Plaza', limpieza:'PUNTO_3', fuenteOficial:'QF42', estado: ok ? 'VALIDADO' : 'REVISAR'};
})();



/* LIMPIEZA 8A — FOOD PEDIDOS / SEGUIMIENTO OFICIAL
   Alcance: solo congela referencias oficiales ya existentes del flujo cliente Food.
   No modifica lógica interna, no cambia Firestore, no toca Restaurante panel, Plaza, Mis Compras ni go().
*/
(function(){
  if (window.__DC_FOOD_PEDIDOS_OFICIAL__) return;
  window.__DC_FOOD_PEDIDOS_OFICIAL__ = true;

  var oficiales = [
    'dcFood_renderCarrito',
    'dcFood_iniciarConfirmacion',
    'dcFood_confirmarTransferencia',
    'dcFood_confirmarPedido',
    'dcFood_iniciarTracking',
    '_renderTracking',
    'dcFood_cancelarPedido',
    'dcFood_cargarMisPedidos',
    '_renderMisPedidos',
    'dcFood_verTracking',
    'dcFood_seguirComprando'
  ];

  window.__DC_FOOD_PEDIDOS_OFICIALES__ = window.__DC_FOOD_PEDIDOS_OFICIALES__ || {};

  oficiales.forEach(function(nombre){
    var fn = window[nombre];
    if (typeof fn !== 'function') return;
    window.__DC_FOOD_PEDIDOS_OFICIALES__[nombre] = fn;
    try {
      Object.defineProperty(window, nombre, {
        configurable: false,
        enumerable: true,
        get: function(){ return window.__DC_FOOD_PEDIDOS_OFICIALES__[nombre]; },
        set: function(nueva){
          if (typeof nueva === 'function') {
            console.warn('[DC Limpieza 8A] Intento bloqueado de sobrescribir Food Pedidos:', nombre);
          }
        }
      });
    } catch(e) {}
  });
})();


/* LIMPIEZA 19 — Acordeón único por pantalla + regreso inmediato real.
   Base: LIMPIEZA_16 limpiando scripts conflictivos L13/L16/L5 para quitar rebote y flash.
   Alcance: Mis Compras Plaza + flecha de COMPRANDO. No toca Food, catálogo, detalle, Final Feliz ni Firebase.
*/
(function(){
  if(window.__dcPlazaLimpieza17AccordionFinalClean) return;
  window.__dcPlazaLimpieza17AccordionFinalClean = true;

  var CART_KEY='dcPlazaCartV61';
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var ORDER_KEYS=['dcPlazaOrdenPlazaEnProceso','dcPlazaCompraPlazaActiva','dcPlazaOrdenActivaV62'];
  var HIST_KEYS=['dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62'];
  var LEGACY_CART_KEYS=['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart','dcPlazaCompraProceso'];
  var OPEN_CART='dcPlazaL14CartOpen';
  var VAC_KEY='dcPlazaL14VaciarOpen';
  var OPEN_ORDER='dcPlazaL14OrderOpen';
  var TAB_KEY='dcPlazaQF42Tab';
  var rendering=false;

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function rm(k){try{localStorage.removeItem(k);}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.\-]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){
    if(a && !Array.isArray(a) && Array.isArray(a.items)) a=a.items;
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
  function date(ts){var d=new Date(Number(ts)||Date.now());return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function idOf(o){return String((o&&(o.id||o.folio||o.fecha))||'');}
  function finalState(o){var e=String((o&&o.estado)||'').toLowerCase();return ['entregado','recogido','finalizado','cancelado','anterior','completado'].indexOf(e)>=0;}
  function validOrder(o){return !!(o&&o.tipo==='plaza_orden'&&norm(o.items).length);}

  function cart(){
    var c=norm(rj(CART_KEY,[])); if(c.length)return c;
    for(var i=0;i<LEGACY_CART_KEYS.length;i++){
      var raw=rj(LEGACY_CART_KEYS[i],[]), x=norm(raw);
      if(x.length && !(raw&&raw.tipo==='plaza_orden')) return x;
    }
    return [];
  }
  function saveCart(c){
    c=norm(c);
    wj(CART_KEY,c); wj('dcPlazaCarrito',c); wj('dcPlazaCarritoEnProceso',c);
    if(c.length){wj('dcPlazaCompraProceso',{id:'plaza_carrito_l14',tipo:'plaza_carrito',estado:'proceso',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});}else{rm('dcPlazaCompraProceso');}
    return c;
  }
  function clearCart(){
    wj(CART_KEY,[]); ['dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart'].forEach(function(k){wj(k,[]);});
    rm('dcPlazaCompraProceso'); collapseAll();
  }
  function orders(){
    var out=[],seen={};
    function add(o){if(!validOrder(o))return;var id=idOf(o);if(seen[id])return;seen[id]=1;out.push(o);}
    ORDER_KEYS.forEach(function(k){add(rj(k,null));});
    var sel=rj(SEL_KEY,null); if(validOrder(sel)) add(sel);
    HIST_KEYS.forEach(function(k){var h=rj(k,[]); if(Array.isArray(h)) h.forEach(add);});
    out.sort(function(a,b){return (Number(b.fecha)||0)-(Number(a.fecha)||0);});
    return out;
  }

  function state(tipo,label){return '<div class="dc-l14-state dc-state dc-state-'+tipo+' dc-l14-'+tipo+'"><span class="dc-state-dot"></span>'+esc(label)+'</div>';}
  function rowsRead(items){
    return norm(items).map(function(x){return '<div class="dc-l14-row"><div style="min-width:0"><div class="dc-l14-prod">'+qty(x.cantidad)+'× '+esc(x.nombre)+'</div><div class="dc-l14-muted">'+money(num(x.precio))+' c/u</div></div><b>'+money(num(x.precio)*qty(x.cantidad))+'</b></div>';}).join('');
  }
  function cartRows(items){
    return norm(items).map(function(x,i){
      var k=esc(keyOf(x,i)),q=qty(x.cantidad),p=num(x.precio);
      return '<div class="dc-l14-cart-row"><div class="dc-l14-thumb">'+(x.foto?'<img src="'+esc(x.foto)+'">':'🛒')+'</div><div style="flex:1;min-width:0"><div class="dc-l14-prod">'+esc(x.nombre)+'</div><div class="dc-l14-muted">'+money(p)+' × '+q+' = '+money(p*q)+'</div></div><div class="dc-l14-controls"><button type="button" data-l14-qty="-1" data-key="'+k+'">−</button><b>'+q+'</b><button type="button" data-l14-qty="1" data-key="'+k+'">+</button><button type="button" class="del" data-l14-del="1" data-key="'+k+'">×</button></div></div>';
    }).join('');
  }
  function cartCard(c){
    c=norm(c); if(!c.length) return '';
    var open=localStorage.getItem(OPEN_CART)==='1', vac=localStorage.getItem(VAC_KEY)==='1', t=total(c);
    var html='<div class="dc-l14-card dc-l14-pending" data-l14-card="cart"><div class="dc-l14-head" data-l14-toggle-cart="1"><div class="dc-l14-icon">🛒</div><div class="dc-l14-main"><div class="dc-l14-title">Continuar compra Plaza Online</div><div class="dc-l14-muted">'+c.length+' producto(s) · '+money(t)+'</div>'+state('pendiente','Pendiente')+'</div><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'⌃':'⌄')+'</div></div>';
    if(open){
      html+='<div class="dc-l14-body">'+cartRows(c)+'<button type="button" class="dc-l14-btn" data-l14-continuar="1">Continuar compra →</button>';
      if(vac) html+='<div class="dc-l14-confirm"><b>¿Vaciar carrito?</b><div><button type="button" data-l14-vac-cancel="1">Cancelar</button><button type="button" class="danger" data-l14-vac-ok="1">Sí, vaciar</button></div></div>';
      else html+='<button type="button" class="dc-l14-btn secondary" data-l14-vaciar="1">Vaciar carrito</button>';
      html+='</div>';
    }
    return html+'</div>';
  }
  function orderCard(o,anterior){
    var items=norm(o.items), t=Number(o.total)||total(items), id=idOf(o), open=localStorage.getItem(OPEN_ORDER)===id;
    var estado=anterior?(String(o.estado).toLowerCase()==='cancelado'?state('cancelado','Cancelado'):state('finalizado','Finalizado')):state('proceso','En proceso');
    var html='<div class="dc-l14-card" data-l14-card="order" data-l14-order="'+esc(id)+'"><div class="dc-l14-head" data-l14-toggle-order="'+esc(id)+'"><div class="dc-l14-icon box">📦</div><div class="dc-l14-main"><div class="dc-l14-title">Plaza Online</div><div class="dc-l14-muted">'+esc(o.folio||'Compra')+' · '+date(o.fecha)+' · '+items.length+' producto(s)</div>'+estado+'</div><div class="dc-l14-total">'+money(t)+'</div><div class="dc-l14-arrow">'+(open?'⌃':'⌄')+'</div></div>';
    if(open){html+='<div class="dc-l14-body">'+rowsRead(items)+(anterior?'':'<button type="button" class="dc-l14-btn" data-l14-seguimiento="'+esc(id)+'">Dar seguimiento →</button>')+'</div>';}
    return html+'</div>';
  }
  function setTabs(t){
    t=t==='anteriores'?'anteriores':'proceso';
    window._misComprasPlazaTab=t; try{localStorage.setItem(TAB_KEY,JSON.stringify(t));}catch(_){}
    var bp=document.getElementById('miscompras-tab-proceso'), ba=document.getElementById('miscompras-tab-anteriores'), sub=document.getElementById('miscompras-plaza-sub');
    if(sub) sub.textContent=t==='anteriores'?'Compras anteriores':'Compras en proceso';
    if(bp&&ba){bp.style.background=t==='proceso'?'var(--blue)':'rgba(255,255,255,.18)';ba.style.background=t==='anteriores'?'var(--blue)':'rgba(255,255,255,.18)';bp.style.color=ba.style.color='#fff';}
  }
  function currentTab(){
    return (window._misComprasPlazaTab==='anteriores'||rj(TAB_KEY,'proceso')==='anteriores')?'anteriores':'proceso';
  }
  function render(force){
    if(rendering)return false;
    var v=document.getElementById('v-mis-compras-plaza'), el=document.getElementById('miscompras-plaza-lista');
    if(!v||!el||!v.classList.contains('active'))return false;
    var tab=currentTab(), html='', os=orders(); setTabs(tab);
    if(tab==='anteriores'){
      var ant=os.filter(finalState);
      html=ant.length?ant.map(function(o){return orderCard(o,true);}).join(''):'<div class="dc-l14-empty"><div>📦</div><b>Sin compras anteriores</b></div>';
    }else{
      html+=cartCard(cart());
      os.filter(function(o){return !finalState(o);}).forEach(function(o){html+=orderCard(o,false);});
      if(!html)html='<div class="dc-l14-empty"><div>🛒</div><b>Sin compras en proceso</b></div>';
    }
    var sig=String(tab+'|'+html.length+'|'+localStorage.getItem(OPEN_CART)+'|'+localStorage.getItem(OPEN_ORDER)+'|'+localStorage.getItem(VAC_KEY));
    if(!force && el.getAttribute('data-l14-sig')===sig && el.querySelector('.dc-l14-card,.dc-l14-empty')) return true;
    rendering=true; el.setAttribute('data-l14-sig',sig); el.innerHTML=html; rendering=false; return true;
  }
  function collapseAll(){
    try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}
  }
  function stop(e){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){} return false;}
  function changeQty(key,d){var c=cart(),changed=false;d=parseInt(d||0,10);c=c.map(function(x,i){if(keyOf(x,i)===String(key)){x=Object.assign({},x);x.cantidad=qty(x.cantidad)+d;x.qty=x.cantidad;changed=true;}return x;}).filter(function(x){return qty(x.cantidad)>0;});if(changed)saveCart(c);localStorage.setItem(OPEN_CART,'1');render(true);}
  function delItem(key){saveCart(cart().filter(function(x,i){return keyOf(x,i)!==String(key);}));localStorage.setItem(OPEN_CART,'1');render(true);}
  function goComprando(){
    var c=cart(); if(!c.length)return false;
    wj(SEL_KEY,{id:'plaza_carrito_l14_'+Date.now(),tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});
    collapseAll();
    try{if(typeof window.dcPlazaRenderComprando==='function')window.dcPlazaRenderComprando();}catch(_){ }
    if(typeof window.go==='function')window.go('v-plaza-comprando','right');
    setTimeout(fixComprandoBack,120);
    return false;
  }
  function seguimiento(id){collapseAll();try{if(typeof window.go==='function')window.go('v-plaza-seguimiento','right');}catch(_){}return false;}

  function handler(e){
    var t=e.target; if(!t||!t.closest)return;
    var mis=t.closest('#v-mis-compras-plaza');
    if(mis){
      var b=t.closest('#miscompras-tab-proceso'); if(b){stop(e);collapseAll();setTabs('proceso');render(true);return false;}
      b=t.closest('#miscompras-tab-anteriores'); if(b){stop(e);collapseAll();setTabs('anteriores');render(true);return false;}
      b=t.closest('[data-l14-toggle-cart]'); if(b){
        stop(e);
        var willOpen = localStorage.getItem(OPEN_CART)!=='1';
        localStorage.setItem(OPEN_CART, willOpen ? '1' : '0');
        localStorage.setItem(VAC_KEY,'0');
        if(willOpen) localStorage.setItem(OPEN_ORDER,'');
        render(true);
        return false;
      }
      b=t.closest('[data-l14-toggle-order]'); if(b){
        stop(e);
        var id=b.getAttribute('data-l14-toggle-order');
        var willOpenOrder = localStorage.getItem(OPEN_ORDER)!==id;
        localStorage.setItem(OPEN_ORDER, willOpenOrder ? id : '');
        if(willOpenOrder){ localStorage.setItem(OPEN_CART,'0'); localStorage.setItem(VAC_KEY,'0'); }
        render(true);
        return false;
      }
      b=t.closest('[data-l14-qty]'); if(b){stop(e);changeQty(b.getAttribute('data-key'),b.getAttribute('data-l14-qty'));return false;}
      b=t.closest('[data-l14-del]'); if(b){stop(e);delItem(b.getAttribute('data-key'));return false;}
      if(t.closest('[data-l14-vaciar]')){stop(e);localStorage.setItem(VAC_KEY,'1');localStorage.setItem(OPEN_CART,'1');render(true);return false;}
      if(t.closest('[data-l14-vac-cancel]')){stop(e);localStorage.setItem(VAC_KEY,'0');render(true);return false;}
      if(t.closest('[data-l14-vac-ok]')){stop(e);clearCart();toast('🗑 Carrito vaciado');render(true);return false;}
      if(t.closest('[data-l14-continuar]')){stop(e);return goComprando();}
      b=t.closest('[data-l14-seguimiento]'); if(b){stop(e);return seguimiento(b.getAttribute('data-l14-seguimiento'));}
    }
    var bx=t.closest('#v-plaza-comprando .btn-back-l14');
    if(bx){stop(e);try{history.back();}catch(_){if(typeof window.go==='function')window.go('v-mis-compras-plaza','left');}return false;}
  }

  function fixComprandoBack(){
    var b=document.querySelector('#v-plaza-comprando .btn-back');
    if(b){b.classList.remove('btn-back');b.classList.add('btn-back-l14');b.removeAttribute('onclick');b.setAttribute('type','button');b.setAttribute('aria-label','Regresar');}
  }

  function addStyle(){
    if(document.getElementById('dc-plaza-l14-style'))return;
    var s=document.createElement('style');s.id='dc-plaza-l14-style';s.textContent='\
#v-mis-compras-plaza #miscompras-plaza-lista .dc-l14-card{background:#fff;border:.5px solid #dfe5eb;border-radius:18px;padding:14px;margin:14px 10px;box-shadow:0 9px 24px rgba(10,48,85,.075);font-family:inherit;}\
#v-mis-compras-plaza #miscompras-plaza-lista .dc-l14-pending{border:.8px solid rgba(26,122,181,.32);box-shadow:0 10px 24px rgba(26,122,181,.10);}#v-mis-compras-plaza #miscompras-plaza-lista .dc-l14-pending .dc-l14-icon{background:rgba(31,194,106,.12);color:#0b8d44;}\
.dc-l14-head{display:flex;align-items:flex-start;gap:10px;cursor:pointer;}.dc-l14-icon{width:42px;height:42px;border-radius:13px;background:rgba(26,122,181,.10);display:flex;align-items:center;justify-content:center;flex:0 0 42px;font-size:21px}.dc-l14-icon.box{background:rgba(31,194,106,.10);}.dc-l14-main{flex:1;min-width:0}.dc-l14-title{font-size:14px;font-weight:900;color:#111;line-height:1.15}.dc-l14-muted{font-size:11px;color:#666;font-weight:700;line-height:1.35}.dc-l14-total{font-size:17px;font-weight:900;color:var(--blue);white-space:nowrap}.dc-l14-arrow{font-size:16px;font-weight:900;color:#8aa1b4;margin-left:2px}.dc-l14-body{margin-top:12px;padding-top:10px;border-top:.5px solid #edf0f2}.dc-l14-state{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;font-weight:900}.dc-l14-state span{width:10px;height:10px;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.14)}.dc-l14-pendiente{color:#1A7AB5}.dc-l14-pendiente span{background:#1A7AB5}.dc-l14-proceso{color:#0b8d44}.dc-l14-proceso span{background:#1FC26A}.dc-l14-finalizado{color:#777}.dc-l14-finalizado span{background:#EAEAEA;border:.5px solid #cfcfcf}.dc-l14-cancelado{color:#D63A2A}.dc-l14-cancelado span{background:#D63A2A}.dc-l14-prod{font-size:12px;font-weight:900;color:#111;line-height:1.18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dc-l14-row,.dc-l14-cart-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:.5px solid #edf0f2}.dc-l14-row:last-child,.dc-l14-cart-row:last-child{border-bottom:0}.dc-l14-thumb{width:42px;height:42px;border-radius:12px;background:#f3f6f8;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}.dc-l14-thumb img{width:100%;height:100%;object-fit:cover}.dc-l14-controls{display:flex;align-items:center;gap:5px;flex-shrink:0}.dc-l14-controls button{width:28px;height:28px;border:0;border-radius:10px;background:#eef6ff;color:var(--blue);font-size:14px;font-weight:900}.dc-l14-controls button.del{background:#fff0f0;color:#D63A2A}.dc-l14-btn{width:100%;margin-top:12px;border:0;border-radius:14px;background:var(--blue);color:#fff;padding:13px;font-size:12px;font-weight:900;box-shadow:0 9px 18px rgba(26,122,181,.24);font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .08s ease,box-shadow .08s ease,opacity .08s ease}.dc-l14-btn:active{transform:translateY(2px) scale(.985);box-shadow:0 4px 10px rgba(26,122,181,.20);opacity:.88}.dc-l14-btn.secondary{background:#f5f5f5;color:#D63A2A;box-shadow:none;margin-top:8px}.dc-l14-confirm{margin-top:10px;background:#FDECEA;border-radius:14px;padding:12px;text-align:center}.dc-l14-confirm b{display:block;font-size:12px;font-weight:900;color:#D63A2A;margin-bottom:9px}.dc-l14-confirm div{display:flex;gap:8px}.dc-l14-confirm button{flex:1;border:0;border-radius:12px;background:#fff;color:#555;padding:10px;font-size:11px;font-weight:900}.dc-l14-confirm button.danger{background:#D63A2A;color:#fff}.dc-l14-empty{padding:36px 20px;text-align:center}.dc-l14-empty div{font-size:38px;margin-bottom:12px}.dc-l14-empty b{font-size:15px;color:#111}\
#v-plaza-comprando .btn-back-l14{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.14);color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:inherit;cursor:pointer;}\
';document.head.appendChild(s);
  }

  function boot(){addStyle();fixComprandoBack();render(true);}
  document.addEventListener('click',handler,true);

  // Dueño final de Mis Compras Plaza: evita que scripts anteriores vuelvan a pintar tarjetas abiertas sin acordeón.
  window.cargarMisComprasPlaza=function(){ window._misComprasPlazaTab='proceso'; try{localStorage.setItem(TAB_KEY,JSON.stringify('proceso'));}catch(_){} setTimeout(function(){render(true);},0); return render(true);};
  window.cambiarTabMisComprasPlaza=function(t){setTabs(t);render(true);return false;};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else setTimeout(boot,120);
  setInterval(function(){var v=document.getElementById('v-mis-compras-plaza'); if(v&&v.classList.contains('active')){var el=document.getElementById('miscompras-plaza-lista'); if(el&&!el.querySelector('.dc-l14-card,.dc-l14-empty'))render(true);} var c=document.getElementById('v-plaza-comprando'); if(c&&c.classList.contains('active'))fixComprandoBack();},700);
  window.dcPlazaLimpieza15Render=function(){return render(true);};
  window.dcPlazaLimpieza14Render=window.dcPlazaLimpieza15Render;
})();


/* LIMPIEZA 20 — COMPRANDO usa el carrito activo completo.
   Base: LIMPIEZA_19. No toca catálogo, Final Feliz, tabs ni Firebase.
   Corrige: Continuar compra mostrando sólo 1 producto/total incorrecto.
*/
(function(){
  if(window.__dcPlazaLimpieza20ComprandoCartPriority) return;
  window.__dcPlazaLimpieza20ComprandoCartPriority = true;

  var CART_KEY='dcPlazaCartV61';
  var SEL_KEY='dcPlazaCompraSeleccionada';
  var OPEN_CART='dcPlazaL14CartOpen';
  var OPEN_ORDER='dcPlazaL14OrderOpen';
  var VAC_KEY='dcPlazaL14VaciarOpen';

  function rj(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
  function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function num(v){var n=Number(String(v||0).replace(/[^0-9.]/g,''));return isFinite(n)?n:0;}
  function qty(v){var n=parseInt(v||1,10);return (!isFinite(n)||n<1)?1:n;}
  function money(v){return '$'+(Number(v)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
  function keyOf(x,i){return String((x&&(x.key||x.id||x.productoId||x.sku||x.nombre))||('p'+i));}
  function norm(a){return (Array.isArray(a)?a:[]).map(function(x,i){x=Object.assign({},x||{});x.key=keyOf(x,i);x.nombre=x.nombre||x.titulo||x.name||'Producto';x.precio=num(x.precio||x.price||x.precioUnitario);x.cantidad=qty(x.cantidad||x.qty||1);x.qty=x.cantidad;x.foto=x.foto||x.img||x.imagen||x.fotoProducto||'';return x;}).filter(function(x){return x.nombre&&x.precio>=0&&qty(x.cantidad)>0;});}
  function cart(){return norm(rj(CART_KEY,[]));}
  function total(c){return norm(c).reduce(function(s,x){return s+num(x.precio)*qty(x.cantidad);},0);}
  function collapseAll(){try{localStorage.setItem(OPEN_CART,'0');localStorage.setItem(OPEN_ORDER,'');localStorage.setItem(VAC_KEY,'0');}catch(_){}}
  function activeCartData(){
    var c=cart();
    var s=rj(SEL_KEY,null)||{};
    var si=norm(s.items||[]);
    // Si hay carrito activo, COMPRANDO debe usarlo completo. Evita que una selección vieja de 1 producto pise el total real.
    var items=c.length?c:si;
    var data={id:(s.id||'plaza_carrito_activo'),tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:(s.fecha||Date.now()),items:items,total:total(items)};
    wj(SEL_KEY,data);
    return data;
  }
  function ensureView(){
    var v=document.getElementById('v-plaza-comprando');
    if(!v){
      v=document.createElement('div');v.className='view go-right';v.id='v-plaza-comprando';v.style.flexDirection='column';
      v.innerHTML='<div class="plaza-hdr"><div class="sbar dk"><span>9:41</span><span>▲</span></div><div class="si69"><button class="btn-back-l14" type="button" aria-label="Regresar">‹</button><div><div class="si13">🛒 COMPRANDO</div><div class="si21">Plaza Online</div></div></div></div><div class="scroll" id="v-plaza-comprando-lista" style="padding:10px 6px 92px;background:#F5F6F0;"></div><div class="nav"><div class="ni" onclick="go(\'v-home\',\'left\')"><div class="ni-ic">🏠</div><div class="ni-lb">Inicio</div></div><div class="ni" onclick="go(\'v-plaza\',\'left\')"><div class="ni-ic">🏪</div><div class="ni-lb">Plaza Online</div></div><div class="ni" onclick="go(\'v-mis-compras-plaza\',\'left\')"><div class="ni-ic">🛒</div><div class="ni-lb">Mis compras</div></div><div class="ni"><div class="ni-ic">👤</div><div class="ni-lb">Perfil</div></div></div>';
      var base=document.getElementById('v-mis-compras-plaza')||document.querySelector('.view:last-of-type'); if(base&&base.parentNode)base.parentNode.insertBefore(v,base.nextSibling); else document.body.appendChild(v);
    }
    var b=v.querySelector('.btn-back'); if(b){b.classList.remove('btn-back');b.classList.add('btn-back-l14');b.removeAttribute('onclick');b.setAttribute('type','button');}
    return v;
  }
  function addStyle(){
    if(document.getElementById('dc-plaza-l20-style')) return;
    var s=document.createElement('style');s.id='dc-plaza-l20-style';s.textContent='\
#v-plaza-comprando .scroll{background:#F5F6F0!important;}\
#v-plaza-comprando .dc-plz-product-row{display:flex;align-items:center;gap:10px;background:#fff;border:.5px solid #e0e6eb;border-radius:14px;padding:10px;margin:8px 8px 10px;box-shadow:0 4px 12px rgba(10,48,85,.045);}\
#v-plaza-comprando .dc-plz-product-img{width:45px;height:45px;border-radius:10px;background:#F3F5F7;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;}\
#v-plaza-comprando .dc-plz-product-img img{width:100%;height:100%;object-fit:cover;}\
#v-plaza-comprando .dc-plz-product-main{flex:1;min-width:0;}\
#v-plaza-comprando .dc-plz-product-name{font-size:13px;font-weight:900;color:#111;line-height:1.15;}\
#v-plaza-comprando .dc-plz-product-sub{font-size:11px;color:#555;margin-top:3px;}\
#v-plaza-comprando .dc-plz-product-price{font-size:13px;font-weight:900;color:#111;white-space:nowrap;}\
#v-plaza-comprando .dc-plz-product-x{width:28px;height:28px;border:.5px solid #d5dce3;border-radius:7px;background:#fff;color:#333;font-size:17px;line-height:1;font-weight:600;}\
#v-plaza-comprando .dc-plz-sec-label{font-size:11px;color:#666;font-weight:700;margin:10px 10px 7px;display:flex;align-items:center;gap:6px;}\
#v-plaza-comprando .dc-plz-option{background:#fff;border:.8px solid #e0e2e4;border-radius:14px;padding:12px;margin:8px 8px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.025);}\
#v-plaza-comprando .dc-plz-option.active{border-color:#1FC26A;background:#EAF9F1;}\
#v-plaza-comprando .dc-plz-option-ic{width:36px;height:36px;border-radius:10px;background:#FFF6D8;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}\
#v-plaza-comprando .dc-plz-option-txt{flex:1;min-width:0;}\
#v-plaza-comprando .dc-plz-option-title{font-size:13px;font-weight:900;color:#111;line-height:1.1;}\
#v-plaza-comprando .dc-plz-option-sub{font-size:11px;color:#777;margin-top:2px;}\
#v-plaza-comprando .dc-plz-radio{width:18px;height:18px;border-radius:50%;border:2px solid #d6d6d6;box-sizing:border-box;position:relative;flex-shrink:0;}\
#v-plaza-comprando .dc-plz-option.active .dc-plz-radio{border-color:#1FC26A;}\
#v-plaza-comprando .dc-plz-option.active .dc-plz-radio:after{content:"";position:absolute;left:3px;top:3px;width:8px;height:8px;border-radius:50%;background:#1FC26A;}\
#v-plaza-comprando .dc-plz-input{width:calc(100% - 16px);margin:8px 8px;border:.8px solid #e0e2e4;border-radius:14px;padding:12px 13px;font-size:12px;font-family:inherit;background:#fff;box-sizing:border-box;outline:none;}\
#v-plaza-comprando textarea.dc-plz-input{min-height:78px;resize:none;}\
#v-plaza-comprando .dc-plz-info{margin:12px 8px;background:#F1E8FB;border-left:4px solid #7B3FA0;border-radius:12px;padding:12px;color:#4b148c;font-size:11px;line-height:1.45;font-weight:600;}\
#v-plaza-comprando .dc-plz-summary{background:#fff;border:.8px solid #e6e0d0;border-radius:14px;margin:14px 8px 10px;padding:12px;}\
#v-plaza-comprando .dc-plz-srow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;color:#777;border-bottom:.5px solid #eee;}\
#v-plaza-comprando .dc-plz-srow.total{border-bottom:0;font-size:15px;font-weight:900;color:#111;}\
#v-plaza-comprando .dc-plz-buy-btn{width:calc(100% - 16px);margin:0 8px 18px;border:none;border-radius:14px;background:#F5C518;color:#5b4300;padding:14px;font-size:13px;font-weight:900;font-family:inherit;box-shadow:0 10px 20px rgba(245,197,24,.26);}\
';document.head.appendChild(s);
  }
  function renderComprandoL20(){
    addStyle();ensureView();
    var data=activeCartData(), c=norm(data.items), subtotal=total(c), envio=0, el=document.getElementById('v-plaza-comprando-lista');
    if(!el) return false;
    var html='';
    if(!c.length){el.innerHTML='<div style="background:#fff;border:.5px solid #dde4ea;border-radius:14px;margin:8px;padding:18px;text-align:center;"><div style="font-size:28px;margin-bottom:6px;">🛒</div><div style="font-size:13px;font-weight:900;">Tu carrito está vacío</div></div>';return false;}
    c.forEach(function(x,i){
      var img=x.foto?'<img src="'+esc(x.foto)+'" onerror="this.parentNode.textContent=\'🛍️\';this.remove();">':'🛍️';
      html+='<div class="dc-plz-product-row"><div class="dc-plz-product-img">'+img+'</div><div class="dc-plz-product-main"><div class="dc-plz-product-name">'+esc(x.nombre)+'</div><div class="dc-plz-product-sub">'+qty(x.cantidad)+' x '+money(num(x.precio))+'</div></div><div class="dc-plz-product-price">'+money(num(x.precio)*qty(x.cantidad))+'</div><button type="button" class="dc-plz-product-x" aria-label="Quitar producto" data-l20-remove="'+esc(x.key||i)+'">×</button></div>';
    });
    html+='<div class="dc-plz-sec-label">📦 ¿Cómo deseas recibir tu compra?</div>';
    html+='<div class="dc-plz-option active" data-dc-plaza-entrega="domicilio"><div class="dc-plz-option-ic">🚚</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Entrega a domicilio</div><div class="dc-plz-option-sub">Repartidor DC / Tienda</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-entrega="recoger"><div class="dc-plz-option-ic">🏪</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Pasaré a recoger</div><div class="dc-plz-option-sub">Recoger directamente en tienda</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-sec-label">📍 Tu dirección de entrega</div><input id="dc-plaza-dir-compra" class="dc-plz-input" placeholder="Calle, número, colonia, referencias...">';
    html+='<div class="dc-plz-sec-label">📝 Nota para el negocio</div><textarea id="dc-plaza-nota-compra" class="dc-plz-input" placeholder="Color, talla, indicaciones, referencias..."></textarea>';
    html+='<div class="dc-plz-info">🏍️ <b>Compra con entrega local</b><br>Acuerda el pago directamente con el negocio. El repartidor DC sólo realiza la entrega cuando aplique.</div>';
    html+='<div class="dc-plz-sec-label">💳 Forma de pago</div>';
    html+='<div class="dc-plz-option active" data-dc-plaza-pago="efectivo"><div class="dc-plz-option-ic">💵</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Efectivo al entregar</div><div class="dc-plz-option-sub">Paga al recibir</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-pago="tarjeta"><div class="dc-plz-option-ic">💳</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Tarjeta al entregar</div><div class="dc-plz-option-sub">Terminal en la entrega</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-option" data-dc-plaza-pago="transferencia"><div class="dc-plz-option-ic">🏦</div><div class="dc-plz-option-txt"><div class="dc-plz-option-title">Transferencia</div><div class="dc-plz-option-sub">SPEI / Nómina</div></div><div class="dc-plz-radio"></div></div>';
    html+='<div class="dc-plz-summary"><div class="dc-plz-srow"><span>Subtotal</span><span>'+money(subtotal)+'</span></div><div class="dc-plz-srow"><span>Envío</span><span>'+(envio?money(envio):'Gratis')+'</span></div><div class="dc-plz-srow total"><span>Total</span><span>'+money(subtotal+envio)+'</span></div></div>';
    html+='<button type="button" class="dc-plz-buy-btn" id="dc-plaza-confirmar-compra">Comprar →</button>';
    el.innerHTML=html;
    return false;
  }
  function removeFromCart(k){
    var c=cart().filter(function(x,i){return keyOf(x,i)!==String(k);});
    wj(CART_KEY,c); wj(SEL_KEY,{id:'plaza_carrito_activo',tipo:'plaza_carrito',estado:'comprando',titulo:'Plaza Online',fecha:Date.now(),items:c,total:total(c)});
    renderComprandoL20();
    try{if(typeof window.dcPlazaLimpieza15Render==='function')window.dcPlazaLimpieza15Render();}catch(_){ }
  }
  document.addEventListener('click',function(e){
    var t=e.target;if(!t||!t.closest)return;
    var rem=t.closest('#v-plaza-comprando [data-l20-remove],#v-plaza-comprando [data-b2b-remove]');
    if(rem){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){ } removeFromCart(rem.getAttribute('data-l20-remove')||rem.getAttribute('data-b2b-remove'));return false;}
    var opt=t.closest('#v-plaza-comprando [data-dc-plaza-entrega],#v-plaza-comprando [data-dc-plaza-pago]');
    if(opt){try{e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();}catch(_){ } var attr=opt.hasAttribute('data-dc-plaza-entrega')?'data-dc-plaza-entrega':'data-dc-plaza-pago'; opt.parentNode.querySelectorAll('['+attr+']').forEach(function(x){x.classList.remove('active');}); opt.classList.add('active'); localStorage.setItem(attr==='data-dc-plaza-entrega'?'dcPlazaTipoEntrega':'dcPlazaTipoPago',opt.getAttribute(attr)); return false;}
  },true);

  // Dueño final de COMPRANDO.
  window.dcPlazaRenderComprando=renderComprandoL20;
  window.dcPlazaRenderComprandoRestaurant=renderComprandoL20;

  setTimeout(function(){if(document.getElementById('v-plaza-comprando')&&document.getElementById('v-plaza-comprando').classList.contains('active'))renderComprandoL20();},80);
})();


(function(){
  if(window.DC_ESTADOS_GLOBALES_UI) return;
  window.DC_ESTADOS_GLOBALES_UI={
    pendiente:{dot:'🔵',label:'Pendiente',color:'#1A7AB5'},
    esperando:{dot:'🟡',label:'Esperando',color:'#F5C518'},
    proceso:{dot:'🟢',label:'En proceso',color:'#1FC26A'},
    finalizado:{dot:'⚪',label:'Finalizado',color:'#EAEAEA'},
    cancelado:{dot:'🔴',label:'Cancelado',color:'#D63A2A'},
    pausado:{dot:'🟣',label:'Pausado',color:'#7B3FA0'}
  };
  window.dcEstadoKey=function(txt){
    txt=String(txt||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/cancelad|rechazad|suspendid|cerrad|no aprobado/.test(txt)) return 'cancelado';
    if(/pausad|temporalmente no disponible/.test(txt)) return 'pausado';
    if(/finalizad|completad|entregad|realizada/.test(txt)) return 'finalizado';
    if(/en proceso|prepar|en camino|activo|disponible|confirmad|aceptad|abierto/.test(txt)) return 'proceso';
    if(/esperando|revision|revisi|validacion|validaci|pago pendiente|pendiente de pago|ocupado/.test(txt)) return 'esperando';
    if(/pendiente|nuevo|continuar compra|accion requerida/.test(txt)) return 'pendiente';
    return '';
  };
  function looksLikeBadge(el){
    if(!el || el.nodeType!==1) return false;
    if(el.closest('script,style,input,textarea,select,option')) return false;
    if(el.classList.contains('dc-state') || el.classList.contains('dc-l14-state') || el.classList.contains('dc-estado-plaza')) return true;
    var cls=' '+(el.className||'')+' ';
    if(/\b(si44|tag|a-badge|chip|admin-badge|prov-badge)\b/.test(cls)) return true;
    var st=(el.getAttribute('style')||'').toLowerCase();
    if(st.indexOf('border-radius')>-1 && st.indexOf('font')>-1) return true;
    return false;
  }
  function normalizeOne(el){
    if(!looksLikeBadge(el)) return;
    var txt=(el.textContent||'').trim();
    if(!txt || txt.length>80) return;
    var key=window.dcEstadoKey(txt); if(!key) return;
    ['pendiente','esperando','proceso','finalizado','cancelado','pausado'].forEach(function(k){el.classList.remove('dc-auto-'+k);});
    el.classList.add('dc-state-auto','dc-auto-'+key);
    if(!el.querySelector('.dc-state-dot') && !/^[🔵🟡🟢⚪🔴🟣]/.test(txt)){
      var s=document.createElement('span'); s.className='dc-state-dot';
      el.insertBefore(s, el.firstChild);
    }
  }
  window.dcAplicarEstadosGlobales=function(root){
    root=root||document;
    var sel='.dc-state,.dc-l14-state,.dc-estado-plaza,.si44,.tag,.a-badge,.chip,.admin-badge,.prov-badge,span,div';
    root.querySelectorAll(sel).forEach(function(el){
      var txt=(el.textContent||'').trim();
      if(txt.length<=80 && window.dcEstadoKey(txt)) normalizeOne(el);
    });
  };
  setTimeout(function(){window.dcAplicarEstadosGlobales(document);},60);
  document.addEventListener('click',function(){setTimeout(function(){window.dcAplicarEstadosGlobales(document);},80);},true);
  var mo=new MutationObserver(function(muts){
    if(window.__dcEstadoTimer) clearTimeout(window.__dcEstadoTimer);
    window.__dcEstadoTimer=setTimeout(function(){window.dcAplicarEstadosGlobales(document);},80);
  });
  if(document.body) mo.observe(document.body,{childList:true,subtree:true});
})();


(function(){
  if(window.__DC_L35_FIX_FAVORITOS_BACK_REAL__) return;
  window.__DC_L35_FIX_FAVORITOS_BACK_REAL__ = true;

  function activeId(){
    var v=document.querySelector('.view.active');
    return v && v.id ? v.id : '';
  }

  function goBack(fallback){
    if(typeof window.dcBack === 'function') return window.dcBack(fallback || 'v-home');
    if(typeof window.go === 'function') window.go(fallback || 'v-home','left');
    return false;
  }

  function restoreFavBack(){
    var fav=document.getElementById('v-favoritos');
    if(!fav) return;
    var btn=fav.querySelector('.si07 button, button.btn-back');
    if(!btn) return;

    // L33 quitaba btn-back y por eso quedaba un cuadrito sin flecha. Se restaura.
    btn.classList.add('btn-back');
    btn.textContent='‹';
    btn.setAttribute('aria-label','Regresar');
    btn.onclick=function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      return goBack('v-home');
    };
  }

  function restoreDetalleProveedorBack(){
    var det=document.getElementById('v-serv-det');
    if(!det) return;
    var btn=det.querySelector('#det-header button, .btn-back');
    if(!btn) return;
    btn.classList.add('btn-back');
    btn.setAttribute('aria-label','Regresar');
    // No hardcodear Servicios ni Favoritos: usa historial real.
    btn.onclick=function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      return goBack('v-servicios');
    };
  }

  function patch(){
    restoreFavBack();
    restoreDetalleProveedorBack();
  }

  // Captura específica aunque algún script viejo vuelva a quitar la clase.
  document.addEventListener('click',function(ev){
    var favBtn=ev.target && ev.target.closest && ev.target.closest('#v-favoritos .si07 button');
    if(favBtn){
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      return goBack('v-home');
    }

    var detBtn=ev.target && ev.target.closest && ev.target.closest('#v-serv-det #det-header button');
    if(detBtn){
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      return goBack('v-servicios');
    }
  },true);

  // Reaplicar al entrar a vistas porque hay renders/overrides posteriores.
  var oldGo=window.go;
  if(typeof oldGo==='function' && !oldGo.__dcL35BackFix){
    var wrapped=function(view,dir){
      var r=oldGo.apply(this,arguments);
      setTimeout(patch,0);
      setTimeout(patch,80);
      setTimeout(patch,220);
      return r;
    };
    wrapped.__dcL35BackFix=true;
    window.go=wrapped;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',patch); else setTimeout(patch,0);
  setTimeout(patch,120);
  setTimeout(patch,400);

  var mo=new MutationObserver(function(){
    clearTimeout(window.__dcL35BackTimer);
    window.__dcL35BackTimer=setTimeout(patch,60);
  });
  if(document.body) mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','onclick']});

})();


(function(){
  if (window.__DC_NAV_FREEZE_GO_UNICA_OFICIAL__) return;
  window.__DC_NAV_FREEZE_GO_UNICA_OFICIAL__ = true;

  var navStack = [];
  var suppressStack = false;

  function activeViewId(){
    var v = document.querySelector('.view.active');
    return v && v.id ? v.id : '';
  }
  function viewExists(id){
    return !!(id && document.getElementById(id));
  }
  function pushView(id){
    if (!id || !viewExists(id)) return;
    if (navStack[navStack.length - 1] === id) return;
    navStack.push(id);
    if (navStack.length > 40) navStack.splice(0, navStack.length - 40);
  }
  function resetRegistro(id){
    if(['v-reg-vecino','v-reg-prov','v-reg-ride','v-reg-biz'].indexOf(id) !== -1){
      document.querySelectorAll('.check-row .chk.on').forEach(function(el){ el.classList.remove('on'); });
      var bv=document.getElementById('btn-reg-vecino');
      if(bv){ bv.textContent='Crear mi cuenta →'; bv.disabled=false; }
    }
  }
  function preHooks(id){
    if(id === 'v-reg-prov' && localStorage.getItem('dcuserEstado') === 'aprobado_pendiente_pago') return 'v-espera-pago';
    return id;
  }
  function plazaCollapseAll(){
    try{
      localStorage.setItem('dcPlazaL14CartOpen','0');
      localStorage.setItem('dcPlazaL14VaciarOpen','0');
      localStorage.setItem('dcPlazaL14OrderOpen','');
    }catch(_){ }
  }
  function postHooks(id){
    try{
      // Favoritos: conserva auditoría L33 sin volver a envolver go().
      if(id === 'v-favoritos') window.__dcL33LastBeforeFav = window.__dcL33LastBeforeFav || '';
      if(typeof window.__dcL33PatchAll === 'function'){
        setTimeout(window.__dcL33PatchAll,35);
        setTimeout(window.__dcL33PatchAll,180);
      }
    }catch(_){ }

    try{
      if(id !== 'v-mis-compras-plaza') plazaCollapseAll();
      if(id === 'v-mis-compras-plaza'){
        window._misComprasPlazaTab = 'proceso';
        try{ localStorage.setItem('dcPlazaQF42Tab', JSON.stringify('proceso')); }catch(_){ }
        plazaCollapseAll();
        setTimeout(function(){
          try{
            if(typeof window.dcPlazaLimpieza15Render === 'function') window.dcPlazaLimpieza15Render();
            else if(typeof window.cargarMisComprasPlaza === 'function') window.cargarMisComprasPlaza();
          }catch(_){ }
        },45);
      }
      if(id === 'v-plaza-comprando'){
        setTimeout(function(){
          try{ if(typeof window.dcPlazaRenderComprando === 'function') window.dcPlazaRenderComprando(); }catch(_){ }
        },45);
      }
      if(id === 'v-plaza-seguimiento'){
        setTimeout(function(){
          try{ if(typeof window.dcPlazaRenderSeguimiento === 'function') window.dcPlazaRenderSeguimiento(); }catch(_){ }
        },45);
      }
    }catch(_){ }
  }

  function dcGoUnicaOficial(id, dir){
    id = preHooks(id);
    dir = dir || 'right';
    var cur = document.querySelector('.view.active');
    var curId = cur && cur.id ? cur.id : '';

    if(curId === 'v-reg-vecino' && id !== 'v-reg-vecino'){
      var bv2=document.getElementById('btn-reg-vecino');
      if(bv2){ bv2.textContent='Crear mi cuenta →'; bv2.disabled=false; }
    }
    resetRegistro(id);

    if(!id || !viewExists(id) || (curId && curId === id)){
      postHooks(id);
      return false;
    }
    if(dir === 'left' && curId && typeof window._dcConfirmarSalida === 'function' && !window._dcConfirmarSalida(curId)) return false;

    if(!suppressStack && curId && curId !== id) pushView(curId);
    try{ history.pushState({viewId:id}, '', ''); }catch(_){ }

    if(typeof window._goCore === 'function') window._goCore(id, dir);
    else if(typeof _goCore === 'function') _goCore(id, dir);
    else {
      if(cur) cur.classList.remove('active');
      var tgt=document.getElementById(id);
      if(tgt) tgt.classList.add('active');
    }
    postHooks(id);
    return false;
  }

  window.dcBack = function(fallback){
    var cur = activeViewId();
    var target = '';
    while(navStack.length){
      var c = navStack.pop();
      if(c && c !== cur && viewExists(c)){ target = c; break; }
    }
    if(!target) target = fallback || 'v-home';
    suppressStack = true;
    try{ dcGoUnicaOficial(target, 'left'); }
    finally{ setTimeout(function(){ suppressStack = false; },0); }
    return false;
  };

  dcGoUnicaOficial.__dcGoUnicaOficial = true;
  dcGoUnicaOficial.__dcFrozenAt = '2026-06-21';

  try{
    Object.defineProperty(window, 'go', {
      value: dcGoUnicaOficial,
      writable: false,
      configurable: false
    });
  }catch(_){ window.go = dcGoUnicaOficial; }

  // Back final: se instala al último para unificar flechas externas sin tocar shells internos.
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('.btn-back') : null;
    if(!btn) return;
    if(btn.closest && (btn.closest('#vr-shell') || btn.closest('#vn-shell'))) return;
    var oc = (btn.getAttribute('onclick') || '');
    if(oc.indexOf('navTo') !== -1 || oc.indexOf('navBack') !== -1) return;
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.dcBack('v-home');
  }, true);
})();


/* ═══════════════════════════════════════════════════════
   LIMPIEZA 7B — RESTAURANTE PANEL FUENTE OFICIAL
   Alcance: Menú administrador / productos / categorías / disponibilidad.
   No toca Food Cliente, Plaza, Mis Compras, pedidos, Home Restaurante ni go().
   La fuente viva se congela después de cargar todos los scripts para evitar
   que wrappers heredados vuelvan a pisar el panel restaurante.
═══════════════════════════════════════════════════════ */
(function(){
  if (window.__DC_REST_PANEL_7B_OFICIAL__) return;
  window.__DC_REST_PANEL_7B_OFICIAL__ = true;

  var oficiales = {
    _renderMenuRest: window._renderMenuRest,
    _renderMenuRestFiltrado: window._renderMenuRestFiltrado,
    filtrarMenu: window.filtrarMenu,
    filtrarMenuBusqueda: window.filtrarMenuBusqueda,
    crearCategoria: window.crearCategoria,
    eliminarCategoria: window.eliminarCategoria,
    abrirFormProd: window.abrirFormProd,
    guardarProducto: window.guardarProducto,
    eliminarProducto: window.eliminarProducto,
    toggleDisp: window.toggleDisp,
    _vrCargarMenu: window._vrCargarMenu,
    _vrMenu: window._vrMenu,
    _pfCatNueva: window._pfCatNueva
  };

  Object.keys(oficiales).forEach(function(nombre){
    if (typeof oficiales[nombre] !== 'function') return;
    try {
      Object.defineProperty(window, nombre, {
        value: oficiales[nombre],
        writable: false,
        configurable: false
      });
    } catch(e) {
      try { window[nombre] = oficiales[nombre]; } catch(_) {}
    }
  });

  // Alias de compatibilidad: si algún botón legacy del restaurante llama nombres Food,
  // se respeta su función existente; no se redirige carrito/pedidos.
  window.__DC_REST_PANEL_7B_KEYS__ = Object.keys(oficiales).filter(function(k){ return typeof oficiales[k] === 'function'; });
})();
