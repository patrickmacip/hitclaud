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

  console.log('=== CAMBIO 1: el registro del último envío refleja los SEIS casos ===');
  {
    limpiarPend();
    // (a) no-intentado por CloudOver (1.2)
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '60', porTiempo: false });
    chk('CloudOver → no-intentado / cloudover', R.ultimoEnvio().estado === 'no-intentado' && R.ultimoEnvio().motivo === 'cloudover');
    // (b) no-intentado por falta de nombre (1.3)
    await R.enviarPuntaje({ nombre: '   ', puntos: 100, modo: '60', porTiempo: true });
    chk('sin nombre → no-intentado / sin-nombre', R.ultimoEnvio().motivo === 'sin-nombre');
    // (c) no-intentado por puntaje cero/negativo (1.4)
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 0, modo: '60', porTiempo: true });
    chk('cero puntos → no-intentado / cero', R.ultimoEnvio().estado === 'no-intentado' && R.ultimoEnvio().motivo === 'cero');
    // (d) se intentó y falló la red — POR TIEMPO, SIN pasar superaRecord (1.5)
    global.fetch = function () { return Promise.reject(new Error('sin red')); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '15', porTiempo: true });
    chk('red caída → estado fallo-red', R.ultimoEnvio().estado === 'fallo-red');
    // (e) se intentó y el servidor devolvió error
    global.fetch = function () { return Promise.resolve({ ok: false, status: 500, json: function () { return Promise.resolve({}); } }); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 100, modo: '30', porTiempo: true });
    chk('error del servidor → estado error-servidor (status 500)', R.ultimoEnvio().estado === 'error-servidor' && R.ultimoEnvio().status === 500);
    // (f) se intentó y funcionó
    global.fetch = function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entro: true, posicion: 3 }); } }); };
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 999, modo: '60', porTiempo: true });
    chk('éxito → estado ok, entro true, posicion 3', R.ultimoEnvio().estado === 'ok' && R.ultimoEnvio().entro === true && R.ultimoEnvio().posicion === 3);
    global.fetch = fetchReal;
  }

  console.log('=== CAMBIO 1.5: por tiempo SIEMPRE se manda, supere o no el récord ===');
  {
    limpiarPend();
    let cuerpoEnviado = null;
    global.fetch = function (url, opt) {
      try { cuerpoEnviado = JSON.parse(opt.body); } catch (e) {}
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ entro: false }); } });
    };
    // superaRecord:false pero por tiempo y con nombre y puntos>0 → SE MANDA igual.
    await R.enviarPuntaje({ nombre: 'Pat', puntos: 42, modo: '15', porTiempo: true, superaRecord: false });
    chk('por tiempo sin superar récord → SÍ se intenta (estado ok)', R.ultimoEnvio().estado === 'ok');
    chk('el POST llevó el puntaje de esa partida (42)', cuerpoEnviado && cuerpoEnviado.puntos === 42);
    chk('superaRecord ya NO se pasa al cuerpo del POST', cuerpoEnviado && !('superaRecord' in cuerpoEnviado));
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
    chk('por tiempo + nombre + puntos>0 → sí', R.decidirEnviarPuntaje({ porTiempo: true, nombre: 'Pat', puntos: 100 }) === true);
    chk('motivo cloudover', R.motivoNoEnvio({ porTiempo: false, nombre: 'Pat', puntos: 100 }) === 'cloudover');
    chk('motivo sin-nombre', R.motivoNoEnvio({ porTiempo: true, nombre: '', puntos: 100 }) === 'sin-nombre');
    chk('motivo cero (0 puntos)', R.motivoNoEnvio({ porTiempo: true, nombre: 'Pat', puntos: 0 }) === 'cero');
    chk('motivo cero (puntos negativos)', R.motivoNoEnvio({ porTiempo: true, nombre: 'Pat', puntos: -5 }) === 'cero');
    chk('sin motivo (null) cuando corresponde', R.motivoNoEnvio({ porTiempo: true, nombre: 'Pat', puntos: 100 }) === null);
    // 1.5: superaRecord ya NO participa — con o sin él, y sea true o false, el resultado es el mismo.
    chk('superaRecord:false NO bloquea (sigue null)', R.motivoNoEnvio({ porTiempo: true, nombre: 'Pat', puntos: 100, superaRecord: false }) === null);
    chk('el récord ya no es condición: no existe el motivo no-supera-record', R.motivoNoEnvio({ porTiempo: true, nombre: 'Pat', puntos: 100, superaRecord: false }) !== 'no-supera-record');
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
    chk('el envío va en try/catch (la red nunca rompe el fin)', /try \{ enviarAlServidor\(porTiempo\); \} catch/.test(main));
    chk('/partida siempre; /score SIEMPRE que sea porTiempo (ya no depende del récord)', /Ranking\.enviarPartida\(Ranking\.armarDatosPartida\(/.test(main) && /if \(porTiempo\) \{[\s\S]{0,260}Ranking\.enviarPuntaje\(/.test(main));
    chk('el /score ya NO pasa superaRecord en el cuerpo', !/Ranking\.enviarPuntaje\(\{[^}]*superaRecord/.test(main));
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
