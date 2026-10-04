'use strict';
// Version 2 home screen: a side-scrolling route in the spirit of the old Pokemon games. The world is
// one long strip that fills the screen top to bottom; you swipe left and right only. You start at
// the far left in town on the spawn plaza (quest board, trophy statue, your miner, your house), then
// the road heads east past the farm, the market, the forge and its woodcutter, the temple, over a
// wooden bridge across the river (lighthouse and dock), through tall grass to the mountain and the
// cave. Every door faces down and a short path comes up into it from the road.
//
// The ground is painted once into an offscreen canvas (paintWorld). Everything that moves (people,
// animals, fire, water, smoke, clouds) is drawn on top each frame (drawLive).

const WW = 1200, WH = 300; // world size in world pixels
const WORLD = { cv: null, ctx: null, img: null, cam: { x: 0, y: 0 }, z: 2, vx: 0, drag: null, moved: false, t: 0, smoke: [], fx: [], dpr: 1, vw: 0, vh: 0 };
const SPAWN = { x: 110, y: 200 };
const RIVER = [748, 872]; // the river's west and east banks
const DOOR_Y = 168; // the bottom of every door on the north side of the road
const POND = { x: 250, y: 250, rx: 30, ry: 14 };
const FIELD = { x: 314, y: 222, w: 88, h: 32 }; // the farm's crop field, south of the road

// Places: tap box (x, y, w, h) in world pixels and the door's x. 'lb' opens the leaderboard.
const BUILDINGS = [
  { tab: 'quests', name: 'Quests', x: 64, y: 136, w: 44, h: 34, dx: 86 },
  { tab: 'lb', name: 'Leaderboard', x: 122, y: 134, w: 32, h: 36, dx: 137 },
  { tab: 'bag', name: 'House', x: 200, y: 92, w: 80, h: 78, dx: 240 },
  { tab: 'cases', name: 'Market', x: 320, y: 104, w: 92, h: 66, dx: 366 },
  { tab: 'forge', name: 'Forge', x: 462, y: 90, w: 84, h: 80, dx: 502 },
  { tab: 'skills', name: 'Temple', x: 590, y: 84, w: 96, h: 86, dx: 638 },
  { tab: 'dock', name: 'Dock', x: 834, y: 214, w: 28, h: 56, dx: 848 },
  { tab: 'fight', name: 'Cave', x: 1110, y: 112, w: 70, h: 58, dx: 1145 },
];
// The road: a gentle winding curve from town to the cave.
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
function riverBanks(y) { return [RIVER[0] + Math.round(Math.sin(y / 17) * 4), RIVER[1] + Math.round(Math.sin(y / 13 + 2) * 4)]; }
function mountainTop(x) { return 14 + Math.max(0, (1124 - x) * 1.75) + Math.round(Math.sin(x / 9) * 3 + Math.sin(x / 4) * 1); }

// ---------- pixel helpers ----------
const OUT = '#2b1d16'; // the outline colour for buildings, people and props
function wg() { return WORLD.ctx; }
function px(x, y, w, h, c) { const g = wg(); g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function pell(cx, cy, rx, ry, c) {
  const g = wg(); g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) { const h = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - h), Math.round(cy + y), h * 2, 1); }
}
// Rectangles with a dark one-pixel outline round the whole group, so shapes read clearly.
function parts(list) { for (const [x, y, w, h] of list) px(x - 1, y - 1, w + 2, h + 2, OUT); for (const [x, y, w, h, c] of list) px(x, y, w, h, c); }
function prng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, s = t => t * t * (3 - 2 * t);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1), su = s(u), sv = s(v);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- the ground: one pass over 2px cells ----------
const CELL = 2, GC = WW / CELL, GR = WH / CELL;
const T = { GRASS: 0, ROAD: 1, WATER: 2, SAND: 3, PLAZA: 4, FIELD: 5, ROCK: 6 };
let TERRAIN = null;
function terrainAt(x, y) { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= GC || cy >= GR ? T.GRASS : TERRAIN[cy * GC + cx]; }
const PAL = {
  grass: ['#4c9638', '#58a541', '#64b24a', '#71bf53', '#80cb5e'].map(rgb),
  road: ['#cfa76c', '#d9b37a', '#e3c088'].map(rgb), roadRim: rgb('#9f7646'), roadIn: rgb('#c09660'), pebble: rgb('#b08a56'), pebbleHi: rgb('#efd6a2'),
  water: ['#2c6db8', '#3480cc', '#3f8fda'].map(rgb), shallow: rgb('#5aa6e6'), foam: rgb('#bfe3f8'),
  sand: ['#d8bd80', '#e4cc92', '#eed9a2'].map(rgb), wet: rgb('#c4a76a'),
  plaza: ['#cdc3ae', '#d6cdb9', '#ded6c4'].map(rgb), mortar: rgb('#a69c88'), plazaRim: rgb('#958b77'),
  furrow: rgb('#5b381f'), ridge: ['#83532f', '#8e5d37', '#996841'].map(rgb), fieldRim: rgb('#6a4327'),
  rock: ['#7f6a55', '#8f7962', '#9f8970'].map(rgb), rockHi: rgb('#bba387'), rockLo: rgb('#5a4737'),
};

