// hitclaud — test de dificultad progresiva: node test/dificultad.test.js

const P = require('../js/puntuacion.js');

console.log('=== Castigo por tramos (un fallo, score ANTES de restar) ===');
[[500, 50], [5000, 100], [30000, 500], [80000, 1000]].forEach(function (caso) {
  const m = P.crearMarcador();
  m.puntos = caso[0];
  const antes = m.puntos;
  const pen = P.anotarFallo(m);
  console.log(`  score ${caso[0]} → −${pen}  (esperado −${caso[1]})  ${pen === caso[1] ? 'OK ✓' : 'NO ✗'}  puntos=${m.puntos}`);
});

console.log('\n=== Fallos consecutivos con 30,000 → −500/−1,000/−1,500 ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000;
  const esp = [500, 1000, 1500];
  for (let i = 0; i < 3; i++) {
    const pen = P.anotarFallo(m);
    console.log(`  fallo ${i + 1}: −${pen} (esperado −${esp[i]})  ${pen === esp[i] ? 'OK ✓' : 'NO ✗'}  puntos=${m.puntos}`);
  }
}

console.log('\n=== Piso en 0: fallo con 30 → 0, otro fallo → 0 ===');
{
  const m = P.crearMarcador();
  m.puntos = 30;
  P.anotarFallo(m);
  const a = m.puntos;
  P.anotarFallo(m);
  console.log(`  tras 1er fallo=${a}, tras 2º=${m.puntos}  ${a === 0 && m.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Un hit resetea los fallos consecutivos ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000;
  P.anotarFallo(m); P.anotarFallo(m); // fallosSeguidos=2
  P.anotarHit(m);                      // reset
  const pen = P.anotarFallo(m);        // debe volver a ×1 = 500
  console.log(`  tras hit, fallo=−${pen} (esperado −500)  ${pen === 500 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Curva de retardo (rango vigente por score) ===');
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
