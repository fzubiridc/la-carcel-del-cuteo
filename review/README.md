# Review

Material retirado del runtime principal.

## Carpetas

- `legacy-assets/`: assets viejos o packs fuente. No se borran para poder revisarlos.
- `legacy-code/`: renderers y codigo viejo que ya no carga `index.html`.
- `legacy-tools/`: herramientas HTML usadas durante pruebas de rig/staff.
- `generated-artifacts/`: salidas visuales sueltas de pruebas, guardadas para referencia.

El juego no deberia cargar nada desde `review/`. Si algo de aca vuelve a usarse,
moverlo de nuevo a `assets/`, `js/` o una carpeta de herramientas activa y actualizar
las rutas correspondientes.
