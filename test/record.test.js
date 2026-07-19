// hitclaud — test del récord en vivo persistente: node test/record.test.js

const U = require('../js/util.js');

// Mock de localStorage (guarda en un objeto).
function mockStorage() {
  const data = {};
  return {
    getItem: function (k) { return k in data ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    _data: data,
  };
}

console.log('=== Récord sube EN VIVO al superarse (mismo cuadro) ===');
{
  const r = U.crearRecord(mockStorage(), 'rec', 500);
  const subio1 = r.considerar(100, 0);
  const subio2 = r.considerar(90, 100); // no supera
  const subio3 = r.considerar(150, 200);
  console.log(`  100→${r.valor} (subió=${subio1})  90→${r.valor} (subió=${subio2})  150→${r.valor} (subió=${subio3})`);
  console.log(`  valor=${r.valor} en vivo, no baja con score menor: ${r.valor === 150 && subio1 && !subio2 && subio3 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Throttle: subida sostenida = pocas escrituras (1 cada 500ms) ===');
{
  const s = mockStorage();
  const r = U.crearRecord(s, 'rec', 500);
  // 600 cuadros a 60fps (10s), score sube 1/cuadro → récord sube cada cuadro.
  for (let f = 0; f < 600; f++) r.considerar(f + 1, f * 16.7);
  r.flush(600 * 16.7);
  // 10s / 500ms ≈ 20 escrituras (+1 flush final). Muy por debajo de 600.
  console.log(`  600 cuadros con récord subiendo cada uno → escrituras=${r.escrituras}`);
  console.log(`  throttle respetado (≤22, no 600): ${r.escrituras <= 22 ? 'OK ✓' : 'NO ✗'}   valor final=${r.valor}`);
}

console.log('\n=== Persistencia: recarga conserva el récord ===');
{
  const s = mockStorage();
  const r1 = U.crearRecord(s, 'rec', 500);
  r1.considerar(4242, 0);
  r1.flush(0); // guarda
  // "recarga": nueva instancia con el MISMO storage
  const r2 = U.crearRecord(s, 'rec', 500);
  console.log(`  guardado=${s._data.rec}  récord tras recarga=${r2.valor}  ${r2.valor === 4242 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Reset por versión de llave: la vieja se ignora, persiste en la nueva ===');
{
  const VIEJA = 'hitclaud.record', NUEVA = 'hitclaud.record.v2';
  const s = mockStorage();
  s.setItem(VIEJA, '99999'); // récord viejo de la economía anterior
  // El juego arranca leyendo SOLO la llave nueva → récord 0.
  const r = U.crearRecord(s, NUEVA, 500);
  console.log(`  llave vieja '${VIEJA}'=${s._data[VIEJA]} (ignorada) → arranca en ${r.valor}  ${r.valor === 0 ? 'OK ✓' : 'NO ✗'}`);
  // Persiste en la llave NUEVA, sin tocar la vieja.
  r.considerar(1234, 0); r.flush(0);
  console.log(`  persiste en '${NUEVA}'=${s._data[NUEVA]}  ${s._data[NUEVA] === '1234' ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  la vieja queda intacta e ignorada: ${s._data[VIEJA] === '99999' ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Robustez: localStorage bloqueado → juego vive, récord en memoria ===');
{
  // storage null (window.localStorage lanzó / no existe)
  const r = U.crearRecord(null, 'rec', 500);
  let lanzo = false;
  try {
    r.considerar(500, 0);
    r.considerar(800, 600);
    r.flush(700);
  } catch (e) { lanzo = true; }
  console.log(`  sin lanzar: ${!lanzo ? 'OK ✓' : 'NO ✗'}   récord en memoria=${r.valor} (${r.valor === 800 ? 'OK ✓' : 'NO ✗'})   escrituras=${r.escrituras} (0 esperado)`);

  // storage que LANZA en setItem (cuota / modo privado iOS)
  const malo = { getItem: function () { return null; }, setItem: function () { throw new Error('QuotaExceeded'); } };
  const r2 = U.crearRecord(malo, 'rec', 500);
  let lanzo2 = false;
  try { r2.considerar(999, 0); r2.flush(0); } catch (e) { lanzo2 = true; }
  console.log(`  setItem que lanza no rompe: ${!lanzo2 ? 'OK ✓' : 'NO ✗'}   récord en memoria=${r2.valor}`);
}
