// hitclaud — CAMBIO 3: el contador de tiempo (marca de agua del canvas) se desplaza un 20% hacia
// ARRIBA respecto a su posición anterior (centro H/2 → H·0.40). No cambia su tamaño, opacidad,
// color ni su comportamiento en los últimos 5 s. Debe seguir dentro de la pantalla en cualquier
// alto, y vale igual para HitClaud y ShotClaud. node test/contadorarriba.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== Un 20% MÁS ARRIBA respecto a su posición actual (3.1) ===');
{
  chk('CONTADOR_Y_FRAC = 0.40 (antes 0.50 = H/2)', /const CONTADOR_Y_FRAC = 0\.40;/.test(main));
  // 0.50 × 0.80 = 0.40: bajar el centro un 20% de su posición previa.
  chk('0.40 es exactamente un 20% arriba de 0.50', (0.50 * 0.80).toFixed(2) === '0.40');
  chk('el dibujo usa H·CONTADOR_Y_FRAC en el eje Y (centrado en X)', /drawImage\(contadorCache\.canvas, W \/ 2 - w \/ 2, H \* CONTADOR_Y_FRAC - h \/ 2, w, h\)/.test(main));
}

console.log('=== NO cambia tamaño, opacidad, color ni los últimos 5 s (3.2) ===');
{
  chk('tamaño intacto (CONTADOR_TAM = 105)', /const CONTADOR_TAM = 105;/.test(main));
  chk('opacidades intactas (0.12 normal, 0.20 urgente)', /const CONTADOR_ALFA = 0\.12;/.test(main) && /const CONTADOR_ALFA_URG = 0\.20;/.test(main));
  chk('color intacto (blanco; rojo en urgente)', /urgente \? CONTADOR_ROJO : '#FFFFFF'/.test(main));
  chk('latido de los últimos 5 s intacto (misma fórmula sinusoidal)', /const pulso = urgente \? \(1 \+ 0\.06 \* \(1 - Math\.cos\(performance\.now\(\) \/ 1000 \* 2 \* Math\.PI\)\)\) : 1;/.test(main));
}

console.log('=== No se sale de pantalla en NINGÚN alto, y vale igual en ambos juegos (3.3) ===');
{
  const TAM = parseInt((main.match(/const CONTADOR_TAM = (\d+);/) || [])[1], 10);
  const FRAC = parseFloat((main.match(/const CONTADOR_Y_FRAC = ([\d.]+);/) || [])[1]);
  const PULSO_MAX = 1.12; // pico del latido de los últimos 5 s (1 + 0.06·2)
  // Alto del lienzo del contador ≈ CONTADOR_TAM × 1.3 (rasterizarContador), con el pulso al pico.
  const hMax = Math.ceil(TAM * 1.3) * PULSO_MAX;
  const alturas = [480, 600, 667, 720, 844, 932, 1024]; // móviles y tablets representativos
  let dentro = true, peor = '';
  alturas.forEach(function (H) {
    const top = H * FRAC - hMax / 2, bottom = H * FRAC + hMax / 2;
    if (top < 0 || bottom > H) { dentro = false; peor = 'H=' + H + ' top=' + top.toFixed(0) + ' bottom=' + bottom.toFixed(0); }
  });
  chk('cabe entero (top≥0 y bottom≤H) en todos los altos probados' + (peor ? ' — FALLA ' + peor : ''), dentro);
  chk('el contador NO ramifica por juego (mismo elemento en HitClaud y ShotClaud)', /function dibujarContadorTiempo\(\) \{\s*if \(!jugando \|\| !DURACIONES\[modoJuego\]\) return;/.test(main) && !/dibujarContadorTiempo[\s\S]{0,400}esShot\(\)/.test(main));
}

console.log(`\n== RESUMEN contador-arriba: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
