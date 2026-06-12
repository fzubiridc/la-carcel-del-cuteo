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

// El material sube con la profundidad, con algo de azar (±1 escalón)
function rollMaterial(depth) {
  const center = Math.min(MATERIALS.length - 1, (depth - 1) / 1.6);
  const idx = Math.max(0, Math.min(MATERIALS.length - 1, Math.round(center + (Math.random() * 2 - 1))));
  return MATERIALS[idx];
}

// Genera un ítem aleatorio. slot opcional para forzar tipo.
// Material → stat base · Rareza → cantidad de mods extra · Profundidad → valor de los mods
function makeItem(depth, slot) {
  slot = slot || pick(['arma', 'arma', 'casco', 'coraza', 'botas', 'anillo', 'amuleto']);
  const rarity = rollRarity(depth);
  const mat = rollMaterial(depth);
  const item = { id: ++_itemSeq, slot, rarity: rarity.id, material: mat.id, matName: mat.name, mods: {}, def: 0 };

  if (slot === 'arma') {
    // las armas que aparecen son siempre de tu clase (cualquiera de sus tipos)
    const cls = state.player ? state.player.cls : null;
    const opciones = cls
      ? Object.keys(WEAPON_TYPES).filter(k => WEAPON_TYPES[k].cls === cls)
      : Object.keys(WEAPON_TYPES);
    item.weaponType = pick(opciones);
    const wt = WEAPON_TYPES[item.weaponType];
    item.dmg = Math.round(wt.dmg * mat.mult * rarity.mult);
    item.baseName = wt.name;
  } else {
    const base = pick(ARMOR_BASES[slot]);
    item.baseName = base.name;
    item.def = Math.round((base.def || 0) * mat.mult * rarity.mult);
    if (base.spd) item.mods.spd = base.spd;
    if (base.dmg) item.mods.dmg = Math.max(1, Math.round(base.dmg * mat.mult * rarity.mult));
    if (base.hp) item.mods.hp = Math.round(base.hp * mat.mult * rarity.mult);
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

  item.name = item.baseName + ' de ' + mat.name + (suffix ? ' ' + suffix : '');
  return item;
}

// Arma inicial de clase: de madera, común, sin mods
function makeStarterWeapon(weaponType) {
  const wt = WEAPON_TYPES[weaponType];
  const mat = MATERIALS[0];
  return {
    id: ++_itemSeq, slot: 'arma', rarity: 'comun', material: mat.id, matName: mat.name,
    mods: {}, def: 0,
    weaponType, dmg: Math.round(wt.dmg * mat.mult), baseName: wt.name,
    name: wt.name + ' de ' + mat.name,
  };
}

// Ítem garantizado raro o mejor (altar, cofre dorado)
function makeItemMinRare(depth) {
  let it = null;
  for (let i = 0; i < 8; i++) {
    it = makeItem(depth);
    if (it.rarity === 'raro' || it.rarity === 'epico') return it;
  }
  return it;
}

// Lo que paga el mercader por tus ítems (menos de lo que cobra, claro)
function sellPrice(it) {
  return Math.max(2, Math.round(itemScore(it) * 0.45));
}

// Stock del mercader: 3 ítems según profundidad + curación
function makeShopStock(depth) {
  const items = [];
  for (let i = 0; i < 3; i++) {
    const it = makeItem(depth + 1);
    it.price = Math.round(12 + itemScore(it) * 0.9);
    items.push(it);
  }
  return { items, healPrice: 30 };
}

// Puntaje heurístico para comparar dos ítems del mismo slot (flecha ▲/▼ del tooltip)
function itemScore(it) {
  let s = (it.dmg || 0) * 2 + (it.def || 0) * 2;
  const m = it.mods || {};
  s += (m.dmg || 0) * 2 + (m.def || 0) * 2 + (m.hp || 0) * 0.4
     + (m.spd || 0) * 0.8 + (m.crit || 0) + (m.atkspd || 0) * 0.6;
  return s;
}

function rarityOf(item) { return RARITIES.find(r => r.id === item.rarity); }

// Stats totales del jugador = base de clase + mejoras de nivel + suma de equipo
function calcStats(p) {
  const base = CLASSES[p.cls];
  const b = p.bonus || { hp: 0, spd: 0, crit: 0, atkspd: 0, def: 0, dmgMul: 1 };
  const s = { maxhp: base.hp + b.hp, spd: base.spd + b.spd, def: base.def + b.def,
    crit: base.crit + b.crit, dmgB: 0, atkspd: 1 + b.atkspd,
    maxMana: (p.cls === 'mago' ? 350 : 120) + ((b.mana) || 0) };
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

// ---------------- Mochila (array con huecos: índice fijo por celda) ----------------
// Pone un ítem en la primera celda libre. Devuelve true si entró.
function bagAdd(p, item) {
  for (let i = 0; i < BALANCE.bagSize; i++) {
    if (!p.bag[i]) { p.bag[i] = item; return true; }
  }
  return false;
}
function bagCount(p) { return p.bag.reduce((n, it) => n + (it ? 1 : 0), 0); }

// Daño base por golpe (sin crítico)
function playerDamage(p) {
  const w = p.equip.arma;
  const wdmg = w ? w.dmg : weaponDef(p).dmg; // sin arma: daño del ataque desarmado
  return Math.round((wdmg + p.stats.dmgB) * CLASSES[p.cls].dmgMul * (p.bonus ? p.bonus.dmgMul : 1));
}

// arma desarmada por clase (al quedarte sin equipo): el mago tira una chispa débil
const UNARMED = { mago: 'chispa', guerrero: 'espada', arquero: 'arco' };
function weaponDef(p) {
  const w = p.equip.arma;
  return WEAPON_TYPES[w ? w.weaponType : (UNARMED[p.cls] || 'espada')];
}

function attackCooldown(p) {
  return weaponDef(p).cd / p.stats.atkspd;
}

// Reducción de daño por defensa (rendimientos decrecientes)
function applyDefense(dmg, def) {
  return Math.max(1, Math.round(dmg * 100 / (100 + def * 9)));
}
