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
    // Curva de respuesta con saturación asintótica (sin tope duro, sin
    // escalón): v_salida = VEL_SALIDA_MAX · tanh(k · velSuelta), con
    // k = MULT_SUELTA / VEL_SALIDA_MAX para que la pendiente inicial sea
    // MULT_SUELTA. Zona baja/media ≈ 1:1 con el dedo; cerca del techo la
    // ganancia decae; nunca se supera VEL_SALIDA_MAX.
    MULT_SUELTA: 1.4,         // ganancia de zona baja (pendiente inicial de la curva)
    VENTANA_SUELTA_MS: 70,    // ventana de lectura de la velocidad de suelta
    VEL_SALIDA_MAX: 4.0,      // px/ms techo asintótico de la velocidad de salida
    GRAVEDAD: 0.0035,         // px/ms² de aceleración hacia abajo
    VEL_CAIDA_MAX: 2.8,       // px/ms tope de velocidad vertical de caída
    VIDA_MAX_MS: 6000,        // válvula de seguridad: muere a los 6 s
    RADIO_BOLITA: 14,         // px (bolita de 28)
    RADIO_TARGET: 24,         // px de margen de salida del target (sprite 40×32)
  };

  // Rangos de LANZAMIENTO de targets (px/ms, px). Los targets se lanzan como
  // objetos aventados y reusan paso() con la MISMA gravedad — sin motor
  // paralelo. Inferior/laterales SIEMPRE hacia arriba y hacia el interior.
  // NOTA de física: con g=0.0035 y h=844, el vuelo visible máximo de una
  // parábola es ~1.39s (subir 844px = 694ms ×2), con el ápice pegado al
  // techo. El objetivo alcanzable es 0.8–1.4s con ápice al 20–80%.
  const LANZA = {
    PESO_INFERIOR: 0.40,
    PESO_LATERAL: 0.45,
    PESO_SUPERIOR: 0.15,
    MARGEN: 40,               // px fuera del borde donde nace el target
    SUP_MARGEN: 10,           // margen menor arriba: menos pre-aceleración → cruce ≥0.6s
    INF_X: [0.05, 0.70],      // fracción de ancho (70% izq, lejos del hitmaker)
    INF_VX: [-0.10, 0.25],    // leve componente lateral
    INF_VY: [1.5, 2.1],       // hacia arriba (se resta): arco visible 0.8–1.4s
    LAT_Y: [0.72, 0.86],      // fracción de altura (mitad-baja; ápice queda 20–80%)
    LAT_VX: [0.24, 0.40],     // hacia el interior
    LAT_VY: [1.45, 1.70],     // hacia arriba
    SUP_X_BORDE: [0.05, 0.22], // fracción de ancho cerca del borde de origen
    SUP_VX: [0.22, 0.40],     // componente lateral (cruza en diagonal, pista completa)
    SUP_VY: [0.02, 0.14],     // hacia abajo, casi nula: entra lento → cruce ≥0.6s
    VEL_ROT: [-0.003, 0.003], // rad/ms, ambos sentidos, giro constante sin torque
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
    // Saturación suave hacia el techo: 1:1 abajo, sin escalón arriba.
    const k = FISICA.MULT_SUELTA / FISICA.VEL_SALIDA_MAX;
    const rapidez = FISICA.VEL_SALIDA_MAX * Math.tanh(k * suelta.velocidad);

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

  function rango(r) { return r[0] + Math.random() * (r[1] - r[0]); }

  // crearTarget(limites) → objeto lanzado que reusa paso().
  // Nace FUERA del viewport; haEntrado evita que muera en su primer cuadro.
  function crearTarget(limites) {
    const w = limites.w;
    const h = limites.h;
    const M = LANZA.MARGEN;
    const d = Math.random();
    let origen;
    if (d < LANZA.PESO_INFERIOR) origen = 'inferior';
    else if (d < LANZA.PESO_INFERIOR + LANZA.PESO_LATERAL) origen = 'lateral';
    else origen = 'superior';

    let x, y, vx, vy;
    if (origen === 'inferior') {
      x = rango(LANZA.INF_X) * w;
      y = h + M;
      vx = rango(LANZA.INF_VX);
      vy = -rango(LANZA.INF_VY);
    } else if (origen === 'lateral') {
      const izq = Math.random() < 0.5;
      y = rango(LANZA.LAT_Y) * h;
      x = izq ? -M : w + M;
      vx = izq ? rango(LANZA.LAT_VX) : -rango(LANZA.LAT_VX);
      vy = -rango(LANZA.LAT_VY);
    } else {
      // Superior: nace cerca de un borde y cruza en diagonal (pista completa)
      // para no salir por el costado antes de 0.6 s.
      const izq = Math.random() < 0.5;
      x = (izq ? rango(LANZA.SUP_X_BORDE) : 1 - rango(LANZA.SUP_X_BORDE)) * w;
      y = -LANZA.SUP_MARGEN;
      vx = (izq ? 1 : -1) * rango(LANZA.SUP_VX);
      vy = rango(LANZA.SUP_VY);
    }

    return {
      x: x, y: y, vx: vx, vy: vy,
      rot: 0, velRot: rango(LANZA.VEL_ROT),
      radio: FISICA.RADIO_TARGET,
      haEntrado: false, edad: 0, viva: true, origen: origen,
    };
  }

  // Integra un paso de dt ms. objeto: {x, y, vx, vy, edad, viva} y opcional
  // {rot, velRot, radio, haEntrado}. limites: {w, h}. Muta y devuelve.
  // Fuente ÚNICA de física para bolitas y targets. Sin paredes: vuelo libre.
  function paso(o, dt, limites) {
    // Gravedad constante hacia abajo, con tope de velocidad de caída.
    o.vy += FISICA.GRAVEDAD * dt;
    if (o.vy > FISICA.VEL_CAIDA_MAX) o.vy = FISICA.VEL_CAIDA_MAX;

    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (o.velRot) o.rot += o.velRot * dt; // giro constante (targets)

    o.edad += dt;

    // haEntrado: los targets nacen fuera; no son matables hasta entrar una
    // vez (las bolitas nacen dentro → entran en su primer cuadro).
    const r = o.radio || FISICA.RADIO_BOLITA;
    if (o.x >= 0 && o.x <= limites.w && o.y >= 0 && o.y <= limites.h) {
      o.haEntrado = true;
    }
    const fuera =
      o.x < -r || o.x > limites.w + r || o.y < -r || o.y > limites.h + r;
    if (o.edad >= FISICA.VIDA_MAX_MS || (o.haEntrado && fuera)) {
      o.viva = false;
    }
    return o;
  }

  const Fisica = {
    FISICA: FISICA,
    LANZA: LANZA,
    crearDisparo: crearDisparo,
    crearTarget: crearTarget,
    paso: paso,
    largoTrazo: largoTrazo,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fisica;
  } else {
    global.Fisica = Fisica;
  }
})(typeof window !== 'undefined' ? window : globalThis);