function paintGround(g) {
  const cell = new Uint8Array(GC * GR), road = new Uint8Array(GC * GR);
  const mark = (x0, y0, rad) => {
    for (let cy = Math.floor((y0 - rad) / CELL); cy <= Math.floor((y0 + rad) / CELL); cy++) for (let cx = Math.floor((x0 - rad) / CELL); cx <= Math.floor((x0 + rad) / CELL); cx++) {
      if (cx < 0 || cy < 0 || cx >= GC || cy >= GR) continue;
      if (Math.hypot(cx * CELL + 1 - x0, cy * CELL + 1 - y0) <= rad) road[cy * GC + cx] = 1;
    }
  };
  for (const [x, y] of ROAD_PTS) mark(x, y, 11);
  for (const b of BUILDINGS) if (b.tab !== 'dock' && b.tab !== 'fight') for (let y = roadY(b.dx); y >= DOOR_Y + 5; y -= 1) mark(b.dx, y, 6);
  // Classify every cell.
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = cx * CELL + 1, y = cy * CELL + 1, i = cy * GC + cx;
    const [w0, w1] = riverBanks(y), pe = ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2;
    const pl = ((x - SPAWN.x) / 46) ** 2 + ((y - SPAWN.y) / 22) ** 2;
    let t = T.GRASS;
    if (x >= 1030 && y >= mountainTop(x) && y < 186) t = T.ROCK;
    else if (x >= w0 && x < w1) t = T.WATER;
    else if (x >= w0 - 5 && x < w1 + 5) t = T.SAND;
    else if (pe < 1) t = T.WATER;
    else if (pe < 1.3) t = T.SAND;
    else if (pl < 1) t = T.PLAZA;
    else if (road[i]) t = T.ROAD;
    else if (x >= FIELD.x && x < FIELD.x + FIELD.w && y >= FIELD.y && y < FIELD.y + FIELD.h) t = T.FIELD;
    cell[i] = t;
  }
  TERRAIN = cell;
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= GC || cy >= GR ? T.GRASS : cell[cy * GC + cx]);
  const paved = t => t === T.ROAD || t === T.PLAZA;
  const img = g.createImageData(WW, WH), d = img.data;
  const pick = (pal, n, cx, cy) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(n * pal.length + BAYER[(cy & 3) * 4 + (cx & 3)] * 1.2)))];
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = cx * CELL + 1, y = cy * CELL + 1, t = cell[cy * GC + cx], hsh = hash2(cx, cy);
    let c;
    if (t === T.GRASS) {
      const n = 0.62 * vnoise(x / 64, y / 46) + 0.38 * vnoise(x / 15, y / 15);
      let k = Math.max(0, Math.min(4, Math.floor(n * 5 + BAYER[(cy & 3) * 4 + (cx & 3)] * 1.3)));
      if (paved(at(cx, cy - 1)) || paved(at(cx, cy + 1)) || paved(at(cx - 1, cy)) || paved(at(cx + 1, cy))) k = Math.max(0, k - 2); // grass lip at the road
      else if (at(cx, cy - 2) === T.ROAD || at(cx, cy - 3) === T.ROAD) k = Math.max(0, k - 1);
      c = PAL.grass[k];
    } else if (t === T.ROAD) {
      const rim = !paved(at(cx - 1, cy)) || !paved(at(cx + 1, cy)) || !paved(at(cx, cy - 1)) || !paved(at(cx, cy + 1));
      const in2 = !paved(at(cx - 2, cy)) || !paved(at(cx + 2, cy)) || !paved(at(cx, cy - 2)) || !paved(at(cx, cy + 2));
      if (rim) c = PAL.roadRim;
      else if (in2) c = PAL.roadIn;
      else if (hsh < 0.035) c = PAL.pebble;
      else if (hsh < 0.06) c = PAL.pebbleHi;
      else c = pick(PAL.road, vnoise(x / 9, y / 7), cx, cy);
    } else if (t === T.WATER) {
      const [w0, w1] = riverBanks(y);
      const inRiver = x >= w0 && x < w1;
      const dist = inRiver ? Math.min(x - w0, w1 - x) : (1 - Math.sqrt(((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2)) * POND.ry * 1.6;
      if (dist < 2.5) c = PAL.foam;
      else if (dist < 9) c = PAL.shallow;
      else c = pick(PAL.water, Math.min(0.99, 0.25 + 0.75 * vnoise(x / 30, y / 20) - (inRiver ? (dist - 9) / 120 : 0)), cx, cy);
    } else if (t === T.SAND) {
      const wetNear = at(cx - 1, cy) === T.WATER || at(cx + 1, cy) === T.WATER || at(cx, cy - 1) === T.WATER || at(cx, cy + 1) === T.WATER;
      c = wetNear ? PAL.wet : pick(PAL.sand, vnoise(x / 6, y / 6), cx, cy);
    } else if (t === T.PLAZA) {
      const e = ((x - SPAWN.x) / 46) ** 2 + ((y - SPAWN.y) / 22) ** 2;
      const row = Math.floor((y - SPAWN.y + 100) / 7), col = Math.floor((x - SPAWN.x + 100 + (row % 2) * 5) / 10);
      const mortar = (y - SPAWN.y + 100) % 7 < 1.5 || (x - SPAWN.x + 100 + (row % 2) * 5) % 10 < 1.5;
      c = e > 0.82 ? PAL.plazaRim : mortar ? PAL.mortar : PAL.plaza[Math.floor(hash2(col, row) * 3)];
    } else if (t === T.FIELD) {
      const fy = y - FIELD.y, edge = x < FIELD.x + 2 || x >= FIELD.x + FIELD.w - 2 || fy < 2 || fy >= FIELD.h - 2;
      c = edge ? PAL.fieldRim : fy % 8 < 2 ? PAL.furrow : pick(PAL.ridge, vnoise(x / 5, y / 3), cx, cy);
    } else {
      // Cliff ledges in the Pokemon style: a dark crack line, a lit lip under it, rock between.
      const top = mountainTop(x), rel = Math.floor((186 - y + Math.round(Math.sin(x / 11) * 2)) / CELL) % 9;
      if (y < top + 2) c = PAL.grass[3];
      else if (y < top + 4) c = PAL.rockLo;
      else if (y > 181) c = PAL.rockLo;
      else if (rel === 0) c = PAL.rockLo;
      else if (rel === 8) c = PAL.rockHi;
      else c = hsh < 0.04 ? PAL.rockLo : pick(PAL.rock, 0.15 + 0.7 * vnoise(x / 9, y / 5), cx, cy);
    }
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const o = ((cy * CELL + dy) * WW + cx * CELL + dx) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// ---------- painting the world once ----------
function paintWorld() {
  const cv = makeCanvas(WW, WH), prev = WORLD.ctx;
  WORLD.ctx = cv.getContext('2d');
  paintGround(WORLD.ctx);
  const r = prng(17), inRiver = x => x > RIVER[0] - 14 && x < RIVER[1] + 14;
  const grassy = (x, y, pad = 3) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([a, b]) => terrainAt(x + a, y + b) === T.GRASS);
  // Little tufts of darker and lighter grass all over.
  for (let i = 0; i < 900; i++) {
    const x = r() * WW, y = 44 + r() * 226;
    if (!grassy(x, y)) continue;
    if (r() < 0.6) { px(x, y, 1, 2, '#3e8430'); px(x + 2, y - 1, 1, 3, '#3e8430'); px(x + 1, y, 1, 2, '#94d86c'); }
    else { px(x, y, 2, 1, '#94d86c'); px(x + 3, y + 1, 1, 1, '#94d86c'); }
  }
  // Mountain: cracks and boulders.
  for (let i = 0; i < 40; i++) { const x = 1050 + r() * 148, y = 40 + r() * 130; if (terrainAt(x, y) === T.ROCK && terrainAt(x, y - 6) === T.ROCK) { px(x, y, 1, 3 + r() * 4, '#5a4737'); px(x + 1, y, 1, 2, '#bba387'); } }
  // Tall grass patches and ledges on the route east.
  for (const [x0, y0, w, h] of [[600, 230, 64, 30], [900, 222, 96, 40], [940, 96, 80, 56], [1030, 230, 56, 32]]) tallGrass(x0, y0, w, h);
  for (const [x0, y0, w] of [[900, 270, 80], [1000, 214, 60]]) ledge(x0, y0, w);
  // Pond: lily pads and reeds.
  for (const [lx, ly] of [[236, 246], [262, 254], [270, 244]]) { pell(lx, ly, 4, 2, '#2f7a34'); px(lx + 1, ly - 2, 2, 2, '#2f7a34'); px(lx - 2, ly - 1, 3, 1, '#4ea548'); }
  px(268, 243, 2, 2, '#f6a8c8'); px(268, 242, 1, 1, '#ffffff');
  for (const [rx, ry] of [[222, 244], [226, 241], [277, 255], [280, 251]]) { px(rx, ry - 8, 1, 9, '#3e7a2a'); px(rx + 2, ry - 6, 1, 7, '#4e9234'); px(rx, ry - 10, 1, 3, '#7a4a26'); }
  // Flowers in little clusters, rocks and bushes.
  const COLS = ['#f25d5d', '#f8e04a', '#ffffff', '#b77df0', '#6fb2ff', '#ff9ad0'];
  for (let i = 0; i < 70; i++) {
    const cx = 40 + r() * 1040, cy = 52 + r() * 214, c = COLS[Math.floor(r() * COLS.length)];
    if (inRiver(cx)) continue;
    for (let k = 0; k < 4; k++) { const x = cx + (r() - 0.5) * 12, y = cy + (r() - 0.5) * 7; if (grassy(x, y, 4)) flower(x, y, c); }
  }
  for (let i = 0; i < 22; i++) { const x = 40 + r() * 1040, y = 214 + r() * 50; if (!inRiver(x) && grassy(x, y, 6)) rock(x, y, r() < 0.5); }
  for (const [bx, by] of [[184, 236], [296, 232], [418, 258], [566, 262], [700, 226], [726, 250], [890, 160], [1060, 262]]) bush(bx, by);
  // Bridge over the river and the pier to the boat.
  paintBridge(); paintPier();
  // Farm (crops are drawn live so the farmer can walk between them), woodpile and the forge yard.
  paintFarm(); paintWoodYard();
  // The forest along the top edge (back to front), trees between buildings, then buildings.
  const forest = [];
  for (let x = 0; x < 1100; x += 9) { if (inRiver(x)) continue; forest.push([x + r() * 4, 22 + r() * 6, r() < 0.3]); forest.push([x + 4 + r() * 4, 38 + r() * 6, r() < 0.3]); }
  for (let y = 54; y < 186; y += 13) { forest.push([6 + r() * 3, y, r() < 0.4]); forest.push([24 + r() * 3, y + 6, r() < 0.4]); }
  forest.sort((a, b) => a[1] - b[1]).forEach(([x, y, pine]) => (pine ? pineTree(x, y) : tree(x, y)));
  for (const x of [176, 300, 432, 568, 714, 904]) tree(x, 150);
  for (const [x, y] of [[1100, 232], [1132, 248], [1170, 226], [1186, 258], [1150, 266]]) pineTree(x, y);
  for (const [x, y] of [[1090, 194], [1176, 196], [1116, 262], [1060, 192]]) rock(x, y, true);
  tree(296, 128); pineTree(716, 130); pineTree(1012, 150);
  paintTownDecor(); paintTownSign(); paintBoard(); paintTrophy(); paintHouse(); paintMarket(); paintForge(); paintTemple(); paintLighthouse(); paintCave();
  fence(188, 182, 104, 240);
  // The forest along the bottom edge, front-most.
  const south = [];
  for (let x = 0; x < WW; x += 9) { if (inRiver(x)) continue; south.push([x + r() * 4, 286 + r() * 3, r() < 0.3]); south.push([x + 4 + r() * 4, 300 + r() * 3, r() < 0.3]); }
  for (let y = 220; y < 286; y += 13) { south.push([6 + r() * 3, y, r() < 0.4]); south.push([24 + r() * 3, y + 6, r() < 0.4]); }
  south.sort((a, b) => a[1] - b[1]).forEach(([x, y, pine]) => (pine ? pineTree(x, y) : tree(x, y)));
  WORLD.ctx = prev;
  return cv;
}

// ---------- scenery pieces ----------
function tree(x, y) {
  pell(x + 1, y, 9, 3, 'rgba(20,50,20,0.35)');
  px(x - 2, y - 8, 5, 8, OUT); px(x - 1, y - 8, 3, 8, '#7a4c2a'); px(x + 1, y - 8, 1, 8, '#5a361c'); px(x - 3, y - 1, 7, 1, '#5a361c');
  pell(x, y - 17, 11, 9, '#1f4720'); pell(x - 6, y - 13, 6, 5, '#1f4720'); pell(x + 6, y - 13, 6, 5, '#1f4720');
  pell(x, y - 17, 10, 8, '#33702f'); pell(x - 6, y - 13, 5, 4, '#33702f'); pell(x + 6, y - 13, 5, 4, '#2c6229');
  pell(x - 1, y - 19, 8, 5, '#45903b'); pell(x - 4, y - 15, 4, 3, '#45903b');
  pell(x - 3, y - 21, 4, 2, '#62b04c'); px(x - 5, y - 22, 3, 1, '#8ad064'); px(x + 3, y - 18, 2, 1, '#62b04c');
  px(x + 5, y - 11, 2, 1, '#1f4720'); px(x - 2, y - 12, 2, 1, '#2c6229');
}
function pineTree(x, y) {
  pell(x + 1, y, 7, 2, 'rgba(20,50,20,0.35)');
  px(x - 1, y - 5, 3, 5, '#5a361c');
  for (let i = 0; i < 3; i++) {
    const top = y - 26 + i * 6, w = 4 + i * 3;
    for (let k = 0; k < 10; k++) {
      const hw = Math.round((k / 10) * w) + 1;
      px(x - hw - 1, top + k, hw * 2 + 3, 1, '#173a1e');
      px(x - hw, top + k, hw * 2 + 1, 1, k % 3 === 2 ? '#24582a' : '#2d6a32');
      px(x - hw, top + k, Math.max(1, Math.floor(hw / 2)), 1, '#3f8a40');
    }
  }
  px(x, y - 27, 1, 2, '#173a1e');
}
function bush(x, y) {
  pell(x + 1, y + 1, 8, 2, 'rgba(20,50,20,0.3)');
  pell(x, y - 4, 8, 5, '#1f4720'); pell(x, y - 4, 7, 4, '#3a7e34'); pell(x - 2, y - 6, 4, 2, '#55a046'); px(x - 4, y - 7, 2, 1, '#86c862');
  px(x + 3, y - 5, 1, 1, '#f25d5d'); px(x - 1, y - 3, 1, 1, '#f25d5d');
}
function rock(x, y, big) {
  const w = big ? 7 : 4;
  pell(x + 1, y + 1, w, 1, 'rgba(20,50,20,0.3)');
  pell(x, y - 1, w, big ? 3 : 2, '#5d5650'); pell(x, y - 2, w - 1, big ? 2 : 1, '#8a827a'); px(x - w + 2, y - (big ? 4 : 3), 2, 1, '#b8b0a6');
}
function flower(x, y, c) { px(x, y + 1, 1, 2, '#2f7228'); px(x - 1, y, 3, 1, c); px(x, y - 1, 1, 3, c); px(x, y, 1, 1, c === '#f8e04a' ? '#c86a1a' : '#f8e04a'); }
function tallGrass(x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y += 6) for (let x = x0 + ((y - y0) % 12 ? 3 : 0); x < x0 + w - 2; x += 6) {
    px(x, y + 1, 7, 6, '#2f6e26');
    px(x, y + 2, 1, 4, '#3f8a30'); px(x + 2, y, 1, 6, '#4da03a'); px(x + 4, y + 1, 1, 5, '#3f8a30'); px(x + 6, y + 2, 1, 4, '#4da03a');
    px(x + 2, y, 1, 1, '#9ee070'); px(x + 4, y + 1, 1, 1, '#7ccc58'); px(x, y + 2, 1, 1, '#7ccc58');
  }
}
function ledge(x0, y0, w) { px(x0, y0 - 1, w, 1, '#86cc5e'); px(x0, y0, w, 3, '#4c8a34'); px(x0, y0 + 3, w, 2, '#2f5e22'); for (let x = x0 + 3; x < x0 + w; x += 7) px(x, y0 + 1, 2, 1, '#3a7028'); }
function fence(x0, y, w, gapX) {
  px(x0, y - 6, w, 2, OUT); px(x0, y - 2, w, 2, OUT);
  for (let x = x0; x < x0 + w; x += 7) { if (Math.abs(x + 1 - gapX) < 9) continue; px(x - 1, y - 10, 5, 12, OUT); px(x, y - 9, 3, 10, '#f4efe4'); px(x + 2, y - 8, 1, 9, '#c9c0b0'); px(x + 1, y - 10, 1, 1, OUT); }
  for (let x = x0; x < x0 + w; x += 1) if (Math.abs(x - gapX) > 8) { px(x, y - 5, 1, 1, '#e6dece'); px(x, y - 1, 1, 1, '#e6dece'); }
}

