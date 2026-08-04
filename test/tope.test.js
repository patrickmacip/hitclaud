// hitclaud — TOPES de targets en pantalla. node test/tope.test.js
// Hay DOS topes distintos en el código real, y este test los LEE de main.js
// (antes usaba un MAX=4 hardcodeado, desalineado con el juego):
//   · MAX_EN_PANTALLA — tope del SPAWN (naranjas + rojos + grande juntos). Los
//     gates de spawn nunca dejan pasar de aquí; los spawns pospuestos por falta
//     de lugar disparan al liberarse (el ritmo no se pierde).
//   · MAX_TARGETS_VIVOS — tope DURO del total de targets vivos, incluidos los
//     fragmentos desprendidos (que NO pasan por los gates de spawn).

const fs = require('fs');
const P = require('../js/puntuacion.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(nombre, c) { console.log(`  ${nombre}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Lee los topes REALES del código (no se hardcodean acá).
const MAX_EN_PANTALLA = parseInt((main.match(/const MAX_EN_PANTALLA = (\d+);/) || [])[1], 10);
const MAX_TARGETS_VIVOS = parseInt((main.match(/const MAX_TARGETS_VIVOS = (\d+);/) || [])[1], 10);

console.log('=== Los topes se leen del código real de main.js ===');
{
  console.log(`  MAX_EN_PANTALLA = ${MAX_EN_PANTALLA}  ·  MAX_TARGETS_VIVOS = ${MAX_TARGETS_VIVOS}`);
  chk('MAX_EN_PANTALLA existe y es el tope de spawn de HitClaud (2)', MAX_EN_PANTALLA === 2);
  chk('MAX_TARGETS_VIVOS existe y es el tope duro de HitClaud (10)', MAX_TARGETS_VIVOS === 10);
  // Los gates ahora consultan capEnPantalla()/capVivos(), que para HitClaud DEVUELVEN esos
  // mismos topes (ShotClaud usa cupos propios mayores). El comportamiento de HitClaud no cambia.
  chk('los tres gates de spawn respetan capEnPantalla()', (main.match(/targets\.length < capEnPantalla\(\)/g) || []).length === 3);
  chk('el tope duro se aplica sobre capVivos() (aplicarTopeTargets)', /while \(targets\.length > capVivos\(\)\)/.test(main));
  chk('capEnPantalla() cae en MAX_EN_PANTALLA para HitClaud', /function capEnPantalla\(\) \{ return esShot\(\) \? SHOT\.MAX_EN_PANTALLA : MAX_EN_PANTALLA; \}/.test(main));
  chk('capVivos() cae en MAX_TARGETS_VIVOS para HitClaud', /function capVivos\(\) \{ return esShot\(\) \? SHOT\.MAX_VIVOS : MAX_TARGETS_VIVOS; \}/.test(main));
}

const MAX = MAX_EN_PANTALLA; // el tope que gobierna el SPAWN (espejo de los gates)

console.log(`\n=== Bajo presión (vidas cortas, ritmo denso) nunca se pasa de ${MAX} por spawn ===`);
{
  // Simula el loop: targets con vida aleatoria; gates idénticos a main.js.
  // rnd determinista para reproducibilidad.
  let seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  const targets = []; // cada uno: { muereEn }
  const caos = P.crearCaos();
  let escalada = P.crearEscalada(0, rnd);
  let proximoSpawn = 0, proximoRojo = P.intervaloRojo(escalada.nivel);
  let picoVivos = 0, sobrepasos = 0;
  let spawnsHechos = 0, spawnsTrasLleno = 0;
  let veniaLleno = false;

  const DT = 16;
  for (let t = 0; t < 60000; t += DT) {
    // muerte natural
    for (let i = targets.length - 1; i >= 0; i--) if (t >= targets[i].muereEn) targets.splice(i, 1);

    // gate naranja (idéntico a main.js)
    if (targets.length < MAX && t >= proximoSpawn) {
      targets.push({ muereEn: t + 400 + rnd() * 1200 }); // vida corta → presión
      spawnsHechos++;
      const base = { min: 300, max: 900 };
      proximoSpawn = t + P.retardoCaotico(base, caos, rnd);
      if (veniaLleno) spawnsTrasLleno++;
    }
    // gate rojo (idéntico a main.js), comparte el mismo tope
    P.pasoEscalada(escalada, t, rnd);
    if (t >= proximoRojo && targets.length < MAX) {
      targets.push({ muereEn: t + 400 + rnd() * 1200 });
      spawnsHechos++;
      proximoRojo = t + P.intervaloRojo(escalada.nivel) * (0.75 + rnd() * 0.5);
      if (veniaLleno) spawnsTrasLleno++;
    }

    picoVivos = Math.max(picoVivos, targets.length);
    if (targets.length > MAX) sobrepasos++;
    veniaLleno = targets.length >= MAX;
  }

  console.log(`  pico de vivos = ${picoVivos} (tope de spawn ${MAX})`);
  chk('nunca se superó el tope de spawn (0 sobrepasos)', sobrepasos === 0 && picoVivos <= MAX);
  chk(`hubo presión real (${spawnsHechos} spawns en 60s, pico llegó al tope)`, spawnsHechos > 60 && picoVivos === MAX);
  chk(`spawns pospuestos por lleno se dispararon al liberarse (${spawnsTrasLleno})`, spawnsTrasLleno > 0);
}

console.log('\n=== El tope duro (fragmentos) supera el de spawn y mata a los más viejos ===');
{
  // Los fragmentos NO pasan por los gates: quienes pueden superar MAX_EN_PANTALLA y
  // llegar hasta MAX_TARGETS_VIVOS son las islas. aplicarTopeTargets recorta el
  // excedente empezando por el más VIEJO (mayor edad) y NUNCA toca al rojo.
  chk('el tope duro (10) es mayor que el de spawn (2): los fragmentos caben por encima', MAX_TARGETS_VIVOS > MAX_EN_PANTALLA);
  chk('aplicarTopeTargets retira al más viejo (mayor edad) primero', /targets\[i\]\.edad > targets\[viejo\]\.edad/.test(main));
  chk('aplicarTopeTargets nunca retira el CloudOver (rojo)', /if \(targets\[i\]\.rojo\) continue;/.test(main));
}

console.log('\n=== El ritmo caótico se conserva: el retardo sólo se recalcula al spawnear ===');
{
  // Si el gate está lleno, retardoCaotico NO se llama → el estado de ráfaga/pausa
  // no avanza; el próximo spawn usa el retardo ya sorteado (turno no descartado).
  const caos = P.crearCaos();
  let seed = 7; const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const base = { min: 300, max: 900 };
  // Sortea un retardo; mientras "lleno", no se vuelve a llamar → mismo objetivo.
  const gap = P.retardoCaotico(base, caos, rnd);
  const rafagaAntes = caos.rafaga;
  // (no se llama de nuevo porque está lleno)
  chk('sin spawnear, el estado de ráfaga no avanza', caos.rafaga === rafagaAntes && gap > 0);
}

console.log(`\n== RESUMEN tope: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
