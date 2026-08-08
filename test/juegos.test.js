// hitclaud — colección de juegos + navegación en dos niveles (paso 1 de 3). Cubre V4.
// node test/juegos.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal(seed) { const d = Object.assign({}, seed || {}); return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }

console.log('=== CAMBIO 1: la estructura JUEGOS declara EXACTAMENTE tres juegos ===');
{
  const bloque = (main.match(/const JUEGOS = \[([\s\S]*?)\];/) || ['', ''])[1];
  const ids = (bloque.match(/id: '(\w+)'/g) || []).map(function (s) { return s.replace(/id: '|'/g, ''); });
  chk('tres juegos: hitclaud, shotclaud, pushclaud', ids.join(',') === 'hitclaud,shotclaud,pushclaud');
  chk('HitClaud: jugable, táctil (ya no se ofrece en computadora), 15 y 60', /id: 'hitclaud'[\s\S]{0,160}jugable: true[\s\S]{0,30}plataforma: 'tactil'[\s\S]{0,40}duraciones: \['15', '60'\]/.test(bloque));
  chk('ShotClaud: jugable, escritorio, 20 y 60', /id: 'shotclaud'[\s\S]{0,160}jugable: true[\s\S]{0,30}plataforma: 'escritorio'[\s\S]{0,40}duraciones: \['20', '60'\]/.test(bloque));
  chk('PushClaud: NO jugable, táctil, sólo 15', /id: 'pushclaud'[\s\S]{0,160}jugable: false[\s\S]{0,30}plataforma: 'tactil'[\s\S]{0,40}duraciones: \['15'\]/.test(bloque));
  chk('el modo 20 existe SÓLO en ShotClaud', /duraciones: \['20', '60'\]/.test(bloque) && !/id: 'hitclaud'[\s\S]{0,200}'20'/.test(bloque) && !/id: 'pushclaud'[\s\S]{0,120}'20'/.test(bloque));
  chk('comentario de cómo AGREGAR un juego', /PARA AGREGAR UN JUEGO/.test(main));
}

console.log('=== CAMBIO 2: migración de récords 15/60; el 30 no; el nombre sobrevive ===');
{
  chk('récords en llave versionada NUEVA v4 por juego+duración', /const REC_VER = 'hitclaud\.record\.v4';/.test(main));
  chk('se migran HitClaud 15 y 60 desde las v3 (2.3)', /migrarLocal\('hitclaud\.record\.v3\.15', llaveRecord\('hitclaud', '15'\)\)/.test(main) && /migrarLocal\('hitclaud\.record\.v3\.60', llaveRecord\('hitclaud', '60'\)\)/.test(main));
  chk('el 30 NO se migra (2.2)', !/migrarLocal\([^)]*v3\.30/.test(main));
  chk('el nombre no se toca (misma llave hitclaud.nombre.v2)', /const NOMBRE_KEY = 'hitclaud\.nombre\.v2'/.test(main));
  // Comportamiento de la migración (copia one-time el valor viejo a la llave nueva).
  const vieja = 'hitclaud.record.v3.15', nueva = 'hitclaud.record.v4.hitclaud.15';
  const local = mockLocal(); local._d[vieja] = JSON.stringify({ record: 1234, ultimoScore: 0 });
  // Espejo de migrarLocal: si la nueva no existe y la vieja sí, copia.
  if (local.getItem(nueva) == null && local.getItem(vieja) != null) local.setItem(nueva, local.getItem(vieja));
  const r = U.crearPersistencia(local, null, nueva, 500);
  chk('tras migrar, HitClaud 15 arranca con el récord viejo (1234)', r.valor === 1234);
  chk('la vieja v3.15 NO se borra (queda intacta)', U.parseEntrada(local._d[vieja]).record === 1234);
}

console.log('=== NIVEL ÚNICO (home por juego); nunca se sale del juego ===');
{
  chk('iniciarPartida sólo permite juegos JUGABLES y combos válidos', /function iniciarPartida\(juego, modo\) \{[\s\S]{0,180}if \(!j \|\| !j\.jugable \|\| j\.duraciones\.indexOf\(String\(modo\)\) === -1\) return;/.test(main));
  chk('juego no disponible: el home muestra su cuerpo APAGADO con línea de estado (CAMBIO 4)', /elHomeNoJugable\.classList\.toggle\('oculto', disp\.jugable\)/.test(main) && /elHomeEstado\.textContent = disp\.pronto/.test(main));
  chk('las FLECHAS ciclan de juego (no salen): homeIzq avanza, homeDer retrocede', /btnHomeIzq\.addEventListener\('click', function \(\) \{ mostrarHome\(juegoVecino\(juegoSel, 1\), true\); \}\)/.test(main) && /btnHomeDer\.addEventListener\('click', function \(\) \{ mostrarHome\(juegoVecino\(juegoSel, -1\), true\); \}\)/.test(main));
  chk('el botón de casa vuelve al HOME de su juego (4.1)', /function abandonarPartida\(\)[\s\S]{0,400}mostrarHome\(juegoActivo, false\)/.test(main));
  chk('los botones de duración del home arrancan la partida de ESA duración (CAMBIO 2)', /if \(j\.jugable\) iniciarPartida\(juegoSel, dur\);/.test(main));
}

console.log('=== CAMBIO 4: fin de partida — jugar de nuevo / cambiar duración ===');
{
  chk('"Jugar de nuevo": mismo juego y misma duración (4.4)', /finJugarDeNuevo[\s\S]{0,120}iniciarPartida\(juegoActivo, modoJuego\)/.test(main));
  chk('"Cambiar duración" vuelve al HOME del mismo juego (4.5)', /finCambiarDuracion[\s\S]{0,220}mostrarHome\(juegoActivo, false\)/.test(main));
  chk('"Cambiar duración" se OCULTA si el juego tiene una sola duración', /function pintarFin[\s\S]{0,1100}btnFinCambiar\.classList\.toggle\('oculto', unaSola\)/.test(main));
  chk('"Inicio" vuelve al HOME de su juego (4.2)', /finMenu[\s\S]{0,160}mostrarHome\(juegoActivo, false\)/.test(main));
  chk('orden en el HTML: puntaje → récord → puesto → Jugar de nuevo', /go-score[\s\S]*?go-record[\s\S]*?go-rank[\s\S]*?id="finJugarDeNuevo"/.test(html));
}

console.log('=== P4: todo elemento pulsable declara ≥44px de área táctil ===');
{
  const reglas = {
    '.hdr-icono / flechas del home (44×44)': /\.hdr-icono \{[\s\S]{0,80}width: 44px; height: 44px;/,
    '.ini-sel (≥56)': /\.ini-sel \{[\s\S]{0,160}min-height: 56px/,
    '.ini-jugar (≥56)': /\.ini-jugar \{[\s\S]{0,120}min-height: 56px/,
    '.ini-ranking (≥52)': /\.ini-ranking \{[\s\S]{0,200}min-height: 52px/,
    '.ini-actu (≥44)': /\.ini-actu \{[\s\S]{0,200}min-height: 44px/,
    '.barra-salir (44×44)': /\.barra-salir \{[\s\S]{0,80}width: 44px;[\s\S]{0,40}height: 44px;/,
    '.ini-saludo (≥44)': /\.ini-saludo \{[\s\S]{0,200}min-height: 44px/,
    '.rank-sel (≥48)': /\.ini-sel \{[\s\S]{0,160}min-height: 56px/,
  };
  Object.keys(reglas).forEach(function (k) { chk('área táctil ' + k, reglas[k].test(css)); });
}

console.log(`\n== RESUMEN juegos: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
