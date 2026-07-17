# hitclaud — Lecciones

Registro de aprendizajes del proyecto. Una entrada por lección, con fecha.

## 2026-07-17 — Arranque

- El dibujo de muestra vive en `main.js` para mantener `render.js` vacío hasta que exista el modelo de datos; moverlo será el primer refactor de la fase de render.

## 2026-07-17 — Excepción de gravedad para los targets

- `paso()` es la fuente única de física, PERO acepta gravedad por objeto (`o.gravedad`). Las bolitas usan `GRAVEDAD = 0.0035` (validada por el dueño; alterarla cambiaría sus tiros). Los targets usan `G_TARGET = 0.0021` (0.6×): "flote lunar".
- **Por qué la excepción:** los targets pertenecen al "otro lanzador" y su lectura es contemplativa, no balística — deben flotar y dar tiempo a apuntarles, no comportarse como proyectiles. No es un motor paralelo: es el mismo `paso()` con una constante por objeto.
- **Tensión física declarada:** con `G_TARGET` fijo y el tope de ápice al 80%, los laterales sólo alcanzan 1.5s rozando ese 80%, así que salen casi idénticos. Para recuperar variedad habría que ampliar el ápice (≤90%) o bajar más `G_TARGET`.
