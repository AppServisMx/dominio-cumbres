// ============================================================
// reportes.js — Fase 1 (v3)
// Dominio Cumbres AppServis
// Funciones: publicarReporte, cargarMisReportes,
//            cargarReportesDisponibles, verDetalleReporte
// ------------------------------------------------------------
// Depende de: firebase.js  →  window._fbAuth, window._fbDb
// NO modifica: chat, login, firebase.js, style.css, reglas
// ============================================================

// ── Constantes ──────────────────────────────────────────────

const DC_MAX_POSTULANTES = 4;

const DC_CATEGORIAS = {
  plomero:      { ic: '💧', label: 'Plomería' },
  electricista: { ic: '⚡', label: 'Electricidad' },
  jardinero:    { ic: '🌿', label: 'Jardinería' },
  limpieza:     { ic: '🧹', label: 'Limpieza' },
  pintura:      { ic: '🎨', label: 'Pintura' },
  ac:           { ic: '❄️', label: 'Aire acondicionado' },
  cerrajero:    { ic: '🔒', label: 'Cerrajería' },
  mascotas:     { ic: '🐾', label: 'Mascotas' },
  tecnologia:   { ic: '🖥️', label: 'Tecnología' },
  belleza:      { ic: '💆', label: 'Belleza' },
  otro:         { ic: '🔧', label: 'Otro' }
};

const DC_ESTADOS_LABEL = {
  publicado:    { label: 'Publicado',  color: '#1FC26A', bg: '#E8F5EE' },
  en_cotizacion:{ label: 'Cotizando',  color: '#1A7AB5', bg: '#E8F0F8' },
  contratado:   { label: 'Contratado', color: '#9A6800', bg: '#FFF8E1' },
  completado:   { label: 'Completado', color: '#0A4220', bg: '#E8F5EE' },
  cancelado:    { label: 'Cancelado',  color: '#D63A2A', bg: '#FDECEA' }
};

// Tipos que se consideran proveedor de servicio
const DC_TIPOS_PROVEEDOR = ['proveedor', 'transporte', 'negocio'];

// ── Helpers ─────────────────────────────────────────────────

async function _esperarFirebase() {
  let tries = 0;
  while ((!window._fbDb || !window._fbAuth) && tries < 25) {
    await new Promise(r => setTimeout(r, 200));
    tries++;
  }
  return !!(window._fbDb && window._fbAuth);
}

function _generarReporteId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 7);
  return 'rep_' + ts + '_' + rnd;
}

