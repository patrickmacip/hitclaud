// hitclaud — el panel de ranking cabe en el iPhone: altura FIJA, cabecera con iconos,
// sólo la tabla se desplaza, JUGAR fijo al pie. node test/rankinglayout.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Bloque del overlay de ranking (desde su div hasta el del gameover).
const rank = html.slice(html.indexOf('<div id="ranking"'), html.indexOf('<div id="gameover"'));

console.log('=== CAMBIO 1: el panel tiene ALTURA FIJA, no dependiente del contenido ===');
{
  chk('el panel del ranking usa la clase .rank-panel', /<div class="actu-panel rank-panel">/.test(html));
  chk('altura FIJA relativa a la ventana (min(px, dvh)), no crece con las filas', /\.rank-panel \{[\s\S]{0,120}height: min\(620px, calc\(100dvh - 96px\)\);/.test(css));
  chk('usa dvh (respeta las barras de Safari), no vh/%', /\.rank-panel \{[\s\S]{0,140}100dvh/.test(css) && !/\.rank-panel \{[\s\S]{0,140}height: 88vh/.test(css));
  chk('anula el max-height:88vh de .actu-panel (aquí el alto manda)', /\.rank-panel \{[\s\S]{0,160}max-height: none;/.test(css));
  chk('el panel NO desplaza (overflow hidden); sólo la tabla lo hace', /\.rank-panel \{[\s\S]{0,200}overflow: hidden;/.test(css));
}

console.log('=== CAMBIO 2: cabecera fija con iconos; SOLO la tabla se desplaza ===');
{
  chk('cabecera fija (flex 0 0 auto)', /\.rank-cabecera \{[\s\S]{0,80}flex: 0 0 auto;/.test(css));
  chk('orden en la cabecera: Compartir (izq) · título+juego (centro) · Cerrar (der)', /rank-cabecera[\s\S]*?id="compartirRank"[\s\S]*?rank-titulo[\s\S]*?actu-titulo[\s\S]*?rankJuegoNombre[\s\S]*?id="rankCerrar"/.test(rank));
  chk('el selector de duración es fijo (no se desplaza)', /\.rank-modos \{[\s\S]{0,60}flex: 0 0 auto;/.test(css));
  chk('SOLO .rank-cuerpo desplaza (overflow-y auto) y puede encoger (min-height 0)', /\.rank-cuerpo \{[\s\S]{0,120}min-height: 0;[\s\S]{0,80}overflow-y: auto;/.test(css));
  chk('el título del ranking es más chico que en Actualizaciones (scoped, no toca otros)', /\.rank-cabecera \.actu-titulo \{[\s\S]{0,80}font: var\(--texto-l\)/.test(css));
}

console.log('=== CAMBIO 2.1: iconos sin texto, área táctil 44×44; Cerrar es una X ===');
{
  chk('.rank-icono con 44×44 de área táctil', /\.rank-icono \{[\s\S]{0,120}width: 44px; height: 44px;/.test(css));
  chk('Compartir es icono (rank-icono, sin texto)', /<button id="compartirRank" class="rank-icono"[\s\S]{0,140}#ic-compartir/.test(rank));
  chk('Cerrar es icono X (rank-icono, sin texto)', /<button id="rankCerrar" class="rank-icono"[\s\S]{0,140}#ic-cerrar/.test(rank));
  chk('el icono de Cerrar (X) existe como SVG ligero', /<symbol id="ic-cerrar"/.test(html));
  chk('NO queda el texto "Cerrar" ni "Compartir" en el overlay de ranking', rank.indexOf('>Cerrar<') === -1 && rank.indexOf('>Compartir<') === -1 && !/<span>Compartir<\/span>/.test(rank));
}

console.log('=== CAMBIO 3: JUGAR grande, ancho completo, FIJO al pie ===');
{
  chk('JUGAR fijo al pie (flex 0 0 auto)', /\.rank-jugar \{[\s\S]{0,60}flex: 0 0 auto;/.test(css));
  chk('JUGAR relleno sólido (.go-reiniciar .ini-jugar)', /<button id="rankJugar" class="go-reiniciar ini-jugar rank-jugar">JUGAR<\/button>/.test(html));
  chk('JUGAR sigue cableado con el mismo comportamiento (duración seleccionada)', /btnRankJugar[\s\S]{0,120}iniciarPartida\(juegoSel, modoInicioSel\)/.test(main));
}

console.log('=== CAMBIO 4: aviso de desplazamiento (degradado al borde inferior) ===');
{
  chk('degradado sutil (mask) al borde inferior de la zona desplazable', /\.rank-cuerpo \{[\s\S]{0,200}mask-image: linear-gradient\(to bottom, #000 calc\(100% - 26px\), transparent\)/.test(css));
  chk('sin texto ni elementos nuevos para el aviso (sólo CSS)', !/hay más|desliza|scroll/i.test(rank));
}

console.log('=== V5: la LÓGICA del ranking no cambió (sólo layout) ===');
{
  chk('Compartir del ranking sigue llamando a Compartir.compartirRanking', /compartirRank[\s\S]{0,260}Compartir\.compartirRanking\(/.test(main));
  chk('Cerrar sigue cableado a cerrarRanking (vuelve al origen)', /btnRankCerrar\.addEventListener\('click', cerrarRanking\)/.test(main));
  chk('la duración seleccionada se sigue recordando (modoInicioSel compartido)', /function elegirModoRank\(modo\) \{ modoInicioSel = modo;/.test(main));
}

console.log(`\n== RESUMEN ranking-layout: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
