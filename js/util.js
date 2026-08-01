// hitclaud — util.js
// Utilidades a prueba de fallos. PURO (sin DOM): recibe el valor crudo.
// Corre igual en navegador (window.Util) y en node (module.exports).

(function (global) {
  'use strict';

  // Lee un token con FALLBACK: si el valor crudo es vacío (token ausente por
  // CSS no aplicado o cache viejo), usa el respaldo literal y avisa. Nunca
  // devuelve '' (que rompería fillStyle en silencio o addColorStop con throw).
  function leerToken(nombre, respaldo, crudo) {
    const v = (crudo || '').trim();
    if (v === '') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[hitclaud] token vacío: ' + nombre + ' → respaldo ' + respaldo);
      }
      return respaldo;
    }
    return v;
  }

  // ── PERSISTENCIA MÍNIMA Y RESISTENTE (FASE 10) ─────────────────────────────
  // Regla del dueño: NO se guarda historial de partidas. Se guardan EXACTAMENTE
  // dos datos por modo bajo una sola llave versionada (hitclaud.record.v2.<modo>):
  //   - record:      el score más alto alcanzado (solo se sobrescribe al superarse).
  //   - ultimoScore: el score de la última partida terminada (siempre se sobrescribe).
  //
  // RESISTENCIA: los dos datos se escriben a la vez en DOS almacenes distintos —
  // localStorage (síncrono) e IndexedDB (asíncrono) — bajo la misma llave. Al
  // arrancar, reconciliar() lee ambos y se queda con el record MÁS ALTO; si a un
  // almacén le falta o quedó por debajo, lo repuebla desde el otro.
  //
  // ESCRITURA solo al TERMINAR partida y al ROMPER récord (con throttle, para no
  // escribir en cada cuadro). Nunca en cada punto.
  //
  // ROBUSTEZ: todo con try/catch. Si un almacén falla (modo privado iOS, cuota,
  // IDB ausente), el juego NO se rompe: los datos viven en memoria (lección de
  // congelamiento previa — una excepción aquí mataría el rAF).
  //
  // HONESTIDAD: esta persistencia sigue siendo BORRABLE si el usuario limpia los
  // datos del navegador. La indelebilidad real requiere ranking en servidor.
  //
  // `local`: KV síncrono estilo localStorage (getItem/setItem) o null.
  // `idb`:   KV asíncrono {get(k)->Promise<string|null>, set(k,v)->Promise} o null.
  function saneo(v) { v = parseInt(v, 10); return isNaN(v) || v < 0 ? 0 : v; }
  function parseEntrada(raw) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') return { record: saneo(o.record), ultimoScore: saneo(o.ultimoScore) };
    } catch (e) { /* corrupto/ausente */ }
    return null;
  }
  function crearPersistencia(local, idb, clave, throttleMs) {
    let record = 0, ultimoScore = 0;
    let sucio = false;      // hay un record nuevo sin persistir (durante el juego)
    let ultima = -Infinity; // timestamp de la última escritura (throttle)
    let escrituras = 0;     // contador de escrituras a localStorage (para tests)

    function serial() { return JSON.stringify({ record: record, ultimoScore: ultimoScore }); }
    function escribirLocal() {
      try { if (local) { local.setItem(clave, serial()); escrituras++; } }
      catch (e) { /* cuota/privado → seguimos en memoria */ }
    }
    function escribirIdb() {
      try { if (idb) { const p = idb.set(clave, serial()); if (p && p.catch) p.catch(function () {}); } }
      catch (e) { /* IDB caído → seguimos en memoria */ }
    }
    function persistir() { escribirLocal(); escribirIdb(); sucio = false; }

    // Lectura síncrona inicial de localStorage: pinta el récord al instante, antes
    // de que la reconciliación asíncrona con IndexedDB termine.
    try { if (local) { const o = parseEntrada(local.getItem(clave)); if (o) { record = o.record; ultimoScore = o.ultimoScore; } } }
    catch (e) { /* storage no disponible → memoria */ }

    return {
      get valor() { return record; },        // "valor" = record (compat con el display)
      get record() { return record; },
      get ultimoScore() { return ultimoScore; },
      get escrituras() { return escrituras; },

      // RECONCILIACIÓN al arrancar (async, porque IDB lo es). Lee ambos almacenes,
      // se queda con el record MÁS ALTO y el ultimoScore que lo acompaña, y repuebla
      // ambos con el resultado (arregla el almacén faltante o por debajo). Nunca lanza.
      reconciliar: function () {
        const leerIdb = (function () {
          try { if (idb) return Promise.resolve(idb.get(clave)); } catch (e) {}
          return Promise.resolve(null);
        })();
        return leerIdb.then(function (rawIdb) {
          const cand = [];
          try { if (local) { const o = parseEntrada(local.getItem(clave)); if (o) cand.push(o); } } catch (e) {}
          const oi = parseEntrada(rawIdb); if (oi) cand.push(oi);
          if (record > 0 || ultimoScore > 0) cand.push({ record: record, ultimoScore: ultimoScore });
          if (cand.length) {
            let base = cand[0];
            for (let i = 1; i < cand.length; i++) if (cand[i].record > base.record) base = cand[i];
            record = base.record;
            ultimoScore = base.ultimoScore;
            persistir(); // repuebla ambos almacenes con el valor reconciliado
          }
          return { record: record, ultimoScore: ultimoScore };
        }, function () { return { record: record, ultimoScore: ultimoScore }; });
      },

      // Fin de partida (FASE 12 — regla dura): ultimoScore = score SIEMPRE (incluye
      // 0 cuando la partida termina por CloudOver, el score quedó vaciado). El RÉCORD
      // sólo sube si `subeRecord` es true — SÓLO en el cierre por TIEMPO CUMPLIDO.
      // Por CloudOver el record queda INTACTO aunque el score lo supere. ÚNICO camino
      // de escritura del récord (se eliminó el "récord en vivo" throttled). Persiste
      // los dos datos en ambos almacenes.
      terminar: function (score, ahora, subeRecord) {
        ultimoScore = saneo(score);
        if (subeRecord && ultimoScore > record) record = ultimoScore;
        persistir(); ultima = ahora; sucio = false;
      },
      // Escritura forzada (visibilitychange/pagehide): no-op salvo que quede algo
      // pendiente. Ya no hay récord en vivo → `sucio` no se activa durante el juego.
      flush: function (ahora) { if (sucio) { persistir(); ultima = ahora; } },
    };
  }

  // ── TEXTO PERSISTENTE (FASE 21) — mismo doble almacén de la fase 10 para un STRING.
  // localStorage (síncrono) + IndexedDB (asíncrono) bajo una llave versionada. Se usa
  // para el NOMBRE de usuario. reconciliar() (async, IDB lo es) toma el valor que
  // exista (si ambos, el local; repuebla el faltante). Todo con try/catch: si un
  // almacén falla, NO lanza (el juego no se bloquea). No hay "mayor" que elegir: es texto.
  function crearTextoPersistente(local, idb, clave) {
    let valor = '';
    try { if (local) { const v = local.getItem(clave); if (typeof v === 'string') valor = v; } } catch (e) { /* storage no disponible */ }
    function escribir() {
      try { if (local) local.setItem(clave, valor); } catch (e) { /* cuota/privado */ }
      try { if (idb) { const p = idb.set(clave, valor); if (p && p.catch) p.catch(function () {}); } } catch (e) { /* IDB caído */ }
    }
    return {
      get valor() { return valor; },
      guardar: function (v) { valor = String(v == null ? '' : v); escribir(); },
      reconciliar: function () {
        const leerIdb = (function () { try { if (idb) return Promise.resolve(idb.get(clave)); } catch (e) {} return Promise.resolve(null); })();
        return leerIdb.then(function (rawIdb) {
          let loc = ''; try { if (local) { const v = local.getItem(clave); if (typeof v === 'string') loc = v; } } catch (e) {}
          const idbv = (typeof rawIdb === 'string') ? rawIdb : '';
          if (!valor) valor = loc || idbv; // toma el que exista (prioridad local)
          if (valor) escribir();           // repuebla el almacén que falte
          return valor;
        }, function () { return valor; });
      },
    };
  }

  // Abreviatura de números grandes (fuente ÚNICA). >=10,000 → K/M con UNA
  // decimal TRUNCADA (no redondea hacia arriba): 10,499 → "10.4K". Debajo de
  // 10,000, número completo. Se descarta la decimal .0 (125,000 → "125K").
  function abreviarNumero(n) {
    n = Math.trunc(n);
    if (n < 10000) return String(n);
    if (n < 1000000) { const k = Math.floor(n / 100) / 10; return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
    const m = Math.floor(n / 100000) / 10;
    return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + 'M';
  }

  // ── SECUENCIA de CloudOver (FASE 12 commit 2) — tiempos y curva PUROS ───────
  // Máquina de estados del game-over por CloudOver, en este orden exacto:
  //   impacto (0–400ms): explosión viva, pantalla limpia, el juego sigue corriendo.
  //   vaciado (400–1100ms, 700ms): el contador Actual cuenta de score a 0.
  //   cero    (1100–1300ms): tocó 0, espera 200ms.
  //   overlay (≥1300ms): entra el overlay de game over con score 0.
  const SEC = { IMPACTO: 400, VACIADO: 700, POST: 200 };
  // Fase según ms transcurridos desde el impacto. `reducir` (prefers-reduced-motion)
  // → salta directo a 'overlay' (vaciado instantáneo, overlay sin demora).
  function faseCloudover(elapsed, reducir) {
    if (reducir) return 'overlay';
    if (elapsed < SEC.IMPACTO) return 'impacto';
    if (elapsed < SEC.IMPACTO + SEC.VACIADO) return 'vaciado';
    if (elapsed < SEC.IMPACTO + SEC.VACIADO + SEC.POST) return 'cero';
    return 'overlay';
  }
  // Valor del contador durante el vaciado: score→0 con easeOutCubic (rápido al
  // inicio, frenando al final). Antes del vaciado = score; en/después del fin = 0
  // EXACTO (nunca un residual). Determinista → testeable.
  function valorVaciado(score, elapsed) {
    if (elapsed <= SEC.IMPACTO) return score;
    if (elapsed >= SEC.IMPACTO + SEC.VACIADO) return 0;
    const p = (elapsed - SEC.IMPACTO) / SEC.VACIADO;
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    return Math.round(score * (1 - eased));
  }

  // ── ESTELA METEORO (FASE 14) — esqueleto PURO del rastro continuo ──────────
  // Reemplaza los 3 fantasmas (que se leían como ECO) por UNA cola continua que
  // nace en el centro de la bola (hx,hy) y sigue hacia atrás por `historia`,
  // adelgazándose a punta. Devuelve los puntos del espinazo cabeza→cola con su
  // semi-ancho `w` (decrece a 0) y su alfa `a` (decrece a 0), o null si es
  // degenerada (bola quieta/agarrada → sin recorrido, no se dibuja nada).
  //   grosor inicial = 90% del diámetro → semi-ancho cabeza = 0.9·radio.
  //   opacidad cabeza = 0.45 → 0 en la punta.
  //   largo = hasta `maxPuntos` puntos (≤5). A baja velocidad los puntos de
  //   historia casi coinciden → cola corta; a alta velocidad se separan → larga.
  function estelaMeteoro(hx, hy, historia, radio, maxPuntos) {
    const CAP = maxPuntos || 5;
    const MIN = 1.0; // px: por debajo, el punto no aporta (evita segmentos degenerados)
    const pts = [{ x: hx, y: hy }];
    const H = historia ? historia.length : 0;
    for (let i = 0; i < H && pts.length < CAP; i++) {
      const p = historia[i];
      const u = pts[pts.length - 1];
      if (Math.hypot(p.x - u.x, p.y - u.y) >= MIN) pts.push({ x: p.x, y: p.y });
    }
    if (pts.length < 2) return null; // sin recorrido → sin cola
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (len < MIN) return null;
    const n = pts.length;
    const headHalf = 0.9 * (radio || 14);
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);                    // 0 en la cabeza, 1 en la punta
      out.push({ x: pts[i].x, y: pts[i].y, w: headHalf * (1 - k), a: 0.45 * (1 - k) });
    }
    return { pts: out, len: len };
  }

  // ── SACUDIDA de CloudOver (FASE 16: revert del zoom) ────────────────────────
  // La fase 15 metió un acercamiento/centrado de cámara que el dueño validó como
  // fallo → REVERTIDO. SÓLO queda la sacudida: el mundo se desplaza aleatoriamente
  // hasta 12px, decreciendo lineal a 0 en 300ms desde el golpe. Sin escala ni foco.
  const CAM = { SAC_MS: 300, SAC_AMP: 12 };
  function amplitudSacudidaCam(elapsed) { return (elapsed >= 0 && elapsed < CAM.SAC_MS) ? CAM.SAC_AMP * (1 - elapsed / CAM.SAC_MS) : 0; }

  // ── MEDIDOR DE FPS (build de debug temporal) ───────────────────────────────
  // Acumula el tiempo REAL entre cuadros (timestamp de rAF) + el tiempo de DIBUJO,
  // sobre una ventana móvil (1s). `leer` recomputa a lo sumo cada `refrescoMs`
  // (números estables/legibles). PURO → testeable con timestamps simulados.
  //   fps    = cuadros por segundo en la ventana (por el span real cubierto).
  //   peorMs = el cuadro MÁS LENTO de la ventana (peor pico de dt).
  //   dibujoMs = tiempo medio de la función de dibujo en la ventana.
  function crearMedidorFps(ventanaMs, refrescoMs) {
    ventanaMs = ventanaMs || 1000;
    refrescoMs = refrescoMs || 500;
    const muestras = []; // {t, dt, draw}
    let cache = { fps: 0, peorMs: 0, dibujoMs: 0 };
    let ultimoCalc = -Infinity;
    function purgar(t) {
      const corte = t - ventanaMs;
      while (muestras.length && muestras[0].t < corte) muestras.shift();
    }
    return {
      registrar: function (t, dt, draw) {
        muestras.push({ t: t, dt: dt, draw: draw || 0 });
        purgar(t);
      },
      leer: function (t) {
        if (t - ultimoCalc >= refrescoMs) {
          ultimoCalc = t;
          purgar(t);
          const n = muestras.length;
          let peor = 0, sumDraw = 0;
          for (let i = 0; i < n; i++) { if (muestras[i].dt > peor) peor = muestras[i].dt; sumDraw += muestras[i].draw; }
          let fps = 0;
          if (n >= 2) {
            const span = (muestras[n - 1].t - muestras[0].t) / 1000;
            fps = span > 0 ? (n - 1) / span : 0;
          }
          cache = { fps: fps, peorMs: peor, dibujoMs: n ? sumDraw / n : 0 };
        }
        return cache;
      },
      get muestras() { return muestras; },
    };
  }

  // ── CASCADA de DATOS REALES (FASE 16) — tributo honesto al código ──────────
  // TODO lo que cae es REAL: nombres reales de campos/constantes/funciones y valores
  // del estado vivo. NADA inventado. Estos formateadores son PUROS → testeables, y
  // los NOMBRES de constantes/eventos se listan aquí para cruzarlos contra el fuente.
  // Constantes con su nombre REAL (las lee main.js como F.FISICA[nombre] / P[nombre]
  // → si el valor cambia mañana, la cascada lo refleja sola).
  const CASC_CONST_FISICA = ['GRAVEDAD', 'G_TARGET', 'VEL_SALIDA_MAX', 'VEL_CAIDA_MAX', 'MAX_PASO_PX', 'VIDA_MAX_MS', 'RESTITUCION_GOLPE', 'MASA_TARGET', 'UMBRAL_DESTRUCCION', 'MULT_SUELTA', 'DANO_CUBOS_MAX', 'RADIO_BOLITA', 'RADIO_TARGET'];
  const CASC_CONST_PUNT = ['VALOR_CUBO', 'FALLO', 'RACHA_DESDE', 'RACHA_TOPE', 'SCORE_RITMO_MAX', 'RESPIRO_MS'];
  // Nombres REALES de funciones que emiten un evento al ejecutarse (existen en el código).
  const CASC_EVENTOS = ['resolverImpacto', 'anotarDestruidos', 'anotarHit', 'anotarFallo', 'golpeCloudover', 'iniciarPartida', 'terminarPartida', 'anotarInactividadSegundo'];
  function cascFmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(Math.abs(n) < 1 ? 4 : 2);
  }
  // Línea de una entidad con posición/velocidad (campos REALES x,y,vx,vy).
  function cascEntidad(etq, o) { return etq + ' x:' + cascFmt(o.x) + ' y:' + cascFmt(o.y) + ' vx:' + cascFmt(o.vx) + ' vy:' + cascFmt(o.vy); }
  // Línea de un target (agrega rot y celdas vivas: campos REALES rot/vivos/vivosMax).
  function cascTarget(etq, t) { return etq + ' x:' + cascFmt(t.x) + ' y:' + cascFmt(t.y) + ' vx:' + cascFmt(t.vx) + ' vy:' + cascFmt(t.vy) + ' rot:' + cascFmt(t.rot) + ' vivos:' + t.vivos + '/' + t.vivosMax; }
  // Línea NOMBRE=VALOR (constante real leída del código).
  function cascConst(nombre, valor) { return nombre + '=' + cascFmt(valor); }
  // (FASE 17) Se ELIMINARON crearCascada (motor de caída/reciclado) y
  // crearRegimenCascada (freno por fps 50/40 que APAGABA el bloque a ~30fps y no
  // se recuperaba). Los datos ya no caen: main.js dibuja líneas FIJAS cuyo valor
  // se recomputa en vivo con estos formateadores. Sin motor, sin freno.

  // (FASE 18) TRUNCADO respetando el margen: si el texto no cabe en `maxW`, recorta
  // caracteres y agrega "…". `anchoDe(str)` mide el ancho real (ctx.measureText en el
  // juego; inyectable → testeable). NUNCA devuelve algo más ancho que maxW.
  function truncarTexto(txt, maxW, anchoDe) {
    if (anchoDe(txt) <= maxW) return txt;
    let s = txt;
    while (s.length > 0 && anchoDe(s + '…') > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  // (FASE 18) ESTÁTICO = textura de relleno con líneas REALES del código fuente
  // (fragmentos verbatim de fisica/main/puntuacion). NADA inventado: cada string
  // existe tal cual en los .js (el test lo cruza contra el fuente). No cambian con
  // el juego → sirven de fondo estable entre las líneas VIVAS.
  const CASC_CODIGO = [
    'function resolverImpacto(bolita, t) {',
    'function colisionCirculoRect(bolita, t) {',
    'function paso(o, dt, limites, onPaso) {',
    'GRAVEDAD: 0.0035,',
    'RESTITUCION_GOLPE: 0.3,',
    'function anotarDestruidos(m, n) {',
    'function anotarHit(m) {',
    'function multRacha(racha) {',
    'const VALOR_CUBO = 5;',
    'const RACHA_TOPE = 3.0;',
    'function crearMarcador() {',
    'const MAX_CUBOS = 240;',
  ];

  const U = {
    leerToken: leerToken, crearPersistencia: crearPersistencia,
    crearTextoPersistente: crearTextoPersistente,
    parseEntrada: parseEntrada, abreviarNumero: abreviarNumero,
    SEC: SEC, faseCloudover: faseCloudover, valorVaciado: valorVaciado,
    estelaMeteoro: estelaMeteoro, crearMedidorFps: crearMedidorFps,
    CAM: CAM, amplitudSacudidaCam: amplitudSacudidaCam,
    CASC_CONST_FISICA: CASC_CONST_FISICA, CASC_CONST_PUNT: CASC_CONST_PUNT,
    CASC_EVENTOS: CASC_EVENTOS, cascFmt: cascFmt, cascEntidad: cascEntidad,
    cascTarget: cascTarget, cascConst: cascConst,
    truncarTexto: truncarTexto, CASC_CODIGO: CASC_CODIGO,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = U;
  } else {
    global.Util = U;
  }
})(typeof window !== 'undefined' ? window : globalThis);
