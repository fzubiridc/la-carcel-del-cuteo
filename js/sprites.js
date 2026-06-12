// =====================================================================
// sprites.js — pixel art generado por código. Cada sprite es una grilla
// de caracteres + paleta. Agregar un sprite = agregar una grilla.
// =====================================================================

function px(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

function flipH(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.translate(img.width, 0); g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  c.ws = img.ws; // conservar la escala de mundo
  return c;
}

const Sprites = {};

// =====================================================================
// Assets CC0 (Dungeon Crawl Stone Soup, 32x32, dominio público).
// ws = 0.5: el arte de 32px ocupa 16px de mundo → doble resolución.
// Si un archivo falta, queda el sprite generado por código como fallback.
// =====================================================================

const ASSETS = {
  rata: 'assets/rata.png',
  esqueleto: 'assets/esqueleto.png',
  arquero_esq: 'assets/arquero_esq.png',
  murcielago: 'assets/murcielago.png',
  arana: 'assets/arana.png',
  golem: 'assets/golem.png',
  espectro: 'assets/espectro.png',
  cultista: 'assets/cultista.png',
  caballero: 'assets/caballero.png',
  golem_anciano: 'assets/golem_anciano.png',
  liche: 'assets/liche.png',
  floor_catacumbas: 'assets/floor_catacumbas.png',
  wall_catacumbas: 'assets/wall_catacumbas.png',
  floor_cavernas: 'assets/floor_cavernas.png',
  wall_cavernas: 'assets/wall_cavernas.png',
  floor_santuario: 'assets/floor_santuario.png',
  wall_santuario: 'assets/wall_santuario.png',
};

// Sprite sheets animados (pack "Boss Rugby" de Claude Design, frames 40x54)
const SHEET_ASSETS = {
  anim_bucle_idle:   { src: 'assets/boss_rugby/boss_rugby_idle_sheet.png',   fw: 40, fh: 54 },
  anim_bucle_run:    { src: 'assets/boss_rugby/boss_rugby_run_sheet.png',    fw: 40, fh: 54 },
  anim_bucle_tackle: { src: 'assets/boss_rugby/boss_rugby_tackle_sheet.png', fw: 40, fh: 54 },
  anim_bucle_tackle_charge: { src: 'assets/boss_rugby/boss_rugby_tackle_charge_sheet.png', fw: 40, fh: 54 },
  anim_dust:         { src: 'assets/boss_rugby/tackle_dust_sheet.png',       fw: 16, fh: 16 },
  anim_bucle_kick:   { src: 'assets/boss_rugby/boss_rugby_kick_sheet.png',   fw: 40, fh: 54 },
  anim_bucle_defeat: { src: 'assets/boss_rugby/boss_rugby_defeat_sheet.png', fw: 40, fh: 54 },
  anim_pelota:       { src: 'assets/boss_rugby/ball_spin_sheet.png',         fw: 16, fh: 16 },
};

// Timings del pack (ms por frame). loopFrom: el intro se reproduce una vez
// y después se loopean los frames restantes (tackle: windup → carga).
const BOSS_ANIMS = {
  idle:   { times: [650, 650], loop: true },
  run:    { times: [140, 140, 140, 140], loop: true },
  tackle: { times: [180, 120, 120], loopFrom: 1 },
  tackle_charge: { times: [110, 110, 110, 110], loop: true },
  kick:   { times: [250, 120, 150, 150] },
  defeat: { times: [280, 280, 280], hold: true },
};

// Devuelve el índice de frame para un tiempo transcurrido (ms)
function animFrame(def, elapsed) {
  const times = def.times;
  const total = times.reduce((a, b) => a + b, 0);
  let t;
  if (def.loopFrom !== undefined) {
    const intro = times.slice(0, def.loopFrom).reduce((a, b) => a + b, 0);
    t = elapsed < intro ? elapsed : intro + ((elapsed - intro) % (total - intro));
  } else if (def.loop) {
    t = elapsed % total;
  } else {
    t = Math.min(elapsed, total - 1); // sin loop: queda en el último frame
  }
  let acc = 0;
  for (let i = 0; i < times.length; i++) {
    acc += times[i];
    if (t < acc) return i;
  }
  return times.length - 1;
}

function loadAssets(done) {
  const keys = Object.keys(ASSETS);
  const sheetKeys = Object.keys(SHEET_ASSETS);
  let left = keys.length + sheetKeys.length;
  const finish = () => { if (--left === 0 && done) done(); };
  for (const k of keys) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      c.ws = 0.5;
      Sprites[k] = c;
      Sprites[k + '_L'] = flipH(c);
      finish();
    };
    img.onerror = finish;
    img.src = ASSETS[k];
  }
  // sheets: se cortan en frames individuales, con variante espejada
  for (const k of sheetKeys) {
    const def = SHEET_ASSETS[k];
    const img = new Image();
    img.onload = () => {
      const n = Math.floor(img.width / def.fw);
      const frames = [];
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = def.fw; c.height = def.fh;
        c.getContext('2d').drawImage(img, -i * def.fw, 0);
        c.ws = 0.5;
        frames.push(c);
      }
      Sprites[k] = frames;
      Sprites[k + '_L'] = frames.map(flipH);
      finish();
    };
    img.onerror = finish;
    img.src = def.src;
  }
}

