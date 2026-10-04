'use strict';
// Version 2 home screen, rough draft: a side-scrolling route in the spirit of the old Pokemon
// games. The world is one long strip that fills the screen top to bottom; you swipe left and right
// only. You start at the far left in town on the spawn plaza (quest board, leaderboard sign, your
// miner, your house), then the road heads east past the market, the forge and the temple, over a
// wooden bridge across the river (lighthouse and dock), through tall grass to the mountain and the
// cave. Every door faces down and a short path comes up into it from the road.

const WW = 1200, WH = 300; // world size in world pixels
const WORLD = { cv: null, ctx: null, img: null, cam: { x: 0, y: 0 }, z: 2, vx: 0, drag: null, moved: false, t: 0, smoke: [], dpr: 1, vw: 0, vh: 0 };
const SPAWN = { x: 110, y: 200 };
const RIVER = [748, 872]; // the river's west and east banks
const DOOR_Y = 168; // the bottom of every door on the north side of the road

// Places: tap box (x, y, w, h) in world pixels and the door's x. 'lb' opens the leaderboard.
const BUILDINGS = [
  { tab: 'quests', name: 'Quests', x: 66, y: 140, w: 40, h: 30, dx: 86 },
  { tab: 'lb', name: 'Leaderboard', x: 120, y: 140, w: 34, h: 30, dx: 137 },
  { tab: 'bag', name: 'House', x: 200, y: 104, w: 80, h: 66, dx: 240 },
  { tab: 'cases', name: 'Market', x: 320, y: 112, w: 92, h: 58, dx: 366 },
  { tab: 'forge', name: 'Forge', x: 462, y: 98, w: 84, h: 72, dx: 502 },
  { tab: 'skills', name: 'Temple', x: 590, y: 92, w: 96, h: 78, dx: 638 },
  { tab: 'more', name: 'Lighthouse', x: 790, y: 92, w: 36, h: 78, dx: 808 },
  { tab: 'dock', name: 'Dock', x: 834, y: 214, w: 28, h: 56, dx: 848 },
  { tab: 'fight', name: 'Cave', x: 1110, y: 112, w: 70, h: 58, dx: 1145 },
];
// Each building is painted at a fixed spot in its own paint function; this moves it into place.
const SHIFT = { more: 698, cases: 126, bag: -140, quests: -490, lb: -490, town: -456, forge: -298, skills: -310 };
// The road: a gentle winding curve from the dock to the cave.
const ROAD = [[40, 200], [110, 200], [180, 204], [260, 197], [350, 205], [440, 198], [530, 206], [620, 198], [700, 204],
  [760, 200], [860, 200], [930, 206], [1010, 198], [1080, 204], [1120, 190], [1145, 180], [1145, 170]];
