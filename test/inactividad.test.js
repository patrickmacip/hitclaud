// hitclaud — test de costo de inactividad: node test/inactividad.test.js

const P = require('../js/puntuacion.js');
const GRACIA_MS = 3000; // espejo de main.js

console.log('=== Costo por segundo = 25% del castigo del tramo ===');
[[500, 6], [5000, 13], [30000, 63], [80000, 125]].forEach(function (caso) { // castigo −50%: inactividad = 25% del tramo (halved)
  const c = P.costoInactividad(caso[0]);
  console.log(`  score ${caso[0]} → −${c}/s (esperado −${caso[1]})  ${c === caso[1] ? 'OK ✓' : 'NO ✗'}`);
});

// Simulador del reloj de inactividad (misma lógica que main.js).
function corre(opts) {
  const m = P.crearMarcador();
  m.puntos = opts.score;
  let ultimoGesto = 0, segundosCobrados = 0, cobros = 0;
  const DT = 1000 / 60;
  for (let t = 0; t <= opts.durMs; t += DT) {
    if (opts.gestoEn && Math.abs(t - opts.gestoEn) < DT) { ultimoGesto = t; segundosCobrados = 0; }
    const oculto = opts.oculto || false;
    if (!oculto) {
      const idle = t - ultimoGesto;
      if (idle > GRACIA_MS) {
        const debidos = Math.floor((idle - GRACIA_MS) / 1000);
        while (segundosCobrados < debidos) { P.anotarInactividadSegundo(m); segundosCobrados++; cobros++; }
      }
    }
  }
  return { puntos: m.puntos, cobros: cobros };
}

console.log('\n=== 3s de gracia sin cobro ===');
{
  const r = corre({ score: 30000, durMs: 2900 }); // dentro de la gracia
  console.log(`  a 2.9s: cobros=${r.cobros} puntos=${r.puntos}  ${r.cobros === 0 && r.puntos === 30000 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Cobro por segundo tras la gracia (score 30,000 → −63/s, castigo −50%) ===');
{
  const r = corre({ score: 30000, durMs: 3000 + 3000 + 30 }); // gracia + 3s
  console.log(`  tras 3s cobrando: cobros=${r.cobros} puntos=${r.puntos}  (30000 − 3×63 = 29811)  ${r.cobros === 3 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Documento OCULTO → cero cobro ===');
{
  const r = corre({ score: 30000, durMs: 20000, oculto: true });
  console.log(`  20s ocultos: cobros=${r.cobros} puntos=${r.puntos}  ${r.cobros === 0 ? 'OK ✓ (bloquear no cuesta)' : 'NO ✗'}`);
}

console.log('\n=== Un gesto resetea el reloj ===');
{
  // 1er cobro a los 4s (1s tras la gracia). Gesto a 4.5s reinicia la gracia:
  // el siguiente cobro sería a 4.5+4=8.5s, fuera de la ventana → solo 1 cobro.
  const r = corre({ score: 30000, durMs: 6000, gestoEn: 4500 });
  console.log(`  gesto a 4.5s, hasta 6s: cobros=${r.cobros}  (1 cobro a 4s, gesto resetea, sin más)  ${r.cobros === 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Inactividad con score 0 → sigue en 0 ===');
{
  const r = corre({ score: 0, durMs: 20000 });
  console.log(`  20s quieto a 0 pts: puntos=${r.puntos}  ${r.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}
