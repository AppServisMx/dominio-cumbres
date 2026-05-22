// ============================================================
// reportes.js — Fase 1
// Dominio Cumbres AppServis
// Funciones: publicarReporte, cargarMisReportes,
//            cargarReportesDisponibles, verDetalleReporte
// ------------------------------------------------------------
// Depende de: firebase.js (window._fbAuth, window._fbDb)
// NO modifica: chat viejo, firebase.js, reglas Firestore
// ============================================================

// ── Constantes ──────────────────────────────────────────────

const DC_MAX_POSTULANTES = 4; // Límite máximo de proveedores por reporte

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

// ── Helper: esperar Firebase ─────────────────────────────────

async function _esperarFirebase() {
  let tries = 0;
  while ((!window._fbDb || !window._fbAuth) && tries < 25) {
    await new Promise(r => setTimeout(r, 200));
    tries++;
  }
  return !!(window._fbDb && window._fbAuth);
}

// ── Helper: ID único para reporte ───────────────────────────

function _generarReporteId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 7);
  return 'rep_' + ts + '_' + rnd;
}

// ── Helper: formatear fecha ──────────────────────────────────

function _formatFecha(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Helper: render badge de estado ──────────────────────────

function _badgeEstado(estado) {
  const e = DC_ESTADOS_LABEL[estado] || DC_ESTADOS_LABEL.publicado;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;
    background:${e.bg};color:${e.color};">${e.label}</span>`;
}

// ── Helper: render indicador de postulantes ──────────────────

function _badgePostulantes(total) {
  const resta = DC_MAX_POSTULANTES - total;
  const color  = total >= DC_MAX_POSTULANTES ? '#D63A2A' : '#1A7AB5';
  const bg     = total >= DC_MAX_POSTULANTES ? '#FDECEA' : '#E8F0F8';
  const texto  = total >= DC_MAX_POSTULANTES
    ? '🔒 Completo (4/4)'
    : `👷 ${total}/${DC_MAX_POSTULANTES} postulantes`;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;
    background:${bg};color:${color};">${texto}</span>`;
}

// ============================================================
// 1. publicarReporte()
// Guarda un nuevo reporte en Firestore (colección: reportes)
// Llamar desde el formulario de la vista v-solicitud-nueva
// ============================================================

window.publicarReporte = async function() {
  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    alert('Debes iniciar sesión para publicar un reporte.');
    return;
  }

  // Leer campos del formulario
  const categoria   = document.getElementById('sol-categoria')?.value?.trim() || '';
  const descripcion = document.getElementById('sol-descripcion')?.value?.trim() || '';
  const zona        = document.getElementById('sol-zona')?.value?.trim() || '';

  if (!categoria || !descripcion) {
    const errEl = document.getElementById('sol-error');
    if (errEl) { errEl.textContent = '⚠️ Selecciona categoría y escribe una descripción.'; errEl.style.display = 'block'; }
    return;
  }

  const btnEl = document.getElementById('sol-btn-enviar');
  const errEl = document.getElementById('sol-error');
  if (errEl) errEl.style.display = 'none';
  if (btnEl) { btnEl.textContent = 'Publicando... ⏳'; btnEl.disabled = true; }

  const user    = window._fbAuth.currentUser;
  const nombre  = localStorage.getItem('dcuser') || user.email || 'Vecino';
  const reporteId = _generarReporteId();

  try {
    const { setDoc, doc } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    await setDoc(doc(window._fbDb, 'reportes', reporteId), {
      vecinoId:       user.uid,
      vecinoNombre:   nombre,
      categoria,
      descripcion,
      zona,
      estado:         'publicado',
      postulantes:    [],           // array de proveedorId — max DC_MAX_POSTULANTES
      totalPostulantes: 0,
      proveedorContratadoId: null,
      imagenUrl:      '',           // se agrega en fases futuras
      fechaCreacion:  new Date().toISOString(),
      fechaActualizacion: new Date().toISOString()
    });

    // Éxito: limpiar y navegar
    if (btnEl) { btnEl.textContent = 'Publicar solicitud →'; btnEl.disabled = false; }
    document.getElementById('sol-categoria').value    = '';
    document.getElementById('sol-descripcion').value  = '';
    if (document.getElementById('sol-zona')) document.getElementById('sol-zona').value = '';

    if (typeof go === 'function') go('v-solicitud-enviada', 'right');

  } catch (e) {
    console.error('publicarReporte error:', e.message);
    if (errEl) { errEl.textContent = '❌ Error al publicar: ' + e.message; errEl.style.display = 'block'; }
    if (btnEl) { btnEl.textContent = 'Publicar solicitud →'; btnEl.disabled = false; }
  }
};

