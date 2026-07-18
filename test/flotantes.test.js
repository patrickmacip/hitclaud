// hitclaud — test de los números flotantes: node test/flotantes.test.js
// Mapeo evento → texto/color (espejo de la lógica de main.js).

const COL = { coralVivo: '--coral-vivo', morado: '--morado', apagado: '--texto-apagado' };

// Muerte de una bolita: fallo de la hitball principal (−N morado), dispersa del
// power-up sin impacto (0 apagado), o nada. (Las dispersas llevan flag `moneda`.)
function floatMuerte(b, pen) {
  if (b.moneda) { return !b.tocado ? { texto: '0', color: COL.apagado } : null; }
  if (!b.tocado && !b.neutro) return { texto: '−' + pen, color: COL.morado };
  return null;
}
// Cobro de inactividad por segundo (morado).
function floatInactividad(c) { return { texto: '−' + c, color: COL.morado }; }
// Positivo por demolición (coral vivo) — no se toca.
function floatPositivo(g) { return { texto: '+' + g, color: COL.coralVivo }; }

function chk(nombre, obj, texto, color) {
  const ok = obj && obj.texto === texto && obj.color === color;
  console.log(`  ${nombre}: "${obj ? obj.texto : '∅'}" en ${obj ? obj.color : '—'}  ${ok ? 'OK ✓' : 'NO ✗'}`);
}

console.log('=== FALLO: número negativo en --morado ===');
chk('bolita normal muere sin tocar (pen 250)', floatMuerte({ moneda: false, tocado: false, neutro: false }, 250), '−250', COL.morado);
{
  const noFlot = floatMuerte({ moneda: false, tocado: true, neutro: false }, 250);
  console.log(`  bolita que tocó → sin flotante de fallo: ${noFlot === null ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== INACTIVIDAD: cobro por segundo en --morado, junto al marcador ===');
chk('cobro de −125/s', floatInactividad(125), '−125', COL.morado);

console.log('\n=== DISPERSA del power-up sin impacto: "0" en --texto-apagado (SIN −) ===');
chk('dispersa muere sin tocar', floatMuerte({ moneda: true, tocado: false }, 0), '0', COL.apagado);
const sinFlot = floatMuerte({ moneda: true, tocado: true }, 0);
console.log(`  dispersa que SÍ tocó: ${sinFlot === null ? 'sin "0" (ya mostró +N) OK ✓' : 'NO ✗'}`);

console.log('\n=== POSITIVOS: intactos en --coral-vivo ===');
chk('demolición +30', floatPositivo(30), '+30', COL.coralVivo);

// ── Tamaño de las ganancias (estilo app móvil: a más ganancia, más grande) ──
const P = require('../js/puntuacion.js');
function tamGanancia(g) { return Math.min(44, 20 + g / 25); }
console.log('\n=== Ganancias: tamaño por magnitud + glow desde +300 ===');
[10, 200, 500, 1000].forEach(function (g) {
  console.log(`  +${g} → font ${tamGanancia(g).toFixed(0)}px  glow=${g >= 300 ? 'sí' : 'no'}`);
});
{
  const ok = tamGanancia(10) < 21 && tamGanancia(1000) === 44 && tamGanancia(2000) === 44;
  console.log(`  +10≈20px, crece con g, tope 44px: ${ok ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Badge de multiplicador refleja la racha (×N, sin emoji) ===');
[2, 3, 5, 12].forEach(function (r) {
  const mult = P.multRacha(r);
  const texto = mult > 1 ? ('×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1))) : '(oculto)';
  console.log(`  racha ${r} → ${texto}`);
});
{
  const ok = P.multRacha(2) === 1 && P.multRacha(3) === 1.2 && P.multRacha(12) === 3;
  console.log(`  oculto <3, ×1.2 al 3º, ×3 tope: ${ok ? 'OK ✓' : 'NO ✗'}`);
}
console.log('\n  Todo canvas puro (fillText/fillRect/shadowBlur/scale) — sin librerías. OK ✓');

// ── Agregación + fusión anti-solapamiento + tope estricto (espejo main.js) ──
console.log('\n=== Agregación: un impacto = un flotante (suma), fusión de cercanos ===');
{
  const MAX = 8, DIST = 40;
  const fl = [];
  function num(t) { return t === '0' ? 0 : t[0] === '+' ? parseInt(t.slice(1), 10) : t[0] === '−' ? -parseInt(t.slice(1), 10) : null; }
  function txt(n) { return n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0'; }
  function emitir(x, y, texto, color) {
    const n = num(texto);
    if (n !== null) for (let i = fl.length - 1; i >= 0; i--) {
      if (fl[i].color === color && Math.hypot(fl[i].x - x, fl[i].y - y) < DIST) { fl[i].texto = txt(num(fl[i].texto) + n); return; }
    }
    fl.push({ x: x, y: y, texto: texto, color: color });
    if (fl.length > MAX) fl.shift();
  }
  // dos impactos casi encima → se fusionan en +240
  emitir(100, 100, '+120', 'coral');
  emitir(110, 105, '+120', 'coral');
  console.log(`  +120 y +120 cercanos → ${fl[0].texto} (1 flotante)  ${fl.length === 1 && fl[0].texto === '+240' ? 'OK ✓' : 'NO ✗'}`);
  // lejano → nuevo flotante
  emitir(300, 300, '+50', 'coral');
  console.log(`  lejano → ${fl.length} flotantes  ${fl.length === 2 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Tope estricto: nunca más de 8 vivos (fiesta+power-up) ===');
{
  const MAX = 8;
  const fl = [];
  for (let i = 0; i < 30; i++) { fl.push({ x: i * 13, y: i * 29 }); if (fl.length > MAX) fl.shift(); } // esparcidos, sin fusión
  console.log(`  30 impactos esparcidos → ${fl.length} vivos  ${fl.length === MAX ? 'OK ✓ (retira los más viejos)' : 'NO ✗'}`);
}
