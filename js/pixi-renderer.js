// =====================================================================
// pixi-renderer.js - renderer WebGL experimental (?pixi).
// Mantiene la logica del juego en main/entities y cambia solo el dibujo.
// =====================================================================

let PR = null;

async function initPixiRenderer(view) {
  if (typeof PIXI === 'undefined') throw new Error('PIXI no esta cargado');
  const app = new PIXI.Application();
  await app.init({
    canvas: view,
    width: view.width,
    height: view.height,
    backgroundColor: 0x0b0a0f,
    antialias: false,
    autoDensity: false,
    resolution: 1,
    preference: 'webgl', // GLSL only: el filtro de oclusion usa shaders WebGL (no WGSL)
  });
  app.ticker.stop();
  view.style.imageRendering = 'pixelated';

  PR = {
    app,
    world: new PIXI.Container(),
    tiles: new PIXI.Container(),
    torches: new PIXI.Container(),
    entities: new PIXI.Container(), // objetos + fx, ENCIMA de la luz (brillo normal)
    wallTops: new PIXI.Container(),  // tiles-tope negros, re-pintados sobre la luz (sin bleed)
    shadows: new PIXI.Container(),  // blob + silueta, con blur, debajo de las entidades
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
  // capa de sombras con blur: difumina los bordes del blob de contacto y de la
  // silueta proyectada de una sola pasada. Va debajo de los sprites de entidad.
  const shadowBlur = new PIXI.BlurFilter({ strength: 2.5, quality: 2 });
  shadowBlur.padding = 12;
  PR.shadows.filters = [shadowBlur];
  PR.entities.addChild(PR.wallTops, PR.shadows, PR.objects, PR.fx);
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
  PR.silUsed = 0;
  PR.objects.removeChildren();
  PR.shadows.removeChildren();
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
  drawPixiFx();
  drawPixiLighting();
  PR.app.renderer.render(PR.app.stage);
  return true;
}

function pixiTexture(img) {
  if (!img || (!img.width && !img.naturalWidth)) return null;
  let tex = PR.tex.get(img);
  if (!tex) {
    tex = PIXI.Texture.from(img);
    if (tex.source) tex.source.scaleMode = 'nearest';
    PR.tex.set(img, tex);
  }
  return tex;
}

function pixiFrameTexture(img, sx, sy, sw, sh) {
  const base = pixiTexture(img);
  if (!base || !base.source) return null;
  let byImage = PR.frameTex.get(img);
  if (!byImage) {
    byImage = new Map();
    PR.frameTex.set(img, byImage);
  }
  const key = sx + ',' + sy + ',' + sw + ',' + sh;
  let tex = byImage.get(key);
  if (!tex) {
    tex = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(sx, sy, sw, sh) });
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
    s.blendMode = 'normal';
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
    s.blendMode = 'normal';
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
    g.blendMode = 'normal';
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
  g.rect(x, y, w, h).fill({ color: pcol(color), alpha: alpha == null ? 1 : alpha });
}

function pixiCircle(parent, x, y, r, color, alpha) {
  const g = pixiGraphics(parent);
  g.circle(x, y, r).fill({ color: pcol(color), alpha: alpha == null ? 1 : alpha });
}

