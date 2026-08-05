// hitclaud — ventanas acotadas a la pantalla, medallas 1-12 y número de puesto siempre.
// node test/medallas.test.js

const fs = require('fs');
const C = require('../js/compartir.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Extrae una función por conteo de llaves y la evalúa (pura, sin DOM).
function fn(src, firma) {
  const i = src.indexOf(firma); if (i === -1) return null;
  let prof = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) { const nombre = firma.replace('function ', '').replace(/\(.*/, ''); return new Function(src.slice(i, k + 1) + '\nreturn ' + nombre + ';')(); } } }
  return null;
}

console.log('=== CAMBIO 1: TODAS las ventanas acotadas al alto visible, mismo margen ===');
{
  chk('un ÚNICO margen definido (--ventana-margen)', /--ventana-margen:\s*\d+px;/.test(css));
  chk('altura máxima única definida con dvh + safe-area (--ventana-max)', /--ventana-max:\s*calc\(100dvh - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\) - 2 \* var\(--ventana-margen\)\)/.test(css));
  chk('los overlays usan ese margen en el padding (mismo valor para todos)', /#gameover, #inicio, #duracion, #nombre, #actualizaciones, #ranking \{[\s\S]{0,320}padding:[\s\S]{0,120}var\(--ventana-margen\)/.test(css));
  chk('.go-panel (nombre/inicio/duración/fin) acotado a la ventana', /\.go-panel \{[\s\S]{0,260}max-height: var\(--ventana-max\)/.test(css));
  chk('.actu-panel (actualizaciones) acotado a la ventana', /\.actu-panel \{[\s\S]{0,260}max-height: var\(--ventana-max\)/.test(css));
  chk('.rank-panel (ranking) acotado a la ventana', /\.rank-panel \{[\s\S]{0,120}height: min\(620px, var\(--ventana-max\)\)/.test(css));
  chk('ninguno usa 88vh/90vh crudos (que ignoran las barras de Safari)', !/max-height: 88vh/.test(css) && !/max-height: 90vh/.test(css));
}

console.log('=== CAMBIO 2/3: cabecera unificada; Actualizaciones sin Cerrar grande; "Hola," ===');
{
  const actu = html.slice(html.indexOf('<div id="actualizaciones"'), html.indexOf('<div id="ranking"'));
  chk('Actualizaciones ya NO tiene botón grande "Cerrar" al pie', !/>Cerrar<\/button>/.test(actu) && /id="actuCerrar" class="hdr-icono"/.test(actu));
  chk('la flecha de atrás de la pantalla 2 es icono esquinado (hdr-icono)', /<button id="durAtras" class="hdr-icono"[\s\S]{0,120}#ic-atras/.test(html));
  chk('cabecera de duración: icono a la izquierda, título centrado, hueco a la derecha', /ov-cabecera[\s\S]*?id="durAtras"[\s\S]*?nivel-titulo[\s\S]*?hdr-spacer/.test(html));
  chk('dice "Hola," y NO "Juegas como"', /'Hola, ' \+ nombreUsuario/.test(main) && !/Juegas como/.test(main));
}

console.log('=== CAMBIO 4: los doce iconos existen en assets y están cacheados ===');
{
  let existen = true;
  for (let n = 1; n <= 12; n++) if (!fs.existsSync(__dirname + '/../assets/podio-' + n + '.svg')) existen = false;
  chk('assets/podio-1.svg … podio-12.svg existen', existen);
  let cacheados = true;
  for (let n = 4; n <= 12; n++) if (sw.indexOf("'assets/podio-" + n + ".svg'") === -1) cacheados = false;
  chk('los nuevos (4-12) están en el shell del service worker', cacheados && /'assets\/podio-12\.svg'/.test(sw));
}

console.log('=== CAMBIO 5: número SIEMPRE; medalla 1-12; hueco reservado 13-20 (tabla en la app) ===');
{
  const iconoPuesto = fn(main, 'function iconoPuesto(p)');
  chk('iconoPuesto: 1-12 → medalla; 13+ → null', typeof iconoPuesto === 'function' && iconoPuesto(1) === 'assets/podio-1.svg' && iconoPuesto(12) === 'assets/podio-12.svg' && iconoPuesto(13) === null && iconoPuesto(0) === null);
  chk('cada fila lleva NÚMERO (rank-num) SIEMPRE, con texto del puesto', /num\.className = 'rank-num';[\s\S]{0,60}num\.textContent = String\(puesto\)/.test(main));
  chk('la medalla usa iconoPuesto (1-12), y su columna se reserva (rank-medalla) aunque no haya', /med\.className = 'rank-medalla';[\s\S]{0,120}iconoPuesto\(puesto\)/.test(main));
  chk('orden de la fila: número · medalla · nombre · (efectividad opcional) · puntos', /appendChild\(num\); fila\.appendChild\(med\); fila\.appendChild\(nom\);[\s\S]{0,800}fila\.appendChild\(pts\)/.test(main) && main.indexOf('fila.appendChild(nom)') < main.indexOf('fila.appendChild(pts)'));
  chk('el número tiene ancho fijo (cifras tabulares: 1 y 2 cifras no desalinean)', /\.rank-num \{[\s\S]{0,140}font-variant-numeric: tabular-nums/.test(css));
  chk('el número es menor y tenue', /\.rank-num \{[\s\S]{0,120}color: var\(--texto-apagado/.test(css));
}

console.log('=== CAMBIO 5.6: la tarjeta de compartir también lleva el número ===');
{
  // ctx simulado que registra los textos dibujados.
  const fills = [];
  const noop = function () {};
  const ctx = { _font: '20px', fillStyle: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, closePath: noop, fill: noop, translate: noop, rotate: noop, scale: noop, fillRect: noop, stroke: noop, drawImage: noop,
    measureText: function (s) { return { width: String(s).length * 12 }; }, fillText: function (t) { fills.push(String(t)); } };
  Object.defineProperty(ctx, 'font', { get() { return ctx._font; }, set(v) { ctx._font = v; } });
  Object.defineProperty(ctx, 'letterSpacing', { get() { return '0px'; }, set(v) {} });
  const top = []; for (let i = 1; i <= 8; i++) top.push({ nombre: 'J' + i, puntos: 900 - i });
  C.dibujarTarjetaRanking(ctx, { modo: '15', top: top, nombre: 'J5' }); // jugador en el puesto 5
  chk('los podios 1·2·3 llevan su número', fills.indexOf('1') !== -1 && fills.indexOf('2') !== -1 && fills.indexOf('3') !== -1);
  chk('la fila destacada del jugador (puesto 5) también lleva su número', fills.indexOf('5') !== -1);
}

console.log('=== CAMBIO 6: icono del récord — corona por defecto, medalla si top 12, sin bloquear ===');
{
  const mejorPuestoDe = fn(main, 'function mejorPuestoDe(top, nombre)');
  chk('mejorPuestoDe: por nombre, PRIMER match (mejor posición)', typeof mejorPuestoDe === 'function' &&
    mejorPuestoDe([{ nombre: 'A' }, { nombre: 'PAT' }, { nombre: 'PAT' }], 'PAT') === 2 &&
    mejorPuestoDe([{ nombre: 'PAT' }, { nombre: 'B' }, { nombre: 'PAT' }], 'PAT') === 1);
  chk('nombre repetido → se toma la MEJOR (menor) posición', mejorPuestoDe([{ nombre: 'X' }, { nombre: 'Y' }, { nombre: 'PAT' }, { nombre: 'PAT' }], 'PAT') === 3);
  chk('fuera del ranking → null (queda la corona)', mejorPuestoDe([{ nombre: 'A' }, { nombre: 'B' }], 'PAT') === null);
  chk('la pantalla pinta la corona de INMEDIATO (ponerIconoRecord(null)) antes de la red', /function actualizarMedallaRecord\(\) \{\s*ponerIconoRecord\(null\);/.test(main));
  chk('sólo cambia a medalla si el puesto es 1-12 (iconoPuesto en ponerIconoRecord)', /function ponerIconoRecord\(puesto\)[\s\S]{0,200}iconoPuesto\(puesto\)/.test(main));
  chk('el icono cambia al cambiar de duración (actualizarMedallaRecord en el click)', /modoInicioSel = dur;[\s\S]{0,360}actualizarMedallaRecord\(\)/.test(main));
  chk('reutiliza la tabla ya pedida si es del mismo contexto (no pide dos veces, 6.5)', /rankTopClave === clave/.test(main));
  chk('un fallo de red deja la corona sin lanzar (try/catch + reject no-op)', /Ranking\.pedirTop\([\s\S]{0,500}function \(\) \{ \/\* falla → se queda la corona/.test(main) && /function actualizarMedallaRecord\(\)[\s\S]{0,1000}catch \(e\) \{ \/\* nunca rompe/.test(main));
}

console.log(`\n== RESUMEN medallas: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
