// hitclaud — FASE 21 commit 1: modo de 15s (idéntico a 30 y 60, reloj 15, récord propio).
// node test/modo15.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }

console.log('=== \'15\' = 15000ms y comparte TODO lo demás con \'30\' y \'60\' (misma maquinaria) ===');
{
  // Parse de la tabla DURACIONES: única config por modo cronometrado.
  const m = main.match(/const DURACIONES = \{([^}]*)\};/);
  chk('DURACIONES existe', !!m);
  const dur = {};
  (m ? m[1] : '').replace(/'(\d+)':\s*(\d+)\s*\*\s*1000/g, function (_, k, v) { dur[k] = Number(v) * 1000; return ''; });
  chk('DURACIONES[15]=15000, [30]=30000, [60]=60000', dur['15'] === 15000 && dur['30'] === 30000 && dur['60'] === 60000);
  // COMPARATIVO: los tres modos difieren SÓLO en la duración. La maquinaria (iniciar,
  // reloj, temporizador) es parametrizada por mapa → mismo código para 15/30/60.
  chk('iniciarPartida usa DURACIONES[modo] (no rama por modo)', /tiempoRestante = DURACIONES\[modo\] \|\| 0;/.test(main));
  chk('iniciarPartida usa records[modo] (no rama por modo)', /record = records\[modo\] \|\| record60;/.test(main));
  chk('reloj y temporizador gatean por DURACIONES[modoJuego] (idéntico a 30/60)', /if \(DURACIONES\[modoJuego\] && !secuencia\)/.test(main) && /if \(jugando && DURACIONES\[modoJuego\]\)/.test(main));
  chk('SIN rama especial "modoJuego === \'15\'" (prohibido; si hiciera falta, se reporta)', !/modoJuego === '15'/.test(main));
  chk('SIN iniciarPartida duplicado para 15', !/function iniciarPartida15|iniciarPartida_15/.test(main));
}

console.log('=== RÉCORD propio: llave hitclaud.record.v3.15, no pisa a los otros ni al revés ===');
{
  chk('record15 con su llave v3 (reset; doble almacén, fase 10)', /const record15 = U\.crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v3\.15', 500\)/.test(main));
  chk('record15 entra a la reconciliación (por el mayor)', /\[record60, record30, record15\]\.forEach/.test(main));
  const local = mockLocal();
  const K15 = 'hitclaud.record.v2.15', K30 = 'hitclaud.record.v2.30', K60 = 'hitclaud.record.v2.60';
  const r15 = U.crearPersistencia(local, null, K15, 500);
  const r30 = U.crearPersistencia(local, null, K30, 500);
  const r60 = U.crearPersistencia(local, null, K60, 500);
  r15.terminar(700, 0, true); r30.terminar(1200, 0, true); r60.terminar(5000, 0, true);
  chk('cada récord en SU llave, independientes', U.parseEntrada(local._d[K15]).record === 700 && U.parseEntrada(local._d[K30]).record === 1200 && U.parseEntrada(local._d[K60]).record === 5000);
  chk('el de 15 no tocó al de 30 ni al de 60', r30.valor === 1200 && r60.valor === 5000 && r15.valor === 700);
  // Regla fase 12: por CloudOver (subeRecord=false, score 0) no se guarda récord.
  r15.terminar(0, 100, false);
  chk('CloudOver en 15 NO sube el récord (queda 700), ultimoScore=0', r15.valor === 700 && r15.ultimoScore === 0);
}

console.log('=== SELECCIÓN: "15 seg" en inicio y game over; orden 15 · 30 · 60 ===');
{
  // Inicio: selector con 15/30/60, reusa .go-reiniciar; orden 15,30,60.
  chk('inicio: sel15 reusa .go-reiniciar (sin componentes nuevos)', /id="sel15" class="go-reiniciar ini-sel"/.test(html));
  chk('orden inicio: 15 · 30 · 60', /id="sel15"[\s\S]{0,80}15 seg<\/button>\s*<button id="sel30"[\s\S]{0,80}30 seg<\/button>\s*<button id="sel60"/.test(html));
  chk('selector parametrizado incluye 15 (mapa botonesSel)', /const botonesSel = \{ '15': document\.getElementById\('sel15'\)/.test(main));
  // Game over: botón 15 seg, orden 15 · 30 · 60 (Relax eliminado en commit 4).
  chk('game over: "15 seg" (.go-reiniciar)', /<button id="jugar15" class="go-reiniciar">15 seg<\/button>/.test(html));
  chk('orden game over: 15 · 30 · 60', /id="jugar15"[\s\S]{0,60}15 seg<\/button>\s*<button id="jugar30"[\s\S]{0,60}30 seg<\/button>\s*<button id="jugar60"[\s\S]{0,60}60 seg<\/button>/.test(html));
  chk('jugar15 → iniciarPartida(\'15\')', /btn15\.addEventListener\('click', function \(\) \{ iniciarPartida\('15'\); \}\)/.test(main));
}

console.log('=== EL RÉCORD MOSTRADO en inicio sigue a la selección (incluye 15) ===');
{
  chk('actualizarRecordInicio lee records[modoInicioSel]', /records\[modoInicioSel\] \|\| record60\)\.valor/.test(main));
  chk('elegir modo (incl. 15) refresca el récord', /function elegirModoInicio\(modo\)[\s\S]{0,220}actualizarRecordInicio\(\)/.test(main));
  const local = mockLocal();
  local._d['hitclaud.record.v2.15'] = JSON.stringify({ record: 150, ultimoScore: 0 });
  local._d['hitclaud.record.v2.60'] = JSON.stringify({ record: 600, ultimoScore: 0 });
  const r15 = U.crearPersistencia(local, null, 'hitclaud.record.v2.15', 500);
  const r60 = U.crearPersistencia(local, null, 'hitclaud.record.v2.60', 500);
  chk('seleccionar 15 vs 60 muestra números distintos (150 vs 600)', r15.valor === 150 && r60.valor === 600 && r15.valor !== r60.valor);
}

console.log(`\n== RESUMEN modo15: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
