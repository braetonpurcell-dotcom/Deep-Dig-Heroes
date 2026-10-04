'use strict';
// Pixel art. Each sprite is rows of characters; the palette maps characters to colors.
// '.' is transparent. Sprites are built once into small canvases and cached.

const OUTLINE = '#120c18';

const PX = {
  hero: [
    '................',
    '.....kkkkk......',
    '....kyyyyykk....',
    '...kyywyyyyykk..',
    '...kyyyyyyyykLk.',
    '..kYYYYYYYYYkLk.',
    '..kkkkkkkkkkkk..',
    '....kssssssk....',
    '....kssssesk....',
    '....kSssssSk....',
    '...kkbbbbbbkk...',
    '..kBbbbbbbbbsk..',
    '..kBbbbbbbbbsk..',
    '...kddddddddk...',
    '...kdDk..kdDk...',
    '...kook..kook...',
  ],
  heroStep: [
    '................',
    '.....kkkkk......',
    '....kyyyyykk....',
    '...kyywyyyyykk..',
    '...kyyyyyyyykLk.',
    '..kYYYYYYYYYkLk.',
    '..kkkkkkkkkkkk..',
    '....kssssssk....',
    '....kssssesk....',
    '....kSssssSk....',
    '...kkbbbbbbkk...',
    '..kBbbbbbbbbsk..',
    '..kBbbbbbbbbsk..',
    '...kddddddddk...',
    '..kdDk....kdDk..',
    '..kook....kook..',
  ],
  pick: [
    '..kkkkkkk..',
    '.kMMmmmmmk.',
    'kmmkkkkknmk',
    'kmk.kwk.knk',
    'kk..kwk..kk',
    '....kwk....',
    '....kwk....',
    '....kwk....',
    '....kWk....',
    '....kwk....',
    '....kWk....',
    '....kkk....',
  ],
  slime: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkmmmmkk....',
    '...kmmllmmmmk...',
    '..kmmlmmmmmmmk..',
    '..kmmmmmmmmmmk..',
    '.kmmmmkmmmkmmmk.',
    '.kmmmmkmmmkmmmk.',
    '.kmmmmmmmmmmmmk.',
    '.kdmmmmmmmmmmdk.',
    '..kddddddddddk..',
    '...kkkkkkkkkk...',
  ],
  bat: [
    '................',
    '................',
    '................',
    '................',
    '.k............k.',
    '.kk...k..k...kk.',
    '.kmk..kmmk..kmk.',
    '.kmmkkmmmmkkmmk.',
    '.kmmmmmmmmmmmmk.',
    '.kmmmmrmmrmmmmk.',
    '.kmdmmmmmmmmdmk.',
    '.kd.kmmmmmmk.dk.',
    '.k...kmwwmk...k.',
    '......kkkk......',
    '................',
    '................',
  ],
  rock: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkllmmkk....',
    '...kllmmmommk...',
    '..klmmmoOommmk..',
    '..kmmmmmommmdk..',
    '.kmmommmmmmmmdk.',
    '.kmoOommmmommdk.',
    '.kmmommmmoOomdk.',
    '.kdmmmmmmommddk.',
    '..kddddddddddk..',
    '...kkkkkkkkkk...',
  ],
  golem: [
    '................',
    '....kkkkkkkk....',
    '...kmmmmmmmmk...',
    '...kmllmmmmmk...',
    '...kmeemmeemk...',
    '...kmmmmmmmmk...',
    '..kkkmkkkkmkkk..',
    '.kmmkmmmmmmkmmk.',
    '.kmlkmmoommkmlk.',
    '.kmmkmmmmmmkmmk.',
    '.kddkmmmmmmkddk.',
    '..kk.kmmmmk.kk..',
    '.....kmddmk.....',
    '....kmmk.kmmk...',
    '....kddk.kddk...',
    '....kkkk.kkkk...',
  ],
  goldie: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '....kmmmmmmkk...',
    '...kmmmmmmmmmkk.',
    '..kmmmmmmmkmmmpk',
    '..kmmlmmmmmmmmk.',
    '..kmllmmmmmmmk..',
    '...kmmmmmmmmk...',
    '...kwkk..kwkk...',
    '................',
  ],
  crown: [
    'k...k...k',
    'ky.kyk.yk',
    'kyyyyyyyk',
    'kyryybyyk',
    'kkkkkkkkk',
  ],
  mole: [
    '..........',
    '..........',
    '...kkkk...',
    '..kmmmmk..',
    '.kmmmmmmk.',
    '.kmmmkmmpk',
    '.kmlmmmmk.',
    '.kllmmmk..',
    '..kmmmmk..',
    '..kwk.kwk.',
  ],
  petbat: [
    '..........',
    'k........k',
    'kk..kk..kk',
    'kmk.kk.kmk',
    'kmmkmmkmmk',
    'kmmrmmrmmk',
    '.kmmmmmmk.',
    '..kmwwmk..',
    '...kkkk...',
    '..........',
  ],
  petslime: [
    '..........',
    '..........',
    '..........',
    '...kkkk...',
    '..kmllmk..',
    '.kmlmmmmk.',
    '.kmkmmkmk.',
    '.kmmmmmmk.',
    '.kdmmmmdk.',
    '..kkkkkk..',
  ],
  owl: [
    '.k......k.',
    '.kk....kk.',
    '.kmkkkkmk.',
    'kmwwmmwwmk',
    'kmwkmmkwmk',
    'kmmmyymmmk',
    'kmlmmmmlmk',
    '.kllmmllk.',
    '..kmmmmk..',
    '...y..y...',
  ],
  fox: [
    'k........k',
    'kk......kk',
    'kmk....kmk',
    'kmmkkkkmmk',
    'kmmmmmmmmk',
    'kmkmmmmkmk',
    '.kwmmmmwk.',
    '..kwwwwk..',
    '...kwnk...',
    '....kk....',
  ],
  drake: [
    '......k...',
    '.....kmk..',
    '..k.kmmmk.',
    '.kmkkmemmk',
    '.kmmkmmmmk',
    'kmmmmmmkk.',
    'kmlmmmmk..',
    '.kllmmmk..',
    '..kmkkmk..',
    '..kk..kk..',
  ],
  helm: [
    '....kkkk....',
    '..kkmmmmkk..',
    '.kmmwmmmmmk.',
    '.kmwmmmmmkLk',
    'kmmmmmmmmkLk',
    'kmmmmmmmmmkk',
    'kddddddddddk',
    'kkkkkkkkkkkk',
  ],
  charm: [
    '...kkkk...',
    '..k....k..',
    '.k......k.',
    '.k......k.',
    '..k....k..',
    '...kmmk...',
    '..kmMMmk..',
    '.kmMggmmk.',
    '.kmggggmk.',
    '.kmgggGmk.',
    '..kmggmk..',
    '...kmmk...',
    '....kk....',
  ],
  chest: [
    '..kkkkkkkkkk..',
    '.kmmmmmmmmmmk.',
    'kmMMMMMMMMMMmk',
    'kmmmmmmmmmmmmk',
    'kkkkkkkkkkkkkk',
    'kbbbbbkkbbbbbk',
    'kbbbbkyykbbbbk',
    'kbbbbkyykbbbbk',
    'kbbbbbkkbbbbbk',
    'kbbbbbbbbbbbbk',
    'kddddddddddddk',
    'kkkkkkkkkkkkkk',
  ],
  coin: [
    '..kkk..',
    '.kyyyk.',
    'kyYyyyk',
    'kyYyydk',
    'kyyyydk',
    '.kdddk.',
    '..kkk..',
  ],
  key: [
    '.kkk.....',
    'kyyyk....',
    'ky.ykkkkk',
    'kyyyyyyyk',
    '.kkkkykyk',
    '.....k.k.',
  ],
  core: [
    '...k...',
    '..kPk..',
    '.kPpPk.',
    'kPpppdk',
    '.kppdk.',
    '..kdk..',
    '...k...',
  ],
  scrap: [
    '..kkk..',
    '.kmmmk.',
    'kmmkmmk',
    'kmk.kmk',
    'kmmkmmk',
    '.kmmmk.',
    '..kkk..',
  ],
  nugget: [
    '...kk...',
    '..kyYk..',
    '.kyYyyk.',
    'kyyyyyyk',
    'kyyyyydk',
    '.kyyydk.',
    '..kddk..',
    '...kk...',
  ],
  brain: [
    '..kkkkk..',
    '.kppkppk.',
    'kpPpkpppk',
    'kppkpppPk',
    'kpPpkpppk',
    '.kppkppk.',
    '..kkkkk..',
    '...kk....',
  ],
  anvil: [
    'kkkkkkk..',
    'kmmmmmmkk',
    '.kmmmmmmk',
    '..kmmmkk.',
    '...kmk...',
    '..kmmmk..',
    '.kkkkkkk.',
  ],
  star: [
    '....k....',
    '...kyk...',
    'kkkkykkkk',
    'kyyyyyyyk',
    '.kyyyyyk.',
    '..kyyyk..',
    '.kyykyyk.',
    'kyyk.kyyk',
    'kkk...kkk',
  ],
  scroll: [
    '.kkkkkkk.',
    'kwwwwwwwk',
    '.kwwwwwk.',
    '.kwkkkwk.',
    '.kwwwwwk.',
    '.kwkkkwk.',
    '.kwwwwwk.',
    'kwwwwwwwk',
    '.kkkkkkk.',
  ],
  cog: [
    '...kkk...',
    '.k.kmk.k.',
    'kmkmmmkmk',
    '.kmmkmmk.',
    'kmmk.kmmk',
    '.kmmkmmk.',
    'kmkmmmkmk',
    '.k.kmk.k.',
    '...kkk...',
  ],
  bag: [
    '...kkk...',
    '..k...k..',
    '.kkkkkkk.',
    'kbbbbbbbk',
    'kbbkkkbbk',
    'kbbkykbbk',
    'kbbbbbbbk',
    'kdddddddk',
    '.kkkkkkk.',
  ],
  bolt: [
    '...kkkk',
    '..kyyk.',
    '.kyyk..',
    'kyyyyyk',
    '.kkyyk.',
    '..kyk..',
    '.kyk...',
    'kyk....',
    'kk.....',
  ],
  eye: [
    '..kkkkk..',
    '.kwwwwwk.',
    'kwwbbbwwk',
    'kwwbkbwwk',
    '.kwwwwwk.',
    '..kkkkk..',
  ],
  skull: [
    '.kkkkkk.',
    'kwwwwwwk',
    'kwkwwkwk',
    'kwkwwkwk',
    'kwwwwwwk',
    '.kwkkwk.',
    '.kwwwwk.',
    '..kkkk..',
  ],
  book: [
    'kkkkkkkk.',
    'kbbbbbbwk',
    'kbyyyybwk',
    'kbbbbbbwk',
    'kbyyybbwk',
    'kbbbbbbwk',
    'kkkkkkkwk',
    '.kkkkkkkk',
  ],
  lock: [
    '..kkk..',
    '.k...k.',
    '.k...k.',
    'kkkkkkk',
    'kyyyyyk',
    'kyykyyk',
    'kyykyyk',
    'kyyyyyk',
    'kkkkkkk',
  ],
  unlock: [
    '..kkk..',
    '.k...k.',
    '.....k.',
    'kkkkkkk',
    'kmmmmmk',
    'kmmkmmk',
    'kmmkmmk',
    'kmmmmmk',
    'kkkkkkk',
  ],
  trophy: [
    'kkkkkkkkk',
    'kyyyyyyyk',
    'kyYyyyyyk',
    '.kyyyyyk.',
    '..kyyyk..',
    '...kyk...',
    '...kyk...',
    '..kkkkk..',
    '.kyyyyyk.',
  ],
};

