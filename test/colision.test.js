// hitclaud — test de colisión hitball↔target: node test/colision.test.js

const F = require('../js/fisica.js');

function target(x, y, rot, vx, vy) {
  return { x: x, y: y, rot: rot || 0, vx: vx || 0, vy: vy || 0, golpeado: false };
}
function bola(x, y, vx, vy) {
  return { x: x, y: y, vx: vx, vy: vy, edad: 0, viva: true };
}
function rap(o) { return Math.hypot(o.vx, o.vy).toFixed(3); }

console.log(`Constantes: UMBRAL_DESTRUCCION=${F.FISICA.UMBRAL_DESTRUCCION} px/ms  ` +
  `MASA_TARGET=${F.FISICA.MASA_TARGET}  RESTITUCION_GOLPE=${F.FISICA.RESTITUCION_GOLPE}`);

// (a) Frontal FUERTE: bola entra por la cara izquierda (x=180) a 1.5 px/ms.
console.log('\n(a) Impacto frontal FUERTE');
{
  const t = target(200, 400);
  const b = bola(180 - 14 + 12, 400, 1.5, 0); // solapa la cara izquierda
  console.log(`  bola antes: rapidez=${rap(b)} vx=${b.vx.toFixed(2)}`);
  const r = F.resolverImpacto(b, t);
  console.log(`  destruido=${r.destruido}  vImpact=${r.vImpact.toFixed(2)}`);
  console.log(`  bola después: rapidez=${rap(b)} vx=${b.vx.toFixed(2)} (rebota, menos veloz)`);
}

// (b) Frontal SUAVE: misma geometría a 0.5 px/ms.
console.log('\n(b) Impacto SUAVE');
{
  const t = target(200, 400);
  const b = bola(180 - 14 + 12, 400, 0.5, 0);
  console.log(`  bola antes: rapidez=${rap(b)}   target antes: rapidez=${rap(t)}`);
  const r = F.resolverImpacto(b, t);
  console.log(`  destruido=${r.destruido}  target.golpeado=${t.golpeado}`);
  console.log(`  bola después: rapidez=${rap(b)} vx=${b.vx.toFixed(2)} (rebota)`);
  console.log(`  target después: rapidez=${rap(t)} vx=${t.vx.toFixed(2)} (empujado)`);
}

// (c) Oblicuo: bola baja-derecha contra la cara superior (y=384) → rebote coherente.
console.log('\n(c) Impacto OBLICUO (cara superior, normal ≈ (0,-1))');
{
  const t = target(200, 400);
  const b = bola(200, 384 - 14 + 12, 0.7, 0.7); // sobre la cara superior, baja-derecha
  console.log(`  bola antes: vx=${b.vx.toFixed(2)} vy=${b.vy.toFixed(2)}`);
  const r = F.resolverImpacto(b, t);
  console.log(`  normal=(${r.nx.toFixed(2)},${r.ny.toFixed(2)}) destruido=${r.destruido}`);
  console.log(`  bola después: vx=${b.vx.toFixed(2)} vy=${b.vy.toFixed(2)} (vy invertida, vx conservada)`);
}

// (d) Carambola: una bola fuerte golpea DOS targets alineados.
console.log('\n(d) Carambola: una bola, dos targets');
{
  const t1 = target(200, 400);
  const t2 = target(260, 400);
  const b = bola(180 - 14 + 12, 400, 1.8, 0);
  const r1 = F.resolverImpacto(b, t1);
  console.log(`  target1: destruido=${r1.destruido} vImpact=${r1.vImpact.toFixed(2)}  bola→ rapidez=${rap(b)} vx=${b.vx.toFixed(2)}`);
  // Tras rebotar, la bola va hacia la izquierda; para probar el 2º golpe,
  // simulamos que sigue con su velocidad y golpea t2 puesto a su paso.
  const b2 = bola(240 - 14 + 12, 400, 1.2, 0); // segundo tramo del vuelo
  const r2 = F.resolverImpacto(b2, t2);
  console.log(`  target2: destruido=${r2.destruido} vImpact=${r2.vImpact.toFixed(2)}  bola→ rapidez=${rap(b2)} vx=${b2.vx.toFixed(2)}`);
  console.log('  → una hitball puede destruir varios targets en su vuelo (carambola).');
}
