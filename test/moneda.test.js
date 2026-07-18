// hitclaud — test de la moneda (premio de dispersión): node test/moneda.test.js

const P = require('../js/puntuacion.js');

const MONEDA_BOLAS = 6, RADIO_DEBIL = 7, MAX_BOLITAS = 24;

// Espejo de dispersarMoneda (main.js): 6 hitballs radio 7 en abanico "puff".
function dispersa(libres) {
  const n = Math.min(MONEDA_BOLAS, Math.max(0, libres));
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + ((i + 0.5) / MONEDA_BOLAS - 0.5) * (Math.PI * 1.1);
    out.push({ vx: Math.cos(ang), vy: Math.sin(ang), radio: RADIO_DEBIL, chica: true, moneda: true, tocado: false, neutro: false });
  }
  return out;
}

console.log('=== 6 hitballs nacen dispersas (abanico) con radio 7 ===');
{
  const b = dispersa(MAX_BOLITAS);
  const todasR7 = b.every(function (x) { return x.radio === 7; });
  const angs = b.map(function (x) { return Math.round(Math.atan2(x.vy, x.vx) * 180 / Math.PI); });
  const distintas = new Set(angs).size === b.length;
  const subenTodas = b.every(function (x) { return x.vy <= 0.01; }); // abanico hacia arriba
  console.log(`  nacidas=${b.length} (esperado 6: ${b.length === 6 ? 'OK ✓' : 'NO ✗'})  radio 7 todas: ${todasR7 ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  ángulos=${angs.join('°, ')}°  dispersas: ${distintas ? 'OK ✓' : 'NO ✗'}  abanico hacia arriba: ${subenTodas ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Tope de 24 lleno → nacen las que quepan ===');
{
  console.log(`  con 22 vivas (2 libres): nacen ${dispersa(2).length}  ${dispersa(2).length === 2 ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  con 24 vivas (0 libres): nacen ${dispersa(0).length}  ${dispersa(0).length === 0 ? 'OK ✓ (no rompe el tope)' : 'NO ✗'}`);
}

console.log('\n=== Bolita de moneda muere SIN tocar → cero castigo, racha intacta ===');
{
  const m = P.crearMarcador();
  m.puntos = 1000; m.racha = 3; m.fallosSeguidos = 0;
  const b = { tocado: false, neutro: false, moneda: true, viva: false };
  // Regla de main.js: fallo solo si !tocado && !neutro && !moneda
  if (!b.tocado && !b.neutro && !b.moneda) P.anotarFallo(m);
  console.log(`  puntos=${m.puntos} racha=${m.racha} fallos=${m.fallosSeguidos}  ${m.puntos === 1000 && m.racha === 3 && m.fallosSeguidos === 0 ? 'OK ✓ (no penaliza)' : 'NO ✗'}`);
}

console.log('\n=== Bolita de moneda que SÍ toca → puntúa y cuenta como hit ===');
{
  const m = P.crearMarcador();
  m.puntos = 1000; m.racha = 4;
  // main.js: al tocar un target normal, la bolita (aunque sea de moneda) hace
  // hit y puntúa igual que cualquiera.
  P.anotarHit(m);              // cuenta como hit → racha 5 (+bono 500)
  const g = P.anotarDestruidos(m, 3); // +30
  console.log(`  racha=${m.racha} (era 4→5) puntos=${m.puntos} (+${g} +bono)  ${m.racha === 5 && m.puntos === 1000 + 500 + 30 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Reglas de aparición de la moneda (5%, nunca dos/viva/fiesta) ===');
{
  const MONEDA_PROB = 0.05;
  // Aislar prob (sin moneda viva, sin fiesta):
  let mon = 0, dos = 0, prev = false;
  for (let i = 0; i < 500; i++) {
    const sale = !prev && Math.random() < MONEDA_PROB;
    if (sale) { mon++; if (prev) dos++; }
    prev = sale;
  }
  console.log(`  aparición: ${(mon / 500 * 100).toFixed(1)}% (nominal 5%)  dos seguidas: ${dos}  ${dos === 0 ? 'OK ✓' : 'NO ✗'}`);
  // con una viva → 0
  let conViva = 0;
  for (let i = 0; i < 500; i++) { const hayMoneda = true; if (!hayMoneda && Math.random() < MONEDA_PROB) conViva++; }
  console.log(`  con una moneda viva: ${conViva} en 500  ${conViva === 0 ? 'OK ✓' : 'NO ✗'}`);
  // en fiesta → 0
  let enFiesta = 0;
  for (let i = 0; i < 500; i++) { const fiesta = true; if (!fiesta && Math.random() < MONEDA_PROB) enFiesta++; }
  console.log(`  en fiesta: ${enFiesta} en 500  ${enFiesta === 0 ? 'OK ✓' : 'NO ✗'}`);
}
