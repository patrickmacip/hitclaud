// hitclaud — test de daño parcial: node test/dano.test.js

const F = require('../js/fisica.js');

function target() {
  const celdas = [];
  for (let i = 0; i < 20; i++) celdas.push(true);
  return {
    x: 200, y: 400, rot: 0, vx: 0, vy: 0,
    celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET, golpeado: false,
  };
}
function bola(x, y, vx, vy) { return { x: x, y: y, vx: vx, vy: vy, edad: 0, viva: true }; }
function caja(t) {
  const c = F.cajaLocal(t);
  return c ? `${(c.hw * 2).toFixed(0)}×${(c.hh * 2).toFixed(0)}` : '—';
}

console.log(`Umbral destrucción=${F.FISICA.UMBRAL_DESTRUCCION} px/ms.`);
console.log(`Mapeo daño: CUALQUIER contacto → ≥1 cubo (mínimo→1, justo bajo umbral→${F.FISICA.DANO_CUBOS_MAX}).`);

// La bola entra por la cara izquierda (x local = -20 → mundo 180 con rot 0).
function golpe(t, v) {
  const cx = F.cajaLocal(t);
  const caraX = t.x + cx.cx - cx.hw; // borde izquierdo de la caja viva
  const b = bola(caraX - 14 + 12, 400, v, 0);
  return F.resolverImpacto(b, t);
}

console.log('\n(a) Golpe SUAVE (v=0.6) → arranca cubos, vive mordido, caja más chica');
{
  const t = target();
  console.log(`  antes: vivos=${t.vivos} caja=${caja(t)} masa=${t.masa.toFixed(2)}`);
  const r = golpe(t, 0.6);
  console.log(`  tipo=${r.tipo} arrancados=${r.destruidos} muerto=${r.muerto}`);
  console.log(`  después: vivos=${t.vivos} caja=${caja(t)} masa=${t.masa.toFixed(2)}`);
}

console.log('\n(b) Tres golpes SUAVES seguidos → desmoronamiento');
{
  const t = target();
  for (let i = 1; i <= 3; i++) {
    const r = golpe(t, 0.75);
    console.log(`  golpe ${i}: arrancados=${r.destruidos} vivos=${t.vivos} caja=${caja(t)} muerto=${r.muerto}`);
    if (r.muerto) break;
  }
}

console.log('\n(c) Golpe FUERTE (v=1.2) → destrucción total');
{
  const t = target();
  const r = golpe(t, 1.2);
  console.log(`  tipo=${r.tipo} destruidos=${r.destruidos} vivos=${t.vivos} muerto=${r.muerto}`);
}

console.log('\n(d) Toque MÍNIMO (v=0.2) → arranca 1 cubo (nunca "solo empuje"), y empuja');
{
  const t = target();
  const r = golpe(t, 0.2);
  console.log(`  tipo=${r.tipo} arrancados=${r.destruidos} vivos=${t.vivos} target.vx=${t.vx.toFixed(3)} (empujado)`);
  console.log(`  ≥1 cubo (el mínimo nunca es fallo): ${r.destruidos >= 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(e) NO exploit: demoler a roces mínimos (~1 cubo/roce) vs un tiro fuerte');
{
  const t = target();
  let golpes = 0, total = 0;
  while (t.vivos > 0 && golpes < 60) { const r = golpe(t, 0.05); golpes++; total += r.destruidos; if (r.muerto) break; }
  console.log(`  ${golpes} roces para demoler (${total} cubos = ${total * 10} pts) vs 1 tiro fuerte (1 disparo, 200 pts)`);
  console.log(`  mismos ~200 pts pero ${golpes} disparos (${(200 / golpes).toFixed(0)} pts/disparo vs 200) → sano: ${golpes >= 10 && total <= 200 ? 'OK ✓' : 'revisar'}`);
}
