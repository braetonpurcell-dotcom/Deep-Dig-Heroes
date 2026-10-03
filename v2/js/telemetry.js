'use strict';
// Play stats for balancing the game. Each play session sends one summary to the developer (how long
// it lasted, what you did and how far you got), plus a few key moments: every prestige and every new
// best floor at a multiple of 10. Records go through the same Google Form as feedback, tagged
// "session" or "event", with the same player name and id the leaderboard uses. Nothing else about
// the phone is sent.

const TM_QUEUE_KEY = 'ddh-tm-queue';
const TM_CHECKPOINT = 600; // seconds of active play between checkpoints in a long session
const TM_MIN_SESSION = 15; // shorter visits aren't worth a row
const TM_QUEUE_MAX = 60;
const TM = { sess: null, flushing: false };

function tmOn() { return true; }

// The numbers a session is measured against: counters only grow, so a session is end minus start.
function tmSnapshot() {
  const st = S.stats;
  return {
    t: Date.now(), floor: S.run.floor, maxFloor: S.run.maxFloor, best: st.bestFloor, level: S.run.level,
    prestiges: S.prestiges, power: Math.round(S.power || 0), cores: S.cores, coins: S.coins, keys: S.keys, scrap: S.scrap,
    coinsEarned: st.coinsEarned, kills: st.kills, bosses: st.bosses, taps: st.taps, perfects: st.perfects, escapes: st.escapes,
    cases: st.cases, ores: st.ores, merges: st.merges, bestStreak: st.bestStreak, bestMult: +st.bestMult.toFixed(2),
    sp: S.run.sp, spent: Object.values(S.run.skills).reduce((a, b) => a + b, 0),
  };
}

function tmStart(reason, away = 0) {
  TM.sess = {
    id: 'ss-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    reason, away: Math.round(away), part: 1, start: tmSnapshot(), active: 0, sinceCheck: 0,
    c: {}, tabs: {}, pace: { sum: 0, n: 0, peak: 0 }, mult: { sum: 0, n: 0, peak: 1 }, combo: { peak: 0 },
  };
}
function tmCount(k, n = 1) { if (TM.sess) TM.sess.c[k] = (TM.sess.c[k] || 0) + n; }

// Called once a second while the game is open and visible.
function tmTick() {
  const s = TM.sess;
  if (!s || document.hidden) return;
  s.active++;
  s.sinceCheck++;
  s.tabs[UI.tab] = (s.tabs[UI.tab] || 0) + 1;
  if (UI.tab === 'fight' && !R.duel) {
    const p = R.pace || 0;
    s.pace.sum += p; s.pace.n++; s.pace.peak = Math.max(s.pace.peak, p);
    const m = comboMult();
    s.mult.sum += m; s.mult.n++; s.mult.peak = Math.max(s.mult.peak, m);
  }
  s.combo.peak = Math.max(s.combo.peak, S.math.streak);
  if (s.sinceCheck >= TM_CHECKPOINT) tmEnd('checkpoint', true);
}

// Close the session (or a checkpoint of it) and queue its summary.
function tmEnd(why, keepGoing = false) {
  const s = TM.sess;
  if (!s) return;
  if (s.active >= TM_MIN_SESSION && tmOn()) {
    const a = s.start, b = tmSnapshot();
    const d = k => b[k] - a[k];
    const r1 = x => Math.round(x * 100) / 100;
    tmQueue('session', s.id + (s.part > 1 ? '-' + s.part : ''), {
      v: 1, kind: 'session', why, part: s.part, reason: s.reason, awayBefore: s.away,
      startedAt: new Date(a.t).toISOString(), active: s.active, wall: Math.round((b.t - a.t) / 1000),
      floor: [a.floor, b.floor], maxFloor: [a.maxFloor, b.maxFloor], best: [a.best, b.best], level: [a.level, b.level],
      prestiges: d('prestiges'), power: [a.power, b.power], cores: [a.cores, b.cores],
      coinsEarned: d('coinsEarned'), coinsEnd: b.coins, keys: [a.keys, b.keys], scrap: [a.scrap, b.scrap],
      kills: d('kills'), bosses: d('bosses'), taps: d('taps'), perfects: d('perfects'), escapes: d('escapes'),
      accuracy: d('taps') + d('escapes') ? r1(d('taps') / (d('taps') + d('escapes'))) : null,
      cases: d('cases'), ores: d('ores'), merges: d('merges'),
      paceAvg: s.pace.n ? r1(s.pace.sum / s.pace.n) : null, pacePeak: r1(s.pace.peak),
      multAvg: s.mult.n ? r1(s.mult.sum / s.mult.n) : null, multPeak: r1(s.mult.peak), comboPeak: s.combo.peak,
      bestStreak: [a.bestStreak, b.bestStreak], bestMult: [a.bestMult, b.bestMult],
      spUnspent: b.sp,
      tabs: s.tabs, events: s.c,
    });
  }
  if (keepGoing) {
    const part = s.part + 1;
    tmStart(s.reason, 0);
    TM.sess.id = s.id;
    TM.sess.part = part;
  } else TM.sess = null;
  tmFlush(why !== 'checkpoint');
}

