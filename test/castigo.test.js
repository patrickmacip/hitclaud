// hitclaud — test del castigo escalado por tramo: node test/castigo.test.js

const P = require('../js/puntuacion.js');

console.log('=== 4 fallos seguidos → totales (abajo perdona, arriba no) ===');
[300, 1500, 5000, 30000].forEach(function (s0) {
  const m = P.crearMarcador();
  m.puntos = s0;
  const pens = [];
  for (let i = 0; i < 4; i++) pens.push(P.anotarFallo(m));
  const total = s0 - m.puntos;
  console.log(`  ${s0}: fallos −${pens.join('/−')}  total −${total}  → queda ${m.puntos}`);
});

console.log('\n=== Fallos consecutivos ESCALAN (contador sube en cada fallo) ===');
{
  const m = P.crearMarcador(); m.puntos = 30000;
  const pens = [];
  for (let i = 0; i < 3; i++) pens.push(P.anotarFallo(m));
  console.log(`  3 fallos: −${pens.join('/−')}  fallosSeguidos=${m.fallosSeguidos}`);
  console.log(`  escalan (2º<3º, contador=3): ${pens[2] > pens[0] && m.fallosSeguidos === 3 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Transición suave al cruzar 2,000 (sin salto) ===');
{
  const p1900 = P.penalBase(1900);
  const p2000 = P.penalBase(2000);
  const p2100 = P.penalBase(2100);
  console.log(`  castigo base: 1900=${p1900.toFixed(1)}  2000=${p2000.toFixed(1)}  2100=${p2100.toFixed(1)}`);
  const salto = Math.max(Math.abs(p2000 - p1900), Math.abs(p2100 - p2000));
  console.log(`  mayor diferencia entre vecinos: ${salto.toFixed(1)}  [sin salto brusco (<10): ${salto < 10 ? 'OK ✓' : 'NO ✗'}]`);
}

console.log('\n=== Piso en 0 intacto ===');
{
  const m = P.crearMarcador();
  m.puntos = 30; // castigo −50%: pen base ≈25 → 30→5, y el 2º fallo topa en 0
  P.anotarFallo(m);
  const a = m.puntos;
  P.anotarFallo(m);
  console.log(`  fallo con 30 → ${a}, otro → ${m.puntos}  ${a === 5 && m.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Un hit resetea los consecutivos ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000;
  P.anotarFallo(m); P.anotarFallo(m); // sube a 2
  P.anotarHit(m);                      // reset a 0
  const antes = m.fallosSeguidos;
  P.anotarFallo(m);                    // vuelve a ×1 (1º)
  console.log(`  tras hit fallosSeguidos=${antes}, siguiente fallo cuenta como 1º: ${antes === 0 ? 'OK ✓' : 'NO ✗'}`);
}
