# Cola de diseño — assets de Claude Design

Registro de qué se pidió, qué se integró y qué falta, para no perder nada
entre rondas. El agente de diseño es lo que más créditos consume → pedidos
one-shot, completos, y partidos solo cuando el volumen lo justifica.

## ✅ Entregado e integrado

- **Cuerpo base 48×48** (un solo héroe, paper-doll desnudo).
- **Animaciones del cuerpo** (rig por poses, `js/anim-rig.js` / ARIG):
  idle (2) · run (4) · attack (3) · hurt (2).
- **Armas: 6 tipos × 6 tiers** (sword, hammer, bow, crossbow, staff, wand)
  con grip pivot. Integradas en mano, apuntando al cursor.

### Arreglado por código (no diseño)
- Slash en arco real · disparo desde la punta del arma · glow de rareza
  (raras+ irradian color, épicas+ chispas).

## ✅ PEDIDO 1: "Gear & grip" — ENTREGADO E INTEGRADO

`assets/hero/` + `js/heropack.js`. Cuerpo + equipo paper-doll (helmet/chest/
boots/gloves/cloak/belt × 6 tiers) + brazo rotable que empuña + armas. El
equipo sigue la animación. Brazo subido 2px para no leerse desde el pecho.

- Pendiente menor: el juego solo tiene slots casco/coraza/botas → gloves,
  cloak y belt del pack todavía no se muestran (faltan slots en el juego).
- A juzgar en el juego: el hombro del brazo (si sigue leyéndose raro al subir,
  tweak chico del pivote al diseñador).

## 🎨 Pendiente — PEDIDO 2: "Inventory UI" (mandar después del 1)

- [ ] **Pantalla de inventario** paper-doll: muñeco central que se re-compone
  en vivo al equipar + grilla de mochila + panel de stats. Colores de rareza
  en bordes. Solo diseño visual; la lógica la cablea el código.

## 🎨 Pendiente — PEDIDO 3: "Weapon attack animations" (por arma a distancia/mágica)

Las armas hoy reusan el espadazo. Las a distancia/mágicas necesitan su propio
movimiento (DISEÑO, no código — animar el sprite del arma).

- [ ] **Arco (bow): "tira y suelte"** — reposo → cuerda tensada con flecha
  (windup) → soltar (la cuerda chasquea, la flecha se va). ~3 frames.
- [ ] **Ballesta**: cargar/montar → disparar.
- [ ] **Bastón y varita**: cargar (el orbe/gema de la punta brilla juntando
  energía) → lanzar (flash/release).
- Parametrizado sobre las draw functions por tier (un "draw/charge 0→1") para
  que ande en los 6 tiers, no 18 sprites a mano.

## 🔧 Code TODO (feel/gameplay — los hago yo, no diseño)

- [ ] **Arma relajada en reposo**: en idle, el brazo baja el arma al costado en
  vez de apuntar al cursor (el guerrero no estira la mano sin motivo).
- [ ] **Slash adelante del cuerpo**: el tajo debe leerse barriendo ADELANTE del
  personaje (radio fijo + lunge), no solo el largo brazo+espada. Clave cuando
  un mob está encima. (Propuesta en charla.)
- [ ] **Brazo por detrás (experimento)**: dibujar brazo+arma detrás del cuerpo
  para esconder la raíz y que no se lea desde el pecho. Probar si mejora.
- [ ] **Aggro por sala / línea de vista**: los mobs no persiguen hasta que
  entrás a su sala (o los ves). Hoy es por radio. (Room-based recomendado.)

## 🗂️ Para el REDISEÑO de un día (tocan el arte base — solo si rediseñamos todo)

- [ ] **Ojos del personaje** poco visibles (chicos/oscuros, y algunos cascos
  los tapan). Hacerlos más legibles / visera más alta.
- [ ] **Brazo-arma** se lee largo y su anatomía/raíz no es ideal en 360°. Un
  rediseño podría plantear brazo más corto o sistema distinto.

## 📓 Notas técnicas — PixelLab MCP (validado 2026-06-11, barra de boss)

**Receta para marcos de UI anchos (la que funcionó):**
- PixelLab solo genera canvas CUADRADOS. Para marcos anchos pedir:
  *"ULTRA WIDE HORIZONTAL frame... fills only the CENTER HORIZONTAL BAND of
  the canvas — TRANSPARENT ABOVE AND BELOW... wide rectangular hollow opening
  in the center... ornaments ONLY at the far LEFT and far RIGHT ends"*.
- El PNG sale con franjas transparentes arriba/abajo → SIEMPRE recortar al
  bounding box antes de usar (la franja rompe el 9-slice):
  `img.crop(img.getbbox())` con Pillow (venv efímero en `/tmp/pilenv`).
- Aplicar con `border-image: url(...) <sliceY> <sliceX> stretch` y un
  `border-width` que conserve la proporción de las esquinas del PNG
  (ej. PNG 254×64, esquinas 78×28 → border-width 13px 36px). Nunca estirar
  el PNG entero como background — quedó espantoso las dos veces que se probó.
- `image-rendering:pixelated` siempre.

**Layout aprobado de la barra de boss:** nombre del jefe FUERA del marco
(arriba), números de HP DENTRO de la barra roja, marco pegadito a la barra.
Ver `#bossbar`/`#bossframe` en `index.html` y `updateBossBar()` en `js/ui.js`.
Marcos por jefe en `assets/ui/boss_frame_<tipo>.png` (mapeo en `BOSS_FRAMES`).

**Quirks del MCP de PixelLab:**
- `create_character` puede clavarse en `pending` >10 min (y descuenta la
  generation igual, porque descuenta al procesar). Si pasa: `delete_character`
  y relanzar. La cola de objects suele andar aunque la de characters esté
  atascada.
- `create_1_direction_object` completa en 1-3 min y es lo más confiable.
  Con size ≤170 devuelve 4+ candidatos en `review` (~25 gen); con 256
  devuelve 1 (~20 gen).
- El progreso `creating (14% ~408s)` es plantilla, no real.

**Verificación de UI sin screenshots manuales:** MCP Playwright →
navigate `localhost:8000` → click clase → click `#debugboss` (salta a la sala
del jefe) → screenshot de `#bossbar`.

## 🕓 Diferido (más adelante, pedido aparte)

- [ ] **Efectos de armas/poderes** como sprite sheets (estela del tajo,
  explosión del bastón, rayo, etc.). Hoy resueltos por código y quedan bien;
  solo si queremos subirlos de nivel. Cada uno con sus specs de mecánica
  (radio de área, perforación...). OJO: esto es el EFECTO (proyectil/explosión),
  distinto del movimiento del arma del Pedido 3.
