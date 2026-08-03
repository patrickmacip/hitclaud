# CONTEXTO — hitclaud

Memoria viva. Se lee antes de proponer nada.

---

## 0. CÓMO SE USA ESTE ARCHIVO

Los chats no recuerdan nada entre sesiones: lo único que viaja de un chat al
siguiente es lo que esté escrito aquí.

- **Todo entra con fecha.** La entrada más reciente sobre un tema manda.
- **Nada se borra.** Lo que dejó de ser cierto se marca SUPERADO con la fecha.
- **Cada entrada responde cuatro cosas:** qué se hizo, por qué, qué generó y qué
  quedó pendiente.
- **Los errores se registran igual que los aciertos**, con su costo.
- **Jamás una credencial.** Se registra que existe y dónde vive, nunca su valor.

Al cerrar cada sesión, el director dicta la entrada del día y CC la escribe aquí
y la commitea.

---

## 1. ESTADO — 2026-08-02

Rama `main`, HEAD `ecb602c`, limpio y sincronizado con origin. 104 commits.

**El juego está completo y jugable.** Fases 1 a 23 cerradas.

Publicado en `patrickmacip.github.io/hitclaud`. GitHub Pages sirve la raíz de
main, sin build ni CI.

Service worker en `hitclaud-shell-v58`.

46 pruebas de Node, las 46 pasan.

Cero dependencias de JS. Una dependencia de red: la fuente Inter de Google, no
cacheada.

---

## 2. LO QUE FUNCIONA HOY

- Tres modos: 15, 30 y 60 segundos, con récord propio cada uno.
- Dos formas de tiro: arrastre en móvil, mira + hitscan en escritorio.
- Cinco overlays, todos con salida: nombre, novedades, inicio, gameover, pausa.
- Física: rebotes con masa, anti-túnel por subpasos, muerte de la bola,
  fragmentos desprendibles y golpeables, cadenas de impacto, gravedad por
  objeto.
- CloudOver: contacto con el rojo termina la partida (explosión, congelamiento,
  vaciado a cero, overlay).
- Target grande: grilla 10×8, mínimo 4 golpes, sin one-shot.
- Persistencia doble (localStorage + IndexedDB) con reconciliación.
- Nombre de usuario pedido una sola vez.
- Aviso de novedades por versión, mostrado una vez.
- Cascada de datos reales del juego como textura de fondo, con la firma del
  autor.
- Estela tipo meteoro.

---

## 3. PENDIENTES

**[PENDING — decisión de Pat] El nombre.**
"hitclaud" tiene riesgo de marca. Bloqueante antes de publicar en tienda.
`manifest.json` declara "hitcloude", inconsistente con el repo.

**[PENDING] Tabla de posiciones global.**
Cloudflare Workers + KV, top 20 por modo, sin login, tolerante a estar sin
conexión. Alcance definido, no implementado.
Vivirá en `~/Proyectos/hitclaud-ranking` (carpeta hermana) para no romper el
cero-dependencias del repo del juego.
La cuenta de Cloudflare de Pat existe. wrangler 4.118.0 verificado como
funcional.
**Bloqueo conocido:** el login de wrangler por OAuth abre navegador y se colgó
repetidamente. La vía viable es token de API sin navegador.

**[PENDING] Sonido y música.** No empezado.

**[PENDING] Documentos del repo desactualizados.**
- `README.md` dice que no hay juego. Falso. Es la doc más engañosa.
- `docs/CONTEXTO.md` menciona Relax como vigente, lista 6 pruebas de 46.
- `docs/DISEÑO-UI.md` menciona Relax, tablero top-5 y overlay `#records` que no
  existen, llaves `record.v3.*` y `scores.v1` (el código usa `record.v2.*`),
  `SPAWN_GAP_MAX ≤600ms` (el código dice 800), "bolita indigo" (hoy es
  naranja/coral).
- `docs/LECCIONES.md` es el único totalmente al día.

**[PENDING] Código muerto.** Inventariado, sin limpiar. Ver HITCLAUD.md §10.

**[PENDING] La fuente de Google no está cacheada.**
Sin red, la tipografía cae a system-ui. No prometer "100% offline".

---

## 4. MECÁNICAS PENDIENTES DE ESPECIFICAR

Registradas en conversaciones anteriores, sin implementar ni cerrar:

- **Carambola:** la bola sobrevive al impacto y los golpes encadenados premian
  con 500 puntos. **Pregunta abierta: cuántos golpes cuenta una racha.**
  Nota: las cadenas de impacto YA funcionan en la física (ver HITCLAUD.md §9).
  Lo pendiente es la mecánica de premio, no la colisión.
- **Grandote en trozos flotantes:** opción A elegida — caen fuera de pantalla
  como los cubos de explosión.
  Nota: los fragmentos YA se desprenden y son golpeables (856e680). Verificar
  qué queda realmente pendiente antes de dictar.

---

## 5. DIAGNÓSTICOS EJECUTADOS

Se registran para que ningún chat futuro los vuelva a pedir.

**2026-08-02 — CENSO COMPLETO DEL REPO.**
Inventario de archivos con tamaños, forma de publicar, service worker,
persistencia, pruebas, modos, overlays, estado de la física, código muerto,
documentos y puertas cerradas.
Resultado completo volcado en HITCLAUD.md y LEYES.md.

Hallazgos que corrigen creencias anteriores:
- `render.js` está vacío a propósito; todo el dibujo vive en `main.js`.
- El overlay `#records` con top-5 NO existe en el código, aunque DISEÑO-UI.md lo
  describa.
- Los fragmentos de target YA están implementados y funcionando.
- Las cadenas de impacto YA funcionan en la física.
- Hay 46 pruebas, no 6.
- El tag `v0.1-zen` está muy atrás: sirve de red, no de "última versión buena".

---

## 6. HISTORIA RECIENTE

Últimos commits, del más viejo al más nuevo:

564ed88 auto-recarga del SW, input de nombre grande + Enter, spawn 800ms ·
1a57c87 botón OK del login · 1302239 solo Enter azul, leyenda Registrado ·
c4e3c9d página general de récords (después retirada) · a94d89d persistencia solo
récord máximo y último score · df3085a velocidad de targets +25% · ee888f8
hitmaker centrado · c3097ad récord solo si se cumple el tiempo · 3406e79
CloudOver: explosión, congelamiento, vaciado, overlay · 9246c33 fuera shadowBlur
del bucle · 5334f20 estela meteoro · a634c76 restitución 0.6 → 0.3 · 0008cf0
medidor de fps · 80115d2 cámara al impacto · e737e96 revert del zoom · b7c9457
cascada de datos reales · b859b00 datos fijos en vivo · ea3586b datos vivos ·
46bb7c4 pantalla de bienvenida · 2dd976f modo 30s · ee586a9 modo 15s · 7bbc0f8
nombre de usuario · b03df84 firma del autor · e2b305d eliminar Relax · 81078cf
overlay de nombre registrado + salida de emergencia · 486fb6a nombre al centro ·
af89488 fuera el contorno del contador · 7a27c66 hitball 10% más pesada ·
856e680 fragmentos desprendibles · ecb602c aviso de novedades

Tag `v0.1-zen` = 720be2, 2026-07-17.

---

## 7. LO PRIMERO QUE HARÍA EL PRÓXIMO CHAT

1. Verificar contra el código qué queda realmente pendiente de carambola y
   fragmentos (§4). Puede que ya esté hecho.
2. Actualizar los documentos del repo (§3), empezando por README.
3. Decisión de Pat sobre el nombre.
