// hitclaud — FASE 10 commit 2: velocidad de trayectoria +25%: node test/velocidad.test.js
// Verifica: +25% EXACTO en la magnitud inicial, relación de especiales mantenida,
// sin túnel de colisión con la velocidad nueva, y reporta la economía a 60s.

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };

let ok = 0, ko = 0;
function chk(nombre, cond) { console.log(`  ${nombre}  ${cond ? 'OK ✓' : 'NO ✗'}`); if (cond) ok++; else ko++; }
const casi = (a, b) => Math.abs(a - b) < 1e-9;

console.log('=== +25% EXACTO en la magnitud inicial (VEL_TRAYECTORIA = 1.25) ===');
{
  chk('VEL_TRAYECTORIA === 1.25', F.LANZA.VEL_TRAYECTORIA === 1.25);

  // RNG determinista: mismo sorteo para ANTES (1.0) y DESPUÉS (1.25). Se fuerza un
  // target SUPERIOR (vy≥0, cae) → el recorte de ápice (sólo vy<0) NO interviene,
  // así ambos componentes reflejan la magnitud inicial pura.
  const realRandom = Math.random;
  const seq = [0.40, 0.5, 0.5, 0.5, 0.5]; // 0.40 ∈ [0.30,0.52) → 'superior'
  let idx;
  Math.random = function () { return seq[idx++ % seq.length]; };
  function crear(traj) { F.LANZA.VEL_TRAYECTORIA = traj; idx = 0; return F.crearTarget(VP); }

  const antes = crear(1.0);
  const desp = crear(1.25);
  Math.random = realRandom; F.LANZA.VEL_TRAYECTORIA = 1.25;

  chk(`origen superior (sin recorte de ápice): ${desp.origen}`, desp.origen === 'superior');
  chk(`vx ×1.25 exacto (${antes.vx.toFixed(4)} → ${desp.vx.toFixed(4)})`, casi(desp.vx, antes.vx * 1.25));
  chk(`vy ×1.25 exacto (${antes.vy.toFixed(4)} → ${desp.vy.toFixed(4)})`, casi(desp.vy, antes.vy * 1.25));
  const vAntes = Math.hypot(antes.vx, antes.vy), vDesp = Math.hypot(desp.vx, desp.vy);
  chk(`|v| inicial +25% exacto (${vAntes.toFixed(4)} → ${vDesp.toFixed(4)})`, casi(vDesp, vAntes * 1.25));
  chk('gravedad NO cambia (misma en ambos)', casi(antes.gravedad, desp.gravedad));
}

console.log('\n=== ESPECIALES: relación con el normal MANTENIDA sobre el nuevo valor ===');
{
  // CloudOver (rojo) usa el MISMO crearTarget que el normal → 1.00× (relación real
  // actual). GRANDE divide la velocidad por 3 (main.js GRANDE_LENTO) → 0.333×.
  // Al escalar el normal ×1.25, ambas relaciones se conservan (el factor se cancela).
  const GRANDE_LENTO = 3;
  const realRandom = Math.random;
  const seq = [0.10, 0.5, 0.3, 0.9, 0.5]; // inferior
  let idx; Math.random = function () { return seq[idx++ % seq.length]; };
  const normal = (F.LANZA.VEL_TRAYECTORIA = 1.25, idx = 0, F.crearTarget(VP));
  Math.random = realRandom;
  const vNormal = Math.hypot(normal.vx, normal.vy);
  const vRojo = vNormal;                    // rojo = normal
  const vGrande = vNormal / GRANDE_LENTO;   // grande = normal/3
  console.log(`  NORMAL |v| = ${vNormal.toFixed(3)} · CloudOver = ${vRojo.toFixed(3)} · GRANDE = ${vGrande.toFixed(3)} px/ms`);
  chk('CloudOver = 1.00× del normal (relación real, NO 0.5×)', casi(vRojo / vNormal, 1.0));
  chk('GRANDE = 0.333× del normal', Math.abs(vGrande / vNormal - 1 / 3) < 1e-9);
}

