// =====================================================================
// mob.js — MOTOR UNIFICADO de mobs animados por dirección.
// Reemplaza a skeleton.js + slime.js (eran el mismo motor con dos formatos de
// asset). Cada "set" declara su `source`:
//   'frames' → PixelLab por-frame PNG (skeleton, skeleton_espada, rata):
//              archivos assets/mobs/<set>/<anim>/<dir>_<f>.png, 8 dirs + espejo,
//              direcciones faltantes se resuelven a la lateral/frente.
//   'sheet'  → CraftPix sheet 64×64 en grilla (slime, lich, ghost, zombie, orc):
//              columna=frame, fila=dirección (0=sur,1=norte,2=oeste,3=este).
// Lógica común a ambos: facing por EMA de velocidad, idle/walk/attack (attack al
// golpear, encarando al jugador), tinte flash/furia, flote/alpha opcional, y
// anclaje de pies en e.y+5 (donde drawEnemy() dibuja la sombra).
// =====================================================================

const MOB_ASSET_V = 2;
const MOB_OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const MOB_ROW = { south: 0, 'south-east': 3, 'south-west': 2, north: 1, 'north-east': 3, 'north-west': 2, east: 3, west: 2 }; // sheet: dir → fila

const MOB_TEXTURES = { total: 0, loaded: 0, failed: 0, errors: [], ready: false };

function trackMobTexture(src) {
  MOB_TEXTURES.total++;
  MOB_TEXTURES.ready = false;
  let done = false;
  return ok => {
    if (done) return;
    done = true;
    MOB_TEXTURES.loaded++;
    if (!ok) {
      MOB_TEXTURES.failed++;
      MOB_TEXTURES.errors.push(src);
    }
    MOB_TEXTURES.ready = MOB_TEXTURES.loaded >= MOB_TEXTURES.total && MOB_TEXTURES.failed === 0;
  };
}

const MOB_CFG = {
  // ---- frames (PixelLab por-frame) ----
  skeleton: {
    source: 'frames', px: 152, foot: 95, draw: 0.27,
    anims: { walk: { n: 8, ms: 100 }, attack: { n: 9, ms: 52 } },
    native: { walk: ['south', 'south-east', 'south-west', 'north', 'north-east', 'north-west', 'west'], attack: ['south', 'south-east', 'east', 'north-east', 'north'] },
    mirror: { walk: { 'east': 'west' }, attack: { 'west': 'east', 'south-west': 'south-east', 'north-west': 'north-east' } },
  },
  skeleton_espada: {
    source: 'frames', px: 152, foot: 95, draw: 0.27, fallbackTo: 'skeleton',
    anims: { walk: { n: 8, ms: 105 }, attack: { n: 9, ms: 55 } },
    native: { walk: ['south', 'east'], attack: ['south'] }, mirror: { walk: { 'west': 'east' } },
  },
  rata: {
    source: 'frames', px: 56, foot: 41, draw: 0.92,
    anims: { walk: { n: 6, ms: 90 } }, native: { walk: ['south', 'east', 'north', 'west'] },
  },
  // ---- sheet (CraftPix 64×64) ----
  slime:  { source: 'sheet', base: 'assets/mobs/slime/',  px: 64, foot: 39, draw: 0.55, anims: { idle: { file: 'idle', n: 6, ms: 150 }, walk: { file: 'walk', n: 8, ms: 90 },  attack: { file: 'attack', n: 10, ms: 55 } } },
  lich:   { source: 'sheet', base: 'assets/mobs/lich/',   px: 64, foot: 43, draw: 0.52, anims: { idle: { file: 'idle', n: 4, ms: 160 }, walk: { file: 'walk', n: 6, ms: 95 },  attack: { file: 'attack', n: 8,  ms: 70 } } },
  ghost:  { source: 'sheet', base: 'assets/mobs/ghost/',  px: 64, foot: 38, draw: 0.42, shadow: false, float: 1.6, alpha: 0.82, anims: { idle: { file: 'idle', n: 4, ms: 170 }, walk: { file: 'walk', n: 6, ms: 100 }, attack: { file: 'attack', n: 12, ms: 55 } } },
  zombie: { source: 'sheet', base: 'assets/mobs/zombie/', px: 64, foot: 40, draw: 0.48, anims: { idle: { file: 'idle', n: 4, ms: 170 }, walk: { file: 'walk', n: 6, ms: 110 }, attack: { file: 'attack', n: 10, ms: 70 } } },
  orc:    { source: 'sheet', base: 'assets/mobs/orc/',    px: 64, foot: 41, draw: 0.46, anims: { idle: { file: 'idle', n: 4, ms: 170 }, walk: { file: 'walk', n: 6, ms: 100 }, attack: { file: 'attack', n: 8,  ms: 70 } } },
};

