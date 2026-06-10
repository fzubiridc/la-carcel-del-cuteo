// =====================================================================
// items.js — generación de ítems con rareza, mods y escalado por
// profundidad. El nombre del ítem cuenta qué hace ("Yelmo del Oso").
// =====================================================================

let _itemSeq = 0;

function rollRarity(depth) {
  // A más profundidad, más peso a las rarezas altas
  const boost = depth * 2.2;
  const ws = RARITIES.map((r, i) => Math.max(1, r.w + (i > 0 ? boost * i : -boost)));
  const total = ws.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    roll -= ws[i];
    if (roll <= 0) return RARITIES[i];
  }
  return RARITIES[0];
}

function depthMult(depth) { return 1 + (depth - 1) * BALANCE.depthModScale; }

// Genera un ítem aleatorio. slot opcional para forzar tipo.
function makeItem(depth, slot) {
  slot = slot || pick(['arma', 'arma', 'casco', 'coraza', 'botas', 'anillo', 'amuleto']);
  const rarity = rollRarity(depth);
  const item = { id: ++_itemSeq, slot, rarity: rarity.id, mods: {}, def: 0 };

  if (slot === 'arma') {
    item.weaponType = pick(Object.keys(WEAPON_TYPES));
    const wt = WEAPON_TYPES[item.weaponType];
    item.dmg = Math.round(wt.dmg * rarity.mult * depthMult(depth));
    item.baseName = wt.name;
  } else {
    const base = pick(ARMOR_BASES[slot]);
    item.baseName = base.name;
    item.def = Math.round((base.def || 0) * rarity.mult * depthMult(depth));
    if (base.spd) item.mods.spd = base.spd;
  }

  // Mods aleatorios distintos según rareza
  const pool = MODS.slice();
  let suffix = '';
  for (let i = 0; i < rarity.mods && pool.length; i++) {
    const m = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const val = Math.max(1, Math.round(m.base * rarity.mult * depthMult(depth) * (0.7 + Math.random() * 0.6)));
    item.mods[m.key] = (item.mods[m.key] || 0) + val;
    if (!suffix) suffix = m.suffix;
  }

  item.name = item.baseName + (suffix ? ' ' + suffix : '');
  return item;
}

// Arma inicial de clase: común, sin mods
function makeStarterWeapon(weaponType) {
  const wt = WEAPON_TYPES[weaponType];
  return {
    id: ++_itemSeq, slot: 'arma', rarity: 'comun', mods: {}, def: 0,
    weaponType, dmg: wt.dmg, baseName: wt.name,
    name: wt.name + ' gastada',
  };
}

function rarityOf(item) { return RARITIES.find(r => r.id === item.rarity); }

// Stats totales del jugador = base de clase + suma de equipo
function calcStats(p) {
  const base = CLASSES[p.cls];
  const s = { maxhp: base.hp, spd: base.spd, def: base.def, crit: base.crit, dmgB: 0, atkspd: 1 };
  for (const slot of SLOTS) {
    const it = p.equip[slot];
    if (!it) continue;
    s.def += it.def || 0;
    s.maxhp += it.mods.hp || 0;
    s.spd += it.mods.spd || 0;
    s.crit += it.mods.crit || 0;
    s.dmgB += it.mods.dmg || 0;
    s.atkspd += (it.mods.atkspd || 0) / 100;
  }
  p.stats = s;
  p.hp = Math.min(p.hp, s.maxhp);
}

// Daño base por golpe (sin crítico)
function playerDamage(p) {
  const w = p.equip.arma;
  const wdmg = w ? w.dmg : 5;
  return Math.round((wdmg + p.stats.dmgB) * CLASSES[p.cls].dmgMul);
}

function weaponDef(p) {
  const w = p.equip.arma;
  return WEAPON_TYPES[w ? w.weaponType : 'espada'];
}

function attackCooldown(p) {
  return weaponDef(p).cd / p.stats.atkspd;
}

// Reducción de daño por defensa (rendimientos decrecientes)
function applyDefense(dmg, def) {
  return Math.max(1, Math.round(dmg * 100 / (100 + def * 9)));
}