// ============================================================
// 2. cargarMisReportes()
// Carga los reportes del vecino autenticado
// Destino: elemento con id="mis-reportes-lista"
// ============================================================

window.cargarMisReportes = async function() {
  const contenedor = document.getElementById('mis-reportes-lista');
  if (!contenedor) return;

  contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Cargando... ⏳</div>';

  const listo = await _esperarFirebase();
  if (!listo || !window._fbAuth.currentUser) {
    contenedor.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:var(--text-muted);">Inicia sesión para ver tus reportes.</div>';
    return;
  }

  try {
    const { getDocs, collection, query, where, orderBy } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    const uid = window._fbAuth.currentUser.uid;
    const q   = query(
      collection(window._fbDb, 'reportes'),
      where('vecinoId', '==', uid),
      orderBy('fechaCreacion', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:36px;margin-bottom:10px;">📋</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Sin solicitudes aún</div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5;">
            Publica tu primera solicitud de servicio y proveedores verificados te contactarán.
          </div>
        </div>`;
      return;
    }

    contenedor.innerHTML = '';
    snap.forEach(docSnap => {
      const r   = docSnap.data();
      const id  = docSnap.id;
      const cat = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
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
          ${r.zona ? `<span style="font-size:10px;color:var(--text-muted);">📍 ${r.zona}</span>` : ''}
        </div>`;
      card.onclick = () => window.verDetalleReporte(id, r);
      contenedor.appendChild(card);
    });

  } catch (e) {
    console.error('cargarMisReportes error:', e.message);
    contenedor.innerHTML = `<div style="background:#FDECEA;border-radius:12px;padding:14px;margin:10px;font-size:12px;color:#D63A2A;">❌ Error: ${e.message}</div>`;
  }
};

