// hitclaud — castigo PLANO por fallo: node test/castigo.test.js
// Un fallo resta FALLO (50), plano. Sin tramos, sin escalado por consecutivos,
// sin amortiguador. Piso en 0, rompe la racha.

const P = require('../js/puntuacion.js');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Un fallo resta 50 (plano) ===');
{
  const m = P.crearMarcador(); m.puntos = 500;
  const pen = P.anotarFallo(m);
  chk(`fallo → −${pen}, queda ${m.puntos}`, pen === 50 && m.puntos === 450);
}

console.log('\n=== Fallos consecutivos NO escalan (siempre 50) ===');
{
  const m = P.crearMarcador(); m.puntos = 1000;
  const pens = [];
  for (let i = 0; i < 4; i++) pens.push(P.anotarFallo(m));
  chk(`4 fallos: −${pens.join('/−')} (todos 50)`, pens.every(function (p) { return p === 50; }));
}

console.log('\n=== Da igual el score: 50 plano en cualquier tramo ===');
[0, 2000, 30000, 100000].forEach(function (s) {
  const m = P.crearMarcador(); m.puntos = s + 100;
  chk(`score ~${s} → fallo −${P.anotarFallo(m)}`, m.puntos === s + 50);
});

console.log('\n=== Piso en 0 + rompe racha ===');
{
  const m = P.crearMarcador(); m.puntos = 30; m.racha = 5;
  P.anotarFallo(m);
  chk(`fallo con 30 → queda ${m.puntos}, racha ${m.racha}`, m.puntos === 0 && m.racha === 0);
  const m2 = P.crearMarcador(); // 0
  P.anotarFallo(m2);
  chk('fallo con 0 → sigue 0', m2.puntos === 0);
}

console.log('\n=== FALLO expuesto como constante ===');
chk('P.FALLO === 50', P.FALLO === 50);
