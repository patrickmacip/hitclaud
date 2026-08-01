// hitclaud — FASE 19: pantalla de bienvenida (título + récord + JUGAR). node test/inicio.test.js

const U = require('../js/util.js');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

console.log('=== CONTENIDO: título "HitClaud", récord (estilo marcador Record), botón JUGAR ===');
{
  chk('overlay #inicio existe (role=dialog)', /<div id="inicio"[^>]*role="dialog"/.test(html));
  chk('título grande "HitClaud"', /class="ini-titulo">HitClaud</.test(html));
  chk('récord reusa el estilo del marcador Record (.marcador--record)', /class="marcador marcador--record ini-record"[\s\S]*id="iniRecord"/.test(html));
  chk('récord tiene etiqueta "Record" + valor', /ini-record[\s\S]{0,120}etiqueta">Record<[\s\S]{0,60}id="iniRecord"/.test(html));
  chk('botón JUGAR reusa la familia .go-reiniciar (no un botón nuevo)', /<button id="jugar" class="go-reiniciar ini-jugar">JUGAR<\/button>/.test(html));
}

console.log('=== MECANISMO: mismo sistema de overlays DOM que #gameover/#pausa ===');
{
  chk('#inicio en la regla .oculto de overlays', /#gameover\.oculto, #pausa\.oculto, #inicio\.oculto \{ display: none; \}/.test(css));
  chk('#inicio en la regla de posición fixed/z-index de overlays', /#gameover, #pausa, #inicio \{/.test(css));
  chk('main.js muestra/oculta #inicio con .classList (mismo mecanismo)', /elInicio\.classList\.remove\('oculto'\)/.test(main) && /elInicio\.classList\.add\('oculto'\)/.test(main));
  chk('NO hay dibujo en canvas de la pantalla (es DOM, no un mecanismo paralelo)', !/dibujarInicio|pantallaInicioCanvas/.test(main));
}

console.log('=== COMPORTAMIENTO: inicio primero, JUGAR → 60s, mundo quieto ===');
{
  chk('al cargar se llama mostrarPantallaInicio (no mostrarInicio)', /mostrarPantallaInicio\(\); \/\/ FASE 19/.test(main));
  chk('mostrarPantallaInicio deja jugando=false (mundo quieto)', /function mostrarPantallaInicio\(\) \{\s*jugando = false;/.test(main));
  chk('al cargar NO se llama iniciarPartida (sin partida corriendo)', !/iniciarPartida\([^)]*\);\s*\/\/ FASE 19|iniciarPartida[\s\S]{0,40}arrancarBucle/.test(main) && main.indexOf('iniciarPartida') < main.indexOf('mostrarPantallaInicio(); // FASE 19'));
  chk('JUGAR arranca partida de 60s (iniciarPartida(\'60\'))', /btnJugar\.addEventListener\('click'[\s\S]{0,140}iniciarPartida\('60'\)/.test(main));
  chk('DURACION_60 = 60·1000 (reloj de 60s desde cero)', /const DURACION_60 = 60 \* 1000;/.test(main));
  chk('iniciarPartida(\'60\') fija tiempoRestante = DURACION_60', /modoJuego = modo;[\s\S]{0,200}tiempoRestante = \(modo === '60'\) \? DURACION_60 : 0;/.test(main));
  chk('estado inicial jugando = false', /let jugando = false;/.test(main));
}

console.log('=== RÉCORD mostrado = el GUARDADO; robusto si el almacén falla ===');
{
  // El display usa record.valor (el guardado, reconciliado).
  chk('actualizarRecordInicio usa U.abreviarNumero(record.valor)', /function actualizarRecordInicio\(\)[\s\S]{0,200}U\.abreviarNumero\(record\.valor\)/.test(main));
  chk('reconciliación refresca el récord de inicio', /r === record[\s\S]{0,80}actualizarRecordInicio\(\)/.test(main));
  // Persistencia: el valor mostrado sale del almacenamiento.
  const local = (function () { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; })();
  local._d['hitclaud.record.v2.60'] = JSON.stringify({ record: 4242, ultimoScore: 100 });
  const p = U.crearPersistencia(local, null, 'hitclaud.record.v2.60', 500);
  chk('récord = el guardado (4242 leído del almacén)', p.valor === 4242 && U.abreviarNumero(p.valor) === '4242');
  // Almacenamiento caído → 0, sin romper.
  const pFail = U.crearPersistencia(null, null, 'hitclaud.record.v2.60', 500);
  chk('almacén nulo → record 0 (muestra 0, no rompe)', pFail.valor === 0);
  chk('actualizarRecordInicio con try/catch → 0 si algo lanza', /try \{ elIniRecord\.textContent = U\.abreviarNumero\(record\.valor\); \}\s*catch \(e\) \{ elIniRecord\.textContent = '0'; \}/.test(main));
  // El botón vive aparte del récord: su listener no depende del almacén.
  chk('el listener de JUGAR no depende del récord (siempre vivo)', /const btnJugar = document\.getElementById\('jugar'\);\s*if \(btnJugar\) btnJugar\.addEventListener/.test(main));
}

console.log('=== REGRESIÓN: el overlay de game over conserva sus botones/comportamiento ===');
{
  chk('#gameover sigue con #jugar60 (60 seg)', /<button id="jugar60" class="go-reiniciar">60 seg<\/button>/.test(html));
  chk('#gameover sigue con #jugarLibre (Relax mode)', /<button id="jugarLibre" class="go-reiniciar go-modo-libre">Relax mode<\/button>/.test(html));
  chk('los botones del game over siguen llamando iniciarPartida (no la pantalla de inicio)', /btn60\.addEventListener\('click', function \(\) \{ iniciarPartida\('60'\); \}\)/.test(main) && /btnLibre\.addEventListener\('click', function \(\) \{ iniciarPartida\('libre'\); \}\)/.test(main));
  chk('pintarFin (game over) NO muestra la pantalla de inicio', !/pintarFin[\s\S]{0,200}elInicio/.test(main));
}

console.log('=== ESTILO: acento naranja (sin hardcodear) + ley de tacto + costo ===');
{
  chk('título usa var(--acento-vivo) (naranja, no hardcode)', /\.ini-titulo \{[\s\S]{0,120}color: var\(--acento-vivo/.test(css));
  chk('botón usa var(--acento…) vía .go-reiniciar (sin hex crudo propio)', /\.go-reiniciar \{[\s\S]{0,160}background: var\(--acento/.test(css));
  chk(':active definido para JUGAR (feedback táctil)', /\.ini-jugar:active \{/.test(css));
  chk('hover SÓLO bajo @media (hover: hover)', /@media \(hover: hover\) \{\s*\.ini-jugar:hover/.test(css));
  chk('zona táctil ≥44px (min-height 56px)', /\.ini-jugar \{[\s\S]{0,120}min-height: 56px/.test(css));
  chk('sin shadowBlur/gradiente en el CSS de inicio', !/\.ini-[\s\S]{0,400}box-shadow|\.ini-[\s\S]{0,400}gradient/.test(css));
  // Bucle de dibujo intacto: sigue habiendo un solo shadowBlur (el de desktop) y ningún gradiente creado en dibujar().
  chk('el bucle de dibujo no ganó shadowBlur (sigue 1: el de desktop)', (main.match(/ctx\.shadowBlur/g) || []).length === 1);
}

console.log(`\n== RESUMEN inicio: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
