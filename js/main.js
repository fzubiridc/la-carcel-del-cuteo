// =====================================================================
// main.js — estado global, loop, input, render y progresión de pisos.
// =====================================================================

const state = {
  mode: 'menu', // menu | play | dead | win
  invOpen: false, paused: false, upgradeOpen: false, shopOpen: false,
  player: null, run: null, level: null,
  enemies: [], projs: [], pickups: [], chests: [],
  particles: [], floaters: [], fx: [],
  cam: { x: 0, y: 0 }, shake: 0, time: 0, winT: 0,
  explored: null,
};

let canvas, ctx, mini, mctx;
let ZOOM = 3;
let _darkCv = null, _darkCx = null; // capa de oscuridad offscreen (pisos "oscuro")
const keys = new Set();
const mouse = { sx: 0, sy: 0, down: false };
// Controles táctiles: joystick de movimiento + botón ATK que también apunta
// (tocás = atacar con auto-aim; arrastrás sobre él = apuntar manual)
const touch = { enabled: false, stickId: null, baseX: 0, baseY: 0, vx: 0, vy: 0,
  attacking: false, atkId: null, aimBaseX: 0, aimBaseY: 0, aimX: 0, aimY: 0, aimActive: false };

// ---------------- Init ----------------

window.addEventListener('load', () => {
  buildSprites();
  if (typeof buildHero === 'function') buildHero();
  if (typeof loadHeroPack === 'function') loadHeroPack(); // asset pack final del héroe (reemplaza en caliente)
  if (typeof loadV2Hero === 'function') loadV2Hero(); // mago v2 experimental (PixelLab)
  if (typeof loadSkeleton === 'function') loadSkeleton(); // esqueleto v2 8-dir (PixelLab)
  if (typeof loadSlime === 'function') loadSlime(); // slimes CraftPix (sheets 64×64)
  loadAssets(); // los CC0 de 32px reemplazan en caliente; hay fallback por código
  if (typeof loadStaffIcons === 'function') loadStaffIcons(); // íconos de vara arcana por tier (PixelLab)
  if (typeof loadCoinPiles === 'function') loadCoinPiles(); // pilas de monedas por valor
  if (typeof preloadInvAssets === 'function') preloadInvAssets(); // evita el lag de abrir el inventario por 1ª vez
  if (typeof loadXpFlames === 'function') loadXpFlames(); // llamas de experiencia (colores)
  if (typeof loadStairsImg === 'function') loadStairsImg(); // escalera de bajada
  if (typeof loadChestImg === 'function') loadChestImg(); // cofre cerrado/abierto
  if (typeof loadTowerTiles === 'function') loadTowerTiles(); // tileset Torre en Ruinas (8+8 variantes)
  if (typeof loadDungeonTiles === 'function') loadDungeonTiles(); // tileset CraftPix (prueba piso 2)
  if (typeof loadTorchImg === 'function') loadTorchImg(); // antorcha animada (sheet 8 frames)
  canvas = $('game'); ctx = canvas.getContext('2d');
  mini = $('minimap'); mctx = mini.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  // iOS: la barra del navegador aparece/desaparece sin disparar window.resize
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  bindInput();
  buildMenu();
  requestAnimationFrame(loop);
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
  ZOOM = Math.max(2, Math.round(window.innerHeight / 240));
  // escala del HUD v2 (diseñado a 1920 de ancho; no deja que ocupe de más en chico)
  const huds = Math.min(1.05, Math.max(0.46, window.innerWidth / 1920));
  document.documentElement.style.setProperty('--huds', huds);
}

function bindInput() {
  window.addEventListener('keydown', e => {
    initAudio();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'i' || k === 'tab') { e.preventDefault(); toggleInv(); }
    if (k === 'escape') {
      if (state.shopOpen) closeShop();
      else if (state.invOpen) toggleInv();
      else if (state.mode === 'play') togglePause();
    }
    if (k === 'e') tryInteract();
    if (k === ' ') { e.preventDefault(); tryDash(); }
    if (k === 'q') drinkPotion();
    if (k === 'f') drinkManaPotion();
    if (k === 'm') toggleMusic();
    // autoplay: si la música quedó bloqueada, este gesto la destraba
    if (music && music.paused && musicOk && !musicMuted) music.play().catch(() => { });
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', e => { mouse.sx = e.clientX; mouse.sy = e.clientY; });
  canvas.addEventListener('mousedown', e => { initAudio(); if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // REINTENTAR: arranca una run nueva directo con la misma clase. MENÚ: vuelve al menú.
  $('endbtn').onclick = () => { const cls = (state.player && state.player.cls) || 'mago'; $('endscreen').classList.add('hidden'); startRun(cls); };
  $('endbtn2').onclick = () => { $('endscreen').classList.add('hidden'); backToMenu(); };
  $('resumebtn').onclick = togglePause;
  // Botón debug: salta directo a la sala de jefe de la zona actual
  $('debugboss').onclick = () => {
    if (!state.run) return;
    state.run.floorInZone = ZONES[state.run.zoneIdx].floors;
    nextFloor();
  };
  bindTouch();
}

function bindTouch() {
  touch.enabled = 'ontouchstart' in window;
  if (!touch.enabled) return;
  $('touchui').classList.remove('hidden');
  $('hint').style.display = 'none'; // el hint de teclado no aplica en táctil

  const jz = $('joyzone'), base = $('joybase'), knob = $('joyknob');
  const RADIO = 40;
  jz.addEventListener('touchstart', e => {
    e.preventDefault(); initAudio();
    const t = e.changedTouches[0];
    touch.stickId = t.identifier;
    touch.baseX = t.clientX; touch.baseY = t.clientY;
    base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px';
    knob.style.left = '50%'; knob.style.top = '50%';
    base.classList.remove('hidden');
  }, { passive: false });
  jz.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.stickId) continue;
      let dx = t.clientX - touch.baseX, dy = t.clientY - touch.baseY;
      const d = Math.hypot(dx, dy);
      if (d > RADIO) { dx = dx / d * RADIO; dy = dy / d * RADIO; }
      touch.vx = dx / RADIO; touch.vy = dy / RADIO;
      knob.style.left = (50 + dx / 84 * 100) + '%';
      knob.style.top = (50 + dy / 84 * 100) + '%';
    }
  }, { passive: false });
  const endStick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.stickId) continue;
      touch.stickId = null; touch.vx = 0; touch.vy = 0;
      base.classList.add('hidden');
    }
  };
  jz.addEventListener('touchend', endStick);
  jz.addEventListener('touchcancel', endStick);

  const bind = (id, down, up) => {
    const b = $(id);
    b.addEventListener('touchstart', e => { e.preventDefault(); initAudio(); down(); }, { passive: false });
    if (up) b.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false });
  };
  // ATK: presionar ataca (auto-aim); arrastrar el dedo sobre él apunta manual
  const atk = $('btnatk');
  const RADIO_AIM = 12; // px de zona muerta antes de activar puntería manual
  atk.addEventListener('touchstart', e => {
    e.preventDefault(); initAudio();
    const t = e.changedTouches[0];
    touch.atkId = t.identifier;
    touch.aimBaseX = t.clientX; touch.aimBaseY = t.clientY;
    touch.attacking = true;
  }, { passive: false });
  atk.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.atkId) continue;
      const dx = t.clientX - touch.aimBaseX, dy = t.clientY - touch.aimBaseY;
      const d = Math.hypot(dx, dy);
      if (d > RADIO_AIM) {
        touch.aimActive = true;
        touch.aimX = dx / d; touch.aimY = dy / d;
      }
    }
  }, { passive: false });
  const endAtk = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.atkId) continue;
      touch.atkId = null;
      touch.attacking = false;
      touch.aimActive = false;
    }
  };
  atk.addEventListener('touchend', endAtk);
  atk.addEventListener('touchcancel', endAtk);

  bind('btndash', () => tryDash());
  bind('btnpot', () => drinkPotion());
  bind('btnint', () => tryInteract());
}

// Ángulo de apuntado: ratón en escritorio, auto-apuntado al enemigo
// más cercano en táctil (si no hay, hacia donde te movés)
function aimAngle() {
  const p = state.player;
  if (!touch.enabled) return Math.atan2(mouseWorldY() - p.y, mouseWorldX() - p.x);
  // puntería manual: el dedo arrastrado sobre el botón ATK manda
  if (touch.aimActive) return Math.atan2(touch.aimY, touch.aimX);
  let best = null, bd = 12 * TILE;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return Math.atan2(best.y - p.y, best.x - p.x);
  if (touch.vx || touch.vy) return Math.atan2(touch.vy, touch.vx);
  return p.dir >= 0 ? 0 : Math.PI;
}

function toggleInv() {
  if (state.upgradeOpen) return;
  if (state.mode !== 'play' && !state.invOpen) return;
  state.invOpen = !state.invOpen;
  $('inv').classList.toggle('hidden', !state.invOpen);
  hideTooltip();
  if (state.invOpen) renderInv();
}

function togglePause() {
  if (state.mode !== 'play') return;
  state.paused = !state.paused;
  if (state.paused) renderPauseStats();
  $('pausescreen').classList.toggle('hidden', !state.paused);
}

