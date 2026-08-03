// hitclaud — FASE 22: #nombre es un overlay REAL + salida de emergencia + PARIDAD.
// node test/overlays.test.js
// Ley del dueño: el test verifica el REGISTRO estructural (que el overlay esté en las
// reglas CSS correctas y quede TOCABLE), no sólo que el texto exista en el archivo.

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function set(a) { return a.slice().sort().join(','); }

// ── Extracción de las tres listas ──────────────────────────────────────────
// 1) Overlays en el HTML = divs con role="dialog" (todos los overlays lo llevan).
const idsHtml = [...html.matchAll(/<div id="(\w+)"[^>]*role="dialog"/g)].map(function (m) { return m[1]; });
// 2) Regla de POSICIÓN (la que tiene position:fixed; z-index:3) → sus ids.
const mPos = css.match(/([^\n{]*#gameover[^\n{]*)\{\s*\n\s*position: fixed;\s*\n\s*inset: 0;\s*\n\s*z-index: 3;/);
const idsPos = mPos ? [...mPos[1].matchAll(/#(\w+)/g)].map(function (m) { return m[1]; }) : [];
// 3) Regla de OCULTADO COMPUESTO (#X.oculto {display:none}) → sus ids.
const mOcu = css.match(/([^\n{]*#gameover\.oculto[^\n{]*)\{\s*display: none;/);
const idsOcu = mOcu ? [...mOcu[1].matchAll(/#(\w+)\.oculto/g)].map(function (m) { return m[1]; }) : [];

console.log('=== PARIDAD HTML ↔ CSS: cada overlay del HTML está en AMBAS reglas ===');
{
  console.log(`  HTML(role=dialog): [${idsHtml.join(', ')}]`);
  console.log(`  CSS posición z3  : [${idsPos.join(', ')}]`);
  console.log(`  CSS oculto comp. : [${idsOcu.join(', ')}]`);
  chk('los 5 overlays esperados en el HTML (inicio, nombre, novedades, gameover, pausa)', set(idsHtml) === set(['inicio', 'nombre', 'novedades', 'gameover', 'pausa']));
  chk('PARIDAD: HTML == regla de posición (nadie olvidado)', set(idsHtml) === set(idsPos));
  chk('PARIDAD: HTML == regla de ocultado compuesto', set(idsHtml) === set(idsOcu));
  chk('#nombre presente en AMBAS reglas (el bug de la fase 21, ahora registrado)', idsPos.indexOf('nombre') !== -1 && idsOcu.indexOf('nombre') !== -1);
}

console.log('=== Especificidad: el ocultado de CADA overlay es COMPUESTO (0-1-1-0), no genérico ===');
{
  // Para cada overlay hay #X { display:flex } (ID) → necesita #X.oculto (ID+clase) para ganar.
  const compuestoParaTodos = idsHtml.every(function (id) { return idsOcu.indexOf(id) !== -1; });
  chk('cada overlay tiene su #X.oculto (ninguno depende de la .oculto genérica)', compuestoParaTodos);
  // La genérica .oculto existe pero NO alcanza para estos (por eso el compuesto).
  chk('existe la .oculto genérica pero los overlays usan el compuesto', /^\.oculto \{ display: none; \}$/m.test(css) && idsOcu.length === 5);
}

console.log('=== TOQUES: el overlay (y su input/botones) queda POR ENCIMA del canvas ===');
{
  const zCanvas = (css.match(/#juego \{[\s\S]*?z-index: (\d+);/) || [])[1];
  const zOverlay = mPos ? (css.slice(mPos.index).match(/z-index: (\d+);/) || [])[1] : null;
  console.log(`  z-index: canvas #juego=${zCanvas}  overlays=${zOverlay}`);
  chk('overlays por encima del canvas (z-index overlay > z-index #juego)', Number(zOverlay) > Number(zCanvas));
  chk('el listener global del canvas NO puede interceptar: el overlay está arriba (z3 > z1)', Number(zOverlay) === 3 && Number(zCanvas) === 1);
  chk('el input NO desactiva pointer-events (recibe el toque)', !/nombre-input[\s\S]{0,200}pointer-events:\s*none/.test(css));
}

console.log('=== SALIDA DE EMERGENCIA: botón "Omitir" existe, es tocable y lleva a jugar ===');
{
  chk('botón Omitir en el overlay #nombre (reusa .go-reiniciar .go-modo-libre, sin componente nuevo)', /<button id="nombreOmitir" class="go-reiniciar go-modo-libre">Omitir<\/button>/.test(html));
  chk('Omitir tocable: vive dentro de #nombre (overlay z3, por encima del canvas)', /<div id="nombre"[\s\S]*?id="nombreOmitir"[\s\S]*?<\/div>\s*<\/div>/.test(html));
  // FASE 23: la salida del nombre pasa por irAInicioOAviso (nombre → aviso → inicio).
  chk('Omitir → jugar SIN nombre (oculta #nombre y sale por irAInicioOAviso)', /function omitirNombre\(\) \{[\s\S]{0,120}elNombre\.classList\.add\('oculto'\);[\s\S]{0,60}irAInicioOAviso\(\);/.test(main));
  chk('Omitir cableado (addEventListener)', /if \(btnNombreOmitir\) btnNombreOmitir\.addEventListener\('click', omitirNombre\)/.test(main));
  chk('Omitir NO guarda nombre (no llama nombreStore.guardar)', !/function omitirNombre\(\)[\s\S]{0,200}nombreStore\.guardar/.test(main));
}

console.log('=== Dos caminos de salida y con-nombre no pide ===');
{
  chk('con nombre guardado → NO se muestra la pantalla de nombre (sale por irAInicioOAviso)', /if \(nombreUsuario\) irAInicioOAviso\(\);/.test(main));
  chk('sin nombre y con almacén → se muestra la pantalla de nombre', /else if \(puedeGuardarNombre\) mostrarPantallaNombre\(\);/.test(main));
  chk('salida por CONFIRMAR (nombre válido → irAInicioOAviso)', /function confirmarNombre\(\)[\s\S]{0,500}irAInicioOAviso\(\);/.test(main));
  chk('salida por OMITIR (sin nombre → irAInicioOAviso)', /function omitirNombre\(\)[\s\S]{0,120}irAInicioOAviso\(\);/.test(main));
}

console.log('=== TECLADO / anti-zoom iOS: campo alto 48, texto 16px, sin autofocus (intacto) ===');
{
  chk('input alto 48 y 16px', /\.nombre-input \{[\s\S]{0,220}height: 48px;[\s\S]{0,220}font: 600 16px/.test(css));
  chk('sin autofocus agresivo (no .focus() en el prompt)', !/nombreInput\.focus\(\)/.test(main));
  chk('maxlength 8', /id="nombreInput"[\s\S]{0,140}maxlength="8"/.test(html));
}

console.log(`\n== RESUMEN overlays: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
