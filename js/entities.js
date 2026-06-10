// =====================================================================
// entities.js — jugador, enemigos, proyectiles, pickups y combate.
// Los comportamientos ('chaser', 'shooter', 'erratic', 'boss') son
// reutilizables: cualquier enemigo nuevo en data.js los hereda.
// =====================================================================

function makePlayer(clsId) {
  const cls = CLASSES[clsId];
  const p = {
    cls: clsId, x: 0, y: 0, w: 10, h: 10,
    hp: cls.hp, stats: null,
    equip: { arma: makeStarterWeapon(cls.weapon), casco: null, coraza: null, botas: null, anillo: null, amuleto: null },
    bag: [], coins: 0,
    atkCd: 0, ifr: 0, dir: 1,
    kbx: 0, kby: 0,
    swingT: 0, swingAng: 0,
  };
  calcStats(p);
  p.hp = p.stats.maxhp;
  return p;
}

function spawnEnemy(typeId, x, y, depth, isBossType) {
  const def = isBossType ? BOSSES[typeId] : ENEMIES[typeId];
  const hpMul = 1 + (depth - 1) * BALANCE.depthHpScale;
  const dmgMul = 1 + (depth - 1) * BALANCE.depthDmgScale;
  return {
    type: typeId, def, x, y,
    w: def.size, h: def.size,
    hp: Math.round(def.hp * hpMul), maxhp: Math.round(def.hp * hpMul),
    dmg: Math.round(def.dmg * dmgMul),
    spd: def.spd, ai: isBossType ? 'boss' : def.ai,
    dir: 1, flashT: 0, hitCd: 0, fireT: Math.random() * 1.5,
    kbx: 0, kby: 0, wobble: Math.random() * Math.PI * 2,
    isBoss: !!isBossType, scale: def.scale || 1,
    // estado de jefe
    pattern: 0, patT: 2.5, subT: 0, chargeVX: 0, chargeVY: 0, charging: false, telegraphT: 0,
  };
}

// ---------------- Actualización de enemigos ----------------

function updateEnemies(dt) {
  const p = state.player, lvl = state.level;
  for (const e of state.enemies) {
    e.flashT = Math.max(0, e.flashT - dt);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.wobble += dt * 6;

    // knockback
    if (Math.abs(e.kbx) > 1 || Math.abs(e.kby) > 1) {
      moveWithCollision(lvl, e, e.kbx * dt, e.kby * dt, e.def.ghost);
      e.kbx *= Math.pow(0.0001, dt); e.kby *= Math.pow(0.0001, dt);
    }

    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aggro = e.isBoss || dist < 10 * TILE;

    if (aggro) {
      if (e.ai === 'chaser') {
        moveWithCollision(lvl, e, (dx / dist) * e.spd * dt, (dy / dist) * e.spd * dt, e.def.ghost);
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
          fireProj({ x: e.x, y: e.y, ang: Math.atan2(dy, dx), spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: '#ff7b5a' });
          sfx('eshoot');
        }
      } else if (e.ai === 'boss') {
        updateBoss(e, dt, dist, dx, dy);
      }
      e.dir = dx >= 0 ? 1 : -1;
    }

    // daño por contacto
    if (e.hitCd <= 0 && Math.abs(dx) < (e.w + p.w) / 2 && Math.abs(dy) < (e.h + p.h) / 2) {
      e.hitCd = 0.8;
      damagePlayer(e.dmg);
    }
  }
}

