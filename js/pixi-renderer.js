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
    torches: new PIXI.Container(),
    entities: new PIXI.Container(), // objetos + fx, ENCIMA de la luz (brillo normal)
    objects: new PIXI.Container(),
    fx: new PIXI.Container(),
    screen: new PIXI.Container(),
    tex: new WeakMap(),
    frameTex: new WeakMap(),
    tileCache: null,
    spritePool: [],
    spriteUsed: 0,
    graphicsPool: [],
    graphicsUsed: 0,
    lights: null, // capa de luz/oscuridad (ver buildLighting)
  };
  PR.world.addChild(PR.tiles, PR.torches);
  PR.entities.addChild(PR.objects, PR.fx);
  PR.lights = buildLighting();
  // orden: piso (recibe la luz) -> capa de luz -> entidades (brillo normal, encima) -> screen
  app.stage.addChild(PR.world, PR.lights.lighting, PR.entities, PR.screen);
}

function resizePixiRenderer(w, h) {
  if (PR) PR.app.renderer.resize(w, h);
}

function invalidatePixiTileCache() {
  if (PR) PR.tileCache = null;
}

function getPixiDebugStats() {
  if (!PR) return null;
  return {
    tiles: PR.tiles.children.length,
    objects: PR.objects.children.length,
    fx: PR.fx.children.length,
    sprites: PR.spriteUsed,
    graphics: PR.graphicsUsed,
  };
}

function renderPixi() {
  if (!PR) return false;
  PR.spriteUsed = 0;
  PR.graphicsUsed = 0;
  PR.objects.removeChildren();
  PR.torches.removeChildren();
  PR.fx.removeChildren();
  PR.screen.removeChildren();
  if (!state.level || !state.player) {
    PR.app.renderer.render(PR.app.stage);
    return true;
  }

  PR.world.scale.set(ZOOM);
  PR.world.position.set(-state.cam.x * ZOOM, -state.cam.y * ZOOM);
  PR.entities.scale.set(ZOOM);
  PR.entities.position.set(-state.cam.x * ZOOM, -state.cam.y * ZOOM);

  drawPixiTiles();
  drawPixiTorches();
  drawPixiObjects();
  drawPixiProjectiles();
  drawPixiParticles();
  drawPixiLighting();
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

function pixiFrameTexture(img, sx, sy, sw, sh) {
  const base = pixiTexture(img);
  if (!base || !base.baseTexture) return null;
  let byImage = PR.frameTex.get(img);
  if (!byImage) {
    byImage = new Map();
    PR.frameTex.set(img, byImage);
  }
  const key = sx + ',' + sy + ',' + sw + ',' + sh;
  let tex = byImage.get(key);
  if (!tex) {
    tex = new PIXI.Texture(base.baseTexture, new PIXI.Rectangle(sx, sy, sw, sh));
    byImage.set(key, tex);
  }
  return tex;
}

function pixiSpriteFromTexture(parent, tex, x, y, opt) {
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
    s.anchor.set(0, 0);
  }
  s.position.set(x, y);
  if (opt && opt.anchor) s.anchor.set(opt.anchor[0], opt.anchor[1]);
  if (opt && opt.scale) s.scale.set(opt.scale[0], opt.scale[1]);
  if (opt && opt.rotation) s.rotation = opt.rotation;
  if (opt && opt.alpha != null) s.alpha = opt.alpha;
  if (opt && opt.tint != null) s.tint = opt.tint; // != null: 0x000000 (negro) es falsy, no usar truthy
  parent.addChild(s);
  return s;
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
  if (opt && opt.tint != null) s.tint = opt.tint; // != null: 0x000000 (negro) es falsy, no usar truthy
  parent.addChild(s);
  return s;
}

function pixiSpriteRaw(parent, img, x, y, opt) {
  const tex = pixiTexture(img);
  if (!tex) return null;
  return pixiSpriteFromTexture(parent, tex, x, y, opt);
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
  if (c == null) return fallback || 0xffffff; // ojo: 0x000000 === 0 es falsy; con !c el negro saldria blanco
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

function pixiTileVariant(x, y, n) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h % n;
}

function pixiDrawFloorDecal(g, pal, X, Y, tx, ty) {
  const seed = (tx * 928371 + ty * 1237) | 0;
  const ox = 3 + (Math.abs(seed) % 9);
  const oy = 3 + (Math.abs(seed >> 4) % 9);
  if ((seed & 3) === 0) {
    g.fillStyle = '#c77b3f';
    g.fillRect(X + ox, Y + oy, 3, 1);
    g.fillStyle = '#e8a86a';
    g.fillRect(X + ox + 1, Y + oy + 1, 1, 1);
  } else {
    g.fillStyle = 'rgba(160,107,212,0.45)';
    g.fillRect(X + ox + 1, Y + oy, 1, 3);
    g.fillRect(X + ox, Y + oy + 1, 3, 1);
  }
}

