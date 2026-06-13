// =====================================================================
// entities.js — jugador, enemigos, proyectiles, pickups y combate.
// Los comportamientos ('chaser', 'shooter', 'erratic', 'boss') son
// reutilizables: cualquier enemigo nuevo en data.js los hereda.
// =====================================================================

function makePlayer(clsId) {
  const cls = CLASSES[clsId];
  const p = {
    cls: clsId, x: 0, y: 0, w: 10, h: 10,
    // caja de colision a los pies (centro en y+colDY, alto colH): te pegas a muros/
    // cofres desde el sur. Subir colDY o bajar colH = mas pegado.
    colDY: 5, colH: 6,
    hp: cls.hp, stats: null,
    equip: { arma: makeStarterWeapon(cls.weapon), casco: null, coraza: null, botas: null, anillo: null, amuleto: null,
      foco: null, guantes: null, cinturon: null, anillo2: null },
    bag: Array(BALANCE.bagSize).fill(null), coins: 0, potions: 1, manaPotions: 1,
    mana: 0, noCastT: 0,
    level: 1, xp: 0, xpNext: 25,
    bonus: { hp: 0, spd: 0, crit: 0, atkspd: 0, def: 0, dmgMul: 1 },
    atkCd: 0, ifr: 0, stunT: 0, dir: 1,
    dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0,
    kbx: 0, kby: 0,
    swingT: 0, swingAng: 0,
  };
  calcStats(p);
  p.hp = p.stats.maxhp;
  p.mana = p.stats.maxMana;
  return p;
}

function spawnEnemy(typeId, x, y, depth, isBossType, elite) {
  const def = isBossType ? BOSSES[typeId] : ENEMIES[typeId];
  let hpMul = 1 + (depth - 1) * BALANCE.depthHpScale;
  let dmgMul = 1 + (depth - 1) * BALANCE.depthDmgScale;
  if (elite) { hpMul *= 2.2; dmgMul *= 1.5; } // élite: mini-jefe con aura
  return {
    type: typeId, def, x, y, elite: !!elite,
    w: def.size, h: def.size,
    hp: Math.round(def.hp * hpMul), maxhp: Math.round(def.hp * hpMul),
    dmg: Math.round(def.dmg * dmgMul),
    spd: def.spd * (elite ? 1.05 : 1) * BALANCE.speedMul, ai: isBossType ? 'boss' : def.ai,
    dir: 1, flashT: 0, hitCd: 0, fireT: Math.random() * 1.5,
    kbx: 0, kby: 0, wobble: Math.random() * Math.PI * 2,
    // hogar (para wander y leash) + pausas de ataque
    hx: x, hy: y, wanderT: Math.random() * 2, wvx: 0, wvy: 0,
    pauseT: 0, windupT: 0, aimAng: 0,
    isBoss: !!isBossType, scale: (def.scale || 1) * (elite ? 1.2 : 1),
    // estado de jefe
    pattern: 0, patT: 2.5, subT: 0, chargeVX: 0, chargeVY: 0, charging: false, telegraphT: 0,
    hasBall: def.kicksBall ? true : undefined, ballPos: null,
  };
}

// ---------------- Actualización de enemigos ----------------

