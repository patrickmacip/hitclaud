// hitclaud — ranking.js
// ÚNICO punto de contacto con el servidor de tabla de posiciones. Ninguna otra parte
// del juego habla con la red. REGLA DURA: el juego NUNCA espera a la red — todas las
// llamadas son en segundo plano, con tiempo límite, y cualquier fallo se traga sin
// llegar al bucle rAF. Corre en navegador (window.Ranking) y en node (module.exports).

(function (global) {
  'use strict';

  const BASE = 'https://hitclaud-ranking.patmacip.workers.dev';
  // Tiempo límite por llamada. Si se pasa, se ABANDONA sin error visible. 5 s es
  // holgado para una respuesta normal y corto para no dejar nada "pendiente" si la
  // red está caída (el juego ya siguió su curso; esto es sólo trabajo de fondo).
  const TIMEOUT_MS = 5000;
  const MODOS = ['15', '30', '60'];
  const DUR_MS = { '15': 15000, '30': 30000, '60': 60000 };
  const ICONOS = { 1: 'assets/podio-1.svg', 2: 'assets/podio-2.svg', 3: 'assets/podio-3.svg' };

  // fetch con AbortController + timeout. Devuelve el Response o lanza (lo captura quien llama).
  function fetchTimeout(url, opciones) {
    const opt = opciones || {};
    // AbortController existe en navegadores modernos y en Node ≥16; si no, sigue sin timeout.
    let ctrl = null, timer = null;
    try { if (typeof AbortController !== 'undefined') { ctrl = new AbortController(); opt.signal = ctrl.signal; } } catch (e) { /* sin abort */ }
    if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
    const p = fetch(url, opt);
    return p.finally ? p.finally(function () { if (timer) clearTimeout(timer); }) : p;
  }

  // Pide el top de un modo. SIEMPRE resuelve (nunca rechaza): { ok:true, top:[...] } o
  // { ok:false } si hubo fallo/timeout/JSON malo. No lanza jamás.
  function pedirTop(modo) {
    return new Promise(function (resolve) {
      try {
        if (MODOS.indexOf(String(modo)) === -1) { resolve({ ok: false }); return; }
        fetchTimeout(BASE + '/top?modo=' + encodeURIComponent(String(modo)), { method: 'GET' })
          .then(function (res) {
            if (!res || !res.ok) { resolve({ ok: false }); return; }
            return res.json().then(function (data) {
              const top = data && Array.isArray(data.top) ? data.top : [];
              resolve({ ok: true, top: top });
            });
          })
          .catch(function () { resolve({ ok: false }); });
      } catch (e) { resolve({ ok: false }); }
    });
  }

  // POST en segundo plano ("dispara y olvida"). Nunca lanza, nunca devuelve nada útil.
  function postFondo(ruta, cuerpo) {
    try {
      fetchTimeout(BASE + ruta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        keepalive: true, // permite que el envío sobreviva al cierre de la partida/página
      }).then(function () {}, function () {}); // se ignora éxito y error
    } catch (e) { /* la red jamás rompe nada */ }
  }

  // Manda un puntaje al ranking (segundo plano).
  function enviarPuntaje(nombre, puntos, modo) {
    postFondo('/score', { nombre: nombre, puntos: puntos, modo: String(modo) });
  }

  // Manda el resumen ANÓNIMO de una partida (segundo plano). `datos` debe venir ya
  // armado con armarDatosPartida (coherente y sin nombre).
  function enviarPartida(datos) {
    postFondo('/partida', datos);
  }

  // ── Helpers PUROS (testeables sin red) ─────────────────────────────────────

  const _ent = function (v) { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };

  // Arma el cuerpo de /partida a partir de los contadores del juego. GARANTIZA
  // coherencia (el servidor rechaza lo incoherente): aciertos ≤ tiros, carambolas ≤
  // tiros, duracionReal ≤ duración del modo + 30 s. NUNCA incluye el nombre (anónimo).
  function armarDatosPartida(d) {
    d = d || {};
    const modo = MODOS.indexOf(String(d.modo)) !== -1 ? String(d.modo) : '60';
    const topeDur = DUR_MS[modo] + 30000;
    const tiros = _ent(d.tiros);
    return {
      modo: modo,
      puntos: _ent(d.puntos),
      duracionReal: Math.min(_ent(d.duracionReal), topeDur),
      termino: d.termino === 'cloudover' ? 'cloudover' : 'tiempo',
      tiros: tiros,
      aciertos: Math.min(_ent(d.aciertos), tiros),
      rachaMax: _ent(d.rachaMax),
      carambolas: Math.min(_ent(d.carambolas), tiros),
      plataforma: d.plataforma === 'escritorio' ? 'escritorio' : 'movil',
    };
  }

  // ¿Se manda el puntaje al ranking? Sólo si terminó POR TIEMPO (2.2), superó el récord
  // local (2.1) y hay nombre guardado (2.3). Puro.
  function decidirEnviarPuntaje(o) {
    o = o || {};
    const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : '';
    return !!(o.porTiempo && o.superaRecord && nombre.length > 0);
  }

  // Icono del podio para un puesto (1/2/3) o null (usar el número). Puro.
  function iconoDePuesto(puesto) {
    return ICONOS[puesto] || null;
  }

  const Ranking = {
    BASE: BASE, TIMEOUT_MS: TIMEOUT_MS, MODOS: MODOS,
    pedirTop: pedirTop, enviarPuntaje: enviarPuntaje, enviarPartida: enviarPartida,
    armarDatosPartida: armarDatosPartida, decidirEnviarPuntaje: decidirEnviarPuntaje,
    iconoDePuesto: iconoDePuesto,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ranking;
  } else {
    global.Ranking = Ranking;
  }
})(typeof window !== 'undefined' ? window : globalThis);
