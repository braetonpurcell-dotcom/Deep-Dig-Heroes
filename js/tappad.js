'use strict';
// Tap pad: monsters pop up on a cave wall inside a shrinking ring. Tap one before its ring closes
// to grow the multiplier; one that escapes costs some of it. The higher the multiplier, the faster
// the rings close and the more monsters show at once, so the combo settles where your reactions are.

const TAP = { on: false, targets: [], spawnT: 0.3, raf: 0, last: 0, bgKey: '', nextId: 1 };

function tapActive() { return S.settings.answer === 'tap'; }

// Everything scales with the current multiplier m (1x at no combo).
function tapDifficulty() {
  const k = comboMult() - 1;
  return {
    life: clamp(1.6 / (1 + 0.42 * k), 0.45, 1.6), // seconds before the ring closes
    max: clamp(1 + Math.floor(k * 1.25), 1, 6), // monsters on screen at once
    size: clamp(76 - 5 * k, 50, 76), // px
  };
}

function applyTapMode() {
  const on = tapActive();
  $('#tab-fight').classList.toggle('in-tap', on);
  $('#tappad').hidden = !on;
  if (on) tapStart();
  else tapStop();
}

function tapStart() {
  if (TAP.on) return;
  TAP.on = true;
  TAP.last = performance.now();
  tapBackground();
  TAP.raf = requestAnimationFrame(tapFrame);
}

function tapStop() {
  TAP.on = false;
  cancelAnimationFrame(TAP.raf);
  for (const t of TAP.targets) t.el.remove();
  TAP.targets = [];
}

// A pixel-art cave wall in the current biome's colors, redrawn when the biome changes.
function tapBackground() {
  const b = biomeFor(S.run.floor);
  if (TAP.bgKey === b.name) return;
  TAP.bgKey = b.name;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 72;
  const g = c.getContext('2d');
  const rng = mulberry32(hashStr(b.name));
  g.fillStyle = b.bg[0];
  g.fillRect(0, 0, 96, 72);
  for (let i = 0; i < 46; i++) {
    const w = 4 + Math.floor(rng() * 12);
    const h = 3 + Math.floor(rng() * 7);
    const x = Math.floor(rng() * 96) - 4;
    const y = Math.floor(rng() * 72) - 3;
    g.fillStyle = b.rock[i % 3 === 0 ? 2 : i % 2];
    g.globalAlpha = 0.35 + rng() * 0.3;
    g.fillRect(x, y, w, h);
    g.fillRect(x + 1, y - 1, w - 2, h + 2);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 4 ? b.rock[1] : b.oreColor;
    g.fillRect(Math.floor(rng() * 96), Math.floor(rng() * 72), 1, 1);
  }
  $('#tappad').style.backgroundImage = `url(${c.toDataURL()})`;
}

function tapEnemyUrl(type) {
  const b = biomeFor(S.run.floor);
  return spriteUrl(enemySprite(type, b), 4, `tapenemy:${type}:${b.name}`);
}

function tapSpawn(d) {
  const pad = $('#tappad');
  const W = pad.clientWidth;
  const H = pad.clientHeight;
  if (W < 80 || H < 80) return;
  const r = d.size / 2;
  // Keep monsters apart so every one can be tapped on its own.
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 16; tries++) {
    x = rand(r + 6, W - r - 6);
    y = rand(r + 6, H - r - 6);
    if (TAP.targets.every(t => Math.hypot(t.x - x, t.y - y) > (t.size / 2 + r) * 1.15)) break;
  }
  const type = weightedPick(NORMAL_ENEMIES.filter(t => ENEMIES[t].minFloor <= S.run.floor), t => ENEMIES[t].weight);
  const el = document.createElement('div');
  el.className = 'tapmon';
  el.style.cssText = `left:${x}px;top:${y}px;width:${d.size}px;height:${d.size}px`;
  el.innerHTML = `<span class="tapring"></span><img src="${tapEnemyUrl(type)}" alt="">`;
  pad.appendChild(el);
  TAP.targets.push({ id: TAP.nextId++, el, ring: el.firstChild, x, y, size: d.size, age: 0, life: d.life });
}

function tapFrame(now) {
  if (!TAP.on) return;
  const dt = Math.min(0.1, (now - TAP.last) / 1000);
  TAP.last = now;
  // The pad freezes (rings included) whenever you can't see it.
  const paused = UI.tab !== 'fight' || UI.modalOpen || MG.active || document.hidden;
  if (!paused) {
    for (const t of TAP.targets.slice()) {
      t.age += dt;
      const k = t.age / t.life;
      t.ring.style.transform = `scale(${1 + 1.3 * Math.max(0, 1 - k)})`;
      t.ring.classList.toggle('late', k > 0.7);
      if (k >= 1) tapEscape(t);
    }
    TAP.spawnT -= dt;
    const d = tapDifficulty();
    if (TAP.spawnT <= 0 && TAP.targets.length < d.max) {
      tapSpawn(d);
      TAP.spawnT = d.life * rand(0.18, 0.35);
    }
  }
  TAP.raf = requestAnimationFrame(tapFrame);
}

function tapRemove(t, cls) {
  TAP.targets = TAP.targets.filter(x => x !== t);
  t.el.classList.add(cls);
  setTimeout(() => t.el.remove(), 260);
}

function tapFloat(x, y, text, cls) {
  const f = document.createElement('div');
  f.className = 'tapfloat ' + cls;
  f.style.cssText = `left:${x}px;top:${y}px`;
  f.textContent = text;
  $('#tappad').appendChild(f);
  setTimeout(() => f.remove(), 650);
}

function tapPointer(e) {
  if (!TAP.on) return;
  e.preventDefault();
  audioUnlock();
  const rect = $('#tappad').getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Forgiving hit area: a little bigger than the monster, nearest one wins.
  let best = null;
  let bestD = Infinity;
  for (const t of TAP.targets) {
    const dd = Math.hypot(t.x - x, t.y - y);
    if (dd < t.size * 0.62 && dd < bestD) { best = t; bestD = dd; }
  }
  if (!best) { tapFloat(x, y, '·', 'dust'); SFX.pop(); return; }
  const quality = 1 - best.age / best.life;
  const res = tapHit(quality);
  tapRemove(best, 'hit');
  tapFloat(best.x, best.y - best.size / 2, res.perfect ? 'PERFECT' : 'HIT', res.perfect ? 'perfect' : 'good');
  SFX.correct(res.streak);
  vibrate(res.perfect ? 14 : 8);
  if (res.bonus) emit('bonusDone', res.bonus);
}

function tapEscape(t) {
  const lost = tapMiss();
  tapRemove(t, 'miss');
  tapFloat(t.x, t.y - t.size / 2, lost ? `-${lost}` : 'MISS', 'miss');
  if (lost >= 3) SFX.comboBreak();
  else SFX.wrong();
  vibrate(35);
}

document.addEventListener('DOMContentLoaded', () => {
  const pad = $('#tappad');
  if (pad) pad.addEventListener('pointerdown', tapPointer);
});
on('floor', () => { if (TAP.on) tapBackground(); });
