// hitclaud — FASE 15: cámara al impacto del CloudOver. node test/camara.test.js

const U = require('../js/util.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

const W = 390, H = 844;
// Transforma un punto de MUNDO a PANTALLA con {s, fx, fy}:
//   screen = s·(world − foco) + centro   (= translate(W/2,H/2) scale(s) translate(−f))
function proyectar(wx, wy, s, fx, fy) { return { x: s * (wx - fx) + W / 2, y: s * (wy - fy) + H / 2 }; }

console.log('=== La cámara CENTRA el punto de impacto en el centro del viewport ===');
{
  const s = U.escalaCam(700); // en pleno hold (1.6×)
  const px = 195, py = 422;   // impacto en el medio
  const f = U.focoCam(px, py, s, W, H, 0, 0);
  const c = proyectar(px, py, s, f.fx, f.fy);
  chk(`escala en hold = 1.6 (dio ${s})`, s === 1.6);
  chk(`el impacto cae en el CENTRO (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) ≈ (195, 422)`, Math.abs(c.x - W / 2) < 1e-6 && Math.abs(c.y - H / 2) < 1e-6);
}

console.log('=== CLAMP: impacto en las 4 esquinas → NUNCA se ve fuera del mundo ===');
{
  const s = 1.6;
  const halfW = W / (2 * s), halfH = H / (2 * s);
  const esquinas = [[0, 0], [W, 0], [0, H], [W, H], [5, 830], [385, 10]];
  let bien = true;
  esquinas.forEach(function (e) {
    const f = U.focoCam(e[0], e[1], s, W, H, 0, 0);
    const izq = f.fx - halfW, der = f.fx + halfW, arr = f.fy - halfH, aba = f.fy + halfH;
    // La región visible [izq,der]×[arr,aba] debe caer dentro de [0,W]×[0,H] (sin franjas).
    if (izq < -1e-9 || der > W + 1e-9 || arr < -1e-9 || aba > H + 1e-9) { bien = false; console.log(`    esquina ${e} → visible [${izq.toFixed(1)},${der.toFixed(1)}]x[${arr.toFixed(1)},${aba.toFixed(1)}] FUERA`); }
  });
  chk('en las 4 esquinas (y cerca de las orillas) la vista queda DENTRO del mundo', bien);
}

console.log('=== Escala en el tiempo: entra, sostiene y sale; IDENTIDAD a t=1300 ===');
{
  chk('t=0 → 1× (identidad al arrancar)', U.escalaCam(0) === 1);
  chk('t=350 → 1.6 (entrada completa)', U.escalaCam(350) === 1.6);
  chk('t=700 (congelado/vaciado) → 1.6 (sostiene)', U.escalaCam(700) === 1.6);
  chk('t=1050 → 1.6 (aún sostiene; la salida arranca aquí)', U.escalaCam(1050) === 1.6);
  chk('t=1175 (mitad de la salida) → entre 1 y 1.6', U.escalaCam(1175) > 1 && U.escalaCam(1175) < 1.6);
  chk('t=1300 (overlay) → 1× EXACTO (identidad, salida visible ya terminó)', U.escalaCam(1300) === 1);
  chk('camFin() = 1300 = instante del overlay', U.camFin() === 1300);
  chk('t=2000 → 1× (fuera de la ventana)', U.escalaCam(2000) === 1);
}

console.log('=== SACUDIDA: 12px → 0 lineal en 300ms; se suma al foco respetando el clamp ===');
{
  chk('amplitud t=0 = 12px', U.amplitudSacudidaCam(0) === 12);
  chk('amplitud t=150 = 6px (mitad)', Math.abs(U.amplitudSacudidaCam(150) - 6) < 1e-9);
  chk('amplitud t=300 = 0 EXACTO', U.amplitudSacudidaCam(300) === 0);
  chk('amplitud t=400 = 0 (ya pasó)', U.amplitudSacudidaCam(400) === 0);
  // Sacudida grande cerca de una orilla: el clamp la contiene (no deja ver fuera).
  const s = 1.6, halfW = W / (2 * s);
  const f = U.focoCam(5, 400, s, W, H, 99, 0); // impacto pegado a la izquierda + sacudida fuerte
  chk('sacudida fuerte en la orilla no saca la vista del mundo', f.fx - halfW >= -1e-9);
}

console.log('=== SEPARACIÓN mundo/UI y robustez (grep de main.js) ===');
{
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  // La cámara (scale) se aplica DENTRO del bloque del mundo (antes del finally);
  // badge, bordes, temporizador y medidor v41-fps van DESPUÉS del restore (sin transformar).
  const iScale = main.indexOf('ctx.scale(s, s); ctx.translate(-f.fx, -f.fy)');
  const iFinally = main.indexOf('} finally {', iScale);
  const iRestore = main.indexOf('ctx.restore(); // SIEMPRE restaura la transformación del MUNDO');
  const iBadge = main.indexOf('BADGE del multiplicador');
  const iTimer = main.indexOf('TEMPORIZADOR (modo 60 seg)');
  const iFps = main.indexOf('medidorFps.leer('); // llamada de DIBUJO del medidor (no el comentario de estado)
  chk('la cámara (scale/translate) está dentro del bloque del mundo', iScale > 0 && iScale < iFinally);
  chk('el restore del mundo va en finally (robustez: vista nunca torcida)', iFinally > 0 && iRestore > iFinally);
  chk('el BADGE ×N se dibuja tras el restore (UI, sin cámara)', iBadge > iRestore);
  chk('el TEMPORIZADOR se dibuja tras el restore (UI, sin cámara)', iTimer > iRestore);
  chk('el medidor v41-fps se dibuja tras el restore (UI, sin cámara)', iFps > iRestore);
  // reduced-motion: la cámara se activa DESPUÉS del early-return de reduced-motion.
  const iReduce = main.indexOf('if (reducirMovimiento()) { marcador.puntos = 0');
  const iCamSet = main.indexOf('camaraCloudover = { inicio: ahora');
  chk('reduced-motion no arma cámara (el set va después del early-return)', iReduce > 0 && iCamSet > iReduce);
  // La cámara se apaga al llegar al overlay (identidad garantizada).
  chk('camaraCloudover se anula en camFin (vuelve a base)', /elc >= U\.camFin\(\)\) \{ camaraCloudover = null/.test(main));
  // Bordes rojos: reusa el gradiente cacheado, disparado por toda la secuencia.
  chk('bordes rojos reusan gradBorde cacheado durante toda la secuencia', /if \(secuencia\) \{[\s\S]{0,220}gradBordeIzq/.test(main));
  // Vibración blindada.
  chk('navigator.vibrate(200) blindado con comprobación + try/catch', /if \(navigator && navigator\.vibrate\) navigator\.vibrate\(200\)/.test(main));
}

console.log('=== REGRESIÓN: los tiempos de la fase 12 quedan idénticos ===');
{
  chk('SEC.IMPACTO=400, VACIADO=700, POST=200 (sin cambios)', U.SEC.IMPACTO === 400 && U.SEC.VACIADO === 700 && U.SEC.POST === 200);
  chk('faseCloudover: overlay sigue a los 1300ms', U.faseCloudover(1299, false) === 'cero' && U.faseCloudover(1300, false) === 'overlay');
  chk('el vaciado sigue tocando 0 a los 1100ms', U.valorVaciado(9999, 1100) === 0);
}

console.log(`\n== RESUMEN cámara: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
