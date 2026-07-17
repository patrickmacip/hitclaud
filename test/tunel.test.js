// hitclaud — test de fuga por túnel: node test/tunel.test.js
// Con subpasos, ningún disparo a V_MAX debe atravesar un target sin colisión.

const F = require('../js/fisica.js');
const VIEWPORT = { w: 600, h: 800 };
const VMAX = F.FISICA.VEL_SALIDA_MAX;

function targetIntacto() {
  const celdas = [];
  for (let i = 0; i < 20; i++) celdas.push(true);
  return { x: 300, y: 400, rot: 0, vx: 0, vy: 0, celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET };
}
function targetLinea5() { // 5 cubos en fila (row 1): 40×8, lo más delgado
  const celdas = [];
  for (let i = 0; i < 20; i++) celdas.push(i >= 5 && i <= 9);
  return { x: 300, y: 400, rot: 0, vx: 0, vy: 0, celdas: celdas, vivos: 5, masa: F.FISICA.MASA_TARGET * 0.25 };
}

// Lanza desde `dist` px en dirección `ang`, apuntando al centro del target
// (± jitter pequeño para que la trayectoria SÍ lo atraviese). Sub-pasea con
// paso() y prueba colisión en cada subpaso. → true si detectó contacto.
function atraviesa(target, ang, dist, jitter) {
  const px = target.x + Math.cos(ang) * dist;
  const py = target.y + Math.sin(ang) * dist;
  const dir = Math.atan2(target.y - py, target.x - px) + jitter;
  const b = { x: px, y: py, vx: Math.cos(dir) * VMAX, vy: Math.sin(dir) * VMAX, edad: 0, viva: true };
  let tocado = false;
  for (let f = 0; f < 200 && b.viva; f++) {
    F.paso(b, 16.7, VIEWPORT, function () {
      if (!tocado && F.colisionCirculoRect(b, target)) tocado = true;
    });
    if (tocado) break;
    if (f > 3 && Math.hypot(b.x - target.x, b.y - target.y) > dist + 60) break; // ya pasó de largo
  }
  return tocado;
}

function simula(nombre, hazTarget) {
  let fugas = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2; // apunta AL CENTRO → la trayectoria lo cruza
    if (!atraviesa(hazTarget(), ang, 150, 0)) fugas++;
  }
  console.log(`  ${nombre}: ${fugas} fugas de ${N}  ${fugas === 0 ? 'OK ✓' : 'NO ✗'}`);
  return fugas;
}

console.log(`MAX_PASO_PX=${F.FISICA.MAX_PASO_PX}  V_MAX=${VMAX} px/ms`);
console.log('\n=== Fugas de túnel (200 disparos a V_MAX que atraviesan) ===');
simula('target intacto 40×32', targetIntacto);
simula('target mordido 5 cubos en línea (40×8)', targetLinea5);

// Verificación del ápice del techo con subpasos: tiro vertical a V_MAX desde
// el reposo (y≈792 en h=844). Debe apexar a ~40-60px del borde superior.
console.log('\n=== Ápice del techo (subpasos) ===');
{
  const VP = { w: 390, h: 844 };
  const b = { x: 338, y: 792, vx: 0, vy: -VMAX, edad: 0, viva: true };
  let minY = 792;
  for (let f = 0; f < 200 && b.viva && b.vy < 0; f++) {
    F.paso(b, 16.7, VP);
    if (b.y < minY) minY = b.y;
  }
  console.log(`  ápice a ${Math.round(minY)}px del borde superior  [objetivo 40-60: ${minY >= 40 && minY <= 60 ? 'OK ✓' : 'revisar'}]`);
}