// ---------- town: cottages, a well, street lamps, and the windmill's tower ----------
function cottage(x, y, w, roofC) {
  shadow(x, y + 14, w, 22);
  roof(x - 3, y, w + 6, 16, roofC[0], roofC[1], roofC[2]);
  wall(x, y + 18, w, 20, 'plank', '#d8b880', '#a8885a', '#b8986a');
  win(x + 5, y + 23, 8, 7); px(x + w - 13, y + 24, 8, 14, OUT); px(x + w - 12, y + 25, 6, 13, '#8a5a32'); px(x + w - 8, y + 31, 1, 1, '#f8d040');
}
function paintTownDecor() {
  cottage(52, 62, 40, ['#4a7ac8', '#2e4e8a', '#7aa2e0']);
  cottage(124, 70, 38, ['#c88a3a', '#8e5a22', '#e8b060']);
  // Little paths from the cottages down to the meadow, a well, and two street lamps by the plaza.
  for (const [x, y] of [[85, 101], [152, 109]]) for (let k = 0; k < 4; k++) px(x - 2 + (k % 2), y + k * 4, 5, 2, '#cfa76c');
  pell(104, 120, 9, 3, 'rgba(20,45,15,0.32)');
  pell(104, 116, 8, 4, OUT); pell(104, 116, 7, 3, '#8d857a'); pell(104, 115, 5, 2, '#2c6db8'); px(97, 116, 15, 4, '#8d857a'); for (let x = 98; x < 112; x += 4) px(x, 117, 1, 3, '#5e574e');
  px(96, 102, 2, 14, OUT); px(111, 102, 2, 14, OUT); px(97, 103, 1, 13, '#8a5a32'); px(112, 103, 1, 13, '#8a5a32');
  roof(94, 98, 21, 4, '#b04a36', '#7e2c20', '#d86a50'); px(103, 104, 3, 5, '#7a4c2a'); px(104, 109, 1, 3, '#5e574e');
  for (const lx of [60, 162]) { px(lx - 1, 176, 3, 14, OUT); px(lx, 177, 1, 13, '#3a3448'); parts([[lx - 3, 170, 7, 6, '#3a3448']]); px(lx - 2, 171, 5, 4, '#f8d878'); pell(lx, 190, 4, 1, 'rgba(20,45,15,0.35)'); }
  // The windmill tower between the market and the forge (its sails turn live).
  shadow(428, 82, 18, 36);
  for (let i = 0; i < 40; i++) { const w = 12 + Math.floor(i / 5); px(436 - w / 2 - 1, 78 + i, w + 2, 1, OUT); px(436 - w / 2, 78 + i, w, 1, i % 6 === 5 ? '#c8b898' : '#ece2c8'); px(436 + w / 2 - 3, 78 + i, 3, 1, '#c8b898'); }
  pell(436, 77, 9, 6, OUT); pell(436, 77, 8, 5, '#8a5a32'); pell(434, 75, 4, 2, '#b07a46'); px(427, 78, 18, 2, OUT);
  px(432, 106, 7, 12, OUT); px(433, 107, 5, 11, '#8a5a32'); win(432, 90, 6, 6, false);
}

// ---------- buildings ----------
function shadow(x, y, w, h) { const g = wg(); g.fillStyle = 'rgba(20,45,15,0.32)'; g.fillRect(x + 3, y + h, w, 3); g.fillRect(x + w, y + 6, 4, h - 3); }
// Shingled roof, slightly narrower at the top, with a light ridge and a dark eave lip.
function roof(x, y, w, h, base, dark, light) {
  for (let i = 0; i < h; i++) {
    const inset = Math.round(((h - i) / h) * 4);
    px(x + inset - 1, y + i, w - inset * 2 + 2, 1, OUT);
    px(x + inset, y + i, w - inset * 2, 1, (i % 4 === 3) ? dark : base);
    if (i % 4 !== 3) for (let sx = x + inset + ((Math.floor(i / 4) % 2) ? 3 : 0); sx < x + w - inset; sx += 6) px(sx, y + i, 1, 1, i % 4 === 0 ? light : dark);
  }
  px(x + 3, y - 1, w - 6, 1, OUT); px(x + 4, y, w - 8, 1, light);
  px(x - 1, y + h, w + 2, 2, OUT); px(x, y + h, w, 1, dark);
}
function wall(x, y, w, h, style, base, dark, line) {
  px(x - 1, y, w + 2, h + 1, OUT); px(x, y, w, h, base);
  if (style === 'plank') for (let yy = y + 3, k = 0; yy < y + h; yy += 4, k++) { px(x, yy, w, 1, line); for (let xx = x + (k % 2 ? 5 : 11); xx < x + w; xx += 14) px(xx, yy - 3, 1, 3, line); }
  if (style === 'stone') for (let yy = y + 1, k = 0; yy < y + h; yy += 4, k++) { px(x, yy + 3, w, 1, line); for (let xx = x + (k % 2 ? 2 : 6); xx < x + w; xx += 8) px(xx, yy, 1, 3, line); }
  px(x, y, w, 2, dark); // shadow under the eaves
  px(x, y + h - 3, w, 3, '#8d857a'); for (let xx = x + 2; xx < x + w; xx += 6) px(xx, y + h - 3, 1, 3, '#5e574e'); px(x, y + h - 3, w, 1, '#a69e92'); // stone footing
}
function door(cx, w, h, wood) {
  const x = Math.round(cx - w / 2), y = DOOR_Y - h;
  px(x - 2, y - 2, w + 4, h + 2, OUT); px(x - 1, y - 1, w + 2, h + 1, '#6e655a');
  px(x, y, w, h, wood); for (let xx = x + 3; xx < x + w; xx += 3) px(xx, y + 1, 1, h - 1, shade(wood, -0.25));
  px(x, y, 1, 1, '#6e655a'); px(x + w - 1, y, 1, 1, '#6e655a'); px(x + w - 4, y + Math.floor(h / 2), 2, 2, '#f8d040');
  px(x - 3, DOOR_Y, w + 6, 2, '#a69e92'); px(x - 3, DOOR_Y + 2, w + 6, 1, '#6e655a'); // doorstep
}
function win(x, y, w = 10, h = 9, box = true) {
  px(x - 1, y - 1, w + 2, h + 2, OUT); px(x, y, w, h, '#86c4ec'); px(x, y, w, 3, '#c6e8fa'); px(x + 1, y + 3, 2, 2, '#c6e8fa');
  px(x + Math.floor(w / 2), y, 1, h, OUT); px(x, y + Math.floor(h / 2), w, 1, OUT);
  if (box) { px(x - 2, y + h + 1, w + 4, 3, OUT); px(x - 1, y + h + 1, w + 2, 2, '#8a5a32'); for (let i = 0; i < w; i += 2) px(x + i, y + h, 1, 1, i % 4 ? '#f25d5d' : '#f8e04a'); px(x, y + h - 1, w, 1, '#3f8a30'); }
}

