// =====================================================================
// pixi-renderer.js - renderer WebGL experimental (?pixi).
// Mantiene la logica del juego en main/entities y cambia solo el dibujo.
// =====================================================================

let PR = null;

// Defaults de los knobs de luz (los que "dentro de todo gustan"). El panel puede volver
// a estos, y los cambios persisten en localStorage entre recargas.
const LIGHT_KNOB_DEFAULTS = {
  exposure: 1.1, flatten: 1, ambient: 1.4,
  playerInt: 2.2, playerRad: 46, playerHt: 26, playerY: 3,
  torchInt: 2.25, torchRad: 99, torchHt: 27,
  bloomOn: false, bloomThresh: 0.78, bloomInt: 1.5, bloomBlur: 16,
  normalStrength: 0, normalFlipY: 1,
  shadowY: 0, shadowSize: 9.5, shadowAlpha: 1, shadowWide: 3.5,
};
function loadKnobs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('luzKnobs') || '{}'); } catch (e) {}
  return Object.assign({}, LIGHT_KNOB_DEFAULTS, saved);
}
function saveKnobs() {
  try { localStorage.setItem('luzKnobs', JSON.stringify(PR.knobs)); } catch (e) {}
}

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
    entitiesGround: new PIXI.Container(), // wallTops + sombras: SUELO, se multiplican por la luz
    entitiesActors: new PIXI.Container(), // objetos + fx: ENCIMA del multiply, luz por-pie (Fase 3)
    wallTops: new PIXI.Container(),  // tiles-tope negros, re-pintados sobre la luz (sin bleed)
    shadows: new PIXI.Container(),  // blob + silueta, con blur, debajo de las entidades
    objects: new PIXI.Container(),
    fx: new PIXI.Container(),
    normalWorld: new PIXI.Container(), // sprite de normales del entorno (se rinde al normalRT, no al stage)
    screen: new PIXI.Container(),
    tex: new WeakMap(),
    frameTex: new WeakMap(),
    tileCache: null,
    spritePool: [],
    spriteUsed: 0,
    graphicsPool: [],
    graphicsUsed: 0,
    shadePool: [],   // filtros de sombreado de cuerpo, uno por entidad/frame
    shadeUsed: 0,
    lights: null, // capa de luz/oscuridad (ver buildLighting)
    // knobs de luz tuneables en vivo (panel con tecla K). El render lee de aca.
    // Carga de localStorage si hay config guardada; si no, los defaults.
    knobs: loadKnobs(),
  };
  PR.world.addChild(PR.tiles, PR.torches);
  // capa de sombras con blur: difumina los bordes del blob de contacto y de la
  // silueta proyectada de una sola pasada. Va debajo de los sprites de entidad.
  const shadowBlur = new PIXI.BlurFilter({ strength: 2.5, quality: 2 });
  shadowBlur.padding = 12;
  PR.shadows.filters = [shadowBlur];
  PR.entitiesGround.addChild(PR.wallTops, PR.shadows);
  PR.entitiesActors.addChild(PR.objects, PR.fx);
  PR.lights = buildLighting();
  PR.bloom = buildBloom();
  // sceneRoot = todo el mundo (se rinde a sceneRT): SUELO modulado por el 'multiply' del buffer
  // de luz, y encima los actores iluminados por la luz en sus pies (Fase 3).
  PR.sceneRoot = new PIXI.Container();
  PR.sceneRoot.addChild(PR.world, PR.entitiesGround, PR.lights.composite, PR.entitiesActors);
  // finalRoot = lo que va a pantalla: la escena + el bloom (add) + la UI (sin bloom).
  PR.finalRoot = new PIXI.Container();
  PR.finalRoot.addChild(PR.bloom.sceneScreenSprite, PR.bloom.bloomScreenSprite, PR.screen);
  app.stage.addChild(PR.finalRoot);
  if (typeof document !== 'undefined') buildLightKnobs();
}

