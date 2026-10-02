// The test copy of the game lives in beta/ and plays at .../Deep-Dig-Heroes/beta/.
// It has its own save, its own offline copy and home-screen icon, and never posts to the
// leaderboard, so trying things there can't touch the real game or anyone's progress.
//
//   node tools/beta.js reset     replace beta/ with a fresh copy of the live game
//   node tools/beta.js promote   copy the game files from beta/ over the live game (then do a normal release)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const beta = path.join(root, 'beta');
const FILES = ['index.html', 'style.css', 'manifest.json', 'sw.js'];
const DIRS = ['js', 'fonts', 'icons'];

// Each pair is [live text, beta text]. reset swaps left to right, promote swaps back.
const SWAPS = {
  'index.html': [
    ['<meta name="apple-mobile-web-app-title" content="Deep Dig">', '<meta name="apple-mobile-web-app-title" content="Dig BETA">'],
    ['<title>Deep Dig Heroes</title>', '<title>Deep Dig Heroes BETA</title>'],
  ],
  'manifest.json': [
    ['"name": "Deep Dig Heroes"', '"name": "Deep Dig Heroes BETA"'],
    ['"short_name": "Deep Dig"', '"short_name": "Dig BETA"'],
  ],
  'sw.js': [
    ["const CACHE = 'ddh-' + GAME_VERSION;", "const CACHE = 'ddh-beta-' + GAME_VERSION;"],
    ["  './js/util.js' + V,", "  './js/beta.js' + V,\n  './js/util.js' + V,"],
    ['keys.filter(k => k !== CACHE)', "keys.filter(k => k.startsWith('ddh-beta-') && k !== CACHE)"],
  ],
  'js/feedback.js': [["fetch('feedback/replies.json", "fetch('../feedback/replies.json"]],
};
const BETA_TAG = '<script src="js/beta.js"></script>\n';
const BETA_JS = `'use strict';
// Test copy only (made by tools/beta.js, never promoted to the live game).
// Every save key gets a "ddh-beta:" prefix, so this copy can't read or overwrite the real save.
(function () {
  const P = 'ddh-beta:';
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
    window.DDH_BETA_RECOPY = () => {
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
  tag.textContent = 'BETA';
  tag.setAttribute('style', 'position:fixed;left:50%;top:0;transform:translateX(-50%);z-index:50;font:11px sans-serif;color:#ff6b9d;opacity:.85;padding:2px 6px');
  tag.title = 'Tap to copy your real save into the beta again';
  tag.addEventListener('click', () => {
    if (!confirm('Replace your BETA progress with a fresh copy of your real save? (Your real save is not changed.)')) return;
    window.removeEventListener('pagehide', saveNow);
    document.removeEventListener('visibilitychange', onVisibility);
    if (window.DDH_BETA_RECOPY && window.DDH_BETA_RECOPY()) location.reload();
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
  fs.rmSync(beta, { recursive: true, force: true });
  for (const f of [...FILES, ...DIRS]) copy(path.join(root, f), path.join(beta, f));
  for (const f of Object.keys(SWAPS)) swap(beta, f, true);
  const vp = path.join(beta, 'js/version.js');
  fs.writeFileSync(vp, fs.readFileSync(vp, 'utf8').replace(/GAME_VERSION = '([^']+)'/, "GAME_VERSION = '$1-beta'"));
  fs.writeFileSync(path.join(beta, 'js/beta.js'), BETA_JS);
  const ip = path.join(beta, 'index.html');
  const html = fs.readFileSync(ip, 'utf8');
  const at = html.indexOf('<script src="js/util.js');
  if (at < 0) throw new Error('index.html: util.js script tag not found');
  fs.writeFileSync(ip, html.slice(0, at) + BETA_TAG + html.slice(at));
  execFileSync('node', [path.join(__dirname, 'stamp-version.js'), 'beta'], { stdio: 'inherit' });
  console.log('beta/ is a fresh copy of the live game');
}

function promote() {
  if (!fs.existsSync(beta)) throw new Error('no beta/ folder');
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ddh-promote-'));
  for (const f of [...FILES, ...DIRS]) copy(path.join(beta, f), path.join(tmp, f));
  for (const f of Object.keys(SWAPS)) swap(tmp, f, false);
  fs.rmSync(path.join(tmp, 'js/beta.js'));
  fs.copyFileSync(path.join(root, 'js/version.js'), path.join(tmp, 'js/version.js')); // the release step bumps this
  const ip = path.join(tmp, 'index.html');
  const html = fs.readFileSync(ip, 'utf8').replace(/<script src="js\/beta\.js[^"]*"><\/script>\n/, '');
  fs.writeFileSync(ip, html);
  for (const f of [...FILES, ...DIRS]) {
    fs.rmSync(path.join(root, f), { recursive: true, force: true });
    copy(path.join(tmp, f), path.join(root, f));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  execFileSync('node', [path.join(__dirname, 'stamp-version.js')], { stdio: 'inherit' });
  const left = FILES.concat(['js/feedback.js']).filter(f => /beta/i.test(fs.readFileSync(path.join(root, f), 'utf8')));
  if (left.length) throw new Error('still mentions beta: ' + left.join(', '));
  console.log('Live game files now match beta/. Next: bump js/version.js, run tools/stamp-version.js, add a CHANGELOG section, test, push.');
}

const cmd = process.argv[2];
if (cmd === 'reset') reset();
else if (cmd === 'promote') promote();
else console.log('usage: node tools/beta.js reset | promote');
