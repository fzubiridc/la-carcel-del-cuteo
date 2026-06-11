# Pedido al diseñador — HUD nuevo · La Cárcel del Cuteo

Basado en el **mockup de referencia aprobado por el usuario** (barras horizontales
tipo cápsula de piedra + marco de pantalla completo, NO orbes). Pixel art, **assets
en CAPAS** para que el motor recorte el relleno dinámicamente (no entregar barras
"llenas" fijas). Mismo espíritu que la barra de jefes ya integrada (marco PNG +
fill aparte, 9-slice). Todo PNG con **transparencia real (alpha)**, fondo
transparente, pixel art nítido (sin anti-aliasing borroso), cada pieza su archivo.

**Resolución de referencia del mockup: 1920×1080.** Las posiciones/tamaños abajo
son de ese mockup; en el juego se anclan a las esquinas (es responsive), pero las
**proporciones** y los tamaños relativos importan.

---

## PROMPT (pegar al agente de diseño)

> Necesito el set de HUD en pixel art para un action-roguelike de fantasía oscura
> (cripta / torre de magos: piedra húmeda, madera vieja, metal forjado, magia
> arcana). Paleta sombría y fría con acentos cálidos de lava y fríos de maná.
> Tipografía de referencia para los títulos (NO la generes, es para que combine el
> espacio y los herrajes): **Cinzel / Marcellus** (serif romana tallada) para
> "NIVEL / MANÁ", **Inter / Noto Sans** para texto chico.
>
> Entregá cada elemento como **piezas separadas, en capas**, para que mi motor
> componga y recorte el relleno según el porcentaje actual. NO entregues barras ya
> rellenas. Fondo transparente en todas.
>
> ### 1) MARCO DE PANTALLA COMPLETA (border ornamentado, 9-slice)
> - Borde decorativo que enmarca toda la vista de juego: **piedra labrada + vigas
>   de madera**, con **herrajes/escuadras metálicas en las cuatro esquinas**.
>   Interior totalmente transparente (se ve el juego a través). Pensado para
>   **9-slice** (bordes y esquinas se escalan sin deformarse). Canvas grande, p.ej.
>   1920×1080 con el centro vacío; o entregá las 9 piezas (4 esquinas, 4 lados, el
>   centro transparente) por separado si te resulta más limpio.
>
> ### 2) BARRA VITAL — cápsula horizontal (abajo-izquierda, ~420×100 en mockup)
> - **2a. Marco/cápsula** — cápsula horizontal de **piedra gris** con herrajes en
>   las puntas y **ventana interior totalmente transparente** (el relleno se ve a
>   través). Pensada para 9-slice horizontal. Canvas 420×100.
> - **2b. Relleno de lava ("Rojo Sangre")** — textura llena al 100% de lava
>   roja-anaranjada con vetas y brillo, que se vea viva. Debe tolerar **recorte por
>   ancho** (de izquierda a derecha, mi motor baja el nivel según la vida) y también
>   leerse bien tileada/desplazada. Mismo alto que la ventana. Canvas 420×100.
> - **2c. Fondo vacío (opcional)** — interior oscuro/apagado de la cápsula sin
>   relleno, para ver detrás cuando la vida está baja. 420×100.
>
> ### 3) BARRA DE MANÁ — cápsula horizontal (abajo-derecha, ~420×100), gemela de la vital
> - **3a. Marco/cápsula** — mismo formato que 2a, con **filigrana dorada** en las
>   esquinas para diferenciarla (acento mágico). Puede ser espejada. 420×100.
> - **3b. Relleno "Azul Místico"** — líquido/energía **azul cósmico** (azul profundo
>   con destellos de estrellas y brillo arcano violáceo). Mismas reglas de recorte
>   horizontal que la lava. 420×100.
> - **3c. Fondo vacío (opcional)** — igual que 2c. 420×100.
>
> ### 4) BARRA DE EXPERIENCIA — cadena fina (centro inferior, ~1000×15 en mockup)
> - **4a. Riel/marco** — barra horizontal **fina y larga** con **eslabones de cadena
>   metálica** y herrajes dorados en las puntas, **ventana interior transparente**.
>   Apaisada y bajita. Canvas 1000×40 (con la ventana centrada vertical).
> - **4b. Relleno de XP** — textura **dorada brillante** (eslabones/energía) que
>   llena el riel, para **recortarse por ancho** según el progreso. 1000×40.
>
> ### 5) RUNAS DE ESTADO — iconos circulares individuales 32×32
> - Set de **6 runas** circulares de 32×32 (en el mockup se ven 4: león dorado,
>   calavera verde goteante, escudo azul con glifos, hacha roja doble). Cada una:
>   un **anillo de piedra/metal** + un **glifo central claro y legible a tamaño
>   chico**. Mapear a buffs del juego:
>   - **Vigor** (vida) → león dorado
>   - **Veneno/Defensa** → calavera verde *(o reasigná a gusto)*
>   - **Defensa** → escudo azul con runas
>   - **Fuerza/Daño** → hacha roja doble
>   - **Velocidad** → algo veloz (lobo/ala) — diseñá uno coherente
>   - **Crítico** → ojo/víbora — diseñá uno coherente
>   Fondo transparente, una imagen por runa.
>
> ### Requisitos técnicos (importante)
> - PNG con alpha. La sombra va DENTRO de la pieza, no pegada al borde del canvas.
> - **Marcos** se escalan por 9-slice sin estirar; **rellenos** los recorto yo, así
>   que su contenido debe tolerar recorte (horizontal en barras y XP).
> - Pixel art consistente con sprites de ~64px y la barra de jefes existente.
> - Cada pieza un archivo, nombrados claro: `screen_frame`, `bar_hp_frame`,
>   `bar_hp_fill`, `bar_hp_empty`, `bar_mana_frame`, `bar_mana_fill`,
>   `bar_mana_empty`, `xp_frame`, `xp_fill`, `rune_vigor`, `rune_defensa`, etc.

---

## Notas de integración (para Claude, al recibir los assets)

- **Marco de pantalla**: `border-image` 9-slice sobre un contenedor full-screen, o
  4 esquinas + 4 lados posicionados. Centro `pointer-events:none`.
- **Barras vital/maná**: marco vía 9-slice horizontal (como `BOSS_FRAMES` en
  ui.js); el fill es un div con `width:%` y `background` recortado/clip. Componer
  empty → fill(clip width) → frame. Ancladas a las esquinas inferiores.
- **XP**: clip horizontal por `% = xp/xpNext`. Reemplaza `#xpbar/#xpfill`.
- **Runas**: render condicional según buffs activos; fila sobre la barra vital.
- **Tipografía**: cargar **Cinzel** (o Marcellus) como webfont para "NIVEL N" y
  "MANÁ x/y"; Inter/Noto Sans para texto chico. (Las genera el motor, no el
  diseñador.)
- **Maná**: el orbe/barra azul aparece en la referencia y el HUD lo necesita. HOY
  el cast del mago NO cuesta maná → decidir mecánica aparte (ver V2_BACKLOG
  "Sistema de maná"): ¿consume al castear?, ¿regenera con el tiempo / al matar?
- Carpeta destino: `assets/ui/hud/`.
