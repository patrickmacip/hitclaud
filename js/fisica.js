// hitclaud — fisica.js
// Motor de física del disparo. Módulo PURO: sin DOM, sin canvas.
// Corre igual en navegador (window.Fisica) y en node (module.exports).

(function (global) {
  'use strict';

  // ── Tokens de la física (afinar con el dueño jugando) ──────────────
  // MUNDO: vista LATERAL con GRAVEDAD (no cenital). La bolita sube, alcanza
  // ápice y cae, conservando su dirección horizontal. Sin paredes: vuela
  // libre y muere al salir del viewport o al agotar la vida máxima.
  const FISICA = {
    // Potencia por VELOCIDAD DE SUELTA (cómo sueltas, no el promedio del
    // gesto que siempre arranca en 0). Dominante la suelta, minoritaria la
    // distancia. potencia = PESO_SUELTA·velNorm + PESO_DISTANCIA·distNorm.
    PESO_SUELTA: 0.8,         // peso de la velocidad instantánea de suelta
    PESO_DISTANCIA: 0.2,      // peso de la distancia total normalizada
    VENTANA_SUELTA_MS: 50,    // ventana de la velocidad instantánea de suelta
    VEL_GESTO_TOPE: 2.5,      // px/ms de dedo que dan velNorm = 1
    DIST_TOPE_FRACCION: 0.4,  // distancia tope = 40% de la altura del viewport
    // Mapeo de salida: la bolita sale a MULT_SUELTA× la velocidad del dedo
    // (componente velocidad pura), nunca por debajo del dedo. El anillo no
    // miente: potencia manda el disparo 1:1.
    MULT_SUELTA: 1.4,         // multiplicador base sobre la velocidad del dedo
    // VEL_SALIDA_TOPE = MULT_SUELTA·VEL_GESTO_TOPE/PESO_SUELTA = 1.4·2.5/0.8.
    VEL_SALIDA_TOPE: 4.375,   // px/ms de salida con potencia = 1
    VEL_SALIDA_MAX: 5.0,      // px/ms tope de seguridad de la velocidad de salida
    // Spin por giro ENTRE MITADES del trazo (ventana completa del gesto),
    // referencia 60° = spin máximo.
    SPIN_REF_RAD: Math.PI / 3,
    // Chanfle medible: giro de ~45° (spin 0.75) a potencia media desvía
    // ≥100 px lateralmente en el vuelo visible (ver test d vs e).
    FACTOR_MAGNUS: 0.002,     // aceleración perpendicular = factor · spin · |v|
    DECAIMIENTO_SPIN: 0.0015, // tasa exponencial de decaimiento del spin, por ms
    // Gravedad: a potencia máx (≈4.375 px/ms) y tiro vertical el ápice sube
    // v²/(2g) muy alto → sale por el borde superior; a media potencia arco
    // corto. Cuenta de referencia con 2.2 px/ms: 2.2²/(2·0.0035) ≈ 691 px.
    GRAVEDAD: 0.0035,         // px/ms² de aceleración hacia abajo
    VEL_CAIDA_MAX: 2.8,       // px/ms tope de velocidad vertical de caída
    VIDA_MAX_MS: 6000,        // válvula de seguridad: muere a los 6 s
    RADIO_BOLITA: 14,         // px (bolita de 28)
  };

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function largoTrazo(puntos) {
    let largo = 0;
    for (let i = 1; i < puntos.length; i++) {
      largo += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
    }
    return largo;
  }

  // Spin por giro ENTRE MITADES del trazo (ventana completa del gesto):
  // ángulo firmado de la dirección 1ª mitad → 2ª mitad, normalizado con
  // SPIN_REF_RAD (60°) = ±1.
  function spinDeTrazo(puntos) {
    const n = puntos.length;
    if (n < 3) return 0;
    const mid = Math.floor((n - 1) / 2);
    const d1x = puntos[mid].x - puntos[0].x;
    const d1y = puntos[mid].y - puntos[0].y;
    const d2x = puntos[n - 1].x - puntos[mid].x;
    const d2y = puntos[n - 1].y - puntos[mid].y;
    if ((d1x === 0 && d1y === 0) || (d2x === 0 && d2y === 0)) return 0;
    let ang = Math.atan2(d2y, d2x) - Math.atan2(d1y, d1x);
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    return Math.max(-1, Math.min(1, ang / FISICA.SPIN_REF_RAD));
  }

  // Velocidad instantánea de suelta (px/ms) + su dirección: rapidez del
  // trazo en los últimos VENTANA_SUELTA_MS; si <2 puntos caen en la ventana,
  // los 2 últimos con su dt real.
  function sueltaDeTrazo(puntos) {
    const tFin = puntos[puntos.length - 1].t;
    let i = puntos.length - 1;
    while (i > 0 && tFin - puntos[i - 1].t <= FISICA.VENTANA_SUELTA_MS) i--;
    let tramo = puntos.slice(i);
    if (tramo.length < 2) tramo = puntos.slice(-2);
    const dur = Math.max(tramo[tramo.length - 1].t - tramo[0].t, 1);
    const a = tramo[0];
    const b = tramo[tramo.length - 1];
    return { velocidad: largoTrazo(tramo) / dur, dx: b.x - a.x, dy: b.y - a.y };
  }

  // puntosDelGesto: [{x, y, t}] (t en ms). alturaViewport: px.
  // → {vx, vy, spin, potencia, velSuelta} en px/ms, o null si no hay disparo.
  function crearDisparo(puntos, alturaViewport) {
    if (!puntos || puntos.length < 2) return null;
    const largo = largoTrazo(puntos);
    if (largo === 0) return null;

    const suelta = sueltaDeTrazo(puntos);
    const velNorm = clamp01(suelta.velocidad / FISICA.VEL_GESTO_TOPE);
    const distNorm = clamp01(largo / (FISICA.DIST_TOPE_FRACCION * alturaViewport));
    const potencia = clamp01(
      FISICA.PESO_SUELTA * velNorm + FISICA.PESO_DISTANCIA * distNorm
    );

    // La potencia manda el disparo 1:1 (el anillo no miente). Calibrado:
    // componente velocidad pura → MULT_SUELTA× la velocidad del dedo.
    const rapidez = Math.min(potencia * FISICA.VEL_SALIDA_TOPE, FISICA.VEL_SALIDA_MAX);

    // Dirección = hacia dónde va el dedo AL SOLTAR; si el dedo está detenido,
    // cae desde inicio→fin del gesto.
    let dx = suelta.dx;
    let dy = suelta.dy;
    let dnorm = Math.hypot(dx, dy);
    if (dnorm === 0) {
      dx = puntos[puntos.length - 1].x - puntos[0].x;
      dy = puntos[puntos.length - 1].y - puntos[0].y;
      dnorm = Math.hypot(dx, dy);
    }

    let vx = 0;
    let vy = 0;
    if (dnorm > 0) {
      vx = (dx / dnorm) * rapidez;
      vy = (dy / dnorm) * rapidez;
    }

    return { vx: vx, vy: vy, spin: spinDeTrazo(puntos), potencia: potencia, velSuelta: suelta.velocidad };
  }

  // Integra un paso de dt ms. bolita: {x, y, vx, vy, spin, edad, viva}.
  // limites: {w, h}. Muta y devuelve la bolita. Sin paredes: vuelo libre;
  // marca viva=false al salir del viewport o al agotar la vida máxima.
  function paso(bolita, dt, limites) {
    // Magnus simplificado (chanfle): aceleración perpendicular a la
    // velocidad, proporcional al spin, con decaimiento exponencial. Se
    // SUMA a la gravedad → la curva se nota sobre la parábola.
    const v = Math.hypot(bolita.vx, bolita.vy);
    if (v > 0 && bolita.spin !== 0) {
      const a = FISICA.FACTOR_MAGNUS * bolita.spin * v;
      const nx = -bolita.vy / v;
      const ny = bolita.vx / v;
      bolita.vx += nx * a * dt;
      bolita.vy += ny * a * dt;
    }
    bolita.spin *= Math.exp(-FISICA.DECAIMIENTO_SPIN * dt);

    // Gravedad constante hacia abajo, con tope de velocidad de caída.
    bolita.vy += FISICA.GRAVEDAD * dt;
    if (bolita.vy > FISICA.VEL_CAIDA_MAX) bolita.vy = FISICA.VEL_CAIDA_MAX;

    bolita.x += bolita.vx * dt;
    bolita.y += bolita.vy * dt;

    bolita.edad += dt;

    // Muerte: fuera del viewport (cualquier borde) o vida agotada.
    const r = FISICA.RADIO_BOLITA;
    if (
      bolita.edad >= FISICA.VIDA_MAX_MS ||
      bolita.x < -r ||
      bolita.x > limites.w + r ||
      bolita.y < -r ||
      bolita.y > limites.h + r
    ) {
      bolita.viva = false;
    }
    return bolita;
  }

  const Fisica = {
    FISICA: FISICA,
    crearDisparo: crearDisparo,
    paso: paso,
    largoTrazo: largoTrazo,
    spinDeTrazo: spinDeTrazo,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fisica;
  } else {
    global.Fisica = Fisica;
  }
})(typeof window !== 'undefined' ? window : globalThis);
