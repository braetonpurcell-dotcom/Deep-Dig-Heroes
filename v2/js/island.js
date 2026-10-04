'use strict';
// Version 2 home screen, rough draft: a small top-down world in the style of Stardew Valley or
// Pokemon. You start on the spawn plaza (quest board, leaderboard sign, your miner) and swipe to
// look around. Dirt roads lead from the plaza to the cave in the mountains, the forge, the temple,
// the market, your house, the lighthouse and the dock. Every door faces down, so its path comes in
// from below. The world is pixel art painted once into a 640x960 canvas; the camera shows part of
// it. Buildings and signs are plain buttons in a layer that moves with the camera.

const WW = 640, WH = 960; // world size in world pixels
const WORLD = { cv: null, ctx: null, img: null, cam: { x: 0, y: 0 }, z: 2, vx: 0, vy: 0, drag: null, moved: false, t: 0, smoke: [], dpr: 1, vw: 0, vh: 0 };
const SPAWN = { x: 320, y: 540, r: 54 };

// Places: tap box (x, y, w, h) in world pixels. 'lb' opens the leaderboard.
const BUILDINGS = [
  { tab: 'fight', name: 'Cave', x: 284, y: 150, w: 72, h: 54 },
  { tab: 'forge', name: 'Forge', x: 114, y: 390, w: 84, h: 80 },
  { tab: 'skills', name: 'Temple', x: 436, y: 392, w: 96, h: 80 },
  { tab: 'cases', name: 'Market', x: 104, y: 574, w: 92, h: 52 },
  { tab: 'bag', name: 'House', x: 448, y: 550, w: 80, h: 80 },
  { tab: 'quests', name: 'Quests', x: 268, y: 490, w: 44, h: 32 },
  { tab: 'lb', name: 'Leaderboard', x: 334, y: 490, w: 34, h: 32 },
  { tab: 'more', name: 'Lighthouse', x: 146, y: 776, w: 36, h: 78 },
  { tab: 'dock', name: 'Dock', x: 300, y: 900, w: 40, h: 60 },
];
// Roads wind naturally between places. Each is a smooth curve through these points; a spur's last
// stretch runs straight up into its door, so every road still comes in from below.
const ROADS = [
  [[320, 488], [314, 440], [328, 380], [306, 320], [318, 262], [320, 230], [320, 206]], // north to the cave
  [[268, 548], [226, 560], [186, 544], [140, 552], [96, 538], [56, 550]], // west road
  [[372, 548], [418, 560], [466, 540], [518, 552], [560, 540], [604, 548]], // east road
  [[320, 592], [308, 656], [334, 730], [312, 806], [322, 870], [320, 902]], // south road to the dock
  [[182, 546], [164, 522], [156, 496], [156, 482], [156, 470]], // forge
  [[458, 546], [478, 520], [486, 494], [486, 482], [486, 470]], // temple
  [[98, 540], [82, 586], [92, 638], [124, 660], [150, 652], [150, 640], [150, 626]], // market, in from below
  [[562, 542], [570, 600], [548, 652], [512, 664], [488, 652], [488, 642], [488, 630]], // house, in from below
  [[314, 822], [262, 864], [206, 880], [168, 872], [164, 862], [164, 852]], // lighthouse
];
// Each road as a dense list of points along its curve (Catmull-Rom).
const ROAD_PTS = ROADS.map(pts => {
  const out = [], n = pts.length, at = i => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    for (let t = 0; t < 1; t += 0.05) {
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)));
    }
  }
  out.push(pts[n - 1]);
  return out;
});
function nearRoad(x, y, dist) {
  for (const l of ROAD_PTS) for (const [px0, py0] of l) if (Math.abs(px0 - x) < dist && Math.abs(py0 - y) < dist && Math.hypot(px0 - x, py0 - y) < dist) return true;
  return false;
}

