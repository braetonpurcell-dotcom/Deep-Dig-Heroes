'use strict';
// Synthesized chiptune sound effects (no audio files) and vibration.

const AU = { ctx: null, master: null, noiseBuf: null, lastHit: 0, trim: 1 };

function audioUnlock() {
  if (!AU.ctx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      AU.ctx = new Ctx();
      AU.master = AU.ctx.createGain();
      AU.master.gain.value = 0.22;
      AU.master.connect(AU.ctx.destination);
      const len = Math.floor(AU.ctx.sampleRate * 0.3);
      AU.noiseBuf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate);
      const data = AU.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      AU.ctx = null;
      return;
    }
  }
  if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {});
}

function soundOn() {
  return S.settings.sound && AU.ctx && AU.ctx.state === 'running';
}

// Small random pitch and volume changes keep sounds heard hundreds of times from grating.
// Musical notes (combo climb, fanfares) pass jitter = false so they stay in tune.
function tone(freq, dur = 0.08, type = 'square', vol = 0.5, slideTo = 0, delay = 0, jitter = true) {
  if (!soundOn()) return;
  vol *= AU.trim;
  if (jitter) {
    const j = 1 + rand(-0.025, 0.025);
    freq *= j;
    if (slideTo) slideTo *= j;
    vol *= rand(0.9, 1.1);
  }
  const t = AU.ctx.currentTime + delay;
  const o = AU.ctx.createOscillator();
  const g = AU.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g);
  g.connect(AU.master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.08, vol = 0.4, freq = 1200, delay = 0) {
  if (!soundOn() || !AU.noiseBuf) return;
  freq *= 1 + rand(-0.05, 0.05);
  vol *= rand(0.9, 1.1) * AU.trim;
  const t = AU.ctx.currentTime + delay;
  const src = AU.ctx.createBufferSource();
  src.buffer = AU.noiseBuf;
  const f = AU.ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = AU.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(AU.master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Major pentatonic steps, so a long combo climbs as a melody that never sounds wrong.
const PENTA = [0, 2, 4, 7, 9];
function scaleNote(step, root = 523.25) {
  const s = Math.max(0, step);
  return root * Math.pow(2, (PENTA[s % 5] + 12 * Math.floor(s / 5)) / 12);
}

// One impact made of layers: a noise click, a tonal body and, for heavy hits, a low thump.
function impact(weight = 1) {
  noise(0.012, 0.25 + 0.1 * weight, 2400);
  tone(140 + 40 * weight, 0.06 + 0.03 * weight, 'square', 0.12 + 0.06 * weight, 70);
  if (weight >= 2) tone(75, 0.12, 'sine', 0.45, 45, 0, false);
}

const SFX = {
  hit() {
    const now = performance.now();
    if (now - AU.lastHit < 90) return;
    AU.lastHit = now;
    // Swings get brighter as tapping builds flow, so a faster rhythm also sounds hotter.
    const f = clamp((typeof R !== 'undefined' && R.flow) || 0, 0, 1);
    noise(0.04, 0.18 + 0.06 * f, 900 + 900 * f + Math.random() * 500);
  },
  crit() {
    impact(2);
    tone(880, 0.05, 'square', 0.12, 1320);
  },
  strike(kind) {
    if (kind === 'mega') {
      tone(220, 0.25, 'sawtooth', 0.35, 880);
      noise(0.25, 0.4, 400);
      return;
    }
    impact(kind === 'quick' ? 2 : 1.5);
    tone(330, 0.09, 'square', 0.22, 660);
  },
  // The two-note "ding" climbs a pentatonic scale with flow (built by tapping), and slides back
  // down once you stop. Full flow adds a sparkle on top.
  kill(flow = 0) {
    const step = Math.round(clamp(flow, 0, 1) * 7);
    const up = Math.pow(2, ([0, 2, 4, 7, 9, 12, 14, 16][step]) / 12);
    const gap = 0.05 * (1 - 0.4 * flow);
    impact(1.5);
    tone(988 * up, 0.05, 'square', 0.2);
    tone(1319 * up, 0.08, 'square', 0.2, 0, gap);
    if (step >= 6) tone(1976 * up, 0.06, 'triangle', 0.12, 0, gap * 2);
  },
  correct(streak) {
    // Climbs two octaves, then wraps around with a harmony layer so it still feels like rising.
    const step = (Math.max(1, streak) - 1) % 10;
    const lap = Math.floor((Math.max(1, streak) - 1) / 10);
    const f = scaleNote(step);
    tone(f, 0.08, 'triangle', 0.45, 0, 0, false);
    tone(f * 2, 0.06, 'square', 0.08, 0, 0.01, false);
    if (lap > 0) tone(f * 1.5, 0.1, 'triangle', 0.2, 0, 0.03, false);
  },
  comboBreak() {
    tone(392, 0.09, 'triangle', 0.25, 0, 0, false);
    tone(311, 0.14, 'triangle', 0.22, 0, 0.09, false);
  },
  rankUp(n) {
    [0, 4, 7, 12].forEach((s, i) => tone(523.25 * Math.pow(2, (s + n) / 12), 0.18, 'square', 0.18, 0, i * 0.035, false));
    noise(0.2, 0.15, 4000, 0.05);
  },
  // Exotic and up: a rising arpeggio over a held chord, longer and brighter for rarer tiers.
  ultra(r) {
    const steps = 6 + 2 * (r - ULTRA);
    for (let i = 0; i < steps; i++) tone(scaleNote(i + 5, 392), 0.22, 'square', 0.16, 0, 0.6 + i * 0.07, false);
    const end = 0.6 + steps * 0.07;
    [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, r - ULTRA)).forEach(st =>
      tone(523.25 * Math.pow(2, st / 12), 0.9 + 0.15 * (r - ULTRA), 'sawtooth', 0.1, 0, end, false));
    noise(0.6 + 0.1 * (r - ULTRA), 0.18, 5000, end);
  },
  pop() {
    tone(rand(700, 1000), 0.03, 'triangle', 0.12);
  },
  mgNote(i) {
    tone(scaleNote(i, 392), 0.14, 'triangle', 0.35, 0, 0, false);
  },
  quick() {
    tone(1568, 0.05, 'square', 0.18, 0, 0.08);
  },
  wrong() {
    tone(160, 0.22, 'sawtooth', 0.3, 80);
  },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.25, 0, i * 0.07));
  },
  tick(p = 0) {
    tone(1400 + p * 900, 0.018, 'square', 0.12);
  },
  reveal(r) {
    // Fanfare matches the real rarity: a Common gets a plain click, not a win jingle.
    if (r <= 0) { tone(660, 0.05, 'triangle', 0.2); return; }
    const base = [392, 440, 523, 659, 784][Math.min(r, 4)];
    const notes = r >= 3 ? [1, 1.25, 1.5, 2, 2.5] : r >= 2 ? [1, 1.25, 1.5, 2] : [1, 1.5];
    notes.forEach((m, i) => tone(base * m, 0.16, r >= 3 ? 'sawtooth' : 'square', 0.22, 0, i * 0.08));
    if (r >= 3) noise(0.4, 0.2, 3000, 0.1);
  },
  coin() {
    tone(1319, 0.05, 'square', 0.18);
    tone(1760, 0.09, 'square', 0.18, 0, 0.05);
  },
  buy() {
    tone(660, 0.05, 'square', 0.18);
    tone(880, 0.06, 'square', 0.15, 0, 0.04);
  },
  boss() {
    tone(110, 0.3, 'sawtooth', 0.3, 90);
    tone(98, 0.35, 'sawtooth', 0.3, 70, 0.3);
  },
  ore() {
    [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.07, 'triangle', 0.25, 0, i * 0.05));
  },
  claim() {
    [784, 988, 1175].forEach((f, i) => tone(f, 0.08, 'square', 0.2, 0, i * 0.06));
  },
  click() {
    tone(900, 0.02, 'square', 0.1);
  },
  error() {
    tone(200, 0.1, 'square', 0.2, 150);
  },
};

// Version 2: per-sound level trims, measured against the music as a phone speaker hears it, so
// everyday sounds sit just above the music, big moments a little louder, rapid taps a little softer.
function trimSounds(obj, trims) {
  for (const [k, tr] of Object.entries(trims)) {
    const f = obj[k];
    obj[k] = function (...a) { const prev = AU.trim; AU.trim = prev * (typeof tr === 'function' ? tr(...a) : tr); try { return f.apply(this, a); } finally { AU.trim = prev; } };
  }
}
trimSounds(SFX, {
  hit: 1.3, click: 1.26, kill: 0.5, crit: 0.64, coin: 0.65, buy: 0.8, claim: 0.63, correct: 0.46, comboBreak: 0.4,
  quick: 0.87, wrong: 0.68, ore: 0.72, mgNote: 0.4, strike: k => (k === 'mega' ? 0.66 : 0.4), levelup: 0.55,
  rankUp: 0.64, ultra: 0.72, reveal: r => (r <= 0 ? 1 : r < 3 ? 0.5 : 0.94),
});

function vibrate(pattern) {
  if (!S.settings.vibe || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* not supported */ }
}