function _formatFecha(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _badgeEstado(estado) {
  const e = DC_ESTADOS_LABEL[estado] || DC_ESTADOS_LABEL.publicado;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${e.bg};color:${e.color};">${e.label}</span>`;
}

function _badgePostulantes(total) {
  const lleno  = total >= DC_MAX_POSTULANTES;
  const color  = lleno ? '#D63A2A' : '#1A7AB5';
  const bg     = lleno ? '#FDECEA' : '#E8F0F8';
  const texto  = lleno ? '🔒 Completo (4/4)' : `👷 ${total}/${DC_MAX_POSTULANTES} postulantes`;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${bg};color:${color};">${texto}</span>`;
}

// Lee el perfil del usuario desde Firestore — sin caché para garantizar frescura
async function _leerPerfil(uid) {
  const { getDoc, doc } = await import(
    'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
  );
  const snap = await getDoc(doc(window._fbDb, 'usuarios', uid));
  return snap.exists() ? snap.data() : null;
}

// Devuelve true si el tipo corresponde a proveedor de servicios
function _esProveedor(tipo) {
  return DC_TIPOS_PROVEEDOR.includes(tipo);
}

// Devuelve array de categorías del proveedor
// Soporta: categorias[] (nuevo) o categoria (legado)
function _categoriasDeProveedor(perfil) {
  if (!perfil) return [];
  // Preferir categorias[] si existe y tiene datos
  if (Array.isArray(perfil.categorias) && perfil.categorias.length > 0) {
    return perfil.categorias
      .map(c => String(c).toLowerCase().trim())
      .filter(c => c.length > 0);
  }
  // Fallback a campo categoria (string)
  if (perfil.categoria && String(perfil.categoria).trim().length > 0) {
    return [String(perfil.categoria).toLowerCase().trim()];
  }
  return [];
}

// ── Redirigir si el rol no corresponde ──────────────────────

function _redirigirSiRolIncorrecto(tipoEsperado, perfil) {
  const tipo = perfil ? (perfil.tipo || 'vecino') : 'vecino';
  if (tipoEsperado === 'vecino' && _esProveedor(tipo)) {
    // Proveedor intentando entrar a vista de vecino
    alert('Esta sección es solo para residentes.');
    if (typeof go === 'function') go('v-reportes-disponibles', 'right');
    setTimeout(() => window.cargarReportesDisponibles && window.cargarReportesDisponibles(), 300);
    return true;
  }
  if (tipoEsperado === 'proveedor' && !_esProveedor(tipo)) {
    // Vecino intentando entrar a vista de proveedor
    alert('Esta sección es solo para proveedores.');
    if (typeof go === 'function') go('v-solicitud-nueva', 'right');
    return true;
  }
  return false;
}

// ============================================================
// 1. publicarReporte()
// Solo residentes (tipo vecino). Lee zona del perfil.
// ============================================================

window.publicarReporte = async function() {
  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    alert('Debes iniciar sesión para publicar una solicitud.');
    return;
  }

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);

  // Bloquear a proveedores
  if (perfil && _esProveedor(perfil.tipo)) {
    alert('Solo los residentes pueden publicar solicitudes.');
    return;
  }

  const categoria   = document.getElementById('sol-categoria')?.value?.trim() || '';
  const descripcion = document.getElementById('sol-descripcion')?.value?.trim() || '';
  const referencia  = document.getElementById('sol-referencia')?.value?.trim() || '';

  if (!categoria || !descripcion) {
    const errEl = document.getElementById('sol-error');
    if (errEl) {
      errEl.textContent = '⚠️ Selecciona categoría y escribe una descripción.';
      errEl.style.display = 'block';
    }
    return;
  }

  const btnEl = document.getElementById('sol-btn-enviar');
  const errEl = document.getElementById('sol-error');
  if (errEl) errEl.style.display = 'none';
  if (btnEl) { btnEl.textContent = 'Publicando... ⏳'; btnEl.disabled = true; }

  // Zona del perfil — solo el campo zona, no fraccionamiento
  const zonaAutomatica = perfil ? (perfil.zona || '') : '';

  const nombre     = perfil ? (perfil.nombre || perfil.usuario || '') : (localStorage.getItem('dcuser') || '');
  const reporteId  = _generarReporteId();

  try {
    const { setDoc, doc } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    await setDoc(doc(window._fbDb, 'reportes', reporteId), {
      vecinoId:             uid,
      vecinoNombre:         nombre,
      categoria,
      descripcion,
      referencia,               // escrita por el usuario: "cerca de caseta", etc.
      zona:                 zonaAutomatica, // tomada del perfil, sin intervención del usuario
      estado:               'publicado',
      postulantes:          [],
      totalPostulantes:     0,
      proveedorContratadoId: null,
      imagenUrl:            '',
      fechaCreacion:        new Date().toISOString(),
      fechaActualizacion:   new Date().toISOString()
    });

    if (btnEl) { btnEl.textContent = 'Publicar solicitud →'; btnEl.disabled = false; }
    document.getElementById('sol-categoria').value   = '';
    document.getElementById('sol-descripcion').value = '';
    const refEl = document.getElementById('sol-referencia');
    if (refEl) refEl.value = '';

    if (typeof go === 'function') go('v-solicitud-enviada', 'right');

  } catch (e) {
    console.error('publicarReporte error:', e.message);
    if (errEl) {
      errEl.textContent = '❌ Error al publicar: ' + e.message;
      errEl.style.display = 'block';
    }
    if (btnEl) { btnEl.textContent = 'Publicar solicitud →'; btnEl.disabled = false; }
  }
};

// ============================================================
// 2. cargarMisReportes()
// Solo residentes. Filtra en cliente, sin where() para evitar
// cualquier requisito de índice en Firestore.
// ============================================================