// --- pathfinding: campo de flujo (BFS desde el jugador) + línea de visión ---
let _flow = null;
function buildFlow(lvl, px, py) {
  const W = lvl.W, H = lvl.H, sx = Math.floor(px / TILE), sy = Math.floor(py / TILE);
  if (_flow && _flow.lvl === lvl && _flow.sx === sx && _flow.sy === sy) return;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H || tileSolid(lvl, sx, sy)) { _flow = null; return; }
  const dist = new Int16Array(W * H); dist.fill(-1);
  const q = [sy * W + sx]; dist[sy * W + sx] = 0;
  const MAX = 32;
  for (let head = 0; head < q.length; head++) {
    const cur = q[head], cd = dist[cur];
    if (cd >= MAX) continue;
    const cx = cur % W, cy = (cur / W) | 0;
    const nx = [cx + 1, cx - 1, cx, cx], ny = [cy, cy, cy + 1, cy - 1];
    for (let k = 0; k < 4; k++) {
      if (nx[k] < 0 || nx[k] >= W || ny[k] < 0 || ny[k] >= H) continue;
      const ni = ny[k] * W + nx[k];
      if (dist[ni] !== -1 || tileSolid(lvl, nx[k], ny[k])) continue;
      dist[ni] = cd + 1; q.push(ni);
    }
  }
  _flow = { dist, W, lvl, sx, sy };
}
// siguiente paso ortogonal hacia el jugador, descendiendo el gradiente del campo
function flowStep(lvl, e) {
  if (!_flow) return null;
  const W = _flow.W, dist = _flow.dist;
  const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE);
  if (ex < 0 || ey < 0 || ex >= lvl.W || ey >= lvl.H) return null;
  const here = dist[ey * W + ex];
  if (here <= 0) return null; // fuera del campo, o ya sobre el jugador
  let best = null, bestD = here;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [ddx, ddy] of dirs) {
    const nx = ex + ddx, ny = ey + ddy;
    if (nx < 0 || ny < 0 || nx >= lvl.W || ny >= lvl.H) continue;
    const d = dist[ny * W + nx];
    if (d >= 0 && d < bestD) { bestD = d; best = [ddx, ddy]; }
  }
  return best;
}
// línea de visión: false si una pared corta el segmento enemigo→jugador
function hasLOS(lvl, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, dlen = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(dlen / (TILE * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (tileSolid(lvl, Math.floor((x0 + dx * t) / TILE), Math.floor((y0 + dy * t) / TILE))) return false;
  }
  return true;
}

function updateEnemies(dt) {
  const p = state.player, lvl = state.level;
  buildFlow(lvl, p.x, p.y);
  for (const e of state.enemies) {
    e.flashT = Math.max(0, e.flashT - dt);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.atkAnimT = Math.max(0, (e.atkAnimT || 0) - dt);
    e.wobble += dt * 6;

    // knockback
    if (Math.abs(e.kbx) > 1 || Math.abs(e.kby) > 1) {
      moveWithCollision(lvl, e, e.kbx * dt, e.kby * dt, e.def.ghost);
      e.kbx *= Math.pow(0.0001, dt); e.kby *= Math.pow(0.0001, dt);
    }

    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    // aggro: el jugador en la sala del enemigo (o muy cerca, p.ej. pasillo).
    // Una vez en contacto persigue 1.5 s más; si te vas de la sala, deja de seguir.
    const los = e.def.ghost || hasLOS(lvl, e.x, e.y, p.x, p.y);
    let inContact = dist < BALANCE.aggroRadius * TILE;
    if (e.room) {
      const ptx = p.x / TILE, pty = p.y / TILE, r = e.room;
      if (ptx >= r.x - 1 && ptx <= r.x + r.w && pty >= r.y - 1 && pty <= r.y + r.h) inContact = true;
    } else if (dist < BALANCE.aggroRadiusOpen * TILE) inContact = true; // sin sala (arena/llave): radio
    if (!los) inContact = false; // no te detecta a través de paredes (pero si ya te vio, te persigue rodeando)
    // leash: demasiado lejos de su origen → suelta al jugador y vuelve a casa
    const homeD = e.isBoss ? 0 : Math.hypot(e.hx - e.x, e.hy - e.y);
    const leashed = !e.isBoss && homeD > BALANCE.leashTiles * TILE;
    if (leashed) e.aggroT = 0;
    else if (inContact) e.aggroT = 1.5;
    else e.aggroT = Math.max(0, (e.aggroT || 0) - dt);
    const aggro = e.isBoss || e.aggroT > 0;

    // anticipación de disparo: clavado apuntando; al expirar, dispara al ángulo congelado
    if (e.windupT > 0) {
      e.windupT -= dt;
      if (e.windupT <= 0) {
        e.windupT = 0;
        fireProj({ x: e.x, y: e.y, ang: e.aimAng, spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: e.def.projColor || '#ff7b5a', style: e.def.projStyle, range: e.def.range + 50 });
        sfx('eshoot');
      }
    }

    // pausa de ataque (anticipación o recovery): clavado, no se mueve ni decide
    if (e.pauseT > 0) {
      e.pauseT -= dt;
      e.dir = dx >= 0 ? 1 : -1;
    } else if (aggro) {
      if (e.ai === 'chaser') {
        // pathfinding: sigue el campo de flujo (camino ortogonal más corto, rodea paredes)
        const step = flowStep(lvl, e);
        if (step) {
          moveWithCollision(lvl, e, step[0] * e.spd * dt, step[1] * e.spd * dt, e.def.ghost);
        } else {
          // fallback (fuera del campo de flujo): persecución ortogonal greedy
          const stepX = Math.abs(dx) >= Math.abs(dy), ox = e.x, oy = e.y;
          if (stepX) moveWithCollision(lvl, e, Math.sign(dx) * e.spd * dt, 0, e.def.ghost);
          else moveWithCollision(lvl, e, 0, Math.sign(dy) * e.spd * dt, e.def.ghost);
          if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) {
            if (stepX) moveWithCollision(lvl, e, 0, Math.sign(dy) * e.spd * dt, e.def.ghost);
            else moveWithCollision(lvl, e, Math.sign(dx) * e.spd * dt, 0, e.def.ghost);
          }
        }
      } else if (e.ai === 'erratic') {
        const wob = Math.sin(e.wobble) * 0.6;
        const ang = Math.atan2(dy, dx) + wob;
        moveWithCollision(lvl, e, Math.cos(ang) * e.spd * dt, Math.sin(ang) * e.spd * dt, e.def.ghost);
      } else if (e.ai === 'shooter') {
        // mantener distancia y disparar
        const ideal = e.def.range * 0.65;
        const dirMove = dist > e.def.range ? 1 : (dist < ideal ? -1 : 0);
        if (dirMove !== 0)
          moveWithCollision(lvl, e, (dx / dist) * e.spd * dt * dirMove, (dy / dist) * e.spd * dt * dirMove, e.def.ghost);
        e.fireT -= dt;
        if (e.fireT <= 0 && dist < e.def.range + 40) {
          e.fireT = e.def.fireCd;
          // anticipación: apunta, se clava y telegrafia; el disparo sale al expirar windupT
          e.aimAng = Math.atan2(dy, dx);
          e.windupT = BALANCE.shooterWindup;
          if (e.def.slime) e.atkAnimT = BALANCE.shooterWindup + 0.25; // anim de casteo del sheet-mob
          e.pauseT = BALANCE.shooterWindup + BALANCE.shooterRecover;
          state.fx.push({ type: 'ring', x: e.x, y: e.y, t: BALANCE.shooterWindup, t0: BALANCE.shooterWindup, maxR: 12, color: '#ff7b5a' });
        }
      } else if (e.ai === 'boss') {
        updateBoss(e, dt, dist, dx, dy);
      }
      e.dir = dx >= 0 ? 1 : -1;
    } else if (!e.isBoss) {
      // sin aggro: si quedó lejos de casa (persiguió y soltó), vuelve; si no, deambula
      if (homeD > BALANCE.wanderHome * TILE) {
        // vuelve en escalera (como el chaser); si quedó encerrado, este lugar pasa a ser su hogar
        const hdx = e.hx - e.x, hdy = e.hy - e.y;
        const stepX = Math.abs(hdx) >= Math.abs(hdy);
        const ox = e.x, oy = e.y, s = e.spd * 0.8 * dt;
        if (stepX) moveWithCollision(lvl, e, Math.sign(hdx) * s, 0, e.def.ghost);
        else moveWithCollision(lvl, e, 0, Math.sign(hdy) * s, e.def.ghost);
        if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) {
          if (stepX) moveWithCollision(lvl, e, 0, Math.sign(hdy) * s, e.def.ghost);
          else moveWithCollision(lvl, e, Math.sign(hdx) * s, 0, e.def.ghost);
        }
        if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) { e.hx = e.x; e.hy = e.y; }
        e.dir = hdx >= 0 ? 1 : -1;
        e.wanderT = 0; // al llegar, re-decide
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          // decide: quedarse quieto o caminar un trecho en una dirección al azar
          if (Math.random() < 0.45) { e.wvx = 0; e.wvy = 0; e.wanderT = 0.8 + Math.random() * 1.6; }
          else {
            const a = Math.random() * Math.PI * 2;
            e.wvx = Math.cos(a); e.wvy = Math.sin(a);
            e.wanderT = 0.5 + Math.random() * 1.0;
          }
        }
        if (e.wvx || e.wvy) {
          const ws = e.spd * BALANCE.wanderSpeed;
          const ox = e.x, oy = e.y;
          moveWithCollision(lvl, e, e.wvx * ws * dt, e.wvy * ws * dt, e.def.ghost);
          if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) e.wanderT = 0; // pared: re-decide
          e.dir = e.wvx >= 0 ? 1 : -1;
        }
      }
    }

    // daño por contacto
    if (e.hitCd <= 0 && Math.abs(dx) < (e.w + p.w) / 2 && Math.abs(dy) < (e.h + p.h) / 2) {
      e.hitCd = 0.8;
      const eraVulnerable = p.ifr <= 0;
      if (e.def.skel) e.atkAnimT = 0.46; // dispara la animación de golpe del esqueleto
      if (e.def.slime) e.atkAnimT = 0.7; // animación de ataque de los sheet-mobs (slime/lich/orc…)
      damagePlayer(e.dmg);
      // recovery: tras golpear se queda clavado un instante (los jefes siguen su patrón)
      if (!e.isBoss) e.pauseT = Math.max(e.pauseT, BALANCE.attackPause);
      // tackle: si te alcanza en plena carga, quedás tirado en el piso
      if (eraVulnerable && e.charging && e.def.stunOnCharge) {
        p.stunT = e.def.stunOnCharge;
        p.ifr = Math.max(p.ifr, e.def.stunOnCharge + 0.2); // que no te pisen mientras estás caído
        const ang = Math.atan2(e.chargeVY, e.chargeVX);
        moveWithCollision(state.level, p, Math.cos(ang) * 12, Math.sin(ang) * 12, false);
        e.charging = false; e.patT = 1.2; // el tackle frena su carrera
        addFloater(p.x, p.y - 16, '¡Tackleado!', '#ffd84f', true);
        shake(6);
        sfx('tackle');
      }
    }
  }
}

