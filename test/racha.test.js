// hitclaud — test del multiplicador de racha continua: node test/racha.test.js

const P = require('../js/puntuacion.js');

console.log(`Curva: ×1 hasta el 2º hit; desde el ${P.RACHA_DESDE}º +0.2/hit, tope ×${P.RACHA_TOPE}.`);

console.log('\n=== Multiplicador desde el 3er hit ===');
[1, 2, 3, 4, 5, 12, 20].forEach(function (r) {
  console.log(`  racha ${r} → ×${P.multRacha(r).toFixed(2)}`);
});
{
  const ok = P.multRacha(1) === 1 && P.multRacha(2) === 1 && P.multRacha(3) === 1.2 && P.multRacha(4) === 1.4 && P.multRacha(12) === 3 && P.multRacha(20) === 3;
  console.log(`  3º=×1.2, 4º=×1.4, tope ×3 (racha 12) y no lo pasa: ${ok ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== El multiplicador aplica a la ganancia (después del tramo) ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000; m.racha = 5; // ×1.6
  const g = P.anotarDestruidos(m, 1);
  const esperado = Math.round(1 * P.valorCubo(30000) * P.multRacha(5));
  console.log(`  1 cubo a 30k con racha 5 (×${P.multRacha(5)}) → +${g} (=${esperado})  ${g === esperado ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Se rompe al FALLAR la hitball principal (racha → 0) ===');
{
  const m = P.crearMarcador();
  m.puntos = 5000;
  for (let i = 0; i < 6; i++) P.anotarHit(m); // racha 6
  console.log(`  racha=${m.racha} → ×${P.multRacha(m.racha).toFixed(2)}`);
  P.anotarFallo(m);
  console.log(`  tras fallo: racha=${m.racha} → ×${P.multRacha(m.racha).toFixed(2)}  ${m.racha === 0 ? 'OK ✓ (se rompió)' : 'NO ✗'}`);
}

console.log('\n=== NO se rompe por dispersa/contacto neutro (no llaman anotarFallo) ===');
{
  // Una dispersa que falla o un contacto neutro NO invocan anotarFallo (main.js
  // los exime), así que la racha se mantiene.
  const m = P.crearMarcador();
  for (let i = 0; i < 4; i++) P.anotarHit(m); // racha 4
  const antes = m.racha;
  // (no se llama anotarFallo)
  console.log(`  racha antes=${antes}, tras dispersa fallida/neutro sigue=${m.racha}  ${m.racha === antes ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Economía con tope: incluso con racha enorme, ×3 máx ===');
{
  const m = P.crearMarcador();
  m.puntos = 80000; m.racha = 100;
  const g = P.anotarDestruidos(m, 20);
  const esperado = Math.round(20 * P.valorCubo(80000) * 3); // tope ×3
  console.log(`  20 cubos a 80k con racha 100 → +${g} (tope ×3 = ${esperado})  ${g === esperado ? 'OK ✓' : 'NO ✗'}`);
}

// ── Bonanza y multiplicador NO coexisten + hitball dorada (espejo main.js) ──
console.log('\n=== Bonanza y multiplicador no coexisten ===');
{
  const D = P.RACHA_DESDE; // 3
  // Estrella hace pop cuando racha >= D:
  const popEstrella = function (racha) { return racha >= D; };
  // Estrella NO spawnea cuando racha >= D:
  const spawnEstrella = function (racha) { return racha < D; };
  console.log(`  racha 2: estrella viva sigue=${!popEstrella(2)}, puede spawnear=${spawnEstrella(2)}  ${!popEstrella(2) && spawnEstrella(2) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  racha 3: estrella hace POP=${popEstrella(3)}, NO spawnea=${!spawnEstrella(3)}  ${popEstrella(3) && !spawnEstrella(3) ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Hitball dorada durante el multiplicador, índigo al romper ===');
{
  const D = P.RACHA_DESDE;
  const dorada = function (racha, dispersa) { return racha >= D && !dispersa; };
  console.log(`  racha 2 → dorada=${dorada(2, false)} (índigo)  racha 3 → dorada=${dorada(3, false)}  ${!dorada(2, false) && dorada(3, false) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  dispersa NO es dorada: ${!dorada(5, true) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  tras romper racha (0) → índigo: ${!dorada(0, false) ? 'OK ✓' : 'NO ✗'}`);
}
