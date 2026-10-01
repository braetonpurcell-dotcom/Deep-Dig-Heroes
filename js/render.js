'use strict';
// The pixel scene: a 160x96 logical canvas scaled up with hard pixel edges.

const LW = 160;
const LH = 96;
const GROUND_Y = 80;
const HERO_X = 42;
const ENEMY_X = 66;

const CV = { el: null, ctx: null, k: 2 };
const SCN = {
  scroll: 0, stepT: 0, step: false, shake: 0, trauma: 0, rank: null, lastRank: 0, halfBoss: null,
  floats: [], parts: [], dying: [], banner: null,
  slash: 0, slashKind: '', lastFloatT: 0, comboPop: 0, lastStreak: 0,
  layers: new Map(),
};

// 3x5 bitmap font. Each glyph is 15 bits, row by row.
const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010',
  '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '.': '000000000000010', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000',
  x: '000101010101000', '/': '001001010100100', ':': '000010000010000', '%': '101001010100101',
  '?': '110001010000010', ' ': '000000000000000', '(': '010100100100010', ')': '010001001001010',
  '=': '000111000111000', ',': '000000000010100', "'": '010010000000000',
};

const glyphCache = new Map();
function glyph(ch, color, s) {
  const key = ch + '|' + color + '|' + s;
  let c = glyphCache.get(key);
  if (c) return c;
  const bits = FONT[ch] || FONT['?'];
  c = document.createElement('canvas');
  c.width = 3 * s + 2;
  c.height = 5 * s + 2;
  const g = c.getContext('2d');
  g.fillStyle = OUTLINE;
  for (let i = 0; i < 15; i++) {
    if (bits[i] !== '1') continue;
    const x = (i % 3) * s + 1;
    const y = Math.floor(i / 3) * s + 1;
    g.fillRect(x - 1, y, s + 2, s);
    g.fillRect(x, y - 1, s, s + 2);
  }
  g.fillStyle = color;
  for (let i = 0; i < 15; i++) {
    if (bits[i] !== '1') continue;
    g.fillRect((i % 3) * s + 1, Math.floor(i / 3) * s + 1, s, s);
  }
  glyphCache.set(key, c);
  return c;
}

function textWidth(str, s = 1) { return String(str).length * 4 * s - s; }

function drawText(str, x, y, color = '#ffffff', s = 1, align = 'left', alpha = 1) {
  str = String(str);
  const ctx = CV.ctx;
  const w = textWidth(str, s);
  let cx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? Math.round(x - w) : Math.round(x);
  const cy = Math.round(y);
  if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  for (const raw of str) {
    const ch = raw === '×' || raw === 'x' ? 'x' : raw.toUpperCase();
    if (ch !== ' ') ctx.drawImage(glyph(ch, color, s), cx - 1, cy - 1);
    cx += 4 * s;
  }
  if (alpha < 1) ctx.globalAlpha = 1;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function initCanvas(el) {
  CV.el = el;
  CV.ctx = el.getContext('2d');
  resizeCanvas();
}

function resizeCanvas() {
  if (!CV.el) return;
  const rect = CV.el.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const k = clamp(Math.round(((rect.width || LW * 2) * dpr) / LW), 1, 8);
  if (k !== CV.k || CV.el.width !== LW * k) {
    CV.k = k;
    CV.el.width = LW * k;
    CV.el.height = LH * k;
  }
}

// ---------- biome backdrops (built once per biome, tile horizontally) ----------
function putWrapped(g, x, y, w, h) {
  x = ((Math.floor(x) % LW) + LW) % LW;
  g.fillRect(x, Math.floor(y), w, h);
  if (x + w > LW) g.fillRect(x - LW, Math.floor(y), w, h);
}

function pixelBlob(g, cx, cy, rx, ry, fill, edge) {
  for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
    let top = null;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) > 1) continue;
      if (top === null) top = dy;
      g.fillStyle = dy === top ? edge : fill;
      putWrapped(g, cx + dx, cy + dy, 1, 1);
    }
  }
}

