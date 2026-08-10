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
  PU.anotarCentro(m); // racha 2 (×1.5)
  const r3 = PU.anotarCentro(m); // racha 3 → ×2.0
  chk('3.er centro: 200×2.0 = 400 (progresión de Hitcloude, CAMBIO 2)', r3.mult === P.multRacha(3) && r3.ganancia === Math.round(200 * P.multRacha(3)));
  chk('la racha usa EXACTAMENTE P.multRacha (una sola economía, 3.6)', PU.multRacha(5) === P.multRacha(5) && PU.multRacha(9) === P.multRacha(9));
}

console.log('=== PURO — La racha llega a ×5 al 9º centro, misma progresión que Hitcloude (3.6) ===');
{
  const m = PU.crearMarcador();
  for (let i = 0; i < 9; i++) PU.anotarCentro(m);
  chk('a los 9 centros seguidos, ×5 (tope, como Hitcloude)', PU.multRacha(m.racha) === 5 && PU.RACHA_TOPE === 5);
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
// Trae al centro (400,300), CONGELADO, el primer target del `tipo` pedido y aparta a los demás:
//   'normal'     = un target QUE CAE (no relámpago; ya no existen → null)
//   'relampago'  = relámpago NARANJA (ni rojo ni equis)
//   'equis'      = relámpago EQUIS
//   'rojo'       = relámpago ROJO
function traerAlCentro(app, tipo) {
  let tg = null;
  for (let i = 0; i < 1500 && !tg; i++) {
    app.step(16);
    tg = app._cap.caps.find(function (t) {
      if (!t.__enJuego || t.viva === false || !t.haEntrado || t.x < -9000) return false;
      if (tipo === 'normal') return !t.relampago;          // target que cae (ya no se generan)
      if (!t.relampago) return false;
      if (tipo === 'equis') return !!t.equis;
      if (tipo === 'rojo') return !!t.rojo;
      return !t.rojo && !t.equis;                           // 'relampago' = naranja
    });
  }
  if (tg) {
    app._cap.caps.forEach(function (t) { if (t !== tg) { t.x = -99999; t.y = -99999; } });
    tg.x = 400; tg.y = 300; tg.vx = 0; tg.vy = 0; tg.gravedad = 1e-9; tg.rot = 0; tg.velRot = 0;
  }
  return tg;
}

console.log('=== v3.4 CAMBIO 1 — Pushcloude es SÓLO RELÁMPAGO: no se genera ningún target que se mueva ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const norm = traerAlCentro(app, 'normal');   // busca 900 pasos un normal (de los que caían)
  chk('NO aparece ningún target normal que caiga: todo es relámpago (1.1/1.3)', !norm);
  // El toque al CENTRO de un relámpago lo destruye ENTERO y suma 200 (misma economía de centro).
  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  const rel = traerAlCentro(app2, 'relampago');
  chk('salió un relámpago 7×6 y se trajo al centro', !!rel && rel.cols === 7 && rel.filas === 6);
  if (rel) app2.disparar(400, 300);
  chk('CENTRO: destruye el relámpago ENTERO y suma 200', !!rel && score(app2) === '200');
  // La demolición del 55% (borde) y la generación de los que caen quedan INTACTAS en el código, para que
  // revertir este commit las devuelva completas (PROHIBIDO cambiar la demolición 55%; CAMBIO 1.2).
  chk('FUENTE: la demolición 55% (ARRANCA_FRAC) sigue intacta en aplastar (revert-safe)', /ARRANCA_FRAC: 0\.55,/.test(main) && /Math\.ceil\(tg\.vivos \* PUSH\.ARRANCA_FRAC\)/.test(main));
  chk('FUENTE: lanzarPush e intentarNormal siguen DEFINIDOS pero spawnPush ya NO los llama (revert-safe, 1.2)', /function lanzarPush\(t\)/.test(main) && /function intentarNormal\(now\)/.test(main) && !/if \(intentarNormal\(now\)\)/.test(main));
}

console.log('=== JUEGO — Toque al VACÍO resta y rompe racha (5.8); el medidor se dibuja en el canvas ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const tg = traerAlCentro(app, 'relampago');
  app.disparar(400, 300);          // relámpago al centro (+200)
  app.disparar(40, 570);           // vacío, lejos de todo (resta 50, 5.8)
  chk('VACÍO: resta (200 → 150)', !!tg && score(app) === '150');
  chk('el medidor de efectividad se dibuja en el canvas (no captura toques, 3.8)', /esPush\(\)\) \{[\s\S]{0,120}dibujarMedidorShot\(\)/.test(main));
}

console.log('=== v3.5 CAMBIO 5 — Tocar un ROJO DETIENE el juego y deja un target en el centro (reinicio manual) ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const rojo = traerAlCentro(app, 'rojo');       // un ROJO del sorteo (2.1)
  chk('apareció un ROJO y se trajo al centro', !!rojo && !!rojo.rojo);
  if (rojo) app.disparar(400, 300);              // toca el rojo → DETIENE el juego
  chk('tras tocar el rojo: puntos a 0 y NO se sale de la pantalla (home/fin ocultos, 5.2)', score(app) === '0' && ocultoDur(app) && ocultoFin(app));
  for (let i = 0; i < 20; i++) app.step(32);     // pasa el flash (~320ms) → ESPERA
  const esperaVivos = app._cap.caps.filter(function (t) { return t.espera && t.viva !== false && t.x > -9000; });
  chk('queda UN SOLO target de espera, quieto en el CENTRO (5.3)', esperaVivos.length === 1 && esperaVivos[0].x === 400 && esperaVivos[0].y === 300 && esperaVivos[0].vx === 0);
  for (let i = 0; i < 130; i++) app.step(32);    // ~4.1 s: mucho más que los 800ms de un relámpago
  const sigue = app._cap.caps.filter(function (t) { return t.espera && t.viva !== false && t.x > -9000; });
  chk('el target de espera NO caduca: sigue vivo tras ~4 s (5.4)', sigue.length === 1);
  app.disparar(400, 300);                        // tocarlo → PARTIDA NUEVA desde cero (5.5)
  let hayNuevos = false;
  for (let i = 0; i < 500 && !hayNuevos; i++) { app.step(16); hayNuevos = app._cap.caps.some(function (t) { return t.__enJuego && !t.espera && t.viva !== false && t.haEntrado && t.x > -9000; }); }
  chk('tocar el target de espera ARRANCA una partida nueva: reanuda el spawn (5.5)', hayNuevos);
  chk('la partida sigue en curso (no fin, no home)', ocultoDur(app) && ocultoFin(app));
  chk('el rojo NO guarda récord ni se envía (nunca termina la partida)', app._cap.puntaje.length === 0 && app._cap.partida.length === 0);
}

console.log('=== v3.5 CAMBIO 5.7 — Durante la espera, el STOP y la CASA funcionan (ninguna pantalla atrapa) ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const r1 = traerAlCentro(app, 'rojo'); if (r1) app.disparar(400, 300);
  for (let i = 0; i < 20; i++) app.step(32);     // en espera
  chk('en espera: el home está oculto (seguimos en el juego)', ocultoDur(app));
  app.byId['botonStop'].dispatch('click');       // STOP durante la espera
  for (let i = 0; i < 20; i++) app.step(32);      // pasa el flash del stop → home
  chk('el STOP durante la espera SALE al home (5.7)', !ocultoDur(app));

  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  const r2 = traerAlCentro(app2, 'rojo'); if (r2) app2.disparar(400, 300);
  for (let i = 0; i < 20; i++) app2.step(32);
  app2.byId['botonSalir'].dispatch('click');     // CASA durante la espera
  app2.step(16);
  chk('la CASA durante la espera vuelve al home (5.7)', !ocultoDur(app2));
  chk('FUENTE: se ELIMINÓ la cuenta atrás 3-2-1 (pushResetNumero) por no usarse (5.8)', !/pushResetNumero/.test(main) && !/PUSH_RESET_CUENTA_MS/.test(main));
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

console.log('=== v3.5 — Todo quieto, dentro del 45% central, entero en el ancho, nada bajo la barra ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const W = app.window.innerWidth, H = app.window.innerHeight; // 800×600 en el arnés
  const rRot = Math.hypot(7 * 4, 6 * 4);             // radio rotación-seguro (igual que la fuente)
  const barra = 58, margen = (1 - 0.45) / 2;         // 45% central → 0.275 arriba/abajo
  const bandaTop = H * margen, bandaBot = H * (1 - margen);
  let quietos = 0, movidos = 0, fueraAncho = 0, bajoBarra = 0, fuera45 = 0, vistos = 0;
  for (let i = 0; i < 500; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) {
      if (!t.__enJuego || t.viva === false || !t.haEntrado || t.x < -9000 || Math.abs(t.x) > 99000) return;
      vistos++;
      if (t.vx === 0 && t.vy === 0) quietos++; else movidos++;               // TODO aparece quieto
      if (t.x - rRot < -0.5 || t.x + rRot > W + 0.5) fueraAncho++;           // 4: entero dentro del ancho, ni rotado
      if (t.y - rRot < barra - 0.5) bajoBarra++;                             // 4: nada bajo la franja de la barra
      if (t.y - rRot < bandaTop - 0.5 || t.y + rRot > bandaBot + 0.5) fuera45++; // 1: dentro del 45% central
    });
  }
  chk('se observaron objetivos en juego', vistos > 20);
  chk('NADA se mueve: todos vx/vy 0 (sólo relámpagos quietos)', quietos > 0 && movidos === 0);
  chk('NINGÚN objetivo aparece fuera del 45% CENTRAL de la altura (CAMBIO 1)', fuera45 === 0);
  chk('NINGÚN objetivo asoma fuera del ancho, ni rotado (2/4)', fueraAncho === 0);
  chk('NINGÚN objetivo aparece bajo la franja de la barra (4)', bajoBarra === 0);
  chk('FUENTE: la franja de aparición usa el 45% central (BANDA_FRAC 0.45) centrado', /BANDA_FRAC: 0\.45,/.test(main) && /const margen = \(1 - PUSH\.BANDA_FRAC\) \/ 2;/.test(main) && /const top = Math\.max\(H \* margen, PUSH\.BARRA_PX\) \+ rRot;/.test(main) && /const bot = H \* \(1 - margen\) - rRot;/.test(main));
  chk('FUENTE: spawnPush sólo intenta RELÁMPAGO (no llama a intentarNormal)', /function spawnPush[\s\S]{0,900}intentarRelampago\(now\)/.test(main) && !/function spawnPush[\s\S]{0,900}intentarNormal\(/.test(main));
}

console.log('=== v3.5 CAMBIO 3 — Más aire: ≥450 ms entre apariciones y ≥2 anchos de separación ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const naceVistos = [], nacidos = [];
  for (let i = 0; i < 1500; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) { if (t.__enJuego && naceVistos.indexOf(t.__nace) === -1) { naceVistos.push(t.__nace); nacidos.push({ x: t.x, y: t.y, n: t.__nace }); } });
  }
  naceVistos.sort(function (a, b) { return a - b; });
  let minGap = Infinity;
  for (let k = 1; k < naceVistos.length; k++) minGap = Math.min(minGap, naceVistos[k] - naceVistos[k - 1]);
  chk('hubo varias apariciones', naceVistos.length > 8);
  chk('entre dos apariciones pasan al menos 450 ms (sube de 270 a 450, CAMBIO 3.1)', minGap >= 450);
  chk('FUENTE: SPAWN_MIN = 450 ms, un solo sitio', /SPAWN_MIN: 450,/.test(main));
  chk('FUENTE: separación mínima = SEP_ANCHOS anchos de target (CAMBIO 3.2), un solo sitio', /SEP_ANCHOS: 2,/.test(main) && /const minD = PUSH\.SEP_ANCHOS \* \(PUSH\.COLS \* 8\);/.test(main));
  chk('FUENTE: MAX_RELAMPAGOS sigue en 5', /MAX_RELAMPAGOS: 5,/.test(main));
}

