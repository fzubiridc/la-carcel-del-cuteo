// =====================================================================
// heropack.js — Renderizador del asset pack final de Claude Design
// (assets/hero/): cuerpo + brazo rotable + equipo paper-doll (6 slots ×
// 6 tiers) + armas, todo en strips de 11 frames sobre la timeline
// idle(0-1)/run(2-5)/attack(6-8)/hurt(9-10).
//
// Datos del manifest.json horneados como constantes (estables) para no
// depender de fetch. Si las imágenes no cargan, drawPlayer cae al rig
// anterior (ARIG) o al sprite por código.
// =====================================================================

const HP = {
  ready: false,
  body: [], bodyHold: [], arm: null,
  equip: {},   // equip[slot][tier] = [11 frames]
  weap: {},    // weap[type] = [6 tiers]
  // timeline (col inicial, cantidad, duraciones ms)
  anims: {
    idle:   { start: 0, n: 2, dur: [620, 620], loop: true },
    run:    { start: 2, n: 4, dur: [110, 110, 110, 110], loop: true },
    attack: { start: 6, n: 3, dur: [80, 70, 150] },
    hurt:   { start: 9, n: 2, dur: [90, 170] },
  },
  // pivote del hombro por frame (donde se ancla el brazo-arma)
  shoulder: [[30,23],[30,23],[30,23],[30,22],[30,23],[30,22],[29,23],[32,24],[31,23],[27,23],[29,23]],
  armShoulder: [24, 31], armHand: [23.5, 13],
  hurtFlash: [0.55, 0.18],
  // orden de compositing de las capas de equipo (body aparte)
  layerOrder: ['cloak', 'boots', 'chest', 'belt', 'gloves', 'helmet'],
  grip: { sword:[23.5,33], hammer:[24,34], bow:[20,24], crossbow:[24,30], staff:[24,32], wand:[24,32] },
};

// nuestros slots/armas → los del pack
const HP_SLOT = { casco: 'helmet', coraza: 'chest', botas: 'boots' };
const HP_WEAP = { espada: 'sword', martillo: 'hammer', arco: 'bow', ballesta: 'crossbow', baston: 'staff', varita: 'wand' };

function hpSlice(img, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    c.getContext('2d').drawImage(img, -i * 48, 0);
    out.push(c);
  }
  return out;
}

function loadHeroPack(done) {
  const slots = ['helmet', 'chest', 'boots', 'gloves', 'cloak', 'belt'];
  const weaps = ['sword', 'hammer', 'bow', 'crossbow', 'staff', 'wand'];
  const jobs = [];
  const add = (src, n, set) => jobs.push({ src, n, set });

  add('assets/hero/body/body.png', 11, f => HP.body = f);
  add('assets/hero/body/body_hold.png', 11, f => HP.bodyHold = f);
  add('assets/hero/arm/weapon_arm.png', 1, f => HP.arm = f[0]);
  for (const s of slots) {
    HP.equip[s] = [];
    for (let t = 0; t < 6; t++) { const ss = s, tt = t; add(`assets/hero/equipment/${s}_t${t}.png`, 11, f => { HP.equip[ss][tt] = f; }); }
  }
  for (const w of weaps) { const ww = w; add(`assets/hero/weapons/${w}.png`, 6, f => { HP.weap[ww] = f; }); }

  let left = jobs.length;
  const finish = () => { if (--left === 0) { HP.ready = HP.body.length === 11 && !!HP.weap.sword; if (done) done(); } };
  for (const j of jobs) {
    const img = new Image();
    img.onload = () => { j.set(hpSlice(img, j.n)); finish(); };
    img.onerror = finish;
    img.src = j.src;
  }
}

// Índice de frame (0-10) dado anim + tiempo transcurrido
function hpFrame(animName, elapsedMs) {
  const a = HP.anims[animName] || HP.anims.idle;
  const total = a.dur.reduce((x, y) => x + y, 0);
  let t = a.loop ? elapsedMs % total : Math.min(elapsedMs, total - 1);
  let acc = 0;
  for (let i = 0; i < a.n; i++) { acc += a.dur[i]; if (t < acc) return a.start + i; }
  return a.start + a.n - 1;
}

function hpTier(item) {
  if (!item || !item.material) return 0;
  const i = MATERIALS.findIndex(m => m.id === item.material);
  return Math.max(0, Math.min(5, i));
}
