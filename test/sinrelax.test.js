// hitclaud — FASE 21 commit 4: Relax eliminado (quedan 15/30/60). node test/sinrelax.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== NO existe el modo \'libre\' en ninguna tabla ===');
{
  chk('DURACIONES sin \'libre\'', /const DURACIONES = \{ '15': 15 \* 1000, '30': 30 \* 1000, '60': 60 \* 1000 \};/.test(main) && !/DURACIONES[\s\S]{0,60}'libre'/.test(main));
  chk('records sin \'libre\'', /const records = \{ '15': record15, '30': record30, '60': record60 \};/.test(main));
  chk('sin recordLibre (persistencia \'libre\' eliminada)', !/recordLibre/.test(main));
  chk('la reconciliación sólo recorre 60/30/15', /\[record60, record30, record15\]\.forEach/.test(main));
}

console.log('=== NINGÚN botón referencia el Relax ===');
{
  chk('HTML: sin #jugarLibre', !/jugarLibre/.test(html));
  chk('HTML: sin "Relax mode"', !/Relax mode/.test(html));
  chk('main.js: sin btnLibre ni iniciarPartida(\'libre\')', !/btnLibre/.test(main) && !/iniciarPartida\('libre'\)/.test(main));
  // Sin botón huérfano ni hueco: el game over queda exactamente con 15/30/60.
  const botones = (html.match(/id="jugar(15|30|60)"/g) || []).length;
  chk('game over tiene exactamente 3 botones de modo (15/30/60), sin huérfanos', botones === 3 && !/id="jugarLibre"/.test(html));
}

console.log('=== Código COMPARTIDO usado por otros modos: NO se tocó (declarado) ===');
{
  // .go-modo-libre NO es del Relax: lo usa el botón "Reiniciar" del menú de PAUSA → se mantiene.
  chk('.go-modo-libre sigue (lo usa Reiniciar de la pausa, compartido)', /\.go-modo-libre \{/.test(css));
  chk('el botón Reiniciar de la pausa sigue usando .go-modo-libre', /id="reiniciar" class="go-reiniciar go-modo-libre">Reiniciar<\/button>/.test(html));
  // Los fallbacks defensivos (|| record60, || 0) son genéricos, no ramas del Relax.
  chk('iniciarPartida conserva sus fallbacks genéricos (records[modo] || record60)', /record = records\[modo\] \|\| record60;/.test(main));
}

console.log('=== 15/30/60 quedan intactos (regresión) ===');
{
  chk('DURACIONES 15/30/60 = 15000/30000/60000', /'15': 15 \* 1000, '30': 30 \* 1000, '60': 60 \* 1000/.test(main));
  chk('records 15/30/60 presentes', /'15': record15, '30': record30, '60': record60/.test(main));
  chk('game over: jugar15 · jugar30 · jugar60 en orden', /id="jugar15"[\s\S]{0,60}15 seg<\/button>\s*<button id="jugar30"[\s\S]{0,60}30 seg<\/button>\s*<button id="jugar60"[\s\S]{0,60}60 seg<\/button>/.test(html));
  chk('wiring: jugar15→\'15\', jugar30→\'30\', jugar60→\'60\'', /btn15\.addEventListener\('click', function \(\) \{ iniciarPartida\('15'\); \}\)/.test(main) && /btn30\.addEventListener\('click', function \(\) \{ iniciarPartida\('30'\); \}\)/.test(main) && /btn60\.addEventListener\('click', function \(\) \{ iniciarPartida\('60'\); \}\)/.test(main));
  chk('inicio: selector 15/30/60 intacto (sin Relax, que nunca estuvo ahí)', /id="sel15"/.test(html) && /id="sel30"/.test(html) && /id="sel60"/.test(html) && !/id="selLibre"/.test(html));
  chk('reloj/temporizador siguen parametrizados por DURACIONES[modoJuego]', /if \(DURACIONES\[modoJuego\] && !secuencia\)/.test(main) && /if \(jugando && DURACIONES\[modoJuego\]\)/.test(main));
}

console.log('=== Datos HUÉRFANOS declarados (no se borran con script) ===');
{
  chk('comentario declara la llave huérfana \'hitclaud.record.v2.libre\' (ignorada)', /vieja llave 'hitclaud\.record\.v2\.libre'[\s\S]{0,120}HUÉRFANA[\s\S]{0,60}se ignora \(no se borra\)/.test(main));
}

console.log(`\n== RESUMEN sin-relax: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
