// =====================================================================
// main.js — estado global, loop, input, render y progresión de pisos.
// =====================================================================

const state = {
  mode: 'menu', // menu | play | dead | win
  invOpen: false, paused: false,
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

// ---------------- Init ----------------

window.addEventListener('load', () => {
  buildSprites();
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
      if (state.invOpen) toggleInv();
      else if (state.mode === 'play') togglePause();
    }
    if (k === 'e') tryInteract();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', e => { mouse.sx = e.clientX; mouse.sy = e.clientY; });
  canvas.addEventListener('mousedown', e => { initAudio(); if (e.button === 0) mouse.down = true; });
  window.addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  $('endbtn').onclick = () => { $('endscreen').classList.add('hidden'); backToMenu(); };
  $('resumebtn').onclick = togglePause;
}

function toggleInv() {
  if (state.mode !== 'play' && !state.invOpen) return;
  state.invOpen = !state.invOpen;
  $('inv').classList.toggle('hidden', !state.invOpen);
  hideTooltip();
  if (state.invOpen) renderInv();
}

function togglePause() {
  if (state.mode !== 'play') return;
  state.paused = !state.paused;
  $('pausescreen').classList.toggle('hidden', !state.paused);
}

// ---------------- Run / pisos ----------------

function startRun(clsId) {
  state.player = makePlayer(clsId);
  state.run = { zoneIdx: 0, floorInZone: 0, depth: 0, kills: 0 };
  state.mode = 'play';
  state.invOpen = false; state.paused = false;
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
  state.explored = Array.from({ length: lvl.H }, () => new Array(lvl.W).fill(false));

  const p = state.player;
  p.x = lvl.start.x; p.y = lvl.start.y;
  p.ifr = 1;
  state.cam.x = p.x - canvas.width / ZOOM / 2;
  state.cam.y = p.y - canvas.height / ZOOM / 2;

  for (const s of lvl.spawns) state.enemies.push(spawnEnemy(s.type, s.x, s.y, run.depth));
  if (lvl.boss) {
    state.enemies.push(spawnEnemy(lvl.boss.type, lvl.boss.x, lvl.boss.y, run.depth, true));
    bigToast(BOSSES[lvl.boss.type].name, '#d8403f');
  } else {
    bigToast(zone.name + ' · Piso ' + run.floorInZone);
  }
  for (const g of lvl.groundItems) spawnPickup('item', g.x, g.y, makeItem(run.depth));
  sfx('stairs');
}

function onBossKilled(boss) {
  const run = state.run;
  state.level.exitOpen = true;
  if (run.zoneIdx >= ZONES.length - 1) {
    state.winT = 1.6; // pequeña pausa dramática antes de la victoria
  } else {
    bigToast('¡' + boss.def.name + ' derrotado!');
    toast('Se abrió la escalera', '#ffd84f');
  }
}

function onPlayerDeath() {
  state.mode = 'dead';
  showEnd(false);
}

function tryInteract() {
  if (state.mode !== 'play' || state.paused || state.invOpen) return;
  const p = state.player, lvl = state.level;
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
  state.invOpen = false; state.paused = false;
  $('inv').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('hint').classList.add('hidden');
  mini.classList.add('hidden');
  $('menu').classList.remove('hidden');
}

// ---------------- Loop ----------------

let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  if (state.mode === 'play' && !state.invOpen && !state.paused) update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  const p = state.player, lvl = state.level;

  // victoria diferida tras matar al jefe final
  if (state.winT > 0) {
    state.winT -= dt;
    if (state.winT <= 0) { state.mode = 'win'; showEnd(true); return; }
  }

  // movimiento
  let mx = 0, my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx--;
  if (keys.has('d') || keys.has('arrowright')) mx++;
  if (keys.has('w') || keys.has('arrowup')) my--;
  if (keys.has('s') || keys.has('arrowdown')) my++;
  if (mx || my) {
    const n = Math.hypot(mx, my);
    moveWithCollision(lvl, p, (mx / n) * p.stats.spd * dt, (my / n) * p.stats.spd * dt, false);
    if (mx) p.dir = mx;
  }

  // apuntado y ataque
  const aim = Math.atan2(mouseWorldY() - p.y, mouseWorldX() - p.x);
  if (mouse.down) playerAttack(aim);
  if (mouseWorldX() > p.x) p.dir = 1; else p.dir = -1;

  p.atkCd = Math.max(0, p.atkCd - dt);
  p.ifr = Math.max(0, p.ifr - dt);
  p.swingT = Math.max(0, p.swingT - dt);

  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateFloaters(dt);
  updateFx(dt);

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
  if (lvl.exitOpen) {
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

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = lvl.map[ty][tx] === 0;
      const X = tx * TILE, Y = ty * TILE;
      if (!solid) {
        const hash = (tx * 7 + ty * 13) % 5;
        ctx.fillStyle = hash === 0 ? pal.floorAlt : pal.floor;
        ctx.fillRect(X, Y, TILE, TILE);
        if (hash === 3) { // decal sutil
          ctx.fillStyle = pal.wallDark;
          ctx.fillRect(X + ((tx * 11) % 12), Y + ((ty * 7) % 12), 2, 1);
        }
      } else {
        // pared con cara frontal si abajo hay piso
        const floorBelow = ty + 1 < lvl.H && lvl.map[ty + 1][tx] === 1;
        ctx.fillStyle = floorBelow ? pal.wall : pal.wallDark;
        ctx.fillRect(X, Y, TILE, TILE);
        if (floorBelow) {
          ctx.fillStyle = pal.wallDark;
          ctx.fillRect(X, Y + TILE - 3, TILE, 3);
        }
      }
    }
  }

  // escalera de salida
  if (lvl.exitOpen) {
    const X = lvl.exit.tx * TILE, Y = lvl.exit.ty * TILE;
    ctx.fillStyle = '#0b0a0f';
    ctx.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 4; i++) ctx.fillRect(X + 2 + i, Y + 3 + i * 3, TILE - 4 - i * 2, 2);
  }

  // cofres
  for (const ch of lvl.chests) {
    const spr = ch.opened ? Sprites.cofre_abierto : Sprites.cofre;
    ctx.drawImage(spr, ch.x - spr.width / 2, ch.y - spr.height / 2);
  }

  // pickups
  for (const pk of state.pickups) {
    const bob = Math.sin(pk.t) * 1.5;
    if (pk.kind === 'coin') ctx.drawImage(Sprites.moneda, pk.x - 3, pk.y - 3 + bob);
    else if (pk.kind === 'heart') ctx.drawImage(Sprites.corazon, pk.x - 3.5, pk.y - 3 + bob);
    else if (pk.kind === 'item') {
      const spr = itemIcon(pk.item);
      const r = rarityOf(pk.item);
      ctx.fillStyle = r.color + '44';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(spr, pk.x - spr.width / 2, pk.y - spr.height / 2 + bob);
    }
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
    } else {
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, Math.PI * 2); ctx.fill();
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

  // números flotantes (en espacio de pantalla para que el texto sea nítido)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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