function paintTownSign() {
  px(56, 224, 2, 12, OUT); px(57, 224, 1, 12, '#7a4c2a');
  parts([[44, 214, 28, 12, '#a8743e']]); px(45, 215, 26, 1, '#c8945a'); px(45, 224, 26, 1, '#7a4c2a');
  for (let i = 0; i < 4; i++) px(48 + i * 6, 219, 4, 2, '#5a361c');
}
function paintBoard() {
  shadow(66, 142, 40, 26);
  px(70, 152, 3, 18, OUT); px(71, 152, 1, 18, '#7a4c2a'); px(99, 152, 3, 18, OUT); px(100, 152, 1, 18, '#7a4c2a');
  roof(64, 136, 44, 6, '#b04a36', '#7e2c20', '#d86a50');
  parts([[68, 144, 36, 18, '#9a6a3c']]); px(69, 145, 34, 16, '#c99a62');
  const note = (x, y, c) => { px(x, y, 7, 8, c); px(x, y + 7, 7, 1, shade(c, -0.2)); px(x + 3, y, 1, 1, '#d83030'); px(x + 1, y + 3, 5, 1, '#9a8a70'); px(x + 1, y + 5, 4, 1, '#9a8a70'); };
  note(71, 147, '#fbf6e8'); note(80, 146, '#f8e8a0'); note(89, 148, '#fbf6e8'); note(96, 146, '#bfe3f8');
  px(84, 162, 4, 6, '#a8743e'); // the post the path runs up to
}
function paintTrophy() {
  shadow(124, 156, 28, 14);
  parts([[126, 154, 22, 14, '#a69e92']]); px(127, 155, 20, 2, '#c8c0b4'); px(127, 165, 20, 2, '#7e776c');
  parts([[124, 150, 26, 4, '#8d857a']]); px(125, 150, 24, 1, '#bdb5a8');
  // A gold cup on top.
  parts([[131, 132, 12, 8, '#f2c23a'], [135, 140, 4, 5, '#d8a020'], [132, 145, 10, 4, '#f2c23a']]);
  px(128, 133, 3, 1, OUT); px(127, 134, 2, 4, '#d8a020'); px(143, 133, 3, 1, OUT); px(145, 134, 2, 4, '#d8a020');
  px(133, 133, 2, 5, '#fff2b0'); px(136, 135, 4, 1, '#c88a18'); px(133, 146, 2, 1, '#fff2b0');
}
function paintHouse() {
  shadow(204, 120, 72, 50);
  px(256, 88, 11, 24, OUT); px(257, 89, 9, 22, '#8d857a'); for (let y = 91; y < 110; y += 4) px(257, y, 9, 1, '#6e655a'); px(255, 86, 13, 3, OUT); px(256, 87, 11, 1, '#a69e92');
  roof(198, 96, 84, 30, '#c8483a', '#8e2a22', '#e8705a');
  wall(204, 128, 72, 42, 'plaster', '#f3e6c6', '#d6c4a0', '#d6c4a0');
  for (const bx of [204, 239, 272]) px(bx, 128, 4, 39, '#7a4a2a');
  px(204, 146, 72, 3, '#7a4a2a');
  win(212, 135, 11, 9); win(255, 135, 11, 9);
  door(240, 12, 20, '#a86838');
  px(285, 165, 3, 10, OUT); px(286, 166, 1, 9, '#7a4c2a'); parts([[282, 160, 9, 6, '#d84848']]); px(283, 161, 7, 1, '#f07a6a'); px(290, 158, 1, 3, '#f8e04a'); // mailbox
}
function paintMarket() {
  shadow(324, 128, 84, 42);
  roof(318, 104, 96, 20, '#4a6a9a', '#2e4670', '#7092c4');
  wall(324, 126, 84, 44, 'plank', '#c08a52', '#8e5e32', '#9c6a3a');
  // Striped awning with a scalloped edge.
  px(319, 129, 94, 11, OUT);
  for (let s = 0; s < 94; s++) px(320 + s, 130, 1, 9, Math.floor(s / 8) % 2 ? '#fbf3e4' : '#d84848');
  for (let s = 0; s < 92; s += 8) { px(320 + s, 139, 8, 2, OUT); px(321 + s, 139, 6, 1, Math.floor(s / 8) % 2 ? '#fbf3e4' : '#d84848'); }
  px(320, 130, 92, 1, '#ffffff');
  // Counters with goods either side of the door.
  for (const cx of [328, 376]) { parts([[cx, 152, 30, 12, '#8e5e32']]); px(cx, 152, 30, 2, '#b07a46'); }
  const chest = (x, top) => { parts([[x, 145, 9, 7, '#a87040']]); px(x, 145, 9, 3, top); px(x + 4, 148, 1, 2, '#f8d040'); };
  chest(330, '#c89060'); chest(342, '#5d9ee8'); chest(378, '#e05a5a'); chest(390, '#f2c23a');
  for (let i = 0; i < 5; i++) { px(353 + (i % 2) * 2, 148 + i, 2, 2, '#e04040'); px(400 + (i % 2) * 2, 148 + i, 2, 2, '#78c850'); }
  door(366, 14, 16, '#7a4c2a');
  // Sign on the roof: a chest.
  parts([[354, 96, 24, 12, '#7a4c2a']]); px(355, 97, 22, 10, '#e8d0a0'); px(361, 99, 10, 7, OUT); px(362, 100, 8, 5, '#a87040'); px(362, 100, 8, 2, '#f2c23a'); px(365, 102, 2, 2, '#f8d040');
}
function paintForge() {
  shadow(466, 118, 78, 52);
  px(516, 64, 16, 38, OUT); px(517, 65, 14, 37, '#7e776c'); for (let y = 68; y < 100; y += 4) { px(517, y, 14, 1, '#5e574e'); px(517 + ((y / 4) % 2 ? 3 : 8), y - 3, 1, 3, '#5e574e'); }
  px(515, 62, 18, 4, OUT); px(516, 63, 16, 2, '#a69e92');
  roof(460, 92, 88, 26, '#585068', '#3a3448', '#7a7290');
  wall(466, 118, 76, 52, 'stone', '#9c968a', '#6e695f', '#7e796e');
  // The furnace mouth (its fire is drawn live).
  px(470, 136, 22, 28, OUT); px(471, 138, 20, 26, '#4a3a30'); px(473, 140, 16, 24, '#1a1210'); px(471, 137, 20, 1, '#6e655a');
  // Swords on the wall and a hanging anvil sign.
  for (const sx of [518, 526, 534]) { px(sx, 132, 3, 22, OUT); px(sx + 1, 133, 1, 14, '#dfe6ee'); px(sx, 147, 3, 1, '#a8743e'); px(sx + 1, 148, 1, 5, '#5a361c'); }
  px(512, 124, 1, 6, OUT); parts([[506, 129, 12, 8, '#7a4c2a']]); px(509, 131, 6, 2, '#2b2b33'); px(510, 133, 4, 2, '#2b2b33');
  door(502, 14, 20, '#6e4428');
}
function paintTemple() {
  shadow(592, 116, 94, 54);
  // Steps.
  parts([[588, 162, 100, 8, '#c8bea6']]); px(589, 162, 98, 1, '#e8e0cc');
  parts([[594, 156, 88, 6, '#d8cfb8']]); px(595, 156, 86, 1, '#f2ecdc');
  // Inner wall and columns.
  px(598, 118, 80, 38, OUT); px(599, 119, 78, 37, '#e6dcc4');
  for (const cx of [600, 616, 652, 668]) { px(cx - 1, 116, 10, 41, OUT); px(cx, 117, 8, 39, '#fbf7ee'); px(cx + 5, 117, 3, 39, '#d6ccb4'); px(cx - 1, 115, 10, 3, '#c8bea6'); px(cx - 1, 153, 10, 3, '#c8bea6'); }
  // Pediment.
  for (let i = 0; i < 24; i++) { const w = 104 - i * 4; px(638 - w / 2 - 1, 114 - i, w + 2, 1, OUT); px(638 - w / 2, 114 - i, w, 1, i < 3 ? '#c89818' : i % 4 === 0 ? '#e0b030' : '#f6d050'); }
  px(586, 112, 104, 4, OUT); px(587, 113, 102, 2, '#fff2b0');
  pell(638, 104, 5, 4, '#c89818'); pell(638, 104, 3, 2, '#fff2b0');
  // Brazier stands (fire drawn live).
  for (const bx of [592, 684]) { px(bx - 2, 148, 5, 10, OUT); px(bx - 1, 149, 3, 8, '#8d857a'); parts([[bx - 4, 144, 9, 4, '#5e574e']]); }
  door(638, 14, 22, '#584018'); px(631, 144, 14, 1, '#f2c23a');
}
function paintLighthouse() {
  pell(808, 170, 22, 7, '#5e574e'); pell(808, 168, 20, 6, '#8d857a'); pell(804, 166, 10, 3, '#a69e92');
  for (let i = 0; i < 70; i++) { const w = 22 - Math.floor(i / 9); px(808 - w / 2 - 1, 166 - i, w + 2, 1, OUT); px(808 - w / 2, 166 - i, w, 1, Math.floor(i / 12) % 2 ? '#d84848' : '#fbf7ee'); px(808 + w / 2 - 3, 166 - i, 3, 1, Math.floor(i / 12) % 2 ? '#a83030' : '#d6ccb4'); }
  px(796, 94, 24, 4, OUT); px(797, 95, 22, 2, '#5e574e');
  px(800, 82, 16, 12, OUT); px(801, 83, 14, 11, '#fff2b0');
  px(798, 76, 20, 6, OUT); px(799, 77, 18, 5, '#d84848'); px(806, 72, 4, 4, OUT); px(807, 73, 2, 3, '#f2c23a');
  door(808, 8, 12, '#584018');
}
function paintCave() {
  // A dark mouth in the cliff with a timber frame, rails running in, and a minecart.
  pell(1145, 150, 24, 22, '#4a3a2e'); px(1121, 150, 48, 20, '#4a3a2e');
  pell(1145, 152, 18, 17, '#120c0a'); px(1127, 152, 36, 18, '#120c0a');
  parts([[1120, 132, 6, 38, '#8a5a32'], [1164, 132, 6, 38, '#8a5a32'], [1116, 127, 58, 6, '#6e4428']]);
  px(1117, 128, 56, 1, '#a8743e'); px(1121, 133, 1, 36, '#a8743e'); px(1165, 133, 1, 36, '#a8743e');
  for (let y = 156; y < 172; y += 3) px(1135, y, 20, 1, '#4a2e1a');
  px(1138, 154, 2, 18, '#a0a0aa'); px(1150, 154, 2, 18, '#a0a0aa');
  parts([[1092, 172, 14, 7, '#6e695f']]); px(1093, 172, 12, 2, '#8d857a'); pell(1095, 180, 2, 2, OUT); pell(1103, 180, 2, 2, OUT);
  px(1093, 170, 3, 2, '#5a4a40'); px(1097, 169, 4, 3, '#2d8fd8'); px(1101, 170, 3, 2, '#5a4a40'); // ore in the cart
  for (const lx of [1112, 1178]) { px(lx, 140, 1, 4, OUT); parts([[lx - 2, 144, 5, 6, '#3a3448']]); }
}
function paintBridge() {
  const x0 = RIVER[0] - 8, x1 = RIVER[1] + 8, y0 = 189, y1 = 211;
  px(x0, y1 + 1, x1 - x0, 3, 'rgba(10,30,60,0.35)');
  px(x0, y0, x1 - x0, y1 - y0, OUT);
  for (let x = x0 + 1, k = 0; x < x1 - 1; x += 4, k++) { px(x, y0 + 1, 3, y1 - y0 - 2, k % 2 ? '#b07a46' : '#c08a52'); px(x, y0 + 1, 3, 1, '#d8a46a'); if (hash2(x, 3) < 0.4) px(x + 1, y0 + 6 + hash2(x, 7) * 10, 1, 1, '#7a4c2a'); }
  for (const yy of [y0 - 4, y1 - 1]) { px(x0, yy, x1 - x0, 3, OUT); px(x0 + 1, yy + 1, x1 - x0 - 2, 1, '#8a5a32'); for (let x = x0; x < x1; x += 16) { px(x, yy - 3, 4, 7, OUT); px(x + 1, yy - 2, 2, 5, '#a8743e'); } }
}
function paintPier() {
  const x0 = 841, x1 = 856, y0 = 211, y1 = 262;
  px(x0 - 1, y1, x1 - x0 + 2, 3, 'rgba(10,30,60,0.35)');
  px(x0 - 1, y0, x1 - x0 + 2, y1 - y0 + 1, OUT);
  for (let y = y0, k = 0; y < y1; y += 3, k++) { px(x0, y, x1 - x0, 2, k % 2 ? '#b07a46' : '#c08a52'); px(x0, y, x1 - x0, 1, '#d8a46a'); }
  for (const [x, y] of [[x0 - 2, 226], [x1, 226], [x0 - 2, 258], [x1, 258]]) { px(x, y, 3, 7, OUT); px(x + 1, y, 1, 6, '#7a4c2a'); }
}
function paintFarm() {
  // Wooden border posts, a scarecrow, hay bales and a water trough.
  for (let x = FIELD.x - 3; x <= FIELD.x + FIELD.w + 1; x += 11) { px(x, FIELD.y - 4, 3, 6, OUT); px(x + 1, FIELD.y - 3, 1, 5, '#a8743e'); }
  px(FIELD.x - 3, FIELD.y - 2, FIELD.w + 6, 1, '#7a4c2a');
  px(413, 222, 2, 24, OUT); px(406, 229, 16, 2, OUT); px(414, 223, 1, 22, '#a8743e'); px(407, 229, 14, 1, '#d8b060');
  parts([[410, 217, 9, 7, '#e8c088']]); px(408, 215, 13, 3, OUT); px(409, 215, 11, 2, '#c89040'); px(411, 213, 7, 3, '#c89040'); px(412, 220, 1, 1, OUT); px(416, 220, 1, 1, OUT);
  parts([[409, 225, 11, 9, '#4a7ac8']]); px(409, 225, 11, 2, '#6a96e0');
  for (const [hx, hy] of [[426, 236], [440, 240], [432, 248]]) { parts([[hx, hy, 12, 8, '#e0b84a']]); px(hx, hy, 12, 2, '#f6d878'); px(hx, hy + 4, 12, 1, '#b88a2a'); }
}
function paintWoodYard() {
  // Woodcutter's corner: a chopping stump, a stack of logs and a tree stump.
  pell(520, 250, 9, 3, 'rgba(20,45,15,0.32)');
  parts([[513, 244, 14, 6, '#7a4c2a'], [511, 248, 3, 2, '#7a4c2a'], [526, 248, 3, 2, '#7a4c2a']]); pell(520, 243, 7, 2, OUT); pell(520, 243, 6, 1, '#d8b070'); px(518, 243, 4, 1, '#a8743e'); px(516, 245, 1, 4, '#5a361c'); px(523, 246, 1, 3, '#5a361c');
  // Log pile: round ends stacked three high.
  pell(546, 252, 16, 3, 'rgba(20,45,15,0.32)');
  for (const [lx, ly] of [[534, 246], [541, 246], [548, 246], [555, 246], [538, 240], [545, 240], [552, 240], [541, 234], [548, 234]]) { pell(lx, ly, 3, 3, OUT); pell(lx, ly, 2, 2, '#d8b070'); px(lx, ly, 1, 1, '#a8743e'); }
  pell(480, 244, 6, 2, 'rgba(20,45,15,0.32)'); parts([[475, 238, 10, 5, '#7a4c2a'], [473, 241, 3, 2, '#7a4c2a'], [484, 241, 3, 2, '#7a4c2a']]); pell(480, 237, 5, 2, OUT); pell(480, 237, 4, 1, '#d8b070'); px(479, 237, 2, 1, '#a8743e');
  for (const [cx, cy] of [[506, 252], [526, 254], [512, 256], [530, 248]]) px(cx, cy, 2, 1, '#d8b070'); // chips
  // Smith's yard in front of the forge: anvil and a water barrel (the smith and his grindstone are live).
  parts([[474, 180, 12, 4, '#3a3a44'], [477, 184, 6, 3, '#3a3a44'], [475, 187, 10, 2, '#3a3a44']]); px(474, 180, 12, 1, '#8a8a96');
  parts([[549, 176, 9, 11, '#8a5a32']]); px(549, 179, 9, 1, '#3a3a44'); px(549, 184, 9, 1, '#3a3a44'); px(550, 176, 7, 2, '#5aa6e6');
}

