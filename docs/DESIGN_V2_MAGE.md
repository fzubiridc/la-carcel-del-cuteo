# PEDIDO MAESTRO — Héroe v2, slice vertical: MAGO

Documento completo de contexto + entregables. **La sección A se adjunta SIEMPRE**,
se pida lo que se pida — el diseñador tiene que diseñar cada pieza sabiendo
dónde encaja en el todo. Los módulos B–F se pueden encargar juntos o por tandas
(ver sección H, orden de producción).

---

## A. Contexto y sistema (adjuntar siempre)

**Juego:** action roguelike 2D top-down (estilo Hades/Dead Cells en chiquito),
pixel art, paleta medieval oscura. Frames de **64×64**, fondo transparente.
En el juego el sprite ocupa 24px de mundo (factor 0.375) — todo debe leerse
bien a ese tamaño. (Se subió de 48 a 64 para alcanzar la densidad de píxel
de la referencia de estilo.)

**Orientación — vista 3/4 lateral (corrección sobre v1):** la v1 era una pose
FRONTAL que solo se espejaba; se veía antinatural al moverse. En v2 el
personaje se dibuja en **perfil 3/4 mirando a la DERECHA** (el código espeja
para la izquierda): cabeza, torso y pies claramente orientados hacia donde
mira/avanza. Esto aplica a TODAS las animaciones (idle, run, hurt y casts) —
mezclar idle frontal con run de perfil canta mucho en la transición. El
movimiento vertical (arriba/abajo) mantiene el mismo perfil lateral, estándar
del género; variantes norte/sur quedan fuera de alcance.

**Sistema paper-doll:** hay UN cuerpo base desnudo compartido por todas las
clases. El equipo y las armas son capas separadas que se superponen siguiendo
los mismos frames del cuerpo. Las clases se diferencian por equipo y armas,
nunca por anatomía.

**Slots anatómicos lógicos (fijos para todas las clases):**
cabeza · torso · piernas · pies · manos · cinturón · capa
(+ anillo/amuleto, sin representación visual).

- Cada ítem ocupa UN slot lógico.
- El arte PUEDE desbordar su región anatómica: una túnica es slot *torso*
  pero su sprite cubre torso + piernas hasta los tobillos. Una camisa cubre
  solo el torso. El slot no cambia, la cobertura visual sí.
- Orden de capas fijo (atrás → adelante):
  **capa → cuerpo → pies → piernas → torso → cinturón → manos → cabeza.**
  Lo de adelante tapa lo de atrás (túnica sobre pantalón = pantalón tapado,
  correcto).

**Sistema de armas (lección aprendida de v1 — esto es lo más importante):**
los ataques son **animaciones de cuerpo completo**, NO un brazo suelto que
rota hacia el cursor. El cuerpo cuenta el golpe/cast: anticipación → torso y
pies participan → release → follow-through. El arma va en capa separada (para
intercambiar tiers) pero **anclada por keyframes**: cada frame de animación
declara dónde está la mano y en qué ángulo está el arma. El apuntado lo
resuelve el proyectil por código, no el brazo.

**Tiers vs rareza (no confundir):**
- **Tier (1–6) = arte.** Cada arma y pieza de equipo tiene 6 versiones de
  estética CRECIENTE: cuanto mejor el tier, más elaborada la silueta, más
  ornamento, más detalles "legendarios" (gemas, runas, bordes dorados,
  brillos sutiles horneados en el pixel art).
- **Rareza = código.** Los glows pulsantes, partículas y tintes de rareza los
  agrega el motor. El diseñador hornea brillo sutil estático; el motor anima.
- Para que el código pueda anclar glow y partículas, cada arma declara su
  **focusPoint** (gema del staff, punta de la wand, centro del libro).

**Correcciones obligatorias sobre la v1:**
- Ojos legibles pero proporcionados: ~2px de alto con párpado/ceja de 1px
  (v1 los tenía chicos/oscuros; NO sobrecorregir a globos blancos gigantes).
- Anatomía completa SIEMPRE: dos brazos (en 3/4 el trasero asoma detrás del
  torso), boca, mentón/pera definidos. Brazos de proporción correcta.
- Silueta limpia y leíble a 50%.

**Estilo de render (aplica a todo: cuerpo, armas, equipo):**
- Rampas de 3-4 tonos por material (sombra/base/luz, no color chato de 2 tonos).
- Sombreado con volumen: fuente de luz arriba-izquierda consistente en todas
  las piezas.
- Outline oscuro modulado con tinte del color local (no negro #000 parejo en
  toda la silueta).
- Dithering sutil solo donde aporta textura (telas, madera); nunca en la cara.
- La vara de calidad es la referencia de estilo adjunta (mago con sombrero):
  imitar su RENDER (volumen, rampas, outline) — NO su diseño de personaje
  (nada de viejo/barba: nuestro mago es adulto joven; el look "vestido" sale
  del equipo en capas, no del cuerpo base).

**Referencias adjuntas (cómo usarlas):**
- Captura de gameplay → referencia de AMBIENTE: paleta, atmósfera y escala
  del personaje en la escena. NO es referencia del estilo del héroe.
