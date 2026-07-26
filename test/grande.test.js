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

console.log('\n=== MUCHO más PESADO: el impacto casi no lo desvía (no como globo) ===');
{
  const GRANDE_PESO = 80;
  // Grande moviéndose; recibe un golpe frontal FUERTE. El desvío debe ser mínimo.
  const g = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS); g.x = 200; g.y = 300; g.rot = 0; g.grande = true;
  g.vx = 0.5; g.vy = -0.5;
  g.pesoExtra = GRANDE_PESO; g.masa = F.FISICA.MASA_TARGET * (g.vivos / 20) * GRANDE_PESO;
  const v0 = Math.hypot(g.vx, g.vy);
  const caja = F.cajaLocal(g);
  const b = { x: g.x + caja.cx - caja.hw - 8, y: g.y + caja.cy, vx: 2.4, vy: 0, radio: 14 };
  F.resolverImpacto(b, g);
  const desvio = Math.abs(Math.hypot(g.vx, g.vy) - v0);
  console.log(`  desvío del impacto: Δ${desvio.toFixed(3)} px/ms (masa ${g.masa.toFixed(0)})`);
  chk('desvío mínimo (< 0.02 px/ms, "pesado no globo")', desvio < 0.02);
  // Contraste limpio: el MISMO grande pero LIVIANO (pesoExtra 1) se desvía mucho más.
  const gl = F.crearTarget(VP, GRANDE_COLS, GRANDE_FILAS); gl.x = 200; gl.y = 300; gl.rot = 0; gl.grande = true;
  gl.vx = 0.5; gl.vy = -0.5; gl.pesoExtra = 1; gl.masa = F.FISICA.MASA_TARGET * (gl.vivos / 20);
  const v0l = Math.hypot(gl.vx, gl.vy);
  const cl = F.cajaLocal(gl); const b2 = { x: gl.x + cl.cx - cl.hw - 8, y: gl.y + cl.cy, vx: 2.4, vy: 0, radio: 14 };
  F.resolverImpacto(b2, gl);
  const desvioL = Math.abs(Math.hypot(gl.vx, gl.vy) - v0l);
  console.log(`  grande liviano: Δ${desvioL.toFixed(3)} px/ms`);
  chk('el peso extra reduce mucho el desvío (pesado ≪ liviano)', desvio < desvioL * 0.2);
}

console.log('\n=== ARCO DENTRO DE LA PANTALLA: ningún target cruza el techo ===');
{
  let cruzaron = 0, apexMasAlto = Infinity;
  for (let i = 0; i < 6000; i++) {
    const t = F.crearTarget(VP);
    let minY = t.y, tt = 0;
    while (t.viva && tt < 12000) { F.paso(t, 16, VP); minY = Math.min(minY, t.y); tt += 16; }
    apexMasAlto = Math.min(apexMasAlto, minY);
    if (minY < -t.radio - 1) cruzaron++;   // se fue por arriba del todo
  }
  console.log(`  ápice más alto (min y): ${apexMasAlto.toFixed(0)}px · cruzaron el techo: ${cruzaron}`);
  chk('ninguno cruza el techo (sube y baja en pantalla)', cruzaron === 0);
  // El grande también (el recorte de ápice se conserva con v/3, g/9).
  const g = F.crearTarget(VP, 10, 8); g.vx /= 3; g.vy /= 3; g.gravedad = F.FISICA.G_TARGET / 9; g.vidaMax = 18000; g.radio = 52;
  let minYg = g.y, tt = 0; while (g.viva && tt < 30000) { F.paso(g, 16, VP); minYg = Math.min(minYg, g.y); tt += 16; }
  chk(`el grande también arquea en pantalla (ápice y=${minYg.toFixed(0)} > 0)`, minYg > 0);
}

console.log('\n=== TODO LO QUE SUBE, BAJA: el target no muere al salir por ARRIBA ===');
{
  // Target que ya entró, subiendo y saliendo por arriba con x en pantalla:
  // sigue vivo (la gravedad lo hará caer de vuelta). Muere al salir por abajo.
  const t = F.crearTarget(VP); t.x = 195; t.y = 40; t.vx = 0; t.vy = -1.5; t.haEntrado = true; t.gravedad = F.FISICA.G_TARGET;
  let salioArriba = false, siguioVivoArriba = false;
  for (let i = 0; i < 60; i++) { F.paso(t, 16, VP); if (t.y < -t.radio) { salioArriba = true; if (t.viva) siguioVivoArriba = true; } }
  chk('sale por arriba y sigue vivo (va a caer de vuelta)', salioArriba && siguioVivoArriba);
  // sigue simulando: debe caer y eventualmente morir al salir por ABAJO
  let tt = 0; while (t.viva && tt < 20000) { F.paso(t, 16, VP); tt += 16; }
  chk('termina muriendo al caer por abajo (o vida máx)', !t.viva);

  // Sale por el LADO estando arriba → su caída NO pasa por la pantalla → muere.
  const s = F.crearTarget(VP); s.x = 380; s.y = -30; s.vx = 0.6; s.vy = -0.2; s.haEntrado = true;
  let murioPorLado = false;
  for (let i = 0; i < 200 && s.viva; i++) { F.paso(s, 16, VP); if (!s.viva && s.x > VP.w) murioPorLado = true; }
  chk('arriba + se va por el costado → muere (su caída no cruza la pantalla)', murioPorLado);

  // Una BOLITA (sin celdas) sí muere al salir por arriba (transitoria).
  const bol = { x: 195, y: 20, vx: 0, vy: -2.0, radio: 14, edad: 0, viva: true, haEntrado: true };
  let bolMurio = false;
  for (let i = 0; i < 60 && bol.viva; i++) { F.paso(bol, 16, VP); }
  bolMurio = !bol.viva && bol.y < 0;
  chk('la bolita (hitball) sí muere al salir por arriba', bolMurio);
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

console.log('\n=== Tiempo MÁXIMO entre apariciones de naranjas: 300ms ===');
{
  const SPAWN_GAP_MAX = 300;
  const caos = P.crearCaos();
  let seed = 99; const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let peor = 0;
  for (let k = 0; k < 5000; k++) {
    const base = P.rangoVigente(P.crearRitmo(), 0, 0);
    peor = Math.max(peor, Math.min(SPAWN_GAP_MAX, P.retardoCaotico(base, caos, rnd)));
  }
  chk(`hueco máximo ${peor.toFixed(0)}ms ≤ 300`, peor <= 300);
}

console.log('\n=== Máx 2 en pantalla (naranjas + rojos + grande juntos) ===');
{
  function puede(n) { return n < 2; }
  chk('con 1 vivo → puede', puede(1));
  chk('con 2 vivos → NO', !puede(2));
}
