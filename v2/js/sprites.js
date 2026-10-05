'use strict';
// Pixel art. Each sprite is rows of characters; the palette maps characters to colors.
// '.' is transparent. Sprites are built once into small canvases and cached.

const OUTLINE = '#120c18';

const PX = {
  get doghouse() { return DOGHOUSE_PX; },
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
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........kk...........',
    '..........kLLk..........',
    '..........klmk..........',
    '.........klmmk..........',
    '.......kkklmmmkkk.......',
    '.....kkllmmmmmmmmkk.....',
    '....klLLlmmmmmmmmmmk....',
    '...klLLlmmmmmmmmmmmmk...',
    '...kllmmmmmmmmmmmmmmk...',
    '..klmmmmkkmmmmmmkkmmmk..',
    '..kmmmmmwkmmmmmmwkmmmk..',
    '..kmmmmmkkmmmmmmkkmmmk..',
    '.kmmmmmmmmmkkkkmmmmmmmk.',
    '.kmmmmmmmmmkrrkmmmmmmdk.',
    '.kdmmmmmmmmmkkmmmmmmmdk.',
    '.kddmmmmmmmmmmmmmmmmddk.',
    '..kdDddddddddddddddDDk..',
    '...kkkkkkkkkkkkkkkkkk...',
  ],
  bat: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........k....k.........',
    '........kmk..kmk........',
    '..k.....kmmkkmmk.....k..',
    '.kmk....kmmmmmmk....kmk.',
    'kmmmkk.kmemmmmemk.kkmmmk',
    'kmlmmmkkmmmmmmmmkkmmmlmk',
    'kmmlmmmmkmmllmmkmmmmlmmk',
    'kmmmlmmmkmllllmkmmmlmmmk',
    'kmmmmlmmkmllllmkmmlmmmmk',
    'kdmmmmlmkdmllmdkmlmmmmdk',
    'kddkdmmkkkdmmdkkkmmdkddk',
    'kdk.kdk...kwwk...kdk.kdk',
    '.k...k.....kk.....k...k.',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  rock: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........kkkk..........',
    '.......kkkLLllkk........',
    '......kLLllllmmmk.......',
    '.....kLlllelmmmmdk......',
    '....kLlllooOmmmmddk.....',
    '....klllloOOmmmmddk.....',
    '...kllllllmmmmmmdddk....',
    '...kmmmmmDmmmmmmdedk....',
    '..kmmmmmmDmmmmmmooddk...',
    '..kmmemmmDDmmmmmOOddk...',
    '..kmmoOmmmmDmmmmmmddk...',
    '.kmmmOOmmmmmmmmmmdddDk..',
    '.kmmmmmmmmmmmmmmddddDk..',
    '.kddmmmmmmmmmmmdddddDk..',
    '..kddddddddddddddDDDk...',
    '...kkkkkkkkkkkkkkkkk....',
  ],
  golem: [
    '........................',
    '........................',
    '........................',
    '........kkkkkkkk........',
    '.......kLlllllmmk.......',
    '.......klmmmmmmdk.......',
    '.......kmeekkeedk.......',
    '.......kmmmmmmmdk.......',
    '.......kdmmkkmddk.......',
    '...kkkkkkkkkkkkkkkkk....',
    '..kLllkLlllllllmmkllmk..',
    '.kLlmmkllmmmmmmmdkmmmdk.',
    '.klmmmkmmmmooommdkmmmdk.',
    '.kmmmDkmmmoeeommdkDmmdk.',
    '.kmmmmkmmmmooommdkmmmdk.',
    '.kmmmmkDmmmmmmmDdkmmmdk.',
    '.kdmmdkkmmDmmmmmdkkdmdk.',
    '.kdddk.kkmmmmmmdkk.kddk.',
    '.kkkkk..kdmmkmmdk..kkkk.',
    '.......kmmmdkmmmdk......',
    '.......kmmmdkmmmdk......',
    '......kkmmddkmmmddk.....',
    '......kDDDDkkkDDDDk.....',
    '......kkkkkk.kkkkkk.....',
  ],
  goldie: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........kk..............',
    '.......kyyk.............',
    '......kyywyk............',
    '.....kkyyyykkk..........',
    '....kdkkyykkdk..........',
    '....kddddddddk..........',
    '...kdddlmmmmmmkkk.......',
    '..klllllmmmmmmmmmkk.....',
    '.klllllmmmmmmmmmkmmkk...',
    'klllmmmmmmmmmmmmmmmmpk..',
    'kmmmmmmmmmmmmmmmmmmmppk.',
    'kmmmmmmmmmmmmmmmmmmmpk..',
    '.kmmmmmmmmmmmmmmmmmmk...',
    '..kdmmmmmmmmmmmmmmdk....',
    '...kkwkwkkkkkkwkwkk.....',
  ],
  crown: [
    'k....k...k....k.',
    'kk..kyk.kyk..kk.',
    'kyk.kyk.kyk.kyk.',
    'kyykyyykyyykyyk.',
    'kyyyyyyyyyyyyyyk',
    'kyrryyybbyyyrryk',
    'kyrryyybbyyyrryk',
    'kkkkkkkkkkkkkkkk',
  ],
  mole: [
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkmmmmmmkk...',
    '..kmllmmmmmmmk..',
    '.kmllmmmmmmekmk.',
    '.kmlmmmmmmmmmmpk',
    '.kmmmmmmmmmmmmkk',
    '.kmmmmmmmmmmmdk.',
    '..kdmmmmmmmmdk..',
    '..kwkkdddddkwk..',
    '..kwwk.....kwwk.',
    '...kk.......kk..',
    '................',
  ],
  petbat: [
    '................',
    '................',
    '................',
    '................',
    'k..............k',
    'kk....k..k....kk',
    'kmk..kmkkmk..kmk',
    'kmlkkmmmmmmkklmk',
    'kmllmmrmmrmmllmk',
    'kmmmmmmmmmmmmmmk',
    '.kmkdmmwwmmdkmk.',
    '..k.kdmmmmdk.k..',
    '.....kkmmkk.....',
    '.......kk.......',
    '................',
    '................',
  ],
  petslime: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkllmmkk....',
    '...kllwmmmmmk...',
    '..kllmmmmmmmmk..',
    '..klmmmmmmmmmk..',
    '.kmmmmmmekmekmk.',
    '.kmmmmmmmmmmmmk.',
    '.kdmmmmmmmmmmdk.',
    '..kddddddddddk..',
    '...kkkkkkkkkk...',
    '................',
  ],
  owl: [
    '................',
    '...k........k...',
    '...kmk....kmk...',
    '...kmmkkkkmmk...',
    '..kmmmmmmmmmmk..',
    '..kmwwwmmwwwmk..',
    '..kwwekwwwekwk..',
    '..kmwwwyywwwmk..',
    '.kmmmmmyymmmmmk.',
    '.kdmllllllllmdk.',
    '.kdmlmlmlmlmmdk.',
    '..kdllllllllmk..',
    '..kdmmmmmmmmdk..',
    '...kykk..kkyk...',
    '....k......k....',
    '................',
  ],
  fox: [
    '................',
    '.........k..k...',
    '........kfkkfk..',
    '........kCffCk..',
    '.kk.....kffffk..',
    'kWWk...kFfffefk.',
    'kWuk...kFffffWWk',
    'kFfk...kkFfWWWek',
    'kFffk.kffkkkkkk.',
    '.kFfkkFFFffWWk..',
    '..kffFFFfffWuk..',
    '...kffffffffk...',
    '...kcCkkkkcCk...',
    '...kCk....kCk...',
    '...kk.....kk....',
    '................',
  ],
  drake: [
    '................',
    '....k...........',
    '...klk......kk..',
    '..kllk.....kmmk.',
    '..kllmk...kmmmmk',
    '..kllmmk.kmmewmk',
    '...kmmmmkmmmmmyk',
    '....kmmmmmmmkkk.',
    '.k..kmmlllmmk...',
    'kmkkmmllllmmk...',
    '.kmmmmllllmdk...',
    '..kkdmmmmmdk....',
    '....kmk.kmk.....',
    '....kyk.kyk.....',
    '....kk..kk......',
    '................',
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
  fox: { F: '#ffb46a', f: '#f2852e', c: '#b85a1c', C: '#7d3a10', W: '#fffaf0', u: '#e8d9c2', e: '#14101c' },
  mole: { m: '#8a5a3a', l: '#b07a52', d: '#5e3a22', p: '#ff8fa3', w: '#f2e6d0', e: '#14101c' },
  slime: { m: '#6ad36a', l: '#b8f5b0', d: '#3f8f45', e: '#14101c', w: '#ffffff' },
  bat: { m: '#7a5aa8', l: '#a88ad8', d: '#4e3878', r: '#ff5a6a', w: '#ffffff' },
  owl: { m: '#9a7048', l: '#d9b98a', d: '#6a4a2a', w: '#ffffff', y: '#ffcc4d', e: '#14101c' },
  drake: { m: '#3fbf9a', l: '#9af0d6', d: '#25806a', y: '#ffcc4d', e: '#14101c', w: '#ffffff' },
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

// A PX sprite at twice the detail (see up2x), for menus. Boxy chests keep hard corners.
function hiSprite(name, palette = {}, cacheKey = '') {
  const key = 'hi|' + name + '|' + cacheKey;
  let c = spriteCache.get(key);
  if (!c) { c = buildSprite(hiRows('px.' + name, PX[name], name !== 'chest'), palette); spriteCache.set(key, c); }
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

// Version 2: your miner, 24 pixels tall in the Game Boy Color style. Skin and hair come from your
// look; everything else is the outfit you wear (your helmet and armor), drawn over the base miner.
const HERO24 = {
  base: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.......kkkkkk...........',
    '....kkhhhhhhhHk.........',
    '...khhhhhhhhhHHk........',
    '...khhhhhhhhhhHk........',
    '...khhhhsshhshHk........',
    '...khhssssssshHk........',
    '...khhsewsewshHk........',
    '...khhssssssShHk........',
    '....kkkSSssSkkk.........',
    '..kkbbbkSSSSkbbbkk......',
    '.kbbbbbbbbbbbbbbbbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.ksSkllllylllllksSk.....',
    '..kk.kdddddddddk.kk.....',
    '.....kddDkkddDk.........',
    '.....kddDkkddDk.........',
    '....kooookkooook........',
    '....kkkkkk.kkkkkk.......',
  ],
  step: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.......kkkkkk...........',
    '....kkhhhhhhhHk.........',
    '...khhhhhhhhhHHk........',
    '...khhhhhhhhhhHk........',
    '...khhhhsshhshHk........',
    '...khhssssssshHk........',
    '...khhsewsewshHk........',
    '...khhssssssShHk........',
    '....kkkSSssSkkk.........',
    '..kkbbbkSSSSkbbbkk......',
    '.kbbbbbbbbbbbbbbbbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.kbBkbbbbbbbbbbkBbk.....',
    '.ksSkllllylllllksSk.....',
    '..kk.kdddddddddk.kk.....',
    '....kddDk..kddDk........',
    '...kddDk....kddDk.......',
    '..kooook....kooook......',
    '..kkkkkk....kkkkkk......',
  ],
};
function lookOf(look) { return look || (typeof S !== 'undefined' && S && S.look) || DEFAULT_LOOK; }
function lookKey(L) { return [L.hair, L.skin].join('.'); }
function heroPalette(L) {
  const skin = LOOK_SKIN[L.skin] || LOOK_SKIN[0], hair = LOOK_HAIR[L.hair] || LOOK_HAIR[1];
  return { h: hair, H: shade(hair, -0.3), s: skin[0], S: skin[1], e: OUTLINE, w: '#ffffff', b: '#3e7bd6', B: '#2a569c',
    d: '#4a4170', D: '#332c55', o: '#7a4a26', O: '#4f2e17', l: '#5e3a1e', y: '#f5c242' };
}
function heroBody(step, L) {
  const key = `hero24|${step ? 1 : 0}|${lookKey(L)}`;
  let c = spriteCache.get(key);
  if (!c) { c = buildSprite(step ? HERO24.step : HERO24.base, heroPalette(L)); spriteCache.set(key, c); }
  return c;
}
// Your miner in the helmet and armor you wear. gear defaults to what you have equipped.
function heroSprite(step, look = null, gear = null) {
  const L = lookOf(look);
  const eq = gear || (typeof S !== 'undefined' && S && S.gear ? S.gear.eq : {});
  const helm = eq.helm, armor = eq.charm;
  if (!helm && !armor) return heroBody(step, L);
  const tag = it => (it ? `${it.st || ''}.${it.t}.${it.r}` : '-');
  const key = `hero24C|${step ? 1 : 0}|${lookKey(L)}|${tag(helm)}|${tag(armor)}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 24; c.height = 24;
  const g = c.getContext('2d');
  g.drawImage(heroBody(step, L), 0, 0);
  if (armor) g.drawImage(wornSprite('charm', armor), 0, 0);
  if (helm) g.drawImage(wornSprite('helm', helm), 0, 0);
  spriteCache.set(key, c);
  return c;
}

// Version 2: decorations outside your house. The armor stand uses the miner's 24-pixel frame, so
// the same helmet and armor layers fit it.
const STAND_PX = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.......kkkkk............',
  '......kLwwwwk...........',
  '......kwwwwWk...........',
  '......kwwwwWk...........',
  '.......kwwWk............',
  '........kWk.............',
  '..kkkkkkkWkkkkkkkk......',
  '..kLwwwwwwwwwwwwWk......',
  '..kkkkkwwwwwwkkkkk......',
  '......kwwwwwWk..........',
  '......kwwwwwWk..........',
  '.......kwwwWk...........',
  '........kwWk............',
  '........kwWk............',
  '........kwWk............',
  '........kwWk............',
  '....kkkkkwWkkkkk........',
  '....kWWWWWWWWWWk........',
];
const DOGHOUSE_PX = [
  '.............kk.............',
  '...........kkrrkk...........',
  '.........kkrrrrrrkk.........',
  '.......kkrrrrRrrrrrkk.......',
  '.....kkrrrrrRrrrrrrrrkk.....',
  '...kkrrrrrrRrrrrrrrrrrrkk...',
  '.kkrrrrrrrRrrrrrrrrrrrrrrkk.',
  'kxxxxxxxxxxxxxxxxxxxxxxxxxxk',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkk.',
  '..kwwwwwwwwwwwwwwwwwwwwwwk..',
  '..kwWwwwwwwkkkkkkwwwwwwWwk..',
  '..kwwwwwwkkdddddkkwwwwwwwk..',
  '..kwWwwwkdddddddddkwwwwWwk..',
  '..kwwwwwkdddddddddkwwwwwwk..',
  '..kwWwwkdddddddddddkwwwWwk..',
  '..kwwwwkdddddddddddkwwwwwk..',
  '..kwWwwkdddddddddddkwwwWwk..',
  '..kwwwwkdddddddddddkwwwwwk..',
  '..kWWWWkdddddddddddkWWWWWk..',
  '..kkkkkkkkkkkkkkkkkkkkkkkk..',
];
const DECOR_WOOD = { w: '#a0703c', W: '#6e4520', L: '#c8925a' };
// The armor stand wearing the pieces you picked (helm and armor items, either may be missing).
function standSprite(helm, armor) {
  const tag = it => (it ? `${it.st}.${it.t}.${it.r}` : '-');
  const key = `stand|${tag(helm)}|${tag(armor)}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 24; c.height = 24;
  const g = c.getContext('2d');
  g.drawImage(buildSprite(STAND_PX, DECOR_WOOD), 0, 0);
  if (armor) g.drawImage(wornSprite('charm', armor), 0, 0);
  if (helm) g.drawImage(wornSprite('helm', helm), 0, 0);
  spriteCache.set(key, c);
  return c;
}
function doghouseSprite() { return sprite('doghouse', { r: '#c84a3a', R: '#e8705a', x: '#8a2a22', w: '#c8925a', W: '#9a6a3a', d: '#2a1a14' }, 'doghouse'); }

