// hitclaud — ACCESO ANTICIPADO a Pushcloude con clave (v2.8): la puerta, el distintivo ADMIN, y
// Pushcloude jugable SÓLO con clave (desde v2.9 ya tiene mecánica; el envío al ranking sigue
// inactivo hasta que el servidor acepte 60/180). Verifica comportamiento en Node. node test/acceso.test.js

const fs = require('fs');
const { crearApp } = require('./harness_dom.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function fn(src, firma) {
  const i = src.indexOf(firma); if (i === -1) return null;
  let prof = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') prof++; else if (src[k] === '}') { prof--; if (prof === 0) { const nombre = firma.replace('function ', '').replace(/\(.*/, ''); return new Function(src.slice(i, k + 1) + '\nreturn ' + nombre + ';')(); } } }
  return null;
}
function tactil(w) { w.matchMedia = function (q) { return { matches: false, addListener: function () {}, addEventListener: function () {}, media: q }; }; }
// App con nombre Pat. `movil` → táctil (Pushcloude jugable con acceso). `acceso` → marca ya guardada
// (simula recarga). `romperStorage` → localStorage que lanza (fallo de almacenamiento).
function app(opts) {
  opts = opts || {};
  const cap = { puntaje: [], partida: [], pidio: [] };
  const a = crearApp({ antesDeMain: function (w) {
    if (opts.movil) tactil(w);
    if (opts.romperStorage) { w.localStorage = { getItem: function () { throw new Error('roto'); }, setItem: function () { throw new Error('roto'); }, removeItem: function () {} }; }
    try { w.localStorage.setItem('hitclaud.nombre.v2', 'Pat'); } catch (e) {}
    if (opts.acceso) { try { w.localStorage.setItem('hitclaud.acceso.v1', '1'); } catch (e) {} } // marca ya persistida
    const Rk = w.Ranking;
    Rk.enviarPuntaje = function (o) { cap.puntaje.push(o); return Promise.resolve({ estado: 'ok', entro: false }); };
    Rk.enviarPartida = function (d) { cap.partida.push(d); };
    Rk.pedirTop = function (m) { cap.pidio.push(m); return Promise.resolve({ ok: true, top: [] }); };
  } });
  a._cap = cap;
  return a;
}
function tieneOculto(a, id) { return a.byId[id].classList.contains('oculto'); }
function estado(a) { return a.byId['homeEstado'].textContent; }

console.log('=== La comparación de la clave distingue mayúsculas y en tiempo constante (1.4) ===');
{
  // claveOk cierra sobre ACCESO_CLAVE (const del cierre): se extrae el bloque const+función juntos.
  const claveOk = (function () {
    const iC = main.indexOf("const ACCESO_CLAVE = 'Santi");
    const iF = main.indexOf('function claveOk(intento)', iC);
    let prof = 0, fin = -1;
    for (let k = main.indexOf('{', iF); k < main.length; k++) { if (main[k] === '{') prof++; else if (main[k] === '}') { prof--; if (prof === 0) { fin = k + 1; break; } } }
    return new Function(main.slice(iC, fin) + '\n return claveOk;')();
  })();
  chk('claveOk existe', typeof claveOk === 'function');
  chk('la clave EXACTA es válida', claveOk('Santi28082014') === true);
  chk('distingue mayúsculas/minúsculas (santi… no vale)', claveOk('santi28082014') === false && claveOk('SANTI28082014') === false);
  chk('cualquier otra cosa no vale (vacío, prefijo, sufijo)', claveOk('') === false && claveOk('Santi2808201') === false && claveOk('Santi28082014 ') === false);
  chk('NO usa comparación directa (===) con la clave: se compara en tiempo constante', !/=== ACCESO_CLAVE|ACCESO_CLAVE ===/.test(main) && /dif \|= ACCESO_CLAVE\.charCodeAt/.test(main));
  chk('sólo se guarda una MARCA ("1"), nunca la clave (1.8)', /accesoStore\.guardar\('1'\)/.test(main) && !/guardar\(ACCESO_CLAVE\)/.test(main));
}

