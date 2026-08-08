// hitclaud — PUSHCLOUDE v2.9: aplastar con el dedo. Puntuación pura (js/pushclaud.js) + comportamiento
// del juego (toque al centro/fuera/vacío, ciclo de metas, rojo reinicia la partida, récord sólo por
// tiempo). node test/pushcloude.test.js

const fs = require('fs');
const PU = require('../js/pushclaud.js');
const P = require('../js/puntuacion.js');
const S = require('../js/shotclaud.js');
const { crearApp } = require('./harness_dom.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener() {}, addEventListener() {}, media: q }; }; }

console.log('=== PURO — Toque al CENTRO: 200 × racha, sube la racha (misma progresión que Hitcloude) ===');
{
  const m = PU.crearMarcador();
  const r1 = PU.anotarCentro(m);
  chk('1.er centro: 200×1, racha 1', r1.ganancia === 200 && r1.mult === 1 && m.racha === 1 && m.puntos === 200);
  PU.anotarCentro(m); // racha 2 (×1)
  const r3 = PU.anotarCentro(m); // racha 3 → ×1.2
  chk('3.er centro: 200×1.2 = 240 (progresión de Hitcloude)', r3.mult === P.multRacha(3) && r3.ganancia === Math.round(200 * P.multRacha(3)));
  chk('la racha usa EXACTAMENTE P.multRacha (una sola economía, 3.6)', PU.multRacha(5) === P.multRacha(5) && PU.multRacha(22) === P.multRacha(22));
}

console.log('=== PURO — La racha llega a ×5 con la misma progresión que Hitcloude (3.6) ===');
{
  const m = PU.crearMarcador();
  for (let i = 0; i < 22; i++) PU.anotarCentro(m);
  chk('a los 22 centros seguidos, ×5 (tope, como Hitcloude)', PU.multRacha(m.racha) === 5 && PU.RACHA_TOPE === 5);
  for (let i = 0; i < 10; i++) PU.anotarCentro(m);
  chk('no supera ×5', PU.multRacha(m.racha) === 5);
}

console.log('=== PURO — FUERA del centro: 50 sin multiplicar, rompe racha; VACÍO: resta y rompe racha ===');
{
  const m = PU.crearMarcador(); PU.anotarCentro(m); PU.anotarCentro(m); PU.anotarCentro(m); // racha 3
  const antes = m.puntos;
  const rl = PU.anotarLateral(m);
  chk('FUERA: +50 sin multiplicar y la racha se ROMPE (3.4)', rl.ganancia === 50 && m.puntos === antes + 50 && m.racha === 0);
  const m2 = PU.crearMarcador(); m2.puntos = 30; m2.racha = 4;
  const rf = PU.anotarFallo(m2);
  chk('VACÍO: resta 50, rompe racha (3.5)', rf.castigo === 50 && m2.racha === 0);
  chk('el marcador NUNCA baja de cero (3.7)', m2.puntos === 0);
}

console.log('=== PURO — CICLO de metas de 15 s (1000): conserva si cumple, reinicia si no; meta fija (4) ===');
{
  chk('meta 1000 y ciclo 15 s en UN solo sitio (4.6)', PU.META_PUNTOS === 1000 && PU.CICLO_MS === 15000);
  const m = PU.crearMarcador(); m.puntos = 1200;
  const c1 = PU.cerrarCiclo(m, 0);
  chk('con ≥1000 al cerrar: conserva puntos y el nuevo base = puntos (sigue acumulando, 4.2)', c1.cumplida === true && c1.base === 1200 && m.puntos === 1200);
  const m2 = PU.crearMarcador(); m2.puntos = 600; m2.racha = 5;
  const c2 = PU.cerrarCiclo(m2, 0);
  chk('con <1000 al cerrar: puntos y racha a 0 (4.3), base 0', c2.cumplida === false && m2.puntos === 0 && m2.racha === 0 && c2.base === 0);
  // La meta se mide sobre lo GANADO desde el base, no el total: la exigencia no sube (4.2).
  const m3 = PU.crearMarcador(); m3.puntos = 1500;
  chk('progreso/meta se miden sobre lo ganado desde el base', PU.progresoCiclo(m3, 1000) === 500 && !PU.metaCumplida(m3, 1000) && PU.metaCumplida(m3, 400));
}

console.log('=== PURO — La zona central REUTILIZA la geometría de Shotcloude sin cambiarla (3.1) ===');
{
  const t = { x: 400, y: 300, rot: 0, cols: 7, filas: 6 };
  chk('enZonaCentral delega en S.enZonaCentral', PU.enZonaCentral(t, 400, 300) === S.enZonaCentral(t, 400, 300) && PU.enZonaCentral(t, 400, 300) === true);
  chk('el cuarto central: dentro el centro, fuera un borde', PU.enZonaCentral(t, 410, 300) === true && PU.enZonaCentral(t, 400 + 20, 300) === false);
}

// ── Comportamiento en el juego (harness). Pushcloude es táctil + acceso anticipado. ──
// NOTA: nuevoTarget() lanza al target (lanzarPush) DESPUÉS de crearTarget, así que no se puede fijar
// su posición desde el wrap. Se captura el ref y se MUEVE el target VIVO al centro (es el mismo objeto
// del juego) para poder tocarlo con precisión; los demás se apartan de la zona del toque.
function appPush() {
  const cap = { puntaje: [], partida: [], caps: [] };
  const app = crearApp({ antesDeMain: function (w) {
    tactil(w);
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    try { w.localStorage.setItem('hitclaud.acceso.v1', '1'); } catch (e) {} // acceso anticipado
    const Rk = w.Ranking;
    Rk.enviarPuntaje = function (o) { cap.puntaje.push(o); return Promise.resolve({ estado: 'ok', entro: false }); };
    Rk.enviarPartida = function (d) { cap.partida.push(d); };
    Rk.pedirTop = function () { return Promise.resolve({ ok: true, top: [] }); };
    const F = w.Fisica, crt = F.crearTarget;
    F.crearTarget = function () { const t = crt.apply(this, arguments); cap.caps.push(t); return t; };
  } });
  app._cap = cap;
  return app;
}
function score(app) { return app.byId['barraActual'].textContent; }
function ocultoDur(app) { return app.byId['duracion'].classList.contains('oculto'); }
function ocultoFin(app) { return app.byId['gameover'].classList.contains('oculto'); }
// Trae al centro (400,300), CONGELADO, el primer target (rojo o no, según `rojo`) vivo y ya entrado;
// aparta a los demás para que un toque en (400,300) sólo lo alcance a él. Devuelve el target.
function traerAlCentro(app, rojo) {
  let tg = null;
  for (let i = 0; i < 900 && !tg; i++) { app.step(16); tg = app._cap.caps.find(function (t) { return (!!t.rojo === !!rojo) && t.viva !== false && t.haEntrado && t.x > -9000; }); }
  if (tg) {
    app._cap.caps.forEach(function (t) { if (t !== tg) { t.x = -99999; t.y = -99999; } });
    tg.x = 400; tg.y = 300; tg.vx = 0; tg.vy = 0; tg.gravedad = 1e-9; tg.rot = 0; tg.velRot = 0;
  }
  return tg;
}

console.log('=== JUEGO — Toque al CENTRO destruye entero (200); BORDE arranca ≥ la mitad, el resto sigue ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const tg = traerAlCentro(app, false);
  chk('salió un target 7×6 y se trajo al centro', !!tg && tg.cols === 7 && tg.filas === 6);
  app.disparar(400, 300); // CENTRO exacto
  chk('CENTRO: destruye el target ENTERO (vivos 0) y suma 200', !!tg && tg.vivos === 0 && score(app) === '200');

  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  const t2 = traerAlCentro(app2, false);
  const vivosAntes = t2.vivosMax, gAntes = t2.gravedad, vxAntes = t2.vx;
  app2.disparar(420, 300); // BORDE (20px > cuarto central 14px, dentro del target)
  const arrancadas = vivosAntes - t2.vivos;
  chk('BORDE: arranca AL MENOS la mitad de las celdas (radio 55%, 3.2)', arrancadas >= Math.ceil(vivosAntes / 2) && t2.vivos > 0);
  chk('BORDE: suma 50 sin multiplicar (3.4)', score(app2) === '50');
  chk('BORDE: el resto SIGUE SU RUTA — NO se desploma (gravedad y horizontal intactas, 3.3)', t2.gravedad === gAntes && t2.vx === vxAntes);
}

console.log('=== JUEGO — Toque al VACÍO resta; el medidor se dibuja en el canvas (no captura) ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const tg = traerAlCentro(app, false);
  app.disparar(400, 300);          // centro (+200)
  app.disparar(40, 570);           // vacío, lejos de todo (resta 50)
  chk('VACÍO: resta (200 → 150)', !!tg && score(app) === '150');
  chk('el medidor de efectividad se dibuja en el canvas (no captura toques, 3.8)', /esPush\(\)\) \{[\s\S]{0,120}dibujarMedidorShot\(\)/.test(main));
}

console.log('=== JUEGO — Tocar un ROJO reinicia la partida (no termina): puntos a 0, sin salir, sin enviar ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const rojo = traerAlCentro(app, true);
  chk('apareció un rojo tocable', !!rojo);
  if (rojo) app.disparar(400, 300);  // toca el rojo → REINICIO de la partida
  chk('tras tocar el rojo: puntos a 0 y NO se sale de la pantalla (home/fin ocultos, 5.4)', score(app) === '0' && ocultoDur(app) && ocultoFin(app));
  for (let i = 0; i < 45; i++) app.step(32); // cuenta atrás (flash 320 + 3×260 ≈ 1100ms)
  chk('la partida sigue en curso tras la cuenta atrás (no fin, no home)', ocultoDur(app) && ocultoFin(app));
  chk('la partida reiniciada por rojo NO guarda récord ni se envía (5.5)', app._cap.puntaje.length === 0 && app._cap.partida.length === 0 && (app.mem.get('hitclaud.record.v4.pushclaud.60') == null || JSON.parse(app.mem.get('hitclaud.record.v4.pushclaud.60')).record === 0));
}

console.log('=== CAMBIO 1/2 — El hitmaker NO se dibuja en Pushcloude (sí en Hitcloude); la zona central YA NO se dibuja ===');
{
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
  chk('CSS oculta el hitmaker en Pushcloude (.juego-push .hitmaker { display: none })', /\.juego-push \.hitmaker \{ display: none; \}/.test(css));
  chk('main.js marca <html>.juego-push SÓLO al jugar Pushcloude, y lo quita en el home', /classList\.toggle\('juego-push', juego === 'pushclaud'\)/.test(main) && /classList\.remove\('juego-push'\)/.test(main));
  chk('la zona central YA NO se dibuja (sin el roundRect del cuarto central en dibujarSpriteTarget)', !/roundRect\(-hw, -hh, hw \* 2, hh \* 2/.test(main));
  // Comportamiento: en Pushcloude el <html> lleva juego-push; en Hitcloude no (el hitmaker se ve).
  const push = appPush(); push.irAJuego('pushclaud'); push.jugar('60'); push.step(16);
  chk('jugando Pushcloude: <html> tiene la clase juego-push (hitmaker oculto)', push.document.documentElement.classList.contains('juego-push'));
  const hit = crearApp({ antesDeMain: function (w) { tactil(w); try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {} } });
  hit.jugar('15'); hit.step(16); // Hitcloude (arranca aquí) en móvil
  chk('jugando Hitcloude: <html> NO tiene juego-push (el hitmaker se dibuja)', !hit.document.documentElement.classList.contains('juego-push'));
}

console.log('=== CAMBIO 4/5 — Los targets cruzan ENTEROS y transitan por la banda central (65%) ===');
{
  // Recorre una partida y comprueba que NINGÚN target vivo/entrado sale de la banda ni cruza la barra.
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const H = app.window.innerHeight;                 // 600 en el arnés
  const margen = 0.175, r = Math.max(7, 6) * 4;     // 65% central → 0.175 arriba/abajo; semi-tamaño
  const barra = 58;
  let fueraBanda = 0, cruzaBarra = 0, vistos = 0;
  for (let i = 0; i < 500; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) {
      if (t.viva === false || !t.haEntrado || t.x < -9000) return; // ignora muertos / apartados
      if (Math.abs(t.x) > 99000) return;
      vistos++;
      if (t.y < H * margen - 1 || t.y > H * (1 - margen) + 1) fueraBanda++; // centro fuera de la banda
      if (t.y - r < barra) cruzaBarra++;                                    // la forma toca la franja de la barra
    });
  }
  chk('se observaron targets en juego', vistos > 20);
  chk('NINGÚN target sale del 65% central de la altura (5.1)', fueraBanda === 0);
  chk('NINGÚN target cruza por la franja de la barra (5.3)', cruzaBarra === 0);
  chk('FUENTE: lanzarPush entra por un borde lateral, gravedad ~0 (recta) → cruza entero (4/4.2)', /function lanzarPush\(t\) \{[\s\S]{0,600}t\.x = desdeIzq \? -\(r \+ 8\) : W \+ \(r \+ 8\);[\s\S]{0,320}t\.gravedad = 1e-9;/.test(main));
  chk('FUENTE: la pendiente vertical se acota a la banda (5.4) y el 65% es constante (5.5)', /const vyMax = \(holgura \/ cruce\) \* PUSH\.ANG_FRAC;/.test(main) && /BANDA_FRAC: 0\.65/.test(main));
}

console.log('=== FUENTE — Rojo reinicia puntos/racha/ciclo/reloj; sólo el tiempo guarda récord; sin envío ===');
{
  chk('el toque a un rojo enruta a reinicioPorRojoPush (no a golpeCloudover/terminarPartida)', /if \(tg\.rojo\) \{ reinicioPorRojoPush\(tg, mx, my\); return; \}/.test(main));
  chk('reinicioPorRojoPush pone puntos y racha a 0 y arranca la máquina de reinicio', /function reinicioPorRojoPush[\s\S]{0,500}marcador\.puntos = 0; marcador\.racha = 0;[\s\S]{0,200}pushReset = \{ modo: 'reinicio'/.test(main));
  chk('al terminar la cuenta: reinicia estado, RELOJ de partida y ciclo (sin terminarPartida)', /pushReset = null;\s*reiniciarEstado\(\);[\s\S]{0,120}tiempoRestante = DURACIONES\[modoJuego\] \|\| 0;[\s\S]{0,120}pushCicloBase = 0; pushCicloRestante = PU\.CICLO_MS/.test(main));
  chk('sólo el fin por TIEMPO guarda récord (record.terminar en terminarPartida)', /function terminarPartida\(porTiempo\)[\s\S]{0,1600}record\.terminar\(scoreFinal, ahora, cuentaRecord\)/.test(main));
  chk('Pushcloude NO envía al servidor todavía (envío inactivo, 9.5)', /if \(esPush\(\)\) return;/.test(main) && /servidor sólo acepta 'pushclaud:15'/.test(main));
}

console.log(`\n== RESUMEN pushcloude: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
