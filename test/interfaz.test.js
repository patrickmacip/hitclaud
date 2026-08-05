// hitclaud — rediseño de interfaz (barra, inicio, fin). Cubre los puntos de V4 que no
// viven en otros tests: salir abandona sin récord ni ranking, el saludo abre editar-nombre
// con el valor actual, los tres selectores miden igual, todo lo pulsable ≥44px, iconos.
// node test/interfaz.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== CAMBIO 5: iconos corona, casa y lápiz (SVG monocromo, heredan currentColor) ===');
{
  chk('símbolo corona (ic-corona) definido', /<symbol id="ic-corona"/.test(html));
  chk('símbolo casa (ic-casa) definido', /<symbol id="ic-casa"/.test(html));
  chk('símbolo lápiz (ic-lapiz) definido', /<symbol id="ic-lapiz"/.test(html));
  chk('los iconos heredan el color del texto (fill: currentColor)', /\.icono \{[\s\S]{0,120}fill: currentColor/.test(css));
  chk('el podio existente se reutiliza (assets/podio-1.svg) en Ranking', /<img src="assets\/podio-1\.svg"/.test(html));
}

console.log('=== CAMBIO 1.3: SALIR abandona la partida sin guardar récord ni mandar al ranking ===');
{
  chk('botón de salir #botonSalir en la barra, cableado a abandonarPartida', /id="botonSalir"/.test(html) && /botonSalir\.addEventListener\('click', function \(\)[\s\S]{0,120}abandonarPartida\(\)/.test(main));
  chk('abandonarPartida NO llama record.terminar (no guarda récord)', !/function abandonarPartida\(\)[\s\S]{0,400}record\.terminar/.test(main));
  chk('abandonarPartida NO manda /score (enviarAlServidor(false): sólo /partida)', /function abandonarPartida\(\)[\s\S]{0,400}enviarAlServidor\(false\)/.test(main));
  chk('el /score sale por tiempo (HitClaud) o siempre en ShotClaud (enviarAlServidor)', /function enviarAlServidor\(porTiempo\)[\s\S]*?if \(porTiempo \|\| esShot\(\)\) \{[\s\S]{0,320}enviarPuntaje/.test(main));
  chk('abandono → stats con termino cloudover (el abandono cuenta como caída)', /termino: porTiempo \? 'tiempo' : 'cloudover'/.test(main));
  chk('abandonar vuelve al HOME del juego (siempre hay salida, 4.1)', /function abandonarPartida\(\)[\s\S]{0,400}mostrarHome\(juegoActivo, false\)/.test(main));
  chk('salir no interrumpe la secuencia de CloudOver', /botonSalir\.addEventListener\([\s\S]{0,120}if \(secuencia\) return;/.test(main));
}

console.log('=== CAMBIO 2/3: saludo abre editar-nombre con el valor actual; guardar refresca ===');
{
  chk('el saludo (#iniSaludo) abre editar-nombre', /elIniSaludo\.addEventListener\('click', abrirEditarNombre\)/.test(main));
  chk('editar-nombre precarga el nombre actual y lo selecciona', /function abrirEditarNombre\(\) \{[\s\S]{0,200}nombreInput\.value = nombreUsuario \|\| '';[\s\S]{0,60}nombreInput\.select\(\)/.test(main));
  chk('reusa el overlay #nombre (no crea otro)', /function abrirEditarNombre\(\)[\s\S]{0,240}elNombre\.classList\.remove\('oculto'\)/.test(main));
  chk('al guardar, el saludo se actualiza de inmediato (3.6)', /function confirmarNombre\(\)[\s\S]{0,500}actualizarSaludo\(\);[\s\S]{0,140}mostrarPantallaInicio\(\)/.test(main));
  chk('no cambia la persistencia del nombre (sigue nombreStore.guardar)', /function confirmarNombre\(\)[\s\S]{0,400}nombreStore\.guardar\(v\)/.test(main));
}

console.log('=== 2.4/4: selector de duración de ANCHO IDÉNTICO, un renglón, ≥56px (generado) ===');
{
  chk('.ini-sel reparte el ancho por igual (flex: 1)', /\.ini-sel \{[\s\S]{0,140}flex: 1;/.test(css));
  chk('.ini-sel en un solo renglón (nowrap) y altura ≥56px', /\.ini-sel \{[\s\S]{0,160}white-space: nowrap;/.test(css) && /\.ini-sel \{[\s\S]{0,160}min-height: 56px/.test(css));
  chk('pantalla 2: los botones de duración se generan como .ini-sel con texto "Ns"', /b\.className = 'go-reiniciar ini-sel'[\s\S]{0,120}b\.textContent = dur \+ 's'/.test(main));
  chk('fin: botón principal "Jugar de nuevo" (.go-reiniciar .ini-jugar, fijo al pie)', /<button id="finJugarDeNuevo" class="go-reiniciar ini-jugar fin-jugar">Jugar de nuevo<\/button>/.test(html));
  chk('fin: "Cambiar duración" se oculta si el juego tiene una sola duración', /btnFinCambiar\.classList\.toggle\('oculto', unaSola\)/.test(main));
}

console.log('=== P2/2.5/2.6: un solo acento sólido (JUGAR); Ranking es botón con contorno, no enlace ===');
{
  chk('JUGAR (pantalla 2) es el botón relleno principal (.go-reiniciar .ini-jugar)', /<button id="durJugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html));
  chk('Ranking: botón de verdad, contorno, con el podio (NO enlace, sin subrayado)', /\.ini-ranking \{[\s\S]{0,220}border: 2px solid var\(--acento/.test(css) && !/\.ini-ranking \{[\s\S]{0,220}text-decoration/.test(css));
  chk('Actualizaciones: discreto, sin contorno ni subrayado (P3)', /\.ini-actu \{[\s\S]{0,220}border: none;/.test(css) && !/\.ini-actu \{[\s\S]{0,220}text-decoration/.test(css));
  chk('Ranking también en el fin de partida (#verRankingFin con podio)', /id="verRankingFin"[\s\S]{0,120}assets\/podio-1\.svg/.test(html));
}

console.log('=== P4: TODO lo pulsable declara ≥44px de área táctil ===');
{
  const reglas = {
    '.barra-salir (44×44)': /\.barra-salir \{[\s\S]{0,80}width: 44px;[\s\S]{0,40}height: 44px;/,
    '.ini-saludo (≥44)': /\.ini-saludo \{[\s\S]{0,200}min-height: 44px/,
    '.ini-sel (≥56)': /\.ini-sel \{[\s\S]{0,160}min-height: 56px/,
    '.ini-jugar (≥56)': /\.ini-jugar \{[\s\S]{0,120}min-height: 56px/,
    '.ini-ranking (≥52)': /\.ini-ranking \{[\s\S]{0,200}min-height: 52px/,
    '.ini-actu (≥44)': /\.ini-actu \{[\s\S]{0,200}min-height: 44px/,
  };
  Object.keys(reglas).forEach(function (k) { chk('área táctil ' + k, reglas[k].test(css)); });
}

console.log('=== CAMBIO 4: fin de partida sin la palabra "Score" ni la línea de diagnóstico ===');
{
  chk('puntaje dominante sin etiqueta "Score"', /<p class="go-score oculto"><span class="valor">0<\/span><\/p>/.test(html) && !/go-score[\s\S]{0,80}>Score</.test(html));
  chk('récord nuevo con la corona (4.2)', /<p class="go-record oculto"><svg class="icono icono-mini"[\s\S]{0,80}#ic-corona/.test(html));
  chk('sin la línea de diagnóstico del envío (go-envio) en el HTML/CSS/JS', !/go-envio/.test(html) && !/go-envio/.test(css) && !/go-envio/.test(main));
  chk('sin las funciones del diagnóstico (estadoEnvioTexto/pintarEstadoEnvio)', !/estadoEnvioTexto/.test(main) && !/pintarEstadoEnvio/.test(main));
  chk('botón "Inicio" con contorno en el fin (ya no "Menú de juegos")', /id="finMenu" class="ini-ranking" type="button"><span>Inicio<\/span><\/button>/.test(html));
}

console.log(`\n== RESUMEN interfaz: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