function drawSpriteC(spr, x, y, scale, alpha) {
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const w = spr.width * scale, h = spr.height * scale;
  ctx.drawImage(spr, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

function drawPlayer(p) {
  // parpadeo durante invulnerabilidad
  if (p.ifr > 0 && Math.floor(state.time * 14) % 2 === 0) return;
  drawSpriteC(playerSprite(p), p.x, p.y - 3, 1);
  drawHeldWeapon(p);

  // arco del espadazo
  if (p.swingT > 0) {
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, weaponDef(p).range - 6, p.swingAng - 0.9, p.swingAng + 0.9);
    ctx.stroke();
  }
}

// El arma equipada se ve en la mano, apuntando hacia el ratón
function drawHeldWeapon(p) {
  const arma = p.equip.arma;
  if (!arma) return;
  const wt = WEAPON_TYPES[arma.weaponType];
  const icon = Sprites['icon_' + arma.weaponType];
  const aim = Math.atan2(mouseWorldY() - p.y, mouseWorldX() - p.x);
  // golpe de muñeca durante el espadazo
  const swing = p.swingT > 0 ? Math.sin((0.16 - p.swingT) / 0.16 * Math.PI) * 1.1 - 0.55 : 0;
  ctx.save();
  ctx.translate(p.x + Math.cos(aim) * 8, p.y - 1 + Math.sin(aim) * 8);
  ctx.rotate(aim + wt.baseRot + swing);
  ctx.drawImage(icon, -5, -5);
  ctx.restore();
}

function drawEnemy(e) {
  const spr = Sprites[e.def.sprite + (e.dir < 0 ? '_L' : '')];
  const alpha = e.def.ghost ? 0.75 : 1;
  // telegrafiado de carga del jefe: tiembla y se tiñe
  const ox = (e.telegraphT > 0) ? (Math.random() - 0.5) * 2 : 0;
  drawSpriteC(spr, e.x + ox, e.y - 2, e.scale, alpha);
  if (e.flashT > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    const w = spr.width * e.scale, h = spr.height * e.scale;
    ctx.fillRect(e.x - w / 2, e.y - 2 - h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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
