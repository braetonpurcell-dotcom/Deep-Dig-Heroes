// Test copies of the game, each in its own folder with its own save, offline copy and home-screen
// icon. None of them post to the leaderboard, so trying things there can't touch the real game.
//   beta/  .../Deep-Dig-Heroes/beta/  short-term: the next v1 update, promoted to live when ready
//   v2/    .../Deep-Dig-Heroes/v2/    long-term: the version 2 overhaul, built in the background
//
//   node tools/beta.js reset [beta|v2]            replace the folder with a fresh copy of the live game
//   node tools/beta.js promote [beta|v2]          copy that folder's game files over the live game (then release as usual)
//   node tools/beta.js pull [beta|v2] <file>...   copy live files (e.g. js/engine.js) into the folder, to carry v1 fixes over
// The channel defaults to beta.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const FILES = ['index.html', 'style.css', 'manifest.json', 'sw.js'];
const DIRS = ['js', 'fonts', 'icons'];

const CHANNELS = {
  beta: { tag: 'BETA', name: 'Deep Dig Heroes BETA', short: 'Dig BETA', color: '#ff6b9d', version: v => v + '-beta' },
  v2: { tag: 'V2', name: 'Deep Dig Heroes V2', short: 'Dig V2', color: '#62c9ff', version: () => '2.0.0-dev.1' },
};
const CH = process.argv[3] && CHANNELS[process.argv[3]] ? process.argv[3] : 'beta';
const C = CHANNELS[CH];
const dir = path.join(root, CH);
const SHIM = `js/${CH}.js`;

// Each pair is [live text, test-copy text]. reset swaps left to right, promote swaps back.
const SWAPS = {
  'index.html': [
    ['<meta name="apple-mobile-web-app-title" content="Deep Dig">', `<meta name="apple-mobile-web-app-title" content="${C.short}">`],
    ['<title>Deep Dig Heroes</title>', `<title>${C.name}</title>`],
  ],
  'manifest.json': [
    ['"name": "Deep Dig Heroes"', `"name": "${C.name}"`],
    ['"short_name": "Deep Dig"', `"short_name": "${C.short}"`],
  ],
  'sw.js': [
    ["const CACHE = 'ddh-' + GAME_VERSION;", `const CACHE = 'ddh-${CH}-' + GAME_VERSION;`],
    ["  './js/util.js' + V,", `  './${SHIM}' + V,\n  './js/util.js' + V,`],
    ['keys.filter(k => k !== CACHE)', `keys.filter(k => k.startsWith('ddh-${CH}-') && k !== CACHE)`],
  ],
  'js/feedback.js': [["fetch('feedback/replies.json", "fetch('../feedback/replies.json"]],
};
const SHIM_TAG = `<script src="${SHIM}"></script>\n`;
const SHIM_JS = `'use strict';
// Test copy only (made by tools/beta.js, never promoted to the live game).
// Every save key gets a "ddh-${CH}:" prefix, so this copy can't read or overwrite the real save.
(function () {
  const P = 'ddh-${CH}:';
  const proto = Storage.prototype;
  const get = proto.getItem, set = proto.setItem, del = proto.removeItem;
  const mine = s => { try { return s === window.localStorage; } catch (e) { return false; } };
  // First visit: start from a copy of the real save, so the test copy has your actual progress.
  // The real save is only read, never written.
  try {
    const ls = window.localStorage;
    if (get.call(ls, P + 'ddh-save-v1') == null) {
      const real = get.call(ls, 'ddh-save-v1');
      if (real != null) set.call(ls, P + 'ddh-save-v1', real);
    }
    window.DDH_TEST_RECOPY = () => {
      const real = get.call(ls, 'ddh-save-v1');
      if (real == null) return false;
      set.call(ls, P + 'ddh-save-v1', real);
      return true;
    };
  } catch (e) { /* storage blocked */ }
  proto.getItem = function (k) { return get.call(this, mine(this) ? P + k : k); };
  proto.setItem = function (k, v) { return set.call(this, mine(this) ? P + k : k, v); };
  proto.removeItem = function (k) { return del.call(this, mine(this) ? P + k : k); };
})();
// Test scores stay off the real leaderboard (main.js calls sendScore by its global name).
window.addEventListener('DOMContentLoaded', () => {
  if (typeof sendScore === 'function') sendScore = async () => {};
  const tag = document.createElement('div');
  tag.textContent = '${C.tag}';
  tag.setAttribute('style', 'position:fixed;left:50%;top:0;transform:translateX(-50%);z-index:50;font:11px sans-serif;color:${C.color};opacity:.85;padding:2px 6px');
  tag.title = 'Tap to copy your real save into this test copy again';
  tag.addEventListener('click', () => {
    if (!confirm('Replace your ${C.tag} progress with a fresh copy of your real save? (Your real save is not changed.)')) return;
    window.removeEventListener('pagehide', saveNow);
    document.removeEventListener('visibilitychange', onVisibility);
    if (window.DDH_TEST_RECOPY && window.DDH_TEST_RECOPY()) location.reload();
    else alert('No real save found on this phone.');
  });
  document.body.appendChild(tag);
});
`;

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function swap(dir, file, forward) {
  const p = path.join(dir, file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [live, test] of SWAPS[file]) {
    const [a, b] = forward ? [live, test] : [test, live];
    if (!s.includes(a)) throw new Error(`${file}: expected to find ${a}`);
    s = s.replace(a, b);
  }
  fs.writeFileSync(p, s);
}