const ROAD_PTS = (() => {
  const out = [], n = ROAD.length, at = i => ROAD[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    for (let t = 0; t < 1; t += 0.05) {
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)));
    }
  }
  out.push(ROAD[n - 1]);
  return out;
})();
function roadY(x) { let best = ROAD_PTS[0]; for (const p of ROAD_PTS) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return best[1]; }

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
  // Grass in 16px tiles, the classic checker of light dots.
  px(0, 0, WW, WH, '#78c850');
  for (let ty = 0; ty < WH; ty += 16) for (let tx = 0; tx < WW; tx += 16) {
    px(tx + 3, ty + 4, 1, 1, '#68b040'); px(tx + 11, ty + 10, 1, 1, '#68b040'); px(tx + 7, ty + 13, 1, 1, '#90d868'); px(tx + 13, ty + 3, 1, 1, '#90d868');
  }
  // The river, crossing the whole strip.
  for (let y = 0; y < WH; y += 2) {
    const w0 = RIVER[0] + Math.round(Math.sin(y / 17) * 4), w1 = RIVER[1] + Math.round(Math.sin(y / 13 + 2) * 4);
    px(w0 - 3, y, 3, 2, '#d8c078'); px(w0, y, w1 - w0, 2, '#4890f8'); px(w1, y, 3, 2, '#d8c078');
  }
  for (let i = 0; i < 120; i++) px(RIVER[0] + 6 + r() * (RIVER[1] - RIVER[0] - 16), r() * WH, 4 + r() * 3, 1, '#78b0f8');
  // The mountain in the east, with the cave.
  for (let x = 1070; x < WW; x += 2) {
    const top = 20 + Math.max(0, (1120 - x) * 1.2) + Math.round(Math.sin(x / 9) * 3);
    px(x, top, 2, 186 - top, '#a08870'); px(x, top, 2, 3, '#c0a888'); px(x, 182, 2, 4, '#685038');
  }
  for (let i = 0; i < 120; i++) { const x = 1090 + r() * 110, y = 30 + r() * 140; px(x, y, 3 + r() * 5, 1, r() < 0.5 ? '#887058' : '#b89c80'); }
  // Tall grass patches south of the road, and on the route east.
  for (const [x0, y0, w, h] of [[400, 228, 64, 32], [600, 230, 64, 30], [900, 222, 96, 40], [940, 96, 80, 56], [1030, 230, 56, 32]]) tallGrass(x0, y0, w, h);
  // Ledges on the route (you could hop down them).
  for (const [x0, y0, w] of [[900, 270, 80], [1000, 214, 60]]) { px(x0, y0, w, 3, '#589838'); px(x0, y0 + 3, w, 2, '#407828'); }
  // A pond south of town.
  pell(250, 248, 30, 14, '#4890f8'); pell(242, 244, 10, 3, '#b0d8ff');
  for (let i = 0; i < 360; i += 30) { const a = (i * Math.PI) / 180; px(250 + Math.cos(a) * 31, 248 + Math.sin(a) * 15, 3, 2, '#f8e8a8'); }
  // The road, then the plaza.
  paintRoad();
  pell(SPAWN.x, SPAWN.y, 46, 22, '#a89880'); pell(SPAWN.x, SPAWN.y, 43, 20, '#d8d0c0');
  for (let ty = SPAWN.y - 20; ty < SPAWN.y + 20; ty += 8) for (let tx = SPAWN.x - 44; tx < SPAWN.x + 44; tx += 8) if (((tx - SPAWN.x) / 43) ** 2 + ((ty - SPAWN.y) / 20) ** 2 < 0.8) px(tx, ty, 7, 1, '#c0b8a8');
  pell(SPAWN.x, SPAWN.y + 4, 12, 6, '#a89880'); pell(SPAWN.x, SPAWN.y + 3, 10, 4, '#78d0f8');
  // Flowers by the road.
  const inRiver = x => x > RIVER[0] - 12 && x < RIVER[1] + 12;
  for (let i = 0; i < 60; i++) { const x = 40 + r() * 1040, y = 214 + r() * 50; if (Math.abs(y - roadY(x)) > 16 && !inRiver(x) && !(x > 214 && x < 286 && y > 230)) flower(x, y, r); }
  // Tree borders top, bottom and at the west edge, and trees between buildings.
  for (let x = 0; x < 1110; x += 16) { if (inRiver(x)) continue; tree(x, 18); if (!inRiver(x + 8)) tree(x + 8, 34); }
  for (let x = 0; x < 1090; x += 16) { if (inRiver(x)) continue; tree(x, 290); if (!inRiver(x + 8)) tree(x + 8, 274); }
  for (let y = 50; y < 270; y += 16) { if (Math.abs(y - 200) < 20) continue; tree(10, y); tree(26, y + 8); }
  for (const x of [178, 300, 434, 570, 712, 900, 1060]) tree(x, 150);
  // Picket fences round the house garden and the forge yard.
  fence(190, 180, 100); fence(452, 180, 104);
  // Buildings.
  const at = (k, fn) => { const g = wg(); g.save(); g.translate(SHIFT[k] || 0, 0); fn(); g.restore(); };
  at('more', paintLighthouse); at('cases', paintMarket); at('bag', paintHouse); at('quests', paintBoard); at('lb', paintLbSign);
  at('forge', paintForge); at('skills', paintTemple); paintCave(); at('town', paintTownSign); paintDock();
  WORLD.ctx = prev;
  return cv;
}

