# Pedido al diseñador — Inventario · La Cárcel del Cuteo (iteración 2)

Iteración **a partir del diseño actual** (mago ilustrado + octágonos + grilla).
**El estilo está aprobado: NO cambiar la dirección visual ni el mago.**

**Entrega clave: PIEZAS POR SEPARADO, no un panel armado.** El motor compone el
layout (igual que el HUD): los slots se repiten N veces, el marco se estira, el
mago va aparte. Así el inventario es responsive y puedo cambiar cantidades sin
volver a pedir. Mismo espíritu de capas que el HUD ya integrado.

---

## PIEZAS PEDIDAS (pegar al agente de diseño)

> Me encanta el estilo, mantenelo igual (mago ilustrado púrpura/dorado, paleta oro
> + piedra, círculo rúnico, marcos con runas). Pero en vez de un panel armado,
> necesito las **piezas por separado** para componer el inventario por código.
> Cada una en su archivo, **PNG con fondo transparente (alpha)**, y como es UI
> ilustrada (no pixel art) **a alta resolución (~2×, retina)**:
>
> **1) Mago + plataforma** (`inv_hero.png`) — el hechicero ilustrado parado sobre
> el círculo rúnico, tal como está ahora. Una sola imagen, centrada, fondo
> transparente. Es la figura fija del centro.
>
> **2) Marco ornamentado 9-slice** (`inv_frame.png`) — el borde con la esquina de
> runas, pensado para **9-slice** (4 esquinas + 4 lados tileables, centro
> transparente) para que yo lo estire y envuelva áreas de cualquier tamaño.
> Indicá el `slice` (px de las esquinas). Si preferís, entregá las esquinas y
> lados como piezas sueltas.
>
> **3) Slot de equipo** (`slot_octagon.png`) — el octágono dorado vacío, una sola
> pieza. La voy a repetir 10 veces. Centro transparente (ahí dibujo el ítem).
>
> **4) Slot de mochila** (`slot_square.png`) — el cuadrado dorado vacío, una pieza.
> La repito 24 veces para la grilla.
>
> **5) Slot redondo** (`slot_round.png`) — la cápsula redonda vacía, una pieza.
> **SIN el número "1"**, sin contenido. La repito 5 veces.
>
> **Opcional pero útil — estado resaltado:** si podés, una variante "resaltada"
> de cada slot (borde con glow/brillo dorado más intenso) para marcar hover o el
> ítem equipado: `slot_octagon_hl.png`, `slot_square_hl.png`. Mismo tamaño exacto
> que su versión normal, para superponer.
>
> ### Importante
> - Todas las piezas de slot del **mismo tipo a tamaño idéntico** y con el **área
>   interior centrada** (ahí va el ícono del ítem), para que todo alinee al
>   repetirlas.
> - Fondo transparente real; la sombra/relieve va dentro de la pieza.
> - Alta resolución (2×): el motor escala hacia abajo según la pantalla.

---

## Notas de integración (para Claude, al recibir el bundle)

- Layout lo arma el motor (no hay coords del diseñador): octágonos alrededor del
  mago (5 por lado), grilla 6×4 de mochila, fila de 5 redondos abajo.
- Mapeo equipo (10): izq = casco/amuleto/manto/guantes/cinturón ·
  der = bastón/foco arcano/anillo/anillo2/botas. Los 4 nuevos (foco, guantes,
  cinturón, 2º anillo) → nuevas bases en `SLOTS`/`ARMOR_BASES` + arte + balance
  (data-driven; sin drops hasta agregarlos).
- Mochila 12 → 24 (`BALANCE.bagSize`). Quick (5 redondos): vacíos/decorativos por
  ahora (hotbar de consumibles a futuro; la poción sigue en Q).
- Reemplaza `renderInv`/`#inv` en ui.js. El ítem se dibuja en el centro
  transparente de cada slot; el marco 9-slice envuelve cada zona.
- Mago ilustrado y fijo (sin paperdoll real: el equipo se ve en los slots, no
  encima del personaje) — coherente con v2.
