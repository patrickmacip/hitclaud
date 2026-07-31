// hitclaud — FASE 14 commit 2: el impacto pesa (RESTITUCION_GOLPE 0.6 → 0.3).
// node test/rebote.test.js

const F = require('../js/fisica.js');
const VP = { w: 390, h: 844 };
const VMAX = F.FISICA.VEL_SALIDA_MAX;

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

function targetEstatico(x, y) {
  const t = F.crearTarget(VP);
  t.x = x; t.y = y; t.vx = 0; t.vy = 0; t.rot = 0; t.haEntrado = true; t.viva = true;
  return t;
}

console.log('=== RESTITUCION_GOLPE = 0.3 (único valor que cambió) ===');
{
  chk('RESTITUCION_GOLPE === 0.3', F.FISICA.RESTITUCION_GOLPE === 0.3);
  // La gravedad, V_MAX, umbral, masa NO cambiaron.
  chk('VEL_SALIDA_MAX intacto (2.28)', F.FISICA.VEL_SALIDA_MAX === 2.28);
  chk('GRAVEDAD intacta (0.0035)', F.FISICA.GRAVEDAD === 0.0035);
  chk('MASA_TARGET intacta (2.5)', F.FISICA.MASA_TARGET === 2.5);
}

console.log('\n=== El impacto PESA: el rebote se reduce ~a la mitad ===');
{
  function reboteHeadOn() {
    const t = targetEstatico(195, 400);
    const b = { x: 195, y: 520, vx: 0, vy: -VMAX, edad: 0, viva: true, radio: 14 };
    let v = null;
    for (let f = 0; f < 40 && b.viva && v === null; f++) {
      F.paso(b, 16.7, VP, function () { if (v === null) { const r = F.resolverImpacto(b, t); if (r) v = Math.hypot(b.vx, b.vy); } });
    }
    return v;
  }
  const v = reboteHeadOn();
  console.log(`  |v| tras impacto head-on = ${v.toFixed(3)} px/ms (con 0.6 era ~0.913)`);
  chk('rebote head-on cae por debajo de 0.6 px/ms (antes ~0.913)', v < 0.6 && v > 0);
}

console.log('\n=== Sin RE-GOLPE inmediato del mismo target (guard vn>0) ===');
{
  const t = targetEstatico(195, 400);
  const b = { x: 195, y: 415, vx: 0, vy: -1.5, edad: 0, viva: true, radio: 14 };
  const r1 = F.resolverImpacto(b, t);
  const r2 = F.resolverImpacto(b, t); // inmediatamente después, ya separándose (vn>0)
  chk('1er contacto golpea', !!r1);
  chk('2º inmediato = null (vn>0 corta el re-golpe)', r2 === null);
}

console.log('\n=== Sin TÚNEL con el rebote nuevo (200 disparos a V_MAX que atraviesan) ===');
{
  function targetIntacto() { const c = []; for (let i = 0; i < 20; i++) c.push(true); return { x: 195, y: 420, rot: 0, vx: 0, vy: 0, celdas: c, cols: 5, filas: 4, vivos: 20, masa: F.FISICA.MASA_TARGET }; }
  let fugas = 0; const N = 200;
  for (let i = 0; i < N; i++) {
    const tg = targetIntacto();
    const ang = (i / N) * Math.PI * 2;
    const bx = tg.x + Math.cos(ang) * 150, by = tg.y + Math.sin(ang) * 150;
    const dir = Math.atan2(tg.y - by, tg.x - bx);
    const b = { x: bx, y: by, vx: Math.cos(dir) * VMAX, vy: Math.sin(dir) * VMAX, edad: 0, viva: true, radio: 14 };
    let tocado = false;
    for (let f = 0; f < 200 && b.viva && !tocado; f++) {
      F.paso(b, 16.7, VP, function () { if (F.colisionCirculoRect(b, tg)) tocado = true; });
      if (Math.hypot(b.x - tg.x, b.y - tg.y) > 210) break;
    }
    if (!tocado) fugas++;
  }
  chk(`0 fugas de ${N} con restitución 0.3`, fugas === 0);
}

console.log('\n=== La bola SIEMPRE muere (ningún vuelo atrapado) + sim 60s ===');
{
  const ORIG = { x: VP.w / 2, y: VP.h - 52 };
  function vuelo(t1x, t1y, t2x, t2y) {
    const t1 = targetEstatico(t1x, t1y), t2 = targetEstatico(t2x, t2y);
    const dx = t1x - ORIG.x, dy = t1y - ORIG.y, d = Math.hypot(dx, dy) || 1;
    const b = { x: ORIG.x, y: ORIG.y, vx: (dx / d) * VMAX, vy: (dy / d) * VMAX, edad: 0, viva: true, radio: 14 };
    const vivos = [t1, t2]; const tocados = new Set(); let toco1 = false, toco2 = false;
    for (let f = 0; f < 600 && b.viva; f++) {
      F.paso(b, 16.7, VP, function () {
        for (let k = 0; k < vivos.length; k++) {
          const tg = vivos[k]; if (!tg.viva) continue;
          const r = F.resolverImpacto(b, tg); if (!r) continue;
          if (!tocados.has(k)) { tocados.add(k); if (k === 0) toco1 = true; if (k === 1) toco2 = true; }
          if (r.muerto) tg.viva = false;
        }
      });
    }
    return { atrapado: b.viva, toco1: toco1, toco2: toco2 };
  }
  let atrap = 0, n1 = 0, n2 = 0; const N = 2000;
  for (let i = 0; i < N; i++) {
    const t1x = 80 + Math.random() * 230, t1y = 250 + Math.random() * 350;
    const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
    const t2x = t1x + Math.cos(ang) * dist, t2y = t1y + Math.sin(ang) * dist;
    if (t2x < 30 || t2x > 360 || t2y < 120 || t2y > 800) { i--; continue; }
    const v = vuelo(t1x, t1y, t2x, t2y);
    if (v.atrapado) atrap++;
    if (v.toco1) { n1++; if (v.toco2) n2++; }
  }
  console.log(`  sim ${N} vuelos: 1er target ${n1}, 2º alcanzado ${n2} (${(100 * n2 / n1).toFixed(1)}%), atrapados ${atrap}`);
  chk('ningún vuelo atrapado (todos mueren al salir / VIDA_MAX)', atrap === 0);
}

console.log(`\n== RESUMEN rebote: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
