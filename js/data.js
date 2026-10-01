'use strict';
// Game data tables. Tuning numbers live here and in the formulas at the top of engine.js.

// `odds` is the base chance as "1 in N" before luck. Common takes whatever is left.
// Above Mythic the tiers are huge power spikes: a Singularity carries a run ~15 floors past its wall.
const RARITY = [
  { key: 'common', name: 'Common', color: '#a7adbb' },
  { key: 'rare', name: 'Rare', color: '#4aa8ff', odds: 4 },
  { key: 'epic', name: 'Epic', color: '#b76dff', odds: 10 },
  { key: 'legendary', name: 'Legendary', color: '#ffb52e', odds: 26 },
  { key: 'mythic', name: 'Mythic', color: '#ff4d6d', odds: 143 },
  { key: 'exotic', name: 'Exotic', color: '#2ff0c4', odds: 500 },
  { key: 'divine', name: 'Divine', color: '#fff4a8', odds: 2500 },
  { key: 'celestial', name: 'Celestial', color: '#7fd4ff', odds: 10000 },
  { key: 'cosmic', name: 'Cosmic', color: '#ff6bd6', odds: 50000 },
  { key: 'eclipse', name: 'Eclipse', color: '#9b6bff', odds: 250000 },
  { key: 'singularity', name: 'Singularity', color: '#ffffff', odds: 1000000 },
];
{
  let rest = 1;
  for (const r of RARITY) if (r.odds) { r.weight = 1 / r.odds; rest -= r.weight; }
  RARITY[0].weight = rest;
}
const TOP_RARITY = RARITY.length - 1;
const ULTRA = 5; // Exotic and above: big reveals, auras, no pity
const MERGE_MAX = 4; // pets merge up to Mythic; anything above only comes from cases
const RARITY_MULT = [1, 1.8, 3, 5, 8, 14, 25, 45, 80, 140, 250]; // gear stat multiplier
const PET_POWER = [1, 2.2, 4.5, 9, 18, 30, 50, 85, 140, 230, 380]; // pet stat multiplier
// Luck and sub-stats only creep up past Mythic: the huge jumps are for damage and coins,
// otherwise one lucky pull would snowball into more lucky pulls.
const SUB_MULT = [1, 1.8, 3, 5, 8, 9, 10, 11, 12, 13, 14];

// Index 0 is the starter pick you carry before finding gear. Drops are made of the material
// for your deepest floor this run (a new one every MATERIAL_FLOORS floors), so there is always
// a better version of every item further down.
const MATERIALS = [
  { name: 'Rusty', color: '#8d939e' },
  { name: 'Copper', color: '#e08a4a' },
  { name: 'Tin', color: '#b9c2c9' },
  { name: 'Bronze', color: '#c48a3a' },
  { name: 'Cobalt', color: '#4f7bd9' },
  { name: 'Iron', color: '#cfd6df' },
  { name: 'Steel', color: '#8fa6bf' },
  { name: 'Silver', color: '#e9eef4' },
  { name: 'Rose Gold', color: '#f2a58c' },
  { name: 'Gold', color: '#ffd23f' },
  { name: 'Platinum', color: '#f4f8ff' },
  { name: 'Jade', color: '#4fd98a' },
  { name: 'Ruby', color: '#ff3b5c' },
  { name: 'Crystal', color: '#7ff6ff' },
  { name: 'Sapphire', color: '#4a74ff' },
  { name: 'Obsidian', color: '#5b4a86' },
  { name: 'Magma', color: '#ff6a2a' },
  { name: 'Void', color: '#c46cff' },
  { name: 'Mithril', color: '#c4fff2' },
  { name: 'Starmetal', color: '#fff6c0' },
  { name: 'Dragonbone', color: '#f2e2bd' },
  { name: 'Eternium', color: '#ff9cf0' },
];
const MATERIAL_FLOORS = 10;
// Each material step multiplies item stats by a quarter-power of the stat's growth, e.g. damage
// x1.26 every 10 floors. Four steps equal one case tier (the old Copper, Iron, Gold, Crystal, Void).
let MATERIAL_STEP = 0.25;
const MATERIALS_PER_CASE = 4;