// ---------- pixel helpers ----------
function wg() { return WORLD.ctx; }
function px(x, y, w, h, c) { const g = wg(); g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pell(cx, cy, rx, ry, c) {
  const g = wg(); g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) { const h = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - h), Math.round(cy + y), h * 2, 1); }
}
function prng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- painting the world once ----------
function paintWorld() {
  const cv = makeCanvas(WW, WH), prev = WORLD.ctx;
  WORLD.ctx = cv.getContext('2d');
  const r = prng(17);
  // Grass with speckles and tufts.
  px(0, 0, WW, WH, '#5fae45');
  for (let i = 0; i < 9000; i++) px(r() * WW, r() * WH, r() < 0.5 ? 2 : 1, 1, r() < 0.5 ? '#549c3c' : '#6dbe50');
  for (let i = 0; i < 500; i++) { const x = r() * WW, y = r() * WH; px(x, y, 1, 3, '#478a33'); px(x + 2, y - 1, 1, 4, '#4f9839'); px(x + 4, y, 1, 3, '#478a33'); }
  // Sea and beach along the south.
  for (let x = 0; x < WW; x += 2) {
    const shore = 896 + Math.round(Math.sin(x / 37) * 5 + Math.sin(x / 11) * 2);
    px(x, shore - 14, 2, 14, '#e8cf8f'); px(x, shore - 15, 2, 1, '#d6b874');
    px(x, shore, 2, WH - shore, '#3a8fd8'); px(x, shore, 2, 3, '#bfe9f5');
  }
  for (let i = 0; i < 260; i++) { const x = r() * WW, y = 910 + r() * 50; px(x, y, 3 + r() * 4, 1, '#6fb6ec'); }
  // Mountains along the north, with the cave in the middle.
  for (let x = 0; x < WW; x += 2) {
    const top = 140 + Math.round(Math.sin(x / 23) * 14 + Math.sin(x / 7) * 4);
    px(x, 0, 2, top + 60, '#7d7486');
    px(x, top + 40, 2, 20, '#655d70');
    px(x, top + 58, 2, 4, '#4a4352');
  }
  for (let i = 0; i < 700; i++) { const x = r() * WW, y = r() * 190; px(x, y, 2 + r() * 4, 1, r() < 0.5 ? '#8f86a0' : '#665e72'); }
  for (let i = 0; i < 40; i++) { const x = r() * WW, y = 20 + r() * 150; pell(x, y, 4 + r() * 6, 3 + r() * 3, '#8f86a0'); pell(x - 1, y - 1, 2 + r() * 3, 1 + r() * 2, '#a39aad'); }
  // Roads (pixel tiles with a darker edge), then the plaza and its spawn pad.
  paintRoads();
  pell(SPAWN.x, SPAWN.y, SPAWN.r + 3, SPAWN.r - 6, '#8a7f72');
  pell(SPAWN.x, SPAWN.y, SPAWN.r, SPAWN.r - 9, '#c9bfae');
  for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (SPAWN.r - 8); px(SPAWN.x + Math.cos(a) * d, SPAWN.y + Math.sin(a) * d * 0.8, 6, 4, r() < 0.5 ? '#b8ad9a' : '#d6ccbb'); }
  pell(SPAWN.x, SPAWN.y + 8, 14, 9, '#8a7f72'); pell(SPAWN.x, SPAWN.y + 7, 12, 7, '#a39784');
  pell(SPAWN.x, SPAWN.y + 6, 8, 4, '#7ad8ff');
  // Trees: thick at the edges, a few inland, never on roads, buildings or the plaza.
  const blocked = (x, y) => {
    if (Math.hypot(x - SPAWN.x, (y - SPAWN.y) * 1.15) < SPAWN.r + 20) return true;
    if (y < 222 || y > 872) return true;
    for (const b of BUILDINGS) if (x > b.x - 18 && x < b.x + b.w + 18 && y > b.y - 10 && y < b.y + b.h + 30) return true;
    return nearRoad(x, y + 6, 22);
  };
  const trees = [];
  for (let i = 0; i < 900; i++) {
    const x = r() * WW, y = 220 + r() * 660, edge = Math.min(x, WW - x);
    if (edge > 70 && r() < 0.8) continue;
    if (blocked(x, y) || trees.some(t => Math.hypot(t.x - x, t.y - y) < 18)) continue;
    trees.push({ x, y, kind: r() < 0.6 ? 'oak' : 'pine' });
  }
  for (let i = 0; i < 40; i++) { const x = 40 + r() * 560, y = 240 + r() * 620; if (!blocked(x, y)) flowerBed(x, y, r); }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) (t.kind === 'oak' ? oak : pine)(t.x, t.y);
  paintCave(); paintForge(); paintTemple(); paintMarket(); paintHouse(); paintBoard(); paintLbSign(); paintLighthouse(); paintDock();
  WORLD.ctx = prev;
  return cv;
}

