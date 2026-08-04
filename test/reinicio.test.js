// hitclaud — CAMBIO 2: reinicio de récords locales por llave versionada nueva (v2→v3).
// node test/reinicio.test.js
//
// Regla (igual al reset previo v1→v2, commit 27965c1): NO se borra la llave vieja; se
// pasa a una llave NUEVA que arranca en 0. El nombre del jugador (llave aparte) no se toca.

const fs = require('fs');
const U = require('../js/util.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

function mockLocal(seed) {
  const d = Object.assign({}, seed || {});
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, _d: d };
}
function mockIdb() {
  const d = {};
  return { get: (k) => Promise.resolve(k in d ? d[k] : null), set: (k, v) => { d[k] = String(v); return Promise.resolve(); }, _d: d };
}

(async function () {
  console.log('=== 2.2: main.js usa las llaves NUEVAS v3 y documenta las viejas huérfanas ===');
  {
    chk('record60 en hitclaud.record.v3.60', /crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v3\.60', 500\)/.test(main));
    chk('record30 en hitclaud.record.v3.30', /crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v3\.30', 500\)/.test(main));
    chk('record15 en hitclaud.record.v3.15', /crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v3\.15', 500\)/.test(main));
    chk('ya no se lee la llave vieja v2.60/30/15 como récord activo', !/crearPersistencia\(almacen, idbKV, 'hitclaud\.record\.v2\.(60|30|15)'/.test(main));
    chk('2.5: comenta las llaves v2.* huérfanas (no se borran)', /HUÉRFANAS[\s\S]{0,220}hitclaud\.record\.v2\.60[\s\S]{0,120}v2\.15/.test(main));
    chk('2.5: documenta el reset como el commit 27965c1', /27965c1/.test(main));
  }

  console.log('=== 2.1: con la llave vieja poblada, los tres modos arrancan en 0 (llave nueva) ===');
  {
    // El jugador YA tenía récords guardados bajo la llave vieja v2 (como Pat).
    const seed = {
      'hitclaud.record.v2.15': JSON.stringify({ record: 1200, ultimoScore: 900 }),
      'hitclaud.record.v2.30': JSON.stringify({ record: 3400, ultimoScore: 3400 }),
      'hitclaud.record.v2.60': JSON.stringify({ record: 8800, ultimoScore: 8800 }),
    };
    const local = mockLocal(seed), idb = mockIdb();
    // El juego arranca leyendo SÓLO las llaves NUEVAS v3 → récord 0 en los tres modos.
    const r15 = U.crearPersistencia(local, idb, 'hitclaud.record.v3.15', 500);
    const r30 = U.crearPersistencia(local, idb, 'hitclaud.record.v3.30', 500);
    const r60 = U.crearPersistencia(local, idb, 'hitclaud.record.v3.60', 500);
    await Promise.all([r15.reconciliar(), r30.reconciliar(), r60.reconciliar()]);
    chk('los tres modos arrancan en récord 0', r15.valor === 0 && r30.valor === 0 && r60.valor === 0);

    // 2.2: la llave VIEJA no se borra — sigue intacta tras arrancar y reconciliar.
    chk('la llave vieja v2.15 NO se borra (queda huérfana, intacta)', U.parseEntrada(local._d['hitclaud.record.v2.15']).record === 1200);
    chk('la llave vieja v2.30 NO se borra', U.parseEntrada(local._d['hitclaud.record.v2.30']).record === 3400);
    chk('la llave vieja v2.60 NO se borra', U.parseEntrada(local._d['hitclaud.record.v2.60']).record === 8800);

    // Un récord nuevo se guarda en la llave NUEVA, sin tocar la vieja.
    r60.terminar(500, 1000, true);
    chk('el récord nuevo persiste en v3.60', U.parseEntrada(local._d['hitclaud.record.v3.60']).record === 500);
    chk('la vieja v2.60 sigue en 8800 (no se pisó)', U.parseEntrada(local._d['hitclaud.record.v2.60']).record === 8800);
  }

  console.log('=== 2.3: el NOMBRE del jugador sobrevive al reinicio ===');
  {
    const seed = {
      'hitclaud.nombre.v2': 'PAT',
      'hitclaud.record.v2.60': JSON.stringify({ record: 8800, ultimoScore: 8800 }),
    };
    const local = mockLocal(seed), idb = mockIdb();
    // El reinicio toca sólo las llaves de récord (v3); el nombre vive en su propia llave.
    U.crearPersistencia(local, idb, 'hitclaud.record.v3.60', 500);
    const nombre = U.crearTextoPersistente(local, idb, 'hitclaud.nombre.v2');
    chk('el nombre sigue siendo PAT tras el reinicio', nombre.valor === 'PAT');
    chk('la llave del nombre no cambió de versión', /const NOMBRE_KEY = 'hitclaud\.nombre\.v2'/.test(main));
  }

  console.log(`\n== RESUMEN reinicio: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
