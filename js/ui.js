// =====================================================================
// ui.js — DOM: menú de clases, HUD, inventario, tooltips, toasts.
// =====================================================================

const $ = id => document.getElementById(id);

// ---------------- Récords persistentes (localStorage) ----------------

function loadRecords() {
  try {
    // migración desde el nombre viejo del juego
    return JSON.parse(localStorage.getItem('carcel_records'))
      || JSON.parse(localStorage.getItem('cripta_records')) || {};
  }
  catch (e) { return {}; }
}

function recordRun(victory) {
  const r = loadRecords();
  r.runs = (r.runs || 0) + 1;
  r.kills = (r.kills || 0) + state.run.kills;
  if (victory) r.victorias = (r.victorias || 0) + 1;
  r.clases = r.clases || {};
  const c = r.clases[state.player.cls] || { mejor: 0, victorias: 0 };
  c.mejor = Math.max(c.mejor, state.run.depth);
  if (victory) c.victorias++;
  r.clases[state.player.cls] = c;
  try { localStorage.setItem('carcel_records', JSON.stringify(r)); } catch (e) { }
}

function buildMenu() {
  const wrap = $('classes');
  wrap.innerHTML = '';
  const rec = loadRecords();
  // línea de récords globales
  const rl = $('recordline');
  if (rec.runs) {
    rl.textContent = `Runs: ${rec.runs} · Criaturas eliminadas: ${rec.kills || 0} · Victorias: ${rec.victorias || 0}`;
    rl.classList.remove('hidden');
  } else {
    rl.classList.add('hidden');
  }
  // v2: una sola clase — el Archimago. Card única con el sprite idle animado.
  const cls = CLASSES.mago;
  const card = document.createElement('div');
  card.className = 'classcard panel';
  card.style.cursor = 'pointer';
  const portrait = document.createElement('canvas');
  portrait.width = 128; portrait.height = 152;
  portrait.style.imageRendering = 'pixelated';
  portrait.style.width = '128px'; portrait.style.height = '152px'; // pisa el width:72px del CSS de v1
  card.appendChild(portrait);
  // retrato animado: idle south del pack v2; si aún no cargó, reintenta
  const pg = portrait.getContext('2d');
  pg.imageSmoothingEnabled = false;
  let pf = 0;
  const drawPortrait = () => {
    if (typeof V2H === 'undefined' || !V2H.ready) return;
    const img = V2H.imgs[`idle_south_${pf % 4}`];
    pg.clearRect(0, 0, 128, 152);
    // recorte del personaje dentro del frame 120×120 (x 28-92, y 18-94), escalado ×2
    pg.drawImage(img, 28, 18, 64, 76, 0, 0, 128, 152);
    pf++;
  };
  drawPortrait();
  const portraitTimer = setInterval(() => {
    if (!document.body.contains(portrait)) { clearInterval(portraitTimer); return; }
    drawPortrait();
  }, 220);
  card.insertAdjacentHTML('beforeend', `
    <h3>El Archimago</h3>
    <p>Viejo, lento y absolutamente letal. Su energyblast revienta lo que toca.</p>
    <div class="statline"><span>Vida</span><b>${cls.hp}</b></div>
    <div class="statline"><span>Velocidad</span><b>${cls.spd}</b></div>
    <div class="statline"><span>Crítico</span><b>${cls.crit}%</b></div>
  `);
  const cr = (rec.clases || {}).mago;
  if (cr && cr.mejor) {
    card.insertAdjacentHTML('beforeend',
      `<div class="statline" style="margin-top:4px;border-top:1px solid var(--borde);padding-top:4px">
         <span>Mejor</span><b>piso ${cr.mejor}${cr.victorias ? ' · ' + cr.victorias + '🏆' : ''}</b>
       </div>`);
  }
  card.insertAdjacentHTML('beforeend',
    `<div style="margin-top:10px;text-align:center;color:#ffd84f;font-weight:bold;letter-spacing:1px">▶ ENTRAR A LA CÁRCEL</div>`);
  card.onclick = () => startRun('mago');
  wrap.appendChild(card);
}

