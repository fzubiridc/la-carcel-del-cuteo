// =====================================================================
// main.js — estado global, loop, input, render y progresión de pisos.
// =====================================================================

const state = {
  mode: 'loading', // loading | menu | play | dead | win
  invOpen: false, paused: false, upgradeOpen: false, shopOpen: false,
  player: null, run: null, level: null,
  enemies: [], projs: [], pickups: [], chests: [],
  particles: [], floaters: [], fx: [],
  cam: { x: 0, y: 0 }, shake: 0, time: 0, winT: 0,
  explored: null, minimapDirty: true,
};

let canvas, ctx, mini, mctx;
let ZOOM = 3;
let minimapBg = null, minimapBgCtx = null;
const QUERY = new URLSearchParams(location.search);
const DEBUG_MODE = QUERY.has('debug');
// Pixi es el unico renderer (el canvas legacy fue retirado). ?pixi ya no hace falta.
const PIXI_MODE = typeof PIXI !== 'undefined';
const perf = { acc: 0, frames: 0, fps: 0, frameMs: 0, lastUpdate: 0 };
const GOLD_CHEST_RANGE = 1.6;
const RUN_SAVE_KEY = 'carcel_run_v1';
const STAFF_OVERRIDE_KEY = 'carcel_staff_override';
let _darkCv = null, _darkCx = null; // capa de oscuridad offscreen (pisos "oscuro")
const keys = new Set();
const mouse = { sx: 0, sy: 0, down: false };
// Controles táctiles: joystick de movimiento + botón ATK que también apunta
// (tocás = atacar con auto-aim; arrastrás sobre él = apuntar manual)
const touch = { enabled: false, stickId: null, baseX: 0, baseY: 0, vx: 0, vy: 0,
  attacking: false, atkId: null, aimBaseX: 0, aimBaseY: 0, aimX: 0, aimY: 0, aimActive: false };

// ---------------- Init ----------------

window.addEventListener('load', () => {
  if (DEBUG_MODE) document.body.classList.add('debug');
  buildSprites();
  if (typeof loadV2Hero === 'function') loadV2Hero(); // mago v2 experimental (PixelLab)
  if (typeof loadMobs === 'function') loadMobs(); // motor unificado de mobs (frames PixelLab + sheets CraftPix)
  loadAssets(); // los CC0 de 32px reemplazan en caliente; hay fallback por código
  if (typeof loadStaffIcons === 'function') loadStaffIcons(); // íconos de vara arcana por tier (PixelLab)
  if (typeof loadCoinPiles === 'function') loadCoinPiles(); // pilas de monedas por valor
  if (typeof preloadInvAssets === 'function') preloadInvAssets(); // evita el lag de abrir el inventario por 1ª vez
  if (typeof loadXpFlames === 'function') loadXpFlames(); // llamas de experiencia (colores)
  if (typeof loadStairsImg === 'function') loadStairsImg(); // escalera de bajada
  if (typeof loadChestImg === 'function') loadChestImg(); // cofre cerrado/abierto
  if (typeof loadTowerTiles === 'function') loadTowerTiles(); // tileset Torre en Ruinas (8+8 variantes)
  if (typeof loadTorchImg === 'function') loadTorchImg(); // antorcha animada (sheet 8 frames)
  if (typeof loadLichFire === 'function') loadLichFire(); // bola de fuego del liche
  if (typeof loadDecorSheets === 'function') loadDecorSheets(); // props decorativos por zona (CraftPix)
  canvas = $('game'); ctx = PIXI_MODE ? null : canvas.getContext('2d');
  mini = $('minimap'); mctx = mini.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  // iOS: la barra del navegador aparece/desaparece sin disparar window.resize
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  bindInput();
  const start = () => { requestAnimationFrame(loop); waitForBootAssets(); };
  if (PIXI_MODE && typeof initPixiRenderer === 'function') {
    initPixiRenderer(canvas).then(start).catch(e => {
      console.error('[pixi] init failed, falling back to canvas:', e);
      ctx = canvas.getContext('2d');
      start();
    });
  } else start();
});