function biomeLayers(bi) {
  if (SCN.layers.has(bi)) return SCN.layers.get(bi);
  const b = BIOMES[bi % BIOMES.length];
  const rng = mulberry32(9001 + bi * 131);
  const wall = makeCanvas(LW, GROUND_Y);
  const g = wall.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, b.bg[0]);
  grad.addColorStop(1, b.bg[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, LW, GROUND_Y);
  for (let i = 0; i < 24; i++) {
    pixelBlob(g, rng() * LW, 12 + rng() * 62, 3 + rng() * 10, 2 + rng() * 6, b.rock[1], b.rock[0]);
  }
  // stalactites
  let x = 0;
  while (x < LW) {
    const w = 3 + Math.floor(rng() * 5);
    const h = 3 + Math.floor(rng() * 12);
    for (let r = 0; r < h; r++) {
      const ww = Math.max(1, Math.round(w * (1 - r / h)));
      const ox = x + Math.floor((w - ww) / 2);
      g.fillStyle = r === h - 1 ? b.rock[2] : b.rock[0];
      putWrapped(g, ox, r, ww, 1);
    }
    x += w + 1 + Math.floor(rng() * 9);
  }
  g.fillStyle = b.rock[1];
  g.fillRect(0, 0, LW, 2);
  // ore glints in the far wall
  for (let i = 0; i < 10; i++) {
    const ox = Math.floor(rng() * LW);
    const oy = 14 + Math.floor(rng() * 58);
    g.fillStyle = shade(b.oreColor, -0.2);
    putWrapped(g, ox, oy, 2, 2);
    g.fillStyle = shade(b.oreColor, 0.5);
    putWrapped(g, ox, oy, 1, 1);
  }
  // darken the lower wall a touch so sprites read clearly
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, GROUND_Y - 22, LW, 22);

  const ground = makeCanvas(LW, LH - GROUND_Y);
  const gg = ground.getContext('2d');
  gg.fillStyle = b.ground[0];
  gg.fillRect(0, 0, LW, LH - GROUND_Y);
  gg.fillStyle = b.ground[2];
  gg.fillRect(0, 0, LW, 1);
  gg.fillStyle = shade(b.ground[2], -0.25);
  gg.fillRect(0, 1, LW, 1);
  gg.fillStyle = b.ground[1];
  for (let i = 0; i < 80; i++) {
    putWrapped(gg, rng() * LW, 3 + Math.floor(rng() * 13), rng() < 0.3 ? 2 : 1, 1);
  }
  for (let tx = 0; tx < LW; tx += 16) {
    gg.fillStyle = b.ground[1];
    gg.fillRect(tx, 2, 1, 5);
    gg.fillRect(tx + 8, 9, 1, 5);
  }
  gg.fillStyle = shade(b.ground[0], 0.18);
  for (let i = 0; i < 14; i++) putWrapped(gg, rng() * LW, 4 + Math.floor(rng() * 11), 2, 1);

  const out = { wall, ground };
  SCN.layers.set(bi, out);
  return out;
}

// ---------- effects ----------
function addFloat(text, x, y, color, s = 1, life = 0.8, vy = -18) {
  SCN.floats.push({ text, x, y, color, s, t: 0, life, vy });
  if (SCN.floats.length > 28) SCN.floats.shift();
}

function addParticles(x, y, n, colors, speed = 40, life = 0.5, gravity = 120, size = 1) {
  n = Math.max(1, Math.round(n * juice()));
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(speed * 0.4, speed);
    SCN.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4,
      t: 0, life: rand(life * 0.6, life), color: pick(colors), g: gravity, size,
    });
  }
  if (SCN.parts.length > 220) SCN.parts.splice(0, SCN.parts.length - 220);
}

// Juice level scales every effect. Research on 3,000 players found both none and extreme
// juice hurt enjoyment, so Low/Med/High is offered and High is the default.
function juice() { return { low: 0.35, med: 0.7, high: 1 }[S.settings.juice] || 1; }