// Recorta una barra de capas por porcentaje. La ventana visible del PNG empieza
// en `off` px y mide `win` px sobre un total de `total` px; el fill llena de
// izquierda a derecha (ver geometría en assets/ui/hud/README.md).
function setBarFill(sel, off, win, total, pct) {
  const clip = document.querySelector(sel + ' .fillclip');
  if (clip) clip.style.width = ((off + win * Math.max(0, Math.min(1, pct))) / total * 100) + '%';
}

// Runas según buffs activos del jugador (solo reconstruye si cambió el set)
function updateRunes(p) {
  const b = p.bonus;
  const active = [];
  if (b.hp > 0) active.push('vigor');       // león
  if (b.def > 0) active.push('defensa');    // escudo
  if (b.dmgMul > 1.001) active.push('fuerza');   // hacha
  if (b.spd > 0) active.push('velocidad');  // ala
  if (b.crit > 0) active.push('critico');   // ojo
  if (b.atkspd > 0) active.push('veneno');  // calavera (frenesí: sin runa propia)
  const wrap = $('runes');
  const sig = active.join(',');
  if (wrap.dataset.sig === sig) return;
  wrap.dataset.sig = sig;
  wrap.innerHTML = active.map(n =>
    '<img class="px" src="assets/ui/hud/rune_' + n + '.png" alt="' + n + '">').join('');
}

function updateHUD() {
  const p = state.player, run = state.run;
  if (!p) return;
  const zone = ZONES[run.zoneIdx];
  // barra vital (ventana 420×100: x=40 w=340)
  setBarFill('#hpbar', 40, 340, 420, p.hp / p.stats.maxhp);
  $('hptext').textContent = Math.ceil(p.hp) + ' / ' + p.stats.maxhp;
  $('lvltitle').textContent = 'ARCHIMAGO · NIVEL ' + p.level;
  // barra de maná — PLACEHOLDER: el cast aún no consume maná (ver V2_BACKLOG)
  const manaPct = 1;
  setBarFill('#manabar', 40, 340, 420, manaPct);
  $('manatitle').textContent = 'MANÁ ' + Math.round(350 * manaPct) + ' / 350';
  // XP (ventana 1000×40: x=28 w=944)
  setBarFill('#xpwrap', 28, 944, 1000, p.xp / p.xpNext);
  // extras
  $('zonelabel').textContent = zone.name + (state.level.isBoss ? ' · JEFE' : ' · Piso ' + run.floorInZone);
  $('coinlabel').textContent = '◉ ' + p.coins + ' monedas';
  $('potlabel').textContent = '⚗ ' + p.potions + '/' + BALANCE.maxPotions + ' [Q]';
  $('dashfill').style.width = (100 * (1 - p.dashCd / 1.2)) + '%';
  updateRunes(p);
  updateBossBar();
}

// Cada jefe lleva su propio marco decorativo (PixelLab) con geometría propia:
// slice = esquinas del PNG (px), width = border-width CSS calculado para
// escala 1:1 vertical con el track de 20px (sliceTop + 20 + sliceBottom = alto PNG).
const BOSS_FRAMES = {
  bucle:         { url: 'assets/ui/boss_frame_bucle.png',         slice: '14 17',    width: '14px 17px' },
  golem_anciano: { url: 'assets/ui/boss_frame_golem_anciano.png', slice: '18 20',    width: '18px 20px' },
  liche:         { url: 'assets/ui/boss_frame_liche.png',         slice: '31 26 32', width: '31px 26px 32px' },
};

