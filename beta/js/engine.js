'use strict';
// Game rules: state, formulas, combat, tap combos, cases, gear, pets, quests, prestige and saves.
// Nothing here touches the DOM. Visual and UI code listens through on()/emit().

const SAVE_KEY = 'ddh-save-v1';
const SAVE_VERSION = 3;
const KILLS_PER_FLOOR = 6;
const BOSS_TIME = 45; // duel length in seconds
const DUEL_LIVES = 3;
const MINIGAME_IDS = ['reaction', 'sequence', 'number', 'chimp'];
const RUNE_CHANCE = 0.35;
// Each boss floor uses the next mini-game in turn.
function bossGame(f) { return MINIGAME_IDS[(Math.floor(f / 10) - 1) % MINIGAME_IDS.length]; }
const SPAWN_GAP = 0.45;
const ENTER_TIME = 0.25;
const TREASURE_CHANCE = 1 / 35;
const TREASURE_TIME = 10;
const COMBO_FADE_STEP = 0.8; // seconds per lost stack once the combo starts fading
const PRESTIGE_LUCK = 0.1; // each of your first 10 prestiges makes every case a little luckier, forever
const PRESTIGE_LUCK_MAX = 10;

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
  for (const id of PET_IDS) inv[id] = RARITY.map(() => 0);
  return {
    v: SAVE_VERSION, created: Date.now(), savedAt: 0, lastSeen: Date.now(),
    coins: 0, keys: 0, scrap: 0, cores: 0, trophies: 0, prestiges: 0, nextId: 1,
    power: 0, // permanent damage from the levels reached in past runs (+10% per point)
    ptree: {}, // prestige tree levels, bought with cores
    locks: {}, // skill ranks kept through prestige (node id -> ranks)
    caseKind: 'tool', // which cases you open: 'tool' (gear) or 'pet'
    pityPet: { epic: 0, leg: 0 },
    run: freshRun(),
    math: { streak: 0 }, // the tap combo (the key name is kept so old saves load)
    gear: { eq: { pick: null, helm: null, charm: null }, bag: [] },
    pets: { inv, eq: [] },
    pity: { epic: 0, leg: 0 },
    pace: 0, // tap pad pace you settled at last session
    profile: { name: '', pid: '' },
    lb: { sentKey: '', sentAt: 0 }, // last scores sent to the leaderboard
    feedback: [], // notes sent from the Feedback button, with the player's own follow-up comments
    fbSeen: {}, // replies already read, per feedback id
    coll: {},
    best: {}, // rarest pull per slot (pick, helm, charm, pet) and overall; kept through prestige
    daily: { day: '', streak: 0, claimed: true },
    quests: { day: '', list: [], bonus: false },
    ach: { done: {}, claimed: {} },
    freeCrateAt: 0,
    boostUntil: 0,
    bonusRound: null,
    mg: { reaction: 0, sequence: 0, number: 0, chimp: 0 }, // personal bests (reaction is in ms, lower is better)
    stats: {
      playTime: 0, kills: 0, bosses: 0, taps: 0, perfects: 0, escapes: 0, bestMult: 1,
      bestStreak: 0, cases: 0, bestDrop: -1, coinsEarned: 0, merges: 0, ores: 0, goldies: 0,
      prestiges: 0, bestFloor: 1, maxHit: 0, dailyDone: 0, bestLogin: 0, days: {},
    },
    settings: {
      sound: true, vibe: true,
      autoSalvage: 0, wake: false, breakMin: 0, buyAmt: '1', juice: 'high', shake: true, autoStop: ULTRA, bagSort: 'new',
    },
  };
}

function deepMerge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(src)) {
    const v = src[k];
    const b = base[k];
    const bObj = b && typeof b === 'object' && !Array.isArray(b);
    const vObj = v && typeof v === 'object' && !Array.isArray(v);
    if (bObj && vObj) deepMerge(b, v);
    else if (bObj) continue; // a section that is not an object in the save keeps its defaults
    else base[k] = v;
  }
  return base;
}

// Repairs one gear item in place. Returns false when it cannot be made usable.
function repairItem(it) {
  if (!it || typeof it !== 'object' || !SLOTS[it.slot]) return false;
  if (!Number.isInteger(it.r) || it.r < 0 || it.r >= RARITY.length) return false;
  if (!Number.isInteger(it.t) || it.t < 1 || it.t >= MATERIALS.length) return false;
  it.fl = isFinite(it.fl) ? clamp(it.fl, 0, 1) : 0.5;
  it.lv = Number.isInteger(it.lv) ? clamp(it.lv, 0, MAX_ITEM_LEVEL) : 0;
  it.subs = (Array.isArray(it.subs) ? it.subs : []).filter(sb => sb && STATS[sb.k] && isFinite(sb.roll));
  it.isNew = !!it.isNew;
  it.locked = !!it.locked;
  return true;
}

const nonNeg = (v, d = 0) => (isFinite(v) && v >= 0 ? v : d);
const nonNegInt = (v, d = 0) => (Number.isInteger(v) && v >= 0 ? v : d);

// Fill in anything a save from an older version is missing and repair impossible values,
// so a damaged save never leaves the game stuck on a black screen.
// Version 1 had 5 materials (Copper, Iron, Gold, Crystal, Void). They keep their name and
// their power in the 21-material list, where they sit at 1, 5, 9, 13 and 17.
function migrateSave(obj) {
  if (!obj || typeof obj !== 'object' || (obj.v || 1) >= 3) return obj;
  if ((obj.v || 1) >= 2) return migrateV3(obj);
  const remap = it => { if (it && Number.isInteger(it.t) && it.t >= 1 && it.t <= 5) it.t = 1 + MATERIALS_PER_CASE * (it.t - 1); };
  const g = obj.gear || {};
  if (g.eq && typeof g.eq === 'object') Object.values(g.eq).forEach(remap);
  if (Array.isArray(g.bag)) g.bag.forEach(remap);
  obj.v = 2;
  return migrateV3(obj);
}

// v3: the skill web replaces the three skill lists (points are refunded), and prestige damage moves
// from cores to power. Existing cores become power one-for-one and are also kept to spend.
function migrateV3(obj) {
  if ((obj.v || 1) >= 3) return obj;
  if (obj.run && obj.run.skills && typeof obj.run.skills === 'object') {
    let refund = 0;
    for (const k of Object.keys(obj.run.skills)) refund += Math.max(0, Math.floor(Number(obj.run.skills[k]) || 0));
    obj.oldSkills = { ...obj.run.skills }; // rebuilt in the web on load (rebuildOldSkills)
    obj.run.skills = {};
    obj.run.sp = (Number(obj.run.sp) || 0) + refund;
    obj.migratedSkills = refund;
  }
  obj.power = Number(obj.cores) || 0;
  obj.v = 3;
  return obj;
}

