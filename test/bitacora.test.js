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
  chk('hay exactamente 21 versiones', B.versiones.length === 21);
  chk('la primera entrada es la 2.6 (más reciente primero)', B.versiones[0].version === '2.6');
  chk('la 2.6 trae sus dos puntos literales (arco + giro reactivo)', (function () {
    const v = B.versiones[0];
    return v.version === '2.6' && v.fecha === '3 de agosto' && v.puntos.length === 2 &&
      v.puntos[0].texto === 'Los targets derribados ahora caen describiendo un arco, no en picada' &&
      v.puntos[1].texto === 'El giro de la caída reacciona al golpe que recibieron';
  })());
  chk('la segunda entrada es la 2.5 (intacta: picada + multiplicador ×5 + puesto/medalla)', (function () {
    const v = B.versiones[1];
    return v.version === '2.5' && v.fecha === '3 de agosto' && v.puntos.length === 3 &&
      v.puntos[0].texto === 'Los targets golpeados ahora se desploman en lugar de seguir volando' &&
      v.puntos[1].texto === 'El multiplicador llega hasta cinco y crece con cada nivel' &&
      v.puntos[2].texto === 'Tu récord muestra en qué puesto vas y tu medalla';
  })());
  chk('la tercera entrada es la 2.4 (intacta: home por juego + flechas + arranque)', (function () {
    const v = B.versiones[2];
    return v.version === '2.4' && v.fecha === '3 de agosto' && v.puntos.length === 3 &&
      v.puntos[0].texto === 'Cada juego tiene su propia pantalla de inicio' &&
      v.puntos[1].texto === 'Cambia de juego con las flechas, sin salir a ningún menú' &&
      v.puntos[2].texto === 'El juego siempre abre en HitClaud';
  })());
  chk('la cuarta entrada sigue siendo la 2.3', B.versiones[3].version === '2.3');
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
