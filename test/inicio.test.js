// hitclaud — navegación en dos niveles: pantalla 1 (elegir juego) y pantalla 2 (elegir
// duración). El arranque muestra la pantalla 1 con el mundo quieto. node test/inicio.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== PANTALLA 1 (elegir juego): título, saludo, lista de juegos, Ranking, Actualizaciones ===');
{
  chk('overlay #inicio existe (role=dialog)', /<div id="inicio"[^>]*role="dialog"/.test(html));
  chk('título del proyecto "HitClaud"', /class="ini-titulo">HitClaud</.test(html));
  chk('saludo pulsable con lápiz', /id="iniSaludo"[\s\S]{0,140}id="iniSaludoTexto"[\s\S]{0,140}#ic-lapiz/.test(html));
  chk('contenedor de tarjetas de juego (se generan desde JUEGOS)', /<div class="juego-lista" id="juegoLista"><\/div>/.test(html));
  chk('las tarjetas se construyen desde JUEGOS (una por juego)', /function construirJuegos\(\)[\s\S]{0,400}JUEGOS\.forEach/.test(main));
  chk('abajo: SOLO Actualizaciones (el ranking ya NO vive en la pantalla 1)', /id="verActualizaciones"/.test(html));
  chk('la pantalla 1 NO tiene botón de ranking', !/id="verRanking"/.test(html));
  chk('ya NO hay selector de modo ni JUGAR sueltos en la pantalla 1', !/id="sel15"/.test(html) && !/id="jugar" /.test(html));
}

console.log('=== PANTALLA 2 (elegir duración): flecha de atrás, nombre, récord, selector, JUGAR ===');
{
  chk('overlay #duracion existe (role=dialog)', /<div id="duracion"[^>]*role="dialog"/.test(html));
  chk('cabecera: flecha de atrás + nombre del juego', /id="durAtras"[\s\S]{0,140}#ic-atras[\s\S]{0,120}id="durJuego"/.test(html));
  chk('récord del juego: corona + número', /class="ini-record"[\s\S]{0,120}#ic-corona[\s\S]{0,80}id="durRecord"/.test(html));
  chk('selector de duración (se llena desde el juego)', /<div class="ini-modos" id="durModos"[^>]*><\/div>/.test(html));
  chk('botón JUGAR relleno (.ini-jugar)', /<button id="durJugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html));
  chk('la flecha de atrás sube a la pantalla 1', /btnDurAtras\.addEventListener\('click', mostrarPantallaInicio\)/.test(main));
}

console.log('=== MECANISMO: mismo sistema de overlays DOM; ambas pantallas registradas ===');
{
  chk('#inicio y #duracion en la regla de posición fixed/z-index', /#gameover, #inicio, #duracion, #nombre, #actualizaciones, #ranking \{/.test(css));
  chk('#inicio y #duracion en la regla de ocultado compuesto', /#inicio\.oculto, #duracion\.oculto/.test(css));
  chk('mostrarPantallaInicio deja jugando=false (mundo quieto)', /function mostrarPantallaInicio\(\) \{\s*jugando = false;/.test(main));
  chk('mostrarPantallaDuracion deja jugando=false y muestra #duracion', /function mostrarPantallaDuracion\(juego, reiniciar\)[\s\S]{0,500}jugando = false;[\s\S]{0,120}elDuracion\.classList\.remove\('oculto'\)/.test(main));
}

console.log('=== ARRANQUE: pantalla 1 primero, sin partida corriendo ===');
{
  chk('al cargar con nombre → mostrarPantallaInicio', /if \(nombreUsuario\) mostrarPantallaInicio\(\);/.test(main));
  chk('al cargar NO se llama iniciarPartida', main.indexOf('iniciarPartida') < main.indexOf('if (nombreUsuario) mostrarPantallaInicio();'));
  chk('estado inicial jugando = false', /let jugando = false;/.test(main));
}

console.log('=== FIN DE PARTIDA: "Jugar de nuevo" arranca el mismo juego+duración, no la pantalla 1 ===');
{
  chk('#gameover con "Jugar de nuevo"', /<button id="finJugarDeNuevo" class="go-reiniciar ini-jugar">Jugar de nuevo<\/button>/.test(html));
  chk('"Jugar de nuevo" → iniciarPartida(juegoActivo, modoJuego)', /finJugarDeNuevo[\s\S]{0,120}iniciarPartida\(juegoActivo, modoJuego\)/.test(main));
  chk('pintarFin NO muestra la pantalla de inicio (queda en el fin)', !/function pintarFin[\s\S]{0,400}elInicio\.classList\.remove/.test(main));
}

console.log('=== ESTILO: acento naranja + ley de tacto + costo intactos ===');
{
  chk('título usa var(--acento-vivo)', /\.ini-titulo \{[\s\S]{0,120}color: var\(--acento-vivo/.test(css));
  chk(':active + hover@media para JUGAR (.ini-jugar)', /\.ini-jugar:active \{/.test(css) && /@media \(hover: hover\) \{\s*\.ini-jugar:hover/.test(css));
  chk('zona táctil de JUGAR ≥44px (min-height 56px)', /\.ini-jugar \{[\s\S]{0,120}min-height: 56px/.test(css));
  chk('el bucle de dibujo sigue con 1 solo shadowBlur (el de desktop)', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN inicio: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
