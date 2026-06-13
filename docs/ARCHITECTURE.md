# Arquitectura actual

Este documento describe el estado real del repo despues de la integracion del mago v2
y el guardado de run. Para decisiones historicas, ver `ANALYSIS.md` y `ROADMAP.md`.

## Stack

- HTML estatico en `index.html`.
- JavaScript global por orden de `<script>`.
- Canvas 2D para juego y minimapa.
- DOM para menu, HUD, inventario, tienda y pantallas.
- `localStorage` para records y autosave de la run.

No hay build system ni dependencias de runtime.

## Flujo de arranque

1. `index.html` carga estilos, HUD, pantallas y scripts.
2. `main.js` espera `window.load`.
3. Se construyen/cargan sprites y packs (`sprites.js`, `mob.js`, `v2hero.js`, etc.).
4. Se enlazan input, menu y loop principal.
5. `requestAnimationFrame(loop)` mantiene update y render.

## Modulos

### `js/data.js`

Fuente principal de contenido:

- `CLASSES`
- `WEAPON_TYPES`
- `MATERIALS` / `RARITIES`
- `SLOTS`
- `ENEMIES`
- `BOSSES`
- `ZONES`
- `UPGRADES`
- `BALANCE`

Agregar contenido simple deberia empezar aca.

### `js/main.js`

Orquestador del juego:

- estado global `state`
- input teclado/mouse/touch
- inicio y continuacion de run
- autosave y restore
- cambio de pisos
- loop principal
- render completo
- minimapa

Es el archivo con mas deuda por tamano y mezcla de responsabilidades.

### `js/entities.js`

Modelo de entidades y combate:

- creacion de jugador y enemigos
- IA de mobs
- patrones de jefes via `BOSS_PATTERN_HANDLERS`
- proyectiles
- dano, muerte, loot, pickups, XP y efectos

### `js/dungeon.js`

Generacion y colisiones:

- pisos normales
- arenas de jefe
- colision con paredes
- colision con cofres
- movimiento con colision

### `js/ui.js`

DOM y audio:

- menu
- HUD
- inventario
- tienda
- tooltips
- pantalla final
- audio sintetico y buffers de SFX

## Material fuera del runtime

`review/` contiene codigo, herramientas y assets viejos movidos para revision.
El juego no carga archivos desde ahi. La carpeta existe para comparar o recuperar
material antes de borrarlo definitivamente.

## Persistencia

Hay dos familias de datos:

- Records: `carcel_records`
- Run actual: `carcel_run_v1`

La run se serializa desde `saveRunToStorage()` y se revive con `loadRunFromStorage()`.
Los pisos visitados quedan guardados con enemigos, pickups, cofres y exploracion.

## Rendimiento

Los costos principales estan en:

- render de luces/gradientes
- ordenamiento de entidades visibles
- pathfinding de mobs
- minimapa
- cantidad de assets cargados

Las optimizaciones deben ser conservadoras: cachear o espaciar trabajo repetido antes
de partir sistemas grandes.

## Siguientes refactors razonables

1. Extraer render de `main.js` a `js/render.js`.
2. Extraer persistencia a `js/save.js`.
3. Centralizar URLs/versionado de assets.
4. Unificar renderers viejos del jugador/mobs si se confirma que v2 es definitivo.
5. Separar CSS de `index.html` cuando se toque UI de forma grande.
