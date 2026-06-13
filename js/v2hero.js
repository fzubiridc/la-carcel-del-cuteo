// =====================================================================
// v2hero.js — renderer experimental del mago v2 (PixelLab, 8 direcciones).
// Si los PNGs de assets/v2_test/mage/ cargan, reemplaza el dibujo del
// jugador; si falta algo, el juego cae al renderer de siempre.
// Frames de 120×120 con pies en y=89; a escala 0.4 ocupa 24px de mundo.
// =====================================================================

const V2H = {
  ready: false,
  imgs: {},
  anims: { idle: { n: 4, ms: 220 }, walk: { n: 6, ms: 110 }, hurt: { n: 4, ms: 65 } },
  staffRig: { empty: {}, idle: {}, staffs: [], staffAnims: {}, hands: {}, ready: false },
  // efectos del poder (energyblast): vuelo en loop + explosión one-shot
  fx: { power: [], boom: [] },
};
// versión de assets: subir al reemplazar PNGs para invalidar el caché del
// navegador (los scripts usan ?v=N pero las imágenes no lo tenían — un PNG
// corrupto cacheado nos dejó clavados en el héroe viejo)
const V2_ASSET_V = 3;

const V2_STAFF_RIG = {
  dirs: ['south', 'south-east', 'east', 'north-east', 'north'],
  n: 9,
  ms: 95,
  // Anchors exported from rigtool walktest:v2. Coordinates are in the 120px
  // mage frame. Staff grip/rot/spx are per-staff source image.
  handByDir: {
    south: [
      { x: 46, y: 73 }, { x: 45, y: 73 }, { x: 44, y: 69 },
      { x: 44, y: 69 }, { x: 44, y: 69 }, { x: 44, y: 70 },
      { x: 45, y: 70 }, { x: 46, y: 71 }, { x: 46, y: 73 },
    ],
    'south-east': [
      { x: 76, y: 61 }, { x: 75, y: 62 }, { x: 76, y: 63 },
      { x: 77, y: 60 }, { x: 79, y: 57 }, { x: 79, y: 56 },
      { x: 79, y: 58 }, { x: 77, y: 61 }, { x: 76, y: 61 },
    ],
    east: [
      { x: 61, y: 73 }, { x: 61, y: 73 }, { x: 65, y: 70 },
      { x: 67, y: 69 }, { x: 71, y: 68 }, { x: 68, y: 69 },
      { x: 65, y: 71 }, { x: 65, y: 71 }, { x: 65, y: 71 },
    ],
    'north-east': [
      { x: 77, y: 62 }, { x: 76, y: 58 }, { x: 76, y: 57 },
      { x: 75, y: 63 }, { x: 76, y: 64 }, { x: 74, y: 65 },
      { x: 72, y: 68 }, { x: 76, y: 65 }, { x: 77, y: 62 },
    ],
    north: [
      { x: 76, y: 68 }, { x: 74, y: 68 }, { x: 74, y: 66 },
      { x: 73, y: 66 }, { x: 73, y: 67 }, { x: 74, y: 68 },
      { x: 75, y: 69 }, { x: 76, y: 69 }, { x: 76, y: 68 },
    ],
  },
  idleDirs: ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'],
  idleHandByDir: {
    south: { x: 38, y: 41 },
    'south-east': { x: 78, y: 59 },
    east: { x: 78, y: 46 },
    'north-east': { x: 80, y: 57 },
    north: { x: 81, y: 42 },
    'north-west': { x: 39, y: 57 },
    west: { x: 41, y: 51 },
    'south-west': { x: 41, y: 59 },
  },
  handOverlay: {
    south: { src: 'assets/v2_test/hands/south.png', ax: 4, ay: 4, scale: 1.1 },
    'south-east': { src: 'assets/v2_test/hands/south-east.png', ax: 3, ay: 0, scale: 1.1 },
    east: { src: 'assets/v2_test/hands/east.png', ax: 3, ay: 1, scale: 1 },
  },
  staffs: [
    { grip: { x: 32, y: 47 }, focus: { x: 32, y: 8 }, spx: 49, rot: 0 },
    { grip: { x: 31, y: 43 }, focus: { x: 31, y: 8 }, spx: 64, rot: 0 },
    { grip: { x: 32, y: 46 }, focus: { x: 32, y: 8 }, spx: 61, rot: 0 },
    { grip: { x: 32, y: 47 }, focus: { x: 32, y: 7 }, spx: 64, rot: 15 },
    { grip: { x: 38, y: 89 }, focus: { x: 13, y: 32 }, spx: 64, rot: -45 },
    { grip: { x: 54, y: 75 }, focus: { x: 23, y: 25 }, spx: 64, rot: -45 },
    { grip: { x: 35, y: 93 }, focus: { x: 13, y: 37 }, spx: 64, rot: -45 },
    { grip: { x: 41, y: 88 }, focus: { x: 21, y: 39 }, spx: 51, rot: -45 },
    { grip: { x: 32, y: 42 }, focus: { x: 32, y: 8 }, spx: 64, rot: 0, anim: 'staff9_anim', animFrames: 9, animMs: 55 },
  ],
};
const V2_STAFF_MIRROR_FACE = { west: 'east', 'north-west': 'north-east', 'south-west': 'south-east' };