function pixiDrawStaticStairs(g, lvl, pal) {
  if (lvl.exitOpen) {
    const cx = (lvl.exit.tx + 0.5) * TILE, cy = (lvl.exit.ty + 0.5) * TILE, s = 22;
    if (typeof STAIRS_IMG !== 'undefined' && STAIRS_IMG) g.drawImage(STAIRS_IMG, cx - s / 2, cy - s / 2, s, s);
    else {
      const X = lvl.exit.tx * TILE, Y = lvl.exit.ty * TILE;
      g.fillStyle = '#0b0a0f';
      g.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
      g.fillStyle = pal.accent;
      for (let i = 0; i < 4; i++) g.fillRect(X + 2 + i, Y + 3 + i * 3, TILE - 4 - i * 2, 2);
    }
  }
  if (state.run && state.run.depth > 1 && lvl.start) {
    const X = Math.floor(lvl.start.x / TILE) * TILE, Y = Math.floor(lvl.start.y / TILE) * TILE;
    g.fillStyle = '#0b0a0f';
    g.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
    g.globalAlpha = 0.7;
    g.fillStyle = pal.accent;
    for (let i = 0; i < 4; i++) g.fillRect(X + 2 + i, Y + 12 - i * 3, TILE - 4 - i * 2, 2);
    g.globalAlpha = 1;
  }
}

function buildPixiTileCache(lvl, zoneNow, pal) {
  const cv = document.createElement('canvas');
  cv.width = lvl.W * TILE;
  cv.height = lvl.H * TILE;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#0b0a0f';
  g.fillRect(0, 0, cv.width, cv.height);

  const floorSet = Sprites['floor_' + zoneNow.id];
  const wallSet = Sprites['wall_' + zoneNow.id];
  const torches = []; // [worldX, worldY, seed] de las antorchas (luz + llama animada)
  for (let ty = 0; ty < lvl.H; ty++) {
    for (let tx = 0; tx < lvl.W; tx++) {
      const solid = lvl.map[ty][tx] === 0;
      const X = tx * TILE, Y = ty * TILE;
      const hash = (tx * 7 + ty * 13) % 5;
      if (!solid) {
        const floorImg = Array.isArray(floorSet) ? floorSet[pixiTileVariant(tx, ty, floorSet.length)] : floorSet;
        if (floorImg) g.drawImage(floorImg, X, Y, TILE, TILE);
        else {
          g.fillStyle = hash === 0 ? pal.floorAlt : pal.floor;
          g.fillRect(X, Y, TILE, TILE);
        }
        if (hash === 0) {
          g.fillStyle = 'rgba(0,0,0,0.10)';
          g.fillRect(X, Y, TILE, TILE);
        }
        const bigHash = (tx * 11 + ty * 17) % 23;
        if (bigHash === 5) pixiDrawFloorDecal(g, pal, X, Y, tx, ty);
      } else {
        const floorBelow = ty + 1 < lvl.H && lvl.map[ty + 1][tx] === 1;
        const wallImg = Array.isArray(wallSet) ? wallSet[pixiTileVariant(tx + 101, ty + 57, wallSet.length)] : wallSet;
        if (floorBelow && (tx * 73 + ty * 37) % 23 === 0) torches.push([X + TILE / 2, Y, tx * 31 + ty]);
        if (floorBelow && wallImg) {
          g.drawImage(wallImg, X, Y, TILE, TILE);
          g.fillStyle = 'rgba(0,0,0,0.30)';
          g.fillRect(X, Y + TILE - 3, TILE, 3);
        } else {
          g.fillStyle = floorBelow ? pal.wall : '#05040a';
          g.fillRect(X, Y, TILE, TILE);
          if (!floorBelow && ty > 0 && lvl.map[ty - 1][tx] === 1 && wallImg) {
            const capH = 6;
            g.drawImage(wallImg, 0, 0, wallImg.width, wallImg.width * capH / TILE, X, Y + TILE - capH, TILE, capH);
            g.fillStyle = 'rgba(0,0,0,0.30)';
            g.fillRect(X, Y + TILE - capH, TILE, 1);
          }
        }
      }
    }
  }
  pixiDrawStaticStairs(g, lvl, pal);

  const tex = PIXI.Texture.from(cv);
  if (tex.baseTexture) tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
  const sprite = new PIXI.Sprite(tex);
  sprite.roundPixels = true;
  PR.tiles.removeChildren();
  PR.tiles.addChild(sprite);
  PR.tileCache = { lvl, zoneIdx: state.run.zoneIdx, exitOpen: lvl.exitOpen, tex, torches };
}