function updateBoss(e, dt, dist, dx, dy) {
  const lvl = state.level, p = state.player;

  // Segunda fase: al 50% de vida el jefe enfurece
  if (!e.enraged && e.hp <= e.maxhp * 0.5) {
    e.enraged = true;
    e.spd *= 1.3;
    burst(e.x, e.y, '#ff4040', 24);
    shake(5);
    bigToast('¡' + e.def.name.toUpperCase() + ' ENFURECE!');
    sfx('tackle');
  }

  // Sin su pelota el jefe no ataca: primero mira el vuelo de la patada y
  // después corre a buscarla — ahí es vulnerable (recibe daño extra).
  if (e.hasBall === false) {
    if (!e.ballPos) return; // la pelota todavía está en el aire
    const bx = e.ballPos.x - e.x, by = e.ballPos.y - e.y;
    const bd = Math.hypot(bx, by) || 1;
    moveWithCollision(lvl, e, (bx / bd) * e.spd * 1.15 * dt, (by / bd) * e.spd * 1.15 * dt, false);
    if (bd < 12) {
      e.hasBall = true; e.ballPos = null; e.patT = 2;
      addFloater(e.x, e.y - 20, '¡Recuperó la pelota!', '#9a5c28', false);
    }
    return;
  }

  e.patT -= dt;
  if (e.patT <= 0 && !e.charging) {
    e.pattern = (e.pattern + 1) % e.def.patterns.length;
    e.patT = e.enraged ? 2.3 : 3.2; // furioso rota patrones más rápido
    e.subT = 0; e.telegraphT = 0; e.chained = false;
  }
  const pat = e.def.patterns[e.pattern];

  const handler = BOSS_PATTERN_HANDLERS[pat];
  if (handler) handler(e, dt, { lvl, dist, dx, dy });
}

