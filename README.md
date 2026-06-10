# Cripta Olvidada — Roguelike RPG 2D

Action roguelike 2D de fantasía medieval: dungeon crawler con mazmorras procedurales y combate en tiempo real sobre el mapa.

**Cómo jugar:** abrir `index.html` en el navegador (doble clic alcanza).

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