function buildSprites() {
  const skin = '#e8b88a', eye = '#1d1d22', bone = '#e6e3d6';

  // ----- Clases jugables: cuerpos base (12x14, misma grilla para las 3) -----
  // filas 0-1: aire para sombreros · 2-6: cabeza · 7-10: torso · 11-13: piernas
  Sprites.guerrero_body = px([
    '............',
    '............',
    '....hhhh....',
    '...hHHhhh...',
    '...ssssss...',
    '...sk.ks....',
    '...ssmmss...',
    '..aAAAAAAa..',
    '.sAAAAAAAAs.',
    '.s.AAAAAA.s.',
    '...uuYYuu...',
    '...Bb..Bb...',
    '...Bb..Bb...',
    '...DD..DD...',
  ], { h:'#6e4528', H:'#8a5a36', s:skin, k:eye, m:'#c89066',
       A:'#929cab', a:'#b4bcc8', u:'#5c3e24', Y:'#c8922a',
       B:'#4a3424', b:'#5c4430', D:'#33241a' });

  Sprites.arquero_body = px([
    '............',
    '............',
    '....hhhh....',
    '...hHHhhh...',
    '...ssssss...',
    '...sk.ks....',
    '...ssmmss...',
    '..gGGGGGGg..',
    '.sGGGGGGGGs.',
    '.s.GGGGGG.s.',
    '...uuYYuu...',
    '...Bb..Bb...',
    '...Bb..Bb...',
    '...DD..DD...',
  ], { h:'#8a5a2b', H:'#a8743c', s:skin, k:eye, m:'#c89066',
       G:'#54803c', g:'#6a9a4c', u:'#5c3e24', Y:'#c8922a',
       B:'#4a3424', b:'#5c4430', D:'#33241a' });

  Sprites.mago_body = px([
    '............',
    '............',
    '....hhhh....',
    '...hHHhhh...',
    '...ssssss...',
    '...sk.ks....',
    '...ssmmss...',
    '..qPPPPPPq..',
    '.sPPPPPPPPs.',
    '.s.PPPPPP.s.',
    '...PPYYPP...',
    '...PPPPPP...',
    '...qPPPPq...',
    '....P..P....',
  ], { h:'#b8b2c8', H:'#d8d2e4', s:skin, k:eye, m:'#c89066',
       P:'#52317c', q:'#6a4496', Y:'#c8922a' });

  // Tocados por defecto (identidad de clase cuando no hay casco equipado)
  Sprites.hat_mago = px([
    '.....qp.....',
    '....qppp....',
    '....pppp....',
    '...ppYppp...',
    '..pppppppp..',
  ], { p:'#6b3fa0', q:'#8a5cc0', Y:'#ffd84f' });

  Sprites.hood_arquero = px([
    '....gggg....',
    '...gGGGGg...',
    '...gGGGGg...',
    '...gg..gg...',
    '...g....g...',
    '...g....g...',
  ], { g:'#3f6b3a', G:'#4f7d48' });

  // ----- Enemigos -----
  Sprites.rata = px([
    '............',
    '......bb...t',
    '.....bbbb.t.',
    '..bbbbbbbbt.',
    '.bbbkbbbbb..',
    '.bbbbbbbb...',
    '..b.b..b.b..',
  ], { b:'#7d6b58', k:'#d04040', t:'#caa58a' });

  Sprites.esqueleto = px([
    '...wwwwww...',
    '..wwwwwwww..',
    '..wkwwwwkw..',
    '..wwwwwwww..',
    '...wwddww...',
    '..wwwwwwww..',
    '.w.wwwwww.w.',
    '.w..wwww..w.',
    '....wwww....',
    '...ww..ww...',
    '...ww..ww...',
  ], { w:bone, k:eye, d:'#8d8a7c' });

  Sprites.arquero_esq = px([
    '...wwwwww..y',
    '..wwwwwwww.y',
    '..wkwwwwkwy.',
    '..wwwwwwwwy.',
    '...wwddww.y.',
    '..wwwwwww.y.',
    '.w.wwwwww.y.',
    '.w..wwww..y.',
    '....wwww...y',
    '...ww..ww...',
    '...ww..ww...',
  ], { w:bone, k:'#d09030', d:'#8d8a7c', y:'#8a6a3a' });

  Sprites.murcielago = px([
    '.b........b.',
    '.bb..bb..bb.',
    '.bbbbbbbbbb.',
    '..bbkbbkbb..',
    '...bbbbbb...',
    '....b..b....',
  ], { b:'#5a4a72', k:'#ff5050' });

  Sprites.arana = px([
    '.l...ll...l.',
    '..l.bbbb.l..',
    '.l.bbbbbb.l.',
    '..lbkbbkbl..',
    '.l.bbbbbb.l.',
    '..l.bbbb.l..',
    '.l...ll...l.',
  ], { b:'#403a30', l:'#2c2620', k:'#ff4040' });

  Sprites.golem = px([
    '..GGGGGG....',
    '..GkGGkG....',
    '..GGGGGG....',
    '.GGGGGGGG...',
    'GGGGGGGGGG..',
    'G.GGGGGG.G..',
    'G.GGGGGG.G..',
    '..GGGGGG....',
    '..GG..GG....',
    '..GG..GG....',
  ], { G:'#7d8a93', k:'#ffb13f' });

  Sprites.espectro = px([
    '...wwwwww...',
    '..wwwwwwww..',
    '..wkwwwwkw..',
    '..wwwwwwww..',
    '..wwwwwwww..',
    '..wwwwwwww..',
    '..wwwwwwww..',
    '..w.ww.w.w..',
    '...w..w..w..',
  ], { w:'#b8d2e4', k:'#3a6ea8' });

  Sprites.cultista = px([
    '....rrrr....',
    '...rrrrrr...',
    '...rddddr...',
    '...rkddkr...',
    '...rddddr...',
    '..rrrrrrrr..',
    '..rrrrrrrr..',
    '...rrrrrr...',
    '...rrrrrr...',
    '....r..r....',
  ], { r:'#7a2e3a', d:'#241420', k:'#ffd84f' });

  Sprites.caballero = px([
    '...AAAAAA...',
    '...AAAAAA...',
    '...AkAAkA...',
    '...AAAAAA...',
    '..AAAAAAAA..',
    '.AAAAAAAAAA.',
    '.A.AAAAAA.A.',
    '.A.AAAAAA.A.',
    '...AAAAAA...',
    '...AA..AA...',
    '...AA..AA...',
  ], { A:'#566070', k:'#ff5050' });

  // ----- Jefes -----
  // Bucle en alta resolución (24x28, ws 0.5): rugbier maldito con casco
  // scrum, remera azul, trébol verde de tres lóbulos sobre el corazón y
  // la pelota bajo el brazo.
  const buclePal = { h:'#3a3a42', H:'#52525e', s:'#d8a878', S:'#b8895e', k:'#ff4040',
    J:'#27418f', j:'#3a57ad', t:'#3fa84f', T:'#5ac86a', o:'#9a5c28', W:'#e8e3d0',
    m:'#a8704a', D:'#202830', B:'#1a1a1a', c:'#e8e3d0' };
  const bucleConPelota = [
    '........hhhhhhhh........',
    '......hhhhhhhhhhhh......',
    '.....hhHHhhhhhhhhhh.....',
    '.....hhHHhhhhhhhhhh.....',
    '.....hhhhhhhhhhhhhh.....',
    '......ssssssssssss......',
    '......ssssssssssss......',
    '......skk.ssss.kks......',
    '......skk.ssss.kks......',
    '......ssssssssssss......',
    '.......ssssmmssss.......',
    '.......sSssssssSs.......',
    '.....JJJjjJJJJjjJJJ.....',
    '....JJJJJJJJJJJJJJJJ....',
    '...sJJJJtt.ttJJJJJJJs...',
    '..oooJJJttttttJJJJJJss..',
    '.oooooJJtTttttJJJJJJ.s..',
    '.ooWooJJJ.tt.JJJJJJJ....',
    '.ooWooJJJJttJJJJJJJJ....',
    '.oooooJJJJJJJJJJJJJJ....',
    '..ooo..JJJJJJJJJJJ......',
    '........DDDDDDDDDD......',
    '........DDDDDDDDDD......',
    '........DDD..DDD........',
    '........sss..sss........',
    '........sss..sss........',
    '........Sss..Sss........',
    '.......BBBB..BBBB.......',
  ];
  Sprites.bucle = px(bucleConPelota, buclePal);
  Sprites.bucle.ws = 0.5;

  // sin la pelota: el brazo libre, listo para correr a buscarla
  Sprites.bucle_sinpelota = px(bucleConPelota.map(r =>
    r.replace(/[oW]/g, '.')), buclePal);
  Sprites.bucle_sinpelota.ws = 0.5;

  // La pelota de rugby: óvalo perfectamente simétrico con tiento centrado
  Sprites.pelota = px([
    '.....oooo.....',
    '...oooooooo...',
    '..oooooooooo..',
    '.ooooWWWWoooo.',
    '.ooooWWWWoooo.',
    '..oooooooooo..',
    '...oooooooo...',
    '.....oooo.....',
  ], { o:'#9a5c28', W:'#e8e3d0' });
  Sprites.pelota.ws = 0.5;

  Sprites.golem_anciano = px([
    '..GGGGGGGG..',
    '..GkkGGkkG..',
    '..GGGGGGGG..',
    '.GGGmGGGGG..',
    'GGGGGGGGGGG.',
    'GGmGGGGGmGG.',
    'G.GGGGGGG.G.',
    'G.GGmGGGG.G.',
    '..GGGGGGG...',
    '..GGG..GG...',
    '..GGG..GG...',
  ], { G:'#6d7a85', k:'#ff7b2f', m:'#5a7d54' });

  Sprites.liche = px([
    '....pppp....',
    '...pppppp...',
    '...pwwwwp...',
    '...wkwwkw...',
    '...wwwwww...',
    '....wddw....',
    '..pppppppp..',
    '..pppppppp..',
    '...pppppp...',
    '...pppppp...',
    '....p..p....',
  ], { p:'#4c2f73', w:bone, k:'#b14fff', d:'#8d8a7c' });

  // El mercader: figura encapuchada con linterna y mochila
  Sprites.mercader = px([
    '....mmmm....',
    '...mmmmmm...',
    '...mddddm...',
    '...mdkdkm...',
    '...mddddm...',
    '..mmmmmmmm..',
    '.ymmmmmmmmp.',
    '.y.mmmmmm.p.',
    '...mmmmmm...',
    '...mmmmmm...',
    '....m..m....',
  ], { m:'#6a5a8a', d:'#241c30', k:'#ffd84f', y:'#ffd84f', p:'#7a5230' });

  // Poción de vida
  Sprites.pocion = px([
    '..gg..',
    '.gggg.',
    '.grrg.',
    '.rRrr.',
    '.rrrr.',
    '..rr..',
  ], { g:'#b8d2e4', r:'#d8403f', R:'#f08a88' });

  // ----- Objetos del mundo -----
  Sprites.cofre = px([
    '.CCCCCCCC.',
    'CcccccccsC',
    'CCCCCCCCCC',
    'CC..yy..CC',
    'CCCCyyCCCC',
    'CCCCCCCCCC',
  ], { C:'#7a5230', c:'#9a6c40', s:'#9a6c40', y:'#ffd84f' });

  // Cofre dorado cerrado con llave
  Sprites.cofre_dorado = px([
    '.YYYYYYYY.',
    'YyyyyyyyyY',
    'YYYYYYYYYY',
    'YY..kk..YY',
    'YYYYkkYYYY',
    'YYYYYYYYYY',
  ], { Y:'#c8922a', y:'#ffd84f', k:'#3a2a10' });

  // Llave del cofre dorado
  Sprites.llave = px([
    'yyy.....',
    'y.yyyyyy',
    'yyy..y.y',
    '.....y.y',
  ], { y:'#ffd84f' });

  // Altar de sacrificio: piedra con gema y vela
  Sprites.altar = px([
    '....ff....',
    '....ww....',
    '.GGGGGGGG.',
    '.GGGRRGGG.',
    '..GGGGGG..',
    '..GGGGGG..',
    '.GGGGGGGG.',
  ], { f:'#ffb13f', w:'#e8e3d0', G:'#6d7a85', R:'#d8403f' });

  Sprites.cofre_abierto = px([
    '.cccccccc.',
    'c........c',
    'CCCCCCCCCC',
    'CC......CC',
    'CCCCCCCCCC',
    'CCCCCCCCCC',
  ], { C:'#5c3e24', c:'#7a5230' });

  Sprites.corazon = px([
    '.rr.rr.',
    'rrrrrrr',
    'rRrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
  ], { r:'#d8403f', R:'#f08a88' });

  Sprites.moneda = px([
    '.yyyy.',
    'yYYyyy',
    'yYyyyy',
    'yyyyyy',
    '.yyyy.',
  ], { y:'#d8a82f', Y:'#ffe48a' });

  // ----- Iconos de ítems (inventario y loot en el piso) -----
  Sprites.icon_espada = px([
    '.......ww.',
    '......www.',
    '.....www..',
    '....www...',
    '...www....',
    '.y.ww.....',
    '..yyy.....',
    '.yByy.....',
    'yy..y.....',
  ], { w:'#cfd6dd', y:'#c8922a', B:'#5c3e24' });

  Sprites.icon_arco = px([
    '...ww.....',
    '..w..w....',
    '.w....w...',
    '.w.ss.w...',
    '.w.ss.w...',
    '.w....w...',
    '..w..w....',
    '...ww.....',
  ], { w:'#8a6a3a', s:'#cfd6dd' });

  Sprites.icon_baston = px([
    '....oo....',
    '...oooo...',
    '...oooo...',
    '....oo....',
    '....bb....',
    '....bb....',
    '....bb....',
    '....bb....',
    '....bb....',
  ], { o:'#7ec8ff', b:'#6b4a2b' });

  Sprites.icon_martillo = px([
    '.wwwww....',
    '.wWWWw....',
    '.wwwww....',
    '...bb.....',
    '....bb....',
    '.....bb...',
    '......bb..',
    '.......bb.',
  ], { w:'#9aa4b0', W:'#c4ccd6', b:'#6b4a2b' });

  Sprites.icon_ballesta = px([
    'w...ss...w',
    '.w..ss..w.',
    '..wwsswW..',
    '....ss....',
    '....bb....',
    '....bb....',
    '....bb....',
  ], { w:'#8a6a3a', W:'#cfd6dd', s:'#cfd6dd', b:'#5c3e24' });

  Sprites.icon_varita = px([
    '.......yy.',
    '......yYy.',
    '.......y..',
    '.....b....',
    '....b.....',
    '...b......',
    '..b.......',
    '.b........',
  ], { y:'#ffd84f', Y:'#fff', b:'#6b4a2b' });

  Sprites.icon_casco = px([
    '...AAAA...',
    '..AAAAAA..',
    '.AAAAAAAA.',
    '.AAAAAAAA.',
    '.AA....AA.',
    '.AA....AA.',
  ], { A:'#929cab' });

  Sprites.icon_coraza = px([
    '.AA....AA.',
    '.AAAAAAAA.',
    '..AAAAAA..',
    '..AAAAAA..',
    '..AAAAAA..',
    '..AAAAAA..',
    '...AAAA...',
  ], { A:'#929cab' });

  Sprites.icon_botas = px([
    '..BB..bb..',
    '..BB..bb..',
    '..BB..bb..',
    '..BBB.bbb.',
    '..BBBBbbbb',
  ], { B:'#6b4a2b', b:'#5c3e24' });

  Sprites.icon_anillo = px([
    '....rr....',
    '...yyyy...',
    '..yy..yy..',
    '..y....y..',
    '..yy..yy..',
    '...yyyy...',
  ], { y:'#d8a82f', r:'#d8403f' });

  Sprites.icon_amuleto = px([
    '..y....y..',
    '..y....y..',
    '...y..y...',
    '....yy....',
    '....pp....',
    '...pppp...',
    '....pp....',
  ], { y:'#d8a82f', p:'#b14fff' });

  // Variantes espejadas para caminar a la izquierda
  for (const k of Object.keys(Sprites)) {
    if (!k.startsWith('icon_')) Sprites[k + '_L'] = flipH(Sprites[k]);
  }
}

