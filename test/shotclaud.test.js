// hitclaud — ShotClaud, puntuación PURA (js/shotclaud.js): centro/lateral/caído/fallo,
// racha positiva (×1..×5) y negativa (castigo escalado, tope ×5), zona central = cuarto
// central del target, marcador ≥ 0, sin carambola. node test/shotclaud.test.js
// Cubre los doce casos de V3.

const S = require('../js/shotclaud.js');
const P = require('../js/puntuacion.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== 1. Centro de target entero: 200, sube la racha positiva ===');
{
  const m = S.crearMarcador();
  const r = S.anotarCentro(m);
  chk('primer centro = 200 (×1)', r.ganancia === 200 && r.mult === 1 && m.puntos === 200);
  chk('la racha positiva sube a 1', m.rachaPos === 1);
}

console.log('=== 2. Fuera del centro: 50 sin multiplicar, NO destruye, rompe la racha positiva ===');
{
  const m = S.crearMarcador();
  S.anotarCentro(m); S.anotarCentro(m);       // racha positiva = 2
  const r = S.anotarLateral(m);
  chk('lateral = 50 fijo (sin multiplicador)', r.ganancia === 50);
  chk('rompe la racha positiva (vuelve a 0)', m.rachaPos === 0);
}

console.log('=== 3. Target caído: 50 SIEMPRE, no toca ninguna racha ===');
{
  const m = S.crearMarcador();
  S.anotarCentro(m);                          // racha positiva = 1
  const rpAntes = m.rachaPos, rnAntes = m.rachaNeg;
  const r = S.anotarCaido(m);
  chk('caído = 50', r.ganancia === 50);
  chk('no cambia la racha positiva ni la negativa', m.rachaPos === rpAntes && m.rachaNeg === rnAntes);
}

console.log('=== 4. Fallo: resta y rompe la racha positiva ===');
{
  const m = S.crearMarcador(); m.puntos = 500;
  S.anotarCentro(m);                          // racha positiva = 1 (y suma)
  const r = S.anotarFallo(m);
  chk('resta el castigo base (50)', r.castigo === 50 && m.puntos === 500 + 200 - 50);
  chk('rompe la racha positiva', m.rachaPos === 0);
}

console.log('=== 5. Racha positiva: tope en ×5 ===');
{
  const m = S.crearMarcador();
  const mult = [];
  for (let i = 0; i < 7; i++) mult.push(S.anotarCentro(m).mult);
  chk('progresión 1,2,3,4,5,5,5 (tope ×5)', mult.join(',') === '1,2,3,4,5,5,5');
  chk('multRachaPos nunca pasa de 5', S.multRachaPos(99) === 5 && S.RACHA_POS_TOPE === 5);
}

console.log('=== 6. Fallos 1 y 2: −50 cada uno ===');
{
  const m = S.crearMarcador(); m.puntos = 1000;
  const a = S.anotarFallo(m), b = S.anotarFallo(m);
  chk('fallo 1 = −50', a.castigo === 50 && a.mult === 1);
  chk('fallo 2 = −50', b.castigo === 50 && b.mult === 1);
}

console.log('=== 7. Tercer fallo en adelante: multiplica con tope ×5 (peor caso −250) ===');
{
  const m = S.crearMarcador(); m.puntos = 100000;
  const pen = [];
  for (let i = 0; i < 7; i++) pen.push(S.anotarFallo(m).castigo);
  chk('penas 50,50,100,150,200,250,250', pen.join(',') === '50,50,100,150,200,250,250');
  chk('peor caso −250 (tope ×5)', Math.max.apply(null, pen) === 250 && S.RACHA_NEG_TOPE === 5);
}

console.log('=== 8. Un acierto al CENTRO corta la racha negativa ===');
{
  const m = S.crearMarcador(); m.puntos = 1000;
  S.anotarFallo(m); S.anotarFallo(m); S.anotarFallo(m); // racha negativa = 3
  chk('la racha negativa venía en 3', m.rachaNeg === 3);
  S.anotarCentro(m);
  chk('el centro la corta a 0', m.rachaNeg === 0);
}

console.log('=== 9. Fuera del centro / caído NO cortan la racha negativa ===');
{
  const m = S.crearMarcador(); m.puntos = 1000;
  S.anotarFallo(m); S.anotarFallo(m);         // racha negativa = 2
  S.anotarLateral(m);
  chk('lateral no corta la racha negativa', m.rachaNeg === 2);
  S.anotarCaido(m);
  chk('caído tampoco la corta', m.rachaNeg === 2);
  const r = S.anotarFallo(m);                 // sigue siendo el 3.er fallo → ×2
  chk('el fallo que sigue escala (×2 = −100)', r.castigo === 100 && r.mult === 2);
}

console.log('=== 10. El marcador nunca baja de cero ===');
{
  const m = S.crearMarcador(); m.puntos = 30;
  S.anotarFallo(m);
  chk('30 − 50 → 0 (no negativo)', m.puntos === 0);
  const z = S.crearMarcador(); // ya en 0
  for (let i = 0; i < 10; i++) S.anotarFallo(z);
  chk('diez fallos desde 0 → sigue en 0', z.puntos === 0);
}

console.log('=== 11. Zona central = cuarto central del target COMPLETO (½ ancho × ½ alto) ===');
{
  // Target completo 5×4 en (100,100): medio-eje 20×16 → centro llega a 10×8.
  const t = { x: 100, y: 100, rot: 0, cols: 5, filas: 4 };
  chk('el centro exacto está en la zona', S.enZonaCentral(t, 100, 100) === true);
  chk('borde del cuarto central (x=110, y=108) dentro', S.enZonaCentral(t, 110, 108) === true);
  chk('un pelo afuera (x=111) fuera', S.enZonaCentral(t, 111, 100) === false);
  chk('sobre el target pero fuera del centro (x=118) fuera', S.enZonaCentral(t, 118, 100) === false);
  chk('la fracción documentada es 0.5 (cuarto central)', S.ZONA_CENTRAL_FRAC === 0.5);
  // Se mide sobre el target COMPLETO: no depende de celdas vivas (no hay tal campo aquí).
  chk('respeta la rotación (target girado 90°: ejes intercambiados)', (function () {
    const g = { x: 0, y: 0, rot: Math.PI / 2, cols: 5, filas: 4 }; // girado: X usa filas(±8), Y usa cols(±10)
    return S.enZonaCentral(g, 0, 10) === true && S.enZonaCentral(g, 9, 0) === false;
  })());
}

console.log('=== 12. No existe carambola en ShotClaud ===');
{
  const src = require('fs').readFileSync(__dirname + '/../js/shotclaud.js', 'utf8');
  // Sin LÓGICA de carambola (no como identificador de código: llamada, asignación o propiedad).
  chk('shotclaud.js no tiene lógica de carambola', !/[Cc]arambola\s*[\(=:]/.test(src));
  chk('el módulo no exporta nada de carambola', typeof S.anotarCarambola === 'undefined' && typeof S.bonoCarambola === 'undefined');
  // Reutiliza la unidad base de HitClaud (P.FALLO = 50) en vez de duplicar el 50.
  chk('reutiliza P.FALLO como unidad base (50)', S.UNIDAD === P.FALLO && S.VALOR_LATERAL === P.FALLO);
}

console.log(`\n== RESUMEN shotclaud: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
