'use strict';
// Version 2 home screen: an island instead of a tab bar, laid out from the "island v1" sketch and
// painted in a smooth cartoon-map style (soft shading, lush trees along the shore, a volcano with
// the mine at its foot, wide dirt paths, turquoise shallows, clouds and sea life). The still parts
// are painted once at full screen resolution; the sea, smoke, lights, boats and clouds move.
// Buildings are plain buttons on top, so they work with screen readers and never miss a tap.

const ISLE_W = 360;
const ISLE_H = 640;
const ISLE = { cv: null, ctx: null, k: 1, baseK: 0, t: 0, raf: 0, h: ISLE_H, oy: 0, boats: [], nextBoat: 20, pops: [], birds: [], puffs: [], clouds: [], whale: null, nextWhale: 25, sprites: {} };

// Where each building sits. Each one is drawn in its own original coordinates, then moved so its
// anchor (ax, ay), the middle of the ground in front of its door, lands at (px, py), and shrunk by s.
// o* is the drawn building's box in those original coordinates, lift is how far the bottom of the
// door sits above the anchor there, and plaque is the name plaque's centre when it doesn't simply
// hang above the building.
const BUILDINGS = [
  { tab: 'fight', name: 'Cave', ox: 110, oy: 56, ow: 160, oh: 132, ax: 190, ay: 182, s: 0.85, px: 190, py: 182, lift: 3, plaque: [190, 126] },
  { tab: 'forge', name: 'Forge', ox: 74, oy: 190, ow: 96, oh: 96, ax: 133, ay: 286, s: 0.74, px: 136, py: 281, lift: 4 },
  { tab: 'skills', name: 'Temple', ox: 197, oy: 212, ow: 102, oh: 118, ax: 248, ay: 330, s: 0.74, px: 244, py: 305, lift: 3 },
  { tab: 'cases', name: 'Market', ox: 58, oy: 352, ow: 110, oh: 72, ax: 113, ay: 424, s: 0.74, px: 122, py: 391, lift: 4 },
  { tab: 'bag', name: 'House', ox: 216, oy: 378, ow: 92, oh: 92, ax: 262, ay: 470, s: 0.74, px: 248, py: 431, lift: 4 },
  { tab: 'quests', name: 'Quests', ox: 181, oy: 496, ow: 88, oh: 64, ax: 225, ay: 560, s: 0.74, px: 239, py: 535, lift: 4 },
  { tab: 'more', name: 'Lighthouse', ox: 66, oy: 546, ow: 60, oh: 64, ax: 95, ay: 606, s: 1, px: 100, py: 508, lift: 0 },
  { tab: 'dock', name: 'Dock', ox: 6, oy: 500, ow: 70, oh: 60, ax: 72, ay: 531, s: 1, px: 74, py: 552, lift: 0, plaque: [42, 592] },
];
function bOf(tab) { return BUILDINGS.find(q => q.tab === tab); }
// A point drawn in a building's own coordinates, where it ends up on the island.
function at(tab, x, y) { const b = bOf(tab); return [b.px + (x - b.ax) * b.s, b.py + (y - b.ay) * b.s]; }
function boxOf(b) { const [x, y] = at(b.tab, b.ox, b.oy); return { x, y, w: b.ow * b.s, h: b.oh * b.s }; }
function doorOf(b) { return [b.px, b.py - b.lift * b.s]; }
function plaqueOf(b) { if (b.plaque) return b.plaque; const bx = boxOf(b); return [bx.x + bx.w / 2, bx.y - 12]; }
function scaled(tab, fn) { const b = bOf(tab), d = c(); d.save(); d.translate(b.px, b.py); d.scale(b.s, b.s); d.translate(-b.ax, -b.ay); fn(); d.restore(); }

// The coastline from the sketch, smoothed into a curve, with a few small bays.
const COAST = [[170, 44], [232, 50], [280, 72], [300, 110], [290, 160], [296, 206], [326, 250], [318, 300], [338, 340], [330, 392],
  [352, 440], [344, 500], [322, 548], [292, 580], [236, 606], [162, 630], [92, 626], [58, 592], [44, 540], [52, 490], [60, 440],
  [36, 380], [30, 318], [52, 262], [68, 206], [72, 160], [82, 110], [118, 66]];
// The paths. The main path leaves the mine, runs down the middle of town and turns west to the
// dock. Every door faces the viewer, so a building's path comes in from the front: a spur leaves
// the main path, runs along the ground below the building, turns up and stops at the door. No path
// passes under a building. Everything is stroked together, pass by pass, so the joins are seamless.
const SPINE = [[190, 180], [189, 215], [186, 255], [184, 300], [184, 345], [185, 390], [185, 435], [185, 480], [185, 522],
  [180, 546], [164, 556], [130, 557], [100, 556], [76, 553]];
const PATH_W = 22; // a path's full width, edges included
const SPUR_GAP = 24; // how far below its door a spur runs
const SPUR_R = 10; // the radius of a spur's turn up to the door