function paintRoads() {
  const cell = 4, cols = WW / cell, rows = WH / cell, grid = new Uint8Array(cols * rows);
  // Mark every 4px cell within the road's half-width of its curve, so curves stay pixel-crisp.
  for (const l of ROAD_PTS) for (const [x0, y0] of l) {
    for (let cy = Math.floor((y0 - 11) / cell); cy <= Math.floor((y0 + 11) / cell); cy++) for (let cx = Math.floor((x0 - 11) / cell); cx <= Math.floor((x0 + 11) / cell); cx++) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if (Math.hypot(cx * cell + 2 - x0, cy * cell + 2 - y0) <= 10.5) grid[cy * cols + cx] = 1;
    }
  }
  const r = prng(5), on = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && grid[y * cols + x];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!on(x, y)) continue;
    const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
    px(x * cell, y * cell, cell, cell, edge ? '#a07a46' : r() < 0.15 ? '#c29a5c' : r() < 0.15 ? '#dcbb80' : '#cfaa6c');
  }
}

function shadowAt(x, y, rx) { pell(x, y, rx, Math.max(2, Math.round(rx / 4)), 'rgba(20,50,20,0.35)'); }
function oak(x, y) {
  shadowAt(x + 2, y + 1, 9);
  px(x - 2, y - 8, 4, 9, '#6b4526'); px(x - 2, y - 8, 1, 9, '#8a6038');
  pell(x, y - 15, 10, 9, '#2f7d3a'); pell(x - 2, y - 17, 7, 6, '#3f9a44'); pell(x - 3, y - 19, 4, 3, '#5cb853');
}
function pine(x, y) {
  shadowAt(x + 2, y + 1, 7);
  px(x - 1, y - 5, 3, 6, '#5a3a1e');
  for (let i = 0; i < 18; i++) { const w = 2 + Math.floor(i * 0.7); px(x - w, y - 23 + i, w * 2, 1, i % 6 < 3 ? '#2a6e3a' : '#337f44'); }
  px(x - 1, y - 24, 2, 2, '#337f44');
}
function flowerBed(x, y, r) {
  for (let i = 0; i < 6; i++) { const fx = x + (r() - 0.5) * 14, fy = y + (r() - 0.5) * 8; px(fx, fy, 2, 2, ['#fff6e0', '#ffd94d', '#ff8fb1', '#b9a2ff'][i % 4]); px(fx, fy + 2, 1, 1, '#2f7d3a'); }
}
// A wall with a stepped roof: the shape of every house.
function hut(x, y, w, h, wall, wallDark, roof, roofDark, roofH) {
  shadowAt(x + w / 2 + 3, y + h + 2, w / 2 + 2);
  px(x, y + roofH, w, h - roofH, wall); px(x, y + h - 3, w, 3, wallDark);
  for (let i = 0; i < roofH; i++) px(x - 4 + i * 0.5, y + i, w + 8 - i, 1, i % 3 === 2 ? roofDark : roof);
  px(x - 4, y + roofH - 2, w + 8, 2, roofDark);
}
function door(cx, bottom, w, h, c) { px(cx - w / 2 - 1, bottom - h - 1, w + 2, h + 1, '#3a2416'); px(cx - w / 2, bottom - h, w, h, c); px(cx + w / 2 - 3, bottom - h / 2, 1, 2, '#ffcc4d'); }
function pwin(x, y) { px(x - 1, y - 1, 10, 9, '#3a2416'); px(x, y, 8, 7, '#ffe08a'); px(x + 3.5, y, 1, 7, '#3a2416'); px(x, y + 3, 8, 1, '#3a2416'); }

