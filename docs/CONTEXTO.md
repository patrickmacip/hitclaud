# hitclaud — Contexto

- **Qué es:** PWA de juego offline (título de trabajo: hitclaud).
- **Método:** GUIA-NUEVO-PROYECTO.md del laboratorio — tokens antes que componentes, datos antes que pantallas.
- **Estado (2026-07-17):** esqueleto visual únicamente. Sin lógica de juego, sin física, sin sonido, sin frameworks ni librerías.
- **Stack:** HTML + CSS + JS vainilla, canvas 2D, service worker cache-first, manifest instalable.
- **Estructura:**
  - `css/tokens.css` — fuente única de verdad de color y tipografía.
  - `css/main.css` — layout de la pantalla de juego.
  - `js/main.js` — arranque del shell y dibujo estático de muestra.
  - `js/fisica.js`, `js/render.js` — vacíos, reservados para las siguientes fases.
- **Próximo paso:** modelo de datos del juego (targets, niveles) antes de cualquier pantalla nueva.
