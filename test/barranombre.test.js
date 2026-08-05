// hitclaud — rediseño de interfaz: el nombre SALIÓ de la barra (D2/1.6) y ahora saluda
// en la pantalla de inicio. La barra queda con tres zonas SIN etiquetas de texto (D1/P1):
// récord (izq), puntaje+tiempo (centro), salir (der). node test/barranombre.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Aísla la barra (header) del resto del documento.
const barra = (html.match(/<header class="barra">[\s\S]*?<\/header>/) || [''])[0];

console.log('=== El nombre YA NO vive en la barra ===');
{
  chk('sin #barraNombre en el HTML', !/id="barraNombre"/.test(html));
  chk('sin .marcador--nombre en el HTML ni en el CSS', !/marcador--nombre/.test(html) && !/marcador--nombre/.test(css));
  chk('la barra no contiene el nombre del jugador (ningún resto de barra-nombre)', !/barra-nombre/.test(barra) && !/barra-nombre/.test(css));
}

console.log('=== La barra NO tiene etiquetas de texto (D1/P1): ni "Record" ni "Actual" ===');
{
  // Sin rótulos VISIBLES (nodos de texto >…<). Los ids barraRecord/barraActual no cuentan.
  chk('la barra no muestra la palabra "Record" como texto', !/>\s*Record\s*</.test(barra));
  chk('la barra no muestra la palabra "Actual" como texto', !/>\s*Actual\s*</.test(barra));
  chk('la barra no usa .etiqueta (sin rótulos)', !/class="[^"]*etiqueta/.test(barra));
}

console.log('=== Tres zonas: récord (corona+número), centro (puntaje+tiempo), salir (casa) ===');
{
  chk('récord: corona + #barraRecord', /barra-record[\s\S]{0,120}#ic-corona[\s\S]{0,90}id="barraRecord"/.test(barra));
  chk('centro: puntaje #barraActual (el tiempo se movió a la marca de agua del canvas)', /barra-centro[\s\S]{0,120}id="barraActual"/.test(barra) && !/id="barraTiempo"/.test(barra));
  chk('salir: botón con icono de casa y área táctil 44×44', /id="botonSalir"[\s\S]{0,120}#ic-casa/.test(barra) && /\.barra-salir \{[\s\S]{0,120}width: 44px;[\s\S]{0,60}height: 44px;/.test(css));
  chk('el récord y el salir son tenues (bajo contraste, referencia)', /\.barra-record \{[\s\S]{0,120}color: var\(--texto-apagado/.test(css) && /\.barra-salir \{[\s\S]{0,300}color: var\(--texto-apagado/.test(css));
  chk('el puntaje del centro es blanco y dominante (texto-xl)', /\.barra-centro \.valor \{[\s\S]{0,140}color: var\(--blanco/.test(css) && /\.barra-centro \.valor \{[\s\S]{0,60}font: var\(--texto-xl\)/.test(css));
  chk('cifras de ancho fijo en el puntaje (P6)', /\.barra-centro \.valor \{[\s\S]{0,200}tabular-nums/.test(css));
}

console.log('=== El nombre saluda en el INICIO, editable ===');
{
  chk('saludo pulsable #iniSaludo con #iniSaludoTexto', /id="iniSaludo"[\s\S]{0,140}id="iniSaludoTexto"/.test(html));
  chk('el saludo lleva el icono de lápiz (editar)', /iniSaludo[\s\S]{0,160}#ic-lapiz/.test(html));
  chk('el saludo tiene área táctil ≥44px (P4)', /\.ini-saludo \{[\s\S]{0,200}min-height: 44px/.test(css));
}

console.log(`\n== RESUMEN barra-nombre: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
