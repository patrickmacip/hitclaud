// hitclaud — FASE 31: envío del ranking visible, con reintento y confirmación.
// node test/ranking.test.js  (lógica pura de ranking.js con red mockeada + grep de main.js)

const fs = require('fs');
const R = require('../js/ranking.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function tick() { return new Promise(function (r) { setTimeout(r, 15); }); }
function limpiarPend() { R.MODOS.forEach(function (m) { R._borrarPendiente(m); }); }

(async function () {
  const fetchReal = global.fetch;

  console.log('=== 1.3: el registro del último envío refleja los SEIS casos ===');
  {
    limpiarPend();
    // (a) no-intentado por CloudOver
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '60', porTiempo: false, superaRecord: true });
    chk('CloudOver → no-intentado / cloudover', R.ultimoEnvio().estado === 'no-intentado' && R.ultimoEnvio().motivo === 'cloudover');
    // (b) no-intentado por no superar récord
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '60', porTiempo: true, superaRecord: false });
    chk('no supera récord → no-intentado / no-supera-record', R.ultimoEnvio().motivo === 'no-supera-record');
    // (c) no-intentado por falta de nombre
    await R.enviarPuntaje({ nombre: '   ', puntos: 100, modo: '60', porTiempo: true, superaRecord: true });
    chk('sin nombre → no-intentado / sin-nombre', R.ultimoEnvio().motivo === 'sin-nombre');
    // (d) se intentó y falló la red
    global.fetch = function () { return Promise.reject(new Error('sin red')); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '15', porTiempo: true, superaRecord: true });
    chk('red caída → estado fallo-red', R.ultimoEnvio().estado === 'fallo-red');
    // (e) se intentó y el servidor devolvió error
    global.fetch = function () { return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } }); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '30', porTiempo: true, superaRecord: true });
    chk('error del servidor → estado error-servidor (status 500)', R.ultimoEnvio().estado === 'error-servidor' && R.ultimoEnvio().status === 500);
    // (f) se intentó y funcionó
    global.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entro: true, posicion: 3 }); } }); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 999, modo: '60', porTiempo: true, superaRecord: true });
    chk('éxito → estado ok, entro true, posicion 3', R.ultimoEnvio().estado === 'ok' && R.ultimoEnvio().entro === true && R.ultimoEnvio().posicion === 3);
    global.fetch = fetchReal;
  }

  console.log('=== Un fallo de red no lanza ni bloquea nada ===');
  {
    global.fetch = function () { throw new Error('boom'); };
    let lanzo = false;
    try { await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '15', porTiempo: true, superaRecord: true }); R.enviarPartida(R.armarDatosPartida({ modo: '60' })); R.reintentarPendientes(); } catch (e) { lanzo = true; }
    chk('enviarPuntaje/enviarPartida/reintentarPendientes NUNCA lanzan', lanzo === false);
    global.fetch = fetchReal;
  }

  console.log('=== 3.3/3.4/3.5: pendientes (guardar el mejor, reintentar, borrar) ===');
  {
    limpiarPend();
    // Un envío fallido guarda un pendiente.
    global.fetch = function () { return Promise.reject(new Error('sin red')); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 300, modo: '15', porTiempo: true, superaRecord: true });
    chk('un envío fallido guarda un pendiente', R._leerPendiente('15') && R._leerPendiente('15').puntos === 300);
    // Sólo UN pendiente por modo, el MEJOR.
    R._guardarPendiente({ nombre: 'Pat', puntos: 100, modo: '15' }); // peor → se ignora
    chk('un puntaje peor NO reemplaza al pendiente (sigue 300)', R._leerPendiente('15').puntos === 300);
    R._guardarPendiente({ nombre: 'Pat', puntos: 500, modo: '15' }); // mejor → reemplaza
    chk('un puntaje mejor SÍ reemplaza (ahora 500)', R._leerPendiente('15').puntos === 500);
    chk('sólo un pendiente por modo (no una cola)', R.pendientes().filter(function (p) { return p.modo === '15'; }).length === 1);
    // Reintento al arrancar: con la red OK, el pendiente se manda y se borra.
    global.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entro: true, posicion: 1 }); } }); };
    R.reintentarPendientes();
    await tick();
    chk('un pendiente enviado con éxito se borra', R._leerPendiente('15') === null);
    global.fetch = fetchReal;
  }

  console.log('=== decidirEnviarPuntaje / motivoNoEnvio (puros) ===');
  {
    chk('por tiempo + supera + nombre → sí', R.decidirEnviarPuntaje({ porTiempo: true, superaRecord: true, nombre: 'Pat' }) === true);
    chk('motivo cloudover', R.motivoNoEnvio({ porTiempo: false, superaRecord: true, nombre: 'Pat' }) === 'cloudover');
    chk('motivo no-supera-record', R.motivoNoEnvio({ porTiempo: true, superaRecord: false, nombre: 'Pat' }) === 'no-supera-record');
    chk('motivo sin-nombre', R.motivoNoEnvio({ porTiempo: true, superaRecord: true, nombre: '' }) === 'sin-nombre');
    chk('sin motivo (null) cuando corresponde', R.motivoNoEnvio({ porTiempo: true, superaRecord: true, nombre: 'Pat' }) === null);
  }

  console.log('=== /partida coherente y anónimo + iconos ===');
  {
    const p = R.armarDatosPartida({ modo: '15', puntos: 500, duracionReal: 999999, tiros: 10, aciertos: 40, carambolas: 99, rachaMax: 7, termino: 'tiempo', plataforma: 'movil' });
    chk('aciertos≤tiros, carambolas≤tiros, dur≤modo+30s', p.aciertos === 10 && p.carambolas === 10 && p.duracionReal === 45000);
    chk('/partida NO incluye el nombre', Object.keys(p).indexOf('nombre') === -1);
    chk('iconos: 1/2/3 con svg, 4 y 20 null', R.iconoDePuesto(1) === 'assets/podio-1.svg' && R.iconoDePuesto(3) === 'assets/podio-3.svg' && R.iconoDePuesto(4) === null && R.iconoDePuesto(20) === null);
  }

  console.log('=== ranking.js: sin keepalive; log consultable ===');
  {
    const rjs = fs.readFileSync(__dirname + '/../js/ranking.js', 'utf8');
    chk('el POST ya NO usa la opción keepalive', !/keepalive:/.test(rjs));
    chk('hay UN reintento (_postConReintento)', /_postConReintento/.test(rjs) && /_postUna\(ruta, cuerpo\)\.then\(function \(r\) \{ return r\.ok \? r : _postUna/.test(rjs));
    chk('ultimoEnvio() expuesto para la consola', typeof R.ultimoEnvio === 'function');
  }

  console.log('=== Cableado en main.js (vía A: nombre; confirmación; reintento) ===');
  {
    chk('main.js NO llama fetch directamente', !/[^.\w]fetch\(/.test(main));
    chk('record.terminar corre ANTES del envío', main.indexOf('record.terminar(scoreFinal') < main.indexOf('enviarAlServidor(porTiempo'));
    chk('el envío va en try/catch (la red nunca rompe el fin)', /try \{ enviarAlServidor\(porTiempo, superaRecord\); \} catch/.test(main));
    chk('/partida siempre; /score sólo si porTiempo && superaRecord', /Ranking\.enviarPartida\(Ranking\.armarDatosPartida\(/.test(main) && /if \(porTiempo && superaRecord\) \{[\s\S]{0,260}Ranking\.enviarPuntaje\(/.test(main));
    chk('vía A: resolverNombre relee localStorage y reconcilia IDB', /function resolverNombre\(cb\)[\s\S]{0,320}nombreStore\.valor[\s\S]{0,200}nombreStore\.reconciliar\(\)/.test(main));
    chk('el envío del puntaje resuelve el nombre ANTES de mandar', /resolverNombre\(function \(nombre\) \{[\s\S]{0,200}Ranking\.enviarPuntaje\(\{ nombre: nombre/.test(main));
    chk('confirmación sólo si entró y el fin sigue visible', /function mostrarConfirmacionRanking\(posicion\)[\s\S]{0,160}elGameOver\.classList\.contains\('oculto'\)/.test(main) && /reg\.estado === 'ok' && reg\.entro\) mostrarConfirmacionRanking/.test(main));
    chk('reintento de pendientes al arrancar', /Ranking\.reintentarPendientes\(\)/.test(main));
    chk('elemento go-rank en el overlay de fin, oculto por defecto', /<p class="go-rank oculto"><\/p>/.test(html));
    chk('go-rank se re-oculta en cada fin (pintarFin)', /function pintarFin[\s\S]{0,400}go-rank[\s\S]{0,60}add\('oculto'\)/.test(main));
  }

  console.log(`\n== RESUMEN ranking: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
