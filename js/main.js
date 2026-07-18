// hitclaud — main.js
// Shell + input táctil + bucle rAF + render en canvas.
// Física en fisica.js y reglas (puntuación, dificultad) en puntuacion.js (puros).
// Targets lanzados en flujo continuo (tope duro de rendimiento), con daño por
// celdas, explosión de cubos, castigo escalado, ritmo progresivo, enojado+debuff.
// Todo se dibuja en canvas dentro de un solo rAF — cero layout thrashing.

(function () {
  'use strict';

  const canvas = document.getElementById('juego');
  const ctx = canvas.getContext('2d');
  const F = window.Fisica;
  const P = window.Puntuacion;
  const U = window.Util;

  // Lectura de tokens A PRUEBA DE FALLOS: si el CSS no está aplicado o el SW
  // sirvió un tokens.css viejo, el respaldo literal evita el '' que rompe el
  // canvas (fillStyle mudo / addColorStop que lanza). Respaldos = tokens.css.
  const tokens = getComputedStyle(document.documentElement);
  function tk(nombre, respaldo) { return U.leerToken(nombre, respaldo, tokens.getPropertyValue(nombre)); }
  const COLOR = {
    coral: tk('--coral', '#E8704E'),
    coralVivo: tk('--coral-vivo', '#FF8764'),
    crema: tk('--crema', '#FFD9CE'),
    negro: tk('--negro', '#000'),
    indigo: tk('--indigo', '#5C5CC8'),
    indigoVivo: tk('--indigo-vivo', '#7C7CFF'),
    morado: tk('--morado', '#8B5CF6'),
    textoApagado: tk('--texto-apagado', '#8989B1'),
    fuente: tk('--fuente', "'Inter', system-ui, -apple-system, sans-serif"),
  };

  // Marcador (puntuación por demolición) + su celda en la barra superior.
  const marcador = P.crearMarcador();
  const ritmo = P.crearRitmo();
  const elActual = document.querySelector('.marcador--actual .valor');
  function actualizarMarcador() { elActual.textContent = marcador.puntos; }

  // Récord = MÁXIMO HISTÓRICO EN VIVO (se actualiza en el cuadro en que se
  // supera, no al terminar). Persistente con throttle + flush. El "último
  // score" NO va en esta celda: es de la fase del ciclo de partida.
  const almacen = (function () { try { return window.localStorage; } catch (e) { return null; } })();
  const record = U.crearRecord(almacen, 'hitclaud.record', 500);
  const elRecord = document.querySelector('.marcador--record .valor');
  function actualizarRecord() { elRecord.textContent = record.valor; }

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
  // Flujo CONTINUO sin tope de diseño: se lanza en cuanto vence el retardo
  // (ritmo progresivo de puntuacion.js). Hueco máx absoluto = 1200ms. El
  // único límite es un tope DURO de rendimiento (válvula), no de diseño;
  // con la vida y salida naturales no debería alcanzarse.
  const MAX_TARGETS_DURO = 12; // válvula de rendimiento (no de diseño)

  // ── Enojado y debuff ───────────────────────────────────────────────
  const ENOJADO_BASE = 0.08;      // prob. base del spawn
  const ENOJADO_POR_EXTRA = 0.02; // +2% por cada target vivo por encima de 3
  const ENOJADO_TOPE = 0.25;      // tope de probabilidad
  const RADIO_NORMAL = 14;        // radio de la hitball
  const RADIO_DEBIL = 7;          // radio bajo debuff (mitad → poder mitad)
  const DEBUFF_MS = 5000;         // duración del debuff por tocar un enojado

  // ── Bonanza (target de la fiesta) ──────────────────────────────────
  const BONANZA_PROB = 0.03;      // 3% de los spawns (al azar, no por racha)
  const FIESTA_MS = 5000;         // duración de la fiesta
  const FIESTA_MAX = 16;          // tope de targets vivos durante la fiesta
  const FIESTA_RET_MIN = 80;      // ráfaga de spawn en fiesta (ms)
  const FIESTA_RET_MAX = 220;
  const FIESTA_FLASH_MS = 500;    // lavado suave de --crema al entrar

  // ── Inactividad ────────────────────────────────────────────────────
  const GRACIA_MS = 3000;         // 3s sin gestos antes de empezar a cobrar

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
  let ultimoEnojado = false;  // nunca dos enojados seguidos
  let ultimaBonanza = false;  // nunca dos bonanzas seguidas
  let debuffHasta = 0;        // timestamp fin del debuff (radio a la mitad)
  let fiestaHasta = 0;        // timestamp fin de la fiesta (tope y ritmo altos)
  let fiestaFlashHasta = 0;   // lavado suave al entrar a la fiesta
  let proximoSpawn = 0;       // timestamp mínimo del próximo lanzamiento
  // Cubos de explosión: animación PURA, sin colisión con nada.
  const cubos = [];
  let sacudidaHasta = 0;      // timestamp fin de la micro-sacudida de pantalla
  // Inactividad: cobra tras la gracia si el jugador no hace gestos.
  let ultimoGesto = 0;        // timestamp del último gesto (o reset por visibilidad)
  let segundosCobrados = 0;   // segundos ya cobrados desde ultimoGesto
  let cobrando = false;       // feedback: ¿se está cobrando ahora?
  let pausado = false;        // pausa manual (botón)
  let rafId = null;
  let tPrev = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Marca actividad: resetea el reloj de inactividad (cualquier gesto y el
  // retorno desde pantalla oculta). Sin cobro retroactivo.
  function marcarActividad() {
    ultimoGesto = performance.now();
    segundosCobrados = 0;
    cobrando = false;
  }

  // Anima una lista de cubos liberados (arrancados o de destrucción total).
  // Cada cubo: velocidad del target + impulso radial desde el impacto (mayor
  // cuanto más cerca) + jitter. Sistema ÚNICO: lo usan golpe suave y fuerte.
  function explotarCubos(centros, px, py, vImpact, tvx, tvy, color) {
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
        color: color || COLOR.coral,
      });
    }
    while (cubos.length > MAX_CUBOS) cubos.shift(); // descarta los más viejos
  }

  // Lanza un target respetando el ritmo (origen distinto al anterior).
  // BONANZA: 3% al azar, nunca dos seguidas, nunca si ya hay una viva, nunca en
  // fiesta. ENOJADO (si no es bonanza): 8% + 2%/vivo>3, tope 25%, nunca dos
  // seguidos, nunca en fiesta (la fiesta es alegría pura).
  function generarTarget(ahora) {
    let t;
    for (let i = 0; i < 12; i++) {
      t = F.crearTarget({ w: W, h: H });
      if (t.origen !== ultimoOrigen) break;
    }
    ultimoOrigen = t.origen;
    const enFiesta = ahora < fiestaHasta;
    const hayBonanza = targets.some(function (x) { return x.bonanza; });
    if (!enFiesta && !hayBonanza && !ultimaBonanza && Math.random() < BONANZA_PROB) {
      t.bonanza = true;
      t.enojado = false;
      ultimaBonanza = true;
      ultimoEnojado = false;
    } else {
      ultimaBonanza = false;
      const prob = Math.min(ENOJADO_TOPE, ENOJADO_BASE + ENOJADO_POR_EXTRA * Math.max(0, targets.length - 3));
      t.enojado = !enFiesta && !ultimoEnojado && Math.random() < prob;
      ultimoEnojado = t.enojado;
    }
    targets.push(t);
  }

  // Retardo del próximo spawn: en fiesta = ráfaga; si no, el ritmo del score.
  function retardoActual(ahora) {
    return ahora < fiestaHasta ? rnd(FIESTA_RET_MIN, FIESTA_RET_MAX) : retardoSpawn(ahora);
  }

  // Centros de mundo de los cubos vivos de un target (para explosión directa).
  function cubosMundo(tg) {
    const out = [];
    const cw = Math.cos(tg.rot);
    const sw = Math.sin(tg.rot);
    for (let i = 0; i < 20; i++) {
      if (!tg.celdas[i]) continue;
      const l = F.celdaLocal(i);
      out.push({ x: tg.x + l.x * cw - l.y * sw, y: tg.y + l.x * sw + l.y * cw });
    }
    return out;
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
    marcarActividad(); // el gesto resetea el reloj de inactividad
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
    marcarActividad(); // fin del gesto: reinicia la gracia
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

  // Botón de pausa: congela el juego (y el reloj de inactividad).
  const botonPausa = document.querySelector('.boton-pausa');
  if (botonPausa) botonPausa.addEventListener('click', function () {
    pausado = !pausado;
    if (!pausado) marcarActividad(); // al reanudar, gracia fresca (no cobra la pausa)
  });

  // FUNDACIONAL: "puedes bloquear sin temor a perder tu progreso". Al ocultarse
  // el documento (bloqueo, segundo plano, cambio de pestaña) el reloj no corre;
  // al volver, gracia fresca sin cobro retroactivo.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) record.flush(performance.now()); // guarda la marca al ocultarse
    else marcarActividad();
  });
  // pagehide: última oportunidad de guardar antes de cerrar/descargar.
  window.addEventListener('pagehide', function () { record.flush(performance.now()); });

  // ── Bucle de animación ─────────────────────────────────────────────
  function arrancarBucle() {
    if (rafId === null) {
      tPrev = performance.now();
      rafId = requestAnimationFrame(cuadro);
    }
  }

  // BLINDAJE: todo el cuerpo va en try/catch y el re-agendado del rAF vive en
  // el finally → una excepción degrada ESE cuadro, jamás mata el bucle (antes,
  // un throw en dibujar() saltaba el requestAnimationFrame y congelaba el juego).
  function cuadro(t) {
   try {
    const dt = Math.min(t - tPrev, 32); // techo: pestañas en segundo plano
    tPrev = t;

    // Pausado: congela toda actualización (física, spawn, colisión, cobro);
    // solo re-dibuja el estado y mantiene vivo el bucle (rAF en el finally).
    if (pausado) { cobrando = false; dibujar(); return; }

    // Costo de INACTIVIDAD: tras la gracia, cada segundo quieto cuesta el 25%
    // del castigo del tramo actual. El reloj NO corre si el documento está
    // oculto (ya gateado) ni mientras hay un gesto activo. Piso en 0.
    cobrando = false;
    if (!document.hidden && !gesto.activo) {
      const idle = t - ultimoGesto;
      if (idle > GRACIA_MS) {
        const debidos = Math.floor((idle - GRACIA_MS) / 1000);
        while (segundosCobrados < debidos) {
          P.anotarInactividadSegundo(marcador);
          segundosCobrados++;
        }
        if (debidos > 0) { cobrando = true; actualizarMarcador(); }
      }
    }

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
        proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t)); // la muerte acelera el refill (nunca lo retrasa); hueco max = SPAWN_MAX
      }
    }

    // Prueba la colisión de UNA bolita contra todos los targets (llamado en
    // cada subpaso de paso() → sin túnel). Carambola: puede golpear varios.
    function colisionar(b) {
      for (let ti = targets.length - 1; ti >= 0; ti--) {
        const tg = targets[ti];
        if (tg.bonanza) {
          // Bonanza: TODO O NADA. Cualquier contacto la activa (no se muerde).
          // No puntúa; el premio es la fiesta. El contacto es neutro (no fallo).
          if (!F.colisionCirculoRect(b, tg)) continue;
          fiestaHasta = t + FIESTA_MS;
          fiestaFlashHasta = t + FIESTA_FLASH_MS;
          b.neutro = true;
          explotarCubos(cubosMundo(tg), tg.x, tg.y, 1.0, tg.vx, tg.vy, COLOR.coral); // celebración
          sacudidaHasta = t + SACUDIDA_MS;
          targets.splice(ti, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t)); // arranca la ráfaga
          continue;
        }
        const r = F.resolverImpacto(b, tg);
        if (!r) continue;
        tg.destelloHasta = t + DESTELLO_MS;    // destello en CUALQUIER contacto
        if (tg.enojado) {
          // Enojado: CUALQUIER contacto activa el debuff. NO es hit, NO puntúa,
          // NO cuenta como fallo (neutro). Se muerde/destruye igual (visual).
          debuffHasta = t + DEBUFF_MS;
          b.neutro = true;
        } else {
          if (!b.tocado) {                     // primer toque de esta bolita = hit
            b.tocado = true;
            const bono = P.anotarHit(marcador);
            if (bono > 0) flotanteBono(bono);
            P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, t); // respiro al 10º hit en dif. máx
          }
          if (r.destruidos > 0) {              // 10 pts por cubo demolido
            const g = P.anotarDestruidos(marcador, r.destruidos);
            flotante(r.px, r.py, '+' + g);
          }
          actualizarMarcador();
        }
        if (r.cubosLiberados.length > 0) {
          explotarCubos(r.cubosLiberados, r.px, r.py, r.vImpact, tg.vx, tg.vy, tg.enojado ? COLOR.morado : COLOR.coral);
        }
        if (r.muerto) {
          sacudidaHasta = t + SACUDIDA_MS;     // micro-sacudida solo en muerte
          targets.splice(ti, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t)); // la muerte acelera el refill; hueco máx = 1200ms
        }
      }
    }

    // Avanza cada bolita en SUBPASOS, probando colisión en cada uno (fin del
    // túnel). No se retiran aún: la colisión debe verlas vivas (para el fallo).
    const debuffActivo = t < debuffHasta;
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      b.radio = debuffActivo ? RADIO_DEBIL : RADIO_NORMAL; // debuff afecta a TODAS
      F.paso(b, dt, limites, function () { colisionar(b); });
      b.historia.unshift({ x: b.x, y: b.y }); // estela propia (3 fantasmas)
      if (b.historia.length > LAG_ESTELA * 3 + 1) b.historia.pop();
    }
    // Retira las bolitas muertas: si no tocó nada (y no fue neutro por tocar un
    // enojado) = FALLO (castigo del tramo, rompe racha).
    for (let i = bolitas.length - 1; i >= 0; i--) {
      if (!bolitas[i].viva) {
        if (!bolitas[i].tocado && !bolitas[i].neutro) {
          P.anotarFallo(marcador, { debuff: t < debuffHasta }); // espiral: en debuff no escala
          actualizarMarcador();
        }
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
    // Flujo continuo: lanza en cuanto vence el retardo. En fiesta el tope sube
    // a 16; al terminar vuelve a 12 y los sobrantes mueren por su vuelo (no se
    // borran). Tope = válvula de rendimiento, no de diseño.
    const capActual = t < fiestaHasta ? FIESTA_MAX : MAX_TARGETS_DURO;
    if (targets.length < capActual && t >= proximoSpawn) {
      generarTarget(t);
      proximoSpawn = t + retardoActual(t);
    }
    // Récord EN VIVO: si el score superó el récord, sube ya (y escribe con throttle).
    if (record.considerar(marcador.puntos, t)) actualizarRecord();
    dibujar();
   } catch (e) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[hitclaud] error en un cuadro (degradado; el bucle sigue vivo):', e);
    }
   } finally {
    // Re-agendar SIEMPRE: un cuadro malo degrada ese cuadro, nunca el juego.
    rafId = requestAnimationFrame(cuadro);
   }
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
      // Halo pulsante de la Bonanza (se lee desde la periferia). Un arco con
      // glow por cuadro (a lo sumo 1 bonanza viva): costo despreciable.
      if (t.bonanza) {
        const now = performance.now();
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now / 200);
        ctx.strokeStyle = COLOR.crema;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLOR.crema;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 26 + 4 * Math.sin(now / 200), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
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
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.roundRect(-4, -4, 8, 8, 1.5);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const remDebuff = debuffHasta - performance.now();
    const debil = remDebuff > 0;                 // debuff activo → hitball chica
    const radioAhora = debil ? RADIO_DEBIL : RADIO_NORMAL;
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      const rB = b.radio || RADIO_NORMAL;
      dibujarEstela(b, rB);
      dibujarBolita(b.x, b.y, rB, rB < RADIO_NORMAL);
    }
    if (gesto.activo) {
      // La bolita AGARRADA sigue el dedo EXACTAMENTE (sin lag ni suavizado).
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      dibujarBolita(dedo.x, dedo.y, radioAhora, debil);
    } else if (performance.now() - ultimoDisparo >= CADENCIA_MS) {
      // Bolita en reposo = señal de "listo": aparece al cumplirse la cadencia.
      const r = reposo();
      dibujarBolita(r.x, r.y, radioAhora, debil);
    }

    // Indicador de debuff: barra en el BORDE SUPERIOR que se DESCARGA (se
    // encoge) con el tiempo restante. --morado RADIANTE: gradiente + glow por
    // shadowBlur (parpadeo por alfa) = electricidad. Barato: un fillRect con
    // sombra. Al vaciarse, el regreso al modo normal se ve entretenido.
    if (debil) {
      const w = W * (remDebuff / DEBUFF_MS);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, COLOR.morado);
      grad.addColorStop(1, COLOR.crema);
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(performance.now() / 90); // chispazo
      ctx.shadowColor = COLOR.morado;
      ctx.shadowBlur = 8;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 4);
      ctx.restore();
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

    // Amortiguador de caída: "cojín" de luz cálida (--coral-vivo) en el borde
    // inferior cuando el score está bajo el suelo (60% del pico). Alfa según la
    // profundidad → el jugador SIENTE que el fondo lo sostiene. Sin texto.
    const suelo = P.SUELO_PICO * marcador.pico;
    if (marcador.pico > 0 && marcador.puntos < suelo) {
      const prof = 1 - marcador.puntos / suelo; // 0 en el suelo → 1 en 0
      const alto = 90;
      const g = ctx.createLinearGradient(0, H, 0, H - alto);
      g.addColorStop(0, COLOR.coralVivo);
      g.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.12 * prof;
      ctx.fillStyle = g;
      ctx.fillRect(0, H - alto, W, alto);
      ctx.restore();
    }

    // Entrada a la fiesta: lavado suave de --crema que se desvanece (~500ms).
    // Sin pantallazos agresivos (juego desestresante). Un fillRect por cuadro.
    const flash = fiestaFlashHasta - performance.now();
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 * (flash / FIESTA_FLASH_MS);
      ctx.fillStyle = COLOR.crema;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Aviso sutil de inactividad (cobrando): puntos "· · ·" tenues y pulsantes
    // abajo-centro en --texto-apagado. Sin alarmas (juego desestresante).
    if (cobrando) {
      ctx.globalAlpha = 0.22 + 0.13 * Math.sin(performance.now() / 300);
      ctx.fillStyle = COLOR.textoApagado;
      ctx.font = '400 15px ' + COLOR.fuente;
      ctx.fillText('· · ·', W / 2, H - 64);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // Estela propia de la bolita: 3 fantasmas al 30/20/10% de alfa.
  function dibujarEstela(b, radio) {
    const alfas = [0.3, 0.2, 0.1];
    for (let i = 0; i < alfas.length; i++) {
      const p = b.historia[(i + 1) * LAG_ESTELA];
      if (!p) continue;
      ctx.globalAlpha = alfas[i];
      dibujarBolita(p.x, p.y, radio, radio < RADIO_NORMAL);
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
    // Color como SEÑAL: coral = normal, --morado = enojado (castigo). La
    // BONANZA es coral pero PARPADEA a --crema (identidad por LUZ, no color).
    // La cara es idéntica en todos. El destello de contacto pinta --crema.
    let col = t.enojado ? COLOR.morado : COLOR.coral;
    if (t.bonanza && Math.sin(performance.now() / 110) > 0) col = COLOR.crema;
    if (destella) col = COLOR.crema;
    ctx.fillStyle = col;
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
    // Ojos: celdas 6 (f1,c1) y 8 (f1,c3), cada una si sigue viva. Iguales en
    // normal y enojado (la señal es el COLOR, no la cara).
    ctx.fillStyle = COLOR.negro;
    if (t.celdas[6]) ctx.fillRect(x + 1 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
    if (t.celdas[8]) ctx.fillRect(x + 3 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
  }

  // Bolita: --indigo con borde --indigo-vivo. Bajo debuff se dibuja chica
  // (radio 7) y en --morado (idioma: morado = castigo).
  function dibujarBolita(cx, cy, radio, debil) {
    const RADIO = radio || 14;
    ctx.beginPath();
    ctx.arc(cx, cy, RADIO - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = debil ? COLOR.morado : COLOR.indigo;
    ctx.fill();
    ctx.lineWidth = debil ? 2 : 3;
    ctx.strokeStyle = debil ? COLOR.morado : COLOR.indigoVivo;
    ctx.stroke();
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  actualizarRecord();    // muestra el récord persistido (o 0)
  marcarActividad();     // inicia el reloj de inactividad (evita cobro al arrancar)
  arrancarBucle();       // el spawner de targets corre desde el arranque

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
