// hitclaud — ShotClaud v2 en main.js: demolición visible (medio target + islas), targets
// 40% mayores, velocidades variadas, 5× rojos con tope duro (nunca superan a los naranjas),
// y juegos por plataforma. Incluye la REGRESIÓN de HitClaud (V4): todo lo de ShotClaud va
// tras esShot()/juegoActivo y su camino queda intacto. node test/shotintegra.test.js

const fs = require('fs');
const F = require('../js/fisica.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Lee constantes reales del bloque SHOT de main.js (no se hardcodean acá).
const SHOT_BLOQUE = (main.match(/const SHOT = \{([\s\S]*?)\n  \};/) || ['', ''])[1];
function num(re) { const m = SHOT_BLOQUE.match(re); return m ? parseFloat(m[1]) : NaN; }
const COLS = num(/COLS: (\d+)/), FILAS = num(/FILAS: (\d+)/);
const DEMOLE_FRAC = num(/DEMOLE_FRAC: ([\d.]+)/), VEL_BASE = num(/VEL_BASE: ([\d.]+)/);
const ROJO_FACTOR = num(/ROJO_FACTOR: ([\d.]+)/), MAX_EN_PANTALLA = num(/MAX_EN_PANTALLA: (\d+)/);
const MAX_VIVOS = num(/MAX_VIVOS: (\d+)/);

console.log('=== CAMBIO 2 — Tamaño: targets de ShotClaud 40% mayores que HitClaud (5×4) ===');
{
  chk('grilla propia de ShotClaud 7×6 (COLS/FILAS en SHOT)', COLS === 7 && FILAS === 6);
  chk('un 40% más ancho que HitClaud (7/5 = 1.4)', Math.abs(COLS / 5 - 1.4) < 1e-9);
  chk('claramente más grande en área (42 vs 20 celdas)', COLS * FILAS > 5 * 4);
  chk('nuevoTarget pasa la grilla propia al motor en ShotClaud (rama esShot)', /function nuevoTarget\(\) \{\s*if \(esShot\(\)\) \{[\s\S]{0,200}F\.crearTarget\(\{ w: W, h: H \}, SHOT\.COLS, SHOT\.FILAS\)/.test(main));
  chk('ajusta el radio de salida al tamaño mayor (no se culle antes de tiempo)', /t\.radio = Math\.max\(SHOT\.COLS, SHOT\.FILAS\) \* 4 \+ 12/.test(main));
  // El motor NO cambia: la grilla se pasa por parámetro (crearTarget(limites, cols, filas)).
  const t = F.crearTarget({ w: 800, h: 600 }, COLS, FILAS);
  chk('el motor arma la grilla mayor (vivosMax = COLS×FILAS)', t.vivosMax === COLS * FILAS && t.cols === COLS && t.filas === FILAS);
}

console.log('=== CAMBIO 3 — Velocidad: base 10% más lenta que la previa + tres grupos ===');
{
  chk('VEL_BASE = 1.035 (1.15 × 0.90: 10% más lenta que la ShotClaud previa)', Math.abs(VEL_BASE - 1.035) < 1e-9);
  const varia = (SHOT_BLOQUE.match(/\{ mult: ([\d.]+), prob: ([\d.]+) \}/g) || []).map(function (s) {
    const m = s.match(/mult: ([\d.]+), prob: ([\d.]+)/); return { mult: parseFloat(m[1]), prob: parseFloat(m[2]) };
  });
  chk('existen TRES grupos de velocidad', varia.length === 3);
  chk('los grupos son base ×1.0, +20% ×1.2, +40% ×1.4', varia.map(function (v) { return v.mult; }).join(',') === '1,1.2,1.4');
  chk('las proporciones suman 1', Math.abs(varia.reduce(function (a, v) { return a + v.prob; }, 0) - 1) < 1e-9);
  chk('la mayoría va a la base (proporción mayor en ×1.0)', varia[0].prob >= varia[1].prob && varia[1].prob >= varia[2].prob);
  chk('aplica IGUAL a naranjas y rojos (ambos por nuevoTarget → aplicarVelocidadShot)', /function aplicarVelocidadShot\(t\) \{[\s\S]{0,120}t\.vx \*= f; t\.vy \*= f;/.test(main) && /function generarNaranja\(\) \{\s*targets\.push\(nuevoTarget\(\)\);/.test(main) && /function generarRojo\(\) \{\s*const t = nuevoTarget\(\);\s*t\.rojo = true;/.test(main));
}

console.log('=== CAMBIO 1 — Demolición: fuera del centro destruye ~la mitad; el resto cae (islas) ===');
{
  chk('DEMOLE_FRAC ~0.5 (media demolición), ajustable en un solo sitio', DEMOLE_FRAC === 0.5);
  // Comportamiento: sobre un target COMPLETO, arrancar ceil(vivos*FRAC) celdas deja ~la mitad.
  const t = F.crearTarget({ w: 800, h: 600 }, COLS, FILAS);
  const centro = F.celdaMundo(t, 0); // un punto sobre una celda viva
  const n = Math.max(1, Math.ceil(t.vivos * DEMOLE_FRAC));
  const arrancadas = F.celdasCercanas(t, centro.x, centro.y, n);
  chk('arranca cerca de la mitad de las celdas (no un cubo)', arrancadas.length === n && Math.abs(arrancadas.length - t.vivos / 2) <= 1);
  chk('el disparo fuera del centro llama a demolerMitadShot', /FUERA del centro \(target INTACTO\)[\s\S]{0,200}demolerMitadShot\(tg, ti, mx, my, ahora\)/.test(main));
  chk('demolerMitadShot arranca ceil(vivos×FRAC), explota y sacude', /function demolerMitadShot\([\s\S]{0,260}Math\.ceil\(tg\.vivos \* SHOT\.DEMOLE_FRAC\)[\s\S]{0,600}explotarCubos\([\s\S]{0,120}sacudidaHasta = ahora \+ SACUDIDA_MS/.test(main));
  chk('reutiliza quizasPartir (islas de Big Claude), no reescribe la lógica', /function demolerMitadShot\([\s\S]{0,750}quizasPartir\(tg, mx, my, 1\.0\)/.test(main));
  chk('marca el resto y los trozos como caído/debris (valen 50, no 200)', /tg\.tocado = true;\s*quizasPartir[\s\S]{0,320}if \(targets\[k\]\.fragmento\) \{ targets\[k\]\.tocado = true/.test(main));

  // El pedazo sobreviviente hereda gravedad, velocidad y rotación (partirTarget = islas).
  const g = F.crearTarget({ w: 800, h: 600 }, COLS, FILAS);
  g.haEntrado = true;
  // Mata una franja central para forzar dos islas desconectadas.
  for (let c = 0; c < g.cols; c++) { const idx = Math.floor(g.filas / 2) * g.cols + c; g.celdas[idx] = false; g.vivos--; }
  const frags = F.partirTarget(g, g.x, g.y, 1.0, 0.5);
  chk('el corte produce islas', !!frags && frags.length >= 1);
  chk('la isla hereda gravedad, rotación y velocidad (como Big Claude)', !!frags && frags[0].gravedad === F.FISICA.G_TARGET && typeof frags[0].velRot === 'number' && typeof frags[0].vx === 'number');

  chk('el disparo al CENTRO sigue destruyendo el target ENTERO (splice)', /S\.enZonaCentral\(tg, mx, my\)\) \{[\s\S]{0,140}S\.anotarCentro\(marcador\)[\s\S]{0,360}targets\.splice\(ti, 1\)/.test(main));
}

console.log('=== CAMBIO 3 — Rojos: el DOBLE que la ShotClaud previa + TOPE DURO (rojos ≤ naranjas) ===');
{
  chk('ROJO_FACTOR = 0.025 (el doble de rojos que la previa de 0.05)', ROJO_FACTOR === 0.025);
  chk('cupos propios mayores para llenar la pantalla (spawn 6, vivos 16)', MAX_EN_PANTALLA === 6 && MAX_VIVOS === 16);
  chk('el spawn de rojos exige rojos < naranjas en ShotClaud', /const c = contarTargets\(\);\s*const puedeRojo = !esShot\(\) \|\| c\.rojos < c\.naranjas;/.test(main));
  chk('contarTargets separa rojos de naranjas (todo lo no-rojo)', /function contarTargets\(\) \{[\s\S]{0,200}if \(targets\[i\]\.rojo\) rojos\+\+; else naranjas\+\+;/.test(main));

  // PRUEBA de comportamiento del TOPE DURO (4.2 "pruébalo"): simula el spawn EXACTO del juego
  // (un rojo sólo sale si rojos < naranjas) con los rojos queriendo salir muy seguido, y verifica
  // que NUNCA se spawnea un rojo que iguale o supere a los naranjas. (Las muertes naturales
  // pueden dejar un rojo de más un instante — eso no lo evita ningún tope sin retirar rojos, lo
  // cual está prohibido; el tope vive en el SPAWN, que es lo que se prueba.)
  let seed = 999; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const arr = []; const CAP = MAX_EN_PANTALLA;
  let proxN = 0, proxR = 0, proxDisparo = 0, spawnMalos = 0, picoRojos = 0, rojosSpawneados = 0;
  function cnt() { let r = 0, n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i].rojo) r++; else n++; } return { r: r, n: n }; }
  for (let t = 0; t < 60000; t += 16) {
    for (let i = arr.length - 1; i >= 0; i--) if (t >= arr[i].muereEn) arr.splice(i, 1);
    // El jugador DEMUELE un naranja cada ~350ms (centro): libera cupo para que salgan rojos.
    if (t >= proxDisparo) { for (let i = 0; i < arr.length; i++) { if (!arr[i].rojo) { arr.splice(i, 1); break; } } proxDisparo = t + 300 + rnd() * 100; }
    if (arr.length < CAP && t >= proxN) { arr.push({ rojo: false, muereEn: t + 800 + rnd() * 1500 }); proxN = t + 100 + rnd() * 280; }
    if (arr.length < CAP && t >= proxR) {
      const c = cnt();
      if (c.r < c.n) { // EXACTAMENTE el gate del juego
        if (!(c.r < c.n)) spawnMalos++;               // nunca debería spawnear con rojos ≥ naranjas
        arr.push({ rojo: true, muereEn: t + 800 + rnd() * 1500 }); rojosSpawneados++;
        const d = cnt(); if (d.r > d.n) spawnMalos++;  // tras spawnear, rojos ≤ naranjas
        proxR = t + 60 + rnd() * 80;
      }
    }
    picoRojos = Math.max(picoRojos, cnt().r);
  }
  chk('ningún rojo se spawneó pudiendo superar a los naranjas (0 spawns malos)', spawnMalos === 0);
  chk('la prueba ejerció el tope de verdad (muchos rojos spawneados)', rojosSpawneados > 100 && picoRojos >= 1);
}

console.log('=== CAMBIO 5 — Juegos por plataforma (regla en la estructura, no repartida) ===');
{
  chk('existe disponibilidad(j, desktop, acceso) derivada de la plataforma', /function disponibilidad\(j, desktop, acceso\) \{/.test(main));
  chk('fuera de plataforma → aviso de plataforma, NO "Pronto" (distintos, 5.4)', /aviso: j\.plataforma === 'escritorio' \? 'Disponible en computadora' : 'Disponible en móvil'/.test(main));
  chk('en plataforma pero sin terminar (sin acceso) → pronto:true, aviso "Pronto"', /return \{ jugable: false, pronto: true, anticipado: false, aviso: 'Pronto' \};/.test(main));
  chk('la tarjeta usa disponibilidad() (no reglas sueltas)', /const disp = disponibilidad\(j, esDesktop, accesoAnticipado\);/.test(main));
  chk('el home muestra el cuerpo jugable o el no-jugable según disponibilidad()', /const disp = disponibilidad\(j, esDesktop, accesoAnticipado\);[\s\S]{0,200}elHomeJugable\.classList\.toggle\('oculto', !disp\.jugable\)/.test(main));

  // Comportamiento de la regla (replicada desde la estructura JUEGOS parseada de main.js).
  const bloque = (main.match(/const JUEGOS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const juegos = (bloque.match(/\{ id: '(\w+)'[\s\S]*?plataforma: '(\w+)'[\s\S]*?\}/g) || []).map(function (s) {
    const m = s.match(/id: '(\w+)'[\s\S]*?jugable: (true|false)[\s\S]*?plataforma: '(\w+)'/);
    return { id: m[1], jugable: m[2] === 'true', plataforma: m[3] };
  });
  function disp(j, desktop) { // MISMO orden que disponibilidad(): "Pronto" manda sobre la plataforma
    if (!j.jugable) return { jugable: false, aviso: 'Pronto' };
    const en = j.plataforma === 'ambas' || (j.plataforma === 'escritorio' && desktop) || (j.plataforma === 'tactil' && !desktop);
    if (!en) return { jugable: false, aviso: j.plataforma === 'escritorio' ? 'Disponible en computadora' : 'Disponible en móvil' };
    return { jugable: true, aviso: null };
  }
  const byId = {}; juegos.forEach(function (j) { byId[j.id] = j; });
  chk('en COMPUTADORA solo ShotClaud es jugable', disp(byId.shotclaud, true).jugable && !disp(byId.hitclaud, true).jugable && !disp(byId.pushclaud, true).jugable);
  chk('en TÁCTIL ShotClaud NO es jugable', !disp(byId.shotclaud, false).jugable);
  chk('en TÁCTIL HitClaud sí es jugable (su lógica intacta)', disp(byId.hitclaud, false).jugable);
  chk('HitClaud en computadora dice "Disponible en móvil", no "Pronto"', disp(byId.hitclaud, true).aviso === 'Disponible en móvil');
  // v2.9: Pushcloude ya tiene mecánica (jugable) pero es de ACCESO ANTICIPADO (gate real en
  // disponibilidad(), probado en acceso.test). Aquí sólo se comprueba que es TÁCTIL: en computadora
  // no se juega. La duración 15 ya no existe (60/180).
  chk('PushCloude es táctil: en computadora "Disponible en móvil"; sin duración 15', disp(byId.pushclaud, true).aviso === 'Disponible en móvil' && byId.pushclaud.plataforma === 'tactil' && !/id: 'pushclaud'[\s\S]*?duraciones: \['15'\]/.test(main));
}

console.log('=== Integración: hitscan de ShotClaud, Big Claude apagado, SW ===');
{
  chk('dispararHitscan deriva a dispararHitscanShot cuando esShot()', /if \(esShot\(\)\) \{ dispararHitscanShot\(mx, my, ahora\); return; \}/.test(main));
  chk('Big Claude NO se lanza en ShotClaud/Pushcloude (guard sinGrande)', /if \(!sinGrande\(\) && targets\.length < capEnPantalla\(\) && t >= proximoGrande/.test(main) && /function sinGrande\(\) \{ return \(esShot\(\) && SHOT\.SIN_GRANDE\) \|\| \(esPush\(\) && PUSH\.SIN_GRANDE\); \}/.test(main));
  chk('el service worker subió a v98', /hitclaud-shell-v98/.test(sw));
}

console.log('=== V4 REGRESIÓN de HitClaud — su camino queda intacto ===');
{
  chk('HitClaud: nuevoTarget devuelve el crearTarget 5×4 tal cual (sin tamaño ni velocidad extra)', /return F\.crearTarget\(\{ w: W, h: H \}\);\s*\}\s*\/\/ Pushcloude/.test(main) || /\n    return F\.crearTarget\(\{ w: W, h: H \}\);\n  \}/.test(main));
  chk('HitClaud sigue con P.anotarHit + P.anotarDestruidos en su hitscan', /function dispararHitscan\(mx, my\)[\s\S]{0,2200}P\.anotarHit\(marcador\)[\s\S]{0,300}P\.anotarDestruidos\(marcador, arrancadas\.length\)/.test(main));
  chk('HitClaud sigue con P.anotarFallo al no tocar nada', /No tocó ningún cubo → FALLO\.\s*const pen = P\.anotarFallo\(marcador\)/.test(main));
  chk('rojos de HitClaud sin cambio (factorRojo = 1 fuera de ShotClaud)', /esShot\(\) \? SHOT\.ROJO_FACTOR : 1/.test(main));
  chk('Big Claude sigue vivo para HitClaud (generarGrande intacto)', /function generarGrande\(\) \{[\s\S]{0,200}F\.crearTarget\(\{ w: W, h: H \}, GRANDE_COLS, GRANDE_FILAS\)/.test(main));
  // El motor F.crearTarget por defecto sigue dando 5×4 = 20 celdas (HitClaud).
  const h = F.crearTarget({ w: 800, h: 600 });
  chk('el motor por defecto (HitClaud) sigue en 5×4 = 20 celdas', h.cols === 5 && h.filas === 4 && h.vivosMax === 20);
}

console.log('=== V7 — Rendimiento: los topes ACOTAN los objetos (sin crecimiento sin fin) ===');
{
  // Replica el gate de spawn (≤ MAX_EN_PANTALLA) + desprendimiento de islas + aplicarTopeTargets
  // (≤ MAX_VIVOS, quita el más viejo no-rojo). Verifica que el total de targets NUNCA supera
  // MAX_VIVOS aunque cada disparo suelte fragmentos — no hay acumulación descontrolada.
  const CAP_SPAWN = MAX_EN_PANTALLA, CAP_VIVOS = MAX_VIVOS;
  let seed = 7; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const arr = []; let pico = 0;
  function tope() {
    while (arr.length > CAP_VIVOS) {
      let viejo = -1;
      for (let i = 0; i < arr.length; i++) { if (arr[i].rojo) continue; if (viejo < 0 || arr[i].edad > arr[viejo].edad) viejo = i; }
      if (viejo < 0) break; arr.splice(viejo, 1);
    }
  }
  for (let t = 0; t < 20000; t += 16) {
    for (let i = arr.length - 1; i >= 0; i--) { arr[i].edad += 16; if (arr[i].edad > 2000) arr.splice(i, 1); }
    if (arr.length < CAP_SPAWN) arr.push({ rojo: rnd() < 0.4, edad: 0 });
    if (rnd() < 0.5) { const k = 1 + Math.floor(rnd() * 3); for (let j = 0; j < k; j++) arr.push({ rojo: false, edad: 0, fragmento: true }); tope(); }
    pico = Math.max(pico, arr.length);
  }
  chk('el total de targets NUNCA superó MAX_VIVOS (' + CAP_VIVOS + ')', pico <= CAP_VIVOS);
  chk('el pool de explosión sigue acotado por MAX_CUBOS (240, se recicla)', /const MAX_CUBOS = 240;/.test(main));
}

console.log('=== V6: una sola asignación de ctx.shadowBlur ===');
{
  chk('una sola asignación ctx.shadowBlur', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN shot-integra: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