// ---------- drawing helpers (smooth, anti-aliased) ----------
function c() { return ISLE.ctx; }
function fillCircle(x, y, r, fill) { const d = c(); d.fillStyle = fill; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill(); }
function fillEll(x, y, rx, ry, fill, rot = 0) { const d = c(); d.fillStyle = fill; d.beginPath(); d.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); d.fill(); }
function rect(x, y, w, h, fill) { const d = c(); d.fillStyle = fill; d.fillRect(x, y, w, h); }
function rrPath(x, y, w, h, r) {
  const p = new Path2D(); r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); p.closePath();
  return p;
}
function fillRR(x, y, w, h, r, fill) { const d = c(); d.fillStyle = fill; d.fill(rrPath(x, y, w, h, r)); }
function archPath(x, y, w, h) { const p = new Path2D(); p.moveTo(x, y + h); p.lineTo(x, y + w / 2); p.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); p.lineTo(x + w, y + h); p.closePath(); return p; }
function lin(x0, y0, x1, y1, stops) { const gr = c().createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; }
function rad(x, y, r0, r1, stops, x1 = x, y1 = y) { const gr = c().createRadialGradient(x, y, r0, x1, y1, r1); for (const [o, col] of stops) gr.addColorStop(o, col); return gr; }
function fillPath(p, fill) { const d = c(); d.fillStyle = fill; d.fill(p); }
function strokePath(p, col, w, cap = 'round') { const d = c(); d.strokeStyle = col; d.lineWidth = w; d.lineCap = cap; d.lineJoin = 'round'; d.stroke(p); }
function line(x0, y0, x1, y1) { const p = new Path2D(); p.moveTo(x0, y0); p.lineTo(x1, y1); return p; }
function glow(x, y, r, rgb, a) { const d = c(); d.globalAlpha = a; fillCircle(x, y, r, rad(x, y, 0, r, [[0, `rgba(${rgb},1)`], [1, `rgba(${rgb},0)`]])); d.globalAlpha = 1; }
function irng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// Catmull-Rom through the points, as one closed (or open) path, and the same curve as a polyline.
function splineSeg(pts, i, closed) {
  const n = pts.length, at = j => pts[closed ? (j + n) % n : Math.max(0, Math.min(n - 1, j))];
  const a = at(i - 1), b = at(i), cc = at(i + 1), d = at(i + 2);
  return [b, [b[0] + (cc[0] - a[0]) / 6, b[1] + (cc[1] - a[1]) / 6], [cc[0] - (d[0] - b[0]) / 6, cc[1] - (d[1] - b[1]) / 6], cc];
}
function smoothPath(pts, closed) {
  const p = new Path2D(), n = closed ? pts.length : pts.length - 1;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) { const [, b, cc, d] = splineSeg(pts, i, closed); p.bezierCurveTo(b[0], b[1], cc[0], cc[1], d[0], d[1]); }
  if (closed) p.closePath();
  return p;
}
function samplePath(pts, closed) {
  const out = [], n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, b, cc, d] = splineSeg(pts, i, closed);
    for (let t = 0; t < 1; t += 0.1) {
      const u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * cc[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * cc[1] + t * t * t * d[1]]);
    }
  }
  if (closed) out.push(out[0]); else out.push(pts[pts.length - 1]);
  return out;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distPolyline(px, py, l) { let m = 1e9; for (let i = 1; i < l.length; i++) m = Math.min(m, distSeg(px, py, l[i - 1][0], l[i - 1][1], l[i][0], l[i][1])); return m; }
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const COAST_PATH = smoothPath(COAST, true);
const COAST_LINE = samplePath(COAST, true);
const SPINE_LINE = samplePath(SPINE, false);
// Where the main path first crosses height y, coming down from the mine.
function spineX(y) {
  const l = SPINE_LINE;
  for (let i = 1; i < l.length; i++) {
    const [x0, y0] = l[i - 1], [x1, y1] = l[i];
    if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
  }
  return l[l.length - 1][0];
}
// Where the main path's westward stretch passes x.
function spineYAt(x) {
  const l = SPINE_LINE;
  for (let i = 1; i < l.length; i++) {
    const [x0, y0] = l[i - 1], [x1, y1] = l[i];
    if (y0 > 530 && (x0 - x) * (x1 - x) <= 0 && x0 !== x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return l[l.length - 1][1];
}
// A building's spur: along the ground below it, then a rounded turn up to the door. The path's
// rounded end just touches the bottom of the door. The lighthouse stands right above the westward
// stretch, so its spur is a short straight walk up.
function spurFor(b) {
  const [dx, dy] = doorOf(b), end = dy + PATH_W / 2, p = new Path2D();
  if (b.tab === 'more') {
    const sy = spineYAt(dx);
    p.moveTo(dx, sy); p.lineTo(dx, end);
    return { path: p, pts: [[dx, sy], [dx, (sy + end) / 2], [dx, end]] };
  }
  const sy = dy + SPUR_GAP, sx = spineX(sy), dir = Math.sign(dx - sx) || 1;
  p.moveTo(sx, sy); p.lineTo(dx - dir * SPUR_R, sy); p.quadraticCurveTo(dx, sy, dx, sy - SPUR_R); p.lineTo(dx, end);
  const pts = [];
  for (let t = 0; t <= 1; t += 0.1) pts.push([sx + (dx - dir * SPUR_R - sx) * t, sy]);
  pts.push([dx - dir * SPUR_R * 0.3, sy - SPUR_R * 0.3], [dx, sy - SPUR_R], [dx, end]);
  return { path: p, pts };
}
function pathNetwork() {
  const paths = [smoothPath(SPINE, false)], lines = [SPINE_LINE];
  for (const b of BUILDINGS) {
    if (b.tab === 'fight' || b.tab === 'dock') continue;
    const sp = spurFor(b);
    paths.push(sp.path); lines.push(sp.pts);
  }
  return { paths, lines };
}

// ---------- the still layer: ground, paths, plants and buildings, painted once ----------
function islandBase() {
  const k = ISLE.k, cv = makeCanvas(Math.ceil(ISLE_W * k), Math.ceil(ISLE_H * k));
  const prev = ISLE.ctx;
  ISLE.ctx = cv.getContext('2d');
  const d = c();
  d.scale(k, k);
  d.lineJoin = 'round'; d.lineCap = 'round';
  // The island's own shadow in the water, then turquoise shallows and a thin foam fringe.
  d.save(); d.translate(5, 8); fillPath(COAST_PATH, 'rgba(0,30,80,0.3)'); strokePath(COAST_PATH, 'rgba(0,30,80,0.3)', 14); d.restore();
  strokePath(COAST_PATH, 'rgba(110, 225, 240, 0.5)', 78);
  strokePath(COAST_PATH, 'rgba(150, 240, 248, 0.55)', 56);
  strokePath(COAST_PATH, 'rgba(255,255,255,0.35)', 26);
  strokePath(COAST_PATH, 'rgba(255,255,255,0.6)', 23);
  strokePath(COAST_PATH, 'rgba(255,255,255,0.9)', 20);
  // Grass, with darker and sunlit patches, and a lighter rim toward the beach.
  fillPath(COAST_PATH, '#64c74f');
  d.save();
  d.clip(COAST_PATH);
  const r = irng(11);
  for (let i = 0; i < 46; i++) fillEll(r() * ISLE_W, 40 + r() * 600, 12 + r() * 22, 7 + r() * 12, 'rgba(50,145,45,0.2)');
  for (let i = 0; i < 30; i++) fillEll(r() * ISLE_W, 40 + r() * 600, 10 + r() * 18, 6 + r() * 10, 'rgba(210,250,150,0.2)');
  for (let i = 0; i < 160; i++) { // grass tufts
    const x = r() * ISLE_W, y = 40 + r() * 600;
    for (let j = -1; j <= 1; j++) strokePath(line(x + j * 1.6, y, x + j * 2.6, y - 3 - r() * 2), j ? '#3f9a3a' : '#2f8a32', 0.9);
  }
  strokePath(COAST_PATH, '#94dd72', 30);
  d.restore();
  // The beach: wet sand at the water, dry sand on the crest, soft into the grass.
  strokePath(COAST_PATH, '#d9bb74', 18);
  strokePath(COAST_PATH, '#f1d98e', 16);
  d.save(); d.clip(COAST_PATH); strokePath(COAST_PATH, 'rgba(241,217,142,0.6)', 20); strokePath(COAST_PATH, '#f1d98e', 16); d.restore();
  strokePath(COAST_PATH, '#f9e9b2', 6);
  // Shells and starfish on the sand.
  for (let i = 0; i < 16; i++) {
    const p = COAST_LINE[Math.floor(r() * (COAST_LINE.length - 1))], x = p[0] + (r() - 0.5) * 8, y = p[1] + (r() - 0.5) * 8;
    if (r() < 0.4) starfish(x, y, 2.6 + r());
    else { fillEll(x, y, 2.2, 1.6, '#f3a8b8', r() * 3); fillEll(x - 0.5, y - 0.4, 1.2, 0.8, '#fde2e8', r() * 3); }
  }

  drawPaths();
  const plants = plantIsland(irng(7));
  for (const p of plants) {
    if (p.kind === 'tree') tree(p.x, p.y, p.r);
    else if (p.kind === 'palm') palm(p.x, p.y, p.r * 3, p.lean);
    else if (p.kind === 'bush') bush(p.x, p.y, p.r);
    else flowers(p.x, p.y, p.r * 1.6);
  }
  scaled('fight', drawMountain);
  drawPond(306, 505);
  drawWell(152, 478);
  scaled('forge', drawForge); scaled('skills', drawTemple); scaled('cases', drawMarket); scaled('bag', drawHouse); scaled('quests', drawBoard);
  scaled('more', drawLighthouse); scaled('dock', drawDock);
  ISLE.ctx = prev;
  return cv;
}

function drawPaths() {
  const d = c(), all = pathNetwork().paths;
  for (const [col, w, a] of [['#8a6a3a', PATH_W, 0.35], ['#a98650', PATH_W - 4, 1], ['#c9a467', PATH_W - 8, 1], ['#e3c884', 6, 0.55]]) {
    d.globalAlpha = a;
    for (const p of all) strokePath(p, col, w);
  }
  d.globalAlpha = 1;
  // A stone step in front of every door, where its path ends.
  for (const b of BUILDINGS) {
    if (b.tab === 'fight' || b.tab === 'dock') continue;
    const [x, y] = doorOf(b);
    fillRR(x - 9, y - 2, 18, 6, 2, '#8f7f68'); fillRR(x - 8, y - 2, 16, 4, 1.5, '#c9b99c'); rect(x - 7, y - 1.5, 14, 1, 'rgba(255,255,255,0.35)');
  }
  const r = irng(5), main = SPINE_LINE;
  for (let i = 0; i < 70; i++) {
    const p = main[Math.floor(r() * main.length)];
    fillEll(p[0] + (r() - 0.5) * 9, p[1] + (r() - 0.5) * 7, 1.4, 0.9, r() < 0.5 ? '#9c7748' : '#eed9a4');
  }
}

// Trees and shrubs: a lush ring just inside the beach, then some inland, never on a path, a
// doorstep, a building or a plaque.
function plantIsland(r) {
  const pathLines = pathNetwork().lines;
  const plaqueW = b => 20 + 6.4 * (b.name.length + 6);
  const blocks = [
    ...BUILDINGS.filter(b => b.tab !== 'fight').map(boxOf).map(b => [b.x - 6, b.y - 6, b.w + 12, b.h + 12]),
    ...BUILDINGS.map(b => { const [x, y] = plaqueOf(b), w = plaqueW(b); return [x - w / 2, y - 12, w, 24]; }),
    [164, 76, 52, 44], [146, 118, 88, 36], [116, 150, 148, 42], [276, 486, 60, 38], [136, 446, 34, 40],
  ];
  const plants = [];
  const free = (x, y, rad) => {
    if (!pointInPoly(x, y, COAST_LINE) || distPolyline(x, y, COAST_LINE) < 15 + rad * 0.6) return false;
    for (const [bx, by, bw, bh] of blocks) if (x + rad > bx && x - rad < bx + bw && y + rad * 0.5 > by && y - rad * 1.6 < by + bh) return false;
    for (const l of pathLines) if (distPolyline(x, y, l) < 11 + rad) return false;
    for (const p of plants) if (Math.hypot(x - p.x, y - p.y) < (rad + p.r) * 0.8) return false;
    return true;
  };
  const place = (x, y, roll) => {
    const kind = roll < 0.5 ? 'tree' : roll < 0.72 ? 'palm' : roll < 0.9 ? 'bush' : 'flowers';
    const rad = kind === 'tree' ? 6.5 + r() * 5 : kind === 'palm' ? 7 + r() * 2 : kind === 'bush' ? 4 + r() * 2 : 5;
    if (!free(x, y, rad)) return;
    plants.push({ x, y, r: rad, kind, lean: r() < 0.5 ? -1 : 1 });
  };
  let acc = 0;
  for (let i = 1; i < COAST_LINE.length; i++) {
    const [ax, ay] = COAST_LINE[i - 1], [bx, by] = COAST_LINE[i];
    acc += Math.hypot(bx - ax, by - ay);
    if (acc < 14) continue;
    acc = 0;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, off = 22 + r() * 10;
    let x = bx + nx * off, y = by + ny * off;
    if (!pointInPoly(x, y, COAST_LINE)) { x = bx - nx * off; y = by - ny * off; }
    place(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6, r() * 0.72);
  }
  for (let i = 0; i < 480; i++) place(40 + r() * 280, 60 + r() * 560, r());
  plants.sort((a, b) => a.y - b.y);
  return plants;
}

function starfish(x, y, s) {
  const d = c(), p = new Path2D();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.45 : s; p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  p.closePath(); fillPath(p, '#ff8a3d'); d.globalAlpha = 0.5; fillCircle(x, y, s * 0.3, '#ffd09a'); d.globalAlpha = 1;
}
function shade(cx, cy, rx, ry = 4) { fillEll(cx, cy, rx, ry, 'rgba(10,35,20,0.28)'); }
function leafBall(x, y, r) { fillCircle(x, y, r, rad(x - r * 0.35, y - r * 0.45, 0, r * 1.45, [[0, '#9ae675'], [0.4, '#4bb552'], [1, '#246c33']])); }
function tree(x, y, r) {
  shade(x + 3, y + 1, r * 0.95, r * 0.35);
  fillRR(x - r * 0.17, y - r * 0.7, r * 0.34, r * 0.8, 1.5, lin(x - r * 0.17, 0, x + r * 0.17, 0, [[0, '#8a6038'], [1, '#4e3418']]));
  const cy = y - r * 0.95;
  for (const [dx, dy, s] of [[-0.55, 0.25, 0.68], [0.55, 0.25, 0.68], [-0.32, -0.42, 0.62], [0.36, -0.42, 0.62], [0, 0, 1]]) leafBall(x + dx * r, cy + dy * r, r * s);
}
function bush(x, y, r) {
  shade(x + 2, y + 1, r * 1.1, r * 0.4);
  for (const [dx, dy, s] of [[-0.6, 0.1, 0.7], [0.6, 0.1, 0.7], [0, -0.3, 0.9]]) leafBall(x + dx * r, y - r * 0.5 + dy * r, r * s);
  fillCircle(x - r * 0.3, y - r * 0.9, 1.3, '#ff8fb1'); fillCircle(x + r * 0.5, y - r * 0.6, 1.3, '#ffd94d');
}
function palm(x, y, h, lean) {
  shade(x + 4, y + 1, 8, 3);
  const tx = x + lean * h * 0.3, ty = y - h, trunk = new Path2D();
  trunk.moveTo(x, y); trunk.quadraticCurveTo(x + lean * h * 0.05, y - h * 0.6, tx, ty);
  strokePath(trunk, '#4e3418', 5.5); strokePath(trunk, '#8a6038', 3.5); strokePath(trunk, 'rgba(255,220,160,0.35)', 1.2);
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI * 0.98 + (i / 7) * Math.PI * 0.96 + lean * 0.1, L = h * 0.66;
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.5 + L * 0.32;
    const leaf = new Path2D();
    leaf.moveTo(tx, ty); leaf.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.1 - 9, ex, ey);
    leaf.quadraticCurveTo(tx + Math.cos(a) * L * 0.55, ty + Math.sin(a) * L * 0.6 + 7, tx, ty); leaf.closePath();
    fillPath(leaf, i % 2 ? '#2f8f3f' : '#45b352');
    strokePath(line(tx, ty, (tx + ex) / 2, (ty + ey) / 2 - 1), 'rgba(170,240,130,0.6)', 1);
  }
  fillCircle(tx - 2, ty + 2, 2, '#6b3d1e'); fillCircle(tx + 2, ty + 3, 2, '#5a3218');
}
function flowers(x, y, r) {
  const rr = irng(Math.round(x * 7 + y));
  for (let i = 0; i < 9; i++) {
    const a = rr() * Math.PI * 2, dd = rr() * r, fx = x + Math.cos(a) * dd, fy = y + Math.sin(a) * dd * 0.6;
    rect(fx - 0.4, fy, 0.8, 2.5, '#2f7d3a');
    fillCircle(fx, fy, 1.4, ['#fff6e0', '#ffd94d', '#ff8fb1', '#b9a2ff'][i % 4]);
  }
}
function boulder(x, y, s) {
  shade(x + 2, y + 3, s * 1.1, s * 0.5);
  fillEll(x, y, s, s * 0.75, rad(x - s * 0.35, y - s * 0.4, 0, s * 1.5, [[0, '#aaa2b5'], [0.5, '#6f6678'], [1, '#433a4a']]));
}

