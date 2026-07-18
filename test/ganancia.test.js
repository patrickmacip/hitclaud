// hitclaud — test de ganancia proporcional al tramo: node test/ganancia.test.js

const P = require('../js/puntuacion.js');

console.log(`Valor por cubo = penalBase / ${P.VALOR_DIV} (proporcional al castigo).`);

console.log('\n=== Valor de 1 cubo por tramo + ratio ganancia/castigo (debe ser constante) ===');
const scores = [500, 5000, 30000, 80000];
const ratios = [];
scores.forEach(function (s) {
  const vCubo = P.valorCubo(s);
  const castigoBase = P.penalBase(s);           // castigo del 1er fallo (×1)
  const ratio = vCubo / castigoBase;            // ganancia-por-cubo / castigo-base
  ratios.push(ratio);
  // total de un target intacto (20 cubos) vs el 1er fallo:
  const destroy = Math.round(20 * vCubo);
  console.log(`  ${s}: 1 cubo=${vCubo.toFixed(1)}  castigo=${castigoBase.toFixed(1)}  ratio=${ratio.toFixed(3)}  (destroy 20c=${destroy} vs fallo=${Math.round(castigoBase)} → ×${(destroy / castigoBase).toFixed(1)})`);
});
const rMin = Math.min.apply(null, ratios), rMax = Math.max.apply(null, ratios);
const constante = (rMax - rMin) / rMax < 0.05;
console.log(`  ratio constante (±5%): min=${rMin.toFixed(3)} max=${rMax.toFixed(3)}  ${constante ? 'OK ✓' : 'NO ✗'}`);

console.log('\n=== Sin salto al cruzar la frontera 2,000 ===');
{
  const m = P.crearMarcador();
  const v1900 = P.valorCubo(1900), v2000 = P.valorCubo(2000), v2100 = P.valorCubo(2100);
  console.log(`  valor de 1 cubo: 1900=${v1900.toFixed(1)}  2000=${v2000.toFixed(1)}  2100=${v2100.toFixed(1)}`);
  const salto = Math.max(Math.abs(v2000 - v1900), Math.abs(v2100 - v2000));
  console.log(`  mayor salto entre vecinos: ${salto.toFixed(2)}  [sin salto brusco (<2): ${salto < 2 ? 'OK ✓' : 'NO ✗'}]`);
}

console.log('\n=== A score 0 sigue siendo 10/cubo (ancla histórica) ===');
{
  const m = P.crearMarcador(); // puntos 0
  const g = P.anotarDestruidos(m, 20);
  console.log(`  20 cubos a score 0 = +${g}  ${g === 200 ? 'OK ✓ (target intacto = 200)' : 'NO ✗'}`);
}

console.log('\n=== Aplica también a dispersas de moneda (mismo anotarDestruidos) ===');
{
  const m = P.crearMarcador(); m.puntos = 30000;
  const g = P.anotarDestruidos(m, 3); // 3 cubos arrancados por una dispersa
  const esperado = Math.round(3 * P.valorCubo(30000));
  console.log(`  3 cubos a 30,000 = +${g} (=${esperado})  ${g === esperado ? 'OK ✓' : 'NO ✗'}`);
}