function paintRoad() {
  const cell = 4, cols = WW / cell, rows = WH / cell, grid = new Uint8Array(cols * rows);
  const mark = (x0, y0, rad) => {
    for (let cy = Math.floor((y0 - rad) / cell); cy <= Math.floor((y0 + rad) / cell); cy++) for (let cx = Math.floor((x0 - rad) / cell); cx <= Math.floor((x0 + rad) / cell); cx++) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if (Math.hypot(cx * cell + 2 - x0, cy * cell + 2 - y0) <= rad - 0.5) grid[cy * cols + cx] = 1;
    }
  };
  for (const [x, y] of ROAD_PTS) mark(x, y, 11);
  // A short path up from the road into every door.
  for (const b of BUILDINGS) {
    if (b.tab === 'dock' || b.tab === 'fight') continue;
    for (let y = roadY(b.dx); y >= DOOR_Y + 6; y -= 2) mark(b.dx, y, 7);
  }
  for (let y = roadY(848); y <= 262; y += 2) mark(848, y, 7); // the dock runs south into the river
  const r = prng(5), on = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && grid[y * cols + x];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!on(x, y)) continue;
    const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
    const wx = x * cell;
    if (wx >= RIVER[0] - 4 && wx < RIVER[1] + 4) px(wx, y * cell, cell, cell, edge ? '#603810' : y % 2 ? '#a87040' : '#c89060'); // wooden planks
    else px(wx, y * cell, cell, cell, edge ? '#b89858' : r() < 0.12 ? '#d0b878' : '#e0c890');
  }
}

function tree(x, y) {
  px(x - 7, y - 2, 14, 4, 'rgba(0,40,0,0.25)');
  px(x - 2, y - 6, 4, 6, '#785028');
  pell(x, y - 13, 8, 8, '#306830'); pell(x, y - 14, 7, 6, '#48a048'); pell(x - 2, y - 16, 3, 2, '#78c870');
}
function tallGrass(x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y += 8) for (let x = x0; x < x0 + w; x += 8) {
    px(x, y, 8, 8, '#58a838');
    px(x + 1, y + 2, 1, 5, '#307820'); px(x + 3, y + 1, 1, 6, '#307820'); px(x + 5, y + 2, 1, 5, '#307820');
    px(x + 2, y + 1, 1, 2, '#90d868'); px(x + 6, y + 1, 1, 2, '#90d868');
  }
}
function flower(x, y, r) { const c = r() < 0.5 ? '#f85858' : '#f8f848'; px(x, y, 3, 1, c); px(x + 1, y - 1, 1, 3, c); px(x + 1, y, 1, 1, '#f8f8f8'); px(x + 1, y + 2, 1, 2, '#307820'); }
function fence(x0, y, w) {
  for (let x = x0; x < x0 + w; x += 6) { if (Math.abs(x + 2 - (x0 + w / 2)) < 10) continue; px(x, y - 8, 3, 9, '#f8f8f8'); px(x, y - 8, 3, 1, '#c0c0c0'); px(x + 2, y - 7, 1, 8, '#a8a8a8'); }
  px(x0, y - 5, w, 1, '#d8d8d8');
}
// The classic little house: wall, roof with eaves, door at the bottom middle.
function hut(x, y, w, h, wall, wallDark, roof, roofDark, roofH) {
  px(x + 3, y + h, w - 2, 3, 'rgba(0,40,0,0.25)');
  px(x, y + roofH, w, h - roofH, wall); px(x, y + h - 2, w, 2, wallDark);
  for (let i = 0; i < roofH; i++) px(x - 3, y + i, w + 6, 1, i % 4 === 3 ? roofDark : roof);
  px(x - 3, y + roofH - 2, w + 6, 2, roofDark);
}
function door(cx, w, h, c) { px(cx - w / 2 - 1, DOOR_Y - h - 1, w + 2, h + 1, '#383028'); px(cx - w / 2, DOOR_Y - h, w, h, c); px(cx + w / 2 - 3, DOOR_Y - h / 2, 1, 2, '#f8d830'); }
function win(x, y) { px(x - 1, y - 1, 10, 9, '#383028'); px(x, y, 8, 7, '#a8d8f8'); px(x, y, 8, 2, '#d8f0f8'); px(x + 3.5, y, 1, 7, '#383028'); }

