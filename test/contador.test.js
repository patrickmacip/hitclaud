// hitclaud — FASE 23 commit 2: el contador (temporizador) sin contorno. node test/contador.test.js
// "el contador" = el número del temporizador (cuenta regresiva): es el único número que
// CUENTA y tenía un contorno (haloTexto, trazo agregado en fase 13), dibujado SOBRE el
// fondo. El marcador Actual (DOM) nunca tuvo contorno. Se quita el trazo del temporizador.

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Bloque del temporizador.
const iT = main.indexOf('TEMPORIZADOR (modos cronometrados');
const bloqueTimer = main.slice(iT, main.indexOf('    }', main.indexOf('ctx.fillText(txt, 0, 0);', iT)) + 5);

console.log('=== El contador (temporizador) queda SIN contorno/trazo ===');
{
  chk('el temporizador YA NO llama haloTexto() (sin trazo/borde)', !/haloTexto\(/.test(bloqueTimer));
  chk('el número sigue dibujándose (fillText, limpio)', /ctx\.fillStyle = colTimer;\s*ctx\.fillText\(txt, 0, 0\);/.test(bloqueTimer));
  chk('sin strokeText en el temporizador', !/strokeText/.test(bloqueTimer));
  chk('comentario declara el cambio (sin contorno, número limpio)', /SIN contorno[\s\S]{0,120}número del contador queda limpio/.test(bloqueTimer));
}

console.log('=== Legibilidad sobre el fondo #121216 (declarada) ===');
{
  // El relleno sigue en el tono claro (#FFC9B8) o rojo urgente (#FF0055): alto contraste.
  chk('color del contador = ACENTO.claro / ROJO_BORDE (relleno legible)', /const colTimer = urgente \? ROJO_BORDE : ACENTO\.claro;/.test(main));
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function L(rgb) { const s = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; }
  function ratio(fg, bg) { const a = L(hex(fg)), b = L(hex(bg)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
  const rNorm = ratio('FFC9B8', '121216'), rUrg = ratio('FF0055', '121216');
  console.log(`  contraste normal #FFC9B8/#121216 = ${rNorm.toFixed(2)}:1 · urgente #FF0055 = ${rUrg.toFixed(2)}:1`);
  chk('contraste alto sin el trazo (texto grande 32px: umbral 3:1 de sobra)', rNorm >= 3 && rUrg >= 3);
}

console.log('=== El resto de estilos del marcador INTACTO ===');
{
  // El marcador Actual (DOM) sigue igual (nunca tuvo stroke; su regla no cambió).
  chk('.marcador--actual .valor intacto (font texto-xl, color acento-vivo, sin stroke)', /\.marcador--actual \.valor \{\s*font: var\(--texto-xl\);\s*color: var\(--acento-vivo/.test(css) && !/text-stroke/.test(css));
  chk('.marcador--record .valor intacto', /\.marcador--record \.valor \{\s*font: var\(--texto-l\);/.test(css));
  // Otros halos (badge ×N, flotantes) NO se tocaron: sólo el del contador se quitó.
  chk('badge ×N conserva su halo (haloTexto)', /haloTexto\(txtMult, 0, 0, ACENTO\.vivo/.test(main));
  chk('flotantes conservan su halo (haloTexto)', /if \(fl\.glow\) haloTexto\(fl\.texto, 0, 0/.test(main));
  chk('el helper haloTexto sigue existiendo (no se borró, sólo dejó de usarse en el timer)', /function haloTexto\(/.test(main));
}

console.log(`\n== RESUMEN contador: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
