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
  return c;
}

const Sprites = {};

function buildSprites() {
  const skin = '#e8b88a', eye = '#1d1d22', bone = '#e6e3d6';

  // ----- Clases jugables -----
  Sprites.guerrero = px([
    '....hhhh....',
    '...hhhhhh...',
    '...ssssss...',
    '...sk.ks....',
    '...ssssss...',
    '..AAAAAAAA..',
    '.sAAAAAAAAs.',
    '.s.AAAAAA.s.',
    '...AAAAAA...',
    '...BB..BB...',
    '...BB..BB...',
    '...DD..DD...',
  ], { h:'#6e4528', s:skin, k:eye, A:'#929cab', B:'#4a3424', D:'#33241a' });

  Sprites.arquero = px([
    '....gggg....',
    '...gggggg...',
    '...gssssg...',
    '...sk.ks....',
    '...ssssss...',
    '..GGGGGGGG..',
    '.sGGGGGGGGs.',
    '.s.GGGGGG.s.',
    '...GGGGGG...',
    '...BB..BB...',
    '...BB..BB...',
    '...DD..DD...',
  ], { g:'#41682f', s:skin, k:eye, G:'#54803c', B:'#4a3424', D:'#33241a' });

  Sprites.mago = px([
    '.....pp.....',
    '....pppp....',
    '...pppppp...',
    '..pppppppp..',
    '...ssssss...',
    '...sk.ks....',
    '...ssssss...',
    '..PPPPPPPP..',
    '.sPPPPPPPPs.',
    '...PPPPPP...',
    '...PPPPPP...',
    '....P..P....',
  ], { p:'#6b3fa0', s:skin, k:eye, P:'#52317c' });

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
  Sprites.rey_esqueleto = px([
    '..y.y..y.y..',
    '..yyyyyyyy..',
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
  ], { y:'#ffd84f', w:bone, k:'#ff4040', d:'#8d8a7c' });

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

  // ----- Objetos del mundo -----
  Sprites.cofre = px([
    '.CCCCCCCC.',
    'CcccccccsC',
    'CCCCCCCCCC',
    'CC..yy..CC',
    'CCCCyyCCCC',
    'CCCCCCCCCC',
  ], { C:'#7a5230', c:'#9a6c40', s:'#9a6c40', y:'#ffd84f' });

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

// Icono según slot/arma de un ítem
function itemIcon(item) {
  if (item.slot === 'arma') return Sprites['icon_' + item.weaponType];
  return Sprites['icon_' + item.slot];
}
