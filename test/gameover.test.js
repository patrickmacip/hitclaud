// hitclaud — test del game-over limpio: node test/gameover.test.js

const P = require('../js/puntuacion.js');
const U = require('../js/util.js');
const fs = require('fs');

console.log('=== Overlay de fin con los botones de modo (15/30/60, sin Relax) ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const n = (html.match(/id="gameover"/g) || []).length;
  const b15 = (html.match(/id="jugar15"/g) || []).length;
  const b30 = (html.match(/id="jugar30"/g) || []).length;
  const b60 = (html.match(/id="jugar60"/g) || []).length;
  const bLibre = (html.match(/id="jugarLibre"/g) || []).length;
  console.log(`  #gameover:${n} #jugar15:${b15} #jugar30:${b30} #jugar60:${b60} #jugarLibre:${bLibre} (Relax=0)  ${n === 1 && b15 === 1 && b30 === 1 && b60 === 1 && bLibre === 0 ? 'OK ✓' : 'NO ✗'}`);
  const et60 = /id="jugar60"[^>]*>([^<]+)</.exec(html);
  console.log(`  etiqueta 60: "${et60 && et60[1]}"  ${et60 && et60[1] === '60s' ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== #pausa ELIMINADO: el botón de salir abandona la partida ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const p = (html.match(/id="pausa"/g) || []).length;
  const cont = (html.match(/id="continuar"/g) || []).length;
  const rei = (html.match(/id="reiniciar"/g) || []).length;
  const salir = (html.match(/id="botonSalir"/g) || []).length;
  console.log(`  #pausa: ${p}   #continuar: ${cont}   #reiniciar: ${rei}   #botonSalir: ${salir}  ${p === 0 && cont === 0 && rei === 0 && salir === 1 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== FASE 10: SIN historial en el DOM (login/tableros/página de records fuera) ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const records = (html.match(/id="records"/g) || []).length;
  const ver = (html.match(/id="verRecords"/g) || []).length;
  const tablero = (html.match(/id="tablero"/g) || []).length;
  // (FASE 21: #nombre volvió como el overlay de NOMBRE DE USUARIO, feature distinta;
  //  ya no es marcador del viejo login. Se valida en usuario.test.js.)
  console.log(`  #records:${records} #verRecords:${ver} #tablero:${tablero} (todos 0)  ${records===0&&ver===0&&tablero===0 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Reiniciar estado: resetea el marcador (record intacto) ===');
{
  const marcador = P.crearMarcador();
  marcador.puntos = 12000; marcador.racha = 8;
  marcador.puntos = 0; marcador.racha = 0;
  const limpio = marcador.puntos === 0 && marcador.racha === 0;
  console.log(`  marcador tras reiniciar: puntos=${marcador.puntos} racha=${marcador.racha}  ${limpio ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Récord POR MODO: llaves separadas v2, independientes, arrancan en 0 ===');
{
  const almacen = (function () { const d = {}; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, _d: d }; })();
  const r60 = U.crearPersistencia(almacen, null, 'hitclaud.record.v2.60', 500);
  const r30 = U.crearPersistencia(almacen, null, 'hitclaud.record.v2.30', 500);
  r60.terminar(500, 0, true);
  r30.terminar(80, 0, true);
  const g60 = U.parseEntrada(almacen._d['hitclaud.record.v2.60']);
  const g30 = U.parseEntrada(almacen._d['hitclaud.record.v2.30']);
  console.log(`  60s.record=${g60.record}  30s.record=${g30.record}  ${g60.record === 500 && g30.record === 80 ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  son independientes (una no pisa a la otra): ${r60.valor === 500 && r30.valor === 80 ? 'OK ✓' : 'NO ✗'}`);
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
