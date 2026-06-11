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
    bag: [], coins: 0, potions: 1,
    level: 1, xp: 0, xpNext: 25,
    bonus: { hp: 0, spd: 0, crit: 0, atkspd: 0, def: 0, dmgMul: 1 },
    atkCd: 0, ifr: 0, stunT: 0, dir: 1,
    dashT: 0, dashCd: 0, dashVX: 0, dashVY: 0,
    kbx: 0, kby: 0,
    swingT: 0, swingAng: 0,
  };
  calcStats(p);
  p.hp = p.stats.maxhp;
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
    spd: def.spd * (elite ? 1.05 : 1), ai: isBossType ? 'boss' : def.ai,
    dir: 1, flashT: 0, hitCd: 0, fireT: Math.random() * 1.5,
    kbx: 0, kby: 0, wobble: Math.random() * Math.PI * 2,
    isBoss: !!isBossType, scale: (def.scale || 1) * (elite ? 1.2 : 1),
    // estado de jefe
    pattern: 0, patT: 2.5, subT: 0, chargeVX: 0, chargeVY: 0, charging: false, telegraphT: 0,
    hasBall: def.kicksBall ? true : undefined, ballPos: null,
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
    // aggro: el jugador en la sala del enemigo (o muy cerca, p.ej. pasillo).
    // Una vez en contacto persigue 1.5 s más; si te vas de la sala, deja de seguir.
    let inContact = dist < 4 * TILE;
    if (e.room) {
      const ptx = p.x / TILE, pty = p.y / TILE, r = e.room;
      if (ptx >= r.x - 1 && ptx <= r.x + r.w && pty >= r.y - 1 && pty <= r.y + r.h) inContact = true;
    } else if (dist < 10 * TILE) inContact = true; // sin sala (arena/llave): radio
    if (inContact) e.aggroT = 1.5;
    else e.aggroT = Math.max(0, (e.aggroT || 0) - dt);
    const aggro = e.isBoss || e.aggroT > 0;

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
          fireProj({ x: e.x, y: e.y, ang: Math.atan2(dy, dx), spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: '#ff7b5a', range: e.def.range + 50 });
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
      const eraVulnerable = p.ifr <= 0;
      damagePlayer(e.dmg);
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

  if (pat === 'chase') {
    moveWithCollision(lvl, e, (dx / dist) * e.spd * dt, (dy / dist) * e.spd * dt, false);
  } else if (pat === 'burst') {
    moveWithCollision(lvl, e, (dx / dist) * e.spd * 0.3 * dt, (dy / dist) * e.spd * 0.3 * dt, false);
    e.subT -= dt;
    if (e.subT <= 0) {
      e.subT = 1.1;
      const n = 12, off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++)
        fireProj({ x: e.x, y: e.y, ang: off + (i / n) * Math.PI * 2, spd: e.def.projSpd, dmg: e.dmg, friendly: false, color: '#ff5a8a', range: e.def.projRange || 170 });
      sfx('eshoot');
    }
  } else if (pat === 'spread') {
    e.subT -= dt;
    if (e.subT <= 0) {
      e.subT = 0.65;
      const base = Math.atan2(dy, dx);
      for (const o of [-0.25, 0, 0.25])
        fireProj({ x: e.x, y: e.y, ang: base + o, spd: e.def.projSpd * 1.2, dmg: e.dmg, friendly: false, color: '#ffb15a', range: e.def.projRange || 170 });
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
    }
  } else if (pat === 'kickball') {
    // patea SU pelota hacia el jugador; donde caiga, irá a buscarla
    if (e.subT === 0) {
      e.subT = 0.37; // windup: la pelota sale al inicio del frame 2 (250+120 ms)
      e.kickStart = state.time;
    } else {
      e.subT -= dt;
      if (e.subT <= 0 && e.hasBall) {
        e.subT = 999; // una sola patada por ciclo
        fireProj({ x: e.x, y: e.y, ang: Math.atan2(dy, dx), spd: 240,
          dmg: Math.round(e.dmg * 1.2), friendly: false, style: 'rugbyball', life: 0.6, owner: e });
        e.hasBall = false;
        addFloater(e.x, e.y - 24, '¡Patada!', '#ffd84f', false);
        sfx('kick');
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
  });
}

