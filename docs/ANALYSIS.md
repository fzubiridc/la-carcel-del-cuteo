# Análisis estructural — La Cárcel del Cuteo

> Nota: este análisis queda como referencia histórica. Algunas observaciones ya
> fueron resueltas o cambiaron (por ejemplo, persistencia de run y handlers de
> patrones de jefes). Para el mapa actual del código, ver `ARCHITECTURE.md`.

> Revisión de arquitectura del proyecto completo (junio 2026, ~5.800 líneas de JS,
> 13 archivos, sin build system). Foco: crítica honesta, fallas, riesgos de
> escalado y un plan de mejora priorizado.

## Resumen ejecutivo

El juego es sólido y muy jugable, con dos decisiones de diseño que están bien:
**arquitectura "todo es data"** (`ENEMIES`/`ITEMS`/`ZONES`) y un **pipeline de
proyectiles unificado** (jugador y enemigos por el mismo `fireProj`). El loop está
blindado contra excepciones y el render ya hace culling de tiles por viewport.

Pero el proyecto acumuló deuda en cinco frentes que van a frenar el escalado:

1. **9 motores de render en paralelo** (4 de ellos solo para el jugador), con lógica
   de facing/animación/tinte triplicada. `skeleton.js` y `slime.js` son casi el
   mismo motor duplicado.
2. **Los comportamientos están hardcodeados** (cadenas de `if` por tipo), sobre todo
   `updateBoss` (115 líneas) y flags de render que se filtran al combate. Agregar un
   *stat* es trivial; agregar un *comportamiento* obliga a tocar código.
3. **El balance es lineal** mientras el poder del jugador es multiplicativo → no
   escala a más pisos/zonas.
4. **La run no se persiste** (solo récords). En mobile, cerrar la pestaña pierde la
   partida — la falla funcional más grave.
5. **Versionado de assets caótico**: 7+ constantes de versión y varios cargadores
   sin `?v=` (bombas de caché que ya te mordieron una vez).

**Las 5 mejoras de mayor retorno** (detalle abajo): (P1) sistema de ataques
data-driven, (P2) unificar los motores de mob, (P3) persistir la run, (P4)
centralizar el versionado de assets, (P5) validar el mapa con flood-fill.

---

## Fortalezas (lo que NO hay que tocar)

- Diseño data-driven de enemigos/ítems/zonas; ítems con 3 ejes ortogonales
  (material × rareza × profundidad) — extensible y elegante.
- Proyectiles unificados (`fireProj`/`updateProjectiles`) con splash/pierce/range.
- IA con aggro/leash/wander + LOS por raycast + flow-field BFS bien pensados.
- Loop con `try/catch` (una excepción no congela el juego) y culling de tiles.
- Render ordenado por Y, capa de oscuridad en offscreen, anclaje por foot-row.
- Código muy comentado (en español, consistente).

---

## Hallazgos por área

### A. Motores de render (la deuda más visible)
Hay **9 subsistemas de render** vivos: billboard procedural `px()`, sheets de jefe
(`BOSS_ANIMS`), PixelLab por-frame (`skeleton.js`), sheets CraftPix (`slime.js`),
hero rig (`anim-rig.js`+`hero.js`), hero pack (`heropack.js`), mago v2
(`v2hero.js`), tiles, y objetos-deco (cofre/antorcha/fuego/escalera).

- **`skeleton.js` ≈ `slime.js`**: el mismo motor duplicado; solo cambia el *loader*
  (PNGs por-frame vs sheet en grilla). La lógica de facing EMA es copy-paste
  (`skeleton.js:131-162` vs `slime.js:72-97`), con magic numbers que **divergen sin
  razón** (umbral `0.06` vs `0.05`).
- **4 renderers de jugador** apilados (`v2hero` → `heropack` → `hero/ARIG` →
  `playerSprite()`). Según la memoria, v2 es el pipeline elegido → `anim-rig.js`+
  `hero.js` son deuda muerta.
- **Triplicación**: lista de octantes (×3), evaluador de timeline (`animFrame` vs
  `hpFrame`), función de tier (`weaponTier` ≡ `hpTier`, idéntica), tinte
  (`tintedSprite` vs `drawSlimeFrame`), bbox por contenido (`computeFootY` vs
  `chestBBox`), y el offset `e.y+5` de sombra cableado en 3 archivos.
- **Bug latente**: `v2hero.js:91-94` no tiene guarda `if(!img)` → si falta un frame
  de una combinación dir/anim, `ctx.drawImage(undefined)` crashea el render del
  jugador (los otros motores sí tienen fallback).

### B. Combate, IA y comportamientos
- **Boss 100% hardcodeado**: `updateBoss` (`entities.js:254-369`) es un `if
  (pat===...)` de 115 líneas con parámetros mágicos embebidos (n=12 balas, spd*4.5,
  etc.). Un jefe nuevo = otro bloque de código. No se puede configurar un patrón
  desde data.
