// hitclaud — test de puntuación por demolición: node test/puntuacion.test.js

const P = require('../js/puntuacion.js');

console.log(`Reglas: cubo=${P.PTS_CUBO} pts  fallo=−${P.PENAL_FALLO}  hitos=${JSON.stringify(P.HITOS)}`);

console.log('\n(a) Golpe que arranca 3 cubos → +30');
{
  const m = P.crearMarcador();
  const g = P.anotarDestruidos(m, 3);
  console.log(`  ganado=+${g}  puntos=${m.puntos}  ${m.puntos === 30 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(b) Destrucción total (20 cubos) → +200');
{
  const m = P.crearMarcador();
  const g = P.anotarDestruidos(m, 20);
  console.log(`  ganado=+${g}  puntos=${m.puntos}  ${m.puntos === 200 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(c) 5 hits seguidos → bono +500 al 5º');
{
  const m = P.crearMarcador();
  let bono5 = 0;
  for (let i = 1; i <= 5; i++) {
    const bono = P.anotarHit(m);
    if (i === 5) bono5 = bono;
    console.log(`  hit ${i}: racha=${m.racha} bono=${bono}`);
  }
  console.log(`  → bono al 5º=${bono5} puntos=${m.puntos}  ${bono5 === 500 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(d) Fallo con marcador en 50 → queda en 0 (piso, no negativo)');
{
  const m = P.crearMarcador();
  m.puntos = 50; m.racha = 3;
  P.anotarFallo(m);
  console.log(`  puntos=${m.puntos} racha=${m.racha}  ${m.puntos === 0 && m.racha === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(e) Fallo con marcador en 0 → sigue en 0');
{
  const m = P.crearMarcador();
  P.anotarFallo(m);
  console.log(`  puntos=${m.puntos}  ${m.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n(extra) Racha completa: hitos 5/10/50/100 pagan una vez');
{
  const m = P.crearMarcador();
  const pagos = [];
  for (let i = 1; i <= 100; i++) { const b = P.anotarHit(m); if (b > 0) pagos.push(`${i}:+${b}`); }
  console.log(`  pagos=${pagos.join(' ')}`);
  console.log(`  puntos=${m.puntos} (100 hits sin destruir = solo bonos = ${500 + 1000 + 5000 + 20000})  ${m.puntos === 26500 ? 'OK ✓' : 'NO ✗'}`);
}