// ---------- people and animals, drawn live ----------
// A little villager: x is the middle, y the feet. step 0/1/2 moves the legs; dir is the way they face.
function villager(x, y, dir, L, step = 0, extra = []) {
  const lo = step === 1 ? -1 : 0, ro = step === 2 ? 1 : 0;
  const p = [
    [x - 3 + lo, y - 4, 2, 3, L.pants], [x + 1 + ro, y - 4, 2, 3, L.pants],
    [x - 3 + lo, y - 2, 2, 2, L.boots], [x + 1 + ro, y - 2, 2, 2, L.boots],
    [x - 4, y - 10, 8, 6, L.shirt],
    [x - 3, y - 15, 6, 5, L.skin],
  ];
  pell(x, y, 5, 1, 'rgba(20,45,15,0.35)');
  parts(p.concat(extra));
  px(x - 4, y - 5, 8, 1, L.belt || shade(L.shirt, -0.35));
  px(x - 3, y - 15, 6, 1, L.hair); px(dir > 0 ? x - 3 : x + 2, y - 14, 1, 3, L.hair);
  px(dir > 0 ? x + 1 : x - 2, y - 13, 1, 1, OUT); px(dir > 0 ? x + 2 : x - 3, y - 11, 1, 1, shade(L.skin, -0.2));
  if (L.hat) { px(x - 5, y - 16, 10, 2, OUT); px(x - 4, y - 16, 8, 1, L.hat); px(x - 3, y - 18, 6, 2, OUT); px(x - 2, y - 18, 4, 2, L.hat); }
  for (const [ex, ey, ew, eh, ec] of extra) px(ex, ey, ew, eh, ec); // tools sit over the body
}
const FARMER = { skin: '#f0c8a0', hair: '#7a4a26', hat: '#e8c060', shirt: '#5a9a48', pants: '#4a6ab0', boots: '#5a361c' };
const CUTTER = { skin: '#e0a880', hair: '#3a2418', shirt: '#c83c3c', pants: '#4a4a5a', boots: '#3a2418', belt: '#3a2418' };
const SMITH = { skin: '#d8a078', hair: '#2a2420', shirt: '#6a6a74', pants: '#3a3448', boots: '#2a2420', belt: '#7a4c2a' };

