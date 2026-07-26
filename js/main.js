// hitclaud — main.js
// Shell + input táctil + bucle rAF + render en canvas.
// Física en fisica.js y reglas (puntuación, dificultad) en puntuacion.js (puros).
// Targets lanzados en flujo continuo (tope duro de rendimiento), con daño por
// celdas, explosión de cubos, castigo escalado, ritmo progresivo. Dos tipos de
// target: NARANJA (puntúa) y ROJO (parpadea y termina la partida).
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
    crema: tk('--crema', '#FFD9CE'),
    negro: tk('--negro', '#000'),
    cloudoverA: tk('--cloudover-a', '#B1003B'),
    cloudoverB: tk('--cloudover-b', '#FF0055'),
    textoApagado: tk('--texto-apagado', '#8989B1'),
    fuente: tk('--fuente', "'Inter', system-ui, -apple-system, sans-serif"),
  };

  // ACENTO ÚNICO (naranja): el juego quedó con dos tipos de target — NARANJA (el
  // que puntúa) y ROJO (parpadea y termina la partida). Sin power-ups, no hay más
  // "modos": la paleta es fija. base = cuerpo del target naranja / debris; vivo =
  // hitball, acentos, marcador; claro/profundo = jerarquía secundaria. Los tokens
  // CSS --acento* ya traen estos valores por defecto (tokens.css), así que la UI
  // en HTML no necesita que el JS los reescriba. El FONDO #121216 y la SUPERFICIE
  // #15151C nunca se tocan.
  const ACENTO = { base: '#E8704E', vivo: '#FF8764', claro: '#FFC9B8', profundo: '#A84A2E' };

  // Marcador (puntuación por demolición) + su celda en la barra superior.
  const marcador = P.crearMarcador();
  const ritmo = P.crearRitmo();
  const elActual = document.querySelector('.marcador--actual .valor');
  function actualizarMarcador() { elActual.textContent = U.abreviarNumero(marcador.puntos); }

  // Récord POR MODO: llaves separadas para 60 min y Relax mode. `record`
  // apunta al del modo ACTIVO; la celda "Record" muestra ese. Preferencias intactas.
  const almacen = (function () { try { return window.localStorage; } catch (e) { return null; } })();
  const record60 = U.crearRecord(almacen, 'hitclaud.record.v3.60', 500);
  const recordLibre = U.crearRecord(almacen, 'hitclaud.record.v3.libre', 500);
  let record = record60; // activo (se ajusta al elegir modo)
  const elRecord = document.querySelector('.marcador--record .valor');
  function actualizarRecord() { elRecord.textContent = U.abreviarNumero(record.valor); }

  // ── Modo de juego + ciclo de partida ───────────────────────────────
  // PANTALLA DE INICIO (overlay): elegís "60 min" o "Relax mode"; aparece al
  // cargar y al terminar una partida. En 60 min corre una cuenta regresiva y al
  // llegar a 0 termina la partida. En Relax mode, sólo termina al tocar un rojo.
  const elGameOver = document.getElementById('gameover');
  const DURACION_60 = 60 * 60 * 1000; // "60 min" = 60 minutos
  function reiniciarEstado() {
    marcador.puntos = 0; marcador.racha = 0;
    targets.length = 0; bolitas.length = 0; cubos.length = 0; flotantes.length = 0;
    ultimoDisparo = -Infinity; gesto.activo = false; marcadorPopHasta = 0;
    perdidaInicio = -Infinity; contadorRojoHasta = 0; montoPerdido = 0; montoInicio = -Infinity; montoHasta = 0;
    if (elActual) elActual.style.transform = 'scale(1)';
    const ahora = performance.now();
    caosSpawn.rafaga = 0;
    proximoSpawn = ahora;
    proximoGrande = ahora + GRANDE_MIN_MS;
    escalada = P.crearEscalada(ahora, Math.random); // reinicia el nivel de rojos a 1
    proximoRojo = ahora + P.intervaloRojo(escalada.nivel);
    actualizarMarcador();
    marcarActividad();
  }
  function iniciarPartida(modo) {
    modoJuego = modo;
    record = (modo === '60') ? record60 : recordLibre;
    actualizarRecord();
    reiniciarEstado();
    tiempoRestante = (modo === '60') ? DURACION_60 : 0;
    jugando = true;
    elGameOver.classList.add('oculto');
  }
  // Fin de partida (rojo tocado o se acabó el tiempo): congela, guarda la marca,
  // muestra el overlay con el score final + récord del modo y los botones de modo.
  function terminarPartida() {
    if (!jugando) return;
    jugando = false;
    record.flush(performance.now());
    const esRecord = marcador.puntos >= record.valor && marcador.puntos > 0;
    elGameOver.querySelector('.go-score').classList.remove('oculto');
    elGameOver.querySelector('.go-score .valor').textContent = U.abreviarNumero(marcador.puntos);
    elGameOver.querySelector('.go-record').classList.toggle('oculto', !esRecord);
    elGameOver.classList.remove('oculto');
  }
  // Pantalla de inicio al cargar (sin score todavía).
  function mostrarInicio() {
    jugando = false;
    elGameOver.querySelector('.go-score').classList.add('oculto');
    elGameOver.querySelector('.go-record').classList.add('oculto');
    elGameOver.classList.remove('oculto');
  }
  const btn60 = document.getElementById('jugar60');
  const btnLibre = document.getElementById('jugarLibre');
  if (btn60) btn60.addEventListener('click', function () { iniciarPartida('60'); });
  if (btnLibre) btnLibre.addEventListener('click', function () { iniciarPartida('libre'); });

  // Retardo del próximo spawn de NARANJAS: rango base por score (rangoVigente)
  // con caos superpuesto (ráfagas/pausas), recortado a ≤300ms (SPAWN_GAP_MAX): la
  // pantalla nunca queda más de 300ms sin aparición de un target (habiendo lugar).
  function retardoNaranja(ahora) {
    const base = P.rangoVigente(ritmo, marcador.puntos, ahora);
    return Math.min(SPAWN_GAP_MAX, P.retardoCaotico(base, caosSpawn, Math.random));
  }

  // Números flotantes de feedback (canvas puro): pop de escala + subida + fade.
  // AGREGACIÓN: un impacto = UN flotante con la suma. ANTI-SOLAPAMIENTO: si un
  // nuevo flotante nace cerca de otro del MISMO color, se FUSIONAN sumando (y
  // re-pop). Tope estricto MAX_FLOTANTES (retira el más viejo) + vida corta →
  // legible incluso en el peor caso (fiesta + power-up).
  const flotantes = [];
  const FLOTANTE_VIDA = 550;
  const MAX_FLOTANTES = 8;
  const FUSION_DIST = 40;
  function numDe(txt) {
    if (txt === '0') return 0;
    if (txt[0] === '+') return parseInt(txt.slice(1), 10);
    if (txt[0] === '−') return -parseInt(txt.slice(1), 10); // −
    return null;
  }
  function textoDe(n) { return n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0'; }
  function flotante(x, y, texto, color, tam, glow) {
    const n = numDe(texto);
    if (n !== null) {
      for (let i = flotantes.length - 1; i >= 0; i--) {
        const fl = flotantes[i];
        if (fl.color === color && Math.hypot(fl.x - x, fl.y - y) < FUSION_DIST) {
          const suma = numDe(fl.texto) + n;
          fl.texto = textoDe(suma);
          fl.tam = suma > 0 ? tamGanancia(suma) : Math.max(fl.tam, tam || 20);
          fl.glow = fl.glow || !!glow || suma >= 300;
          fl.edad = 0; // re-pop
          return;
        }
      }
    }
    flotantes.push({ x: x, y: y, texto: texto, edad: 0, vida: FLOTANTE_VIDA, color: color, tam: tam || 20, glow: !!glow });
    if (flotantes.length > MAX_FLOTANTES) flotantes.shift();
  }
  // Tamaño de fuente de una GANANCIA según su magnitud (20px chico → 44px enorme;
  // glow desde +300). A mayor ganancia, más grande y brillante.
  function tamGanancia(g) { return Math.min(44, 20 + g / 25); }
  // Latido del marcador Actual en ganancias fuertes (CSS transform).
  let marcadorPopHasta = 0;
  function popMarcador() { elActual.style.transform = 'scale(1.3)'; marcadorPopHasta = performance.now() + 180; }

  // ── Feedback de PÉRDIDA (bordes + contador rojo + monto agregado) ──────
  // Al RESTAR puntos: PALPITAN los dos bordes laterales en rojo, el contador se
  // tiñe de rojo y aparece el MONTO agregado bajo el marcador. Sin flotantes
  // regados. Cobros consecutivos RE-DISPARAN el pulso (reinician), no se apilan.
  const PULSO_ENTRADA = 100, PULSO_DISIP = 350;  // bordes: 100ms entra, 350ms disipa
  const CONTADOR_ROJO_MS = 400;                  // contador rojo tras restar
  const MONTO_MS = 600;                           // monto bajo el contador
  const FRANJA_PX = 28;                           // ancho de la franja de borde
  const ROJO_BORDE = '#FF0055', ROJO_CONTADOR = '#FF4583', ROJO_MONTO = '#FF6D9E';
  let perdidaInicio = -Infinity;   // inicio del pulso de bordes (envelope)
  let contadorRojoHasta = 0;       // fin del rojo del contador
  let montoPerdido = 0;            // monto agregado en la ventana viva
  let montoInicio = -Infinity;     // inicio del monto (palpitar)
  let montoHasta = 0;              // fin de la exhibición del monto
  function registrarPerdida(monto) {
    const now = performance.now();
    perdidaInicio = now;                                 // re-dispara (reinicia, no apila)
    contadorRojoHasta = now + CONTADOR_ROJO_MS;
    montoPerdido = (now < montoHasta) ? montoPerdido + monto : monto; // agrega si sigue viva
    montoInicio = now; montoHasta = now + MONTO_MS;      // palpitar reinicia
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

  // ── Constantes del spawner de targets (dos tipos: NARANJA y ROJO) ──
  // Spawn CAÓTICO: cantidad variable (ráfagas/pausas, retardoCaotico) desde los
  // 4 orígenes, con velocidad variable por target.
  const RADIO_NORMAL = 14;         // radio de la hitball
  // TOPE DURO: nunca más de 2 targets vivos en pantalla (naranjas + rojos + grande
  // JUNTOS). Si no hay lugar, el generador NO descarta el turno: espera con su
  // timer en el pasado y dispara en cuanto se libera (el ritmo se conserva).
  const MAX_EN_PANTALLA = 2;
  // TIEMPO MÁXIMO entre apariciones de naranjas: 300ms. La pantalla nunca queda
  // más de 300ms sin aparición de un target (cuando hay lugar). Las ráfagas cortas
  // se conservan; las pausas se recortan a 300.
  const SPAWN_GAP_MAX = 300;

  // ── ROJO (parpadea y termina la partida) ───────────────────────────
  // Sale como cualquier target (crearTarget: 4 orígenes, velocidad del rango).
  // Su CANTIDAD/FRECUENCIA escala con el nivel (P.escalada, sube cada 5–10s).
  const ROJO_PARPADEO_MS = 100; // parpadeo entre cloudover-a/b (loop)
  const ROJO_JITTER = [0.75, 1.25]; // ruido multiplicativo sobre el intervalo de aparición

  // ── GRANDE (doble de tamaño, 3× más lento) ─────────────────────────
  // Un target naranja EXTRA de DOBLE tamaño hecho con MÁS cubos de 8px (grilla
  // 10×8 = 80 cubos, el doble en cada eje del 5×4 normal). El cubo de 8px es la
  // unidad atómica: no se agranda el cubo, se agrega más. 3× más lento
  // (velocidad/3 + gravedad/9 → mismo arco, 3× de tiempo de vuelo). Puntúa por
  // cubo (80 × 5 = 400). Mínimo 8s entre apariciones; nunca dos a la vez.
  const GRANDE_COLS = 10;
  const GRANDE_FILAS = 8;
  const GRANDE_LENTO = 3;
  const GRANDE_PESO = 80;       // factor de masa extra: EXTREMADAMENTE pesado (el impacto casi no lo desvía)
  const GRANDE_MIN_MS = 8000;   // tiempo MÍNIMO entre apariciones
  const GRANDE_JITTER_MS = 4000; // variación extra (siempre ≥ mínimo)

  // ── Inactividad ────────────────────────────────────────────────────
  const GRACIA_MS = 3000;         // 3s sin gestos antes de empezar a cobrar

  // ── Constantes de la explosión de cubos (animación pura) ───────────
  // Los cubos caen hasta salir del viewport. Al llenarse el pool se reciclan los
  // MÁS VIEJOS (cubos.shift, ya saliendo), nunca los recién nacidos.
  const MAX_CUBOS = 240;
  const CUBO_FUERZA = 0.5;    // escala del impulso radial por rapidez de impacto
  const CUBO_JITTER = 0.12;   // px/ms de ruido aleatorio por cubo
  const SACUDIDA_AMP = 2;     // px de micro-sacudida de pantalla en destrucción
  const SACUDIDA_MS = 80;     // duración de la sacudida
  const DESTELLO_MS = 70;     // destello del target en CUALQUIER contacto (feedback)

  // ── Plataforma ─────────────────────────────────────────────────────
  // DESKTOP (puntero fino/mouse): mira que sigue al cursor + disparo HITSCAN
  // (impacto inmediato) de una hitball 4× más chica. MÓVIL (táctil): tiro por
  // arrastre, sin rebote en paredes.
  const esDesktop = (function () {
    try { return window.matchMedia && window.matchMedia('(pointer: fine)').matches; }
    catch (e) { return false; }
  })();
  const RADIO_MIRA = RADIO_NORMAL / 4; // hitball de desktop: 4× más chica (14 → 3.5)
  const DISPARO_MS = 130;              // duración del destello del tiro (hitscan)

  let W = 0;
  let H = 0;
  // Mira de desktop (posición del cursor) + destello breve de cada disparo.
  let miraX = -1, miraY = -1, miraActiva = false;
  const disparos = []; // {x, y, inicio} destello breve del hitscan

  // Estado: MÚLTIPLES bolitas vivas. Cada una lleva SU propia estela.
  const gesto = { activo: false, puntos: [] };
  const bolitas = [];   // cada una: {x,y,vx,vy,edad,viva, historia:[]}
  let ultimoDisparo = -Infinity;
  let quietoDesde = 0;  // timestamp del último instante en que el dedo se movió
  // Targets lanzados. SIN colisión con las bolitas: se atraviesan.
  const targets = [];
  const caosSpawn = P.crearCaos();  // estado de ráfagas del spawn caótico
  let escalada = null;              // nivel de rojos (P.crearEscalada; init abajo)
  let proximoRojo = 0;              // timestamp del próximo target rojo
  let proximoGrande = 0;            // timestamp del próximo target GRANDE
  let proximoSpawn = 0;             // timestamp mínimo del próximo naranja
  // Ciclo de partida: `jugando` false = overlay de inicio/fin arriba (congelado).
  let jugando = false;              // ¿hay una partida en curso?
  let modoJuego = null;             // '60' | 'libre'
  let tiempoRestante = 0;           // ms restantes (modo 60 min) — se decrementa con dt SOLO jugando
                                    // (así la pausa DETIENE el reloj de verdad; 0/N-A en Relax).
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
  function explotarCubos(centros, px, py, vImpact, tvx, tvy, color, tam) {
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
        color: color || ACENTO.base, tam: tam || 8, // respaldo: base naranja (nunca se alcanza; todos pasan color)
      });
    }
    while (cubos.length > MAX_CUBOS) cubos.shift(); // descarta los más viejos
  }

  // Lanza un target NARANJA (el que puntúa): crearTarget da el origen (uno de los
  // 4) y la velocidad variable. Sin variantes: los especiales se eliminaron.
  function generarNaranja() {
    targets.push(F.crearTarget({ w: W, h: H }));
  }

  // Lanza un target ROJO (parpadea, termina la partida). Sale como cualquier otro
  // (mismo crearTarget: 4 orígenes, velocidad del rango) — sólo marcado `rojo`.
  function generarRojo() {
    const t = F.crearTarget({ w: W, h: H });
    t.rojo = true;
    targets.push(t);
  }

  // Lanza un target GRANDE (naranja): grilla 10×8 de cubos de 8px (doble de
  // tamaño, MÁS cubos, no cubos más grandes) y 3× más lento — velocidad/3 +
  // gravedad/9 → mismo arco, 3× de tiempo de vuelo. MUY pesado: el impacto de la
  // hitball casi no lo desvía (se siente pesado, no como globo).
  function generarGrande() {
    const t = F.crearTarget({ w: W, h: H }, GRANDE_COLS, GRANDE_FILAS);
    t.grande = true;
    t.vx /= GRANDE_LENTO;
    t.vy /= GRANDE_LENTO;
    t.gravedad = F.FISICA.G_TARGET / (GRANDE_LENTO * GRANDE_LENTO); // g/9
    t.radio = Math.max(GRANDE_COLS, GRANDE_FILAS) * 4 + 12; // margen de salida ≈ media diagonal
    t.vidaMax = F.FISICA.VIDA_MAX_MS * GRANDE_LENTO; // vuela 3× más lento → vive 3× más
    t.pesoExtra = GRANDE_PESO;                       // masa ×80 → el impacto casi no lo desvía
    t.masa = F.FISICA.MASA_TARGET * (t.vivos / 20) * GRANDE_PESO;
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

  // ── Input ───────────────────────────────────────────────────────────
  // DESKTOP: la mira sigue al cursor; el clic dispara un HITSCAN (impacto
  // inmediato). MÓVIL: gesto de arrastre para lanzar la hitball (un dedo).
  canvas.addEventListener('pointerdown', function (e) {
    if (esDesktop) { dispararHitscan(e.clientX, e.clientY); return; }
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
    if (esDesktop) { miraX = e.clientX; miraY = e.clientY; miraActiva = true; return; }
    if (!gesto.activo) return;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });

  canvas.addEventListener('pointerup', function (e) {
    if (esDesktop) return;
    if (!gesto.activo) return;
    gesto.activo = false;
    gesto.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    marcarActividad(); // fin del gesto: reinicia la gracia
    ejecutarSuelta(gesto.puntos, false); // suelta normal: aplica umbral/cancelación
  });

  canvas.addEventListener('pointerleave', function () { miraActiva = false; });

  // DISPARO HITSCAN (desktop): impacto INMEDIATO bajo la mira. Si toca un cubo
  // vivo de un target, lo destruye (1 cubito = precisión) y puntúa ×racha; si toca
  // un ROJO, game over; si no toca nada, es FALLO. Anti-spam por CADENCIA_MS.
  function dispararHitscan(mx, my) {
    if (pausado || !jugando) return;
    const ahora = performance.now();
    if (ahora - ultimoDisparo < CADENCIA_MS) return;
    ultimoDisparo = ahora;
    miraX = mx; miraY = my; miraActiva = true;
    marcarActividad();
    disparos.push({ x: mx, y: my, inicio: ahora }); // destello del tiro
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      const tg = targets[ti];
      const idx = F.celdaEnPunto(tg, mx, my);
      if (idx < 0) continue;                 // la mira no está sobre un cubo vivo
      if (tg.rojo) { terminarPartida(); return; } // impacto en ROJO → game over
      // NARANJA normal: destruye el cubito impactado (preciso, 1 cubo). GRANDE:
      // más pesado + hitball chica → cada golpe demuele su ZONA (¼ = ceil(vivosMax/4))
      // alrededor de la mira → exige MÍN. 4 golpes.
      const arrancadas = tg.grande
        ? F.celdasCercanas(tg, mx, my, Math.ceil(tg.vivosMax / 4))
        : [idx];
      const centros = [];
      for (let k = 0; k < arrancadas.length; k++) { centros.push(F.celdaMundo(tg, arrancadas[k])); tg.celdas[arrancadas[k]] = false; }
      tg.vivos -= arrancadas.length;
      tg.masa = F.FISICA.MASA_TARGET * (tg.vivos / 20);
      tg.destelloHasta = ahora + DESTELLO_MS;
      P.anotarHit(marcador);                 // disparo certero = hit (sube la racha)
      P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, ahora);
      const g = P.anotarDestruidos(marcador, arrancadas.length); // cubos × 5 × racha
      explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base);
      flotante(centros[0].x, centros[0].y, '+' + g, ACENTO.vivo, tamGanancia(g), g >= 300);
      if (g >= 50) popMarcador();
      actualizarMarcador();
      if (tg.vivos <= 0) { targets.splice(ti, 1); sacudidaHasta = ahora + SACUDIDA_MS; }
      return; // un tiro impacta un solo target
    }
    // No tocó ningún cubo → FALLO.
    const pen = P.anotarFallo(marcador);
    actualizarMarcador();
    registrarPerdida(pen);
  }

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

  // Botón de pausa: congela el juego y abre el MENÚ DE PAUSA (Continuar / Reiniciar).
  const elPausa = document.getElementById('pausa');
  const botonPausa = document.querySelector('.boton-pausa');
  if (botonPausa) botonPausa.addEventListener('click', function () {
    if (!jugando || pausado) return;   // sólo se pausa una partida en curso
    pausado = true;
    if (elPausa) elPausa.classList.remove('oculto');
  });
  // Continuar: reanuda la partida (gracia fresca, no cobra la pausa).
  const btnContinuar = document.getElementById('continuar');
  if (btnContinuar) btnContinuar.addEventListener('click', function () {
    pausado = false;
    if (elPausa) elPausa.classList.add('oculto');
    marcarActividad();
  });
  // Reiniciar: cierra la pausa y vuelve al MENÚ DE SELECCIÓN de modo.
  const btnReiniciar = document.getElementById('reiniciar');
  if (btnReiniciar) btnReiniciar.addEventListener('click', function () {
    pausado = false;
    if (elPausa) elPausa.classList.add('oculto');
    mostrarInicio(); // jugando = false → overlay de selección (60 min / Relax mode)
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

    // Pausado o SIN PARTIDA (overlay de inicio/fin arriba): congela toda
    // actualización (física, spawn, colisión, cobro); solo re-dibuja el estado.
    if (pausado || !jugando) { cobrando = false; dibujar(); return; }

    // Modo 60 MIN: el reloj SÓLO corre cuando se juega (esta línea no se alcanza si
    // está pausado → la pausa lo detiene). Al agotarse, termina la partida.
    if (modoJuego === '60') {
      tiempoRestante -= dt;
      if (tiempoRestante <= 0) { tiempoRestante = 0; terminarPartida(); dibujar(); return; }
    }

    // Costo de INACTIVIDAD: tras la gracia, cada segundo quieto cuesta el 25%
    // del castigo del tramo actual. El reloj NO corre si el documento está
    // oculto (ya gateado) ni mientras hay un gesto activo. Piso en 0.
    cobrando = false;
    if (!document.hidden && !gesto.activo) {
      const idle = t - ultimoGesto;
      if (idle > GRACIA_MS) {
        const debidos = Math.floor((idle - GRACIA_MS) / 1000);
        while (segundosCobrados < debidos) {
          const c = P.anotarInactividadSegundo(marcador);
          segundosCobrados++;
          if (c > 0) registrarPerdida(c); // pérdida: bordes + contador rojo + monto (sin flotante)
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
    // Targets: misma física (sub-paseada). Al salir del viewport mueren solos
    // (paso() los marca); el spawn caótico gobierna el reemplazo por su reloj.
    for (let i = targets.length - 1; i >= 0; i--) {
      F.paso(targets[i], dt, limites);
      if (!targets[i].viva) targets.splice(i, 1);
    }

    // Prueba la colisión de UNA bolita contra todos los targets (llamado en
    // cada subpaso de paso() → sin túnel). Carambola: puede golpear varios.
    function colisionar(b) {
      for (let ti = targets.length - 1; ti >= 0; ti--) {
        const tg = targets[ti];
        if (tg.rojo) {
          // ROJO: cualquier contacto de la hitball TERMINA la partida.
          if (!F.colisionCirculoRect(b, tg)) continue;
          terminarPartida();
          return; // corta el cuadro; el bucle se congela
        }
        // NARANJA (el que puntúa): daño por cubos + ganancia × racha.
        const r = F.resolverImpacto(b, tg);
        if (!r) continue;
        tg.destelloHasta = t + DESTELLO_MS;    // destello en CUALQUIER contacto
        if (!b.tocado) {                       // primer toque = hit (sube la racha continua)
          b.tocado = true;
          P.anotarHit(marcador);
          P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, t); // respiro al 10º hit en dif. máx
        }
        if (r.destruidos > 0) {                // ganancia proporcional × racha
          const g = P.anotarDestruidos(marcador, r.destruidos);
          flotante(r.px, r.py, '+' + g, ACENTO.vivo, tamGanancia(g), g >= 300);
          if (g >= 50) popMarcador();          // latido en ganancias fuertes
        }
        actualizarMarcador();
        if (r.cubosLiberados.length > 0) {
          explotarCubos(r.cubosLiberados, r.px, r.py, r.vImpact, tg.vx, tg.vy, ACENTO.base); // debris naranja
        }
        if (r.muerto) {
          sacudidaHasta = t + SACUDIDA_MS;     // micro-sacudida solo en muerte
          targets.splice(ti, 1);
        }
      }
    }

    // Avanza cada bolita en SUBPASOS, probando colisión en cada uno (fin del
    // túnel). No se retiran aún: la colisión debe verlas vivas (para el fallo).
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      b.radio = RADIO_NORMAL;
      F.paso(b, dt, limites, function () { colisionar(b); });
      b.historia.unshift({ x: b.x, y: b.y }); // estela propia (3 fantasmas)
      if (b.historia.length > LAG_ESTELA * 3 + 1) b.historia.pop();
    }
    // Retira las bolitas muertas: si no tocó nada = FALLO (castigo, rompe racha).
    for (let i = bolitas.length - 1; i >= 0; i--) {
      const b = bolitas[i];
      if (!b.viva) {
        if (!b.tocado) {
          // FALLO: resta y dispara el feedback de pérdida (bordes + contador rojo
          // + monto agregado). Sin flotante regado.
          const pen = P.anotarFallo(marcador);
          actualizarMarcador();
          registrarPerdida(pen);
        }
        bolitas.splice(i, 1);
      }
    }
    // Flotantes de feedback: suben y se desvanecen.
    for (let i = flotantes.length - 1; i >= 0; i--) {
      flotantes[i].edad += dt;
      if (flotantes[i].edad >= flotantes[i].vida) flotantes.splice(i, 1);
    }
    // Cubos: gravedad de los targets, giro. CAEN hasta SALIR del viewport (sin
    // fade, sin muerte por tiempo). No colisionan.
    for (let i = cubos.length - 1; i >= 0; i--) {
      const q = cubos[i];
      q.vy += F.FISICA.G_TARGET * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.velRot * dt;
      if (q.y > H + 8 || q.x < -8 || q.x > W + 8 || q.y < -400) cubos.splice(i, 1);
    }
    // SPAWN bajo el TOPE DURO de 2 (naranjas + rojos + grande juntos). Cada gate
    // mira targets.length ACTUAL (tras un spawn el siguiente ve el lugar ocupado →
    // nunca se pasa de 2). Si no hay lugar/no toca, el timer queda vencido y dispara
    // al liberarse (no se descarta el turno).
    if (targets.length < MAX_EN_PANTALLA && t >= proximoSpawn) {
      generarNaranja();
      proximoSpawn = t + retardoNaranja(t);
    }
    // ESCALADA de ROJOS: sube de nivel cada 5–10s (sin tope); el nivel acorta su intervalo.
    P.pasoEscalada(escalada, t, Math.random);
    if (targets.length < MAX_EN_PANTALLA && t >= proximoRojo) {
      generarRojo();
      proximoRojo = t + P.intervaloRojo(escalada.nivel) * rnd(ROJO_JITTER[0], ROJO_JITTER[1]);
    }
    // GRANDE: mínimo 8s entre apariciones; nunca dos a la vez; tope de 2.
    if (targets.length < MAX_EN_PANTALLA && t >= proximoGrande && !targets.some(function (x) { return x.grande; })) {
      generarGrande();
      proximoGrande = t + GRANDE_MIN_MS + Math.random() * GRANDE_JITTER_MS;
    }
    // Récord EN VIVO: si el score superó el récord, sube ya (y escribe con throttle).
    if (record.considerar(marcador.puntos, t)) actualizarRecord();
    // Fin del latido del marcador.
    if (marcadorPopHasta && t > marcadorPopHasta) { elActual.style.transform = 'scale(1)'; marcadorPopHasta = 0; }
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

    // Targets lanzados, rotados sobre su centro. NARANJA = ACENTO.base; ROJO =
    // parpadeo cloudover-a/b. El destello de contacto (crema) manda.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const destella = t.destelloHasta && performance.now() < t.destelloHasta;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      dibujarSpriteTarget(t, destella); // la grilla (cols×filas) ya define el tamaño
      ctx.restore();
    }
    // Cubos de explosión (animación pura, sin fade: caen sólidos hasta salir).
    for (let i = 0; i < cubos.length; i++) {
      const q = cubos[i];
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.fillStyle = q.color;
      const h = q.tam / 2;
      ctx.beginPath();
      ctx.roundRect(-h, -h, q.tam, q.tam, q.tam >= 8 ? 1.5 : 0.8);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const ahoraB = performance.now();
    // Marcador Actual: rojo #FF4583 durante 400ms al restar; si no, el naranja vivo.
    if (elActual) elActual.style.color = (ahoraB < contadorRojoHasta) ? ROJO_CONTADOR : ACENTO.vivo;

    if (esDesktop) {
      // Destello del disparo HITSCAN: una hitball chica que aparece y se apaga.
      for (let i = disparos.length - 1; i >= 0; i--) {
        const s = disparos[i];
        const p = (ahoraB - s.inicio) / DISPARO_MS;
        if (p >= 1) { disparos.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.shadowColor = ACENTO.vivo; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(s.x, s.y, RADIO_MIRA, 0, Math.PI * 2);
        ctx.fillStyle = ACENTO.vivo; ctx.fill();
        ctx.restore();
      }
      // MIRA que sigue al cursor: cruz + anillo finos en naranja vivo.
      if (miraActiva && miraX >= 0) {
        ctx.save();
        ctx.strokeStyle = ACENTO.vivo; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(miraX, miraY, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(miraX - 16, miraY); ctx.lineTo(miraX - 5, miraY);
        ctx.moveTo(miraX + 5, miraY); ctx.lineTo(miraX + 16, miraY);
        ctx.moveTo(miraX, miraY - 16); ctx.lineTo(miraX, miraY - 5);
        ctx.moveTo(miraX, miraY + 5); ctx.lineTo(miraX, miraY + 16);
        ctx.stroke();
        ctx.fillStyle = ACENTO.vivo;
        ctx.beginPath(); ctx.arc(miraX, miraY, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else {
      // MÓVIL: hitball lanzada + estela; y la bolita en reposo/agarrada.
      for (let i = 0; i < bolitas.length; i++) {
        const b = bolitas[i];
        const rB = b.radio || RADIO_NORMAL;
        dibujarEstela(b, rB, ACENTO.vivo);         // estela = aura viva (va en la hitball)
        dibujarBolita(b.x, b.y, rB, ACENTO.vivo, false);
      }
      if (gesto.activo) {
        const dedo = gesto.puntos[gesto.puntos.length - 1];
        dibujarBolita(dedo.x, dedo.y, RADIO_NORMAL, ACENTO.vivo, true);
      } else if (ahoraB - ultimoDisparo >= CADENCIA_MS) {
        const r = reposo();
        dibujarBolita(r.x, r.y, RADIO_NORMAL, ACENTO.vivo, true);
      }
    }

    // Números flotantes: +N en el impacto (sube y se desvanece); bonos de
    // racha más grandes en el centro. --coral-vivo.
    // Flotantes: pop de escala (0.5→1.2→1.0) + subida + fade. +N coral (glow si
    // grande), −N azul, 0 apagado. Todo canvas puro, sin librerías.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < flotantes.length; i++) {
      const fl = flotantes[i];
      const p = fl.edad / fl.vida;
      let esc = 1;
      if (fl.edad < 110) esc = 0.5 + 0.7 * (fl.edad / 110);
      else if (fl.edad < 240) esc = 1.2 - 0.2 * ((fl.edad - 110) / 130);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.translate(fl.x, fl.y - p * 34);
      ctx.scale(esc, esc);
      if (fl.glow) { ctx.shadowColor = fl.color || ACENTO.vivo; ctx.shadowBlur = 12; }
      ctx.fillStyle = fl.color || ACENTO.vivo;
      ctx.font = '700 ' + fl.tam + 'px ' + COLOR.fuente;
      ctx.fillText(fl.texto, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // BADGE del multiplicador de racha: "×N" prominente arriba-centro, crece con
    // la racha y pulsa. Solo cuando el multiplicador supera ×1 (racha ≥ 3).
    const mult = P.multRacha(marcador.racha);
    if (mult > 1) {
      const now = performance.now();
      ctx.save();
      ctx.translate(W / 2, Math.max(158, H * 0.16)); // bajo la banda del temporizador
      ctx.scale(1 + 0.06 * Math.sin(now / 150), 1 + 0.06 * Math.sin(now / 150));
      ctx.shadowColor = ACENTO.vivo;
      ctx.shadowBlur = 12;
      ctx.fillStyle = ACENTO.vivo;
      ctx.font = '800 ' + (26 + Math.min(20, marcador.racha)) + 'px ' + COLOR.fuente;
      ctx.fillText('×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1)), 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
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

    // ── PÉRDIDA: palpitar de bordes laterales + monto agregado (fuera de la
    // sacudida: pegado al viewport). Coste barato: dos gradientes lineales + un
    // fillText, y SOLO durante la ventana del pulso. Rojos literales (feedback).
    const nowP = performance.now();
    const dtP = nowP - perdidaInicio;
    if (dtP >= 0 && dtP < PULSO_ENTRADA + PULSO_DISIP) {
      const env = dtP < PULSO_ENTRADA ? dtP / PULSO_ENTRADA : Math.max(0, 1 - (dtP - PULSO_ENTRADA) / PULSO_DISIP);
      ctx.save();
      ctx.globalAlpha = 0.6 * env;
      const gl = ctx.createLinearGradient(0, 0, FRANJA_PX, 0);
      gl.addColorStop(0, ROJO_BORDE); gl.addColorStop(1, 'transparent');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, FRANJA_PX, H);
      const gr = ctx.createLinearGradient(W, 0, W - FRANJA_PX, 0);
      gr.addColorStop(0, ROJO_BORDE); gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr; ctx.fillRect(W - FRANJA_PX, 0, FRANJA_PX, H);
      ctx.restore();
    }
    const dtM = nowP - montoInicio;
    if (dtM >= 0 && dtM < MONTO_MS && montoPerdido > 0) {
      let esc = 1;                                  // palpitar (pop) al aparecer
      if (dtM < 90) esc = 0.6 + 0.5 * (dtM / 90);
      else if (dtM < 200) esc = 1.1 - 0.1 * ((dtM - 90) / 110);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - dtM / MONTO_MS); // disipa en 600ms
      ctx.translate(W / 2, 124);                    // bajo el temporizador (sin encimarse)
      ctx.scale(esc, esc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = ROJO_MONTO;
      ctx.font = '700 17px ' + COLOR.fuente;        // ~60% del marcador (28px)
      ctx.fillText('−' + montoPerdido, 0, 0);
      ctx.restore();
    }

    // TEMPORIZADOR (modo 60 min): cuenta regresiva "M:SS" GRANDE top-center, en su
    // propia banda (bajo la barra, encima del badge y del monto → sin encimarse).
    // Se pone rojo y pulsa en los últimos 10s. En libre no se dibuja.
    if (jugando && modoJuego === '60') {
      const restante = Math.max(0, tiempoRestante);
      const seg = Math.ceil(restante / 1000);
      const txt = Math.floor(seg / 60) + ':' + (seg % 60 < 10 ? '0' + (seg % 60) : seg % 60);
      const urgente = restante <= 10000;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const esc = urgente ? 1 + 0.08 * Math.sin(nowP / 180) : 1;
      ctx.translate(W / 2, 88);
      ctx.scale(esc, esc);
      ctx.shadowColor = urgente ? ROJO_BORDE : ACENTO.base;
      ctx.shadowBlur = 8;
      ctx.fillStyle = urgente ? ROJO_BORDE : ACENTO.claro;
      ctx.font = '800 32px ' + COLOR.fuente;
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  }

  // Estela de LUZ VIVA: 3 fantasmas en el color de modo (30/20/10% alfa). Los
  // colores vivos ya leen como luz; sin shadowBlur por fantasma (presupuesto).
  function dibujarEstela(b, radio, claro) {
    const alfas = [0.3, 0.2, 0.1];
    const R = (radio || 14) - 1.5;
    ctx.fillStyle = claro;
    for (let i = 0; i < alfas.length; i++) {
      const p = b.historia[(i + 1) * LAG_ESTELA];
      if (!p) continue;
      ctx.globalAlpha = alfas[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sprite del target centrado en (0,0): retícula 5×4 de cubos de 8px en
  // --coral, dibujando SOLO las celdas vivas (t.celdas) → el boquete se ve.
  // Cubos esquineros con la esquina exterior a 4px; ojos (celdas 6 y 8) en
  // --negro, cada uno solo si su celda sigue viva.
  function dibujarSpriteTarget(t, destella) {
    const CUBO = 8;
    const RADIO_ESQ = 4;
    const COLS = t.cols || 5;
    const FILAS = t.filas || 4;
    const x = -COLS * 4; // esquina sup-izq local (grilla centrada)
    const y = -FILAS * 4;
    // Dos tipos: NARANJA (el que puntúa, ACENTO.base) y ROJO (parpadea entre
    // #B1003B ↔ #FF0055 cada 100ms → termina la partida). El destello de contacto
    // (crema) manda sobre ambos. La grilla puede ser 5×4 o mayor (target grande).
    let col = t.rojo
      ? (Math.floor(performance.now() / ROJO_PARPADEO_MS) % 2 ? COLOR.cloudoverA : COLOR.cloudoverB)
      : ACENTO.base;
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
    // Ojos (dos cubos interiores, t.ojos), cada uno sólo si su celda sigue viva.
    ctx.fillStyle = COLOR.negro;
    const ojos = t.ojos || [6, 8];
    for (let k = 0; k < ojos.length; k++) {
      const oi = ojos[k];
      if (!t.celdas[oi]) continue;
      ctx.fillRect(x + (oi % COLS) * CUBO + 2, y + ((oi / COLS) | 0) * CUBO + 2, 4, 4);
    }
  }

  // Bolita: disco sólido en el COLOR del modo (SIN parpadeo — el acento es
  // estable; el único que parpadea es el CloudOver). `glow` añade un shadowBlur
  // = aura viva (solo en la bolita principal/reposo, por presupuesto).
  function dibujarBolita(cx, cy, radio, color, glow) {
    const RADIO = radio || 14;
    ctx.save();
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
    ctx.beginPath();
    ctx.arc(cx, cy, RADIO - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = RADIO < 14 ? 2 : 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  // Desktop: marca el <html> para ocultar el hitmaker y el cursor del sistema
  // (la mira lo reemplaza). Móvil: todo queda como estaba.
  if (esDesktop) document.documentElement.classList.add('desktop');

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  actualizarRecord();    // récord del modo por defecto (60 min) hasta elegir
  marcarActividad();     // inicia el reloj de inactividad (evita cobro al arrancar)
  escalada = P.crearEscalada(performance.now(), Math.random); // estado inicial válido
  mostrarInicio();       // pantalla de inicio: elegí modo (60 min / Relax) para jugar
  arrancarBucle();       // el bucle corre (congelado hasta elegir modo)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