function updateProjectiles(dt) {
  const p = state.player, lvl = state.level;
  for (const pr of state.projs) {
    if (pr.dead) continue;
    pr.px = pr.x; pr.py = pr.y;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.life -= dt;
    pr.t += dt;
    if (pr.life <= 0) {
      // el poder se agota: chisporroteo y muere
      pr.dead = true;
      burst(pr.x, pr.y, pr.color, 3);
      continue;
    }

    // estela de chispas arcanas del orbe del mago
    if (pr.style === 'bolt') {
      pr.trailT -= dt;
      if (pr.trailT <= 0) {
        pr.trailT = 0.016;
        state.particles.push({
          x: pr.x + (Math.random() - 0.5) * 3, y: pr.y + (Math.random() - 0.5) * 3,
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
      else burst(pr.x, pr.y, pr.color, 3);
      continue;
    }
    if (pr.friendly) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (pr.hitSet && pr.hitSet.has(e)) continue; // la ballesta no pega dos veces al mismo
        const r = (e.w * e.scale + pr.size) / 2;
        if (Math.abs(pr.x - e.x) < r && Math.abs(pr.y - e.y) < r) {
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
  const v2boom = typeof V2H !== 'undefined' && V2H.ready && V2H.fx.boom.length;
  if (v2boom) {
    // explosión sprite del energyblast: trae sus propios anillos horneados —
    // los anillos/flash del motor (el "arco blanco") se omiten para no duplicar
    state.fx.push({ type: 'v2boom', x: pr.x, y: pr.y, start: state.time, t: 0.5, t0: 0.5 });
  } else {
    // fallback por código: destello + onda expansiva
    state.fx.push({ type: 'flash', x: pr.x, y: pr.y, t: 0.12, t0: 0.12, r: Math.max(10, pr.splash * 0.8) });
    state.fx.push({ type: 'ring', x: pr.x, y: pr.y, t: 0.32, t0: 0.32, maxR: pr.splash + 10, color: '#9ad8ff' });
    state.fx.push({ type: 'ring', x: pr.x, y: pr.y, t: 0.45, t0: 0.45, maxR: pr.splash * 0.6, color: '#b14fff' });
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 110;
    state.particles.push({
      x: pr.x, y: pr.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
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
    fireProj({ x: mx, y: my, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#e8d8a0', style: 'arrow', crit, pierce: wt.pierce || 0 });
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
    const mx = p.x + Math.cos(aimAng) * 16, my = p.y - 6 + Math.sin(aimAng) * 16;
    fireProj({ x: mx, y: my, ang: aimAng, spd: wt.projSpd, dmg, friendly: true, color: '#7ec8ff', style: 'bolt', splash: wt.splash, crit, size: wt.projSize || 6, range: wt.projRange });
    // destello de lanzamiento en la punta del bastón
    const hx = p.x + Math.cos(aimAng) * 9, hy = p.y + Math.sin(aimAng) * 9;
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
  sfx(e.isBoss ? 'bossdie' : 'die');
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
  }
  // los élite siempre sueltan un ítem
  if (e.elite) {
    spawnPickup('item', e.x, e.y, makeItem(depth + 1));
    for (let i = 0; i < 3; i++) spawnPickup('coin', e.x + randInt(-10, 10), e.y + randInt(-10, 10));
    return;
  }
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
  else if (r < BALANCE.dropItem + BALANCE.dropCoin + BALANCE.dropHeart + BALANCE.dropPotion) spawnPickup('potion', e.x, e.y);
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
  const pk = { kind, x, y, item: item || null, t: Math.random() * Math.PI * 2, noPickT: 0.4 };
  state.pickups.push(pk);
  return pk;
}

function updatePickups(dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.t += dt * 4;
    pk.noPickT = Math.max(0, pk.noPickT - dt);
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (pk.noPickT > 0) continue;
    // los orbes de XP se magnetizan hacia el personaje desde lejos
    if (pk.kind === 'xp' && d < 70 && d > 0.1) {
      const pull = 90 + (70 - d) * 5;
      pk.x += dx / d * pull * dt; pk.y += dy / d * pull * dt;
    }
    // imán suave
    if (d < 30 && pk.kind !== 'item') { pk.x += dx / d * 130 * dt; pk.y += dy / d * 130 * dt; }
    if (d < 14) {
      if (pk.kind === 'xp') { gainXP(pk.val || 2); pk.dead = true; sfx('xp'); }
      else if (pk.kind === 'key') { p.hasKey = true; pk.dead = true; sfx('pickup'); toast('¡Conseguiste la llave del cofre dorado!', '#ffd84f'); }
      else if (pk.kind === 'potion') {
        if (p.potions < BALANCE.maxPotions) { p.potions++; pk.dead = true; sfx('pickup'); toast('Poción de vida (+1) — Q para beber', '#f08a88'); }
        else if (!pk.warned) { pk.warned = true; toast('Ya llevás ' + BALANCE.maxPotions + ' pociones', '#8a8496'); }
      }
      else if (pk.kind === 'coin') { p.coins++; pk.dead = true; sfx('coin'); }
      else if (pk.kind === 'heart') {
        if (p.hp < p.stats.maxhp) {
          // cura un mínimo fijo o un % de la vida máxima (escala en runs avanzadas)
          const heal = Math.max(BALANCE.heartHeal, Math.round(p.stats.maxhp * 0.15));
          p.hp = Math.min(p.stats.maxhp, p.hp + heal);
          pk.dead = true; sfx('heal');
          addFloater(p.x, p.y - 14, '+' + heal, '#7fc97f', false);
        }
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