function bootAssetProgress() {
  if (typeof V2H === 'undefined') return { loaded: 0, total: 1, failed: 1, ready: false };
  const hero = V2H.loading || { loaded: 0, total: 0, failed: 0 };
  const rig = (V2H.staffRig && V2H.staffRig.loading) || { loaded: 0, total: 0, failed: 0 };
  const world = typeof WORLD_TEXTURES !== 'undefined' ? WORLD_TEXTURES : { loaded: 0, total: 0, failed: 0, ready: true };
  const mobs = typeof MOB_TEXTURES !== 'undefined' ? MOB_TEXTURES : { loaded: 0, total: 0, failed: 0, ready: true };
  const pickups = typeof PICKUP_TEXTURES !== 'undefined' ? PICKUP_TEXTURES : { loaded: 0, total: 0, failed: 0, ready: true };
  const loaded = hero.loaded + rig.loaded + world.loaded + mobs.loaded + pickups.loaded;
  const total = Math.max(1, hero.total + rig.total + world.total + mobs.total + pickups.total);
  const failed = hero.failed + rig.failed + world.failed + mobs.failed + pickups.failed;
  return {
    loaded, total, failed,
    ready: !!(V2H.ready && V2H.staffRig && V2H.staffRig.ready && world.ready && mobs.ready && pickups.ready && failed === 0),
  };
}

function setLoadingUI(msg, pct, error) {
  const loading = $('loading');
  if (!loading) return;
  loading.classList.toggle('error', !!error);
  const fill = $('loadfill');
  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  const label = $('loadmsg');
  if (label) label.textContent = msg;
}

function waitForBootAssets(start) {
  start = start || performance.now();
  const p = bootAssetProgress();
  const pct = Math.round((p.loaded / p.total) * 100);
  setLoadingUI('Cargando arte y texturas... ' + pct + '%', pct, false);
  if (p.ready) {
    state.mode = 'menu';
    $('loading').classList.add('hidden');
    $('menu').classList.remove('hidden');
    buildMenu();
    return;
  }
  if (p.failed || performance.now() - start > 12000) {
    const failed = p.failed ? 'Falto cargar un asset o textura.' : 'La carga tardo demasiado.';
    setLoadingUI(failed + ' Recarga la pagina para evitar el fallback.', pct, true);
    return;
  }
  setTimeout(() => waitForBootAssets(start), 50);
}

function resize() {
  const cssW = Math.max(1, window.innerWidth);
  const cssH = Math.max(1, window.innerHeight);
  canvas.width = cssW;
  canvas.height = cssH;
  if (ctx) ctx.imageSmoothingEnabled = false;
  ZOOM = Math.max(2, Math.round(cssH / 240));
  if (PIXI_MODE && typeof resizePixiRenderer === 'function') resizePixiRenderer(canvas.width, canvas.height);
  // escala del HUD v2 (diseñado a 1920 de ancho; no deja que ocupe de más en chico)
  const huds = Math.min(1.05, Math.max(0.46, cssW / 1920));
  document.documentElement.style.setProperty('--huds', huds);
}

function setMouseFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, r.width);
  const sy = canvas.height / Math.max(1, r.height);
  mouse.sx = (e.clientX - r.left) * sx;
  mouse.sy = (e.clientY - r.top) * sy;
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
    if (k === 'r') tryNova();
    if (k === 'q') drinkPotion();
    if (k === 'f') drinkManaPotion();
    if (k === 'm') toggleMusic();
    // autoplay: si la música quedó bloqueada, este gesto la destraba
    if (music && music.paused && musicOk && !musicMuted) music.play().catch(() => { });
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', setMouseFromEvent);
  canvas.addEventListener('mousedown', e => { initAudio(); setMouseFromEvent(e); if (e.button === 0) mouse.down = true; else if (e.button === 2) tryNova(); });
  window.addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // REINTENTAR: arranca una run nueva directo con la misma clase. MENÚ: vuelve al menú.
  $('endbtn').onclick = () => { const cls = (state.player && state.player.cls) || 'mago'; $('endscreen').classList.add('hidden'); startRun(cls); };
  $('endbtn2').onclick = () => { $('endscreen').classList.add('hidden'); backToMenu(); };
  $('resumebtn').onclick = togglePause;
  // Botón debug: salta directo a la sala de jefe de la zona actual
  $('debugboss').onclick = () => {
    if (!DEBUG_MODE) return;
    if (!state.run) return;
    state.run.floorInZone = ZONES[state.run.zoneIdx].floors;
    nextFloor();
  };
  bindStaffSelector();
  bindTouch();
}

function bindStaffSelector() {
  const sel = $('staffselect');
  if (!sel) return;
  try { sel.value = localStorage.getItem(STAFF_OVERRIDE_KEY) || '-1'; } catch (e) { sel.value = '-1'; }
  sel.onchange = () => {
    const v = +sel.value;
    try { localStorage.setItem(STAFF_OVERRIDE_KEY, String(v)); } catch (e) { }
    if (state.player) state.player.staffOverride = v;
    toast(v >= 0 ? 'Mostrando staff ' + (v + 1) + ' (prueba visual)' : 'Staff según equipo', '#ffd84f');
  };
}

