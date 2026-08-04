// hitclaud — reordenar el fin de partida para el pulgar: Compartir como icono en la
// cabecera, botones con contorno, "Jugar de nuevo" relleno y fijo al pie. node test/finlayout.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Bloque del overlay de fin de partida (hasta el fin del <body>).
const fin = html.slice(html.indexOf('<div id="gameover"'), html.indexOf('<script src="js/util.js"'));

console.log('=== CABECERA: Compartir icono a la izquierda, sin icono a la derecha (D1) ===');
{
  chk('Compartir es un icono en la cabecera (hdr-icono), no un botón grande', /<button id="compartirFin" class="hdr-icono"[\s\S]{0,140}#ic-compartir/.test(fin));
  chk('NO queda el texto "Compartir" en el overlay de fin', fin.indexOf('>Compartir<') === -1 && !/<span>Compartir<\/span>/.test(fin));
  chk('la cabecera va ARRIBA del puntaje', /ov-cabecera fin-cabecera[\s\S]*?id="compartirFin"[\s\S]*?go-score/.test(fin));
  chk('sin icono a la derecha de la cabecera (solo Compartir)', /<div class="ov-cabecera fin-cabecera">\s*<button id="compartirFin"[\s\S]*?<\/button>\s*<\/div>/.test(fin));
  chk('el icono de compartir del fin sigue cableado a Compartir.compartirRecord', /compartirFin[\s\S]{0,260}Compartir\.compartirRecord\(/.test(main));
}

console.log('=== ORDEN de los botones (arriba→abajo): Menú · Ranking · Cambiar · Jugar de nuevo ===');
{
  chk('orden exacto', /id="finMenu"[\s\S]*?id="verRankingFin"[\s\S]*?id="finCambiarDuracion"[\s\S]*?id="finJugarDeNuevo"/.test(fin));
  chk('"Jugar de nuevo" es el ÚLTIMO', fin.indexOf('id="finJugarDeNuevo"') > fin.indexOf('id="finCambiarDuracion"') && fin.indexOf('id="finJugarDeNuevo"') > fin.indexOf('id="finMenu"'));
  chk('"Jugar de nuevo" es el ÚNICO con relleno sólido (.go-reiniciar) del overlay', (fin.match(/class="[^"]*go-reiniciar/g) || []).length === 1 && /<button id="finJugarDeNuevo" class="go-reiniciar ini-jugar fin-jugar">/.test(fin));
  chk('"Menú de juegos" es BOTÓN con contorno (ini-ranking), ya no texto suelto (D3)', /<button id="finMenu" class="ini-ranking" type="button"><span>Menú de juegos<\/span><\/button>/.test(fin) && !/class="ini-actu"[^>]*>Menú de juegos/.test(fin));
  chk('Ranking y Cambiar duración con contorno (ini-ranking)', /id="verRankingFin" class="ini-ranking"/.test(fin) && /id="finCambiarDuracion" class="ini-ranking"/.test(fin));
}

console.log('=== PANEL acotado; solo el cuerpo desplaza; "Jugar de nuevo" fijo al pie (7) ===');
{
  chk('el panel del fin es .go-panel .fin-panel (hereda max-height acotado)', /<div class="go-panel fin-panel">/.test(fin));
  chk('.fin-panel es columna y NO desplaza (overflow hidden)', /\.fin-panel \{[\s\S]{0,160}flex-direction: column;[\s\S]{0,120}overflow: hidden;/.test(css));
  chk('el panel sigue acotado al alto de la pantalla (.go-panel max-height var(--ventana-max))', /\.go-panel \{[\s\S]{0,260}max-height: var\(--ventana-max\)/.test(css));
  chk('SOLO .fin-cuerpo desplaza (flex 1, min-height 0, overflow-y auto)', /\.fin-cuerpo \{[\s\S]{0,140}min-height: 0;[\s\S]{0,80}overflow-y: auto;/.test(css));
  chk('"Jugar de nuevo" fijo al pie (fin-jugar: flex 0 0 auto) y FUERA del cuerpo desplazable', /\.fin-jugar \{[\s\S]{0,60}flex: 0 0 auto;/.test(css) && /<\/div>\s*<!--[\s\S]*?-->\s*<button id="finJugarDeNuevo"/.test(fin));
}

console.log('=== Área táctil y ocultar "Cambiar duración" con una sola duración ===');
{
  chk('la cabecera reusa hdr-icono → 44×44', /\.hdr-icono \{[\s\S]{0,120}width: 44px; height: 44px;/.test(css));
  chk('los botones con contorno miden ≥52px (ini-ranking)', /\.ini-ranking \{[\s\S]{0,200}min-height: 52px/.test(css));
  chk('"Jugar de nuevo" ≥56px (ini-jugar)', /\.ini-jugar \{[\s\S]{0,120}min-height: 56px/.test(css));
  chk('"Cambiar duración" se oculta si el juego tiene una sola duración (toggle + regla que sí oculta)', /btnFinCambiar\.classList\.toggle\('oculto', unaSola\)/.test(main) && /\.ini-ranking\.oculto \{ display: none; \}/.test(css));
}

console.log('=== V5 regresión: cada botón hace EXACTAMENTE lo mismo (solo cambió posición/estilo) ===');
{
  chk('Jugar de nuevo → iniciarPartida(juegoActivo, modoJuego)', /finJugarDeNuevo[\s\S]{0,120}iniciarPartida\(juegoActivo, modoJuego\)/.test(main));
  chk('Menú de juegos → mostrarPantallaInicio', /finMenu[\s\S]{0,120}mostrarPantallaInicio/.test(main));
  chk('Ranking → abrirRanking(juegoActivo, "fin")', /verRankingFin[\s\S]{0,120}abrirRanking\(juegoActivo, 'fin'\)/.test(main));
  chk('Cambiar duración → mostrarPantallaDuracion(juegoActivo, false)', /finCambiarDuracion[\s\S]{0,220}mostrarPantallaDuracion\(juegoActivo, false\)/.test(main));
}

console.log(`\n== RESUMEN fin-layout: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