// Panel de knobs de luz en vivo (toggle con tecla K). Edita PR.knobs; el render lee de ahi.
function buildLightKnobs() {
  if (document.getElementById('lightKnobs')) return;
  const K = PR.knobs;
  const SPECS = [
    ['exposure', 'Exposure (tonemap)', 0.5, 3, 0.05],
    ['ambient', 'Ambiente x', 0.3, 2.5, 0.05],
    ['flatten', 'Achatado charco', 1, 2, 0.05],
    ['playerInt', 'Jugador intensidad', 0, 2.5, 0.05],
    ['playerRad', 'Jugador radio', 20, 90, 1],
    ['playerHt', 'Jugador altura', 5, 80, 1],
    ['playerY', 'Jugador offset Y', -10, 20, 1],
    ['torchInt', 'Antorcha intensidad', 0, 2.5, 0.05],
    ['torchRad', 'Antorcha radio', 30, 120, 1],
    ['torchHt', 'Antorcha altura', 5, 90, 1],
    ['bloomThresh', 'Bloom umbral', 0.3, 1, 0.01],
    ['bloomInt', 'Bloom intensidad', 0, 3, 0.05],
    ['bloomBlur', 'Bloom blur', 2, 40, 1],
    ['normalStrength', 'Relieve (rebake)', 0, 12, 0.5, true],
    ['shadowY', 'Sombra: offset Y', -15, 15, 1],
    ['shadowSize', 'Sombra: tamano', 3, 16, 0.5],
    ['shadowWide', 'Sombra: ancho', 1.5, 5, 0.1],
    ['shadowAlpha', 'Sombra: intensidad', 0, 1, 0.02],
  ];
  const TOGGLES = [['bloomOn', 'Bloom on'], ['normalFlipY', 'Normal flip Y']];
  const p = document.createElement('div');
  p.id = 'lightKnobs';
  p.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:rgba(8,6,12,0.92);color:#e8e8e8;font:12px monospace;padding:8px 10px;border:1px solid #5a4a2a;border-radius:6px;width:250px;max-height:90vh;overflow:auto;display:none';
  let html = '<div style="font-weight:bold;color:#ffcf6a;margin-bottom:6px">LUZ — knobs (K para ocultar)</div>';
  for (const [k, label, min, max, step] of SPECS) {
    html += `<div style="margin:4px 0"><label>${label}: <span id="kv_${k}">${K[k]}</span></label>`
      + `<input type="range" id="ks_${k}" min="${min}" max="${max}" step="${step}" value="${K[k]}" style="width:100%"></div>`;
  }
  for (const [k, label] of TOGGLES) {
    html += `<div style="margin:4px 0"><label><input type="checkbox" id="kc_${k}" ${K[k] ? 'checked' : ''}> ${label}</label></div>`;
  }
  html += '<button id="kReset" style="margin-top:6px;width:100%;cursor:pointer;background:#3a2a1a;color:#ffcf6a;border:1px solid #5a4a2a">Volver a defaults</button>';
  html += '<button id="kCopy" style="margin-top:4px;width:100%;cursor:pointer">Copiar config</button>';
  p.innerHTML = html;
  document.body.appendChild(p);
  // re-sincroniza los controles del panel con PR.knobs (tras un reset o load)
  const syncUI = () => {
    for (const [k] of SPECS) { const s = document.getElementById('ks_' + k); if (s) { s.value = K[k]; document.getElementById('kv_' + k).textContent = K[k]; } }
    for (const [k] of TOGGLES) { const c = document.getElementById('kc_' + k); if (c) c.checked = (k === 'normalFlipY') ? K[k] > 0 : !!K[k]; }
  };
  for (const [k, , , , , rebake] of SPECS) {
    const s = document.getElementById('ks_' + k);
    s.addEventListener('input', () => {
      K[k] = parseFloat(s.value);
      document.getElementById('kv_' + k).textContent = K[k];
      if (rebake && PR) PR.tileCache = null; // re-hornea el normal map
      saveKnobs();
    });
  }
  for (const [k] of TOGGLES) {
    document.getElementById('kc_' + k).addEventListener('change', (e) => {
      K[k] = e.target.checked ? (k === 'normalFlipY' ? 1 : true) : (k === 'normalFlipY' ? -1 : false);
      saveKnobs();
    });
  }
  document.getElementById('kReset').addEventListener('click', () => {
    Object.assign(K, LIGHT_KNOB_DEFAULTS);
    syncUI();
    saveKnobs();
    if (PR) PR.tileCache = null; // por si cambio el relieve
  });
  document.getElementById('kCopy').addEventListener('click', () => {
    navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(K, null, 2));
    document.getElementById('kCopy').textContent = 'Copiado!';
    setTimeout(() => { const b = document.getElementById('kCopy'); if (b) b.textContent = 'Copiar config'; }, 1200);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'k' || e.key === 'K') { p.style.display = (p.style.display === 'none') ? 'block' : 'none'; }
  });
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
  PR.shadeUsed = 0;
  PR.bodyShadeFilter = null;
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
  const camX = -state.cam.x * ZOOM, camY = -state.cam.y * ZOOM;
  PR.entitiesGround.scale.set(ZOOM); PR.entitiesGround.position.set(camX, camY);
  PR.entitiesActors.scale.set(ZOOM); PR.entitiesActors.position.set(camX, camY);

  drawPixiTiles();
  drawPixiTorches();
  gatherFrameLights();   // junta las luces del frame ANTES de dibujar actores (para la luz por-pie)
  drawPixiObjects();
  drawPixiProjectiles();
  drawPixiParticles();
  drawPixiFx();
  drawPixiLighting();
  renderSceneAndBloom();
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
    s.filters = null;
  }
  s.position.set(x, y);
  if (opt && opt.anchor) s.anchor.set(opt.anchor[0], opt.anchor[1]);
  if (opt && opt.scale) s.scale.set(opt.scale[0], opt.scale[1]);
  if (opt && opt.rotation) s.rotation = opt.rotation;
  if (opt && opt.alpha != null) s.alpha = opt.alpha;
  if (opt && opt.tint != null) s.tint = opt.tint; // != null: 0x000000 (negro) es falsy, no usar truthy
  else if (parent === PR.objects && PR.actorTint != null) s.tint = PR.actorTint; // luz por-pie (Fase 3)
  // sombreado direccional del cuerpo (normales de entidad): solo en sprites de actores.
  if (parent === PR.objects && PR.bodyShadeFilter) s.filters = [PR.bodyShadeFilter];
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
    s.filters = null;
  }
  s.position.set(x, y);
  s.width = w == null ? (img.naturalWidth || img.width) : w;
  s.height = h == null ? (img.naturalHeight || img.height) : h;
  if (opt && opt.anchor) s.anchor.set(opt.anchor[0], opt.anchor[1]);
  else s.anchor.set(0, 0);
  if (opt && opt.alpha != null) s.alpha = opt.alpha;
  if (opt && opt.rotation) s.rotation = opt.rotation;
  if (opt && opt.tint != null) s.tint = opt.tint; // != null: 0x000000 (negro) es falsy, no usar truthy
  else if (parent === PR.objects && PR.actorTint != null) s.tint = PR.actorTint; // luz por-pie (Fase 3)
  if (parent === PR.objects && PR.bodyShadeFilter) s.filters = [PR.bodyShadeFilter]; // sombreado de cuerpo
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

  // normal map del entorno (Sobel del albedo de tiles) -> relieve de muros/piso (Fase 2B).
  const normalTex = makeNormalTex(cv, (PR.knobs ? PR.knobs.normalStrength : NORMAL_STRENGTH));
  const normalSprite = new PIXI.Sprite(normalTex);
  normalSprite.roundPixels = true;
  PR.normalWorld.removeChildren();
  PR.normalWorld.addChild(normalSprite);

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

  PR.tileCache = { lvl, zoneIdx: state.run.zoneIdx, exitOpen: lvl.exitOpen, tex, torches, topTex, wallMaskTex, normalTex };
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
    if (PR.tileCache && PR.tileCache.normalTex) PR.tileCache.normalTex.destroy(true);
    if (PR.tileCache && PR.tileCache.wallMaskTex) {
      // soltar la referencia al source viejo ANTES de destruirlo: si no, al cambiar de piso
      // el filtro apunta a textura muerta y Pixi crashea al swappearla -> null.
      if (PR.lights && PR.lights.lightingFilter) PR.lights.lightingFilter.resources.uWallMask = PIXI.Texture.WHITE.source;
      PR.tileCache.wallMaskTex.destroy(true);
    }
    buildPixiTileCache(lvl, zoneNow, pal);
  }
}

function drawPixiObjects() {
  const lvl = state.level;
  const p = state.player;
  PR.actorTint = 0xffffff;
  if (lvl.exitOpen) pixiRect(PR.objects, lvl.exit.tx * TILE + 3, lvl.exit.ty * TILE + 3, TILE - 6, TILE - 6, 0xffd84f, 0.35);
  for (const pk of state.pickups) drawPixiPickup(pk);
  const chestDraws = lvl.chests.map(ch => ({ y: ch.y, _chest: ch, _gold: false }));
  if (lvl.lockedChest) chestDraws.push({ y: lvl.lockedChest.y, _chest: lvl.lockedChest, _gold: true });
  const extra = [];
  if (lvl.merchant) extra.push({ y: lvl.merchant.y, _merchant: lvl.merchant });
  const decorDraws = (lvl.decor || []).map(d => ({ x: d.x, y: d.y, _decor: d }));
  const drawables = [...state.enemies, p, ...chestDraws, ...extra, ...decorDraws].sort((a, b) => a.y - b.y);
  for (const e of drawables) {
    // Fase 3: tint = luz en el pie del actor -> se ilumina como objeto parado ahi, no como
    // suelo (evita el efecto "transparente"/dos-tonos al tapar la union muro/piso).
    PR.actorTint = lightAtFoot(e.x, e.y);
    // normales de entidad: sombreado direccional del cuerpo hacia la luz dominante.
    // (los props decorativos no llevan body-shade: no son personajes con relieve propio.)
    PR.bodyShadeFilter = e._decor ? null : bodyShadeFor(e.x, e.y + 5);
    if (e._decor) drawPixiDecorProp(e._decor);
    else if (e._merchant) drawPixiMerchant(e._merchant);
    else if (e._chest) drawPixiChest(e._chest, e._gold);
    else if (e === p) drawPixiPlayer(p);
    else drawPixiEnemy(e);
  }
  PR.actorTint = 0xffffff;
  PR.bodyShadeFilter = null;
}