function bindTouch() {
  touch.enabled = 'ontouchstart' in window;
  if (!touch.enabled) return;
  $('touchui').classList.remove('hidden');
  $('hint').style.display = 'none'; // el hint de teclado no aplica en táctil
  // controles de debug/dev: fuera en móvil (ocupan lugar y no son para jugar)
  const dbg = $('debugboss'); if (dbg) dbg.style.display = 'none';
  const sst = $('stafftest'); if (sst) sst.style.display = 'none';

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
  bind('btnnova', () => tryNova());
  bind('btnpot', () => drinkPotion());
  bind('btnint', () => tryInteract());

  // Abrir el inventario tocando el PERSONAJE. El canvas solo recibe los toques que no
  // caen en el joystick ni en los botones (esos están encima, con pointer-events:auto).
  let invTap = null;
  canvas.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    invTap = { x: t.clientX, y: t.clientY, t0: e.timeStamp, id: t.identifier };
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!invTap || state.mode !== 'play' || state.invOpen) { invTap = null; return; }
    for (const t of e.changedTouches) {
      if (t.identifier !== invTap.id) continue;
      const moved = Math.hypot(t.clientX - invTap.x, t.clientY - invTap.y);
      const dur = e.timeStamp - invTap.t0;
      if (moved < 18 && dur < 320 && tapOnPlayer(t.clientX, t.clientY)) toggleInv();
    }
    invTap = null;
  }, { passive: true });
}

// ¿El toque (coords de pantalla) cae sobre el cuerpo del jugador? Convierte la posición
// del jugador a pantalla (px = (mundo - cámara) * ZOOM) y mide distancia; el sprite está
// anclado en los pies, así que el centro del cuerpo va un poco más arriba.
function tapOnPlayer(sx, sy) {
  const p = state.player;
  if (!p || typeof state.cam === 'undefined') return false;
  const psx = (p.x - state.cam.x) * ZOOM;
  const psy = (p.y - 10 - state.cam.y) * ZOOM;
  return Math.hypot(sx - psx, sy - psy) < 30 * ZOOM;
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
  clearSavedRun();
  state.player = makePlayer(clsId);
  applyStaffOverride(state.player);
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
  saveRunToStorage();
}

function applyStaffOverride(p) {
  if (!p) return;
  let v = -1;
  try { v = +(localStorage.getItem(STAFF_OVERRIDE_KEY) || -1); } catch (e) { }
  p.staffOverride = Number.isFinite(v) ? v : -1;
  const sel = $('staffselect');
  if (sel) sel.value = String(p.staffOverride);
}

function hasSavedRun() {
  try { return !!localStorage.getItem(RUN_SAVE_KEY); } catch (e) { return false; }
}

function clearSavedRun() {
  try { localStorage.removeItem(RUN_SAVE_KEY); } catch (e) { }
}

function plainClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function serializeEnemy(e) {
  const out = {};
  for (const k in e) {
    if (k === 'def') continue;
    const v = e[k];
    if (typeof v !== 'function') out[k] = v;
  }
  return out;
}

function reviveEnemy(e) {
  e.def = e.isBoss ? BOSSES[e.type] : ENEMIES[e.type];
  e.ai = e.isBoss ? 'boss' : (e.ai || (e.def && e.def.ai));
  e.w = e.w || (e.def && e.def.size) || 10;
  e.h = e.h || (e.def && e.def.size) || 10;
  e.scale = e.scale || ((e.def && e.def.scale) || 1) * (e.elite ? 1.2 : 1);
  return e;
}

function serializeFloor(rec) {
  return {
    lvl: plainClone(rec.lvl),
    enemies: (rec.enemies || []).map(serializeEnemy),
    pickups: plainClone(rec.pickups || []),
    explored: plainClone(rec.explored || []),
    zoneIdx: rec.zoneIdx,
    floorInZone: rec.floorInZone,
    hasKey: !!rec.hasKey,
  };
}

function reviveFloor(rec) {
  return {
    lvl: rec.lvl,
    enemies: (rec.enemies || []).map(reviveEnemy),
    pickups: rec.pickups || [],
    explored: rec.explored || [],
    zoneIdx: rec.zoneIdx,
    floorInZone: rec.floorInZone,
    hasKey: !!rec.hasKey,
  };
}

