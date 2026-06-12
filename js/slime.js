// =====================================================================
// slime.js — slimes CraftPix. Cada animación es UN sprite-sheet 64×64 con
// grilla: columna = frame, fila = dirección (4 dirs). Mira según se mueve
// (EMA de velocidad), camina/idle, y soporta tinte de flash/furia.
// Sin sombra en el arte (usamos drawShadow propio).
// =====================================================================

const SLIME_ASSET_V = 1;
const SLIME_FRAME = 64;   // lado del frame en el sheet
const SLIME_FOOT = 39;    // fila del contenido que apoya en el piso (base del cuerpo)
const SLIME_DRAW = 1.15;  // factor de dibujo (cuerpo ~24px con scale 1)
const SLIME_OCT = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

// fila del sheet por dirección (4 dirs; las diagonales caen a la lateral/cardinal)
const SLIME_ROW = { south: 0, 'south-east': 3, 'south-west': 2, north: 1, 'north-east': 3, 'north-west': 2, east: 3, west: 2 };

const SLIME_CFG = {
  slime: {
    base: 'assets/mobs/slime/',
    anims: { idle: { file: 'idle', n: 6, ms: 150 }, walk: { file: 'walk', n: 8, ms: 90 } },
  },
};

const SLIME_SETS = {};
let _slimeScratch = null;

function loadSlime() {
  for (const folder in SLIME_CFG) {
    const cfg = SLIME_CFG[folder];
    const set = SLIME_SETS[folder] = { ready: false, imgs: {}, anims: cfg.anims };
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

// dibuja un frame (sub-rect del sheet) con tinte opcional, usando un canvas scratch
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

  drawShadow(e.x, e.y, e.w * e.scale * 0.5);
  const S = e.scale * SLIME_DRAW;
  drawSlimeFrame(set.imgs[anim], col, row, e.x - SLIME_FRAME / 2 * S, e.y - SLIME_FOOT * S, SLIME_FRAME * S, SLIME_FRAME * S, tint, tintA);
}
