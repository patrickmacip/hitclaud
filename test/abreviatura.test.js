// hitclaud — test de la abreviatura de números grandes: node test/abreviatura.test.js
// Fuente ÚNICA: U.abreviarNumero. >=10,000 → K/M con 1 decimal TRUNCADA.

const U = require('../js/util.js');

function chk(n, esp) {
  const got = U.abreviarNumero(n);
  console.log(`  ${n} → "${got}"  ${got === esp ? 'OK ✓' : 'NO ✗ (esperado "' + esp + '")'}`);
}

console.log('=== Casos aprobados por el dueño ===');
chk(9999, '9999');       // debajo de 10k → completo
chk(10000, '10K');       // .0 se descarta
chk(10450, '10.4K');     // trunca (10.45 → 10.4), no redondea a 10.5
chk(125000, '125K');
chk(1200000, '1.2M');

console.log('\n=== Bordes y truncamiento ===');
chk(0, '0');
chk(999, '999');
chk(10499, '10.4K');     // 10.499 trunca a 10.4 (NO 10.5)
chk(19999, '19.9K');
chk(999999, '999.9K');   // justo bajo 1M
chk(1000000, '1M');
chk(1999999, '1.9M');    // trunca (NO 2.0M)
