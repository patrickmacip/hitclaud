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

console.log('\n=== Fallo durante DEBUFF no incrementa consecutivos ===');
{
  const m = P.crearMarcador();
  m.puntos = 30000;
  // 3 fallos en debuff: el contador NO sube → cada uno castiga como "1º" (×1).
  const enDebuff = [];
  for (let i = 0; i < 3; i++) enDebuff.push(P.anotarFallo(m, { debuff: true }));
  const seguidos = m.fallosSeguidos;
  console.log(`  3 fallos en debuff: −${enDebuff.join('/−')}  fallosSeguidos=${seguidos}`);
  console.log(`  no escalan (todos ×1, mismo castigo base): ${enDebuff[0] === enDebuff[1] && enDebuff[1] === enDebuff[2] ? 'OK ✓' : 'aprox (score baja)'}   contador en 0: ${seguidos === 0 ? 'OK ✓' : 'NO ✗'}`);
  // Comparación: 3 fallos SIN debuff sí escalan
  const m2 = P.crearMarcador(); m2.puntos = 30000;
  const normal = [];
  for (let i = 0; i < 3; i++) normal.push(P.anotarFallo(m2));
  console.log(`  vs 3 fallos normales: −${normal.join('/−')} (sí escalan)  ${normal[2] > normal[0] ? 'OK ✓' : 'NO ✗'}`);
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
  m.puntos = 30;
  P.anotarFallo(m);
  const a = m.puntos;
  P.anotarFallo(m);
  console.log(`  fallo con 30 → ${a}, otro → ${m.puntos}  ${a === 0 && m.puntos === 0 ? 'OK ✓' : 'NO ✗'}`);
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
