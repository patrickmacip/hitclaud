// hitclaud — test del color de hitball por modo: node test/hitball.test.js
// Espejo de tonosBola (main.js). Precedencia: castigo > multiplicador > normal.

const C = { coralVivo: 'coral-vivo', azul: 'azul', dorado: 'dorado', disperso: 'disperso' };
const RADIO_NORMAL = 14;

function tonosBola(b, debuffActivo, conMult) {
  if (b.dispersa) return C.disperso;
  const chica = (b.radio || RADIO_NORMAL) < RADIO_NORMAL;
  if (chica || debuffActivo) return C.azul;   // castigo
  if (conMult) return C.dorado;               // multiplicador
  return C.coralVivo;                         // normal
}

function chk(nombre, got, esp) {
  console.log(`  ${nombre} → ${got}  ${got === esp ? 'OK ✓' : 'NO ✗ (esperado ' + esp + ')'}`);
}

console.log('=== Color de la hitball por modo ===');
chk('normal (defecto)', tonosBola({ radio: 14 }, false, false), C.coralVivo);
chk('castigo (debuff, chica)', tonosBola({ radio: 7 }, true, false), C.azul);
chk('multiplicador (racha≥3)', tonosBola({ radio: 14 }, false, true), C.dorado);
chk('dispersa de moneda', tonosBola({ radio: 7, dispersa: true }, false, false), C.disperso);

console.log('\n=== Precedencia: castigo > multiplicador > normal ===');
chk('debuff + multiplicador → castigo (azul)', tonosBola({ radio: 7 }, true, true), C.azul);
chk('power-up: principal normal (coral vivo)', tonosBola({ radio: 14 }, false, false), C.coralVivo);
chk('power-up: dispersas verde (aunque haya mult)', tonosBola({ radio: 7, dispersa: true }, false, true), C.disperso);

console.log('\n=== Parpadeo hacia tono más oscuro (0.75×, legibilidad conservada) ===');
{
  function oscurecer(hex, f) { const r = Math.round(parseInt(hex.slice(1, 3), 16) * f), g = Math.round(parseInt(hex.slice(3, 5), 16) * f), b = Math.round(parseInt(hex.slice(5, 7), 16) * f); return [r, g, b]; }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function Lrgb(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  function ratio(rgb) { const l1 = Lrgb(rgb), l2 = Lrgb([18, 18, 22]); const a = Math.max(l1, l2), b = Math.min(l1, l2); return (a + 0.05) / (b + 0.05); }
  [['coral-vivo', '#FF8764', 0.75], ['azul', '#1F55C9', 0.78], ['dorado', '#FFC300', 0.75], ['disperso', '#6FFF2C', 0.75]].forEach(function (t) {
    const osc = oscurecer(t[1], t[2]);
    const hex = '#' + osc.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
    console.log(`  ${t[0]}: claro ${t[1]} ↔ oscuro ${hex} (contraste oscuro ${ratio(osc).toFixed(2)}:1)`);
  });
}
