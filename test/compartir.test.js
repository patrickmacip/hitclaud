// hitclaud — compartir récord y ranking con imagen. node test/compartir.test.js
// Prueba las partes PURAS (textos, tamaño del puntaje, puesto), el DIBUJO con un ctx
// simulado (franja de récord, fila del jugador) y la CASCADA de compartir (imagen →
// texto → portapapeles) sin lanzar. El PNG real se valida aparte (ver V3 en el reporte).

const fs = require('fs');
const C = require('../js/compartir.js');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../js/main.js', 'utf8');
const css = fs.readFileSync(__dirname + '/../css/main.css', 'utf8');

let ok = 0, ko = 0;
function chk(n, c) { console.log(`  ${n}  ${c ? 'OK ✓' : 'NO ✗'}`); if (c) ok++; else ko++; }

// ── ctx simulado: registra fillText / stroke / drawImage; measureText desde el font. ──
function mockCtx() {
  const rec = { fills: [], pos: [], strokes: 0, images: 0, arcs: 0 };
  const noop = function () {};
  const ctx = {
    _font: '20px', _ls: '0px', fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, textAlign: '', textBaseline: '',
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, arcTo: noop,
    closePath: noop, fill: noop, translate: noop, rotate: noop, scale: noop, fillRect: noop,
    arc: function () { rec.arcs++; },
    stroke: function () { rec.strokes++; },
    drawImage: function () { rec.images++; },
    measureText: function (s) { const m = /(\d+)px/.exec(ctx._font || ''); const px = m ? +m[1] : 20; return { width: String(s).length * px * 0.6 }; },
    fillText: function (t, x, y) { rec.fills.push(String(t)); rec.pos.push({ t: String(t), x: x, y: y }); },
  };
  Object.defineProperty(ctx, 'font', { get() { return ctx._font; }, set(v) { ctx._font = v; } });
  Object.defineProperty(ctx, 'letterSpacing', { get() { return ctx._ls; }, set(v) { ctx._ls = v; } });
  ctx._rec = rec;
  return ctx;
}
function yDe(rec, texto) { const p = rec.pos.find(function (o) { return o.t === texto; }); return p ? p.y : null; }
function tituloRank(rec) { return rec.fills.find(function (s) { return s.indexOf(' · ') !== -1; }); }

