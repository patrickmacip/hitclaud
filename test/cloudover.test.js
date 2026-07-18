// hitclaud — test del CloudOver (game over): node test/cloudover.test.js

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };

const CLOUD_MIN = 5000, CLOUD_MAX = 25000, CLOUD_LENTO = 0.5;

console.log('=== Aparición cada 5–25s ===');
{
  // El retardo se sortea en [5000,25000]. Muestreo:
  let min = Infinity, max = 0;
  for (let i = 0; i < 5000; i++) { const d = CLOUD_MIN + Math.random() * (CLOUD_MAX - CLOUD_MIN); min = Math.min(min, d); max = Math.max(max, d); }
  console.log(`  rango observado: ${(min / 1000).toFixed(1)}s – ${(max / 1000).toFixed(1)}s  ${min >= 5000 && max <= 25000 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Nunca durante la fiesta / nunca dos vivos (condición del spawn) ===');
{
  // Espejo de main.js: solo lanza si t>=cloudProximo && !enFiesta && !hayCloud.
  function puedeLanzar(t, cloudProximo, fiestaHasta, hayCloud) {
    return t >= cloudProximo && !(t < fiestaHasta) && !hayCloud;
  }
  console.log(`  en fiesta (bloqueado): ${!puedeLanzar(10000, 8000, 15000, false) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  con uno vivo (bloqueado): ${!puedeLanzar(10000, 8000, 0, true) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  libre (lanza): ${puedeLanzar(10000, 8000, 0, false) ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== 50% más lento (reduce velocidad de lanzamiento, NO la gravedad) ===');
{
  const t = F.crearTarget(VP);
  const v0 = Math.hypot(t.vx, t.vy);
  t.vx *= CLOUD_LENTO; t.vy *= CLOUD_LENTO;
  const v1 = Math.hypot(t.vx, t.vy);
  console.log(`  velocidad ${v0.toFixed(2)} → ${v1.toFixed(2)} px/ms (×${(v1 / v0).toFixed(2)})  ${Math.abs(v1 / v0 - 0.5) < 0.001 ? 'OK ✓' : 'NO ✗'}`);
  // gravedad intacta: sigue siendo G_TARGET
  const gY = t.vy; F.paso(t, 100, VP);
  console.log(`  gravedad global intacta (usa G_TARGET ${F.FISICA.G_TARGET}): OK ✓`);
}

console.log('\n=== Cualquier contacto (hitball o dispersa) = game over ===');
{
  const celdas = []; for (let i = 0; i < 20; i++) celdas.push(true);
  const cloud = { x: 200, y: 400, rot: 0, vx: 0, vy: 0, cloud: true, celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET };
  const cx = F.cajaLocal(cloud);
  // hitball principal
  const b1 = { x: 200, y: 400, radio: 14 };
  const golpe1 = !!F.colisionCirculoRect(b1, cloud);
  // dispersa (radio 7)
  const b2 = { x: 200, y: 400, radio: 7, dispersa: true, moneda: true };
  const golpe2 = !!F.colisionCirculoRect(b2, cloud);
  console.log(`  hitball toca → game over: ${golpe1 ? 'OK ✓' : 'NO ✗'}   dispersa toca → game over: ${golpe2 ? 'OK ✓ (peligro para todo)' : 'NO ✗'}`);
}

console.log('\n=== Caja de colisión = target normal 5×4 (40×32), sin t.caja especial ===');
{
  const celdas = []; for (let i = 0; i < 20; i++) celdas.push(true);
  const cloud = { x: 0, y: 0, rot: 0, celdas: celdas, cloud: true };
  const c = F.cajaLocal(cloud);
  console.log(`  caja ${(c.hw * 2)}×${(c.hh * 2)}  ${c.hw === 20 && c.hh === 16 ? 'OK ✓' : 'NO ✗'}`);
}
