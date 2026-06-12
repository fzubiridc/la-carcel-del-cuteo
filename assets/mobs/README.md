# assets/mobs — sprites de enemigos

Dos sistemas conviven (cada uno con su motor de render):

## 1) Sheet-mobs (CraftPix) — motor `js/slime.js`
Carpetas: `slime/`, `lich/`, `ghost/`, `zombie/`, `orc/`.

Cada animación es **un PNG sprite-sheet** con grilla:
- **columna = frame** de la animación
- **fila = dirección**: `0 = sur (frente)`, `1 = norte (espalda)`, `2 = oeste`, `3 = este`
- cada celda es **64×64**

Animaciones disponibles por mob (ver `ANIMATIONS.json` para el conteo de frames):
`idle`, `walk`, `run`, `attack`, `hurt`, `death` (+ orc: `run_attack`, `walk_attack`).

**Estado de uso actual** (en `SLIME_CFG`): se usan `idle`, `walk` y `attack`.
`run`, `hurt`, `death` están **absorbidas y listas** — para activarlas, sumar la
entrada al `anims` del set en `slime.js` con su `n` (frames) del manifest.

Extras:
- `lich/fire.png` — bola de fuego del liche (3 frames, fila "este" de `Fire.png`,
  se dibuja rotada hacia el tiro). Proyectil con `projStyle:'fire'`.

Todas son la **variante 1** de cada pack (Slime1/Lich1/…). Las variantes 2 y 3
(otros colores/skins) + `With_shadow` + `Parts` están completas en
`assets/packs/<mob>/`.

## 2) PixelLab por-frame — motor `js/skeleton.js`
Carpetas: `skeleton/`, `skeleton_espada/`, `rata/`.
Frames sueltos: `assets/mobs/<set>/<anim>/<dir>_<frame>.png` (152px skeleton, 56px
rata). Convención 5 dirs nativas (S/SE/E/NE/N) + espejado. Hoy en juego: solo la
`rata` (los esqueletos se quitaron de las zonas por ser muy realistas, pero el
código y los assets quedan).

## Archivos
- `ANIMATIONS.json` — manifest: por mob, frames/filas de cada animación.
- `assets/packs/` — packs CraftPix completos (todas las variantes, with/without
  shadow, parts, PSD, Tiled) por si se quiere usar algo a futuro.