// Barra del jefe: aparece al entrar a la sala de boss y desaparece al matarlo.
// Fill rojo encima de un "bleed" amarillo que cae más lento (efecto fighting game).
function updateBossBar() {
  const el = $('bossbar');
  if (!el) return;
  const boss = state.enemies && state.enemies.find(e => e.isBoss);
  if (!boss) {
    el.classList.remove('show');
    el.classList.add('hidden');
    return;
  }
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    const f = BOSS_FRAMES[boss.type] || BOSS_FRAMES.bucle;
    const fr = $('bossframe');
    fr.style.borderImageSource = `url('${f.url}')`;
    fr.style.borderImageSlice = f.slice;
    fr.style.borderWidth = f.width;
    void el.offsetWidth; // reflow para que la transición arranque
    el.classList.add('show');
  }
  const pct = Math.max(0, 100 * boss.hp / boss.maxhp);
  $('bossbarfill').style.width = pct + '%';
  $('bossbarbleed').style.width = pct + '%';
  $('bossname').textContent = boss.def.name;
  $('bosshptext').textContent = Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.maxhp;
  el.classList.toggle('crit', pct < 25);
}

// Al subir de nivel: elegir 1 de 3 mejoras al azar (pausa el juego)
function showUpgradeChoice() {
  state.upgradeOpen = true;
  const wrap = $('upgchoices');
  wrap.innerHTML = '';
  const pool = UPGRADES.slice();
  for (let i = 0; i < 3 && pool.length; i++) {
    const u = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const card = document.createElement('div');
    card.className = 'classcard panel';
    card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
    card.onclick = () => {
      u.apply(state.player);
      calcStats(state.player);
      $('upgradescreen').classList.add('hidden');
      state.upgradeOpen = false;
      sfx('equip');
      // si quedó XP acumulada para otro nivel, encadenar
      if (state.player.xp >= state.player.xpNext) triggerLevelUp();
    };
    wrap.appendChild(card);
  }
  $('upgradescreen').classList.remove('hidden');
}

function toast(msg, color) {
  const el = document.createElement('div');
  el.className = 'toastmsg';
  el.textContent = msg;
  if (color) el.style.color = color;
  $('toast').appendChild(el);
  setTimeout(() => el.remove(), 2600);
  while ($('toast').children.length > 4) $('toast').firstChild.remove();
}

function bigToast(msg, color) {
  const el = $('bigtoast');
  el.textContent = msg;
  el.style.color = color || '#ffd84f';
  el.classList.remove('show');
  void el.offsetWidth; // reiniciar animación
  el.classList.add('show');
}

// ---------------- Inventario ----------------

function iconCanvasFor(item) {
  const c = document.createElement('canvas');
  const spr = itemIcon(item);
  c.width = spr.width; c.height = spr.height;
  c.getContext('2d').drawImage(spr, 0, 0);
  return c;
}

function slotDiv(item, placeholder, onclick) {
  const d = document.createElement('div');
  d.className = 'slot' + (item ? ' r-' + item.rarity : '');
  if (item) {
    d.appendChild(iconCanvasFor(item));
    d.onmouseenter = ev => showTooltip(item, ev);
    d.onmousemove = ev => moveTooltip(ev);
    d.onmouseleave = hideTooltip;
  } else {
    d.innerHTML = `<span class="ph">${placeholder}</span>`;
  }
  if (onclick) d.onclick = ev => { hideTooltip(); onclick(ev); };
  return d;
}

// slot del inventario v2: la pieza recortada es el background, el ícono va centrado
function invSlotDiv(item, slotImg, extraClass, onclick) {
  const d = document.createElement('div');
  d.className = 'invslot ' + extraClass + (item ? ' r-' + item.rarity : '');
  d.style.backgroundImage = `url(assets/ui/hud/inv/${slotImg}.png)`;
  if (item) {
    const c = iconCanvasFor(item); c.className = 'invicon';
    d.appendChild(c);
    d.onmouseenter = ev => showTooltip(item, ev);
    d.onmousemove = ev => moveTooltip(ev);
    d.onmouseleave = hideTooltip;
  }
  if (onclick) d.onclick = ev => { hideTooltip(); onclick(ev); };
  return d;
}

// 10 slots de equipo alrededor del mago (5 por lado, de arriba a abajo)
const EQ_LAYOUT = [
  ['casco', 'left', 0], ['amuleto', 'left', 1], ['coraza', 'left', 2], ['guantes', 'left', 3], ['cinturon', 'left', 4],
  ['arma', 'right', 0], ['foco', 'right', 1], ['anillo', 'right', 2], ['anillo2', 'right', 3], ['botas', 'right', 4],
];

