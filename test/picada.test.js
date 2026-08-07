// hitclaud — CAMBIO 1 + v2.6: los targets PEQUEÑOS de HitClaud golpeados que NO se destruyen son
// DERRIBADOS y caen describiendo un ARCO (salen del golpe aún viajando; la gravedad los vence poco
// a poco). Reutiliza la mecánica de ShotClaud (derribarShot) con constantes propias (HIT_DERRIBO).
// El GIRO reacciona al golpe (fuerza → magnitud, lado → sentido), acotado. Big Claude y sus islas
// NO se desploman; ShotClaud conserva su caída sin cambios. node test/picada.test.js

const fs = require('fs');
const { crearApp } = require('./harness_dom.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Extrae una función pura por conteo de llaves y la evalúa (patrón de medallas.test.js).
function fn(src, firma) {
  const i = src.indexOf(firma); if (i === -1) return null;
  let prof = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) { const nombre = firma.replace('function ', '').replace(/\(.*/, ''); return new Function(src.slice(i, k + 1) + '\nreturn ' + nombre + ';')(); } } }
  return null;
}

// Arranca HitClaud, hace nacer un target (con horizontal conocida vx=1, flote lunar y giro propio)
// y lo golpea con el hitscan de escritorio en tg.x+dx (dx elige el LADO del impacto). Devuelve el
// target y su estado ANTES del golpe.
function golpear(dx) {
  const caps = [];
  const app = crearApp({ antesDeMain: function (w) {
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    const F = w.Fisica, crt = F.crearTarget;
    F.crearTarget = function () {
      const t = crt.apply(this, arguments);
      t.vx = 1.0; t.vy = 0; t.gravedad = F.FISICA.G_TARGET; t.velRot = 0.01; t.haEntrado = true;
      caps.push(t); return t;
    };
  } });
  const GT = app.window.Fisica.FISICA.G_TARGET;
  app.byId['durJugar'].dispatch('click');
  let tg = null;
  for (let i = 0; i < 40 && !tg; i++) { app.step(16); if (caps.length) tg = caps[caps.length - 1]; }
  const antes = tg ? { vx: tg.vx, g: tg.gravedad, rot: tg.velRot } : null;
  if (tg) app.disparar(tg.x + (dx || 0), tg.y); // golpe en el centro (dx=0) o al lado (dx≠0)
  return { tg: tg, antes: antes, GT: GT };
}

console.log('=== COMPORTAMIENTO: el derribado sale AÚN viajando y cae en arco (HitClaud) ===');
{
  const r = golpear(0);
  const tg = r.tg, GT = r.GT;
  chk('salió un target pequeño para golpear (5×4, no grande)', !!tg && !tg.grande && tg.cols === 5 && tg.filas === 4);
  chk('antes del golpe: horizontal viva (vx≈1) y flote lunar (gravedad = G_TARGET)', !!r.antes && Math.abs(r.antes.vx - 1.0) < 0.05 && Math.abs(r.antes.g - GT) < 1e-9);
  chk('sigue vivo tras el golpe (no se destruyó de un tiro)', !!tg && tg.viva && tg.vivos > 0);
  // v2.6: conserva el 55% de la horizontal (antes 6%): sigue viajando → dibuja el arco.
  chk('conserva el 55% de la velocidad horizontal (arco, no piedra)', !!tg && Math.abs(tg.vx - r.antes.vx * 0.55) < 1e-9);
  // v2.6: gravedad = 1.4 × la lunar (antes 2.0): la vence poco a poco.
  chk('su gravedad es 1.4 veces la normal (G_TARGET × 1.4)', !!tg && Math.abs(tg.gravedad - GT * 1.4) < 1e-12);
  chk('arranca hacia ABAJO (no queda flotando ni subiendo)', !!tg && tg.vy > 0);
}