console.log('=== v3.5 CAMBIO 3.2 — Dos targets nunca nacen a menos de DOS ANCHOS de distancia ===');
{
  // Recorre una partida y verifica que NINGÚN par de targets vivos está a menos de 2 anchos (COLS·8·2 = 112 px).
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const dosAnchos = 7 * 8 * 2;   // SEP_ANCHOS(2) · COLS(7) · 8
  let violaciones = 0, muestras = 0;
  for (let i = 0; i < 1200; i++) {
    app.step(16);
    const vivos = app._cap.caps.filter(function (t) { return t.__enJuego && t.viva !== false && t.haEntrado && t.x > -9000 && Math.abs(t.x) < 9000; });
    for (let a = 0; a < vivos.length; a++) for (let b = a + 1; b < vivos.length; b++) {
      muestras++;
      if (Math.hypot(vivos[a].x - vivos[b].x, vivos[a].y - vivos[b].y) < dosAnchos - 1e-6) violaciones++;
    }
  }
  chk('se observaron pares de targets vivos', muestras > 20);
  chk('NINGÚN par nace/convive a menos de 2 anchos de target (112 px, 3.2)', violaciones === 0);
}

console.log('=== FUENTE — Rojo reinicia puntos/racha/ciclo/reloj; sólo el tiempo guarda récord; sin envío ===');
{
  chk('el toque a un rojo enruta a reinicioPorRojoPush (no a golpeCloudover/terminarPartida)', /if \(tg\.rojo\) \{ reinicioPorRojoPush\(tg, mx, my\); return; \}/.test(main));
  chk('reinicioPorRojoPush pone puntos y racha a 0 y arranca el FLASH del reinicio', /function reinicioPorRojoPush[\s\S]{0,500}marcador\.puntos = 0; marcador\.racha = 0;[\s\S]{0,200}pushReset = \{ modo: 'reinicio'/.test(main));
  chk('al terminar el FLASH: reinicia estado y reloj y PASA A ESPERA con un target en el centro (5.3)', /pushReset = null;\s*reiniciarEstado\(\);[\s\S]{0,160}tiempoRestante = DURACIONES\[modoJuego\] \|\| 0;[\s\S]{0,160}pushEspera = true; crearTargetEspera\(\);/.test(main));
  chk('sólo el fin por TIEMPO guarda récord (record.terminar en terminarPartida)', /function terminarPartida\(porTiempo\)[\s\S]{0,1600}record\.terminar\(scoreFinal, ahora, cuentaRecord\)/.test(main));
  chk('Pushcloude NO envía al servidor todavía (envío inactivo, 9.5)', /if \(esPush\(\)\) return;/.test(main) && /servidor sólo acepta 'pushclaud:15'/.test(main));
}

console.log('=== CAMBIO 5 — RELÁMPAGO: quieto 400 ms, 200 en cualquier punto, sin castigo si no se toca ===');
{
  // No se MUEVE: se busca uno vivo en libertad y se comprueba que no se desplaza entre frames.
  const appA = appPush(); appA.irAJuego('pushclaud'); appA.jugar('60');
  let rel = null;
  for (let i = 0; i < 900 && !rel; i++) { appA.step(16); rel = appA._cap.caps.find(function (t) { return t.relampago && t.__enJuego && t.viva !== false && t.x > -9000; }); }
  chk('apareció un relámpago vivo', !!rel);
  if (rel) { const x0 = rel.x, y0 = rel.y; appA.step(16); appA.step(16); chk('el relámpago NO se mueve (vx/vy 0 y misma posición, 5.2)', rel.vx === 0 && rel.vy === 0 && rel.x === x0 && rel.y === y0); }
  chk('el relámpago dura 800 ms (v3.2 CAMBIO 2): __muereEn − __nace === 800', !!rel && (rel.__muereEn - rel.__nace) === 800);
  chk('FUENTE: el relámpago dura RELAMP_MS=800 y caduca sin castigo (splice, no anotarFallo, 5.2/5.4)', /RELAMP_MS: 800,/.test(main) && /if \(targets\[i\]\.relampago && now >= targets\[i\]\.__muereEn\) \{ targets\[i\]\.viva = false; targets\.splice\(i, 1\); \}/.test(main));
  chk('FUENTE: la velocidad de cruce se DUPLICA (v3.2 CAMBIO 3): VEL_PX = 0.416 = 0.208 × 2, en un solo sitio', /VEL_PX: 0\.416,/.test(main) && /0\.208 × 2 =[\s\S]{0,20}0\.416/.test(main) && (main.match(/VEL_PX:/g) || []).length === 1);

  // 200 EN CUALQUIER PUNTO + la racha sube igual que un centro (CAMBIO 2): 200×1 + 200×1.5 + 200×2 = 900.
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const r1 = traerAlCentro(app, 'relampago'); if (r1) app.disparar(422, 300); // toque FUERA del centro exacto
  chk('tocar un relámpago fuera del centro da 200 (vale en cualquier punto, 5.3)', !!r1 && score(app) === '200');
  const r2 = traerAlCentro(app, 'relampago'); if (r2) app.disparar(400, 300);
  const r3 = traerAlCentro(app, 'relampago'); if (r3) app.disparar(378, 300);
  chk('la racha sube como un centro: 200×1 + 200×1.5 + 200×2 = 900 (nueva progresión, 5.3)', !!r2 && !!r3 && score(app) === '900');

  // NO tocarlo: ni castiga ni rompe la racha. Con racha 3 (900), dejar caducar relámpagos y seguir.
  for (let i = 0; i < 60; i++) app.step(16); // ~960 ms sin tocar (> 800 de vida): los relámpagos caducan solos
  chk('dejar caducar relámpagos NO resta puntos (no es un fallo, 5.4)', score(app) === '900');
  const r4 = traerAlCentro(app, 'relampago'); if (r4) app.disparar(400, 300);
  chk('la racha se conservó pese a las caducidades: siguiente centro ×2.5 = 500 → 1400 (5.4)', !!r4 && score(app) === '1400');
}

console.log('=== v3.4 CAMBIO 2 — TODO es relámpago; algunos son ROJOS; nada bajo la barra ni encimado ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const r = Math.max(7, 6) * 4, barra = 58;
  let relRojo = 0, relBajoBarra = 0, relSolapado = 0, relVistos = 0;
  let apRelamp = 0, apNormal = 0; const vistos = new Set();
  for (let i = 0; i < 2000; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) {
      if (!t.__enJuego) return;                                       // ignora candidatos rechazados (nunca entraron al juego)
      if (!vistos.has(t)) { vistos.add(t); if (t.relampago) apRelamp++; else apNormal++; } // cuenta cada aparición una vez
      if (!t.relampago || t.viva === false || !t.haEntrado || t.x < -9000) return;
      relVistos++;
      if (t.rojo) relRojo++;
      if (t.y - r < barra) relBajoBarra++;
      app._cap.caps.forEach(function (o) {
        if (o === t || !o.__enJuego || o.viva === false || !o.haEntrado || o.x < -9000) return;
        if (Math.hypot(t.x - o.x, t.y - o.y) < (r + r)) relSolapado++;
      });
    });
  }
  chk('se observaron relámpagos vivos', relVistos > 20);
  chk('TODAS las apariciones son relámpago; NINGÚN normal (1.1/1.3)', apRelamp > 0 && apNormal === 0);
  chk('ALGUNOS relámpagos son ROJOS (los rojos también son relámpago, 2.1)', relRojo > 0);
  chk('NINGÚN relámpago aparece bajo la barra (5.5)', relBajoBarra === 0);
  chk('NINGÚN relámpago aparece encimado a otro (5.6)', relSolapado === 0);
  chk('FUENTE: intentarRelampago pide UN tipo (sortearTipoPush) y verifica no-solape antes de soltar', /const tipo = sortearTipoPush\(\);/.test(main) && /if \(tipo === 'rojo'\) t\.rojo = true;/.test(main) && /else if \(tipo === 'equis'\) t\.equis = true;/.test(main) && /if \(!pushSolapa\(t, PUSH\.RELAMP_MS, now\)\) \{ t\.__enJuego = true; targets\.push\(t\); return true; \}/.test(main));
  chk('FUENTE: probabilidades del sorteo (veto de Pat): rojo 0.15, equis 0.20, naranja el resto', /P_ROJO: 0\.15,/.test(main) && /P_EQUIS: 0\.20,/.test(main));
  chk('FUENTE: el sorteo respeta el tope de rojos (no dominan) y corta rachas largas (2.2/2.4)', /const puedeRojo = rojosVivos < otrosVivos;/.test(main) && /if \(tipo === 'rojo' && !puedeRojo\) tipo = 'naranja';/.test(main) && /pushUltimoTipo && pushRunTipo >= 2/.test(main));
}

