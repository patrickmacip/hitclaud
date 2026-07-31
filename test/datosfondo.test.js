// hitclaud — FASE 17: datos de fondo FIJOS (sin cascada, sin freno). node test/datosfondo.test.js

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

// Cuerpo de dibujarFondoDatos y el bloque de setup.
const iFn = main.indexOf('function dibujarFondoDatos()');
const cuerpoFn = main.slice(iFn, main.indexOf('\n  }', iFn) + 4);
const iBloque = main.indexOf('DATOS DE FONDO FIJOS (FASE 17)');
const bloque = main.slice(iBloque, iFn + 400);

console.log('=== SIN CASCADA: no hay movimiento vertical ni reciclado de líneas ===');
{
  chk('util.js: sin crearCascada (motor de caída eliminado)', !/function crearCascada/.test(utilSrc));
  chk('util.js: sin crearRegimenCascada (freno por fps eliminado)', !/function crearRegimenCascada/.test(utilSrc));
  chk('main.js: sin cascada.push/render ni regimenCasc', !/cascada\.(push|render)|regimenCasc|crearCascada|crearRegimenCascada/.test(main));
  chk('main.js: sin y por tiempo (nacio/cruceMs/colsActivas)', !/nacio|cruceMs|colsActivas/.test(main));
  chk('la y de cada línea es FIJA: FONDO_Y0 + i*FONDO_LH', /FONDO_Y0 \+ i \* FONDO_LH/.test(cuerpoFn));
}

console.log('=== DISPOSICIÓN: 1 columna, x=20px, interlínea de 10px mono ===');
{
  chk('FONDO_X = 20 (margen izquierdo, sin tocar el borde)', /FONDO_X = 20\b/.test(main));
  chk('x de la columna = FONDO_X en el fillText', /ctx\.fillText\(s, FONDO_X,/.test(cuerpoFn));
  chk('interlínea FONDO_LH y fuente mono 10px', /FONDO_LH = 13/.test(main) && /font = '10px/.test(cuerpoFn));
  chk('una sola columna (sin col*W/3 ni múltiples x)', !/W \/ baseCols|W \/ 3/.test(main));
}

console.log('=== OPACIDAD 0.15 y capa detrás de todo ===');
{
  chk('globalAlpha = 0.15 (antes 0.25)', /ctx\.globalAlpha = 0\.15/.test(cuerpoFn));
  chk('color = --texto-apagado (COLOR.textoApagado)', /fillStyle = COLOR\.textoApagado/.test(cuerpoFn));
  const iClear = main.indexOf('ctx.clearRect(0, 0, W, H);');
  const iDraw = main.indexOf('dibujarFondoDatos();');
  const iWorld = main.indexOf('ctx.save();\n    try {');
  chk('se dibuja tras clearRect y ANTES del mundo (capa de fondo)', iDraw > iClear && iDraw < iWorld);
}

console.log('=== FUERA EL FRENO: ningún umbral de fps gatea la visibilidad ===');
{
  chk('dibujarFondoDatos NO consulta fps/columnas/regimen', !/fps|columnas|regimen|< 50|< 40/.test(cuerpoFn));
  chk('dibujarFondoDatos NO se omite por reduced-motion (ya no hay movimiento)', !/reducirMovimiento/.test(cuerpoFn));
  chk('el bloque SIEMPRE se dibuja (loop directo, sin return de gate)', /for \(let i = 0; i < lineasFondo\.length/.test(cuerpoFn));
}

console.log('=== Conteo de fillText por cuadro = nº de líneas fijas ===');
{
  const nLineas = 9 + U.CASC_CONST_FISICA.length + U.CASC_CONST_PUNT.length + 5;
  chk(`líneas fijas = ${nLineas} (≤33 fillText/cuadro, un fillText por línea)`, nLineas === 33);
  chk('un solo ctx.fillText en el loop, sin shadow ni gradiente', (cuerpoFn.match(/ctx\.fillText/g) || []).length === 1 && !/shadow|createLinearGradient|createRadialGradient/.test(cuerpoFn));
}

console.log('=== REGLA DEL DUEÑO INTACTA: todo real (constantes, telemetría, eventos) ===');
{
  chk('cascConst = NOMBRE=valor real leído del objeto', U.cascConst('GRAVEDAD', F.FISICA.GRAVEDAD) === 'GRAVEDAD=0.0035');
  chk('cascEntidad usa campos reales x/y/vx/vy', U.cascEntidad('bolitas[0]', { x: 1, y: 2, vx: 3, vy: 4 }) === 'bolitas[0] x:1 y:2 vx:3 vy:4');
  chk('CASC_CONST_FISICA: claves reales de F.FISICA', U.CASC_CONST_FISICA.every(function (k) { return k in F.FISICA; }));
  chk('CASC_CONST_PUNT: claves reales de P', U.CASC_CONST_PUNT.every(function (k) { return k in P; }));
  ['MAX_CUBOS', 'MAX_BOLITAS', 'MAX_EN_PANTALLA', 'ESTELA_PUNTOS', 'SPAWN_GAP_MAX'].forEach(function (nombre) {
    chk(`main.js declara const ${nombre} (leída live)`, new RegExp('const ' + nombre + ' =').test(main));
  });
  const fuente = fisicaSrc + puntSrc + main;
  U.CASC_EVENTOS.forEach(function (fn) {
    chk(`${fn} existe como función real`, new RegExp('function ' + fn + '\\b').test(fuente) || new RegExp('\\b' + fn + ':').test(fuente));
  });
  chk('cascEvento fija el ÚLTIMO evento (ultimoEvento), no una cola', /function cascEvento\(fn, datos\) \{ ultimoEvento = fn/.test(main));
  chk('una línea fija muestra ultimoEvento', /return ultimoEvento;/.test(main));
  chk('resolverImpacto se emite tras F.resolverImpacto (sitio real)', /F\.resolverImpacto\(b, tg\);[\s\S]{0,80}cascEvento\('resolverImpacto'/.test(main));
  chk('sin texto decorativo/inventado en el bloque', !/lorem|ipsum|placeholder|decorativ/i.test(bloque));
}

console.log('=== La capa NO recibe eventos táctiles (pintura pura) ===');
{
  chk('dibujarFondoDatos no agrega listeners ni captura punteros', !/addEventListener|setPointerCapture/.test(cuerpoFn));
}

console.log(`\n== RESUMEN datos-fondo: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