function paintCave() {
  pell(320, 186, 26, 22, '#3a3344'); px(294, 186, 52, 18, '#3a3344');
  pell(320, 188, 20, 17, '#120c18'); px(300, 188, 40, 16, '#120c18');
  px(292, 168, 6, 36, '#7a5230'); px(342, 168, 6, 36, '#7a5230'); px(288, 164, 64, 6, '#6b4526'); px(288, 164, 64, 2, '#9a6c40');
  for (let y = 190; y < 204; y += 3) px(310, y, 20, 1, '#5d4027');
  px(312, 188, 2, 16, '#9aa0a8'); px(326, 188, 2, 16, '#9aa0a8');
}
function paintForge() {
  hut(118, 404, 76, 66, '#8f8698', '#6b6273', '#b8443a', '#8a2f2a', 26);
  for (let yy = 436; yy < 464; yy += 6) for (let xx = 120 + (yy % 12 ? 6 : 0); xx < 190; xx += 12) px(xx, yy, 10, 1, '#7a7186');
  px(176, 392, 10, 22, '#6b6273'); px(174, 390, 14, 4, '#4d4655');
  px(124, 444, 18, 22, '#2a1a12'); px(126, 447, 14, 19, '#ff8a2a'); px(129, 452, 8, 14, '#ffd04d');
  door(156, 470, 12, 18, '#6b4526');
  px(174, 456, 14, 4, '#3e3846'); px(177, 460, 8, 6, '#3e3846');
}
function paintTemple() {
  shadowAt(486, 472, 48);
  px(440, 462, 92, 8, '#b8aa8a'); px(446, 456, 80, 7, '#d8cca8');
  px(450, 420, 72, 37, '#efe6d0');
  for (const xx of [452, 466, 500, 514]) { px(xx, 420, 6, 36, '#fffaf0'); px(xx + 4, 420, 2, 36, '#d8ccae'); }
  for (let i = 0; i < 24; i++) px(440 + i, 396 + 24 - i, 92 - i * 2, 1, i % 3 ? '#f0b92c' : '#c8901a');
  px(440, 418, 92, 3, '#a87010');
  px(483, 386, 6, 10, '#7ad8ff'); px(484, 384, 4, 2, '#bfefff');
  door(486, 456, 14, 22, '#3a2a10');
}
function paintMarket() {
  hut(108, 574, 84, 52, '#3f7fb8', '#2c5f8c', '#4a9ae0', '#2c5f8c', 16);
  for (let s = 0; s < 8; s++) px(104 + s * 11.5, 590, 11.5, 8, s % 2 ? '#f2f6ff' : '#4a9ae0');
  px(116, 600, 68, 22, '#1f3550');
  const chest = (x, top) => { px(x, 610, 14, 10, '#3a2416'); px(x + 1, 611, 12, 8, '#8a5a2a'); px(x + 1, 611, 12, 3, top); px(x + 6, 614, 2, 2, '#ffe08a'); };
  chest(120, '#b07a3a'); chest(136, '#5aa0e0'); chest(152, '#e0566b'); chest(168, '#ffcc4d');
  door(150, 626, 14, 6, '#8a5a2a');
}
function paintHouse() {
  hut(452, 566, 72, 64, '#e8dcc6', '#c4b6a0', '#e0566b', '#a8303a', 26);
  px(452, 604, 72, 2, '#a36a3a');
  pwin(460, 610); pwin(508, 610);
  door(488, 630, 12, 18, '#7a4a24');
  px(506, 552, 9, 18, '#a36a3a'); px(504, 550, 13, 3, '#7a4a24');
}
function paintBoard() {
  px(274, 506, 3, 16, '#5e3d22'); px(303, 506, 3, 16, '#5e3d22');
  px(270, 492, 40, 18, '#7a4a24'); px(272, 494, 36, 14, '#c88a4a');
  px(276, 496, 8, 10, '#fff8e8'); px(286, 497, 7, 8, '#ffe8a8'); px(295, 496, 9, 10, '#fff8e8');
}
function paintLbSign() {
  px(349, 508, 3, 14, '#5e3d22');
  px(336, 492, 30, 18, '#7a4a24'); px(338, 494, 26, 14, '#e8b84a');
  px(347, 496, 8, 2, '#8a5a10'); px(349, 498, 4, 5, '#8a5a10'); px(347, 503, 8, 2, '#8a5a10');
}
function paintLighthouse() {
  pell(148, 850, 8, 5, '#6b6273'); pell(181, 848, 7, 5, '#6b6273');
  for (let i = 0; i < 56; i++) { const w = 22 - Math.floor(i / 8); px(164 - w / 2, 852 - i, w, 1, Math.floor(i / 9) % 2 ? '#b76dff' : '#f6f0ff'); }
  px(154, 790, 20, 6, '#3e3846'); px(156, 784, 16, 8, '#ffe08a'); px(158, 778, 12, 6, '#8a4fc8');
  door(164, 852, 8, 12, '#3a2a4a');
}
function paintDock() {
  px(304, 900, 32, 60, '#a36a3a');
  for (let y = 900; y < 960; y += 6) px(304, y, 32, 1, '#7a4a24');
  px(302, 900, 2, 60, '#5e3d22'); px(336, 900, 2, 60, '#5e3d22');
  px(342, 930, 22, 8, '#8a5a2a'); px(344, 938, 18, 3, '#5a3218');
}