function tmEvent(name, data) {
  if (!tmOn()) return;
  tmQueue('event', 'ev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), { v: 1, kind: 'event', event: name, at: new Date().toISOString(), play: Math.round(S.stats.playTime), ...data });
  tmFlush(false);
}

// ---------- queue and sending ----------
function tmLoadQueue() {
  try { const q = JSON.parse(localStorage.getItem(TM_QUEUE_KEY) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; }
}
function tmSaveQueue(q) {
  try { localStorage.setItem(TM_QUEUE_KEY, JSON.stringify(q.slice(-TM_QUEUE_MAX))); } catch (e) { /* storage full: drop stats, never the save */ }
}
function tmQueue(type, id, data) {
  const q = tmLoadQueue();
  q.push({ type, id, pid: playerId(), name: playerName() || 'Unnamed', info: fbInfo(), text: JSON.stringify({ pid: playerId(), name: playerName(), ...data }) });
  tmSaveQueue(q);
}
function tmBody(item) {
  const f = FEEDBACK_FORM.fields;
  const body = new URLSearchParams();
  body.set(f.id, item.id);
  body.set(f.player, item.name);
  body.set(f.type, item.type);
  body.set(f.message, item.text);
  body.set(f.replyTo, '');
  body.set(f.info, item.info);
  return body;
}
// leaving: the page may be closing, so hand everything to the browser with sendBeacon.
async function tmFlush(leaving) {
  if (!FEEDBACK_FORM || !navigator.onLine || TM.flushing) return;
  const q = tmLoadQueue();
  if (!q.length) return;
  if (leaving && navigator.sendBeacon) {
    const left = q.filter(item => !navigator.sendBeacon(FEEDBACK_FORM.action, tmBody(item)));
    tmSaveQueue(left);
    return;
  }
  TM.flushing = true;
  const left = [];
  for (const item of q) {
    try { await fetch(FEEDBACK_FORM.action, { method: 'POST', mode: 'no-cors', body: tmBody(item) }); } catch (e) { left.push(item); }
  }
  tmSaveQueue(left.concat(tmLoadQueue().slice(q.length)));
  TM.flushing = false;
}

// ---------- hooks ----------
on('bossDown', () => tmCount('bossesWon'));
on('bossFail', () => tmCount('bossesLost'));
on('duelStart', e => tmCount('duel_' + e.game));
on('rune', e => tmCount('rune_' + e.game));
on('goldRush', e => tmCount(e.kind === 'mother' ? 'motherLodes' : 'goldVeins'));
on('fresh', () => tmCount('freshHands'));
on('secondWind', () => tmCount('secondWind'));
on('tunnel', () => tmCount('tunnels'));
on('levelup', () => tmCount('levelups'));
on('treasure', () => tmCount('treasures'));
on('achievement', () => tmCount('achievements'));
on('questDone', () => tmCount('quests'));
on('bestFloor', ({ floor }) => { if (floor % 10 === 0) tmEvent('bestFloor', { floor, level: S.run.level, prestiges: S.prestiges, runMin: Math.round((Date.now() - S.run.started) / 60000) }); });

// Wrap a few actions to count them without touching the game code.
(function tmWrap() {
  const wrap = (name, fn) => { const orig = window[name]; if (typeof orig === 'function') window[name] = function (...a) { const r = orig.apply(this, a); fn(r, a); return r; }; };
  wrap('openCase', (r, a) => { if (r) tmCount(`case_${S.caseKind || 'tool'}_${a[1] || 'coins'}`, a[2] || 1); });
  wrap('learnSkill', r => { if (r) tmCount('skillPoints'); });
  wrap('respecSkills', r => { tmCount('respecs'); });
  wrap('buyUpgrade', r => { if (r) tmCount('forgeBuys'); });
  wrap('reforgeItem', r => { if (r) tmCount('reforges'); });
  wrap('buyPrestigeNode', (r, a) => { if (r) tmCount('ptree_' + a[0]); });
  const pre = window.doPrestige;
  if (typeof pre === 'function') {
    window.doPrestige = function (...a) {
      const before = { floor: S.run.maxFloor, level: S.run.level, runMin: Math.round((Date.now() - S.run.started) / 60000), power: Math.round(S.power || 0), cores: S.cores };
      const r = pre.apply(this, a);
      if (r) { tmCount('prestiges'); tmEvent('prestige', { ...before, prestiges: S.prestiges, powerGain: r.power, coreGain: r.gain }); }
      return r;
    };
  }
})();

// Sessions start when the game opens or comes back, and end when it's hidden or closed.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) tmEnd('hidden');
  else if (!TM.sess) tmStart('return', R.hiddenAt ? (Date.now() - R.hiddenAt) / 1000 : 0);
});
window.addEventListener('pagehide', () => tmEnd('closed'));
window.addEventListener('online', () => tmFlush(false));
setInterval(tmTick, 1000);
