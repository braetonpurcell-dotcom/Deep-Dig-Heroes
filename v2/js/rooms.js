'use strict';
// Version 2 building interiors. Each screen you open from the world gets its own pixel-art room
// behind it: the house, the market, the forge, the temple, the quest board and the study (settings).
// The room is painted at a low resolution (one room pixel = 3 screen pixels on a phone) into a fixed
// canvas behind the page. The top of the page is left open so you see the room; the page then scrolls
// up over it, with the room dimmed underneath so the text stays easy to read.

const ROOM = { cv: null, ctx: null, img: null, key: '', kind: null, t: 0, last: 0, acc: 0, fx: [], W: 0, H: 0, x0: 0, s: 3, sceneH: 92 };
const ROOM_OF = { bag: 'house', cases: 'market', forge: 'forge', skills: 'temple', quests: 'board', more: 'study' };
const FW = 128; // every room is designed 128 pixels wide and centred; walls and floors run on past the edges

function roomShow(tab) {
  const kind = ROOM_OF[tab] || null;
  ROOM.kind = kind;
  document.body.classList.toggle('roomtab', !!kind);
  if (!ROOM.cv) {
    ROOM.cv = document.createElement('canvas');
    ROOM.cv.id = 'roomCv'; ROOM.cv.setAttribute('aria-hidden', 'true');
    document.body.prepend(ROOM.cv);
    ROOM.ctx = ROOM.cv.getContext('2d');
  }
  ROOM.cv.hidden = !kind;
  if (kind) { ROOM.fx = []; roomSize(true); roomFrame(0); }
}

function roomSize(force) {
  if (!ROOM.kind) return;
  const bar = $('#screenbar'), panel = $('#panel');
  if (!bar || bar.hidden) return;
  const top = Math.max(0, Math.round(bar.getBoundingClientRect().top - 6));
  const vw = window.innerWidth, vh = window.innerHeight - top;
  const s = vw >= 340 ? Math.max(2, Math.round(vw / FW)) : 2;
  const W = Math.ceil(vw / s), H = Math.ceil(vh / s);
  ROOM.sceneH = ROOM.kind === 'temple' ? 78 : 90;
  // Leave the top of the page open so the room shows; the page scrolls up over it.
  const gap = Math.max(40, ROOM.sceneH * s - (panel.getBoundingClientRect().top - top));
  panel.style.setProperty('--roomgap', gap + 'px');
  Object.assign(ROOM.cv.style, { top: top + 'px', width: W * s + 'px', height: H * s + 'px' });
  const key = [ROOM.kind, W, H].join(':');
  if (!force && key === ROOM.key) return;
  ROOM.key = key; ROOM.W = W; ROOM.H = H; ROOM.s = s; ROOM.x0 = Math.floor((W - FW) / 2);
  ROOM.cv.width = W; ROOM.cv.height = H;
  ROOM.img = paintRoom(ROOM.kind, W, H);
}
window.addEventListener('resize', () => roomSize(false));

function paintRoom(kind, W, H) {
  const cv = makeCanvas(W, H), prev = WORLD.ctx;
  WORLD.ctx = cv.getContext('2d');
  ({ house: paintHouseRoom, market: paintMarketRoom, forge: paintForgeRoom, temple: paintTempleRoom, board: paintBoardRoom, study: paintStudyRoom })[kind](W, H, Math.floor((W - FW) / 2));
  WORLD.ctx = prev;
  return cv;
}
// Draw at room coordinates (0..128) shifted to the centre of a wider screen.
function inFrame(x0, fn) { const g = wg(); g.save(); g.translate(x0, 0); fn(); g.restore(); }

// ---------- shared pieces ----------
function planks(W, H, y0, a, b, seam) {
  for (let y = y0, k = 0; y < H; y += 5, k++) {
    px(0, y, W, 5, k % 2 ? a : b); px(0, y + 4, W, 1, seam);
    for (let x = (k * 13) % 23; x < W; x += 23) px(x, y, 1, 4, seam);
    if (hash2(k, 9) < 0.5) px((k * 37) % W, y + 2, 2, 1, shade(a, -0.15));
  }
}
function stoneWall(W, h, base, mortar, hi) {
  px(0, 0, W, h, base);
  for (let y = 0, k = 0; y < h; y += 5, k++) {
    px(0, y + 4, W, 1, mortar);
    for (let x = k % 2 ? 0 : 5; x < W; x += 10) { px(x, y, 1, 4, mortar); if (hash2(x, y) < 0.3) px(x + 2, y + 1, 4, 1, hi); }
  }
}
function skirting(W, y, c) { px(0, y, W, 3, OUT); px(0, y, W, 2, c); px(0, y, W, 1, shade(c, 0.25)); }
function flame(g, x, y, t, big = 1) {
  const f = Math.sin(t * 13 + x) * Math.sin(t * 7.7 + y);
  g.fillStyle = '#e8501c'; g.fillRect(x - 3 * big, y - 4 * big, 6 * big, 4 * big + 1);
  g.fillStyle = '#ff9a30'; g.fillRect(x - 2 * big, y - (6 + Math.round(f)) * big, 4 * big, (6 + Math.round(f)) * big);
  g.fillStyle = '#ffd860'; g.fillRect(x - 1 * big, y - (4 + Math.round(f)) * big, 2 * big, (4 + Math.round(f)) * big);
  g.fillStyle = '#fff4c0'; g.fillRect(x - Math.max(0, big - 1), y - 2 * big, Math.max(1, big), 2 * big);
}
function candle(x, y) { parts([[x, y, 3, 6, '#f6efe0']]); px(x + 2, y, 1, 6, '#d8ccb4'); px(x + 1, y - 1, 1, 1, OUT); }
function chestIcon(x, y, lid, body = '#8a5a32') { parts([[x, y, 9, 7, body]]); px(x, y, 9, 3, lid); px(x, y + 3, 9, 1, OUT); px(x + 4, y + 3, 1, 2, '#f8d040'); }