// ---------- each frame: the visible part of the world, plus the moving bits ----------
function drawWorld(dt) {
  const g = WORLD.ctx, dpr = WORLD.dpr, z = WORLD.z;
  WORLD.t += dt;
  const t = WORLD.t;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#3a8fd8'; g.fillRect(0, 0, WORLD.cv.width, WORLD.cv.height);
  g.setTransform(dpr * z, 0, 0, dpr * z, -WORLD.cam.x * dpr * z, -WORLD.cam.y * dpr * z);
  g.imageSmoothingEnabled = false;
  g.drawImage(WORLD.img, 0, 0);
  for (let i = 0; i < 30; i++) if (Math.sin(t * 2 + i * 1.7) > 0.7) { g.fillStyle = '#d8f2ff'; g.fillRect((i * 83) % WW, 912 + ((i * 37) % 44), 4, 1); }
  if (Math.random() < dt * 2) WORLD.smoke.push({ x: 180, y: 388, t: 0 });
  for (const s of WORLD.smoke) { s.t += dt; s.y -= dt * 8; s.x += dt * 3; g.fillStyle = `rgba(220,218,228,${Math.max(0, 0.6 - s.t * 0.15)})`; g.fillRect(Math.round(s.x), Math.round(s.y), 3 + Math.round(s.t), 3 + Math.round(s.t)); }
  WORLD.smoke = WORLD.smoke.filter(s => s.t < 4);
  if (typeof bossWaiting === 'function' && bossWaiting() && Math.floor(t * 2) % 2) { g.fillStyle = 'rgba(200,30,50,0.6)'; g.fillRect(304, 192, 32, 12); }
  g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); g.fillStyle = '#bff2ff'; g.fillRect(SPAWN.x - 6, SPAWN.y + 4, 12, 4); g.globalAlpha = 1;
  g.drawImage(heroSprite(0), SPAWN.x - 8, SPAWN.y - 10 + (Math.floor(t * 2) % 2), 16, 16);
}

// ---------- camera: swipe to look around, with a little glide ----------
function clampCam() {
  const vw = WORLD.vw / WORLD.z, vh = WORLD.vh / WORLD.z;
  WORLD.cam.x = Math.max(0, Math.min(WW - vw, WORLD.cam.x));
  WORLD.cam.y = Math.max(0, Math.min(WH - vh, WORLD.cam.y));
}
function placeLayer() {
  const layer = $('#worldLayer');
  if (layer) layer.style.transform = `translate(${-WORLD.cam.x * WORLD.z}px, ${-WORLD.cam.y * WORLD.z}px) scale(${WORLD.z})`;
}
function bindSwipe(el) {
  el.addEventListener('pointerdown', e => {
    WORLD.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
    WORLD.moved = false; WORLD.vx = WORLD.vy = 0;
  });
  el.addEventListener('pointermove', e => {
    const d = WORLD.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, now = performance.now(), dt = Math.max(1, now - d.t);
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) WORLD.moved = true;
    WORLD.cam.x -= dx / WORLD.z; WORLD.cam.y -= dy / WORLD.z;
    WORLD.vx = ((-dx / WORLD.z) / dt) * 16; WORLD.vy = ((-dy / WORLD.z) / dt) * 16;
    d.x = e.clientX; d.y = e.clientY; d.t = now;
    clampCam(); placeLayer();
  });
  const end = e => { if (WORLD.drag && WORLD.drag.id === e.pointerId) WORLD.drag = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  // A swipe that ends on a building must not open it.
  el.addEventListener('click', e => { if (WORLD.moved) { e.stopPropagation(); e.preventDefault(); WORLD.moved = false; } }, true);
}
function centerOnSpawn() {
  WORLD.cam.x = SPAWN.x - WORLD.vw / WORLD.z / 2; WORLD.cam.y = SPAWN.y - WORLD.vh / WORLD.z / 2 + 10;
  WORLD.vx = WORLD.vy = 0; clampCam(); placeLayer();
}

