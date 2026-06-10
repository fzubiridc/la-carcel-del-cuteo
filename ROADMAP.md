# Roadmap nocturno — Cripta Olvidada

Plan de trabajo autónomo. Reglas para el agente:

1. **Una feature por vez**, en orden de prioridad. Verificar en el navegador
   (server "cripta", puerto 8417) antes de commitear. Un commit por feature.
2. **No romper lo que funciona**: si una feature queda a medias o inestable,
   revertirla y anotar el problema acá abajo en "Notas de la noche".
3. **Respetar la arquitectura**: contenido nuevo va en `js/data.js`,
   comportamientos reutilizables, nada hardcodeado en el motor.
4. **Balance conservador**: ante la duda, números suaves (se ajustan jugando).
5. Al final de cada feature, marcar el checkbox y anotar una línea de resumen.

## Prioridades

- [x] 1. **Mercader entre zonas**: piso especial (o rincón del piso de jefe ya
  vencido) con 3 ítems a la venta generados según profundidad + 1 poción.
  Precios en monedas. UI simple al acercarse y apretar E.
- [x] 2. **Dash/esquive con Espacio**: impulso corto en la dirección de
  movimiento, ~0.15 s, invulnerable durante el dash, cooldown ~1.2 s visible
  en el HUD. Debe permitir esquivar el tackle de Bucle.
- [x] 3. **Consumibles**: poción de vida (cura 40%) con slot rápido (Q),
  máx. 3. Drop raro de enemigos + venta en mercader.
- [x] 4. **Enemigos élite**: ~8% de spawns son élite (aura de color, +100% vida,
  +50% daño, drop garantizado de ítem y más XP).
- [ ] 5. **Segunda fase de jefes**: al 50% de vida, enfurecen (+velocidad,
  patrones más rápidos). Bucle: tackles dobles. Visual: tinte rojo.
- [ ] 6. **Salas especiales**: sala del tesoro cerrada con llave (la llave la
  tiene un enemigo aleatorio del piso) y altar de sacrificio (pagás 25% de
  vida máx., recibís un ítem raro+).
- [ ] 7. **Meta-progresión**: récords en localStorage (mejor profundidad por
  clase, kills totales) mostrados en el menú.
- [ ] 8. **Polish de audio**: sonido de pasos sutil, música ambiente procedural
  muy simple (drone + notas aleatorias de escala menor, volumen bajo).
- [ ] 9. **Controles táctiles**: joystick virtual izquierdo + botón de ataque
  derecho, solo si se detecta touch. Para jugar en iPhone.
- [ ] 10. **Pasada de balance**: jugar una run completa por clase vía preview,
  ajustar curvas (XP, daño de enemigos, drops) y anotar cambios.

## Notas de la noche

- **1. Mercader** ✔ — Aparece junto a la escalera al matar un jefe (no en el
  último). 3 ítems con precio según su puntaje + curación (+60%) por 30
  monedas. Verificado: compra descuenta monedas, marca VENDIDO, va a la bolsa.
- **2. Dash** ✔ — Espacio, 330 px/s × 0.16 s (~53 px), invulnerable durante el
  impulso, cooldown 1.2 s con barra en el HUD, estela fantasma. Si estás
  quieto, esquiva hacia el ratón.
- **3. Pociones** ✔ — Q cura 40% (verificado 50→102 con 130 máx). Máx 3,
  arrancás con 1, drop 4%, el mercader vende a 30 (reemplaza la curación
  instantánea). Contador en el HUD.
- **4. Élites** ✔ — 8% de spawns: ×2.2 vida, ×1.5 daño, escala 1.2, aura
  dorada pulsante. Drop garantizado: ítem + 4 orbes XP extra (valor 4) + 3
  monedas.