(async function () {
  console.log('=== V4: los textos de compartir en los tres casos (4.1/4.2/4.3) ===');
  {
    chk('récord', C.textoRecord({ puntos: 4200, modo: '15' }) === '4200 puntos en HitClaud, modo 15s. ¿Le ganas?\nhttps://patrickmacip.github.io/hitclaud');
    chk('ranking dentro del top', C.textoRanking({ modo: '30', puesto: 7 }) === 'Top 3 de HitClaud, modo 30s. Yo voy en el puesto 7.\nhttps://patrickmacip.github.io/hitclaud');
    chk('ranking fuera del top', C.textoRanking({ modo: '60', puesto: null }) === 'Top 3 de HitClaud, modo 60s.\nhttps://patrickmacip.github.io/hitclaud');
    chk('puesto > 20 se trata como fuera del top', C.textoRanking({ modo: '15', puesto: 44 }).indexOf('puesto') === -1);
    chk('el enlace va SIEMPRE al final', /hitclaud$/.test(C.textoRecord({ puntos: 1, modo: '15' })) && /hitclaud$/.test(C.textoRanking({ modo: '15', puesto: 1 })));
  }

  console.log('=== V4: un puntaje de muchos dígitos NO se desborda de la tarjeta ===');
  {
    const anchoUtil = C.LADO - 2 * C.MARGEN; // 920
    const medir = function (txt, px) { return txt.length * px * 0.6; };
    const t4 = C.tamPuntaje('4200', anchoUtil, medir, 300);
    const t6 = C.tamPuntaje('123456', anchoUtil, medir, 300);
    const t9 = C.tamPuntaje('999999999', anchoUtil, medir, 300);
    chk('4 dígitos usa el tamaño máximo (300)', t4 === 300);
    chk('más dígitos → menor tamaño (6 < 4, 9 < 6)', t6 < t4 && t9 < t6);
    chk('ningún caso se desborda (ancho ≤ útil)', medir('4200', t4) <= anchoUtil && medir('123456', t6) <= anchoUtil && medir('999999999', t9) <= anchoUtil);
  }

  console.log('=== V4: la cinta "NUEVO RÉCORD" sólo aparece cuando corresponde (CAMBIO 1) ===');
  {
    const conRec = mockCtx(); C.dibujarTarjetaRecord(conRec, { puntos: 1234, modo: '15', nombre: 'PAT', esRecord: true });
    const sinRec = mockCtx(); C.dibujarTarjetaRecord(sinRec, { puntos: 123456, modo: '30', nombre: 'PAT', esRecord: false });
    chk('con récord nuevo → dibuja "NUEVO RÉCORD"', conRec._rec.fills.indexOf('NUEVO RÉCORD') !== -1);
    chk('sin récord nuevo → NO dibuja la cinta', sinRec._rec.fills.indexOf('NUEVO RÉCORD') === -1);
    chk('el puntaje completo se dibuja (123456)', sinRec._rec.fills.indexOf('123456') !== -1);
    chk('el modo se dibuja en palabras ("30 segundos")', sinRec._rec.fills.indexOf('30 segundos') !== -1);
    // 1.4: el puntaje queda en el MISMO sitio con o sin récord (no se mueve).
    chk('el puntaje no se mueve entre récord y no-récord (mismo Y)', yDe(conRec._rec, '1234') === yDe(sinRec._rec, '123456'));
  }

  console.log('=== V4: nada se superpone al título "HitClaud" (D1/1.3) ===');
  {
    // La cinta va DEBAJO del título y ENCIMA del puntaje: título < cinta < puntaje (Y crece hacia abajo).
    const c = mockCtx(); C.dibujarTarjetaRecord(c, { puntos: 4200, modo: '15', nombre: 'PAT', esRecord: true });
    const yTit = yDe(c._rec, 'HitClaud'), yCinta = yDe(c._rec, 'NUEVO RÉCORD'), ySc = yDe(c._rec, '4200');
    chk('orden vertical título < cinta < puntaje (nada tapa el título)', yTit < yCinta && yCinta < ySc);
    // En la tarjeta de ranking el título también queda arriba, sin nada encima.
    const r = mockCtx(); C.dibujarTarjetaRanking(r, { modo: '15', top: [{ nombre: 'A', puntos: 9 }], nombre: 'A' });
    const yH = yDe(r._rec, 'HitClaud'), yT = yDe(r._rec, tituloRank(r._rec));
    chk('ranking: "HitClaud" arriba y el subtítulo debajo', yH < yT);
  }

  console.log('=== V4: el título del ranking dice la verdad (CAMBIO 2) ===');
  {
    const t3 = mockCtx(); C.dibujarTarjetaRanking(t3, { modo: '30', top: [1, 2, 3].map(function (i) { return { nombre: 'J' + i, puntos: i }; }), nombre: 'J1' });
    const t2 = mockCtx(); C.dibujarTarjetaRanking(t2, { modo: '15', top: [{ nombre: 'A', puntos: 2 }, { nombre: 'B', puntos: 1 }], nombre: 'A' });
    const t1 = mockCtx(); C.dibujarTarjetaRanking(t1, { modo: '60', top: [{ nombre: 'SOLO', puntos: 9 }], nombre: 'SOLO' });
    chk('con 3 puntajes → "TOP 3 · 30 SEGUNDOS"', tituloRank(t3._rec) === 'TOP 3 · 30 SEGUNDOS');
    chk('con 2 puntajes → "RANKING · 15 SEGUNDOS" (no miente con TOP 3)', tituloRank(t2._rec) === 'RANKING · 15 SEGUNDOS');
    chk('con 1 puntaje → "RANKING · 60 SEGUNDOS"', tituloRank(t1._rec) === 'RANKING · 60 SEGUNDOS');
  }

  console.log('=== V4: la firma (bolita coral con estela) también en el ranking (CAMBIO 4) ===');
  {
    const r = mockCtx(); C.dibujarTarjetaRanking(r, { modo: '15', top: [{ nombre: 'A', puntos: 9 }], nombre: 'A' });
    chk('el ranking dibuja la bolita/estela (arcos de círculo)', r._rec.arcs > 0);
  }

  console.log('=== D1: la cinta de récord NUNCA toca los dígitos (aire proporcional) ===');
  {
    const medir = function (txt, px) { return txt.length * px * 0.6; };
    const s4 = C.tamPuntaje('4200', C.LADO - 2 * C.MARGEN, medir, 300);   // 4 dígitos
    const s6 = C.tamPuntaje('428750', C.LADO - 2 * C.MARGEN, medir, 300); // 6 dígitos
    const g4 = C._cintaRecord(s4, 560), g6 = C._cintaRecord(s6, 560);
    const gap4 = g4.digitTop - (g4.cy + g4.h / 2), gap6 = g6.digitTop - (g6.cy + g6.h / 2);
    chk('con 4 dígitos hay aire (>0) entre la cinta y el tope del dígito', gap4 > 0);
    chk('con 6 dígitos hay aire (>0) entre la cinta y el tope del dígito', gap6 > 0);
    chk('el aire es proporcional al tamaño (más grande el puntaje, más aire)', s4 > s6 ? gap4 > gap6 : gap4 <= gap6);
    chk('la cinta queda ENCIMA del tope del dígito (cy < digitTop)', g4.cy < g4.digitTop && g6.cy < g6.digitTop);
  }

  console.log('=== D2/D3: la bolita y su estela caben en los márgenes y no pisan filas/pie ===');
  {
    const M = C.MARGEN, L = C.LADO;
    function dentro(b) { return b.minX >= M && b.minY >= M && b.maxX <= L - M && b.maxY <= L - M; }
    const fr = C.FIRMA_RECORD, fk = C.FIRMA_RANKING;
    const br = C._firmaBounds(fr.cx, fr.cy, fr.r, fr.dir);
    const bk = C._firmaBounds(fk.cx, fk.cy, fk.r, fk.dir);
    chk('firma del RÉCORD entera dentro de los márgenes (80..1000)', dentro(br));
    chk('firma del RANKING entera dentro de los márgenes (80..1000)', dentro(bk));
    // La firma del ranking vive por ENCIMA de la franja de filas → no pisa filas, ni la caja
    // del jugador, ni el pie (todos ≥ RANK_REG_TOP, y el pie más abajo aún).
    chk('firma del ranking por encima de las filas (maxY ≤ RANK_REG_TOP)', bk.maxY <= C.RANK_REG_TOP);
  }

  console.log('=== V4: la fila del jugador sólo aparece si está en top 20 y NO en el podio ===');
  {
    const top = [];
    for (let i = 1; i <= 20; i++) top.push({ nombre: 'J' + i, puntos: 2000 - i * 10 });
    // Jugador en el puesto 7 → fila extra + línea separadora (stroke).
    const c7 = mockCtx(); C.dibujarTarjetaRanking(c7, { modo: '15', top: top, nombre: 'J7' });
    chk('puesto 7 (top 20, no podio) → hay fila extra (separador con stroke)', c7._rec.strokes >= 1 && c7._rec.fills.indexOf('7') !== -1);
    // Jugador en el podio (puesto 1) → NO se repite abajo, sin separador.
    const c1 = mockCtx(); C.dibujarTarjetaRanking(c1, { modo: '15', top: top, nombre: 'J1' });
    chk('puesto 1 (podio) → NO hay fila extra (sin separador)', c1._rec.strokes === 0);
    // Jugador fuera del top 20 → sin fila extra.
    const cFuera = mockCtx(); C.dibujarTarjetaRanking(cFuera, { modo: '15', top: top, nombre: 'DESCONOCIDO' });
    chk('fuera del top 20 → sin fila extra', cFuera._rec.strokes === 0);
    // Menos de 3 puntajes → dibuja los que haya, sin romper (3.7).
    const cUno = mockCtx(); C.dibujarTarjetaRanking(cUno, { modo: '60', top: [{ nombre: 'SOLO', puntos: 999 }], nombre: 'SOLO' });
    chk('con 1 solo puntaje se dibuja sin lanzar', cUno._rec.fills.indexOf('SOLO') !== -1);
    chk('puesto 1 con 1 puntaje no repite fila (podio)', cUno._rec.strokes === 0);
  }

  console.log('=== V4: la cascada de compartir cae de imagen → texto → portapapeles, sin lanzar ===');
  {
    // Node 26 trae un `navigator` global de sólo lectura → hay que forzar el reemplazo con
    // defineProperty (en el navegador real esto NO ocurre; el código usa el navigator del SO).
    const fileReal = global.File;
    function setNav(n) { Object.defineProperty(globalThis, 'navigator', { value: n, configurable: true, writable: true }); }
    global.File = function (parts, name, opts) { this.name = name; this.type = opts && opts.type; };
    const blobFalso = { size: 10 };

    // (a) Soporta imagen pero compartir la IMAGEN falla → cae a TEXTO (share de texto OK).
    setNav({
      canShare: function () { return true; },
      share: function (data) { return (data && data.files) ? Promise.reject(new Error('no img')) : Promise.resolve(); },
    });
    let via = (await C._compartir('hola', blobFalso, 'x.png')).via;
    chk('imagen falla → cae a texto (sin excepción)', via === 'texto');

    // (b) Compartir falla del todo (share siempre rechaza) → copia al portapapeles.
    let copiado = null;
    setNav({
      canShare: function () { return true; },
      share: function () { return Promise.reject(new Error('nope')); },
      clipboard: { writeText: function (t) { copiado = t; return Promise.resolve(); } },
    });
    via = (await C._compartir('texto+enlace', blobFalso, 'x.png')).via;
    chk('compartir falla del todo → copia al portapapeles', via === 'portapapeles' && copiado === 'texto+enlace');

    // (c) Sin navigator.share y sin clipboard → 'nada', pero NUNCA lanza.
    setNav({});
    via = (await C._compartir('t', null, 'x.png')).via;
    chk('sin ningún soporte → resuelve "nada" sin lanzar', via === 'nada');

    // (d) La API pública nunca lanza aunque no haya DOM (canvas), resuelve una vía.
    setNav({ clipboard: { writeText: function () { return Promise.resolve(); } } });
    let lanzo = false, r = null;
    try { r = await C.compartirRecord({ puntos: 500, modo: '15', nombre: 'PAT', esRecord: true }); } catch (e) { lanzo = true; }
    chk('compartirRecord no lanza sin DOM y resuelve una vía', !lanzo && r && typeof r.via === 'string');
    try { r = await C.compartirRanking({ modo: '15', top: [{ nombre: 'PAT', puntos: 9 }], nombre: 'PAT' }); } catch (e) { lanzo = true; }
    chk('compartirRanking no lanza sin DOM y resuelve una vía', !lanzo && r && typeof r.via === 'string');

    global.File = fileReal;
  }

  console.log('=== V4: los botones existen y están cableados ===');
  {
    chk('botón Compartir en el fin de partida (contorno, como Ranking)', /<button id="compartirFin" class="ini-ranking"[\s\S]{0,120}#ic-compartir/.test(html));
    chk('botón Compartir en el ranking (icono en la cabecera)', /<button id="compartirRank" class="hdr-icono"[\s\S]{0,140}#ic-compartir/.test(html));
    chk('icono de compartir definido (SVG monocromo, currentColor)', /<symbol id="ic-compartir"/.test(html));
    chk('compartirFin cableado → Compartir.compartirRecord', /compartirFin[\s\S]{0,260}Compartir\.compartirRecord\(/.test(main));
    chk('compartirRank cableado → Compartir.compartirRanking (duración seleccionada + top actual)', /compartirRank[\s\S]{0,260}Compartir\.compartirRanking\(\{ modo: modoInicioSel, top: rankTopActual/.test(main));
    chk('el botón muestra que trabaja mientras genera (5.3)', /marcarCompartiendo\([^,]+, true\)/.test(main) && /Generando…/.test(main));
    chk('área táctil del botón ≥44px (reusa .ini-ranking, min-height 52)', /\.ini-ranking \{[\s\S]{0,200}min-height: 52px/.test(css));
    chk('script de compartir.js ANTES de main.js', main && /compartir\.js"><\/script>\s*<script src="js\/main\.js"/.test(html));
  }

  console.log(`\n== RESUMEN compartir: ${ok} OK, ${ko} NO ==`);
  if (ko > 0) process.exit(1);
})();
