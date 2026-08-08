// hitclaud — ARREGLO del home en computadora: un solo bloque a la vez (jugable XOR apagado), panel
// que se adapta al ancho (no atrapado en móvil), sin barras de desplazamiento propias, botón Ranking
// con borde completo, título que nunca se corta, y flechas siempre pulsables en el apagado.
// Verifica en Node (sin navegador). node test/homedesktop.test.js

const fs = require('fs');
const { crearApp } = require('./harness_dom.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; }; }
function appHome(hook) { return crearApp({ antesDeMain: function (w) { try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {} if (hook) hook(w); } }); }
function visibleJug(app) { return !app.byId['homeJugable'].classList.contains('oculto'); }
function visibleApag(app) { return !app.byId['homeNoJugable'].classList.contains('oculto'); }
function nombre(app) { return app.byId['durJuego'].textContent; }

console.log('=== ARREGLO 1 — UN SOLO HOME A LA VEZ (jugable XOR apagado) ===');
{
  // La REGLA que lo garantiza: los cuerpos usan display:flex por ID; sin el compuesto #X.oculto la
  // .oculto (clase) NO los ocultaba y se veían LOS DOS. Con el compuesto, ocultar gana.
  chk('CSS: #homeJugable.oculto y #homeNoJugable.oculto se ocultan (compuesto que vence al ID)', /#homeJugable\.oculto, #homeNoJugable\.oculto \{ display: none; \}/.test(css));

  // Comportamiento: en CADA juego, exactamente UNO de los dos cuerpos NO tiene .oculto.
  const app = appHome(); // escritorio
  const juegos = ['hitclaud', 'shotclaud', 'pushclaud'];
  let siempreUno = true;
  for (let i = 0; i < 3; i++) {
    const unoSolo = visibleJug(app) !== visibleApag(app); // XOR: exactamente uno visible
    if (!unoSolo) siempreUno = false;
    app.byId['homeIzq'].dispatch('click'); // cicla
  }
  chk('en escritorio, SIEMPRE hay exactamente un cuerpo sin .oculto (nunca los dos)', siempreUno);

  const appM = appHome(tactil); // móvil
  let siempreUnoM = true;
  for (let i = 0; i < 3; i++) { if (visibleJug(appM) === visibleApag(appM)) siempreUnoM = false; appM.byId['homeIzq'].dispatch('click'); }
  chk('en móvil, SIEMPRE hay exactamente un cuerpo sin .oculto (regresión: no se rompe)', siempreUnoM);
}

console.log('=== ARREGLO 1 — Cuando el juego NO está disponible, el ENCENDIDO está oculto ===');
{
  const app = appHome(); // escritorio → Hitcloude (táctil) NO disponible
  chk('Hitcloude en escritorio: apagado visible y ENCENDIDO oculto', visibleApag(app) && !visibleJug(app) && app.byId['homeJugable'].classList.contains('oculto'));
  app.byId['homeIzq'].dispatch('click'); // → Shotcloude (jugable en escritorio)
  chk('Shotcloude en escritorio: encendido visible y APAGADO oculto', visibleJug(app) && !visibleApag(app) && app.byId['homeNoJugable'].classList.contains('oculto'));
}

console.log('=== ARREGLO 2 — El panel se ADAPTA (ancho máximo cómodo), no un ancho fijo ===');
{
  const bloque = css.slice(css.indexOf('.go-panel.home-panel {'), css.indexOf('}', css.indexOf('.go-panel.home-panel {')));
  chk('declara un ancho máximo cómodo (max-width: 440px) y se adapta (width: min(100%, 440px))', /max-width: 440px/.test(bloque) && /width: min\(100%, 440px\)/.test(bloque));
  chk('ya NO está clavado en el ancho de móvil (sin max-width: 402px)', !/max-width: 402px/.test(bloque));
  chk('el relleno lateral es proporcional acotado (clamp), no un % puro ni px fijos', /padding: 44px clamp\(20px, 6vw, 34px\)/.test(bloque));
}

console.log('=== ARREGLO 3 — Sin desplazamiento propio del panel; sólo el cuerpo si no cupiera, cabecera fija ===');
{
  const panel = css.slice(css.indexOf('.go-panel.home-panel {'), css.indexOf('}', css.indexOf('.go-panel.home-panel {')));
  chk('el PANEL no declara scroll propio (overflow: hidden; es columna flex)', /overflow: hidden/.test(panel) && /display: flex/.test(panel) && /flex-direction: column/.test(panel));
  chk('la CABECERA queda fija (flex: 0 0 auto)', /\.home-nav \{[\s\S]{0,80}flex: 0 0 auto/.test(css));
  chk('sólo .home-cuerpo se desplaza si hiciera falta (overflow-y: auto, min-height: 0)', /\.home-cuerpo \{[\s\S]{0,160}overflow-y: auto[\s\S]{0,80}/.test(css) && /\.home-cuerpo \{[\s\S]{0,160}min-height: 0/.test(css));
  chk('el HTML envuelve el cuerpo (home-cuerpo) dejando la cabecera fuera', /home-nav[\s\S]*?<\/div>\s*<!--[\s\S]*?<div class="home-cuerpo">[\s\S]*?id="homeJugable"/.test(html) && /id="verActualizaciones"[\s\S]{0,80}<\/div><!-- \/\.home-cuerpo -->/.test(html));
}

console.log('=== ARREGLO 5 — El título del juego NUNCA se corta (cabe entero en cualquier ancho) ===');
{
  const t = css.slice(css.indexOf('.home-juego {'), css.indexOf('}', css.indexOf('.home-juego {')));
  chk('el título va en UNA sola línea (white-space: nowrap)', /white-space: nowrap/.test(t));
  chk('el tamaño se calcula desde el ancho de la cabecera (cqi) con tope 48px → siempre cabe', /font-size: clamp\(26px, calc\(\(100cqi - 110px\) \/ 5\.5\), 48px\)/.test(t));
  chk('la cabecera es contenedor de consulta (container-type: inline-size) para medir el ancho real', /\.home-nav \{[\s\S]{0,200}container-type: inline-size/.test(css));
}

console.log('=== ARREGLO 6 — El botón Ranking: borde completo de 1px, ancho del panel, esquinas 6px ===');
{
  const r = css.slice(css.indexOf('.home-ranking, .home-dur {'), css.indexOf('}', css.indexOf('.home-ranking, .home-dur {')));
  chk('borde completo de 1px rodeando el contenido', /border: 1px solid var\(--home-acento/.test(r));
  chk('ancho completo del panel (width: 100%) con box-sizing correcto', /width: 100%/.test(r) && /box-sizing: border-box/.test(r));
  chk('esquinas de 6px', /border-radius: 6px/.test(r));
  chk('icono y texto dentro, centrados (flex + center)', /display: flex/.test(r) && /align-items: center/.test(r) && /justify-content: center/.test(r));
}

console.log('=== ARREGLO 7 — Las flechas siguen pulsables y visibles en el home APAGADO ===');
{
  // Las flechas viven en la cabecera (fuera de #homeNoJugable): nunca se ocultan con el cuerpo.
  chk('las flechas están en la cabecera, fuera de #homeNoJugable', /home-nav[\s\S]*?id="homeIzq"[\s\S]*?id="homeDer"[\s\S]*?<div class="home-cuerpo"/.test(html));
  chk('son <button> reales (pulsables), no divs', /<button id="homeIzq" class="hdr-icono home-flecha"/.test(html) && /<button id="homeDer" class="hdr-icono home-flecha"/.test(html));

  // Comportamiento: desde un home APAGADO (Hitcloude en escritorio), las flechas cambian de juego.
  const app = appHome(); // Hitcloude apagado
  chk('parte de un home apagado (Hitcloude en escritorio)', visibleApag(app) && nombre(app) === 'Hitcloude');
  app.byId['homeIzq'].dispatch('click');
  chk('izquierda avanza desde el apagado (→ Shotcloude)', nombre(app) === 'Shotcloude');
  app.byId['homeDer'].dispatch('click');
  chk('derecha retrocede (→ Hitcloude), ciclo en ambas direcciones', nombre(app) === 'Hitcloude');
}

console.log(`\n== RESUMEN home-desktop: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