function drawMountain() {
  const d = c();
  fillEll(200, 180, 84, 10, 'rgba(10,35,20,0.3)');
  // A volcano: the cone, lit from the left, with ridges, gullies and boulders at its foot.
  const cone = new Path2D();
  cone.moveTo(110, 178); cone.quadraticCurveTo(140, 150, 156, 110); cone.quadraticCurveTo(166, 84, 172, 70);
  cone.lineTo(208, 70); cone.quadraticCurveTo(214, 86, 226, 112); cone.quadraticCurveTo(244, 150, 270, 178); cone.closePath();
  fillPath(cone, lin(110, 0, 270, 0, [[0, '#9a8a9c'], [0.42, '#6f5f73'], [1, '#473c4c']]));
  d.save(); d.clip(cone);
  for (const [x0, x1, w] of [[150, 128, 5], [168, 150, 4], [182, 172, 3]]) strokePath(line(x0, 74, x1, 178), 'rgba(255,255,255,0.13)', w);
  for (const [x0, x1, w] of [[204, 216, 4], [214, 240, 6], [222, 258, 4]]) strokePath(line(x0, 74, x1, 178), 'rgba(0,0,0,0.22)', w);
  for (const [x, y, rx, ry] of [[132, 166, 14, 5], [150, 150, 9, 4], [246, 168, 14, 5], [236, 146, 8, 3], [160, 176, 12, 4], [228, 178, 12, 4]]) { fillEll(x, y, rx, ry, '#4f9a42'); fillEll(x - 2, y - 1.5, rx * 0.6, ry * 0.5, '#7ccf62'); }
  d.restore();
  for (const [x, y, s] of [[122, 170, 13], [258, 172, 13], [150, 178, 9], [238, 180, 8]]) boulder(x, y, s);
  // Crater and lava (the glow pulses live).
  fillEll(190, 70, 26, 9, '#3a3040');
  fillEll(190, 71, 18, 6, rad(186, 70, 1, 18, [[0, '#ffe066'], [0.5, '#ff8a1a'], [1, '#c83c10']]));
  // The mine entrance at the foot: an arch with a timber frame, rails and a sign.
  fillEll(190, 162, 20, 18, '#1a1220'); rect(170, 162, 40, 17, '#1a1220');
  fillEll(190, 164, 15, 14, '#07050a'); rect(175, 164, 30, 15, '#07050a');
  fillRR(169, 148, 6, 31, 1.5, lin(169, 0, 175, 0, [[0, '#9a6c40'], [1, '#6b4526']]));
  fillRR(205, 148, 6, 31, 1.5, lin(205, 0, 211, 0, [[0, '#9a6c40'], [1, '#6b4526']]));
  fillRR(166, 144, 48, 7, 2, lin(0, 144, 0, 151, [[0, '#a87a48'], [1, '#6b4526']]));
  fillRR(182, 134, 16, 10, 2, '#8a5a2a'); fillRR(183, 135, 14, 8, 1.5, '#c8904a');
  for (const x of [186, 190, 194]) fillCircle(x, 139, 1.2, '#5a3a1a');
  for (let y = 168; y < 180; y += 4) rect(182, y, 16, 2, '#5d4027');
  rect(184, 166, 2, 14, '#9aa0a8'); rect(194, 166, 2, 14, '#9aa0a8');
}