// ---------- the house (bag) ----------
function paintHouseRoom(W, H, x0) {
  const F = 62;
  px(0, 0, W, F, '#e6cfa2'); for (let x = 2; x < W; x += 8) px(x, 0, 2, F, '#dcc191');
  for (let x = 6; x < W; x += 8) for (let y = 8; y < 40; y += 8) px(x, y, 1, 1, '#c9aa78');
  px(0, 0, W, 6, '#6e4428'); px(0, 5, W, 1, OUT); px(0, 1, W, 1, '#8a5a32');
  px(0, 40, W, 3, OUT); px(0, 40, W, 2, '#8a5a32');
  px(0, 43, W, F - 43, '#a8743e'); for (let x = 0; x < W; x += 16) { px(x + 2, 45, 12, F - 48, '#9a6838'); px(x + 2, 45, 12, 1, '#7a4c2a'); px(x + 2, 45, 1, F - 48, '#7a4c2a'); }
  planks(W, H, F, '#9a6638', '#8e5c32', '#6a4024'); skirting(W, F - 1, '#6e4428');
  inFrame(x0, () => {
    // Painting above the bed: a little landscape.
    parts([[12, 13, 22, 15, '#a8743e']]); px(14, 15, 18, 11, '#8fd0f8'); px(14, 22, 18, 4, '#5aa841'); pell(20, 22, 5, 3, '#3f8a30'); px(27, 17, 3, 3, '#f8e070');
    // Window with curtains and a potted plant.
    px(47, 11, 34, 31, OUT); px(48, 12, 32, 29, '#7a4c2a');
    px(50, 14, 28, 25, '#8fd0f8'); px(50, 30, 28, 9, '#b8e4fa'); px(50, 34, 28, 5, '#78c850'); pell(58, 34, 9, 3, '#5aa841');
    px(63, 14, 2, 25, '#7a4c2a'); px(50, 26, 28, 2, '#7a4c2a');
    for (const cx of [43, 77]) { px(cx, 9, 9, 35, OUT); px(cx + 1, 10, 7, 33, '#c84848'); px(cx + 3, 10, 1, 33, '#a83030'); px(cx + 6, 10, 1, 33, '#e06a5a'); px(cx + 1, 30, 7, 2, '#f2c23a'); }
    px(41, 8, 46, 3, OUT); px(42, 9, 44, 1, '#5a361c');
    px(46, 41, 36, 3, OUT); px(47, 41, 34, 2, '#b07a46');
    parts([[52, 36, 7, 5, '#c86a3a']]); pell(55, 33, 4, 3, '#2f7228'); px(53, 31, 2, 2, '#4ea548'); px(57, 32, 1, 1, '#f25d5d');
    // Bed: headboard, quilt, pillow.
    parts([[2, 36, 6, 34, '#7a4c2a'], [38, 48, 5, 22, '#7a4c2a'], [6, 54, 34, 12, '#8a5a32']]);
    px(3, 38, 4, 1, '#a8743e'); px(39, 50, 3, 1, '#a8743e');
    parts([[8, 48, 30, 7, '#f6efe0']]);
    parts([[11, 51, 27, 10, '#c84848']]);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) px(11 + i * 4, 51 + j * 3, 4, 3, ['#c84848', '#5d8ee0', '#f2d8a0', '#6aa84f'][(i + j) % 4]);
    px(11, 51, 27, 1, '#ffffff');
    parts([[8, 45, 10, 5, '#ffffff']]); px(9, 48, 8, 1, '#d6ccb4');
    // Treasure chest under the window: your bag.
    parts([[53, 48, 22, 13, '#8a5a32']]); px(53, 48, 22, 5, '#a8743e'); px(53, 53, 22, 1, OUT);
    px(53, 48, 2, 13, '#f2c23a'); px(73, 48, 2, 13, '#f2c23a'); px(62, 52, 4, 4, '#f2c23a'); px(63, 54, 2, 1, OUT);
    // Fireplace with a mantel.
    parts([[90, 24, 36, 39, '#8d857a']]);
    for (let y = 26, k = 0; y < 62; y += 4, k++) for (let x = 91 + (k % 2 ? 3 : 0); x < 125; x += 7) px(x, y + 3, 6, 1, '#6e655a');
    px(98, 38, 20, 24, OUT); px(99, 39, 18, 23, '#1a1210'); pell(108, 39, 9, 3, '#1a1210');
    parts([[87, 20, 42, 4, '#6e4428']]); px(87, 20, 42, 1, '#a8743e');
    parts([[100, 57, 16, 3, '#6e4428']]); px(101, 57, 14, 1, '#a8743e');
    // On the mantel: a clock and two candles.
    parts([[104, 11, 9, 9, '#a8743e']]); pell(108, 15, 3, 3, '#f6efe0'); px(108, 13, 1, 3, OUT); px(108, 15, 2, 1, OUT);
    candle(92, 14); candle(122, 14);
    // A rug in the middle of the room.
    pell(64, 78, 32, 8, OUT); pell(64, 78, 31, 7, '#b04040'); pell(64, 78, 26, 5, '#d8a046'); pell(64, 78, 24, 4, '#b04040');
    for (let i = -20; i <= 20; i += 8) px(64 + i, 77, 3, 2, '#f2d8a0');
    // A tall plant by the fireplace.
    parts([[82, 54, 7, 8, '#c86a3a']]); pell(85, 46, 5, 8, '#2f7228'); pell(84, 43, 3, 4, '#4ea548'); px(87, 47, 2, 2, '#4ea548');
  });
  // Sunlight from the window across the floor.
  const g = wg(); g.fillStyle = 'rgba(255,240,190,0.12)'; g.beginPath(); g.moveTo(x0 + 50, 39); g.lineTo(x0 + 78, 39); g.lineTo(x0 + 92, 90); g.lineTo(x0 + 58, 90); g.fill();
}
function liveHouse(g, t, dt, x0) {
  g.save(); g.translate(x0, 0);
  // Fire with logs, candle flames, a drifting cloud, and the cat asleep on the rug.
  g.fillStyle = '#5a361c'; g.fillRect(101, 58, 14, 3); g.fillStyle = '#7a4c2a'; g.fillRect(103, 56, 10, 2);
  flame(g, 105, 57, t, 1); flame(g, 111, 57, t + 1.3, 1); flame(g, 108, 56, t + 0.6, 1);
  glow(g, 108, 52, 26, `rgba(255,150,60,${0.16 + 0.05 * Math.sin(t * 9)})`);
  for (const cx of [93, 123]) { g.fillStyle = Math.sin(t * 10 + cx) > 0 ? '#ffd860' : '#ff9a30'; g.fillRect(cx, 11, 1, 2); glow(g, cx, 11, 6, 'rgba(255,210,120,0.25)'); }
  const cx = 50 + ((t * 2) % 40); g.fillStyle = '#ffffff'; if (cx < 74) { g.fillRect(Math.round(cx), 19, 7, 2); g.fillRect(Math.round(cx) + 2, 18, 4, 1); }
  g.restore();
  const prev = WORLD.ctx; WORLD.ctx = g;
  inFrame(x0, () => {
    const br = Math.sin(t * 2) > 0 ? 1 : 0;
    pell(71, 79, 9, 2, 'rgba(0,0,0,0.2)');
    parts([[63, 73 - br, 14, 6 + br, '#f0a040'], [74, 71, 6, 5, '#f0a040']]);
    px(65, 74 - br, 3, 1, '#c87828'); px(69, 74 - br, 3, 1, '#c87828'); px(74, 70, 1, 1, OUT); px(79, 70, 1, 1, OUT); px(75, 73, 4, 1, OUT);
    const flick = Math.floor(t / 3) % 3 === 0 && (t % 3) < 0.5;
    px(60, 76 - (flick ? 2 : 0), 4, 2, '#f0a040'); px(60, 76 - (flick ? 2 : 0), 1, 2, OUT);
  });
  WORLD.ctx = prev;
  // You, at home on the rug, in the look picked in the wardrobe.
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + 30, 82, 15, 1);
  g.drawImage(heroSprite(0), x0 + 27, 58 + (Math.sin(t * 2.2) > 0.6 ? 1 : 0));
  const zz = (t * 0.6) % 1; g.globalAlpha = 1 - zz; g.fillStyle = '#ffffff'; g.font = '6px "Jersey 10", monospace'; g.fillText('z', x0 + 80 + zz * 4, 68 - zz * 10); g.globalAlpha = 1;
}

