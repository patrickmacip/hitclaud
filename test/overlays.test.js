// hitclaud — PARIDAD de overlays + salida de emergencia del nombre.
// node test/overlays.test.js
// Ley del dueño: el test verifica el REGISTRO estructural (que el overlay esté en las
// reglas CSS correctas y quede TOCABLE), no sólo que el texto exista en el archivo.
// Rediseño de interfaz: el overlay #pausa se ELIMINÓ (el botón de salir abandona la
// partida). Quedan CINCO overlays vigentes: inicio, nombre, actualizaciones, ranking, gameover.

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

// La pantalla de selección (#inicio) se ELIMINÓ: el home de cada juego (#duracion) es el nivel único.
const ESPERADOS = ['duracion', 'nombre', 'acceso', 'actualizaciones', 'ranking', 'gameover'];

console.log('=== #pausa ELIMINADO: sin rastro en HTML, CSS ni main.js ===');
{
  chk('#pausa NO existe en el HTML', !/id="pausa"/.test(html) && idsHtml.indexOf('pausa') === -1);
  chk('#pausa NO deja reglas en el CSS', !/#pausa/.test(css));
  chk('sin #continuar ni #reiniciar (botones del menú de pausa) en el HTML', !/id="continuar"/.test(html) && !/id="reiniciar"/.test(html));
  chk('main.js no referencia el overlay de pausa', !/getElementById\('pausa'\)/.test(main) && !/\.boton-pausa/.test(main));
}

console.log('=== PARIDAD HTML ↔ CSS: cada overlay del HTML está en AMBAS reglas ===');
{
  console.log(`  HTML(role=dialog): [${idsHtml.join(', ')}]`);
  console.log(`  CSS posición z3  : [${idsPos.join(', ')}]`);
  console.log(`  CSS oculto comp. : [${idsOcu.join(', ')}]`);
  chk('los 6 overlays vigentes (duracion=home, nombre, acceso, actualizaciones, ranking, gameover)', set(idsHtml) === set(ESPERADOS));
  chk('la pantalla de selección #inicio ya NO existe (ni HTML, ni CSS, ni idsHtml)', !/id="inicio"/.test(html) && !/#inicio/.test(css) && idsHtml.indexOf('inicio') === -1);
  chk('#novedades ya NO existe en el HTML (aviso emergente retirado)', !/id="novedades"/.test(html) && idsHtml.indexOf('novedades') === -1);
  chk('#novedades NO deja reglas huérfanas en el CSS', !/#novedades/.test(css));
  chk('PARIDAD: HTML == regla de posición (nadie olvidado)', set(idsHtml) === set(idsPos));
  chk('PARIDAD: HTML == regla de ocultado compuesto', set(idsHtml) === set(idsOcu));
  chk('#nombre presente en AMBAS reglas', idsPos.indexOf('nombre') !== -1 && idsOcu.indexOf('nombre') !== -1);
}

console.log('=== Especificidad: el ocultado de CADA overlay es COMPUESTO (0-1-1-0), no genérico ===');
{
  const compuestoParaTodos = idsHtml.every(function (id) { return idsOcu.indexOf(id) !== -1; });
  chk('cada overlay tiene su #X.oculto (ninguno depende de la .oculto genérica)', compuestoParaTodos);
  chk('existe la .oculto genérica pero los overlays usan el compuesto', /^\.oculto \{ display: none; \}$/m.test(css) && idsOcu.length === 6);
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

console.log('=== SALIDA DE EMERGENCIA del nombre: "Cancelar" existe, es tocable y vuelve al inicio ===');
{
  chk('botón Cancelar en el overlay #nombre (reusa .go-reiniciar .go-modo-libre)', /<button id="nombreOmitir" class="go-reiniciar go-modo-libre">Cancelar<\/button>/.test(html));
  chk('Cancelar tocable: vive dentro de #nombre (overlay z3, por encima del canvas)', /<div id="nombre"[\s\S]*?id="nombreOmitir"[\s\S]*?<\/div>\s*<\/div>/.test(html));
  chk('Cancelar → inicio SIN cambiar nada (oculta #nombre y muestra inicio)', /function omitirNombre\(\) \{[\s\S]{0,120}elNombre\.classList\.add\('oculto'\);[\s\S]{0,60}mostrarPantallaInicio\(\);/.test(main));
  chk('Cancelar cableado (addEventListener)', /if \(btnNombreOmitir\) btnNombreOmitir\.addEventListener\('click', omitirNombre\)/.test(main));
  chk('Cancelar NO guarda nombre (no llama nombreStore.guardar)', !/function omitirNombre\(\)[\s\S]{0,200}nombreStore\.guardar/.test(main));
}

console.log('=== Dos caminos de salida y con-nombre no pide ===');
{
  chk('con nombre guardado → NO se muestra la pantalla de nombre (va al inicio)', /if \(nombreUsuario\) mostrarHome\('hitclaud', true\);/.test(main));
  chk('sin nombre y con almacén → se muestra la pantalla de nombre', /else if \(puedeGuardarNombre\) mostrarPantallaNombre\(\);/.test(main));
  chk('salida por GUARDAR (nombre válido → inicio)', /function confirmarNombre\(\)[\s\S]{0,500}mostrarPantallaInicio\(\);/.test(main));
  chk('salida por CANCELAR (sin cambios → inicio)', /function omitirNombre\(\)[\s\S]{0,120}mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== TECLADO / anti-zoom iOS: campo alto 48, texto 16px, sin autofocus (intacto) ===');
{
  chk('input alto 48 y 16px', /\.nombre-input \{[\s\S]{0,220}height: 48px;[\s\S]{0,220}font: 600 16px/.test(css));
  chk('sin autofocus agresivo (no .focus() en el prompt)', !/nombreInput\.focus\(\)/.test(main));
  chk('maxlength 8', /id="nombreInput"[\s\S]{0,140}maxlength="8"/.test(html));
}

console.log('=== LEY: los SEIS overlays vigentes tienen salida (nunca un callejón sin salida) ===');
{
  const salidas = {
    nombre: /id="nombreOmitir"|id="nombreOk"/,
    duracion: /id="homeIzq"|id="homeDer"|id="verActualizaciones"/, // home: flechas (ciclan) + Actualizaciones
    acceso: /id="accesoCerrar"/,                                    // puerta de acceso anticipado: Cerrar → home
    actualizaciones: /id="actuCerrar"/,
    ranking: /id="rankCerrar"/,
    gameover: /id="finJugarDeNuevo"|id="finMenu"/,
  };
  Object.keys(salidas).forEach(function (id) {
    chk('#' + id + ' tiene botón de salida', salidas[id].test(html));
  });
}

console.log(`\n== RESUMEN overlays: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
