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
    coralVivo: tokens.getPropertyValue('--coral-vivo').trim(),
    crema: tokens.getPropertyValue('--crema').trim(),
    negro: tokens.getPropertyValue('--negro').trim(),
    indigo: tokens.getPropertyValue('--indigo').trim(),
    indigoVivo: tokens.getPropertyValue('--indigo-vivo').trim(),
  };

  // ── Constantes de input ────────────────────────────────────────────
  const RADIO_HITMAKER = 145; // hit-test RADIAL desde la esquina inf-der
  const RADIO_NUCLEO = 60;    // soltar de vuelta aquí = cancelar
  const UMBRAL_PX = 14;       // trazo menor = ignorar
  const PUNTOS_GUIA = 12;     // puntos de la línea de trayectoria estimada
  const DT_GUIA_MS = 45;      // separación temporal entre puntos de guía
  const REBOTES_MUERTE = 2;   // la bolita muere al 2º contacto con borde

  let W = 0;
  let H = 0;

  // Estado (una bolita a la vez)
  const gesto = { activo: false, puntos: [] };
  let bolita = null;   // en vuelo: {x,y,vx,vy,spin,rebotes}
  const estela = [];   // posiciones recientes para los 3 fantasmas
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

  // ── Input (pointer events) ─────────────────────────────────────────
  canvas.addEventListener('pointerdown', function (e) {
    if (bolita) return; // esperar a que la bolita muera
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
    const disparo = F.crearDisparo(puntos, H);
    if (!disparo) return;
    const r = reposo();
    bolita = { x: r.x, y: r.y, vx: disparo.vx, vy: disparo.vy, spin: disparo.spin, rebotes: 0 };
    estela.length = 0;
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
    if (bolita) {
      F.paso(bolita, dt, { w: W, h: H });
      estela.unshift({ x: bolita.x, y: bolita.y });
      if (estela.length > 10) estela.pop();
      if (bolita.rebotes >= REBOTES_MUERTE) {
        // Muere al 2º contacto y reaparece lista en el hitmaker
        bolita = null;
        estela.length = 0;
      }
    }
    dibujar();
    if (gesto.activo || bolita) {
      rafId = requestAnimationFrame(cuadro);
    } else {
      rafId = null;
    }
  }

  // ── Pintura ────────────────────────────────────────────────────────
  function dibujar() {
    ctx.clearRect(0, 0, W, H);
    dibujarTarget(W / 2 - 20, H * 0.3); // decoración, sin colisión
    if (gesto.activo) dibujarGuia();
    if (bolita) {
      dibujarEstela();
      dibujarBolita(bolita.x, bolita.y);
    } else if (!gesto.activo) {
      const r = reposo();
      dibujarBolita(r.x, r.y);
    }
  }

  // Guía visual: línea de puntos + anillo de potencia. AMBOS salen de
  // crearDisparo sobre el trazo parcial — la previsualización nunca miente.
  // Técnica del anillo: arco dibujado EN CANVAS (no CSS var) para mantener
  // una sola superficie de pintura por cuadro.
  function dibujarGuia() {
    const previa = F.crearDisparo(gesto.puntos, H);
    if (!previa) return;
    const r = reposo();
    const sim = { x: r.x, y: r.y, vx: previa.vx, vy: previa.vy, spin: previa.spin, rebotes: 0 };
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = COLOR.crema;
    for (let i = 0; i < PUNTOS_GUIA; i++) {
      F.paso(sim, DT_GUIA_MS, { w: W, h: H });
      ctx.beginPath();
      ctx.arc(sim.x, sim.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Anillo llenándose: cuarto de arco desde la izquierda (π) hacia
    // arriba (3π/2), barrido proporcional a la potencia.
    ctx.beginPath();
    ctx.arc(W, H, 130, Math.PI, Math.PI + previa.potencia * (Math.PI / 2));
    ctx.strokeStyle = COLOR.coralVivo;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Estela: 3 fantasmas al 30/20/10% de alfa, muestreados hacia atrás.
  function dibujarEstela() {
    const lags = [3, 6, 9];
    const alfas = [0.3, 0.2, 0.1];
    for (let i = 0; i < lags.length; i++) {
      const p = estela[lags[i]];
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
