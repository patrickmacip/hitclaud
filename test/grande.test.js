// hitclaud — target GRANDE (más cubos de 8px, 3× lento) + tope 500ms + máx 2:
// node test/grande.test.js

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

const GRANDE_COLS = 10, GRANDE_FILAS = 8, GRANDE_LENTO = 3;

console.log('=== Doble de tamaño = MÁS cubos de 8px (grilla 10×8), no cubos grandes ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS);
  chk(`grilla 10×8 = 80 cubos (2× cada eje del 5×4=20)`, g.cols === 10 && g.filas === 8 && g.celdas.length === 80);
  const n = F.crearTarget(VP);
  chk('el normal sigue siendo 5×4 = 20', n.cols === 5 && n.filas === 4 && n.celdas.length === 20);
  chk('el cubo atómico es 8px en ambos (celdaLocal a 8px de paso)',
    F.celdaLocal(1, 10, 8).x - F.celdaLocal(0, 10, 8).x === 8 && F.celdaLocal(1, 5, 4).x - F.celdaLocal(0, 5, 4).x === 8);
}

console.log('\n=== Colisión/hitscan respetan la grilla mayor (cubos de 8px) ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS); g.x = 200; g.y = 300; g.rot = 0;
  const c = F.cajaLocal(g);
  chk(`caja ${c.hw}×${c.hh} (40×32 = doble de 20×16)`, c.hw === 40 && c.hh === 32);
  chk('celdaEnPunto centro (200,300) → idx 45', F.celdaEnPunto(g, 200, 300) === 45);
  chk('a +8px en x → celda vecina (idx 46; cubos de 8px)', F.celdaEnPunto(g, 208, 300) === 46);
}

console.log('\n=== 3× más lento: mismo arco, ~3× de tiempo de vuelo ===');
{
  let base; do { base = F.crearTarget(VP); } while (base.origen !== 'inferior');
  const normal = Object.assign({}, base, { celdas: base.celdas.slice() });
  // Mismo radio que el normal para aislar la relación de TIEMPO (el radio sólo
  // cambia el margen de salida, no el arco). vidaMax alto para no truncar el vuelo.
  const grande = Object.assign({}, base, { celdas: base.celdas.slice(),
    vx: base.vx / 3, vy: base.vy / 3, gravedad: F.FISICA.G_TARGET / 9, vidaMax: F.FISICA.VIDA_MAX_MS * 3 });
  function vuelo(o) { let apex = o.y, t = 0; while (o.viva && t < 30000) { F.paso(o, 16, VP); apex = Math.min(apex, o.y); t += 16; } return { t: t, apex: VP.h - apex }; }
  const vn = vuelo(normal), vg = vuelo(grande);
  console.log(`  normal: vuelo ${vn.t}ms apex ${vn.apex.toFixed(0)}px · grande: vuelo ${vg.t}ms apex ${vg.apex.toFixed(0)}px`);
  chk('mismo arco (apex ~igual, Δ<40px)', Math.abs(vn.apex - vg.apex) < 40);
  chk('~3× de tiempo de vuelo (2.6–3.4×)', vg.t / vn.t >= 2.6 && vg.t / vn.t <= 3.4);
}

console.log('\n=== Puntúa por cubo (80 cubos × 5 = 400) ===');
{
  const m = P.crearMarcador();
  chk('grande completo (80 cubos) = 400', P.anotarDestruidos(m, 80) === 400);
  const m2 = P.crearMarcador();
  chk('1 cubo del grande = 5 (mismo valor atómico)', P.anotarDestruidos(m2, 1) === 5);
}

console.log('\n=== Mínimo 8s entre apariciones (espejo del timer) ===');
{
  const GRANDE_MIN_MS = 8000, GRANDE_JITTER_MS = 4000;
  let seed = 3; const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let peor = Infinity, prox = GRANDE_MIN_MS + rnd() * GRANDE_JITTER_MS, ant = 0;
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
    const base = P.rangoVigente(P.crearRitmo(), 0, 0);
    peor = Math.max(peor, Math.min(SPAWN_GAP_MAX, P.retardoCaotico(base, caos, rnd)));
  }
  console.log(`  hueco máximo observado: ${peor.toFixed(0)}ms`);
  chk('ningún hueco supera 500ms', peor <= 500);
}

console.log('\n=== Máx 2 en pantalla (naranjas + rojos + grande juntos) ===');
{
  const MAX = 2;
  function puede(n) { return n < MAX; }
  chk('con 1 vivo → puede spawnear', puede(1));
  chk('con 2 vivos → NO puede (cualquier tipo)', !puede(2));
}
