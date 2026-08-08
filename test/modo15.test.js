// hitclaud — HitClaud 15 y 60 comparten toda la maquinaria (parametrizada por JUEGOS +
// DURACIONES derivado). Récord por JUEGO+DURACIÓN (llaves v4). node test/modo15.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }

console.log('=== HitClaud 15 y 60: misma maquinaria, parametrizada (sin ramas por modo) ===');
{
  // JUEGOS es la fuente única: HitClaud jugable con 15 y 60.
  chk('JUEGOS declara HitClaud jugable con 15 y 60', /id: 'hitclaud'[\s\S]{0,160}jugable: true[\s\S]{0,90}duraciones: \['15', '60'\]/.test(main));
  // DURACIONES se DERIVA de JUEGOS (sin tabla literal por modo, 1.4).
  chk('DURACIONES derivado de JUEGOS (sin tabla literal por modo)', /const DURACIONES = \(function \(\)[\s\S]{0,160}duracionMs\(x\)/.test(main));
  chk('duracionMs convierte dur→ms (15→15000, 60→60000)', /const duracionMs = function \(dur\) \{ return Number\(dur\) \* 1000;/.test(main));
  chk('iniciarPartida usa DURACIONES[modo] (una máquina, no rama por modo)', /tiempoRestante = DURACIONES\[modo\] \|\| 0;/.test(main));
  chk('iniciarPartida usa recordDe(juego, modo)', /record = recordDe\(juego, modo\)/.test(main));
  chk('reloj (bucle) y temporizador (DOM) gatean por DURACIONES[modoJuego]', /if \(DURACIONES\[modoJuego\] && !secuencia\)/.test(main) && /function actualizarTiempo\(\)[\s\S]{0,220}!DURACIONES\[modoJuego\]/.test(main));
  chk('SIN rama especial modoJuego === 15 / 60', !/modoJuego === '15'/.test(main) && !/modoJuego === '60'/.test(main));
}

console.log('=== Récord por JUEGO+DURACIÓN en llaves v4 propias, independientes ===');
{
  chk('llave versionada v4 por juego+duración', /const REC_VER = 'hitclaud\.record\.v4';/.test(main) && /function llaveRecord\(juego, dur\) \{ return REC_VER \+ '\.' \+ juego \+ '\.' \+ dur;/.test(main));
  chk('se crea una persistencia por juego+duración', /recordStores\[j\.id \+ ':' \+ dur\] = U\.crearPersistencia\(almacen, idbKV, llaveRecord\(j\.id, dur\), 500\)/.test(main));
  const local = mockLocal();
  const K15 = 'hitclaud.record.v4.hitclaud.15', K60 = 'hitclaud.record.v4.hitclaud.60';
  const r15 = U.crearPersistencia(local, null, K15, 500);
  const r60 = U.crearPersistencia(local, null, K60, 500);
  r15.terminar(700, 0, true); r60.terminar(5000, 0, true);
  chk('cada récord en su llave, independientes', U.parseEntrada(local._d[K15]).record === 700 && U.parseEntrada(local._d[K60]).record === 5000);
  chk('el de 15 no tocó al de 60', r15.valor === 700 && r60.valor === 5000);
  r15.terminar(0, 100, false); // CloudOver
  chk('CloudOver no sube el récord (queda 700), ultimoScore=0', r15.valor === 700 && r15.ultimoScore === 0);
}

console.log('=== Home v2.7: los botones de duración (SÓLO las del juego) SON la acción de jugar ===');
{
  // Se generan desde j.duraciones, con el texto completo en palabras ("15 Segundos") y cada uno
  // arranca su propia partida (ya no hay botón JUGAR ni "selector" que ocultar).
  chk('los botones de duración se generan desde j.duraciones con texto en palabras', /j\.duraciones\.forEach\(function \(dur\)[\s\S]{0,320}b\.textContent = dur \+ ' Segundos'/.test(main));
  chk('tocar una duración arranca su partida (iniciarPartida(juegoSel, dur) si el juego es jugable)', /if \(j\.jugable\) iniciarPartida\(juegoSel, dur\);/.test(main));
  chk('el récord del home sigue a la duración base (modoInicioSel)', /function actualizarRecordDuracion\(\)[\s\S]{0,260}recordDe\(juegoSel, modoInicioSel\)/.test(main));
  chk('sin selector de modo escrito a mano (el home genera sus duraciones en #durModos)', !/id="sel15"/.test(html) && /id="durModos"/.test(html));
  chk('ya NO hay botón JUGAR en el home (los botones de duración lo reemplazan)', !/id="durJugar"/.test(html));
}

console.log(`\n== RESUMEN modo15: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
