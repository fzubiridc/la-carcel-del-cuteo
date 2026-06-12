// =====================================================================
// data.js — TODO el contenido del juego es data.
// Agregar zonas, enemigos, jefes o ítems = editar este archivo.
// =====================================================================

const TILE = 16;

// ---------- Clases jugables ----------
const CLASSES = {
  guerrero: {
    id: 'guerrero', name: 'Guerrero', sprite: 'guerrero',
    desc: 'Resistente y letal de cerca. Aguanta lo que sea.',
    hp: 130, spd: 90, def: 4, crit: 5, dmgMul: 1.0, weapon: 'espada',
  },
  arquero: {
    id: 'arquero', name: 'Arquero', sprite: 'arquero',
    desc: 'Rápido y certero. Castiga desde lejos con flechas.',
    hp: 90, spd: 112, def: 1, crit: 15, dmgMul: 1.0, weapon: 'arco',
  },
  mago: {
    id: 'mago', name: 'Mago', sprite: 'mago',
    desc: 'Frágil pero devastador. Sus proyectiles explotan en área.',
    hp: 75, spd: 100, def: 0, crit: 8, dmgMul: 1.25, weapon: 'baston',
  },
};

// ---------- Armas: el estilo de ataque lo define el arma equipada ----------
// baseRot: corrección para que el icono apunte hacia donde mira el jugador al dibujarlo en mano
// cls: cada arma solo puede ser usada por su clase
const WEAPON_TYPES = {
  espada:   { name: 'Espada',   cls: 'guerrero', dmg: 14, cd: 0.42, style: 'melee', range: 30, icon: 'espada', baseRot: Math.PI / 4 },
  martillo: { name: 'Martillo', cls: 'guerrero', dmg: 24, cd: 0.85, style: 'smash', range: 30, icon: 'martillo', baseRot: Math.PI / 4 },
  arco:     { name: 'Arco',     cls: 'arquero',  dmg: 10, cd: 0.50, style: 'arrow', projSpd: 300, icon: 'arco', baseRot: 0 },
  ballesta: { name: 'Ballesta', cls: 'arquero',  dmg: 15, cd: 0.78, style: 'arrow', projSpd: 350, pierce: 2, icon: 'ballesta', baseRot: 0 },
  baston:   { name: 'Bastón',   cls: 'mago',     dmg: 15, cd: 0.70, style: 'bolt',  projSpd: 190, splash: 18, projSize: 12, projRange: 128, manaCost: 22, icon: 'baston', baseRot: Math.PI / 2 },
  varita:   { name: 'Varita',   cls: 'mago',     dmg: 7,  cd: 0.26, style: 'bolt',  projSpd: 270, splash: 0, projSize: 8, projRange: 105, manaCost: 9, icon: 'varita', baseRot: Math.PI / 4 },
  // ataque desarmado del mago: chispa arcana muy débil, sin maná (al quedarte sin staff)
  chispa:   { name: 'Chispa arcana', cls: 'mago', dmg: 4, cd: 0.42, style: 'bolt', projSpd: 220, splash: 0, projSize: 4, projRange: 78, manaCost: 0, icon: 'varita', baseRot: Math.PI / 4, unarmed: true },
};

// Materiales: escalera ordenada de calidad. El material define el stat base
// del ítem; la profundidad empuja qué materiales aparecen.
const MATERIALS = [
  { id: 'madera',    name: 'Madera',    mult: 0.8 },
  { id: 'hierro',    name: 'Hierro',    mult: 1.0 },
  { id: 'acero',     name: 'Acero',     mult: 1.3 },
  { id: 'plata',     name: 'Plata',     mult: 1.6 },
  { id: 'mitrilo',   name: 'Mitrilo',   mult: 2.0 },
  { id: 'adamantio', name: 'Adamantio', mult: 2.5 },
];