// ---------- screen ----------
function islandHtml() {
  let h = `<div class="world" id="world"><canvas id="worldCv" aria-hidden="true"></canvas><div class="isle" id="worldLayer" style="width:${WW}px;height:${WH}px">`;
  for (const b of BUILDINGS) {
    const act = b.tab === 'lb' ? 'data-lb="open"' : `data-go="${b.tab}"`;
    h += `<button class="bld" ${act} aria-label="${b.name}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"></button>`;
    h += `<button class="sign" ${act} aria-label="${b.name}" style="left:${b.x + b.w / 2}px;top:${b.y - 9}px">${b.name}<small id="isl-${b.tab}"></small><i class="dot"></i></button>`;
  }
  h += `<div class="signpost" style="left:${SPAWN.x}px;top:${SPAWN.y + SPAWN.r + 2}px">↑ Cave · ← Forge, Market<br>→ Temple, House · ↓ Lighthouse</div>`;
  h += '</div><button class="toSpawn" id="toSpawn" aria-label="Back to spawn">⌂ Spawn</button></div>';
  return h;
}

function buildIsland() {
  const sec = $('#tab-island');
  if (!sec.childElementCount) {
    sec.innerHTML = islandHtml();
    WORLD.cv = $('#worldCv');
    WORLD.ctx = WORLD.cv.getContext('2d');
    WORLD.img = paintWorld();
    bindSwipe($('#world'));
    $('#toSpawn').addEventListener('click', e => { e.stopPropagation(); centerOnSpawn(); SFX.click(); });
    sizeIsland();
    centerOnSpawn();
  } else sizeIsland();
  updateIslandSigns();
  updateBadges();
}

function sizeIsland() {
  const w = $('#world');
  if (!w || UI.tab !== 'island') return;
  WORLD.vw = w.clientWidth; WORLD.vh = w.clientHeight;
  if (!WORLD.vw || !WORLD.vh) return;
  WORLD.dpr = Math.min(3, window.devicePixelRatio || 1);
  WORLD.z = Math.max(1.6, WORLD.vw / 210); // about 210 world pixels across a phone
  WORLD.cv.width = Math.round(WORLD.vw * WORLD.dpr); WORLD.cv.height = Math.round(WORLD.vh * WORLD.dpr);
  clampCam(); placeLayer();
}
window.addEventListener('resize', sizeIsland);

function updateIslandSigns() {
  const set = (tab, txt) => { const el = $('#isl-' + tab); if (el && el.textContent !== txt) el.textContent = txt; };
  set('fight', bossWaiting() ? 'Boss!' : 'B' + S.run.floor);
  set('skills', S.run.sp > 0 ? S.run.sp + ' pts' : '');
  set('cases', freeCrateReady() ? 'Free!' : '');
  set('more', canPrestige() ? 'Prestige' : '');
  set('dock', 'Soon');
}

function islandLoop(now) {
  requestAnimationFrame(islandLoop);
  if (UI.tab !== 'island' || document.hidden || !WORLD.img) { WORLD.last = now; return; }
  const dt = Math.min(0.1, (now - (WORLD.last || now)) / 1000);
  WORLD.last = now;
  if (!WORLD.drag && (Math.abs(WORLD.vx) > 0.05 || Math.abs(WORLD.vy) > 0.05)) {
    WORLD.cam.x += WORLD.vx; WORLD.cam.y += WORLD.vy; WORLD.vx *= 0.9; WORLD.vy *= 0.9; clampCam(); placeLayer();
  }
  drawWorld(dt);
  if ((WORLD.signT = (WORLD.signT || 0) + dt) > 0.5) { WORLD.signT = 0; updateIslandSigns(); }
}
requestAnimationFrame(islandLoop);

// Buildings open their screen; the phone's back gesture (or the back button) returns to the world.
function goBuilding(tab) {
  audioUnlock();
  SFX.click();
  if (tab === 'dock') { toast('Boats to new islands are coming soon', 'gold'); return; }
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
