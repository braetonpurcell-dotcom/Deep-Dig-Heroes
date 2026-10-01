'use strict';
// Game rules: state, formulas, combat, math combos, cases, gear, pets, quests, prestige and saves.
// Nothing here touches the DOM. Visual and UI code listens through on()/emit().

const SAVE_KEY = 'ddh-save-v1';
const SAVE_VERSION = 1;
const KILLS_PER_FLOOR = 6;
const BOSS_TIME = 30;
const SPAWN_GAP = 0.45;
const ENTER_TIME = 0.25;
const TREASURE_CHANCE = 1 / 35;
const TREASURE_TIME = 10;
const COMBO_FADE_STEP = 0.8; // seconds per lost stack once the combo starts fading

// ---------- formulas ----------
// Balance knobs. Enemy health grows a little faster than coins, so every run
// eventually hits a wall that prestige cores push further back.
const TUNE = {
  hpBase: 6, hpGrowth: 1.25, hpLinear: 0.015,
  coinGrowth: 1.15,
  xpGrowth: 1.10, xpNeedBase: 12, xpNeedGrowth: 1.25,
  sharpenPeriod: 25,
  coreScale: 1, coreExp: 1.5, coreBonus: 0.1,
};
function hpFor(f) { return TUNE.hpBase * Math.pow(TUNE.hpGrowth, f - 1) * (1 + TUNE.hpLinear * (f - 1)); }
function coinUnit(f) { return Math.pow(TUNE.coinGrowth, f - 1) * (1 + TUNE.hpLinear * (f - 1)); }
function xpUnit(f) { return Math.pow(TUNE.xpGrowth, f - 1); }
function xpNeed(level) { return Math.floor(TUNE.xpNeedBase * Math.pow(TUNE.xpNeedGrowth, level - 1)); }
function sharpenDamage(L) {
  return (2 + L) * Math.pow(2, Math.floor(L / TUNE.sharpenPeriod));
}
function upgradeCost(u, level) { return Math.ceil(u.base * Math.pow(u.growth, level)); }
function coresFor(f) { return f < 25 ? 0 : Math.floor(TUNE.coreScale * Math.pow((f - 15) / 5, TUNE.coreExp)); }
function strikeSeconds(tier) { return 1.2 + 0.25 * tier; }
function targetTime(tier) { return 2.5 + 0.9 * tier; }
function isBossFloor(f) { return f % 10 === 0; }
function biomeIndex(f) { return Math.floor((f - 1) / FLOORS_PER_BIOME); }
function biomeFor(f) { return BIOMES[biomeIndex(f) % BIOMES.length]; }
function biomeName(f) {
  const i = biomeIndex(f);
  const cycle = Math.floor(i / BIOMES.length);
  const roman = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  return BIOMES[i % BIOMES.length].name + roman[Math.min(cycle, roman.length - 1)];
}

// ---------- events ----------
const listeners = {};
function on(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); }
function emit(type, data) {
  if (R.sim) return;
  const ls = listeners[type];
  if (ls) for (const fn of ls) fn(data);
}

// ---------- state ----------
function freshRun() {
  return {
    floor: 1, maxFloor: 1, kills: 0, auto: true,
    level: 1, xp: 0, sp: 0, skills: {}, upg: {}, bossDone: {}, cases: 0,
    started: Date.now(), recordAnnounced: false,
  };
}

function freshState() {
  const inv = {};
  for (const id of PET_IDS) inv[id] = [0, 0, 0, 0, 0];
  return {
    v: SAVE_VERSION, created: Date.now(), savedAt: 0, lastSeen: Date.now(),
    coins: 0, keys: 0, scrap: 0, cores: 0, trophies: 0, prestiges: 0, nextId: 1,
    run: freshRun(),
    math: { rating: 1, streak: 0 },
    gear: { eq: { pick: null, helm: null, charm: null }, bag: [] },
    pets: { inv, eq: [] },
    pity: { epic: 0, leg: 0 },
    coll: {},
    daily: { day: '', streak: 0, claimed: true },
    quests: { day: '', list: [], bonus: false },
    ach: { done: {}, claimed: {} },
    freeCrateAt: 0,
    boostUntil: 0,
    stats: {
      playTime: 0, kills: 0, bosses: 0, correct: 0, wrong: 0, skipped: 0, answerTime: 0, fastest: 0,
      bestStreak: 0, bestMath: 1, cases: 0, bestDrop: -1, coinsEarned: 0, merges: 0, ores: 0, goldies: 0,
      prestiges: 0, bestFloor: 1, maxHit: 0, dailyDone: 0, bestLogin: 0, days: {},
    },
    settings: {
      sound: true, vibe: true, answer: 'keypad', mathMode: 'adaptive', mathTier: 3,
      autoSalvage: 0, wake: false, breakMin: 0, buyAmt: '1',
    },
  };
}

function deepMerge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(src)) {
    const v = src[k];
    const b = base[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) deepMerge(b, v);
    else base[k] = v;
  }
  return base;
}

// Fill in anything a save from an older version is missing and repair impossible values.
function hydrate(obj) {
  const s = deepMerge(freshState(), obj || {});
  for (const k of ['coins', 'keys', 'scrap', 'cores', 'trophies', 'prestiges']) {
    if (!isFinite(s[k]) || s[k] < 0) s[k] = 0;
  }
  for (const id of PET_IDS) {
    const arr = s.pets.inv[id];
    if (!Array.isArray(arr) || arr.length !== 5) s.pets.inv[id] = [0, 0, 0, 0, 0];
  }
  s.pets.eq = (s.pets.eq || []).filter(p => p && PETS[p.sp] && p.r >= 0 && p.r <= 4);
  s.gear.bag = (s.gear.bag || []).filter(it => it && SLOTS[it.slot]);
  if (s.run.floor < 1) s.run.floor = 1;
  if (s.run.maxFloor < s.run.floor) s.run.maxFloor = s.run.floor;
  return s;
}

