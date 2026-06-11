/* ============================================================
   DUNGEON CRAWLER — animation rig (48x48, front-facing / south)
   Pose-based naked base body + 6-tier weapons with grip pivots.
   Exposes global ARIG.
   ============================================================ */
(function (global) {
  'use strict';

  var PAL = {
    '.': null,
    '0': '#140e1a', '1': '#251c30', '2': '#3d2c47', '3': '#574066',
    '4': '#8a4d76', '5': '#b06a8f',
    'a': '#33231d', 'b': '#553a2b', 'c': '#7a543a', 'd': '#a3764e',
    'e': '#c97b63', 'f': '#e8c170', 'g': '#f6e3a9',
    'h': '#2c2735', 'i': '#453f54', 'j': '#676078', 'k': '#938da6', 'l': '#c6c1d6',
    'm': '#8a5a44', 'n': '#c08a64', 'o': '#e6b48c',
    'p': '#33402a', 'q': '#52653c', 'r': '#7c8d57',
    's': '#7fd4cf', 't': '#3e7f8a', 'u': '#1f4750',
    'w': '#efe9dc',
    // rarity ramps (dark/mid/lite): common,uncommon,rare,epic,legendary,mythic
    'A': '#5b5666', 'B': '#8d8a99', 'C': '#bdbac8',
    'D': '#2f6b34', 'E': '#5b9e54', 'F': '#86c46f',
    'G': '#27568f', 'H': '#3f7cc4', 'I': '#74a9e6',
    'J': '#5a2f8f', 'K': '#9b59c4', 'L': '#c79ae6',
    'M': '#a8641b', 'N': '#e0922f', 'O': '#f6c46a',
    'P': '#8f2020', 'Q': '#d83a3a', 'R': '#f47a5a'
  };
  var W = 48;

  var RARITY = [
    { key: 'common', name: 'Common', color: '#8d8a99' },
    { key: 'uncommon', name: 'Uncommon', color: '#5b9e54' },
    { key: 'rare', name: 'Rare', color: '#3f7cc4' },
    { key: 'epic', name: 'Epic', color: '#9b59c4' },
    { key: 'legendary', name: 'Legendary', color: '#e0922f' },
    { key: 'mythic', name: 'Mythic', color: '#d83a3a' }
  ];
  var RAMP = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I'], ['J', 'K', 'L'], ['M', 'N', 'O'], ['P', 'Q', 'R']];
  function rr(t) { var r = RAMP[t] || RAMP[0]; return { d: r[0], m: r[1], l: r[2] }; }

  function grid() { var g = []; for (var y = 0; y < W; y++) g.push(new Array(W).fill('.')); return g; }
  function px(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < W) g[y][x] = c; }
  function rect(g, x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) px(g, x, y, c); }
  function hl(g, x0, x1, y, c) { rect(g, x0, y, x1, y, c); }
  function vl(g, x, y0, y1, c) { rect(g, x, y0, x, y1, c); }
  function dots(g, pts, c) { pts.forEach(function (p) { px(g, p[0], p[1], c); }); }
  function outline(g, c) {
    var s = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) {
      if (s[y][x] !== '.') continue;
      if ((y > 0 && s[y - 1][x] !== '.') || (y < W - 1 && s[y + 1][x] !== '.') ||
          (x > 0 && s[y][x - 1] !== '.') || (x < W - 1 && s[y][x + 1] !== '.')) g[y][x] = c;
    }
  }
  function center(g) {
    var minX = W, maxX = -1, minY = W, maxY = -1;
    for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) if (g[y][x] !== '.') {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxX < 0) return g;
    var dx = Math.round((W - 1 - (maxX - minX)) / 2) - minX;
    var dy = Math.round((W - 1 - (maxY - minY)) / 2) - minY;
    var out = grid();
    for (var y2 = minY; y2 <= maxY; y2++) for (var x2 = minX; x2 <= maxX; x2++)
      if (g[y2][x2] !== '.') px(out, x2 + dx, y2 + dy, g[y2][x2]);
    return out;
  }

  // offset-aware region helpers
  function H(dx, dy) {
    return {
      r: function (g, x0, y0, x1, y1, c) { rect(g, x0 + dx, y0 + dy, x1 + dx, y1 + dy, c); },
      h: function (g, x0, x1, y, c) { rect(g, x0 + dx, y + dy, x1 + dx, y + dy, c); },
      v: function (g, x, y0, y1, c) { rect(g, x + dx, y0 + dy, x + dx, y1 + dy, c); },
      d: function (g, pts, c) { pts.forEach(function (p) { px(g, p[0] + dx, p[1] + dy, c); }); }
    };
  }

  /* ---------- body regions (rest pose) ---------- */
  function legL(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 18, 36, 22, 43, 'n'); e.v(g, 22, 36, 43, 'm');
    e.r(g, 17, 44, 22, 46, 'n'); e.h(g, 17, 22, 44, 'o');
    e.d(g, [[18, 46], [20, 46]], 'm');
  }
  function legR(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 25, 36, 29, 43, 'n'); e.v(g, 29, 36, 43, 'm');
    e.r(g, 25, 44, 30, 46, 'n'); e.h(g, 25, 30, 44, 'o');
    e.d(g, [[26, 46], [28, 46]], 'm');
  }
  function torso(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 16, 20, 31, 32, 'n');
    e.v(g, 16, 20, 32, 'o'); e.v(g, 31, 20, 32, 'm');
    e.h(g, 17, 22, 24, 'm'); e.h(g, 25, 30, 24, 'm');
    e.d(g, [[21, 27], [26, 27], [21, 29], [26, 29]], 'm');
    // underpants
    e.r(g, 17, 33, 30, 35, '2');
    e.h(g, 17, 30, 33, '1');
    e.d(g, [[23, 35], [24, 35]], '1');
  }
  function armL(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 13, 22, 15, 28, 'n'); e.v(g, 13, 22, 28, 'o'); e.v(g, 15, 22, 28, 'm');
    e.r(g, 13, 29, 15, 32, 'n'); e.h(g, 13, 15, 32, 'm');
  }
  function armR(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 32, 22, 34, 28, 'n'); e.v(g, 32, 22, 28, 'o'); e.v(g, 34, 22, 28, 'm');
    e.r(g, 32, 29, 34, 32, 'n'); e.h(g, 32, 34, 32, 'm');
  }
  function head(g, dx, dy) {
    var e = H(dx, dy);
    e.r(g, 18, 8, 29, 9, 'n');
    e.r(g, 17, 10, 30, 17, 'n');
    e.r(g, 18, 18, 29, 18, 'n');
    e.r(g, 19, 19, 28, 19, 'n');
    e.v(g, 30, 10, 17, 'm'); e.h(g, 19, 28, 19, 'm');
    // hair
    e.r(g, 17, 7, 30, 7, 'b'); e.h(g, 18, 28, 7, 'c');
    e.v(g, 17, 8, 9, 'b'); e.v(g, 30, 8, 9, 'b');
    // eyes
    e.d(g, [[20, 14], [21, 14], [26, 14], [27, 14]], '0');
    e.d(g, [[20, 15], [21, 15], [26, 15], [27, 15]], 'm');
    e.d(g, [[23, 16], [24, 16]], 'm');
  }

  /* ---------- pose assembly ---------- */
  function gp(p, k) { return (p && p[k]) || 0; }
  function assemble(pose) {
    pose = pose || {};
    var bx = gp(pose, 'bodyDX'), by = gp(pose, 'bodyDY');
    var g = grid();
    legL(g, bx + gp(pose, 'lLegDX'), by + gp(pose, 'lLegDY'));
    legR(g, bx + gp(pose, 'rLegDX'), by + gp(pose, 'rLegDY'));
    torso(g, bx + gp(pose, 'torsoDX'), by + gp(pose, 'torsoDY'));
    armL(g, bx + gp(pose, 'lArmDX'), by + gp(pose, 'lArmDY'));
    armR(g, bx + gp(pose, 'rArmDX'), by + gp(pose, 'rArmDY'));
    head(g, bx + gp(pose, 'headDX'), by + gp(pose, 'headDY'));
    outline(g, '0');
    return g;
  }

  /* ---------- animations ---------- */
  var ANIM = {
    idle: {
      label: 'Idle', note: 'Gentle breathing',
      dur: [620, 620],
      frames: [
        {},
        { headDY: -1, torsoDY: -1, lArmDY: -1, rArmDY: -1 }
      ]
    },
    run: {
      label: 'Run', note: 'Full cycle: knee lift + arm swing + body bob',
      dur: [110, 110, 110, 110],
      frames: [
        { rLegDY: -2, rLegDX: 1, lLegDX: -1, lArmDY: -2, rArmDY: 1, lArmDX: -1, rArmDX: 1 },
        { bodyDY: -1 },
        { lLegDY: -2, lLegDX: -1, rLegDX: 1, rArmDY: -2, lArmDY: 1, rArmDX: 1, lArmDX: -1 },
        { bodyDY: -1 }
      ]
    },
    attack: {
      label: 'Attack', note: 'Overhead swing — melee; ranged/magic reuse it',
      dur: [80, 70, 150],
      frames: [
        { bodyDX: -1, headDX: -1, rArmDY: -7, rArmDX: 1, lArmDY: -1 },
        { bodyDX: 2, bodyDY: 1, headDX: 1, rArmDY: 4, rArmDX: 1, lArmDX: -1 },
        { bodyDX: 1, rArmDY: 2, rArmDX: 1 }
      ]
    },
    hurt: {
      label: 'Hurt', note: 'Recoil flinch with damage flash',
      dur: [90, 170],
      frames: [
        { bodyDX: -3, headDX: -1, headDY: -1, flash: 0.55 },
        { bodyDX: -1, flash: 0.18 }
      ]
    }
  };
  var ANIM_ORDER = ['idle', 'run', 'attack', 'hurt'];

  function frameGrid(animName, i) {
    var a = ANIM[animName] || ANIM.idle;
    return assemble(a.frames[i % a.frames.length]);
  }
  function frameFlash(animName, i) {
    var a = ANIM[animName] || ANIM.idle;
    return gp(a.frames[i % a.frames.length], 'flash');
  }
  // right-hand anchor (sprite px) for the weapon grip, per frame
  function handAnchor(animName, i) {
    var a = ANIM[animName] || ANIM.idle;
    var p = a.frames[i % a.frames.length];
    return { x: 33 + gp(p, 'bodyDX') + gp(p, 'rArmDX'), y: 30.5 + gp(p, 'bodyDY') + gp(p, 'rArmDY') };
  }

  /* ---------- weapons (canonical vertical, tip up) ---------- */
  var WEAPONS = {
    sword: {
      label: 'Sword', grip: { x: 23.5, y: 33 },
      names: ['Rusted Shortsword', 'Iron Arming Sword', "Knight's Longsword", 'Runed Falchion', 'Oathkeeper', 'Bloodsong'],
      draw: function (g, t) {
        var R = rr(t);
        var top = t >= 4 ? 7 : 9;
        rect(g, 23, top, 24, 29, 'l'); vl(g, 23, top, 29, 'k'); px(g, 23, top - 1, 'l'); px(g, 24, top - 1, 'k');
        vl(g, 24, top + 2, 27, 'l');
        rect(g, 20, 30, 27, 30, 'j'); px(g, 20, 30, R.m); px(g, 27, 30, R.m); hl(g, 20, 27, 31, 'i');
        rect(g, 23, 31, 24, 36, 'b'); dots(g, [[23, 32], [24, 33], [23, 34], [24, 35]], R.d);
        px(g, 23, 37, R.m); px(g, 24, 37, R.l);
        if (t >= 2) px(g, 23, 30, R.l);
        if (t >= 3) dots(g, [[24, 13], [23, 18], [24, 23]], R.l);
        if (t >= 4) dots(g, [[21, 12], [26, 16], [22, 22], [25, 26]], R.l);
        if (t >= 5) { dots(g, [[22, 9], [25, 13], [21, 19], [26, 23], [23, 27]], R.m); px(g, 23, 38, R.l); }
      }
    },
    hammer: {
      label: 'Hammer', grip: { x: 24, y: 34 },
      names: ['Wooden Maul', 'Iron Warhammer', 'Steel Maul', 'Runic Crusher', 'Dawnbreaker', 'Skullrender'],
      draw: function (g, t) {
        var R = rr(t);
        vl(g, 24, 11, 40, 'b'); vl(g, 23, 11, 40, 'c');
        rect(g, 19, 5, 29, 11, 'j'); hl(g, 19, 29, 5, 'k');
        vl(g, 19, 5, 11, 'i'); vl(g, 29, 5, 11, 'i');
        hl(g, 19, 29, 8, R.m);
        dots(g, [[20, 6], [28, 6], [20, 10], [28, 10]], 'i');
        dots(g, [[24, 33], [23, 35]], 'a');
        if (t >= 2) px(g, 24, 8, R.l);
        if (t >= 3) { px(g, 18, 8, R.m); px(g, 30, 8, R.m); }
        if (t >= 4) dots(g, [[18, 7], [30, 7], [24, 4]], R.l);
        if (t >= 5) dots(g, [[17, 8], [31, 8], [24, 3], [24, 13]], R.m);
      }
    },
    bow: {
      label: 'Bow', grip: { x: 20, y: 24 },
      names: ['Hunting Bow', 'Ash Longbow', 'Recurve Warbow', 'Heartwood Bow', 'Windsinger', 'Doomnock'],
      draw: function (g, t) {
        var R = rr(t);
        var wood = t >= 4 ? R.m : 'c', wd = t >= 4 ? R.d : 'b';
        dots(g, [[22, 8], [21, 9], [20, 10], [19, 12], [19, 16], [19, 20]], wood);
        rect(g, 19, 22, 20, 26, wd);
        dots(g, [[19, 28], [19, 32], [20, 36], [21, 39], [22, 40]], wood);
        var str = t >= 4 ? R.l : 'l';
        vl(g, 23, 9, 39, str);
        if (t >= 2) dots(g, [[19, 23], [19, 25]], R.m);
        if (t >= 3) { px(g, 22, 7, R.l); px(g, 22, 41, R.l); }
        if (t >= 5) dots(g, [[24, 13], [24, 21], [24, 29], [24, 37]], R.m);
      }
    },
    crossbow: {
      label: 'Crossbow', grip: { x: 24, y: 30 },
      names: ['Light Crossbow', "Hunter's Crossbow", 'Steel Repeater', 'Runed Arbalest', 'Stormbolt', 'Soulpiercer'],
      draw: function (g, t) {
        var R = rr(t);
        vl(g, 24, 16, 34, 'b'); vl(g, 25, 16, 34, 'c');
        hl(g, 16, 32, 16, 'i'); hl(g, 16, 32, 17, 'h');
        dots(g, [[16, 16], [32, 16]], R.m);
        dots(g, [[17, 15], [18, 15], [19, 16], [31, 15], [30, 15], [29, 16], [24, 18]], 'l');
        vl(g, 24, 10, 15, 'd'); px(g, 24, 9, 'l');
        if (t >= 2) px(g, 24, 30, R.l);
        if (t >= 3) dots(g, [[20, 14], [28, 14]], R.m);
        if (t >= 4) dots(g, [[15, 16], [33, 16]], R.l);
        if (t >= 5) { vl(g, 24, 9, 15, R.m); px(g, 24, 8, R.l); }
      }
    },
    staff: {
      label: 'Staff', grip: { x: 24, y: 32 },
      names: ['Gnarled Stick', 'Apprentice Staff', 'Oaken Staff', 'Runed Staff', 'Staff of Stars', 'Voidcaller'],
      draw: function (g, t) {
        var R = rr(t);
        vl(g, 24, 9, 44, 'b'); vl(g, 23, 9, 44, 'c'); dots(g, [[24, 16], [24, 26], [24, 36]], 'a');
        if (t <= 0) { rect(g, 23, 6, 25, 8, 'c'); hl(g, 23, 25, 6, 'd'); }
        else {
          var o = R.m, ol = R.l;
          hl(g, 23, 25, 3, o); hl(g, 22, 26, 4, o); hl(g, 22, 26, 5, o); hl(g, 23, 25, 6, o);
          dots(g, [[23, 4], [24, 4], [23, 5]], ol); px(g, 24, 5, 'w');
          if (t >= 3) { px(g, 22, 7, 'i'); px(g, 26, 7, 'i'); px(g, 21, 8, 'i'); px(g, 27, 8, 'i'); }
          if (t >= 4) dots(g, [[20, 3], [28, 5], [24, 1]], ol);
          if (t >= 5) dots(g, [[19, 5], [29, 4], [24, 9], [21, 2], [27, 2]], o);
        }
      }
    },
    wand: {
      label: 'Wand', grip: { x: 24, y: 32 },
      names: ['Whittled Wand', 'Birch Wand', 'Silver Wand', 'Runic Wand', 'Starcaller', 'Hexwand'],
      draw: function (g, t) {
        var R = rr(t);
        var w = t >= 3 ? R.d : 'b', wl = t >= 3 ? R.m : 'c';
        vl(g, 24, 24, 36, w); vl(g, 23, 24, 36, wl);
        if (t <= 0) { px(g, 24, 22, 'c'); px(g, 24, 21, 'c'); }
        else {
          dots(g, [[24, 20], [23, 21], [25, 21], [24, 22]], R.m); px(g, 24, 21, R.l);
          if (t >= 4) dots(g, [[22, 19], [26, 20], [24, 17]], R.l);
          if (t >= 5) dots(g, [[21, 21], [27, 21], [24, 15]], R.m);
        }
      }
    }
  };
  var WEAPON_ORDER = ['sword', 'hammer', 'bow', 'crossbow', 'staff', 'wand'];

  function weaponGrid(type, tier) {
    var def = WEAPONS[type];
    var g = grid();
    def.draw(g, tier);
    outline(g, '0');
    return g;
  }
  function weaponInfo(type, tier) {
    var def = WEAPONS[type];
    return { name: def.names[tier], rarity: RARITY[tier], grip: def.grip, label: def.label };
  }

  /* ---------- paint ---------- */
  function paint(canvas, gridData, opts) {
    opts = opts || {};
    canvas.width = W; canvas.height = W;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, W);
    for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) {
      var ch = gridData[y][x];
      if (ch !== '.' && PAL[ch]) { ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
    }
    if (opts.flash) {
      ctx.fillStyle = 'rgba(232,72,72,' + opts.flash + ')';
      for (var y2 = 0; y2 < W; y2++) for (var x2 = 0; x2 < W; x2++) {
        var c2 = gridData[y2][x2];
        if (c2 !== '.' && c2 !== '0') ctx.fillRect(x2, y2, 1, 1);
      }
    }
  }

  global.ARIG = {
    W: W, PAL: PAL, RARITY: RARITY, rr: rr,
    ANIM: ANIM, ANIM_ORDER: ANIM_ORDER,
    WEAPONS: WEAPONS, WEAPON_ORDER: WEAPON_ORDER,
    grid: grid, outline: outline, center: center, paint: paint,
    assemble: assemble, frameGrid: frameGrid, frameFlash: frameFlash, handAnchor: handAnchor,
    weaponGrid: weaponGrid, weaponInfo: weaponInfo
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