function crop(kind, x, y, t) {
  if (kind === 0) { const s = Math.round(Math.sin(t * 2 + x / 9)); px(x, y - 6, 1, 6, '#c8a040'); px(x + 2, y - 5, 1, 5, '#b89030'); px(x - 1 + s, y - 8, 2, 3, '#f2d060'); px(x + 2 + s, y - 7, 2, 2, '#e8c050'); }
  if (kind === 1) { pell(x + 1, y - 2, 3, 2, '#2f7228'); pell(x + 1, y - 3, 2, 1, '#78c858'); px(x, y - 3, 1, 1, '#b8e898'); }
  if (kind === 2) { px(x, y - 4, 1, 3, '#4ea548'); px(x + 2, y - 5, 1, 4, '#3f8a30'); px(x + 1, y - 2, 2, 2, '#f08a28'); }
  if (kind === 3) { pell(x + 1, y - 2, 3, 2, OUT); pell(x + 1, y - 2, 2, 1, '#f08a28'); px(x + 1, y - 4, 1, 2, '#3f8a30'); px(x, y - 3, 1, 1, '#f8b060'); }
  if (kind === 4) { px(x, y - 6, 1, 6, '#3f8a30'); px(x + 2, y - 5, 1, 5, '#3f8a30'); px(x - 1, y - 4, 1, 1, '#e04040'); px(x + 3, y - 3, 1, 1, '#e04040'); px(x + 1, y - 6, 1, 1, '#e04040'); }
}
const CROP_ROWS = [0, 1, 2, 3].map(k => FIELD.y + 7 + k * 8);

function drawFarm(dt, t) {
  const f = WORLD.farmer || (WORLD.farmer = { x: 330, y: CROP_ROWS[2] + 3, tx: 360, wait: 0, dir: 1, walk: 0 });
  if (f.wait > 0) {
    f.wait -= dt;
    if (Math.random() < dt * 14) WORLD.fx.push({ x: f.x + f.dir * 9, y: f.y - 8, vx: f.dir * 4, vy: 8, g: 60, t: 0, life: 0.45, c: '#8cd0ff', s: 1 });
    if (f.wait <= 0) { f.tx = FIELD.x + 8 + Math.random() * (FIELD.w - 16); f.dir = f.tx > f.x ? 1 : -1; }
  } else {
    const d = f.tx - f.x;
    f.x += Math.sign(d) * Math.min(Math.abs(d), dt * 12); f.walk += dt;
    if (Math.abs(d) < 0.5) f.wait = 1.4 + Math.random() * 1.4;
  }
  const kinds = [0, 1, 2, 3];
  const row = (k) => { for (let x = FIELD.x + 5; x < FIELD.x + FIELD.w - 4; x += 7) crop(kinds[k], x, CROP_ROWS[k], t); };
  for (let k = 0; k < CROP_ROWS.length; k++) if (CROP_ROWS[k] <= f.y) row(k);
  const pouring = f.wait > 0, step = pouring ? 0 : (Math.floor(f.walk * 7) % 2) + 1, dx = f.dir;
  const can = pouring
    ? [[f.x + dx * 4 - (dx < 0 ? 4 : 0), f.y - 9, 5, 4, '#7aa0c8'], [f.x + dx * 8 - (dx < 0 ? 2 : 0), f.y - 10, 3, 1, '#7aa0c8'], [f.x + dx * 2 - (dx < 0 ? 2 : 0), f.y - 9, 3, 2, FARMER.skin]]
    : [[f.x + dx * 3 - (dx < 0 ? 4 : 0), f.y - 7, 5, 4, '#7aa0c8'], [f.x + dx * 2 - (dx < 0 ? 2 : 0), f.y - 8, 2, 2, FARMER.skin]];
  villager(Math.round(f.x), f.y, dx, FARMER, step, can.map(a => a.map((v, i) => (i < 2 ? Math.round(v) : v))));
  for (let k = 0; k < CROP_ROWS.length; k++) if (CROP_ROWS[k] > f.y) row(k);
}

function drawWoodcutter(t) {
  const x = 507, y = 249, p = (t % 1.6) / 1.6;
  const pose = p < 0.45 ? 'up' : p < 0.55 ? 'mid' : p < 0.8 ? 'down' : 'mid';
  if (pose === 'down' && WORLD.chopPose !== 'down') {
    for (let i = 0; i < 6; i++) WORLD.fx.push({ x: 519, y: 241, vx: (Math.random() - 0.3) * 40, vy: -30 - Math.random() * 30, g: 160, t: 0, life: 0.6, c: i % 2 ? '#d8b070' : '#a8743e', s: 1 });
    WORLD.thunk = 0.12;
  }
  WORLD.chopPose = pose;
  const tool = {
    up: [[x - 2, y - 13, 2, 2, CUTTER.skin], [x - 2, y - 22, 1, 9, '#8a5a32'], [x - 5, y - 23, 4, 4, '#b8c0c8']],
    mid: [[x + 3, y - 10, 3, 2, CUTTER.skin], [x + 5, y - 14, 1, 6, '#8a5a32'], [x + 5, y - 17, 5, 3, '#b8c0c8']],
    down: [[x + 3, y - 8, 3, 2, CUTTER.skin], [x + 5, y - 8, 7, 1, '#8a5a32'], [x + 10, y - 10, 3, 4, '#b8c0c8']],
  }[pose];
  villager(x, y, 1, CUTTER, 0, tool);
  // A log on the stump that jumps a little when hit.
  const j = (WORLD.thunk || 0) > 0 ? -1 : 0;
  parts([[516, 235 + j, 8, 7, '#7a4c2a']]); px(517, 236 + j, 1, 5, '#5a361c'); px(521, 237 + j, 1, 4, '#5a361c'); pell(520, 235 + j, 4, 1, '#d8b070'); px(519, 235 + j, 2, 1, '#a8743e');
}