console.log('=== CAMBIO 5.4 — El relámpago se ve IGUAL que un normal: sin color propio ni anillo ===');
{
  chk('ya NO existe dibujarRelampago: el dibujo propio (rombo dorado + anillo) se eliminó', !/dibujarRelampago/.test(main));
  chk('el bucle de dibujo NO desvía al relámpago a un dibujo propio (usa dibujarSpriteTarget)', !/if \(t\.relampago\) \{ dibujarRelampago/.test(main) && /dibujarSpriteTarget\(t, destella\)/.test(main));
  chk('el reventón del relámpago usa ACENTO.base, igual que un acierto al centro (sin dorado propio)', /if \(tg\.relampago\) \{[\s\S]{0,600}explotarCubos\(centros, mx, my, 1\.0, 0, 0, ACENTO\.base\)/.test(main));
  // Comportamiento: un relámpago usa la MISMA grilla (color/forma/tamaño) que cualquier target del juego.
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const relN = traerAlCentro(app, 'relampago');
  chk('un relámpago tiene la grilla normal (7×6, 42 celdas)', !!relN && relN.cols === 7 && relN.filas === 6 && relN.celdas.length === 42);
}

console.log('=== v3.4 CAMBIO 4 — Aparición con REBOTE (sólo visual): no roba vida ni retrasa el toque ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  // Un relámpago recién nacido: vida COMPLETA (800) y tocable YA, aunque el rebote aún esté creciendo.
  let rel = null;
  for (let i = 0; i < 900 && !rel; i++) { app.step(16); rel = app._cap.caps.find(function (t) { return t.relampago && t.__enJuego && t.viva !== false; }); }
  chk('el rebote NO recorta la vida: __muereEn − __nace === 800 (4.4)', !!rel && (rel.__muereEn - rel.__nace) === 800);
  chk('tocable desde el primer instante: haEntrado y radio plenos al nacer (4.4)', !!rel && rel.haEntrado === true && rel.radio > 0);
  // El rebote es escala visual: crece desde ~0, sobrepasa (>1) y se asienta en 1 al terminar REBOTE_MS.
  const RB = main.slice(main.indexOf('function rebotePush'), main.indexOf('function rebotePush') + 700);
  chk('FUENTE: rebotePush es escala+opacidad, SIN color, SIN anillo (arc/stroke), SIN shadowBlur (4.5/4.6)', !/shadowBlur/.test(RB) && !/strokeStyle/.test(RB) && !/\.arc\(/.test(RB) && !/fillStyle/.test(RB));
  chk('FUENTE: el rebote se aplica con ctx.scale (no cambia radio ni vida), sólo a relámpagos', /if \(t\.relampago\) \{\s*const now = performance\.now\(\);\s*const rb = rebotePush\(t, now\);[\s\S]{0,220}ctx\.scale\(esc, esc\);/.test(main));
  chk('FUENTE: duración y sobrepaso del rebote documentados en un solo sitio (REBOTE_MS/REBOTE_OVER)', /REBOTE_MS: 180,/.test(main) && /REBOTE_OVER: 1\.70158,/.test(main));
  // Comportamiento del easeOutBack: en t=0 escala ~0 (crece desde pequeño); a mitad ya sobrepasa 1.
  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  let rel2 = null; for (let i = 0; i < 900 && !rel2; i++) { app2.step(16); rel2 = app2._cap.caps.find(function (t) { return t.relampago && t.__enJuego; }); }
  // Reconstruye la escala del rebote como la fuente para verificar la forma (crece → sobrepasa → asienta).
  function esc(edad) { const p = Math.max(0, edad / 180); const c1 = 1.70158, c3 = c1 + 1, q = p - 1; return 1 + c3 * q * q * q + c1 * q * q; }
  chk('la escala arranca pequeña (t=0 → ~0) y sobrepasa el 100% antes de asentarse (4.2)', esc(0) < 0.05 && esc(130) > 1.0 && Math.abs(esc(180) - 1) < 1e-9);
}

console.log('=== v3.5 CAMBIO 1 — EQUIS: rompe la racha, ni suma ni resta; sacude menos que el rojo ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const a1 = traerAlCentro(app, 'relampago'); if (a1) app.disparar(400, 300); // naranja: racha1 +200 → 200
  const a2 = traerAlCentro(app, 'relampago'); if (a2) app.disparar(400, 300); // naranja: racha2 +300 → 500
  chk('dos naranjas seguidas: racha en marcha (200 + 300 = 500)', !!a1 && !!a2 && score(app) === '500');
  const eq = traerAlCentro(app, 'equis'); if (eq) app.disparar(400, 300);     // EQUIS: ni suma ni resta, rompe racha
  chk('apareció una EQUIS del sorteo', !!eq && !!eq.equis);
  chk('tocar la EQUIS no cambia los puntos (ni suma ni resta, 1.3)', score(app) === '500');
  const a3 = traerAlCentro(app, 'relampago'); if (a3) app.disparar(400, 300); // naranja tras equis
  chk('la EQUIS ROMPIÓ la racha: el siguiente centro vale ×1 (+200 → 700), no ×2.5 (1.3)', !!a3 && score(app) === '700');
  chk('FUENTE: la equis sacude MENOS que el rojo (amp 5 < 9) y rompe la racha', /EQUIS_SACUDIDA_AMP = 5;/.test(main) && /PUSH_SACUDIDA_AMP = 9;/.test(main) && /if \(tg\.equis\) \{[\s\S]{0,140}marcador\.racha = 0;/.test(main));
  const sprIni = main.indexOf('function dibujarSpriteTarget');
  const spr = main.slice(sprIni, main.indexOf('\n  function ', sprIni + 20));
  chk('FUENTE: la equis se dibuja en naranja MÁS OSCURO (ACENTO.profundo) con una EQUIS, sin shadowBlur (1.2/1.7)', /t\.equis \? ACENTO\.profundo/.test(spr) && /if \(t\.equis\) \{[\s\S]{0,320}moveTo\(-s, -s\); ctx\.lineTo\(s, s\);/.test(spr) && !/shadowBlur\s*=/.test(spr));
}

console.log('=== v3.5 CAMBIO 2 — Cada aparición sortea entre los TRES tipos: naranja, equis y rojo ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  let naranja = 0, equis = 0, rojo = 0; const vistos = new Set();
  for (let i = 0; i < 2500; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) {
      if (!t.__enJuego || vistos.has(t)) return;
      vistos.add(t);
      if (t.rojo) rojo++; else if (t.equis) equis++; else naranja++;
    });
  }
  console.log('  apariciones: naranja=' + naranja + ', equis=' + equis + ', rojo=' + rojo);
  chk('aparecen los TRES tipos (naranja, equis y rojo) en una partida (2.1)', naranja > 0 && equis > 0 && rojo > 0);
  chk('la mayoría son naranjas; equis y rojo ensucian sin dominar (2.2/2.4)', naranja > equis && naranja > rojo);
}

console.log('=== v3.5 CAMBIO 4 — La META se cumple UNA sola vez: antes reinicia por ciclo, después acumula libre ===');
{
  // SIN cumplirla: con <1000 al cerrar el ciclo de 15 s, los puntos se reinician (4.3).
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const a = traerAlCentro(app, 'relampago'); if (a) app.disparar(400, 300); // +200 (racha1)
  chk('acumuló algo por debajo de 1000', !!a && score(app) === '200');
  for (let i = 0; i < 1000; i++) app.step(16);   // ~16 s sin tocar: cierra un ciclo con <1000
  chk('al pasar 15 s sin llegar a 1000, los puntos se REINICIAN (4.3)', score(app) === '0');

  // CUMPLIÉNDOLA: 4 centros (200+300+400+500 = 1400 ≥ 1000) → meta lograda; luego los ciclos NO vuelven.
  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  for (let k = 0; k < 4; k++) { const t = traerAlCentro(app2, 'relampago'); if (t) app2.disparar(400, 300); }
  chk('cuatro centros llegan a la meta (200+300+400+500 = 1400 ≥ 1000)', score(app2) === '1400');
  app2.step(16);                                   // el update marca la meta como lograda
  for (let i = 0; i < 1200; i++) app2.step(16);    // ~19 s sin tocar: si los ciclos volvieran, reiniciarían
  chk('cumplida la meta, el jugador ACUMULA LIBRE: los puntos NO se reinician (4.2/4.4)', score(app2) === '1400');
  chk('FUENTE: la meta es una sola vez (pushMetaLograda) y el contador DESAPARECE al lograrla (4.2)', /if \(pushMetaLograda \|\| pushEspera\) return;/.test(main) && /!pushMetaLograda\) \{/.test(main) && /pushMetaLograda = true;/.test(main));
}

console.log(`\n== RESUMEN pushcloude: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