function pickSprite(tier) {
  return sprite('pick', materialPalette(tier), 'mat' + tier);
}

function enemySprite(type, biome) {
  const [m, d, l] = biome.enemy;
  // The 24-pixel monsters shade with two extra tones: L (highlight) and D (deepest shadow).
  if (type === 'goldie') {
    return sprite('goldie', { m: '#ffcf3f', l: '#ffe680', L: '#fff6c8', d: '#d8961e', D: '#94600e', p: '#ff8fa3', w: '#ffffff', y: '#fff3b0' }, 'goldie');
  }
  const ore = biome.oreColor;
  if (type === 'rock') {
    const [rm, rd, rl] = biome.rock;
    const pal = { m: rl, d: rm, D: shade(rm, -0.3), l: shade(rl, 0.3), L: shade(rl, 0.55), o: ore, O: shade(ore, -0.35), e: shade(ore, 0.7) };
    return sprite('rock', pal, biome.name);
  }
  const pal = { m, d, l, L: shade(l, 0.45), D: shade(d, -0.35), e: shade(ore, 0.5), o: ore, O: shade(ore, -0.35), r: '#ff3b3b', w: '#ffffff' };
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
    war: ['.kk.....kk.', 'kMmk.k.kmnk', 'kMmmkwkmmnk', 'kMmmmwmmmnk', 'kMmmkwkmmnk', 'kmk.kwk.knk', '.k..kak..k.', '....kak....', '....kwk....', '....kWk....', '....kwk....', '....kkk....'],
    gilded: ['..kkkkkkk..', '.kyyyyyyyk.', 'kmmkkkkknmk', 'kmk.kwk.knk', 'kk..kwk..kk', '....kwk....', '...kkwkk...', '...kyYyk...', '...kkwkk...', '....kWk....', '....kwk....', '....kkk....'],
    clover: ['..kkkakkk..', '.kMMaAammk.', 'kmmkkakknmk', 'kmk.kwk.knk', 'kk..kwk..kk', '....kwk....', '....kak....', '....kwk....', '....kak....', '....kWk....', '....kwk....', '....kkk....'],
    rune: ['....kkk....', '...kaAak...', '..kaAAAak..', '..kaAAaak..', '...kaaak...', '..kmkwkmk..', '...kmwmk...', '....kwk....', '....kak....', '....kwk....', '....kWk....', '....kkk....'],
    swift: ['......kk...', '.kkkkkMmk..', 'kmmmmmmmmkk', '.kkkkwkkknk', '....kwk..kk', '....kwk....', '....kak....', '....kwk....', '....kak....', '....kwk....', '....kWk....', '....kkk....'],
    daggers: ['..k.....k..', '.kMk...kMk.', '.kMk...kMk.', '.kmk...kmk.', '.kmk...kmk.', '.knk...knk.', 'kyyyk.kyyyk', '.kak...kak.', '.kak...kak.', '.kyk...kyk.', '..k.....k..', '...........'],
    sword: ['.....k.....', '....kMk....', '....kMk....', '....kmk....', '....kmk....', '....kmk....', '....knk....', '.kyyyyyyyk.', '..kkkakkk..', '....kak....', '....kgk....', '....kkk....'],
  },
  helm: {
    prospector: ['........kk..', '.......kAak.', '...kkkkkaak.', '..kcccccakk.', '..kcCCCCCck.', '..kccccccck.', '..kyyyyyyyk.', 'kkcccccccckk', 'kCCCCCCCCCCk', '.kkkkkkkkkk.'],
    horned: sym(['k.....', 'kok...', 'kok.kk', '.kokMm', '..kmMm', '.kmmmm', 'kmmmmm', 'kddddd', 'kkkkkk', '......']),
    lucky: ['............', '...kkkkkk...', '..kccccccck.', '.kcccaAcccck', '.kccaAacccck', '.kcccaaccCck', '.kkkkkkkkkkk', '......kCCCCk', '.......kkkk.', '............'],
    scholar: ['.....kk.....', '....kcck....', '....kcck....', '...kccyck...', '...kcccck...', '..kccccyck..', '..kccccccck.', 'kkkkkkkkkkkk', 'kCCCCCCCCCCk', 'kkkkkkkkkkkk'],
    aviator: sym(['....kk', '..kkcc', '.kcccc', 'kmmmkc', 'kmaAmk', 'kkmmkc', '.kcccc', '.kckkk', '.kk...', '......']),
    storm: ['...kkkk.....', '..kAAaakk...', '..kaaaaaak..', '...kkkkkkkk.', '..kMMmmmmnk.', '.kMmmmmmmmnk', '.kmmkkkkkmnk', '.kmknnnnnknk', '.kmknnnnnknk', '.kkkkkkkkkkk'],
    hood: ['....kkkk....', '..kkccccck..', '.kccccccCck.', '.kcCcccCCck.', 'kcCkkkkkkCck', 'kcCkkLkLkCck', 'kcCkcccccCck', 'kcCkcCcCcCck', '.kCCkkkkkCk.', '..kkk...kk..'],
  },
  charm: {
    cloak: sym(['...kkk', '..kccc', '.kcCCC', '.kcCkk', 'kcckaA', 'kcccka', 'kccccc', 'kcCccc', 'kccCcc', 'kcccCc', 'kCcccc', '.kkkkk']),
    plate: sym(['......', '.kkk..', 'kMmmkk', 'kmmmMm', '.kkmMm', '..kmmm', '..kmnm', '..kmmm', '..knmm', '..kddd', '...kmm', '....kk']),
    vest: sym(['......', '.kkk..', 'kccckk', 'kccckw', 'kcyckw', '.kcckw', '.kyckw', '.kcckw', '.kdddd', '.kcckk', '..kkk.', '......']),
    robe: sym(['......', '.kkk..', 'kccckk', 'kccckY', 'kcccky', '.kccka', '.kcccy', '.kcccy', '.kcccy', '.kcccy', '.kcccc', '.kkkkk']),
    jerkin: sym(['......', '..kk..', '.kcckk', 'kccccc', 'kcaccc', '.kaccc', '.kcacc', '.kccac', '.kdddy', '.kcccc', '.kcckk', '.kkk..']),
    mail: sym(['......', '.kkk..', 'kmnmkk', 'knmnka', 'kmnmka', '.knmka', '.kmnka', '.knmka', '.kmnka', '.kddka', '..kmka', '...kkk']),
    shadow: ['....kkkk....', '..kkccCCkk..', '.kcccccccCk.', 'kccwccccwcCk', 'kcccwccwccCk', 'kccccwwcccCk', 'kCcccyycccCk', 'kCccccccccCk', 'kCCcccccccCk', 'kCCcccccCCCk', '.kCCCcCCCCk.', '..kkkkkkkk..'],
  },
};
// What your miner wears, as layers over the 24-pixel miner: a helmet over the head and armor over
// the body. '.' keeps the miner underneath. Armor stops above the legs so both walk frames fit.
const BLANK24 = '........................';
const worn24 = (top, rows) => { const out = Array(24).fill(BLANK24); rows.forEach((r, i) => { out[top + i] = (r + BLANK24).slice(0, 24); }); return out; };
const GEAR_WORN = {
  helm: {
    storm: worn24(1, [
      '....kkkk',
      '...kAAAakk',
      '...kaaaaaak',
      '....kaakkkkkk',
      '....kkMMMmmmmnk',
      '...kMMMmmmmmmnnk',
      '...kMmmmmmmmmmnk',
      '...kmmkkkkkkkmnk',
      '...kmk.......knk',
      '...kmk.......knk',
      '...knk.......kdk',
    ]),
    horned: worn24(1, [
      'kk...............kk',
      'kok.............kok',
      'kook...........kook',
      '.koook.kkkkkk.koook',
      '..kooMMMMmmmmmmook',
      '...kkMMmmmmmmnkk',
      '...kMMmmmmmmmmnk',
      '...kddddddddddnk',
      '...knk...mk...kdk',
      '...kdk...nk...kdk',
    ]),
    hood: worn24(3, [
      '......kkkkkk',
      '....kkcccccckk',
      '...kcccccccccCk',
      '..kccccccccccCk',
      '..kcCcCcccccCCk',
      '..kcCk.......kCk',
      '..kcCk.......kCk',
      '..kcCk.......kCk',
      '..kcCkcccccccCCk',
      '...kCkCcCcCcCkk',
      '....kkkkkkkkk',
    ]),
    aviator: worn24(3, [
      '.......kkkkk',
      '.....kkcccccck',
      '....kcccccccccCk',
      '...kcccccccccccCk',
      '...kkkkkkkkkkkkkk',
      '...kmkAakmkAakmk',
      '...kkkaakkkaakkk',
      '...kCk.......kCk',
    ]),
    prospector: worn24(1, [
      '..........kk',
      '.........kAak',
      '....kkkkkkaak',
      '...kcccccckak',
      '...kcCCCCCcakk',
      '...kcccccccccck',
      '...kyyyyyyyyyyk',
      '.kkcccccccccccckk',
      'kCCCCCCCCCCCCCCCCk',
      '.kkkkkkkkkkkkkkkk',
    ]),
    lucky: worn24(3, [
      '.....kkkkkkk',
      '....kcccccccck',
      '...kcccccaAccCk',
      '...kccccaAacccCk',
      '...kcccccaacccCk',
      '...kkkkkkkkkkkkkkk',
      '..........kCCCCCCk',
      '...........kkkkkk',
    ]),
    scholar: worn24(0, [
      '............kk',
      '...........kcCk',
      '..........kccCk',
      '.........kcAcCk',
      '........kccccCk',
      '.......kcccccCk',
      '......kccAcccCCk',
      '.....kcccccccCCk',
      '..kkkyyyyyyyyyyykk',
      '.kcccccccccccccccck',
      '..kkkkkkkkkkkkkkkk',
    ]),
  },
  charm: {
    plate: worn24(13, [
      '.kkkMMMkkkkkkkMMkk',
      'kMMMmmmMmmmmmMmmmnk',
      'kmmnkmMmmmmmmmknnmk',
      'kmnnkmmmMmmmmmknnmk',
      '.kkkkmmmmmmmmnk.kk',
      '.....kdddyddddk',
    ]),
    mail: worn24(13, [
      '.kkkMMmkkkkkkMMmkk',
      'kMMMmmnkaaAaakmmmnk',
      'kmmnkmmkaayaakknnmk',
      'kmnnkmmkayyyakknnmk',
      '.kkkkmmkaayaakk.kk',
      '.....kdkaaaaakk',
      '.......kaaaaak',
      '.......kkkkkkk',
    ]),
    shadow: worn24(13, [
      '..kkCccCkkkkCccCkk',
      '.kCccccCcccccCcccCk',
      '.kCCkcwccccccwckCCk',
      '.kCCkccwccccwcckCCk',
      '.kCCkcccwccwccckCCk',
      '..kCkdddddyddddkCk',
      '..kCCk.........kCCk',
      '...kk...........kk',
    ]),
    jerkin: worn24(13, [
      '..kkaAAakkkkkkcckk',
      '.kaaaAaacccccccccck',
      '.kcCkaacwccccccCkcCk',
      '.kcCkcccwcccccckcCk',
      '.kcCkccccwccccckcCk',
      '.....kddddyddddk',
    ]),
    vest: worn24(13, [
      '..kkbbbkoooookbbkk',
      '.kcccccoooooocccccck',
      '.kcCkcckoyookcckCck',
      '.kcCkcckooyokcckCck',
      '.kcCkcckoyookcckCck',
      '.....kdddyddddkyk',
      '..............kYk',
    ]),
    cloak: worn24(12, [
      '..kkk.........kkk',
      '.kccckkkAkkkkccck',
      'kCcccccaAacccccCCk',
      'kCcckbbbabbbbkccCk',
      'kCcckbbbbbbbbkccCk',
      'kCcckbbbbbbbbkccCk',
      'kCCckddddyddddkcCk',
      'kCCCk.........kCCk',
      '.kkk...........kkk',
    ]),
    robe: worn24(13, [
      '..kkcccykkkkycckk',
      '.kcccccyccccyccccck',
      '.kcCkccyccccycckCck',
      '.kcCkccyyyyyycckCck',
      '.kcCkccccaccccckCck',
      '..kkkccccccccccckk',
      '....kcccccccccccck',
      '....kyyyyyyyyyyyyk',
    ]),
  },
};

