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
  en_cotizacion:{ label: 'Con interesados',  color: '#1A7AB5', bg: '#E8F0F8' },
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
  const set = new Set();
  if (Array.isArray(perfil.categorias)) {
    perfil.categorias.forEach(c => { const v = String(c).toLowerCase().trim(); if (v) set.add(v); });
  }
  if (perfil.categoria) {
    const v = String(perfil.categoria).toLowerCase().trim(); if (v) set.add(v);
  }
  ['oficio1','oficio2','oficio3'].forEach(k => {
    if (perfil[k]) { const v = String(perfil[k]).toLowerCase().trim(); if (v) set.add(v); }
  });
  return [...set];
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

// Tab state — module-level, persists across re-renders
var _mrTab = 'activas';
var _mrDocs = null;

function _mrRenderTabs() {
  var tabs = document.getElementById('mr-tabs');
  if (!tabs) return;
  var all = _mrDocs || [];
  var nA = all.filter(function(r){ return r.estado === 'publicado'; }).length;
  var nI = all.filter(function(r){ return r.estado === 'en_cotizacion'; }).length;
  var nC = all.filter(function(r){ return r.estado === 'contratado' || r.estado === 'completado' || r.estado === 'cancelado'; }).length;
  function btn(id, lbl, n) {
    var sel = _mrTab === id;
    var bdg = n > 0 ? '<span style="background:' + (sel?'#1FC26A':'#ccc') + ';color:' + (sel?'#fff':'#666') + ';border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px;">' + n + '</span>' : '';
    return '<button onclick="window._mrSetTab(\'' + id + '\')" style="flex:1;padding:10px 4px;border:none;border-bottom:2.5px solid ' + (sel?'#1FC26A':'transparent') + ';background:transparent;font-size:12px;font-weight:' + (sel?'700':'500') + ';color:' + (sel?'#1FC26A':'#888') + ';cursor:pointer;font-family:\'Inter\',sans-serif;display:flex;align-items:center;justify-content:center;">' + lbl + bdg + '</button>';
  }
  tabs.innerHTML = btn('activas','Activas',nA) + btn('interesados','Con interesados',nI) + btn('cerradas','Cerradas',nC);
}

function _mrRenderLista() {
  var contenedor = document.getElementById('mis-reportes-lista');
  if (!contenedor) return;
  var all = _mrDocs;
  if (all === null) {
    contenedor.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-size:13px;">Cargando...</div>';
    return;
  }
  var grupo, emptyMsg;
  if (_mrTab === 'activas') {
    grupo    = all.filter(function(r){ return r.estado === 'publicado'; });
    emptyMsg = 'Sin solicitudes activas';
  } else if (_mrTab === 'interesados') {
    grupo    = all.filter(function(r){ return r.estado === 'en_cotizacion'; });
    emptyMsg = 'Sin solicitudes con interesados';
  } else {
    grupo    = all.filter(function(r){ return r.estado === 'contratado' || r.estado === 'completado' || r.estado === 'cancelado'; });
    emptyMsg = 'Sin solicitudes cerradas';
  }
  if (grupo.length === 0) {
    contenedor.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:36px;margin-bottom:10px;">' + '📋</div><div style="font-size:13px;font-weight:700;color:#aaa;">' + emptyMsg + '</div></div>';
    return;
  }
  contenedor.innerHTML = '';
  grupo.forEach(function(r) {
    var cat  = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
    var card = document.createElement('div');
    card.className = 'prov-card';
    card.style.cursor = 'pointer';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">'
      + '<div style="display:flex;gap:10px;align-items:center;flex:1;">'
      + '<div style="width:38px;height:38px;border-radius:12px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + cat.ic + '</div>'
      + '<div style="flex:1;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">' + cat.label + '</div>'
      + '<div style="font-size:11px;color:var(--text-muted);">' + _formatFecha(r.fechaCreacion) + '</div>'
      + '</div></div>'
      + _badgeEstado(r.estado)
      + '</div>'
      + '<div style="font-size:12px;color:var(--text-primary);margin-bottom:8px;line-height:1.5;">' + (r.descripcion || '') + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
      + _badgePostulantes(r.totalPostulantes || 0)
      + (r.referencia ? '<span style="font-size:10px;color:var(--text-muted);">📍 ' + r.referencia + '</span>' : '')
      + '</div>';
    card.onclick = function(){ window._reporteBackView='v-mis-reportes'; window.verDetalleReporte(r.id, r); };
    contenedor.appendChild(card);
  });
}

window._mrSetTab = function(tab) {
  _mrTab = tab;
  _mrRenderTabs();
  _mrRenderLista();
};