let S = freshState();
let ST = null;

// Runtime values that are not saved.
const R = {
  sim: false, paused: false, time: 0, session: 0, secT: 0, dayKey: '',
  enemy: null, spawnT: 0.6, atkT: 0, swingT: 0, queued: [],
  prob: null, probStart: 0, input: '', choices: null,
  lastAnswer: -99, decayAcc: 0,
  frenzyT: 0, ore: null, oreT: 40,
  boostOn: false, bonusRound: null,
};

// ---------- derived stats ----------
function skillRank(id) { return S.run.skills[id] || 0; }
function upgradeLevel(id) { return S.run.upg[id] || 0; }
function branchPoints(bid) {
  let p = 0;
  for (const b of BRANCHES) if (b.id === bid) for (const n of b.nodes) p += skillRank(n.id);
  return p;
}
function collectionCount() { return Object.keys(S.coll).length; }

function computeStats() {
  const sk = skillRank;
  const up = upgradeLevel;
  const add = { dmg: 0, coin: 0, luck: 0, aps: 0, crit: 0, critdmg: 0, xp: 0, strike: 0 };
  for (const slot of SLOT_IDS) {
    const it = S.gear.eq[slot];
    if (it) for (const s of itemStats(it)) add[s.k] += s.v;
  }
  for (const p of S.pets.eq) {
    const def = PETS[p.sp];
    for (const k in def.stats) add[k] += def.stats[k] * PET_POWER[p.r];
  }
  const trophy = 1 + TROPHY_BONUS * S.trophies;
  const coll = 1 + COLLECTION_BONUS * collectionCount();
  const st = { add };
  st.baseDmg = sharpenDamage(up('sharpen'));
  st.dmgMult = (1 + add.dmg) * (1 + 0.02 * branchPoints('brawler')) * (1 + TUNE.coreBonus * S.cores) * trophy * coll;
  st.hit = st.baseDmg * st.dmgMult;
  st.aps = 1.25 * (1 + 0.04 * up('fury')) * (1 + add.aps + 0.1 * sk('autodrill'));
  st.critChance = Math.min(0.75, 0.05 + 0.015 * up('crit') + add.crit);
  st.critMult = 2 + 0.15 * up('critdmg') + add.critdmg;
  st.dps = st.hit * st.aps * (1 + st.critChance * (st.critMult - 1));
  st.strikeMult = (1 + 0.1 * up('brain')) * (1 + 0.2 * sk('quickwit')) * (1 + add.strike);
  st.comboPer = 0.05 + 0.01 * sk('adrenaline');
  st.comboCap = 20 + 4 * sk('momentum');
  st.comboKeep = 0.5 + 0.1 * sk('ironmind');
  st.decay = 6 + 2 * sk('focus');
  st.bossMult = 1 + 0.3 * sk('executioner');
  st.overdrive = sk('overdrive') > 0;
  st.goldDrill = sk('golddrill') > 0 ? 2.5 : 1;
  st.boost = Date.now() < S.boostUntil ? 2 : 1;
  st.coinMult = (1 + 0.1 * up('magnet')) * (1 + add.coin) * (1 + 0.15 * sk('greed'))
    * (1 + 0.02 * branchPoints('tycoon')) * (1 + 0.003 * sk('compound') * S.run.maxFloor)
    * trophy * coll * st.boost;
  st.xpMult = (1 + 0.1 * up('scholar')) * (1 + add.xp);
  st.luck = add.luck + 0.1 * sk('lucky') + 0.02 * branchPoints('gambler');
  st.caseDiscount = 0.06 * sk('haggler');
  st.epicPity = EPIC_PITY - 2 * sk('pity');
  st.scrapMult = 1 + 0.25 * sk('scrapper');
  st.bonusItem = 0.06 * sk('doubledown');
  st.bonusKey = 0.25 * sk('keymaster');
  st.jackpot = sk('jackpot') > 0 ? 2 : 1;
  st.offlineRate = 0.4 + 0.1 * sk('nightshift');
  st.offlineCap = (4 + 2 * sk('deeppockets')) * 3600;
  st.oreRate = 1 + 0.2 * sk('oresense');
  return st;
}

function recalc() {
  ST = computeStats();
  emit('stats');
}

function comboMult() { return 1 + ST.comboPer * Math.min(S.math.streak, ST.comboCap); }

function addCoins(n) {
  if (!isFinite(n) || n <= 0) return;
  S.coins += n;
  S.stats.coinsEarned += n;
}

function gainXp(x) {
  if (!isFinite(x) || x <= 0) return;
  const run = S.run;
  run.xp += x;
  let ups = 0;
  while (run.xp >= xpNeed(run.level)) {
    run.xp -= xpNeed(run.level);
    run.level++;
    run.sp++;
    ups++;
    if (ups > 500) { run.xp = 0; break; }
  }
  if (ups) emit('levelup', { level: run.level, ups });
}

// ---------- combat ----------
function spawnEnemy() {
  const f = S.run.floor;
  const biome = biomeFor(f);
  let type;
  const boss = isBossFloor(f);
  if (boss) type = BOSS_ORDER[(f / 10) % BOSS_ORDER.length];
  else if (f >= ENEMIES.goldie.minFloor && Math.random() < TREASURE_CHANCE) type = 'goldie';
  else type = weightedPick(NORMAL_ENEMIES.filter(t => ENEMIES[t].minFloor <= f), t => ENEMIES[t].weight);
  const hp = hpFor(f) * ENEMIES[type].hp * (boss ? 10 : 1);
  const name = boss ? `${biome.adj} ${BOSS_NAMES[type]}` : ENEMIES[type].name(biome);
  R.enemy = {
    type, boss, name, hp, max: hp, enter: ENTER_TIME, flash: 0,
    timer: boss ? BOSS_TIME : 0, flee: type === 'goldie' ? TREASURE_TIME : 0, seed: Math.random() * 10,
  };
  R.atkT = 0;
  emit('spawn', R.enemy);
}

