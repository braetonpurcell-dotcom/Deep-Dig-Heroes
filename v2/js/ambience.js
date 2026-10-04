'use strict';
// Version 2 soundscape, all synthesized: a gentle chiptune loop that plays everywhere, and an
// ambient bed for the world that follows the camera (wind in the grass, the river rushing near the
// bridge, a low spooky drone by the cave). Plus little sounds for tapping animals and villagers.

const AMB = { on: false, loopBuf: null, music: null, layers: null, nextNote: 0, step: 0, phrase: null, timer: 0, w: { grass: 0, water: 0, cave: 0 } };
const clamp01 = v => Math.max(0, Math.min(1, v));
const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

function ambStart() {
  if (AMB.on || !AU.ctx || AU.ctx.state !== 'running') return;
  AMB.on = true;
  const c = AU.ctx, sr = c.sampleRate;
  // A 4 second noise loop (long enough that the repeat can't be heard).
  AMB.loopBuf = c.createBuffer(1, sr * 4, sr);
  const d = AMB.loopBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 3; } // white plus a little brown
  const loop = () => { const s = c.createBufferSource(); s.buffer = AMB.loopBuf; s.loop = true; s.loopStart = Math.random() * 2; s.start(0, Math.random() * 4); return s; };
  const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const filt = (type, f, q, to) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (to) n.connect(to); return n; };

  const bed = gain(0.9, AU.master);
  // Grass: a soft wind body plus a higher leaf rustle, both swelling in gusts.
  const grass = gain(0, bed), gust = gain(0.5, grass), leaves = gain(0.15, grass);
  loop().connect(filt('bandpass', 520, 0.6, gust));
  loop().connect(filt('bandpass', 3800, 1.2, leaves));
  // Water: a low steady rush and a bubbling top that flickers.
  const water = gain(0, bed), rush = gain(0.9, water), babble = gain(0.25, water);
  loop().connect(filt('lowpass', 700, 0.7, filt('highpass', 120, 0.7, rush)));
  const bub = filt('bandpass', 1900, 2.5, babble); loop().connect(bub);
  // Cave: two low tones that beat against each other, a hollow howl, and an echo for drips.
  const cave = gain(0, bed), drone = gain(0.35, cave), howl = gain(0.5, cave);
  const lp = filt('lowpass', 260, 0.8, drone);
  for (const [f, type] of [[55, 'sine'], [55.6, 'sine'], [82.4, 'triangle']]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(); }
  const howlF = filt('bandpass', 420, 9, howl); loop().connect(howlF);
  const echo = c.createDelay(1), fb = gain(0.45), wet = gain(0.6, cave);
  echo.delayTime.value = 0.32; echo.connect(fb); fb.connect(echo); echo.connect(wet);
  AMB.layers = { grass, water, cave, gust, leaves, babble, bub, howlF, echo, bed };

  // Music bus: soft low-pass and a little echo.
  const mus = gain(0, AU.master), tone = filt('lowpass', 2600, 0.5, mus), mEcho = c.createDelay(1), mFb = gain(0.28), mWet = gain(0.22, tone);
  mEcho.delayTime.value = 0.34; mEcho.connect(mFb); mFb.connect(mEcho); mEcho.connect(mWet);
  AMB.music = { out: mus, bus: tone, echo: mEcho };
  AMB.nextNote = c.currentTime + 0.3;
  AMB.timer = setInterval(ambTick, 90);
  ambTick();
}