// ---------- buildings, in a soft top-down cartoon style ----------
function roofSlab(x, y, w, h, [light, mid, dark]) {
  const p = new Path2D();
  p.moveTo(x + 6, y); p.lineTo(x + w - 6, y); p.quadraticCurveTo(x + w, y, x + w, y + 4); p.lineTo(x + w, y + h - 3);
  p.quadraticCurveTo(x + w, y + h, x + w - 3, y + h); p.lineTo(x + 3, y + h); p.quadraticCurveTo(x, y + h, x, y + h - 3);
  p.lineTo(x, y + 4); p.quadraticCurveTo(x, y, x + 6, y); p.closePath();
  fillPath(p, lin(0, y, 0, y + h, [[0, light], [0.5, mid], [1, dark]]));
  for (let yy = y + 7; yy < y + h - 3; yy += 6) strokePath(line(x + 2, yy, x + w - 2, yy), 'rgba(0,0,0,0.12)', 1.5, 'butt');
  fillRR(x + 4, y + 1, w - 8, 3, 1.5, 'rgba(255,255,255,0.25)');
  rect(x, y + h - 3, w, 3, 'rgba(0,0,0,0.25)');
}
function win(x, y) {
  fillRR(x - 1, y - 1, 14, 12, 2, '#5a3a1e');
  fillRR(x, y, 12, 10, 1.5, lin(0, y, 0, y + 10, [[0, '#fff2b8'], [1, '#ffcc4d']]));
  rect(x + 5.5, y, 1, 10, '#5a3a1e'); rect(x, y + 4.5, 12, 1, '#5a3a1e');
}
function barrel(x, y) {
  fillRR(x, y, 9, 14, 3, lin(x, 0, x + 9, 0, [[0, '#b07a3a'], [1, '#5a3218']]));
  rect(x, y + 3, 9, 1.5, '#3e3846'); rect(x, y + 9, 9, 1.5, '#3e3846');
}
function chestS(x, y, top, body) {
  fillRR(x, y, 16, 12, 2, '#3a2416'); fillRR(x + 1, y + 1, 14, 10, 1.5, body); fillRR(x + 1, y + 1, 14, 4, 1.5, top);
  fillRR(x + 7, y + 5, 2, 3, 0.5, '#ffe08a');
}
function lantern(x, y) {
  rect(x - 1, y + 8, 3, 22, '#5e3d22');
  glow(x, y + 5, 11, '255,204,77', 0.4);
  fillRR(x - 5, y, 10, 10, 2, '#3e3846'); fillRR(x - 3, y + 2, 6, 6, 1, '#ffcc4d');
}
function noteS(x, y, w, h, col) {
  fillRR(x, y, w, h, 1, col);
  rect(x + 2, y + 4, w - 4, 1, '#9a8a7a'); rect(x + 2, y + 7, w - 6, 1, '#9a8a7a'); rect(x + 2, y + 10, w - 5, 1, '#9a8a7a');
  fillCircle(x + w / 2, y, 1.3, '#e0566b');
}

