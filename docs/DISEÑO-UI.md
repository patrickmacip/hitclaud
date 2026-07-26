# hitclaud — Diseño UI

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#121216` | Fondo general |
| `--superficie` | `#15151C` | Superficies elevadas (botón pausa) |
| `--coral` | `#E8704E` | Acento naranja por defecto, targets normales, hitmaker |
| `--coral-vivo` | `#FF8764` | Hitball normal, score actual, anillo del hitmaker |
| `--acento` / `--acento-vivo` | (JS) | **Baño de color activo**: por defecto naranja; el JS lo reescribe al color del modo (dorado/verde/azul) para el hitmaker. El FONDO y la SUPERFICIE NUNCA se tocan. |
| `--crema` | `#FFD9CE` | Reservado (destellos / énfasis) |
| `--indigo` | `#5C5CC8` | (reservado) |
| `--indigo-vivo` | `#7C7CFF` | (reservado) |
| `--azul` | `#1F55C9` | **Castigo** (antes morado): enojado, hitball chica (debuff), barra de debuff. Contraste 2.85:1 |
| `--dorado` | `#FFC300` | Estrella (fiesta) / multiplicador. Contraste 11.62:1 |
| `--cian` | `#22D3EE` | Reservado (antes moneda; la moneda ahora es verde) |
| `--disperso` | `#6FFF2C` | Moneda / power-up / dispersión (verde). Contraste 14.25:1 |
| `--amenaza` | `#08080E` | CloudOver: masa oscura |
| `--cloudover-a` | `#B1003B` | CloudOver parpadeo A. Contraste 2.61:1 |
| `--cloudover-b` | `#FF0055` | CloudOver parpadeo B. Contraste 4.79:1 |
| `--coral-vivo` | `#FF8764` | Hitball del jugador (modo normal) + score Actual. Contraste 7.92:1 |
| `--texto-apagado` | `#8989B1` | Etiquetas secundarias |
| `--texto-apagado-fuerte` | `#B9B9DC` | Números secundarios |
| `--negro` | `#000` | Ojos del target |

## Idioma del color — regla del sistema

**Dos tipos de target (purga):** el juego quedó con **NARANJA** (el que puntúa) y
**ROJO** (parpadea y termina la partida). Se eliminaron de raíz los especiales de
color (estrella/bonanza, moneda/power-up, enojado/bola-chica) y sus power-ups.

Sin power-ups no hay más "modos": la paleta es **fija** (constante `ACENTO`, la
familia naranja). El **FONDO** `#121216` y la **SUPERFICIE** `#15151C` nunca se tocan.

| Rol | Hex | Uso |
|---|---|---|
| **base** | `#E8704E` | cuerpo del target NARANJA / debris de cubos |
| **vivo** | `#FF8764` | hitball, estela/aura, marcador Actual, badge ×N, amortiguador, flotante +N |
| **claro** | `#FFC9B8` | récord, etiquetas, ícono de pausa (defaults en tokens.css) |
| **profundo** | `#A84A2E` | reservado (jerarquía) |

El **ROJO** conserva su identidad: PARPADEA entre `#B1003B` ↔ `#FF0055` cada 100ms
(`--cloudover-a/b`), sin brillo → peligro. Los ojos negros no cambian nunca. La UI
en HTML (hitmaker, marcador, récord, pausa) toma los defaults `--acento*` de
tokens.css; el JS ya no reescribe esas variables.

**Pérdida = BORDES + CONTADOR + MONTO** (sin números flotantes regados). Al restar
puntos (fallo o inactividad):
- **Palpitar de bordes:** los dos bordes laterales se iluminan en rojo `#FF0055` (franja de 28px difuminada), entra en 100ms y disipa en 350ms. Cobros seguidos RE-DISPARAN el pulso (no se apila).
- **Contador rojo:** el marcador Actual se pinta `#FF4583` durante 400ms y vuelve al naranja vivo.
- **Monto agregado:** bajo el marcador, un solo número `#FF6D9E` (~60% del tamaño) con el total restado, palpita y disipa en 600ms; cobros seguidos se AGREGAN y reinician el palpitar.

## Modos de partida (pantalla de inicio)

Overlay al cargar y al terminar una partida, con **campo de nombre** (login) y dos botones:

- **60 seg** — cuenta regresiva (top-center "M:SS", roja y pulsante en los
  últimos 10s); al llegar a 0, termina la partida y vuelve al overlay con el score.
- **Relax mode** — sin reloj; sólo termina al tocar un rojo.

**Login por nombre + tabla de scores (local):** el jugador escribe su nombre
(`hitclaud.nombre`); al terminar, el score se registra CON el nombre en un tablero
top-5 por modo (`hitclaud.scores.v1.<modo>`) que se muestra en el overlay. Sin
backend (hosting estático) → el tablero es por dispositivo. El **récord** por modo
(`hitclaud.record.v3.*`) sigue en la celda "Record".

**Menú de PAUSA:** el botón de pausa (barra) congela la partida y abre un menú con
**Continuar** (reanuda) y **Reiniciar** (vuelve al overlay de selección de modo).
La pausa **detiene el reloj** de verdad: en 60 seg el tiempo se guarda como
`tiempoRestante` y sólo decrementa mientras se juega (no consume el tiempo pausado).

