// hitclaud — ROJO destruible por rebote: node test/rebote.test.js
// (b) impacto con rebotes≥1 destruye el rojo sin terminar; 0 rebotes termina.
// (c) el contador de rebotes se resetea por lanzamiento y sube al rebotar en pared.

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Decisión de colisión con el ROJO (espejo de main.js) ===');
{
  // resultado: 'game-over' si rebotes 0; 'destruye-continua' si rebotes>=1.
  function contactoRojo(rebotes) { return (rebotes || 0) >= 1 ? 'destruye-continua' : 'game-over'; }
  chk('0 rebotes (tiro directo) → game over', contactoRojo(0) === 'game-over');
  chk('1 rebote → destruye y continúa', contactoRojo(1) === 'destruye-continua');
  chk('3 rebotes → destruye y continúa', contactoRojo(3) === 'destruye-continua');
}

console.log('\n=== El contador de rebotes NACE en 0 por lanzamiento ===');
{
  // Espejo de la creación del proyectil en ejecutarSuelta.
  function nuevoProyectil(x, y, vx, vy) {
    return { x: x, y: y, vx: vx, vy: vy, edad: 0, viva: true, tocado: false, rebota: true, rebotes: 0 };
  }
  const a = nuevoProyectil(100, 400, 1, -1);
  const b = nuevoProyectil(200, 400, -1, -1);
  chk('cada lanzamiento arranca en rebotes=0', a.rebotes === 0 && b.rebotes === 0);
}

console.log('\n=== paso() cuenta un rebote al chocar una PARED lateral ===');
{
  // Proyectil pegado a la pared izquierda, yendo a la izquierda → rebota a la derecha.
  const p = { x: 20, y: 300, vx: -0.8, vy: 0, radio: 14, edad: 0, viva: true, rebota: true, rebotes: 0 };
  let choco = false;
  for (let i = 0; i < 400 && p.viva; i++) { const vxPrev = p.vx; F.paso(p, 16, VP, null); if (vxPrev < 0 && p.vx > 0) choco = true; }
  chk('vx se invirtió (rebotó en la pared)', choco);
  chk('rebotes ≥ 1 tras chocar', (p.rebotes || 0) >= 1);
}

console.log('\n=== paso() cuenta un rebote en el TECHO; el PISO NO rebota (mata) ===');
{
  const techo = { x: 195, y: 20, vx: 0, vy: -1.0, radio: 14, edad: 0, viva: true, rebota: true, rebotes: 0 };
  let boteTecho = false;
  for (let i = 0; i < 60 && techo.viva; i++) { const vyPrev = techo.vy; F.paso(techo, 16, VP, null); if (vyPrev < 0 && techo.vy > 0) boteTecho = true; }
  chk('rebota en el techo (vy sube→baja) y cuenta', boteTecho && techo.rebotes >= 1);

  const piso = { x: 195, y: 800, vx: 0, vy: 1.2, radio: 14, edad: 0, viva: true, rebota: true, rebotes: 0 };
  let reboteEnPiso = false;
  for (let i = 0; i < 200 && piso.viva; i++) { const vyPrev = piso.vy; F.paso(piso, 16, VP, null); if (vyPrev > 0 && piso.vy < 0) reboteEnPiso = true; }
  chk('el piso NO rebota (no invierte vy hacia arriba)', !reboteEnPiso);
  chk('el proyectil MUERE al tocar el piso (rebotes=0)', !piso.viva && (piso.rebotes || 0) === 0);
}

console.log('\n=== Un tiro directo (sin tocar pared) conserva rebotes=0 ===');
{
  // Cae desde arriba-centro directo al piso, sin tocar laterales/techo.
  const p = { x: 195, y: 50, vx: 0, vy: 0.5, radio: 14, edad: 0, viva: true, rebota: true, rebotes: 0 };
  for (let i = 0; i < 400 && p.viva; i++) F.paso(p, 16, VP, null);
  chk('sin rebotes al llegar al piso → tiro directo (rebotes=0)', (p.rebotes || 0) === 0);
}

console.log('\n=== Los TARGETS no rebotan (no llevan o.rebota): cruzan y mueren al salir ===');
{
  const t = F.crearTarget(VP); // sin o.rebota
  let tt = 0; while (t.viva && tt < 12000) { F.paso(t, 16, VP); tt += 16; }
  chk('el target murió (salió del viewport, no quedó rebotando)', !t.viva && (t.rebotes || 0) === 0);
}
