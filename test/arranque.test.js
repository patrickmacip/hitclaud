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
  chk('con nombre → mostrarPantallaInicio()', /if \(nombreUsuario\) mostrarHome\('hitclaud', true\);/.test(main));
  chk('sin nombre y con almacén → mostrarPantallaNombre()', /else if \(puedeGuardarNombre\) mostrarPantallaNombre\(\);/.test(main));
  chk('sin almacén → mostrarPantallaInicio()', /else mostrarHome\('hitclaud', true\);/.test(main));
  // Y las salidas del nombre (confirmar/omitir) también van al inicio.
  chk('confirmarNombre → mostrarPantallaInicio()', /function confirmarNombre\(\)[\s\S]{0,500}mostrarPantallaInicio\(\);/.test(main));
  chk('omitirNombre → mostrarPantallaInicio()', /function omitirNombre\(\)[\s\S]{0,150}mostrarPantallaInicio\(\);/.test(main));
  chk('reconciliación async del nombre → mostrarPantallaInicio()', /elNombre\.classList\.add\('oculto'\); mostrarPantallaInicio\(\);/.test(main));
}

console.log('=== Botón "Actualizaciones" en el HOME (al pie), secundario y cableado (2.7) ===');
{
  chk('botón #verActualizaciones con el texto "Actualizaciones"', /<button id="verActualizaciones" class="ini-actu" type="button">Actualizaciones<\/button>/.test(html));
  chk('vive dentro del HOME (#duracion), al pie', /<div id="duracion"[\s\S]*?id="verActualizaciones"[\s\S]*?<\/div>\s*<\/div>/.test(html));
  chk('NO reusa la clase de JUGAR (.ini-jugar): es secundario', !/class="[^"]*ini-jugar[^"]*"[^>]*id="verActualizaciones"/.test(html) && /class="ini-actu"/.test(html));
  chk('el estilo .ini-actu es secundario (sin relleno, texto chico apagado)', /\.ini-actu \{[\s\S]{0,160}background: transparent;/.test(css));
  chk('cableado: abre actualizaciones y oculta el home', /function abrirActualizaciones\(\) \{[\s\S]{0,200}elDuracion\.classList\.add\('oculto'\)[\s\S]{0,160}elActualizaciones\.classList\.remove\('oculto'\)/.test(main));
  chk('addEventListener del botón Actualizaciones', /btnVerActualizaciones\.addEventListener\('click', abrirActualizaciones\)/.test(main));
  chk('el home tiene JUGAR (ini-jugar); ya no hay lista de juegos', /<button id="durJugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html) && !/id="juegoLista"/.test(html));
}

console.log('=== Botón "Cerrar" de #actualizaciones existe y devuelve al inicio ===');
{
  chk('cerrar de Actualizaciones es un icono X en la cabecera (sin texto)', /<button id="actuCerrar" class="hdr-icono"[\s\S]{0,120}#ic-cerrar/.test(html) && !/>Cerrar<\/button>/.test(html.match(/<div id="actualizaciones"[\s\S]*?<\/div>\s*<\/div>/) ? html.match(/<div id="actualizaciones"[\s\S]*?<\/div>\s*<\/div>/)[0] : ''));
  chk('Cerrar cableado: oculta actualizaciones y muestra inicio', /function cerrarActualizaciones\(\) \{[\s\S]{0,160}elActualizaciones\.classList\.add\('oculto'\);\s*mostrarPantallaInicio\(\);/.test(main));
  chk('addEventListener del botón Cerrar', /btnActuCerrar\.addEventListener\('click', cerrarActualizaciones\)/.test(main));
  // El panel scrollea la lista y el botón Cerrar queda FUERA del área scrolleable.
  chk('.actu-panel es columna con max-height acotada a la ventana', /\.actu-panel \{[\s\S]{0,320}flex-direction: column;/.test(css) && /\.actu-panel \{[\s\S]{0,220}max-height: var\(--ventana-max\)/.test(css));
  chk('.actu-lista es la parte scrolleable (flex + overflow-y auto)', /\.actu-lista \{[\s\S]{0,120}overflow-y: auto;/.test(css));
  chk('el cerrar (cabecera) está ANTES de la lista → fijo, siempre visible', /id="actuCerrar"[\s\S]*?<div class="actu-lista" id="actuLista">/.test(html));
}

console.log(`\n== RESUMEN arranque: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
