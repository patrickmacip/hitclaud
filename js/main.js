// hitclaud — main.js
// Shell + input táctil + vuelo de bolitas y targets en canvas.
// La física vive en fisica.js (módulo puro); aquí solo captura y pintura.
// Los targets son LANZADOS (spawner, tope 3). SIN colisión con las bolitas:
// se atraviesan (la colisión es la fase 3b).
// Todo se dibuja en canvas dentro de un solo rAF — cero layout thrashing.

(function () {
  'use strict';

  const canvas = document.getElementById('juego');
  const ctx = canvas.getContext('2d');
  const F = window.Fisica;
  const P = window.Puntuacion;

  const tokens = getComputedStyle(document.documentElement);
  const COLOR = {
    coral: tokens.getPropertyValue('--coral').trim(),
    coralVivo: tokens.getPropertyValue('--coral-vivo').trim(),
    crema: tokens.getPropertyValue('--crema').trim(),
    negro: tokens.getPropertyValue('--negro').trim(),
    indigo: tokens.getPropertyValue('--indigo').trim(),
    indigoVivo: tokens.getPropertyValue('--indigo-vivo').trim(),
    fuente: tokens.getPropertyValue('--fuente').trim(),
  };

  // Marcador (puntuación por demolición) + su celda en la barra superior.
  const marcador = P.crearMarcador();
  const ritmo = P.crearRitmo();
  const elActual = document.querySelector('.marcador--actual .valor');
  function actualizarMarcador() { elActual.textContent = marcador.puntos; }

  // Retardo del próximo spawn: rango vigente (escala con el score; base en
  // respiro) sorteado → tiempos variables. Hueco máx absoluto = 1200ms (base).
  function retardoSpawn(ahora) {
    const rg = P.rangoVigente(ritmo, marcador.puntos, ahora);
    return rnd(rg.min, rg.max);
  }

  // Números flotantes de feedback (animación pura, en canvas).
  const flotantes = [];
  const FLOTANTE_VIDA = 700;   // ms del +N en el punto de impacto
  const FLOTANTE_BONO_VIDA = 900;
  function flotante(x, y, texto) {
    flotantes.push({ x: x, y: y, texto: texto, edad: 0, vida: FLOTANTE_VIDA, grande: false });
  }
  function flotanteBono(bono) {
    flotantes.push({ x: W / 2, y: H * 0.42, texto: '+' + bono, edad: 0, vida: FLOTANTE_BONO_VIDA, grande: true });
  }

  // ── Constantes de input ────────────────────────────────────────────
  const RADIO_HITMAKER = 203; // hit-test RADIAL desde la esquina inf-der (+40%)
  const RADIO_NUCLEO = 60;    // soltar de vuelta aquí = cancelar
  const UMBRAL_PX = 14;       // trazo menor = ignorar
  const UMBRAL_SUELTA = 0.15; // px/ms: soltar más lento = la bolita CAE
  // Frenos anti-paseo de la hitball agarrada (radio de agarre = 203px):
  const QUIETUD_VEL = 0.08;   // px/ms: por debajo cuenta como quieto
  const QUIETUD_MS = 250;     // ms continuos quieto → se suelta sola
  const CORREA_PX = 252;      // dist radial máx desde la esquina → se suelta sola (proporcional a 203)
  const CADENCIA_MS = 100;    // separación mínima entre SUELTAS (afinable)
  const MAX_BOLITAS = 24;     // tope de bolitas vivas simultáneas (rendimiento)
  const LAG_ESTELA = 3;       // muestreo hacia atrás por fantasma (×1,2,3)

  // ── Constantes del spawner de targets ──────────────────────────────
  // Tope 6 (sube de 3 para dar variedad sin tapizar). El retardo entre spawns
  // lo da el ritmo progresivo (puntuacion.js): escala con el score y usa el
  // rango base en respiro. Hueco máx absoluto = 1200ms (nunca pausa larga).
  const MAX_TARGETS = 6;      // tope de targets vivos

  // ── Constantes de la explosión de cubos (animación pura) ───────────
  const MAX_CUBOS = 120;      // tope de cubos vivos = 6 explosiones simultáneas
  const CUBO_VIDA_MIN = 800;  // ms de vida (se desvanecen)
  const CUBO_VIDA_MAX = 1200;
  const CUBO_FUERZA = 0.5;    // escala del impulso radial por rapidez de impacto
  const CUBO_JITTER = 0.12;   // px/ms de ruido aleatorio por cubo
  const SACUDIDA_AMP = 2;     // px de micro-sacudida de pantalla en destrucción
  const SACUDIDA_MS = 80;     // duración de la sacudida
  const DESTELLO_MS = 70;     // destello del target en CUALQUIER contacto (feedback)

  let W = 0;
  let H = 0;

  // Estado: MÚLTIPLES bolitas vivas. Cada una lleva SU propia estela.
  const gesto = { activo: false, puntos: [] };
  const bolitas = [];   // cada una: {x,y,vx,vy,edad,viva, historia:[]}
  let ultimoDisparo = -Infinity;
  let quietoDesde = 0;  // timestamp del último instante en que el dedo se movió
  // Targets lanzados (tope 3). SIN colisión con las bolitas: se atraviesan.
  const targets = [];
  let ultimoOrigen = null;    // ritmo: no dos seguidos del mismo origen
  let proximoSpawn = 0;       // timestamp mínimo del próximo lanzamiento
  // Cubos de explosión: animación PURA, sin colisión con nada.
  const cubos = [];
  let sacudidaHasta = 0;      // timestamp fin de la micro-sacudida de pantalla
  let rafId = null;
  let tPrev = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Anima una lista de cubos liberados (arrancados o de destrucción total).
  // Cada cubo: velocidad del target + impulso radial desde el impacto (mayor
  // cuanto más cerca) + jitter. Sistema ÚNICO: lo usan golpe suave y fuerte.
  function explotarCubos(centros, px, py, vImpact, tvx, tvy) {
    for (let k = 0; k < centros.length; k++) {
      const wc = centros[k];
      const dx = wc.x - px;
      const dy = wc.y - py;
      const d = Math.hypot(dx, dy);
      let dirx, diry;
      if (d > 0.001) { dirx = dx / d; diry = dy / d; }
      else { const a = rnd(0, Math.PI * 2); dirx = Math.cos(a); diry = Math.sin(a); }
      const mag = CUBO_FUERZA * vImpact * (0.4 + 1 / (1 + d / 12));
      cubos.push({
        x: wc.x, y: wc.y,
        vx: tvx + dirx * mag + rnd(-CUBO_JITTER, CUBO_JITTER),
        vy: tvy + diry * mag + rnd(-CUBO_JITTER, CUBO_JITTER),
        rot: rnd(0, Math.PI * 2), velRot: rnd(-0.01, 0.01),
        edad: 0, vida: rnd(CUBO_VIDA_MIN, CUBO_VIDA_MAX),
      });
    }
    while (cubos.length > MAX_CUBOS) cubos.shift(); // descarta los más viejos
  }

  // Lanza un target respetando el ritmo (origen distinto al anterior; como
  // 'superior' es un origen, "no dos seguidos" ya prohíbe dos superiores).
  function generarTarget() {
    let t;
    for (let i = 0; i < 12; i++) {
      t = F.crearTarget({ w: W, h: H });
      if (t.origen !== ultimoOrigen) break;
    }
    ultimoOrigen = t.origen;
    targets.push(t);
  }

  function reposo() {
    // Posición de descanso de la bolita, dentro del núcleo del hitmaker
    return { x: W - 52, y: H - 52 };
  }

  function distEsquina(x, y) {
    return Math.hypot(W - x, H - y);
  }

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujar();
  }

  // ── Input (pointer events) — un gesto (un dedo) a la vez ────────────
  canvas.addEventListener('pointerdown', function (e) {
    if (gesto.activo) return;
    if (distEsquina(e.clientX, e.clientY) > RADIO_HITMAKER) return;
    gesto.activo = true;
    gesto.puntos = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    quietoDesde = performance.now();
    canvas.setPointerCapture(e.pointerId);
    arrancarBucle();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!gesto.activo) return;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!gesto.activo) return;
    gesto.activo = false;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    ejecutarSuelta(gesto.puntos, false); // suelta normal: aplica umbral/cancelación
  });

  // Ejecuta la suelta desde la posición del dedo. forzar=true (frenos) siempre
  // dispara y respeta la velocidad de suelta real (tiro rápido = tiro real;
  // lento = cae). forzar=false (pointerup) aplica umbral y cancelación.
  function ejecutarSuelta(puntos, forzar) {
    const fin = puntos[puntos.length - 1];
    if (!forzar) {
      if (F.largoTrazo(puntos) < UMBRAL_PX) return;          // umbral
      if (distEsquina(fin.x, fin.y) <= RADIO_NUCLEO) return; // cancelación
      if (performance.now() - ultimoDisparo < CADENCIA_MS) return; // cadencia
    }
    if (bolitas.length >= MAX_BOLITAS) return;               // tope de rendimiento
    const disparo = F.crearDisparo(puntos);
    if (!disparo) return;
    // Dedo detenido (bajo umbral) = cae desde ahí (física honesta).
    const detenido = disparo.velSuelta < UMBRAL_SUELTA;
    bolitas.push({
      x: fin.x,
      y: fin.y,
      vx: detenido ? 0 : disparo.vx,
      vy: detenido ? 0 : disparo.vy,
      edad: 0,
      viva: true,
      tocado: false, // ¿tocó algún target? (para racha y fallo)
      historia: [],
    });
    ultimoDisparo = performance.now();
  }

  // Frenos anti-paseo: la hitball agarrada se suelta sola (cae o dispara según
  // su velocidad de suelta real). El gesto termina; el pointerup posterior se
  // ignora (gesto.activo ya es false). Sin animación nueva: simplemente cae.
  function soltarPorFreno() {
    if (!gesto.activo) return;
    gesto.activo = false;
    ejecutarSuelta(gesto.puntos, true);
  }

  // Velocidad reciente del dedo (px/ms). Sin eventos recientes = quieto.
  function velRecienteDedo(ahora) {
    const p = gesto.puntos;
    const ult = p[p.length - 1];
    if (ahora - ult.t > 60) return 0; // el dedo no genera eventos = detenido
    let i = p.length - 1;
    while (i > 0 && ult.t - p[i - 1].t <= 120) i--;
    const a = p[i];
    const dt = Math.max(ult.t - a.t, 1);
    return Math.hypot(ult.x - a.x, ult.y - a.y) / dt;
  }

  canvas.addEventListener('pointercancel', function () {
    gesto.activo = false;
  });

  // ── Bucle de animación ─────────────────────────────────────────────
  function arrancarBucle() {
    if (rafId === null) {
      tPrev = performance.now();
      rafId = requestAnimationFrame(cuadro);
    }
  }

  function cuadro(t) {
    const dt = Math.min(t - tPrev, 32); // techo: pestañas en segundo plano
    tPrev = t;

    // Frenos anti-paseo de la hitball agarrada.
    if (gesto.activo) {
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      if (distEsquina(dedo.x, dedo.y) > CORREA_PX) {
        soltarPorFreno();                         // correa de distancia
      } else {
        if (velRecienteDedo(t) >= QUIETUD_VEL) quietoDesde = t;
        if (t - quietoDesde >= QUIETUD_MS) soltarPorFreno(); // freno por quietud
      }
    }

    const limites = { w: W, h: H };
    // Targets: misma física (sub-paseada); al morir uno, programa el siguiente.
    for (let i = targets.length - 1; i >= 0; i--) {
      F.paso(targets[i], dt, limites);
      if (!targets[i].viva) {
        targets.splice(i, 1);
        proximoSpawn = Math.min(proximoSpawn, t + retardoSpawn(t)); // la muerte acelera el refill (nunca lo retrasa); hueco max = SPAWN_MAX
      }
    }

    // Prueba la colisión de UNA bolita contra todos los targets (llamado en
    // cada subpaso de paso() → sin túnel). Carambola: puede golpear varios.
    function colisionar(b) {
      for (let ti = targets.length - 1; ti >= 0; ti--) {
        const tg = targets[ti];
        const r = F.resolverImpacto(b, tg);
        if (!r) continue;
        tg.destelloHasta = t + DESTELLO_MS;    // destello en CUALQUIER contacto
        if (!b.tocado) {                       // primer toque de esta bolita = hit
          b.tocado = true;
          const bono = P.anotarHit(marcador);
          if (bono > 0) flotanteBono(bono);
          P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, t); // respiro al 10º hit en dif. máx
        }
        if (r.destruidos > 0) {                // 10 pts por cubo demolido
          const g = P.anotarDestruidos(marcador, r.destruidos);
          flotante(r.px, r.py, '+' + g);
        }
        if (r.cubosLiberados.length > 0) {
          explotarCubos(r.cubosLiberados, r.px, r.py, r.vImpact, tg.vx, tg.vy);
        }
        actualizarMarcador();
        if (r.muerto) {
          sacudidaHasta = t + SACUDIDA_MS;     // micro-sacudida solo en muerte
          targets.splice(ti, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoSpawn(t)); // la muerte acelera el refill (nunca lo retrasa); hueco max = SPAWN_MAX
        }
      }
    }

    // Avanza cada bolita en SUBPASOS, probando colisión en cada uno (fin del
    // túnel). No se retiran aún: la colisión debe verlas vivas (para el fallo).
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      F.paso(b, dt, limites, function () { colisionar(b); });
      b.historia.unshift({ x: b.x, y: b.y }); // estela propia (3 fantasmas)
      if (b.historia.length > LAG_ESTELA * 3 + 1) b.historia.pop();
    }
    // Retira las bolitas muertas: si no tocó nada = FALLO (−50, rompe racha).
    for (let i = bolitas.length - 1; i >= 0; i--) {
      if (!bolitas[i].viva) {
        if (!bolitas[i].tocado) { P.anotarFallo(marcador); actualizarMarcador(); }
        bolitas.splice(i, 1);
      }
    }
    // Flotantes de feedback: suben y se desvanecen.
    for (let i = flotantes.length - 1; i >= 0; i--) {
      flotantes[i].edad += dt;
      if (flotantes[i].edad >= flotantes[i].vida) flotantes.splice(i, 1);
    }
    // Cubos: gravedad de los targets, giro y desvanecimiento. Sin colisión.
    for (let i = cubos.length - 1; i >= 0; i--) {
      const q = cubos[i];
      q.vy += F.FISICA.G_TARGET * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.velRot * dt;
      q.edad += dt;
      if (q.edad >= q.vida) cubos.splice(i, 1);
    }
    if (targets.length < MAX_TARGETS && t >= proximoSpawn) {
      generarTarget();
      proximoSpawn = t + retardoSpawn(t);
    }
    dibujar();
    // El juego lanza targets de continuo → el bucle sigue vivo.
    rafId = requestAnimationFrame(cuadro);
  }

  // ── Pintura ────────────────────────────────────────────────────────
  function dibujar() {
    ctx.clearRect(0, 0, W, H);

    // Micro-sacudida de pantalla (solo en destrucción): desplaza todo el dibujo.
    let ox = 0;
    let oy = 0;
    const rem = sacudidaHasta - performance.now();
    if (rem > 0) {
      const p = rem / SACUDIDA_MS;
      ox = (Math.random() * 2 - 1) * SACUDIDA_AMP * p;
      oy = (Math.random() * 2 - 1) * SACUDIDA_AMP * p;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // Targets lanzados, rotados sobre su centro. SIN colisión con los cubos.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const destella = t.destelloHasta && performance.now() < t.destelloHasta;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      dibujarSpriteTarget(t, destella); // solo celdas vivas; destello = --crema
      ctx.restore();
    }
    // Cubos de explosión (animación pura).
    for (let i = 0; i < cubos.length; i++) {
      const q = cubos[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - q.edad / q.vida);
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.fillStyle = COLOR.coral;
      ctx.beginPath();
      ctx.roundRect(-4, -4, 8, 8, 1.5);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      dibujarEstela(b);
      dibujarBolita(b.x, b.y);
    }
    if (gesto.activo) {
      // La bolita AGARRADA sigue el dedo EXACTAMENTE (sin lag ni suavizado).
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      dibujarBolita(dedo.x, dedo.y);
    } else if (performance.now() - ultimoDisparo >= CADENCIA_MS) {
      // Bolita en reposo = señal de "listo": aparece al cumplirse la cadencia.
      const r = reposo();
      dibujarBolita(r.x, r.y);
    }

    // Números flotantes: +N en el impacto (sube y se desvanece); bonos de
    // racha más grandes en el centro. --coral-vivo.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR.coralVivo;
    for (let i = 0; i < flotantes.length; i++) {
      const fl = flotantes[i];
      const p = fl.edad / fl.vida;
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.font = (fl.grande ? '600 34px ' : '600 20px ') + COLOR.fuente;
      ctx.fillText(fl.texto, fl.x, fl.y - p * 30); // sube 30px en su vida
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // Estela propia de la bolita: 3 fantasmas al 30/20/10% de alfa.
  function dibujarEstela(b) {
    const alfas = [0.3, 0.2, 0.1];
    for (let i = 0; i < alfas.length; i++) {
      const p = b.historia[(i + 1) * LAG_ESTELA];
      if (!p) continue;
      ctx.globalAlpha = alfas[i];
      dibujarBolita(p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  // Sprite del target centrado en (0,0): retícula 5×4 de cubos de 8px en
  // --coral, dibujando SOLO las celdas vivas (t.celdas) → el boquete se ve.
  // Cubos esquineros con la esquina exterior a 4px; ojos (celdas 6 y 8) en
  // --negro, cada uno solo si su celda sigue viva.
  function dibujarSpriteTarget(t, destella) {
    const CUBO = 8;
    const COLS = 5;
    const FILAS = 4;
    const RADIO_ESQ = 4;
    const x = -20;
    const y = -16;
    ctx.fillStyle = destella ? COLOR.crema : COLOR.coral; // destello breve al contacto
    for (let f = 0; f < FILAS; f++) {
      for (let c = 0; c < COLS; c++) {
        if (!t.celdas[f * COLS + c]) continue; // celda muerta = boquete
        const cx = x + c * CUBO;
        const cy = y + f * CUBO;
        const radios = [
          f === 0 && c === 0 ? RADIO_ESQ : 0,
          f === 0 && c === COLS - 1 ? RADIO_ESQ : 0,
          f === FILAS - 1 && c === COLS - 1 ? RADIO_ESQ : 0,
          f === FILAS - 1 && c === 0 ? RADIO_ESQ : 0,
        ];
        ctx.beginPath();
        ctx.roundRect(cx, cy, CUBO, CUBO, radios);
        ctx.fill();
      }
    }
    // Ojos: celdas 6 (f1,c1) y 8 (f1,c3), cada una si sigue viva.
    ctx.fillStyle = COLOR.negro;
    if (t.celdas[6]) ctx.fillRect(x + 1 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
    if (t.celdas[8]) ctx.fillRect(x + 3 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
  }

  // Bolita: 28px --indigo con borde 3px --indigo-vivo.
  function dibujarBolita(cx, cy) {
    const RADIO = 14; // diámetro 28px
    ctx.beginPath();
    ctx.arc(cx, cy, RADIO - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.indigo;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLOR.indigoVivo;
    ctx.stroke();
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  arrancarBucle();       // el spawner de targets corre desde el arranque

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
