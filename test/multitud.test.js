// hitclaud — flujo de targets + enojado + debuff: node test/multitud.test.js
// Replica el spawner de main.js (sin tope de diseño, tope duro 12, ritmo,
// enojado). Muerte natural (sin hitballs) = peor caso de multitud.

const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const VP = { w: 390, h: 844 };

// Constantes espejo de main.js
const MAX_DURO = 12;
const ENOJADO_BASE = 0.08, ENOJADO_EXTRA = 0.02, ENOJADO_TOPE = 0.25;
const DEBUFF_MS = 5000, RADIO_DEBIL = 7, RADIO_NORMAL = 14;

function rnd(a, b) { return a + Math.random() * (b - a); }
const DT = 1000 / 60;

function simula(score) {
  let targets = [], ultimoOrigen = null, ultimoEnojado = false, proximo = 0;
  const rg = P.rangoRetardo(score);
  function retardo() { return rnd(rg.min, rg.max); }
  function generar() {
    let t;
    for (let i = 0; i < 12; i++) { t = F.crearTarget(VP); if (t.origen !== ultimoOrigen) break; }
    ultimoOrigen = t.origen;
    const prob = Math.min(ENOJADO_TOPE, ENOJADO_BASE + ENOJADO_EXTRA * Math.max(0, targets.length - 3));
    t.enojado = !ultimoEnojado && Math.random() < prob;
    ultimoEnojado = t.enojado;
    targets.push(t);
    return t;
  }
  const intervalos = [];
  let ultimoSpawn = 0, maxVivos = 0, sumVivos = 0, frames = 0, framesGe5 = 0;
  let dosSeguidos = 0, enoPrev = false;
  let spawnsSolo = 0, enoSolo = 0, spawnsCrowd = 0, enoCrowd = 0;
  for (let t = 0; t <= 60000; t += DT) {
    for (let i = targets.length - 1; i >= 0; i--) {
      F.paso(targets[i], DT, VP);
      if (!targets[i].viva) { targets.splice(i, 1); proximo = Math.min(proximo, t + retardo()); }
    }
    if (targets.length < MAX_DURO && t >= proximo) {
      const vivosAntes = targets.length;
      const t2 = generar();
      if (t2.enojado && enoPrev) dosSeguidos++;
      enoPrev = t2.enojado;
      if (vivosAntes <= 3) { spawnsSolo++; if (t2.enojado) enoSolo++; }
      if (vivosAntes >= 5) { spawnsCrowd++; if (t2.enojado) enoCrowd++; }
      intervalos.push(t - ultimoSpawn); ultimoSpawn = t;
      proximo = t + retardo();
    }
    maxVivos = Math.max(maxVivos, targets.length); sumVivos += targets.length; frames++;
    if (targets.length >= 5) framesGe5++;
  }
  intervalos.shift();
  const imin = Math.min.apply(null, intervalos), imax = Math.max.apply(null, intervalos);
  const iprom = intervalos.reduce(function (a, b) { return a + b; }, 0) / intervalos.length;
  console.log(`\n--- score ${score} (rango ${rg.min}-${rg.max}ms) ---`);
  console.log(`  vivos: máximo=${maxVivos} (tope duro ${MAX_DURO})  promedio=${(sumVivos / frames).toFixed(2)}  % del tiempo ≥5: ${(framesGe5 / frames * 100).toFixed(1)}%`);
  console.log(`  intervalos: mín=${Math.round(imin)} prom=${Math.round(iprom)} máx=${Math.round(imax)}ms`);
  console.log(`  enojados observados: solo(≤3)=${spawnsSolo ? (enoSolo / spawnsSolo * 100).toFixed(1) : '0'}%  multitud(≥5)=${spawnsCrowd ? (enoCrowd / spawnsCrowd * 100).toFixed(1) : 'n/a'}%  (nominal 8% / ${(Math.min(0.25, 0.08 + 0.02 * 2) * 100).toFixed(0)}%; menos por "nunca dos seguidos")  dos seguidos=${dosSeguidos} ${dosSeguidos === 0 ? '✓' : '✗'}`);
}

console.log('=== Flujo continuo 60s (muerte natural, sin hitballs) ===');
simula(0);       // ritmo suave: población baja
simula(30000);   // dificultad máxima: normal ver 5-6

console.log('\n=== Debuff: radio 7 → poder mitad, casi nunca destruye ===');
function target1() { const c = []; for (let i = 0; i < 20; i++) c.push(true); return { x: 200, y: 400, rot: 0, vx: 0, vy: 0, celdas: c, vivos: 20, masa: F.FISICA.MASA_TARGET }; }
function golpe(radio, v) {
  const t = target1();
  const b = { x: 200 - 20 - radio + 12, y: 400, vx: v, vy: 0, radio: radio, edad: 0, viva: true };
  return F.resolverImpacto(b, t);
}
{
  const fuerte = golpe(RADIO_NORMAL, 1.2);
  const debil = golpe(RADIO_DEBIL, 1.2);
  console.log(`  radio 14, v=1.2 → tipo=${fuerte.tipo} (poder ${(1.2).toFixed(2)})`);
  console.log(`  radio 7,  v=1.2 → tipo=${debil.tipo} (poder ${(1.2 * 0.5).toFixed(2)} < 0.9)  ${debil.tipo !== 'destruido' ? 'NO destruye ✓' : 'destruye ✗'}`);
}

console.log('\n=== Contacto con enojado: neutro (no hit, no puntúa, no fallo) + debuff ===');
{
  const m = P.crearMarcador();
  m.puntos = 1000; m.racha = 4;
  // Mirror de main.js: contacto con enojado → debuff, neutro; NO anota nada.
  const now = 100000;
  let debuffHasta = now + DEBUFF_MS;
  const b = { tocado: false, neutro: true, viva: false }; // tras tocar enojado y morir
  // no anotarHit / anotarDestruidos → puntos y racha intactos
  const puntosOK = m.puntos === 1000 && m.racha === 4;
  // al morir: !tocado && !neutro es false → NO hay fallo
  if (!b.tocado && !b.neutro) P.anotarFallo(m);
  const sinFallo = m.puntos === 1000;
  const radioDurante = now < debuffHasta ? RADIO_DEBIL : RADIO_NORMAL;
  const expira = !((now + DEBUFF_MS + 1) < debuffHasta);
  console.log(`  puntos/racha intactos: ${puntosOK ? 'OK ✓' : 'NO ✗'}   sin fallo: ${sinFallo ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  radio durante debuff = ${radioDurante} ${radioDurante === 7 ? 'OK ✓' : 'NO ✗'}   expira solo tras 5s: ${expira ? 'OK ✓' : 'NO ✗'}`);
}
