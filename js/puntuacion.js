// hitclaud — puntuacion.js
// Reglas PURAS del juego (sin DOM): puntuación por demolición, rachas,
// castigo escalado por tramos, ritmo progresivo, respiro e inactividad.
// Corre igual en navegador (window.Puntuacion) y en node (module.exports).

(function (global) {
  'use strict';

  const PTS_CUBO = 10;       // cada cubo destruido = 10 pts (target intacto = 200)
  // Bonos de racha (una vez, al alcanzar el hito exacto).
  const HITOS = { 5: 500, 10: 1000, 50: 5000, 100: 20000 };

  // Castigo por TRAMOS (el tramo se calcula con el score ANTES de restar).
  const TRAMOS = [
    { min: 0, pen: 50 },
    { min: 2000, pen: 100 },
    { min: 10000, pen: 250 },
    { min: 25000, pen: 500 },
    { min: 50000, pen: 1000 },
    { min: 100000, pen: 2000 },
  ];
  const FALLO_MULT_TOPE = 4;  // fallos consecutivos: 2º×2, 3º×3, 4º+×4

  // Ritmo progresivo: el retardo entre spawns interpola de BASE (0 pts) a
  // TOPE (SCORE_RITMO_MAX). "Más rápido salen" = más FRECUENCIA, no más
  // velocidad de vuelo (gravedad y fuerza de lanzamiento NO se tocan).
  const RETARDO_BASE = { min: 400, max: 1200 };
  const RETARDO_TOPE = { min: 150, max: 500 };
  const SCORE_RITMO_MAX = 30000;
  const RESPIRO_MS = 5000;    // el respiro dura 5 s
  const RESPIRO_HITS = 10;    // cada 10 hits en dificultad máxima → respiro

  const INACT_FRAC = 0.25;    // inactividad: 25% del castigo del tramo por segundo

  function penalTramo(score) {
    let p = TRAMOS[0].pen;
    for (let i = 0; i < TRAMOS.length; i++) if (score >= TRAMOS[i].min) p = TRAMOS[i].pen;
    return p;
  }

  function crearMarcador() {
    return { puntos: 0, racha: 0, fallosSeguidos: 0 };
  }

  // n cubos destruidos → +n·10. Devuelve los puntos ganados.
  function anotarDestruidos(m, n) {
    const g = n * PTS_CUBO;
    m.puntos += g;
    return g;
  }

  // Un hit (bolita que tocó ≥1 target normal): resetea fallos, sube la racha
  // y paga el bono de hito si corresponde. Devuelve el bono (0 si no hay).
  function anotarHit(m) {
    m.fallosSeguidos = 0;
    m.racha += 1;
    const bono = HITOS[m.racha] || 0;
    m.puntos += bono;
    return bono;
  }

  // Fallo: castigo del tramo (score ANTES de restar) × multiplicador por
  // fallos consecutivos (tope ×4). Piso en 0, rompe racha. Devuelve el castigo.
  function anotarFallo(m) {
    const base = penalTramo(m.puntos);
    m.fallosSeguidos += 1;
    const mult = Math.min(m.fallosSeguidos, FALLO_MULT_TOPE);
    const pen = base * mult;
    m.puntos = Math.max(0, m.puntos - pen);
    m.racha = 0;
    return pen;
  }

  // Rango de retardo (ms) vigente según el score. Interpola lineal y satura.
  function rangoRetardo(score) {
    const k = Math.max(0, Math.min(1, score / SCORE_RITMO_MAX));
    return {
      min: Math.round(RETARDO_BASE.min + k * (RETARDO_TOPE.min - RETARDO_BASE.min)),
      max: Math.round(RETARDO_BASE.max + k * (RETARDO_TOPE.max - RETARDO_BASE.max)),
    };
  }

  // ── Respiro (máquina de estados) ───────────────────────────────────
  // NORMAL: el rango escala con el score. En dificultad máxima (score ≥
  // SCORE_RITMO_MAX), al 10º hit consecutivo → RESPIRO: rango base (400–1200)
  // por 5 s. Al expirar vuelve a NORMAL (rango al tope).
  function crearRitmo() { return { respiroHasta: 0 }; }
  function quizasRespiro(ritmo, score, racha, now) {
    if (score >= SCORE_RITMO_MAX && racha > 0 && racha % RESPIRO_HITS === 0) {
      ritmo.respiroHasta = now + RESPIRO_MS;
      return true;
    }
    return false;
  }
  function enRespiro(ritmo, now) { return now < ritmo.respiroHasta; }
  function rangoVigente(ritmo, score, now) {
    return enRespiro(ritmo, now)
      ? { min: RETARDO_BASE.min, max: RETARDO_BASE.max }
      : rangoRetardo(score);
  }

  // ── Inactividad ────────────────────────────────────────────────────
  function costoInactividad(score) { return Math.round(penalTramo(score) * INACT_FRAC); }
  function anotarInactividadSegundo(m) {
    const c = costoInactividad(m.puntos);
    m.puntos = Math.max(0, m.puntos - c);
    return c;
  }

  const P = {
    crearMarcador: crearMarcador,
    anotarDestruidos: anotarDestruidos,
    anotarHit: anotarHit,
    anotarFallo: anotarFallo,
    penalTramo: penalTramo,
    rangoRetardo: rangoRetardo,
    crearRitmo: crearRitmo,
    quizasRespiro: quizasRespiro,
    enRespiro: enRespiro,
    rangoVigente: rangoVigente,
    costoInactividad: costoInactividad,
    anotarInactividadSegundo: anotarInactividadSegundo,
    HITOS: HITOS,
    TRAMOS: TRAMOS,
    PTS_CUBO: PTS_CUBO,
    FALLO_MULT_TOPE: FALLO_MULT_TOPE,
    RETARDO_BASE: RETARDO_BASE,
    RETARDO_TOPE: RETARDO_TOPE,
    SCORE_RITMO_MAX: SCORE_RITMO_MAX,
    RESPIRO_MS: RESPIRO_MS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = P;
  } else {
    global.Puntuacion = P;
  }
})(typeof window !== 'undefined' ? window : globalThis);