// Trauma-based shake: hits add trauma, the offset is trauma squared, it decays in ~0.25 s.
function shake(amount) {
  SCN.trauma = Math.min(1, SCN.trauma + 0.1 + amount * 0.12);
}

// Freeze the world for a moment so a hit lands with weight (capped so it never reads as lag).
function hitStop(ms) {
  if (S.settings.juice === 'low' || R.sim) return;
  R.hitstop = Math.max(R.hitstop, Math.min(120, ms * juice()) / 1000);
}

function banner(text, sub = '', color = '#ffcc4d', life = 2) {
  SCN.banner = { text, sub, color, t: 0, life };
}

function enemyBox(e) {
  const scale = e && e.boss ? 2 : 1;
  const w = 16 * scale;
  const h = 16 * scale;
  let y = GROUND_Y - h;
  if (e && e.type === 'bat') y -= e.boss ? 4 : 14;
  return { x: ENEMY_X + (e && e.boss ? -2 : 0), y, w, h };
}

function enemyColors(e) {
  const b = biomeFor(S.run.floor);
  if (e.type === 'rock') return [b.rock[2], b.rock[0], b.oreColor];
  if (e.type === 'goldie') return ['#ffcf3f', '#fff3b0', '#c9900f'];
  return b.enemy;
}

on('damage', ({ d, kind, enemy }) => {
  const box = enemyBox(enemy);
  const cx = box.x + box.w / 2;
  const top = box.y;
  const now = R.time;
  if (kind === 'hit') {
    if (now - SCN.lastFloatT > 0.16) {
      SCN.lastFloatT = now;
      addFloat(fmt(d), cx + rand(-6, 6), top - 2, '#ffffff', 1, 0.7);
    }
    addParticles(cx - 4, top + box.h * 0.6, 2, enemyColors(enemy), 30, 0.35);
    SFX.hit();
  } else if (kind === 'crit') {
    addFloat(fmt(d) + '!', cx + rand(-6, 6), top - 4, '#ffcc4d', 1, 0.9);
    addParticles(cx - 4, top + box.h * 0.5, 5, enemyColors(enemy), 45, 0.45);
    shake(1);
    hitStop(35);
    SFX.crit();
  } else if (kind === 'mega') {
    addFloat('MEGA ' + fmt(d), cx, top - 8, '#ff5ad2', 2, 1.3, -12);
    addParticles(cx, top + box.h / 2, 26, ['#ff5ad2', '#ffffff', '#62c9ff'], 80, 0.8);
    shake(4);
    hitStop(100);
    vibrate([20, 30, 20, 30, 45]);
  } else {
    const color = kind === 'critstrike' ? '#ff9a3d' : '#62c9ff';
    addFloat(fmt(d) + (kind === 'critstrike' ? '!' : ''), cx, top - 7, color, 2, 1.0, -14);
    addParticles(cx, top + box.h / 2, 10, [color, '#ffffff'], 60, 0.55);
    shake(2);
    hitStop(kind === 'critstrike' ? 70 : 35);
    if (kind === 'critstrike') vibrate([15, 40, 25]);
  }
  if (enemy.boss && SCN.halfBoss !== enemy && enemy.hp > 0 && enemy.hp < enemy.max / 2) {
    // Halfway through a boss: a clear "phase change" beat.
    SCN.halfBoss = enemy;
    banner('ENRAGED', 'HALF HEALTH LEFT', '#ff9a3d', 1.4);
    shake(3);
    SFX.rankUp(-5);
  }
});

on('strike', ({ kind, crit }) => {
  SCN.slash = 0.16;
  SCN.slashKind = kind;
  SFX.strike(kind);
  if (crit) SFX.crit();
});

