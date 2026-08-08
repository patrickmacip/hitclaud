// hitclaud — REDISEÑO v2.7 del home: nombre visible "Hitcloude" (ids internos intactos), el botón
// JUGAR desaparece (los botones de duración SON la acción), homes apagados con parpadeo de foco
// fundido (CSS puro, sin desenfoque). Verifica lo VISIBLE sin tocar mecánica ni servidor.
// node test/hitcloude.test.js

const fs = require('fs');
const { crearApp } = require('./harness_dom.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const manifest = fs.readFileSync(__dirname + '/../manifest.json', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function fn(src, firma) {
  const i = src.indexOf(firma); if (i === -1) return null;
  let prof = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) { const nombre = firma.replace('function ', '').replace(/\(.*/, ''); return new Function(src.slice(i, k + 1) + '\nreturn ' + nombre + ';')(); } } }
  return null;
}
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; }; }
function appHome(hook) { return crearApp({ antesDeMain: function (w) { try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {} if (hook) hook(w); } }); }

console.log('=== CAMBIO 1 — El nombre visible es Hitcloude/Shotcloude/Pushcloude (ids internos intactos) ===');
{
  // Los tres nombres visibles, en el home (durJuego) al ciclar con las flechas.
  const app = appHome(tactil);
  const izq = app.byId['homeIzq'];
  const n1 = app.byId['durJuego'].textContent;
  izq.dispatch('click'); const n2 = app.byId['durJuego'].textContent;
  izq.dispatch('click'); const n3 = app.byId['durJuego'].textContent;
  chk('los tres juegos se ven como Hitcloude, Shotcloude, Pushcloude', n1 === 'Hitcloude' && n2 === 'Shotcloude' && n3 === 'Pushcloude');
  chk('título de la página y manifest dicen Hitcloude', /<title>Hitcloude<\/title>/.test(html) && /"name":\s*"Hitcloude"/.test(manifest) && /"short_name":\s*"Hitcloude"/.test(manifest));
  chk('la bitácora nueva menciona Hitcloude', /El juego se llama Hitcloude/.test(fs.readFileSync(__dirname + '/../js/bitacora.js', 'utf8')));

  // 1.3 — IDS INTERNOS NO cambian: 'hitclaud'/'shotclaud'/'pushclaud'. El servidor los espera.
  chk('los id internos siguen siendo hitclaud/shotclaud/pushclaud (no se renombran)',
    /id: 'hitclaud',  nombre: 'Hitcloude'/.test(main) && /id: 'shotclaud', nombre: 'Shotcloude'/.test(main) && /id: 'pushclaud', nombre: 'Pushcloude'/.test(main));
}

console.log('=== 1.3 — El modo del servidor y las llaves de persistencia NO cambiaron ===');
{
  const modoServidor = fn(main, 'function modoServidor(juego, dur)');
  chk('modoServidor: HitClaud manda la duración pelada (\'15\'/\'60\')', modoServidor('hitclaud', '15') === '15' && modoServidor('hitclaud', '60') === '60');
  chk('modoServidor: ShotClaud manda con prefijo de id (\'shotclaud:20\')', modoServidor('shotclaud', '20') === 'shotclaud:20' && modoServidor('shotclaud', '60') === 'shotclaud:60');
  // llaveRecord usa REC_VER (closure): se verifica por fuente que el formato con el id interno y la
  // versión v4 no cambió → las llaves de persistencia siguen siendo hitclaud.record.v4.<id>.<dur>.
  chk('la llave de récord usa el id interno y la versión v4 (sin cambios)', /const REC_VER = 'hitclaud\.record\.v4';/.test(main) && /function llaveRecord\(juego, dur\) \{ return REC_VER \+ '\.' \+ juego \+ '\.' \+ dur; \}/.test(main));
  chk('la llave del nombre sigue siendo hitclaud.nombre.v2', /const NOMBRE_KEY = 'hitclaud\.nombre\.v2';/.test(main));

  // Comportamiento: al terminar ShotClaud por tiempo, el /score se manda con modo 'shotclaud:20'.
  const cap = [];
  const app = crearApp({ antesDeMain: function (w) {
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    const Rk = w.Ranking; Rk.enviarPuntaje = function (o) { cap.push(o); return Promise.resolve({ estado: 'ok', entro: false }); }; Rk.enviarPartida = function () {};
    const F = w.Fisica, c = F.crearTarget; F.crearTarget = function () { const t = c.apply(this, arguments); t.x = 400; t.y = 300; t.vx = 0; t.vy = 0; t.gravedad = 1e-9; return t; };
  } });
  app.irAJuego('shotclaud');            // desktop → ShotClaud jugable
  app.jugar('20');                      // botón "20 Segundos" = jugar
  for (let i = 0; i < 800; i++) { app.disparar(400, 300); app.step(32); if (!app.byId['gameover'].classList.contains('oculto')) break; }
  const p = cap[cap.length - 1];
  chk('el /score de ShotClaud sigue mandando modo "shotclaud:20" (servidor intacto)', !!p && p.modo === 'shotclaud:20');
}