function paintLighthouse() {
  pell(110, 166, 20, 7, '#887058'); pell(110, 164, 17, 5, '#a89070');
  for (let i = 0; i < 70; i++) { const w = 22 - Math.floor(i / 10); px(110 - w / 2, DOOR_Y - i, w, 1, Math.floor(i / 10) % 2 ? '#b76dff' : '#f6f0ff'); }
  px(100, 92, 20, 6, '#383028'); px(102, 86, 16, 7, '#f8e070'); px(104, 80, 12, 6, '#8a4fc8');
  door(110, 8, 12, '#3a2a4a');
}
function paintDock() {
  // A boat tied up at the end of the dock (the dock's planks are part of the road).
  px(856, 256, 22, 6, '#a87040'); px(858, 262, 18, 2, '#603810'); px(856, 256, 22, 1, '#c89060');
}
function paintMarket() {
  hut(198, 112, 84, 56, '#5890d8', '#3868a8', '#f8f8f8', '#c0c0c8', 18);
  for (let s = 0; s < 8; s++) px(195 + s * 11.25, 118, 11.25, 10, s % 2 ? '#f8f8f8' : '#5890d8');
  px(208, 136, 64, 22, '#283858');
  const chest = (x, top) => { px(x, 144, 12, 10, '#383028'); px(x + 1, 145, 10, 8, '#a87040'); px(x + 1, 145, 10, 3, top); };
  chest(212, '#c89060'); chest(226, '#68a8f0'); chest(240, '#f06868'); chest(254, '#f8d830');
  px(226, 108, 28, 9, '#f8f8f8'); px(228, 110, 24, 5, '#f85888');
  door(240, 14, 8, '#a87040');
}
function paintHouse() {
  hut(344, 104, 72, 64, '#f8f0d8', '#d0c0a0', '#e84848', '#a82828', 28);
  win(352, 140); win(400, 140);
  door(380, 12, 18, '#a86838');
  px(396, 94, 9, 18, '#a86838'); px(394, 92, 13, 3, '#784818');
  px(424, 164, 6, 8, '#e84848'); px(426, 172, 2, 6, '#784818'); // mailbox
}
function paintBoard() { px(560, 156, 3, 14, '#785028'); px(589, 156, 3, 14, '#785028'); px(556, 140, 40, 18, '#785028'); px(558, 142, 36, 14, '#d8a868'); px(562, 144, 8, 10, '#f8f8f0'); px(572, 145, 7, 8, '#f8e8a8'); px(581, 144, 9, 10, '#f8f8f0'); }
function paintLbSign() { px(626, 156, 3, 14, '#785028'); px(612, 140, 32, 18, '#785028'); px(614, 142, 28, 14, '#f8d038'); px(624, 144, 8, 2, '#986810'); px(626, 146, 4, 5, '#986810'); px(624, 151, 8, 2, '#986810'); }
function paintTownSign() { px(512, 176, 2, 12, '#785028'); px(500, 166, 28, 12, '#785028'); px(502, 168, 24, 8, '#d8a868'); for (let i = 0; i < 4; i++) px(505 + i * 5, 171, 3, 1, '#785028'); }
function paintForge() {
  hut(764, 98, 76, 70, '#a8a0b0', '#787088', '#c84838', '#902818', 26);
  for (let yy = 128; yy < 162; yy += 6) px(764, yy, 76, 1, '#908898');
  px(818, 84, 10, 22, '#787088'); px(816, 82, 14, 4, '#585068');
  px(770, 138, 18, 24, '#383028'); px(772, 141, 14, 21, '#f88830'); px(775, 146, 8, 16, '#f8d850');
  door(800, 12, 18, '#785028');
  px(820, 154, 14, 4, '#585068'); px(823, 158, 8, 6, '#585068');
}
function paintTemple() {
  px(900, 160, 96, 8, '#c0b090'); px(906, 154, 84, 7, '#e0d4b0');
  px(910, 118, 76, 37, '#f8f0d8');
  for (const xx of [912, 928, 962, 978]) { px(xx, 118, 6, 36, '#ffffff'); px(xx + 4, 118, 2, 36, '#d8ccae'); }
  for (let i = 0; i < 24; i++) px(900 + i, 116 - i, 96 - i * 2, 1, i % 3 ? '#f8c838' : '#c89818');
  px(946, 82, 6, 10, '#78d8f8'); px(947, 80, 4, 2, '#c8f0f8');
  door(948, 14, 22, '#584018');
}
function paintCave() {
  pell(1145, 152, 22, 20, '#685038'); px(1123, 152, 44, 18, '#685038');
  pell(1145, 154, 16, 15, '#181010'); px(1129, 154, 32, 16, '#181010');
  px(1120, 134, 6, 36, '#885830'); px(1164, 134, 6, 36, '#885830'); px(1116, 130, 58, 6, '#704020'); px(1116, 130, 58, 2, '#a87040');
  for (let y = 156; y < 170; y += 3) px(1137, y, 16, 1, '#583820');
  px(1139, 154, 2, 16, '#a0a0a8'); px(1149, 154, 2, 16, '#a0a0a8');
}