function reset() {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of [...FILES, ...DIRS]) copy(path.join(root, f), path.join(dir, f));
  for (const f of Object.keys(SWAPS)) swap(dir, f, true);
  const vp = path.join(dir, 'js/version.js');
  fs.writeFileSync(vp, fs.readFileSync(vp, 'utf8').replace(/GAME_VERSION = '([^']+)'/, (m, v) => `GAME_VERSION = '${C.version(v)}'`));
  fs.writeFileSync(path.join(dir, SHIM), SHIM_JS);
  const ip = path.join(dir, 'index.html');
  const html = fs.readFileSync(ip, 'utf8');
  const at = html.indexOf('<script src="js/util.js');
  if (at < 0) throw new Error('index.html: util.js script tag not found');
  fs.writeFileSync(ip, html.slice(0, at) + SHIM_TAG + html.slice(at));
  execFileSync('node', [path.join(__dirname, 'stamp-version.js'), CH], { stdio: 'inherit' });
  console.log(`${CH}/ is a fresh copy of the live game`);
}

// Carry live files (a v1 bug fix, say) into the test copy, with its swaps applied.
function pull(files) {
  if (!fs.existsSync(dir)) throw new Error(`no ${CH}/ folder`);
  if (!files.length) throw new Error('name the files to copy, e.g. js/engine.js');
  for (const f of files) {
    if (f === 'js/version.js' || f === SHIM) throw new Error(`${f} belongs to ${CH}/, not copied`);
    copy(path.join(root, f), path.join(dir, f));
    if (SWAPS[f]) swap(dir, f, true);
    if (f === 'index.html') {
      const ip = path.join(dir, 'index.html');
      const html = fs.readFileSync(ip, 'utf8');
      const at = html.indexOf('<script src="js/util.js');
      fs.writeFileSync(ip, html.slice(0, at) + SHIM_TAG + html.slice(at));
      execFileSync('node', [path.join(__dirname, 'stamp-version.js'), CH], { stdio: 'inherit' });
    }
    console.log(`copied ${f} into ${CH}/`);
  }
}

function promote() {
  if (!fs.existsSync(dir)) throw new Error(`no ${CH}/ folder`);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ddh-promote-'));
  for (const f of [...FILES, ...DIRS]) copy(path.join(dir, f), path.join(tmp, f));
  for (const f of Object.keys(SWAPS)) swap(tmp, f, false);
  fs.rmSync(path.join(tmp, SHIM));
  fs.copyFileSync(path.join(root, 'js/version.js'), path.join(tmp, 'js/version.js')); // the release step bumps this
  const ip = path.join(tmp, 'index.html');
  const html = fs.readFileSync(ip, 'utf8').replace(new RegExp(`<script src="js/${CH}\\.js[^"]*"></script>\\n`), '');
  fs.writeFileSync(ip, html);
  for (const f of [...FILES, ...DIRS]) {
    fs.rmSync(path.join(root, f), { recursive: true, force: true });
    copy(path.join(tmp, f), path.join(root, f));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  execFileSync('node', [path.join(__dirname, 'stamp-version.js')], { stdio: 'inherit' });
  const left = FILES.concat(['js/feedback.js']).filter(f => new RegExp(`${CH}[/:'-]|${C.tag}\\b`).test(fs.readFileSync(path.join(root, f), 'utf8')));
  if (left.length) throw new Error(`still mentions ${CH}: ` + left.join(', '));
  console.log(`Live game files now match ${CH}/. Next: bump js/version.js, run tools/stamp-version.js, add a CHANGELOG section, test, push.`);
}

const cmd = process.argv[2];
if (cmd === 'reset') reset();
else if (cmd === 'promote') promote();
else if (cmd === 'pull') pull(process.argv.slice(process.argv[3] && CHANNELS[process.argv[3]] ? 4 : 3));
else console.log('usage: node tools/beta.js reset [beta|v2] | promote [beta|v2] | pull [beta|v2] <file>...');