function situational(e) {
  let m = 1;
  if (R.frenzyT > 0) m *= 3;
  if (e.boss) m *= ST.bossMult;
  if (S.math.streak === 0) m *= ST.goldDrill;
  return m;
}

function heroHit(e) {
  const crit = Math.random() < ST.critChance;
  const d = ST.hit * comboMult() * situational(e) * (crit ? ST.critMult : 1);
  R.swingT = Math.min(0.22, 0.7 / ST.aps);
  dealDamage(e, d, crit ? 'crit' : 'hit');
}

function dealDamage(e, d, kind) {
  e.hp -= d;
  e.flash = 0.07;
  if (d > S.stats.maxHit) S.stats.maxHit = d;
  emit('damage', { d, kind, enemy: e });
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const f = S.run.floor;
  const def = ENEMIES[e.type];
  let coins = coinUnit(f) * def.coin * ST.coinMult;
  let xp = xpUnit(f) * def.xp * ST.xpMult;
  if (e.boss) { coins *= 10; xp *= 8; }
  addCoins(coins);
  S.stats.kills++;
  track('kill');
  R.enemy = null;
  R.spawnT = SPAWN_GAP;
  R.atkT = 0;
  emit('kill', { enemy: e, coins });
  if (e.type === 'goldie') {
    S.keys++;
    S.stats.goldies++;
    emit('treasure', {});
  }
  if (e.boss) {
    S.stats.bosses++;
    track('boss');
    if (!S.run.bossDone[f]) {
      S.run.bossDone[f] = 1;
      const k = 1 + (Math.random() < ST.bonusKey ? 1 : 0);
      S.keys += k;
      emit('bossDown', { keys: k, name: e.name });
    } else {
      emit('bossDown', { keys: 0, name: e.name });
    }
    floorCleared();
  } else {
    S.run.kills++;
    if (S.run.kills >= KILLS_PER_FLOOR) floorCleared();
  }
  gainXp(xp);
}

function floorCleared() {
  S.run.kills = 0;
  track('floor');
  if (S.run.auto) changeFloor(S.run.floor + 1);
}

function changeFloor(f) {
  f = Math.max(1, Math.floor(f));
  const oldBiome = biomeIndex(S.run.floor);
  S.run.floor = f;
  S.run.kills = 0;
  R.enemy = null;
  R.spawnT = SPAWN_GAP;
  R.atkT = 0;
  if (f > S.run.maxFloor) {
    S.run.maxFloor = f;
    if (skillRank('compound')) recalc();
  }
  if (f > S.stats.bestFloor) {
    const prev = S.stats.bestFloor;
    S.stats.bestFloor = f;
    emit('bestFloor', { floor: f, prev });
    if (!S.run.recordAnnounced && prev >= 10 && S.prestiges > 0) {
      S.run.recordAnnounced = true;
      emit('record', { floor: f });
    }
  }
  emit('floor', { floor: f, newBiome: biomeIndex(f) !== oldBiome });
}

function bossFailed() {
  S.run.auto = false;
  emit('bossFail', {});
  changeFloor(S.run.floor - 1);
}

function treasureEscaped() {
  R.enemy = null;
  R.spawnT = SPAWN_GAP;
  emit('treasureEscaped', {});
}

// Player moving between floors. Going up turns auto-advance off so you can farm.
function moveFloor(delta) {
  const f = S.run.floor + delta;
  if (f < 1 || f > S.run.maxFloor) return false;
  if (delta < 0) S.run.auto = false;
  changeFloor(f);
  return true;
}

function setAuto(onOff) {
  S.run.auto = onOff;
}

function retryBoss() {
  const next = S.run.floor + 1;
  if (!isBossFloor(next) || next > S.run.maxFloor) return false;
  S.run.auto = true;
  changeFloor(next);
  return true;
}

function canRetryBoss() {
  const next = S.run.floor + 1;
  return !S.run.auto && isBossFloor(next) && next <= S.run.maxFloor;
}

// ---------- math combos ----------
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function genProblem(tier) {
  let text;
  let answer;
  let prompt = '?';
  const r = randi;
  switch (tier) {
    case 1: { const a = r(1, 9), b = r(1, 9); text = `${a} + ${b}`; answer = a + b; break; }
    case 2: { const a = r(6, 20), b = r(1, a - 1); text = `${a} − ${b}`; answer = a - b; break; }
    case 3: { const a = r(2, 9), b = r(2, 9); text = `${a} × ${b}`; answer = a * b; break; }
    case 4: {
      if (Math.random() < 0.5) { const a = r(12, 89), b = r(3, 9); text = `${a} + ${b}`; answer = a + b; }
      else { const a = r(21, 99), b = r(3, 9); text = `${a} − ${b}`; answer = a - b; }
      break;
    }
    case 5: { const b = r(2, 9), q = r(2, 12); text = `${b * q} ÷ ${b}`; answer = q; break; }
    case 6: {
      if (Math.random() < 0.5) { const a = r(15, 89), b = r(15, 89); text = `${a} + ${b}`; answer = a + b; }
      else { const a = r(40, 99), b = r(12, a - 5); text = `${a} − ${b}`; answer = a - b; }
      break;
    }
    case 7: { const a = r(11, 25), b = r(3, 9); text = `${a} × ${b}`; answer = a * b; break; }
    case 8: {
      const a = r(3, 9), b = r(3, 9), c = r(2, 30);
      if (Math.random() < 0.5) { text = `${a} × ${b} + ${c}`; answer = a * b + c; }
      else { const cc = Math.min(c, a * b - 1); text = `${a} × ${b} − ${cc}`; answer = a * b - cc; }
      break;
    }
    case 9: {
      if (Math.random() < 0.5) {
        const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
        const stepN = 100 / gcd(p, 100);
        const n = stepN * r(1, Math.max(1, Math.floor(400 / stepN)));
        text = `${p}% of ${n}`;
        answer = (p * n) / 100;
      } else {
        const a = r(11, 25);
        text = `${a}²`;
        answer = a * a;
      }
      break;
    }
    case 10: {
      const x = r(2, 12), m = r(2, 9), b = r(1, 30);
      text = `${m}x + ${b} = ${m * x + b}`;
      answer = x;
      prompt = 'x = ?';
      break;
    }
    case 11: { const a = r(12, 39), b = r(11, 29); text = `${a} × ${b}`; answer = a * b; break; }
    default: {
      const v = r(1, 3);
      if (v === 1) { const a = r(3, 15), b = r(2, 15), c = r(3, 9); text = `(${a} + ${b}) × ${c}`; answer = (a + b) * c; }
      else if (v === 2) { const b = r(3, 9), q = r(14, 99); text = `${b * q} ÷ ${b}`; answer = q; }
      else { const a = r(11, 30), b = r(2, a - 1); text = `${a}² − ${b}²`; answer = a * a - b * b; }
    }
  }
  return { tier, text, answer, prompt };
}