function renderInv() {
  const p = state.player;
  const inv = $('inv');
  inv.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'invtitle'; title.textContent = 'INVENTARIO';
  const hint = document.createElement('div');
  hint.className = 'invhint';
  hint.textContent = 'clic: equipar / desequipar · shift+clic: tirar al piso · I o Esc: cerrar';

  const wrap = document.createElement('div');
  wrap.className = 'invwrap';

  // --- zona del mago: columna izq · (mago + quick) · columna der ---
  const hero = document.createElement('div');
  hero.className = 'invhero';
  const colL = document.createElement('div'); colL.className = 'eqcol';
  const colR = document.createElement('div'); colR.className = 'eqcol';
  const center = document.createElement('div'); center.className = 'herocenter';
  const himg = document.createElement('img');
  himg.className = 'invheroimg'; himg.src = 'assets/ui/hud/inv/inv_hero.png';
  const quick = document.createElement('div');
  quick.className = 'invquick';
  for (let i = 0; i < 5; i++) quick.appendChild(invSlotDiv(null, 'slot_round', 'qslot', null));
  center.appendChild(himg); center.appendChild(quick);
  for (const [slot, side] of EQ_LAYOUT) {
    const it = p.equip[slot];
    const d = invSlotDiv(it, 'slot_octagon', 'eqslot', it ? () => unequipItem(slot) : null);
    d.title = SLOT_LABELS[slot];
    (side === 'left' ? colL : colR).appendChild(d);
  }
  hero.appendChild(colL); hero.appendChild(center); hero.appendChild(colR);

  // --- zona de la mochila (marco + grilla 4×6) ---
  const bag = document.createElement('div');
  bag.className = 'invbag';
  const fimg = document.createElement('img');
  fimg.className = 'invframeimg'; fimg.src = 'assets/ui/hud/inv/inv_frame.png';
  bag.appendChild(fimg);
  const grid = document.createElement('div');
  grid.className = 'baggrid';
  for (let i = 0; i < BALANCE.bagSize; i++) {
    const it = p.bag[i];
    const d = invSlotDiv(it, 'slot_square', 'bagcell', it ? ev => ev.shiftKey ? dropItem(i) : equipItem(i) : null);
    grid.appendChild(d);
  }
  bag.appendChild(grid);

  wrap.appendChild(hero); wrap.appendChild(bag);

  // --- atributos (franja abajo) ---
  const s = p.stats;
  const st = document.createElement('div');
  st.id = 'statpanel';
  st.innerHTML = `<span>Daño <b>${playerDamage(p)}</b></span>
    <span>Vida <b>${Math.ceil(p.hp)}/${s.maxhp}</b></span>
    <span>Defensa <b>${s.def}</b></span>
    <span>Vel. <b>${Math.round(s.spd)}</b></span>
    <span>Crítico <b>${s.crit}%</b></span>
    <span>Vel.atq <b>${(1 / attackCooldown(p)).toFixed(1)}/s</b></span>`;

  inv.appendChild(title); inv.appendChild(hint); inv.appendChild(wrap); inv.appendChild(st);
}

function equipItem(bagIdx) {
  const p = state.player;
  const it = p.bag[bagIdx];
  if (!it) return;
  // las armas son exclusivas de su clase
  if (it.slot === 'arma') {
    const wcls = WEAPON_TYPES[it.weaponType].cls;
    if (wcls !== p.cls) {
      toast('Solo ' + CLASSES[wcls].name + ' puede usar: ' + WEAPON_TYPES[it.weaponType].name, '#ff6b6b');
      return;
    }
  }
  // anillos: hay dos slots; si el primero está ocupado y el segundo libre, va al segundo
  let dest = it.slot;
  if (it.slot === 'anillo' && p.equip.anillo && !p.equip.anillo2) dest = 'anillo2';
  p.bag.splice(bagIdx, 1);
  const prev = p.equip[dest];
  p.equip[dest] = it;
  if (prev) p.bag.push(prev);
  calcStats(p);
  sfx('equip');
  renderInv();
}

