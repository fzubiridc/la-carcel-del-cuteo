# assets/mobs â€” sprites de enemigos

Dos sistemas conviven (cada uno con su motor de render):

## 1) Sheet-mobs (CraftPix) â€” motor `js/mob.js` (source: sheet)
Carpetas: `slime/`, `lich/`, `ghost/`, `zombie/`, `orc/`.

Cada animaciÃ³n es **un PNG sprite-sheet** con grilla:
- **columna = frame** de la animaciÃ³n
- **fila = direcciÃ³n**: `0 = sur (frente)`, `1 = norte (espalda)`, `2 = oeste`, `3 = este`
- cada celda es **64Ã—64**

Animaciones disponibles por mob (ver `ANIMATIONS.json` para el conteo de frames):
`idle`, `walk`, `run`, `attack`, `hurt`, `death` (+ orc: `run_attack`, `walk_attack`).

**Estado de uso actual** (en `MOB_CFG`): se usan `idle`, `walk` y `attack`.
`run`, `hurt`, `death` estÃ¡n **absorbidas y listas** â€” para activarlas, sumar la
entrada al `anims` del set en `mob.js` con su `n` (frames) del manifest.

Extras:
- `lich/fire.png` â€” bola de fuego del liche (3 frames, fila "este" de `Fire.png`,
  se dibuja rotada hacia el tiro). Proyectil con `projStyle:'fire'`.

Todas son la **variante 1** de cada pack (Slime1/Lich1/â€¦). Las variantes 2 y 3
(otros colores/skins) + `With_shadow` + `Parts` estÃ¡n completas en
`review/legacy-assets/packs/<mob>/`.

## 2) PixelLab por-frame â€” motor `js/mob.js` (source: frames)
Carpetas: `skeleton/`, `skeleton_espada/`, `rata/`.
Frames sueltos: `assets/mobs/<set>/<anim>/<dir>_<frame>.png` (152px skeleton, 56px
rata). ConvenciÃ³n 5 dirs nativas (S/SE/E/NE/N) + espejado. Hoy en juego: solo la
`rata` (los esqueletos se quitaron de las zonas por ser muy realistas, pero el
cÃ³digo y los assets quedan).

## Archivos
- `ANIMATIONS.json` â€” manifest: por mob, frames/filas de cada animaciÃ³n.
- `review/legacy-assets/packs/` â€” packs CraftPix completos (todas las variantes, with/without
  shadow, parts, PSD, Tiled) por si se quiere usar algo a futuro.
