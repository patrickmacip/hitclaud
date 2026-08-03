# HITCLAUD — Qué es el proyecto y cómo se toca

Censado contra el código el 2026-08-02. HEAD ecb602c, rama main, 104 commits.

---

## 1. QUÉ ES

Juego PWA de canvas 2D, homenaje a Claude Code. Se arrastra desde el hitmaker
para lanzar una bola contra targets que se demuelen por celdas.

Publicado en `patrickmacip.github.io/hitclaud`.
Repo privado: `patrickmacip/hitclaud`. Carpeta local: `~/Proyectos/hitclaud`.

**Nombre provisional.** "hitclaud" tiene riesgo de marca por su cercanía con
Claude. Decisión pendiente antes de publicar en cualquier tienda.
`manifest.json` declara hoy "hitcloude" — inconsistente con el nombre del repo.

---

## 2. STACK

Sitio estático. Canvas 2D, JavaScript vainilla, sin build.

**Cero dependencias de JS.** No hay package.json, node_modules, bundler ni
framework. Confirmado por censo.

**Una dependencia de red:** la fuente Inter desde Google Fonts (index.html
11-13). NO está cacheada por el service worker: sin red cae a `system-ui`.
No prometer "100% offline" sin resolver esto.

---

## 3. ARCHIVOS

Punto de entrada: `index.html` (113 líneas). Carga en este orden al final del
body: `util.js`, `fisica.js`, `puntuacion.js`, `render.js`, `main.js`.
El arranque real es `js/main.js`, un IIFE que se autoejecuta.

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.html` | 113 | Barra (Record, Nombre, Actual, pausa), canvas `#juego`, hitmaker, 5 overlays |
| `css/tokens.css` | 44 | Fuente única de color y tipografía |
| `css/main.css` | 315 | Layout, barra, canvas, hitmaker, reglas de overlays |
| `js/util.js` | 359 | Persistencia doble, aviso de versión, secuencia CloudOver, estela, medidor de fps, cascada de datos del fondo. Módulo puro, sin DOM |
| `js/fisica.js` | 635 | Motor puro: disparo, gravedad por objeto, subpasos anti-túnel, targets, colisión, daño por celdas, fragmentos. Sin DOM |
| `js/puntuacion.js` | 186 | Marcador puro: demolición, rachas, fallo, ritmo, caos de spawn, escalada de rojos. Sin DOM |
| `js/main.js` | 1537 | El corazón: input, bucle rAF, todo el render, cableado, overlays, persistencia, service worker |
| `js/render.js` | 3 | VACÍO a propósito. Se carga y se cachea; no hace nada |
| `sw.js` | 45 | Service worker cache-first |
| `manifest.json` | 22 | PWA instalable |

`assets/icon-192.png`, `assets/icon-512.png`. `.nojekyll` en raíz.

**La separación importa:** `fisica.js`, `puntuacion.js` y `util.js` son módulos
puros sin DOM. Por eso se pueden probar con Node. `main.js` es el único que toca
el DOM.

---

## 4. CÓMO SE PUBLICA

GitHub Pages sirve la **raíz de la rama main**. No hay gh-pages, ni acción de
CI, ni build.

```
git add -A
git commit -m "..."
git push origin main
```

Redespliega solo en 1-2 minutos.

**OBLIGATORIO antes de publicar código servido: subir la versión del service
worker.** Si no, el navegador sigue sirviendo la copia vieja. Es el problema
histórico número uno del proyecto.

**Revertir:**
- Un commit puntual: `git revert <sha>` y push. Seguro, no reescribe historia.
- Punto de retorno etiquetado: `v0.1-zen` (720be2, 2026-07-17). Es la versión
  jugable ANTES de los modos 15/30/60, CloudOver, nombre, target grande y
  fragmentos. Está MUY atrás: sirve de red pero no de "última versión buena".
- En la práctica el punto seguro es el commit anterior en main.

---

## 5. SERVICE WORKER

`sw.js`, cache-first del shell. Hoy declara `CACHE = 'hitclaud-shell-v58'`.

Cachea: raíz, index.html, los dos CSS, los cinco JS, manifest y los dos iconos.
NO cachea `sw.js` (correcto) ni la fuente de Google.

