// =====================================================================
// ui.js — DOM: menú de clases, HUD, inventario, tooltips, toasts.
// =====================================================================

const $ = id => document.getElementById(id);

function buildMenu() {
  const wrap = $('classes');
  wrap.innerHTML = '';
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
  $('coinlabel').textContent = '◉ ' + p.coins + ' monedas';
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

  // Equipo
  const eq = document.createElement('div');
  eq.innerHTML = '<div style="font-size:11px;color:#8a8496;margin-bottom:6px">EQUIPADO</div>';
  const eqGrid = document.createElement('div');
  eqGrid.className = 'slotgrid';
  for (const slot of SLOTS) {
    const it = p.equip[slot];
    eqGrid.appendChild(slotDiv(it, SLOT_LABELS[slot], () => unequipItem(slot)));
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
    <div style="color:${r.color};font-size:10px">${r.name} · ${SLOT_LABELS[item.slot]}</div>
    ${modLines(item)}`;
  const eq = state.player.equip[item.slot];
  if (eq && eq.id !== item.id) {
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
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
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
};

function sfx(name) { if (SFX[name]) SFX[name](); }
