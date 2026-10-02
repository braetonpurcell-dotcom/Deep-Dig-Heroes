'use strict';
// Leaderboard. Scores are never typed in: the game reads them from the player's own save and sends
// them through the feedback Google Form as type "score" (on start-up with signal, when a best
// improves, and on Refresh). A "Leaderboard" tab in the response sheet lists only score rows and is
// published as CSV, which the game reads back. Every entry carries proof from the save (play time,
// taps, kills...) and entries that don't add up are left off the board.

// Published CSV of the sheet's Leaderboard tab (File > Share > Publish to web).
let LEADERBOARD_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFMaBOgBS2H0XiefnEl6_wuGXrFBhBENY2QiadA3s2FS97xerx2l3wWABRLNM_iYi_onuPQ5Hmtwar/pub?gid=573941909&single=true&output=csv';

const LB_CATS = [
  { k: 'floor', name: 'Floor', fmt: v => 'B' + v },
  { k: 'mult', name: 'Mult', fmt: (v, e) => '×' + v.toFixed(2) + ` · ${fmt(e.combo)} combo`, tie: 'combo' },
  { k: 'combo', name: 'Combo', fmt: v => fmt(v) },
  { k: 'rare', name: 'Rarest', fmt: (v, e) => e.rareLabel || oddsLong(v) },
  { k: 'pet', name: 'Top pet', fmt: (v, e) => e.petLabel || oddsLong(v) },
  { k: 'pick', name: 'Top pickaxe', fmt: (v, e) => e.pickLabel || oddsLong(v) },
  { k: 'helm', name: 'Top helmet', fmt: (v, e) => e.helmLabel || oddsLong(v) },
  { k: 'charm', name: 'Top charm', fmt: (v, e) => e.charmLabel || oddsLong(v) },
  { k: 'power', name: 'Power', fmt: v => fmt(v) + ` (+${fmt(v * 10)}% dmg)` },
  { k: 'prestiges', name: 'Prestiges', fmt: v => fmt(v) },
  { k: 'play', name: 'Time played', fmt: v => fmtTime(v) },
  { k: 'cases', name: 'Cases opened', fmt: v => fmt(v) },
  { k: 'bosses', name: 'Bosses', fmt: v => fmt(v) },
  { k: 'kills', name: 'Monsters', fmt: v => fmt(v) },
];
const LB_SLOTS = ['pet', 'pick', 'helm', 'charm'];
const LB = { rows: null, loadedAt: 0, cat: 'floor', loading: false };
const LB_AUTO_GAP = 120; // seconds between automatic sends

function playerId() {
  if (!S.profile.pid) S.profile.pid = 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return S.profile.pid;
}

// The player's scores, straight from the save, plus the proof they're checked against.
function scorePayload() {
  const st = S.stats;
  const best = S.best.all;
  let rareLabel = '';
  if (best) {
    const what = best.sp ? (PETS[best.sp] ? PETS[best.sp].name : 'Pet') : (SLOTS[best.slot] ? SLOTS[best.slot].name : '');
    const wear = best.fl != null ? ' ' + WEAR[wearIndex(best.fl)].short : '';
    rareLabel = `${RARITY[best.r].name}${wear} ${what} · 1 in ${fmt(best.odds)}`;
  }
  const out = {
    v: 2, pid: playerId(), name: playerName(),
    floor: st.bestFloor, mult: Math.round(st.bestMult * 100) / 100, combo: st.bestStreak, prestiges: S.prestiges,
    power: Math.round(S.power),
    rare: best ? best.odds : 0, rareR: best ? best.r : -1, rareFl: best && best.fl != null ? best.fl : null, rareLabel,
    play: Math.round(st.playTime), taps: st.taps, kills: st.kills, bosses: st.bosses, cases: st.cases,
  };
  // Best pull per slot: rarity and wear, so the board works out the raw odds itself.
  for (const k of LB_SLOTS) {
    const b = S.best[k];
    if (!b) continue;
    out[k + 'R'] = b.r;
    if (b.fl != null) out[k + 'Fl'] = b.fl;
    if (b.sp) out.petSp = b.sp;
  }
  return out;
}
function scoreKey(p) { return [p.name, p.floor, p.mult.toFixed(1), p.combo, p.prestiges, p.power, p.rare, ...LB_SLOTS.map(k => p[k + 'R'] + ':' + p[k + 'Fl'])].join('|'); }