// Each style's own colours: accent (a), cloth (c). Metal comes from the material, gems from rarity.
const STYLE_ART = {
  war: { a: '#a83a3a' }, gilded: {}, clover: { a: '#3eaa4a', A: '#8ae070' }, rune: { a: '#3ac8ff', A: '#c8f6ff' }, swift: { a: '#7ad0ff', A: '#e8f8ff' }, sword: { a: '#6e4428', A: '#9a6a3a' },
  daggers: { a: '#3a3550' },
  prospector: { c: '#6a3a8a', C: '#4a2462', a: '#ff5a6a', A: '#ffc0c8' }, horned: {}, lucky: { c: '#2e7a46', C: '#1e5230', a: '#7ae070', A: '#c8ffb0' },
  scholar: { c: '#3a4ab8', C: '#26307e', A: '#ffe066' }, aviator: { c: '#8a5a32', C: '#5e3a1e', a: '#7ad0ff', A: '#e8f8ff' },
  storm: { a: '#d63447', A: '#ff6a78' }, hood: { c: '#3a3550', C: '#24203a' },
  cloak: { c: '#2e7a46', C: '#1e5230', a: '#7ae070', A: '#c8ffb0' }, plate: {}, vest: { c: '#6a3a8a', C: '#4a2462' },
  robe: { c: '#3a4ab8', C: '#26307e', a: '#ffe066' }, jerkin: { c: '#9a6a3a', C: '#6e4520', a: '#3e8ad6', A: '#8ac8ff', w: '#5e3a1e' },
  mail: { a: '#d63447', A: '#ff6a78' }, shadow: { c: '#3a3550', C: '#24203a', w: '#7a5a3a' },
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
    b: '#3e7bd6', ...(art.w ? { w: art.w } : {}),
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

// Version 2: menus show gear, chests and drill parts at twice the detail, made from the same art by
// up2x below; the world (the miner's tool, the armor stand) keeps the small originals.
// Scale2x (EPX) doubles a sprite and rounds off its stair-step diagonals (smooth = false keeps hard
// corners, for boxy shapes); the doubled 2-pixel outlines are then thinned back to 1 pixel.
function up2x(rows, smooth = true) {
  const h = rows.length, w = rows[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  const g = [];
  for (let y = 0; y < h * 2; y++) g.push(new Array(w * 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    g[2 * y][2 * x] = smooth && C === A && C !== D && A !== B ? A : P;
    g[2 * y][2 * x + 1] = smooth && A === B && A !== C && B !== D ? B : P;
    g[2 * y + 1][2 * x] = smooth && D === C && D !== B && C !== A ? C : P;
    g[2 * y + 1][2 * x + 1] = smooth && B === D && B !== A && D !== C ? D : P;
  }
  const H = h * 2, W = w * 2, G = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '.' : g[y][x]);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const edge = g.map((row, y) => row.map((c, x) => c === 'k' && N4.some(([a, b]) => G(x + a, y + b) === '.')));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'k' || edge[y][x]) continue;
    const nearEdge = N4.some(([a, b]) => edge[y + b] && edge[y + b][x + a]);
    if (!nearEdge && G(x - 1, y) !== 'k' && G(x, y - 1) !== 'k') continue;
    const count = {};
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const c = G(x + a, y + b); if ((a || b) && c !== '.' && c !== 'k') count[c] = (count[c] || 0) + 1; }
    const best = Object.keys(count).sort((p, q) => count[q] - count[p])[0];
    if (best) g[y][x] = best;
  }
  return g.map(r => r.join(''));
}
const HI_ROWS = new Map();
function hiRows(key, rows, smooth) { let r = HI_ROWS.get(key); if (!r) { r = up2x(rows, smooth); HI_ROWS.set(key, r); } return r; }

