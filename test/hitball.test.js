// hitclaud — test del BAÑO DE COLOR TOTAL por modo: node test/hitball.test.js
// Espejo de modoActivo (main.js). Cada modo es una PALETA de 4 roles (base,
// vivo, claro, profundo) que tiñe TODO menos el fondo/superficie.
// Precedencia: castigo > bonanza > power-up > normal.

// Espejo de MODOS (main.js) — fuente de verdad de las 4 paletas.
const MODOS = {
  normal:  { base: '#E8704E', vivo: '#FF8764', claro: '#FFC9B8', profundo: '#A84A2E' },
  bonanza: { base: '#FFC300', vivo: '#FFD84D', claro: '#FFEBA3', profundo: '#B88C00' },
  power:   { base: '#6FFF2C', vivo: '#9CFF6B', claro: '#CBFFAD', profundo: '#3FA817' },
  castigo: { base: '#1F55C9', vivo: '#4E82F5', claro: '#AFC6F7', profundo: '#143C8F' },
};
function modoActivo(t, debuffHasta, fiestaHasta, powerupHasta) {
  if (t < debuffHasta) return MODOS.castigo;   // castigo (bola chica)
  if (t < fiestaHasta) return MODOS.bonanza;   // bonanza / fiesta
  if (t < powerupHasta) return MODOS.power;    // power-up (dispersión)
  return MODOS.normal;                         // normal (naranja)
}

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }
const T = 1000;

console.log('=== Modo activo por estado ===');
chk('normal (ningún modo) → paleta naranja', modoActivo(T, 0, 0, 0) === MODOS.normal);
chk('castigo (debuff) → paleta azul', modoActivo(T, T + 1, 0, 0) === MODOS.castigo);
chk('bonanza (fiesta) → paleta dorada', modoActivo(T, 0, T + 1, 0) === MODOS.bonanza);
chk('power-up → paleta verde', modoActivo(T, 0, 0, T + 1) === MODOS.power);

console.log('\n=== Precedencia: castigo > bonanza > power-up > normal ===');
chk('castigo + bonanza → castigo', modoActivo(T, T + 1, T + 1, 0) === MODOS.castigo);
chk('castigo + power → castigo', modoActivo(T, T + 1, 0, T + 1) === MODOS.castigo);
chk('bonanza + power → bonanza', modoActivo(T, 0, T + 1, T + 1) === MODOS.bonanza);
chk('los tres → castigo', modoActivo(T, T + 1, T + 1, T + 1) === MODOS.castigo);
chk('modo expirado → vuelve a normal', modoActivo(T, T - 1, 0, T - 1) === MODOS.normal);

console.log('\n=== Cada paleta tiene los 4 roles ===');
Object.keys(MODOS).forEach(function (k) {
  const m = MODOS[k];
  chk(`${k}: base ${m.base} · vivo ${m.vivo} · claro ${m.claro} · profundo ${m.profundo}`,
    !!(m.base && m.vivo && m.claro && m.profundo));
});

console.log('\n=== Contraste de roles sobre #121216 (base = targets, claro = récord/texto) ===');
{
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function L(hex) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
  function ratio(hex) { const a = Math.max(L(hex), L('#121216')), b = Math.min(L(hex), L('#121216')); return (a + 0.05) / (b + 0.05); }
  let claroOk = true;
  Object.keys(MODOS).forEach(function (k) {
    const m = MODOS[k];
    const cl = ratio(m.claro);
    if (cl < 4.5) claroOk = false; // el claro es texto (récord): debe ser legible
    console.log(`  ${k}: base ${ratio(m.base).toFixed(2)}:1 · vivo ${ratio(m.vivo).toFixed(2)}:1 · claro ${cl.toFixed(2)}:1 · profundo ${ratio(m.profundo).toFixed(2)}:1`);
  });
  chk('el tono CLARO (texto del récord) es legible en los 4 modos (≥4.5:1)', claroOk);
}
