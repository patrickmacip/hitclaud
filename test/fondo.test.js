// hitclaud — invariante: el FONDO #121216 y la SUPERFICIE #15151C NUNCA cambian
// en ningún modo. node test/fondo.test.js
// El baño de color solo reescribe --acento/--acento-vivo; jamás --bg ni
// --superficie. El canvas se limpia con clearRect (transparente), no se pinta el
// fondo con un color de modo. Este test blinda EXACTAMENTE el error a evitar.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== El JS nunca reescribe --bg ni --superficie ===');
{
  // Cualquier setProperty debe apuntar SOLO a --acento / --acento-vivo.
  const sets = src.match(/setProperty\(\s*['"]([^'"]+)['"]/g) || [];
  const tokens = sets.map(function (s) { return s.match(/['"]([^'"]+)['"]/)[1]; });
  console.log(`  tokens escritos por JS: ${tokens.length ? tokens.join(', ') : '(ninguno)'}`);
  const soloAcento = tokens.every(function (t) { return t === '--acento' || t === '--acento-vivo'; });
  chk('setProperty solo toca --acento / --acento-vivo', soloAcento);
  chk('NUNCA setProperty(--bg)', !tokens.includes('--bg'));
  chk('NUNCA setProperty(--superficie)', !tokens.includes('--superficie'));
}

console.log('\n=== El canvas se limpia con clearRect (no se pinta el fondo con un color) ===');
{
  chk('usa clearRect para limpiar el cuadro', /clearRect\(0,\s*0,\s*W,\s*H\)/.test(src));
  // Ningún fillRect de pantalla completa usa --bg o --superficie como color.
  chk('ningún fillStyle = --bg / --superficie', !/fillStyle\s*=\s*COLOR\.(bg|superficie)/.test(src) && !/COLOR\.(bg|superficie)/.test(src));
}

console.log('\n=== Los valores del fondo/superficie viven solo en CSS, no en el COLOR de canvas ===');
{
  // El objeto COLOR (tokens leídos para el canvas) NO incluye bg ni superficie:
  // esos tokens son exclusivos del layout CSS y el canvas jamás los dibuja.
  const bloqueColor = src.slice(src.indexOf('const COLOR = {'), src.indexOf('};', src.indexOf('const COLOR = {')));
  chk('COLOR (canvas) no lee --bg', !/--bg/.test(bloqueColor));
  chk('COLOR (canvas) no lee --superficie', !/--superficie/.test(bloqueColor));
}