function drawForge() {
  shade(121, 283, 48, 7);
  const r = irng(3);
  fillRR(78, 232, 80, 50, 4, lin(0, 232, 0, 282, [[0, '#a098ae'], [1, '#6a6176']]));
  for (let yy = 238; yy < 276; yy += 10) for (let xx = 80 + ((yy / 10) % 2) * 8; xx < 154; xx += 16) { fillRR(xx, yy, 13, 7, 2, `rgba(255,255,255,${0.05 + r() * 0.08})`); rect(xx, yy + 7, 13, 1, 'rgba(0,0,0,0.12)'); }
  fillPath(archPath(88, 254, 24, 28), '#2a1a12');
  fillPath(archPath(91, 258, 18, 24), rad(100, 282, 2, 26, [[0, '#fff0a0'], [0.4, '#ffb03d'], [1, '#c84a10']]));
  fillPath(archPath(126, 258, 14, 24), '#4a2c16');
  fillPath(archPath(128, 260, 10, 22), lin(0, 260, 0, 282, [[0, '#8a5a2a'], [1, '#6b4120']]));
  fillCircle(136, 272, 1.2, '#ffcc4d');
  win(144, 240);
  roofSlab(74, 206, 88, 28, ['#e8665a', '#b23c33', '#7f2922']);
  fillRR(144, 192, 12, 20, 1.5, lin(144, 0, 156, 0, [[0, '#8a8194'], [1, '#5d5466']])); fillRR(142, 190, 16, 4, 1.5, '#4d4655');
  barrel(161, 266);
}

function drawTemple() {
  shade(252, 327, 54, 7);
  fillRR(197, 320, 102, 7, 2, lin(0, 320, 0, 327, [[0, '#e2d6bc'], [1, '#b8aa8a']]));
  fillRR(201, 315, 94, 6, 2, lin(0, 315, 0, 321, [[0, '#f2e9d8'], [1, '#c8baa0']]));
  fillRR(205, 272, 86, 46, 3, lin(0, 272, 0, 318, [[0, '#f6efdc'], [1, '#d6c9ad']]));
  for (const xx of [208, 226, 270, 288]) {
    fillRR(xx, 274, 6, 42, 2, lin(xx, 0, xx + 6, 0, [[0, '#fffaf0'], [0.6, '#efe6d0'], [1, '#c4b69a']]));
    fillRR(xx - 1, 273, 8, 3, 1, '#e4d8b8'); fillRR(xx - 1, 312, 8, 3, 1, '#e4d8b8');
  }
  fillPath(archPath(238, 288, 20, 30), '#c8901a');
  fillPath(archPath(240, 290, 16, 28), lin(0, 290, 0, 318, [[0, '#3a2a10'], [1, '#1a1208']]));
  roofSlab(199, 254, 98, 20, ['#ffe690', '#f0b92c', '#b57d10']);
  roofSlab(214, 240, 68, 16, ['#ffe690', '#f0b92c', '#b57d10']);
  fillRR(243, 232, 10, 9, 2, '#c8901a');
}

function drawMarket() {
  shade(117, 423, 50, 7);
  fillRR(68, 380, 90, 40, 3, lin(0, 380, 0, 420, [[0, '#243f5e'], [1, '#162a40']]));
  fillRR(68, 404, 90, 16, 2, lin(0, 404, 0, 420, [[0, '#b07a3a'], [1, '#6b4120']])); rect(68, 404, 90, 2, 'rgba(255,255,255,0.2)');
  chestS(74, 392, '#b07a3a', '#8a5a2a'); chestS(96, 390, '#5aa0e0', '#3a74a8'); chestS(118, 392, '#e0566b', '#b03a4e'); chestS(140, 390, '#ffcc4d', '#c8901a');
  barrel(58, 406); barrel(159, 406);
  roofSlab(64, 352, 98, 22, ['#6aa9e8', '#3f7fb8', '#285a8c']);
  for (let s = 0; s < 8; s++) {
    const x = 60 + s * 13.25, p = new Path2D();
    p.moveTo(x, 372); p.lineTo(x + 13.25, 372); p.lineTo(x + 13.25, 382); p.quadraticCurveTo(x + 6.6, 390, x, 382); p.closePath();
    fillPath(p, s % 2 ? '#f6f8ff' : '#4a9ae0');
  }
  rect(60, 372, 106, 2, '#285a8c');
}

function drawHouse() {
  shade(266, 469, 46, 7);
  fillRR(220, 420, 84, 46, 3, lin(0, 420, 0, 466, [[0, '#f3e9d3'], [1, '#d9ccb0']]));
  rect(220, 442, 84, 2, '#a36a3a'); rect(233, 420, 2, 46, '#a36a3a'); rect(290, 420, 2, 46, '#a36a3a');
  win(228, 430); win(284, 430);
  fillPath(archPath(253, 442, 18, 24), '#5a3a1e');
  fillPath(archPath(255, 444, 14, 22), lin(0, 444, 0, 466, [[0, '#9a6a3a'], [1, '#6b4120']]));
  fillCircle(266, 456, 1.2, '#ffcc4d');
  fillRR(227, 441, 14, 5, 1, '#5e3d22');
  for (let i = 0; i < 5; i++) fillCircle(229 + i * 2.6, 440, 1.3, ['#ff8fb1', '#ffd94d', '#ff6b7d', '#fff6e0', '#ff8fb1'][i]);
  roofSlab(216, 394, 92, 28, ['#f07a84', '#c83f4c', '#8a2430']);
  fillRR(278, 380, 12, 20, 1.5, lin(278, 0, 290, 0, [[0, '#c4844a'], [1, '#7a4a24']])); fillRR(276, 378, 16, 4, 1.5, '#5a3218');
}

function drawBoard() {
  shade(229, 557, 38, 5);
  rect(199, 540, 5, 16, '#5e3d22'); rect(246, 540, 5, 16, '#5e3d22');
  fillRR(192, 504, 66, 40, 3, '#7a4a24');
  fillRR(195, 507, 60, 34, 2, lin(0, 507, 0, 541, [[0, '#d79a56'], [1, '#b67a3e']]));
  fillRR(186, 496, 78, 9, 2, lin(0, 496, 0, 505, [[0, '#ffb060'], [1, '#e07a2a']])); rect(186, 503, 78, 2, 'rgba(0,0,0,0.25)');
  noteS(200, 512, 14, 18, '#fff8e8'); noteS(218, 514, 12, 14, '#ffe8a8'); noteS(234, 511, 16, 20, '#fff8e8');
  lantern(186, 506); lantern(264, 506);
}

function drawLighthouse() {
  const d = c();
  shade(97, 606, 20, 4);
  boulder(80, 597, 10); boulder(114, 599, 9); boulder(98, 588, 8);
  const tower = new Path2D(); tower.moveTo(84, 606); tower.lineTo(106, 606); tower.lineTo(102, 572); tower.lineTo(88, 572); tower.closePath();
  d.save(); d.clip(tower);
  fillPath(tower, '#f6f0ff');
  rect(80, 580, 30, 8, '#b76dff'); rect(80, 597, 30, 9, '#b76dff');
  rect(99, 572, 8, 34, 'rgba(0,0,0,0.18)'); rect(86, 572, 4, 34, 'rgba(255,255,255,0.3)');
  d.restore();
  fillPath(archPath(91, 596, 8, 10), '#3a2a4a');
  fillRR(85, 568, 20, 5, 1.5, '#3e3846');
  fillRR(88, 558, 14, 11, 1.5, lin(0, 558, 0, 569, [[0, '#fff6c8'], [1, '#ffcc4d']])); rect(94.5, 558, 1, 11, '#3e3846'); rect(88, 563, 14, 1, '#3e3846');
  const roof = new Path2D(); roof.moveTo(86, 558); roof.lineTo(95, 548); roof.lineTo(104, 558); roof.closePath(); fillPath(roof, '#8a4fc8');
  fillCircle(95, 547, 1.5, '#3e3846');
}

