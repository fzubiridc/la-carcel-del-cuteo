// =====================================================================
// skeleton.js — esqueleto PixelLab de 8 direcciones (frames 152×152).
// scary-walk (caminar) + attack (golpe horizontal). Las direcciones que
// PixelLab no generó se obtienen espejando su simétrica (flipH).
//   walk  : tiene S SE SW N NE NW W  → falta E  (= flip W)
//   attack: tiene S SE E NE N        → faltan SW W NW (= flip SE E NE)
// Si faltan los PNGs de walk, SKEL.ready queda false y el motor usa el
// sprite CC0 de siempre. El attack es opcional: si todavía no se bajó,
// el golpe cae sobre el frame de walk.
// =====================================================================

const SKEL = {
  ready: false,
  imgs: {}, // 'walk_south_0', 'attack_east_3', ...
  anims: { walk: { n: 8, ms: 100 }, attack: { n: 9, ms: 52 } },
};
const SKEL_ASSET_V = 1;

// ajuste visual (se afina en preview): escala de dibujo y fila de los pies
const SKEL_DRAW = 0.27;  // 152 * 0.27 ≈ 41px de marco
const SKEL_FOOT = 116;   // fila del frame (de 152) que apoya en e.y (pies reales ~105-119)

// octantes en sentido del ángulo atan2 (x→derecha, y→abajo)
const SKEL_OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

// direcciones nativas (descargadas) y mapa de espejado por animación
const SKEL_NATIVE = {
  walk:   ['south', 'south-east', 'south-west', 'north', 'north-east', 'north-west', 'west'],
  attack: ['south', 'south-east', 'east', 'north-east', 'north'],
};
const SKEL_MIRROR = {
  walk:   { 'east': 'west' },
  attack: { 'west': 'east', 'south-west': 'south-east', 'north-west': 'north-east' },
};

function loadSkeleton() {
  // walk es obligatorio para SKEL.ready; attack carga aparte (opcional)
  let left = 0;
  for (const d of SKEL_NATIVE.walk) left += SKEL.anims.walk.n;
  const done = () => { if (--left === 0) { buildSkelMirrors('walk'); SKEL.ready = true; } };
  for (const d of SKEL_NATIVE.walk) {
    for (let f = 0; f < SKEL.anims.walk.n; f++) {
      const im = new Image();
      im.onload = done;
      im.onerror = () => { left = Infinity; }; // falta un frame → fallback al sprite viejo
      im.src = `assets/mobs/skeleton/walk/${d}_${f}.png?v=${SKEL_ASSET_V}`;
      SKEL.imgs[`walk_${d}_${f}`] = im;
    }
  }
  // attack opcional: cada dir que exista se carga y espeja; las que falten
  // (todavía sin generar) caen sobre el walk. attLeft cuenta cargas Y errores,
  // así el espejado se arma con lo que haya entrado (no lo bloquea un 404).
  let attLeft = SKEL_NATIVE.attack.length * SKEL.anims.attack.n;
  const attDone = () => { if (--attLeft === 0) buildSkelMirrors('attack'); };
  for (const d of SKEL_NATIVE.attack) {
    for (let f = 0; f < SKEL.anims.attack.n; f++) {
      const im = new Image();
      im.onload = attDone;
      im.onerror = () => { SKEL.imgs[`attack_${d}_${f}`] = null; attDone(); };
      im.src = `assets/mobs/skeleton/attack/${d}_${f}.png?v=${SKEL_ASSET_V}`;
      SKEL.imgs[`attack_${d}_${f}`] = im;
    }
  }
}

function buildSkelMirrors(anim) {
  const map = SKEL_MIRROR[anim];
  for (const dst in map) {
    const src = map[dst];
    for (let f = 0; f < SKEL.anims[anim].n; f++) {
      const s = SKEL.imgs[`${anim}_${src}_${f}`];
      if (s && s.complete && s.naturalWidth) SKEL.imgs[`${anim}_${dst}_${f}`] = flipH(s);
    }
  }
}

function skelFrame(anim, face, fi) {
  const img = SKEL.imgs[`${anim}_${face}_${fi}`];
  if (img && (img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth))) return img;
  return null;
}

function drawSkel(e) {
  // mirar hacia donde se mueve; al atacar, hacia el jugador
  const dxp = e.x - (e._sklx !== undefined ? e._sklx : e.x);
  const dyp = e.y - (e._skly !== undefined ? e._skly : e.y);
  e._sklx = e.x; e._skly = e.y;
  const movedNow = Math.abs(dxp) > 0.01 || Math.abs(dyp) > 0.01;
  if (movedNow) {
    const a = Math.atan2(dyp, dxp);
    e._sklface = SKEL_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  // "moviéndose" con histéresis: evita el parpadeo entre frames quietos
  e._sklmoveT = movedNow ? 0.15 : Math.max(0, (e._sklmoveT || 0) - (state.time - (e._skllast || state.time)));
  e._skllast = state.time;
  const moving = e._sklmoveT > 0;
  const attacking = (e.atkAnimT || 0) > 0;
  if (attacking) {
    const a = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    e._sklface = SKEL_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  const face = e._sklface || 'south';

  let anim = 'walk';
  if (attacking && skelFrame('attack', face, 0)) anim = 'attack';
  if (e._sklanim !== anim) { e._sklanim = anim; e._sklt = state.time; }
  const def = SKEL.anims[anim];
  let fi = Math.floor((state.time - e._sklt) * 1000 / def.ms);
  if (anim === 'attack') fi = Math.min(fi, def.n - 1); // el golpe no loopea
  else if (!moving) fi = 0;                            // quieto: pose parada, no marcha en el lugar
  else fi = fi % def.n;

  let img = skelFrame(anim, face, fi) || skelFrame('walk', face, 0) || skelFrame('walk', 'south', 0);
  if (!img) return;
  if (e.flashT > 0) img = tintedSprite(img, '#ffffff', 0.8);
  else if (e.enraged) img = tintedSprite(img, '#ff3030', 0.3);

  const S = e.scale * SKEL_DRAW;
  ctx.drawImage(img, e.x - 76 * S, e.y - SKEL_FOOT * S, 152 * S, 152 * S);
}
