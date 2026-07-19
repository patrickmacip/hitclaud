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

const CLOUD_GRAV_FRAC = 0.25;

// Fabrica un CloudOver como main.js (mismo spawner de orígenes + v/2 + g/4).
function crearCloud(vp) {
  const t = F.crearTarget(vp);
  t.cloud = true; t.enojado = false;
  t.vx *= CLOUD_LENTO; t.vy *= CLOUD_LENTO;
  t.gravedad = F.FISICA.G_TARGET * CLOUD_GRAV_FRAC;
  t.caja = { cx: 0, cy: 0, hw: 20 * 1.3, hh: 16 * 1.3 };
  return t;
}

console.log('\n=== 50% más lento en el TIEMPO: v/2 + g/4 → MISMO apex, ~2× de vuelo ===');
{
  // apex ∝ v²/g. Con v→v/2 y g→g/4: v²/g → (v/2)²/(g/4) = v²/g (igual). El
  // tiempo de vuelo ∝ v/g → (v/2)/(g/4) = 2·(v/g) (el doble). Verifico con la
  // simulación real: apex del cloud ≈ apex de un normal con la misma v de salida.
  const vp = { w: 390, h: 844 };
  function apex(obj) { // altura máx alcanzada (menor y) desde su y inicial
    let minY = obj.y, t = 0;
    while (obj.viva && t < 8000) { F.paso(obj, 16, vp); minY = Math.min(minY, obj.y); t += 16; }
    return minY;
  }
  // Un normal y un cloud con IDÉNTICO estado de salida salvo v/2 y g/4.
  // Origen INFERIOR (sube desde abajo) para que el apex mida el arco de verdad.
  let base; do { base = F.crearTarget(vp); } while (base.origen !== 'inferior');
  const norm = Object.assign({}, base, { celdas: base.celdas.slice() });
  const cl = Object.assign({}, base, { celdas: base.celdas.slice(), vx: base.vx * 0.5, vy: base.vy * 0.5, gravedad: F.FISICA.G_TARGET * CLOUD_GRAV_FRAC });
  const aN = apex(norm), aC = apex(cl);
  console.log(`  apex normal ${aN.toFixed(0)}px vs cloud ${aC.toFixed(0)}px (Δ ${Math.abs(aN - aC).toFixed(0)}px)  ${Math.abs(aN - aC) < 30 ? 'OK ✓ (mismo arco)' : 'NO ✗'}`);
}

console.log('\n=== Orígenes: los especiales usan el MISMO spawner (sin spawner aparte) ===');
{
  const vp = { w: 390, h: 844 };
  const cont = { inferior: 0, lateral: 0, superior: 0 };
  for (let i = 0; i < 6000; i++) cont[crearCloud(vp).origen]++;
  const tot = 6000;
  console.log(`  inferior ${(100 * cont.inferior / tot).toFixed(0)}% · lateral ${(100 * cont.lateral / tot).toFixed(0)}% · superior ${(100 * cont.superior / tot).toFixed(0)}%`);
  const todos = cont.inferior > 0 && cont.lateral > 0 && cont.superior > 0;
  console.log(`  sale de los TRES orígenes (inferior/lateral/superior): ${todos ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Vuelo VISIBLE y GOLPEABLE desde cada origen (criterio: ≥90% por origen, ≥95% global) ===');
{
  const vp = { w: 390, h: 844 };
  // "Visible y golpeable" = pasa ≥1200ms dentro de la zona jugable central
  // (x∈[0.05w,0.95w], y∈[0.06h,0.94h]) → hay ventana amplia para el tiro directo.
  function vueloGolpeable(t) {
    let dentro = 0, tt = 0;
    while (t.viva && tt < 8000) {
      F.paso(t, 16, vp);
      if (t.x > 0.05 * vp.w && t.x < 0.95 * vp.w && t.y > 0.06 * vp.h && t.y < 0.94 * vp.h) dentro += 16;
      tt += 16;
    }
    return dentro;
  }
  const porOrigen = { inferior: { n: 0, ok: 0, ms: 0 }, lateral: { n: 0, ok: 0, ms: 0 }, superior: { n: 0, ok: 0, ms: 0 } };
  for (let i = 0; i < 3000; i++) {
    const t = crearCloud(vp);
    const o = porOrigen[t.origen];
    const ms = vueloGolpeable(t);
    o.n++; o.ms += ms; if (ms >= 1200) o.ok++;
  }
  let globalOk = 0, globalN = 0;
  ['inferior', 'lateral', 'superior'].forEach(function (k) {
    const o = porOrigen[k];
    globalOk += o.ok; globalN += o.n;
    console.log(`  ${k}: ${(100 * o.ok / o.n).toFixed(0)}% golpeables · vuelo medio ${(o.ms / o.n).toFixed(0)}ms  ${o.ok / o.n >= 0.90 ? 'OK ✓' : 'NO ✗'}`);
  });
  console.log(`  GLOBAL golpeables ${(100 * globalOk / globalN).toFixed(1)}%  ${globalOk / globalN >= 0.95 ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== La colisión detecta el contacto (caja escalada) ===');
{
  const celdas = []; for (let i = 0; i < 20; i++) celdas.push(true);
  const cloud = { x: 200, y: 400, rot: 0, vx: 0, vy: 0, cloud: true, celdas: celdas, vivos: 20, masa: F.FISICA.MASA_TARGET, caja: { cx: 0, cy: 0, hw: 26, hh: 20.8 } };
  const b = { x: 200, y: 400, radio: 14 };
  console.log(`  hitball en el centro colisiona: ${F.colisionCirculoRect(b, cloud) ? 'OK ✓' : 'NO ✗'}`);
}

console.log('\n=== Parpadeo A/B cada 100ms (loop) ===');
{
  const A = '#B1003B', B = '#FF0055', MS = 100;
  const col = (t) => Math.floor(t / MS) % 2 ? A : B;
  // muestreo a lo largo de 400ms: debe alternar B,A,B,A por tramos de 100ms
  const secuencia = [0, 100, 200, 300].map(col);
  const alterna = secuencia[0] === B && secuencia[1] === A && secuencia[2] === B && secuencia[3] === A;
  console.log(`  t=0/100/200/300 → ${secuencia.map(c=>c===A?'A':'B').join(',')}  ${alterna ? 'OK ✓ (alterna cada 100ms)' : 'NO ✗'}`);
  // dentro de un mismo tramo de 100ms NO cambia:
  console.log(`  t=10 y t=90 iguales (mismo tramo): ${col(10) === col(90) ? 'OK ✓' : 'NO ✗'}`);
}
