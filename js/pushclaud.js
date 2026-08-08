// hitclaud — pushclaud.js
// Reglas PURAS de Pushcloude, el juego de APLASTAR con el dedo (sin DOM): puntuación por
// zona central, racha, y el CICLO DE METAS de 15 s (1000 puntos o se reinician). Corre igual
// en navegador (window.Pushcloude) y en node (module.exports), como shotclaud.js.
//
// REUTILIZA sin duplicar ni cambiar el comportamiento de otros módulos:
//   · js/puntuacion.js → P.multRacha (MISMA progresión de racha que Hitcloude, tope ×5, CAMBIO 3.6)
//                        y P.FALLO (50, "el fallo que ya existe", CAMBIO 3.5).
//   · js/shotclaud.js  → S.enZonaCentral (misma geometría del cuarto central; en Pushcloude SÍ se
//                        dibuja —eso vive en main.js—, pero el CÁLCULO es idéntico, CAMBIO 3.1).

(function (global) {
  'use strict';

  const P = (typeof module !== 'undefined' && module.exports) ? require('./puntuacion.js') : global.Puntuacion;
  const S = (typeof module !== 'undefined' && module.exports) ? require('./shotclaud.js') : global.ShotClaud;

  // ── Constantes de puntuación (VALORES APROBADOS POR PAT, CAMBIO 3) ────────────────────────────
  const VALOR_CENTRO = 200;          // acierto al CENTRO, ANTES del ×racha (3.3)
  const VALOR_LATERAL = P.FALLO;     // 50: toque FUERA del centro, sin multiplicar (3.4)
  const FALLO_BASE = P.FALLO;        // 50: toque al VACÍO, resta plana (3.5, "el fallo que ya existe")
  const RACHA_TOPE = P.RACHA_TOPE;   // ×5 (misma economía que Hitcloude, 3.6)

  // ── CICLO DE METAS (CAMBIO 4). Un solo sitio (4.6). ──────────────────────────────────────────
  const META_PUNTOS = 1000;          // hay que LLEVAR esto acumulado en cada ciclo (4.1)
  const CICLO_MS = 15000;            // duración de cada ciclo (4.4/4.6)

  // ── Marcador ─────────────────────────────────────────────────────────────────────────────────
  // puntos ≥ 0 siempre (3.7). racha = toques al CENTRO seguidos (sólo el centro la sube, 3.6).
  function crearMarcador() { return { puntos: 0, racha: 0 }; }

  // Multiplicador de la racha: EXACTAMENTE el de Hitcloude (P.multRacha) → una sola economía (3.6).
  function multRacha(racha) { return P.multRacha(racha); }

  // Zona central: reusa la geometría de Shotcloude sin cambiarla (el CUARTO central del target).
  function enZonaCentral(t, px, py) { return S.enZonaCentral(t, px, py); }

  // CENTRO (3.3): destruye el target completo (eso lo hace main.js), 200×racha, la racha SUBE.
  // La racha se incrementa ANTES de leer el multiplicador → 1.er centro ×1, 3.er ×1.2, … ×5 al 22.º
  // (idéntico a Hitcloude). Devuelve {ganancia, mult}.
  function anotarCentro(m) {
    m.racha += 1;
    const mult = P.multRacha(m.racha);
    const g = Math.round(VALOR_CENTRO * mult);
    m.puntos += g;
    return { ganancia: g, mult: mult };
  }

  // FUERA del centro (3.4): 50 sin multiplicar, la racha SE ROMPE. (El "arranca un tercio" y "el
  // resto sigue su ruta sin desplomarse" es física de main.js; aquí sólo la puntuación.)
  function anotarLateral(m) {
    m.racha = 0;
    const g = VALOR_LATERAL;
    m.puntos += g;
    return { ganancia: g };
  }

  // VACÍO (3.5): resta plana (50), la racha se rompe. El marcador nunca baja de 0 (3.7).
  function anotarFallo(m) {
    m.racha = 0;
    const pen = FALLO_BASE;
    m.puntos = Math.max(0, m.puntos - pen);
    return { castigo: pen };
  }

  // ── Ciclo de metas (puro; el reloj lo lleva main.js) ─────────────────────────────────────────
  // `base` = puntos que había al INICIO del ciclo en curso. El progreso del ciclo es lo GANADO
  // desde ese punto (puntos − base). La meta es SIEMPRE META_PUNTOS (la exigencia no sube, 4.2).
  function progresoCiclo(m, base) { return m.puntos - base; }
  function metaCumplida(m, base) { return (m.puntos - base) >= META_PUNTOS; }
  // Cierra el ciclo de 15 s. CUMPLIÓ (ganó ≥1000): conserva los puntos y el nuevo `base` = puntos
  // (sigue acumulando, 4.2). NO cumplió: reinicia puntos y racha a 0 (4.3) y `base` = 0. En ambos
  // casos el llamador arranca otro ciclo de 15 s; el reloj de la PARTIDA no se toca aquí (4.3).
  function cerrarCiclo(m, base) {
    if ((m.puntos - base) >= META_PUNTOS) return { cumplida: true, base: m.puntos };
    m.puntos = 0; m.racha = 0;
    return { cumplida: false, base: 0 };
  }

  const PU = {
    VALOR_CENTRO: VALOR_CENTRO, VALOR_LATERAL: VALOR_LATERAL, FALLO_BASE: FALLO_BASE,
    RACHA_TOPE: RACHA_TOPE, META_PUNTOS: META_PUNTOS, CICLO_MS: CICLO_MS,
    crearMarcador: crearMarcador, multRacha: multRacha, enZonaCentral: enZonaCentral,
    anotarCentro: anotarCentro, anotarLateral: anotarLateral, anotarFallo: anotarFallo,
    progresoCiclo: progresoCiclo, metaCumplida: metaCumplida, cerrarCiclo: cerrarCiclo,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PU;
  else global.Pushcloude = PU;
})(typeof window !== 'undefined' ? window : globalThis);