- **install:** `addAll` con `Request(url, {cache:'reload'})` — salta el caché
  HTTP del navegador y trae copia fresca. Luego `skipWaiting()`.
- **activate:** borra todas las caches con otro nombre, luego `clients.claim()`.
- **fetch:** caché primero, red si falta.
- **Auto-recarga:** al tomar control un SW nuevo (`controllerchange`), recarga la
  página una vez. Añadido en 564ed88.

**La versión se sube A MANO.** v58 → v59. Sin eso, el cambio no llega.

---

## 6. PERSISTENCIA

Doble almacén: `localStorage` + IndexedDB (base `hitclaud`), misma llave, con
reconciliación al arrancar. Todo envuelto en try/catch: si un almacén falla
(modo privado de iOS, cuota), cae al otro o a memoria sin romper.

| Llave | Qué guarda |
|---|---|
| `hitclaud.record.v2.60` / `.30` / `.15` | `{record, ultimoScore}` por modo |
| `hitclaud.nombre.v2` | Nombre del usuario |
| `hitclaud.novedades.v1` | Última versión cuyo aviso se vio |
| `hitclaud.record.v2.libre` | HUÉRFANA — del modo Relax eliminado. No se lee ni se escribe |

Si el usuario borra datos: se pierden récords y nombre, se vuelve a pedir el
nombre, y el aviso de novedades se trata como usuario nuevo (no se muestra, se
re-guarda en silencio). El juego sigue funcionando.

---

## 7. PRUEBAS

46 archivos en `test/`, Node puro, sin DOM, sin dependencias. Los 46 pasan
(censado 2026-08-02).

Cada prueba hace dos cosas: grep del código fuente (que ciertos patrones o
constantes existan) y lógica pura importando los módulos.

```
# una
node test/masa.test.js

# todas (no hay npm test ni runner)
for t in test/*.test.js; do node "$t"; done

# sintaxis
node --check js/util.js js/fisica.js js/puntuacion.js js/main.js js/render.js
```

Cubren: motor (colisión, túnel, masa, fragmentos, targets, escalada), marcador
(rachas, ganancia, castigo, pérdida), datos (persistencia, usuario, nombre,
récord), pantallas (inicio, gameover, overlays, modos, novedades, secuencia) y
render (rendimiento, fps, estela, cubos, sacudida, contador).

**Su punto ciego:** no tocan el DOM ni el canvas. No pueden atrapar bugs
visuales ni de cableado DOM/CSS. Por ahí se escapó el bug de la fase 21.

---

## 8. MODOS Y PANTALLAS

**Modos:** 15, 30 y 60 segundos. Cuenta regresiva. La única diferencia es el
valor de `DURACIONES` (15000/30000/60000 ms). Cada modo tiene récord propio.
El modo Relax fue ELIMINADO (e2b305d).

**Dos formas de tiro** según plataforma (`matchMedia pointer:fine`):
- Móvil: arrastre, hitball de radio 14, muere al salir del viewport.
- Escritorio: mira que sigue el cursor + hitscan (impacto inmediato).

**Cinco overlays**, todos `role="dialog"` y todos registrados en las reglas CSS
de overlay. Hay una prueba de paridad que lo obliga.

| Overlay | Salida |
|---|---|
| `#nombre` | "Confirmar" y "Omitir" (salida de emergencia) |
| `#novedades` | "Entendido" |
| `#inicio` | Selector 15/30/60 + JUGAR |
| `#gameover` | Botones 15/30/60 |
| `#pausa` | "Continuar" y "Reiniciar" |

**Todas tienen salida.** Es ley.

---

## 9. FÍSICA — ESTADO REAL

Implementado y funcionando:

- **Rebotes:** `transferirMomento`, restitución 0.3, masas `MASA_HITBALL = 1.1`
  (subida +10% en fase 23) y `MASA_TARGET = 2.5`. El rebote de destrucción frena
  por la masa.
- **Muerte de la bola:** `paso()` marca `viva=false` al salir del viewport
  (mundo sin paredes) o al agotar `VIDA_MAX_MS` (6 s). Si no tocó nada = fallo
  (−50).