function unequipItem(slot) {
  const p = state.player;
  const it = p.equip[slot];
  if (!it) return;
  if (slot === 'arma') { toast('No podés quedarte sin arma', '#ff6b6b'); return; }
  if (p.bag.length >= BALANCE.bagSize) { toast('Inventario lleno', '#ff6b6b'); return; }
  p.equip[slot] = null;
  p.bag.push(it);
  calcStats(p);
  renderInv();
}

function dropItem(bagIdx) {
  const p = state.player;
  const it = p.bag.splice(bagIdx, 1)[0];
  if (!it) return;
  spawnPickup('item', p.x + randInt(-8, 8), p.y + randInt(-8, 8), it);
  state.pickups[state.pickups.length - 1].noPickT = 1.5;
  renderInv();
}

// ---------------- Mercader ----------------

function openShop() {
  state.shopOpen = true;
  renderShop();
  $('shop').classList.remove('hidden');
  sfx('pickup');
}

function closeShop() {
  state.shopOpen = false;
  $('shop').classList.add('hidden');
  hideTooltip();
}

function renderShop() {
  const p = state.player;
  const stock = state.level.shopStock;
  const shop = $('shop');
  shop.innerHTML = `<h2>MERCADER</h2>
    <div style="font-size:12px;color:#ffd84f;margin-bottom:10px">Tus monedas: ◉ ${p.coins}</div>`;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px';

  for (const it of stock.items) {
    const card = document.createElement('div');
    card.className = 'shopcard panel' + (it.sold ? ' sold' : '');
    if (it.sold) {
      card.innerHTML = '<div class="soldtag">VENDIDO</div>';
    } else {
      const r = rarityOf(it);
      card.appendChild(iconCanvasFor(it));
      card.insertAdjacentHTML('beforeend',
        `<div class="shopname" style="color:${r.color}">${it.name}</div>
         <div class="shopprice">◉ ${it.price}</div>`);
      card.onmouseenter = ev => showTooltip(it, ev);
      card.onmousemove = ev => moveTooltip(ev);
      card.onmouseleave = hideTooltip;
      card.onclick = () => buyItem(it);
    }
    row.appendChild(card);
  }

  // poción de vida (máx. 3 encima)
  const heal = document.createElement('div');
  heal.className = 'shopcard panel';
  heal.innerHTML = `<div style="font-size:26px">⚗</div>
    <div class="shopname" style="color:#f08a88">Poción de vida (${p.potions}/${BALANCE.maxPotions})</div>
    <div class="shopprice">◉ ${stock.healPrice}</div>`;
  heal.onclick = () => {
    if (p.potions >= BALANCE.maxPotions) { toast('Ya llevás ' + BALANCE.maxPotions + ' pociones', '#8a8496'); return; }
    if (p.coins < stock.healPrice) { toast('No te alcanzan las monedas', '#ff6b6b'); return; }
    p.coins -= stock.healPrice;
    p.potions++;
    sfx('pickup');
    renderShop();
  };
  row.appendChild(heal);

  shop.appendChild(row);

  // sección de venta: tu mochila, con lo que paga el mercader
  if (p.bag.length) {
    shop.insertAdjacentHTML('beforeend',
      `<div style="font-size:11px;color:#8a8496;margin:12px 0 6px">VENDER (tu mochila)</div>`);
    const sellRow = document.createElement('div');
    sellRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;max-width:560px';
    p.bag.forEach((it, idx) => {
      const d = document.createElement('div');
      d.className = 'slot r-' + it.rarity;
      d.style.position = 'relative';
      d.appendChild(iconCanvasFor(it));
      d.insertAdjacentHTML('beforeend',
        `<div class="sellprice">◉${sellPrice(it)}</div>`);
      d.onmouseenter = ev => showTooltip(it, ev);
      d.onmousemove = ev => moveTooltip(ev);
      d.onmouseleave = hideTooltip;
      d.onclick = () => sellItem(idx);
      sellRow.appendChild(d);
    });
    shop.appendChild(sellRow);
  }

  shop.insertAdjacentHTML('beforeend', '<div class="invhint">clic arriba: comprar · clic abajo: vender · E o Esc: cerrar</div>');
}

