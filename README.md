# hitclaud

Juego PWA de puntería en canvas 2D, homenaje a Claude Code. Se arrastra para
lanzar una bola contra targets que se demuelen por celdas. Completo y jugable:
tres modos (15/30/60 s), física con rebotes, fragmentos, CloudOver y récord.

Sitio estático, JavaScript vainilla, sin build. **Cero dependencias de JS.** La
única dependencia de red es la fuente Inter de Google (no cacheada).

## Publicado

GitHub Pages sirve la raíz de `main`: https://patrickmacip.github.io/hitclaud
Publicar = commit + push a `main`. Si cambia código servido, subir la versión del
service worker en `sw.js`.

## Pruebas

Node puro, sin dependencias (no hay `npm test`):

    for t in test/*.test.js; do node "$t"; done

## Documentación

La doc real vive en `docs/`: METODO, HITCLAUD, LEYES, CONTEXTO, más DISEÑO-UI y
LECCIONES.