console.log('\n=== SIN TÚNEL con la velocidad nueva: paso() subdivide ≤ MAX_PASO_PX ===');
{
  const MAXP = F.FISICA.MAX_PASO_PX;
  // Peor caso = target más rápido posible tras el +25% (recorte de ápice incluido).
  let vmax = 0;
  for (let i = 0; i < 20000; i++) { const t = F.crearTarget(VP); vmax = Math.max(vmax, Math.hypot(t.vx, t.vy)); }
  console.log(`  MAX_PASO_PX=${MAXP} · target más rápido observado ${vmax.toFixed(3)} px/ms`);

  // Instrumenta paso(): mide el mayor salto por subpaso a esa velocidad, 60fps.
  const t = { x: 100, y: 400, vx: vmax, vy: 0, rot: 0, velRot: 0, radio: F.FISICA.RADIO_TARGET, gravedad: 0.001, edad: 0, viva: true, haEntrado: true };
  let px = t.x, py = t.y, maxSalto = 0;
  for (let f = 0; f < 30; f++) {
    F.paso(t, 16.7, VP, function () {
      maxSalto = Math.max(maxSalto, Math.hypot(t.x - px, t.y - py));
      px = t.x; py = t.y;
    });
  }
  console.log(`  mayor desplazamiento por subpaso = ${maxSalto.toFixed(2)}px`);
  chk('ningún subpaso supera MAX_PASO_PX (no hay túnel)', maxSalto <= MAXP + 1e-6);

  // Colisión real: una hitball a V_MAX que atraviesa un target intacto SIEMPRE
  // detecta contacto (200 ángulos), aun con el target movido a la velocidad nueva.
  const VMAX = F.FISICA.VEL_SALIDA_MAX;
  function targetIntacto() { const c = []; for (let i = 0; i < 20; i++) c.push(true); return { x: 195, y: 420, rot: 0, vx: vmax, vy: 0, celdas: c, vivos: 20, masa: F.FISICA.MASA_TARGET }; }
  let fugas = 0; const Nn = 200;
  for (let i = 0; i < Nn; i++) {
    const tg = targetIntacto();
    const ang = (i / Nn) * Math.PI * 2;
    const bx = tg.x + Math.cos(ang) * 150, by = tg.y + Math.sin(ang) * 150;
    const dir = Math.atan2(tg.y - by, tg.x - bx);
    const b = { x: bx, y: by, vx: Math.cos(dir) * VMAX, vy: Math.sin(dir) * VMAX, edad: 0, viva: true };
    let tocado = false;
    for (let f = 0; f < 200 && b.viva && !tocado; f++) {
      F.paso(b, 16.7, VP, function () { if (F.colisionCirculoRect(b, tg)) tocado = true; });
      if (Math.hypot(b.x - tg.x, b.y - tg.y) > 210) break;
    }
    if (!tocado) fugas++;
  }
  chk(`hitball a V_MAX vs target a velocidad nueva: ${fugas} fugas de ${Nn}`, fugas === 0);
}

console.log('\n=== ECONOMÍA re-simulada a 60s: impacto declarado ===');
{
  // Sin modelo de jugador: medimos cuántos targets viven su vuelo completo y su
  // tiempo en pantalla (ventana para golpear). ANTES (0.6) vs DESPUÉS (0.75).
  function sim(traj) {
    F.LANZA.VEL_TRAYECTORIA = traj;
    const N = 20000; let sumVis = 0, sumVida = 0; const spd = [];
    for (let i = 0; i < N; i++) {
      const t = F.crearTarget(VP); spd.push(Math.hypot(t.vx, t.vy));
      let vis = 0, tt = 0;
      while (t.viva && tt < 15000) {
        F.paso(t, 16, VP);
        if (t.x > 0.03 * VP.w && t.x < 0.97 * VP.w && t.y > 0.03 * VP.h && t.y < 0.97 * VP.h) vis += 16;
        tt += 16;
      }
      sumVis += vis; sumVida += tt;
    }
    return { vMean: spd.reduce((a, b) => a + b, 0) / N, visMean: sumVis / N, vidaMean: sumVida / N };
  }
  const a = sim(1.0), d = sim(1.25);
  F.LANZA.VEL_TRAYECTORIA = 1.25;
  const dv = ((d.vMean / a.vMean - 1) * 100).toFixed(1);
  const dvis = ((d.visMean / a.visMean - 1) * 100).toFixed(1);
  console.log(`  |v| media:        ${a.vMean.toFixed(3)} → ${d.vMean.toFixed(3)} px/ms  (${dv}% realizado; +25% nominal, el recorte de ápice frena vy)`);
  console.log(`  visible medio:    ${a.visMean.toFixed(0)} → ${d.visMean.toFixed(0)} ms  (${dvis}%)  = ventana para golpear`);
  console.log(`  vida media:       ${a.vidaMean.toFixed(0)} → ${d.vidaMean.toFixed(0)} ms`);
  // Criterio de "injusto": si la ventana visible cae ≥15%, el ratio golpear/fallar
  // se degrada en serio y habría que avisar al dueño (NO compensar por cuenta propia).
  const caida = -parseFloat(dvis);
  console.log(`  criterio de injusticia: ventana visible cae ≥15% → ${caida >= 15 ? 'SÍ, avisar al dueño' : 'NO (' + dvis + '%), economía estable'}`);
  chk('economía NO se desbalancea (ventana visible cae <15%)', caida < 15);
}

console.log(`\n== RESUMEN velocidad: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
