// hitclaud — SELLADO de HitClaud: fija los valores del juego como constantes esperadas y
// FALLA si alguno cambia. Nació de un reporte de "targets de HitClaud agrandados"; el
// diagnóstico probó que HitClaud seguía intacto (5×4), así que esta prueba es la RED que
// impide que una regresión de tamaño/velocidad/rojos/Big Claude/gravedad pase en silencio.
//
// Dos frentes:
//  (A) COMPORTAMIENTO — juega HitClaud de verdad (harness sobre main.js) y verifica que CADA
//      target que sale es 5×4 con radio 24; juega ShotClaud y verifica 7×6 con radio 40 →
//      demuestra que la grilla de ShotClaud NO se aplica a HitClaud (el gate esShot() separa).
//  (B) CONSTANTES — lee el código fuente y clava los números de HitClaud (cupos, cadencia,
//      Big Claude, gravedad). Si alguien los toca, esta prueba se cae.
//
// node test/hitclaud_sellado.test.js

const fs = require('fs');
const { crearApp } = require('./harness_dom.js');

const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const fisica = fs.readFileSync(__dirname + '/../js/fisica.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Captura cada target creado por el motor mientras corre el juego indicado.
function capturarTargets(opts) {
  const caps = [];
  const app = crearApp({ antesDeMain: function (w) {
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    if (opts.movil) w.matchMedia = function (q) { return { matches: false, addListener() {}, addEventListener() {}, media: q }; };
    const F = w.Fisica, crt = F.crearTarget;
    F.crearTarget = function () { const t = crt.apply(this, arguments); caps.push({ cols: t.cols, filas: t.filas, radio: t.radio }); return t; };
  } });
  // Navega hasta el juego pedido (izquierda avanza: HitClaud→ShotClaud→PushClaud) y JUEGA.
  for (let i = 0; i < opts.izq; i++) app.byId['homeIzq'].dispatch('click');
  app.byId['durJugar'].dispatch('click');
  for (let i = 0; i < 60; i++) app.step(32);
  return caps;
}

console.log('=== (A) HitClaud en MÓVIL: cada target es 5×4 radio 24, byte por byte ===');
{
  const t = capturarTargets({ movil: true, izq: 0 }); // arranca en HitClaud, jugable en móvil
  chk('salieron targets de HitClaud para inspeccionar', t.length > 0);
  chk('TODOS son grilla 5×4 (nunca la 7×6 de ShotClaud ni la 10×8 de Big Claude base)',
    t.length > 0 && t.every(function (x) { return x.cols === 5 && x.filas === 4; }));
  chk('TODOS tienen radio 24 (el de crearTarget por defecto, no el 40 de ShotClaud)',
    t.length > 0 && t.every(function (x) { return x.radio === 24; }));
}

console.log('=== (A) ShotClaud en escritorio: 7×6 radio 40 → prueba que el gate SEPARA ===');
{
  const t = capturarTargets({ movil: false, izq: 1 }); // HitClaud → ShotClaud
  chk('salieron targets de ShotClaud', t.length > 0);
  chk('ShotClaud usa SU grilla 7×6 (distinta de la 5×4 de HitClaud) → los tamaños no se mezclan',
    t.length > 0 && t.every(function (x) { return x.cols === 7 && x.filas === 6; }));
  // El radio final de ShotClaud (40) lo pone nuevoTarget DESPUÉS de crearTarget, así que se
  // clava en el código (el wrapper captura el radio del motor, previo a ese override).
  chk('ShotClaud fija su radio de salida propio (Math.max(7,6)*4+12 = 40), sólo en su rama',
    /t\.radio = Math\.max\(SHOT\.COLS, SHOT\.FILAS\) \* 4 \+ 12;/.test(main));
}

console.log('=== (B) Constantes de HitClaud clavadas en el código (fallan si cambian) ===');
{
  function pin(nombre, re, esperado) {
    const m = main.match(re);
    chk(`${nombre} === ${esperado}`, !!m && m[1] === String(esperado));
  }
  pin('MAX_EN_PANTALLA (cupo de spawn de HitClaud)', /const MAX_EN_PANTALLA = (\d+);/, 2);
  pin('SPAWN_GAP_MAX (cadencia de HitClaud)',        /const SPAWN_GAP_MAX = (\d+);/, 800);
  pin('MAX_TARGETS_VIVOS (tope de dibujo de HitClaud)', /const MAX_TARGETS_VIVOS = (\d+);/, 10);
  pin('GRANDE_COLS (Big Claude sigue 10×8)',         /const GRANDE_COLS = (\d+);/, 10);
  pin('GRANDE_FILAS (Big Claude sigue 10×8)',        /const GRANDE_FILAS = (\d+);/, 8);
  pin('GRANDE_LENTO (Big Claude 3× más lento)',      /const GRANDE_LENTO = (\d+);/, 3);
  const g = fisica.match(/G_TARGET: ([\d.]+),/);
  chk('gravedad de los targets G_TARGET === 0.0021 (flote lunar, sin cambios)', !!g && g[1] === '0.0021');
  chk('HitClaud llama crearTarget SIN grilla → toma el 5×4 por defecto del motor', /F\.crearTarget\(\{ w: W, h: H \}\)/.test(main));
}

console.log('=== (B) Ninguna constante de ShotClaud llega a HitClaud ===');
{
  // El único puente posible es nuevoTarget(); debe estar cerrado por esShot() antes de tocar SHOT.
  chk('nuevoTarget devuelve el 5×4 por defecto cuando NO es ShotClaud (gate esShot())',
    /function nuevoTarget\(\) \{\s*if \(!esShot\(\)\) return F\.crearTarget\(\{ w: W, h: H \}\);/.test(main));
  chk('SHOT.COLS/FILAS (7×6) sólo aparecen DESPUÉS del gate esShot() dentro de nuevoTarget',
    /if \(!esShot\(\)\) return F\.crearTarget\(\{ w: W, h: H \}\);\s*const t = F\.crearTarget\(\{ w: W, h: H \}, SHOT\.COLS, SHOT\.FILAS\);/.test(main));
  chk('aplicarVelocidadShot se INVOCA una sola vez (dentro de nuevoTarget de ShotClaud, no en HitClaud)',
    (main.match(/aplicarVelocidadShot\(t\);/g) || []).length === 1);
  chk('ShotClaud declara SIN_GRANDE (Big Claude es exclusivo de HitClaud)', /SIN_GRANDE: true/.test(main));
}

console.log(`\n== RESUMEN hitclaud_sellado: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
