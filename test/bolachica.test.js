// hitclaud — test del MODO BOLA-CHICA (ventaja con rebote): node test/bolachica.test.js
// El modo enojado deja de ser castigo: bola chica que REBOTA en los bordes
// (con gravedad, no rebote plano), SIN pérdida y SIN multiplicador. Las dispersas
// del power-up pasan a tamaño NORMAL (radio 14).

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };
const RADIO_NORMAL = 14, RADIO_DEBIL = 7;

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Dispersas del power-up: TAMAÑO NORMAL (radio 14, no 7) ===');
{
  // Espejo de dispersarMoneda: radio RADIO_NORMAL, sin flag `chica`.
  const disp = { radio: RADIO_NORMAL, moneda: true, dispersa: true };
  chk(`dispersa radio ${disp.radio} (era 7)`, disp.radio === RADIO_NORMAL && !disp.chica);
}

console.log('\n=== En modo chico NINGÚN fallo resta (ni principal ni dispersas) ===');
{
  // Espejo del death-loop: si (b.chica || enChico) → no anotarFallo.
  function resta(b, enChico) {
    if (b.chica || enChico) return false; // modo bola-chica: sin pérdida
    if (b.moneda) return false;           // dispersa: "0", sin costo
    return !b.tocado && !b.neutro;        // fallo real
  }
  chk('tiro principal en modo chico → no resta', !resta({}, true));
  chk('dispersa en modo chico → no resta', !resta({ moneda: true }, true));
  chk('bola chica fuera del modo (murió tarde) → no resta', !resta({ chica: true }, false));
  chk('tiro normal fuera del modo (falla) → SÍ resta', resta({}, false));
}

console.log('\n=== Multiplicador INACTIVO en modo chico (racha pausada) ===');
{
  const m = P.crearMarcador(); m.puntos = 5000; m.racha = 10; // racha alta (mult > 1)
  const conMult = P.anotarDestruidos(Object.assign({}, m), 5, false); // fuera del modo
  const sinMult = P.anotarDestruidos(Object.assign({}, m), 5, true);  // en modo chico
  console.log(`  5 cubos: normal +${conMult} (×${P.multRacha(m.racha).toFixed(1)}) vs modo chico +${sinMult} (×1)`);
  chk('modo chico usa ×1 (menor que con multiplicador)', sinMult < conMult && sinMult === Math.round(5 * P.valorCubo(5000)));
  // Racha PAUSADA: en modo chico NO se llama anotarHit → la racha no cambia.
  const antes = m.racha;
  chk(`racha pausada: se preserva en ${antes} (ni sube ni se resetea)`, antes === 10);
}

console.log('\n=== Rebote LATERAL con gravedad (no rebote plano) — SOLO en modo chico ===');
{
  // Bola chica cerca de la pared izquierda, moviéndose a la izquierda. Rebota en
  // el lateral (vx se invierte); la gravedad la sigue haciendo caer tras rebotar.
  const b = { x: 30, y: 100, vx: -0.8, vy: 0, radio: RADIO_DEBIL, edad: 0, viva: true, rebota: true, haEntrado: true };
  let boteLateral = false, vyCrecioTrasBote = false;
  for (let i = 0; i < 500 && b.viva; i++) {
    const vxPrev = b.vx;
    F.paso(b, 16, VP, null);
    if (vxPrev < 0 && b.vx > 0 && !boteLateral) boteLateral = true;   // rebotó a la derecha
    if (boteLateral && b.vy > 0.2) vyCrecioTrasBote = true;           // la gravedad la hace caer
  }
  chk('rebota en la pared lateral (vx se invierte)', boteLateral);
  chk('tras rebotar la GRAVEDAD la sigue haciendo CAER (no rebote plano)', vyCrecioTrasBote);
}

console.log('\n=== Rebote en el TECHO (vy se invierte hacia abajo) ===');
{
  const b = { x: 195, y: 30, vx: 0, vy: -1.0, radio: RADIO_DEBIL, edad: 0, viva: true, rebota: true, haEntrado: true };
  let boteTecho = false;
  for (let i = 0; i < 60 && b.viva; i++) { const vyPrev = b.vy; F.paso(b, 16, VP, null); if (vyPrev < 0 && b.vy > 0) boteTecho = true; }
  chk('rebota en el techo (vy sube→baja)', boteTecho);
}

console.log('\n=== El PISO NO rebota: la bola MUERE al tocarlo ===');
{
  const b = { x: 195, y: 780, vx: 0, vy: 1.2, radio: RADIO_DEBIL, edad: 0, viva: true, rebota: true, haEntrado: true };
  let reboteEnPiso = false;
  for (let i = 0; i < 200 && b.viva; i++) { const vyPrev = b.vy; F.paso(b, 16, VP, null); if (vyPrev > 0 && b.vy < 0) reboteEnPiso = true; }
  chk('NO rebota en el piso (nunca invierte vy hacia arriba abajo)', !reboteEnPiso);
  chk('muere al tocar el piso', !b.viva && b.y >= VP.h - RADIO_DEBIL - 1);
}

console.log('\n=== Tope de 3 rebotes en paredes/techo ===');
{
  // Viewport angosto y bola horizontal rápida cerca del techo: rebota lateral
  // muchas veces antes de que la gravedad la baje → se corta a 3 y muere.
  const VN = { w: 80, h: 844 };
  const b = { x: 40, y: 30, vx: 2.5, vy: 0, radio: RADIO_DEBIL, edad: 0, viva: true, rebota: true, haEntrado: true };
  for (let i = 0; i < 400 && b.viva; i++) F.paso(b, 16, VN, null);
  console.log(`  rebotes al morir: ${b.rebotes}  (tope ${F.FISICA.REBOTES_MAX})`);
  chk('respeta el tope de 3 rebotes (no rebota infinito)', (b.rebotes || 0) <= F.FISICA.REBOTES_MAX && !b.viva);
}

console.log('\n=== Fuera del modo la bola NO rebota: muere al salir ===');
{
  const b = { x: 195, y: 800, vx: 0, vy: 2.0, radio: RADIO_NORMAL, edad: 0, viva: true, rebota: false, haEntrado: true };
  for (let i = 0; i < 200 && b.viva; i++) F.paso(b, 16, VP, null);
  chk('bola normal muere al salir del viewport (sin paredes)', !b.viva && b.y > VP.h);
}
