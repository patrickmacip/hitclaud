// hitclaud — test del amortiguador de caída: node test/amortiguador.test.js

const P = require('../js/puntuacion.js');

function marcador(puntos, pico) {
  const m = P.crearMarcador();
  m.puntos = puntos;
  m.pico = pico;
  return m;
}

console.log(`Curva: suelo = ${P.SUELO_PICO}·pico; ×1 sobre el suelo → ×${P.AMORT_MIN} en 0 (lineal). 0 SIEMPRE alcanzable.`);

console.log('\n=== (a) pico 10,000, score 6,100 (SOBRE suelo 6,000) → castigo completo ===');
{
  // Fallo cuyo castigo bruto ≈ 250 (tramo 2k-10k). Sobre el suelo → ×1.
  const m = marcador(6100, 10000);
  const amort = P.amortiguar(6100, 10000);
  const pen = P.anotarFallo(m);
  console.log(`  amort=${amort.toFixed(3)} (esperado 1)  fallo=−${pen}  ${amort === 1 ? 'OK ✓ (completo)' : 'NO ✗'}`);
}

console.log('\n=== (b) mismo pico, score 3,000 (BAJO suelo) → el MISMO fallo cuesta menos ===');
{
  const mSobre = marcador(6100, 10000);
  const penSobre = P.anotarFallo(mSobre);
  const mBajo = marcador(3000, 10000);
  const amort = P.amortiguar(3000, 10000);
  const penBajo = P.anotarFallo(mBajo);
  console.log(`  amort a 3000 = ${amort.toFixed(3)}  fallo bajo suelo=−${penBajo}  vs sobre suelo=−${penSobre}`);
  console.log(`  cuesta menos: ${penBajo < penSobre ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== (c) score 300 (muy bajo) → castigo muy amortiguado ===');
{
  const m = marcador(300, 10000);
  const amort = P.amortiguar(300, 10000);
  const pen = P.anotarFallo(m);
  console.log(`  amort=${amort.toFixed(3)} (cerca de ${P.AMORT_MIN})  fallo=−${pen} (muy suave)`);
}

console.log('\n=== (d) inactividad sostenida desde 6,000 (pico 10,000) → LLEGA a 0 ===');
{
  function segundosACero(pico) {
    const m = marcador(6000, pico);
    let s = 0;
    while (m.puntos > 0 && s < 100000) { P.anotarInactividadSegundo(m); s++; }
    return s;
  }
  const conAmort = segundosACero(10000); // suelo 6000
  const sinAmort = segundosACero(0);     // pico 0 → amort 1 (sin amortiguar)
  console.log(`  con amortiguador: ${conAmort}s a 0   sin amortiguador: ${sinAmort}s a 0`);
  console.log(`  LLEGA a 0 (más lento pero llega): ${conAmort > sinAmort && conAmort < 100000 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== (e) partida nueva con récord histórico 10,000 → pico 0, sin amortiguación ===');
{
  // El récord histórico NO toca el pico de la partida (que arranca en 0).
  const m = P.crearMarcador(); // pico 0
  m.puntos = 500;
  const amort = P.amortiguar(500, m.pico);
  console.log(`  pico=${m.pico} suelo=${(P.SUELO_PICO * m.pico)}  amort=${amort}  ${amort === 1 ? 'OK ✓ (un veterano NO empieza protegido)' : 'NO ✗'}`);
}

console.log('\n=== (f) el pico (y el suelo) suben en el mismo cuadro que el score ===');
{
  const m = P.crearMarcador();
  const g1 = P.anotarDestruidos(m, 20); // target intacto a score 0
  const picoTras1 = m.pico;
  const g2 = P.anotarDestruidos(m, 20); // otro golpe → sube más
  console.log(`  tras +${g1}: pico=${picoTras1}  tras +${g2}: pico=${m.pico} suelo=${(P.SUELO_PICO * m.pico)}`);
  console.log(`  pico sigue al score en vivo: ${picoTras1 === g1 && m.pico === m.puntos ? 'OK ✓' : 'NO ✗'}`);
}