function drawSmith(dt, t) {
  const x = 527, y = 187, cyc = t % 7, inspect = cyc > 5.4;
  // The grindstone: a stone wheel on a wooden frame, spinning while he works.
  const wx = 541, wy = 180, a = inspect ? 0 : t * 9;
  px(536, 183, 2, 6, OUT); px(545, 183, 2, 6, OUT); px(536, 186, 11, 2, OUT); px(537, 186, 9, 1, '#a8743e');
  pell(wx, wy, 7, 7, OUT); pell(wx, wy, 6, 6, '#a69e92'); pell(wx - 1, wy - 1, 4, 4, '#c8c0b4');
  for (let k = 0; k < 4; k++) { const ang = a + (k * Math.PI) / 2; px(wx + Math.cos(ang) * 4, wy + Math.sin(ang) * 4, 1, 1, '#6e655a'); }
  px(wx, wy, 1, 1, OUT);
  const wob = inspect ? 0 : Math.round(Math.sin(t * 10));
  const tool = inspect
    ? [[x - 1, y - 12, 3, 2, SMITH.skin], [x, y - 24, 1, 12, '#e8eef6'], [x - 2, y - 12, 5, 1, '#c8a040']]
    : [[x + 3 + wob, y - 9, 3, 2, SMITH.skin], [x + 5 + wob, y - 9, 2, 1, '#5a361c'], [x + 7 + wob, y - 11, 1, 4, '#c8a040'], [x + 8 + wob, y - 9, 6, 1, '#e8eef6']];
  // Leather apron over his shirt.
  villager(x, y, 1, SMITH, 0, tool.concat([[x - 2, y - 9, 4, 5, '#8a5a32']]));
  if (!inspect && Math.random() < dt * 40) {
    const hot = ['#fff4c0', '#ffd860', '#ff9a30'];
    WORLD.fx.push({ x: wx - 5, y: wy - 3, vx: 10 + Math.random() * 40, vy: -40 + Math.random() * 30, g: 120, t: 0, life: 0.3 + Math.random() * 0.25, c: hot[Math.floor(Math.random() * 3)], s: 1 });
  }
}

function drawChickens(dt, t) {
  const hens = WORLD.hens || (WORLD.hens = [[150, 232], [172, 246], [138, 254]].map(([x, y], i) => ({ x, y, dir: i % 2 ? 1 : -1, peck: 0, go: 0, tx: x, ty: y })));
  for (const h of hens) {
    if (h.peck > 0) h.peck -= dt;
    else if (Math.hypot(h.tx - h.x, h.ty - h.y) > 0.6) { const d = Math.hypot(h.tx - h.x, h.ty - h.y); h.x += ((h.tx - h.x) / d) * dt * 9; h.y += ((h.ty - h.y) / d) * dt * 9; h.dir = h.tx > h.x ? 1 : -1; }
    else if (Math.random() < dt * 0.8) { h.tx = 124 + Math.random() * 66; h.ty = 226 + Math.random() * 34; }
    else if (Math.random() < dt * 1.5) h.peck = 0.5;
    const x = Math.round(h.x), y = Math.round(h.y), d = h.dir, down = h.peck > 0 && Math.floor(h.peck * 8) % 2;
    pell(x, y, 3, 1, 'rgba(20,45,15,0.35)');
    parts([[x - 3, y - 5, 6, 4, '#fbf7ee'], [x + (d > 0 ? 1 : -3), y - (down ? 4 : 8), 3, 3, '#fbf7ee']]);
    px(x + (d > 0 ? 2 : -2), y - (down ? 5 : 9), 1, 1, '#e04040'); px(x + (d > 0 ? 4 : -4), y - (down ? 3 : 7), 1, 1, '#f2a028');
    px(x + (d > 0 ? 2 : -2), y - (down ? 3 : 7), 1, 1, OUT); px(x - (d > 0 ? 3 : -2), y - 5, 1, 2, '#d6ccb4');
    px(x - 1, y - 1, 1, 1, '#f2a028'); px(x + 1, y - 1, 1, 1, '#f2a028');
  }
}

function drawSheep(t, dt) {
  WORLD.sheep = WORLD.sheep || [0, 0, 0, 0].map(() => ({ x: 0, y: 0, hop: 0 }));
  [[376, 74, 0], [400, 82, 2], [566, 68, 4], [700, 78, 1]].forEach(([x0, y0, ph], i) => {
    const sh = WORLD.sheep[i]; sh.hop = Math.max(0, sh.hop - dt);
    const y = y0 - Math.round(Math.sin((sh.hop / 0.5) * Math.PI) * 5);
    const x = Math.round(x0 + Math.sin(t * 0.15 + ph) * 6); sh.x = x; sh.y = y0;
    const dir = Math.cos(t * 0.15 + ph) > 0 ? 1 : -1, down = Math.sin(t * 1.3 + ph) > 0.3;
    pell(x, y, 6, 1, 'rgba(20,45,15,0.35)');
    px(x - 4, y - 2, 2, 2, OUT); px(x + 2, y - 2, 2, 2, OUT);
    parts([[x - 5, y - 8, 10, 6, '#fbf7ee'], [x + (dir > 0 ? 4 : -7), y - (down ? 5 : 9), 3, 4, '#3a3448']]);
    px(x - 4, y - 8, 4, 1, '#ffffff'); px(x - 1, y - 4, 5, 1, '#d6ccb4');
  });
}

// ---------- tapping the world: animals, villagers, water and tall grass answer back ----------
const TALL = [[600, 230, 64, 30], [900, 222, 96, 40], [940, 96, 80, 56], [1030, 230, 56, 32]];
const LINES = {
  farmer: ['Carrots soon!', 'Water, water...', 'Lovely day!', 'Mind the pumpkins.'],
  cutter: ['Timber!', 'Wood for the forge.', 'Hup!', 'One more log...'],
  smith: ['Sharp as ever.', 'Need an upgrade?', 'Hot work!', 'Bring me ore!'],
};
function say(x, y, text) { WORLD.bubbles = (WORLD.bubbles || []).filter(b => Math.abs(b.x - x) > 4).concat({ x, y, text, t: 0 }); }
function worldTap(wx, wy) {
  const near = (x, y, r) => Math.hypot(wx - x, wy - y) < r;
  const sheep = (WORLD.sheep || []).findIndex(s => near(s.x, s.y - 5, 10));
  if (sheep >= 0) { const s = WORLD.sheep[sheep]; s.hop = 0.5; CRITTER_SFX.baa(0.85 + sheep * 0.1); say(s.x, s.y - 14, 'Baa!'); return; }
  const hen = (WORLD.hens || []).find(h => near(h.x, h.y - 4, 8));
  if (hen) { hen.tx = Math.max(124, Math.min(190, hen.x + (wx < hen.x ? 22 : -22))); hen.ty = Math.max(226, Math.min(260, hen.y + (Math.random() - 0.5) * 16)); hen.peck = 0; CRITTER_SFX.cluck(); say(hen.x, hen.y - 12, 'Bawk!'); return; }
  const pick = k => LINES[k][Math.floor(Math.random() * LINES[k].length)];
  const f = WORLD.farmer;
  if (f && near(f.x, f.y - 8, 10)) { CRITTER_SFX.talk(1); say(f.x, f.y - 22, pick('farmer')); return; }
  if (near(507, 241, 10)) { CRITTER_SFX.talk(0.8); say(507, 226, pick('cutter')); return; }
  if (near(527, 179, 10)) { CRITTER_SFX.talk(0.7); say(527, 162, pick('smith')); return; }
  if (terrainAt(wx, wy) === T.WATER) { CRITTER_SFX.splash(); for (let i = 0; i < 8; i++) WORLD.fx.push({ x: wx, y: wy, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, g: 140, t: 0, life: 0.5, c: i % 2 ? '#ffffff' : '#bfe3f8', s: 1 }); return; }
  if (TALL.some(([x, y, w, h]) => wx >= x && wx < x + w && wy >= y && wy < y + h)) { CRITTER_SFX.rustle(); for (let i = 0; i < 6; i++) WORLD.fx.push({ x: wx, y: wy, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, g: 50, t: 0, life: 0.7, c: i % 2 ? '#7ccc58' : '#4da03a', s: 1 }); }
}
function drawBubbles(g, dt) {
  WORLD.bubbles = (WORLD.bubbles || []).filter(b => (b.t += dt) < 2.2);
  g.font = '8px "Jersey 10", monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
  for (const b of WORLD.bubbles) {
    const w = Math.ceil(g.measureText(b.text).width) + 6, y = Math.round(b.y - Math.min(3, b.t * 12)), x = Math.round(Math.max(w / 2 + 2, Math.min(WW - w / 2 - 2, b.x)));
    g.globalAlpha = Math.min(1, (2.2 - b.t) * 3);
    g.fillStyle = OUT; g.fillRect(x - w / 2 - 1, y - 6, w + 2, 11); g.fillRect(Math.round(b.x) - 2, y + 5, 4, 2);
    g.fillStyle = '#fbf7ee'; g.fillRect(x - w / 2, y - 5, w, 9); g.fillRect(Math.round(b.x) - 1, y + 4, 2, 2);
    g.fillStyle = OUT; g.fillText(b.text, x, y);
    g.globalAlpha = 1;
  }
}