## Plataformas (dos modos de tiro)

Detección por puntero (`matchMedia('(pointer: fine)')`):

- **DESKTOP** — **mira** que sigue al cursor con precisión (cruz + anillo en
  canvas; se oculta el cursor del sistema y el hitmaker). El clic dispara un
  **HITSCAN**: una hitball 4× más chica (radio 3.5) con **impacto inmediato** que
  destruye el **cubito exacto** bajo la mira (`celdaEnPunto`), el que puntúa. Clic
  sobre un rojo = game over; clic al vacío = fallo. Cadencia mínima anti-spam.
- **MÓVIL** — tiro por **arrastre** (hitball radio 14), **sin rebote en paredes**
  (la bolita muere al salir del viewport). Contacto con un rojo = game over.

## Economía (plana)

- Cada **cubito = 5 pts** → un **target naranja completo (20 cubos) = 100**.
- **Fallo = −50** (plano, piso en 0). Inactividad = −13/s tras 3s de gracia.
- El **multiplicador de racha** sigue aplicando a las ganancias (×1 → tope ×3).
- Sin escalado por score (tramos), sin castigo por fallos consecutivos, sin
  amortiguador: todo se retiró.

## Spawn caótico y escalada de rojos

- **Tope duro:** máximo **2 targets en pantalla** (naranjas + rojos + grande, JUNTOS).
- **Tiempo entre apariciones ≤600ms:** el spawner de naranjas se recorta a ≤600ms
  (`SPAWN_GAP_MAX`, duplicado de 300 → menos acelerado). Las ráfagas se conservan.
- **Velocidad −40%:** cada target va 40% más lento (`LANZA.VEL_FACTOR` 0.6 en la
  velocidad y 0.36 en la gravedad → mismo arco, recorrido 40% más lento).
- **Todo lo que sube, baja EN PANTALLA:** el ápice de cada lanzamiento se recorta
  (`APEX_MARGEN` 40px) para que el arco (subir y bajar) suceda DENTRO del rango
  visual — ningún target cruza el techo. Como red de seguridad, un target empujado
  por encima del techo (golpe) no muere: la gravedad lo hace caer de vuelta si su
  x sigue sobre la pantalla (muere por lados/abajo). Las hitballs sí mueren al salir.
- **Multi-origen:** los targets salen de los **4 lados** (inferior, superior,
  lateral-izq, lateral-der) con **velocidad variable** por target. `crearTarget`
  (fisica.js) elige origen y velocidad; superior cae con gravedad reducida para
  ser alcanzable.
- **Cubo atómico de 8px:** toda forma se compone de cubos de 8px; **nunca** se
  inicia una forma con un cubo mayor. Un target más grande = **más cubos**, no
  cubos más grandes. El modelo (`cols×filas`) es genérico en fisica.js.
- **Target GRANDE:** un naranja extra de **doble tamaño** hecho con más cubos de
  8px (**grilla 10×8 = 80 cubos**, el doble en cada eje del 5×4). **3× más lento**
  (velocidad/3 + gravedad/9 → mismo arco, 3× de tiempo de vuelo; vida útil ×3) y
  **EXTREMADAMENTE pesado** (`pesoExtra` 80 → masa ~600: el impacto casi no lo
  desvía, se siente pesado, no como globo). **NO se destruye de un hit**: cada golpe
  demuele la **ZONA** que golpea (¼ = `ceil(vivosMax/4)` = 20 cubos cercanos al
  impacto) → exige **mín. 4 golpes**. El one-shot por golpe fuerte se desactiva
  sólo para el grande (el normal se sigue destruyendo de un tiro potente). Puntúa
  por cubo: 4 × 20 × 5 = **400**. Mínimo **8s** entre apariciones, nunca dos a la vez.
- **Cantidad variable:** `retardoCaotico` (puntuacion.js) superpone **ráfagas**
  (2–4 spawns muy juntos) y **pausas** largas sobre el rango base → nunca cadencia
  fija predecible.
- **Escalada de rojos:** `pasoEscalada` sube el nivel cada **5–10s** (sin tope);
  `intervaloRojo(nivel)` acorta el intervalo de aparición (más rojos, más seguido)
  con piso de 700ms. Los rojos salen desde cualquier lado y a cualquier velocidad.

## Tipografía

Inter (fallback `system-ui`). Escala:

- 15px / 400 — etiquetas
- 20px / 600 — títulos menores
- 24px / 400 — número de record
- 28px / 600 — score actual

## Pantalla de juego

- Barra superior 58px + `safe-area-inset-top`: Record (izq), Actual (centro), pausa 44×44 (der, `--superficie`, radius 8).
- Canvas a pantalla completa bajo la barra, DPR-aware.
- Hitmaker: cuarto de círculo de 290px sangrando en la esquina inferior derecha; gradiente radial `--coral` → transparente + anillo pulsante (2s, escala 1→1.06, CSS puro).
- Target: retícula 5×4 de cubos de 8px en `--coral`, esquinas 4px, ojos 4px en `--negro`.
- Bolita: 28px `--indigo`, borde 3px `--indigo-vivo`.
