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

  const U = { leerToken: leerToken, crearRecord: crearRecord };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = U;
  } else {
    global.Util = U;
  }
})(typeof window !== 'undefined' ? window : globalThis);
