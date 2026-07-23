  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
  import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
  import { getStorage } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js";
  import { getFunctions } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-functions.js";

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

  const storage = getStorage(app);
  const fns = getFunctions(app);
  // Exponer en window para acceso desde scripts regulares
  window._fbAuth      = auth;
  window._fbDb        = db;
  window._fbStorage   = storage;
  window._fbFunctions = fns;

  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  // Importar funciones Firestore una sola vez
  const { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot, updateDoc, doc: fsDoc } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js");
  window._fs = { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, onSnapshot, updateDoc, fsDoc, doc, getDoc, setDoc };

  window._fbCreateUser = createUserWithEmailAndPassword;


  var DC_ESTADOS = {
    activo:  { ic:'🟢', lbl:'Activo',  col:'#1FC26A', bg:'#E8F5EE', desc:'Recibiendo pedidos y solicitudes' },
    ocupado: { ic:'🟡', lbl:'Ocupado', col:'#9A6800', bg:'#FFF8E1', desc:'Respuesta más lenta' },
    pausado: { ic:'🟠', lbl:'Pausado', col:'#E87722', bg:'#FFF0E6', desc:'Sin nuevos pedidos por ahora', dotEl:'naranja' },
    cerrado: { ic:'🔴', lbl:'Cerrado', col:'#D63A2A', bg:'#FDECEA', desc:'No disponible hoy' },
  };
  window._DC_ESTADOS = DC_ESTADOS;
  // REGLA UNIVERSAL DE ESTADO: catálogo unificado (Mi Panel = Configuración).
  // Estados antiguos guardados (vacaciones/invisible/fuera_horario) se tratan como Pausado.

  // Error messages para loginFirebase
  function firebaseError(code) {
    if (code === 'auth/email-already-in-use')    return '📧 Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
    if (code === 'auth/weak-password')           return '🔐 La contraseña debe tener mínimo 6 caracteres.';
    if (code === 'auth/invalid-email')           return '📧 Ese correo no tiene formato válido.';
    if (code === 'auth/invalid-credential')      return '❌ Correo o contraseña incorrectos.';
    if (code === 'auth/network-request-failed')  return '⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    if (!navigator.onLine)                       return '⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    return '❌ Error: ' + code;
  }

  window.cerrarSesion = async function() {
    // 1. Cerrar sesión Firebase
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
      await signOut(auth);
    } catch(e) {}
    // 2. Limpiar localStorage de sesión
    localStorage.removeItem('dcuser');
    localStorage.removeItem('dc_badges_v1');
    // G1: guardar uid ANTES de eliminarlo para poder limpiar claves por uid
    var _dcLogoutUid = localStorage.getItem('dcuserUid') || '';
    localStorage.removeItem('dcuserUid');
    localStorage.removeItem('dcuserTipo');
    // Limpiar datos de plaza para evitar fuga entre usuarios en mismo dispositivo
    ['dcPlazaCartV61','dcPlazaOrdenActivaV62','dcPlazaCompraSeleccionada',
     'dcPlazaComprasHistorial','dcPlazaOrdenesPlazaV62',
     'dcPlazaCartV61Meta','dcPlazaB2AMeta','dcPlazaCartMetaV63',
     'dcPlazaQF42Tab','dcPlazaL14CartOpen','dcPlazaL14VaciarOpen',
     'dcPlazaL14OrderOpen','dcPlazaTransferenciaRef',
     'dcPlazaCarrito','dcPlazaCarritoEnProceso','dcPlazaCart','dc_plaza_cart',
     'dcPlazaComproProceso','dcPlazaCompraProceso','dcPlazaTipoEntrega','dcPlazaTipoPago'
    ].forEach(function(k){ try{localStorage.removeItem(k);}catch(_){} });
    localStorage.removeItem('dcuserEstado');
    localStorage.removeItem('dc_lastView');
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
          if (!navigator.onLine) {
            err.style.display='block'; err.textContent='⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.';
          } else {
            err.style.display='block'; err.textContent='❌ Usuario no encontrado. ¿Intentas con tu correo?';
          }
          return;
        }
        correoLogin = snap.docs[0].data().correo;
      } catch(e2) {
        btn.textContent='Entrar →'; btn.disabled=false;
        var _offline2 = !navigator.onLine || (e2.code||'').indexOf('network') !== -1;
        err.style.display='block';
        err.textContent = _offline2 ? '⚠️ Sin conexión a internet. Verifica tu red e intenta de nuevo.' : '❌ Error al buscar usuario: ' + e2.message;
        return;
      }
    }

    try {
      window._dcLoginInProgress = true; // Bloquear auto-restaurar mientras hacemos login manual
      const cred = await signInWithEmailAndPassword(auth, correoLogin, pass);
      // Leer tipo de usuario desde Firestore
      const snap = await getDoc(doc(db,'usuarios',cred.user.uid));
      window._dcLoginInProgress = false;
      btn.textContent='Entrar →'; btn.disabled=false;

      if (snap.exists()) {
        const datos = snap.data();

        // Bloquear acceso de cuentas administrativas en el login de vecinos/proveedores.
        // Se verifica esAdmin===true (campo booleano) Y como fallback los roles de admin,
        // para cubrir cuentas creadas antes de que existiera el campo esAdmin.
        var _esAdmin = datos.esAdmin === true
          || datos.rol === 'maestro'
          || datos.rol === 'senior'
          || datos.rol === 'junior'
          || datos.rol === 'premium';
        if (_esAdmin) {
          const { signOut: _soAdm } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js");
          await _soAdm(auth).catch(function(){});
          if (window._dcAlerta) {
            window._dcAlerta('Esta cuenta es administrativa.\nIngresa desde el Panel de Administrador.');
          } else {
            var _ov = document.createElement('div');
            _ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
            _ov.innerHTML = '<div style="background:#fff;border-radius:20px 20px 0 0;padding:24px 20px 36px;max-width:480px;width:100%;"><div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:20px;line-height:1.5;">Esta cuenta es administrativa.<br>Ingresa desde el Panel de Administrador.</div><button style="width:100%;background:#1FC26A;color:#fff;border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;" onclick="this.closest(\'[style*=fixed]\').remove()">Aceptar</button></div>';
            document.body.appendChild(_ov);
            _ov.onclick = function(e){ if(e.target===_ov) _ov.remove(); };
          }
          return;
        }

        window.setNombre && window.setNombre(datos.nombre || datos.nombreNegocio || correoLogin);

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
          if (estado === 'suspendido') {
            go('v-vecino-suspendido','right');
          } else {
            go('v-home','right');
          }
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
              window._dcFabInit && window._dcFabInit();
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
      window._dcLoginInProgress = false;
      btn.textContent='Entrar →'; btn.disabled=false;
      err.style.display='block';
      err.textContent = firebaseError(e.code);
    }
  };


