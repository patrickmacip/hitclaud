// hitclaud — el modo 'libre' (Relax) sigue eliminado; ahora los juegos/duraciones viven en
// JUEGOS (fuente única) y no hay modo 30. node test/sinrelax.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== NO existe el modo \'libre\' en ninguna parte ===');
{
  chk('ningún juego declara la duración libre', !/'libre'/.test(main));
  chk('sin recordLibre / btnLibre / iniciarPartida(\'libre\')', !/recordLibre/.test(main) && !/btnLibre/.test(main) && !/iniciarPartida\('libre'\)/.test(main));
  chk('HTML: sin #jugarLibre ni #selLibre', !/jugarLibre/.test(html) && !/selLibre/.test(html));
}

console.log('=== Duraciones vía JUEGOS (fuente única), sin 30 ni libre ===');
{
  chk('DURACIONES se DERIVA de JUEGOS (sin tabla literal)', /const DURACIONES = \(function \(\)[\s\S]{0,160}duracionMs\(x\)/.test(main));
  chk('HitClaud conserva 15 y 60 (regresión)', /id: 'hitclaud'[\s\S]{0,160}duraciones: \['15', '60'\]/.test(main));
  chk('reloj (bucle) y temporizador (DOM) siguen parametrizados por DURACIONES[modoJuego]', /if \(DURACIONES\[modoJuego\] && !secuencia\)/.test(main) && /function actualizarTiempo\(\)[\s\S]{0,220}!DURACIONES\[modoJuego\]/.test(main));
}

console.log('=== Código COMPARTIDO usado por otros overlays: NO se tocó (declarado) ===');
{
  chk('.go-modo-libre sigue (lo usa Cancelar del overlay de nombre, compartido)', /\.go-modo-libre \{/.test(css));
  chk('el botón Cancelar del overlay de nombre usa .go-modo-libre', /id="nombreOmitir" class="go-reiniciar go-modo-libre">Cancelar<\/button>/.test(html));
}

console.log('=== Datos HUÉRFANOS declarados (no se borran) ===');
{
  chk('se documentan las llaves huérfanas de resets previos (v2.* / v2.libre)', /v2\.libre/.test(main));
  chk('la llave v3.30 (modo 30 abandonado) queda huérfana y documentada', /hitclaud\.record\.v3\.30/.test(main));
}

console.log(`\n== RESUMEN sin-relax: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
