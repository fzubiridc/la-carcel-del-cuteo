# Brief para el agente de diseño — Staffs visibles sobre el mago

> Objetivo: lograr una **gama de staffs** (bastones) que se vean en el sprite del
> mago en el juego, intercambiables. Hoy el mago tiene la vara **incrustada** (un
> solo look fijo). Este documento explica cómo está armado el prota hoy y cuál es
> el problema real a resolver, para que el agente pueda diseñar la solución.

---

## 1. Cómo se dibuja el protagonista HOY (estado real, no el doc viejo)

El mago se renderiza con **`js/v2hero.js`** (función `drawV2Hero`). Datos reales:

| Cosa | Valor real en el juego |
|---|---|
| Frames | **120×120 px**, PNG fondo transparente |
| Direcciones | **8 nativas**: `south, south-east, east, north-east, north, north-west, west, south-west` (cada una es su propio archivo; NO se espeja en el motor) |
| Animaciones | `idle` (4 frames, 220ms) · `walk` (6 frames, 110ms) · `hurt` (4 frames, 65ms) |
| Efecto de tiro | `power` (4 frames, energyblast en vuelo) + `powerboom` (8 frames, explosión) |
| Escala en juego | `0.4` → el mago ocupa **~24 px de mundo** (se ve chico) |
| Anclaje | los **pies caen en la fila y=89** del frame; en el juego se apoyan en `p.y+5` |
| Mirada | hacia donde se mueve; al atacar, hacia donde apunta el cursor |

**Rutas de los frames:**
`assets/v2_test/mage/<anim>/<dir>_<frame>.png`
ej: `assets/v2_test/mage/walk/east_3.png`, `assets/v2_test/mage/idle/south_0.png`.

> ⚠️ El `DESIGN_V2_MAGE.md` describe un sistema **paper-doll** (cuerpo desnudo +
> capas de equipo/arma con manifest de mano por frame) y frames de 64px. **Eso
> NUNCA se implementó así.** Lo que está vivo en el juego es lo de la tabla de
> arriba: un mago "entero" de 120px, 8 dirs, **con la vara YA pintada adentro de
> cada frame**. No hay capa de arma separada ni puntos de anclaje de mano.

---

## 2. El problema real (por qué hoy no hay gama de staffs)

La vara está **fusionada al cuerpo** en los ~80 frames del mago (8 dirs × idle/
walk/hurt). Para tener staffs intercambiables hay que **sacar la vara del cuerpo**
y volverla una **capa propia** que se ancle a la mano del mago en cada dirección y
cada frame, con la profundidad correcta (la vara va **detrás** del cuerpo cuando
el mago mira al norte/espalda, y **adelante** cuando mira al sur/frente).

Eso es lo que hay que resolver. Es un problema de **layering + anclaje
multidireccional**, no de dibujar bonito una vara.

---

## 3. Lo que necesito que el agente entregue / decida

El catálogo de staffs ya está acordado en **`DESIGN_STAFFS.md`** (19 sprites:
1 neutral + Arcane/Fire/Ice × 6 tiers; la rareza NO cambia el sprite; cada staff
declara un `focusPoint` para anclar glow/partículas).

Para que ESO se vea sobre el mago, el agente tiene que elegir y producir UNA de
estas vías (ordenadas de mejor a peor escalabilidad):

### Vía A — Paper-doll real (la ideal, la que queremos)
1. **Regenerar el cuerpo del mago SIN vara** (mismas 8 dirs × idle/walk/hurt,
   120×120, mismo estilo y anclaje y=89), con la **mano dominante posada como
   empuñando** (no abierta, no colgando).
2. Entregar un **manifest de anclaje**: por cada `(dirección, anim, frame)`, el
   punto de la mano `[x,y]` (en coords del frame de 120px) y el **ángulo** de la
   vara, **y la capa** (si la vara va detrás o delante del cuerpo en esa dir).
3. Cada staff es **1 sprite** (los 19 de `DESIGN_STAFFS.md`) con su `grip [x,y]`
   (dónde la toma la mano) y `focusPoint [x,y]` (la gema, para el glow). El código
   la dibuja rotada y anclada al punto de mano.

→ Resultado: 19 sprites de staff + 1 cuerpo sin vara. Escala perfecto.
→ Riesgo: el anclaje por-frame en 8 dirs es laborioso; necesitamos el manifest
   bien hecho o las varas "bailan".

### Vía B — Mago entero por staff (NO recomendada)
Generar el mago completo empuñando cada staff (19 × 8 dirs × ~14 frames). Inviable
por cantidad de sprites.

### Vía C — Tier/elemento por efecto, no por sprite del mundo (fallback barato)
Dejar la vara base incrustada como está, y representar la familia/tier de la staff
**solo** en: el **efecto de casteo** (color/forma del energyblast por elemento),
el **ícono en inventario/UI**, y partículas en el `focusPoint`. El sprite del mago
en el mundo no cambia. Es lo que ya hacemos con la rareza (UI-only); esto lo
extiende a tier/elemento.

**Lo que de verdad quiero es la Vía A.** Necesito que el agente me diga si es
factible con la calidad/estilo actual y, si sí, que produzca el **cuerpo sin vara
+ el manifest de anclaje** primero (es el bloqueante); las 19 staffs vienen después.

---

## 4. Archivos a pasarle al agente

| Archivo | Para qué |
|---|---|
| `js/v2hero.js` | Cómo se dibuja el mago hoy (dirs, anims, escala 0.4, anclaje y=89). La fuente de verdad técnica. |
| `assets/v2_test/mage/idle/` · `walk/` · `hurt/` | Los frames REALES del mago (120×120, 8 dirs). Para ver el estilo y dónde está hoy la mano/vara. |
| `assets/v2_test/mage/power/` · `powerboom/` | El efecto de casteo actual (referencia para el efecto por elemento de la Vía C). |
| `DESIGN_STAFFS.md` | El catálogo acordado de staffs (familias, tiers, focusPoint, regla de rareza). |
| `DESIGN_V2_MAGE.md` | La visión original paper-doll (grip/focusPoint/manifest de mano por frame) — **referencia conceptual**, pero recordá que los números reales son los de la sección 1 de ESTE doc, no los 64px de ahí. |

> Nota de estilo del proyecto (importante para el pixel art): trabajar a
> **resolución nativa baja** y dar el factor de escala; el juego escala con
> `image-rendering: pixelated`. No pedir arte a 1920 — pedir 120×120 nativo.
