// hitclaud — FASE 26: RETIRO del aviso emergente de novedades. node test/novedades.test.js
// Antes esta prueba verificaba el overlay #novedades y U.decidirAviso. El aviso se
// retiró (nunca era alcanzable: la rama 'mostrar' exigía una versión previa guardada,
// imposible porque la llave nació con '1.0'). Ahora esta prueba GUARDA el retiro: que
// el overlay y su lógica ya no existan, sin borrar la función pura ni la llave sellada.

const fs = require('fs');
const U = require('../js/util.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El overlay emergente #novedades ya NO existe ===');
{
  chk('sin #novedades en el HTML', !/id="novedades"/.test(html));
  chk('sin botón "Entendido" (novedadesOk) en el HTML', !/id="novedadesOk"/.test(html));
  chk('sin reglas #novedades en el CSS (nada huérfano)', !/#novedades/.test(css));
  chk('sin estilos .nov- huérfanos en el CSS', !/\.nov-/.test(css));
}

console.log('=== La lógica del aviso salió de main.js ===');
{
  chk('sin NOVEDADES_VERSION en main.js', !/NOVEDADES_VERSION/.test(main));
  chk('sin NOVEDADES_KEY en main.js', !/NOVEDADES_KEY/.test(main));
  chk('sin novedadesStore (no se lee ni escribe la llave)', !/novedadesStore/.test(main));
  chk('sin irAInicioOAviso / cerrarNovedades', !/irAInicioOAviso|cerrarNovedades/.test(main));
  chk('main.js ya no llama a U.decidirAviso', !/U\.decidirAviso/.test(main));
  chk('el arranque va directo al inicio (nombre → inicio)', /if \(nombreUsuario\) mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== SELLADO: la función pura y la llave NO se borraron ===');
{
  // util.js está fuera del alcance: decidirAviso queda como código muerto documentado.
  chk('U.decidirAviso sigue existiendo en util.js (código muerto, no borrado)', typeof U.decidirAviso === 'function');
  chk('U.decidirAviso conserva su comportamiento (null → guardar-silencio)', U.decidirAviso(null, '1.0') === 'guardar-silencio');
  // La llave hitclaud.novedades.v1 queda huérfana en el almacén, NO se borra: main.js
  // simplemente dejó de nombrarla (no hay delete/removeItem de esa llave).
  chk('main.js no borra la llave de novedades (persistencia sellada)', !/removeItem\(['"]hitclaud\.novedades/.test(main) && !/delete[\s\S]{0,40}hitclaud\.novedades/.test(main));
}

console.log(`\n== RESUMEN novedades (retiro): ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
