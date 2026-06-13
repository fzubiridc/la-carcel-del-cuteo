# La Cárcel del Cuteo — Sistema de staffs y assets mágicos

> Diseño acordado (sesión con ChatGPT, 11-jun-2026). Referencia canónica para
> implementar los tiers de staff del mago. **Próximo objetivo inmediato: la
> implementación visual de las tiers de la staff.**

## 1. Decisión general

Las armas de mago se manejan de forma ordenada y escalable. Regla base:

```txt
Tipo de arma = gameplay
Tier = progresión visual y poder base
Elemento / escuela = identidad visual y mecánica
Rareza = stats / tooltip / nombre
Glow / partículas = efectos animados u overlays
Hover = UI, no sprite del arma
```

Esto evita generar variantes innecesarias.
- NO se quiere: `staff_ice_t4_epic_hover_charged.png`
- Correcto: `staff_ice_t4.png` + `tooltip_rare_border` + `slot_hover_overlay` + `cast_ice_effect`

## 2. Regla de rareza

La rareza **NO modifica visualmente el sprite del arma**. Solo aparece en:
- color del nombre en el tooltip
- borde del tooltip
- texto de stats
- cantidad/calidad de modificadores
- posible ícono o marcador pequeño en la UI

La rareza NO cambia: sprite, color base, glow, forma ni partículas del arma.

## 3. Estructura definitiva de staffs

```txt
1 staff básica neutral
+ 3 líneas elementales (Arcane / Fire / Ice)
× 6 tiers cada una
= 19 sprites base
```

| Categoría | Cantidad |
|---|---:|
| Staff básica neutral | 1 |
| Arcane Staff T1–T6 | 6 |
| Fire Staff T1–T6 | 6 |
| Ice Staff T1–T6 | 6 |
| **Total** | **19 sprites** |

## 4. Staff básica (`staff_basic.png`)

Arma inicial del mago, sin escuela elemental fuerte. Madera simple, cristal/piedra
apagada, casi sin metal, sin color dominante, sin runas fuertes, sin efectos
(lectura humilde / aprendiz). Gameplay: daño básico, sin efecto elemental.

## 5. Líneas principales

### 5.1 Arcane — balance (violeta y dorado envejecido)
Daño medio/alto, área media, sin burn ni freeze. Magia pura y consistente.
Archivos: `staff_arcane_t1.png` … `staff_arcane_t6.png`

### 5.2 Fire — daño (brasa, madera quemada, metal ennegrecido, cristal rojo/naranja)
Mayor daño bruto, burn / daño en el tiempo, menos control, más agresiva.
Archivos: `staff_fire_t1.png` … `staff_fire_t6.png`

### 5.3 Ice — control (cristal azul, plata/acero pálido, formas frías y filosas)
Menor daño que Fire, slow, freeze breve en enemigos normales, más defensiva.
Archivos: `staff_ice_t1.png` … `staff_ice_t6.png`

## 6. Tabla madre de progresión (nombres)

| Nivel | Arcane | Fire | Ice |
|---|---|---|---|
| Basic | — (Vara neutral inicial) | — | — |
| T1 | Vara Arcana Inicial | Vara de Brasa | Vara de Escarcha |
| T2 | Bastón Arcano Tallado | Bastón de Carbón | Bastón Gélido |
| T3 | Báculo Arcano | Báculo Ígneo | Báculo Glacial |
| T4 | Báculo de Runas | Báculo de Ceniza | Báculo de Hielo Rúnico |
| T5 | Cetro del Velo | Cetro de la Llama | Cetro del Invierno |
| T6 | Reliquia de Éter | Reliquia del Sol Negro | Reliquia del Frío Eterno |

## 7. Progresión visual por tier

| Tier | Madera | Metal | Cristal | Ornamento | Lectura |
|---|---|---|---|---|---|
| Basic | Simple, torcida | Casi nada | Apagado | Ninguno | Humilde |
| T1 | Simple intencional | Poco bronce/plata | Chico, color leve | Muy bajo | Elemental inicial |
| T2 | Más tallada | Bandas metálicas | Más limpio | Bajo | Mejor fabricada |
| T3 | Oscura/pulida | Dorado/bronce/plata | Mediano protagonista | Medio | Staff mágica real |
| T4 | Noble, runas leves | Más estructural | Grande | Medio-alto | Poder avanzado |
| T5 | Premium | Metal trabajado | Grande + gemas menores | Alto | Masterwork |
| T6 | Ancestral | Metal legendario | Dominante | Muy alto | Reliquia |

## 8. Variables de progresión para PixelLab (0–6)

**Intensidad:** wood_refinement, gold_ornamentation, headpiece_complexity,
crystal_size, crystal_brightness, rune_visibility, secondary_gems, arcane_residue,
silhouette_prestige.

**Forma:** headpiece_evolution, crystal_mount_style, floating_core_presence,
silhouette_uniqueness.

Interpretación mount_style: 1/6 = cristal montado simple · 3/6 = sostenido por
estructura refinada · 6/6 = cristal/esfera flotando dentro de estructura completa.