function noteItemId(it) {
  if (it && typeof _itemSeq !== 'undefined') _itemSeq = Math.max(_itemSeq, it.id || 0);
}

function noteSavedItemIds() {
  const p = state.player;
  if (p) {
    for (const slot in (p.equip || {})) noteItemId(p.equip[slot]);
    for (const it of (p.bag || [])) noteItemId(it);
  }
  for (const depth in (state.run && state.run.saved || {})) {
    const rec = state.run.saved[depth];
    for (const pk of (rec.pickups || [])) noteItemId(pk.item);
    const stock = rec.lvl && rec.lvl.shopStock;
    if (stock) for (const it of (stock.items || [])) noteItemId(it);
  }
}

function saveRunToStorage() {
  if (state.mode !== 'play' || !state.player || !state.run || !state.level) return;
  saveCurrentFloor();
  const saved = {};
  for (const depth in (state.run.saved || {})) saved[depth] = serializeFloor(state.run.saved[depth]);
  const payload = {
    v: 1,
    savedAt: Date.now(),
    player: plainClone(state.player),
    run: {
      zoneIdx: state.run.zoneIdx,
      floorInZone: state.run.floorInZone,
      depth: state.run.depth,
      kills: state.run.kills,
      time: state.run.time || 0,
      saved,
    },
  };
  try { localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(payload)); }
  catch (e) { toast('No se pudo guardar la run en este navegador', '#ff6b6b'); }
}

function loadRunFromStorage() {
  let raw = null;
  try { raw = localStorage.getItem(RUN_SAVE_KEY); } catch (e) { }
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    if (!payload || payload.v !== 1 || !payload.player || !payload.run) throw new Error('save invalido');
    state.player = payload.player;
    applyStaffOverride(state.player);
    state.player.bag = state.player.bag || Array(BALANCE.bagSize).fill(null);
    state.player.equip = state.player.equip || {};
    state.player.bonus = state.player.bonus || { hp: 0, spd: 0, crit: 0, atkspd: 0, def: 0, dmgMul: 1 };
    calcStats(state.player);
    state.player.hp = Math.min(state.player.hp, state.player.stats.maxhp);
    state.player.mana = Math.min(state.player.mana || state.player.stats.maxMana, state.player.stats.maxMana);
    state.run = {
      zoneIdx: payload.run.zoneIdx,
      floorInZone: payload.run.floorInZone,
      depth: payload.run.depth,
      kills: payload.run.kills || 0,
      time: payload.run.time || 0,
      saved: {},
    };
    for (const depth in (payload.run.saved || {})) state.run.saved[depth] = reviveFloor(payload.run.saved[depth]);
    noteSavedItemIds();
    const rec = state.run.saved[state.run.depth];
    if (!rec) throw new Error('piso actual faltante');
    state.mode = 'play';
    state.invOpen = false; state.paused = false; state.upgradeOpen = false; state.shopOpen = false;
    $('upgradescreen').classList.add('hidden');
    $('shop').classList.add('hidden');
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('hint').classList.remove('hidden');
    mini.classList.remove('hidden');
    restoreFloor(rec, state.player.x || rec.lvl.start.x, state.player.y || rec.lvl.start.y);
    toast('Run continuada', '#ffd84f');
    return true;
  } catch (e) {
    clearSavedRun();
    toast('La run guardada estaba corrupta y se descartó', '#ff6b6b');
    return false;
  }
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
  state.minimapDirty = true;
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
  saveRunToStorage();
}

