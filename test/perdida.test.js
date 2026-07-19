// hitclaud — test de la PÉRDIDA (color rojo) + castigo −50%: node test/perdida.test.js
// La pérdida se ve ROJA (#FF0055, el rojo claro del CloudOver). El "0" de una
// dispersa sin impacto NO es pérdida → texto apagado. Castigo a la mitad con
// ratio ganancia/castigo constante (0.20). Amortiguador y piso 0 coherentes.

const P = require('../js/puntuacion.js');

const ROJO = '#FF0055';       // --cloudover-b: todo lo que RESTA
const APAGADO = '#8989B1';    // --texto-apagado: el "0" sin costo

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

// Espejo de main.js: color del flotante según el evento.
function colorFlotante(evento) {
  if (evento === 'fallo') return ROJO;         // −N
  if (evento === 'inactividad') return ROJO;   // −N
  if (evento === 'dispersa-sin-impacto') return APAGADO; // "0"
  return 'acento'; // ganancia → color del modo (baño)
}

console.log('=== Color de la pérdida (rojo) vs. el "0" sin costo (apagado) ===');
chk(`fallo → ${ROJO}`, colorFlotante('fallo') === ROJO);
chk(`inactividad → ${ROJO}`, colorFlotante('inactividad') === ROJO);
chk(`dispersa sin impacto → "0" ${APAGADO} (NO rojo: no cuesta)`, colorFlotante('dispersa-sin-impacto') === APAGADO);

console.log('\n=== Tabla de castigo a la mitad (−50%) ===');
{
  // Valores previos: 50/100/250/500/1000/2000. Ahora la mitad.
  const esperado = [[0, 25], [2000, 50], [10000, 125], [25000, 250], [50000, 500], [100000, 1000]];
  esperado.forEach(function (e) {
    const p = P.penalTramo(e[0]);
    chk(`tramo ${e[0]} → castigo ${p} (era ${e[1] * 2})`, p === e[1]);
  });
}

console.log('\n=== Ratio ganancia/castigo = 0.20 CONSTANTE entre tramos ===');
{
  // ratio = valorCubo(score) / penalBase(score). Debe ser 0.20 en todo el rango.
  let constante = true;
  [0, 1000, 2000, 8000, 15000, 30000, 60000, 120000].forEach(function (s) {
    const ratio = P.valorCubo(s) / P.penalBase(s);
    const ok = Math.abs(ratio - 0.20) < 1e-9;
    if (!ok) constante = false;
    console.log(`  score ${s}: ratio ${ratio.toFixed(3)}  ${ok ? 'OK ✓' : 'NO ✗'}`);
  });
  chk('ratio 0.20 constante en todos los tramos', constante);
}

console.log('\n=== Amortiguador y piso 0 coherentes con el castigo halved ===');
{
  // Piso 0 SIEMPRE alcanzable: fallar desde un score bajo llega a 0.
  const m = P.crearMarcador(); m.puntos = 40; m.pico = 40;
  let pasos = 0; while (m.puntos > 0 && pasos < 50) { P.anotarFallo(m); pasos++; }
  chk(`piso 0 alcanzable fallando (llegó a ${m.puntos} en ${pasos} fallos)`, m.puntos === 0);

  // Amortiguador: bajo el suelo (60% del pico) el castigo se atenúa hacia AMORT_MIN.
  const cerca = P.amortiguar(600, 1000);  // score 600, pico 1000 → suelo 600 (en el suelo → ×1)
  const hondo = P.amortiguar(0, 1000);    // en 0 → AMORT_MIN
  chk(`amortiguar en el suelo = 1 (${cerca.toFixed(2)})`, Math.abs(cerca - 1) < 1e-9);
  chk(`amortiguar en 0 = AMORT_MIN ${P.AMORT_MIN} (${hondo.toFixed(2)})`, Math.abs(hondo - P.AMORT_MIN) < 1e-9);
}
