
// ============ CHAT — ESTADO GLOBAL ============
window._chatUnsubscribe = null;
window._chatProveedorId = null;
window._chatProveedorNombre = null;
window._chatIdExacto = null;

window.abrirChat = function(proveedorId, proveedorNombre, proveedorIc) {
  window._chatProveedorId = proveedorId;
  window._chatProveedorNombre = proveedorNombre || 'Proveedor';
  window._chatIdExacto = null;
  var nom = document.getElementById('chat-prov-nombre');
  var ic  = document.getElementById('chat-prov-ic');
  var btn = document.querySelector('#v-chat .btn-back');
  if(nom) nom.textContent = proveedorNombre || 'Proveedor';
  if(ic)  ic.textContent  = proveedorIc || '🔧';
  if(btn) btn.onclick = function(){ go('v-serv-det','left'); cerrarChat(); };
  go('v-chat', 'right');
  cargarMensajes();
};

window.abrirChatExacto = function(chatId, otroId, nombre, backView) {
  window._chatProveedorId = otroId;
  window._chatIdExacto = chatId;
  window._chatProveedorNombre = nombre || 'Usuario';
  var nom = document.getElementById('chat-prov-nombre');
  var ic  = document.getElementById('chat-prov-ic');
  var btn = document.querySelector('#v-chat .btn-back');
  if(nom) nom.textContent = nombre || 'Usuario';
  if(ic)  ic.textContent  = '💬';
  if(btn) btn.onclick = function(){ go(backView||'v-mis-chats','left'); cerrarChat(); };
  go('v-chat','right');
  cargarMensajes();
};

window.cerrarChat = function() {
  if(window._chatUnsubscribe) {
    window._chatUnsubscribe();
    window._chatUnsubscribe = null;
  }
};

window.contactarProveedor = async function() {
  var p = window._proveedorActual || {};
  var provId = p.uid || p.id || p._id || 'demo';
  var nombre = p.nombre || 'Proveedor';
  var _auth = window._fbAuth;
  var _db   = window._fbDb;
  var myUid = _auth && _auth.currentUser && _auth.currentUser.uid;
  if (myUid && _db && provId !== 'demo') {
    try {
      var col = window._fs.collection, gdocs = window._fs.getDocs, qry = window._fs.query, whr = window._fs.where;
      var q = qry(col(_db, 'chats'), whr('participantes', 'array-contains', myUid));
      var snap = await gdocs(q);
      var chatExistente = null;
      snap.forEach(function(doc) {
        var d = doc.data();
        if (Array.isArray(d.participantes) && d.participantes.includes(provId)) {
          chatExistente = { id: doc.id, nombre: (d.nombres && d.nombres[myUid]) || nombre };
        }
      });
      if (chatExistente) {
        window.abrirChatExacto(chatExistente.id, provId, chatExistente.nombre, 'v-serv-det');
        return;
      }
    } catch(e) {}
  }
  window.abrirChat(provId, nombre, '🔧');
};

// ============ CHAT — ENVIAR Y RECIBIR MENSAJES ============
window.enviarMensaje = async function() {
  var auth = window._fbAuth;
  var db   = window._fbDb;
  var fs   = window._fs;
  if (!auth || !auth.currentUser) { if(typeof toast==='function') toast('⚠️ Inicia sesión para enviar mensajes.'); return; }
  var input = document.getElementById('chat-input');
  if(!input || !input.value.trim()) return;
  var texto = input.value.trim();
  input.value = '';
  var container = document.getElementById('chat-msgs-container');
  var hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  var divLocal = document.createElement('div');
  divLocal.className = 'msg msg-s';
  var _tLocal = document.createTextNode(texto);
  var _hLocal = document.createElement('div');
  _hLocal.className = 'msg-time';
  _hLocal.textContent = hora;
  divLocal.appendChild(_tLocal);
  divLocal.appendChild(_hLocal);
  if(container) { container.appendChild(divLocal); container.scrollTop = container.scrollHeight; }
  var userId = auth.currentUser.uid;
  var userName = localStorage.getItem('dcuser') || 'Vecino';
  var provId = window._chatProveedorId || '';
  if (!provId) { if(typeof toast==='function') toast('⚠️ Selecciona un proveedor para chatear.'); return; }
  var idsOrdenados = [userId, provId].sort().join('_');
  var chatId = 'chat_' + idsOrdenados;
  try {
    await fs.addDoc(fs.collection(db, 'chats', chatId, 'mensajes'), {
      texto: texto, remitenteId: userId, remitenteNombre: userName,
      timestamp: fs.serverTimestamp()
    });
    var _fb2 = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    await _fb2.setDoc(_fb2.doc(db, 'chats', chatId), {
      participantes: [userId, provId],
      ultimoMsg: texto,
      ultimoNombre: userName,
      nombreContacto: window._chatProveedorNombre || 'Usuario',
      ultimoEmisor: userId,
      respondido: false,
      fecha: Date.now()
    }, { merge: true });
  } catch(e) { }
};

window.cargarMensajes = async function() {
  var auth = window._fbAuth;
  var db   = window._fbDb;
  var fs   = window._fs;
  var container = document.getElementById('chat-msgs-container');
  if(!container) return;
  var hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  container.innerHTML = '';
  if (!auth || !db || !fs) return;
  await new Promise(function(resolve) {
    if(auth.currentUser) return resolve();
    var unsub = auth.onAuthStateChanged(function(u) { unsub(); resolve(); });
  });
  var userId = auth.currentUser ? auth.currentUser.uid : 'anonimo';
  window._chatUserId = userId;
  var provId = window._chatProveedorId || '';
  var chatId = window._chatIdExacto || (provId ? ('chat_' + [userId, provId].sort().join('_')) : null);
  if (!chatId) return;
  window._chatIdExacto = null;
  try {
    var msgsRef = fs.collection(db, 'chats', chatId, 'mensajes');
    if(window._chatUnsubscribe) window._chatUnsubscribe();
    window._chatUnsubscribe = fs.onSnapshot(fs.query(msgsRef, fs.orderBy('timestamp','asc')), function(snap) {
      container.innerHTML = '';

      // Punto 4: tarjeta de contexto cuando viene de solicitud directa
      var ctx = window._chatContextoSolicitud;
      if (ctx) {
        var ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
        var catIc = ICONOS[(ctx.categoria||'').toLowerCase()] || '🔧';
        var card = document.createElement('div');
        card.style.cssText = 'margin:10px 12px 4px;background:linear-gradient(135deg,#E8F5EE,#f0faf4);border-radius:14px;padding:12px 14px;border:1px solid #C8E6C9;';
        card.innerHTML = '<div style="font-size:10px;font-weight:800;color:#0A4220;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">📋 Solicitud directa · '+ctx.provNombre.replace(/</g,'&lt;')+'</div>'
          +'<div style="font-size:12px;color:#1a7a45;font-weight:700;margin-bottom:4px;">'+catIc+' '+(ctx.categoria||'').charAt(0).toUpperCase()+(ctx.categoria||'').slice(1)+'</div>'
          +'<div style="font-size:12px;color:#333;line-height:1.5;">'+ctx.descripcion.replace(/</g,'&lt;')+'</div>';
        container.appendChild(card);
        window._chatContextoSolicitud = null;
      }

      if(snap.empty) {
        var sys = document.createElement('div');
        sys.className = 'msg msg-sys';
        sys.textContent = 'Chat iniciado · ' + hora;
        container.appendChild(sys);
        return;
      }
      snap.forEach(function(d) {
        var m = d.data();
        var div = document.createElement('div');
        div.className = 'msg ' + (m.remitenteId === userId ? 'msg-s' : 'msg-r');
        var h = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : hora;
        var _tMsg = document.createTextNode(m.texto||'');
        var _hMsg = document.createElement('div');
        _hMsg.className = 'msg-time';
        _hMsg.textContent = h;
        div.appendChild(_tMsg);
        div.appendChild(_hMsg);
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    });
  } catch(e) { }
};

// ============ MIS CHATS — BANDEJA DE ENTRADA ============
window.cargarMisChats = async function() {
  const container = document.getElementById('lista-mis-chats');
  if(!container) return;
  container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Cargando tus mensajes...</div>';

  let tries = 0;
  while((!window._fbDb || !window._fbAuth) && tries < 20) {
    await new Promise(r => setTimeout(r, 200)); tries++;
  }
  if(!window._fbDb || !window._fbAuth || !window._fbAuth.currentUser) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Inicia sesión para ver tus chats.</div>';
    return;
  }

  try {
    const { collection, getDocs, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    const myUid = window._fbAuth.currentUser.uid;
    const chatsSnap = await getDocs(collection(window._fbDb, 'chats'));
    const resultados = [];
    const promises = [];

    chatsSnap.forEach(chatDoc => {
      const cId = chatDoc.id;
      if(!cId.includes(myUid)) return;

      const sinPrefijo = cId.replace('chat_', '');
      const partes = sinPrefijo.split('_');
      const otroId = partes.find(p => p !== myUid) || partes[0];
      const d = chatDoc.data();

      // Si el doc raíz tiene datos (enviado con v36+), usarlos directo
      if(d && d.ultimoMsg) {
        const ts = d.fecha ? new Date(d.fecha) : new Date();
        const hora = ts.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
        resultados.push({
          cId, otroId,
          nombre: (d.nombres && d.nombres[myUid]) || d.nombreContacto || d.ultimoNombre || 'Usuario',
          ultimo: d.ultimoMsg,
          hora, ts,
          tipo: d.tipo || (d.reporteId ? 'solicitud' : ''),
          noRespondido: d.ultimoEmisor !== myUid
        });
      } else {
        // Fallback: leer último mensaje de la subcolección (mensajes viejos)
        promises.push((async () => {
          const msgsRef = collection(window._fbDb, 'chats', cId, 'mensajes');
          const q = query(msgsRef, orderBy('timestamp','desc'), limit(1));
          const msgsSnap = await getDocs(q);
          if(msgsSnap.empty) return;
          const last = msgsSnap.docs[0].data();
          const ts = last.timestamp ? new Date(last.timestamp.seconds * 1000) : new Date();
          const hora = ts.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
          resultados.push({
            cId, otroId,
            nombre: last.remitenteNombre || 'Usuario',
            ultimo: last.texto || '',
            hora, ts,
            noRespondido: last.remitenteId !== myUid
          });
        })());
      }
    });

    await Promise.all(promises);

    if(resultados.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;font-size:36px;">💬</div><div style="text-align:center;color:var(--text-muted);font-size:13px;">No tienes chats activos en este momento.</div>';
      return;
    }

    resultados.sort((a,b) => b.ts - a.ts);

    // XSS-SAFE: r.nombre y r.ultimo se insertan con textContent, nunca con innerHTML
    container.innerHTML = '';
    resultados.forEach(function(r) {
      var card = document.createElement('div');
      card.style.cssText = 'background:#fff;border-radius:14px;padding:12px 14px;margin:0 14px 8px;display:flex;align-items:center;gap:12px;cursor:pointer;border:.5px solid '+(r.noRespondido?'#f0b8b0':'#efefef')+';box-shadow:0 2px 6px rgba(0,0,0,.05);transition:transform .15s;';
      card.setAttribute('ontouchstart', "this.style.transform='scale(.98)'");
      card.setAttribute('ontouchend',   "this.style.transform=''");
      card.onclick = (function(_cId,_oId,_nom){ return function(){ abrirChatExacto(_cId,_oId,_nom); }; })(r.cId, r.otroId, r.nombre||'Usuario');

      var avatar = document.createElement('div');
      avatar.style.cssText = 'width:44px;height:44px;border-radius:13px;background:'+(r.noRespondido?'var(--red-light)':'var(--green-light)')+';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;';
      avatar.textContent = r.noRespondido ? '🔴' : '💬';

      var body = document.createElement('div');
      body.style.cssText = 'flex:1;min-width:0;';

      var nomRow = document.createElement('div');
      nomRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:2px;';

      var nomEl = document.createElement('div');
      nomEl.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-primary);';
      nomEl.textContent = r.nombre || 'Usuario';   // ← XSS-SAFE
      nomRow.appendChild(nomEl);

      if (r.tipo === 'directo') {
        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:9px;font-weight:700;background:#E3F0FF;color:#1565C0;border-radius:6px;padding:2px 6px;flex-shrink:0;';
        badge.textContent = '🔵 Directo';
        nomRow.appendChild(badge);
      } else if (r.tipo === 'solicitud') {
        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:9px;font-weight:700;background:#E8F5EE;color:#1a7a45;border-radius:6px;padding:2px 6px;flex-shrink:0;';
        badge.textContent = '🟢 Solicitud';
        nomRow.appendChild(badge);
      }

      var ultEl = document.createElement('div');
      ultEl.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      ultEl.textContent = r.ultimo || '';           // ← XSS-SAFE

      var horaEl = document.createElement('div');
      horaEl.style.cssText = 'font-size:10px;color:var(--text-hint);flex-shrink:0;';
      horaEl.textContent = r.hora || '';

      body.appendChild(nomRow);
      body.appendChild(ultEl);
      card.appendChild(avatar);
      card.appendChild(body);
      card.appendChild(horaEl);
      container.appendChild(card);
    });

  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);">Error: '+e.message+'</div>';
  }
};
// ============ FIN MIS CHATS ============

// ============ ALERTA PROVEEDOR + REPUTACIÓN v32 ============
window.verificarChatsProveedor = async function() {
  const tipo = localStorage.getItem('dcuserTipo') || 'vecino';
  if(tipo === 'vecino') return; // Solo para proveedores

  if(!window._fbAuth || !window._fbAuth.currentUser) return;
  if(!window._fbDb) return;

  const myUid = window._fbAuth.currentUser.uid;

  try {
    const { collection, getDocs, query, orderBy, limit } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    const chatsSnap = await getDocs(collection(window._fbDb, 'chats'));
    let pendientes = 0;

    const promises = [];
    chatsSnap.forEach(chatDoc => {
      if(!chatDoc.id.includes(myUid)) return;
      const d = chatDoc.data();

      if(d && d.ultimoEmisor) {
        // Doc raíz tiene datos (v36+): usar directamente
        if(d.ultimoEmisor !== myUid) pendientes++;
      } else {
        // Fallback: leer subcolección
        promises.push((async () => {
          const msgsRef = collection(window._fbDb, 'chats', chatDoc.id, 'mensajes');
          const q = query(msgsRef, orderBy('timestamp','desc'), limit(1));
          const snap = await getDocs(q);
          if(snap.empty) return;
          const last = snap.docs[0].data();
          if(last.remitenteId !== myUid) pendientes++;
        })());
      }
    });
    await Promise.all(promises);

    // ── Alerta roja parpadeante en v-mipanel ──────────────
    const panelScroll = document.querySelector('#v-mipanel .scroll');
    let alertaEl = document.getElementById('alerta-prov-chats');

    if(pendientes > 0) {
      if(!alertaEl && panelScroll) {
        alertaEl = document.createElement('div');
        alertaEl.id = 'alerta-prov-chats';
        alertaEl.className = 'prov-alerta-dinero';
        alertaEl.innerHTML = `
          <div style="font-size:26px;margin-bottom:6px;">⚠️</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:4px;">¡TIENES TRABAJOS PENDIENTES!</div>
          <div style="font-size:12px;font-weight:400;line-height:1.6;">
            Tienes <strong>${pendientes}</strong> cliente${pendientes>1?'s':''} esperando respuesta.<br>
            Contesta rápido para mantener tu buena calificación.
          </div>
          <button onclick="go('v-mis-chats','right');setTimeout(cargarMisChats,300)"
            style="margin-top:12px;background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.5);
                   color:#fff;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;
                   cursor:pointer;font-family:'Inter',sans-serif;display:block;width:100%;">
            Ver mis chats →
          </button>`;
        panelScroll.insertBefore(alertaEl, panelScroll.firstChild);
      } else if(alertaEl) {
        const s = alertaEl.querySelector('strong');
        if(s) s.textContent = pendientes;
      }
    } else if(alertaEl) {
      alertaEl.remove();
    }

    // ── Badge de reputación ──────────────────────────────
    let badge = document.getElementById('badge-reputacion');
    if(!badge) {
      badge = document.createElement('div');
      badge.id = 'badge-reputacion';
      badge.style.cssText = 'margin-top:10px;display:block;';
      const infoCard = document.querySelector('#v-mipanel .scroll > div[style*="margin-bottom:14px"]');
      if(infoCard) infoCard.appendChild(badge);
    }
    badge.className = 'rep-badge ' + (pendientes === 0 ? 'rep-rapido' : 'rep-lento');
    badge.innerHTML = pendientes === 0 ? '⚡ Responde de inmediato' : '⏳ Suele tardar en responder';

  } catch(e) { }
};
// ============ FIN ALERTA PROVEEDOR ============