function hydrate(obj) {
  const s = deepMerge(freshState(), migrateSave(obj) || {});
  s.v = SAVE_VERSION;
  const now = Date.now();
  for (const k of ['coins', 'keys', 'scrap', 'cores', 'trophies', 'prestiges', 'power']) s[k] = nonNeg(s[k]);
  if (!s.ptree || typeof s.ptree !== 'object') s.ptree = {};
  for (const k of Object.keys(s.ptree)) if (!PRESTIGE_TREE.some(n => n.id === k)) delete s.ptree[k]; else s.ptree[k] = nonNegInt(s.ptree[k]);
  if (!s.locks || typeof s.locks !== 'object') s.locks = {};
  for (const k of Object.keys(s.locks)) {
    const n = SKILL_INDEX[k];
    if (!n || !Number.isInteger(s.locks[k]) || s.locks[k] <= 0) delete s.locks[k]; else s.locks[k] = Math.min(n.max, s.locks[k]);
  }
  let lockUsed = 0;
  for (const k of Object.keys(s.locks)) { const room = Math.max(0, (s.ptree.memory || 0) - lockUsed); s.locks[k] = Math.min(s.locks[k], room); lockUsed += s.locks[k]; if (!s.locks[k]) delete s.locks[k]; }
  if (s.caseKind !== 'pet') s.caseKind = 'tool';
  if (!s.pityPet || typeof s.pityPet !== 'object') s.pityPet = { epic: 0, leg: 0 };
  s.pityPet.epic = nonNegInt(s.pityPet.epic); s.pityPet.leg = nonNegInt(s.pityPet.leg);
  s.nextId = nonNegInt(s.nextId, 1);
  // Run and combo numbers.
  const run = s.run;
  run.level = Math.max(1, nonNegInt(run.level, 1));
  run.xp = nonNeg(run.xp);
  run.sp = nonNegInt(run.sp);
  run.kills = nonNegInt(run.kills);
  run.floor = Math.max(1, nonNegInt(Math.floor(run.floor), 1));
  run.maxFloor = Math.max(run.floor, nonNegInt(Math.floor(run.maxFloor), 1));
  run.cases = nonNegInt(run.cases);
  run.auto = run.auto !== false;
  if (!run.skills || typeof run.skills !== 'object') run.skills = {};
  for (const id of Object.keys(run.skills)) {
    const n = SKILL_INDEX[id];
    if (!n || !Number.isInteger(run.skills[id]) || run.skills[id] <= 0) delete run.skills[id];
    else run.skills[id] = Math.min(n.max, run.skills[id]);
  }
  for (const id of Object.keys(s.locks)) run.skills[id] = Math.max(run.skills[id] || 0, s.locks[id]);
  if (!run.upg || typeof run.upg !== 'object') run.upg = {};
  for (const id of Object.keys(run.upg)) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u || !Number.isInteger(run.upg[id]) || run.upg[id] <= 0) delete run.upg[id];
    else if (u.max != null) run.upg[id] = Math.min(u.max, run.upg[id]);
  }
  if (!run.bossDone || typeof run.bossDone !== 'object') run.bossDone = {};
  s.math.streak = nonNegInt(s.math.streak);
  s.pace = isFinite(s.pace) ? clamp(s.pace, 0, 1) : 0;
  if (typeof s.profile.name !== 'string') s.profile.name = '';
  s.profile.name = s.profile.name.slice(0, 20);
  if (typeof s.profile.pid !== 'string') s.profile.pid = '';
  if (!s.lb || typeof s.lb.sentKey !== 'string') s.lb = { sentKey: '', sentAt: 0 };
  s.lb.sentAt = nonNeg(s.lb.sentAt);
  const okText = x => x && typeof x.id === 'string' && typeof x.text === 'string';
  s.feedback = (Array.isArray(s.feedback) ? s.feedback : []).filter(okText).slice(0, 50).map(i => ({
    id: i.id, type: String(i.type || 'other'), text: i.text, at: nonNeg(i.at), sent: !!i.sent,
    comments: (Array.isArray(i.comments) ? i.comments : []).filter(okText).map(c => ({ id: c.id, text: c.text, at: nonNeg(c.at), sent: !!c.sent })),
  }));
  if (!s.fbSeen || typeof s.fbSeen !== 'object') s.fbSeen = {};
  s.pity.epic = nonNegInt(s.pity.epic);
  s.pity.leg = nonNegInt(s.pity.leg);
  // Gear: drop anything unusable, keep ids unique.
  const ids = new Set();
  const keepId = it => {
    if (!Number.isInteger(it.id) || ids.has(it.id)) it.id = s.nextId++;
    ids.add(it.id);
    if (it.id >= s.nextId) s.nextId = it.id + 1;
  };
  for (const slot of SLOT_IDS) {
    const it = s.gear.eq[slot];
    if (!it || !repairItem(it) || it.slot !== slot) s.gear.eq[slot] = null;
    else keepId(it);
  }
  s.gear.bag = (Array.isArray(s.gear.bag) ? s.gear.bag : []).filter(repairItem).slice(0, BAG_SIZE);
  for (const it of s.gear.bag) keepId(it);
  // Pets: inventory counts, then a party that only holds pets you actually own.
  for (const id of PET_IDS) {
    const arr = s.pets.inv[id];
    s.pets.inv[id] = RARITY.map((_, r) => nonNegInt(Array.isArray(arr) ? arr[r] : 0));
  }
  const slots = 2 + (s.prestiges >= 1 ? 1 : 0) + (s.prestiges >= 3 ? 1 : 0);
  const used = {};
  s.pets.eq = (Array.isArray(s.pets.eq) ? s.pets.eq : []).filter(p => {
    if (!p || !PETS[p.sp] || !Number.isInteger(p.r) || p.r < 0 || p.r > TOP_RARITY) return false;
    const key = p.sp + ':' + p.r;
    used[key] = (used[key] || 0) + 1;
    return used[key] <= s.pets.inv[p.sp][p.r];
  }).slice(0, slots);
  // Daily, quests, achievements.
  s.daily.streak = nonNegInt(s.daily.streak);
  if (typeof s.daily.day !== 'string') s.daily.day = '';
  if (typeof s.quests.day !== 'string') s.quests.day = '';
  const list = Array.isArray(s.quests.list) ? s.quests.list : [];
  const good = list.every(q => q && QUEST_INDEX[q.id] && Number.isInteger(q.target) && q.target > 0 && isFinite(q.prog));
  if (!good || (list.length !== 3 && s.quests.day)) s.quests = { day: '', list: [], bonus: false };
  else for (const q of list) q.prog = clamp(q.prog, 0, q.target);
  for (const k of ['done', 'claimed']) if (!s.ach[k] || typeof s.ach[k] !== 'object') s.ach[k] = {};
  if (!s.coll || typeof s.coll !== 'object') s.coll = {};
  if (!s.best || typeof s.best !== 'object') s.best = {};
  for (const k of Object.keys(s.best)) {
    const b = s.best[k];
    if (!b || !Number.isInteger(b.r) || b.r < 0 || b.r > TOP_RARITY || !isFinite(b.odds) || b.odds < 1) delete s.best[k];
  }
  // Older saves stored odds with the luck of the moment; recompute the raw odds from rarity and wear.
  for (const k of Object.keys(s.best)) {
    const b = s.best[k];
    b.odds = Math.round(dropOdds(b.r, b.fl == null ? null : b.fl));
  }
  if (s.best.all) {
    let top = null;
    for (const k of Object.keys(s.best)) if (k !== 'all' && (!top || s.best[k].odds > top.odds)) top = k;
    if (top && s.best[top].odds > s.best.all.odds) s.best.all = { ...s.best[top], kind: top === 'pet' ? 'pet' : 'gear' };
  }
  // Stats.
  const fresh = freshState().stats;
  for (const k of Object.keys(fresh)) {
    if (k === 'days') { if (!s.stats.days || typeof s.stats.days !== 'object') s.stats.days = {}; }
    else if (k === 'bestDrop') { if (!Number.isInteger(s.stats[k]) || s.stats[k] < -1 || s.stats[k] > TOP_RARITY) s.stats[k] = -1; }
    else if (!isFinite(s.stats[k]) || s.stats[k] < 0) s.stats[k] = fresh[k];
  }
  s.stats.bestFloor = Math.max(s.stats.bestFloor, run.maxFloor);
  // Timers: a device clock that was set ahead must not lock things for months.
  s.freeCrateAt = isFinite(s.freeCrateAt) ? Math.min(s.freeCrateAt, now + FREE_CRATE_HOURS * 3600e3) : 0;
  s.boostUntil = isFinite(s.boostUntil) ? Math.min(s.boostUntil, now + 2 * 3600e3) : 0;
  if (!isFinite(s.lastSeen) || s.lastSeen > now) s.lastSeen = now;
  if (!isFinite(s.savedAt) || s.savedAt > now) s.savedAt = now;
  if (!isFinite(s.created)) s.created = now;
  const br = s.bonusRound;
  if (!br || typeof br !== 'object' || !br.reward || !isFinite(br.reward.coins) || !isFinite(br.reward.xp)) s.bonusRound = null;
  else s.bonusRound = { need: BONUS_TAPS, done: nonNegInt(br.done), reward: { coins: nonNeg(br.reward.coins), xp: nonNeg(br.reward.xp) } };
  if (!s.mg || typeof s.mg !== 'object') s.mg = freshState().mg;
  for (const k of MINIGAME_IDS) s.mg[k] = nonNeg(s.mg[k]);
  // Settings.
  const st = s.settings;
  if (!['low', 'med', 'high'].includes(st.juice)) st.juice = 'high';
  st.shake = st.shake !== false;
  st.autoSalvage = Number.isInteger(st.autoSalvage) ? clamp(st.autoSalvage, 0, TOP_RARITY) : 0;
  if (!['new', 'rarity', 'best'].includes(st.bagSort)) st.bagSort = 'new';
  st.autoStop = Number.isInteger(st.autoStop) ? clamp(st.autoStop, 2, TOP_RARITY) : ULTRA;
  st.breakMin = nonNeg(st.breakMin);
  if (!['1', '10', 'max'].includes(String(st.buyAmt))) st.buyAmt = '1';
  else st.buyAmt = String(st.buyAmt);
  return s;
}

