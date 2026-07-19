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

  // Récord = MÁXIMO HISTÓRICO EN VIVO, persistente y a prueba de fallos.
  // `almacen` es un storage tipo localStorage (o null si no hay). Escribe CON
  // THROTTLE (una vez cada `throttleMs`) + flush forzado (visibilitychange/
  // pagehide). Si el storage falla (modo privado iOS, cuota), sigue en memoria:
  // NUNCA lanza (una excepción aquí mataría el rAF).
  function crearRecord(almacen, clave, throttleMs) {
    let valor = 0;
    let sucio = false;      // hay un valor nuevo sin escribir
    let ultima = -Infinity; // timestamp de la última escritura
    let escrituras = 0;     // contador (para el test del throttle)
    try {
      if (almacen) {
        const v = parseInt(almacen.getItem(clave), 10);
        if (!isNaN(v)) valor = v;
      }
    } catch (e) { /* storage no disponible → récord en memoria */ }

    function escribir(ahora) {
      if (!sucio) return;
      try { if (almacen) { almacen.setItem(clave, String(valor)); escrituras++; } }
      catch (e) { /* cuota/privado → seguimos en memoria */ }
      sucio = false;
      ultima = ahora;
    }

    return {
      get valor() { return valor; },
      get escrituras() { return escrituras; },
      // Cada cuadro: sube el récord EN VIVO si el score lo supera y escribe con
      // throttle. Devuelve true si el récord subió en este cuadro.
      considerar: function (score, ahora) {
        let subio = false;
        if (score > valor) { valor = score; sucio = true; subio = true; }
        if (sucio && ahora - ultima >= throttleMs) escribir(ahora);
        return subio;
      },
      // Escritura forzada (visibilitychange/pagehide): la marca queda guardada
      // desde el instante en que se tocó, aunque el jugador bloquee o cierre.
      flush: function (ahora) { escribir(ahora); },
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

  const U = { leerToken: leerToken, crearRecord: crearRecord, abreviarNumero: abreviarNumero };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = U;
  } else {
    global.Util = U;
  }
})(typeof window !== 'undefined' ? window : globalThis);
