// hitclaud — puntuacion.js
// Reglas PURAS del juego (sin DOM): puntuación por demolición, rachas,
// castigo escalado por tramos, ritmo progresivo, respiro e inactividad.
// Corre igual en navegador (window.Puntuacion) y en node (module.exports).

(function (global) {
  'use strict';

  // ECONOMÍA PLANA (sin tramos): cada cubito vale VALOR_CUBO; un target completo
  // (20 cubos) = 100. Un fallo resta FALLO (50), plano. El multiplicador de racha
  // sigue aplicando a las GANANCIAS. Sin escalado por score, sin castigo por
  // fallos consecutivos, sin amortiguador (todo se retiró).
  const VALOR_CUBO = 5;   // 20 cubos × 5 = 100 por target naranja
  const FALLO = 50;       // un fallo resta 50 (plano)

  // Multiplicador de RACHA CONTINUA: un hit = la hitball destruye ≥1 cubo; se
  // rompe con un fallo. PROGRESIÓN (CAMBIO 2, tope subido de ×3 a ×5): ×1 hasta el
  // 2º hit; desde el 3er hit +0.2/hit sin cambiar el paso previo (3º ×1.2, 4º ×1.4,
  // 5º ×1.6 …), hasta el TOPE ×5. Con paso 0.2, la cima ×5 se alcanza en el 22º hit
  // seguido (1 + (22-2)·0.2 = 5.0): la escalada se GANA, no se regala (2.2). El
  // tramo bajo NO cambia (mismos ×1.2/×1.4 de antes), sólo se estira el techo.
  const RACHA_DESDE = 3;
  const RACHA_PASO = 0.2;
  // CAMBIO 2: el tope pasó de `const RACHA_TOPE = 3.0;` a 5.0 (se anota el valor previo aquí,
  // literal, porque la cascada decorativa del fondo —util.js, sellado— aún lo cita).
  const RACHA_TOPE = 5.0;

  // Ritmo progresivo del SPAWN (no toca la economía): el retardo entre spawns
  // interpola de BASE (0 pts) a TOPE (SCORE_RITMO_MAX). Más score = más frecuencia.
  const RETARDO_BASE = { min: 800, max: 2400 };
  const RETARDO_TOPE = { min: 300, max: 1000 };
  const SCORE_RITMO_MAX = 30000;
  const RESPIRO_MS = 5000;    // el respiro dura 5 s
  const RESPIRO_HITS = 10;    // cada 10 hits en dificultad máxima → respiro

  const INACT_POR_SEG = 13;   // inactividad: costo plano por segundo (~¼ de un fallo)

  function crearMarcador() {
    return { puntos: 0, racha: 0 };
  }

  // Valor de un cubo (plano). El score no lo altera.
  function valorCubo() { return VALOR_CUBO; }

  // Multiplicador de racha continua para una racha dada (tope RACHA_TOPE).
  function multRacha(racha) {
    if (racha < RACHA_DESDE) return 1;
    return Math.min(RACHA_TOPE, 1 + (racha - (RACHA_DESDE - 1)) * RACHA_PASO);
  }

  // n cubos destruidos → +round(n·VALOR_CUBO·multRacha(racha)). Plano: el score
  // no altera el valor; la racha amplifica la ganancia. Devuelve los puntos.
  function anotarDestruidos(m, n) {
    const g = Math.round(n * VALOR_CUBO * multRacha(m.racha));
    m.puntos += g;
    return g;
  }

  // Un hit (la hitball destruyó ≥1 cubo): sube la racha continua.
  function anotarHit(m) {
    m.racha += 1;
    return m.racha;
  }

  // ── BONO DE CARAMBOLA ──────────────────────────────────────────────
  // UN SOLO ESCALÓN: encadenar 2 o más golpes con una misma bola vale 500, siempre.
  // 1 golpe o menos → 0. Sin escalada (fuera los 1500/5000). Se otorga UNA sola vez
  // por bola (al 2º golpe). Entra LIMPIO: NO se multiplica por la racha.
  function bonoCarambola(n) {
    return n >= 2 ? 500 : 0;
  }
  // Suma el bono de carambola al marcador y devuelve el valor sumado (0 si n<2).
  function anotarCarambola(m, n) {
    const g = bonoCarambola(n);
    m.puntos += g;
    return g;
  }

  // Fallo: resta FALLO (50) plano. Piso en 0, rompe racha. Devuelve el castigo.
  function anotarFallo(m) {
    const pen = FALLO;
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
  function costoInactividad() { return INACT_POR_SEG; } // plano
  function anotarInactividadSegundo(m) {
    const c = INACT_POR_SEG;
    m.puntos = Math.max(0, m.puntos - c);
    return c;
  }

  // ── Spawn CAÓTICO (cantidad variable: ráfagas y pausas) ────────────
  // Sobre el rango base (rangoVigente por score) se superponen tres regímenes
  // para romper toda cadencia fija: RÁFAGA (2–4 spawns muy juntos), PAUSA (hueco
  // largo) y NORMAL. `estado` guarda los spawns pendientes de la ráfaga actual.
  // `rnd` es una función [0,1) (inyectable → determinista en tests).
  const CAOS = {
    RAFAGA_GAP: [110, 300],   // ms entre spawns dentro de una ráfaga
    RAFAGA_N: [2, 4],         // nº de spawns extra que dispara una ráfaga
    PAUSA: [1400, 2600],      // ms de un hueco largo
    P_RAFAGA: 0.34,           // prob. de arrancar ráfaga cuando no hay una en curso
    P_PAUSA: 0.30,            // prob. de pausa larga (si no arrancó ráfaga)
  };
  function crearCaos() { return { rafaga: 0 }; }
  function retardoCaotico(base, estado, rnd) {
    if (estado.rafaga > 0) {                     // consumiendo una ráfaga: gaps cortos
      estado.rafaga -= 1;
      return CAOS.RAFAGA_GAP[0] + rnd() * (CAOS.RAFAGA_GAP[1] - CAOS.RAFAGA_GAP[0]);
    }
    const r = rnd();
    if (r < CAOS.P_RAFAGA) {                      // arranca ráfaga (2–4 spawns extra, gap corto)
      estado.rafaga = CAOS.RAFAGA_N[0] + Math.floor(rnd() * (CAOS.RAFAGA_N[1] - CAOS.RAFAGA_N[0] + 1));
      return CAOS.RAFAGA_GAP[0] + rnd() * (CAOS.RAFAGA_GAP[1] - CAOS.RAFAGA_GAP[0]);
    }
    if (r < CAOS.P_RAFAGA + CAOS.P_PAUSA) {       // pausa larga
      return CAOS.PAUSA[0] + rnd() * (CAOS.PAUSA[1] - CAOS.PAUSA[0]);
    }
    return base.min + rnd() * (base.max - base.min); // gap normal (base por score)
  }

  // ── Escalada de ROJOS (sube de nivel cada 5–10 s, sin tope) ────────
  // El nivel arranca en 1 y sólo INCREMENTA: cada escalón (aleatorio 5–10 s)
  // sube la cantidad/frecuencia de rojos. `intervaloRojo` traduce el nivel a un
  // intervalo de aparición decreciente (más nivel → más seguido), con piso.
  const ROJO_ESCALON = [5000, 10000]; // ms entre subidas de nivel
  const ROJO_INTERVALO_BASE = 7000;   // ms de aparición en nivel 1
  const ROJO_INTERVALO_MIN = 700;     // piso (por más nivel no baja de aquí)
  function crearEscalada(now, rnd) { return { nivel: 1, proximo: now + ROJO_ESCALON[0] + rnd() * (ROJO_ESCALON[1] - ROJO_ESCALON[0]) }; }
  function pasoEscalada(e, now, rnd) {
    if (now >= e.proximo) {                       // sólo incrementa; sin tope
      e.nivel += 1;
      e.proximo = now + ROJO_ESCALON[0] + rnd() * (ROJO_ESCALON[1] - ROJO_ESCALON[0]);
      return true;
    }
    return false;
  }
  function intervaloRojo(nivel) { return Math.max(ROJO_INTERVALO_MIN, ROJO_INTERVALO_BASE / nivel); }

  const P = {
    crearMarcador: crearMarcador,
    anotarDestruidos: anotarDestruidos,
    anotarHit: anotarHit,
    anotarFallo: anotarFallo,
    bonoCarambola: bonoCarambola,
    anotarCarambola: anotarCarambola,
    valorCubo: valorCubo,
    multRacha: multRacha,
    rangoRetardo: rangoRetardo,
    crearRitmo: crearRitmo,
    quizasRespiro: quizasRespiro,
    enRespiro: enRespiro,
    rangoVigente: rangoVigente,
    costoInactividad: costoInactividad,
    anotarInactividadSegundo: anotarInactividadSegundo,
    crearCaos: crearCaos,
    retardoCaotico: retardoCaotico,
    CAOS: CAOS,
    crearEscalada: crearEscalada,
    pasoEscalada: pasoEscalada,
    intervaloRojo: intervaloRojo,
    ROJO_ESCALON: ROJO_ESCALON,
    VALOR_CUBO: VALOR_CUBO,
    FALLO: FALLO,
    RACHA_DESDE: RACHA_DESDE,
    RACHA_TOPE: RACHA_TOPE,
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