const BIOMES = [
  {
    name: 'Topsoil', adj: 'Mud', ore: 'Copper',
    bg: ['#1d140f', '#2e2017'], rock: ['#4a3426', '#33241a', '#6a4c37'],
    ground: ['#5c3f28', '#3f2a1a', '#8a6238'], oreColor: '#e3894b',
    enemy: ['#7fcf6a', '#4d8a3f', '#c4f5b4'],
  },
  {
    name: 'Stone Halls', adj: 'Stone', ore: 'Iron',
    bg: ['#15171d', '#232731'], rock: ['#4b505c', '#33363f', '#6c7280'],
    ground: ['#434752', '#2c2f37', '#6f7684'], oreColor: '#dfe6ee',
    enemy: ['#8ea4cc', '#5a6a8e', '#d4e2ff'],
  },
  {
    name: 'Crystal Caverns', adj: 'Crystal', ore: 'Crystal',
    bg: ['#0b1424', '#132a44'], rock: ['#23415f', '#172d44', '#36658f'],
    ground: ['#1f3c5c', '#142940', '#3f8db5'], oreColor: '#7ff6ff',
    enemy: ['#62dcff', '#2b88b3', '#d2fbff'],
  },
  {
    name: 'Magma Depths', adj: 'Magma', ore: 'Gold',
    bg: ['#1f0a08', '#3a140c'], rock: ['#562216', '#3a140e', '#83391f'],
    ground: ['#46190f', '#2b0f09', '#ff7a2a'], oreColor: '#ffd23f',
    enemy: ['#ff8a3d', '#b8411a', '#ffd3a1'],
  },
  {
    name: 'The Abyss', adj: 'Void', ore: 'Voidstone',
    bg: ['#0d0718', '#1c0f33'], rock: ['#35225a', '#22163c', '#55398a'],
    ground: ['#2a1a47', '#190f2c', '#9a5cff'], oreColor: '#e07bff',
    enemy: ['#c36cff', '#7a39b8', '#f0caff'],
  },
  {
    name: 'Starcore', adj: 'Star', ore: 'Starmetal',
    bg: ['#161104', '#2b220a'], rock: ['#625326', '#3f3518', '#9a843f'],
    ground: ['#56461c', '#382e12', '#fff0a0'], oreColor: '#ffffff',
    enemy: ['#fff1a8', '#cfae45', '#ffffff'],
  },
];
const FLOORS_PER_BIOME = 25;

const ENEMIES = {
  rock: { hp: 0.8, coin: 2.0, xp: 0.5, weight: 35, minFloor: 1, name: b => `${b.ore} Node` },
  slime: { hp: 1.0, coin: 1.0, xp: 1.0, weight: 30, minFloor: 1, name: b => `${b.adj} Slime` },
  bat: { hp: 0.7, coin: 0.8, xp: 1.3, weight: 20, minFloor: 2, name: b => `${b.adj} Bat` },
  golem: { hp: 1.7, coin: 1.6, xp: 1.8, weight: 15, minFloor: 5, name: b => `${b.adj} Golem` },
  goldie: { hp: 2.5, coin: 25, xp: 3, weight: 0, minFloor: 5, name: () => 'Treasure Mole' },
};
const NORMAL_ENEMIES = ['rock', 'slime', 'bat', 'golem'];
const BOSS_ORDER = ['golem', 'slime', 'bat'];
const BOSS_NAMES = { golem: 'Golem Lord', slime: 'King Slime', bat: 'Bat Queen' };

const UPGRADES = [
  { id: 'sharpen', name: 'Sharpen Pick', icon: 'pick', base: 10, growth: 1.15, unlock: 1,
    desc: '+1 base damage. Damage doubles every 25 levels' },
  { id: 'brain', name: 'Brain Amp', icon: 'brain', base: 30, growth: 1.45, unlock: 2,
    desc: '+10% math strike damage' },
  { id: 'fury', name: 'Fury', icon: 'bolt', base: 50, growth: 1.4, max: 50, unlock: 3,
    desc: '+4% attack speed' },
  { id: 'magnet', name: 'Coin Magnet', icon: 'coin', base: 80, growth: 1.45, unlock: 5,
    desc: '+10% coins' },
  { id: 'crit', name: 'Keen Eye', icon: 'eye', base: 300, growth: 1.5, max: 30, unlock: 8,
    desc: '+1.5% crit chance' },
  { id: 'critdmg', name: 'Brutal Swing', icon: 'skull', base: 1000, growth: 1.5, unlock: 12,
    desc: '+15% crit damage' },
  { id: 'scholar', name: 'Scholar', icon: 'book', base: 200, growth: 1.45, unlock: 15,
    desc: '+10% XP' },
];

