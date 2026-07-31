// hitclaud — FASE 14 commit 1: cola METEORO (fuera los 3 fantasmas).
// node test/estela.test.js

const U = require('../js/util.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

const R = 14;
const HEAD = 0.9 * R; // semi-ancho de la cabeza = 90% del diámetro / 2

// Historia con separación uniforme `sep` px hacia atrás (recién→viejo). El primer
// punto coincide con la cabeza (como en el juego: unshift de la pos actual).
function histLineal(hx, hy, sep, n) {
  const h = [];
  for (let i = 0; i < n; i++) h.push({ x: hx - i * sep, y: hy });
  return h;
}

console.log('=== Bola QUIETA / agarrada → sin cola (null, sin degenerados) ===');
{
  const quieta = histLineal(100, 100, 0, 6); // todos los puntos iguales a la cabeza
  chk('historia sin recorrido → null', U.estelaMeteoro(100, 100, quieta, R, 5) === null);
  chk('historia vacía → null', U.estelaMeteoro(100, 100, [], R, 5) === null);
  chk('historia null → null', U.estelaMeteoro(100, 100, null, R, 5) === null);
  // Deriva sub-píxel (bola casi quieta): cola nula o ≤2px = casi invisible, sin degenerados.
  const casiQuieta = U.estelaMeteoro(100, 100, histLineal(100, 100, 0.3, 6), R, 5);
  chk('deriva sub-píxel → cola nula o ≤2px (casi invisible)', casiQuieta === null || casiQuieta.len <= 2);
}

console.log('=== Bola en MOVIMIENTO → polilínea ≤5 puntos, grosor y alfa a 0 ===');
{
  const e = U.estelaMeteoro(200, 300, histLineal(200, 300, 30, 8), R, 5);
  chk('devuelve objeto con pts y len', !!e && Array.isArray(e.pts));
  chk('≤5 puntos (cap respetado aunque haya 8 de historia)', e.pts.length <= 5);
  chk('cabeza: semi-ancho = 0.9·radio', Math.abs(e.pts[0].w - HEAD) < 1e-9);
  chk('cabeza: alfa = 0.45', Math.abs(e.pts[0].a - 0.45) < 1e-9);
  chk('punta: semi-ancho = 0 EXACTO', e.pts[e.pts.length - 1].w === 0);
  chk('punta: alfa = 0 EXACTO', e.pts[e.pts.length - 1].a === 0);
  // Monótonos: el grosor y el alfa sólo bajan de la cabeza a la punta.
  let mono = true;
  for (let i = 1; i < e.pts.length; i++) { if (e.pts[i].w > e.pts[i - 1].w || e.pts[i].a > e.pts[i - 1].a) mono = false; }
  chk('grosor y alfa estrictamente no crecientes', mono);
  chk('sin NaN en puntos/anchos/alfas', e.pts.every(function (p) { return isFinite(p.x) && isFinite(p.y) && isFinite(p.w) && isFinite(p.a); }));
}

console.log('=== Largo escala con la velocidad (puntos más separados = cola más larga) ===');
{
  const lento = U.estelaMeteoro(0, 0, histLineal(0, 0, 6, 6), R, 5);
  const rapido = U.estelaMeteoro(0, 0, histLineal(0, 0, 34, 6), R, 5);
  chk('cola rápida más larga que la lenta', rapido.len > lento.len);
  chk('cola lenta corta (bola apenas se mueve → casi invisible)', lento.len < rapido.len / 3);
}

console.log('=== Bolita dispersa (mismo radio 14) usa la misma forma escalada ===');
{
  const e = U.estelaMeteoro(50, 50, histLineal(50, 50, 20, 6), 14, 5);
  chk('semi-ancho cabeza escala con el radio (0.9·14)', Math.abs(e.pts[0].w - 0.9 * 14) < 1e-9);
}

console.log('=== grep: 3 fantasmas eliminados; sin shadow/gradiente en el render de estela ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  chk('sin LAG_ESTELA (constante de fantasmas eliminada)', !/LAG_ESTELA/.test(main));
  chk('sin el arreglo de alfas [0.3, 0.2, 0.1]', !/0\.3, 0\.2, 0\.1/.test(main));
  // Cuerpo de dibujarEstela: 1 solo fill, sin shadowBlur, sin crear gradientes.
  const ini = main.indexOf('function dibujarEstela(');
  const fin = main.indexOf('function dibujarSpriteTarget(', ini);
  const cuerpo = main.slice(ini, fin);
  chk('dibujarEstela: sin shadowBlur/shadowColor', !/ctx\.shadow/.test(cuerpo));
  chk('dibujarEstela: NO crea gradientes (usa gradEstela cacheado)', !/createLinearGradient|createRadialGradient/.test(cuerpo) && /gradEstela/.test(cuerpo));
  chk('dibujarEstela: UN solo ctx.fill() (≤ los 3 arcos anteriores)', (cuerpo.match(/ctx\.fill\(\)/g) || []).length === 1);
  chk('gradEstela se crea en regenerarGradientes (fuera del bucle)', /gradEstela = ctx\.createLinearGradient/.test(main) && main.indexOf('gradEstela = ctx.createLinearGradient') < main.indexOf('function dibujarEstela('));
}

console.log(`\n== RESUMEN estela: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
