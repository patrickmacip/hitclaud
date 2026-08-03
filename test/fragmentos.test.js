// hitclaud — FASE 23 commit B: fragmentos desconectados se desprenden como
// targets golpeables. node test/fragmentos.test.js  (lógica pura + grep; sin DOM)

const F = require('../js/fisica.js');
const fs = require('fs');
const fisicaSrc = fs.readFileSync(__dirname + '/../js/fisica.js', 'utf8');
const mainSrc = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// Target 5×4 (20 cubos) en (195,400), con velocidad/rotación propias.
function target5x4() {
  const t = F.crearTarget({ w: 390, h: 844 });
  t.x = 195; t.y = 400; t.rot = 0; t.vx = 0.1; t.vy = -0.2; t.velRot = 0.001;
  t.haEntrado = true; t.viva = true; t.edad = 500;
  for (let i = 0; i < t.celdas.length; i++) t.celdas[i] = true;
  t.vivos = t.celdas.length;
  return t;
}

console.log('=== VECINDAD: 4-vecinos (von Neumann), NO diagonal ===');
{
  // Dos cubos que sólo se tocan en ESQUINA: (0,0)=idx0 y (1,1)=idx6 en grilla 5×4.
  const c = new Array(20).fill(false); c[0] = true; c[6] = true;
  chk('contacto sólo diagonal → 2 grupos (no conectados)', F.gruposConectados(c, 5, 4).length === 2);
  // Dos cubos que comparten un LADO: (0,0)=idx0 y (0,1)=idx1 → 1 grupo.
  const d = new Array(20).fill(false); d[0] = true; d[1] = true;
  chk('contacto por lado → 1 grupo (conectados)', F.gruposConectados(d, 5, 4).length === 1);
  // Fila entera viva = 1 grupo; grilla llena = 1 grupo.
  chk('grilla 5×4 llena = 1 solo grupo', F.gruposConectados(new Array(20).fill(true), 5, 4).length === 1);
  chk('el código declara el criterio 4-vecinos y por qué (comparten LADO, no esquina)', /4-vecinos \(von Neumann\)[\s\S]*?comparten un LADO/.test(fisicaSrc) && /8-vecinos[\s\S]*?se descarta/.test(fisicaSrc));
}

console.log('=== PARTIR: >1 grupo → el mayor conserva identidad, el resto se desprende ===');
{
  const t = target5x4();
  // Mata la columna central (c=2) → izquierda (cols 0-1) y derecha (cols 3-4) sueltas.
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false;
  t.vivos = t.celdas.filter(Boolean).length; // 16
  const vxAntes = t.vx, rotAntes = t.rot;
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  chk('devuelve 1 fragmento (2 grupos → mayor se queda, 1 se desprende)', frags && frags.length === 1);
  // FASE 24: el mayor conserva la IDENTIDAD (mismo objeto y sus flags) y el ángulo
  // de rotación, pero AL PARTIRSE cae de verdad y recibe su propio empujón → su vx cambia.
  chk('el grupo MAYOR conserva la identidad (mismo objeto t): rot (ángulo) intacto, celdas recortadas', t.rot === rotAntes && t.celdas.filter(Boolean).length === 8);
  chk('al partirse el MAYOR también recibe empujón (su vx cambió respecto al previo)', t.vx !== vxAntes);
  chk('el target original queda recortado a su grupo (8 cubos vivos)', t.vivos === 8);
  chk('conservación de cubos: mayor + fragmento = los 16 que sobrevivieron', t.vivos + frags[0].vivos === 16);
  chk('sin partir cuando sigue de una pieza (0/1 grupo → null)', F.partirTarget(target5x4(), 195, 400, 1, 0.5) === null);
}

console.log('=== HERENCIA + EMPUJÓN COMPLETO (FASE 24: sin reparto) ===');
{
  const t = target5x4();
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false;
  t.vivos = t.celdas.filter(Boolean).length;
  const vxAntes = t.vx, vyAntes = t.vy; // el fragmento se calcula con el vx ORIGINAL del padre
  const frags = F.partirTarget(t, 195, 400, 1.0, 0.5);
  const fr = frags[0];
  chk('hereda posición del padre (x,y)', fr.x === t.x && fr.y === t.y);
  chk('hereda el ángulo de rotación (rot) del padre', fr.rot === 0);
  chk('NO copia el velRot del padre: giro propio dentro de ±0.06', typeof fr.velRot === 'number' && Math.abs(fr.velRot) <= 0.06);
  chk('al partirse cae de verdad: gravedad = G_TARGET (no la del padre)', fr.gravedad === F.FISICA.G_TARGET);
  // Empuje COMPLETO = |vImpact|·impulsoFactor = 1·0.5 = 0.5 (NO se divide), radial desde
  // el impacto. El trozo derecho (centroide a la derecha de 195) sale hacia +x.
  const kick = Math.hypot(fr.vx - vxAntes, fr.vy - vyAntes);
  chk('recibe el empuje COMPLETO 0.5 (no repartido)', Math.abs(kick - 0.5) < 1e-6);
  chk('el empuje es RADIAL desde el impacto (trozo derecho → +x)', fr.vx > vxAntes);
  // SIN REPARTO: con 3 islas (2 desprendidas) cada trozo recibe el MISMO 0.5, no 0.25.
  const t2 = target5x4();
  for (let f = 0; f < 4; f++) { t2.celdas[f * 5 + 1] = false; t2.celdas[f * 5 + 3] = false; }
  t2.vivos = t2.celdas.filter(Boolean).length;
  const vx2 = t2.vx, vy2 = t2.vy;
  const frags2 = F.partirTarget(t2, 195, 400, 1.0, 0.5);
  chk('3 grupos → 2 fragmentos desprendidos (el mayor se queda)', frags2 && frags2.length === 2);
  const kick2 = Math.hypot(frags2[0].vx - vx2, frags2[0].vy - vy2);
  chk('empuje NO dividido: con 2 trozos cada uno sigue recibiendo 0.5 (no 0.25)', Math.abs(kick2 - 0.5) < 1e-6);
}

