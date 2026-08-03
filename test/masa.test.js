// hitclaud — FASE 23 commit A: hitball +10% de masa. node test/masa.test.js

const F = require('../js/fisica.js');
const fs = require('fs');
const fisicaSrc = fs.readFileSync(__dirname + '/../js/fisica.js', 'utf8');
const VP = { w: 390, h: 844 };
const VMAX = F.FISICA.VEL_SALIDA_MAX;

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function targetE(x, y) { const t = F.crearTarget(VP); t.x = x; t.y = y; t.vx = 0; t.vy = 0; t.rot = 0; t.haEntrado = true; t.viva = true; return t; }

console.log('=== MASA_HITBALL = 1.1 (antes 1 implícita → +10% EXACTO) ===');
{
  chk('MASA_HITBALL === 1.1', F.FISICA.MASA_HITBALL === 1.1);
  chk('+10% exacto respecto a 1 (1.1 / 1 = 1.10)', F.FISICA.MASA_HITBALL / 1 === 1.1);
  chk('usada en transferirMomento (const m = FISICA.MASA_HITBALL)', /const m = FISICA\.MASA_HITBALL;/.test(fisicaSrc));
  chk('usada en el rebote de destrucción (drag = t.masa / (FISICA.MASA_HITBALL + t.masa))', /const drag = t\.masa \/ \(FISICA\.MASA_HITBALL \+ t\.masa\);/.test(fisicaSrc));
  // Nada más cambió: gravedad, V_MAX, restitución 0.3, curva tanh intactas.
  chk('GRAVEDAD 0.0035, VEL_SALIDA_MAX 2.28, RESTITUCION_GOLPE 0.3, MULT_SUELTA 1.4 intactos', F.FISICA.GRAVEDAD === 0.0035 && F.FISICA.VEL_SALIDA_MAX === 2.28 && F.FISICA.RESTITUCION_GOLPE === 0.3 && F.FISICA.MULT_SUELTA === 1.4);
}

console.log('=== El impacto PESA: el rebote de destrucción cae con más masa ===');
{
  function reboteHeadOn(masa) {
    F.FISICA.MASA_HITBALL = masa;
    const t = targetE(195, 400);
    const b = { x: 195, y: 520, vx: 0, vy: -VMAX, edad: 0, viva: true, radio: 14 };
    let v = null;
    for (let f = 0; f < 40 && b.viva && v === null; f++) {
      F.paso(b, 16.7, VP, function () { if (v === null) { const r = F.resolverImpacto(b, t); if (r) v = Math.hypot(b.vx, b.vy); } });
    }
    return v;
  }
  const v10 = reboteHeadOn(1.0), v11 = reboteHeadOn(1.1);
  F.FISICA.MASA_HITBALL = 1.1;
  console.log(`  rebote head-on |v|: masa 1.0 = ${v10.toFixed(4)} → masa 1.1 = ${v11.toFixed(4)} px/ms (${((v11 / v10 - 1) * 100).toFixed(1)}%)`);
  chk('con más masa el rebote de destrucción es menor (pesa más)', v11 < v10);
}

console.log('=== Sin TÚNEL con la masa nueva (200 disparos a V_MAX que atraviesan) ===');
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
  chk(`0 fugas de ${N} con masa 1.1`, fugas === 0);
}

console.log('=== RE-SIMULACIÓN 60s (masa 1.0 vs 1.1) ===');
{
  const ORIG = { x: VP.w / 2, y: VP.h - 52 };
  function sim(masa, Nn) {
    F.FISICA.MASA_HITBALL = masa;
    let sumV = 0, n1 = 0, n2 = 0, atrap = 0;
    for (let i = 0; i < Nn; i++) {
      const t1x = 80 + Math.random() * 230, t1y = 250 + Math.random() * 350;
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 90;
      const t2x = t1x + Math.cos(ang) * dist, t2y = t1y + Math.sin(ang) * dist;
      if (t2x < 30 || t2x > 360 || t2y < 120 || t2y > 800) { i--; continue; }
      const t1 = targetE(t1x, t1y), t2 = targetE(t2x, t2y);
      const dx = t1x - ORIG.x, dy = t1y - ORIG.y, d = Math.hypot(dx, dy) || 1;
      const b = { x: ORIG.x, y: ORIG.y, vx: (dx / d) * VMAX, vy: (dy / d) * VMAX, edad: 0, viva: true, radio: 14 };
      const vivos = [t1, t2], toc = new Set(); let vP = null;
      for (let f = 0; f < 250 && b.viva; f++) {
        F.paso(b, 16.7, VP, function () { for (let k = 0; k < vivos.length; k++) { const tg = vivos[k]; if (!tg.viva) continue; const r = F.resolverImpacto(b, tg); if (!r) continue; if (!toc.has(k)) { toc.add(k); if (k === 0 && vP === null) vP = Math.hypot(b.vx, b.vy); if (k === 1) n2++; } if (r.muerto) tg.viva = false; } });
      }
      if (vP !== null) { n1++; sumV += vP; }
      if (b.viva) atrap++;
    }
    return { v: sumV / n1, n1: n1, n2: n2, atrap: atrap };
  }
  const N = 300, a = sim(1.0, N), d = sim(1.1, N);
  F.FISICA.MASA_HITBALL = 1.1;
  console.log(`  vel media tras 1er impacto: ${a.v.toFixed(4)} → ${d.v.toFixed(4)} px/ms (${((d.v / a.v - 1) * 100).toFixed(1)}%)`);
  console.log(`  alcanzan 2º target: ${a.n2} → ${d.n2}   ·   atrapados: ${a.atrap} → ${d.atrap}`);
  // (La dirección "pesa más → rebota menos" ya se probó de forma DETERMINISTA en el
  //  head-on de arriba. Este sim con Math.random es sólo reporte; su único invariante
  //  robusto es que ningún vuelo queda atrapado.)
  chk('ningún vuelo atrapado (mueren al salir / VIDA_MAX)', a.atrap === 0 && d.atrap === 0);
}

console.log(`\n== RESUMEN masa: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