// ---------- the market (cases) ----------
function paintMarketRoom(W, H, x0) {
  const F = 60;
  px(0, 0, W, F, '#b8844e'); for (let x = 0; x < W; x += 6) { px(x, 0, 1, F, '#9c6a3a'); if (hash2(x, 1) < 0.4) px(x + 3, 10 + hash2(x, 2) * 40, 1, 1, '#7a4c2a'); }
  px(0, 0, W, 4, '#5a361c'); px(0, 3, W, 1, OUT);
  // Stone tile floor.
  for (let y = F, k = 0; y < H; y += 6, k++) for (let x = (k % 2) * 6 - 6; x < W; x += 12) { px(x, y, 12, 6, (x / 12 + k) % 2 ? '#8d857a' : '#7e776c'); px(x, y + 5, 12, 1, '#5e574e'); px(x, y, 1, 6, '#5e574e'); }
  skirting(W, F - 1, '#5a361c');
  // Shelves the full width, stocked with chests of every rarity, jars and potions.
  const RCOL = ['#a7adbb', '#4aa8ff', '#b76dff', '#ffb52e', '#ff4d6d', '#2ff0c4', '#fff4a8', '#7fd4ff', '#ff6bd6', '#9b6bff', '#ffffff'];
  for (const sy of [22, 40]) {
    px(0, sy, W, 3, OUT); px(0, sy, W, 2, '#6e4428'); px(0, sy, W, 1, '#8a5a32');
    for (let x = 6; x < W; x += 30) { px(x, sy + 2, 2, 4, OUT); px(x + 1, sy + 2, 1, 3, '#6e4428'); }
    for (let x = 3, i = sy; x < W - 8; x += 11, i++) {
      const k = Math.floor(hash2(x, sy) * 10);
      if (k < 6) chestIcon(x, sy - 8, RCOL[(i * 3) % RCOL.length]);
      else if (k < 8) { parts([[x + 2, sy - 7, 5, 7, '#c8e4f0']]); px(x + 3, sy - 4, 3, 3, ['#e04040', '#4ae080', '#b76dff'][x % 3]); px(x + 3, sy - 9, 3, 2, '#8a5a32'); }
      else { parts([[x + 1, sy - 6, 7, 6, '#d8a868']]); px(x + 1, sy - 6, 7, 2, '#f6efe0'); }
    }
  }
  inFrame(x0, () => {
    // Bunting across the top.
    for (let x = 0; x < FW; x += 8) { const y = 6 + Math.round(Math.sin((x / FW) * Math.PI) * 4); px(x, y - 1, 8, 1, '#5a361c'); for (let i = 0; i < 4; i++) px(x + i + 1, y + i, 6 - i * 2, 1, ['#e04040', '#f2c23a', '#4aa8ff', '#4ae080'][(x / 8) % 4]); }
    // Barrels and crates at the sides.
    for (const bx of [0, 116]) { parts([[bx, 62, 12, 16, '#8a5a32']]); px(bx, 65, 12, 1, '#3a3a44'); px(bx, 73, 12, 1, '#3a3a44'); px(bx + 3, 62, 1, 16, '#a8743e'); }
  });
}
function liveMarket(g, t, dt, x0) {
  const prev = WORLD.ctx; WORLD.ctx = g;
  inFrame(x0, () => {
    // The shopkeeper behind the counter: bobs, blinks, sometimes waves.
    const wave = (t % 6) < 1, bob = Math.round(Math.sin(t * 2)) * 0;
    const L = { skin: '#f0c8a0', hair: '#c8c0b4', shirt: '#4a8a58', pants: '#3a3448', boots: '#2a2420', belt: '#7a4c2a' };
    const arm = wave ? [[68, 38 - (Math.floor(t * 6) % 2), 2, 6, L.skin]] : [];
    villager(64, 62 + bob, 1, L, 0, arm.map(r => [r[0], r[1] + 6, r[2], r[3], r[4]]));
    px(64, 51, 3, 1, '#c8c0b4'); // moustache
    if ((t % 4) > 3.85) px(65, 49, 1, 1, L.skin); // blink
    // Counter in front of him.
    parts([[12, 58, 104, 18, '#8a5a32']]); px(12, 58, 104, 3, '#c08a52'); px(12, 61, 104, 1, OUT);
    for (let x = 16; x < 112; x += 24) { px(x, 64, 20, 10, '#7a4c2a'); px(x, 64, 20, 1, '#5a361c'); px(x, 64, 1, 10, '#5a361c'); }
    // On the counter: coins, a key, an open chest that glows, scales.
    for (let i = 0; i < 6; i++) px(22 + (i % 3) * 3, 54 - Math.floor(i / 3) * 2, 3, 2, i % 2 ? '#f2c23a' : '#ffd860');
    px(38, 55, 6, 2, '#f2c23a'); px(36, 54, 3, 4, '#f2c23a');
    parts([[78, 51, 14, 7, '#8a5a32']]); px(78, 51, 14, 2, '#b76dff'); parts([[78, 46, 14, 4, '#9a6838']]);
    glow(g, 85, 50, 10 + Math.sin(t * 3) * 2, 'rgba(190,120,255,0.35)');
    if (Math.sin(t * 4) > 0.6) { g.fillStyle = '#ffffff'; g.fillRect(84 + Math.round(Math.sin(t * 7) * 3), 47 - Math.round((t * 8) % 6), 1, 1); }
    px(102, 46, 1, 12, OUT); px(97, 46, 11, 1, OUT); parts([[95, 48, 5, 2, '#f2c23a'], [105, 49, 5, 2, '#f2c23a']]);
    // Hanging lanterns.
    for (const lx of [18, 110]) { px(lx, 4, 1, 7, OUT); parts([[lx - 2, 11, 5, 6, '#3a3448']]); g.fillStyle = Math.sin(t * 8 + lx) > -0.7 ? '#ffd860' : '#f2a028'; g.fillRect(lx - 1, 12, 3, 4); glow(g, lx, 14, 12, 'rgba(255,200,90,0.22)'); }
  });
  WORLD.ctx = prev;
}

