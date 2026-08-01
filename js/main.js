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

  // PERSISTENCIA POR MODO (FASE 10): dos datos {record, ultimoScore} por modo,
  // en DOS almacenes (localStorage + IndexedDB) bajo la misma llave versionada.
  // `record` apunta al del modo ACTIVO; la celda "Record" muestra ese.
  const almacen = (function () { try { return window.localStorage; } catch (e) { return null; } })();
  // Envoltorio KV asíncrono sobre IndexedDB (get/set por clave). null si no hay
  // IndexedDB o si algo lanza al abrir: el juego cae a localStorage + memoria.
  const idbKV = (function () {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return null;
      let dbp = null;
      function abrir() {
        if (dbp) return dbp;
        dbp = new Promise(function (res, rej) {
          const req = indexedDB.open('hitclaud', 1);
          req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
          req.onsuccess = function () { res(req.result); };
          req.onerror = function () { rej(req.error); };
        });
        return dbp;
      }
      function tx(modo, fn) {
        return abrir().then(function (db) {
          return new Promise(function (res, rej) {
            const t = db.transaction('kv', modo);
            const r = fn(t.objectStore('kv'));
            t.oncomplete = function () { res(r && r.result); };
            t.onerror = function () { rej(t.error); };
            t.onabort = function () { rej(t.error); };
          });
        });
      }
      return {
        get: function (k) { return tx('readonly', function (os) { return os.get(k); }); },
        set: function (k, v) { return tx('readwrite', function (os) { return os.put(v, k); }); },
      };
    } catch (e) { return null; }
  })();
  const record60 = U.crearPersistencia(almacen, idbKV, 'hitclaud.record.v2.60', 500);
  const recordLibre = U.crearPersistencia(almacen, idbKV, 'hitclaud.record.v2.libre', 500);
  let record = record60; // activo (se ajusta al elegir modo)
  const elRecord = document.querySelector('.marcador--record .valor');
  function actualizarRecord() { elRecord.textContent = U.abreviarNumero(record.valor); }
  // Récord de la PANTALLA DE INICIO (FASE 19). Blindado: si el almacenamiento falla
  // y algo lanza, muestra 0 y NO rompe (lección de congelamiento). El botón JUGAR
  // vive aparte, así que un fallo acá jamás lo desactiva.
  const elIniRecord = document.getElementById('iniRecord');
  function actualizarRecordInicio() {
    if (!elIniRecord) return;
    try { elIniRecord.textContent = U.abreviarNumero(record.valor); }
    catch (e) { elIniRecord.textContent = '0'; }
  }
  // RECONCILIACIÓN al arrancar (async): funde localStorage e IndexedDB, se queda
  // con el record más alto y repuebla el almacén faltante. Refresca ambos displays.
  [record60, recordLibre].forEach(function (r) {
    r.reconciliar().then(function () { if (r === record) { actualizarRecord(); actualizarRecordInicio(); } });
  });

  // ── Modo de juego + ciclo de partida ───────────────────────────────
  // PANTALLA DE INICIO (overlay): elegís "60 seg" o "Relax mode"; aparece al
  // cargar y al terminar una partida. En 60 seg corre una cuenta regresiva y al
  // llegar a 0 termina la partida. En Relax mode, sólo termina al tocar un rojo.
  const elGameOver = document.getElementById('gameover');
  const DURACION_60 = 60 * 1000; // modo cronometrado = 60 SEGUNDOS
  function reiniciarEstado() {
    marcador.puntos = 0; marcador.racha = 0;
    targets.length = 0; bolitas.length = 0; cubos.length = 0; flotantes.length = 0;
    ultimoDisparo = -Infinity; gesto.activo = false; marcadorPopHasta = 0; secuencia = null; sacudidaCloudover = null;
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
    cascEvento('iniciarPartida', 'modo:' + modo);
  }
  // Fin de partida. `porTiempo`=true → cierre por AGOTARSE EL TIEMPO: el récord
  // sube si el score lo supera. `porTiempo`=false → cierre por CLOUDOVER: el score
  // se vacía (ultimoScore=0) y el récord queda INTACTO aunque el score lo superara
  // (regla dura del dueño: el CloudOver cuesta la partida entera). ÚNICO punto de
  // escritura del récord. Persiste los dos datos en ambos almacenes y muestra el overlay.
  function terminarPartida(porTiempo) {
    if (!jugando) return;
    jugando = false;
    const ahora = performance.now();
    // esRecord ANTES de escribir (terminar sube el record si corresponde). Sólo por tiempo.
    const esRecord = porTiempo && marcador.puntos >= record.valor && marcador.puntos > 0;
    const scoreFinal = porTiempo ? marcador.puntos : 0; // CloudOver = vaciado a 0
    record.terminar(scoreFinal, ahora, !!porTiempo);
    actualizarRecord();
    pintarFin(scoreFinal, esRecord);
    cascEvento('terminarPartida', 'porTiempo:' + !!porTiempo + ' score:' + scoreFinal);
  }
  // Pinta el overlay de fin con el score y el aviso de récord (diseño sin cambios).
  function pintarFin(score, esRecord) {
    elGameOver.querySelector('.go-score').classList.remove('oculto');
    elGameOver.querySelector('.go-score .valor').textContent = U.abreviarNumero(score);
    elGameOver.querySelector('.go-record').classList.toggle('oculto', !esRecord);
    elGameOver.classList.remove('oculto');
  }

  // ── SECUENCIA de CloudOver (FASE 12 commit 2) ──────────────────────────────
  // Golpe al CloudOver: arranca impacto→congelado→vaciado→overlay. Explota los
  // cubos del CloudOver en el punto de impacto (física existente) con su color de
  // identidad (rojo) y lo saca del tablero. NO termina la partida aún — eso ocurre
  // al entrar el overlay (a los 1300ms). Toda la lógica va con try/catch: si algo
  // falla, salta directo al overlay (el juego NUNCA queda trabado sin salida).
  function golpeCloudover(tg, px, py) {
    if (secuencia || !jugando) return;
    cascEvento('golpeCloudover', 'px:' + Math.round(px) + ' py:' + Math.round(py));
    try {
      const centros = F.cubosVivosMundo(tg);
      explotarCubos(centros, px, py, 1.6, tg.vx, tg.vy, COLOR.cloudoverB); // debris rojo (identidad)
    } catch (e) { /* si la explosión falla, la secuencia sigue igual */ }
    try {
      const i = targets.indexOf(tg);
      if (i >= 0) targets.splice(i, 1);
    } catch (e) { /* nada */ }
    gesto.activo = false; // ignora cualquier gesto en curso durante la secuencia
    // Limpia feedback de pérdida en vuelo (bordes/monto de un cobro previo) para que
    // el vaciado tenga sus PROPIOS visuales, sin residuos del castigo normal.
    perdidaInicio = -Infinity; montoInicio = -Infinity; montoHasta = 0; contadorRojoHasta = 0;
    // VIBRACIÓN (200ms) al golpe, blindada. NOTA: iOS NO soporta la Vibration API →
    // el dueño NO la sentirá en su iPhone (solo Android). No se simula ni se sustituye.
    try { if (navigator && navigator.vibrate) navigator.vibrate(200); } catch (e) { /* no soportado */ }
    // reduced-motion: sin conteo ni demora → vacía a 0 y overlay directo. SIN cámara.
    if (reducirMovimiento()) { marcador.puntos = 0; actualizarMarcador(); saltarAlOverlay(); return; }
    const ahora = performance.now();
    secuencia = { inicio: ahora, score: marcador.puntos, fase: 'impacto' };
    sacudidaCloudover = { inicio: ahora }; // sólo la sacudida (12px/300ms); sin zoom ni centrado
  }
  // Cierre garantizado de la secuencia: termina por CloudOver (ultimoScore=0, record
  // intacto) y muestra el overlay. Blindado: si terminarPartida falla, fuerza el
  // overlay a mano. Deja secuencia=null pase lo que pase.
  function saltarAlOverlay() {
    try { terminarPartida(false); }
    catch (e) {
      jugando = false;
      try { pintarFin(0, false); } catch (e2) { try { elGameOver.classList.remove('oculto'); } catch (e3) {} }
    }
    secuencia = null;
  }
  // Overlay de fin/selección al reiniciar desde la pausa (sin score todavía).
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

  // ── PANTALLA DE BIENVENIDA (FASE 19): lo PRIMERO que se ve al abrir. Mismo
  // mecanismo de overlays DOM que #gameover/#pausa (no un sistema paralelo). El
  // mundo queda QUIETO detrás (jugando=false → sin física/spawn/reloj); el fondo de
  // datos sigue dibujándose. Al tocar JUGAR arranca la partida de 60s desde cero.
  const elInicio = document.getElementById('inicio');
  function mostrarPantallaInicio() {
    jugando = false;
    actualizarRecordInicio();
    if (elInicio) elInicio.classList.remove('oculto');
  }
  const btnJugar = document.getElementById('jugar');
  if (btnJugar) btnJugar.addEventListener('click', function () {
    if (elInicio) elInicio.classList.add('oculto');
    iniciarPartida('60'); // partida de siempre, reloj de 60s desde cero
  });

  // Retardo del próximo spawn de NARANJAS: rango base por score (rangoVigente)
  // con caos superpuesto (ráfagas/pausas), recortado a ≤800ms (SPAWN_GAP_MAX): la
  // pantalla nunca queda más de 800ms sin aparición de un target (habiendo lugar).
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
  const RADIO_HITMAKER = 203; // hit-test RADIAL desde el ancla del hitmaker (+40%)
  const RADIO_NUCLEO = 60;    // soltar de vuelta aquí = cancelar
  const UMBRAL_PX = 14;       // trazo menor = ignorar
  const UMBRAL_SUELTA = 0.15; // px/ms: soltar más lento = la bolita CAE
  // Frenos anti-paseo de la hitball agarrada (radio de agarre = 203px):
  const QUIETUD_VEL = 0.08;   // px/ms: por debajo cuenta como quieto
  const QUIETUD_MS = 250;     // ms continuos quieto → se suelta sola
  const CORREA_PX = 252;      // dist radial máx desde el ancla → se suelta sola (proporcional a 203)
  const CADENCIA_MS = 100;    // separación mínima entre SUELTAS (afinable)
  const MAX_BOLITAS = 24;     // tope de bolitas vivas simultáneas (rendimiento)
  const ESTELA_PUNTOS = 5;    // largo de la cola meteoro (puntos de espinazo, ≤5)
  const ESTELA_LARGO_MAX = 160; // px: longitud del gradiente cacheado de la cola (cabeza→0)

  // ── Constantes del spawner de targets (dos tipos: NARANJA y ROJO) ──
  // Spawn CAÓTICO: cantidad variable (ráfagas/pausas, retardoCaotico) desde los
  // 4 orígenes, con velocidad variable por target.
  const RADIO_NORMAL = 14;         // radio de la hitball
  // TOPE DURO: nunca más de 2 targets vivos en pantalla (naranjas + rojos + grande
  // JUNTOS). Si no hay lugar, el generador NO descarta el turno: espera con su
  // timer en el pasado y dispara en cuanto se libera (el ritmo se conserva).
  const MAX_EN_PANTALLA = 2;
  // TIEMPO entre apariciones de naranjas: hasta 800ms (menos acelerado). La
  // pantalla no queda más de 800ms sin un target (habiendo lugar).
  const SPAWN_GAP_MAX = 800;

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
  // prefers-reduced-motion: se consulta EN VIVO (el usuario puede cambiarlo). Si está
  // activo, la secuencia de CloudOver es inmediata (score a 0 sin conteo, overlay ya).
  function reducirMovimiento() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
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
  // SECUENCIA de CloudOver (FASE 12): estado de partida SEPARADO de la pausa (no la
  // reutiliza). null salvo mientras corre la máquina impacto→congelado→vaciado→overlay.
  // {inicio, score, fase}. El "congelamiento" = este estado ≠ null con fase ≥ vaciado.
  let secuencia = null;
  // SACUDIDA de CloudOver (FASE 16, revert del zoom): {inicio}. Sólo el temblor de
  // 12px/300ms desde el golpe; se apaga solo (sin zoom ni centrado). null salvo durante.
  let sacudidaCloudover = null;
  let modoJuego = null;             // '60' | 'libre'
  let tiempoRestante = 0;           // ms restantes (modo 60 seg) — se decrementa con dt SOLO jugando
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
  // MEDIDOR DE FPS (debug temporal, build v41-fps): mide cuadro real vs dibujo. Sus
  // cifras (F, D, peor, conteos) ya NO se pintan en un recuadro: son una línea más
  // de la CASCADA (fase 16).
  const medidorFps = U.crearMedidorFps(1000, 500);
  let ultimoDibujoMs = 0; // duración de la última llamada a dibujar() (1 cuadro de atraso)

  // ── DATOS DE FONDO: MAYORÍA VIVOS + ESTÁTICO COMO TEXTURA (FASE 18) ─────────
  // Una sola columna a la izquierda con 20px de MARGEN en AMBOS bordes; ninguna
  // línea toca ni cruza el borde (se TRUNCA con "…" midiendo el ancho real). ~70%
  // de las líneas son VIVAS (valor cambia con el juego, alfa 0.15); ~30% ESTÁTICAS
  // de relleno = fragmentos REALES del código fuente (alfa 0.08). Interlínea 16px,
  // mono 10px, --texto-apagado, capa detrás de todo, sin freno por fps. TODO REAL.
  const FONDO_MARGEN = 20, FONDO_Y0 = 8, FONDO_LH = 16;
  let ultimoEvento = '';   // ÚLTIMO evento real (nombre de función + datos), fijo hasta el próximo
  function cascEvento(fn, datos) { ultimoEvento = fn + (datos ? ' ' + datos : ''); }
  function n0(x) { return isFinite(x) ? Math.round(x) : x; } // timestamp/entero, tolera -Infinity
  // VIVAS: cada thunk devuelve un string cuyo VALOR cambia con el estado real del juego.
  const cascVivas = [
    function () { const m = medidorFps.leer(performance.now()); return 'medidorFps F:' + Math.round(m.fps) + ' D:' + m.dibujoMs.toFixed(1) + ' peor:' + Math.round(m.peorMs); },
    function () { return 'marcador.puntos:' + marcador.puntos; },
    function () { return 'marcador.racha:' + marcador.racha + ' multRacha:' + U.cascFmt(P.multRacha(marcador.racha)); },
    function () { return 'modoJuego:' + (modoJuego || 'null') + ' tiempoRestante:' + Math.max(0, Math.round(tiempoRestante)); },
    function () { return 'jugando:' + jugando + ' pausado:' + pausado; },
    function () { return 'gesto.activo:' + gesto.activo; },
    function () { return 'cubos.length:' + cubos.length + ' bolitas.length:' + bolitas.length + ' targets.length:' + targets.length; },
    function () { return 'escalada.nivel:' + (escalada ? escalada.nivel : 'null'); },
    function () { return 'segundosCobrados:' + segundosCobrados + ' cobrando:' + cobrando; },
    function () { return 'record.valor:' + record.valor; },
    function () { return 'proximoSpawn:' + n0(proximoSpawn); },
    function () { return 'proximoRojo:' + n0(proximoRojo); },
    function () { return 'proximoGrande:' + n0(proximoGrande); },
    function () { return 'sacudidaHasta:' + n0(sacudidaHasta); },
    function () { return 'secuencia.fase:' + (secuencia ? secuencia.fase : 'null'); },
    function () { return 'ultimoDisparo:' + n0(ultimoDisparo); },
    function () { return 'ultimoGesto:' + n0(ultimoGesto); },
    function () { return 'montoPerdido:' + montoPerdido + ' montoInicio:' + n0(montoInicio); },
    function () { return 'perdidaInicio:' + n0(perdidaInicio); },
    function () { return 'marcadorPopHasta:' + n0(marcadorPopHasta); },
    function () { return 'tPrev:' + n0(tPrev); },
    function () { return bolitas[0] ? U.cascEntidad('bolitas[0]', bolitas[0]) : 'bolitas[0]:undefined'; },
    function () { return bolitas[1] ? U.cascEntidad('bolitas[1]', bolitas[1]) : 'bolitas[1]:undefined'; },
    function () { return bolitas[2] ? U.cascEntidad('bolitas[2]', bolitas[2]) : 'bolitas[2]:undefined'; },
    function () { return targets[0] ? U.cascTarget('targets[0]', targets[0]) : 'targets[0]:undefined'; },
    function () { return targets[1] ? U.cascTarget('targets[1]', targets[1]) : 'targets[1]:undefined'; },
    function () { return ultimoEvento; }, // último evento real, fijo hasta el siguiente
  ];
  // ESTÁTICAS: fragmentos REALES del código fuente (textura de relleno), no cambian.
  const cascEstaticas = U.CASC_CODIGO.map(function (linea) { return function () { return linea; }; });
  // INTERLEAVE ~70/30: dos vivas y una estática (relleno entre vivas → sin agujeros),
  // hasta agotar ambas. Cada entrada lleva su thunk y su tipo (para el alfa).
  const lineasFondo = [];
  { let vi = 0, ei = 0;
    while (vi < cascVivas.length || ei < cascEstaticas.length) {
      if (vi < cascVivas.length) lineasFondo.push({ vivo: true, f: cascVivas[vi++] });
      if (vi < cascVivas.length) lineasFondo.push({ vivo: true, f: cascVivas[vi++] });
      if (ei < cascEstaticas.length) lineasFondo.push({ vivo: false, f: cascEstaticas[ei++] });
    } }
  // Dibuja el bloque. SIEMPRE (sin freno por fps). Un fillText por línea, sin shadowBlur
  // ni gradientes. Cada línea se TRUNCA al ancho útil (W − 2·margen), midiendo antes.
  function dibujarFondoDatos() {
    const maxW = W - 2 * FONDO_MARGEN;
    ctx.save();
    ctx.fillStyle = COLOR.textoApagado;
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const anchoDe = function (s) { return ctx.measureText(s).width; };
    for (let i = 0; i < lineasFondo.length; i++) {
      const L = lineasFondo[i];
      let s = L.f();
      if (!s) continue;
      s = U.truncarTexto(s, maxW, anchoDe); // nunca cruza el margen derecho
      ctx.globalAlpha = L.vivo ? 0.15 : 0.08;
      ctx.fillText(s, FONDO_MARGEN, FONDO_Y0 + i * FONDO_LH);
    }
    ctx.restore();
  }

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
    // Divide la gravedad YA existente (que crearTarget dejó con el factor de −40%)
    // por 9 → conserva el MISMO arco pero 3× de tiempo de vuelo respecto a un normal.
    t.gravedad = t.gravedad / (GRANDE_LENTO * GRANDE_LENTO);
    t.radio = Math.max(GRANDE_COLS, GRANDE_FILAS) * 4 + 12; // margen de salida ≈ media diagonal
    t.vidaMax = F.FISICA.VIDA_MAX_MS * GRANDE_LENTO; // vuela 3× más lento → vive 3× más
    t.pesoExtra = GRANDE_PESO;                       // masa ×80 → el impacto casi no lo desvía
    t.masa = F.FISICA.MASA_TARGET * (t.vivos / 20) * GRANDE_PESO;
    targets.push(t);
  }

  // FUENTE ÚNICA de la posición del hitmaker (FASE 11): centrado horizontal
  // (x = mitad del ancho), pegado al borde inferior (misma altura de siempre).
  // Todo lo que dependía del ancla del hitmaker — dibujo de la bola en reposo,
  // zona de agarre radial y frenos — sale de aquí. Antes estaba DUPLICADA:
  // esquina inf-der (W, H) en el hit-test y (W-52, H-52) en el reposo.
  function centroHitmaker() { return { x: W / 2, y: H }; }

  function reposo() {
    // Posición de descanso de la bolita, 52px sobre el ancla (misma altura previa).
    const c = centroHitmaker();
    return { x: c.x, y: c.y - 52 };
  }

  // Distancia RADIAL del punto (x,y) al ancla del hitmaker (fuente única).
  function distHitmaker(x, y) {
    const c = centroHitmaker();
    return Math.hypot(c.x - x, c.y - y);
  }

  // Gradientes de las FRANJAS de borde rojas (pérdida + vaciado del CloudOver):
  // idénticos para ambos usos (ROJO_BORDE → transparente, ancho FRANJA_PX). Se
  // crean UNA sola vez aquí (y al redimensionar), NUNCA dentro del bucle —
  // createLinearGradient por cuadro era costo puro. Al pintar sólo varía el
  // globalAlpha. Dependen de W (la franja derecha) → se regeneran al cambiar el viewport.
  let gradBordeIzq = null, gradBordeDer = null, gradEstela = null;
  // #RRGGBB → 'rgba(r,g,b,a)' (para stops con alfa sin la turbidez de 'transparent').
  function hexARgba(hex, a) {
    const h = String(hex).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function regenerarGradientes() {
    gradBordeIzq = ctx.createLinearGradient(0, 0, FRANJA_PX, 0);
    gradBordeIzq.addColorStop(0, ROJO_BORDE); gradBordeIzq.addColorStop(1, 'transparent');
    gradBordeDer = ctx.createLinearGradient(W, 0, W - FRANJA_PX, 0);
    gradBordeDer.addColorStop(0, ROJO_BORDE); gradBordeDer.addColorStop(1, 'transparent');
    // Cola METEORO: gradiente en el eje LOCAL de la bola (0 = cabeza, −ESTELA_LARGO_MAX
    // = punta). Se pinta bajo translate+rotate por bola → sigue la dirección del vuelo
    // sin recrearse nunca. Cabeza al 45% del tono vivo, punta a 0 (mismo RGB → sin turbidez).
    gradEstela = ctx.createLinearGradient(0, 0, -ESTELA_LARGO_MAX, 0);
    gradEstela.addColorStop(0, hexARgba(ACENTO.vivo, 0.45));
    gradEstela.addColorStop(1, hexARgba(ACENTO.vivo, 0));
  }

  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    regenerarGradientes(); // gradientes de borde recacheados al nuevo tamaño (fuera del bucle)
    dibujar();
  }

  // ── Input ───────────────────────────────────────────────────────────
  // DESKTOP: la mira sigue al cursor; el clic dispara un HITSCAN (impacto
  // inmediato). MÓVIL: gesto de arrastre para lanzar la hitball (un dedo).
  canvas.addEventListener('pointerdown', function (e) {
    if (secuencia) return; // durante la secuencia de CloudOver se ignora todo toque
    if (esDesktop) { dispararHitscan(e.clientX, e.clientY); return; }
    if (gesto.activo) return;
    if (distHitmaker(e.clientX, e.clientY) > RADIO_HITMAKER) return;
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
    if (secuencia) { gesto.activo = false; return; } // toque ignorado durante la secuencia
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
    if (pausado || !jugando || secuencia) return;
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
      if (tg.rojo) { golpeCloudover(tg, mx, my); return; } // impacto en ROJO → secuencia CloudOver
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
      if (distHitmaker(fin.x, fin.y) <= RADIO_NUCLEO) return; // cancelación
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
    if (!jugando || pausado || secuencia) return;   // no se pausa durante la secuencia de CloudOver
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
    mostrarInicio(); // jugando = false → overlay de selección (60 seg / Relax mode)
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
    const dtReal = t - tPrev;            // dt SIN recorte (para el medidor de fps)
    const dt = Math.min(dtReal, 32);     // techo: pestañas en segundo plano
    tPrev = t;
    medidorFps.registrar(t, dtReal, ultimoDibujoMs); // registra CADA cuadro (todas las ramas)

    // SECUENCIA de CloudOver: tiene prioridad. Blindada — cualquier fallo salta al
    // overlay (nunca se traba). En fase IMPACTO el mundo sigue vivo (la explosión
    // respira) y cae al update normal; desde el CONGELAMIENTO todo se detiene y sólo
    // el contador se vacía; luego entra el overlay.
    if (secuencia) {
      try {
        secuencia.fase = U.faseCloudover(t - secuencia.inicio, false);
        if (secuencia.fase === 'overlay') { saltarAlOverlay(); dibujar(); return; }
        if (secuencia.fase !== 'impacto') {
          // CONGELADO: sin física, sin spawn, sin reloj, sin input. Sólo el vaciado.
          cobrando = false; // pantalla limpia: sin el indicador '· · ·' de inactividad
          const val = U.valorVaciado(secuencia.score, t - secuencia.inicio);
          marcador.puntos = val;
          if (elActual) elActual.textContent = U.abreviarNumero(val);
          dibujar();
          return;
        }
        // fase impacto → cae al update normal (reloj y fin por tiempo gateados con !secuencia).
      } catch (e) { saltarAlOverlay(); dibujar(); return; }
    }

    // Pausado o SIN PARTIDA (overlay de inicio/fin arriba): congela toda
    // actualización (física, spawn, colisión, cobro); solo re-dibuja el estado.
    if (pausado || !jugando) { cobrando = false; dibujar(); return; }

    // Modo 60 MIN: el reloj SÓLO corre cuando se juega (gateado con !secuencia: durante
    // la secuencia de CloudOver el reloj se detiene). Al agotarse, termina la partida.
    if (modoJuego === '60' && !secuencia) {
      tiempoRestante -= dt;
      if (tiempoRestante <= 0) { tiempoRestante = 0; terminarPartida(true); dibujar(); return; }
    }

    // Costo de INACTIVIDAD: tras la gracia, cada segundo quieto cuesta el 25%
    // del castigo del tramo actual. El reloj NO corre si el documento está
    // oculto (ya gateado) ni mientras hay un gesto activo. Piso en 0.
    cobrando = false;
    if (!document.hidden && !gesto.activo && !secuencia) {
      const idle = t - ultimoGesto;
      if (idle > GRACIA_MS) {
        const debidos = Math.floor((idle - GRACIA_MS) / 1000);
        while (segundosCobrados < debidos) {
          const c = P.anotarInactividadSegundo(marcador);
          cascEvento('anotarInactividadSegundo', 'c:' + c);
          segundosCobrados++;
          if (c > 0) registrarPerdida(c); // pérdida: bordes + contador rojo + monto (sin flotante)
        }
        if (debidos > 0) { cobrando = true; actualizarMarcador(); }
      }
    }

    // Frenos anti-paseo de la hitball agarrada.
    if (gesto.activo) {
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      if (distHitmaker(dedo.x, dedo.y) > CORREA_PX) {
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
          // ROJO (CloudOver): cualquier contacto de la hitball arranca la secuencia.
          if (!F.colisionCirculoRect(b, tg)) continue;
          golpeCloudover(tg, b.x, b.y);
          return; // corta el cuadro; la secuencia toma el control
        }
        // NARANJA (el que puntúa): daño por cubos + ganancia × racha.
        const r = F.resolverImpacto(b, tg);
        if (!r) continue;
        cascEvento('resolverImpacto', 'tipo:' + r.tipo + ' destruidos:' + r.destruidos + ' muerto:' + r.muerto);
        tg.destelloHasta = t + DESTELLO_MS;    // destello en CUALQUIER contacto
        if (!b.tocado) {                       // primer toque = hit (sube la racha continua)
          b.tocado = true;
          P.anotarHit(marcador);
          cascEvento('anotarHit', 'racha:' + marcador.racha);
          P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, t); // respiro al 10º hit en dif. máx
        }
        if (r.destruidos > 0) {                // ganancia proporcional × racha
          const g = P.anotarDestruidos(marcador, r.destruidos);
          cascEvento('anotarDestruidos', 'n:' + r.destruidos + ' g:' + g);
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
      b.historia.unshift({ x: b.x, y: b.y }); // estela propia (cola meteoro)
      if (b.historia.length > ESTELA_PUNTOS + 1) b.historia.pop();
    }
    // Retira las bolitas muertas: si no tocó nada = FALLO (castigo, rompe racha).
    for (let i = bolitas.length - 1; i >= 0; i--) {
      const b = bolitas[i];
      if (!b.viva) {
        if (!b.tocado) {
          // FALLO: resta y dispara el feedback de pérdida (bordes + contador rojo
          // + monto agregado). Sin flotante regado.
          const pen = P.anotarFallo(marcador);
          cascEvento('anotarFallo', 'pen:' + pen);
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
    // (FASE 12) SIN récord en vivo: el récord ya NO sube ni se escribe durante la
    // partida. La celda "Record" muestra el récord GUARDADO (por tiempo cumplido);
    // sólo se actualiza al terminar por TIEMPO. Un CloudOver no lo mueve.
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
    const _dib0 = performance.now(); // (debug v41-fps) inicio del cronómetro de dibujo
    ctx.clearRect(0, 0, W, H);
    dibujarFondoDatos(); // CAPA DE FONDO: datos reales FIJOS (valor en vivo), detrás de todo

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
    try {
    // SACUDIDA de CloudOver (FASE 16: revert del zoom). El acercamiento/centrado de
    // cámara de la fase 15 se ve como fallo → ELIMINADO. Queda SÓLO la sacudida: un
    // translate de hasta 12px que decrece a 0 en 300ms desde el golpe. NADA de scale
    // ni de foco → la matriz base vuelve a ser la de antes de la fase 15. El bloque va
    // en try/finally → el restore SIEMPRE corre (la vista nunca queda torcida).
    if (sacudidaCloudover) {
      const amp = U.amplitudSacudidaCam(performance.now() - sacudidaCloudover.inicio);
      if (amp > 0) ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
      else sacudidaCloudover = null; // pasados 300ms se apaga (sin residuo)
    }
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
    // Marcador Actual: rojo #FF4583 durante el VACIADO del CloudOver (vaciado/cero) y
    // durante los 400ms al restar; si no, el naranja vivo.
    const enVaciado = !!secuencia && (secuencia.fase === 'vaciado' || secuencia.fase === 'cero');
    if (elActual) elActual.style.color = (enVaciado || ahoraB < contadorRojoHasta) ? ROJO_CONTADOR : ACENTO.vivo;

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
        dibujarEstela(b, rB);                      // cola meteoro (color del gradiente cacheado)
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
      ctx.font = '700 ' + fl.tam + 'px ' + COLOR.fuente;
      const colFl = fl.color || ACENTO.vivo;
      if (fl.glow) haloTexto(fl.texto, 0, 0, colFl, 4); // halo barato en lugar de shadowBlur
      ctx.fillStyle = colFl;
      ctx.fillText(fl.texto, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    } finally {
      ctx.restore(); // SIEMPRE restaura la transformación del MUNDO (cámara + sacudida)
    }
    // A partir de aquí: capa de UI SIN transformar (pegada al viewport real): badge de
    // racha, bordes, monto, temporizador y medidor v41-fps → tamaño normal, sin cámara.

    // BADGE del multiplicador de racha: "×N" prominente arriba-centro (UI: NO se
    // transforma con la cámara). Solo cuando el multiplicador supera ×1 (racha ≥ 3).
    const mult = P.multRacha(marcador.racha);
    if (mult > 1) {
      const now = performance.now();
      ctx.save();
      ctx.translate(W / 2, Math.max(158, H * 0.16)); // bajo la banda del temporizador
      ctx.scale(1 + 0.06 * Math.sin(now / 150), 1 + 0.06 * Math.sin(now / 150));
      ctx.font = '800 ' + (26 + Math.min(20, marcador.racha)) + 'px ' + COLOR.fuente;
      const txtMult = '×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1));
      haloTexto(txtMult, 0, 0, ACENTO.vivo, 5); // halo barato en lugar de shadowBlur 12
      ctx.fillStyle = ACENTO.vivo;
      ctx.fillText(txtMult, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Aviso sutil de inactividad (cobrando): puntos "· · ·" (UI, sin cámara).
    if (cobrando) {
      ctx.globalAlpha = 0.22 + 0.13 * Math.sin(performance.now() / 300);
      ctx.fillStyle = COLOR.textoApagado;
      ctx.font = '400 15px ' + COLOR.fuente;
      ctx.fillText('· · ·', W / 2, H - 64);
      ctx.globalAlpha = 1;
    }

    // ── PÉRDIDA: palpitar de bordes laterales + monto agregado (fuera de la
    // sacudida: pegado al viewport). Coste barato: dos gradientes lineales + un
    // fillText, y SOLO durante la ventana del pulso. Rojos literales (feedback).
    const nowP = performance.now();
    const dtP = nowP - perdidaInicio;
    if (dtP >= 0 && dtP < PULSO_ENTRADA + PULSO_DISIP) {
      const env = dtP < PULSO_ENTRADA ? dtP / PULSO_ENTRADA : Math.max(0, 1 - (dtP - PULSO_ENTRADA) / PULSO_DISIP);
      ctx.save();
      ctx.globalAlpha = 0.6 * env;
      ctx.fillStyle = gradBordeIzq; ctx.fillRect(0, 0, FRANJA_PX, H);       // gradiente cacheado
      ctx.fillStyle = gradBordeDer; ctx.fillRect(W - FRANJA_PX, 0, FRANJA_PX, H);
      ctx.restore();
    }
    // CloudOver: palpitar rojo de bordes (#FF0055, 28px, gradiente CACHEADO de la
    // fase 13 — mismo mecanismo, NO uno nuevo). FASE 15: se dispara desde el GOLPE y
    // acompaña TODA la secuencia (impacto→vaciado→cero) hasta el overlay. Pulso
    // sinusoidal continuo, SIN el monto pequeño. Se dibuja en la capa de UI (sin cámara).
    if (secuencia) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.28 * Math.abs(Math.sin(nowP / 130)); // palpitar
      ctx.fillStyle = gradBordeIzq; ctx.fillRect(0, 0, FRANJA_PX, H);       // mismo gradiente cacheado
      ctx.fillStyle = gradBordeDer; ctx.fillRect(W - FRANJA_PX, 0, FRANJA_PX, H);
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

    // TEMPORIZADOR (modo 60 seg): cuenta regresiva "M:SS" GRANDE top-center, en su
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
      ctx.font = '800 32px ' + COLOR.fuente;
      const colTimer = urgente ? ROJO_BORDE : ACENTO.claro;
      haloTexto(txt, 0, 0, colTimer, 5); // halo barato en lugar de shadowBlur 8
      ctx.fillStyle = colTimer;
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }

    // (FASE 16) El recuadro del medidor v41-fps se ELIMINÓ: sus cifras (F, D, peor,
    // conteos) ahora caen como líneas de la CASCADA, como cualquier otro dato real.
    ultimoDibujoMs = performance.now() - _dib0; // (debug v41-fps) duración total del dibujo
  }

  // Estela METEORO: UNA cola continua (no fantasmas). Un solo path con dos bordes
  // que convergen a la punta, relleno UNA vez con el gradiente cacheado gradEstela
  // (cabeza 45% → punta 0). Sin shadowBlur, sin crear gradientes en el bucle
  // (ley fase 13). 1 fill por bola ≤ los 3 arcos que reemplaza. `estelaMeteoro`
  // (puro) da el esqueleto y descarta colas degeneradas (bola quieta/agarrada).
  function dibujarEstela(b, radio) {
    const e = U.estelaMeteoro(b.x, b.y, b.historia, radio, ESTELA_PUNTOS);
    if (!e) return; // sin recorrido → no se dibuja (evita segmentos degenerados)
    const pts = e.pts;
    const n = pts.length;
    const tail = pts[n - 1];
    const ang = Math.atan2(b.y - tail.y, b.x - tail.x); // +X local = dirección del vuelo
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    ctx.beginPath();
    // Borde izquierdo cabeza→punta (offset local +Y por semiancho), luego derecho punta→cabeza.
    for (let i = 0; i < n; i++) {
      const rx = pts[i].x - b.x, ry = pts[i].y - b.y;
      const lx = rx * cosA + ry * sinA, ly = -rx * sinA + ry * cosA; // rotación por −ang
      if (i === 0) ctx.moveTo(lx, ly + pts[i].w); else ctx.lineTo(lx, ly + pts[i].w);
    }
    for (let i = n - 1; i >= 0; i--) {
      const rx = pts[i].x - b.x, ry = pts[i].y - b.y;
      const lx = rx * cosA + ry * sinA, ly = -rx * sinA + ry * cosA;
      ctx.lineTo(lx, ly - pts[i].w);
    }
    ctx.closePath();
    ctx.fillStyle = gradEstela; // cacheado (cabeza→punta), sigue el vuelo por el rotate
    ctx.fill();
    ctx.restore();
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
  // estable; el único que parpadea es el CloudOver). `glow` añade un HALO BARATO
  // (aura viva) SIN shadowBlur: dos arcos concéntricos del mismo color a baja
  // alfa detrás del disco (r+6 al 18%, r+3 al 30%). El shadowBlur en iPhone
  // recalcula un blur offscreen por dibujo × dpr → se elimina del bucle.
  function dibujarBolita(cx, cy, radio, color, glow) {
    const RADIO = radio || 14;
    ctx.save();
    if (glow) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(cx, cy, RADIO + 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.30; ctx.beginPath(); ctx.arc(cx, cy, RADIO + 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, RADIO - 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = RADIO < 14 ? 2 : 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  // Halo de TEXTO barato (sin blur): un trazo del mismo color a baja alfa detrás
  // del relleno. Sustituye al shadowBlur en el temporizador, el badge y los
  // flotantes grandes. Requiere el font/textAlign ya seteados por el llamador;
  // respeta el globalAlpha vigente (para que el fade del flotante también aplique).
  function haloTexto(txt, x, y, color, ancho) {
    const a = ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = a * 0.35;
    ctx.lineWidth = ancho || 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.strokeText(txt, x, y);
    ctx.restore();
  }

  // Desktop: marca el <html> para ocultar el hitmaker y el cursor del sistema
  // (la mira lo reemplaza). Móvil: todo queda como estaba.
  if (esDesktop) document.documentElement.classList.add('desktop');

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  actualizarRecord();    // récord del modo por defecto (60 seg) hasta elegir
  marcarActividad();     // inicia el reloj de inactividad (evita cobro al arrancar)
  escalada = P.crearEscalada(performance.now(), Math.random); // estado inicial válido
  mostrarPantallaInicio(); // FASE 19: pantalla de bienvenida (título + récord + JUGAR)
  arrancarBucle();       // el bucle corre (congelado hasta tocar JUGAR)

  if ('serviceWorker' in navigator) {
    // AUTO-ACTUALIZACIÓN: cuando un SW NUEVO toma el control (tras skipWaiting +
    // clients.claim), recargamos UNA vez para servir el código fresco. Sin esto,
    // la página seguía corriendo el JS viejo cacheado (parecía que nada cambiaba).
    // Guarda: sólo recarga si YA había un SW controlando (actualización, no la
    // primera instalación) y una sola vez.
    const habiaControlador = !!navigator.serviceWorker.controller;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!habiaControlador || recargando) return;
      recargando = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('sw.js');
  }
})();