on('kill', ({ enemy }) => {
  const box = enemyBox(enemy);
  const b = biomeFor(S.run.floor);
  const spr = enemySprite(enemy.type, b);
  SCN.dying.push({ spr, x: box.x, y: box.y, w: box.w, h: box.h, t: 0 });
  addParticles(box.x + box.w / 2, box.y + box.h / 2, enemy.boss ? 40 : 14, enemyColors(enemy), enemy.boss ? 90 : 55, 0.6);
  addParticles(box.x + box.w / 2, box.y + box.h / 2, enemy.boss ? 16 : 5, ['#ffcc4d', '#fff2b0'], 50, 0.7, 60);
  shake(enemy.boss ? 5 : 1.5);
  hitStop(enemy.boss ? 120 : 60);
  SFX.kill();
  if (enemy.boss) vibrate([30, 40, 60]);
});

on('spawn', e => {
  if (e.boss) {
    banner('BOSS', e.name.toUpperCase(), '#ff5d6c', 2.4);
    SFX.boss();
    vibrate(80);
  } else if (e.type === 'goldie') {
    banner('TREASURE MOLE', 'DEFEAT IT BEFORE IT DIGS AWAY', '#ffcc4d', 1.8);
    SFX.ore();
  }
});

on('levelup', ({ level }) => {
  addFloat('LEVEL ' + level + '!', HERO_X + 8, GROUND_Y - 30, '#ffcc4d', 1, 1.4, -10);
  addParticles(HERO_X + 8, GROUND_Y - 10, 16, ['#ffcc4d', '#fff2b0', '#ffffff'], 50, 0.8, 30);
  SFX.levelup();
});

on('floor', ({ floor, newBiome }) => {
  if (newBiome) banner(biomeName(floor).toUpperCase(), 'B' + floor, '#ffffff', 2.4);
});

on('bossFail', () => {
  banner('BOSS ESCAPED', 'GET STRONGER, THEN TRY AGAIN', '#ff5d6c', 2.2);
  SFX.error();
});

on('treasureEscaped', () => {
  addFloat('IT GOT AWAY', ENEMY_X + 8, GROUND_Y - 24, '#ffcc4d', 1, 1.2, -10);
});

on('record', ({ floor }) => {
  banner('NEW RECORD', 'DEEPEST EVER: B' + floor, '#63e28a', 2.2);
});

const RANKS = [[5, 'C', '#62c9ff'], [10, 'B', '#63e28a'], [25, 'A', '#ffcc4d'], [50, 'S', '#ff5ad2'], [100, 'SS', '#ff4d6d']];
function comboRank(streak) {
  let r = null;
  for (const x of RANKS) if (streak >= x[0]) r = x;
  return r;
}

on('answer', res => {
  if (res.ok) {
    const r = comboRank(res.streak);
    if (r && r[0] === res.streak) {
      // Rank-up moment: fixed reward feel (no random bonus), flash, chord and a beat of freeze.
      SCN.rank = { text: 'RANK ' + r[1], color: r[2], t: 0 };
      SFX.rankUp(RANKS.indexOf(r) * 2);
      hitStop(90);
      shake(2);
      vibrate([20, 30, 40]);
      addParticles(HERO_X + 8, GROUND_Y - 20, 24, [r[2], '#ffffff'], 70, 0.8, 40);
    }
  } else if (res.lost >= 3) {
    SFX.comboBreak();
  }
  if (res.ok && res.quick) addFloat('QUICK!', HERO_X + 8, GROUND_Y - 26, '#63e28a', 1, 0.8, -16);
  if (res.ok && res.streak > 0 && res.streak % 10 === 0) {
    addFloat('STREAK ' + res.streak, HERO_X + 8, GROUND_Y - 36, '#ffcc4d', 1, 1.2, -10);
  }
  if (res.ok && res.streakRecord) addFloat('BEST STREAK!', HERO_X + 8, GROUND_Y - 44, '#63e28a', 1, 1.2, -8);
});

on('oreCollect', ({ x, y, res }) => {
  addParticles(x, y, 22, ['#ffd23f', '#fff6c0', '#ffffff'], 60, 0.8, 40);
  const label = res.kind === 'coins' ? '+' + fmt(res.amount) : res.kind === 'key' ? '+1 KEY' : 'FRENZY x3';
  addFloat(label, x, y - 6, '#ffcc4d', 1, 1.2, -10);
  SFX.ore();
  vibrate(20);
});

