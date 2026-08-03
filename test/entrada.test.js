// hitclaud — FASE 28: targets NO golpeables antes de ENTRAR a escena.
// node test/entrada.test.js  (lógica pura F/P + réplica del guard de main.js + grep)

const fs = require('fs');
const F = require('../js/fisica.js');
const P = require('../js/puntuacion.js');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

const W = 390, H = 844;
// Target lateral-der recién spawneado: CENTRO fuera del viewport (x=398>390), pero su
// caja (hw=20 → 378..418) solapa el borde derecho. Como en el repro del diagnóstico.
function targetBorde(extra) {
  const t = F.crearTarget({ w: W, h: H }, 5, 4);
  t.x = W + 8; t.y = 400; t.vx = -0.3; t.vy = 0; t.rot = 0; t.velRot = 0;
  for (let i = 0; i < t.celdas.length; i++) t.celdas[i] = true;
  t.vivos = 20; t.haEntrado = false;
  if (extra) for (const k in extra) t[k] = extra[k];
  return t;
}
function bolaEntrando() { return { x: 380, y: 400, vx: 1.5, vy: 0, edad: 0, viva: true, radio: 14, golpes: 0, tocado: false }; }

// Réplica EXACTA del guard de colisionar (main.js): se salta el target si !haEntrado,
// ANTES de todo (rojo y naranja). Devuelve {golpes, puntos, cloudover, partio}.
function rutaBola(b, targets, marcador) {
  let cloudover = false, partio = false;
  for (let ti = targets.length - 1; ti >= 0; ti--) {
    const tg = targets[ti];
    if (!tg.haEntrado) continue;                 // ← el guard de la fase 28
    if (tg.rojo && !tg.fragmento) { if (F.colisionCirculoRect(b, tg)) { cloudover = true; return { cloudover: cloudover }; } continue; }
    const r = F.resolverImpacto(b, tg);
    if (!r) continue;
    b.golpes += 1;
    if (r.destruidos > 0) P.anotarDestruidos(marcador, r.destruidos);
    if (r.destruidos > 0 && !r.muerto) partio = true; // habría entrado a quizasPartir
  }
  return { golpes: b.golpes, puntos: marcador.puntos, cloudover: cloudover, partio: partio };
}

console.log('=== El target SÍ sería golpeable por geometría (por eso hace falta el guard) ===');
{
  const t = targetBorde();
  const b = bolaEntrando();
  const r = F.resolverImpacto(b, t); // llamada directa (sin guard) → prueba el solapamiento
  chk('resolverImpacto directo devuelve HIT (la caja solapa el borde)', !!r && r.destruidos > 0);
}

console.log('=== Con haEntrado=false: NO resuelve, NO suma golpe, NO puntúa, NO se parte ===');
{
  const t = targetBorde();
  const b = bolaEntrando();
  const marcador = { puntos: 0, racha: 0 };
  const res = rutaBola(b, [t], marcador);
  chk('el contador de golpes de la bola NO sube (golpes=0)', res.golpes === 0);
  chk('no se anotan puntos por ese target (puntos=0)', res.puntos === 0);
  chk('no se parte en islas (no llegó a quizasPartir)', res.partio === false);
  chk('el target queda INTACTO (20 celdas vivas: no se destruyó nada)', t.celdas.filter(Boolean).length === 20 && t.vivos === 20);
}

console.log('=== Un ROJO con haEntrado=false NO dispara CloudOver ===');
{
  const rojo = targetBorde({ rojo: true });
  const b = bolaEntrando();
  const res = rutaBola(b, [rojo], { puntos: 0, racha: 0 });
  chk('rojo no-entrado NO dispara CloudOver', res.cloudover === false);
}

console.log('=== Caso NORMAL: con haEntrado=true SÍ resuelve (no rompimos lo bueno) ===');
{
  const t = targetBorde({ haEntrado: true });
  const b = bolaEntrando();
  const marcador = { puntos: 0, racha: 0 };
  const res = rutaBola(b, [t], marcador);
  chk('target entrado → resuelve impacto y suma 1 golpe', res.golpes === 1);
  chk('target entrado → anota puntos (>0)', res.puntos > 0);
  // Y un rojo entrado SÍ dispara CloudOver.
  const rojo = targetBorde({ rojo: true, haEntrado: true });
  const res2 = rutaBola(bolaEntrando(), [rojo], { puntos: 0, racha: 0 });
  chk('rojo entrado SÍ dispara CloudOver (CloudOver sigue funcionando)', res2.cloudover === true);
}

console.log('=== Fragmentos/islas: nacen con haEntrado=true → golpeables de inmediato ===');
{
  const t = targetBorde({ haEntrado: true, x: 195 }); // en pantalla, para partir
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false; // parte en 2 islas
  t.vivos = t.celdas.filter(Boolean).length;
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  chk('el fragmento nace con haEntrado=true', frags[0].haEntrado === true);
  // Un fragmento con haEntrado=true PASA el guard y es golpeable.
  const fr = frags[0]; fr.x = 195; fr.y = 400; for (let i = 0; i < fr.celdas.length; i++) if (fr.celdas[i]) { }
  const b = { x: 195, y: 400, vx: 0.1, vy: 0, edad: 0, viva: true, radio: 14, golpes: 0 };
  const res = rutaBola(b, [fr], { puntos: 0, racha: 0 });
  chk('el fragmento entrado es golpeable de inmediato (golpes=1)', res.golpes === 1);
}

console.log('=== main.js consulta haEntrado en AMBAS rutas (bola y hitscan) ===');
{
  // Ruta de la bola: dentro de colisionar, ANTES del chequeo de rojo.
  chk('colisionar salta el target no-entrado antes de todo', /function colisionar\(b\) \{[\s\S]{0,700}if \(!tg\.haEntrado\) continue;[\s\S]{0,120}if \(tg\.rojo && !tg\.fragmento\)/.test(main));
  // Ruta de hitscan: antes de celdaEnPunto.
  chk('hitscan salta el target no-entrado antes de celdaEnPunto', /if \(!tg\.haEntrado\) continue;[\s\S]{0,120}const idx = F\.celdaEnPunto\(tg, mx, my\)/.test(main));
  // Exactamente dos consultas nuevas (una por ruta) + ninguna otra referencia rara.
  chk('main.js consulta haEntrado exactamente en 2 sitios (bola + hitscan)', (main.match(/!tg\.haEntrado/g) || []).length === 2);
}

console.log(`\n== RESUMEN entrada: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
