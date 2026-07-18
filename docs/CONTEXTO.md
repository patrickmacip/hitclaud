# hitclaud — Contexto

- **Qué es:** PWA de juego offline (título de trabajo: hitclaud).
- **Método:** GUIA-NUEVO-PROYECTO.md del laboratorio — tokens antes que componentes, datos antes que pantallas.
- **Stack:** HTML + CSS + JS vainilla, canvas 2D, service worker cache-first, manifest instalable.
- **Estructura:**
  - `css/tokens.css` — fuente única de verdad de color y tipografía.
  - `css/main.css` — layout de la pantalla de juego.
  - `js/fisica.js` — motor puro (disparo, gravedad por objeto, colisión por subpasos, daño por celdas). Sin DOM.
  - `js/puntuacion.js` — marcador puro (demolición, rachas, fallo). Sin DOM.
  - `js/main.js` — shell, input táctil, bucle rAF, render en canvas y cableado de física+puntuación.
  - `js/render.js` — reservado (el dibujo vive en main.js por ahora).
  - `test/` — tests en node: `fisica`, `targets`, `colision`, `dano`, `puntuacion`, `tunel`.

## MODO ZEN — sellado en `v0.1-zen`

- **Qué es:** la versión jugable contemplativa. Tirás tranquilo mientras esperás:
  targets flotando en gravedad lunar, disparo por lanzamiento con curva suave,
  demolición por cubos y puntuación. **Sin** castigo escalado, **sin** target
  enojado, **sin** penalización por inactividad, **sin** competencia ni sonido.
- **Qué incluye:** tiro por lanzamiento con curva tanh (V_MAX apenas al borde
  superior), gravedad 0.0035 para hitballs y 0.6× lunar (0.0021) para targets,
  frenos correa+quietud anti-paseo, targets lanzados desde los 4 bordes con
  rotación, colisión por subpasos (fin del túnel), daño parcial con máscara de
  20 celdas, explosión de cubos, puntuación por demolición (10/cubo), rachas
  (5/10/50/100) y fallo −50.
- **Cómo volver a él:** `git checkout v0.1-zen`
- **El modo con dientes** (fase 4a: castigo escalado, enojado, inactividad,
  estrella, sonido) se construye ENCIMA de esta base sin romperla; este tag es
  el punto de retorno seguro.

- **Próximo paso:** fase 4a — modo con dientes sobre `v0.1-zen`.
