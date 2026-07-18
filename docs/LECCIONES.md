# hitclaud — Lecciones

Registro de aprendizajes del proyecto. Una entrada por lección, con fecha.

## 2026-07-17 — Arranque

- El dibujo de muestra vive en `main.js` para mantener `render.js` vacío hasta que exista el modelo de datos; moverlo será el primer refactor de la fase de render.

## 2026-07-17 — Congelamiento por token vacío (fix crítico)

- **Un service worker cache-first puede cachear copias VIEJAS** si `cache.addAll` pasa por el HTTP-cache del navegador. Fix: en el `install`, cachear con `new Request(url, {cache:'reload'})`. Síntoma: el código nuevo se ve viejo aunque el SW diga versión nueva.
- **Un `throw` dentro del callback del `requestAnimationFrame` MATA el bucle para siempre** si el re-agendado va después del trabajo. Regla: `try/catch` alrededor del cuerpo y re-agendar en `finally`, siempre. Un cuadro malo degrada ese cuadro, jamás el juego.
- **Un mismo dato inválido produce síntomas distintos según la API del canvas:** `fillStyle = ''` se **ignora en silencio** (bug visual mudo: pinta con el color anterior); `addColorStop('')` **lanza** (bug ruidoso: congela). Por eso el enojado se veía negro Y el juego se congelaba, del mismo `COLOR.morado = ''`.
- **Nunca dejar que un token caiga a `''`:** leer siempre con respaldo literal (`leerToken`) y avisar por consola con el nombre → diagnóstico futuro sin misterio.

## 2026-07-17 — Excepción de gravedad para los targets

- `paso()` es la fuente única de física, PERO acepta gravedad por objeto (`o.gravedad`). Las bolitas usan `GRAVEDAD = 0.0035` (validada por el dueño; alterarla cambiaría sus tiros). Los targets usan `G_TARGET = 0.0021` (0.6×): "flote lunar".
- **Por qué la excepción:** los targets pertenecen al "otro lanzador" y su lectura es contemplativa, no balística — deben flotar y dar tiempo a apuntarles, no comportarse como proyectiles. No es un motor paralelo: es el mismo `paso()` con una constante por objeto.
- **Tensión física declarada:** con `G_TARGET` fijo y el tope de ápice al 80%, los laterales sólo alcanzan 1.5s rozando ese 80%, así que salen casi idénticos. Para recuperar variedad habría que ampliar el ápice (≤90%) o bajar más `G_TARGET`.
