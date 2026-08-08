// hitclaud — CAMBIO 4: la BARRA de juego muestra, junto a la corona y el récord, la MEDALLA si el
// jugador está entre los 12 primeros, y su NÚMERO DE PUESTO si está en el top 20; si no está en el
// ranking, sólo corona + récord. El juego NUNCA espera a la red (corona ya; se actualiza al llegar
// el dato; un fallo deja la corona). Reutiliza la consulta del home. Vale para HitClaud y ShotClaud.
// node test/barramedalla.test.js

const { crearApp } = require('./harness_dom.js');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function flush() { return new Promise(function (r) { setImmediate(r); }); }

// App con el nombre 'Pat' sembrado y Ranking.pedirTop interceptado (top controlado o fallo de red).
function appMedalla(opts) {
  opts = opts || {};
  const cap = { pidio: [] };
  const app = crearApp({ antesDeMain: function (w) {
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    if (opts.movil) w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; };
    w.Ranking.pedirTop = function (modo) {
      cap.pidio.push(modo);
      if (opts.fail) return Promise.reject(new Error('red caída'));
      return Promise.resolve({ ok: true, top: opts.top || [] });
    };
  } });
  app._cap = cap;
  return app;
}
// Top con 'Pat' en el puesto `p` (1-based); el resto son otros nombres.
function topConPat(p, largo) {
  const top = []; largo = largo || Math.max(p, 20);
  for (let i = 1; i <= largo; i++) top.push({ nombre: i === p ? 'Pat' : ('J' + i) });
  return top;
}
// Lee el estado visible de la zona de récord de la barra.
function leerBarra(app) {
  const icono = app.byId['barraRecordIcono'], puesto = app.byId['barraPuesto'];
  const hijo = icono.children[0];
  const src = hijo ? (hijo.src || (hijo._attrs && hijo._attrs.src) || '') : ''; // main.js usa img.src (propiedad)
  const esMedalla = !!hijo && hijo._tag === 'img' && /assets\/podio-\d+\.svg/.test(src);
  const esCorona = !!hijo && hijo._tag === 'svg' && !!hijo.children[0] && hijo.children[0]._attrs.href === '#ic-corona';
  return { medalla: esMedalla, corona: esCorona, src: src,
    puestoTxt: puesto.textContent, puestoOculto: puesto.classList.contains('oculto') };
}

// Hitcloude es táctil → sólo es jugable (con botones de duración) en móvil. Todas las partidas de
// Hitcloude del test se arrancan en móvil con app.jugar() (v2.7: el botón de duración = jugar).
(async function () {
  console.log('=== Top 12: la barra muestra MEDALLA (+ su puesto) (4.1) ===');
  {
    const app = appMedalla({ top: topConPat(5), movil: true }); // Pat en el 5º
    // Arranca ANTES de resolver la consulta (caché fría): la corona debe estar de inmediato.
    app.jugar();
    const antes = leerBarra(app);
    chk('la corona se pinta de INMEDIATO, antes de la red (4.3)', antes.corona && antes.puestoOculto);
    await flush();                                       // llega el dato
    const b = leerBarra(app);
    chk('cambia a la MEDALLA del puesto 5 (assets/podio-5.svg)', b.medalla && /podio-5\.svg/.test(b.src));
    chk('muestra el número de puesto "#5"', b.puestoTxt === '#5' && !b.puestoOculto);
  }

  console.log('=== Top 20 pero fuera del 12: corona + NÚMERO de puesto, sin medalla (4.1) ===');
  {
    const app = appMedalla({ top: topConPat(15), movil: true }); // Pat en el 15º
    app.jugar();
    await flush();
    const b = leerBarra(app);
    chk('sin medalla (13+ no tiene): queda la corona', b.corona && !b.medalla);
    chk('sí muestra el puesto "#15" (top 20)', b.puestoTxt === '#15' && !b.puestoOculto);
  }

  console.log('=== Fuera del ranking (21+ o ausente): sólo corona + récord (4.1) ===');
  {
    const app = appMedalla({ top: topConPat(25, 30), movil: true }); // Pat en el 25º → fuera del top 20
    app.jugar();
    await flush();
    const b = leerBarra(app);
    chk('corona sola (ni medalla ni número), es "sólo el récord"', b.corona && !b.medalla && b.puestoOculto && b.puestoTxt === '');

    const app2 = appMedalla({ top: [{ nombre: 'Otro' }, { nombre: 'Alguien' }], movil: true }); // Pat no está
    app2.jugar();
    await flush();
    const b2 = leerBarra(app2);
    chk('si el jugador NO está en la tabla → corona sola', b2.corona && !b2.medalla && b2.puestoOculto);
  }

  console.log('=== Un fallo de red deja la corona, sin lanzar excepción (4.3) ===');
  {
    let lanzo = false;
    let app;
    try {
      app = appMedalla({ fail: true, movil: true });
      app.jugar();
      await flush();
    } catch (e) { lanzo = true; }
    chk('no se lanzó ninguna excepción por el fallo de red', !lanzo);
    const b = leerBarra(app);
    chk('la barra se queda con la corona (nunca espera a la red, 4.3)', b.corona && !b.medalla && b.puestoOculto);
  }

  console.log('=== Reutiliza la consulta del home (4.4): en móvil el home de HitClaud ya la pidió ===');
  {
    const app = appMedalla({ top: topConPat(3), movil: true }); // móvil → HitClaud jugable → el home consulta al arrancar
    await flush();                                       // resuelve la consulta del home (llena la caché rankTop*)
    const antes = app._cap.pidio.length;
    chk('el home hizo la consulta al mostrarse (hay al menos una)', antes >= 1);
    app.jugar();                                        // misma clave hitclaud → debe REUSAR, no pedir otra vez
    await flush();
    chk('la barra no pide dos veces la misma tabla (reutiliza el home, 4.4)', app._cap.pidio.length === antes);
    chk('y muestra la medalla del puesto 3', leerBarra(app).medalla && /podio-3\.svg/.test(leerBarra(app).src));
  }

  console.log('=== La misma barra funciona en ShotClaud (4.6): sin caché, pide una vez y muestra medalla ===');
  {
    const shot = appMedalla({ top: topConPat(8) });     // desktop: ShotClaud jugable; el home no consulta su tabla
    await flush();
    shot.irAJuego('shotclaud');
    shot.jugar();                                        // botón de duración = jugar; sin caché → pide una vez
    await flush();
    const bs = leerBarra(shot);
    chk('ShotClaud: medalla del puesto 8 y su número "#8"', bs.medalla && /podio-8\.svg/.test(bs.src) && bs.puestoTxt === '#8');
  }

  console.log(`\n== RESUMEN barra-medalla: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
