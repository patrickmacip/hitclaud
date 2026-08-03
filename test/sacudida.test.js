// hitclaud — FASE 16 commit 1: revert del zoom de cámara del CloudOver.
// node test/sacudida.test.js  — queda SÓLO la sacudida (12px/300ms); sin scale/foco.

const U = require('../js/util.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== La SACUDIDA queda: 12px → 0 lineal en 300ms ===');
{
  chk('amplitud t=0 = 12px', U.amplitudSacudidaCam(0) === 12);
  chk('amplitud t=150 = 6px', Math.abs(U.amplitudSacudidaCam(150) - 6) < 1e-9);
  chk('amplitud t=300 = 0 EXACTO', U.amplitudSacudidaCam(300) === 0);
  chk('amplitud t=400 = 0 (ya pasó)', U.amplitudSacudidaCam(400) === 0);
  chk('CAM = {SAC_MS:300, SAC_AMP:12} (sin escala)', U.CAM.SAC_MS === 300 && U.CAM.SAC_AMP === 12 && U.CAM.ESCALA === undefined);
}

console.log('=== ZOOM/CENTRADO eliminados por completo (sin código muerto de cámara) ===');
{
  const util = fs.readFileSync(__dirname + '/../js/util.js', 'utf8');
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  chk('util.js: sin escalaCam', !/escalaCam/.test(util));
  chk('util.js: sin focoCam', !/focoCam/.test(util));
  chk('util.js: sin camFin', !/camFin/.test(util));
  chk('main.js: sin camaraCloudover (renombrado a sacudidaCloudover)', !/camaraCloudover/.test(main));
  chk('main.js: sin escalaCam/focoCam/camFin', !/escalaCam|focoCam|camFin/.test(main));
  // No queda ningún 1.6× de CÁMARA. La ausencia de zoom se prueba con los checks de
  // escalaCam/focoCam/camaraCloudover (arriba) y de ctx.scale(s,s)/translate(W/2,H/2)
  // (abajo). Los 1.6 que SÍ existen son legítimos y no son cámara: la magnitud de la
  // explosión del CloudOver y el radio del disco-halo del bono (1.6× el alto del texto).
  chk('main.js: el 1.6 de la explosión sigue (debris del CloudOver, no cámara)', /explotarCubos\(centros, px, py, 1\.6,/.test(main));
  chk('main.js: el 1.6 del halo es el radio del disco (1.6 * altoTexto), no un zoom', /1\.6 \* altoTexto/.test(main));
}

console.log('=== La matriz base del MUNDO vuelve a antes de la fase 15: sólo translate ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  // Bloque del mundo: desde el save+try de la sacudida hasta el finally del restore.
  const ini = main.indexOf('// SACUDIDA de CloudOver (FASE 16: revert del zoom).');
  const fin = main.indexOf('} finally {', ini);
  const bloque = main.slice(ini, fin);
  chk('el bloque del mundo NO tiene la escala de cámara ctx.scale(s, s) (el scale de flotantes es otro)', !/ctx\.scale\(s, s\)/.test(bloque));
  chk('el bloque del mundo NO usa el foco/centrado de cámara (translate(W/2, H/2))', !/translate\(W \/ 2, H \/ 2\)/.test(bloque));
  chk('la sacudida se aplica como translate (temblor), no como escala', /amplitudSacudidaCam[\s\S]{0,160}ctx\.translate\(\(Math\.random/.test(bloque));
  chk('sigue la sacudida normal (ox,oy) tras la de CloudOver', /ctx\.translate\(ox, oy\)/.test(bloque));
  // robustez: el restore del mundo sigue en finally (no se toca).
  chk('el restore del mundo sigue en finally (robustez)', /\} finally \{\s*ctx\.restore\(\)/.test(main));
}

console.log('=== SE QUEDAN: sacudida armada, vibración, bordes rojos toda la secuencia ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  // La sacudida se arma DESPUÉS del early-return de reduced-motion (sin sacudida en reduced).
  const iReduce = main.indexOf('if (reducirMovimiento()) { marcador.puntos = 0');
  const iSet = main.indexOf('sacudidaCloudover = { inicio: ahora }');
  chk('reduced-motion no arma sacudida (set tras el early-return)', iReduce > 0 && iSet > iReduce);
  chk('vibración navigator.vibrate(200) blindada sigue', /if \(navigator && navigator\.vibrate\) navigator\.vibrate\(200\)/.test(main));
  chk('bordes rojos por TODA la secuencia (if (secuencia)) con gradiente cacheado', /if \(secuencia\) \{[\s\S]{0,220}gradBordeIzq/.test(main));
}

console.log('=== REGRESIÓN: tiempos de la secuencia del CloudOver idénticos ===');
{
  chk('SEC.IMPACTO=400, VACIADO=700, POST=200', U.SEC.IMPACTO === 400 && U.SEC.VACIADO === 700 && U.SEC.POST === 200);
  chk('overlay sigue a 1300ms', U.faseCloudover(1300, false) === 'overlay');
  chk('vaciado toca 0 a 1100ms', U.valorVaciado(9999, 1100) === 0);
}

console.log(`\n== RESUMEN sacudida: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
