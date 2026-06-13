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

  if (typeof hasSavedRun === 'function' && hasSavedRun()) {
    const cont = document.createElement('button');
    cont.className = 'btn';
    cont.type = 'button';
    cont.textContent = 'CONTINUAR RUN GUARDADA';
    cont.style.marginTop = '12px';
    cont.onclick = e => { e.stopPropagation(); loadRunFromStorage(); };
    wrap.appendChild(cont);
  }
}

// Recorta una barra de capas por porcentaje. La ventana visible del PNG empieza
// en `off` px y mide `win` px sobre un total de `total` px; el fill llena de
// izquierda a derecha (ver geometría en assets/ui/hud/README.md).
function setBarFill(sel, off, win, total, pct) {
  const clip = document.querySelector(sel + ' .fillclip');
  if (clip) clip.style.width = ((off + win * Math.max(0, Math.min(1, pct))) / total * 100) + '%';
}
// barras vida/maná v2: la ventana ya está delimitada por CSS (.barwin) → clip directo
function setBarPct(sel, pct) {
  const clip = document.querySelector(sel + ' .fillclip');
  if (clip) clip.style.width = (Math.max(0, Math.min(1, pct)) * 100) + '%';
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
  // barra vital (marco v2: ventana delimitada por CSS)
  setBarPct('#hpbar', p.hp / p.stats.maxhp);
  $('hptext').textContent = Math.ceil(p.hp) + ' / ' + p.stats.maxhp;
  $('xplevel').textContent = p.level;
  // barra de maná (real: consumo al castear + regen)
  const manaPct = p.stats.maxMana ? p.mana / p.stats.maxMana : 1;
  setBarPct('#manabar', manaPct);
  $('manatitle').textContent = 'MANÁ ' + Math.round(p.mana) + ' / ' + p.stats.maxMana;
  // XP (ventana 1000×40: x=28 w=944)
  setBarFill('#xpwrap', 28, 944, 1000, p.xp / p.xpNext);
  // extras
  $('zonelabel').textContent = zone.name + (state.level.isBoss ? ' · JEFE' : ' · Piso ' + run.floorInZone);
  $('coinlabel').textContent = '◉ ' + p.coins + ' monedas';
  $('potlabel').textContent = '⚗ ' + p.potions + '/' + BALANCE.maxPotions + ' [Q]   ✦ ' + (p.manaPotions || 0) + '/' + BALANCE.maxPotions + ' [F]';
  const dashFrac = Math.max(0, Math.min(1, p.dashCd / 1.2));
  $('dashcd').style.height = (dashFrac * 100) + '%';
  $('dashwrap').classList.toggle('ready', p.dashCd <= 0);
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
  // vara arcana (PNG 128px): rasterizar grande y detallado para el slot
  const simg = typeof staffIconImg === 'function' ? staffIconImg(item) : null;
  if (simg) {
    c.width = 64; c.height = 64;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
    // la vara se ve chica/fina en el slot: la agrandamos (×1.5) anclada arriba
    // para que la cabeza/cristal resalte, recortando parte del palo de abajo
    const d = 64 * 1.5;
    g.drawImage(simg, (64 - d) / 2, -5, d, d);
    return c;
  }
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

// slot del inventario v2: la pieza recortada es el background, el ícono va centrado.
// meta = { kind:'bag'|'equip'|'quick', idx, slot } para drag & drop y clics.
let invDrag = null;

function invSlotDiv(item, slotImg, extraClass, meta) {
  const d = document.createElement('div');
  d.className = 'invslot ' + extraClass + (item ? ' r-' + item.rarity : '');
  d.style.backgroundImage = `url(assets/ui/hud/inv/${slotImg}.png)`;
  if (meta) Object.assign(d.dataset, meta);
  if (item) {
    const c = iconCanvasFor(item); c.className = 'invicon';
    d.appendChild(c);
    d.onpointerenter = () => { if (!invDrag) showTooltip(item, lastPointer); };
    d.onpointermove = ev => { if (!invDrag) moveTooltip(ev); };
    d.onpointerleave = hideTooltip;
    d.onpointerdown = ev => startInvDrag(ev, item, d);
    d.style.cursor = 'grab';
  }
  return d;
}

let lastPointer = { clientX: 0, clientY: 0 };
window.addEventListener('pointermove', e => { lastPointer = e; }, { passive: true });

// arrancar arrastre (o clic, si no se mueve más que el umbral)
function startInvDrag(ev, item, slotEl) {
  if (ev.button != null && ev.button !== 0) return; // sólo botón principal
  ev.preventDefault();
  hideTooltip();
  invDrag = { item, from: { ...slotEl.dataset }, startX: ev.clientX, startY: ev.clientY,
    shift: ev.shiftKey, moved: false, ghost: null, srcEl: slotEl };
  window.addEventListener('pointermove', onInvDragMove);
  window.addEventListener('pointerup', onInvDragUp);
  window.addEventListener('pointercancel', onInvDragUp); // touch interrumpido: limpiar
}

function onInvDragMove(ev) {
  if (!invDrag) return;
  if (!invDrag.moved) {
    if (Math.hypot(ev.clientX - invDrag.startX, ev.clientY - invDrag.startY) < 6) return;
    invDrag.moved = true;
    const g = iconCanvasFor(invDrag.item); g.className = 'invghost px';
    document.body.appendChild(g);
    invDrag.ghost = g;
    invDrag.srcEl.classList.add('dragging');
  }
  invDrag.ghost.style.left = ev.clientX + 'px';
  invDrag.ghost.style.top = ev.clientY + 'px';
}

function onInvDragUp(ev) {
  window.removeEventListener('pointermove', onInvDragMove);
  window.removeEventListener('pointerup', onInvDragUp);
  window.removeEventListener('pointercancel', onInvDragUp);
  const drag = invDrag; invDrag = null;
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  drag.srcEl.classList.remove('dragging');

  if (ev.type === 'pointercancel') return; // gesto cancelado: el ítem vuelve a su lugar
  // no se movió: fue un clic → acción rápida
  if (!drag.moved) { invSlotClick(drag.from, drag.shift); return; }

  // soltar: ¿sobre qué slot cayó?
  const under = document.elementFromPoint(ev.clientX, ev.clientY);
  const destEl = under && under.closest('.invslot');
  if (!destEl) {
    // soltado fuera de cualquier slot → tirar el ítem al piso (venga de mochila o equipo)
    dropFromSlot(drag.from);
    return;
  }
  resolveInvDrop(drag.from, { ...destEl.dataset });
}

// clic rápido: mochila → equipar (shift = tirar) · equipo → desequipar
function invSlotClick(from, shift) {
  if (from.kind === 'bag') { shift ? dropItem(+from.idx) : equipItem(+from.idx); }
  else if (from.kind === 'equip') unequipItem(from.slot);
}

// mover un ítem de un slot a otro según el tipo de origen y destino
function resolveInvDrop(from, to) {
  const p = state.player;
  if (from.kind === 'bag' && to.kind === 'equip') equipBagToSlot(+from.idx, to.slot);
  else if (from.kind === 'equip' && (to.kind === 'bag' || to.kind === 'quick')) unequipItem(from.slot);
  else if (from.kind === 'bag' && to.kind === 'bag') reorderBag(+from.idx, +to.idx);
  else if (from.kind === 'equip' && to.kind === 'equip') swapEquip(from.slot, to.slot);
  else renderInv();
}

// equipar el ítem de la mochila en un slot concreto (respeta compatibilidad)
function equipBagToSlot(bagIdx, destSlot) {
  const p = state.player, it = p.bag[bagIdx];
  if (!it) { renderInv(); return; }
  const baseSlot = destSlot === 'anillo2' ? 'anillo' : destSlot;
  if (it.slot !== baseSlot) { toast('Eso no va en ' + SLOT_LABELS[destSlot], '#ff6b6b'); renderInv(); return; }
  if (it.slot === 'arma') {
    const wcls = WEAPON_TYPES[it.weaponType].cls;
    if (wcls !== p.cls) { toast('Solo ' + CLASSES[wcls].name + ' usa esa arma', '#ff6b6b'); renderInv(); return; }
  }
  const prev = p.equip[destSlot];
  p.equip[destSlot] = it;
  p.bag[bagIdx] = prev || null; // lo que estaba equipado queda en la celda que liberó
  calcStats(p); sfx('equip'); renderInv();
}

// reordenar la mochila (con huecos): intercambia las celdas i y j (j puede estar vacía)
function reorderBag(i, j) {
  const p = state.player;
  if (i === j) { renderInv(); return; }
  const tmp = p.bag[i]; p.bag[i] = p.bag[j] || null; p.bag[j] = tmp;
  renderInv();
}

// intercambiar dos slots de equipo compatibles (p.ej. los dos anillos)
function swapEquip(a, b) {
  const p = state.player;
  const baseA = a === 'anillo2' ? 'anillo' : a, baseB = b === 'anillo2' ? 'anillo' : b;
  if (baseA !== baseB) { renderInv(); return; }
  const tmp = p.equip[a]; p.equip[a] = p.equip[b]; p.equip[b] = tmp;
  calcStats(p); renderInv();
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
  hint.textContent = 'arrastrá para mover · clic: equipar/desequipar · shift+clic: tirar · I o Esc: cerrar';

  const wrap = document.createElement('div');
  wrap.className = 'invwrap';

  // --- zona del mago: columna izq · (mago + quick) · columna der ---
  const hero = document.createElement('div');
  hero.className = 'invhero';
  const colL = document.createElement('div'); colL.className = 'eqcol';
  const colR = document.createElement('div'); colR.className = 'eqcol';
  const center = document.createElement('div'); center.className = 'herocenter';
  const stage = document.createElement('div');
  stage.className = 'invherostage';
  const plat = document.createElement('img');
  plat.className = 'invplatform'; plat.src = 'assets/ui/hud/inv_platform.png?v=63';
  const himg = document.createElement('canvas');
  himg.className = 'invheroimg px'; himg.width = 120; himg.height = 120;
  { const hg = himg.getContext('2d'); hg.imageSmoothingEnabled = false;
    const f0 = (typeof V2H !== 'undefined' && V2H.imgs) ? V2H.imgs['idle_south_0'] : null;
    if (f0) hg.drawImage(f0, 0, 0, 120, 120); }
  stage.appendChild(plat); stage.appendChild(himg);
  const quick = document.createElement('div');
  quick.className = 'invquick';
  for (let i = 0; i < 5; i++) quick.appendChild(invSlotDiv(null, 'slot_round', 'qslot', { kind: 'quick', idx: i }));
  center.appendChild(stage); center.appendChild(quick);
  for (const [slot, side] of EQ_LAYOUT) {
    const it = p.equip[slot];
    const d = invSlotDiv(it, 'slot_octagon', 'eqslot', { kind: 'equip', slot });
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
    const d = invSlotDiv(it, 'slot_square', 'bagcell', { kind: 'bag', idx: i });
    grid.appendChild(d);
  }
  bag.appendChild(grid);

  // barra de orden de la mochila
  const sortbar = document.createElement('div');
  sortbar.className = 'invsortbar';
  for (const [key, label] of [['tipo', 'Tipo'], ['rareza', 'Rareza'], ['poder', 'Poder']]) {
    const b = document.createElement('button');
    b.className = 'invsortbtn'; b.type = 'button'; b.textContent = label;
    b.onclick = () => sortBag(key);
    sortbar.appendChild(b);
  }
  const bagcol = document.createElement('div');
  bagcol.className = 'invbagcol';
  bagcol.appendChild(sortbar); bagcol.appendChild(bag);

  wrap.appendChild(hero); wrap.appendChild(bagcol);

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

// anima el mago del inventario con el ciclo idle south (el mismo sprite del personaje en juego)
let _invHeroFrame = 0;
setInterval(() => {
  const cv = document.querySelector('#inv .invheroimg');
  if (!cv || !cv.getContext || typeof V2H === 'undefined' || !V2H.ready) return;
  const n = (V2H.anims && V2H.anims.idle.n) || 4;
  _invHeroFrame = (_invHeroFrame + 1) % n;
  const img = V2H.imgs['idle_south_' + _invHeroFrame];
  if (img) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, cv.width, cv.height); }
}, 220);

