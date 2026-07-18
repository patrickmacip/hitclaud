// hitclaud — test de la Bonanza y la fiesta: node test/bonanza.test.js
// Replica el spawner de main.js (bonanza + fiesta + enojado).

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

const MAX_DURO = 12, FIESTA_MAX = 16, FIESTA_MS = 5000;
const BONANZA_PROB = 0.03;
const ENOJADO_BASE = 0.08, ENOJADO_EXTRA = 0.02, ENOJADO_TOPE = 0.25;

function rnd(a, b) { return a + Math.random() * (b - a); }

// Spawner-mirror con estado explícito (para poder inspeccionarlo).
function crearMundo() {
  return { targets: [], ultimoOrigen: null, ultimoEnojado: false, ultimaBonanza: false, fiestaHasta: 0 };
}
function generar(m, now) {
  let t;
  for (let i = 0; i < 12; i++) { t = F.crearTarget(VP); if (t.origen !== m.ultimoOrigen) break; }
  m.ultimoOrigen = t.origen;
  const enFiesta = now < m.fiestaHasta;
  const hayBonanza = m.targets.some(function (x) { return x.bonanza; });
  if (!enFiesta && !hayBonanza && !m.ultimaBonanza && Math.random() < BONANZA_PROB) {
    t.bonanza = true; t.enojado = false; m.ultimaBonanza = true; m.ultimoEnojado = false;
  } else {
    m.ultimaBonanza = false;
    const prob = Math.min(ENOJADO_TOPE, ENOJADO_BASE + ENOJADO_EXTRA * Math.max(0, m.targets.length - 3));
    t.enojado = !enFiesta && !m.ultimoEnojado && Math.random() < prob;
    m.ultimoEnojado = t.enojado;
  }
  m.targets.push(t);
  return t;
}

// ── (1) Probabilidad + nunca dos seguidas + nunca durante fiesta ───
console.log('=== Probabilidad de Bonanza (200 spawns permitidos) ===');
{
  // Aislar la probabilidad: sin bonanzas vivas (se retiran) y sin fiesta.
  let bon = 0, dosSeguidas = 0, prev = false, enFiestaBon = 0;
  const m = crearMundo();
  for (let i = 0; i < 200; i++) {
    const t = generar(m, 0);
    if (t.bonanza) { bon++; if (prev) dosSeguidas++; }
    prev = t.bonanza;
    // retirar la bonanza para permitir otra en el próximo spawn
    if (t.bonanza) m.targets.pop();
  }
  console.log(`  bonanzas: ${bon}/200 = ${(bon / 200 * 100).toFixed(1)}% (nominal 3%)`);
  console.log(`  dos seguidas: ${dosSeguidas}  ${dosSeguidas === 0 ? 'OK ✓' : 'NO ✗'}`);
  // nunca si ya hay una viva:
  const m2 = crearMundo();
  m2.targets.push({ bonanza: true, celdas: [], origen: 'inferior' });
  let salioConViva = 0;
  for (let i = 0; i < 500; i++) { const t = generar(m2, 0); if (t.bonanza) salioConViva++; m2.targets = m2.targets.filter(function (x) { return x.bonanza; }); }
  console.log(`  con una bonanza ya viva, otra en 500 intentos: ${salioConViva}  ${salioConViva === 0 ? 'OK ✓' : 'NO ✗'}`);
  // nunca durante fiesta:
  const m3 = crearMundo(); m3.fiestaHasta = 999999;
  let enFiesta = 0;
  for (let i = 0; i < 500; i++) { const t = generar(m3, 0); if (t.bonanza) enFiesta++; m3.targets = []; }
  console.log(`  durante fiesta, bonanzas en 500: ${enFiesta}  ${enFiesta === 0 ? 'OK ✓' : 'NO ✗'}`);
}

