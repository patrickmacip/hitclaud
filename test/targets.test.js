// hitclaud — spawn CAÓTICO MULTI-ORIGEN: node test/targets.test.js
// crearTarget produce los 4 orígenes con velocidad variable y arcos jugables.
// Viewport 390×844.

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Los CUATRO orígenes aparecen (abajo, arriba, lat-izq, lat-der) ===');
{
  const c = {};
  for (let i = 0; i < 8000; i++) { const o = F.crearTarget(VP).origen; c[o] = (c[o] || 0) + 1; }
  const req = ['inferior', 'superior', 'lateral-izq', 'lateral-der'];
  req.forEach(function (o) { chk(`${o}: ${((100 * (c[o] || 0)) / 8000).toFixed(0)}%`, (c[o] || 0) > 100); });
  chk('sólo esos 4 orígenes (sin residuos)', Object.keys(c).every(function (k) { return req.indexOf(k) !== -1; }));
}

console.log('\n=== Velocidad VARIABLE por target (lentos y rápidos mezclados) ===');
{
  const spd = [];
  for (let i = 0; i < 8000; i++) { const t = F.crearTarget(VP); spd.push(Math.hypot(t.vx, t.vy)); }
  spd.sort(function (a, b) { return a - b; });
  const min = spd[0], med = spd[spd.length >> 1], max = spd[spd.length - 1];
  console.log(`  velocidad px/ms: min ${min.toFixed(2)} · mediana ${med.toFixed(2)} · max ${max.toFixed(2)}`);
  chk('hay spread real (max ≥ 2× min)', max >= 2 * min);
  chk('todas dentro de un rango jugable (0.05–2.0 px/ms)', min > 0.05 && max < 2.0);
}

console.log('\n=== Cada origen ENTRA al área jugable y es VISIBLE ≥700ms (alcanzable) ===');
{
  function visMs(t) {
    let dentro = 0, tt = 0;
    while (t.viva && tt < 10000) {
      F.paso(t, 16, VP);
      if (t.x > 0.03 * VP.w && t.x < 0.97 * VP.w && t.y > 0.03 * VP.h && t.y < 0.97 * VP.h) dentro += 16;
      tt += 16;
    }
    return dentro;
  }
  const by = {};
  for (let i = 0; i < 4000; i++) { const t = F.crearTarget(VP); const o = t.origen; (by[o] = by[o] || { n: 0, ok: 0, sum: 0 }); const v = visMs(t); by[o].n++; by[o].sum += v; if (v >= 700) by[o].ok++; }
  ['inferior', 'superior', 'lateral-izq', 'lateral-der'].forEach(function (o) {
    const b = by[o];
    chk(`${o}: ${((100 * b.ok) / b.n).toFixed(0)}% visibles ≥700ms · medio ${(b.sum / b.n).toFixed(0)}ms`, b.ok / b.n >= 0.80);
  });
}

console.log('\n=== Inferior sube en arco SIN cruzar el techo (no muere arriba) ===');
{
  let peorApex = 0, murioArriba = 0;
  for (let i = 0; i < 2000; i++) {
    let t; do { t = F.crearTarget(VP); } while (t.origen !== 'inferior');
    let minY = t.y, tt = 0;
    while (t.viva && tt < 8000) { F.paso(t, 16, VP); minY = Math.min(minY, t.y); tt += 16; }
    peorApex = Math.max(peorApex, VP.h - minY);
    if (minY < 0) murioArriba++;
  }
  console.log(`  ápice máximo observado ${peorApex.toFixed(0)}px de ${VP.h} (${((100 * peorApex) / VP.h).toFixed(0)}%)`);
  chk('ningún inferior cruza el techo', murioArriba === 0);
}
