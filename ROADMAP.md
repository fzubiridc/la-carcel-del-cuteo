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

- [ ] 1. **Mercader entre zonas**: piso especial (o rincón del piso de jefe ya
  vencido) con 3 ítems a la venta generados según profundidad + 1 poción.
  Precios en monedas. UI simple al acercarse y apretar E.
- [ ] 2. **Dash/esquive con Espacio**: impulso corto en la dirección de
  movimiento, ~0.15 s, invulnerable durante el dash, cooldown ~1.2 s visible
  en el HUD. Debe permitir esquivar el tackle de Bucle.
- [ ] 3. **Consumibles**: poción de vida (cura 40%) con slot rápido (Q),
  máx. 3. Drop raro de enemigos + venta en mercader.
- [ ] 4. **Enemigos élite**: ~8% de spawns son élite (aura de color, +100% vida,
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

(el agente escribe acá)