function nextFloor() {
  const run = state.run;
  saveCurrentFloor();
  run.depth++;
  // piso ya visitado: se restaura como lo dejaste
  if (run.saved && run.saved[run.depth]) {
    const rec = run.saved[run.depth];
    restoreFloor(rec, rec.lvl.start.x, rec.lvl.start.y);
    saveRunToStorage();
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
  state.minimapDirty = true;

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
  saveRunToStorage();
}

function onBossKilled(boss) {
  const run = state.run;
  const lvl = state.level;
  lvl.exitOpen = true;
  state.minimapDirty = true;
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
  clearSavedRun();
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

// Nova arcana: poder secundario (tecla R / click derecho). Explosión de energía alrededor
// del mago que daña y EMPUJA a los enemigos cercanos. Cuesta maná y tiene cooldown propio.
const NOVA = { radius: 56, cd: 4.5, mana: 40, dmgMul: 1.9, knock: 3.6 };
function tryNova() {
  const p = state.player;
  if (!p || state.mode !== 'play' || state.invOpen || state.paused || state.upgradeOpen || state.shopOpen) return;
  if (p.cls !== 'mago') return;                 // por ahora, poder del mago
  if (p.stunT > 0 || p.dashT > 0 || (p.novaCd || 0) > 0) return;
  if ((p.mana || 0) < NOVA.mana) return; // sin maná suficiente: no castea ni gasta cooldown
  p.mana = Math.max(0, (p.mana || 0) - NOVA.mana);
  p.novaCd = NOVA.cd;
  const cx = p.x, cy = p.y + 2;                  // centro a los pies del mago (plano del piso)
  const crit = Math.random() * 100 < p.stats.crit;
  const dmg = Math.round(playerDamage(p) * NOVA.dmgMul * (crit ? 2 : 1));
  // daño + empuje radial a los enemigos dentro del radio (falloff suave hacia el borde)
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - cx, e.y - cy);
    if (d < NOVA.radius + e.w) {
      const fall = d < NOVA.radius * 0.5 ? 1 : 0.65;
      damageEnemy(e, Math.round(dmg * fall), crit, (e.x - cx) * NOVA.knock, (e.y - cy) * NOVA.knock);
    }
  }
  // fx arcano: explosión sprite (v2boom, escalada a la nova) + flash de luz (motor diferido)
  // + onda + runa de anillos + chispas en anillo.
  state.fx.push({ type: 'lightburst', x: cx, y: cy, t: 0.8, t0: 0.8, r: NOVA.radius + 36 });
  if (typeof V2H !== 'undefined' && V2H.ready && V2H.fx && V2H.fx.boom && V2H.fx.boom.length)
    state.fx.push({ type: 'v2boom', x: cx, y: cy - 4, start: state.time, t: 0.5, t0: 0.5, scale: 1.5 });
  state.fx.push({ type: 'flash', x: cx, y: cy, t: 0.16, t0: 0.16, r: NOVA.radius * 0.7 });
  state.fx.push({ type: 'ring', x: cx, y: cy, t: 0.42, t0: 0.42, maxR: NOVA.radius + 8, color: '#b14fff' });
  state.fx.push({ type: 'ring', x: cx, y: cy, t: 0.34, t0: 0.34, maxR: NOVA.radius, color: '#9ad8ff' });
  state.fx.push({ type: 'ring', x: cx, y: cy, t: 0.55, t0: 0.55, maxR: NOVA.radius * 0.5, color: '#ffffff' });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.25, s = 130 + Math.random() * 90;
    state.particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.3 + Math.random() * 0.25, color: i % 2 ? '#b14fff' : '#9ad8ff', glow: true });
  }
  shake(3);
  sfx('boom');
}

// cofre común: tapa que cruje, loot y se vuelve transitable (deja de bloquear)
function openChest(ch) {
  ch.opened = true; ch.openT = state.time; // openT: arranca la animación de apertura
  sfx('chest');
  burst(ch.x, ch.y, '#ffd84f', 10);
  spawnPickup('item', ch.x, ch.y - 6, makeItem(state.run.depth + 1));
  spawnPickup('coin', ch.x, ch.y + 4).val = randInt(5, 12) + state.run.depth * 2;
  if (Math.random() < 0.5) spawnPickup('potion', ch.x + randInt(-6, 6), ch.y + 8);
  if (Math.random() < 0.4) spawnPickup('manapotion', ch.x + randInt(-6, 6), ch.y - 2);
}

