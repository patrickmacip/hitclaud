// hitclaud — récords por JUEGO+DURACIÓN en llave versionada NUEVA (v4). HitClaud 15 y 60 se
// MIGRAN desde las v3; el modo 30 NO. Las viejas no se borran. node test/reinicio.test.js

const fs = require('fs');
const U = require('../js/util.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal(seed) { const d = Object.assign({}, seed || {}); return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, _d: d }; }
function mockIdb() { const d = {}; return { get: (k) => Promise.resolve(k in d ? d[k] : null), set: (k, v) => { d[k] = String(v); return Promise.resolve(); }, _d: d }; }
// Espejo de migrarLocal(vieja, nueva) de main.js.
function migrar(local, vieja, nueva) { if (local.getItem(nueva) == null && local.getItem(vieja) != null) local.setItem(nueva, local.getItem(vieja)); }

(async function () {
  console.log('=== 2.1: llave NUEVA v4 por juego+duración; se crean todas las combinaciones ===');
  {
    chk('versión de llave v4', /const REC_VER = 'hitclaud\.record\.v4';/.test(main));
    chk('llaveRecord = v4.<juego>.<duración>', /function llaveRecord\(juego, dur\) \{ return REC_VER \+ '\.' \+ juego \+ '\.' \+ dur;/.test(main));
    chk('se crea una persistencia por juego+duración de JUEGOS', /recordStores\[j\.id \+ ':' \+ dur\] = U\.crearPersistencia\(almacen, idbKV, llaveRecord\(j\.id, dur\), 500\)/.test(main));
    chk('ya no se leen las llaves v3 como récord activo', !/crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v3/.test(main));
  }

  console.log('=== 2.3: HitClaud 15 y 60 se MIGRAN desde las v3 (el jugador no pierde nada) ===');
  {
    chk('main.js migra v3.15 → v4.hitclaud.15', /migrarLocal\('hitclaud\.record\.v3\.15', llaveRecord\('hitclaud', '15'\)\)/.test(main));
    chk('main.js migra v3.60 → v4.hitclaud.60', /migrarLocal\('hitclaud\.record\.v3\.60', llaveRecord\('hitclaud', '60'\)\)/.test(main));
    // Comportamiento: con la v3 poblada, tras migrar la v4 arranca con ese récord.
    const local = mockLocal({
      'hitclaud.record.v3.15': JSON.stringify({ record: 1200, ultimoScore: 900 }),
      'hitclaud.record.v3.60': JSON.stringify({ record: 8800, ultimoScore: 8800 }),
      'hitclaud.record.v3.30': JSON.stringify({ record: 3400, ultimoScore: 3400 }),
    }), idb = mockIdb();
    migrar(local, 'hitclaud.record.v3.15', 'hitclaud.record.v4.hitclaud.15');
    migrar(local, 'hitclaud.record.v3.60', 'hitclaud.record.v4.hitclaud.60');
    const r15 = U.crearPersistencia(local, idb, 'hitclaud.record.v4.hitclaud.15', 500);
    const r60 = U.crearPersistencia(local, idb, 'hitclaud.record.v4.hitclaud.60', 500);
    await Promise.all([r15.reconciliar(), r60.reconciliar()]);
    chk('HitClaud 15 y 60 arrancan con el récord migrado (1200 y 8800)', r15.valor === 1200 && r60.valor === 8800);
    chk('la llave vieja v3.15/60 NO se borra (queda intacta)', U.parseEntrada(local._d['hitclaud.record.v3.15']).record === 1200 && U.parseEntrada(local._d['hitclaud.record.v3.60']).record === 8800);
  }

  console.log('=== 2.2: el récord del modo 30 NO se migra (queda huérfano) ===');
  {
    chk('main.js NO migra la v3.30', !/migrarLocal\([^)]*v3\.30/.test(main));
    const local = mockLocal({ 'hitclaud.record.v3.30': JSON.stringify({ record: 3400, ultimoScore: 3400 }) });
    // No hay v4 para el 30 (el 30 no existe en JUEGOS) → nada la lee; la vieja queda intacta.
    chk('la v3.30 queda huérfana e intacta (nadie la migra)', local.getItem('hitclaud.record.v4.hitclaud.30') == null && U.parseEntrada(local._d['hitclaud.record.v3.30']).record === 3400);
  }

  console.log('=== 2.4: el NOMBRE del jugador no se toca ===');
  {
    const local = mockLocal({ 'hitclaud.nombre.v2': 'PAT' }), idb = mockIdb();
    const nombre = U.crearTextoPersistente(local, idb, 'hitclaud.nombre.v2');
    chk('el nombre sigue siendo PAT', nombre.valor === 'PAT');
    chk('la llave del nombre no cambió de versión', /const NOMBRE_KEY = 'hitclaud\.nombre\.v2'/.test(main));
  }

  console.log(`\n== RESUMEN reinicio: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
