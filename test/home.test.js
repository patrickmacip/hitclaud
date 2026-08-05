// hitclaud — COMPORTAMIENTO del home único: arranca en HitClaud, las flechas ciclan en ambas
// direcciones sin fin, un juego no disponible muestra imagen+leyenda (nada pulsable salvo
// flechas), "Pronto" manda sobre la plataforma, cambiar de juego reinicia la duración, y la
// casa/fin vuelven al home del juego. Carga js/main.js en un DOM simulado. node test/home.test.js

const { crearApp } = require('./harness_dom.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
// El home sólo se muestra al arrancar si YA hay nombre (si no, sale la pantalla de nombre).
// Sembramos el nombre antes de cargar main.js. `hook` opcional envuelve más antesDeMain.
function appHome(hook) {
  return crearApp({ antesDeMain: function (w) { try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {} if (hook) hook(w); } });
}
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; }; }
function nombre(app) { return app.byId['durJuego'].textContent; }
function jugable(app) { return !app.byId['homeJugable'].classList.contains('oculto') && app.byId['homeNoJugable'].classList.contains('oculto'); }
function leyenda(app) { return app.byId['homeLeyenda'].textContent; }

console.log('=== Arranque: SIEMPRE en el home de HitClaud (1.2) ===');
{
  const app = appHome(); // escritorio por defecto (matchMedia pointer:fine)
  chk('el home abre en HitClaud', nombre(app) === 'HitClaud');
  chk('el overlay del home (#duracion) está visible; no hay #inicio', !app.byId['duracion'].classList.contains('oculto'));
  // HitClaud es táctil → en ESCRITORIO no está disponible: imagen + leyenda, sin cuerpo jugable.
  chk('HitClaud en escritorio NO es jugable: muestra imagen + leyenda', !jugable(app));
  chk('la leyenda dice "Disponible solo en móvil" (con dignidad, no error)', leyenda(app) === 'Disponible solo en móvil');
}

console.log('=== Las flechas CICLAN en ambas direcciones, sin fin (2.3) ===');
{
  const app = appHome();
  // IZQUIERDA avanza: HitClaud → ShotClaud → PushClaud → HitClaud → …
  const izq = app.byId['homeIzq'];
  chk('desde HitClaud, izquierda → ShotClaud', (izq.dispatch('click'), nombre(app) === 'ShotClaud'));
  chk('desde ShotClaud, izquierda → PushClaud', (izq.dispatch('click'), nombre(app) === 'PushClaud'));
  chk('desde PushClaud, izquierda → HitClaud (cicla, no se acaba)', (izq.dispatch('click'), nombre(app) === 'HitClaud'));
  // DERECHA retrocede (a la inversa), también infinito.
  const der = app.byId['homeDer'];
  chk('desde HitClaud, derecha → PushClaud (a la inversa)', (der.dispatch('click'), nombre(app) === 'PushClaud'));
  chk('desde PushClaud, derecha → ShotClaud', (der.dispatch('click'), nombre(app) === 'ShotClaud'));
  chk('desde ShotClaud, derecha → HitClaud (cicla sin fin)', (der.dispatch('click'), nombre(app) === 'HitClaud'));
}

console.log('=== Disponibilidad por plataforma + "Pronto" manda (2.4/2.5/2.6) ===');
{
  const app = appHome(); // ESCRITORIO
  app.byId['homeIzq'].dispatch('click'); // → ShotClaud
  chk('ShotClaud en escritorio SÍ es jugable (cuerpo con JUGAR)', nombre(app) === 'ShotClaud' && jugable(app));
  app.byId['homeIzq'].dispatch('click'); // → PushClaud
  chk('PushClaud NO es jugable (sin terminar): imagen + leyenda', nombre(app) === 'PushClaud' && !jugable(app));
  chk('la leyenda de PushClaud es "Pronto" (manda sobre la plataforma, 2.6)', leyenda(app) === 'Pronto');
}
{
  // En TÁCTIL: HitClaud jugable; ShotClaud "Disponible solo en computadora".
  const app = appHome(tactil);
  chk('HitClaud en móvil SÍ es jugable', nombre(app) === 'HitClaud' && jugable(app));
  app.byId['homeIzq'].dispatch('click'); // → ShotClaud
  chk('ShotClaud en móvil NO es jugable: "Disponible solo en computadora"', nombre(app) === 'ShotClaud' && !jugable(app) && leyenda(app) === 'Disponible solo en computadora');
}

console.log('=== Cambiar de juego reinicia la duración a la más corta (4.4) ===');
{
  // En móvil, HitClaud (15/60) jugable: elegir 60, ir a otro juego y volver → vuelve a 15.
  const app = appHome(tactil);
  const b60 = app.byId['durModos'].children.find(function (x) { return x._attrs['data-dur'] === '60'; });
  chk('HitClaud ofrece 15 y 60', !!b60 && app.byId['durModos'].children.length === 2);
  if (b60) b60.dispatch('click'); // elige 60
  app.byId['homeIzq'].dispatch('click'); // → ShotClaud
  app.byId['homeDer'].dispatch('click'); // ← HitClaud otra vez
  const marcada = app.byId['durModos'].children.find(function (x) { return (x.className || '').indexOf('sel-activo') !== -1; });
  chk('al volver a HitClaud, la duración quedó en la MÁS CORTA (15)', !!marcada && marcada._attrs['data-dur'] === '15');
}

console.log('=== Navegación derivada: la casa durante la partida vuelve al HOME de su juego (4.1) ===');
{
  const app = appHome(); // escritorio → ShotClaud es jugable
  app.byId['homeIzq'].dispatch('click'); // → ShotClaud (jugable)
  app.byId['durJugar'].dispatch('click'); // inicia partida de ShotClaud
  app.step(32);
  chk('la partida arrancó (home oculto)', app.byId['duracion'].classList.contains('oculto'));
  app.byId['botonSalir'].dispatch('click'); // casa → abandona
  chk('la casa devuelve al HOME de ShotClaud (no a un menú)', !app.byId['duracion'].classList.contains('oculto') && nombre(app) === 'ShotClaud');
}

console.log(`\n== RESUMEN home: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