- **Flags de render filtrados al combate**: `if(e.def.skel)` / `if(e.def.slime)`
  para disparar animaciones de golpe (`entities.js:234-235`), con duraciones
  literales (0.46, 0.7) en la lógica de combate. El flag `slime` además "miente"
  (significa "usa el motor de sheets", lo usan lich/orco/zombi).
- **El "kit pelota" del jefe Bucle contamina 4 funciones generales**
  (`spawnEnemy`/`damageEnemy`/`updateBoss`/`updateProjectiles`).
- **`makeItemRespectRarity`** (`entities.js:683`) re-tira a ciegas sin garantizar la
  rareza → drops de jefe pueden salir comunes.

### C. Balance y escalado de contenido
- **Lineal vs multiplicativo**: `hp = 1+(depth-1)*0.22` (recta) contra el jugador que
  crece por mods + upgrades sumables + crit (multiplicativo). A pisos profundos uno
  supera al otro; hoy se salva solo porque hay 6 pisos totales (3 zonas × 2).
- **Sin tope**: `rollRarity`/`depthMult` crecen sin acotar; si subís `floors`,
  explotan los valores.
- **Topología única**: todo bioma usa el mismo algoritmo (salas rectangulares +
  pasillos en L). Cavernas y Santuario se ven estructuralmente iguales a la Torre;
  la única variación es la paleta. No hay tipos de sala (tesoro/trampa/etc.).
- **4 slots de equipo fantasma** (`foco/guantes/cinturon/anillo2`): declarados, nunca
  dropean → datos muertos.

### D. Generación de mazmorras (correctitud)
- **Sin validación de conectividad**: no hay flood-fill que garantice que la
  escalera / cofres / portador de llave son alcanzables. Hoy funciona por la conexión
  en cadena, pero es una invariante frágil no verificada. Si salen <2 salas,
  start==exit.
- **Llave perdible**: si bajás sin matar al portador, la llave se pierde y el cofre
  dorado queda inabrible, sin feedback.
- **Objetos sin anti-solape**: enemigos pueden nacer sobre un cofre (que bloquea), y
  altar/cofre/ítem pueden caer en el mismo centro de sala.

### E. UI, estado y persistencia
- **Lógica de juego mezclada con DOM**: `equipItem`/`buyItem`/`sellItem` mutan
  `state.player` desde `ui.js`; no hay capa de modelo separada de la vista.
- **Re-render total** del inventario/tienda en cada acción (`innerHTML=''` +
  recrear nodos y canvases), sin memoización de íconos.
- **Run no persistida**: solo récords en `localStorage`; `saveCurrentFloor` guarda
  arrays vivos en memoria (ni siquiera serializables). Cerrar pestaña = perder run.
- **Saves sin versionar** y con `try/catch` vacíos (corrupción/quota silenciosas).
- **`setInterval` huérfanos**: retrato del menú (uno por `buildMenu`) y mago del
  inventario (siempre corriendo aunque esté cerrado) → batería en mobile.
- **CSS gigante inline** (~340 líneas en `index.html`) con geometría en % acoplada a
  PNGs concretos.

### F. Performance (allocations por frame)
- `render()` es una función-Dios de ~530 líneas que **muta `state`** (empuja
  partículas, recalcula estado de animación de enemigos al dibujarlos) → acopla
  simulación y presentación, e impide cullear entidades fuera de pantalla.
- **Gradientes recreados cada frame**: `createRadialGradient` por antorcha visible,
  viñeta, luz del jugador, aura de cada orbe, y por cada agujero de la capa oscura.
  Es el costo dominante; escala mal con más luces.
- `buildFlow` (BFS sobre todo el mapa) corre **cada frame** aunque no haya chasers; y
  `hasLOS` (raycast por mob) corre para todos los enemigos siempre — cuello de
  botella con hordas.
- `renderMinimap` recorre el mapa **entero** cada frame.
- `state.enemies` se reordena (`sort`) y se filtra (`filter` por muerte) en caliente.

### G. Build, módulos y tooling
- Sin build/módulos/lint/tests: 13 archivos en scope global, dependencias por orden
  de `<script>`, y un mar de `typeof X !== 'undefined'` para tolerar carga async.
- **Cache-busting manual**: `?v=N` a mano en 12 `<script>` + 7+ constantes de versión
  de assets, varias **desincronizadas**, y varios loaders **sin `?v=`** (boss sheets,
  heropack, iconos, monedas, xp, escalera, antorcha inline). Bombas de caché.
- Sin service worker pese al manifest → no hay offline real.
- Repo de 127 MB (47 MB de packs con PSD) sin Git LFS.

---

## Bugs / quick wins (bajo riesgo, alto valor — hacer pronto)

1. **Guarda `if(!img) return`** en `drawV2Hero` (`v2hero.js:91`) — evita crash del
   jugador.
2. **Unificar umbral prompt vs acción** del cofre dorado (`TILE*1.6` en
   `updatePrompt` vs `TILE*1.4` en `tryInteract`): hoy el prompt aparece antes de
   poder actuar.
