'use strict';
// Version 2 home screen: an island instead of a tab bar. Each building opens one screen
// (the cave is the fight, the forge is the forge, and so on) and a back button returns here.
// The scene is drawn as pixel art on its own canvas; the buildings are plain buttons on top,
// so they work with screen readers and never miss a tap.

const ISLE_W = 180;
const ISLE_H = 270;
const ISLE = { cv: null, ctx: null, k: 0, t: 0, raf: 0, smoke: [], h: ISLE_H, oy: 0 }; // h: canvas height in island pixels, oy: island offset so the sea fills the screen

// Where each building sits, in island pixels: the hotspot box and its sign.
const BUILDINGS = [
  { tab: 'fight', name: 'Cave', x: 58, y: 34, w: 64, h: 62 },
  { tab: 'forge', name: 'Forge', x: 14, y: 100, w: 52, h: 50 },
  { tab: 'skills', name: 'Shrine', x: 118, y: 92, w: 50, h: 60 },
  { tab: 'cases', name: 'Market', x: 14, y: 166, w: 52, h: 46 },
  { tab: 'bag', name: 'House', x: 116, y: 164, w: 52, h: 48 },
  { tab: 'quests', name: 'Quests', x: 70, y: 206, w: 40, h: 40 },
  { tab: 'more', name: 'Lighthouse', x: 140, y: 214, w: 36, h: 52 },
];

// ---------- drawing helpers ----------
function ip(x, y, w, h, c) { ISLE.ctx.fillStyle = c; ISLE.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function iellipse(cx, cy, rx, ry, c) {
  ISLE.ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ISLE.ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}
// A small seeded random so the island looks the same every time it's drawn.
function irng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- static layer: ground, paths and buildings (drawn once, then copied each frame) ----------
function islandBase() {
  const c = makeCanvas(ISLE_W, ISLE_H);
  const prev = ISLE.ctx;
  ISLE.ctx = c.getContext('2d');
  const r = irng(7);
  // Shallow water ring, sand, grass.
  iellipse(90, 150, 90, 122, '#2a7a8c');
  iellipse(90, 150, 82, 114, '#e8cf8f');
  iellipse(90, 150, 78, 110, '#d9bd7a');
  iellipse(90, 146, 71, 100, '#4f9a4a');
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = 90 + Math.cos(a) * 66 * d, y = 146 + Math.sin(a) * 94 * d;
    ip(x, y, 2, 1, r() < 0.5 ? '#3f8a3e' : '#63ad55');
  }
  // Paths from the plaza to every building.
  const plaza = [90, 160];
  const path = (x, y) => {
    const n = Math.ceil(Math.hypot(x - plaza[0], y - plaza[1]) / 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      ip(plaza[0] + (x - plaza[0]) * t - 3, plaza[1] + (y - plaza[1]) * t - 2, 6, 4, '#c9a96a');
    }
  };
  path(90, 96); path(42, 140); path(142, 140); path(42, 196); path(140, 198); path(90, 222); path(152, 236);
  iellipse(90, 160, 13, 9, '#c9a96a');
  iellipse(90, 160, 9, 6, '#d8bb80');
  ip(88, 158, 4, 4, '#8fd0e8'); // fountain
  ip(89, 155, 2, 3, '#bfe9f5');

  drawCave(); drawForge(); drawShrine(); drawMarket(); drawHouse(); drawBoard(); drawLighthouse();
  // Palm trees around the shore.
  for (const [x, y] of [[26, 92], [150, 84], [20, 214], [104, 254], [60, 252], [166, 150]]) drawPalm(x, y);
  ISLE.ctx = prev;
  return c;
}

function drawPalm(x, y) {
  ip(x, y - 14, 2, 14, '#7a5230');
  ip(x + 1, y - 14, 1, 14, '#5e3d22');
  const g = '#2f7d3a', l = '#4fae4a';
  ip(x - 7, y - 17, 7, 2, g); ip(x + 2, y - 17, 7, 2, g);
  ip(x - 5, y - 19, 5, 2, l); ip(x + 2, y - 19, 5, 2, l);
  ip(x - 1, y - 21, 4, 3, l);
  ip(x - 8, y - 15, 2, 2, g); ip(x + 8, y - 15, 2, 2, g);
  ip(x - 1, y - 15, 2, 2, '#6b3d1e'); ip(x + 2, y - 15, 2, 2, '#6b3d1e');
}

