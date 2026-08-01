// hitclaud — FASE 21 commit 3: firma del autor entre los datos de fondo. node test/firma.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Cuerpo de dibujarFondoDatos.
const iFn = main.indexOf('function dibujarFondoDatos()');
const cuerpoFn = main.slice(iFn, main.indexOf('\n  }', iFn) + 4);

console.log('=== Las DOS líneas de firma existen (texto exacto) ===');
{
  chk('línea "Patrick Macip"', /\{ firma: true, texto: 'Patrick Macip' \}/.test(main));
  chk('línea "@patcitorey"', /\{ firma: true, texto: '@patcitorey' \}/.test(main));
}

console.log('=== Tamaño 14px y opacidad 0.20 (el resto 10px / vivas 0.15 / estáticas 0.08) ===');
{
  chk('firma en 14px (el bloque base es 10px)', /if \(L\.firma\) \{[\s\S]{0,160}font = '14px ui-monospace/.test(cuerpoFn));
  chk('firma con alfa 0.20', /if \(L\.firma\) \{[\s\S]{0,200}globalAlpha = 0\.20/.test(cuerpoFn));
  chk('restaura 10px para el resto de las líneas', /globalAlpha = 0\.20;[\s\S]{0,140}font = '10px ui-monospace/.test(cuerpoFn));
  chk('las vivas siguen 0.15 y las estáticas 0.08 (intactas)', /L\.vivo \? 0\.15 : 0\.08/.test(cuerpoFn));
  chk('mismo color --texto-apagado (fillStyle único del bloque)', /fillStyle = COLOR\.textoApagado/.test(cuerpoFn));
  chk('misma familia monoespaciada (ui-monospace)', /ui-monospace, Menlo, monospace/.test(cuerpoFn));
}

console.log('=== Márgenes 20px en ambos bordes (truncado como el resto) ===');
{
  chk('firma dibujada a x = FONDO_MARGEN (margen izq)', /if \(L\.firma\)[\s\S]{0,220}fillText\(U\.truncarTexto\(L\.texto, maxW, anchoDe\), FONDO_MARGEN, y\)/.test(cuerpoFn));
  chk('firma truncada al ancho útil maxW = W − 2·FONDO_MARGEN (margen der)', /const maxW = W - 2 \* FONDO_MARGEN;/.test(cuerpoFn) && /truncarTexto\(L\.texto, maxW, anchoDe\)/.test(cuerpoFn));
  // Comprobación de ancho: "Patrick Macip" a 14px mono (~8.4px/char) entra en W−40 (390→350).
  const CW14 = 8.4, maxW = 390 - 2 * 20;
  const t1 = U.truncarTexto('Patrick Macip', maxW, function (s) { return s.length * CW14; });
  const t2 = U.truncarTexto('@patcitorey', maxW, function (s) { return s.length * CW14; });
  chk('"Patrick Macip" cabe sin cruzar el margen (no se trunca)', t1 === 'Patrick Macip' && 20 + 13 * CW14 <= 390 - 20);
  chk('"@patcitorey" cabe sin cruzar el margen', t2 === '@patcitorey');
  // Y si por hipótesis fuera enorme, se truncaría dentro del margen (nunca cruza).
  chk('una firma hipotética larga se truncaría al margen', U.truncarTexto('x'.repeat(200), maxW, function (s) { return s.length * CW14; }).length * CW14 <= maxW);
}

console.log('=== Posición: INTERCALADAS, no al principio ni al final, sin solaparse ===');
{
  // Insertadas por splice en índices 8 y 13 (no 0, y con datos antes/después).
  const m8 = /lineasFondo\.splice\(8, 0, \{ firma: true, texto: 'Patrick Macip' \}\)/.test(main);
  const m13 = /lineasFondo\.splice\(13, 0, \{ firma: true, texto: '@patcitorey' \}\)/.test(main);
  chk('"Patrick Macip" intercalada en el slot 8 (no al principio)', m8);
  chk('"@patcitorey" intercalada en el slot 13 (no al final)', m13);
  chk('índices distintos y separados (líneas de datos entre medio)', 8 !== 13 && 13 - 8 > 1);
  // Cada línea vive en su slot FONDO_Y0 + i*FONDO_LH; 14px < interlínea 16 → sin solape.
  chk('14px < interlínea FONDO_LH=16 → no se solapan', /FONDO_LH = 16/.test(main) && 14 < 16);
  chk('cada línea en su y única (i*FONDO_LH), incl. firma', /const y = FONDO_Y0 \+ i \* FONDO_LH;/.test(cuerpoFn));
}

console.log('=== EXCEPCIÓN documentada para que no la borren en el futuro ===');
{
  chk('comentario declara la excepción aprobada por el dueño', /EXCEPCIÓN aprobada EXPLÍCITAMENTE por el dueño/.test(main));
  chk('advierte: NO borrar por creerlas texto inventado', /NO borrar en un futuro por creerlas texto\s*\/\/ inventado/.test(main));
}

console.log('=== Costo: sin shadowBlur ni gradientes (ley fase 13) ===');
{
  chk('el bloque de fondo no usa shadowBlur ni gradientes', !/shadow|createLinearGradient|createRadialGradient/.test(cuerpoFn));
  chk('el bucle de dibujo sigue con 1 solo shadowBlur (el de desktop)', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN firma: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
