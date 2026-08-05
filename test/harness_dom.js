// Arnés DOM mínimo para CARGAR js/main.js en Node y probar COMPORTAMIENTO real (no sólo
// presencia): navegar por overlays, iniciar partidas, avanzar el bucle rAF y leer estado.
// NO es un *.test.js (no lo corre la batería); lo require-an las pruebas de comportamiento.
// Stubs permisivos: document/window/canvas/ctx no-op, localStorage en memoria, sin IndexedDB.
// Fuerza la rama de NAVEGADOR de cada módulo (module indefinido dentro de la Function).

const fs = require('fs');
const ROOT = __dirname + '/..';

function crearApp(opts) {
  opts = opts || {};
  const mem = new Map();
  if (opts.seed) Object.keys(opts.seed).forEach(function (k) { mem.set(k, JSON.stringify(opts.seed[k])); });
  const localStorage = {
    getItem: function (k) { return mem.has(k) ? mem.get(k) : null; },
    setItem: function (k, v) { mem.set(k, String(v)); },
    removeItem: function (k) { mem.delete(k); },
  };
  function makeCtx() {
    const grad = { addColorStop: function () {} };
    return new Proxy({}, {
      get: function (_t, p) {
        if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return function () { return grad; };
        if (p === 'canvas') return { width: 800, height: 600 };
        if (p === 'measureText') return function () { return { width: 10 }; };
        return typeof p === 'string' && /^[a-z]/.test(p) ? function () {} : 0;
      },
      set: function () { return true; },
    });
  }
  let idSeq = 0;
  function makeEl(tag, id) {
    const L = {}, ch = [], at = {}, cl = new Set();
    let _text = '';
    const el = {
      _tag: tag, id: id || ('el' + (++idSeq)), _listeners: L, children: ch, style: {},
      value: '', _attrs: at, dataset: {},
      // textContent como en el DOM: leer devuelve lo asignado; asignar '' VACÍA los hijos.
      get textContent() { return _text; },
      set textContent(v) { _text = String(v == null ? '' : v); if (_text === '') ch.length = 0; },
      classList: {
        add: function () { for (let i = 0; i < arguments.length; i++) cl.add(arguments[i]); },
        remove: function () { for (let i = 0; i < arguments.length; i++) cl.delete(arguments[i]); },
        toggle: function (c, f) { const on = f === undefined ? !cl.has(c) : f; on ? cl.add(c) : cl.delete(c); return on; },
        contains: function (c) { return cl.has(c); },
      },
      setAttribute: function (k, v) { at[k] = String(v); if (k.indexOf('data-') === 0) el.dataset[k.slice(5)] = String(v); },
      getAttribute: function (k) { return k in at ? at[k] : null; },
      removeAttribute: function (k) { delete at[k]; },
      addEventListener: function (t, cb) { (L[t] = L[t] || []).push(cb); },
      removeEventListener: function () {},
      dispatch: function (t, ev) { (L[t] || []).forEach(function (cb) { cb(ev || { preventDefault: function () {}, clientX: 0, clientY: 0 }); }); },
      // appendChild como en el DOM: un DocumentFragment (_tag 'frag') VUELCA sus hijos.
      appendChild: function (c) { if (c && c._tag === 'frag') { c.children.forEach(function (x) { ch.push(x); }); c.children.length = 0; return c; } ch.push(c); return c; },
      removeChild: function (c) { const i = ch.indexOf(c); if (i >= 0) ch.splice(i, 1); return c; },
      insertBefore: function (c) { ch.push(c); return c; },
      replaceChildren: function () { ch.length = 0; },
      remove: function () {},
      querySelector: function () { return makeEl('div'); },
      querySelectorAll: function (sel) { return ch.filter(function (c) { return sel === '*' || c._tag === sel || sel.indexOf(c._tag) >= 0; }); },
      getContext: function () { return makeCtx(); },
      getBoundingClientRect: function () { return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }; },
      focus: function () {}, select: function () {}, blur: function () {}, scrollIntoView: function () {},
      click: function () { el.dispatch('click'); }, closest: function () { return null; }, matches: function () { return false; },
      setPointerCapture: function () {}, releasePointerCapture: function () {},
      get firstChild() { return ch[0] || null; },
    };
    Object.defineProperty(el, 'scrollTop', { value: 0, writable: true });
    return el;
  }
  const byId = {};
  const document = {
    documentElement: makeEl('html', 'de'), hidden: false,
    getElementById: function (id) { return byId[id] = byId[id] || makeEl('div', id); },
    createElement: function (t) { return makeEl(t); },
    createElementNS: function (n, t) { return makeEl(t); },
    createTextNode: function (t) { return { nodeType: 3, textContent: t }; },
    createDocumentFragment: function () { return makeEl('frag'); },
    addEventListener: function () {},
  };
  let fakeNow = 1000, rafCb = null;
  const window = {
    devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, localStorage: localStorage,
    location: { href: 'h', reload: function () {} },
    matchMedia: function (q) { return { matches: /pointer: fine/.test(q), addListener: function () {}, addEventListener: function () {}, media: q }; },
    addEventListener: function () {},
  };
  const performance = { now: function () { return fakeNow; } };
  const getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  const requestAnimationFrame = function (cb) { rafCb = cb; return 1; };
  const cancelAnimationFrame = function () { rafCb = null; };
  const navigator = { userAgent: 'node', maxTouchPoints: 0, vibrate: function () {} };

  function load(f) {
    const code = fs.readFileSync(ROOT + '/js/' + f, 'utf8');
    new Function('window', 'globalThis', 'console', 'Math', 'JSON', 'Date', code)(window, window, console, Math, JSON, Date);
  }
  ['util.js', 'fisica.js', 'puntuacion.js', 'shotclaud.js', 'render.js', 'bitacora.js', 'ranking.js', 'compartir.js'].forEach(load);
  if (opts.antesDeMain) opts.antesDeMain(window); // p.ej. envolver window.Fisica

  const mc = fs.readFileSync(ROOT + '/js/main.js', 'utf8');
  new Function('window', 'document', 'performance', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'navigator', 'console', 'Math', 'JSON', 'Date', 'setTimeout', 'clearTimeout', 'Ranking', mc)(
    window, document, performance, getComputedStyle, requestAnimationFrame, cancelAnimationFrame,
    navigator, console, Math, JSON, Date, function () { return 0; }, function () {}, window.Ranking);

  function step(ms) { fakeNow += ms; if (rafCb) { const cb = rafCb; rafCb = null; cb(fakeNow); } }
  function disparar(x, y) { const c = byId['juego']; if (c) c.dispatch('pointerdown', { preventDefault: function () {}, clientX: x, clientY: y, pointerId: 1 }); }
  function cardDeJuego(id) { const l = byId['juegoLista']; return l && l.children.find(function (c) { return c._attrs['data-juego'] === id; }); }

  return { byId: byId, mem: mem, step: step, disparar: disparar, cardDeJuego: cardDeJuego, window: window, document: document };
}

module.exports = { crearApp: crearApp };
