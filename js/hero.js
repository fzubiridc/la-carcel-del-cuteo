// =====================================================================
// hero.js — Integración del rig animado "Animated Hero & Arsenal" de
// Claude Design (módulo ARIG en js/anim-rig.js). Pre-renderiza los frames
// del cuerpo (idle/run/attack/hurt) y las 6 armas × 6 tiers a canvases
// ws=0.5, con variante espejada, para que el motor solo dibuje.
// =====================================================================

// Timings de cada animación (del rig) y orden de frames
const HERO_ANIMS = {
  idle:   { times: [620, 620], loop: true },
  run:    { times: [110, 110, 110, 110], loop: true },
  attack: { times: [80, 70, 150] },   // sin loop → vuelve a idle
  hurt:   { times: [90, 170] },
};

// Mapa de nuestras armas a las del rig + grip pivot (sprite px, 48x48)
const WEAPON_RIG = {
  espada:   'sword',
  martillo: 'hammer',
  arco:     'bow',
  ballesta: 'crossbow',
  baston:   'staff',
  varita:   'wand',
};

function gridToHeroCanvas(g, flash) {
  const c = document.createElement('canvas');
  ARIG.paint(c, g, flash ? { flash } : undefined);
  c.ws = 0.5;
  return c;
}

function buildHero() {
  if (typeof ARIG === 'undefined') return; // sin el rig, queda el fallback por código
  // cuerpo: un canvas por frame de cada animación
  for (const name of ['idle', 'run', 'attack', 'hurt']) {
    const nFrames = ARIG.ANIM[name].frames.length;
    const frames = [];
    for (let i = 0; i < nFrames; i++) {
      frames.push(gridToHeroCanvas(ARIG.frameGrid(name, i), ARIG.frameFlash(name, i)));
    }
    Sprites['hero_' + name] = frames;
    Sprites['hero_' + name + '_L'] = frames.map(flipH);
  }
  // armas: 6 tipos × 6 tiers, con su grip pivot guardado en el canvas
  Sprites.weap = {};
  for (const type of ARIG.WEAPON_ORDER) {
    Sprites.weap[type] = [];
    const grip = ARIG.WEAPONS[type].grip;
    for (let t = 0; t < ARIG.RARITY.length; t++) {
      const c = gridToHeroCanvas(ARIG.weaponGrid(type, t));
      c.gx = grip.x; c.gy = grip.y;
      Sprites.weap[type][t] = c;
    }
  }
}

// Tier visual (0-5) de un arma según su material (madera→adamantio = 0..5)
function weaponTier(item) {
  if (!item || !item.material) return 0;
  const i = MATERIALS.findIndex(m => m.id === item.material);
  return Math.max(0, Math.min(5, i));
}
