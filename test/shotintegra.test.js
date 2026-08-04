// hitclaud — ShotClaud, integración en main.js: dificultad en UN lugar (rojos ×4, +15%
// velocidad, sin Big Claude), ruteo del hitscan a la puntuación propia, retícula sin
// shadowBlur, jugable sólo en escritorio, envío listo-pero-inactivo. Incluye la REGRESIÓN
// de HitClaud (V4): todo lo de ShotClaud va DETRÁS de esShot()/juegoActivo, el camino de
// HitClaud queda intacto. node test/shotintegra.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== CAMBIO 5: dificultad de ShotClaud en UN SOLO lugar (config SHOT) ===');
{
  chk('existe el objeto SHOT de configuración', /const SHOT = \{[\s\S]{0,400}\};/.test(main));
  chk('4× más rojos → ROJO_FACTOR: 0.25', /SHOT = \{[\s\S]{0,300}ROJO_FACTOR: 0\.25/.test(main));
  chk('15% más rápido → VEL_FACTOR: 1.15', /SHOT = \{[\s\S]{0,300}VEL_FACTOR: 1\.15/.test(main));
  chk('sin Big Claude → SIN_GRANDE: true', /SHOT = \{[\s\S]{0,300}SIN_GRANDE: true/.test(main));
  chk('esShot() decide por juegoActivo === shotclaud', /function \(\) \{ return juegoActivo === 'shotclaud'; \}/.test(main));
}

console.log('=== CAMBIO 5: la config se APLICA en el spawn (frecuencia, velocidad, grande) ===');
{
  chk('rojos: el intervalo se multiplica por SHOT.ROJO_FACTOR sólo en ShotClaud', /esShot\(\) \? SHOT\.ROJO_FACTOR : 1[\s\S]{0,160}P\.intervaloRojo\(escalada\.nivel\) \* factorRojo/.test(main));
  chk('velocidad: acelerarShot multiplica vx/vy por VEL_FACTOR sólo en ShotClaud', /function acelerarShot\(t\) \{\s*if \(esShot\(\)\) \{ t\.vx \*= SHOT\.VEL_FACTOR; t\.vy \*= SHOT\.VEL_FACTOR; \}/.test(main));
  chk('naranjas y rojos pasan por acelerarShot', /targets\.push\(acelerarShot\(F\.crearTarget/.test(main) && /const t = acelerarShot\(F\.crearTarget/.test(main));
  chk('Big Claude NO se lanza en ShotClaud (guard SIN_GRANDE)', /if \(!\(esShot\(\) && SHOT\.SIN_GRANDE\) && targets\.length < MAX_EN_PANTALLA && t >= proximoGrande/.test(main));
}

console.log('=== CAMBIO 3: el hitscan rutea a la puntuación PROPIA de ShotClaud ===');
{
  chk('dispararHitscan deriva a dispararHitscanShot cuando esShot()', /if \(esShot\(\)\) \{ dispararHitscanShot\(mx, my, ahora\); return; \}/.test(main));
  chk('existe dispararHitscanShot', /function dispararHitscanShot\(mx, my, ahora\)/.test(main));
  chk('rojo → CloudOver (sin cambios) también en ShotClaud', /function dispararHitscanShot[\s\S]{0,600}if \(tg\.rojo\) \{ golpeCloudover\(tg, mx, my\); return; \}/.test(main));
  chk('caído → S.anotarCaido (50 siempre)', /if \(tg\.tocado\) \{[\s\S]{0,160}S\.anotarCaido\(marcador\)/.test(main));
  chk('centro → S.anotarCentro y DESTRUYE el target entero (splice)', /S\.enZonaCentral\(tg, mx, my\)\) \{[\s\S]{0,120}S\.anotarCentro\(marcador\)[\s\S]{0,400}targets\.splice\(ti, 1\)/.test(main));
  chk('fuera del centro → marca tocado y S.anotarLateral (no destruye)', /tg\.tocado = true;\s*const r = S\.anotarLateral\(marcador\)/.test(main));
  chk('nada → S.anotarFallo + registrarPerdida(castigo)', /S\.anotarFallo\(marcador\)[\s\S]{0,120}registrarPerdida\(r\.castigo\)/.test(main));
}

console.log('=== CAMBIO 4: retícula de ShotClaud, SIN shadowBlur ===');
{
  chk('existe dibujarReticulaShot', /function dibujarReticulaShot\(ahoraB\)/.test(main));
  chk('el desktop rutea a la retícula de ShotClaud', /if \(esDesktop && esShot\(\)\) \{[\s\S]{0,120}dibujarReticulaShot\(ahoraB\)/.test(main));
  const reticula = main.slice(main.indexOf('function dibujarReticulaShot'), main.indexOf('function dibujar()'));
  chk('la retícula NO usa shadowBlur (sólo color/tamaño/trazo)', reticula.indexOf('shadowBlur') === -1);
  chk('retroceso documentado (MIRA_RETROCESO_MS ~120)', /const MIRA_RETROCESO_MS = 120;/.test(main));
  chk('destello de acierto distingue centro (miraFlashCentro)', /miraFlashCentro \? 2\.5 : 1/.test(main));
}

console.log('=== CAMBIO 6: jugable en escritorio, envío listo-pero-inactivo, script y SW ===');
{
  chk('ShotClaud queda jugable: true', /id: 'shotclaud'[\s\S]{0,120}jugable: true/.test(main));
  chk('sólo se puede jugar donde la plataforma calza (jugableAqui)', /const jugableAqui = j\.jugable && plataformaOk;/.test(main));
  chk('escritorio sólo en desktop; táctil sólo fuera de desktop', /plataforma === 'escritorio' && esDesktop[\s\S]{0,80}plataforma === 'tactil' && !esDesktop/.test(main));
  chk('el toque sólo navega si jugableAqui', /if \(jugableAqui\) \{ mostrarPantallaDuracion\(j\.id, true\); return; \}/.test(main));
  chk('envío al ranking INACTIVO para juegos que no sean HitClaud', /function enviarAlServidor\(porTiempo\) \{[\s\S]{0,800}if \(juegoActivo !== 'hitclaud'\) return;/.test(main));
  chk('el script de shotclaud carga antes de main.js', /js\/shotclaud\.js"><\/script>[\s\S]*js\/main\.js"><\/script>/.test(html));
  chk('el service worker cachea js/shotclaud.js', /'js\/shotclaud\.js'/.test(sw));
  chk('el service worker subió a v79', /hitclaud-shell-v79/.test(sw));
}

console.log('=== V4 REGRESIÓN de HitClaud — todo lo de ShotClaud va DETRÁS de un guard ===');
{
  // La puntuación de HitClaud sigue intacta en su rama del hitscan.
  chk('HitClaud sigue con P.anotarHit + P.anotarDestruidos en su hitscan', /function dispararHitscan\(mx, my\)[\s\S]{0,2200}P\.anotarHit\(marcador\)[\s\S]{0,300}P\.anotarDestruidos\(marcador, arrancadas\.length\)/.test(main));
  chk('HitClaud sigue con P.anotarFallo al no tocar nada', /No tocó ningún cubo → FALLO\.\s*const pen = P\.anotarFallo\(marcador\)/.test(main));
  // acelerarShot es no-op fuera de ShotClaud → la velocidad de HitClaud no cambia.
  chk('acelerarShot NO toca la velocidad si no es ShotClaud (guard esShot)', /function acelerarShot\(t\) \{\s*if \(esShot\(\)\) \{/.test(main));
  // El intervalo de rojos de HitClaud queda igual (factor = 1).
  chk('rojos de HitClaud sin cambio (factorRojo = 1 fuera de ShotClaud)', /esShot\(\) \? SHOT\.ROJO_FACTOR : 1/.test(main));
  // Big Claude sigue apareciendo en HitClaud (el guard sólo lo apaga en ShotClaud).
  chk('Big Claude sigue vivo para HitClaud (generarGrande intacto)', /function generarGrande\(\) \{[\s\S]{0,200}F\.crearTarget\(\{ w: W, h: H \}, GRANDE_COLS, GRANDE_FILAS\)/.test(main));
  chk('la puntuación de HitClaud (puntuacion.js) no se importa como ShotClaud', /const P = window\.Puntuacion;/.test(main) && /const S = window\.ShotClaud;/.test(main));
}

console.log('=== V6: una sola asignación de shadowBlur en todo main.js ===');
{
  // V6 pide UNA sola ASIGNACIÓN (los comentarios documentan que NO se usa en otros lados).
  chk('una sola asignación ctx.shadowBlur', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN shot-integra: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