function drawPixiTiles() {
  const lvl = state.level;
  const pal = ZONES[state.run.zoneIdx].palette;
  const zoneNow = ZONES[state.run.zoneIdx];
  if (!PR.tileCache ||
    PR.tileCache.lvl !== lvl ||
    PR.tileCache.zoneIdx !== state.run.zoneIdx ||
    PR.tileCache.exitOpen !== lvl.exitOpen) {
    if (PR.tileCache && PR.tileCache.tex) PR.tileCache.tex.destroy(true);
    buildPixiTileCache(lvl, zoneNow, pal);
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

// Sombra de contacto suave + DIRECCIONAL: si hay una antorcha cerca, la sombra se
// proyecta en direccion contraria a la luz, estirandose y marcandose cuanto mas
// cerca estes (al pasar al lado de una antorcha, "barre" hacia el lado opuesto).
// Sin antorcha cerca, queda el blob suave centrado bajo los pies.
const SHADOW_LIGHT_R = 58; // alcance de antorcha que proyecta sombra (unidades mundo)
function drawPixiShadow(x, y, w) {
  const tex = PR.lights && PR.lights.lightTex;
  if (!tex) { pixiEllipse(PR.objects, x, y + 5, w, w * 0.35, 0x000000, 0.30); return; }
  const fx = x, fy = y + 5;            // punto de contacto (pies)
  const baseW = w * 3.4, baseH = w * 1.25;

  // antorcha mas cercana
  let blx = 0, bly = 0, bestD2 = Infinity;
  const tc = PR.tileCache;
  if (tc && tc.torches) {
    for (let i = 0; i < tc.torches.length; i++) {
      const lx = tc.torches[i][0], ly = tc.torches[i][1] + 6;
      const dx = fx - lx, dy = fy - ly, d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; blx = lx; bly = ly; }
    }
  }

  if (bestD2 < SHADOW_LIGHT_R * SHADOW_LIGHT_R) {
    const d = Math.sqrt(bestD2) || 0.001;
    const prox = 1 - d / SHADOW_LIGHT_R;       // 0 lejos -> 1 pegado
    const dx = (fx - blx) / d, dy = (fy - bly) / d; // dir luz -> entidad
    const len = baseW * (1 + prox * 1.6);      // se estira hasta ~2.6x
    const off = (len - baseW) * 0.5 + w * 0.5 * prox; // nace en los pies, se aleja
    pixiSpriteFromTexture(PR.objects, tex, fx + dx * off, fy + dy * off, {
      anchor: [0.5, 0.5],
      scale: [len / tex.width, baseH / tex.height],
      rotation: Math.atan2(dy, dx),
      tint: 0x000000,
      alpha: 0.42 + prox * 0.12,
    });
  } else {
    pixiSpriteFromTexture(PR.objects, tex, fx, fy, {
      anchor: [0.5, 0.5],
      scale: [baseW / tex.width, baseH / tex.height],
      tint: 0x000000,
      alpha: 0.42,
    });
  }
}

function drawPixiPlayer(p) {
  drawPixiShadow(p.x, p.y, 5);
  if (drawPixiV2Hero(p)) return;
  const img = pixiPlayerImage(p);
  if (pixiImageReady(img)) pixiSprite(PR.objects, img, p.x - 24, p.y + 5 - 36, 48, 48);
  else pixiCircle(PR.objects, p.x, p.y, 6, 0x7ec8ff, 1);
}

function pixiImageReady(img) {
  if (!img) return false;
  // los frames de cofre/fuego del liche son <canvas> (sin .complete ni naturalWidth)
  if (img.tagName === 'CANVAS') return !!(img.width && img.height);
  return !!(img.complete && (img.naturalWidth || img.width));
}

function pixiV2Face(p) {
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
  return state.descend ? 'north' : (p._pixiFace || 'south');
}

function pixiPlayerImage(p) {
  if (typeof V2H === 'undefined' || !V2H.ready) return null;
  const face = pixiV2Face(p);
  const anim = (p.hurtT || 0) > 0 ? 'hurt' : (p.moving ? 'walk' : 'idle');
  const def = V2H.anims[anim];
  if (!def) return null;
  const fi = Math.floor(state.time * 1000 / def.ms) % def.n;
  return V2H.imgs[`${anim}_${face}_${fi}`] || null;
}

function pixiV2FrameIndex(p, anim, ms, n) {
  if (p._pixiAnim !== anim) { p._pixiAnim = anim; p._pixiT = state.time; }
  return Math.floor((state.time - (p._pixiT || 0)) * 1000 / ms) % n;
}

function pixiV2StaffImage(p, idx) {
  const cfg = V2_STAFF_RIG.staffs[idx];
  let img = V2H.staffRig.staffs[idx];
  if (cfg.anim && p._staffCastStart != null) {
    const elapsedMs = Math.max(0, (state.time - p._staffCastStart) * 1000);
    const frame = Math.floor(elapsedMs / (cfg.animMs || 60));
    const anim = V2H.staffRig.staffAnims[cfg.anim];
    if (anim && frame >= 0 && frame < anim.length) img = anim[frame] || img;
  }
  return img;
}

function pixiDrawV2StaffAtHand(p, idx, hand, ox, oy, S, mirror) {
  if (idx < 0 || !hand) return null;
  const cfg = V2_STAFF_RIG.staffs[idx];
  const img = pixiV2StaffImage(p, idx);
  if (!pixiImageReady(img)) return null;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const x = ox + (mirror ? 120 - hand.x : hand.x) * S;
  const y = oy + hand.y * S;
  const drawScale = (cfg.spx || iw) / iw;
  const rot = (cfg.rot || 0) * Math.PI / 180;
  pixiSpriteRaw(PR.objects, img, x, y, {
    anchor: [cfg.grip.x / iw, cfg.grip.y / ih],
    scale: [mirror ? -S * drawScale : S * drawScale, S * drawScale],
    rotation: mirror ? -rot : rot,
  });

  const fx = ((cfg.focus || cfg.grip).x - cfg.grip.x) * S * drawScale;
  const fy = ((cfg.focus || cfg.grip).y - cfg.grip.y) * S * drawScale;
  const rx = fx * Math.cos(rot) - fy * Math.sin(rot);
  const ry = fx * Math.sin(rot) + fy * Math.cos(rot);
  const focus = { x: x + (mirror ? -rx : rx), y: y + ry };
  p._v2StaffTip = focus;
  return focus;
}

function pixiDrawV2StaffAt(p, idx, face, fi, ox, oy, S, mirror) {
  const hand = V2_STAFF_RIG.handByDir[face] && V2_STAFF_RIG.handByDir[face][fi];
  return pixiDrawV2StaffAtHand(p, idx, hand, ox, oy, S, mirror);
}

function pixiDrawV2HandOverlay(face, fi, ox, oy, S, mirror) {
  const hcfg = V2_STAFF_RIG.handOverlay[face];
  const hand = V2_STAFF_RIG.handByDir[face] && V2_STAFF_RIG.handByDir[face][fi];
  const img = V2H.staffRig.hands[face];
  if (!hcfg || !hand || !pixiImageReady(img)) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sc = hcfg.scale || 1;
  const x = ox + (mirror ? 120 - hand.x : hand.x) * S;
  const y = oy + hand.y * S;
  pixiSpriteRaw(PR.objects, img, x, y, {
    anchor: [hcfg.ax / iw, hcfg.ay / ih],
    scale: [mirror ? -sc * S : sc * S, sc * S],
  });
}

function pixiDrawV2Body(img, ox, oy, S, mirror) {
  if (!pixiImageReady(img)) return false;
  if (mirror) pixiSpriteRaw(PR.objects, img, ox + 120 * S, oy, { scale: [-S, S] });
  else pixiSpriteRaw(PR.objects, img, ox, oy, { scale: [S, S] });
  return true;
}

function drawPixiV2StaffWalk(p, face, staffIdx) {
  const sourceFace = V2_STAFF_MIRROR_FACE[face] || face;
  const mirror = sourceFace !== face;
  if (!V2H.staffRig.ready || !V2_STAFF_RIG.handByDir[sourceFace] || staffIdx < 0) return false;
  if ((mirror || sourceFace === 'north-east' || sourceFace === 'north') && staffIdx !== 8) return false;
  const fi = pixiV2FrameIndex(p, 'walk_staff', V2_STAFF_RIG.ms, V2_STAFF_RIG.n);
  const img = V2H.staffRig.empty[`${sourceFace}_${fi}`];
  if (!pixiImageReady(img)) return false;
  const S = 0.4, footY = p.y + 5, ox = p.x - 60 * S, oy = footY - 90 * S;
  const staffBehind = staffIdx === 8 && (sourceFace === 'north-east' || sourceFace === 'north');
  if (staffBehind) pixiDrawV2StaffAt(p, staffIdx, sourceFace, fi, ox, oy, S, mirror);
  pixiDrawV2Body(img, ox, oy, S, mirror);
  if (!staffBehind) {
    pixiDrawV2StaffAt(p, staffIdx, sourceFace, fi, ox, oy, S, mirror);
    pixiDrawV2HandOverlay(sourceFace, fi, ox, oy, S, mirror);
  }
  return true;
}

function drawPixiV2StaffIdle(p, face, staffIdx) {
  if (!V2H.staffRig.ready || staffIdx !== 8) return false;
  const img = V2H.staffRig.idle[face];
  const hand = V2_STAFF_RIG.idleHandByDir[face];
  if (!pixiImageReady(img) || !hand) return false;
  const S = 0.4, footY = p.y + 5, ox = p.x - 60 * S, oy = footY - 90 * S;
  const staffBehind = face === 'north-east' || face === 'north' || face === 'north-west';
  if (staffBehind) pixiDrawV2StaffAtHand(p, staffIdx, hand, ox, oy, S, false);
  pixiDrawV2Body(img, ox, oy, S, false);
  if (!staffBehind) pixiDrawV2StaffAtHand(p, staffIdx, hand, ox, oy, S, false);
  return true;
}

function drawPixiV2Hero(p) {
  if (typeof V2H === 'undefined' || !V2H.ready) return false;
  const face = pixiV2Face(p);
  let anim = p.moving ? 'walk' : 'idle';
  if ((p.hurtT || 0) > 0) anim = 'hurt';
  const staffIdx = typeof v2EquippedStaffIndex === 'function' ? v2EquippedStaffIndex(p) : -1;
  p._v2StaffTip = null;
  if (anim === 'walk' && drawPixiV2StaffWalk(p, face, staffIdx)) return true;
  if (anim === 'idle' && drawPixiV2StaffIdle(p, face, staffIdx)) return true;

  const def = V2H.anims[anim];
  if (!def) return false;
  const fi = pixiV2FrameIndex(p, anim, def.ms, def.n);
  const img = V2H.imgs[`${anim}_${face}_${fi}`];
  const S = 0.4, footY = p.y + 5;
  if (!pixiImageReady(img)) return false;
  pixiSpriteRaw(PR.objects, img, p.x - 60 * S, footY - 90 * S, { scale: [S, S] });
  return true;
}

function pixiMobSet(e) {
  if (typeof MOB_SETS === 'undefined' || typeof mobSetName !== 'function') return null;
  let set = MOB_SETS[mobSetName(e)];
  if (!set || !set.ready) {
    const fb = set && set.fallbackTo;
    set = fb ? MOB_SETS[fb] : null;
  }
  return set && set.ready ? set : null;
}

function pixiMobFace(e) {
  const dxp = e.x - (e._mx !== undefined ? e._mx : e.x);
  const dyp = e.y - (e._my !== undefined ? e._my : e.y);
  e._mx = e.x; e._my = e.y;
  e._mvx = (e._mvx || 0) * 0.82 + dxp * 0.18;
  e._mvy = (e._mvy || 0) * 0.82 + dyp * 0.18;
  const sp = Math.hypot(e._mvx, e._mvy);
  if (sp > 0.06) e._mface = MOB_OCTANTS[(Math.round(Math.atan2(e._mvy, e._mvx) / (Math.PI / 4)) + 8) % 8];
  return { face: e._mface || 'south', moving: sp > 0.06 };
}

function drawPixiMobFrame(set, anim, face, fi, dx, dy, dw, dh, opt) {
  if (set.source === 'sheet') {
    const img = set.imgs[anim];
    if (!pixiImageReady(img)) return false;
    const row = MOB_ROW[face] != null ? MOB_ROW[face] : 0;
    const tex = pixiFrameTexture(img, fi * 64, row * 64, 64, 64);
    pixiSpriteFromTexture(PR.objects, tex, dx, dy, {
      scale: [dw / 64, dh / 64],
      alpha: opt.alpha,
      tint: opt.tint,
    });
    return true;
  }

  const rf = typeof mobResolveFace === 'function' ? mobResolveFace(set, anim, face) : face;
  let img = set.imgs[`${anim}_${rf}_${fi}`];
  if (!pixiImageReady(img)) {
    const wf = typeof mobResolveFace === 'function' ? mobResolveFace(set, 'walk', face) : face;
    img = set.imgs[`walk_${wf}_0`];
  }
  if (!pixiImageReady(img)) return false;
  pixiSpriteRaw(PR.objects, img, dx, dy, {
    scale: [dw / (img.naturalWidth || img.width), dh / (img.naturalHeight || img.height)],
    alpha: opt.alpha,
    tint: opt.tint,
  });
  return true;
}

function drawPixiMob(e) {
  const set = pixiMobSet(e);
  if (!set) return false;

  const motion = pixiMobFace(e);
  let face = motion.face;
  const attacking = (e.atkAnimT || 0) > 0 && (typeof mobCanAttack !== 'function' || mobCanAttack(set, face));
  if (attacking) {
    face = MOB_OCTANTS[(Math.round(Math.atan2(state.player.y - e.y, state.player.x - e.x) / (Math.PI / 4)) + 8) % 8];
    e._mface = face;
  }

  const anim = attacking ? 'attack' : (motion.moving ? 'walk' : (set.anims.idle ? 'idle' : 'walk'));
  if (e._manim !== anim) { e._manim = anim; e._mt = state.time; }
  const adef = set.anims[anim];
  if (!adef) return false;
  let fi = Math.floor((state.time - (e._mt || 0)) * 1000 / adef.ms);
  if (anim === 'attack') fi = Math.min(fi, adef.n - 1);
  else if (anim === 'idle') fi %= adef.n;
  else fi = motion.moving ? fi % adef.n : 0;

  const bob = set.float ? Math.sin(e.wobble * 1.2) * set.float : 0;
  const S = e.scale * set.draw;
  const dx = e.x - set.px / 2 * S;
  const dy = e.y + 5 - set.foot * S + bob;
  const dw = set.px * S;
  const dh = set.px * S;
  const alpha = set.alpha < 1 ? set.alpha : 1;
  const tint = e.flashT > 0 ? 0xffffff : (e.enraged ? 0xff3030 : 0xffffff);
  return drawPixiMobFrame(set, anim, face, fi, dx, dy, dw, dh, { alpha, tint });
}

function drawPixiEnemy(e) {
  if (!e.def.ghost) drawPixiShadow(e.x, e.y, e.w * e.scale * 0.45);
  if ((e.def.skel || e.def.slime) && drawPixiMob(e)) {
    drawPixiEnemyExtras(e);
    return;
  }
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

function drawPixiEnemyExtras(e) {
  if (e.keyCarrier && Math.floor(state.time * 4) % 2 === 0) {
    pixiRect(PR.objects, e.x - 1, e.y - e.h * e.scale - 7, 2, 2, 0xffd84f, 1);
  }
  if (e.hp < e.maxhp) {
    const w = 12 * e.scale;
    pixiRect(PR.objects, e.x - w / 2, e.y - e.h - 5, w, 2, 0x000000, 0.8);
    pixiRect(PR.objects, e.x - w / 2, e.y - e.h - 5, w * e.hp / e.maxhp, 2, 0xc0392b, 1);
  }
}

function drawPixiChest(ch, gold) {
  drawPixiShadow(ch.x, ch.y, 5);
  const chestSet = typeof CHEST_IMG !== 'undefined' ? CHEST_IMG[gold ? 'gold' : 'common'] : null;
  if (chestSet) {
    let fi = 0;
    if (ch.opened) fi = Math.min(CHEST_FRAMES - 1, Math.floor((state.time - (ch.openT || 0)) * 1000 / CHEST_FRAME_MS));
    const img = chestSet.frames[fi], box = chestSet.boxes[fi];
    if (pixiImageReady(img) && box) {
      pixiSpriteRaw(PR.objects, img, ch.x - box.cx * CHEST_K, ch.y + 1 - box.baseY * CHEST_K, {
        scale: [CHEST_K, CHEST_K],
        tint: gold ? 0xf2e3a3 : 0xebd7bd,
      });
      return;
    }
  }
  const spr = ch.opened ? Sprites.cofre_abierto : (gold ? Sprites.cofre_dorado : Sprites.cofre);
  if (spr) pixiSprite(PR.objects, spr, ch.x, ch.y, spr.width, spr.height, { anchor: [0.5, 0.5] });
  else pixiRect(PR.objects, ch.x - 5, ch.y - 4, 10, 8, gold ? 0xffd84f : 0x8b5a2b);
}

function drawPixiPickup(pk) {
  const bob = -(pk.hz || 0);
  if (pk.kind === 'coin') {
    const cimg = typeof coinPileImg === 'function' ? coinPileImg(pk.val || 1) : null;
    if (pixiImageReady(cimg)) pixiSprite(PR.objects, cimg, pk.x, pk.y + bob, 10, 10, { anchor: [0.5, 0.5] });
    else pixiSprite(PR.objects, Sprites.moneda, pk.x - 3, pk.y - 3 + bob);
  }
  else if (pk.kind === 'heart') pixiSprite(PR.objects, Sprites.corazon, pk.x - 3.5, pk.y - 3 + bob);
  else if (pk.kind === 'potion') pixiSprite(PR.objects, Sprites.pocion, pk.x - 3, pk.y - 4 + bob);
  else if (pk.kind === 'manapotion') {
    pixiCircle(PR.objects, pk.x, pk.y + bob, 6, 0x5aaaff, 0.22);
    pixiRect(PR.objects, pk.x - 2.5, pk.y - 2 + bob, 5, 6, 0x2f7fe6, 1);
    pixiRect(PR.objects, pk.x - 2.5, pk.y + bob, 5, 2, 0x9ad8ff, 1);
    pixiRect(PR.objects, pk.x - 1, pk.y - 4 + bob, 2, 2, 0xd8d2c8, 1);
  }
  else if (pk.kind === 'key') {
    pixiCircle(PR.objects, pk.x, pk.y + bob, 6, 0xffd84f, 0.20);
    pixiSprite(PR.objects, Sprites.llave, pk.x - 4, pk.y - 2 + bob);
  }
  else if (pk.kind === 'xp') {
    const col = (typeof XP_FLAMES !== 'undefined' && pk.xpColor) ? pk.xpColor : 'blue';
    let img = null;
    if (typeof XP_FLAMES !== 'undefined') {
      if (col === 'blue' && XP_FLAMES.blue.length === 9)
        img = XP_FLAMES.blue[(Math.floor(state.time * 1000 / 80) + Math.floor(pk.t * 3)) % 9];
      else img = XP_FLAMES[col];
    }
    if (pixiImageReady(img)) {
      const pulse = col === 'blue' ? 1 : (1 + Math.sin(state.time * 7 + pk.t) * 0.12);
      pixiSprite(PR.objects, img, pk.x, pk.y + 1 + bob, 5, 5 * pulse, { anchor: [0.5, 1] });
    } else pixiCircle(PR.objects, pk.x, pk.y + bob, 2.2, 0xff5a4a, 0.9);
  }
  else if (pk.kind === 'item') {
    pixiCircle(PR.objects, pk.x, pk.y + 2, 7, pcol(rarityOf(pk.item).color), 0.26);
    const simg = typeof staffIconImg === 'function' ? staffIconImg(pk.item) : null;
    if (pixiImageReady(simg)) pixiSprite(PR.objects, simg, pk.x, pk.y - 2 + bob, 18, 18, { anchor: [0.5, 0.5] });
    else {
      const spr = typeof itemIcon === 'function' ? itemIcon(pk.item) : null;
      if (pixiImageReady(spr)) pixiSprite(PR.objects, spr, pk.x, pk.y + bob, spr.width, spr.height, { anchor: [0.5, 0.5] });
    }
  }
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
    } else if (pr.style === 'fire' && typeof LICH_FIRE !== 'undefined' && LICH_FIRE.length) {
      // bola de fuego del liche: sprite animado rotado hacia el angulo de vuelo
      const fr = LICH_FIRE[Math.floor(pr.t * 1000 / 90) % LICH_FIRE.length];
      if (pixiImageReady(fr)) pixiSprite(PR.objects, fr, pr.x, pr.y, 16, 16, { anchor: [0.5, 0.5], rotation: pr.ang, alpha: Math.min(1, pr.life * 4) });
      else pixiCircle(PR.objects, pr.x, pr.y, 4, pcol(pr.color, 0xffffff), Math.min(1, pr.life * 4));
    } else pixiCircle(PR.objects, pr.x, pr.y, pr.style === 'fire' ? 4 : 2.2, pcol(pr.color, 0xffffff), Math.min(1, pr.life * 4));
  }
}

