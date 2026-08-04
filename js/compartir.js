// hitclaud — compartir.js
// ÚNICO punto que genera imágenes y comparte. Ninguna otra parte del juego dibuja
// tarjetas ni habla con navigator.share/clipboard. REGLAS DURAS: todo en try/catch (un
// fallo al compartir JAMÁS rompe el juego); el canvas de la tarjeta se crea al momento de
// compartir y se descarta después (no se retiene en memoria); cascada de fallos que NUNCA
// deja al usuario sin nada ni muestra un error técnico. Corre en navegador (window.Compartir)
// y en node (module.exports) — en node no hay canvas, así que sólo las partes puras y el
// cableado de compartir son ejercitables; el dibujo se prueba con un ctx simulado.

(function (global) {
  'use strict';

  // Util: en node se requiere; en navegador ya está en window.Util. Sin modificar util.js.
  var U = (typeof module !== 'undefined' && module.exports)
    ? require('./util.js')
    : (global.Util || (typeof window !== 'undefined' ? window.Util : null));

  var ENLACE = 'https://patrickmacip.github.io/hitclaud';
  var DIR_CORTA = 'patrickmacip.github.io/hitclaud';
  var LADO = 1080;      // 2.1/3.1: tarjeta cuadrada 1080×1080
  var MARGEN = 80;      // 2.4: mínimo 80px por lado
  var TIMEOUT_MS = 3000; // 5.3: si la imagen tarda más, se cae a texto
  var FUENTE = "'Inter', system-ui, -apple-system, sans-serif";
  var MONO = 'ui-monospace, Menlo, monospace';

  // ── Tokens con respaldo (2.5): nunca vacíos; funciona sin getComputedStyle (node/tests). ──
  function tokens() {
    var cs = null;
    try { if (typeof getComputedStyle !== 'undefined' && typeof document !== 'undefined') cs = getComputedStyle(document.documentElement); } catch (e) {}
    function tk(n, r) {
      try { return (U && U.leerToken) ? U.leerToken(n, r, cs ? cs.getPropertyValue(n) : '') : r; }
      catch (e) { return r; }
    }
    return {
      bg: tk('--bg', '#121216'),
      coral: tk('--coral', '#E8704E'),
      coralVivo: tk('--acento-vivo', '#FF8764'),
      blanco: tk('--blanco', '#FFFFFF'),
      tenue: tk('--texto-apagado', '#8989B1'),
      negro: tk('--negro', '#000000'),
    };
  }

  // ── Helpers PUROS (testeables sin DOM) ──────────────────────────────────────────
  function etiquetaModo(modo) { // '15' → '15 segundos'
    var m = String(modo);
    if (m === '15' || m === '30' || m === '60') return m + ' segundos';
    return m + ' segundos';
  }
  function _entero(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }

  // 4.1: texto del récord.
  function textoRecord(o) {
    o = o || {};
    return _entero(o.puntos) + ' puntos en HitClaud, modo ' + String(o.modo) + 's. ¿Le ganas?\n' + ENLACE;
  }
  // Puesto (1-based) del jugador en el top, o null si no está. PURO.
  function puestoDe(top, nombre) {
    if (!Array.isArray(top) || !nombre) return null;
    for (var i = 0; i < top.length; i++) { if (top[i] && top[i].nombre === nombre) return i + 1; }
    return null;
  }
  // 4.2/4.3: texto del ranking (con o sin puesto del jugador dentro del top 20).
  function textoRanking(o) {
    o = o || {};
    var m = String(o.modo);
    var puesto = (typeof o.puesto === 'number' && o.puesto > 0) ? o.puesto : null;
    if (puesto !== null && puesto <= 20) {
      return 'Top 3 de HitClaud, modo ' + m + 's. Yo voy en el puesto ' + puesto + '.\n' + ENLACE;
    }
    return 'Top 3 de HitClaud, modo ' + m + 's.\n' + ENLACE;
  }
  // Tamaño de fuente del puntaje: el mayor múltiplo de 4 (≤maxPx) cuyo ancho quepa en
  // `anchoUtil`. `medir(texto, px)` devuelve el ancho (ctx.measureText en el juego;
  // inyectable → testeable). Garantiza que NUNCA se desborde (2.3/V4). PURO.
  function tamPuntaje(texto, anchoUtil, medir, maxPx) {
    var s = maxPx || 300;
    while (s > 48 && medir(texto, s) > anchoUtil) s -= 4;
    return s;
  }

  // ── Dibujo (recibe un ctx; en el juego es un canvas real, en tests un ctx simulado) ──
  function fondoCascada(ctx, t) {
    ctx.save();
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, LADO, LADO);
    // 2.2: cascada de datos REALES al 12% — reutiliza U.CASC_CODIGO SIN modificarlo.
    var lineas = (U && U.CASC_CODIGO && U.CASC_CODIGO.length) ? U.CASC_CODIGO : [' '];
    ctx.fillStyle = t.tenue;
    ctx.globalAlpha = 0.12;
    ctx.font = '22px ' + MONO;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var lh = 40, y = 30, i = 0;
    while (y < LADO - 20) { ctx.fillText(lineas[i % lineas.length], 34, y); y += lh; i++; }
    ctx.restore();
  }
  // Corona vectorial simple (3 picos) en (x,y), tamaño s. Sólo ctx paths (sin Path2D →
  // corre igual con el ctx simulado de los tests).
  function dibujarCorona(ctx, x, y, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.30);
    ctx.lineTo(x + s * 0.16, y + s * 0.88);
    ctx.lineTo(x + s * 0.84, y + s * 0.88);
    ctx.lineTo(x + s, y + s * 0.30);
    ctx.lineTo(x + s * 0.72, y + s * 0.52);
    ctx.lineTo(x + s * 0.50, y + s * 0.14);
    ctx.lineTo(x + s * 0.28, y + s * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Bolita coral con estela (firma visual). Reutiliza U.estelaMeteoro con una historia
  // sintética (arco corto). Sin shadowBlur: la estela es una cola de discos que se
  // estrechan y se desvanecen (como dibujarEstela, simplificado).
  function firmaBolita(ctx, cx, cy, radio, t, dirX) {
    dirX = dirX || -1; // -1 = estela hacia la izquierda-abajo (récord); +1 = derecha-abajo (ranking)
    ctx.save();
    var hist = [];
    for (var k = 1; k <= 12; k++) hist.push({ x: cx + dirX * k * 14, y: cy + k * k * 0.9 });
    var e = (U && U.estelaMeteoro) ? U.estelaMeteoro(cx, cy, hist, radio, 24) : null;
    if (e && e.pts) {
      for (var i = 0; i < e.pts.length; i++) {
        var p = e.pts[i];
        ctx.globalAlpha = Math.max(0, p.a);
        ctx.fillStyle = t.coral;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.w), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.coral;
    ctx.beginPath(); ctx.arc(cx, cy, radio, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // CINTA horizontal "NUEVO RÉCORD" (negro sobre coral), centrada en (cx,cy). SIN inclinar
  // y del ancho JUSTO del texto + margen interno → no cruza la tarjeta ni tapa el título.
  function dibujarCinta(ctx, cx, cy, t) {
    var texto = 'NUEVO RÉCORD';
    ctx.save();
    ctx.font = '800 32px ' + FUENTE;
    try { ctx.letterSpacing = '4px'; } catch (e) {} // espaciado entre letras (navegador)
    var wText = ctx.measureText(texto).width;
    var padX = 34, h = 58;
    var wBox = wText + padX * 2;
    ctx.fillStyle = t.coral;
    _roundRect(ctx, cx - wBox / 2, cy - h / 2, wBox, h, 12);
    ctx.fill();
    ctx.fillStyle = t.negro;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, cx, cy + 1);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.restore();
  }

  // 2.3: TARJETA DE RÉCORD.
  function dibujarTarjetaRecord(ctx, o) {
    o = o || {};
    var t = tokens();
    fondoCascada(ctx, t);
    var cx = LADO / 2;
    var anchoUtil = LADO - 2 * MARGEN; // 920
    // Firma bolita: abajo-derecha, lejos del texto centrado (no lo tapa).
    firmaBolita(ctx, LADO - MARGEN - 60, LADO - MARGEN - 120, 30, t);
    // Encabezado "HitClaud" coral 64 / 800.
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = t.coral; ctx.font = '800 64px ' + FUENTE;
    ctx.fillText('HitClaud', cx, 300);
    // CINTA "NUEVO RÉCORD" JUSTO ENCIMA del puntaje (si corresponde). Se dibuja ANTES que el
    // puntaje y por encima de su tope visual → el título "HitClaud" queda SIEMPRE limpio (D1).
    // La posición del puntaje NO depende de la cinta: con o sin récord sigue centrado (1.4).
    var SCORE_Y = 560;
    var texto = String(_entero(o.puntos));
    var medir = function (txt, px) { ctx.font = '800 ' + px + 'px ' + FUENTE; return ctx.measureText(txt).width; };
    var size = tamPuntaje(texto, anchoUtil, medir, 300);
    if (o.esRecord) {
      var capTop = SCORE_Y - size * 0.36;   // tope visual aproximado del dígito
      dibujarCinta(ctx, cx, capTop - 40, t); // cinta pegada sobre el puntaje, centrada
    }
    // PUNTAJE enorme blanco, tamaño ajustado a los dígitos (nunca se desborda).
    ctx.font = '800 ' + size + 'px ' + FUENTE;
    ctx.fillStyle = t.blanco; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, cx, SCORE_Y);
    ctx.textBaseline = 'alphabetic';
    // MODO, tenue y pequeño.
    ctx.fillStyle = t.tenue; ctx.font = '400 36px ' + FUENTE;
    ctx.fillText(etiquetaModo(o.modo), cx, 720);
    // NOMBRE con corona al lado, tamaño medio.
    var nombre = (typeof o.nombre === 'string' ? o.nombre : '').trim();
    if (nombre) {
      ctx.font = '600 48px ' + FUENTE; ctx.textAlign = 'center';
      var wN = ctx.measureText(nombre).width;
      dibujarCorona(ctx, cx - wN / 2 - 62, 796, 40, t.coralVivo);
      ctx.fillStyle = t.coralVivo; ctx.textBaseline = 'alphabetic';
      ctx.fillText(nombre, cx + 24, 838);
    }
    // Dirección abajo, tenue.
    ctx.fillStyle = t.tenue; ctx.font = '400 28px ' + FUENTE;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(DIR_CORTA, cx, LADO - MARGEN + 10);
  }

  // Rectángulo redondeado (sólo paths → corre con el ctx simulado).
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Una fila del ranking: icono (podio o número) · nombre · puntos. `destacado` = fila
  // del jugador (coral). `img` = imagen de podio precargada (o null → número).
  function dibujarFilaRank(ctx, t, x, y, w, puesto, entry, img, destacado) {
    entry = entry || {};
    var h = 118, midY = y + h / 2;
    if (destacado) {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = t.coral;
      _roundRect(ctx, x - 12, y, w + 24, h, 18); ctx.fill(); ctx.restore();
    }
    if (img) {
      try { ctx.drawImage(img, x + 6, midY - 44, 88, 88); }
      catch (e) { _numeroPuesto(ctx, t, x + 50, midY, puesto, destacado); }
    } else {
      _numeroPuesto(ctx, t, x + 50, midY, puesto, destacado);
    }
    ctx.fillStyle = destacado ? t.coralVivo : t.blanco;
    ctx.font = '600 50px ' + FUENTE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(typeof entry.nombre === 'string' ? entry.nombre : '', x + 130, midY);
    ctx.fillStyle = t.coralVivo;
    ctx.font = '800 50px ' + FUENTE; ctx.textAlign = 'right';
    ctx.fillText((U && U.abreviarNumero) ? U.abreviarNumero(_entero(entry.puntos)) : String(_entero(entry.puntos)), x + w - 10, midY);
    ctx.textBaseline = 'alphabetic';
  }
  function _numeroPuesto(ctx, t, x, midY, puesto, destacado) {
    ctx.fillStyle = destacado ? t.coralVivo : t.coral;
    ctx.font = '800 54px ' + FUENTE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(puesto), x, midY);
  }

  // 3.x: TARJETA DE RANKING. `o.imgs` = { 1:Image, 2:Image, 3:Image } precargadas (o vacío).
  function dibujarTarjetaRanking(ctx, o) {
    o = o || {};
    var t = tokens();
    fondoCascada(ctx, t);
    var cx = LADO / 2, x = MARGEN, w = LADO - 2 * MARGEN;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = t.coral; ctx.font = '800 64px ' + FUENTE;
    ctx.fillText('HitClaud', cx, 170);
    var top = Array.isArray(o.top) ? o.top : [];
    var imgs = o.imgs || {};
    // 2.1/2.2: el título dice la verdad — "TOP 3" con 3 o más; "RANKING" con menos.
    var titulo = (top.length >= 3 ? 'TOP 3' : 'RANKING') + ' · ' + etiquetaModo(o.modo).toUpperCase();
    ctx.fillStyle = t.blanco; ctx.font = '800 46px ' + FUENTE;
    ctx.fillText(titulo, cx, 258);
    var n = Math.min(3, top.length); // 3.7: si hay menos de tres, muestra los que haya
    var puesto = puestoDe(top, o.nombre); // 3.4/3.5/3.6: fila del jugador si está en top 20 y no en el podio
    var hayJugador = !!(puesto && puesto > 3 && puesto <= 20);
    // CAMBIO 3: el BLOQUE de filas (podio + fila del jugador si la hay) se centra
    // verticalmente entre el título y el pie → nunca queda medio lienzo vacío abajo.
    var filaH = 150, rowH = 118, sep = 46;
    var Hvis = Math.max(0, (n - 1)) * filaH + rowH + (hayJugador ? (sep + rowH) : 0);
    var regTop = 316, regBot = LADO - MARGEN - 70; // franja disponible sobre el pie (~944)
    var y0 = regTop + Math.max(0, ((regBot - regTop) - Hvis) / 2);
    for (var i = 0; i < n; i++) dibujarFilaRank(ctx, t, x, y0 + i * filaH, w, i + 1, top[i], imgs[i + 1], false);
    if (hayJugador) {
      var yTrasPodio = y0 + (n - 1) * filaH + rowH; // borde inferior del último podio
      ctx.save();
      ctx.strokeStyle = t.tenue; ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, yTrasPodio + sep / 2); ctx.lineTo(x + w, yTrasPodio + sep / 2); ctx.stroke();
      ctx.restore();
      dibujarFilaRank(ctx, t, x, yTrasPodio + sep, w, puesto, top[puesto - 1], null, true);
    }
    // 4.1/4.2: firma visual (bolita coral con estela) también en el ranking, abajo-derecha,
    // con la estela hacia la esquina (dirX +1) para no tapar filas ni el pie.
    firmaBolita(ctx, LADO - MARGEN - 100, LADO - MARGEN - 60, 22, t, 1);
    ctx.fillStyle = t.tenue; ctx.font = '400 28px ' + FUENTE;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(DIR_CORTA, cx, LADO - MARGEN + 10);
  }

  // ── Canvas offscreen (navegador). Se crea al momento y se descarta al soltar la ref. ──
  function _nuevoCanvas() {
    var c = document.createElement('canvas'); c.width = LADO; c.height = LADO;
    return c;
  }
  function tarjetaRecordCanvas(o) {
    return new Promise(function (resolve) {
      try { var c = _nuevoCanvas(); dibujarTarjetaRecord(c.getContext('2d'), o); resolve(c); }
      catch (e) { resolve(null); }
    });
  }
  function cargarPodios() {
    var srcs = { 1: 'assets/podio-1.svg', 2: 'assets/podio-2.svg', 3: 'assets/podio-3.svg' };
    var proms = [1, 2, 3].map(function (k) {
      return new Promise(function (res) {
        try {
          var im = new Image();
          im.onload = function () { res([k, im]); };
          im.onerror = function () { res([k, null]); };
          im.src = srcs[k];
        } catch (e) { res([k, null]); }
      });
    });
    return Promise.all(proms).then(function (pairs) {
      var m = {}; for (var i = 0; i < pairs.length; i++) m[pairs[i][0]] = pairs[i][1]; return m;
    });
  }
  function tarjetaRankingCanvas(o) {
    return cargarPodios().then(function (imgs) {
      var c = _nuevoCanvas();
      dibujarTarjetaRanking(c.getContext('2d'), Object.assign({}, o, { imgs: imgs }));
      return c;
    }).catch(function () {
      try { var c = _nuevoCanvas(); dibujarTarjetaRanking(c.getContext('2d'), o); return c; }
      catch (e) { return null; }
    });
  }

  // ── Compartir: cascada de fallos. NUNCA lanza; SIEMPRE resuelve con la vía usada. ──────
  function _canvasABlob(c) {
    return new Promise(function (resolve) {
      try { if (c && c.toBlob) c.toBlob(function (b) { resolve(b || null); }, 'image/png'); else resolve(null); }
      catch (e) { resolve(null); }
    });
  }
  // Envuelve una promesa con un tope de tiempo: si tarda más, resuelve null (cae a texto).
  function _conTimeout(promesa, ms) {
    return new Promise(function (resolve) {
      var listo = false;
      var timer = null;
      try { timer = setTimeout(function () { if (!listo) { listo = true; resolve(null); } }, ms); } catch (e) {}
      promesa.then(function (v) { if (!listo) { listo = true; if (timer) clearTimeout(timer); resolve(v); } },
                   function () { if (!listo) { listo = true; if (timer) clearTimeout(timer); resolve(null); } });
    });
  }
  function _copiar(texto) {
    return new Promise(function (resolve) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(texto).then(function () { resolve({ via: 'portapapeles' }); },
                                                    function () { resolve({ via: 'nada' }); });
          return;
        }
        resolve({ via: 'nada' });
      } catch (e) { resolve({ via: 'nada' }); }
    });
  }
  function _compartirTexto(texto) {
    return new Promise(function (resolve) {
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({ text: texto }).then(function () { resolve({ via: 'texto' }); },
                                                 function () { _copiar(texto).then(resolve); });
          return;
        }
        _copiar(texto).then(resolve);
      } catch (e) { _copiar(texto).then(resolve); }
    });
  }
  // Cascada 1.3: imagen+texto → texto → portapapeles. Nunca lanza; nunca queda sin hacer nada.
  function compartir(texto, blob, nombreArchivo) {
    return new Promise(function (resolve) {
      try {
        var file = null;
        if (blob && typeof File !== 'undefined') {
          try { file = new File([blob], nombreArchivo || 'hitclaud.png', { type: 'image/png' }); } catch (e) { file = null; }
        }
        var puedeImg = !!(file && typeof navigator !== 'undefined' && navigator.share && navigator.canShare && (function () {
          try { return navigator.canShare({ files: [file] }); } catch (e) { return false; }
        })());
        if (puedeImg) {
          navigator.share({ files: [file], text: texto }).then(function () { resolve({ via: 'imagen' }); },
                                                               function () { _compartirTexto(texto).then(resolve); });
          return;
        }
        _compartirTexto(texto).then(resolve);
      } catch (e) { _compartirTexto(texto).then(resolve); }
    });
  }

  // ── API pública de alto nivel (la que llaman los botones) ──────────────────────────
  function compartirRecord(o) {
    o = o || {};
    var texto = textoRecord(o);
    return _conTimeout(tarjetaRecordCanvas(o).then(_canvasABlob), TIMEOUT_MS)
      .then(function (blob) { return compartir(texto, blob, 'hitclaud-record.png'); })
      .catch(function () { return _compartirTexto(texto); });
  }
  function compartirRanking(o) {
    o = o || {};
    var puesto = puestoDe(o.top, o.nombre);
    var texto = textoRanking({ modo: o.modo, puesto: puesto });
    return _conTimeout(tarjetaRankingCanvas(o).then(_canvasABlob), TIMEOUT_MS)
      .then(function (blob) { return compartir(texto, blob, 'hitclaud-ranking.png'); })
      .catch(function () { return _compartirTexto(texto); });
  }

  var Compartir = {
    LADO: LADO, MARGEN: MARGEN, TIMEOUT_MS: TIMEOUT_MS,
    etiquetaModo: etiquetaModo, textoRecord: textoRecord, textoRanking: textoRanking,
    puestoDe: puestoDe, tamPuntaje: tamPuntaje,
    dibujarTarjetaRecord: dibujarTarjetaRecord, dibujarTarjetaRanking: dibujarTarjetaRanking,
    tarjetaRecordCanvas: tarjetaRecordCanvas, tarjetaRankingCanvas: tarjetaRankingCanvas,
    compartirRecord: compartirRecord, compartirRanking: compartirRanking,
    // internos expuestos para diagnóstico/pruebas
    _compartir: compartir, _compartirTexto: _compartirTexto, _copiar: _copiar,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compartir;
  } else {
    global.Compartir = Compartir;
  }
})(typeof window !== 'undefined' ? window : globalThis);
