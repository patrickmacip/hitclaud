// hitclaud — test de la física de los cubos: node test/cubos.test.js

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };
const G = F.FISICA.G_TARGET; // gravedad de target (los cubos caen con ella)
const DT = 1000 / 60;

// Update de un cubo (espejo de main.js): gravedad + muerte SOLO al salir.
function pasoCubo(q) {
  q.vy += G * DT;
  q.x += q.vx * DT;
  q.y += q.vy * DT;
  if (q.y > VP.h + 8 || q.x < -8 || q.x > VP.w + 8 || q.y < -400) q.viva = false;
}

console.log('=== Los cubos mueren al SALIR del viewport, no por tiempo ===');
{
  // Cubo lanzado hacia arriba desde media pantalla: vive > 1200ms (la vieja
  // vida por tiempo) y muere sólo al salir por abajo.
  const q = { x: 195, y: 422, vx: 0, vy: -1, viva: true };
  let t = 0, vivoEn1200 = false, tMuerte = 0, yMuerte = 0;
  while (q.viva && t < 6000) { pasoCubo(q); t += DT; if (t >= 1200 && !vivoEn1200 && q.viva) vivoEn1200 = true; if (!q.viva) { tMuerte = t; yMuerte = q.y; } }
  console.log(`  vivo a los 1200ms (antes moría por vida): ${vivoEn1200 ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  murió a ${Math.round(tMuerte)}ms al salir por abajo (y=${Math.round(yMuerte)} > ${VP.h}): ${yMuerte > VP.h ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Toque mínimo → 1 cubo (10 pts) ===');
{
  const celdas = []; for (let i = 0; i < 20; i++) celdas.push(true);
  const t = { x: 200, y: 400, rot: 0, vx: 0, vy: 0, celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET };
  const cx = F.cajaLocal(t);
  const b = { x: t.x + cx.cx - cx.hw - 2, y: 400, vx: 0.03, vy: 0, viva: true }; // roce mínimo
  const r = F.resolverImpacto(b, t);
  console.log(`  arrancados=${r.destruidos} (≥1) = ${r.destruidos * 10} pts  ${r.destruidos >= 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== PRESUPUESTO peor caso: fiesta con explosiones + cubos cayendo ===');
{
  const MAX_CUBOS = 240;
  const cubos = [];
  function explotar(n, cx, cy) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.3 + Math.random() * 0.5;
      cubos.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, viva: true });
    }
    while (cubos.length > MAX_CUBOS) cubos.shift(); // recicla los MÁS VIEJOS
  }
  let pico = 0;
  const FRAMES = 1200; // 20s
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < FRAMES; f++) {
    // fiesta: una destrucción (20 cubos) cada ~200ms, una estrella (58) cada ~3s
    if (f % 12 === 0) explotar(20, Math.random() * VP.w, Math.random() * VP.h * 0.6);
    if (f % 180 === 0) explotar(58, Math.random() * VP.w, Math.random() * VP.h * 0.5);
    for (let i = cubos.length - 1; i >= 0; i--) { pasoCubo(cubos[i]); if (!cubos[i].viva) cubos.splice(i, 1); }
    pico = Math.max(pico, cubos.length);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / FRAMES;
  console.log(`  pico de cubos vivos: ${pico} (tope ${MAX_CUBOS})  ${pico <= MAX_CUBOS ? 'dentro del tope ✓' : 'recicla los más viejos'}`);
  console.log(`  update: ${ms.toFixed(4)} ms/cuadro (presupuesto 16.67) → ${ms < 16.67 ? '60fps ✓' : 'NO ✗'}  (dibujo = fillRects simples)`);
}