// Raw odds and a label for a slot's best pull, from its rarity and wear.
function slotBest(e, k) {
  const r = e[k + 'R'];
  if (!Number.isInteger(r) || r < 0 || r > TOP_RARITY) return null;
  const fl = typeof e[k + 'Fl'] === 'number' ? e[k + 'Fl'] : null;
  const odds = Math.round(dropOdds(r, k === 'pet' ? null : fl));
  const what = k === 'pet' ? (PETS[e.petSp] ? PETS[e.petSp].name : 'Pet') : SLOTS[k].name;
  const wear = k !== 'pet' && fl != null ? ' ' + WEAR[wearIndex(fl)].short : '';
  return { odds, label: `${RARITY[r].name}${wear} ${what} · 1 in ${fmt(odds)}` };
}

async function sendScore(force = false) {
  if (!FEEDBACK_FORM || !playerName() || !navigator.onLine) return false;
  const p = scorePayload();
  const key = scoreKey(p);
  const now = Date.now();
  if (!force && (key === S.lb.sentKey || now - S.lb.sentAt < LB_AUTO_GAP * 1000)) return false;
  const ok = await postEntry({ id: p.pid, type: 'score', text: JSON.stringify(p) });
  if (ok) { S.lb.sentKey = key; S.lb.sentAt = now; saveLocal(); }
  return ok;
}

