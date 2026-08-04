// hitclaud — FASE 30: comunicación con el servidor de ranking. node test/ranking.test.js
// Lógica pura de js/ranking.js (red mockeada) + grep del cableado en main.js.

const fs = require('fs');
const R = require('../js/ranking.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

(async function () {
  const fetchReal = global.fetch;

  console.log('=== Resiliencia de red: nunca lanza, siempre resuelve ===');
  {
    global.fetch = function () { return Promise.reject(new Error('sin red')); };
    let lanzo = false, r1;
    try { r1 = await R.pedirTop('60'); } catch (e) { lanzo = true; }
    chk('un fallo de red NO lanza y resuelve {ok:false}', !lanzo && !!r1 && r1.ok === false);

    global.fetch = function () { return Promise.reject(Object.assign(new Error('abort'), { name: 'AbortError' })); };
    const r2 = await R.pedirTop('60');
    chk('un timeout/abort se maneja sin error visible ({ok:false})', r2.ok === false);

    global.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ modo: '60', top: [{ nombre: 'A', puntos: 9 }] }); } }); };
    const r3 = await R.pedirTop('60');
    chk('respuesta OK devuelve el top', r3.ok === true && r3.top.length === 1 && r3.top[0].nombre === 'A');

    global.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.reject(new Error('json malo')); } }); };
    const r4 = await R.pedirTop('60');
    chk('JSON inválido → {ok:false} (no lanza)', r4.ok === false);

    global.fetch = function () { return Promise.resolve({ ok: false, status: 500 }); };
    const r5 = await R.pedirTop('60');
    chk('HTTP no-ok (500) → {ok:false}', r5.ok === false);

    let tocoRed = false;
    global.fetch = function () { tocoRed = true; return Promise.reject(new Error()); };
    const r6 = await R.pedirTop('99');
    chk('modo inválido → {ok:false} sin tocar la red', r6.ok === false && tocoRed === false);

    global.fetch = function () { throw new Error('boom'); };
    let lanzo2 = false;
    try { R.enviarPuntaje('A', 10, '60'); R.enviarPartida(R.armarDatosPartida({ modo: '60' })); } catch (e) { lanzo2 = true; }
    chk('enviarPuntaje/enviarPartida NUNCA lanzan (fondo blindado)', lanzo2 === false);
  }

  global.fetch = fetchReal;

  console.log('=== Cuándo se manda el PUNTAJE (2.1/2.2/2.3) ===');
  {
    chk('por tiempo + supera récord + con nombre → SÍ', R.decidirEnviarPuntaje({ porTiempo: true, superaRecord: true, nombre: 'Pat' }) === true);
    chk('por CloudOver (no por tiempo) → NO (2.2)', R.decidirEnviarPuntaje({ porTiempo: false, superaRecord: true, nombre: 'Pat' }) === false);
    chk('sin nombre → NO (2.3)', R.decidirEnviarPuntaje({ porTiempo: true, superaRecord: true, nombre: '' }) === false);
    chk('nombre sólo espacios → NO', R.decidirEnviarPuntaje({ porTiempo: true, superaRecord: true, nombre: '   ' }) === false);
    chk('no supera el récord → NO', R.decidirEnviarPuntaje({ porTiempo: true, superaRecord: false, nombre: 'Pat' }) === false);
  }

  console.log('=== /partida COHERENTE y ANÓNIMO (3.4/3.6) ===');
  {
    const p = R.armarDatosPartida({ modo: '15', puntos: 500, duracionReal: 999999, termino: 'tiempo', tiros: 10, aciertos: 40, rachaMax: 7, carambolas: 99, plataforma: 'movil' });
    chk('aciertos se recorta a tiros (40 → 10)', p.aciertos === 10);
    chk('carambolas se recorta a tiros (99 → 10)', p.carambolas === 10);
    chk('duracionReal ≤ duración del modo + 30s (15s → máx 45000)', p.duracionReal === 45000);
    chk('el envío de /partida NO incluye el nombre', !('nombre' in p) && Object.keys(p).indexOf('nombre') === -1);
    chk('tiene exactamente los 9 campos esperados', Object.keys(p).sort().join(',') === 'aciertos,carambolas,duracionReal,modo,plataforma,puntos,rachaMax,termino,tiros');
    const g = R.armarDatosPartida({ modo: 'x', puntos: -5, duracionReal: -1, termino: 'raro', tiros: 2.7, aciertos: -3, rachaMax: NaN, carambolas: 'x', plataforma: 'consola' });
    chk('basura → valores saneados (modo 60, negativos/NaN a 0, termino tiempo, plataforma movil)', g.modo === '60' && g.puntos === 0 && g.duracionReal === 0 && g.termino === 'tiempo' && g.rachaMax === 0 && g.carambolas === 0 && g.plataforma === 'movil');
    chk('termino cloudover se conserva; plataforma escritorio se conserva', R.armarDatosPartida({ modo: '60', termino: 'cloudover', plataforma: 'escritorio' }).termino === 'cloudover' && R.armarDatosPartida({ modo: '60', plataforma: 'escritorio' }).plataforma === 'escritorio');
  }

  console.log('=== Iconos del podio (1/2/3 icono; 4+ número) ===');
  {
    chk('puesto 1 → assets/podio-1.svg', R.iconoDePuesto(1) === 'assets/podio-1.svg');
    chk('puesto 2 → assets/podio-2.svg', R.iconoDePuesto(2) === 'assets/podio-2.svg');
    chk('puesto 3 → assets/podio-3.svg', R.iconoDePuesto(3) === 'assets/podio-3.svg');
    chk('puesto 4 → null (usar número)', R.iconoDePuesto(4) === null);
    chk('puesto 20 → null (usar número)', R.iconoDePuesto(20) === null);
  }

  console.log('=== Cableado en main.js ===');
  {
    // Toda la red vive en ranking.js: main.js no llama fetch directamente.
    chk('main.js NO llama fetch directamente (toda la red en ranking.js)', !/[^.\w]fetch\(/.test(main));
    // Récord local se guarda ANTES y con independencia del envío; el envío va blindado.
    chk('record.terminar corre ANTES del envío al servidor', main.indexOf('record.terminar(scoreFinal') < main.indexOf('enviarAlServidor(porTiempo'));
    chk('el envío al servidor va en try/catch (la red nunca rompe el fin)', /try \{ enviarAlServidor\(porTiempo, superaRecord\); \} catch/.test(main));
    // /partida SIEMPRE; /score condicional.
    chk('/partida se manda siempre (armarDatosPartida)', /Ranking\.enviarPartida\(Ranking\.armarDatosPartida\(/.test(main));
    chk('/score sólo si decidirEnviarPuntaje', /if \(Ranking\.decidirEnviarPuntaje\([\s\S]{0,120}Ranking\.enviarPuntaje\(nombreUsuario/.test(main));
    // El nombre del servidor se inserta como TEXTO en la tabla.
    chk('el nombre en la tabla se inserta con textContent (no HTML)', /nom\.textContent = typeof e\.nombre === 'string'/.test(main) && !/rankCuerpo[\s\S]{0,200}innerHTML/.test(main));
    // Los tres estados existen (cargando, error con reintento, vacío).
    chk('estado CARGANDO', /rankEstado\('Cargando/.test(main));
    chk('estado ERROR con Reintentar', /rankEstado\('No se pudo cargar[\s\S]{0,20}true\)/.test(main) && /textContent = 'Reintentar'/.test(main));
    chk('estado VACÍO (aún no hay puntajes)', /Aún no hay puntajes/.test(main));
    // El puntaje del envío es coherente con el juego (contadores existen y se reinician).
    chk('contadores de partida existen y se reinician', /let pTiros = 0, pAciertos = 0, pRachaMax = 0, pCarambolas = 0, pPuntosFin = 0;/.test(main) && /pTiros = 0; pAciertos = 0; pRachaMax = 0; pCarambolas = 0; pPuntosFin = 0;/.test(main));
  }

  console.log('=== Overlay #ranking en el HTML con salida ===');
  {
    chk('#ranking es un overlay role="dialog"', /<div id="ranking" class="oculto" role="dialog" aria-modal="true">/.test(html));
    chk('botón Cerrar dentro de #ranking', /<button id="rankCerrar" class="go-reiniciar">Cerrar<\/button>/.test(html));
    chk('botón "Ranking" en el inicio (secundario, .ini-actu)', /<button id="verRanking" class="ini-actu">Ranking<\/button>/.test(html));
    chk('selector de 3 modos (data-modo 15/30/60)', /data-modo="15"[\s\S]*data-modo="30"[\s\S]*data-modo="60"/.test(html));
  }

  console.log(`\n== RESUMEN ranking: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