// Taps on the canvas collect lucky ore.
function canvasTap(clientX, clientY) {
  const rect = CV.el.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * LW;
  const y = ((clientY - rect.top) / rect.height) * LH;
  if (R.ore) {
    const dx = x - R.ore.x;
    const dy = y - R.ore.y;
    if (dx * dx + dy * dy <= 16 * 16) {
      collectOre();
      return true;
    }
  }
  // Fidget pops: tapping anything in the mine gives a tiny burst and click (no vibration).
  const b = BIOMES[biomeIndex(S.run.floor) % BIOMES.length];
  const e = R.enemy;
  let colors = [b.rock[2], b.oreColor, '#ffffff'];
  if (e && !e.waiting) {
    const box = enemyBox(e);
    if (x >= box.x - 4 && x <= box.x + box.w + 4 && y >= box.y - 4 && y <= box.y + box.h + 4) {
      e.flash = 0.05;
      colors = enemyColors(e);
    }
  }
  addParticles(x, y, 6, colors, 35, 0.4, 80);
  SFX.pop();
  return false;
}

// ---------- drawing ----------
function drawPets() {
  const ctx = CV.ctx;
  S.pets.eq.forEach((p, i) => {
    const def = PETS[p.sp];
    const spr = petSprite(p.sp);
    // Four party slots (after prestige 3) must all fit between the miner and the left edge.
    const x = HERO_X - 12 - i * 9;
    const phase = R.time * (def.fly ? 5 : 3) + i * 1.7;
    let y = def.fly ? GROUND_Y - 30 + Math.round(Math.sin(phase) * 2) : GROUND_Y - 10 - (Math.sin(phase) > 0.75 ? 1 : 0);
    if (!R.enemy || R.enemy.enter > 0) y -= SCN.step && !def.fly ? 1 : 0;
    if (!def.fly) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 2, GROUND_Y, 6, 1);
    }
    ctx.drawImage(spr, Math.round(x), Math.round(y));
    if (p.r >= 2 && Math.sin(R.time * 4 + i) > 0.85) {
      ctx.fillStyle = RARITY[p.r].color;
      ctx.fillRect(Math.round(x + rand(0, 10)), Math.round(y + rand(0, 10)), 1, 1);
    }
  });
}

function drawHero() {
  const ctx = CV.ctx;
  const walking = !R.enemy || R.enemy.enter > 0;
  const bob = walking ? (SCN.step ? 1 : 0) : Math.sin(R.time * 3) > 0.6 ? 1 : 0;
  const hx = HERO_X;
  const hy = GROUND_Y - 16 + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(hx + 3, GROUND_Y, 10, 1);
  ctx.drawImage(heroSprite(walking && SCN.step), hx, hy);
  const p = R.swingT > 0 ? 1 - R.swingT / 0.22 : -1;
  let a = 0.35;
  if (p >= 0) {
    if (p < 0.3) a = lerp(0.35, -0.9, p / 0.3);
    else if (p < 0.6) a = lerp(-0.9, 2.1, (p - 0.3) / 0.3);
    else a = lerp(2.1, 0.35, (p - 0.6) / 0.4);
  }
  const it = S.gear.eq.pick;
  ctx.save();
  ctx.translate(hx + 12.5, hy + 11.5);
  ctx.rotate(a);
  ctx.drawImage(pickSprite(it ? it.t : 0), -5.5, -11.5);
  ctx.restore();
  if (S.math.streak > 0) {
    if (S.math.streak > SCN.lastStreak) SCN.comboPop = 0.15;
    const lift = SCN.comboPop > 0 ? 2 : 0;
    drawText('×' + comboMult().toFixed(2), hx + 8, hy - 9 - lift, '#ffcc4d', 1, 'center');
  }
  SCN.lastStreak = S.math.streak;
}

