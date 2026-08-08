// hitclaud — COMPORTAMIENTO (no presencia) de los arreglos de ShotClaud: el récord se
// guarda al terminar por CloudOver (bug D1), el botón JUGAR del ranking arranca partida de
// verdad con la duración de la tabla y cierra el ranking (bug D2), el target golpeado fuera
// del centro cae en picada (CAMBIO 4) y el medidor de efectividad calcula bien y no estorba
// (CAMBIO 5). Carga js/main.js en un DOM simulado (test/harness_dom.js). node test/shotbugs.test.js

const { crearApp } = require('./harness_dom.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// RNG determinista (los módulos usan Math.random): se reemplaza durante cada escenario.
function conSeed(seed, fn) {
  const orig = Math.random;
  let s = seed >>> 0;
  Math.random = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  try { return fn(); } finally { Math.random = orig; }
}
function rec(app, clave) { const v = app.mem.get(clave); return v ? JSON.parse(v).record : null; }
function jugarShot(app, dur) {
  app.irAJuego('shotclaud');           // → home de ShotClaud
  app.jugar(dur);                      // el botón de ESA duración arranca la partida (v2.7: ya no hay JUGAR)
}

console.log('=== D1 — el récord de ShotClaud se guarda al terminar por CloudOver (20 y 60, por separado) ===');
conSeed(7, function () {
  // Targets quietos al centro (rojos SÍ golpeables): al disparar al centro se puntúa y, al toparse
  // un rojo, la corrida termina por CloudOver — el caso REAL en el que antes se perdía el récord.
  const wrap = function (w) { const F = w.Fisica, c = F.crearTarget; F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; }; };
  const app = crearApp({ antesDeMain: wrap });
  jugarShot(app, '20');
  let finFrame = -1;
  for (let i = 0; i < 800; i++) { app.disparar(400, 300); app.step(32); if (finFrame < 0 && !app.byId['gameover'].classList.contains('oculto')) finFrame = i; }
  chk('la corrida de 20 terminó por CloudOver (antes del time-up ~625)', finFrame >= 0 && finFrame < 620);
  chk('el récord de ShotClaud 20 quedó GUARDADO (>0) tras el CloudOver', rec(app, 'hitclaud.record.v4.shotclaud.20') > 0);
  chk('el récord de ShotClaud 60 sigue en 0 (no se cruzaron las duraciones)', (rec(app, 'hitclaud.record.v4.shotclaud.60') || 0) === 0);
});
conSeed(23, function () {
  const wrap = function (w) { const F = w.Fisica, c = F.crearTarget; F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; }; };
  const app = crearApp({ antesDeMain: wrap });
  jugarShot(app, '60');
  for (let i = 0; i < 800; i++) { app.disparar(400, 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  chk('el récord de ShotClaud 60 quedó GUARDADO (>0) por separado', rec(app, 'hitclaud.record.v4.shotclaud.60') > 0);
  chk('el récord de ShotClaud 20 sigue en 0 (llaves independientes)', (rec(app, 'hitclaud.record.v4.shotclaud.20') || 0) === 0);
});

console.log('=== D2 — el botón JUGAR del ranking arranca partida REAL con la duración de la tabla y cierra el ranking ===');
conSeed(11, function () {
  // Rojos NO golpeables → sin CloudOver: la corrida llega al time-up y guarda el récord en la
  // duración que se eligió EN LA TABLA del ranking (60), no la de por defecto (20).
  const wrap = function (w) { const F = w.Fisica, c = F.crearTarget, cep = F.celdaEnPunto;
    F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; };
    F.celdaEnPunto = function (t) { if (t && t.rojo) return -1; return cep.apply(this, arguments); };
  };
  const app = crearApp({ antesDeMain: wrap });
  app.irAJuego('shotclaud');           // pantalla de duración
  app.byId['durRanking'].dispatch('click');                 // abre el RANKING (origen 'duracion')
  chk('el ranking quedó abierto', !app.byId['ranking'].classList.contains('oculto'));
  const b60 = app.byId['rankModos'].children.find(function (x) { return x._attrs['data-modo'] === '60'; });
  chk('la tabla ofrece elegir duración (60)', !!b60);
  if (b60) b60.dispatch('click');                           // elegir 60 EN LA TABLA
  app.byId['rankJugar'].dispatch('click');                  // JUGAR desde el ranking
  chk('al pulsar JUGAR, el overlay del ranking se CIERRA (arreglo D2)', app.byId['ranking'].classList.contains('oculto'));
  chk('los demás overlays también están cerrados (la partida está en curso)',
    app.byId['duracion'].classList.contains('oculto') && app.byId['gameover'].classList.contains('oculto'));
  // Corre hasta el time-up (60s): guardó el récord en 60 (la duración de la tabla), NO en 20.
  for (let i = 0; i < 2100; i++) { app.disparar(400, 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  chk('la partida arrancó con la duración de la TABLA (récord guardado en 60)', rec(app, 'hitclaud.record.v4.shotclaud.60') > 0);
  chk('NO arrancó con la duración por defecto (20 sigue en 0)', (rec(app, 'hitclaud.record.v4.shotclaud.20') || 0) === 0);
});

console.log('=== CAMBIO 4 — un target golpeado FUERA del centro pierde velocidad horizontal y cae ===');
conSeed(5, function () {
  const refs = [];
  const wrap = function (w) { const F = w.Fisica, c = F.crearTarget, cep = F.celdaEnPunto;
    F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; refs.push(t); return t; };
    F.celdaEnPunto = function (t) { if (t && t.rojo) return -1; return cep.apply(this, arguments); }; // sin CloudOver
  };
  const app = crearApp({ antesDeMain: wrap });
  jugarShot(app, '20');
  for (let i = 0; i < 6; i++) app.step(32);                 // deja entrar targets (haEntrado)
  const vivos = refs.filter(function (t) { return t.viva && t.haEntrado && !t.rojo; });
  vivos.forEach(function (t) { t.vx = 1.5; });              // les damos velocidad HORIZONTAL
  const gTarget = app.window.Fisica.FISICA.G_TARGET;
  chk('antes del golpe: ningún target va cayendo con velocidad horizontal recortada', !vivos.some(function (t) { return Math.abs(t.vx) < 0.3; }) && vivos.length > 0);
  app.disparar(422, 300);                                    // FUERA del centro (a ~22px, cuarto central llega a ~14px)
  const derribado = refs.find(function (t) { return t.viva && Math.abs(t.vx) < 0.3 && t.gravedad > gTarget && t.vy > 0; });
  chk('tras el golpe fuera del centro, un pedazo perdió la horizontal (|vx|<0.3)', !!derribado);
  chk('y cae en picada: gravedad intensificada (> G_TARGET) y vy hacia abajo (>0)', !!derribado && derribado.gravedad > gTarget && derribado.vy > 0);
  chk('conserva rotación (velRot definido) para que se vea el impacto', !!derribado && typeof derribado.velRot === 'number' && derribado.velRot !== 0);
});

console.log('=== CAMBIO 5 — el medidor de efectividad calcula bien (aciertos/disparos) ===');
conSeed(9, function () {
  // Rojos no golpeables (sin CloudOver): mezcla de aciertos (al centro) y fallos (a un rincón vacío).
  // Contamos los eventos reales de puntuación y comparamos con lo que muestra el fin (#finPrecision).
  let aciertos = 0, tiros = 0;
  const wrap = function (w) { const F = w.Fisica, c = F.crearTarget, cep = F.celdaEnPunto;
    F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; };
    F.celdaEnPunto = function (t) { if (t && t.rojo) return -1; return cep.apply(this, arguments); };
    const S = w.ShotClaud;
    ['anotarCentro', 'anotarLateral', 'anotarCaido'].forEach(function (m) { const o = S[m]; S[m] = function () { aciertos++; tiros++; return o.apply(this, arguments); }; });
    const of = S.anotarFallo; S.anotarFallo = function () { tiros++; return of.apply(this, arguments); };
  };
  const app = crearApp({ antesDeMain: wrap });
  jugarShot(app, '20');
  for (let i = 0; i < 800; i++) { app.disparar(i % 3 === 0 ? 20 : 400, i % 3 === 0 ? 20 : 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const esperado = tiros > 0 ? Math.round((aciertos / tiros) * 100) : null;
  const mostrado = app.byId['finPrecision'].textContent;
  chk('hubo disparos y una mezcla de aciertos/fallos', tiros > 10 && aciertos > 0 && aciertos < tiros);
  chk('el fin muestra la efectividad = round(aciertos/disparos) (' + esperado + '%)', mostrado === esperado + '%');
});

console.log('=== CAMBIO 5 — el medidor NO estorba: sólo dibujo, sin capturar input, sin tocar puntaje/récord ===');
{
  const fs = require('fs');
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  const cuerpo = main.slice(main.indexOf('function dibujarMedidorShot'), main.indexOf('function dibujarReticulaShot'));
  chk('el medidor se dibuja en el CANVAS (ctx.fillText), no es un elemento DOM', /ctx\.fillText\(/.test(cuerpo));
  chk('el medidor NO registra listeners (no captura toques/clics, 5.4)', !/addEventListener/.test(cuerpo));
  chk('el medidor NO toca el marcador ni el récord (5.9)', !/marcador\./.test(cuerpo) && !/record\./.test(cuerpo));
  chk('sin valor hasta el primer disparo (5.5): efectividadPct devuelve null sin tiros', /if \(!tiros \|\| tiros <= 0\) return null;/.test(main));
  chk('el medidor es SÓLO ShotClaud (dibujado dentro de la rama esShot del desktop)', /if \(esDesktop && esShot\(\)\) \{[\s\S]{0,160}dibujarMedidorShot\(\)/.test(main));
  chk('sin shadowBlur en el medidor (ninguna asignación)', !/shadowBlur\s*=/.test(cuerpo));
}

console.log(`\n== RESUMEN shot-bugs: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