function pickTier() {
  if (S.settings.mathMode === 'fixed') return clamp(S.settings.mathTier, 1, 12);
  const base = Math.floor(S.math.rating);
  const roll = Math.random();
  const t = roll < 0.15 ? base - 1 : roll < 0.85 ? base : base + 1;
  return clamp(t, 1, 12);
}

function makeChoices(ans) {
  const set = new Set([ans]);
  const swapped = Number(String(ans).split('').reverse().join(''));
  const cands = shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10, ans + 5, ans - 5, swapped,
    ans + 9, ans - 9, Math.round(ans * 1.1), Math.round(ans * 0.9)]);
  for (const c of cands) {
    if (set.size >= 4) break;
    if (Number.isInteger(c) && c > 0 && c !== ans) set.add(c);
  }
  let k = 3;
  while (set.size < 4) set.add(ans + k++);
  return shuffle([...set]);
}

function newProblem() {
  R.prob = genProblem(pickTier());
  R.probStart = R.time;
  R.input = '';
  R.choices = makeChoices(R.prob.answer);
  emit('problem', R.prob);
}

function submitAnswer(value) {
  const p = R.prob;
  if (!p) return null;
  const dt = R.time - R.probStart;
  const res = value === p.answer ? answerCorrect(p, dt) : answerWrong(p, value);
  newProblem();
  emit('answer', res);
  return res;
}

function answerCorrect(p, dt) {
  const T = targetTime(p.tier);
  const quick = dt <= T * 0.6;
  S.math.streak++;
  R.lastAnswer = R.time;
  R.decayAcc = 0;
  const st = S.stats;
  st.correct++;
  st.answerTime += dt;
  if (!st.fastest || dt < st.fastest) st.fastest = dt;
  let streakRecord = false;
  if (S.math.streak > st.bestStreak) {
    if (st.bestStreak >= 10 && S.math.streak === st.bestStreak + 1) streakRecord = true;
    st.bestStreak = S.math.streak;
  }
  if (S.settings.mathMode === 'adaptive') {
    const atLevel = p.tier >= Math.floor(S.math.rating);
    const gain = quick ? 0.2 : dt <= T ? 0.1 : 0.02;
    S.math.rating = clamp(S.math.rating + gain * (atLevel ? 1 : 0.4), 1, 12.99);
  }
  st.bestMath = Math.max(st.bestMath, Math.floor(S.math.rating));
  let mult = strikeSeconds(p.tier) * ST.strikeMult;
  if (quick) mult *= 1.5;
  const mega = ST.overdrive && S.math.streak % 10 === 0;
  if (mega) mult *= 5;
  queueStrike(mult, mega ? 'mega' : quick ? 'quick' : 'strike');
  gainXp(xpUnit(S.run.floor) * (0.5 + 0.25 * p.tier) * ST.xpMult);
  track('solve');
  if (quick) track('quick');
  track('streak', 0, S.math.streak);
  let bonus = null;
  if (R.bonusRound) {
    R.bonusRound.done++;
    if (R.bonusRound.done >= R.bonusRound.need) bonus = finishBonusRound(true);
  }
  return { ok: true, quick, mega, dt, streak: S.math.streak, streakRecord, bonus, tier: p.tier };
}

function answerWrong(p, value) {
  S.stats.wrong++;
  const before = S.math.streak;
  S.math.streak = Math.floor(S.math.streak * ST.comboKeep);
  if (S.settings.mathMode === 'adaptive') S.math.rating = clamp(S.math.rating - 0.4, 1, 12.99);
  let bonus = null;
  if (R.bonusRound) bonus = finishBonusRound(false);
  return { ok: false, answer: p.answer, text: p.text, given: value, lost: before - S.math.streak, bonus };
}

function skipProblem() {
  if (!R.prob) return;
  S.stats.skipped++;
  S.math.streak = Math.floor(S.math.streak * Math.max(0.5, ST.comboKeep));
  if (S.settings.mathMode === 'adaptive') S.math.rating = clamp(S.math.rating - 0.25, 1, 12.99);
  const p = R.prob;
  let bonus = null;
  if (R.bonusRound) bonus = finishBonusRound(false);
  newProblem();
  emit('answer', { ok: false, skipped: true, answer: p.answer, text: p.text, bonus });
}

function queueStrike(mult, kind) {
  const e = R.enemy;
  if (e && e.enter <= 0) strike(e, mult, kind);
  else if (R.queued.length < 5) R.queued.push({ mult, kind });
}

