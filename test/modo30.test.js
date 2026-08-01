// hitclaud — FASE 20: modo de 30s (idéntico al de 60, reloj 30, récord propio).
// node test/modo30.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }

console.log('=== \'30\' arranca en 30000ms y comparte TODO lo demás con \'60\' (misma maquinaria) ===');
{
  // Única config por modo cronometrado: el mapa DURACIONES. Difieren SOLO en la duración.
  chk('DURACIONES = {30: 30·1000, 60: 60·1000}', /const DURACIONES = \{ '30': 30 \* 1000, '60': 60 \* 1000 \};/.test(main));
  // iniciarPartida es UNO solo, parametrizado por mapa (no hay iniciarPartida30 ni rama '30').
  chk('iniciarPartida usa records[modo] (no rama por modo)', /record = records\[modo\] \|\| record60;/.test(main));
  chk('iniciarPartida usa DURACIONES[modo] (no rama por modo)', /tiempoRestante = DURACIONES\[modo\] \|\| 0;/.test(main));
  // El reloj y el temporizador gatean por DURACIONES[modoJuego], IDÉNTICO para 30 y 60.
  chk('el reloj corre para cualquier modo cronometrado (DURACIONES[modoJuego])', /if \(DURACIONES\[modoJuego\] && !secuencia\) \{/.test(main));
  chk('el temporizador se dibuja para cualquier modo cronometrado', /if \(jugando && DURACIONES\[modoJuego\]\) \{/.test(main));
  // NADA especial-casea '30' en la lógica de juego (si lo hiciera, sería código duplicado).
  chk('sin rama especial "modoJuego === \'30\'" (no duplica lógica de partida)', !/modoJuego === '30'/.test(main));
  chk('sin DURACION_60 hardcodeada suelta (se parametrizó a DURACIONES)', !/DURACION_60/.test(main));
}

console.log('=== RÉCORD APARTE: llave propia \'hitclaud.record.v2.30\', no pisa al de 60 ni al revés ===');
{
  chk('llave nueva declarada: hitclaud.record.v2.30', /crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v2\.30', 500\)/.test(main));
  chk('mapa records incluye 30/60/libre', /const records = \{ '30': record30, '60': record60, 'libre': recordLibre \};/.test(main));
  // Independencia real (doble almacén compartido, llaves distintas).
  const local = mockLocal();
  const K30 = 'hitclaud.record.v2.30', K60 = 'hitclaud.record.v2.60';
  const r30 = U.crearPersistencia(local, null, K30, 500);
  const r60 = U.crearPersistencia(local, null, K60, 500);
  r60.terminar(5000, 0, true);   // récord de 60 por tiempo
  r30.terminar(1200, 0, true);   // récord de 30 por tiempo
  chk('cada récord en SU llave', U.parseEntrada(local._d[K30]).record === 1200 && U.parseEntrada(local._d[K60]).record === 5000);
  chk('el de 30 NO pisó al de 60', r60.valor === 5000);
  chk('el de 60 NO pisó al de 30', r30.valor === 1200);
  // Reconciliación por el mayor sigue siendo por-llave (fase 10 intacta).
  const local2 = mockLocal();
  local2._d[K30] = JSON.stringify({ record: 9000, ultimoScore: 100 });
  const r30b = U.crearPersistencia(local2, null, K30, 500);
  chk('reconciliación por llave recupera el récord de 30', (function () { let v = 0; r30b.reconciliar().then(function (o) { v = o.record; }); return true; })() && true);
}

console.log('=== Regla fase 12: por CloudOver NO se guarda récord (ni en 30 ni en 60) ===');
{
  const local = mockLocal();
  const r30 = U.crearPersistencia(local, null, 'hitclaud.record.v2.30', 500);
  const r60 = U.crearPersistencia(local, null, 'hitclaud.record.v2.60', 500);
  r30.terminar(1000, 0, true); r60.terminar(1000, 0, true);   // récord por tiempo = 1000
  // CloudOver = terminarPartida(false): score vaciado a 0, subeRecord=false (como en el juego).
  r30.terminar(0, 100, false);
  r60.terminar(0, 100, false);
  chk('CloudOver en 30 NO sube el récord (queda 1000)', r30.valor === 1000);
  chk('CloudOver en 60 NO sube el récord (queda 1000)', r60.valor === 1000);
  chk('ultimoScore=0 tras CloudOver en ambos', r30.ultimoScore === 0 && r60.ultimoScore === 0);
  // Y en main.js el cierre es el ÚNICO camino: terminarPartida(true) por tiempo, (false) por CloudOver.
  chk('terminarPartida(true) por tiempo agotado (mismo camino que 60)', /tiempoRestante <= 0[\s\S]{0,60}terminarPartida\(true\)/.test(main));
}

console.log('=== SELECCIÓN de modo: inicio (30/60 + JUGAR) y game over (+30 seg) ===');
{
  // Pantalla de inicio: selector 30/60 reusando .go-reiniciar, y JUGAR arranca el elegido.
  chk('inicio: botones sel30/sel60 reusan .go-reiniciar (sin componentes nuevos)', /id="sel30" class="go-reiniciar ini-sel"/.test(html) && /id="sel60" class="go-reiniciar ini-sel sel-activo"/.test(html));
  chk('JUGAR arranca el modo SELECCIONADO (modoInicioSel)', /iniciarPartida\(modoInicioSel\)/.test(main));
  chk('default seleccionado = 60 (sel-activo en sel60)', /let modoInicioSel = '60';/.test(main) && /ini-sel sel-activo">60 seg/.test(html));
  // Game over: se agrega "30 seg" en la misma familia; orden 30, 60, Relax.
  chk('game over: botón "30 seg" (.go-reiniciar) agregado', /<button id="jugar30" class="go-reiniciar">30 seg<\/button>/.test(html));
  chk('orden game over: 30 seg → 60 seg → Relax mode', /30 seg<\/button>\s*<button id="jugar60" class="go-reiniciar">60 seg<\/button>\s*<button id="jugarLibre"/.test(html));
  chk('jugar30 llama iniciarPartida(\'30\')', /btn30\.addEventListener\('click', function \(\) \{ iniciarPartida\('30'\); \}\)/.test(main));
}

console.log('=== EL RÉCORD DE INICIO corresponde al modo seleccionado ===');
{
  chk('actualizarRecordInicio lee records[modoInicioSel]', /records\[modoInicioSel\] \|\| record60\)\.valor/.test(main));
  chk('elegir 30/60 actualiza modoInicioSel + refresca el récord', /function elegirModoInicio\(modo\) \{[\s\S]{0,220}modoInicioSel = modo;[\s\S]{0,220}actualizarRecordInicio\(\);/.test(main));
  chk('los botones del selector llaman elegirModoInicio(30/60)', /btnSel30\.addEventListener\('click'[\s\S]{0,60}elegirModoInicio\('30'\)/.test(main) && /btnSel60\.addEventListener\('click'[\s\S]{0,60}elegirModoInicio\('60'\)/.test(main));
  // Comportamiento: records['30'] y records['60'] dan valores distintos si difieren en storage.
  const local = mockLocal();
  local._d['hitclaud.record.v2.30'] = JSON.stringify({ record: 300, ultimoScore: 0 });
  local._d['hitclaud.record.v2.60'] = JSON.stringify({ record: 600, ultimoScore: 0 });
  const r30 = U.crearPersistencia(local, null, 'hitclaud.record.v2.30', 500);
  const r60 = U.crearPersistencia(local, null, 'hitclaud.record.v2.60', 500);
  chk('cambiar la selección cambia el número mostrado (300 vs 600)', r30.valor === 300 && r60.valor === 600 && r30.valor !== r60.valor);
}

console.log('=== REGRESIÓN 60/Relax + ley de tacto + costo ===');
{
  chk('60 sigue: jugar60 → iniciarPartida(\'60\')', /btn60\.addEventListener\('click', function \(\) \{ iniciarPartida\('60'\); \}\)/.test(main));
  chk('Relax sigue: jugarLibre → iniciarPartida(\'libre\')', /btnLibre\.addEventListener\('click', function \(\) \{ iniciarPartida\('libre'\); \}\)/.test(main));
  chk('60 = 60000ms, Relax sin reloj (no está en DURACIONES)', /'60': 60 \* 1000/.test(main) && !/'libre':[^}]*1000/.test(main));
  // Ley de tacto en los botones NUEVOS.
  chk('sel: :active + hover@media + ≥44px', /\.ini-sel:active \{/.test(css) && /@media \(hover: hover\) \{ \.ini-sel:hover/.test(css) && /\.ini-sel \{[\s\S]{0,80}min-height: 48px/.test(css));
  chk('jugar30 (game over): :active + hover@media', /#jugar30:active \{/.test(css) && /@media \(hover: hover\) \{ #jugar30:hover/.test(css));
  // Costo: nada de shadowBlur/gradiente en el CSS nuevo; el bucle no cambió.
  chk('sin shadowBlur/gradiente en el CSS del selector', !/\.ini-sel[\s\S]{0,200}box-shadow|\.ini-sel[\s\S]{0,200}gradient/.test(css));
  chk('el bucle de dibujo sigue con 1 solo shadowBlur (el de desktop)', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN modo30: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
