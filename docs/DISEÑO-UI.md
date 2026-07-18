# hitclaud — Diseño UI

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#121216` | Fondo general |
| `--superficie` | `#15151C` | Superficies elevadas (botón pausa) |
| `--coral` | `#E8704E` | Acento principal, targets, hitmaker |
| `--coral-vivo` | `#FF8764` | Score actual, anillo del hitmaker |
| `--crema` | `#FFD9CE` | Reservado (destellos / énfasis) |
| `--indigo` | `#5C5CC8` | Bolita del jugador |
| `--indigo-vivo` | `#7C7CFF` | Borde de la bolita |
| `--morado` | `#8B5CF6` | Castigo: enojado, hitball bajo debuff, barra de debuff |
| `--dorado` | `#FBBF24` | Brillo de la estrella (fiesta). Contraste ~11:1 sobre `--bg` |
| `--cian` | `#22D3EE` | Brillo de la moneda (power-up). Contraste ~10.5:1 sobre `--bg` |
| `--amenaza` | `#08080E` | CloudOver: masa oscura (más negra que el fondo) |
| `--rojo-brasa` | `#EF4444` | Latido interno del CloudOver (rojo, NO el morado del castigo) |
| `--texto-apagado` | `#8989B1` | Etiquetas secundarias |
| `--texto-apagado-fuerte` | `#B9B9DC` | Números secundarios |
| `--negro` | `#000` | Ojos del target |

## Idioma del color — regla del sistema

**El COLOR señala peligro; la LUZ (brillo/pulso/glow) señala recompensa.**

- **coral** = target normal (lo que puntúa).
- **--morado** = castigo: target enojado, hitball en modo chico (debuff), barra de debuff radiante.
- **índigo** = la hitball del jugador.
- **--dorado** = estrella / fiesta.
- **--cian** = moneda / power-up.
- **--amenaza + --rojo-brasa** = CloudOver (game over): masa oscura con latido rojo, **SIN brillo** → peligro, no premio. A 40px se distingue inequívocamente: es la única DARK con rojo pulsante; estrella/moneda brillan (dorado/cian), enojado es morado mate, normal coral mate.

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
