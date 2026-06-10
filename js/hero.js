// =====================================================================
// hero.js — Héroe jugable 48x48, portado del pack "main character designs"
// de Claude Design (rig paper-doll dark-gritty). Un solo cuerpo canónico
// (con la ropa encima no se distinguen las clases) + animaciones idle/run
// generadas por código (el diseño no las incluía).
//
// El equipo visible (paper-doll) y los 6 tiers (= materiales del juego)
// se montan encima en una fase posterior, reusando este mismo rig.
// =====================================================================

// Paleta maestra del pack (48px, dark-gritty)
const HERO_PAL = {
  '0': '#140e1a', '1': '#251c30', '2': '#3d2c47', '3': '#574066',
  '4': '#8a4d76', '5': '#b06a8f',
  'a': '#33231d', 'b': '#553a2b', 'c': '#7a543a', 'd': '#a3764e',
  'e': '#c97b63', 'f': '#e8c170', 'g': '#f6e3a9',
  'h': '#2c2735', 'i': '#453f54', 'j': '#676078', 'k': '#938da6', 'l': '#c6c1d6',
  'm': '#8a5a44', 'n': '#c08a64', 'o': '#e6b48c',
  's': '#7fd4cf', 't': '#3e7f8a', 'w': '#efe9dc',
};
const HW = 48;

function hg() { const g = []; for (let y = 0; y < HW; y++) g.push(new Array(HW).fill('.')); return g; }
function hpx(g, x, y, c) { if (x >= 0 && x < HW && y >= 0 && y < HW) g[y][x] = c; }
function hrect(g, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) hpx(g, x, y, c); }
function hhl(g, x0, x1, y, c) { hrect(g, x0, y, x1, y, c); }
function hvl(g, x, y0, y1, c) { hrect(g, x, y0, x, y1, c); }
function hdots(g, pts, c) { pts.forEach(p => hpx(g, p[0], p[1], c)); }

// Cuerpo base canónico (bodyCommon del rig + pelo y cara neutrales de aventurero)
function buildHeroBase() {
  const g = hg();
  // cabeza
  hrect(g, 18, 8, 29, 9, 'n');
  hrect(g, 17, 10, 30, 17, 'n');
  hrect(g, 18, 18, 29, 18, 'n');
  hrect(g, 19, 19, 28, 19, 'n');
  hvl(g, 30, 10, 17, 'm'); hhl(g, 19, 28, 19, 'm');
  // torso
  hrect(g, 16, 20, 31, 32, 'n');
  hvl(g, 16, 21, 32, 'o'); hvl(g, 31, 21, 32, 'm');
  hhl(g, 17, 30, 20, 'o');
  // brazos
  hrect(g, 13, 22, 15, 29, 'n'); hrect(g, 32, 22, 34, 29, 'n');
  hvl(g, 13, 22, 29, 'o'); hvl(g, 34, 22, 29, 'm');
  // manos
  hrect(g, 13, 29, 15, 32, 'n'); hrect(g, 32, 29, 34, 32, 'n');
  hhl(g, 13, 15, 32, 'm'); hhl(g, 32, 34, 32, 'm');
  // ropa interior
  hrect(g, 17, 33, 30, 36, '2');
  hhl(g, 17, 30, 33, '1');
  hpx(g, 23, 36, '1'); hpx(g, 24, 36, '1');
  // piernas
  hrect(g, 18, 37, 22, 43, 'n'); hrect(g, 25, 37, 29, 43, 'n');
  hvl(g, 22, 37, 43, 'm'); hvl(g, 29, 37, 43, 'm');
  // pies
  hrect(g, 17, 44, 22, 46, 'n'); hrect(g, 25, 44, 30, 46, 'n');
  hhl(g, 17, 22, 44, 'o'); hhl(g, 25, 30, 44, 'o');
  hdots(g, [[18, 46], [20, 46], [26, 46], [28, 46]], 'm'); // dedos
  // pelo corto + cara
  hrect(g, 17, 7, 30, 10, 'a'); hhl(g, 18, 27, 7, 'b');
  hpx(g, 16, 9, 'a'); hpx(g, 31, 9, 'a');
  hhl(g, 20, 21, 14, '0'); hhl(g, 26, 27, 14, '0'); // ojos
  hhl(g, 20, 21, 15, 'm'); hhl(g, 26, 27, 15, 'm');
  hdots(g, [[19, 17], [24, 18], [27, 17]], 'm'); // barba incipiente
  hhl(g, 18, 22, 24, 'm'); hhl(g, 25, 29, 24, 'm'); // pecho
  return g;
}