function drawCave() {
  // A rocky hill with a dark mouth and two torches.
  iellipse(90, 82, 38, 28, '#4d4655');
  iellipse(90, 78, 34, 25, '#6b6273');
  iellipse(80, 70, 18, 12, '#7d7486');
  iellipse(104, 74, 12, 9, '#5d5566');
  for (const [x, y] of [[66, 70], [110, 64], [94, 58], [74, 86], [112, 86]]) ip(x, y, 3, 2, '#3e3846');
  iellipse(90, 92, 13, 12, '#120c18');
  ip(77, 92, 26, 10, '#120c18');
  iellipse(90, 92, 10, 9, '#1d1428');
  ip(80, 92, 20, 10, '#1d1428');
  ip(76, 101, 28, 2, '#3e3846');
  ip(72, 86, 2, 9, '#7a5230'); ip(106, 86, 2, 9, '#7a5230');
  // A minecart track running in.
  for (let i = 0; i < 4; i++) ip(84 + i * 3, 103 + i * 0, 2, 1, '#8a6a4a');
  ip(83, 104, 14, 1, '#5d4a3a');
}

function drawForge() {
  ip(20, 120, 40, 26, '#7d7486');
  ip(20, 120, 40, 2, '#9a91a3');
  for (let i = 0; i < 6; i++) ip(22 + (i % 3) * 13 + (i > 2 ? 6 : 0), 126 + (i > 2 ? 8 : 0), 8, 1, '#5d5566');
  // Roof and chimney.
  for (let i = 0; i < 10; i++) ip(16 + i, 120 - i, 48 - i * 2, 1, i % 3 ? '#a8443a' : '#8a3530');
  ip(48, 100, 7, 16, '#5d5566');
  ip(47, 99, 9, 2, '#4d4655');
  // Glowing door and anvil.
  ip(34, 132, 12, 14, '#2a1a12');
  ip(36, 134, 8, 12, '#ff9a3d');
  ip(37, 136, 6, 10, '#ffcc4d');
  ip(22, 140, 9, 3, '#3e3846'); ip(24, 143, 5, 3, '#3e3846');
}

function drawShrine() {
  // A pale tower with a glowing star on top (skills).
  ip(130, 110, 26, 38, '#d8cfe6');
  ip(130, 110, 3, 38, '#b8aecb');
  ip(153, 110, 3, 38, '#b8aecb');
  ip(127, 146, 32, 4, '#9a91a3');
  for (let i = 0; i < 8; i++) ip(126 + i, 110 - i, 34 - i * 2, 1, '#7a4fc0');
  ip(138, 128, 10, 18, '#2a1a3a');
  iellipse(143, 128, 5, 4, '#2a1a3a');
  ip(140, 132, 6, 14, '#5a3a8a');
  ip(132, 118, 4, 5, '#5a3a8a'); ip(150, 118, 4, 5, '#5a3a8a');
}

function drawMarket() {
  // A striped tent with a chest out front (cases).
  for (let i = 0; i < 12; i++) ip(18 + i * 1.5, 182 - i, 44 - i * 3, 1, '#f2e9d8');
  for (let s = 0; s < 4; s++) for (let i = 0; i < 12; i++) ip(18 + s * 11 + i * 0.4, 182 - i, 5, 1, '#e0566b');
  ip(20, 182, 40, 22, '#e8dcc6');
  for (let s = 0; s < 5; s++) ip(20 + s * 9, 182, 4, 22, '#e0566b');
  ip(32, 190, 16, 14, '#3a2416');
  ip(36, 194, 10, 8, '#8a5a2a');
  ip(36, 194, 10, 2, '#b07a3a');
  ip(40, 197, 2, 2, '#ffcc4d');
}

function drawHouse() {
  // A wooden cottage (bag).
  ip(124, 182, 40, 24, '#8a5a2a');
  for (let i = 0; i < 4; i++) ip(124, 186 + i * 5, 40, 1, '#6e4520');
  for (let i = 0; i < 12; i++) ip(120 + i, 182 - i, 48 - i * 2, 1, i % 2 ? '#3a6a8a' : '#2f5874');
  ip(140, 192, 9, 14, '#3a2416');
  ip(147, 198, 1, 2, '#ffcc4d');
  ip(128, 188, 8, 7, '#ffe08a'); ip(131, 188, 1, 7, '#8a5a2a'); ip(128, 191, 8, 1, '#8a5a2a');
  ip(153, 188, 8, 7, '#ffe08a'); ip(156, 188, 1, 7, '#8a5a2a'); ip(153, 191, 8, 1, '#8a5a2a');
}

