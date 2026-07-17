// hitclaud — test de fisica.js en node: node test/fisica.test.js
// Mundo LATERAL con gravedad + potencia por velocidad de suelta + chanfle.
// Viewport 390×844. Lanza desde el reposo del hitmaker.

const F = require('../js/fisica.js');

const VIEWPORT = { w: 390, h: 844 };
const ORIGEN = { x: 338, y: 792 };

function recto(x0, y0, x1, y1, durMs, n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    p.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, t: k * durMs });
  }
  return p;
}

// Arco circular de central `barrido` rad, longitud de arco fija.
function arco(largo, barrido, durMs, n) {
  const r = largo / Math.abs(barrido);
  const p = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = barrido * k;
    p.push({ x: r * Math.sin(a), y: -r * (1 - Math.cos(a)), t: k * durMs });
  }
  return p;
}

// Rota los puntos alrededor del último para que la dirección de suelta
// (últimos ~50ms) apunte hacia arriba. Preserva longitudes, dt y el ángulo
// entre mitades → misma potencia y mismo |spin|, sólo cambia la orientación.
function orientarSueltaArriba(p) {
  const s = F.crearDisparo(p, VIEWPORT.h); // sólo para leer dir de suelta
  const alpha = Math.atan2(s.vy, s.vx);
  const rot = -Math.PI / 2 - alpha; // objetivo: (0,-1) = arriba
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const piv = p[p.length - 1];
  return p.map((q) => {
    const dx = q.x - piv.x;
    const dy = q.y - piv.y;
    return { x: piv.x + dx * cos - dy * sin, y: piv.y + dx * sin + dy * cos, t: q.t };
  });
}

function volar(d) {
  const b = { x: ORIGEN.x, y: ORIGEN.y, vx: d.vx, vy: d.vy, spin: d.spin, edad: 0, viva: true };
  const tray = [];
  let t = 0;
  const DT = 5;
  while (b.viva && t < 7000) {
    F.paso(b, DT, VIEWPORT);
    t += DT;
    tray.push({ t: t, x: b.x, y: b.y });
  }
  return { b: b, t: t, tray: tray };
}

function reporta(nombre, p) {
  const d = F.crearDisparo(p, VIEWPORT.h);
  const r = volar(d);
  let apiceY = ORIGEN.y;
  let tAp = 0;
  for (const q of r.tray) if (q.y < apiceY) { apiceY = q.y; tAp = q.t; }
  console.log(
    `\n${nombre}\n  velSuelta=${d.velSuelta.toFixed(2)} px/ms  |v0|=${Math.hypot(d.vx, d.vy).toFixed(2)} px/ms  ` +
    `(×${(Math.hypot(d.vx, d.vy) / d.velSuelta).toFixed(2)} del dedo)  pot=${d.potencia.toFixed(2)} spin=${d.spin.toFixed(2)}\n` +
    `  ápice: subió ${Math.round(ORIGEN.y - apiceY)}px en ${tAp}ms  salida (${Math.round(r.b.x)},${Math.round(r.b.y)}) a ${r.t}ms`
  );
  return { d: d, r: r };
}

console.log('=== potencia por velocidad de suelta ===');
reporta('a. Suelta RÁPIDA corta (80px/40ms)', recto(338, 792, 300, 722, 40, 6));
reporta('b. Suelta LENTA larga (300px/700ms)', recto(338, 792, 120, 520, 700, 30));
reporta('c. Suelta RÁPIDA larga (300px/150ms)', recto(338, 792, 120, 520, 150, 16));

console.log('\n=== chanfle: (d) recto vs (e) curvo 45°, MISMA potencia ===');
// (d) recto y (e) arco 90° (→ 45° entre mitades), misma longitud y duración,
// ambos orientados a soltar hacia arriba: sólo difieren en el spin.
const LARGO = 220;
const DUR = 120;
const N = 24;
const gd = orientarSueltaArriba(recto(0, 0, 0, -LARGO, DUR, N));
const ge = orientarSueltaArriba(arco(LARGO, Math.PI / 2, DUR, N));
const D = reporta('d. Recto (potencia media, spin≈0)', gd);
const E = reporta('e. Curvo 90° arco = 45° entre mitades', ge);

// Diferencia lateral (horizontal) máxima mientras ambos siguen vivos.
let maxLat = 0;
const nComun = Math.min(D.r.tray.length, E.r.tray.length);
for (let i = 0; i < nComun; i++) {
  maxLat = Math.max(maxLat, Math.abs(E.r.tray[i].x - D.r.tray[i].x));
}
console.log(
  `\n  → desviación lateral máxima (e) vs (d): ${Math.round(maxLat)}px  ` +
  `[criterio ≥100px: ${maxLat >= 100 ? 'OK ✓' : 'NO ✗'}]`
);