// ============================================================
// 3. cargarReportesDisponibles()
// Para el proveedor: carga reportes publicados de su categoría
// Destino: elemento con id="reportes-disponibles-lista"
// RESPETA el límite DC_MAX_POSTULANTES visualmente
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

  try {
    const { getDocs, collection, query, where, orderBy } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );

    // Leer categoría del proveedor autenticado
    const { getDoc, doc } = await import(
      'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
    );
    const uid        = window._fbAuth.currentUser.uid;
    const userSnap   = await getDoc(doc(window._fbDb, 'usuarios', uid));
    const categoriaProv = userSnap.exists() ? (userSnap.data().categoria || '') : '';

    // Query: reportes publicados o en_cotizacion (puede recibir más postulantes)
    const q = query(
      collection(window._fbDb, 'reportes'),
      where('estado', 'in', ['publicado', 'en_cotizacion']),
      orderBy('fechaCreacion', 'desc')
    );
    const snap = await getDocs(q);

    // Filtrar: solo los de la misma categoría y que tengan cupo (<4 postulantes)
    // También excluir los que el proveedor ya se postuló
    const docs = [];
    snap.forEach(docSnap => {
      const r = docSnap.data();
      // Filtrar por categoría si el proveedor tiene una definida
      if (categoriaProv && r.categoria !== categoriaProv) return;
      // Incluir aunque estén llenos (se muestra como cerrado para que el proveedor sepa)
      docs.push({ id: docSnap.id, ...r });
    });

    if (docs.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:36px;margin-bottom:10px;">📋</div>
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Sin solicitudes activas</div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5;">
            No hay solicitudes de tu categoría en este momento.<br>Cuando un vecino publique una, aparecerá aquí.
          </div>
        </div>`;
      return;
    }

    contenedor.innerHTML = '';
    docs.forEach(r => {
      const cat      = DC_CATEGORIAS[r.categoria] || DC_CATEGORIAS.otro;
      const lleno    = (r.totalPostulantes || 0) >= DC_MAX_POSTULANTES;
      const yaPostulado = Array.isArray(r.postulantes) && r.postulantes.includes(uid);

      const card = document.createElement('div');
      card.className = 'prov-card';
      card.style.opacity = lleno ? '0.65' : '1';
      card.style.cursor  = lleno ? 'default' : 'pointer';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="display:flex;gap:10px;align-items:center;flex:1;">
            <div style="width:38px;height:38px;border-radius:12px;background:#E8F5EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${cat.ic}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);">${cat.label}</div>
              <div style="font-size:11px;color:var(--text-muted);">${_formatFecha(r.fechaCreacion)}${r.zona ? ' · 📍 ' + r.zona : ''}</div>
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
              : `<button onclick="window.verDetalleReporte('${r.id}', null)" style="background:var(--green);color:#fff;border:none;border-radius:10px;padding:7px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Ver solicitud →</button>`
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
// Navega a la vista v-reporte-detalle y rellena sus campos
// datosOpcionales: si ya tenemos el objeto del doc, lo usamos
//                  para evitar una lectura extra de Firestore
// ============================================================

window.verDetalleReporte = async function(reporteId, datos) {
  // Guardar ID en memoria para que las fases siguientes lo usen
  window._reporteActualId = reporteId;

  // Si ya tenemos los datos, renderizar directo
  if (datos) {
    _renderDetalleReporte(reporteId, datos);
    if (typeof go === 'function') go('v-reporte-detalle', 'right');
    return;
  }

  // Si no, leer de Firestore
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

  // Ícono y categoría
  const elIc  = document.getElementById('det-rep-ic');
  const elCat = document.getElementById('det-rep-categoria');
  const elFecha = document.getElementById('det-rep-fecha');
  const elDesc  = document.getElementById('det-rep-descripcion');
  const elZona  = document.getElementById('det-rep-zona');
  const elEstado = document.getElementById('det-rep-estado');
  const elPostulantes = document.getElementById('det-rep-postulantes');
  const elAccion = document.getElementById('det-rep-accion');

  if (elIc)          elIc.textContent  = cat.ic;
  if (elCat)         elCat.textContent = cat.label;
  if (elFecha)       elFecha.textContent = _formatFecha(r.fechaCreacion);
  if (elDesc)        elDesc.textContent = r.descripcion || '';
  if (elZona)        elZona.textContent = r.zona ? '📍 ' + r.zona : '';
  if (elEstado)      elEstado.innerHTML = _badgeEstado(r.estado);
  if (elPostulantes) elPostulantes.innerHTML = _badgePostulantes(r.totalPostulantes || 0);

  // Botón de acción: diferente para vecino vs proveedor
  if (elAccion) {
    const esVecino = r.vecinoId === uid;
    const lleno    = (r.totalPostulantes || 0) >= DC_MAX_POSTULANTES;
    const yaPostulado = Array.isArray(r.postulantes) && r.postulantes.includes(uid);

    if (esVecino) {
      // El vecino ve sus cotizaciones (Fase 2 implementará cargarCotizaciones)
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
      // Proveedor puede postularse (Fase 2 implementará postularseAReporte)
      elAccion.innerHTML = `
        <div style="background:#E8F0F8;border-radius:12px;padding:10px 12px;font-size:11px;color:#1A7AB5;margin-top:8px;">
          ℹ️ La función de cotizar estará disponible en la próxima actualización.
        </div>`;
    }
  }
}

// ── Exponer constante para que otras fases la usen ───────────
// Fases futuras (cotizaciones.js) deben importar este valor
// para validar el límite antes de insertar en postulantes[]
window.DC_MAX_POSTULANTES = DC_MAX_POSTULANTES;

console.log('[reportes.js] Cargado — límite de postulantes:', DC_MAX_POSTULANTES);