function sellItem(bagIdx) {
  const p = state.player;
  const it = p.bag[bagIdx];
  if (!it) return;
  p.bag.splice(bagIdx, 1);
  p.coins += sellPrice(it);
  toast('Vendiste ' + it.name + ' por ◉ ' + sellPrice(it), '#ffd84f');
  sfx('coin');
  hideTooltip();
  renderShop();
}

function buyItem(it) {
  const p = state.player;
  if (it.sold) return;
  if (p.coins < it.price) { toast('No te alcanzan las monedas', '#ff6b6b'); return; }
  if (p.bag.length >= BALANCE.bagSize) { toast('Inventario lleno', '#ff6b6b'); return; }
  p.coins -= it.price;
  it.sold = true;
  p.bag.push(it);
  toast('Compraste: ' + it.name, rarityOf(it).color);
  sfx('coin');
  hideTooltip();
  renderShop();
}

// ---------------- Tooltip ----------------

function modLines(item) {
  let out = '';
  if (item.slot === 'arma') out += `<div>Daño: ${item.dmg}</div>`;
  if (item.def) out += `<div>Defensa: ${item.def}</div>`;
  for (const m of MODS) {
    if (item.mods[m.key]) out += `<div class="mod">+${item.mods[m.key]} ${m.label}</div>`;
  }
  return out;
}

function showTooltip(item, ev) {
  const tt = $('tooltip');
  const r = rarityOf(item);
  let html = `<div class="iname" style="color:${r.color}">${item.name}</div>
    <div style="color:${r.color};font-size:10px">${r.name} · ${SLOT_LABELS[item.slot]}</div>`;

  // material con su posición en la escalera de calidad
  if (item.material) {
    const mi = MATERIALS.findIndex(m => m.id === item.material);
    html += `<div style="font-size:10px;color:#8a8496">Material: ${item.matName} (${mi + 1}/${MATERIALS.length})</div>`;
  }
  // restricción de clase de las armas
  if (item.slot === 'arma') {
    const wcls = WEAPON_TYPES[item.weaponType].cls;
    const ok = wcls === state.player.cls;
    html += `<div style="font-size:10px;color:${ok ? '#8a8496' : '#ff6b6b'}">Clase: ${CLASSES[wcls].name}${ok ? '' : ' — no podés usarla'}</div>`;
  }
  html += modLines(item);

  const eq = state.player.equip[item.slot];
  if (eq && eq.id !== item.id) {
    // veredicto rápido: ¿mejor o peor que lo puesto?
    const d = itemScore(item) - itemScore(eq);
    const verdict = d > 0
      ? '<span style="color:#7fc97f">▲ Mejor que lo equipado</span>'
      : d < 0
        ? '<span style="color:#ff6b6b">▼ Peor que lo equipado</span>'
        : '<span style="color:#9aa0a6">= Similar a lo equipado</span>';
    html += `<div style="margin-top:4px;font-size:12px">${verdict}</div>`;
    html += `<div class="cmp">Equipado: ${eq.name}${modLines(eq)}</div>`;
  }
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  moveTooltip(ev);
}

function moveTooltip(ev) {
  const tt = $('tooltip');
  const x = Math.min(ev.clientX + 16, window.innerWidth - 260);
  const y = Math.min(ev.clientY + 16, window.innerHeight - tt.offsetHeight - 10);
  tt.style.left = x + 'px'; tt.style.top = y + 'px';
}

function hideTooltip() { $('tooltip').classList.add('hidden'); }