function drawPixiParticles() {
  for (const pa of state.particles) pixiRect(PR.fx, pa.x - 1, pa.y - 1, 2, 2, pcol(pa.color), Math.min(1, pa.t * 3));
}

// ---------------------------------------------------------------------
// Iluminacion Pixi-nativa. No copia los gradientes del canvas pixel a
// pixel: busca un dungeon oscuro pero legible. Arquitectura por capas:
//   mundo (PR.world)  ->  PR.lights.lighting = [darkness, lights(ADD), vignette]
// Una sola textura radial reusable, tinteada/escalada por luz. El flicker
// es por alpha/scale (no se regeneran texturas por frame). El HUD es DOM,
// queda fuera de este sistema.
// ---------------------------------------------------------------------

// Llama animada de las antorchas en el mundo (arte sobre la pared).
function drawPixiTorches() {
  const tc = PR.tileCache;
  if (!tc || !tc.torches) return;
  const cam = state.cam, vw = PR.app.renderer.width / ZOOM, vh = PR.app.renderer.height / ZOOM, t = state.time;
  for (const [tX, tY, seed] of tc.torches) {
    if (tX < cam.x - 24 || tX > cam.x + vw + 24 || tY < cam.y - 24 || tY > cam.y + vh + 24) continue;
    if (typeof TORCH_IMG !== 'undefined' && TORCH_IMG && TORCH_IMG.width) {
      const fr = Math.floor(t * 10 + seed) % 8;
      const tex = pixiFrameTexture(TORCH_IMG, (fr % 4) * 64, (fr < 4 ? 0 : 1) * 64, 64, 64);
      pixiSpriteFromTexture(PR.torches, tex, tX - 9, tY - 2, { scale: [18 / 64, 18 / 64] });
    } else {
      pixiRect(PR.torches, tX - 1, tY + 7, 2, 4, 0x6b4a2b, 1);
      const fl = Math.floor(t * 9 + seed) % 3;
      pixiRect(PR.torches, tX - 1, tY + 4 + (fl === 1 ? 1 : 0), 2, 3, fl === 0 ? 0xffb13f : fl === 1 ? 0xff7b2f : 0xffd84f, 1);
    }
  }
}

