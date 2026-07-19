// hitclaud — test: los ESPECIALES son EXENTOS del baño (color de identidad fijo,
// sin halo). node test/especiales.test.js
// Espejo de dibujarSpriteTarget (main.js). Los especiales NO leen la paleta del
// modo; los NORMALES sí. Ningún especial lleva halo.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

// Identidades selladas.
const ID = { estrella: '#FFC300', moneda: '#6FFF2C', enojado: '#1F55C9', cloudA: '#B1003B', cloudB: '#FF0055' };

// Las 4 paletas de modo (base = lo que reciben los NORMALES).
const MODOS = {
  normal:  { base: '#E8704E' }, bonanza: { base: '#FFC300' },
  power:   { base: '#6FFF2C' }, castigo: { base: '#1F55C9' },
};

// Espejo de la lógica de color del cuerpo del target.
function colorTarget(t, modo, now) {
  let col = modo.base;                      // NORMAL: en el baño
  if (t.enojado) col = ID.enojado;          // identidad (exento)
  if (t.bonanza) col = ID.estrella;         // identidad (exento)
  if (t.moneda) col = ID.moneda;            // identidad (exento)
  if (t.cloud) col = Math.floor(now / 100) % 2 ? ID.cloudA : ID.cloudB; // parpadeo identidad
  return col;
}

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== En los 4 modos, los especiales mantienen su IDENTIDAD (no la paleta) ===');
Object.keys(MODOS).forEach(function (k) {
  const m = MODOS[k];
  const est = colorTarget({ bonanza: true }, m, 0);
  const mon = colorTarget({ moneda: true }, m, 0);
  const cl0 = colorTarget({ cloud: true }, m, 0);
  const cl1 = colorTarget({ cloud: true }, m, 100);
  const ok = est === ID.estrella && mon === ID.moneda && cl0 === ID.cloudB && cl1 === ID.cloudA;
  chk(`modo ${k}: estrella ${est} · moneda ${mon} · cloud ${cl0}/${cl1} (identidad, ≠ base ${m.base})`, ok);
});

console.log('\n=== El CloudOver conserva su parpadeo #B1003B ↔ #FF0055 cada 100ms ===');
{
  const seq = [0, 100, 200, 300].map(function (t) { return colorTarget({ cloud: true }, MODOS.power, t); });
  chk(`t=0/100/200/300 → ${seq.map(c => c === ID.cloudA ? 'A' : 'B').join(',')}`, seq[0] === ID.cloudB && seq[1] === ID.cloudA && seq[2] === ID.cloudB && seq[3] === ID.cloudA);
}

console.log('\n=== Los targets NORMALES siguen ENRUTADOS por el baño (modo.base) ===');
Object.keys(MODOS).forEach(function (k) {
  const m = MODOS[k];
  chk(`modo ${k}: normal → ${colorTarget({}, m, 0)} = base`, colorTarget({}, m, 0) === m.base);
});

console.log('\n=== Grep: NINGÚN halo/aura sobre los especiales (ni sobre ningún target) ===');
{
  // El halo se dibujaba como un arco con shadowBlur en coords de MUNDO (t.x,t.y).
  // El sprite del cuerpo dibuja en coords LOCALES (tras translate). Si no queda
  // ningún arc(t.x, t.y ...) el halo de firma se eliminó por completo.
  const haloArco = /arc\(\s*t\.x\s*,\s*t\.y/.test(src);
  chk('sin arc(t.x, t.y ...) = sin halo de firma en targets', !haloArco);
  // Y ninguna referencia a "firma" (la variable del halo eliminado).
  chk('sin variable de halo `firma` en el loop de targets', !/const\s+firma\s*=/.test(src));
}
