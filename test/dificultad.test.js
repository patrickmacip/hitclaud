// hitclaud — test de ritmo/respiro: node test/dificultad.test.js
// (El castigo escalado por tramo vive en castigo.test.js.)

const P = require('../js/puntuacion.js');

console.log('=== Curva de retardo (rango vigente por score) ===');
[0, 10000, 30000, 60000].forEach(function (s) {
  const r = P.rangoRetardo(s);
  console.log(`  ${s} pts → ${r.min}-${r.max}ms`);
});
{
  const r30 = P.rangoRetardo(30000);
  const r60 = P.rangoRetardo(60000);
  const tope = r30.min === 150 && r30.max === 500 && r60.min === 150 && r60.max === 500;
  console.log(`  tope no se pasa (30k == 60k == 150-500): ${tope ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Respiro: entra / dura / sale (dificultad máxima) ===');
{
  const ritmo = P.crearRitmo();
  const now = 100000; // timestamp base (sin Date real)
  const entra = P.quizasRespiro(ritmo, 30000, 10, now); // 10º hit en dif. máx
  const rEntra = P.rangoVigente(ritmo, 30000, now);
  const rDura = P.rangoVigente(ritmo, 30000, now + 4000);  // dentro de 5s
  const rSale = P.rangoVigente(ritmo, 30000, now + 5001);  // tras 5s
  console.log(`  activa=${entra}  durante: ${rEntra.min}-${rEntra.max} → ${rDura.min}-${rDura.max} (base 400-1200)`);
  console.log(`  tras 5s: ${rSale.min}-${rSale.max} (vuelve al tope 150-500)`);
  const ok = entra && rEntra.min === 400 && rDura.min === 400 && rSale.min === 150;
  console.log(`  ${ok ? 'OK ✓' : 'NO ✗'}`);
  // No entra si no es dificultad máxima:
  const r2 = P.crearRitmo();
  const noEntra = P.quizasRespiro(r2, 10000, 10, now);
  console.log(`  a 10,000 pts (no es dif. máxima) el respiro NO entra: ${!noEntra ? 'OK ✓' : 'NO ✗'}`);
}
