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
    // TECHO CONTROLADO: tiro vertical desde el reposo (y≈792 en h=844) debe
    // apenas no cruzar el borde superior. Con subpasos (integración precisa),
    // ápice objetivo ~50px del borde → subida 742px → v = √(2·0.0035·742) =
    // √5.19 ≈ 2.28 px/ms. Como tanh satura, la salida real queda por debajo.
    MULT_SUELTA: 1.4,         // ganancia de zona baja (pendiente inicial de la curva)
    VENTANA_SUELTA_MS: 70,    // ventana de lectura de la velocidad de suelta
    VEL_SALIDA_MAX: 2.28,     // px/ms techo asintótico (subpasos: ápice ~50px del borde)
    MAX_PASO_PX: 6,           // desplazamiento máx por subpaso de paso() (fin del túnel)
    GRAVEDAD: 0.0035,         // px/ms² de aceleración hacia abajo (bolitas)
    G_TARGET: 0.0021,         // px/ms² de los targets = 0.6 × GRAVEDAD (flote lunar)
    VEL_CAIDA_MAX: 2.8,       // px/ms tope de velocidad vertical de caída
    VIDA_MAX_MS: 6000,        // válvula de seguridad: muere a los 6 s
    RADIO_BOLITA: 14,         // px (bolita de 28)
    RADIO_TARGET: 24,         // px de margen de salida del target (sprite 40×32)
    // Colisión hitball ↔ target (sprite 40×32 → medios ejes 20×16).
    TARGET_HW: 20,
    TARGET_HH: 16,
    RESTITUCION_GOLPE: 0.3,   // FASE 14: el impacto PESA (antes 0.6) → rebota menos, se siente pesado
    MASA_TARGET: 2.5,         // "peso" de un target intacto (20 cubos); baja con el daño
    MASA_HITBALL: 1.1,        // FASE 23: masa de la hitball (antes 1, implícita) → +10%, pesa más
    // Umbral de destrucción (rapidez normal de impacto, px/ms). Cuenta: la
    // salida a velSuelta≈0.68 px/ms (flick deliberado) es 2.26·tanh(0.619·0.68)
    // ≈ 0.9; por encima destruye entero.
    UMBRAL_DESTRUCCION: 0.9,
    // Daño por golpe: CUALQUIER contacto arranca ≥1 cubo (el toque mínimo nunca
    // es fallo). Mapeo lineal: contacto mínimo (poder→0) → 1 cubo; poder justo
    // por debajo de DESTRUCCIÓN → 8 cubos. Ya no existe "solo empuje sin daño".
    DANO_CUBOS_MAX: 8,
    DESMORONA_CUBOS: 4,       // ≤ este nº de cubos vivos tras un golpe → muere
  };

  // Rangos de LANZAMIENTO de targets (px/ms, px). SPAWN CAÓTICO MULTI-ORIGEN:
  // los targets salen de los CUATRO lados (inferior, superior, lateral-izq,
  // lateral-der) con VELOCIDAD VARIABLE por target (lentos y rápidos mezclados)
  // dentro de rangos jugables. Reusan paso() con la MISMA gravedad (G_TARGET),
  // sin motor paralelo. Física coherente por origen:
  //   inferior     → sube en arco (ápice 0.36–0.80h, nunca cruza el techo).
  //   superior     → entra desde arriba y cruza en diagonal hacia el centro.
  //   lateral-izq  → entra por la izquierda cruzando a la derecha, en arco.
  //   lateral-der  → espejo del izquierdo.
  const LANZA = {
    // Pesos de los 4 orígenes (suman 1): todos sustanciales → caos real.
    PESO_INFERIOR: 0.30,
    PESO_SUPERIOR: 0.22,
    PESO_LAT_IZQ: 0.24,
    PESO_LAT_DER: 0.24,
    FUERZA: 1.0,
    MARGEN: 40,               // px fuera del borde inferior donde nace
    LAT_MARGEN: 8,            // margen lateral (entra rápido)
    SUP_MARGEN: 10,           // margen superior
    // VELOCIDAD VARIABLE: el ancho de cada rango da la mezcla lento↔rápido.
    INF_X: [0.06, 0.80],      // fracción de ancho (evita la esquina del hitmaker)
    INF_VX: [-0.18, 0.18],    // componente lateral variable (diagonales)
    INF_VY: [1.15, 1.72],     // hacia arriba: ápice 0.36–0.80h (lento↔rápido)
    LAT_Y: [0.45, 0.92],      // altura de entrada variable
    LAT_VX: [0.14, 0.42],     // hacia el interior (magnitud; el signo lo pone el lado)
    LAT_VY: [0.90, 1.62],     // arco hacia arriba variable
    SUP_X: [0.06, 0.94],      // nace en cualquier x arriba
    SUP_VX: [0.10, 0.30],     // cruza en diagonal suave (signo hacia el centro)
    SUP_VY: [0.0, 0.14],      // entra MUY lento
    SUP_GRAV_FRAC: 0.6,       // caída más lenta desde arriba → linger ≥1s, alcanzable
    VEL_ROT: [-0.003, 0.003], // rad/ms, ambos sentidos, giro constante sin torque
    // TODO LO QUE SUBE, BAJA EN PANTALLA: se recorta la velocidad hacia arriba para
    // que el ÁPICE quede al menos APEX_MARGEN px por debajo del techo → el arco
    // (subir y bajar) sucede DENTRO del rango visual, nunca se va por arriba.
    APEX_MARGEN: 40,
    // VELOCIDAD −40%: cada target va 40% más lento. Se escala la velocidad ×0.6 y
    // la gravedad ×0.36 (=0.6²) → el ARCO no cambia (ápice ∝ v²/g inalterado), pero
    // se recorre 40% más lento (tiempo ∝ v/g → ×1/0.6). Se ve claramente más lento.
    VEL_FACTOR: 0.6,
    // FASE 10: +25% de velocidad de TRAYECTORIA sobre el valor actual. Se aplica
    // SOLO a la magnitud de la velocidad inicial (vx, vy) — la gravedad lunar (0.6×)
    // y los ángulos/orígenes NO cambian. Factor efectivo de velocidad: 0.6×1.25=0.75.
    // Los especiales heredan este valor y conservan su relación con el normal
    // (rojo/CloudOver = 1×, grande = 1/3, ambos calculados sobre el nuevo normal).
    VEL_TRAYECTORIA: 1.25,
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
  function crearTarget(limites, cols, filas) {
    cols = cols || 5;
    filas = filas || 4;
    const w = limites.w;
    const h = limites.h;
    const d = Math.random();
    const pI = LANZA.PESO_INFERIOR;
    const pS = pI + LANZA.PESO_SUPERIOR;
    const pLi = pS + LANZA.PESO_LAT_IZQ;
    let origen;
    if (d < pI) origen = 'inferior';
    else if (d < pS) origen = 'superior';
    else if (d < pLi) origen = 'lateral-izq';
    else origen = 'lateral-der';

    let x, y, vx, vy;
    let gravedad = FISICA.G_TARGET;
    if (origen === 'inferior') {
      x = rango(LANZA.INF_X) * w;
      y = h + LANZA.MARGEN;
      vx = rango(LANZA.INF_VX);
      vy = -rango(LANZA.INF_VY);
    } else if (origen === 'superior') {
      // Nace arriba y cruza en diagonal HACIA EL CENTRO (según su lado de origen).
      // Gravedad reducida → cae despacio y da tiempo de acertarle.
      x = rango(LANZA.SUP_X) * w;
      y = -LANZA.SUP_MARGEN;
      vx = (x < w / 2 ? 1 : -1) * rango(LANZA.SUP_VX);
      vy = rango(LANZA.SUP_VY);
      gravedad = FISICA.G_TARGET * LANZA.SUP_GRAV_FRAC;
    } else if (origen === 'lateral-izq') {
      x = -LANZA.LAT_MARGEN;
      y = rango(LANZA.LAT_Y) * h;
      vx = rango(LANZA.LAT_VX);     // hacia la derecha (interior)
      vy = -rango(LANZA.LAT_VY);    // arco hacia arriba
    } else { // lateral-der
      x = w + LANZA.LAT_MARGEN;
      y = rango(LANZA.LAT_Y) * h;
      vx = -rango(LANZA.LAT_VX);    // hacia la izquierda (interior)
      vy = -rango(LANZA.LAT_VY);
    }

    // VELOCIDAD: v×(0.6×1.25=0.75), gravedad×0.36. El +25% (VEL_TRAYECTORIA) toca
    // SOLO la magnitud inicial; la gravedad conserva el factor lunar −40² previo →
    // el vuelo es 25% más rápido y el arco un poco más alto/estirado (no re-escalado).
    vx *= LANZA.VEL_FACTOR * LANZA.VEL_TRAYECTORIA;
    vy *= LANZA.VEL_FACTOR * LANZA.VEL_TRAYECTORIA;
    gravedad *= LANZA.VEL_FACTOR * LANZA.VEL_FACTOR;

    // RECORTE DE ÁPICE: si sube (vy<0), limita la velocidad para que el punto más
    // alto quede al menos APEX_MARGEN px bajo el techo → el arco sube y baja DENTRO
    // de la pantalla (no se va por arriba). Con la gravedad reducida del grande
    // (v/3, g/9) el ápice se conserva, así que el recorte sirve para ambos.
    if (vy < 0) {
      const subidaMax = y - LANZA.APEX_MARGEN; // px que puede subir sin cruzar el techo
      if (subidaMax <= 0) {
        vy = 0;
      } else {
        const vyMax = Math.sqrt(2 * gravedad * subidaMax);
        if (-vy > vyMax) vy = -vyMax;
      }
    }

    // celdas: retícula cols×filas de cubos de 8px (idx = fila*cols + col). El cubo
    // de 8px es la UNIDAD ATÓMICA: todo target se compone de estos cubos, nunca
    // de uno mayor. El target grande = MÁS cubos (grilla mayor), no cubos grandes.
    // Los ojos son dos cubos interiores (si mueren, ese ojo desaparece).
    const total = cols * filas;
    const celdas = [];
    for (let i = 0; i < total; i++) celdas.push(true);
    const oy = Math.floor(filas * 0.35);
    const ojos = [oy * cols + Math.floor(cols * 0.3), oy * cols + Math.floor(cols * 0.7)];
    return {
      x: x, y: y, vx: vx * LANZA.FUERZA, vy: vy * LANZA.FUERZA,
      rot: 0, velRot: rango(LANZA.VEL_ROT),
      radio: FISICA.RADIO_TARGET, gravedad: gravedad,
      celdas: celdas, cols: cols, filas: filas, vivos: total, vivosMax: total,
      // Masa PROPORCIONAL a la cantidad de cubos (ref: 20 = target normal → 1×).
      // El target grande (80 cubos) pesa 4× → la hitball rebota más y lo empuja menos.
      ojos: ojos, masa: FISICA.MASA_TARGET * total / 20, golpeado: false,
      haEntrado: false, edad: 0, viva: true, origen: origen,
    };
  }

  // Integra un paso de dt ms EN SUBPASOS: divide dt en n subpasos tales que
  // el objeto no se desplace más de MAX_PASO_PX por subpaso (fin del túnel).
  // onPaso() se llama tras CADA subpaso (las bolitas prueban colisión ahí).
  // objeto: {x, y, vx, vy, edad, viva} y opcional {rot, velRot, radio,
  // haEntrado, gravedad}. Fuente ÚNICA de física para bolitas y targets.
  function paso(o, dt, limites, onPaso) {
    const speed = Math.hypot(o.vx, o.vy);
    const n = Math.max(1, Math.ceil((speed * dt) / FISICA.MAX_PASO_PX));
    const sub = dt / n;
    // Gravedad por objeto: bolitas GRAVEDAD (validada); targets G_TARGET (luna).
    const g = o.gravedad || FISICA.GRAVEDAD;
    const r = o.radio || FISICA.RADIO_BOLITA;
    for (let i = 0; i < n; i++) {
      o.vy += g * sub;
      if (o.vy > FISICA.VEL_CAIDA_MAX) o.vy = FISICA.VEL_CAIDA_MAX;
      o.x += o.vx * sub;
      o.y += o.vy * sub;
      if (o.velRot) o.rot += o.velRot * sub; // giro constante (targets)
      o.edad += sub;

      // haEntrado: los targets nacen fuera; no son matables hasta entrar una
      // vez (las bolitas nacen dentro → entran en su primer subpaso).
      if (o.x >= 0 && o.x <= limites.w && o.y >= 0 && o.y <= limites.h) {
        o.haEntrado = true;
      }
      if (onPaso) onPaso(); // colisión probada en CADA subpaso

      // MUNDO SIN PAREDES: todo (bolitas y targets) muere al salir del viewport
      // una vez que entró (los targets nacen fuera; haEntrado los protege en su
      // primer cuadro). Sin rebote de paredes. Válvula de vida por si algo flota.
      // TODO LO QUE SUBE, BAJA: un TARGET que sale por ARRIBA no muere — la
      // gravedad lo hará caer de vuelta a la pantalla, siempre que su x siga sobre
      // ella. Muere si sale por los LADOS o por ABAJO (su caída ya no pasará por
      // la pantalla). Las bolitas (sin celdas, transitorias) mueren al salir por
      // cualquier borde. Vida máx por objeto (o.vidaMax) como válvula.
      const fueraLados = o.x < -r || o.x > limites.w + r;
      const fueraAbajo = o.y > limites.h + r;
      const fueraArriba = o.y < -r;
      const esTarget = !!o.celdas;
      const fuera = fueraLados || fueraAbajo || (!esTarget && fueraArriba);
      if (o.edad >= (o.vidaMax || FISICA.VIDA_MAX_MS) || (o.haEntrado && fuera)) {
        o.viva = false;
        break;
      }
    }
    return o;
  }

  // ── Modelo de cubos del target (retícula cols×filas de cubos de 8px) ──
  // El cubo de 8px es la unidad atómica; la grilla puede ser 5×4 (normal) o mayor
  // (target grande = MÁS cubos). Centro local del cubo idx en una grilla cols×filas.
  function celdaLocal(idx, cols, filas) {
    cols = cols || 5;
    filas = filas || 4;
    const c = idx % cols;
    const f = (idx / cols) | 0;
    return { x: c * 8 - cols * 4 + 4, y: f * 8 - filas * 4 + 4 }; // centro del cubo 8px
  }

  function celdaMundo(t, idx) {
    const l = celdaLocal(idx, t.cols, t.filas);
    const cw = Math.cos(t.rot);
    const sw = Math.sin(t.rot);
    return { x: t.x + l.x * cw - l.y * sw, y: t.y + l.x * sw + l.y * cw };
  }

  function cubosVivosMundo(t) {
    const out = [];
    for (let i = 0; i < t.celdas.length; i++) if (t.celdas[i]) out.push(celdaMundo(t, i));
    return out;
  }

  // HITSCAN (mira de desktop): índice de la celda VIVA que contiene el punto de
  // mundo (px,py), o -1. Lleva el punto al espacio LOCAL (rotación inversa) y ve
  // en qué celda 8×8 de la retícula cols×filas cae.
  function celdaEnPunto(t, px, py) {
    const cols = t.cols || 5, filas = t.filas || 4;
    const dx = px - t.x, dy = py - t.y;
    const c = Math.cos(-t.rot), s = Math.sin(-t.rot);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    const col = Math.floor((lx + cols * 4) / 8);
    const fil = Math.floor((ly + filas * 4) / 8);
    if (col < 0 || col >= cols || fil < 0 || fil >= filas) return -1;
    const idx = fil * cols + col;
    return t.celdas[idx] ? idx : -1;
  }

  // Caja de colisión LOCAL = bounding box de las celdas vivas (mordido = más
  // chico = más difícil de acertar). {cx,cy} = centro, {hw,hh} = medios ejes.
  function cajaLocal(t) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < t.celdas.length; i++) {
      if (!t.celdas[i]) continue;
      const l = celdaLocal(i, t.cols, t.filas);
      if (l.x - 4 < minX) minX = l.x - 4;
      if (l.x + 4 > maxX) maxX = l.x + 4;
      if (l.y - 4 < minY) minY = l.y - 4;
      if (l.y + 4 > maxY) maxY = l.y + 4;
    }
    if (minX > maxX) return null;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, hw: (maxX - minX) / 2, hh: (maxY - minY) / 2 };
  }

  // Índices de las n celdas vivas más cercanas al punto de mundo (px,py).
  function celdasCercanas(t, px, py, n) {
    const arr = [];
    for (let i = 0; i < t.celdas.length; i++) {
      if (!t.celdas[i]) continue;
      const w = celdaMundo(t, i);
      arr.push({ i: i, d: Math.hypot(w.x - px, w.y - py) });
    }
    arr.sort(function (a, b) { return a.d - b.d; });
    return arr.slice(0, n).map(function (o) { return o.i; });
  }

  // Colisión círculo–rectángulo ROTADO contra la CAJA DE CELDAS VIVAS.
  // Transforma el centro de la bolita al espacio local (rotación −rot),
  // prueba círculo vs rect eje-alineado (centrado en la caja de celdas vivas),
  // y devuelve normal y punto de contacto en mundo (rotación +rot).
  function colisionCirculoRect(bolita, t) {
    // t.caja: caja fija en espacio local si el target la define; si no, el
    // bounding box de las celdas vivas (todos los targets del juego actual).
    const caja = t.caja || cajaLocal(t);
    if (!caja) return null;
    const R = bolita.radio || FISICA.RADIO_BOLITA; // radio de la hitball
    const dx = bolita.x - t.x;
    const dy = bolita.y - t.y;
    const c = Math.cos(-t.rot);
    const s = Math.sin(-t.rot);
    const lx = (dx * c - dy * s) - caja.cx; // relativo al centro de la caja
    const ly = (dx * s + dy * c) - caja.cy;
    const clx = Math.max(-caja.hw, Math.min(caja.hw, lx));
    const cly = Math.max(-caja.hh, Math.min(caja.hh, ly));
    let nlx = lx - clx;
    let nly = ly - cly;
    let dist = Math.hypot(nlx, nly);
    if (dist > R) return null;
    if (dist < 1e-6) {
      const penX = caja.hw - Math.abs(lx);
      const penY = caja.hh - Math.abs(ly);
      if (penX < penY) { nlx = lx < 0 ? -1 : 1; nly = 0; }
      else { nlx = 0; nly = ly < 0 ? -1 : 1; }
    } else {
      nlx /= dist; nly /= dist;
    }
    const cw = Math.cos(t.rot);
    const sw = Math.sin(t.rot);
    const lpx = clx + caja.cx;
    const lpy = cly + caja.cy;
    return {
      nx: nlx * cw - nly * sw,
      ny: nlx * sw + nly * cw,
      pen: R - dist,
      px: t.x + (lpx * cw - lpy * sw),
      py: t.y + (lpx * sw + lpy * cw),
    };
  }

  // Colisión 1D con restitución sobre la normal (transferencia de momento).
  // La bolita rebota; el target recibe empuje. Usa la masa ACTUAL del target.
  function transferirMomento(bolita, t, nx, ny, vn) {
    const e = FISICA.RESTITUCION_GOLPE;
    const m = FISICA.MASA_HITBALL; // masa de la hitball (FASE 23: 1 → 1.1)
    const M = t.masa;
    const u1 = vn;
    const u2 = t.vx * nx + t.vy * ny;
    const v1 = (m * u1 + M * u2 + M * e * (u2 - u1)) / (m + M);
    const v2 = (m * u1 + M * u2 + m * e * (u1 - u2)) / (m + M);
    bolita.vx += (v1 - u1) * nx;
    bolita.vy += (v1 - u1) * ny;
    t.vx += (v2 - u2) * nx;
    t.vy += (v2 - u2) * ny;
  }

  // Resuelve el impacto de una hitball contra un target. Muta ambos y la
  // máscara de celdas. La hitball SIGUE VIVA (su vida/muerte no cambian).
  // → null si no hay golpe, o:
  //   {tipo, px, py, nx, ny, vImpact, cubosLiberados:[{x,y}], destruidos, muerto}
  //   tipo: 'destruido' | 'mordido' | 'empuje'
  function resolverImpacto(bolita, t) {
    const col = colisionCirculoRect(bolita, t);
    if (!col) return null;
    const nx = col.nx;
    const ny = col.ny;
    bolita.x += nx * col.pen; // saca la bolita de la penetración
    bolita.y += ny * col.pen;

    const vn = bolita.vx * nx + bolita.vy * ny; // <0 = entrando
    if (vn > 0) return null;
    const vImpact = -vn;
    const base = { px: col.px, py: col.py, nx: nx, ny: ny, vImpact: vImpact };

    // PODER de destrucción escalado por el radio: poder = vImpact · radio/14.
    // Un radio menor reduce el poder proporcionalmente (poder = vImpact·R/14).
    const R = bolita.radio || FISICA.RADIO_BOLITA;
    const poder = vImpact * (R / FISICA.RADIO_BOLITA);

    if (poder >= FISICA.UMBRAL_DESTRUCCION && !t.grande) {
      // Golpe fuerte: destrucción total. NUNCA para el target grande (es más
      // pesado y la hitball es chica → se demuele por zonas, mín. 4 golpes).
      // Rebote con restitución y frenado por la masa: conserva M/(mb+M). La restitución
      // (0.3) NO cambia; sólo la masa de la hitball mb (FASE 23: 1 → MASA_HITBALL).
      const e = FISICA.RESTITUCION_GOLPE;
      bolita.vx -= (1 + e) * vn * nx;
      bolita.vy -= (1 + e) * vn * ny;
      const drag = t.masa / (FISICA.MASA_HITBALL + t.masa);
      bolita.vx *= drag;
      bolita.vy *= drag;
      const libres = cubosVivosMundo(t);
      for (let i = 0; i < t.celdas.length; i++) t.celdas[i] = false;
      t.vivos = 0;
      return Object.assign(base, { tipo: 'destruido', cubosLiberados: libres, destruidos: libres.length, muerto: true });
    }

    // Empuje siempre (transferencia de momento con la masa actual). La física
    // del rebote/empuje NO cambia; sólo se añade que SIEMPRE hay daño.
    transferirMomento(bolita, t, nx, ny, vn);
    t.golpeado = true;

    // Daño por ZONA alrededor del impacto. Target normal: 1 (toque mínimo) → 8
    // (justo bajo umbral), según el poder. Target GRANDE: cada golpe demuele su
    // zona = ¼ de sus cubos (ceil(vivosMax/4)) → destruirlo exige MÍN. 4 golpes.
    let n;
    if (t.grande) {
      n = Math.ceil(t.vivosMax / 4);
    } else {
      const rango01 = Math.min(1, poder / FISICA.UMBRAL_DESTRUCCION);
      n = Math.round(1 + rango01 * (FISICA.DANO_CUBOS_MAX - 1));
    }
    n = Math.max(1, Math.min(n, t.vivos));
    const arrancadas = celdasCercanas(t, col.px, col.py, n);
    const libres = arrancadas.map(function (i) { return celdaMundo(t, i); });
    for (let k = 0; k < arrancadas.length; k++) t.celdas[arrancadas[k]] = false;
    t.vivos -= arrancadas.length;
    // Masa ∝ cubos vivos (ref 20) × pesoExtra (el grande es MUCHO más pesado →
    // el impacto casi no lo desvía; se siente pesado, no como globo).
    t.masa = FISICA.MASA_TARGET * (t.vivos / 20) * (t.pesoExtra || 1);

    let muerto = false;
    if (t.vivos <= FISICA.DESMORONA_CUBOS) {
      // Desmoronamiento: los cubos restantes también explotan.
      const resto = cubosVivosMundo(t);
      for (let j = 0; j < resto.length; j++) libres.push(resto[j]);
      for (let i = 0; i < t.celdas.length; i++) t.celdas[i] = false;
      t.vivos = 0;
      muerto = true;
    }
    return Object.assign(base, { tipo: 'mordido', cubosLiberados: libres, destruidos: libres.length, muerto: muerto });
  }

  // ── FRAGMENTOS DESPRENDIBLES (FASE 23 commit B) ───────────────────────────
  // Tras un golpe que destruye celdas, un target puede quedar en VARIOS trozos
  // sin puente entre sí. Los trozos sueltos se desprenden como targets propios.
  //
  // CRITERIO DE VECINDAD: 4-vecinos (von Neumann) — dos cubos están conectados
  // SÓLO si comparten un LADO (arriba/abajo/izq/der), NUNCA por una esquina.
  // Es el criterio físico correcto: los cubos se dibujan como cuadrados que se
  // tocan por sus CARAS; dos que apenas se rozan en diagonal no comparten borde
  // y, perdido el puente, se separan. (8-vecinos mantendría pegado un trozo que
  // sólo cuelga de una esquina — visualmente colgaría en el aire; se descarta.)
  // Flood-fill iterativo (pila propia, sin recursión) sobre las celdas vivas.
  function gruposConectados(celdas, cols, filas) {
    const visto = new Array(celdas.length);
    const grupos = [];
    for (let s = 0; s < celdas.length; s++) {
      if (!celdas[s] || visto[s]) continue;
      const grupo = [];
      const pila = [s];
      visto[s] = true;
      while (pila.length) {
        const i = pila.pop();
        grupo.push(i);
        const c = i % cols, f = (i / cols) | 0;
        if (c > 0 && celdas[i - 1] && !visto[i - 1]) { visto[i - 1] = true; pila.push(i - 1); }
        if (c < cols - 1 && celdas[i + 1] && !visto[i + 1]) { visto[i + 1] = true; pila.push(i + 1); }
        if (f > 0 && celdas[i - cols] && !visto[i - cols]) { visto[i - cols] = true; pila.push(i - cols); }
        if (f < filas - 1 && celdas[i + cols] && !visto[i + cols]) { visto[i + cols] = true; pila.push(i + cols); }
      }
      grupos.push(grupo);
    }
    return grupos;
  }

  // Giro propio de una isla al partirse: rango ancho (±0.06 rad/ms, 20× el del
  // target entero) para que cada trozo gire distinto y NO se lea como un cuerpo
  // único. Se sortea con el mismo helper rango() que usa crearTarget para velRot.
  const VEL_ROT_ISLA = [-0.06, 0.06];

  // partirTarget(t, px, py, vImpact, impulsoFactor): se llama SÓLO tras un golpe
  // que destruyó celdas (NUNCA por cuadro). Si el target sigue de una pieza (0 ó 1
  // grupo) → null y no toca nada. Si quedó en varios trozos, TODAS las islas
  // (incluida la mayor) se comportan como pedazos sueltos que caen y se separan:
  //   · el MAYOR conserva la IDENTIDAD (este mismo objeto t y sus flags rojo/
  //     grande/pesoExtra) → se le recortan las celdas, PERO al partirse deja de
  //     flotar (gravedad → G_TARGET), gira propio y recibe su propio empujón.
  //   · cada OTRO trozo se DESPRENDE como target independiente golpeable, con
  //     gravedad de target normal, giro propio y su propio empujón.
  // GRAVEDAD (1.1): al partirse ninguna isla hereda la gravedad del padre (Big
  // Claude flota con g/9); todas pasan a FISICA.G_TARGET → caen de verdad.
  // GIRO (1.2): cada isla recibe velRot NUEVA y aleatoria (VEL_ROT_ISLA), no la
  // del padre.
  // EMPUJÓN COMPLETO SIN REPARTIR (1.3): el golpe imparte a CADA isla el empuje
  // ENTERO |vImpact|·impulsoFactor (no se divide entre el nº de trozos), en
  // dirección RADIAL desde el punto de impacto (px,py) hacia el centroide de esa
  // isla. El grupo mayor también recibe el suyo (con su propio centroide).
  // Los fragmentos son targets NORMALES (no rojo, no grande): puntúan igual (por
  // cubo × multiplicador), caen con gravedad, mueren al salir y pueden re-partirse.
  // PURO: muta t.celdas/t.vivos/t.masa/t.vx/t.vy/t.gravedad/t.velRot y devuelve los
  // objetos fragmento (el llamador los inserta y aplica el tope de targets vivos).
  function partirTarget(t, px, py, vImpact, impulsoFactor) {
    const grupos = gruposConectados(t.celdas, t.cols, t.filas);
    if (grupos.length <= 1) return null;
    let mayor = 0;
    for (let g = 1; g < grupos.length; g++) if (grupos[g].length > grupos[mayor].length) mayor = g;
    const otros = [];
    for (let g = 0; g < grupos.length; g++) if (g !== mayor) otros.push(grupos[g]);
    // Empuje ENTERO (no se reparte): igual para cada isla, para el mismo vImpact.
    const empuje = Math.abs(vImpact || 0) * (impulsoFactor || 0);
    // Empujón radial desde el impacto hacia el centroide de un grupo de celdas.
    // Degenerado (impacto justo en el centroide) → empuja hacia arriba.
    function empujeIsla(idxs) {
      let cxm = 0, cym = 0;
      for (let k = 0; k < idxs.length; k++) { const w = celdaMundo(t, idxs[k]); cxm += w.x; cym += w.y; }
      cxm /= idxs.length; cym /= idxs.length;
      let dx = cxm - px, dy = cym - py, d = Math.hypot(dx, dy);
      if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
      return { vx: (dx / d) * empuje, vy: (dy / d) * empuje };
    }
    const fragmentos = [];
    for (let g = 0; g < otros.length; g++) {
      const idxs = otros[g];
      const total = t.celdas.length;
      const celdas = new Array(total);
      for (let i = 0; i < total; i++) celdas[i] = false;
      for (let k = 0; k < idxs.length; k++) celdas[idxs[k]] = true;
      const vivos = idxs.length;
      const kick = empujeIsla(idxs);
      const ojos = (t.ojos || []).filter(function (oi) { return celdas[oi]; });
      fragmentos.push({
        x: t.x, y: t.y, rot: t.rot, velRot: rango(VEL_ROT_ISLA),
        vx: t.vx + kick.vx,
        vy: t.vy + kick.vy,
        radio: t.radio || FISICA.RADIO_TARGET,
        gravedad: FISICA.G_TARGET,
        celdas: celdas, cols: t.cols, filas: t.filas,
        vivos: vivos, vivosMax: vivos, ojos: ojos,
        masa: FISICA.MASA_TARGET * (vivos / 20),
        golpeado: true, haEntrado: true, edad: t.edad || 0, viva: true,
        origen: t.origen, fragmento: true,
      });
    }
    // Grupo MAYOR: conserva el objeto original (identidad y flags), pero AL PARTIRSE
    // cae de verdad (gravedad G_TARGET), gira propio y recibe su propio empujón radial.
    const idxMayor = grupos[mayor];
    const kickMayor = empujeIsla(idxMayor);
    const nuevas = new Array(t.celdas.length);
    for (let i = 0; i < nuevas.length; i++) nuevas[i] = false;
    for (let k = 0; k < idxMayor.length; k++) nuevas[idxMayor[k]] = true;
    t.celdas = nuevas;
    t.vivos = idxMayor.length;
    t.masa = FISICA.MASA_TARGET * (t.vivos / 20) * (t.pesoExtra || 1);
    t.gravedad = FISICA.G_TARGET;
    t.velRot = rango(VEL_ROT_ISLA);
    t.vx += kickMayor.vx;
    t.vy += kickMayor.vy;
    return fragmentos;
  }

  const Fisica = {
    FISICA: FISICA,
    LANZA: LANZA,
    crearDisparo: crearDisparo,
    crearTarget: crearTarget,
    paso: paso,
    largoTrazo: largoTrazo,
    colisionCirculoRect: colisionCirculoRect,
    resolverImpacto: resolverImpacto,
    cajaLocal: cajaLocal,
    celdaLocal: celdaLocal,
    celdaMundo: celdaMundo,
    cubosVivosMundo: cubosVivosMundo,
    celdaEnPunto: celdaEnPunto,
    celdasCercanas: celdasCercanas,
    gruposConectados: gruposConectados,
    partirTarget: partirTarget,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fisica;
  } else {
    global.Fisica = Fisica;
  }
})(typeof window !== 'undefined' ? window : globalThis);
