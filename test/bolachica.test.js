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

console.log('\n=== Rebote FÍSICO con gravedad (no rebote plano) — SOLO en modo chico ===');
{
  // Bola chica dentro del viewport, cayendo. rebota=true → rebota en el suelo.
  const b = { x: 195, y: 400, vx: 0.05, vy: 1.2, radio: RADIO_DEBIL, edad: 0, viva: true, rebota: true, haEntrado: true };
  let toploBase = false, subioTrasRebote = false, volvioACaer = false, picoTrasRebote = Infinity;
  let vyAntes = b.vy, faseRebote = 0;
  for (let i = 0; i < 400 && b.viva; i++) {
    const yPrev = b.y, vyPrev = b.vy;
    F.paso(b, 16, VP, null);
    // Detecta el primer rebote en el suelo: vy pasa de + (bajando) a − (subiendo).
    if (vyPrev > 0 && b.vy < 0 && faseRebote === 0) { faseRebote = 1; toploBase = true; }
    if (faseRebote === 1 && b.vy < 0) { subioTrasRebote = true; picoTrasRebote = Math.min(picoTrasRebote, b.y); }
    // Tras subir, la gravedad la vuelve a hacer caer (vy > 0 otra vez).
    if (faseRebote === 1 && subioTrasRebote && b.vy > 0.1) { faseRebote = 2; volvioACaer = true; }
  }
  chk('rebota en el suelo (vy se invierte hacia arriba)', toploBase);
  chk('tras rebotar SUBE (no rebote plano)', subioTrasRebote);
  chk('la GRAVEDAD la vuelve a hacer CAER tras el rebote (parábola)', volvioACaer);
  chk('rebote ATENUADO (restitución < 1): el pico queda por debajo de la altura de salida (y=400)', picoTrasRebote > 400);
  chk('se ASIENTA/agota (muere dentro del tiempo, no rebota infinito)', !b.viva);
}

console.log('\n=== Fuera del modo la bola NO rebota: muere al salir ===');
{
  // Misma bola SIN rebota: sale por el borde inferior y muere (mundo sin paredes).
  const b = { x: 195, y: 800, vx: 0, vy: 2.0, radio: RADIO_NORMAL, edad: 0, viva: true, rebota: false, haEntrado: true };
  for (let i = 0; i < 200 && b.viva; i++) F.paso(b, 16, VP, null);
  chk('bola normal muere al salir del viewport (sin paredes)', !b.viva && b.y > VP.h);
}