function drawEnemy(biome) {
  const e = R.enemy;
  if (!e) return;
  const ctx = CV.ctx;
  const spr = enemySprite(e.type, biome);
  const box = enemyBox(e);
  const slide = e.enter > 0 ? (e.enter / ENTER_TIME) * 100 : 0;
  let x = box.x + slide + (e.flash > 0 ? 1 : 0);
  let y = box.y;
  let h = box.h;
  if (e.type === 'bat') y += Math.round(Math.sin(R.time * 6 + e.seed) * 2);
  else if (e.type === 'slime') {
    const sq = Math.round((Math.sin(R.time * 5 + e.seed) + 1) * 0.75) * (e.boss ? 2 : 1);
    y += sq;
    h -= sq;
  } else if (Math.sin(R.time * 2 + e.seed) > 0.7) y += 1;
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 3 * (e.boss ? 2 : 1), GROUND_Y, box.w - 6 * (e.boss ? 2 : 1), 1);
  // Squash on impact: wider and shorter for a moment, then back.
  let sw = box.w;
  if (e.flash > 0 && S.settings.juice !== 'low') {
    const k = e.flash / 0.07;
    sw = Math.round(box.w * (1 + 0.15 * k));
    const sh = Math.round(h * (1 - 0.15 * k));
    x -= Math.round((sw - box.w) / 2);
    y += h - sh;
    h = sh;
  }
  ctx.drawImage(e.flash > 0 ? silhouette(spr, '#ffffff') : spr, x, y, sw, h);
  if (e.boss) ctx.drawImage(crownSprite(), x + Math.round((box.w - 18) / 2), y - 9, 18, 10);
  if (e.type === 'goldie' && Math.sin(R.time * 9) > 0.3) {
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(x + Math.round(rand(2, 14)), y + Math.round(rand(6, 14)), 1, 1);
  }
  if (e.enter > 0) return;
  const bw = e.boss ? 32 : 20;
  const bx = Math.round(x + box.w / 2 - bw / 2);
  const by = y - (e.boss ? 14 : 5);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
  ctx.fillStyle = '#3a1420';
  ctx.fillRect(bx, by, bw, 2);
  ctx.fillStyle = e.boss ? '#ff3b5c' : e.type === 'goldie' ? '#ffcc4d' : '#ff5d6c';
  ctx.fillRect(bx, by, Math.max(0, Math.round((bw * Math.max(0, e.hp)) / e.max)), 2);
  if (e.boss) drawText(fmt(Math.max(0, e.hp)), bx + bw / 2, by - 7, '#ffffff', 1, 'center');
}

function drawDying(dt) {
  const ctx = CV.ctx;
  for (const d of SCN.dying) {
    d.t += dt;
    const k = d.t / 0.28;
    if (k >= 1) continue;
    ctx.globalAlpha = 1 - k;
    const img = Math.floor(d.t * 30) % 2 === 0 ? silhouette(d.spr, '#ffffff') : d.spr;
    const grow = Math.round(k * 4);
    ctx.drawImage(img, Math.round(d.x - grow / 2), Math.round(d.y - grow), d.w + grow, d.h + grow);
    ctx.globalAlpha = 1;
  }
  SCN.dying = SCN.dying.filter(d => d.t < 0.28);
}

