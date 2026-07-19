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

**El MODO tiñe la pantalla.** Al entrar a un modo (golpear un especial), TODO lo
naranja del juego —la hitball, el marcador Actual, el hitmaker, los flotantes de
ganancia, el badge ×N— pasa al color del modo mientras dura. El **FONDO**
`#121216` y la **SUPERFICIE** `#15151C` NUNCA se tiñen (si lo hicieran, el juego
sería ilegible). Los **TARGETS normales siguen coral SIEMPRE** (son los blancos:
no entran al baño). El **aura/glow** de "estás en un modo" va en la **HITBALL**
(estela + glow del color del modo), NO en el target.

**Acento activo por modo** (precedencia **castigo > bonanza > power-up > normal**):

- **Normal** → **--coral-vivo** `#FF8764` (hitball) / **--coral** `#E8704E` (hitmaker). Naranja vivo, NO el coral del target (para no camuflar la munición).
- **Castigo** (bola chica / debuff) → **--azul** `#1F55C9`. El estado más urgente: gana a todos.
- **Bonanza** (fiesta) → **--dorado** `#FFC300`.
- **Power-up** (dispersión) → **--disperso** `#6FFF2C` (verde).

Transición del baño **breve y suave** (CSS `transition` 0.25s en el hitmaker y en
el marcador; el canvas cambia en el límite del modo). **SIN parpadeo del acento**
— el único que parpadea es el CloudOver, con su rojo.

**Color de los targets especiales** (SOLO cambian de color, sin aura):

- **--coral** = target normal (lo que puntúa).
- **--azul** = target enojado (activa el modo bola-chica). Ojos negros intactos.
- **--dorado** = estrella (bonanza): dorado sólido.
- **--disperso** (verde) = moneda (power-up): verde sólido.
- **--cloudover-a/b** = CloudOver (game over): PARPADEA entre dos rojos (#B1003B ↔ #FF0055) cada 100ms, **SIN brillo** → peligro. Es el único con parpadeo.

**Pérdida = ROJO** `#FF0055` (el rojo claro del CloudOver): TODO lo que RESTA puntos se ve rojo — el −N del fallo y el cobro de inactividad. El **"0"** de una dispersa sin impacto NO es pérdida (no cuesta) → **--texto-apagado**, no rojo. Durante el modo bola-chica NO se emiten números de pérdida (ese modo no resta).

**Los premios NO tienen forma propia:** la estrella y la moneda son el TARGET
NORMAL (retícula 5×4, ojos) que cambia de COLOR (dorado / verde). Los distingue
el color, no la silueta. La cara del target NO cambia (mismos ojos, sin cejas).

La cara del target NO cambia entre normal y enojado (mismos ojos, sin cejas): la señal es el color, no la forma. Esto evita cortar la silueta sobre fondo oscuro.

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
