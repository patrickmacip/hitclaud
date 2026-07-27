// hitclaud — persistencia mínima y resistente (FASE 10): node test/persistencia.test.js
// Dos datos por modo {record, ultimoScore} en DOS almacenes (localStorage + IDB)
// bajo la misma llave versionada. Reconciliación = record MÁS ALTO de los dos.

const U = require('../js/util.js');

let ok = 0, ko = 0;
function chk(nombre, cond) { console.log(`  ${nombre}  ${cond ? 'OK ✓' : 'NO ✗'}`); if (cond) ok++; else ko++; }

// localStorage síncrono (objeto plano).
function mockLocal() {
  const d = {};
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d };
}
// IndexedDB simulado: KV asíncrono (get/set devuelven Promesas).
function mockIdb() {
  const d = {};
  return {
    get: (k) => Promise.resolve(k in d ? d[k] : null),
    set: (k, v) => { d[k] = String(v); return Promise.resolve(); },
    _d: d,
  };
}
const K = 'hitclaud.record.v2.60';

(async function () {
  console.log('=== Guardar récord escribe en AMBOS almacenes (misma llave) ===');
  {
    const local = mockLocal(), idb = mockIdb();
    const p = U.crearPersistencia(local, idb, K, 500);
    p.terminar(1200, 0); // fin de partida con record nuevo
    await Promise.resolve();
    chk('localStorage tiene record 1200', U.parseEntrada(local._d[K]).record === 1200);
    chk('IndexedDB tiene record 1200', U.parseEntrada(idb._d[K]).record === 1200);
    chk('ultimoScore 1200 en ambos', U.parseEntrada(local._d[K]).ultimoScore === 1200 && U.parseEntrada(idb._d[K]).ultimoScore === 1200);
  }

  console.log('\n=== Borrar UN almacén y arrancar → récord se recupera del OTRO ===');
  {
    // localStorage vacío, IDB conserva 3000. Al reconciliar, se recupera y repuebla local.
    const local = mockLocal(), idb = mockIdb();
    idb._d[K] = JSON.stringify({ record: 3000, ultimoScore: 800 });
    const p = U.crearPersistencia(local, idb, K, 500);
    chk('lectura síncrona sin local → 0 (aún no reconciliado)', p.valor === 0);
    const r = await p.reconciliar();
    chk('reconciliado desde IDB → record 3000', r.record === 3000 && p.valor === 3000);
    chk('ultimoScore recuperado → 800', p.ultimoScore === 800);
    chk('localStorage REPOBLADO con 3000', U.parseEntrada(local._d[K]).record === 3000);

    // Caso inverso: IDB vacío, localStorage conserva 4200 → repuebla IDB.
    const local2 = mockLocal(), idb2 = mockIdb();
    local2._d[K] = JSON.stringify({ record: 4200, ultimoScore: 100 });
    const p2 = U.crearPersistencia(local2, idb2, K, 500);
    await p2.reconciliar();
    chk('IndexedDB REPOBLADO desde local → 4200', U.parseEntrada(idb2._d[K]).record === 4200);
  }

  console.log('\n=== Récord MENOR nunca sobrescribe al MAYOR (reconciliación toma el alto) ===');
  {
    const local = mockLocal(), idb = mockIdb();
    local._d[K] = JSON.stringify({ record: 500, ultimoScore: 500 });   // menor
    idb._d[K] = JSON.stringify({ record: 9000, ultimoScore: 120 });     // mayor
    const p = U.crearPersistencia(local, idb, K, 500);
    const r = await p.reconciliar();
    chk('gana el mayor (9000), no el menor (500)', r.record === 9000);
    chk('ambos almacenes quedan en 9000', U.parseEntrada(local._d[K]).record === 9000 && U.parseEntrada(idb._d[K]).record === 9000);

    // En vivo: considerar con un valor menor no baja el récord.
    const subio = p.considerar(10, 1000);
    chk('considerar(10) NO baja el récord de 9000', p.valor === 9000 && subio === false);

    // terminar con score menor no baja el record (pero sí fija ultimoScore).
    p.terminar(42, 2000);
    chk('terminar(42) deja record 9000 intacto', p.valor === 9000);
  }

  console.log('\n=== ultimoScore SÍ se sobrescribe SIEMPRE (aunque el score sea menor o 0) ===');
  {
    const local = mockLocal(), idb = mockIdb();
    const p = U.crearPersistencia(local, idb, K, 500);
    p.terminar(1000, 0);
    chk('ultimoScore=1000 tras primera partida', p.ultimoScore === 1000);
    p.terminar(30, 100);  // partida floja
    chk('ultimoScore=30 (sobrescrito) y record sigue 1000', p.ultimoScore === 30 && p.valor === 1000);
    p.terminar(0, 200);   // partida en cero
    chk('ultimoScore=0 (última partida terminó en 0)', p.ultimoScore === 0 && p.valor === 1000);
    chk('persistido en ambos: ultimoScore=0', U.parseEntrada(local._d[K]).ultimoScore === 0 && U.parseEntrada(idb._d[K]).ultimoScore === 0);
  }

  console.log('\n=== NINGUNA llave extra en storage (solo la versionada del modo) ===');
  {
    const local = mockLocal(), idb = mockIdb();
    const p = U.crearPersistencia(local, idb, K, 500);
    p.considerar(50, 0); p.terminar(50, 600); p.flush(700);
    await p.reconciliar();
    chk('localStorage: 1 sola llave', Object.keys(local._d).length === 1 && K in local._d);
    chk('IndexedDB: 1 sola llave', Object.keys(idb._d).length === 1 && K in idb._d);
    chk('sin hitclaud.nombre / scores.v1 / record.v3', !('hitclaud.nombre' in local._d) && !('hitclaud.scores.v1.60' in local._d) && !('hitclaud.record.v3.60' in local._d));
  }

  console.log('\n=== Escritura NO en cada punto: considerar throttlea, terminar escribe 1 vez ===');
  {
    const local = mockLocal(), idb = mockIdb();
    const p = U.crearPersistencia(local, idb, K, 500);
    // 600 cuadros a ~60fps (10s) con el score subiendo cada cuadro (récord sube siempre).
    for (let f = 0; f < 600; f++) p.considerar(f + 1, f * 16.7);
    p.terminar(600, 600 * 16.7);
    // 10s/500ms ≈ 20 escrituras throttled + 1 de terminar. Muy por debajo de 600.
    chk(`escrituras=${p.escrituras} (throttle: ≤22, no 600)`, p.escrituras <= 22);
    chk('record final = 600', p.valor === 600);
  }

  console.log('\n=== Robustez: almacenes caídos → juego vive, datos en memoria (NUNCA lanza) ===');
  {
    // Ambos null (localStorage bloqueado, sin IndexedDB).
    let lanzo = false, p;
    try {
      p = U.crearPersistencia(null, null, K, 500);
      p.considerar(500, 0); p.terminar(800, 600); p.flush(700);
      await p.reconciliar();
    } catch (e) { lanzo = true; }
    chk('sin lanzar con ambos null', !lanzo);
    chk('record en memoria = 800', p.valor === 800);

    // setItem que lanza (cuota/privado iOS) + idb.set que rechaza.
    const localMalo = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    const idbMalo = { get: () => Promise.reject(new Error('idb down')), set: () => Promise.reject(new Error('idb down')) };
    let lanzo2 = false, p2;
    try {
      p2 = U.crearPersistencia(localMalo, idbMalo, K, 500);
      p2.terminar(999, 0);
      await p2.reconciliar();
    } catch (e) { lanzo2 = true; }
    chk('almacenes que lanzan/rechazan no rompen', !lanzo2);
    chk('record en memoria = 999', p2.valor === 999);
  }

  console.log('\n=== Corrupción: JSON basura en un almacén no derriba la reconciliación ===');
  {
    const local = mockLocal(), idb = mockIdb();
    local._d[K] = '{no es json';
    idb._d[K] = JSON.stringify({ record: 700, ultimoScore: 700 });
    const p = U.crearPersistencia(local, idb, K, 500);
    const r = await p.reconciliar();
    chk('ignora el corrupto y toma 700 del sano', r.record === 700);
    chk('repuebla el almacén corrupto con JSON válido', U.parseEntrada(local._d[K]) && U.parseEntrada(local._d[K]).record === 700);
  }

  console.log(`\n== RESUMEN persistencia: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
