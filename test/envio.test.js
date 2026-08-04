// hitclaud — test del estado del envío al ranking en el overlay de fin (DIAGNÓSTICO
// TEMPORAL). node test/envio.test.js
//
// Extrae la función PURA estadoEnvioTexto(reg) del código de main.js (sin DOM) y verifica
// que los siete estados se traducen a su texto llano. Además comprueba el cableado mínimo:
// elemento .go-envio en el overlay, su reseteo en pintarFin, y el pintado (enviando… →
// resolución) en enviarAlServidor.

const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(desc, cond) { console.log(`  ${desc}  ${cond ? 'OK ✓' : 'NO ✗'}`); if (cond) ok++; else ko++; }

// ── Extrae el cuerpo de estadoEnvioTexto por conteo de llaves (robusto a anidamiento) ──
function extraerFuncion(src, firma) {
  const i = src.indexOf(firma);
  if (i === -1) return null;
  let j = src.indexOf('{', i), prof = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') prof++;
    else if (src[k] === '}') { prof--; if (prof === 0) return src.slice(i, k + 1); }
  }
  return null;
}

console.log('=== estadoEnvioTexto: los siete estados a texto llano ===');
{
  const fuente = extraerFuncion(main, 'function estadoEnvioTexto(reg)');
  chk('estadoEnvioTexto existe y es extraíble', !!fuente);
  let f = function () { return ''; };
  if (fuente) f = new Function(fuente + '\nreturn estadoEnvioTexto;')();

  chk('no se intentó: no terminó por tiempo',
    f({ estado: 'no-intentado', motivo: 'cloudover' }) === 'no se intentó: no terminó por tiempo');
  chk('no se intentó: no superó tu récord',
    f({ estado: 'no-intentado', motivo: 'no-supera-record' }) === 'no se intentó: no superó tu récord');
  chk('no se intentó: sin nombre',
    f({ estado: 'no-intentado', motivo: 'sin-nombre' }) === 'no se intentó: sin nombre');
  chk('falló: sin conexión',
    f({ estado: 'fallo-red' }) === 'falló: sin conexión');
  {
    const t = f({ estado: 'error-servidor', status: 400 });
    chk('falló: el servidor rechazó (con el código/mensaje del servidor)',
      /^falló: el servidor rechazó \(400/.test(t));
  }
  chk('enviado: entró en el puesto N',
    f({ estado: 'ok', entro: true, posicion: 3 }) === 'enviado: entró en el puesto 3');
  chk('enviado: no entró al top 20',
    f({ estado: 'ok', entro: false }) === 'enviado: no entró al top 20');

  // estados auxiliares
  chk('enviando… mientras espera respuesta', f({ estado: 'enviando' }) === 'enviando…');
  chk('sin registro → cadena vacía (no se pinta nada)', f({ estado: 'ninguno' }) === '' && f(null) === '');
}

console.log('\n=== Cableado del overlay de fin ===');
{
  chk('elemento .go-envio en el overlay, oculto por defecto', /<p class="go-envio oculto"><\/p>/.test(html));
  chk('pintarFin re-oculta y limpia .go-envio en cada fin',
    /function pintarFin[\s\S]{0,600}go-envio[\s\S]{0,80}add\('oculto'\)/.test(main));
  chk('enviarAlServidor muestra "enviando" antes de resolver',
    /pintarEstadoEnvio\(\{ estado: 'enviando' \}\)/.test(main));
  chk('la vía de puntaje repinta con el registro al resolver',
    /\.then\(function \(reg\) \{ pintarEstadoEnvio\(reg\);/.test(main));
  chk('la vía de no-envío repinta con el motivo registrado',
    /\.then\(pintarEstadoEnvio\)/.test(main));
  chk('lee lo YA registrado (Ranking.ultimoEnvio) — no cambia la lógica de envío',
    typeof require('../js/ranking.js').ultimoEnvio === 'function');
  chk('estilo .go-envio presente (texto discreto)', /\.go-envio\s*\{/.test(css));
}

console.log(`\n== RESUMEN envio: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