function strike(e, mult, kind) {
  const crit = Math.random() < ST.critChance;
  const d = ST.hit * ST.aps * mult * comboMult() * situational(e) * (crit ? ST.critMult : 1);
  R.swingT = 0.22;
  emit('strike', { kind, crit });
  dealDamage(e, d, kind === 'mega' ? 'mega' : crit ? 'critstrike' : 'strike');
}

function startBonusRound(reward) {
  R.bonusRound = { need: 5, done: 0, reward };
  emit('bonusRound', R.bonusRound);
}

function finishBonusRound(won) {
  const b = R.bonusRound;
  R.bonusRound = null;
  if (won) {
    addCoins(b.reward.coins);
    gainXp(b.reward.xp);
  }
  return { won, reward: b.reward };
}

// ---------- lucky ore and frenzy ----------
function updateOre(dt) {
  if (R.ore) {
    R.ore.life -= dt;
    if (R.ore.life <= 0) R.ore = null;
    return;
  }
  R.oreT -= dt * ST.oreRate;
  if (R.oreT <= 0) {
    R.oreT = rand(45, 100);
    R.ore = { x: rand(66, 142), y: rand(14, 40), life: 6, max: 6 };
    emit('oreSpawn', R.ore);
  }
}

function collectOre() {
  if (!R.ore) return null;
  const o = R.ore;
  R.ore = null;
  S.stats.ores++;
  track('ore');
  const roll = Math.random();
  let res;
  if (roll < 0.6) {
    const c = Math.max(25, idleRates().coins * 60);
    addCoins(c);
    res = { kind: 'coins', amount: c };
  } else if (roll < 0.85) {
    S.keys++;
    res = { kind: 'key' };
  } else {
    R.frenzyT = 15;
    res = { kind: 'frenzy' };
  }
  emit('oreCollect', { x: o.x, y: o.y, res });
  return res;
}

// ---------- main simulation step ----------
function step(dt) {
  R.time += dt;
  if (!R.sim) {
    S.stats.playTime += dt;
    R.session += dt;
    if (R.dayKey) S.stats.days[R.dayKey] = (S.stats.days[R.dayKey] || 0) + dt;
  }
  if (R.frenzyT > 0) R.frenzyT = Math.max(0, R.frenzyT - dt);
  if (R.swingT > 0) R.swingT = Math.max(0, R.swingT - dt);

  if (S.math.streak > 0 && R.time - R.lastAnswer > ST.decay) {
    R.decayAcc += dt;
    while (R.decayAcc >= COMBO_FADE_STEP && S.math.streak > 0) {
      R.decayAcc -= COMBO_FADE_STEP;
      S.math.streak--;
    }
  }

  const e = R.enemy;
  if (!e) {
    R.spawnT -= dt;
    if (R.spawnT <= 0) spawnEnemy();
  } else if (e.enter > 0) {
    e.enter -= dt;
  } else {
    while (R.queued.length && R.enemy === e) {
      const q = R.queued.shift();
      strike(e, q.mult, q.kind);
    }
    if (R.enemy === e) {
      R.atkT += dt;
      const iv = 1 / ST.aps;
      let n = 0;
      while (R.atkT >= iv && R.enemy === e && n < 40) {
        R.atkT -= iv;
        heroHit(e);
        n++;
      }
      if (R.atkT > iv) R.atkT = iv;
    }
    if (R.enemy === e) {
      if (e.boss) {
        e.timer -= dt;
        if (e.timer <= 0) bossFailed();
      } else if (e.type === 'goldie') {
        e.flee -= dt;
        if (e.flee <= 0) treasureEscaped();
      }
    }
  }
  if (e && e.flash > 0) e.flash -= dt;

  updateOre(dt);

  R.secT += dt;
  if (R.secT >= 1) {
    R.secT -= 1;
    housekeeping();
  }
}

function housekeeping() {
  const boostOn = Date.now() < S.boostUntil;
  if (boostOn !== R.boostOn) {
    R.boostOn = boostOn;
    recalc();
  }
  const dk = dateKey();
  if (dk !== R.dayKey) {
    R.dayKey = dk;
    ensureDay();
    pruneDays();
  }
  checkAchievements();
}

// ---------- forge ----------
function upgradeUnlocked(u) { return S.stats.bestFloor >= u.unlock; }

function upgradeQuote(u, mode) {
  const L0 = upgradeLevel(u.id);
  const max = u.max == null ? Infinity : u.max;
  if (L0 >= max) return { n: 0, cost: 0, afford: false, maxed: true };
  let L = L0;
  let n = 0;
  let cost = 0;
  if (mode === 'max') {
    while (L < max && n < 1000) {
      const c = upgradeCost(u, L);
      if (cost + c > S.coins) break;
      cost += c;
      L++;
      n++;
    }
    if (n === 0) return { n: 1, cost: upgradeCost(u, L0), afford: false, maxed: false };
    return { n, cost, afford: true, maxed: false };
  }
  const want = Number(mode) || 1;
  while (L < max && n < want) {
    cost += upgradeCost(u, L);
    L++;
    n++;
  }
  return { n, cost, afford: cost <= S.coins, maxed: false };
}

function buyUpgrade(id, mode = S.settings.buyAmt) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || !upgradeUnlocked(u)) return false;
  const q = upgradeQuote(u, mode);
  if (!q.afford || q.n <= 0) return false;
  S.coins -= q.cost;
  S.run.upg[id] = upgradeLevel(id) + q.n;
  track('upg', q.n);
  recalc();
  return true;
}

// ---------- skills ----------
function canLearn(id) {
  const n = SKILL_INDEX[id];
  if (!n) return false;
  return S.run.sp > 0 && skillRank(id) < n.max && branchPoints(n.branch) >= TIER_REQ[n.tier];
}