3. **Soltar la llave al piso** cuando muere el portador (o marcarlo visualmente) —
   evita el cofre dorado inabrible silencioso.
4. **Arreglar `makeItemRespectRarity`** — forzar la rareza mínima real.
5. **Agregar `?v=` a los loaders que no lo tienen** (o, mejor, P4).
6. Quitar `loadDungeonTiles` descartado del arranque (se descarga sin usarse).
7. Borrar comentario muerto (`main.js:572`) y limpiar `count(r)` sin uso
   (`dungeon.js:73`).

---

## Plan de refactor priorizado

### P1 — Sistema de ataques/habilidades data-driven *(el de mayor retorno)*
Reemplazar las cadenas de `if` por tipo y `updateBoss` por patrones declarados en
data + un registro de "kinds":
```js
patterns: [
  { kind: 'projectileRing', count: 12, speed: 'projSpd', cd: 1.1, color: '#ff5a8a' },
  { kind: 'chargeAtPlayer', telegraph: 0.55, speedMul: 4.5 },
  { kind: 'spread', arc: 0.5, count: 3, cd: 0.65 },
]
// ATTACK_KINDS = { projectileRing(e,p,cfg,dt){...}, ... }
```
Colapsa `updateBoss` a un dispatcher, permite **reusar patrones en mobs normales**
(no solo jefes) y agregar jefes sin tocar código. Encaja con "rediseñar antes que
parchar". También: mover `atkAnimT`/duraciones y `deathSfx` a la data del sprite,
eliminando los `if(e.def.skel/slime)` del combate.

### P2 — Unificar los motores de mob (skeleton + slime + v2 → 1 "AnimRenderer")
Una capa de facing/anim compartida + dos adaptadores de asset (per-frame vs sheet).
Estado de animación en **un** namespace (`e._anim`) en vez de `_skl*`/`_sl*`/`_v2*`.
Una sola copia de octantes/tinte/bbox/offset-de-sombra. Borrar `anim-rig.js`+
`hero.js` (deuda muerta). Idealmente **el jugador v2 y los mobs corren por el mismo
motor** (ambos son PixelLab 8-dir per-frame).

### P3 — Persistir la run en curso
Autosave a `localStorage`/IndexedDB al cambiar de piso, con un **formato
serializable** separado del estado vivo (IDs, no objetos con sprites). Versionar el
save (`{v, ...}` + `migrate()`) y reemplazar los `try/catch{}` vacíos por manejo de
quota/corrupción con `toast`.

### P4 — Centralizar el versionado de assets
Un solo `assetUrl(path)` (o `ASSET_VERSIONS`) que agregue `?v=` global, usado por
**todos** los loaders (hoy 7+ no lo ponen). Mata la clase de bug "clavados en el
asset viejo" que ya pasó. A futuro: mini-build (esbuild/vite) con hashing que elimina
el `?v=N` manual y habilita módulos ES reales.

### P5 — Validación + variedad de mazmorra
- Flood-fill desde `start` tras generar; si escalera/cofres/llave no son alcanzables,
  **regenerar el piso**. Garantizar `rooms.length >= 3`.
- Pool de celdas ocupadas para anti-solape de objetos.
- `layout` por zona en `ZONES` (prepara biomas reales) y `ROOM_TYPES` (tesoro/
  peligro/normal) como tabla con pesos.

### P6 — Refactor de render y performance (medio)
- Sacar la mutación de `state` fuera de `render`; partir `render` en sub-funciones.
- Cachear gradientes/viñeta/luz (sprite de halo pre-renderizado) y el minimapa
  (offscreen, repintar solo el punto del jugador).
- `buildFlow` solo si hay chaser con aggro / cuando el jugador cambia de tile;
  cachear `hasLOS` con cooldown por mob.

### P7 — Modelo de balance con curva (medio)
Reemplazar `1+(depth-1)*k` por una curva parametrizable y por-zona; definir hp/dmg
como "presupuesto × rol" en vez de absolutos; acotar con `depthCap`. Documentar la
curva de poder del jugador para alinear ambas.

### P8 — UI/estado (medio/bajo)
Separar lógica de juego de la vista (módulo de modelo que muta `state`, la UI solo
lee); render incremental del inventario; mover los `setInterval` al rAF y pausarlos
con el panel cerrado; sacar el CSS a `styles.css`; registrar service worker.

---

## Conclusión

No hay nada "roto de diseño": las bases (data-driven, proyectiles unificados, IA) son
buenas. El techo lo ponen (a) **comportamientos hardcodeados**, (b) **motores de
render duplicados**, (c) **balance lineal** y (d) **falta de persistencia/tooling**.
Atacando P1+P2 se desbloquea casi todo el roadmap de contenido (más mobs, jefes y
ataques sin tocar código), y P3+P4 quitan las dos fallas que más fricción diaria
generan (perder la run en mobile y quedar clavado en assets viejos).
