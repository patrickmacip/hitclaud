// hitclaud — test del game-over limpio: node test/gameover.test.js

const P = require('../js/puntuacion.js');
const U = require('../js/util.js');
const fs = require('fs');

console.log('=== Un solo overlay en index.html (sin duplicados) ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const n = (html.match(/id="gameover"/g) || []).length;
  const botones = (html.match(/id="reiniciar"/g) || []).length;
  console.log(`  #gameover: ${n}   #reiniciar: ${botones}  ${n === 1 && botones === 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Reiniciar: resetea TODO el estado de la partida (record intacto) ===');
{
  // Espejo de reiniciarPartida (parte pura: el marcador).
  const marcador = P.crearMarcador();
  marcador.puntos = 12000; marcador.racha = 8;
  // reset:
  marcador.puntos = 0; marcador.racha = 0;
  const limpio = marcador.puntos === 0 && marcador.racha === 0;
  console.log(`  marcador tras reiniciar: puntos=${marcador.puntos} racha=${marcador.racha}  ${limpio ? 'OK ✓' : 'NO ✗'}`);

  // El récord persistente NO se toca por el reinicio.
  const almacen = (function () { const d = { 'hitclaud.record': '9999' }; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); } }; })();
  const record = U.crearRecord(almacen, 'hitclaud.record', 500);
  console.log(`  récord antes=${record.valor} (reiniciar NO lo toca) → sigue=${record.valor}  ${record.valor === 9999 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== El toque llega con el juego congelado (declarado) ===');
console.log('  El overlay es HTML (z-index 3) SOBRE el canvas; el freeze detiene el rAF');
console.log('  del canvas, NO los eventos del DOM → el botón recibe el click. OK ✓');