// One skill tree with three branches. Points spent in a branch unlock its deeper tiers.
const TIER_REQ = [0, 5, 10, 15];
const BRANCHES = [
  {
    id: 'brawler', name: 'Brawler', color: '#ff6b5a',
    blurb: 'Active play: math strikes, combos and bosses.',
    passive: '+2% damage per point',
    nodes: [
      { id: 'quickwit', name: 'Quick Wit', tier: 0, max: 5, desc: '+20% math strike damage per rank' },
      { id: 'momentum', name: 'Momentum', tier: 0, max: 5, desc: '+4 max combo per rank' },
      { id: 'ironmind', name: 'Iron Mind', tier: 1, max: 3, desc: 'A wrong answer keeps 10% more of your streak per rank' },
      { id: 'adrenaline', name: 'Adrenaline', tier: 1, max: 3, desc: 'Each combo stack gives +1% more damage per rank' },
      { id: 'focus', name: 'Battle Focus', tier: 2, max: 3, desc: 'Your combo waits 2s longer before it starts to fade, per rank' },
      { id: 'executioner', name: 'Executioner', tier: 2, max: 5, desc: '+30% damage to bosses per rank' },
      { id: 'overdrive', name: 'Overdrive', tier: 3, max: 1, desc: 'Every 10th answer in a streak lands a MEGA strike (x5)' },
    ],
  },
  {
    id: 'tycoon', name: 'Tycoon', color: '#ffcc4d',
    blurb: 'Idle play: coins, auto-drilling and offline earnings.',
    passive: '+2% coins per point',
    nodes: [
      { id: 'greed', name: 'Greed', tier: 0, max: 5, desc: '+15% coins per rank' },
      { id: 'autodrill', name: 'Auto-Drill', tier: 0, max: 5, desc: '+10% attack speed per rank' },
      { id: 'nightshift', name: 'Night Shift', tier: 1, max: 5, desc: '+10% offline earning rate per rank (base 40%)' },
      { id: 'deeppockets', name: 'Deep Pockets', tier: 1, max: 3, desc: '+2h max offline time per rank (base 4h)' },
      { id: 'oresense', name: 'Ore Sense', tier: 2, max: 3, desc: 'Lucky ores appear 20% more often per rank' },
      { id: 'compound', name: 'Compound', tier: 2, max: 3, desc: '+0.3% coins per floor reached this run, per rank' },
      { id: 'golddrill', name: 'Golden Drill', tier: 3, max: 1, desc: 'x2.5 damage while your combo is 0 (pure idle)' },
    ],
  },
  {
    id: 'gambler', name: 'Gambler', color: '#b76dff',
    blurb: 'Luck: better cases, cheaper rolls, more keys.',
    passive: '+2% luck per point',
    nodes: [
      { id: 'lucky', name: 'Lucky Charm', tier: 0, max: 5, desc: '+10% luck per rank' },
      { id: 'haggler', name: 'Haggler', tier: 0, max: 5, desc: 'Cases cost 6% less per rank' },
      { id: 'pity', name: 'Pity Pact', tier: 1, max: 3, desc: 'Guaranteed Epic+ comes 2 opens sooner per rank' },
      { id: 'scrapper', name: 'Scrapper', tier: 1, max: 3, desc: '+25% scrap from salvaging per rank' },
      { id: 'doubledown', name: 'Double Down', tier: 2, max: 5, desc: '6% chance per rank to get a bonus item from a case' },
      { id: 'keymaster', name: 'Key Master', tier: 2, max: 4, desc: '25% chance per rank for an extra key from bosses' },
      { id: 'jackpot', name: 'Jackpot', tier: 3, max: 1, desc: 'Legendary and Mythic odds x2' },
    ],
  },
];
const SKILL_INDEX = {};
for (const b of BRANCHES) for (const n of b.nodes) SKILL_INDEX[n.id] = { ...n, branch: b.id };