function gearSprite(slot, tier, rarity, style = null, hi = false) {
  const st = style || GEAR_STYLES[slot][0].id;
  const key = `gearfx|${slot}|${st}|${tier}|${rarity}${hi ? '|hi' : ''}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const rows = hi ? hiRows(slot + '.' + st, GEAR_ICON[slot][st], slot !== 'charm') : GEAR_ICON[slot][st];
  const base = buildSprite(rows, gearPalette(slot, tier, rarity, st));
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
  return hiSprite('chest', { m: mat, M: shade(mat, 0.5), b: body, d: shade(body, -0.4), y: '#ffcc4d' }, 'chest' + tier);
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
  const base = hiSprite('part_' + part, { m: '#b9c2c9', M: '#eef2f6', n: '#6e7682', a: acc, A: shade(acc, 0.45) }, 'r' + r);
  if (r < 4) return base;
  const key = `partfx|${part}|${r}`;
  let c = spriteCache.get(key);
  if (!c) { c = decorateSprite(base, r, hashStr(key)); spriteCache.set(key, c); }
  return c;
}
function partUrl(part, r = 0) { return spriteUrl(partSprite(part, r), 2, 'part:' + part + ':' + r); }
// A yellow and black hazard crate.
function drillCrateSprite() { return hiSprite('chest', { m: '#f2c14e', M: '#fff3b0', b: '#2a2a34', d: '#16161c', y: '#f2c14e' }, 'drillcrate'); }
function drillCrateUrl() { return spriteUrl(drillCrateSprite(), 2, 'drillcrate'); }
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

PX.boat = ['.......k........', '.......kk.......', '......kwrk......', '.....kwwwwk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '..kWWWWWWWWWWk..', '.......kmk......', 'kkkkkkkkkkkkkkkk', '.khhhhhhhhhhhhk.', '..kHHHHHHHHHHk..', '...kkkkkkkkkk...'];
function boatSprite() { return sprite('boat', { w: '#f6efe0', W: '#d6ccb4', r: '#d84848', m: '#6e4428', h: '#a8743e', H: '#7a4c2a' }, 'boat'); }

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
  return spriteUrl(hiSprite(name, ICON_PALETTES[name] || {}, 'icon'), 2, 'icon:' + name); // menus: twice the detail
}
function petUrl(sp, locked = false, r = 0) {
  const s = petSprite(sp, r);
  return spriteUrl(locked ? silhouette(s, '#2e2440') : s, 4, 'pet:' + sp + ':' + r + (locked ? ':l' : ''));
}
function gearUrl(slot, tier, rarity, locked = false, style = null) {
  const s = gearSprite(slot, tier, rarity, style, true);
  return spriteUrl(locked ? silhouette(s, '#2e2440') : s, 2, `gear:${slot}:${style || '-'}:${tier}:${rarity}${locked ? ':l' : ''}`);
}
function chestUrl(tier) {
  return spriteUrl(chestSprite(tier), 2, 'chest:' + tier);
}
