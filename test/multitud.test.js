// hitclaud — simulación del spawner 60s: node test/multitud.test.js
// Replica la lógica del spawner de main.js (muerte natural, sin hitballs =
// peor caso de multitud). Constantes espejo de main.js.

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };

const MAX_TARGETS = 6;   // espejo de main.js
const SPAWN_MIN = 400;
const SPAWN_MAX = 1200;

let targets = [];
let ultimoOrigen = null;
let proximo = 0;
function rnd(a, b) { return a + Math.random() * (b - a); }
function generar() {
  let t;
  for (let i = 0; i < 12; i++) { t = F.crearTarget(VP); if (t.origen !== ultimoOrigen) break; }
  ultimoOrigen = t.origen;
  targets.push(t);
}

const intervalos = [];
let ultimoSpawn = 0;
let maxVivos = 0;
let sumVivos = 0;
let frames = 0;
let framesGe5 = 0;
const DT = 1000 / 60;

for (let t = 0; t <= 60000; t += DT) {
  for (let i = targets.length - 1; i >= 0; i--) {
    F.paso(targets[i], DT, VP);
    if (!targets[i].viva) {
      targets.splice(i, 1);
      proximo = Math.min(proximo, t + rnd(SPAWN_MIN, SPAWN_MAX)); // espejo de main.js
    }
  }
  if (targets.length < MAX_TARGETS && t >= proximo) {
    generar();
    intervalos.push(t - ultimoSpawn);
    ultimoSpawn = t;
    proximo = t + rnd(SPAWN_MIN, SPAWN_MAX);
  }
  maxVivos = Math.max(maxVivos, targets.length);
  sumVivos += targets.length;
  frames++;
  if (targets.length >= 5) framesGe5++;
}

intervalos.shift(); // el primero (arranque desde 0) no es representativo
const imin = Math.min.apply(null, intervalos);
const imax = Math.max.apply(null, intervalos);
const iprom = intervalos.reduce(function (a, b) { return a + b; }, 0) / intervalos.length;
const rafagas = intervalos.filter(function (d) { return d < 600; }).length;
const pausas = intervalos.filter(function (d) { return d > 1000; }).length;

console.log(`Tope=${MAX_TARGETS}  retardo=${SPAWN_MIN}-${SPAWN_MAX}ms  (60s simulados)`);
console.log(`\nTargets vivos: máximo=${maxVivos}  promedio=${(sumVivos / frames).toFixed(2)}`);
console.log(`% del tiempo con ≥5 vivos: ${(framesGe5 / frames * 100).toFixed(1)}%`);
console.log(`\nIntervalos entre apariciones (${intervalos.length} spawns):`);
console.log(`  mín=${Math.round(imin)}ms  prom=${Math.round(iprom)}ms  máx=${Math.round(imax)}ms`);
console.log(`  ráfagas (<600ms)=${(rafagas / intervalos.length * 100).toFixed(0)}%  pausas (>1000ms)=${(pausas / intervalos.length * 100).toFixed(0)}%`);
console.log(`  retardo máx del spawner = ${SPAWN_MAX}ms → nunca pausa larga`);
console.log(`\nTope respetado: máximo observado ${maxVivos} ${maxVivos <= MAX_TARGETS ? '≤ 6 ✓' : '> 6 ✗'}`);
