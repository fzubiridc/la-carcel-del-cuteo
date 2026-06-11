# Pedido al diseñador — Inventario · La Cárcel del Cuteo (iteración 2)

Iteración **a partir del diseño actual** (mago ilustrado + octágonos + grilla).
**El estilo está aprobado: NO cambiar la dirección visual ni el mago.** Solo los
ajustes de abajo. Entrega: **panel compuesto + mapa de coordenadas** (ver final).

---

## CAMBIOS PEDIDOS (pegar al agente de diseño)

> Me encanta cómo quedó. Mantené el estilo tal cual (mago ilustrado, paleta oro +
> piedra, círculo rúnico, marco con runas). Necesito estos ajustes:
>
> **1) Slots de equipo: exactamente 10 octágonos** (5 a cada lado del mago),
> distribuidos parejos y alineados. Quedan **vacíos** (sin íconos), pero esta es la
> intención de cada posición para que estén bien distribuidos:
> - Lado izquierdo (de arriba a abajo): Casco · Amuleto · Manto/Túnica · Guantes · Cinturón
> - Lado derecho (de arriba a abajo): Bastón (arma) · Foco arcano · Anillo · Anillo · Botas
>
> **2) Los 5 slots redondos de abajo: dejalos VACÍOS** — sacá el número "1", sin
> contenido ni símbolo. Solo la cápsula redonda vacía, lista para usar después.
>
> **3) Mochila: reducí la grilla de 48 a 24 slots (6 columnas × 4 filas).** Mismo
> estilo de slot cuadrado y mismo marco con runas, solo más compacta en alto.
>
> **4) Todo lo demás igual:** el mago centrado sobre el círculo rúnico, los marcos
> dorados, la esquina ornamentada con runas. No toques la ilustración del mago.
>
> ### Entrega (importante para integrarlo al juego)
> - **Un panel compuesto** (PNG) con TODO el chrome: marco, mago, los 10 octágonos
>   vacíos, los 5 redondos vacíos y la grilla 6×4 vacía. **Fondo transparente**
>   (alpha) fuera del panel — el juego pone su propio oscurecido detrás.
> - **Alta resolución (es UI ilustrada, NO pixel art): entregá a ~2× (retina).**
>   P.ej. panel a ~2000 px de ancho; el motor lo escala. (Acá sí va resolución
>   alta, al revés que los assets pixel del HUD.)
> - **Mapa de coordenadas**: una lista (o JSON) con la posición y tamaño **en px
>   sobre el canvas del panel** de cada slot, así puedo dibujar los ítems encima:
>   - los 10 octágonos de equipo (en el orden de arriba),
>   - los 5 redondos,
>   - los 24 cuadrados de la mochila (orden lectura: izq→der, arriba→abajo).
>   Formato sugerido: `{ "equip": [[x,y,w,h], ...], "quick": [...], "bag": [...] }`.

---

## Notas de integración (para Claude, al recibir el bundle)

- Inventario actual en el juego: 6 slots equipo (`SLOTS` en data.js) + bolsa 12
  (`BALANCE.bagSize`). Esta iteración lo lleva a **10 equipo + 24 bolsa + 5 quick**.
- Los 4 slots de equipo nuevos (foco arcano, guantes, cinturón, 2º anillo) implican
  nuevas bases de ítem en `ARMOR_BASES`/`SLOTS` + arte de ítem + balance — se hace
  por código data-driven; arrancan sin drops hasta agregarlos.
- Quick (5 redondos): se dejan vacíos/decorativos por ahora (hotbar de consumibles
  a futuro). Hoy la poción sigue en tecla Q.
- Render: panel de fondo como `<img>`; los ítems se dibujan en `position:absolute`
  según el mapa de coords (escalado por el factor del panel). Reemplaza el `#inv`
  actual (`renderInv` en ui.js).
- El mago es ilustrado y fijo (look único, sin paperdoll real: el equipo se ve en
  los slots, no encima del personaje) — coherente con la decisión v2.
