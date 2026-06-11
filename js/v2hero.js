// =====================================================================
// v2hero.js — renderer experimental del mago v2 (PixelLab, 8 direcciones).
// Si los PNGs de assets/v2_test/mage/ cargan, reemplaza el dibujo del
// jugador; si falta algo, el juego cae al renderer de siempre.
// Frames de 120×120 con pies en y=89; a escala 0.4 ocupa 24px de mundo.
// =====================================================================

const V2H = {
  ready: false,
  imgs: {},
  anims: { idle: { n: 4, ms: 220 }, walk: { n: 6, ms: 110 }, hurt: { n: 4, ms: 65 } },
  // efectos del poder (energyblast): vuelo en loop + explosión one-shot
  fx: { power: [], boom: [] },
};

function loadV2Hero() {
  const dirs = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
  let left = 0;
  for (const d of dirs) for (const a in V2H.anims) left += V2H.anims[a].n;
  for (const d of dirs) {
    for (const a in V2H.anims) {
      for (let f = 0; f < V2H.anims[a].n; f++) {
        const im = new Image();
        im.onload = () => { if (--left === 0) V2H.ready = true; };
        im.onerror = () => { left = Infinity; }; // falta un frame → nunca ready, fallback v1
        im.src = `assets/v2_test/mage/${a}/${d}_${f}.png`;
        V2H.imgs[`${a}_${d}_${f}`] = im;
      }
    }
  }
  // los efectos cargan aparte: si faltan, el motor usa el orbe por código
  for (let f = 0; f < 4; f++) {
    const im = new Image();
    im.onload = () => V2H.fx.power.push(im) && V2H.fx.power.sort((a, b) => a._f - b._f);
    im._f = f; im.src = `assets/v2_test/mage/power/south_${f}.png`;
  }
  const boomTmp = [];
  for (let f = 0; f < 8; f++) {
    const im = new Image();
    im._f = f;
    im.onload = () => { boomTmp.push(im); if (boomTmp.length === 8) V2H.fx.boom = boomTmp.sort((a, b) => a._f - b._f); };
    im.src = `assets/v2_test/mage/powerboom/south_${f}.png`;
  }
}

// Proyectil energyblast: el arte vuela "hacia la derecha" → rotar al ángulo real.
// El tamaño visual acompaña a la hitbox (pr.size): blast más grande, golpe más grande.
function drawV2Bolt(pr) {
  const fi = Math.floor(pr.t * 1000 / 90) % V2H.fx.power.length;
  const S = (pr.size || 12) / 20; // size 12 → 0.6: 40px de arte → 24px de mundo
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.rotate(pr.ang);
  // al agotarse el alcance se difumina (último tercio de vida) y se encoge apenas
  ctx.globalAlpha = Math.min(1, pr.life * 3.5);
  const shrink = 0.85 + Math.min(1, pr.life * 3.5) * 0.15;
  ctx.drawImage(V2H.fx.power[fi], -20 * S * shrink, -20 * S * shrink, 40 * S * shrink, 40 * S * shrink);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// El personaje mira hacia donde SE MUEVE (teclado/joystick), no hacia el cursor.
// Quieto, conserva la última dirección de marcha.
const V2_OCTANTS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

function drawV2Hero(p) {
  const dx = p.x - (p._v2px !== undefined ? p._v2px : p.x);
  const dy = p.y - (p._v2py !== undefined ? p._v2py : p.y);
  p._v2px = p.x; p._v2py = p.y;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    const a = Math.atan2(dy, dx);
    p._v2face = V2_OCTANTS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }
  // atacando, el cuerpo gira hacia donde apunta (si no, los tiros salen "por la espalda");
  // al soltar queda mirando hacia donde disparó
  if (mouse.down || touch.attacking) {
    const aa = aimAngle();
    p._v2face = V2_OCTANTS[(Math.round(aa / (Math.PI / 4)) + 8) % 8];
  }
  const face = p._v2face || 'south';
  let anim = p.moving ? 'walk' : 'idle';
  if ((p.hurtT || 0) > 0) anim = 'hurt'; // recibir daño pisa a todo
  if (p._v2anim !== anim) { p._v2anim = anim; p._v2t = state.time; }
  const def = V2H.anims[anim];
  const fi = Math.floor((state.time - p._v2t) * 1000 / def.ms) % def.n;
  const img = V2H.imgs[`${anim}_${face}_${fi}`];
  const S = 0.4, footY = p.y + 5;
  // anclar bottom-center: la fila y=89 del frame apoya en footY
  ctx.drawImage(img, p.x - 60 * S, footY - 90 * S, 120 * S, 120 * S);
}
