// hitclaud — main.js
// Arranque del shell: canvas DPR-aware + dibujo estático de muestra.
// PROHIBIDO aquí: lógica de juego, física, sonido. Solo esqueleto visual.

(function () {
  'use strict';

  const canvas = document.getElementById('juego');
  const ctx = canvas.getContext('2d');

  const tokens = getComputedStyle(document.documentElement);
  const COLOR = {
    coral: tokens.getPropertyValue('--coral').trim(),
    negro: tokens.getPropertyValue('--negro').trim(),
    indigo: tokens.getPropertyValue('--indigo').trim(),
    indigoVivo: tokens.getPropertyValue('--indigo-vivo').trim(),
  };

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujarMuestra();
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

  // Bolita de muestra: 28px --indigo con borde 3px --indigo-vivo.
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

  function dibujarMuestra() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    dibujarTarget(w / 2 - 20, h * 0.3); // target centrado (40px de ancho)
    dibujarBolita(w / 2, h * 0.62);
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