console.log('=== Sin acceso: Pushcloude "Próximamente" y nada pulsable salvo flechas + enlace (1.1/3.5) ===');
{
  const a = app({ movil: true });
  a.irAJuego('pushclaud');
  chk('Pushcloude sin acceso: apagado y "Próximamente"', tieneOculto(a, 'homeJugable') && !tieneOculto(a, 'homeNoJugable') && estado(a) === 'Próximamente');
  chk('el enlace "¿Tienes acceso?" es visible (la puerta)', !tieneOculto(a, 'homeAccesoLink'));
  chk('el distintivo ADMIN NO aparece sin acceso', tieneOculto(a, 'homeAdmin'));
  // El parpadeo sigue (data-juego=pushclaud, home-apagado): no se rompió.
  chk('sigue en estado apagado (parpadeo CSS intacto)', a.byId['duracion'].classList.contains('home-apagado') && a.byId['duracion'].getAttribute('data-juego') === 'pushclaud');
}

console.log('=== Clave correcta concede acceso; incorrecta no (1.5/1.6) ===');
{
  const a = app({ movil: true });
  a.irAJuego('pushclaud');
  a.byId['homeAccesoLink'].dispatch('click');            // abre la puerta
  chk('el overlay de acceso se abre y el home se oculta', !tieneOculto(a, 'acceso') && tieneOculto(a, 'duracion'));

  a.byId['accesoInput'].value = 'clave-mala';
  a.byId['accesoOk'].dispatch('click');
  chk('clave incorrecta: aviso visible, overlay sigue abierto, SIN acceso', !tieneOculto(a, 'accesoError') && !tieneOculto(a, 'acceso'));
  chk('sin límite de intentos: el campo queda listo (vacío) para reintentar', a.byId['accesoInput'].value === '');

  a.byId['accesoInput'].value = 'Santi28082014';
  a.byId['accesoOk'].dispatch('click');
  chk('clave correcta: se cierra el overlay y vuelve el home', tieneOculto(a, 'acceso') && !tieneOculto(a, 'duracion'));
  chk('Pushcloude queda DESBLOQUEADO en móvil (cuerpo jugable, no apagado, 3.1)', !tieneOculto(a, 'homeJugable') && tieneOculto(a, 'homeNoJugable'));
  chk('aparece la línea de acceso anticipado como privilegio (3.2)', !tieneOculto(a, 'homeAnticipo'));
  chk('aparece el distintivo ADMIN', !tieneOculto(a, 'homeAdmin'));
}

console.log('=== Se guarda SÓLO la marca, no la clave; sobrevive a recargar (1.7/1.8) ===');
{
  const a = app({ movil: true });
  a.irAJuego('pushclaud');
  a.byId['homeAccesoLink'].dispatch('click');
  a.byId['accesoInput'].value = 'Santi28082014';
  a.byId['accesoOk'].dispatch('click');
  chk('la marca de acceso queda guardada como "1"', a.mem.get('hitclaud.acceso.v1') === '1');
  let guardoClave = false;
  a.mem.forEach(function (v) { if (String(v).indexOf('Santi') !== -1) guardoClave = true; });
  chk('la CLAVE nunca se guarda en ningún almacén', !guardoClave);

  // "Recargar": app nueva con la marca ya persistida → arranca con acceso.
  const b = app({ movil: true, acceso: true });
  b.irAJuego('pushclaud');
  chk('el acceso sobrevive a recargar (marca persistida → Pushcloude desbloqueado)', !tieneOculto(b, 'homeJugable') && tieneOculto(b, 'homeNoJugable') && !tieneOculto(b, 'homeAdmin'));
}