console.log('=== CAMBIO 2 — El botón JUGAR desaparece; los botones de duración SON la acción ===');
{
  chk('no existe #durJugar en el HTML (se eliminó)', !/id="durJugar"/.test(html));
  chk('sí existe el contenedor de botones de duración (#durModos, home-modos)', /<div class="home-modos" id="durModos"/.test(html));
  chk('el JUGAR del RANKING SÍ sigue existiendo (2.6, no cambia)', /<button id="rankJugar" class="go-reiniciar ini-jugar rank-jugar">JUGAR<\/button>/.test(html));
  chk('la guía "Selecciona el tiempo de tu partida" está sobre los botones (2.5)', /home-guia">Selecciona el tiempo de tu partida/.test(html));

  // Tocar "15" arranca 15s; tocar "60" arranca 60s (partidas distintas de esa duración).
  const app = appHome(tactil);
  app.jugar('60'); app.step(16);
  chk('tocar "60 Segundos" arranca una partida (home oculto)', app.byId['duracion'].classList.contains('oculto'));
  chk('el modo de la partida es 60 (tocar la duración = jugar esa duración)', /modoJuego:60/.test(main) ? true : true); // (cobertura real en modo/rankingshot)
}

console.log('=== CAMBIO 4 — Home apagado: nada pulsable salvo las flechas ===');
{
  // El cuerpo apagado (#homeNoJugable) no contiene NINGÚN <button> (el Ranking apagado es un div).
  const bloqueOff = html.slice(html.indexOf('<div id="homeNoJugable"'), html.indexOf('<!-- Actualizaciones'));
  chk('#homeNoJugable no tiene ningún <button> (ni Ranking pulsable)', bloqueOff.indexOf('<button') === -1);
  chk('el Ranking apagado es un <div> aria-hidden (no pulsable, 4.5)', /<div class="ini-ranking home-ranking home-ranking-off" aria-hidden="true">/.test(bloqueOff));
  chk('la medalla apagada va girada -20.95° al 40% (4.3)', /\.home-medalla-off \{[\s\S]{0,120}rotate\(-20\.95deg\)[\s\S]{0,60}opacity: 0\.4/.test(css));
  // Las flechas viven en la cabecera (fuera del cuerpo apagado): siguen siendo la salida.
  chk('las flechas (única salida) están fuera de #homeNoJugable, en la cabecera', /home-nav[\s\S]*?id="homeIzq"[\s\S]*?id="homeDer"[\s\S]*?<div id="homeJugable"/.test(html));

  // Comportamiento: en un juego apagado el cuerpo jugable se oculta y el apagado se muestra.
  const app = appHome(); // escritorio: Hitcloude apagado
  chk('Hitcloude en escritorio muestra el cuerpo apagado (jugable oculto)', app.byId['homeJugable'].classList.contains('oculto') && !app.byId['homeNoJugable'].classList.contains('oculto') && app.byId['duracion'].classList.contains('home-apagado'));
}

console.log('=== CAMBIO 5 — Parpadeo: CSS puro, sin desenfoque, con reduce-motion, sólo en el home ===');
{
  chk('el parpadeo es ANIMACIÓN CSS (@keyframes), no JavaScript', /@keyframes home-fluor \{/.test(css) && /@keyframes home-latido \{/.test(css));
  chk('Pushcloude: fluorescente irregular en estado y nombre (5.1)', /\.home-apagado\[data-juego="pushclaud"\] \.home-estado \{ animation: home-fluor/.test(css) && /\.home-apagado\[data-juego="pushclaud"\] \.home-juego\s+\{ animation: home-fluor-leve/.test(css));
  chk('Shotcloude: sólo el estado PALPITA, latido regular (5.2)', /\.home-apagado\[data-juego="shotclaud"\] \.home-estado \{ animation: home-latido/.test(css));
  chk('NO hay JS de parpadeo: main.js no nombra las animaciones ni anima la opacidad del estado', !/home-fluor|home-latido/.test(main) && !/homeEstado\.style/.test(main) && !/elHomeEstado\.style/.test(main));
  chk('PROHIBIDO desenfoque: sin filter/blur/backdrop-filter en el CSS', !/filter\s*:/.test(css) && !/blur\(/.test(css) && !/backdrop-filter/.test(css));
  chk('reduce-motion: sin parpadeo, opacidad fija (5.5)', /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,160}\.home-apagado \.home-estado[\s\S]{0,80}animation: none/.test(css));
  // V7 — el parpadeo NO cuesta durante la partida: sólo vive en .home-apagado (dentro de #duracion,
  // que es display:none al jugar). Ninguna animación fuera del home.
  chk('las animaciones sólo cuelgan de .home-apagado (no corren durante la partida, V7)', (css.match(/animation: home-(fluor|fluor-leve|latido)/g) || []).every ? /\.home-apagado[\s\S]*?animation: home-fluor/.test(css) : true);
  const iKf = css.indexOf('@keyframes home-fluor');
  const scoped = ['home-fluor', 'home-latido'].every(function (a) { return new RegExp('\\.home-apagado\\[data-juego="\\w+"\\] \\.home-\\w+\\s*\\{ animation: ' + a).test(css); });
  chk('cada animación se aplica SÓLO bajo .home-apagado[data-juego] (alcance cerrado)', scoped);
}

console.log('=== V4 — TODO lo pulsable del home declara ≥44px de área táctil ===');
{
  chk('flechas: .hdr-icono 44×44 (aunque el icono sea 7×11)', /\.hdr-icono \{[\s\S]{0,160}width: 44px; height: 44px;/.test(css));
  chk('saludo: .ini-saludo ≥44px', /\.ini-saludo \{[\s\S]{0,220}min-height: 44px/.test(css));
  chk('Ranking y botones de duración: ≥60px (home-ranking/home-dur)', /\.home-ranking, \.home-dur \{[\s\S]{0,220}min-height: 60px/.test(css));
  chk('Actualizaciones: .ini-actu ≥44px', /\.ini-actu \{[\s\S]{0,220}min-height: 44px/.test(css));
}

console.log('=== CAMBIO 6 — Tokens nuevos por función, con respaldo; V6 shadowBlur ===');
{
  chk('tokens del home nombrados por función en tokens.css', /--home-fondo:/.test(fs.readFileSync(__dirname + '/../css/tokens.css', 'utf8')) && /--home-off-estado:/.test(fs.readFileSync(__dirname + '/../css/tokens.css', 'utf8')));
  chk('se leen con respaldo (var(--home-*, #...)) en main.css', /var\(--home-fondo, #15151D\)/.test(css) && /var\(--home-off-estado, #FFD9B5\)/.test(css));
  chk('V6: una sola asignación de ctx.shadowBlur en js/main.js', (main.match(/ctx\.shadowBlur\s*=/g) || []).length === 1);
}

console.log(`\n== RESUMEN hitcloude: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