function learnSkill(id) {
  if (!canLearn(id)) return false;
  S.run.skills[id] = skillRank(id) + 1;
  S.run.sp--;
  recalc();
  return true;
}

function respecSkills() {
  let refund = 0;
  for (const k in S.run.skills) refund += S.run.skills[k];
  S.run.skills = {};
  S.run.sp += refund;
  recalc();
  return refund;
}

// ---------- cases ----------
function caseUnlocked(c) { return S.prestiges >= c.prestige; }
function bestCaseTier() {
  let t = 1;
  for (const c of CASES) if (caseUnlocked(c)) t = c.tier;
  return t;
}
function caseCost(c) {
  const runInflation = Math.pow(CASE_INFLATION, S.run.cases || 0);
  return Math.ceil(c.base * coinUnit(S.run.maxFloor) * runInflation * (1 - ST.caseDiscount));
}
function freeCrateReady() { return Date.now() >= S.freeCrateAt; }

function rarityWeights(minR = 0) {
  const L = 1 + Math.max(0, ST.luck);
  return RARITY.map((r, i) => (i < minR ? 0 : r.weight * Math.pow(L, 0.35 * i) * (i >= 3 ? ST.jackpot : 1)));
}

function rarityOdds() {
  const ws = rarityWeights(0);
  const tot = ws.reduce((a, b) => a + b, 0);
  return ws.map(w => w / tot);
}

function rollRarity(minR = 0) {
  let lo = minR;
  if (S.pity.leg + 1 >= LEGENDARY_PITY) lo = Math.max(lo, 3);
  else if (S.pity.epic + 1 >= ST.epicPity) lo = Math.max(lo, 2);
  const r = weightedIndex(rarityWeights(lo));
  if (r >= 3) { S.pity.leg = 0; S.pity.epic = 0; }
  else if (r === 2) { S.pity.epic = 0; S.pity.leg++; }
  else { S.pity.epic++; S.pity.leg++; }
  return r;
}

function rollDrop(tier, minR = 0) {
  const r = rollRarity(minR);
  if (Math.random() < PET_CHANCE) {
    return { kind: 'pet', sp: weightedPick(PET_IDS, id => PETS[id].weight), r };
  }
  const slot = weightedPick(SLOT_IDS, s => SLOTS[s].weight);
  const main = SLOTS[slot].main;
  const subs = shuffle(SUB_POOL.filter(k => k !== main))
    .slice(0, SUB_COUNT[r])
    .map(k => ({ k, roll: Math.round(rand(0.7, 1.3) * 1000) / 1000 }));
  const item = { id: S.nextId++, slot, r, t: tier, fl: Math.round(Math.random() * 10000) / 10000, lv: 0, subs, isNew: true };
  return { kind: 'gear', r, item };
}

function grantDrop(d) {
  if (d.r > S.stats.bestDrop) S.stats.bestDrop = d.r;
  if (d.kind === 'pet') {
    S.pets.inv[d.sp][d.r]++;
    markCollection('pet', d.sp, d.r);
    if (S.pets.eq.length < petSlots()) equipPet(d.sp, d.r);
    d.isNewPet = true;
    return;
  }
  const it = d.item;
  markCollection('gear', it.slot, it.r);
  if (!S.gear.eq[it.slot]) {
    it.isNew = false;
    S.gear.eq[it.slot] = it;
    d.autoEquipped = true;
    return;
  }
  if (it.r < S.settings.autoSalvage || S.gear.bag.length >= BAG_SIZE) {
    const v = scrapValue(it);
    S.scrap += v;
    d.salvaged = v;
    return;
  }
  S.gear.bag.unshift(it);
}

// method: 'coins' | 'key' | 'free' | 'reward'. Returns the drops, or null if it could not open.
function openCase(tier, method = 'coins', count = 1, minR = 0) {
  const c = CASES[tier - 1];
  if (!c || !caseUnlocked(c)) return null;
  if (method === 'coins') {
    const cost = caseCost(c) * count;
    if (S.coins < cost) return null;
    S.coins -= cost;
  } else if (method === 'key') {
    if (S.keys < count) return null;
    S.keys -= count;
  } else if (method === 'free') {
    if (!freeCrateReady()) return null;
    S.freeCrateAt = Date.now() + FREE_CRATE_HOURS * 3600 * 1000;
  }
  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push(rollDrop(tier, i === 0 ? minR : 0));
    if (Math.random() < ST.bonusItem) {
      const extra = rollDrop(tier, 0);
      extra.bonus = true;
      drops.push(extra);
    }
  }
  for (const d of drops) grantDrop(d);
  if (method === 'coins') S.run.cases = (S.run.cases || 0) + count;
  S.stats.cases += count;
  track('case', count);
  recalc();
  return drops;
}

// ---------- gear ----------
function quality(fl) { return 1.2 - 0.4 * fl; }
function wearName(fl) { return (WEAR.find(w => fl < w.max) || WEAR[WEAR.length - 1]).name; }
function statValue(k, r, t, mult) {
  const s = STATS[k];
  return s.base * RARITY_MULT[r] * Math.pow(s.tier, t - 1) * mult;
}
function itemStats(it) {
  const lv = 1 + 0.1 * it.lv;
  const q = quality(it.fl);
  const main = SLOTS[it.slot].main;
  const out = [{ k: main, v: statValue(main, it.r, it.t, q * lv), main: true }];
  for (const s of it.subs) out.push({ k: s.k, v: statValue(s.k, it.r, it.t, q * s.roll * lv) * 0.5 });
  return out;
}
function itemName(it) { return `${MATERIALS[it.t].name} ${SLOTS[it.slot].name}`; }
function scrapValue(it) {
  const st = ST || { scrapMult: 1 };
  return Math.ceil([2, 5, 15, 45, 150][it.r] * it.t * st.scrapMult * (1 + it.lv * 0.5));
}
function reforgeCost(it) {
  return Math.ceil(8 * Math.pow(it.lv + 1, 1.6) * Math.pow(it.t, 1.3) * [1, 1.5, 2, 3, 4][it.r]);
}

