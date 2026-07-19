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
  // Cualquier setProperty debe apuntar SOLO a los 4 roles del acento del modo.
  const ROLES = ['--acento', '--acento-vivo', '--acento-claro', '--acento-profundo'];
  const sets = src.match(/setProperty\(\s*['"]([^'"]+)['"]/g) || [];
  const tokens = sets.map(function (s) { return s.match(/['"]([^'"]+)['"]/)[1]; });
  console.log(`  tokens escritos por JS: ${tokens.length ? tokens.join(', ') : '(ninguno)'}`);
  const soloAcento = tokens.every(function (t) { return ROLES.indexOf(t) !== -1; });
  chk('setProperty solo toca los 4 roles del acento', soloAcento);
  chk('NUNCA setProperty(--bg)', !tokens.includes('--bg'));
  chk('NUNCA setProperty(--superficie)', !tokens.includes('--superficie'));
}

console.log('\n=== Ninguna paleta de modo iguala el fondo #121216 ni la superficie #15151C ===');
{
  // Extrae los hex de MODOS y confirma que ningún rol de ningún modo es el
  // fondo/superficie (el error a evitar: teñir la pantalla de un color ilegible).
  const bloque = src.slice(src.indexOf('const MODOS = {'), src.indexOf('};', src.indexOf('const MODOS = {')));
  const hexes = (bloque.match(/#[0-9A-Fa-f]{6}/g) || []).map(function (h) { return h.toUpperCase(); });
  console.log(`  hex de las 4 paletas (${hexes.length}): ${hexes.join(' ')}`);
  chk('16 tonos (4 modos × 4 roles)', hexes.length === 16);
  chk('ninguno = #121216 (fondo)', hexes.indexOf('#121216') === -1);
  chk('ninguno = #15151C (superficie)', hexes.indexOf('#15151C') === -1);
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