function loadV2Hero() {
  const dirs = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
  let left = 0;
  for (const d of dirs) for (const a in V2H.anims) left += V2H.anims[a].n;
  for (const d of dirs) {
    for (const a in V2H.anims) {
      for (let f = 0; f < V2H.anims[a].n; f++) {
        const im = new Image();
        im.onload = () => { if (--left === 0) V2H.ready = true; };
        im.onerror = () => { left = Infinity; }; // falta un frame → nunca ready, fallback v1
        im.src = `assets/v2_test/mage/${a}/${d}_${f}.png?v=${V2_ASSET_V}`;
        V2H.imgs[`${a}_${d}_${f}`] = im;
      }
    }
  }
  loadV2StaffRig();
  // los efectos cargan aparte: si faltan, el motor usa el orbe por código
  for (let f = 0; f < 4; f++) {
    const im = new Image();
    im.onload = () => V2H.fx.power.push(im) && V2H.fx.power.sort((a, b) => a._f - b._f);
    im._f = f; im.src = `assets/v2_test/mage/power/south_${f}.png?v=${V2_ASSET_V}`;
  }
  const boomTmp = [];
  for (let f = 0; f < 8; f++) {
    const im = new Image();
    im._f = f;
    im.onload = () => { boomTmp.push(im); if (boomTmp.length === 8) V2H.fx.boom = boomTmp.sort((a, b) => a._f - b._f); };
    im.src = `assets/v2_test/mage/powerboom/south_${f}.png?v=${V2_ASSET_V}`;
  }
}

function loadV2StaffRig() {
  const rig = V2H.staffRig;
  let left = V2_STAFF_RIG.dirs.length * V2_STAFF_RIG.n + V2_STAFF_RIG.idleDirs.length + V2_STAFF_RIG.staffs.length + Object.keys(V2_STAFF_RIG.handOverlay).length;
  for (const cfg of V2_STAFF_RIG.staffs) left += cfg.animFrames || 0;
  const done = () => { if (--left === 0) rig.ready = true; };
  for (const d of V2_STAFF_RIG.dirs) {
    for (let f = 0; f < V2_STAFF_RIG.n; f++) {
      const im = new Image();
      im.onload = done; im.onerror = done;
      im.src = `assets/v2_test/mage/walk_empty/${d}_${f}.png?v=${V2_ASSET_V}`;
      rig.empty[`${d}_${f}`] = im;
    }
    const hcfg = V2_STAFF_RIG.handOverlay[d];
    if (hcfg) {
      const him = new Image();
      him.onload = done; him.onerror = done;
      him.src = `${hcfg.src}?v=${V2_ASSET_V}`;
      rig.hands[d] = him;
    }
  }
  for (const d of V2_STAFF_RIG.idleDirs) {
    const im = new Image();
    im.onload = done; im.onerror = done;
    im.src = `assets/v2_test/mage/idle_holdpose_ref/${d}_0.png?v=${V2_ASSET_V}`;
    rig.idle[d] = im;
  }
  for (let i = 0; i < V2_STAFF_RIG.staffs.length; i++) {
    const im = new Image();
    im.onload = done; im.onerror = done;
    im.src = `assets/v2_test/staffs/staff${i + 1}.png?v=${V2_ASSET_V}`;
    rig.staffs[i] = im;
    const cfg = V2_STAFF_RIG.staffs[i];
    if (cfg.anim && cfg.animFrames) {
      rig.staffAnims[cfg.anim] = [];
      for (let f = 0; f < cfg.animFrames; f++) {
        const aim = new Image();
        aim.onload = done; aim.onerror = done;
        aim.src = `assets/v2_test/staffs/${cfg.anim}/frame_${String(f).padStart(3, '0')}.png?v=${V2_ASSET_V}`;
        rig.staffAnims[cfg.anim][f] = aim;
      }
    }
  }
}