const BOSS_PATTERN_HANDLERS = {
  chase(e, dt, ctx) {
    moveWithCollision(ctx.lvl, e, (ctx.dx / ctx.dist) * e.spd * dt, (ctx.dy / ctx.dist) * e.spd * dt, false);
  },
  burst(e, dt, ctx) {
    moveWithCollision(ctx.lvl, e, (ctx.dx / ctx.dist) * e.spd * 0.3 * dt, (ctx.dy / ctx.dist) * e.spd * 0.3 * dt, false);
    e.subT -= dt;
    if (e.subT > 0) return;
    e.subT = 1.1;
    const n = 12, off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++)
      fireProj({ x: e.x, y: e.y, ang: off + (i / n) * Math.PI * 2, spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: '#ff5a8a', range: e.def.projRange || 170 });
    sfx('eshoot');
  },
  spread(e, dt, ctx) {
    e.subT -= dt;
    if (e.subT > 0) return;
    e.subT = 0.65;
    const base = Math.atan2(ctx.dy, ctx.dx);
    for (const o of [-0.25, 0, 0.25])
      fireProj({ x: e.x, y: e.y, ang: base + o, spd: e.def.projSpd * 1.2, dmg: e.dmg, friendly: false, color: '#ffb15a', range: e.def.projRange || 170 });
    sfx('eshoot');
  },
  charge(e, dt, ctx) {
    if (!e.charging && e.telegraphT === 0) e.telegraphT = 0.55; // telegrafiar
    if (e.telegraphT > 0) {
      e.telegraphT -= dt;
      if (e.telegraphT <= 0) {
        e.charging = true;
        e.chargeVX = (ctx.dx / ctx.dist) * e.spd * 4.5;
        e.chargeVY = (ctx.dy / ctx.dist) * e.spd * 4.5;
      }
    }
    if (!e.charging) return;
    const ox = e.x, oy = e.y;
    moveWithCollision(ctx.lvl, e, e.chargeVX * dt, e.chargeVY * dt, false);
    // estela de polvo cada ~70 ms, detrás de la dirección de carga
    e.dustT = (e.dustT || 0) - dt;
    if (e.dustT <= 0) {
      e.dustT = 0.07;
      const dn = Math.hypot(e.chargeVX, e.chargeVY) || 1;
      state.fx.push({ type: 'dust', x: e.x - (e.chargeVX / dn) * 6, y: e.y + 6,
        start: state.time, t: 0.28, t0: 0.28 });
    }
    if (Math.abs(e.x - ox) < 0.1 && Math.abs(e.y - oy) < 0.1) { // chocó con pared
      e.charging = false; shake(5);
      if (e.enraged && !e.chained) {
        e.chained = true; e.telegraphT = 0.35; // furioso: encadena una segunda embestida
      } else {
        e.chained = false; e.patT = 0;
      }
    }
  },
  kickball(e, dt, ctx) {
    // patea SU pelota hacia el jugador; donde caiga, irá a buscarla
    if (e.subT === 0) {
      e.subT = 0.37; // windup: la pelota sale al inicio del frame 2 (250+120 ms)
      e.kickStart = state.time;
      return;
    }
    e.subT -= dt;
    if (e.subT > 0 || !e.hasBall) return;
    e.subT = 999; // una sola patada por ciclo
    fireProj({ x: e.x, y: e.y, ang: Math.atan2(ctx.dy, ctx.dx), spd: 240,
      dmg: Math.round(e.dmg * 1.2), friendly: false, style: 'rugbyball', life: 0.6, owner: e });
    e.hasBall = false;
    addFloater(e.x, e.y - 24, '¡Patada!', '#ffd84f', false);
    sfx('kick');
  },
  summon(e, dt) {
    e.subT -= dt;
    if (e.subT > 0) return;
    e.subT = 2.2;
    if (state.enemies.length < 8 && e.def.minion) {
      const ang = Math.random() * Math.PI * 2;
      const m = spawnEnemy(e.def.minion, e.x + Math.cos(ang) * 30, e.y + Math.sin(ang) * 30, state.run.depth);
      state.enemies.push(m);
      burst(m.x, m.y, '#b14fff', 8);
      sfx('summon');
    }
  },
};

// ---------------- Proyectiles ----------------

function fireProj(o) {
  // o.range (px) limita el alcance: vida = distancia / velocidad
  const life = o.range ? o.range / o.spd : (o.life || 2.2);
  state.projs.push({
    x: o.x, y: o.y,
    vx: Math.cos(o.ang) * o.spd, vy: Math.sin(o.ang) * o.spd,
    ang: o.ang, dmg: o.dmg, friendly: o.friendly,
    color: o.color || '#fff', style: o.style || 'dot',
    splash: o.splash || 0, crit: o.crit || false,
    life, dead: false, t: 0, trailT: 0, owner: o.owner || null,
    pierce: o.pierce || 0, hitSet: null, size: o.size || 6,
    // MODELO 2.5D con eje Z falso: el proyectil VIVE en (x,y) sobre el plano del piso
    // (ahi colisiona, muros y enemigos) y z = altura sobre el piso. Se DIBUJA en y - z
    // y la sombra queda en el piso (x,y). vz/gravity dan arcos (flechas, magia que cae);
    // con ambos en 0 vuela plano a altura z constante (el orbe del mago).
    z: o.z || 0, vz: o.vz || 0, gravity: o.gravity || 0,
  });
}