const MOB_SETS = {};
let _mobScratch = null;

function loadMobs() { for (const folder in MOB_CFG) loadMobSet(folder); }

function loadMobSet(folder) {
  const cfg = MOB_CFG[folder];
  const set = MOB_SETS[folder] = {
    ready: false, source: cfg.source, imgs: {}, anims: cfg.anims,
    px: cfg.px, foot: cfg.foot, draw: cfg.draw, fallbackTo: cfg.fallbackTo || null,
    shadow: cfg.shadow !== false, float: cfg.float || 0, alpha: cfg.alpha != null ? cfg.alpha : 1,
    native: cfg.native, mirror: cfg.mirror,
  };
  if (cfg.source === 'sheet') {
    let left = Object.keys(cfg.anims).length;
    const done = () => { if (--left === 0) set.ready = true; };
    for (const a in cfg.anims) {
      const src = cfg.base + cfg.anims[a].file + '.png?v=' + MOB_ASSET_V;
      const tracked = trackMobTexture(src);
      const im = new Image();
      im.onload = () => { tracked(true); done(); };
      im.onerror = () => { tracked(false); done(); };
      im.src = src;
      set.imgs[a] = im;
    }
  } else { // frames
    for (const anim in cfg.anims) {
      const dirs = cfg.native[anim] || [];
      const n = cfg.anims[anim].n;
      let left = dirs.length * n;
      const buildMirror = () => {
        const map = (cfg.mirror && cfg.mirror[anim]) || {};
        for (const dst in map) {
          const src = map[dst];
          for (let f = 0; f < n; f++) {
            const s = set.imgs[`${anim}_${src}_${f}`];
            if (s && s.complete && s.naturalWidth) set.imgs[`${anim}_${dst}_${f}`] = flipH(s);
          }
        }
      };
      const done = () => { if (--left === 0) { buildMirror(); if (anim === 'walk') set.ready = true; } };
      for (const d of dirs) {
        for (let f = 0; f < n; f++) {
          const src = `assets/mobs/${folder}/${anim}/${d}_${f}.png?v=${MOB_ASSET_V}`;
          const tracked = trackMobTexture(src);
          const im = new Image();
          im.onload = () => { tracked(true); done(); };
          im.onerror = () => { tracked(false); set.imgs[`${anim}_${d}_${f}`] = null; done(); };
          im.src = src;
          set.imgs[`${anim}_${d}_${f}`] = im;
        }
      }
    }
  }
}

// nombre del set para una entidad (skel o slime; el base esqueleto cae a 'skeleton')
function mobSetName(e) { return e.def.skelSet || e.def.slimeSet || 'skeleton'; }

// helpers de 'frames'
function mobHas(set, anim, face) {
  const im = set.imgs[`${anim}_${face}_0`];
  return !!(im && (im instanceof HTMLCanvasElement || (im.complete && im.naturalWidth)));
}
function mobImg(set, anim, face, fi) {
  const im = set.imgs[`${anim}_${face}_${fi}`];
  if (im && (im instanceof HTMLCanvasElement || (im.complete && im.naturalWidth))) return im;
  return null;
}
// resuelve una cara que el set tenga: exacta → lateral (E/O) → frente → cualquiera
function mobResolveFace(set, anim, face) {
  if (mobHas(set, anim, face)) return face;
  const eastish = face === 'east' || face === 'south-east' || face === 'north-east';
  const westish = face === 'west' || face === 'south-west' || face === 'north-west';
  if (eastish && mobHas(set, anim, 'east')) return 'east';
  if (westish && mobHas(set, anim, 'west')) return 'west';
  for (const f of ['south', 'east', 'west', 'north']) if (mobHas(set, anim, f)) return f;
  return face;
}
function mobCanAttack(set, face) {
  if (!set.anims.attack) return false;
  if (set.source === 'sheet') return true; // los sheets traen las 4 dirs
  return mobHas(set, 'attack', mobResolveFace(set, 'attack', face));
}

