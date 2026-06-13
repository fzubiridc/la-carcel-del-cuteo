# Pixi migration checklist

Estado: `?pixi` ya usa WebGL para mapa, entidades basicas, mobs animados, proyectiles, particulas simples, Archimago V2 y staff rig.

## Bugs primero

- Revisar "rata pega a rango": `ENEMIES.rata` sigue siendo `ai: 'chaser'`, asi que no deberia disparar. Confirmar si es hitbox/contacto, animacion Pixi desalineada o feedback visual.
- Comparar Canvas vs Pixi en el primer piso: no deben aparecer cambios de textura despues de entrar a jugar.
- Probar cambio de piso en Pixi: la cache de tiles debe reconstruirse sin flicker ni textura vieja.

## Carga y assets

- La loading screen debe esperar Archimago, staff rig y texturas criticas de mundo.
- Agregar indicador de error con lista corta de assets faltantes si una textura no carga.
- Evitar que assets opcionales bloqueen el inicio, pero que los criticos no permitan fallback silencioso.

## Render Pixi pendiente

- Migrar antorchas animadas y luces con una capa dedicada.
- Migrar oscuridad/vignette de pisos `oscuro`.
- Revisar paridad visual de pickups complejos: items con icono real, llamas XP, monedas y brillos ya tienen ruta Pixi.
- Revisar paridad visual de cofres animados con frames correctos.
- Migrar mercader, altar y decoracion especial.
- Migrar FX complejos: polvo, rings, explosion de poder y textos flotantes.
- Migrar minimapa o dejarlo explicitamente en Canvas si no afecta performance.

## Enemigos

- Revisar paridad visual de los sprites animados de `mob.js` en Pixi vs Canvas.
- Alinear pies/sombra/hitbox por tipo de enemigo si alguno se ve flotando o pegando raro.
- Verificar animaciones de ataque para chaser, erratic y shooter.
- Separar visualmente proyectiles enemigos de golpes de contacto.

## Performance

- Mantener `Pixi tiles: 1` en debug.
- Reducir `Graphics` por frame para sombras, barras y particulas.
- Medir FPS con muchos enemigos/proyectiles en PC.
- Agregar una prueba manual repetible: piso 1, boss debug, cambio de piso, combate con 20+ mobs.

## Paridad Canvas

- Comparar screenshots Canvas vs Pixi del mismo estado.
- Mantener Canvas como fallback hasta que Pixi cubra luces, FX y mobs animados.
- Cuando Pixi este estable, decidir si `?pixi` pasa a default.
