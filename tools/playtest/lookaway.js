// Look-away test: a player taps well, then stops for 1-3 s; how much multiplier do they lose?
// Serve the game on port 8123, then: node tools/playtest/lookaway.js
const { chromium } = require('playwright');
const { PERSONAS, AGENT_CODE } = require('./personas');
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.goto('http://127.0.0.1:8123/index.html'); await page.waitForTimeout(400);
  await page.addScriptTag({ content: AGENT_CODE });
  const out = await page.evaluate(PERSONAS => {
    R.sim = true; R.paused = true;
    const res = [];
    for (const k of ['C', 'D']) for (const shield of [false, true]) for (const away of [1, 2, 3]) {
      let lost = 0, before = 0, n = 0;
      for (let trial = 0; trial < 20; trial++) {
        S.math.streak = 0; setPace(0); R.paceHold = 0; R.shield = 0; R.shieldUntil = 0; R.cleanHits = 0;
        const a = makeAgent(PERSONAS[k]);
        for (let i = 0; i < 18000; i++) { agentTick(a, 0.01, true); if (!shield) R.shield = 0; }
        // Wait until the shield is ready (or just look away now if testing without it).
        for (let i = 0; i < 3000 && shield && !R.shield; i++) agentTick(a, 0.01, true);
        const m0 = comboMult();
        // Look away: no taps for `away` seconds; monsters keep coming and escaping.
        const saved = a.p; a.p = { ...a.p, mean: 1e9, sd: 0, lapse: 0, mistap: 0 }; a.cur = null;
        for (let i = 0; i < away * 100; i++) { agentTick(a, 0.01, true); if (!shield) R.shield = 0; }
        a.p = saved; a.cur = null;
        before += m0; lost += m0 - comboMult(); n++;
      }
      res.push(`${PERSONAS[k].name.padEnd(10)} look away ${away}s ${shield ? 'WITH shield' : 'no shield  '}: x${(before / n).toFixed(2)} -> x${((before - lost) / n).toFixed(2)}  (lost ${(lost / n).toFixed(2)})`);
    }
    return res;
  }, PERSONAS);
  console.log(out.join('\n'));
  await b.close();
})();
