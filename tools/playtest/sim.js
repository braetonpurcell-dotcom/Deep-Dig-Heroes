// Balance simulator: a bot plays the real game code in headless Chromium at sim speed.
// Usage (from the repo root, with a static server on :8123):
//   node /opt/node22/lib/node_modules/http-server/bin/http-server . -p 8123 -c-1 -s &
//   PERSONA=C BASE=beta/ COMPACT=1 EVERY=99999 OVR='{"stallSec":90,"skillMode":"auto"}' \
//     NODE_PATH=/opt/node22/lib/node_modules node tools/playtest/sim.js 120
// argv[2] = minutes of play. PERSONA = A..E (reaction 750..200 ms, see personas.js).
// OVR (JSON): stallSec (prestige after N s without a new floor), prestigeAt (prestige at floor),
//   pushAt (minute to stop prestiging), skillMode 'auto' | branchPlan ['combo','strike',...],
//   tune {...TUNE overrides}, code '...' (extra JS run in the page).
// Prints SUMMARY {...} with best floor, power, bestMult, explore.ms (minute each floor milestone
// was first reached), explore.presT (minute of each prestige), explore.bestAtPres.
const { chromium } = require('playwright');
const { PERSONAS, AGENT_CODE } = require('./personas');
const PERSONA = process.env.PERSONA ? PERSONAS[process.env.PERSONA] : null;
const MINUTES = Number(process.argv[2] || 60);
const ANSWER_EVERY = Number(process.argv[3] || 3.5); // seconds between answers; 0 = idle player
const REACT = Number(process.argv[4] || 0.5); // mean reaction time in seconds for the tap bot
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/' + (process.env.BASE || '') + 'index.html');
  await page.waitForTimeout(500);
  const OVR = JSON.parse(process.env.OVR || '{}');
  await page.addScriptTag({ content: AGENT_CODE });
  const out = await page.evaluate(({ MINUTES, ANSWER_EVERY, REACT, EVERY, OVR, PERSONA }) => {
    if (OVR.tune) Object.assign(TUNE, OVR.tune);
    if (OVR.upg) for (const [id, v] of Object.entries(OVR.upg)) Object.assign(UPGRADES.find(u => u.id === id), v);
    if (OVR.cases) OVR.cases.forEach((b, i) => { CASES[i].base = b; });
    if (OVR.petPower) OVR.petPower.forEach((v, i) => { PET_POWER[i] = v; });
    if (OVR.rarityMult) OVR.rarityMult.forEach((v, i) => { RARITY_MULT[i] = v; });
    if (OVR.code) eval(OVR.code);
    recalc();
    R.paused = true;
    R.sim = true;
    closeModal(); UI.modalQueue = []; closeModal();
    const log = [];
    const dt = 0.05;
    let nextAnswer = Math.abs(ANSWER_EVERY); let nextDuel = 4;
    let lastMaxT = 0, lastMax = 0, bossWait = 0, lastMaxT0 = 0;
    const skillOrder = ['quickwit', 'momentum', 'greed', 'autodrill', 'quickwit', 'momentum', 'adrenaline', 'ironmind',
      'executioner', 'focus', 'overdrive', 'lucky', 'haggler', 'nightshift', 'deeppockets', 'oresense', 'compound', 'golddrill',
      'pity', 'scrapper', 'doubledown', 'keymaster', 'jackpot'];
    const firstPrestige = { t: null };
    const PLANS = {
      fighter: ['quickwit', 'momentum', 'adrenaline', 'ironmind', 'steady', 'perfectionist', 'executioner', 'overdrive', 'focus'],
      crit: ['seismic', 'quickwit', 'momentum', 'adrenaline', 'earthquake', 'executioner', 'ironmind'],
      tycoon: ['greed', 'autodrill', 'compound', 'quickwit', 'momentum', 'adrenaline', 'golddrill'],
      balanced: ['quickwit', 'momentum', 'greed', 'autodrill', 'adrenaline', 'seismic', 'ironmind', 'executioner', 'lucky', 'overdrive'],
    };
    const PLAN0 = ['quickwit', 'momentum', 'adrenaline', 'ironmind', 'steady', 'perfectionist', 'executioner', 'overdrive', 'limitbreak', 'focus',
      'greed', 'autodrill', 'seismic', 'lucky', 'haggler', 'doubledown', 'jackpot', 'compound', 'prospector', 'oresense', 'tunneler', 'pity', 'keymaster', 'scrapper', 'nightshift', 'deeppockets'];
    function stepToward(target) {
      // Shortest route from what you own to the target; learn the first unowned node on it.
      const prev = { core: null }; const q = ['core']; const owned = id => id === 'core' || skillRank(id) > 0;
      while (q.length) { const a = q.shift(); if (a === target) break; if (a !== 'core' && !owned(a)) continue;
        for (const o of TREE_ADJ[a] || []) if (!(o in prev)) { prev[o] = a; q.push(o); } }
      if (!(target in prev)) return false;
      let n = target; const path = [];
      while (n && n !== 'core') { path.unshift(n); n = prev[n]; }
      const first = path.find(id => !owned(id)) || target;
      return learnSkill(first);
    }
    function spendSkills() {
      if (OVR.skillMode === 'auto' && typeof autoSpendSkills === 'function') { autoSpendSkills(); return; }
      if (OVR.branchPlan && typeof SUB_INDEX !== 'undefined') {
        // Fill these branches completely (nodes, then the Mastery) in order; Auto for the rest.
        for (const sid of OVR.branchPlan) {
          const sb = SUB_INDEX[sid];
          learnTargets(sb.nodes.map(id => [id, SKILL_INDEX[id].max]));
          if (canLearn(sb.mastery)) learnSkill(sb.mastery);
          if (S.run.sp <= 0) return;
        }
        autoSpendSkills();
        return;
      }
      if (OVR.skillMode === 'plan' && typeof TREE_ADJ !== 'undefined') {
        let g = 0;
        while (S.run.sp > 0 && g++ < 300) {
          const PLAN = (PLANS[OVR.plan] || []).concat(PLAN0);
          const t = PLAN.find(id => SKILL_INDEX[id] && skillRank(id) < SKILL_INDEX[id].max);
          if (!t || !stepToward(t)) { const any = Object.keys(SKILL_INDEX).find(canLearn); if (!any || !learnSkill(any)) break; }
        }
        return;
      }
      let guard = 0;
      while (S.run.sp > 0 && guard++ < 200) {
        const id = skillOrder.find(canLearn) || Object.keys(SKILL_INDEX).find(canLearn);
        if (!id || !learnSkill(id)) break;
      }
    }
    function gearScore(it) { return it ? itemStats(it)[0].v : -1; }
    function manageGear() {
      for (const it of S.gear.bag.slice()) if (gearScore(it) > gearScore(S.gear.eq[it.slot])) equipItem(it.id);
      if (S.gear.bag.length > 40) salvageBelow(3);
    }
    function managePets() {
      mergeAllPets();
      S.pets.eq = [];
      const all = [];
      for (const sp of PET_IDS) for (let r = 0; r < RARITY.length; r++) for (let n = 0; n < S.pets.inv[sp][r]; n++) all.push({ sp, r, score: PET_POWER[r] * (sp === 'mole' || sp === 'drake' ? 1.2 : 1) });
      all.sort((a, b) => b.score - a.score);
      for (const p of all.slice(0, petSlots())) S.pets.eq.push({ sp: p.sp, r: p.r });
      recalc();
    }
    function spendCoins() {
      if ('caseKind' in S) S.caseKind = Math.random() < 0.3 ? 'pet' : 'tool';
      const c = CASES[bestCaseTier() - 1];
      { const share = OVR.caseShare || 0.2; let g = 0; while (caseCost(c) < S.coins * share && g++ < 50) openCase(c.tier, 'coins', 1); }
      while (S.keys > 0) openCase(bestCaseTier(), 'key', 1);
      if (freeCrateReady()) openCase(bestCaseTier(), 'free', 1);
      let guard = 0;
      while (guard++ < 500) {
        const opts = UPGRADES.filter(u => upgradeUnlocked(u)).map(u => ({ u, q: upgradeQuote(u, '1') })).filter(o => !o.q.maxed && o.q.afford);
        if (!opts.length) break;
        opts.sort((a, b) => a.q.cost * (a.u.id === 'sharpen' ? 0.5 : 1) - b.q.cost * (b.u.id === 'sharpen' ? 0.5 : 1));
        buyUpgrade(opts[0].u.id, '1');
      }
    }
    const EXPLORE = { runes: 0, reforges: 0, autoRolled: 0, coins: 0, ms: {}, presT: [] };
    { const _ac = addCoins; addCoins = n => { if (isFinite(n) && n > 0) EXPLORE.coins += n; return _ac(n); }; }
    function reforgeGear() {
      let g = 0;
      while (g++ < 30) {
        const eq = SLOT_IDS.map(k => S.gear.eq[k]).filter(it => it && it.lv < MAX_ITEM_LEVEL);
        if (!eq.length) break;
        eq.sort((a, b) => reforgeCost(a) - reforgeCost(b));
        if (!reforgeItem(eq[0].id)) break;
        EXPLORE.reforges++;
      }
    }
    function claims() {
      if (!S.daily.claimed) claimDaily();
      S.quests.list.forEach((q, i) => claimQuest(i));
      claimQuestBonus();
      for (const a of ACHIEVEMENTS) claimAchievement(a.id);
    }
    const agent = PERSONA ? makeAgent(PERSONA) : null;
    const total = MINUTES * 60;
    let tick = 0;
    for (let t = 0; t < total; t += dt) {
      // Version 2: an island's cave ends at its last floor; sail on to the next island like a player would.
      if (typeof canSailOn === 'function' && canSailOn()) sailToIsle(islandForFloor(S.run.floor) + 1);
      step(dt);
      if (PERSONA) { for (let k = 0; k < 5; k++) agentTick(agent, dt / 5); } else if (ANSWER_EVERY !== 0) {
        nextAnswer -= dt;
        if (nextAnswer <= 0) {
          // Tap bot: more monsters on screen means taps come faster but aiming takes longer.
          const d = tapDifficulty();
          const react = Math.max(0.18, REACT + (Math.random() - 0.5) * 0.3 + 0.03 * (d.max - 1));
          nextAnswer = clamp(0.9 / d.max + 0.25, 0.3, 1.0);
          if (react < d.life) tapHit(1 - react / d.life); else tapMiss();
        }
      }
      if (R.ore) {
        const res = collectOre();
        if (res && res.kind === 'rune') {
          // Play the rune mini-game: better reactions reach more rounds.
          const mean = PERSONA ? PERSONA.mean : 480;
          const level = Math.max(1, Math.round(3 + (750 - mean) / 180 + (Math.random() * 2 - 1)));
          runeReward(level); recordMinigame(res.game, res.game === 'reaction' ? mean : level);
          EXPLORE.runes++;
        }
      }
      if (bossWaiting()) { startBossDuel(); nextDuel = 4; }
      if (R.duel) { nextDuel -= dt; if (nextDuel <= 0) { nextDuel = 3 + Math.random() * 3; if (Math.random() < 0.85) duelHit(0.6 + Math.random() * 0.8); else duelMiss(); } }
      tick += dt;
      if (tick >= 1) {
        tick = 0;
        claims(); spendSkills(); spendCoins(); manageGear(); reforgeGear();
        // Auto-roll bursts: every 10 minutes, pour 60% of coins into the best case.
        if (Math.floor(t) % 600 === 0) { const c = CASES[bestCaseTier() - 1]; let g = 0; const stop = S.coins * 0.4;
          while (S.coins - caseCost(c) > stop && g++ < 400) { openCase(c.tier, 'coins', 1); EXPLORE.autoRolled++; } }
        if (Math.floor(t) % 10 === 0) managePets();
        if (S.run.maxFloor > lastMax) { lastMax = S.run.maxFloor; lastMaxT = t; }
        for (const m of [25, 50, 75, 100, 101, 150, 200, 201, 250, 301, 401]) if (EXPLORE.ms[m] == null && S.stats.bestFloor >= m) EXPLORE.ms[m] = +(t / 60).toFixed(1);
        if (!S.run.auto) { bossWait += 1; if (bossWait > 60) { bossWait = 0; retryBoss(); } }
        const PA = OVR.prestigeAt, ST_ = OVR.stallSec || 150;
        let wantP = (PA && S.run.maxFloor >= PA) || t - lastMaxT > (PA ? 600 : ST_);
        if (OVR.pushAt && t >= OVR.pushAt * 60) {
          wantP = !firstPrestige.pushed; // one last reset, then a clean push with no prestiging
          if (wantP) { firstPrestige.pushed = true; firstPrestige.pushCores = S.cores + (canPrestige() ? prestigeGain() : 0); firstPrestige.pushPres = S.prestiges + (canPrestige() ? 1 : 0); if (!canPrestige()) wantP = false; }
        }
        if (canPrestige() && wantP) {
          if (firstPrestige.t == null) firstPrestige.t = t;
          log.push({ event: 'prestige', min: +(t / 60).toFixed(1), floor: S.run.maxFloor, gain: prestigeGain() });
          EXPLORE.presT.push(+(t / 60).toFixed(1)); EXPLORE.lvlAtPres = (EXPLORE.lvlAtPres || []).concat(S.run.level); EXPLORE.bestAtPres = (EXPLORE.bestAtPres || []).concat(S.stats.bestFloor); if (typeof depthPast === 'function') EXPLORE.past = (EXPLORE.past || []).concat([[S.run.maxFloor, Math.round(powerFloors()), runStartFloor ? runStartFloor() : 0, Math.round((t - lastMaxT0) / 60)]]); lastMaxT0 = t;
          doPrestige(); lastMax = 0; lastMaxT = t;
          if (typeof buyPrestigeNode === 'function') {
            let g = 0;
            while (g++ < 200) {
              const ids = PRESTIGE_TREE.map(n => n.id).filter(id => id !== 'memory' || ptLevel('memory') < 10);
              ids.sort((a, b) => ptCost(a) - ptCost(b));
              if (!buyPrestigeNode(ids[0])) break;
            }
            // Lock the plan's first skills with the slots bought.
            for (const id of (PLANS[OVR.plan] || ['quickwit', 'momentum'])) while (canLockRank && canLockRank(id)) lockRank(id);
          }
        }
      }
      if (Math.floor((t + dt) / EVERY) > Math.floor(t / EVERY)) {
        log.push({ min: Math.round(t / 60), floor: S.run.floor, max: S.run.maxFloor, best: S.stats.bestFloor, lvl: S.run.level,
          dps: fmt(ST.dps), coins: fmt(S.coins), cores: S.cores, pres: S.prestiges, mult: comboMult().toFixed(2), pace: R.pace.toFixed(2),
          cases: S.stats.cases, keys: S.keys, streak: S.math.streak, pets: S.pets.eq.map(p => p.sp[0] + p.r).join(''),
          gear: SLOT_IDS.map(s => S.gear.eq[s] ? 'T' + S.gear.eq[s].t + 'r' + S.gear.eq[s].r : '-').join(','), boss: S.stats.bosses,
          mult: { base: fmt(ST.baseDmg), gearpet: (1 + ST.add.dmg).toFixed(1), crit: (1 + ST.critChance * (ST.critMult - 1)).toFixed(1), aps: ST.aps.toFixed(1),
            troph: S.trophies, coll: collectionCount(), coin: fmt(ST.coinMult), upg: JSON.stringify(S.run.upg) } });
      }
    }
    return { log, ach: Object.keys(S.ach.claimed).length, trophies: S.trophies,
      summary: { bestMult: +S.stats.bestMult.toFixed(2), rarest: S.best.all ? S.best.all.odds : 0, luck: +ST.luck.toFixed(2), aps: +ST.aps.toFixed(2), explore: EXPLORE, petsOwned: PET_IDS.reduce((a, id) => a + S.pets.inv[id].reduce((x, y) => x + y, 0), 0) + S.pets.eq.length, power: S.power, level: S.run.level, simv: window.SIMV ? { power: Math.round(SIMV.power), tokens: SIMV.tokens, spent: SIMV.spent, lockN: SIMV.lockN, tree: SIMV.tree } : null, pushCores: firstPrestige.pushCores, pushPres: firstPrestige.pushPres, best: S.stats.bestFloor, cores: S.cores, pres: S.prestiges, dmgFromCores: +(1 + TUNE.coreBonus * S.cores).toFixed(1), nowFloor: S.run.maxFloor } };
  }, { MINUTES, ANSWER_EVERY, REACT, PERSONA, EVERY: Number(process.env.EVERY || 120), OVR });
  if (process.env.COMPACT) {
    console.log(out.log.map(r => r.event ? `[P@${r.min}m B${r.floor} +${r.gain}]` : `${r.min}m:B${r.max}${r.pres ? '/p' + r.pres : ''} L${r.lvl}`).join('  '));
  } else for (const row of out.log) console.log(JSON.stringify(row));
  console.log('SUMMARY', JSON.stringify(out.summary));
  console.log('achievements', out.ach, 'errors', errors.length ? errors : 'none');
  await browser.close();
})();