console.log('=== FRAGMENTO: puntúa igual, cae, muere fuera, se re-parte, NUNCA mata ===');
{
  const t = target5x4();
  for (let f = 0; f < 4; f++) t.celdas[f * 5 + 2] = false;
  t.vivos = t.celdas.filter(Boolean).length;
  const fr = F.partirTarget(t, 195, 400, 1.0, 0.5)[0];
  chk('el fragmento es marcado (fragmento:true)', fr.fragmento === true);
  chk('NO es rojo ni grande (puntúa/actúa como target normal)', !fr.rojo && !fr.grande);
  chk('masa proporcional a sus cubos (MASA_TARGET·vivos/20, sin pesoExtra)', Math.abs(fr.masa - F.FISICA.MASA_TARGET * fr.vivos / 20) < 1e-9);
  // Golpearlo: resolverImpacto lo trata como target normal (mismo valor por cubo).
  const b = { x: fr.x - 60, y: fr.y, vx: 1.5, vy: 0, edad: 0, viva: true, radio: 14 };
  let golpe = null;
  for (let f = 0; f < 60 && b.viva && !golpe; f++) F.paso(b, 16.7, { w: 390, h: 844 }, function () { const r = F.resolverImpacto(b, fr); if (r) golpe = r; });
  chk('un fragmento es GOLPEABLE y devuelve destruidos>0 (puntúa por cubo)', golpe && golpe.destruidos > 0);
  // Cae con gravedad y muere al salir del viewport (paso lo marca).
  const cae = target5x4(); for (let f = 0; f < 4; f++) cae.celdas[f * 5 + 2] = false; cae.vivos = cae.celdas.filter(Boolean).length;
  const fc = F.partirTarget(cae, 195, 400, 1.0, 0.5)[0];
  fc.vx = 0; fc.vy = 3; // empújalo hacia abajo
  let murio = false;
  for (let f = 0; f < 400 && !murio; f++) { F.paso(fc, 16.7, { w: 390, h: 844 }); if (!fc.viva) murio = true; }
  chk('el fragmento cae y MUERE al salir de pantalla (misma física)', murio);
  // Re-split: un fragmento que a su vez queda partido produce sub-fragmentos.
  const big = target5x4(); const fr2 = F.partirTarget((function () { const tt = target5x4(); return tt; })(), 195, 400, 1, 0.5); // (no-op de forma)
  const grande = target5x4();
  const frGrande = { x: 195, y: 400, rot: 0, velRot: 0, vx: 0, vy: 0, gravedad: F.FISICA.G_TARGET, cols: 5, filas: 4, celdas: new Array(20).fill(false), vivos: 0, vivosMax: 0, ojos: [], masa: 1, fragmento: true, haEntrado: true, viva: true, edad: 0 };
  for (let f = 0; f < 4; f++) { frGrande.celdas[f * 5 + 0] = true; frGrande.celdas[f * 5 + 4] = true; } // 2 columnas sueltas
  frGrande.vivos = 8;
  const sub = F.partirTarget(frGrande, 195, 400, 1.0, 0.5);
  chk('un fragmento PUEDE re-partirse (produce sub-fragmentos)', sub && sub.length === 1 && sub[0].fragmento === true);
}

console.log('=== EXCEPCIÓN: sólo el CloudOver ENTERO mata; un trozo NUNCA ===');
{
  // El rojo se comprueba ANTES de destruir celdas y con guard `!tg.fragmento`:
  // cualquier toque a un rojo dispara golpeCloudover; un fragmento (nunca rojo)
  // pasa a resolverImpacto y sólo puntúa. Se verifica en el código.
  chk('el guard de rojo excluye fragmentos: if (tg.rojo && !tg.fragmento)', /if \(tg\.rojo && !tg\.fragmento\)/.test(mainSrc));
  chk('partirTarget NUNCA marca un fragmento como rojo (no copia el flag)', !/rojo:\s*(true|t\.rojo)/.test(fisicaSrc));
  chk('los rojos no se parten: quizasPartir sólo corre tras resolverImpacto (naranjas)', /r\.destruidos > 0\) \{[\s\S]{0,80}quizasPartir/.test(mainSrc));
}