// ---------------- Run / pisos ----------------

function startRun(clsId) {
  state.player = makePlayer(clsId);
  state.run = { zoneIdx: 0, floorInZone: 0, depth: 0, kills: 0 };
  state.mode = 'play';
  state.invOpen = false; state.paused = false; state.upgradeOpen = false; state.shopOpen = false;
  $('upgradescreen').classList.add('hidden');
  $('shop').classList.add('hidden');
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.remove('hidden');
  mini.classList.remove('hidden');
  nextFloor();
}

// Guarda el piso actual tal cual está (mobs muertos, cofres abiertos, loot
// en el suelo) para poder volver — los pisos tienen memoria.
function saveCurrentFloor() {
  const run = state.run;
  if (!state.level) return;
  run.saved = run.saved || {};
  run.saved[run.depth] = {
    lvl: state.level, enemies: state.enemies, pickups: state.pickups,
    explored: state.explored, zoneIdx: run.zoneIdx, floorInZone: run.floorInZone,
    hasKey: state.player.hasKey,
  };
}

// Restaura un piso visitado y posiciona al jugador (px, py)
function restoreFloor(rec, px, py) {
  const run = state.run;
  run.zoneIdx = rec.zoneIdx; run.floorInZone = rec.floorInZone;
  state.level = rec.lvl;
  state.enemies = rec.enemies; state.pickups = rec.pickups; state.explored = rec.explored;
  state.projs = []; state.particles = []; state.floaters = []; state.fx = [];
  state.motes = Array.from({ length: 16 }, () => ({
    x: Math.random() * rec.lvl.W * TILE, y: Math.random() * rec.lvl.H * TILE,
    vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4,
    ph: Math.random() * Math.PI * 2,
  }));
  const p = state.player;
  p.x = px; p.y = py; p.ifr = 1;
  p.hasKey = rec.hasKey;
  state.cam.x = p.x - canvas.width / ZOOM / 2;
  state.cam.y = p.y - canvas.height / ZOOM / 2;
  bigToast(ZONES[run.zoneIdx].name + ' · Piso ' + run.floorInZone);
}

// Subir al piso anterior (aparece en su escalera de bajada)
function prevFloor() {
  const run = state.run;
  if (run.depth <= 1 || !run.saved || !run.saved[run.depth - 1]) return;
  saveCurrentFloor();
  run.depth--;
  const rec = run.saved[run.depth];
  restoreFloor(rec, (rec.lvl.exit.tx + 0.5) * TILE, (rec.lvl.exit.ty + 0.5) * TILE);
}

function nextFloor() {
  const run = state.run;
  saveCurrentFloor();
  run.depth++;
  // piso ya visitado: se restaura como lo dejaste
  if (run.saved && run.saved[run.depth]) {
    const rec = run.saved[run.depth];
    restoreFloor(rec, rec.lvl.start.x, rec.lvl.start.y);
    return;
  }
  const zone = ZONES[run.zoneIdx];
  run.floorInZone++;
  const isBoss = run.floorInZone > zone.floors;
  const lvl = genDungeon(zone, run.depth, isBoss);
  state.level = lvl;
  state.enemies = []; state.projs = []; state.pickups = [];
  state.particles = []; state.floaters = []; state.fx = [];
  // motas de polvo flotando con el color de la zona
  state.motes = Array.from({ length: 16 }, () => ({
    x: Math.random() * lvl.W * TILE, y: Math.random() * lvl.H * TILE,
    vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4,
    ph: Math.random() * Math.PI * 2,
  }));
  state.explored = Array.from({ length: lvl.H }, () => new Array(lvl.W).fill(false));

  const p = state.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.ifr = 1;
  state.cam.x = p.x - canvas.width / ZOOM / 2;
  state.cam.y = p.y - canvas.height / ZOOM / 2;

  state.player.hasKey = false;
  for (const s of lvl.spawns) {
    const en = spawnEnemy(s.type, s.x, s.y, run.depth, false, s.elite);
    en.keyCarrier = !!s.keyCarrier;
    en.room = s.room || null; // sala hogar para el aggro
    en.aggroT = 0;
    state.enemies.push(en);
  }
  if (lvl.boss) {
    state.enemies.push(spawnEnemy(lvl.boss.type, lvl.boss.x, lvl.boss.y, run.depth, true));
    bigToast(BOSSES[lvl.boss.type].name, '#d8403f');
  } else {
    bigToast(zone.name + ' · Piso ' + run.floorInZone);
    if (lvl.evento === 'oscuro') toast('Una oscuridad antinatural cubre este piso...', '#8a8496');
    if (lvl.evento === 'embrujado') toast('Este piso está embrujado: más peligro, más tesoro', '#c45cff');
  }
  for (const g of lvl.groundItems) spawnPickup('item', g.x, g.y, makeItem(run.depth));
}

function onBossKilled(boss) {
  const run = state.run;
  const lvl = state.level;
  lvl.exitOpen = true;
  if (run.zoneIdx >= ZONES.length - 1) {
    state.winT = 1.6; // pequeña pausa dramática antes de la victoria
  } else {
    bigToast('¡' + boss.def.name + ' derrotado!');
    toast('Se abrió la escalera', '#ffd84f');
    // aparece el mercader junto a la escalera, con stock según profundidad
    lvl.merchant = { x: (lvl.exit.tx - 2.5) * TILE, y: (lvl.exit.ty + 2) * TILE };
    lvl.shopStock = makeShopStock(run.depth);
    burst(lvl.merchant.x, lvl.merchant.y, '#6a5a8a', 12);
    toast('Un mercader apareció...', '#c7b8e8');
  }
}

function onPlayerDeath() {
  state.mode = 'dead';
  showEnd(false);
}

function tryDash() {
  const p = state.player;
  if (!p || state.mode !== 'play' || state.invOpen || state.paused || state.upgradeOpen || state.shopOpen) return;
  if (p.stunT > 0 || p.dashT > 0 || p.dashCd > 0) return;
  // dirección: las teclas de movimiento; si estás quieto, hacia el ratón
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx--;
  if (keys.has('d') || keys.has('arrowright')) mx++;
  if (keys.has('w') || keys.has('arrowup')) my--;
  if (keys.has('s') || keys.has('arrowdown')) my++;
  if (!mx && !my && touch.stickId !== null) { mx = touch.vx; my = touch.vy; }
  if (!mx && !my) {
    const aim = aimAngle();
    mx = Math.cos(aim); my = Math.sin(aim);
  }
  const n = Math.hypot(mx, my);
  const SPD = 330;
  p.dashVX = (mx / n) * SPD;
  p.dashVY = (my / n) * SPD;
  p.dashT = 0.16;
  p.dashCd = 1.2;
  sfx('dash');
}

// cofre común: tapa que cruje, loot y se vuelve transitable (deja de bloquear)
function openChest(ch) {
  ch.opened = true;
  sfx('chest');
  burst(ch.x, ch.y, '#ffd84f', 10);
  spawnPickup('item', ch.x, ch.y - 6, makeItem(state.run.depth + 1));
  spawnPickup('coin', ch.x, ch.y + 4).val = randInt(5, 12) + state.run.depth * 2;
  if (Math.random() < 0.5) spawnPickup('potion', ch.x + randInt(-6, 6), ch.y + 8);
  if (Math.random() < 0.4) spawnPickup('manapotion', ch.x + randInt(-6, 6), ch.y - 2);
}

// cofre dorado: consume la llave, loot raro+ y fanfarria
function openLockedChest(lc) {
  lc.opened = true;
  state.player.hasKey = false;
  sfx('chest'); sfx('levelup');
  burst(lc.x, lc.y, '#ffd84f', 20);
  spawnPickup('item', lc.x - 8, lc.y - 6, makeItemMinRare(state.run.depth + 1));
  spawnPickup('item', lc.x + 8, lc.y - 6, makeItem(state.run.depth + 1));
  spawnPickup('coin', lc.x, lc.y + 6).val = randInt(15, 30) + state.run.depth * 4;
}