function updateProjectiles(dt) {
  const p = state.player, lvl = state.level;
  for (const pr of state.projs) {
    if (pr.dead) continue;
    pr.px = pr.x; pr.py = pr.y;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    // eje Z: sólo si el proyectil tiene movimiento vertical (arcos). El orbe recto
    // (vz=0, gravity=0) mantiene su z constante y saltea esto.
    if (pr.vz || pr.gravity) {
      pr.z += pr.vz * dt;
      pr.vz -= pr.gravity * dt;
      if (pr.z <= 0) { // tocó el piso: estalla donde cayó
        pr.z = 0; pr.dead = true;
        if (pr.splash) explode(pr); else burst(pr.x, pr.y, pr.color, 3);
        continue;
      }
    }
    pr.life -= dt;
    pr.t += dt;
    if (pr.life <= 0) {
      // al llegar a destino: el orbe con área estalla (animación + splash); el resto chisporrotea
      pr.dead = true;
      if (pr.splash) explode(pr);
      else burst(pr.x, pr.y - pr.z, pr.color, 3);
      continue;
    }

    // estela de chispas arcanas del orbe del mago
    if (pr.style === 'bolt') {
      pr.trailT -= dt;
      if (pr.trailT <= 0) {
        pr.trailT = 0.016;
        state.particles.push({
          // la estela nace a la ALTURA VISUAL del orbe (pr.y - z), no en el piso
          x: pr.x + (Math.random() - 0.5) * 3, y: pr.y - pr.z + (Math.random() - 0.5) * 3,
          vx: -pr.vx * 0.06 + (Math.random() - 0.5) * 14,
          vy: -pr.vy * 0.06 + (Math.random() - 0.5) * 14,
          t: 0.22 + Math.random() * 0.18,
          color: Math.random() < 0.55 ? '#7ec8ff' : '#b14fff', glow: true,
        });
      }
    }
    // estela sutil de la flecha
    else if (pr.style === 'arrow' && pr.friendly) {
      pr.trailT -= dt;
      if (pr.trailT <= 0) {
        pr.trailT = 0.03;
        state.particles.push({
          x: pr.x, y: pr.y,
          vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
          t: 0.16, color: '#e8d8a0', glow: true,
        });
      }
    }
    if (rectHitsWall(lvl, pr.x, pr.y, Math.max(4, pr.size - 4), Math.max(4, pr.size - 4))) {
      pr.dead = true;
      if (pr.splash) explode(pr);
      else burst(pr.x, pr.y - pr.z, pr.color, 3);
      continue;
    }
    if (pr.friendly) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (pr.hitSet && pr.hitSet.has(e)) continue; // la ballesta no pega dos veces al mismo
        const r = (e.w * e.scale + pr.size) / 2;
        // golpe horizontal (x/y del piso) + vertical (z dentro de la altura del bicho;
        // sin e.height definido golpea a toda altura -> idéntico a antes)
        if (Math.abs(pr.x - e.x) < r && Math.abs(pr.y - e.y) < r && pr.z <= (e.height || 1e9)) {
          if (pr.splash) { pr.dead = true; explode(pr); break; }
          damageEnemy(e, pr.dmg, pr.crit, pr.vx * 0.4, pr.vy * 0.4);
          if (pr.pierce > 0) {
            pr.pierce--;
            if (!pr.hitSet) pr.hitSet = new Set();
            pr.hitSet.add(e);
          } else {
            pr.dead = true;
            break;
          }
        }
      }
    } else {
      if (p.ifr <= 0 && Math.abs(pr.x - p.x) < (p.w + 6) / 2 && Math.abs(pr.y - p.y) < (p.h + 6) / 2) {
        pr.dead = true;
        damagePlayer(pr.dmg);
      }
    }
  }
  // la pelota de rugby queda tirada donde murió el proyectil
  for (const pr of state.projs) {
    if (pr.dead && pr.style === 'rugbyball' && pr.owner && pr.owner.hasBall === false) {
      pr.owner.ballPos = { x: pr.px !== undefined ? pr.px : pr.x, y: pr.py !== undefined ? pr.py : pr.y };
    }
  }
  state.projs = state.projs.filter(pr => !pr.dead);
}

// Explosión con área (bastón de mago)
function explode(pr) {
  // vy = altura VISUAL del orbe (piso + lift); el destello sale ahí. El DAÑO en área
  // (más abajo) usa pr.y = plano del piso, donde están los enemigos.
  const vy = pr.y - pr.z;
  // destello de luz: ilumina el área un instante y se desvanece (se nota en pisos oscuros)
  state.fx.push({ type: 'lightburst', x: pr.x, y: vy, t: 0.95, t0: 0.95, r: 74 });
  const v2boom = typeof V2H !== 'undefined' && V2H.ready && V2H.fx.boom.length;
  if (v2boom) {
    // explosión sprite del energyblast: trae sus propios anillos horneados —
    // los anillos/flash del motor (el "arco blanco") se omiten para no duplicar
    state.fx.push({ type: 'v2boom', x: pr.x, y: vy, start: state.time, t: 0.5, t0: 0.5 });
  } else {
    // fallback por código: destello + onda expansiva
    state.fx.push({ type: 'flash', x: pr.x, y: vy, t: 0.12, t0: 0.12, r: Math.max(10, pr.splash * 0.8) });
    state.fx.push({ type: 'ring', x: pr.x, y: vy, t: 0.32, t0: 0.32, maxR: pr.splash + 10, color: '#9ad8ff' });
    state.fx.push({ type: 'ring', x: pr.x, y: vy, t: 0.45, t0: 0.45, maxR: pr.splash * 0.6, color: '#b14fff' });
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 110;
    state.particles.push({
      x: pr.x, y: vy, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0.25 + Math.random() * 0.35,
      color: ['#7ec8ff', '#b14fff', '#ffffff'][i % 3], glow: true,
    });
  }
  shake(2);
  sfx('boom');
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - pr.x, e.y - pr.y);
    if (d < pr.splash + e.w) {
      const fall = d < pr.splash * 0.5 ? 1 : 0.6;
      damageEnemy(e, Math.round(pr.dmg * fall), pr.crit, (e.x - pr.x) * 3, (e.y - pr.y) * 3);
    }
  }
}

// ---------------- Ataques del jugador ----------------