// ---------- each frame ----------
function drawLive(g, dt, t) {
  // River and pond: flowing streaks and sparkles.
  for (let i = 0; i < 26; i++) {
    const y = (i * 53 + t * (10 + (i % 3) * 3)) % WH, [w0, w1] = riverBanks(y), x = w0 + 10 + ((i * 37) % (w1 - w0 - 20));
    g.fillStyle = 'rgba(200,232,255,0.55)'; g.fillRect(Math.round(x), Math.round(y), 1, 4);
  }
  for (let i = 0; i < 14; i++) if (Math.sin(t * 2.3 + i * 1.7) > 0.8) { g.fillStyle = '#ffffff'; g.fillRect(RIVER[0] + 12 + ((i * 29) % 96), (i * 41) % WH, 2, 1); }
  const rp = (t % 3) / 3; g.strokeStyle = `rgba(220,240,255,${0.6 * (1 - rp)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(244, 252, 2 + rp * 9, 1 + rp * 3, 0, 0, Math.PI * 2); g.stroke();
  // Lights: forge furnace, temple braziers, the crystal, cave lanterns, the lighthouse lamp.
  const fl = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3);
  g.fillStyle = '#c04018'; g.fillRect(473, 152, 16, 12); g.fillStyle = fl > 0.5 ? '#ff9a30' : '#f07a20'; g.fillRect(474, 150 + Math.round(fl * 3), 14, 14 - Math.round(fl * 3));
  g.fillStyle = '#ffd860'; g.fillRect(477, 156 + Math.round(fl * 2), 8, 8 - Math.round(fl * 2)); g.fillStyle = '#fff4c0'; g.fillRect(479, 160, 4, 4);
  glow(g, 481, 156, 18, `rgba(255,140,40,${0.18 + fl * 0.1})`);
  for (const bx of [592, 684]) {
    const f = Math.sin(t * 11 + bx);
    g.fillStyle = '#f07a20'; g.fillRect(bx - 3, 140 - (f > 0 ? 1 : 0), 7, 4); g.fillStyle = '#ffd860'; g.fillRect(bx - 1, 138 + (f > 0 ? 0 : 1), 3, 4); g.fillStyle = '#fff4c0'; g.fillRect(bx, 141, 1, 2);
    glow(g, bx, 141, 10, 'rgba(255,170,60,0.22)');
  }
  glow(g, 638, 104, 9 + Math.sin(t * 2) * 2, 'rgba(120,220,255,0.3)');
  for (const lx of [1112, 1178]) { g.fillStyle = Math.sin(t * 9 + lx) > -0.6 ? '#ffd860' : '#f2a028'; g.fillRect(lx - 1, 145, 3, 4); glow(g, lx, 147, 9, 'rgba(255,200,80,0.25)'); }
  const beam = Math.sin(t * 0.9);
  g.fillStyle = `rgba(255,245,180,${0.12 + 0.08 * Math.abs(beam)})`; g.beginPath(); g.moveTo(808, 88); g.lineTo(808 + beam * 70, 70); g.lineTo(808 + beam * 70, 106); g.fill();
  g.fillStyle = Math.sin(t * 3) > 0 ? '#fff8d0' : '#f2d060'; g.fillRect(803, 85, 10, 6);
  if (Math.sin(t * 1.3) > 0.93) { g.fillStyle = '#ffffff'; g.fillRect(134, 133, 1, 5); g.fillRect(132, 135, 5, 1); } // glint on the cup
  // Chimney smoke.
  for (const [sx, sy] of [[524, 60], [261, 84]]) if (Math.random() < dt * 1.6) WORLD.smoke.push({ x: sx, y: sy, t: 0 });
  for (const s of WORLD.smoke) { s.t += dt; s.y -= dt * 7; s.x += dt * (3 + s.t); g.fillStyle = `rgba(236,236,244,${Math.max(0, 0.75 - s.t * 0.19)})`; const r = 2 + Math.round(s.t * 1.2); g.fillRect(Math.round(s.x - r / 2), Math.round(s.y - r / 2), r, r); }
  WORLD.smoke = WORLD.smoke.filter(s => s.t < 4);
  // A rowboat bobbing at the end of the pier, the windmill's sails, and the street lamps.
  const bob = Math.round(Math.sin(t * 2)) * 1;
  g.fillStyle = 'rgba(10,30,60,0.3)'; g.fillRect(858, 268, 20, 2);
  g.fillStyle = OUT; g.fillRect(857, 258 + bob, 22, 9); g.fillStyle = '#a8743e'; g.fillRect(858, 259 + bob, 20, 7); g.fillStyle = '#7a4c2a'; g.fillRect(860, 261 + bob, 16, 4); g.fillStyle = '#d8a46a'; g.fillRect(858, 259 + bob, 20, 1);
  g.fillStyle = '#5a361c'; g.fillRect(866, 261 + bob, 3, 4);
  const sa = t * 0.8;
  for (let k = 0; k < 4; k++) {
    const a = sa + (k * Math.PI) / 2, ca = Math.cos(a), sn = Math.sin(a);
    for (let d = 3; d < 22; d++) { const x = 436 + ca * d, y = 82 + sn * d; g.fillStyle = OUT; g.fillRect(Math.round(x), Math.round(y), 1, 1); if (d > 6) { g.fillStyle = d % 3 ? '#f6f0e0' : '#c8b898'; for (let w = 1; w <= 3; w++) g.fillRect(Math.round(x - sn * w), Math.round(y + ca * w), 1, 1); } }
  }
  g.fillStyle = OUT; g.fillRect(434, 80, 4, 4); g.fillStyle = '#a8743e'; g.fillRect(435, 81, 2, 2);
  for (const lx of [60, 162]) glow(g, lx, 173, 8, `rgba(255,220,120,${0.18 + 0.05 * Math.sin(t * 4 + lx)})`);
  // People and animals.
  WORLD.thunk = Math.max(0, (WORLD.thunk || 0) - dt);
  const prev = WORLD.ctx; WORLD.ctx = g;
  drawSheep(t, dt); drawSmith(dt, t); drawWoodcutter(t); drawFarm(dt, t); drawChickens(dt, t);
  WORLD.ctx = prev;
  // Sparks, wood chips and water drops.
  for (const p of WORLD.fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  g.globalAlpha = 1; WORLD.fx = WORLD.fx.filter(p => p.t < p.life);
  // Butterflies over the flowers.
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = [[200, 226], [300, 244], [700, 240], [960, 186]][i], x = cx + Math.sin(t * 0.7 + i) * 22, y = cy + Math.sin(t * 1.4 + i * 2) * 9 - 6;
    const open = Math.floor(t * 9 + i) % 2, c = ['#ffffff', '#f8e04a', '#ff9ad0', '#6fb2ff'][i];
    g.fillStyle = c; if (open) { g.fillRect(Math.round(x) - 2, Math.round(y), 2, 2); g.fillRect(Math.round(x) + 1, Math.round(y), 2, 2); } else g.fillRect(Math.round(x), Math.round(y) - 1, 1, 2);
    g.fillStyle = OUT; g.fillRect(Math.round(x), Math.round(y), 1, 2);
  }
  // The spawn pad glow, a boss waiting in the cave, and you.
  g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); g.fillStyle = '#c8f8ff'; g.fillRect(SPAWN.x - 6, SPAWN.y + 1, 12, 4); g.globalAlpha = 1;
  if (typeof bossWaiting === 'function' && bossWaiting() && Math.floor(t * 2) % 2) { g.fillStyle = '#ff3040'; g.fillRect(1139, 160, 2, 1); g.fillRect(1149, 160, 2, 1); glow(g, 1145, 162, 14, 'rgba(255,40,60,0.25)'); }
  g.drawImage(heroSprite(0), SPAWN.x - 8, SPAWN.y - 13 + (Math.floor(t * 2) % 2), 16, 16);
  drawBubbles(g, dt);
  // Birds crossing high up, and slow cloud shadows over everything.
  const bx = ((t * 26) % (WW + 300)) - 150;
  for (const [ox, oy] of [[0, 0], [-7, -4], [-7, 4]]) { const fx = Math.floor(t * 6 + ox) % 2; g.fillStyle = '#2a2a3a'; g.fillRect(Math.round(bx + ox), Math.round(58 + oy + Math.sin(t) * 3), 1, 1); g.fillRect(Math.round(bx + ox - 2), Math.round(58 + oy - fx + Math.sin(t) * 3), 2, 1); g.fillRect(Math.round(bx + ox + 1), Math.round(58 + oy - fx + Math.sin(t) * 3), 2, 1); }
  g.fillStyle = 'rgba(20,40,70,0.09)';
  for (const [off, cy, rx] of [[0, 90, 70], [520, 230, 56], [900, 150, 80]]) { const cx = ((t * 5 + off) % (WW + 300)) - 150; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.36, 0, 0, Math.PI * 2); g.fill(); }
}
function glow(g, x, y, r, c) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

function drawWorld(dt) {
  const g = WORLD.ctx, dpr = WORLD.dpr, z = WORLD.z;
  WORLD.t += dt;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#1f4720'; g.fillRect(0, 0, WORLD.cv.width, WORLD.cv.height);
  g.setTransform(dpr * z, 0, 0, dpr * z, -WORLD.cam.x * dpr * z, -WORLD.cam.y * dpr * z);
  g.imageSmoothingEnabled = false;
  g.drawImage(WORLD.img, 0, 0);
  drawLive(g, dt, WORLD.t);
  // A soft shade at the top and bottom of the screen pulls the eye to the road.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const H = WORLD.cv.height, vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(10,20,30,0.28)'); vg.addColorStop(0.18, 'rgba(10,20,30,0)'); vg.addColorStop(0.85, 'rgba(10,20,30,0)'); vg.addColorStop(1, 'rgba(10,20,30,0.3)');
  g.fillStyle = vg; g.fillRect(0, 0, WORLD.cv.width, H);
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
    $('#world').addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const r = $('#world').getBoundingClientRect();
      worldTap(WORLD.cam.x + (e.clientX - r.left) / WORLD.z, WORLD.cam.y + (e.clientY - r.top) / WORLD.z);
    });
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