// ---------- each frame ----------
function drawWorld(dt) {
  const g = WORLD.ctx, dpr = WORLD.dpr, z = WORLD.z;
  WORLD.t += dt;
  const t = WORLD.t;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#306830'; g.fillRect(0, 0, WORLD.cv.width, WORLD.cv.height);
  g.setTransform(dpr * z, 0, 0, dpr * z, -WORLD.cam.x * dpr * z, -WORLD.cam.y * dpr * z);
  g.imageSmoothingEnabled = false;
  g.drawImage(WORLD.img, 0, 0);
  // Sea sparkle, chimney smoke, the spawn pad glow, a boss waiting in the cave, and you.
  for (let i = 0; i < 16; i++) if (Math.sin(t * 2 + i * 1.7) > 0.7) { g.fillStyle = '#f8f8f8'; g.fillRect(RIVER[0] + 8 + (i * 13) % 100, (i * 37) % WH, 3, 1); }
  for (const [sx, sy] of [[525, 80], [260, 90]]) if (Math.random() < dt * 1.5) WORLD.smoke.push({ x: sx, y: sy, t: 0 });
  for (const s of WORLD.smoke) { s.t += dt; s.y -= dt * 7; s.x += dt * 3; g.fillStyle = `rgba(240,240,248,${Math.max(0, 0.7 - s.t * 0.18)})`; g.fillRect(Math.round(s.x), Math.round(s.y), 3 + Math.round(s.t), 3 + Math.round(s.t)); }
  WORLD.smoke = WORLD.smoke.filter(s => s.t < 4);
  g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); g.fillStyle = '#c8f8ff'; g.fillRect(SPAWN.x - 6, SPAWN.y + 1, 12, 4); g.globalAlpha = 1;
  if (typeof bossWaiting === 'function' && bossWaiting() && Math.floor(t * 2) % 2) { g.fillStyle = 'rgba(220,40,60,0.6)'; g.fillRect(1131, 156, 28, 12); }
  g.drawImage(heroSprite(0), SPAWN.x - 8, SPAWN.y - 13 + (Math.floor(t * 2) % 2), 16, 16);
  // Arrows at the edges while there's more to see that way.
  const l = $('#edgeL'), rgt = $('#edgeR');
  if (l) l.classList.toggle('show', WORLD.cam.x > 4);
  if (rgt) rgt.classList.toggle('show', WORLD.cam.x < WW - WORLD.vw / z - 4);
}

