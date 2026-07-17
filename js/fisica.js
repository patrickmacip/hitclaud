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
    PESO_VELOCIDAD: 0.7,      // peso de la componente velocidad en la potencia
    PESO_DISTANCIA: 0.3,      // peso de la componente distancia
    VEL_GESTO_TOPE: 2.5,      // px/ms de gesto que dan componente velocidad = 1
    DIST_TOPE_FRACCION: 0.4,  // distancia tope = 40% de la altura del viewport
    VENTANA_SOLTAR_MS: 100,   // último tramo del gesto: cómo SUELTAS
    PESO_TRAMO_FINAL: 0.65,   // énfasis del último tramo en la rapidez media
    VEL_BOLITA_MIN: 0.35,     // px/ms de la bolita con potencia 0
    VEL_BOLITA_MAX: 2.2,      // px/ms de la bolita con potencia 1
    VENTANA_SPIN_MS: 80,      // tramo final del trazo que define el spin
    SPIN_ANGULO_TOPE: 1.2,    // rad de curvatura que dan spin = ±1
    FACTOR_MAGNUS: 0.0008,    // aceleración perpendicular = factor · spin · |v|
    DECAIMIENTO_SPIN: 0.0015, // tasa exponencial de decaimiento del spin, por ms
    // Gravedad: a potencia máx (2.2 px/ms) y tiro vertical el ápice sube
    // v²/(2g) = 2.2²/(2·0.0035) ≈ 691 px en v/g ≈ 629 ms (<1 s, ~borde sup).
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

  // Rapidez media (px/ms) de los puntos cuyo t cae en los últimos `ventanaMs`.
  function rapidezTramoFinal(puntos, ventanaMs) {
    const tFin = puntos[puntos.length - 1].t;
    let i = puntos.length - 1;
    while (i > 0 && tFin - puntos[i - 1].t <= ventanaMs) i--;
    const tramo = puntos.slice(i);
    if (tramo.length < 2) return 0;
    const dur = Math.max(tramo[tramo.length - 1].t - tramo[0].t, 1);
    return largoTrazo(tramo) / dur;
  }

  // Curvatura firmada (rad acumulados) del tramo final del trazo.
  function curvaturaTramoFinal(puntos, ventanaMs) {
    const tFin = puntos[puntos.length - 1].t;
    const tramo = puntos.filter((p) => tFin - p.t <= ventanaMs);
    let suma = 0;
    let anguloPrevio = null;
    for (let i = 1; i < tramo.length; i++) {
      const dx = tramo[i].x - tramo[i - 1].x;
      const dy = tramo[i].y - tramo[i - 1].y;
      if (dx === 0 && dy === 0) continue;
      const angulo = Math.atan2(dy, dx);
      if (anguloPrevio !== null) {
        let d = angulo - anguloPrevio;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        suma += d;
      }
      anguloPrevio = angulo;
    }
    return suma;
  }

  // puntosDelGesto: [{x, y, t}] (t en ms). alturaViewport: px.
  // → {vx, vy, spin, potencia} en px/ms, o null si el gesto no da disparo.
  function crearDisparo(puntos, alturaViewport) {
    if (!puntos || puntos.length < 2) return null;
    const ini = puntos[0];
    const fin = puntos[puntos.length - 1];
    const dx = fin.x - ini.x;
    const dy = fin.y - ini.y;
    const cuerda = Math.hypot(dx, dy);
    const largo = largoTrazo(puntos);
    if (cuerda === 0 || largo === 0) return null;

    // Componente VELOCIDAD: rapidez media con énfasis en el último tramo.
    const durTotal = Math.max(fin.t - ini.t, 1);
    const rapidezTotal = largo / durTotal;
    const rapidezFinal = rapidezTramoFinal(puntos, FISICA.VENTANA_SOLTAR_MS);
    const rapidez =
      (1 - FISICA.PESO_TRAMO_FINAL) * rapidezTotal +
      FISICA.PESO_TRAMO_FINAL * rapidezFinal;
    const compVelocidad = clamp01(rapidez / FISICA.VEL_GESTO_TOPE);

    // Componente DISTANCIA: largo total contra su tope (40% de la altura).
    const compDistancia = clamp01(largo / (FISICA.DIST_TOPE_FRACCION * alturaViewport));

    const potencia =
      FISICA.PESO_VELOCIDAD * compVelocidad +
      FISICA.PESO_DISTANCIA * compDistancia;

    const velocidad =
      FISICA.VEL_BOLITA_MIN + potencia * (FISICA.VEL_BOLITA_MAX - FISICA.VEL_BOLITA_MIN);

    // Dirección: vector inicio→fin.
    const vx = (dx / cuerda) * velocidad;
    const vy = (dy / cuerda) * velocidad;

    // Spin: curvatura de los últimos ~80 ms, normalizada a ±1.
    const curva = curvaturaTramoFinal(puntos, FISICA.VENTANA_SPIN_MS);
    const spin = Math.max(-1, Math.min(1, curva / FISICA.SPIN_ANGULO_TOPE));

    return { vx: vx, vy: vy, spin: spin, potencia: potencia };
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

  const Fisica = { FISICA: FISICA, crearDisparo: crearDisparo, paso: paso, largoTrazo: largoTrazo };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fisica;
  } else {
    global.Fisica = Fisica;
  }
})(typeof window !== 'undefined' ? window : globalThis);
