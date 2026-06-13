// =====================================================================
// pixi-renderer.js - renderer WebGL experimental (?pixi).
// Mantiene la logica del juego en main/entities y cambia solo el dibujo.
// =====================================================================

let PR = null;

async function initPixiRenderer(view) {
  if (typeof PIXI === 'undefined') throw new Error('PIXI no esta cargado');
  const app = new PIXI.Application({
    view,
    width: view.width,
    height: view.height,
    backgroundColor: 0x0b0a0f,
    antialias: false,
    autoDensity: false,
    resolution: 1,
    forceCanvas: false,
  });
  app.ticker.stop();
  app.view.style.imageRendering = 'pixelated';

  PR = {
    app,
    world: new PIXI.Container(),
    tiles: new PIXI.Container(),
    objects: new PIXI.Container(),
    fx: new PIXI.Container(),
    screen: new PIXI.Container(),
    tex: new WeakMap(),
    spritePool: [],
    spriteUsed: 0,
    graphicsPool: [],
    graphicsUsed: 0,
  };
  PR.world.addChild(PR.tiles, PR.objects, PR.fx);
  app.stage.addChild(PR.world, PR.screen);
}

function resizePixiRenderer(w, h) {
  if (PR) PR.app.renderer.resize(w, h);
}

function renderPixi() {
  if (!PR) return false;
  PR.spriteUsed = 0;
  PR.graphicsUsed = 0;
  PR.tiles.removeChildren();
  PR.objects.removeChildren();
  PR.fx.removeChildren();
  PR.screen.removeChildren();
  if (!state.level || !state.player) {
    PR.app.renderer.render(PR.app.stage);
    return true;
  }

  PR.world.scale.set(ZOOM);
  PR.world.position.set(-state.cam.x * ZOOM, -state.cam.y * ZOOM);

  drawPixiTiles();
  drawPixiObjects();
  drawPixiProjectiles();
  drawPixiParticles();
  drawPixiScreenFx();
  PR.app.renderer.render(PR.app.stage);
  return true;
}

function pixiTexture(img) {
  if (!img || (!img.width && !img.naturalWidth)) return null;
  let tex = PR.tex.get(img);
  if (!tex) {
    tex = PIXI.Texture.from(img);
    if (tex.baseTexture) tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    PR.tex.set(img, tex);
  }
  return tex;
}

function pixiSprite(parent, img, x, y, w, h, opt) {
  const tex = pixiTexture(img);
  if (!tex) return null;
  let s = PR.spritePool[PR.spriteUsed++];
  if (!s) {
    s = new PIXI.Sprite(tex);
    s.roundPixels = true;
    PR.spritePool.push(s);
  } else {
    s.texture = tex;
    s.visible = true;
    s.alpha = 1;
    s.rotation = 0;
    s.scale.set(1);
    s.tint = 0xffffff;
  }
  s.position.set(x, y);
  s.width = w == null ? (img.naturalWidth || img.width) : w;
  s.height = h == null ? (img.naturalHeight || img.height) : h;
  if (opt && opt.anchor) s.anchor.set(opt.anchor[0], opt.anchor[1]);
  else s.anchor.set(0, 0);
  if (opt && opt.alpha != null) s.alpha = opt.alpha;
  if (opt && opt.rotation) s.rotation = opt.rotation;
  if (opt && opt.tint) s.tint = opt.tint;
  parent.addChild(s);
  return s;
}

function pixiGraphics(parent) {
  let g = PR.graphicsPool[PR.graphicsUsed++];
  if (!g) {
    g = new PIXI.Graphics();
    PR.graphicsPool.push(g);
  } else {
    g.clear();
    g.alpha = 1;
    g.rotation = 0;
    g.scale.set(1);
    g.position.set(0, 0);
  }
  parent.addChild(g);
  return g;
}

function pcol(c, fallback) {
  if (!c) return fallback || 0xffffff;
  if (typeof c === 'number') return c;
  if (c[0] === '#') return parseInt(c.slice(1, 7), 16);
  return fallback || 0xffffff;
}

function pixiRect(parent, x, y, w, h, color, alpha) {
  const g = pixiGraphics(parent);
  g.beginFill(pcol(color), alpha == null ? 1 : alpha);
  g.drawRect(x, y, w, h);
  g.endFill();
}

function pixiCircle(parent, x, y, r, color, alpha) {
  const g = pixiGraphics(parent);
  g.beginFill(pcol(color), alpha == null ? 1 : alpha);
  g.drawCircle(x, y, r);
  g.endFill();
}

