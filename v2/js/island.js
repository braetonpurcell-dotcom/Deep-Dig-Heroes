'use strict';
// Version 2 home screen: a side-scrolling route in the spirit of the old Pokemon games. Every 100
// floors of depth the world becomes a new island (ISLANDS in data.js, styles in ISLE_STYLE below). The world is
// one long strip that fills the screen top to bottom; you swipe left and right only. You start at
// the far left in town on the spawn plaza (quest board, trophy statue, your miner, your house), then
// the road heads east past the farm, the market, the forge and its woodcutter, the temple, over a
// wooden bridge across the river (lighthouse and dock), through tall grass to the mountain and the
// cave. Every door faces down and a short path comes up into it from the road.
//
// The ground is painted once into an offscreen canvas (paintWorld). Everything that moves (people,
// animals, fire, water, smoke, clouds) is drawn on top each frame (drawLive).

const WW = 1200, WH = 300; // world size in world pixels
const SPAWN = { x: 110, y: 200 };
// me: your miner walking the road (hold the arrow buttons); held is -1, 0 or 1.
const WORLD = { cv: null, ctx: null, img: null, cam: { x: 0, y: 0 }, z: 2, vx: 0, drag: null, moved: false, t: 0, smoke: [], fx: [], dpr: 1, vw: 0, vh: 0,
  me: { x: SPAWN.x, dir: 1, held: 0, walkT: 0 }, scene: 'home', wmax: 860 };
const WALK_SPEED = 70; // world pixels a second
const RIVER = [748, 872]; // the river's west and east banks
const DOOR_Y = 168; // the bottom of every door on the north side of the road (the house sits further back)
const HOUSE_BACK = 22; // how far the house is set back from the others, for its front yard
const POND = { x: 250, y: 250, rx: 30, ry: 14 };
const FIELD = { x: 314, y: 222, w: 88, h: 32 }; // the farm's crop field, south of the road

// Places: tap box (x, y, w, h) in world pixels and the door's x. 'lb' opens the leaderboard.
const BUILDINGS = [
  { tab: 'quests', name: 'Quests', x: 64, y: 136, w: 44, h: 34, dx: 86 },
  { tab: 'lb', name: 'Leaderboard', x: 122, y: 134, w: 32, h: 36, dx: 137 },
  { tab: 'bag', name: 'House', x: 200, y: 70, w: 80, h: 78, dx: 240, doorY: 146 }, // set back behind a front yard
  { tab: 'cases', name: 'Market', x: 320, y: 104, w: 92, h: 66, dx: 366 },
  { tab: 'forge', name: 'Forge', x: 462, y: 90, w: 84, h: 80, dx: 502 },
  { tab: 'skills', name: 'Temple', x: 590, y: 84, w: 96, h: 86, dx: 638 },
  { tab: 'dock', name: 'Boat', x: 796, y: 192, w: 34, h: 32, dx: 808 },
];
// The road: a gentle winding curve from town east to the beach, where the dock goes out to sea.
const ROAD = [[40, 200], [110, 200], [180, 204], [260, 197], [350, 205], [440, 198], [530, 206], [620, 198], [700, 204],
  [744, 200]];
const SEA_X = 752; // the east shore; past it is open sea
const HOME_W = 860; // the town's width in world pixels (a strip of sea past the dock)
function seaX(y) { return SEA_X + Math.round(Math.sin(y / 15) * 6 + Math.sin(y / 5) * 1.5); }
const PIER = { x0: 738, x1: 806, y0: 191, y1: 209 };
// Version 2: the cave islands. Each is a small island of its own: a beach, scenery in the island's
// style, a cave in a rocky hill, and a dock where the boat lands. No houses.
const CAVE_W = 440; // world pixels wide
const CAVE_HILL = { x: 322, y: 140, rx: 70, ry: 58 };
const CAVE_SHORE = { x: 238, y: 172, rx: 196, ry: 118 };
const CAVE_PIER = { x0: 4, x1: 74, y0: 192, y1: 208 };
const CAVE_BUILDINGS = [
  { tab: 'dock', name: 'Boat', x: 0, y: 194, w: 30, h: 30, dx: 12 },
  { tab: 'fight', name: 'Cave', x: 296, y: 140, w: 52, h: 46, dx: 322 },
];
const CAVE_ROAD = [[20, 200], [70, 200], [130, 205], [190, 201], [250, 194], [298, 186], [318, 178], [322, 172]];
function smoothRoad(pts) {
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
}
const ROAD_PTS = smoothRoad(ROAD), CAVE_ROAD_PTS = smoothRoad(CAVE_ROAD);
function roadY(x) {
  const pts = WORLD.scene === 'cave' ? CAVE_ROAD_PTS : ROAD_PTS;
  let best = pts[0];
  for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return best[1];
}
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
// Version 2: every island has its own colours, trees, water and weather (see ISLANDS in data.js).
const ISLE_STYLE = {
  green: {
    grass: ['#4c9638', '#58a541', '#64b24a', '#71bf53', '#80cb5e'], road: ['#cfa76c', '#d9b37a', '#e3c088'], roadRim: '#9f7646', roadIn: '#c09660', pebble: '#b08a56', pebbleHi: '#efd6a2',
    water: ['#2c6db8', '#3480cc', '#3f8fda'], shallow: '#5aa6e6', foam: '#bfe3f8', sand: ['#d8bd80', '#e4cc92', '#eed9a2'], wet: '#c4a76a',
    plaza: ['#cdc3ae', '#d6cdb9', '#ded6c4'], mortar: '#a69c88', plazaRim: '#958b77', furrow: '#5b381f', ridge: ['#83532f', '#8e5d37', '#996841'], fieldRim: '#6a4327',
    rock: ['#7f6a55', '#8f7962', '#9f8970'], rockHi: '#bba387', rockLo: '#5a4737',
    tuft: ['#3e8430', '#94d86c'], tall: ['#2f6e26', '#3f8a30', '#4da03a', '#9ee070', '#7ccc58'], ledge: ['#86cc5e', '#4c8a34', '#2f5e22', '#3a7028'],
    bush: ['#1f4720', '#3a7e34', '#55a046', '#86c862', '#f25d5d'], flowers: ['#f25d5d', '#f8e04a', '#ffffff', '#b77df0', '#6fb2ff', '#ff9ad0'], stem: '#2f7228',
    leaf: ['#1f4720', '#2c6229', '#33702f', '#45903b', '#62b04c', '#8ad064'], pine: ['#173a1e', '#24582a', '#2d6a32', '#3f8a40'], trunk: ['#7a4c2a', '#5a361c'],
    tree: 'green', waterKind: 'water', lily: true, reeds: true, bg: '#1f4720', swatch: 'linear-gradient(135deg,#64b24a 55%,#3480cc 55%)',
  },
  frost: {
    grass: ['#c4d4e6', '#d0deee', '#dce7f4', '#e8f0f9', '#f4f8fd'], road: ['#b6a58c', '#c2b198', '#cdbda4'], roadRim: '#8a7b66', roadIn: '#a8987f', pebble: '#9a8a72', pebbleHi: '#e8dcc8',
    water: ['#8ec4e8', '#9acded', '#a6d6f1'], shallow: '#bfe4f8', foam: '#eef8ff', sand: ['#dfe8f2', '#e8eff7', '#f0f5fa'], wet: '#b8cadc',
    plaza: ['#c6ccd6', '#d0d6e0', '#dae0e8'], mortar: '#9ea6b2', plazaRim: '#8a92a0', furrow: '#8a9cb2', ridge: ['#d8e2ee', '#e2eaf4', '#ecf2f8'], fieldRim: '#9fb0c4',
    rock: ['#7c8796', '#8b97a6', '#9aa6b4'], rockHi: '#ffffff', rockLo: '#5a6472',
    tuft: ['#a4b6cc', '#ffffff'], tall: ['#9fb2c8', '#b8c8da', '#d0dcea', '#ffffff', '#eef4fa'], ledge: ['#ffffff', '#b8c8da', '#8a9cb2', '#a4b6cc'],
    bush: ['#1a3a30', '#2e5a48', '#e8f0f8', '#ffffff', '#d84848'], flowers: ['#9ad0f0', '#ffffff', '#bfe3f8', '#d8c8ff'], stem: '#7a9ab8',
    leaf: ['#1a3a30', '#24503e', '#2a5c48', '#3a7458', '#e8f0f8', '#ffffff'], pine: ['#14302a', '#1e4a3a', '#265a46', '#3a7a5a'], trunk: ['#6a4a34', '#4a3022'],
    tree: 'snow', snow: true, waterKind: 'ice', bg: '#2a4a3a', weather: 'snow', swatch: 'linear-gradient(135deg,#e8f0f9 55%,#9acded 55%)',
  },
  sand: {
    grass: ['#d6b06a', '#deba78', '#e6c486', '#edce94', '#f2d8a4'], road: ['#b88e58', '#c29862', '#cca26c'], roadRim: '#8a6236', roadIn: '#a67e4c', pebble: '#9a7444', pebbleHi: '#e8cc98',
    water: ['#1a8aa8', '#2298b6', '#2ca6c4'], shallow: '#52c2d4', foam: '#d2f4f2', sand: ['#7ab05a', '#86bc64', '#92c86e'], wet: '#5e9a48',
    plaza: ['#e0cca4', '#e8d6b0', '#efdfbc'], mortar: '#b8a07a', plazaRim: '#a68c66', furrow: '#8a5a2c', ridge: ['#b4844c', '#be8e56', '#c89860'], fieldRim: '#8a6236',
    rock: ['#b0603a', '#c06e44', '#cc7c4e'], rockHi: '#eeaa78', rockLo: '#7a3a20',
    tuft: ['#a8843c', '#fbe8b8'], tall: ['#a8843c', '#c09a4a', '#d4ae5a', '#f2d890', '#e6c470'], ledge: ['#f6e2b0', '#c8a060', '#9a7440', '#b08850'],
    bush: ['#3a4a22', '#5a6a30', '#7a8a40', '#a8b660', '#f2a028'], flowers: ['#f25d5d', '#ff9ad0', '#f8e04a', '#ffffff'], stem: '#6a8a38',
    leaf: ['#1f4720', '#2c6229', '#33702f', '#45903b', '#62b04c', '#8ad064'], pine: ['#173a1e', '#24582a', '#2d6a32', '#3f8a40'], trunk: ['#9a6a3a', '#7a4c2a'],
    tree: 'palm', gap: 17, waterKind: 'oasis', lily: true, reeds: true, bg: '#6a5a30', weather: 'dust', swatch: 'linear-gradient(135deg,#e6c486 55%,#2298b6 55%)',
  },
  ember: {
    grass: ['#2e2628', '#372e30', '#40363a', '#4a3f42', '#54484a'], road: ['#5c4c48', '#665652', '#70605c'], roadRim: '#2a2222', roadIn: '#4e403c', pebble: '#3a2e2c', pebbleHi: '#8a7470',
    water: ['#c8361a', '#dc461e', '#ec5a24'], shallow: '#ff8a2a', foam: '#ffd060', sand: ['#241c1e', '#2c2224', '#34282a'], wet: '#5a2a1a',
    plaza: ['#5a5054', '#645a5e', '#6e6468'], mortar: '#3a3236', plazaRim: '#2e282c', furrow: '#1e1618', ridge: ['#4a3a36', '#54423e', '#5e4a46'], fieldRim: '#2a2022',
    rock: ['#3c3236', '#463b3f', '#504448'], rockHi: '#7a5c50', rockLo: '#221a1c',
    tuft: ['#221c1e', '#6a5a5a'], tall: ['#2a2224', '#3a3032', '#4a3e40', '#ff7a2a', '#8a6a5a'], ledge: ['#6a5a5a', '#3a3032', '#221a1c', '#ff6a2a'],
    bush: ['#1a1214', '#3a2a2a', '#5a3a32', '#ff8a3a', '#ffd060'], flowers: ['#ff7a2a', '#ffd060', '#ff4a2a'], stem: '#4a3a36',
    leaf: ['#120c0e', '#2a2224', '#3a3032', '#4a3e40', '#5a4a4a', '#ff7a2a'], pine: ['#120c0e', '#2a2224', '#3a3032', '#4a3e40'], trunk: ['#2a2224', '#120c0e'],
    tree: 'dead', waterKind: 'lava', bg: '#1a1214', weather: 'embers', tint: 'rgba(255,80,30,0.08)', swatch: 'linear-gradient(135deg,#4a3f42 55%,#ec5a24 55%)',
  },
  star: {
    grass: ['#1c3c48', '#204452', '#264c5c', '#2c5666', '#346070'], road: ['#6e6e90', '#7a7a9c', '#8686a8'], roadRim: '#46466a', roadIn: '#5e5e80', pebble: '#56567a', pebbleHi: '#c8c8f0',
    water: ['#10183a', '#162046', '#1c2852'], shallow: '#24346a', foam: '#7a9ae8', sand: ['#3a4a6a', '#425274', '#4a5a7e'], wet: '#2c3a5a',
    plaza: ['#6a6a8a', '#747494', '#7e7e9e'], mortar: '#4a4a6a', plazaRim: '#3e3e5e', furrow: '#1a2236', ridge: ['#2e3a52', '#34405a', '#3a4662'], fieldRim: '#222a40',
    rock: ['#3a3058', '#463a68', '#524478'], rockHi: '#b8a6ff', rockLo: '#241c3a',
    tuft: ['#163038', '#5aa0b0'], tall: ['#163038', '#1e4450', '#2a5866', '#7af0ff', '#5ad0e0'], ledge: ['#5ad0e0', '#264c5c', '#122830', '#7af0ff'],
    bush: ['#0e2028', '#1e3e48', '#2e5a66', '#7af0ff', '#ff8af0'], flowers: ['#8ab4ff', '#d8a6ff', '#fff4a8', '#7af0ff'], stem: '#1e4450',
    leaf: ['#0e2028', '#163038', '#1e4450', '#2a5866', '#5ad0e0', '#7af0ff'], pine: ['#0e2028', '#163038', '#1e4450', '#2a5866'], trunk: ['#3a3058', '#241c3a'],
    tree: 'crystal', waterKind: 'night', lily: true, bg: '#0e1626', weather: 'stars', tint: 'rgba(14,12,48,0.30)', swatch: 'linear-gradient(135deg,#264c5c 55%,#162046 55%)',
  },
};
function buildPal(st) {
  const one = ['roadRim', 'roadIn', 'pebble', 'pebbleHi', 'shallow', 'foam', 'wet', 'mortar', 'plazaRim', 'furrow', 'fieldRim', 'rockHi', 'rockLo'];
  const many = ['grass', 'road', 'water', 'sand', 'plaza', 'ridge', 'rock'];
  const out = {};
  for (const k of one) out[k] = rgb(st[k]);
  for (const k of many) out[k] = st[k].map(rgb);
  return out;
}
let STYLE = ISLE_STYLE.green;
let PAL = buildPal(STYLE);
function useIsle(i) { STYLE = ISLE_STYLE[(ISLANDS[i] || ISLANDS[0]).id]; PAL = buildPal(STYLE); }