// ============ NOTIFICACIONES WEB v32 ============
window.activarNotificacionesProveedor = async function() {
  if(!window._fbAuth || !window._fbAuth.currentUser) return;
  if(!window._fbDb || !window._fs) return;
  const myUid = window._fbAuth.currentUser.uid;
  try {
    const { collection, getDocs, query, orderBy, onSnapshot } = window._fs;
    const db = window._fbDb;
    const chatsSnap = await getDocs(collection(db, 'chats'));
    const unsubs = [];
    chatsSnap.forEach(chatDoc => {
      if(!chatDoc.id.includes(myUid)) return;
      const msgsRef = collection(db, 'chats', chatDoc.id, 'mensajes');
      let init = false;
      const unsub = onSnapshot(query(msgsRef, orderBy('timestamp','asc')), async snap => {
        if(!init) { init = true; return; }
        const last = snap.docs[snap.docs.length - 1];
        if(!last) return;
        const m = last.data();
        if(m.remitenteId === myUid) return;
        if(document.visibilityState === 'hidden' && Notification.permission === 'granted') {
          new Notification('Dominio Cumbres 🏡', { body: '¡Tienes un nuevo mensaje de un cliente!' });
        }
        // Badge y notificación Firestore — guard 60s por chatId
        const _cid = chatDoc.id;
        const _now = Date.now();
        if(!window._provChatNotifTs) window._provChatNotifTs = {};
        if(!window._provChatNotifTs[_cid] || _now - window._provChatNotifTs[_cid] > 60000) {
          window._provChatNotifTs[_cid] = _now;
          try {
            const { addDoc: _add, collection: _col, serverTimestamp: _st } =
              await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
            await _add(_col(db, 'notificaciones'), {
              uid: myUid, tipo: 'chat', modulo: 'chats',
              titulo: 'Nuevo mensaje', mensaje: m.remitenteNombre || 'Un cliente te escribió.',
              leida: false, eliminada: false, prioridad: 'normal',
              chatId: _cid, fecha: _st()
            });
            window.actualizarBadgesReales && window.actualizarBadgesReales();
          } catch(_ne) { }
        }
        window.verificarChatsProveedor && window.verificarChatsProveedor();
      });
      unsubs.push(unsub);
    });
    window._provNotifUnsub = () => unsubs.forEach(u => u());
  } catch(e) { }
};
// ============ FIN NOTIFICACIONES ============

// ── Contactar proveedor moderno — busca chat existente antes de abrir ──
// Punto 3: Contacto directo — abre el formulario real de solicitud con el proveedor pre-seleccionado
window._contactarProveedorModerno = function() {
  const p = window._proveedorActual || {};
  const provId = p.uid || p.id || p._id || '';
  if (!provId) return;

  // Guardar contexto para que publicarReporte() y iniciarFormularioSolicitud() lo usen
  window._solicitudDirectaProvId     = provId;
  window._solicitudDirectaProvNombre = p.nombre || 'Proveedor';
  window._solicitudDirectaCategoria  = (p.categoria || p.oficio1 || '').toLowerCase();

  go('v-solicitud-nueva', 'right');
};

// Abrir chat directamente (cuando ya existe chat previo con ese proveedor)
window._abrirChatDirecto = function(provId, nombre, chatIdExacto) {
  window._chatProveedorId     = provId;
  window._chatIdExacto        = chatIdExacto || null;
  window._chatProveedorNombre = nombre;
  const nom = document.getElementById('chat-prov-nombre');
  const ic  = document.getElementById('chat-prov-ic');
  const bk  = document.querySelector('#v-chat .btn-back');
  if (nom) nom.textContent = nombre;
  if (ic)  ic.textContent  = '🔧';
  if (bk)  bk.onclick = function(){ go('v-serv-det','left'); window.cerrarChat&&window.cerrarChat(); };
  go('v-chat', 'right');
  window.cargarMensajes && window.cargarMensajes();
};
// ── FIN contactar proveedor moderno ──────────────────────────

/* NAVIGATION — v23: History API + botón Atrás nativo */
function _goCore(id,dir){
  const cur=document.querySelector('.view.active');
  const tgt=document.getElementById(id);
  if(!tgt||tgt===cur)return;
  cur.classList.remove('active');
  cur.classList.add(dir==='right'?'go-left':'go-right');
  tgt.classList.remove('go-left','go-right','active');
  tgt.classList.add(dir==='right'?'go-right':'go-left');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    tgt.classList.remove('go-right','go-left');
    tgt.classList.add('active');
    // Manejo de shells (restaurante/negocio): elevar el shell de la vista activa, bajar los demás
    try {
      var _vrSh = document.getElementById('vr-shell');
      var _vnSh = document.getElementById('vn-shell');
      var enVr = !!(_vrSh && _vrSh.contains(tgt));
      var enVn = !!(_vnSh && _vnSh.contains(tgt));
      if (_vrSh) { _vrSh.style.zIndex = enVr ? '50' : '1'; _vrSh.style.pointerEvents = enVr ? 'auto' : 'none'; }
      if (_vnSh) { _vnSh.style.zIndex = enVn ? '50' : '1'; _vnSh.style.pointerEvents = enVn ? 'auto' : 'none'; }
    } catch(e){}
    // Limpiar listener de estado en vivo al salir del restaurante
  try { var _foodViews=['v-food-det','v-carrito','v-food']; if (_foodViews.indexOf(id)===-1 && window._restEstadoUnsub) { window._restEstadoUnsub(); window._restEstadoUnsub = null; } } catch(e){}
  // Reconectar listener en vivo al volver a la ficha del restaurante
  try { if (id === 'v-food-det' && _S && _S.rest && _S.rest._id) { window._dcfConectarEstadoVivo && window._dcfConectarEstadoVivo(_S.rest._id); } } catch(e){}
  // REGLA UNIVERSAL: toda pantalla inicia desde arriba
    try{tgt.scrollTop=0;tgt.querySelectorAll('*').forEach(function(el){if(el.scrollTop)el.scrollTop=0;});}catch(e){}
    // REGLA UNIVERSAL: pantallas con pestañas siempre abren en la primera pestaña
    try{tgt.querySelectorAll('.pill-row,.tabs-row').forEach(function(g){var b=g.querySelector('button[onclick]');if(b&&!b.classList.contains('on')&&!b.classList.contains('dcf-on'))b.click();});}catch(e){}
    if(window._dcDirtyV&&window._dcDirtyV!==tgt.id)window._dcDirtyV=null;
    // Auto-trigger data-onenter
    const fn=tgt.getAttribute('data-onenter');
    if(fn&&window[fn])setTimeout(()=>window[fn](),200);
    // Auto-load modules
    if(id==='v-servicios'){
      const intentarCargar=(intentos)=>{
        if(window.cargarProveedores){window.cargarProveedores();}
        else if(intentos<20){setTimeout(()=>intentarCargar(intentos+1),300);}
      };
      setTimeout(()=>intentarCargar(0),200);
      window.actualizarBtnSolicitudRol && window.actualizarBtnSolicitudRol();
    }
    if(id==='v-food')setTimeout(()=>window.dcFood_init&&window.dcFood_init(),200);
    if(id==='v-panel-rest')setTimeout(()=>window.dcFood_cargarPanelRest&&window.dcFood_cargarPanelRest(),200);
    if(id==='v-repartidor')setTimeout(()=>window.dcFood_cargarPedidosRep&&window.dcFood_cargarPedidosRep(),200);
    if(id==='v-home')window.actualizarBadgesReales&&window.actualizarBadgesReales();
    if(id==='vn-home'){window.vnegCargarConfig&&window.vnegCargarConfig();window._updateHora&&window._updateHora();setTimeout(function(){window._calcMetricasNeg&&window._calcMetricasNeg();},120);}
    if(id==='vn-config'){window.vnegCargarConfig&&window.vnegCargarConfig();}
    if(id==='vn-cmv'){setTimeout(function(){window.vnegCmvCargar&&window.vnegCmvCargar();},100);}
    if(id==='vn-pedidos'){_vnegPedTab='pedidos';setTimeout(function(){window.vnegRenderPedidos&&window.vnegRenderPedidos();},100);}
    if(id==='vn-menu')setTimeout(function(){window.vnegCargarMenu&&window.vnegCargarMenu();},100);
    if(id==='vn-ventas'){window._vnvMesOffset=0;setTimeout(function(){window._vnvCalc&&window._vnvCalc();},100);}
    if(id==='v-mis-pedidos-food')setTimeout(()=>window.dcFood_cargarMisPedidos&&window.dcFood_cargarMisPedidos(),200);
    if(id==='v-mis-pedidos-food')window._marcarPedidosLeidos&&window._marcarPedidosLeidos();
    if(id==='v-plaza')setTimeout(()=>window.cargarPlaza&&window.cargarPlaza(),200);
    if(id==='v-ride')setTimeout(()=>window.cargarRepartidores&&window.cargarRepartidores(),200);
    if(id==='v-admin-solicitudes')setTimeout(()=>window.cargarSolicitudes&&window.cargarSolicitudes(),300);
    if(id==='v-admin-analytics')setTimeout(()=>window.cargarAnalytics&&window.cargarAnalytics(),300);
    if(id==='v-home')setTimeout(()=>{window.renderHomeM2&&window.renderHomeM2();},50);
    if(id==='v-home'){var _t=(localStorage.getItem('dcuserTipo')||'').toLowerCase();if(_t==='restaurante'){window._restCargarHorariosYRepintar&&window._restCargarHorariosYRepintar();setTimeout(()=>{window._calcMetricasRest&&window._calcMetricasRest('hoy');},120);
// B3: arrancar timer restaurante desde v-home si aún no está corriendo
if(!window._rHoraTimer){window._rHoraTimer=setInterval(window._updateHora||function(){},30000);}}if(_t==='negocio'){window._vnegCargarHorariosYRepintar&&window._vnegCargarHorariosYRepintar();setTimeout(()=>{window._calcMetricasNeg&&window._calcMetricasNeg();},120);
// B3: arrancar timer negocio desde v-home si aún no está corriendo
if(!window._nHoraTimer){window._nHoraTimer=setInterval(function(){if(window._updateHora)window._updateHora();},30000);}}}
    if(id==='v-mipanel')setTimeout(()=>{window.cargarMiPerfil&&window.cargarMiPerfil();window.verificarChatsProveedor&&window.verificarChatsProveedor();},300);
    if(id==='v-mi-perfil')setTimeout(()=>{window.cargarMiPerfilDetalle&&window.cargarMiPerfilDetalle();},300);
    if(id==='v-mi-negocio')setTimeout(()=>{window._cargarBizStats&&window._cargarBizStats();},100);
    if(id==='v-mi-restaurante')setTimeout(()=>{window._cargarRestStats&&window._cargarRestStats();},100);
    if(id==='vr-home')setTimeout(()=>window.dcRest_init&&window.dcRest_init(),200);
    if(id==='vr-pedidos')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-pedidos'),200);
    if(id==='vr-det-pedido')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-det-pedido'),200);
    if(id==='vr-menu')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-menu'),200);
    if(id==='vr-prod-form')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-prod-form'),200);
    if(id==='vr-promos')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-promos'),200);
    if(id==='vr-notif')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-notif'),200);
    if(id==='vr-config')setTimeout(()=>window.dcRest_onViewEnter&&window.dcRest_onViewEnter('vr-config'),200);
    if(id==='v-busqueda')setTimeout(()=>{window._initBusqueda&&window._initBusqueda();},80);
    if(id==='v-notificaciones')setTimeout(()=>{window.renderNotificaciones&&window.renderNotificaciones();},100);
    if(id==='v-agenda')setTimeout(()=>{window._renderAgenda&&window._renderAgenda();},100);
    if(id==='v-agenda-reservas')setTimeout(()=>{window._renderAgendaReservas&&window._renderAgendaReservas();},100);
    if(id==='v-reservar')setTimeout(()=>{window._renderReservar&&window._renderReservar();},100);
    if(id==='v-favoritos')setTimeout(cargarFavoritos,400);
    if(id==='v-mi-agenda')setTimeout(()=>window._initMiAgenda&&window._initMiAgenda(),200);
    if(id==='v-mis-chats')setTimeout(()=>window.cargarMisChats&&window.cargarMisChats(),300);
    if(id==='v-carrito')setTimeout(()=>window.dcFood_renderCarrito&&window.dcFood_renderCarrito(),50);
    // Al entrar a cualquier vista de registro, limpiar checkboxes y formulario
    if(['v-reg-vecino','v-reg-prov','v-reg-ride','v-reg-biz'].includes(id)){
      ['v-chk1','v-chk2',
       'p-chk1','p-chk2','p-chk3','p-chk4',
       'r-chk1','r-chk2','r-chk3','r-chk4',
       'b-chk1','b-chk2','b-chk3','b-chk4'
      ].forEach(cid=>{
        const cel=document.getElementById(cid);
        if(cel)cel.classList.remove('on');
      });
      // Reset registro vecino btn siempre al entrar
      const _bv=document.getElementById('btn-reg-vecino');
      if(_bv){_bv.textContent='Crear mi cuenta →';_bv.disabled=false;}
      // Bug 3: reset ride y biz buttons
      const _br=document.getElementById('btn-reg-ride');
      if(_br){_br.textContent='Enviar solicitud →';_br.disabled=false;}
      const _bb=document.getElementById('btn-reg-biz');
      if(_bb){_bb.textContent='Enviar solicitud →';_bb.disabled=false;}
      // Bug 2c: reset biz selects and hide category groups
      if(id==='v-reg-biz'){
        ['b-tipo-negocio','b-cat-restaurante','b-cat-negocio',
         'b-operacion','b-entrega','b-cobertura','b-anios','b-tel-prefijo'
        ].forEach(function(sid){var s=document.getElementById(sid);if(s)s.selectedIndex=0;});
        if(typeof bTipoChange==='function')bTipoChange();
      }
    }
  }));
}
// Estado inicial en el historial (replaceState = no añade entrada extra al historial)
(function(){
  const ini=document.querySelector('.view.active');
  history.replaceState({viewId:ini?ini.id:'v-splash'},'','');
})();
// Botón Atrás del navegador y del celular
window.addEventListener('popstate',function(e){
  // REGLA UNIVERSAL #2: si hay un modal/overlay abierto, atrás lo cierra primero
  var ovs = ['dcf-ocupado-ov','dcf-cerrado-ov','dcf-toast-estado'];
  var cerrado = false;
  for (var i=0;i<ovs.length;i++){ var el=document.getElementById(ovs[i]); if(el){ el.remove(); cerrado=true; } }
  if (cerrado) { try{ history.pushState(e.state||{},'',''); }catch(_e){} return; }
  if(e.state&&e.state.viewId){_goCore(e.state.viewId,'left');}
});
// ===== REGLA UNIVERSAL DE REGRESO =====
// Todo botón ‹ regresa a la pantalla inmediata anterior (historial real),
// el mismo mecanismo del botón atrás del celular que ya funciona.
// Excepción: el Centro Operativo (vr-*) conserva su propio historial interno.
document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('.btn-back'):null;
  if(!b)return;
  if(b.closest('#vr-shell'))return;
    if(b.closest('#vn-shell'))return;
  var oc=(b.getAttribute('onclick')||'');
  if(oc.indexOf('navTo')!==-1||oc.indexOf('navBack')!==-1)return;
  ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();
  var cur=document.querySelector('.view.active');
  if(cur&&cur.id==='v-plaza-seguimiento'){
    try{
      localStorage.setItem('dcPlazaL14CartOpen','0');
      localStorage.setItem('dcPlazaL14OrderOpen','');
      localStorage.setItem('dcPlazaL14VaciarOpen','0');
      localStorage.setItem('dcPlazaQF42Tab',JSON.stringify('proceso'));
      window._misComprasPlazaTab='proceso';
    }catch(_plzBack){}
    try{history.replaceState({viewId:'v-mis-compras-plaza'},'','');}catch(_hst){}
    _goCore('v-mis-compras-plaza','left');
    setTimeout(function(){try{if(typeof window.dcPlazaLimpieza15Render==='function')window.dcPlazaLimpieza15Render();}catch(_r){}},60);
    return;
  }
  if(cur&&typeof window._dcConfirmarSalida==='function'&&!window._dcConfirmarSalida(cur.id))return;
  if(cur&&cur.id==='v-chat'&&typeof cerrarChat==='function'){try{cerrarChat();}catch(e){}}
  if(cur&&cur.id==='v-reg-vecino'){var _b=document.getElementById('btn-reg-vecino');if(_b){_b.textContent='Crear mi cuenta \u2192';_b.disabled=false;}}
  history.back();
},true);
// ===== REGLA UNIVERSAL: CAMBIOS SIN GUARDAR (toda la app) =====
// Cualquier captura en cualquier pantalla marca la pantalla como "con cambios".
// Al intentar REGRESAR de esa pantalla, se pide confirmación.
// Excepciones: búsquedas, chat y login (no son capturas que se "guarden").
window._dcDirtyV = null;
var _DC_DIRTY_VISTAS_EXCL = ['v-login','v-admin-login','v-busqueda','v-chat','v-prov-cmv','v-serv-det','v-membresia','v-agenda','v-agenda-reservas','v-reservar','v-mi-agenda'];
var _DC_DIRTY_IDS_EXCL = ['busqueda-input','chat-input','menu-search-inp'];
document.addEventListener('change', _dcDirtyUniv, true);
document.addEventListener('input',  _dcDirtyUniv, true);
function _dcDirtyUniv(ev){
  var t=ev.target; if(!t||!t.closest) return;
  if (t.getAttribute && t.getAttribute('data-no-dirty') === '1') return;
  if (t.id === 'dcf-cat-select' || t.id === 'plaza-cat-select') return;
  if(_DC_DIRTY_IDS_EXCL.indexOf(t.id)!==-1) return;
  var ph=(t.getAttribute&&t.getAttribute('placeholder'))||'';
  if(ph.toLowerCase().indexOf('buscar')!==-1) return;
  var v=t.closest('.view'); if(!v||!v.id) return;
  if(v.closest('#vr-shell')) return; // el Centro Operativo tiene su propio aviso
  if(_DC_DIRTY_VISTAS_EXCL.indexOf(v.id)!==-1) return;
  window._dcDirtyV=v.id;
}
window._dcConfirmarSalida=function(curId){
  if(!window._dcDirtyV||window._dcDirtyV!==curId) return true;
  var ok=window.confirm('\u26A0\uFE0F Tienes cambios sin guardar.\n\nPresiona CANCELAR para quedarte,\no ACEPTAR para salir sin guardar.');
  if(ok) window._dcDirtyV=null;
  return ok;
};