function makeRadialTex(stops, size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return PIXI.Texture.from(c);
}

function makeVignetteTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = Math.max(w, h) * 0.72;
  const grd = g.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(3,2,6,0.55)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  return PIXI.Texture.from(c);
}

// Construye la capa de luz. El orden en el stage (init) la deja ENTRE el piso y
// las entidades: la luz cae sobre el piso y los personajes van encima a brillo
// normal ("caminan sobre la luz", sin aura pintada sobre el sprite).
function buildLighting() {
  const lightTex = makeRadialTex([
    [0, 'rgba(255,255,255,0.95)'],
    [0.25, 'rgba(255,255,255,0.55)'],
    [0.55, 'rgba(255,255,255,0.22)'],
    [0.8, 'rgba(255,255,255,0.06)'],
    [1, 'rgba(255,255,255,0)'],
  ], 128);
  const lighting = new PIXI.Container();
  const darkness = new PIXI.Sprite(PIXI.Texture.WHITE);
  darkness.tint = 0x07060d;
  const lightsLayer = new PIXI.Container();
  const vignette = new PIXI.Sprite(PIXI.Texture.EMPTY);
  lighting.addChild(darkness, lightsLayer, vignette);
  return { lightTex, lighting, darkness, lightsLayer, vignette, pool: [], poolUsed: 0, vigW: 0, vigH: 0 };
}

