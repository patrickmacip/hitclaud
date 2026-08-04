// hitclaud — el modo de 30 segundos DESAPARECE (CAMBIO 1.2 / V4). Antes este archivo
// probaba el modo 30; ahora prueba que NO existe en ningún lado, y que su récord no se
// migra (queda huérfano, 2.2). node test/modo30.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const rankjs = fs.readFileSync(__dirname + '/../js/ranking.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El modo 30 NO existe en ninguna parte del código ni la interfaz ===');
{
  chk('ningún juego de JUEGOS declara la duración 30', !/duraciones: \[[^\]]*'30'[^\]]*\]/.test(main));
  chk('main.js no arranca ninguna partida de 30', !/iniciarPartida\([^)]*'30'\)/.test(main));
  chk('sin sel30 / jugar30 / "30s" en el HTML', !/id="sel30"/.test(html) && !/id="jugar30"/.test(html) && !/>30s</.test(html));
  chk('DURACIONES ya no es una tabla con 30 escrito a mano', !/'30': 30 \* 1000/.test(main));
  chk('el ranking (servidor) abandonó el 30: MODOS = [15, 60]', /const MODOS = \['15', '60'\];/.test(rankjs) && !/const DUR_MS = \{ '15': 15000, '30'/.test(rankjs));
}

console.log('=== El récord del 30 NO se migra: su llave queda HUÉRFANA y documentada (2.2) ===');
{
  chk('la migración copia SÓLO 15 y 60 (no el 30)', /migrarLocal\('hitclaud\.record\.v3\.15'/.test(main) && /migrarLocal\('hitclaud\.record\.v3\.60'/.test(main) && !/migrarLocal\('hitclaud\.record\.v3\.30'/.test(main));
  chk('la llave v3.30 se documenta como huérfana/abandonada', /hitclaud\.record\.v3\.30[\s\S]{0,80}(NO se migra|abandonado|HUÉRFAN)/.test(main));
}

console.log(`\n== RESUMEN modo30 (eliminado): ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