/* FAVORITOS */
function cargarFavoritos() {
  const lista = document.getElementById('favs-lista');
  if (!lista) return;

  // M2-H: usar clave por usuario (con retrocompatibilidad a fav_prov_*)
  let favs = [];
  // Nueva clave por usuario
  try {
    const uid = (window._fbAuth && window._fbAuth.currentUser && window._fbAuth.currentUser.uid) || '';
    const key = uid ? 'dcFavoritos_' + uid : 'dcFavoritos_t_' + (localStorage.getItem('dcuserTipo')||'u');
    favs = JSON.parse(localStorage.getItem(key) || '[]');
  } catch(e) { favs = []; }

  // Retrocompatibilidad: incluir favs guardados con el sistema anterior (fav_prov_*)
  const legacy = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('fav_prov_')) {
      try {
        const obj = JSON.parse(localStorage.getItem(k));
        if (obj && obj.nombre && !favs.some(f => f.id === (obj._id||obj.nombre))) {
          legacy.push({ id: obj._id||obj.nombre, tipo:'proveedor',
                        nombre: obj.nombre||'—', categoria: obj.categoria||'',
                        datos: obj, _legacyKey: k, fecha: 0 });
        }
      } catch(e) {}
    }
  }
  const all = favs.concat(legacy);

  if (all.length === 0) {
    lista.innerHTML = '<div style="padding:30px 14px;text-align:center;">'
      + '<div style="font-size:40px;margin-bottom:10px;">❤️</div>'
      + '<div style="font-size:14px;font-weight:700;color:#222;margin-bottom:6px;">Todavía no tienes favoritos</div>'
      + '<div style="font-size:12px;color:#888;line-height:1.5;">Toca 🤍 en cualquier restaurante, proveedor<br>o comercio para guardarlo aquí.</div>'
      + '</div>';
    return;
  }

  const ICONOS_PROV = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};

  // Config visual por tipo de módulo
  const TIPO_CFG = {
    restaurante: { bg:'#FFF8E6', color:'#c8940a', ic:'🍽️', lbl:'Restaurante', badgeBg:'#FFF0C0', badgeCol:'#9a6800' },
    negocio:     { bg:'#F3EAF9', color:'#7B3FA0', ic:'🏪', lbl:'Plaza Online', badgeBg:'#EDD6F9', badgeCol:'#5a2080' },
    proveedor:   { bg:'#E8F5EE', color:'#1a7a45', ic:'🔧', lbl:'Proveedor',    badgeBg:'#D4EDDA', badgeCol:'#155724' },
  };

  lista.innerHTML = '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;padding:12px 14px 6px;">'
    + all.length + ' guardado' + (all.length !== 1 ? 's' : '') + '</div>';

  all.forEach((f) => {
    // Detectar tipo: primero _dcModulo en datos (más confiable), luego tipo guardado
    let tipo = (f.datos && f.datos._dcModulo) || f.tipo || 'proveedor';
    const cfg  = TIPO_CFG[tipo] || TIPO_CFG.proveedor;
    const cat  = (f.categoria||'').toLowerCase();
    const ic   = tipo === 'proveedor' ? (ICONOS_PROV[cat] || '🔧') : cfg.ic;

    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:.5px solid #f5f5f5;cursor:pointer;';

    div.innerHTML =
      `<div style="width:46px;height:46px;border-radius:14px;background:${cfg.bg};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${ic}</div>`
      + `<div style="flex:1;min-width:0;">`
      + `<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:3px;">${window.dcEscHTML(f.nombre||'—')}</div>`
      + `<div style="display:flex;align-items:center;gap:5px;">`
      + `<span style="font-size:10px;font-weight:700;background:${cfg.badgeBg};color:${cfg.badgeCol};padding:2px 7px;border-radius:10px;">${cfg.lbl}</span>`
      + (f.categoria ? `<span style="font-size:10px;color:#aaa;">${window.dcEscHTML(f.categoria)}</span>` : '')
      + `</div></div>`;

    // Botón quitar
    const qBtn = document.createElement('button');
    qBtn.textContent = '❤️';
    qBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;flex-shrink:0;padding:4px;';
    qBtn.onclick = (e) => {
      e.stopPropagation();
      if (f._legacyKey) localStorage.removeItem(f._legacyKey);
      else window.toggleFav && window.toggleFav(f.datos || f);
      cargarFavoritos();
    };
    div.appendChild(qBtn);

    // Tap → abrir detalle según tipo
    div.onclick = () => {
      if (tipo === 'restaurante' && f.id) {
        if (window.dcFood_abrirRestFav) window.dcFood_abrirRestFav(f.datos || { _id: f.id });
        else { go('v-food','left'); setTimeout(function(){ window.dcFood_abrirRest && window.dcFood_abrirRest(f.id); }, 200); }
      } else if (tipo === 'negocio' && f.id) {
        go('v-plaza','left');
        setTimeout(function(){ window.plazaAbrirComercio && window.plazaAbrirComercio(f.id); }, 200);
      } else if (f.datos && window.abrirDetalleProveedor) {
        window.abrirDetalleProveedor(f.datos);
        setTimeout(function(){
          var back = document.querySelector('#v-serv-det #det-header button:not(#det-fav-btn)');
          if (back) back.onclick = function(){ go('v-favoritos','left'); setTimeout(cargarFavoritos,200); };
          var chatBack = document.querySelector('#v-chat .btn-back');
          if (chatBack) chatBack.onclick = function(){ go('v-serv-det','left'); cerrarChat&&cerrarChat(); };
        },80);
      } else {
        if (window.showToast) window.showToast(f.nombre + ' · Detalle no disponible todavía.');
      }
    };

    lista.appendChild(div);
  });
}

/* PASSWORD */
function togglePass(id,btn){
  const inp=document.getElementById(id);
  inp.type=inp.type==='password'?'text':'password';
  btn.textContent=inp.type==='password'?'👁️':'🙈';
}
function checkPass(id1,id2,sid){
  const p1=document.getElementById(id1);
  const p2=document.getElementById(id2);
  const s=document.getElementById(sid);
  if(!p2||!s)return;
  if(!p2.value){s.innerHTML='';return;}
  if(p1.value.length<6){s.innerHTML='<span style="color:#D63A2A;">🔐 Mínimo 6 números</span>';return;}
  if(p1.value===p2.value){s.innerHTML='<span style="color:#1FC26A;">✅ Contraseñas coinciden</span>';}
  else{s.innerHTML='<span style="color:#D63A2A;">❌ No coinciden</span>';}
}

/* ── VALIDACIONES VECINO ── */
const usedUsr=['juanc','maria42','dominio1','vecino99'];

// Sugerir usuario desde nombre
function _toTitleCase(str){
  return str.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
}
// ── Helpers Registro Proveedor ──────────────────────────────
const _P_OFICIOS = [
  {v:'plomero',t:'Plomero'},{v:'electricista',t:'Electricista'},
  {v:'jardinero',t:'Jardinero'},{v:'limpieza',t:'Limpieza del hogar'},
  {v:'albanileria',t:'Albañilería'},{v:'pintura',t:'Pintura'},
  {v:'ac',t:'Aire acondicionado'},{v:'cerrajero',t:'Cerrajero'},
  {v:'mascotas',t:'Cuidado de mascotas'},{v:'belleza',t:'Spa / Belleza a domicilio'},
  {v:'tecnologia',t:'Tecnología'},{v:'otro',t:'Otro servicio'}
];

function pNombreInput(el){
  const pos=el.selectionStart;
  el.value=el.value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  try{el.setSelectionRange(pos,pos);}catch(e){}
}

function pUsrInput(el){
  el.value=el.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
  const s=document.getElementById('p-usr-st');
  if(!s)return;
  if(!el.value){s.textContent='';return;}
  s.innerHTML='<span style="color:#1FC26A;">✅ '+el.value+' disponible</span>';
}

