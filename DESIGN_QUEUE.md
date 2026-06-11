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

## 🕓 Diferido (más adelante, pedido aparte)

- [ ] **Efectos de armas/poderes** como sprite sheets (estela del tajo,
  explosión del bastón, rayo, etc.). Hoy resueltos por código y quedan bien;
  solo si queremos subirlos de nivel. Cada uno con sus specs de mecánica
  (radio de área, perforación...). OJO: esto es el EFECTO (proyectil/explosión),
  distinto del movimiento del arma del Pedido 3.