function drawDock() {
  for (const x of [14, 26, 38, 50, 62]) fillRR(x, 534, 4, 20, 1, lin(x, 0, x + 4, 0, [[0, '#6b4526'], [1, '#3e2816']]));
  fillRR(8, 524, 64, 14, 2, lin(0, 524, 0, 538, [[0, '#a87a48'], [1, '#7a5230']]));
  for (let x = 12; x < 72; x += 8) rect(x, 524, 1, 14, 'rgba(0,0,0,0.25)');
  rect(8, 537, 64, 2, 'rgba(0,0,0,0.3)');
  rect(16, 508, 2, 16, '#5e3d22'); fillRR(10, 503, 22, 9, 1.5, '#f2e9d8'); rect(13, 506, 14, 1, '#8a7a6a'); rect(13, 508.5, 10, 1, '#8a7a6a');
  const hull = new Path2D(); hull.moveTo(20, 546); hull.quadraticCurveTo(36, 560, 54, 546); hull.lineTo(52, 544); hull.lineTo(22, 544); hull.closePath();
  fillPath(hull, lin(0, 544, 0, 558, [[0, '#a36a3a'], [1, '#5a3218']])); rect(22, 544, 30, 2, '#c4844a');
}

function drawPond(cx, cy) {
  fillEll(cx, cy, 26, 15, '#c9a467');
  fillEll(cx, cy, 23, 12.5, rad(cx - 6, cy - 4, 2, 26, [[0, '#8fe6f0'], [0.5, '#4cb6d8'], [1, '#2a86b8']]));
  fillEll(cx - 7, cy - 5, 8, 2.5, 'rgba(255,255,255,0.45)');
  for (const [dx, dy] of [[8, 4], [-10, 5], [12, -3]]) { fillEll(cx + dx, cy + dy, 4, 2.4, '#3c9244'); fillEll(cx + dx - 1, cy + dy - 0.5, 2.2, 1.3, '#5cb853'); }
  fillCircle(cx + 7, cy + 2, 1.3, '#ff8fb1');
  for (let i = 0; i < 4; i++) strokePath(line(cx - 22 + i * 3, cy + 2, cx - 24 + i * 3, cy - 10 - i), '#2f8f3f', 1.2);
}
function drawWell(x, y) {
  shade(x + 2, y + 4, 12, 3);
  fillEll(x, y, 11, 6, '#6f6678'); fillEll(x, y - 3, 11, 6, lin(0, y - 9, 0, y + 3, [[0, '#a39aad'], [1, '#6f6678']])); fillEll(x, y - 4, 7, 3.5, '#1a1220');
  rect(x - 10, y - 20, 2.5, 18, '#5e3d22'); rect(x + 7.5, y - 20, 2.5, 18, '#5e3d22');
  const roof = new Path2D(); roof.moveTo(x - 13, y - 20); roof.lineTo(x + 13, y - 20); roof.lineTo(x + 9, y - 27); roof.lineTo(x - 9, y - 27); roof.closePath();
  fillPath(roof, lin(0, y - 27, 0, y - 20, [[0, '#e0566b'], [1, '#a8303a']]));
  rect(x - 0.5, y - 20, 1, 8, '#3e3846'); fillRR(x - 2.5, y - 12, 5, 4, 1, '#a36a3a');
}

// ---------- boats: tap one as it sails by for coins (or now and then a key) ----------
function boatReward() {
  const rate = Math.max(1, idleRates().coins / Math.max(1, ST.boost)); // coins per second, before the 2x boost
  if (Math.random() < 0.12) return { keys: 1 };
  return { coins: rate * 45 * (0.8 + Math.random() * 0.5) };
}
function seaLanes() {
  const lanes = [22];
  if (ISLE.oy > 34) lanes.push(-ISLE.oy / 2, ISLE_H + ISLE.oy / 2 - 10);
  return lanes;
}
function spawnBoat() {
  const lanes = seaLanes(), dir = Math.random() < 0.5 ? 1 : -1;
  ISLE.boats.push({ x: dir > 0 ? -40 : ISLE_W + 40, y: lanes[Math.floor(Math.random() * lanes.length)], dir, speed: 14 + Math.random() * 6, got: false, bob: Math.random() * 6 });
}
function drawBoat(b, t) {
  const d = c(), x = b.x, y = b.y + Math.sin(t * 2 + b.bob) * 1.2, f = b.dir;
  d.globalAlpha = 0.45; strokePath(line(x - f * 14, y + 10, x - f * 42, y + 12), '#dff6ff', 2); d.globalAlpha = 1;
  const hull = new Path2D(); hull.moveTo(x - 15, y + 4); hull.quadraticCurveTo(x, y + 14, x + 15, y + 4); hull.lineTo(x + 13, y + 2); hull.lineTo(x - 13, y + 2); hull.closePath();
  fillPath(hull, lin(0, y + 2, 0, y + 14, [[0, '#b07a3a'], [1, '#5a3218']])); rect(x - 13, y + 2, 26, 2, '#d9a060');
  rect(x - 1, y - 18, 2, 21, '#5e3d22');
  const sail = new Path2D(); sail.moveTo(x + f * 1.5, y - 17); sail.quadraticCurveTo(x + f * 16, y - 8, x + f * 13, y + 1); sail.lineTo(x + f * 1.5, y + 1); sail.closePath();
  fillPath(sail, b.got ? '#cfc8bc' : '#fbfbf5');
  if (!b.got) {
    d.save(); d.clip(sail); rect(x - 20, y - 9, 40, 3, '#e0566b'); d.restore();
    rect(x - 1, y - 21, f * 7, 3, '#e0566b');
    if (Math.floor(t * 3) % 2) glow(x, y - 24, 6, '255,204,77', 0.9);
    fillCircle(x, y - 24, 2, '#ffcc4d');
  }
}
function tapBoat(lx, ly) {
  for (const b of ISLE.boats) {
    if (b.got || Math.abs(lx - b.x) > 20 || ly < b.y - 26 || ly > b.y + 16) continue;
    b.got = true;
    const rw = boatReward();
    if (rw.keys) { S.keys += rw.keys; ISLE.pops.push({ x: b.x, y: b.y - 28, text: '+1 KEY', col: '#ffe08a', t: 0 }); toast('A passing boat tossed you a key!', 'gold', 'key'); }
    else { addCoins(rw.coins); ISLE.pops.push({ x: b.x, y: b.y - 28, text: '+' + fmt(rw.coins), col: '#ffcc4d', t: 0 }); toast(`A passing boat paid ${fmt(rw.coins)} coins`, 'gold', 'coin'); }
    SFX.coin(); vibrate(15);
    updateHud();
    if (typeof tmCount === 'function') tmCount('boats');
    return true;
  }
  return false;
}

