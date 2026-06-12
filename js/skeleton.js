// =====================================================================
// skeleton.js — motor de mobs animados PixelLab por dirección (con espejado).
// Soporta varios "sets" (mismo motor, distintos sprites/tamaños):
//   skeleton        → base 152px: walk 7 dirs (+E espejada) + attack 5 dirs (+3 esp.)
//   skeleton_espada → variante 152px con espada: walk S+E (+W esp.) + slash S (+...)
//   rata            → 56px, 4 dirs cardinales (S/E/N/W), sólo walk de 6 frames
// Cada set declara su tamaño nativo (px), su fila de pies (foot) y su factor de
// dibujo (draw); los defaults reproducen al esqueleto de 152px tal cual.
// Las direcciones que un set no tiene se resuelven a la lateral más cercana
// (este/oeste) o al frente, así nunca miran mal. El attack es opcional.
// =====================================================================

const SKEL_ASSET_V = 2;
const SKEL_DRAW = 0.27;  // factor de dibujo por defecto: 152 * 0.27 ≈ 41px de marco
const SKEL_PX = 152;     // tamaño nativo por defecto del frame
const SKEL_FOOT = 95;    // fila del frame que cae en la sombra (drawShadow va en e.y+5)
const SKEL_OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

const SKEL_CFG = {
  skeleton: {
    anims: { walk: { n: 8, ms: 100 }, attack: { n: 9, ms: 52 } },
    native: {
      walk: ['south', 'south-east', 'south-west', 'north', 'north-east', 'north-west', 'west'],
      attack: ['south', 'south-east', 'east', 'north-east', 'north'],
    },
    mirror: {
      walk: { 'east': 'west' },
      attack: { 'west': 'east', 'south-west': 'south-east', 'north-west': 'north-east' },
    },
  },
  skeleton_espada: {
    // slash sólo en south por ahora (el SE salió mal); el resto cae al walk.
    // Al generar más direcciones en la UI: agregar PNGs + sumarlas a native.
    fallbackTo: 'skeleton', // si sus assets no cargan, usa el esqueleto base
    anims: { walk: { n: 8, ms: 105 }, attack: { n: 9, ms: 55 } },
    native: { walk: ['south', 'east'], attack: ['south'] },
    mirror: { walk: { 'west': 'east' } },
  },
  rata: {
    // PixelLab "Dungeon Rat": 56px, 4 dirs cardinales nativas (W es propia, no
    // espejada). Sin attack: las diagonales caen a la lateral más cercana.
    px: 56, foot: 41, draw: 0.92,
    anims: { walk: { n: 6, ms: 90 } },
    native: { walk: ['south', 'east', 'north', 'west'] },
  },
};

const SKEL_SETS = {}; // folder → { ready, imgs, anims }

function loadSkeleton() {
  for (const folder in SKEL_CFG) loadSkelSet(folder);
}

function loadSkelSet(folder) {
  const cfg = SKEL_CFG[folder];
  const set = SKEL_SETS[folder] = {
    ready: false, imgs: {}, anims: cfg.anims,
    px: cfg.px || SKEL_PX, foot: cfg.foot != null ? cfg.foot : SKEL_FOOT,
    draw: cfg.draw || SKEL_DRAW, fallbackTo: cfg.fallbackTo || null,
  };
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
        const im = new Image();
        im.onload = done;
        im.onerror = () => { set.imgs[`${anim}_${d}_${f}`] = null; done(); };
        im.src = `assets/mobs/${folder}/${anim}/${d}_${f}.png?v=${SKEL_ASSET_V}`;
        set.imgs[`${anim}_${d}_${f}`] = im;
      }
    }
  }
}

// alias al set base (main.js chequea SKEL.ready antes de dibujar)
Object.defineProperty(window, 'SKEL', { get: () => SKEL_SETS.skeleton || { ready: false } });

function skelHas(set, anim, face) {
  const img = set.imgs[`${anim}_${face}_0`];
  return !!(img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth)));
}
function skelImg(set, anim, face, fi) {
  const img = set.imgs[`${anim}_${face}_${fi}`];
  if (img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth))) return img;
  return null;
}
// resuelve una cara que el set sí tenga: exacta → lateral (E/W) → frente → cualquiera
function skelResolveFace(set, anim, face) {
  if (skelHas(set, anim, face)) return face;
  const eastish = face === 'east' || face === 'south-east' || face === 'north-east';
  const westish = face === 'west' || face === 'south-west' || face === 'north-west';
  if (eastish && skelHas(set, anim, 'east')) return 'east';
  if (westish && skelHas(set, anim, 'west')) return 'west';
  for (const f of ['south', 'east', 'west', 'north']) if (skelHas(set, anim, f)) return f;
  return face;
}

// ¿hay un set listo para dibujar a esta entidad? (su set propio o su fallback)
function skelReady(e) {
  const want = e.def.skelSet || 'skeleton';
  const set = SKEL_SETS[want];
  if (set && set.ready) return true;
  const fb = set && set.fallbackTo;
  return !!(fb && SKEL_SETS[fb] && SKEL_SETS[fb].ready);
}

function drawSkel(e) {
  const want = e.def.skelSet || 'skeleton';
  let set = SKEL_SETS[want];
  if (!set || !set.ready) { // su set no cargó: usa el fallback declarado (o no dibuja)
    const fb = set && set.fallbackTo;
    set = fb ? SKEL_SETS[fb] : null;
  }
  if (!set || !set.ready) return;

  // mira hacia donde se mueve (velocidad suavizada EMA + umbral, sin flip-flop);
  // al atacar, hacia el jugador
  const dxp = e.x - (e._sklx !== undefined ? e._sklx : e.x);
  const dyp = e.y - (e._skly !== undefined ? e._skly : e.y);
  e._sklx = e.x; e._skly = e.y;
  e._sklvx = (e._sklvx || 0) * 0.82 + dxp * 0.18;
  e._sklvy = (e._sklvy || 0) * 0.82 + dyp * 0.18;
  const sp = Math.hypot(e._sklvx, e._sklvy);
  if (sp > 0.06) {
    const a = Math.atan2(e._sklvy, e._sklvx);
    e._sklface = SKEL_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  const moving = sp > 0.06;
  const attacking = (e.atkAnimT || 0) > 0;
  if (attacking) {
    const a = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    e._sklface = SKEL_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  const face = e._sklface || 'south';

  let anim = 'walk';
  if (attacking && set.anims.attack && skelHas(set, 'attack', skelResolveFace(set, 'attack', face))) anim = 'attack';
  if (e._sklanim !== anim) { e._sklanim = anim; e._sklt = state.time; }
  const adef = set.anims[anim];
  let fi = Math.floor((state.time - e._sklt) * 1000 / adef.ms);
  if (anim === 'attack') fi = Math.min(fi, adef.n - 1); // el golpe no loopea
  else if (!moving) fi = 0;                             // quieto: pose parada
  else fi = fi % adef.n;

  const rf = skelResolveFace(set, anim, face);
  let img = skelImg(set, anim, rf, fi) || skelImg(set, 'walk', skelResolveFace(set, 'walk', face), 0);
  if (!img) return;
  if (e.flashT > 0) img = tintedSprite(img, '#ffffff', 0.8);
  else if (e.enraged) img = tintedSprite(img, '#ff3030', 0.3);

  const S = e.scale * set.draw;
  // pies en e.y+5 (donde drawEnemy dibuja la sombra), para apoyar sin flotar
  ctx.drawImage(img, e.x - set.px / 2 * S, e.y + 5 - set.foot * S, set.px * S, set.px * S);
}
