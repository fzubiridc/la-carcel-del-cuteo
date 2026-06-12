// =====================================================================
// slime.js — motor de mobs con sprite-sheets CraftPix. Cada animación es UN
// sheet 64×64 con grilla: columna = frame, fila = dirección (4 dirs).
// Maneja varios sets (slime, lich, ghost, zombie, …): mismo motor, distintos
// sprites/tamaños. Mira según se mueve (EMA de velocidad), idle/walk, tinte de
// flash/furia, sombra propia (opcional) y flote/alpha opcional (fantasmas).
// Filas del sheet: 0=sur, 1=norte, 2=oeste, 3=este (convención del pack).
// =====================================================================

const SLIME_ASSET_V = 1;
const SLIME_FRAME = 64;   // lado del frame en el sheet
const SLIME_OCT = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const SLIME_ROW = { south: 0, 'south-east': 3, 'south-west': 2, north: 1, 'north-east': 3, 'north-west': 2, east: 3, west: 2 };

// foot = fila del contenido que apoya en el piso; draw = factor de dibujo.
const SLIME_CFG = {
  slime:  { base: 'assets/mobs/slime/',  foot: 39, draw: 1.15, anims: { idle: { file: 'idle', n: 6, ms: 150 }, walk: { file: 'walk', n: 8, ms: 90 } } },
  lich:   { base: 'assets/mobs/lich/',   foot: 43, draw: 1.2,  anims: { idle: { file: 'idle', n: 4, ms: 160 }, walk: { file: 'walk', n: 6, ms: 95 } } },
  ghost:  { base: 'assets/mobs/ghost/',  foot: 38, draw: 1.2,  shadow: false, float: 1.6, alpha: 0.82, anims: { idle: { file: 'idle', n: 4, ms: 170 }, walk: { file: 'walk', n: 6, ms: 100 } } },
  zombie: { base: 'assets/mobs/zombie/', foot: 40, draw: 1.25, anims: { idle: { file: 'idle', n: 4, ms: 170 }, walk: { file: 'walk', n: 6, ms: 110 } } },
};

const SLIME_SETS = {};
let _slimeScratch = null;

function loadSlime() {
  for (const folder in SLIME_CFG) {
    const cfg = SLIME_CFG[folder];
    const set = SLIME_SETS[folder] = {
      ready: false, imgs: {}, anims: cfg.anims, foot: cfg.foot, draw: cfg.draw,
      shadow: cfg.shadow !== false, float: cfg.float || 0, alpha: cfg.alpha != null ? cfg.alpha : 1,
    };
    let left = Object.keys(cfg.anims).length;
    const done = () => { if (--left === 0) set.ready = true; };
    for (const a in cfg.anims) {
      const im = new Image();
      im.onload = done; im.onerror = done;
      im.src = cfg.base + cfg.anims[a].file + '.png?v=' + SLIME_ASSET_V;
      set.imgs[a] = im;
    }
  }
}

function slimeReady(e) {
  const set = SLIME_SETS[e.def.slimeSet || 'slime'];
  return !!(set && set.ready);
}

// dibuja un frame (sub-rect del sheet) con tinte opcional, vía canvas scratch
function drawSlimeFrame(img, col, row, dx, dy, dw, dh, tint, tintA) {
  const sx = col * SLIME_FRAME, sy = row * SLIME_FRAME;
  if (!tint) { ctx.drawImage(img, sx, sy, SLIME_FRAME, SLIME_FRAME, dx, dy, dw, dh); return; }
  if (!_slimeScratch) { const c = document.createElement('canvas'); c.width = c.height = SLIME_FRAME; _slimeScratch = { cv: c, g: c.getContext('2d') }; }
  const g = _slimeScratch.g;
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.clearRect(0, 0, SLIME_FRAME, SLIME_FRAME);
  g.drawImage(img, sx, sy, SLIME_FRAME, SLIME_FRAME, 0, 0, SLIME_FRAME, SLIME_FRAME);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint;
  g.fillRect(0, 0, SLIME_FRAME, SLIME_FRAME);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  ctx.drawImage(_slimeScratch.cv, 0, 0, SLIME_FRAME, SLIME_FRAME, dx, dy, dw, dh);
}

function drawSlime(e) {
  const set = SLIME_SETS[e.def.slimeSet || 'slime'];
  if (!set || !set.ready) return;

  // mira hacia donde se mueve (EMA de velocidad + umbral, sin flip-flop)
  const dxp = e.x - (e._slx !== undefined ? e._slx : e.x);
  const dyp = e.y - (e._sly !== undefined ? e._sly : e.y);
  e._slx = e.x; e._sly = e.y;
  e._slvx = (e._slvx || 0) * 0.82 + dxp * 0.18;
  e._slvy = (e._slvy || 0) * 0.82 + dyp * 0.18;
  const sp = Math.hypot(e._slvx, e._slvy);
  if (sp > 0.05) e._slface = SLIME_OCT[(Math.round(Math.atan2(e._slvy, e._slvx) / (Math.PI / 4)) + 8) % 8];
  const moving = sp > 0.05;
  const face = e._slface || 'south';
  const row = SLIME_ROW[face] != null ? SLIME_ROW[face] : 0;

  const anim = moving ? 'walk' : 'idle';
  if (e._slanim !== anim) { e._slanim = anim; e._slt = state.time; }
  const adef = set.anims[anim];
  const col = Math.floor((state.time - (e._slt || 0)) * 1000 / adef.ms) % adef.n;

  const tint = e.flashT > 0 ? '#ffffff' : (e.enraged ? '#ff3030' : null);
  const tintA = e.flashT > 0 ? 0.8 : 0.3;
  const bob = set.float ? Math.sin(e.wobble * 1.2) * set.float : 0;

  if (set.shadow) drawShadow(e.x, e.y, e.w * e.scale * 0.5);
  const S = e.scale * set.draw;
  if (set.alpha < 1) ctx.globalAlpha = set.alpha;
  drawSlimeFrame(set.imgs[anim], col, row, e.x - SLIME_FRAME / 2 * S, e.y - set.foot * S + bob, SLIME_FRAME * S, SLIME_FRAME * S, tint, tintA);
  ctx.globalAlpha = 1;
}
