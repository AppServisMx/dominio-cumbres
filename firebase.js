  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
  import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDMQe7mPjzrzuxqLXPu4Ft0A4r2ZggqV14",
    authDomain: "dominio-cumbres-appservis.firebaseapp.com",
    projectId: "dominio-cumbres-appservis",
    storageBucket: "dominio-cumbres-appservis.firebasestorage.app",
    messagingSenderId: "904496349672",
    appId: "1:904496349672:web:6b9975dab5e922bd36e45d",
    measurementId: "G-1F1XN81VWN"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Exponer en window para acceso desde scripts regulares
  window._fbAuth = auth;
  window._fbDb   = db;

  // Importar funciones Firestore una sola vez
  const { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot, updateDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
  window._fs = { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot, updateDoc, fsDoc };

  // enviarMensaje DENTRO del módulo — acceso directo a Firestore
  window.enviarMensaje = async function() {
    const input = document.getElementById('chat-input');
    if(!input || !input.value.trim()) return;
    const texto = input.value.trim();
    input.value = '';
    const container = document.getElementById('chat-msgs-container');
    const hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    const divLocal = document.createElement('div');
    divLocal.className = 'msg msg-s';
    divLocal.innerHTML = texto+'<div class="msg-time">'+hora+'</div>';
    if(container) { container.appendChild(divLocal); container.scrollTop = container.scrollHeight; }
    const userId = auth.currentUser ? auth.currentUser.uid : (window._chatUserId || 'anonimo');
    const userName = localStorage.getItem('dcuser') || 'Vecino';
    const provId = window._chatProveedorId || 'proveedor_demo';
    const idsOrdenados = [userId, provId].sort().join('_');
    const chatId = 'chat_' + idsOrdenados;
    try {
      // Guardar mensaje en subcolección
      await addDoc(collection(db, 'chats', chatId, 'mensajes'), {
        texto, remitenteId: userId, remitenteNombre: userName,
        destinatarioId: provId, timestamp: serverTimestamp()
      });
      // Actualizar documento raíz del chat para que cargarMisChats y verificarChatsProveedor lo encuentren
      const { setDoc, doc: fsDoc2 } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      await setDoc(fsDoc2(db, 'chats', chatId), {
        participantes: [userId, provId],
        ultimoMsg: texto,
        ultimoNombre: userName,
        nombreContacto: window._chatProveedorNombre || 'Usuario',
        ultimoEmisor: userId,
        respondido: false,
        fecha: Date.now()
      }, { merge: true });
    } catch(e) { console.log('Chat error:', e.message); }
  };

  // cargarMensajes DENTRO del módulo
  window.cargarMensajes = async function() {
    const container = document.getElementById('chat-msgs-container');
    if(!container) return;
    const hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    container.innerHTML = '';
    // Esperar a que auth esté listo
    await new Promise(resolve => {
      if(auth.currentUser) return resolve();
      const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(); });
    });
    const userId = auth.currentUser ? auth.currentUser.uid : 'anonimo';
    window._chatUserId = userId;
    const provId = window._chatProveedorId || 'proveedor_demo';
    const chatId = window._chatIdExacto || ('chat_' + [userId, provId].sort().join('_'));
    window._chatIdExacto = null;
    try {
      const msgsRef = collection(db, 'chats', chatId, 'mensajes');
      if(window._chatUnsubscribe) window._chatUnsubscribe();
      window._chatUnsubscribe = onSnapshot(query(msgsRef, orderBy('timestamp','asc')), (snap) => {
        container.innerHTML = '';
        if(snap.empty) {
          const sys = document.createElement('div');
          sys.className = 'msg msg-sys';
          sys.textContent = 'Chat iniciado · ' + hora;
          container.appendChild(sys);
          const bienvenida = document.createElement('div');
          bienvenida.className = 'msg msg-r';
          bienvenida.innerHTML = '¡Hola! ¿En qué le puedo ayudar? 🔧<div class="msg-time">'+hora+'</div>';
          container.appendChild(bienvenida);
          return;
        }
        snap.forEach(d => {
          const m = d.data();
          const div = document.createElement('div');
          div.className = 'msg ' + (m.remitenteId === userId ? 'msg-s' : 'msg-r');
          const h = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : hora;
          div.innerHTML = (m.texto||'')+'<div class="msg-time">'+h+'</div>';
          container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
      });
    } catch(e) { console.log('Chat error:', e.message); }
  };

  // ===== DIAGNÓSTICO FIREBASE =====
  window.diagFirebase = async function(filtrocat) {
    const lista = document.getElementById('servicios-lista');
    lista.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-hint);">Cargando... ⏳</div>';
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const q = query(collection(db,'usuarios'), where('tipo','==','proveedor'));
      const snap = await getDocs(q);
      const docs = [];
      snap.forEach(d => {
        const p = d.data();
        if(p.estado !== 'activo') return;
        if(filtrocat && filtrocat !== 'todos') {
          // Si tiene categoria, filtrar; si no tiene, aparece en todos
          if(p.categoria && p.categoria.toLowerCase() !== filtrocat) return;
        }
        docs.push({id: d.id, ...p});
      });
      if(docs.length === 0) {
        lista.innerHTML = '<div class="si24">Sin proveedores activos aún</div>';
        return;
      }
      lista.innerHTML = '';
      const ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
      const BGS   = {plomero:'#E8F0F8',electricista:'#FFF8E1',jardinero:'#E8F5EE',limpieza:'#F0EBF8',pintura:'#FDECEA',ac:'#E8F0F8',cerrajero:'#FFF8E1',otro:'#E8F5EE'};
      docs.forEach(p => {
        const cat = (p.categoria||'otro').toLowerCase();
        const ic  = ICONOS[cat]||'🔧';
        const bg  = BGS[cat]||'#E8F5EE';
        const premium = p.membresia === 'premium';
        const div = document.createElement('div');
        div.className = 'prov-card';
        div.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div class="prov-av" style="background:${bg};">${ic}<div class="prov-badge" style="background:${premium?'var(--yellow)':'var(--green)'};">${premium?'💎':'✓'}</div></div>
            <div class="si03">
              <div class="si17">${p.nombre||'—'}</div>
              <div class="si01">${p.descripcion||p.categoria||'Proveedor'}</div>
              <div class="si59">★★★★★ Nuevo</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
            ${premium?'<span class="tag tag-y">💎 Premium</span>':''}
            <span class="tag tag-g">✅ Verificado</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:.5px solid #f0f0f0;">
            <span class="si16">${p.precio||'Consultar precio'}</span>
            <span style="font-size:11px;font-weight:700;color:var(--green);">Disponible</span>
          </div>`;
        div.onclick = () => abrirDetalleProveedor(p);
        // Agregar botón favorito
        const favBtn = document.createElement('button');
        favBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:rgba(255,255,255,.8);border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
        const favKey = 'fav_prov_' + (p._id||p.id||p.nombre);
        favBtn.textContent = localStorage.getItem(favKey) ? '❤️' : '🤍';
        favBtn.onclick = (e) => {
          e.stopPropagation();
          if(localStorage.getItem(favKey)) {
            localStorage.removeItem(favKey);
            favBtn.textContent = '🤍';
          } else {
            localStorage.setItem(favKey, JSON.stringify({tipo:'proveedor', nombre:p.nombre||'—', categoria:p.categoria||'', correo:p.correo||'', _id:p._id||p.id||''}));
            favBtn.textContent = '❤️';
          }
        };
        div.style.position = 'relative';
        div.appendChild(favBtn);
        lista.appendChild(div);
      });
    } catch(e) {
      lista.innerHTML = '<div style="background:#FDECEA;border-radius:12px;padding:14px;margin:10px;font-size:12px;color:#D63A2A;"><b>❌ Error:</b> ' + e.message + '</div>';
    }
  };
  
  // Hacer que cargarProveedores apunte a diagFirebase (que sí funciona)
  window.cargarProveedores = window.diagFirebase;

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
    go('v-serv-det','right');
  };

  // Observer: carga proveedores automáticamente cuando v-servicios se hace visible
  const _obsServicios = new MutationObserver(() => {
    const v = document.getElementById('v-servicios');
    if(v && v.classList.contains('active')) {
      window.diagFirebase();
    }
  });
  const _vsEl = document.getElementById('v-servicios');
  if(_vsEl) _obsServicios.observe(_vsEl, { attributeFilter: ['class'] });

  // ===== REDEFINIR cargarProveedores con acceso directo a db =====
  // (sobreescribe la versión en el script no-module que no puede acceder a db)
  window.cargarProveedores = async function(categoria) {
    const lista = document.getElementById('servicios-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si24">Cargando proveedores... ⏳</div>';
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const q = query(collection(db,'usuarios'), where('tipo','==','proveedor'));
      const snap = await getDocs(q);
      const docs = [];
      snap.forEach(d => {
        const p = d.data();
        if(p.estado === 'activo') docs.push({id: d.id, ...p});
      });
      if(docs.length === 0) {
        lista.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;margin-bottom:10px;">🔧</div><div class="si33">Próximamente</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Los primeros proveedores se están registrando</div></div>';
        return;
      }
      lista.innerHTML = '';
      const ICONOS = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
      const BGS    = {plomero:'#E8F0F8',electricista:'#FFF8E1',jardinero:'#E8F5EE',limpieza:'#F0EBF8',pintura:'#FDECEA',ac:'#E8F0F8',cerrajero:'#FFF8E1',otro:'#E8F5EE'};
      docs.forEach(p => {
        const cat = (p.categoria||'otro').toLowerCase();
        const ic  = ICONOS[cat]||'🔧';
        const bg  = BGS[cat]||'#E8F5EE';
        const premium = p.membresia === 'premium';
        const div = document.createElement('div');
        div.className = 'prov-card';
        div.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div class="prov-av" style="background:${bg};">${ic}<div class="prov-badge" style="background:${premium?'var(--yellow)':'var(--green)'};">${premium?'💎':'✓'}</div></div>
            <div class="si03">
              <div class="si17">${p.nombre||'—'}</div>
              <div class="si01">${p.descripcion||p.categoria||'Proveedor'}</div>
              <div class="si59">★★★★★ Nuevo</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
            ${premium?'<span class="tag tag-y">💎 Premium</span>':''}
            <span class="tag tag-g">✅ Verificado</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:.5px solid #f0f0f0;">
            <span class="si16">${p.precio||'Consultar precio'}</span>
            <span style="font-size:11px;font-weight:700;color:var(--green);">Disponible</span>
          </div>`;
        div.onclick = () => abrirDetalleProveedor(p);
        lista.appendChild(div);
      });
    } catch(e) {
      lista.innerHTML = '<div class="si60">Error: '+e.message+'</div>';
    }
  };

  // ===== CARGAR PROVEEDORES =====
  const ICONOS_CAT = {plomero:'💧',electricista:'⚡',jardinero:'🌿',limpieza:'🧹',pintura:'🎨',ac:'❄️',cerrajero:'🔒',mascotas:'🐾',tecnologia:'🖥️',belleza:'💆',otro:'🔧'};
  const BG_CAT = {plomero:'#E8F0F8',electricista:'#FFF8E1',jardinero:'#E8F5EE',limpieza:'#F0EBF8',pintura:'#FDECEA',ac:'#E8F0F8',cerrajero:'#FFF8E1',otro:'#E8F5EE'};

  window.cargarProveedoresReal = async function() {
    const lista = document.getElementById('servicios-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si24">Cargando proveedores... ⏳</div>';
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const q = query(collection(db,'usuarios'), where('tipo','==','proveedor'));
      const snap = await getDocs(q);
      const docs = [];
      snap.forEach(d => {
        const p = d.data();
        if(p.estado === 'activo' || p.estado === 'aprobado' || !p.estado) docs.push({_id: d.id, ...p});
      });
      if(docs.length === 0) {
        lista.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:32px;">🔧</div><div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-top:8px;">Próximamente</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Los primeros proveedores se están registrando</div></div>';
        return;
      }
      lista.innerHTML = '';
      docs.forEach(p => {
        const cat = (p.categoria||'otro').toLowerCase();
        const ic = ICONOS_CAT[cat]||'🔧';
        const bg = BG_CAT[cat]||'#E8F5EE';
        const div = document.createElement('div');
        div.className = 'prov-card';
        div.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div class="prov-av" style="background:${bg};">${ic}<div class="prov-badge" style="background:var(--green);">✓</div></div>
            <div class="si03">
              <div class="si17">${p.nombre||'—'}</div>
              <div class="si01">${p.descripcion||p.categoria||'Proveedor'}</div>
              <div class="si59">★★★★★ Nuevo</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;"><span class="tag tag-g">✅ Verificado</span></div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:.5px solid #f0f0f0;">
            <span class="si16">${p.precio||'Consultar precio'}</span>
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
  window.cargarSolicitudesReal = async function() {
    const lista = document.getElementById('admin-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si61">Cargando... ⏳</div>';
    try {
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(db, 'usuarios'));
      window._todosUsuarios = [];
      snap.forEach(d => { const u = d.data(); u._id = d.id; window._todosUsuarios.push(u); });
      if(window.aplicarFiltros) window.aplicarFiltros();
    } catch(e) {
      lista.innerHTML = '<div class="si60">Error: '+e.message+'</div>';
    }
  };

  // Override the window functions with real Firebase versions
  window.cargarSolicitudes = window.cargarSolicitudesReal;

  // ===== CARGAR MI PERFIL REAL =====
  window.cargarMiPerfil = async function() {
    const user = auth.currentUser;
    if(!user) return;
    try {
      const { getDoc, doc: fsDoc3 } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDoc(fsDoc3(db, 'usuarios', user.uid));
      if(snap.exists()) {
        const u = snap.data();
        const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
        set('panel-nombre', u.nombre||u.nombreNegocio);
        set('panel-correo', u.correo||user.email);
        set('panel-usuario', u.usuario);
        set('panel-tel', u.telefono);
        set('panel-frac', u.fraccionamiento||(u.zona?u.zona:'—'));
      }
    } catch(e){ console.log('Perfil error:',e.message); }
  };

  // ===== CARGAR RESTAURANTES (Food) con acceso directo a db =====
  window.cargarRestaurantes = async function() {
    const lista = document.getElementById('food-lista');
    const demo  = document.getElementById('food-demo');
    const hdr   = document.getElementById('food-lista-header');
    if(!lista) return;
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(query(collection(db,'usuarios'), where('tipo','==','negocio')));
      const docs = [];
      snap.forEach(d => { const r = d.data(); if(r.estado==='activo') docs.push({_id:d.id,...r}); });
      if(docs.length === 0) {
        if(hdr) hdr.innerHTML = '<div class="si09">🟢 Abiertos ahora</div>';
        if(demo) demo.style.display='block'; // Mostrar demo si no hay reales
        return;
      }
      if(demo) demo.style.display='none';
      if(hdr) hdr.innerHTML = '<div class="si09">🟢 Restaurantes activos</div>';
      lista.innerHTML = '';
      const EMOJIS = {'tacos':'🌮','pizza':'🍕','sushi':'🍣','saludable':'🥗','hamburguesas':'🍔','cafe':'☕','comida corrida':'🍱','otro':'🍽️'};
      docs.forEach(r => {
        const cat = (r.categoria||'otro').toLowerCase();
        const emoji = EMOJIS[cat] || '🍽️';
        const div = document.createElement('div');
        div.className = 'rest-card';
        div.innerHTML = `
          <div class="si15 rest-banner">${emoji}
            <span class="si32">⏰ ${r.horario||'Ver horario'}</span>
          </div>
          <div class="rest-body">
            <div class="si05">
              <div class="rest-name">${r.nombreNegocio||r.nombre||'—'}</div>
              <span class="si44">Abierto</span>
            </div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:3px;">⭐ Nuevo · ${r.descripcion||r.categoria||''}</div>
            <div class="rest-footer"><span class="si01">Envío disponible</span><span class="si16">Pedir →</span></div>
          </div>`;
        div.onclick = () => go('v-food-det','right');
        lista.appendChild(div);
      });
    } catch(e) {
      if(hdr) hdr.innerHTML = '<div class="si09">🟢 Abiertos ahora</div>';
      console.log('Food error:',e.message);
    }
  };

  // ===== CARGAR COMERCIOS (Plaza Digital) con acceso directo a db =====
  window.cargarPlaza = async function() {
    const lista = document.getElementById('plaza-lista');
    if(!lista) return;
    lista.innerHTML = '<div class="si24">Cargando comercios... ⏳</div>';
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(query(collection(db,'usuarios'), where('tipo','==','negocio')));
      const docs = [];
      snap.forEach(d => { const r = d.data(); if(r.estado==='activo' && r.tipoNegocio==='plaza') docs.push({_id:d.id,...r}); });
      if(docs.length === 0) {
        const pd = document.getElementById('plaza-demo');
        if(pd) pd.style.display='block';
        return;
      }
      lista.innerHTML = '';
      docs.forEach(r => {
        const div = document.createElement('div');
        div.className = 'plaza-card';
        div.innerHTML = `
          <div style="height:80px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:40px;">🏪</div>
          <div class="si45">
            <div class="si05">
              <div class="si17">${r.nombreNegocio||r.nombre||'—'}</div>
              <span class="si44">Abierto</span>
            </div>
            <div class="si10">${r.descripcion||r.categoria||'Comercio local'}</div>
            <div class="si46">⭐ Nuevo en la app</div>
            <div class="si47">
              <span class="si62">Ver tienda</span>
              <button class="si48">Contactar →</button>
            </div>
          </div>`;
        lista.appendChild(div);
      });
    } catch(e) { console.log('Plaza error:',e.message); }
  };

  // ===== CARGAR REPARTIDORES (Ride) con acceso directo a db =====
  window.cargarRepartidores = async function() {
    const demoChips = document.getElementById('ride-demo-chips');
    const container = document.querySelector('#v-ride .rider-chips-container');
    try {
      const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(query(collection(db,'usuarios'), where('tipo','==','repartidor')));
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
        chip.innerHTML = `<div class="si11">🏍️</div><div class="si49">${r.nombre||'—'}</div><div class="si50">~${3+i*2} min</div><div class="si63">★ Nuevo</div>`;
        chip.onclick = () => selRider(chip, 55+i*5, r.nombre||'Repartidor', '~'+(3+i*2)+' min');
        if(container) container.appendChild(chip);
      });
    } catch(e) {
      if(demoChips) demoChips.style.display='flex';
      console.log('Ride error:',e.message);
    }
  };

  // ===== CARGAR ANALYTICS reales =====
  window.cargarAnalytics = async function() {
    try {
      const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(db,'usuarios'));
      let vecinos=0,proveedores=0,negocios=0,repartidores=0,pendientes=0;
      snap.forEach(d => {
        const u = d.data();
        if(u.tipo==='vecino') vecinos++;
        else if(u.tipo==='proveedor') proveedores++;
        else if(u.tipo==='negocio'||u.tipo==='restaurante') negocios++;
        else if(u.tipo==='repartidor') repartidores++;
        if(u.estado==='pendiente_revision') pendientes++;
      });
      const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
      set('stat-vecinos',vecinos); set('stat-proveedores',proveedores);
      set('stat-negocios',negocios); set('stat-pendientes-count',pendientes);
      // Update notification badge
      if(pendientes>0) {
        const nb=document.getElementById('notif-solicitudes');
        if(nb){nb.textContent=pendientes;nb.style.display='flex';}
      }
    } catch(e){ console.log('Analytics error:',e.message); }
  };

  // ─── HELPERS ───────────────────────────────────────────
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
  function todosChecks(ids) {
    return ids.every(id => { const el=document.getElementById(id); return el && el.classList.contains('on'); });
  }
  function setNombre(nombre) {
    localStorage.setItem('dcuser', nombre);
    document.querySelectorAll('.user-name-display').forEach(el => el.textContent = nombre);
    const lb = document.getElementById('login-nombre-bienvenido');
    if (lb) lb.textContent = nombre;
  }
  function firebaseError(code) {
    if (code === 'auth/email-already-in-use') return '📧 Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
    if (code === 'auth/weak-password')        return '🔐 La contraseña debe tener mínimo 6 caracteres.';
    if (code === 'auth/invalid-email')        return '📧 Ese correo no tiene formato válido.';
    if (code === 'auth/invalid-credential')   return '❌ Correo o contraseña incorrectos.';
    return '❌ Error: ' + code;
  }

  // ─── REGISTRO VECINO ────────────────────────────────────
  window.registrarVecino = async function() {
    const nombre  = document.getElementById('v-nombre').value.trim();
    const usuario = document.getElementById('v-usr').value.trim();
    const correo  = document.getElementById('v-correo').value.trim();
    const tel     = document.getElementById('v-tel').value.trim();
    const pass1   = document.getElementById('vp1').value;
    const pass2   = document.getElementById('vp2').value;

    if (!nombre||!usuario||!correo||!tel||!pass1)
      return showMsg('v-firebase-msg','⚠️ Llena todos los campos obligatorios','error');
    if (pass1 !== pass2)
      return showMsg('v-firebase-msg','❌ Las contraseñas no coinciden','error');
    if (!todosChecks(['v-chk1','v-chk2']))
      return showMsg('v-firebase-msg','☑️ Debes aceptar los Términos y Condiciones','warn');

    setBtn('btn-reg-vecino','Creando cuenta... ⏳',true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
        nombre, usuario, correo, telefono:tel, tipo:'vecino',
        zona: document.getElementById('zona-sel')?.value||'',
        fraccionamiento: (function(){
          const sel = document.getElementById('frac-sel')?.value||'';
          if(sel==='agregar'){
            const nuevo = (document.getElementById('frac-nuevo-inp')?.value||'').trim();
            const zona = document.getElementById('zona-sel')?.value||'';
            if(nuevo && zona && typeof fracs!=='undefined'){
              if(!fracs[zona]) fracs[zona]=[];
              if(!fracs[zona].includes(nuevo)) fracs[zona].push(nuevo);
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
      setBtn('btn-reg-vecino','Crear mi cuenta →',false);
      showMsg('v-firebase-msg', firebaseError(e.code), 'error');
    }
  };

  // ─── REGISTRO PROVEEDOR ─────────────────────────────────
  window.registrarProv = async function() {
    const nombre    = document.getElementById('p-nombre').value.trim();
    const usuario   = document.getElementById('p-usr').value.trim();
    const correo    = document.getElementById('p-correo').value.trim();
    const tel       = document.getElementById('p-tel').value.trim();
    const categoria = (document.getElementById('p-categoria')||{}).value || '';
    const pass1   = document.getElementById('pp1').value;
    const pass2   = document.getElementById('pp2').value;

    if (!nombre||!usuario||!correo||!tel||!pass1)
      return showMsg('p-firebase-msg','⚠️ Llena todos los campos obligatorios','error');
    if (pass1 !== pass2)
      return showMsg('p-firebase-msg','❌ Las contraseñas no coinciden','error');
    if (!todosChecks(['p-chk1','p-chk2','p-chk3']))
      return showMsg('p-firebase-msg','☑️ Debes aceptar todos los acuerdos para continuar','warn');

    // Fotos son opcionales al registro — se pueden agregar desde perfil
    // (INE se solicita pero no bloquea si no está disponible al momento)

    setBtn('btn-reg-prov','Enviando... ⏳',true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
        nombre, usuario, correo, telefono:tel, tipo:'proveedor', categoria,
        estado:'pendiente_revision', creadoEn: new Date().toISOString()
      });
      notificarBienvenido(nombre, correo, 'proveedor');
      notificarAdmin('Proveedor', nombre, correo, tel);
      setNombre(nombre);
      go('v-ok-rev','right');
    } catch(e) {
      setBtn('btn-reg-prov','Enviar solicitud →',false);
      showMsg('p-firebase-msg', firebaseError(e.code), 'error');
    }
  };

  // ─── REGISTRO TRANSPORTE ────────────────────────────────
  window.registrarRide = async function() {
    const nombre  = document.getElementById('r-nombre').value.trim();
    const usuario = document.getElementById('r-usr').value.trim();
    const correo  = document.getElementById('r-correo').value.trim();
    const tel     = document.getElementById('r-tel').value.trim();
    const pass1   = document.getElementById('rp1').value;
    const pass2   = document.getElementById('rp2').value;

    if (!nombre||!usuario||!correo||!tel||!pass1)
      return showMsg('r-firebase-msg','⚠️ Llena todos los campos obligatorios','error');
    if (pass1 !== pass2)
      return showMsg('r-firebase-msg','❌ Las contraseñas no coinciden','error');
    if (!todosChecks(['r-chk1','r-chk2']))
      return showMsg('r-firebase-msg','☑️ Debes aceptar todos los acuerdos para continuar','warn');

    // Fotos son opcionales al registro (INE, licencia, circulación)
    // Se pueden completar desde el perfil una vez dentro

    setBtn('btn-reg-ride','Enviando... ⏳',true);
    const placas = document.getElementById('r-placas').value.trim();
    const modelo = document.getElementById('r-modelo').value.trim();
    const clabe  = document.getElementById('r-clabe').value.trim();
    if (!placas || !modelo)
      return showMsg('r-firebase-msg','🏍️ Debes llenar los datos de tu vehículo','warn');
    if (!clabe)
      return showMsg('r-firebase-msg','💳 Debes ingresar tu CLABE o correo de Mercado Pago para recibir pagos','warn');

    setBtn('btn-reg-ride','Enviando... ⏳',true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
        nombre, usuario, correo, telefono:tel, tipo:'transporte',
        placas, modelo, cuentaPago:clabe,
        estado:'pendiente_revision', creadoEn: new Date().toISOString()
      });
      notificarBienvenido(nombre, correo, 'transportista');
      notificarAdmin('Transportista', nombre, correo, tel);
      setNombre(nombre);
      go('v-ok-rev','right');
    } catch(e) {
      setBtn('btn-reg-ride','Enviar solicitud →',false);
      showMsg('r-firebase-msg', firebaseError(e.code), 'error');
    }
  };

  // ─── REGISTRO NEGOCIO ───────────────────────────────────
  window.registrarBiz = async function() {
    const nombre  = document.getElementById('b-nombre').value.trim();
    const resp    = document.getElementById('b-resp').value.trim();
    const usuario = document.getElementById('b-usr').value.trim();
    const correo  = document.getElementById('b-correo').value.trim();
    const tel     = document.getElementById('b-tel').value.trim();
    const pass1   = document.getElementById('bp1').value;
    const pass2   = document.getElementById('bp2').value;

    if (!nombre||!resp||!usuario||!correo||!tel||!pass1)
      return showMsg('b-firebase-msg','⚠️ Llena todos los campos obligatorios','error');
    if (pass1 !== pass2)
      return showMsg('b-firebase-msg','❌ Las contraseñas no coinciden','error');
    if (!todosChecks(['b-chk1','b-chk2','b-chk3']))
      return showMsg('b-firebase-msg','☑️ Debes aceptar todos los acuerdos para continuar','warn');

    // Logo e imágenes son opcionales — se pueden agregar desde el perfil una vez activo
    // (recomendado para mayor visibilidad)

    // Validar Mercado Pago
    const mp = document.getElementById('b-mp').value.trim();
    if (!mp)
      return showMsg('b-firebase-msg','💳 Debes ingresar tu cuenta de Mercado Pago','warn');

    setBtn('btn-reg-biz','Enviando... ⏳',true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
        nombreNegocio:nombre, responsable:resp, usuario, correo, telefono:tel,
        tipo:'negocio', mercadoPago:mp,
        estado:'pendiente_revision', creadoEn: new Date().toISOString()
      });
      notificarBienvenido(nombre, correo, 'negocio');
      notificarAdmin('Negocio', nombre, correo, tel);
      setNombre(nombre);
      go('v-ok-rev','right');
    } catch(e) {
      setBtn('btn-reg-biz','Enviar solicitud →',false);
      showMsg('b-firebase-msg', firebaseError(e.code), 'error');
    }
  };

  // ─── CERRAR SESIÓN ──────────────────────────────────────
  window.cerrarSesion = async function() {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      await signOut(auth);
    } catch(e) {}
    localStorage.removeItem('dcuser');
    localStorage.removeItem('dcuserTipo');
    go('v-splash','left');
  };

  // ─── LOGIN (redirige según tipo de usuario) ─────────────
  window.loginFirebase = async function() {
    const input = document.getElementById('login-user').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const err   = document.getElementById('login-err');

    if (!input||!pass) {
      err.style.display='block'; err.textContent='⚠️ Escribe tu usuario/correo y contraseña'; return;
    }
    err.style.display='none';
    const btn = document.querySelector('#v-login .btn-green');
    btn.textContent='Entrando... ⏳'; btn.disabled=true;

    // Detectar si es correo o usuario
    let correoLogin = input;
    const esCorreo = input.includes('@');

    if (!esCorreo) {
      // Buscar el correo asociado al nombre de usuario en Firestore
      try {
        const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
        const q = query(collection(db, 'usuarios'), where('usuario', '==', input));
        const snap = await getDocs(q);
        if (snap.empty) {
          btn.textContent='Entrar →'; btn.disabled=false;
          err.style.display='block'; err.textContent='❌ Usuario no encontrado. ¿Intentas con tu correo?';
          return;
        }
        correoLogin = snap.docs[0].data().correo;
      } catch(e2) {
        btn.textContent='Entrar →'; btn.disabled=false;
        err.style.display='block'; err.textContent='❌ Error al buscar usuario: ' + e2.message;
        return;
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, correoLogin, pass);
      // Leer tipo de usuario desde Firestore
      const snap = await getDoc(doc(db,'usuarios',cred.user.uid));
      btn.textContent='Entrar →'; btn.disabled=false;

      if (snap.exists()) {
        const datos = snap.data();
        setNombre(datos.nombre || datos.nombreNegocio || correoLogin);

        // Guardar tipo en memoria para que otros paneles lo usen
        localStorage.setItem('dcuserTipo', datos.tipo || 'vecino');

        if (datos.tipo === 'vecino') {
          go('v-home','right');
        } else if (datos.tipo === 'proveedor' || datos.tipo === 'transporte' || datos.tipo === 'negocio') {
          if (datos.estado === 'pendiente_revision') {
            go('v-espera-revision','right');
          } else if (datos.estado === 'activo') {
            go('v-home','right');
            setTimeout(() => {
              if('Notification' in window) Notification.requestPermission();
              window.verificarChatsProveedor && window.verificarChatsProveedor();
              window.activarNotificacionesProveedor && window.activarNotificacionesProveedor();
            }, 1500);
          } else {
            go('v-espera-revision','right');
          }
        } else {
          go('v-home','right');
        }
      } else {
        go('v-home','right');
      }
    } catch(e) {
      btn.textContent='Entrar →'; btn.disabled=false;
      err.style.display='block';
      err.textContent = firebaseError(e.code);
    }
  };