function updateBoss(e, dt, dist, dx, dy) {
  const lvl = state.level, p = state.player;
  e.patT -= dt;
  if (e.patT <= 0 && !e.charging) {
    e.pattern = (e.pattern + 1) % e.def.patterns.length;
    e.patT = 3.2; e.subT = 0; e.telegraphT = 0;
  }
  const pat = e.def.patterns[e.pattern];

  if (pat === 'chase') {
    moveWithCollision(lvl, e, (dx / dist) * e.spd * dt, (dy / dist) * e.spd * dt, false);
  } else if (pat === 'burst') {
    moveWithCollision(lvl, e, (dx / dist) * e.spd * 0.3 * dt, (dy / dist) * e.spd * 0.3 * dt, false);
    e.subT -= dt;
    if (e.subT <= 0) {
      e.subT = 1.1;
      const n = 12, off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++)
        fireProj({ x: e.x, y: e.y, ang: off + (i / n) * Math.PI * 2, spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: '#ff5a8a' });
      sfx('eshoot');
    }
  } else if (pat === 'spread') {
    e.subT -= dt;
    if (e.subT <= 0) {
      e.subT = 0.65;
      const base = Math.atan2(dy, dx);
      for (const o of [-0.25, 0, 0.25])
        fireProj({ x: e.x, y: e.y, ang: base + o, spd: e.def.projSpd * 1.2, dmg: e.dmg, friendly: false, color: '#ffb15a' });
      sfx('eshoot');
    }
  } else if (pat === 'charge') {
    if (!e.charging && e.telegraphT === 0) e.telegraphT = 0.55; // telegrafiar
    if (e.telegraphT > 0) {
      e.telegraphT -= dt;
      if (e.telegraphT <= 0) {
        e.charging = true;
        e.chargeVX = (dx / dist) * e.spd * 4.5;
        e.chargeVY = (dy / dist) * e.spd * 4.5;
      }
    }
    if (e.charging) {
      const ox = e.x, oy = e.y;
      moveWithCollision(lvl, e, e.chargeVX * dt, e.chargeVY * dt, false);
      if (Math.abs(e.x - ox) < 0.1 && Math.abs(e.y - oy) < 0.1) { // chocó con pared
        e.charging = false; e.patT = 0; shake(5);
      }
    }
  } else if (pat === 'summon') {
    e.subT -= dt;
    if (e.subT <= 0) {
      e.subT = 2.2;
      if (state.enemies.length < 8 && e.def.minion) {
        const ang = Math.random() * Math.PI * 2;
        const m = spawnEnemy(e.def.minion, e.x + Math.cos(ang) * 30, e.y + Math.sin(ang) * 30, state.run.depth);
        state.enemies.push(m);
        burst(m.x, m.y, '#b14fff', 8);
        sfx('summon');
      }
    }
  }
}

// ---------------- Proyectiles ----------------

function fireProj(o) {
  state.projs.push({
    x: o.x, y: o.y,
    vx: Math.cos(o.ang) * o.spd, vy: Math.sin(o.ang) * o.spd,
    ang: o.ang, dmg: o.dmg, friendly: o.friendly,
    color: o.color || '#fff', style: o.style || 'dot',
    splash: o.splash || 0, crit: o.crit || false,
    life: 2.2, dead: false,
  });
}

function updateProjectiles(dt) {
  const p = state.player, lvl = state.level;
  for (const pr of state.projs) {
    if (pr.dead) continue;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.life <= 0) { pr.dead = true; continue; }
    if (rectHitsWall(lvl, pr.x, pr.y, 4, 4)) {
      pr.dead = true;
      if (pr.splash) explode(pr);
      else burst(pr.x, pr.y, pr.color, 3);
      continue;
    }
    if (pr.friendly) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const r = (e.w * e.scale + 6) / 2;
        if (Math.abs(pr.x - e.x) < r && Math.abs(pr.y - e.y) < r) {
          pr.dead = true;
          if (pr.splash) explode(pr);
          else damageEnemy(e, pr.dmg, pr.crit, pr.vx * 0.4, pr.vy * 0.4);
          break;
        }
      }
    } else {
      if (p.ifr <= 0 && Math.abs(pr.x - p.x) < (p.w + 6) / 2 && Math.abs(pr.y - p.y) < (p.h + 6) / 2) {
        pr.dead = true;
        damagePlayer(pr.dmg);
      }
    }
  }
  state.projs = state.projs.filter(pr => !pr.dead);
}