// Proyectil energyblast: el arte vuela "hacia la derecha" → rotar al ángulo real.
// El tamaño visual acompaña a la hitbox (pr.size): blast más grande, golpe más grande.
function drawV2Bolt(pr) {
  const fi = Math.floor(pr.t * 1000 / 90) % V2H.fx.power.length;
  const S = (pr.size || 12) / 20; // size 12 → 0.6: 40px de arte → 24px de mundo
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.rotate(pr.ang);
  // al agotarse el alcance se difumina (último tercio de vida) y se encoge apenas
  ctx.globalAlpha = Math.min(1, pr.life * 3.5);
  const shrink = 0.85 + Math.min(1, pr.life * 3.5) * 0.15;
  ctx.drawImage(V2H.fx.power[fi], -20 * S * shrink, -20 * S * shrink, 40 * S * shrink, 40 * S * shrink);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// El personaje mira hacia donde SE MUEVE (teclado/joystick), no hacia el cursor.
// Quieto, conserva la última dirección de marcha.
const V2_OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

function v2EquippedStaffIndex(p) {
  if (p.staffOverride != null && p.staffOverride >= 0)
    return Math.max(0, Math.min(V2_STAFF_RIG.staffs.length - 1, p.staffOverride | 0));
  const it = p.equip && p.equip.arma;
  if (!it || it.weaponType !== 'baston') return -1;
  const tier = typeof weaponTier === 'function' ? weaponTier(it) : 0;
  return Math.max(0, Math.min(V2_STAFF_RIG.staffs.length - 1, tier));
}

function drawV2StaffAtHand(p, idx, hand, ox, oy, S, mirror) {
  const cfg = V2_STAFF_RIG.staffs[idx];
  let img = V2H.staffRig.staffs[idx];
  if (cfg.anim && p._staffCastStart != null) {
    const elapsedMs = Math.max(0, (state.time - p._staffCastStart) * 1000);
    const frame = Math.floor(elapsedMs / (cfg.animMs || 60));
    const anim = V2H.staffRig.staffAnims[cfg.anim];
    if (anim && frame >= 0 && frame < anim.length) img = anim[frame] || img;
  }
  if (!img || !img.complete || !img.naturalWidth || !hand) return null;
  const x = ox + (mirror ? 120 - hand.x : hand.x) * S, y = oy + hand.y * S;
  const spx = cfg.spx || img.naturalWidth;
  const drawScale = spx / img.naturalWidth;
  ctx.save();
  ctx.translate(x, y);
  if (mirror) ctx.scale(-S * drawScale, S * drawScale);
  else ctx.scale(S * drawScale, S * drawScale);
  ctx.rotate((cfg.rot || 0) * Math.PI / 180);
  ctx.drawImage(img, -cfg.grip.x, -cfg.grip.y);
  ctx.restore();
  const rot = (cfg.rot || 0) * Math.PI / 180;
  const fx = ((cfg.focus || cfg.grip).x - cfg.grip.x) * S * drawScale;
  const fy = ((cfg.focus || cfg.grip).y - cfg.grip.y) * S * drawScale;
  const rx = fx * Math.cos(rot) - fy * Math.sin(rot);
  const ry = fx * Math.sin(rot) + fy * Math.cos(rot);
  const focus = {
    x: x + (mirror ? -rx : rx),
    y: y + ry,
  };
  p._v2StaffTip = focus;
  return focus;
}

function drawV2StaffAt(p, face, fi, ox, oy, S, mirror) {
  const idx = v2EquippedStaffIndex(p);
  if (idx < 0) return null;
  const hand = V2_STAFF_RIG.handByDir[face] && V2_STAFF_RIG.handByDir[face][fi];
  return drawV2StaffAtHand(p, idx, hand, ox, oy, S, mirror);
}

function drawV2HandOverlay(face, fi, ox, oy, S, mirror) {
  const hcfg = V2_STAFF_RIG.handOverlay[face], hand = V2_STAFF_RIG.handByDir[face] && V2_STAFF_RIG.handByDir[face][fi];
  const img = V2H.staffRig.hands[face];
  if (!hcfg || !hand || !img || !img.complete || !img.naturalWidth) return;
  const sc = hcfg.scale || 1;
  const x = ox + (mirror ? 120 - hand.x : hand.x) * S;
  const y = oy + hand.y * S;
  ctx.save();
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -hcfg.ax * sc * S, -hcfg.ay * sc * S, img.naturalWidth * sc * S, img.naturalHeight * sc * S);
  ctx.restore();
}

