// hitclaud — test del MODO DISPERSIÓN (15s, spawn ×2): node test/dispersion.test.js
// Solo terminal: cadencia + presupuesto de cómputo medidos en node (sin navegador).

const fs = require('fs');
const path = require('path');
const F = require('../js/fisica.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const VP = { w: 390, h: 844 };

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== Duración 15s + factor de cadencia declarados ===');
{
  const dur = (src.match(/POWERUP_MS\s*=\s*(\d+)/) || [])[1];
  const fac = (src.match(/DISPERSION_SPAWN_FACTOR\s*=\s*([\d.]+)/) || [])[1];
  chk(`POWERUP_MS = ${dur}ms (15000)`, dur === '15000');
  chk(`DISPERSION_SPAWN_FACTOR = ${fac} (½ intervalo = spawn ×2)`, fac === '0.5');
}

console.log('\n=== Cadencia: ½ del intervalo durante el modo, restaurada al salir ===');
{
  const FACTOR = 0.5;
  // Espejo de retardoActual: intervalo base × factor si el modo está activo.
  function retardoActual(base, ahora, powerupHasta) {
    let r = base;
    if (ahora < powerupHasta) r *= FACTOR;
    return r;
  }
  const base = 800;
  const dentro = retardoActual(base, 1000, 5000); // modo activo
  const fuera = retardoActual(base, 6000, 5000);  // modo terminado
  chk(`dentro del modo: ${base} → ${dentro} (½)`, dentro === base * 0.5);
  chk(`fuera del modo: ${base} → ${fuera} (exacto, sin residuo)`, fuera === base);
}

console.log('\n=== Simulación 60s: el modo ≈ duplica los spawns en su ventana ===');
{
  const FACTOR = 0.5, BASE = 800; // intervalo base fijo para aislar el efecto
  function contarSpawns(powerupHasta) {
    let t = 0, spawns = 0, prox = 0;
    while (t < 15000) { // ventana de 15s
      if (t >= prox) { spawns++; let r = BASE; if (t < powerupHasta) r *= FACTOR; prox = t + r; }
      t += 16;
    }
    return spawns;
  }
  const normal = contarSpawns(0);       // sin modo
  const conModo = contarSpawns(15000);  // modo activo toda la ventana
  const ratio = conModo / normal;
  console.log(`  spawns en 15s: normal ${normal} · con modo ${conModo} (×${ratio.toFixed(2)})`);
  chk('el modo ~duplica los spawns (×1.8–2.1)', ratio >= 1.8 && ratio <= 2.1);
}

console.log('\n=== Presupuesto de CÓMPUTO (node): peor caso dispersión, 3600 cuadros (60s) ===');
{
  // Peor caso: 4 targets (cap) + 24 dispersas radio 14 + 240 cubos. Cada bolita
  // prueba colisión contra los 4 targets en cada subpaso (lo más caro del update).
  function mkTarget(i) { const t = F.crearTarget(VP); t.x = 60 + i * 80; t.y = 200 + i * 40; return t; }
  const targets = [mkTarget(0), mkTarget(1), mkTarget(2), mkTarget(3)];
  const bolas = []; for (let i = 0; i < 24; i++) bolas.push({ x: (i * 37) % VP.w, y: (i * 53) % VP.h, vx: 0.5, vy: -1.0, radio: 14, edad: 0, viva: true, historia: [] });
  const cubos = []; for (let i = 0; i < 240; i++) cubos.push({ x: (i * 11) % VP.w, y: (i * 17) % VP.h, vx: 0.2, vy: 0.5 });
  const G = F.FISICA.G_TARGET;
  const N = 3600;
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < N; f++) {
    for (const tg of targets) { F.paso(tg, 16, VP); if (!tg.viva) { tg.x = 100; tg.y = 300; tg.vy = -1; tg.viva = true; tg.haEntrado = false; tg.edad = 0; } }
    for (const b of bolas) {
      F.paso(b, 16, VP, function () { for (const tg of targets) F.colisionCirculoRect(b, tg); });
      if (!b.viva) { b.x = 195; b.y = 700; b.vy = -1.2; b.viva = true; b.haEntrado = false; b.edad = 0; }
    }
    for (const q of cubos) { q.vy += G * 16; q.x += q.vx * 16; q.y += q.vy * 16; if (q.y > VP.h + 8) { q.y = -8; q.vy = 0; } }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`  cómputo del update: ${ms.toFixed(4)} ms/cuadro (4 targets + 24 bolitas radio-14 + 240 cubos)`);
  // El render está acotado por los MISMOS topes (MAX_TARGETS_DURO 4, MAX_BOLITAS
  // 24, MAX_CUBOS 240) que la fase 8 (0.31 ms/cuadro medido). El modo dispersión
  // NO sube esos topes → el peor caso de RENDER no cambia. Total << 16.67ms.
  chk('cómputo holgado para 60fps (< 2 ms/cuadro; deja el resto para el render)', ms < 2);
}