function pTelInput(el){
  if(!el)return;
  el.value=el.value.replace(/[^0-9]/g,'');
  const s=document.getElementById('p-tel-st');
  if(!s)return;
  const pref=(document.getElementById('p-tel-prefijo')?.value||'+52').replace('-CA','');
  const reglas={'+52':10,'+1':10,'+34':9,'+57':10};
  const msgs={'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá debe tener 10 dígitos','+34':'WhatsApp España debe tener 9 dígitos','+57':'WhatsApp Colombia debe tener 10 dígitos'};
  const n=el.value.length;
  if(!el.value){s.textContent='Solo dígitos, sin espacios ni guiones';s.style.color='#aaa';return;}
  const req=reglas[pref];
  if(req){
    if(n!==req){s.innerHTML='<span style="color:#D63A2A;">⚠️ '+msgs[pref]+'</span>';}
    else{s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';}
  } else {
    if(n<8||n>15){s.innerHTML='<span style="color:#D63A2A;">⚠️ Entre 8 y 15 dígitos</span>';}
    else{s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';}
  }
}

function pOficioChange(){
  const v1=document.getElementById('p-oficio1')?.value||'';
  const v2=document.getElementById('p-oficio2')?.value||'';
  const v3=document.getElementById('p-oficio3')?.value||'';
  const sel=[v1,v2,v3].filter(Boolean);

  // Show/hide oficio2 when oficio1 is selected
  const g2=document.getElementById('p-oficio2-group');
  const g3=document.getElementById('p-oficio3-group');
  if(g2) g2.style.display=v1?'block':'none';
  if(g3) g3.style.display=(v1&&v2)?'block':'none';

  // Rebuild oficio2 and oficio3 options excluding already-selected values
  function _rebuild(selEl, excludeVals){
    if(!selEl)return;
    const cur=selEl.value;
    selEl.innerHTML='<option value="">(ninguno)</option>';
    _P_OFICIOS.forEach(o=>{
      if(!excludeVals.includes(o.v)){
        const opt=document.createElement('option');
        opt.value=o.v;opt.textContent=o.t;
        if(o.v===cur)opt.selected=true;
        selEl.appendChild(opt);
      }
    });
  }
  _rebuild(document.getElementById('p-oficio2'),[v1]);
  _rebuild(document.getElementById('p-oficio3'),[v1,v2]);

  // Show/hide "otro" description field
  const otroGroup=document.getElementById('p-otro-group');
  if(otroGroup) otroGroup.style.display=(sel.includes('otro'))?'block':'none';
}

function pDescInput(el){
  const s=document.getElementById('p-desc-st');
  if(!s)return;
  const n=el.value.trim().length;
  if(!n){s.textContent='';return;}
  if(n<20){s.innerHTML='<span style="color:#D63A2A;">⚠️ Mínimo 20 caracteres ('+n+'/20)</span>';}
  else{s.innerHTML='<span style="color:#1FC26A;">✅ Descripción válida</span>';}
}

// ── Helpers Registro Transporte/Repartidor ───────────────
// ── Helpers Registro Negocio/Restaurante ─────────────
function bTipoChange(){
  const t=document.getElementById('b-tipo-negocio')?.value||'';
  const gr=document.getElementById('b-cat-restaurante-group');
  const gn=document.getElementById('b-cat-negocio-group');
  if(gr)gr.style.display=t==='restaurante'?'block':'none';
  if(gn)gn.style.display=t==='negocio'?'block':'none';
  // Limpiar la categoría del tipo contrario al cambiar
  if(t==='restaurante'){var cn=document.getElementById('b-cat-negocio');if(cn)cn.selectedIndex=0;
    var go2=document.getElementById('b-cat-otro-neg-group');if(go2)go2.style.display='none';
    var oi2=document.getElementById('b-cat-otro-neg');if(oi2)oi2.value='';}
  if(t==='negocio'){var cr=document.getElementById('b-cat-restaurante');if(cr)cr.selectedIndex=0;
    var go3=document.getElementById('b-cat-otro-rest-group');if(go3)go3.style.display='none';
    var oi3=document.getElementById('b-cat-otro-rest');if(oi3)oi3.value='';}
  if(!t){var cn2=document.getElementById('b-cat-negocio');if(cn2)cn2.selectedIndex=0;
         var cr2=document.getElementById('b-cat-restaurante');if(cr2)cr2.selectedIndex=0;
         var g1=document.getElementById('b-cat-otro-rest-group');if(g1)g1.style.display='none';
         var g2=document.getElementById('b-cat-otro-neg-group');if(g2)g2.style.display='none';}
}
function bCatChange(t){
  const suffix=t==='rest'?'rest':'neg';
  const sel=document.getElementById('b-cat-'+suffix==='rest'?'restaurante':'negocio');
  // simpler:
  const selId=t==='rest'?'b-cat-restaurante':'b-cat-negocio';
  const grpId='b-cat-otro-'+suffix+'-group';
  const inpId='b-cat-otro-'+suffix;
  const selEl=document.getElementById(selId);
  const grp=document.getElementById(grpId);
  const inp=document.getElementById(inpId);
  const isOtro=selEl&&(selEl.value==='otro_rest'||selEl.value==='otro_neg');
  if(grp)grp.style.display=isOtro?'block':'none';
  if(!isOtro&&inp)inp.value='';
}
function bNombreInput(el){
  const pos=el.selectionStart;
  el.value=el.value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  try{el.setSelectionRange(pos,pos);}catch(e){}
}
function bUsrInput(el){
  el.value=el.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
  const s=document.getElementById('b-usr-st');
  if(!s)return;
  if(!el.value){s.textContent='';return;}
  s.innerHTML='<span style="color:#1FC26A;">✅ '+el.value+' disponible</span>';
}
function bTelInput(el){
  if(!el)return;
  el.value=el.value.replace(/[^0-9]/g,'');
  const s=document.getElementById('b-tel-st');
  if(!s)return;
  const pref=(document.getElementById('b-tel-prefijo')?.value||'+52').replace('-CA','');
  const reglas={'+52':10,'+1':10,'+34':9,'+57':10};
  const msgs={'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá 10 dígitos','+34':'WhatsApp España 9 dígitos','+57':'WhatsApp Colombia 10 dígitos'};
  const n=el.value.length;
  if(!el.value){s.textContent='Solo dígitos, sin espacios ni guiones';s.style.color='#aaa';return;}
  const req=reglas[pref];
  if(req){
    if(n!==req)s.innerHTML='<span style="color:#D63A2A;">⚠️ '+msgs[pref]+'</span>';
    else s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
  }else{
    if(n<8||n>15)s.innerHTML='<span style="color:#D63A2A;">⚠️ Entre 8 y 15 dígitos</span>';
    else s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
  }
}
function bCorreoInput(el){
  const s=document.getElementById('b-correo-st');
  if(!s)return;
  const val=el.value.trim();
  if(!val){s.textContent='';return;}
  const err=vValidarCorreo(val);
  if(err){s.innerHTML='<span style="color:#D63A2A;">'+err+'</span>';return;}
  const dom=_detectarTypoCorreo(val);
  if(dom)s.innerHTML='<span style="color:#D63A2A;">¿Quisiste escribir @'+dom+'?</span>';
  else s.innerHTML='<span style="color:#1FC26A;">✅ Correo válido</span>';
}
function bDescInput(el){
  const s=document.getElementById('b-desc-st');
  if(!s)return;
  const n=el.value.trim().length;
  if(!n){s.textContent='';return;}
  if(n<20)s.innerHTML='<span style="color:#D63A2A;">⚠️ Mínimo 20 caracteres ('+n+'/20)</span>';
  else s.innerHTML='<span style="color:#1FC26A;">✅ Descripción válida</span>';
}

function rNombreInput(el){
  const pos=el.selectionStart;
  el.value=el.value.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  try{el.setSelectionRange(pos,pos);}catch(e){}
}
function rUsrInput(el){
  el.value=el.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
  const s=document.getElementById('r-usr-st');
  if(!s)return;
  if(!el.value){s.textContent='';return;}
  s.innerHTML='<span style="color:#1FC26A;">✅ '+el.value+' disponible</span>';
}
function rTelInput(el){
  if(!el)return;
  el.value=el.value.replace(/[^0-9]/g,'');
  const s=document.getElementById('r-tel-st');
  if(!s)return;
  const pref=(document.getElementById('r-tel-prefijo')?.value||'+52').replace('-CA','');
  const reglas={'+52':10,'+1':10,'+34':9,'+57':10};
  const msgs={'+52':'WhatsApp México debe tener 10 dígitos','+1':'WhatsApp USA/Canadá 10 dígitos','+34':'WhatsApp España 9 dígitos','+57':'WhatsApp Colombia 10 dígitos'};
  const n=el.value.length;
  if(!el.value){s.textContent='Solo dígitos, sin espacios ni guiones';s.style.color='#aaa';return;}
  const req=reglas[pref];
  if(req){
    if(n!==req)s.innerHTML='<span style="color:#D63A2A;">⚠️ '+msgs[pref]+'</span>';
    else s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
  }else{
    if(n<8||n>15)s.innerHTML='<span style="color:#D63A2A;">⚠️ Entre 8 y 15 dígitos</span>';
    else s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
  }
}
function rCorreoInput(el){
  const s=document.getElementById('r-correo-st');
  if(!s)return;
  const val=el.value.trim();
  if(!val){s.textContent='';return;}
  const err=vValidarCorreo(val);
  if(err){s.innerHTML='<span style="color:#D63A2A;">'+err+'</span>';return;}
  const dom=_detectarTypoCorreo(val);
  if(dom)s.innerHTML='<span style="color:#D63A2A;">¿Quisiste escribir @'+dom+'?</span>';
  else s.innerHTML='<span style="color:#1FC26A;">✅ Correo válido</span>';
}
function rDescInput(el){
  const s=document.getElementById('r-desc-st');
  if(!s)return;
  const n=el.value.trim().length;
  if(!n){s.textContent='';return;}
  if(n<20)s.innerHTML='<span style="color:#D63A2A;">⚠️ Mínimo 20 caracteres ('+n+'/20)</span>';
  else s.innerHTML='<span style="color:#1FC26A;">✅ Descripción válida</span>';
}

function vNombreInput(el){
  const pos=el.selectionStart;
  el.value=_toTitleCase(el.value);
  try{el.setSelectionRange(pos,pos);}catch(e){}
  sugerirUsr(el.value);
}
function sugerirUsr(v){
  const u=document.getElementById('v-usr');
  const s=document.getElementById('v-usr-st');
  if(!v){s.textContent='Escribe tu nombre arriba para sugerencia';s.style.color='#aaa';return;}
  const parts=v.trim().split(' ');
  const sug=(parts[0]+(parts[1]?parts[1][0]:'')+Math.floor(Math.random()*90+10)).toLowerCase();
  if(!u.value){u.placeholder='Ej. '+sug;s.innerHTML='💡 Sugerencia: <strong style="color:#1FC26A;">'+sug+'</strong>';s.style.color='#1FC26A';}
}

// Campo usuario: forzar minúsculas y caracteres válidos
function vUsrInput(el){
  const original=el.value;
  let v=el.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');
  el.value=v; // fuerza minúsculas y limpia caracteres no válidos
  const s=document.getElementById('v-usr-st');
  if(!v){s.textContent='Solo letras minúsculas, números, _ y -';s.style.color='#aaa';return;}
  const hint=original!==v?' (convertido a minúsculas)':'';
  if(usedUsr.includes(v)){s.innerHTML='❌ "'+v+'" ya existe — prueba otro';s.style.color='#D63A2A';}
  else{s.innerHTML='✅ "'+v+'" disponible'+hint;s.style.color='#1FC26A';}
}

// Validar correo — devuelve mensaje de error o ''
// Mapa de dominios mal escritos → corrección
const _TYPOS_CORREO = {
  // Gmail
  'gmil.com':'gmail.com','gmal.com':'gmail.com','gamil.com':'gmail.com',
  'gmaill.com':'gmail.com','gmai.com':'gmail.com','gmali.com':'gmail.com',
  'gml.com':'gmail.com','gimail.com':'gmail.com','gmail.con':'gmail.com',
  'gmail.cmo':'gmail.com','gmail.co':'gmail.com',
  // Hotmail
  'hotmial.com':'hotmail.com','hotmal.com':'hotmail.com','homail.com':'hotmail.com',
  'hotmail.con':'hotmail.com','hotmail.cmo':'hotmail.com','hotamail.com':'hotmail.com',
  // Outlook
  'outlok.com':'outlook.com','outloook.com':'outlook.com','otlook.com':'outlook.com',
  'outllok.com':'outlook.com','outlook.con':'outlook.com','outook.com':'outlook.com',
  // Live
  'live.con':'live.com','live.cmo':'live.com','lve.com':'live.com',
  // iCloud
  'icloud.con':'icloud.com','icloud.cmo':'icloud.com','icould.com':'icloud.com',
  // Yahoo
  'yahoo.con':'yahoo.com','yahooo.com':'yahoo.com','yhoo.com':'yahoo.com',
  'yaho.com':'yahoo.com','yahoo.cmo':'yahoo.com'
};

// Devuelve dominio corregido si hay typo, o null si el dominio es válido/desconocido
function _detectarTypoCorreo(correo){
  if(!correo||!correo.includes('@')) return null;
  const dom=(correo.split('@')[1]||'').toLowerCase();
  return _TYPOS_CORREO[dom]||null;
}

function vValidarCorreo(correo){
  if(!correo) return '⚠️ Escribe tu correo electrónico';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo))
    return '📧 Correo inválido — verifica que tenga @ y dominio (ej. .com)';
  return ''; // typos se manejan por separado con modal
}

// Modal de sugerencia de correo
window._mostrarSugerenciaCorreo = function(correoOriginal, dominioCorregido){
  const partes = correoOriginal.split('@');
  const correoSugerido = partes[0] + '@' + dominioCorregido;
  const ya = document.getElementById('modal-correo-typo');
  const html =
    '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">⚠️ Revisa tu correo</div>'+
    '<div style="font-size:13px;color:#555;margin-bottom:6px;">Escribiste:</div>'+
    '<div style="font-size:13px;font-weight:700;color:#D63A2A;margin-bottom:12px;">'+correoOriginal+'</div>'+
    '<div style="font-size:13px;color:#555;margin-bottom:6px;">¿Quisiste decir?</div>'+
    '<div style="font-size:13px;font-weight:700;color:#1FC26A;margin-bottom:20px;">'+correoSugerido+'</div>'+
    '<button onclick="window._corregirCorreo(\''+correoSugerido+'\')" '+
    'style="width:100%;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:8px;">Corregir</button>'+
    '<button onclick="window._continuarConCorreo()" '+
    'style="width:100%;background:#f0f0f0;color:#333;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:10px;">Continuar con mi correo</button>'+
    '<div style="font-size:11px;color:#aaa;text-align:center;line-height:1.5;">Solo es una sugerencia. Algunos dominios personalizados pueden ser válidos.</div>';
  if(ya){ya.querySelector('.modal-correo-body').innerHTML=html;ya.style.display='flex';return;}
  const m=document.createElement('div');
  m.id='modal-correo-typo';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  m.innerHTML='<div class="modal-correo-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'+html+'</div>';
  document.body.appendChild(m);
};

window._corregirCorreo = function(correoNuevo){
  const el=document.getElementById('v-correo');
  if(el){
    el.value=correoNuevo;
    vCorreoInput(el);
  }
  const m=document.getElementById('modal-correo-typo');
  if(m)m.style.display='none';
};

// Continuar con el correo original sin corregir
window._omitirTypoCorreo = false;
window._continuarConCorreo = function(){
  const m=document.getElementById('modal-correo-typo');
  if(m)m.style.display='none';
  window._omitirTypoCorreo = true;
  window.registrarVecino && window.registrarVecino();
  window._omitirTypoCorreo = false;
};

// Feedback en tiempo real para correo
function vCorreoInput(el){
  const s=document.getElementById('v-correo-st');
  if(!s)return;
  const val=el.value.trim();
  if(!val){s.textContent='';return;}
  const err=vValidarCorreo(val);
  if(err){s.innerHTML='<span style="color:#D63A2A;">'+err+'</span>';return;}
  const dom=_detectarTypoCorreo(val);
  if(dom){s.innerHTML='<span style="color:#D63A2A;">📧 ¿Quisiste escribir @'+dom+'?</span>';}
  else{s.innerHTML='<span style="color:#1FC26A;">✅ Correo válido</span>';}
}

// Limpiar y validar teléfono en tiempo real
function vTelInput(el){
  el.value=el.value.replace(/[^0-9]/g,'');
  const s=document.getElementById('v-tel-st');
  if(!s)return;
  const n=el.value.length;
  if(!el.value){s.textContent='Solo dígitos, sin espacios ni guiones';s.style.color='#aaa';return;}
  // Leer prefijo y aplicar misma regla que registrarVecino
  const pref=(document.getElementById('v-tel-prefijo')?.value||'+52').replace('-CA','');
  const reglas={'+52':10,'+1':10,'+34':9,'+57':10};
  const msgs={
    '+52':'WhatsApp México debe tener 10 dígitos',
    '+1':'WhatsApp USA/Canadá debe tener 10 dígitos',
    '+34':'WhatsApp España debe tener 9 dígitos',
    '+57':'WhatsApp Colombia debe tener 10 dígitos'
  };
  const requerido=reglas[pref];
  if(requerido){
    if(n!==requerido){
      s.innerHTML='<span style="color:#D63A2A;">⚠️ '+msgs[pref]+'</span>';
    } else {
      s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
    }
  } else {
    if(n<8||n>15){
      s.innerHTML='<span style="color:#D63A2A;">⚠️ Entre 8 y 15 dígitos</span>';
    } else {
      s.innerHTML='<span style="color:#1FC26A;">✅ Número válido</span>';
    }
  }
}