// Gear stats. Values are fractions (0.30 = +30%) except crit, which is flat percentage points.
const STATS = {
  dmg: { name: 'Damage', base: 0.15, tier: 2.5 },
  coin: { name: 'Coins', base: 0.15, tier: 2.5 },
  luck: { name: 'Luck', base: 0.10, tier: 1.45 },
  aps: { name: 'Attack speed', base: 0.05, tier: 1.35 },
  crit: { name: 'Crit chance', base: 0.015, tier: 1.15 },
  critdmg: { name: 'Crit damage', base: 0.20, tier: 1.8 },
  xp: { name: 'XP', base: 0.10, tier: 1.7 },
  strike: { name: 'Math strike', base: 0.25, tier: 2.2 },
};
const SLOTS = {
  pick: { name: 'Pickaxe', main: 'dmg', weight: 40 },
  helm: { name: 'Helmet', main: 'coin', weight: 30 },
  charm: { name: 'Charm', main: 'luck', weight: 30 },
};
const SLOT_IDS = Object.keys(SLOTS);
const SUB_POOL = ['aps', 'crit', 'critdmg', 'xp', 'strike', 'dmg', 'coin', 'luck'];
const SUB_COUNT = [0, 1, 1, 2, 3, 3, 4, 4, 4, 5, 5];
// CS2-style wear: first a band is picked with these shares, then a float inside the band.
const WEAR = [
  { min: 0, max: 0.07, name: 'Factory New', short: 'FN', share: 0.03 },
  { min: 0.07, max: 0.15, name: 'Minimal Wear', short: 'MW', share: 0.24 },
  { min: 0.15, max: 0.38, name: 'Field-Tested', short: 'FT', share: 0.33 },
  { min: 0.38, max: 0.45, name: 'Well-Worn', short: 'WW', share: 0.24 },
  { min: 0.45, max: 1, name: 'Battle-Scarred', short: 'BS', share: 0.16 },
];
const MAX_ITEM_LEVEL = 10;
const BAG_SIZE = 60;

const PETS = {
  mole: { name: 'Mole', weight: 26, stats: { dmg: 0.05 }, fly: false },
  bat: { name: 'Bat', weight: 22, stats: { aps: 0.03 }, fly: true },
  slime: { name: 'Slime', weight: 26, stats: { coin: 0.06 }, fly: false },
  owl: { name: 'Owl', weight: 14, stats: { strike: 0.10, xp: 0.04 }, fly: true },
  fox: { name: 'Fox', weight: 9, stats: { luck: 0.04 }, fly: false },
  drake: { name: 'Drake', weight: 3, stats: { dmg: 0.04, xp: 0.05 }, fly: true },
};
const PET_IDS = Object.keys(PETS);

// Better cases make their items from deeper materials (+4 materials per case tier above Copper).
// `chest` is the material used to draw the case.
const CASES = [
  { tier: 1, name: 'Copper Crate', base: 20, prestige: 0, chest: 1 },
  { tier: 2, name: 'Iron Case', base: 80, prestige: 1, chest: 5 },
  { tier: 3, name: 'Gold Case', base: 320, prestige: 2, chest: 9 },
  { tier: 4, name: 'Crystal Case', base: 1300, prestige: 3, chest: 13 },
  { tier: 5, name: 'Void Case', base: 5000, prestige: 5, chest: 17 },
];
let CASE_INFLATION = 1.005; // each case bought with coins this run costs 0.5% more
const AUTO_ROLL_MS = 450; // auto-roll speed while the game is open
const PET_CHANCE = 0.3;
const EPIC_PITY = 10;
const LEGENDARY_PITY = 60;
const FREE_CRATE_HOURS = 4;

const MATH_TIERS = [
  null,
  'Addition', 'Subtraction', 'Times tables', 'Bigger sums', 'Division', 'Two-digit sums',
  'Long multiply', 'Mixed operations', 'Squares and percents', 'Algebra', 'Two-digit times', 'Expert mix',
];

// Seven-day login calendar. The streak keeps counting past day 7 and keys grow each week.
const DAILY_REWARDS = [
  { label: '2 keys', keys: 2 },
  { label: 'Coin bag', coinMinutes: 10 },
  { label: '3 keys', keys: 3 },
  { label: '80 scrap', scrap: 80 },
  { label: '4 keys', keys: 4 },
  { label: '2x coins, 30 min', boostMinutes: 30 },
  { label: 'Epic+ crate', crate: 2 },
];