- Sheet del pack "boss rugby" (si se adjunta) → referencia de CALIDAD y
  FORMATO de entrega (strips + timings). NO copiar su anatomía ni estilo.
- No hay imagen del héroe v1 a propósito: el héroe se diseña de cero según
  este documento.

**FUERA DE ALCANCE — no producir NADA que no esté listado en los módulos B–E:**
- NO interfaz: ni inventario, ni HUD, ni menús, ni pantallas, ni mockups.
- NO escenarios: ni tiles, ni mapas, ni fondos, ni escenas de contexto
  "para mostrar el personaje en ambiente".
- NO enemigos, NO NPCs, NO otras clases (warrior/ranger vienen en pedidos
  futuros sobre esta misma base).
- NO iconos de ítems, NO efectos de hechizos (módulo F, diferido).
- NO variantes extra "de regalo" (poses adicionales, direcciones norte/sur,
  expresiones). Cada frame de más es costo sin destino.
- Si algo parece faltar para completar un entregable, PREGUNTAR antes de
  producirlo.

---

## B. Módulo 1 — Cuerpo base (paper doll desnudo)

Strips horizontales PNG, un frame de 64×64 por columna. Cuerpo en ropa
interior neutra. **Manos:** la mano dominante es la del FRENTE (la más
cercana a cámara) y va en puño relajado en idle/run/hurt — ahí se ancla el
arma, así que tiene que leerse como empuñando, no abierta ni colgando.

1. **idle** — 2 frames, respiración sutil, en el mismo perfil 3/4 que el run
   (NO frontal — ver sección A, Orientación).
2. **run** — 4 frames, ciclo de perfil 3/4: el cuerpo avanza claramente hacia
   la derecha, con inclinación leve del torso en la dirección del movimiento.
3. **hurt** — 2 frames, recoil.

(Las animaciones de cast del módulo D también son strips del CUERPO — el
cuerpo es uno solo y el equipo lo sigue frame a frame.)

---

## C. Módulo 2 — Armas del mago: 3 familias × 6 tiers

Tres familias nuevas, cada una con identidad mecánica y visual propia.
Sprites "punta arriba" con grip pivot declarado, tamaño según familia.
**La estética escala con el tier** — ejemplos orientativos, el diseñador
propone:

**STAFF (bastón, dos manos, ~18×44):** proyectil cargado con área.
- T1 palo torcido de aprendiz → T3 bastón tallado con cristal engarzado →
  T6 báculo ancestral: gema flotante sobre la horquilla, runas a lo largo
  del asta, brillo horneado.

**BOOK (libro/grimorio, una mano abierta en la palma, ~20×18):** canaliza
sigilos / ráfagas.
- T1 cuaderno gastado de tapas de cuero → T3 tomo con broche de metal y
  esquinas reforzadas → T6 grimorio legendario: tapas ornamentadas con borde
  dorado, gema central, páginas con runas brillantes (el "flotar" de páginas
  lo puede animar el motor si el libro entrega 2 frames: cerrado/abierto).

**WAND (varita, una mano, ~11×28):** casts rápidos y débiles.
- T1 ramita pelada → T3 varita torneada con punta de cristal → T6 varita
  legendaria: espiral de metal precioso, punta de gema multifacetada, motas
  de brillo horneadas.

Por cada arma: **grip [x,y]** (dónde la agarra la mano) y **focusPoint [x,y]**
(de dónde sale el proyectil / dónde ancla el glow).

---

## D. Módulo 3 — Animaciones de cast (cuerpo completo, una por familia)

Tres animaciones del CUERPO (strips como el módulo B), cada una con
personalidad mecánica distinta. El arma NO se dibuja en estos frames — se
ancla por manifest (mano + ángulo por frame) — pero las manos SÍ se dibujan
POSADAS para empuñarla: en cast_staff las dos manos toman el asta (es a dos
manos), en cast_book una palma sostiene y la libre lanza.

1. **cast_staff** — 5 frames: plantar el bastón / cargar (2 frames, el cuerpo
   se recoge, energía juntándose) → release (1 frame, paso al frente, bastón
   proyectado adelante) → follow-through (2 frames).
2. **cast_book** — 4 frames: abrir el libro en la palma → mano libre traza el
   sigilo adelante → release → recover. El libro queda sostenido, la mano
   libre es la que "lanza".
3. **cast_wand** — 3 frames: flick rápido de muñeca con medio paso —
   anticipación corta, release, recover. Debe leerse ágil (la wand es el
   arma rápida).

---

## E. Módulo 4 — Set de equipo del mago (slots × 6 tiers)

Capas paper-doll que siguen TODOS los frames del cuerpo (idle + run + hurt +
los 3 casts). Mismo criterio de estética creciente por tier que las armas.

Set del mago (slot lógico → pieza):
- **cabeza** → capucha / sombrero de mago (que NO tape los ojos — lección v1).
- **torso** → túnica (desborda sobre piernas hasta los tobillos, ver sección A).
- **piernas** → pantalón simple (casi siempre tapado por la túnica; existe
  para que el sistema de slots sea uniforme entre clases).