// ---------- the forge ----------
function paintForgeRoom(W, H, x0) {
  const F = 60;
  stoneWall(W, F, '#4e4856', '#36303e', '#5e5868');
  for (let y = F, k = 0; y < H; y += 8, k++) for (let x = (k % 2) * 8 - 8; x < W; x += 16) { px(x, y, 16, 8, hash2(x, y) < 0.5 ? '#3e3846' : '#433d4b'); px(x, y + 7, 16, 1, '#2a2430'); px(x, y, 1, 8, '#2a2430'); }
  skirting(W, F - 1, '#2a2430');
  inFrame(x0, () => {
    // The furnace: a brick dome with a hood and chimney.
    px(20, 0, 22, 18, OUT); px(21, 0, 20, 17, '#5e4a42'); for (let y = 2; y < 17; y += 4) px(21, y, 20, 1, '#4a3a34');
    px(12, 16, 38, 6, OUT); px(13, 17, 36, 4, '#6e5a50');
    px(6, 22, 50, 40, OUT); px(7, 23, 48, 39, '#7a5e50');
    for (let y = 24, k = 0; y < 61; y += 4, k++) for (let x = 7 + (k % 2 ? 3 : 0); x < 55; x += 7) px(x, y + 3, 6, 1, '#5e4a42');
    px(14, 32, 34, 29, OUT); pell(31, 33, 17, 6, OUT); px(15, 33, 32, 28, '#1a1210'); pell(31, 34, 16, 5, '#1a1210');
    // Tool rack: pickaxes, hammers and a sword.
    parts([[74, 10, 52, 28, '#6e4428']]); px(75, 11, 50, 1, '#8a5a32');
    const tool = (x, kind) => {
      px(x, 14, 1, 20, '#a8743e');
      if (kind === 0) { px(x - 4, 13, 9, 2, '#b8c0c8'); px(x - 4, 15, 1, 1, '#b8c0c8'); px(x + 4, 15, 1, 1, '#b8c0c8'); }
      if (kind === 1) { px(x - 2, 13, 5, 4, '#6e6e7a'); }
      if (kind === 2) { px(x - 1, 13, 3, 18, '#dfe6ee'); px(x - 2, 29, 5, 1, '#c8a040'); }
    };
    [[80, 0], [90, 1], [100, 2], [110, 0], [120, 1]].forEach(([x, k]) => tool(x, k));
    // Quench barrel and a coal heap.
    parts([[106, 56, 16, 20, '#7a4c2a']]); px(106, 60, 16, 1, '#3a3a44'); px(106, 70, 16, 1, '#3a3a44'); px(107, 56, 14, 3, '#3f7fc8');
    pell(16, 72, 12, 4, '#1a1418'); pell(14, 70, 7, 3, '#2a2228'); for (let i = 0; i < 8; i++) px(6 + i * 3, 69 + (i % 3), 2, 1, '#4a4450');
    // The anvil.
    parts([[78, 62, 22, 5, '#3a3a44'], [84, 67, 10, 5, '#3a3a44'], [80, 72, 18, 3, '#3a3a44']]); px(78, 62, 22, 1, '#8a8a96'); px(74, 63, 5, 2, '#3a3a44');
    parts([[83, 75, 12, 5, '#6e4428']]);
  });
}
function liveForge(g, t, dt, x0) {
  const prev = WORLD.ctx; WORLD.ctx = g;
  inFrame(x0, () => {
    // Furnace fire, its glow on the room, embers rising.
    const f = 0.5 + 0.5 * Math.sin(t * 11) * Math.sin(t * 6.3);
    g.fillStyle = '#a82810'; g.fillRect(16, 46, 30, 15);
    for (let i = 0; i < 5; i++) flame(g, 19 + i * 6, 60, t + i * 0.7, 2);
    glow(g, 31, 48, 60, `rgba(255,120,40,${0.16 + f * 0.08})`);
    if (Math.random() < dt * 8) ROOM.fx.push({ x: 18 + Math.random() * 26, y: 40, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 10, g: 0, t: 0, life: 1.6, c: Math.random() < 0.5 ? '#ffb040' : '#ffd860' });
    // The smith hammering at the anvil: raise, strike, sparks.
    const p = (t % 1.1) / 1.1, up = p < 0.55, hit = p > 0.6 && p < 0.75;
    if (hit && !ROOM.hit) for (let i = 0; i < 9; i++) ROOM.fx.push({ x: 88, y: 61, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, g: 90, t: 0, life: 0.35 + Math.random() * 0.2, c: ['#fff4c0', '#ffd860', '#ff9a30'][i % 3] });
    ROOM.hit = hit;
    const L = { skin: '#d8a078', hair: '#2a2420', shirt: '#6a6a74', pants: '#3a3448', boots: '#2a2420', belt: '#7a4c2a' };
    const tool = up ? [[73, 62, 3, 2, L.skin], [73, 52, 1, 10, '#8a5a32'], [71, 50, 5, 3, '#6e6e7a']] : [[75, 71, 3, 2, L.skin], [77, 66, 7, 1, '#8a5a32'], [83, 59, 4, 4, '#6e6e7a']];
    villager(70, 80, 1, L, 0, tool.concat([[68, 71, 4, 5, '#8a5a32']]));
    // A glowing blade on the anvil.
    g.fillStyle = hit ? '#fff4c0' : '#ff9a30'; g.fillRect(84, 61, 12, 1); g.fillStyle = '#ffd860'; g.fillRect(86, 61, 6, 1);
  });
  WORLD.ctx = prev;
}

