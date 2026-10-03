'use strict';
// Version 2 home screen: an island instead of a tab bar, laid out from the "island v1" sketch.
// The mountain with the cave sits at the top; a path winds down through town past the forge,
// the skill temple, the market, the house, the quest board and the lighthouse to the dock, with
// a curved spur to every door. Detailed pixel art drawn at 360x640 island pixels and scaled up
// crisp; everything that stands up gets a dark outline, like the game's sprites. The buildings
// are plain buttons on top, so they work with screen readers and never miss a tap.

const ISLE_W = 360;
const ISLE_H = 640;
const ISLE = { cv: null, ctx: null, k: 0, t: 0, raf: 0, smoke: [], h: ISLE_H, oy: 0, boats: [], nextBoat: 20, pops: [], birds: [], outlines: true };

// Where each building sits, in island pixels: the tap area, exactly the drawn building. Its sign
// hangs below it, so a building needs about 22 px of clear ground under it.
const BUILDINGS = [
  { tab: 'fight', name: 'Cave', x: 150, y: 128, w: 88, h: 62 },
  { tab: 'forge', name: 'Forge', x: 80, y: 212, w: 96, h: 92 },
  { tab: 'skills', name: 'Temple', x: 206, y: 248, w: 92, h: 112 },
  { tab: 'cases', name: 'Market', x: 80, y: 376, w: 110, h: 66 },
  { tab: 'bag', name: 'House', x: 217, y: 394, w: 104, h: 88 },
  { tab: 'quests', name: 'Quests', x: 172, y: 506, w: 86, h: 70 },
  { tab: 'more', name: 'Lighthouse', x: 96, y: 530, w: 60, h: 88 },
  { tab: 'dock', name: 'Dock', x: 4, y: 504, w: 72, h: 56 },
];

// The coastline, traced from the sketch (island pixels), smoothed into curves.
const COAST = [[165, 47], [215, 55], [260, 62], [285, 80], [300, 115], [292, 160], [285, 200], [300, 235], [322, 270],
  [320, 320], [325, 380], [350, 450], [345, 505], [325, 550], [280, 580], [215, 600], [150, 630], [80, 628], [55, 580],
  [50, 510], [62, 445], [55, 400], [35, 360], [30, 300], [55, 260], [70, 210], [70, 165], [80, 120], [110, 70]];
// The main path from the cave to the dock, and a spur from it to each door.
const PATH = [[194, 190], [192, 222], [188, 256], [184, 290], [176, 322], [174, 352], [184, 384], [200, 412], [206, 440],
  [198, 466], [180, 488], [152, 506], [120, 520], [96, 530], [78, 534]];
const SPURS = [
  [[187, 272], [168, 302], [146, 310]], // forge door
  [[176, 348], [214, 368], [252, 366]], // temple steps
  [[191, 398], [158, 438], [128, 446]], // market counter
  [[205, 436], [238, 482], [270, 488]], // house door
  [[164, 502], [160, 548], [190, 584], [216, 584]], // round the quest board to its front
  [[110, 526], [100, 566], [110, 604]], // lighthouse
];
const PALMS = [[280, 126], [86, 176], [112, 118], [304, 262], [40, 318], [334, 428], [300, 540], [62, 478]];
const BUSHES = [[268, 240, 1], [60, 250, 0.9], [306, 372, 1], [60, 420, 0.9], [156, 478, 0.8], [322, 496, 1], [272, 556, 0.9], [130, 205, 0.8]];
const ROCKS = [[60, 590], [268, 200], [275, 520], [50, 476]];
// Ground shadows under everything that stands up: [cx, cy, rx, ry].
const SHADOWS = [[196, 188, 80, 12], [128, 306, 46, 8], [252, 362, 50, 9], [128, 442, 48, 8], [269, 486, 54, 9], [216, 578, 40, 6], [126, 620, 30, 8]];

