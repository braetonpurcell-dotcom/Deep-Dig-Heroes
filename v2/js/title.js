'use strict';
// Version 2 title screen: shown at launch over a live view of your island. The camera drifts along
// the route while the villagers work, your miner stands in front in the gear they wear, and a tap
// starts the game (and, since browsers need a touch first, the music and sound).

const TITLE = { el: null, cv: null, g: null, t: 0, last: 0, x: 0, dir: 1, on: false, done: null };

function showTitle(done) {
  if (TITLE.on) return;
  TITLE.on = true; TITLE.done = done || null; TITLE.t = 0; TITLE.x = 0; TITLE.dir = 1;
  const el = document.createElement('div');
  el.id = 'title';
  const tool = S.gear.eq.pick, mi = S.drill && S.drill.show ? drillModelIndex(S.drill.lv) : -1;
  const toolImg = mi >= 0 ? drillUrl(mi, 5) : tool ? gearUrl('pick', tool.t, tool.r, false, tool.st) : '';
  const isle = ISLANDS[worldIsle()];
  el.innerHTML = `<canvas id="titleCv" aria-hidden="true"></canvas>
    <div class="tshade"></div>
    <div class="tlogo" aria-label="Deep Dig Heroes"><span class="t1" data-t="DEEP DIG">DEEP DIG</span><span class="t2" data-t="HEROES">HEROES</span></div>
    <div class="tisle">${isle.name}</div>
    <div class="thero"><div class="tpad"></div><div class="tbody">${toolImg ? `<img class="ttool ${mi >= 0 ? 'drill' : ''}" src="${toolImg}" alt="">` : ''}<img class="tme" src="${spriteUrl(heroSprite(0), 8)}" alt=""></div></div>
    <button class="ttap" id="titleTap">Tap to play</button>
    <div class="tfoot"><span>Version 2 preview · ${GAME_VERSION}</span>${S.stats.bestFloor > 1 ? `<span>Best B${S.stats.bestFloor} · ${S.prestiges} ${S.prestiges === 1 ? 'prestige' : 'prestiges'}</span>` : ''}</div>`;
  document.body.appendChild(el);
  TITLE.el = el; TITLE.cv = $('#titleCv', el); TITLE.g = TITLE.cv.getContext('2d');
  sizeTitle();
  el.addEventListener('pointerdown', startFromTitle, { once: true });
  requestAnimationFrame(titleLoop);
}
function sizeTitle() {
  if (!TITLE.cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  TITLE.cv.width = Math.round(window.innerWidth * dpr); TITLE.cv.height = Math.round(window.innerHeight * dpr);
}
window.addEventListener('resize', sizeTitle);

function titleLoop(now) {
  if (!TITLE.on) return;
  requestAnimationFrame(titleLoop);
  const dt = Math.min(0.1, (now - (TITLE.last || now)) / 1000);
  TITLE.last = now; TITLE.t += dt;
  const g = TITLE.g, W = TITLE.cv.width, H = TITLE.cv.height;
  if (!WORLD.img) { g.fillStyle = '#120c18'; g.fillRect(0, 0, W, H); return; }
  // The camera glides along the route and turns around at each end.
  const z = H / WH, span = W / z;
  TITLE.x += TITLE.dir * dt * 14;
  const wmax = WORLD.wmax || WW;
  if (TITLE.x > wmax - span) { TITLE.x = wmax - span; TITLE.dir = -1; }
  if (TITLE.x < 0) { TITLE.x = 0; TITLE.dir = 1; }
  // Draw the world as the island screen does, but through the title's camera.
  const cam = { ...WORLD.cam }, vw = WORLD.vw, wz = WORLD.z;
  WORLD.cam.x = TITLE.x; WORLD.vw = W; WORLD.z = z;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = STYLE.bg; g.fillRect(0, 0, W, H);
  g.setTransform(z, 0, 0, z, -TITLE.x * z, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(WORLD.img, 0, 0);
  if (STYLE.tint) { g.fillStyle = STYLE.tint; g.fillRect(0, 0, WW, WH); }
  drawLive(g, dt, (WORLD.t += dt));
  WORLD.cam.x = cam.x; WORLD.vw = vw; WORLD.z = wz;
}

function startFromTitle() {
  if (!TITLE.on) return;
  audioUnlock();
  if (typeof ambStart === 'function') setTimeout(ambStart, 0);
  SFX.levelup();
  TITLE.el.classList.add('out');
  setTimeout(() => {
    TITLE.on = false;
    if (TITLE.el) TITLE.el.remove();
    TITLE.el = TITLE.cv = TITLE.g = null;
    if (TITLE.done) TITLE.done();
  }, 650);
}
