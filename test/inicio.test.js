// hitclaud — NIVEL ÚNICO: el home de cada juego. La pantalla de selección (#inicio) se
// eliminó; el home (#duracion) tiene una fila de navegación con flechas que CICLAN entre
// juegos. La app arranca SIEMPRE en HitClaud. node test/inicio.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== La pantalla de selección (#inicio) YA NO existe (nivel único) ===');
{
  chk('sin overlay #inicio en el HTML', !/id="inicio"/.test(html));
  chk('sin lista/tarjetas de juego (juegoLista, juego-card, construirJuegos)', !/id="juegoLista"/.test(html) && !/juego-card/.test(css) && !/function construirJuegos/.test(main));
  chk('sin mostrarPantallaInicio como pantalla propia (es un alias al home)', /function mostrarPantallaInicio\(\) \{ mostrarHome\(/.test(main));
}

console.log('=== El HOME (#duracion): fila de navegación entre juegos (flecha · nombre · flecha) ===');
{
  chk('overlay #duracion existe (role=dialog)', /<div id="duracion"[^>]*role="dialog"/.test(html));
  chk('cabecera home-nav: flecha izquierda + nombre del juego + flecha derecha', /ov-cabecera home-nav[\s\S]{0,120}id="homeIzq"[\s\S]{0,240}id="durJuego"[\s\S]{0,240}id="homeDer"/.test(html));
  chk('las flechas son iconos discretos (hdr-icono), el nombre pesa (nivel-titulo)', /<button id="homeIzq" class="hdr-icono"/.test(html) && /<button id="homeDer" class="hdr-icono"/.test(html) && /<span class="nivel-titulo" id="durJuego">/.test(html));
  chk('flechas tenues por CSS (no dominantes)', /\.home-nav \.hdr-icono \{ color: var\(--texto-apagado/.test(css));
  chk('icono de flecha derecha (ic-adelante) definido', /<symbol id="ic-adelante"/.test(html));
}

console.log('=== CICLO INFINITO en ambas direcciones (2.3) ===');
{
  chk('el orden es el de JUEGOS (HitClaud, ShotClaud, PushClaud)', /const ORDEN_JUEGOS = JUEGOS\.map\(function \(j\) \{ return j\.id; \}\)/.test(main));
  chk('juegoVecino cicla módulo N (nunca se acaba, nunca se apaga una flecha)', /function juegoVecino\(id, delta\) \{[\s\S]{0,200}\(\(\(i < 0 \? 0 : i\) \+ delta\) % n \+ n\) % n/.test(main));
  chk('IZQUIERDA avanza (+1); DERECHA retrocede (-1)', /btnHomeIzq\.addEventListener\('click', function \(\) \{ mostrarHome\(juegoVecino\(juegoSel, 1\), true\); \}\)/.test(main) && /btnHomeDer\.addEventListener\('click', function \(\) \{ mostrarHome\(juegoVecino\(juegoSel, -1\), true\); \}\)/.test(main));
  chk('cambiar de juego reinicia a la duración más corta (reiniciar=true, 4.4)', /mostrarHome\(juegoVecino\(juegoSel, 1\), true\)/.test(main));
}

console.log('=== JUEGO DISPONIBLE: saludo + récord + duraciones + Ranking + JUGAR (2.4) ===');
{
  const home = (html.match(/<div id="duracion"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
  chk('cuerpo jugable #homeJugable con saludo, récord, duraciones, Ranking, JUGAR', /id="homeJugable"[\s\S]*?id="iniSaludo"[\s\S]*?id="durRecord"[\s\S]*?id="durModos"[\s\S]*?id="durRanking"[\s\S]*?id="durJugar"/.test(home));
  chk('mostrarHome muestra el cuerpo jugable según disponibilidad()', /const disp = disponibilidad\(j, esDesktop\);[\s\S]{0,120}elHomeJugable\.classList\.toggle\('oculto', !disp\.jugable\)/.test(main));
  chk('JUGAR es el botón relleno (.ini-jugar)', /<button id="durJugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html));
}

console.log('=== JUEGO NO DISPONIBLE / SIN TERMINAR: imagen + leyenda, nada pulsable salvo flechas (2.5/2.6) ===');
{
  const home = (html.match(/<div id="duracion"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
  chk('cuerpo NO jugable #homeNoJugable con imagen (canvas) + leyenda', /id="homeNoJugable"[\s\S]*?id="homeImagen"[\s\S]*?id="homeLeyenda"/.test(home));
  chk('la imagen se GENERA con el canvas (escena estática cacheada, sin archivos)', /function construirImagenJuego\(id\)/.test(main) && /imagenesJuego\[id\] = construirImagenJuego\(id\)/.test(main));
  chk('leyenda "Pronto" manda sobre la de plataforma (2.6)', /disp\.pronto\s*\?\s*'Pronto'\s*:\s*\(j\.plataforma === 'escritorio' \? 'Disponible solo en computadora' : 'Disponible solo en móvil'\)/.test(main));
  chk('la leyenda tiene estilo con dignidad (blanca, peso 700, centrada)', /\.home-leyenda \{[\s\S]{0,160}font-weight: 700;[\s\S]{0,120}text-align: center/.test(css));
  chk('sin shadowBlur en la generación de imágenes', !/g\.shadowBlur/.test(main));
}

console.log('=== Actualizaciones al pie del home, igual en todos (2.7) ===');
{
  const home = (html.match(/<div id="duracion"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
  chk('botón Actualizaciones dentro del home', /id="verActualizaciones"/.test(home));
}

console.log('=== ARRANQUE: SIEMPRE en el home de HitClaud (1.2) ===');
{
  chk('al cargar con nombre → mostrarHome(hitclaud, true)', /if \(nombreUsuario\) mostrarHome\('hitclaud', true\);/.test(main));
  chk('al cargar sin almacén → mostrarHome(hitclaud, true)', /else mostrarHome\('hitclaud', true\);/.test(main));
  chk('al cargar NO se llama iniciarPartida', main.indexOf('iniciarPartida') < main.indexOf("if (nombreUsuario) mostrarHome('hitclaud', true);"));
  chk('estado inicial jugando = false', /let jugando = false;/.test(main));
}

console.log('=== FIN DE PARTIDA: "Jugar de nuevo" y "Inicio" (al home del juego) ===');
{
  chk('#gameover con "Jugar de nuevo"', /<button id="finJugarDeNuevo" class="go-reiniciar ini-jugar fin-jugar">Jugar de nuevo<\/button>/.test(html));
  chk('"Jugar de nuevo" → iniciarPartida(juegoActivo, modoJuego)', /finJugarDeNuevo[\s\S]{0,120}iniciarPartida\(juegoActivo, modoJuego\)/.test(main));
  chk('"Inicio" del fin vuelve al home del juego', /<button id="finMenu"[\s\S]{0,60}>Inicio</.test(html) && /finMenu[\s\S]{0,160}mostrarHome\(juegoActivo, false\)/.test(main));
}

console.log('=== ESTILO: acento naranja + ley de tacto ===');
{
  chk('el nombre del juego usa var(--acento-vivo)', /\.nivel-titulo \{[\s\S]{0,120}color: var\(--acento-vivo/.test(css));
  chk(':active + hover@media para JUGAR (.ini-jugar)', /\.ini-jugar:active \{/.test(css) && /@media \(hover: hover\) \{\s*\.ini-jugar:hover/.test(css));
  chk('el bucle de dibujo sigue con 1 solo shadowBlur', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN inicio: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