// ordenar la mochila por tipo / rareza / poder (compacta los huecos al frente)
function sortBag(by) {
  const p = state.player;
  const rarIdx = it => RARITIES.findIndex(r => r.id === it.rarity);
  const power = it => (it.dmg || 0) + (it.def || 0) + (it.hp || 0) * 0.25 + (it.crit || 0) + rarIdx(it) * 4;
  const items = p.bag.filter(Boolean);
  if (by === 'tipo') items.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0) || rarIdx(b) - rarIdx(a));
  else if (by === 'rareza') items.sort((a, b) => rarIdx(b) - rarIdx(a) || power(b) - power(a));
  else if (by === 'poder') items.sort((a, b) => power(b) - power(a));
  for (let i = 0; i < p.bag.length; i++) p.bag[i] = items[i] || null;
  sfx('equip'); renderInv();
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
  const prev = p.equip[dest];
  p.equip[dest] = it;
  p.bag[bagIdx] = prev || null; // lo que estaba equipado queda en la celda que liberó
  calcStats(p);
  sfx('equip');
  renderInv();
}

function unequipItem(slot) {
  const p = state.player;
  const it = p.equip[slot];
  if (!it) return;
  if (!bagAdd(p, it)) { toast('Inventario lleno', '#ff6b6b'); return; }
  p.equip[slot] = null;
  calcStats(p);
  renderInv();
}

