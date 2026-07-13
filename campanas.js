// ── campanas.js — Sistema de Campañas Dominio Cumbres ────────────────────────
// Carga banners pagados desde Firestore `campanas` y los muestra en carruseles
// por sección. Máx 10 slots por ubicación, rotación cada 5 s.

(function () {
  'use strict';

  // Timers activos por containerId
  var _timers = {};

  // ── Estilos del carrusel ──────────────────────────────────────────────────
  var _styleId = 'dc-campanas-style';
  if (!document.getElementById(_styleId)) {
    var st = document.createElement('style');
    st.id = _styleId;
    st.textContent = [
      '.dc-campana-wrap{margin:8px 14px 4px;position:relative;overflow:hidden;border-radius:16px;cursor:pointer;}',
      '.dc-campana-track{display:flex;transition:transform .4s cubic-bezier(.4,0,.2,1);}',
      '.dc-campana-slide{min-width:100%;box-sizing:border-box;position:relative;}',
      '.dc-campana-img{width:100%;height:140px;object-fit:cover;display:block;border-radius:16px;}',
      '.dc-campana-overlay{position:absolute;inset:0;border-radius:16px;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,.72) 100%);pointer-events:none;}',
      '.dc-campana-txt{position:absolute;bottom:0;left:0;right:0;padding:10px 14px 12px;}',
      '.dc-campana-nombre{font-size:14px;font-weight:800;color:#fff;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.5);}',
      '.dc-campana-sub{font-size:11px;color:rgba(255,255,255,.8);margin-top:2px;}',
      '.dc-campana-dots{display:flex;justify-content:center;gap:5px;padding:6px 0 2px;}',
      '.dc-campana-dot{width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,.18);transition:background .3s;}',
      '.dc-campana-dot.on{background:#F5C518;width:16px;border-radius:3px;}',
      '.dc-campana-badge{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);border-radius:20px;padding:2px 8px;font-size:9px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.3px;}',
    ].join('');
    document.head.appendChild(st);
  }

  // ── Función principal ─────────────────────────────────────────────────────
  // ubicacion: 'home'|'food'|'plaza'|'servicios'|'informa'|'eventos'
  // containerId: id del div donde se inyecta el carrusel
  function cargar(ubicacion, containerId) {
    var contenedor = document.getElementById(containerId);
    if (!contenedor) return;

    // Limpiar timer anterior si existe
    if (_timers[containerId]) {
      clearInterval(_timers[containerId]);
      delete _timers[containerId];
    }

    var db = window._fbDb;
    if (!db) { contenedor.innerHTML = ''; return; }

    var ahora = new Date();

    db.collection('campanas')
      .where('ubicacion', '==', ubicacion)
      .where('estado', '==', 'activa')
      .orderBy('orden', 'asc')
      .limit(10)
      .get()
      .then(function (snap) {
        // Filtrar por fecha de vigencia
        var activas = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          var fin = d.fin && d.fin.toDate ? d.fin.toDate() : (d.fin ? new Date(d.fin) : null);
          if (!fin || fin > ahora) activas.push(d);
        });

        if (activas.length === 0) {
          contenedor.innerHTML = '';
          return;
        }

        _renderCarrusel(contenedor, containerId, activas);
      })
      .catch(function () {
        contenedor.innerHTML = '';
      });
  }

  // ── Renderizar carrusel ───────────────────────────────────────────────────
  function _renderCarrusel(contenedor, containerId, slides) {
    var idx = 0;
    var total = slides.length;

    // Construir HTML
    var slidesHtml = slides.map(function (s, i) {
      var bg = s.imagen
        ? '<img class="dc-campana-img" src="' + _esc(s.imagen) + '" alt="' + _esc(s.nombre || '') + '" loading="lazy">'
        : '<div class="dc-campana-img" style="background:linear-gradient(135deg,#1A3A5C,#2E86C1);display:flex;align-items:center;justify-content:center;font-size:32px;">' + (s.emoji || '📢') + '</div>';
      var txt = '';
      if (s.nombre || s.texto) {
        txt = '<div class="dc-campana-overlay"></div>'
          + '<div class="dc-campana-txt">'
          + (s.nombre ? '<div class="dc-campana-nombre">' + _esc(s.nombre) + '</div>' : '')
          + (s.texto  ? '<div class="dc-campana-sub">' + _esc(s.texto)   + '</div>' : '')
          + '</div>';
      }
      return '<div class="dc-campana-slide">' + bg + txt
        + '<div class="dc-campana-badge">Publicidad</div>'
        + '</div>';
    }).join('');

    var dotsHtml = total > 1 ? slides.map(function (_, i) {
      return '<div class="dc-campana-dot' + (i === 0 ? ' on' : '') + '" id="' + containerId + '-dot-' + i + '"></div>';
    }).join('') : '';

    contenedor.innerHTML = '<div class="dc-campana-wrap" id="' + containerId + '-wrap">'
      + '<div class="dc-campana-track" id="' + containerId + '-track" style="transform:translateX(0%)">'
      + slidesHtml
      + '</div>'
      + '</div>'
      + (total > 1 ? '<div class="dc-campana-dots">' + dotsHtml + '</div>' : '');

    // Tap para ir al negocio (si tiene link)
    var wrap = document.getElementById(containerId + '-wrap');
    if (wrap) {
      wrap.onclick = function () {
        var s = slides[idx];
        if (s && s.negocioId) {
          window._abrirNegocio && window._abrirNegocio(s.negocioId, s.tipo || 'proveedor');
        }
      };
    }

    if (total <= 1) return;

    // Auto-rotación
    _timers[containerId] = setInterval(function () {
      idx = (idx + 1) % total;
      _ir(containerId, idx, total);
    }, 5000);
  }

  function _ir(containerId, idx, total) {
    var track = document.getElementById(containerId + '-track');
    if (track) track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    for (var i = 0; i < total; i++) {
      var dot = document.getElementById(containerId + '-dot-' + i);
      if (dot) dot.className = 'dc-campana-dot' + (i === idx ? ' on' : '');
    }
  }

  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── API pública ───────────────────────────────────────────────────────────
  window.dcCampanas = {
    cargar: cargar,
    limpiar: function (containerId) {
      if (_timers[containerId]) { clearInterval(_timers[containerId]); delete _timers[containerId]; }
      var c = document.getElementById(containerId);
      if (c) c.innerHTML = '';
    }
  };
})();