// ---------- drawing helpers ----------
function g() { return ISLE.ctx; }
function ip(x, y, w, h, c) { const d = g(); d.fillStyle = c; d.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function iell(cx, cy, rx, ry, c) {
  const d = g(); d.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    d.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}
function irng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// Catmull-Rom through the points, as one closed (or open) path.
function smoothPath(pts, closed) {
  const p = new Path2D(), n = pts.length, at = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  if (closed) p.closePath();
  return p;
}
const COAST_PATH = smoothPath(COAST, true);
function shadow(cx, cy, rx, ry) { iell(cx, cy, rx, ry, 'rgba(20, 40, 20, 0.28)'); }

// Draw something on its own layer, snap its edges to whole pixels and trace a dark outline round
// it (the look of the game's sprites), then lay it on the base.
function outlined(draw) {
  if (!ISLE.outlines) { draw(); return; }
  const c = makeCanvas(ISLE_W, ISLE_H), prev = ISLE.ctx;
  ISLE.ctx = c.getContext('2d');
  draw();
  const d = ISLE.ctx, img = d.getImageData(0, 0, ISLE_W, ISLE_H), a = img.data, W = ISLE_W, n = W * ISLE_H;
  const solid = new Uint8Array(n);
  for (let p = 0; p < n; p++) { const i = p * 4 + 3; a[i] = a[i] >= 110 ? 255 : 0; solid[p] = a[i] ? 1 : 0; }
  for (let p = 0; p < n; p++) {
    if (solid[p]) continue;
    const x = p % W;
    if ((x > 0 && solid[p - 1]) || (x < W - 1 && solid[p + 1]) || (p >= W && solid[p - W]) || (p + W < n && solid[p + W])) {
      const i = p * 4; a[i] = 0x1a; a[i + 1] = 0x12; a[i + 2] = 0x20; a[i + 3] = 255;
    }
  }
  d.putImageData(img, 0, 0);
  ISLE.ctx = prev;
  g().drawImage(c, 0, 0);
}

// ---------- the still layer: ground, path, trees and buildings, drawn once ----------
function islandBase() {
  const c = makeCanvas(ISLE_W, ISLE_H);
  const prev = ISLE.ctx;
  ISLE.ctx = c.getContext('2d');
  const d = g(), r = irng(11);
  d.lineJoin = 'round'; d.lineCap = 'round';
  // Shallows round the island, then the beach, then grass.
  d.strokeStyle = 'rgba(90, 220, 215, 0.42)'; d.lineWidth = 46; d.stroke(COAST_PATH);
  d.strokeStyle = 'rgba(150, 240, 230, 0.5)'; d.lineWidth = 28; d.stroke(COAST_PATH);
  d.fillStyle = '#58b04a'; d.fill(COAST_PATH);
  d.strokeStyle = '#8f6f3c'; d.lineWidth = 21; d.stroke(COAST_PATH); // a dark wet line at the water
  d.strokeStyle = '#c99d5d'; d.lineWidth = 19; d.stroke(COAST_PATH);
  d.strokeStyle = '#ecd29a'; d.lineWidth = 15; d.stroke(COAST_PATH);
  d.strokeStyle = '#f6e3b4'; d.lineWidth = 6; d.stroke(COAST_PATH);
  d.save();
  d.clip(COAST_PATH);
  const shade = d.createLinearGradient(0, 40, 0, 640);
  shade.addColorStop(0, 'rgba(255,255,200,0.08)'); shade.addColorStop(1, 'rgba(0,40,20,0.18)');
  d.fillStyle = shade; d.fillRect(0, 0, ISLE_W, ISLE_H);
  d.strokeStyle = '#4c9a40'; d.lineWidth = 36; d.stroke(COAST_PATH); // grass darkens toward the dune
  d.strokeStyle = '#8a6a3a'; d.lineWidth = 17; d.stroke(COAST_PATH); // a dark line where grass meets sand
  d.strokeStyle = '#ecd29a'; d.lineWidth = 15; d.stroke(COAST_PATH);
  d.strokeStyle = '#f6e3b4'; d.lineWidth = 6; d.stroke(COAST_PATH);
  for (let i = 0; i < 900; i++) {
    const x = r() * ISLE_W, y = 40 + r() * 600;
    if (!d.isPointInPath(COAST_PATH, x, y)) continue;
    const k = r();
    ip(x, y, k < 0.5 ? 2 : 1, 1, k < 0.33 ? '#469238' : k < 0.66 ? '#6cc257' : '#7fd166');
  }
  for (let i = 0; i < 70; i++) { // tufts
    const x = 50 + r() * 290, y = 60 + r() * 560;
    ip(x, y, 1, 3, '#3d8a33'); ip(x + 2, y - 1, 1, 4, '#4a9c3c'); ip(x + 4, y, 1, 3, '#3d8a33');
  }
  for (let i = 0; i < 46; i++) { // flowers
    const x = 50 + r() * 290, y = 80 + r() * 540;
    const col = ['#fff6e0', '#ffd94d', '#ff8fb1', '#b9a2ff'][Math.floor(r() * 4)];
    ip(x, y, 2, 2, col); ip(x + 0.5, y + 2, 1, 1, '#2f6e2a');
  }
  d.restore();

  drawTownPath();
  // Shadows under everything that stands up, then the things themselves, each with an outline.
  for (const [x, y, rx, ry] of SHADOWS) shadow(x, y, rx, ry);
  for (const [x, y] of PALMS) shadow(x + 6, y + 1, 9, 3);
  for (const [x, y, s] of BUSHES) shadow(x + 3, y + 8 * s, 13 * s, 4 * s);
  for (const [x, y] of ROCKS) shadow(x + 2, y + 4, 9, 3);
  outlined(drawMountain);
  outlined(() => {
    const pr = irng(23);
    for (const [x, y] of PALMS) palm(x, y, pr);
    for (const [x, y, s] of BUSHES) bush(x, y, s);
    for (const [x, y] of ROCKS) rock(x, y);
  });
  outlined(drawForge); outlined(drawTemple); outlined(drawMarket); outlined(drawHouse);
  outlined(drawBoard); outlined(drawLighthouse); outlined(drawDock);
  ISLE.ctx = prev;
  return c;
}

function drawTownPath() {
  const d = g();
  const lay = (p, w) => {
    d.strokeStyle = '#6e4e2a'; d.lineWidth = w + 4; d.stroke(p); // dark edge
    d.strokeStyle = '#b8905a'; d.lineWidth = w; d.stroke(p);
    d.strokeStyle = '#d9b878'; d.lineWidth = Math.max(2, w - 6); d.stroke(p);
  };
  for (const s of SPURS) lay(smoothPath(s, false), 9);
  lay(smoothPath(PATH, false), 13);
  const r = irng(5);
  for (let i = 0; i < 90; i++) { // pebbles along the main path
    const j = Math.floor(r() * (PATH.length - 1)), t = r(), a = PATH[j], b = PATH[j + 1];
    ip(a[0] + (b[0] - a[0]) * t + (r() - 0.5) * 8, a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 6, 2, 1, r() < 0.5 ? '#9c7748' : '#e8cc96');
  }
}

function drawMountain() {
  const d = g();
  // Rock body: a lit west face and a shadowed east face, with moss and ledges.
  const body = new Path2D();
  body.moveTo(108, 188); body.lineTo(124, 140); body.lineTo(146, 118); body.lineTo(160, 86); body.lineTo(178, 74); body.lineTo(192, 58);
  body.lineTo(206, 70); body.lineTo(222, 66); body.lineTo(240, 92); body.lineTo(256, 120); body.lineTo(270, 150); body.lineTo(282, 188); body.closePath();
  d.fillStyle = '#5d5466'; d.fill(body);
  const west = new Path2D();
  west.moveTo(108, 188); west.lineTo(124, 140); west.lineTo(146, 118); west.lineTo(160, 86); west.lineTo(178, 74); west.lineTo(192, 58);
  west.lineTo(196, 100); west.lineTo(184, 140); west.lineTo(176, 188); west.closePath();
  d.fillStyle = '#847a8f'; d.fill(west);
  const lit = new Path2D();
  lit.moveTo(128, 150); lit.lineTo(148, 122); lit.lineTo(162, 92); lit.lineTo(180, 78); lit.lineTo(170, 112); lit.lineTo(152, 140); lit.closePath();
  d.fillStyle = '#a39aad'; d.fill(lit);
  const east = new Path2D();
  east.moveTo(222, 66); east.lineTo(240, 92); east.lineTo(256, 120); east.lineTo(270, 150); east.lineTo(282, 188); east.lineTo(236, 188); east.lineTo(232, 130); east.closePath();
  d.fillStyle = '#463e50'; d.fill(east);
  // Peak glints, cracks and ledges.
  ip(189, 60, 6, 3, '#d8d0e2'); ip(186, 63, 4, 2, '#c4bbd0'); ip(205, 71, 5, 2, '#c4bbd0'); ip(220, 68, 4, 2, '#b4abc0');
  for (const [x, y, l] of [[150, 150, 10], [212, 110, 12], [246, 140, 9], [170, 120, 7], [230, 168, 8], [136, 170, 6]]) for (let i = 0; i < l; i++) ip(x + i * 0.6, y + i, 1, 1, '#3a3344');
  for (const [x, y, w] of [[126, 158, 16], [142, 132, 10], [238, 124, 10], [258, 154, 12]]) { ip(x, y, w, 2, '#3a3344'); ip(x, y - 1, w, 1, '#a39aad'); }
  const mr = irng(9);
  for (const [x, y, n] of [[124, 176, 5], [150, 148, 3], [252, 168, 4], [230, 140, 2], [140, 184, 4], [250, 184, 4], [172, 104, 2], [214, 96, 2]]) {
    for (let i = 0; i < n; i++) {
      const mx = x + (mr() - 0.5) * 22, my = y + (mr() - 0.5) * 6;
      iell(mx, my, 3 + mr() * 3, 1 + mr() * 1.5, mr() < 0.5 ? '#4f9a42' : '#3f8a36');
      ip(mx - 1, my - 1, 2, 1, '#6cc257');
    }
  }
  // Cave mouth with a timber frame, rails and a sign plank.
  iell(194, 168, 20, 18, '#1a1220');
  ip(174, 168, 40, 20, '#1a1220');
  iell(194, 170, 15, 14, '#0c0810');
  ip(179, 170, 30, 18, '#0c0810');
  ip(170, 152, 5, 36, '#7a5230'); ip(213, 152, 5, 36, '#7a5230');
  ip(171, 152, 2, 36, '#9a6c40'); ip(214, 152, 2, 36, '#9a6c40');
  ip(166, 148, 56, 6, '#6b4526'); ip(166, 148, 56, 2, '#9a6c40');
  ip(184, 140, 20, 9, '#8a5a2a'); ip(185, 141, 18, 7, '#b07a3a');
  ip(188, 143, 3, 3, '#5a3a1a'); ip(193, 143, 3, 3, '#5a3a1a'); ip(198, 143, 3, 3, '#5a3a1a');
  for (let y = 172; y < 196; y += 4) ip(184, y, 20, 2, '#5d4027');
  ip(185, 170, 2, 28, '#9aa0a8'); ip(201, 170, 2, 28, '#9aa0a8');
}

function palm(x, y, r) {
  const lean = r() < 0.5 ? -1 : 1;
  for (let i = 0; i < 22; i++) {
    const ox = Math.round(lean * (i * i) / 70);
    ip(x + ox, y - i, 3, 1, i % 4 === 0 ? '#5e3d22' : '#8a6038');
    ip(x + ox + 2, y - i, 1, 1, '#5e3d22');
  }
  const tx = x + Math.round(lean * 7) + 1, ty = y - 22;
  const leaf = (dx, dy, len, col) => { for (let i = 0; i < len; i++) ip(tx + dx * i, ty + dy * i + (i * i) / 9, 3, 2, col); };
  leaf(1, -0.6, 12, '#2f7d3a'); leaf(-1, -0.6, 12, '#2f7d3a');
  leaf(1, 0.2, 11, '#3c9244'); leaf(-1, 0.2, 11, '#3c9244');
  leaf(0.6, -1, 8, '#4fae4a'); leaf(-0.6, -1, 8, '#4fae4a');
  ip(tx - 2, ty - 1, 6, 4, '#3c9244');
  ip(tx - 1, ty + 2, 3, 3, '#6b3d1e'); ip(tx + 2, ty + 2, 3, 3, '#5a3218');
}

function bush(x, y, s = 1) {
  iell(x, y, 12 * s, 9 * s, '#2f7d3a');
  iell(x - 5 * s, y - 3 * s, 7 * s, 6 * s, '#3c9244');
  iell(x + 5 * s, y - 4 * s, 7 * s, 6 * s, '#469e47');
  iell(x - 2 * s, y - 6 * s, 5 * s, 4 * s, '#5cb853');
  ip(x - 4 * s, y - 2 * s, 2, 2, '#ff6b7d'); ip(x + 4 * s, y - 5 * s, 2, 2, '#ff6b7d');
}

function rock(x, y) {
  iell(x, y, 8, 6, '#6b6273'); iell(x - 2, y - 2, 5, 3, '#8a8194'); ip(x - 3, y - 4, 3, 1, '#a39aad');
}

// A pixel wall: base color, lighter top edge, darker base, optional horizontal lines.
function wall(x, y, w, h, base, light, dark, lines) {
  ip(x, y, w, h, base); ip(x, y, w, 1, light); ip(x, y + h - 2, w, 2, dark);
  if (lines) for (let yy = y + 4; yy < y + h - 2; yy += 4) ip(x, yy, w, 1, lines);
}
function window2(x, y, lit = true) {
  ip(x - 1, y - 1, 10, 10, '#3a2416');
  ip(x, y, 8, 8, lit ? '#ffe08a' : '#3a5a7a');
  ip(x, y, 8, 3, lit ? '#fff2b8' : '#5a7a9a');
  ip(x + 3, y, 2, 8, '#3a2416'); ip(x, y + 3, 8, 2, '#3a2416');
}

function drawForge() {
  // Stone ground floor, timber upper floor, red tile roof, smoking chimney.
  const r = irng(3);
  wall(88, 264, 80, 40, '#837a8c', '#a39aad', '#5d5466', null);
  for (let yy = 266; yy < 302; yy += 6) for (let xx = 88 + ((yy / 6) % 2) * 6; xx < 166; xx += 12) ip(xx, yy, 10, 5, r() < 0.5 ? '#8f8698' : '#776e80');
  wall(92, 246, 72, 20, '#a36a3a', '#c4844a', '#7a4a24', null);
  for (let xx = 94; xx < 164; xx += 12) ip(xx, 246, 3, 20, '#6e4520');
  ip(92, 254, 72, 2, '#6e4520');
  for (let i = 0; i < 18; i++) {
    const w = 96 - i * 4.4;
    ip(128 - w / 2, 246 - i, w, 1, i % 3 === 0 ? '#8a2f2a' : i % 3 === 1 ? '#b8443a' : '#a33a32');
  }
  ip(112, 228, 32, 2, '#7a2a24');
  wall(146, 214, 12, 30, '#6b6273', '#8a8194', '#4d4655', '#5d5466');
  ip(144, 212, 16, 4, '#4d4655');
  // Glowing forge mouth, door and anvil.
  ip(100, 278, 26, 24, '#2a1a12'); iell(113, 278, 13, 6, '#2a1a12');
  ip(103, 282, 20, 20, '#ff7a2a'); ip(106, 286, 14, 16, '#ffb03d'); ip(109, 292, 8, 10, '#ffe08a');
  ip(136, 280, 16, 22, '#4a2c16'); ip(138, 282, 12, 20, '#6b4526'); ip(147, 292, 2, 2, '#ffcc4d');
  ip(158, 296, 14, 4, '#3e3846'); ip(161, 300, 8, 4, '#3e3846'); ip(158, 296, 14, 1, '#6b6273');
  ip(108, 250, 9, 8, '#ffe08a'); ip(140, 250, 9, 8, '#ffe08a');
  ip(111, 250, 2, 8, '#6e4520'); ip(143, 250, 2, 8, '#6e4520');
}

function drawTemple() {
  // A golden skill temple: stepped plinth, pale columns, gold roof (the crystal floats above it).
  ip(206, 352, 92, 8, '#b8aa8a'); ip(206, 352, 92, 2, '#d8cca8'); ip(212, 344, 80, 8, '#c8baa0'); ip(212, 344, 80, 2, '#e4d8b8');
  wall(218, 300, 68, 44, '#efe6d0', '#fffaf0', '#cfc2a4', null);
  for (const xx of [220, 236, 262, 278]) { ip(xx, 300, 6, 44, '#fffaf0'); ip(xx + 4, 300, 2, 44, '#d8ccae'); ip(xx - 1, 300, 8, 3, '#e4d8b8'); ip(xx - 1, 341, 8, 3, '#e4d8b8'); }
  ip(244, 312, 16, 32, '#3a2a10'); iell(252, 312, 8, 6, '#3a2a10'); ip(246, 314, 12, 30, '#6a4a1a');
  for (let i = 0; i < 20; i++) {
    const w = 84 - i * 4;
    ip(252 - w / 2, 300 - i, w, 1, i % 4 === 0 ? '#c8901a' : i < 3 ? '#a87010' : '#ffcc4d');
  }
  ip(210, 298, 84, 3, '#a87010');
}

function drawMarket() {
  // A blue market with a striped awning and stacked chests (cases).
  wall(86, 392, 84, 46, '#3f7fb8', '#5a9ad0', '#2c5f8c', '#3a74a8');
  for (let i = 0; i < 14; i++) {
    const w = 96 - i * 3;
    ip(128 - w / 2, 392 - i, w, 1, i % 2 ? '#2c5f8c' : '#356ea0');
  }
  for (let s = 0; s < 8; s++) {
    ip(82 + s * 11.5, 396, 11.5, 14, s % 2 ? '#f2f6ff' : '#4a9ae0');
    iell(88 + s * 11.5, 410, 5, 3, s % 2 ? '#f2f6ff' : '#4a9ae0');
  }
  ip(82, 396, 92, 2, '#2c5f8c');
  ip(94, 414, 68, 24, '#1f3550');
  const chest = (x, y, top, body) => { ip(x, y, 16, 12, '#3a2416'); ip(x + 1, y + 1, 14, 10, body); ip(x + 1, y + 1, 14, 4, top); ip(x + 7, y + 5, 2, 3, '#ffe08a'); };
  chest(100, 422, '#b07a3a', '#8a5a2a'); chest(120, 420, '#5aa0e0', '#3a74a8'); chest(140, 422, '#e0566b', '#b03a4e');
  chest(172, 428, '#ffcc4d', '#c8901a');
}

function drawHouse() {
  // A red-roofed cottage with lit windows (your bag lives here).
  wall(226, 430, 86, 52, '#e8dcc6', '#fffaf0', '#c4b6a0', null);
  for (let xx = 226; xx < 312; xx += 14) ip(xx, 430, 2, 52, '#d6c8b0');
  ip(226, 456, 86, 3, '#a36a3a');
  for (let i = 0; i < 26; i++) {
    const w = 104 - i * 4;
    ip(269 - w / 2, 430 - i, w, 1, i % 3 === 0 ? '#a8303a' : i % 3 === 1 ? '#e0566b' : '#c83f4c');
  }
  ip(252, 408, 34, 2, '#8a2430');
  wall(290, 396, 10, 20, '#a36a3a', '#c4844a', '#7a4a24', null); ip(288, 394, 14, 3, '#7a4a24');
  window2(238, 436); window2(292, 436);
  ip(262, 460, 16, 22, '#5a3218'); ip(264, 462, 12, 20, '#7a4a24'); ip(274, 472, 2, 2, '#ffcc4d');
  ip(260, 458, 20, 3, '#a8303a');
  ip(238, 466, 12, 6, '#5e3d22'); ip(239, 464, 10, 3, '#4fae4a'); ip(241, 463, 2, 2, '#ff8fb1'); ip(245, 463, 2, 2, '#ffd94d');
}

function drawBoard() {
  // A quest board on posts, with lanterns and pinned notes.
  ip(184, 544, 4, 32, '#5e3d22'); ip(244, 544, 4, 32, '#5e3d22');
  ip(178, 514, 76, 36, '#8a5a2a'); ip(180, 516, 72, 32, '#c88a4a'); ip(180, 516, 72, 2, '#e0a868');
  ip(174, 510, 84, 5, '#ff9a3d'); ip(174, 510, 84, 2, '#ffbe6a'); ip(178, 506, 76, 4, '#d0702a');
  const note = (x, y, w, h, c) => { ip(x, y, w, h, c); ip(x + 2, y + 3, w - 4, 1, '#8a7a6a'); ip(x + 2, y + 6, w - 6, 1, '#8a7a6a'); ip(x + w / 2 - 1, y - 1, 2, 2, '#e0566b'); };
  note(184, 520, 16, 20, '#fff8e8'); note(204, 522, 14, 16, '#ffe8a8'); note(222, 519, 18, 22, '#fff8e8'); note(243, 523, 8, 12, '#d8f0ff');
  for (const x of [172, 256]) { ip(x, 530, 4, 18, '#5e3d22'); ip(x - 2, 522, 8, 9, '#3e3846'); ip(x - 1, 523, 6, 7, '#ffcc4d'); }
}

function drawLighthouse() {
  // A purple-and-white lighthouse on rocks at the south tip.
  iell(126, 612, 28, 7, '#5d5466'); iell(118, 609, 14, 5, '#7d7486'); iell(138, 615, 10, 4, '#4d4655');
  for (let i = 0; i < 44; i++) {
    const w = 26 - Math.floor(i / 6);
    const col = Math.floor(i / 10) % 2 ? '#b76dff' : '#f6f0ff';
    ip(126 - w / 2, 602 - i, w, 1, col);
    ip(126 + w / 2 - 3, 602 - i, 3, 1, Math.floor(i / 10) % 2 ? '#8a4fc8' : '#d6cce8');
  }
  ip(112, 555, 28, 4, '#3e3846');
  ip(116, 545, 20, 10, '#3e3846'); ip(118, 547, 16, 8, '#ffe08a'); ip(118, 547, 16, 3, '#fff6c8');
  ip(121, 547, 2, 8, '#3e3846'); ip(129, 547, 2, 8, '#3e3846');
  for (let i = 0; i < 8; i++) ip(118 + i, 544 - i, 16 - i * 2, 1, '#8a4fc8');
  ip(125, 533, 2, 4, '#3e3846');
  ip(121, 590, 10, 12, '#3a2a4a'); ip(123, 592, 6, 10, '#5a3a8a');
}

function drawDock() {
  // A wooden pier into the sea with a moored boat. New islands: coming soon.
  for (let x = 8; x < 76; x += 12) ip(x, 536, 3, 22, '#4a2c16');
  ip(4, 526, 74, 14, '#8a5a2a');
  for (let x = 4; x < 78; x += 6) { ip(x, 526, 5, 14, '#a36a3a'); ip(x, 526, 5, 1, '#c4844a'); }
  ip(4, 538, 74, 2, '#5e3d22');
  ip(10, 512, 2, 14, '#5e3d22'); ip(6, 506, 22, 8, '#e8dcc6'); ip(7, 507, 20, 6, '#f6f0e4');
  ip(9, 509, 16, 1, '#8a7a6a'); ip(9, 511, 12, 1, '#8a7a6a');
  ip(16, 548, 30, 6, '#6b4526'); ip(18, 554, 26, 3, '#4a2c16'); ip(16, 548, 30, 2, '#a36a3a'); ip(22, 550, 18, 2, '#3a2416');
}

// ---------- boats: tap one as it sails by for coins (or now and then a key) ----------
function boatReward() {
  const rate = Math.max(1, idleRates().coins / Math.max(1, ST.boost)); // coins per second, before the 2x boost
  if (Math.random() < 0.12) return { keys: 1 };
  return { coins: rate * 45 * (0.8 + Math.random() * 0.5) };
}
function spawnBoat() {
  const lanes = [24];
  if (ISLE.oy > 30) lanes.push(-ISLE.oy / 2, ISLE_H + ISLE.oy / 2 - 10);
  const dir = Math.random() < 0.5 ? 1 : -1;
  ISLE.boats.push({ x: dir > 0 ? -40 : ISLE_W + 40, y: lanes[Math.floor(Math.random() * lanes.length)], dir, speed: 14 + Math.random() * 6, got: false, bob: Math.random() * 6 });
}
function drawBoat(b, t) {
  const x = Math.round(b.x), y = Math.round(b.y + Math.sin(t * 2 + b.bob) * 1.2), f = b.dir;
  for (let i = 1; i < 6; i++) ip(x - f * (12 + i * 5), y + 9 + (i % 2), 4, 1, `rgba(220,245,255,${0.5 - i * 0.08})`);
  ip(x - 14, y + 5, 28, 7, '#1a1220');
  ip(x - 13, y + 6, 26, 5, '#6b4526'); ip(x - 11, y + 11, 22, 2, '#4a2c16'); ip(x - 13, y + 6, 26, 1, '#a36a3a');
  ip(x - 1, y - 16, 2, 22, '#5e3d22');
  for (let i = 0; i < 16; i++) ip(f > 0 ? x + 1 : x - 1 - (12 - Math.floor(i * 0.7)), y - 15 + i, 12 - Math.floor(i * 0.7), 1, b.got ? '#d8d0c0' : i < 3 ? '#ffffff' : '#f2ece0');
  if (!b.got) { ip(x + f * 3, y - 19, f * 6, 3, '#e0566b'); if (Math.floor(t * 3) % 2) ip(x - 2, y - 24, 4, 4, '#ffcc4d'); }
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

// ---------- the moving layer: sea, foam, smoke, lights, boats, birds ----------
function drawIsland(dt) {
  if (!ISLE.ctx) return;
  ISLE.t += dt;
  const t = ISLE.t, d = ISLE.ctx, H = ISLE.h, oy = ISLE.oy;
  d.setTransform(ISLE.k, 0, 0, ISLE.k, 0, 0);
  d.imageSmoothingEnabled = false;
  const sea = d.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#1a7fb0'); sea.addColorStop(0.5, '#1670a3'); sea.addColorStop(1, '#0f5a88');
  d.fillStyle = sea;
  d.fillRect(0, 0, ISLE_W, H);
  // Rolling swell: soft bands drifting down, then wave crests and sun glints.
  for (let y = -40; y < H + 40; y += 40) {
    const yy = y + ((t * 6) % 40);
    d.fillStyle = 'rgba(40,150,200,0.25)'; d.fillRect(0, Math.round(yy), ISLE_W, 14);
  }
  for (let i = 0; i < 160 * H / ISLE_H; i++) {
    const y = (i * 29.3) % H, sp = 5 + (i % 4) * 2;
    const x = ((i * 71.7 + t * sp) % (ISLE_W + 30)) - 15;
    const a = 0.25 + 0.25 * Math.sin(t * 1.6 + i);
    d.fillStyle = `rgba(190,235,255,${a})`;
    d.fillRect(Math.round(x), Math.round(y + Math.sin(t + i) * 1.5), 4 + (i % 3) * 2, 1);
  }
  for (let i = 0; i < 24; i++) if (Math.sin(t * 3 + i * 7.3) > 0.92) ip((i * 97) % ISLE_W, (i * 53 + 20) % H, 2, 2, '#ffffff');
  // The island and its foam ring.
  d.setTransform(ISLE.k, 0, 0, ISLE.k, 0, oy * ISLE.k);
  d.lineJoin = 'round';
  d.strokeStyle = `rgba(255,255,255,${0.32 + 0.12 * Math.sin(t * 1.4)})`;
  d.lineWidth = 52 + 5 * Math.sin(t * 1.1);
  d.stroke(COAST_PATH);
  d.strokeStyle = 'rgba(26,127,176,0.9)'; d.lineWidth = 46; d.stroke(COAST_PATH);
  d.drawImage(ISLE.base, 0, 0);
  // Lanterns at the cave flicker.
  for (const [x, y] of [[166, 158], [222, 158]]) { const on = Math.sin(t * 11 + x) > -0.2; ip(x - 2, y, 4, 5, on ? '#ffcc4d' : '#ff9a3d'); ip(x - 1, y - 2, 2, 2, '#3e3846'); }
  // Boss waiting: the cave mouth glows red.
  if (typeof bossWaiting === 'function' && bossWaiting()) { d.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6); iell(194, 176, 13, 10, '#c0283c'); d.globalAlpha = 1; }
  // Forge glow pulses; smoke from the forge and the house chimney.
  d.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5); iell(113, 300, 18, 6, '#ffb03d'); d.globalAlpha = 1;
  for (const [cx, cy, rate] of [[152, 210, 4], [295, 392, 1.5]]) if (Math.random() < dt * rate) ISLE.smoke.push({ x: cx + Math.random() * 3, y: cy, t: 0 });
  for (const s of ISLE.smoke) {
    s.t += dt; s.y -= dt * 9; s.x += dt * 4 + Math.sin(s.t * 2) * 0.2;
    const a = Math.max(0, 0.6 - s.t * 0.14), z = 3 + s.t * 1.6;
    d.fillStyle = `rgba(225,222,232,${a})`; d.fillRect(Math.round(s.x - z / 2), Math.round(s.y - z / 2), Math.round(z), Math.round(z));
  }
  ISLE.smoke = ISLE.smoke.filter(s => s.t < 4.5);
  // The temple crystal floats and shines.
  const cy = 262 + Math.sin(t * 2) * 3;
  d.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3); iell(252, cy + 6, 12, 10, '#ffe08a'); d.globalAlpha = 1;
  ip(248, cy - 1, 8, 14, '#1a1220');
  ip(249, cy, 6, 12, '#7ad8ff'); ip(250, cy - 2, 4, 2, '#bfefff'); ip(250, cy + 12, 4, 2, '#3aa0d8'); ip(250, cy + 1, 2, 6, '#e8fbff');
  // Lighthouse lamp and its sweeping beam over the sea.
  const b = (Math.sin(t * 0.9) + 1) / 2;
  d.globalAlpha = 0.16;
  d.fillStyle = '#fff2b0';
  d.beginPath(); d.moveTo(126, 551); d.lineTo(-20 + b * 360, 700); d.lineTo(20 + b * 360, 700); d.closePath(); d.fill();
  d.globalAlpha = 0.5 + 0.3 * Math.sin(t * 4); iell(126, 551, 9, 7, '#fff6c8'); d.globalAlpha = 1;
  // Fireflies drift over the town.
  for (let i = 0; i < 6; i++) { const fx = 150 + Math.sin(t * 0.7 + i * 2) * 60, fy = 380 + Math.cos(t * 0.5 + i * 3) * 90; if (Math.sin(t * 4 + i) > 0.6) ip(fx, fy, 1, 1, '#fff6a8'); }
  // Gulls glide across now and then.
  if (Math.random() < dt * 0.05) ISLE.birds.push({ x: -10, y: 30 + Math.random() * 500, v: 22 + Math.random() * 10 });
  for (const bd of ISLE.birds) { bd.x += bd.v * dt; const w = Math.sin(t * 9 + bd.y) > 0; ip(bd.x, bd.y, 2, 1, '#ffffff'); ip(bd.x - 3, bd.y - (w ? 1 : 0), 3, 1, '#ffffff'); ip(bd.x + 2, bd.y - (w ? 1 : 0), 3, 1, '#ffffff'); }
  ISLE.birds = ISLE.birds.filter(bd => bd.x < ISLE_W + 10);
  // Boats.
  ISLE.nextBoat -= dt;
  if (ISLE.nextBoat <= 0) { spawnBoat(); ISLE.nextBoat = 50 + Math.random() * 60; }
  for (const bt of ISLE.boats) { bt.x += bt.dir * bt.speed * dt; drawBoat(bt, t); }
  ISLE.boats = ISLE.boats.filter(bt => bt.x > -60 && bt.x < ISLE_W + 60);
  for (const p of ISLE.pops) {
    p.t += dt;
    d.globalAlpha = Math.max(0, 1 - p.t / 1.6);
    d.font = '10px "Jersey 10", monospace'; d.textAlign = 'center';
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
    // Taps on open water: maybe a boat.
    $('#isle').addEventListener('pointerdown', e => {
      if (e.target.closest('.bld')) return;
      const r = ISLE.cv.getBoundingClientRect();
      tapBoat(((e.clientX - r.left) / r.width) * ISLE_W, ((e.clientY - r.top) / r.height) * ISLE.h - ISLE.oy);
    });
  }
  sizeIsland();
  updateIslandSigns();
  updateBadges();
}

// Fit the island's width (or its height on a wide screen), then let the sea fill what's left.
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
