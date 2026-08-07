// hitclaud — test del multiplicador de racha continua: node test/racha.test.js

const P = require('../js/puntuacion.js');

console.log(`Curva: ×1 hasta el 2º hit; desde el ${P.RACHA_DESDE}º +0.2/hit, tope ×${P.RACHA_TOPE}.`);

console.log('\n=== Multiplicador desde el 3er hit (CAMBIO 2: tope ×5, tramo bajo intacto) ===');
[1, 2, 3, 4, 5, 12, 20, 22, 100].forEach(function (r) {
  console.log(`  racha ${r} → ×${P.multRacha(r).toFixed(2)}`);
});
{
  // El tramo bajo NO cambió (3º ×1.2, 4º ×1.4); el techo subió a ×5, que se alcanza al 22º hit
  // (1 + (22-2)·0.2 = 5.0) y no se supera. racha 12 sigue en ×3.0 (ya no es el tope, es de paso).
  const ok = P.multRacha(1) === 1 && P.multRacha(2) === 1 && P.multRacha(3) === 1.2 && P.multRacha(4) === 1.4 &&
    P.multRacha(12) === 3 && P.multRacha(20) === 4.6 && P.multRacha(22) === 5 && P.multRacha(100) === 5;
  console.log(`  3º=×1.2, 4º=×1.4, ×5 al 22º hit y no lo pasa: ${ok ? 'OK ✓' : 'NO ✗'}`);
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

console.log('\n=== Sólo el FALLO (anotarFallo) rompe la racha; un hit la sube ===');
{
  const m = P.crearMarcador();
  for (let i = 0; i < 4; i++) P.anotarHit(m); // racha 4
  const antes = m.racha;
  console.log(`  4 hits → racha=${antes}  ${antes === 4 ? 'OK ✓' : 'NO ✗'}`);
  P.anotarFallo(m);
  console.log(`  tras fallo → racha=${m.racha}  ${m.racha === 0 ? 'OK ✓ (rota)' : 'NO ✗'}`);
}

console.log('\n=== Economía con tope: incluso con racha enorme, ×5 máx (CAMBIO 2) ===');
{
  const m = P.crearMarcador();
  m.puntos = 80000; m.racha = 100;
  const g = P.anotarDestruidos(m, 20);
  const esperado = Math.round(20 * P.valorCubo(80000) * 5); // tope ×5
  console.log(`  20 cubos a 80k con racha 100 → +${g} (tope ×5 = ${esperado})  ${g === esperado ? 'OK ✓' : 'NO ✗'}`);
}