// ── (2) Activación → tope 16 y ráfaga por 5s → regreso ─────────────
console.log('\n=== Fiesta: tope 16 y ráfaga 5s → regreso a normal ===');
{
  const m = crearMundo();
  const now = 100000;
  m.fiestaHasta = now + FIESTA_MS; // activada por contacto
  const capDurante = now + 2000 < m.fiestaHasta ? FIESTA_MAX : MAX_DURO;
  const capDespues = now + 6000 < m.fiestaHasta ? FIESTA_MAX : MAX_DURO;
  console.log(`  cap durante (t+2s): ${capDurante}  cap después (t+6s): ${capDespues}  ${capDurante === 16 && capDespues === 12 ? 'OK ✓' : 'NO ✗'}`);
}

// ── (3) Enojados = 0 durante la fiesta ─────────────────────────────
console.log('\n=== Enojados durante la fiesta = 0 ===');
{
  const m = crearMundo(); m.fiestaHasta = 999999;
  let eno = 0;
  for (let i = 0; i < 500; i++) { const t = generar(m, 0); if (t.enojado) eno++; if (m.targets.length > 10) m.targets = []; }
  console.log(`  enojados en 500 spawns de fiesta: ${eno}  ${eno === 0 ? 'OK ✓' : 'NO ✗'}`);
}

// ── (4) Targets sobrantes tras la fiesta mueren por su vuelo ───────
console.log('\n=== Tras la fiesta, los 16 sobrantes mueren solos (no se borran) ===');
{
  const targets = [];
  for (let i = 0; i < 16; i++) targets.push(F.crearTarget(VP));
  let t = 0; const DT = 1000 / 60; let maxVistos = targets.length;
  while (targets.length > 0 && t < 8000) {
    for (let i = targets.length - 1; i >= 0; i--) { F.paso(targets[i], DT, VP); if (!targets[i].viva) targets.splice(i, 1); }
    t += DT;
  }
  console.log(`  16 targets sin respawn: quedan ${targets.length} tras ${(t / 1000).toFixed(1)}s  ${targets.length === 0 ? 'OK ✓ (mueren por vuelo natural)' : 'NO ✗'}`);
}

// ── (5) Válvula de rendimiento: peor caso (16 targets + 24 bolitas) ─
console.log('\n=== Rendimiento: 16 targets + 24 bolitas + colisión ===');
{
  const targets = [];
  for (let i = 0; i < 16; i++) { const t = F.crearTarget(VP); t.x = 100 + (i % 4) * 60; t.y = 200 + ((i / 4) | 0) * 100; t.vx = 0; t.vy = 0; targets.push(t); }
  const bolas = [];
  for (let i = 0; i < 24; i++) bolas.push({ x: rnd(0, VP.w), y: rnd(0, VP.h), vx: rnd(-2, 2), vy: rnd(-2, 2), edad: 0, viva: true, radio: 14, historia: [] });
  const FRAMES = 600; // 10s a 60fps
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < FRAMES; f++) {
    for (let i = 0; i < targets.length; i++) F.paso(targets[i], 16.7, VP);
    for (let bi = 0; bi < bolas.length; bi++) {
      const b = bolas[bi];
      if (!b.viva) { b.x = rnd(0, VP.w); b.y = rnd(0, VP.h); b.vx = rnd(-2, 2); b.vy = rnd(-2, 2); b.viva = true; }
      F.paso(b, 16.7, VP, function () {
        for (let ti = 0; ti < targets.length; ti++) F.resolverImpacto(b, targets[ti]);
      });
    }
    // reponer targets destruidos para mantener 16
    for (let ti = 0; ti < targets.length; ti++) if (targets[ti].vivos === 0) { const t = F.crearTarget(VP); t.x = targets[ti].x; t.y = 250; targets[ti] = t; }
  }
  const t1 = process.hrtime.bigint();
  const msPorCuadro = Number(t1 - t0) / 1e6 / FRAMES;
  console.log(`  ${msPorCuadro.toFixed(3)} ms/cuadro (presupuesto 16.67ms para 60fps)`);
  console.log(`  → ${msPorCuadro < 16.67 ? 'SOSTIENE 60fps ✓ (tope 16 aguanta como diseño)' : 'NO llega: proponer tope técnico menor ✗'}`);
}