// Versión tintada de un sprite (flash de daño, jefes furiosos), con caché
let _tidSeq = 0;
const _tintCache = new Map();
function tintedSprite(spr, color, alpha) {
  if (!spr._tid) spr._tid = ++_tidSeq;
  const key = spr._tid + '|' + color + '|' + alpha;
  let c = _tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = spr.width; c.height = spr.height;
    const g = c.getContext('2d');
    g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    c.ws = spr.ws; // conservar la escala de mundo
    _tintCache.set(key, c);
  }
  return c;
}

// Icono según slot/arma de un ítem
function itemIcon(item) {
  if (item.slot === 'arma') return Sprites['icon_' + item.weaponType];
  return Sprites['icon_' + item.slot];
}

// Íconos PNG de varas arcanas por tier (PixelLab, 128px). Si cargaron, reemplazan
// el icono pixel del bastón según el material/tier (0-5) del arma.
const STAFF_ICONS = {};
function loadStaffIcons() {
  for (const n of ['t1', 't2', 't3', 'base']) {
    const im = new Image(), nn = n;
    im.onload = () => { STAFF_ICONS[nn] = im; };
    im.src = 'assets/items/weapons/staffs/arcane/staff_arcane_' + nn + '.png';
  }
}
// Devuelve la Image de vara para el tier del arma (mapea 0-5 → t1/t2/t3), o null
// si no es un bastón o todavía no cargaron los PNG.
function staffIconImg(item) {
  if (!item || item.weaponType !== 'baston') return null;
  const tierMap = ['t1', 't1', 't2', 't2', 't3', 't3'];
  return STAFF_ICONS[tierMap[weaponTier(item)]] || STAFF_ICONS.base || null;
}

