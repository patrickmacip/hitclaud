// hitclaud — FASE 23 commit C: aviso de novedades, UNA sola vez por actualización.
// node test/novedades.test.js  (lógica pura U.decidirAviso + grep de HTML/CSS/JS)

const fs = require('fs');
const U = require('../js/util.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== DECISIÓN pura U.decidirAviso(versionVista, versionActual) ===');
{
  // Usuario NUEVO: nada guardado (null / undefined / '') → NO mostrar, guardar en
  // silencio la versión actual (verá el aviso a partir de la PRÓXIMA).
  chk('nada guardado (null) → guardar-silencio (usuario nuevo, NO muestra)', U.decidirAviso(null, '1.0') === 'guardar-silencio');
  chk('nada guardado (undefined) → guardar-silencio', U.decidirAviso(undefined, '1.0') === 'guardar-silencio');
  chk('nada guardado ("") → guardar-silencio', U.decidirAviso('', '1.0') === 'guardar-silencio');
  // Venía de una versión anterior → MOSTRAR una vez.
  chk('versión vista distinta ("0.9") → mostrar', U.decidirAviso('0.9', '1.0') === 'mostrar');
  chk('versión vista distinta ("1.0" vs "2.0") → mostrar', U.decidirAviso('1.0', '2.0') === 'mostrar');
  // Ya vio esta versión → NADA.
  chk('versión vista == actual → nada (ya la vio, no vuelve)', U.decidirAviso('1.0', '1.0') === 'nada');
  chk('determinista y sin efectos (misma entrada, misma salida)', U.decidirAviso('0.9', '1.0') === U.decidirAviso('0.9', '1.0'));
}

console.log('=== VERSION única + llave del double-store (declaradas) ===');
{
  chk('NOVEDADES_VERSION es una constante única', /const NOVEDADES_VERSION = '1\.0';/.test(main));
  chk('LLAVE del último visto declarada (hitclaud.novedades.v1)', /const NOVEDADES_KEY = 'hitclaud\.novedades\.v1';/.test(main));
  chk('usa el DOUBLE-STORE (crearTextoPersistente: localStorage + IndexedDB)', /const novedadesStore = U\.crearTextoPersistente\(almacen, idbKV, NOVEDADES_KEY\);/.test(main));
  chk('lee la versión vista de forma síncrona inicial', /let versionVista = novedadesStore\.valor;/.test(main));
}

console.log('=== OVERLAY #novedades: registrado como overlay REAL (ley fase-22) ===');
{
  chk('#novedades es un div role="dialog" (overlay)', /<div id="novedades" class="oculto" role="dialog" aria-modal="true">/.test(html));
  chk('reusa .go-panel y el botón .go-reiniciar (sin componentes nuevos)', /<div id="novedades"[\s\S]{0,600}class="go-panel"[\s\S]{0,600}id="novedadesOk" class="go-reiniciar"/.test(html));
  // Registrado en AMBAS reglas CSS de overlay (el bug clásico: olvidarlo en una).
  chk('#novedades en la regla de OCULTADO compuesto (#X.oculto)', /#novedades\.oculto/.test(css) && /#gameover\.oculto,[^{]*#novedades\.oculto \{ display: none; \}/.test(css));
  chk('#novedades en la regla de POSICIÓN (position:fixed; z-index:3)', /#gameover, #pausa, #inicio, #nombre, #novedades \{/.test(css));
  // La paridad completa la valida overlays.test.js; aquí basta con confirmar el registro.
}

console.log('=== CONTENIDO textual fijo (título, intro, 4 puntos) ===');
{
  chk('título "Actualización 1.0"', /<p class="ini-titulo">Actualización 1\.0<\/p>/.test(html));
  chk('intro presente', /<p class="nov-intro">Novedades de esta versión:<\/p>/.test(html));
  const items = [...html.matchAll(/<li>([^<]+)<\/li>/g)].map(function (m) { return m[1]; });
  // Los 4 puntos del aviso (los <li> del juego que no son de listas ajenas: aquí la única <ul> con <li> es #novedades).
  chk('exactamente 4 puntos en la lista de novedades', items.length === 4);
  chk('botón de cierre "Entendido"', /<button id="novedadesOk" class="go-reiniciar">Entendido<\/button>/.test(html));
}

console.log('=== ORDEN nombre → aviso → inicio (nunca dos a la vez) ===');
{
  // irAInicioOAviso es el único camino al inicio tras el nombre/carga.
  chk('irAInicioOAviso existe y usa U.decidirAviso', /function irAInicioOAviso\(\) \{[\s\S]{0,200}U\.decidirAviso\(versionVista, NOVEDADES_VERSION\)/.test(main));
  chk('confirmar nombre → irAInicioOAviso (no salta el aviso)', /function confirmarNombre\(\)[\s\S]{0,500}irAInicioOAviso\(\);/.test(main));
  chk('omitir nombre → irAInicioOAviso', /function omitirNombre\(\)[\s\S]{0,150}irAInicioOAviso\(\);/.test(main));
  chk('carga con nombre → irAInicioOAviso (no directo a inicio)', /if \(nombreUsuario\) irAInicioOAviso\(\);/.test(main));
  chk('mostrar el aviso OCULTA nada nuevo pero sólo se abre uno (cada paso cierra el suyo)', /elNombre\.classList\.add\('oculto'\);[\s\S]{0,60}irAInicioOAviso\(\)/.test(main));
  // 'mostrar' abre #novedades; los otros dos casos van a inicio.
  chk("caso 'mostrar' → abre #novedades y corta (return)", /accion === 'mostrar'\) \{ if \(elNovedades\) elNovedades\.classList\.remove\('oculto'\); return; \}/.test(main));
}

console.log('=== USUARIO NUEVO: no muestra, guarda en silencio ===');
{
  chk("'guardar-silencio' guarda la versión actual y va a inicio (sin mostrar)", /accion === 'guardar-silencio'\) \{\s*versionVista = NOVEDADES_VERSION;\s*try \{ novedadesStore\.guardar\(NOVEDADES_VERSION\);[\s\S]{0,80}\}\s*\}\s*mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== CIERRE: botón, guarda el visto, SIEMPRE se cierra aunque falle ===');
{
  chk('cerrarNovedades cableado al botón (addEventListener)', /btnNovedadesOk\.addEventListener\('click', cerrarNovedades\)/.test(main));
  chk('al cerrar guarda la versión vista (no vuelve hasta la próxima)', /function cerrarNovedades\(\) \{\s*versionVista = NOVEDADES_VERSION;\s*try \{ novedadesStore\.guardar\(NOVEDADES_VERSION\);/.test(main));
  chk('SIEMPRE se cierra aunque el guardado falle (try/catch, luego oculta y va a inicio)', /function cerrarNovedades\(\)[\s\S]{0,260}catch \(e\)[\s\S]{0,80}elNovedades\.classList\.add\('oculto'\);\s*mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== MANTENIMIENTO documentado (cómo publicar la próxima versión) ===');
{
  chk('main.js documenta subir NOVEDADES_VERSION + cambiar el contenido', /MANTENIMIENTO:[\s\S]{0,160}subir NOVEDADES_VERSION[\s\S]{0,120}#novedades/.test(main));
  chk('index.html documenta el mismo mantenimiento junto al overlay', /Para publicar la próxima versión: subir NOVEDADES_VERSION/.test(html));
}

console.log(`\n== RESUMEN novedades: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