let S = freshState();
let ST = null;

// Runtime values that are not saved.
const R = {
  sim: false, paused: false, hitstop: 0, time: 0, session: 0, secT: 0, dayKey: '', hiddenAt: 0,
  enemy: null, spawnT: 0.6, atkT: 0, swingT: 0, queued: [],
  lastAnswer: -99, decayAcc: 0,
  frenzyT: 0, ore: null, oreT: 40, pace: 0, paceHold: 0, shield: 0, shieldUntil: 0, cleanHits: 0,
  boostOn: false, bonusRound: null, duel: null,
};

// ---------- derived stats ----------
function skillRank(id) { return S.run.skills[id] || 0; }
function upgradeLevel(id) { return S.run.upg[id] || 0; }
function branchPoints(bid) {
  let p = 0;
  for (const id in S.run.skills) if (SKILL_INDEX[id] && SKILL_INDEX[id].branch === bid) p += S.run.skills[id];
  return p;
}
// Small-node stats summed over the nodes you own.
function treeFx() {
  const fx = {};
  for (const id in S.run.skills) {
    const n = SKILL_INDEX[id];
    if (n && n.fx) for (const k in n.fx) fx[k] = (fx[k] || 0) + n.fx[k] * S.run.skills[id];
  }
  return fx;
}
function ptLevel(id) { return S.ptree[id] || 0; }
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
    for (const k in def.stats) add[k] += def.stats[k] * petPower(k, p.r);
  }
  const trophy = 1 + TROPHY_BONUS * S.trophies;
  const coll = 1 + COLLECTION_BONUS * collectionCount();
  const st = { add };
  const fx = treeFx();
  st.fx = fx;
  st.deepDiver = sk('deepdiver') > 0;
  st.baseDmg = sharpenDamage(up('sharpen'));
  st.dmgMult = (1 + add.dmg) * (1 + 0.02 * branchPoints('brawler')) * (1 + (fx.dmg || 0))
    * (1 + TUNE.coreBonus * S.power) * (1 + 0.25 * ptLevel('might')) * trophy * coll;
  st.hit = st.baseDmg * st.dmgMult;
  st.aps = 1.25 * (1 + 0.04 * up('fury')) * (1 + add.aps + 0.1 * sk('autodrill'))
    * (1 + (fx.aps || 0)) * (1 + 0.01 * branchPoints('miner'));
  st.critChance = Math.min(0.75, 0.05 + 0.015 * up('crit') + add.crit + (fx.crit || 0) + 0.02 * sk('seismic'));
  st.critMult = 2 + 0.15 * up('critdmg') + add.critdmg + (fx.critdmg || 0);
  if (sk('earthquake')) { st.critChance *= 0.5; st.critMult *= 2; }
  st.dps = st.hit * st.aps * (1 + st.critChance * (st.critMult - 1));
  st.strikeMult = (1 + 0.1 * up('brain')) * (1 + 0.2 * sk('quickwit')) * (1 + add.strike) * (1 + (fx.strike || 0));
  st.perfectBonus = PERFECT_BONUS * (1 + 0.2 * sk('perfectionist'));
  st.shieldEvery = SHIELD_EVERY - 2 * sk('steady');
  st.lossMult = sk('limitbreak') ? 2 : 1;
  st.hpMult = st.deepDiver ? 1.3 : 1;
  st.skip = 0.05 * sk('tunneler');
  st.oreMult = 1 + 0.25 * sk('prospector');
  st.comboPer = 0.05 + 0.01 * sk('adrenaline');
  // The tap pad's own difficulty is the real limit on the combo.
  st.comboCap = paceComboCap();
  st.comboKeep = Math.min(0.96, TAP_KEEP + 0.02 * sk('ironmind'));
  st.decay = 6 + 2 * sk('focus');
  st.bossMult = 1 + 0.3 * sk('executioner');
  st.overdrive = sk('overdrive') > 0;
  st.goldDrill = sk('golddrill') > 0 ? GOLD_DRILL : 1;
  st.boost = Date.now() < S.boostUntil ? 2 : 1;
  st.coinMult = (1 + 0.1 * up('magnet')) * (1 + add.coin) * (1 + 0.15 * sk('greed'))
    * (1 + 0.02 * branchPoints('tycoon')) * (1 + 0.003 * sk('compound') * S.run.maxFloor)
    * trophy * coll * st.boost * (1 + (fx.coin || 0)) * (1 + 0.25 * ptLevel('fortune')) * (st.deepDiver ? 1.6 : 1);
  st.xpMult = (1 + 0.1 * up('scholar')) * (1 + add.xp) * (1 + (fx.xp || 0)) * (1 + 0.25 * ptLevel('wisdom')) * (st.deepDiver ? 1.6 : 1);
  st.luck = add.luck + 0.1 * sk('lucky') + 0.02 * branchPoints('gambler') + PRESTIGE_LUCK * Math.min(S.prestiges, PRESTIGE_LUCK_MAX)
    + (fx.luck || 0) + 0.1 * ptLevel('favor') + (sk('allin') ? 1.5 : 0);
  st.caseCostMult = sk('allin') ? 1.5 : 1;
  st.caseDiscount = 0.06 * sk('haggler');
  st.epicPity = EPIC_PITY - 2 * sk('pity');
  st.scrapMult = 1 + 0.25 * sk('scrapper');
  st.bonusItem = 0.06 * sk('doubledown');
  st.bonusKey = 0.25 * sk('keymaster');
  st.jackpot = sk('jackpot') > 0 ? 2 : 1;
  st.offlineRate = 0.4 + 0.1 * sk('nightshift') + (sk('ledger') ? 0.4 : 0);
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
// On a boss floor regular enemies keep coming until the player starts the duel,
// so the miner farms instead of standing still. `boss` spawns the boss itself.
function spawnEnemy(boss = false) {
  const f = S.run.floor;
  const biome = biomeFor(f);
  let type;
  if (boss) type = BOSS_ORDER[(f / 10) % BOSS_ORDER.length];
  else if (f >= ENEMIES.goldie.minFloor && Math.random() < TREASURE_CHANCE) type = 'goldie';
  else type = weightedPick(NORMAL_ENEMIES.filter(t => ENEMIES[t].minFloor <= f), t => ENEMIES[t].weight);
  const hp = hpFor(f) * ENEMIES[type].hp * (boss ? 10 : 1) * ST.hpMult;
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
    endDuel(true);
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
    floorCleared(true);
  } else if (!isBossFloor(f)) {
    // Kills while a boss waits only farm: the boss is the only way down.
    S.run.kills++;
    if (S.run.kills >= KILLS_PER_FLOOR) floorCleared();
  }
  gainXp(xp);
}

