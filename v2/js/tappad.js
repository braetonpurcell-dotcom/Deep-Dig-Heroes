'use strict';
// Tap pad: monsters pop up on a cave wall inside a shrinking ring. Tap one before its ring closes
// to grow the multiplier; one that escapes costs some of it. How fast they come is set by the
// session pace in engine.js (tapDifficulty), which settles where you hit most but not all of them.

const TAP = { on: false, targets: [], spawnT: 0.3, raf: 0, last: 0, bgKey: '', nextId: 1 };
// Phone screens report a tap a little after the finger lands, so a monster stays tappable for a
// moment after its ring closes.
const TAP_GRACE = 0.12;
const RING_GROW = 1.3; // the ring starts 2.3x the monster's size and shrinks to it
function ringScale(t) { return 1 + RING_GROW * Math.max(0, 1 - t.age / t.life); }

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

// A pixel-art cave wall in the current biome's colors, drawn at the pad's own size in crisp 3x pixels
// (close to the fight view's scale): rough cobblestones lit on top and shaded underneath, dark gaps,
// cracks, and ore glinting in a few stones. Kept dim so the monsters stand out. Redrawn when the
// biome or the pad's size changes.
const TAP_PX = 3;
function tapBackground() {
  const b = biomeFor(S.run.floor), pad = $('#tappad');
  const W = Math.max(32, Math.ceil(pad.clientWidth / TAP_PX)), H = Math.max(24, Math.ceil(pad.clientHeight / TAP_PX));
  const key = `${b.name}|${W}x${H}`;
  if (TAP.bgKey === key) return;
  TAP.bgKey = key;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const rng = mulberry32(hashStr(b.name));
  const [mid, dark, light] = b.rock;
  g.fillStyle = b.bg[0];
  g.fillRect(0, 0, W, H);
  for (let y = -4, row = 0; y < H; row++) {
    const sh = 7 + Math.floor(rng() * 5);
    for (let x = -Math.floor(rng() * 14); x < W;) {
      const sw = 9 + Math.floor(rng() * 14), tone = rng();
      const body = tone < 0.6 ? mid : tone < 0.85 ? dark : shade(mid, 0.08);
      // the stone, with its corners knocked off
      g.fillStyle = body; g.fillRect(x + 1, y + 1, sw - 2, sh - 2); g.fillRect(x + 2, y, sw - 4, sh);
      g.fillStyle = light; g.fillRect(x + 2, y + 1, sw - 4, 1); g.fillRect(x + 1, y + 2, 1, Math.max(1, sh - 5));
      g.fillStyle = shade(dark, -0.25); g.fillRect(x + 2, y + sh - 2, sw - 4, 1); g.fillRect(x + sw - 2, y + 2, 1, sh - 4);
      if (rng() < 0.3) { // a crack
        g.fillStyle = shade(dark, -0.35);
        let cx = x + 3 + Math.floor(rng() * (sw - 6)), cy = y + 2;
        for (let k = 0; k < sh - 4; k++) { g.fillRect(cx, cy + k, 1, 1); if (rng() < 0.4) cx += rng() < 0.5 ? -1 : 1; }
      }
      if (rng() < 0.18) { // an ore fleck
        const ox = x + 3 + Math.floor(rng() * (sw - 6)), oy = y + 3 + Math.floor(rng() * Math.max(1, sh - 6));
        g.fillStyle = shade(b.oreColor, -0.3); g.fillRect(ox, oy, 2, 2);
        g.fillStyle = b.oreColor; g.fillRect(ox, oy, 1, 1);
        if (rng() < 0.5) { g.fillStyle = shade(b.oreColor, 0.6); g.fillRect(ox + 1, oy - 1, 1, 1); }
      }
      x += sw;
    }
    y += sh;
  }
  // dim it so the monsters stand out, darkest at the edges
  g.fillStyle = b.bg[0]; g.globalAlpha = 0.45; g.fillRect(0, 0, W, H);
  const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, W, H);
  pad.style.backgroundImage = `url(${c.toDataURL()})`;
  pad.style.backgroundSize = `${W * TAP_PX}px ${H * TAP_PX}px`;
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
  const pad = $('#tappad');
  const sh = shieldActive();
  if (pad.classList.contains('shielded') !== sh) pad.classList.toggle('shielded', sh);
  if (!paused) {
    for (const t of TAP.targets.slice()) {
      t.age += dt;
      const k = t.age / t.life;
      t.ring.style.transform = `scale(${ringScale(t)})`;
      t.ring.classList.toggle('late', k > 0.7);
      if (t.age >= t.life + TAP_GRACE) tapEscape(t);
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
  // Anywhere inside the gold ring counts (it shrinks as time runs out), and never less than a
  // little more than the monster itself. The nearest monster wins.
  let best = null;
  let bestD = Infinity;
  for (const t of TAP.targets) {
    const dd = Math.hypot(t.x - x, t.y - y);
    const reach = Math.max(t.size * 0.62, (t.size / 2) * ringScale(t) + 6);
    if (dd < reach && dd < bestD) { best = t; bestD = dd; }
  }
  if (!best) { tapFloat(x, y, '·', 'dust'); SFX.pop(); return; }
  const res = tapHit(Math.max(0, 1 - best.age / best.life));
  tapRemove(best, 'hit');
  tapFloat(best.x, best.y - best.size / 2, res.perfect ? 'PERFECT' : 'HIT', res.perfect ? 'perfect' : 'good');
}

function tapEscape(t) {
  const res = tapMiss();
  tapRemove(t, 'miss');
  tapFloat(t.x, t.y - t.size / 2, res.shielded ? 'SAFE' : res.lost ? `-${res.lost}` : 'MISS', res.shielded ? 'safe' : 'miss');
}

on('floor', () => { if (TAP.on) tapBackground(); });