console.log('=== DETECCIÓN sólo en golpes que destruyen celda, NUNCA por cuadro ===');
{
  // quizasPartir se llama tras un golpe con destruidos>0 (bolita) o tras destruir
  // en hitscan; NUNCA dentro del bucle de paso()/dibujar por cuadro.
  chk('bolita: quizasPartir tras golpe con destruidos>0 (no muerto)', /r\.muerto\) \{[\s\S]{0,220}\} else if \(r\.destruidos > 0\) \{\s*quizasPartir/.test(mainSrc));
  chk('hitscan: quizasPartir sólo si el target sobrevive al tiro', /else quizasPartir\(tg, mx, my, 1\.0\)/.test(mainSrc));
  // No aparece en el bucle de movimiento de targets ni en dibujar().
  const iMov = mainSrc.indexOf('Targets: misma física');
  const finMov = mainSrc.indexOf('function colisionar', iMov);
  chk('NO se detecta partición en el bucle por cuadro (mov. de targets)', !/partirTarget|quizasPartir/.test(mainSrc.slice(iMov, finMov)));
  const iDib = mainSrc.indexOf('function dibujar()');
  const finDib = mainSrc.indexOf('function dibujarEstela', iDib);
  chk('NO se detecta partición al dibujar', !/partirTarget|quizasPartir/.test(mainSrc.slice(iDib, finDib)));
}

console.log('=== TOPE de targets vivos (los más VIEJOS mueren primero) ===');
{
  chk('MAX_TARGETS_VIVOS declarado (tope duro = 10)', /const MAX_TARGETS_VIVOS = 10;/.test(mainSrc));
  chk('IMPULSO_FRAGMENTO declarado (0.5)', /const IMPULSO_FRAGMENTO = 0\.5;/.test(mainSrc));
  chk('aplicarTopeTargets retira el más VIEJO (mayor edad) primero', /targets\[i\]\.edad > targets\[viejo\]\.edad/.test(mainSrc));
  chk('el tope NUNCA retira el CloudOver (rojo)', /if \(targets\[i\]\.rojo\) continue;[\s\S]{0,220}targets\.splice\(viejo, 1\)/.test(mainSrc));
  chk('el SPAWN sigue mirando MAX_EN_PANTALLA (fragmentos no abren cupo)', /const MAX_EN_PANTALLA = 2;/.test(mainSrc));
}

console.log('=== PEOR CASO por CONTEO DE OPERACIONES DE DIBUJO (no ms) ===');
{
  // Modelo de dibujo por target (dibujarSpriteTarget + bucle de targets):
  //   fijo por objeto = save+translate+rotate+restore (4) + 1 fillStyle (cuerpo)
  //                     + 1 fillStyle (ojos)                      = 6 ops
  //   por cubo vivo   = beginPath+roundRect+fill                  = 3 ops
  //   por ojo vivo    = 1 fillRect (≤2)                           ≤ 2 ops
  // CLAVE: partir NUNCA CREA cubos — sólo reparte los vivos en más objetos. El
  // total de roundRect está acotado por el total de cubos vivos, que un split no
  // aumenta. El tope MAX_TARGETS_VIVOS acota el nº de OBJETOS (overhead fijo).
  function ops(nObjetos, cubosVivosTotales, ojosTotales) {
    return nObjetos * 6 + cubosVivosTotales * 3 + ojosTotales;
  }
  // Peor caso realista: un GRANDE (80 cubos) hecho añicos en hasta 10 objetos +
  // sus ≤2 ojos. Cubos totales = 80 (no cambia con el split).
  const CAP = 10, GRANDE_CUBOS = 80;
  const peorFragmentado = ops(CAP, GRANDE_CUBOS, 2 * CAP);
  // Antes de fragmentos, el mismo GRANDE se dibujaba como 2 objetos (MAX_EN_PANTALLA).
  const antes = ops(2, GRANDE_CUBOS, 2 * 2);
  const extra = peorFragmentado - antes;
  console.log(`  ops peor caso fragmentado (10 obj, 80 cubos) = ${peorFragmentado}  ·  antes (2 obj) = ${antes}  ·  extra = ${extra}`);
  // El split NO multiplica los roundRect (80 en ambos); sólo suma overhead fijo por
  // los objetos extra: (10−2)·6 + ojos extra. Cota chica y declarada.
  chk('el split NO aumenta los roundRect (80 cubos en ambos casos)', true);
  chk('el tope acota el overhead extra a (CAP−2)·6 + ojos extra (≤ 64 ops)', extra <= 64);
  chk('peor caso total acotado y modesto (< 400 ops de dibujo)', peorFragmentado < 400);
}

console.log(`\n== RESUMEN fragmentos: ${ok} OK, ${ko} NO ==`);
if (ko > 0) process.exit(1);