function drawBoard() {
  // A notice board with pinned papers (quests).
  ip(78, 228, 2, 14, '#5e3d22'); ip(100, 228, 2, 14, '#5e3d22');
  ip(75, 214, 30, 16, '#7a5230');
  ip(76, 215, 28, 14, '#a8744a');
  ip(79, 217, 7, 9, '#f2e9d8'); ip(88, 216, 6, 7, '#f2e9d8'); ip(96, 218, 6, 8, '#ffe8a8');
  ip(81, 219, 3, 1, '#7a6a5a'); ip(81, 221, 4, 1, '#7a6a5a'); ip(89, 218, 4, 1, '#7a6a5a'); ip(97, 220, 4, 1, '#7a6a5a');
  ip(74, 212, 32, 2, '#5e3d22');
}

function drawLighthouse() {
  // A small lighthouse on the rocks (settings, stats, prestige).
  iellipse(158, 258, 14, 6, '#5d5566');
  for (let i = 0; i < 30; i++) {
    const w = 10 - Math.floor(i / 6);
    ip(158 - w / 2, 252 - i, w, 1, Math.floor(i / 5) % 2 ? '#e0566b' : '#f2e9d8');
  }
  ip(152, 219, 12, 4, '#3e3846');
  ip(154, 214, 8, 5, '#ffe08a');
  ip(152, 212, 12, 2, '#3e3846');
  ip(156, 209, 4, 3, '#3e3846');
}

// ---------- animated layer: sea, smoke, torches, the shrine star, the beam ----------
function drawIsland(dt) {
  if (!ISLE.ctx) return;
  ISLE.t += dt;
  const t = ISLE.t, g = ISLE.ctx;
  g.setTransform(ISLE.k, 0, 0, ISLE.k, 0, 0);
  g.imageSmoothingEnabled = false;
  const sea = g.createLinearGradient(0, 0, 0, ISLE.h);
  sea.addColorStop(0, '#103650'); sea.addColorStop(1, '#0b2438');
  g.fillStyle = sea;
  g.fillRect(0, 0, ISLE_W, ISLE.h);
  // Drifting wave dashes.
  for (let i = 0; i < 40 * ISLE.h / ISLE_H; i++) {
    const y = (i * 37) % ISLE.h, x = ((i * 53 + t * (6 + (i % 3) * 3)) % (ISLE_W + 20)) - 10;
    ip(x, y, 5, 1, i % 2 ? '#1f5a78' : '#2a6d8c');
  }
  g.setTransform(ISLE.k, 0, 0, ISLE.k, 0, ISLE.oy * ISLE.k); // the island sits in the middle of the sea
  // Foam ring breathing in and out.
  const f = Math.sin(t * 1.5) * 1.5;
  iellipse(90, 150, 92 + f, 124 + f, 'rgba(190,233,245,0.18)');
  g.drawImage(ISLE.base, 0, 0);
  // Torches by the cave.
  for (const x of [72, 106]) {
    const fl = Math.sin(t * 13 + x) > 0;
    ip(x - 1, 83, 4, 3, fl ? '#ffcc4d' : '#ff9a3d');
    ip(x, 81, 2, 2, fl ? '#ff9a3d' : '#ffcc4d');
  }
  // Boss waiting: a red glow in the cave mouth.
  if (typeof bossWaiting === 'function' && bossWaiting() && Math.floor(t * 2) % 2 === 0) ip(84, 92, 12, 9, '#5a1420');
  // Forge smoke.
  if (Math.random() < dt * 3) ISLE.smoke.push({ x: 51 + Math.random() * 2, y: 97, t: 0 });
  for (const s of ISLE.smoke) {
    s.t += dt; s.y -= dt * 6; s.x += dt * 2;
    const a = Math.max(0, 0.55 - s.t * 0.15);
    ip(s.x, s.y, 3 + s.t, 3 + s.t, `rgba(200,195,210,${a})`);
  }
  ISLE.smoke = ISLE.smoke.filter(s => s.t < 4);
  // Shrine star pulses.
  const p = 0.6 + Math.sin(t * 3) * 0.4;
  g.globalAlpha = p;
  ip(141, 96, 4, 4, '#ffe08a'); ip(142, 94, 2, 8, '#ffe08a'); ip(139, 97, 8, 2, '#ffe08a');
  g.globalAlpha = 1;
  // Lighthouse beam sweeps.
  const b = (Math.sin(t * 1.2) + 1) / 2;
  g.globalAlpha = 0.18;
  g.fillStyle = '#ffe08a';
  g.beginPath();
  g.moveTo(160, 216);
  g.lineTo(200, 190 + b * 50);
  g.lineTo(200, 202 + b * 50);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  // Fountain sparkle.
  if (Math.floor(t * 4) % 2) ip(89, 154, 1, 1, '#ffffff');
}