function paintGround(g) {
  const cell = new Uint8Array(GC * GR), road = new Uint8Array(GC * GR);
  const mark = (x0, y0, rad) => {
    for (let cy = Math.floor((y0 - rad) / CELL); cy <= Math.floor((y0 + rad) / CELL); cy++) for (let cx = Math.floor((x0 - rad) / CELL); cx <= Math.floor((x0 + rad) / CELL); cx++) {
      if (cx < 0 || cy < 0 || cx >= GC || cy >= GR) continue;
      if (Math.hypot(cx * CELL + 1 - x0, cy * CELL + 1 - y0) <= rad) road[cy * GC + cx] = 1;
    }
  };
  for (const [x, y] of ROAD_PTS) mark(x, y, 11);
  for (const b of BUILDINGS) if (b.tab !== 'dock' && b.tab !== 'fight') for (let y = roadY(b.dx); y >= (b.doorY || DOOR_Y) + 5; y -= 1) mark(b.dx, y, 6);
  // Classify every cell.
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = cx * CELL + 1, y = cy * CELL + 1, i = cy * GC + cx;
    const [w0, w1] = riverBanks(y), pe = ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2;
    const pl = ((x - SPAWN.x) / 46) ** 2 + ((y - SPAWN.y) / 22) ** 2;
    let t = T.GRASS;
    const sx = seaX(y);
    if (x >= sx) t = T.WATER;
    else if (x >= sx - 9) t = T.SAND;
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
      const inRiver = x >= w0 && x < w1, atSea = x >= seaX(y);
      const dist = atSea ? (x - seaX(y)) * 0.8 : inRiver ? Math.min(x - w0, w1 - x) : (1 - Math.sqrt(((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2)) * POND.ry * 1.6;
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
  useIsle(WORLD.isle || 0);
  paintGround(WORLD.ctx);
  paintWaterDetail();
  const r = prng(17), inRiver = x => x > SEA_X - 18;
  const grassy = (x, y, pad = 3) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([a, b]) => terrainAt(x + a, y + b) === T.GRASS);
  // Little tufts of darker and lighter grass all over.
  for (let i = 0; i < 900; i++) {
    const x = r() * WW, y = 44 + r() * 226;
    if (!grassy(x, y)) continue;
    const [dk, lt] = STYLE.tuft;
    if (r() < 0.6) { px(x, y, 1, 2, dk); px(x + 2, y - 1, 1, 3, dk); px(x + 1, y, 1, 2, lt); }
    else { px(x, y, 2, 1, lt); px(x + 3, y + 1, 1, 1, lt); }
  }
  // Tall grass patches and ledges on the route east.
  for (const [x0, y0, w, h] of [[600, 230, 64, 30], [660, 96, 60, 40]]) tallGrass(x0, y0, w, h);
  // Pond: lily pads and reeds.
  const glowPads = STYLE.waterKind === 'night';
  if (STYLE.lily) {
    for (const [lx, ly] of [[236, 246], [262, 254], [270, 244]]) { pell(lx, ly, 4, 2, glowPads ? '#1e5a66' : '#2f7a34'); px(lx + 1, ly - 2, 2, 2, glowPads ? '#1e5a66' : '#2f7a34'); px(lx - 2, ly - 1, 3, 1, glowPads ? '#7af0ff' : '#4ea548'); }
    px(268, 243, 2, 2, glowPads ? '#ff8af0' : '#f6a8c8'); px(268, 242, 1, 1, '#ffffff');
  }
  if (STYLE.reeds) for (const [rx, ry] of [[222, 244], [226, 241], [277, 255], [280, 251]]) { px(rx, ry - 8, 1, 9, '#3e7a2a'); px(rx + 2, ry - 6, 1, 7, '#4e9234'); px(rx, ry - 10, 1, 3, '#7a4a26'); }
  // Flowers in little clusters, rocks and bushes.
  const COLS = STYLE.flowers;
  for (let i = 0; i < 70; i++) {
    const cx = 40 + r() * 680, cy = 52 + r() * 214, c = COLS[Math.floor(r() * COLS.length)];
    if (inRiver(cx)) continue;
    for (let k = 0; k < 4; k++) { const x = cx + (r() - 0.5) * 12, y = cy + (r() - 0.5) * 7; if (grassy(x, y, 4)) flower(x, y, c); }
  }
  for (let i = 0; i < 22; i++) { const x = 40 + r() * 680, y = 214 + r() * 50; if (!inRiver(x) && grassy(x, y, 6)) rock(x, y, r() < 0.5); }
  for (const [bx, by] of [[184, 236], [296, 232], [418, 258], [566, 262], [700, 226], [726, 250], [890, 160], [1060, 262]]) bush(bx, by);
  // Bridge over the river and the pier to the boat.
  paintDock(PIER);
  // Farm (crops are drawn live so the farmer can walk between them), woodpile and the forge yard.
  paintFarm(); paintWoodYard();
  // The forest along the top edge (back to front), trees between buildings, then buildings.
  const forest = [];
  const gap = STYLE.gap || 9; // palms spread wide, so the desert's tree line is sparser
  for (let x = 0; x < SEA_X - 16; x += gap) { if (inRiver(x)) continue; forest.push([x + r() * 4, 22 + r() * 6, r() < 0.3]); forest.push([x + 4 + r() * 4, 38 + r() * 6, r() < 0.3]); }
  for (let y = 54; y < 186; y += gap + 4) { forest.push([6 + r() * 3, y, r() < 0.4]); forest.push([24 + r() * 3, y + 6, r() < 0.4]); }
  forest.sort((a, b) => a[1] - b[1]).forEach(([x, y, alt]) => forestTree(x, y, alt));
  for (const x of [176, 300, 432, 568, 714]) forestTree(x, 150, false);
  for (const [x, y] of [[728, 232], [734, 168]]) rock(x, y, true);
  forestTree(296, 128, false); forestTree(716, 130, true); forestTree(722, 252, true);
  if (STYLE.snow) for (const [sx, sy] of [[150, 128], [610, 262]]) snowman(sx, sy);
  paintTownDecor(); paintTownSign(); paintBoard(); paintTrophy();
  WORLD.ctx.save(); WORLD.ctx.translate(0, -HOUSE_BACK); paintHouse(); WORLD.ctx.restore();
  paintMarket(); paintForge(); paintTemple();
  // The fence: left of the path, then (after the gate and the mailbox) on to the right.
  fence(188, 182, 45, -99); fence(260, 182, 32, -99); paintMailbox();
  // The forest along the bottom edge, front-most.
  const south = [];
  for (let x = 0; x < SEA_X - 16; x += gap) { if (inRiver(x)) continue; south.push([x + r() * 4, 286 + r() * 3, r() < 0.3]); south.push([x + 4 + r() * 4, 300 + r() * 3, r() < 0.3]); }
  for (let y = 220; y < 286; y += gap + 4) { south.push([6 + r() * 3, y, r() < 0.4]); south.push([24 + r() * 3, y + 6, r() < 0.4]); }
  south.sort((a, b) => a[1] - b[1]).forEach(([x, y, alt]) => forestTree(x, y, alt));
  WORLD.ctx = prev;
  return cv;
}

// The small cave island: sea all round, a beach, ground in the island's style, a rocky hill with the
// cave in it, a path from the dock, and trees, rocks and flowers. Painted once per visit.
const CAVE_DX = CAVE_HILL.x - 1145; // paintCave draws the mouth at x 1145; shift it onto the hill
function caveHill(x, y) { return ((x - CAVE_HILL.x) / CAVE_HILL.rx) ** 2 + ((y - CAVE_HILL.y) / CAVE_HILL.ry) ** 2 + 0.06 * Math.sin(x / 7); }
// How far out from the island a point is (under 0.86 is land, under 1 beach). The hill always has
// land round it, so the beach never cuts into the cave's hill.
function caveShore(x, y) {
  const e = ((x - CAVE_SHORE.x) / CAVE_SHORE.rx) ** 2 + ((y - CAVE_SHORE.y) / CAVE_SHORE.ry) ** 2 + 0.05 * Math.sin(x / 11) + 0.05 * Math.cos(y / 8);
  return Math.min(e, caveHill(x, y) * 0.62);
}
function paintCaveIsle(i) {
  const cv = makeCanvas(WW, WH), prev = WORLD.ctx;
  WORLD.ctx = cv.getContext('2d');
  useIsle(i);
  const g = WORLD.ctx, cell = new Uint8Array(GC * GR), road = new Uint8Array(GC * GR);
  for (const [x0, y0] of CAVE_ROAD_PTS) for (let cy = Math.floor((y0 - 8) / CELL); cy <= Math.floor((y0 + 8) / CELL); cy++) for (let cx = Math.floor((x0 - 8) / CELL); cx <= Math.floor((x0 + 8) / CELL); cx++) {
    if (cx >= 0 && cy >= 0 && cx < GC && cy < GR && Math.hypot(cx * CELL + 1 - x0, cy * CELL + 1 - y0) <= 8) road[cy * GC + cx] = 1;
  }
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = cx * CELL + 1, y = cy * CELL + 1, e = caveShore(x, y);
    let t = T.WATER;
    if (e < 0.86) t = road[cy * GC + cx] ? T.ROAD : T.GRASS;
    else if (e < 1) t = T.SAND;
    cell[cy * GC + cx] = t;
  }
  TERRAIN = cell;
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= GC || cy >= GR ? T.WATER : cell[cy * GC + cx]);
  const img = g.createImageData(WW, WH), d = img.data;
  const pick = (pal, n, cx, cy) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(n * pal.length + BAYER[(cy & 3) * 4 + (cx & 3)] * 1.2)))];
  for (let cy = 0; cy < GR; cy++) for (let cx = 0; cx < GC; cx++) {
    const x = cx * CELL + 1, y = cy * CELL + 1, t = cell[cy * GC + cx], hsh = hash2(cx, cy);
    let c;
    if (t === T.WATER) {
      const e = caveShore(x, y);
      c = e < 1.06 ? PAL.foam : e < 1.3 ? PAL.shallow : pick(PAL.water, Math.min(0.99, 0.2 + 0.8 * vnoise(x / 34, y / 22)), cx, cy);
    } else if (t === T.SAND) {
      const wet = at(cx - 1, cy) === T.WATER || at(cx + 1, cy) === T.WATER || at(cx, cy - 1) === T.WATER || at(cx, cy + 1) === T.WATER;
      c = wet ? PAL.wet : pick(PAL.sand, vnoise(x / 6, y / 6), cx, cy);
    } else if (t === T.ROAD) {
      const rim = at(cx - 1, cy) !== T.ROAD || at(cx + 1, cy) !== T.ROAD || at(cx, cy - 1) !== T.ROAD || at(cx, cy + 1) !== T.ROAD;
      c = rim ? PAL.roadRim : hsh < 0.04 ? PAL.pebble : pick(PAL.road, vnoise(x / 9, y / 7), cx, cy);
    } else if (t === T.ROCK) {
      const h = caveHill(x, y), rel = Math.floor((182 - y + Math.round(Math.sin(x / 11) * 2)) / CELL) % 7;
      c = h > 0.86 ? PAL.rockLo : rel === 0 ? PAL.rockLo : rel === 6 ? PAL.rockHi : hsh < 0.05 ? PAL.rockLo : pick(PAL.rock, 0.15 + 0.7 * vnoise(x / 9, y / 5), cx, cy);
    } else {
      const n = 0.62 * vnoise(x / 40, y / 30) + 0.38 * vnoise(x / 12, y / 12);
      let k = Math.max(0, Math.min(4, Math.floor(n * 5 + BAYER[(cy & 3) * 4 + (cx & 3)] * 1.3)));
      if (at(cx, cy - 1) === T.ROAD || at(cx, cy + 1) === T.ROAD || at(cx - 1, cy) === T.ROAD || at(cx + 1, cy) === T.ROAD) k = Math.max(0, k - 2);
      c = PAL.grass[k];
    }
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const o = ((cy * CELL + dy) * WW + cx * CELL + dx) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const r = prng(31 + i * 7);
  const grassy = (x, y, pad = 3) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].every(([a, b]) => terrainAt(x + a, y + b) === T.GRASS);
  for (let k = 0; k < 320; k++) {
    const x = 40 + r() * 380, y = 60 + r() * 220;
    if (!grassy(x, y)) continue;
    const [dk, lt] = STYLE.tuft;
    if (r() < 0.6) { px(x, y, 1, 2, dk); px(x + 2, y - 1, 1, 3, dk); px(x + 1, y, 1, 2, lt); } else { px(x, y, 2, 1, lt); px(x + 3, y + 1, 1, 1, lt); }
  }
  for (let k = 0; k < 22; k++) {
    const cx = 80 + r() * 320, cy = 150 + r() * 110, c = STYLE.flowers[Math.floor(r() * STYLE.flowers.length)];
    for (let q = 0; q < 3; q++) { const x = cx + (r() - 0.5) * 10, y = cy + (r() - 0.5) * 6; if (grassy(x, y, 4)) flower(x, y, c); }
  }
  paintDock(CAVE_PIER);
  // Trees and rocks round the island, back to front.
  const trees = [[96, 150], [128, 128], [168, 118], [210, 122], [244, 116], [398, 160], [414, 196], [392, 232], [118, 254], [168, 266], [236, 270], [300, 262], [352, 254], [84, 222],
    [118, 96], [160, 82], [206, 74], [250, 80], [96, 120], [190, 100], [232, 98], [140, 106], [62, 176], [70, 250]];
  const behind = ([x, y]) => x > CAVE_MTN.x0 - 8 && x < CAVE_MTN.x1 + 8 && y < CAVE_MTN.base + 4;
  const ok = ([x, y]) => caveShore(x, y) < 0.8 && !behind([x, y]);
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y], k) => { if (ok([x, y]) && y < CAVE_MTN.base) forestTree(x + (r() - 0.5) * 6, y, k % 3 === 0); });
  paintCaveMountain(ISLANDS[i].id, r);
  trees.forEach(([x, y], k) => { if (ok([x, y]) && y >= CAVE_MTN.base) forestTree(x + (r() - 0.5) * 6, y, k % 3 === 0); });
  for (const [x, y] of [[262, 160], [372, 196], [150, 226], [270, 236]]) rock(x, y, r() < 0.5);
  if (STYLE.snow) snowman(206, 236);
  WORLD.ctx = prev;
  return cv;
}
// ---------- the cave mountains ----------
// Each cave island's cave is a mountain in the island's style with the mouth at its foot.
const CAVE_MTN = { x0: 236, x1: 412, base: 184, mx: 322, mw: 46, mh: 42 }; // mx, mw, mh: the mouth's centre, width, height
const MTN_LOOK = {
  green: { rock: ['#b4aa98', '#958b7b', '#766d61', '#585149', '#3d3833'], cap: ['#7ccc52', '#58a83c', '#3e7e2a'], vines: true, torches: true },
  frost: { rock: ['#a8bcd4', '#8298b4', '#667c98', '#4e607c', '#3a4860'], cap: ['#ffffff', '#e8f2fc', '#c4d8ee'], snow: true, icicles: true, torches: true },
  sand: { rock: ['#f2c88a', '#dca86a', '#c08850', '#9a6a3a', '#744c26'], mesa: true },
  ember: { rock: ['#6e5c58', '#544644', '#3e3433', '#2c2424', '#1c1616'], volcano: true },
  star: { rock: ['#7a6ab0', '#62549a', '#4a3e7c', '#352c5e', '#241e42'], crystals: true },
};
const MTN_PEAKS = [[322, 30, 1.45], [284, 70, 1.2], [366, 60, 1.35], [262, 112, 0.9], [392, 104, 1.0]];
// Which side of a ridge a point is on: the tallest peak above it splits light (left) from shade (right).
function mtnShade(look, x, y) {
  if (look.mesa || look.volcano) return x > CAVE_MTN.mx ? 1 : 0;
  let best = null;
  for (const [px_, py, k] of MTN_PEAKS) if (py + Math.abs(x - px_) * k <= y + 2 && (!best || py < best[1])) best = [px_, py];
  return best && x > best[0] ? 1 : 0;
}
// The mountain's skyline: the lowest of a few peaks' slopes, with a little rough edge.
function mtnTop(look, x) {
  const { x0, x1, base } = CAVE_MTN;
  if (x < x0 || x > x1) return base + 1;
  let y;
  if (look.mesa) y = 78 + (x < 262 ? Math.ceil((262 - x) / 9) * 18 : x > 384 ? Math.ceil((x - 384) / 9) * 18 : 0) + Math.round(hash2(x >> 3, 9) * 1.5);
  else if (look.volcano) { const d = Math.abs(x - 323); y = d < 15 ? 52 + Math.round(hash2(x, 3) * 2) : 52 + (d - 15) * 1.32 + Math.sin(x / 5) * 2; }
  else {
    const peaks = MTN_PEAKS;
    y = Math.min(...peaks.map(([px_, py, k]) => py + Math.abs(x - px_) * k));
    y += Math.round(Math.sin(x / 3.1) * 1.2 + hash2(x, 5) * 2.4);
  }
  // Foothills: the slopes always run down to the ground at both ends.
  const foot = Math.min(x - x0, x1 - x);
  if (!look.mesa) y = Math.max(y, base - foot * (look.volcano ? 1.6 : 2.6));
  return Math.min(base + 1, Math.round(y));
}
function inMouth(x, y) {
  const { mx, mw, mh, base } = CAVE_MTN, dx = (x - mx) / (mw / 2), top = base - mh;
  if (Math.abs(dx) >= 1 || y > base) return false;
  return y >= top + mh * 0.42 * (1 - Math.sqrt(1 - dx * dx)) * 1.9 + (1 - Math.sqrt(1 - dx * dx)) * mh * 0.35;
}
function paintCaveMountain(id, r) {
  const look = MTN_LOOK[id] || MTN_LOOK.green, R = look.rock, { x0, x1, base, mx, mw, mh } = CAVE_MTN;
  const ridge = look.volcano || look.mesa ? mx : 324;
  // Body: lit from the left; the right of the ridge sits in shade. Strata every 9 pixels, each with
  // a dark crack and a lit lip under it, like the cliffs in the old Pokemon games.
  for (let x = x0; x <= x1; x++) {
    const top = mtnTop(look, x);
    for (let y = top; y <= base; y++) {
      const shade = mtnShade(look, x, y), band = look.mesa ? 7 : 13;
      const rel = (base - y + (look.mesa ? 0 : Math.round(Math.sin(x / 7) * 3 + Math.sin(x / 17) * 4))) % band, broken = hash2(Math.floor(x / 5), Math.floor((base - y) / band)) < (look.mesa ? 0.1 : 0.35);
      // Clean two-tone faces, a touch darker toward the foot, with sparse speckles and strata.
      let c = R[1 + shade + (y > base - 30 && hash2(x >> 1, y >> 1) < 0.5 ? 1 : 0)];
      if (!broken && rel === 0) c = R[Math.min(4, 3 + shade)];
      else if (!broken && rel === band - 1) c = R[shade];
      else if (hash2(x, y) < 0.035) c = R[Math.min(4, 3 + shade)];
      else if (hash2(x + 7, y) < 0.025) c = R[shade];
      if (y < top + 2) c = R[shade];
      if (look.mesa && y < top + 6) c = y < top + 1 ? R[0] : shade ? R[1] : R[0];
      px(x, y, 1, 1, c);
    }
  }
  // A solid 1-pixel outline round the whole silhouette.
  const inside = (x, y) => x >= x0 && x <= x1 && y <= base && y >= mtnTop(look, x);
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let y = 0; y <= base; y++) if (!inside(x, y) && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y + 1))) px(x, y, 1, 1, OUT);
  // Caps on the peaks and ledges: snow or grass, dripping down a little.
  if (look.cap) {
    for (let x = x0 + 1; x < x1; x++) {
      const top = mtnTop(look, x), deep = look.snow ? (top < 90 ? 7 + Math.round(hash2(x, 1) * 5) : 2) : 2 + Math.round(hash2(x, 2) * 2);
      for (let y = top; y < top + deep; y++) px(x, y, 1, 1, look.cap[y - top < 2 ? 0 : 1]);
      if (hash2(x, 4) < 0.18) px(x, top + deep, 1, 2, look.cap[2]);
      for (let y = top + 12; y < base - 8; y++) if ((base - y + Math.round(Math.sin(x / 7) * 3 + Math.sin(x / 17) * 4)) % 13 === 12 && hash2(Math.floor(x / 4), y) < (look.snow ? 0.32 : 0.4)) { px(x, y - 1, 1, 1, look.cap[0]); px(x, y, 1, 1, look.cap[1]); }
    }
  }
  if (look.vines) for (let k = 0; k < 14; k++) { const x = x0 + 10 + Math.round(r() * (x1 - x0 - 20)), y = mtnTop(look, x) + 2, len = 6 + Math.round(r() * 14); for (let j = 0; j < len; j++) px(x + (j % 5 === 4 ? 1 : 0), y + j, 1, 1, j % 3 ? '#3e7e2a' : '#58a83c'); }
  // Mesa: carved bands and a temple door instead of a natural mouth.
  if (look.mesa) {
    for (let x = x0 + 2; x < x1 - 1; x++) { const top = mtnTop(look, x); px(x, top + 3, 1, 1, R[0]); if (x % 6 < 3) px(x, top + 6, 1, 1, R[3]); }
  }
  // Volcano: a glowing crater and lava running down the sides.
  if (look.volcano) {
    for (let x = mx - 14; x <= mx + 14; x++) { const top = mtnTop(look, x); px(x, top, 1, 2, x % 3 ? '#ff8a2a' : '#ffd060'); }
    for (const [sx, dir] of [[mx - 10, -1], [mx + 9, 1], [mx - 3, -1]]) {
      let x = sx, y = mtnTop(look, sx) + 2;
      while (y < base - mh - 6) { px(x, y, 2, 1, hash2(x, y) < 0.3 ? '#ffd060' : '#ff6a1a'); px(x + 2, y, 1, 1, '#a8320e'); y += 1; if (hash2(x, y) < 0.45) x += dir; }
    }
  }
  // The mouth: a dark arch with rocks round its rim, deeper and darker inside.
  const top = base - mh, inner = look.volcano ? ['#ff9a2a', '#d8501a', '#7a1e0c', '#3a0c06'] : look.crystals ? ['#3a2a5e', '#24183e', '#140c26', '#0a0614'] : ['#3a2c26', '#241a16', '#140e0c', '#080505'];
  if (look.mesa) {
    // Temple door: a stepped stone frame with pillars and a glyph lintel.
    const dw = 26, dh = 30, dx0 = mx - dw / 2, dy0 = base - dh;
    parts([[dx0 - 9, dy0 - 10, dw + 18, 8, R[0]], [dx0 - 8, dy0 - 2, 6, dh + 2, R[0]], [dx0 + dw + 2, dy0 - 2, 6, dh + 2, R[0]]]);
    for (const xx of [dx0 - 7, dx0 + dw + 3]) for (let y = dy0; y < base; y += 4) px(xx, y, 4, 1, R[2]);
    for (let k = 0; k < 7; k++) px(dx0 - 4 + k * 5, dy0 - 7, 3, 3, k % 2 ? '#3a7ab8' : R[3]);
    px(dx0, dy0, dw, dh, OUT);
    for (let y = 0; y < dh; y++) px(dx0 + 1, dy0 + 1 + y, dw - 2, 1, inner[Math.min(3, Math.floor(y / 4))]);
    px(dx0 + 1, dy0 + 1, dw - 2, 2, inner[0]);
  } else {
    for (let y = top - 6; y <= base; y++) for (let x = mx - mw / 2 - 6; x <= mx + mw / 2 + 6; x++) {
      if (inMouth(x, y)) {
        const edge = [[-1, 0], [1, 0], [0, -1]].some(([a, b]) => !inMouth(x + a, y + b));
        const depth = Math.min(3, Math.floor((y - top) / 7) + (Math.abs(x - mx) < mw * 0.2 ? 1 : 0));
        px(x, y, 1, 1, edge ? OUT : inner[depth]);
      } else if ([[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2]].some(([a, b]) => inMouth(x + a, y + b)) && y >= mtnTop(look, x)) {
        // the rim: big stones, lit on top
        const k = hash2(Math.floor(x / 4), Math.floor(y / 3));
        px(x, y, 1, 1, k < 0.15 ? OUT : inMouth(x, y + 3) ? R[0] : k < 0.5 ? R[1] : R[2]);
      }
    }
    // Teeth: stalactites (or icicles) hanging inside the arch, and rails running in.
    for (let k = -3; k <= 3; k++) {
      const x = mx + k * 5, y0 = top + Math.round(mh * 0.12 + Math.abs(k) * 2.4), len = look.icicles ? 5 + (k & 1) * 3 : 3 + (k & 1) * 2;
      if (!inMouth(x, y0 + 1)) continue;
      for (let j = 0; j < len; j++) px(x, y0 + j, j < len - 1 ? 2 : 1, 1, look.icicles ? (j < 2 ? '#ffffff' : '#a8e8ff') : R[3]);
    }
    if (!look.volcano) { for (let y = base - 10; y <= base; y += 3) px(mx - 7, y, 14, 1, '#4a2e1a'); px(mx - 5, base - 11, 1, 12, '#a0a0aa'); px(mx + 4, base - 11, 1, 12, '#a0a0aa'); }
    else for (let x = mx - mw / 2 + 3; x < mx + mw / 2 - 3; x++) if (inMouth(x, base - 1)) px(x, base - 2, 1, 2, x % 4 ? '#ffd060' : '#ff8a2a');
  }
  // Crystals: glowing clusters on the slopes and round the mouth.
  if (look.crystals) {
    const cols = [['#ffffff', '#bff8ff', '#6ae0ff', '#2a8ac0'], ['#ffffff', '#ffd0f8', '#ff9af0', '#b04ab0'], ['#ffffff', '#e0c8ff', '#c06aff', '#6a2ab0']];
    for (let k = 0; k < 11; k++) {
      const near = k < 5, x = near ? mx + [-30, -23, 23, 30, 0][k] : x0 + 24 + Math.round(r() * (x1 - x0 - 48)), c = cols[k % 3];
      const yb = near ? (k === 4 ? top - 8 : base - 2) : Math.max(mtnTop(look, x) + 18, Math.min(base - 16, mtnTop(look, x) + 22 + Math.round(r() * 40)));
      const h = near ? 18 + (k % 2) * 8 : 12 + Math.round(r() * 8);
      for (const [ox, sc] of [[0, 1], [-3, 0.6], [3, 0.7]]) {
        const hh = Math.round(h * sc);
        for (let j = 0; j < hh; j++) { const w = Math.max(1, Math.round((1 - j / hh) * 5)); px(x + ox - Math.floor(w / 2) - 1, yb - j, w + 2, 1, OUT); }
        for (let j = 0; j < hh - 1; j++) { const w = Math.max(1, Math.round((1 - j / hh) * 5)); px(x + ox - Math.floor(w / 2), yb - j, w, 1, j > hh - 4 ? c[0] : c[2]); px(x + ox - Math.floor(w / 2), yb - j, 1, 1, c[1]); if (w > 2) px(x + ox + Math.ceil(w / 2) - 1, yb - j, 1, 1, c[3]); }
      }
    }
  }
  // Rubble at the foot and a few boulders.
  for (let k = 0; k < 10; k++) { const x = x0 + 6 + Math.round(r() * (x1 - x0 - 12)); if (Math.abs(x - mx) < mw / 2 + 6) continue; pell(x, base + 1, 3 + r() * 3, 2, OUT); pell(x, base, 2 + r() * 3, 1.5, R[1]); px(x - 1, base - 1, 2, 1, R[0]); }
}

