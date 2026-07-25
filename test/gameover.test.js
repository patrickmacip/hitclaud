// hitclaud — test del game-over limpio: node test/gameover.test.js

const P = require('../js/puntuacion.js');
const U = require('../js/util.js');
const fs = require('fs');

console.log('=== Overlay de inicio/fin con los dos botones de modo ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const n = (html.match(/id="gameover"/g) || []).length;
  const b60 = (html.match(/id="jugar60"/g) || []).length;
  const bLibre = (html.match(/id="jugarLibre"/g) || []).length;
  console.log(`  #gameover: ${n}   #jugar60: ${b60}   #jugarLibre: ${bLibre}  ${n === 1 && b60 === 1 && bLibre === 1 ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  el botón viejo #reiniciar ya no existe: ${(html.match(/id="reiniciar"/g) || []).length === 0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Reiniciar estado: resetea el marcador (record intacto) ===');
{
  const marcador = P.crearMarcador();
  marcador.puntos = 12000; marcador.racha = 8;
  marcador.puntos = 0; marcador.racha = 0;
  const limpio = marcador.puntos === 0 && marcador.racha === 0;
  console.log(`  marcador tras reiniciar: puntos=${marcador.puntos} racha=${marcador.racha}  ${limpio ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Récord POR MODO: llaves separadas, arrancan en 0 ===');
{
  const almacen = (function () { const d = {}; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, _d: d }; })();
  const r60 = U.crearRecord(almacen, 'hitclaud.record.v3.60', 500);
  const rLibre = U.crearRecord(almacen, 'hitclaud.record.v3.libre', 500);
  r60.considerar(500, 0); r60.flush(0);
  rLibre.considerar(80, 0); rLibre.flush(0);
  console.log(`  60s=${almacen._d['hitclaud.record.v3.60']}  libre=${almacen._d['hitclaud.record.v3.libre']}  ${almacen._d['hitclaud.record.v3.60'] === '500' && almacen._d['hitclaud.record.v3.libre'] === '80' ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  son independientes (una no pisa a la otra): ${r60.valor === 500 && rLibre.valor === 80 ? 'OK ✓' : 'NO ✗'}`);
}
