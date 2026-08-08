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
  const S = window.ShotClaud;   // reglas de puntuación de ShotClaud (módulo puro aparte)
  const PU = window.Pushcloude; // reglas de puntuación y ciclo de metas de Pushcloude (módulo puro)
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
  // Color del PUNTAJE de la barra (rediseño): blanco puro, el dato dominante (P1/1.1).
  // Lee el token --blanco con respaldo literal (blindaje si el CSS llega stale).
  const PUNTAJE_BLANCO = tk('--blanco', '#FFFFFF');

  // Marcador (puntuación por demolición) + su celda en la barra superior.
  const marcador = P.crearMarcador();
  const ritmo = P.crearRitmo();
  const elActual = document.getElementById('barraActual');
  function actualizarMarcador() { elActual.textContent = U.abreviarNumero(marcador.puntos); }
  // TEMPORIZADOR en la barra (centro, bajo el puntaje). Antes se dibujaba en el canvas y
  // El CONTADOR es una MARCA DE AGUA en el canvas (dibujarContadorTiempo): enorme, blanca y
  // translúcida, DETRÁS de todo, centrada en el área de juego (ya no vive en la barra, 1.5).
  // "M:SS", cifras de ancho fijo. Últimos 5 s: rojo + latido, ahora en el canvas (1.7).
  let tiempoUrgente = false;
  function fmtTiempo(ms) {
    const seg = Math.ceil(Math.max(0, ms) / 1000);
    return Math.floor(seg / 60) + ':' + (seg % 60 < 10 ? '0' + (seg % 60) : seg % 60);
  }
  // El CONTADOR se DIBUJA en el canvas (marca de agua, dibujarContadorTiempo). Aquí sólo se
  // mantiene el ESTADO de urgencia (últimos 5 s) que ese dibujo lee. La LÓGICA del tiempo NO
  // cambia (1.8): el reloj sigue corriendo en el bucle y termina por tiempo igual que antes.
  function actualizarTiempo() {
    if (!jugando || !DURACIONES[modoJuego]) { tiempoUrgente = false; return; } // fuera de partida: sin urgencia
    tiempoUrgente = tiempoRestante <= 5000; // 1.7: últimos 5 segundos
  }

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
  // ── LOS JUEGOS (FUENTE ÚNICA DE VERDAD) ─────────────────────────────────────────────
  // Aquí y SÓLO aquí se declara qué juegos hay, sus duraciones, si son jugables y en qué
  // plataforma. El menú de juegos, el selector de duración, los récords y el ranking se
  // generan desde esto — nada de listas duplicadas por el código.
  //   plataforma: 'ambas' | 'escritorio' | 'tactil' (dónde tiene sentido jugarlo).
  // PARA AGREGAR UN JUEGO: añade una entrada con su id, nombre, descripción, jugable,
  // plataforma y duraciones. Cuando su mecánica exista, pon jugable:true. Todo lo demás
  // (pantallas, récords versionados, tablas de ranking) aparece solo.
  const JUEGOS = [
    // CAMBIO 1: `nombre` es el TEXTO VISIBLE (Hitcloude/Shotcloude/Pushcloude). `id` NO cambia
    // ('hitclaud'/'shotclaud'/'pushclaud'): es el identificador interno, las llaves de persistencia
    // y el modo que espera el servidor de ranking. Cambiar el id rompería el ranking en producción.
    { id: 'hitclaud',  nombre: 'Hitcloude',  desc: 'Lanza la bola y demuele', jugable: true,  plataforma: 'tactil',     duraciones: ['15', '60'] },
    { id: 'shotclaud', nombre: 'Shotcloude', desc: 'Apunta y dispara',        jugable: true,  plataforma: 'escritorio', duraciones: ['20', '60'] },
    // v2.9: Pushcloude ya tiene mecánica (aplastar). jugable:true, PERO disponibilidad() lo cierra
    // tras el ACCESO ANTICIPADO (9.1) y a la plataforma táctil (9.3). Duraciones 60 y 180 (9.2: la de
    // 15 ya no existe en Pushcloude). El id 'pushclaud' NO cambia (llaves/servidor).
    { id: 'pushclaud', nombre: 'Pushcloude', desc: 'Aplasta con el dedo',     jugable: true,  plataforma: 'tactil',     duraciones: ['60', '180'] },
  ];
  function juegoPorId(id) { for (let i = 0; i < JUEGOS.length; i++) if (JUEGOS[i].id === id) return JUEGOS[i]; return null; }
  // DISPONIBILIDAD por plataforma, DERIVADA de la estructura de JUEGOS (fuente única, no
  // repartida por el código — CAMBIO 5.5). En COMPUTADORA sólo se ofrece ShotClaud; en
  // TÁCTIL, HitClaud y PushClaud. Devuelve { jugable, aviso, pronto }:
  //   · fuera de su plataforma → jugable:false, aviso 'Disponible en computadora'/'…en móvil'.
  //   · en su plataforma pero aún no terminado (PushClaud) → jugable:false, aviso 'Pronto'.
  //   · en su plataforma y terminado → jugable:true, sin aviso.
  // El aviso de plataforma y el de "Pronto" son cosas DISTINTAS (5.4): un juego no
  // disponible por plataforma NO dice "Pronto".
  function disponibilidad(j, desktop, acceso) {
    // PUSHCLOUDE (v2.9): tiene mecánica (jugable:true) pero es de ACCESO ANTICIPADO. Sin la clave →
    // "Próximamente" (9.1). Con la clave: en escritorio "Disponible en móvil" (táctil, 9.3); en móvil
    // JUGABLE, con `anticipado:true` para mostrar la línea de privilegio (CAMBIO 3.2 del acceso).
    if (j.id === 'pushclaud') {
      if (!acceso) return { jugable: false, pronto: true, anticipado: false, aviso: 'Pronto' };
      if (desktop) return { jugable: false, pronto: false, anticipado: false, aviso: 'Disponible en móvil' };
      return { jugable: true, pronto: false, anticipado: true, aviso: null };
    }
    // "Pronto" manda sobre la plataforma: un juego sin mecánica está "Próximamente" en cualquier lado.
    if (!j.jugable) return { jugable: false, pronto: true, anticipado: false, aviso: 'Pronto' };
    const enPlataforma = j.plataforma === 'ambas'
      || (j.plataforma === 'escritorio' && desktop)
      || (j.plataforma === 'tactil' && !desktop);
    if (!enPlataforma) {
      return { jugable: false, pronto: false, anticipado: false, aviso: j.plataforma === 'escritorio' ? 'Disponible en computadora' : 'Disponible en móvil' };
    }
    return { jugable: true, pronto: false, anticipado: false, aviso: null };
  }
  const duracionMs = function (dur) { return Number(dur) * 1000; }; // 15→15000, 20→20000, 60→60000
  // Mapa duración→ms DERIVADO de JUEGOS (sin lista aparte). El bucle/temporizador lo leen.
  const DURACIONES = (function () { const d = {}; JUEGOS.forEach(function (j) { j.duraciones.forEach(function (x) { d[x] = duracionMs(x); }); }); return d; })();

  // ── RÉCORDS por JUEGO + DURACIÓN (CAMBIO 2) ─────────────────────────────────────────
  // Llave NUEVA versionada: 'hitclaud.record.v4.<juego>.<duración>'. Mismo patrón que los
  // resets anteriores (no se borran las viejas). MIGRACIÓN: HitClaud 15 y 60 se copian desde
  // las v3 (el jugador no pierde esos). El modo 30 (v3.30) NO se migra: queda HUÉRFANO.
  // LLAVES HUÉRFANAS (intactas, nunca se leen ni se borran): 'hitclaud.record.v3.30' (modo 30
  // abandonado), y las v2.* / v2.libre de resets previos. El nombre no se toca (2.4).
  const REC_VER = 'hitclaud.record.v4';
  function llaveRecord(juego, dur) { return REC_VER + '.' + juego + '.' + dur; }
  function migrarLocal(vieja, nueva) { // copia one-time el récord viejo a la llave nueva
    try {
      if (!almacen || almacen.getItem(nueva) != null) return; // ya hay valor nuevo → no pisar
      const v = almacen.getItem(vieja);
      if (v != null) almacen.setItem(nueva, v);
    } catch (e) { /* almacén roto: se arranca en 0, no rompe */ }
  }
  migrarLocal('hitclaud.record.v3.15', llaveRecord('hitclaud', '15')); // 2.3
  migrarLocal('hitclaud.record.v3.60', llaveRecord('hitclaud', '60')); // 2.3
  // (hitclaud.record.v3.30 NO se migra — modo 30 abandonado, 2.2.)
  const recordStores = {}; // 'juego:duración' → persistencia
  JUEGOS.forEach(function (j) { j.duraciones.forEach(function (dur) {
    recordStores[j.id + ':' + dur] = U.crearPersistencia(almacen, idbKV, llaveRecord(j.id, dur), 500);
  }); });
  function recordDe(juego, dur) { return recordStores[juego + ':' + dur] || null; }
  let juegoActivo = 'hitclaud';   // juego de la PARTIDA en curso
  let juegoSel = 'hitclaud';      // juego del HOME actual (nivel único)
  let modoInicioSel = '15';       // duración elegida en el home (arranca en la más corta de HitClaud)
  let record = recordDe('hitclaud', '60'); // récord de la PARTIDA activa (se fija al iniciar)
  const elRecord = document.getElementById('barraRecord');
  const elBarraIcono = document.getElementById('barraRecordIcono'); // corona ↔ medalla (CAMBIO 4)
  const elBarraPuesto = document.getElementById('barraPuesto');     // "#N" del ranking (CAMBIO 4)
  function actualizarRecord() { elRecord.textContent = U.abreviarNumero(record ? record.valor : 0); }
  // RECONCILIACIÓN al arrancar (async): funde localStorage e IndexedDB por cada récord.
  Object.keys(recordStores).forEach(function (k) {
    recordStores[k].reconciliar().then(function () { if (recordStores[k] === record) actualizarRecord(); actualizarRecordDuracion(); });
  });

  // ── NOMBRE DE USUARIO (FASE 21): se pide UNA vez, se guarda en doble almacén
  // (fase 10) y se muestra en la barra. Local hoy; cobrará sentido con el ranking
  // global futuro (no se construye nada de red acá). Llave: hitclaud.nombre.v2.
  const NOMBRE_KEY = 'hitclaud.nombre.v2';
  const nombreStore = U.crearTextoPersistente(almacen, idbKV, NOMBRE_KEY);
  let nombreUsuario = nombreStore.valor;               // lectura síncrona inicial
  const puedeGuardarNombre = !!(almacen || idbKV);     // si no hay almacén → jugar sin nombre

  // ── ACCESO ANTICIPADO (v2.8): desbloquea Pushcloude para quien tenga la clave ──────────────
  // Se guarda SÓLO una marca ('1'), NUNCA la clave (1.8), con el MISMO patrón best-effort de doble
  // almacén (localStorage + IndexedDB) en try/catch: si el almacén falla, se juega sin guardar y sin
  // romper (1.7). La clave vive sólo en memoria y se compara en tiempo (casi) constante (1.4).
  const ACCESO_KEY = 'hitclaud.acceso.v1';
  const accesoStore = U.crearTextoPersistente(almacen, idbKV, ACCESO_KEY);
  let accesoAnticipado = accesoStore.valor === '1';    // lectura síncrona inicial
  const ACCESO_CLAVE = 'Santi28082014';                // distingue mayúsculas/minúsculas (1.4)
  // Compara en tiempo (casi) constante: NO corta en el primer carácter distinto; el largo se pliega
  // en el acumulador para no filtrarlo. Devuelve true sólo si coincide exactamente (1.4).
  function claveOk(intento) {
    const b = String(intento == null ? '' : intento);
    let dif = ACCESO_CLAVE.length ^ b.length;
    for (let i = 0; i < ACCESO_CLAVE.length; i++) dif |= ACCESO_CLAVE.charCodeAt(i) ^ (b.charCodeAt(i) | 0);
    return dif === 0;
  }
  function concederAcceso() { accesoAnticipado = true;  try { accesoStore.guardar('1'); } catch (e) { /* sin guardar, sin romper (1.7) */ } }
  function revocarAcceso()  { accesoAnticipado = false; try { accesoStore.guardar('');  } catch (e) { /* idem */ } }

  // AVISO EMERGENTE RETIRADO (FASE 26): el overlay que mostraba las novedades y toda
  // su lógica (constante de versión + decisión pura) se eliminaron de aquí — nunca era
  // alcanzable (la rama 'mostrar' exigía una versión previa guardada, imposible porque
  // la llave nació con la primera versión). Lo reemplaza la PANTALLA DE ACTUALIZACIONES
  // (bitacora.js). La llave 'hitclaud.novedades.v1' queda HUÉRFANA en el almacén (como
  // 'hitclaud.record.v2.libre'): NO se lee ni se escribe, y NO se borra (persistencia
  // sellada). La función pura de decisión sigue viva en util.js como código muerto.
  // SALUDO del inicio (reemplaza al nombre que flotaba en la barra, D2/1.6). Muestra
  // "Hola, <nombre>" o "Ponte un nombre" si no hay. Blindado: nunca rompe el arranque.
  const elSaludo = document.getElementById('iniSaludoTexto');
  function actualizarSaludo() {
    try { if (elSaludo) elSaludo.textContent = nombreUsuario ? ('Hola, ' + nombreUsuario) : 'Ponte un nombre'; } catch (e) { /* nunca rompe */ }
  }

  // ── Modo de juego + ciclo de partida ───────────────────────────────
  // OVERLAY de fin/selección: elegís la duración (15/30/60 seg); aparece al terminar
  // una partida. Corre una cuenta regresiva y al llegar a 0 termina por tiempo.
  const elGameOver = document.getElementById('gameover');
  let finDatos = null; // datos de la última partida terminada, para "Compartir" (tarjeta de récord)
  // (DURACIONES vive arriba, DERIVADO de JUEGOS — no se declara otra vez acá.)
  // Contadores de la PARTIDA para el registro ANÓNIMO en el servidor (js/ranking.js).
  // Se reinician con cada partida. tiros = bolas lanzadas; aciertos = las que golpearon
  // algo; rachaMax = racha más alta; carambolas = bonos de carambola cobrados; pPuntosFin
  // = puntaje al morir por CloudOver (el score se vacía a 0, así que se captura aparte).
  let pTiros = 0, pAciertos = 0, pRachaMax = 0, pCarambolas = 0, pPuntosFin = 0;
  function reiniciarEstado() {
    marcador.puntos = 0; marcador.racha = 0;
    marcador.rachaPos = 0; marcador.rachaNeg = 0;   // rachas de ShotClaud (HitClaud las ignora)
    miraDisparoEn = -Infinity; miraFlashEn = -Infinity; miraFlashCentro = false;
    pTiros = 0; pAciertos = 0; pRachaMax = 0; pCarambolas = 0; pPuntosFin = 0;
    targets.length = 0; bolitas.length = 0; cubos.length = 0; flotantes.length = 0; bonos.length = 0; disparos.length = 0; multAnterior = 1;
    ultimoDisparo = -Infinity; gesto.activo = false; marcadorPopHasta = 0; secuencia = null; sacudidaCloudover = null;
    pushReset = null; pushCicloBase = 0; pushCicloRestante = (PU ? PU.CICLO_MS : 15000); pushCicloCumplido = false; // ciclo de metas de Pushcloude
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
  // Arranca una partida de `juego` (solo jugables) en la duración `modo`. HitClaud 15/60
  // se juega EXACTAMENTE igual que antes (misma física, reloj y récord por duración).
  function iniciarPartida(juego, modo) {
    const j = juegoPorId(juego);
    if (!j || !j.jugable || j.duraciones.indexOf(String(modo)) === -1) return; // sólo combos válidos y jugables
    if (!disponibilidad(j, esDesktop, accesoAnticipado).jugable) return; // gate real (Pushcloude exige acceso+móvil, 9.1/9.3)
    juegoActivo = juego; modoInicioSel = modo; juegoSel = juego;
    modoJuego = modo;
    record = recordDe(juego, modo) || recordDe('hitclaud', '60'); // récord de ese juego+duración
    actualizarRecord();
    if (botonStop) botonStop.classList.toggle('oculto', juego !== 'pushclaud'); // stop SÓLO en Pushcloude (7.1)
    actualizarMedallaBarra(); // CAMBIO 4: corona ya; medalla/puesto si está en el ranking (no espera a la red)
    reiniciarEstado();
    tiempoRestante = DURACIONES[modo] || 0;      // 15→15000, 60→60000
    jugando = true;
    actualizarTiempo();                          // muestra el tiempo completo desde el arranque
    elGameOver.classList.add('oculto');
    if (elDuracion) elDuracion.classList.add('oculto'); // cierra el home
    if (elRanking) elRanking.classList.add('oculto'); // D2: al arrancar desde el ranking, cerrar su overlay (si no, tapa el juego)
    cascEvento('iniciarPartida', 'juego:' + juego + ' modo:' + modo);
  }
  // Fin de partida. `porTiempo`=true → cierre por AGOTARSE EL TIEMPO: el récord
  // sube si el score lo supera. `porTiempo`=false → cierre por CLOUDOVER: el score
  // se vacía (ultimoScore=0) y el récord queda INTACTO aunque el score lo superara
  // (regla dura del dueño: el CloudOver cuesta la partida entera). ÚNICO punto de
  // escritura del récord. Persiste los dos datos en ambos almacenes y muestra el overlay.
  function terminarPartida(porTiempo) {
    if (!jugando) return;
    jugando = false;
    actualizarTiempo(); // fuera de partida → limpia el temporizador de la barra
    const ahora = performance.now();
    // CAMBIO 1 (bug del récord de ShotClaud): ShotClaud es un ENTRENADOR de puntería y sus
    // corridas TERMINAN casi siempre por CloudOver (al dispararle a un rojo), no por tiempo.
    // Antes el récord sólo subía por TIEMPO (regla dura de HitClaud: el CloudOver cuesta la
    // partida entera), así que ShotClaud nunca guardaba récord. AHORA, en ShotClaud, la
    // corrida SUBE RÉCORD también por CloudOver, con el puntaje de ANTES del vaciado
    // (pPuntosFin, capturado en golpeCloudover). HitClaud NO cambia: su CloudOver sigue sin
    // guardar. Mismo ESQUEMA de llaves (juego+duración) para ambos; sólo cambia CUÁNDO cuenta.
    const shotCloud = esShot() && !porTiempo;            // ShotClaud terminado por CloudOver
    const cuentaRecord = porTiempo || shotCloud;         // ¿esta corrida sube récord?
    const puntajeRun = porTiempo ? marcador.puntos : pPuntosFin; // puntaje real de la corrida
    // superaRecord ANTES de escribir (record.valor es el récord viejo).
    const superaRecord = puntajeRun >= record.valor && puntajeRun > 0;
    const esRecord = cuentaRecord && superaRecord;
    const scoreFinal = cuentaRecord ? puntajeRun : 0; // HitClaud por CloudOver sigue mostrando 0
    // RÉCORD LOCAL: se guarda como siempre, ANTES y con independencia del envío (sellado).
    record.terminar(scoreFinal, ahora, cuentaRecord);
    actualizarRecord();
    pintarFin(scoreFinal, esRecord);
    // ── SERVIDOR (segundo plano, blindado: la red JAMÁS bloquea ni rompe el fin) ──
    try { enviarAlServidor(porTiempo); } catch (e) { /* un fallo de red no llega al juego */ }
    cascEvento('terminarPartida', 'porTiempo:' + !!porTiempo + ' score:' + scoreFinal);
  }
  // MODO para el SERVIDOR (CAMBIO 6.3). El servidor de ranking HOY sólo acepta '15','30','60'
  // y RECHAZA cualquier otra cosa. Para HitClaud mandamos la duración pelada ('15'/'60'), que
  // YA funciona. Para juegos FUTUROS el formato es '<juego>:<duración>' (p.ej. 'shotclaud:20'):
  // el código queda listo, pero NO funcionará hasta que el servidor lo acepte.
  //   FALTA DEL LADO DEL SERVIDOR (lo dictará Pat en otro prompt): aceptar/validar/almacenar
  //   modos con prefijo de juego ('shotclaud:20', 'shotclaud:60', 'pushclaud:15').
  // Como sólo HitClaud es jugable hoy, en la práctica siempre se manda '15' o '60'.
  function modoServidor(juego, dur) { return juego === 'hitclaud' ? String(dur) : (juego + ':' + String(dur)); }
  // Manda al servidor de ranking, todo en segundo plano (ranking.js no espera nada).
  //  · /partida SIEMPRE (anónimo, coherente): por tiempo o por CloudOver.
  //  · /score SIEMPRE que la partida terminó por TIEMPO y haya nombre (supere o no el
  //    récord local: el servidor decide si entra al top 20). Por CloudOver no se manda.
  function enviarAlServidor(porTiempo) {
    if (typeof Ranking === 'undefined') return;          // sin el módulo, el juego sigue igual
    // CAMBIO 9.5 — PUSHCLOUDE: envío INACTIVO por ahora. El servidor sólo acepta 'pushclaud:15' y este
    // juego usa 60/180. FALTA DEL LADO DEL SERVIDOR (~/Proyectos/hitclaud-ranking, otro prompt): aceptar/
    // validar/almacenar 'pushclaud:60' y 'pushclaud:180'. Hasta entonces NO se manda ni /score ni
    // /partida (su tabla arranca limpia el día que abra, 3.6). El récord LOCAL sí se guarda (9.4).
    if (esPush()) return;
    const modo = modoJuego;
    // MODO DEL SERVIDOR: HitClaud manda la duración PELADA ('15'/'60') — sus tablas dependen de
    // eso, no se toca. ShotClaud manda con prefijo de juego ('shotclaud:20'/'shotclaud:60').
    const modoSrv = modoServidor(juegoActivo, modo);
    if (!DURACIONES[modo]) return;
    // duración REAL jugada = duración del modo − lo que quedó (clamp 0..duración del modo).
    const dur = Math.round(Math.max(0, Math.min(DURACIONES[modo], DURACIONES[modo] - Math.max(0, tiempoRestante))));
    // puntaje de la partida: por tiempo = score final; por CloudOver = el que tenía al morir.
    const puntosPartida = porTiempo ? marcador.puntos : pPuntosFin;
    // EFECTIVIDAD: SÓLO ShotClaud la manda (aciertos/disparos, 0..100). HitClaud NUNCA (punto 4).
    const efc = esShot() ? efectividadPct(pAciertos, pTiros) : null;
    const datos = {
      modo: modoSrv, puntos: puntosPartida, duracionReal: dur,
      termino: porTiempo ? 'tiempo' : 'cloudover',
      tiros: pTiros, aciertos: pAciertos, rachaMax: pRachaMax, carambolas: pCarambolas,
      plataforma: esDesktop ? 'escritorio' : 'movil',
    };
    if (efc !== null) datos.efectividad = efc;
    Ranking.enviarPartida(Ranking.armarDatosPartida(datos));
    // /score: HitClaud SÓLO por tiempo (su regla dura: el CloudOver cuesta la partida). ShotClaud
    // manda SIEMPRE — como casi siempre muere por rojo, su récord cuenta el CloudOver (punto 6),
    // con el puntaje de la corrida (pPuntosFin). Se resuelve el nombre y, si entró, se avisa.
    if (porTiempo || esShot()) {
      const puntosScore = puntosPartida;
      resolverNombre(function (nombre) {
        const envio = { nombre: nombre, puntos: puntosScore, modo: modoSrv, porTiempo: porTiempo, permiteCloudover: esShot() };
        if (efc !== null) envio.efectividad = efc;
        Ranking.enviarPuntaje(envio)
          .then(function (reg) { if (reg && reg.estado === 'ok' && reg.entro) mostrarConfirmacionRanking(reg.posicion); });
      });
    }
  }
  // SALIR / ABANDONAR (1.3): termina la partida AL INSTANTE y vuelve al inicio. Es el
  // comportamiento original "presionas inicio y pierdes": NO guarda récord y NO manda el
  // puntaje al ranking (no se llama record.terminar ni se envía /score). SÍ registra la
  // partida en estadísticas con termino 'cloudover' — el abandono cuenta como una caída
  // (no terminó por tiempo), igual que el CloudOver a efectos del resumen anónimo.
  // El botón de casa SUBE UN NIVEL (CAMBIO 5): abandona la partida y vuelve a la PANTALLA 2
  // (elegir duración) DEL JUEGO que se estaba jugando — no a la pantalla 1. NO guarda récord
  // ni manda /score; SÍ registra la partida en stats con termino 'cloudover'.
  function abandonarPartida() {
    if (!jugando) { mostrarHome(juegoActivo, false); return; } // sin partida → a la pantalla 2
    jugando = false;
    actualizarTiempo();                 // limpia el temporizador
    pPuntosFin = marcador.puntos;        // puntaje al abandonar → /partida (stats)
    secuencia = null; sacudidaCloudover = null;
    try { enviarAlServidor(false); } catch (e) { /* la red nunca rompe el abandono */ }
    cascEvento('abandonarPartida', 'score:' + pPuntosFin);
    mostrarHome(juegoActivo, false); // sube UN nivel (pantalla 2 del juego)
  }
  // Resuelve el nombre más fiable SIN esperar a la red: memoria → localStorage (síncrono)
  // → reconciliar IDB (local, no es red) si sigue vacío. Adopta el nombre si aparece.
  function resolverNombre(cb) {
    const n = ((nombreUsuario || '').trim()) || ((nombreStore.valor || '').trim());
    if (n) { cb(n); return; }
    try {
      nombreStore.reconciliar().then(function (v) {
        const nn = (((v || '') + '') || (nombreStore.valor || '')).trim();
        if (nn && !nombreUsuario) { nombreUsuario = nn; actualizarSaludo(); }
        cb(nn);
      }, function () { cb(''); });
    } catch (e) { cb(''); }
  }
  // Confirmación al jugador: SÓLO si entró al ranking Y el overlay de fin sigue visible.
  function mostrarConfirmacionRanking(posicion) {
    if (!elGameOver || elGameOver.classList.contains('oculto')) return; // el fin ya se cerró
    const el = elGameOver.querySelector('.go-rank');
    if (!el) return;
    el.textContent = '¡Entraste al ranking! Puesto ' + posicion;
    el.classList.remove('oculto');
  }
  // Pinta el fin de partida (CAMBIO 4). Orden: puntaje, récord (corona), puesto de ranking.
  // "Cambiar duración" sólo aparece si el juego tiene más de una duración (4.5).
  function pintarFin(score, esRecord) {
    elGameOver.querySelector('.go-score').classList.remove('oculto');
    elGameOver.querySelector('.go-score .valor').textContent = U.abreviarNumero(score);
    elGameOver.querySelector('.go-record').classList.toggle('oculto', !esRecord);
    // CAMBIO 5.7 — efectividad junto al puntaje: SÓLO ShotClaud. HitClaud la deja oculta.
    const prec = elGameOver.querySelector('.go-precision');
    if (prec) {
      const pct = esShot() ? efectividadPct(pAciertos, pTiros) : null;
      prec.classList.toggle('oculto', pct === null);
      if (pct !== null) { const sp = document.getElementById('finPrecision'); if (sp) sp.textContent = pct + '%'; }
    }
    const gr = elGameOver.querySelector('.go-rank');
    if (gr) gr.classList.add('oculto'); // se muestra sólo si el envío confirma que entró
    const j = juegoPorId(juegoActivo);
    const unaSola = !j || j.duraciones.length <= 1;
    if (btnFinCambiar) btnFinCambiar.classList.toggle('oculto', unaSola); // 4.5: oculto si una sola
    // Datos para "Compartir" (tarjeta de récord): el puntaje REAL de esta partida, su duración
    // y si fue récord. El nombre se resuelve al momento de compartir (puede llegar por IDB).
    finDatos = { puntos: score, modo: modoJuego, esRecord: !!esRecord };
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
    pPuntosFin = marcador.puntos; // puntaje al morir (antes del vaciado a 0) → /partida
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
  // ── NAVEGACIÓN EN DOS NIVELES (CAMBIO 3) ────────────────────────────────────────────
  // NIVEL ÚNICO: el HOME de cada juego (#duracion). Ya no hay pantalla de selección. Las flechas
  // de la fila superior CICLAN entre juegos (no salen). El home muestra el cuerpo jugable o, si el
  // juego no está disponible/terminado, su imagen y leyenda. Toda pantalla tiene salida.
  const elDuracion = document.getElementById('duracion');
  const elHomeJugable = document.getElementById('homeJugable');
  const elHomeNoJugable = document.getElementById('homeNoJugable');
  const elHomeEstado = document.getElementById('homeEstado'); // línea de estado del home apagado (CAMBIO 4.2)
  const elHomeAdmin = document.getElementById('homeAdmin');       // distintivo ADMIN junto al saludo (v2.8)
  const elHomeAnticipo = document.getElementById('homeAnticipo'); // línea de acceso anticipado (3.2)
  const elHomePronto = document.getElementById('homePronto');     // aviso "llega pronto" al tocar duración (3.3)
  const elHomeAccesoLink = document.getElementById('homeAccesoLink'); // enlace "¿Tienes acceso?" (1.1)
  const elDurJuego = document.getElementById('durJuego');
  const elDurModos = document.getElementById('durModos');
  const elDurRecord = document.getElementById('durRecord');
  const elDurRecordIcono = document.getElementById('durRecordIcono');
  // Duración MÁS CORTA de un juego (min numérico; robusto ante el orden de la lista).
  function duracionMasCorta(j) { return j.duraciones.slice().sort(function (a, b) { return Number(a) - Number(b); })[0]; }
  // Icono de un puesto: medalla (assets/podio-N.svg) para el 1 al 12; null del 13 en adelante.
  function iconoPuesto(p) { return (typeof p === 'number' && p >= 1 && p <= 12) ? ('assets/podio-' + p + '.svg') : null; }
  // MEJOR puesto (1-based) del jugador en un top ordenado mayor→menor. Por NOMBRE; el PRIMER
  // match ya es el mejor (6.3). null si no está. PURO.
  function mejorPuestoDe(top, nombre) {
    if (!Array.isArray(top) || !nombre) return null;
    for (let i = 0; i < top.length; i++) { if (top[i] && top[i].nombre === nombre) return i + 1; }
    return null;
  }
  // Pinta el icono del récord de la pantalla 2: medalla si `puesto` es 1-12; corona si no.
  let recordIconoToken = 0;
  function ponerIconoRecord(puesto) {
    if (!elDurRecordIcono) return;
    elDurRecordIcono.textContent = '';
    const src = iconoPuesto(puesto);
    if (src) {
      const img = document.createElement('img');
      img.className = 'rec-medalla'; img.src = src; img.alt = 'Puesto ' + puesto; img.setAttribute('aria-hidden', 'true');
      elDurRecordIcono.appendChild(img);
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'icono icono-mini'); svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#ic-corona');
      svg.appendChild(use); elDurRecordIcono.appendChild(svg);
    }
  }
  // CAMBIO 6: corona de INMEDIATO (6.4, no espera a la red) y, si el jugador está entre los 12
  // primeros del ranking de ESE juego+duración, cambia a su medalla al llegar la respuesta.
  // Reutiliza la tabla que el ranking ya trajo si es del mismo contexto (no pide dos veces, 6.5).
  // Un fallo de red deja la corona y no lanza (6.4).
  function actualizarMedallaRecord() {
    ponerIconoRecord(null); // corona ya
    if (typeof Ranking === 'undefined' || juegoSel !== 'hitclaud' || !nombreUsuario) return;
    const juego = juegoSel, dur = modoInicioSel, clave = juego + ':' + dur;
    if (rankTopClave === clave) { const p = mejorPuestoDe(rankTopActual, nombreUsuario); if (p) ponerIconoRecord(p); return; }
    const token = ++recordIconoToken;
    try {
      Ranking.pedirTop(modoServidor(juego, dur)).then(function (res) {
        if (token !== recordIconoToken || juego !== juegoSel || dur !== modoInicioSel) return; // cambió el contexto
        if (res && res.ok) { rankTopActual = res.top || []; rankTopClave = clave; const p = mejorPuestoDe(rankTopActual, nombreUsuario); if (p) ponerIconoRecord(p); }
      }, function () { /* falla → se queda la corona (6.4) */ });
    } catch (e) { /* nunca rompe */ }
  }

  // CAMBIO 4 — la BARRA de juego muestra, junto a la corona y el récord: la MEDALLA si el jugador
  // está entre los 12 primeros (4.1) y su NÚMERO DE PUESTO si está en el top 20; si no está en el
  // ranking, sólo corona + récord. ponerMedallaBarra pinta ese estado a partir del puesto. Reutiliza
  // iconoPuesto (mismo criterio de medalla que el home, 4.2). Discreto, no desborda (4.5): el número
  // hereda el tono tenue y las cifras tabulares del récord (CSS). Puro DOM; no espera a la red.
  function ponerMedallaBarra(puesto) {
    if (elBarraIcono) {
      elBarraIcono.textContent = '';
      const src = iconoPuesto(puesto);       // 1-12 → medalla; si no, corona
      if (src) {
        const img = document.createElement('img');
        img.className = 'rec-medalla'; img.src = src; img.alt = 'Puesto ' + puesto; img.setAttribute('aria-hidden', 'true');
        elBarraIcono.appendChild(img);
      } else {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'icono icono-mini'); svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#ic-corona');
        svg.appendChild(use); elBarraIcono.appendChild(svg);
      }
    }
    if (elBarraPuesto) {
      const enTop = typeof puesto === 'number' && puesto >= 1 && puesto <= 20; // número si top 20
      elBarraPuesto.textContent = enTop ? ('#' + puesto) : '';
      elBarraPuesto.classList.toggle('oculto', !enTop);
    }
  }
  // Pone la corona de INMEDIATO (4.3, el juego NUNCA espera a la red) y, si el jugador está en el
  // ranking de ESE juego+duración, cambia a su medalla/puesto al llegar el dato. Reutiliza el top que
  // el home/ranking ya trajo si es del mismo contexto (4.4, no pide dos veces); si no, lo pide una
  // vez. Un fallo de red deja la corona (4.3) sin lanzar. Vale para HitClaud y ShotClaud (4.6).
  let barraMedallaToken = 0;
  function actualizarMedallaBarra() {
    ponerMedallaBarra(null); // corona ya, sin puesto (no espera a la red, 4.3)
    if (typeof Ranking === 'undefined' || !nombreUsuario) return;
    const juego = juegoActivo, dur = modoJuego, clave = juego + ':' + dur;
    if (!dur) return;
    if (rankTopClave === clave) { ponerMedallaBarra(mejorPuestoDe(rankTopActual, nombreUsuario)); return; } // reusa (4.4)
    const token = ++barraMedallaToken;
    try {
      Ranking.pedirTop(modoServidor(juego, dur)).then(function (res) {
        if (token !== barraMedallaToken || juego !== juegoActivo || dur !== modoJuego) return; // cambió el contexto
        if (res && res.ok) { rankTopActual = res.top || []; rankTopClave = clave; ponerMedallaBarra(mejorPuestoDe(rankTopActual, nombreUsuario)); }
      }, function () { /* falla → se queda la corona (4.3) */ });
    } catch (e) { /* nunca rompe */ }
  }

  // Oculta TODOS los overlays de navegación (para mostrar uno solo). No toca el juego.
  function ocultarNav() {
    [elDuracion, elGameOver, elRanking].forEach(function (el) { if (el) el.classList.add('oculto'); });
  }

  // (Rediseño v2.7) El home NO JUGABLE ya NO dibuja una escena en canvas: muestra la misma
  // estructura del jugable pero APAGADA (CAMBIO 4), con la línea de estado como único encendido.
  // La imagen offscreen y su caché se retiraron; el estado apagado es puro CSS/DOM.

  // ── FLECHAS: ciclo INFINITO entre juegos, en AMBAS direcciones (2.3). El orden es el de JUEGOS
  // (HitClaud, ShotClaud, PushClaud). La flecha IZQUIERDA avanza (Hit→Shot→Push→Hit); la DERECHA
  // retrocede. Nunca se acaba, nunca se apaga una flecha. Al cambiar, la duración vuelve a la más
  // corta de ese juego (4.4).
  const ORDEN_JUEGOS = JUEGOS.map(function (j) { return j.id; });
  function juegoVecino(id, delta) {
    const n = ORDEN_JUEGOS.length;
    const i = ORDEN_JUEGOS.indexOf(id);
    return ORDEN_JUEGOS[(((i < 0 ? 0 : i) + delta) % n + n) % n];
  }

  // HOME — récord del juego (bloque "Record personal"). Muestra el récord de la duración base del
  // juego (modoInicioSel, que el home fija a la más corta): con el rediseño ya NO hay duración
  // seleccionable (CAMBIO 2.3), pero el bloque necesita un número; el de la duración base es el
  // representativo. Cambia al cambiar de juego con las flechas.
  function actualizarRecordDuracion() {
    if (!elDurRecord) return;
    try { const r = recordDe(juegoSel, modoInicioSel); elDurRecord.textContent = U.abreviarNumero(r ? r.valor : 0); }
    catch (e) { elDurRecord.textContent = '0'; }
  }
  // Aviso "llega pronto" (3.3): la mecánica de Pushcloude aún no existe; se avisa con claridad y NO
  // se arranca nada. Inline en el home (que tiene salida por las flechas), sin overlay extra.
  function mostrarPronto() {
    if (!elHomePronto) return;
    elHomePronto.textContent = 'La mecánica de Pushcloude llega pronto ⏳';
    elHomePronto.classList.remove('oculto');
  }
  // CAMBIO 2 — los botones de DURACIÓN SON la acción de jugar: tocar "15 Segundos" arranca una
  // partida de 15 s (ya no hay botón JUGAR ni duración preseleccionada). Uno por duración del juego,
  // apilados. El texto dice la duración completa en palabras (2.4).
  function construirDuraciones() {
    if (!elDurModos) return;
    const j = juegoPorId(juegoSel); if (!j) return;
    elDurModos.textContent = '';
    j.duraciones.forEach(function (dur) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'home-dur';
      b.setAttribute('data-dur', dur);
      b.textContent = dur + ' Segundos';          // "15 Segundos", "60 Segundos" (2.4)
      // Tocar = jugar esa duración (2.2). EXCEPCIÓN (3.3): si la MECÁNICA aún no existe (Pushcloude en
      // acceso anticipado, j.jugable=false), NO se arranca partida — se avisa que llega pronto.
      b.addEventListener('click', function () {
        if (j.jugable) iniciarPartida(juegoSel, dur);
        else mostrarPronto();
      });
      elDurModos.appendChild(b);
    });
  }
  // HOME de `juego` (nivel ÚNICO). `reiniciar`=true fuerza la duración MÁS CORTA; si no, conserva
  // la elegida validándola contra las del juego. Según disponibilidad(): si es JUGABLE muestra el
  // cuerpo encendido (saludo + récord + Ranking + guía + botones de duración + cierre); si NO,
  // muestra el cuerpo APAGADO (misma estructura quemada, CAMBIO 4) con la LÍNEA DE ESTADO como lo
  // único encendido. `data-juego` alimenta el parpadeo por juego (CSS) y `home-apagado` el estado
  // quemado. NADA es pulsable en el apagado salvo las flechas. El nombre va entre las flechas.
  function mostrarHome(juego, reiniciar) {
    const j = juegoPorId(juego); if (!j) return;
    juegoSel = juego;
    if (reiniciar || j.duraciones.indexOf(modoInicioSel) === -1) modoInicioSel = duracionMasCorta(j);
    if (elDurJuego) elDurJuego.textContent = j.nombre;
    const disp = disponibilidad(j, esDesktop, accesoAnticipado);
    if (elDuracion) { elDuracion.classList.toggle('home-apagado', !disp.jugable); elDuracion.setAttribute('data-juego', j.id); }
    if (elHomeJugable) elHomeJugable.classList.toggle('oculto', !disp.jugable);
    if (elHomeNoJugable) elHomeNoJugable.classList.toggle('oculto', disp.jugable);
    // Distintivo ADMIN junto al saludo: en los TRES juegos si hay acceso (2.1). Vive en el cuerpo
    // jugable (el saludo sólo existe encendido). El aviso "llega pronto" se reinicia oculto al re-render.
    if (elHomeAdmin) elHomeAdmin.classList.toggle('oculto', !accesoAnticipado);
    if (elHomePronto) { elHomePronto.classList.add('oculto'); elHomePronto.textContent = ''; }
    // Enlace "¿Tienes acceso?" (1.1): SÓLO en Pushcloude sin acceso (su home apagado "Próximamente").
    if (elHomeAccesoLink) elHomeAccesoLink.classList.toggle('oculto', !(j.id === 'pushclaud' && !accesoAnticipado));
    // Línea de acceso anticipado (3.2): sólo cuando el home está DESBLOQUEADO por acceso (Pushcloude).
    if (elHomeAnticipo) elHomeAnticipo.classList.toggle('oculto', !disp.anticipado);
    if (disp.jugable) {
      actualizarSaludo();                 // "Hola, <nombre>" pulsable (editar nombre)
      construirDuraciones();              // los botones de duración SON la acción de jugar (CAMBIO 2)
      actualizarRecordDuracion();
      actualizarMedallaRecord();          // corona ya; medalla si está en el top 12
    } else {
      // LÍNEA DE ESTADO (4.2): lo único encendido del cuerpo apagado. "Próximamente" (aún no hecho),
      // "Disponible en pc y mac" (juego de escritorio visto en móvil) o "Disponible en móvil" (al revés).
      if (elHomeEstado) elHomeEstado.textContent = disp.pronto
        ? 'Próximamente'
        : (j.plataforma === 'escritorio' ? 'Disponible en pc y mac' : 'Disponible en móvil');
    }
    jugando = false;
    if (botonStop) botonStop.classList.add('oculto'); // el stop sólo vive DURANTE una partida de Pushcloude
    ocultarNav();
    if (elDuracion) elDuracion.classList.remove('oculto');
  }
  // Compatibilidad interna: "ir al inicio" = mostrar el home del juego actual (siempre HitClaud al
  // arrancar). Ya no hay pantalla de selección.
  function mostrarPantallaInicio() { mostrarHome(juegoSel || 'hitclaud', false); }
  // FLECHAS de la fila de navegación: ciclan de juego (reinician a la duración más corta).
  const btnHomeIzq = document.getElementById('homeIzq');
  if (btnHomeIzq) btnHomeIzq.addEventListener('click', function () { mostrarHome(juegoVecino(juegoSel, 1), true); });
  const btnHomeDer = document.getElementById('homeDer');
  if (btnHomeDer) btnHomeDer.addEventListener('click', function () { mostrarHome(juegoVecino(juegoSel, -1), true); });
  const btnDurRanking = document.getElementById('durRanking'); // ranking DE ESE juego, duración seleccionada
  if (btnDurRanking) btnDurRanking.addEventListener('click', function () { abrirRanking(juegoSel, 'duracion'); });
  // (Rediseño v2.7) Ya NO hay botón JUGAR: los botones de duración (construirDuraciones) SON la
  // acción de jugar. El botón JUGAR del RANKING (btnRankJugar) y los del fin de partida siguen igual.

  // ── BOTONES DEL FIN DE PARTIDA (CAMBIO 4) ───────────────────────────────────────────
  const btnFinJugar = document.getElementById('finJugarDeNuevo');   // mismo juego, misma duración (4.4)
  if (btnFinJugar) btnFinJugar.addEventListener('click', function () { iniciarPartida(juegoActivo, modoJuego); });
  const btnFinCambiar = document.getElementById('finCambiarDuracion'); // vuelve a la pantalla 2, conserva la duración (4.5/5.1)
  if (btnFinCambiar) btnFinCambiar.addEventListener('click', function () { mostrarHome(juegoActivo, false); });
  const btnFinMenu = document.getElementById('finMenu');            // "Inicio": vuelve al HOME de ese juego (4.2)
  if (btnFinMenu) btnFinMenu.addEventListener('click', function () { mostrarHome(juegoActivo, false); });

  // ── ENTRADA DE NOMBRE (FASE 21): overlay que se pide UNA sola vez (primera carga).
  // Bloquea el juego hasta tener nombre. Sin autofocus: el teclado se abre al tocar el
  // campo. Validación: trim, 1–8 chars, no vacío. Guardar es best-effort (try/catch):
  // si el almacén falla, se juega igual y se re-pide la próxima vez (no bloquea).
  const elNombre = document.getElementById('nombre');
  const nombreInput = document.getElementById('nombreInput');
  const btnNombreOk = document.getElementById('nombreOk');
  const btnNombreOmitir = document.getElementById('nombreOmitir');
  function mostrarPantallaNombre() {
    if (nombreInput) nombreInput.value = '';
    if (elNombre) elNombre.classList.remove('oculto'); // NO .focus(): teclado bajo demanda
  }
  // EDITAR nombre desde el saludo del inicio (CAMBIO 3): mismo overlay, pero con el nombre
  // ACTUAL ya escrito y seleccionado (listo para reemplazar). Guardar persiste; Cancelar
  // vuelve al inicio sin cambiar nada (omitirNombre). La persistencia no cambia (3.5).
  const elIniSaludo = document.getElementById('iniSaludo');
  function abrirEditarNombre() {
    if (nombreInput) { nombreInput.value = nombreUsuario || ''; try { nombreInput.select(); } catch (e) {} }
    if (elDuracion) elDuracion.classList.add('oculto'); // cierra el home
    if (elNombre) elNombre.classList.remove('oculto'); // NO .focus(): teclado bajo demanda
  }
  if (elIniSaludo) elIniSaludo.addEventListener('click', abrirEditarNombre);
  function confirmarNombre() {
    const v = (nombreInput ? nombreInput.value : '').trim().slice(0, 8);
    if (v.length < 1) return;              // vacío → no avanza (sigue pidiendo)
    nombreUsuario = v;
    try { nombreStore.guardar(v); } catch (e) { /* almacén roto: queda en memoria, se re-pide luego */ }
    actualizarSaludo();
    if (elNombre) elNombre.classList.add('oculto');
    mostrarPantallaInicio();
  }
  // SALIDA DE EMERGENCIA (FASE 22, ley del dueño): "Omitir" entra al juego SIN nombre.
  // Ninguna pantalla puede dejar el juego sin salida — si el campo falla o el almacén
  // está roto, este botón SIEMPRE lleva a jugar. No guarda nada.
  function omitirNombre() {
    if (elNombre) elNombre.classList.add('oculto');
    mostrarPantallaInicio();
  }
  if (btnNombreOk) btnNombreOk.addEventListener('click', confirmarNombre);
  if (btnNombreOmitir) btnNombreOmitir.addEventListener('click', omitirNombre);
  if (nombreInput) nombreInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmarNombre(); }
  });

  // ── PUERTA DE ACCESO ANTICIPADO (v2.8) ─────────────────────────────────────────────────────
  // Overlay con salida (Cerrar → home). Clave correcta → concede acceso y refresca el home ya
  // desbloqueado (1.5); incorrecta → aviso claro, campo listo para reintentar, sin límite (1.6).
  // CAMBIO 4: si ya hay acceso, aparece "Salir del acceso anticipado" (revoca) — también se abre
  // este overlay tocando el distintivo ADMIN. NO se guarda la clave (1.8), sólo la marca de acceso.
  const elAcceso = document.getElementById('acceso');
  const accesoInput = document.getElementById('accesoInput');
  const accesoError = document.getElementById('accesoError');
  const btnAccesoOk = document.getElementById('accesoOk');
  const btnAccesoSalir = document.getElementById('accesoSalir');
  const btnAccesoCerrar = document.getElementById('accesoCerrar');
  function abrirAcceso() {
    if (accesoInput) accesoInput.value = '';
    if (accesoError) accesoError.classList.add('oculto');
    if (btnAccesoSalir) btnAccesoSalir.classList.toggle('oculto', !accesoAnticipado); // "Salir" sólo si ya hay acceso (4.2)
    if (elDuracion) elDuracion.classList.add('oculto'); // cierra el home mientras se pide la clave
    if (elAcceso) elAcceso.classList.remove('oculto');  // NO .focus(): teclado bajo demanda
  }
  function cerrarAcceso() { if (elAcceso) elAcceso.classList.add('oculto'); mostrarHome(juegoSel || 'pushclaud', false); }
  function intentarAcceso() {
    const v = accesoInput ? accesoInput.value : '';
    if (claveOk(v)) {
      concederAcceso();                                  // guarda SÓLO la marca (1.8)
      if (elAcceso) elAcceso.classList.add('oculto');
      actualizarSaludo();
      mostrarHome(juegoSel || 'pushclaud', false);       // el home se ve desbloqueado de inmediato (1.5)
    } else {
      if (accesoError) accesoError.classList.remove('oculto'); // aviso claro, sin regañar (1.6)
      if (accesoInput) { accesoInput.value = ''; try { accesoInput.focus(); } catch (e) {} } // listo para reintentar
    }
  }
  if (elHomeAccesoLink) elHomeAccesoLink.addEventListener('click', abrirAcceso); // "¿Tienes acceso?"
  if (elHomeAdmin) elHomeAdmin.addEventListener('click', abrirAcceso);           // el distintivo gestiona el acceso (4.2)
  if (btnAccesoOk) btnAccesoOk.addEventListener('click', intentarAcceso);
  if (btnAccesoCerrar) btnAccesoCerrar.addEventListener('click', cerrarAcceso);
  if (btnAccesoSalir) btnAccesoSalir.addEventListener('click', function () {
    revocarAcceso();                                      // sale del acceso (4.1); todo vuelve a como estaba
    if (elAcceso) elAcceso.classList.add('oculto');
    actualizarSaludo();
    mostrarHome(juegoSel || 'pushclaud', false);
  });
  if (accesoInput) accesoInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); intentarAcceso(); }
  });
  // El acceso sobrevive a recargar aunque sólo esté en IndexedDB: reconcilia y, si aparece, refresca
  // el home de Pushcloude ya desbloqueado. Best-effort, nunca rompe (1.7).
  try {
    accesoStore.reconciliar().then(function (v) {
      const antes = accesoAnticipado;
      accesoAnticipado = (v === '1');
      if (accesoAnticipado !== antes) { actualizarSaludo(); if (elDuracion && !elDuracion.classList.contains('oculto')) mostrarHome(juegoSel || 'hitclaud', false); }
    }, function () {});
  } catch (e) { /* nunca rompe */ }

  // ── PANTALLA DE ACTUALIZACIONES (FASE 26): bitácora completa desde bitacora.js ──
  // Overlay de SOLO LECTURA (sin interacción salvo desplazarse) al que se entra desde
  // el botón "Actualizaciones" del inicio y se sale con "Cerrar". La lista se genera
  // desde js/bitacora.js — NO está escrita a mano en el HTML. Se construye UNA vez.
  const elActualizaciones = document.getElementById('actualizaciones');
  const elActuLista = document.getElementById('actuLista');
  const btnVerActualizaciones = document.getElementById('verActualizaciones');
  const btnActuCerrar = document.getElementById('actuCerrar');
  function construirBitacora() {
    const B = (typeof window !== 'undefined' && window.Bitacora) ? window.Bitacora : null;
    if (!elActuLista || !B || !B.versiones) return;
    elActuLista.textContent = ''; // limpia (se llama una vez, pero es idempotente)
    for (let i = 0; i < B.versiones.length; i++) {
      const v = B.versiones[i];
      const cont = document.createElement('div');
      cont.className = 'actu-version';
      const ver = document.createElement('p');
      ver.className = 'actu-ver';
      ver.textContent = 'VERSIÓN ' + v.version;
      const fecha = document.createElement('p');
      fecha.className = 'actu-fecha';
      fecha.textContent = v.fecha;
      const ul = document.createElement('ul');
      ul.className = 'actu-puntos';
      const puntos = v.puntos || [];
      for (let k = 0; k < puntos.length; k++) {
        const p = puntos[k];
        const li = document.createElement('li');
        li.textContent = p.texto; // textContent: sin inyección, texto plano
        if (p.retirado) {
          li.classList.add('actu-retirado');
          const tag = document.createElement('span');
          tag.className = 'actu-tag';
          tag.textContent = 'Retirado';
          li.appendChild(document.createTextNode(' — '));
          li.appendChild(tag);
        }
        ul.appendChild(li);
      }
      cont.appendChild(ver);
      cont.appendChild(fecha);
      cont.appendChild(ul);
      elActuLista.appendChild(cont);
    }
  }
  construirBitacora();
  function abrirActualizaciones() {
    if (elDuracion) elDuracion.classList.add('oculto'); // cierra el home
    if (elActualizaciones) { elActualizaciones.scrollTop = 0; elActualizaciones.classList.remove('oculto'); }
    if (elActuLista) elActuLista.scrollTop = 0; // arranca arriba de la lista
  }
  function cerrarActualizaciones() {
    if (elActualizaciones) elActualizaciones.classList.add('oculto');
    mostrarPantallaInicio(); // vuelve al inicio (siempre hay salida)
  }
  if (btnVerActualizaciones) btnVerActualizaciones.addEventListener('click', abrirActualizaciones);
  if (btnActuCerrar) btnActuCerrar.addEventListener('click', cerrarActualizaciones);

  // ── PANTALLA DE RANKING (FASE 30): tabla del servidor vía js/ranking.js ──────────
  // Selector de modo + tabla (hasta 20, mayor a menor). TRES estados: cargando, con
  // datos, y error (con "Reintentar"). Nunca pantalla en blanco ni giro infinito. Los
  // nombres del servidor se insertan como TEXTO (textContent), nunca como HTML.
  const elRanking = document.getElementById('ranking');
  const elRankCuerpo = document.getElementById('rankCuerpo');
  const elRankModos = document.getElementById('rankModos');
  const elRankJuegoNombre = document.getElementById('rankJuegoNombre');
  const btnRankCerrar = document.getElementById('rankCerrar');
  // El ranking vive SIEMPRE en el contexto de UN juego (juegoSel) y una duración (modoInicioSel,
  // compartida con la pantalla 2 → coherencia, CAMBIO 5). `rankOrigen` recuerda de dónde se abrió
  // ('duracion' | 'fin') para que Cerrar vuelva exactamente ahí (3.5). NO hay selector de juego.
  let rankOrigen = 'duracion';
  let rankPeticion = 0;  // token de relevo: descarta respuestas viejas
  let rankTopActual = []; // último top cargado (para compartir la tarjeta y la medalla del récord)
  let rankTopClave = ''; // 'juego:duración' del top cargado (para reusarlo sin pedir dos veces, 6.5)
  // Selector de DURACIÓN del juego del contexto (sólo sus duraciones, 3.4). Marca modoInicioSel.
  function construirRankModos() {
    if (!elRankModos) return;
    const j = juegoPorId(juegoSel); if (!j) return;
    elRankModos.textContent = '';
    j.duraciones.forEach(function (dur) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'go-reiniciar ini-sel rank-sel' + (dur === modoInicioSel ? ' sel-activo' : '');
      b.setAttribute('data-modo', dur);
      b.textContent = dur + 's';
      b.addEventListener('click', function () { elegirModoRank(dur); });
      elRankModos.appendChild(b);
    });
  }
  function marcarModoRank() {
    if (!elRankModos) return;
    const bs = elRankModos.querySelectorAll('button');
    for (let i = 0; i < bs.length; i++) bs[i].classList.toggle('sel-activo', bs[i].getAttribute('data-modo') === modoInicioSel);
  }
  function rankEstado(texto, conReintento) {
    if (!elRankCuerpo) return;
    elRankCuerpo.textContent = '';
    const div = document.createElement('div');
    div.className = 'rank-estado';
    div.textContent = texto;
    elRankCuerpo.appendChild(div);
    if (conReintento) {
      const b = document.createElement('button');
      b.className = 'go-reiniciar rank-reintentar';
      b.textContent = 'Reintentar';
      b.addEventListener('click', function () { cargarRanking(); });
      div.appendChild(b);
    }
  }
  function pintarTabla(top) {
    if (!elRankCuerpo) return;
    if (!top || top.length === 0) { rankEstado('Aún no hay puntajes en este modo. ¡Sé el primero!', false); return; }
    elRankCuerpo.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < top.length && i < 20; i++) {
      const e = top[i] || {};
      const puesto = i + 1;
      const fila = document.createElement('div');
      fila.className = 'rank-fila';
      // NÚMERO de puesto: SIEMPRE, de la 1 a la 20 (CAMBIO 5.2), ancho fijo y tenue (5.4).
      const num = document.createElement('div');
      num.className = 'rank-num';
      num.textContent = String(puesto);
      // MEDALLA: puestos 1-12 su icono; 13-20 sin icono pero el ESPACIO se reserva (5.3).
      const med = document.createElement('div');
      med.className = 'rank-medalla';
      const icono = iconoPuesto(puesto); // podio-N para 1-12; null del 13 en adelante
      if (icono) {
        const img = document.createElement('img');
        img.src = icono; img.alt = 'Puesto ' + puesto; img.setAttribute('aria-hidden', 'true');
        med.appendChild(img);
      }
      const nom = document.createElement('div');
      nom.className = 'rank-nombre';
      nom.textContent = typeof e.nombre === 'string' ? e.nombre : ''; // TEXTO, jamás HTML
      const pts = document.createElement('div');
      pts.className = 'rank-puntos';
      pts.textContent = U.abreviarNumero(typeof e.puntos === 'number' ? e.puntos : 0);
      if (nombreUsuario && e.nombre === nombreUsuario) fila.classList.add('rank-yo'); // destaca al jugador (con su número, 5.5)
      fila.appendChild(num); fila.appendChild(med); fila.appendChild(nom);
      // EFECTIVIDAD (CAMBIO 5): entre el nombre y los puntos, SÓLO si la entrada la trae
      // (ShotClaud). Las viejas y HitClaud no la tienen → no se agrega y la tabla no cambia.
      // Estilo en línea (no se toca css/): tenue, tabular, en el acento del juego.
      if (typeof e.efectividad === 'number') {
        const efcCell = document.createElement('div');
        efcCell.className = 'rank-efc';
        efcCell.textContent = Math.round(e.efectividad) + '%';
        efcCell.style.color = ACENTO.vivo;
        efcCell.style.fontSize = '13px';
        efcCell.style.opacity = '0.8';
        efcCell.style.margin = '0 10px';
        efcCell.style.fontVariantNumeric = 'tabular-nums';
        fila.appendChild(efcCell);
      }
      fila.appendChild(pts);
      frag.appendChild(fila);
    }
    elRankCuerpo.appendChild(frag);
  }
  function cargarRanking() {
    const token = ++rankPeticion;
    // HitClaud y ShotClaud tienen ranking en el servidor (HitClaud '15'/'60', ShotClaud
    // 'shotclaud:20'/'shotclaud:60'). Si el modo del juego no lo soporta el módulo (p.ej. un
    // juego futuro), pedirTop resuelve ok:false y se muestra el mensaje de error, sin romper.
    if (typeof Ranking === 'undefined') {
      rankTopActual = [];
      rankEstado('Aún no hay puntajes en este juego. ¡Pronto!', false);
      return;
    }
    rankEstado('Cargando…', false);
    const clave = juegoSel + ':' + modoInicioSel;
    Ranking.pedirTop(modoServidor(juegoSel, modoInicioSel)).then(function (res) {
      if (token !== rankPeticion) return; // respuesta vieja (se cambió de duración) → ignorar
      if (res && res.ok) { rankTopActual = res.top || []; rankTopClave = clave; pintarTabla(res.top); }
      else { rankTopActual = []; rankTopClave = ''; rankEstado('No se pudo cargar la tabla. Revisá tu conexión.', true); }
    });
  }
  // Cambiar la duración en el ranking mueve la duración COMPARTIDA (modoInicioSel): la
  // pantalla 2 lo reflejará al volver (5.2) y JUGAR usará ESA duración (4.2).
  function elegirModoRank(modo) { modoInicioSel = modo; marcarModoRank(); cargarRanking(); }
  // Abre el ranking en el contexto de `juego`, recordando el origen para Cerrar (3.2/3.5).
  function abrirRanking(juego, origen) {
    const j = juegoPorId(juego) || juegoPorId('hitclaud');
    if (!j) return;
    juegoSel = j.id;
    rankOrigen = origen || 'duracion';
    if (j.duraciones.indexOf(modoInicioSel) === -1) modoInicioSel = duracionMasCorta(j); // duración válida del juego
    if (elRankJuegoNombre) elRankJuegoNombre.textContent = j.nombre; // 3.3: nombre del juego arriba
    construirRankModos();
    if (elRankCuerpo) elRankCuerpo.scrollTop = 0;
    ocultarNav();
    if (elRanking) elRanking.classList.remove('oculto');
    cargarRanking();
  }
  // Cerrar vuelve EXACTAMENTE al origen (3.5): al fin de partida, o a la pantalla 2 (que
  // reflejará la duración que quedó seleccionada, 5.2). Nunca a otro sitio.
  function cerrarRanking() {
    if (elRanking) elRanking.classList.add('oculto');
    if (rankOrigen === 'fin') { if (elGameOver) elGameOver.classList.remove('oculto'); }
    else mostrarHome(juegoSel, false);
  }
  const btnVerRankingFin = document.getElementById('verRankingFin'); // Ranking desde el fin (3.2)
  if (btnVerRankingFin) btnVerRankingFin.addEventListener('click', function () { abrirRanking(juegoActivo, 'fin'); });
  const btnRankJugar = document.getElementById('rankJugar'); // 4.2: arranca la duración seleccionada en la tabla
  if (btnRankJugar) btnRankJugar.addEventListener('click', function () { iniciarPartida(juegoSel, modoInicioSel); });
  if (btnRankCerrar) btnRankCerrar.addEventListener('click', cerrarRanking);

  // ── COMPARTIR (FASE: imagen). Todo pasa por js/compartir.js (ninguna otra parte del
  // juego genera imágenes ni habla con navigator.share). Mientras trabaja, el botón lo
  // muestra; el fallo a texto (>3s o sin soporte de imagen) lo maneja compartir.js. Un
  // fallo NUNCA rompe el juego (compartir.js nunca lanza; acá igual va en try/catch). ──
  function marcarCompartiendo(btn, on, via) {
    if (!btn) return;
    const span = btn.querySelector('span');
    if (on) {
      btn.disabled = true;
      btn.dataset.txt = span ? span.textContent : '';
      if (span) span.textContent = 'Generando…';
    } else {
      btn.disabled = false;
      if (span) span.textContent = (via === 'portapapeles') ? '¡Copiado!' : (btn.dataset.txt || 'Compartir');
      // Si se copió, restaura la etiqueta tras un momento (sin temporizadores si el botón se fue).
      if (via === 'portapapeles' && span) { const t0 = btn.dataset.txt || 'Compartir'; setTimeout(function () { try { span.textContent = t0; } catch (e) {} }, 2000); }
    }
  }
  const btnCompartirFin = document.getElementById('compartirFin');
  if (btnCompartirFin) btnCompartirFin.addEventListener('click', function () {
    if (typeof Compartir === 'undefined' || !finDatos) return;
    marcarCompartiendo(btnCompartirFin, true);
    try {
      Compartir.compartirRecord({ puntos: finDatos.puntos, modo: finDatos.modo, esRecord: finDatos.esRecord, nombre: nombreUsuario })
        .then(function (r) { marcarCompartiendo(btnCompartirFin, false, r && r.via); },
              function () { marcarCompartiendo(btnCompartirFin, false); });
    } catch (e) { marcarCompartiendo(btnCompartirFin, false); }
  });
  const btnCompartirRank = document.getElementById('compartirRank');
  if (btnCompartirRank) btnCompartirRank.addEventListener('click', function () {
    if (typeof Compartir === 'undefined') return;
    marcarCompartiendo(btnCompartirRank, true);
    try {
      Compartir.compartirRanking({ modo: modoInicioSel, top: rankTopActual, nombre: nombreUsuario })
        .then(function (r) { marcarCompartiendo(btnCompartirRank, false, r && r.via); },
              function () { marcarCompartiendo(btnCompartirRank, false); });
    } catch (e) { marcarCompartiendo(btnCompartirRank, false); }
  });
  // Reintenta, al arrancar y en segundo plano, los puntajes que quedaron pendientes por
  // un fallo de envío en una partida anterior (una partida buena no se pierde).
  try { if (typeof Ranking !== 'undefined') Ranking.reintentarPendientes(); } catch (e) { /* nunca rompe */ }
  // Reconciliación del nombre (async, IDB): si aparece un nombre guardado y aún no lo
  // teníamos (p.ej. local vacío pero IDB lo conserva), lo adopta y cierra el prompt.
  nombreStore.reconciliar().then(function (v) {
    if (v && !nombreUsuario) {
      nombreUsuario = v; actualizarSaludo();
      if (elNombre && !elNombre.classList.contains('oculto')) { elNombre.classList.add('oculto'); mostrarPantallaInicio(); }
    }
  });

  // Retardo del próximo spawn de NARANJAS: rango base por score (rangoVigente)
  // con caos superpuesto (ráfagas/pausas), recortado a ≤800ms (SPAWN_GAP_MAX): la
  // pantalla nunca queda más de 800ms sin aparición de un target (habiendo lugar).
  function retardoNaranja(ahora) {
    const base = P.rangoVigente(ritmo, marcador.puntos, ahora);
    // ShotClaud recorta más el hueco (SHOT.SPAWN_GAP_MAX) para que la pantalla se llene y
    // haya cupo de naranjas frente a tantos rojos; HitClaud conserva su SPAWN_GAP_MAX (800).
    const gapMax = esPush() ? PUSH.SPAWN_GAP_MAX : esShot() ? SHOT.SPAWN_GAP_MAX : SPAWN_GAP_MAX;
    return Math.min(gapMax, P.retardoCaotico(base, caosSpawn, Math.random));
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

  // ── BONO DE CARAMBOLA flotante (canvas) ────────────────────────────
  // UN solo número por bola: al 2º golpe se anota +500 Y se muestra, JUNTOS (número
  // ACOPLADO al marcador — nunca uno sin el otro). Valor fijo 500 (un solo escalón).
  // Cada número es INDEPENDIENTE (lista `bonos`): cuelga de su propia carambola, dos
  // bolas nunca comparten un número, y cada número cumple su animación aunque su bola
  // muera. El halo es un DISCO de degradado radial CACHEADO (creado UNA sola vez):
  // NUNCA shadowBlur (puerta cerrada, 9246c33), NUNCA se crea un gradiente en el bucle.
  const BONO_COLOR = '#FFC233'; // color único del número del bono (literal, con respaldo)
  const BONO_PICO = 62;         // px: pico del rebote
  const BONO_ASIENTO = 40;      // px: tamaño de asiento
  const BONO_VIDA = 1100;       // ms de vida (única)
  const BONO_SUBE = 56;         // px que sube (con frenado)
  const MULT_COLOR = '#FFB25C'; // color del badge de multiplicador (literal, con respaldo)
  const MULT_ASIENTO = 42;      // px: tamaño de asiento del multiplicador a ×1 (base)
  const MULT_ASIENTO_MAX = 78;  // px: tamaño de asiento a ×5 (tope). CAMBIO 2.3: el número CRECE
  //                               con el valor — progresión clara y perceptible entre ×1 y ×5.
  const MULT_REBOTE = 10;       // px que brinca el rebote al CAMBIAR de valor (52−42 previo, conservado)
  function hexRgb(h) {
    h = String(h).replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  // Disco de halo cacheado: degradado radial del color (centro) a transparente (borde).
  // Radio = 1.6× el alto del texto en su tamaño de asiento. La opacidad se aplica AL
  // DIBUJAR (globalAlpha), no se hornea. Se construye UNA sola vez al arrancar.
  function construirDisco(color, altoTexto) {
    const rad = Math.round(1.6 * altoTexto);
    const cv = document.createElement('canvas');
    cv.width = rad * 2; cv.height = rad * 2;
    const dctx = cv.getContext('2d');
    const c = hexRgb(color);
    const grad = dctx.createRadialGradient(rad, rad, 0, rad, rad, rad);
    grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',1)');
    grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
    dctx.fillStyle = grad;
    dctx.beginPath(); dctx.arc(rad, rad, rad, 0, Math.PI * 2); dctx.fill();
    return { canvas: cv, r: rad };
  }
  // Interpolaciones suavizadas (no lineales).
  function suave(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }   // smoothstep
  function frena(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - (1 - t) * (1 - t); } // ease-out (rápido→lento)
  function lerpColor(a, b, t) {
    const A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + Math.round(A.r + (B.r - A.r) * t) + ',' + Math.round(A.g + (B.g - A.g) * t) + ',' + Math.round(A.b + (B.b - A.b) * t) + ')';
  }
  // CAMBIO 2.3 — tamaño de ASIENTO del badge SEGÚN el valor del multiplicador: interpola lineal de
  // MULT_ASIENTO (×1) a MULT_ASIENTO_MAX (×RACHA_TOPE=5). A mayor multiplicador, más grande el
  // número. Sólo cambia el TAMAÑO; color, peso, halo y rebote no cambian (2.4). SIN shadowBlur (2.5).
  function multAsiento(mult) {
    const k = Math.max(0, Math.min(1, (mult - 1) / (P.RACHA_TOPE - 1)));
    return MULT_ASIENTO + k * (MULT_ASIENTO_MAX - MULT_ASIENTO);
  }
  // Discos cacheados UNA sola vez (blindado): bono, multiplicador y FLOTANTE (glow sin
  // strokeText — reemplaza al contorno del halo de texto, CAMBIO 2). Radios por su tamaño.
  const FLOTANTE_GLOW = ACENTO.vivo; // los flotantes con glow siempre son del acento vivo
  let discoBono = null, discoMult = null, discoFlotante = null;
  try { discoBono = construirDisco(BONO_COLOR, BONO_ASIENTO); } catch (e) { discoBono = null; }
  try { discoMult = construirDisco(MULT_COLOR, MULT_ASIENTO); } catch (e) { discoMult = null; }
  try { discoFlotante = construirDisco(FLOTANTE_GLOW, 30); } catch (e) { discoFlotante = null; }

  // ── CONTADOR de tiempo: MARCA DE AGUA (canvas, DETRÁS de todo) ─────────────────────
  // Enorme (7× el temporizador anterior de 15px → 105px), peso máximo, BLANCO, muy
  // translúcido (~12%; sube a ~20% en los últimos 5 s para que urja). Centrado en el ÁREA
  // DE JUEGO, no en la barra (1.5). Cifras de ANCHO FIJO: cada carácter se rasteriza en una
  // celda del ancho del '0' → no baila al cambiar de segundo (1.6). Se CACHEA en un lienzo
  // offscreen y sólo se re-rasteriza cuando cambia el texto o el estado (≈1 vez/seg, no por
  // cuadro): cada cuadro es un drawImage barato con su alfa/escala. SIN shadowBlur (1.9).
  const CONTADOR_TAM = 105;             // px (7 × 15 del temporizador anterior)
  // CAMBIO 3 — centro vertical del contador. Antes 0.50 (H/2, centrado). Un 20% MÁS ARRIBA
  // respecto a esa posición: 0.50 × 0.80 = 0.40 (3.1). Sólo se mueve: tamaño/opacidad/color/
  // últimos-5s intactos (3.2). No se sale de pantalla en ningún alto: el contador mide ≈137px
  // (105 × 1.3), su mitad ≈68px < 0.40·H para cualquier H jugable (3.3). Igual en HitClaud y ShotClaud.
  const CONTADOR_Y_FRAC = 0.40;
  const CONTADOR_ALFA = 0.12;           // opacidad normal (marca de agua, 1.3)
  const CONTADOR_ALFA_URG = 0.20;       // opacidad en los últimos 5 s (urge un poco más, 1.7)
  const CONTADOR_ROJO = tk('--tiempo-urgente', '#FF4D4D'); // rojo de alarma (mismo token que el DOM antes)
  let contadorCache = null;             // { txt, urgente, canvas, w, h } — se re-rasteriza al cambiar

  // Rasteriza el contador (blanco o rojo) en un lienzo offscreen, con DÍGITOS DE ANCHO FIJO
  // (cada carácter centrado en su celda; los dígitos usan el ancho del '0'). Se llama sólo al
  // cambiar el texto/estado, nunca por cuadro.
  function rasterizarContador(txt, color) {
    const cv = document.createElement('canvas');
    const f = '900 ' + CONTADOR_TAM + 'px ' + COLOR.fuente; // peso máximo (1.2)
    const m = cv.getContext('2d'); m.font = f;
    const celda = Math.ceil(m.measureText('0').width) || CONTADOR_TAM;   // ancho de un dígito
    const colon = Math.ceil(m.measureText(':').width) || Math.round(CONTADOR_TAM / 3);
    const anchos = []; let ancho = 0;
    for (let i = 0; i < txt.length; i++) { const w = txt[i] === ':' ? colon : celda; anchos.push(w); ancho += w; }
    const alto = Math.ceil(CONTADOR_TAM * 1.3);
    cv.width = Math.max(1, ancho); cv.height = Math.max(1, alto);
    const c2 = cv.getContext('2d');
    c2.font = f; c2.fillStyle = color; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    let x = 0;
    for (let i = 0; i < txt.length; i++) { c2.fillText(txt[i], x + anchos[i] / 2, alto / 2); x += anchos[i]; }
    return { canvas: cv, w: cv.width, h: cv.height };
  }
  // Dibuja la marca de agua del contador. DETRÁS de todo (se llama antes de la cámara y los
  // targets). Sólo durante una partida cronometrada. NO cambia la lógica del tiempo (1.8).
  function dibujarContadorTiempo() {
    if (!jugando || !DURACIONES[modoJuego]) return;
    const txt = fmtTiempo(tiempoRestante);
    const urgente = !!tiempoUrgente;
    if (!contadorCache || contadorCache.txt !== txt || contadorCache.urgente !== urgente) {
      const r = rasterizarContador(txt, urgente ? CONTADOR_ROJO : '#FFFFFF');
      contadorCache = { txt: txt, urgente: urgente, canvas: r.canvas, w: r.w, h: r.h };
    }
    // Latido en los últimos 5 s: escala 1.0 → 1.12 → 1.0, un ciclo por segundo (como el DOM).
    const pulso = urgente ? (1 + 0.06 * (1 - Math.cos(performance.now() / 1000 * 2 * Math.PI))) : 1;
    const alfa = urgente ? CONTADOR_ALFA_URG : CONTADOR_ALFA;
    const w = contadorCache.w * pulso, h = contadorCache.h * pulso;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(contadorCache.canvas, W / 2 - w / 2, H * CONTADOR_Y_FRAC - h / 2, w, h);
    ctx.restore();
  }
  // Estado del badge de multiplicador: para detectar el CAMBIO de valor (rebote+destello).
  let multAnterior = 1, multCambioEn = -Infinity;
  // Lista de números de bono activos (uno por carambola; independientes de su bola).
  const bonos = [];
  // Crea el número del bono en el impacto del 2º golpe. Jitter X −8..+8. Texto fijo
  // "+500 / HITS ×2" (la carambola de HitClaud no varía), una sola duración.
  function mostrarBonoCarambola(x, y) {
    bonos.push({ x: x + rnd(-8, 8), y: y, inicio: performance.now(), texto: '+500', sub: 'HITS ×2' });
    if (bonos.length > 8) bonos.shift(); // tope de seguridad (no se alcanza en juego)
  }
  // CAMBIO 3: celebración del disparo AL CENTRO de ShotClaud — MISMO lenguaje visual que la
  // carambola (número DORADO que sale del impacto, con destello blanco→dorado y rebote).
  // Reutiliza la mecánica de `bonos`; el texto es el valor ganado (200 × multiplicador). Sin
  // 2ª línea (no es carambola). El fuera-de-centro NO lo usa: sale su +50 discreto (3.4).
  function mostrarBonoCentro(x, y, g) {
    bonos.push({ x: x + rnd(-8, 8), y: y, inicio: performance.now(), texto: '+' + g });
    if (bonos.length > 8) bonos.shift();
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

  // ── FRAGMENTOS DESPRENDIBLES (FASE 23 commit B) ────────────────────
  // Al partir un target, los trozos sueltos se suman a `targets` como objetos
  // golpeables propios (F.partirTarget). El SPAWN sigue mirando MAX_EN_PANTALLA
  // (2): los fragmentos NO abren cupo para nuevos targets, sólo persisten hasta
  // caer. TOPE de targets vivos EN PANTALLA para blindar el dibujo: los más
  // VIEJOS mueren primero. Nunca se retira el CloudOver (rojo) por el tope: su
  // desaparición silenciosa quitaría la amenaza sin game over.
  const IMPULSO_FRAGMENTO = 0.5; // fracción del |vImpact| del golpe repartida entre los trozos
  const MAX_TARGETS_VIVOS = 10;  // tope duro de targets simultáneos (spawneados + fragmentos)

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

  // ── ShotClaud: dificultad y física visible, en UN SOLO lugar ────────
  // ShotClaud reutiliza EL MISMO motor (js/fisica.js) que HitClaud; lo que cambia se pasa
  // por PARÁMETROS desde acá (tamaño de grilla, velocidad, frecuencia de rojos, demolición),
  // nunca tocando el motor. HitClaud conserva sus propios valores intactos.
  const SHOT = {
    // CAMBIO 2 — Tamaño: 40% MÁS grande que HitClaud (grilla 5×4 → 7×6). El cubo de 8px es
    // atómico: más cubos, no cubos mayores. Naranjas y rojos usan esta misma grilla.
    COLS: 7,
    FILAS: 6,
    // CAMBIO 1 — Demolición del disparo FUERA del centro: destruye ~esta FRACCIÓN de las
    // celdas vivas del target, en la zona del impacto (las más cercanas a la mira). Único
    // sitio ajustable del radio de demolición.
    DEMOLE_FRAC: 0.5,
    // CAMBIO 3 — Velocidad: BASE 10% más lenta que la ShotClaud previa (que iba 1.15× la de
    // HitClaud) → 1.15 × 0.90 = 1.035× HitClaud. Y una VARIACIÓN por target, sorteada al
    // aparecer (las proporciones suman 1): la mayoría a la base, algunos +20%, pocos +40%.
    // Aplica IGUAL a naranjas y rojos.
    VEL_BASE: 1.035,
    VEL_VARIA: [
      { mult: 1.0, prob: 0.6 },   // 60% a la velocidad base
      { mult: 1.2, prob: 0.3 },   // 30% un 20% más rápidos
      { mult: 1.4, prob: 0.1 },   // 10% un 40% más rápidos
    ],
    // Rojos: se acorta su intervalo (×ROJO_FACTOR). AHORA el DOBLE que la ShotClaud previa
    // (CAMBIO 3): iba ×0.05, ahora ×0.025 → el doble de rojos. TOPE DURO aparte (en el spawn):
    // los rojos NUNCA superan en número a los naranjas (se mantiene, CAMBIO 3.2). Más objetos
    // ⇒ cupos propios mayores para que la pantalla se llene sin reventar los topes de dibujo.
    ROJO_FACTOR: 0.025,
    MAX_EN_PANTALLA: 6,   // cupo de spawn de ShotClaud (HitClaud sigue en MAX_EN_PANTALLA=2)
    MAX_VIVOS: 16,        // tope duro de dibujo de ShotClaud (HitClaud sigue en MAX_TARGETS_VIVOS=10)
    SPAWN_GAP_MAX: 380,   // naranjas más seguidas → hay cupo para tantos rojos (HitClaud 800)
    // CAMBIO 4 — Caída en PICADA: un target golpeado FUERA del centro pierde su trayectoria.
    // La velocidad horizontal se corta casi por completo (VX_FACTOR), arranca hacia abajo
    // (VY_MIN) y la gravedad de caída se intensifica (GRAV_MULT × la lunar) → se lee como un
    // derribo, no como un objeto que sigue viajando. Conserva/asegura rotación (VEL_ROT) para
    // que se vea el impacto. Sigue golpeable y sigue dando 50. Sólo ShotClaud.
    DERRIBO: {
      VX_FACTOR: 0.06,  // conserva sólo el 6% de la velocidad horizontal
      VY_MIN: 0.12,     // px/ms: velocidad mínima hacia abajo (no queda flotando ni subiendo)
      GRAV_MULT: 2.2,   // la gravedad de caída se multiplica → picada, no flote lunar
      VEL_ROT: 0.004,   // rad/ms: giro de respaldo si el trozo no tenía rotación
    },
    SIN_GRANDE: true,     // ShotClaud NO lanza Big Claude
  };
  const esShot = function () { return juegoActivo === 'shotclaud'; };

  // ── Pushcloude: dificultad y movimiento, en UN SOLO lugar (CAMBIO 8.4) ──────────────────────
  // Reutiliza EL MISMO motor (js/fisica.js) que los demás; lo que cambia se pasa por PARÁMETROS
  // (grilla, velocidad, DIRECCIÓN, frecuencia de rojos, demolición), nunca tocando el motor.
  const PUSH = {
    COLS: 7, FILAS: 6,            // grande y fácil de tocar (como Shotcloude)
    ARRANCA_FRAC: 0.34,          // toque FUERA: arranca ~1/3 del target (3.4)
    EMPUJON: 0.05,               // px/ms: leve empujón del golpe al resto (sigue su ruta, 3.4)
    VEL_BASE: 1.0,               // velocidad base; la VARIEDAD va sobre todo en la dirección (8.1)
    VEL_VARIA: [{ mult: 1.0, prob: 0.6 }, { mult: 1.2, prob: 0.3 }, { mult: 1.4, prob: 0.1 }],
    ANG_SPREAD: 0.6,             // rad (~34°): rotación aleatoria de la velocidad → más ángulos (8.1)
    ROJO_FACTOR: 0.6,            // frecuencia de rojos (8.3, PROPUESTO para veto de Pat: tocar rojo
    //                              REINICIA la partida —muy castigador—, por eso menos rojos que Shotcloude)
    MAX_EN_PANTALLA: 6,          // cupo de spawn
    MAX_VIVOS: 16,               // tope duro de dibujo
    SPAWN_GAP_MAX: 420,          // hueco máximo entre naranjas
    SIN_GRANDE: true,            // Pushcloude NO lanza Big Claude (8.2)
  };
  const esPush = function () { return juegoActivo === 'pushclaud'; };
  // Cupos según el juego activo: ShotClaud/Pushcloude llenan más la pantalla; HitClaud queda idéntico.
  function capEnPantalla() { return esPush() ? PUSH.MAX_EN_PANTALLA : esShot() ? SHOT.MAX_EN_PANTALLA : MAX_EN_PANTALLA; }
  function capVivos() { return esPush() ? PUSH.MAX_VIVOS : esShot() ? SHOT.MAX_VIVOS : MAX_TARGETS_VIVOS; }
  // Ni ShotClaud ni Pushcloude lanzan Big Claude (sólo HitClaud).
  function sinGrande() { return (esShot() && SHOT.SIN_GRANDE) || (esPush() && PUSH.SIN_GRANDE); }
  // Cuenta naranjas (todo lo no-rojo: naranjas, grandes, fragmentos) y rojos en pantalla.
  function contarTargets() {
    let rojos = 0, naranjas = 0;
    for (let i = 0; i < targets.length; i++) { if (targets[i].rojo) rojos++; else naranjas++; }
    return { rojos: rojos, naranjas: naranjas };
  }

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

  // ── Retícula de ShotClaud (mira de precisión, desktop) ─────────────
  // Cruz de 4 trazos con hueco central y punto al centro (la mira que ya usa el
  // desktop, aquí con vida propia). RETROCESO: al disparar, los 4 brazos se abren y
  // vuelven a cerrarse en MIRA_RETROCESO_MS (~120ms). DESTELLO de acierto: un flash
  // corto, DISTINTO si fue al centro (anillo grande, acento vivo) o no (chico, tenue).
  // SIN shadowBlur: sólo color, tamaño y trazo (la única sombra del dibujo sigue
  // siendo la del destello de HitClaud).
  const MIRA_RETROCESO_MS = 120;   // el retroceso (apertura→cierre) de la cruz dura ~120ms
  const MIRA_RETROCESO_PX = 6;     // cuánto se abren los brazos en el pico del retroceso
  const MIRA_FLASH_MS = 150;       // duración del destello de acierto de la retícula
  let miraDisparoEn = -Infinity;   // timestamp del último tiro (anima el retroceso)
  let miraFlashEn = -Infinity;     // timestamp del último acierto (anima el destello)
  let miraFlashCentro = false;     // ¿el último acierto fue al centro? (destello distinto)

  // CAMBIO 5 — MEDIDOR DE EFECTIVIDAD (sólo ShotClaud): % de aciertos sobre disparos.
  // ESQUINA INFERIOR IZQUIERDA: la zona MENOS transitada — los targets nacen en los 4 bordes
  // y convergen al centro (donde vive la mira), y la barra de puntaje/tiempo ocupa el borde
  // SUPERIOR; la esquina inferior izquierda queda casi siempre despejada. Es SÓLO DIBUJO en el
  // canvas: no hay elemento ni listener, así que NUNCA captura toques/clics (5.4) — un target
  // que pase por debajo se dispara igual. SIN shadowBlur. Sin valor hasta el primer disparo
  // (un 100% previo engañaría: no has disparado). No toca puntaje ni récord (5.9).
  const MEDIDOR_TAM = 76;        // px del número grande (translúcido)
  const MEDIDOR_ETIQUETA = 17;   // px de la etiqueta "precisión"
  const MEDIDOR_MARGEN = 22;     // px de separación desde el borde inferior-izquierdo
  const MEDIDOR_ALFA_NUM = 0.17; // translucidez del número (no compite con el juego)
  const MEDIDOR_ALFA_ET = 0.42;  // translucidez de la etiqueta

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
  let modoJuego = null;             // '15' | '30' | '60'
  let tiempoRestante = 0;           // ms restantes — se decrementa con dt SOLO jugando
                                    // (así la pausa DETIENE el reloj de verdad).
  // ── Pushcloude: ciclo de metas de 15 s y reinicio por rojo/stop (CAMBIO 4/5/7) ──
  let pushCicloBase = 0;            // puntos que había al INICIO del ciclo en curso
  let pushCicloRestante = 0;        // ms restantes del ciclo de 15 s (independiente del reloj de partida)
  let pushCicloCumplido = false;    // ¿la meta del ciclo ya está cumplida? (aviso "vas a salvo", 4.5)
  let pushReset = null;             // {modo:'reinicio'|'salir', inicio} máquina del rojo (5) / stop (7)
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
  // FIRMA DEL AUTOR (FASE 21). EXCEPCIÓN aprobada EXPLÍCITAMENTE por el dueño a la
  // regla de "todo real": estas dos líneas NO son telemetría ni código fuente — son la
  // FIRMA del autor y están autorizadas. NO borrar en un futuro por creerlas texto
  // inventado. 14px (el resto es 10px), alfa 0.20, mismo mono/color/márgenes. INTERCALADAS
  // (no al principio ni al final): quedan en los slots 8 ("Patrick Macip") y 13
  // ("@patcitorey"), con líneas de datos entre medio y antes/después → no se solapan.
  lineasFondo.splice(8, 0, { firma: true, texto: 'Patrick Macip' });
  lineasFondo.splice(13, 0, { firma: true, texto: '@patcitorey' });
  // CAMBIO 10 — firma de Pushcloude en la cascada, MISMO tratamiento que las otras (dato `firma`).
  // Se renderiza en dibujarFondoDatos (main.js), sin tocar util.js.
  lineasFondo.splice(18, 0, { firma: true, texto: 'Creado por santiadmin' });
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
      const y = FONDO_Y0 + i * FONDO_LH;
      if (L.firma) {
        // Firma: 14px, alfa 0.20 (mismo mono/color/márgenes). 14px < interlínea 16 → sin solape.
        ctx.font = '14px ui-monospace, Menlo, monospace';
        ctx.globalAlpha = 0.20;
        ctx.fillText(U.truncarTexto(L.texto, maxW, anchoDe), FONDO_MARGEN, y);
        ctx.font = '10px ui-monospace, Menlo, monospace'; // restaura para el resto
        continue;
      }
      let s = L.f();
      if (!s) continue;
      s = U.truncarTexto(s, maxW, anchoDe); // nunca cruza el margen derecho
      ctx.globalAlpha = L.vivo ? 0.15 : 0.08;
      ctx.fillText(s, FONDO_MARGEN, y);
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
    targets.push(nuevoTarget());
  }

  // Crea un target con los PARÁMETROS del juego activo (el motor F.crearTarget no cambia).
  // ShotClaud: grilla propia 40% mayor (SHOT.COLS×FILAS), radio de salida acorde y velocidad
  // ajustada (base + variación). HitClaud: su 5×4 y su velocidad, sin tocar nada.
  function nuevoTarget() {
    if (esShot()) {
      const t = F.crearTarget({ w: W, h: H }, SHOT.COLS, SHOT.FILAS);
      t.radio = Math.max(SHOT.COLS, SHOT.FILAS) * 4 + 12; // margen de salida ≈ media diagonal (como el grande)
      aplicarVelocidadShot(t);
      return t;
    }
    if (esPush()) {
      const t = F.crearTarget({ w: W, h: H }, PUSH.COLS, PUSH.FILAS);
      t.radio = Math.max(PUSH.COLS, PUSH.FILAS) * 4 + 12;
      aplicarMovimientoPush(t);
      return t;
    }
    return F.crearTarget({ w: W, h: H });
  }
  // Pushcloude (CAMBIO 8.1): velocidad base con variación + ROTACIÓN aleatoria del vector velocidad →
  // los targets entran desde más ángulos que en los otros juegos. La gravedad NO se toca (motor
  // sellado): sólo se gira la velocidad inicial. Todo dentro de PUSH (un solo sitio, 8.4).
  function aplicarMovimientoPush(t) {
    const f = PUSH.VEL_BASE * sortearVariacion(PUSH.VEL_VARIA);
    t.vx *= f; t.vy *= f;
    const a = (Math.random() * 2 - 1) * PUSH.ANG_SPREAD;
    const ca = Math.cos(a), sa = Math.sin(a), vx = t.vx, vy = t.vy;
    t.vx = vx * ca - vy * sa;
    t.vy = vx * sa + vy * ca;
  }

  // CAMBIO 3 — velocidad de ShotClaud: base (SHOT.VEL_BASE) × variación por target sorteada
  // al aparecer. Multiplica SÓLO la magnitud (gravedad/arco intactos). Igual para naranjas y rojos.
  function aplicarVelocidadShot(t) {
    const f = SHOT.VEL_BASE * sortearVariacionVel();
    t.vx *= f; t.vy *= f;
  }
  function sortearVariacionVel() { return sortearVariacion(SHOT.VEL_VARIA); }
  // Sortea un multiplicador de una tabla [{mult,prob}] cuyas probabilidades suman 1 (genérico:
  // lo usan ShotClaud y Pushcloude sin duplicar la lógica).
  function sortearVariacion(tabla) {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < tabla.length; i++) { acc += tabla[i].prob; if (r < acc) return tabla[i].mult; }
    return tabla[tabla.length - 1].mult; // fallback por redondeo
  }

  // Lanza un target ROJO (parpadea, termina la partida). Sale como cualquier otro
  // (mismo crearTarget: 4 orígenes, velocidad del rango) — sólo marcado `rojo`.
  function generarRojo() {
    const t = nuevoTarget();
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

  // ── FRAGMENTOS: tope de targets vivos y desprendimiento ────────────
  // aplicarTopeTargets: los más VIEJOS (mayor edad) mueren primero al pasarse del
  // tope. No retira el CloudOver (rojo) — su desaparición silenciosa quitaría la
  // amenaza sin game over; muere por su propia física/secuencia.
  function aplicarTopeTargets() {
    while (targets.length > capVivos()) {
      let viejo = -1;
      for (let i = 0; i < targets.length; i++) {
        if (targets[i].rojo) continue;
        if (viejo < 0 || targets[i].edad > targets[viejo].edad) viejo = i;
      }
      if (viejo < 0) break; // sólo quedan rojos → no se toca
      targets.splice(viejo, 1);
    }
  }

  // quizasPartir: tras un golpe que DESTRUYÓ celdas (nunca por cuadro), ve si el
  // target quedó partido y desprende los trozos sueltos como targets golpeables;
  // luego aplica el tope. px,py = punto de impacto (dirección del reparto de
  // impulso); vImpact = rapidez del golpe (hitscan usa un nominal de 1.0).
  function quizasPartir(tg, px, py, vImpact) {
    const frags = F.partirTarget(tg, px, py, vImpact, IMPULSO_FRAGMENTO);
    if (!frags || !frags.length) return;
    for (let k = 0; k < frags.length; k++) targets.push(frags[k]);
    aplicarTopeTargets();
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
    // PUSHCLOUDE (CAMBIO 2): el toque APLASTA lo que haya debajo, INMEDIATO (sin arrastre ni
    // esperar a soltar). Varios dedos: cada toque aplasta de forma independiente (documentado, 2.4).
    // El zoom por doble toque y el scroll ya están bloqueados por touch-action:none + viewport (2.3).
    if (esPush()) { try { e.preventDefault(); } catch (er) {} aplastar(e.clientX, e.clientY); return; }
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
    if (esShot()) { dispararHitscanShot(mx, my, ahora); return; } // ShotClaud tiene su propia puntuación
    miraX = mx; miraY = my; miraActiva = true;
    marcarActividad();
    disparos.push({ x: mx, y: my, inicio: ahora }); // destello del tiro
    pTiros += 1;                             // un tiro (hitscan) lanzado
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      const tg = targets[ti];
      if (!tg.haEntrado) continue;           // NO golpeable hasta ENTRAR (mismo criterio que la bola)
      const idx = F.celdaEnPunto(tg, mx, my);
      if (idx < 0) continue;                 // la mira no está sobre un cubo vivo
      pAciertos += 1;                        // la mira dio en un cubo (acierto ≤ tiros)
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
      if (marcador.racha > pRachaMax) pRachaMax = marcador.racha;
      P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, ahora);
      const g = P.anotarDestruidos(marcador, arrancadas.length); // cubos × 5 × racha
      explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base);
      flotante(centros[0].x, centros[0].y, '+' + g, ACENTO.vivo, tamGanancia(g), g >= 300);
      if (g >= 50) popMarcador();
      actualizarMarcador();
      if (tg.vivos <= 0) { targets.splice(ti, 1); sacudidaHasta = ahora + SACUDIDA_MS; }
      else { quizasPartir(tg, mx, my, 1.0); derribarHit(tg, mx, my, 1.0); } // sobrevive → ¿partido? + CAMBIO 1: cae describiendo un arco
      return; // un tiro impacta un solo target
    }
    // No tocó ningún cubo → FALLO.
    const pen = P.anotarFallo(marcador);
    actualizarMarcador();
    registrarPerdida(pen);
  }

  // DISPARO HITSCAN de ShotClaud (desktop): sistema de puntuación PROPIO (js/shotclaud.js),
  // distinto al de HitClaud. Los targets y la física son los mismos. Clasificación del tiro:
  //   • ROJO         → CloudOver (game over), igual que HitClaud.
  //   • target CAÍDO  → 50 siempre (S.anotarCaido), sin rachas.
  //   • CENTRO intacto→ destruye el target ENTERO de un tiro, 200×racha (S.anotarCentro).
  //   • FUERA intacto → 50, NO se destruye (sigue cayendo), rompe racha positiva; marca "caído".
  //   • NADA          → FALLO: castigo escalado por racha negativa (S.anotarFallo).
  function dispararHitscanShot(mx, my, ahora) {
    miraX = mx; miraY = my; miraActiva = true;
    marcarActividad();
    miraDisparoEn = ahora;                   // retroceso de la cruz
    miraFlashEn = ahora; miraFlashCentro = false; // 3.5: destello breve en la mira en CADA tiro (acierto o fallo)
    pTiros += 1;                             // un tiro lanzado
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      const tg = targets[ti];
      if (!tg.haEntrado) continue;           // NO golpeable hasta ENTRAR (mismo criterio que la bola)
      if (F.celdaEnPunto(tg, mx, my) < 0) continue; // el tiro no cae sobre el target
      pAciertos += 1;
      if (tg.rojo) { golpeCloudover(tg, mx, my); return; } // rojo → CloudOver (sin cambios)
      tg.destelloHasta = ahora + DESTELLO_MS;
      if (tg.tocado) {                        // debris/caído: 50 siempre, nunca 200, sin rachas
        const r = S.anotarCaido(marcador);
        flashShot(mx, my, ahora, false);
        pintarGananciaShot(mx, my, r.ganancia, false);
        return;
      }
      if (S.enZonaCentral(tg, mx, my)) {       // CENTRO del target completo → lo destruye entero
        const r = S.anotarCentro(marcador);
        if (marcador.rachaPos > pRachaMax) pRachaMax = marcador.rachaPos;
        const centros = [];
        for (let k = 0; k < tg.celdas.length; k++) { if (tg.celdas[k]) { centros.push(F.celdaMundo(tg, k)); tg.celdas[k] = false; } }
        tg.vivos = 0;
        explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base);
        targets.splice(ti, 1);
        sacudidaHasta = ahora + SACUDIDA_MS;
        flashShot(mx, my, ahora, true);
        // CAMBIO 3: se CELEBRA con el número DORADO de la carambola (destello + rebote), no el
        // flotante discreto. El valor es la ganancia (200 × multiplicador).
        mostrarBonoCentro(mx, my, r.ganancia);
        popMarcador();
        actualizarMarcador();
        return;
      }
      // FUERA del centro (target INTACTO): DEMUELE ~la mitad en la zona del impacto; el pedazo
      // que sobrevive CAE (islas). Puntúa 50 y rompe la racha positiva (marcado como caído dentro).
      demolerMitadShot(tg, ti, mx, my, ahora);
      const r = S.anotarLateral(marcador);
      flashShot(mx, my, ahora, false);
      pintarGananciaShot(mx, my, r.ganancia, false);
      return;
    }
    // No tocó ningún target → FALLO (castigo escalado por racha negativa).
    const r = S.anotarFallo(marcador);
    actualizarMarcador();
    registrarPerdida(r.castigo);
  }

  // Destello del acierto de ShotClaud: alimenta la retícula (flash centro/no) y deja un
  // punto de disparo marcado para el dibujo. SIN shadowBlur (lo pinta dibujarReticulaShot).
  function flashShot(mx, my, ahora, centro) {
    miraFlashEn = ahora; miraFlashCentro = centro;
    disparos.push({ x: mx, y: my, inicio: ahora, shot: true, centro: centro });
  }
  // Flotante de ganancia + latido del marcador (el centro, ganancia grande, palpita).
  function pintarGananciaShot(mx, my, g, centro) {
    flotante(mx, my, '+' + g, ACENTO.vivo, tamGanancia(g), centro);
    if (centro) popMarcador();
    actualizarMarcador();
  }

  // CAMBIO 1 — Demolición del disparo FUERA del centro (ShotClaud): destruye ~la mitad
  // (SHOT.DEMOLE_FRAC) de las celdas vivas del target en la zona del impacto (las más
  // cercanas a la mira), las hace EXPLOTAR (misma mecánica de siempre) y parte el resto en
  // islas que CAEN y se ven caer — reutiliza quizasPartir/F.partirTarget, la MISMA lógica de
  // Big Claude, no la reescribe. No decide puntuación (el llamador anota 50). Marca el resto
  // como "caído" (debris): al re-pegarle vale 50, nunca 200.
  function demolerMitadShot(tg, ti, mx, my, ahora) {
    const n = Math.min(tg.vivos, Math.max(1, Math.ceil(tg.vivos * SHOT.DEMOLE_FRAC)));
    const arrancadas = F.celdasCercanas(tg, mx, my, n);
    const centros = [];
    for (let k = 0; k < arrancadas.length; k++) { centros.push(F.celdaMundo(tg, arrancadas[k])); tg.celdas[arrancadas[k]] = false; }
    tg.vivos -= arrancadas.length;
    tg.masa = F.FISICA.MASA_TARGET * (tg.vivos / 20);
    tg.destelloHasta = ahora + DESTELLO_MS;
    explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base); // el destrozo se VE
    sacudidaHasta = ahora + SACUDIDA_MS;
    if (tg.vivos <= 0) { targets.splice(ti, 1); return; } // no quedó nada → se retira
    tg.tocado = true;
    quizasPartir(tg, mx, my, 1.0);          // el pedazo que sobrevive cae (islas: gravedad, giro, empuje)
    derribarShot(tg);                       // CAMBIO 4: el pedazo principal CAE EN PICADA
    for (let k = 0; k < targets.length; k++) {
      if (targets[k].fragmento) { targets[k].tocado = true; derribarShot(targets[k]); } // trozos = debris que también cae en picada
    }
  }

  // CAÍDA EN PICADA: un target golpeado que sobrevive PIERDE su trayectoria. Corta casi toda la
  // velocidad horizontal (d.VX_FACTOR), arranca hacia abajo (d.VY_MIN) y la gravedad de caída se
  // intensifica (d.GRAV_MULT × la lunar) → derribo, no un objeto que sigue viajando. Conserva/
  // asegura rotación (se ve el impacto). No toca al motor (fisica.js sellado): sólo props del
  // target — la caída se resuelve DESDE FUERA. Mecánica ÚNICA para los dos juegos: `d` es el juego
  // de constantes (SHOT.DERRIBO para ShotClaud —comportamiento intacto— o HIT_DERRIBO para HitClaud,
  // CAMBIO 1). Sigue golpeable y sigue puntuando igual (eso lo deciden los llamadores).
  function derribarShot(t, d) {
    d = d || SHOT.DERRIBO;                                // ShotClaud por defecto: no cambia su comportamiento
    t.vx *= d.VX_FACTOR;                                  // horizontal casi anulada
    if (t.vy < d.VY_MIN) t.vy = d.VY_MIN;                 // arranca la picada (nunca queda subiendo/flotando)
    t.gravedad = F.FISICA.G_TARGET * d.GRAV_MULT;         // gravedad de caída intensificada (picada)
    if (!t.velRot) t.velRot = d.VEL_ROT;                  // conserva rotación (impacto visible)
  }

  // CAMBIO 1 (HitClaud) — un target PEQUEÑO golpeado que NO se destruye se DESPLOMA: reutiliza la
  // misma mecánica (derribarShot) con constantes PROPIAS de HitClaud (HIT_DERRIBO). Pueden diferir
  // de las de ShotClaud: es otro juego. TODAS las constantes de la caída de HitClaud viven aquí.
  //
  // v2.6 — LA CAÍDA DESCRIBE UN ARCO, no un desplome (reporte de Pat tras validar a57cfa6). Antes
  // cortaba casi toda la horizontal (0.06) y aplicaba mucha gravedad (2.0), así que la parábola se
  // cerraba antes de verse. Ahora el target sale del golpe AÚN viajando (conserva el 55% de la
  // horizontal) y la gravedad (×1.4 la lunar) lo va venciendo → arco visible, como un avión
  // derribado. Además el GIRO reacciona al golpe (antes conservaba el que traía): ver giroDerribo.
  const HIT_DERRIBO = {
    VX_FACTOR: 0.55,  // conserva el 55% de la horizontal → sale del golpe AÚN viajando (dibuja el arco)
    VY_MIN: 0.10,     // px/ms: velocidad mínima hacia abajo (nunca queda flotando ni subiendo)
    GRAV_MULT: 1.4,   // gravedad de caída = 1.4 × la lunar → la vence de a poco, cerrando la parábola
    VEL_ROT: 0.004,   // rad/ms: giro de respaldo (fallback) — hoy no se usa, giroDerribo siempre da magnitud
    // GIRO REACTIVO al golpe (v2.6): la magnitud crece con la FUERZA del impacto (|vImpact|) y el
    // SENTIDO sigue el LADO del impacto (a la derecha del centro → +, a la izquierda → −), para que
    // la caída se vea DESCONTROLADA en vez de rígida. Acotado a [GIRO_MIN, GIRO_MAX] para que no
    // parezca un trompo. (Rango propuesto por mí para el veto de Pat.)
    GIRO_MIN: 0.006,        // rad/ms: piso (hasta un golpe flojo descontrola algo el giro)
    GIRO_MAX: 0.030,        // rad/ms: techo (más allá se leería como trompo)
    GIRO_POR_FUERZA: 0.018, // rad/ms por unidad de |vImpact| (golpe fuerte → gira más)
  };
  // ¿este target se DESPLOMA al ser golpeado sin destruirse? SÓLO los pequeños de HitClaud. Big
  // Claude (grande) y cualquier isla/fragmento conservan su comportamiento actual, con su flote
  // lunar (1.5). Puro: no toca nada. La caída (1.3: sigue golpeable y puntúa igual) no la decide aquí.
  function seDesploma(tg) { return !tg.grande && !tg.fragmento; }
  // Giro que imprime el golpe a la caída (HitClaud, v2.6): SENTIDO por el lado del impacto (mx
  // respecto al centro tg.x) y MAGNITUD por la fuerza (|vImpact|), acotada a [GIRO_MIN, GIRO_MAX].
  // vImpact≈1 en el hitscan nominal; en la bolita es la rapidez real del golpe (golpe fuerte → gira
  // más). Puro. Reemplaza la rotación previa: por eso la caída se ve descontrolada, no rígida.
  function giroDerribo(tg, mx, my, vImpact) {
    const d = HIT_DERRIBO;
    const dir = (mx >= tg.x) ? 1 : -1;                       // lado del impacto → sentido del giro
    const fuerza = Math.abs(vImpact || 1);
    const mag = Math.min(d.GIRO_MAX, Math.max(d.GIRO_MIN, d.GIRO_MIN + fuerza * d.GIRO_POR_FUERZA));
    return dir * mag;
  }
  // Aplica la picada a un target de HitClaud que sobrevivió al golpe, si le corresponde (1.5). El
  // giro se fija ANTES de derribarShot (que sólo pone su fallback si velRot fuese 0) → prevalece el
  // giro reactivo al golpe (v2.6).
  function derribarHit(tg, mx, my, vImpact) {
    if (!seDesploma(tg)) return;
    tg.velRot = giroDerribo(tg, mx, my, vImpact);            // el giro REACCIONA al golpe (ya no conserva el previo)
    derribarShot(tg, HIT_DERRIBO);
  }

  // ═══ PUSHCLOUDE (v2.9): aplastar con el dedo ═══════════════════════════════════════════════════
  // Cuenta atrás de reinicio RÁPIDA (5.3): tinte+sacudida (FLASH) y luego 3-2-1 (CUENTA c/u).
  const PUSH_RESET_FLASH_MS = 320;   // tinte rojo + sacudida FUERTE al tocar el rojo / stop (5.2)
  const PUSH_RESET_CUENTA_MS = 260;  // cada número de la cuenta atrás → total ≈ 320 + 3·260 = 1100ms
  const PUSH_SACUDIDA_AMP = 9;       // px: sacudida FUERTE (más marcada que SACUDIDA_AMP=2 de siempre, 5.2)

  // APLASTAR (CAMBIO 2/3): resuelve un toque. CENTRO de un target intacto → destruye entero, 200×racha
  // (3.3). FUERA → arranca ~1/3 y el resto SIGUE SU RUTA sin desplomarse, 50 sin multiplicar, rompe
  // racha (3.4). ROJO → reinicia la partida entera (5). VACÍO → resta y rompe racha (3.5). Cada toque
  // cuenta para el medidor de efectividad (3.8). Puntuación pura en js/pushclaud.js.
  function aplastar(mx, my) {
    if (!jugando || secuencia || pushReset) return;   // ignora toques durante el reinicio/fin
    const ahora = performance.now();
    marcarActividad();
    pTiros += 1;                                       // un TOQUE (denominador del medidor, 3.8)
    for (let ti = targets.length - 1; ti >= 0; ti--) {
      const tg = targets[ti];
      if (!tg.haEntrado) continue;
      if (F.celdaEnPunto(tg, mx, my) < 0) continue;   // el toque no cae sobre este target
      pAciertos += 1;
      if (tg.rojo) { reinicioPorRojoPush(tg, mx, my); return; } // ROJO → reinicia la partida (5)
      tg.destelloHasta = ahora + DESTELLO_MS;
      if (!tg.tocado && PU.enZonaCentral(tg, mx, my)) { // CENTRO de un target intacto → destruye entero
        const r = PU.anotarCentro(marcador);
        if (marcador.racha > pRachaMax) pRachaMax = marcador.racha;
        const centros = [];
        for (let k = 0; k < tg.celdas.length; k++) { if (tg.celdas[k]) { centros.push(F.celdaMundo(tg, k)); tg.celdas[k] = false; } }
        tg.vivos = 0;
        explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base);
        targets.splice(ti, 1);
        sacudidaHasta = ahora + SACUDIDA_MS;
        mostrarBonoCentro(mx, my, r.ganancia);        // celebración dorada (200 × racha)
        popMarcador();
        actualizarMarcador();
        return;
      }
      // FUERA del centro (3.4): arranca ~1/3 en la zona del toque; el RESTO SIGUE SU RUTA (NO se
      // desploma: no se toca la gravedad ni se parte en islas). 50 sin multiplicar, rompe la racha.
      const n = Math.min(tg.vivos, Math.max(1, Math.ceil(tg.vivos * PUSH.ARRANCA_FRAC)));
      const arrancadas = F.celdasCercanas(tg, mx, my, n);
      const centros = [];
      for (let k = 0; k < arrancadas.length; k++) { centros.push(F.celdaMundo(tg, arrancadas[k])); tg.celdas[arrancadas[k]] = false; }
      tg.vivos -= arrancadas.length;
      tg.masa = F.FISICA.MASA_TARGET * (tg.vivos / 20);
      tg.tocado = true;                               // ya mordido → re-tocarlo vale lateral, no centro
      tg.vy += PUSH.EMPUJON;                          // leve empujón del golpe (sigue su ruta con su gravedad)
      explotarCubos(centros, mx, my, 1.0, tg.vx, tg.vy, ACENTO.base);
      if (tg.vivos <= 0) targets.splice(ti, 1);       // si no quedó nada, se retira
      const r = PU.anotarLateral(marcador);
      flotante(mx, my, '+' + r.ganancia, ACENTO.vivo, tamGanancia(r.ganancia), false);
      actualizarMarcador();
      return;
    }
    // No tocó ningún target → VACÍO: resta y rompe racha (3.5).
    const r = PU.anotarFallo(marcador);
    actualizarMarcador();
    registrarPerdida(r.castigo);
  }

  // ROJO → REINICIA la partida entera, sin salir de la pantalla (CAMBIO 5). Explota el rojo, resta
  // los puntos VISIBLEMENTE, y arranca la máquina de reinicio (tinte rojo + sacudida fuerte + cuenta
  // atrás 3-2-1). El reloj/ciclo/racha vuelven a cero al TERMINAR la cuenta (loop). Esta partida NO
  // cuenta para récord ni ranking (5.5): nunca se llama a terminarPartida.
  function reinicioPorRojoPush(tg, mx, my) {
    const ahora = performance.now();
    try { explotarCubos(F.cubosVivosMundo(tg), mx, my, 1.6, tg.vx, tg.vy, COLOR.cloudoverB); } catch (e) {}
    const i = targets.indexOf(tg); if (i >= 0) targets.splice(i, 1);
    if (marcador.puntos > 0) registrarPerdida(marcador.puntos); // resta visible (bordes + monto rojos)
    marcador.puntos = 0; marcador.racha = 0; actualizarMarcador();
    try { if (navigator && navigator.vibrate) navigator.vibrate(200); } catch (e) {}
    gesto.activo = false;
    pushReset = { modo: 'reinicio', inicio: ahora }; // el loop congela y corre la cuenta atrás
  }

  // STOP (CAMBIO 7): sacudida con tinte rojo y SALE al home de Pushcloude. Esta partida no cuenta
  // (7.3): no se guarda récord ni se envía. Reusa la máquina de reinicio en modo 'salir' (sólo el
  // flash, sin cuenta atrás) → al terminar el flash va al home.
  function salirPush() {
    if (!jugando || secuencia || pushReset) return;
    const ahora = performance.now();
    if (marcador.puntos > 0) registrarPerdida(marcador.puntos);
    marcador.puntos = 0; actualizarMarcador();
    try { if (navigator && navigator.vibrate) navigator.vibrate(200); } catch (e) {}
    gesto.activo = false;
    pushReset = { modo: 'salir', inicio: ahora };
  }
  // Fase de la cuenta atrás de reinicio: -1 durante el flash; 3/2/1 durante los números; 0 = terminó.
  function pushResetNumero(elapsed) {
    if (elapsed < PUSH_RESET_FLASH_MS) return -1;
    const n = 3 - Math.floor((elapsed - PUSH_RESET_FLASH_MS) / PUSH_RESET_CUENTA_MS);
    return n; // 3,2,1 y luego ≤0 (terminó)
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
      golpes: 0,     // nº de impactos resueltos de ESTA bola (cadena → bono de carambola)
      ultimoX: fin.x, ultimoY: fin.y, // posición del último impacto (dónde nace el bono flotante)
      historia: [],
    });
    pTiros += 1;                             // una bola (móvil) lanzada
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

  // Botón SALIR (casa) de la barra: ABANDONA la partida al instante y vuelve al inicio
  // (1.3). Reemplaza al viejo botón de pausa y a su menú (eliminados). Durante la secuencia
  // de CloudOver no interrumpe (esa animación tiene su propio cierre). El flag interno
  // `pausado` ya no lo activa nadie: queda como guarda inerte que el freeze de CloudOver
  // comparte (no se toca esa lógica).
  const botonSalir = document.getElementById('botonSalir');
  if (botonSalir) botonSalir.addEventListener('click', function () {
    if (secuencia) return; // la caída del CloudOver está corriendo → no se interrumpe
    abandonarPartida();
  });
  // STOP (CAMBIO 7): sólo Pushcloude. Sacudida con tinte rojo y sale al home; esa partida no cuenta.
  // Obligatorio: como Pushcloude no se detiene solo (7.5), este botón es la salida garantizada.
  const botonStop = document.getElementById('botonStop');
  if (botonStop) botonStop.addEventListener('click', function () {
    if (secuencia || pushReset) return;
    salirPush();
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

    // PUSHCLOUDE — REINICIO por rojo (5) / SALIDA por stop (7): congela el juego y corre el flash
    // (+ cuenta atrás 3-2-1 en 'reinicio'). NO cuenta para récord ni ranking (nunca llama a
    // terminarPartida). Al terminar: 'reinicio' arranca una partida nueva del mismo modo, sin salir
    // de la pantalla (5.4); 'salir' va al home de Pushcloude (7.2).
    if (pushReset) {
      const el = t - pushReset.inicio;
      if (pushReset.modo === 'salir') {
        if (el >= PUSH_RESET_FLASH_MS) { pushReset = null; mostrarHome('pushclaud', false); dibujar(); return; }
      } else if (el >= PUSH_RESET_FLASH_MS + 3 * PUSH_RESET_CUENTA_MS) {
        pushReset = null;
        reiniciarEstado();
        tiempoRestante = DURACIONES[modoJuego] || 0;   // el reloj de la partida vuelve a cero (5.2)
        pushCicloBase = 0; pushCicloRestante = PU.CICLO_MS; pushCicloCumplido = false;
        actualizarTiempo();
        dibujar(); return;
      }
      dibujar(); return; // congelado durante el flash/cuenta atrás
    }

    // Pausado o SIN PARTIDA (overlay de inicio/fin arriba): congela toda
    // actualización (física, spawn, colisión, cobro); solo re-dibuja el estado.
    if (pausado || !jugando) { cobrando = false; dibujar(); return; }

    // Modos CRONOMETRADOS (30 y 60): el reloj SÓLO corre jugando (gateado con
    // !secuencia: durante la secuencia de CloudOver se detiene). Al agotarse, termina
    // por TIEMPO. Un modo sin entrada en DURACIONES no correría reloj. Parametrizado (no por modo).
    if (DURACIONES[modoJuego] && !secuencia) {
      tiempoRestante -= dt;
      if (tiempoRestante <= 0) { tiempoRestante = 0; terminarPartida(true); dibujar(); return; }
      actualizarTiempo(); // refresca el temporizador de la barra (texto y estado <5s)
    }

    // PUSHCLOUDE — CICLO DE METAS de 15 s (CAMBIO 4), en paralelo al reloj de la partida. Al cerrar
    // el ciclo: si ganó ≥1000 conserva y sigue acumulando (4.2); si no, puntos y racha a 0 (4.3). El
    // reloj de la partida NO se toca aquí. La meta es SIEMPRE 1000 (la exigencia no sube, 4.2).
    if (esPush() && DURACIONES[modoJuego]) {
      pushCicloRestante -= dt;
      if (pushCicloRestante <= 0) {
        const antes = marcador.puntos;
        const res = PU.cerrarCiclo(marcador, pushCicloBase);
        if (!res.cumplida && antes > 0) registrarPerdida(antes); // pérdida visible al fallar la meta
        pushCicloBase = res.base;
        pushCicloRestante = PU.CICLO_MS;
        actualizarMarcador();
      }
      pushCicloCumplido = PU.metaCumplida(marcador, pushCicloBase); // aviso "vas a salvo" (4.5)
    }

    // Costo de INACTIVIDAD: tras la gracia, cada segundo quieto cuesta el 25%
    // del castigo del tramo actual. El reloj NO corre si el documento está
    // oculto (ya gateado) ni mientras hay un gesto activo. Piso en 0.
    cobrando = false;
    // Pushcloude no cobra inactividad: su presión es el ciclo de 15 s, no el reloj de gracia.
    if (!document.hidden && !gesto.activo && !secuencia && !esPush()) {
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
        // NO golpeable hasta ENTRAR a escena: un target recién spawneado nace fuera del
        // viewport (fisica.js) con haEntrado=false y su caja puede solapar el borde. Se
        // salta ANTES de todo (rojo y naranja): no resuelve impacto, no dispara CloudOver,
        // no suma golpe, no puntúa, no se parte. Los fragmentos nacen con haEntrado=true
        // (fisica.js) → golpeables desde el primer cuadro.
        if (!tg.haEntrado) continue;
        if (tg.rojo && !tg.fragmento) {
          // ROJO (CloudOver): cualquier contacto de la hitball arranca la secuencia.
          // Sólo el CloudOver ENTERO mata: un fragmento NUNCA es rojo (los rojos no se
          // parten — cualquier toque los dispara antes de destruir celdas), pero el
          // guard `!tg.fragmento` lo blinda: un trozo jamás termina la partida.
          if (!F.colisionCirculoRect(b, tg)) continue;
          golpeCloudover(tg, b.x, b.y);
          return; // corta el cuadro; la secuencia toma el control
        }
        // NARANJA (el que puntúa): daño por cubos + ganancia × racha.
        const r = F.resolverImpacto(b, tg);
        if (!r) continue;
        cascEvento('resolverImpacto', 'tipo:' + r.tipo + ' destruidos:' + r.destruidos + ' muerto:' + r.muerto);
        b.golpes += 1;                         // cadena: cuenta CADA impacto (mismo target o no)
        // CARAMBOLA en el 2º golpe: se ANOTA +500 Y se MUESTRA el número, JUNTOS, en el
        // impacto (número acoplado al marcador). Una sola vez por bola: del 3er golpe en
        // adelante NO pasa nada (ni puntos, ni número). No se cobra a la muerte.
        if (b.golpes === 2) {
          P.anotarCarambola(marcador, 2);      // +500 (limpio, sin racha), una sola vez
          pCarambolas += 1;                    // una carambola cobrada (para /partida)
          cascEvento('anotarCarambola', 'golpes:2 bono:500');
          mostrarBonoCarambola(r.px, r.py);    // mismo instante y punto (actualizarMarcador abajo lo refleja)
        }
        tg.destelloHasta = t + DESTELLO_MS;    // destello en CUALQUIER contacto
        if (!b.tocado) {                       // primer toque = hit (sube la racha continua)
          b.tocado = true;
          pAciertos += 1;                      // esta bola golpeó algo (una vez por bola → acierto ≤ tiros)
          P.anotarHit(marcador);
          if (marcador.racha > pRachaMax) pRachaMax = marcador.racha;
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
        } else {
          if (r.destruidos > 0) quizasPartir(tg, r.px, r.py, r.vImpact); // ¿quedó partido? desprende trozos
          derribarHit(tg, r.px, r.py, r.vImpact); // CAMBIO 1: el que sobrevive cae describiendo un arco (giro por el golpe)
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
        // La CARAMBOLA ya se cobró y se mostró en el 2º golpe (arriba). Al morir NO se
        // anota nada: no hay bono a la muerte, ni modo final, ni caso expirado. El número
        // vive su animación completa por su cuenta (lista `bonos`), aunque su bola muera.
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
    if (targets.length < capEnPantalla() && t >= proximoSpawn) {
      generarNaranja();
      proximoSpawn = t + retardoNaranja(t);
    }
    // ESCALADA de ROJOS: sube de nivel cada 5–10s (sin tope); el nivel acorta su intervalo.
    P.pasoEscalada(escalada, t, Math.random);
    if (targets.length < capEnPantalla() && t >= proximoRojo) {
      // TOPE DURO (CAMBIO 4.2): en ShotClaud los rojos NUNCA superan en número a los naranjas.
      // Si ya hay tantos rojos como naranjas, se salta el turno (el timer vencido reintenta en
      // cuanto aparezca un naranja). En HitClaud no aplica: escala como siempre.
      const c = contarTargets();
      const puedeRojo = !(esShot() || esPush()) || c.rojos < c.naranjas; // tope duro: rojos ≤ naranjas
      if (puedeRojo) {
        generarRojo();
        // ShotClaud/Pushcloude ajustan la frecuencia de rojos con su ROJO_FACTOR (menor factor → más rojos).
        const factorRojo = esPush() ? PUSH.ROJO_FACTOR : esShot() ? SHOT.ROJO_FACTOR : 1;
        proximoRojo = t + P.intervaloRojo(escalada.nivel) * factorRojo * rnd(ROJO_JITTER[0], ROJO_JITTER[1]);
      }
    }
    // GRANDE: mínimo 8s entre apariciones; nunca dos a la vez; tope de 2. ShotClaud NO lanza Big Claude.
    if (!sinGrande() && targets.length < capEnPantalla() && t >= proximoGrande && !targets.some(function (x) { return x.grande; })) {
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

  // Porcentaje de efectividad (PURO): aciertos sobre disparos, 0..100 entero. Sin disparos
  // devuelve null (no hay valor hasta el primer disparo). No afecta puntaje ni récord.
  function efectividadPct(aciertos, tiros) {
    if (!tiros || tiros <= 0) return null;
    return Math.round((Math.max(0, aciertos) / tiros) * 100);
  }
  // Dibuja el MEDIDOR de efectividad en la esquina inferior izquierda (sólo ShotClaud, en el
  // canvas → nunca captura input). Grande y translúcido. Sin valor hasta el primer disparo.
  function dibujarMedidorShot() {
    const pct = efectividadPct(pAciertos, pTiros);
    if (pct === null) return;                    // sin valor hasta el primer disparo (5.5)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = ACENTO.vivo;
    ctx.globalAlpha = MEDIDOR_ALFA_ET;           // etiqueta arriba del número
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + MEDIDOR_ETIQUETA + 'px ' + COLOR.fuente;
    ctx.fillText('precisión', MEDIDOR_MARGEN, H - MEDIDOR_MARGEN - MEDIDOR_TAM);
    ctx.globalAlpha = MEDIDOR_ALFA_NUM;          // número grande translúcido
    ctx.font = '800 ' + MEDIDOR_TAM + 'px ' + COLOR.fuente;
    ctx.fillText(pct + '%', MEDIDOR_MARGEN, H - MEDIDOR_MARGEN);
    ctx.restore();
  }

  // RETÍCULA de ShotClaud (desktop): cruz de 4 trazos con hueco central y punto al
  // centro, que SIGUE al cursor. RETROCESO: al disparar los 4 brazos se abren y se
  // cierran en MIRA_RETROCESO_MS. DESTELLO de acierto: anillo que crece y se apaga,
  // DISTINTO si fue al centro (grande, acento vivo) o no (chico, tenue). SIN
  // shadowBlur: sólo color, tamaño y trazo. NO dibuja la sombra del destello de HitClaud.
  function dibujarReticulaShot(ahoraB) {
    // Marcas de cada disparo: anillo que se expande y se desvanece (centro vs no).
    for (let i = disparos.length - 1; i >= 0; i--) {
      const s = disparos[i];
      const p = (ahoraB - s.inicio) / DISPARO_MS;
      if (p >= 1) { disparos.splice(i, 1); continue; }
      const rBase = s.centro ? 22 : 12;      // el acierto al centro deja una marca más grande
      ctx.save();
      ctx.globalAlpha = (1 - p) * (s.centro ? 0.9 : 0.55);
      ctx.strokeStyle = s.centro ? ACENTO.vivo : ACENTO.base;
      ctx.lineWidth = s.centro ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, rBase * (0.5 + p), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (!(miraActiva && miraX >= 0)) return;
    // RETROCESO: 0→1→0 en MIRA_RETROCESO_MS (sube y baja) → los brazos se abren y cierran.
    const dt = ahoraB - miraDisparoEn;
    let retro = 0;
    if (dt >= 0 && dt < MIRA_RETROCESO_MS) {
      const u = dt / MIRA_RETROCESO_MS;          // 0..1
      retro = Math.sin(u * Math.PI);             // 0→1→0: pico a la mitad
    }
    const sep = retro * MIRA_RETROCESO_PX;       // px extra de apertura del hueco y de los brazos
    const g0 = 5 + sep;                          // inicio del brazo (hueco central)
    const g1 = 16 + sep;                         // fin del brazo
    // DESTELLO de acierto sobre la cruz: la tiñe más viva un instante (centro = más).
    const fdt = ahoraB - miraFlashEn;
    const flash = (fdt >= 0 && fdt < MIRA_FLASH_MS) ? (1 - fdt / MIRA_FLASH_MS) : 0;
    // CAMBIO 4: LA MIRA en BLANCO PURO (antes compartía el naranja de la cascada y se perdía).
    // Trazo grueso y opacidad plena → se lee sobre CUALQUIER fondo (cascada, targets, cubos,
    // explosión). Sin contorno oscuro, sin shadowBlur.
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5 + flash * (miraFlashCentro ? 2.5 : 1); // grueso base + engrosa al destellar
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(miraX, miraY, 11 + sep, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(miraX - g1, miraY); ctx.lineTo(miraX - g0, miraY);
    ctx.moveTo(miraX + g0, miraY); ctx.lineTo(miraX + g1, miraY);
    ctx.moveTo(miraX, miraY - g1); ctx.lineTo(miraX, miraY - g0);
    ctx.moveTo(miraX, miraY + g0); ctx.lineTo(miraX, miraY + g1);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; // 4.4: punto central BLANCO y visible (donde va el disparo)
    ctx.beginPath(); ctx.arc(miraX, miraY, 2.5 + flash * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Pintura ────────────────────────────────────────────────────────
  function dibujar() {
    const _dib0 = performance.now(); // (debug v41-fps) inicio del cronómetro de dibujo
    ctx.clearRect(0, 0, W, H);
    dibujarFondoDatos(); // CAPA DE FONDO: datos reales FIJOS (valor en vivo), detrás de todo
    dibujarContadorTiempo(); // CONTADOR marca de agua: fondo, detrás de targets/bola/cubos/efectos (1.4)

    // Micro-sacudida de pantalla (solo en destrucción): desplaza todo el dibujo.
    let ox = 0;
    let oy = 0;
    const rem = sacudidaHasta - performance.now();
    if (rem > 0) {
      const p = rem / SACUDIDA_MS;
      ox = (Math.random() * 2 - 1) * SACUDIDA_AMP * p;
      oy = (Math.random() * 2 - 1) * SACUDIDA_AMP * p;
    }
    // PUSHCLOUDE: sacudida FUERTE durante el flash del reinicio por rojo / stop (5.2, más marcada).
    if (pushReset) {
      const elp = performance.now() - pushReset.inicio;
      if (elp < PUSH_RESET_FLASH_MS) {
        const p = 1 - elp / PUSH_RESET_FLASH_MS;
        ox += (Math.random() * 2 - 1) * PUSH_SACUDIDA_AMP * p;
        oy += (Math.random() * 2 - 1) * PUSH_SACUDIDA_AMP * p;
      }
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
    // Marcador Actual: rojo durante el VACIADO del CloudOver (vaciado/cero) y durante los
    // 400ms al restar; si no, BLANCO (el puntaje es el dato dominante de la barra, P1/1.1).
    const enVaciado = !!secuencia && (secuencia.fase === 'vaciado' || secuencia.fase === 'cero');
    if (elActual) elActual.style.color = (enVaciado || ahoraB < contadorRojoHasta) ? ROJO_CONTADOR : PUNTAJE_BLANCO;

    if (esDesktop && esShot()) {
      // ShotClaud: medidor de efectividad (esquina inf-izq, sólo dibujo) + retícula de precisión.
      dibujarMedidorShot();
      dibujarReticulaShot(ahoraB);
    } else if (esDesktop) {
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
    } else if (esPush()) {
      // PUSHCLOUDE (móvil, SIN bola ni mira, 2.1): sólo el medidor de efectividad (3.8), como Shotcloude.
      dibujarMedidorShot();
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
      // GLOW sin CONTORNO (CAMBIO 2): disco de degradado cacheado detrás del número, en vez
      // del strokeText del halo. Sin contorno oscuro; la legibilidad la da color + disco + tamaño.
      if (fl.glow && discoFlotante) {
        const rr = fl.tam * 1.15;
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.5;
        ctx.drawImage(discoFlotante.canvas, -rr, -rr, rr * 2, rr * 2);
        ctx.globalAlpha = a0;
      }
      ctx.fillStyle = colFl;
      ctx.fillText(fl.texto, 0, 0);
      ctx.restore();
    }
    // BONO DE CARAMBOLA flotante: "+500 / HITS ×2", uno por carambola (lista `bonos`,
    // independiente de su bola: vive su animación completa aunque la bola muera). Rebote
    // de escala (0→pico→asiento), destello blanco→color, subida con frenado, fade tardío
    // y HALO por disco cacheado. Sin shadowBlur y sin crear gradientes en el bucle.
    for (let bi = bonos.length - 1; bi >= 0; bi--) {
      const bc = bonos[bi];
      const age = performance.now() - bc.inicio;
      if (age >= BONO_VIDA) { bonos.splice(bi, 1); continue; }
      const p = age / BONO_VIDA;
      // REBOTE de escala (px de fuente): 0→pico(62) en 90ms, pico→asiento(40) en 130ms, luego asiento.
      let fs;
      if (age < 90) fs = suave(age / 90) * BONO_PICO;
      else if (age < 220) fs = BONO_PICO + suave((age - 90) / 130) * (BONO_ASIENTO - BONO_PICO);
      else fs = BONO_ASIENTO;
      // SUBIDA con frenado (ease-out): 56px en 1100ms.
      const dy = frena(p) * BONO_SUBE;
      // OPACIDAD: 1 hasta el 55% de la vida; del 55% al 100% cae suave a 0.
      const alpha = p <= 0.55 ? 1 : 1 - suave((p - 0.55) / 0.45);
      // DESTELLO: 0–80ms blanco; 80–180ms blanco→color; luego color puro.
      let col;
      if (age < 80) col = '#FFFFFF';
      else if (age < 180) col = lerpColor('#FFFFFF', BONO_COLOR, (age - 80) / 100);
      else col = BONO_COLOR;
      const cx = bc.x, cy = bc.y - dy;
      ctx.save();
      // HALO: disco cacheado, escalado por el rebote; misma opacidad/posición (máx 35%).
      if (discoBono) {
        const rr = discoBono.r * (fs / BONO_ASIENTO);
        ctx.globalAlpha = Math.max(0, alpha) * 0.35;
        ctx.drawImage(discoBono.canvas, cx - rr, cy - rr, rr * 2, rr * 2);
      }
      // TEXTO (sin contorno; el disco de halo lo reemplaza). Carambola = 2 renglones
      // ('+500' / 'HITS ×2'); centro de ShotClaud = 1 renglón ('+200'), centrado.
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = col;
      const sub = bc.sub;
      ctx.font = '800 ' + fs.toFixed(1) + 'px ' + COLOR.fuente;
      ctx.fillText(bc.texto || '+500', cx, sub ? cy - fs * 0.36 : cy);
      if (sub) {
        ctx.font = '800 ' + (fs * 0.55).toFixed(1) + 'px ' + COLOR.fuente;
        ctx.fillText(sub, cx, cy + fs * 0.5);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    } finally {
      ctx.restore(); // SIEMPRE restaura la transformación del MUNDO (cámara + sacudida)
    }
    // A partir de aquí: capa de UI SIN transformar (pegada al viewport real): badge de
    // racha, bordes, monto, temporizador y medidor v41-fps → tamaño normal, sin cámara.

    // BADGE del multiplicador de racha "×N" (UI, arriba-centro, NO se transforma con la
    // cámara/sacudida). Aparece con mult>1. SIN contorno ni latido: halo por disco cacheado
    // (máx 30%). CAMBIO 2.3: el asiento CRECE con el valor (multAsiento: 42px en ×1 → 78px en ×5);
    // sobre ese asiento, REBOTA (+MULT_REBOTE) y DESTELLA (blanco→color) al CAMBIAR de valor; fuera
    // de ese momento queda quieto en su asiento. Sólo cambia el tamaño: color/peso/halo/rebote igual.
    const mult = P.multRacha(marcador.racha);
    const nowM = performance.now();
    if (mult !== multAnterior) { multCambioEn = nowM; multAnterior = mult; } // detecta el cambio
    if (mult > 1) {
      const dc = nowM - multCambioEn; // ms desde el último cambio de valor
      const asiento = multAsiento(mult);   // asiento SEGÚN el valor (crece de 42 a 78, CAMBIO 2.3)
      const pico = asiento + MULT_REBOTE;  // el rebote conserva su amplitud (+10px, 2.4)
      // REBOTE al cambiar: brinca al pico y regresa al asiento en 220ms (suavizado); luego quieto.
      const fs = dc < 220 ? pico + suave(dc / 220) * (asiento - pico) : asiento;
      // DESTELLO: 0–80ms blanco; 80–180ms blanco→color; luego color.
      let col;
      if (dc < 80) col = '#FFFFFF';
      else if (dc < 180) col = lerpColor('#FFFFFF', MULT_COLOR, (dc - 80) / 100);
      else col = MULT_COLOR;
      const txtMult = '×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1));
      const mx = W / 2, my = Math.max(158, H * 0.16); // posición actual (bajo el temporizador)
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // HALO: disco cacheado, escalado por el rebote (máx 30%).
      if (discoMult) {
        const rr = discoMult.r * (fs / MULT_ASIENTO);
        ctx.globalAlpha = 0.30;
        ctx.drawImage(discoMult.canvas, mx - rr, my - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.font = '800 ' + fs.toFixed(1) + 'px ' + COLOR.fuente;
      ctx.fillText(txtMult, mx, my);
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

    // TEMPORIZADOR: ya NO se dibuja en el canvas. Vive en la barra (DOM), junto al puntaje
    // (D3: antes estaba lejos del puntaje y los targets lo tapaban). Lo maneja actualizarTiempo().

    // PUSHCLOUDE: indicador del CICLO de 15 s (4.4/4.5) y, encima, el overlay de REINICIO por rojo
    // (tinte rojo + cuenta atrás 3-2-1) o de STOP (tinte, 5/7). Capa de UI, sin cámara, siempre arriba.
    if (esPush()) { dibujarCicloPush(); if (pushReset) dibujarReinicioPush(nowP); }

    // (FASE 16) El recuadro del medidor v41-fps se ELIMINÓ: sus cifras (F, D, peor,
    // conteos) ahora caen como líneas de la CASCADA, como cualquier otro dato real.
    ultimoDibujoMs = performance.now() - _dib0; // (debug v41-fps) duración total del dibujo
  }

  // PUSHCLOUDE — indicador del CICLO de 15 s (CAMBIO 4.4): claramente DISTINTO del reloj de la
  // partida (que vive en la barra y en la marca de agua del canvas). Muestra los segundos que faltan
  // del ciclo y el progreso hacia la meta de 1000; cuando la meta ya está cumplida, se pone verde y
  // avisa "A SALVO" (4.5). Canvas puro (no captura toques). SIN shadowBlur.
  function dibujarCicloPush() {
    if (!jugando || !DURACIONES[modoJuego]) return;
    const seg = Math.max(0, Math.ceil(pushCicloRestante / 1000));
    const prog = Math.max(0, PU.progresoCiclo(marcador, pushCicloBase));
    const cumplida = prog >= PU.META_PUNTOS;
    const cx = W / 2, y = 84;
    const col = cumplida ? tk('--push-safe', '#6FFF2C') : tk('--push-ciclo', '#FFC6B5');
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.92;
    ctx.font = '800 22px ' + COLOR.fuente;
    ctx.fillText('CICLO ' + seg + 's', cx, y);
    ctx.globalAlpha = 0.82;
    ctx.font = '700 15px ' + COLOR.fuente;
    ctx.fillText((cumplida ? '✓ A SALVO · ' : '') + prog + ' / ' + PU.META_PUNTOS, cx, y + 21);
    // Barra de progreso hacia la meta.
    const bw = 168, bh = 6, bx = cx - bw / 2, by = y + 34;
    ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * Math.min(1, prog / PU.META_PUNTOS), bh, 3); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // PUSHCLOUDE — overlay del REINICIO por rojo / STOP (CAMBIO 5/7): tinte rojo que se desvanece y, en
  // 'reinicio', la cuenta atrás 3-2-1 grande y centrada. La sacudida fuerte la aplica el bloque de ox/oy.
  function dibujarReinicioPush(now) {
    if (!pushReset) return;
    const el = now - pushReset.inicio;
    const flashP = Math.max(0, 1 - el / PUSH_RESET_FLASH_MS);
    const alpha = (el < PUSH_RESET_FLASH_MS) ? (0.5 * flashP + 0.14) : (pushReset.modo === 'reinicio' ? 0.10 : 0);
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tk('--push-tinte', '#FF0033');
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (pushReset.modo === 'reinicio') {
      const n = pushResetNumero(el);
      if (n >= 1 && n <= 3) {
        ctx.save();
        ctx.globalAlpha = 0.95; ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '900 120px ' + COLOR.fuente;
        ctx.fillText(String(n), W / 2, H / 2);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
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
    // CAMBIO 3.6: el destello de contacto es un PARPADEO MOMENTÁNEO (no cambia el color del
    // target). En ShotClaud es BLANCO puro (que se vea qué golpeaste); en HitClaud, la crema
    // de siempre. El color base del target (ACENTO.base / rojo) NO cambia.
    if (destella) col = esShot() ? '#FFFFFF' : COLOR.crema;
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
    // CAMBIO 3.2 — PUSHCLOUDE: la ZONA CENTRAL SE DIBUJA (dónde apuntar). El cuarto central (mitad
    // del ancho × mitad del alto, centrado — MISMA geometría que S.enZonaCentral). Un marco claro que
    // se distingue sin parecer otro objeto: contorno blanco tenue. Sólo en targets intactos (no rojo,
    // no mordido: ya no tienen centro que dé 200). SIN shadowBlur.
    if (esPush() && !t.rojo && !t.tocado) {
      const hw = COLS * 2, hh = FILAS * 2; // medio-eje del cuarto central (COLS*8/2 * 0.5 = COLS*2)
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, hw * 2, hh * 2, 2);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
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

  // (CAMBIO 2) Se eliminó haloTexto: era el ÚNICO strokeText de números del canvas (contorno
  // que se veía sucio). Los flotantes con glow ahora usan un DISCO cacheado (discoFlotante);
  // el bono y el multiplicador ya usaban su disco. Ningún número lleva contorno.

  // Desktop: marca el <html> para ocultar el hitmaker y el cursor del sistema
  // (la mira lo reemplaza). Móvil: todo queda como estaba.
  if (esDesktop) document.documentElement.classList.add('desktop');

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  actualizarRecord();    // récord del modo por defecto (60 seg) hasta elegir
  actualizarSaludo();   // pinta el saludo del inicio con el nombre guardado (si existe)
  marcarActividad();     // inicia el reloj de inactividad (evita cobro al arrancar)
  escalada = P.crearEscalada(performance.now(), Math.random); // estado inicial válido
  // ARRANQUE: la app SIEMPRE abre en el HOME de HitClaud (1.2). Si ya hay nombre → home; si no y
  // el almacén sirve → pedir nombre (confirmar/omitir llevan al home); si el almacén está roto →
  // al home sin nombre. El bucle corre congelado detrás.
  if (nombreUsuario) mostrarHome('hitclaud', true);
  else if (puedeGuardarNombre) mostrarPantallaNombre();
  else mostrarHome('hitclaud', true);
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
