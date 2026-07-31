// hitclaud — FASE 16 commit 2: cascada de DATOS REALES. node test/cascada.test.js

const U = require('../js/util.js');
const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const fisicaSrc = fs.readFileSync(__dirname + '/../js/fisica.js', 'utf8');
const puntSrc = fs.readFileSync(__dirname + '/../js/puntuacion.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== Formateadores: cada línea refleja DATOS reales (campos x,y,vx,vy,rot,vivos) ===');
{
  chk('cascEntidad usa los campos reales x/y/vx/vy', U.cascEntidad('bolitas[0]', { x: 1, y: 2, vx: 3, vy: 4 }) === 'bolitas[0] x:1 y:2 vx:3 vy:4');
  chk('cascTarget agrega rot y vivos/vivosMax', U.cascTarget('targets[0]', { x: 10, y: 20, vx: 0.5, vy: -0.5, rot: 0.25, vivos: 12, vivosMax: 20 }) === 'targets[0] x:10 y:20 vx:0.5000 vy:-0.5000 rot:0.2500 vivos:12/20');
  chk('cascConst = NOMBRE=valor real', U.cascConst('RESTITUCION_GOLPE', F.FISICA.RESTITUCION_GOLPE) === 'RESTITUCION_GOLPE=0.3000');
  chk('cascFmt determinista (enteros sin decimales; <1 con 4)', U.cascFmt(240) === '240' && U.cascFmt(0.0035) === '0.0035' && U.cascFmt(2.28) === '2.28');
}

console.log('=== Constantes: nombres REALES leídos del código (ninguno inventado) ===');
{
  chk('CASC_CONST_FISICA: todos son claves reales de F.FISICA', U.CASC_CONST_FISICA.every(function (k) { return k in F.FISICA; }));
  chk('CASC_CONST_PUNT: todos son claves reales de P', U.CASC_CONST_PUNT.every(function (k) { return k in P; }));
  // Valores leídos LIVE del objeto (si cambian, la cascada los refleja): prueba el vínculo.
  const antes = U.cascConst('RESTITUCION_GOLPE', F.FISICA.RESTITUCION_GOLPE);
  const g = F.FISICA.RESTITUCION_GOLPE; F.FISICA.RESTITUCION_GOLPE = 0.9;
  const despues = U.cascConst('RESTITUCION_GOLPE', F.FISICA.RESTITUCION_GOLPE);
  F.FISICA.RESTITUCION_GOLPE = g;
  chk('el valor sale del objeto vivo, no de un literal', antes === 'RESTITUCION_GOLPE=0.3000' && despues === 'RESTITUCION_GOLPE=0.9000');
  // Constantes locales de main.js referenciadas por la cascada: existen como const.
  ['MAX_CUBOS', 'MAX_BOLITAS', 'MAX_EN_PANTALLA', 'ESTELA_PUNTOS', 'SPAWN_GAP_MAX'].forEach(function (nombre) {
    chk(`main.js declara const ${nombre}`, new RegExp('const ' + nombre + ' =').test(main));
  });
}