// ---------- Rarezas ----------
const RARITIES = [
  { id: 'comun',  name: 'Común',  color: '#9aa0a6', mods: 0, mult: 1.0,  w: 50 },
  { id: 'magico', name: 'Mágico', color: '#4f9dff', mods: 1, mult: 1.18, w: 30 },
  { id: 'raro',   name: 'Raro',   color: '#ffd84f', mods: 2, mult: 1.38, w: 15 },
  { id: 'epico',  name: 'Épico',  color: '#c45cff', mods: 3, mult: 1.65, w: 5 },
];

// Colores con los que se pinta el equipo SOBRE el personaje, según rareza
const RARITY_TINTS = {
  comun:  { P: '#8e949c', S: '#62666d' },
  magico: { P: '#5aa7e8', S: '#39689a' },
  raro:   { P: '#e0b83f', S: '#9c7c28' },
  epico:  { P: '#b06ae8', S: '#7a3fa8' },
};

// ---------- Slots de equipo y bases de armadura ----------
// 10 slots de equipo (los 6 clásicos + 4 nuevos del inventario v2). Los nuevos
// todavía NO dropean (makeItem no los genera): quedan listos para activar luego.
const SLOTS = ['arma', 'casco', 'coraza', 'botas', 'anillo', 'amuleto', 'foco', 'guantes', 'cinturon', 'anillo2'];
const SLOT_LABELS = { arma:'Arma', casco:'Cabeza', coraza:'Torso', botas:'Pies', anillo:'Anillo', amuleto:'Amuleto',
  foco:'Foco', guantes:'Guantes', cinturon:'Cinturón', anillo2:'Anillo' };

const ARMOR_BASES = {
  casco:   [ { name: 'Capucha', def: 1 }, { name: 'Yelmo', def: 2 } ],
  coraza:  [ { name: 'Túnica', def: 2 }, { name: 'Coraza', def: 3 } ],
  botas:   [ { name: 'Botas', def: 1, spd: 5 } ],
  anillo:  [ { name: 'Anillo', def: 0, dmg: 2 } ],   // los anillos dan daño base según material
  amuleto: [ { name: 'Amuleto', def: 0, hp: 8 } ],   // los amuletos dan vida base según material
  foco:    [ { name: 'Orbe', def: 0, dmg: 3 } ],     // foco arcano: daño mágico
  guantes: [ { name: 'Guantes', def: 1 } ],
  cinturon:[ { name: 'Faja', def: 1, hp: 6 } ],
};

// Sufijos: cada mod posible da nombre al ítem ("Yelmo del Oso")
const MODS = [
  { key: 'dmg',    label: 'Daño',          suffix: 'del Titán',    base: 3 },
  { key: 'def',    label: 'Defensa',       suffix: 'del Bastión',  base: 2 },
  { key: 'hp',     label: 'Vida máx.',     suffix: 'del Oso',      base: 14 },
  { key: 'spd',    label: 'Velocidad',     suffix: 'del Lobo',     base: 7 },
  { key: 'crit',   label: 'Crítico %',     suffix: 'de la Víbora', base: 5 },
  { key: 'atkspd', label: 'Vel. ataque %', suffix: 'del Halcón',   base: 9 },
];

