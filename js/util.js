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

      // Durante el juego: sube el récord EN VIVO para el display si el score lo
      // supera; persiste con throttle SOLO al romper récord (no en cada punto).
      // Devuelve true si el récord subió en este cuadro.
      considerar: function (score, ahora) {
        let subio = false;
        if (score > record) { record = score; sucio = true; subio = true; }
        if (sucio && ahora - ultima >= throttleMs) { persistir(); ultima = ahora; }
        return subio;
      },
      // Fin de partida: ultimoScore = score (SIEMPRE se sobrescribe); si el score
      // rompe el récord, sube record. Persiste YA en ambos almacenes.
      terminar: function (score, ahora) {
        ultimoScore = saneo(score);
        if (ultimoScore > record) record = ultimoScore;
        persistir(); ultima = ahora; sucio = false;
      },
      // Escritura forzada (visibilitychange/pagehide): asegura un récord tocado
      // aunque el jugador bloquee o cierre a mitad de partida.
      flush: function (ahora) { if (sucio) { persistir(); ultima = ahora; } },
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

  const U = {
    leerToken: leerToken, crearPersistencia: crearPersistencia,
    parseEntrada: parseEntrada, abreviarNumero: abreviarNumero,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = U;
  } else {
    global.Util = U;
  }
})(typeof window !== 'undefined' ? window : globalThis);
