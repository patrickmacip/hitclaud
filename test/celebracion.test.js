// hitclaud — CAMBIO 3/4: el disparo AL CENTRO se celebra en dorado (mecánica de bono
// reutilizada), el de fuera no; destello en la mira en cada tiro; parpadeo blanco del target
// golpeado; y LA MIRA en blanco. Los targets NO cambian de color. node test/celebracion.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== CAMBIO 3.1–3.3: al CENTRO, número DORADO de la carambola (reutiliza la mecánica) ===');
{
  // El centro usa la MISMA lista/animación que la carambola (bonos), no la reescribe.
  chk('mostrarBonoCentro empuja a la MISMA lista `bonos` que la carambola', /function mostrarBonoCentro\(x, y, g\) \{\s*bonos\.push\(\{ x: x \+ rnd\([^)]*\), y: y, inicio: performance\.now\(\), texto: '\+' \+ g \}\)/.test(main));
  chk('la carambola sigue con su +500 / HITS ×2 (dos renglones, sin cambios)', /mostrarBonoCarambola[\s\S]{0,140}texto: '\+500', sub: 'HITS ×2'/.test(main));
  chk('el dibujo del bono es común: usa bc.texto y bc.sub (una o dos líneas)', /ctx\.fillText\(bc\.texto \|\| '\+500', cx, sub \? cy - fs \* 0\.36 : cy\)/.test(main) && /if \(sub\) \{[\s\S]{0,120}ctx\.fillText\(sub, cx/.test(main));
  chk('el color del bono es DORADO y con destello blanco→dorado (BONO_COLOR, sin cambios)', /const BONO_COLOR = '#FFC233';/.test(main) && /col = lerpColor\('#FFFFFF', BONO_COLOR/.test(main));
  // En el hitscan de ShotClaud: el CENTRO llama a mostrarBonoCentro con la ganancia (200×mult).
  chk('el disparo AL CENTRO celebra con mostrarBonoCentro(mx, my, r.ganancia)', /S\.enZonaCentral\(tg, mx, my\)\) \{[\s\S]{0,850}mostrarBonoCentro\(mx, my, r\.ganancia\)/.test(main));
}

console.log('=== CAMBIO 3.4: fuera del centro NO se celebra — su +50 discreto (flotante) ===');
{
  // El lateral y el caído usan el flotante normal (pintarGananciaShot), sin dorado ni bono.
  chk('el lateral usa el flotante discreto, no el bono dorado', /const r = S\.anotarLateral\(marcador\);\s*flashShot[\s\S]{0,80}pintarGananciaShot\(mx, my, r\.ganancia, false\)/.test(main));
  chk('el CENTRO celebra con mostrarBonoCentro: en ShotClaud (hitscan) y en Pushcloude (aplastar), una vez c/u', (main.match(/mostrarBonoCentro\(mx, my, r\.ganancia\)/g) || []).length === 2);
  chk('pintarGananciaShot dibuja un flotante normal (no un bono)', /function pintarGananciaShot\(mx, my, g, centro\) \{\s*flotante\(mx, my, '\+' \+ g/.test(main));
}

console.log('=== CAMBIO 3.5: al disparar, destello en la mira SEA acierto o fallo ===');
{
  // miraFlashEn se setea al INICIO de cada disparo (antes de saber si acierta) → también en el fallo.
  chk('cada tiro de ShotClaud enciende el destello de la mira (miraFlashEn al inicio)', /function dispararHitscanShot\(mx, my, ahora\) \{[\s\S]{0,200}miraFlashEn = ahora; miraFlashCentro = false;/.test(main));
}

console.log('=== CAMBIO 3.6: el target golpeado PARPADEA en blanco (ShotClaud), sin cambiar su color ===');
{
  chk('el destello de contacto es BLANCO en ShotClaud, crema en HitClaud', /if \(destella\) col = esShot\(\) \? '#FFFFFF' : COLOR\.crema;/.test(main));
  chk('es un parpadeo momentáneo (destelloHasta), no un color permanente', /const destella = t\.destelloHasta && performance\.now\(\) < t\.destelloHasta;/.test(main));
}

console.log('=== CAMBIO 4: LA MIRA en BLANCO PURO, trazo grueso, punto central blanco ===');
{
  const mira = main.slice(main.indexOf('function dibujarReticulaShot'), main.indexOf('function dibujar()'));
  chk('la cruz/anillo de la mira es blanca (#FFFFFF), no el acento', /ctx\.strokeStyle = '#FFFFFF';\s*ctx\.lineWidth = 2\.5/.test(mira));
  chk('opacidad plena (se ve sobre cualquier fondo), trazo grueso (≥2.5)', /ctx\.globalAlpha = 1;\s*ctx\.beginPath\(\); ctx\.arc\(miraX, miraY, 11 \+ sep/.test(mira));
  chk('el punto central también es BLANCO', /ctx\.fillStyle = '#FFFFFF'; \/\/ 4\.4/.test(mira));
  chk('la mira ya no usa ACENTO.vivo para la cruz ni el punto', !/ctx\.strokeStyle = ACENTO\.vivo;\s*ctx\.lineWidth = 1\.5 \+ flash/.test(mira));
}

console.log('=== V3/V4: EL COLOR DE LOS TARGETS NO CAMBIÓ (naranja ni rojo, HitClaud ni ShotClaud) ===');
{
  // El color BASE del target sigue siendo ACENTO.base (naranja) o el parpadeo cloudover (rojo).
  chk('naranja sigue en ACENTO.base', /: ACENTO\.base;\s*\/\/ CAMBIO 3\.6/.test(main) || /\? \(Math\.floor\(performance\.now\(\) \/ ROJO_PARPADEO_MS\)[\s\S]{0,80}: ACENTO\.base;/.test(main));
  chk('rojo sigue con su parpadeo cloudover-a/b (sin cambios)', /Math\.floor\(performance\.now\(\) \/ ROJO_PARPADEO_MS\) % 2 \? COLOR\.cloudoverA : COLOR\.cloudoverB/.test(main));
  chk('sólo cambió el DESTELLO (flash), no el color base del target', /if \(destella\) col = esShot\(\)/.test(main));
}

console.log(`\n== RESUMEN celebracion: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