// ---------- Enemigos ----------
// ai: 'chaser' persigue · 'shooter' dispara a distancia · 'erratic' persigue zigzagueando · 'boss' usa patterns
const ENEMIES = {
  rata:        { name: 'Rata',              sprite: 'rata',       hp: 14,  dmg: 6,  spd: 78,  ai: 'chaser',  size: 7, scale: 0.34, skel: true, skelSet: 'rata' },
  slime:       { name: 'Slime',             sprite: 'rata',       hp: 26,  dmg: 8,  spd: 46,  ai: 'chaser',  size: 12, scale: 1, slime: true, slimeSet: 'slime' },
  lich:        { name: 'Liche menor',       sprite: 'rata',       hp: 36,  dmg: 11, spd: 44,  ai: 'shooter', size: 12, scale: 1, range: 150, fireCd: 1.8, projSpd: 150, projColor: '#3fe0e0', projStyle: 'fire', slime: true, slimeSet: 'lich' },
  fantasma:    { name: 'Fantasma',          sprite: 'rata',       hp: 18,  dmg: 15, spd: 70,  ai: 'erratic', size: 11, scale: 1, slime: true, slimeSet: 'ghost', ghost: true },
  zombi:       { name: 'Zombi',             sprite: 'rata',       hp: 40,  dmg: 12, spd: 38,  ai: 'chaser',  size: 12, scale: 1, slime: true, slimeSet: 'zombie' },
  orco:        { name: 'Orco',              sprite: 'rata',       hp: 36,  dmg: 11, spd: 52,  ai: 'chaser',  size: 13, scale: 1, slime: true, slimeSet: 'orc' },
  esqueleto:   { name: 'Esqueleto',         sprite: 'esqueleto',  hp: 30,  dmg: 10, spd: 52,  ai: 'chaser',  size: 11, skel: true },
  esqueleto_espada: { name: 'Esqueleto armado', sprite: 'esqueleto', hp: 44, dmg: 14, spd: 56, ai: 'chaser', size: 11, skel: true, skelSet: 'skeleton_espada' },
  // TODO: el esqueleto arquero tendrá su propio sprite/animaciones (PixelLab) más
  // adelante. Hasta entonces NO se spawnea (lo quitamos de las listas de zona).
  arquero_esq: { name: 'Esqueleto arquero', sprite: 'arquero_esq',hp: 22,  dmg: 8,  spd: 44,  ai: 'shooter', size: 11, range: 150, fireCd: 1.7, projSpd: 130 },
  murcielago:  { name: 'Murciélago',        sprite: 'murcielago', hp: 12,  dmg: 5,  spd: 115, ai: 'erratic', size: 9 },
  arana:       { name: 'Araña',             sprite: 'arana',      hp: 24,  dmg: 9,  spd: 88,  ai: 'erratic', size: 10 },
  golem_chico: { name: 'Gólem menor',       sprite: 'golem',      hp: 65,  dmg: 16, spd: 34,  ai: 'chaser',  size: 13 },
  espectro:    { name: 'Espectro',          sprite: 'espectro',   hp: 35,  dmg: 12, spd: 72,  ai: 'erratic', size: 11, ghost: true },
  cultista:    { name: 'Cultista',          sprite: 'cultista',   hp: 30,  dmg: 10, spd: 50,  ai: 'shooter', size: 11, range: 160, fireCd: 1.5, projSpd: 150 },
  caballero:   { name: 'Caballero maldito', sprite: 'caballero',  hp: 85,  dmg: 18, spd: 48,  ai: 'chaser',  size: 12 },
};

// Jefes: patterns rotan en ciclo. 'chase' embiste, 'burst' anillo de proyectiles,
// 'spread' ráfagas apuntadas, 'charge' carga telegrafiada, 'summon' invoca esbirros.
const BOSSES = {
  // Bucle: jugador de rugby maldito. Embestida (tackle) que te deja en el piso
  // (stunOnCharge), y su ataque a rango es patear SU pelota (kickball): donde
  // cae tiene que ir a buscarla, y mientras tanto recibe daño extra (punto débil).
  // anims: usa el pack de sprite sheets "boss_rugby" (idle/run/tackle/kick/defeat)
  bucle: { name: 'Bucle', sprite: 'bucle', spriteNoBall: 'bucle_sinpelota',
    anims: 'bucle',
    hp: 380, dmg: 16, spd: 62, size: 16, scale: 1.3,
    patterns: ['charge', 'chase', 'kickball', 'charge'],
    stunOnCharge: 1, arenaDecor: 'rugby', kicksBall: true },
  // projRange: alcance máximo de sus proyectiles en px (nada es infinito)
  golem_anciano: { name: 'Gólem Anciano', sprite: 'golem_anciano', hp: 550, dmg: 24, spd: 32,
    size: 18, scale: 2, patterns: ['chase', 'charge', 'burst'], projSpd: 110, projRange: 150 },
  liche:         { name: 'El Liche',      sprite: 'liche',         hp: 650, dmg: 20, spd: 60,
    size: 16, scale: 2, patterns: ['spread', 'summon', 'burst', 'charge'], projSpd: 160, projRange: 190, minion: 'espectro' },
};