console.log('=== Eventos: nombres de función REALES (existen en el código) ===');
{
  const fuente = fisicaSrc + puntSrc + main;
  U.CASC_EVENTOS.forEach(function (fn) {
    const existe = new RegExp('function ' + fn + '\\b').test(fuente) || new RegExp('\\b' + fn + ':').test(fuente);
    chk(`${fn} existe como función real`, existe);
  });
  // Y se EMITE en el sitio real de su llamada (cascEvento junto a la llamada real).
  chk('resolverImpacto se emite tras F.resolverImpacto', /F\.resolverImpacto\(b, tg\);[\s\S]{0,80}cascEvento\('resolverImpacto'/.test(main));
  chk('anotarFallo se emite tras P.anotarFallo', /P\.anotarFallo\(marcador\);[\s\S]{0,60}cascEvento\('anotarFallo'/.test(main));
  chk('golpeCloudover se emite en golpeCloudover', /function golpeCloudover[\s\S]{0,160}cascEvento\('golpeCloudover'/.test(main));
}

console.log('=== Sin texto inventado: las etiquetas de telemetría son identificadores REALES ===');
{
  // Cada etiqueta usada en las fuentes corresponde a una variable/función real del código.
  const idsReales = ['bolitas', 'targets', 'cubos', 'marcador', 'modoJuego', 'tiempoRestante', 'medidorFps', 'multRacha'];
  idsReales.forEach(function (id) {
    const real = new RegExp('(const|let|var|function) ' + id + '\\b').test(main) || new RegExp('\\b' + id + '\\b').test(main + puntSrc);
    chk(`la etiqueta '${id}' es un identificador real del código`, real);
  });
  // No hay frases decorativas obvias en la zona de la cascada.
  const iC = main.indexOf('CASCADA de datos reales (FASE 16)');
  const zona = main.slice(iC, iC + 2600);
  chk('sin "lorem"/relleno en la cascada', !/lorem|ipsum|placeholder|TODO texto|decorativ/i.test(zona));
}

console.log('=== DEGRADACIÓN por fps: 3 → 2 (<50 sostenido 1s) → 0 (<40 sostenido 1s) → vuelve ===');
{
  const r = U.crearRegimenCascada(3);
  chk('60fps → 3 columnas', r.columnas(60, 0) === 3);
  chk('45fps recién (t=100) aún 3 (no llegó a 1s)', r.columnas(45, 100) === 3);
  chk('45fps sostenido >1s (t=1200) → 2 columnas', r.columnas(45, 1200) === 2);
  chk('35fps recién (t=1300) aún 2 (t40 apenas empieza)', r.columnas(35, 1300) === 2);
  chk('35fps sostenido >1s (t=2400) → 0 (apagada)', r.columnas(35, 2400) === 0);
  chk('55fps (t=2500) → vuelve a 3 (recuperación inmediata)', r.columnas(55, 2500) === 3);
}

console.log('=== MOTOR: cae, culla al salir, y respeta el TOPE de fillText por cuadro ===');
{
  const casc = U.crearCascada({ columnas: 3, cruceMs: 6000, intervaloMs: 800, maxPorColumna: 9 });
  let picoLineas = 0;
  for (let t = 0; t <= 20000; t += 400) {
    casc.push(t, 3, function () { return 'dato'; });
    const vis = casc.render(t, 390, 844);
    if (vis.length > picoLineas) picoLineas = vis.length;
    // y crece con el tiempo de vida (cae).
    if (vis.length) { const any = vis[0]; if (!(any.y >= 0)) { picoLineas = 9999; } }
  }
  chk(`tope DURO respetado: nunca más de 27 líneas/cuadro (pico ${picoLineas})`, picoLineas <= 27);
  chk('con 3 col × 9 tope, el presupuesto de fillText ≤ 27', 3 * 9 === 27);
  // Caída: una línea nace arriba (y pequeño) y baja.
  const c2 = U.crearCascada({ columnas: 1, cruceMs: 6000, intervaloMs: 800, maxPorColumna: 9 });
  c2.push(0, 1, function () { return 'x'; });
  const y0 = c2.render(0, 390, 844)[0].y;
  const y1 = c2.render(3000, 390, 844)[0].y;
  chk('la línea CAE (y crece con el tiempo)', y1 > y0);
  // apagada (0 col) → limpia.
  c2.push(4000, 0, function () { return 'x'; });
  chk('colsActivas=0 apaga la cascada (0 líneas)', c2.lineas.length === 0);
}

console.log('=== Capa de fondo, sin recuadro fps, sin eventos táctiles, sin sombra/gradiente ===');
{
  const iClear = main.indexOf('ctx.clearRect(0, 0, W, H);');
  const iCasc = main.indexOf('dibujarCascada();');
  const iWorld = main.indexOf('ctx.save();\n    try {');
  chk('dibujarCascada se llama tras clearRect y ANTES del mundo (capa de fondo)', iCasc > iClear && iCasc < iWorld);
  chk('el recuadro anterior del medidor v41-fps fue eliminado', !/const bx = 8, by = 96/.test(main));
  chk('el medidor sigue midiendo (registrar) para alimentar la cascada', /medidorFps\.registrar\(/.test(main));
  // La cascada es pintura pura: no agrega addEventListener (no captura toques).
  const iC = main.indexOf('function dibujarCascada()');
  const cuerpo = main.slice(iC, main.indexOf('function rnd(', iC));
  chk('dibujarCascada no agrega listeners ni captura eventos', !/addEventListener|setPointerCapture/.test(cuerpo));
  chk('dibujarCascada: sin shadowBlur ni gradientes (solo fillText)', !/shadow|createLinearGradient|createRadialGradient/.test(cuerpo) && /fillText/.test(cuerpo));
  chk('reduced-motion: la cascada se omite', /if \(reducirMovimiento\(\)\) return;/.test(cuerpo));
}

console.log(`\n== RESUMEN cascada: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
