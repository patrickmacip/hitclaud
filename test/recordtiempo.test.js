// hitclaud — FASE 12 commit 1: el récord SOLO se guarda por TIEMPO cumplido.
// node test/recordtiempo.test.js
// Regla dura: si la partida termina por CloudOver, el récord NO se mueve (aunque
// el score lo supere). ultimoScore se guarda SIEMPRE al terminar; por CloudOver = 0.

const U = require('../js/util.js');
const fs = require('fs');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }
function mockIdb() { const d = {}; return { get: (k) => Promise.resolve(k in d ? d[k] : null), set: (k, v) => { d[k] = String(v); return Promise.resolve(); }, _d: d }; }
const K = 'hitclaud.record.v2.60';

// Espejo de terminarPartida(porTiempo) de main.js: por tiempo sube record; por
// CloudOver score=0 y record intacto. ÚNICO camino de escritura del récord.
function cerrar(p, scoreActual, porTiempo, t) {
  const scoreFinal = porTiempo ? scoreActual : 0;
  p.terminar(scoreFinal, t, !!porTiempo);
}

console.log('=== Termina por TIEMPO con score > récord → récord ACTUALIZADO ===');
{
  const local = mockLocal(), idb = mockIdb();
  local._d[K] = JSON.stringify({ record: 1000, ultimoScore: 300 });
  const p = U.crearPersistencia(local, idb, K, 500);
  cerrar(p, 2500, true, 60000);   // cumplió los 60s con 2500 > 1000
  chk('record subió a 2500', p.valor === 2500);
  chk('ultimoScore = 2500', p.ultimoScore === 2500);
  chk('persistido en ambos almacenes', U.parseEntrada(local._d[K]).record === 2500 && U.parseEntrada(idb._d[K]).record === 2500);
}

console.log('\n=== Termina por CLOUDOVER con score > récord → récord INTACTO ===');
{
  const local = mockLocal(), idb = mockIdb();
  local._d[K] = JSON.stringify({ record: 1000, ultimoScore: 300 });
  const p = U.crearPersistencia(local, idb, K, 500);
  cerrar(p, 9999, false, 42000);  // score 9999 batiría el récord, PERO fue CloudOver
  chk('record NO se movió (sigue 1000)', p.valor === 1000);
  chk('persistido: record intacto en ambos', U.parseEntrada(local._d[K]).record === 1000 && U.parseEntrada(idb._d[K]).record === 1000);
  chk('ultimoScore = 0 tras CloudOver (score vaciado)', p.ultimoScore === 0);
  chk('ultimoScore=0 persistido en ambos', U.parseEntrada(local._d[K]).ultimoScore === 0 && U.parseEntrada(idb._d[K]).ultimoScore === 0);
}

console.log('\n=== Secuencia realista: buen CloudOver NO deja récord; luego 60s sí ===');
{
  const local = mockLocal(), idb = mockIdb();
  const p = U.crearPersistencia(local, idb, K, 500);
  cerrar(p, 5000, false, 1000);   // partidón que muere por CloudOver
  chk('tras CloudOver récord sigue 0 (despiadado)', p.valor === 0);
  chk('ultimoScore = 0', p.ultimoScore === 0);
  cerrar(p, 1200, true, 61000);   // partida modesta pero completa los 60s
  chk('tras tiempo cumplido récord = 1200', p.valor === 1200);
  chk('ultimoScore = 1200', p.ultimoScore === 1200);
}

console.log('\n=== ULTIMO camino de escritura del récord: sólo terminar (grep) ===');
{
  const util = fs.readFileSync(__dirname + '/../js/util.js', 'utf8');
  const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
  chk('util.js: NO existe considerar (récord en vivo eliminado)', !/considerar/.test(util));
  chk('main.js: NO llama record.considerar', !/record\.considerar/.test(main));
  // record avanza SOLO dentro de terminar(): única asignación `record = ` fuera de init/reconciliar.
  const asignaEnTerminar = /if \(subeRecord && ultimoScore > record\) record = ultimoScore;/.test(util);
  chk('util.js: record sube SÓLO si subeRecord (dentro de terminar)', asignaEnTerminar);
  // main.js: el único record.terminar pasa el flag porTiempo.
  chk('main.js: record.terminar(scoreFinal, ahora, !!porTiempo) — único cierre', /record\.terminar\(scoreFinal, ahora, !!porTiempo\)/.test(main));
  chk('main.js: time-up llama terminarPartida(true)', /terminarPartida\(true\)/.test(main));
  chk('main.js: CloudOver llama terminarPartida(false)', /terminarPartida\(false\)/.test(main));
}

console.log(`\n== RESUMEN record-tiempo: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
