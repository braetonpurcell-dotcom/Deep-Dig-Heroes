// Tap-pad test players. Mean/sd are ms per target, matched to Human Benchmark Aim Trainer
// percentiles (median ~380-500 ms, 300 ms ~ top 15%, 250 ms top 5%, 200 ms top 1%).
const PERSONAS = {
  A: { name: 'A Casual', mean: 750, sd: 150, lapse: 0.06, fatigue: 0.15, switchMs: 120, mistap: 0.06, pct: '~bottom 3%' },
  B: { name: 'B Relaxed', mean: 600, sd: 120, lapse: 0.04, fatigue: 0.10, switchMs: 100, mistap: 0.05, pct: '~20th pct' },
  C: { name: 'C Average', mean: 480, sd: 90, lapse: 0.03, fatigue: 0.08, switchMs: 90, mistap: 0.04, pct: '~median' },
  D: { name: 'D Gamer', mean: 350, sd: 70, lapse: 0.02, fatigue: 0.05, switchMs: 70, mistap: 0.03, pct: '~80th pct' },
  E: { name: 'E Pro', mean: 200, sd: 40, lapse: 0.01, fatigue: 0.03, switchMs: 50, mistap: 0.02, pct: '~top 1%' },
};

// In-page code: an event-driven player on the real tap-pad rules (tapDifficulty, tapHit, tapMiss),
// with the same spawn timing as tappad.js. Call agentTick(agent, dt) every frame.
const AGENT_CODE = `
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function makeAgent(p) { return { p, now: 0, targets: [], spawnT: 0.3, doneAt: 0, cur: null, hits: 0, misses: 0, perfects: 0, minutes: 0 }; }
function agentTick(a, dt, clock = false) {
  a.now += dt;
  if (clock) R.time += dt; // the tap-only probe runs without the game loop
  const p = a.p;
  const d = tapDifficulty();
  // Spawning, as in tappad.js
  a.spawnT -= dt;
  if (a.spawnT <= 0 && a.targets.length < d.max) {
    a.targets.push({ born: a.now, life: d.life });
    a.spawnT = d.life * (0.18 + Math.random() * 0.17);
  }
  // Escapes
  for (const t of a.targets.slice()) {
    if (a.now - t.born >= t.life) {
      a.targets.splice(a.targets.indexOf(t), 1);
      if (a.cur === t) a.cur = null;
      tapMiss(); a.misses++;
    }
  }
  // The player works through monsters oldest first.
  if (!a.cur && a.targets.length) {
    const t = a.targets[0];
    const fresh = a.now - t.born < 0.05; // just appeared: full reaction; already waiting: mostly movement
    const fat = 1 + p.fatigue * (a.now / 60) / 30;
    let ms = (p.mean + gauss() * p.sd) * fat * (fresh ? 1 : 0.7) + p.switchMs * (a.targets.length - 1);
    if (Math.random() < p.lapse) ms += 400 + Math.random() * 800; // looked away
    if (Math.random() < p.mistap) ms += 150 + Math.random() * 100; // missed the monster, tapped again
    a.cur = t; a.doneAt = a.now + Math.max(120, ms) / 1000;
  }
  if (a.cur && a.now >= a.doneAt) {
    const t = a.cur; a.cur = null;
    const i = a.targets.indexOf(t);
    if (i >= 0) {
      a.targets.splice(i, 1);
      const r = tapHit(1 - (a.now - t.born) / t.life);
      a.hits++; if (r.perfect) a.perfects++;
    }
  }
}`;
module.exports = { PERSONAS, AGENT_CODE };