// What moves on the cave island: sparkles on the sea, the cave's lanterns, a boss's red eyes, the
// boat at the dock, you, the weather and the clouds.
function drawCaveLive(g, dt, t) {
  const wk = STYLE.waterKind;
  for (let k = 0; k < 30; k++) {
    const x = (k * 97.3) % CAVE_W + 4, y = (k * 53.1) % WH;
    if (caveShore(x, y) < 1.15 || Math.sin(t * 2.1 + k * 1.9) < 0.75) continue;
    g.fillStyle = wk === 'lava' ? '#ffd060' : wk === 'night' ? '#fff4a8' : '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
  if (wk === 'lava') glow(g, CAVE_SHORE.x, CAVE_SHORE.y, 230, `rgba(255,110,30,${0.08 + 0.03 * Math.sin(t * 2)})`);
  const look = MTN_LOOK[ISLANDS[WORLD.isle].id] || {}, M = CAVE_MTN;
  if (look.torches) for (const lx of [M.mx - M.mw / 2 - 9, M.mx + M.mw / 2 + 8]) {
    g.fillStyle = OUT; g.fillRect(lx - 1, M.base - 18, 3, 18); g.fillStyle = '#7a4c2a'; g.fillRect(lx, M.base - 17, 1, 17);
    const f = Math.sin(t * 11 + lx); g.fillStyle = '#f07a20'; g.fillRect(lx - 1, M.base - 23 - (f > 0 ? 1 : 0), 3, 5); g.fillStyle = '#ffd860'; g.fillRect(lx, M.base - 22, 1, 3);
    glow(g, lx, M.base - 21, 10, 'rgba(255,190,80,0.28)');
  }
  if (look.volcano) { glow(g, M.mx, 54, 26 + Math.sin(t * 2) * 3, 'rgba(255,120,40,0.35)'); glow(g, M.mx, M.base - 10, 22, `rgba(255,110,30,${0.25 + 0.08 * Math.sin(t * 3)})`); if (Math.random() < dt * 3) WORLD.smoke.push({ x: M.mx + (Math.random() - 0.5) * 16, y: 50, t: 0 }); }
  if (look.crystals) for (let k = 0; k < 5; k++) glow(g, M.mx + [-28, -22, 22, 28, 0][k], k === 4 ? M.base - M.mh - 14 : M.base - 8, 12 + Math.sin(t * 2 + k) * 2, 'rgba(160,220,255,0.18)');
  if (look.volcano) { for (const s of WORLD.smoke) { s.t += dt; s.y -= dt * 9; s.x += dt * (2 + s.t); g.fillStyle = `rgba(90,80,80,${Math.max(0, 0.6 - s.t * 0.12)})`; const rr = 3 + Math.round(s.t * 1.6); g.fillRect(Math.round(s.x - rr / 2), Math.round(s.y - rr / 2), rr, rr); } WORLD.smoke = WORLD.smoke.filter(s => s.t < 5); }
  if (typeof bossWaiting === 'function' && bossWaiting() && Math.floor(t * 2) % 2) { const cx = CAVE_MTN.mx, ey = CAVE_MTN.base - 16; g.fillStyle = '#ff3040'; g.fillRect(cx - 6, ey, 2, 1); g.fillRect(cx + 4, ey, 2, 1); glow(g, cx, ey + 2, 14, 'rgba(255,40,60,0.25)'); }
  drawBoat(g, CAVE_PIER.x0 - 2, CAVE_PIER.y1 + 2, t);
  drawMe(g, t);
  drawBubbles(g, dt);
  drawWeather(g, t);
  g.fillStyle = 'rgba(20,40,70,0.09)';
  for (const [off, cy, rx] of [[0, 90, 70], [300, 230, 56]]) { const cx = ((t * 5 + off) % (CAVE_W + 300)) - 150; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.36, 0, 0, Math.PI * 2); g.fill(); }
}

