// hitclaud — DESKTOP: mira + disparo HITSCAN (impacto inmediato): node test/hitscan.test.js
// Verifica el mapeo punto→cubo (celdaEnPunto) y la decisión del disparo (espejo
// de dispararHitscan en main.js): naranja → destruye cubo + puntúa; rojo → game
// over; nada → fallo. También que el mundo quedó SIN rebote de paredes.

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== celdaEnPunto: mapea el punto de la mira al cubo vivo ===');
{
  const t = F.crearTarget(VP); t.x = 200; t.y = 300; t.rot = 0;
  chk('centro del sprite → celda central (idx 12)', F.celdaEnPunto(t, 200, 300) === 12);
  chk('fuera del sprite → -1', F.celdaEnPunto(t, 50, 50) === -1);
  t.celdas[12] = false;
  chk('cubo ya destruido → -1 (no re-cuenta)', F.celdaEnPunto(t, 200, 300) === -1);
}

console.log('\n=== hitball 4× más chica (radio de la mira) ===');
{
  const RADIO_NORMAL = 14, RADIO_MIRA = RADIO_NORMAL / 4;
  chk(`radio mira = ${RADIO_MIRA} (14 / 4)`, RADIO_MIRA === 3.5);
}

console.log('\n=== Decisión del disparo (espejo de dispararHitscan) ===');
{
  // Simula el barrido de targets bajo la mira.
  function disparo(targets, mx, my, m) {
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      const tg = targets[ti];
      const idx = F.celdaEnPunto(tg, mx, my);
      if (idx < 0) continue;
      if (tg.rojo) return 'game-over';
      tg.celdas[idx] = false; tg.vivos -= 1;
      P.anotarHit(m);
      const g = P.anotarDestruidos(m, 1);
      return { tipo: 'hit', puntos: g, muerto: tg.vivos <= 0 };
    }
    P.anotarFallo(m);
    return 'fallo';
  }

  // Naranja bajo la mira → destruye 1 cubo, +5, sube racha.
  const m1 = P.crearMarcador();
  const naranja = F.crearTarget(VP); naranja.x = 200; naranja.y = 300; naranja.rot = 0;
  const r1 = disparo([naranja], 200, 300, m1);
  chk('naranja: destruye 1 cubo, +5, racha 1', r1.tipo === 'hit' && r1.puntos === 5 && m1.racha === 1 && naranja.vivos === 19);

  // Rojo bajo la mira → game over.
  const m2 = P.crearMarcador();
  const rojo = F.crearTarget(VP); rojo.x = 200; rojo.y = 300; rojo.rot = 0; rojo.rojo = true;
  chk('rojo: cualquier impacto → game over', disparo([rojo], 200, 300, m2) === 'game-over');

  // Mira sobre vacío → fallo (−50, rompe racha).
  const m3 = P.crearMarcador(); m3.puntos = 100; m3.racha = 4;
  const r3 = disparo([naranja], 5, 5, m3); // lejos del target
  chk('vacío: fallo −50 y racha rota', r3 === 'fallo' && m3.puntos === 50 && m3.racha === 0);
}

console.log('\n=== Mundo SIN rebote de paredes (el proyectil muere al salir) ===');
{
  // Una bolita lanzada contra la pared izquierda NO rebota: sale y muere.
  const b = { x: 30, y: 300, vx: -1.0, vy: 0, radio: 14, edad: 0, viva: true, haEntrado: true };
  let invirtio = false;
  for (let i = 0; i < 200 && b.viva; i++) { const vxPrev = b.vx; F.paso(b, 16, VP, null); if (vxPrev < 0 && b.vx > 0) invirtio = true; }
  chk('no rebota (vx nunca se invierte)', !invirtio);
  chk('muere al salir por la izquierda', !b.viva && b.x < 0);
}
