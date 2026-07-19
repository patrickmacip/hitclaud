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
    azul: tk('--azul', '#1F55C9'),        // castigo (antes azul)
    dorado: tk('--dorado', '#FFC300'),
    cian: tk('--cian', '#22D3EE'),
    disperso: tk('--disperso', '#6FFF2C'), // dispersión de moneda (verde)
    cloudoverA: tk('--cloudover-a', '#B1003B'),
    cloudoverB: tk('--cloudover-b', '#FF0055'),
    textoApagado: tk('--texto-apagado', '#8989B1'),
    fuente: tk('--fuente', "'Inter', system-ui, -apple-system, sans-serif"),
  };

  // BAÑO DE COLOR TOTAL POR MODO: al entrar a un modo, TODO se tiñe con una
  // PALETA ARMÓNICA de 4 roles — targets (normales Y especiales), hitball,
  // hitmaker, marcador, récord, toda la UI y el texto. Lo ÚNICO intocable: el
  // FONDO #121216 y la SUPERFICIE de la barra #15151C. Los modos NO se suman: se
  // REEMPLAZAN. Precedencia: castigo > bonanza > power-up > normal.
  //   base     = targets / cuerpo principal.
  //   vivo     = hitball, acentos (más brillante/saturado).
  //   claro    = récord y jerarquía secundaria de UI/texto (tono más claro).
  //   profundo = contraste dentro del modo (tono más oscuro; NUNCA fondo/superficie).
  const MODOS = {
    normal:  { base: '#E8704E', vivo: '#FF8764', claro: '#FFC9B8', profundo: '#A84A2E' },
    bonanza: { base: '#FFC300', vivo: '#FFD84D', claro: '#FFEBA3', profundo: '#B88C00' },
    power:   { base: '#6FFF2C', vivo: '#9CFF6B', claro: '#CBFFAD', profundo: '#3FA817' },
    castigo: { base: '#1F55C9', vivo: '#4E82F5', claro: '#AFC6F7', profundo: '#143C8F' },
  };
  function modoActivo(t) {
    if (t < debuffHasta) return MODOS.castigo;   // castigo (bola chica)
    if (t < fiestaHasta) return MODOS.bonanza;   // bonanza / fiesta
    if (t < powerupHasta) return MODOS.power;    // power-up (dispersión)
    return MODOS.normal;                         // normal (naranja)
  }
  const raiz = document.documentElement;
  let modoAplicado = null;
  // Escribe las 4 vars CSS del modo SOLO cuando el modo cambia (deja que la
  // transición CSS haga el degradado suave; reescribir cada cuadro la anularía).
  function aplicarModoCSS(m) {
    if (m === modoAplicado) return;
    modoAplicado = m;
    raiz.style.setProperty('--acento', m.base);
    raiz.style.setProperty('--acento-vivo', m.vivo);
    raiz.style.setProperty('--acento-claro', m.claro);
    raiz.style.setProperty('--acento-profundo', m.profundo);
  }

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

  // Game over (CloudOver): congela la partida y muestra el overlay mínimo con
  // score final, marca de récord si aplica, y REINICIAR (recarga la página =
  // reset total; sin construir el ciclo de partida completo).
  const elGameOver = document.getElementById('gameover');
  function terminarPartida() {
    if (gameOver) return;
    gameOver = true;
    record.flush(performance.now()); // asegura la marca guardada
    const esRecord = marcador.puntos >= record.valor && marcador.puntos > 0;
    elGameOver.querySelector('.go-score .valor').textContent = marcador.puntos;
    elGameOver.querySelector('.go-record').classList.toggle('oculto', !esRecord);
    elGameOver.classList.remove('oculto');
  }
  // Reinicio EN SITIO (no recarga → inmune al cache del SW; el toque llega
  // porque el overlay es HTML encima del canvas (z-index 3) y el freeze solo
  // detiene el rAF del canvas, no los eventos del DOM). Resetea TODO el estado
  // de la partida (el récord persistente NO se toca) y reanuda el juego.
  function reiniciarPartida() {
    marcador.puntos = 0; marcador.racha = 0; marcador.fallosSeguidos = 0; marcador.pico = 0;
    targets.length = 0; bolitas.length = 0; cubos.length = 0; flotantes.length = 0;
    debuffHasta = 0; powerupHasta = 0; fiestaHasta = 0; fiestaFlashHasta = 0; powerFlashHasta = 0;
    ultimoEnojado = false; ultimaBonanza = false; ultimaMoneda = false; pityEstrella = 0;
    ultimoDisparo = -Infinity; gesto.activo = false; marcadorPopHasta = 0;
    if (elActual) elActual.style.transform = 'scale(1)';
    const ahora = performance.now();
    proximoSpawn = ahora;
    cloudProximo = ahora + rnd(CLOUD_MIN, CLOUD_MAX);
    gameOver = false;
    elGameOver.classList.add('oculto');
    actualizarMarcador();
    marcarActividad();
  }
  const elReiniciar = document.getElementById('reiniciar');
  if (elReiniciar) elReiniciar.addEventListener('click', reiniciarPartida);

  // Retardo del próximo spawn: rango vigente (escala con el score; base en
  // respiro) sorteado → tiempos variables. Hueco máx absoluto = 1200ms (base).
  function retardoSpawn(ahora) {
    const rg = P.rangoVigente(ritmo, marcador.puntos, ahora);
    return rnd(rg.min, rg.max);
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
  const MAX_TARGETS_DURO = 4;  // máximo 4 targets vivos (tiro preciso, no tapiz); NO aplica en fiesta

  // ── Enojado y debuff ───────────────────────────────────────────────
  const ENOJADO_BASE = 0.08;      // prob. base del spawn
  const ENOJADO_POR_EXTRA = 0.02; // +2% por cada target vivo por encima de 3
  const ENOJADO_TOPE = 0.25;      // tope de probabilidad
  const RADIO_NORMAL = 14;        // radio de la hitball
  const RADIO_DEBIL = 7;          // radio bajo debuff (mitad → poder mitad)
  const DEBUFF_MS = 5000;         // duración del debuff por tocar un enojado

  // ── Bonanza / estrella (target de la fiesta) ───────────────────────
  // Frecuencia con PITY TIMER: base 5% + 1% por cada spawn sin estrella (tope
  // 15%), se resetea al salir una. Garantiza recompensa sin volverla predecible.
  const ESTRELLA_BASE = 0.05;
  const ESTRELLA_PITY = 0.01;
  const ESTRELLA_TOPE = 0.15;

  // ── Moneda (power-up de disparo explosivo) ─────────────────────────
  const MONEDA_PROB = 0.05;    // 5% de los spawns; independiente de la estrella
  const POWERUP_MS = 10000;    // duración del power-up al tocar la moneda
  const MONEDA_BOLAS = 6;      // dispersas que nacen por CADA impacto durante el power-up
  const MONEDA_VEL = [0.8, 1.3]; // rango de velocidad del "puff" (px/ms)
  const FIESTA_MS = 5000;         // duración de la fiesta
  const FIESTA_MAX = 6;           // tope en fiesta −60% (16→6): la suerte también se modera
  const FIESTA_RET_MIN = 200;     // ráfaga de fiesta, ajustada proporcional (era 80–220)
  const FIESTA_RET_MAX = 550;
  const FIESTA_FLASH_MS = 500;    // lavado suave de --crema al entrar

  // ── CloudOver (game over) ──────────────────────────────────────────
  const CLOUD_MIN = 5000;     // aparece cada 5–25s (aleatorio)
  const CLOUD_MAX = 25000;
  const CLOUD_LENTO = 0.5;    // 50% más lento: mitad de velocidad de lanzamiento…
  const CLOUD_GRAV_FRAC = 0.25; // …Y gravedad a ¼ → MISMO apex que un normal (arco
                              // completo y visible) pero ~2× de tiempo de vuelo
                              // (apex ∝ v²/g: con v/2 y g/4, v²/g queda igual).
  const CLOUD_ESCALA = 1.3;   // 1.3× el target normal (más visible, más ominoso)
  const CLOUD_PARPADEO_MS = 100; // parpadeo entre cloudover-a/b (loop, afinable)

  // ── Inactividad ────────────────────────────────────────────────────
  const GRACIA_MS = 3000;         // 3s sin gestos antes de empezar a cobrar

  // PREMIOS SIN ICONO PROPIO: la estrella y la moneda son el TARGET NORMAL
  // (retícula 5×4, ojos), sólo que BRILLAN. Los distingue el COLOR DEL BRILLO
  // (dorado = estrella, cian = moneda), no la forma.

  // ── Constantes de la explosión de cubos (animación pura) ───────────
  // Los cubos caen hasta salir del viewport (viven más que antes). Al llenarse
  // el pool se reciclan los MÁS VIEJOS (cubos.shift, ya saliendo), nunca los
  // recién nacidos. Tope medido para el peor caso (fiesta + estrella).
  const MAX_CUBOS = 240;
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
  let ultimaBonanza = false;  // nunca dos estrellas seguidas
  let ultimaMoneda = false;   // nunca dos monedas seguidas
  let pityEstrella = 0;       // spawns sin estrella (sube la probabilidad)
  let debuffHasta = 0;        // timestamp fin del debuff (radio a la mitad)
  let powerupHasta = 0;       // timestamp fin del power-up de moneda (dispersión)
  let cloudProximo = 0;       // timestamp del próximo CloudOver
  let gameOver = false;       // partida terminada por CloudOver
  let fiestaHasta = 0;        // timestamp fin de la fiesta (tope y ritmo altos)
  let fiestaFlashHasta = 0;   // lavado suave al entrar a la fiesta
  let powerFlashHasta = 0;    // destello cian al activar el power-up
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
        color: color || COLOR.coral, tam: tam || 8,
      });
    }
    while (cubos.length > MAX_CUBOS) cubos.shift(); // descarta los más viejos
  }

  // Centros de mundo de los 20 cubos de 8px vivos de un target (para la
  // explosión de estrella/moneda, que son targets normales).
  function cubos8Mundo(tg) {
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
    // Con el multiplicador de racha activo NO aparecen estrellas (no coexisten).
    const probEstrella = Math.min(ESTRELLA_TOPE, ESTRELLA_BASE + ESTRELLA_PITY * pityEstrella);
    if (!enFiesta && !hayBonanza && !ultimaBonanza && marcador.racha < P.RACHA_DESDE && Math.random() < probEstrella) {
      t.bonanza = true; // target normal que BRILLA dorado
      t.enojado = false;
      ultimaBonanza = true;
      ultimoEnojado = false;
      pityEstrella = 0; // salió una estrella → resetea el pity
    } else {
      ultimaBonanza = false;
      pityEstrella += 1; // spawn sin estrella → sube la probabilidad
      const hayMoneda = targets.some(function (x) { return x.moneda; });
      if (!enFiesta && !hayMoneda && !ultimaMoneda && Math.random() < MONEDA_PROB) {
        // Moneda: target normal que BRILLA cian. Independiente de la estrella.
        t.moneda = true;
        t.enojado = false;
        ultimaMoneda = true;
        ultimoEnojado = false;
      } else {
        ultimaMoneda = false;
        const prob = Math.min(ENOJADO_TOPE, ENOJADO_BASE + ENOJADO_POR_EXTRA * Math.max(0, targets.length - 3));
        t.enojado = !enFiesta && !ultimoEnojado && Math.random() < prob;
        ultimoEnojado = t.enojado;
      }
    }
    targets.push(t);
  }

  // Al IMPACTAR un target durante el power-up nacen 6 hitballs de TAMAÑO NORMAL
  // (radio 14, poder pleno) desde (px,py), en abanico ("puff"). Marcadas `moneda`
  // (NO penalizan) y `dispersa` (no re-disparan → sin cascada). Si el tope de 24
  // está lleno, nacen las que quepan. (Antes reusaban el radio 7 del castigo.)
  function dispersarMoneda(px, py) {
    const n = Math.min(MONEDA_BOLAS, Math.max(0, MAX_BOLITAS - bolitas.length));
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + ((i + 0.5) / MONEDA_BOLAS - 0.5) * (Math.PI * 1.1);
      const vel = rnd(MONEDA_VEL[0], MONEDA_VEL[1]);
      bolitas.push({
        x: px, y: py,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
        radio: RADIO_NORMAL, moneda: true, dispersa: true,
        edad: 0, viva: true, tocado: false, neutro: false, historia: [],
      });
    }
    return n;
  }

  // CloudOver: target normal marcado `cloud`, sin premios/enojado. Usa el MISMO
  // spawner de orígenes que los demás (crearTarget: inferior/laterales/superior
  // con sus ángulos) — sin spawner aparte. "50% más lento" = mitad de velocidad
  // Y gravedad a ¼ (por-objeto, la global NO se toca): así conserva el MISMO
  // apex que un target normal (arco completo, sube y cruza, no muere abajo) pero
  // tarda ~2× en recorrerlo → tiempo de sobra para esquivar/decidir y acertarle.
  function generarCloud() {
    const t = F.crearTarget({ w: W, h: H });
    t.cloud = true;
    t.enojado = false;
    t.vx *= CLOUD_LENTO;
    t.vy *= CLOUD_LENTO;
    t.gravedad = F.FISICA.G_TARGET * CLOUD_GRAV_FRAC;
    // Caja de colisión escalada 1.3× (coincide con el sprite agrandado).
    t.caja = { cx: 0, cy: 0, hw: 20 * CLOUD_ESCALA, hh: 16 * CLOUD_ESCALA };
    targets.push(t);
  }

  // Retardo del próximo spawn: en fiesta = ráfaga; si no, el ritmo del score.
  function retardoActual(ahora) {
    return ahora < fiestaHasta ? rnd(FIESTA_RET_MIN, FIESTA_RET_MAX) : retardoSpawn(ahora);
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
      chica: performance.now() < debuffHasta, // disparada en modo bola-chica → rebota, no penaliza
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

    // Pausado o GAME OVER: congela toda actualización (física, spawn, colisión,
    // cobro); solo re-dibuja el estado (rAF en el finally mantiene vivo el bucle).
    if (pausado || gameOver) { cobrando = false; dibujar(); return; }

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
          // El cobro por segundo SE VE, junto al marcador Actual (arriba-centro).
          // PÉRDIDA = rojo del CloudOver (#FF0055): todo lo que RESTA se ve rojo.
          if (c > 0) flotante(W / 2, 96, '−' + c, COLOR.cloudoverB, 18);
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
          // Celebración: la estrella (target normal) estalla en sus 20 cubos --dorado.
          explotarCubos(cubos8Mundo(tg), tg.x, tg.y, 1.0, tg.vx, tg.vy, COLOR.dorado, 8);
          sacudidaHasta = t + SACUDIDA_MS;
          targets.splice(ti, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t)); // arranca la ráfaga
          continue;
        }
        if (tg.cloud) {
          // CloudOver: SOLO la hitball PRINCIPAL lo activa. Las dispersas de
          // moneda lo IGNORAN (ni game over ni daño). Y NO es letal mientras hay
          // un estado de premio (fiesta o power-up): un CloudOver vivo se queda
          // pero no mata hasta que el premio termine.
          if (b.dispersa) continue;
          if (!F.colisionCirculoRect(b, tg)) continue;
          if (t < fiestaHasta || t < powerupHasta) continue; // no letal en premio
          terminarPartida();
          return; // corta el cuadro; el bucle se congela
        }
        if (tg.moneda) {
          // Moneda: TODO O NADA. Activa el POWER-UP explosivo por 10s (no
          // dispersa al tocarla). Contacto neutro (ni hit ni fallo), no puntúa.
          if (!F.colisionCirculoRect(b, tg)) continue;
          b.neutro = true;
          powerupHasta = t + POWERUP_MS;
          powerFlashHasta = t + 400;           // destello verde de celebración
          explotarCubos(cubos8Mundo(tg), tg.x, tg.y, 1.0, tg.vx, tg.vy, COLOR.disperso, 8);
          sacudidaHasta = t + SACUDIDA_MS;
          targets.splice(ti, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t));
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
          const enChico = t < debuffHasta;     // modo bola-chica: racha PAUSADA, sin multiplicador
          if (!b.tocado) {                     // primer toque = hit (sube la racha continua)
            b.tocado = true;
            if (!enChico) {                    // en modo chico la racha se PAUSA (ni sube ni se resetea)
              P.anotarHit(marcador);
              P.quizasRespiro(ritmo, marcador.puntos, marcador.racha, t); // respiro al 10º hit en dif. máx
            }
          }
          if (r.destruidos > 0) {              // ganancia proporcional (SIN multiplicador en modo chico)
            const g = P.anotarDestruidos(marcador, r.destruidos, enChico);
            flotante(r.px, r.py, '+' + g, modoActivo(t).vivo, tamGanancia(g), g >= 300); // +N entra al color del modo
            if (g >= 50) popMarcador();        // latido en ganancias fuertes
          }
          actualizarMarcador();
          // POWER-UP: al impactar un target normal (y no siendo ya una dispersa)
          // nacen 6 dispersas desde el punto de impacto (bono, sin cascada).
          if (t < powerupHasta && !b.dispersa) dispersarMoneda(r.px, r.py);
        }
        if (r.cubosLiberados.length > 0) {
          explotarCubos(r.cubosLiberados, r.px, r.py, r.vImpact, tg.vx, tg.vy, modoActivo(t).base); // debris = color del modo
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
      // `chica` = disparada en modo bola-chica: radio 7 toda su vida y REBOTA en
      // los bordes MIENTRAS el modo dura. Dispersas y normales = radio 14 sin
      // paredes (mueren al salir). Al terminar el modo, la chica deja de rebotar.
      b.radio = b.chica ? RADIO_DEBIL : RADIO_NORMAL;
      b.rebota = b.chica && debuffActivo;
      F.paso(b, dt, limites, function () { colisionar(b); });
      b.historia.unshift({ x: b.x, y: b.y }); // estela propia (3 fantasmas)
      if (b.historia.length > LAG_ESTELA * 3 + 1) b.historia.pop();
    }
    // Retira las bolitas muertas: si no tocó nada (y no fue neutro por tocar un
    // enojado) = FALLO (castigo del tramo, rompe racha).
    for (let i = bolitas.length - 1; i >= 0; i--) {
      const b = bolitas[i];
      if (!b.viva) {
        const enChico = t < debuffHasta;
        if (b.chica || enChico) {
          // MODO BOLA-CHICA: ningún fallo resta, ni rompe racha, ni cobra —
          // ni el tiro principal ni las dispersas. NO se emite −N ni "0" (evita
          // el número confuso). Las bolas `chica` nunca penalizan (nacen sin
          // costo). Esta regla ANULA la anterior (el tiro principal ya no resta).
        } else if (b.moneda) {
          // La dispersa no penaliza: "0" apagado (sin signo −) = sin costo.
          if (!b.tocado) flotante(b.x, b.y, '0', COLOR.textoApagado, 16);
        } else if (!b.tocado && !b.neutro) {
          // FALLO: la pérdida SE VE (número negativo grande en ROJO #FF0055).
          const pen = P.anotarFallo(marcador, {});
          actualizarMarcador();
          flotante(b.x, b.y, '−' + pen, COLOR.cloudoverB, 26, true);
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
    // Flujo continuo: lanza en cuanto vence el retardo. En fiesta el tope sube
    // a 16; al terminar vuelve a 12 y los sobrantes mueren por su vuelo (no se
    // borran). Tope = válvula de rendimiento, no de diseño.
    const enFiesta = t < fiestaHasta;
    const capActual = enFiesta ? FIESTA_MAX : MAX_TARGETS_DURO;
    if (targets.length < capActual && t >= proximoSpawn) {
      generarTarget(t);
      proximoSpawn = t + retardoActual(t);
    }
    // CloudOver: cada 5–25s, nunca dos vivos, NUNCA durante fiesta NI power-up
    // (ambos son estados de premio: meter la muerte ahí es injusto).
    if (t >= cloudProximo && !enFiesta && t >= powerupHasta && !targets.some(function (x) { return x.cloud; })) {
      generarCloud();
      cloudProximo = t + rnd(CLOUD_MIN, CLOUD_MAX);
    }
    // Bonanza y multiplicador NO coexisten: con el multiplicador activo, toda
    // estrella viva hace POP (breve estallido dorado) y se va, sin premio.
    if (marcador.racha >= P.RACHA_DESDE) {
      for (let i = targets.length - 1; i >= 0; i--) {
        if (targets[i].bonanza) {
          explotarCubos(cubos8Mundo(targets[i]), targets[i].x, targets[i].y, 0.8, targets[i].vx, targets[i].vy, COLOR.dorado, 8);
          targets.splice(i, 1);
          proximoSpawn = Math.min(proximoSpawn, t + retardoActual(t));
        }
      }
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

    // MODO ACTIVO: una sola verdad para todo el cuadro (canvas + vars CSS).
    const modo = modoActivo(performance.now());
    aplicarModoCSS(modo);

    // Targets lanzados, rotados sobre su centro. SIN colisión con los cubos.
    // Baño TOTAL: el CUERPO de todos los targets se tiñe del modo (modo.base);
    // los ESPECIALES se distinguen por su LUZ (halo/pulso/parpadeo en su matiz
    // de firma), NO por el color del cuerpo. El halo/aura de "estás en un modo"
    // va en la HITBALL, no en el target; estos halos son la FIRMA del tipo.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const now = performance.now();
      const destella = t.destelloHasta && now < t.destelloHasta;
      // Halo/pulso de firma del especial (se lee a 40px): bonanza dorado, moneda
      // verde, enojado azul. El CloudOver no lleva halo: su cuerpo PARPADEA rojo.
      if (!t.cloud && (t.bonanza || t.moneda || t.enojado)) {
        const firma = t.bonanza ? COLOR.dorado : t.moneda ? COLOR.disperso : COLOR.azul;
        ctx.save();
        ctx.globalAlpha = 0.32 + 0.22 * Math.sin(now / 200);
        ctx.strokeStyle = firma;
        ctx.lineWidth = 3;
        ctx.shadowColor = firma;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 26 + 4 * Math.sin(now / 200), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      if (t.cloud) ctx.scale(CLOUD_ESCALA, CLOUD_ESCALA); // CloudOver más grande
      dibujarSpriteTarget(t, destella, modo); // cuerpo = modo.base; CloudOver parpadea; destello = crema
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
    const remDebuff = debuffHasta - ahoraB;
    const debil = remDebuff > 0;                 // debuff activo → hitball chica
    const radioAhora = debil ? RADIO_DEBIL : RADIO_NORMAL;
    // Hitball = tono VIVO del modo; su estela/glow es el AURA (va en la bola).
    if (elActual) elActual.style.color = modo.vivo; // marcador Actual entra al modo
    for (let i = 0; i < bolitas.length; i++) {
      const b = bolitas[i];
      const rB = b.radio || RADIO_NORMAL;
      dibujarEstela(b, rB, modo.vivo);           // estela = AURA viva del modo (va en la hitball)
      dibujarBolita(b.x, b.y, rB, modo.vivo, false);
    }
    // Bolita principal (reposo/agarrada): tono vivo del modo + glow = aura viva.
    if (gesto.activo) {
      const dedo = gesto.puntos[gesto.puntos.length - 1];
      dibujarBolita(dedo.x, dedo.y, radioAhora, modo.vivo, true);
    } else if (ahoraB - ultimoDisparo >= CADENCIA_MS) {
      const r = reposo();
      dibujarBolita(r.x, r.y, radioAhora, modo.vivo, true);
    }

    // Indicador de debuff: barra en el BORDE SUPERIOR que se DESCARGA (se
    // encoge) con el tiempo restante. --azul RADIANTE: gradiente + glow por
    // shadowBlur (parpadeo por alfa) = electricidad. Barato: un fillRect con
    // sombra. Al vaciarse, el regreso al modo normal se ve entretenido.
    if (debil) {
      const w = W * (remDebuff / DEBUFF_MS);
      // Barra en la paleta del modo: PROFUNDO → VIVO (barrido oscuro→brillante).
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, modo.profundo);
      grad.addColorStop(1, modo.vivo);
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(performance.now() / 90); // chispazo
      ctx.shadowColor = modo.base;
      ctx.shadowBlur = 8;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 4);
      ctx.restore();
    }

    // Indicador de POWER-UP (moneda): barra --disperso (verde) en el BORDE
    // INFERIOR que se encoge con el tiempo restante (separada de la de debuff).
    const remPower = powerupHasta - performance.now();
    if (remPower > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.shadowColor = modo.base;
      ctx.shadowBlur = 8;
      ctx.fillStyle = modo.vivo;      // barra del power-up en el tono vivo del modo
      ctx.fillRect(0, H - 4, W * (remPower / POWERUP_MS), 4);
      ctx.restore();
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
      if (fl.glow) { ctx.shadowColor = fl.color || modo.vivo; ctx.shadowBlur = 12; }
      ctx.fillStyle = fl.color || modo.vivo;
      ctx.font = '700 ' + fl.tam + 'px ' + COLOR.fuente;
      ctx.fillText(fl.texto, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // BADGE del multiplicador de racha: "×N" prominente arriba-centro, crece con
    // la racha y pulsa. Solo cuando el multiplicador supera ×1 (racha ≥ 3).
    // Badge OCULTO en modo bola-chica: el multiplicador está pausado (gains ×1).
    const mult = P.multRacha(marcador.racha);
    if (mult > 1 && !debil) {
      const now = performance.now();
      ctx.save();
      ctx.translate(W / 2, H * 0.16);
      ctx.scale(1 + 0.06 * Math.sin(now / 150), 1 + 0.06 * Math.sin(now / 150));
      ctx.shadowColor = modo.vivo;
      ctx.shadowBlur = 12;
      ctx.fillStyle = modo.vivo;
      ctx.font = '800 ' + (26 + Math.min(20, marcador.racha)) + 'px ' + COLOR.fuente;
      ctx.fillText('×' + (mult % 1 === 0 ? mult.toFixed(0) : mult.toFixed(1)), 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Amortiguador de caída: "cojín" de luz cálida (--coral-vivo) en el borde
    // inferior cuando el score está bajo el suelo (60% del pico). Alfa según la
    // profundidad → el jugador SIENTE que el fondo lo sostiene. Sin texto.
    const suelo = P.SUELO_PICO * marcador.pico;
    if (marcador.pico > 0 && marcador.puntos < suelo) {
      const prof = 1 - marcador.puntos / suelo; // 0 en el suelo → 1 en 0
      const alto = 90;
      const g = ctx.createLinearGradient(0, H, 0, H - alto);
      g.addColorStop(0, modo.vivo);
      g.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = 0.12 * prof;
      ctx.fillStyle = g;
      ctx.fillRect(0, H - alto, W, alto);
      ctx.restore();
    }

    // Entrada a la fiesta: lavado suave en el tono CLARO del modo (~500ms). Sin
    // pantallazos agresivos (juego desestresante). Un fillRect por cuadro.
    const flash = fiestaFlashHasta - performance.now();
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18 * (flash / FIESTA_FLASH_MS);
      ctx.fillStyle = modo.claro;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // Destello de celebración al activar el power-up (tono claro del modo).
    const flashP = powerFlashHasta - performance.now();
    if (flashP > 0) {
      ctx.save();
      ctx.globalAlpha = 0.16 * (flashP / 400);
      ctx.fillStyle = modo.claro;
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
  function dibujarSpriteTarget(t, destella, modo) {
    const CUBO = 8;
    const COLS = 5;
    const FILAS = 4;
    const RADIO_ESQ = 4;
    const x = -20;
    const y = -16;
    // BAÑO TOTAL: el CUERPO de TODOS los targets es modo.base — el TIPO se lee
    // por su LUZ (el halo de firma que dibuja la capa superior), no por el color
    // del cuerpo. Excepción: el CloudOver PARPADEA rojo A/B cada 100ms (su firma
    // de peligro es el cuerpo mismo). El destello de contacto (crema) manda.
    let col = modo.base;
    if (t.cloud) col = Math.floor(performance.now() / CLOUD_PARPADEO_MS) % 2 ? COLOR.cloudoverA : COLOR.cloudoverB;
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
    // Ojos: celdas 6 (f1,c1) y 8 (f1,c3), cada una si sigue viva.
    ctx.fillStyle = COLOR.negro;
    if (t.celdas[6]) ctx.fillRect(x + 1 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
    if (t.celdas[8]) ctx.fillRect(x + 3 * CUBO + 2, y + 1 * CUBO + 2, 4, 4);
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

  window.addEventListener('resize', redimensionar);
  redimensionar();
  actualizarMarcador();  // arranca en 0 (no el placeholder del HTML)
  actualizarRecord();    // muestra el récord persistido (o 0)
  marcarActividad();     // inicia el reloj de inactividad (evita cobro al arrancar)
  cloudProximo = performance.now() + rnd(CLOUD_MIN, CLOUD_MAX); // primer CloudOver
  arrancarBucle();       // el spawner de targets corre desde el arranque

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
})();
