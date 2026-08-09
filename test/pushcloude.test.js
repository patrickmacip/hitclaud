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
// Trae al centro (400,300), CONGELADO, el primer target del `tipo` pedido ('normal' = naranja;
// 'relampago') vivo y ya entrado; aparta a los demás para que el toque sólo lo alcance a él.
function traerAlCentro(app, tipo) {
  const quiereRelamp = tipo === 'relampago';
  let tg = null;
  for (let i = 0; i < 900 && !tg; i++) {
    app.step(16);
    tg = app._cap.caps.find(function (t) {
      const esRelamp = !!t.relampago;
      return esRelamp === quiereRelamp && t.__enJuego && !t.rojo && t.viva !== false && t.haEntrado && t.x > -9000;
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

console.log('=== JUEGO — Tocar un ROJO reinicia la partida (no termina): puntos a 0, sin salir, sin enviar ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  // v3.4: los rojos son RELÁMPAGO. Para ejercitar el camino de forma determinista, traigo un relámpago
  // VIVO al centro y lo marco ROJO (sigue siendo relámpago); tocarlo debe REINICIAR la partida (2.2).
  const rojo = traerAlCentro(app, 'relampago');
  chk('hay un relámpago para marcar como rojo', !!rojo);
  if (rojo) { rojo.rojo = true; } // rojo Y relámpago a la vez (2.1)
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

console.log('=== v3.5 CAMBIO 3 — Más ritmo: ≥270 ms entre apariciones, regular, sin condición de recorrido ===');
{
  const app = appPush(); app.irAJuego('pushclaud'); app.jugar('60');
  const naceVistos = [];
  for (let i = 0; i < 1500; i++) {
    app.step(16);
    app._cap.caps.forEach(function (t) { if (t.__enJuego && naceVistos.indexOf(t.__nace) === -1) naceVistos.push(t.__nace); });
  }
  naceVistos.sort(function (a, b) { return a - b; });
  let minGap = Infinity;
  for (let k = 1; k < naceVistos.length; k++) minGap = Math.min(minGap, naceVistos[k] - naceVistos[k - 1]);
  chk('hubo varias apariciones', naceVistos.length > 8);
  chk('entre dos apariciones pasan al menos 270 ms (baja de 450 a 270, CAMBIO 3)', minGap >= 270);
  chk('el ritmo es REGULAR (no ráfagas): ninguna espera se dispara (3)', (function () {
    let irregulares = 0;
    for (let k = 1; k < naceVistos.length; k++) { const g = naceVistos[k] - naceVistos[k - 1]; if (g > 900) irregulares++; }
    return irregulares <= 1;
  })());
  chk('FUENTE: SPAWN_MIN = 270 ms, un solo sitio', /SPAWN_MIN: 270,/.test(main));
  chk('FUENTE: la condición del 60% de recorrido se ELIMINÓ de spawnPush (nada recorre, 3.2)', !/ultNormal\.__cruce >= PUSH\.SEP_RECORRIDO/.test(main));
  chk('FUENTE: MAX_RELAMPAGOS sube a 5 (CAMBIO 3.2) para que el ritmo se note', /MAX_RELAMPAGOS: 5,/.test(main));
}

console.log('=== v3.4 CAMBIO 3.2/3.3 — El tope permite 5 y CABEN 5 sin solaparse en la banda del 45% ===');
{
  // El cupo es 5. Espacialmente: la banda del 45% central × todo el ancho tiene sitio de sobra para 5
  // relámpagos sin solaparse (min. distancia entre centros = (radio+radio)·SEP_FACTOR, radio 40 → 92 px).
  chk('FUENTE: MAX_RELAMPAGOS = 5', /MAX_RELAMPAGOS: 5,/.test(main));
  const H = 600, W = 800, BARRA = 58, BF = 0.45, radio = Math.max(7, 6) * 4 + 12, SEP = 1.15;
  const rRot = Math.hypot(7 * 4, 6 * 4), margen = (1 - BF) / 2;
  const top = Math.max(H * margen, BARRA) + rRot, bot = H * (1 - margen) - rRot;
  const left = rRot, right = W - rRot;
  const minD = (radio + radio) * SEP;                         // misma regla que pushSolapa
  const columnas = Math.floor((right - left) / minD) + 1;     // cuántos caben en una fila de la banda
  chk('CABEN 5 sin solaparse (una sola fila de la banda ya alcanza): columnas ≥ 5', columnas >= 5 && (bot - top) > 0);
  // Verificación constructiva: 5 posiciones a min. distancia dentro de la banda.
  const xs = []; for (let k = 0; k < 5; k++) xs.push(left + k * minD);
  let ok5 = xs[4] <= right; for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (Math.abs(xs[a] - xs[b]) < minD - 1e-6) ok5 = false;
  chk('5 posiciones a ≥92 px caben dentro del ancho de la banda', ok5);
}

console.log('=== FUENTE — Rojo reinicia puntos/racha/ciclo/reloj; sólo el tiempo guarda récord; sin envío ===');
{
  chk('el toque a un rojo enruta a reinicioPorRojoPush (no a golpeCloudover/terminarPartida)', /if \(tg\.rojo\) \{ reinicioPorRojoPush\(tg, mx, my\); return; \}/.test(main));
  chk('reinicioPorRojoPush pone puntos y racha a 0 y arranca la máquina de reinicio', /function reinicioPorRojoPush[\s\S]{0,500}marcador\.puntos = 0; marcador\.racha = 0;[\s\S]{0,200}pushReset = \{ modo: 'reinicio'/.test(main));
  chk('al terminar la cuenta: reinicia estado, RELOJ de partida y ciclo (sin terminarPartida)', /pushReset = null;\s*reiniciarEstado\(\);[\s\S]{0,120}tiempoRestante = DURACIONES\[modoJuego\] \|\| 0;[\s\S]{0,120}pushCicloBase = 0; pushCicloRestante = PU\.CICLO_MS/.test(main));
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
  chk('FUENTE: intentarRelampago sortea ROJO con P_ROJO y tope (rojos ≤ no-rojos vivos), verifica no-solape', /const rojo = \(rojosVivos < otrosVivos\) && Math\.random\(\) < PUSH\.P_ROJO;/.test(main) && /if \(rojo\) t\.rojo = true;/.test(main) && /if \(!pushSolapa\(t, PUSH\.RELAMP_MS, now\)\) \{ t\.__enJuego = true; targets\.push\(t\); return true; \}/.test(main));
  chk('FUENTE: la frecuencia de rojos se CONSERVA (P_ROJO sin cambios: 0.28)', /P_ROJO: 0\.28,/.test(main));
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
  chk('FUENTE: el rebote se aplica con ctx.scale (no cambia radio ni vida), sólo a relámpagos', /if \(t\.relampago\) \{ const rb = rebotePush\(t, performance\.now\(\)\); ctx\.scale\(rb\.esc, rb\.esc\); ctx\.globalAlpha = rb\.alpha; \}/.test(main));
  chk('FUENTE: duración y sobrepaso del rebote documentados en un solo sitio (REBOTE_MS/REBOTE_OVER)', /REBOTE_MS: 180,/.test(main) && /REBOTE_OVER: 1\.70158,/.test(main));
  // Comportamiento del easeOutBack: en t=0 escala ~0 (crece desde pequeño); a mitad ya sobrepasa 1.
  const app2 = appPush(); app2.irAJuego('pushclaud'); app2.jugar('60');
  let rel2 = null; for (let i = 0; i < 900 && !rel2; i++) { app2.step(16); rel2 = app2._cap.caps.find(function (t) { return t.relampago && t.__enJuego; }); }
  // Reconstruye la escala del rebote como la fuente para verificar la forma (crece → sobrepasa → asienta).
  function esc(edad) { const p = Math.max(0, edad / 180); const c1 = 1.70158, c3 = c1 + 1, q = p - 1; return 1 + c3 * q * q * q + c1 * q * q; }
  chk('la escala arranca pequeña (t=0 → ~0) y sobrepasa el 100% antes de asentarse (4.2)', esc(0) < 0.05 && esc(130) > 1.0 && Math.abs(esc(180) - 1) < 1e-9);
}

console.log(`\n== RESUMEN pushcloude: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