console.log('=== El distintivo aparece en los TRES juegos con acceso, en ninguno sin él (2.1) ===');
{
  // Con acceso: Hitcloude y Pushcloude (móvil) y Shotcloude (escritorio) muestran el distintivo en su
  // home jugable. Sin acceso, en ninguno.
  const m = app({ movil: true, acceso: true });
  m.irAJuego('hitclaud');  const hit = !tieneOculto(m, 'homeAdmin') && !tieneOculto(m, 'homeJugable');
  m.irAJuego('pushclaud'); const push = !tieneOculto(m, 'homeAdmin') && !tieneOculto(m, 'homeJugable');
  const d = app({ acceso: true }); // escritorio
  d.irAJuego('shotclaud'); const shot = !tieneOculto(d, 'homeAdmin') && !tieneOculto(d, 'homeJugable');
  chk('con acceso: distintivo en Hitcloude, Shotcloude y Pushcloude (en sus homes jugables)', hit && shot && push);

  const sinA = app({ movil: true });
  sinA.irAJuego('hitclaud'); const s1 = tieneOculto(sinA, 'homeAdmin');
  const sinD = app({}); sinD.irAJuego('shotclaud'); const s2 = tieneOculto(sinD, 'homeAdmin');
  chk('sin acceso: NO hay distintivo en ningún juego', s1 && s2);
}

console.log('=== Con acceso, Pushcloude ES jugable (v2.9): duraciones 60/180 y arranca la partida ===');
{
  const a = app({ movil: true, acceso: true });
  a.irAJuego('pushclaud');
  const modos = a.byId['durModos'].children;
  chk('Pushcloude ofrece 60 y 180 segundos (ya no 15)', modos.length === 2 && modos[0]._attrs['data-dur'] === '60' && modos[1]._attrs['data-dur'] === '180');
  a.jugar('60');
  a.step(32);
  chk('tocar la duración ARRANCA la partida de Pushcloude (home oculto)', tieneOculto(a, 'duracion'));
  chk('sigue sin mandar nada al ranking mientras es acceso anticipado (9.5)', a._cap.puntaje.length === 0 && a._cap.partida.length === 0);
}

console.log('=== En computadora, Pushcloude sigue no disponible aunque haya acceso (3.4) ===');
{
  const a = app({ acceso: true }); // escritorio
  a.irAJuego('pushclaud');
  chk('Pushcloude en escritorio con acceso: apagado y "Disponible en móvil"', tieneOculto(a, 'homeJugable') && !tieneOculto(a, 'homeNoJugable') && estado(a) === 'Disponible en móvil');
  chk('en escritorio con acceso, el enlace "¿Tienes acceso?" NO se muestra (ya tiene acceso)', tieneOculto(a, 'homeAccesoLink'));
}

console.log('=== Se puede SALIR del acceso y todo vuelve a como estaba (4.1/4.2) ===');
{
  const a = app({ movil: true, acceso: true });
  a.irAJuego('pushclaud');
  chk('parte desbloqueado', !tieneOculto(a, 'homeJugable'));
  a.byId['homeAdmin'].dispatch('click');                 // el distintivo abre la gestión del acceso (4.2)
  chk('el overlay ofrece "Salir del acceso" cuando ya hay acceso', !tieneOculto(a, 'accesoSalir'));
  a.byId['accesoSalir'].dispatch('click');
  chk('tras salir: Pushcloude vuelve a "Próximamente" (como alguien normal)', tieneOculto(a, 'homeJugable') && !tieneOculto(a, 'homeNoJugable') && estado(a) === 'Próximamente');
  chk('el distintivo desaparece y reaparece el enlace de la puerta', tieneOculto(a, 'homeAdmin') && !tieneOculto(a, 'homeAccesoLink'));
  chk('la marca de acceso se borró del almacén', a.mem.get('hitclaud.acceso.v1') === '');
}

console.log('=== Un fallo de almacenamiento no rompe nada (1.7) ===');
{
  let lanzo = false, a;
  try {
    a = app({ movil: true, romperStorage: true });
    a.irAJuego('pushclaud');
    a.byId['homeAccesoLink'].dispatch('click');
    a.byId['accesoInput'].value = 'Santi28082014';
    a.byId['accesoOk'].dispatch('click');
  } catch (e) { lanzo = true; }
  chk('con el almacén roto, nada lanza excepción', !lanzo);
  chk('el acceso funciona en memoria aunque no se pueda guardar (Pushcloude desbloqueado)', !!a && !tieneOculto(a, 'homeJugable') && !tieneOculto(a, 'homeAdmin'));
}

console.log(`\n== RESUMEN acceso: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