// Props decorativos (CraftPix). Cada tipo = un sub-rectangulo de un sheet (cargado en
// Sprites por loadDecorSheets). 'scale' mapea px-sheet -> px-mundo (TILE=16). 'anim' anima
// recorriendo filas de una columna del sheet. Se dibujan en PR.objects (luz por-pie + sombra).
const DECOR_DEFS = {
  barrel:      { sheet: 'decor_supplies', box: [22, 332, 19, 29], scale: 0.85, anchorY: 0.95 },
  sack:        { sheet: 'decor_supplies', box: [112, 335, 28, 28], scale: 0.55, anchorY: 0.95 },
  statue:      { sheet: 'decor_other',    box: [7, 5, 34, 43],    scale: 0.60, anchorY: 0.96 },
  crystal:     { sheet: 'decor_other',    box: [70, 59, 21, 27],  scale: 0.62, anchorY: 0.95 },
  banner_blue: { sheet: 'decor_other',    box: [196, 64, 23, 30], scale: 0.62, anchorY: 0.97 },
  banner_red:  { sheet: 'decor_other',    box: [164, 64, 23, 30], scale: 0.62, anchorY: 0.97 },
  // Boilers TAMBIÉN intercala por fila: col0 par = caldero lava (naranja), col0 impar =
  // caldero púrpura. Cada uno anima cada 2 filas -> 12 frames (antes se mezclaban).
  cauldron:        { sheet: 'decor_boilers', box: [0, 0, 32, 32], scale: 0.62, anchorY: 0.92,
                 anim: { col: 0, rowStart: 0, rowStep: 2, frames: 12, ms: 110 } },
  cauldron_purple: { sheet: 'decor_boilers', box: [0, 0, 32, 32], scale: 0.62, anchorY: 0.92,
                 anim: { col: 0, rowStart: 1, rowStep: 2, frames: 12, ms: 110 } },
  // piedras rúnicas animadas (sheet 5 cols × 24 filas de 64px). OJO: las filas INTERCALAN
  // dos sets de runas (pares vs impares); cada tipo anima cada 2 filas -> 12 frames.
  // Set PAR (rowStart 0): col0=fuego, col4=rayo.  Set IMPAR (rowStart 1): col1=naturaleza.
  rune_fire:   { sheet: 'decor_runes', box: [0, 0, 64, 64], scale: 0.42, anchorY: 0.95, anim: { col: 0, rowStart: 0, rowStep: 2, frames: 12, ms: 130 } },
  rune_nature: { sheet: 'decor_runes', box: [0, 0, 64, 64], scale: 0.42, anchorY: 0.95, anim: { col: 1, rowStart: 1, rowStep: 2, frames: 12, ms: 130 } },
  rune_arcane: { sheet: 'decor_runes', box: [0, 0, 64, 64], scale: 0.42, anchorY: 0.95, anim: { col: 4, rowStart: 0, rowStep: 2, frames: 12, ms: 130 } },
  // mobiliario de estudio del mago (magic_furniture): bibliotecas, escritorio, mesa, cómoda
  bookshelf:     { sheet: 'decor_furniture', box: [1, 69, 46, 52],  scale: 0.60, anchorY: 0.97 },
  bookshelf_pot: { sheet: 'decor_furniture', box: [1, 133, 46, 52], scale: 0.60, anchorY: 0.97 },
  cabinet:       { sheet: 'decor_furniture', box: [1, 5, 46, 52],   scale: 0.60, anchorY: 0.97 },
  desk:          { sheet: 'decor_furniture', box: [53, 40, 39, 24], scale: 0.64, anchorY: 0.94 },
  table:         { sheet: 'decor_furniture', box: [53, 10, 39, 22], scale: 0.64, anchorY: 0.94 },
};

function drawPixiDecorProp(d) {
  const def = DECOR_DEFS[d.type];
  if (!def) return;
  const img = Sprites[def.sheet];
  if (!pixiImageReady(img)) return;
  let [bx, by, bw, bh] = def.box;
  if (def.anim) {
    const a = def.anim;
    // frames del tipo: por defecto filas consecutivas desde 0 (rows). Si el sheet
    // INTERCALA tipos (p.ej. runas: pares vs impares), rowStart/rowStep saltean.
    const frames = a.frames || a.rows;
    const fi = Math.floor(state.time * 1000 / a.ms) % frames;
    bx = a.col * bw;
    by = ((a.rowStart || 0) + fi * (a.rowStep || 1)) * bh;
  }
  const tex = pixiFrameTexture(img, bx, by, bw, bh);
  if (!tex) return;
  const S = def.scale;
  drawPixiShadow(d.x, d.y, bw * S * 0.42, 1); // sombra de contacto (mismo motor que mobs/cofres)
  // PR.objects -> hereda PR.actorTint (luz por-pie), se integra al ambiente como cualquier actor
  pixiSpriteFromTexture(PR.objects, tex, d.x, d.y, { anchor: [0.5, def.anchorY], scale: [S, S] });
}

// Filtro de sombreado de cuerpo para un actor en (fx,fy): direccion HACIA su luz dominante
// + un leve volumen base desde arriba. Devuelve un filtro del pool (o null si esta off).
function bodyShadeFor(fx, fy) {
  if (PR.bodyShadeOn === false) return null;
  const ls = occludingLightsFor(fx, fy, 1);
  let lx = 0, ly = -1, sh = 0.12; // base: leve relieve desde arriba
  if (ls.length) { lx = -ls[0].dx; ly = -ls[0].dy; sh = 0.15 + 0.75 * ls[0].prox * ls[0].power; }
  const f = PR.shadePool[PR.shadeUsed] || (PR.shadePool[PR.shadeUsed] = makeShadeFilter());
  PR.shadeUsed++;
  const u = f.resources.shadeUniforms.uniforms;
  u.uLightDir[0] = lx; u.uLightDir[1] = ly; u.uShade = sh;
  return f;
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

// Sombra de contacto suave + DIRECCIONAL: las entidades proyectan una silueta por cada
// luz cercana (ver occludingLightsFor), estirandose y marcandose cuanto mas cerca de la luz.
// Sin luz cerca, queda el blob suave centrado bajo los pies.
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
  // misma intensidad/ancho de sombra que el jugador (knobs), escalada al tamano del mob.
  pixiContactBlob(x, fy, w, { alpha: PR.knobs.shadowAlpha, wide: PR.knobs.shadowWide, tall: 1.4 });
  const tex = PR.lights && PR.lights.lightTex;
  if (!tex) return;
  // una sombra estirada POR CADA luz cercana (abanico). fade evita que se ennegrezca al solaparse.
  const lights = occludingLightsFor(x, fy, 3);
  if (!lights.length) return;
  const fade = 1 / Math.sqrt(lights.length);
  for (const light of lights) {
    const baseW = w * 3.0, baseH = w * 1.1;
    const len = baseW * (1 + light.prox * 1.6);
    const off = (len - baseW) * 0.5 + w * 0.5 * light.prox;
    pixiSpriteFromTexture(PR.shadows, tex, x + light.dx * off, fy + light.dy * off, {
      anchor: [0.5, 0.5],
      scale: [len / tex.width, baseH / tex.height],
      rotation: Math.atan2(light.dy, light.dx),
      tint: 0x000000,
      alpha: 0.5 * light.prox * light.power * fade,
    });
  }
}

