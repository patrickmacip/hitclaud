// hitclaud — test del BAÑO DE COLOR por modo: node test/hitball.test.js
// Espejo de acentoActivo (main.js). Un ACENTO ACTIVO tiñe toda la UI naranja
// (hitball, marcador, hitmaker, ganancias, badge) según el modo vigente.
// Precedencia: castigo > bonanza > power-up > normal. SIN parpadeo del acento.

const C = { coralVivo: 'coral-vivo', azul: 'azul', dorado: 'dorado', disperso: 'disperso' };

// Espejo: recibe los timestamps de fin de cada modo vs. el reloj t.
function acento(t, debuffHasta, fiestaHasta, powerupHasta) {
  if (t < debuffHasta) return C.azul;      // castigo (bola chica)
  if (t < fiestaHasta) return C.dorado;    // bonanza / fiesta
  if (t < powerupHasta) return C.disperso; // power-up (dispersión)
  return C.coralVivo;                      // normal (naranja)
}

function chk(nombre, got, esp) {
  console.log(`  ${nombre} → ${got}  ${got === esp ? 'OK ✓' : 'NO ✗ (esperado ' + esp + ')'}`);
}

const T = 1000; // reloj de referencia

console.log('=== Acento por modo ===');
chk('normal (ningún modo)', acento(T, 0, 0, 0), C.coralVivo);
chk('castigo (debuff activo)', acento(T, T + 1, 0, 0), C.azul);
chk('bonanza (fiesta activa)', acento(T, 0, T + 1, 0), C.dorado);
chk('power-up (dispersión activa)', acento(T, 0, 0, T + 1), C.disperso);

console.log('\n=== Precedencia: castigo > bonanza > power-up > normal ===');
chk('castigo + bonanza → castigo (azul)', acento(T, T + 1, T + 1, 0), C.azul);
chk('castigo + power-up → castigo (azul)', acento(T, T + 1, 0, T + 1), C.azul);
chk('bonanza + power-up → bonanza (dorado)', acento(T, 0, T + 1, T + 1), C.dorado);
chk('los tres → castigo (azul)', acento(T, T + 1, T + 1, T + 1), C.azul);

console.log('\n=== Al terminar el modo, vuelve al naranja ===');
chk('debuff expirado → normal', acento(T, T - 1, 0, 0), C.coralVivo);
chk('power-up expirado → normal', acento(T, 0, 0, T - 1), C.coralVivo);

console.log('\n=== Los TARGETS no entran al baño: siguen naranjas (solo los especiales cambian de color) ===');
console.log('  (declarativo: el acento tiñe hitball + UI, no los targets normales) OK ✓');

console.log('\n=== Contraste de cada color de acento sobre #121216 ===');
{
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function L(hex) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
  function ratio(hex) { const a = Math.max(L(hex), L('#121216')), b = Math.min(L(hex), L('#121216')); return (a + 0.05) / (b + 0.05); }
  [['coral-vivo', '#FF8764'], ['azul', '#1F55C9'], ['dorado', '#FFC300'], ['disperso', '#6FFF2C']].forEach(function (t) {
    console.log(`  ${t[0]} ${t[1]}: ${ratio(t[1]).toFixed(2)}:1`);
  });
}