function playerAttack(aimAng) {
  const p = state.player;
  if (p.atkCd > 0) return;
  const wt = weaponDef(p);
  // los hechizos consumen maná: sin maná suficiente no se castea (ni gasta cooldown)
  if (wt.style === 'bolt' && (p.mana || 0) < (wt.manaCost || 0)) return;
  p.atkCd = attackCooldown(p);
  // sólo melee hace el golpe del cuerpo; magia/distancia no "cortan"
  if (wt.style === 'melee') p.attackT = 0.30;
  const crit = Math.random() * 100 < p.stats.crit;
  const dmg = Math.round(playerDamage(p) * (crit ? 2 : 1));

  if (wt.style === 'melee') {
    p.swingT = 0.16; p.swingAng = aimAng;
    p.swingFlip = !p.swingFlip; // tajos alternados (revés y derecho)
    p.swingDir = p.swingFlip ? 1 : -1;
    sfx('swing');
    let hitAny = false;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > wt.range + e.w * e.scale / 2) continue;
      let diff = Math.atan2(e.y - p.y, e.x - p.x) - aimAng;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 1.15) {
        damageEnemy(e, dmg, crit, Math.cos(aimAng) * 160, Math.sin(aimAng) * 160);
        // chispas metálicas en el impacto
        for (let i = 0; i < 6; i++) {
          const a = aimAng + (Math.random() - 0.5) * 1.4;
          const v = 60 + Math.random() * 120;
          state.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            t: 0.15 + Math.random() * 0.15, color: i % 2 ? '#ffffff' : '#ffd84f', glow: true });
        }
        hitAny = true;
      }
    }
    if (hitAny) sfx('hit');
  } else if (wt.style === 'smash') {
    // martillazo: golpe circular que daña todo alrededor
    p.swingT = 0.18; p.swingAng = aimAng;
    p.swingFlip = !p.swingFlip; p.swingDir = p.swingFlip ? 1 : -1;
    state.fx.push({ type: 'ring', x: p.x, y: p.y, t: 0.25, t0: 0.25, maxR: wt.range + 4, color: '#c4ccd6' });
    shake(3);
    sfx('smash');
    let hitAny = false;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > wt.range + e.w * e.scale / 2) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      damageEnemy(e, dmg, crit, Math.cos(ang) * 220, Math.sin(ang) * 220);
      hitAny = true;
    }
    if (hitAny) sfx('hit');
  } else if (wt.style === 'arrow') {
    // sale de la punta del arma, no del cuerpo
    const mx = p.x + Math.cos(aimAng) * 16, my = p.y - 6 + Math.sin(aimAng) * 16;
    fireProj({ x: mx, y: my, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#e8d8a0', style: 'arrow', crit, pierce: wt.pierce || 0, wallDY: (p.y + 5) - my });
    // chasquido de la cuerda: destello corto en la boca del arco
    const hx = p.x + Math.cos(aimAng) * 9, hy = p.y + Math.sin(aimAng) * 9;
    for (let i = 0; i < 4; i++) {
      const a = aimAng + (Math.random() - 0.5) * 0.5;
      const v = 80 + Math.random() * 60;
      state.particles.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: 0.12, color: '#ffffff', glow: true });
    }
    sfx('shoot');
  } else if (wt.style === 'bolt') {
    // el hechizo sale de la punta del bastón/varita, no del cuerpo
    p.mana = Math.max(0, (p.mana || 0) - (wt.manaCost || 0)); p.noCastT = 0;
    p._staffCastStart = state.time;
    const tip = p._v2StaffTip || null;
    // muzzle VISUAL: la punta del bastón (elevada). Sirve para el destello y para el
    // lift del dibujo del proyectil.
    const visX = tip ? tip.x : p.x + Math.cos(aimAng) * 16;
    const visY = tip ? tip.y : p.y - 6 + Math.sin(aimAng) * 16;
    // posición en el PLANO DEL PISO: el orbe vive y colisiona acá (pies del mago,
    // adelantado en la dirección de tiro). drawDY eleva sólo el dibujo hasta la punta.
    const groundX = visX;
    const groundY = p.y + 5 + Math.sin(aimAng) * 6;
    // altura del orbe sobre el piso. Nace de la punta del bastón pero ACOTADA: si no,
    // en diagonales pronunciadas z se dispara (apuntando arriba dio 21) y el orbe se
    // dibuja muy por encima de donde colisiona -> "para mucho antes" contra un muro.
    // Acotada a [2,12] el desfase perpendicular es chico y el remate del muro lo tapa.
    const z = Math.max(2, Math.min(12, groundY - visY));
    // en desktop el orbe termina donde apuntás (no sigue de largo); tope = alcance del arma
    let boltRange = wt.projRange;
    if (!touch.enabled) {
      const cd = Math.hypot(mouseWorldX() - groundX, mouseWorldY() - groundY);
      // recorre un mínimo aunque apuntes cerca (no estalla pegado al mago); tope = alcance del arma
      boltRange = Math.max(50, Math.min(wt.projRange, cd));
    }
    fireProj({ x: groundX, y: groundY, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#7ec8ff', style: 'bolt', splash: wt.splash, crit, size: wt.projSize || 6, range: boltRange, z });
    // destello de lanzamiento en la punta del bastón (posición visual)
    const hx = visX, hy = visY;
    for (let i = 0; i < 5; i++) {
      const a = aimAng + (Math.random() - 0.5) * 1.2, s = 30 + Math.random() * 50;
      state.particles.push({ x: hx, y: hy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.15 + Math.random() * 0.1, color: Math.random() < 0.5 ? '#9ad8ff' : '#b14fff', glow: true });
    }
    sfx('cast');
  }
}

// ---------------- Daño ----------------

function damageEnemy(e, dmg, crit, kx, ky) {
  // punto débil: un jefe sin su pelota recibe daño extra
  const weak = e.isBoss && e.hasBall === false;
  if (weak) dmg = Math.round(dmg * 1.75);
  e.hp -= dmg;
  e.aggroT = Math.max(e.aggroT || 0, 4); // si le pegás, viene a buscarte (aunque no te haya visto)
  e.flashT = 0.1;
  e.kbx += (kx || 0) * (e.isBoss ? 0.15 : 1);
  e.kby += (ky || 0) * (e.isBoss ? 0.15 : 1);
  addFloater(e.x, e.y - e.h, String(dmg), crit ? '#ffd84f' : weak ? '#ffb15a' : '#fff', crit || weak);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  state.run.kills++;
  // jefes con pack de anims: dejan su animación de derrota en el piso
  if (e.isBoss && e.def.anims) {
    state.fx.push({ type: 'corpse', anims: e.def.anims, x: e.x, y: e.y,
      dir: e.dir, scale: e.scale, t: 4.5, t0: 4.5, start: state.time });
  }
  burst(e.x, e.y, e.isBoss ? '#ffd84f' : '#c44', e.isBoss ? 30 : 8);
  // sonido de muerte por tipo: esqueletos crujen huesos, rata chilla, resto genérico
  sfx(e.isBoss ? 'bossdie' : (e.def.skel ? 'skel_death' : (e.type === 'rata' ? 'rat_death' : 'die')));
  dropLoot(e);
  if (e.isBoss) onBossKilled(e);
  state.enemies = state.enemies.filter(o => o !== e);
}

function damagePlayer(dmg) {
  const p = state.player;
  if (p.ifr > 0 || p.dashT > 0 || state.mode !== 'play') return; // el dash esquiva todo
  const real = applyDefense(dmg, p.stats.def);
  p.hp -= real;
  p.ifr = BALANCE.playerIfr;
  p.hurtT = 0.26; // animación de recoil + flash de daño
  addFloater(p.x, p.y - 12, String(real), '#ff6b6b', false);
  shake(4);
  sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; onPlayerDeath(); }
}

