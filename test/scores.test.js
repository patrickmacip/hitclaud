// hitclaud — login por NOMBRE + tabla de scores local: node test/scores.test.js

const U = require('../js/util.js');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }
function mockStorage() {
  const d = {};
  return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, _d: d };
}

console.log('=== nombreLimpio: trim, tope 12, default Player ===');
chk('"  Ana  " → "Ana"', U.nombreLimpio('  Ana  ') === 'Ana');
chk('vacío → "Player"', U.nombreLimpio('') === 'Player' && U.nombreLimpio(null) === 'Player' && U.nombreLimpio(undefined) === 'Player');
chk('recorta a 12', U.nombreLimpio('ABCDEFGHIJKLMNOP').length === 12);

console.log('\n=== guardarScore: inserta, ordena desc, recorta al tope ===');
{
  const s = mockStorage();
  const k = 'hitclaud.scores.v1.60';
  U.guardarScore(s, k, 'Ana', 100, 3);
  U.guardarScore(s, k, 'Beto', 300, 3);
  U.guardarScore(s, k, 'Cami', 50, 3);
  const top = U.guardarScore(s, k, 'Dan', 200, 3); // 4º entra, expulsa al menor (Cami 50)
  console.log('  top: ' + top.map(function (e) { return e.nombre + ':' + e.puntos; }).join(', '));
  chk('ordenado desc', top[0].puntos === 300 && top[1].puntos === 200 && top[2].puntos === 100);
  chk('recortado al tope 3', top.length === 3);
  chk('el menor (50) quedó fuera', !top.some(function (e) { return e.puntos === 50; }));
}

console.log('\n=== leerScores: robusto (persistido, vacío, corrupto, sin storage) ===');
{
  const s = mockStorage();
  const k = 'hitclaud.scores.v1.libre';
  U.guardarScore(s, k, 'Eli', 42, 5);
  const otra = U.leerScores(s, k); // "recarga"
  chk('persiste entre lecturas', otra.length === 1 && otra[0].nombre === 'Eli' && otra[0].puntos === 42);
  chk('llave vacía → []', U.leerScores(s, 'no.existe').length === 0);
  s.setItem('corrupta', '{no json');
  chk('JSON corrupto → [] (no lanza)', U.leerScores(s, 'corrupta').length === 0);
  chk('sin storage (null) → []', U.leerScores(null, k).length === 0);
}

console.log('\n=== guardarScore no lanza si el storage falla ===');
{
  const malo = { getItem: function () { return null; }, setItem: function () { throw new Error('QuotaExceeded'); } };
  let lanzo = false;
  try { U.guardarScore(malo, 'k', 'X', 10, 5); } catch (e) { lanzo = true; }
  chk('setItem que lanza no rompe', !lanzo);
}

console.log('\n=== tableros por MODO son independientes ===');
{
  const s = mockStorage();
  U.guardarScore(s, 'hitclaud.scores.v1.60', 'A', 500, 5);
  U.guardarScore(s, 'hitclaud.scores.v1.libre', 'B', 80, 5);
  chk('60 y libre no se mezclan', U.leerScores(s, 'hitclaud.scores.v1.60')[0].nombre === 'A' && U.leerScores(s, 'hitclaud.scores.v1.libre')[0].nombre === 'B');
}
