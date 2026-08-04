// hitclaud — shotclaud.js
// Reglas PURAS de ShotClaud, el entrenador de puntería (sin DOM): puntuación por
// precisión, zona central del target, racha POSITIVA (multiplicador de aciertos al
// centro) y racha NEGATIVA (castigo escalado por fallos seguidos). Es un SISTEMA DE
// PUNTUACIÓN DISTINTO al de HitClaud: aquí no se cuentan cubos ni hay carambola; lo
// que importa es dar en el centro. Corre igual en navegador (window.ShotClaud) y en
// node (module.exports). Reutiliza puntuacion.js donde tiene sentido (P.FALLO como
// unidad base de 50) en vez de re-declarar constantes.

(function (global) {
  'use strict';

  // Puntuación de HitClaud como cimiento compartido: en node se require, en el
  // navegador ya vive en window.Puntuacion (mismo IIFE que puntuacion.js expone).
  const P = (typeof module !== 'undefined' && module.exports)
    ? require('./puntuacion.js')
    : global.Puntuacion;

  // ── Constantes de puntuación ────────────────────────────────────────────────
  // Unidad base = P.FALLO (50), reutilizada de HitClaud en vez de duplicar el 50.
  const UNIDAD = P.FALLO;            // 50: el "escalón" de puntos de ShotClaud
  const VALOR_CENTRO = 200;          // acierto limpio al CENTRO del target, ANTES del ×racha
  const VALOR_LATERAL = UNIDAD;      // 50: rozar el target (fuera del centro) o pegarle ya caído
  const FALLO_BASE = UNIDAD;         // 50: castigo del 1.er y 2.o fallo seguidos

  // RACHA POSITIVA (multiplicador de aciertos al centro): SÓLO un acierto al centro
  // la sube. Es un contador de centros SEGUIDOS; el multiplicador aplicado a ESE
  // centro es el propio contador, tope ×5. Progresión: 1.er centro ×1, 2.o ×2, 3.o
  // ×3, 4.o ×4, 5.o y siguientes ×5. Máximo por tiro al centro: 200×5 = 1000.
  const RACHA_POS_TOPE = 5;

  // RACHA NEGATIVA (castigo por fallos SEGUIDOS): contador de fallos consecutivos.
  // Fallos 1 y 2 → ×1 (−50 cada uno). Desde el 3.o el castigo se multiplica: 3.o ×2,
  // 4.o ×3, 5.o ×4, 6.o y siguientes ×5 (tope). Peor caso por tiro: 50×5 = −250. Un
  // acierto al CENTRO la corta a cero; rozar el target o pegarle ya caído NO la cortan.
  const RACHA_NEG_DESDE = 3;         // desde este fallo consecutivo empieza a escalar
  const RACHA_NEG_TOPE = 5;          // tope del multiplicador de castigo

  // ── Zona central del target ─────────────────────────────────────────────────
  // El CENTRO es el cuarto central del target: mitad del ancho × mitad del alto,
  // centrado (ZONA_CENTRAL_FRAC = 0.5 de cada eje → ¼ del área). Se mide sobre el
  // target COMPLETO (su retícula cols×filas de cubos de 8px), NO sobre las celdas
  // vivas: la mordida de golpes anteriores no encoge ni mueve el centro.
  const ZONA_CENTRAL_FRAC = 0.5;
  const LADO_CUBO = 8;               // cada cubo de la retícula mide 8px (unidad atómica de fisica.js)

  // enZonaCentral(t, px, py): ¿el punto de mundo (px,py) cae en el cuarto central del
  // target COMPLETO? Lleva el punto al espacio LOCAL del target (rotación inversa,
  // igual criterio que fisica.celdaEnPunto) y compara contra el medio-eje central.
  // t: {x, y, rot, cols, filas}. Puro: no toca celdas vivas ni el DOM.
  function enZonaCentral(t, px, py) {
    const cols = t.cols || 5, filas = t.filas || 4;
    const dx = px - t.x, dy = py - t.y;
    const c = Math.cos(-t.rot || 0), s = Math.sin(-t.rot || 0);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    // Medio-eje del target completo (px): cols/filas cubos de 8px, mitad a cada lado.
    const medioW = cols * LADO_CUBO / 2;
    const medioH = filas * LADO_CUBO / 2;
    // El cuarto central llega hasta la MITAD de cada medio-eje.
    return Math.abs(lx) <= medioW * ZONA_CENTRAL_FRAC &&
           Math.abs(ly) <= medioH * ZONA_CENTRAL_FRAC;
  }

  // ── Marcador ────────────────────────────────────────────────────────────────
  // puntos ≥ 0 siempre. rachaPos = centros seguidos. rachaNeg = fallos seguidos.
  function crearMarcador() {
    return { puntos: 0, rachaPos: 0, rachaNeg: 0 };
  }

  // Multiplicador de la racha POSITIVA (aciertos al centro): el propio contador,
  // acotado a [1, RACHA_POS_TOPE]. Se llama DESPUÉS de subir la racha del centro.
  function multRachaPos(rachaPos) {
    return Math.min(RACHA_POS_TOPE, Math.max(1, rachaPos));
  }

  // Multiplicador del CASTIGO por racha NEGATIVA (fallos seguidos): ×1 hasta el 2.o
  // fallo; desde el 3.o crece 2,3,4,5… con tope RACHA_NEG_TOPE. n = fallo consecutivo.
  function multRachaNeg(rachaNeg) {
    if (rachaNeg < RACHA_NEG_DESDE) return 1;
    return Math.min(RACHA_NEG_TOPE, rachaNeg - 1);
  }

  // ── Eventos de puntuación (cuatro resultados posibles de un tiro) ─────────────

  // CENTRO: acierto limpio al cuarto central de un target INTACTO. Lo destruye
  // completo de un tiro (eso lo hace main.js). Sube la racha positiva, CORTA la
  // negativa a cero y anota 200×multiplicador. Devuelve {ganancia, mult}.
  function anotarCentro(m) {
    m.rachaPos += 1;
    m.rachaNeg = 0;
    const mult = multRachaPos(m.rachaPos);
    const g = VALOR_CENTRO * mult;
    m.puntos += g;
    return { ganancia: g, mult: mult };
  }

  // LATERAL: le pega al target INTACTO pero FUERA del centro. No lo destruye (sigue
  // cayendo por gravedad, aún golpeable). Anota 50 sin multiplicador y ROMPE la racha
  // positiva; NO toca la negativa (ni la corta ni la alimenta). Devuelve {ganancia}.
  function anotarLateral(m) {
    m.rachaPos = 0;
    const g = VALOR_LATERAL;
    m.puntos += g;
    return { ganancia: g };
  }

  // CAÍDO: le pega a un target YA tocado/caído. Vale 50 SIEMPRE (nunca 200, aunque
  // sea en el centro). NO alimenta ni rompe ninguna racha (ya está "gastado").
  function anotarCaido(m) {
    const g = VALOR_LATERAL;
    m.puntos += g;
    return { ganancia: g };
  }

  // FALLO: el tiro no tocó nada. Rompe la racha positiva, ALIMENTA la negativa y
  // resta el castigo escalado. El marcador nunca baja de cero. Devuelve {castigo, mult}.
  function anotarFallo(m) {
    m.rachaPos = 0;
    m.rachaNeg += 1;
    const mult = multRachaNeg(m.rachaNeg);
    const pen = FALLO_BASE * mult;
    m.puntos = Math.max(0, m.puntos - pen);
    return { castigo: pen, mult: mult };
  }

  // FIN de partida: rompe la racha positiva (no cambia puntos). Simetría con "la
  // racha positiva se rompe al terminar el juego"; sin efecto en el puntaje.
  function finPartida(m) {
    m.rachaPos = 0;
  }

  const S = {
    // constantes
    UNIDAD: UNIDAD, VALOR_CENTRO: VALOR_CENTRO, VALOR_LATERAL: VALOR_LATERAL,
    FALLO_BASE: FALLO_BASE, RACHA_POS_TOPE: RACHA_POS_TOPE,
    RACHA_NEG_DESDE: RACHA_NEG_DESDE, RACHA_NEG_TOPE: RACHA_NEG_TOPE,
    ZONA_CENTRAL_FRAC: ZONA_CENTRAL_FRAC,
    // geometría
    enZonaCentral: enZonaCentral,
    // marcador y multiplicadores
    crearMarcador: crearMarcador, multRachaPos: multRachaPos, multRachaNeg: multRachaNeg,
    // eventos
    anotarCentro: anotarCentro, anotarLateral: anotarLateral,
    anotarCaido: anotarCaido, anotarFallo: anotarFallo, finPartida: finPartida,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = S;
  } else {
    global.ShotClaud = S;
  }
})(typeof window !== 'undefined' ? window : globalThis);