// Resumen de la run en la pantalla de pausa
function renderPauseStats() {
  const p = state.player, run = state.run, s = p.stats;
  const zone = ZONES[run.zoneIdx];
  const equipo = SLOTS.map(slot => {
    const it = p.equip[slot];
    return it ? `<span style="color:${rarityOf(it).color}">${it.name}</span>` : null;
  }).filter(Boolean).join(' · ');
  $('pausestats').innerHTML = `
    <b>${zone.name}</b> · ${state.level.isBoss ? 'JEFE' : 'piso ' + run.floorInZone} (profundidad ${run.depth})<br>
    Nivel <b>${p.level}</b> · ${run.kills} criaturas · ◉ ${p.coins} monedas · ⚗ ${p.potions}<br>
    Daño <b>${playerDamage(p)}</b> · Defensa <b>${s.def}</b> · Crítico <b>${s.crit}%</b> ·
    Vel. ataque <b>${(1 / attackCooldown(p)).toFixed(1)}/s</b><br>
    <span style="font-size:11px">${equipo}</span>
  `;
}

// ---------------- Pantallas finales ----------------

function showEnd(victory) {
  const run = state.run, p = state.player;
  recordRun(victory);
  $('endtitle').textContent = victory ? '¡VICTORIA!' : 'HAS CAÍDO';
  $('endtitle').style.color = victory ? '#ffd84f' : '#d8403f';
  const zone = ZONES[run.zoneIdx];
  const t = Math.round(run.time || 0);
  const equipo = SLOTS.map(slot => {
    const it = p.equip[slot];
    return it ? `<span style="color:${rarityOf(it).color}">${it.name}</span>` : null;
  }).filter(Boolean).join(' · ');
  $('endstats').innerHTML = `
    ${victory ? 'Escapaste de la Cárcel del Cuteo con tu ' + CLASSES[p.cls].name.toLowerCase() + '.' : 'Tu historia termina en ' + zone.name + '.'}<br><br>
    Profundidad alcanzada: <b>piso ${run.depth}</b> · Nivel <b>${p.level}</b><br>
    Criaturas eliminadas: <b>${run.kills}</b> · Monedas: <b>${p.coins}</b><br>
    Duración: <b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b><br>
    <span style="font-size:11px">${equipo}</span>
  `;
  $('endscreen').classList.remove('hidden');
}

// ---------------- Sonido (sintetizado, sin assets) ----------------

let AC = null;
function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    startAmbient();
    startMusic();
  }
}

// ---------------- Música ambiental (assets/music.mp3, opcional) ----------------
// Si el archivo existe, suena en loop y el drone sintetizado se apaga.
// Si no existe (p. ej. en el build publicado), queda el ambiente por código.

let music = null, musicOk = false, musicMuted = false;

function startMusic() {
  if (music) return;
  music = new Audio('assets/music.mp3');
  music.loop = true;
  music.volume = 0.22;
  music.addEventListener('canplay', () => { musicOk = true; });
  music.onerror = () => { musicOk = false; };
  music.play().catch(() => { /* autoplay bloqueado: reintenta en el próximo gesto */ });
}

function musicActive() {
  return musicOk && music && !music.paused && !musicMuted;
}

function toggleMusic() {
  if (!musicOk) { toast('No hay música cargada (assets/music.mp3)', '#8a8496'); return; }
  musicMuted = !musicMuted;
  music.muted = musicMuted;
  toast(musicMuted ? 'Música silenciada' : 'Música activada', '#8a8496');
}

// ---------------- Ambiente procedural (drone + notas sueltas) ----------------

let _droneGain = null;
function startAmbient() {
  if (!AC || _droneGain) return;
  // drone grave, dos osciladores levemente desafinados
  _droneGain = AC.createGain();
  _droneGain.gain.value = 0.006;
  _droneGain.connect(AC.destination);
  for (const f of [55, 55.7]) {
    const o = AC.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    o.connect(_droneGain); o.start();
  }
  // el drone respira: más presente jugando, casi nada en menús,
  // y se apaga del todo si hay música de archivo sonando
  setInterval(() => {
    if (!AC) return;
    const target = musicActive() ? 0.0001 : (state.mode === 'play' ? 0.014 : 0.005);
    _droneGain.gain.linearRampToValueAtTime(target, AC.currentTime + 1.5);
  }, 1000);
  scheduleAmbientNote();
}