function pixiLight(L, x, y, radius, tint, alpha) {
  let s = L.pool[L.poolUsed++];
  if (!s) {
    s = new PIXI.Sprite(L.lightTex);
    s.anchor.set(0.5);
    s.blendMode = PIXI.BLEND_MODES.ADD;
    L.lightsLayer.addChild(s);
    L.pool.push(s);
  }
  s.visible = true;
  s.position.set(x, y);
  s.scale.set((radius * 2) / L.lightTex.width);
  s.tint = tint;
  s.alpha = alpha;
}

function drawPixiLighting() {
  const L = PR.lights;
  if (!L) return;
  const W = PR.app.renderer.width, H = PR.app.renderer.height;
  const p = state.player, lvl = state.level, cam = state.cam, t = state.time;
  const oscuro = lvl.evento === 'oscuro';

  // oscuridad ambiente: dungeon oscuro pero legible (mas en pisos 'oscuro')
  L.darkness.width = W; L.darkness.height = H;
  L.darkness.alpha = oscuro ? 0.84 : 0.52;

  // vinneta: se regenera solo si cambio el tamanno (no por frame)
  if (L.vigW !== W || L.vigH !== H) {
    if (L.vignette.texture && L.vignette.texture !== PIXI.Texture.EMPTY) L.vignette.texture.destroy(true);
    L.vignette.texture = makeVignetteTex(W, H);
    L.vigW = W; L.vigH = H;
  }
  L.vignette.alpha = 1;

  L.poolUsed = 0;
  const px = (wx) => (wx - cam.x) * ZOOM, py = (wy) => (wy - cam.y) * ZOOM;

  // antorchas: luz calida con flicker sutil (alpha + scale, sin regenerar)
  const tc = PR.tileCache;
  if (tc && tc.torches) for (const [tX, tY, seed] of tc.torches) {
    const sx = px(tX), sy = py(tY + 6), rad = 50 * ZOOM;
    if (sx < -rad || sx > W + rad || sy < -rad || sy > H + rad) continue;
    const flick = 0.82 + Math.sin(t * 7 + seed) * 0.12 + Math.sin(t * 17 + seed * 1.7) * 0.05;
    pixiLight(L, sx, sy, rad * (0.95 + Math.sin(t * 5 + seed) * 0.05), 0xff9a3c, 0.55 * flick);
  }

  // luz del jugador: suave, no quema el centro
  pixiLight(L, px(p.x), py(p.y), 72 * ZOOM, 0xffd6a0, 0.34);

  // auras magicas (orbes del jugador)
  for (const pr of state.projs) {
    if (pr.dead || pr.style !== 'bolt') continue;
    pixiLight(L, px(pr.x), py(pr.y), 46 * ZOOM, 0x88b4ff, 0.42);
  }

  // ocultar sprites de luz sobrantes del pool
  for (let i = L.poolUsed; i < L.pool.length; i++) L.pool[i].visible = false;
}
