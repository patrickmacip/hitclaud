// hitclaud — FASE 26: bitácora de actualizaciones. node test/bitacora.test.js
// Módulo puro (js/bitacora.js) + su render en main.js + no-duplicación en el HTML.

const fs = require('fs');
const B = require('../js/bitacora.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El módulo carga y expone la lista ===');
{
  chk('bitacora.js exporta un objeto con .versiones (array)', B && Array.isArray(B.versiones));
  chk('cada entrada tiene version, fecha y puntos (array)', B.versiones.every(function (v) {
    return typeof v.version === 'string' && typeof v.fecha === 'string' && Array.isArray(v.puntos);
  }));
  chk('cada punto tiene texto (string); retirado es booleano si está', B.versiones.every(function (v) {
    return v.puntos.every(function (p) { return typeof p.texto === 'string' && (p.retirado === undefined || typeof p.retirado === 'boolean'); });
  }));
}

console.log('=== Orden y forma ===');
{
  chk('hay exactamente 6 versiones', B.versiones.length === 6);
  chk('la primera entrada es la 1.1 (más reciente primero)', B.versiones[0].version === '1.1');
  chk('la última es la 0.1', B.versiones[B.versiones.length - 1].version === '0.1');
  chk('el orden de versiones va de mayor a menor', (function () {
    const nums = B.versiones.map(function (v) { return parseFloat(v.version); });
    for (let i = 1; i < nums.length; i++) if (nums[i] >= nums[i - 1]) return false;
    return true;
  })());
  chk('ninguna entrada tiene lista de puntos vacía', B.versiones.every(function (v) { return v.puntos.length > 0; }));
}

console.log('=== Marcas de retirado ===');
{
  // NOTA: el contenido LITERAL entregado por el dueño tiene 6 marcas [RETIRADO]
  // (v1.0:1, v0.9:1, v0.5:4). El prompt V4 pedía 7; se conserva el texto literal
  // (instrucción 1.3: "cópialo literal, no lo reescribas") y la prueba mide lo REAL.
  const retirados = B.versiones.reduce(function (s, v) {
    return s + v.puntos.filter(function (p) { return p.retirado === true; }).length;
  }, 0);
  console.log('  total de puntos retirados = ' + retirados);
  chk('los puntos retirados son 6 en total (contenido literal del dueño)', retirados === 6);
  chk('el texto de un retirado NO lleva "[RETIRADO]" pegado (es dato, no texto)', B.versiones.every(function (v) {
    return v.puntos.every(function (p) { return p.texto.indexOf('[RETIRADO]') === -1 && p.texto.indexOf('RETIRADO') === -1; });
  }));
  chk('los retirados viven en 1.0, 0.9 y 0.5', (function () {
    const conRet = B.versiones.filter(function (v) { return v.puntos.some(function (p) { return p.retirado; }); }).map(function (v) { return v.version; });
    return conRet.sort().join(',') === '0.5,0.9,1.0';
  })());
}

console.log('=== El texto NO está duplicado en index.html (se genera desde el módulo) ===');
{
  // Toma frases distintivas de la bitácora y verifica que NO estén escritas en el HTML.
  const frases = [
    'Big Claude se rompe de verdad',
    'Estela de meteoro',
    'Primera versión jugable',
    'Baño de color',
  ];
  chk('ninguna frase de la bitácora aparece escrita a mano en index.html', frases.every(function (f) { return html.indexOf(f) === -1; }));
  chk('index.html tiene el contenedor vacío #actuLista (se llena desde JS)', /<div class="actu-lista" id="actuLista"><\/div>/.test(html));
  chk('main.js construye la bitácora desde window.Bitacora', /window\.Bitacora/.test(main) && /function construirBitacora\(\)/.test(main));
  chk('main.js usa textContent para el texto de los puntos (sin inyección)', /li\.textContent = p\.texto;/.test(main));
}

console.log(`\n== RESUMEN bitacora: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
