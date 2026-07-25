// hitclaud — ganancia PLANA: node test/ganancia.test.js
// Cada cubito vale VALOR_CUBO (5); un target naranja completo (20 cubos) = 100.
// El score NO altera el valor; la racha multiplica.

const P = require('../js/puntuacion.js');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Valor plano por cubo (no depende del score) ===');
chk(`VALOR_CUBO = 5`, P.VALOR_CUBO === 5 && P.valorCubo() === 5);

console.log('\n=== Target completo (20 cubos) = 100, en cualquier score ===');
[0, 500, 30000, 80000].forEach(function (s) {
  const m = P.crearMarcador(); m.puntos = s;
  const g = P.anotarDestruidos(m, 20);
  chk(`score ${s}: 20 cubos → +${g}`, g === 100);
});

console.log('\n=== Impacto parcial: n cubos → n×5 (×racha) ===');
{
  const m = P.crearMarcador();
  chk('1 cubo → +5', P.anotarDestruidos(m, 1) === 5);
  const m2 = P.crearMarcador();
  chk('3 cubos → +15', P.anotarDestruidos(m2, 3) === 15);
}

console.log('\n=== El multiplicador de racha amplifica la ganancia ===');
{
  const m = P.crearMarcador(); m.racha = 3;        // ×1.2
  chk('20 cubos con racha 3 → +120 (100 ×1.2)', P.anotarDestruidos(m, 20) === 120);
  const m2 = P.crearMarcador(); m2.racha = 100;    // tope ×3
  chk('20 cubos con racha enorme → +300 (tope ×3)', P.anotarDestruidos(m2, 20) === 300);
}