// Luces que proyectan sombra sobre un punto (fx,fy): las que ocluyen (occ) de PR.frameLights,
// dentro de rango y NO demasiado pegadas (excluye la propia luz a los pies del jugador).
// Ordenadas por cercania, top maxN. Devuelve dir luz->entidad, proximidad (0..1) y power(flicker).
function occludingLightsFor(fx, fy, maxN) {
  const lights = PR.frameLights;
  if (!lights) return [];
  const out = [];
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    if (!L.occ) continue;
    const dx = fx - L.x, dy = fy - L.y, d2 = dx * dx + dy * dy;
    const R = L.radius * 1.15;
    if (d2 >= R * R || d2 < 196) continue; // fuera de rango, o a <14px (su propia luz)
    const d = Math.sqrt(d2);
    out.push({ dx: dx / d, dy: dy / d, prox: 1 - d / R, power: Math.min(1, L.intensity * 0.74), d2 });
  }
  out.sort((a, b) => a.d2 - b.d2);
  if (out.length > (maxN || 3)) out.length = maxN || 3;
  return out;
}

// Silueta del PNG: redibuja la imagen del personaje en negro, anclada en los pies,
// rotada para "acostarse" en direccion contraria a la luz y estirada a lo largo.
// MANTIENE la forma reconocible del personaje (sin deformar). El fade (alpha por
// proximidad) y el circulo de contacto completan el efecto.
function drawPixiSilhouette(img, footX, footY, S, light, fade) {
  const tex = pixiTexture(img);
  if (!tex) return;
  const w = img.naturalWidth || 120, h = img.naturalHeight || 120;
  const lenMul = 0.9 + light.prox * 1.2; // se estira a lo largo al acercarse a la luz
  pixiSpriteFromTexture(PR.shadows, tex, footX, footY, {
    anchor: [60 / w, 90 / h],            // pie del rig V2 = (60,90)
    scale: [S * 0.95, S * lenMul],
    rotation: Math.atan2(light.dx, -light.dy), // la cabeza apunta lejos de la luz
    tint: 0x000000,
    alpha: light.prox * 0.6 * (light.power || 1) * (fade == null ? 1 : fade), // respira con la llama
  });
}

function drawPixiPlayer(p) {
  const fy = p.y + 5;
  // sombras del jugador: una silueta proyectada POR CADA luz cercana (abanico). El blob de
  // contacto se estira hacia la luz dominante para fundirse con su silueta.
  const lights = occludingLightsFor(p.x, fy, 3);
  const nearest = lights[0];
  // sombra circular de apoyo SIEMPRE bajo los pies (independiente de antorchas). Tuneable
  // por knobs (offset Y / tamano / ancho / intensidad).
  const KS = PR.knobs;
  pixiContactBlob(p.x, fy + KS.shadowY, KS.shadowSize, { alpha: KS.shadowAlpha, wide: KS.shadowWide, tall: 1.45 });
  // ademas, si hay una luz cerca, un estiron hacia el lado opuesto para fundirse con la silueta.
  if (nearest) {
    pixiContactBlob(p.x, fy + 3, 7, {
      alpha: (0.5 + 0.16 * nearest.prox) * nearest.power,
      wide: 2.7 + 1.6 * nearest.prox,
      tall: 1.15,
      rotation: Math.atan2(nearest.dy, nearest.dx),
    });
  }
  const body = (typeof V2H !== 'undefined' && V2H.ready) ? pixiPlayerImage(p) : null;
  if (pixiImageReady(body) && lights.length) {
    const fade = 1 / Math.sqrt(lights.length);
    for (const light of lights) drawPixiSilhouette(body, p.x, fy, 0.4, light, fade);
  }
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
  // tint normal = null -> el sprite hereda el tint de luz por-pie (PR.actorTint) y se integra
  // con el ambiente. Solo el flash de golpe (blanco) y enraged (rojo) lo pisan.
  const tint = e.flashT > 0 ? 0xffffff : (e.enraged ? 0xff3030 : null);
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
      if (pixiImageReady(img)) { const S = f.scale || 0.6; const s = pixiSprite(PR.fx, img, f.x, f.y, 40 * S, 40 * S, { anchor: [0.5, 0.5] }); if (s) s.blendMode = 'add'; }
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
// Iluminacion diferida (Fase 1). En vez de pintar glows aditivos sobre la
// escena, se construye un BUFFER DE LUZ y se compone multiplicando:
//   1) escena = PR.world (piso) + PR.entities (personajes) a brillo pleno
//   2) lightRT = [ambiente opaco + luces(ADD) con oclusion] -> RenderTexture
//   3) stage: escena, luego sprite 'composite' (= lightRT, blend MULTIPLY) que
//      modula toda la escena, luego UI sin multiplicar.
// Asi la luz REVELA la superficie real (piso/muros/personajes) en vez de
// pintar un disco encima. Las normales (Fase 2+) entran en el buffer de luz.
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

// Genera un NORMAL MAP desde un canvas de albedo via Sobel: la luminancia (pesada por
// alpha) se trata como altura, y el gradiente da el relieve. Ladrillos/grietas del muro
// agarran la luz de costado. strength controla cuanto relieve. Se hornea 1 vez por piso.
function makeNormalTex(srcCanvas, strength) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const octx = out.getContext('2d');
  const od = octx.createImageData(w, h);
  const hAt = (x, y) => {
    x = x < 0 ? 0 : x >= w ? w - 1 : x; y = y < 0 ? 0 : y >= h ? h - 1 : y;
    const i = (y * w + x) * 4, a = sd[i + 3] / 255;
    return a * (0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2]) / 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * strength;
    const dy = (hAt(x, y + 1) - hAt(x, y - 1)) * strength;
    let nx = -dx, ny = -dy, nz = 1;
    const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
    const i = (y * w + x) * 4;
    od.data[i] = (nx * inv * 0.5 + 0.5) * 255;
    od.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
    od.data[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
    od.data[i + 3] = 255;
  }
  octx.putImageData(od, 0, 0);
  const tex = PIXI.Texture.from(out);
  if (tex.source) tex.source.scaleMode = 'nearest';
  return tex;
}
const NORMAL_STRENGTH = 4.5; // relieve del entorno (subir = mas marcado)