function pixiEllipse(parent, x, y, rx, ry, color, alpha) {
  const g = pixiGraphics(parent);
  g.ellipse(x, y, rx, ry).fill({ color: pcol(color), alpha: alpha == null ? 1 : alpha });
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
  const tops = [];    // [X,Y] de los tiles-tope negros (solid sin piso debajo)
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
        // AO de esquinas: el muro proyecta penumbra sobre el piso que lo bordea.
        // Arriba pega mas fuerte (el muro "se cierne"); costados suaves. Donde se
        // solapan top+costado nace la esquina oscura sola.
        const aoT = ty > 0 && lvl.map[ty - 1][tx] === 0;
        const aoL = tx > 0 && lvl.map[ty][tx - 1] === 0;
        const aoR = tx < lvl.W - 1 && lvl.map[ty][tx + 1] === 0;
        const AO = 7; // px de penumbra
        if (aoT) { const gr = g.createLinearGradient(0, Y, 0, Y + AO); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X, Y, TILE, AO); }
        if (aoL) { const gr = g.createLinearGradient(X, 0, X + AO, 0); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X, Y, AO, TILE); }
        if (aoR) { const gr = g.createLinearGradient(X + TILE, 0, X + TILE - AO, 0); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X + TILE - AO, Y, AO, TILE); }
      } else {
        const floorBelow = ty + 1 < lvl.H && lvl.map[ty + 1][tx] === 1;
        const wallImg = Array.isArray(wallSet) ? wallSet[pixiTileVariant(tx + 101, ty + 57, wallSet.length)] : wallSet;
        if (floorBelow && (tx * 73 + ty * 37) % 23 === 0) torches.push([X + TILE / 2, Y, tx * 31 + ty]);
        // tope: la luz no debe treparse al techo. hasCap = este tope corona una cara
        // de muro (lleva remate de ladrillo abajo) -> ese remate NO se re-pinta, asi
        // se ilumina junto a la cara y no queda mas brillante que ella.
        if (!floorBelow) {
          const hasCap = ty + 2 < lvl.H && lvl.map[ty + 1][tx] === 0 && lvl.map[ty + 2][tx] === 1;
          tops.push([X, Y, hasCap]);
        }
        if (floorBelow && wallImg) {
          g.drawImage(wallImg, X, Y, TILE, TILE);
          g.fillStyle = 'rgba(0,0,0,0.30)';
          g.fillRect(X, Y + TILE - 3, TILE, 3);
        } else {
          if (floorBelow) {
            g.fillStyle = pal.wall;
            g.fillRect(X, Y, TILE, TILE);
          } else {
            // tile de techo (roca maciza, no transitable): piedra en sombra en vez de
            // negro plano. base wallDark de la zona + textura tenue del muro + oscurecido
            // fuerte, con leve variacion por celda -> material y volumen, no un agujero.
            g.fillStyle = pal.wallDark || '#15131c';
            g.fillRect(X, Y, TILE, TILE);
            if (wallImg) { g.globalAlpha = 0.30; g.drawImage(wallImg, X, Y, TILE, TILE); g.globalAlpha = 1; }
            g.fillStyle = (hash === 0) ? 'rgba(5,4,10,0.70)' : 'rgba(5,4,10,0.64)'; // CEIL_DARK: subir = mas oscuro
            g.fillRect(X, Y, TILE, TILE);
          }
          // remate: si JUSTO DEBAJO hay una cara de muro (tile inferior solido con
          // piso un tile mas abajo), coronar este tope negro con una fila de ladrillo
          // en su borde inferior -> el muro "sobresale" y recupera su grosor.
          const belowFace = ty + 2 < lvl.H && lvl.map[ty + 1][tx] === 0 && lvl.map[ty + 2][tx] === 1;
          if (belowFace && wallImg) {
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
  if (tex.source) tex.source.scaleMode = 'nearest';
  const sprite = new PIXI.Sprite(tex);
  sprite.roundPixels = true;
  PR.tiles.removeChildren();
  PR.tiles.addChild(sprite);

  // capa de tiles-tope: copia EXACTA (sin luz) de los topes negros, para re-pintarlos
  // sobre la iluminacion y que la luz propia no se trepe a la pared de arriba.
  const topCv = document.createElement('canvas');
  topCv.width = cv.width; topCv.height = cv.height;
  const tg = topCv.getContext('2d');
  tg.imageSmoothingEnabled = false;
  for (let i = 0; i < tops.length; i++) {
    // si el tope lleva remate, copiar solo la parte superior (TILE - 6) y dejar el
    // remate fuera de la re-pintura -> se ilumina con la cara del muro (consistente).
    const h = tops[i][2] ? TILE - 6 : TILE;
    tg.drawImage(cv, tops[i][0], tops[i][1], TILE, h, tops[i][0], tops[i][1], TILE, h);
  }
  const topTex = PIXI.Texture.from(topCv);
  if (topTex.source) topTex.source.scaleMode = 'nearest';
  const topSprite = new PIXI.Sprite(topTex);
  topSprite.roundPixels = true;
  PR.wallTops.removeChildren();
  PR.wallTops.addChild(topSprite);

  // mascara de muros: 1 texel por tile, blanco=muro (solid) / transparente=piso.
  // La sampleara el shader de oclusion para raymarchear hacia cada luz.
  const maskCv = document.createElement('canvas');
  maskCv.width = lvl.W; maskCv.height = lvl.H;
  const mg = maskCv.getContext('2d');
  const id = mg.createImageData(lvl.W, lvl.H);
  for (let ty = 0; ty < lvl.H; ty++) {
    for (let tx = 0; tx < lvl.W; tx++) {
      const v = lvl.map[ty][tx] === 0 ? 255 : 0; // 0 = muro -> blanco
      const i = (ty * lvl.W + tx) * 4;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = id.data[i + 3] = v;
    }
  }
  mg.putImageData(id, 0, 0);
  const wallMaskTex = PIXI.Texture.from(maskCv);
  if (wallMaskTex.source) wallMaskTex.source.scaleMode = 'nearest';

  PR.tileCache = { lvl, zoneIdx: state.run.zoneIdx, exitOpen: lvl.exitOpen, tex, torches, topTex, wallMaskTex };
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
    if (PR.tileCache && PR.tileCache.topTex) PR.tileCache.topTex.destroy(true);
    if (PR.tileCache && PR.tileCache.wallMaskTex) PR.tileCache.wallMaskTex.destroy(true);
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
  const extra = [];
  if (lvl.merchant) extra.push({ y: lvl.merchant.y, _merchant: lvl.merchant });
  const drawables = [...state.enemies, p, ...chestDraws, ...extra].sort((a, b) => a.y - b.y);
  for (const e of drawables) {
    if (e._merchant) drawPixiMerchant(e._merchant);
    else if (e._chest) drawPixiChest(e._chest, e._gold);
    else if (e === p) drawPixiPlayer(p);
    else drawPixiEnemy(e);
  }
}

// Mercader: NPC junto a la escalera. Iba perdido en Pixi (solo se dibujaba en canvas).
function drawPixiMerchant(m) {
  const bob = Math.sin(state.time * 2.5) * 1.2;
  drawPixiShadow(m.x, m.y + 1, 5.5, 1);
  // aura cálida tenue por debajo del sprite (mismo orden que el canvas)
  const tex = PR.lights && PR.lights.lightTex;
  if (tex) { const s = pixiSpriteFromTexture(PR.objects, tex, m.x, m.y + bob, { anchor: [0.5, 0.5], scale: [28 / tex.width, 28 / tex.height], tint: 0xffd84f, alpha: 0.12 }); if (s) s.blendMode = 'add'; }
  const spr = Sprites.mercader;
  if (pixiImageReady(spr)) { const k = spr.ws || 1; pixiSprite(PR.objects, spr, m.x, m.y + bob - 2, spr.width * k, spr.height * k, { anchor: [0.5, 0.5] }); }
  else pixiCircle(PR.objects, m.x, m.y + bob - 2, 6, 0xc7b8e8, 1);
}

// Sombra de contacto suave + DIRECCIONAL: si hay una antorcha cerca, la sombra se
// proyecta en direccion contraria a la luz, estirandose y marcandose cuanto mas
// cerca estes (al pasar al lado de una antorcha, "barre" hacia el lado opuesto).
// Sin antorcha cerca, queda el blob suave centrado bajo los pies.
const SHADOW_LIGHT_R = 78; // alcance de antorcha que proyecta sombra (mas grande = fade mas gradual)
// Circulo de contacto: elipse negra oscura justo bajo los pies (ancla, y es lo
// "mas oscuro cerca de los pies"). Va en PR.shadows (blureado).
function pixiContactBlob(x, y, w, opt) {
  opt = opt || {};
  const a = opt.alpha != null ? opt.alpha : 0.55;
  const wide = opt.wide || 2.6, tall = opt.tall || 1.0;
  const tex = PR.lights && PR.lights.lightTex;
  if (!tex) { pixiEllipse(PR.shadows, x, y, w * wide * 0.5, w * tall * 0.5, 0x000000, a * 0.75); return; }
  pixiSpriteFromTexture(PR.shadows, tex, x, y, {
    anchor: [0.5, 0.5],
    scale: [(w * wide) / tex.width, (w * tall) / tex.height],
    rotation: opt.rotation || 0,
    tint: 0x000000,
    alpha: a,
  });
}

// Sombra para entidades sin silueta propia (mobs, cofres): circulo de contacto +
// un blob suave que se estira en direccion contraria a la antorcha (con fade).
function drawPixiShadow(x, y, w, footDy) {
  // footDy = cuanto baja la sombra desde y hasta los "pies". Jugador/mobs tienen
  // y al centro (pies en y+5); el cofre tiene y ya en su base (footDy ~1).
  const fy = y + (footDy == null ? 5 : footDy);
  pixiContactBlob(x, fy, w);
  const tex = PR.lights && PR.lights.lightTex;
  if (!tex) return;
  const light = nearestTorchShadow(x, fy);
  if (!light) return;
  const baseW = w * 3.0, baseH = w * 1.1;
  const len = baseW * (1 + light.prox * 1.6);
  const off = (len - baseW) * 0.5 + w * 0.5 * light.prox;
  pixiSpriteFromTexture(PR.shadows, tex, x + light.dx * off, fy + light.dy * off, {
    anchor: [0.5, 0.5],
    scale: [len / tex.width, baseH / tex.height],
    rotation: Math.atan2(light.dy, light.dx),
    tint: 0x000000,
    alpha: 0.5 * light.prox * (light.power || 1),
  });
}

// Antorcha mas cercana al punto (fx,fy) que proyecta sombra. Devuelve direccion
// luz->entidad normalizada y proximidad (0 lejos -> 1 pegado), o null si no hay.
function nearestTorchShadow(fx, fy) {
  const tc = PR.tileCache;
  if (!tc || !tc.torches) return null;
  let blx = 0, bly = 0, bestD2 = Infinity, bestSeed = 0;
  for (let i = 0; i < tc.torches.length; i++) {
    const lx = tc.torches[i][0], ly = tc.torches[i][1] + 6;
    const dx = fx - lx, dy = fy - ly, d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; blx = lx; bly = ly; bestSeed = tc.torches[i][2]; }
  }
  if (bestD2 >= SHADOW_LIGHT_R * SHADOW_LIGHT_R) return null;
  const d = Math.sqrt(bestD2) || 0.001;
  // potencia = mismo flicker que la luz de esa antorcha (drawPixiLighting): la
  // sombra "respira" con la llama -> mas fuerte la luz, mas fuerte la sombra.
  const t = state.time;
  const power = 0.82 + Math.sin(t * 7 + bestSeed) * 0.12 + Math.sin(t * 17 + bestSeed * 1.7) * 0.05;
  return { dx: (fx - blx) / d, dy: (fy - bly) / d, prox: 1 - d / SHADOW_LIGHT_R, power };
}

// Silueta del PNG: redibuja la imagen del personaje en negro, anclada en los pies,
// rotada para "acostarse" en direccion contraria a la luz y estirada a lo largo.
// MANTIENE la forma reconocible del personaje (sin deformar). El fade (alpha por
// proximidad) y el circulo de contacto completan el efecto.
function drawPixiSilhouette(img, footX, footY, S, light) {
  const tex = pixiTexture(img);
  if (!tex) return;
  const w = img.naturalWidth || 120, h = img.naturalHeight || 120;
  const lenMul = 0.9 + light.prox * 1.2; // se estira a lo largo al acercarse a la luz
  pixiSpriteFromTexture(PR.shadows, tex, footX, footY, {
    anchor: [60 / w, 90 / h],            // pie del rig V2 = (60,90)
    scale: [S * 0.95, S * lenMul],
    rotation: Math.atan2(light.dx, -light.dy), // la cabeza apunta lejos de la luz
    tint: 0x000000,
    alpha: light.prox * 0.6 * (light.power || 1), // nace en 0 en el borde -> sin pop; respira con la llama
  });
}

function drawPixiPlayer(p) {
  const fy = p.y + 5;
  const light = nearestTorchShadow(p.x, fy);
  // sombra de contacto del jugador: mas grande y fuerte que la de mobs. Con una
  // antorcha cerca, se estira hacia el lado opuesto a la luz para FUNDIRSE con la
  // silueta proyectada -> una sola sombra coherente, no dos manchas separadas.
  if (light) {
    pixiContactBlob(p.x, fy, 6, {
      alpha: (0.52 + 0.16 * light.prox) * (light.power || 1),
      wide: 2.7 + 1.5 * light.prox,
      tall: 1.15,
      rotation: Math.atan2(light.dy, light.dx),
    });
  } else {
    pixiContactBlob(p.x, fy, 6, { alpha: 0.6, wide: 2.7, tall: 1.2 });
  }
  const body = (typeof V2H !== 'undefined' && V2H.ready) ? pixiPlayerImage(p) : null;
  if (light && pixiImageReady(body)) drawPixiSilhouette(body, p.x, fy, 0.4, light); // silueta del PNG
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

// Jefe animado por sheets (bucle/golem/liche): elige anim por estado y dibuja el
// frame anclado por los pies. Equivalente al camino canvas de drawEnemy.
function drawPixiBoss(e) {
  e._moved = Math.hypot(e.x - (e._lx !== undefined ? e._lx : e.x), e.y - (e._ly !== undefined ? e._ly : e.y)) > 0.05;
  e._lx = e.x; e._ly = e.y;
  let name = 'idle';
  if (e.kickStart && (state.time - e.kickStart) * 1000 < 670) name = 'kick';
  else if (e.telegraphT > 0) name = 'tackle_charge';
  else if (e.charging) name = 'tackle';
  else if (e._moved) name = 'run';
  if (e._animName !== name) { e._animName = name; e._animStart = state.time; }
  const adef = (typeof BOSS_ANIMS !== 'undefined') ? BOSS_ANIMS[name] : null;
  if (!adef) return false;
  const fi = (typeof animFrame === 'function') ? animFrame(adef, (state.time - e._animStart) * 1000) : 0;
  const frames = Sprites['anim_' + e.def.anims + (e.dir < 0 ? '_' + name + '_L' : '_' + name)];
  const fspr = frames && frames[fi];
  if (!pixiImageReady(fspr)) return false;
  const k2 = fspr.ws || 1;
  const ox2 = (e.telegraphT > 0) ? (Math.random() - 0.5) * 2 : 0;
  const sq2 = e.flashT > 0 ? 0.12 : 0;
  const S = e.scale * k2;
  const tint = e.flashT > 0 ? 0xffffff : (e.enraged ? 0xff3030 : 0xffffff);
  // pivote bottom-center: los pies tocan el piso en e.y+6 (igual que el canvas)
  pixiSpriteRaw(PR.objects, fspr, e.x + ox2, e.y + 6, {
    anchor: [0.5, 1],
    scale: [S * (1 + sq2), S * (1 - sq2)],
    tint,
  });
  return true;
}

function drawPixiEnemy(e) {
  if (!e.def.ghost) drawPixiShadow(e.x, e.y, e.w * e.scale * 0.45);
  if ((e.def.skel || e.def.slime) && drawPixiMob(e)) {
    drawPixiEnemyExtras(e);
    return;
  }
  // jefes con pack de animaciones (sheets): idle/run/tackle/kick segun estado
  if (e.def.anims && Sprites['anim_' + e.def.anims + '_idle'] && drawPixiBoss(e)) {
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
  drawPixiShadow(ch.x, ch.y, 6, 1); // footDy=1: el y del cofre ya es su base, sombra pegada
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
  // sombra de contacto en el piso (mismo motor que mobs/cofres). Queda fija en el
  // suelo aunque el item flote con el bob, y achica un toque al elevarse.
  const sw = pk.kind === 'item' ? 5 : 3;
  pixiContactBlob(pk.x, pk.y + 2, sw * (1 + bob * 0.03));
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
    // ry = posicion VISUAL = piso (pr.y) menos altura z. La colision usa pr.y (piso).
    const ry = pr.y - (pr.z || 0);
    if (pr.style === 'bolt' && typeof V2H !== 'undefined' && V2H.ready && V2H.fx.power.length) {
      // sombra de contacto en el piso: mas chica y tenue cuanto mas alto va el orbe
      if (pr.z) pixiContactBlob(pr.x, pr.y, 3.2 / (1 + pr.z * 0.015), { alpha: 0.34 / (1 + pr.z * 0.02) });
      const img = V2H.fx.power[Math.floor(pr.t * 1000 / 90) % V2H.fx.power.length];
      pixiSprite(PR.objects, img, pr.x, ry, 24, 24, { anchor: [0.5, 0.5], rotation: pr.ang, alpha: Math.min(1, pr.life * 3.5) });
    } else if (pr.style === 'fire' && typeof LICH_FIRE !== 'undefined' && LICH_FIRE.length) {
      // bola de fuego del liche: sprite animado rotado hacia el angulo de vuelo
      const fr = LICH_FIRE[Math.floor(pr.t * 1000 / 90) % LICH_FIRE.length];
      if (pixiImageReady(fr)) pixiSprite(PR.objects, fr, pr.x, ry, 16, 16, { anchor: [0.5, 0.5], rotation: pr.ang, alpha: Math.min(1, pr.life * 4) });
      else pixiCircle(PR.objects, pr.x, ry, 4, pcol(pr.color, 0xffffff), Math.min(1, pr.life * 4));
    } else pixiCircle(PR.objects, pr.x, ry, pr.style === 'fire' ? 4 : 2.2, pcol(pr.color, 0xffffff), Math.min(1, pr.life * 4));
  }
}

function drawPixiParticles() {
  for (const pa of state.particles) pixiRect(PR.fx, pa.x - 1, pa.y - 1, 2, 2, pcol(pa.color), Math.min(1, pa.t * 3));
}

// Efectos one-shot (state.fx): explosion del orbe (v2boom), ondas expansivas y
// destellos. Iban perdidos en Pixi (solo se dibujaban en canvas). Van en PR.fx,
// por encima de la luz, con blend aditivo para que brillen sobre la oscuridad.
function drawPixiFx() {
  if (!state.fx) return;
  for (const f of state.fx) {
    // cadaver del jefe derrotado (sprite normal, en PR.objects) + su pelota
    if (f.type === 'corpse' && typeof BOSS_ANIMS !== 'undefined' && typeof animFrame === 'function') {
      const frames = Sprites['anim_' + f.anims + (f.dir < 0 ? '_defeat_L' : '_defeat')];
      const elapsed = (state.time - f.start) * 1000;
      const fspr = frames && frames[animFrame(BOSS_ANIMS.defeat, elapsed)];
      if (pixiImageReady(fspr)) {
        const kc = fspr.ws || 1;
        pixiSpriteRaw(PR.objects, fspr, f.x, f.y + 6, { anchor: [0.5, 1], scale: [f.scale * kc, f.scale * kc], alpha: Math.min(1, f.t / 0.8) });
      }
      if (elapsed > 280 && Sprites.anim_pelota && pixiImageReady(Sprites.anim_pelota[0]))
        pixiSprite(PR.objects, Sprites.anim_pelota[0], f.x - f.dir * 14, f.y + 5, 8, 8, { anchor: [0.5, 0.5] });
      continue;
    }
    // polvo del tackle (sprite normal)
    if (f.type === 'dust' && Sprites.anim_dust) {
      const fi = Math.min(3, Math.floor((state.time - f.start) * 1000 / 70));
      if (pixiImageReady(Sprites.anim_dust[fi])) pixiSprite(PR.objects, Sprites.anim_dust[fi], f.x, f.y - 4, 8, 8, { anchor: [0.5, 0.5] });
      continue;
    }
    if (f.type === 'v2boom' && typeof V2H !== 'undefined' && V2H.ready && V2H.fx && V2H.fx.boom && V2H.fx.boom.length) {
      const bi = Math.min(V2H.fx.boom.length - 1, Math.floor((state.time - f.start) * 1000 / 60));
      const img = V2H.fx.boom[bi];
      if (pixiImageReady(img)) { const S = 0.6; const s = pixiSprite(PR.fx, img, f.x, f.y, 40 * S, 40 * S, { anchor: [0.5, 0.5] }); if (s) s.blendMode = 'add'; }
    } else if (f.type === 'ring') {
      const k = 1 - f.t / f.t0, ease = 1 - (1 - k) * (1 - k);
      const g = pixiGraphics(PR.fx);
      g.blendMode = 'add';
      g.circle(f.x, f.y, Math.max(0.1, f.maxR * ease)).stroke({ color: pcol(f.color), width: 0.5 + 2 * (f.t / f.t0), alpha: f.t / f.t0 });
    } else if (f.type === 'flash') {
      const tex = PR.lights && PR.lights.lightTex;
      if (tex) { const s = pixiSpriteFromTexture(PR.fx, tex, f.x, f.y, { anchor: [0.5, 0.5], scale: [(f.r * 2) / tex.width, (f.r * 2) / tex.height], alpha: (f.t / f.t0) * 0.85 }); if (s) s.blendMode = 'add'; }
    }
  }
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
      pixiSpriteFromTexture(PR.torches, tex, tX - 7, tY - 1, { scale: [14 / 64, 14 / 64] });
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
  // la sombra ambiente crece con la distancia al centro (= jugador) pero TOPEA:
  // burbuja clara cerca -> media mas tenue -> lejos oscuro pero aun legible (0.62).
  const r = Math.max(w, h) * 0.78;
  const grd = g.createRadialGradient(w / 2, h / 2, r * 0.34, w / 2, h / 2, r);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.62, 'rgba(3,2,6,0.26)');
  grd.addColorStop(1, 'rgba(3,2,6,0.62)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  return PIXI.Texture.from(c);
}

// Textura de cono para la sombra proyectada: negra OPACA en la base (los pies) y
// transparente + ancha en la punta. Da el efecto "mas oscura cerca de los pies" y
// la forma conica que se ensancha al alejarse.
function makeShadowConeTex(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, size, 0, 0); // base abajo -> punta arriba
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  const cx = size / 2, baseHalf = size * 0.10, tipHalf = size * 0.46;
  g.beginPath();
  g.moveTo(cx - baseHalf, size); g.lineTo(cx + baseHalf, size);
  g.lineTo(cx + tipHalf, 0); g.lineTo(cx - tipHalf, 0);
  g.closePath(); g.fill();
  return PIXI.Texture.from(c);
}

// ---------------------------------------------------------------------
// Oclusion de luz por raymarch (fase 2). Filtro custom WebGL aplicado a cada sprite
// de luz: por cada pixel marcha un rayo hacia el centro de la luz a traves de la
// mascara de muros (1 texel por tile, blanco=muro). Si choca pared antes de llegar,
// el pixel queda a oscuras -> la luz no cruza paredes ni esquinas.
// El sprite de luz cubre en pantalla [centro - R, centro + R], que en mundo es
// [Lw - Rw, Lw + Rw]; por eso pixWorld = Lw + (uv - 0.5) * 2 * Rw.
// ---------------------------------------------------------------------
const OCCLUSION_VERT = `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vSpriteUV; // 0..1 sobre el sprite de luz (robusto al redondeo de textura del filtro)
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vSpriteUV = aPosition;
}
`;
const OCCLUSION_FRAG = `#version 300 es
in vec2 vTextureCoord;
in vec2 vSpriteUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uWallMask;
uniform vec2 uLightWorld;
uniform vec2 uLevelPx;
uniform float uWorldRadius;
uniform float uNearMargin; // no ocluir a menos de esto de la luz (evita auto-sombra de antorchas en su muro)
uniform float uPen;        // tamano de penumbra en px-mundo (jitter del objetivo)
const int STEPS = 24;
const int RAYS = 4;
// 1.0 si el rayo de 'from' a 'to' llega sin pegar muro; 0.0 si lo bloquea.
float rayClear(vec2 from, vec2 to) {
  vec2 sv = (to - from) / float(STEPS);
  vec2 q = from;
  for (int i = 0; i < STEPS; i++) {
    q += sv;
    if (distance(q, to) < uNearMargin) break;
    if (texture(uWallMask, q / uLevelPx).r > 0.5) return 0.0;
  }
  return 1.0;
}
void main(void) {
  vec4 src = texture(uTexture, vTextureCoord);
  // posicion mundo de este pixel: el sprite cubre [centro-R, centro+R] en mundo.
  // vSpriteUV (0..1 sobre el sprite) evita el offset por redondeo de textura del filtro.
  vec2 pixWorld = uLightWorld + (vSpriteUV - 0.5) * 2.0 * uWorldRadius;
  // penumbra: promediar oclusion hacia 4 puntos alrededor del centro de la luz
  vec2 offs[4] = vec2[4](vec2(uPen, 0.0), vec2(-uPen, 0.0), vec2(0.0, uPen), vec2(0.0, -uPen));
  float acc = 0.0;
  for (int r = 0; r < RAYS; r++) acc += rayClear(pixWorld, uLightWorld + offs[r]);
  finalColor = src * (acc / float(RAYS));
}
`;
function makeOcclusionFilter() {
  const f = new PIXI.Filter({
    glProgram: PIXI.GlProgram.from({ vertex: OCCLUSION_VERT, fragment: OCCLUSION_FRAG, name: 'light-occlusion' }),
    resources: {
      occlusionUniforms: {
        uLightWorld: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
        uLevelPx: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
        uWorldRadius: { value: 1, type: 'f32' },
        uNearMargin: { value: 2, type: 'f32' },
        uPen: { value: 5, type: 'f32' },
      },
      uWallMask: PIXI.Texture.WHITE.source,
    },
  });
  f.padding = 0;
  return f;
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
  const shadowCone = makeShadowConeTex(128);
  const lighting = new PIXI.Container();
  const darkness = new PIXI.Sprite(PIXI.Texture.WHITE);
  darkness.tint = 0x07060d;
  const lightsLayer = new PIXI.Container();
  const vignette = new PIXI.Sprite(PIXI.Texture.EMPTY);
  lighting.addChild(darkness, lightsLayer, vignette);
  return { lightTex, shadowCone, lighting, darkness, lightsLayer, vignette, pool: [], poolUsed: 0, vigW: 0, vigH: 0 };
}

function pixiLight(L, x, y, radius, tint, alpha, occ) {
  let s = L.pool[L.poolUsed++];
  if (!s) {
    s = new PIXI.Sprite(L.lightTex);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    L.lightsLayer.addChild(s);
    L.pool.push(s);
  }
  s.visible = true;
  s.position.set(x, y);
  s.scale.set((radius * 2) / L.lightTex.width);
  s.tint = tint;
  s.alpha = alpha;
  // oclusion por muros (opcional): occ = { wx, wy, r (radio mundo), levelPxW, levelPxH }
  if (occ && L.wallMaskSource) {
    if (!s._occ) s._occ = makeOcclusionFilter();
    const u = s._occ.resources.occlusionUniforms.uniforms;
    u.uLightWorld[0] = occ.wx; u.uLightWorld[1] = occ.wy;
    u.uLevelPx[0] = occ.levelPxW; u.uLevelPx[1] = occ.levelPxH;
    u.uWorldRadius = occ.r;
    u.uNearMargin = occ.nm != null ? occ.nm : 2;
    u.uPen = occ.pen != null ? occ.pen : 5;
    s._occ.resources.uWallMask = L.wallMaskSource;
    s.filters = [s._occ];
  } else if (s.filters) {
    s.filters = null;
  }
}

function drawPixiLighting() {
  const L = PR.lights;
  if (!L) return;
  const W = PR.app.renderer.width, H = PR.app.renderer.height;
  const p = state.player, lvl = state.level, cam = state.cam, t = state.time;
  const oscuro = lvl.evento === 'oscuro';
  // fuente de la mascara de muros para el filtro de oclusion (cambia por nivel)
  L.wallMaskSource = (PR.tileCache && PR.tileCache.wallMaskTex) ? PR.tileCache.wallMaskTex.source : null;
  const lvlPxW = lvl.W * TILE, lvlPxH = lvl.H * TILE;

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
    const rmul = 0.95 + Math.sin(t * 5 + seed) * 0.05;
    // oclusion: la antorcha esta montada en un muro -> nm grande (~tile) para que su
    // propio tile no la auto-tape. wy = tY+6 (la llama, apenas debajo del tope).
    pixiLight(L, sx, sy, rad * rmul, 0xff9a3c, 0.55 * flick,
      { wx: tX, wy: tY + 6, r: 50 * rmul, levelPxW: lvlPxW, levelPxH: lvlPxH, nm: 16, pen: 5 });
  }

  // luz del jugador: suave, no quema el centro. Con oclusion por muros (raymarch).
  pixiLight(L, px(p.x), py(p.y), 72 * ZOOM, 0xffd6a0, 0.34, { wx: p.x, wy: p.y, r: 72, levelPxW: lvlPxW, levelPxH: lvlPxH });

  // auras magicas (orbes del jugador): a la altura VISUAL del orbe (pr.y - z)
  for (const pr of state.projs) {
    if (pr.dead || pr.style !== 'bolt') continue;
    pixiLight(L, px(pr.x), py(pr.y - (pr.z || 0)), 46 * ZOOM, 0x88b4ff, 0.42);
  }

  // destello de explosion (lightburst): ilumina el area un instante al estallar
  if (state.fx) for (const f of state.fx) {
    if (f.type !== 'lightburst') continue;
    pixiLight(L, px(f.x), py(f.y), (f.r || 60) * ZOOM, 0xbfe0ff, 0.6 * (f.t / f.t0));
  }

  // ocultar sprites de luz sobrantes del pool
  for (let i = L.poolUsed; i < L.pool.length; i++) L.pool[i].visible = false;
}