// Explosión con área (bastón de mago)
function explode(pr) {
  burst(pr.x, pr.y, '#7ec8ff', 14);
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
  p.atkCd = attackCooldown(p);
  const crit = Math.random() * 100 < p.stats.crit;
  const dmg = Math.round(playerDamage(p) * (crit ? 2 : 1));

  if (wt.style === 'melee') {
    p.swingT = 0.16; p.swingAng = aimAng;
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
        hitAny = true;
      }
    }
    if (hitAny) sfx('hit');
  } else if (wt.style === 'arrow') {
    fireProj({ x: p.x, y: p.y, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#e8d8a0', style: 'arrow', crit });
    sfx('shoot');
  } else if (wt.style === 'bolt') {
    fireProj({ x: p.x, y: p.y, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#7ec8ff', style: 'bolt', splash: wt.splash, crit });
    sfx('cast');
  }
}

// ---------------- Daño ----------------

function damageEnemy(e, dmg, crit, kx, ky) {
  e.hp -= dmg;
  e.flashT = 0.1;
  e.kbx += (kx || 0) * (e.isBoss ? 0.15 : 1);
  e.kby += (ky || 0) * (e.isBoss ? 0.15 : 1);
  addFloater(e.x, e.y - e.h, String(dmg), crit ? '#ffd84f' : '#fff', crit);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  state.run.kills++;
  burst(e.x, e.y, e.isBoss ? '#ffd84f' : '#c44', e.isBoss ? 30 : 8);
  sfx(e.isBoss ? 'bossdie' : 'die');
  dropLoot(e);
  if (e.isBoss) onBossKilled(e);
  state.enemies = state.enemies.filter(o => o !== e);
}

function damagePlayer(dmg) {
  const p = state.player;
  if (p.ifr > 0 || state.mode !== 'play') return;
  const real = applyDefense(dmg, p.stats.def);
  p.hp -= real;
  p.ifr = BALANCE.playerIfr;
  addFloater(p.x, p.y - 12, String(real), '#ff6b6b', false);
  shake(4);
  sfx('hurt');
  if (p.hp <= 0) { p.hp = 0; onPlayerDeath(); }
}

// ---------------- Loot ----------------

function dropLoot(e) {
  const depth = state.run.depth;
  if (e.isBoss) {
    // los jefes siempre sueltan un ítem bueno + monedas
    const it = makeItem(depth + 2);
    if (it.rarity === 'comun' || it.rarity === 'magico') it.rarity = 'raro';
    spawnPickup('item', e.x, e.y, makeItemRespectRarity(it, depth));
    for (let i = 0; i < 8; i++) spawnPickup('coin', e.x + randInt(-14, 14), e.y + randInt(-14, 14));
    spawnPickup('heart', e.x + randInt(-10, 10), e.y + 16);
    return;
  }
  const r = Math.random();
  if (r < BALANCE.dropItem) spawnPickup('item', e.x, e.y, makeItem(depth));
  else if (r < BALANCE.dropItem + BALANCE.dropCoin) spawnPickup('coin', e.x, e.y);
  else if (r < BALANCE.dropItem + BALANCE.dropCoin + BALANCE.dropHeart) spawnPickup('heart', e.x, e.y);
}

// re-tirar mods si subimos la rareza del drop de jefe
function makeItemRespectRarity(proto, depth) {
  const it = makeItem(depth + 2, proto.slot);
  if (RARITIES.findIndex(r => r.id === it.rarity) < 2) {
    it.rarity = Math.random() < 0.3 ? 'epico' : 'raro';
    return makeItem(depth + 2, proto.slot); // simplemente re-tirar; suficiente para drops de jefe
  }
  return it;
}

function spawnPickup(kind, x, y, item) {
  state.pickups.push({ kind, x, y, item: item || null, t: Math.random() * Math.PI * 2, noPickT: 0.4 });
}

function updatePickups(dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.t += dt * 4;
    pk.noPickT = Math.max(0, pk.noPickT - dt);
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (pk.noPickT > 0) continue;
    // imán suave
    if (d < 30 && pk.kind !== 'item') { pk.x += dx / d * 130 * dt; pk.y += dy / d * 130 * dt; }
    if (d < 14) {
      if (pk.kind === 'coin') { p.coins++; pk.dead = true; sfx('coin'); }
      else if (pk.kind === 'heart') {
        if (p.hp < p.stats.maxhp) { p.hp = Math.min(p.stats.maxhp, p.hp + BALANCE.heartHeal); pk.dead = true; sfx('heal'); addFloater(p.x, p.y - 14, '+' + BALANCE.heartHeal, '#7fc97f', false); }
      } else if (pk.kind === 'item') {
        if (p.bag.length < BALANCE.bagSize) {
          p.bag.push(pk.item); pk.dead = true; sfx('pickup');
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
