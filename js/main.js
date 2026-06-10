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
const keys = new Set();
const mouse = { sx: 0, sy: 0, down: false };
// Controles táctiles: joystick virtual + botones; el apuntado es automático
const touch = { enabled: false, stickId: null, baseX: 0, baseY: 0, vx: 0, vy: 0, attacking: false };

// ---------------- Init ----------------

window.addEventListener('load', () => {
  buildSprites();
  loadAssets(); // los CC0 de 32px reemplazan en caliente; hay fallback por código
  canvas = $('game'); ctx = canvas.getContext('2d');
  mini = $('minimap'); mctx = mini.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  buildMenu();
  requestAnimationFrame(loop);
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;
  ZOOM = Math.max(2, Math.round(window.innerHeight / 240));
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
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', e => { mouse.sx = e.clientX; mouse.sy = e.clientY; });
  canvas.addEventListener('mousedown', e => { initAudio(); if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  $('endbtn').onclick = () => { $('endscreen').classList.add('hidden'); backToMenu(); };
  $('resumebtn').onclick = togglePause;
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
  bind('btnatk', () => touch.attacking = true, () => touch.attacking = false);
  bind('btndash', () => tryDash());
  bind('btnpot', () => drinkPotion());
  bind('btnint', () => tryInteract());
}

// Ángulo de apuntado: ratón en escritorio, auto-apuntado al enemigo
// más cercano en táctil (si no hay, hacia donde te movés)
function aimAngle() {
  const p = state.player;
  if (!touch.enabled) return Math.atan2(mouseWorldY() - p.y, mouseWorldX() - p.x);
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

function nextFloor() {
  const run = state.run;
  const zone = ZONES[run.zoneIdx];
  run.floorInZone++;
  run.depth++;
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
  sfx('stairs');
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
  // escalera
  if (lvl.exitOpen) {
    const ex = (lvl.exit.tx + 0.5) * TILE, ey = (lvl.exit.ty + 0.5) * TILE;
    if (Math.hypot(p.x - ex, p.y - ey) < TILE * 1.2) {
      if (lvl.isBoss) { state.run.zoneIdx++; state.run.floorInZone = 0; }
      nextFloor();
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
  if (state.mode === 'play' && !state.invOpen && !state.paused && !state.upgradeOpen && !state.shopOpen) update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  state.run.time = (state.run.time || 0) + dt;
  const p = state.player, lvl = state.level;

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
      moveWithCollision(lvl, p, (mx / n) * p.stats.spd * dt, (my / n) * p.stats.spd * dt, false);
      if (mx) p.dir = mx > 0 ? 1 : -1;
      // pasos sutiles
      p.stepT = (p.stepT || 0) - dt;
      if (p.stepT <= 0) { p.stepT = 0.28; sfx('step'); }
    }

    // apuntado y ataque
    const aim = aimAngle();
    if (mouse.down || touch.attacking) playerAttack(aim);
    if (!touch.enabled) p.dir = mouseWorldX() > p.x ? 1 : -1;
  }

  p.atkCd = Math.max(0, p.atkCd - dt);
  p.ifr = Math.max(0, p.ifr - dt);
  p.swingT = Math.max(0, p.swingT - dt);

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

  // cofres: se abren al tocarlos
  for (const ch of lvl.chests) {
    if (!ch.opened && Math.hypot(p.x - ch.x, p.y - ch.y) < 16) {
      ch.opened = true;
      sfx('pickup');
      burst(ch.x, ch.y, '#ffd84f', 10);
      spawnPickup('item', ch.x, ch.y - 6, makeItem(state.run.depth + 1));
      for (let i = 0; i < 3; i++) spawnPickup('coin', ch.x + randInt(-12, 12), ch.y + randInt(-10, 10));
    }
  }

  // cofre dorado: solo se abre con la llave
  const lc = lvl.lockedChest;
  if (lc && !lc.opened && Math.hypot(p.x - lc.x, p.y - lc.y) < 16 && p.hasKey) {
    lc.opened = true;
    p.hasKey = false;
    sfx('levelup');
    burst(lc.x, lc.y, '#ffd84f', 20);
    spawnPickup('item', lc.x - 8, lc.y - 6, makeItemMinRare(state.run.depth + 1));
    spawnPickup('item', lc.x + 8, lc.y - 6, makeItem(state.run.depth + 1));
    for (let i = 0; i < 6; i++) spawnPickup('coin', lc.x + randInt(-14, 14), lc.y + randInt(-10, 10));
  }

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
  else if (lvl.lockedChest && !lvl.lockedChest.opened && Math.hypot(p.x - lvl.lockedChest.x, p.y - lvl.lockedChest.y) < TILE * 1.6 && !p.hasKey)
    msg = 'Cerrado — la llave la tiene una criatura de este piso';
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
  const floorImg = Sprites['floor_' + zoneNow.id];
  const wallImg = Sprites['wall_' + zoneNow.id];
  const torches = []; // antorchas visibles, para dibujar su luz después
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = lvl.map[ty][tx] === 0;
      const X = tx * TILE, Y = ty * TILE;
      const hash = (tx * 7 + ty * 13) % 5;
      const bigHash = (tx * 73 + ty * 37) % 23;
      if (!solid) {
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
        if (wallImg) {
          if (floorBelow) {
            ctx.drawImage(wallImg, X, Y, TILE, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.fillRect(X, Y + TILE - 3, TILE, 3);
          } else {
            ctx.drawImage(tintedSprite(wallImg, '#08070c', 0.55), X, Y, TILE, TILE);
          }
        } else {
          ctx.fillStyle = floorBelow ? pal.wall : pal.wallDark;
          ctx.fillRect(X, Y, TILE, TILE);
        }
        // antorcha cada tanto en las caras frontales
        if (floorBelow && bigHash === 0) torches.push([X + TILE / 2, Y, tx * 31 + ty]);
      }
    }
  }

  // antorchas: palo, llama animada y luz cálida parpadeante
  for (const [tX, tY, seed] of torches) {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(tX - 1, tY + 7, 2, 4);
    const fl = Math.floor(state.time * 9 + seed) % 3;
    ctx.fillStyle = fl === 0 ? '#ffb13f' : fl === 1 ? '#ff7b2f' : '#ffd84f';
    ctx.fillRect(tX - 1, tY + 4 + (fl === 1 ? 1 : 0), 2, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(tX - 0.5, tY + 5.5, 1, 1);
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
    const X = lvl.exit.tx * TILE, Y = lvl.exit.ty * TILE;
    ctx.fillStyle = '#0b0a0f';
    ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 4; i++) ctx.fillRect(X + 2 + i, Y + 3 + i * 3, TILE - 4 - i * 2, 2);
  }

  // decoración de arena (detrás de las entidades)
  for (const d of (lvl.decor || [])) {
    if (d.type === 'postes') drawRugbyPosts(d.x, d.y);
  }

  // cofres
  for (const ch of lvl.chests) {
    const spr = ch.opened ? Sprites.cofre_abierto : Sprites.cofre;
    drawShadow(ch.x, ch.y - 1, 5);
    ctx.drawImage(spr, ch.x - spr.width / 2, ch.y - spr.height / 2);
  }

  // cofre dorado y altar
  if (lvl.lockedChest) {
    const lc = lvl.lockedChest;
    const spr = lc.opened ? Sprites.cofre_abierto : Sprites.cofre_dorado;
    drawShadow(lc.x, lc.y - 1, 5);
    if (!lc.opened) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,216,79,0.08)';
      ctx.beginPath(); ctx.arc(lc.x, lc.y, 10 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(spr, lc.x - spr.width / 2, lc.y - spr.height / 2);
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
    const bob = Math.sin(pk.t) * 1.5;
    if (pk.kind === 'coin') ctx.drawImage(Sprites.moneda, pk.x - 3, pk.y - 3 + bob);
    else if (pk.kind === 'heart') ctx.drawImage(Sprites.corazon, pk.x - 3.5, pk.y - 3 + bob);
    else if (pk.kind === 'potion') ctx.drawImage(Sprites.pocion, pk.x - 3, pk.y - 4 + bob);
    else if (pk.kind === 'key') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,216,79,0.2)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(Sprites.llave, pk.x - 4, pk.y - 2 + bob);
    }
    else if (pk.kind === 'xp') {
      // puntito rojo de experiencia, titila
      const tw = 1 + Math.sin(pk.t * 2.5) * 0.35;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,70,60,0.28)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob * 0.4, 3.6 * tw, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob * 0.4, 1.7 * tw, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    else if (pk.kind === 'item') {
      const spr = itemIcon(pk.item);
      const r = rarityOf(pk.item);
      ctx.fillStyle = r.color + '44';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(spr, pk.x - spr.width / 2, pk.y - spr.height / 2 + bob);
    }
  }

  // pelota de rugby tirada en el piso (Bucle va a buscarla)
  for (const e of state.enemies) {
    if (e.ballPos) ctx.drawImage(Sprites.pelota, e.ballPos.x - 3.5, e.ballPos.y - 2, 7, 4);
  }

  // entidades ordenadas por Y (las de abajo tapan a las de arriba)
  const drawables = [...state.enemies, p].sort((a, b) => a.y - b.y);
  for (const e of drawables) {
    if (e === p) drawPlayer(p);
    else drawEnemy(e);
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
      // la pelota gira mientras vuela
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.t * 12);
      ctx.drawImage(Sprites.pelota, -3.5, -2, 7, 4);
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
    const sx = (p.x - state.cam.x) * ZOOM, sy = (p.y - state.cam.y) * ZOOM;
    const grad = ctx.createRadialGradient(sx, sy, 24 * ZOOM, sx, sy, 62 * ZOOM);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(5,4,8,0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

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

  // barra de vida del jefe
  const boss = state.enemies.find(e => e.isBoss);
  if (boss) {
    const bw = Math.min(420, canvas.width * 0.5);
    const bx = (canvas.width - bw) / 2, by = canvas.height - 46;
    ctx.fillStyle = '#000a'; ctx.fillRect(bx - 3, by - 3, bw + 6, 20);
    ctx.fillStyle = '#3a1216'; ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(bx, by, bw * boss.hp / boss.maxhp, 14);
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(boss.def.name, canvas.width / 2, by - 8);
    ctx.textAlign = 'left';
  }

  renderMinimap();
}

// Decoración de piso según la zona: huesos, hongos o runas
function drawFloorDecal(X, Y, tx, ty) {
  const zoneId = ZONES[state.run.zoneIdx].id;
  const ox = 3 + (tx * 5) % 8, oy = 3 + (ty * 3) % 8;
  if (zoneId === 'catacumbas') {
    // huesito
    ctx.fillStyle = '#b8b4a4';
    ctx.fillRect(X + ox, Y + oy, 4, 1);
    ctx.fillRect(X + ox - 1, Y + oy - 1, 1, 1);
    ctx.fillRect(X + ox + 4, Y + oy + 1, 1, 1);
  } else if (zoneId === 'cavernas') {
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

function drawPlayer(p) {
  drawShadow(p.x, p.y, 5);
  // tackleado: tirado en el piso con estrellitas dando vueltas
  if (p.stunT > 0) {
    const spr = playerSprite(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.dir >= 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
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
  // caminata: rebote e inclinación; en reposo, respiración sutil
  const spr = playerSprite(p);
  const bob = p.moving ? -Math.abs(Math.sin(state.time * 10)) * 1.5 : Math.sin(state.time * 2.2) * 0.5;
  const tilt = p.moving ? Math.sin(state.time * 10) * 0.07 : 0;
  ctx.save();
  ctx.translate(p.x, p.y - 3 + bob);
  ctx.rotate(tilt);
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.restore();
  drawHeldWeapon(p);

  // tajo de la espada: barrido animado con estela que se desvanece
  if (p.swingT > 0) {
    const wt = weaponDef(p);
    const k = 1 - p.swingT / 0.16;            // progreso del tajo 0→1
    const dir = p.swingDir || 1;
    const cur = p.swingAng + dir * (k * 2 - 1); // barre 2 radianes
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = cur - dir * i * 0.14;
      ctx.globalAlpha = (1 - i / 5) * 0.55;
      ctx.strokeStyle = i === 0 ? '#ffffff' : '#9ab8d8';
      ctx.lineWidth = 3 - i * 0.45;
      ctx.beginPath();
      ctx.arc(p.x, p.y, wt.range - 7, a - 0.14, a + 0.14);
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

// El arma equipada se ve en la mano, apuntando hacia el ratón
function drawHeldWeapon(p) {
  const arma = p.equip.arma;
  if (!arma) return;
  const wt = WEAPON_TYPES[arma.weaponType];
  const icon = Sprites['icon_' + arma.weaponType];
  const aim = aimAngle();
  // golpe de muñeca durante el espadazo (sigue la dirección del tajo)
  const swing = p.swingT > 0 ? (Math.sin((0.16 - p.swingT) / 0.16 * Math.PI) * 1.1 - 0.55) * (p.swingDir || 1) : 0;
  ctx.save();
  ctx.translate(p.x + Math.cos(aim) * 8, p.y - 1 + Math.sin(aim) * 8);
  ctx.rotate(aim + wt.baseRot + swing);
  ctx.drawImage(icon, -5, -5);
  ctx.restore();
}

function drawEnemy(e) {
  // aura dorada pulsante de los élite
  if (e.elite) {
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,216,79,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(e.x, e.y + 2, (e.w * e.scale / 2 + 4) * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,216,79,0.08)';
    ctx.beginPath();
    ctx.arc(e.x, e.y + 2, (e.w * e.scale / 2 + 4) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (!e.def.ghost) drawShadow(e.x, e.y, e.w * e.scale * 0.45);
  // un jefe que pateó su pelota se dibuja sin ella
  const base = (e.hasBall === false && e.def.spriteNoBall) ? e.def.spriteNoBall : e.def.sprite;
  let spr = Sprites[base + (e.dir < 0 ? '_L' : '')];
  if (e.flashT > 0) spr = tintedSprite(spr, '#ffffff', 0.8);
  else if (e.enraged) spr = tintedSprite(spr, '#ff3030', 0.3); // segunda fase: teñido de furia
  const alpha = e.def.ghost ? 0.75 : 1;
  // telegrafiado de carga del jefe: tiembla
  const ox = (e.telegraphT > 0) ? (Math.random() - 0.5) * 2 : 0;
  // bob de vida propia + squash al recibir un golpe
  const bob = Math.sin(e.wobble * 1.1) * 0.8;
  const sq = e.flashT > 0 ? 0.16 : 0;
  const k = spr.ws || 1;
  ctx.save();
  ctx.translate(e.x + ox, e.y - 2 + bob);
  ctx.scale(e.scale * k * (1 + sq), e.scale * k * (1 - sq));
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.globalAlpha = 1;
  ctx.restore();
  // el portador de la llave brilla dorado sobre la cabeza
  if (e.keyCarrier && Math.floor(state.time * 4) % 2 === 0) {
    ctx.fillStyle = '#ffd84f';
    ctx.fillRect(e.x - 1, e.y - e.h * e.scale - 7, 2, 2);
  }

  // mini barra de vida si está herido (no jefes: ellos tienen la grande)
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