const QUESTS = [
  { id: 'solve', ev: 'solve', n: [40, 60, 80], text: n => `Solve ${n} problems` },
  { id: 'quick', ev: 'quick', n: [15, 25, 35], text: n => `Get ${n} QUICK answers` },
  { id: 'streak', ev: 'streak', max: true, n: [12, 18, 25], text: n => `Reach a streak of ${n}` },
  { id: 'kills', ev: 'kill', n: [200, 350, 500], text: n => `Defeat ${n} enemies` },
  { id: 'bosses', ev: 'boss', n: [2, 3, 5], text: n => `Defeat ${n} bosses` },
  { id: 'floors', ev: 'floor', n: [10, 15, 25], text: n => `Clear ${n} floors` },
  { id: 'cases', ev: 'case', n: [3, 5, 8], text: n => `Open ${n} cases` },
  { id: 'ores', ev: 'ore', n: [2, 3, 4], text: n => `Tap ${n} lucky ores` },
  { id: 'merge', ev: 'merge', n: [1, 2, 3], text: n => `Merge ${n} pets` },
  { id: 'upg', ev: 'upg', n: [25, 50, 80], text: n => `Buy ${n} Forge levels` },
];
const QUEST_INDEX = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const QUEST_REWARD = { keys: 2, scrap: 25 };

