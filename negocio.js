/* ═══════════════════════════════════════════════════════
   MÓDULO NEGOCIO DC
═══════════════════════════════════════════════════════ */
(function(){
  async function _v12Fb(){
    return await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
  }
  function _v12Add(arr,x){
    x=String(x||'').trim();
    if(x && arr.indexOf(x)===-1) arr.push(x);
  }
  function _v12Norm(v){
    return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }
  async function _v12HasProducts(_fb,db,uid){
    if(!uid) return false;
    try{
      var s=await _fb.getDocs(_fb.collection(db,'menu',uid,'productos'));
      return !s.empty;
    }catch(e){ return false; }
  }
  window.vnegResolverMenuUid = async function(preferWithData){
    var auth=window._fbAuth, db=window._fbDb, user=auth&&auth.currentUser;
    if(!user||!db) return null;
    var _fb=await _v12Fb();
    var ids=[];
    _v12Add(ids, window._vnegMenuUidCache);
    _v12Add(ids, user.uid);
    _v12Add(ids, localStorage.getItem('dcuserUid'));

    // 1) Documento directo del usuario logueado.
    try{
      var us=await _fb.getDoc(_fb.doc(db,'usuarios',user.uid));
      if(us.exists()){
        var u=us.data()||{};
        ['uid','id','_id','negocioUid','uidNegocio','ownerUid','publicUid'].forEach(function(k){ _v12Add(ids,u[k]); });
      }
    } catch(e) { }

    // 2) Buscar usuario/negocio por correo/email.
    var emails=[]; _v12Add(emails,user.email);
    // dccorreo/dcemail: legacy keys, never written by current code
    for(var ei=0; ei<emails.length; ei++){
      try{
        var qs=await _fb.getDocs(_fb.query(_fb.collection(db,'usuarios'), _fb.where('correo','==',emails[ei])));
        qs.forEach(function(d){ var u=d.data()||{}; var tipo=_v12Norm(u.tipo); if(!tipo || tipo==='negocio' || tipo==='restaurante'){ _v12Add(ids,d.id); ['uid','id','_id','negocioUid','uidNegocio','ownerUid','publicUid'].forEach(function(k){_v12Add(ids,u[k]);}); } });
      }catch(e){}
      try{
        var qs2=await _fb.getDocs(_fb.query(_fb.collection(db,'usuarios'), _fb.where('email','==',emails[ei])));
        qs2.forEach(function(d){ var u=d.data()||{}; var tipo=_v12Norm(u.tipo); if(!tipo || tipo==='negocio' || tipo==='restaurante'){ _v12Add(ids,d.id); ['uid','id','_id','negocioUid','uidNegocio','ownerUid','publicUid'].forEach(function(k){_v12Add(ids,u[k]);}); } });
      }catch(e){}
    }

    // 3) Si alguno de los candidatos tiene productos, usarlo.
    if(preferWithData!==false){
      for(var i=0;i<ids.length;i++){
        if(await _v12HasProducts(_fb,db,ids[i])){ window._vnegMenuUidCache=ids[i]; return ids[i]; }
      }
    }

    // 4) Fallback controlado por nombre del negocio/usuario local.
    // Solo se usa si coincide con el nombre público del negocio; evita agarrar un negocio ajeno al azar.
    try{
      var localNames=[];
      _v12Add(localNames, localStorage.getItem('dcuser'));
      // dcNegocioNombre/dcNombreNegocio: legacy keys, never written by current code
      var normNames=localNames.map(_v12Norm).filter(Boolean);
      if(normNames.length){
        var all=await _fb.getDocs(_fb.collection(db,'usuarios'));
        var matches=[];
        all.forEach(function(d){
          var u=d.data()||{}; var tipo=_v12Norm(u.tipo);
          if(tipo!=='negocio' && tipo!=='restaurante') return;
          var nombres=[u.nombreNegocio,u.nombrePublico,u.nombre,u.usuario].map(_v12Norm);
          var ok=normNames.some(function(n){ return nombres.indexOf(n)!==-1; });
          if(ok) matches.push(d.id);
        });
        for(var mi=0; mi<matches.length; mi++){
          if(await _v12HasProducts(_fb,db,matches[mi])){ window._vnegMenuUidCache=matches[mi]; return matches[mi]; }
        }
      }
    } catch(e) { }

    window._vnegMenuUidCache=ids[0]||user.uid;
    return window._vnegMenuUidCache;
  };

  window.vnegCargarMenu = async function(){
    var cont=document.getElementById('vn-menu-cont');
    var sub=document.getElementById('vn-menu-sub');
    var catsBar=document.getElementById('vn-menu-cats');
    if(!cont) return;
    var auth=window._fbAuth, db=window._fbDb, user=auth&&auth.currentUser;
    if(!user||!db){
      cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Inicia sesión para ver tus productos.</div>';
      if(sub) sub.textContent='—';
      return;
    }
    if(!window._vnegMenuCache || !window._vnegMenuCache.length){
      cont.innerHTML='<div style="text-align:center;color:#aaa;padding:30px;font-size:12px;">Cargando productos…</div>';
    }
    try{
      var _fb=await _v12Fb();
      var menuUid=await window.vnegResolverMenuUid(true) || user.uid;
      var snap=await _fb.getDocs(_fb.collection(db,'menu',menuUid,'productos'));
      var arr=[];
      snap.forEach(function(d){ var p=d.data()||{}; p._id=d.id; arr.push(p); });
      window._vnegMenuCache=arr;
      var productos=arr.filter(function(p){ return !p._esPlaceholder; });
      var cats=[];
      arr.forEach(function(p){ var c=String((p&&p.categoria)||'').trim(); if(c && cats.indexOf(c)===-1) cats.push(c); });
      cats.sort(function(a,b){return a.localeCompare(b,'es');});
      var actual=window._vnegMenuCat||'todos';
      if(actual!=='todos' && cats.indexOf(actual)===-1) actual='todos';
      window._vnegMenuCat=actual;
      function btn(cat,label){ var on=actual===cat; return '<button type="button" class="chip '+(on?'on':'')+'" onclick="window.vnegSetMenuCat('+JSON.stringify(cat).replace(/"/g,'&quot;')+')" style="white-space:nowrap;">'+window.dcEscHTML(label)+'</button>'; }
      if(catsBar){ catsBar.innerHTML=btn('todos','Todos') + cats.map(function(c){return btn(c,c);}).join('') + '<button type="button" class="chip" onclick="window.vnegCrearCategoria&&window.vnegCrearCategoria()" style="white-space:nowrap;border-style:dashed;">＋ Nueva</button>'; }
      if(sub) sub.textContent=productos.length + ' producto' + (productos.length===1?'':'s');
      var searchEl=document.getElementById('vn-menu-search-inp');
      var q=_v12Norm(searchEl&&searchEl.value);
      var visibles=productos.filter(function(p){
        var catOk=actual==='todos' || String(p.categoria||'')===actual;
        var txt=_v12Norm((p.nombre||'')+' '+(p.categoria||'')+' '+(p.descripcion||''));
        return catOk && (!q || txt.indexOf(q)!==-1);
      });
      if(!productos.length){
        cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Aún no tienes productos.<br>Agrega el primero arriba.</div>';
        return;
      }
      if(!visibles.length){
        cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Sin productos en esta categoría.</div>';
        return;
      }
      var grupos=[]; visibles.forEach(function(p){ var c=p.categoria||'General'; if(grupos.indexOf(c)===-1) grupos.push(c); });
      cont.innerHTML=grupos.map(function(c){
        var items=visibles.filter(function(p){return (p.categoria||'General')===c;});
        return '<div style="padding:8px 14px 4px;font-size:11px;font-weight:900;color:#777;letter-spacing:1.5px;text-transform:uppercase;">🛍️ '+window.dcEscHTML(c)+'</div>'
          + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 14px 12px;">'
          + items.map(function(p){
            var foto=p.foto||''; var agotado=p.disponible===false;
            var desc=window.dcCleanText(p.descripcion||'',58);
            return '<div onclick="vnegAbrirFormProd('+JSON.stringify(p._id).replace(/"/g,'&quot;')+')" style="background:'+(agotado?'#f6f6f6':'#fff')+';border-radius:14px;overflow:hidden;border:.5px solid '+(agotado?'#ddd':'#e6dcef')+';box-shadow:'+(agotado?'none':'0 2px 6px rgba(0,0,0,.05)')+';cursor:pointer;position:relative;'+(agotado?'opacity:.72;filter:grayscale(.30);':'')+'">'
              + (agotado?'<div style="position:absolute;top:8px;right:8px;z-index:2;background:#eee;color:#777;border-radius:10px;padding:3px 7px;font-size:9px;font-weight:900;">Agotado</div>':'')
              + '<div style="height:92px;background:#f3f3f3;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;">'+(foto&&String(foto).indexOf('data:image')===0?'<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">':'📦')+'</div>'
              + '<div style="padding:9px;">'
              + '<div style="font-size:12px;font-weight:800;color:'+(agotado?'#777':'#111')+';line-height:1.25;min-height:30px;">'+window.dcEscHTML(p.nombre||'Producto')+'</div>'
              + (desc?'<div style="font-size:10px;color:#888;line-height:1.25;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+window.dcEscHTML(desc)+'</div>':'')
              + '<div style="font-size:13px;font-weight:900;color:'+(agotado?'#999':'var(--purple)')+';margin-top:4px;">$'+(Number(p.precio||0)).toFixed(0)+'</div>'
              + '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">'+(agotado?'<span style="background:#eee;color:#777;border-radius:7px;padding:3px 6px;font-size:9px;font-weight:800;">⛔ No disponible</span>':'<span style="background:#F0EBF8;color:var(--purple);border-radius:7px;padding:3px 6px;font-size:9px;font-weight:800;">✅ Disponible</span>')+'</div>'
              + '</div></div>';
          }).join('') + '</div>';
      }).join('') + '<div style="height:70px;"></div>';
    }catch(e){
      console.error('[v12 vnegCargarMenu]',e);
      cont.innerHTML='<div style="text-align:center;color:#c00;padding:30px;font-size:12px;">Error al cargar productos: '+window.dcEscHTML(e.message)+'</div>';
    }
  };

  window.vnegFiltrarMenu=function(){ window.vnegCargarMenu&&window.vnegCargarMenu(); };
  window.vnegSetMenuCat=function(cat){ window._vnegMenuCat=cat||'todos'; window.vnegCargarMenu&&window.vnegCargarMenu(); };

  function _v12Kick(){
    var v=document.getElementById('vn-menu');
    if(!(v && v.classList.contains('active') && window.vnegCargarMenu)) return;
    if(window._vnegMenuKickTimer) clearTimeout(window._vnegMenuKickTimer);
    window._vnegMenuKickTimer=setTimeout(function(){
      window.vnegCargarMenu();
    },80);
  }
  if(!window._v13NegMenuObserver){
    window._v13NegMenuObserver=true;
    setTimeout(_v12Kick,300);
    try{
      var el=document.getElementById('vn-menu');
      if(el){ new MutationObserver(_v12Kick).observe(el,{attributes:true,attributeFilter:['class']}); }
    }catch(e){}
  }
})();
/* ═══════════════════════════════════════════════════════
   V14 — MIS PRODUCTOS: CLICK INMEDIATO + REGLAS UNIVERSALES
   - El click en producto abre edición al instante usando caché.
   - Firebase refresca después, sin bloquear la navegación.
   - Al entrar a Mis productos abre arriba y en pestaña Todos.
   - Categorías/búsqueda se filtran desde caché sin reconsultar.
   - No toca compra real ni Mis compras.
═══════════════════════════════════════════════════════ */
(function(){
  function esc(v){ if(window.dcEscHTML) return window.dcEscHTML(v); return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function clean(v,max){ if(window.dcCleanText) return window.dcCleanText(v,max||120); var t=String(v==null?'':v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); return t.length>(max||120)?t.slice(0,max||120).trim():t; }
  function norm(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
  function getCache(){ return Array.isArray(window._vnegMenuCache) ? window._vnegMenuCache : []; }
  function setVal(id,v){ var el=document.getElementById(id); if(el) el.value = v==null?'':v; }
  function getById(pid){ var arr=getCache(); for(var i=0;i<arr.length;i++){ if(String(arr[i]._id)===String(pid)) return arr[i]; } return null; }
  function poblarCategorias(sel, actual){
    if(!sel) return;
    var cats=[]; getCache().forEach(function(p){ var c=String((p&&p.categoria)||'').trim(); if(c && cats.indexOf(c)===-1) cats.push(c); });
    if(cats.indexOf('General')===-1) cats.unshift('General');
    sel.innerHTML='<option value="">— Selecciona categoría —</option>' + cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('') + '<option value="__nueva__" style="color:var(--green);font-weight:700;">＋ Agregar nueva categoría</option>';
    sel.onchange=function(){
      if(sel.value==='__nueva__'){
        sel.value=actual||'General';
        window._dcPedirTexto('Nueva categoría', 'Nombre de la categoría', function(nueva){
          nueva=clean(nueva,40);
          var opt=document.createElement('option'); opt.value=nueva; opt.textContent=nueva;
          sel.insertBefore(opt, sel.lastChild); sel.value=nueva;
          if(window._vnegMarcarProdSucio) window._vnegMarcarProdSucio(); else window._dirtyView='vn-prod-form';
        });
      }
    };
    sel.value=actual||'General';
  }
  window.vnegRenderMenuDesdeCache=function(){
    var cont=document.getElementById('vn-menu-cont');
    var sub=document.getElementById('vn-menu-sub');
    var catsBar=document.getElementById('vn-menu-cats');
    if(!cont) return;
    var arr=getCache();
    var productos=arr.filter(function(p){return !p._esPlaceholder;});
    var cats=[]; arr.forEach(function(p){ var c=String((p&&p.categoria)||'').trim(); if(c&&cats.indexOf(c)===-1) cats.push(c); });
    cats.sort(function(a,b){return a.localeCompare(b,'es');});
    var actual=window._vnegMenuCat||'todos'; if(actual!=='todos'&&cats.indexOf(actual)===-1) actual='todos'; window._vnegMenuCat=actual;
    function btn(cat,label){ var on=actual===cat; return '<button type="button" class="chip '+(on?'on':'')+'" onclick="window.vnegSetMenuCat('+JSON.stringify(cat).replace(/"/g,'&quot;')+')" style="white-space:nowrap;">'+esc(label)+'</button>'; }
    if(catsBar) catsBar.innerHTML=btn('todos','Todos') + cats.map(function(c){return btn(c,c);}).join('') + '<button type="button" class="chip" onclick="window.vnegCrearCategoria&&window.vnegCrearCategoria()" style="white-space:nowrap;border-style:dashed;">＋ Nueva</button>';
    if(sub) sub.textContent=productos.length+' producto'+(productos.length===1?'':'s');
    var searchEl=document.getElementById('vn-menu-search-inp'); var q=norm(searchEl&&searchEl.value);
    var visibles=productos.filter(function(p){ var catOk=actual==='todos'||String(p.categoria||'')===actual; var txt=norm((p.nombre||'')+' '+(p.categoria||'')+' '+(p.descripcion||'')); return catOk&&(!q||txt.indexOf(q)!==-1); });
    if(!productos.length){ cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Aún no tienes productos.<br>Agrega el primero arriba.</div>'; return; }
    if(!visibles.length){ cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Sin productos en esta categoría.</div>'; return; }
    var grupos=[]; visibles.forEach(function(p){ var c=p.categoria||'General'; if(grupos.indexOf(c)===-1) grupos.push(c); });
    cont.innerHTML=grupos.map(function(c){
      var items=visibles.filter(function(p){return (p.categoria||'General')===c;});
      return '<div style="padding:8px 14px 4px;font-size:11px;font-weight:900;color:#777;letter-spacing:1.5px;text-transform:uppercase;">🛍️ '+esc(c)+'</div>'
        + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 14px 12px;">'
        + items.map(function(p){
          var foto=p.foto||''; var agotado=p.disponible===false; var desc=clean(p.descripcion||'',58);
          return '<div onclick="vnegAbrirFormProd('+JSON.stringify(p._id).replace(/"/g,'&quot;')+')" style="background:'+(agotado?'#f6f6f6':'#fff')+';border-radius:14px;overflow:hidden;border:.5px solid '+(agotado?'#ddd':'#e6dcef')+';box-shadow:'+(agotado?'none':'0 2px 6px rgba(0,0,0,.05)')+';cursor:pointer;position:relative;'+(agotado?'opacity:.72;filter:grayscale(.30);':'')+'">'
            +(agotado?'<div style="position:absolute;top:8px;right:8px;z-index:2;background:#eee;color:#777;border-radius:10px;padding:3px 7px;font-size:9px;font-weight:900;">Agotado</div>':'')
            +'<div style="height:92px;background:#f3f3f3;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;">'+(foto&&String(foto).indexOf('data:image')===0?'<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">':'📦')+'</div>'
            +'<div style="padding:9px;"><div style="font-size:12px;font-weight:800;color:'+(agotado?'#777':'#111')+';line-height:1.25;min-height:30px;">'+esc(p.nombre||'Producto')+'</div>'
            +(desc?'<div style="font-size:10px;color:#888;line-height:1.25;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+esc(desc)+'</div>':'')
            +'<div style="font-size:13px;font-weight:900;color:'+(agotado?'#999':'var(--purple)')+';margin-top:4px;">$'+(Number(p.precio||0)).toFixed(0)+'</div>'
            +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">'+(agotado?'<span style="background:#eee;color:#777;border-radius:7px;padding:3px 6px;font-size:9px;font-weight:800;">⛔ No disponible</span>':'<span style="background:#F0EBF8;color:var(--purple);border-radius:7px;padding:3px 6px;font-size:9px;font-weight:800;">✅ Disponible</span>')+'</div></div></div>';
        }).join('') + '</div>';
    }).join('') + '<div style="height:70px;"></div>';
  };
  window.vnegSetMenuCat=function(cat){ window._vnegMenuCat=cat||'todos'; window.vnegRenderMenuDesdeCache&&window.vnegRenderMenuDesdeCache(); };
  window.vnegFiltrarMenu=function(){ window.vnegRenderMenuDesdeCache&&window.vnegRenderMenuDesdeCache(); };
  window.vnegCargarMenu=async function(opts){
    opts=opts||{};
    var cont=document.getElementById('vn-menu-cont'); if(!cont) return;
    var user=window._fbAuth&&window._fbAuth.currentUser, db=window._fbDb;
    if(!user||!db){ cont.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 20px;font-size:13px;">Inicia sesión para ver tus productos.</div>'; return; }
    if(opts.resetTab){ window._vnegMenuCat='todos'; var s=document.getElementById('vn-menu-search-inp'); if(s) s.value=''; }
    if(getCache().length){ window.vnegRenderMenuDesdeCache(); }
    else { cont.innerHTML='<div style="text-align:center;color:#aaa;padding:30px;font-size:12px;">Cargando productos…</div>'; }
    try{
      var fb=await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var uid=(window.vnegResolverMenuUid?await window.vnegResolverMenuUid(true):user.uid)||user.uid;
      var snap=await fb.getDocs(fb.collection(db,'menu',uid,'productos'));
      var arr=[]; snap.forEach(function(d){ var p=d.data()||{}; p._id=d.id; arr.push(p); });
      window._vnegMenuCache=arr;
      window.vnegRenderMenuDesdeCache();
    }catch(e){ console.error('[v14 vnegCargarMenu]',e); cont.innerHTML='<div style="text-align:center;color:#c00;padding:30px;font-size:12px;">Error al cargar productos: '+esc(e.message)+'</div>'; }
  };
  window.vnegAbrirFormProd=function(pid){
    window._dirtyView=null; window._vnegEditPid=pid||null;
    var p=pid?getById(pid):null;
    var titulo=document.getElementById('vn-rf-pform-titulo'); if(titulo) titulo.textContent=pid?'Editar producto':'Nuevo producto';
    var err=document.getElementById('vn-pf-err'); if(err) err.style.display='none';
    setVal('vn-rf-pform-id', pid||''); setVal('vn-pf-nombre', p?p.nombre:''); setVal('vn-pf-desc', p?p.descripcion:''); setVal('vn-pf-precio', p?p.precio:'');
    window._vnegPfDisp = p ? (p.disponible!==false) : true;
    window._vnegFotoB64 = (p&&p.foto&&String(p.foto).indexOf('data:image')===0)?p.foto:null;
    poblarCategorias(document.getElementById('vn-pf-cat'), (p&&p.categoria)||'General');
    var del=document.getElementById('vn-pf-del-btn'); if(del) del.style.display=pid?'block':'none';
    var file=document.getElementById('vn-pf-file-input'); if(file) file.value='';
    var tog=document.getElementById('vn-pf-toggle'); if(tog) tog.className='toggle'+(window._vnegPfDisp?' on':'');
    if(window._vnegRenderFotoUI) window._vnegRenderFotoUI();
    if(window._vnegBindProdDirty) window._vnegBindProdDirty();
    try{ var scr=document.getElementById('vn-pform-scr')||document.querySelector('#vn-prod-form .scr'); if(scr) scr.scrollTop=0; }catch(e){}
    try{ window._nNavStack=['vn-home','vn-menu']; }catch(e){}
    if(window.negTo) window.negTo('vn-prod-form');
    // Refresco no bloqueante: si Firebase trae algo distinto, actualiza campos ya dentro del form.
    if(pid){ setTimeout(async function(){
      try{
        var user=window._fbAuth&&window._fbAuth.currentUser, db=window._fbDb; if(!user||!db) return;
        var fb=await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
        var uid=(window.vnegResolverMenuUid?await window.vnegResolverMenuUid(true):user.uid)||user.uid;
        var ds=await fb.getDoc(fb.doc(db,'menu',uid,'productos',pid)); if(!ds.exists()) return;
        var fresh=ds.data()||{}; fresh._id=pid;
        var arr=getCache(); var ix=arr.findIndex(function(x){return String(x._id)===String(pid);}); if(ix>=0) arr[ix]=fresh; else arr.push(fresh); window._vnegMenuCache=arr;
        if((document.getElementById('vn-rf-pform-id')||{}).value===String(pid) && !window._dirtyView){
          setVal('vn-pf-nombre', fresh.nombre||''); setVal('vn-pf-desc', fresh.descripcion||''); setVal('vn-pf-precio', fresh.precio||'');
          window._vnegPfDisp=fresh.disponible!==false; window._vnegFotoB64=(fresh.foto&&String(fresh.foto).indexOf('data:image')===0)?fresh.foto:null;
          poblarCategorias(document.getElementById('vn-pf-cat'), fresh.categoria||'General');
          var tg=document.getElementById('vn-pf-toggle'); if(tg) tg.className='toggle'+(window._vnegPfDisp?' on':'');
          if(window._vnegRenderFotoUI) window._vnegRenderFotoUI();
        }
      } catch(e) { }
    },20); }
  };
  // Wrapper de navegación negocio: aplicar reglas universales al entrar a Mis productos.
  if(window.dcNeg_navTo && !window._v14WrappedNegNav){
    window._v14WrappedNegNav=true;
    var old=window.dcNeg_navTo;
    window.dcNeg_navTo=function(id,isBack){
      if(id==='vn-menu' && !isBack){ window._vnegMenuCat='todos'; var s=document.getElementById('vn-menu-search-inp'); if(s) s.value=''; }
      var r=old(id,isBack);
      if(id==='vn-menu') setTimeout(function(){ window.vnegCargarMenu&&window.vnegCargarMenu({resetTab:!isBack}); },20);
      return r;
    };
    window.negTo=function(id,isBack){ if(isBack && window.dcNeg_navBack) return window.dcNeg_navBack(); return window.dcNeg_navTo(id,isBack); };
  }
})();
/* Panel Proveedor — Guardar producto */
window.vnegGuardarProd = async function(){
    if (window._vnegSavingProd) return;
    var nombre = window.dcCleanText(_vnegGetVal('vn-pf-nombre'), 80);
    var cat    = window.dcCleanText(_vnegGetVal('vn-pf-cat') || 'General', 40);
    var desc   = window.dcCleanText(_vnegGetVal('vn-pf-desc'), 500);
    var precio = parseFloat(_vnegGetVal('vn-pf-precio')) || 0;
    var err    = document.getElementById('vn-pf-err');
    var btn    = document.querySelector('#vn-prod-form button[onclick="vnegGuardarProd()"]');

    if (!nombre || precio <= 0 || !_vnegFotoB64) {
      if (err) {
        err.textContent = '⚠️ Nombre, precio y foto son obligatorios.';
        err.style.display = 'block';
      }
      return;
    }
    if (err) err.style.display = 'none';

    window._vnegSavingProd = true;
    if (btn) {
      btn.dataset.dcOldText = btn.textContent || '';
      btn.textContent = 'Guardando...';
      btn.disabled = true;
      btn.style.opacity = '.72';
      btn.style.pointerEvents = 'none';
    }

    var _msgEdit = !!_vnegEditPid;
    var overlayShown = false;
    if (window._vnegShowOverlay) {
      overlayShown = true;
      window._vnegShowOverlay({
        f1tit:'Guardando producto...',
        f1sub:'Actualizando Mis productos.',
        f2tit:'¡Producto guardado!',
        f2sub:_msgEdit ? 'Tu producto fue actualizado correctamente.' : 'Tu producto ya aparece en Mis productos.',
        onDone:function(){ window.vnegGoMenuAfterSave && window.vnegGoMenuAfterSave(); }
      });
    } else {
      _vnegToast('Guardando producto...');
    }

    var data = {
      nombre:nombre,
      categoria:cat,
      categoriaPublica:cat,
      descripcion:desc,
      descripcionPublica:desc,
      precio:precio,
      disponible:_vnegPfDisp,
      foto:_vnegFotoB64,
      fotoProducto:_vnegFotoB64,
      actualizado:Date.now()
    };

    try {
      var user = window._fbAuth && window._fbAuth.currentUser;
      var _db  = window._fbDb;
      if (!user || !_db) { _vnegToast('⚠️ Sin sesión'); return; }
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      window._dirtyView = null;
      var _menuUid = await window.vnegResolverMenuUid(true) || user.uid;

      if (_vnegEditPid) {
        await _fb.setDoc(_fb.doc(_db,'menu',_menuUid,'productos',_vnegEditPid), data, {merge:true});
      } else {
        var cs = await _fb.getDocs(_fb.collection(_db,'menu',_menuUid,'productos'));
        data.orden = cs.size;
        data.creado = Date.now();
        await _fb.addDoc(_fb.collection(_db,'menu',_menuUid,'productos'), data);
      }

      // Refresca caché sin bloquear la salida ni provocar sensación de congelamiento.
      try {
        if (window.vnegCargarMenu) setTimeout(function(){ window.vnegCargarMenu(true); }, 80);
      } catch(e) {}

      if (!overlayShown) {
        _vnegToast(_msgEdit ? '✅ Producto actualizado' : '✅ Producto agregado');
        window.vnegGoMenuAfterSave && window.vnegGoMenuAfterSave();
      }
    } catch(e) {
      toast('⚠️ Error: ' + e.message);
    } finally {
      window._vnegSavingProd = false;
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
        btn.textContent = btn.dataset.dcOldText || 'Guardar producto →';
      }
    }
};

// ══════════════════════════════════════════════════════════════
// EXTRAÍDO DE firebase.js — promos, bizStats, ventas negocio
// ══════════════════════════════════════════════════════════════
  window.getPromoActivas = function() {
    try {
      var all = JSON.parse(localStorage.getItem('dcPromoActivas') || '[]');
      var now = Date.now();
      // Solo promos con estado activa y no vencidas
      return all.filter(function(p) {
        return p.estado === 'activa' && p.expira > now;
      });
    } catch(e) { return []; }
  };

  window.crearPromoDraft = function(data) {
    localStorage.setItem('dcPromoDraft', JSON.stringify(data));
  };

  window.activarPromo = function() {
    try {
      var draft = JSON.parse(localStorage.getItem('dcPromoDraft') || 'null');
      if (!draft) return false;
      var durMs = { '24h': 86400000, '3d': 259200000, '7d': 604800000 };
      var ms = durMs[draft.duracion] || 86400000;
      draft.id = 'p_' + Date.now();
      draft.estado = 'pendiente_pago'; // NO activa hasta pago o admin
      draft.creada = Date.now();
      draft.expira = Date.now() + ms;
      var all = JSON.parse(localStorage.getItem('dcPromoActivas') || '[]');
      all.unshift(draft);
      localStorage.setItem('dcPromoActivas', JSON.stringify(all));
      localStorage.removeItem('dcPromoDraft');
      localStorage.removeItem('dcPromoCarrito');
      return true;
    } catch(e) { return false; }
  };

  // Inyecta slides de promos activas al inicio del carrusel del home
  window.renderPromoEnCarrusel = function() {
    var track = document.getElementById('home-ads-track');
    var dots  = document.getElementById('home-ads-dots');
    if (!track) return;
    // Quitar slides de promo anteriores
    Array.from(track.querySelectorAll('[data-promo]')).forEach(function(el){ el.remove(); });
    var promos = window.getPromoActivas();
    if (!promos.length) return;
    // Insertar al inicio (máximo 1 promo visible)
    var p = promos[0];
    var TIPOS = {
      destacado: { bg:'linear-gradient(120deg,#1a3a2a,#2d6e3a)', ic:'⭐' },
      promocion:  { bg:'linear-gradient(120deg,#2a1a3a,#5a2a80)', ic:'🏷️' },
      oferta:     { bg:'linear-gradient(120deg,#3a1a1a,#8a2020)', ic:'🔥' },
      impulso:    { bg:'linear-gradient(120deg,#1a2a3a,#1a5a8a)', ic:'🚀' },
    };
    var t = TIPOS[p.tipo] || TIPOS.promocion;
    var slide = document.createElement('div');
    slide.setAttribute('data-promo', p.id);
    slide.setAttribute('data-ad-category', 'promo');
    slide.style.cssText = 'min-width:100%;height:95px;border-radius:16px;overflow:hidden;position:relative;flex-shrink:0;background:'+t.bg+';';
    slide.innerHTML = '<div style="position:absolute;inset:0;padding:14px 16px;display:flex;align-items:center;gap:14px;">'
      + '<div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;">' + t.ic + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:15px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:3px;">' + (p.titulo||'Promoción') + '</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.75);line-height:1.3;">' + (p.subtitulo||'') + '</div>'
      + '</div></div>'
      + '<div style="position:absolute;bottom:8px;right:12px;font-size:9px;color:rgba(255,255,255,.4);font-weight:500;letter-spacing:.3px;">Patrocinado</div>';
    track.insertBefore(slide, track.firstChild);
    // Añadir dot extra si hace falta
    if (dots && dots.children.length < track.children.length) {
      var newDot = document.createElement('span');
      newDot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#d0d0d0;display:inline-block;transition:background .3s;';
      dots.appendChild(newDot);
    }
  };

  // Navegar a crear promoción
  window.irACrearPromo = function() {
    go('v-promo-crear', 'right');
  };
  // ── FIN M2-E helpers ─────────────────────────────────────────

  // ── M2-F: STATS LOADERS ──────────────────────────────────────
  window._cargarBizStats = function() {
    var s = {}; try { s = JSON.parse(localStorage.getItem('dcBizStats')||'{}'); } catch(e) {}
    var set = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    set('vbn-visitas', s.visitas||0);
    set('vbn-clics',   s.clics||0);
    // Promos activas
    var promos = 0; try { promos = JSON.parse(localStorage.getItem('dcPromoActivas')||'[]').filter(function(p){ return p.estado==='activa'; }).length; } catch(e){}
    set('vbn-promos', promos);
    // Nombre del negocio
    var nom = localStorage.getItem('dcuser')||'Mi Negocio';
    var sub = document.getElementById('vbn-subtitle');
    if(sub) sub.textContent = s.categoria || 'Plaza Online';
  };

  // estilo tarjetas home NEGOCIO (LED morado on/off)
  if (!document.getElementById('vnhome-card-style')) {
    var _vnc = document.createElement('style'); _vnc.id = 'vnhome-card-style';
    _vnc.textContent = '.vnhome-card{border:1px solid #ececec;transition:box-shadow .25s,border-color .25s;}.vnhome-card.led-on{border:1.5px solid #7B3FA0;box-shadow:0 0 10px rgba(123,63,160,.45),inset 0 0 6px rgba(123,63,160,.12);}';
    document.head.appendChild(_vnc);
  }
  // estilo tarjetas home restaurante (LED on/off)
  if (!document.getElementById('rhome-card-style')) {
    var _rc = document.createElement('style'); _rc.id = 'rhome-card-style';
    _rc.textContent = '.rhome-card{border:1px solid #ececec;transition:box-shadow .25s,border-color .25s;}.rhome-card.led-on{border:1.5px solid #D63A2A;box-shadow:0 0 10px rgba(214,58,42,.45),inset 0 0 6px rgba(214,58,42,.12);}.rhome-card.led-on #rhome-poraceptar,.rhome-card.led-on #rhome-enproceso{color:#D63A2A;}.rhome-card:not(.led-on) .rhome-num{color:#bbb;}';
    document.head.appendChild(_rc);
  }
  // estilo de pestañas Top (inyectado una vez)
  if (!document.getElementById('vrv-top-style')) {
    var _st = document.createElement('style'); _st.id = 'vrv-top-style';
    _st.textContent = '.vrv-top-tab{background:#fff;color:#999;box-shadow:0 1px 3px rgba(0,0,0,.05);}.vrv-top-tab.on{background:#D63A2A;color:#fff;}';
    document.head.appendChild(_st);
  }
  // ── Ventas por mes del Centro Operativo (vr-ventas) ──
  window._vrvMesOffset = 0;
  window._vrvMesCambiar = function(dir){
    var n = window._vrvMesOffset + dir; if (n > 0) n = 0;
    window._vrvMesOffset = n; window._vrvCalc && window._vrvCalc();
  };
  window._vrvCalc = async function(){
    var user = window._fbAuth && window._fbAuth.currentUser; var _db = window._fbDb;
    if (!user || !_db) return;
    var uid = user.uid;
    var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var hoy = new Date();
    var ref = new Date(hoy.getFullYear(), hoy.getMonth() + window._vrvMesOffset, 1);
    var ini = ref.getTime(); var fin = new Date(ref.getFullYear(), ref.getMonth()+1, 1).getTime();
    setTxt('vrv-mes-label', MESES[ref.getMonth()] + ' ' + ref.getFullYear());
    var bn = document.getElementById('vrv-mes-next'); if (bn) bn.style.opacity = window._vrvMesOffset >= 0 ? '.35' : '1';
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',uid)));
      var nPed=0, venta=0, acum=0; var prod={};
      snap.forEach(function(d){
        var p = d.data(); if (p.estado !== 'entregado') return;
        acum += (p.total||0); var fch = p.fecha||0;
        if (fch >= ini && fch < fin) {
          nPed++; venta += (p.total||0);
          (p.items||[]).forEach(function(it){
            var key = it.nombre || 'Producto';
            if (!prod[key]) prod[key] = { nombre:key, cant:0, dinero:0 };
            var c = it.cantidad||1;
            prod[key].cant += c;
            prod[key].dinero += (it.precio||0) * c;
          });
        }
      });
      setTxt('vrv-pedidos', nPed); setTxt('vrv-ventas', '$'+venta); setTxt('vrv-acumulado', '$'+acum);
      window._vrvProd = Object.keys(prod).map(function(k){ return prod[k]; });
      window._vrvRenderTop && window._vrvRenderTop();
      var vs = await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'), _fb.where('restauranteId','==',uid)));
      var tr=0, cr=0; vs.forEach(function(d){ var v=d.data(); if(v.ratingRestaurante){ tr+=v.ratingRestaurante; cr++; } });
      setTxt('vrv-rating', cr>0 ? (tr/cr).toFixed(1)+'\u2605' : '—');
    } catch(e) { }
  };

  // Top 3 productos: pestañas dinero/cantidad + render
  window._vrvTopModo = 'dinero';
  window._vrvProd = [];
  window._vrvTopTab = function(modo, btn){
    window._vrvTopModo = modo;
    document.querySelectorAll('.vrv-top-tab').forEach(function(b){ b.classList.remove('on'); });
    if (btn) btn.classList.add('on');
    window._vrvRenderTop && window._vrvRenderTop();
  };
  window._vrvRenderTop = function(){
    var cont = document.getElementById('vrv-top-lista'); if (!cont) return;
    var modo = window._vrvTopModo || 'dinero';
    var arr = (window._vrvProd||[]).slice().sort(function(a,b){
      return modo==='dinero' ? (b.dinero-a.dinero) : (b.cant-a.cant);
    }).slice(0,3);
    if (!arr.length) {
      cont.innerHTML = '<div style="background:#fff;border-radius:12px;padding:20px;text-align:center;color:#aaa;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);">Sin ventas este mes todav\u00eda</div>';
      return;
    }
    var medallas = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
    cont.innerHTML = arr.map(function(p,i){
      var dato = modo==='dinero' ? ('$'+p.dinero) : (p.cant+' u');
      var sub  = modo==='dinero' ? (p.cant+' unidades') : ('$'+p.dinero);
      return '<div style="background:#fff;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,.05);">'
        + '<span style="font-size:20px;">'+medallas[i]+'</span>'
        + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#2a2a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+p.nombre+'</div><div style="font-size:10px;color:#aaa;">'+sub+'</div></div>'
        + '<div style="font-size:15px;font-weight:800;color:#D63A2A;">'+dato+'</div></div>';
    }).join('');
  };