function findItem(id) {
  for (const slot of SLOT_IDS) {
    const it = S.gear.eq[slot];
    if (it && it.id === id) return { it, where: 'eq', slot };
  }
  const i = S.gear.bag.findIndex(it => it.id === id);
  if (i >= 0) return { it: S.gear.bag[i], where: 'bag', index: i };
  return null;
}

function equipItem(id) {
  const f = findItem(id);
  if (!f || f.where !== 'bag') return false;
  const it = f.it;
  S.gear.bag.splice(f.index, 1);
  const old = S.gear.eq[it.slot];
  it.isNew = false;
  S.gear.eq[it.slot] = it;
  if (old) S.gear.bag.unshift(old);
  recalc();
  return true;
}

function unequipItem(slot) {
  const it = S.gear.eq[slot];
  if (!it || S.gear.bag.length >= BAG_SIZE) return false;
  S.gear.eq[slot] = null;
  S.gear.bag.unshift(it);
  recalc();
  return true;
}

function salvageItem(id) {
  const f = findItem(id);
  if (!f || f.where !== 'bag') return 0;
  const v = scrapValue(f.it);
  S.gear.bag.splice(f.index, 1);
  S.scrap += v;
  return v;
}

function salvageBelow(r) {
  let total = 0;
  let n = 0;
  S.gear.bag = S.gear.bag.filter(it => {
    if (it.r < r) {
      total += scrapValue(it);
      n++;
      return false;
    }
    return true;
  });
  S.scrap += total;
  return { n, total };
}

function reforgeItem(id) {
  const f = findItem(id);
  if (!f) return false;
  const it = f.it;
  if (it.lv >= MAX_ITEM_LEVEL) return false;
  const c = reforgeCost(it);
  if (S.scrap < c) return false;
  S.scrap -= c;
  it.lv++;
  recalc();
  return true;
}

function markItemsSeen() {
  for (const it of S.gear.bag) it.isNew = false;
}

// ---------- pets ----------
function petSlots() { return 2 + (S.prestiges >= 1 ? 1 : 0) + (S.prestiges >= 3 ? 1 : 0); }
function petEquippedCount(sp, r) { return S.pets.eq.filter(p => p.sp === sp && p.r === r).length; }
function petAvailable(sp, r) { return S.pets.inv[sp][r] - petEquippedCount(sp, r); }

function equipPet(sp, r) {
  if (petAvailable(sp, r) <= 0 || S.pets.eq.length >= petSlots()) return false;
  S.pets.eq.push({ sp, r });
  recalc();
  return true;
}

function unequipPet(i) {
  if (i < 0 || i >= S.pets.eq.length) return false;
  S.pets.eq.splice(i, 1);
  recalc();
  return true;
}

function mergePet(sp, r) {
  if (r >= 4 || petAvailable(sp, r) < 3) return false;
  S.pets.inv[sp][r] -= 3;
  S.pets.inv[sp][r + 1]++;
  markCollection('pet', sp, r + 1);
  S.stats.merges++;
  if (r + 1 > S.stats.bestDrop) S.stats.bestDrop = r + 1;
  track('merge');
  recalc();
  return true;
}

function mergeAllPets() {
  let n = 0;
  for (const sp of PET_IDS) for (let r = 0; r < 4; r++) while (mergePet(sp, r)) n++;
  return n;
}

function mergeablePets() {
  let n = 0;
  for (const sp of PET_IDS) for (let r = 0; r < 4; r++) if (petAvailable(sp, r) >= 3) n++;
  return n;
}

function petBonusText(sp, r) {
  const def = PETS[sp];
  return Object.entries(def.stats).map(([k, v]) => `${fmtPct(v * PET_POWER[r])} ${STATS[k].name.toLowerCase()}`).join(', ');
}

// ---------- index (collection) ----------
function markCollection(kind, a, r) {
  const key = `${kind}:${a}:${r}`;
  if (S.coll[key]) return;
  S.coll[key] = 1;
  emit('collection', { kind, a, r, count: collectionCount() });
}

// ---------- daily login, quests, achievements ----------
function rollQuests(day) {
  const rng = mulberry32(hashStr('quests:' + day));
  const chosen = shuffle(QUESTS.slice(), rng).slice(0, 3);
  return chosen.map(q => ({ id: q.id, target: q.n[Math.floor(rng() * q.n.length)], prog: 0, claimed: false }));
}

function ensureDay() {
  const today = dateKey();
  if (S.daily.day !== today) {
    const gap = S.daily.day ? dayDiff(S.daily.day, today) : 0;
    S.daily.streak = gap === 1 ? S.daily.streak + 1 : 1;
    S.daily.day = today;
    S.daily.claimed = false;
    if (S.daily.streak > S.stats.bestLogin) S.stats.bestLogin = S.daily.streak;
    emit('newDay', {});
  }
  if (S.quests.day !== today) {
    S.quests = { day: today, list: rollQuests(today), bonus: false };
  }
}

function pruneDays() {
  const keys = Object.keys(S.stats.days).sort();
  while (keys.length > 14) delete S.stats.days[keys.shift()];
}

function dailyRewardFor(streak) {
  const i = (Math.max(1, streak) - 1) % 7;
  const week = Math.floor((Math.max(1, streak) - 1) / 7);
  return { ...DAILY_REWARDS[i], index: i, week };
}

