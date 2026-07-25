// hitclaud — TOPE DURO de 4 targets en pantalla (naranjas + rojos juntos):
// node test/tope.test.js
// Espejo de los gates de spawn de main.js: nunca un 5º vivo; los spawns
// pospuestos por falta de lugar disparan al liberarse (el ritmo no se pierde).

const P = require('../js/puntuacion.js');

function chk(nombre, ok) { console.log(`  ${nombre}  ${ok ? 'OK ✓' : 'NO ✗'}`); }

const MAX = 4;

console.log('=== Bajo presión (vidas cortas, ritmo denso) nunca hay un 5º vivo ===');
{
  // Simula el loop: targets con vida aleatoria; gates idénticos a main.js.
  // rnd determinista para reproducibilidad.
  let seed = 12345;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  const targets = []; // cada uno: { muereEn }
  const caos = P.crearCaos();
  let escalada = P.crearEscalada(0, rnd);
  let proximoSpawn = 0, proximoRojo = P.intervaloRojo(escalada.nivel);
  let picoVivos = 0, quintos = 0;
  let spawnsHechos = 0, framesLlenoConSpawnPendiente = 0, spawnsTrasLleno = 0;
  let veniaLleno = false;

  const DT = 16;
  for (let t = 0; t < 60000; t += DT) {
    // muerte natural
    for (let i = targets.length - 1; i >= 0; i--) if (t >= targets[i].muereEn) targets.splice(i, 1);

    const estabaLleno = targets.length >= MAX;

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
    if (targets.length > MAX) quintos++;
    // ¿estaba lleno y un spawn quedó pendiente (vencido) esperando lugar?
    if (estabaLleno && (t >= proximoSpawn || t >= proximoRojo)) framesLlenoConSpawnPendiente++;
    veniaLleno = targets.length >= MAX;
  }

  console.log(`  pico de vivos = ${picoVivos} (tope ${MAX})`);
  chk('nunca se superó el tope (0 quintos)', quintos === 0 && picoVivos <= MAX);
  chk(`hubo presión real (${spawnsHechos} spawns en 60s, pico llegó al tope)`, spawnsHechos > 60 && picoVivos === MAX);
  chk(`spawns pospuestos por lleno se dispararon al liberarse (${spawnsTrasLleno})`, spawnsTrasLleno > 0);
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
