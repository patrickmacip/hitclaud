// hitclaud — puntuacion.js
// Marcador PURO (sin DOM): puntúa por DEMOLICIÓN. Corre igual en navegador
// (window.Puntuacion) y en node (module.exports).

(function (global) {
  'use strict';

  const PTS_CUBO = 10;       // cada cubo destruido = 10 pts (target intacto = 200)
  const PENAL_FALLO = 50;    // fallo (hitball que no toca nada) = −50
  // Bonos de racha (×10 respecto al spec original). Se pagan UNA vez, al
  // alcanzar el hito exacto (no acumulativo por N).
  const HITOS = { 5: 500, 10: 1000, 50: 5000, 100: 20000 };

  function crearMarcador() {
    return { puntos: 0, racha: 0 };
  }

  // n cubos destruidos → +n·10. Devuelve los puntos ganados.
  function anotarDestruidos(m, n) {
    const g = n * PTS_CUBO;
    m.puntos += g;
    return g;
  }

  // Un hit = una hitball que tocó ≥1 target (destruya o no). Sube la racha y,
  // si cruza un hito exacto, paga el bono. Devuelve el bono (0 si no hay).
  function anotarHit(m) {
    m.racha += 1;
    const bono = HITOS[m.racha] || 0;
    m.puntos += bono;
    return bono;
  }

  // Fallo: −100 con piso en 0 (el marcador nunca baja de 0) y rompe la racha.
  function anotarFallo(m) {
    m.puntos = Math.max(0, m.puntos - PENAL_FALLO);
    m.racha = 0;
  }

  const P = {
    crearMarcador: crearMarcador,
    anotarDestruidos: anotarDestruidos,
    anotarHit: anotarHit,
    anotarFallo: anotarFallo,
    HITOS: HITOS,
    PTS_CUBO: PTS_CUBO,
    PENAL_FALLO: PENAL_FALLO,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = P;
  } else {
    global.Puntuacion = P;
  }
})(typeof window !== 'undefined' ? window : globalThis);
