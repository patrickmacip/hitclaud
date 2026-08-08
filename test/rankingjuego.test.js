// hitclaud — ranking POR JUEGO + correcciones de navegación (paso posterior). node test/rankingjuego.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El HOME (nivel único) tiene su saludo y Actualizaciones; el ranking se abre desde él ===');
{
  const home = html.slice(html.indexOf('<div id="duracion"'), html.indexOf('<div id="actualizaciones"'));
  chk('el ranking no vive en el home (se abre con su botón)', !/id="verRanking"/.test(html));
  chk('el saludo editable se queda (en el cuerpo jugable del home)', /id="iniSaludo"/.test(home));
  chk('Actualizaciones se queda (al pie del home)', /id="verActualizaciones"/.test(home));
}

console.log('=== v2.7: el home muestra saludo, récord, Ranking, guía y botones de duración (sin JUGAR) ===');
{
  const dur = html.slice(html.indexOf('<div id="duracion"'), html.indexOf('<div id="actualizaciones"'));
  chk('orden: nav → saludo → récord → Ranking → guía → botones de duración → cierre', /home-nav[\s\S]*?id="iniSaludo"[\s\S]*?id="durRecord"[\s\S]*?id="durRanking"[\s\S]*?home-guia[\s\S]*?id="durModos"[\s\S]*?home-cierre/.test(dur));
  chk('el saludo del home se pinta con el nombre (actualizarSaludo en mostrarHome)', /function mostrarHome\(juego, reiniciar\)[\s\S]{0,600}actualizarSaludo\(\)/.test(main));
  chk('el nombre NO se edita en la pantalla 2 (no abre editar-nombre desde durNombre)', !/durNombre[\s\S]{0,80}abrirEditarNombre/.test(main));
  chk('botón Ranking en la pantalla 2, con el podio', /id="durRanking"[\s\S]{0,120}podio-1\.svg/.test(html));
  chk('el Ranking de la pantalla 2 abre el ranking de ESE juego (contexto duracion)', /btnDurRanking[\s\S]{0,120}abrirRanking\(juegoSel, 'duracion'\)/.test(main));
  chk('el home ya NO tiene botón JUGAR: los botones de duración son la acción (CAMBIO 2)', !/id="durJugar"/.test(html) && /<div class="home-modos" id="durModos"/.test(html));
}

console.log('=== D4/5.3: al entrar desde el menú, la duración MÁS CORTA viene marcada ===');
{
  chk('duracionMasCorta = mínimo numérico', /function duracionMasCorta\(j\) \{ return j\.duraciones\.slice\(\)\.sort\(function \(a, b\) \{ return Number\(a\) - Number\(b\); \}\)\[0\]; \}/.test(main));
  chk('las flechas entran con reiniciar=true (fuerza la más corta)', /mostrarHome\(juegoVecino\(juegoSel, 1\), true\)/.test(main) && /mostrarHome\(juegoVecino\(juegoSel, -1\), true\)/.test(main));
  chk('mostrarPantallaDuracion con reiniciar → duración más corta', /if \(reiniciar \|\| j\.duraciones\.indexOf\(modoInicioSel\) === -1\) modoInicioSel = duracionMasCorta\(j\)/.test(main));
  chk('el selector marca la duración seleccionada (sel-activo en modoInicioSel)', /dur === modoInicioSel \? ' sel-activo' : ''/.test(main));
}

console.log('=== CAMBIO 3: el ranking es por juego (sin selector de juego) ===');
{
  chk('sin selector de juego en el HTML del ranking', !/id="rankJuegos"/.test(html) && !/rank-juego"/.test(html));
  chk('sin construirRankJuegos / elegirRankJuego en main.js', !/construirRankJuegos/.test(main) && !/elegirRankJuego/.test(main));
  chk('el ranking muestra el NOMBRE del juego del contexto (3.3)', /id="rankJuegoNombre"/.test(html) && /elRankJuegoNombre\.textContent = j\.nombre/.test(main));
  chk('el selector de duración usa las duraciones del juego del contexto', /function construirRankModos\(\)[\s\S]{0,120}juegoPorId\(juegoSel\)/.test(main));
  chk('abrir desde el fin usa el juego jugado y el origen "fin"', /verRankingFin[\s\S]{0,120}abrirRanking\(juegoActivo, 'fin'\)/.test(main));
  chk('Cerrar vuelve al ORIGEN: al fin, o al HOME del juego (4.3)', /function cerrarRanking\(\)[\s\S]{0,200}rankOrigen === 'fin'[\s\S]{0,120}elGameOver\.classList\.remove\('oculto'\)[\s\S]{0,80}mostrarHome\(juegoSel, false\)/.test(main));
}

console.log('=== CAMBIO 4: botón JUGAR en el ranking, antes de Compartir; usa la duración de la tabla ===');
{
  chk('Compartir y Cerrar son iconos en la cabecera; JUGAR va fijo al pie', /ov-cabecera[\s\S]*?id="compartirRank"[\s\S]*?id="rankCerrar"[\s\S]*?id="rankModos"[\s\S]*?id="rankCuerpo"[\s\S]*?id="rankJugar"/.test(html));
  chk('JUGAR relleno sólido, ancho completo, al pie (.go-reiniciar .ini-jugar .rank-jugar)', /<button id="rankJugar" class="go-reiniciar ini-jugar rank-jugar">JUGAR<\/button>/.test(html));
  chk('JUGAR usa la duración SELECCIONADA en la tabla (modoInicioSel), no la de origen (4.2)', /btnRankJugar[\s\S]{0,120}iniciarPartida\(juegoSel, modoInicioSel\)/.test(main));
}

console.log('=== CAMBIO 5: la duración es coherente entre pantalla 2, ranking y fin ===');
{
  chk('cambiar la duración en el ranking mueve modoInicioSel (compartida)', /function elegirModoRank\(modo\) \{ modoInicioSel = modo;/.test(main));
  chk('Cerrar sin jugar refleja la duración en el HOME (mostrarHome conserva, reiniciar=false)', /else mostrarHome\(juegoSel, false\)/.test(main));
  chk('cambiar de juego con la flecha reinicia a la más corta (reiniciar=true)', /mostrarHome\(juegoVecino\(juegoSel, 1\), true\)/.test(main));
}

console.log('=== Estilos nuevos ===');
{
  chk('.nivel-nombre discreto (texto-s, tenue)', /\.nivel-nombre \{[\s\S]{0,120}color: var\(--texto-apagado/.test(css));
  chk('.rank-juego-nombre presente', /\.rank-juego-nombre \{/.test(css));
}

console.log(`\n== RESUMEN ranking-juego: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