function claimDaily() {
  if (S.daily.claimed) return null;
  const rw = dailyRewardFor(S.daily.streak);
  const out = { label: rw.label };
  if (rw.keys) { S.keys += rw.keys + rw.week; out.keys = rw.keys + rw.week; }
  if (rw.coinMinutes) {
    const g = Math.max(100, idleRates().coins * 60 * rw.coinMinutes);
    addCoins(g);
    out.coins = g;
  }
  if (rw.scrap) { S.scrap += rw.scrap * (1 + rw.week); out.scrap = rw.scrap * (1 + rw.week); }
  if (rw.boostMinutes) {
    S.boostUntil = Math.max(Date.now(), S.boostUntil) + rw.boostMinutes * 60000;
    out.boost = rw.boostMinutes;
  }
  S.daily.claimed = true;
  if (rw.crate) out.drops = openCase(bestCaseTier(), 'reward', 1, rw.crate);
  recalc();
  return out;
}

function track(ev, n = 1, val = 0) {
  if (!S.quests || !S.quests.list) return;
  for (const q of S.quests.list) {
    const def = QUEST_INDEX[q.id];
    if (!def || def.ev !== ev || q.prog >= q.target) continue;
    q.prog = def.max ? Math.max(q.prog, val) : q.prog + n;
    if (q.prog >= q.target) {
      q.prog = q.target;
      emit('questDone', { text: def.text(q.target) });
    }
  }
}

function claimQuest(i) {
  const q = S.quests.list[i];
  if (!q || q.claimed || q.prog < q.target) return false;
  q.claimed = true;
  S.keys += QUEST_REWARD.keys;
  S.scrap += QUEST_REWARD.scrap;
  return true;
}

function questBonusReady() {
  return !S.quests.bonus && S.quests.list.length > 0 && S.quests.list.every(q => q.claimed);
}

function claimQuestBonus() {
  if (!questBonusReady()) return null;
  S.quests.bonus = true;
  S.stats.dailyDone++;
  return openCase(bestCaseTier(), 'reward', 1, 2);
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!S.ach.done[a.id] && a.test()) {
      S.ach.done[a.id] = 1;
      emit('achievement', a);
    }
  }
}

function claimAchievement(id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a || !S.ach.done[id] || S.ach.claimed[id]) return false;
  S.ach.claimed[id] = 1;
  S.keys += a.keys;
  S.trophies++;
  recalc();
  return true;
}

function claimableCounts() {
  let quests = 0;
  for (const q of S.quests.list) if (!q.claimed && q.prog >= q.target) quests++;
  let ach = 0;
  for (const a of ACHIEVEMENTS) if (S.ach.done[a.id] && !S.ach.claimed[a.id]) ach++;
  return { daily: S.daily.claimed ? 0 : 1, quests, bonus: questBonusReady() ? 1 : 0, ach };
}

// ---------- prestige ----------
function prestigeGain() { return coresFor(S.run.maxFloor); }
function canPrestige() { return S.run.maxFloor >= 25 && prestigeGain() > 0; }

function doPrestige() {
  if (!canPrestige()) return null;
  const gain = prestigeGain();
  const slotsBefore = petSlots();
  const tierBefore = bestCaseTier();
  S.cores += gain;
  S.prestiges++;
  S.stats.prestiges = S.prestiges;
  S.coins = 0;
  S.run = freshRun();
  S.math.streak = 0;
  R.enemy = null;
  R.spawnT = 1;
  R.queued = [];
  R.frenzyT = 0;
  R.ore = null;
  R.bonusRound = null;
  recalc();
  const tierAfter = bestCaseTier();
  return {
    gain,
    total: S.cores,
    newSlot: petSlots() > slotsBefore,
    newCase: tierAfter > tierBefore ? CASES[tierAfter - 1].name : null,
  };
}

// ---------- idle and offline ----------
function idleRates() {
  let f = S.run.floor;
  if (isBossFloor(f)) f = Math.max(1, f - 1);
  const dps = Math.max(1e-9, ST.dps * ST.goldDrill);
  const t = (hpFor(f) * 0.975) / dps + SPAWN_GAP + ENTER_TIME;
  return {
    coins: (coinUnit(f) * 1.4 * ST.coinMult) / t,
    xp: (xpUnit(f) * 0.985 * ST.xpMult) / t,
    kps: 1 / t,
  };
}

function applyOffline(sec) {
  if (!(sec >= 10)) return null;
  const capped = Math.min(sec, ST.offlineCap);
  const eff = capped * ST.offlineRate;
  const r = idleRates();
  const res = { sec, capped, coins: r.coins * eff, xp: r.xp * eff, kills: Math.floor(r.kps * eff) };
  addCoins(res.coins);
  gainXp(res.xp);
  S.stats.kills += res.kills;
  return res;
}

// ---------- saving ----------
function serialize() {
  S.savedAt = Date.now();
  S.lastSeen = S.savedAt;
  return JSON.stringify(S);
}

function saveLocal() {
  try {
    localStorage.setItem(SAVE_KEY, serialize());
    return true;
  } catch (e) {
    return false;
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function exportCode() {
  const json = serialize();
  return 'DDH1.' + b64encode(json) + '.' + hashStr(json).toString(36);
}

function parseCode(code) {
  const parts = String(code || '').replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== 'DDH1') throw new Error('That is not a Deep Dig Heroes save code. Codes start with DDH1.');
  let json;
  try {
    json = b64decode(parts[1]);
  } catch (e) {
    throw new Error('The code is damaged. Copy the whole code and try again.');
  }
  if (hashStr(json).toString(36) !== parts[2]) throw new Error('The code is incomplete. Copy the whole code and try again.');
  const obj = JSON.parse(json);
  if (!obj || typeof obj !== 'object' || !obj.run || !obj.stats) throw new Error('The code does not contain a save.');
  return obj;
}

function loadState(obj) {
  S = hydrate(obj);
  R.enemy = null;
  R.spawnT = 0.6;
  R.queued = [];
  R.bonusRound = null;
  recalc();
  ensureDay();
  R.dayKey = dateKey();
}
