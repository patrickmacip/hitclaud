# hitclaud — Diseño UI

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#121216` | Fondo general |
| `--superficie` | `#15151C` | Superficies elevadas (botón pausa) |
| `--coral` | `#E8704E` | Acento principal, targets, hitmaker |
| `--coral-vivo` | `#FF8764` | Score actual, anillo del hitmaker |
| `--crema` | `#FFD9CE` | Reservado (destellos / énfasis) |
| `--indigo` | `#5C5CC8` | (reservado) |
| `--indigo-vivo` | `#7C7CFF` | (reservado) |
| `--azul` | `#1F55C9` | **Castigo** (antes morado): enojado, hitball chica (debuff), barra de debuff. Contraste 2.85:1 |
| `--dorado` | `#FFC300` | Estrella (fiesta) / multiplicador. Contraste 11.62:1 |
| `--cian` | `#22D3EE` | Moneda (power-up). Contraste ~10.5:1 |
| `--disperso` | `#6FFF2C` | Bolitas de dispersión de la moneda (verde). Contraste 14.25:1 |
| `--amenaza` | `#08080E` | CloudOver: masa oscura |
| `--cloudover-a` | `#B1003B` | CloudOver parpadeo A. Contraste 2.61:1 |
| `--cloudover-b` | `#FF0055` | CloudOver parpadeo B. Contraste 4.79:1 |
| `--coral-vivo` | `#FF8764` | Hitball del jugador (modo normal) + score Actual. Contraste 7.92:1 |
| `--texto-apagado` | `#8989B1` | Etiquetas secundarias |
| `--texto-apagado-fuerte` | `#B9B9DC` | Números secundarios |
| `--negro` | `#000` | Ojos del target |

## Idioma del color — regla del sistema

**El COLOR señala peligro; la LUZ (brillo/pulso/glow) señala recompensa.**

- **coral** = target normal (lo que puntúa).
- **--azul** `#1F55C9` = **CASTIGO** (renombrado de morado): target enojado, hitball chica (debuff), barra de debuff. Ojos negros intactos.
- **--coral-vivo** = la hitball del jugador (modo normal) — naranja vivo, NO el coral del target (para no camuflar la munición).
- **--dorado** = estrella / fiesta / multiplicador.
- **--cian** = moneda / power-up.
- **--disperso** `#6FFF2C` = verde de las bolitas de dispersión de la moneda.
- **--amenaza + --cloudover-a/b** = CloudOver (game over): masa oscura que PARPADEA entre dos rojos (#B1003B ↔ #FF0055), **SIN brillo** → peligro, no premio. Se distingue: es la única DARK con parpadeo rojo; estrella/moneda brillan (dorado/cian), enojado es azul mate.

**Los premios NO tienen forma propia:** la estrella y la moneda son el TARGET NORMAL (retícula 5×4, ojos) que BRILLA. Los distingue el COLOR del brillo (dorado vs cian), no la silueta. Eje de lectura a 40px en movimiento: **mate vs brillo** + matiz — normal (coral mate), enojado (morado mate), estrella (coral + glow dorado + parpadeo), moneda (coral + glow cian + parpadeo). La **luz** (halo/glow/parpadeo) sigue significando recompensa.

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
