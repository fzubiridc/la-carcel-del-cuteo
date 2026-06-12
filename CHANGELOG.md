# Changelog

Registro de cambios de **La Cárcel del Cuteo**. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es/). Las fechas son del desarrollo.

## [Sin publicar] — 2026-06-11

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

### Gameplay
- **Maná funcional**: los hechizos consumen maná, se regenera al dejar de castear
  (~3.5 s a full); sin maná no se castea.
- **Pociones de maná** (tecla F), análogas a las de vida (Q); caen de cofres y enemigos.
- Drops de monedas **aleatorios y escalados** por dureza del enemigo (los fáciles dan menos).
- Pociones de vida más frecuentes (cofres + enemigos).
- El **orbe mágico explota** al llegar al punto apuntado (animación + daño en área) y
  **termina donde clickeás** en desktop (con un recorrido mínimo).
- El orbe **ilumina** el entorno por donde pasa.
- Items: se pueden **tirar** arrastrándolos fuera de cualquier slot (mochila o equipado).

### IA
- Los enemigos requieren **línea de visión** (ya no detectan a través de paredes).
- Persecución con **pathfinding** (campo de flujo BFS): caminan por el camino ortogonal
  más corto y rodean las paredes en vez de empujar contra ellas.

### Contenido
- Íconos de **vara arcana** por tier (T1–T3) integrados en el inventario (PixelLab).
- Altares de sacrificio nunca aparecen en la sala inicial ni en la de la escalera.