// ---------- the temple (skills) ----------
function paintTempleRoom(W, H, x0) {
  const F = 60;
  px(0, 0, W, F, '#e8e0cc'); for (let y = 0, k = 0; y < F; y += 8, k++) { px(0, y + 7, W, 1, '#d0c6ae'); for (let x = k % 2 ? 0 : 10; x < W; x += 20) px(x, y, 1, 7, '#d0c6ae'); }
  for (let y = F, k = 0; y < H; y += 8, k++) for (let x = (k % 2) * 8 - 8; x < W; x += 8) px(x, y, 8, 8, (x / 8 + k) % 2 ? '#e8eef6' : '#4a6aa8');
  inFrame(x0, () => {
    // Gold runner carpet down the middle.
    px(54, F, 20, 200, '#b8282e'); px(54, F, 2, 200, '#f2c23a'); px(72, F, 2, 200, '#f2c23a');
    // Columns.
    for (const cx of [6, 110]) { px(cx - 1, 0, 14, F + 2, OUT); px(cx, 0, 12, F, '#fbf7ee'); px(cx + 8, 0, 4, F, '#d6ccb4'); px(cx + 3, 0, 1, F, '#e8e0cc'); px(cx - 2, 0, 16, 5, '#c8bea6'); px(cx - 2, F - 4, 16, 5, '#c8bea6'); }
    // Arched stained-glass window: tall coloured panes under a rose window.
    const inArch = (x, y) => x >= 40 && x < 88 && y < 46 && (y >= 20 || ((x - 64) / 24) ** 2 + ((y - 20) / 15) ** 2 <= 1);
    for (let y = 3; y < 48; y++) for (let x = 38; x < 90; x++) {
      if (inArch(x, y)) {
        const dx = x - 64, dy = y - 17, r = Math.hypot(dx, dy * 1.1);
        let c;
        if (r < 11) {
          const spoke = Math.abs(Math.sin(Math.atan2(dy, dx) * 4)) < 0.2;
          c = r < 3 ? '#fff4a8' : spoke || Math.abs(r - 7) < 0.6 ? OUT : r < 7 ? '#f2c23a' : (Math.floor((Math.atan2(dy, dx) + 4) * 1.27) % 2 ? '#ff6bd6' : '#9b6bff');
        } else if (Math.abs(r - 11.5) < 0.8) c = OUT;
        else {
          const col = Math.floor((x - 40) / 8), lead = (x - 40) % 8 === 0 || (y > 28 && (y - 28) % 9 === 0);
          c = lead ? OUT : ['#4a7ae0', '#2ff0c4', '#9b6bff', '#4a7ae0', '#2ff0c4', '#9b6bff'][col] ;
          if (!lead && y > 28 && (y - 28) % 9 < 3 && (x - 40) % 8 < 3) c = '#ffffff';
        }
        px(x, y, 1, 1, c);
      } else if (inArch(x - 1, y) || inArch(x + 1, y) || inArch(x, y - 1) || inArch(x, y + 1)) px(x, y, 1, 1, OUT);
    }
    px(37, 46, 54, 3, OUT); px(38, 46, 52, 2, '#c8bea6');
    // Altar.
    parts([[48, 54, 32, 14, '#d8cfb8']]); px(48, 54, 32, 2, '#f2c23a'); px(52, 58, 24, 8, '#c8bea6'); px(62, 59, 4, 6, '#f2c23a');
    // Brazier stands.
    for (const bx of [28, 100]) { parts([[bx - 1, 58, 3, 14, '#5e574e'], [bx - 5, 54, 11, 4, '#8d857a']]); px(bx - 5, 54, 11, 1, '#c8c0b4'); }
  });
}
function liveTemple(g, t, dt, x0) {
  g.save(); g.translate(x0, 0);
  // Light rays from the window that slowly breathe.
  for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(255,248,210,${0.07 + 0.04 * Math.sin(t * 0.8 + i * 2)})`; g.beginPath(); g.moveTo(46 + i * 14, 50); g.lineTo(56 + i * 14, 50); g.lineTo(68 + i * 22, 120); g.lineTo(50 + i * 22 - 10, 120); g.fill(); }
  // The floating crystal above the altar, with orbiting motes.
  const by = 42 + Math.round(Math.sin(t * 1.6) * 2);
  glow(g, 64, by, 18, 'rgba(120,220,255,0.35)');
  g.fillStyle = OUT; g.fillRect(61, by - 6, 7, 12);
  g.fillStyle = '#5ad0f8'; g.fillRect(62, by - 5, 5, 10); g.fillStyle = '#b8f0ff'; g.fillRect(62, by - 5, 2, 6); g.fillStyle = '#2a8ac8'; g.fillRect(65, by, 2, 5);
  g.fillStyle = OUT; g.fillRect(63, by - 7, 3, 1); g.fillRect(63, by + 6, 3, 1);
  for (let i = 0; i < 5; i++) { const a = t * 1.2 + (i * Math.PI * 2) / 5; g.fillStyle = i % 2 ? '#fff4a8' : '#b8f0ff'; g.fillRect(Math.round(64 + Math.cos(a) * 11), Math.round(by + Math.sin(a) * 4), 1, 1); }
  for (const bx of [28, 100]) { flame(g, bx, 54, t + bx, 1); glow(g, bx, 51, 12, 'rgba(255,170,60,0.25)'); }
  if (Math.random() < dt * 3) ROOM.fx.push({ x: 40 + Math.random() * 48, y: 90, vx: 0, vy: -6 - Math.random() * 4, g: 0, t: 0, life: 3, c: '#fff4a8' });
  g.restore();
}

// ---------- the quest board, outside in the town square ----------
function paintBoardRoom(W, H, x0) {
  const sky = wg().createLinearGradient(0, 0, 0, 44); sky.addColorStop(0, '#6fbcf0'); sky.addColorStop(1, '#c8ecfc');
  wg().fillStyle = sky; wg().fillRect(0, 0, W, 44);
  for (let x = 0; x < W; x++) { const h = 30 + Math.round(Math.sin(x / 19) * 5 + Math.sin(x / 7) * 2); px(x, h, 1, 44 - h, '#7cc0a0'); }
  for (let x = 0; x < W; x += 22) { const hx = x + 4; px(hx, 34, 12, 10, '#e8d8b8'); for (let i = 0; i < 6; i++) px(hx - 1 + i, 33 - i, 14 - i * 2, 1, ['#c84848', '#4a7ac8', '#c88a3a'][(x / 22) % 3]); px(hx + 4, 38, 3, 6, '#7a4c2a'); }
  for (let y = 44; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const k = Math.max(0, Math.min(4, Math.floor(vnoise(x / 14, y / 10) * 5 + BAYER[((y >> 1) & 3) * 4 + ((x >> 1) & 3)] * 1.3)));
    px(x, y, 2, 2, `rgb(${PAL.grass[k].join(',')})`);
  }
  px(0, 44, W, 1, '#3e8430');
  inFrame(x0, () => {
    // Dirt square in front of the board.
    pell(64, 74, 46, 9, '#cfa76c'); pell(64, 74, 42, 7, '#d9b37a');
    // The big board: two posts, a shingle roof, notes pinned all over.
    parts([[36, 26, 4, 50, '#7a4c2a'], [88, 26, 4, 50, '#7a4c2a']]);
    roof(30, 12, 68, 9, '#b04a36', '#7e2c20', '#d86a50');
    parts([[34, 24, 60, 36, '#9a6a3c']]); px(35, 25, 58, 34, '#c99a62');
    const notes = [[38, 28, '#fbf6e8'], [50, 27, '#f8e8a0'], [62, 29, '#fbf6e8'], [75, 27, '#bfe3f8'], [41, 42, '#f8c8c8'], [54, 43, '#fbf6e8'], [68, 41, '#f8e8a0'], [80, 43, '#fbf6e8']];
    for (const [x, y, c] of notes) { px(x, y, 10, 12, c); px(x, y + 11, 10, 1, shade(c, -0.2)); px(x + 4, y, 2, 1, '#d83030'); for (let k = 0; k < 3; k++) px(x + 2, y + 3 + k * 3, 6 - (k % 2) * 2, 1, '#9a8a70'); }
    // Flowers and a barrel.
    for (const [fx, fy, c] of [[14, 60, '#f25d5d'], [20, 64, '#f8e04a'], [108, 62, '#b77df0'], [116, 58, '#ffffff'], [10, 70, '#6fb2ff']]) flower(fx, fy, c);
    parts([[4, 52, 11, 14, '#8a5a32']]); px(4, 55, 11, 1, '#3a3a44'); px(4, 62, 11, 1, '#3a3a44');
  });
}
function liveBoard(g, t, dt, x0) {
  // Clouds drifting, a note fluttering, a villager reading, a pigeon pecking.
  g.fillStyle = '#ffffff';
  for (const [o, y, w] of [[0, 5, 16], [70, 9, 12], [140, 4, 20]]) { const x = ((t * 3 + o) % (ROOM.W + 40)) - 20; g.fillRect(Math.round(x), y, w, 3); g.fillRect(Math.round(x) + 3, y - 2, w - 7, 2); }
  const prev = WORLD.ctx; WORLD.ctx = g;
  inFrame(x0, () => {
    const fl = Math.sin(t * 5) > 0.3 ? 1 : 0;
    px(75, 27, 10, 1 + fl, '#bfe3f8');
    const L = { skin: '#f0c8a0', hair: '#c86a3a', shirt: '#4a7ac8', pants: '#5a4a3a', boots: '#3a2418' };
    villager(104, 78, -1, L, 0, [[97, 66 + (Math.floor(t / 2) % 2), 5, 6, '#fbf6e8']]);
    const pk = Math.floor(t * 3) % 4 === 0;
    pell(22, 82, 3, 1, 'rgba(0,0,0,0.25)'); parts([[18, 77, 7, 4, '#8a8a9a'], [24, pk ? 77 : 74, 3, 3, '#6a6a7a']]); px(27, pk ? 79 : 75, 1, 1, '#f2a028'); px(25, pk ? 77 : 75, 1, 1, OUT); px(19, 78, 3, 1, '#5aa6a0');
  });
  WORLD.ctx = prev;
}

// ---------- the study (settings) ----------
function paintStudyRoom(W, H, x0) {
  const F = 60;
  px(0, 0, W, F, '#6a442c'); for (let x = 0; x < W; x += 10) { px(x, 0, 1, F, '#4e301e'); px(x + 4, 0, 1, F, '#7a5236'); }
  px(0, 0, W, 5, '#3a2418'); px(0, 5, W, 1, OUT);
  planks(W, H, F, '#7a4c2a', '#6e4428', '#4e301e'); skirting(W, F - 1, '#3a2418');
  inFrame(x0, () => {
    // Bookshelf.
    parts([[2, 8, 24, 52, '#5a361c']]);
    for (const sy of [10, 23, 36, 49]) { px(3, sy + 11, 22, 2, '#3a2418'); for (let x = 4; x < 24; x += 3) { const h = 8 + Math.floor(hash2(x, sy) * 3); px(x, sy + 11 - h, 2, h, ['#c84848', '#4a7ac8', '#4a9a48', '#c8a040', '#8a5ab0'][Math.floor(hash2(sy, x) * 5)]); } }
    // Round window onto the night sky.
    pell(64, 22, 15, 15, OUT); pell(64, 22, 14, 14, '#6e4428'); pell(64, 22, 12, 12, '#1a2448'); pell(70, 17, 3, 3, '#f6efc8'); pell(71, 16, 2, 2, '#1a2448');
    px(63, 10, 2, 24, '#6e4428'); px(52, 21, 24, 2, '#6e4428');
    // Desk with a lamp, books, a map and a quill.
    parts([[30, 48, 52, 5, '#8a5a32'], [32, 53, 4, 18, '#6e4428'], [76, 53, 4, 18, '#6e4428']]); px(30, 48, 52, 1, '#b07a46');
    parts([[38, 44, 16, 4, '#e8d8b0']]); px(40, 45, 5, 1, '#c84848'); px(46, 46, 6, 1, '#9a8a70');
    parts([[58, 40, 9, 3, '#4a7ac8'], [59, 43, 8, 3, '#c84848'], [57, 46, 10, 2, '#4a9a48']]);
    px(52, 38, 1, 8, '#f6efe0'); px(53, 37, 1, 2, '#f6efe0');
    parts([[72, 46, 6, 2, '#c8a040'], [74, 36, 2, 10, '#c8a040'], [70, 32, 10, 5, '#2e7a5a']]);
    // Big gear clock on the wall (the gears turn).
    pell(108, 24, 16, 16, OUT); pell(108, 24, 15, 15, '#a8743e'); pell(108, 24, 13, 13, '#f2e6c8');
    // Armchair.
    parts([[94, 50, 28, 8, '#7a3040'], [92, 44, 6, 26, '#8a3a4a'], [118, 44, 6, 26, '#8a3a4a'], [96, 58, 24, 12, '#8a3a4a']]);
    px(96, 50, 24, 1, '#a85060'); px(96, 58, 24, 1, '#a85060');
    // Rug.
    pell(64, 80, 34, 7, OUT); pell(64, 80, 33, 6, '#2e5a8a'); pell(64, 80, 27, 4, '#c8a040'); pell(64, 80, 25, 3, '#2e5a8a');
  });
}
function gear(g, cx, cy, r, teeth, a, c) {
  for (let i = 0; i < teeth; i++) { const ang = a + (i / teeth) * Math.PI * 2; g.fillStyle = c; g.fillRect(Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy + Math.sin(ang) * r) - 1, 2, 2); }
  g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r - 1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2e6c8'; g.beginPath(); g.arc(cx, cy, Math.max(1, r - 3), 0, Math.PI * 2); g.fill();
  g.fillStyle = c; g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
}
function liveStudy(g, t, dt, x0) {
  g.save(); g.translate(x0, 0);
  // Stars twinkle in the window; the clock's gears turn; the lamp glows.
  for (let i = 0; i < 7; i++) { if (Math.sin(t * 2 + i * 2.1) > 0) { g.fillStyle = '#ffffff'; g.fillRect(56 + ((i * 7) % 16), 14 + ((i * 11) % 16), 1, 1); } }
  gear(g, 103, 21, 6, 8, t * 0.8, '#8a5a32');
  gear(g, 113, 27, 5, 7, -t * 0.96 + 0.2, '#c8a040');
  gear(g, 108, 32, 3, 6, t * 1.6, '#6e4428');
  g.fillStyle = OUT; const a = t * 0.2; g.fillRect(108, 24, 1, 1); g.fillRect(Math.round(108 + Math.cos(a) * 8), Math.round(24 + Math.sin(a) * 8), 1, 1);
  glow(g, 75, 38, 24, `rgba(255,220,130,${0.28 + 0.03 * Math.sin(t * 5)})`);
  g.fillStyle = '#fff4c0'; g.fillRect(72, 37, 6, 1);
  g.restore();
}

// ---------- each frame ----------
const ROOM_LIVE = { house: liveHouse, market: liveMarket, forge: liveForge, temple: liveTemple, board: liveBoard, study: liveStudy };
function roomFrame(dt) {
  if (!ROOM.kind || !ROOM.img) return;
  const g = ROOM.ctx;
  ROOM.t += dt;
  g.imageSmoothingEnabled = false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(ROOM.img, 0, 0);
  ROOM_LIVE[ROOM.kind](g, ROOM.t, dt, ROOM.x0);
  for (const p of ROOM.fx) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.c; g.fillRect(Math.round(p.x + ROOM.x0), Math.round(p.y), 1, 1); }
  g.globalAlpha = 1; ROOM.fx = ROOM.fx.filter(p => p.t < p.life);
  // Below the open scene the room dims, so the page on top stays easy to read.
  const top = ROOM.sceneH - 6, sh = g.createLinearGradient(0, top, 0, top + 22);
  sh.addColorStop(0, 'rgba(13,10,18,0)'); sh.addColorStop(1, 'rgba(13,10,18,0.8)');
  g.fillStyle = sh; g.fillRect(0, top, ROOM.W, 22); g.fillStyle = 'rgba(13,10,18,0.8)'; g.fillRect(0, top + 22, ROOM.W, ROOM.H);
  const tp = g.createLinearGradient(0, 0, 0, 16); tp.addColorStop(0, 'rgba(13,10,18,0.55)'); tp.addColorStop(1, 'rgba(13,10,18,0)');
  g.fillStyle = tp; g.fillRect(0, 0, ROOM.W, 16);
}
function roomLoop(now) {
  requestAnimationFrame(roomLoop);
  if (!ROOM.kind || document.hidden) { ROOM.last = now; return; }
  const dt = Math.min(0.1, (now - (ROOM.last || now)) / 1000);
  ROOM.last = now; ROOM.acc += dt;
  if (ROOM.acc < 1 / 20) return; // twenty frames a second is plenty for a backdrop
  roomFrame(ROOM.acc); ROOM.acc = 0;
}
requestAnimationFrame(roomLoop);
