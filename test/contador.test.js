// hitclaud — CAMBIO 1: el contador de tiempo pasó a ser una MARCA DE AGUA enorme en el canvas
// (blanca, translúcida, detrás de todo, centrada en el área de juego). Peso máximo, cifras de
// ancho fijo, cacheada. Últimos 5 s: rojo + latido. La LÓGICA del tiempo no cambió. Sin
// shadowBlur, sin strokeText. node test/contador.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El contador es una marca de agua en el CANVAS, ya no vive en la barra (1.5) ===');
{
  chk('ya NO hay #barraTiempo en el DOM (se movió al canvas)', !/id="barraTiempo"/.test(html));
  chk('existe la función que lo dibuja (dibujarContadorTiempo)', /function dibujarContadorTiempo\(\)/.test(main));
  chk('se dibuja durante una partida cronometrada (gateado por DURACIONES[modoJuego])', /function dibujarContadorTiempo\(\) \{\s*if \(!jugando \|\| !DURACIONES\[modoJuego\]\) return;/.test(main));
}

console.log('=== Tamaño 7×, peso máximo, blanco, opacidad baja (1.1–1.3) ===');
{
  chk('SIETE veces el tamaño anterior (15px → 105px)', /const CONTADOR_TAM = 105;/.test(main));
  chk('peso máximo de la tipografía (900)', /'900 ' \+ CONTADOR_TAM \+ 'px '/.test(main));
  chk('opacidad baja ~12% normal', /const CONTADOR_ALFA = 0\.12;/.test(main));
  chk('sube la opacidad en los últimos 5 s (~20%, urge más, 1.7)', /const CONTADOR_ALFA_URG = 0\.20;/.test(main));
  chk('color normal BLANCO puro', /rasterizarContador\(txt, urgente \? CONTADOR_ROJO : '#FFFFFF'\)/.test(main));
  // CAMBIO 3: centrado en X; en Y desplazado un 20% hacia ARRIBA respecto al centro (H·0.40 en
  // vez de H/2). Tamaño/opacidad/color/últimos-5s sin cambios (sólo la posición vertical).
  chk('centrado en X y a H·CONTADOR_Y_FRAC en Y (20% más arriba que H/2), no en la barra', /drawImage\(contadorCache\.canvas, W \/ 2 - w \/ 2, H \* CONTADOR_Y_FRAC - h \/ 2/.test(main));
  chk('CONTADOR_Y_FRAC = 0.40 = 0.50 × 0.80 (un 20% arriba de la posición previa, CAMBIO 3.1)', /const CONTADOR_Y_FRAC = 0\.40;/.test(main) && (0.50 * 0.80).toFixed(2) === '0.40');
}

console.log('=== Se dibuja DETRÁS de todo: antes de targets, bola, cubos y efectos (1.4) ===');
{
  chk('el contador se dibuja justo tras el fondo y ANTES de la cámara/targets', /dibujarFondoDatos\(\);[\s\S]{0,120}dibujarContadorTiempo\(\);/.test(main));
  chk('el contador va ANTES que el dibujo de los targets', main.indexOf('dibujarContadorTiempo();') < main.indexOf('dibujarSpriteTarget(t, destella)'));
  chk('el contador va ANTES que los cubos de explosión', main.indexOf('dibujarContadorTiempo();') < main.indexOf('for (let i = 0; i < cubos.length'));
}

console.log('=== Cifras de ancho fijo (1.6): no baila al cambiar de segundo ===');
{
  chk('rasteriza cada carácter en una CELDA del ancho del "0" (dígitos) y del ":"', /m\.measureText\('0'\)\.width[\s\S]{0,140}m\.measureText\('\:'\)\.width/.test(main));
  chk('coloca cada carácter en su celda, centrado', /c2\.fillText\(txt\[i\], x \+ anchos\[i\] \/ 2, alto \/ 2\); x \+= anchos\[i\];/.test(main));
  chk('formato "M:SS" con relleno de cero (fmtTiempo intacto, 1.8)', /Math\.floor\(seg \/ 60\) \+ ':' \+ \(seg % 60 < 10 \? '0' \+ \(seg % 60\) : seg % 60\)/.test(main));
}

console.log('=== Últimos 5 segundos (1.7): rojo + latido; la lógica del tiempo NO cambia (1.8) ===');
{
  chk('umbral de 5 s marca el estado urgente', /tiempoUrgente = tiempoRestante <= 5000;/.test(main));
  chk('urgente pinta el contador ROJO (mismo token --tiempo-urgente)', /CONTADOR_ROJO = tk\('--tiempo-urgente'/.test(main) && /urgente \? CONTADOR_ROJO : '#FFFFFF'/.test(main));
  chk('late en los últimos 5 s (escala sinusoidal 1.0→1.12, un ciclo/seg)', /const pulso = urgente \? \(1 \+ 0\.06 \* \(1 - Math\.cos\(performance\.now\(\) \/ 1000 \* 2 \* Math\.PI\)\)\) : 1;/.test(main));
  chk('actualizarTiempo conserva el gate por DURACIONES[modoJuego] (lógica intacta)', /function actualizarTiempo\(\)[\s\S]{0,180}!DURACIONES\[modoJuego\]/.test(main));
  chk('el reloj del bucle sigue igual (DURACIONES[modoJuego] && !secuencia)', /if \(DURACIONES\[modoJuego\] && !secuencia\)/.test(main));
}

console.log('=== Rendimiento (V6): cacheado; sin shadowBlur ni strokeText (1.9) ===');
{
  chk('se CACHEA y sólo se re-rasteriza al cambiar texto o estado (≈1 vez/seg)', /if \(!contadorCache \|\| contadorCache\.txt !== txt \|\| contadorCache\.urgente !== urgente\)/.test(main));
  chk('cada cuadro es un drawImage barato del lienzo cacheado', /ctx\.drawImage\(contadorCache\.canvas/.test(main));
  chk('sin strokeText de números y una sola asignación de shadowBlur', !/ctx\.strokeText\(/.test(main) && (main.match(/ctx\.shadowBlur/g) || []).length === 1);
  const iC = main.indexOf('function dibujarContadorTiempo');
  const cuerpo = main.slice(iC, iC + 1000); // la función completa; no invade otras
  chk('el dibujo del contador no usa shadowBlur', cuerpo.indexOf('shadowBlur') === -1 && cuerpo.indexOf('drawImage(contadorCache') !== -1);
}

console.log(`\n== RESUMEN contador: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