function tryInteract() {
  if (state.shopOpen) { closeShop(); return; }
  if (state.mode !== 'play' || state.paused || state.invOpen || state.upgradeOpen) return;
  const p = state.player, lvl = state.level;
  // mercader
  if (lvl.merchant && Math.hypot(p.x - lvl.merchant.x, p.y - lvl.merchant.y) < TILE * 1.5) {
    openShop();
    return;
  }
  // altar de sacrificio: 25% de vida máx. por un tesoro raro+
  if (lvl.altar && !lvl.altar.used && Math.hypot(p.x - lvl.altar.x, p.y - lvl.altar.y) < TILE * 1.4) {
    const cost = Math.round(p.stats.maxhp * 0.25);
    if (p.hp <= cost) { toast('No te queda suficiente vida para el altar', '#ff6b6b'); return; }
    lvl.altar.used = true;
    p.hp -= cost;
    addFloater(p.x, p.y - 14, '-' + cost, '#ff6b6b', true);
    burst(lvl.altar.x, lvl.altar.y - 4, '#d8403f', 16);
    shake(3);
    sfx('summon');
    spawnPickup('item', lvl.altar.x, lvl.altar.y - 10, makeItemMinRare(state.run.depth + 1));
    toast('El altar acepta tu sacrificio...', '#d8403f');
    return;
  }
  // cofre común: abrir estando al lado (el cofre bloquea el paso)
  for (const ch of lvl.chests) {
    if (!ch.opened && Math.hypot(p.x - ch.x, p.y - ch.y) < TILE * 1.4) { openChest(ch); return; }
  }
  // cofre dorado: necesita la llave
  if (lvl.lockedChest && !lvl.lockedChest.opened && Math.hypot(p.x - lvl.lockedChest.x, p.y - lvl.lockedChest.y) < TILE * 1.4) {
    if (p.hasKey) openLockedChest(lvl.lockedChest);
    else toast('Cerrado — la llave la tiene una criatura de este piso', '#8a8496');
    return;
  }
  // escalera de subida: volver al piso anterior (queda como lo dejaste)
  if (state.run.depth > 1 && Math.hypot(p.x - lvl.start.x, p.y - lvl.start.y) < TILE * 1.2) {
    prevFloor();
    return;
  }
  // escalera
  if (lvl.exitOpen) {
    const ex = (lvl.exit.tx + 0.5) * TILE, ey = (lvl.exit.ty + 0.5) * TILE;
    if (Math.hypot(p.x - ex, p.y - ey) < TILE * 1.2) {
      // arranca la animación: camina a la escalera, mira al norte y desciende oscureciéndose
      if (!state.descend) { state.descend = { t: 0, dur: 0.8, boss: lvl.isBoss, x: ex, y: ey }; }
      return;
    }
  }
}

function backToMenu() {
  state.mode = 'menu';
  state.player = null; state.level = null;
  state.invOpen = false; state.paused = false; state.upgradeOpen = false; state.shopOpen = false;
  $('upgradescreen').classList.add('hidden');
  $('shop').classList.add('hidden');
  $('inv').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('hint').classList.add('hidden');
  mini.classList.add('hidden');
  buildMenu(); // refresca récords
  $('menu').classList.remove('hidden');
}

// ---------------- Loop ----------------

let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  // blindado: una excepción en un frame ya no detiene el loop (antes congelaba el juego);
  // se registra para diagnóstico y el loop sigue
  try {
    if (state.mode === 'play' && !state.invOpen && !state.paused && !state.upgradeOpen && !state.shopOpen) update(dt);
    render(dt);
  } catch (e) {
    if (!loop._errN) loop._errN = 0;
    if (loop._errN++ < 20) console.error('[loop] frame error:', e && e.stack ? e.stack : e);
  }
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  state.run.time = (state.run.time || 0) + dt;
  const p = state.player, lvl = state.level;

  // transición de bajada: el personaje se achica/oscurece "metiéndose" en la
  // escalera; al terminar, recién carga el piso siguiente. Congela el resto.
  if (state.descend) {
    const dd = state.descend;
    dd.t += dt;
    // camina hacia la escalera (se acomoda en su borde) mientras desciende
    if (dd.x !== undefined) {
      const m = Math.min(1, dt * 7);
      p.x += (dd.x - p.x) * m; p.y += (dd.y - p.y) * m;
    }
    if (dd.t >= dd.dur) {
      const boss = dd.boss;
      state.descend = null;
      if (boss) { state.run.zoneIdx++; state.run.floorInZone = 0; }
      nextFloor();
    }
    return;
  }

  // victoria diferida tras matar al jefe final
  if (state.winT > 0) {
    state.winT -= dt;
    if (state.winT <= 0) { state.mode = 'win'; showEnd(true); return; }
  }

  // dash: impulso breve, invulnerable, con cooldown
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.dashT > 0) {
    p.dashT -= dt;
    moveWithCollision(lvl, p, p.dashVX * dt, p.dashVY * dt, false);
    // estela fantasma
    state.particles.push({
      x: p.x + (Math.random() - 0.5) * 5, y: p.y + (Math.random() - 0.5) * 7,
      vx: 0, vy: 0, t: 0.22, color: '#9ab8d8', glow: true,
    });
  }

  // tirado en el piso por un tackle: ni moverse ni atacar
  p.stunT = Math.max(0, p.stunT - dt);
  if (p.stunT <= 0 && p.dashT <= 0) {
    // movimiento
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx--;
    if (keys.has('d') || keys.has('arrowright')) mx++;
    if (keys.has('w') || keys.has('arrowup')) my--;
    if (keys.has('s') || keys.has('arrowdown')) my++;
    if (touch.stickId !== null) { mx += touch.vx; my += touch.vy; }
    p.moving = !!(mx || my);
    if (mx || my) {
      const n = Math.max(1, Math.hypot(mx, my)); // el joystick permite caminar lento
      const psp = p.stats.spd * BALANCE.speedMul;
      moveWithCollision(lvl, p, (mx / n) * psp * dt, (my / n) * psp * dt, false);
      if (mx) p.dir = mx > 0 ? 1 : -1;
    }

    // apuntado y ataque
    const aim = aimAngle();
    if (mouse.down || touch.attacking) playerAttack(aim);
    if (!touch.enabled) p.dir = mouseWorldX() > p.x ? 1 : -1;
    else if (touch.aimActive) p.dir = touch.aimX >= 0 ? 1 : -1;
  }

  p.atkCd = Math.max(0, p.atkCd - dt);
  // maná: se regenera al dejar de castear (delay 0.6s, ~28%/s → full en ~3.5s)
  if (p.stats && p.stats.maxMana) {
    p.noCastT = (p.noCastT || 0) + dt;
    if (p.mana < p.stats.maxMana && p.noCastT > 0.6)
      p.mana = Math.min(p.stats.maxMana, p.mana + p.stats.maxMana * 0.28 * dt);
  }
  p.ifr = Math.max(0, p.ifr - dt);
  p.swingT = Math.max(0, p.swingT - dt);
  p.attackT = Math.max(0, (p.attackT || 0) - dt);
  p.hurtT = Math.max(0, (p.hurtT || 0) - dt);
  // pasos: el loop suena solo mientras el prota camina de verdad
  if (typeof setFootsteps === 'function') setFootsteps(state.mode === 'play' && !!p.moving && p.stunT <= 0 && p.dashT <= 0);

  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateFloaters(dt);
  updateFx(dt);

  // deriva de las motas ambientales
  for (const m of state.motes) {
    m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt;
    if (m.x < 0) m.x += lvl.W * TILE; if (m.x > lvl.W * TILE) m.x -= lvl.W * TILE;
    if (m.y < 0) m.y += lvl.H * TILE; if (m.y > lvl.H * TILE) m.y -= lvl.H * TILE;
  }

  // cofres: ahora bloquean el paso y se abren con [E] (ver tryInteract/openChest)

  // niebla explorada (para el minimapa)
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const tx = ptx + dx, ty = pty + dy;
    if (tx >= 0 && ty >= 0 && tx < lvl.W && ty < lvl.H) state.explored[ty][tx] = true;
  }

  // cámara
  state.cam.x = p.x - canvas.width / ZOOM / 2;
  state.cam.y = p.y - canvas.height / ZOOM / 2;
  state.shake = Math.max(0, state.shake - dt * 18);

  updateHUD();
  updatePrompt();
}

function mouseWorldX() { return mouse.sx / ZOOM + state.cam.x; }
function mouseWorldY() { return mouse.sy / ZOOM + state.cam.y; }

function updatePrompt() {
  const p = state.player, lvl = state.level;
  let msg = '';
  if (lvl.merchant && Math.hypot(p.x - lvl.merchant.x, p.y - lvl.merchant.y) < TILE * 1.5)
    msg = '[E] Comerciar';
  else if (lvl.altar && !lvl.altar.used && Math.hypot(p.x - lvl.altar.x, p.y - lvl.altar.y) < TILE * 1.4)
    msg = '[E] Sacrificar 25% de vida por un tesoro';
  else if (lvl.chests.some(ch => !ch.opened && Math.hypot(p.x - ch.x, p.y - ch.y) < TILE * 1.4))
    msg = '[E] Abrir cofre';
  else if (lvl.lockedChest && !lvl.lockedChest.opened && Math.hypot(p.x - lvl.lockedChest.x, p.y - lvl.lockedChest.y) < TILE * 1.6)
    msg = p.hasKey ? '[E] Abrir cofre dorado' : 'Cerrado — la llave la tiene una criatura de este piso';
  else if (state.run.depth > 1 && Math.hypot(p.x - lvl.start.x, p.y - lvl.start.y) < TILE * 1.2)
    msg = '[E] Volver al piso anterior';
  else if (lvl.exitOpen) {
    const ex = (lvl.exit.tx + 0.5) * TILE, ey = (lvl.exit.ty + 0.5) * TILE;
    if (Math.hypot(p.x - ex, p.y - ey) < TILE * 1.2)
      msg = lvl.isBoss ? '[E] Avanzar a la siguiente zona' : '[E] Bajar por la escalera';
  }
  $('prompt').textContent = msg;
}

// ---------------- Render ----------------