function pixiEllipse(parent, x, y, rx, ry, color, alpha) {
  const g = pixiGraphics(parent);
  g.beginFill(pcol(color), alpha == null ? 1 : alpha);
  g.drawEllipse(x, y, rx, ry);
  g.endFill();
}

function drawPixiTiles() {
  const lvl = state.level;
  const pal = ZONES[state.run.zoneIdx].palette;
  const x0 = Math.max(0, Math.floor(state.cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(state.cam.y / TILE) - 1);
  const x1 = Math.min(lvl.W - 1, Math.ceil((state.cam.x + canvas.width / ZOOM) / TILE) + 1);
  const y1 = Math.min(lvl.H - 1, Math.ceil((state.cam.y + canvas.height / ZOOM) / TILE) + 1);
  const zoneNow = ZONES[state.run.zoneIdx];
  const floorSet = Sprites['floor_' + zoneNow.id];
  const wallSet = Sprites['wall_' + zoneNow.id];
  const tvar = (x, y, n) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h % n;
  };
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = lvl.map[ty][tx] === 0;
      const X = tx * TILE, Y = ty * TILE;
      const hash = (tx * 7 + ty * 13) % 5;
      if (!solid) {
        const floorImg = Array.isArray(floorSet) ? floorSet[tvar(tx, ty, floorSet.length)] : floorSet;
        if (floorImg) pixiSprite(PR.tiles, floorImg, X, Y, TILE, TILE);
        else pixiRect(PR.tiles, X, Y, TILE, TILE, hash === 0 ? pal.floorAlt : pal.floor);
        if (hash === 0) pixiRect(PR.tiles, X, Y, TILE, TILE, 0x000000, 0.10);
      } else {
        const floorBelow = ty + 1 < lvl.H && lvl.map[ty + 1][tx] === 1;
        const wallImg = Array.isArray(wallSet) ? wallSet[tvar(tx + 101, ty + 57, wallSet.length)] : wallSet;
        if (floorBelow && wallImg) {
          pixiSprite(PR.tiles, wallImg, X, Y, TILE, TILE);
          pixiRect(PR.tiles, X, Y + TILE - 3, TILE, 3, 0x000000, 0.30);
        } else pixiRect(PR.tiles, X, Y, TILE, TILE, floorBelow ? pal.wall : 0x05040a);
      }
    }
  }
}

function drawPixiObjects() {
  const lvl = state.level;
  const p = state.player;
  if (lvl.exitOpen) pixiRect(PR.objects, lvl.exit.tx * TILE + 3, lvl.exit.ty * TILE + 3, TILE - 6, TILE - 6, 0xffd84f, 0.35);
  for (const pk of state.pickups) drawPixiPickup(pk);
  const chestDraws = lvl.chests.map(ch => ({ y: ch.y, _chest: ch, _gold: false }));
  if (lvl.lockedChest) chestDraws.push({ y: lvl.lockedChest.y, _chest: lvl.lockedChest, _gold: true });
  const drawables = [...state.enemies, p, ...chestDraws].sort((a, b) => a.y - b.y);
  for (const e of drawables) {
    if (e._chest) drawPixiChest(e._chest, e._gold);
    else if (e === p) drawPixiPlayer(p);
    else drawPixiEnemy(e);
  }
}

function drawPixiShadow(x, y, w) {
  pixiEllipse(PR.objects, x, y + 5, w, w * 0.35, 0x000000, 0.30);
}

function drawPixiPlayer(p) {
  drawPixiShadow(p.x, p.y, 5);
  const img = pixiPlayerImage(p);
  if (img) pixiSprite(PR.objects, img, p.x - 24, p.y + 5 - 36, 48, 48);
  else pixiCircle(PR.objects, p.x, p.y, 6, 0x7ec8ff, 1);
}

function pixiPlayerImage(p) {
  if (typeof V2H === 'undefined' || !V2H.ready) return null;
  const dx = p.x - (p._pixiPx !== undefined ? p._pixiPx : p.x);
  const dy = p.y - (p._pixiPy !== undefined ? p._pixiPy : p.y);
  p._pixiPx = p.x; p._pixiPy = p.y;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    const a = Math.atan2(dy, dx);
    p._pixiFace = V2_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  if (mouse.down || touch.attacking) {
    const aa = aimAngle();
    p._pixiFace = V2_OCTANTS[(Math.round(aa / (Math.PI / 4)) + 8) % 8];
  }
  const face = p._pixiFace || 'south';
  const anim = (p.hurtT || 0) > 0 ? 'hurt' : (p.moving ? 'walk' : 'idle');
  const def = V2H.anims[anim];
  if (!def) return null;
  const fi = Math.floor(state.time * 1000 / def.ms) % def.n;
  return V2H.imgs[`${anim}_${face}_${fi}`] || null;
}