// ---------- scenery pieces ----------
function forestTree(x, y, alt) {
  const k = STYLE.tree;
  if (k === 'palm') return alt ? cactus(x, y) : palm(x, y);
  if (k === 'dead') return alt ? pineTree(x, y) : deadTree(x, y);
  if (k === 'crystal') return alt ? glowShroom(x, y) : crystalTree(x, y);
  return alt ? pineTree(x, y) : tree(x, y);
}
function tree(x, y) {
  const [o, d, m, l, t, t2] = STYLE.leaf, [tk, tkd] = STYLE.trunk;
  pell(x + 1, y, 9, 3, 'rgba(20,50,20,0.35)');
  px(x - 2, y - 8, 5, 8, OUT); px(x - 1, y - 8, 3, 8, tk); px(x + 1, y - 8, 1, 8, tkd); px(x - 3, y - 1, 7, 1, tkd);
  pell(x, y - 17, 11, 9, o); pell(x - 6, y - 13, 6, 5, o); pell(x + 6, y - 13, 6, 5, o);
  pell(x, y - 17, 10, 8, m); pell(x - 6, y - 13, 5, 4, m); pell(x + 6, y - 13, 5, 4, d);
  pell(x - 1, y - 19, 8, 5, l); pell(x - 4, y - 15, 4, 3, l);
  pell(x - 3, y - 21, 4, 2, t); px(x - 5, y - 22, 3, 1, t2); px(x + 3, y - 18, 2, 1, t);
  px(x + 5, y - 11, 2, 1, o); px(x - 2, y - 12, 2, 1, d);
  if (STYLE.snow) { pell(x - 1, y - 23, 7, 2, '#ffffff'); px(x - 9, y - 16, 4, 1, '#ffffff'); px(x + 5, y - 16, 4, 1, '#ffffff'); }
}
function pineTree(x, y) {
  const [o, d, m, l] = STYLE.pine;
  pell(x + 1, y, 7, 2, 'rgba(20,50,20,0.35)');
  px(x - 1, y - 5, 3, 5, STYLE.trunk[1]);
  for (let i = 0; i < 3; i++) {
    const top = y - 26 + i * 6, w = 4 + i * 3;
    for (let k = 0; k < 10; k++) {
      const hw = Math.round((k / 10) * w) + 1;
      px(x - hw - 1, top + k, hw * 2 + 3, 1, o);
      px(x - hw, top + k, hw * 2 + 1, 1, k % 3 === 2 ? d : m);
      px(x - hw, top + k, Math.max(1, Math.floor(hw / 2)), 1, l);
      if (STYLE.snow && k < 3) px(x - hw, top + k, hw * 2 + 1, 1, k === 2 ? '#dce7f4' : '#ffffff');
      if (STYLE.tree === 'dead' && k === 9 && hash2(x, top) < 0.5) px(x + hw - 1, top + k, 1, 1, '#ff7a2a');
    }
  }
  px(x, y - 27, 1, 2, o);
}
function palm(x, y) {
  pell(x + 4, y, 9, 2, 'rgba(60,40,10,0.3)');
  let tx = x, ty = y;
  for (let i = 0; i < 22; i++) {
    tx = x + Math.round(Math.sin(i / 7) * 3); ty = y - i;
    px(tx - 2, ty, 5, 1, OUT); px(tx - 1, ty, 3, 1, i % 3 ? '#a8743e' : '#7a4c2a');
  }
  for (const a of [-2.8, -2.2, -1.5, -0.9, -0.3, 0.3]) {
    for (let k = 0; k < 11; k++) {
      const lx = tx + Math.cos(a) * k, ly = ty - 1 + Math.sin(a) * k * 0.55 + k * k * 0.07;
      px(lx, ly + 1, 2, 1, '#1f4720'); px(lx, ly, 2, 1, k % 3 ? '#3f8a30' : '#55a046');
    }
  }
  pell(tx, ty - 1, 3, 2, '#2f6e26'); px(tx - 2, ty + 1, 2, 2, '#6e4428'); px(tx + 1, ty + 1, 2, 2, '#5a361c');
}
function cactus(x, y) {
  pell(x + 1, y, 6, 2, 'rgba(60,40,10,0.3)');
  parts([[x - 2, y - 18, 5, 18, '#4a9a48'], [x - 7, y - 12, 4, 3, '#4a9a48'], [x - 7, y - 16, 3, 5, '#4a9a48'], [x + 3, y - 9, 4, 3, '#4a9a48'], [x + 5, y - 14, 3, 6, '#4a9a48']]);
  for (let k = y - 17; k < y - 1; k += 3) { px(x - 1, k, 1, 1, '#3a7a38'); px(x + 1, k + 1, 1, 1, '#6cb85a'); }
  px(x - 1, y - 19, 3, 1, '#f25d5d');
}
function deadTree(x, y) {
  pell(x + 1, y, 8, 2, 'rgba(0,0,0,0.35)');
  px(x - 2, y - 16, 4, 16, OUT); px(x - 1, y - 16, 2, 16, '#3a3032');
  for (const [dx, dy, len, dir] of [[0, -14, 7, -1], [0, -11, 6, 1], [0, -19, 4, 1], [0, -7, 5, -1]]) {
    for (let k = 0; k < len; k++) px(x + dx + dir * k, y + dy - Math.floor(k / 2), 1, 1, k === len - 1 && hash2(x, dy) < 0.5 ? '#ff7a2a' : '#2a2224');
  }
  px(x - 1, y - 20, 2, 4, '#2a2224');
}
function crystalTree(x, y) {
  pell(x + 1, y, 8, 2, 'rgba(0,0,0,0.35)');
  px(x - 1, y - 8, 3, 8, '#241c3a'); px(x, y - 8, 1, 8, '#3a3058');
  const shard = (cx, cy, h, c) => { for (let k = 0; k < h; k++) { const w = Math.max(1, Math.round((1 - Math.abs(k - h / 2) / (h / 2)) * 3)); px(cx - w, cy - k, w * 2 + 1, 1, OUT); px(cx - w + 1, cy - k, Math.max(1, w * 2 - 1), 1, c); } px(cx - 1, cy - Math.floor(h * 0.7), 1, 2, '#ffffff'); };
  shard(x - 5, y - 9, 10, '#b8a6ff'); shard(x + 5, y - 10, 11, '#7af0ff'); shard(x, y - 12, 15, '#d8a6ff'); shard(x + 2, y - 8, 7, '#ff8af0');
}
function glowShroom(x, y) {
  pell(x + 1, y, 6, 2, 'rgba(0,0,0,0.35)');
  px(x - 2, y - 10, 4, 10, OUT); px(x - 1, y - 10, 2, 10, '#d8d0f0');
  pell(x, y - 12, 9, 5, OUT); pell(x, y - 12, 8, 4, '#8a5ad8'); pell(x - 2, y - 13, 4, 2, '#b08af0');
  for (const [dx, dy] of [[-4, -12], [2, -14], [5, -11], [-1, -10]]) px(x + dx, y + dy, 1, 1, '#7af0ff');
}
function snowman(x, y) {
  pell(x + 1, y, 7, 2, 'rgba(60,80,110,0.3)');
  pell(x, y - 4, 6, 5, OUT); pell(x, y - 4, 5, 4, '#ffffff'); pell(x, y - 12, 4, 4, OUT); pell(x, y - 12, 3, 3, '#ffffff');
  px(x - 1, y - 13, 1, 1, OUT); px(x + 1, y - 13, 1, 1, OUT); px(x + 1, y - 12, 3, 1, '#f08a28'); px(x - 3, y - 9, 7, 1, '#d84848');
  px(x - 3, y - 18, 7, 2, OUT); px(x - 2, y - 21, 5, 3, OUT); px(x - 1, y - 4, 1, 1, OUT); px(x - 1, y - 2, 1, 1, OUT);
}
function bush(x, y) {
  const [d, m, l, t, berry] = STYLE.bush;
  pell(x + 1, y + 1, 8, 2, 'rgba(20,50,20,0.3)');
  pell(x, y - 4, 8, 5, d); pell(x, y - 4, 7, 4, m); pell(x - 2, y - 6, 4, 2, l); px(x - 4, y - 7, 2, 1, t);
  px(x + 3, y - 5, 1, 1, berry); px(x - 1, y - 3, 1, 1, berry);
}
function rock(x, y, big) {
  const w = big ? 7 : 4;
  pell(x + 1, y + 1, w, 1, 'rgba(20,50,20,0.3)');
  pell(x, y - 1, w, big ? 3 : 2, STYLE.rockLo); pell(x, y - 2, w - 1, big ? 2 : 1, STYLE.rock[1]); px(x - w + 2, y - (big ? 4 : 3), 2, 1, STYLE.rockHi);
}
function flower(x, y, c) { px(x, y + 1, 1, 2, STYLE.stem); px(x - 1, y, 3, 1, c); px(x, y - 1, 1, 3, c); px(x, y, 1, 1, c === '#f8e04a' ? '#c86a1a' : '#f8e04a'); }
function tallGrass(x0, y0, w, h) {
  const [base, mid, hi, tip, tip2] = STYLE.tall;
  for (let y = y0; y < y0 + h; y += 6) for (let x = x0 + ((y - y0) % 12 ? 3 : 0); x < x0 + w - 2; x += 6) {
    px(x, y + 1, 7, 6, base);
    px(x, y + 2, 1, 4, mid); px(x + 2, y, 1, 6, hi); px(x + 4, y + 1, 1, 5, mid); px(x + 6, y + 2, 1, 4, hi);
    px(x + 2, y, 1, 1, tip); px(x + 4, y + 1, 1, 1, tip2); px(x, y + 2, 1, 1, tip2);
  }
}
function ledge(x0, y0, w) { const [top, mid, dark, notch] = STYLE.ledge; px(x0, y0 - 1, w, 1, top); px(x0, y0, w, 3, mid); px(x0, y0 + 3, w, 2, dark); for (let x = x0 + 3; x < x0 + w; x += 7) px(x, y0 + 1, 2, 1, notch); }
// Ice cracks, lava crust and reflected stars, painted on top of the water once.
function paintWaterDetail() {
  const r = prng(41), k = STYLE.waterKind;
  if (k === 'water' || k === 'oasis') return;
  for (let i = 0; i < (k === 'night' ? 160 : 60); i++) {
    const x = RIVER[0] + r() * (RIVER[1] - RIVER[0]), y = r() * WH;
    if (terrainAt(x, y) !== T.WATER) continue;
    if (k === 'night') { px(x, y, 1, 1, r() < 0.3 ? '#ffffff' : '#7a9ae8'); continue; }
    if (k === 'ice') { let cx = x, cy = y; for (let s = 0; s < 8 + r() * 8; s++) { cx += r() < 0.5 ? 1 : -1; cy += r() < 0.6 ? 1 : 0; px(cx, cy, 1, 1, '#7ab0d8'); px(cx + 1, cy, 1, 1, '#ffffff'); } }
    if (k === 'lava') { pell(x, y, 3 + r() * 4, 1 + r() * 2, '#5a2a1a'); px(x - 1, y, 2, 1, '#2a1410'); }
  }
}
function fence(x0, y, w, gapX) {
  for (let x = x0; x < x0 + w; x += 1) if (Math.abs(x - gapX) > 8) { px(x, y - 6, 1, 2, OUT); px(x, y - 2, 1, 2, OUT); } // rails stop at the gate
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
  if (STYLE.snow) { px(x + 3, y, w - 6, 3, '#ffffff'); px(x + 2, y + 3, w - 4, 1, '#dce7f4'); for (let i = x + 5; i < x + w - 5; i += 9) px(i, y + 4, 2, 2, '#ffffff'); }
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
}
// Draw something shifted by (dx, dy).
function g0(dx, dy, fn) { const g = WORLD.ctx; g.save(); g.translate(dx, dy); fn(); g.restore(); }
// The mailbox stands at the gate, where the house's path meets the road.
function paintMailbox() {
  // Its top-left is at (246, 164), placed with the layout tool so it stands in the fence line.
  g0(246 - 249, 164 - 174, () => { px(253, 183, 3, 11, OUT); px(254, 184, 1, 10, '#7a4c2a'); parts([[250, 177, 9, 6, '#d84848']]); px(251, 178, 7, 1, '#f07a6a'); px(258, 175, 1, 3, '#f8e04a'); });
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
// A plank dock out over the water, posts underneath.
function paintDock(d) {
  const { x0, x1, y0, y1 } = d;
  px(x0, y1 + 1, x1 - x0, 3, 'rgba(10,30,60,0.35)');
  px(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, OUT);
  for (let x = x0, k = 0; x < x1; x += 4, k++) { px(x, y0, 3, y1 - y0, k % 2 ? '#b07a46' : '#c08a52'); px(x, y0, 3, 1, '#d8a46a'); }
  for (let x = x0 + 6; x < x1; x += 22) for (const y of [y0 - 3, y1]) { px(x, y, 4, 6, OUT); px(x + 1, y + 1, 2, 4, '#7a4c2a'); }
  px(x0 - 1, y0 + 2, x1 - x0 + 2, 1, '#8a5a32'); px(x0 - 1, y1 - 3, x1 - x0 + 2, 1, '#8a5a32');
}
function drawBoat(g, x, y, t) {
  const bob = Math.round(Math.sin(t * 2));
  g.fillStyle = 'rgba(10,30,60,0.3)'; g.fillRect(x, y + 11, 24, 2);
  g.fillStyle = OUT; g.fillRect(x - 1, y + bob, 26, 10); g.fillStyle = '#a8743e'; g.fillRect(x, y + 1 + bob, 24, 8); g.fillStyle = '#7a4c2a'; g.fillRect(x + 2, y + 3 + bob, 20, 5); g.fillStyle = '#d8a46a'; g.fillRect(x, y + 1 + bob, 24, 1);
  g.fillStyle = OUT; g.fillRect(x + 11, y - 16 + bob, 2, 17);
  g.fillStyle = OUT; g.fillRect(x + 13, y - 15 + bob, 9, 12); g.fillStyle = '#f6efe0'; g.fillRect(x + 13, y - 14 + bob, 8, 10); g.fillStyle = '#d84848'; g.fillRect(x + 13, y - 14 + bob, 8, 2);
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

// ---------- tapping the world: animals and villagers answer back ----------
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
  if (WORLD.scene === 'cave') { drawCaveLive(g, dt, t); return; }
  // River and pond: flowing water, still ice that glints, slow glowing lava, or stars on night water.
  const wk = STYLE.waterKind;
  if (false) { // the river is gone (the town ends at the sea); its current no longer flows
    const lava = wk === 'lava';
    for (let i = 0; i < 26; i++) {
      const y = (i * 53 + t * (lava ? 3 + (i % 3) : 10 + (i % 3) * 3)) % WH, [w0, w1] = riverBanks(y), x = w0 + 10 + ((i * 37) % (w1 - w0 - 20));
      g.fillStyle = lava ? `rgba(255,${200 + (i % 3) * 20},90,0.75)` : wk === 'oasis' ? 'rgba(200,250,248,0.6)' : 'rgba(200,232,255,0.55)';
      g.fillRect(Math.round(x), Math.round(y), lava ? 2 : 1, lava ? 2 : 4);
    }
  }
  if (wk === 'lava') {
    for (let i = 0; i < 8; i++) { const ph = (t * 0.7 + i * 0.37) % 1, bx = RIVER[0] + 14 + ((i * 47) % 96), by = (i * 61) % WH; if (ph < 0.3) { g.fillStyle = '#ffd060'; g.fillRect(bx, by - Math.round(ph * 6), 2, 2); } }
    glow(g, (RIVER[0] + RIVER[1]) / 2, 200, 70, `rgba(255,110,30,${0.14 + 0.04 * Math.sin(t * 2)})`);
  } else if (wk === 'ice') {
    for (let i = 0; i < 10; i++) if (Math.sin(t * 1.3 + i * 2.1) > 0.92) { g.fillStyle = '#ffffff'; const x = RIVER[0] + 12 + ((i * 29) % 96), y = (i * 41) % WH; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y + 1, 3, 1); g.fillRect(x, y + 2, 1, 1); }
  } else {
    for (let i = 0; i < 14; i++) if (Math.sin(t * 2.3 + i * 1.7) > 0.8) { g.fillStyle = wk === 'night' ? '#fff4a8' : '#ffffff'; g.fillRect(RIVER[0] + 12 + ((i * 29) % 96), (i * 41) % WH, 2, 1); }
    const rp = (t % 3) / 3; g.strokeStyle = `rgba(220,240,255,${0.6 * (1 - rp)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(244, 252, 2 + rp * 9, 1 + rp * 3, 0, 0, Math.PI * 2); g.stroke();
  }
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
  if (Math.sin(t * 1.3) > 0.93) { g.fillStyle = '#ffffff'; g.fillRect(134, 133, 1, 5); g.fillRect(132, 135, 5, 1); } // glint on the cup
  // Chimney smoke.
  for (const [sx, sy] of [[524, 60], [261, 84 - HOUSE_BACK]]) if (Math.random() < dt * 1.6) WORLD.smoke.push({ x: sx, y: sy, t: 0 });
  for (const s of WORLD.smoke) { s.t += dt; s.y -= dt * 7; s.x += dt * (3 + s.t); g.fillStyle = `rgba(236,236,244,${Math.max(0, 0.75 - s.t * 0.19)})`; const r = 2 + Math.round(s.t * 1.2); g.fillRect(Math.round(s.x - r / 2), Math.round(s.y - r / 2), r, r); }
  WORLD.smoke = WORLD.smoke.filter(s => s.t < 4);
  // The boat waiting at the end of the dock, the windmill's sails, and the street lamps.
  drawBoat(g, PIER.x1 - 4, PIER.y1 + 2, t);
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
    const [cx, cy] = [[200, 226], [300, 244], [700, 240], [640, 150]][i], x = cx + Math.sin(t * 0.7 + i) * 22, y = cy + Math.sin(t * 1.4 + i * 2) * 9 - 6;
    const open = Math.floor(t * 9 + i) % 2, c = ['#ffffff', '#f8e04a', '#ff9ad0', '#6fb2ff'][i];
    g.fillStyle = c; if (open) { g.fillRect(Math.round(x) - 2, Math.round(y), 2, 2); g.fillRect(Math.round(x) + 1, Math.round(y), 2, 2); } else g.fillRect(Math.round(x), Math.round(y) - 1, 1, 2);
    g.fillStyle = OUT; g.fillRect(Math.round(x), Math.round(y), 1, 2);
  }
  // The spawn pad glow, a boss waiting in the cave, and you.
  g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3); g.fillStyle = '#c8f8ff'; g.fillRect(SPAWN.x - 6, SPAWN.y + 1, 12, 4); g.globalAlpha = 1;
  drawDecor(g, t);
  drawMe(g, t);
  drawBubbles(g, dt);
  drawWeather(g, t);
  // Birds crossing high up (not at night or over the lava), and slow cloud shadows over everything.
  const bx = ((t * 26) % (WW + 300)) - 150;
  if (!STYLE.tint) for (const [ox, oy] of [[0, 0], [-7, -4], [-7, 4]]) { const fx = Math.floor(t * 6 + ox) % 2; g.fillStyle = '#2a2a3a'; g.fillRect(Math.round(bx + ox), Math.round(58 + oy + Math.sin(t) * 3), 1, 1); g.fillRect(Math.round(bx + ox - 2), Math.round(58 + oy - fx + Math.sin(t) * 3), 2, 1); g.fillRect(Math.round(bx + ox + 1), Math.round(58 + oy - fx + Math.sin(t) * 3), 2, 1); }
  g.fillStyle = 'rgba(20,40,70,0.09)';
  for (const [off, cy, rx] of [[0, 90, 70], [520, 230, 56], [900, 150, 80]]) { const cx = ((t * 5 + off) % (WW + 300)) - 150; g.beginPath(); g.ellipse(cx, cy, rx, rx * 0.36, 0, 0, Math.PI * 2); g.fill(); }
}
// Weather for each island: falling snow, drifting sand, rising embers, or fireflies and shooting stars.
function drawWeather(g, t) {
  const w = STYLE.weather;
  if (!w) return;
  const x0 = WORLD.cam.x - 20, span = (WORLD.vw / WORLD.z) + 40;
  if (w === 'snow') {
    for (let i = 0; i < 90; i++) {
      const sp = 9 + (i % 5) * 3, y = (i * 37 + t * sp) % (WH + 10) - 5, x = x0 + ((i * 53.7) % span) + Math.sin(t * 0.8 + i) * 4;
      g.fillStyle = i % 4 ? 'rgba(255,255,255,0.85)' : '#ffffff'; g.fillRect(Math.round(x), Math.round(y), i % 7 ? 1 : 2, i % 7 ? 1 : 2);
    }
  } else if (w === 'dust') {
    for (let i = 0; i < 40; i++) {
      const x = x0 + ((i * 61.3 + t * (30 + (i % 4) * 10)) % span), y = (i * 47) % WH + Math.sin(t + i) * 3;
      g.fillStyle = `rgba(250,232,190,${0.25 + (i % 3) * 0.12})`; g.fillRect(Math.round(x), Math.round(y), 3 + (i % 3), 1);
    }
  } else if (w === 'embers') {
    for (let i = 0; i < 50; i++) {
      const y = WH - ((i * 41 + t * (8 + (i % 4) * 3)) % (WH + 10)), x = x0 + ((i * 59.1) % span) + Math.sin(t * 1.5 + i) * 3;
      g.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ffb040' : '#ff6a2a'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  } else if (w === 'stars') {
    for (let i = 0; i < 36; i++) {
      const x = x0 + ((i * 71.3) % span) + Math.sin(t * 0.6 + i) * 8, y = (i * 53) % WH + Math.cos(t * 0.5 + i * 2) * 6, on = Math.sin(t * 2 + i * 1.3);
      if (on > -0.2) { g.globalAlpha = 0.4 + 0.6 * Math.max(0, on); g.fillStyle = i % 3 ? '#d8ff8a' : '#7af0ff'; g.fillRect(Math.round(x), Math.round(y), 1, 1); glow(g, x, y, 3, 'rgba(200,255,140,0.25)'); g.globalAlpha = 1; }
    }
    const sp = (t % 9) / 9;
    if (sp < 0.12) { const sx = x0 + span * (0.2 + sp * 5), sy = 20 + sp * 300; g.fillStyle = '#ffffff'; g.fillRect(Math.round(sx), Math.round(sy), 2, 1); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(Math.round(sx - 6), Math.round(sy - 3), 6, 1); }
  }
}
function glow(g, x, y, r, c) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

function drawWorld(dt) {
  const g = WORLD.ctx, dpr = WORLD.dpr, z = WORLD.z;
  WORLD.t += dt;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = STYLE.bg; g.fillRect(0, 0, WORLD.cv.width, WORLD.cv.height);
  g.setTransform(dpr * z, 0, 0, dpr * z, -WORLD.cam.x * dpr * z, -WORLD.cam.y * dpr * z);
  g.imageSmoothingEnabled = false;
  g.drawImage(WORLD.img, 0, 0);
  if (STYLE.tint) { g.fillStyle = STYLE.tint; g.fillRect(0, 0, WW, WH); } // night or the ember glow; what moves is drawn over it, lit
  drawLive(g, dt, WORLD.t);
  // A soft shade at the top and bottom of the screen pulls the eye to the road.
  g.setTransform(1, 0, 0, 1, 0, 0);
  const H = WORLD.cv.height, vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(10,20,30,0.28)'); vg.addColorStop(0.18, 'rgba(10,20,30,0)'); vg.addColorStop(0.85, 'rgba(10,20,30,0)'); vg.addColorStop(1, 'rgba(10,20,30,0.3)');
  g.fillStyle = vg; g.fillRect(0, 0, WORLD.cv.width, H);
}

// Version 2: in front of your house, an armor stand showing an outfit and a doghouse with a pet.
// Tap either to pick what goes there (the first step toward decorating your island).
const DECOR = {
  stand: { name: 'Armor stand', x: 205, y: 135, w: 24, h: 24 }, // in the front yard, close to the house, left of the door
  dog: { name: 'Doghouse', x: 248, y: 139, w: 27, h: 20 }, // and right of it (placed with the yard layout tool)
};
// The items on the stand (each may be gone if you salvaged it).
function standItems() {
  const out = {};
  for (const k of SLOT_IDS) { const id = S.decor.stand[k]; const f = id != null ? findItem(id) : null; out[k] = f ? f.it : null; }
  return out;
}
// The pet at the doghouse goes about its day: inside (eyes in the doorway), out for a little walk,
// a sit, a lie-down nap, then back in. Flying pets perch on the roof instead of lying down.
function dogStep(dt) {
  const d = WORLD.dog || (WORLD.dog = { state: 'in', t: 2, x: 0, tx: 0, dir: 1 }), dg = DECOR.dog, door = dg.x + 13;
  d.t -= dt;
  const walkTo = (tx, next) => { d.state = 'walk'; d.tx = tx; d.next = next; };
  if (d.state === 'walk') {
    const dx = d.tx - d.x, step = 16 * dt;
    if (Math.abs(dx) <= step) { d.x = d.tx; d.state = d.next; d.t = d.state === 'lie' ? 5 + Math.random() * 4 : d.state === 'in' ? 4 + Math.random() * 5 : 1.5 + Math.random() * 2; }
    else { d.x += Math.sign(dx) * step; d.dir = Math.sign(dx); }
    return;
  }
  if (d.t > 0) return;
  const spot = () => door + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 18);
  if (d.state === 'in') { d.x = door; walkTo(spot(), 'sit'); }
  else if (d.state === 'sit') { const r = Math.random(); if (r < 0.4) walkTo(spot(), 'sit'); else if (r < 0.75) d.state = 'lie', d.t = 5 + Math.random() * 4; else walkTo(door, 'in'); }
  else if (d.state === 'lie') { d.state = 'sit'; d.t = 1 + Math.random(); }
}
function drawDecor(g, t) {
  const st = DECOR.stand, dg = DECOR.dog, it = standItems();
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(st.x + 4, st.y + 23, 14, 2); g.fillRect(dg.x + 1, dg.y + 19, 27, 2);
  g.drawImage(standSprite(it.helm, it.charm), st.x, st.y);
  if (it.pick) { const pk = gearSprite('pick', it.pick.t, it.pick.r, it.pick.st), pad = pk.fxPad || 0; g.drawImage(pk, st.x + 16 - pad, st.y + 8 - pad); }
  g.drawImage(doghouseSprite(), dg.x, dg.y);
  const pet = S.decor.pet;
  if (!pet) return;
  dogStep(Math.min(0.1, WORLD.dogLast ? t - WORLD.dogLast : 0)); WORLD.dogLast = t;
  const d = WORLD.dog, def = PETS[pet.sp], spr = petSprite(pet.sp, pet.r), pad = spr.fxPad || 0;
  if (d.state === 'in' || (d.state === 'walk' && d.next === 'in' && Math.abs(d.x - (dg.x + 13)) < 2)) {
    if (Math.sin(t * 1.7) > -0.85) { g.fillStyle = '#ffffff'; g.fillRect(dg.x + 11, dg.y + 14, 1, 1); g.fillRect(dg.x + 15, dg.y + 14, 1, 1); }
    return;
  }
  const base = dg.y + 22, walking = d.state === 'walk', hop = walking && Math.floor(t * 8) % 2 ? 1 : 0;
  g.save(); g.translate(Math.round(d.x), 0); if (d.dir < 0) g.scale(-1, 1);
  if (def.fly) {
    const perch = d.state === 'lie', y = perch ? dg.y - 12 : base - 26 + Math.round(Math.sin(t * 5) * 2);
    g.drawImage(spr, -8 - pad, y - pad);
  } else if (d.state === 'lie') {
    // Lying down: the pet flattened low to the ground, breathing slowly.
    const h = 11 + (Math.sin(t * 2) > 0 ? 1 : 0);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-7, base - 1, 15, 2);
    g.drawImage(spr, 0, 0, spr.width, spr.height, -9 - pad, base - h - pad, spr.width + 2, h + pad * 2);
  } else {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-5, base - 1, 10, 2);
    g.drawImage(spr, -8 - pad, base - 16 - hop - pad);
  }
  g.restore();
  if (d.state === 'lie' && !def.fly) { const zz = (t * 0.6) % 1; g.globalAlpha = 1 - zz; g.fillStyle = '#ffffff'; g.font = '6px "Jersey 10", monospace'; g.fillText('z', d.x + 6 + zz * 3, base - 14 - zz * 8); g.globalAlpha = 1; }
}
function standRow(slot, it) {
  const label = slot === 'pick' ? 'Tool' : SLOTS[slot].name;
  return `<div class="standrow">${it ? `<img src="${gearUrl(it.slot, it.t, it.r, false, it.st)}" alt="">` : '<span class="standempty"></span>'}
    <span class="grow"><small class="muted">${label}</small><b class="${it ? 'tc' + it.r : 'muted'}">${it ? `${RARITY[it.r].name} ${itemName(it)}` : 'Empty'}</b>${it ? `<small>${WEAR[wearIndex(it.fl)].short} · float ${it.fl.toFixed(6)} · ${oddsLong(dropOdds(it.r, it.fl))}</small>` : ''}</span>
    <button class="btn small" data-act="standSlot" data-slot="${slot}">${it ? 'Change' : 'Pick'}</button></div>`;
}
function openStand() {
  const it = standItems();
  let h = `<h2>Armor stand</h2><div class="standprev"><img src="${spriteUrl(standSprite(it.helm, it.charm), 5)}" alt="">${it.pick ? `<img class="standtool" src="${gearUrl('pick', it.pick.t, it.pick.r, false, it.pick.st)}" alt="">` : ''}</div>
    <p class="small muted" style="text-align:center">Show off anything you own: your rarest pulls, your best floats, a whole outfit. The items stay yours to use.</p>`;
  h += SLOT_IDS.filter(k => k !== 'pick').concat('pick').map(k => standRow(k, it[k])).join('');
  h += '<div class="mbtns"><button class="btn" data-act="close">Done</button></div>';
  openModal(h, { dismissable: true });
}
// Pick an item for one slot of the stand: rarest first, or the lowest float first.
function openStandPicker(slot, sort) {
  const all = SLOT_IDS.map(k => S.gear.eq[k]).filter(Boolean).concat(S.gear.bag).filter(x => x.slot === slot);
  all.sort(sort === 'float' ? (a, b) => a.fl - b.fl : (a, b) => dropOdds(b.r, b.fl) - dropOdds(a.r, a.fl));
  const label = slot === 'pick' ? 'tool' : SLOTS[slot].name.toLowerCase(), cur = S.decor.stand[slot];
  let h = `<h2>${slot === 'charm' ? 'Pick armor' : 'Pick a ' + label}</h2><div class="seg" role="group" aria-label="Sort">
    <button class="${sort !== 'float' ? 'on' : ''}" data-act="standSlot" data-slot="${slot}" data-sort="rare">Rarest</button>
    <button class="${sort === 'float' ? 'on' : ''}" data-act="standSlot" data-slot="${slot}" data-sort="float">Best float</button></div><div class="islelist standlist">`;
  if (!all.length) h += `<p class="small muted" style="text-align:center">You have no ${label}s yet.</p>`;
  for (const x of all.slice(0, 120)) {
    h += `<button class="isleopt ${cur === x.id ? 'on' : ''}" data-act="standPick" data-slot="${slot}" data-id="${x.id}">
      <img src="${gearUrl(x.slot, x.t, x.r, false, x.st)}" alt="" style="width:36px;image-rendering:pixelated">
      <span class="grow"><b class="tc${x.r}">${RARITY[x.r].name} ${itemName(x)}${x.lv ? ' +' + x.lv : ''}</b><small>${WEAR[wearIndex(x.fl)].short} · float ${x.fl.toFixed(6)} · ${oddsLong(dropOdds(x.r, x.fl))}</small></span>${cur === x.id ? '<span class="isletag">On show</span>' : ''}</button>`;
  }
  h += `</div><div class="mbtns"><button class="btn" data-act="standPick" data-slot="${slot}" data-id="">Leave empty</button><button class="btn" data-act="standBack">Back</button></div>`;
  openModal(h, { dismissable: true });
}
function openDoghouse() {
  let h = `<h2>Doghouse</h2><p class="small muted" style="text-align:center">Pick a pet to sit outside your house. It's just for show: your party in the Cave stays the same.</p><div class="islelist">`;
  let any = false;
  for (const sp of PET_IDS) for (let r = RARITY.length - 1; r >= 0; r--) {
    if (!(S.pets.inv[sp][r] > 0 || S.pets.eq.some(p => p.sp === sp && p.r === r))) continue;
    any = true;
    const on = S.decor.pet && S.decor.pet.sp === sp && S.decor.pet.r === r;
    h += `<button class="isleopt ${on ? 'on' : ''}" data-act="setDogPet" data-sp="${sp}" data-r="${r}">
      <img src="${petUrl(sp, false, r)}" alt="" style="width:40px;image-rendering:pixelated">
      <span class="grow"><b class="tc${r}">${RARITY[r].name} ${PETS[sp].name}</b></span>${on ? '<span class="isletag">Home</span>' : ''}</button>`;
  }
  if (!any) h += '<p class="small muted" style="text-align:center">You have no pets yet. Open pet cases in the Market.</p>';
  h += `</div><div class="mbtns"><button class="btn" data-act="setDogPet" data-sp="">Nobody home</button><button class="btn" data-act="close">Close</button></div>`;
  openModal(h, { dismissable: true });
}

// You and your first pet on the road. Walking swaps the leg frames; facing left mirrors the sprite.
function drawMe(g, t) {
  const me = WORLD.me, x = Math.round(me.x), y = roadY(me.x);
  const step = me.held ? Math.floor(me.walkT * 8) % 2 : 0, bob = me.held ? 0 : Math.floor(t * 2) % 2;
  const pet = S.pets.eq[0];
  if (pet) {
    const def = PETS[pet.sp], spr = petSprite(pet.sp, pet.r), pad = spr.fxPad || 0, px = x - me.dir * 20;
    const py = def.fly ? y - 30 + Math.round(Math.sin(t * 5) * 2) : y - 12 - (me.held && Math.floor(me.walkT * 8) % 2 ? 1 : 0);
    if (!def.fly) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px - 5, y + 2, 10, 2); }
    g.save(); g.translate(px, 0); if (me.dir < 0) g.scale(-1, 1); g.drawImage(spr, -8 - pad, py - pad); g.restore();
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 7, y + 2, 14, 2);
  g.save(); g.translate(x, 0); if (me.dir < 0) g.scale(-1, 1);
  g.drawImage(heroSprite(step), -10, y - 21 + bob, 24, 24);
  g.restore();
}
// Hold an arrow to walk; the camera keeps you inside the middle of the screen.
function walkStep(dt) {
  const me = WORLD.me;
  if (!me.held) return;
  me.dir = me.held; me.walkT += dt;
  const xMax = WORLD.scene === 'cave' ? CAVE_W - 30 : PIER.x1 - 16, xMin = WORLD.scene === 'cave' ? CAVE_PIER.x0 + 14 : 24;
  me.x = Math.max(xMin, Math.min(xMax, me.x + me.held * WALK_SPEED * dt));
  const span = WORLD.vw / WORLD.z, lo = WORLD.cam.x + span * 0.35, hi = WORLD.cam.x + span * 0.65;
  if (me.x < lo) WORLD.cam.x -= lo - me.x; else if (me.x > hi) WORLD.cam.x += me.x - hi;
  WORLD.vx = 0; clampCam(); placeLayer();
}
function bindWalk(btn, dir) {
  const stop = () => { if (WORLD.me.held === dir) WORLD.me.held = 0; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); audioUnlock();
    try { btn.setPointerCapture(e.pointerId); } catch (_) { /* fine without capture */ }
    WORLD.me.held = dir; btn.classList.add('on');
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', e => e.stopPropagation());
  btn.addEventListener('contextmenu', e => e.preventDefault());
}
document.addEventListener('keydown', e => {
  if (UI.tab !== 'island' || UI.modalOpen || e.repeat) return;
  if (e.key === 'ArrowLeft') WORLD.me.held = -1; else if (e.key === 'ArrowRight') WORLD.me.held = 1;
});
document.addEventListener('keyup', e => { if ((e.key === 'ArrowLeft' && WORLD.me.held < 0) || (e.key === 'ArrowRight' && WORLD.me.held > 0)) WORLD.me.held = 0; });

