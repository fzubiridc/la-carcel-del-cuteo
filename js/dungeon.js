// =====================================================================
// dungeon.js — generación procedural de mazmorras.
// Pisos normales: salas conectadas por pasillos. Piso de jefe: arena única.
// Tiles: 0 = pared, 1 = piso.
// =====================================================================

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function genDungeon(zone, depth, isBoss) {
  if (isBoss) return genBossArena(zone, depth);

  // Eventos de piso: oscuro (visión reducida) o embrujado (más élites, más loot)
  let evento = null;
  const evRoll = Math.random();
  if (evRoll < 0.15) evento = 'oscuro';
  else if (evRoll < 0.30) evento = 'embrujado';

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

  // Eliminar muros de 1 tile de grosor (pasillos paralelos pegados, pilares
  // sueltos): se veían como "hojas" sin cuerpo. Si una celda de muro tiene
  // piso en lados OPUESTOS, se abre a piso. Sólo suma piso (no corta caminos);
  // los muros de 2+ tiles quedan intactos. Itera hasta que no queden.
  for (let pass = 0; pass < 4; pass++) {
    const open = [];
    for (let ty = 1; ty < H - 1; ty++)
      for (let tx = 1; tx < W - 1; tx++) {
        if (map[ty][tx] !== 0) continue;
        const horiz = map[ty][tx - 1] === 1 && map[ty][tx + 1] === 1;
        const vert = map[ty - 1][tx] === 1 && map[ty + 1][tx] === 1;
        if (horiz || vert) open.push([ty, tx]);
      }
    if (!open.length) break;
    for (const [ty, tx] of open) map[ty][tx] = 1;
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
        elite: Math.random() < (evento === 'embrujado' ? 0.25 : BALANCE.eliteChance),
        room: { x: r.x, y: r.y, w: r.w, h: r.h }, // sala "hogar": el aggro empieza al entrar
      });
    }
  }

  // Cofres (1-2) y algún ítem suelto en el piso
  const midRooms = rooms.slice(1, -1);
  const chests = [];
  const nChests = randInt(1, 2) + (evento === 'embrujado' ? 1 : 0);
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

  // Cofre dorado cerrado: la llave la lleva un enemigo aleatorio del piso
  let lockedChest = null;
  if (spawns.length && rooms.length > 2 && Math.random() < 0.55) {
    const r = pick(rooms.slice(1));
    lockedChest = { x: (randInt(r.x + 1, r.x + r.w - 2) + 0.5) * TILE, y: (randInt(r.y + 1, r.y + r.h - 2) + 0.5) * TILE, opened: false };
    spawns[Math.floor(Math.random() * spawns.length)].keyCarrier = true;
  }

  // Altar de sacrificio: vida a cambio de un tesoro
  let altar = null;
  // nunca en la sala inicial ni en la de la escalera de salida (no bloquear el paso)
  const altarRooms = rooms.slice(1, -1);
  if (altarRooms.length && Math.random() < 0.45) {
    const r = pick(altarRooms);
    altar = { x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE, used: false };
  }

  return { map, W, H, start, exit, exitOpen: true, spawns, chests, groundItems, lockedChest, altar, evento, decor: [], isBoss: false, boss: null };
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
  // Decoración de arena según el jefe (data-driven)
  const decor = [];
  const bdef = BOSSES[zone.boss];
  if (bdef && bdef.arenaDecor === 'rugby') {
    // dos arcos de rugby enfrentados, uno en cada punta de la cancha
    decor.push({ type: 'postes', x: (W / 2) * TILE, y: 5.6 * TILE });
    decor.push({ type: 'postes', x: (W / 2) * TILE, y: (H - 3.6) * TILE });
  }
  return {
    map, W, H,
    // spawn corrido del centro para no nacer pegado a la decoración del fondo
    start: { x: (W / 2 - 3) * TILE, y: (H - 5) * TILE },
    exit: { tx: W >> 1, ty: 4 },
    exitOpen: false, // se abre al matar al jefe
    spawns: [],
    chests: [],
    groundItems: [],
    decor,
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

// ¿El rectángulo choca con un cofre cerrado? (solo bloquea al jugador)
function rectHitsChest(level, x, y, w, h) {
  const hw = w / 2 + 5, hh = h / 2 + 5; // 5 = medio-tamaño de colisión del cofre
  const hit = (cx, cy) => Math.abs(x - cx) < hw && Math.abs(y - cy) < hh;
  for (const ch of level.chests) if (!ch.opened && hit(ch.x, ch.y)) return true;
  const lc = level.lockedChest;
  return !!(lc && !lc.opened && hit(lc.x, lc.y));
}

// Mover entidad eje por eje (permite deslizarse por paredes). Los cofres cerrados
// bloquean al jugador (no se puede pasar por arriba; se abren con [E]).
function moveWithCollision(level, e, dx, dy, noclip) {
  if (noclip) { e.x += dx; e.y += dy; clampToLevel(level, e); return; }
  const chestBlock = (typeof state !== 'undefined' && e === state.player);
  if (dx !== 0 && !rectHitsWall(level, e.x + dx, e.y, e.w, e.h) && !(chestBlock && rectHitsChest(level, e.x + dx, e.y, e.w, e.h))) e.x += dx;
  if (dy !== 0 && !rectHitsWall(level, e.x, e.y + dy, e.w, e.h) && !(chestBlock && rectHitsChest(level, e.x, e.y + dy, e.w, e.h))) e.y += dy;
}

function clampToLevel(level, e) {
  e.x = Math.max(e.w / 2, Math.min(level.W * TILE - e.w / 2, e.x));
  e.y = Math.max(e.h / 2, Math.min(level.H * TILE - e.h / 2, e.y));
}