- **Anti-túnel:** subpasos con `MAX_PASO_PX = 6`.
- **Fragmentos:** tras un golpe que parte el target (criterio 4-vecinos), el
  trozo mayor conserva identidad y los demás se desprenden como targets
  golpeables, heredan velocidad y rotación, caen y puntúan. Pueden re-partirse.
  Tope `MAX_TARGETS_VIVOS = 10`. Un fragmento de CloudOver NO mata.
- **Cadenas de impacto (carambola):** una misma bola puede golpear varios
  targets en un cuadro; el frenado del rebote la deja seguir al siguiente.
- **Gravedad por objeto:** bolitas 0.0035, targets 0.0021 (flote lunar).
- **CloudOver (rojo):** cualquier contacto termina la partida.
- **Target grande:** grilla 10×8 (80 celdas), mínimo 4 golpes.

Intencionalmente desactivado:
- El one-shot por golpe fuerte, solo para el target grande. Se demuele por
  zonas. El target normal sí se destruye de un tiro potente.
- La cámara/zoom del CloudOver fue eliminada (revert e737e96). Queda la sacudida
  (12px / 300ms).

**No hay física a medias.**

---

## 10. CÓDIGO MUERTO — inventario, no se toca sin orden

- `js/render.js` — 3 líneas, vacío. Se carga y se cachea; no ejecuta nada.
- `util.js`: `cascConst`, `CASC_CONST_FISICA`, `CASC_CONST_PUNT` — exportados,
  referenciados en ningún lado.
- `util.js`: `SEC`, `CAM`, `parseEntrada`, `CASC_EVENTOS` — usados SOLO por las
  pruebas. Superficie de test, no muertos del todo.
- Medidor de fps (`crearMedidorFps`, util.js:229 y main.js:541) — rotulado
  "debug temporal (build v41-fps)". Sigue embarcado y activo.
- Llave `hitclaud.record.v2.libre` — huérfana del modo Relax.
- Tokens `--indigo`, `--indigo-vivo`, `--cian`, `--crema` en tokens.css — sin
  uso, marcados "reservado".

---

## 11. DOCUMENTOS EN EL REPO — estado

- `README.md` — MUY desactualizado. Dice "solo esqueleto visual, sin lógica de
  juego". Es falso: el juego está completo. **Es la doc más engañosa.**
- `docs/CONTEXTO.md` — correcto para el arranque, stale en detalles: menciona
  Relax como vigente y lista 6 pruebas cuando hay 46.
- `docs/DISEÑO-UI.md` — el más detallado. Paleta, spawn caótico, target grande,
  economía y escalada son fieles. Stale: menciona Relax, un tablero de scores
  top-5 y overlay `#records` que NO existen, llaves `record.v3.*` y
  `scores.v1` (el código usa `record.v2.*`), `SPAWN_GAP_MAX ≤600ms` (el código
  dice 800) y "bolita indigo" (hoy es naranja/coral).
- `docs/LECCIONES.md` — **vigente y valioso.** Todo sigue siendo cierto.

---

## 12. LO QUE NO SE PUEDE HACER — puertas cerradas

- **Validar por navegador: PROHIBIDO.** Solo terminal: `node --check` y las
  pruebas. El service worker sirve versiones viejas.
- **No hay npm.** No existe `npm test`. Correr todo es a mano con un bucle de
  shell.
- **Las pruebas no ven el DOM ni el canvas.** No atrapan bugs visuales ni de
  cableado CSS. Por ahí se escapó el bug de la fase 21. Mitigado con la prueba
  de paridad HTML↔CSS de overlays, pero sigue siendo el punto ciego.
- **El service worker obliga a subir la versión a mano.** Sin eso, no llega el
  cambio.
- **La fuente de Google no está cacheada.** Offline cae a system-ui.
- **Las pruebas de patrón (grep) se rompen al refactorizar.** Si un valor fijo
  pasa a ser un mapa, o se agrega un overlay, hay que actualizarlas.
- **Simulaciones con `Math.random` y N grande** se vuelven lentas o
  intermitentes. Mantener N chico y aserciones deterministas.
- **wrangler por OAuth se colgó repetidamente** en este entorno (abre navegador).
  La vía viable es token de API sin navegador. Los tokens se ponen por terminal
  de Pat con prefijo de espacio, nunca en el chat.
