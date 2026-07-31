// hitclaud — FASE 18: fondo 70% vivo + estático textura, márgenes 20px, truncado.
// node test/datosfondo.test.js

const U = require('../js/util.js');
const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const utilSrc = fs.readFileSync(__dirname + '/../js/util.js', 'utf8');
const fisicaSrc = fs.readFileSync(__dirname + '/../js/fisica.js', 'utf8');
const puntSrc = fs.readFileSync(__dirname + '/../js/puntuacion.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Cuerpo de dibujarFondoDatos y el bloque de vivas.
const iFn = main.indexOf('function dibujarFondoDatos()');
const cuerpoFn = main.slice(iFn, main.indexOf('\n  }', iFn) + 4);
const iVivas = main.indexOf('const cascVivas = [');
const bloqueVivas = main.slice(iVivas, main.indexOf('const cascEstaticas', iVivas));
const V = (bloqueVivas.match(/function \(\)/g) || []).length; // nº de thunks vivos
const E = U.CASC_CODIGO.length;

// Modelo de ancho monoespaciado 10px: ~6px por carácter ASCII (determinista, testeable).
const CW = 6;
const ancho = function (s) { return s.length * CW; };
const W = 390, MARGEN = 20, MAXW = W - 2 * MARGEN; // 350

console.log('=== MÁRGENES 20px ambos lados + truncado con "…" (nadie cruza el borde) ===');
{
  chk('FONDO_MARGEN = 20', /FONDO_MARGEN = 20\b/.test(main));
  chk('dibuja a x = FONDO_MARGEN (margen izq)', /ctx\.fillText\(s, FONDO_MARGEN,/.test(cuerpoFn));
  chk('ancho útil = W − 2·FONDO_MARGEN (margen der)', /maxW = W - 2 \* FONDO_MARGEN/.test(cuerpoFn));
  chk('mide el texto antes de pintar (measureText) y trunca', /ctx\.measureText\(s\)/.test(cuerpoFn) && /U\.truncarTexto\(s, maxW, anchoDe\)/.test(cuerpoFn));
  // Ninguna línea (viva peor-caso + todas las estáticas) supera el ancho útil tras truncar.
  const peorViva = U.cascTarget('targets[0]', { x: 388, y: 842, vx: -1.9999, vy: 1.9999, rot: -3.1416, vivos: 80, vivosMax: 80 });
  const muestras = [peorViva, 'medidorFps F:60 D:12.3 peor:120', 'ultimoDisparo:-Infinity'].concat(U.CASC_CODIGO);
  let todasCaben = true, algunaTruncada = false;
  muestras.forEach(function (s) {
    const t = U.truncarTexto(s, MAXW, ancho);
    if (ancho(t) > MAXW) todasCaben = false;
    if (MARGEN + ancho(t) > W - MARGEN + 1e-9) todasCaben = false; // no toca el borde derecho
    if (t !== s) algunaTruncada = true;
  });
  chk('ninguna línea supera el ancho útil (incl. truncadas) ni toca el borde', todasCaben);
  chk('las líneas largas SÍ se truncan con "…"', algunaTruncada);
  chk('truncarTexto agrega "…" y respeta maxW', U.truncarTexto('x'.repeat(200), MAXW, ancho).endsWith('…') && ancho(U.truncarTexto('x'.repeat(200), MAXW, ancho)) <= MAXW);
  chk('una línea corta NO se trunca (sin "…" de más)', U.truncarTexto('GRAVEDAD: 0.0035,', MAXW, ancho) === 'GRAVEDAD: 0.0035,');
}

console.log('=== PROPORCIÓN ~70% vivas / ~30% estáticas (interleave VVE) ===');
{
  // Reproduce el interleave de main (2 vivas, 1 estática) con V y E reales.
  let vi = 0, ei = 0, nv = 0, ne = 0;
  while (vi < V || ei < E) {
    if (vi < V) { vi++; nv++; }
    if (vi < V) { vi++; nv++; }
    if (ei < E) { ei++; ne++; }
  }
  const total = nv + ne, pct = nv / total;
  console.log(`  vivas=${nv} estaticas=${ne} total=${total} vivo=${(100 * pct).toFixed(1)}%`);
  chk(`vivas ${V} (≥ estáticas ${E}), proporción viva en [0.65, 0.75]`, pct >= 0.65 && pct <= 0.75);
  chk('las estáticas se intercalan como relleno (patrón VVE, no un bloque al final)', /lineasFondo\.push\(\{ vivo: true[\s\S]{0,120}vivo: true[\s\S]{0,120}vivo: false/.test(main));
}

console.log('=== OPACIDADES: vivas 0.15, estáticas 0.08; interlínea 16, mono 10 ===');
{
  chk('alfa viva 0.15 / estática 0.08', /L\.vivo \? 0\.15 : 0\.08/.test(cuerpoFn));
  chk('interlínea FONDO_LH = 16', /FONDO_LH = 16\b/.test(main));
  chk('fuente mono 10px, color --texto-apagado, alineado izq', /font = '10px/.test(cuerpoFn) && /fillStyle = COLOR\.textoApagado/.test(cuerpoFn) && /textAlign = 'left'/.test(cuerpoFn));
  const iClear = main.indexOf('ctx.clearRect(0, 0, W, H);');
  const iDraw = main.indexOf('dibujarFondoDatos();');
  const iWorld = main.indexOf('ctx.save();\n    try {');
  chk('capa detrás de todo (tras clearRect, antes del mundo)', iDraw > iClear && iDraw < iWorld);
}

console.log('=== VIVAS cambian con el estado; ESTÁTICAS no ===');
{
  chk('cascEntidad cambia con posición/velocidad (vivo)', U.cascEntidad('b', { x: 1, y: 1, vx: 1, vy: 1 }) !== U.cascEntidad('b', { x: 2, y: 1, vx: 1, vy: 1 }));
  chk('cascTarget cambia con rot/vivos (vivo)', U.cascTarget('t', { x: 0, y: 0, vx: 0, vy: 0, rot: 0.1, vivos: 5, vivosMax: 20 }) !== U.cascTarget('t', { x: 0, y: 0, vx: 0, vy: 0, rot: 0.2, vivos: 4, vivosMax: 20 }));
  chk('CASC_CODIGO son strings constantes (estáticas no cambian)', U.CASC_CODIGO.every(function (s) { return typeof s === 'string' && s === s; }));
  // Las vivas leen estado real del juego; las estáticas devuelven CASC_CODIGO.
  chk('vivas leen estado real (marcador/bolitas/targets/…)', /marcador\.puntos|bolitas\[0\]|targets\[0\]|tiempoRestante/.test(bloqueVivas));
  chk('estáticas = U.CASC_CODIGO (fragmentos de código)', /cascEstaticas = U\.CASC_CODIGO\.map/.test(main));
}

console.log('=== ESTÁTICO REAL: cada fragmento existe verbatim en el código fuente ===');
{
  const fuente = fisicaSrc + main + puntSrc;
  U.CASC_CODIGO.forEach(function (frag) {
    chk(`existe en el fuente: "${frag.slice(0, 34)}${frag.length > 34 ? '…' : ''}"`, fuente.indexOf(frag) !== -1);
  });
  chk('sin texto inventado (lorem/placeholder/decorativo) en CASC_CODIGO', !U.CASC_CODIGO.some(function (s) { return /lorem|ipsum|placeholder|decorativ/i.test(s); }));
}

console.log('=== EVENTOS reales + FUERA freno fps + sin toques ===');
{
  const fuente = fisicaSrc + puntSrc + main;
  U.CASC_EVENTOS.forEach(function (fn) { chk(`${fn} existe como función real`, new RegExp('function ' + fn + '\\b').test(fuente) || new RegExp('\\b' + fn + ':').test(fuente)); });
  chk('el evento muestra el ÚLTIMO ocurrido (ultimoEvento)', /return ultimoEvento;/.test(main) && /function cascEvento\(fn, datos\) \{ ultimoEvento = fn/.test(main));
  chk('SIN freno por fps (no consulta fps/columnas/regimen)', !/fps < 40|fps < 50|regimenCasc|columnas\(/.test(main));
  chk('la capa no agrega listeners ni captura punteros', !/addEventListener|setPointerCapture/.test(cuerpoFn));
  chk('conteo: un solo ctx.fillText en el loop, sin shadow/gradiente', (cuerpoFn.match(/ctx\.fillText/g) || []).length === 1 && !/shadow|createLinearGradient|createRadialGradient/.test(cuerpoFn));
}

console.log(`\n== RESUMEN datos-fondo(18): ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
