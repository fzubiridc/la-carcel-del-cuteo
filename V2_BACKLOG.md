# Backlog v2 — triaje de notas del usuario (11-jun-2026)

## ✅ Resueltas u obsoletas (eran de la era del diseñador v1)

- ~~Ojos del personaje poco visibles~~ → muerto con el pipeline PixelLab.
- ~~Brazo largo / sale de adelante / ponerlo atrás~~ → ídem (ya no hay brazo-componente).
- ~~Arma estirada en reposo~~ → resuelto en v1 por código; irrelevante en v2.
- ~~Slash adelante del cuerpo / slash con el largo del filo / formas de espada por tier~~ →
  el mago no tiene slash; si vuelve el guerrero, se diseña con el sistema v2 (poder como efecto).
- ~~Armas de otra clase no equipables~~ → v1 ya filtra drops por clase; v2 es mago-solo.
- ~~Aggro por sala / línea de vista~~ → implementado (sala hogar + persistencia 1.5s).
- ~~Si les pego deberían venir a buscarme~~ → **implementado 11-jun**: recibir daño = aggro.

## 🎮 Pendientes — IA de mobs ("mobs más inteligentes")

- [ ] **Wander**: que deambulen solos hasta detectarte (hoy están quietos sin aggro).
- [ ] **Verte un poco más de lejos** (ampliar la detección, afinar con la sala).
- [ ] **Leash**: si te alejás mucho de su zona de origen, vuelven/sueltan (hoy: 1.5s al salir de la sala — afinar si alcanza).
- [ ] **Pausas de ataque**: al atacar/disparar se quedan clavados un instante (anticipación + recovery — estándar del género).
- [ ] **¿Movimiento ortogonal?** — decisión de diseño pendiente (¿queremos feel grid-like?).

## 🎒 Pendientes — Inventario y UI

- [ ] Ordenar ítems en el inventario.
- [ ] Tirar ítems / arrastrar (drag & drop).
- [ ] **Mobile: no se puede abrir el inventario** (falta botón táctil de inventario).
- [ ] Mejorar la UI de las mejoras de nivel.
- [ ] "Volver para el mapa de atrás" — ACLARAR con el usuario qué significa.
- [ ] **HUD nuevo** (pedido para Claude Design, su cancha): orbes de vida/maná
  ornamentados + barra XP centrada abajo (referencia estilo Diablo aprobada
  como dirección). Fuentes: Cinzel/Marcellus (títulos), Inter/Noto Sans (texto).
- [ ] **Sistema de maná** (gameplay + HUD): recurso para el cast.

## 🔊 Pendientes — Audio

- [ ] **Bug móvil**: los sonidos chicos no suenan hasta tarde (¿desbloqueo de
  audio iOS post-gesto? ¿preload?). Investigar unlock + precarga en primer touch.
- [ ] Resto de asignaciones del asignador (`asignador.html` guarda el progreso).
- [ ] Posible recorte del cast (3.1s) si se embarra a cadencia 0.7s.

## 📖 Narrativa (ver LORE.md)

- [ ] Decidir protagonista: lore dice JOVEN mago; el sprite es el viejo.
  (¿El viejo = mentor? ¿Regenerar protagonista joven con PixelLab?)
- [ ] Renombrar zonas/pisos al universo de la torre (descenso desde la cima).
- [ ] Sembrar el doble sentido de "descenso" en textos del juego.

## 🎨 Arte (pipeline PixelLab)

- [ ] Regenerar enemigos y jefes (cohesión total; los packs de monstruos del
  rpg_sound_pack ya dan voces: mnstr/ogre/giant/shade).
- [ ] Tiles de zonas con create_topdown_tileset.
- [ ] Cuantización de paleta (opcional).
