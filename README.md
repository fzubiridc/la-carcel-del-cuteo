# La Carcel del Cuteo

Action roguelike 2D de fantasia medieval hecho con HTML5 Canvas y JavaScript vanilla.

El juego es estatico: no requiere build, npm ni backend. La version jugable vive en
`index.html` y los modulos principales estan en `js/`.

## Levantar en PC

Opcion rapida:

```powershell
py -m http.server 8417
```

Abrir:

```text
http://localhost:8417
```

Tambien se puede abrir `index.html` con doble clic, pero servirlo por HTTP evita
diferencias raras de navegador con assets, audio o cache.

## Ver rendimiento

Abrir el juego con modo debug:

```text
http://localhost:8417/?debug
```

Arriba a la derecha aparece FPS, ms por frame y conteo de enemigos/proyectiles/FX.
Como guia: 60 FPS es ideal, 55+ esta bien, 40-55 indica bajones jugables y menos
de 40 conviene optimizar.
Medilo con la pestana del juego activa; si el navegador la deja en segundo plano
puede limitarla artificialmente a 1 FPS.

Renderer WebGL experimental con Pixi:

```text
http://localhost:8417/?pixi&debug
```

## Controles

- `WASD` o flechas: mover
- Mouse: apuntar
- Click izquierdo: atacar
- `Espacio`: dash
- `Q`: pocion
- `E`: interactuar
- `I` o `Tab`: inventario
- `Esc`: pausa / cerrar panel

## Estructura

```text
.
|-- index.html          # pantalla, HUD, estilos y carga de scripts
|-- manifest.json       # metadata PWA
|-- js/                 # juego
|-- assets/             # assets que el juego carga en runtime
|-- scripts/            # utilidades puntuales
|-- docs/               # diseno, backlog, lore y analisis
`-- review/             # material viejo para revisar, no runtime
```

## Codigo vivo

- `js/data.js`: clases, armas, enemigos, jefes, zonas, upgrades y balance.
- `js/main.js`: estado global, input, loop, guardado de run, pisos y render.
- `js/entities.js`: jugador, IA, combate, proyectiles, loot, XP y efectos.
- `js/dungeon.js`: generacion procedural y colisiones de mapa.
- `js/items.js`: generacion de equipo, rarezas, materiales y stats.
- `js/ui.js`: menu, HUD, inventario, tienda, tooltips, final de run y audio.
- `js/sprites.js`, `js/mob.js`, `js/v2hero.js`: carga y render de assets.

## Documentacion

- Arquitectura actual: `docs/ARCHITECTURE.md`
- Backlog activo: `docs/V2_BACKLOG.md`
- Roadmap historico: `docs/ROADMAP.md`
- Analisis estructural anterior: `docs/ANALYSIS.md`
- Lore: `docs/LORE.md`
- Cambios: `CHANGELOG.md`

## Estado del juego

- Mago jugable con energyblast, mana, equipo visible y staff intercambiable.
- Mazmorras procedurales con pisos persistentes, cofres, altar, mercader y jefes.
- Loot con materiales, rarezas, mods y comparacion de items.
- Records y run actual guardados en `localStorage`.
- Audio, particulas, minimapa, pausa y pantalla final.

## Material en revision

`review/` contiene assets, herramientas y codigo viejo que ya no carga el juego.
Queda ahi para comparar o recuperar piezas antes de borrarlas definitivamente.
