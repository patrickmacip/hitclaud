// hitclaud — test de fisica.js en node: node test/fisica.test.js
// Tiro 1:1 con el dedo (sin distancia, sin chanfle). Viewport 390×844.

const F = require('../js/fisica.js');

const VIEWPORT = { w: 390, h: 844 };
const ORIGEN = { x: 338, y: 792 };
const UMBRAL_SUELTA = 0.15; // igual que main.js: por debajo, cae

// Gesto uniforme: velocidad constante `vel` px/ms, longitud `dist`, dir (ux,uy).
// Muestreado cada `dtMs` (simula pointer events regulares).
function uniforme(vel, dist, ux, uy, dtMs) {
  const dur = dist / vel;
  const n = Math.max(2, Math.round(dur / dtMs) + 1);
  const p = [];
  const L = Math.hypot(ux, uy);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    p.push({ x: ORIGEN.x + (ux / L) * dist * k, y: ORIGEN.y + (uy / L) * dist * k, t: k * dur });
  }
  return p;
}

function ruido(p, amp) {
  return p.map(function (q) {
    return { x: q.x + (Math.random() * 2 - 1) * amp, y: q.y + (Math.random() * 2 - 1) * amp, t: q.t };
  });
}

function salida(p) {
  const d = F.crearDisparo(p);
  const rap = Math.hypot(d.vx, d.vy);
  const cae = d.velSuelta < UMBRAL_SUELTA;
  return { velSuelta: d.velSuelta, rapidez: cae ? 0 : rap, cae: cae };
}

// ── BARRIDO DE LINEALIDAD (sin escalón, monótono) ──────────────────
// velSuelta 0.2→3.0 paso 0.1; construye un gesto uniforme a esa velocidad
// y mide la salida real de crearDisparo. Requisitos: monótona creciente y
// ningún delta > 1.6× el promedio de los deltas anteriores.
console.log('=== BARRIDO de linealidad de la curva de respuesta ===');
(function () {
  const outs = [];
  for (let v = 0.2; v <= 3.001; v += 0.1) {
    outs.push({ v: v, s: salida(uniforme(v, Math.max(90, v * 120), -0.5, -1, 12)).rapidez });
  }
  const deltas = [];
  let monot = true;
  let peorRatio = 0;
  let vPeor = 0;
  for (let i = 1; i < outs.length; i++) {
    const d = outs[i].s - outs[i - 1].s;
    if (d <= 0) monot = false;
    if (deltas.length) {
      const prom = deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
      const ratio = d / prom;
      if (ratio > peorRatio) { peorRatio = ratio; vPeor = outs[i].v; }
    }
    deltas.push(d);
  }
  const dmin = Math.min.apply(null, deltas);
  const dmax = Math.max.apply(null, deltas);
  const dprom = deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
  console.log(`  salida 0.2→3.0 px/ms: ${outs[0].s.toFixed(2)} … ${outs[outs.length - 1].s.toFixed(2)} px/ms  (techo ${F.FISICA.VEL_SALIDA_MAX})`);
  console.log(`  deltas por paso: mín=${dmin.toFixed(3)} máx=${dmax.toFixed(3)} prom=${dprom.toFixed(3)}`);
  console.log(`  monótona creciente: ${monot ? 'sí ✓' : 'NO ✗'}`);
  console.log(`  peor delta vs promedio previo: ${peorRatio.toFixed(2)}× (en velSuelta=${vPeor.toFixed(1)})  [criterio ≤1.6×: ${peorRatio <= 1.6 ? 'OK ✓' : 'NO ✗'}]`);
})();

// ── RONDAS DE AFINADO DE LA VENTANA/LECTURA ────────────────────────
// Reimplementaciones locales para comparar técnicas sobre el MISMO gesto
// ruidoso (±1px, dt≈16ms). Métrica: dispersión de 5 lecturas de salida.
function leerNaive2(p) { // últimos 2 puntos (naïve): sensible al último evento
  const a = p[p.length - 2], b = p[p.length - 1];
  const dt = Math.max(b.t - a.t, 1);
  return Math.hypot(b.x - a.x, b.y - a.y) / dt;
}
function leerSingle(p, ventana) { // extremos de la ventana
  const tFin = p[p.length - 1].t;
  let i = p.length - 1;
  while (i > 0 && tFin - p[i - 1].t <= ventana) i--;
  const a = p[i], b = p[p.length - 1];
  const dt = Math.max(b.t - a.t, 1);
  return Math.hypot(b.x - a.x, b.y - a.y) / dt;
}
function leerMediana(p, ventana) {
  const tFin = p[p.length - 1].t;
  let i = p.length - 1;
  while (i > 0 && tFin - p[i - 1].t <= ventana) i--;
  const tr = p.slice(i);
  const vs = [];
  for (let k = 1; k < tr.length; k++) {
    const dt = tr[k].t - tr[k - 1].t;
    if (dt > 0) vs.push(Math.hypot(tr[k].x - tr[k - 1].x, tr[k].y - tr[k - 1].y) / dt);
  }
  vs.sort(function (a, b) { return a - b; });
  const m = vs.length >> 1;
  return vs.length ? (vs.length % 2 ? vs[m] : (vs[m - 1] + vs[m]) / 2) : 0;
}
function dispersion(fn) {
  const base = uniforme(1.8, 300, -0.6, -1, 16);
  const lec = [];
  for (let r = 0; r < 60; r++) lec.push(fn(ruido(base, 1)));
  const min = Math.min.apply(null, lec);
  const max = Math.max.apply(null, lec);
  const med = lec.reduce(function (a, b) { return a + b; }, 0) / lec.length;
  return ((max - min) / med * 100);
}