// ---------- music: a cozy four-chord loop with a made-up melody that changes every few bars ----------
const CHORDS = [[48, 0], [45, 1], [41, 0], [43, 0], [48, 0], [45, 1], [41, 0], [43, 0], [45, 1], [41, 0], [48, 0], [43, 0]]; // C Am F G ..., minor flag
const MEL_SCALE = [0, 2, 4, 7, 9];
function makePhrase() {
  const out = []; let s = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < 32; i++) {
    const play = i % 8 === 0 ? 0.85 : i % 2 === 0 ? 0.5 : 0.18;
    if (Math.random() < play) { s = Math.max(2, Math.min(11, s + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)])); out.push(s); }
    else out.push(-1);
  }
  return out;
}
function pluck(freq, t, dur, type, vol, dest) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); if (dest === AMB.music.bus) g.connect(AMB.music.echo);
  o.start(t); o.stop(t + dur + 0.05);
}
function scheduleMusic() {
  const c = AU.ctx, eighth = 60 / 84 / 2;
  if (AMB.nextNote < c.currentTime - 0.5) AMB.nextNote = c.currentTime + 0.05; // after a pause, don't rush to catch up
  while (AMB.nextNote < c.currentTime + 0.45) {
    const t = AMB.nextNote, st = AMB.step, bar = Math.floor(st / 8) % CHORDS.length, e = st % 8;
    if (st % 32 === 0) AMB.phrase = (Math.floor(st / 32) % 4 === 2 || !AMB.phrase) ? makePhrase() : AMB.phrase; // A A B A
    const [root, minor] = CHORDS[bar], tri = [0, minor ? 3 : 4, 7, 12];
    if (e === 0 || e === 4) pluck(m2f(root - 12 + (e === 4 ? 7 : 0)), t, 0.7, 'triangle', 0.32, AMB.music.bus);
    pluck(m2f(root + 12 + tri[[0, 1, 2, 1, 3, 2, 1, 2][e]]), t, 0.32, 'triangle', 0.1, AMB.music.bus);
    const m = AMB.phrase[st % 32];
    if (m >= 0) { const n = 60 + MEL_SCALE[m % 5] + 12 * Math.floor(m / 5); pluck(m2f(n), t, 0.45, 'square', 0.035, AMB.music.bus); pluck(m2f(n), t, 0.5, 'sine', 0.07, AMB.music.bus); }
    AMB.nextNote += eighth; AMB.step++;
  }
}

// ---------- the mix follows the screen and the camera ----------
function ambTick() {
  if (!AMB.on) return;
  const c = AU.ctx, now = c.currentTime, L = AMB.layers;
  const audible = S.settings.sound && !document.hidden;
  let grass = 0, water = 0, cave = 0;
  if (UI.tab === 'island' && WORLD.vw) {
    const cx = WORLD.cam.x + WORLD.vw / WORLD.z / 2;
    water = clamp01(1 - (Math.abs(cx - 810) - 40) / 120);
    cave = clamp01((cx - 960) / 130);
    grass = clamp01(1 - water * 0.85 - cave);
  } else if (UI.tab === 'fight') cave = 0.45; // a hint of the cave under the fight
  if (!audible) grass = water = cave = 0;
  AMB.w = { grass, water, cave };
  // Each island sounds a little different: colder wind on the snow, a frozen (quiet) river, dry
  // desert wind, a crackling lava river, and a hushed night.
  const isle = UI.tab === 'island' && typeof WORLD !== 'undefined' && WORLD.isle != null ? ISLANDS[WORLD.isle].id : 'green';
  const mix = { green: [1, 1], frost: [1.35, 0.15], sand: [1.15, 0.6], ember: [0.6, 0.85], star: [0.5, 0.6] }[isle] || [1, 1];
  const k = document.hidden ? 0.05 : 0.5;
  L.grass.gain.setTargetAtTime(grass * 0.08 * mix[0], now, k);
  L.water.gain.setTargetAtTime(water * 0.073 * mix[1], now, k);
  L.cave.gain.setTargetAtTime(cave * 0.27, now, k);
  // Gusts of wind, flickering water, a slowly moving howl.
  const t = now;
  L.gust.gain.setTargetAtTime(0.25 + 0.35 * clamp01(0.5 + 0.5 * Math.sin(t * 0.35) * Math.sin(t * 0.13 + 1)) + Math.random() * 0.05, now, 0.4);
  L.leaves.gain.setTargetAtTime(0.06 + 0.16 * clamp01(Math.sin(t * 0.35) * Math.sin(t * 0.13 + 1)), now, 0.4);
  L.babble.gain.setTargetAtTime(0.1 + Math.random() * 0.3, now, 0.04);
  L.bub.frequency.setTargetAtTime(1400 + Math.random() * 1400, now, 0.05);
  L.howlF.frequency.setTargetAtTime(330 + 140 * Math.sin(t * 0.21) + 50 * Math.sin(t * 0.07), now, 0.5);
  if (cave > 0.2 && Math.random() < 0.035) drip();
  if (cave > 0.5 && Math.random() < 0.006) whisper();
  if (grass > 0.4 && UI.tab === 'island' && (isle === 'green' || isle === 'sand') && Math.random() < 0.01) birdChirp(grass);
  if (isle === 'ember' && water > 0.2 && Math.random() < 0.25) noise(0.02 + Math.random() * 0.03, 0.05 * water, 1800 + Math.random() * 2400); // lava crackle
  if (isle === 'star' && grass > 0.3 && Math.random() < 0.02) { const tt = AU.ctx.currentTime; voice(m2f(84 + MEL_SCALE[Math.floor(Math.random() * 5)]), tt, 0.9, 'sine', 0.015 * grass, AMB.layers.bed); } // night chimes
  // Music: everywhere, quieter in the fight and as you near the cave.
  const musicOn = audible && S.settings.music !== false;
  const lvl = UI.tab === 'island' ? 1 - cave * 0.65 : UI.tab === 'fight' ? 0.45 : 0.75;
  AMB.music.out.gain.setTargetAtTime(musicOn ? lvl * 0.5 : 0, now, document.hidden ? 0.05 : 0.6);
  if (musicOn || AMB.music.out.gain.value > 0.002) scheduleMusic();
  else AMB.nextNote = now + 0.1;
}
document.addEventListener('visibilitychange', () => { if (AMB.on) ambTick(); });
// Browsers only allow sound after a touch, so start on the first one.
document.addEventListener('pointerdown', () => { audioUnlock(); setTimeout(ambStart, 0); }, true);