function drawSlash(dt) {
  if (SCN.slash <= 0) return;
  const ctx = CV.ctx;
  const e = R.enemy;
  const box = enemyBox(e || { boss: false, type: 'slime' });
  const k = SCN.slash / 0.16;
  const color = SCN.slashKind === 'mega' ? '#ff5ad2' : SCN.slashKind === 'quick' ? '#63e28a' : '#62c9ff';
  ctx.globalAlpha = k;
  ctx.fillStyle = color;
  for (let i = 0; i < box.w + 8; i++) {
    const x = box.x - 4 + i;
    const y = box.y + Math.round((i / (box.w + 8)) * box.h);
    ctx.fillRect(x, y, 1, 2);
    if (SCN.slashKind === 'mega') ctx.fillRect(x, box.y + box.h - Math.round((i / (box.w + 8)) * box.h), 1, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(box.x + box.w / 2 - 1, box.y + box.h / 2 - 1, 3, 3);
  ctx.globalAlpha = 1;
  SCN.slash -= dt;
}

function drawParticles(dt) {
  const ctx = CV.ctx;
  for (const p of SCN.parts) {
    p.t += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > GROUND_Y - 1 && p.vy > 0) {
      p.y = GROUND_Y - 1;
      p.vy *= -0.3;
      p.vx *= 0.6;
    }
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  SCN.parts = SCN.parts.filter(p => p.t < p.life);
}

function drawOre() {
  const o = R.ore;
  if (!o) return;
  if (o.life < 2 && Math.floor(o.life * 8) % 2 === 0) return;
  const ctx = CV.ctx;
  const y = o.y + Math.round(Math.sin(R.time * 4) * 1.5);
  const r = 7 + Math.round(Math.sin(R.time * 6) * 1);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(Math.round(o.x - r / 2), Math.round(y - r / 2), r, r);
  ctx.globalAlpha = 1;
  ctx.drawImage(iconSprite('nugget'), Math.round(o.x - 4), Math.round(y - 4));
  const t = Math.floor(R.time * 6) % 4;
  ctx.fillStyle = '#ffffff';
  const sx = Math.round(o.x + [5, -6, 4, -5][t]);
  const sy = Math.round(y + [-5, -3, 4, 3][t]);
  ctx.fillRect(sx, sy - 1, 1, 3);
  ctx.fillRect(sx - 1, sy, 3, 1);
}

function drawFloats(dt) {
  for (const f of SCN.floats) {
    f.t += dt;
    f.y += f.vy * dt;
    const a = f.t > f.life * 0.6 ? 1 - (f.t - f.life * 0.6) / (f.life * 0.4) : 1;
    const pop = f.t < 0.1 ? 1 + 0.3 * (1 - f.t / 0.1) * juice() : 1;
    if (pop > 1.01) {
      const ctx = CV.ctx;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(pop, pop);
      drawText(f.text, 0, 0, f.color, f.s, 'center', a);
      ctx.restore();
    } else drawText(f.text, f.x, f.y, f.color, f.s, 'center', a);
  }
  SCN.floats = SCN.floats.filter(f => f.t < f.life);
}

function drawOverlay(dt) {
  const ctx = CV.ctx;
  const f = S.run.floor;
  drawText('B' + f, 3, 3, '#ffffff', 2);
  if (isBossFloor(f)) {
    drawText('BOSS', 3, 16, '#ff5d6c', 1);
  } else {
    for (let i = 0; i < KILLS_PER_FLOOR; i++) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(3 + i * 5, 16, 4, 4);
      ctx.fillStyle = i < S.run.kills ? '#ffcc4d' : '#3d3150';
      ctx.fillRect(4 + i * 5, 17, 2, 2);
    }
  }
  const e = R.enemy;
  if (e && e.boss && e.waiting) {
    if (Math.floor(R.time * 2) % 2 === 0) drawText('TAP FIGHT BOSS', 156, 3, '#ffcc4d', 1, 'right');
  } else if (e && e.boss) {
    const k = clamp(e.timer / BOSS_TIME, 0, 1);
    const blink = e.timer < 5 && Math.floor(R.time * 6) % 2 === 0;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(43, 3, 92, 5);
    ctx.fillStyle = '#3a1420';
    ctx.fillRect(44, 4, 90, 3);
    ctx.fillStyle = blink ? '#ffffff' : '#ff5d6c';
    ctx.fillRect(44, 4, Math.round(90 * k), 3);
    drawText(Math.ceil(Math.max(0, e.timer)) + 'S', 156, 3, '#ffffff', 1, 'right');
  } else if (e && e.type === 'goldie') {
    const k = clamp(e.flee / TREASURE_TIME, 0, 1);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(43, 3, 92, 5);
    ctx.fillStyle = '#ffcc4d';
    ctx.fillRect(44, 4, Math.round(90 * k), 3);
  }
  let ry = e && (e.boss || e.type === 'goldie') ? 11 : 3;
  if (R.frenzyT > 0) {
    drawText('FRENZY ×3', 157, ry, Math.floor(R.time * 5) % 2 ? '#ff5d6c' : '#ffcc4d', 1, 'right');
    ry += 7;
    ctx.strokeStyle = 'rgba(255,93,108,' + (0.35 + Math.sin(R.time * 10) * 0.2) + ')';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, LW - 1, LH - 1);
  }
  if (ST.boost > 1) drawText('2× COINS', 157, ry, '#ffcc4d', 1, 'right');
  if (SCN.rank) {
    const r = SCN.rank;
    r.t += dt;
    if (r.t < 0.06) {
      ctx.globalAlpha = 0.35 * juice();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LW, LH);
      ctx.globalAlpha = 1;
    }
    const a = r.t < 0.9 ? 1 : 1 - (r.t - 0.9) / 0.4;
    drawText(r.text, LW / 2, 22 - Math.min(4, r.t * 10), r.color, 2, 'center', a);
    if (r.t > 1.3) SCN.rank = null;
  }
  if (SCN.banner) {
    const b = SCN.banner;
    b.t += dt;
    const a = b.t < 0.2 ? b.t / 0.2 : b.t > b.life - 0.4 ? (b.life - b.t) / 0.4 : 1;
    ctx.globalAlpha = Math.max(0, a * 0.55);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 30, LW, b.sub ? 24 : 16);
    ctx.globalAlpha = 1;
    drawText(b.text, LW / 2, 33, b.color, 2, 'center', a);
    if (b.sub) drawText(b.sub, LW / 2, 46, '#ffffff', 1, 'center', a);
    if (b.t >= b.life) SCN.banner = null;
  }
}