// Modal simple de Términos y Condiciones
function abrirTerminos(){
  const ya=document.getElementById('modal-terminos');
  if(ya){ya.style.display='flex';return;}
  const m=document.createElement('div');
  m.id='modal-terminos';
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  m.innerHTML=`<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;">
    <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:16px;">📄 Términos y Condiciones</div>
    <div style="font-size:13px;color:#444;line-height:1.7;">
      <strong>1. Uso de la app</strong><br>
      Dominio Cumbres AppServis es una plataforma de publicidad y marketplace local. No garantiza contrataciones ni resultados de servicios.<br><br>
      <strong>2. Privacidad</strong><br>
      Tu dirección y datos personales son privados. Solo se comparten con proveedores cuando tú lo solicitas expresamente.<br><br>
      <strong>3. Responsabilidad</strong><br>
      La app conecta vecinos con proveedores. Cualquier acuerdo económico es entre las partes. AppServis no es responsable de la calidad del servicio.<br><br>
      <strong>4. Conducta</strong><br>
      Toda negociación debe realizarse dentro del chat de la app. Conducta inapropiada resulta en suspensión de cuenta.<br><br>
      <strong>5. Datos</strong><br>
      Al registrarte autorizas el uso de tu correo para notificaciones relacionadas con la app únicamente.
    </div>
    <button onclick="document.getElementById('modal-terminos').style.display='none'" style="margin-top:20px;width:100%;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Entendido</button>
  </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',function(e){if(e.target===m)m.style.display='none';});
}

/* ZONA / FRACCIONAMIENTO */
const fracs={
  'Dominio Cumbres':['Alboradas','Alinka','Altaira','Altavia','Atera','Aura','Ayucca','Cerradas Lumina','Cumbres Altta','Cumbres Andara','Cumbres Ferrara','Cumbres La Joya de la Montaña','Cumbres La Rioja','El Cielo','La Montaña','Los Olivos','Lux','Mirador','Montencinos','Montessa','Monticello','Montserrat','Murano','Novelia','Paloblanco','PietrAlta','Pietralta Castelo','Porto Cumbres','Privalia Cumbres','Provenza Privada Terra','Provenza Sector Aqua','Provenza Sector Britania','Provenza Sector Vento','Ravello','Rincón De La Sierra','Rincón Del Obispado','Santoral','Santoral II','Santoral III','Solana','Tivoli','Toscana','Vernazza'],
  'La Reserva':[],'Valle de Cumbres':[],'Península':[]
};
function onZona(z){
  const fg=document.getElementById('frac-group');
  const fs=document.getElementById('frac-sel');
  const ab=document.getElementById('agregar-box');
  const cg=document.getElementById('calle-group');
  const fh=document.getElementById('frac-hint');
  ab.classList.remove('show');
  cg.style.display='none';
  // Ocultar y limpiar número
  const ng=document.getElementById('numero-group');
  if(ng)ng.style.display='none';
  // Limpiar calle y número
  const ci=document.getElementById('v-calle');
  if(ci)ci.value='';
  const ni=document.getElementById('v-numero');
  if(ni)ni.value='';
  // Limpiar fraccionamiento nuevo
  const fn=document.getElementById('frac-nuevo-inp');
  if(fn)fn.value='';
  // Resetear fraccionamiento select
  if(fs){fs.selectedIndex=0;}
  if(!z){fg.style.display='none';return;}
  fg.style.display='block';
  fs.innerHTML='<option value="">Selecciona tu fraccionamiento...</option>';
  const listaBase=fracs[z]||[];
  // Cargar también fraccionamientos registrados en Firestore para esta zona
  async function _poblarFracs(extra){
    const todos=[...new Set([...listaBase,...extra])].sort();
    fs.innerHTML='<option value="">Selecciona tu fraccionamiento...</option>';
    todos.forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;fs.appendChild(o);});
    const add=document.createElement('option');add.value='agregar';add.textContent='+ Agregar mi fraccionamiento';fs.appendChild(add);
    fh.textContent=todos.length>0?'🗺️ ¿No aparece el tuyo? Selecciona "+ Agregar"':'✍️ Selecciona "+ Agregar" para registrar el tuyo';
  }
  _poblarFracs([]);
  if(window._fbDb){
    import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js')
      .then(({getDocs,collection,query,where})=>{
        return getDocs(query(collection(window._fbDb,'usuarios'),where('zona','==',z)));
      }).then(snap=>{
        const extras=[];
        snap.forEach(d=>{const f=d.data().fraccionamiento;if(f&&f!=='agregar')extras.push(f);});
        _poblarFracs(extras);
      }).catch(()=>{});
  }
}
function onFrac(v){
  const ab=document.getElementById('agregar-box');
  const cg=document.getElementById('calle-group');
  const ng=document.getElementById('numero-group');
  const ci=document.getElementById('v-calle');
  const ni=document.getElementById('v-numero');
  if(v==='agregar'){
    ab.classList.add('show');
    if(cg)cg.style.display='block';
    if(ng)ng.style.display='block';
    if(ci)ci.value='';
    if(ni)ni.value='';
  } else if(v){
    ab.classList.remove('show');
    if(cg)cg.style.display='block';
    if(ng)ng.style.display='block';
    if(ci)ci.value='';
    if(ni)ni.value='';
  } else {
    ab.classList.remove('show');
    if(cg)cg.style.display='none';
    if(ng)ng.style.display='none';
    if(ci)ci.value='';
    if(ni)ni.value='';
  }
}

/* CATEGORÍA NEGOCIO */
function showCatHint(sel){
  const h=document.getElementById('cat-hint');
  if(sel.value==='food'){h.innerHTML='🍽️ Tu negocio aparecerá en <strong>Dominio Food</strong>';h.style.color='#c8940a';}
  else if(sel.value==='plaza'){h.innerHTML='🏪 Tu negocio aparecerá en <strong>Plaza Online</strong>';h.style.color='#1A7AB5';}
  else{h.textContent='';}
}

/* CÓDIGO AUTO-AVANCE */
document.querySelectorAll('.code-inp').forEach((inp,i,arr)=>{
  inp.addEventListener('input',()=>{if(inp.value&&arr[i+1])arr[i+1].focus();});
});


function setSvc(el){document.querySelectorAll('.svc-tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');}
function selRider(el,price,name,time){
  document.querySelectorAll('.rider-chip').forEach(r=>r.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('rider-price').textContent='$'+price;
  document.getElementById('rider-lbl').textContent=name+' · '+time+' · Moto';
}
function setCatS(btn){
  document.querySelectorAll('#cat-grid-servicios .cat-ic').forEach(c=>c.classList.remove('on'));
  document.querySelectorAll('#cat-grid-servicios .cat-nm').forEach(c=>c.classList.remove('on'));
  btn.querySelector('.cat-ic').classList.add('on');
  btn.querySelector('.cat-nm').classList.add('on');
  const cat = btn.dataset.oficio || btn.querySelector('.cat-nm').textContent.trim().toLowerCase();
  if(window.cargarProveedores) window.cargarProveedores(cat);
}
function setStars(n){
  const stars=document.querySelectorAll('#ride-stars .rate-star');
  stars.forEach((s,i)=>s.textContent=i<n?'⭐':'☆');
}


/* go() → ver función maestra arriba */
function switchTab(i,btn){
  document.querySelectorAll('#informa-tabs .tab-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  ['tab-noticias','tab-proyectos','tab-reportes'].forEach((t,j)=>{
    const el=document.getElementById(t);
    el.classList.toggle('show',i===j);
    el.style.display=i===j?'flex':'none';
    if(i===j)el.style.flexDirection='column';
  });
}
function showSOS(){const o=document.getElementById('sos-overlay');o.style.display='flex';}
function hideSOS(){const o=document.getElementById('sos-overlay');o.style.display='none';}
document.querySelectorAll('.voto-btn').forEach(b=>{b.addEventListener('click',e=>{e.stopPropagation();b.classList.toggle('on');});});


/* go() → ver función maestra arriba */
function showAdminTab(i,btn){
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('on'));
  if(btn)btn.classList.add('on');
  document.querySelectorAll('.a-sec').forEach((s,j)=>{
    s.classList.toggle('show',i===j);
    s.style.display=i===j?'block':'none';
  });
  document.querySelectorAll('.ani').forEach((a,j)=>{
    a.classList.toggle('on',i===j);
    const lb=a.querySelector('.ani-lb');
    lb.style.color=i===j?'var(--yellow)':'rgba(255,255,255,.3)';
  });
}

  // Restore username on load
  (function(){
    const u = localStorage.getItem('dcuser');
    if(u) document.querySelectorAll('.user-name-display').forEach(el=>el.textContent=u);
    // Show loading screen on startup then show splash
    const loadingEl = document.getElementById('v-loading');
    const splashEl  = document.getElementById('v-splash');
    if(loadingEl && splashEl) {
      splashEl.classList.remove('active');
      loadingEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0C1A10;z-index:999;';
      setTimeout(() => {
        loadingEl.style.display = 'none';
        splashEl.classList.add('active');
      }, 1600);
    }

    // Auto-avance en inputs de código
    document.querySelectorAll('.code-inp').forEach((inp, i, arr) => {
      inp.addEventListener('input', () => {
        if (inp.value.length === 1 && i < arr.length - 1) arr[i+1].focus();
      });
    });

    // Si el proveedor ya tenía sesión activa, activar alertas al cargar
    const tipoGuardado = localStorage.getItem('dcuserTipo') || 'vecino';
    if(tipoGuardado !== 'vecino') {
      setTimeout(() => {
        if('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        window.verificarChatsProveedor && window.verificarChatsProveedor();
        window.activarNotificacionesProveedor && window.activarNotificacionesProveedor();
      }, 2500);
    }
  })();

  // ─── PANEL ADMIN ────────────────────────────────────────
  const ADMIN_USERS = {
    'DominioCumbres2026': { pass: 'appl1225', rol: 'maestro', fbEmail: 'appservis2@gmail.com' }
    // Para agregar más admins:
    // 'usuarioJunior':   { pass: 'su_pass', rol: 'junior' }
    // 'usuarioPremium':  { pass: 'su_pass', rol: 'premium' }
  };

  // Navigation helper for admin sections
  window.goAdminSec = function(sec) {
    const map = {
      solicitudes: 'v-admin-solicitudes',
      usuarios: 'v-admin-usuarios',
      admins: 'v-admin-admins',
      monetizacion: 'v-admin-monetizacion',
      analytics: 'v-admin-analytics',
      publicaciones: 'v-admin-publicaciones',
      alertas: 'v-admin-alertas',
      config: 'v-admin-config'
    };
    if(map[sec]) {
      showLoading();
      setTimeout(() => {
        hideLoading();
        go(map[sec], 'right');
        if(sec === 'solicitudes') { setTimeout(()=>cargarSolicitudes(), 300); }
        if(sec === 'usuarios') { admuShow('admu-home'); window.admuMigrarVecinosPendientes&&window.admuMigrarVecinosPendientes(); window.admuCargarContadores&&window.admuCargarContadores(); }
        if(sec === 'admins') { renderAdminsList(); }
        if(sec === 'analytics') { cargarAnalytics(); }
      }, 800);
    }
  };

  // Loading screen helpers
  window.showLoading = function() {
    const v = document.getElementById('v-loading');
    if(v) { v.style.zIndex='999'; v.classList.add('active'); }
  };
  window.hideLoading = function() {
    const v = document.getElementById('v-loading');
    if(v) { v.classList.remove('active'); v.style.zIndex=''; }
  };

  // Analytics loader
  window.cargarAnalytics = async function() {
    const lista = document.getElementById('analytics-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si61">Cargando... ⏳</div>';
    try {
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(window._fbDb, 'usuarios'));
      let vecinos=0, proveedores=0, negocios=0, pendientes=0;
      snap.forEach(d => {
        const u = d.data();
        if(u.tipo==='vecino') vecinos++;
        else if(u.tipo==='proveedor') proveedores++;
        else if(u.tipo==='negocio'||u.tipo==='restaurante') negocios++;
        if(u.estado==='pendiente_revision') pendientes++;
      });
      document.getElementById('stat-vecinos').textContent = vecinos;
      document.getElementById('stat-proveedores').textContent = proveedores;
      document.getElementById('stat-negocios').textContent = negocios;
      document.getElementById('stat-pendientes-count').textContent = pendientes;
      lista.innerHTML = '<div style="font-size:12px;color:var(--white-50);text-align:center;padding:16px;">✅ Datos cargados desde Firebase</div>';
      // Update notif badge
      if(pendientes > 0) {
        const nb = document.getElementById('notif-solicitudes');
        if(nb) { nb.textContent = pendientes; nb.style.display='flex'; }
      }
    } catch(e) {
      lista.innerHTML = '<div style="color:#D63A2A;font-size:12px;padding:10px;">Error: '+e.message+'</div>';
    }
  };

  window.entrarAdmin = async function() {
    const usr = document.getElementById('admin-usr-input').value.trim();
    const p   = document.getElementById('admin-pass-input').value;
    const err = document.getElementById('admin-pass-err');
    const cuenta = ADMIN_USERS[usr];
    if (!cuenta) {
      err.style.display = 'block';
      err.textContent = '❌ Usuario o contraseña incorrectos';
      return;
    }
    err.style.display = 'none';
    try {
      const { signInWithEmailAndPassword, signOut } = await import(
        "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js"
      );
      await signInWithEmailAndPassword(window._fbAuth, cuenta.fbEmail, p);
      const uid = window._fbAuth.currentUser.uid;
      const { getDoc, doc } = await import(
        "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js"
      );
      const snap = await getDoc(doc(window._fbDb, 'usuarios', uid));
      const data = snap.exists() ? snap.data() : {};
      const esAdmin = data.esAdmin === true || data.rol === 'maestro' || data.rol === 'admin';
      if (!esAdmin) {
        await signOut(window._fbAuth);
        err.style.display = 'block';
        err.textContent = '⛔ Esta cuenta no tiene permisos de administrador';
        return;
      }
    } catch(fbErr) {
      err.style.display = 'block';
      err.textContent = '❌ Contraseña incorrecta o error de autenticación';
      return;
    }
    window._adminRol = cuenta.rol;
    window._adminUsr = usr;
    // Show loading then go to panel
    showLoading();
    setTimeout(() => {
      hideLoading();
      go('v-admin-panel', 'right');
      // Sync visual tab + data using same path as manual click
      const _fbtnP = document.getElementById('fbtn-pendientes');
      if (_fbtnP && window.setFiltroMain) {
        window.setFiltroMain(_fbtnP, 'pendientes');
      } else {
        window._filtroMain = 'pendientes';
        window._filtroSub = 'todos';
        cargarSolicitudes();
      }
      // Update role display
      const rolEl = document.getElementById('admin-rol-display');
      if(rolEl) rolEl.textContent = 'Admin ' + (cuenta.rol === 'maestro' ? 'Master' : cuenta.rol.charAt(0).toUpperCase() + cuenta.rol.slice(1));
      // Hide admins card for non-maestro
      if(cuenta.rol !== 'maestro') {
        const cardAdmins = document.getElementById('card-admins');
        if(cardAdmins) cardAdmins.style.display='none';
      }
      // Load pending count
      cargarAnalytics().catch(()=>{});
    }, 1000);
  };

  window.cerrarSesionAdmin = async function() {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      await signOut(window._fbAuth);
    } catch(_) {}
    window._adminRol = null;
    window._adminUsr = null;
    document.getElementById('admin-usr-input').value = '';
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-pass-err').style.display = 'none';
    go('v-splash', 'left');
  };

  window.switchAdminTab = function(tab) {
    // Fix botones — solo uno activo a la vez
    const btnP = document.getElementById('tab-pendientes-btn');
    const btnT = document.getElementById('tab-todos-btn');
    if(btnP && btnT) {
      btnP.style.background = tab==='pendientes' ? '#1FC26A' : '#162A1D';
      btnP.style.color = tab==='pendientes' ? '#000' : '#aaa';
      btnT.style.background = tab==='todos' ? '#1FC26A' : '#162A1D';
      btnT.style.color = tab==='todos' ? '#000' : '#aaa';
    }
    // Legacy compatibility - redirect to new sections
    if(tab === 'pendientes') { cargarSolicitudes(); return; }
    if(tab === 'todos') { verTodosUsuarios(); return; }
    if(tab === 'admins') { goAdminSec('admins'); return; }
    const tabs = ['pendientes','todos','admins'];
    tabs.forEach(t => {
      const btn = document.getElementById('tab-'+t+'-btn');
      if(btn){ btn.style.background = t===tab ? '#1FC26A' : '#162A1D'; btn.style.color = t===tab ? '#000' : '#aaa'; }
    });
    document.getElementById('admin-lista').style.display = tab !== 'admins' ? 'block' : 'none';
    document.getElementById('admin-admins-sec').style.display = tab === 'admins' ? 'block' : 'none';
    if(tab === 'pendientes') cargarSolicitudes();
    if(tab === 'todos') verTodosUsuarios();
    if(tab === 'admins') renderAdminsList();
    // Solo maestro puede ver tab de admins
    if(tab === 'admins' && window._adminRol !== 'maestro') {
      document.getElementById('admin-admins-sec').innerHTML = '<div style="text-align:center;padding:30px;color:#D63A2A;font-size:13px;">⛔ Solo el administrador maestro puede gestionar admins.</div>';
    }
  };

  window.renderAdminsList = function() {
    const lista = document.getElementById('admin-admins-lista');
    lista.innerHTML = '';
    Object.entries(ADMIN_USERS).forEach(([usr, data]) => {
      const rolColor = data.rol==='maestro' ? '#F5C518' : data.rol==='premium' ? '#1FC26A' : '#64B5F6';
      const div = document.createElement('div');
      div.style.cssText = 'background:#162A1D;border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid #1A3A25;display:flex;justify-content:space-between;align-items:center;';
      div.innerHTML = `
        <div>
          <div class="si53">@${usr}</div>
          <div class="si10">Rol: <span style="color:${rolColor};font-weight:700;">${data.rol.toUpperCase()}</span></div>
        </div>
        ${data.rol !== 'maestro' ? `<button onclick="eliminarAdmin('${usr}')" style="background:#D63A2A20;border:1px solid #D63A2A60;color:#D63A2A;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">🗑 Eliminar</button>` : '<span style="font-size:10px;color:#555;">cuenta maestra</span>'}
      `;
      lista.appendChild(div);
    });
  };

  window.agregarAdmin = function() {
    const usr  = document.getElementById('new-admin-usr').value.trim();
    const pass = document.getElementById('new-admin-pass').value;
    const rol  = document.getElementById('new-admin-rol').value;
    const err  = document.getElementById('new-admin-err');
    if (!usr || !pass) { err.style.display='block'; err.textContent='⚠️ Llena usuario y contraseña'; return; }
    if (pass.length < 6) { err.style.display='block'; err.textContent='🔐 La contraseña debe tener mínimo 6 caracteres'; return; }
    if (ADMIN_USERS[usr]) { err.style.display='block'; err.textContent='❌ Ese usuario ya existe'; return; }
    err.style.display = 'none';
    ADMIN_USERS[usr] = { pass, rol };
    document.getElementById('new-admin-usr').value = '';
    document.getElementById('new-admin-pass').value = '';
    renderAdminsList();
    const toast = document.getElementById('admin-toast');
    toast.textContent = `✅ Admin @${usr} (${rol}) agregado`;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
  };

  window.eliminarAdmin = function(usr) {
    window._dcConfirmar('¿Eliminar al admin @' + usr + '?', function() {
      delete ADMIN_USERS[usr];
      renderAdminsList();
      const toast = document.getElementById('admin-toast');
      toast.textContent = '🗑 Admin @' + usr + ' eliminado';
      toast.style.display = 'block';
      setTimeout(() => toast.style.display = 'none', 3000);
    });
  };

  // ─── ADMINISTRACIÓN DE USUARIOS ──────────────────────────
  window._admuTipo = null;       // tipo activo: 'vecino','restaurante','negocio','servicio','ride','admin'
  window._admuDatos = [];        // datos cargados
  window._admuModalUid = null;   // uid en modal
  window._admuNavStack = [];     // para botón "volver"

  const ADMU_ESTADOS = ['activo','pendiente_revision','aprobado_pendiente_pago','falta_pago_mensualidad','pausado','suspendido','rechazado'];
  const ADMU_ESTADO_COLOR = { activo:'#1FC26A', pendiente_revision:'#F5C518', aprobado_pendiente_pago:'#F5C518', falta_pago_mensualidad:'#F5A623', pausado:'#F5A623', suspendido:'#D63A2A', rechazado:'#D63A2A' };
  const ADMU_ESTADO_LABEL = { activo:'ACTIVO', pendiente_revision:'EN REVISIÓN', aprobado_pendiente_pago:'PEND. PAGO', falta_pago_mensualidad:'FALTA PAGO', pausado:'PAUSADO', suspendido:'SUSPENDIDO', rechazado:'RECHAZADO' };

  function admuShow(id) {
    ['admu-home','admu-sub-prov','admu-lista-sec','admu-form-admin'].forEach(function(s){ var el=document.getElementById(s); if(el) el.style.display='none'; });
    var target = document.getElementById(id);
    if(target) target.style.display = 'block';
  }

  window.admuTabProv = function(tipo) {
    ['todos','restaurante','negocio','servicio','ride'].forEach(function(t){
      var btn = document.getElementById('admu-tab-'+t);
      if(btn){
        btn.style.borderBottomColor = t===tipo?'#1FC26A':'transparent';
        var span = btn.querySelector('span:last-child');
        if(span) span.style.color = t===tipo?'#1FC26A':'rgba(255,255,255,.4)';
      }
    });
    var s = document.getElementById('admu-search-prov'); if(s) s.value='';
    admuCargar(tipo);
  };

  window.admuSelTipo = function(tipo) {
    window._admuNavStack = [];
    if(tipo === 'proveedor') {
      window._admuNavStack.push('admu-home');
      admuShow('admu-sub-prov');
      window.admuTabProv('restaurante');
    } else if(tipo === 'admin') {
      window._admuTipo = 'admin';
      window._admuNavStack.push('admu-home');
      admuCargarAdmins();
    } else {
      window._admuTipo = tipo;
      window._admuNavStack.push('admu-home');
      admuCargar(tipo);
    }
  };

  var ADMU_TIPOS_PROV = ['todos','restaurante','negocio','servicio','ride'];

  window.admuCargar = async function(tipo) {
    window._admuTipo = tipo;
    var esProv = ADMU_TIPOS_PROV.indexOf(tipo) >= 0;
    if(!window._admuNavStack.length) window._admuNavStack.push(esProv ? 'admu-sub-prov' : 'admu-home');
    if(!esProv) {
      admuShow('admu-lista-sec');
      var titulos = { vecino:'Vecinos' };
      var t = document.getElementById('admu-lista-titulo');
      if(t) t.textContent = titulos[tipo] || tipo;
      var addBtn = document.getElementById('admu-add-admin-btn');
      if(addBtn) addBtn.style.display = 'none';
      var search = document.getElementById('admu-search');
      if(search) search.value = '';
    }
    var listaId = esProv ? 'admu-lista-prov' : 'admu-lista';
    var lista = document.getElementById(listaId);
    if(lista) lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--white-50);font-size:13px;">Cargando... ⏳</div>';
    try {
      await admuEnsureAuth();
      var { getDocs, collection, query, where, or } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      var q;
      if(tipo === 'servicio') {
        q = query(collection(window._fbDb,'usuarios'), where('tipo','==','proveedor'));
      } else if(tipo === 'todos') {
        q = query(collection(window._fbDb,'usuarios'), where('tipo','in',['restaurante','negocio','proveedor']));
      } else {
        q = query(collection(window._fbDb,'usuarios'), where('tipo','==',tipo));
      }
      var snap = await getDocs(q);
      window._admuDatos = [];
      snap.forEach(function(d){ window._admuDatos.push(Object.assign({uid:d.id}, d.data())); });
      if(ADMU_TIPOS_PROV.indexOf(tipo) >= 0) admuRenderListaProv(window._admuDatos);
      else admuRenderLista(window._admuDatos);
    } catch(e) {
      if(lista) lista.innerHTML = '<div style="color:#D63A2A;font-size:12px;padding:10px;">Error: '+e.message+'</div>';
    }
  };

  function admuCargarAdmins() {
    admuShow('admu-lista-sec');
    var t = document.getElementById('admu-lista-titulo');
    if(t) t.textContent = 'Administradores';
    var addBtn = document.getElementById('admu-add-admin-btn');
    if(addBtn) addBtn.style.display = 'block';
    var search = document.getElementById('admu-search');
    if(search) search.value = '';
    // Build datos from ADMIN_USERS
    window._admuDatos = Object.entries(ADMIN_USERS).map(function(e){ return { uid: e[0], nombre: '@'+e[0], rol: e[1].rol, tipo:'admin' }; });
    admuRenderListaAdmins(window._admuDatos);
  }

  function admuRenderListaProv(datos) {
    var lista = document.getElementById('admu-lista-prov');
    if(!lista) return;
    if(!datos.length) { lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--white-50);font-size:13px;">Sin resultados</div>'; return; }
    var total = datos.length;
    lista.innerHTML = '<div style="font-size:11px;color:var(--white-40);padding:0 2px 10px 2px;">Mostrando '+total+' '+( window._admuTipo||'usuario')+(total!==1?'s':'')+' en total</div>'
      + '<div style="border-radius:14px;overflow:hidden;border:.5px solid var(--card-border);">'
      + datos.map(function(u, i){
        var estado = u.estado || 'pendiente_revision';
        var color = ADMU_ESTADO_COLOR[estado] || '#aaa';
        var label = ADMU_ESTADO_LABEL[estado] || estado.toUpperCase();
        var foto = u.foto||u.logoUrl||u.imagen||'';
        var fotoHtml = foto
          ? '<img src="'+foto+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
          : '<div style="width:44px;height:44px;border-radius:50%;background:#1A2A20;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🏪</div>';
        var borde = i < datos.length-1 ? 'border-bottom:1px solid rgba(255,255,255,.07);' : '';
        return '<div style="background:var(--card-dark);'+borde+'padding:13px 14px;display:flex;align-items:center;gap:12px;">'
          + fotoHtml
          +'<div onclick="admuAbrirModal(\''+u.uid+'\')" style="flex:1;cursor:pointer;min-width:0;">'
          +'<div style="font-size:14px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(u.nombre||u.negocio||u.email||u.uid)+'</div>'
          +'</div>'
          +'<button onclick="admuAbrirBottomEstado(\''+u.uid+'\')" style="display:flex;align-items:center;gap:5px;background:'+color+'18;border:1px solid '+color+'55;border-radius:20px;padding:5px 10px;cursor:pointer;flex-shrink:0;">'
          +'<div style="width:7px;height:7px;border-radius:50%;background:'+color+';flex-shrink:0;"></div>'
          +'<span style="font-size:11px;font-weight:800;color:'+color+';letter-spacing:.4px;">'+label+'</span>'
          +'<span style="font-size:9px;color:'+color+';opacity:.7;">▼</span>'
          +'</button>'
          +'<button onclick="admuEliminarUsuario(\''+u.uid+'\',\''+encodeURIComponent(u.nombre||u.email||u.uid)+'\')" style="background:#D63A2A18;border:1px solid #D63A2A50;border-radius:8px;padding:7px 9px;font-size:15px;color:#D63A2A;cursor:pointer;flex-shrink:0;">🗑</button>'
          +'</div>';
      }).join('')
      + '</div>';
  }

  var ADMU_ESTADO_DESC = {
    activo: 'El usuario puede operar normalmente',
    pendiente_revision: 'Cuenta en revisión o esperando activación',
    aprobado_pendiente_pago: 'Aprobado, pendiente de completar pago',
    falta_pago_mensualidad: 'Mensualidad vencida o sin cubrir',
    pausado: 'El usuario no puede operar temporalmente',
    suspendido: 'Suspendido por incumplimiento',
    rechazado: 'Solicitud rechazada definitivamente'
  };

  window.admuAbrirBottomEstado = function(uid) {
    var u = window._admuDatos.find(function(x){ return x.uid===uid; });
    if(!u) return;
    window._admuBottomUid = uid;
    var estadoActual = u.estado || 'pendiente_revision';
    var sheet = document.getElementById('admu-bottom-estado');
    if(!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'admu-bottom-estado';
      sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#131F17;border-top:1px solid rgba(255,255,255,.12);border-radius:18px 18px 0 0;z-index:9000;padding:16px 0 32px;max-width:430px;margin:0 auto;display:none;';
      sheet.innerHTML = '<div style="text-align:center;margin-bottom:4px;"><div style="width:36px;height:4px;background:rgba(255,255,255,.2);border-radius:4px;display:inline-block;"></div></div>'
        +'<div style="font-size:13px;font-weight:700;color:#fff;text-align:center;padding:8px 16px 12px;">Cambiar estado</div>'
        +'<div id="admu-bottom-opts"></div>'
        +'<div style="padding:12px 16px 0;">'
        +'<button onclick="admuCerrarBottomEstado()" style="width:100%;background:rgba(255,255,255,.06);border:none;border-radius:12px;color:rgba(255,255,255,.5);font-size:13px;font-weight:600;padding:14px;cursor:pointer;">Cancelar</button>'
        +'</div>';
      document.body.appendChild(sheet);
      var overlay = document.createElement('div');
      overlay.id = 'admu-bottom-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:8999;display:none;';
      overlay.onclick = admuCerrarBottomEstado;
      document.body.appendChild(overlay);
    }
    var opts = document.getElementById('admu-bottom-opts');
    if(opts) {
      opts.innerHTML = ADMU_ESTADOS.map(function(s){
        var color = ADMU_ESTADO_COLOR[s]||'#aaa';
        var label = ADMU_ESTADO_LABEL[s]||s;
        var desc = ADMU_ESTADO_DESC[s]||'';
        var sel = s === estadoActual;
        return '<div onclick="admuSelEstadoBottom(\''+s+'\')" style="display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;'+(sel?'background:rgba(255,255,255,.04);':'')+'">'
          +'<div style="width:20px;height:20px;border-radius:50%;border:2px solid '+(sel?color:'rgba(255,255,255,.2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
          +(sel?'<div style="width:10px;height:10px;border-radius:50%;background:'+color+';"></div>':'')
          +'</div>'
          +'<div style="flex:1;">'
          +'<div style="font-size:13px;font-weight:700;color:'+color+';">'+label+'</div>'
          +'<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:2px;">'+desc+'</div>'
          +'</div>'
          +'</div>';
      }).join('');
    }
    sheet.style.display = 'block';
    var ov = document.getElementById('admu-bottom-overlay');
    if(ov) ov.style.display = 'block';
  };

  window.admuSelEstadoBottom = function(nuevoEstado) {
    var uid = window._admuBottomUid;
    if(!uid) return;
    admuCerrarBottomEstado();
    admuCambiarEstado(uid, nuevoEstado);
    var u = window._admuDatos.find(function(x){ return x.uid===uid; });
    if(u) {
      u.estado = nuevoEstado;
      if(ADMU_TIPOS_PROV.indexOf(window._admuTipo) >= 0) admuRenderListaProv(window._admuDatos);
      else admuRenderLista(window._admuDatos);
    }
  };

  window.admuCerrarBottomEstado = function() {
    var sheet = document.getElementById('admu-bottom-estado');
    var ov = document.getElementById('admu-bottom-overlay');
    if(sheet) sheet.style.display = 'none';
    if(ov) ov.style.display = 'none';
    window._admuBottomUid = null;
  };

  function admuRenderLista(datos) {
    var lista = document.getElementById('admu-lista');
    if(!lista) return;
    if(!datos.length) { lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--white-50);font-size:13px;">Sin usuarios encontrados</div>'; return; }
    lista.innerHTML = '<div style="border-radius:14px;overflow:hidden;border:.5px solid var(--card-border);">'
      + datos.map(function(u, i){
        var estado = u.estado || 'activo';
        var color = ADMU_ESTADO_COLOR[estado] || '#aaa';
        var label = ADMU_ESTADO_LABEL[estado] || estado.toUpperCase();
        var borde = i < datos.length-1 ? 'border-bottom:1px solid rgba(255,255,255,.06);' : '';
        return '<div style="background:var(--card-dark);'+borde+'padding:13px 14px;display:flex;align-items:center;gap:10px;">'
          +'<div onclick="admuAbrirModal(\''+u.uid+'\')" style="flex:1;cursor:pointer;min-width:0;">'
          +'<div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(u.nombre||u.negocio||u.email||u.uid)+'</div>'
          +(u.email ? '<div style="font-size:11px;color:var(--white-40);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+u.email+'</div>' : '')
          +'</div>'
          +'<button onclick="admuAbrirBottomEstado(\''+u.uid+'\')" style="display:flex;align-items:center;gap:5px;background:'+color+'18;border:1px solid '+color+'55;border-radius:20px;padding:5px 10px;cursor:pointer;flex-shrink:0;">'
          +'<div style="width:7px;height:7px;border-radius:50%;background:'+color+';flex-shrink:0;"></div>'
          +'<span style="font-size:11px;font-weight:800;color:'+color+';letter-spacing:.4px;">'+label+'</span>'
          +'<span style="font-size:9px;color:'+color+';opacity:.7;">▼</span>'
          +'</button>'
          +'<button onclick="admuEliminarUsuario(\''+u.uid+'\',\''+encodeURIComponent(u.nombre||u.email||u.uid)+'\')" style="background:#D63A2A18;border:1px solid #D63A2A50;border-radius:8px;padding:7px 9px;font-size:15px;color:#D63A2A;cursor:pointer;">🗑</button>'
          +'</div>';
      }).join('')
      + '</div>';
  }

  function admuRenderListaAdmins(datos) {
    var lista = document.getElementById('admu-lista');
    if(!lista) return;
    if(!datos.length) { lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--white-50);font-size:13px;">Sin administradores</div>'; return; }
    lista.innerHTML = '<div style="border-radius:14px;overflow:hidden;border:.5px solid var(--card-border);">'
      + datos.map(function(u, i){
        var rolColor = u.rol==='maestro' ? '#F5C518' : u.rol==='premium' ? '#1FC26A' : '#64B5F6';
        var borde = i < datos.length-1 ? 'border-bottom:1px solid rgba(255,255,255,.06);' : '';
        return '<div style="background:var(--card-dark);'+borde+'padding:13px 14px;display:flex;align-items:center;gap:10px;">'
          +'<div style="flex:1;"><div style="font-size:13px;font-weight:600;color:#fff;">'+u.nombre+'</div>'
          +'<div style="font-size:11px;color:'+rolColor+';font-weight:700;margin-top:2px;">'+u.rol.toUpperCase()+'</div></div>'
          +(u.rol !== 'maestro' ? '<button onclick="admuEliminarAdmin(\''+u.uid+'\')" style="background:#D63A2A18;border:1px solid #D63A2A50;border-radius:8px;padding:6px 9px;font-size:14px;color:#D63A2A;cursor:pointer;">🗑</button>' : '<span style="font-size:10px;color:#555;">Maestra</span>')
          +'</div>';
      }).join('')
      + '</div>';
  }

  window.admuFiltrarLista = function() {
    var esProv = ADMU_TIPOS_PROV.indexOf(window._admuTipo) >= 0;
    var searchEl = document.getElementById(esProv ? 'admu-search-prov' : 'admu-search');
    var q = ((searchEl && searchEl.value) || '').toLowerCase();
    var filtrado = window._admuDatos.filter(function(u){
      var nombre = (u.nombre||u.negocio||u.email||u.uid||'').toLowerCase();
      return !q || nombre.includes(q);
    });
    if(esProv) admuRenderListaProv(filtrado);
    else if(window._admuTipo === 'admin') admuRenderListaAdmins(filtrado);
    else admuRenderLista(filtrado);
  };

  async function admuEnsureAuth() {
    if(window._fbAuth && window._fbAuth.currentUser) return;
    try {
      var A = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      var _se = 'dc.sysadmin@dominio-cumbres-appservis.firebaseapp.com';
      var _sp = 'DCsys2026!Admin#Secure';
      try {
        await A.signInWithEmailAndPassword(window._fbAuth, _se, _sp);
      } catch(e1) {
        var c = e1.code||'';
        if(c==='auth/user-not-found'||c==='auth/invalid-credential'||c==='auth/invalid-login-credentials'||c==='auth/INVALID_LOGIN_CREDENTIALS') {
          await A.createUserWithEmailAndPassword(window._fbAuth, _se, _sp);
        }
      }
    } catch(_) {}
  }

  window.admuCambiarEstado = async function(uid, nuevoEstado) {
    try {
      await admuEnsureAuth();
      var { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      await updateDoc(doc(window._fbDb,'usuarios',uid), { estado: nuevoEstado });
      var u = window._admuDatos.find(function(x){ return x.uid===uid; });
      if(u) u.estado = nuevoEstado;
    } catch(e) { alert('Error al actualizar: '+e.message); }
  };

  window.admuEliminarUsuario = function(uid, nombreEnc) {
    var nombre = decodeURIComponent(nombreEnc);
    window._dcConfirmar('¿Eliminar usuario "'+nombre+'" definitivamente? Se borrará todo su contenido.', async function() {
      try {
        await admuEnsureAuth();
        var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
        var S = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js");
        var db = window._fbDb;
        var storage = window._fbStorage;
        // Borrar subcolecciones conocidas
        var subcols = ['notificaciones','reservas','agendas','mensajes','productos','menu','horarios','ordenes'];
        for(var i=0;i<subcols.length;i++){
          try{
            var snap = await F.getDocs(F.collection(db,'usuarios',uid,subcols[i]));
            var batch = F.writeBatch(db);
            snap.forEach(function(d){ batch.delete(d.ref); });
            if(!snap.empty) await batch.commit();
          }catch(_){}
        }
        // Borrar archivos en Storage
        try{
          var listRef = S.ref(storage,'usuarios/'+uid);
          var list = await S.listAll(listRef);
          await Promise.all(list.items.map(function(item){ return S.deleteObject(item); }));
        }catch(_){}
        try{
          var listRef2 = S.ref(storage,'proveedores/'+uid);
          var list2 = await S.listAll(listRef2);
          await Promise.all(list2.items.map(function(item){ return S.deleteObject(item); }));
        }catch(_){}
        // Borrar documento principal
        await F.deleteDoc(F.doc(db,'usuarios',uid));
        window._admuDatos = window._admuDatos.filter(function(u){ return u.uid !== uid; });
        admuFiltrarLista();
      } catch(e) { alert('Error al eliminar: '+e.message); }
    });
  };

  window.admuEliminarAdmin = function(usr) {
    window._dcConfirmar('¿Eliminar al admin @'+usr+'?', function() {
      delete ADMIN_USERS[usr];
      window._admuDatos = Object.entries(ADMIN_USERS).map(function(e){ return { uid:e[0], nombre:'@'+e[0], rol:e[1].rol, tipo:'admin' }; });
      admuRenderListaAdmins(window._admuDatos);
      var toast = document.getElementById('admin-toast');
      if(toast){ toast.textContent='🗑 Admin @'+usr+' eliminado'; toast.style.display='block'; setTimeout(function(){ toast.style.display='none'; },3000); }
    });
  };

  window.admuAbrirModal = function(uid) {
    var u = window._admuDatos.find(function(x){ return x.uid===uid; });
    if(!u) return;
    window._admuModalUid = uid;
    var body = document.getElementById('admu-modal-body');
    var items = [
      ['Nombre', u.nombre||u.negocio||'—'],
      ['Correo', u.email||'—'],
      ['Teléfono', u.telefono||'—'],
      ['UID', uid],
      ['Tipo', u.tipo||'—'],
      ['Estado', ADMU_ESTADO_LABEL[u.estado]||u.estado||'—'],
      ['Registro', u.fechaRegistro ? new Date(u.fechaRegistro.seconds*1000).toLocaleDateString() : '—'],
      ['Últ. modificación', u.fechaActualizacion ? new Date(u.fechaActualizacion.seconds*1000).toLocaleDateString() : '—']
    ];
    body.innerHTML = items.map(function(r){
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);">'
        +'<span style="font-size:12px;color:var(--white-50);">'+r[0]+'</span>'
        +'<span style="font-size:12px;color:#fff;font-weight:600;text-align:right;max-width:60%;word-break:break-all;">'+r[1]+'</span>'
        +'</div>';
    }).join('');
    var modal = document.getElementById('admu-modal');
    if(modal){ modal.style.display='flex'; }
  };

  window.admuCerrarModal = function() {
    var modal = document.getElementById('admu-modal');
    if(modal) modal.style.display='none';
    window._admuModalUid = null;
  };

  window.admuEliminarDesdeModal = function() {
    var uid = window._admuModalUid;
    if(!uid) return;
    var u = window._admuDatos.find(function(x){ return x.uid===uid; });
    admuCerrarModal();
    admuEliminarUsuario(uid, encodeURIComponent(u ? (u.nombre||u.email||uid) : uid));
  };

  window.admuBack = function() {
    var prev = window._admuNavStack.pop();
    admuShow(prev || 'admu-home');
  };

  window.admuAgregarAdmin = function() {
    window._admuNavStack.push('admu-lista-sec');
    admuShow('admu-form-admin');
    var inputs = ['admu-new-usr','admu-new-pass'];
    inputs.forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
    var err=document.getElementById('admu-new-err'); if(err)err.style.display='none';
  };

  window.admuBack2Form = function() {
    window._admuNavStack.pop();
    admuCargarAdmins();
  };

  window.admuConfirmarAgregarAdmin = function() {
    var usr  = (document.getElementById('admu-new-usr').value||'').trim();
    var pass = document.getElementById('admu-new-pass').value;
    var rol  = document.getElementById('admu-new-rol').value;
    var err  = document.getElementById('admu-new-err');
    if(!usr||!pass){ err.style.display='block'; err.textContent='⚠️ Llena usuario y contraseña'; return; }
    if(pass.length<6){ err.style.display='block'; err.textContent='🔐 Mínimo 6 caracteres'; return; }
    if(ADMIN_USERS[usr]){ err.style.display='block'; err.textContent='❌ Ese usuario ya existe'; return; }
    err.style.display='none';
    ADMIN_USERS[usr] = { pass: pass, rol: rol };
    admuBack2Form();
    var toast=document.getElementById('admin-toast');
    if(toast){ toast.textContent='✅ Admin @'+usr+' ('+rol+') agregado'; toast.style.display='block'; setTimeout(function(){ toast.style.display='none'; },3000); }
  };

  // Migrar vecinos con estado 'pendiente' → 'activo' en masa (una sola vez al cargar)
  window.admuMigrarVecinosPendientes = async function() {
    try {
      await admuEnsureAuth();
      var F = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      var q = F.query(F.collection(window._fbDb,'usuarios'), F.where('tipo','==','vecino'), F.where('estado','==','pendiente'));
      var snap = await F.getDocs(q);
      if(snap.empty) return;
      var batch = F.writeBatch(window._fbDb);
      snap.forEach(function(d){ batch.update(d.ref,{estado:'activo'}); });
      await batch.commit();
    } catch(e) { /* silencioso */ }
  };

  // Cargar contadores en home de admu
  window.admuCargarContadores = async function() {
    try {
      await admuEnsureAuth();
      var { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      var snap = await getDocs(collection(window._fbDb,'usuarios'));
      var cVecino=0, cProv=0;
      var cEstados = {};
      snap.forEach(function(d){
        var u=d.data();
        var esVecino = u.tipo==='vecino';
        var esProv = u.tipo==='restaurante'||u.tipo==='negocio'||u.tipo==='proveedor';
        if(!esVecino && !esProv) return;
        if(esVecino) cVecino++; else cProv++;
        var e = u.estado||'activo';
        cEstados[e] = (cEstados[e]||0) + 1;
      });
      var cAdmin = Object.keys(ADMIN_USERS).length;
      var total = cVecino + cProv;
      var set = function(id,v){ var el=document.getElementById(id); if(el)el.textContent=v; };
      set('admu-cnt-vecino',cVecino);
      set('admu-cnt-proveedor',cProv);
      set('admu-cnt-admin',cAdmin);
      set('admu-cnt-total',total+' usuarios');
      var estados = document.getElementById('admu-estados');
      if(estados) {
        var activos = cEstados['activo']||0;
        var pendientes = (cEstados['pendiente']||0)+(cEstados['pendiente_revision']||0)+(cEstados['aprobado_pendiente_pago']||0)+(cEstados['falta_pago_mensualidad']||0);
        var suspendidos = (cEstados['suspendido']||0)+(cEstados['pausado']||0)+(cEstados['rechazado']||0);
        estados.innerHTML = [
          ['🟢 Activos', activos, '#1FC26A'],
          ['🟡 Pendientes', pendientes, '#F5C518'],
          ['🔴 Suspendidos', suspendidos, '#D63A2A']
        ].map(function(r){
          return '<div style="display:flex;justify-content:space-between;align-items:center;">'
            +'<span style="font-size:12px;color:'+r[2]+';">'+r[0]+'</span>'
            +'<span style="font-size:13px;font-weight:700;color:#fff;">'+r[1]+'</span>'
            +'</div>';
        }).join('');
      }
    } catch(e) { /* silencioso */ }
  };

  // ─── FILTROS SOLICITUDES ─────────────────────────────────
  window._filtroMain   = 'pendientes'; // 'pendientes' | 'aprobados'
  window._filtroSub    = 'todos';      // submenú activo
  window._todosUsuarios = [];

  // Botón principal: Pendientes / Aprobados
  window.setFiltroMain = async function(btn, filtro) {
    document.querySelectorAll('#fbtn-pendientes,#fbtn-aprobados,#fbtn-rechazados').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    window._filtroMain = filtro;
    // Siempre sincronizar subfiltro a 'todos' al cambiar tab principal
    window._filtroSub = 'todos';
    document.querySelectorAll('#sbtn-todos,#sbtn-residentes,#sbtn-proveedores,#sbtn-transporte,#sbtn-restaurante,#sbtn-negocio').forEach(b => b.classList.remove('on'));
    const _sbT=document.getElementById('sbtn-todos'); if(_sbT)_sbT.classList.add('on');
    const _subRes=document.getElementById('subfiltro-residentes'); if(_subRes)_subRes.style.display='none';
    if(!window._todosUsuarios || window._todosUsuarios.length === 0) {
      await cargarSolicitudes();
    } else {
      aplicarFiltros();
    }
  };

  // Submenú: 6 tipos
  window.setSubFiltro = async function(btn, subtipo) {
    document.querySelectorAll('#sbtn-todos,#sbtn-residentes,#sbtn-proveedores,#sbtn-transporte,#sbtn-restaurante,#sbtn-negocio').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    window._filtroSub = subtipo;
    // Mostrar zona/frac solo en Residentes
    const subRes = document.getElementById('subfiltro-residentes');
    if(subRes) subRes.style.display = subtipo === 'vecino' ? 'block' : 'none';
    // Reset zona/frac si no es residente
    if(subtipo !== 'vecino') {
      const fz = document.getElementById('filtro-zona');
      const ff = document.getElementById('filtro-frac');
      if(fz) fz.value = '';
      if(ff) ff.innerHTML = '<option value="">Todos los fraccionamientos</option>';
    }
    if(!window._todosUsuarios || window._todosUsuarios.length === 0) {
      await cargarSolicitudes();
    } else {
      aplicarFiltros();
    }
  };

  window.onFiltroZona = function(zona) {
    const ff = document.getElementById('filtro-frac');
    if(!ff) return;
    ff.innerHTML = '<option value="">Todos los fraccionamientos</option>';
    const fracsPorZona = {
      'Dominio Cumbres':['Alboradas','Alinka','Altaira','Altavia','Atera','Aura','Ayucca','Cerradas Lumina','Cumbres Altta','Cumbres Andara','Cumbres Ferrara','Cumbres La Joya de la Montaña','Cumbres La Rioja','El Cielo','La Montaña','Los Olivos','Lux','Mirador','Montencinos','Montessa','Monticello','Montserrat','Murano','Novelia','Paloblanco','PietrAlta','Pietralta Castelo','Porto Cumbres','Privalia Cumbres','Provenza Privada Terra','Provenza Sector Aqua','Provenza Sector Britania','Provenza Sector Vento','Ravello','Rincón De La Sierra','Rincón Del Obispado','Santoral','Santoral II','Santoral III','Solana','Tivoli','Toscana','Vernazza'],
      'La Reserva':[],'Valle de Cumbres':[],'Península':[]
    };
    const listaBase = fracsPorZona[zona] || [];
    const fracsFirebase = [...new Set(window._todosUsuarios.filter(u => (u.zona||'') === zona && u.fraccionamiento).map(u => u.fraccionamiento))];
    const todasFracs = [...new Set([...listaBase, ...fracsFirebase])].sort();
    todasFracs.forEach(f => {
      const o = document.createElement('option');
      o.value = f; o.textContent = f;
      ff.appendChild(o);
    });
    aplicarFiltros();
  };

  window.aplicarFiltros = function() {
    const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    let datos = window._todosUsuarios;
    const sub = window._filtroSub || 'todos';

    if(window._filtroMain === 'pendientes') {
      datos = datos.filter(u => u.estado === 'pendiente_revision');
      // subfiltro por tipo dentro de pendientes
      if(sub === 'vecino')      datos = datos.filter(u => u.tipo === 'vecino');
      else if(sub === 'proveedor')   datos = datos.filter(u => u.tipo === 'proveedor');
      else if(sub === 'transporte')  datos = datos.filter(u => ['transporte','repartidor','ambos','transportista','rider'].includes(u.tipo));
      else if(sub === 'restaurante') datos = datos.filter(u => ['restaurante','restaurant'].includes(u.tipo));
      else if(sub === 'negocio')     datos = datos.filter(u => ['negocio','tienda','comercio'].includes(u.tipo));
      // 'todos' no filtra más
    } else if(window._filtroMain === 'rechazados') {
      datos = datos.filter(u => u.estado === 'rechazado');
      if(sub === 'vecino')           datos = datos.filter(u => u.tipo === 'vecino');
      else if(sub === 'proveedor')   datos = datos.filter(u => u.tipo === 'proveedor');
      else if(sub === 'transporte')  datos = datos.filter(u => ['transporte','repartidor','ambos','transportista','rider'].includes(u.tipo));
      else if(sub === 'restaurante') datos = datos.filter(u => ['restaurante','restaurant'].includes(u.tipo));
      else if(sub === 'negocio')     datos = datos.filter(u => ['negocio','tienda','comercio'].includes(u.tipo));
    } else {
      // APROBADOS
      // Vecinos registrados antes del sistema de estados no tienen campo 'estado' → igual se muestran
      const esAprobado = u =>
        u.estado === 'activo' ||
        u.estado === 'aprobado_pendiente_pago' ||
        (u.tipo === 'vecino' && (u.estado === undefined || u.estado === null || u.estado === ''));
      datos = datos.filter(esAprobado);

      if(sub === 'vecino') {
        datos = datos.filter(u => u.tipo === 'vecino');
        const zona = (document.getElementById('filtro-zona')||{}).value || '';
        const frac = (document.getElementById('filtro-frac')||{}).value || '';
        if(zona) datos = datos.filter(u => norm(u.zona) === norm(zona));
        if(frac) datos = datos.filter(u => norm(u.fraccionamiento) === norm(frac));
      } else if(sub === 'proveedor')   { datos = datos.filter(u => u.tipo === 'proveedor'); }
      else if(sub === 'transporte')    { datos = datos.filter(u => ['transporte','repartidor','ambos','transportista','rider'].includes(u.tipo)); }
      else if(sub === 'restaurante')   { datos = datos.filter(u => ['restaurante','restaurant'].includes(u.tipo)); }
      else if(sub === 'negocio')       { datos = datos.filter(u => ['negocio','tienda','comercio'].includes(u.tipo)); }
      // sub==='todos' → ya filtrado por esAprobado arriba
    }
    renderLista(datos);
  };

  window.renderLista = function(datos) {
    const lista = document.getElementById('admin-lista');
    if(!datos.length) {
      lista.innerHTML = '<div class="si24">&#10003; Sin resultados para este filtro</div>';
      return;
    }
    lista.innerHTML = '';
    datos.forEach(u => {
      const color = u.estado==='activo'?'#1FC26A':u.estado==='rechazado'?'#D63A2A':u.estado==='aprobado_pendiente_pago'?'#1A7AB5':'#F5C518';
      const div = document.createElement('div');
      div.style.cssText = 'background:#162A1D;border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid #1A3A25;';
      const esPendiente = u.estado === 'pendiente_revision' && u.tipo !== 'vecino';
      const esAprobado  = u.estado === 'activo' || u.estado === 'aprobado_pendiente_pago'
                         || (u.tipo === 'vecino' && (u.estado === undefined || u.estado === null || u.estado === ''));
      const esRechazado = u.estado === 'rechazado';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;">${u.nombre||u.nombreNegocio||'&#8212;'}</div>
            <div class="si10">${u.correo||'&#8212;'}</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">${u.fraccionamiento ? '&#128205; '+u.fraccionamiento : (u.zona ? '&#128506; '+u.zona : '&#8212;')} ${u.zona && u.fraccionamiento ? '&middot; '+u.zona : ''}</div>
          </div>
          <div style="text-align:right;">
            <span style="background:#F5C51820;color:#F5C518;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #F5C51840;display:block;margin-bottom:4px;">${(u.tipo||'').toUpperCase()}</span>
            <span style="font-size:10px;font-weight:700;color:${color};">${u.estado==='aprobado_pendiente_pago'?'PENDIENTE PAGO':(u.estado||'').toUpperCase()}</span>
          </div>
        </div>
        ${esPendiente ? `<div style="margin-top:8px;">
          <button onclick="window.verDetalleAdmin('${u._id}')" style="width:100%;background:#F5C51820;border:1px solid #F5C51860;color:#F5C518;border-radius:10px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">&#128269; Revisar solicitud</button>
        </div>` : ''}
        ${esAprobado ? `<div style="margin-top:8px;">
          <button onclick="window.verDetalleAdmin('${u._id}')" style="width:100%;background:#1FC26A20;border:1px solid #1FC26A60;color:#1FC26A;border-radius:10px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">&#128203; Ver detalle</button>
        </div>` : ''}
        ${esRechazado ? '<div style="margin-top:8px;">'
          +'<button onclick="window.verDetalleAdmin(\''+u._id+'\')" style="width:100%;background:#D63A2A20;border:1px solid #D63A2A60;color:#D63A2A;border-radius:10px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">&#128203; Ver detalle</button>'
          +(u.motivoRechazo ? '<div style="margin-top:6px;font-size:11px;color:#D63A2A;padding:6px 8px;background:#D63A2A10;border-radius:8px;">&#128172; '+(u.motivoRechazo||'').slice(0,80)+((u.motivoRechazo||'').length>80?'\u2026':'')+'</div>' : '')
          +'</div>' : ''}
      `;
      lista.appendChild(div);
    });
  };
  // ── Modal de detalle admin ──────────────────────────────────
  window.verDetalleAdmin = function(uid) {
    const u = (window._todosUsuarios||[]).find(x => x._id === uid);
    if (!u) return;

    // R: always show, empty -> em dash
    const R = (label, val) => {
      const v = (val===null||val===undefined||val==='')?'&#8212;':String(val);
      return '<div style="margin-bottom:10px;">'
        +'<div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">'+label+'</div>'
        +'<div style="font-size:13px;color:#1a1a1a;font-weight:500;word-break:break-all;">'+v+'</div></div>';
    };
    const S = t => '<div style="font-size:10px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin:14px 0 8px;padding-top:10px;border-top:1.5px solid #f0f0f0;">'+t+'</div>';

    const fecha  = u.creadoEn ? new Date(u.creadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '&#8212;';
    const esRide = ['transporte','repartidor','ambos'].includes(u.tipo);
    const esNeg  = ['negocio','restaurante'].includes(u.tipo);
    const esProv = u.tipo === 'proveedor';

    let campos = '';

    // DATOS PERSONALES
    campos += S('Datos personales');
    campos += R('Nombre', u.nombre||u.nombreNegocio);
    campos += R('Usuario', u.usuario);
    campos += R('Correo', u.correo);
    campos += R('Prefijo WhatsApp', u.prefijoWhatsapp);
    campos += R('Tel\u00e9fono', u.telefono);
    campos += R('WhatsApp', u.whatsapp);

    // DATOS ESPECIFICOS
    if (esProv) {
      campos += S('Servicio');
      campos += R('Oficio 1', u.oficio1);
      campos += R('Oficio 2', u.oficio2);
      campos += R('Oficio 3', u.oficio3);
      campos += R('Descripci\u00f3n Otro', u.otroDesc);
      campos += R('Oficios adicionales', u.oficiosExtra);
      campos += R('Descripci\u00f3n / Especialidad', u.descripcion);
      campos += R('Experiencia', u.experiencia);
      campos += R('Calificaci\u00f3n', u.calificacion);
      campos += R('Total calificaciones', u.totalCalificaciones);
      campos += S('Direcci\u00f3n privada');
      campos += R('Calle', u.calle);
      campos += R('N\u00famero', u.numero||u.numeroProv);
      campos += R('Colonia', u.colonia);
    } else if (esRide) {
      const tl={'transporte':'Transporte','repartidor':'Repartidor','ambos':'Transporte y Repartidor'};
      campos += S('Servicio de transporte');
      campos += R('Tipo de servicio', tl[u.tipo]||u.tipo);
      campos += R('Tipo de veh\u00edculo', u.tipoVehiculo);
      campos += R('Marca', u.marca);
      campos += R('Modelo', u.modelo);
      campos += R('Color', u.color);
      campos += R('Placas', u.placas);
      campos += R('Cobertura', u.cobertura==='cumbres_garcia'?'Toda Cumbres Garc\u00eda':u.cobertura==='dominio_cumbres'?'Solo Dominio Cumbres':u.cobertura);
      campos += R('Descripci\u00f3n', u.descripcion);
    } else if (esNeg) {
      campos += S('Datos del negocio');
      campos += R('Nombre comercial', u.nombreNegocio);
      campos += R('Tipo', u.tipo==='restaurante'?'Restaurante':'Negocio');
      campos += R('Categor\u00eda', u.categoria);
      campos += R('Categor\u00eda (otro)', u.categoriaOtro);
      campos += R('Operaci\u00f3n', u.operacion);
      campos += R('Entrega', u.entrega);
      campos += R('Cobertura', u.cobertura==='cumbres_garcia'?'Toda Cumbres Garc\u00eda':u.cobertura==='dominio_cumbres'?'Solo Dominio Cumbres':u.cobertura);
      campos += R('Descripci\u00f3n', u.descripcion);
      campos += R('A\u00f1os operando', u.aniosOperando);
      campos += S('Direcci\u00f3n privada');
      campos += R('Calle', u.calle);
      campos += R('N\u00famero', u.numero);
      campos += R('Colonia', u.colonia);
    } else {
      // Vecino
      campos += S('Ubicaci\u00f3n');
      campos += R('Zona', u.zona);
      campos += R('Fraccionamiento', u.fraccionamiento);
      campos += R('Calle', u.calle);
      campos += R('N\u00famero', u.numero);
      campos += R('Direcci\u00f3n', u.direccion);
    }

    // SISTEMA
    campos += S('Sistema');
    campos += R('UID', uid);
    campos += R('Tipo', u.tipo);
    campos += R('Estado', u.estado);
    campos += R('Registro', fecha);
    if (u.motivoRechazo) campos += R('Motivo rechazo', u.motivoRechazo);
    if (u.rechazadoEn)   campos += R('Rechazado el', new Date(u.rechazadoEn).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}));

    // BOTONES
    const nomSafe = (u.nombre||u.nombreNegocio||'').replace(/'/g,'');
    let acciones = '';
    if (u.estado === 'pendiente_revision') {
      acciones =
        '<div style="display:flex;gap:8px;margin-top:16px;">'
        +'<button onclick="aprobarUsuario(\''+uid+'\',\''+u.correo+'\',\''+nomSafe+'\',\''+u.tipo+'\');document.getElementById(\'modal-detalle-admin\').style.display=\'none\'" '
        +'style="flex:1;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">&#10003; Aprobar</button>'
        +'<button onclick="window._abrirModalRechazo(\''+uid+'\',\''+u.correo+'\',\''+nomSafe+'\')" '
        +'style="flex:1;background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">&#10007; Rechazar</button>'
        +'</div>';
    }
    acciones += '<button onclick="document.getElementById(\'modal-detalle-admin\').style.display=\'none\'" '
      +'style="width:100%;margin-top:8px;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:11px;font-size:13px;cursor:pointer;font-family:\'Inter\',sans-serif;">Cerrar</button>';

    const html = '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">'+(u.nombre||u.nombreNegocio||'&#8212;')+'</div>'
      + campos + acciones;

    const ya = document.getElementById('modal-detalle-admin');
    if (ya) { ya.querySelector('.mda-body').innerHTML = html; ya.style.display='flex'; return; }
    const m = document.createElement('div');
    m.id = 'modal-detalle-admin';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    m.innerHTML = '<div class="mda-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;">'+html+'</div>';
    m.addEventListener('click', e => { if(e.target===m) m.style.display='none'; });
    document.body.appendChild(m);
  };

  window.aprobarUsuario = async function(uid, correo, nombre, tipo) {
    try {
      const { updateDoc, doc: fsDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      // Leer tipo directamente de Firestore — no depender del param que puede llegar vacío
      const snap = await getDoc(fsDoc(window._fbDb, 'usuarios', uid));
      const tipoReal = snap.exists() ? (snap.data().tipo || '') : (tipo || '');
      const nuevoEstado = ['proveedor','negocio','restaurante'].includes(tipoReal) ? 'aprobado_pendiente_pago' : 'activo';
      await updateDoc(fsDoc(window._fbDb, 'usuarios', uid), { estado: nuevoEstado });
      notificarAprobado(nombre, correo);
      const msg = tipo === 'proveedor'
        ? `✅ ${nombre} aprobado — pendiente de pago`
        : `✅ ${nombre} aprobado — se le notificó por correo`;
      document.getElementById('admin-toast').textContent = msg;
      document.getElementById('admin-toast').style.display = 'block';
      setTimeout(()=>document.getElementById('admin-toast').style.display='none', 4000);
      cargarSolicitudes();
    } catch(e) {
      const _at=document.getElementById('admin-toast'); if(_at){_at.textContent='❌ Error al aprobar: '+e.message;_at.style.display='block';setTimeout(()=>{_at.style.display='none';},4000);}
    }
  };

  // Modal de motivo de rechazo
  window._abrirModalRechazo = function(uid, correo, nombre) {
    const ya = document.getElementById('modal-rechazo-motivo');
    const html =
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">'+'\u274C Motivo de rechazo</div>'
      +'<div style="font-size:12px;color:#666;margin-bottom:8px;">Este mensaje ser\u00e1 visible para el solicitante al iniciar sesi\u00f3n.</div>'
      +'<textarea id="rechazo-motivo-inp" rows="4" maxlength="500" placeholder="Describe el motivo (m\u00ednimo 20 caracteres)..." '
      +'style="width:100%;box-sizing:border-box;border:1.5px solid #ddd;border-radius:10px;padding:10px;font-size:13px;font-family:\'Inter\',sans-serif;resize:none;margin-bottom:4px;"></textarea>'
      +'<div id="rechazo-motivo-st" style="font-size:11px;color:#aaa;margin-bottom:12px;">0 / 500 caracteres</div>'
      +'<button onclick="window._confirmarRechazo(\''+uid+'\',\''+correo+'\',\''+nombre+'\')" '
      +'style="width:100%;background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;margin-bottom:8px;">Confirmar rechazo</button>'
      +'<button onclick="document.getElementById(\'modal-rechazo-motivo\').style.display=\'none\'" '
      +'style="width:100%;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:11px;font-size:13px;cursor:pointer;font-family:\'Inter\',sans-serif;">Cancelar</button>';
    if (ya) { ya.querySelector('.mrm-body').innerHTML = html; ya.style.display='flex'; }
    else {
      const m = document.createElement('div');
      m.id = 'modal-rechazo-motivo';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
      m.innerHTML = '<div class="mrm-body" style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'+html+'</div>';
      document.body.appendChild(m);
    }
    // live counter
    setTimeout(() => {
      const ta = document.getElementById('rechazo-motivo-inp');
      const st = document.getElementById('rechazo-motivo-st');
      if (ta && st) ta.addEventListener('input', () => { st.textContent = ta.value.length + ' / 500 caracteres'; });
    }, 100);
  };

  window._confirmarRechazo = async function(uid, correo, nombre) {
    const ta = document.getElementById('rechazo-motivo-inp');
    const motivo = (ta ? ta.value.trim() : '');
    if (!motivo || motivo.length < 20) {
      const st = document.getElementById('rechazo-motivo-st');
      if (st) { st.textContent = '\u26a0\ufe0f M\u00ednimo 20 caracteres'; st.style.color='#D63A2A'; }
      return;
    }
    const m = document.getElementById('modal-rechazo-motivo');
    if (m) m.style.display = 'none';
    const mda = document.getElementById('modal-detalle-admin');
    if (mda) mda.style.display = 'none';
    await window.rechazarUsuario(uid, correo, nombre, motivo);
  };

  window.rechazarUsuario = async function(uid, correo, nombre, motivo) {
    try {
      const { updateDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      await updateDoc(fsDoc(window._fbDb, 'usuarios', uid), {
        estado: 'rechazado',
        motivoRechazo: motivo || '',
        rechazadoEn: new Date().toISOString()
      });
      document.getElementById('admin-toast').textContent = `🚫 ${nombre||'Solicitud'} rechazada`;
      document.getElementById('admin-toast').style.display = 'block';
      setTimeout(()=>document.getElementById('admin-toast').style.display='none', 3000);
      cargarSolicitudes();
    } catch(e) {
      const _at=document.getElementById('admin-toast'); if(_at){_at.textContent='❌ Error al rechazar: '+e.message;_at.style.display='block';setTimeout(()=>{_at.style.display='none';},4000);}
    }
  };

  window.verTodosUsuarios = async function() {
    await cargarSolicitudes();
  };

  window.verificarCodigo = function() {
    const inputs = document.querySelectorAll('.code-inp');
    const codigo = Array.from(inputs).map(i => i.value).join('');
    const errEl = document.getElementById('codigo-err');
    if (codigo.length < 4 || /\s/.test(codigo)) {
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    go('v-home', 'right');
  };

// ══════════════════════════════════════════════════════════════
// EXTRAÍDO DE firebase.js — cargarRepartidores
// ══════════════════════════════════════════════════════════════
  // ===== CARGAR REPARTIDORES (Ride) con acceso directo a window._fbDb =====
  window.cargarRepartidores = async function() {
    const demoChips = document.getElementById('ride-demo-chips');
    const container = document.querySelector('#v-ride .rider-chips-container');
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(query(collection(window._fbDb,'usuarios'), where('tipo','==','repartidor')));
      const docs = [];
      snap.forEach(d => { const r=d.data(); if(r.estado==='activo') docs.push({_id:d.id,...r}); });
      if(docs.length === 0) {
        // No hay reales — mostrar demo
        if(demoChips) demoChips.style.display='flex';
        return;
      }
      // Hay reales — ocultar demo y mostrar reales
      if(demoChips) demoChips.style.display='none';
      // Crear chips reales
      docs.forEach((r,i) => {
        const chip = document.createElement('div');
        chip.className = 'rider-chip' + (i===0?' on':'');
        chip.innerHTML = '<div class="si11">🏍️</div><div class="si49">'+window.dcEscHTML(r.nombre||'—')+'</div><div class="si50">~'+(3+i*2)+' min</div><div class="si63">★ Nuevo</div>';
        chip.onclick = () => selRider(chip, 55+i*5, r.nombre||'Repartidor', '~'+(3+i*2)+' min');
        if(container) container.appendChild(chip);
      });
    } catch(e) {
      if(demoChips) demoChips.style.display='flex';
    }
  };