window.cargarMisReportes = async function() {
  const contenedor = document.getElementById('mis-reportes-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Cargando... ⏳</div>';

  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Inicia sesión para ver tus solicitudes.</div>';
    return;
  }

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);

  // Proveedor no debe ver esta vista
  if (perfil && _esProveedor(perfil.tipo)) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Esta sección es solo para residentes.</div>';
    return;
  }

  try {
    const { getDocs, collection } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    // Sin where() — filtra en cliente para evitar requisitos de índice
    const snap = await getDocs(collection(window._fbDb, 'reportes'));

    const _docs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.vecinoId === uid) _docs.push({ id: d.id, ...data });
    });
    _docs.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));

    if (_docs.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:36px;margin-bottom:10px;">📋</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Sin solicitudes aún</div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5;">
            Publica tu primera solicitud de servicio<br>y proveedores verificados te contactarán.
          </div>
        </div>`;
      return;
    }

    contenedor.innerHTML = '';
    _docs.forEach(r => {
      const cat  = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
      const card = document.createElement('div');
      card.className = 'prov-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="display:flex;gap:10px;align-items:center;flex:1;">
            <div style="width:38px;height:38px;border-radius:12px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${cat.ic}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">${cat.label}</div>
              <div style="font-size:11px;color:var(--text-muted);">${_formatFecha(r.fechaCreacion)}</div>
            </div>
          </div>
          ${_badgeEstado(r.estado)}
        </div>
        <div style="font-size:12px;color:var(--text-primary);margin-bottom:8px;line-height:1.5;">${r.descripcion || ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          ${_badgePostulantes(r.totalPostulantes || 0)}
          ${r.referencia ? `<span style="font-size:10px;color:var(--text-muted);">📍 ${r.referencia}</span>` : ''}
        </div>`;
      card.onclick = () => window.verDetalleReporte(r.id, r);
      contenedor.appendChild(card);
    });

  } catch (e) {
    console.error('cargarMisReportes error:', e.message);
    contenedor.innerHTML = `<div style="background:#FDECEA;border-radius:12px;padding:14px;margin:10px;font-size:12px;color:#D63A2A;">❌ Error: ${e.message}</div>`;
  }
};

// ============================================================
// 3. cargarReportesDisponibles()
// Solo proveedores. Filtra por categoría(s) del proveedor.
// Sin filtro de zona — ve solicitudes de todo el fraccionamiento.
// Soporta: categoria (legado) y categorias[] (nuevo).
// ============================================================

