// hitclaud — main.js
// Shell + input táctil + vuelo de la bolita en canvas.
// La física vive en fisica.js (módulo puro); aquí solo captura y pintura.
// El target de muestra es DECORACIÓN: sin colisión en esta fase.
// Todo el vuelo se dibuja en canvas dentro de un solo rAF — cero layout thrashing.

(function () {
  'use strict';

  const canvas = document.getElementById('juego');
  const ctx = canvas.getContext('2d');
  const F = window.Fisica;

  const tokens = getComputedStyle(document.documentElement);
  const COLOR = {
    coral: tokens.getPropertyValue('--coral').trim(),
    negro: tokens.getPropertyValue('--negro').trim(),
    indigo: tokens.getPropertyValue('--indigo').trim(),
    indigoVivo: tokens.getPropertyValue('--indigo-vivo').trim(),
  };

  // ── Constantes de input ────────────────────────────────────────────
  const RADIO_HITMAKER = 145; // hit-test RADIAL desde la esquina inf-der
  const RADIO_NUCLEO = 60;    // soltar de vuelta aquí = cancelar
  const UMBRAL_PX = 14;       // trazo menor = ignorar
  const UMBRAL_SUELTA = 0.15; // px/ms: soltar más lento = la bolita CAE
  const CADENCIA_MS = 100;    // separación mínima entre SUELTAS (afinable)
  const MAX_BOLITAS = 24;     // tope de bolitas vivas simultáneas (rendimiento)
  const LAG_ESTELA = 3;       // muestreo hacia atrás por fantasma (×1,2,3)

  let W = 0;
  let H = 0;

  // Estado: MÚLTIPLES bolitas vivas. Cada una lleva SU propia estela.
  const gesto = { activo: false, puntos: [] };
  const bolitas = [];   // cada una: {x,y,vx,vy,edad,viva, historia:[]}
  let ultimoDisparo = -Infinity;
  let rafId = null;
  let tPrev = 0;

  function reposo() {
    // Posición de descanso de la bolita, dentro del núcleo del hitmaker
    return { x: W - 52, y: H - 52 };
  }

  function distEsquina(x, y) {
    return Math.hypot(W - x, H - y);
  }

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujar();
  }

  // ── Input (pointer events) — un gesto (un dedo) a la vez ────────────
  canvas.addEventListener('pointerdown', function (e) {
    if (gesto.activo) return;
    if (distEsquina(e.clientX, e.clientY) > RADIO_HITMAKER) return;
    gesto.activo = true;
    gesto.puntos = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    canvas.setPointerCapture(e.pointerId);
    arrancarBucle();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!gesto.activo) return;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!gesto.activo) return;
    gesto.activo = false;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    const puntos = gesto.puntos;
    const fin = puntos[puntos.length - 1];
    if (F.largoTrazo(puntos) < UMBRAL_PX) return;          // umbral
    if (distEsquina(fin.x, fin.y) <= RADIO_NUCLEO) return; // cancelación
    // Cadencia: no sueltes antes de CADENCIA_MS de la anterior.
    const ahora = performance.now();
    if (ahora - ultimoDisparo < CADENCIA_MS) return;
    if (bolitas.length >= MAX_BOLITAS) return;             // tope de rendimiento
    const disparo = F.crearDisparo(puntos);
    if (!disparo) return;
    // Suelta DESDE LA POSICIÓN DEL DEDO (sin teletransporte al reposo).
    // Dedo detenido (bajo umbral) = cae desde ahí (física honesta).
    const detenido = disparo.velSuelta < UMBRAL_SUELTA;
    bolitas.push({
      x: fin.x,
      y: fin.y,
      vx: detenido ? 0 : disparo.vx,
      vy: detenido ? 0 : disparo.vy,
      edad: 0,
      viva: true,
      historia: [],
    });
    ultimoDisparo = ahora;
    arrancarBucle();
  });

  canvas.addEventListener('pointercancel', function () {
    gesto.activo = false;
  });

  // ── Bucle de animación ─────────────────────────────────────────────
  function arrancarBucle() {
    if (rafId === null) {
      tPrev = performance.now();
      rafId = requestAnimationFrame(cuadro);
    }
  }

  function cuadro(t) {
    const dt = Math.min(t - tPrev, 32); // techo: pestañas en segundo plano
    tPrev = t;
    const limites = { w: W, h: H };
    for (let i = bolitas.length - 1; i >= 0; i--) {
      const b = bolitas[i];
      F.paso(b, dt, limites);
      // Historia propia para los 3 fantasmas (no hay estela compartida).
      b.historia.unshift({ x: b.x, y: b.y });
      if (b.historia.length > LAG_ESTELA * 3 + 1) b.historia.pop();
      if (!b.viva) bolitas.splice(i, 1); // sale del viewport o agota vida
    }
    dibujar();
    if (gesto.activo || bolitas.length > 0) {
      rafId = requestAnimationFrame(cuadro);
    } else {
      rafId = null;
    }
  }

  // ── Pintura ────────────────────────────────────────────────────────
  function dibujar() {
    ctx.clearRect(0, 0, W, H);
    dibujarTarget(W / 2 - 20, H * 0.3); // decoración, sin colisión
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      dibujarEstela(b);
      dibujarBolita(b.x, b.y);
    }
    if (gesto.activo) {
      // La bolita AGARRADA sigue el dedo EXACTAMENTE (sin lag ni suavizado).
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      dibujarBolita(dedo.x, dedo.y);
    } else if (performance.now() - ultimoDisparo >= CADENCIA_MS) {
      // Bolita en reposo = señal de "listo": aparece al cumplirse la cadencia.
      const r = reposo();
      dibujarBolita(r.x, r.y);
    }
  }

  // Estela propia de la bolita: 3 fantasmas al 30/20/10% de alfa.
  function dibujarEstela(b) {
    const alfas = [0.3, 0.2, 0.1];
    for (let i = 0; i < alfas.length; i++) {
      const p = b.historia[(i + 1) * LAG_ESTELA];
      if (!p) continue;
      ctx.globalAlpha = alfas[i];
      dibujarBolita(p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  // Target de muestra: retícula 5×4 de cubos de 8px en --coral.
  // Cubos esquineros de 8×8 con SOLO su esquina exterior redondeada a 4px;
  // ojos de 4px en --negro.
  function dibujarTarget(x, y) {
    const CUBO = 8;
    const COLS = 5;
    const FILAS = 4;
    const RADIO_ESQ = 4;
    ctx.fillStyle = COLOR.coral;
    for (let f = 0; f < FILAS; f++) {
      for (let c = 0; c < COLS; c++) {
        const cx = x + c * CUBO;
        const cy = y + f * CUBO;
        // Radios [sup-izq, sup-der, inf-der, inf-izq]: solo la esquina
        // exterior del sprite lleva 4px.
        const radios = [
          f === 0 && c === 0 ? RADIO_ESQ : 0,
          f === 0 && c === COLS - 1 ? RADIO_ESQ : 0,
          f === FILAS - 1 && c === COLS - 1 ? RADIO_ESQ : 0,
          f === FILAS - 1 && c === 0 ? RADIO_ESQ : 0,
        ];
        ctx.beginPath();
        ctx.roundRect(cx, cy, CUBO, CUBO, radios);
        ctx.fill();
      }
    }
    // Ojos: dos cuadrados de 4px (2×2 respecto a la retícula base)
    ctx.fillStyle = COLOR.negro;
    ctx.fillRect(x + 1 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
    ctx.fillRect(x + 3 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
  }

  // Bolita: 28px --indigo con borde 3px --indigo-vivo.
  function dibujarBolita(cx, cy) {
    const RADIO = 14; // diámetro 28px
    ctx.beginPath();
    ctx.arc(cx, cy, RADIO - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.indigo;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLOR.indigoVivo;
    ctx.stroke();
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
