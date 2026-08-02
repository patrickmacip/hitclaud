// hitclaud — FASE 21 commit 2: nombre de usuario (una vez, en la barra). node test/usuario.test.js

const U = require('../js/util.js');
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }
function mockLocal() { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, _d: d }; }
function mockIdb() { const d = {}; return { get: (k) => Promise.resolve(k in d ? d[k] : null), set: (k, v) => { d[k] = String(v); return Promise.resolve(); }, _d: d }; }
const KEY = 'hitclaud.nombre.v2';

console.log('=== PERSISTENCIA doble almacén (fase 10) para el nombre; llave hitclaud.nombre.v2 ===');
{
  chk('llave declarada: hitclaud.nombre.v2', /const NOMBRE_KEY = 'hitclaud\.nombre\.v2';/.test(main));
  chk('usa crearTextoPersistente(almacen, idbKV, NOMBRE_KEY)', /crearTextoPersistente\(almacen, idbKV, NOMBRE_KEY\)/.test(main));
  // Guarda en AMBOS almacenes bajo la llave.
  const local = mockLocal(), idb = mockIdb();
  const s = U.crearTextoPersistente(local, idb, KEY);
  s.guardar('Pat');
  chk('guarda en localStorage e IndexedDB', local._d[KEY] === 'Pat' && idb._d[KEY] === 'Pat');
  chk('lectura síncrona inicial trae el nombre guardado', U.crearTextoPersistente(local, idb, KEY).valor === 'Pat');
}

console.log('=== PRIMERA carga pide nombre y BLOQUEA; SEGUNDA no ===');
{
  // Decisión de arranque parametrizada por el nombre guardado.
  chk('arranque: si hay nombre → bienvenida', /if \(nombreUsuario\) mostrarPantallaInicio\(\);/.test(main));
  chk('arranque: sin nombre y con almacén → pedir nombre (bloquea)', /else if \(puedeGuardarNombre\) mostrarPantallaNombre\(\);/.test(main));
  // FASE 22: #nombre debe estar REGISTRADO en AMBAS reglas de overlay (no solo existir en HTML).
  chk('overlay #nombre registrado como overlay real (posición z-index:3 + ocultado compuesto)', /<div id="nombre" class="oculto" role="dialog"/.test(html) && /#gameover, #pausa, #inicio, #nombre \{/.test(css) && /#nombre\.oculto \{ display: none; \}|, #nombre\.oculto \{ display: none; \}/.test(css));
  // Simulación de las dos cargas con el mismo almacén.
  const local = mockLocal(), idb = mockIdb();
  const carga1 = U.crearTextoPersistente(local, idb, KEY);
  chk('1ª carga: sin nombre (valor vacío → se pediría)', carga1.valor === '');
  carga1.guardar('Ana');
  const carga2 = U.crearTextoPersistente(local, idb, KEY);
  chk('2ª carga: ya hay nombre (valor "Ana" → NO se pide)', carga2.valor === 'Ana');
  chk('el nombre NO reaparece entre partidas (sólo se pide al arrancar sin nombre)', !/iniciarPartida[\s\S]{0,120}mostrarPantallaNombre/.test(main));
}

console.log('=== VISIBLE en la barra con la tipografía de etiqueta del marcador ===');
{
  chk('span del nombre en el marcador Record (reusa .etiqueta)', /<span class="etiqueta barra-nombre" id="barraNombre"><\/span>/.test(html));
  chk('actualizarBarraNombre pinta el nombre (blindado try/catch)', /function actualizarBarraNombre\(\)[\s\S]{0,140}elBarraNombre\.textContent = nombreUsuario \|\| ''/.test(main) && /catch \(e\) \{ \/\* nunca rompe/.test(main));
  chk('se muestra al arrancar (actualizarBarraNombre en la secuencia de carga)', /actualizarBarraNombre\(\); \/\/ muestra el nombre guardado/.test(main));
  chk('vacío = invisible (.barra-nombre:empty display none, sin componente nuevo)', /\.barra-nombre:empty \{ display: none; \}/.test(css));
}

console.log('=== VALIDACIÓN 1–8, trim, no vacío; teclado bajo demanda; alto 48 / 16px ===');
{
  chk('input maxlength=8', /id="nombreInput"[\s\S]{0,120}maxlength="8"/.test(html));
  chk('confirmar: trim + recorte a 8 + rechaza vacío', /const v = \(nombreInput \? nombreInput\.value : ''\)\.trim\(\)\.slice\(0, 8\);/.test(main) && /if \(v\.length < 1\) return;/.test(main));
  chk('SIN autofocus agresivo (no .focus\\(\\) en el prompt)', !/nombreInput\.focus\(\)/.test(main) && /NO \.focus\(\): teclado bajo demanda/.test(main));
  chk('campo alto 48 y texto 16px (evita zoom iOS)', /\.nombre-input \{[\s\S]{0,220}height: 48px;[\s\S]{0,220}font: 600 16px/.test(css));
  chk('botón Confirmar en la familia existente (.go-reiniciar)', /<button id="nombreOk" class="go-reiniciar">Confirmar<\/button>/.test(html));
  // La lógica de validación (espejo): trim, recorte a 8, vacío rechazado.
  function validar(s) { const v = String(s).trim().slice(0, 8); return v.length < 1 ? null : v; }
  chk('"  Ana  " → "Ana"', validar('  Ana  ') === 'Ana');
  chk('"" → null (rechazado)', validar('') === null && validar('   ') === null);
  chk('"ABCDEFGHIJ" → recorta a 8', validar('ABCDEFGHIJ') === 'ABCDEFGH');
}

console.log('=== ROBUSTEZ: almacén roto → se juega igual, se re-pide luego (no bloquea) ===');
{
  // Sin almacén (localStorage e IDB null): no lanza, valor vacío.
  let lanzo = false, s;
  try { s = U.crearTextoPersistente(null, null, KEY); s.guardar('X'); s.reconciliar(); } catch (e) { lanzo = true; }
  chk('crearTextoPersistente(null,null) no lanza', !lanzo && s.valor === 'X');
  chk('arranque: sin almacén → jugar SIN nombre (no bloquea)', /else mostrarPantallaInicio\(\);/.test(main) && /const puedeGuardarNombre = !!\(almacen \|\| idbKV\);/.test(main));
  chk('confirmarNombre guarda best-effort (try/catch, no bloquea)', /try \{ nombreStore\.guardar\(v\); \} catch \(e\) \{[\s\S]{0,80}se re-pide luego/.test(main));
  // setItem que lanza no rompe.
  const localMalo = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  let lanzo2 = false; try { U.crearTextoPersistente(localMalo, null, KEY).guardar('Y'); } catch (e) { lanzo2 = true; }
  chk('setItem que lanza no rompe (guardar blindado)', !lanzo2);
}

console.log('=== NOTA: local hoy, sin red (ranking futuro) ===');
{
  chk('documentado: local hoy, ranking global futuro, sin red', /cobrará sentido con el ranking\s*\/\/ global futuro \(no se construye nada de red/.test(main));
}

console.log(`\n== RESUMEN usuario: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
