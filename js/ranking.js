// hitclaud — ranking.js
// ÚNICO punto de contacto con el servidor de tabla de posiciones. Ninguna otra parte
// del juego habla con la red. REGLA DURA: el juego NUNCA espera a la red — el envío es
// en segundo plano, con tiempo límite, y cualquier fallo se traga sin llegar al bucle
// rAF. Esta versión además: registra el resultado del último envío (consultable en la
// consola con  Ranking.ultimoEnvio()  ), reintenta una vez sin keepalive, y guarda un
// pendiente por modo para reintentar al arrancar. Corre en navegador (window.Ranking) y
// en node (module.exports).

(function (global) {
  'use strict';

  const BASE = 'https://hitclaud-ranking.patmacip.workers.dev';
  // Tiempo límite por llamada. Si se pasa, se ABANDONA sin error visible. 5 s es holgado
  // para una respuesta normal y corto para no dejar nada colgado si la red está caída.
  const TIMEOUT_MS = 5000;
  // Modos que el juego ENVÍA/CONSULTA y que el servidor acepta. HitClaud manda la duración
  // PELADA ('15'/'60') — sus tablas dependen de eso, no se toca. ShotClaud manda con prefijo
  // de juego ('shotclaud:20'/'shotclaud:60'). El modo 30 se abandonó; pushclaud aún no juega.
  const MODOS = ['15', '60', 'shotclaud:20', 'shotclaud:60'];
  const DUR_MS = { '15': 15000, '60': 60000, 'shotclaud:20': 20000, 'shotclaud:60': 60000 };
  const ICONOS = { 1: 'assets/podio-1.svg', 2: 'assets/podio-2.svg', 3: 'assets/podio-3.svg' };
  const PEND_PREFIX = 'hitclaud.pendiente.v1.'; // llave del pendiente por modo (best-effort)

  // ── Registro consultable del ÚLTIMO envío de puntaje (diagnóstico) ─────────────
  // Estados: 'ninguno' | 'no-intentado'(+motivo) | 'fallo-red' | 'error-servidor' | 'ok'.
  // motivos de no-intentado: 'cloudover' | 'no-supera-record' | 'sin-nombre'.
  let _ultimoEnvio = { estado: 'ninguno' };
  function _ahora() { try { return Date.now(); } catch (e) { return 0; } }
  function registrar(reg) { _ultimoEnvio = Object.assign({ ts: _ahora() }, reg); return _ultimoEnvio; }
  function ultimoEnvio() { return _ultimoEnvio; }

  // fetch con AbortController + timeout. Devuelve el Response o lanza (lo captura quien llama).
  function fetchTimeout(url, opciones) {
    const opt = opciones || {};
    let ctrl = null, timer = null;
    try { if (typeof AbortController !== 'undefined') { ctrl = new AbortController(); opt.signal = ctrl.signal; } } catch (e) { /* sin abort */ }
    if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
    const p = fetch(url, opt);
    return p.finally ? p.finally(function () { if (timer) clearTimeout(timer); }) : p;
  }

  // Pide el top de un modo. SIEMPRE resuelve (nunca rechaza): { ok:true, top:[...] } o
  // { ok:false }. No lanza jamás.
  function pedirTop(modo) {
    return new Promise(function (resolve) {
      try {
        if (MODOS.indexOf(String(modo)) === -1) { resolve({ ok: false }); return; }
        fetchTimeout(BASE + '/top?modo=' + encodeURIComponent(String(modo)), { method: 'GET' })
          .then(function (res) {
            if (!res || !res.ok) { resolve({ ok: false }); return; }
            return res.json().then(function (data) {
              resolve({ ok: true, top: data && Array.isArray(data.top) ? data.top : [] });
            });
          })
          .catch(function () { resolve({ ok: false }); });
      } catch (e) { resolve({ ok: false }); }
    });
  }

  // POST una vez, SIN keepalive (comportamiento inconsistente en Safari iOS). Resuelve
  // { ok, status?, data? } — nunca rechaza.
  function _postUna(ruta, cuerpo) {
    return new Promise(function (resolve) {
      try {
        fetchTimeout(BASE + ruta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo),
        }).then(function (res) {
          if (!res) { resolve({ ok: false }); return; }
          res.json().then(
            function (data) { resolve({ ok: res.ok, status: res.status, data: data }); },
            function () { resolve({ ok: res.ok, status: res.status, data: null }); }
          );
        }, function () { resolve({ ok: false }); });
      } catch (e) { resolve({ ok: false }); }
    });
  }
  // POST con UN reintento si el primero falló (red o no-ok). Robusto sin keepalive.
  function _postConReintento(ruta, cuerpo) {
    return _postUna(ruta, cuerpo).then(function (r) { return r.ok ? r : _postUna(ruta, cuerpo); });
  }

  // ── Pendientes por modo (best-effort: localStorage; si falla, memoria; nada rompe) ──
  const _mem = {};
  function _lsGet(k) { try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(k); } catch (e) {} return Object.prototype.hasOwnProperty.call(_mem, k) ? _mem[k] : null; }
  function _lsSet(k, v) { try { if (typeof localStorage !== 'undefined' && localStorage) { localStorage.setItem(k, v); return; } } catch (e) {} _mem[k] = v; }
  function _lsDel(k) { try { if (typeof localStorage !== 'undefined' && localStorage) { localStorage.removeItem(k); return; } } catch (e) {} delete _mem[k]; }
  function leerPendiente(modo) {
    const raw = _lsGet(PEND_PREFIX + modo);
    if (!raw) return null;
    try { const o = JSON.parse(raw); return (o && typeof o.nombre === 'string' && typeof o.puntos === 'number') ? o : null; } catch (e) { return null; }
  }
  // Guarda SÓLO el mejor pendiente por modo (no una cola).
  function guardarPendiente(cuerpo) {
    const modo = String(cuerpo.modo);
    const prev = leerPendiente(modo);
    if (prev && prev.puntos >= cuerpo.puntos) return; // ya hay uno igual o mejor
    const p = { nombre: cuerpo.nombre, puntos: cuerpo.puntos, modo: modo };
    const efc = _efc(cuerpo.efectividad);
    if (efc !== null) p.efectividad = efc; // se conserva para el reintento (ShotClaud)
    try { _lsSet(PEND_PREFIX + modo, JSON.stringify(p)); } catch (e) {}
  }
  function borrarPendiente(modo) { _lsDel(PEND_PREFIX + String(modo)); }
  function pendientes() { const out = []; for (let i = 0; i < MODOS.length; i++) { const p = leerPendiente(MODOS[i]); if (p) out.push(p); } return out; }

  // POST /score: éxito → borra pendiente; fallo → guarda pendiente para reintentar.
  // Devuelve el registro. Nunca rechaza.
  function _postScore(cuerpo) {
    const modo = String(cuerpo.modo);
    return _postConReintento('/score', cuerpo).then(function (r) {
      if (r.ok) {
        borrarPendiente(modo); // el servidor lo procesó (haya entrado al top o no)
        return registrar({ estado: 'ok', cuerpo: cuerpo, entro: !!(r.data && r.data.entro), posicion: (r.data && r.data.posicion) || null });
      }
      guardarPendiente(cuerpo); // se reintentará al próximo arranque
      if (r.status) return registrar({ estado: 'error-servidor', cuerpo: cuerpo, status: r.status });
      return registrar({ estado: 'fallo-red', cuerpo: cuerpo });
    });
  }

  // ── Helpers PUROS ──────────────────────────────────────────────────────────────
  const _ent = function (v) { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  // Efectividad OPCIONAL para el servidor: entero 0..100 o null (ausente). ShotClaud la manda.
  const _efc = function (v) {
    if (v === undefined || v === null) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  };

  // Motivo por el que NO se manda el puntaje, o null si SÍ se manda. Orden: por tiempo
  // → hay nombre → puntaje > 0. YA NO se exige superar el récord local: el envío estaba
  // atado al récord y quien juega hace días casi nunca lo supera, así que nunca entraba
  // al ranking (error de diseño). El SERVIDOR decide si entra al top 20; nosotros sólo
  // filtramos lo que no tiene sentido mandar (CloudOver, sin nombre, cero/negativo).
  // NOTA: `superaRecord` ya no participa en la decisión; se ignora si viene.
  function motivoNoEnvio(o) {
    o = o || {};
    const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : '';
    // CloudOver no compite… SALVO que el juego permita competir por CloudOver (ShotClaud: su
    // récord también cuenta el CloudOver, así que su puntaje se manda igual — punto 6).
    if (!o.porTiempo && !o.permiteCloudover) return 'cloudover';
    if (nombre.length === 0) return 'sin-nombre'; // 1.3: sin nombre no se puede rankear
    if (_ent(o.puntos) <= 0) return 'cero';       // 1.4: cero o negativo no se manda
    return null;                                  // 1.5: supere o no el récord, se manda
  }
  function decidirEnviarPuntaje(o) { return motivoNoEnvio(o) === null; }

  // Envía un puntaje al ranking. `o` = { nombre, puntos, modo, porTiempo, permiteCloudover?, efectividad? }.
  // Si no corresponde, REGISTRA el motivo (no lanza). Devuelve Promise<registro>. La efectividad
  // (0..100) es OPCIONAL: se incluye sólo si viene (ShotClaud); HitClaud no la manda.
  function enviarPuntaje(o) {
    o = o || {};
    const motivo = motivoNoEnvio(o);
    if (motivo) return Promise.resolve(registrar({ estado: 'no-intentado', motivo: motivo }));
    const cuerpo = { nombre: o.nombre.trim(), puntos: _ent(o.puntos), modo: String(o.modo) };
    const efc = _efc(o.efectividad);
    if (efc !== null) cuerpo.efectividad = efc;
    return _postScore(cuerpo);
  }

  // Reintenta los pendientes guardados (al arrancar el juego). En segundo plano.
  function reintentarPendientes() {
    for (let i = 0; i < MODOS.length; i++) {
      const p = leerPendiente(MODOS[i]);
      if (p) {
        const cuerpo = { nombre: p.nombre, puntos: p.puntos, modo: MODOS[i] };
        if (_efc(p.efectividad) !== null) cuerpo.efectividad = _efc(p.efectividad);
        _postScore(cuerpo);
      }
    }
  }

  // Arma el cuerpo de /partida (coherente y ANÓNIMO). aciertos ≤ tiros, carambolas ≤
  // tiros, duracionReal ≤ duración del modo + 30 s. NUNCA incluye el nombre.
  function armarDatosPartida(d) {
    d = d || {};
    const modo = MODOS.indexOf(String(d.modo)) !== -1 ? String(d.modo) : '60';
    const topeDur = DUR_MS[modo] + 30000;
    const tiros = _ent(d.tiros);
    const out = {
      modo: modo, puntos: _ent(d.puntos), duracionReal: Math.min(_ent(d.duracionReal), topeDur),
      termino: d.termino === 'cloudover' ? 'cloudover' : 'tiempo',
      tiros: tiros, aciertos: Math.min(_ent(d.aciertos), tiros), rachaMax: _ent(d.rachaMax),
      carambolas: Math.min(_ent(d.carambolas), tiros),
      plataforma: d.plataforma === 'escritorio' ? 'escritorio' : 'movil',
    };
    const efc = _efc(d.efectividad);
    if (efc !== null) out.efectividad = efc; // opcional: sólo ShotClaud la manda
    return out;
  }
  // Manda el resumen anónimo de una partida (segundo plano, sin keepalive, sin log).
  function enviarPartida(datos) { _postUna('/partida', datos); }

  // Icono del podio para un puesto (1/2/3) o null (usar el número). Puro.
  function iconoDePuesto(puesto) { return ICONOS[puesto] || null; }

  const Ranking = {
    BASE: BASE, TIMEOUT_MS: TIMEOUT_MS, MODOS: MODOS,
    pedirTop: pedirTop, enviarPuntaje: enviarPuntaje, enviarPartida: enviarPartida,
    reintentarPendientes: reintentarPendientes,
    armarDatosPartida: armarDatosPartida, decidirEnviarPuntaje: decidirEnviarPuntaje,
    motivoNoEnvio: motivoNoEnvio, iconoDePuesto: iconoDePuesto,
    ultimoEnvio: ultimoEnvio, pendientes: pendientes,
    // internos expuestos para diagnóstico/pruebas
    _guardarPendiente: guardarPendiente, _leerPendiente: leerPendiente, _borrarPendiente: borrarPendiente,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ranking;
  } else {
    global.Ranking = Ranking;
  }
})(typeof window !== 'undefined' ? window : globalThis);
