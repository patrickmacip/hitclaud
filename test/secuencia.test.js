// hitclaud — FASE 12 commit 2: máquina de estados del CloudOver.
// node test/secuencia.test.js
// impacto (0–400) → congelado/vaciado (400–1100) → cero (1100–1300) → overlay (≥1300).

const U = require('../js/util.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

const { IMPACTO, VACIADO, POST } = U.SEC;
const T_OVERLAY = IMPACTO + VACIADO + POST;

console.log('=== Tiempos declarados (impacto 400 · vaciado 700 · post 200 · overlay 1300) ===');
{
  chk('IMPACTO = 400', IMPACTO === 400);
  chk('VACIADO = 700', VACIADO === 700);
  chk('POST = 200', POST === 200);
  chk('overlay a 1300ms', T_OVERLAY === 1300);
}

console.log('\n=== La máquina recorre impacto → vaciado → cero → overlay en orden ===');
{
  const puntos = [
    [0, 'impacto'], [399, 'impacto'],
    [400, 'vaciado'], [1099, 'vaciado'],
    [1100, 'cero'], [1299, 'cero'],
    [1300, 'overlay'], [5000, 'overlay'],
  ];
  let bien = true;
  puntos.forEach(function (p) {
    const f = U.faseCloudover(p[0], false);
    if (f !== p[1]) { bien = false; console.log(`    ${p[0]}ms → ${f} (esperado ${p[1]})`); }
  });
  chk('cada instante cae en la fase correcta', bien);
  // Orden monótono de fases al avanzar el tiempo.
  const orden = ['impacto', 'vaciado', 'cero', 'overlay'];
  let prev = -1, mono = true;
  for (let t = 0; t <= 1400; t += 10) { const idx = orden.indexOf(U.faseCloudover(t, false)); if (idx < prev) mono = false; prev = idx; }
  chk('las fases sólo avanzan (nunca retroceden)', mono);
}

console.log('\n=== VACIADO: el contador baja de score a 0 y toca CERO EXACTO ===');
{
  const score = 12345;
  chk('antes del vaciado el contador = score', U.valorVaciado(score, IMPACTO) === score);
  chk('a mitad del vaciado el contador ya bajó bastante (easeOut)', U.valorVaciado(score, IMPACTO + VACIADO / 2) < score * 0.5);
  // Monótono no creciente durante el vaciado.
  let prev = Infinity, mono = true;
  for (let t = IMPACTO; t <= IMPACTO + VACIADO; t += 5) { const v = U.valorVaciado(score, t); if (v > prev) mono = false; prev = v; }
  chk('el contador nunca sube durante el vaciado', mono);
  chk('al final del vaciado = 0 EXACTO (sin residual)', U.valorVaciado(score, IMPACTO + VACIADO) === 0);
  chk('en fase cero = 0 EXACTO', U.valorVaciado(score, 1200) === 0 && U.valorVaciado(score, 1299) === 0);
  chk('easeOut: baja MÁS rápido al inicio que al final', (score - U.valorVaciado(score, IMPACTO + 100)) > (U.valorVaciado(score, IMPACTO + VACIADO - 100) - 0));
}

console.log('\n=== CONGELAMIENTO: durante vaciado/cero nada se mueve ni se registra tiro ===');
{
  // Driver espejo del bucle: en impacto el mundo corre; desde el congelamiento se
  // retorna ANTES de actualizar (como hace main.js: dibujar(); return;).
  const mundo = { targetX: 100, tiros: 0, overlay: false };
  function tick(elapsed, hayTiroEncolado) {
    const fase = U.faseCloudover(elapsed, false);
    if (fase === 'overlay') { mundo.overlay = true; return; }
    if (fase !== 'impacto') return; // CONGELADO: no toca el mundo
    // fase impacto: el mundo sigue vivo
    mundo.targetX += 5;
    if (hayTiroEncolado) mundo.tiros++;
  }
  tick(100, true); tick(300, true);            // impacto: 2 avances + 2 tiros
  const xTrasImpacto = mundo.targetX, tirosTrasImpacto = mundo.tiros;
  for (let t = 400; t < 1300; t += 50) tick(t, true); // congelado: intenta mover y tirar
  chk('el target NO se movió durante el congelamiento', mundo.targetX === xTrasImpacto);
  chk('ningún tiro se registró durante el congelamiento', mundo.tiros === tirosTrasImpacto);
  chk('durante impacto SÍ corrió (target avanzó, tiros contaron)', xTrasImpacto === 110 && tirosTrasImpacto === 2);
  tick(1300, false);
  chk('a los 1300ms entra el overlay', mundo.overlay === true);
}

console.log('\n=== ROBUSTEZ: una excepción a mitad del vaciado desemboca en el overlay ===');
{
  // Espejo del try/catch del bucle: si el paso del vaciado lanza, se llama saltarAlOverlay.
  let overlay = false, secuencia = { fase: 'impacto' };
  function paso(elapsed) {
    try {
      secuencia.fase = U.faseCloudover(elapsed, false);
      if (secuencia.fase === 'overlay') { overlay = true; secuencia = null; return; }
      if (secuencia.fase !== 'impacto') { throw new Error('fallo forzado a mitad del vaciado'); }
    } catch (e) { overlay = true; secuencia = null; } // saltarAlOverlay()
  }
  paso(200);  // impacto, sin fallo
  chk('en impacto no salta al overlay', overlay === false);
  paso(600);  // vaciado → lanza → overlay
  chk('excepción en vaciado → overlay inmediato', overlay === true && secuencia === null);
}

console.log('\n=== reduced-motion: secuencia inmediata (overlay directo, sin conteo) ===');
{
  chk('faseCloudover(_, true) = overlay a los 0ms', U.faseCloudover(0, true) === 'overlay');
  chk('faseCloudover(_, true) = overlay siempre', U.faseCloudover(9999, true) === 'overlay' && U.faseCloudover(200, true) === 'overlay');
}

console.log('\n=== Integración en main.js (grep): estado nuevo, guards, sin pausa reusada ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  chk('estado NUEVO `secuencia` (no reutiliza `pausado`)', /let secuencia = null;/.test(main));
  chk('freeze NO usa la pausa (secuencia y pausado son distintos)', /if \(pausado \|\| !jugando\)/.test(main) && /if \(secuencia\) \{/.test(main));
  chk('reloj gateado durante la secuencia', /DURACIONES\[modoJuego\] && !secuencia/.test(main));
  chk('input pointerdown ignora la secuencia', /if \(secuencia\) return; \/\/ durante la secuencia/.test(main));
  chk('hitscan ignora la secuencia', /if \(pausado \|\| !jugando \|\| secuencia\) return;/.test(main));
  chk('salir bloqueado durante la secuencia (no interrumpe la caída del CloudOver)', /botonSalir\.addEventListener\([\s\S]{0,140}if \(secuencia\) return;/.test(main));
  chk('CloudOver dispara golpeCloudover (no termina directo)', /golpeCloudover\(tg, /.test(main) && !/tg\.rojo\) \{ terminarPartida/.test(main));
  chk('explosión de cubos con color de identidad (cloudoverB)', /explotarCubos\(centros, px, py, [\d.]+, tg\.vx, tg\.vy, COLOR\.cloudoverB\)/.test(main));
  chk('robustez: catch del cuadro salta al overlay', /catch \(e\) \{ saltarAlOverlay\(\); dibujar\(\); return; \}/.test(main));
  chk('palpitar de bordes en vaciado (#FF0055, 28px = FRANJA_PX)', /secuencia\.fase === 'vaciado' \|\| secuencia\.fase === 'cero'[\s\S]*?FRANJA_PX/.test(main));
  chk('contador Actual en rojo #FF4583 (ROJO_CONTADOR) durante el vaciado', /enVaciado[\s\S]*?ROJO_CONTADOR/.test(main));
  // NO aparece el monto pequeño: no se llama registrarPerdida en la secuencia.
  chk('no dispara el monto pequeño en la secuencia (sin registrarPerdida)', !/golpeCloudover[\s\S]{0,400}registrarPerdida/.test(main));
  chk('reduced-motion consultado en vivo', /prefers-reduced-motion: reduce/.test(main));
}

console.log(`\n== RESUMEN secuencia: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
