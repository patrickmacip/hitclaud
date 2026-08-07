// hitclaud — CAMBIO 2: el multiplicador de racha llega a ×5 (antes ×3) y el NÚMERO del badge
// CRECE con el valor. El estilo no cambia (color/peso/halo/rebote): sólo el tamaño. Sin
// shadowBlur. Sólo HitClaud (ShotClaud usa su propio multiplicador en shotclaud.js).
// node test/multix5.test.js

const fs = require('fs');
const P = require('../js/puntuacion.js');
const S = require('../js/shotclaud.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El tope del multiplicador es ×5 y no se supera (2.1) ===');
{
  chk('RACHA_TOPE = 5.0 (subió de 3.0)', P.RACHA_TOPE === 5.0);
  chk('el multiplicador nunca pasa de ×5 (racha enorme)', P.multRacha(1000) === 5 && P.multRacha(22) === 5);
  chk('llega EXACTAMENTE a ×5 en el 22º hit y no antes (21º < 5)', P.multRacha(22) === 5 && P.multRacha(21) < 5);
}

console.log('=== Progresión ganada, no regalada: el tramo bajo NO cambió (2.2) ===');
{
  chk('×1 hasta el 2º hit', P.multRacha(1) === 1 && P.multRacha(2) === 1);
  chk('3º ×1.2, 4º ×1.4, 5º ×1.6 (mismo paso +0.2 de antes)', P.multRacha(3) === 1.2 && P.multRacha(4) === 1.4 && P.multRacha(5) === 1.6);
  // Monótona y creciente hasta el tope: cada hit sube o mantiene, nunca baja.
  let creceOk = true; for (let r = 1; r <= 30; r++) if (P.multRacha(r + 1) < P.multRacha(r)) creceOk = false;
  chk('la curva sólo sube hasta ×5 (monótona)', creceOk);
}

console.log('=== EL NÚMERO CRECE CON EL VALOR entre ×1 y ×5 (2.3) ===');
{
  // Reconstruye multAsiento con las constantes REALES del código (base, tope y RACHA_TOPE).
  const ASIENTO = parseInt((main.match(/const MULT_ASIENTO = (\d+);/) || [])[1], 10);
  const ASIENTO_MAX = parseInt((main.match(/const MULT_ASIENTO_MAX = (\d+);/) || [])[1], 10);
  const REBOTE = parseInt((main.match(/const MULT_REBOTE = (\d+);/) || [])[1], 10);
  function multAsiento(mult) { const k = Math.max(0, Math.min(1, (mult - 1) / (P.RACHA_TOPE - 1))); return ASIENTO + k * (ASIENTO_MAX - ASIENTO); }
  chk('la base (×1) y el tope (×5) están definidos y el tope es mayor', ASIENTO === 42 && ASIENTO_MAX === 78 && ASIENTO_MAX > ASIENTO);
  chk('el tamaño CRECE con el valor: ×1 < ×2 < ×3 < ×4 < ×5', multAsiento(1) < multAsiento(2) && multAsiento(2) < multAsiento(3) && multAsiento(3) < multAsiento(4) && multAsiento(4) < multAsiento(5));
  chk('×1 usa la base (42) y ×5 el tope (78) — perceptible', multAsiento(1) === ASIENTO && multAsiento(5) === ASIENTO_MAX);
  chk('el badge dibuja con ese asiento (multAsiento(mult)) y el rebote se suma encima', /const asiento = multAsiento\(mult\);/.test(main) && /const pico = asiento \+ MULT_REBOTE;/.test(main) && REBOTE === 10);
}

console.log('=== EL ESTILO NO CAMBIA: color, peso, halo cacheado y rebote (2.4); sin shadowBlur (2.5) ===');
{
  chk('mismo color del badge (MULT_COLOR) y peso 800', /const MULT_COLOR = '#FFB25C';/.test(main) && /ctx\.font = '800 ' \+ fs\.toFixed\(1\) \+ 'px '/.test(main));
  chk('mismo halo por disco CACHEADO, escalado por el tamaño (fs/MULT_ASIENTO)', /discoMult\.r \* \(fs \/ MULT_ASIENTO\)/.test(main) && /construirDisco\(MULT_COLOR, MULT_ASIENTO\)/.test(main));
  chk('conserva el REBOTE al cambiar de valor (suave sobre pico→asiento)', /fs = dc < 220 \? pico \+ suave\(dc \/ 220\) \* \(asiento - pico\) : asiento;/.test(main));
  chk('PROHIBIDO shadowBlur: una sola ASIGNACIÓN de ctx.shadowBlur en todo js/main.js (2.5)', (main.match(/ctx\.shadowBlur\s*=/g) || []).length === 1);
}

console.log('=== SÓLO HITCLAUD: ShotClaud usa su propio multiplicador, sin cambios (2.6) ===');
{
  chk('ShotClaud tiene su propio tope de racha positiva (RACHA_POS_TOPE=5, ya existía)', S.RACHA_POS_TOPE === 5);
  chk('ShotClaud NO usa P.multRacha: su multiplicador es el contador de centros (multRachaPos)', typeof S.multRachaPos === 'function' && S.multRachaPos(3) === 3 && S.multRachaPos(9) === 5);
  chk('el badge del canvas lee la racha de HitClaud (P.multRacha(marcador.racha))', /const mult = P\.multRacha\(marcador\.racha\);/.test(main));
}

console.log(`\n== RESUMEN multix5: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
