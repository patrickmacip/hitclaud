# LEYES — hitclaud

Sellos, puertas cerradas y reglas ganadas por error.
Pat es la única autoridad que cambia una ley.

Una pieza sellada no se toca. Si un spec la contradice, el director avisa en vez
de aplicarlo.

---

## 1. LEYES DE PRODUCTO

### NINGUNA PANTALLA DEJA EL JUEGO SIN SALIDA
Todo overlay debe tener al menos un botón que devuelva el control al jugador.
Nació del bug de la fase 21: el overlay de nombre no estaba registrado en las
reglas CSS de overlay, no se ocultaba, y el juego quedaba intocable.
Arreglado en la fase 22 (81078cf) con paridad CSS + botón "Omitir" como salida
de emergencia.
**Hay una prueba de paridad HTML↔CSS que falla si un overlay futuro se registra
en HTML pero no en CSS.**

### CADA MODO TIENE RÉCORD PROPIO
15, 30 y 60 segundos guardan por separado. No se mezclan ni se comparan.

### EL RÉCORD SOLO SE GUARDA SI LA PARTIDA TERMINÓ POR TIEMPO
Una partida cortada por CloudOver no guarda récord. Commit c3097ad.

---

## 2. LEYES TÉCNICAS

### EL SERVICE WORKER ES TODO O NADA
El precacheo es atómico. Una instalación a medias sirve versiones mezcladas y
congela el juego.
Nació de un congelamiento total en producción.

### LA VERSIÓN DEL SERVICE WORKER SE SUBE EN CADA PUBLICACIÓN
Si no se sube `CACHE`, el navegador sirve la copia vieja aunque el código haya
cambiado. Es el problema histórico número uno.
**No confiar en "ya se ve el cambio" sin haber subido la versión.**

### EL SERVICE WORKER TRAE COPIA FRESCA AL INSTALAR
`addAll` con `Request(url, {cache:'reload'})`. Sin eso, el service worker cachea
las copias viejas que ya tenía el navegador.
Registrado en LECCIONES.md.

### SIN SOMBRAS EN EL BUCLE DE DIBUJO
`shadowBlur` dentro del bucle bajó el juego a ~20 fps en iPhone.
Sustituido por degradados cacheados y halos con arcos. Commit 9246c33.
**Puerta cerrada: no se vuelve a meter blur por cuadro.**

### UN THROW DENTRO DEL rAF MATA EL JUEGO
Todo el cuerpo del bucle va en try/catch y se re-agenda en `finally`.
Registrado en LECCIONES.md.

### UN TOKEN VACÍO ROMPE EL CANVAS DE FORMAS DISTINTAS
`fillStyle=''` se ignora en silencio; `addColorStop('')` lanza excepción.
Los tokens de color se leen con respaldo.
Registrado en LECCIONES.md.

### ESPECIFICIDAD CSS: UNA CLASE NO ANULA UN ID
Origen del bug del overlay de la fase 21.
Registrado en LECCIONES.md.

### LOS TARGETS TIENEN SU PROPIA GRAVEDAD
Excepción declarada: targets 0.0021 (flote lunar), bolitas 0.0035.
No se unifican.

### LA PERSISTENCIA ES BEST-EFFORT
Doble almacén con try/catch. Si el almacenamiento está bloqueado (iOS privado),
se juega sin guardar y sin romper. Nunca se asume que escribir funciona.

---

## 3. LEYES DE MÉTODO

### CC NO VALIDA CON NAVEGADOR. NUNCA.
El service worker sirve versiones viejas. Una afirmación visual de CC no es
evidencia.
Solo pruebas de Node: PASS/FAIL, grep, valores computados.
**Puerta cerrada.**

### LA ÚNICA EVIDENCIA VISUAL ES EL IPHONE DE PAT
Ni el director ni CC afirman cómo se ve o se siente algo.

### DIAGNÓSTICO ANTES DE CÓDIGO, CON EVIDENCIA REAL
Nunca arreglos a ciegas. Si hay incertidumbre, se dice y se diagnostica.

### ALCANCE CERRADO EXPLÍCITO
Todo prompt lleva lista de archivos y "prohibido tocar todo lo demás".
Nació de que CC borró código funcional de tabla de posiciones que no estaba
autorizado a tocar.

### LOS CAMBIOS VISUALES SE APRUEBAN COMO NÚMEROS
Color, sombra, tamaño o forma se le muestran a Pat como valores concretos y
requieren su OK **antes** de entrar al prompt.

---

## 4. REGLAS GANADAS POR ERROR

**Fase 21 — el overlay que congeló el juego.**
Un overlay registrado en HTML pero no en las reglas CSS no se oculta. El juego
quedó intocable. Las pruebas no lo vieron porque no tocan el DOM.
Ganancia: prueba de paridad HTML↔CSS + ley de salida en toda pantalla.

**El congelamiento por versiones mezcladas.**
El service worker sirvió una mezcla de archivos viejos y nuevos.
Ganancia: precacheo atómico.

**La regresión de fps por shadowBlur.**
Caída a ~20 fps en iPhone. Parte del síntoma se explicaba además por el modo de
bajo consumo del iPhone, que limita el navegador a 30 fps.
Ganancia: sin blur por cuadro; y considerar el modo de bajo consumo antes de
diagnosticar fps.

**La predicción equivocada sobre la masa.**
El director predijo que una bola más pesada haría más difícil encadenar golpes.
La simulación probó lo contrario.
Ganancia: se simula antes de afirmar cómo se comportará la física.

---

## 5. DECISIONES REVERTIDAS — no volver a proponer

**Zoom de cámara en el CloudOver.** Implementado (80115d2) y revertido
(e737e96) tras el veto visual de Pat. Queda solo la sacudida.

**Copias fantasma como estela.** Sustituidas por un rastro continuo tipo meteoro
(5334f20).

**Modo Relax.** Eliminado (e2b305d). Su llave de persistencia quedó huérfana.

**Página de récords con top-5 (`#records`).** Se introdujo (c4e3c9d) y se quitó
en los commits de login posteriores. NO existe en el código actual.
DISEÑO-UI.md todavía la describe: es doc obsoleta.

---

## 6. PENDIENTE DE DECISIÓN DE PAT

**El nombre.** "hitclaud" tiene riesgo de marca por cercanía con Claude.
Decisión obligatoria antes de publicar en cualquier tienda.
`manifest.json` declara hoy "hitcloude", inconsistente con el nombre del repo.
