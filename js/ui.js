// =====================================================================
// ui.js — DOM: menú de clases, HUD, inventario, tooltips, toasts.
// =====================================================================

const $ = id => document.getElementById(id);

// ---------------- Récords persistentes (localStorage) ----------------

function loadRecords() {
  try { return JSON.parse(localStorage.getItem('cripta_records')) || {}; }
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
  try { localStorage.setItem('cripta_records', JSON.stringify(r)); } catch (e) { }
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
  for (const cls of Object.values(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'classcard panel';
    const icon = document.createElement('canvas');
    icon.width = 12; icon.height = 14;
    icon.getContext('2d').drawImage(composeBase(cls.id, {}), 0, 0);
    card.appendChild(icon);
    const wt = WEAPON_TYPES[cls.weapon];
    card.insertAdjacentHTML('beforeend', `
      <h3>${cls.name}</h3>
      <p>${cls.desc}</p>
      <div class="statline"><span>Vida</span><b>${cls.hp}</b></div>
      <div class="statline"><span>Velocidad</span><b>${cls.spd}</b></div>
      <div class="statline"><span>Defensa</span><b>${cls.def}</b></div>
      <div class="statline"><span>Crítico</span><b>${cls.crit}%</b></div>
      <div class="statline"><span>Arma</span><b>${wt.name}</b></div>
    `);
    const cr = (rec.clases || {})[cls.id];
    if (cr && cr.mejor) {
      card.insertAdjacentHTML('beforeend',
        `<div class="statline" style="margin-top:4px;border-top:1px solid var(--borde);padding-top:4px">
           <span>Mejor</span><b>piso ${cr.mejor}${cr.victorias ? ' · ' + cr.victorias + '🏆' : ''}</b>
         </div>`);
    }
    card.onclick = () => startRun(cls.id);
    wrap.appendChild(card);
  }
}

function updateHUD() {
  const p = state.player, run = state.run;
  if (!p) return;
  const zone = ZONES[run.zoneIdx];
  $('hpfill').style.width = (100 * p.hp / p.stats.maxhp) + '%';
  $('hptext').textContent = Math.ceil(p.hp) + ' / ' + p.stats.maxhp;
  $('zonelabel').textContent = zone.name + (state.level.isBoss ? ' · JEFE' : ' · Piso ' + run.floorInZone);
  $('xpfill').style.width = Math.min(100, 100 * p.xp / p.xpNext) + '%';
  $('lvllabel').textContent = 'Nv. ' + p.level;
  $('coinlabel').textContent = '◉ ' + p.coins + ' monedas';
  $('potlabel').textContent = '⚗ ' + p.potions + '/' + BALANCE.maxPotions + ' [Q]';
  $('dashfill').style.width = (100 * (1 - p.dashCd / 1.2)) + '%';
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

function renderInv() {
  const p = state.player;
  const inv = $('inv');
  inv.innerHTML = '<h2>INVENTARIO</h2>';
  const body = document.createElement('div');
  body.id = 'invbody';

  // Equipo: los slots replican el cuerpo (casco arriba, anillo/arma en las manos...)
  const eq = document.createElement('div');
  eq.innerHTML = '<div style="font-size:11px;color:#8a8496;margin-bottom:6px">EQUIPADO</div>';
  const eqGrid = document.createElement('div');
  eqGrid.className = 'slotgrid';
  for (const slot of SLOTS) {
    const it = p.equip[slot];
    const d = slotDiv(it, SLOT_LABELS[slot], () => unequipItem(slot));
    d.style.gridArea = slot;
    eqGrid.appendChild(d);
  }
  eq.appendChild(eqGrid);

  // Mochila
  const bag = document.createElement('div');
  bag.innerHTML = `<div style="font-size:11px;color:#8a8496;margin-bottom:6px">MOCHILA (${p.bag.length}/${BALANCE.bagSize})</div>`;
  const bagGrid = document.createElement('div');
  bagGrid.id = 'baggrid';
  for (let i = 0; i < BALANCE.bagSize; i++) {
    const it = p.bag[i];
    bagGrid.appendChild(slotDiv(it, '', ev => { if (it) ev.shiftKey ? dropItem(i) : equipItem(i); }));
  }
  bag.appendChild(bagGrid);

  // Stats totales
  const st = document.createElement('div');
  st.id = 'statpanel';
  const s = p.stats;
  st.innerHTML = `
    <div style="font-size:11px;color:#8a8496;margin-bottom:6px">ATRIBUTOS</div>
    Daño: <b>${playerDamage(p)}</b><br>
    Vida: <b>${Math.ceil(p.hp)} / ${s.maxhp}</b><br>
    Defensa: <b>${s.def}</b><br>
    Velocidad: <b>${Math.round(s.spd)}</b><br>
    Crítico: <b>${s.crit}%</b><br>
    Vel. ataque: <b>${(1 / attackCooldown(p)).toFixed(1)}/s</b>
  `;

  body.appendChild(eq); body.appendChild(bag); body.appendChild(st);
  inv.appendChild(body);
  inv.insertAdjacentHTML('beforeend', '<div class="invhint">clic: equipar / desequipar · shift+clic: tirar al piso · I o Esc: cerrar</div>');
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
  p.bag.splice(bagIdx, 1);
  const prev = p.equip[it.slot];
  p.equip[it.slot] = it;
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
  shop.insertAdjacentHTML('beforeend', '<div class="invhint">clic: comprar · E o Esc: cerrar</div>');
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

// ---------------- Pantallas finales ----------------

function showEnd(victory) {
  const run = state.run, p = state.player;
  recordRun(victory);
  $('endtitle').textContent = victory ? '¡VICTORIA!' : 'HAS CAÍDO';
  $('endtitle').style.color = victory ? '#ffd84f' : '#d8403f';
  const zone = ZONES[run.zoneIdx];
  $('endstats').innerHTML = `
    ${victory ? 'Purificaste la Cripta Olvidada con tu ' + CLASSES[p.cls].name.toLowerCase() + '.' : 'Tu historia termina en ' + zone.name + '.'}<br><br>
    Profundidad alcanzada: <b>piso ${run.depth}</b><br>
    Criaturas eliminadas: <b>${run.kills}</b><br>
    Monedas reunidas: <b>${p.coins}</b>
  `;
  $('endscreen').classList.remove('hidden');
}

// ---------------- Sonido (sintetizado, sin assets) ----------------

let AC = null;
function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    startAmbient();
  }
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
  // el drone respira: más presente jugando, casi nada en menús
  setInterval(() => {
    if (!AC) return;
    const target = state.mode === 'play' ? 0.014 : 0.005;
    _droneGain.gain.linearRampToValueAtTime(target, AC.currentTime + 1.5);
  }, 1000);
  scheduleAmbientNote();
}

function scheduleAmbientNote() {
  setTimeout(() => {
    if (AC && state.mode === 'play' && !state.paused) {
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
  step:   () => beep(72 + Math.random() * 14, 0.04, 'triangle', 0.016, -25),
  xp:     () => beep(840 + Math.random() * 280, 0.06, 'sine', 0.03, 240),
  levelup:() => { beep(440, 0.12, 'square', 0.06); setTimeout(() => beep(554, 0.12, 'square', 0.06), 100); setTimeout(() => beep(659, 0.22, 'square', 0.07, 120), 200); },
};

function sfx(name) { if (SFX[name]) SFX[name](); }