// Soft cloud sprites, painted once.
function cloudSprite(seed) {
  const r = irng(seed), cv = makeCanvas(140, 70), prev = ISLE.ctx;
  ISLE.ctx = cv.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 25 + r() * 90, y = 30 + r() * 18, rr = 14 + r() * 14;
    fillCircle(x, y, rr, rad(x, y, 0, rr, [[0, 'rgba(255,255,255,0.95)'], [0.6, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));
  }
  ISLE.ctx = prev;
  return cv;
}
function drawWhale(w, t) {
  const d = c(), ph = w.t < 0.8 ? w.t / 0.8 : w.t > 3.6 ? Math.max(0, 1 - (w.t - 3.6) / 0.8) : 1;
  const y = w.y + 14 - 14 * ph;
  d.save(); d.beginPath(); d.rect(w.x - 40, w.y - 40, 80, 40 + 4); d.clip();
  fillEll(w.x + 4, y + 2, 24, 10, 'rgba(0,30,60,0.25)');
  fillEll(w.x, y, 22, 9, rad(w.x - 8, y - 6, 0, 30, [[0, '#8fb6d8'], [0.5, '#4f7aa6'], [1, '#2f4f78']]));
  fillEll(w.x - 20, y - 6, 7, 3.5, '#4f7aa6', -0.5);
  fillCircle(w.x + 12, y - 2, 1.5, '#1a1220');
  if (ph > 0.9 && w.t > 1 && w.t < 3.2) {
    const s = Math.min(1, (w.t - 1) / 0.5);
    d.globalAlpha = 0.8;
    strokePath(line(w.x + 6, y - 9, w.x + 6, y - 9 - 14 * s), '#ffffff', 2.5);
    strokePath(line(w.x + 6, y - 9 - 12 * s, w.x - 2, y - 20 * s - 8), '#ffffff', 2); strokePath(line(w.x + 6, y - 9 - 12 * s, w.x + 14, y - 20 * s - 8), '#ffffff', 2);
    d.globalAlpha = 1;
  }
  d.restore();
  strokePath(line(w.x - 24, w.y + 4, w.x + 26, w.y + 4), 'rgba(255,255,255,0.5)', 1.5);
}

// ---------- the moving layer: sea, foam, smoke, lights, boats, clouds ----------
function drawIsland(dt) {
  if (!ISLE.ctx || !ISLE.base) return;
  ISLE.t += dt;
  const t = ISLE.t, d = ISLE.ctx, H = ISLE.h, oy = ISLE.oy;
  d.setTransform(ISLE.k, 0, 0, ISLE.k, 0, 0);
  d.imageSmoothingEnabled = true;
  d.fillStyle = lin(0, 0, 0, H, [[0, '#2f8fd8'], [0.5, '#2278c4'], [1, '#1a5fa8']]);
  d.fillRect(0, 0, ISLE_W, H);
  // Waves: short arcs drifting across, and the odd sun glint.
  for (let i = 0; i < 90 * H / ISLE_H; i++) {
    const y = (i * 53.7) % H, sp = 7 + (i % 5) * 3, x = ((i * 97 + t * sp) % (ISLE_W + 60)) - 30;
    d.strokeStyle = `rgba(190,230,255,${0.2 + 0.2 * Math.sin(t * 1.5 + i)})`; d.lineWidth = 1.5; d.lineCap = 'round';
    d.beginPath(); d.moveTo(x, y); d.quadraticCurveTo(x + 8, y - 4, x + 16, y); d.stroke();
  }
  for (let i = 0; i < 20; i++) if (Math.sin(t * 3 + i * 7.3) > 0.9) fillCircle((i * 97) % ISLE_W, (i * 53 + 20) % H, 1.2, '#ffffff');
  d.setTransform(ISLE.k, 0, 0, ISLE.k, 0, oy * ISLE.k);
  // Whale, out in open water now and then.
  ISLE.nextWhale -= dt;
  if (ISLE.nextWhale <= 0 && !ISLE.whale) { const spots = [[336, 618], [44, 22]]; if (oy > 40) spots.push([ISLE_W / 2, ISLE_H + oy / 2]); const s = spots[Math.floor(Math.random() * spots.length)]; ISLE.whale = { x: s[0], y: s[1], t: 0 }; ISLE.nextWhale = 50 + Math.random() * 60; }
  if (ISLE.whale) { ISLE.whale.t += dt; drawWhale(ISLE.whale, t); if (ISLE.whale.t > 4.4) ISLE.whale = null; }
  // Ripples breathing round the shore, then the island itself.
  d.lineJoin = 'round';
  strokePath(COAST_PATH, 'rgba(255,255,255,0.1)', 104 + 8 * Math.sin(t * 0.8));
  strokePath(COAST_PATH, 'rgba(255,255,255,0.12)', 82 + 6 * Math.sin(t * 1.3 + 1));
  d.drawImage(ISLE.base, 0, 0, ISLE_W, ISLE_H);
  // Lava glow and smoke from the crater.
  const [crx, cry] = at('fight', 190, 71);
  glow(crx, cry, 26, '255,150,50', 0.25 + 0.15 * Math.sin(t * 2.2));
  if (Math.random() < dt * 1.4) ISLE.puffs.push({ x: crx - 4 + Math.random() * 8, y: cry - 6, r: 4, t: 0, drift: (Math.random() - 0.5) * 6 });
  for (const p of ISLE.puffs) {
    p.t += dt; p.y -= dt * 9; p.r += dt * 4; p.x += dt * (3 + p.drift);
    const a = Math.max(0, 0.7 - p.t * 0.12);
    fillCircle(p.x, p.y, p.r, rad(p.x - p.r * 0.3, p.y - p.r * 0.3, 0, p.r, [[0, `rgba(245,240,250,${a})`], [0.7, `rgba(190,185,205,${a * 0.8})`], [1, 'rgba(160,155,175,0)']]));
  }
  ISLE.puffs = ISLE.puffs.filter(p => p.t < 6);
  // Lanterns at the mine flicker; a boss waiting glows red in the entrance.
  for (const lx of [164, 216]) { const [x, y] = at('fight', lx, 160), on = Math.sin(t * 11 + lx) > -0.2; glow(x, y, 8, '255,204,77', on ? 0.5 : 0.35); fillRR(x - 2, y - 4, 4, 6, 1.5, '#3e3846'); fillRR(x - 1.2, y - 2.5, 2.4, 3.5, 1, on ? '#ffe08a' : '#ff9a3d'); }
  if (typeof bossWaiting === 'function' && bossWaiting()) { const [x, y] = at('fight', 190, 170); glow(x, y, 14, '220,40,60', 0.5 + 0.35 * Math.sin(t * 6)); }
  // Forge furnace glow; smoke from the forge and house chimneys.
  { const [x, y] = at('forge', 100, 280); glow(x, y, 18, '255,160,60', 0.25 + 0.15 * Math.sin(t * 5)); }
  for (const [tab, cx, cy, rate] of [['forge', 150, 190, 1.2], ['bag', 284, 378, 0.6]]) if (Math.random() < dt * rate) { const [x, y] = at(tab, cx, cy); ISLE.puffs.push({ x, y, r: 2.2, t: 2, drift: 2 }); }
  // The temple crystal floats and shines.
  const [cx0, cy0] = at('skills', 248, 222), cy = cy0 + Math.sin(t * 2) * 3;
  glow(cx0, cy + 5, 14, '255,230,140', 0.35 + 0.2 * Math.sin(t * 3));
  const cr = new Path2D(); cr.moveTo(cx0, cy - 6); cr.lineTo(cx0 + 4.5, cy + 3.5); cr.lineTo(cx0, cy + 11.5); cr.lineTo(cx0 - 4.5, cy + 3.5); cr.closePath();
  fillPath(cr, lin(cx0 - 4.5, cy - 6, cx0 + 4.5, cy + 11.5, [[0, '#e8fbff'], [0.5, '#7ad8ff'], [1, '#2f9ad8']]));
  // Lighthouse lamp and its sweeping beam over the sea.
  const b = (Math.sin(t * 0.9) + 1) / 2;
  d.globalAlpha = 0.16; d.fillStyle = '#fff2b0';
  const [lhx, lhy] = at('more', 95, 563);
  d.beginPath(); d.moveTo(lhx, lhy); d.lineTo(-40 + b * 400, 720); d.lineTo(0 + b * 400, 720); d.closePath(); d.fill();
  d.globalAlpha = 1;
  glow(lhx, lhy, 14, '255,240,180', 0.5 + 0.3 * Math.sin(t * 4));
  // Fireflies over the town, a glint on the pond, gulls now and then.
  for (let i = 0; i < 6; i++) { const fx = 150 + Math.sin(t * 0.7 + i * 2) * 60, fy = 380 + Math.cos(t * 0.5 + i * 3) * 90; if (Math.sin(t * 4 + i) > 0.6) glow(fx, fy, 3, '255,246,168', 0.8); }
  if (Math.floor(t * 2) % 2) fillCircle(299, 500, 1, '#ffffff');
  if (Math.random() < dt * 0.05) ISLE.birds.push({ x: -10, y: 30 + Math.random() * 500, v: 22 + Math.random() * 10 });
  for (const bd of ISLE.birds) {
    bd.x += bd.v * dt;
    const w = Math.sin(t * 9 + bd.y) > 0 ? 2 : 0;
    d.strokeStyle = '#ffffff'; d.lineWidth = 1.2; d.beginPath(); d.moveTo(bd.x - 4, bd.y); d.quadraticCurveTo(bd.x - 2, bd.y - w, bd.x, bd.y); d.quadraticCurveTo(bd.x + 2, bd.y - w, bd.x + 4, bd.y); d.stroke();
  }
  ISLE.birds = ISLE.birds.filter(bd => bd.x < ISLE_W + 10);
  // Boats.
  ISLE.nextBoat -= dt;
  if (ISLE.nextBoat <= 0) { spawnBoat(); ISLE.nextBoat = 50 + Math.random() * 60; }
  for (const bt of ISLE.boats) { bt.x += bt.dir * bt.speed * dt; drawBoat(bt, t); }
  ISLE.boats = ISLE.boats.filter(bt => bt.x > -60 && bt.x < ISLE_W + 60);
  // Clouds drift over the open sea at the top and bottom.
  if (!ISLE.clouds.length) ISLE.clouds = [{ x: 20, y: -22, s: 1.1, v: 3, sp: 0 }, { x: 240, y: -30, s: 0.8, v: 2.2, sp: 1 }, { x: 120, y: ISLE_H + 2 + oy / 2, s: 1, v: 2.6, sp: 2 }, { x: 300, y: -8 - oy / 2, s: 0.7, v: 3.4, sp: 1 }];
  d.globalAlpha = 0.6;
  for (const cl of ISLE.clouds) { cl.x += cl.v * dt; if (cl.x > ISLE_W + 60) cl.x = -160; d.drawImage(ISLE.sprites.clouds[cl.sp], cl.x, cl.y, 140 * cl.s, 70 * cl.s); }
  d.globalAlpha = 1;
  for (const p of ISLE.pops) {
    p.t += dt;
    d.globalAlpha = Math.max(0, 1 - p.t / 1.6);
    d.font = '11px "Jersey 10", monospace'; d.textAlign = 'center';
    d.fillStyle = '#1a1220'; d.fillText(p.text, p.x + 1, p.y - p.t * 14 + 1);
    d.fillStyle = p.col; d.fillText(p.text, p.x, p.y - p.t * 14);
    d.globalAlpha = 1;
  }
  ISLE.pops = ISLE.pops.filter(p => p.t < 1.6);
}

// ---------- screen ----------
function islandHtml() {
  let h = '<div class="isle-wrap"><div class="isle" id="isle"><canvas id="islandCv" aria-hidden="true"></canvas>';
  for (const b of BUILDINGS) {
    h += `<button class="bld" data-go="${b.tab}" aria-label="${b.name}"></button>`;
    h += `<button class="sign" data-go="${b.tab}" aria-label="${b.name}">${b.name}<small id="isl-${b.tab}"></small><i class="dot"></i></button>`;
  }
  return h + '</div></div>';
}

function buildIsland() {
  const sec = $('#tab-island');
  if (!sec.childElementCount) {
    sec.innerHTML = islandHtml();
    ISLE.cv = $('#islandCv');
    ISLE.ctx = ISLE.cv.getContext('2d');
    ISLE.sprites.clouds = [cloudSprite(31), cloudSprite(47), cloudSprite(59)];
    // Taps on open water: maybe a boat.
    $('#isle').addEventListener('pointerdown', e => {
      if (e.target.closest('.bld, .sign')) return;
      const r = ISLE.cv.getBoundingClientRect();
      tapBoat(((e.clientX - r.left) / r.width) * ISLE_W, ((e.clientY - r.top) / r.height) * ISLE.h - ISLE.oy);
    });
  }
  sizeIsland();
  updateIslandSigns();
  updateBadges();
}

// Fit the island's width (or its height on a wide screen), let the sea fill what's left, and paint
// at the screen's real resolution.
function sizeIsland() {
  const wrap = $('#tab-island .isle-wrap'), isle = $('#isle');
  if (!wrap || !isle || UI.tab !== 'island') return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  const w = Math.min(W, (H * ISLE_W) / ISLE_H);
  ISLE.h = Math.max(ISLE_H, Math.round((H / w) * ISLE_W));
  ISLE.oy = Math.floor((ISLE.h - ISLE_H) / 2);
  isle.style.width = w + 'px';
  isle.style.height = (w * ISLE.h) / ISLE_W + 'px';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  ISLE.k = (w * dpr) / ISLE_W;
  ISLE.cv.width = Math.ceil(ISLE_W * ISLE.k);
  ISLE.cv.height = Math.ceil(ISLE.h * ISLE.k);
  if (Math.abs(ISLE.k - ISLE.baseK) > 0.01) { ISLE.baseK = ISLE.k; ISLE.base = islandBase(); }
  for (const b of BUILDINGS) {
    const el = $(`.bld[data-go="${b.tab}"]`), sg = $(`.sign[data-go="${b.tab}"]`), bx = boxOf(b);
    if (el) el.setAttribute('style', `left:${(bx.x / ISLE_W) * 100}%;top:${((bx.y + ISLE.oy) / ISLE.h) * 100}%;width:${(bx.w / ISLE_W) * 100}%;height:${(bx.h / ISLE.h) * 100}%`);
    const [lx, ly] = plaqueOf(b);
    if (sg) sg.setAttribute('style', `left:${(lx / ISLE_W) * 100}%;top:${((ly + ISLE.oy) / ISLE.h) * 100}%`);
  }
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
