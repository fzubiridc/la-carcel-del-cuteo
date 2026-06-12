# Changelog

Registro de cambios de **La Cárcel del Cuteo**. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es/). Las fechas son del desarrollo.

## [Sin publicar] — 2026-06-12 (tarde/noche)

### Refactor
- **Motor de mobs unificado** (`js/mob.js`): fusiona `skeleton.js` + `slime.js`
  (eran el mismo motor con dos formatos de asset). Un solo `MOB_CFG`/`drawMob` con
  dos *sources* — `frames` (PixelLab por-frame: skeleton/rata) y `sheet` (CraftPix
  64px: slime/lich/ghost/zombie/orc) — compartiendo facing por EMA, idle/walk/attack,
  tinte, anclaje y fallback. De 2 motores a 1; se borraron los dos archivos viejos.
  (P2 del ANALYSIS.md.)

### Arte / Mundo
- **Mobs nuevos (CraftPix)**: Slime, Liche, Fantasma, Zombi y **Orco**. El renderer
  `slime.js` es un motor de sprite-sheets multi-set (64×64, columna=frame,
  fila=dirección, 4 dirs) con idle/walk/**attack**, mirada según movimiento, tinte
  de flash/furia, sombra propia y flote/alpha opcionales (el Fantasma flota, es
  translúcido y atraviesa muros). Cada mob reproduce su **animación de ataque** al
  golpear (encarando al jugador). Tamaños bajados (eran demasiado grandes).
- **Esqueletos PixelLab quitados** de las zonas (demasiado realistas); su código y
  assets quedan en el repo. La Torre ahora: rata, slime, liche, fantasma, zombi, orco.
- Packs CraftPix (dungeon, slimes, lich, ghost, zombie) guardados completos en
  `assets/packs/` para uso futuro aunque no se usen todos los assets.
- El tileset CraftPix "dungeon" se **descartó** (no convencía); el código del
  loader queda disponible en `sprites.js` por si se retoma. Se mantiene el tileset
  propio de la Torre.

### Gameplay
- **Ajustes de mobs**: rata más chica; liche +30% de tamaño; fantasma más frágil
  pero pega más fuerte (hp 28→18, dmg 10→15).
- **Cofre con profundidad (z-order)**: el sprite del cofre entra en el orden por Y,
  así tapa los pies del prota cuando está parado detrás (más arriba). El glow queda
  detrás de todo. Colisión frontal un poco más cercana.
- **Liche a distancia**: pasó de chaser melee a **shooter** — mantiene distancia,
  reproduce su animación de casteo y lanza su **bola de fuego** propia (sprite
  `Fire.png` del pack, animada y rotada hacia el tiro) en vez de un punto de color.
  (Los proyectiles de enemigos ahora soportan `projColor` y `projStyle` por-def.)
- **Glow del cofre con llave**: ahora es una **elipse dorada achatada** (perspectiva
  top-down) con gradiente, dibujada detrás del cofre, en vez del círculo plano.
- **Cofres animados** (CC-BY Bonsaiheldin, tira de 4 frames): al abrirse reproducen
  la animación de apertura (cerrado → abierto) en vez del swap instantáneo. Común
  marrón + dorado para el de llave. Reemplaza el set estático anterior.
- **Mobs más chicos** y **apoyados en la sombra**: bajados los tamaños de los
  sheet-mobs (eran casi del tamaño del jugador) y corregido el flote (se anclaban
  5px por encima de la sombra; ahora los pies caen en la sombra). Mismo fix al
  motor del esqueleto/rata.
- **Balance nivel 1**: HP de los mobs de la Torre bajada para que el mago los mate
  en ≤3 golpes desde el inicio (zombi 50→40, liche →36, orco 36). Daño base del
  mago ~15/golpe → 3 golpes = 45.
- **Cofres nuevos** (CraftPix CC-BY Bonsaiheldin, 32×32): común marrón + dorado con
  candado (para el cofre con llave). Sistema de cofre ahora multi-set; `CHEST_K`
  reajustado al arte de 32px. Sheet completo guardado en `assets/packs/chests/`.
- **Cofres con colisión + abrir con [E]**: ya no se atraviesan ni se abren solos al
  tocarlos; bloquean el paso y se abren apretando E al lado (al abrirse dejan de
  bloquear). El cofre dorado igual, pidiendo la llave. Hint "[E] Abrir cofre".
- **Drops más juntos**: la dispersión lateral al soltarse bajó de ±55 a ±24 px.
- **Monedas más chicas** en el piso (15 → 10 px).

### UI / Arte
- **Corona de ladrillo en los muros**: el tope negro justo encima de cada cara de
  muro ahora lleva una fila de ladrillo (franja superior del mismo tile + sombra
  fina), rematando el muro en vez del corte abrupto a negro. No toca caras
  frontales ni el anclaje de antorchas (a diferencia del "lip" descartado).
- **Pantalla de derrota** con marco ornamentado (PixelLab): "HAS CAÍDO", stats
  compactas y botones REINTENTAR (run nueva directa) / MENÚ. Fuentes del proyecto
  (Cinzel/Inter).
- **Tooltip de ítem** con marco ornamentado en el hover: nombre, miniatura, stats
  y comparación con lo equipado.
- **Rata animada** (PixelLab "Dungeon Rat", 56px): 4 direcciones cardinales
  nativas (S/E/N/W) con walk de 6 frames; reemplaza el billboard plano. El motor
  de `skeleton.js` se generalizó a sets de cualquier tamaño (px/foot/draw por-set;
  los defaults dejan al esqueleto de 152px idéntico).
- **Cofre nuevo** (PixelLab): cerrado dorado-arcano + abierto con tapa levantada y
  brillo violeta. El render del cofre ahora **se ancla por el contenido** (bbox de
  alfa, base + centro) en vez de por el canvas: estados con padding o que crecen
  (tapa que sube) ya no encogen ni saltan de base. Cache-bust `CHEST_V`. Sin sombra
  (apoya solo, se iba el flote).
- **Sonido de abrir cofre**: el crujido de madera (antes en las transiciones de
  piso) pasó a sonar al abrir cofres. El común cruje; el dorado cruje + fanfarria.
  Las transiciones de nivel ya no suenan ese efecto. El sample se renombró a
  `chest.wav`.
- **Sonidos de muerte por tipo**: rata (chillido) y esqueleto (crujido de huesos).
- Fix: mobs estáticos ya no flotan (anclados por su fila de pies real).

### Notas
- Variantes de esqueleto armado (espada / espada+escudo): **bloqueadas** — el
  template de animación despoja el arma y el v3 (que la conserva) no persiste en
  los "states". Pendiente: regenerarlas como personajes propios v3.

## [Sin publicar] — 2026-06-12

### Arte / Mundo
- **Esqueleto rediseñado** (PixelLab, 152px, 8 direcciones): reemplaza el sprite CC0 plano.
  Camina con la animación *scary-walk* y tiene **ataque** propio (swing horizontal contenido,
  con chispa fría azul). Mira hacia donde se mueve y, al golpear, encara al jugador.
  Convención **5 direcciones + espejo** (W/SW/NW se reflejan de E/SE/NE) para abaratar la generación.
- **Nueva ambientación "Torre en Ruinas"** (reemplaza Catacumbas como primera zona): tileset
  PixelLab de **piso** + **8 variantes de muro** (ladrillo desgastado), elegidas por hash de celda.
- Esqueletos: corregida la **flotación** (los pies ahora apoyan en la sombra) y, quieto, ya no
  "marcha en el lugar". El **esqueleto arquero** también pasó al sprite nuevo; se quitaron los
  sprites CC0 viejos de ambos.
- Piso de la Torre **regenerado**: tono marrón oscuro (mejor contraste contra los muros grises),
  6 variantes aplanadas sobre base opaca → tilea continuo, sin grilla.
- **Tope de los muros en negro** (antes ladrillo oscurecido, que no leía bien): sólo la cara
  frontal con piso debajo muestra el ladrillo.

## [Publicado] — 2026-06-11

### HUD / UI
- Barras de vida y maná con relleno **procedural** (gradiente cilíndrico, sin la textura
  vieja): sangre rojo bordó → centro brillante; maná análogo en azul.
- Nombre del mapa centrado arriba (antes en la esquina).
- Nivel: solo el número, sobre la barra de experiencia (se quitó "ARCHIMAGO · NIVEL").
- Dash convertido en **ícono de bota** dentro de un **slot circular** sobre la barra de XP
  (preparado para futuras habilidades); el cooldown se revela al recargar.
- Vista de inventario agrandada; el personaje es el sprite del juego en idle parado sobre
  una **plataforma rúnica** (reemplaza la imagen render anterior).
- Botones para **ordenar la mochila** por tipo / rareza / poder.
- Precarga de los assets del inventario (sin tirón en la primera apertura).

### Gameplay
- **Maná funcional**: los hechizos consumen maná, se regenera al dejar de castear
  (~3.5 s a full); sin maná no se castea.
- **Pociones de maná** (tecla F), análogas a las de vida (Q); caen de cofres y enemigos.
- Drops de monedas **aleatorios y escalados** por dureza del enemigo (los fáciles dan menos).
- Monedas como **pilas con 4 niveles** visuales según el monto (pocas → miles); escalan con la profundidad.
- En pisos oscuros, el orbe abre su propia "linterna" (perfora la oscuridad como el
  personaje, vía capa offscreen) — iluminación pareja en sala clara u oscura.
- Pociones de vida más frecuentes (cofres + enemigos).
- El **orbe mágico explota** al llegar al punto apuntado (animación + daño en área) y
  **termina donde clickeás** en desktop (con un recorrido mínimo).
- El orbe **ilumina** el entorno por donde pasa.
- Items: se pueden **tirar** arrastrándolos fuera de cualquier slot (mochila o equipado).
- Sonido de **pasos** del prota (sample real en loop mientras camina, reemplaza el beep).
- Sonidos reales (pack RPG + samples sueltos) para **daño, monedas (3 variantes que alternan), poción, escalera, equipar, golpe melee y dash**.
- Sonidos por archivo (explosión, cast, daño) ahora vía **WebAudio** → suenan también en móvil/iOS (antes los `<audio>` clonados quedaban mudos en iOS).
- Podés **desequipar la staff**; sin arma el mago lanza una **chispa arcana** débil y sin maná.

### IA
- Los enemigos requieren **línea de visión** (ya no detectan a través de paredes).
- Persecución con **pathfinding** (campo de flujo BFS): caminan por el camino ortogonal
  más corto y rodean las paredes en vez de empujar contra ellas.

### Contenido
- Íconos de **vara arcana** por tier (T1–T3) integrados en el inventario (PixelLab).
- Altares de sacrificio nunca aparecen en la sala inicial ni en la de la escalera.