console.log('=== RONDAS de afinado de la lectura de suelta (verdad = 1.80 px/ms) ===');
console.log('  Dispersión de 60 lecturas con ruido gaussiano ±1px, dt≈16ms:');
console.log(`    R1 naïve últimos-2 pts : ±${(dispersion(leerNaive2) / 2).toFixed(1)}%`);
console.log(`    R2 extremos ventana 50ms: ±${(dispersion(function (p) { return leerSingle(p, 50); }) / 2).toFixed(1)}%`);
console.log(`    R3 mediana ventana 50ms : ±${(dispersion(function (p) { return leerMediana(p, 50); }) / 2).toFixed(1)}%`);
console.log(`    R4 mediana ventana 70ms : ±${(dispersion(function (p) { return leerMediana(p, 70); }) / 2).toFixed(1)}%`);
// R5: UN evento errático al final (dt 4ms + salto de 16px) — "se me pasó un
// puntito al soltar". Es el caso que motiva la mediana sobre la naïve.
const conPico = uniforme(1.8, 300, -0.6, -1, 16);
const u = conPico[conPico.length - 1];
conPico.push({ x: u.x - 16, y: u.y - 5, t: u.t + 4 });
console.log('  Evento errático final (salto 16px en 4ms):');
console.log(`    naïve últimos-2 pts: ${leerNaive2(conPico).toFixed(2)} px/ms  vs  mediana 70ms: ${leerMediana(conPico, 70).toFixed(2)} px/ms`);
console.log('  → elegido: MEDIANA, ventana 70ms. 70ms baja la dispersión de ruido');
console.log('    frente a 50ms (más segmentos), y la mediana ignora el evento errático');
console.log('    que dispara la lectura naïve. Sin suavizar el seguimiento del dedo.');

// ── 5 CASOS ────────────────────────────────────────────────────────
console.log('\n=== a. MISMA velocidad de suelta, distancias 80px vs 400px ===');
const a1 = salida(uniforme(1.8, 80, -0.6, -1, 12));
const a2 = salida(uniforme(1.8, 400, -0.6, -1, 12));
const difA = Math.abs(a1.rapidez - a2.rapidez) / a1.rapidez * 100;
console.log(`  80px : velSuelta=${a1.velSuelta.toFixed(3)}  salida=${a1.rapidez.toFixed(3)} px/ms`);
console.log(`  400px: velSuelta=${a2.velSuelta.toFixed(3)}  salida=${a2.rapidez.toFixed(3)} px/ms`);
console.log(`  → diferencia ${difA.toFixed(2)}%  [criterio ±2%: ${difA <= 2 ? 'OK ✓' : 'NO ✗'}]`);

console.log('\n=== b. Suelta LENTA → tiro suave / c. Suelta RÁPIDA → tiro fuerte ===');
const b = salida(uniforme(0.5, 200, -0.5, -1, 16));
const c = salida(uniforme(2.4, 200, -0.5, -1, 12));
console.log(`  b lenta : velSuelta=${b.velSuelta.toFixed(2)}  salida=${b.rapidez.toFixed(2)} px/ms`);
console.log(`  c rápida: velSuelta=${c.velSuelta.toFixed(2)}  salida=${c.rapidez.toFixed(2)} px/ms`);

console.log('\n=== d. Dedo DETENIDO al soltar → cae ===');
// Se mueve y luego se queda quieto los últimos ~90ms (varios eventos iguales).
const dq = uniforme(1.5, 150, -0.5, -1, 16);
const fin = dq[dq.length - 1];
for (let e = 1; e <= 6; e++) dq.push({ x: fin.x, y: fin.y, t: fin.t + e * 15 });
const d = salida(dq);
console.log(`  velSuelta=${d.velSuelta.toFixed(3)}  cae=${d.cae ? 'sí ✓' : 'no ✗'}  salida=${d.rapidez.toFixed(3)} px/ms`);

console.log('\n=== e. MISMO gesto ×5 con micro-ruido ±1px → predecibilidad ±5% ===');
const baseE = uniforme(1.9, 260, -0.55, -1, 16);
const salidas = [];
for (let r = 0; r < 5; r++) {
  const s = salida(ruido(baseE, 1));
  salidas.push(s.rapidez);
  console.log(`  tiro ${r + 1}: salida=${s.rapidez.toFixed(3)} px/ms`);
}
const minE = Math.min.apply(null, salidas);
const maxE = Math.max.apply(null, salidas);
const medE = salidas.reduce(function (a, b) { return a + b; }, 0) / salidas.length;
const spreadE = (maxE - minE) / medE * 100;
console.log(`  → dispersión ${spreadE.toFixed(2)}%  [criterio ±5%: ${spreadE <= 5 ? 'OK ✓' : 'NO ✗'}]`);
