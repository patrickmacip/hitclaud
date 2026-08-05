// hitclaud — COMPORTAMIENTO del ranking de ShotClaud: qué MODO manda cada juego, si incluye
// efectividad, si manda por rojo (CloudOver), y cómo se muestra la efectividad en la tabla.
// Carga js/main.js en un DOM simulado (test/harness_dom.js) e intercepta Ranking.
// node test/rankingshot.test.js

const { crearApp } = require('./harness_dom.js');
const R = require('../js/ranking.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function conSeed(seed, fn) {
  const orig = Math.random; let s = seed >>> 0;
  Math.random = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  try { return fn(); } finally { Math.random = orig; }
}

// App con Ranking interceptado (captura args) y, opcional: modo táctil, rojos golpeables/no,
// targets quietos al centro, y un top falso para la tabla.
function appCon(opts) {
  opts = opts || {};
  const cap = { puntaje: [], partida: [] };
  const app = crearApp({
    antesDeMain: function (w) {
      // Nombre en localStorage ANTES de cargar main.js → resolverNombre resuelve SÍNCRONO y el
      // /score se dispara (y se captura) sin esperar a IndexedDB.
      try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
      if (opts.tactil) w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; };
      const Rk = w.Ranking;
      Rk.enviarPuntaje = function (o) { cap.puntaje.push(o); return Promise.resolve({ estado: 'ok', entro: false }); };
      Rk.enviarPartida = function (d) { cap.partida.push(d); };
      if (opts.topFalso) Rk.pedirTop = function () { return Promise.resolve({ ok: true, top: opts.topFalso }); };
      const F = w.Fisica, crt = F.crearTarget, cep = F.celdaEnPunto;
      if (opts.centro) F.crearTarget = function () { const t = crt.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; };
      if (opts.sinRojoGolpe) F.celdaEnPunto = function (t) { if (t && t.rojo) return -1; return cep.apply(this, arguments); };
    },
  });
  app._cap = cap;
  return app;
}
function jugar(app, juego, dur) {
  app.irAJuego(juego);
  if (dur) { const b = app.byId['durModos'].children.find(function (x) { return x._attrs['data-dur'] === dur; }); if (b) b.dispatch('click'); }
  app.byId['durJugar'].dispatch('click');
}