## 9. Evolución morfológica de la Arcane Staff

No evoluciona solo por oro/brillo, también en **forma**:
- T1: punta simple, cristal incrustado, silueta humilde
- T2: cabeza más trabajada, cristal mejor montado, simple
- T3: headpiece simétrico claro, cristal protagonista, primera refinada
- T4: estructura superior elaborada, empieza marco arcano, cristal mayormente montado
- T5: estructura parcialmente envolvente, más gemas/runas, núcleo central importante
- T6: forma culminante, estructura circular, la punta rodea la esfera, esfera flota
  en el centro, silueta legendaria única y ancestral

## 10. Tabla de parámetros — Arcane Staff

| Tier | Gold | Bright | Runes | Residue | HeadEvo | Mount | Float | Unique |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| T1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 1 |
| T2 | 2 | 2 | 1 | 0 | 2 | 2 | 0 | 2 |
| T3 | 3 | 3 | 2 | 1 | 3 | 3 | 0 | 3 |
| T4 | 4 | 4 | 3 | 1 | 4 | 4 | 1 | 4 |
| T5 | 5 | 5 | 4 | 2 | 5 | 5 | 2 | 5 |
| T6 | 6 | 6 | 5 | 2 | 6 | 6 | 6 | 6 |

## 11. Prompt BASE — Arcane Staff

```text
Create a single 2D pixel art mage staff for a medieval fantasy dungeon crawler RPG, top-down inventory style, one direction, transparent background.
Design the BASE IDENTITY of an Arcane Staff weapon family.
Core identity:
- dark wooden shaft
- elegant arcane fantasy craftsmanship
- refined gold metal accents
- a purple arcane crystal as the main focal point at the top
- symmetrical magical headpiece
- dark fantasy medieval style
- polished pixel art
- readable silhouette
- vertical centered composition
- suitable for a 128x128 inventory asset
Important:
This is the BASE DESIGN of the arcane staff family.
Keep the identity clean, consistent, and reusable for future tier variations.
Future tiers must feel like evolutions of this same weapon family.
Do not make it overly legendary yet.
Do not add excessive magical effects.
No character, no UI, no text, no environment, no background.
Focus on:
- clean silhouette
- clear hierarchy of materials
- elegant arcane look
- strong readability
```

## 12–17. Prompts modificativos por tier (Arcane T1–T6)

Cada tier usa el preámbulo "Using the established BASE Arcane Staff design, keep the
same weapon family / core identity / crystal placement / structure / visual language.
Do not redesign / change type / change color identity / replace materials." y luego
ajusta SOLO las variables de la tabla §10 (más wood_refinement, crystal_size,
headpiece_complexity = nº de tier, silhouette_prestige = nº de tier).

Interpretaciones clave por tier:
- **T1**: primera elemental, humilde, aprendiz, cristal básico montado, sin floating core.
- **T2**: upgrade crafteado, más intencional, shaft más limpio, cristal mejor integrado.
- **T3**: primera realmente refinada, headpiece simétrico, residue estático sutil OK.
- **T4**: avanzada/ceremonial, headpiece empieza a "enmarcar", cristal apenas suspendido.
- **T5**: mastercrafted, headpiece muy evolucionado, estructura empieza a rodear el cristal.
- **T6**: legendaria final, corona arcana circular, esfera FLOTA en el centro rodeada
  por el headpiece, núcleo estable/ancestral, silueta única endgame (sigue legible 2D).

(Los prompts completos T1–T6 están en el doc original del usuario; replicar el patrón
para Fire e Ice cambiando la identidad de color/material y la mecánica.)

## 18. Estructura de carpetas

```txt
assets/items/weapons/staffs/
  staff_basic.png
  arcane/  staff_arcane_t1..t6.png
  fire/    staff_fire_t1..t6.png
  ice/     staff_ice_t1..t6.png
```

## 19. Decisión final

```txt
19 sprites base de staff (1 básica + 6 arcane + 6 fire + 6 ice).
El tier cambia el dibujo.
El elemento cambia identidad visual y mecánica.
La rareza solo vive en tooltip/stats/nombre/borde del tooltip.
Los efectos mágicos son animaciones u overlays separados.
El hover pertenece a la UI, no al arma.
```

---

## Notas de integración (pendiente — próximo objetivo)

Para cablear esto al juego (sistema de armas actual en `js/data.js` WEAPON_TYPES +
`js/items.js` makeItem):
- El mago hoy tiene weaponTypes propios; habrá que modelar **tipo (Arcane/Fire/Ice)
  × tier (1–6) + básica**, con el sprite elegido por `staff_<elem>_t<n>.png`.
- La rareza sigue siendo independiente (solo nombre/mods/borde, sin tocar el sprite).
- Los íconos de inventario ya se dibujan por código (`itemIcon`); habrá que cargar
  los PNG de staff y mapearlos por elemento+tier.
- Mecánicas por elemento (burn/slow/freeze) son trabajo de gameplay aparte del arte.