// ¿hay un set listo para dibujar a esta entidad? (su set propio o su fallback)
function mobReady(e) {
  const set = MOB_SETS[mobSetName(e)];
  if (set && set.ready) return true;
  const fb = set && set.fallbackTo;
  return !!(fb && MOB_SETS[fb] && MOB_SETS[fb].ready);
}

// tinte de un sub-rect vía canvas scratch (para sheets)
function mobBlitTinted(img, sx, sy, sw, sh, dx, dy, dw, dh, tint, tintA) {
  if (!_mobScratch) { const c = document.createElement('canvas'); c.width = c.height = 64; _mobScratch = { cv: c, g: c.getContext('2d') }; }
  const g = _mobScratch.g;
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, sw, sh);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint; g.fillRect(0, 0, sw, sh);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  ctx.drawImage(_mobScratch.cv, 0, 0, sw, sh, dx, dy, dw, dh);
}

function mobDrawFrame(set, anim, face, fi, dx, dy, dw, dh, tint, tintA) {
  if (set.source === 'sheet') {
    const img = set.imgs[anim];
    if (!img || !img.complete || !img.naturalWidth) return;
    const row = MOB_ROW[face] != null ? MOB_ROW[face] : 0;
    const sx = fi * 64, sy = row * 64;
    if (!tint) { ctx.drawImage(img, sx, sy, 64, 64, dx, dy, dw, dh); return; }
    mobBlitTinted(img, sx, sy, 64, 64, dx, dy, dw, dh, tint, tintA);
  } else {
    const rf = mobResolveFace(set, anim, face);
    let img = mobImg(set, anim, rf, fi) || mobImg(set, 'walk', mobResolveFace(set, 'walk', face), 0);
    if (!img) return;
    if (tint) img = tintedSprite(img, tint, tintA);
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

function drawMob(e) {
  let set = MOB_SETS[mobSetName(e)];
  if (!set || !set.ready) { const fb = set && set.fallbackTo; set = fb ? MOB_SETS[fb] : null; }
  if (!set || !set.ready) return;

  // mira hacia donde se mueve (EMA de velocidad + umbral, sin flip-flop)
  const dxp = e.x - (e._mx !== undefined ? e._mx : e.x);
  const dyp = e.y - (e._my !== undefined ? e._my : e.y);
  e._mx = e.x; e._my = e.y;
  e._mvx = (e._mvx || 0) * 0.82 + dxp * 0.18;
  e._mvy = (e._mvy || 0) * 0.82 + dyp * 0.18;
  const sp = Math.hypot(e._mvx, e._mvy);
  if (sp > 0.06) e._mface = MOB_OCTANTS[(Math.round(Math.atan2(e._mvy, e._mvx) / (Math.PI / 4)) + 8) % 8];
  const moving = sp > 0.06;

  // attack: al golpear (atkAnimT) se reproduce encarando al jugador
  const attacking = (e.atkAnimT || 0) > 0 && mobCanAttack(set, e._mface || 'south');
  if (attacking) e._mface = MOB_OCTANTS[(Math.round(Math.atan2(state.player.y - e.y, state.player.x - e.x) / (Math.PI / 4)) + 8) % 8];
  const face = e._mface || 'south';

  const anim = attacking ? 'attack' : (moving ? 'walk' : (set.anims.idle ? 'idle' : 'walk'));
  if (e._manim !== anim) { e._manim = anim; e._mt = state.time; }
  const adef = set.anims[anim];
  let fi = Math.floor((state.time - (e._mt || 0)) * 1000 / adef.ms);
  if (anim === 'attack') fi = Math.min(fi, adef.n - 1); // el golpe no loopea
  else if (anim === 'idle') fi = fi % adef.n;           // idle loopea
  else fi = moving ? fi % adef.n : 0;                   // walk: quieto = pose parada

  const tint = e.flashT > 0 ? '#ffffff' : (e.enraged ? '#ff3030' : null);
  const tintA = e.flashT > 0 ? 0.8 : 0.3;
  const bob = set.float ? Math.sin(e.wobble * 1.2) * set.float : 0;
  const S = e.scale * set.draw;
  // pies en e.y+5 (donde drawEnemy dibuja la sombra), para apoyar sin flotar
  const dx = e.x - set.px / 2 * S, dy = e.y + 5 - set.foot * S + bob, dw = set.px * S, dh = set.px * S;

  if (set.alpha < 1) ctx.globalAlpha = set.alpha;
  mobDrawFrame(set, anim, face, fi, dx, dy, dw, dh, tint, tintA);
  ctx.globalAlpha = 1;
}
