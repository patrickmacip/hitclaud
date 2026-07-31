// hitclaud — build de debug v41-fps: medidor de fps/tiempos. node test/fps.test.js
// Cálculo de fps y del peor cuadro con timestamps SIMULADOS.

const U = require('../js/util.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== 60 cuadros en ~1s → fps ≈ 60; peor pico correcto ===');
{
  const m = U.crearMedidorFps(1000, 0); // refresco 0 = recomputa siempre (para test)
  const DT = 1000 / 60;
  let t = 0;
  for (let i = 0; i < 60; i++) { m.registrar(t, i === 0 ? 0 : DT, 2.0); t += DT; }
  const r = m.leer(t - DT);
  chk(`fps ≈ 60 (dio ${r.fps.toFixed(1)})`, Math.abs(r.fps - 60) < 1.5);
  chk(`peor pico ≈ 16.7ms (dio ${r.peorMs.toFixed(1)})`, Math.abs(r.peorMs - DT) < 0.5);
  chk(`dibujo medio = 2.0ms (dio ${r.dibujoMs.toFixed(2)})`, Math.abs(r.dibujoMs - 2.0) < 1e-6);
}

console.log('\n=== 30 cuadros en ~1s → fps ≈ 30 (la cámara lenta que reporta el dueño) ===');
{
  const m = U.crearMedidorFps(1000, 0);
  const DT = 1000 / 30;
  let t = 0;
  for (let i = 0; i < 30; i++) { m.registrar(t, i === 0 ? 0 : DT, 8.0); t += DT; }
  const r = m.leer(t - DT);
  chk(`fps ≈ 30 (dio ${r.fps.toFixed(1)})`, Math.abs(r.fps - 30) < 1.0);
  chk(`dibujo medio 8ms (dio ${r.dibujoMs.toFixed(1)})`, Math.abs(r.dibujoMs - 8.0) < 1e-6);
}

console.log('\n=== Un PICO lento domina el "peor cuadro" del último segundo ===');
{
  const m = U.crearMedidorFps(1000, 0);
  const DT = 16.7;
  let t = 0;
  for (let i = 0; i < 30; i++) { const dt = i === 15 ? 120 : DT; m.registrar(t, i === 0 ? 0 : dt, 3); t += (i === 15 ? 120 : DT); }
  const r = m.leer(t - DT);
  chk(`peorMs = 120 (el pico), no el promedio (dio ${r.peorMs})`, r.peorMs === 120);
}

console.log('\n=== Ventana móvil: los cuadros de hace >1s se purgan ===');
{
  const m = U.crearMedidorFps(1000, 0);
  const DT = 16.7;
  let t = 0;
  for (let i = 0; i < 180; i++) { m.registrar(t, i === 0 ? 0 : DT, 1); t += DT; } // ~3s
  m.leer(t - DT);
  const span = m.muestras[m.muestras.length - 1].t - m.muestras[0].t;
  chk(`sólo se guarda ~1s de muestras (span ${span.toFixed(0)}ms ≤ 1000)`, span <= 1000);
  chk(`~60 muestras en la ventana (dio ${m.muestras.length})`, m.muestras.length >= 55 && m.muestras.length <= 62);
}

console.log('\n=== Refresco: leer sólo recomputa cada refrescoMs (números estables) ===');
{
  const m = U.crearMedidorFps(1000, 500);
  m.registrar(0, 0, 1); m.registrar(16, 16, 1);
  const a = m.leer(16);            // primer cálculo
  // Cambia radicalmente la escena, pero dentro de los 500ms el valor mostrado NO cambia.
  m.registrar(32, 500, 99);        // un cuadro lentísimo
  const b = m.leer(200);           // 200ms < 500 → cache
  chk('dentro de 500ms el valor es estable (cache)', b.peorMs === a.peorMs);
  const c = m.leer(600);           // 600ms ≥ 500 → recomputa
  chk('tras 500ms recomputa y refleja el pico (500ms)', c.peorMs === 500);
}

console.log(`\n== RESUMEN fps: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