function render(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.level || !state.player) return;

  const lvl = state.level, p = state.player;
  const pal = ZONES[state.run.zoneIdx].palette;
  const shx = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shy = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  ctx.setTransform(ZOOM, 0, 0, ZOOM, -(state.cam.x + shx) * ZOOM, -(state.cam.y + shy) * ZOOM);
  ctx.imageSmoothingEnabled = false;

  // tiles visibles
  const x0 = Math.max(0, Math.floor(state.cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(state.cam.y / TILE) - 1);
  const x1 = Math.min(lvl.W - 1, Math.ceil((state.cam.x + canvas.width / ZOOM) / TILE) + 1);
  const y1 = Math.min(lvl.H - 1, Math.ceil((state.cam.y + canvas.height / ZOOM) / TILE) + 1);

  const zoneNow = ZONES[state.run.zoneIdx];
  // tile-set: puede ser una sola imagen (zonas viejas) o un array de variantes
  // (torre en ruinas); en ese caso se elige una por hash determinista de celda.
  const floorSet = Sprites['floor_' + zoneNow.id];
  const wallSet = Sprites['wall_' + zoneNow.id];
  // (el tileset CraftPix "dungeon" quedó descartado; loadDungeonTiles sigue
  //  disponible en sprites.js por si se retoma)
  // hash pseudo-aleatorio por celda: rompe el patrón en grilla/bandas que daba
  // la fórmula lineal (tx*3+ty*7) al elegir variante de tile
  const tvar = (x, y, n) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h = (h ^ (h >>> 16)) >>> 0; return h % n; };
  const torches = []; // antorchas visibles, para dibujar su luz después
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = lvl.map[ty][tx] === 0;
      const X = tx * TILE, Y = ty * TILE;
      const hash = (tx * 7 + ty * 13) % 5;
      const bigHash = (tx * 73 + ty * 37) % 23;
      if (!solid) {
        const floorImg = Array.isArray(floorSet) ? floorSet[tvar(tx, ty, floorSet.length)] : floorSet;
        if (floorImg) {
          ctx.drawImage(floorImg, X, Y, TILE, TILE);
          // sombreado sutil alternado para romper la repetición
          if (hash === 0) { ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillRect(X, Y, TILE, TILE); }
        } else {
          ctx.fillStyle = hash === 0 ? pal.floorAlt : pal.floor;
          ctx.fillRect(X, Y, TILE, TILE);
        }
        if (bigHash === 5) drawFloorDecal(X, Y, tx, ty); // decoración de zona
      } else {
        // pared con cara frontal si abajo hay piso
        const floorBelow = ty + 1 < lvl.H && lvl.map[ty + 1][tx] === 1;
        const wallImg = Array.isArray(wallSet) ? wallSet[tvar(tx + 101, ty + 57, wallSet.length)] : wallSet;
        // cara frontal (con piso debajo) = ladrillo; el resto (tope/relleno) negro
        if (floorBelow && wallImg) {
          ctx.drawImage(wallImg, X, Y, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.fillRect(X, Y + TILE - 3, TILE, 3);
        } else if (floorBelow) {
          ctx.fillStyle = pal.wall;
          ctx.fillRect(X, Y, TILE, TILE);
        } else {
          ctx.fillStyle = '#05040a';
          ctx.fillRect(X, Y, TILE, TILE);
          // remate: si justo debajo hay una cara de muro, coronarla con una fila de
          // ladrillo en el borde inferior de este tope negro (el muro "sobresale").
          const belowFace = ty + 2 < lvl.H && lvl.map[ty + 1][tx] === 0 && lvl.map[ty + 2][tx] === 1;
          if (belowFace && wallImg) {
            const capH = 6; // una fila de ladrillo (~1/3 de TILE)
            ctx.drawImage(wallImg, 0, 0, wallImg.width, wallImg.width * capH / TILE, X, Y + TILE - capH, TILE, capH);
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.fillRect(X, Y + TILE - capH, TILE, 1); // sombra fina que separa remate y cara
          }
        }
        // antorcha cada tanto en las caras frontales
        if (floorBelow && bigHash === 0) torches.push([X + TILE / 2, Y, tx * 31 + ty]);
      }
    }
  }

  // antorchas: palo, llama animada y luz cálida parpadeante
  for (const [tX, tY, seed] of torches) {
    if (TORCH_IMG && TORCH_IMG.width) {
      // sprite animado (8 frames 64×64, 4×2); el seed desincroniza cada antorcha
      const fr = Math.floor(state.time * 10 + seed) % 8;
      const sx = (fr % 4) * 64, sy = (fr < 4 ? 0 : 1) * 64;
      const dw = 18, dh = 18;
      ctx.drawImage(TORCH_IMG, sx, sy, 64, 64, tX - dw / 2, tY - 2, dw, dh);
    } else {
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(tX - 1, tY + 7, 2, 4);
      const fl = Math.floor(state.time * 9 + seed) % 3;
      ctx.fillStyle = fl === 0 ? '#ffb13f' : fl === 1 ? '#ff7b2f' : '#ffd84f';
      ctx.fillRect(tX - 1, tY + 4 + (fl === 1 ? 1 : 0), 2, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(tX - 0.5, tY + 5.5, 1, 1);
    }
    ctx.globalCompositeOperation = 'lighter';
    const r = 13 + Math.sin(state.time * 7 + seed) * 2;
    const g = ctx.createRadialGradient(tX, tY + 8, 2, tX, tY + 8, r);
    g.addColorStop(0, 'rgba(255,160,60,0.13)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(tX, tY + 8, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // escalera de salida
  if (lvl.exitOpen) {
    if (typeof STAIRS_IMG !== 'undefined' && STAIRS_IMG && STAIRS_IMG.width) {
      const cx = (lvl.exit.tx + 0.5) * TILE, cy = (lvl.exit.ty + 0.5) * TILE, s = 22;
      ctx.drawImage(STAIRS_IMG, cx - s / 2, cy - s / 2, s, s);
    } else {
      const X = lvl.exit.tx * TILE, Y = lvl.exit.ty * TILE;
      ctx.fillStyle = '#0b0a0f';
      ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = pal.accent;
      for (let i = 0; i < 4; i++) ctx.fillRect(X + 2 + i, Y + 3 + i * 3, TILE - 4 - i * 2, 2);
    }
  }

  // escalera de subida (por donde llegaste): escalones invertidos, más tenue
  if (state.run.depth > 1) {
    const X = Math.floor(lvl.start.x / TILE) * TILE, Y = Math.floor(lvl.start.y / TILE) * TILE;
    ctx.fillStyle = '#0b0a0f';
    ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 4; i++) ctx.fillRect(X + 2 + i, Y + 12 - i * 3, TILE - 4 - i * 2, 2);
    ctx.globalAlpha = 1;
  }

  // decoración de arena (detrás de las entidades)
  for (const d of (lvl.decor || [])) {
    if (d.type === 'postes') drawRugbyPosts(d.x, d.y);
  }

  // cofres (sin sombra: el sprite ya apoya solo)
  for (const ch of lvl.chests) {
    if (!drawChestImg(ch.opened, ch.x, ch.y, 0.92, false)) {
      const spr = ch.opened ? Sprites.cofre_abierto : Sprites.cofre;
      ctx.drawImage(spr, ch.x - spr.width / 2, ch.y - spr.height / 2);
    }
  }

  // cofre dorado y altar
  if (lvl.lockedChest) {
    const lc = lvl.lockedChest;
    if (!lc.opened) {
      // halo dorado pulsante: distingue al cofre con llave del cofre común
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,210,90,0.10)';
      ctx.beginPath(); ctx.arc(lc.x, lc.y, 11 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!drawChestImg(lc.opened, lc.x, lc.y, 0.95, true)) {
      const spr = lc.opened ? Sprites.cofre_abierto : Sprites.cofre_dorado;
      ctx.drawImage(spr, lc.x - spr.width / 2, lc.y - spr.height / 2);
    }
  }
  if (lvl.altar) {
    const al = lvl.altar;
    drawShadow(al.x, al.y - 1, 5);
    if (!al.used) {
      // llama de la vela parpadeando
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,177,63,' + (0.12 + Math.sin(state.time * 9) * 0.05) + ')';
      ctx.beginPath(); ctx.arc(al.x, al.y - 5, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(Sprites.altar, al.x - 5, al.y - 5);
  }

  // mercader (flota suavemente, con brillo de linterna)
  if (lvl.merchant) {
    const m = lvl.merchant;
    const bob = Math.sin(state.time * 2.5) * 1.2;
    drawShadow(m.x, m.y + 1, 5.5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,216,79,0.10)';
    ctx.beginPath(); ctx.arc(m.x, m.y + bob, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    drawSpriteC(Sprites.mercader, m.x, m.y + bob - 2, 1);
  }

  // pickups
  for (const pk of state.pickups) {
    const bob = -(pk.hz || 0); // altura del salto al caer; asentado = 0 (sin flote)
    if (pk.kind === 'coin') {
      const cimg = typeof coinPileImg === 'function' ? coinPileImg(pk.val || 1) : null;
      if (cimg) { const s = 10; ctx.drawImage(cimg, pk.x - s / 2, pk.y - s / 2 + bob, s, s); }
      else ctx.drawImage(Sprites.moneda, pk.x - 3, pk.y - 3 + bob);
    }
    else if (pk.kind === 'heart') ctx.drawImage(Sprites.corazon, pk.x - 3.5, pk.y - 3 + bob);
    else if (pk.kind === 'potion') ctx.drawImage(Sprites.pocion, pk.x - 3, pk.y - 4 + bob);
    else if (pk.kind === 'manapotion') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(90,170,255,0.22)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#2f7fe6'; ctx.fillRect(pk.x - 2.5, pk.y - 2 + bob, 5, 6);
      ctx.fillStyle = '#9ad8ff'; ctx.fillRect(pk.x - 2.5, pk.y + bob, 5, 2);
      ctx.fillStyle = '#d8d2c8'; ctx.fillRect(pk.x - 1, pk.y - 4 + bob, 2, 2);
    }
    else if (pk.kind === 'key') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,216,79,0.2)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(Sprites.llave, pk.x - 4, pk.y - 2 + bob);
    }
    else if (pk.kind === 'xp') {
      const col = (typeof XP_FLAMES !== 'undefined' && pk.xpColor) ? pk.xpColor : 'blue';
      let img = null;
      if (typeof XP_FLAMES !== 'undefined') {
        if (col === 'blue' && XP_FLAMES.blue.length === 9)
          img = XP_FLAMES.blue[(Math.floor(state.time * 1000 / 80) + Math.floor(pk.t * 3)) % 9];
        else img = XP_FLAMES[col];
      }
      if (img && img.width) {
        const w = 5, pulse = col === 'blue' ? 1 : (1 + Math.sin(state.time * 7 + pk.t) * 0.12), h = 5 * pulse;
        ctx.drawImage(img, pk.x - w / 2, pk.y - h + 1 + bob, w, h); // anclada por la base de la llama
      } else {
        // fallback: puntito titilante
        const tw = 1 + Math.sin(pk.t * 2.5) * 0.35;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,70,60,0.28)';
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob * 0.4, 3.6 * tw, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath(); ctx.arc(pk.x, pk.y + bob * 0.4, 1.7 * tw, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    else if (pk.kind === 'item') {
      const r = rarityOf(pk.item);
      ctx.fillStyle = r.color + '44';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + 2, 7, 0, Math.PI * 2); ctx.fill();
      const simg = staffIconImg(pk.item);
      if (simg) { // vara arcana 128px → escalada a tamaño de drop, con suavizado
        const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
        ctx.drawImage(simg, pk.x - 9, pk.y - 11 + bob, 18, 18);
        ctx.imageSmoothingEnabled = sm;
      } else {
        const spr = itemIcon(pk.item);
        if (spr) ctx.drawImage(spr, pk.x - spr.width / 2, pk.y - spr.height / 2 + bob);
      }
    }
  }

  // pelota de rugby tirada en el piso (Bucle va a buscarla)
  for (const e of state.enemies) {
    if (!e.ballPos) continue;
    if (Sprites.anim_pelota) ctx.drawImage(Sprites.anim_pelota[0], e.ballPos.x - 4, e.ballPos.y - 4, 8, 8);
    else ctx.drawImage(Sprites.pelota, e.ballPos.x - 3.5, e.ballPos.y - 2, 7, 4);
  }

  // entidades ordenadas por Y (las de abajo tapan a las de arriba)
  const drawables = [...state.enemies, p].sort((a, b) => a.y - b.y);
  for (const e of drawables) {
    if (e === p) {
      if (state.descend) {
        // primero camina a la escalera (k arranca tras ~0.3 del total), después se
        // achica y se OSCURECE (brightness, no transparencia) hundiéndose. ifr=0
        // temporal: update está congelado y el parpadeo de invuln lo borraría.
        const prog = Math.min(1, state.descend.t / state.descend.dur);
        const k = Math.max(0, (prog - 0.32) / 0.68); // 0 mientras camina, luego desciende
        const savedIfr = p.ifr; p.ifr = 0;
        ctx.save();
        ctx.filter = 'brightness(' + (1 - 0.85 * k) + ')'; // se va a negro como la oscuridad
        ctx.translate(p.x, p.y + 9 * k); ctx.scale(1 - 0.7 * k, 1 - 0.7 * k); ctx.translate(-p.x, -p.y);
        drawPlayer(p);
        ctx.restore();
        p.ifr = savedIfr;
      } else drawPlayer(p);
    }
    else drawEnemy(e);
  }

  // guía de puntería manual en táctil (línea punteada desde el personaje)
  if (touch.aimActive && state.mode === 'play') {
    const a = Math.atan2(touch.aimY, touch.aimX);
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 10);
    ctx.lineTo(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // proyectiles
  for (const pr of state.projs) {
    if (pr.style === 'arrow') {
      ctx.save();
      ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.fillStyle = pr.color;
      ctx.fillRect(-4, -0.5, 8, 1);
      ctx.fillRect(2, -1.5, 2, 3);
      // punta con brillo
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,240,200,0.55)';
      ctx.fillRect(2, -2, 3, 4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    } else if (pr.style === 'bolt' && typeof V2H !== 'undefined' && V2H.ready && V2H.fx.power.length) {
      // energyblast v2 (PixelLab): sprite rotado hacia el ángulo de vuelo
      drawV2Bolt(pr);
    } else if (pr.style === 'bolt') {
      // orbe arcano: halo pulsante + núcleo + chispas orbitando
      const pulse = 1 + Math.sin(pr.t * 22) * 0.25;
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 6.5 * pulse);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, '#9ad8ffcc');
      grad.addColorStop(1, 'rgba(126,200,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 6.5 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b14fff';
      for (let i = 0; i < 2; i++) {
        const oa = pr.t * 13 + i * Math.PI;
        ctx.fillRect(pr.x + Math.cos(oa) * 4.5 - 0.8, pr.y + Math.sin(oa) * 4.5 - 0.8, 1.6, 1.6);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (pr.style === 'rugbyball') {
      // la pelota gira mientras vuela (4 frames del pack, 70 ms c/u)
      ctx.save();
      ctx.translate(pr.x, pr.y);
      const bframes = Sprites.anim_pelota;
      if (bframes) {
        ctx.rotate(pr.ang);
        ctx.drawImage(bframes[Math.floor(pr.t * 1000 / 70) % bframes.length], -4, -4, 8, 8);
      } else {
        ctx.rotate(pr.t * 12);
        ctx.drawImage(Sprites.pelota, -3.5, -2, 7, 4);
      }
      ctx.restore();
    } else {
      // los disparos enemigos se desvanecen al agotarse su alcance
      ctx.globalAlpha = Math.min(1, pr.life * 4);
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // partículas
  for (const pa of state.particles) {
    ctx.globalAlpha = Math.min(1, pa.t * 3);
    if (pa.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pa.color;
    ctx.fillRect(pa.x - 1, pa.y - 1, 2, 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // motas de polvo flotando (color de acento de la zona)
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = pal.accent;
  for (const m of (state.motes || [])) {
    ctx.globalAlpha = 0.08 + 0.07 * Math.sin(m.ph * 1.6);
    ctx.fillRect(m.x, m.y + Math.sin(m.ph) * 2, 1, 1);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // polvo del tackle: 4 frames, se reproduce una vez y muere (pivote en el piso)
  for (const f of state.fx) {
    if (f.type === 'v2boom' && typeof V2H !== 'undefined' && V2H.fx.boom.length) {
      // explosión del energyblast: one-shot de 8 frames, muere al terminar
      const bi = Math.min(7, Math.floor((state.time - f.start) * 1000 / 60));
      const img = V2H.fx.boom[bi];
      const S = 0.6;
      ctx.drawImage(img, f.x - 20 * S, f.y - 20 * S, 40 * S, 40 * S);
      continue;
    }
    if (f.type !== 'dust' || !Sprites.anim_dust) continue;
    const fi = Math.min(3, Math.floor((state.time - f.start) * 1000 / 70));
    ctx.drawImage(Sprites.anim_dust[fi], f.x - 4, f.y - 8, 8, 8);
  }

  // cadáver del jefe: animación de derrota que queda en el piso y se desvanece
  for (const f of state.fx) {
    if (f.type !== 'corpse') continue;
    const frames = Sprites['anim_' + f.anims + (f.dir < 0 ? '_defeat_L' : '_defeat')];
    if (!frames) continue;
    const elapsed = (state.time - f.start) * 1000;
    const fspr = frames[animFrame(BOSS_ANIMS.defeat, elapsed)];
    const kc = fspr.ws || 1;
    ctx.globalAlpha = Math.min(1, f.t / 0.8); // fade final
    ctx.save();
    ctx.translate(f.x, f.y + 6);
    ctx.scale(f.scale * kc, f.scale * kc);
    ctx.drawImage(fspr, -fspr.width / 2, -fspr.height);
    ctx.restore();
    // la pelota se le cae al lado (frame 1 del pack en adelante)
    if (elapsed > 280 && Sprites.anim_pelota)
      ctx.drawImage(Sprites.anim_pelota[0], f.x - f.dir * 14 - 4, f.y + 1, 8, 8);
    ctx.globalAlpha = 1;
  }

  // efectos: ondas expansivas y destellos
  ctx.globalCompositeOperation = 'lighter';
  for (const f of state.fx) {
    const k = 1 - f.t / f.t0; // progreso 0→1
    if (f.type === 'ring') {
      const ease = 1 - (1 - k) * (1 - k);
      ctx.globalAlpha = f.t / f.t0;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 0.5 + 2 * (f.t / f.t0);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.maxR * ease, 0, Math.PI * 2); ctx.stroke();
    } else if (f.type === 'flash') {
      ctx.globalAlpha = (f.t / f.t0) * 0.85;
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, 'rgba(154,216,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // luz cálida alrededor del jugador + viñeta suave de profundidad
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  {
    const sx = (p.x - state.cam.x) * ZOOM, sy = (p.y - state.cam.y) * ZOOM;
    ctx.globalCompositeOperation = 'lighter';
    const warm = ctx.createRadialGradient(sx, sy, 4 * ZOOM, sx, sy, 38 * ZOOM);
    warm.addColorStop(0, 'rgba(255,190,110,0.07)');
    warm.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    if (lvl.evento !== 'oscuro') {
      const vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.45,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(5,4,8,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // piso oscuro: viñeta que limita la visión alrededor del jugador
  if (lvl.evento === 'oscuro') {
    // La oscuridad se arma en un canvas APARTE y se perforan ahí los "agujeros" de
    // visión (jugador + orbes); recién después se pega encima. Así los agujeros sólo
    // quitan oscuridad y no borran el piso ni los personajes del lienzo principal.
    if (!_darkCv) { _darkCv = document.createElement('canvas'); _darkCx = _darkCv.getContext('2d'); }
    if (_darkCv.width !== canvas.width || _darkCv.height !== canvas.height) {
      _darkCv.width = canvas.width; _darkCv.height = canvas.height;
    }
    const dc = _darkCx;
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, canvas.width, canvas.height);
    dc.fillStyle = 'rgba(5,4,8,0.94)';
    dc.fillRect(0, 0, canvas.width, canvas.height);
    dc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, inner, outer) => {
      const g = dc.createRadialGradient(x, y, inner, x, y, outer);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g; dc.fillRect(x - outer, y - outer, outer * 2, outer * 2);
    };
    hole((p.x - state.cam.x) * ZOOM, (p.y - state.cam.y) * ZOOM, 24 * ZOOM, 62 * ZOOM);
    for (const pr of state.projs) {
      if (pr.dead || pr.style !== 'bolt') continue;
      hole((pr.x - state.cam.x) * ZOOM, (pr.y - state.cam.y) * ZOOM, 6 * ZOOM, 58 * ZOOM);
    }
    // destellos de explosión: el área iluminada se retiene y se apaga de a poco
    for (const f of state.fx) {
      if (f.type !== 'lightburst') continue;
      const k = Math.max(0, f.t / f.t0), fx = (f.x - state.cam.x) * ZOOM, fy = (f.y - state.cam.y) * ZOOM, r = f.r * ZOOM;
      const g = dc.createRadialGradient(fx, fy, 2 * ZOOM, fx, fy, r);
      g.addColorStop(0, 'rgba(0,0,0,' + k + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = g; dc.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
    dc.globalCompositeOperation = 'source-over';
    ctx.drawImage(_darkCv, 0, 0);
  }

  // aura leve del orbe (brillo propio, sutil para no saturar en sala clara)
  ctx.globalCompositeOperation = 'lighter';
  for (const pr of state.projs) {
    if (pr.dead || pr.style !== 'bolt') continue;
    const bx = (pr.x - state.cam.x) * ZOOM, by = (pr.y - state.cam.y) * ZOOM, lr = 44 * ZOOM;
    const lg = ctx.createRadialGradient(bx, by, 0, bx, by, lr);
    lg.addColorStop(0, 'rgba(150,200,255,0.14)');
    lg.addColorStop(0.5, 'rgba(120,120,235,0.06)');
    lg.addColorStop(1, 'rgba(110,90,225,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(bx - lr, by - lr, lr * 2, lr * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // números flotantes (en espacio de pantalla para que el texto sea nítido)
  for (const f of state.floaters) {
    const sx = (f.x - state.cam.x) * ZOOM, sy = (f.y - state.cam.y) * ZOOM;
    ctx.globalAlpha = Math.min(1, f.t * 2.5);
    ctx.font = (f.big ? 'bold 18px' : 'bold 13px') + ' "Courier New", monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(f.txt, sx + 1, sy + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.txt, sx, sy);
    ctx.globalAlpha = 1;
  }

  renderMinimap();
}

// Decoración de piso según la zona: huesos, hongos o runas
function drawFloorDecal(X, Y, tx, ty) {
  const zoneId = ZONES[state.run.zoneIdx].id;
  if (zoneId === 'torre') return; // piso de madera: sin decals (los huesitos se veían como "viboritas")
  const ox = 3 + (tx * 5) % 8, oy = 3 + (ty * 3) % 8;
  if (zoneId === 'cavernas') {
    // honguito
    ctx.fillStyle = '#c77b3f';
    ctx.fillRect(X + ox, Y + oy, 3, 1);
    ctx.fillStyle = '#e8a86a';
    ctx.fillRect(X + ox + 1, Y + oy + 1, 1, 1);
  } else {
    // runa que brilla apenas
    ctx.fillStyle = 'rgba(160,107,212,' + (0.4 + Math.sin(state.time * 2 + tx) * 0.2) + ')';
    ctx.fillRect(X + ox + 1, Y + oy, 1, 3);
    ctx.fillRect(X + ox, Y + oy + 1, 3, 1);
  }
}

// Sombra elíptica que asienta a las entidades en el piso
function drawShadow(x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5, w, w * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpriteC(spr, x, y, scale, alpha) {
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const k = spr.ws || 1;
  const w = spr.width * k * scale, h = spr.height * k * scale;
  ctx.drawImage(spr, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

let hpTmp = null;

// Render del asset pack final (cuerpo + equipo + brazo + arma)
function drawHeroPack(p) {
  let name = 'idle';
  if ((p.hurtT || 0) > 0) name = 'hurt';
  else if ((p.attackT || 0) > 0) name = 'attack';
  else if (p.moving) name = 'run';
  if (p._hpAnim !== name) { p._hpAnim = name; p._hpStart = state.time; }
  const fi = hpFrame(name, (state.time - p._hpStart) * 1000); // 0-10
  const flip = p.dir < 0 ? -1 : 1, ws = 0.5, footY = p.y + 5;
  const hasWeapon = !!p.equip.arma;
  const hurtIdx = name === 'hurt' ? fi - HP.anims.hurt.start : -1;
  const flash = hurtIdx >= 0 ? (HP.hurtFlash[hurtIdx] || 0) : 0;

  // componer cuerpo + equipo en un canvas 48×48 (flip y flash se aplican una vez)
  if (!hpTmp) { hpTmp = document.createElement('canvas'); hpTmp.width = hpTmp.height = 48; }
  const tg = hpTmp.getContext('2d');
  tg.clearRect(0, 0, 48, 48);
  tg.drawImage((hasWeapon ? HP.bodyHold : HP.body)[fi], 0, 0);
  const cls = HP_CLASS[p.cls] || 'warrior';   // set de equipo según la clase
  for (const slot of HP.layerOrder) {
    const ourSlot = Object.keys(HP_SLOT).find(k => HP_SLOT[k] === slot);
    if (!ourSlot) continue;                 // gloves/cloak/belt: sin slot en el juego aún
    const it = p.equip[ourSlot];
    if (!it) continue;
    const set = HP.equip[cls] || HP.equip.warrior;
    const arr = set[slot] && set[slot][hpTier(it)];
    if (arr && arr[fi]) tg.drawImage(arr[fi], 0, 0);
  }
  if (flash > 0) {
    tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = flash;
    tg.fillStyle = '#e84848'; tg.fillRect(0, 0, 48, 48);
    tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
  }
  // lunge: durante el golpe melee el cuerpo da un paso al frente (el slash va adelante)
  let lungeX = 0, lungeY = 0;
  if (p.swingT > 0) {
    const mag = Math.sin((1 - p.swingT / 0.16) * Math.PI) * 5, a = aimAngle();
    lungeX = Math.cos(a) * mag; lungeY = Math.sin(a) * mag;
  }
  p._lungeX = lungeX; p._lungeY = lungeY;

  ctx.save();
  ctx.translate(p.x + lungeX, footY + lungeY); ctx.scale(ws * flip, ws);
  ctx.drawImage(hpTmp, -24, -48);
  ctx.restore();

  if (hasWeapon) drawHeroWeaponArm(p, fi, flip, footY, ws);
}

function drawHeroWeaponArm(p, fi, flip, footY, ws) {
  const arma = p.equip.arma;
  const wtype = HP_WEAP[arma.weaponType];
  const wframes = HP.weap[wtype];
  if (!wframes) return;
  const wspr = wframes[hpTier(arma)], grip = HP.grip[wtype];
  const rawAim = aimAngle();
  // arma relajada en reposo: el arma baja al costado mientras no estás atacando.
  // Considera todas las armas (melee usa swingT/attackT, ranged/magic usan atkCd) y
  // sigue apuntando mientras el jugador mantiene el clic, aunque atkCd llegue a 0.
  const aiming = mouse.down || touch.attacking;
  const resting = !aiming && p.atkCd <= 0 && p.swingT <= 0 && (p.attackT || 0) <= 0;
  const restDir = p.dir > 0 ? 1.15 : (Math.PI - 1.15); // apunta hacia abajo-adelante
  const target = resting ? restDir : rawAim;
  if (p._armAim === undefined) p._armAim = target;
  let d = target - p._armAim; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  p._armAim += d * (resting ? 0.18 : 0.5); // suave al bajar, ágil al apuntar
  while (p._armAim > Math.PI) p._armAim -= 2 * Math.PI;
  while (p._armAim < -Math.PI) p._armAim += 2 * Math.PI;
  const aim = p._armAim;
  // slash: el brazo+arma barren un arco real durante el golpe melee
  let swing = 0;
  if (p.swingT > 0) {
    const k = 1 - p.swingT / 0.16, e = k * k * (3 - 2 * k);
    swing = (e * 2.6 - 1.3) * (p.swingDir || 1);
  }
  const armAng = aim + Math.PI / 2 + swing;

  // hombro del frame (subido 2px para que no se lea desde el pecho), mirror-aware,
  // + lunge hacia adelante durante el golpe (el slash va adelante del cuerpo)
  const lx = p._lungeX || 0, ly = p._lungeY || 0;
  const sx = HP.shoulder[fi][0], sy = HP.shoulder[fi][1] - 2;
  const shWX = p.x + (flip > 0 ? (sx - 24) : (24 - sx)) * ws + lx;
  const shWY = footY + (sy - 48) * ws + ly;
  // mano = hombro + rotar(offset mano) por el ángulo del brazo
  const hlx = HP.armHand[0] - HP.armShoulder[0], hly = HP.armHand[1] - HP.armShoulder[1];
  const ca = Math.cos(armAng), sa = Math.sin(armAng);
  const hWX = shWX + (hlx * ca - hly * sa) * ws, hWY = shWY + (hlx * sa + hly * ca) * ws;

  // magia: glow arcano en la punta del bastón/varita (no corta, irradia)
  const isMagic = WEAPON_TYPES[arma.weaponType].style === 'bolt';
  if (isMagic) {
    const cast = p.atkCd > attackCooldown(p) * 0.55 ? 1.8 : 1; // brilla más al lanzar
    const tx = hWX + Math.cos(aim) * 14, ty = hWY + Math.sin(aim) * 14;
    const pulse = (0.7 + Math.sin(state.time * 6) * 0.3) * cast;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 7 * pulse);
    g.addColorStop(0, '#bfe6ffdd'); g.addColorStop(0.4, '#7ec8ff88'); g.addColorStop(1, '#7ec8ff00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, 7 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, ty, 1.4 * cast, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // glow de rareza en la punta (las raras+ irradian su color)
  const rank = RARITIES.findIndex(r => r.id === arma.rarity);
  if (rank >= 2) {
    const rar = rarityOf(arma), pulse = 0.6 + Math.sin(state.time * 5) * 0.25;
    const tx = hWX + Math.cos(aim) * 14, ty = hWY + Math.sin(aim) * 14;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, (6 + rank * 2) * pulse);
    g.addColorStop(0, rar.color + 'cc'); g.addColorStop(1, rar.color + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, (6 + rank * 2) * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (rank >= 3 && Math.random() < 0.4)
      state.particles.push({ x: tx + (Math.random() - 0.5) * 6, y: ty, vx: (Math.random() - 0.5) * 20, vy: -12, t: 0.4, color: rar.color, glow: true });
  }

  // arma (detrás), luego brazo (encima, lo empuña) — orden del manifest
  ctx.save(); ctx.translate(hWX, hWY); ctx.rotate(armAng); ctx.scale(ws, ws);
  ctx.drawImage(wspr, -grip[0], -grip[1]); ctx.restore();
  ctx.save(); ctx.translate(shWX, shWY); ctx.rotate(armAng); ctx.scale(ws, ws);
  ctx.drawImage(HP.arm, -HP.armShoulder[0], -HP.armShoulder[1]); ctx.restore();
}

function drawPlayer(p) {
  drawShadow(p.x, p.y, 5);
  // tackleado: tirado en el piso con estrellitas dando vueltas
  if (p.stunT > 0) {
    const spr = HP.ready ? HP.body[0] : playerSprite(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.dir >= 0 ? Math.PI / 2 : -Math.PI / 2);
    const k = HP.ready ? 0.5 : 1;
    ctx.drawImage(spr, -spr.width * k / 2, -spr.height * k / 2, spr.width * k, spr.height * k);
    ctx.restore();
    ctx.fillStyle = '#ffd84f';
    for (let i = 0; i < 3; i++) {
      const a = state.time * 7 + i * 2.1;
      ctx.fillRect(p.x + Math.cos(a) * 7 - 1, p.y - 11 + Math.sin(a) * 2.5 - 1, 2, 2);
    }
    return;
  }
  // parpadeo durante invulnerabilidad
  if (p.ifr > 0 && Math.floor(state.time * 14) % 2 === 0) return;
  // mago v2 (PixelLab, 8 direcciones): tiene prioridad si sus assets cargaron
  if (typeof V2H !== 'undefined' && V2H.ready) {
    drawV2Hero(p);
    return;
  }
  if (HP.ready) {
    drawHeroPack(p);
  } else if (Sprites.hero_idle) {
    // héroe animado 48px (rig de Claude Design): hurt > attack > run > idle
    let name = 'idle';
    if ((p.hurtT || 0) > 0) name = 'hurt';
    else if ((p.attackT || 0) > 0) name = 'attack';
    else if (p.moving) name = 'run';
    if (p._heroAnim !== name) { p._heroAnim = name; p._heroStart = state.time; }
    const frames = Sprites['hero_' + name + (p.dir < 0 ? '_L' : '')];
    const fi = animFrame(HERO_ANIMS[name], (state.time - p._heroStart) * 1000);
    const spr = frames[fi];
    const ws = spr.ws || 1, w = spr.width * ws, h = spr.height * ws;
    p._heroFrame = fi; // para anclar el arma a la mano del frame actual
    // el bastón/arco/etc. va detrás del cuerpo si apunto hacia arriba
    const aimUp = Math.sin(aimAngle()) < -0.3;
    if (aimUp) drawHeldWeapon(p);
    ctx.drawImage(spr, p.x - w / 2, p.y + 5 - h, w, h);
    if (!aimUp) drawHeldWeapon(p);
  } else {
    // fallback al sprite por código
    const spr = playerSprite(p);
    const bob = p.moving ? -Math.abs(Math.sin(state.time * 10)) * 1.5 : Math.sin(state.time * 2.2) * 0.5;
    const tilt = p.moving ? Math.sin(state.time * 10) * 0.07 : 0;
    ctx.save();
    ctx.translate(p.x, p.y - 3 + bob);
    ctx.rotate(tilt);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    ctx.restore();
    drawHeldWeapon(p);
  }

  // tajo: arco amplio proyectado ADELANTE del cuerpo (no solo al alcance del brazo),
  // así se lee como un ataque al frente aunque el bicho esté encima
  if (p.swingT > 0) {
    const k = 1 - p.swingT / 0.16;            // progreso del tajo 0→1
    const dir = p.swingDir || 1;
    const cur = p.swingAng + dir * (k * 2 - 1); // barre 2 radianes
    const fwd = 9;                            // centro del arco adelante del cuerpo
    const cx = p.x + Math.cos(p.swingAng) * fwd, cy = p.y + Math.sin(p.swingAng) * fwd;
    const R = 20;                             // radio amplio
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = cur - dir * i * 0.16;
      ctx.globalAlpha = (1 - i / 6) * 0.6;
      ctx.strokeStyle = i === 0 ? '#ffffff' : '#9ab8d8';
      ctx.lineWidth = 4 - i * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a - 0.2, a + 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Arco de rugby en H: dos palos altos + travesaño
function drawRugbyPosts(x, y) {
  const h = 32, w = 18, barY = y - 15;
  ctx.fillStyle = '#e8e3d0';
  ctx.fillRect(x - w / 2 - 1, y - h, 2, h);
  ctx.fillRect(x + w / 2 - 1, y - h, 2, h);
  ctx.fillRect(x - w / 2 - 1, barY, w + 2, 2);
  // protectores acolchados en la base
  ctx.fillStyle = '#27418f';
  ctx.fillRect(x - w / 2 - 2, y - 6, 4, 6);
  ctx.fillRect(x + w / 2 - 2, y - 6, 4, 6);
  // sombra
  ctx.fillStyle = '#00000040';
  ctx.fillRect(x - w / 2 - 2, y, 4, 1);
  ctx.fillRect(x + w / 2 - 2, y, 4, 1);
}

// El arma equipada se ve en la mano, apuntando hacia el ratón.
// Usa el sprite del rig (6 tiers por material) anclado por su grip pivot.
function drawHeldWeapon(p) {
  const arma = p.equip.arma;
  if (!arma) return;
  const aim = aimAngle();
  // slash: el arma barre un arco real de windup (-1.3) a follow-through (+1.3)
  let swing = 0;
  if (p.swingT > 0) {
    const k = 1 - p.swingT / 0.16;          // 0 → 1 a lo largo del golpe
    const eased = k * k * (3 - 2 * k);       // smoothstep para que acelere en el medio
    swing = (eased * 2.6 - 1.3) * (p.swingDir || 1);
  }

  // sprite del rig si está disponible (arma "vertical, punta arriba" + grip)
  const rigType = WEAPON_RIG[arma.weaponType];
  const rigArr = Sprites.weap && Sprites.weap[rigType];
  if (rigArr) {
    const spr = rigArr[weaponTier(arma)];
    const ws = spr.ws || 1;
    // agarre anclado a la MANO real del frame de animación actual (no flotando)
    let hx, hy;
    if (typeof ARIG !== 'undefined') {
      const ha = ARIG.handAnchor(p._heroAnim || 'idle', p._heroFrame || 0);
      let ax = ha.x; if (p.dir < 0) ax = 48 - ax; // espejar con el cuerpo
      hx = p.x - 12 + ax * 0.5;        // sprite 48px (ws .5, ancho 24) → mundo
      hy = (p.y + 5 - 24) + ha.y * 0.5;
    } else { hx = p.x + Math.cos(aim) * 5; hy = p.y - 6 + Math.sin(aim) * 5; }

    // glow de rareza: las armas raras+ irradian su color (se nota que son especiales)
    const rar = rarityOf(arma);
    const rank = RARITIES.findIndex(r => r.id === arma.rarity);
    if (rank >= 2) { // raro, épico (y futuras legendary/mythic)
      const tipL = 13 * (spr.gy / 24);
      const tx = hx + Math.cos(aim) * 16, ty = hy + Math.sin(aim) * 16;
      const pulse = 0.6 + Math.sin(state.time * 5) * 0.25;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, (6 + rank * 2) * pulse);
      g.addColorStop(0, rar.color + 'cc');
      g.addColorStop(1, rar.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tx, ty, (6 + rank * 2) * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // chispas para épico+
      if (rank >= 3 && Math.random() < 0.4)
        state.particles.push({ x: tx + (Math.random() - 0.5) * 6, y: ty + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 15, t: 0.4, color: rar.color, glow: true });
    }

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(aim + Math.PI / 2 + swing); // punta-arriba (-y) → dirección de apuntado
    ctx.scale(ws, ws);
    ctx.drawImage(spr, -spr.gx, -spr.gy);
    ctx.restore();
    return;
  }
  // fallback: icono viejo
  const wt = WEAPON_TYPES[arma.weaponType];
  const icon = Sprites['icon_' + arma.weaponType];
  ctx.save();
  ctx.translate(p.x + Math.cos(aim) * 8, p.y - 1 + Math.sin(aim) * 8);
  ctx.rotate(aim + wt.baseRot + swing);
  ctx.drawImage(icon, -5, -5);
  ctx.restore();
}

function drawEnemy(e) {
  if (!e.def.ghost) drawShadow(e.x, e.y, e.w * e.scale * 0.45);

  // mob PixelLab animado por dirección (esqueletos, rata, …) — gate por su set
  if (e.def.skel && typeof skelReady === 'function' && skelReady(e)) {
    drawSkel(e);
    drawEnemyExtras(e);
    return;
  }

  // slime CraftPix (sheets por dirección)
  if (e.def.slime && typeof slimeReady === 'function' && slimeReady(e)) {
    drawSlime(e);
    drawEnemyExtras(e);
    return;
  }

  // jefes con pack de animaciones (sheets): elegir anim según su estado
  if (e.def.anims && Sprites['anim_' + e.def.anims + '_idle']) {
    e._moved = Math.hypot(e.x - (e._lx !== undefined ? e._lx : e.x), e.y - (e._ly !== undefined ? e._ly : e.y)) > 0.05;
    e._lx = e.x; e._ly = e.y;
    let name = 'idle';
    if (e.kickStart && (state.time - e.kickStart) * 1000 < 670) name = 'kick';
    else if (e.telegraphT > 0) name = 'tackle_charge'; // el toro escarba: ventana de esquive
    else if (e.charging) name = 'tackle';
    else if (e._moved) name = 'run';
    if (e._animName !== name) { e._animName = name; e._animStart = state.time; }
    const adef = BOSS_ANIMS[name];
    const fi = animFrame(adef, (state.time - e._animStart) * 1000);
    const frames = Sprites['anim_' + e.def.anims + (e.dir < 0 ? '_' + name + '_L' : '_' + name)];
    let fspr = frames[fi];
    if (e.flashT > 0) fspr = tintedSprite(fspr, '#ffffff', 0.8);
    else if (e.enraged) fspr = tintedSprite(fspr, '#ff3030', 0.3);
    const k2 = fspr.ws || 1;
    const ox2 = (e.telegraphT > 0) ? (Math.random() - 0.5) * 2 : 0;
    const sq2 = e.flashT > 0 ? 0.12 : 0;
    ctx.save();
    // pivote del pack: bottom-center — los pies tocan el piso bajo la sombra
    ctx.translate(e.x + ox2, e.y + 6);
    ctx.scale(e.scale * k2 * (1 + sq2), e.scale * k2 * (1 - sq2));
    ctx.drawImage(fspr, -fspr.width / 2, -fspr.height);
    ctx.restore();
    drawEnemyExtras(e);
    return;
  }

  // un jefe que pateó su pelota se dibuja sin ella
  const base = (e.hasBall === false && e.def.spriteNoBall) ? e.def.spriteNoBall : e.def.sprite;
  let spr = Sprites[base + (e.dir < 0 ? '_L' : '')];
  if (e.flashT > 0) spr = tintedSprite(spr, '#ffffff', 0.8);
  else if (e.enraged) spr = tintedSprite(spr, '#ff3030', 0.3); // segunda fase: teñido de furia
  const alpha = e.def.ghost ? 0.75 : 1;
  // telegrafiado de carga del jefe: tiembla
  const ox = (e.telegraphT > 0) ? (Math.random() - 0.5) * 2 : 0;
  // sólo los fantasmas flotan; el resto queda quieto en idle. squash al recibir golpe aparte
  const bob = e.def.ghost ? Math.sin(e.wobble * 1.1) * 0.8 : 0;
  const sq = e.flashT > 0 ? 0.16 : 0;
  const k = spr.ws || 1;
  const S = e.scale * k;
  // anclar por los pies (última fila opaca) sobre la sombra (e.y+5), no por el centro:
  // así los sprites con aire abajo (rata) no flotan
  const footY = (spr.footY != null) ? spr.footY : spr.height;
  const pivotY = e.y + 5 + bob - (footY - spr.height / 2) * S;
  ctx.save();
  ctx.translate(e.x + ox, pivotY);
  ctx.scale(S * (1 + sq), S * (1 - sq));
  // élite: contorno dorado pulsante que recorre la silueta del sprite
  // (la silueta teñida se dibuja desplazada 1px en 8 direcciones, debajo)
  if (e.elite) {
    const sil = tintedSprite(spr, '#ffd84f', 1);
    ctx.globalAlpha = 0.55 + Math.sin(state.time * 5) * 0.3;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])
      ctx.drawImage(sil, -spr.width / 2 + dx, -spr.height / 2 + dy);
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.globalAlpha = 1;
  ctx.restore();
  drawEnemyExtras(e);
}

// Brillo del portador de llave + mini barra de vida (común a ambos caminos)
function drawEnemyExtras(e) {
  if (e.keyCarrier && Math.floor(state.time * 4) % 2 === 0) {
    ctx.fillStyle = '#ffd84f';
    ctx.fillRect(e.x - 1, e.y - e.h * e.scale - 7, 2, 2);
  }
  if (!e.isBoss && e.hp < e.maxhp) {
    const w = 12;
    ctx.fillStyle = '#000c';
    ctx.fillRect(e.x - w / 2, e.y - e.h - 5, w, 2);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(e.x - w / 2, e.y - e.h - 5, w * e.hp / e.maxhp, 2);
  }
}

function renderMinimap() {
  const lvl = state.level;
  const s = Math.min(mini.width / lvl.W, mini.height / lvl.H);
  mctx.clearRect(0, 0, mini.width, mini.height);
  const pal = ZONES[state.run.zoneIdx].palette;
  for (let ty = 0; ty < lvl.H; ty++) {
    for (let tx = 0; tx < lvl.W; tx++) {
      if (!state.explored[ty][tx] || lvl.map[ty][tx] === 0) continue;
      mctx.fillStyle = pal.wall;
      mctx.fillRect(tx * s, ty * s, s, s);
    }
  }
  if (lvl.exitOpen && state.explored[lvl.exit.ty][lvl.exit.tx]) {
    mctx.fillStyle = '#ffd84f';
    mctx.fillRect(lvl.exit.tx * s - 1, lvl.exit.ty * s - 1, s + 2, s + 2);
  }
  const p = state.player;
  mctx.fillStyle = '#fff';
  mctx.fillRect(p.x / TILE * s - 1.5, p.y / TILE * s - 1.5, 3, 3);
}
