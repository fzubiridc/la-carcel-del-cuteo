# La Cárcel del Cuteo — Roguelike RPG 2D

Action roguelike 2D de fantasía medieval: dungeon crawler con mazmorras procedurales y combate en tiempo real sobre el mapa.

**Arte:** criaturas y tiles del tileset CC0 de [Dungeon Crawl Stone Soup](https://opengameart.org/content/dungeon-crawl-32x32-tiles) (32×32, dominio público) en `assets/`; las animaciones del jefe Bucle son del pack "Boss Rugby" creado en Claude Design; jugador, equipo e ítems siguen siendo pixel art generado por código (el sistema de equipo visible por capas depende de eso).

**Música:** "Crawling Danger" de samuelfjohanns ([Pixabay](https://pixabay.com/music/), licencia de contenido Pixabay — uso libre). Sonidos 100% sintetizados por código.

**Cómo jugar:** abrir `index.html` en el navegador (doble clic alcanza), o
servirlo (`python3 -m http.server 8417`) y abrirlo desde el iPhone en la misma
red — tiene controles táctiles.

**Controles:** WASD mover · ratón apuntar · clic atacar · Espacio dash ·
Q poción · E interactuar · I inventario · Esc pausa.

## Qué tiene hoy

- 3 clases (Guerrero, Arquero, Mago) con 2 tipos de arma exclusivos cada una
  (espada/martillo, arco/ballesta, bastón/varita).
- Equipo de 6 slots visible sobre el personaje, materiales (Madera→Adamantio)
  + rarezas con mods, tooltips comparativos con veredicto ▲/▼.
- XP con orbes magnéticos, niveles con elección de mejora (1 de 3).
- Dash invulnerable, pociones (Q), mercader entre zonas.
- 3 zonas × (2 pisos + jefe) procedurales; jefes con patrones y segunda fase
  furiosa. Bucle, el rugbier maldito, patea su pelota y queda vulnerable al
  ir a buscarla; su tackle te deja en el piso.
- Élites con aura, cofre dorado con llave, altar de sacrificio, eventos de
  piso (oscuro/embrujado), récords persistentes, audio 100% sintetizado.

## Decisiones de diseño

- **Género:** dungeon crawler roguelike, combate en tiempo real (estilo Binding of Isaac / Hades 2D).
- **Ambientación:** fantasía medieval (catacumbas, cavernas, santuario profano).
- **Stack:** HTML5 Canvas + JavaScript vanilla, sin dependencias. Pixel art generado por código.
- **Clases:** Guerrero (melee), Arquero (a distancia), Mago (proyectiles mágicos con área). Cada arma es exclusiva de su clase.
- **Equipamiento:** 6 slots — arma, casco/capucha, coraza, botas, anillo, amuleto. El **material** define el stat base (Madera → Hierro → Acero → Plata → Mitrilo → Adamantio, escala con la profundidad) y la **rareza** (común/mágico/raro/épico) cuántos mods extra trae. El equipo se ve sobre el personaje, teñido por rareza, y el inventario replica el cuerpo (paper-doll).
- **Loot:** ítems tirados en el piso, en cofres y soltados por criaturas al morir.
- **Generación procedural:** cada run genera mazmorras nuevas.
- **Arquitectura data-driven y expandible** (`js/data.js`):
  - Zonas definidas como datos (paleta, pool de enemigos, jefe, parámetros). Agregar una zona nueva = agregar configuración, no tocar el motor.
  - Enemigos, armas e ítems como registros con stats que referencian comportamientos reutilizables (perseguidor, tirador, errático, jefe con patrones).
- **Alcance inicial:** 3 zonas × (2 pisos + jefe), 9 tipos de enemigos + 3 jefes.

## Metodología de trabajo (aprendida del transcript de referencia)

- Iterar en pasos chicos y verificables; dejar que los errores se corrijan con feedback concreto.
- Paralelizar tareas independientes, pero evitar que dos tareas toquen lo mismo a la vez.
- Mantener el contexto limpio: tareas terminadas se cierran, tareas nuevas arrancan frescas.
- Todo data-driven para que expandir contenido sea barato.
