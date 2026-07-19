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

**El MODO tiñe TODA la pantalla.** Al entrar a un modo (golpear un especial),
**todo** se tiñe con la paleta del modo — targets (normales Y especiales),
hitball, hitmaker, marcador, récord, toda la UI y el texto. Lo **ÚNICO** que NO
cambia: el **FONDO** `#121216` y la **SUPERFICIE** de la barra `#15151C` (si se
tiñeran, el juego sería ilegible). Los modos **NO se suman: se REEMPLAZAN** (entrar
a uno nuevo cambia todo de golpe). Precedencia: **castigo > bonanza > power-up > normal**.

### Paletas de modo (4 roles)

Cada modo es una **familia armónica** de 4 tonos con roles:
- **base** — targets / cuerpo principal.
- **vivo** — hitball, acentos (más brillante/saturado).
- **claro** — récord y jerarquía secundaria de UI/texto (tono más claro).
- **profundo** — contraste dentro del modo (más oscuro; NUNCA el fondo/superficie).

| Modo | base | vivo | claro | profundo |
|---|---|---|---|---|
| **normal** (naranja) | `#E8704E` | `#FF8764` | `#FFC9B8` | `#A84A2E` |
| **bonanza** (dorado) | `#FFC300` | `#FFD84D` | `#FFEBA3` | `#B88C00` |
| **power-up** (verde) | `#6FFF2C` | `#9CFF6B` | `#CBFFAD` | `#3FA817` |
| **castigo** (azul) | `#1F55C9` | `#4E82F5` | `#AFC6F7` | `#143C8F` |

Contraste del **claro** (texto del récord) sobre `#121216`: normal 12.7 · bonanza
15.7 · power 16.4 · castigo 10.9 — legible en los 4. El **profundo** se usa como
tope oscuro del barrido de la barra de debuff (no como texto).

Enrutado por token (var CSS `--acento`/`-vivo`/`-claro`/`-profundo`, JS reescribe
las 4 por modo): hitball, hitmaker, marcador Actual, récord, etiquetas, ícono de
pausa, cuerpos de targets, cubos, flotantes de ganancia, badge ×N, amortiguador,
barras, flashes y botones de game-over. Transición **breve y suave** (CSS 0.25s;
el canvas cambia en el límite del modo).

### Distinción NORMAL vs ESPECIAL dentro del modo

Como todos los targets se tiñen del color del modo, los **especiales se
distinguen por su LUZ, no por su color** — conservan su halo/pulso/parpadeo en su
**matiz de firma** (se lee a 40px):

- **enojado** = halo **azul** pulsante (activa el modo bola-chica).
- **estrella (bonanza)** = halo **dorado** pulsante.
- **moneda (power-up)** = halo **verde** pulsante.
- **CloudOver** = su CUERPO PARPADEA entre dos rojos (`#B1003B` ↔ `#FF0055`) cada 100ms, **SIN brillo** → peligro. Único con parpadeo de cuerpo; no lleva halo.

El **aura/glow** de "estás en un modo" va en la **HITBALL** (estela + glow del tono
vivo), NO en los targets. Los ojos negros de todos los sprites NO cambian nunca.

**Pérdida = ROJO** `#FF0055` (el rojo claro del CloudOver): TODO lo que RESTA
puntos se ve rojo — el −N del fallo y el cobro de inactividad. El **"0"** de una
dispersa sin impacto NO es pérdida (no cuesta) → **--texto-apagado**. Durante el
modo bola-chica NO se emiten números de pérdida (ese modo no resta).

La cara del target NO cambia (mismos ojos, sin cejas): la señal es el color del
modo + la luz de firma, no la forma. Esto evita cortar la silueta sobre el fondo.

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
