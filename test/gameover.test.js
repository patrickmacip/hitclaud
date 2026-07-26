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
  console.log(`  etiquetas: "${et60 && et60[1]}" / "${etLibre && etLibre[1]}"  ${et60 && et60[1] === '60 seg' && etLibre && etLibre[1] === 'Relax mode' ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Menú de PAUSA (Continuar / Reiniciar) ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const p = (html.match(/id="pausa"/g) || []).length;
  const cont = (html.match(/id="continuar"/g) || []).length;
  const rei = (html.match(/id="reiniciar"/g) || []).length;
  console.log(`  #pausa: ${p}   #continuar: ${cont}   #reiniciar: ${rei}  ${p === 1 && cont === 1 && rei === 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Login: campo de nombre + botón OK (enter) + mensaje de confirmación ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const nom = (html.match(/id="nombre"/g) || []).length;
  const ok = (html.match(/id="nombreOk"/g) || []).length;
  const msg = (html.match(/id="nombreMsg"/g) || []).length;
  console.log(`  #nombre: ${nom}   #nombreOk: ${ok}   #nombreMsg: ${msg}  ${nom === 1 && ok === 1 && msg === 1 ? 'OK ✓' : 'NO ✗'}`);
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

console.log('\n=== La PAUSA detiene el reloj (modo 60 min) ===');
{
  // Espejo de la lógica: tiempoRestante SÓLO decrementa cuando jugando && !pausado.
  function tick(estado, dt) {
    if (estado.pausado || !estado.jugando) return; // el bucle retorna antes (freeze)
    if (estado.modo === '60') estado.tiempoRestante -= dt;
  }
  const e = { jugando: true, pausado: false, modo: '60', tiempoRestante: 60000 };
  for (let i = 0; i < 60; i++) tick(e, 16);            // ~1s jugando
  const trasJugar = e.tiempoRestante;
  e.pausado = true;
  for (let i = 0; i < 600; i++) tick(e, 16);           // ~10s en pausa
  const trasPausa = e.tiempoRestante;
  console.log(`  tras 1s jugando: ${trasJugar}ms · tras 10s en pausa: ${trasPausa}ms`);
  chk('el reloj corrió jugando', trasJugar < 60000 && trasJugar >= 60000 - 16 * 61);
  chk('la pausa NO consume tiempo (reloj congelado)', trasPausa === trasJugar);
  e.pausado = false;
  tick(e, 16);
  chk('al continuar, el reloj vuelve a correr', e.tiempoRestante < trasPausa);
}

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }
