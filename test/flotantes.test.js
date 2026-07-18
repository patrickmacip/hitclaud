// hitclaud — test de los números flotantes: node test/flotantes.test.js
// Mapeo evento → texto/color (espejo de la lógica de main.js).

const COL = { coralVivo: '--coral-vivo', morado: '--morado', apagado: '--texto-apagado' };

// Muerte de una bolita: fallo de la hitball principal (−N morado), dispersa del
// power-up sin impacto (0 apagado), o nada. (Las dispersas llevan flag `moneda`.)
function floatMuerte(b, pen) {
  if (b.moneda) { return !b.tocado ? { texto: '0', color: COL.apagado } : null; }
  if (!b.tocado && !b.neutro) return { texto: '−' + pen, color: COL.morado };
  return null;
}
// Cobro de inactividad por segundo (morado).
function floatInactividad(c) { return { texto: '−' + c, color: COL.morado }; }
// Positivo por demolición (coral vivo) — no se toca.
function floatPositivo(g) { return { texto: '+' + g, color: COL.coralVivo }; }

function chk(nombre, obj, texto, color) {
  const ok = obj && obj.texto === texto && obj.color === color;
  console.log(`  ${nombre}: "${obj ? obj.texto : '∅'}" en ${obj ? obj.color : '—'}  ${ok ? 'OK ✓' : 'NO ✗'}`);
}

console.log('=== FALLO: número negativo en --morado ===');
chk('bolita normal muere sin tocar (pen 250)', floatMuerte({ moneda: false, tocado: false, neutro: false }, 250), '−250', COL.morado);
{
  const noFlot = floatMuerte({ moneda: false, tocado: true, neutro: false }, 250);
  console.log(`  bolita que tocó → sin flotante de fallo: ${noFlot === null ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== INACTIVIDAD: cobro por segundo en --morado, junto al marcador ===');
chk('cobro de −125/s', floatInactividad(125), '−125', COL.morado);

console.log('\n=== DISPERSA del power-up sin impacto: "0" en --texto-apagado (SIN −) ===');
chk('dispersa muere sin tocar', floatMuerte({ moneda: true, tocado: false }, 0), '0', COL.apagado);
const sinFlot = floatMuerte({ moneda: true, tocado: true }, 0);
console.log(`  dispersa que SÍ tocó: ${sinFlot === null ? 'sin "0" (ya mostró +N) OK ✓' : 'NO ✗'}`);

console.log('\n=== POSITIVOS: intactos en --coral-vivo ===');
chk('demolición +30', floatPositivo(30), '+30', COL.coralVivo);