window.cargarReportesDisponibles = async function() {
  const contenedor = document.getElementById('reportes-disponibles-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Cargando solicitudes... ⏳</div>';

  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Inicia sesión para ver solicitudes.</div>';
    return;
  }

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);

  // Vecinos no deben ver esta vista
  if (perfil && !_esProveedor(perfil.tipo)) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Esta sección es solo para proveedores.</div>';
    return;
  }

  // Categorías del proveedor — soporta legado y nuevo formato
  const categoriasProveedor = _categoriasDeProveedor(perfil);

  // Log para diagnóstico — visible en consola del navegador
  console.log('[reportes] perfil.categoria:', perfil && perfil.categoria);
  console.log('[reportes] perfil.categorias:', perfil && perfil.categorias);
  console.log('[reportes] categoriasProveedor resueltas:', categoriasProveedor);

  // Sin categoría configurada → error explícito, no mostrar todo
  if (categoriasProveedor.length === 0) {
    contenedor.innerHTML = `
      <div style="text-align:center;padding:30px 20px;">
        <div style="font-size:36px;margin-bottom:10px;">⚙️</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Sin categoría configurada</div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.6;">
          No tienes categorías configuradas en tu perfil.<br>
          Contacta al administrador para actualizar tu perfil de proveedor.
        </div>
      </div>`;
    return;
  }

  try {
    const { getDocs, collection } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    // Sin where() para evitar requisitos de índice
    const snap = await getDocs(collection(window._fbDb, 'reportes'));

    const docs = [];
    snap.forEach(docSnap => {
      const r = docSnap.data();

      // Solo reportes activos (publicado o en cotización)
      if (r.estado !== 'publicado' && r.estado !== 'en_cotizacion') return;

      // Filtrar por categoría — categoriasProveedor ya validado (no vacío)
      const catReporte = (r.categoria || '').toLowerCase().trim();
      if (!categoriasProveedor.includes(catReporte)) return;

      // NO filtrar por zona — proveedor ve solicitudes de todo el fraccionamiento

      docs.push({ id: docSnap.id, ...r });
    });
    docs.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));

    if (docs.length === 0) {
      const msgCat = categoriasProveedor.length > 0
        ? `de ${categoriasProveedor.join(', ')}`
        : '';
      contenedor.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:36px;margin-bottom:10px;">📋</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Sin solicitudes activas</div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5;">
            No hay solicitudes ${msgCat} en este momento.<br>
            Cuando un residente publique una, aparecerá aquí.
          </div>
        </div>`;
      return;
    }

    contenedor.innerHTML = '';
    docs.forEach(r => {
      const cat         = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
      const lleno       = (r.totalPostulantes || 0) >= DC_MAX_POSTULANTES;
      const yaPostulado = Array.isArray(r.postulantes) && r.postulantes.includes(uid);

      const card = document.createElement('div');
      card.className   = 'prov-card';
      card.style.opacity = lleno ? '0.65' : '1';
      card.style.cursor  = (lleno || yaPostulado) ? 'default' : 'pointer';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="display:flex;gap:10px;align-items:center;flex:1;">
            <div style="width:38px;height:38px;border-radius:12px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${cat.ic}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${cat.label}</div>
              <div style="font-size:11px;color:var(--text-muted);">${_formatFecha(r.fechaCreacion)}${r.referencia ? ' · 📍 ' + r.referencia : ''}</div>
            </div>
          </div>
          ${_badgePostulantes(r.totalPostulantes || 0)}
        </div>
        <div style="font-size:12px;color:var(--text-primary);margin-bottom:10px;line-height:1.5;">${r.descripcion || ''}</div>
        <div style="display:flex;justify-content:flex-end;">
          ${yaPostulado
            ? `<span style="font-size:11px;font-weight:700;color:#1A7AB5;padding:7px 14px;border-radius:10px;background:#E8F0F8;">✓ Ya postulado</span>`
            : lleno
              ? `<span style="font-size:11px;font-weight:700;color:#D63A2A;padding:7px 14px;border-radius:10px;background:#FDECEA;">🔒 Sin cupo</span>`
              : `<button onclick="event.stopPropagation();window.verDetalleReporte('${r.id}',null)" style="background:var(--green);color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Ver solicitud →</button>`
          }
        </div>`;
      if (!lleno && !yaPostulado) {
        card.onclick = () => window.verDetalleReporte(r.id, r);
      }
      contenedor.appendChild(card);
    });

  } catch (e) {
    console.error('cargarReportesDisponibles error:', e.message);
    contenedor.innerHTML = `<div style="background:#FDECEA;border-radius:12px;padding:14px;margin:10px;font-size:12px;color:#D63A2A;">❌ Error: ${e.message}</div>`;
  }
};

// ============================================================
// 4. verDetalleReporte(reporteId, datosOpcionales)
// ============================================================

window.verDetalleReporte = async function(reporteId, datos) {
  window._reporteActualId = reporteId;

  if (datos) {
    _renderDetalleReporte(reporteId, datos);
    if (typeof go === 'function') go('v-reporte-detalle', 'right');
    return;
  }

  const listo = await _esperarFirebase();
  if (!listo) return;

  try {
    const { getDoc, doc } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );
    const snap = await getDoc(doc(window._fbDb, 'reportes', reporteId));
    if (!snap.exists()) { alert('Reporte no encontrado.'); return; }
    _renderDetalleReporte(reporteId, snap.data());
    if (typeof go === 'function') go('v-reporte-detalle', 'right');
  } catch (e) {
    console.error('verDetalleReporte error:', e.message);
  }
};

function _renderDetalleReporte(id, r) {
  const cat = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
  const uid = window._fbAuth?.currentUser?.uid || '';

  const set = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.innerHTML = val;
  };

  set('det-rep-ic',          cat.ic);
  set('det-rep-categoria',   cat.label);
  set('det-rep-fecha',       _formatFecha(r.fechaCreacion));
  set('det-rep-descripcion', r.descripcion || '');
  set('det-rep-zona',        r.referencia ? '📍 ' + r.referencia : '');
  set('det-rep-estado',      _badgeEstado(r.estado));
  set('det-rep-postulantes', _badgePostulantes(r.totalPostulantes || 0));

  const elAccion = document.getElementById('det-rep-accion');
  if (elAccion) {
    const esVecino    = r.vecinoId === uid;
    const lleno       = (r.totalPostulantes || 0) >= DC_MAX_POSTULANTES;
    const yaPostulado = Array.isArray(r.postulantes) && r.postulantes.includes(uid);

    if (esVecino) {
      elAccion.innerHTML = `
        <div style="background:#E8F0F8;border-radius:12px;padding:10px 12px;font-size:11px;color:#1A7AB5;margin-top:8px;">
          💬 Los proveedores que se postulen aparecerán aquí en la siguiente actualización.
        </div>`;
    } else if (yaPostulado) {
      elAccion.innerHTML = `
        <div style="background:#E8F5EE;border-radius:12px;padding:10px 12px;font-size:12px;color:#0A4220;font-weight:700;margin-top:8px;">
          ✓ Ya enviaste tu cotización para esta solicitud.
        </div>`;
    } else if (lleno) {
      elAccion.innerHTML = `
        <div style="background:#FDECEA;border-radius:12px;padding:10px 12px;font-size:11px;color:#D63A2A;margin-top:8px;">
          🔒 Esta solicitud ya tiene ${DC_MAX_POSTULANTES} proveedores. No acepta más postulaciones.
        </div>`;
    } else {
      elAccion.innerHTML = `
        <div style="background:#E8F0F8;border-radius:12px;padding:10px 12px;font-size:11px;color:#1A7AB5;margin-top:8px;">
          ℹ️ La función de cotizar estará disponible en la próxima actualización.
        </div>`;
    }
  }
}

// ── Inicialización al cargar el formulario ───────────────────
// Cuando el usuario entra a v-solicitud-nueva, precarga su zona del perfil
// y bloquea la vista si es proveedor. Se llama desde data-onenter en el HTML.

window.iniciarFormularioSolicitud = async function() {
  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) return;

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);

  // Redirigir a proveedor
  if (perfil && _esProveedor(perfil.tipo)) {
    if (typeof go === 'function') go('v-reportes-disponibles', 'right');
    setTimeout(() => window.cargarReportesDisponibles && window.cargarReportesDisponibles(), 300);
    return;
  }

  // Mostrar perfil.zona exactamente como está en Firestore
  const zonaEl = document.getElementById('sol-zona-perfil');
  if (zonaEl) {
    const z = (perfil && perfil.zona) ? String(perfil.zona).trim() : '';
    if (z) {
      zonaEl.innerHTML = `<span style="font-size:11px;color:#555;display:block;margin-bottom:2px;">Zona</span><span style="font-size:14px;font-weight:700;color:#1a1a1a;">📍 ${z}</span>`;
    } else {
      zonaEl.innerHTML = '<span style="font-size:12px;color:#888;">📍 Zona no definida en tu perfil</span>';
    }
  }
};

// ── Función central de enrutamiento por rol ─────────────────
// Todos los botones de navegación en el HTML deben llamar esta
// función en lugar de go() directo. Lee dcuserTipo de localStorage
// (seteado en login) como fuente rápida; el guard en cada vista
// confirma contra Firestore como segunda línea.
window.irASolicitudes = function() {
  const t = localStorage.getItem('dcuserTipo') || 'vecino';
  if (t === 'proveedor' || t === 'transporte' || t === 'negocio') {
    if (typeof go === 'function') go('v-reportes-disponibles', 'right');
    setTimeout(() => window.cargarReportesDisponibles && window.cargarReportesDisponibles(), 300);
  } else {
    if (typeof go === 'function') go('v-solicitud-nueva', 'right');
  }
};

// Actualiza el label del botón en v-servicios según el rol
window.actualizarBtnSolicitudRol = function() {
  const t   = localStorage.getItem('dcuserTipo') || 'vecino';
  const lbl = document.getElementById('btn-solicitud-label');
  if (!lbl) return;
  lbl.textContent = (t === 'proveedor' || t === 'transporte' || t === 'negocio')
    ? 'Ver solicitudes de clientes'
    : 'Publicar solicitud de servicio';
};

// ── Exponer constante para Fase 2 ───────────────────────────
window.DC_MAX_POSTULANTES = DC_MAX_POSTULANTES;

console.log('[reportes.js] v3 cargado — límite postulantes:', DC_MAX_POSTULANTES);