function dropItem(bagIdx) {
  const p = state.player;
  const it = p.bag[bagIdx];
  if (!it) return;
  p.bag[bagIdx] = null;
  spawnPickup('item', p.x + randInt(-8, 8), p.y + randInt(-8, 8), it);
  state.pickups[state.pickups.length - 1].noPickT = 1.5;
  renderInv();
}

// tirar al piso un ítem equipado (lo desequipa y recalcula stats)
function dropEquipped(slot) {
  const p = state.player, it = p.equip[slot];
  if (!it) return;
  p.equip[slot] = null;
  spawnPickup('item', p.x + randInt(-8, 8), p.y + randInt(-8, 8), it);
  state.pickups[state.pickups.length - 1].noPickT = 1.5;
  calcStats(p); sfx('equip'); renderInv();
}

// tirar desde cualquier origen del inventario (mochila o equipo)
function dropFromSlot(from) {
  if (from.kind === 'bag') dropItem(+from.idx);
  else if (from.kind === 'equip') dropEquipped(from.slot);
  else renderInv();
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
  if (bagCount(p)) {
    shop.insertAdjacentHTML('beforeend',
      `<div style="font-size:11px;color:#8a8496;margin:12px 0 6px">VENDER (tu mochila)</div>`);
    const sellRow = document.createElement('div');
    sellRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;max-width:560px';
    p.bag.forEach((it, idx) => {
      if (!it) return;
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
  p.bag[bagIdx] = null;
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
  if (bagCount(p) >= BALANCE.bagSize) { toast('Inventario lleno', '#ff6b6b'); return; }
  p.coins -= it.price;
  it.sold = true;
  bagAdd(p, it);
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

// URL del ícono de un ítem (vara arcana = PNG; resto = canvas → dataURL)
function itemIconURL(item) {
  const s = (typeof staffIconImg === 'function') && staffIconImg(item);
  if (s && s.src) return s.src;
  const c = (typeof itemIcon === 'function') && itemIcon(item);
  if (c && c.toDataURL) { try { return c.toDataURL(); } catch (e) { } }
  if (c && c.src) return c.src;
  return '';
}

function showTooltip(item, ev) {
  const tt = $('tooltip');
  const r = rarityOf(item);

  // renglones de stats (derecha del marco). Si sobran renglones del arte, quedan vacíos.
  let stats = `<div style="color:${r.color}">${r.name} · ${SLOT_LABELS[item.slot]}</div>`;
  if (item.material) {
    const mi = MATERIALS.findIndex(m => m.id === item.material);
    stats += `<div>${item.matName} (${mi + 1}/${MATERIALS.length})</div>`;
  }
  if (item.slot === 'arma') {
    const wcls = WEAPON_TYPES[item.weaponType].cls;
    const ok = wcls === state.player.cls;
    stats += `<div style="color:${ok ? '' : '#ff6b6b'}">Clase: ${CLASSES[wcls].name}${ok ? '' : ' ✕'}</div>`;
  }
  stats += modLines(item);

  // caja de descripción: comparación con lo equipado; footer: veredicto / rareza
  let compare = '', foot = `<span style="color:${r.color}">${r.name.toUpperCase()}</span>`;
  const eq = state.player.equip[item.slot];
  if (eq && eq.id !== item.id) {
    const d = itemScore(item) - itemScore(eq);
    foot = d > 0
      ? '<span style="color:#7fc97f">▲ MEJOR QUE LO EQUIPADO</span>'
      : d < 0
        ? '<span style="color:#ff6b6b">▼ PEOR QUE LO EQUIPADO</span>'
        : '<span style="color:#9aa0a6">= SIMILAR A LO EQUIPADO</span>';
    compare = `<div style="color:#8a8496;margin-bottom:2px">Equipado: ${eq.name}</div>${modLines(eq)}`;
  }

  const icon = itemIconURL(item);
  tt.innerHTML = `
    <div class="tt-name" style="color:${r.color}">${item.name}</div>
    <div class="tt-icon">${icon ? `<img src="${icon}">` : ''}</div>
    <div class="tt-stats">${stats}</div>
    <div class="tt-compare">${compare}</div>
    <div class="tt-foot">${foot}</div>`;
  tt.classList.remove('hidden');
  moveTooltip(ev);
}

function moveTooltip(ev) {
  const tt = $('tooltip');
  const x = Math.min(ev.clientX + 16, window.innerWidth - tt.offsetWidth - 10);
  const y = Math.min(ev.clientY + 16, window.innerHeight - tt.offsetHeight - 10);
  tt.style.left = Math.max(6, x) + 'px'; tt.style.top = Math.max(6, y) + 'px';
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
    <div>Piso <b>${run.depth}</b> · Nivel <b>${p.level}</b></div>
    <div><b>${run.kills}</b> criaturas · <b>${p.coins}</b> monedas</div>
    <div>Duración <b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b></div>
  `;
  $('endscreen').classList.remove('hidden');
}

// ---------------- Sonido (sintetizado, sin assets) ----------------

let AC = null;
function initAudio() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    loadSfxBuffers();
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
  chest:  () => { beep(330, 0.12, 'square', 0.05, -80); setTimeout(() => beep(247, 0.12, 'square', 0.05, -60), 110); },
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
// Sonidos por archivo, decodificados a buffers de WebAudio. En iOS los <audio>
// clonados quedan mudos si no los desbloqueó un gesto; con WebAudio (el AC ya
// desbloqueado por el primer toque) suenan bien. Se cargan al iniciar el audio.
const SFX_FILES = {
  cast:   { vol: 0.4 },
  boom:   { vol: 0.55 },
  hurt:   { vol: 0.26, ext: 'mp3', offset: 0.2 },
  dash:   { vol: 0.45, ext: 'mp3' },
  coin:   { vol: 0.4, ext: 'wav', n: 3, lowpass: 1400 }, // 3 variantes; lowpass = suenan más lejanas
  heal:   { vol: 0.5, ext: 'wav' },
  chest:  { vol: 0.5, ext: 'wav' }, // crujido de madera (ex-escalera): ahora al abrir cofres
  equip:  { vol: 0.45, ext: 'wav' },
  swing:  { vol: 0.4, ext: 'wav' },
  rat_death:  { vol: 0.45, ext: 'mp3' }, // chillido de rata al morir
  skel_death: { vol: 0.55, ext: 'mp3' }, // crujido de huesos al morir esqueleto
};
let _sfxLoaded = false;
function loadSfxBuffers() {
  if (_sfxLoaded || !AC) return;
  _sfxLoaded = true;
  for (const name in SFX_FILES) {
    const f = SFX_FILES[name], ext = f.ext || 'm4a';
    const names = f.n ? Array.from({ length: f.n }, (_, i) => name + (i ? i + 1 : '')) : [name];
    f.buffers = [];
    names.forEach((nm, i) => fetch('assets/sfx/' + nm + '.' + ext)
      .then(r => r.arrayBuffer())
      .then(b => AC.decodeAudioData(b))
      .then(buf => { f.buffers[i] = buf; })
      .catch(() => { }));
  }
}
// pasos del prota: sample en loop mientras camina (assets/sfx/footsteps.mp3)
let _footstepSfx = null, _footstepsOn = false;
function setFootsteps(on) {
  if (!_footstepSfx) {
    _footstepSfx = new Audio('assets/sfx/footsteps.mp3');
    _footstepSfx.loop = true; _footstepSfx.volume = 0.6; _footstepSfx.playbackRate = 1.95;
  }
  if (on && !_footstepsOn) { _footstepsOn = true; _footstepSfx.play().catch(() => { }); }
  else if (!on && _footstepsOn) { _footstepsOn = false; _footstepSfx.pause(); }
}

function sfx(name) {
  const f = SFX_FILES[name];
  if (f && AC && f.buffers && f.buffers.length) {
    const buf = f.buffers[(Math.random() * f.buffers.length) | 0]; // variante al azar si hay varias
    if (buf) {
      const src = AC.createBufferSource(); src.buffer = buf;
      const g = AC.createGain(); g.gain.value = f.vol;
      src.connect(g);
      if (f.lowpass) { // apaga agudos → el sonido se percibe más lejano
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f.lowpass;
        g.connect(lp); lp.connect(AC.destination);
      } else g.connect(AC.destination);
      src.start(0, f.offset || 0); // offset recorta delay inicial
      return;
    }
  }
  if (SFX[name]) SFX[name]();
}
