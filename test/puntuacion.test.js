// hitclaud — test de puntuación por demolición: node test/puntuacion.test.js

const P = require('../js/puntuacion.js');

console.log('=== Ganancia (a score 0: 5/cubo, ganancia al 50%) ===');
{
  const m = P.crearMarcador();
  const g = P.anotarDestruidos(m, 3);
  console.log(`  3 cubos → +${g}  ${m.puntos === 15 ? 'OK ✓' : 'NO ✗'}`);
  const m2 = P.crearMarcador();
  P.anotarDestruidos(m2, 20);
  console.log(`  20 cubos (target intacto) → +${m2.puntos}  ${m2.puntos === 100 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Piso en 0 ===');
{
  const m = P.crearMarcador();
  m.puntos = 50; m.racha = 3;
  P.anotarFallo(m);
  console.log(`  fallo con 50 → ${m.puntos}, racha rota=${m.racha}  ${m.puntos === 0 && m.racha === 0 ? 'OK ✓' : 'NO ✗'}`);
  const m2 = P.crearMarcador();
  P.anotarFallo(m2);
  console.log(`  fallo con 0 → ${m2.puntos}  ${m2.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== anotarHit sube la racha continua (sin bonos de hito) ===');
{
  const m = P.crearMarcador();
  for (let i = 1; i <= 5; i++) P.anotarHit(m);
  console.log(`  5 hits → racha=${m.racha} puntos=${m.puntos} (sin bonos)  ${m.racha === 5 && m.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}