function render(dt) {
  const ctx = CV.ctx;
  if (!ctx) return;
  ctx.setTransform(CV.k, 0, 0, CV.k, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const walking = !R.enemy || R.enemy.enter > 0;
  if (walking) {
    SCN.scroll += 70 * dt;
    SCN.stepT += dt;
    if (SCN.stepT > 0.14) {
      SCN.stepT = 0;
      SCN.step = !SCN.step;
    }
  } else {
    SCN.step = false;
  }
  if (SCN.comboPop > 0) SCN.comboPop -= dt;
  let sx = 0;
  let sy = 0;
  if (SCN.trauma > 0) {
    if (S.settings.shake) {
      const amp = 4 * juice() * SCN.trauma * SCN.trauma;
      const t = R.time * 30;
      sx = Math.round(amp * (Math.sin(t * 1.3) + Math.sin(t * 2.7 + 1)) / 2);
      sy = Math.round(amp * (Math.sin(t * 1.9 + 2) + Math.sin(t * 3.1)) / 2);
    }
    SCN.trauma = Math.max(0, SCN.trauma - dt * 3.5);
  }
  const bi = biomeIndex(S.run.floor);
  const layers = biomeLayers(bi);
  const biome = BIOMES[bi % BIOMES.length];
  ctx.fillStyle = biome.bg[0];
  ctx.fillRect(0, 0, LW, LH);
  ctx.save();
  ctx.translate(sx, sy);
  const wo = Math.floor(SCN.scroll * 0.35) % LW;
  ctx.drawImage(layers.wall, -wo, 0);
  ctx.drawImage(layers.wall, LW - wo, 0);
  const go = Math.floor(SCN.scroll) % LW;
  ctx.drawImage(layers.ground, -go, GROUND_Y);
  ctx.drawImage(layers.ground, LW - go, GROUND_Y);
  drawPets();
  drawEnemy(biome);
  drawHero();
  drawDying(dt);
  drawSlash(dt);
  drawParticles(dt);
  drawOre();
  drawFloats(dt);
  ctx.restore();
  drawOverlay(dt);
}