// ---------- one-shot ambient touches ----------
function voice(freq, t, dur, type, vol, dest = AU.master) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  vol *= AU.trim;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function drip() {
  const t = AU.ctx.currentTime, o = voice(1500 + Math.random() * 900, t, 0.12, 'sine', 0.05, AMB.layers.cave);
  o.frequency.exponentialRampToValueAtTime(3200, t + 0.06);
  const g = AU.ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(AMB.layers.echo);
}
function whisper() {
  // Two close low notes that rub against each other, fading in and out: a little eerie.
  const t = AU.ctx.currentTime, base = [196, 207.7, 174.6][Math.floor(Math.random() * 3)];
  for (const f of [base, base * 1.06]) {
    const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(g); g.connect(AMB.layers.cave); g.connect(AMB.layers.echo); o.start(t); o.stop(t + 3.6);
  }
}
function birdChirp(v) {
  const t = AU.ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), f = 2600 + Math.random() * 1200;
  for (let i = 0; i < n; i++) { const o = voice(f, t + i * 0.11, 0.07, 'sine', 0.02 * v, AMB.layers.bed); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + i * 0.11 + 0.05); }
}

// ---------- tapping things in the world ----------
const CRITTER_SFX = {
  baa(pitch = 1) {
    if (!soundOn()) return;
    const c = AU.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    const f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), mix = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(330 * pitch, t); o.frequency.linearRampToValueAtTime(300 * pitch, t + 0.12); o.frequency.linearRampToValueAtTime(260 * pitch, t + 0.6);
    vib.frequency.value = 9; vg.gain.value = 14 * pitch; vib.connect(vg); vg.connect(o.frequency);
    f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 4; f2.type = 'bandpass'; f2.frequency.value = 1250; f2.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * AU.trim, t + 0.04); g.gain.setValueAtTime(0.45 * AU.trim, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.gain.value = 1.4; mix.connect(g); g.connect(AU.master);
    o.start(t); vib.start(t); o.stop(t + 0.75); vib.stop(t + 0.75);
  },
  cluck() {
    if (!soundOn()) return;
    const t = AU.ctx.currentTime;
    for (let i = 0; i < 3; i++) { const o = voice(620 + Math.random() * 120, t + i * 0.09, 0.07, 'square', 0.12); o.frequency.exponentialRampToValueAtTime(1050, t + i * 0.09 + 0.04); }
  },
  // Villagers talk in a little babble of notes.
  talk(base = 1) {
    if (!soundOn()) return;
    const t = AU.ctx.currentTime, n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) voice(m2f(64 + MEL_SCALE[Math.floor(Math.random() * 5)]) * base, t + i * 0.075, 0.06, 'triangle', 0.22);
  },
};
trimSounds(CRITTER_SFX, { baa: 0.4, cluck: 1.16, talk: 0.82 });
