// hitclaud — test del multiplicador de racha continua: node test/racha.test.js

const P = require('../js/puntuacion.js');

console.log(`Curva: ×1 hasta el 1º hit; desde el ${P.RACHA_DESDE}º +0.5/hit, tope ×${P.RACHA_TOPE} al 9º.`);

console.log('\n=== Multiplicador: medio punto por golpe desde el 1º (CAMBIO 2: ×5 al 9º hit) ===');
[1, 2, 3, 4, 5, 8, 9, 10, 100].forEach(function (r) {
  console.log(`  racha ${r} → ×${P.multRacha(r).toFixed(2)}`);
});
{
  // Medio punto por golpe empezando en el primero: racha 1 → ×1.0, racha 2 → ×1.5 … racha 9 → ×5.0
  // (1 + (9-1)·0.5 = 5.0) y no se supera. racha 8 → ×4.5 (aún no tope).
  const ok = P.multRacha(1) === 1 && P.multRacha(2) === 1.5 && P.multRacha(3) === 2 && P.multRacha(4) === 2.5 &&
    P.multRacha(5) === 3 && P.multRacha(8) === 4.5 && P.multRacha(9) === 5 && P.multRacha(100) === 5;
  console.log(`  1º=×1.0, 2º=×1.5, 3º=×2.0, ×5 al 9º hit y no lo pasa: ${ok ? 'OK ✓' : 'NO ✗'}`);
  if (!ok) process.exit(1);
}

console.log('\n=== El multiplicador aplica a la ganancia (después del tramo) ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000; m.racha = 5; // ×3.0
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