// cofre dorado: consume la llave, loot raro+ y fanfarria
function openLockedChest(lc) {
  lc.opened = true; lc.openT = state.time;
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
  if (lvl.lockedChest && !lvl.lockedChest.opened && Math.hypot(p.x - lvl.lockedChest.x, p.y - lvl.lockedChest.y) < TILE * GOLD_CHEST_RANGE) {
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
  const rawDt = lastT ? (t - lastT) / 1000 : 0;
  const dt = Math.min(rawDt || 0, 0.05);
  lastT = t;
  updatePerfStats(rawDt, t);
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

function updatePerfStats(rawDt, t) {
  if (!DEBUG_MODE || rawDt <= 0) return;
  perf.acc += rawDt;
  perf.frames++;
  if (t - perf.lastUpdate < 500) return;

  perf.fps = perf.acc > 0 ? perf.frames / perf.acc : 0;
  perf.frameMs = perf.fps > 0 ? 1000 / perf.fps : 0;
  perf.acc = 0;
  perf.frames = 0;
  perf.lastUpdate = t;

  const el = $('perf');
  if (!el) return;
  const cls = perf.fps >= 55 ? 'perfok' : perf.fps >= 40 ? 'perfwarn' : 'perfbad';
  const enemies = state.enemies ? state.enemies.length : 0;
  const projs = state.projs ? state.projs.length : 0;
  const fx = (state.particles ? state.particles.length : 0) + (state.fx ? state.fx.length : 0);
  const pixiStats = typeof getPixiDebugStats === 'function' ? getPixiDebugStats() : null;
  el.innerHTML =
    '<b class="' + cls + '">' + Math.round(perf.fps) + ' FPS</b><br>' +
    perf.frameMs.toFixed(1) + ' ms/frame<br>' +
    canvas.width + 'x' + canvas.height + '<br>' +
    'Enemigos: ' + enemies + '<br>' +
    'Proy: ' + projs + '<br>' +
    'FX: ' + fx +
    (pixiStats ? '<br>Pixi tiles: ' + pixiStats.tiles +
      '<br>Pixi obj: ' + pixiStats.objects +
      '<br>Pixi draw: ' + pixiStats.sprites + 'S/' + pixiStats.graphics + 'G' : '');
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
    if (state.winT <= 0) { state.mode = 'win'; clearSavedRun(); showEnd(true); return; }
  }

  // dash: impulso breve, invulnerable, con cooldown
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.novaCd = Math.max(0, (p.novaCd || 0) - dt); // cooldown de la nova arcana
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
    if (tx >= 0 && ty >= 0 && tx < lvl.W && ty < lvl.H && !state.explored[ty][tx]) {
      state.explored[ty][tx] = true;
      state.minimapDirty = true;
    }
  }

  // cámara
  state.cam.x = p.x - canvas.width / ZOOM / 2;
  state.cam.y = p.y - canvas.height / ZOOM / 2;
  state.shake = Math.max(0, state.shake - dt * 18);

  updateHUD();
  updatePrompt();
  updateAutosave(dt);
}

function updateAutosave(dt) {
  updateAutosave.t = (updateAutosave.t || 0) + dt;
  if (updateAutosave.t < 2) return;
  updateAutosave.t = 0;
  saveRunToStorage();
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
  else if (lvl.lockedChest && !lvl.lockedChest.opened && Math.hypot(p.x - lvl.lockedChest.x, p.y - lvl.lockedChest.y) < TILE * GOLD_CHEST_RANGE)
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
  // Pixi es el unico renderer. El minimap (canvas DOM aparte) solo si hay nivel.
  if (PIXI_MODE && typeof renderPixi === 'function') renderPixi(dt);
  if (state.level && state.player) renderMinimap();
}

function renderMinimap() {
  const lvl = state.level;
  const s = Math.min(mini.width / lvl.W, mini.height / lvl.H);
  if (!minimapBg) {
    minimapBg = document.createElement('canvas');
    minimapBgCtx = minimapBg.getContext('2d');
  }
  if (minimapBg.width !== mini.width || minimapBg.height !== mini.height) {
    minimapBg.width = mini.width;
    minimapBg.height = mini.height;
    state.minimapDirty = true;
  }
  if (state.minimapDirty) {
    minimapBgCtx.clearRect(0, 0, minimapBg.width, minimapBg.height);
    const pal = ZONES[state.run.zoneIdx].palette;
    for (let ty = 0; ty < lvl.H; ty++) {
      for (let tx = 0; tx < lvl.W; tx++) {
        if (!state.explored[ty][tx] || lvl.map[ty][tx] === 0) continue;
        minimapBgCtx.fillStyle = pal.wall;
        minimapBgCtx.fillRect(tx * s, ty * s, s, s);
      }
    }
    if (lvl.exitOpen && state.explored[lvl.exit.ty][lvl.exit.tx]) {
      minimapBgCtx.fillStyle = '#ffd84f';
      minimapBgCtx.fillRect(lvl.exit.tx * s - 1, lvl.exit.ty * s - 1, s + 2, s + 2);
    }
    state.minimapDirty = false;
  }
  mctx.clearRect(0, 0, mini.width, mini.height);
  mctx.drawImage(minimapBg, 0, 0);
  const p = state.player;
  mctx.fillStyle = '#fff';
  mctx.fillRect(p.x / TILE * s - 1.5, p.y / TILE * s - 1.5, 3, 3);
}
