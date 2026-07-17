// hitclaud — test de fisica.js en node: node test/fisica.test.js
// Mundo LATERAL con gravedad. Simula 4 gestos e imprime ápice, tiempo a
// ápice y punto de salida del viewport (390×844).

const F = require('../js/fisica.js');

const VIEWPORT = { w: 390, h: 844 };
const ORIGEN = { x: 338, y: 792 }; // reposo en el hitmaker (esquina inf-der)

function gestoRecto(x0, y0, x1, y1, durMs, n) {
  const puntos = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    puntos.push({ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, t: k * durMs });
  }
  return puntos;
}

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
  const b = { x: ORIGEN.x, y: ORIGEN.y, vx: d.vx, vy: d.vy, spin: d.spin, edad: 0, viva: true };
  let apiceY = b.y;
  let tApice = 0;
  let t = 0;
  const DT = 5;
  while (b.viva && t < 7000) {
    F.paso(b, DT, VIEWPORT);
    t += DT;
    if (b.y < apiceY) { apiceY = b.y; tApice = t; }
  }
  const subida = Math.round(ORIGEN.y - apiceY);
  console.log(
    `\n${nombre}\n  potencia=${d.potencia.toFixed(2)} |v0|=${Math.hypot(d.vx, d.vy).toFixed(2)} spin=${d.spin.toFixed(2)}\n` +
    `  ápice: subió ${subida}px (y=${Math.round(apiceY)}) en ${tApice}ms\n` +
    `  salida: (${Math.round(b.x)},${Math.round(b.y)}) a los ${t}ms  [edad ${Math.round(b.edad)}ms]`
  );
}

simular('a. Flick corto y RÁPIDO (arriba-izq, 134px/50ms)', gestoRecto(360, 810, 300, 690, 50, 8));
simular('b. Largo y LENTO (424px/900ms) → arco corto', gestoRecto(360, 810, 60, 510, 900, 40));
simular('c. Largo y RÁPIDO (424px/180ms) → arco alto', gestoRecto(360, 810, 60, 510, 180, 20));
simular('d. Curvo (arco 90°, radio 150, 300ms) → chanfle', gestoCurvo(200, 800, 150, 0, -Math.PI / 2, 300, 30));