function scheduleAmbientNote() {
  setTimeout(() => {
    if (AC && state.mode === 'play' && !state.paused && !musicActive()) {
      // nota suelta de la escala menor, muy suave, ataque y caída lentos
      const notes = [110, 123.5, 130.8, 146.8, 164.8, 196];
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'triangle';
      o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.02, AC.currentTime + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 2.8);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + 3);
    }
    scheduleAmbientNote();
  }, 2800 + Math.random() * 4500);
}

function beep(freq, dur, type, vol, slide) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), AC.currentTime + dur);
  g.gain.value = vol || 0.05;
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}

const SFX = {
  swing:  () => beep(220, 0.08, 'sawtooth', 0.04, -120),
  hit:    () => beep(160, 0.1, 'square', 0.06, -80),
  shoot:  () => beep(700, 0.09, 'square', 0.04, -300),
  cast:   () => beep(380, 0.15, 'sine', 0.06, 240),
  boom:   () => beep(90, 0.25, 'sawtooth', 0.08, -50),
  eshoot: () => beep(300, 0.1, 'triangle', 0.035, -120),
  hurt:   () => beep(130, 0.2, 'sawtooth', 0.08, -60),
  die:    () => beep(200, 0.18, 'triangle', 0.06, -150),
  bossdie:() => { beep(160, 0.5, 'sawtooth', 0.09, -120); setTimeout(() => beep(330, 0.4, 'square', 0.06, 200), 150); },
  coin:   () => beep(1100, 0.07, 'square', 0.035, 300),
  heal:   () => beep(520, 0.15, 'sine', 0.05, 200),
  pickup: () => beep(660, 0.12, 'square', 0.05, 220),
  equip:  () => beep(440, 0.1, 'triangle', 0.05, 100),
  stairs: () => { beep(330, 0.12, 'square', 0.05, -80); setTimeout(() => beep(247, 0.12, 'square', 0.05, -60), 110); },
  summon: () => beep(250, 0.2, 'sine', 0.05, 150),
  tackle: () => { beep(70, 0.3, 'sawtooth', 0.11, -30); setTimeout(() => beep(50, 0.2, 'square', 0.07, -20), 80); },
  kick:   () => beep(140, 0.18, 'square', 0.09, -90),
  dash:   () => beep(520, 0.1, 'sine', 0.05, -260),
  smash:  () => beep(95, 0.2, 'square', 0.1, -55),
  step:   () => beep(72 + Math.random() * 14, 0.04, 'triangle', 0.016, -25),
  xp:     () => beep(840 + Math.random() * 280, 0.06, 'sine', 0.03, 240),
  levelup:() => { beep(440, 0.12, 'square', 0.06); setTimeout(() => beep(554, 0.12, 'square', 0.06), 100); setTimeout(() => beep(659, 0.22, 'square', 0.07, 120), 200); },
};

// Sonidos por archivo (assets/sfx/*.m4a): pisan al sintetizado si existen.
// Volumen por sonido porque los packs vienen a niveles distintos.
const SFX_FILES = { cast: { vol: 0.4 }, boom: { vol: 0.55 } };
for (const name in SFX_FILES) {
  const a = new Audio('assets/sfx/' + name + '.m4a');
  a.preload = 'auto';
  a.addEventListener('canplaythrough', () => { SFX_FILES[name].audio = a; }, { once: true });
  a.onerror = () => { delete SFX_FILES[name]; }; // sin archivo → queda el sintetizado
}
function sfx(name) {
  const f = SFX_FILES[name];
  if (f && f.audio) {
    const inst = f.audio.cloneNode(); // permite solaparse (disparos seguidos)
    inst.volume = f.vol;
    inst.play().catch(() => { });
    return;
  }
  if (SFX[name]) SFX[name]();
}
