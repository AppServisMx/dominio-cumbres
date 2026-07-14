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
  window._fs = { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot, updateDoc, fsDoc, doc, getDoc, setDoc };

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
    // XSS-SAFE: texto de usuario nunca con innerHTML
    const _tLocal = document.createTextNode(texto);
    const _hLocal = document.createElement('div');
    _hLocal.className = 'msg-time';
    _hLocal.textContent = hora;
    divLocal.appendChild(_tLocal);
    divLocal.appendChild(_hLocal);
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
    } catch(e) { }
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
          // XSS-SAFE: texto de usuario nunca con innerHTML
          const _tMsg = document.createTextNode(m.texto||'');
          const _hMsg = document.createElement('div');
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
      btn.textContent = window.isFav && window.isFav(pid) ? '❤️' : '🤍';
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

  // Observer: carga proveedores automáticamente cuando v-servicios se hace visible
  const _obsServicios = new MutationObserver(() => {
    const v = document.getElementById('v-servicios');
    if(v && v.classList.contains('active')) {
      window.cargarProveedores();
    }
  });
  const _vsEl = document.getElementById('v-servicios');
  if(_vsEl) _obsServicios.observe(_vsEl, { attributeFilter: ['class'] });

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
        if(['activo','aprobado','aprobado_pendiente_pago'].indexOf(p.estado) !== -1) docs.push({id: d.id, ...p});
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
        const premium = p.membresia === 'premium';
        const cnt  = p.ratingTotal || 0;
        const prom = p.ratingPromedio || 0;
        const ratingHtml = cnt > 0
          ? `⭐ ${prom} (${cnt} opinión${cnt>1?'es':''})`
          : 'Nuevo';
        const div = document.createElement('div');
        div.className = 'prov-card';
        div.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
            <div class="prov-av" style="background:${bg};">${ic}<div class="prov-badge" style="background:${premium?'var(--yellow)':'var(--green)'};">${premium?'💎':'✓'}</div></div>
            <div class="si03">
              <div class="si17">${p.nombre||'—'}</div>
              <div class="si01">${p.descripcion||p.oficio1||p.categoria||'Proveedor'}</div>
              <div class="si59">★ ${ratingHtml}</div>
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

  // Override the window functions with real Firebase versions
  window.cargarSolicitudes = window.cargarSolicitudesReal;

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
        + METRIC('0', 'Favoritos', 'panel-favs')
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

    // ── 5. REPUTACIÓN (placeholder, M2-C conectará) ────────────
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

    // ── 6. MÉTRICAS (placeholder, M2-C conectará) ──────────────
    if (tipo !== 'vecino') {
      html += SEC('Métricas (últimos 7 días)');
      html += CARD(
        '<div style="display:flex;gap:8px;margin-bottom:10px;">'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-vis">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Vistas</div></div>'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-cont">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Contactos</div></div>'
        + '<div style="flex:1;background:#f8f8f8;border-radius:10px;padding:10px 8px;text-align:center;"><div style="font-size:18px;font-weight:700;color:'+color+';" id="mp2-met-conv">—</div><div style="font-size:9px;color:#888;margin-top:2px;">Conversiones</div></div>'
        + '</div>'
        + '<div style="font-size:11px;color:#888;line-height:1.45;" id="mp2-met-insight">Conectando con datos reales en M2-C.</div>'
      );
    }

    // Estado de operación: se gestiona únicamente desde Configuración del Centro Operativo

    html += SEC('Cuenta');
    html += '<div style="background:#fff;border-radius:16px;border:.5px solid #e8e8e8;margin:0 14px 12px;overflow:hidden;">';
    html += ACCION('💳','Métodos de pago',"go('vr-config','right')");
    html += ACCION('🔔','Notificaciones',"go('v-notificaciones','right');setTimeout(window.renderNotificaciones,300)");
    if (tipo !== 'vecino') {
      html += ACCION('⭐','Membresía y plan',"go('v-membresia','right');setTimeout(window.cargarMembresia,200)");
      if (tipo === 'proveedor') {
        html += ACCION('👁','Cómo me ve el cliente',"go('v-prov-cmv','right');setTimeout(window.vprovCmvCargar,200)");
      }
      if (tipo === 'restaurante' || tipo === 'negocio') {
        html += ACCION('📣','Crear promoción',"window.irACrearPromo&&window.irACrearPromo()");
      }
    }
    if (tipo === 'vecino') {
      html += ACCION('📅','Mi Agenda',"go('v-mi-agenda','right');setTimeout(function(){window._initMiAgenda&&window._initMiAgenda();},200)");
    }
    html += ACCION_LAST('🚪','Cerrar sesión','cerrarSesion()','#D63A2A');
    html += '</div>';

    html += '<div style="height:8px;"></div>';
    scroll.innerHTML = html;

    // ── Firebase: poblar campos reales ──────────────────────────
    try {
      var user = auth.currentUser;
      if (!user) return;
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDoc(_fb.doc(db, 'usuarios', user.uid));
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
    const user = auth.currentUser;
    if (!user) return;

    const cont   = document.getElementById('mip-contenido');
    const subtit = document.getElementById('mip-tipo-sub');
    if (!cont) return;
    cont.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--white-50);font-size:13px;">Cargando tu perfil...</div>';

    try {
      const { getDoc, doc: _mipDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
      const snap = await getDoc(_mipDoc(db, 'usuarios', user.uid));
      if (!snap.exists()) {
        cont.innerHTML = '<div style="padding:20px;text-align:center;color:var(--white-50);">No se encontraron datos de perfil.</div>';
        return;
      }

      const u = snap.data();
      const tipo = (u.tipo || '').toLowerCase();

      // Helper: field row always shows, empty -> em-dash
      const FR = (label, val) => {
        const v = (val === null || val === undefined || val === '') ? '&#8212;' : String(val);
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
        return '<span style="font-size:12px;font-weight:700;color:'+(col[ee]||'#888')+';">'+(lbl[ee]||e||'&#8212;')+'</span>';
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
              <span class="si44" style="${(()=>{var _e=(typeof window._estadoEfectivoDe==='function')?window._estadoEfectivoDe(r.estadoOp,r.estadoOpTs||0,r.horarios&&r.horarios.length?r.horarios:null):(r.estadoOp||'activo');return _e==='cerrado'?'background:#FDECEA;color:#D63A2A':_e==='pausado'?'background:#FFF0E6;color:#E87722':_e==='ocupado'?'background:#FFF8E1;color:#d97706':'background:var(--green-lt);color:var(--green-dk)';})()}">${(()=>{var _e=(typeof window._estadoEfectivoDe==='function')?window._estadoEfectivoDe(r.estadoOp,r.estadoOpTs||0,r.horarios&&r.horarios.length?r.horarios:null):(r.estadoOp||'activo');return _e==='cerrado'?'🔴 Cerrado':_e==='pausado'?'🟠 Pausado':_e==='ocupado'?'🟡 Ocupado':'🟢 Abierto';})()}</span>
            </div>
            <div style="font-size:11px;color:var(--text-hint);margin-top:3px;">⭐ Nuevo · ${r.descripcion||r.categoria||''}</div>
            <div class="rest-footer"><span class="si01">Envío disponible</span><span class="si16">Pedir →</span></div>
          </div>`;
        div.onclick = () => go('v-food-det','right');
        lista.appendChild(div);
      });
    } catch(e) {
      if(hdr) hdr.innerHTML = '<div class="si09">🟢 Abiertos ahora</div>';
    }
  };

  // ===== CARGAR COMERCIOS (Plaza Online) con acceso directo a db =====
  var _plazaDocsCache = [];
var _plazaFiltro = 'todos';



/* ═══════════════════════════════════════════════════════
   DC TEXT GUARDS — Sanitización visual universal
   Protege tarjetas/detalles de textos largos, HTML pegado,
   emojis repetidos, saltos excesivos y caracteres de control.
═══════════════════════════════════════════════════════ */
window.dcCleanText = window.dcCleanText || function(v, max) {
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
window.dcEscHTML = window.dcEscHTML || function(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
window.dcShortText = window.dcShortText || function(v, max) {
  var t = window.dcCleanText(v, max || 120);
  if (t.length > (max || 120)) t = t.slice(0, (max || 120) - 1).trim() + '…';
  return t;
};


/* DC PERSISTENCE MAP — lectura/escritura homologada
   Productos Restaurante/Negocio: menu/{uid}/productos
   Campos canónicos: nombre, categoria, descripcion, precio, disponible, foto
   Alias públicos sincronizados: categoriaPublica, descripcionPublica, fotoProducto
   Perfil público: usuarios/{uid} con nombreNegocio/nombrePublico, descripcion/descripcionPublica,
   categoria/categoriaPublica, fotoPerfil/fotoPublica, direccionNegocio, estadoOp.
*/
window.dcPersistenciaMapa = window.dcPersistenciaMapa || function(){
  return {
    productos:'menu/{uid}/productos',
    productoCampos:['nombre','categoria','categoriaPublica','descripcion','descripcionPublica','precio','disponible','foto','fotoProducto','orden','creado','actualizado'],
    perfilPublico:'usuarios/{uid}',
    perfilCampos:['nombreNegocio','nombrePublico','descripcion','descripcionPublica','categoria','categoriaPublica','fotoPerfil','fotoPublica','direccionNegocio','estadoOp','estadoOpTs']
  };
};

function _plazaCatNorm(v) {
  return String(v || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' y ')
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'');
}
function _plazaCatKey(v) {
  var n = _plazaCatNorm(v);
  if (!n) return 'otro';
  if (n.indexOf('belleza') !== -1 || n.indexOf('estetica') !== -1 || n.indexOf('barber') !== -1 || n.indexOf('salon') !== -1 || n.indexOf('unas') !== -1) return 'belleza';
  if (n.indexOf('tecnolog') !== -1 || n.indexOf('comput') !== -1 || n.indexOf('celular') !== -1 || n.indexOf('electron') !== -1) return 'tecnologia';
  if (n.indexOf('mascota') !== -1 || n.indexOf('veterin') !== -1 || n.indexOf('pet') !== -1) return 'mascotas';
  if (n.indexOf('hogar') !== -1 || n.indexOf('mueble') !== -1 || n.indexOf('decor') !== -1 || n.indexOf('casa') !== -1) return 'hogar';
  if (n.indexOf('ferreter') !== -1 || n.indexOf('herramient') !== -1) return 'ferreteria';
  if (n.indexOf('papeler') !== -1 || n.indexOf('escolar') !== -1) return 'papeleria';
  if (n.indexOf('regalo') !== -1 || n.indexOf('detalle') !== -1) return 'regalos';
  if (n.indexOf('moda') !== -1 || n.indexOf('ropa') !== -1 || n.indexOf('boutique') !== -1 || n.indexOf('zapato') !== -1) return 'moda';
  if (n.indexOf('salud') !== -1 || n.indexOf('farmacia') !== -1 || n.indexOf('medic') !== -1) return 'salud';
  if (n.indexOf('abarrote') !== -1 || n.indexOf('tienda') !== -1 || n.indexOf('miscelanea') !== -1) return 'tienda';
  if (n.indexOf('servicio') !== -1) return 'servicios';
  if (['moda','belleza','salud','mascotas','tecnologia','hogar','ferreteria','papeleria','regalos','servicios','tienda','comercio','plaza','otro'].indexOf(n) !== -1) return n;
  return n;
}
function _plazaCatLabel(cat) {
  var MAP = {
    moda:'👗 Moda', belleza:'✂️ Belleza', salud:'💊 Salud', mascotas:'🐾 Mascotas',
    tecnologia:'💻 Tecnología', hogar:'🏠 Hogar', ferreteria:'🛠 Ferretería',
    papeleria:'📚 Papelería', regalos:'🎁 Regalos', servicios:'🔧 Servicios',
    tienda:'🏪 Tienda', comercio:'🏪 Comercio', plaza:'🏪 Plaza Online', otro:'🏪 Comercio'
  };
  var k = _plazaCatKey(cat);
  return MAP[k] || (cat ? '🏪 ' + cat : '🏪 Comercio');
}
function _plazaCatBase(r) {
  // Plaza filtra por el concepto público que ve el cliente.
  // Prioridad CMV Negocio: categoriaPublica/giroPublico antes que categoria legacy.
  return r.categoriaPublica || r.giroPublico || r.conceptoPublico || r.categoriaNegocio || r.giro || r.categoria || r.tipoNegocio || 'otro';
}
function _plazaCoincideFiltro(r, filtro) {
  var f = _plazaCatKey(filtro || 'todos');
  if (!f || f === 'todos') return true;
  var n = _plazaCatKey(_plazaCatBase(r));
  if (n === f) return true;
  // "Otros" agrupa comercios cuyo concepto no está en el catálogo principal.
  var principales = ['moda','belleza','salud','mascotas','tecnologia','hogar','ferreteria','papeleria','regalos','servicios','tienda'];
  return f === 'otro' && principales.indexOf(n) === -1;
}

// Regla única Plaza Online: usada por listado y contadores Home.
// Mantiene Plaza como todos los negocios que NO son Food, sin crear un sistema nuevo.
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
window.dcEsComercioPlaza = dcEsComercioPlaza;
function _plazaFiltrarSel(cat) {
  _plazaFiltro = cat || 'todos';
  window._plazaRenderLista && window._plazaRenderLista(_plazaDocsCache);
  var scr = document.getElementById('plaza-scroll'); if (scr) scr.scrollTop = 0;
  if (window._dcDirtyV === 'v-plaza') window._dcDirtyV = null;
}
// BLOQUE 1 PLAZA ONLINE: exponer handler usado por onchange en HTML.
// Sin esto, el select cambia visualmente pero no ejecuta el filtro desde el DOM.
window._plazaFiltrarSel = _plazaFiltrarSel;

window._plazaRenderLista = function(docs) {
  var lista = document.getElementById('plaza-lista');
  var demo  = document.getElementById('plaza-demo');
  var sub   = document.getElementById('plaza-sub');
  if (!lista) return;
  docs = docs || [];
  var filtrados = docs.filter(function(r){ return _plazaCoincideFiltro(r, _plazaFiltro); });
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
      activo:  { lbl:'🟢 Abierto',  col:'var(--green-dk)', bg:'var(--green-lt)' },
      ocupado: { lbl:'🟡 Ocupado',  col:'#d97706',         bg:'#FFF8E1'         },
      pausado: { lbl:'🟠 En pausa', col:'#E87722',          bg:'#FFF0E6'         },
      cerrado: { lbl:'🔴 Cerrado',  col:'#D63A2A',         bg:'#FDECEA'         }
    }[estOp] || { lbl:'🟢 Abierto', col:'var(--green-dk)', bg:'var(--green-lt)' };
    var foto = r.fotoPerfil || r.fotoPublica || r.logo || '';
    var cat = _plazaCatBase(r) || 'Comercio local';
    return '<div class="plaza-card" onclick="window.plazaAbrirComercio(\''+r._id+'\')" style="overflow:hidden;cursor:pointer;'+(estOp==='cerrado'?'opacity:.65;filter:grayscale(.35);':'')+'">'
      + '<div style="height:118px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:42px;position:relative;">'
      + (foto && String(foto).indexOf('data:image')===0 ? '<img src="'+foto+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' : '🏪')
      + (estOp==='cerrado' ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><span style="background:#D63A2A;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;">🔴 CERRADO</span></div>' : '')
      + '<span style="position:absolute;right:10px;top:10px;background:rgba(255,255,255,.92);color:var(--blue);font-size:10px;font-weight:800;padding:4px 8px;border-radius:10px;">✓ Verificado</span>'
      + '</div>'
      + '<div class="si45">'
      + '<div class="si05"><div class="si17">'+(r.nombrePublico || r.nombreNegocio || r.nombre || '—')+'</div>'
      + '<span class="si44" style="background:'+meta.bg+';color:'+meta.col+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;">'+meta.lbl+'</span></div>'
      + '<div class="si10">'+(r.descripcionPublica || r.descripcion || cat || 'Comercio local')+'</div>'
      + '<div class="si46">'+_plazaCatLabel(cat)+' · ⭐ Nuevo en la app</div>'
      + '<div class="si47"><span class="si62">'+(r.direccionNegocio || 'Comercio de la zona')+'</span><button class="si48" style="background:var(--blue);">Ver productos →</button></div>'
      + '</div></div>';
  }).join('');
};

window.cargarPlaza = async function() {
  const lista = document.getElementById('plaza-lista');
  const demo  = document.getElementById('plaza-demo');
  const sel   = document.getElementById('plaza-cat-select');
  if(!lista) return;
  if (sel) sel.value = 'todos';
  _plazaFiltro = 'todos';
  lista.innerHTML = '<div class="si24">Cargando comercios... ⏳</div>';
  try {
    const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(db,'usuarios'), where('tipo','==','negocio')));
    const docs = [];
    snap.forEach(d => {
      const r = d.data();
      const estadoOk = (r.estado === 'activo' || r.estado === 'aprobado_pendiente_pago');
      if(estadoOk && window.dcEsComercioPlaza(r)) docs.push(Object.assign({_id:d.id}, r));
    });
    _plazaDocsCache = docs;
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
  var r = _plazaDocsCache.find(function(x){ return x._id === id; });
  if (!r) return;
  var estOp = (typeof window._estadoEfectivoDe === 'function')
    ? window._estadoEfectivoDe(r.estadoOp, r.estadoOpTs || 0, r.horarios && r.horarios.length ? r.horarios : null)
    : (r.estadoOp || 'activo');
  var g = function(id){ return document.getElementById(id); };
  if (g('plaza-det-nombre')) g('plaza-det-nombre').textContent = '🏪 ' + (r.nombrePublico || r.nombreNegocio || r.nombre || 'Comercio');
  if (g('plaza-det-desc')) g('plaza-det-desc').textContent = window.dcCleanText(r.descripcionPublica || r.descripcion || 'Productos disponibles', 140);
  if (g('plaza-det-cat')) g('plaza-det-cat').textContent = _plazaCatLabel(_plazaCatBase(r));
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
window._plazaSetProdFiltro = function(ev, cat) {
  // BLOQUE 1 PLAZA ONLINE: pestañas de productos robustas.
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
    return '<button type="button" data-no-dirty="1" onclick="return window._plazaSetProdFiltro(event,\'' + cat + '\')" style="white-space:nowrap;border:none;border-radius:18px;padding:8px 13px;font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;background:' + (sel ? 'var(--blue)' : '#E8F0F8') + ';color:' + (sel ? '#fff' : 'var(--blue)') + ';">' + label + '</button>';
  };
  var tabs = '<div style="display:flex;gap:8px;overflow-x:auto;padding:0 14px 10px;">'
    + tabBtn('todos', 'Todos')
    + cats.map(function(c){ return tabBtn(c, _plazaCatLabel(c)); }).join('')
    + '</div>';
  var visibles = prods.filter(function(p){ return f === 'todos' || _plazaCatKey(p.categoria || p.categoriaPublica || 'general') === f; });
  var html = tabs + visibles.map(function(p){
    var foto = p.foto || p.fotoProducto || p.fotoPublica || '';
    var agotado = p.disponible === false;
    return '<div class="plaza-card" onclick="window.plazaAbrirProductoDetalle(\''+p._id+'\')" style="padding:12px;display:flex;gap:12px;align-items:center;cursor:pointer;'+(agotado?'opacity:.72;filter:grayscale(.18);':'')+'">'
      + '<div style="width:64px;height:64px;border-radius:14px;background:#E8F0F8;display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;flex-shrink:0;">'
      + (foto && String(foto).indexOf('data:image')===0 ? '<img src="'+foto+'" style="width:100%;height:100%;object-fit:cover;">' : '📦') + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:14px;font-weight:800;color:#111;">'+window.dcEscHTML(window.dcShortText(p.nombre||'Producto',80))+'</div>'
      + '<div style="font-size:12px;color:#777;line-height:1.4;margin-top:2px;">'+window.dcEscHTML(window.dcShortText(p.descripcion||p.descripcionPublica||p.categoria||'Producto disponible',110))+'</div>'
      + '<div style="font-size:14px;font-weight:900;color:var(--blue);margin-top:6px;">$'+(Number(p.precio||0)).toFixed(0)+'</div>'
      + '<div style="margin-top:5px;">'+(agotado?'<span style="background:#f0f0f0;color:#777;border-radius:8px;padding:3px 7px;font-size:9px;font-weight:800;">⛔ No disponible</span>':'<span style="background:#E8F0F8;color:var(--blue);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:800;">✅ Disponible</span>')+'</div>'
      + '</div>'
      + '<div style="color:#bbb;font-size:20px;">›</div>'
      + '</div>';
  }).join('');
  if (!visibles.length) html += '<div style="padding:28px 20px;text-align:center;font-size:12px;color:#777;">Sin productos en esta pestaña.</div>';
  el.innerHTML = html + '<div style="height:70px;"></div>';
};


window._plazaCarrito = window._plazaCarrito || [];
window._plazaDetalleQty = 1;

window.plazaCerrarProductoDetalle = function(){
  var ov = document.getElementById('plaza-prod-det-ov');
  if (ov) ov.style.display = 'none';
  try { document.body.style.overflow=''; document.body.style.touchAction=''; } catch(e) {}
};

window.plazaCambiarQtyDetalle = function(delta){
  var q = Number(window._plazaDetalleQty || 1) + Number(delta || 0);
  if (q < 1) q = 1;
  if (q > 99) q = 99;
  window._plazaDetalleQty = q;
  var el = document.getElementById('plaza-det-qty-num');
  if (el) el.textContent = String(q);
  return false;
};

window.plazaShowCarritoToast = function(msg){
  // Usa EXACTAMENTE el estilo de confirmación de Configuración (cfg-confirm),
  // pero con el texto de Plaza. No usa toast ni overlay grande.
  var text = (msg || 'Producto agregado al carrito exitosamente.').replace(/^✅\s*/,'');

  var host = document.getElementById('v-plaza-det') || document.querySelector('.view.active') || document.body;
  var id = 'plaza-cfg-confirm';
  var el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'cfg-confirm';
    el.innerHTML = '<div class="cfg-confirm-ic">✅</div>'
      + '<div class="cfg-confirm-txt"><div class="t">Producto agregado</div><div class="s">'+ window.dcEscHTML(text) +'</div></div>';
    host.appendChild(el);
  } else {
    el.innerHTML = '<div class="cfg-confirm-ic">✅</div>'
      + '<div class="cfg-confirm-txt"><div class="t">Producto agregado</div><div class="s">'+ window.dcEscHTML(text) +'</div></div>';
  }

  // Copia visual del cfg-confirm de Configuración, sin depender de #vr-shell.
  el.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(120deg,#0d4220,#1a7a46);padding:14px 18px;display:flex;align-items:center;gap:10px;transform:translateY(100%);transition:transform .32s cubic-bezier(.32,0,.18,1);z-index:999999;pointer-events:none;box-sizing:border-box;';
  var ic = el.querySelector('.cfg-confirm-ic');
  var t  = el.querySelector('.cfg-confirm-txt .t');
  var sub= el.querySelector('.cfg-confirm-txt .s');
  if (ic) ic.style.cssText = 'font-size:20px;flex-shrink:0;';
  if (t)  t.style.cssText  = 'font-size:13px;font-weight:700;color:#fff;';
  if (sub)sub.style.cssText= 'font-size:11px;color:rgba(255,255,255,.7);margin-top:1px;';

  clearTimeout(window._plazaCfgConfirmTimer);
  requestAnimationFrame(function(){ el.style.transform = 'translateY(0)'; });
  window._plazaCfgConfirmTimer = setTimeout(function(){
    el.style.transform = 'translateY(100%)';
  }, 2200);
};

window.plazaAgregarAlCarritoDetalle = function(pid){
  if (window._plazaAgregandoDetalle) return false;
  window._plazaAgregandoDetalle = true;
  var p = (window._plazaProdDocsCache || []).find(function(x){ return String(x._id) === String(pid); });
  if (!p || p.disponible === false) { window._plazaAgregandoDetalle = false; return false; }
  var qty = Math.max(1, Number(window._plazaDetalleQty || 1));
  var comercioId = window._plazaComercioActualId || window._plazaDetalleComercioId || p.uidNegocio || p.negocioId || '';
  var key = String(comercioId || '') + '::' + String(pid);
  var item = window._plazaCarrito.find(function(x){ return x.key === key; });
  if (item) item.cantidad += qty;
  else window._plazaCarrito.push({
    key:key,
    productoId:pid,
    negocioId:comercioId,
    nombre:p.nombre || 'Producto',
    precio:Number(p.precio || 0),
    cantidad:qty,
    foto:p.foto || p.fotoProducto || p.fotoPublica || '',
    categoria:p.categoria || p.categoriaPublica || 'Producto'
  });
  try { localStorage.setItem('dcPlazaCarrito', JSON.stringify(window._plazaCarrito)); } catch(e) {}
  window.plazaCerrarProductoDetalle();
  setTimeout(function(){
    window.plazaShowCarritoToast('✅ Producto agregado al carrito exitosamente');
    window._plazaAgregandoDetalle = false;
  }, 80);
  return false;
};

window.plazaAbrirProductoDetalle = function(pid){
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
        + '<div id="dc-legacy-plaza-det-qty-num-1" data-dc-legacy-id="plaza-det-qty-num" style="min-width:24px;text-align:center;font-size:18px;font-weight:900;color:#111;">1</div>'
        + '<button type="button" onclick="return window.plazaCambiarQtyDetalle(1)" style="width:40px;height:40px;border:none;border-radius:12px;background:var(--yellow);color:#111;font-size:22px;font-weight:900;font-family:inherit;line-height:40px;box-shadow:0 2px 7px rgba(0,0,0,.10);">+</button>'
        + '</div>' : '')
    + '<button type="button" '+(agotado?'disabled':'')+' onclick="return window.plazaAgregarAlCarritoDetalle(\''+String(pid).replace(/'/g,"\\'")+'\')" style="width:100%;padding:14px;border:none;border-radius:17px;background:'+(agotado?'#ddd':'var(--blue)')+';color:#fff;font-size:13px;font-weight:900;font-family:inherit;cursor:'+(agotado?'not-allowed':'pointer')+';box-shadow:0 8px 16px rgba(26,122,181,.20);letter-spacing:.2px;">'+(agotado?'No disponible':'🛒 AGREGAR AL CARRITO')+'</button>'
    + '</div></div>';
  ov.style.display = 'flex';
  try { document.body.style.overflow='hidden'; document.body.style.touchAction='none'; } catch(e) {}
};

window.plazaCargarProductos = async function(uidNegocio, negocio, estOp) {
  var el = document.getElementById('plaza-prod-lista');
  if (!el) return;
  el.innerHTML = '<div class="si24">Cargando productos... ⏳</div>';
  if (estOp === 'cerrado' || estOp === 'pausado') {
    el.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">'+(estOp==='pausado'?'⏸️':'🔴')+'</div><div style="font-size:14px;font-weight:800;color:#111;margin-bottom:6px;">'+(negocio.nombrePublico||negocio.nombreNegocio||'El comercio')+' no está disponible</div><div style="font-size:12px;color:#777;line-height:1.5;">Puedes ver sus productos más tarde cuando esté abierto.</div></div>';
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
  window.cargarMisComprasPlaza && window.cargarMisComprasPlaza();
};

window.cargarMisComprasPlaza = async function() {
  var el = document.getElementById('miscompras-plaza-lista');
  var sub = document.getElementById('miscompras-plaza-sub');
  var bProc = document.getElementById('miscompras-tab-proceso');
  var bAnt  = document.getElementById('miscompras-tab-anteriores');
  if (!el) return;
  if (!_misComprasPlazaTab) _misComprasPlazaTab = 'proceso';
  if (sub) sub.textContent = _misComprasPlazaTab === 'anteriores' ? 'Compras anteriores' : 'Compras en proceso';
  if (bProc && bAnt) {
    bProc.style.background = _misComprasPlazaTab === 'proceso' ? 'var(--blue)' : 'rgba(255,255,255,.18)';
    bProc.style.color = '#fff';
    bAnt.style.background = _misComprasPlazaTab === 'anteriores' ? 'var(--blue)' : 'rgba(255,255,255,.18)';
    bAnt.style.color = '#fff';
  }
  try {
    // Por ahora Plaza Online no genera orden de compra cerrada; dejamos ambas pestañas listas para conectar.
    el.scrollTop = 0;
    var esAnt = _misComprasPlazaTab === 'anteriores';
    el.innerHTML = '<div style="padding:36px 20px;text-align:center;">'
      + '<div style="font-size:42px;margin-bottom:12px;">'+(esAnt?'📦':'🛒')+'</div>'
      + '<div style="font-size:15px;font-weight:800;color:#111;margin-bottom:6px;">'+(esAnt?'Sin compras anteriores':'Sin compras en proceso')+'</div>'
      + '<div style="font-size:12px;color:#777;line-height:1.5;">'+(esAnt?'Cuando finalices compras en Plaza Online, aparecerán aquí.':'Cuando compres productos en Plaza Online, aparecerán aquí.')+'</div>'
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div class="si24">Error al cargar Mis compras: '+e.message+'</div>';
  }
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
    } catch(e) { }
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
  function firebaseError(code) {
    if (code === 'auth/email-already-in-use') return '📧 Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
    if (code === 'auth/weak-password')        return '🔐 La contraseña debe tener mínimo 6 caracteres.';
    if (code === 'auth/invalid-email')        return '📧 Ese correo no tiene formato válido.';
    if (code === 'auth/invalid-credential')   return '❌ Correo o contraseña incorrectos.';
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
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
        nombre, usuario, correo,
        prefijoWhatsapp:_prefijo, telefono:_numLimpio, whatsapp:_telFull,
        calle, numero, direccion: calle + ' ' + numero, tipo:'vecino',
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
      const cred = await createUserWithEmailAndPassword(auth, correo, pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
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
      const cred=await createUserWithEmailAndPassword(auth,correo,pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
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
      const cred=await createUserWithEmailAndPassword(auth,correo,pass1);
      await setDoc(doc(db,'usuarios',cred.user.uid),{
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
  var DC_ESTADOS = {
    activo:  { ic:'🟢', lbl:'Activo',  col:'#1FC26A', bg:'#E8F5EE', desc:'Recibiendo pedidos y solicitudes' },
    ocupado: { ic:'🟡', lbl:'Ocupado', col:'#9A6800', bg:'#FFF8E1', desc:'Respuesta más lenta' },
    pausado: { ic:'🟠', lbl:'Pausado', col:'#E87722', bg:'#FFF0E6', desc:'Sin nuevos pedidos por ahora', dotEl:'naranja' },
    cerrado: { ic:'🔴', lbl:'Cerrado', col:'#D63A2A', bg:'#FDECEA', desc:'No disponible hoy' },
  };
  // REGLA UNIVERSAL DE ESTADO: catálogo unificado (Mi Panel = Configuración).
  // Estados antiguos guardados (vacaciones/invisible/fuera_horario) se tratan como Pausado.
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
                 || localStorage.getItem('dcuserUid')
                 || localStorage.getItem('dcuid');
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
    var uid = localStorage.getItem('dcuid');
    var db = window._fbDb;
    if (!uid || !db) { return; }
    try {
      var f = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      await f.setDoc(f.doc(db,'usuarios',uid),{direccionNegocio:dir},{merge:true});
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

  // offset 0 = mes actual, -1 = mes anterior, etc.
  window._vmrMesOffset = 0;
  window._cargarRestStats = function() {
    window._vmrMesOffset = 0;
    window._calcMetricasMes && window._calcMetricasMes();
  };
  window._vmrMesCambiar = function(dir) {
    var nuevo = window._vmrMesOffset + dir;
    if (nuevo > 0) nuevo = 0;               // no hay futuro
    window._vmrMesOffset = nuevo;
    window._calcMetricasMes && window._calcMetricasMes();
  };
  // Métricas del MES seleccionado + acumulado total. Todo Firestore real.
  window._calcMetricasMes = async function() {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    var uid = user.uid;
    var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    var hoy = new Date();
    var ref = new Date(hoy.getFullYear(), hoy.getMonth() + window._vmrMesOffset, 1);
    var ini = ref.getTime();
    var fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime();
    setTxt('vmr-mes-label', MESES[ref.getMonth()] + ' ' + ref.getFullYear());
    var btnNext = document.getElementById('vmr-mes-next');
    if (btnNext) btnNext.style.opacity = window._vmrMesOffset >= 0 ? '.35' : '1';
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',uid)));
      var nPed=0, venta=0, acum=0;
      snap.forEach(function(d){
        var p = d.data();
        if (p.estado !== 'entregado') return;
        acum += (p.total||0);                          // acumulado de siempre
        var fch = p.fecha||0;
        if (fch >= ini && fch < fin) { nPed++; venta += (p.total||0); } // del mes
      });
      setTxt('vmr-pedidos', nPed);
      setTxt('vmr-ventas', '$'+venta);
      setTxt('vmr-acumulado', '$'+acum);
      var vs = await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'), _fb.where('restauranteId','==',uid)));
      var tr=0, cr=0; vs.forEach(function(d){ var v=d.data(); if(v.ratingRestaurante){ tr+=v.ratingRestaurante; cr++; } });
      setTxt('vmr-rating', cr>0 ? (tr/cr).toFixed(1)+'\u2605' : '—');
    } catch(e) { }
  };

  // Métricas reales del restaurante desde Firestore. modo: 'hoy' | 'acumulado'
  window._calcMetricasRest = async function(modo) {
    var user = window._fbAuth && window._fbAuth.currentUser;
    var _db = window._fbDb;
    if (!user || !_db) return;
    var uid = user.uid;
    var setTxt = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
    try {
      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
      var snap = await _fb.getDocs(_fb.query(_fb.collection(_db,'pedidos'), _fb.where('restauranteId','==',uid)));
      var hoy0 = new Date(); hoy0.setHours(0,0,0,0); var hoyMs = hoy0.getTime();
      var nPed = 0, venta = 0;
      snap.forEach(function(d){
        var p = d.data();
        if (p.estado !== 'entregado') return;            // solo entregados cuentan
        if (modo === 'hoy' && (p.fecha||0) < hoyMs) return; // solo de hoy
        nPed++; venta += (p.total||0);
      });
      // Rating: promedio acumulado real (mismo en ambos modos)
      var vs = await _fb.getDocs(_fb.query(_fb.collection(_db,'valoraciones'), _fb.where('restauranteId','==',uid)));
      var tr=0, cr=0; vs.forEach(function(d){ var v=d.data(); if(v.ratingRestaurante){ tr+=v.ratingRestaurante; cr++; } });
      var rating = cr>0 ? (tr/cr).toFixed(1) : '—';
      if (modo === 'hoy') {
        setTxt('rhome-pedidos', nPed);  // entregados hoy (lo ya vendido)
        // Por aceptar y En proceso: mismos grupos que Mis Pedidos (coinciden exacto)
        var GP_NUEVO = ['nuevo'];
        var GP_PROC  = ['aceptado','preparando','listo','buscando_repartidor','repartidor_asignado','en_camino','recogido'];
        var nAcep=0, nProc=0;
        snap.forEach(function(d){
          var e = (d.data().estado)||'';
          if (GP_NUEVO.indexOf(e)!==-1) nAcep++;
          else if (GP_PROC.indexOf(e)!==-1) nProc++;
        });
        setTxt('rhome-poraceptar', nAcep);
        setTxt('rhome-enproceso', nProc);
        var ledSet = function(cardId, on){ var c=document.getElementById(cardId); if(c){ c.classList.toggle('led-on', !!on); } };
        ledSet('card-poraceptar', nAcep>0);
        ledSet('card-pedidoshoy', nPed>0);
        ledSet('card-enproceso', nProc>0);
      } else {
        setTxt('vmr-pedidos', nPed);
        setTxt('vmr-ventas', '$'+venta);
        setTxt('vmr-rating', rating==='—'?'—':rating+'\u2605');
      }
    } catch(e) { }
  };
  // ── FIN M2-F helpers ─────────────────────────────────────────

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
        _fb.query(_fb.collection(db,'usuarios'), _fb.where('tipo','==','proveedor'))
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

  // renderBusqueda: no-op. v-busqueda usa window._renderBusqueda.
  window.renderBusqueda = function(q) {};

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
      favs.unshift({ id:id, tipo:'proveedor', nombre:p.nombre||'—',
                     categoria:p.categoria||'', descripcion:p.descripcion||'',
                     datos: p, fecha: Date.now() });
    }
    localStorage.setItem(_favKey(), JSON.stringify(favs));
    // Actualizar botón si está visible
    var btn = document.getElementById('det-fav-btn');
    if (btn) btn.textContent = window.isFav(id) ? '❤️' : '🤍';
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

  // FIX B: los puntitos se refrescan solos cada 45 seg sin navegar
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
    // Actualizar notif-dot en nav: mostrar si hay cualquier no leída
    var total = notifs.filter(function(n){ var m=n.modulo||''; var t=n.tipo||''; return !n.leida && m!=='pedidos' && m!=='chat' && t!=='chat' && t!=='pedido'; }).length;
    window._lastBadgeCheck = Date.now();
    var totPed = notifs.filter(function(n){ return !n.leida && (n.modulo||'') === 'pedidos'; }).length;
    document.querySelectorAll('.nav-ped-dot').forEach(function(el) {
      el.style.display = totPed > 0 ? 'inline-block' : 'none';
      el.textContent = totPed > 99 ? '99+' : (totPed || '');
    });
    document.querySelectorAll('.notif-dot:not(.nav-ped-dot)').forEach(function(el) {
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

  window._initAgenda = function() {
    window._renderAgenda && window._renderAgenda();
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
      // 1. auth.currentUser.uid si ya está disponible
      // 2. Esperar hasta 3s a que Firebase inicialice auth
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

      // Intento 3: fallback local si Firebase no respondió
      // El usuario está logueado en la app aunque auth tarde
      if (!vecinoUid) {
        // Tier 2: uid guardado en localStorage durante el login
        var savedUid = localStorage.getItem('dcuserUid') || '';
        if (savedUid) {
          vecinoUid = savedUid;
        } else {
          // Tier 3: uid sintético por nombre+tipo (solo si hay usuario identificado)
          var dcuser = localStorage.getItem('dcuser') || '';
          var dcTipo = localStorage.getItem('dcuserTipo') || 'vecino';
          if (!dcuser) {
            return { ok: false, msg: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
          }
          vecinoUid = 'local_' + dcTipo + '_' + dcuser.replace(/\s+/g,'').toLowerCase();
        }
      }

      var _fb = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');

      // Verificar duplicado (solo si uid real de Firebase, no local)
      if (!vecinoUid.startsWith('local_')) {
        var qDup = _fb.query(
          _fb.collection(db, 'reservas'),
          _fb.where('vecinoUid', '==', vecinoUid),
          _fb.where('proveedorUid', '==', reserva.proveedorUid),
          _fb.where('dia', '==', reserva.dia),
          _fb.where('hora', '==', reserva.hora)
        );
        var dupSnap = await _fb.getDocs(qDup);
        if (!dupSnap.empty) return { ok: false, msg: 'Ya tienes una reserva con este proveedor ese día y hora.' };
      }

      // LOG DIAGNÓSTICO
      // Guardar reserva en Firestore
      var docRef = await _fb.addDoc(_fb.collection(db, 'reservas'), {
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
        await _fb.addDoc(_fb.collection(db, 'notificaciones'), {
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
      await _fb.updateDoc(_fb.doc(db, 'reservas', reservaId), { estado: nuevoEstado });
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
  window._dcConfirmar = function(msg, onSi, onNo) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;">'
      + '<div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:16px;line-height:1.4;">' + msg + '</div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="_dcCNo" style="flex:1;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif;">Cancelar</button>'
      + '<button id="_dcCSi" style="flex:1;background:#D63A2A;color:#fff;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Confirmar</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    function cerrar(){ if(ov.parentNode) document.body.removeChild(ov); }
    ov.querySelector('#_dcCSi').onclick = function(){ cerrar(); if(onSi) onSi(); };
    ov.querySelector('#_dcCNo').onclick = function(){ cerrar(); if(onNo) onNo(); };
    ov.onclick = function(e){ if(e.target===ov){ cerrar(); if(onNo) onNo(); } };
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

  // ── M2-A: renderHomeM2 — Home multirol real ──────────────────
  // Lee tipo/estado/nombre de localStorage (escritos por loginFirebase).
  // Reescribe SOLO el interior del scroll de v-home.
  // No crea vistas nuevas. No toca go(). No toca login.
  window.renderHomePersonalizado = window.renderHomeM2 = function() {
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

    // ── M2-G: Mostrar barra de búsqueda solo para vecino/negocio (no restaurante)
    var searchWrap = document.getElementById('home-search-wrap');
    if (searchWrap) {
      var showSearch = ['vecino','negocio'].indexOf(tipo) !== -1;
      searchWrap.style.display = showSearch ? 'block' : 'none';
    }

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

    // ── 3. Contenido del scroll ────────────────────────────────
    var scroll = document.querySelector('#v-home .scroll');
    if (!scroll) return;

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
      return '<div onclick="' + ruta + '" style="position:relative;background:#fff;border-radius:16px;padding:14px 14px 13px;display:flex;flex-direction:column;gap:9px;border:.5px solid #e8e8e8;box-shadow:0 1px 4px rgba(0,0,0,.05);cursor:pointer;">'
        + dot
        + '<div style="width:40px;height:40px;border-radius:11px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:20px;">' + ic + '</div>'
        + '<div><div style="font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.2;">' + lbl + '</div>'
        + (sub ? '<div style="font-size:10px;color:#888;margin-top:2px;">' + sub + '</div>' : '')
        + '</div></div>';
    }

    function secLabel(txt) {
      return '<div style="font-size:10px;font-weight:700;color:#999;letter-spacing:.8px;text-transform:uppercase;padding:0 18px;margin-bottom:10px;">'+txt+'</div>';
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
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:0 14px;margin-bottom:12px;">'
        + modulo('🍽️','#FDECEA','Pedir Comida','<span id="hm-mod-food">...</span>',"go('v-food','right')")
        + modulo('🔧','#e8f5e1','Servicios','<span id="hm-mod-serv">...</span>',"go('v-servicios','right')")
        + modulo('🚗','#F5F5F5','Ride','Proximamente',"window._dcProximamente('Ride estará disponible próximamente.')")
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
        + modulo('⭐','#FFF8DC','Membresía','Estado y plan',"go('v-membresia','right');setTimeout(window.cargarMembresia,200)")
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
        + '<div id="card-poraceptar" onclick="window._irPedidosRestTab&&window._irPedidosRestTab(\'pedidos\')" class="rhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-poraceptar" style="font-size:20px;font-weight:800;color:#D63A2A;">0</div><div style="font-size:9px;color:#999;">🔴 Por aceptar</div></div>'
        + '<div id="card-pedidoshoy" class="rhome-card" style="background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-pedidos" style="font-size:20px;font-weight:800;color:#D63A2A;">0</div><div style="font-size:9px;color:#999;">Pedidos hoy</div></div>'
        + '<div id="card-enproceso" onclick="window._irPedidosRestTab&&window._irPedidosRestTab(\'en_proceso\')" class="rhome-card" style="cursor:pointer;background:#fff;border-radius:12px;padding:10px 8px;text-align:center;"><div id="rhome-enproceso" style="font-size:20px;font-weight:800;color:#D63A2A;">0</div><div style="font-size:9px;color:#999;">👨‍🍳 En proceso</div></div>'
        + '</div>';

      // Botón principal CENTRO OPERATIVO
      html += '<div style="padding:0 14px;margin-bottom:20px;">'
        + '<button onclick="go(\'vr-home\',\'right\')" '
        + 'style="width:100%;background:linear-gradient(135deg,#7A1810,#D63A2A);border:none;border-radius:16px;padding:18px 14px;font-size:16px;font-weight:800;color:#fff;cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 20px rgba(214,58,42,.35);letter-spacing:.3px;">'
        + '<span style="font-size:22px;">🚀</span> CENTRO OPERATIVO'
        + '</button>'
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
    // M2-G: poblar descubrimiento si el contenedor fue inyectado
    window.renderDescubrimiento && window.renderDescubrimiento('home-discover-list');
  };
  // ── FIN M2-A ─────────────────────────────────────────────────
  window.cerrarSesion = async function() {
    // 1. Cerrar sesión Firebase
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      await signOut(auth);
    } catch(e) {}
    // 2. Limpiar localStorage de sesión
    localStorage.removeItem('dcuser');
    localStorage.removeItem('dc_badges_v1'); // limpiar badges al cerrar sesión
    // G1: guardar uid ANTES de eliminarlo para poder limpiar claves por uid
    var _dcLogoutUid = localStorage.getItem('dcuserUid') || '';
    localStorage.removeItem('dcuserUid');    // limpiar uid guardado
    localStorage.removeItem('dcuserTipo');
    localStorage.removeItem('dcuserEstado');
    // 3. Cancelar subscripciones activas
    if(window._chatUnsubscribe){window._chatUnsubscribe();window._chatUnsubscribe=null;}
    if(window._provNotifUnsub){window._provNotifUnsub();window._provNotifUnsub=null;}
    // B10: cancelar listener en vivo del restaurante en Food
    if(window._restEstadoUnsub){window._restEstadoUnsub();window._restEstadoUnsub=null;}
    // B11: detener timers de estado y badges
    if(window._rHoraTimer){clearInterval(window._rHoraTimer);window._rHoraTimer=null;}
    if(window._nHoraTimer){clearInterval(window._nHoraTimer);window._nHoraTimer=null;}
    if(window._badgeTimer){clearInterval(window._badgeTimer);window._badgeTimer=null;}
    // 4. Limpiar variables globales de sesión
    window._chatProveedorId=null; window._chatProveedorNombre=null;
    window._chatIdExacto=null; window._chatUserId=null;
    window._proveedorActual=null; window._reporteActualId=null;
    window._filtroMain=null; window._filtroSub=null;
    var _fBR=document.getElementById('fbtn-rechazados');if(_fBR)_fBR.classList.remove('on');
    window._todosUsuarios=[];
    // 5. Limpiar nombre en pantalla
    document.querySelectorAll('.user-name-display').forEach(el=>el.textContent='Usuario');
    // 6. Limpiar formularios de registro
    ['v-nombre','v-usr','v-correo','v-tel','vp1','vp2','v-calle','v-numero',
     'p-nombre','p-usr','p-correo','p-tel','pp1','pp2',
     'r-nombre','r-usr','r-correo','r-tel','rp1','rp2',
     'p-calle','p-numero-prov','p-colonia','p-descripcion',
     'r-marca','r-modelo','r-color','r-placas','r-descripcion',
     'b-nombre-comercial','b-nombre','b-usr','b-correo','b-tel','bp1','bp2',
     'b-calle','b-numero','b-colonia','b-descripcion',
     'b-cat-otro-rest','b-cat-otro-neg',
     'login-user','login-pass'
    ].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    // 7. Limpiar mensajes de error de formularios
    ['v-firebase-msg','p-firebase-msg','r-firebase-msg','b-firebase-msg','login-err']
      .forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='';el.style.display='none';}});
    // Bug 4: limpiar divs de feedback de biz
    ['b-usr-st','b-correo-st','b-tel-st','b-desc-st']
      .forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
    // Limpiar home personalizado
    const _htd=document.getElementById('home-tarjeta-destacada'); if(_htd)_htd.innerHTML='';
    const _htl=document.getElementById('home-tipo-label'); if(_htl){_htl.innerHTML='&#128274; Dominio Cumbres &middot; Zona privada';_htl.style.color='rgba(255,255,255,.2)';}
    const _hs=document.getElementById('home-saludo'); if(_hs)_hs.textContent='Bienvenido,';
    // 8. Limpiar selects de registro (selectedIndex=0 fuerza 'Selecciona tu zona')
    ['zona-sel','frac-sel',
     'b-tipo-negocio','b-cat-restaurante','b-cat-negocio',
     'b-operacion','b-entrega','b-cobertura','b-anios','b-tel-prefijo'
    ].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.value='';el.selectedIndex=0;}
    });
    // Ocultar grupos de categoría de biz
    if(typeof bTipoChange==='function')bTipoChange();
    // Limpiar checkboxes de términos (quitar clase 'on' de todos los formularios)
    ['v-chk1','v-chk2',
     'p-chk1','p-chk2','p-chk3',
     'r-chk1','r-chk2','r-chk3','r-chk4',
     'b-chk1','b-chk2','b-chk3','b-chk4'
    ].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.classList.remove('on');
    });
    const ab=document.getElementById('agregar-box');
    if(ab)ab.classList.remove('show');
    const fi=document.getElementById('frac-nuevo-inp');
    if(fi)fi.value='';
    const fg=document.getElementById('frac-group');
    if(fg)fg.style.display='none';
    const cg=document.getElementById('calle-group');
    if(cg)cg.style.display='none';
    // 9. Limpiar contenedores de listas para evitar 'Cargando...' al re-entrar
    ['mis-reportes-lista','reportes-disponibles-lista','servicios-lista',
     'lista-mis-chats','favs-lista','sol-zona-perfil'
    ].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.innerHTML='';
    });
    // 10. Navegar a splash limpio
    // B2: limpiar estado operativo de sesión anterior para evitar contaminación
    try { localStorage.removeItem('dcRestOpV2'); } catch(e){}
    try { localStorage.removeItem('dcRestOpV2Ts'); } catch(e){}
    // Limpiar claves por uid para que no contaminen la siguiente sesión
    try { if(_dcLogoutUid){ localStorage.removeItem('dcuserEstadoOp_'+_dcLogoutUid); localStorage.removeItem('dcuserEstadoOpTs_'+_dcLogoutUid); } } catch(e){}
    // Resetear variables de estado en memoria
    if (typeof _rEstadoOp !== 'undefined') { try { _rEstadoOp = 'activo'; } catch(e){} }
    if (typeof _rEstadoOpTs !== 'undefined') { try { _rEstadoOpTs = 0; } catch(e){} }
    if (typeof _vnegEstadoOp !== 'undefined') { try { _vnegEstadoOp = 'activo'; } catch(e){} }
    if (typeof _vnegEstadoOpTs !== 'undefined') { try { _vnegEstadoOpTs = 0; } catch(e){} }
    // F7: resetear horarios en memoria para que no contaminen la siguiente sesión
    try { if (typeof HORARIOS !== 'undefined' && Array.isArray(HORARIOS)) { HORARIOS.forEach(function(h){ h.abre='08:00'; h.cierra='22:00'; h.abierto=(h.id!=='dom'); }); } } catch(e){}
    try { if (typeof VNEG_HORARIOS !== 'undefined' && Array.isArray(VNEG_HORARIOS)) { VNEG_HORARIOS.forEach(function(h){ h.abre='08:00'; h.cierra='22:00'; h.abierto=(h.id!=='dom'); }); } } catch(e){}
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

        // Normalizar estado para evitar errores por espacios, mayúsculas o undefined
        const estado = String(datos.estado || '').trim().toLowerCase();

        // Guardar tipo y estado normalizados en localStorage
        localStorage.setItem('dcuserTipo', datos.tipo || 'vecino');
        localStorage.setItem('dcuserEstado', estado);
        // Guardar uid de Firebase para uso como fallback en funciones async
        if (auth && auth.currentUser) {
          localStorage.setItem('dcuserUid', auth.currentUser.uid);
        }
        // CRÍTICO: cargar el estado real del usuario desde Firebase ANTES de navegar al home
        // para que _vnegEstadoOp y _rEstadoOp tengan el valor correcto en el primer render.
        if (datos.tipo === 'restaurante' || datos.tipo === 'negocio') {
          var _estOp = datos.estadoOp || 'activo';
          var _estTs = datos.estadoOpTs || 0;
          var _uid   = auth && auth.currentUser ? auth.currentUser.uid : '';
          // Escribir localStorage con el valor del usuario actual
          try { localStorage.setItem('dcRestOpV2',   _estOp); } catch(e) {}
          try { localStorage.setItem('dcRestOpV2Ts', String(_estTs)); } catch(e) {}
          if (_uid) { try { localStorage.setItem('dcuserEstadoOp_' + _uid, _estOp); } catch(e) {} }
          if (_uid && _estTs) { try { localStorage.setItem('dcuserEstadoOpTs_' + _uid, String(_estTs)); } catch(e) {} }
          if (_uid && !_estTs) { try { localStorage.setItem('dcuserEstadoOpTs_' + _uid, '0'); } catch(e) {} }
          // Para negocio: llamar vnegCargarConfig que setea _vnegEstadoOp y VNEG_HORARIOS
          // correctamente antes de que renderHomeM2 pinte la tarjeta de estado.
          if (datos.tipo === 'negocio' && window.vnegCargarConfig) {
            await window.vnegCargarConfig();
          }
          // Para restaurante: _restCargarHorariosYRepintar se llama al entrar al home (ya funciona)
        }

        if (datos.tipo === 'vecino') {
          go('v-home','right');
        } else if (['proveedor','transporte','repartidor','ambos','negocio','restaurante'].includes(datos.tipo)) {
          if (estado === 'pendiente_revision') {
            go('v-espera-revision','right');
          } else if (estado === 'aprobado_pendiente_pago') {
            go('v-espera-pago','right');
          } else if (estado === 'suspendido') {
            go('v-cuenta-suspendida','right');
          } else if (estado === 'rechazado') {
            go('v-solicitud-rechazada','right');
            // Mostrar motivoRechazo si existe
            setTimeout(async () => {
              try {
                const { getDoc: _gd, doc: _d } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');
                const _snap = await _gd(_d(db,'usuarios',cred.user.uid));
                const _motivo = _snap.exists() ? (_snap.data().motivoRechazo||'') : '';
                const _box = document.getElementById('v-rechazo-motivo-box');
                const _txt = document.getElementById('v-rechazo-motivo-txt');
                if (_motivo && _box && _txt) { _txt.textContent=_motivo; _box.style.display='block'; }
              } catch(_e) {}
            }, 300);
          } else if (estado === 'activo') {
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