// =====================================================================
// Equipo visible sobre el personaje: capas teñidas por rareza.
// P = color primario de la rareza, S = sombra. Cada capa sabe en qué
// fila (y) del cuerpo se apoya.
// =====================================================================

const OVERLAY_GRIDS = {
  eq_yelmo: { y: 1, rows: [
    '....PPPP....',
    '...PPPPPP...',
    '...PPPPPP...',
    '...PSSSSP...',
    '...P....P...',
  ]},
  eq_capucha: { y: 1, rows: [
    '....PPPP....',
    '...PPPPPP...',
    '...PPPPPP...',
    '...PP..PP...',
    '...P....P...',
    '...S....S...',
  ]},
  eq_coraza: { y: 7, rows: [
    '..PPPPPPPP..',
    '..SPPPPPPS..',
    '...PPPPPP...',
    '...SSSSSS...',
  ]},
  eq_tunica: { y: 7, rows: [
    '...PPPPPP...',
    '..PPSPPSPP..',
    '...PPPPPP...',
    '...PPPPPP...',
  ]},
  eq_botas: { y: 11, rows: [
    '...PP..PP...',
    '...PP..PP...',
    '...SS..SS...',
  ]},
  eq_amuleto: { y: 7, rows: [
    '.....PP.....',
    '.....SS.....',
  ]},
  eq_anillo: { y: 8, rows: [
    '.P..........',
  ]},
};