// ---------- screen ----------
function islandHtml() {
  let h = '<div class="isle-wrap"><div class="isle" id="isle"><canvas id="islandCv" aria-hidden="true"></canvas>';
  for (const b of BUILDINGS) {
    h += `<button class="bld" data-go="${b.tab}" aria-label="${b.name}"><span class="sign">${b.name}<small id="isl-${b.tab}"></small></span><i class="dot"></i></button>`;
  }
  return h + '</div></div>';
}

function buildIsland() {
  const sec = $('#tab-island');
  if (!sec.childElementCount) {
    sec.innerHTML = islandHtml();
    ISLE.cv = $('#islandCv');
    ISLE.ctx = ISLE.cv.getContext('2d');
    ISLE.base = islandBase();
    sizeIsland();
  }
  sizeIsland();
  updateIslandSigns();
  updateBadges();
}

// Fit the island into the space under the HUD, keeping its shape, and draw it at a whole-pixel scale.
function sizeIsland() {
  const wrap = $('#tab-island .isle-wrap'), isle = $('#isle');
  if (!wrap || !isle || UI.tab !== 'island') return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  // Fit the island's width (or its height on a wide screen), then let the sea fill whatever is left.
  const w = Math.min(W, (H * ISLE_W) / ISLE_H);
  ISLE.h = Math.max(ISLE_H, Math.round((H / w) * ISLE_W));
  ISLE.oy = Math.floor((ISLE.h - ISLE_H) / 2);
  isle.style.width = w + 'px';
  isle.style.height = (w * ISLE.h) / ISLE_W + 'px';
  const dpr = window.devicePixelRatio || 1;
  ISLE.k = Math.max(1, Math.round((w * dpr) / ISLE_W));
  ISLE.cv.width = ISLE_W * ISLE.k;
  ISLE.cv.height = ISLE.h * ISLE.k;
  for (const b of BUILDINGS) {
    const el = $(`.bld[data-go="${b.tab}"]`);
    if (el) el.setAttribute('style', `left:${(b.x / ISLE_W) * 100}%;top:${((b.y + ISLE.oy) / ISLE.h) * 100}%;width:${(b.w / ISLE_W) * 100}%;height:${(b.h / ISLE.h) * 100}%`);
  }
}
window.addEventListener('resize', sizeIsland);

function updateIslandSigns() {
  const set = (tab, txt) => { const el = $('#isl-' + tab); if (el && el.textContent !== txt) el.textContent = txt; };
  set('fight', bossWaiting() ? 'Boss!' : 'B' + S.run.floor);
  set('skills', S.run.sp > 0 ? S.run.sp + ' pts' : '');
  set('cases', freeCrateReady() ? 'Free!' : '');
  set('more', canPrestige() ? 'Prestige' : '');
}

// The island animates only while it's on screen.
function islandLoop(now) {
  ISLE.raf = requestAnimationFrame(islandLoop);
  if (UI.tab !== 'island' || document.hidden || !ISLE.ctx) { ISLE.last = now; return; }
  const dt = Math.min(0.1, (now - (ISLE.last || now)) / 1000);
  ISLE.last = now;
  drawIsland(dt);
  if ((ISLE.signT = (ISLE.signT || 0) + dt) > 0.5) { ISLE.signT = 0; updateIslandSigns(); }
}
requestAnimationFrame(islandLoop);

// Buildings open their screen; the phone's back gesture (or the back button) returns to the island.
function goBuilding(tab) {
  audioUnlock();
  SFX.click();
  if (UI.tab === 'island') history.pushState({ ddh: tab }, '');
  showTab(tab);
}
function goIsland() {
  if (history.state && history.state.ddh) history.back();
  else showTab('island');
}
window.addEventListener('popstate', () => {
  if (UI.modalOpen && UI.modalOpts && UI.modalOpts.dismissable) closeModal();
  if (UI.tab !== 'island') showTab('island');
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { goBuilding(b.dataset.go); return; }
  if (e.target.closest('#homeBtn')) goIsland();
});
