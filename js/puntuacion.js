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
  // Multiplicador de fallos consecutivos ESCALADO por tramo (abajo perdona,
  // arriba no). El 1º fallo siempre ×1; la fila = multiplicadores del 2º/3º/4º+.
  // Fronteras de tramo del multiplicador (4 niveles):
  const MULT_LIM = [2000, 10000, 25000];
  const MULT = [
    [1, 1.2, 1.5],   // 0–1,999    → 2º×1, 3º×1.2, 4º+×1.5 (tope 1.5)
    [1.5, 2, 2.5],   // 2,000–9,999
    [2, 2.5, 3],     // 10,000–24,999
    [2, 3, 4],       // 25,000+    → como hoy (2º/3º/4º = ×2/×3/×4)
  ];

  // Ritmo progresivo: el retardo entre spawns interpola de BASE (0 pts) a
  // TOPE (SCORE_RITMO_MAX). "Más rápido salen" = más FRECUENCIA, no más
  // velocidad de vuelo (gravedad y fuerza de lanzamiento NO se tocan).
  const RETARDO_BASE = { min: 400, max: 1200 };
  const RETARDO_TOPE = { min: 150, max: 500 };
  const SCORE_RITMO_MAX = 30000;
  const RESPIRO_MS = 5000;    // el respiro dura 5 s
  const RESPIRO_HITS = 10;    // cada 10 hits en dificultad máxima → respiro

  const INACT_FRAC = 0.25;    // inactividad: 25% del castigo del tramo por segundo

  // Amortiguador de caída (NO es un tope: 0 siempre es alcanzable). Suelo de
  // referencia = 60% del PICO DE LA PARTIDA (en vivo, se resetea cada partida;
  // NO el récord histórico). Sobre el suelo el castigo es ×1; bajo el suelo el
  // multiplicador decae lineal de ×1 (en el suelo) a AMORT_MIN (en 0). Con pico
  // 0 → suelo 0 → sin amortiguación (todo ×1 como hoy).
  const SUELO_PICO = 0.6;
  const AMORT_MIN = 0.35;

  // Castigo del tramo (plano). Usado por la inactividad.
  function penalTramo(score) {
    let p = TRAMOS[0].pen;
    for (let i = 0; i < TRAMOS.length; i++) if (score >= TRAMOS[i].min) p = TRAMOS[i].pen;
    return p;
  }

  // Castigo base INTERPOLADO dentro del tramo: lineal entre el castigo del
  // tramo actual y el del siguiente según la posición → sin salto brusco al
  // cruzar frontera (p.ej. 1,900 vs 2,100 difieren poco, no −50 vs −100).
  function penalBase(score) {
    for (let i = 0; i < TRAMOS.length - 1; i++) {
      const cur = TRAMOS[i];
      const sig = TRAMOS[i + 1];
      if (score < sig.min) {
        const pos = (score - cur.min) / (sig.min - cur.min);
        return cur.pen + pos * (sig.pen - cur.pen);
      }
    }
    return TRAMOS[TRAMOS.length - 1].pen; // último tramo: plano
  }

  // Multiplicador del fallo: 1º siempre ×1; 2º/3º/4º+ según el tramo del score.
  function multFallo(score, cuenta) {
    if (cuenta <= 1) return 1;
    let idx = 0;
    for (let i = 0; i < MULT_LIM.length; i++) if (score >= MULT_LIM[i]) idx = i + 1;
    return MULT[idx][Math.min(cuenta, 4) - 2];
  }

  function crearMarcador() {
    return { puntos: 0, racha: 0, fallosSeguidos: 0, pico: 0 };
  }

  // El pico de la partida sigue al score EN VIVO (sube en el mismo momento que
  // el score lo supera). Suelo = SUELO_PICO · pico.
  function subirPico(m) { if (m.puntos > m.pico) m.pico = m.puntos; }

  // Multiplicador del amortiguador para un score/pico dados.
  function amortiguar(score, pico) {
    const suelo = SUELO_PICO * pico;
    if (suelo <= 0 || score >= suelo) return 1;         // sobre el suelo o sin pico
    return AMORT_MIN + (1 - AMORT_MIN) * (score / suelo); // ×1 en el suelo → AMORT_MIN en 0
  }

  // n cubos destruidos → +n·10. Devuelve los puntos ganados.
  function anotarDestruidos(m, n) {
    const g = n * PTS_CUBO;
    m.puntos += g;
    subirPico(m);
    return g;
  }

  // Un hit (bolita que tocó ≥1 target normal): resetea fallos, sube la racha
  // y paga el bono de hito si corresponde. Devuelve el bono (0 si no hay).
  function anotarHit(m) {
    m.fallosSeguidos = 0;
    m.racha += 1;
    const bono = HITOS[m.racha] || 0;
    m.puntos += bono;
    subirPico(m);
    return bono;
  }

  // Fallo: castigo base interpolado (score ANTES de restar) × multiplicador
  // escalado por tramo, redondeado a entero. Piso en 0, rompe racha.
  // ESPIRAL DEL DEBUFF: con opts.debuff, el fallo NO incrementa el contador de
  // consecutivos (ya estás pagando con la bola chica; encadenar ambos es doble
  // castigo). Devuelve el castigo aplicado.
  function anotarFallo(m, opts) {
    const debuff = !!(opts && opts.debuff);
    const base = penalBase(m.puntos);
    if (!debuff) m.fallosSeguidos += 1;
    const cuenta = Math.max(m.fallosSeguidos, 1);
    // El amortiguador se aplica al castigo FINAL (tras tramo y consecutivos).
    const pen = Math.round(base * multFallo(m.puntos, cuenta) * amortiguar(m.puntos, m.pico));
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
  function costoInactividad(score) { return Math.round(penalTramo(score) * INACT_FRAC); } // sin amortiguar
  function anotarInactividadSegundo(m) {
    // El amortiguador TAMBIÉN aplica a la inactividad: quieto DEBE poder llegar
    // a 0, solo que bajando más lento cerca del suelo.
    const c = Math.round(penalTramo(m.puntos) * INACT_FRAC * amortiguar(m.puntos, m.pico));
    m.puntos = Math.max(0, m.puntos - c);
    return c;
  }

  const P = {
    crearMarcador: crearMarcador,
    anotarDestruidos: anotarDestruidos,
    anotarHit: anotarHit,
    anotarFallo: anotarFallo,
    penalTramo: penalTramo,
    penalBase: penalBase,
    multFallo: multFallo,
    amortiguar: amortiguar,
    SUELO_PICO: SUELO_PICO,
    AMORT_MIN: AMORT_MIN,
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