// ---------------------------------------------------------------------
// Vertex compartido de los filtros de luz (lighting / shade / bloom-threshold). Expone:
//   vSpriteUV  = aPosition (0..1 sobre el sprite, robusto al redondeo del filtro)
//   vTextureCoord / vTexScale = coords y escala uv->textura del input del filtro.
// ---------------------------------------------------------------------
const OCCLUSION_VERT = `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vSpriteUV; // 0..1 sobre el sprite de luz (robusto al redondeo de textura del filtro)
out vec2 vTexScale; // escala uv->textura del filtro, para remuestrear deformado en el frag
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
  vTexScale = uOutputFrame.zw * uInputSize.zw;
}
`;
// ---------------------------------------------------------------------
// Shader de luz ANALITICO (Fase 2). Una sola pasada fullscreen que llena el
// buffer de luz: por cada pixel reconstruye su posicion-mundo, lee la normal
// (Fase 2A: plana; 2B: del normalRT) y recorre TODAS las luces (uniforms de
// array) sumando ambiente + color*intensidad*atenuacion*(N·L)*sombra.
// La sombra es el raymarch de muros que ya teniamos (reusado por luz).
// Reemplaza los sprites de gradiente + el filtro de oclusion por-sprite.
// ---------------------------------------------------------------------
const MAXLIGHTS = 24;
// textura 1x1 de normal plana (0.5,0.5,1.0) -> N=(0,0,1). Fallback y relleno del normalRT.
let _flatNormalSrc = null;
function flatNormalSource() {
  if (_flatNormalSrc) return _flatNormalSrc;
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 1, 1);
  _flatNormalSrc = PIXI.Texture.from(c).source;
  return _flatNormalSrc;
}
const LIGHTING_FRAG = `#version 300 es
in vec2 vSpriteUV;
out vec4 finalColor;
uniform sampler2D uTexture;   // input del filtro (sin uso directo)
uniform sampler2D uWallMask;  // mascara de muros (1 texel/tile, blanco=muro)
uniform sampler2D uNormalTex; // buffer de normales del entorno (screen-space, Fase 2B)
uniform float uNormalY;       // +1 o -1: corrige el flip-Y del muestreo del normalRT
#define MAXL ${MAXLIGHTS}
uniform vec2 uLightPos[MAXL];   // posicion mundo de cada luz
uniform vec4 uLightColor[MAXL]; // rgb + a = flag de oclusion (1=proyecta sombra)
uniform vec4 uLightParam[MAXL]; // x=radio, y=altura(z virtual), z=intensidad, w=nearMargin
uniform int  uCount;
uniform vec3 uAmbient;          // multiplicador minimo (zona sin luz)
uniform vec2 uCam;              // esquina sup-izq de la camara en mundo
uniform vec2 uRender;           // tamano del render en px
uniform float uZoom;
uniform vec2 uLevelPx;          // tamano del nivel en px (para muestrear la mascara)
uniform float uPen;             // penumbra (offset de los rayos de sombra)
uniform float uFlatten;         // >1 = achata el charco de luz en Y (mas horizontal, vista 3/4)
uniform float uExposure;        // tonemap: comprime brillos sin saturar a blanco (gradiente real)
float hash21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
// 1.0 si el rayo de 'from' a 'to' no pega muro; 0.0 si lo bloquea. jit rompe el banding.
float rayClear(vec2 from, vec2 to, float nm, float jit){
  const int STEPS=28;
  vec2 sv=(to-from)/float(STEPS);
  vec2 q=from+sv*jit;
  for(int i=0;i<STEPS;i++){
    if(distance(q,to)<nm) break;
    if(texture(uWallMask, q/uLevelPx).r>0.5) return 0.0;
    q+=sv;
  }
  return 1.0;
}
void main(void){
  vec2 uv = vSpriteUV;
  vec2 worldPos = uCam + (uv*uRender)/uZoom;   // px(wx)=(wx-cam)*zoom  ->  inverso
  // normal del entorno desde el normalRT (screen-space). uNormalY corrige el flip-Y.
  vec2 nuv = vec2(uv.x, uNormalY > 0.0 ? uv.y : 1.0 - uv.y);
  vec3 N = normalize(texture(uNormalTex, nuv).xyz * 2.0 - 1.0);
  vec3 lit = uAmbient;
  float jit = hash21(uv*512.0);
  for(int i=0;i<MAXL;i++){
    if(i>=uCount) break;
    vec2 d = uLightPos[i]-worldPos;
    float radius = uLightParam[i].x;
    // distancia ACHATADA en Y (charco eliptico/horizontal); la direccion L usa la d real.
    float dist = length(vec2(d.x, d.y * uFlatten));
    if(dist>radius) continue;
    float atten = pow(max(1.0-dist/radius,0.0),2.0);     // falloff cuadratico a 0
    vec3 L = normalize(vec3(d, uLightParam[i].y));        // altura = angulo rasante
    float ndl = max(dot(N,L),0.0);
    float sh = 1.0;
    if(uLightColor[i].a>0.5){
      float nm=uLightParam[i].w;
      // penumbra PERPENDICULAR a la direccion de la luz (no en ejes fijos del mundo): con
      // offsets en ejes, al alinearte con la antorcha (misma fila/columna) los rayos
      // degeneran y aparece una linea horizontal/vertical cruzando la pantalla.
      vec2 perp = (dist > 0.001 ? vec2(-d.y, d.x) / dist : vec2(1.0, 0.0)) * uPen;
      sh = (rayClear(worldPos, uLightPos[i], nm, jit)
          + rayClear(worldPos, uLightPos[i] + perp, nm, jit)
          + rayClear(worldPos, uLightPos[i] - perp, nm, jit)) * 0.33333;
    }
    lit += uLightColor[i].rgb * uLightParam[i].z * atten * ndl * sh;
  }
  // tonemap que PRESERVA EL TONO (Reinhard/exposicion sobre la luminancia): comprime los
  // brillos en vez de clampear a blanco. El charco mantiene su naranja del centro al borde
  // (gradiente suave real, sin disco plano ni borde duro), y la sombra de contacto deja de
  // lavarse. uExposure controla cuanto.
  float lum = dot(lit, vec3(0.299, 0.587, 0.114));
  float lum2 = 1.0 - exp(-lum * uExposure);
  lit *= lum2 / max(lum, 0.0001);
  // dither leve del buffer de luz (el anti-banding fuerte va en pantalla, post-multiply).
  float dith=(hash21(floor(uv*uRender))-0.5)/255.0;
  finalColor = vec4(lit+dith, 1.0);
}
`;
function makeLightingFilter() {
  const f = new PIXI.Filter({
    glProgram: PIXI.GlProgram.from({ vertex: OCCLUSION_VERT, fragment: LIGHTING_FRAG, name: 'deferred-lighting' }),
    resources: {
      lightUniforms: {
        uLightPos:   { value: new Float32Array(MAXLIGHTS * 2), type: 'vec2<f32>', size: MAXLIGHTS },
        uLightColor: { value: new Float32Array(MAXLIGHTS * 4), type: 'vec4<f32>', size: MAXLIGHTS },
        uLightParam: { value: new Float32Array(MAXLIGHTS * 4), type: 'vec4<f32>', size: MAXLIGHTS },
        uCount:   { value: 0, type: 'i32' },
        uAmbient: { value: new Float32Array([0.17, 0.155, 0.19]), type: 'vec3<f32>' },
        uCam:     { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
        uRender:  { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
        uZoom:    { value: 1, type: 'f32' },
        uLevelPx: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
        uPen:     { value: 5, type: 'f32' },
        uNormalY: { value: 1, type: 'f32' },
        uFlatten: { value: 1.3, type: 'f32' },
        uExposure: { value: 1.5, type: 'f32' },
      },
      uWallMask: PIXI.Texture.WHITE.source,
      uNormalTex: flatNormalSource(), // normal plana hasta tener el normalRT
    },
  });
  f.padding = 0;
  return f;
}

// ---------------------------------------------------------------------
// Sombreado direccional del cuerpo de personajes (normales de entidad). Saca el
// relieve por Sobel del propio sprite (luminancia) y lo ilumina con N·L hacia la luz
// dominante -> lado iluminado mas claro / opuesto mas oscuro. Un filtro por entidad.
// ---------------------------------------------------------------------
const SHADE_FRAG = `#version 300 es
precision highp float;     // uInputSize es highp en el vertex (OCCLUSION_VERT): igualar o no linkea
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;   // .zw = 1/tamano (texel) para el Sobel
uniform vec2 uLightDir;    // direccion 2D HACIA la luz (screen-space), normalizada
uniform float uShade;      // fuerza del sombreado
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(void){
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a < 0.02) { finalColor = c; return; }
  vec2 tx = uInputSize.zw;
  float lx1 = luma(texture(uTexture, vTextureCoord + vec2(tx.x, 0.0)).rgb);
  float lx0 = luma(texture(uTexture, vTextureCoord - vec2(tx.x, 0.0)).rgb);
  float ly1 = luma(texture(uTexture, vTextureCoord + vec2(0.0, tx.y)).rgb);
  float ly0 = luma(texture(uTexture, vTextureCoord - vec2(0.0, tx.y)).rgb);
  vec2 grad = vec2(lx1 - lx0, ly1 - ly0);     // gradiente de altura
  float ndl = dot(-grad, uLightDir);          // relieve que mira a la luz -> +
  float shade = clamp(1.0 + uShade * ndl, 0.55, 1.7);
  finalColor = vec4(c.rgb * shade, c.a);      // premultiplied: escalar rgb conserva alpha
}
`;
function makeShadeFilter() {
  const f = new PIXI.Filter({
    glProgram: PIXI.GlProgram.from({ vertex: OCCLUSION_VERT, fragment: SHADE_FRAG, name: 'actor-shade' }),
    resources: { shadeUniforms: { uLightDir: { value: new Float32Array([0, -1]), type: 'vec2<f32>' }, uShade: { value: 0, type: 'f32' } } },
  });
  f.padding = 2; // borde para el Sobel en los bordes del sprite (da rim sutil)
  return f;
}

// ---------------------------------------------------------------------
// Bloom (Fase 5): post-proceso. Se extrae lo brillante de la escena (umbral),
// se difumina y se suma encima -> las antorchas/zonas iluminadas "florecen".
// Restaura el pop del sistema viejo aditivo, pero como consecuencia de la luz.
// ---------------------------------------------------------------------
const BLOOM_THRESH_FRAG = `#version 300 es
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uThreshold; // brillo a partir del cual algo "florece"
uniform float uIntensity; // cuanta luz se suma
void main(void){
  vec3 c = texture(uTexture, vTextureCoord).rgb;
  float l = max(c.r, max(c.g, c.b));
  float w = max(l - uThreshold, 0.0) / max(1.0 - uThreshold, 0.001);
  finalColor = vec4(c * w * uIntensity, 1.0);
}
`;
function makeThresholdFilter() {
  const f = new PIXI.Filter({
    glProgram: PIXI.GlProgram.from({ vertex: OCCLUSION_VERT, fragment: BLOOM_THRESH_FRAG, name: 'bloom-threshold' }),
    resources: { threshUniforms: { uThreshold: { value: 0.62, type: 'f32' }, uIntensity: { value: 1.5, type: 'f32' } } },
  });
  f.padding = 0;
  return f;
}
// Dither de PANTALLA: +-0.5 LSB de ruido por-pixel sobre la imagen final. Rompe el escalon
// de 8 bits del buffer de luz que, en gradientes muy suaves (bordes de charcos), se veia
// como lineas que parpadeaban. Va post-multiply, asi que el albedo no lo atenua.
const DITHER_FRAG = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
float hash21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
void main(void){
  vec4 c = texture(uTexture, vTextureCoord);
  float d = (hash21(floor(vTextureCoord * uInputSize.xy)) - 0.5) / 255.0;
  finalColor = vec4(c.rgb + d, c.a);
}
`;
function makeDitherFilter() {
  const f = new PIXI.Filter({
    glProgram: PIXI.GlProgram.from({ vertex: OCCLUSION_VERT, fragment: DITHER_FRAG, name: 'screen-dither' }),
    resources: {},
  });
  f.padding = 0;
  return f;
}
function buildBloom() {
  const thresholdFilter = makeThresholdFilter();
  const blur = new PIXI.BlurFilter({ strength: 18, quality: 4 });
  blur.padding = 32;
  const srcSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);   // = sceneRT, con umbral+blur -> bloomRT
  srcSprite.filters = [thresholdFilter, blur];
  const sceneScreenSprite = new PIXI.Sprite(PIXI.Texture.EMPTY); // = sceneRT, a pantalla (normal + dither)
  sceneScreenSprite.filters = [makeDitherFilter()];
  const bloomScreenSprite = new PIXI.Sprite(PIXI.Texture.EMPTY); // = bloomRT, a pantalla (add)
  bloomScreenSprite.blendMode = 'add';
  return { thresholdFilter, blur, srcSprite, sceneScreenSprite, bloomScreenSprite,
           sceneRT: null, bloomRT: null, w: 0, h: 0 };
}

// Construye la capa de luz. El orden en el stage (init) la deja ENTRE el piso y
// las entidades: la luz cae sobre el piso y los personajes van encima a brillo
// normal ("caminan sobre la luz", sin aura pintada sobre el sprite).
function buildLighting() {
  // curva concava con cola larga: el degradé se desvanece suave hasta 0 en el borde
  // (en vez de cortarse de golpe), se ve mas natural.
  const lightTex = makeRadialTex([
    [0, 'rgba(255,255,255,0.92)'],
    [0.18, 'rgba(255,255,255,0.60)'],
    [0.36, 'rgba(255,255,255,0.34)'],
    [0.55, 'rgba(255,255,255,0.17)'],
    [0.72, 'rgba(255,255,255,0.07)'],
    [0.88, 'rgba(255,255,255,0.02)'],
    [1, 'rgba(255,255,255,0)'],
  ], 128);
  // sprite que MULTIPLICA la escena ya dibujada por el buffer de luz (composicion realista):
  // zona sin luz -> escena * ambiente (oscura), zona iluminada -> escena * ~1 (color real).
  const composite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  composite.blendMode = 'multiply';
  // pase de luz analitico: sprite blanco fullscreen con el filtro de luz; se renderiza a
  // lightRT (ver makeLightingFilter / drawPixiLighting).
  const lightPass = new PIXI.Sprite(PIXI.Texture.WHITE);
  const lightingFilter = makeLightingFilter();
  lightPass.filters = [lightingFilter];
  // buffer de normales del entorno: fondo plano + el sprite de normales (con transform de mundo).
  const flatBg = new PIXI.Sprite(flatNormalSource());
  return { lightTex, composite, lightPass, lightingFilter, flatBg,
           rt: null, rtW: 0, rtH: 0, normalRT: null };
}

// Junta TODAS las luces del frame como descriptores en coordenadas MUNDO (radio en
// px-mundo; height = z virtual -> angulo rasante; occ = proyecta sombra; cr/cg/cb = color
// 0..1). Corre ANTES de dibujar los actores para poder iluminarlos por su punto de pie.
function gatherFrameLights() {
  const L = PR.lights; if (!L) return;
  const p = state.player, lvl = state.level, cam = state.cam, t = state.time;
  const W = PR.app.renderer.width, H = PR.app.renderer.height;
  L.wallMaskSource = (PR.tileCache && PR.tileCache.wallMaskTex) ? PR.tileCache.wallMaskTex.source : null;
  const occOk = !!L.wallMaskSource;
  const lights = [];
  const K = PR.knobs;
  const push = (x, y, c, radius, height, intensity, occ, nm) => lights.push({
    x, y, radius, height, intensity, occ: (occ && occOk) ? 1 : 0, nm,
    cr: ((c >> 16) & 255) / 255, cg: ((c >> 8) & 255) / 255, cb: (c & 255) / 255 });
  push(p.x, p.y + K.playerY, 0xff9a3c, K.playerRad, K.playerHt, K.playerInt, 1, 4); // jugador: charquito a los pies
  for (const pr of state.projs) {                                    // orbes magicos
    if (pr.dead || pr.style !== 'bolt') continue;
    push(pr.x, pr.y - (pr.z || 0), 0x88b4ff, 46, 24, 0.42, 0, 2);     // orbe a su altura visual
    push(pr.x, pr.y, 0x88b4ff, 50, 14, 0.95, 0, 2);                   // pool en el PISO bajo el bolt (mas fuerte)
  }
  // destello de impacto con VIDA PROPIA (mas largo + fade lento, no atado al flashT corto):
  // se refresca al golpear (flashT) y despues decae ~0.75s. Ilumina mob + piso.
  if (state.enemies) for (const e of state.enemies) {
    if ((e.flashT || 0) > 0) e._impL = 1.0;
    let v = e._impL || 0;
    if (v <= 0) continue;
    const dt = (e._impLt != null) ? Math.min(0.1, Math.max(0, t - e._impLt)) : 0;
    e._impLt = t;
    v = Math.max(0, v - dt / 0.75);
    e._impL = v;
    push(e.x, e.y, 0xbfe0ff, 62, 24, v, 0, 2);
  }
  if (state.fx) for (const f of state.fx) {                          // destellos de explosion
    if (f.type !== 'lightburst') continue;
    push(f.x, f.y, 0xbfe0ff, f.r || 60, 30, 0.6 * (f.t / f.t0), 0, 2);
  }
  const tc = PR.tileCache, margin = (K.torchRad + 16) * ZOOM;        // antorchas (culling por pantalla; > radio)
  if (tc && tc.torches) for (const [tX, tY, seed] of tc.torches) {
    const sx = (tX - cam.x) * ZOOM, sy = (tY - cam.y) * ZOOM;
    if (sx < -margin || sx > W + margin || sy < -margin || sy > H + margin) continue;
    const flick = 0.82 + Math.sin(t * 7 + seed) * 0.12 + Math.sin(t * 17 + seed * 1.7) * 0.05;
    const rmul = 0.95 + Math.sin(t * 5 + seed) * 0.05;
    push(tX, tY + 6, 0xff9a3c, K.torchRad * rmul, K.torchHt, K.torchInt * flick, 1, 16); // nm grande: montada en muro
  }
  if (lights.length > MAXLIGHTS) {
    // throttle: en una pelea cargada esto se cumple cada frame; no spamear la consola
    // (console.warn es lento). Avisar como mucho 1 vez/seg.
    if (PR._lightCapWarnT == null || t - PR._lightCapWarnT > 1) {
      console.warn('[luz] +' + (lights.length - MAXLIGHTS) + ' luces descartadas (cap ' + MAXLIGHTS + ')');
      PR._lightCapWarnT = t;
    }
    lights.length = MAXLIGHTS;
  }
  PR.frameLights = lights;
  const amb = K.ambient;
  PR.frameAmbient = (lvl.evento === 'oscuro') ? [0.235 * amb, 0.217 * amb, 0.265 * amb] : [0.420 * amb, 0.392 * amb, 0.450 * amb];
}

// Raymarch en JS sobre lvl.map: 1.0 si la linea de (ax,ay) a (bx,by) no pega muro.
function wallClearJS(ax, ay, bx, by, nm) {
  const lvl = state.level; if (!lvl) return 1;
  const STEPS = 20, dx = (bx - ax) / STEPS, dy = (by - ay) / STEPS;
  let x = ax, y = ay;
  for (let i = 0; i < STEPS; i++) {
    x += dx; y += dy;
    const ddx = bx - x, ddy = by - y;
    if (ddx * ddx + ddy * ddy < nm * nm) break;
    const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
    if (ty < 0 || ty >= lvl.H || tx < 0 || tx >= lvl.W) continue;
    if (lvl.map[ty][tx] === 0) return 0; // muro
  }
  return 1;
}

// Luz que recibe un punto del piso (mundo) = ambiente + suma de luces (atenuacion*N·L*sombra),
// con N plana. Devuelve un tint hex para multiplicar el sprite del actor parado ahi (Fase 3).
function lightAtFoot(wx, wy) {
  const lights = PR.frameLights, amb = PR.frameAmbient;
  if (!lights || !amb) return 0xffffff;
  let r = amb[0], g = amb[1], b = amb[2];
  for (let i = 0; i < lights.length; i++) {
    const Lg = lights[i];
    const dx = Lg.x - wx, dy = Lg.y - wy, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > Lg.radius) continue;
    const k = Math.max(1 - dist / Lg.radius, 0), atten = k * k;
    const ndl = Lg.height / Math.sqrt(dist * dist + Lg.height * Lg.height);
    const sh = Lg.occ ? wallClearJS(wx, wy, Lg.x, Lg.y, Lg.nm) : 1;
    const f = Lg.intensity * atten * ndl * sh;
    r += Lg.cr * f; g += Lg.cg * f; b += Lg.cb * f;
  }
  // MISMO tonemap que el shader (hue-preserving): el personaje se ilumina igual que el piso,
  // sin clampear a blanco -> deja de "resaltar" sobre-brillante/saturado respecto del suelo.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const s = (1 - Math.exp(-lum * PR.knobs.exposure)) / Math.max(lum, 0.0001);
  r *= s; g *= s; b *= s;
  const ti = (v) => v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
  return (ti(r) << 16) | (ti(g) << 8) | ti(b);
}

function drawPixiLighting() {
  const L = PR.lights;
  if (!L) return;
  const renderer = PR.app.renderer;
  const W = renderer.width, H = renderer.height;
  // (re)crear el buffer de luz al tamano de pantalla (solo si cambio)
  if (!L.rt || L.rtW !== W || L.rtH !== H) {
    if (L.rt) L.rt.destroy(true);
    L.rt = PIXI.RenderTexture.create({ width: W, height: H });
    L.rtW = W; L.rtH = H;
    L.composite.texture = L.rt;
  }
  const lvl = state.level, cam = state.cam;
  const lvlPxW = lvl.W * TILE, lvlPxH = lvl.H * TILE;
  const lights = PR.frameLights || [], amb = PR.frameAmbient || [0.42, 0.392, 0.45];

  // ----- buffer de NORMALES del entorno (Fase 2B): fondo plano + sprite de normales con
  // transform de mundo -> screen-space. Lo samplea el shader para el N·L direccional. -----
  if (!L.normalRT || L.normalRT.width !== W || L.normalRT.height !== H) {
    if (L.normalRT) {
      // soltar el source viejo del filtro ANTES de destruirlo: si no, al setear el nuevo
      // Pixi intenta liberar el binding del viejo ya destruido -> crash null en resize.
      L.lightingFilter.resources.uNormalTex = flatNormalSource();
      L.normalRT.destroy(true);
    }
    L.normalRT = PIXI.RenderTexture.create({ width: W, height: H });
    // setear el sampler al crear el RT (mismo objeto entre frames; solo cambia su contenido).
    L.lightingFilter.resources.uNormalTex = L.normalRT.source;
  }
  L.flatBg.width = W; L.flatBg.height = H;
  PR.normalWorld.scale.set(ZOOM);
  PR.normalWorld.position.set(-cam.x * ZOOM, -cam.y * ZOOM);
  renderer.render({ container: L.flatBg, target: L.normalRT, clear: true });
  renderer.render({ container: PR.normalWorld, target: L.normalRT, clear: false });

  // volcar las luces (ya juntadas por gatherFrameLights) al shader analitico
  const lf = L.lightingFilter.resources.lightUniforms.uniforms;
  const pos = lf.uLightPos, col = lf.uLightColor, par = lf.uLightParam;
  for (let i = 0; i < lights.length; i++) {
    const g = lights[i];
    pos[i * 2] = g.x; pos[i * 2 + 1] = g.y;
    col[i * 4] = g.cr; col[i * 4 + 1] = g.cg; col[i * 4 + 2] = g.cb; col[i * 4 + 3] = g.occ;
    par[i * 4] = g.radius; par[i * 4 + 1] = g.height; par[i * 4 + 2] = g.intensity; par[i * 4 + 3] = g.nm;
  }
  lf.uCount = lights.length;
  lf.uAmbient[0] = amb[0]; lf.uAmbient[1] = amb[1]; lf.uAmbient[2] = amb[2];
  lf.uCam[0] = cam.x; lf.uCam[1] = cam.y;
  lf.uRender[0] = W; lf.uRender[1] = H;
  lf.uZoom = ZOOM;
  lf.uLevelPx[0] = lvlPxW; lf.uLevelPx[1] = lvlPxH;
  lf.uPen = 5;
  lf.uNormalY = PR.knobs.normalFlipY;   // knobs (panel tecla K)
  lf.uFlatten = PR.knobs.flatten;
  lf.uExposure = PR.knobs.exposure;
  // reasignar recurso + filters cada frame -> fuerza el re-upload de los uniforms.
  L.lightingFilter.resources.uWallMask = L.wallMaskSource || PIXI.Texture.WHITE.source;
  L.lightPass.filters = [L.lightingFilter];
  L.lightPass.width = W; L.lightPass.height = H;

  // render del pase de luz -> lightRT. El stage luego multiplica el SUELO por este buffer.
  renderer.render({ container: L.lightPass, target: L.rt, clear: true });
}

// Render final: escena (mundo modulado por la luz) -> sceneRT, bloom de sus zonas brillantes
// -> bloomRT, y a pantalla la escena + el bloom (add) + la UI. (Fase 5)
function renderSceneAndBloom() {
  const renderer = PR.app.renderer, B = PR.bloom;
  const W = renderer.width, H = renderer.height;
  if (!B.sceneRT || B.w !== W || B.h !== H) {
    if (B.sceneRT) B.sceneRT.destroy(true);
    if (B.bloomRT) B.bloomRT.destroy(true);
    B.sceneRT = PIXI.RenderTexture.create({ width: W, height: H });
    B.bloomRT = PIXI.RenderTexture.create({ width: W, height: H });
    B.w = W; B.h = H;
    B.srcSprite.texture = B.sceneRT;
    B.sceneScreenSprite.texture = B.sceneRT;
    B.bloomScreenSprite.texture = B.bloomRT;
  }
  // 1) escena completa (sin UI) -> sceneRT
  renderer.render({ container: PR.sceneRoot, target: B.sceneRT, clear: true });
  // 2) bloom: umbral + blur de lo brillante -> bloomRT
  const on = PR.knobs.bloomOn !== false;
  // bloom desde knobs (umbral alto = solo florece lo MUY brillante / llamas, no el charco).
  const tu = B.thresholdFilter.resources.threshUniforms.uniforms;
  tu.uThreshold = PR.knobs.bloomThresh; tu.uIntensity = PR.knobs.bloomInt;
  B.blur.strength = PR.knobs.bloomBlur;
  if (on) renderer.render({ container: B.srcSprite, target: B.bloomRT, clear: true });
  B.bloomScreenSprite.visible = on;
  // 3) a pantalla: escena + bloom(add) + UI
  renderer.render({ container: PR.finalRoot });
}
