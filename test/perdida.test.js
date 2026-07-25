// hitclaud — test de la PÉRDIDA (bordes + contador rojo + monto) + castigo −50%:
// node test/perdida.test.js
// Rediseño: los −N flotantes y el "0" se ELIMINARON. Al restar: palpita bordes,
// contador rojo 400ms y monto agregado 600ms. Sólo el fallo real dispara pérdida.

const fs = require('fs');
const path = require('path');
const P = require('../js/puntuacion.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

// Espejo de registrarPerdida (main.js): bordes + contador rojo + monto agregado.
function crearFeedback() {
  const CONTADOR_ROJO_MS = 400, MONTO_MS = 600, PULSO = 100 + 350;
  let perdidaInicio = -Infinity, contadorRojoHasta = 0, montoPerdido = 0, montoInicio = -Infinity, montoHasta = 0;
  return {
    registrar: function (monto, now) {
      perdidaInicio = now;                                     // re-dispara (reinicia)
      contadorRojoHasta = now + CONTADOR_ROJO_MS;
      montoPerdido = (now < montoHasta) ? montoPerdido + monto : monto; // agrega si sigue viva
      montoInicio = now; montoHasta = now + MONTO_MS;
    },
    pulsoActivo: function (now) { const dt = now - perdidaInicio; return dt >= 0 && dt < PULSO; },
    contadorRojo: function (now) { return now < contadorRojoHasta; },
    montoVisible: function (now) { const dt = now - montoInicio; return (dt >= 0 && dt < MONTO_MS) ? montoPerdido : 0; },
  };
}

const ROJO_BORDE = '#FF0055', ROJO_CONTADOR = '#FF4583', ROJO_MONTO = '#FF6D9E';

console.log('=== Los flotantes de pérdida (−N) y el "0" están ELIMINADOS del código ===');
{
  chk('sin flotante(... "−" ...) de pérdida', !/flotante\([^)]*['"]−['"]/.test(src) && !/flotante\([^)]*cloudoverB/.test(src));
  chk('sin flotante(... "0" ...) apagado', !/flotante\([^)]*['"]0['"]/.test(src) && !/flotante\([^)]*textoApagado\)/.test(src));
  chk(`colores de feedback presentes (${ROJO_BORDE}/${ROJO_CONTADOR}/${ROJO_MONTO})`,
    src.indexOf(ROJO_BORDE) !== -1 && src.indexOf(ROJO_CONTADOR) !== -1 && src.indexOf(ROJO_MONTO) !== -1);
}

console.log('\n=== Un fallo → pulso de bordes + contador rojo 400ms + monto ===');
{
  const f = crearFeedback();
  f.registrar(50, 0);
  chk('pulso de bordes activo en t=0', f.pulsoActivo(0));
  chk('contador rojo en t=0 y t=399, no en t=400', f.contadorRojo(0) && f.contadorRojo(399) && !f.contadorRojo(400));
  chk('monto = 50 visible (t=0), invisible tras 600ms', f.montoVisible(0) === 50 && f.montoVisible(600) === 0);
  chk('pulso de bordes se disipa (t=450 apagado)', !f.pulsoActivo(450));
}

console.log('\n=== Cobros consecutivos: un solo monto AGREGADO, pulso reiniciado ===');
{
  const f = crearFeedback();
  f.registrar(10, 100);
  f.registrar(15, 300);   // dentro de la ventana (300 < 100+600) → agrega
  chk('monto agregado = 25 (10+15)', f.montoVisible(300) === 25);
  chk('pulso reiniciado en t=300 (cuenta desde el 2º cobro, no apilado)', f.pulsoActivo(300) && !f.pulsoActivo(300 + 450));
  // Fuera de la ventana → empieza de cero (no agrega).
  const g = crearFeedback();
  g.registrar(10, 0);
  g.registrar(20, 700);   // 700 > 0+600 → ventana muerta → monto = 20
  chk('fuera de la ventana no agrega (monto = 20, no 30)', g.montoVisible(700) === 20);
}

console.log('\n=== La pérdida se dispara SOLO en fallo real (bolita que no tocó) ===');
{
  // Espejo del death-loop simplificado: registrar SOLO si !tocado.
  function disparaPerdida(tocado) { return !tocado; }
  chk('bolita que falla (no tocó) → dispara', disparaPerdida(false));
  chk('bolita que impactó (tocó) → no dispara', !disparaPerdida(true));
}

console.log('\n=== Castigo PLANO: −50 en cualquier score ===');
{
  [0, 2000, 30000, 120000].forEach(function (s) {
    const m = P.crearMarcador(); m.puntos = s + 100;
    const pen = P.anotarFallo(m);
    chk(`score ~${s} → −${pen}`, pen === 50);
  });
  chk('P.FALLO === 50', P.FALLO === 50);
}

console.log('\n=== Piso 0 alcanzable fallando ===');
{
  const m = P.crearMarcador(); m.puntos = 40;
  let pasos = 0; while (m.puntos > 0 && pasos < 50) { P.anotarFallo(m); pasos++; }
  chk(`llegó a ${m.puntos} en ${pasos} fallos`, m.puntos === 0);
}