const PET_PALETTES = {
  mole: { m: '#8a5a3a', l: '#b07a52', p: '#ff8fa3', w: '#f2e6d0' },
  bat: { m: '#7a5aa8', r: '#ff5a6a', w: '#ffffff' },
  slime: { m: '#6ad36a', l: '#b8f5b0', d: '#3f8f45' },
  owl: { m: '#9a7048', l: '#d9b98a', w: '#ffffff', y: '#ffcc4d' },
  fox: { m: '#f08a3a', w: '#fff3e0', n: '#2a1a14' },
  drake: { m: '#3fbf9a', l: '#9af0d6', e: '#ffcc4d' },
};
const PET_SPRITE = { mole: 'mole', bat: 'petbat', slime: 'petslime', owl: 'owl', fox: 'fox', drake: 'drake' };

const HERO_PALETTE = {
  y: '#f2c14e', Y: '#c58f1f', L: '#fff7c2', w: '#ffffff', s: '#f4c393', S: '#d39a6a',
  e: OUTLINE, b: '#3e7bd6', B: '#2a569c', d: '#3b3155', D: '#2a2240', o: '#6a4122',
};

const ICON_PALETTES = {
  coin: { y: '#ffcc4d', Y: '#fff2b0', d: '#c98e1a' },
  key: { y: '#ffcc4d' },
  core: { P: '#f0b8ff', p: '#c46cff', d: '#7c34b8' },
  scrap: { m: '#9aa3b0' },
  nugget: { y: '#ffd23f', Y: '#fff6c0', d: '#c9900f' },
  brain: { p: '#ff9ec7', P: '#ffd1e6' },
  anvil: { m: '#9aa3b0' },
  star: { y: '#ffcc4d' },
  scroll: { w: '#f2e2bd' },
  cog: { m: '#a294b5' },
  bag: { b: '#b07a52', d: '#7a5236', y: '#ffcc4d' },
  bolt: { y: '#ffd23f' },
  eye: { w: '#f2e9d8', b: '#62c9ff' },
  skull: { w: '#f2e9d8' },
  book: { b: '#5a7bd6', y: '#ffcc4d', w: '#f2e9d8' },
  trophy: { y: '#ffcc4d', Y: '#fff2b0' },
  lock: { y: '#ffcc4d' },
  unlock: { m: '#9aa3b0' },
};

