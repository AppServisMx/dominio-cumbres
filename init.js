  window.VERSION_APP = "V68-CATALOGO-NAVCORR-20260624";

  // ============ CHAT CON FIREBASE ============
  window._chatUnsubscribe = null;
  window._chatProveedorId = null;
  window._chatProveedorNombre = null;
  window._chatIdExacto = null;

  window.abrirChat = function(proveedorId, proveedorNombre, proveedorIc) {
    window._chatProveedorId = proveedorId;
    window._chatProveedorNombre = proveedorNombre || 'Proveedor';
    window._chatIdExacto = null;
    const nom = document.getElementById('chat-prov-nombre');
    const ic  = document.getElementById('chat-prov-ic');
    const btn = document.querySelector('#v-chat .btn-back');
    if(nom) nom.textContent = proveedorNombre || 'Proveedor';
    if(ic)  ic.textContent  = proveedorIc || '🔧';
    if(btn) btn.onclick = function(){ go('v-serv-det','left'); cerrarChat(); };
    go('v-chat', 'right');
    cargarMensajes();
  };

  // Abre chat desde la bandeja usando chatId exacto — no duplica hilos
  window.abrirChatExacto = function(chatId, otroId, nombre, backView) {
    window._chatProveedorId = otroId;
    window._chatIdExacto = chatId;
    window._chatProveedorNombre = nombre || 'Usuario';
    const nom = document.getElementById('chat-prov-nombre');
    const ic  = document.getElementById('chat-prov-ic');
    const btn = document.querySelector('#v-chat .btn-back');
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
  // ============ FIN CHAT ============

  window.abrirProveedor = function(uid, p) {
    window._proveedorActual = {uid, ...p};
    const nombre = document.querySelector('#v-serv-det [style*="font-size:18px"]');
    if(nombre) nombre.textContent = p.nombre || 'Proveedor';
    go('v-serv-det','right');
    setTimeout(function(){ window.dcProvRatingCargar && window.dcProvRatingCargar(uid); }, 200);
  };

  window.contactarProveedor = async function() {
    const p = window._proveedorActual || {};
    const provId = p.uid || p.id || p._id || 'demo';
    const nombre = p.nombre || 'Proveedor';

    // Buscar chat existente antes de abrir
    const _auth = window._fbAuth;
    const _db   = window._fbDb;
    const myUid = _auth && _auth.currentUser && _auth.currentUser.uid;

    if (myUid && _db && provId !== 'demo') {
      try {
        const { collection, getDocs, query, where } = window._fs;
        const q = query(
          collection(_db, 'chats'),
          where('participantes', 'array-contains', myUid)
        );
        const snap = await getDocs(q);
        let chatExistente = null;
        snap.forEach(doc => {
          const d = doc.data();
          if (Array.isArray(d.participantes) && d.participantes.includes(provId)) {
            chatExistente = { id: doc.id, nombre: (d.nombres && d.nombres[myUid]) || nombre };
          }
        });
        if (chatExistente) {
          window.abrirChatExacto(chatExistente.id, provId, chatExistente.nombre, 'v-serv-det');
          return;
        }
      } catch(e) {
        // Búsqueda fallida, abriendo nuevo chat
      }
    }

    abrirChat(provId, nombre, '🔧');
  };

  // ============ FIN FIREBASE LOADERS ============
  // NOTA: auto-carga de v-servicios y v-food está en _goCore (línea ~8035 y 8043)
  // cargarRestaurantes está definida en firebase.js (versión con _estadoEfectivoDe)

  // ── CONFIGURACIÓN EMAILJS ────────────────────────────────
  // INSTRUCCIONES PARA ACTIVAR:
  // 1. Crea cuenta gratis en https://www.emailjs.com
  // 2. Crea un "Email Service" (Gmail recomendado) y copia el Service ID
  // 3. Crea un "Email Template" con estas variables: {{tipo}}, {{nombre}}, {{correo}}, {{telefono}}, {{fecha}}
  //    Pon tu correo como destinatario fijo en el template
  // 4. Copia tu Public Key (Account → API Keys)
  // 5. Reemplaza los valores de abajo:
  const EMAILJS_PUBLIC_KEY    = 'D8IYC6Jyyp6u3FOfg';      // ← reemplaza
  const EMAILJS_SERVICE_ID    = 'DCAppServis';      // ← reemplaza
  const EMAILJS_TEMPLATE_ID   = 'template_3gpxjvc';     // ← template: aviso al admin cuando alguien se registra
  const EMAILJS_TEMPLATE_APROBADO    = 'template_3gpxjvc';    // ← template: aviso al usuario cuando es aprobado
  const EMAILJS_TEMPLATE_BIENVENIDO  = 'template_3gpxjvc';  // ← template: bienvenida al registrarse
  // Variables del template APROBADO:   {{nombre}}, {{correo}}, {{fecha}}
  // Variables del template BIENVENIDO: {{nombre}}, {{correo}}, {{tipo}}, {{fecha}}
  // En ambos templates, el "To Email" debe ser {{correo}}

  function notificarAdmin(tipo, nombre, correo, telefono) {
    // Desactivado para ahorrar los 200 correos mensuales
    // Solo se envía correo cuando el admin aprueba al usuario
    return;
  }

  // Correo de bienvenida desactivado para ahorrar los 200 correos mensuales
  // Solo se envía correo cuando el admin aprueba al usuario
  function notificarBienvenido(nombre, correo, tipo) {
    return;
  }

  // Notifica al proveedor/transportista/negocio que fue aprobado
  function notificarAprobado(nombre, correo) {
    if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY_AQUI') return;
    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_APROBADO, {
      nombre: nombre || 'Usuario',
      email: correo,
      correo: correo,
      fecha: new Date().toLocaleString('es-MX')
    }).then(() => {
    }).catch((err) => {
      console.error('Error EmailJS:', err);
    });
  }
