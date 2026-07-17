# hitclaud

PWA de juego offline (título de trabajo). Solo esqueleto visual por ahora: tokens de diseño, pantalla de juego estática, manifest instalable y service worker cache-first. Sin lógica de juego todavía.

## Correr en local

```sh
python3 -m http.server 8000
```

Abrir `http://localhost:8000` — o desde el teléfono en la misma red, `http://<ip-local>:8000`.

## Estructura

```
index.html        Pantalla de juego estática
css/tokens.css    Tokens de diseño (colores + tipografía)
css/main.css      Layout (barra, canvas, hitmaker)
js/main.js        Arranque del shell + dibujo de muestra
js/fisica.js      (vacío) física
js/render.js      (vacío) render
manifest.json     PWA instalable
sw.js             Cache-first del shell
docs/             CONTEXTO, LECCIONES, DISEÑO-UI
```
