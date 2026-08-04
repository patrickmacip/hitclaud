// hitclaud — FASE 26: arranque sin aviso emergente + pantalla de actualizaciones.
// node test/arranque.test.js  (grep de HTML/JS; sin DOM)

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== No queda rastro del aviso emergente en el arranque ===');
{
  chk('sin NOVEDADES_VERSION en main.js', !/NOVEDADES_VERSION/.test(main));
  chk('sin irAInicioOAviso en main.js', !/irAInicioOAviso/.test(main));
}

console.log('=== El arranque llega al inicio en los TRES casos de nombre ===');
{
  // Bloque de decisión de primera pantalla.
  chk('con nombre → mostrarPantallaInicio()', /if \(nombreUsuario\) mostrarPantallaInicio\(\);/.test(main));
  chk('sin nombre y con almacén → mostrarPantallaNombre()', /else if \(puedeGuardarNombre\) mostrarPantallaNombre\(\);/.test(main));
  chk('sin almacén → mostrarPantallaInicio()', /else mostrarPantallaInicio\(\);/.test(main));
  // Y las salidas del nombre (confirmar/omitir) también van al inicio.
  chk('confirmarNombre → mostrarPantallaInicio()', /function confirmarNombre\(\)[\s\S]{0,500}mostrarPantallaInicio\(\);/.test(main));
  chk('omitirNombre → mostrarPantallaInicio()', /function omitirNombre\(\)[\s\S]{0,150}mostrarPantallaInicio\(\);/.test(main));
  chk('reconciliación async del nombre → mostrarPantallaInicio()', /elNombre\.classList\.add\('oculto'\); mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== Botón "Actualizaciones" en el inicio, secundario y cableado ===');
{
  chk('botón #verActualizaciones existe en #inicio con el texto "Actualizaciones"', /<button id="verActualizaciones" class="ini-actu" type="button">Actualizaciones<\/button>/.test(html));
  chk('vive dentro del overlay #inicio, después de las tarjetas de juego', /id="juegoLista"[\s\S]{0,180}id="verActualizaciones"/.test(html));
  chk('NO reusa la clase de JUGAR (.ini-jugar): es secundario', !/class="[^"]*ini-jugar[^"]*"[^>]*id="verActualizaciones"/.test(html) && /class="ini-actu"/.test(html));
  chk('el estilo .ini-actu es secundario (sin relleno, texto chico apagado)', /\.ini-actu \{[\s\S]{0,160}background: transparent;/.test(css));
  chk('cableado: abre actualizaciones y oculta inicio', /function abrirActualizaciones\(\) \{[\s\S]{0,200}elInicio\.classList\.add\('oculto'\)[\s\S]{0,160}elActualizaciones\.classList\.remove\('oculto'\)/.test(main));
  chk('addEventListener del botón Actualizaciones', /btnVerActualizaciones\.addEventListener\('click', abrirActualizaciones\)/.test(main));
  chk('pantalla 1 con la lista de juegos; pantalla 2 con JUGAR (ini-jugar)', /id="juegoLista"/.test(html) && /<button id="durJugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html));
}

console.log('=== Botón "Cerrar" de #actualizaciones existe y devuelve al inicio ===');
{
  chk('botón #actuCerrar con texto "Cerrar"', /<button id="actuCerrar" class="go-reiniciar">Cerrar<\/button>/.test(html));
  chk('Cerrar cableado: oculta actualizaciones y muestra inicio', /function cerrarActualizaciones\(\) \{[\s\S]{0,160}elActualizaciones\.classList\.add\('oculto'\);\s*mostrarPantallaInicio\(\);/.test(main));
  chk('addEventListener del botón Cerrar', /btnActuCerrar\.addEventListener\('click', cerrarActualizaciones\)/.test(main));
  // El panel scrollea la lista y el botón Cerrar queda FUERA del área scrolleable.
  chk('.actu-panel es columna con max-height (scroll interno controlado)', /\.actu-panel \{[\s\S]{0,220}flex-direction: column;/.test(css) && /\.actu-panel \{[\s\S]{0,220}max-height:/.test(css));
  chk('.actu-lista es la parte scrolleable (flex + overflow-y auto)', /\.actu-lista \{[\s\S]{0,120}overflow-y: auto;/.test(css));
  chk('Cerrar (.go-reiniciar) está FUERA de .actu-lista → siempre visible', /<div class="actu-lista" id="actuLista"><\/div>\s*<button id="actuCerrar"/.test(html));
}

console.log(`\n== RESUMEN arranque: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