const spriteCache = new Map();

function buildSprite(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = ch === 'k' ? OUTLINE : palette[ch] || '#ff00ff';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function sprite(name, palette = {}, cacheKey = '') {
  const key = name + '|' + cacheKey;
  let c = spriteCache.get(key);
  if (!c) {
    c = buildSprite(PX[name], palette);
    spriteCache.set(key, c);
  }
  return c;
}

// Every opaque pixel painted one color: hit flashes and locked index entries.
function silhouette(src, color) {
  const key = 'sil|' + color;
  if (!src._sil) src._sil = {};
  if (src._sil[key]) return src._sil[key];
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  src._sil[key] = c;
  return c;
}

function materialPalette(tier) {
  const base = MATERIALS[tier].color;
  return { m: base, M: shade(base, 0.45), n: shade(base, -0.35), w: '#9a6a3a', W: '#6e4520' };
}

// Version 2: the hero is built from your look: a hat (the top seven rows) on the body, with your colours.
const HAT_ROWS = {
  helmet: PX.hero.slice(0, 7),
  cap: ['................', '................', '................', '.....kkkkkk.....', '....kyyyywyk....', '...kyyyyyyyykkk.', '...khkkkkkkYYYYk'],
  none: ['................', '................', '................', '................', '.....kkkkkk.....', '....khhwhhhk....', '....khhhhHHk....'],
  beanie: ['................', '.......kk.......', '......kwwk......', '.....kkkkkk.....', '....kyyyyyyk....', '...kyyyyyyyyk...', '...kYYYYYYYYk...'],
  bandana: ['................', '................', '................', '................', '.....kkkkkk.....', '....kyyywyyk....', '.kkkYYYYYYYk....'],
  viking: ['................', '.k............k.', '.kwk.kkkkkk.kwk.', '..kwkyyyyyykwk..', '...kyyyyyyyyk...', '...kYYYYYYYYk...', '...kkkkkkkkkk...'],
  crown: ['................', '....k..kk..k....', '....kykyykyk....', '....kyyyyyyk....', '....kywyywyk....', '....kkkkkkkk....', '....khhhhhhk....'],
};
function lookOf(look) { return look || (typeof S !== 'undefined' && S && S.look) || DEFAULT_LOOK; }
function lookKey(L) { return [L.hat, L.hatC, L.hair, L.skin, L.shirt, L.pants, L.boots, L.gearHelm === false ? 0 : 1, L.gearArmor === false ? 0 : 1].join('.'); }
function heroPalette(L) {
  const hat = L.hat === 'crown' ? '#ffcc4d' : LOOK_CLOTH[L.hatC], skin = LOOK_SKIN[L.skin], shirt = LOOK_CLOTH[L.shirt], pants = LOOK_CLOTH[L.pants], hair = LOOK_HAIR[L.hair];
  return { ...HERO_PALETTE, y: hat, Y: shade(hat, -0.28), w: L.hat === 'crown' ? '#ff4d6d' : '#ffffff', s: skin[0], S: skin[1], b: shirt, B: shade(shirt, -0.3),
    d: pants, D: shade(pants, -0.3), o: LOOK_BOOTS[L.boots], h: hair, H: shade(hair, -0.3) };
}
function heroBody(step, L) {
  const base = step ? 'heroStep' : 'hero', name = base + ':' + L.hat;
  if (!PX[name]) PX[name] = (HAT_ROWS[L.hat] || HAT_ROWS.helmet).concat(PX[base].slice(7));
  return sprite(name, heroPalette(L), lookKey(L));
}
// Your miner: the body in your look, wearing your equipped armor and helmet (unless the wardrobe
// says to show the outfit instead). gear defaults to what you have equipped.
function heroSprite(step, look = null, gear = null) {
  const L = lookOf(look);
  const eq = gear || (typeof S !== 'undefined' && S && S.gear ? S.gear.eq : {});
  const helm = L.gearHelm !== false ? eq.helm : null, armor = L.gearArmor !== false ? eq.charm : null;
  if (!helm && !armor) return heroBody(step, L);
  const tag = it => (it ? `${it.st || ''}.${it.t}.${it.r}` : '-');
  const key = `heroC|${step ? 1 : 0}|${lookKey(L)}|${tag(helm)}|${tag(armor)}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.drawImage(heroBody(step, helm ? { ...L, hat: 'none' } : L), 0, 0);
  if (armor) g.drawImage(wornSprite('charm', armor), 0, 0);
  if (helm) g.drawImage(wornSprite('helm', helm), 0, 0);
  spriteCache.set(key, c);
  return c;
}

function pickSprite(tier) {
  return sprite('pick', materialPalette(tier), 'mat' + tier);
}

function enemySprite(type, biome) {
  const [m, d, l] = biome.enemy;
  if (type === 'goldie') {
    return sprite('goldie', { m: '#ffcf3f', l: '#fff3b0', p: '#ff8fa3', w: '#ffffff' }, 'goldie');
  }
  if (type === 'rock') {
    const [rm, rd, rl] = biome.rock;
    const pal = { m: rl, d: rm, l: shade(rl, 0.3), o: biome.oreColor, O: shade(biome.oreColor, 0.6) };
    return sprite('rock', pal, biome.name);
  }
  const pal = { m, d, l, e: biome.oreColor, o: biome.oreColor, r: '#ff3b3b', w: '#ffffff' };
  return sprite(type, pal, biome.name);
}

function crownSprite() {
  return sprite('crown', { y: '#ffcc4d', r: '#ff4d6d', b: '#62c9ff' }, 'crown');
}

// Pets get the same rarity glow as gear from Mythic up.
function petSprite(sp, r = 0) {
  const base = sprite(PET_SPRITE[sp], PET_PALETTES[sp], sp);
  if (r < 4) return base;
  const key = `petfx|${sp}|${r}`;
  let c = spriteCache.get(key);
  if (!c) { c = decorateSprite(base, r, hashStr(key)); spriteCache.set(key, c); }
  return c;
}

// ---------- rarity art ----------
// The rarer an item, the more color it gets, Roblox-style:
//   Rare+ handle/trim in the rarity color, Legendary+ bright inlays, Mythic+ a glowing outline,
//   Exotic+ sparkles, Celestial+ a multi-color sheen, Singularity the full rainbow.
const RARITY_FX = {
  7: ['#7fd4ff', '#ffffff', '#b8a6ff'],
  8: ['#ff6bd6', '#7f6bff', '#3be8ff'],
  9: ['#ffd27a', '#9b6bff', '#2a1748'],
  10: ['#ff4d4d', '#ffb84d', '#fff34d', '#4dff88', '#4dd2ff', '#a64dff', '#ff4dd2'],
};
function gradientAt(colors, t) {
  const x = clamp(t, 0, 0.9999) * (colors.length - 1);
  const i = Math.floor(x);
  return mix(colors[i], colors[Math.min(i + 1, colors.length - 1)], x - i);
}

// ---------- Version 2: gear styles ----------
// Mirror a half-width row list into a symmetric sprite.
const sym = rows => rows.map(r => r + r.split('').reverse().join(''));
const GEAR_ICON = {
  pick: {
    war: ['kk.kkkkk.kk', 'kmkkMMMkkmk', 'kmMmmmmmmnk', '.kmmkwknmk.', '..kkkwkkk..', '....kwk....', '....kak....', '....kak....', '....kwk....', '....kWk....', '....kwk....', '....kkk....'],
    gilded: ['..kkkkkkk..', '.kyyyyyyyk.', 'kmmkkkkknmk', 'kmk.kwk.knk', 'kk..kwk..kk', '....kwk....', '...kkwkk...', '...kyYyk...', '...kkwkk...', '....kWk....', '....kwk....', '....kkk....'],
    clover: ['..kkkakkk..', '.kMMaAammk.', 'kmmkkakknmk', 'kmk.kwk.knk', 'kk..kwk..kk', '....kwk....', '....kak....', '....kwk....', '....kak....', '....kWk....', '....kwk....', '....kkk....'],
    rune: ['..kkkkkkk..', '.kMaMmamak.', 'kmmkkkkknmk', 'kak.kwk.kak', 'kk..kwk..kk', '....kak....', '....kwk....', '....kak....', '....kwk....', '....kWk....', '....kwk....', '....kkk....'],
    swift: ['......kk...', '.kkkkkMmk..', 'kmmmmmmmmkk', '.kkkkwkkknk', '....kwk..kk', '....kwk....', '....kak....', '....kwk....', '....kak....', '....kwk....', '....kWk....', '....kkk....'],
    sword: ['.....k.....', '....kMk....', '....kMk....', '....kmk....', '....kmk....', '....kmk....', '....knk....', '.kyyyyyyyk.', '..kkkakkk..', '....kak....', '....kgk....', '....kkk....'],
  },
  helm: {
    prospector: ['............', '............', '....kkkk....', '..kkmmmmkk..', '.kmmMmmmmmk.', '.kmMmmmmmkLk', 'kmmmmmmmmkLk', 'kmmmmmmmmmkk', 'kddddddddddk', 'kkkkkkkkkkkk'],
    horned: sym(['k.....', 'kok...', 'kok.kk', '.kokMm', '..kmMm', '.kmmmm', 'kmmmmm', 'kddddd', 'kkkkkk', '......']),
    lucky: sym(['......', '......', '...kkk', '..kccc', '.kccca', '.kcaAA', '.kccca', 'kkkkkk', 'kCCCCC', '.kkkkk']),
    scholar: ['.....kk.....', '....kcck....', '....kcck....', '...kccyck...', '...kcccck...', '..kccccyck..', '..kccccccck.', 'kkkkkkkkkkkk', 'kCCCCCCCCCCk', 'kkkkkkkkkkkk'],
    aviator: sym(['....kk', '..kkcc', '.kcccc', 'kmmmkc', 'kmaAmk', 'kkmmkc', '.kcccc', '.kckkk', '.kk...', '......']),
    storm: ['............', '............', '..kkkkkkkkk.', '.kccccccaAck', 'kccccccaAcck', 'kcccccaacck.', '.kkkkkaakk..', '..kk..kak...', '.kck...kk...', '.kk.........'],
  },
  charm: {
    cloak: sym(['...kkk', '..kccc', '.kcCCC', '.kcCkk', 'kcckaA', 'kcccka', 'kccccc', 'kcCccc', 'kccCcc', 'kcccCc', 'kCcccc', '.kkkkk']),
    plate: sym(['......', '.kkk..', 'kMmmkk', 'kmmmMm', '.kkmMm', '..kmmm', '..kmnm', '..kmmm', '..knmm', '..kddd', '...kmm', '....kk']),
    vest: sym(['......', '.kkk..', 'kccckk', 'kccckw', 'kcyckw', '.kcckw', '.kyckw', '.kcckw', '.kdddd', '.kcckk', '..kkk.', '......']),
    robe: sym(['......', '.kkk..', 'kccckk', 'kccckY', 'kcccky', '.kccka', '.kcccy', '.kcccy', '.kcccy', '.kcccy', '.kcccc', '.kkkkk']),
    jerkin: sym(['......', '..kk..', '.kcckk', 'kccccc', 'kcaccc', '.kaccc', '.kcacc', '.kccac', '.kdddy', '.kcccc', '.kcckk', '.kkk..']),
    mail: sym(['......', '.kkk..', 'kmnmkk', 'knmnmn', 'kmnmna', '.knmaa', '.kmnmA', '.knmnm', '.kmnmn', '.kdddd', '..kmnm', '...kkk']),
  },
};
// What your miner wears: a helmet over the head (rows 0-6) and armor over the body (rows 10-13).
const BLANK16 = '................';
const wornRows = (top, rows) => { const out = Array(16).fill(BLANK16); rows.forEach((r, i) => { out[top + i] = r; }); return out; };
const torso = (sh, mid1, mid2, hem = null) => wornRows(10, [sh.length === 16 ? sh : '...kk' + sh + 'kk...', '..k' + mid1 + '....', '..k' + mid2 + '....'].concat(hem ? [hem] : [])); // the hand (column 12) stays bare
const GEAR_WORN = {
  helm: {
    prospector: wornRows(0, [BLANK16, '.....kkkkk......', '....kmmmmmkk....', '...kmmMmmmmmkk..', '...kmmmmmmmmkLk.', '..knnnnnnnnnkLk.', '..kkkkkkkkkkkk..']),
    horned: wornRows(0, [BLANK16, '.k............k.', '.kok.kkkkkk.kok.', '..kokmmmmmmkok..', '...kmMmmmmmmk...', '...knnnnnnnnk...', '...kkkkkkkkkk...']),
    lucky: wornRows(3, ['.....kkkkkk.....', '....kcccaAck....', '...kccccaaackkk.', '...k.kkkkkkCCCCk']),
    scholar: wornRows(0, ['...kk...........', '..kcck..........', '...kcyk.........', '...kccckk.......', '....kccccck.....', '..kkkkkkkkkkkk..', '.kCCCCCCCCCCCCk.']),
    aviator: wornRows(3, ['.....kkkkkk.....', '....kccccccck...', '...kccckmaAmk...', '..kckkkkkmmkk...']),
    storm: wornRows(6, ['.kcccccccaAk....']),
  },
  charm: {
    cloak: torso('ccaAcc', 'Ccccccccc', 'CccccccCc'),
    plate: torso('..kMMmmmmmmMMk..', 'nmmmMmmmm', 'nmmmmmmmm', '...kddddddddk...'),
    vest: torso('cwwwwc', 'Cccwwwwcc', 'Ccywwwwyc'),
    robe: torso('cyyyyc', 'Cccyayccc', 'Ccccycccc', '...kCccccccCk...'),
    jerkin: torso('caccac', 'Ccaccacca', 'Cddddyddd'),
    mail: torso('nmnmnm', 'mnmnaamnm', 'nmnaamnmn'),
  },
};
// Each style's own colours: accent (a), cloth (c). Metal comes from the material, gems from rarity.
const STYLE_ART = {
  war: { a: '#a83a3a' }, gilded: {}, clover: { a: '#3eaa4a', A: '#8ae070' }, rune: { a: '#3ac8ff', A: '#c8f6ff' }, swift: { a: '#7ad0ff', A: '#e8f8ff' }, sword: { a: '#6e4428', A: '#9a6a3a' },
  prospector: {}, horned: {}, lucky: { c: '#f2ece0', C: '#c8bea8', a: '#3eaa4a', A: '#8ae070' }, scholar: { c: '#3a3a8a', C: '#26265e' },
  aviator: { c: '#8a5a32', C: '#5e3a1e', a: '#7ad0ff', A: '#e8f8ff' }, storm: { c: '#2e3a6a', C: '#1e2648', a: '#ffd23f', A: '#fff3a0' },
  cloak: { c: '#2e7a46', C: '#1e5230', a: '#7ae070', A: '#c8ffb0' }, plate: {}, vest: { c: '#6a3a8a', C: '#4a2462' },
  robe: { c: '#2e3a8a', C: '#1e2660', a: '#5ad8ff' }, jerkin: { c: '#8a5a32', C: '#5e3a1e', a: '#7ad0ff' }, mail: { a: '#ffd23f', A: '#fff3a0' },
};
function gearPalette(slot, tier, r, style) {
  const mat = MATERIALS[tier].color, rc = RARITY[r].color, art = STYLE_ART[style] || {};
  const trim = r >= 1 ? mix('#9a6a3a', rc, 0.55) : '#9a6a3a';
  const cloth = art.c ? (r >= 3 ? mix(art.c, rc, 0.25) : art.c) : '#6a6a74';
  const acc = art.a || rc;
  return {
    m: mat, M: r >= 3 ? mix(shade(mat, 0.45), rc, 0.6) : shade(mat, 0.45), n: shade(mat, -0.35), d: r >= 1 ? mix(shade(mat, -0.45), rc, 0.45) : shade(mat, -0.45),
    w: slot === 'charm' ? '#f2ece0' : trim, W: r >= 2 ? shade(rc, -0.2) : '#6e4520', L: r >= 2 ? shade(rc, 0.5) : '#fff7c2',
    g: rc, G: shade(rc, 0.6), y: '#ffcc4d', Y: '#c8901e', o: '#efe6d2',
    a: acc, A: art.A || shade(acc, 0.45), c: cloth, C: art.C ? (r >= 3 ? mix(art.C, rc, 0.2) : art.C) : shade(cloth, -0.3),
  };
}
function wornSprite(slot, it) {
  const st = (GEAR_STYLES[slot].find(x => x.id === it.st) || GEAR_STYLES[slot][0]).id;
  const key = `worn|${slot}|${st}|${it.t}|${it.r}`;
  let c = spriteCache.get(key);
  if (!c) { c = buildSprite(GEAR_WORN[slot][st], gearPalette(slot, it.t, it.r, st)); spriteCache.set(key, c); }
  return c;
}

function basePalette(slot, tier, r) {
  const mat = MATERIALS[tier].color;
  const rc = RARITY[r].color;
  const trim = r >= 1 ? mix('#9a6a3a', rc, 0.55) : '#9a6a3a';
  if (slot === 'pick') {
    return { m: mat, M: r >= 3 ? mix(shade(mat, 0.45), rc, 0.6) : shade(mat, 0.45), n: shade(mat, -0.35), w: trim, W: r >= 2 ? shade(rc, -0.2) : '#6e4520' };
  }
  if (slot === 'helm') {
    return { m: mat, w: r >= 3 ? mix(shade(mat, 0.6), rc, 0.6) : shade(mat, 0.6), L: r >= 2 ? shade(rc, 0.5) : '#fff7c2', d: r >= 1 ? mix(shade(mat, -0.45), rc, 0.45) : shade(mat, -0.45) };
  }
  return { m: mat, M: r >= 3 ? mix(shade(mat, 0.5), rc, 0.5) : shade(mat, 0.5), g: rc, G: shade(rc, 0.6) };
}

function gearSprite(slot, tier, rarity, style = null) {
  const st = style || GEAR_STYLES[slot][0].id;
  const key = `gearfx|${slot}|${st}|${tier}|${rarity}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const base = buildSprite(GEAR_ICON[slot][st], gearPalette(slot, tier, rarity, st));
  c = rarity >= 4 ? decorateSprite(base, rarity, hashStr(key)) : base;
  spriteCache.set(key, c);
  return c;
}

// Mythic and up: a padded copy with a sheen, a glowing outline and sparkles.
const FX_PAD = 2;
function decorateSprite(src, r, seed) {
  const w = src.width;
  const h = src.height;
  const W = w + FX_PAD * 2;
  const H = h + FX_PAD * 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.drawImage(src, FX_PAD, FX_PAD);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  const [or, og, ob] = hexToRgb(OUTLINE);
  const colors = RARITY_FX[r];
  const glowAt = (x, y) => (colors ? gradientAt(colors, (x + y) / (W + H)) : RARITY[r].color);
  // Multi-color sheen over the item's own colors (outline pixels stay dark).
  if (colors) {
    const amt = r === 9 ? 0.35 : r >= 10 ? 0.6 : 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!d[i + 3] || (d[i] === or && d[i + 1] === og && d[i + 2] === ob)) continue;
      const [tr, tg, tb] = hexToRgb(glowAt(x, y));
      d[i] = lerp(d[i], tr, amt); d[i + 1] = lerp(d[i + 1], tg, amt); d[i + 2] = lerp(d[i + 2], tb, amt);
    }
  }
  // Glow rings around the silhouette: one ring for Mythic, two from Divine up.
  const rings = r >= 6 ? 2 : 1;
  let edge = solid;
  for (let ring = 0; ring < rings; ring++) {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (edge[y * W + x] || at(x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && edge[ny * W + nx] && (ring > 0 || dx === 0 || dy === 0)) { near = true; break; }
      }
      if (!near) continue;
      next[y * W + x] = 1;
      const [tr, tg, tb] = hexToRgb(glowAt(x, y));
      const i = (y * W + x) * 4;
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb;
      d[i + 3] = ring === 0 ? (r >= 6 ? 230 : 170) : 90;
    }
    for (let i = 0; i < W * H; i++) if (next[i]) edge[i] = 1;
  }
  // Sparkles: a few bright pixels in the padding, more for rarer tiers.
  if (r >= ULTRA) {
    const rng = mulberry32(seed);
    const n = r - 3;
    for (let k = 0; k < n * 2; k++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * H);
      const i = (y * W + x) * 4;
      if (d[i + 3] > 200) continue;
      const [tr, tg, tb] = hexToRgb(k % 2 ? '#ffffff' : glowAt(x, y));
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  c.fxPad = FX_PAD;
  return c;
}

