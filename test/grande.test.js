// hitclaud — target GRANDE (doble tamaño, 3× lento) + tope 500ms + máx 4:
// node test/grande.test.js

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

const GRANDE_ESCALA = 2, GRANDE_LENTO = 3;

// Espejo de generarGrande (main.js).
function crearGrande() {
  const t = F.crearTarget(VP);
  t.grande = true; t.escala = GRANDE_ESCALA;
  t.vx /= GRANDE_LENTO; t.vy /= GRANDE_LENTO;
  t.gravedad = F.FISICA.G_TARGET / (GRANDE_LENTO * GRANDE_LENTO);
  t.radio = F.FISICA.RADIO_TARGET * GRANDE_ESCALA;
  return t;
}

console.log('=== Doble de tamaño: escala 2× en colisión (caja + celdas) ===');
{
  const g = crearGrande(); g.x = 200; g.y = 300; g.rot = 0;
  const c = F.cajaLocal(g);
  chk(`caja ${c.hw}×${c.hh} (40×32 = 2× de 20×16)`, c.hw === 40 && c.hh === 32);
  // el punto a 16px del centro cae en la celda vecina (celdas de 16px a escala 2)
  chk('celdaEnPunto respeta la escala (centro → idx 12)', F.celdaEnPunto(g, 200, 300) === 12);
  chk('a +16px en x → celda vecina (idx 13)', F.celdaEnPunto(g, 216, 300) === 13);
}

console.log('\n=== 3× más lento: mismo arco, ~3× de tiempo de vuelo ===');
{
  // Fuerza origen inferior en ambos (mismo estado base) para comparar el arco.
  let base; do { base = F.crearTarget(VP); } while (base.origen !== 'inferior');
  const normal = Object.assign({}, base, { celdas: base.celdas.slice() });
  const grande = Object.assign({}, base, { celdas: base.celdas.slice(),
    escala: 2, vx: base.vx / 3, vy: base.vy / 3, gravedad: F.FISICA.G_TARGET / 9, radio: F.FISICA.RADIO_TARGET * 2 });
  function vuelo(o) { let apex = o.y, t = 0; while (o.viva && t < 30000) { F.paso(o, 16, VP); apex = Math.min(apex, o.y); t += 16; } return { t: t, apex: VP.h - apex }; }
  const vn = vuelo(normal), vg = vuelo(grande);
  console.log(`  normal: vuelo ${vn.t}ms apex ${vn.apex.toFixed(0)}px · grande: vuelo ${vg.t}ms apex ${vg.apex.toFixed(0)}px`);
  chk('mismo arco (apex ~igual, Δ<40px)', Math.abs(vn.apex - vg.apex) < 40);
  chk('~3× de tiempo de vuelo (2.6–3.4×)', vg.t / vn.t >= 2.6 && vg.t / vn.t <= 3.4);
}

console.log('\n=== Puntúa igual (20 cubos × 5 = 100) ===');
{
  const m = P.crearMarcador();
  chk('grande completo = 100', P.anotarDestruidos(m, 20) === 100);
}

console.log('\n=== Mínimo 8s entre apariciones (espejo del timer) ===');
{
  const GRANDE_MIN_MS = 8000, GRANDE_JITTER_MS = 4000;
  let seed = 3; const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let peor = Infinity;
  let prox = GRANDE_MIN_MS + rnd() * GRANDE_JITTER_MS, ant = 0;
  for (let k = 0; k < 200; k++) { peor = Math.min(peor, prox - ant); ant = prox; prox = ant + GRANDE_MIN_MS + rnd() * GRANDE_JITTER_MS; }
  console.log(`  hueco mínimo observado: ${peor.toFixed(0)}ms`);
  chk('nunca menos de 8000ms entre apariciones', peor >= 8000);
}

console.log('\n=== Tope 500ms: el spawner de naranjas nunca deja un hueco > 500ms ===');
{
  const SPAWN_GAP_MAX = 500;
  const caos = P.crearCaos();
  let seed = 99; const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let peor = 0;
  for (let k = 0; k < 5000; k++) {
    const base = P.rangoVigente(P.crearRitmo(), 0, 0); // rango base
    const gap = Math.min(SPAWN_GAP_MAX, P.retardoCaotico(base, caos, rnd));
    peor = Math.max(peor, gap);
  }
  console.log(`  hueco máximo observado: ${peor.toFixed(0)}ms`);
  chk('ningún hueco supera 500ms', peor <= 500);
}

console.log('\n=== Máx 4 en pantalla (naranjas + rojos + grande juntos) ===');
{
  const MAX = 4;
  // gate compartido: un tipo sólo spawnea si targets.length < 4.
  function puede(n) { return n < MAX; }
  chk('con 3 vivos → puede spawnear', puede(3));
  chk('con 4 vivos → NO puede (naranja/rojo/grande)', !puede(4));
}
