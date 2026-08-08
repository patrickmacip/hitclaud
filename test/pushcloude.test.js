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
// NOTA: nuevoTarget() para Pushcloude llama aplicarMovimientoPush() DESPUÉS de crearTarget (multiplica
// y ROTA la velocidad). Por eso, para dejar un target QUIETO, se pone vx=vy=0 en el wrap: rotar 0 da 0.
function appPush(opts) {
  opts = opts || {};
  const cap = { puntaje: [], partida: [], caps: [] };
  let primero = true;
  const app = crearApp({ antesDeMain: function (w) {
    tactil(w);
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    try { w.localStorage.setItem('hitclaud.acceso.v1', '1'); } catch (e) {} // acceso anticipado
    const Rk = w.Ranking;
    Rk.enviarPuntaje = function (o) { cap.puntaje.push(o); return Promise.resolve({ estado: 'ok', entro: false }); };
    Rk.enviarPartida = function (d) { cap.partida.push(d); };
    Rk.pedirTop = function () { return Promise.resolve({ ok: true, top: [] }); };
    const F = w.Fisica, crt = F.crearTarget, cep = F.celdaEnPunto;
    F.crearTarget = function () {
      const t = crt.apply(this, arguments);
      if (opts.unTarget && primero) { primero = false; t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; t.rot = 0; t.velRot = 0; t.haEntrado = true; } // el ÚNICO tocable, QUIETO
      else if (opts.unTarget) { t.x = -9999; t.y = -9999; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; t.haEntrado = false; } // fuera: no molesta
      cap.caps.push(t);
      return t;
    };
    if (opts.soloRojo) F.celdaEnPunto = function (t) { if (t && !t.rojo) return -1; return cep.apply(this, arguments); }; // sólo los rojos son "tocables"
  } });
  app._cap = cap;
  return app;
}
function score(app) { return app.byId['barraActual'].textContent; }
function ocultoDur(app) { return app.byId['duracion'].classList.contains('oculto'); }
function ocultoFin(app) { return app.byId['gameover'].classList.contains('oculto'); }

console.log('=== JUEGO — Toque al CENTRO destruye y suma 200; FUERA suma 50 y el resto SIGUE su ruta ===');
{
  const app = appPush({ unTarget: true });
  app.irAJuego('pushclaud'); app.jugar('60');
  let tg = null; for (let i = 0; i < 20 && !tg; i++) { app.step(16); if (app._cap.caps.length) tg = app._cap.caps[0]; }
  chk('arrancó Pushcloude (home oculto) y salió un target 7×6', ocultoDur(app) && !!tg && tg.cols === 7 && tg.filas === 6);
  app.disparar(400, 300); // toque al CENTRO exacto
  chk('CENTRO: destruye el target entero (vivos 0) y suma 200', tg.vivos === 0 && score(app) === '200');

  const app2 = appPush({ unTarget: true });
  app2.irAJuego('pushclaud'); app2.jugar('60');
  let t2 = null; for (let i = 0; i < 20 && !t2; i++) { app2.step(16); if (app2._cap.caps.length) t2 = app2._cap.caps[0]; }
  const gAntes = t2.gravedad, vxAntes = t2.vx;
  app2.disparar(420, 300); // toque FUERA del centro (20px > cuarto central de 14px, dentro del target)
  chk('FUERA: suma 50 (sin multiplicar) y el target SOBREVIVE', score(app2) === '50' && t2.vivos > 0 && app2._cap.caps.length === 1);
  chk('FUERA: el resto SIGUE SU RUTA — NO se desploma (gravedad y horizontal intactas, 3.4)', t2.gravedad === gAntes && t2.vx === vxAntes);
}

console.log('=== JUEGO — Toque al VACÍO resta; el medidor cuenta toques y no captura (canvas) ===');
{
  const app = appPush({ unTarget: true });
  app.irAJuego('pushclaud'); app.jugar('60');
  for (let i = 0; i < 6; i++) app.step(16);
  // Sube algo de puntaje con un centro y luego falla al vacío.
  app.disparar(400, 300);          // centro (+200)
  app.disparar(50, 50);            // vacío (resta 50)
  chk('VACÍO: resta (200 → 150)', score(app) === '150');
  chk('el medidor de efectividad se dibuja en el canvas (no captura toques, 3.8)', /esPush\(\)\) \{[\s\S]{0,120}dibujarMedidorShot\(\)/.test(main));
}

console.log('=== JUEGO — Tocar un ROJO reinicia la partida (no termina): puntos a 0, sin salir, sin enviar ===');
{
  const app = appPush({ soloRojo: true }); // targets vuelan natural (dejan lugar para rojos); sólo el rojo es tocable
  app.irAJuego('pushclaud'); app.jugar('60');
  // Avanza hasta que exista un ROJO vivo y ya entrado (soloRojo hace que sólo él sea tocable).
  let rojo = null;
  for (let i = 0; i < 800 && !rojo; i++) { app.step(16); rojo = app._cap.caps.find(function (t) { return t.rojo && t.viva !== false && t.haEntrado; }); }
  chk('apareció un rojo tocable', !!rojo);
  if (rojo) app.disparar(rojo.x, rojo.y);  // toca el rojo → REINICIO de la partida
  chk('tras tocar el rojo: puntos a 0 y NO se sale de la pantalla (home/fin ocultos, 5.4)', score(app) === '0' && ocultoDur(app) && ocultoFin(app));
  // Corre la cuenta atrás (flash 320 + 3×260 ≈ 1100ms) y arranca la partida nueva.
  for (let i = 0; i < 45; i++) app.step(32);
  chk('la partida sigue en curso tras la cuenta atrás (no fin, no home)', ocultoDur(app) && ocultoFin(app));
  chk('la partida reiniciada por rojo NO guarda récord ni se envía (5.5)', app._cap.puntaje.length === 0 && app._cap.partida.length === 0 && (app.mem.get('hitclaud.record.v4.pushclaud.60') == null || JSON.parse(app.mem.get('hitclaud.record.v4.pushclaud.60')).record === 0));
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
