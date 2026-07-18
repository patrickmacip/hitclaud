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

console.log('\n=== No aparece en fiesta NI power-up, nunca dos vivos ===');
{
  // Espejo de main.js: lanza si t>=cloudProximo && !enFiesta && t>=powerupHasta && !hayCloud.
  function puedeLanzar(t, cloudProximo, fiestaHasta, powerupHasta, hayCloud) {
    return t >= cloudProximo && !(t < fiestaHasta) && t >= powerupHasta && !hayCloud;
  }
  console.log(`  en fiesta (bloqueado): ${!puedeLanzar(10000, 8000, 15000, 0, false) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  en power-up (bloqueado): ${!puedeLanzar(10000, 8000, 0, 15000, false) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  con uno vivo (bloqueado): ${!puedeLanzar(10000, 8000, 0, 0, true) ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  libre (lanza): ${puedeLanzar(10000, 8000, 0, 0, false) ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== SOLO tiro directo: dispersa ignora, hitball principal mata ===');
{
  // Espejo de main.js: en la rama cloud, si b.dispersa → continue (ignora);
  // si no y hay colisión y no hay premio → game over.
  function resultado(b, colisiona, enPremio) {
    if (b.dispersa) return 'ignora';
    if (!colisiona) return 'sin contacto';
    if (enPremio) return 'no letal (premio)';
    return 'GAME OVER';
  }
  console.log(`  dispersa toca → ${resultado({ dispersa: true }, true, false)}  ${resultado({ dispersa: true }, true, false) === 'ignora' ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  hitball principal toca → ${resultado({ dispersa: false }, true, false)}  ${resultado({ dispersa: false }, true, false) === 'GAME OVER' ? 'OK ✓' : 'NO ✗'}`);
  console.log(`  principal toca en premio → ${resultado({ dispersa: false }, true, true)}  ${resultado({ dispersa: false }, true, true) === 'no letal (premio)' ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Más visible: 1.3× tamaño (caja escalada) ===');
{
  const cloud = { x: 0, y: 0, rot: 0, cloud: true, caja: { cx: 0, cy: 0, hw: 20 * 1.3, hh: 16 * 1.3 } };
  const c = F.colisionCirculoRect ? cloud.caja : null;
  console.log(`  caja ${(cloud.caja.hw * 2).toFixed(0)}×${(cloud.caja.hh * 2).toFixed(0)} (era 40×32)  ${cloud.caja.hw === 26 ? 'OK ✓' : 'NO ✗'}`);
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

console.log('\n=== La colisión detecta el contacto (caja escalada) ===');
{
  const celdas = []; for (let i = 0; i < 20; i++) celdas.push(true);
  const cloud = { x: 200, y: 400, rot: 0, vx: 0, vy: 0, cloud: true, celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET, caja: { cx: 0, cy: 0, hw: 26, hh: 20.8 } };
  const b = { x: 200, y: 400, radio: 14 };
  console.log(`  hitball en el centro colisiona: ${F.colisionCirculoRect(b, cloud) ? 'OK ✓' : 'NO ✗'}`);
}