window.cargarMisReportes = async function() {
  var contenedor = document.getElementById('mis-reportes-lista');
  if (!contenedor) return;

  _mrDocs = null;
  _mrRenderTabs();
  contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Cargando... ⏳</div>';

  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Inicia sesión para ver tus solicitudes.</div>';
    return;
  }

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);

  if (perfil && _esProveedor(perfil.tipo)) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Esta sección es solo para residentes.</div>';
    return;
  }

  try {
    const { getDocs, collection } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    const snap = await getDocs(collection(window._fbDb, 'reportes'));
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.vecinoId === uid) docs.push({ id: d.id, ...data });
    });
    docs.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));

    _mrDocs = docs;

    if (docs.length === 0) {
      _mrRenderTabs();
      contenedor.innerHTML = '<div style="text-align:center;padding:30px 20px;"><div style="font-size:36px;margin-bottom:10px;">📋</div><div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Sin solicitudes aún</div><div style="font-size:11px;color:var(--text-muted);line-height:1.5;">Publica tu primera solicitud de servicio<br>y proveedores verificados te contactarán.</div></div>';
      return;
    }

    _mrRenderTabs();
    _mrRenderLista();

  } catch (e) {
    console.error('cargarMisReportes error:', e.message);
    contenedor.innerHTML = `<div style="background:#FDECEA;border-radius:12px;padding:14px;margin:10px;font-size:12px;color:#D63A2A;">❌ Error: ${e.message}</div>`;
  }
}

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
        card.onclick = () => { window._reporteBackView='v-reportes-disponibles'; window.verDetalleReporte(r.id, r); };
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
      // Mostrar postulantes con botón de chat — async, no bloquea render inicial
      elAccion.innerHTML = '<div id="det-rep-provlist" style="margin-top:8px;"><div style="text-align:center;padding:12px;font-size:11px;color:var(--text-muted);">Buscando proveedores interesados...</div></div>';
      window._cargarPostulantesVecino(id, r.postulantes || [], uid);
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
        <button
          onclick="window._postularEnReporte('${id}')"
          style="width:100%;padding:12px;background:var(--green,#1FC26A);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px;">
          💬 Me interesa / Contactar vecino
        </button>`;
    }
  }
}

// ── Postular proveedor en reporte y abrir chat con vecino ────
window._postularEnReporte = async function(reporteId) {
  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth?.currentUser) { alert('Sesión no disponible.'); return; }

  const uid    = window._fbAuth.currentUser.uid;
  const perfil = await _leerPerfil(uid);
  if (!perfil) { alert('No se pudo leer tu perfil.'); return; }

  const { getDoc, doc, updateDoc, arrayUnion, increment, setDoc, addDoc, collection, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js');

  const db      = window._fbDb;
  const repRef  = doc(db, 'reportes', reporteId);
  const repSnap = await getDoc(repRef);

  if (!repSnap.exists()) { alert('Solicitud no encontrada.'); return; }

  const r = repSnap.data();

  if (r.estado !== 'publicado' && r.estado !== 'en_cotizacion') {
    alert('Esta solicitud ya no está disponible.'); return;
  }

  const _maxPost = (typeof DC_MAX_POSTULANTES !== 'undefined') ? DC_MAX_POSTULANTES : 4;
  if ((r.totalPostulantes || 0) >= _maxPost) {
    alert('Esta solicitud ya tiene el máximo de proveedores.'); return;
  }

  if (Array.isArray(r.postulantes) && r.postulantes.includes(uid)) {
    alert('Ya te postulaste a esta solicitud.'); return;
  }

  await updateDoc(repRef, {
    postulantes:      arrayUnion(uid),
    totalPostulantes: increment(1),
    estado:           'en_cotizacion'
  });

  const catLabel   = (DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro).label;
  const nombreProv = perfil.nombre || localStorage.getItem('dcuser') || 'Proveedor';
  const msgTexto   = `Hola, vi tu solicitud de ${catLabel}. Soy ${nombreProv} y puedo ayudarte.`;

  const vecinoId = r.vecinoId;
  if (!vecinoId) { console.error('_postularEnReporte: reporte sin vecinoId', reporteId); return; }

  // Notificacion al vecino — try/catch independiente, no bloquea postulacion ni chat
  try {
    await addDoc(collection(db, 'notificaciones'), {
      uid:       vecinoId,
      tipo:      'postulacion',
      modulo:    'solicitudes_vecino',
      titulo:    'Nuevo proveedor interesado',
      mensaje:   nombreProv + ' quiere ayudarte con tu solicitud de ' + catLabel + '.',
      leida:     false,
      eliminada: false,
      prioridad: 'normal',
      reporteId: reporteId,
      fecha:     serverTimestamp()
    });
  } catch(ne) {
    console.warn('[NOTIF postulacion]', ne.message);
  }
  const idsOrden = [uid, vecinoId].sort().join('_');
  const chatId   = 'chat_' + idsOrden;

  await setDoc(doc(db, 'chats', chatId), {
    participantes:  [uid, vecinoId],
    ultimoMsg:      msgTexto,
    ultimoNombre:   nombreProv,
    nombreContacto: r.vecinoNombre || 'Vecino',
    nombres:        { [vecinoId]: nombreProv + ' · ' + catLabel, [uid]: r.vecinoNombre || 'Vecino' },
    reporteId:      reporteId,
    ultimoEmisor:   uid,
    respondido:     false,
    fecha:          Date.now()
  }, { merge: true });

  await addDoc(collection(db, 'chats', chatId, 'mensajes'), {
    texto:           msgTexto,
    remitenteId:     uid,
    remitenteNombre: nombreProv,
    destinatarioId:  vecinoId,
    timestamp:       serverTimestamp()
  });

  const elAccion = document.getElementById('det-rep-accion');
  if (elAccion) {
    elAccion.innerHTML = `
      <div style="background:#E8F5EE;border-radius:12px;padding:10px 12px;font-size:12px;color:#0A4220;font-weight:700;margin-top:8px;">
        ✓ Ya enviaste tu cotización para esta solicitud.
      </div>`;
  }
  const elPost = document.getElementById('det-rep-postulantes');
  if (elPost) elPost.innerHTML = _badgePostulantes((r.totalPostulantes || 0) + 1);

  if (typeof window.abrirChatExacto === 'function') {
    window.abrirChatExacto(chatId, vecinoId, r.vecinoNombre || 'Vecino', 'v-reporte-detalle');
  }
};

// ── Lista de postulantes visible para el vecino ────────────
window._cargarPostulantesVecino = async function(reporteId, postulantes, vecinoUid) {
  var lista = document.getElementById('det-rep-provlist');
  if (!lista) return;

  if (!postulantes || postulantes.length === 0) {
    lista.innerHTML = '<div style="background:#E8F0F8;border-radius:12px;padding:10px 12px;font-size:11px;color:#1A7AB5;">👷 Aún no hay proveedores interesados.<br>Cuando alguno se postule aparecerá aquí.</div>';
    return;
  }

  const listo = await _esperarFirebase();
  if (!listo) return;

  const { getDoc, doc } = await import(
    'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
  );

  var html = '<div style="font-size:12px;font-weight:700;color:var(--text-caption);margin-bottom:8px;">Proveedores interesados (' + postulantes.length + '/' + (window.DC_MAX_POSTULANTES||4) + ')</div>';

  for (var i = 0; i < postulantes.length; i++) {
    var provUid = postulantes[i];
    var chatId  = 'chat_' + [vecinoUid, provUid].sort().join('_');

    // Try to get proveedor name from chat doc nombres map (already stored)
    var nombreProv = null;
    var oficio     = '';
    try {
      var chatSnap = await getDoc(doc(window._fbDb, 'chats', chatId));
      if (chatSnap.exists()) {
        var cd = chatSnap.data();
        var raw = cd.nombres && cd.nombres[vecinoUid] ? cd.nombres[vecinoUid] : null;
        if (raw) {
          var parts = raw.split(' · ');
          nombreProv = parts[0];
          oficio     = parts[1] || '';
        }
      }
    } catch(e2) {}

    // Fallback: read from usuarios profile
    if (!nombreProv) {
      try {
        var perfSnap = await getDoc(doc(window._fbDb, 'usuarios', provUid));
        if (perfSnap.exists()) {
          var p = perfSnap.data();
          nombreProv = p.nombre || 'Proveedor';
          oficio     = p.oficio1 || p.categoria || '';
        }
      } catch(e3) {}
    }

    if (!nombreProv) nombreProv = 'Proveedor verificado';

    html += '<div style="background:#fff;border:.5px solid #e8e8e8;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      + '<div>'
      + '<div style="font-size:13px;font-weight:700;color:var(--text-primary);">' + nombreProv + '</div>'
      + (oficio ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">🔧 ' + oficio + '</div>' : '')
      + '</div>'
      + '<button onclick="window.abrirChatExacto(\'' + chatId + '\',\'' + provUid + '\',\'' + nombreProv.replace(/'/g,'') + '\',\'v-reporte-detalle\')" '
      + 'style="background:var(--green,#1FC26A);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">'
      + '💬 Chatear</button>'
      + '</div>';
  }

  lista.innerHTML = html;
};

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