// ---------- Zonas (el orden define la progresión de la run) ----------
const ZONES = [
  {
    id: 'torre', name: 'Torre en Ruinas', floors: 2,
    palette: { floor: '#3a3a40', floorAlt: '#343438', wall: '#5a5a62', wallDark: '#3e3e46', accent: '#6e7d6a' },
    enemies: ['rata', 'slime', 'lich', 'fantasma', 'zombi', 'orco'], // esqueletos PixelLab quitados (muy realistas)
    boss: 'bucle', density: 1.0,
  },
  {
    id: 'cavernas', name: 'Cavernas Hondas', floors: 2,
    palette: { floor: '#2c2420', floorAlt: '#28201c', wall: '#5c4734', wallDark: '#453525', accent: '#c77b3f' },
    enemies: ['murcielago', 'arana', 'orco', 'golem_chico'],
    boss: 'golem_anciano', density: 1.15,
  },
  {
    id: 'santuario', name: 'Santuario Profano', floors: 2,
    palette: { floor: '#262036', floorAlt: '#221c30', wall: '#4c3f66', wallDark: '#392f4e', accent: '#a06bd4' },
    enemies: ['espectro', 'cultista', 'caballero'],
    boss: 'liche', density: 1.25,
  },
];

// ---------- Mejoras de nivel (al subir, elegís 1 de 3 al azar) ----------
const UPGRADES = [
  { id: 'vigor',     name: 'Vigor',          desc: '+20 vida máxima y te cura 20',
    apply: p => { p.bonus.hp += 20; p.hp += 20; } },
  { id: 'fuerza',    name: 'Fuerza',         desc: '+12% de daño',
    apply: p => { p.bonus.dmgMul += 0.12; } },
  { id: 'celeridad', name: 'Celeridad',      desc: '+8 de velocidad de movimiento',
    apply: p => { p.bonus.spd += 8; } },
  { id: 'precision', name: 'Precisión',      desc: '+6% de probabilidad de crítico',
    apply: p => { p.bonus.crit += 6; } },
  { id: 'frenesi',   name: 'Frenesí',        desc: '+10% de velocidad de ataque',
    apply: p => { p.bonus.atkspd += 0.10; } },
  { id: 'piel',      name: 'Piel de hierro', desc: '+3 de defensa',
    apply: p => { p.bonus.def += 3; } },
];

// ---------- Balance global ----------
const BALANCE = {
  depthHpScale: 0.22,    // +hp de enemigos por piso de profundidad
  depthDmgScale: 0.13,   // +daño de enemigos por piso
  depthModScale: 0.16,   // +valor de mods de ítems por piso
  dropItem: 0.13,        // prob. de ítem al matar
  dropCoin: 0.30,        // prob. de moneda
  dropHeart: 0.11,       // prob. de corazón
  dropPotion: 0.10,      // prob. de poción
  heartHeal: 22,
  bagSize: 24,
  maxPotions: 3,
  eliteChance: 0.08,     // prob. de que un spawn sea élite
  playerIfr: 0.6,        // segundos de invulnerabilidad tras recibir daño
  speedMul: 0.62,        // factor global de velocidad de movimiento (jugador + mobs)

  // --- IA de mobs ---
  aggroRadius: 5.5,      // tiles: te ven a esta distancia aunque no estés en su sala
  aggroRadiusOpen: 10,   // tiles: detección de mobs sin sala (arenas, portador de llave)
  wanderSpeed: 0.45,     // fracción de su spd al deambular sin aggro
  wanderHome: 3.5,       // tiles: radio alrededor de su origen donde deambulan
  leashTiles: 11,        // tiles: más lejos que esto de su origen → sueltan y vuelven
  attackPause: 0.45,     // segundos clavado tras un golpe de contacto (recovery)
  shooterWindup: 0.3,    // anticipación clavado antes de disparar (telegrafiada)
  shooterRecover: 0.35,  // recovery clavado después de disparar
};
