// Persona playtest: five simulated players (750 ms to 200 ms per target) tap on the real game code.
// Serve the game on port 8123 (npx http-server -p 8123), then: node tools/playtest/persona-probe.js
// Tap pad only: 20 minutes of steady tapping per persona, sampled every 30 s.
const { chromium } = require('playwright');
const { PERSONAS, AGENT_CODE } = require('./personas');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://127.0.0.1:8123/index.html'); await page.waitForTimeout(400);
  await page.addScriptTag({ content: AGENT_CODE });
  const out = await page.evaluate(PERSONAS => {
    R.sim = true; R.paused = true;
    const res = {};
    for (const [k, p] of Object.entries(PERSONAS)) {
      S.math.streak = 0; setPace(0); R.paceHold = 0;
      const a = makeAgent(p); const series = []; const marks = {};
      let sumM = 0, sumP = 0, n = 0, h0 = 0, m0 = 0;
      for (let i = 0; i < 120000; i++) {
        const t = i / 100;
        agentTick(a, 0.01, true);
        for (const m of [0.25, 0.5]) if (!marks[m] && R.pace >= m) marks[m] = Math.round(t);
        if (i % 1500 === 0) series.push({ t: Math.round(t), pace: +R.pace.toFixed(3), mult: +comboMult().toFixed(2) });
        if (i > 30000) { sumM += comboMult(); sumP += R.pace; n++; }
        if (i === 30000) { h0 = a.hits; m0 = a.misses; }
      }
      const hits = a.hits - h0, misses = a.misses - m0;
      res[k] = { name: p.name, pct: p.pct, mean: p.mean, pace: sumP / n, mult: sumM / n, hit: hits / (hits + misses), perfect: a.perfects / a.hits,
        tapsPerMin: (hits + misses) / 15, ring: tapDifficulty().life, maxOn: tapDifficulty().max, to25: marks[0.25], to50: marks[0.5], series };
    }
    return res;
  }, PERSONAS);
  require('fs').writeFileSync(__dirname + '/persona-results.json', JSON.stringify(out));
  for (const r of Object.values(out)) {
    console.log(`${r.name.padEnd(10)} ${String(r.mean).padStart(3)}ms ${r.pct.padEnd(11)} pace ${(r.pace * 100).toFixed(0).padStart(3)}%  mult x${r.mult.toFixed(2)}  hits ${(r.hit * 100).toFixed(0)}%  perfect ${(r.perfect * 100).toFixed(0)}%  ${r.tapsPerMin.toFixed(0)} taps/min  ring ${r.ring.toFixed(2)}s  up to ${r.maxOn} at once  25%@${r.to25 ?? '-'}s 50%@${r.to50 ?? '-'}s`);
  }
  await b.close();
})();
