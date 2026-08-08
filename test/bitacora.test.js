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
  chk('hay exactamente 25 versiones', B.versiones.length === 25);
  chk('la primera entrada es la 3.0 (más reciente primero)', B.versiones[0].version === '3.0');
  chk('la 3.0 trae sus dos puntos literales (dedo demuele + targets enteros)', (function () {
    const v = B.versiones[0];
    return v.version === '3.0' && v.fecha === '3 de agosto' && v.puntos.length === 2 &&
      v.puntos[0].texto === 'En Pushcloude tu dedo ahora demuele de verdad' &&
      v.puntos[1].texto === 'Los targets cruzan la pantalla completos y por la zona de juego';
  })());
  chk('la segunda entrada es la 2.9 (intacta: Pushcloude)', (function () {
    const v = B.versiones[1];
    return v.version === '2.9' && v.puntos.length === 4 &&
      v.puntos[0].texto === 'Llega Pushcloude: aplasta los targets con el dedo' &&
      v.puntos[3].texto === 'Partidas de 60 y 180 segundos';
  })());
  chk('la tercera entrada es la 2.8 (intacta)', B.versiones[2].version === '2.8' && B.versiones[2].puntos[0].texto === 'Pushcloude entra en acceso anticipado para quien tenga la clave');
  chk('la cuarta entrada es la 2.7 (intacta)', B.versiones[3].version === '2.7' && B.versiones[3].puntos[0].texto === 'El juego se llama Hitcloude');
  chk('la quinta entrada es la 2.6 (intacta)', B.versiones[4].version === '2.6' && B.versiones[4].puntos.length === 2);
  chk('la sexta entrada es la 2.5 (intacta)', B.versiones[5].version === '2.5' && B.versiones[5].puntos.length === 3);
  chk('la séptima entrada es la 2.4 (intacta)', B.versiones[6].version === '2.4' && B.versiones[6].puntos[2].texto === 'El juego siempre abre en HitClaud');
  chk('la octava entrada sigue siendo la 2.3', B.versiones[7].version === '2.3');
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
  chk('los puntos retirados son 7 en total (6 previos + el modo 30 de la 1.6)', retirados === 7);
  chk('el texto de un retirado NO lleva "[RETIRADO]" pegado (es dato, no texto)', B.versiones.every(function (v) {
    return v.puntos.every(function (p) { return p.texto.indexOf('[RETIRADO]') === -1 && p.texto.indexOf('RETIRADO') === -1; });
  }));
  chk('los retirados viven en 1.6, 1.0, 0.9 y 0.5', (function () {
    const conRet = B.versiones.filter(function (v) { return v.puntos.some(function (p) { return p.retirado; }); }).map(function (v) { return v.version; });
    return conRet.sort().join(',') === '0.5,0.9,1.0,1.6';
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