// Bosses are gates, not farms: beating one always opens the next floor, even in Farm mode.
function floorCleared(bossBeaten = false) {
  S.run.kills = 0;
  track('floor');
  if (!(S.run.auto || bossBeaten)) return;
  const f = S.run.floor;
  // Tunneler: sometimes drop two floors, but never past a boss.
  const skip = ST.skip > 0 && !isBossFloor(f + 1) && Math.random() < ST.skip;
  changeFloor(f + (skip ? 2 : 1));
  if (skip) emit('tunnel', { floor: f + 2 });
}

function changeFloor(f) {
  f = Math.max(1, Math.floor(f));
  if (R.duel) endDuel(false);
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
  if (R.duel) {
    // A lost duel still pays a little, so trying is never a pure loss.
    const c = Math.max(10, idleRates().coins * 20);
    addCoins(c);
    emit('consolation', { coins: c });
  }
  endDuel(false);
  S.run.auto = false;
  emit('bossFail', {});
  changeFloor(S.run.floor - 1);
}

// Reward for a rune mini-game that reached `level` rounds before the first mistake.
function runeReward(level) {
  const out = { level, coins: Math.max(20, idleRates().coins * (15 + 15 * level)), keys: level >= 6 ? 2 : level >= 4 ? 1 : 0 };
  addCoins(out.coins);
  S.keys += out.keys;
  return out;
}

// Personal bests per mini-game. Reaction stores milliseconds (lower is better).
function recordMinigame(game, value) {
  const prev = S.mg[game] || 0;
  const better = game === 'reaction' ? (prev === 0 || value < prev) : value > prev;
  if (better) S.mg[game] = value;
  return better && prev !== 0;
}

// ---------- boss duels ----------
function bossWaiting() {
  return isBossFloor(S.run.floor) && !R.duel && !(R.enemy && R.enemy.boss);
}

// The boss steps in and replaces whatever enemy the miner was farming.
function startBossDuel() {
  if (!bossWaiting()) return null;
  R.queued.length = 0;
  spawnEnemy(true);
  R.duel = { game: bossGame(S.run.floor), lives: DUEL_LIVES, hits: 0 };
  emit('duelStart', R.duel);
  return R.duel;
}

// A won mini-game round: a big strike that also keeps the tap combo alive.
function duelHit(quality) {
  const e = R.enemy;
  if (!R.duel || !e || !e.boss) return;
  R.duel.hits++;
  S.math.streak++;
  R.lastAnswer = R.time;
  R.decayAcc = 0;
  if (S.math.streak > S.stats.bestStreak) S.stats.bestStreak = S.math.streak;
  queueStrike(3 * clamp(quality, 0.3, 2) * ST.strikeMult, quality >= 1.2 ? 'quick' : 'strike');
}

function duelMiss() {
  if (!R.duel) return;
  R.duel.lives--;
  S.math.streak = Math.floor(S.math.streak * (1 - (1 - ST.comboKeep) * ST.lossMult));
  emit('duelMiss', R.duel);
  if (R.duel.lives <= 0) bossFailed();
}

function endDuel(won) {
  if (!R.duel) return;
  const d = R.duel;
  R.duel = null;
  emit('duelEnd', { won, duel: d });
}

function treasureEscaped() {
  R.enemy = null;
  R.spawnT = SPAWN_GAP;
  emit('treasureEscaped', {});
}