// ---------------- Loot ----------------

function dropLoot(e) {
  const depth = state.run.depth;
  // el portador de la llave siempre la suelta
  if (e.keyCarrier) spawnPickup('key', e.x, e.y);
  // orbes de experiencia: siempre, escalan con la dureza del bicho
  const orbs = e.isBoss ? 12 : Math.min(8, 2 + Math.floor(e.maxhp / 25)) + (e.elite ? 4 : 0);
  for (let i = 0; i < orbs; i++) {
    const pk = spawnPickup('xp', e.x + randInt(-12, 12), e.y + randInt(-12, 12));
    pk.val = e.isBoss ? 6 : e.elite ? 4 : 2;
    pk.xpColor = XP_COLORS[(Math.random() * XP_COLORS.length) | 0]; // color al azar (mezcla)
  }
  // los élite siempre sueltan un ítem
  if (e.elite) {
    spawnPickup('item', e.x, e.y, makeItem(depth + 1));
    spawnPickup('coin', e.x, e.y).val = randInt(6, 12) + depth * 2;
    return;
  }
  if (e.isBoss) {
    // los jefes siempre sueltan un ítem bueno + monedas
    const it = makeItem(depth + 2);
    if (it.rarity === 'comun' || it.rarity === 'magico') it.rarity = 'raro';
    spawnPickup('item', e.x, e.y, makeItemRespectRarity(it, depth));
    spawnPickup('coin', e.x, e.y).val = randInt(40, 70) + depth * 5;
    spawnPickup('heart', e.x + randInt(-10, 10), e.y + 16);
    return;
  }
  // monedas: cantidad random escalada con la dureza del bicho — los fáciles dan
  // menos, los duros más. Base ~ maxhp/14 (rata≈1, esqueleto≈2, gólem≈5, caballero≈6),
  // luego un rango random para que varíe entre kills del mismo enemigo.
  const coinBase = Math.max(1, Math.round((e.maxhp || 14) / 14));
  const coinCount = randInt(coinBase, coinBase * 2 + 1);
  // una sola pila con el valor acumulado; el sprite escala por tier (pocas→miles)
  spawnPickup('coin', e.x + randInt(-8, 8), e.y + randInt(-8, 8)).val = coinCount;
  // drop extra (ítem / corazón / poción) — las monedas ya se resolvieron arriba
  const r = Math.random();
  if (r < BALANCE.dropItem) spawnPickup('item', e.x, e.y, makeItem(depth));
  else if (r < BALANCE.dropItem + BALANCE.dropHeart) spawnPickup('heart', e.x, e.y);
  else if (r < BALANCE.dropItem + BALANCE.dropHeart + BALANCE.dropPotion) spawnPickup('potion', e.x, e.y);
  else if (r < BALANCE.dropItem + BALANCE.dropHeart + BALANCE.dropPotion * 2) spawnPickup('manapotion', e.x, e.y);
}

// re-tirar mods si subimos la rareza del drop de jefe
function makeItemRespectRarity(proto, depth) {
  const minIdx = Math.max(0, RARITIES.findIndex(r => r.id === proto.rarity));
  let best = proto;
  for (let i = 0; i < 12; i++) {
    const it = makeItem(depth + 2, proto.slot);
    const idx = RARITIES.findIndex(r => r.id === it.rarity);
    if (idx >= minIdx) return it;
    if (idx > RARITIES.findIndex(r => r.id === best.rarity)) best = it;
  }
  best.rarity = RARITIES[minIdx].id;
  return best;
}

function spawnPickup(kind, x, y, item) {
  // al soltarse, el drop salta un poco hacia arriba y al costado y cae seco al piso
  const pk = { kind, x, y, item: item || null, t: Math.random() * Math.PI * 2, noPickT: 0.4,
    hz: 4, vz: 55 + Math.random() * 55,                       // altura/velocidad del salto
    sx: (Math.random() * 2 - 1) * 24, sy: (Math.random() * 2 - 1) * 24, // dispersión lateral (juntos)
    settled: false };
  state.pickups.push(pk);
  return pk;
}