// ---------- camera: swipe left and right only, with a little glide ----------
function clampCam() { WORLD.cam.x = Math.max(0, Math.min(WORLD.wmax - WORLD.vw / WORLD.z, WORLD.cam.x)); WORLD.cam.y = Math.max(0, (WH - WORLD.vh / WORLD.z) / 2); }
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
// The tap boxes and signs for the scene you're in: the town, or a cave island.
function layerHtml() {
  let h = '';
  for (const b of WORLD.scene === 'cave' ? CAVE_BUILDINGS : BUILDINGS) {
    const act = b.tab === 'lb' ? 'data-lb="open"' : `data-go="${b.tab}"`;
    h += `<button class="bld" ${act} aria-label="${b.name}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"></button>`;
    const sy = b.tab === 'dock' ? b.y + b.h + 12 : b.y - 8;
    h += `<button class="sign" ${act} aria-label="${b.name}" style="left:${b.x + b.w / 2}px;top:${sy}px">${b.name}<small id="isl-${b.tab}"></small><i class="dot"></i></button>`;
  }

  if (WORLD.scene === 'home') for (const [id, d] of Object.entries(DECOR)) h += `<button class="bld" data-act="${id === 'stand' ? 'openStand' : 'openDoghouse'}" aria-label="${d.name}" style="left:${d.x}px;top:${d.y}px;width:${d.w}px;height:${d.h}px"></button>`;
  return h;
}
function islandHtml() {
  let h = `<div class="world" id="world"><canvas id="worldCv" aria-hidden="true"></canvas><div class="isle" id="worldLayer" style="width:${WW}px;height:${WH}px">${layerHtml()}`;
  h += '</div><button class="walk l" id="walkL" aria-label="Walk left">◀</button><button class="walk r" id="walkR" aria-label="Walk right">▶</button><button class="toSpawn" id="toSpawn" aria-label="Back to town">⌂ Town</button><div class="islebanner" id="isleBanner"></div><button class="bossalert" id="bossAlert" data-act="worldBoss" hidden></button></div>';
  return h;
}

