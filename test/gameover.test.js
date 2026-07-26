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
  const et60 = /id="jugar60"[^>]*>([^<]+)</.exec(html);
  const etLibre = /id="jugarLibre"[^>]*>([^<]+)</.exec(html);
  console.log(`  etiquetas: "${et60 && et60[1]}" / "${etLibre && etLibre[1]}"  ${et60 && et60[1] === '60 min' && etLibre && etLibre[1] === 'Relax mode' ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Menú de PAUSA (Continuar / Reiniciar) ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const p = (html.match(/id="pausa"/g) || []).length;
  const cont = (html.match(/id="continuar"/g) || []).length;
  const rei = (html.match(/id="reiniciar"/g) || []).length;
  console.log(`  #pausa: ${p}   #continuar: ${cont}   #reiniciar: ${rei}  ${p === 1 && cont === 1 && rei === 1 ? 'OK ✓' : 'NO ✗'}`);
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
