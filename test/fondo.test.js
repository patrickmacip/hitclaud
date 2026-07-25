// hitclaud — invariante: el FONDO #121216 y la SUPERFICIE #15151C NUNCA cambian.
// node test/fondo.test.js
// Tras la purga no hay baño de color por modo: la paleta es fija (ACENTO). El JS
// no escribe variables CSS de tema; el canvas se limpia con clearRect. Este test
// blinda que ningún camino tiña el fondo/superficie.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== El JS nunca reescribe --bg ni --superficie ===');
{
  const sets = src.match(/setProperty\(\s*['"]([^'"]+)['"]/g) || [];
  const tokens = sets.map(function (s) { return s.match(/['"]([^'"]+)['"]/)[1]; });
  console.log(`  setProperty en JS: ${tokens.length ? tokens.join(', ') : '(ninguno)'}`);
  chk('NUNCA setProperty(--bg)', tokens.indexOf('--bg') === -1);
  chk('NUNCA setProperty(--superficie)', tokens.indexOf('--superficie') === -1);
}

console.log('\n=== El canvas se limpia con clearRect (no se pinta el fondo con un color) ===');
{
  chk('usa clearRect para limpiar el cuadro', /clearRect\(0,\s*0,\s*W,\s*H\)/.test(src));
  chk('el objeto COLOR (canvas) no lee --bg ni --superficie', !/--bg\b/.test(src) && !/--superficie\b/.test(src));
}

console.log('\n=== La paleta ACENTO es fija y no incluye el fondo/superficie ===');
{
  const m = src.match(/const ACENTO = \{[^}]*\}/);
  chk('existe la paleta ACENTO', !!m);
  const hex = m ? (m[0].match(/#[0-9A-Fa-f]{6}/g) || []).map(function (h) { return h.toUpperCase(); }) : [];
  console.log(`  tonos ACENTO: ${hex.join(' ')}`);
  chk('ningún tono = #121216 (fondo)', hex.indexOf('#121216') === -1);
  chk('ningún tono = #15151C (superficie)', hex.indexOf('#15151C') === -1);
}