function buildIsland() {
  const sec = $('#tab-island');
  if (!sec.childElementCount) {
    sec.innerHTML = islandHtml();
    WORLD.cv = $('#worldCv');
    WORLD.ctx = WORLD.cv.getContext('2d');
    WORLD.isle = 0; WORLD.scene = 'home'; WORLD.wmax = HOME_W;
    WORLD.img = paintWorld();
    updateIsleBanner(false);
    bindSwipe($('#world'));
    $('#world').addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const r = $('#world').getBoundingClientRect();
      worldTap(WORLD.cam.x + (e.clientX - r.left) / WORLD.z, WORLD.cam.y + (e.clientY - r.top) / WORLD.z);
    });
    $('#toSpawn').addEventListener('click', e => { e.stopPropagation(); WORLD.me.x = SPAWN.x; WORLD.me.dir = 1; centerOnSpawn(); SFX.click(); });
    bindWalk($('#walkL'), -1); bindWalk($('#walkR'), 1);
    sizeIsland();
    centerOnSpawn();
  } else sizeIsland();
  if (WORLD.want) { const w = WORLD.want; WORLD.want = null; if (w.scene !== WORLD.scene || w.i !== WORLD.isle) setScene(w.scene, w.i); }
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
  // A boss blocks the way: say so on the world, with a button straight into the fight.
  const ba = $('#bossAlert');
  if (ba) {
    const on = bossWaiting();
    if (ba.hidden === on) ba.hidden = !on;
    const txt = `<b>⚔ Boss at B${S.run.floor}</b><small>Tap to fight it in the Cave</small>`;
    if (on && ba.dataset.f !== String(S.run.floor)) { ba.dataset.f = S.run.floor; ba.innerHTML = txt; }
  }
  set('fight', bossWaiting() ? 'Boss!' : 'B' + S.run.floor);
  set('skills', S.run.sp > 0 ? S.run.sp + ' pts' : '');
  set('cases', freeCrateReady() ? 'Free!' : '');
  set('dock', '');
}

