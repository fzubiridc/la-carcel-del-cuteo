# Changelog

Registro de cambios de **La Cárcel del Cuteo**. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es/). Las fechas son del desarrollo.

## [Sin publicar] — 2026-06-12 (tarde/noche)

### UI / Arte
- **Pantalla de derrota** con marco ornamentado (PixelLab): "HAS CAÍDO", stats
  compactas y botones REINTENTAR (run nueva directa) / MENÚ. Fuentes del proyecto
  (Cinzel/Inter).
- **Tooltip de ítem** con marco ornamentado en el hover: nombre, miniatura, stats
  y comparación con lo equipado.
- **Rata animada** (PixelLab "Dungeon Rat", 56px): 4 direcciones cardinales
  nativas (S/E/N/W) con walk de 6 frames; reemplaza el billboard plano. El motor
  de `skeleton.js` se generalizó a sets de cualquier tamaño (px/foot/draw por-set;
  los defaults dejan al esqueleto de 152px idéntico).
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