function updatePickups(dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.t += dt * 4;
    pk.noPickT = Math.max(0, pk.noPickT - dt);
    // fase de salto: sube, cae por gravedad y se asienta seco; no se levanta ni se imanta mientras tanto
    if (!pk.settled) {
      pk.hz += pk.vz * dt; pk.vz -= 320 * dt;
      pk.x += pk.sx * dt; pk.y += pk.sy * dt;
      const fr = Math.pow(0.015, dt); pk.sx *= fr; pk.sy *= fr;
      if (pk.hz <= 0 && pk.vz <= 0) { pk.hz = 0; pk.vz = 0; pk.sx = 0; pk.sy = 0; pk.settled = true; }
      continue;
    }
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (pk.noPickT > 0) continue;
    // los orbes de XP se magnetizan hacia el personaje desde lejos
    if (pk.kind === 'xp' && d < 38 && d > 0.1) {
      const pull = 90 + (38 - d) * 5;
      pk.x += dx / d * pull * dt; pk.y += dy / d * pull * dt;
    }
    // imán suave: no atrae lo que no se puede levantar ahora (poción con cupo lleno),
    // así no se queda "pegada" al cuerpo siguiéndote
    const potFull = (pk.kind === 'potion' && p.potions >= BALANCE.maxPotions) ||
                    (pk.kind === 'manapotion' && (p.manaPotions || 0) >= BALANCE.maxPotions);
    if (d < 30 && pk.kind !== 'item' && !potFull) { pk.x += dx / d * 130 * dt; pk.y += dy / d * 130 * dt; }
    if (d < 14) {
      if (pk.kind === 'xp') { gainXP(pk.val || 2); pk.dead = true; sfx('xp'); }
      else if (pk.kind === 'key') { p.hasKey = true; pk.dead = true; sfx('pickup'); toast('¡Conseguiste la llave del cofre dorado!', '#ffd84f'); }
      else if (pk.kind === 'potion') {
        if (p.potions < BALANCE.maxPotions) { p.potions++; pk.dead = true; sfx('pickup'); toast('Poción de vida (+1) — Q para beber', '#f08a88'); }
        else if (!pk.warned) { pk.warned = true; toast('Ya llevás ' + BALANCE.maxPotions + ' pociones', '#8a8496'); }
      }
      else if (pk.kind === 'manapotion') {
        if ((p.manaPotions || 0) < BALANCE.maxPotions) { p.manaPotions++; pk.dead = true; sfx('pickup'); toast('Poción de maná (+1) — F para beber', '#6cb8ff'); }
        else if (!pk.warned) { pk.warned = true; toast('Ya llevás ' + BALANCE.maxPotions + ' pociones de maná', '#8a8496'); }
      }
      else if (pk.kind === 'coin') { p.coins += (pk.val || 1); pk.dead = true; sfx('coin'); }
      else if (pk.kind === 'heart') {
        if (p.hp < p.stats.maxhp) {
          // cura un mínimo fijo o un % de la vida máxima (escala en runs avanzadas)
          const heal = Math.max(BALANCE.heartHeal, Math.round(p.stats.maxhp * 0.15));
          p.hp = Math.min(p.stats.maxhp, p.hp + heal);
          pk.dead = true; sfx('heal');
          addFloater(p.x, p.y - 14, '+' + heal, '#7fc97f', false);
        }
      } else if (pk.kind === 'item') {
        if (bagAdd(p, pk.item)) {
          pk.dead = true; sfx('pickup');
          toast('Conseguiste: ' + pk.item.name, rarityOf(pk.item).color);
          if (state.invOpen) renderInv();
        } else if (!pk.warned) { pk.warned = true; toast('Inventario lleno', '#ff6b6b'); }
      }
    }
  }
  state.pickups = state.pickups.filter(pk => !pk.dead);
}

// ---------------- Partículas y números flotantes ----------------

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 80;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.3 + Math.random() * 0.3, color });
  }
}

function updateParticles(dt) {
  for (const pa of state.particles) {
    pa.x += pa.vx * dt; pa.y += pa.vy * dt;
    pa.vx *= 0.9; pa.vy *= 0.9; pa.t -= dt;
  }
  state.particles = state.particles.filter(pa => pa.t > 0);
}

function addFloater(x, y, txt, color, big) {
  state.floaters.push({ x, y, txt, color, big, t: 0.8 });
}

function updateFloaters(dt) {
  for (const f of state.floaters) { f.y -= 22 * dt; f.t -= dt; }
  state.floaters = state.floaters.filter(f => f.t > 0);
}

function shake(n) { state.shake = Math.min(8, state.shake + n); }

// Efectos visuales transitorios (anillos, destellos)
function updateFx(dt) {
  for (const f of state.fx) f.t -= dt;
  state.fx = state.fx.filter(f => f.t > 0);
}

// Beber poción (tecla Q): cura 40% de la vida máxima
function drinkPotion() {
  const p = state.player;
  if (!p || state.mode !== 'play') return;
  if (p.potions <= 0) { toast('No tenés pociones', '#8a8496'); return; }
  if (p.hp >= p.stats.maxhp) { toast('Ya estás al máximo de vida', '#8a8496'); return; }
  p.potions--;
  const heal = Math.round(p.stats.maxhp * 0.4);
  p.hp = Math.min(p.stats.maxhp, p.hp + heal);
  addFloater(p.x, p.y - 14, '+' + heal, '#7fc97f', true);
  burst(p.x, p.y, '#f08a88', 10);
  sfx('heal');
}

// Beber poción de maná (tecla F): restaura 50% del maná máximo
function drinkManaPotion() {
  const p = state.player;
  if (!p || state.mode !== 'play') return;
  if ((p.manaPotions || 0) <= 0) { toast('No tenés pociones de maná', '#8a8496'); return; }
  if (p.mana >= p.stats.maxMana) { toast('Ya estás al máximo de maná', '#8a8496'); return; }
  p.manaPotions--;
  const restore = Math.round(p.stats.maxMana * 0.5);
  p.mana = Math.min(p.stats.maxMana, p.mana + restore);
  addFloater(p.x, p.y - 14, '+' + restore + ' MP', '#6cb8ff', true);
  burst(p.x, p.y, '#6cb8ff', 10);
  sfx('heal');
}

// ---------------- Experiencia y niveles ----------------

function gainXP(v) {
  const p = state.player;
  p.xp += v;
  if (p.xp >= p.xpNext && !state.upgradeOpen) triggerLevelUp();
}

function triggerLevelUp() {
  const p = state.player;
  p.xp -= p.xpNext;
  p.level++;
  p.xpNext = Math.round(25 + (p.level - 1) * 18);
  sfx('levelup');
  bigToast('¡NIVEL ' + p.level + '!');
  burst(p.x, p.y, '#ffd84f', 16);
  showUpgradeChoice();
}
