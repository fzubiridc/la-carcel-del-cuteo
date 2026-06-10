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
- [x] 5. **Segunda fase de jefes**: al 50% de vida, enfurecen (+velocidad,
  patrones más rápidos). Bucle: tackles dobles. Visual: tinte rojo.
- [x] 6. **Salas especiales**: sala del tesoro cerrada con llave (la llave la
  tiene un enemigo aleatorio del piso) y altar de sacrificio (pagás 25% de
  vida máx., recibís un ítem raro+).
- [x] 7. **Meta-progresión**: récords en localStorage (mejor profundidad por
  clase, kills totales) mostrados en el menú.
- [x] 8. **Polish de audio**: sonido de pasos sutil, música ambiente procedural
  muy simple (drone + notas aleatorias de escala menor, volumen bajo).
- [x] 9. **Controles táctiles**: joystick virtual izquierdo + botón de ataque
  derecho, solo si se detecta touch. Para jugar en iPhone.
- [x] 10. **Pasada de balance**: jugar una run completa por clase vía preview,
  ajustar curvas (XP, daño de enemigos, drops) y anotar cambios.

## Segunda tanda (agregada por el agente, manteniendo el alcance sobrio)

- [ ] 11. **Segunda arma por clase**: martillo (lento, golpe en área) para
  guerrero, ballesta (perfora enemigos) para arquero, varita (rápida, débil)
  para mago. Aparecen como drops igual que las armas base.
- [ ] 12. **Pausa con resumen de run**: stats actuales, equipo, nivel, kills.
- [ ] 13. **Eventos de piso**: al generar, 15% de que el piso sea "oscuro"
  (visión reducida con viñeta) o "embrujado" (más élites, más loot). Anunciado
  al entrar.
- [ ] 14. **Pulido final**: favicon, animación sutil del título, pantalla de
  victoria con resumen completo de la run, y actualizar README.

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
- **5. Fase 2 de jefes** ✔ — Al 50%: +30% velocidad, patrones rotan en 2.3 s
  (antes 3.2), tinte rojo (sprites tintados con caché — de paso corregí el
  flash de daño que teñía el fondo). Bucle encadena segunda embestida si
  falla la primera. Verificado: spd 62→81.
- **6. Cofre dorado + altar** ✔ — Nota: lo implementé como "cofre cerrado con
  llave" en vez de "sala cerrada" (cirugía de mapa frágil de noche; mismo
  loop de juego). 55% de pisos: cofre dorado (2 ítems, uno raro+) cuya llave
  la porta un enemigo (brilla dorado). 45%: altar — 25% de vida por ítem
  raro+. Verificada la cadena completa llave→cofre y el altar (-33 HP).
- **7. Récords** ✔ — localStorage `cripta_records`: runs, kills, victorias
  globales + mejor piso y victorias por clase (en la card del menú, con 🏆).
  Verificado con 2 runs simuladas; datos de prueba limpiados después.
- **8. Audio** ✔ — Drone grave (55 Hz ×2 desafinados) que respira según el
  modo, notas sueltas de escala menor cada 3-7 s muy suaves, y pasos sutiles
  cada 0.28 s al caminar.
- **9. Táctil** ✔ — Joystick virtual analógico (zona izquierda) + botones
  ATK/DASH/⚗/E. Auto-apuntado al enemigo más cercano (radio 12 tiles). Solo
  aparece si el dispositivo es touch; verificada la lógica por simulación y
  el layout en viewport de iPhone. Falta probar en el iPhone real.
- **10. Balance** ✔ — Auditoría numérica en profundidades 1/5/9: matar un
  esqueleto cuesta 3/3/2 golpes con arma media de la profundidad (la escalera
  de materiales acompaña bien), daño recibido tardío 13-19 con defensa típica.
  Único ajuste: los corazones curan max(22, 15% de vida máx.) para que no
  queden ridículos con 180 hp.
