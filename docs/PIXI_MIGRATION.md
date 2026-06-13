# Pixi migration checklist

Estado: `?pixi` usa WebGL para mapa, entidades, mobs animados, proyectiles,
particulas, Archimago V2, staff rig, **cofres animados, fuego del liche y una
capa de iluminacion Pixi-nativa**. Canvas sigue como fallback.

## Resuelto (verificado en runtime)

- **`weaponTier` indefinido** → crasheaba `staffIconImg` cada frame con un baston
  en pantalla (piso o inventario), en Pixi **y** canvas. Definido en
  `items.js` (indice de material 0-5). Tambien arreglaba el bug silencioso de
  v2hero (vara equipada siempre en tier 0).
- **Sombras se veian como luz** → `pcol(0x000000)` devolvia blanco porque
  `if (!c)` trata el negro (`0`) como falsy. Cambiado a `if (c == null)`.
- **Cofres nuevos no aparecian** → `pixiImageReady` chequeaba `.complete`, que
  no existe en `<canvas>` (los frames del cofre son canvases). Ahora acepta
  `<canvas>` por `width/height`.
- **Fuego del liche sintetizado** → el render de proyectiles no usaba
  `LICH_FIRE`; el estilo `fire` caia a un circulo. Agregada la rama con el
  sprite animado.
- **Iluminacion** → capa Pixi-nativa (no copia los gradientes del canvas pixel
  a pixel): una textura radial reusable + sprites de luz con blend `ADD`,
  flicker por alpha/scale (sin regenerar texturas por frame), oscuridad
  ambiente + vinneta. Antorchas calidas, luz suave del jugador, auras de orbes.
  Objetivo: dungeon oscuro pero legible. La capa de luz se compone ENTRE el piso
  y las entidades (orden en stage: `world(piso) -> lighting -> entities ->
  screen`), asi la luz cae sobre el suelo y los personajes van encima a brillo
  normal ("caminan sobre la luz", sin aura sobre el sprite). `lighting =
  [darkness, lights(ADD), vignette]`. El HUD es DOM, queda fuera.

## Tiers y nombres

- El sistema de 6 niveles (interno: `material`, sube con la profundidad) se
  muestra como **T1-T6** en la UI, sin nombres metalicos.
- Armas de mago (vara/baston/cetro) reciben **nombres de fantasia por tier**
  (`STAFF_NAMES` en `items.js`): arcano/elegante en tiers bajos → legendario en
  t6. Resto de items: nombre sin metal.

## Pendiente

- **Bug gameplay**: "rata pega a rango" — `ENEMIES.rata` es `ai: 'chaser'`, no
  deberia disparar. Confirmar si es hitbox/contacto o feedback visual.
- Migrar piso `oscuro` con vision limitada real (hoy la capa de oscuridad sube
  el alpha ambiente, pero no perfora agujeros de vision como el canvas).
- Migrar mercader, altar y decoracion especial.
- Migrar FX complejos: polvo, rings, explosion de poder y textos flotantes.
- Migrar minimapa o dejarlo explicitamente en Canvas.
- Enemigos: alinear pies/sombra/hitbox por tipo; verificar animaciones de
  ataque (chaser/erratic/shooter); separar proyectiles de golpes de contacto.
- Nombres de fantasia para armaduras / armas no-mago (hoy quedan con baseName).

## Performance

- Las luces usan un pool de sprites (sin alocar por frame) y no regeneran
  texturas; la vinneta solo se regenera al cambiar el tamanno.
- Medir FPS con muchos enemigos/proyectiles en PC.
- Prueba manual repetible: piso 1, boss debug, cambio de piso, combate con 20+
  mobs, piso `oscuro`.

## Paridad Canvas

- Mantener Canvas como fallback hasta cubrir piso oscuro, FX complejos y
  decoracion especial.
- Cuando Pixi este estable, decidir si `?pixi` pasa a default.
