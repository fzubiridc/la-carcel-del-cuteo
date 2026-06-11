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

- [x] **Wander** (11-jun): deambulan cerca de su origen sin aggro (caminan/pausan al azar, radio `BALANCE.wanderHome`).
- [x] **Verte un poco más de lejos** (11-jun): detección 4 → 5.5 tiles (`BALANCE.aggroRadius`).
- [x] **Leash** (11-jun): a más de 11 tiles de su origen sueltan y vuelven en escalera; si quedan encerrados, adoptan el lugar como nuevo hogar.
- [x] **Pausas de ataque** (11-jun): recovery 0.45s tras golpe de contacto; shooters telegrafian 0.3s (anillo naranja) antes de disparar al ángulo congelado + 0.35s de recovery. Jefes exentos.
- [x] **Movimiento ortogonal SOLO de mobs** (decidido 11-jun): chasers persiguen en escalera, no en diagonal recta.

## 🏰 Pisos con memoria (decidido 11-jun)

- [x] **Backtracking**: se puede volver a pisos anteriores por la escalera de
  subida. Los pisos quedan COMO LOS DEJASTE: mobs muertos siguen muertos,
  cofres abiertos siguen abiertos. Casos de uso: llave olvidada, quests
  futuras, volver a buscar algo.

## 🎒 Pendientes — Inventario y UI

- [ ] Ordenar ítems en el inventario.
- [ ] Tirar ítems / arrastrar (drag & drop).
- [ ] **Mobile: no se puede abrir el inventario** (falta botón táctil de inventario).
- [ ] Mejorar la UI de las mejoras de nivel.
- [ ] **HUD nuevo** (pedido para Claude Design, su cancha): pixel art con
  marcos de piedra/madera — vida con textura de lava (abajo-izq), recurso azul
  místico (abajo-der), XP tipo cadena (centro-abajo), runas de buff circulares.
  Fuentes: Cinzel/Marcellus (títulos), Inter/Noto Sans (texto).
  **REGLA DEL PEDIDO (definida por el usuario, 11-jun): cada elemento se pide
  POR SEPARADO y en CAPAS** — por cada barra: (1) el marco/cápsula vacío con
  la ventana transparente, (2) la textura de relleno al 100% (lava / azul
  místico / cadena) que el motor recorta al porcentaje actual, (3) opcional
  el fondo "vacío" de la ranura. Así el llenado/vaciado es dinámico y hasta
  animable (desplazar la textura de lava = efecto de líquido vivo). Las runas
  de buff como iconos individuales 32×32. Mismo patrón que la barra de jefes
  ya implementada (marco 9-slice + fill aparte).
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
