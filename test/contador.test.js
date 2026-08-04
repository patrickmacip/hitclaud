// hitclaud — rediseño de interfaz: el temporizador (contador) se movió del canvas al DOM,
// a la barra, junto al puntaje (D3: antes estaba lejos y los targets lo tapaban). Formato
// "M:SS", cifras de ancho fijo (P6). En los últimos 5 s: rojo + latido por CSS (1.5, sin
// shadowBlur). node test/contador.test.js

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== El temporizador vive en el DOM (barra), ya NO en el canvas ===');
{
  chk('elemento #barraTiempo en la barra, apilado bajo el puntaje', /barra-centro[\s\S]{0,120}id="barraTiempo"/.test(html));
  chk('función actualizarTiempo() maneja texto y estado', /function actualizarTiempo\(\)/.test(main));
  chk('el temporizador YA NO se dibuja en el canvas (sin fillText del contador)', !/const colTimer = urgente/.test(main) && !/ctx\.font = '800 32px '/.test(main));
  chk('el contador ya no usa haloTexto ni strokeText (nunca fue del canvas otra vez)', !/haloTexto\(txt, 0, 0, colTimer/.test(main));
}

console.log('=== Formato "M:SS" y cifras de ancho fijo (P6: los números no bailan) ===');
{
  chk('formato M:SS con relleno de cero en los segundos', /Math\.floor\(seg \/ 60\) \+ ':' \+ \(seg % 60 < 10 \? '0' \+ \(seg % 60\) : seg % 60\)/.test(main));
  chk('cifras tabulares en el temporizador', /\.barra-tiempo \{[\s\S]{0,120}tabular-nums/.test(css));
  chk('tiempo tenue (color secundario) y de menor jerarquía que el puntaje', /\.barra-tiempo \{[\s\S]{0,120}color: var\(--texto-apagado/.test(css));
}

console.log('=== Últimos 5 segundos (1.5): rojo + latido, SIN shadowBlur ===');
{
  chk('umbral de 5 s marca la clase .urgente', /tiempoRestante <= 5000/.test(main));
  chk('.urgente pone el temporizador en rojo de alarma', /\.barra-tiempo\.urgente \{[\s\S]{0,80}color: var\(--tiempo-urgente/.test(css));
  chk('latido por CSS: escala 1.0 → 1.12, un ciclo por segundo (1s)', /\.barra-tiempo\.urgente \{[\s\S]{0,120}animation: lat-tiempo 1s/.test(css) && /@keyframes lat-tiempo \{[\s\S]{0,80}scale\(1\.12\)/.test(css));
  // El estado urgente destaca por COLOR + ESCALA, nunca por sombra/blur (regla dura, 1.5).
  const urgente = (css.match(/\.barra-tiempo\.urgente \{[^}]*\}/) || [''])[0];
  chk('sin box-shadow ni filter en el temporizador urgente (color + escala, nunca blur)', !/box-shadow/.test(urgente) && !/filter/.test(urgente));
}

console.log('=== El puntaje del centro (DOM) sigue con su estilo y su pop ===');
{
  chk('.barra-centro .valor blanco, texto-xl, con transición de pop', /\.barra-centro \.valor \{[\s\S]{0,220}transition: transform 0\.15s/.test(css));
  chk('el helper haloTexto sigue existiendo (lo usan los flotantes)', /function haloTexto\(/.test(main) && /if \(fl\.glow\) haloTexto\(fl\.texto, 0, 0/.test(main));
}

console.log(`\n== RESUMEN contador: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