// Each achievement claimed also adds a trophy: +2% damage and coins, forever.
const statAtLeast = (key, n) => () => (S.stats[key] || 0) >= n;
const ACHIEVEMENTS = [
  { id: 'f10', name: 'Going Down', desc: 'Reach B10', test: statAtLeast('bestFloor', 10), keys: 1 },
  { id: 'f25', name: 'Stone Cold', desc: 'Reach B25', test: statAtLeast('bestFloor', 25), keys: 2 },
  { id: 'f50', name: 'Crystal Clear', desc: 'Reach B50', test: statAtLeast('bestFloor', 50), keys: 3 },
  { id: 'f75', name: 'Feel the Heat', desc: 'Reach B75', test: statAtLeast('bestFloor', 75), keys: 4 },
  { id: 'f100', name: 'Into the Abyss', desc: 'Reach B100', test: statAtLeast('bestFloor', 100), keys: 5 },
  { id: 'f150', name: 'Starcore', desc: 'Reach B150', test: statAtLeast('bestFloor', 150), keys: 8 },
  { id: 'f200', name: 'Bottomless', desc: 'Reach B200', test: statAtLeast('bestFloor', 200), keys: 10 },
  { id: 'p50', name: 'Warm Up', desc: 'Solve 50 problems', test: statAtLeast('correct', 50), keys: 1 },
  { id: 'p250', name: 'Number Cruncher', desc: 'Solve 250 problems', test: statAtLeast('correct', 250), keys: 2 },
  { id: 'p1000', name: 'Human Calculator', desc: 'Solve 1,000 problems', test: statAtLeast('correct', 1000), keys: 4 },
  { id: 'p5000', name: 'Math Machine', desc: 'Solve 5,000 problems', test: statAtLeast('correct', 5000), keys: 8 },
  { id: 's10', name: 'On a Roll', desc: 'Reach a streak of 10', test: statAtLeast('bestStreak', 10), keys: 1 },
  { id: 's25', name: 'Locked In', desc: 'Reach a streak of 25', test: statAtLeast('bestStreak', 25), keys: 2 },
  { id: 's50', name: 'Flow State', desc: 'Reach a streak of 50', test: statAtLeast('bestStreak', 50), keys: 4 },
  { id: 's100', name: 'Unbreakable', desc: 'Reach a streak of 100', test: statAtLeast('bestStreak', 100), keys: 8 },
  { id: 'ml4', name: 'Times Tables', desc: 'Reach Math Lv 4', test: statAtLeast('bestMath', 4), keys: 1 },
  { id: 'ml7', name: 'Mental Gymnast', desc: 'Reach Math Lv 7', test: statAtLeast('bestMath', 7), keys: 2 },
  { id: 'ml10', name: 'Algebra Brain', desc: 'Reach Math Lv 10', test: statAtLeast('bestMath', 10), keys: 4 },
  { id: 'ml12', name: 'Big Brain', desc: 'Reach Math Lv 12', test: statAtLeast('bestMath', 12), keys: 6 },
  { id: 'c10', name: 'Just One More', desc: 'Open 10 cases', test: statAtLeast('cases', 10), keys: 1 },
  { id: 'c50', name: 'Case Hardened', desc: 'Open 50 cases', test: statAtLeast('cases', 50), keys: 3 },
  { id: 'c250', name: 'High Roller', desc: 'Open 250 cases', test: statAtLeast('cases', 250), keys: 5 },
  { id: 'c1000', name: 'House Edge', desc: 'Open 1,000 cases', test: statAtLeast('cases', 1000), keys: 10 },
  { id: 'd2', name: 'Purple Haze', desc: 'Find an Epic drop', test: statAtLeast('bestDrop', 2), keys: 1 },
  { id: 'd3', name: 'Golden Glow', desc: 'Find a Legendary drop', test: statAtLeast('bestDrop', 3), keys: 3 },
  { id: 'd4', name: 'Red Alert', desc: 'Find a Mythic drop', test: statAtLeast('bestDrop', 4), keys: 6 },
  { id: 'd5', name: 'Exotic Taste', desc: 'Find an Exotic drop', test: statAtLeast('bestDrop', 5), keys: 8 },
  { id: 'd6', name: 'Divine Light', desc: 'Find a Divine drop', test: statAtLeast('bestDrop', 6), keys: 12 },
  { id: 'd7', name: 'Starstruck', desc: 'Find a Celestial drop', test: statAtLeast('bestDrop', 7), keys: 16 },
  { id: 'd8', name: 'Cosmic Luck', desc: 'Find a Cosmic drop', test: statAtLeast('bestDrop', 8), keys: 20 },
  { id: 'd9', name: 'Total Eclipse', desc: 'Find an Eclipse drop', test: statAtLeast('bestDrop', 9), keys: 30 },
  { id: 'd10', name: 'One in a Million', desc: 'Find a Singularity drop', test: statAtLeast('bestDrop', 10), keys: 50 },
  { id: 'b5', name: 'Boss Hunter', desc: 'Defeat 5 bosses', test: statAtLeast('bosses', 5), keys: 1 },
  { id: 'b25', name: 'Boss Slayer', desc: 'Defeat 25 bosses', test: statAtLeast('bosses', 25), keys: 3 },
  { id: 'b100', name: 'Boss Nightmare', desc: 'Defeat 100 bosses', test: statAtLeast('bosses', 100), keys: 6 },
  { id: 'pr1', name: 'Collapse', desc: 'Prestige once', test: statAtLeast('prestiges', 1), keys: 2 },
  { id: 'pr3', name: 'Groundhog Day', desc: 'Prestige 3 times', test: statAtLeast('prestiges', 3), keys: 4 },
  { id: 'pr5', name: 'Deep Roots', desc: 'Prestige 5 times', test: statAtLeast('prestiges', 5), keys: 6 },
  { id: 'pr10', name: 'Eternal Miner', desc: 'Prestige 10 times', test: statAtLeast('prestiges', 10), keys: 10 },
  { id: 'm1', name: 'Fusion', desc: 'Merge a pet', test: statAtLeast('merges', 1), keys: 1 },
  { id: 'm10', name: 'Breeder', desc: 'Merge 10 pets', test: statAtLeast('merges', 10), keys: 3 },
  { id: 'm50', name: 'Menagerie', desc: 'Merge 50 pets', test: statAtLeast('merges', 50), keys: 6 },
  { id: 'col15', name: 'Collector', desc: 'Fill 15 index entries', test: () => collectionCount() >= 15, keys: 2 },
  { id: 'col30', name: 'Curator', desc: 'Fill 30 index entries', test: () => collectionCount() >= 30, keys: 4 },
  { id: 'col45', name: 'Archivist', desc: 'Fill 45 index entries', test: () => collectionCount() >= 45, keys: 10 },
  { id: 'col70', name: 'Completionist', desc: 'Fill 70 index entries', test: () => collectionCount() >= 70, keys: 25 },
  { id: 'q1', name: 'Daily Grind', desc: 'Finish all daily quests once', test: statAtLeast('dailyDone', 1), keys: 2 },
  { id: 'q7', name: 'Habit Formed', desc: 'Finish all daily quests on 7 days', test: statAtLeast('dailyDone', 7), keys: 6 },
  { id: 'l7', name: 'Week Streak', desc: 'Log in 7 days in a row', test: statAtLeast('bestLogin', 7), keys: 4 },
  { id: 'l30', name: 'Month Streak', desc: 'Log in 30 days in a row', test: statAtLeast('bestLogin', 30), keys: 12 },
  { id: 'o10', name: 'Shiny!', desc: 'Tap 10 lucky ores', test: statAtLeast('ores', 10), keys: 2 },
  { id: 'g5', name: 'Mole Catcher', desc: 'Catch 5 Treasure Moles', test: statAtLeast('goldies', 5), keys: 3 },
];
const TROPHY_BONUS = 0.02;
const COLLECTION_BONUS = 0.01;
