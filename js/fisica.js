// hitclaud — fisica.js
// Motor de física del disparo. Módulo PURO: sin DOM, sin canvas.
// Corre igual en navegador (window.Fisica) y en node (module.exports).

(function (global) {
  'use strict';

  // ── Tokens de la física (afinar con el dueño jugando) ──────────────
  // MUNDO: vista LATERAL con GRAVEDAD (no cenital). La bolita sube, alcanza
  // ápice y cae, conservando su dirección horizontal. Sin paredes: vuela
  // libre y muere al salir del viewport o al agotar la vida máxima.
  //
  // TIRO 1:1 CON EL DEDO: la potencia es SOLO la velocidad instantánea de
  // suelta × un multiplicador FIJO. La distancia NO entra — el mismo gesto
  // rinde igual sin importar cuánto arrastraste (tiro predecible).
  const FISICA = {
    MULT_SUELTA: 1.4,         // salida = velocidad del dedo al soltar × 1.4
    VENTANA_SUELTA_MS: 70,    // ventana de lectura de la velocidad de suelta
    VEL_SALIDA_MAX: 5.0,      // px/ms tope de seguridad de la velocidad de salida
    GRAVEDAD: 0.0035,         // px/ms² de aceleración hacia abajo
    VEL_CAIDA_MAX: 2.8,       // px/ms tope de velocidad vertical de caída
    VIDA_MAX_MS: 6000,        // válvula de seguridad: muere a los 6 s
    RADIO_BOLITA: 14,         // px (bolita de 28)
  };

  function largoTrazo(puntos) {
    let largo = 0;
    for (let i = 1; i < puntos.length; i++) {
      largo += Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
    }
    return largo;
  }

  function mediana(valores) {
    if (valores.length === 0) return 0;
    const s = valores.slice().sort(function (a, b) { return a - b; });
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Velocidad instantánea de suelta (px/ms) + su dirección.
  // Lectura robusta: en los últimos VENTANA_SUELTA_MS toma la MEDIANA de las
  // velocidades por segmento (los pointer events llegan irregulares; un dt de
  // 4 ms con un salto grande dispararía un falso pico — la mediana lo ignora).
  // Si <2 puntos caen en la ventana, usa los 2 últimos con su dt real.
  // NO suaviza el seguimiento del dedo; sólo la lectura AL SOLTAR.
  function velocidadSuelta(puntos) {
    const tFin = puntos[puntos.length - 1].t;
    let i = puntos.length - 1;
    while (i > 0 && tFin - puntos[i - 1].t <= FISICA.VENTANA_SUELTA_MS) i--;
    let tramo = puntos.slice(i);
    if (tramo.length < 2) tramo = puntos.slice(-2);

    const velos = [];
    for (let k = 1; k < tramo.length; k++) {
      const dt = tramo[k].t - tramo[k - 1].t;
      if (dt <= 0) continue;
      velos.push(Math.hypot(tramo[k].x - tramo[k - 1].x, tramo[k].y - tramo[k - 1].y) / dt);
    }
    const velocidad = mediana(velos);

    // Dirección = extremos de la ventana (hacia dónde va el dedo al soltar).
    const a = tramo[0];
    const b = tramo[tramo.length - 1];
    return { velocidad: velocidad, dx: b.x - a.x, dy: b.y - a.y };
  }

  // puntosDelGesto: [{x, y, t}] (t en ms).
  // → {vx, vy, velSuelta} en px/ms, o null si el gesto no da disparo.
  function crearDisparo(puntos) {
    if (!puntos || puntos.length < 2) return null;

    const suelta = velocidadSuelta(puntos);
    const rapidez = Math.min(suelta.velocidad * FISICA.MULT_SUELTA, FISICA.VEL_SALIDA_MAX);

    // Dirección de la suelta; si el dedo está detenido (sin dirección en la
    // ventana), cae desde inicio→fin del gesto.
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

    return { vx: vx, vy: vy, velSuelta: suelta.velocidad };
  }

  // Integra un paso de dt ms. bolita: {x, y, vx, vy, edad, viva}.
  // limites: {w, h}. Muta y devuelve la bolita. Sin paredes: vuelo libre;
  // marca viva=false al salir del viewport o al agotar la vida máxima.
  function paso(bolita, dt, limites) {
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
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fisica;
  } else {
    global.Fisica = Fisica;
  }
})(typeof window !== 'undefined' ? window : globalThis);