const _overlayCache = {};
function getOverlay(name, rarity) {
  const key = name + ':' + rarity;
  if (!_overlayCache[key]) {
    const def = OVERLAY_GRIDS[name];
    _overlayCache[key] = px(def.rows, RARITY_TINTS[rarity]);
  }
  return _overlayCache[key];
}

// Compone cuerpo + tocado + equipo en un solo canvas de 12x14
function composeBase(clsId, equip) {
  const c = document.createElement('canvas');
  c.width = 12; c.height = 14;
  const g = c.getContext('2d');
  g.drawImage(Sprites[clsId + '_body'], 0, 0);
  const put = (img, y) => g.drawImage(img, 0, y);

  const casco = equip.casco;
  if (casco) put(getOverlay(casco.baseName === 'Yelmo' ? 'eq_yelmo' : 'eq_capucha', casco.rarity), OVERLAY_GRIDS.eq_yelmo.y);
  else if (clsId === 'mago') put(Sprites.hat_mago, 0);
  else if (clsId === 'arquero') put(Sprites.hood_arquero, 1);

  if (equip.coraza) {
    const name = equip.coraza.baseName === 'Coraza' ? 'eq_coraza' : 'eq_tunica';
    put(getOverlay(name, equip.coraza.rarity), OVERLAY_GRIDS[name].y);
  }
  if (equip.botas) put(getOverlay('eq_botas', equip.botas.rarity), OVERLAY_GRIDS.eq_botas.y);
  if (equip.amuleto) put(getOverlay('eq_amuleto', equip.amuleto.rarity), OVERLAY_GRIDS.eq_amuleto.y);
  if (equip.anillo) put(getOverlay('eq_anillo', equip.anillo.rarity), OVERLAY_GRIDS.eq_anillo.y);
  return c;
}

// Sprite del jugador con caché: se recompone solo si cambia el equipo
function equipSig(p) {
  return p.cls + '|' + SLOTS.map(s => {
    const it = p.equip[s];
    return it ? it.baseName + ':' + it.rarity : '-';
  }).join('|');
}

function playerSprite(p) {
  const key = equipSig(p);
  if (p._sprKey !== key) {
    p._spr = composeBase(p.cls, p.equip);
    p._sprL = flipH(p._spr);
    p._sprKey = key;
  }
  return p.dir < 0 ? p._sprL : p._spr;
}
