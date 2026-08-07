// hitclaud — CAMBIO 1: los targets PEQUEÑOS de HitClaud golpeados que NO se destruyen CAEN EN
// PICADA (pierden la velocidad horizontal y la gravedad toma el control). Reutiliza la mecánica
// de ShotClaud (derribarShot) con constantes propias (HIT_DERRIBO). Big Claude y sus islas NO se
// desploman (1.5). node test/picada.test.js

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

console.log('=== COMPORTAMIENTO: un target pequeño golpeado pierde la horizontal y cae (HitClaud) ===');
{
  // Cada target nace con una horizontal conocida (vx=1), flote lunar (G_TARGET) y giro propio.
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

  // Arranca HitClaud (el home abre aquí) y avanza hasta que exista un target; dispara SOBRE él.
  app.byId['durJugar'].dispatch('click');
  let tg = null;
  for (let i = 0; i < 40 && !tg; i++) { app.step(16); if (caps.length) tg = caps[caps.length - 1]; }
  chk('salió un target pequeño para golpear (5×4, no grande)', !!tg && !tg.grande && tg.cols === 5 && tg.filas === 4);

  // ANTES del tiro: conserva su trayectoria (horizontal viva, flote lunar).
  const vxAntes = tg ? tg.vx : 0, gAntes = tg ? tg.gravedad : 0, rotAntes = tg ? tg.velRot : 0;
  chk('antes del golpe: horizontal viva (vx≈1) y flote lunar (gravedad = G_TARGET)', !!tg && Math.abs(vxAntes - 1.0) < 0.05 && Math.abs(gAntes - GT) < 1e-9);

  app.disparar(tg.x, tg.y);   // hitscan de escritorio sobre el centro del target → 1 cubo, sobrevive

  chk('sigue vivo tras el golpe (no se destruyó de un tiro)', !!tg && tg.viva && tg.vivos > 0);
  chk('la horizontal se CORTA casi por completo (|vx| ≪ el original)', !!tg && Math.abs(tg.vx) < Math.abs(vxAntes) * 0.2);
  chk('la gravedad de caída se INTENSIFICA (pasa de flote lunar a picada)', !!tg && tg.gravedad > gAntes * 1.5);
  chk('arranca hacia ABAJO (no queda flotando ni subiendo)', !!tg && tg.vy > 0);
  chk('conserva su ROTACIÓN (se lee el impacto, 1.2)', !!tg && tg.velRot === rotAntes);
}

console.log('=== BIG CLAUDE y sus ISLAS no se desploman; los pequeños sí (seDesploma) ===');
{
  const seDesploma = fn(main, 'function seDesploma(tg)');
  chk('seDesploma existe y es pura', typeof seDesploma === 'function');
  chk('un target pequeño normal SÍ se desploma', seDesploma({}) === true && seDesploma({ grande: false, fragmento: false }) === true);
  chk('Big Claude (grande) NO se desploma → conserva su flote lunar (1.5)', seDesploma({ grande: true }) === false);
  chk('una isla/fragmento NO se desploma → conserva su comportamiento (1.5)', seDesploma({ fragmento: true }) === false);
}

console.log('=== REUSO: derribarShot generalizado; ShotClaud sigue usando SU juego de constantes ===');
{
  chk('derribarShot toma un juego de constantes `d` (default SHOT.DERRIBO → ShotClaud intacto)',
    /function derribarShot\(t, d\) \{\s*d = d \|\| SHOT\.DERRIBO;/.test(main));
  chk('HitClaud pasa sus PROPIAS constantes (HIT_DERRIBO) — es otro juego (1.6)',
    /function derribarHit\(tg\) \{ if \(seDesploma\(tg\)\) derribarShot\(tg, HIT_DERRIBO\); \}/.test(main));
  chk('HIT_DERRIBO documentado: corta la horizontal, arranca abajo, intensifica la gravedad, gira',
    /const HIT_DERRIBO = \{[\s\S]{0,200}VX_FACTOR:[\s\S]{0,140}VY_MIN:[\s\S]{0,140}GRAV_MULT:[\s\S]{0,140}VEL_ROT:/.test(main));
  chk('ShotClaud NO cambió: sigue llamando derribarShot(t) sin 2º arg (usa SHOT.DERRIBO)',
    /derribarShot\(tg\);/.test(main) && (main.match(/derribarShot\(targets\[k\]\)/g) || []).length === 1);
}

console.log(`\n== RESUMEN picada: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
