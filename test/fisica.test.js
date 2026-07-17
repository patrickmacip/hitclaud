// hitclaud — test de fisica.js en node: node test/fisica.test.js
// Simula 4 gestos y resume trayectorias (posición cada 100 ms).

const F = require('../js/fisica.js');

const VIEWPORT = { w: 390, h: 844 };

// Gesto recto: n puntos repartidos uniformemente en espacio y tiempo.
function gestoRecto(x0, y0, x1, y1, durMs, n) {
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    puntos.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, t: k * durMs });
  }
  return puntos;
}

// Gesto curvo: arco de circunferencia (curvatura sostenida hasta el final).
function gestoCurvo(cx, cy, radio, angulo0, angulo1, durMs, n) {
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = angulo0 + (angulo1 - angulo0) * k;
    puntos.push({ x: cx + radio * Math.cos(a), y: cy + radio * Math.sin(a), t: k * durMs });
  }
  return puntos;
}

function simular(nombre, puntos) {
  const d = F.crearDisparo(puntos, VIEWPORT.h);
  if (!d) {
    console.log(`\n${nombre}: sin disparo`);
    return;
  }
  const bolita = { x: 350, y: 800, vx: d.vx, vy: d.vy, spin: d.spin, rebotes: 0 };
  console.log(
    `\n${nombre}\n  potencia=${d.potencia.toFixed(2)} |v|=${Math.hypot(d.vx, d.vy).toFixed(2)} px/ms spin=${d.spin.toFixed(2)}`
  );
  const linea = [];
  for (let t = 0; t <= 1200 && bolita.rebotes < 2; t += 100) {
    linea.push(`t=${t} (${Math.round(bolita.x)},${Math.round(bolita.y)})`);
    for (let s = 0; s < 100 && bolita.rebotes < 2; s += 10) {
      F.paso(bolita, 10, VIEWPORT);
    }
  }
  console.log('  ' + linea.join(' → '));
  console.log(`  rebotes al terminar: ${bolita.rebotes}`);
}

simular('1. Flick corto y RÁPIDO (134 px en 50 ms)', gestoRecto(360, 810, 300, 690, 50, 8));
simular('2. Arrastre largo y LENTO (424 px en 900 ms)', gestoRecto(360, 810, 60, 510, 900, 40));
simular('3. Largo y RÁPIDO (424 px en 180 ms)', gestoRecto(360, 810, 60, 510, 180, 20));
simular('4. Curvo (arco 90°, radio 150, 300 ms)', gestoCurvo(200, 800, 150, 0, -Math.PI / 2, 300, 30));