- **pies** → botas/sandalias (pueden asomar bajo la túnica).
- **manos** → guantes.
- **cinturón** → faja/cordón con bolsitas de componentes.
- **capa** → capa (se dibuja DETRÁS del cuerpo).

---

## F. Módulo 5 (diferido — pedido aparte, NO producir aún)

Efectos de los casts como sprite sheets: proyectil del staff + explosión de
área, sigilo del book, chispa de la wand. Hoy el motor los resuelve por
código y quedan dignos; este módulo es para subirlos de nivel después de que
el resto esté integrado.

---

## G. Manifest y formato de entrega (obligatorio)

Un `manifest.json` que acompañe el pack. Sin esto no se puede integrar:

```json
{
  "anims": {
    "idle":       { "frames": 2, "dur": [620, 620], "loop": true,
                    "hand": [["x","y"], ["x","y"]] },
    "run":        { "frames": 4, "dur": [110, 110, 110, 110], "loop": true,
                    "hand": ["… por frame"] },
    "hurt":       { "frames": 2, "dur": [90, 170], "hand": ["… por frame"] },
    "cast_staff": { "frames": 5, "dur": ["…"],
                    "hand": [["x","y"], "… por frame"],
                    "weaponAngle": ["grados por frame, 0 = punta arriba"],
                    "releaseFrame": 2 },
    "cast_book":  { "…": "igual estructura" },
    "cast_wand":  { "…": "igual estructura" }
  },
  "weapons": {
    "staff_t1": { "grip": ["x","y"], "focusPoint": ["x","y"],
                  "carryAngle": "grados en reposo/run (0 = punta arriba)" },
    "…": "una entrada por arma × tier"
  },
  "layerOrder": ["cloak","body","boots","legs","torso","belt","gloves","head"]
}
```

- **Coordenadas:** todos los pivots (`hand`, `grip`, `focusPoint`) en píxeles
  dentro del frame 64×64 (o del sprite del arma), origen arriba-izquierda.
  Índices de frame desde 0.
- **Línea de piso constante:** los pies apoyan en y≈61 en TODOS los frames de
  TODAS las animaciones — el motor ancla bottom-center; si la línea varía
  entre anims, el personaje "rebota" al cambiar de animación.
- `releaseFrame`: en qué frame sale el proyectil (el código lo sincroniza).
- **`hand` es obligatorio en TODAS las animaciones** (no solo en los casts):
  el arma se ancla a la mano también al caminar, en idle y al recibir daño.
  `hand` es SIEMPRE la mano del ARMA — en el book, la que sostiene el libro,
  no la que lanza el sigilo.
  Cada familia declara su `carryAngle` (cómo se lleva en reposo: el staff
  casi vertical, el book abierto en la palma, la wand baja al costado);
  durante el cast, el `weaponAngle` por frame manda.
- Strips horizontales PNG, 64×64 por frame, nombres predecibles:
  `body_idle.png`, `equip/mage/torso_t3.png`, `weapons/staff_t5.png`, etc.

---

## H. Orden de producción sugerido (validar antes de producir volumen)

El documento completo (sección A incluida) se entrega siempre. Los
entregables, en tandas — **cada tanda se aprueba antes de encargar la
siguiente**, y nada se produce en volumen sobre algo no aprobado:

0. **Tanda 0 — aprobación de LOOK (solo frames estáticos, sin animar):**
   1 frame del cuerpo en pose idle 3/4 + staff T1 y T6 como sprites sueltos
   + **1 mockup compuesto** (el cuerpo con capucha + túnica + staff T6
   puestos) en un solo frame. El mockup es SOLO para juzgar el look final —
   no es un asset del juego ni reemplaza las capas separadas, que se
   entregan en sus tandas. Acá se juzga: ojos, proporciones, estilo de
   render, el rango estético de los tiers, y que el composite "se vea mago".
   Se itera sobre estos dibujos hasta aprobar. NO animar nada todavía.
1. **Tanda 1 — valida el sistema (sobre el look aprobado):** Módulo B
   completo (idle/run/hurt animados) + cast_staff + manifest de todo lo
   entregado. Acá se juzga: que el movimiento se sienta bien y que los
   pivots integren limpio en el motor.
2. **Tanda 2:** staffs T2–T5 + cast_book + cast_wand + books y wands ×6.
3. **Tanda 3:** Módulo E (equipo) — es la tanda más voluminosa
   (7 piezas × 6 tiers × 20 frames), por eso va última, cuando el cuerpo
   y sus animaciones ya están congelados.
4. **Tanda 4 (algún día):** Módulo F.

No partir más fino que esto: cada ida y vuelta con el diseñador tiene costo
fijo, y por debajo de este tamaño el overhead supera lo que se ahorra.

**Regla de oro:** ningún frame del cuerpo se retoca después de la Tanda 1
aprobada — el equipo de la Tanda 3 depende de que esos frames estén
congelados.