// ---------- camera: swipe left and right only, with a little glide ----------
function clampCam() { WORLD.cam.x = Math.max(0, Math.min(WW - WORLD.vw / WORLD.z, WORLD.cam.x)); WORLD.cam.y = Math.max(0, (WH - WORLD.vh / WORLD.z) / 2); }
function placeLayer() { const layer = $('#worldLayer'); if (layer) layer.style.transform = `translate(${-WORLD.cam.x * WORLD.z}px, ${-WORLD.cam.y * WORLD.z}px) scale(${WORLD.z})`; }
function bindSwipe(el) {
  el.addEventListener('pointerdown', e => { WORLD.drag = { id: e.pointerId, x: e.clientX, sx: e.clientX, sy: e.clientY, t: performance.now() }; WORLD.moved = false; WORLD.vx = 0; });
  el.addEventListener('pointermove', e => {
    const d = WORLD.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, now = performance.now(), dt = Math.max(1, now - d.t);
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) WORLD.moved = true;
    WORLD.cam.x -= dx / WORLD.z;
    WORLD.vx = ((-dx / WORLD.z) / dt) * 16;
    d.x = e.clientX; d.t = now;
    clampCam(); placeLayer();
  });
  const end = e => { if (WORLD.drag && WORLD.drag.id === e.pointerId) WORLD.drag = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  // A swipe that ends on a building must not open it.
  el.addEventListener('click', e => { if (WORLD.moved) { e.stopPropagation(); e.preventDefault(); WORLD.moved = false; } }, true);
}
// Back to the start of the route: town sits at the far left.
function centerOnSpawn() { WORLD.cam.x = 0; WORLD.vx = 0; clampCam(); placeLayer(); }

// ---------- screen ----------
function islandHtml() {
  let h = `<div class="world" id="world"><canvas id="worldCv" aria-hidden="true"></canvas><div class="isle" id="worldLayer" style="width:${WW}px;height:${WH}px">`;
  for (const b of BUILDINGS) {
    const act = b.tab === 'lb' ? 'data-lb="open"' : `data-go="${b.tab}"`;
    h += `<button class="bld" ${act} aria-label="${b.name}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"></button>`;
    const sy = b.tab === 'dock' ? b.y + b.h + 12 : b.y - 8;
    h += `<button class="sign" ${act} aria-label="${b.name}" style="left:${b.x + b.w / 2}px;top:${sy}px">${b.name}<small id="isl-${b.tab}"></small><i class="dot"></i></button>`;
  }

  h += '</div><div class="edge l" id="edgeL">◀</div><div class="edge r" id="edgeR">▶</div><button class="toSpawn" id="toSpawn" aria-label="Back to town">⌂ Town</button></div>';
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

// The strip fills the screen's height; the width scrolls.
function sizeIsland() {
  const w = $('#world');
  if (!w || UI.tab !== 'island') return;
  WORLD.vw = w.clientWidth; WORLD.vh = w.clientHeight;
  if (!WORLD.vw || !WORLD.vh) return;
  WORLD.dpr = Math.min(3, window.devicePixelRatio || 1);
  WORLD.z = WORLD.vh / WH;
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
  if (!WORLD.drag && Math.abs(WORLD.vx) > 0.05) { WORLD.cam.x += WORLD.vx; WORLD.vx *= 0.9; clampCam(); placeLayer(); }
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
