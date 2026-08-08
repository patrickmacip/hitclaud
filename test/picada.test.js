// hitclaud — CAMBIO 1 + v2.6: los targets PEQUEÑOS de HitClaud golpeados que NO se destruyen son
// DERRIBADOS y caen describiendo un ARCO (salen del golpe aún viajando; la gravedad los vence poco
// a poco). Reutiliza la mecánica de ShotClaud (derribarShot) con constantes propias (HIT_DERRIBO).
// El GIRO reacciona al golpe (fuerza → magnitud, lado → sentido), acotado. Big Claude y sus islas
// NO se desploman; ShotClaud conserva su caída sin cambios.
//
// NOTA (rediseño v2.7): Hitcloude es TÁCTIL → sólo se juega en móvil (arrastre), donde no hay
// hitscan que disparar en el arnés. La TRANSFORMACIÓN de la caída (derribarShot + giroDerribo +
// HIT_DERRIBO) se verifica como UNIDAD pura (extraída del fuente), y el CABLEADO (que la hit-path
// llama derribarHit) se verifica sobre el fuente. node test/picada.test.js

const fs = require('fs');
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

// Arma la MECÁNICA de la caída de HitClaud tal como vive en main.js: extrae derribarShot (que toma
// F.FISICA.G_TARGET) junto con HIT_DERRIBO/seDesploma/giroDerribo, y la evalúa con un F falso. Así se
// prueba la transformación EXACTA (misma que corre en el juego), sin depender del arnés.
function armarDerribo() {
  const iShot = main.indexOf('function derribarShot(t, d)');
  const iFin = main.indexOf('function derribarHit(');           // hasta justo antes de derribarHit
  const bloque = main.slice(iShot, iFin);
  const F = { FISICA: { G_TARGET: 0.0021 } };
  return new Function('F', bloque + '\n return { derribarShot: derribarShot, giroDerribo: giroDerribo, HIT_DERRIBO: HIT_DERRIBO, seDesploma: seDesploma };')(F);
}
const D = armarDerribo();
const GT = 0.0021;

console.log('=== COMPORTAMIENTO: el derribado sale AÚN viajando y cae en arco (HitClaud) ===');
{
  // Un target con horizontal conocida (vx=1), flote lunar (G_TARGET) y giro propio (0.01).
  const tg = { x: 200, y: 200, vx: 1.0, vy: 0, gravedad: GT, velRot: 0.01 };
  D.derribarHitSim = function (t, mx, vImpact) { t.velRot = D.giroDerribo(t, mx, t.y, vImpact); D.derribarShot(t, D.HIT_DERRIBO); };
  D.derribarHitSim(tg, tg.x, 1.0); // golpe al centro, fuerza nominal 1
  // v2.6: conserva el 55% de la horizontal (antes 6%): sigue viajando → dibuja el arco.
  chk('conserva el 55% de la velocidad horizontal (arco, no piedra)', Math.abs(tg.vx - 0.55) < 1e-9);
  // v2.6: gravedad = 1.4 × la lunar (antes 2.0): la vence poco a poco.
  chk('su gravedad es 1.4 veces la normal (G_TARGET × 1.4)', Math.abs(tg.gravedad - GT * 1.4) < 1e-12);
  chk('arranca hacia ABAJO (no queda flotando ni subiendo)', tg.vy > 0);
}

console.log('=== EL GIRO REACCIONA AL GOLPE: difiere del previo, acotado, sentido por el lado (v2.6) ===');
{
  const GIRO_MIN = D.HIT_DERRIBO.GIRO_MIN, GIRO_MAX = D.HIT_DERRIBO.GIRO_MAX;
  chk('el rango de giro está DEFINIDO y acotado (0 < GIRO_MIN < GIRO_MAX)', GIRO_MIN > 0 && GIRO_MAX > GIRO_MIN);

  const centro = { x: 200, y: 200 };
  const gc = D.giroDerribo(centro, centro.x, centro.y, 1.0);
  chk('la rotación tras el golpe DIFIERE de la que traía (0.01) — la reemplaza', gc !== 0.01);
  chk('la magnitud del giro queda ACOTADA a [GIRO_MIN, GIRO_MAX] (no un trompo)', Math.abs(gc) >= GIRO_MIN - 1e-12 && Math.abs(gc) <= GIRO_MAX + 1e-12);
  // Golpe FUERTE gira más que uno flojo (hasta el tope).
  const flojo = Math.abs(D.giroDerribo(centro, centro.x, centro.y, 0.2));
  const fuerte = Math.abs(D.giroDerribo(centro, centro.x, centro.y, 1.0));
  chk('un golpe más fuerte gira más (hasta el tope)', fuerte >= flojo);

  const der = D.giroDerribo({ x: 200, y: 200 }, 212, 200, 1.0);  // golpe a la DERECHA del centro
  const izq = D.giroDerribo({ x: 200, y: 200 }, 188, 200, 1.0);  // golpe a la IZQUIERDA del centro
  chk('el SENTIDO sigue el lado: golpe a la derecha → giro positivo', der > 0);
  chk('el SENTIDO sigue el lado: golpe a la izquierda → giro negativo', izq < 0);
  chk('ambos lados quedan igualmente acotados', Math.abs(der) <= GIRO_MAX + 1e-12 && Math.abs(izq) <= GIRO_MAX + 1e-12);
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