// Does an entry add up? Checked against its own proof, so typed-in or edited numbers fall out.
function lbValid(e) {
  const num = x => typeof x === 'number' && isFinite(x) && x >= 0;
  if (!e || typeof e.pid !== 'string' || typeof e.name !== 'string' || !e.name.trim()) return false;
  if (/delete me/i.test(e.name)) return false; // setup test entries
  if (![e.floor, e.mult, e.combo, e.prestiges, e.rare, e.play, e.taps, e.kills, e.cases].every(num)) return false;
  if (e.floor < 1 || e.floor > 5000 || e.mult < 1) return false;
  if (e.combo > 2 * e.taps + 1) return false; // a combo is built from taps (Fresh Hands counts 2 per tap)
  if (e.mult > 1 + 0.09 * Math.min(e.combo, 200) + 0.01) return false; // best skills, Combo Mastery and Limit Break
  if (e.power != null && !num(e.power)) return false;
  if (e.kills < 2.5 * (e.floor - 1)) return false; // floors take 6 kills, minus Tunneler skips and 1-kill boss floors
  if (e.taps > e.play * 8 + 50) return false; // nobody taps 8 times a second for a whole session
  if (e.rare > 0 && (e.cases < 1 || e.rare > 1e9)) return false;
  return true;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Older entries carry odds boosted by the sender's luck at the time; rebuild the raw odds from the
// rarity and wear so every row compares fairly.
function rawRare(e) {
  if (!Number.isInteger(e.rareR) || e.rareR < 0 || e.rareR > TOP_RARITY) return;
  const label = String(e.rareLabel || '');
  let fl = typeof e.rareFl === 'number' ? e.rareFl : null;
  if (fl == null) {
    const w = WEAR.find(x => new RegExp('^' + RARITY[e.rareR].name + ' ' + x.short + ' ').test(label));
    if (w) fl = w.min;
  }
  e.rare = Math.round(dropOdds(e.rareR, fl));
  e.rareLabel = label.replace(/· 1 in .*$/, '· 1 in ' + fmt(e.rare));
}

// One row per player: the best of everything they've sent, from entries that pass the checks.
const lbNum = x => typeof x === 'number' && isFinite(x) && x >= 0;
function buildBoard(csv) {
  const rows = parseCsv(csv);
  const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
  const col = head.indexOf('message');
  const byPid = {};
  for (const r of rows) {
    let e;
    try { e = JSON.parse(r[col]); } catch (err) { continue; }
    if (!lbValid(e)) continue;
    const cur = byPid[e.pid] || (byPid[e.pid] = { pid: e.pid, name: e.name, floor: 0, mult: 1, combo: 0, prestiges: 0, rare: 0, rareLabel: '',
      power: 0, play: 0, cases: 0, bosses: 0, kills: 0, pet: 0, pick: 0, helm: 0, charm: 0 });
    cur.name = e.name.slice(0, 20);
    for (const k of ['floor', 'combo', 'prestiges', 'play', 'cases', 'bosses', 'kills']) cur[k] = Math.max(cur[k], e[k] || 0);
    if (e.mult > cur.mult) { cur.mult = e.mult; cur.multCombo = e.combo; }
    if (lbNum(e.power)) cur.power = Math.max(cur.power, e.power);
    rawRare(e);
    if (e.rare > cur.rare) { cur.rare = e.rare; cur.rareLabel = String(e.rareLabel || '').slice(0, 60); }
    for (const k of LB_SLOTS) {
      const b = slotBest(e, k);
      if (b && b.odds > cur[k]) { cur[k] = b.odds; cur[k + 'Label'] = b.label; }
    }
  }
  return Object.values(byPid);
}

async function loadBoard() {
  if (!LEADERBOARD_CSV || LB.loading) return;
  LB.loading = true;
  try {
    const res = await fetch(LEADERBOARD_CSV + (LEADERBOARD_CSV.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      LB.rows = buildBoard(await res.text());
      LB.loadedAt = Date.now();
      try { localStorage.setItem('ddh-board', JSON.stringify({ rows: LB.rows, at: LB.loadedAt })); } catch (e) { /* storage full */ }
    }
  } catch (e) {
    /* offline: keep the last board */
  }
  LB.loading = false;
}

function boardHtml() {
  const cat = LB_CATS.find(c => c.k === LB.cat) || LB_CATS[0];
  const me = playerId();
  // Your own row always reflects your save, even before the sheet catches up.
  const mine = { ...scorePayload(), pid: me };
  for (const k of LB_SLOTS) { const b = slotBest(mine, k); mine[k] = b ? b.odds : 0; if (b) mine[k + 'Label'] = b.label; }
  const rows = (LB.rows || []).filter(r => r.pid !== me);
  if (playerName()) rows.push(mine);
  const tie = r => (cat.tie ? (r.multCombo != null ? r.multCombo : r[cat.tie]) || 0 : 0);
  rows.sort((a, b) => (b[cat.k] || 0) - (a[cat.k] || 0) || tie(b) - tie(a));
  const list = rows.filter(r => (r[cat.k] || 0) > (cat.k === 'mult' ? 1 : 0));
  const myRank = list.findIndex(r => r.pid === me);
  const ago = LB.loadedAt ? Math.max(0, Math.round((Date.now() - LB.loadedAt) / 60000)) : null;
  const row = (r, i) => `<div class="lbrow ${r.pid === me ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}">
    <span class="lbrank">${i + 1}</span><span class="lbname">${escapeHtml(r.name)}</span>
    <span class="lbval">${escapeHtml(String(cat.fmt(r[cat.k] || 0, cat.k === 'mult' && r.multCombo != null ? { ...r, combo: r.multCombo } : r)))}</span></div>`;
  return `<div class="lbcats">${LB_CATS.map(c => `<button data-lb="cat" data-v="${c.k}" class="${c.k === cat.k ? 'on' : ''}">${c.name}</button>`).join('')}</div>
    <div class="small muted">${cat.name}${myRank >= 0 ? ` · you are #${myRank + 1} of ${list.length}` : ''}</div>
    <div class="lblist">${list.length ? list.map(row).join('') : '<p class="small muted">No scores yet.</p>'}</div>
    <p class="small muted">${!LEADERBOARD_CSV ? 'The leaderboard is being set up. Your scores are already being sent.'
      : !playerName() ? 'Set your player name to join the board.'
        : `Scores come straight from each player's save and update within about 5 minutes. Odds are raw (no luck).${ago != null ? ` Board loaded ${ago ? ago + ' min ago' : 'just now'}.` : ''}`}</p>`;
}

function openBoard() {
  if (!playerName()) { askName('board'); return; }
  try {
    const c = JSON.parse(localStorage.getItem('ddh-board') || 'null');
    if (c && !LB.rows) { LB.rows = c.rows; LB.loadedAt = c.at; }
  } catch (e) { /* no cached board */ }
  openModal(`<div class="lbscreen"><h2>Leaderboard</h2><div id="lbBox" class="lbbox">${boardHtml()}</div>
    <div class="mbtns"><button class="btn gold" data-lb="refresh">Refresh</button><button class="btn" data-act="close">Close</button></div></div>`, { dismissable: true });
  const on = $('.lbcats .on');
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  refreshBoard(false);
}

async function refreshBoard(force) {
  const btn = $('[data-lb="refresh"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  await sendScore(force);
  await loadBoard();
  const box = $('#lbBox');
  if (box) box.innerHTML = boardHtml();
  if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-lb]');
  if (!el || el.disabled) return;
  audioUnlock();
  if (el.dataset.lb === 'open') openBoard();
  else if (el.dataset.lb === 'cat') {
    const x = $('.lbcats') ? $('.lbcats').scrollLeft : 0;
    LB.cat = el.dataset.v; $('#lbBox').innerHTML = boardHtml(); SFX.click();
    if ($('.lbcats')) $('.lbcats').scrollLeft = x;
  }
  else if (el.dataset.lb === 'refresh') { SFX.click(); refreshBoard(true); }
});
// Bests are checked about once a minute and sent when they improve (at most every 2 minutes).
setInterval(() => { if (!document.hidden) sendScore(false); }, 60000);
window.addEventListener('online', () => sendScore(false));
