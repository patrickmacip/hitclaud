// hitclaud — escalada de ROJOS (sube de nivel cada 5–10s, sin tope):
// node test/escalada.test.js

const P = require('../js/puntuacion.js');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

console.log('=== El primer escalón cae dentro de 5–10s ===');
{
  const e0 = P.crearEscalada(0, function () { return 0; });   // rnd=0 → mínimo
  const e1 = P.crearEscalada(0, function () { return 1; });   // rnd=1 → máximo (clamp <1 real, borde)
  chk(`mínimo ${e0.proximo}ms ≥ 5000`, e0.proximo >= 5000);
  chk(`máximo ${e1.proximo}ms ≤ 10000`, e1.proximo <= 10000);
  chk('nivel inicial = 1', e0.nivel === 1 && e1.nivel === 1);
}

console.log('\n=== pasoEscalada SOLO incrementa, cada escalón dentro de 5–10s ===');
{
  let rndVals = [0.0, 0.5, 1.0, 0.25, 0.75], k = 0;
  const rnd = function () { return rndVals[(k++) % rndVals.length]; };
  let e = P.crearEscalada(0, rnd);
  let bien = true, subidas = 0, tanterior = 0;
  for (let s = 0; s < 20; s++) {
    const t = e.proximo;                 // avanzamos justo al escalón
    const nivelAntes = e.nivel;
    const proxAntes = e.proximo;
    const subio = P.pasoEscalada(e, t, rnd);
    if (subio) {
      subidas++;
      const dt = e.proximo - t;
      if (dt < 5000 || dt > 10000) bien = false;   // cada escalón 5–10s
      if (e.nivel !== nivelAntes + 1) bien = false; // sólo +1
    }
    tanterior = proxAntes;
  }
  chk(`subió ${subidas} veces, sólo incrementos de +1`, bien && subidas === 20);
  chk('nunca baja de nivel (sin tope)', e.nivel === 1 + subidas);
}

console.log('\n=== ANTES del escalón NO sube ===');
{
  const e = P.crearEscalada(0, function () { return 0.5 * 1e-9 + 0.5; });
  const subio = P.pasoEscalada(e, e.proximo - 1, function () { return 0.5; });
  chk('now < proximo → no incrementa', subio === false && e.nivel === 1);
}

console.log('\n=== intervaloRojo decrece con el nivel (más rojos, más seguido) con piso ===');
{
  const i1 = P.intervaloRojo(1), i2 = P.intervaloRojo(2), i5 = P.intervaloRojo(5), i100 = P.intervaloRojo(100);
  console.log(`  n1 ${i1}ms · n2 ${i2}ms · n5 ${i5}ms · n100 ${i100}ms`);
  chk('monótono decreciente (nivel↑ → intervalo↓)', i1 > i2 && i2 > i5 && i5 >= i100);
  chk('piso respetado (no baja de 700ms)', i100 >= 700);
}
