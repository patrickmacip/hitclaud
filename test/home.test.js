// hitclaud — COMPORTAMIENTO del home único (rediseño v2.7): arranca en Hitcloude, las flechas ciclan
// en ambas direcciones sin fin, un juego no disponible se ve APAGADO con su LÍNEA DE ESTADO (nada
// pulsable salvo flechas), "Próximamente" manda sobre la plataforma, los botones de duración SON la
// acción de jugar (ya no hay botón JUGAR), y la casa/fin vuelven al home del juego. node test/home.test.js

const { crearApp } = require('./harness_dom.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
// El home sólo se muestra al arrancar si YA hay nombre (si no, sale la pantalla de nombre).
function appHome(hook) {
  return crearApp({ antesDeMain: function (w) { try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {} if (hook) hook(w); } });
}
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; }; }
function nombre(app) { return app.byId['durJuego'].textContent; }
function jugable(app) { return !app.byId['homeJugable'].classList.contains('oculto') && app.byId['homeNoJugable'].classList.contains('oculto'); }
function estado(app) { return app.byId['homeEstado'].textContent; } // línea de estado del home apagado
function apagado(app) { return app.byId['duracion'].classList.contains('home-apagado'); }

console.log('=== Arranque: SIEMPRE en el home de Hitcloude (nombre visible) ===');
{
  const app = appHome(); // escritorio por defecto (matchMedia pointer:fine)
  chk('el home abre en Hitcloude (nombre visible, CAMBIO 1)', nombre(app) === 'Hitcloude');
  chk('el overlay del home (#duracion) está visible; no hay #inicio', !app.byId['duracion'].classList.contains('oculto'));
  // Hitcloude es táctil → en ESCRITORIO no está disponible: cuerpo APAGADO con línea de estado.
  chk('Hitcloude en escritorio NO es jugable: cuerpo apagado', !jugable(app) && apagado(app));
  chk('la línea de estado dice "Disponible en móvil"', estado(app) === 'Disponible en móvil');
}

console.log('=== Las flechas CICLAN en ambas direcciones, sin fin ===');
{
  const app = appHome();
  const izq = app.byId['homeIzq'];
  chk('desde Hitcloude, izquierda → Shotcloude', (izq.dispatch('click'), nombre(app) === 'Shotcloude'));
  chk('desde Shotcloude, izquierda → Pushcloude', (izq.dispatch('click'), nombre(app) === 'Pushcloude'));
  chk('desde Pushcloude, izquierda → Hitcloude (cicla, no se acaba)', (izq.dispatch('click'), nombre(app) === 'Hitcloude'));
  const der = app.byId['homeDer'];
  chk('desde Hitcloude, derecha → Pushcloude (a la inversa)', (der.dispatch('click'), nombre(app) === 'Pushcloude'));
  chk('desde Pushcloude, derecha → Shotcloude', (der.dispatch('click'), nombre(app) === 'Shotcloude'));
  chk('desde Shotcloude, derecha → Hitcloude (cicla sin fin)', (der.dispatch('click'), nombre(app) === 'Hitcloude'));
}

console.log('=== Disponibilidad por plataforma + "Próximamente" manda (CAMBIO 4.2) ===');
{
  const app = appHome(); // ESCRITORIO
  app.byId['homeIzq'].dispatch('click'); // → Shotcloude
  chk('Shotcloude en escritorio SÍ es jugable (cuerpo con botones de duración)', nombre(app) === 'Shotcloude' && jugable(app));
  app.byId['homeIzq'].dispatch('click'); // → Pushcloude
  chk('Pushcloude NO es jugable (sin terminar): apagado', nombre(app) === 'Pushcloude' && !jugable(app));
  chk('la línea de estado de Pushcloude es "Próximamente" (manda sobre la plataforma)', estado(app) === 'Próximamente');
}
{
  // En TÁCTIL: Hitcloude jugable; Shotcloude "Disponible en pc y mac".
  const app = appHome(tactil);
  chk('Hitcloude en móvil SÍ es jugable', nombre(app) === 'Hitcloude' && jugable(app));
  app.byId['homeIzq'].dispatch('click'); // → Shotcloude
  chk('Shotcloude en móvil NO es jugable: "Disponible en pc y mac"', nombre(app) === 'Shotcloude' && !jugable(app) && estado(app) === 'Disponible en pc y mac');
}

console.log('=== Los botones de DURACIÓN son la acción de jugar (CAMBIO 2) ===');
{
  const app = appHome(tactil); // Hitcloude jugable (15/60)
  const modos = app.byId['durModos'].children;
  chk('Hitcloude ofrece dos botones de duración (15 y 60)', modos.length === 2);
  chk('los botones dicen la duración completa en palabras ("15 Segundos"/"60 Segundos", 2.4)',
    modos[0].textContent === '15 Segundos' && modos[1].textContent === '60 Segundos');
  // Tocar "60 Segundos" arranca una partida de 60 s (2.2).
  app.jugar('60');
  app.step(32);
  chk('tocar "60 Segundos" arrancó la partida (home oculto)', app.byId['duracion'].classList.contains('oculto'));
}

console.log('=== Cambiar de juego reconstruye los botones de duración de ese juego ===');
{
  const app = appHome(tactil);
  chk('Hitcloude: dos botones (15/60)', app.byId['durModos'].children.length === 2);
  app.byId['homeIzq'].dispatch('click'); // → Shotcloude (apagado en táctil, sin botones)
  app.byId['homeDer'].dispatch('click'); // ← Hitcloude otra vez
  const modos = app.byId['durModos'].children;
  chk('al volver a Hitcloude, sus botones se reconstruyen (15 primero, la más corta)',
    modos.length === 2 && modos[0]._attrs['data-dur'] === '15');
}

console.log('=== La casa durante la partida vuelve al HOME de su juego ===');
{
  const app = appHome(); // escritorio → Shotcloude es jugable
  app.byId['homeIzq'].dispatch('click'); // → Shotcloude (jugable)
  app.jugar();                            // botón de duración = jugar
  app.step(32);
  chk('la partida arrancó (home oculto)', app.byId['duracion'].classList.contains('oculto'));
  app.byId['botonSalir'].dispatch('click'); // casa → abandona
  chk('la casa devuelve al HOME de Shotcloude (no a un menú)', !app.byId['duracion'].classList.contains('oculto') && nombre(app) === 'Shotcloude');
}

console.log(`\n== RESUMEN home: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