function drawV2StaffRigHero(p, face) {
  const staffIdx = v2EquippedStaffIndex(p);
  const sourceFace = V2_STAFF_MIRROR_FACE[face] || face;
  const mirror = sourceFace !== face;
  if (!V2H.staffRig.ready || !V2_STAFF_RIG.handByDir[sourceFace] || staffIdx < 0) return false;
  if ((mirror || sourceFace === 'north-east' || sourceFace === 'north') && staffIdx !== 8) return false;
  if (p._v2anim !== 'walk_staff') { p._v2anim = 'walk_staff'; p._v2t = state.time; }
  const fi = Math.floor((state.time - p._v2t) * 1000 / V2_STAFF_RIG.ms) % V2_STAFF_RIG.n;
  const img = V2H.staffRig.empty[`${sourceFace}_${fi}`];
  if (!img || !img.complete || !img.naturalWidth) return false;
  const S = 0.4, footY = p.y + 5, ox = p.x - 60 * S, oy = footY - 90 * S;
  const staffBehind = staffIdx === 8 && (sourceFace === 'north-east' || sourceFace === 'north');
  if (staffBehind) drawV2StaffAt(p, sourceFace, fi, ox, oy, S, mirror);
  if (mirror) {
    ctx.save();
    ctx.translate(ox + 120 * S, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, 120 * S, 120 * S);
    ctx.restore();
  } else {
    ctx.drawImage(img, ox, oy, 120 * S, 120 * S);
  }
  if (!staffBehind) {
    drawV2StaffAt(p, sourceFace, fi, ox, oy, S, mirror);
    drawV2HandOverlay(sourceFace, fi, ox, oy, S, mirror);
  }
  return true;
}

function drawV2StaffIdleHero(p, face) {
  const staffIdx = v2EquippedStaffIndex(p);
  if (!V2H.staffRig.ready || staffIdx !== 8) return false;
  const img = V2H.staffRig.idle[face], hand = V2_STAFF_RIG.idleHandByDir[face];
  if (!img || !img.complete || !img.naturalWidth || !hand) return false;
  const S = 0.4, footY = p.y + 5, ox = p.x - 60 * S, oy = footY - 90 * S;
  const staffBehind = face === 'north-east' || face === 'north' || face === 'north-west';
  if (staffBehind) drawV2StaffAtHand(p, staffIdx, hand, ox, oy, S, false);
  ctx.drawImage(img, ox, oy, 120 * S, 120 * S);
  if (!staffBehind) drawV2StaffAtHand(p, staffIdx, hand, ox, oy, S, false);
  return true;
}

function drawV2Hero(p) {
  const dx = p.x - (p._v2px !== undefined ? p._v2px : p.x);
  const dy = p.y - (p._v2py !== undefined ? p._v2py : p.y);
  p._v2px = p.x; p._v2py = p.y;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    const a = Math.atan2(dy, dx);
    p._v2face = V2_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  // atacando, el cuerpo gira hacia donde apunta (si no, los tiros salen "por la espalda");
  // al soltar queda mirando hacia donde disparó
  if (mouse.down || touch.attacking) {
    const aa = aimAngle();
    p._v2face = V2_OCTANTS[(Math.round(aa / (Math.PI / 4)) + 8) % 8];
  }
  // al descender por la escalera, mira siempre al norte (se mete de espaldas)
  const face = (typeof state !== 'undefined' && state.descend) ? 'north' : (p._v2face || 'south');
  let anim = p.moving ? 'walk' : 'idle';
  if ((p.hurtT || 0) > 0) anim = 'hurt'; // recibir daño pisa a todo
  if (anim === 'walk' && drawV2StaffRigHero(p, face)) return;
  if (anim === 'idle' && drawV2StaffIdleHero(p, face)) return;
  if (p._v2anim !== anim) { p._v2anim = anim; p._v2t = state.time; }
  const def = V2H.anims[anim];
  const fi = Math.floor((state.time - p._v2t) * 1000 / def.ms) % def.n;
  const img = V2H.imgs[`${anim}_${face}_${fi}`];
  if (!img || !img.complete || !img.naturalWidth) return;
  const S = 0.4, footY = p.y + 5;
  p._v2StaffTip = null;
  // anclar bottom-center: la fila y=89 del frame apoya en footY
  ctx.drawImage(img, p.x - 60 * S, footY - 90 * S, 120 * S, 120 * S);
}
