// hitclaud — FASE 23 commit 1: nombre al CENTRO de la barra, entre Record y Actual.
// node test/barranombre.test.js

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El nombre vive en un contenedor CENTRAL, entre Record y Actual ===');
{
  // Ya NO está dentro de marcador--record.
  chk('el nombre salió del marcador Record', !/marcador--record">[\s\S]{0,120}id="barraNombre"/.test(html));
  // Tiene su propio contenedor .marcador--nombre, en DOM entre record y actual.
  chk('contenedor propio .marcador--nombre con #barraNombre', /<div class="marcador marcador--nombre">\s*<span class="etiqueta barra-nombre" id="barraNombre"><\/span>\s*<\/div>/.test(html));
  chk('orden DOM: record → nombre → actual', /marcador--record"[\s\S]*?marcador--nombre"[\s\S]*?marcador--actual"/.test(html));
  // Posicionado al centro-izquierda (25%), entre Record (izq) y Actual (centro 50%).
  chk('.marcador--nombre posicionado en 25% (entre Record y Actual)', /\.marcador--nombre \{[\s\S]{0,120}position: absolute;[\s\S]{0,60}left: 25%;/.test(css));
  chk('tipografía de etiqueta reusada (.etiqueta) con tono claro', /\.marcador--nombre \.etiqueta \{ color: var\(--acento-claro/.test(css) && /\.marcador \.etiqueta \{\s*font: var\(--texto-s\)/.test(css));
}

console.log('=== Con 8 caracteres cabe completo, NO se recorta ===');
{
  chk('no-wrap (una línea, no rompe)', /\.barra-nombre \{ white-space: nowrap; \}/.test(css));
  chk('sin overflow:hidden ni text-overflow que corte el nombre', !/barra-nombre[\s\S]{0,160}overflow:\s*hidden|barra-nombre[\s\S]{0,160}text-overflow/.test(css) && !/marcador--nombre[\s\S]{0,160}overflow:\s*hidden/.test(css));
  chk('sin max-width que recorte', !/marcador--nombre[\s\S]{0,160}max-width|barra-nombre[\s\S]{0,160}max-width/.test(css));
}

console.log('=== Sin nombre: la barra NO se descuadra ===');
{
  // Absoluto → no ocupa flujo (con o sin nombre el layout de Record/Actual/Pausa no cambia).
  chk('.marcador--nombre es absoluto → no afecta el flujo de la barra', /\.marcador--nombre \{[\s\S]{0,60}position: absolute;/.test(css));
  chk('vacío = texto oculto (.barra-nombre:empty display none)', /\.barra-nombre:empty \{ display: none; \}/.test(css));
}

console.log(`\n== RESUMEN barra-nombre: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