console.log('=== EL GIRO REACCIONA AL GOLPE: difiere del previo, acotado, sentido por el lado (v2.6) ===');
{
  const GIRO_MIN = parseFloat((main.match(/GIRO_MIN: ([\d.]+),/) || [])[1]);
  const GIRO_MAX = parseFloat((main.match(/GIRO_MAX: ([\d.]+),/) || [])[1]);
  chk('el rango de giro está DEFINIDO y acotado (0 < GIRO_MIN < GIRO_MAX)', GIRO_MIN > 0 && GIRO_MAX > GIRO_MIN);

  const c = golpear(0);
  chk('la rotación tras el golpe DIFIERE de la que traía (ya no la conserva)', !!c.tg && c.tg.velRot !== c.antes.rot);
  chk('la magnitud del giro queda ACOTADA a [GIRO_MIN, GIRO_MAX] (no un trompo)', !!c.tg && Math.abs(c.tg.velRot) >= GIRO_MIN - 1e-12 && Math.abs(c.tg.velRot) <= GIRO_MAX + 1e-12);

  const der = golpear(12);   // golpe a la DERECHA del centro
  const izq = golpear(-12);  // golpe a la IZQUIERDA del centro
  chk('el SENTIDO sigue el lado: golpe a la derecha → giro positivo', !!der.tg && der.tg.velRot > 0);
  chk('el SENTIDO sigue el lado: golpe a la izquierda → giro negativo', !!izq.tg && izq.tg.velRot < 0);
  chk('ambos lados quedan igualmente acotados', !!der.tg && !!izq.tg && Math.abs(der.tg.velRot) <= GIRO_MAX + 1e-12 && Math.abs(izq.tg.velRot) <= GIRO_MAX + 1e-12);
}

console.log('=== BIG CLAUDE y sus ISLAS no se desploman; los pequeños sí (seDesploma sin cambios) ===');
{
  const seDesploma = fn(main, 'function seDesploma(tg)');
  chk('seDesploma existe y es pura', typeof seDesploma === 'function');
  chk('un target pequeño normal SÍ se desploma', seDesploma({}) === true && seDesploma({ grande: false, fragmento: false }) === true);
  chk('Big Claude (grande) NO se desploma → conserva su flote lunar (1.5)', seDesploma({ grande: true }) === false);
  chk('una isla/fragmento NO se desploma → conserva su comportamiento (1.5)', seDesploma({ fragmento: true }) === false);
}

console.log('=== SHOTCLAUD NO cambió: su caída (SHOT.DERRIBO) conserva EXACTAMENTE sus valores ===');
{
  // Los valores actuales de la caída de ShotClaud, clavados: si alguien los toca, esto se cae.
  const shot = main.match(/DERRIBO: \{([\s\S]{0,400}?)\},/);
  const bloque = shot ? shot[1] : '';
  chk('SHOT.DERRIBO.VX_FACTOR sigue en 0.06', /VX_FACTOR: 0\.06,/.test(bloque));
  chk('SHOT.DERRIBO.VY_MIN sigue en 0.12', /VY_MIN: 0\.12,/.test(bloque));
  chk('SHOT.DERRIBO.GRAV_MULT sigue en 2.2', /GRAV_MULT: 2\.2,/.test(bloque));
  chk('SHOT.DERRIBO.VEL_ROT sigue en 0.004', /VEL_ROT: 0\.004,/.test(bloque));
  chk('ShotClaud llama derribarShot(t) SIN 2º arg → usa SHOT.DERRIBO (comportamiento intacto)',
    /derribarShot\(tg\);/.test(main) && (main.match(/derribarShot\(targets\[k\]\)/g) || []).length === 1);
}

console.log('=== REUSO: derribarShot generalizado; HitClaud pasa HIT_DERRIBO (todo en un sitio) ===');
{
  chk('derribarShot toma un juego de constantes `d` (default SHOT.DERRIBO)',
    /function derribarShot\(t, d\) \{\s*d = d \|\| SHOT\.DERRIBO;/.test(main));
  chk('derribarHit reacciona al golpe: fija el giro (giroDerribo) y llama derribarShot(tg, HIT_DERRIBO)',
    /function derribarHit\(tg, mx, my, vImpact\) \{[\s\S]{0,200}tg\.velRot = giroDerribo\(tg, mx, my, vImpact\);[\s\S]{0,80}derribarShot\(tg, HIT_DERRIBO\);/.test(main));
  chk('HIT_DERRIBO documentado con la horizontal, la gravedad y el rango de giro (un solo sitio)',
    /const HIT_DERRIBO = \{[\s\S]{0,120}VX_FACTOR: 0\.55,[\s\S]{0,260}GRAV_MULT: 1\.4,[\s\S]{0,800}GIRO_MIN:[\s\S]{0,160}GIRO_MAX:[\s\S]{0,160}GIRO_POR_FUERZA:/.test(main));
}

console.log(`\n== RESUMEN picada: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