function cloneGrid(g) { return g.map(r => r.slice()); }

// Sube una franja de filas [y0..y1] n píxeles (recorta el hueco que deja)
function shiftBandUp(g, y0, y1, n) {
  for (let y = y0; y <= y1; y++) {
    g[y] = (y + n <= y1) ? g[y + n].slice() : new Array(HW).fill('.');
  }
}

function heroFrameCanvas(g) {
  const c = document.createElement('canvas');
  c.width = HW; c.height = HW;
  const ctx = c.getContext('2d');
  for (let y = 0; y < HW; y++) for (let x = 0; x < HW; x++) {
    const ch = g[y][x];
    if (ch !== '.' && HERO_PAL[ch]) { ctx.fillStyle = HERO_PAL[ch]; ctx.fillRect(x, y, 1, 1); }
  }
  c.ws = 0.5;
  return c;
}

// Una pierna+pie sube `lift` px (rodilla levantada) para el ciclo de carrera
function legUp(g, side, lift) {
  const x0 = side === 'L' ? 16 : 24, x1 = side === 'L' ? 23 : 31;
  const region = [];
  for (let y = 37; y <= 47; y++) { region.push(g[y].slice()); }
  for (let y = 37; y <= 47; y++) for (let x = x0; x <= x1; x++) g[y][x] = '.';
  for (let i = 0; i < region.length; i++) {
    const y = 37 + i - lift;
    if (y < 0 || y >= HW) continue;
    for (let x = x0; x <= x1; x++) if (region[i][x] !== '.') g[y][x] = region[i][x];
  }
}

function buildHero() {
  const base = buildHeroBase();

  // idle: respiración (el torso+cabeza suben 1px y vuelven)
  const idle0 = heroFrameCanvas(base);
  const b1 = cloneGrid(base);
  shiftBandUp(b1, 8, 31, 1);
  hhl(b1, 16, 31, 32, 'n'); // rellena el borde inferior del torso para que no quede hueco
  const idle1 = heroFrameCanvas(b1);

  // run: contacto · pierna izq arriba · contacto · pierna der arriba (+ bob 1px)
  const runContact = heroFrameCanvas(base);
  const rl = cloneGrid(base); shiftBandUp(rl, 8, 36, 1); legUp(rl, 'L', 2);
  hpx(rl, 33, 30, 'n'); hpx(rl, 34, 31, 'n'); // brazo der adelantado
  const runLeft = heroFrameCanvas(rl);
  const rr = cloneGrid(base); shiftBandUp(rr, 8, 36, 1); legUp(rr, 'R', 2);
  hpx(rr, 13, 30, 'n'); hpx(rr, 14, 31, 'n'); // brazo izq adelantado
  const runRight = heroFrameCanvas(rr);

  Sprites.hero_idle = [idle0, idle1];
  Sprites.hero_run = [runContact, runLeft, runContact, runRight];
  Sprites.hero_idle_L = Sprites.hero_idle.map(flipH);
  Sprites.hero_run_L = Sprites.hero_run.map(flipH);
}

// Timings (ms): idle lento, run vivo
const HERO_ANIMS = {
  idle: { times: [600, 600], loop: true },
  run: { times: [120, 120, 120, 120], loop: true },
};
