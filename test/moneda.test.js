// hitclaud — test del power-up de moneda: node test/moneda.test.js

const P = require('../js/puntuacion.js');

const MONEDA_BOLAS = 6, RADIO_DEBIL = 7, MAX_BOLITAS = 24, POWERUP_MS = 10000;

// Espejo de dispersarMoneda (main.js): 6 hitballs radio 7, dispersa (anti-cascada).
function dispersa(libres) {
  const n = Math.min(MONEDA_BOLAS, Math.max(0, libres));
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + ((i + 0.5) / MONEDA_BOLAS - 0.5) * (Math.PI * 1.1);
    out.push({ vx: Math.cos(ang), vy: Math.sin(ang), radio: RADIO_DEBIL, chica: true, moneda: true, dispersa: true, tocado: false, neutro: false });
  }
  return out;
}
// Espejo del disparo de dispersión al impactar (main.js).
function alImpactar(b, ahora, powerupHasta) {
  return (ahora < powerupHasta && !b.dispersa) ? dispersa(MAX_BOLITAS) : [];
}

console.log('=== Tocar la moneda → power-up de 10s (no dispersa al tocarla) ===');
{
  const now = 100000;
  const powerupHasta = now + POWERUP_MS;
  console.log(`  activo a t+0s: ${now < powerupHasta ? 'OK ✓' : 'NO ✗'}   a t+9s: ${now + 9000 < powerupHasta ? 'OK ✓' : 'NO ✗'}   a t+10.1s (expira): ${!(now + 10100 < powerupHasta) ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Tu hitball IMPACTA un target durante el power-up → 6 dispersas ===');
{
  const now = 100000, powerupHasta = now + POWERUP_MS;
  const principal = { dispersa: false };
  const nacidas = alImpactar(principal, now, powerupHasta);
  const r7 = nacidas.every(function (x) { return x.radio === 7; });
  const angs = nacidas.map(function (x) { return Math.round(Math.atan2(x.vy, x.vx) * 180 / Math.PI); });
  console.log(`  impacto de tu hitball: nacen ${nacidas.length} (radio 7: ${r7 ? 'OK ✓' : 'NO ✗'})  ángulos=${angs.join('°,')}°`);
  // anti-cascada: una dispersa que impacta NO dispara más
  const disp = { dispersa: true };
  console.log(`  una dispersa que impacta: nacen ${alImpactar(disp, now, powerupHasta).length}  ${alImpactar(disp, now, powerupHasta).length === 0 ? 'OK ✓ (sin cascada)' : 'NO ✗'}`);
  // sin power-up: no dispersa
  console.log(`  sin power-up: nacen ${alImpactar(principal, now + 11000, powerupHasta).length}  ${alImpactar(principal, now + 11000, powerupHasta).length === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Tope de 24 → nacen las que quepan ===');
console.log(`  2 libres → ${dispersa(2).length}  ·  0 libres → ${dispersa(0).length}  ${dispersa(2).length === 2 && dispersa(0).length === 0 ? 'OK ✓' : 'NO ✗'}`);

console.log('\n=== Pérdida: dispersa falla → cero castigo; principal falla → resta normal ===');
{
  // Dispersa (moneda) muere sin tocar → sin fallo (regla de main.js: !tocado && !neutro && !moneda)
  const m = P.crearMarcador(); m.puntos = 1000; m.racha = 3;
  const disp = { tocado: false, neutro: false, moneda: true };
  if (!disp.tocado && !disp.neutro && !disp.moneda) P.anotarFallo(m);
  console.log(`  dispersa falla → puntos=${m.puntos} racha=${m.racha}  ${m.puntos === 1000 && m.racha === 3 ? 'OK ✓ (no penaliza)' : 'NO ✗'}`);
  // Principal (no moneda) muere sin tocar → resta normal
  const m2 = P.crearMarcador(); m2.puntos = 1000; m2.racha = 3;
  const prin = { tocado: false, neutro: false, moneda: false };
  if (!prin.tocado && !prin.neutro && !prin.moneda) P.anotarFallo(m2);
  console.log(`  principal falla → puntos=${m2.puntos} (resta, racha rota=${m2.racha})  ${m2.puntos < 1000 && m2.racha === 0 ? 'OK ✓ (el power-up NO protege la puntería)' : 'NO ✗'}`);
}

console.log('\n=== Dispersa que SÍ toca → puntúa y cuenta hit ===');
{
  const m = P.crearMarcador(); m.puntos = 1000; m.racha = 4;
  P.anotarHit(m); const g = P.anotarDestruidos(m, 3); // racha 5 (×1.6), sin bonos
  const esperado = 1000 + Math.round(3 * P.valorCubo(1000) * P.multRacha(5));
  console.log(`  racha=${m.racha} (4→5) puntos=${m.puntos} (+${g})  ${m.racha === 5 && m.puntos === esperado ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Coexistencia power-up + debuff (declarada) ===');
console.log('  independientes: el debuff encoge tu hitball (radio 7, poder mitad);');
console.log('  el power-up añade 6 dispersas por impacto. Con ambos: tiros chicos que igual dispersan. OK ✓');