function drawPixiEnemy(e) {
  if (!e.def.ghost) drawPixiShadow(e.x, e.y, e.w * e.scale * 0.45);
  const spr = Sprites[(e.hasBall === false && e.def.spriteNoBall ? e.def.spriteNoBall : e.def.sprite) + (e.dir < 0 ? '_L' : '')];
  const alpha = e.def.ghost ? 0.72 : 1;
  if (spr) {
    const S = e.scale * (spr.ws || 1);
    pixiSprite(PR.objects, spr, e.x, e.y + 5, spr.width * S, spr.height * S, { anchor: [0.5, 1], alpha });
  } else pixiCircle(PR.objects, e.x, e.y, Math.max(4, e.w * e.scale * 0.5), e.elite ? 0xffd84f : 0xc44a4a, alpha);
  if (e.hp < e.maxhp) {
    const w = 12 * e.scale;
    pixiRect(PR.objects, e.x - w / 2, e.y - e.h - 5, w, 2, 0x000000, 0.8);
    pixiRect(PR.objects, e.x - w / 2, e.y - e.h - 5, w * e.hp / e.maxhp, 2, 0xc0392b, 1);
  }
}

function drawPixiChest(ch, gold) {
  drawPixiShadow(ch.x, ch.y, 5);
  const spr = ch.opened ? Sprites.cofre_abierto : (gold ? Sprites.cofre_dorado : Sprites.cofre);
  if (spr) pixiSprite(PR.objects, spr, ch.x, ch.y, spr.width, spr.height, { anchor: [0.5, 0.5] });
  else pixiRect(PR.objects, ch.x - 5, ch.y - 4, 10, 8, gold ? 0xffd84f : 0x8b5a2b);
}

function drawPixiPickup(pk) {
  const bob = -(pk.hz || 0);
  if (pk.kind === 'coin') pixiSprite(PR.objects, Sprites.moneda, pk.x - 3, pk.y - 3 + bob);
  else if (pk.kind === 'heart') pixiSprite(PR.objects, Sprites.corazon, pk.x - 3.5, pk.y - 3 + bob);
  else if (pk.kind === 'potion') pixiSprite(PR.objects, Sprites.pocion, pk.x - 3, pk.y - 4 + bob);
  else if (pk.kind === 'key') pixiSprite(PR.objects, Sprites.llave, pk.x - 4, pk.y - 2 + bob);
  else if (pk.kind === 'xp') pixiCircle(PR.objects, pk.x, pk.y + bob, 2.2, 0xff5a4a, 0.9);
  else if (pk.kind === 'item') pixiCircle(PR.objects, pk.x, pk.y + 2 + bob, 6, pcol(rarityOf(pk.item).color), 0.45);
}

function drawPixiProjectiles() {
  for (const pr of state.projs) {
    if (pr.style === 'bolt' && typeof V2H !== 'undefined' && V2H.ready && V2H.fx.power.length) {
      const img = V2H.fx.power[Math.floor(pr.t * 1000 / 90) % V2H.fx.power.length];
      pixiSprite(PR.objects, img, pr.x, pr.y, 24, 24, { anchor: [0.5, 0.5], rotation: pr.ang, alpha: Math.min(1, pr.life * 3.5) });
    } else if (pr.style === 'arrow') {
      const g = pixiGraphics(PR.objects);
      g.beginFill(pcol(pr.color, 0xe8d8a0));
      g.drawRect(-4, -0.5, 8, 1);
      g.endFill();
      g.position.set(pr.x, pr.y); g.rotation = pr.ang;
    } else pixiCircle(PR.objects, pr.x, pr.y, pr.style === 'fire' ? 4 : 2.2, pcol(pr.color, 0xffffff), Math.min(1, pr.life * 4));
  }
}

function drawPixiParticles() {
  for (const pa of state.particles) pixiRect(PR.fx, pa.x - 1, pa.y - 1, 2, 2, pcol(pa.color), Math.min(1, pa.t * 3));
}

function drawPixiScreenFx() {
  const p = state.player;
  const sx = (p.x - state.cam.x) * ZOOM, sy = (p.y - state.cam.y) * ZOOM;
  pixiCircle(PR.screen, sx, sy, 38 * ZOOM, 0xffbe6e, 0.035);
}