// Player moving between floors. Going up turns auto-advance off so you can farm;
// stepping back down onto the deepest floor turns it on again, so the dig resumes.
function moveFloor(delta) {
  const f = S.run.floor + delta;
  if (f < 1 || f > S.run.maxFloor) return false;
  if (delta < 0) S.run.auto = false;
  else if (f === S.run.maxFloor) S.run.auto = true;
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

// ---------- tap combos ----------
// Monsters pop up on the tap pad (tappad.js) inside a shrinking ring. Each one tapped in time is a
// strike and +1 combo; each one that escapes cuts the combo. The combo multiplies all damage,
// including the miner's own swings, so active play is far stronger than leaving the game idle.
// Session pace (0..1) sets how fast monsters come. It is a slow staircase: every hit nudges it up a
// little and every escape eases it back more, so it settles where you hit about 88% of monsters,
// comfortable with a slight challenge. Skill shows in the multiplier: the faster the pace you can
// hold, the higher your combo can climb (x2 at the slowest pace up to x6 at the fastest).
const PACE_UP = 0.004;
const PACE_DOWN = 0.03;
const PACE_WARMUP = 0.6; // a new session starts at 60% of the pace you settled at last time
const PACE_CAP_MIN = 20; // combo cap (x2) up to PACE_LOW
const PACE_CAP_MAX = 100; // combo cap (x6) from PACE_HIGH
const PACE_LOW = 0.2;
const PACE_HIGH = 0.8;
const PACE_STEP_TIME = 0.6; // seconds: steps are weighted by time, so fast tappers don't climb faster per second

// The combo ceiling follows the pace you've held over the last ~20 seconds (paceHold), not the
// instant pace, so a short dip (a glance away, a couple of escapes) barely moves your multiplier.
const PACE_HOLD_TIME = 20;
function paceComboCap() {
  const k = clamp(((R.paceHold || 0) - PACE_LOW) / (PACE_HIGH - PACE_LOW), 0, 1);
  return Math.max(10, Math.round(PACE_CAP_MIN + (PACE_CAP_MAX - PACE_CAP_MIN) * k) + 4 * skillRank('momentum')
    + (skillRank('limitbreak') ? 40 : 0) - (skillRank('ledger') ? 20 : 0));
}
// Each step counts in proportion to the time since the previous tap or escape, so the climb takes
// about as long for everyone while the ~88% hit-rate balance stays the same.
function paceStep(delta) {
  const since = Math.max(0, R.time - (R.paceT || 0));
  R.paceT = R.time;
  R.paceHold = (R.paceHold || 0) + (R.pace - (R.paceHold || 0)) * (1 - Math.exp(-since / PACE_HOLD_TIME));
  setPace(R.pace + delta * clamp(since / PACE_STEP_TIME, 0.25, 1));
}
function startPaceSession() { R.pace = R.paceHold = clamp((S.pace || 0) * PACE_WARMUP, 0, 1); }
function setPace(p) {
  R.pace = clamp(p, 0, 1);
  S.pace = R.pace;
  if (ST) ST.comboCap = paceComboCap();
}
// Ring time, monsters at once and size, all from the pace. Extra monsters arrive slowly.
function tapDifficulty() {
  const p = R.pace || 0;
  return {
    life: lerp(1.6, 0.42, Math.pow(p, 0.85)), // seconds before the ring closes
    max: 1 + Math.floor(p * 3.2), // at most 4 at once
    size: Math.round(lerp(76, 52, p)), // px
  };
}

let TAP_STRIKE = 0.35; // seconds of damage per tap
const TAP_KEEP = 0.9; // an escaped monster keeps 90% of the combo
const PERFECT_BONUS = 1.4; // tapped in the first half of the ring
const OVERDRIVE_EVERY = 25;
const GOLD_DRILL = 1.5;
const BONUS_TAPS = 20; // "Double it" round: this many taps in a row without an escape

function tapHit(quality) {
  const perfect = quality >= 0.5;
  paceStep(PACE_UP);
  R.cleanHits = (R.cleanHits || 0) + 1;
  if (!R.shield && !shieldActive() && R.cleanHits >= ST.shieldEvery) {
    R.shield = 1;
    R.cleanHits = 0;
    emit('shield', { on: false, ready: true });
  }
  S.math.streak++;
  R.lastAnswer = R.time;
  R.decayAcc = 0;
  const st = S.stats;
  st.taps++;
  if (perfect) st.perfects++;
  let streakRecord = false;
  if (S.math.streak > st.bestStreak) {
    if (st.bestStreak >= 10 && S.math.streak === st.bestStreak + 1) streakRecord = true;
    st.bestStreak = S.math.streak;
  }
  st.bestMult = Math.max(st.bestMult, comboMult());
  let mult = TAP_STRIKE * ST.strikeMult * (perfect ? ST.perfectBonus : 1);
  const mega = ST.overdrive && S.math.streak % OVERDRIVE_EVERY === 0;
  if (mega) mult *= 5;
  queueStrike(mult, mega ? 'mega' : perfect ? 'quick' : 'strike');
  gainXp(xpUnit(S.run.floor) * 0.3 * ST.xpMult);
  track('tap');
  if (perfect) track('perfect');
  track('streak', 0, S.math.streak);
  let bonus = null;
  if (R.bonusRound) {
    R.bonusRound.done++;
    if (R.bonusRound.done >= R.bonusRound.need) bonus = finishBonusRound(true);
  }
  const res = { ok: true, perfect, mega, streak: S.math.streak, streakRecord, bonus };
  emit('tap', res);
  return res;
}

// Focus Shield: 15 taps in a row without an escape earns one charge. The next escape spends it and
// turns the shield on for a few seconds (longer near your peak); escapes during that window cost
// nothing, so you can glance away to check your floor or score.
const SHIELD_EVERY = 15;
const SHIELD_TIME = 2.5; // seconds, +1.5s at a full combo
// Near the combo ceiling an escape costs less: 10% normally, 4% at the cap.
const PEAK_KEEP = 0.96;

function shieldActive() { return R.time < (R.shieldUntil || 0); }
function comboFill() { return Math.min(1, S.math.streak / Math.max(1, ST.comboCap)); }

function tapMiss() {
  S.stats.escapes++;
  if (!shieldActive() && R.shield) {
    R.shield = 0;
    R.shieldUntil = R.time + SHIELD_TIME + 1.5 * comboFill();
    emit('shield', { on: true, until: R.shieldUntil });
  }
  if (shieldActive()) {
    // The shield protects the combo, but the pace still eases off so it stays comfortable.
    paceStep(-PACE_DOWN);
    const res = { ok: false, lost: 0, shielded: true, streak: S.math.streak, bonus: null };
    emit('tap', res);
    return res;
  }
  const before = S.math.streak;
  R.cleanHits = 0;
  paceStep(-PACE_DOWN);
  const keep = 1 - (1 - lerp(ST.comboKeep, Math.max(ST.comboKeep, PEAK_KEEP), comboFill())) * ST.lossMult;
  S.math.streak = Math.floor(S.math.streak * keep);
  const bonus = R.bonusRound ? finishBonusRound(false) : null;
  const res = { ok: false, lost: before - S.math.streak, streak: S.math.streak, bonus };
  emit('tap', res);
  return res;
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

// The round is kept in the save, so closing the app mid-round does not lose the offer.
function startBonusRound(reward) {
  const b = R.bonusRound;
  if (b) {
    // A second offer while a round is still running adds to it instead of replacing it.
    b.reward = { coins: b.reward.coins + reward.coins, xp: b.reward.xp + reward.xp };
  } else {
    R.bonusRound = { need: BONUS_TAPS, done: 0, reward: { coins: reward.coins, xp: reward.xp } };
  }
  S.bonusRound = R.bonusRound;
  emit('bonusRound', R.bonusRound);
}

function finishBonusRound(won) {
  const b = R.bonusRound;
  R.bonusRound = null;
  S.bonusRound = null;
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
    // About a third of lucky ores are runes that open a mini-game instead of paying out at once.
    R.ore = { x: rand(66, 142), y: rand(14, 40), life: 6, max: 6, rune: Math.random() < RUNE_CHANCE };
    emit('oreSpawn', R.ore);
  }
}

function collectOre() {
  if (!R.ore) return null;
  const o = R.ore;
  R.ore = null;
  S.stats.ores++;
  track('ore');
  if (o.rune && !R.duel) {
    const game = pick(MINIGAME_IDS);
    emit('rune', { x: o.x, y: o.y, game });
    return { kind: 'rune', game };
  }
  const roll = Math.random();
  let res;
  if (roll < 0.6) {
    const c = Math.max(25, idleRates().coins * 60 * ST.oreMult);
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
  return S.run.sp > 0 && skillRank(id) < n.max && nodeReachable(id);
}
// Shortest route through the web from what you own to a node; learns the first step on it.
function learnToward(target) {
  if (!SKILL_INDEX[target] || skillRank(target) >= SKILL_INDEX[target].max) return false;
  if (canLearn(target)) return learnSkill(target);
  const own = id => id === 'core' || skillRank(id) > 0;
  const prev = {};
  const q = [...['core', ...Object.keys(S.run.skills).filter(own)]];
  for (const a of q) prev[a] = null;
  while (q.length) {
    const a = q.shift();
    if (a === target) break;
    for (const o of TREE_ADJ[a] || []) if (!(o in prev)) { prev[o] = a; q.push(o); }
  }
  if (!(target in prev)) return false;
  let n = target;
  while (prev[n] && !own(prev[n])) n = prev[n];
  return learnSkill(n);
}

// Spend points along routes to these skills, in order, until points run out.
function learnTargets(targets) {
  let n = 0, guard = 0;
  for (const [id, ranks] of targets) {
    while (S.run.sp > 0 && skillRank(id) < Math.min(ranks, SKILL_INDEX[id].max) && guard++ < 500) {
      if (!learnToward(id)) break;
      n++;
    }
  }
  return n;
}

// Old saves: rebuild the skills you had in the new web (paths included) so your build carries over.
// The small nodes on the way are free, so nobody comes out of the update weaker than before.
function rebuildOldSkills(old) {
  const order = Object.keys(old || {}).filter(id => SKILL_INDEX[id] && Number.isInteger(old[id]) && old[id] > 0)
    .sort((a, b) => Math.hypot(SKILL_INDEX[a].x, SKILL_INDEX[a].y) - Math.hypot(SKILL_INDEX[b].x, SKILL_INDEX[b].y));
  const sp = S.run.sp;
  S.run.sp = sp + 1000;
  learnTargets(order.map(id => [id, old[id]]));
  let kept = 0;
  for (const id of order) kept += Math.min(skillRank(id), old[id]);
  S.run.sp = Math.max(0, sp - kept);
  return kept;
}

// A node opens once a neighbour is owned (the centre counts as owned).
function nodeReachable(id) {
  if (skillRank(id) > 0) return true;
  return (TREE_ADJ[id] || []).some(o => o === 'core' || skillRank(o) > 0);
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
  for (const k in S.run.skills) refund += S.run.skills[k] - (S.locks[k] || 0);
  S.run.skills = { ...S.locks };
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
  return Math.ceil(c.base * coinUnit(S.run.maxFloor) * runInflation * (1 - ST.caseDiscount) * ST.caseCostMult);
}
function freeCrateReady() { return Date.now() >= S.freeCrateAt; }

// Luck has diminishing returns (it can never pass 10), and lifts the ultra tiers more gently
// than the first five, so even a huge Luck stat leaves a Singularity a long chase.
function effectiveLuck() { const l = Math.max(0, ST.luck); return (10 * l) / (l + 10); }
function luckPower(i) { return 0.35 * Math.min(i, 4) + 0.08 * Math.max(0, i - 4); }
function rarityWeights(minR = 0) {
  const L = 1 + effectiveLuck();
  return RARITY.map((r, i) => (i < minR ? 0 : r.weight * Math.pow(L, luckPower(i)) * (i >= 3 ? ST.jackpot : 1)));
}

function rarityOdds() {
  const ws = rarityWeights(0);
  const tot = ws.reduce((a, b) => a + b, 0);
  return ws.map(w => w / tot);
}

// Tool cases and pet cases each keep their own pity counters.
function pityFor(kind = S.caseKind) { return kind === 'pet' ? S.pityPet : S.pity; }
function rollRarity(minR = 0, kind = S.caseKind) {
  const pity = pityFor(kind);
  let lo = minR;
  if (pity.leg + 1 >= LEGENDARY_PITY) lo = Math.max(lo, 3);
  else if (pity.epic + 1 >= ST.epicPity) lo = Math.max(lo, 2);
  const r = weightedIndex(rarityWeights(lo));
  if (r >= 3) { pity.leg = 0; pity.epic = 0; }
  else if (r === 2) { pity.epic = 0; pity.leg++; }
  else { pity.epic++; pity.leg++; }
  return r;
}

// Material for your deepest floor this run, plus four per case tier above the Copper Crate.
function materialForFloor(f) { return clamp(1 + Math.floor((f - 1) / MATERIAL_FLOORS), 1, MATERIALS.length - 1); }
function dropMaterial(caseTier) { return clamp(materialForFloor(S.run.maxFloor) + MATERIALS_PER_CASE * (caseTier - 1), 1, MATERIALS.length - 1); }

// CS2-style float: pick a wear band by its share, then a float inside that band.
function rollFloat(rng = Math.random) {
  const w = WEAR[weightedIndex(WEAR.map(x => x.share), rng)];
  return Math.round((w.min + rng() * (w.max - w.min)) * 10000) / 10000;
}
function wearIndex(fl) { const i = WEAR.findIndex(w => fl < w.max); return i < 0 ? WEAR.length - 1 : i; }

// Raw rarity chances with no luck at all. Every "1 in N" in the game uses these, so a pull's odds
// never change with your gear or skills; luck is shown on its own as a % boost.
function baseRarityOdds() {
  const tot = RARITY.reduce((a, r) => a + r.weight, 0);
  return RARITY.map(r => r.weight / tot);
}

// "1 in N" for a drop: the raw rarity odds times the wear band's share for gear. Pets have no wear.
function dropOdds(r, fl = null) {
  const p = baseRarityOdds()[r] * (fl == null ? 1 : WEAR[wearIndex(fl)].share);
  return p > 0 ? 1 / p : Infinity;
}

// Tool cases drop gear only and pet cases drop pets only; the case kind is picked on the Cases tab.
function rollDrop(tier, minR = 0, kind = S.caseKind) {
  const r = rollRarity(minR, kind);
  if (kind === 'pet') {
    return { kind: 'pet', sp: weightedPick(PET_IDS, id => PETS[id].weight), r, odds: dropOdds(r) };
  }
  const slot = weightedPick(SLOT_IDS, s => SLOTS[s].weight);
  const main = SLOTS[slot].main;
  const subs = shuffle(SUB_POOL.filter(k => k !== main))
    .slice(0, SUB_COUNT[r])
    .map(k => ({ k, roll: Math.round(rand(0.7, 1.3) * 1000) / 1000 }));
  const fl = rollFloat();
  const item = { id: S.nextId++, slot, r, t: dropMaterial(tier), fl, lv: 0, subs, isNew: true };
  return { kind: 'gear', r, item, odds: dropOdds(r, fl) };
}

// Rarest pulls are kept forever, per slot and overall.
function recordPull(d) {
  if (!isFinite(d.odds)) return;
  const key = d.kind === 'pet' ? 'pet' : d.item.slot;
  const entry = d.kind === 'pet'
    ? { r: d.r, odds: Math.round(d.odds), sp: d.sp, at: Date.now() }
    : { r: d.r, odds: Math.round(d.odds), fl: d.item.fl, t: d.item.t, slot: d.item.slot, at: Date.now() };
  const better = !S.best[key] || entry.odds > S.best[key].odds;
  if (better) S.best[key] = entry;
  if (!S.best.all || entry.odds > S.best.all.odds) { S.best.all = { ...entry, kind: d.kind }; d.recordAll = true; }
  if (better) d.record = true;
}

function grantDrop(d) {
  if (d.r > S.stats.bestDrop) S.stats.bestDrop = d.r;
  recordPull(d);
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
  // Auto-scrap never throws away an upgrade over what you have equipped in that slot.
  if (it.r < S.settings.autoSalvage && !isUpgrade(it)) {
    const v = scrapValue(it);
    S.scrap += v;
    d.salvaged = v;
    return;
  }
  if (S.gear.bag.length >= BAG_SIZE) {
    // A full bag scraps the weakest thing in it to make room for a better drop,
    // so a Legendary never turns into scrap just because the bag was full of Commons.
    const i = weakestBagIndex();
    if (i < 0 || itemRank(S.gear.bag[i]) >= itemRank(it)) {
      const v = scrapValue(it);
      S.scrap += v;
      d.salvaged = v;
      return;
    }
    const old = S.gear.bag.splice(i, 1)[0];
    const v = scrapValue(old);
    S.scrap += v;
    d.madeRoom = { name: `${RARITY[old.r].name} ${itemName(old)}${old.lv ? ' +' + old.lv : ''}`, scrap: v };
  }
  S.gear.bag.unshift(it);
}

function isUpgrade(it) {
  const eq = S.gear.eq[it.slot];
  return !eq || itemStats(it)[0].v > itemStats(eq)[0].v;
}

function itemRank(it) { return it.r * 1000 + it.t * 20 + it.lv; }
function weakestBagIndex() {
  let best = -1;
  for (let i = 0; i < S.gear.bag.length; i++) {
    if (S.gear.bag[i].locked) continue;
    if (best < 0 || itemRank(S.gear.bag[i]) < itemRank(S.gear.bag[best])) best = i;
  }
  return best;
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
const SCRAP_BY_RARITY = [2, 5, 15, 45, 150, 400, 1000, 2500, 6000, 15000, 40000];
function materialScale(t) { return 1 + (t - 1) / MATERIALS_PER_CASE; }
function quality(fl) { return 1.2 - 0.4 * fl; }
function wearName(fl) { return (WEAR.find(w => fl < w.max) || WEAR[WEAR.length - 1]).name; }
function statValue(k, r, t, mult, sub = false) {
  const s = STATS[k];
  const rm = sub || k === 'luck' ? SUB_MULT[r] : RARITY_MULT[r];
  return s.base * rm * Math.pow(s.tier, (t - 1) * MATERIAL_STEP) * mult;
}
function itemStats(it) {
  const lv = 1 + 0.1 * it.lv;
  const q = quality(it.fl);
  const main = SLOTS[it.slot].main;
  const out = [{ k: main, v: statValue(main, it.r, it.t, q * lv), main: true }];
  for (const s of it.subs) out.push({ k: s.k, v: statValue(s.k, it.r, it.t, q * s.roll * lv, true) * 0.5 });
  return out;
}
function itemName(it) { return `${MATERIALS[it.t].name} ${SLOTS[it.slot].name}`; }
function scrapValue(it) {
  const st = ST || { scrapMult: 1 };
  return Math.ceil(SCRAP_BY_RARITY[it.r] * materialScale(it.t) * st.scrapMult * (1 + it.lv * 0.5));
}
function reforgeCost(it) {
  return Math.ceil(8 * Math.pow(it.lv + 1, 1.6) * Math.pow(materialScale(it.t), 1.3) * [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10][it.r]);
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

// Locked items can't be scrapped by any button, and a full bag never scraps them to make room.
function toggleLock(id) {
  const f = findItem(id);
  if (!f) return false;
  f.it.locked = !f.it.locked;
  return true;
}

function salvageItem(id) {
  const f = findItem(id);
  if (!f || f.where !== 'bag' || f.it.locked) return 0;
  const v = scrapValue(f.it);
  S.gear.bag.splice(f.index, 1);
  S.scrap += v;
  return v;
}

function salvageBelow(r) {
  let total = 0;
  let n = 0;
  S.gear.bag = S.gear.bag.filter(it => {
    if (it.r < r && !it.locked) {
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
// Copies needed to merge up from rarity r: 3 up to Mythic, then 5 for Mythic -> Exotic, 7, 9...
function mergeCost(r) { return r < 4 ? 3 : 5 + 2 * (r - 4); }

// Pet luck follows the gentle curve past Mythic, like gear luck.
function petPower(k, r) { return k === 'luck' && r > 4 ? PET_POWER[4] * SUB_MULT[r] / SUB_MULT[4] : PET_POWER[r]; }
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
  const need = mergeCost(r);
  if (r >= MERGE_MAX || petAvailable(sp, r) < need) return false;
  S.pets.inv[sp][r] -= need;
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
  for (const sp of PET_IDS) for (let r = 0; r < MERGE_MAX; r++) while (mergePet(sp, r)) n++;
  return n;
}

function mergeablePets() {
  let n = 0;
  for (const sp of PET_IDS) for (let r = 0; r < MERGE_MAX; r++) if (petAvailable(sp, r) >= mergeCost(r)) n++;
  return n;
}

function petBonusText(sp, r) {
  const def = PETS[sp];
  return Object.entries(def.stats).map(([k, v]) => `${fmtPct(v * petPower(k, r))} ${STATS[k].name.toLowerCase()}`).join(', ');
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
    // A login reward the player opened the app for but never tapped is collected, not lost.
    const auto = S.daily.day && !S.daily.claimed ? claimDaily() : null;
    const gap = S.daily.day ? dayDiff(S.daily.day, today) : 0;
    S.daily.streak = gap === 1 ? S.daily.streak + 1 : 1;
    S.daily.day = today;
    S.daily.claimed = false;
    if (S.daily.streak > S.stats.bestLogin) S.stats.bestLogin = S.daily.streak;
    emit('newDay', {});
    if (auto) emit('dailyAuto', auto);
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

// What a login day actually pays, including the week bonus (keys +1 per week, scrap doubles).
function dailyRewardLabel(streak) {
  const rw = dailyRewardFor(streak);
  if (rw.keys) return `${rw.keys + rw.week} keys`;
  if (rw.scrap) return `${rw.scrap * (1 + rw.week)} scrap`;
  return rw.label;
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
// Prestiging pays two things. Power (+10% damage each, forever) grows with the square of the level
// you reached, so deep runs count for much more than quick ones. Cores are spent in the prestige tree.
function prestigeGain() { return coresFor(S.run.maxFloor); }
function powerGain() { return Math.round((S.run.level * S.run.level) / 40); }
function canPrestige() { return S.run.maxFloor >= 25 && prestigeGain() > 0; }

function doPrestige() {
  if (!canPrestige()) return null;
  const gain = prestigeGain();
  const power = powerGain();
  const slotsBefore = petSlots();
  const tierBefore = bestCaseTier();
  S.cores += gain;
  S.power += power;
  S.prestiges++;
  S.stats.prestiges = S.prestiges;
  S.coins = 0;
  S.run = freshRun();
  S.run.skills = { ...S.locks };
  S.run.sp = 2 * ptLevel('headstart');
  S.math.streak = 0;
  R.enemy = null;
  R.spawnT = 1;
  R.queued = [];
  R.frenzyT = 0;
  R.ore = null;
  R.bonusRound = null;
  S.bonusRound = null;
  endDuel(false);
  recalc();
  const tierAfter = bestCaseTier();
  return {
    gain,
    power,
    total: S.cores,
    newSlot: petSlots() > slotsBefore,
    newCase: tierAfter > tierBefore ? CASES[tierAfter - 1].name : null,
  };
}

// Prestige tree.
function ptCost(id) {
  const n = PRESTIGE_TREE.find(x => x.id === id);
  const lv = ptLevel(id);
  return n.step ? n.base + n.step * lv : Math.ceil(n.base * Math.pow(n.growth, lv));
}
function buyPrestigeNode(id) {
  if (!PRESTIGE_TREE.some(x => x.id === id)) return false;
  const cost = ptCost(id);
  if (S.cores < cost) return false;
  S.cores -= cost;
  S.ptree[id] = ptLevel(id) + 1;
  track('ptree');
  recalc();
  return true;
}

// Locks keep chosen skill ranks through every prestige. Memory levels are the slots.
function lockSlots() { return ptLevel('memory'); }
function locksUsed() { let n = 0; for (const k in S.locks) n += S.locks[k]; return n; }
function canLockRank(id) { return locksUsed() < lockSlots() && skillRank(id) > (S.locks[id] || 0); }
function lockRank(id) {
  if (!canLockRank(id)) return false;
  S.locks[id] = (S.locks[id] || 0) + 1;
  return true;
}
function unlockRank(id) {
  if (!S.locks[id]) return false;
  if (--S.locks[id] <= 0) delete S.locks[id];
  return true;
}

// ---------- idle and offline ----------
function idleRates() {
  const f = S.run.floor; // on a boss floor the miner farms that floor's regular enemies
  const dps = Math.max(1e-9, ST.dps * ST.goldDrill);
  const t = (hpFor(f) * 0.975 * ST.hpMult) / dps + SPAWN_GAP + ENTER_TIME;
  return {
    coins: (coinUnit(f) * 1.4 * ST.coinMult) / t,
    xp: (xpUnit(f) * 0.985 * ST.xpMult) / t,
    kps: 1 / t,
  };
}

function applyOffline(sec) {
  if (!(sec >= 10)) return null;
  recalc(); // the 2x boost state must be as of now, not as of when the app went to the background
  const capped = Math.min(sec, ST.offlineCap);
  const eff = capped * ST.offlineRate;
  const r = idleRates();
  // Only the part of the absence that a 2x coin boost actually covered pays double.
  const start = Date.now() - sec * 1000;
  const boostedSec = clamp((S.boostUntil - start) / 1000, 0, capped);
  const baseCoins = r.coins / ST.boost;
  const coins = baseCoins * (eff + boostedSec * ST.offlineRate);
  const res = { sec, capped, coins, xp: r.xp * eff, kills: Math.floor(r.kps * eff), runStarted: S.run.started };
  addCoins(res.coins);
  gainXp(res.xp);
  S.stats.kills += res.kills;
  return res;
}

// ---------- saving ----------
function serialize() {
  S.savedAt = Date.now();
  // While the app sits in the background the drill is not running, so a save made from there
  // (tab closed from the switcher, browser killed) must keep the moment it went to the background.
  S.lastSeen = R.hiddenAt || S.savedAt;
  S.gameVersion = GAME_VERSION;
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
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    keepBrokenSave(raw);
    return null;
  }
}

// A save that cannot be read is kept under another key instead of being overwritten.
function keepBrokenSave(raw) {
  try {
    if (raw) localStorage.setItem(SAVE_KEY + '-broken', typeof raw === 'string' ? raw : JSON.stringify(raw));
  } catch (e) {
    /* storage full or unavailable */
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
  const prev = S;
  const next = hydrate(obj);
  S = next;
  try {
    R.enemy = null;
    R.spawnT = 0.6;
    R.queued = [];
    R.bonusRound = S.bonusRound;
    R.duel = null;
    R.frenzyT = 0;
    R.ore = null;
    R.decayAcc = 0;
    R.lastAnswer = R.time; // a loaded combo gets the normal grace period before it fades
    startPaceSession();
    recalc();
    ensureDay();
    R.dayKey = dateKey();
  } catch (e) {
    // Never leave a half-loaded state behind: keep playing on the previous one.
    S = prev;
    R.bonusRound = S.bonusRound;
    if (ST) recalc();
    throw e;
  }
}
