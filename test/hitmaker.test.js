// hitclaud — FASE 11: hitmaker centrado horizontal, misma altura: node test/hitmaker.test.js
// Valida posición (x = mitad exacta, y idéntica), fuente única, zona de agarre
// centrada sin residuo a la derecha, y reporta el alcance desde el centro.

const F = require('../js/fisica.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(nombre, cond) { console.log(`  ${nombre}  ${cond ? 'OK ✓' : 'NO ✗'}`); if (cond) ok++; else ko++; }

// ── Espejo de la FUENTE ÚNICA de main.js (centroHitmaker) ──────────────────
// main.js: centroHitmaker() = { x: W/2, y: H }; reposo = {x, y-52}; distHitmaker
// = hypot(centro - punto). Definiciones VIEJAS (esquina) para comparar la y.
function centroHitmaker(W, H) { return { x: W / 2, y: H }; }
function reposo(W, H) { const c = centroHitmaker(W, H); return { x: c.x, y: c.y - 52 }; }
function distHitmaker(W, H, x, y) { const c = centroHitmaker(W, H); return Math.hypot(c.x - x, c.y - y); }
function reposoViejo(W, H) { return { x: W - 52, y: H - 52 }; }
function anclaVieja(W, H) { return { x: W, y: H }; }

const RADIO_HITMAKER = 203;

console.log('=== POSICIÓN: x = mitad exacta del ancho; y idéntica al valor previo ===');
{
  [[390, 844], [768, 1024], [320, 568]].forEach(function (vp) {
    const W = vp[0], H = vp[1];
    const c = centroHitmaker(W, H), r = reposo(W, H);
    chk(`${W}×${H}: ancla.x = W/2 = ${W / 2} exacto`, c.x === W / 2);
    chk(`${W}×${H}: reposo.x = W/2 = ${W / 2} exacto`, r.x === W / 2);
    // y del ancla = H (idéntica a la vieja); y del reposo = H-52 (idéntica a la vieja).
    chk(`${W}×${H}: ancla.y = H = ${H} idéntica a la previa`, c.y === anclaVieja(W, H).y);
    chk(`${W}×${H}: reposo.y = H-52 = ${H - 52} idéntica a la previa`, r.y === reposoViejo(W, H).y);
  });
}

console.log('\n=== ZONA DE AGARRE centrada en la nueva x, SIN residuo a la derecha ===');
{
  const W = 390, H = 844;
  const c = centroHitmaker(W, H);
  // El centro-inferior está dentro del radio de agarre.
  chk('ancla dentro del agarre (dist 0 < 203)', distHitmaker(W, H, c.x, c.y) < RADIO_HITMAKER);
  chk('reposo dentro del agarre', distHitmaker(W, H, c.x, c.y - 52) < RADIO_HITMAKER);
  // SIN RESIDUO A LA DERECHA: un punto que SÓLO la vieja zona (ancla en la esquina
  // W,H) cubría queda AHORA FUERA del agarre → la zona viajó al centro, no quedó
  // fantasma en la derecha. (390,620): dentro del viejo disco, fuera del nuevo.
  const dViejo = Math.hypot(W - 390, H - 700);          // ancla vieja (esquina)
  const dNuevo = distHitmaker(W, H, 390, 700);          // ancla nueva (centro)
  chk(`(390,700) estaba en la zona vieja (dist ${dViejo.toFixed(0)} ≤ 203)`, dViejo <= RADIO_HITMAKER);
  chk(`(390,700) YA NO agarra con el centro (dist ${dNuevo.toFixed(0)} > 203) → sin fantasma derecho`, dNuevo > RADIO_HITMAKER);
  // CENTRADO: el agarre es simétrico izquierda/derecha respecto a W/2.
  const dDer = distHitmaker(W, H, c.x + 120, H - 10);
  const dIzq = distHitmaker(W, H, c.x - 120, H - 10);
  chk(`agarre simétrico izq/der respecto a W/2 (${dIzq.toFixed(1)} = ${dDer.toFixed(1)})`, Math.abs(dDer - dIzq) < 1e-9);
}

console.log('\n=== FUENTE ÚNICA: sin definiciones duplicadas del ancla en el código ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
  chk('main.js define centroHitmaker() (fuente única)', /function centroHitmaker\(\)/.test(main));
  chk('reposo() deriva de centroHitmaker (no hardcodea W-52)', /const c = centroHitmaker\(\);\s*\n\s*return \{ x: c\.x, y: c\.y - 52 \}/.test(main));
  chk('distHitmaker() deriva de centroHitmaker (no hardcodea W,H)', /function distHitmaker[\s\S]*?centroHitmaker\(\)/.test(main));
  chk('sin residuo "W - 52" (reposo viejo eliminado)', !/W - 52/.test(main));
  chk('sin residuo "Math.hypot(W - x, H - y)" (dist vieja eliminada)', !/Math\.hypot\(W - x, H - y\)/.test(main));
  chk('sin "distEsquina" (renombrada a distHitmaker)', !/distEsquina/.test(main));
  // CSS: el hitmaker se centra (left:50% + translate -50%), ya no right:0.
  const bloque = css.slice(css.indexOf('.hitmaker {'), css.indexOf('.hitmaker::after'));
  chk('CSS .hitmaker usa left:50% (centrado)', /left:\s*50%/.test(bloque));
  chk('CSS .hitmaker usa translate(-50%, 50%)', /translate\(-50%,\s*50%\)/.test(bloque));
  chk('CSS .hitmaker SIN right:0 (esquina eliminada)', !/right:\s*0/.test(bloque));
  chk('CSS .hitmaker conserva bottom:0 (misma altura)', /bottom:\s*0/.test(bloque));
  chk('CSS .hitmaker conserva 290px (mismo tamaño)', /width:\s*290px/.test(bloque) && /height:\s*290px/.test(bloque));
}

console.log('\n=== ALCANCE desde el CENTRO a V_MAX (report; sin compensar) ===');
{
  const VP = { w: 390, h: 844 };
  const VMAX = F.FISICA.VEL_SALIDA_MAX;
  const GRAB = RADIO_HITMAKER;
  function alcanzable(ancla, tx, ty) {
    const dx = tx - ancla.x, dy = ty - ancla.y, d = Math.hypot(dx, dy);
    const k = Math.min(GRAB, d) / (d || 1);
    const orig = { x: ancla.x + dx * k, y: Math.min(ancla.y, ancla.y + dy * k) };
    for (let a = 0; a < 360; a++) {
      const ang = (a * Math.PI) / 180;
      const b = { x: orig.x, y: orig.y, vx: Math.cos(ang) * VMAX, vy: Math.sin(ang) * VMAX, edad: 0, viva: true };
      for (let f = 0; f < 400 && b.viva; f++) {
        let hit = false;
        F.paso(b, 16.7, VP, function () { if (Math.hypot(b.x - tx, b.y - ty) <= 24) hit = true; });
        if (hit) return true;
      }
    }
    return false;
  }
  const viejo = { x: VP.w - 52, y: VP.h - 52 };
  const nuevo = { x: VP.w / 2, y: VP.h - 52 };
  const zonas = [
    ['top-izq', 30, 40], ['top-centro', 195, 40], ['top-der', 360, 40],
    ['mid-izq', 15, 480], ['mid-der', 375, 480],
    ['sup-centro', 195, 120], ['bajo-izq', 40, 700], ['bajo-der', 350, 700],
  ];
  let regresion = 0, inalcanz = [];
  zonas.forEach(function (z) {
    const av = alcanzable(viejo, z[1], z[2]);
    const an = alcanzable(nuevo, z[1], z[2]);
    console.log(`  ${z[0].padEnd(11)} viejo:${av ? 'alcanza' : 'NO     '}  nuevo:${an ? 'alcanza' : 'NO'}`);
    if (av && !an) regresion++;
    if (!an) inalcanz.push(z[0]);
  });
  chk(`0 regresiones de alcance por centrar (había ${regresion})`, regresion === 0);
  chk(`todas las zonas alcanzables desde el centro (inalcanzables: ${inalcanz.length ? inalcanz.join(',') : 'ninguna'})`, inalcanz.length === 0);
}

console.log(`\n== RESUMEN hitmaker: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
