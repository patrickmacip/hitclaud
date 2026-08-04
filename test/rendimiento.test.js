// hitclaud — FASE 13: fuera shadowBlur del bucle, halo barato + gradientes cacheados.
// node test/rendimiento.test.js  (grep de código; sin DOM)

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Cuerpo de dibujar() (hasta la siguiente función de dibujo).
const iniDib = main.indexOf('function dibujar()');
const finDib = main.indexOf('function dibujarEstela', iniDib);
const cuerpoDibujar = main.slice(iniDib, finDib);
// Cuerpo de dibujarBolita().
const iniBol = main.indexOf('function dibujarBolita(');
const finBol = main.indexOf('function haloTexto(', iniBol);
const cuerpoBolita = main.slice(iniBol, finBol);

console.log('=== shadowBlur/shadowColor en el bucle = vacío (salvo el desktop declarado) ===');
{
  const nBlur = (main.match(/ctx\.shadowBlur/g) || []).length;
  const nColor = (main.match(/ctx\.shadowColor/g) || []).length;
  chk(`sólo 1 ctx.shadowBlur en todo main.js (hoy ${nBlur})`, nBlur === 1);
  chk(`sólo 1 ctx.shadowColor en todo main.js (hoy ${nColor})`, nColor === 1);
  // El único restante está en el bloque desktop (hitscan), que no corre en móvil.
  const idx = main.indexOf('ctx.shadowBlur');
  const ctxPrevio = main.slice(Math.max(0, idx - 500), idx);
  chk('el shadow restante es el destello HITSCAN de desktop', /if \(esDesktop\)|HITSCAN|RADIO_MIRA/.test(ctxPrevio));
  // Ni la bolita ni los helpers de móvil conservan shadow.
  chk('dibujarBolita SIN shadowBlur/shadowColor', !/shadow/i.test(cuerpoBolita) || !/ctx\.shadow/.test(cuerpoBolita));
}

console.log('\n=== createLinearGradient/createRadialGradient dentro del bucle = vacío ===');
{
  chk('dibujar() NO crea gradientes (cacheados fuera)', !/createLinearGradient|createRadialGradient/.test(cuerpoDibujar));
  // Sólo existen en la fábrica, fuera del bucle (bordes ×2 + cola meteoro ×1 = 3).
  const total = (main.match(/ctx\.createLinearGradient/g) || []).length;
  chk(`las 3 createLinearGradient viven en regenerarGradientes (hoy ${total})`, total === 3);
  chk('regenerarGradientes() existe', /function regenerarGradientes\(\)/.test(main));
  chk('se llama en redimensionar (fuera del bucle)', /regenerarGradientes\(\);[\s\S]{0,80}dibujar\(\);/.test(main) || /ctx\.setTransform[\s\S]{0,120}regenerarGradientes\(\)/.test(main));
  chk('el bucle usa los gradientes cacheados (gradBordeIzq/Der)', /fillStyle = gradBordeIzq/.test(cuerpoDibujar) && /fillStyle = gradBordeDer/.test(cuerpoDibujar));
}

console.log('\n=== Halo sustituto SIN blur en los 3 sitios de móvil ===');
{
  // 1) Bolita: dos arcos concéntricos (r+6, r+3) a baja alfa.
  chk('bolita: halo por arcos concéntricos (RADIO+6 y RADIO+3)', /RADIO \+ 6[\s\S]*?RADIO \+ 3/.test(cuerpoBolita));
  chk('bolita: alfas del halo 0.18 y 0.30', /globalAlpha = 0\.18[\s\S]*?globalAlpha = 0\.30/.test(cuerpoBolita));
  // 2) Badge ×N y 3) Flotante grande: halo de texto barato (haloTexto).
  chk('helper haloTexto() existe (trazo sin blur)', /function haloTexto\(/.test(main) && /strokeText\(/.test(main));
  chk('badge ×N sin haloTexto (FASE 29: halo por disco cacheado, sin contorno)', !/haloTexto\(txtMult/.test(main) && /ctx\.drawImage\(discoMult\.canvas/.test(main));
  chk('flotante grande usa haloTexto (si fl.glow)', /if \(fl\.glow\) haloTexto\(/.test(main));
  // (Extra declarado) el temporizador también recibió el halo barato.
  chk('temporizador SIN haloTexto (FASE 23: contador sin contorno) — sigue sin shadowBlur', !/haloTexto\(txt, 0, 0, colTimer/.test(main) && (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log('\n=== Nada más cambió: colores, tamaños y posiciones idénticos ===');
{
  chk('FRANJA_PX = 28 (ancho de borde intacto)', /const FRANJA_PX = 28;/.test(main));
  chk('colores de borde/contador intactos', /ROJO_BORDE = '#FF0055', ROJO_CONTADOR = '#FF4583'/.test(main));
  chk('timer movido al DOM (barra): actualizarTiempo, sin dibujo del contador en canvas', /function actualizarTiempo\(\)/.test(main) && !/ctx\.font = '800 32px '/.test(main) && !/ctx\.translate\(W \/ 2, 88\)/.test(main));
  // FASE 29: badge de tamaño FIJO 42 (MULT_ASIENTO), sin crecer con la racha; posición
  // por mx/my (W/2, max(158,H*0.16)) sin translate (dibuja en coords absolutas).
  chk('badge: tamaño fijo 42 (MULT_ASIENTO) y posición (W/2, max(158,H*0.16)) intactas', /const MULT_ASIENTO = 42;/.test(main) && /mx = W \/ 2, my = Math\.max\(158, H \* 0\.16\)/.test(main) && !/26 \+ Math\.min\(20, marcador\.racha\)/.test(main));
  chk('bolita: disco RADIO-1.5 y stroke intactos (tamaño no cambió)', /arc\(cx, cy, RADIO - 1\.5,/.test(cuerpoBolita));
  chk('flotante: fuente 700 fl.tam intacta', /ctx\.font = '700 ' \+ fl\.tam \+ 'px '/.test(main));
  // El dpr/resolución del canvas NO se tocó en este commit.
  chk('resolución/dpr del canvas intacta (W*dpr, H*dpr, setTransform)', /canvas\.width = Math\.round\(W \* dpr\)/.test(main) && /ctx\.setTransform\(dpr, 0, 0, dpr, 0, 0\)/.test(main));
}

console.log(`\n== RESUMEN rendimiento: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