function islandLoop(now) {
  requestAnimationFrame(islandLoop);
  if (UI.tab !== 'island' || document.hidden || !WORLD.img || (typeof TITLE !== 'undefined' && TITLE.on)) { WORLD.last = now; return; }
  const dt = Math.min(0.1, (now - (WORLD.last || now)) / 1000);
  WORLD.last = now;
  if (!WORLD.drag && Math.abs(WORLD.vx) > 0.05) { WORLD.cam.x += WORLD.vx; WORLD.vx *= 0.9; clampCam(); placeLayer(); }
  walkStep(dt);
  // On a cave island, it is always the island of the floor you're on (after Sail on, or a prestige).
  if (WORLD.scene === 'cave' && worldIsle() !== WORLD.isle) setScene('cave', worldIsle());
  drawWorld(dt);
  if ((WORLD.signT = (WORLD.signT || 0) + dt) > 0.5) { WORLD.signT = 0; updateIslandSigns(); }
}
requestAnimationFrame(islandLoop);

// Buildings open their screen; the phone's back gesture (or the back button) returns to the world.
function goBuilding(tab) {
  audioUnlock();
  if (tab === 'dock') { openHarbor(); return; }
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

// ---------- Version 2: islands and the harbor ----------
function updateIsleBanner(big) {
  const el = $('#isleBanner');
  if (!el) return;
  const i = WORLD.isle || 0, isl = ISLANDS[i], next = ISLANDS[i + 1];
  el.innerHTML = WORLD.scene === 'home' ? '<b>Your town</b><small>Greenhollow</small>'
    : `<b>${isl.name}</b><small>Cave B${isl.from}${next ? '–' + (next.from - 1) : '+'}</small>`;
  if (big) { el.classList.remove('big'); void el.offsetWidth; el.classList.add('big'); }
}
// Switch between your town and a cave island: repaint, swap the tap boxes, and put you on the dock.
function setScene(scene, i = 0) {
  WORLD.scene = scene; WORLD.isle = scene === 'home' ? 0 : i; WORLD.wmax = scene === 'home' ? HOME_W : CAVE_W;
  WORLD.img = scene === 'home' ? paintWorld() : paintCaveIsle(i);
  const layer = $('#worldLayer');
  if (layer) layer.innerHTML = layerHtml();
  const me = WORLD.me;
  me.held = 0; me.x = scene === 'home' ? PIER.x0 - 6 : CAVE_PIER.x1 + 8; me.dir = scene === 'home' ? -1 : 1;
  WORLD.cam.x = me.x - (WORLD.vw / WORLD.z || 160) / 2; WORLD.vx = 0; clampCam(); placeLayer();
  const ts = $('#toSpawn');
  if (ts) ts.hidden = scene !== 'home';
  updateIsleBanner(true); updateIslandSigns();
}
// The cave tab is inside a cave island: when you come back out, you're standing on that island.
function enterCaveScene() { WORLD.want = { scene: 'cave', i: worldIsle() }; }
// The dock: pick an island's cave to sail to, or (from a cave island) sail home.
function openHarbor() {
  const here = WORLD.scene === 'cave' ? WORLD.isle : -1, open = S.run.open, found = islesReached();
  let h = `<h2>${here < 0 ? 'Set sail' : ISLANDS[here].name + ' dock'}</h2><p class="small muted" style="text-align:center">Every island is a cave of 100 floors. Beat an island's last floor to sail on to the next.</p><div class="islelist">`;
  if (here >= 0) h += `<button class="isleopt" data-act="sail" data-i="-1"><span class="isleswatch" style="background:${ISLE_STYLE.green.swatch}"></span><span class="grow"><b>Home</b><small>Your town in Greenhollow</small></span></button>`;
  ISLANDS.forEach((isl, i) => {
    const ok = i <= open, end = isleEnd(i), range = `B${isl.from}${end < Infinity ? '–' + end : '+'}`;
    const sub = ok ? `${range} · ${isl.caveLook}` : `${range} · beat B${isl.from - 1}${i <= found ? ' this run' : ''} to sail here`;
    h += `<button class="isleopt ${here === i ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="sail" data-i="${i}" ${ok && here !== i ? '' : 'disabled'}>
      <span class="isleswatch" style="background:${i <= Math.max(open, found) ? ISLE_STYLE[isl.id].swatch : 'var(--ink)'}"></span>
      <span class="grow"><b>${isl.name} cave</b><small>${sub}</small></span>${here === i ? '<span class="isletag">Here</span>' : ''}</button>`;
  });
  h += `</div><p class="small muted" style="text-align:center;margin:8px 0 0">Islands discovered: ${found + 1}/${ISLANDS.length} · +${Math.round(ISLE_COINS * S.isle.claimed * 100)}% coins forever</p>
    <div class="mbtns"><button class="btn" data-act="close">Close</button></div>`;
  openModal(h, { dismissable: true });
}
// i is an island (its cave), or -1 for home. The boat trip plays, and you step off on the dock.
function sailTo(i) {
  closeModal();
  if (i < 0) { setScene('home'); showIsleTravel(-1); return; }
  if (!sailToIsle(i)) return;
  setScene('cave', i);
  showIsleTravel(i);
}
// Arriving on a new island: a boat sails across and the island's name comes up.
function showIsleTravel(i) {
  const w = $('#world');
  if (!w) return;
  const old = $('.isletravel', w);
  if (old) old.remove();
  const home = i < 0, isl = ISLANDS[Math.max(0, i)], el = document.createElement('div');
  el.className = 'isletravel';
  el.innerHTML = `<div class="itsea"><img class="itboat" src="${spriteUrl(boatSprite(), 4, 'boat')}" alt=""></div>
    <div class="itcard"><small>Now arriving</small><b>${home ? 'Home' : isl.name}</b><span>${home ? 'Your town in Greenhollow' : 'The cave: ' + isl.caveLook.toLowerCase()}</span></div>`;
  w.appendChild(el);
  SFX.claim();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3200);
}
