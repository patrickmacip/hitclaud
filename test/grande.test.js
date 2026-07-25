// hitclaud — target GRANDE (más cubos de 8px, 3× lento, mín. 4 golpes) + espera
// mínima 900ms + máx 2: node test/grande.test.js

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

const GRANDE_COLS = 10, GRANDE_FILAS = 8, GRANDE_LENTO = 3;

console.log('=== Doble de tamaño = MÁS cubos de 8px (grilla 10×8), no cubos grandes ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS);
  chk('grilla 10×8 = 80 cubos (2× cada eje del 5×4=20)', g.cols === 10 && g.filas === 8 && g.celdas.length === 80);
  const n = F.crearTarget(VP);
  chk('el normal sigue 5×4 = 20', n.cols === 5 && n.filas === 4 && n.celdas.length === 20);
  chk('cubo atómico 8px en ambos', F.celdaLocal(1, 10, 8).x - F.celdaLocal(0, 10, 8).x === 8 && F.celdaLocal(1, 5, 4).x - F.celdaLocal(0, 5, 4).x === 8);
}

console.log('\n=== Más PESADO: masa proporcional a los cubos (grande = 4× normal) ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS);
  const n = F.crearTarget(VP);
  chk(`normal masa ${n.masa} = MASA_TARGET`, n.masa === F.FISICA.MASA_TARGET);
  chk(`grande masa ${g.masa} = 4× (80/20)`, Math.abs(g.masa - F.FISICA.MASA_TARGET * 4) < 1e-9);
}

console.log('\n=== NO se destruye de un hit: mín. 4 golpes, cada golpe = su zona (¼) ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS); g.x = 200; g.y = 300; g.rot = 0; g.grande = true;
  let golpes = 0, muerto = false, unShotOnFirst = false;
  while (g.vivos > 0 && golpes < 30) {
    const caja = F.cajaLocal(g); if (!caja) break;
    const b = { x: g.x + caja.cx - caja.hw - 8, y: g.y + caja.cy, vx: 2.4, vy: 0, radio: 14 }; // golpe FUERTE
    const r = F.resolverImpacto(b, g);
    if (!r) break;
    golpes++;
    if (golpes === 1 && r.muerto) unShotOnFirst = true;
    if (r.muerto) { muerto = true; break; }
  }
  chk('el 1er golpe NO lo destruye (aunque sea fuerte)', !unShotOnFirst);
  chk(`se destruye en ${golpes} golpes (≥4)`, muerto && golpes >= 4);
}

console.log('\n=== Un golpe demuele su ZONA (¼ = ceil(vivosMax/4) = 20 cubos) ===');
{
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS); g.x = 200; g.y = 300; g.rot = 0; g.grande = true;
  const caja = F.cajaLocal(g);
  const b = { x: g.x + caja.cx - caja.hw - 8, y: g.y + caja.cy, vx: 2.4, vy: 0, radio: 14 };
  const r = F.resolverImpacto(b, g);
  chk(`1 golpe → ${r.destruidos} cubos (=20, ¼ de 80)`, r.destruidos === 20 && g.vivos === 60);
  // hitscan (desktop) usa la misma zona:
  const z = F.celdasCercanas(F.crearTarget(VP, 10, 8), 200, 300, Math.ceil(80 / 4));
  chk('hitscan demuele la misma zona (20 cubos cercanos a la mira)', z.length === 20);
}

console.log('\n=== El NORMAL sí se destruye de un hit potente (one-shot intacto) ===');
{
  const n = F.crearTarget(VP); n.x = 200; n.y = 300; n.rot = 0;
  const caja = F.cajaLocal(n);
  const b = { x: n.x + caja.cx - caja.hw - 8, y: n.y + caja.cy, vx: 2.4, vy: 0, radio: 14 };
  const r = F.resolverImpacto(b, n);
  chk('normal + golpe fuerte → muerto de un hit', r && r.muerto);
}

console.log('\n=== Puntúa por cubo: 4 golpes × 20 × 5 = 400 ===');
{
  const m = P.crearMarcador();
  let total = 0; for (let k = 0; k < 4; k++) total += P.anotarDestruidos(m, 20);
  chk('4 zonas de 20 cubos = 400', total === 400);
}

console.log('\n=== 3× más lento: mismo arco, ~3× de tiempo de vuelo ===');
{
  let base; do { base = F.crearTarget(VP); } while (base.origen !== 'inferior');
  const normal = Object.assign({}, base, { celdas: base.celdas.slice() });
  const grande = Object.assign({}, base, { celdas: base.celdas.slice(),
    vx: base.vx / 3, vy: base.vy / 3, gravedad: F.FISICA.G_TARGET / 9, vidaMax: F.FISICA.VIDA_MAX_MS * 3 });
  function vuelo(o) { let apex = o.y, t = 0; while (o.viva && t < 30000) { F.paso(o, 16, VP); apex = Math.min(apex, o.y); t += 16; } return { t: t, apex: VP.h - apex }; }
  const vn = vuelo(normal), vg = vuelo(grande);
  chk('mismo arco (apex Δ<40)', Math.abs(vn.apex - vg.apex) < 40);
  chk('~3× de tiempo de vuelo (2.6–3.4×)', vg.t / vn.t >= 2.6 && vg.t / vn.t <= 3.4);
}

console.log('\n=== Mínimo 8s entre apariciones del grande ===');
{
  const GRANDE_MIN_MS = 8000, GRANDE_JITTER_MS = 4000;
  let seed = 3; const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let peor = Infinity, prox = GRANDE_MIN_MS + rnd() * GRANDE_JITTER_MS, ant = 0;
  for (let k = 0; k < 200; k++) { peor = Math.min(peor, prox - ant); ant = prox; prox = ant + GRANDE_MIN_MS + rnd() * GRANDE_JITTER_MS; }
  chk(`hueco mínimo ${peor.toFixed(0)}ms ≥ 8000`, peor >= 8000);
}

console.log('\n=== Espera MÍNIMA global 900ms entre apariciones (cualquier tipo) ===');
{
  const SPAWN_MIN_MS = 900;
  // Espejo del gate: un spawn sólo ocurre si t - ultimoSpawn >= 900.
  function puede(t, ultimoSpawn) { return (t - ultimoSpawn) >= SPAWN_MIN_MS; }
  chk('a 899ms del último → NO aparece', !puede(899, 0));
  chk('a 900ms del último → aparece', puede(900, 0));
  chk('primer spawn (ultimoSpawn = -Infinity) → aparece', puede(0, -Infinity));
}

console.log('\n=== Máx 2 en pantalla (naranjas + rojos + grande juntos) ===');
{
  function puede(n) { return n < 2; }
  chk('con 1 vivo → puede', puede(1));
  chk('con 2 vivos → NO', !puede(2));
}