function chestSprite(tier) {
  const mat = MATERIALS[CASES[tier - 1].chest].color;
  const body = tier === 1 ? '#7a4a2a' : shade(mat, -0.45);
  return sprite('chest', { m: mat, M: shade(mat, 0.5), b: body, d: shade(body, -0.4), y: '#ffcc4d' }, 'chest' + tier);
}

function iconSprite(name) {
  return sprite(name, ICON_PALETTES[name] || {}, 'icon');
}

// ---------- Version 2: drill parts, the Drill Crate and the drill itself ----------
PX.part_bit = ['.....kk.....', '....kaak....', '....kAak....', '....kmmk....', '...kMmmnk...', '...kmMmnk...', '...knmMmk...', '....kmMk....', '....knmk....', '.....kk.....', '.....k......', '............'];
PX.part_gear = ['............', '....kkkk....', '.kk.kaak.kk.', '.kakaaaakak.', '..kaaAAaak..', 'kkaaAkkAaakk', 'kaaaAkkAaaak', '.kkaaAAaakk.', '..kaaaaaak..', '.kakkaakkak.', '.kk.kaak.kk.', '....kkkk....'];
PX.part_motor = ['............', '..kkkkkkk...', '.kmMMMMMmk..', '.kmaaaaamkkk', '.kmAaAaAmkMk', '.kmaaaaamkkk', '.kmAaAaAmk..', '.kmaaaaamk..', '.knnnnnnnk..', '..kk...kk...', '............', '............'];
PX.part_cell = ['....kkkk....', '....kMMk....', '..kkkkkkkk..', '..kMmmmmnk..', '..kaaaaaak..', '..kAaaaaak..', '..kaaAAaak..', '..kaAAaaak..', '..kaaaaaak..', '..kmmmmmnk..', '..kkkkkkkk..', '............'];
function partSprite(part, r = 0) {
  const acc = r <= 0 ? '#8fa6bf' : RARITY[r].color;
  const base = sprite('part_' + part, { m: '#b9c2c9', M: '#eef2f6', n: '#6e7682', a: acc, A: shade(acc, 0.45) }, 'r' + r);
  if (r < 4) return base;
  const key = `partfx|${part}|${r}`;
  let c = spriteCache.get(key);
  if (!c) { c = decorateSprite(base, r, hashStr(key)); spriteCache.set(key, c); }
  return c;
}
function partUrl(part, r = 0) { return spriteUrl(partSprite(part, r), 4, 'part:' + part + ':' + r); }
// A yellow and black hazard crate.
function drillCrateSprite() { return sprite('chest', { m: '#f2c14e', M: '#fff3b0', b: '#2a2a34', d: '#16161c', y: '#f2c14e' }, 'drillcrate'); }
function drillCrateUrl() { return spriteUrl(drillCrateSprite(), 4, 'drillcrate'); }
// The drill, facing right: a body with a pistol grip, a chuck, and a bit whose spiral turns with frame.
const DRILL_RAINBOW = ['#ff4d4d', '#ffb84d', '#fff34d', '#4dff88', '#4dd2ff', '#a64dff', '#ff4dd2'];
function drillSprite(mi, frame = 0) {
  const key = 'drill|' + mi + '|' + (frame % 3);
  let c = spriteCache.get(key);
  if (c) return c;
  const m = DRILL_MODELS[Math.max(0, mi)];
  c = document.createElement('canvas'); c.width = 23; c.height = 11;
  const g = c.getContext('2d'), P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const hi = shade(m.body, 0.35), dark = shade(m.body, -0.35), bitD = shade(m.bit, -0.4), bitH = shade(m.bit, 0.3);
  // Grip (angled back a little) and trigger.
  P(2, 5, 5, 6, OUTLINE); P(3, 5, 3, 5, m.trim); P(3, 6, 1, 4, shade(m.trim, 0.3)); P(1, 9, 2, 2, OUTLINE); P(7, 6, 1, 2, OUTLINE);
  // Body with a rounded back, a highlight on top and vents (they glow on the later models).
  P(1, 0, 11, 7, OUTLINE); P(0, 1, 1, 5, OUTLINE);
  P(1, 1, 10, 5, m.body); P(2, 1, 9, 1, hi); P(1, 5, 10, 1, dark); P(1, 1, 1, 1, OUTLINE); P(1, 5, 1, 1, OUTLINE);
  for (let i = 0; i < 3; i++) P(4 + i * 2, 2, 1, 3, m.glow ? (m.glow === 'rainbow' ? DRILL_RAINBOW[(i + frame) % DRILL_RAINBOW.length] : m.glow) : dark);
  // Chuck.
  P(11, 1, 3, 5, OUTLINE); P(12, 2, 1, 3, m.trim);
  // Bit: a tapering cone with a diagonal stripe that moves with frame, so it spins.
  const bit = (cy, hs) => {
    hs.forEach((h, i) => {
      const x = 14 + i, top = Math.round(cy - h / 2);
      P(x, top - 1, 1, h + 2, OUTLINE);
      for (let y = 0; y < h; y++) P(x, top + y, 1, 1, (x + (top + y) + frame) % 3 === 0 ? bitD : y === 0 ? bitH : m.bit);
    });
    P(14 + hs.length, Math.round(cy - 0.5), 1, 1, OUTLINE);
  };
  if (m.twin) { bit(2, [2, 2, 2, 1, 1, 1]); bit(5, [2, 2, 2, 1, 1, 1]); } else bit(3.5, [5, 4, 4, 3, 3, 2, 2, 1]);
  spriteCache.set(key, c);
  return c;
}
function drillUrl(mi, scale = 4) { return spriteUrl(drillSprite(mi, 0), scale, 'drill:' + mi + ':' + scale); }

// Scaled-up PNG data URLs for <img> tags in the HTML UI, drawn with hard pixel edges.
const iconUrlCache = new Map();
function spriteUrl(canvas, scale = 4, key = null) {
  if (key && iconUrlCache.has(key)) return iconUrlCache.get(key);
  const c = document.createElement('canvas');
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(canvas, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/png');
  if (key) iconUrlCache.set(key, url);
  return url;
}

function iconUrl(name) {
  return spriteUrl(iconSprite(name), 4, 'icon:' + name);
}
function petUrl(sp, locked = false, r = 0) {
  const s = petSprite(sp, r);
  return spriteUrl(locked ? silhouette(s, '#2e2440') : s, 4, 'pet:' + sp + ':' + r + (locked ? ':l' : ''));
}
function gearUrl(slot, tier, rarity, locked = false, style = null) {
  const s = gearSprite(slot, tier, rarity, style);
  return spriteUrl(locked ? silhouette(s, '#2e2440') : s, 4, `gear:${slot}:${style || '-'}:${tier}:${rarity}${locked ? ':l' : ''}`);
}
function chestUrl(tier) {
  return spriteUrl(chestSprite(tier), 4, 'chest:' + tier);
}
