'use strict';
// Synthesized chiptune sound effects (no audio files) and vibration.

const AU = { ctx: null, master: null, noiseBuf: null, lastHit: 0 };

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

function tone(freq, dur = 0.08, type = 'square', vol = 0.5, slideTo = 0, delay = 0) {
  if (!soundOn()) return;
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

const SFX = {
  hit() {
    const now = performance.now();
    if (now - AU.lastHit < 90) return;
    AU.lastHit = now;
    noise(0.04, 0.18, 900 + Math.random() * 500);
  },
  crit() {
    noise(0.09, 0.35, 600);
    tone(110, 0.12, 'square', 0.25, 60);
  },
  strike(kind) {
    if (kind === 'mega') {
      tone(220, 0.25, 'sawtooth', 0.35, 880);
      noise(0.25, 0.4, 400);
      return;
    }
    tone(330, 0.09, 'square', 0.25, 660);
    noise(0.06, 0.25, 1500);
  },
  kill() {
    tone(988, 0.05, 'square', 0.2);
    tone(1319, 0.08, 'square', 0.2, 0, 0.05);
  },
  correct(streak) {
    const f = 523 * Math.pow(1.0595, Math.min(streak, 24));
    tone(f, 0.07, 'triangle', 0.45);
    tone(f * 1.5, 0.06, 'triangle', 0.25, 0, 0.04);
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
    const base = [392, 440, 523, 659, 784][r];
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

function vibrate(pattern) {
  if (!S.settings.vibe || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* not supported */ }
}
