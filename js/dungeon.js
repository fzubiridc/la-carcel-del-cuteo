// =====================================================================
// dungeon.js — generación procedural de mazmorras.
// Pisos normales: salas conectadas por pasillos. Piso de jefe: arena única.
// Tiles: 0 = pared, 1 = piso.
// =====================================================================

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function genDungeon(zone, depth, isBoss) {
  if (isBoss) return genBossArena(zone, depth);

  const W = 46, H = 46;
  const map = Array.from({ length: H }, () => new Array(W).fill(0));
  const rooms = [];

  // Colocar salas sin solaparse
  for (let i = 0; i < 80 && rooms.length < 9; i++) {
    const w = randInt(5, 9), h = randInt(5, 8);
    const x = randInt(2, W - w - 3), y = randInt(2, H - h - 3);
    const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
    rooms.push(r);
    for (let ty = y; ty < y + h; ty++)
      for (let tx = x; tx < x + w; tx++) map[ty][tx] = 1;
  }

  // Conectar cada sala con la anterior (pasillos en L, 2 tiles de ancho)
  const carve = (tx, ty) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const yy = ty + dy, xx = tx + dx;
      if (yy > 0 && yy < H - 1 && xx > 0 && xx < W - 1) map[yy][xx] = 1;
    }
  };
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = a.cx, y = a.cy;
    while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); }
    while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); }
    carve(x, y);
  }

  const startRoom = rooms[0];
  const endRoom = rooms[rooms.length - 1];
  const start = { x: (startRoom.cx + 0.5) * TILE, y: (startRoom.cy + 0.5) * TILE };
  const exit = { tx: endRoom.cx, ty: endRoom.cy };

  // Enemigos: en todas las salas menos la inicial
  const spawns = [];
  const count = r => Math.min(5, Math.round((1 + Math.random() * 2 + depth * 0.3) * zone.density));
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const n = count(r);
    for (let j = 0; j < n; j++) {
      spawns.push({
        type: pick(zone.enemies),
        x: (randInt(r.x + 1, r.x + r.w - 2) + 0.5) * TILE,
        y: (randInt(r.y + 1, r.y + r.h - 2) + 0.5) * TILE,
      });
    }
  }

  // Cofres (1-2) y algún ítem suelto en el piso
  const midRooms = rooms.slice(1, -1);
  const chests = [];
  const nChests = randInt(1, 2);
  for (let i = 0; i < nChests && midRooms.length; i++) {
    const r = midRooms.splice(Math.floor(Math.random() * midRooms.length), 1)[0];
    chests.push({ x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE, opened: false });
  }
  const groundItems = [];
  if (Math.random() < 0.6 && midRooms.length) {
    const r = pick(midRooms);
    groundItems.push({
      x: (randInt(r.x + 1, r.x + r.w - 2) + 0.5) * TILE,
      y: (randInt(r.y + 1, r.y + r.h - 2) + 0.5) * TILE,
    });
  }

  return { map, W, H, start, exit, exitOpen: true, spawns, chests, groundItems, isBoss: false, boss: null };
}

function genBossArena(zone, depth) {
  const W = 26, H = 22;
  const map = Array.from({ length: H }, () => new Array(W).fill(0));
  for (let y = 3; y < H - 3; y++)
    for (let x = 3; x < W - 3; x++) map[y][x] = 1;
  // Pilares decorativos
  for (const [px_, py_] of [[7, 7], [W - 8, 7], [7, H - 8], [W - 8, H - 8]]) {
    map[py_][px_] = 0;
  }
  return {
    map, W, H,
    start: { x: (W / 2) * TILE, y: (H - 5) * TILE },
    exit: { tx: W >> 1, ty: 4 },
    exitOpen: false, // se abre al matar al jefe
    spawns: [],
    chests: [],
    groundItems: [],
    isBoss: true,
    boss: { type: zone.boss, x: (W / 2) * TILE, y: 8 * TILE },
  };
}

function tileSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.W || ty >= level.H) return true;
  return level.map[ty][tx] === 0;
}

// ¿El rectángulo centrado en (x,y) choca con paredes?
function rectHitsWall(level, x, y, w, h) {
  const x0 = Math.floor((x - w / 2) / TILE), x1 = Math.floor((x + w / 2 - 0.01) / TILE);
  const y0 = Math.floor((y - h / 2) / TILE), y1 = Math.floor((y + h / 2 - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileSolid(level, tx, ty)) return true;
  return false;
}

// Mover entidad eje por eje (permite deslizarse por paredes)
function moveWithCollision(level, e, dx, dy, noclip) {
  if (noclip) { e.x += dx; e.y += dy; clampToLevel(level, e); return; }
  if (dx !== 0 && !rectHitsWall(level, e.x + dx, e.y, e.w, e.h)) e.x += dx;
  if (dy !== 0 && !rectHitsWall(level, e.x, e.y + dy, e.w, e.h)) e.y += dy;
}

function clampToLevel(level, e) {
  e.x = Math.max(e.w / 2, Math.min(level.W * TILE - e.w / 2, e.x));
  e.y = Math.max(e.h / 2, Math.min(level.H * TILE - e.h / 2, e.y));
}
