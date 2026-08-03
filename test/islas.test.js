// hitclaud — FASE 24: islas independientes de Big Claude (física del desprendimiento).
// node test/islas.test.js  (lógica pura + grep; sin DOM)

const fs = require('fs');
const F = require('../js/fisica.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Target 5×4 lleno en (195,400), con velocidad/rotación propias.
function target5x4() {
  const t = F.crearTarget({ w: 390, h: 844 });
  t.x = 195; t.y = 400; t.rot = 0; t.vx = 0.1; t.vy = -0.2; t.velRot = 0.001;
  t.haEntrado = true; t.viva = true; t.edad = 500;
  for (let i = 0; i < t.celdas.length; i++) t.celdas[i] = true;
  t.vivos = t.celdas.length;
  return t;
}

console.log('=== GRAVEDAD: al partirse TODAS las islas caen (G_TARGET), aunque el padre flotara ===');
{
  const t = target5x4();
  t.gravedad = F.FISICA.G_TARGET / 9; // "flote" tipo Big Claude (gravedad /9)
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false; // parte en 2 islas
  t.vivos = t.celdas.filter(Boolean).length;
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  chk('el fragmento pasa a G_TARGET (no hereda el flote /9 del padre)', frags[0].gravedad === F.FISICA.G_TARGET);
  chk('el grupo mayor (objeto original) también pasa a G_TARGET', t.gravedad === F.FISICA.G_TARGET);
}

console.log('=== GIRO PROPIO: velRot nuevas, distintas entre sí y en ±0.06 ===');
{
  const t = target5x4();
  for (let f = 0; f < 4; f++) { t.celdas[f * 5 + 1] = false; t.celdas[f * 5 + 3] = false; } // 3 islas
  t.vivos = t.celdas.filter(Boolean).length;
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5); // 2 frags + mayor (t)
  const velRots = [t.velRot, frags[0].velRot, frags[1].velRot];
  chk('todas las velRot dentro de ±0.06', velRots.every(function (v) { return typeof v === 'number' && Math.abs(v) <= 0.06; }));
  chk('las velRot son distintas entre sí (giro propio, no copiado del padre)', new Set(velRots).size === 3);
}

console.log('=== EMPUJÓN al MAYOR + NO se divide entre el nº de trozos ===');
{
  // 2 islas: mayor + 1 fragmento.
  const a = target5x4();
  for (let f = 0; f < 4; f++) a.celdas[f * 5 + 2] = false;
  a.vivos = a.celdas.filter(Boolean).length;
  const vxA = a.vx, vyA = a.vy; // el fragmento y el empujón se miden contra el vx ORIGINAL
  const fa = F.partirTarget(a, 195, 400, 1.0, 0.5);
  const kickMayor = Math.hypot(a.vx - vxA, a.vy - vyA);
  const kickFrag2 = Math.hypot(fa[0].vx - vxA, fa[0].vy - vyA);
  chk('el grupo mayor recibe empujón (su vx/vy cambió respecto al previo)', a.vx !== vxA || a.vy !== vyA);
  chk('empujón del mayor = 0.5 (|vImpact|·impulsoFactor)', Math.abs(kickMayor - 0.5) < 1e-6);
  // 3 islas: mayor + 2 fragmentos. El empujón por isla debe seguir siendo 0.5, no 0.25.
  const b = target5x4();
  for (let f = 0; f < 4; f++) { b.celdas[f * 5 + 1] = false; b.celdas[f * 5 + 3] = false; }
  b.vivos = b.celdas.filter(Boolean).length;
  const vxB = b.vx, vyB = b.vy;
  const fb = F.partirTarget(b, 195, 400, 1.0, 0.5);
  const kickFrag3 = Math.hypot(fb[0].vx - vxB, fb[0].vy - vyB);
  chk('empujón por isla = 0.5 con 2 islas Y con 3 islas (NO se divide)', Math.abs(kickFrag2 - 0.5) < 1e-6 && Math.abs(kickFrag3 - 0.5) < 1e-6 && Math.abs(kickFrag2 - kickFrag3) < 1e-9);
}

console.log('=== SEPARACIÓN: las islas empujan en direcciones distintas ===');
{
  const t = target5x4();
  for (let f = 0; f < 4; f++) { t.celdas[f * 5 + 1] = false; t.celdas[f * 5 + 3] = false; } // 3 islas
  t.vivos = t.celdas.filter(Boolean).length;
  const vx0 = t.vx, vy0 = t.vy;
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  // Vector de empuje de cada isla (restando la velocidad base heredada del padre).
  const dirs = [
    { x: t.vx - vx0, y: t.vy - vy0 },          // mayor (col 0, izquierda)
    { x: frags[0].vx - vx0, y: frags[0].vy - vy0 },
    { x: frags[1].vx - vx0, y: frags[1].vy - vy0 },
  ];
  function ang(v) { return Math.atan2(v.y, v.x); }
  const a0 = ang(dirs[0]), a1 = ang(dirs[1]), a2 = ang(dirs[2]);
  chk('las tres islas apuntan a direcciones distintas (se abren en abanico)', Math.abs(a0 - a1) > 1e-3 && Math.abs(a1 - a2) > 1e-3 && Math.abs(a0 - a2) > 1e-3);
}

console.log('=== REGRESIÓN: conteo de cubos conservado + fragmento de rojo no mata ===');
{
  const t = target5x4();
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false;
  t.vivos = t.celdas.filter(Boolean).length; // 16
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  const total = t.vivos + frags.reduce(function (s, fr) { return s + fr.vivos; }, 0);
  chk('conteo total de cubos conservado (mayor + trozos = 16)', total === 16);
  chk('los fragmentos NO son rojos (un trozo nunca es CloudOver)', frags.every(function (fr) { return !fr.rojo; }));
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  chk('main.js: el guard de rojo excluye fragmentos (if (tg.rojo && !tg.fragmento))', /if \(tg\.rojo && !tg\.fragmento\)/.test(main));
}

console.log(`\n== RESUMEN islas: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