console.log('=== V3 — ShotClaud manda "shotclaud:20"/"shotclaud:60" con efectividad (por tiempo) ===');
conSeed(3, function () {
  const app = appCon({ centro: true, sinRojoGolpe: true }); // desktop, sin CloudOver → llega al time-up
  jugar(app, 'shotclaud', '20');
  for (let i = 0; i < 800; i++) { app.disparar(400, 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const p = app._cap.puntaje[app._cap.puntaje.length - 1];
  const par = app._cap.partida[app._cap.partida.length - 1];
  chk('el /score de ShotClaud usa modo "shotclaud:20"', !!p && p.modo === 'shotclaud:20');
  chk('el /score de ShotClaud incluye efectividad (0..100)', !!p && Number.isInteger(p.efectividad) && p.efectividad >= 0 && p.efectividad <= 100);
  chk('el /partida de ShotClaud también lleva modo "shotclaud:20" y efectividad', !!par && par.modo === 'shotclaud:20' && typeof par.efectividad === 'number');
});
conSeed(8, function () {
  const app = appCon({ centro: true, sinRojoGolpe: true });
  jugar(app, 'shotclaud', '60');
  for (let i = 0; i < 2100; i++) { app.disparar(400, 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const p = app._cap.puntaje[app._cap.puntaje.length - 1];
  chk('la duración 60 manda "shotclaud:60"', !!p && p.modo === 'shotclaud:60');
});

console.log('=== V3 — ShotClaud manda su puntaje al terminar por ROJO (CloudOver) ===');
conSeed(5, function () {
  const app = appCon({ centro: true }); // rojos GOLPEABLES → termina por CloudOver
  jugar(app, 'shotclaud', '20');
  let fin = -1;
  for (let i = 0; i < 800; i++) { app.disparar(400, 300); app.step(32); if (fin < 0 && !app.byId['gameover'].classList.contains('oculto')) { fin = i; break; } }
  const p = app._cap.puntaje[app._cap.puntaje.length - 1];
  chk('terminó por CloudOver (antes del time-up ~625)', fin >= 0 && fin < 620);
  chk('AUN ASÍ mandó el /score (modo shotclaud:20, permiteCloudover)', !!p && p.modo === 'shotclaud:20' && p.permiteCloudover === true);
  chk('lo mandó con porTiempo=false (murió por rojo)', !!p && p.porTiempo === false);
});

console.log('=== V3 — HitClaud manda "15"/"60" PELADOS y SIN efectividad (por tiempo) ===');
conSeed(2, function () {
  const app = appCon({ tactil: true }); // HitClaud es táctil; sin disparar, corre hasta el time-up
  jugar(app, 'hitclaud', '15');
  for (let i = 0; i < 560; i++) { app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const p = app._cap.puntaje[app._cap.puntaje.length - 1];
  const par = app._cap.partida[app._cap.partida.length - 1];
  chk('el /score de HitClaud usa la duración PELADA "15" (sin prefijo)', !!p && p.modo === '15');
  chk('HitClaud NO incluye efectividad', !!p && !('efectividad' in p));
  chk('el /partida de HitClaud tampoco lleva efectividad', !!par && !('efectividad' in par));
  chk('HitClaud manda por TIEMPO (porTiempo=true, permiteCloudover=false)', !!p && p.porTiempo === true && p.permiteCloudover === false);
});
conSeed(6, function () {
  const app = appCon({ tactil: true });
  jugar(app, 'hitclaud', '60');
  for (let i = 0; i < 2000; i++) { app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const p = app._cap.puntaje[app._cap.puntaje.length - 1];
  chk('la duración 60 de HitClaud manda "60" pelado', !!p && p.modo === '60');
});

console.log('=== V3 — decisión de envío en ranking.js: ShotClaud compite por CloudOver, HitClaud no ===');
{
  chk('MODOS incluye los de ShotClaud', R.MODOS.indexOf('shotclaud:20') !== -1 && R.MODOS.indexOf('shotclaud:60') !== -1);
  chk('MODOS conserva los pelados de HitClaud (15/60) y NO el 30', R.MODOS.indexOf('15') !== -1 && R.MODOS.indexOf('60') !== -1 && R.MODOS.indexOf('30') === -1);
  chk('HitClaud por CloudOver NO se manda (motivo cloudover)', R.motivoNoEnvio({ porTiempo: false, permiteCloudover: false, nombre: 'Pat', puntos: 100 }) === 'cloudover');
  chk('ShotClaud por CloudOver SÍ se manda (sin motivo)', R.motivoNoEnvio({ porTiempo: false, permiteCloudover: true, nombre: 'Pat', puntos: 100 }) === null);
  const conEfc = R.armarDatosPartida({ modo: 'shotclaud:20', puntos: 500, tiros: 10, aciertos: 7, efectividad: 70 });
  chk('armarDatosPartida conserva el modo shotclaud:20 y la efectividad', conEfc.modo === 'shotclaud:20' && conEfc.efectividad === 70);
  const sinEfc = R.armarDatosPartida({ modo: '15', puntos: 500 });
  chk('armarDatosPartida sin efectividad NO agrega el campo (HitClaud)', !('efectividad' in sinEfc));
  chk('armarDatosPartida acota la efectividad a 0..100', R.armarDatosPartida({ modo: 'shotclaud:20', puntos: 1, efectividad: 250 }).efectividad === 100);
}

// La tabla depende de un .then() (pedirTop). Se resuelve tras una microtarea → async.
(async function () {
  console.log('=== V3 — La tabla muestra la efectividad cuando existe; una entrada sin ella no la rompe ===');
  const top = [
    { nombre: 'ANA', puntos: 900, fecha: 'f', efectividad: 88 },
    { nombre: 'BEO', puntos: 700, fecha: 'f' },              // vieja: SIN efectividad
    { nombre: 'CIN', puntos: 500, fecha: 'f', efectividad: 0 }, // 0% es un valor válido
  ];
  const app = appCon({ topFalso: top });
  app.irAJuego('shotclaud'); // pantalla de duración
  app.byId['durRanking'].dispatch('click');       // abre ranking → cargarRanking → pintarTabla
  await new Promise(function (r) { setImmediate(r); }); // deja correr el .then de pedirTop
  const filas = app.byId['rankCuerpo'].children;
  function textoEfc(fila) { for (let i = 0; i < fila.children.length; i++) { const t = fila.children[i].textContent || ''; if (/%$/.test(t)) return t; } return null; }
  chk('se pintaron las 3 filas (la tabla no se rompió por la que no trae efectividad)', filas.length === 3);
  chk('ANA (88) muestra "88%" entre nombre y puntos', filas.length === 3 && textoEfc(filas[0]) === '88%');
  chk('BEO (sin dato) NO muestra porcentaje (no rompe)', filas.length === 3 && textoEfc(filas[1]) === null);
  chk('CIN (0) muestra "0%" (0 es válido, no se omite)', filas.length === 3 && textoEfc(filas[2]) === '0%');
  chk('la fila con efectividad tiene una celda MÁS que la que no la trae', filas.length === 3 && filas[0].children.length === filas[1].children.length + 1);

  console.log(`\n== RESUMEN ranking-shot: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
