'use strict';
// Boot, main loop, autosave, offline progress, cloud backup and the service worker.

const CLOUD = { ready: false, ref: null, busy: false, timer: 0 };
let wakeLock = null;
let lastFrame = 0;
let hiddenAt = 0;
let saveTimer = 0;
let booted = false;

function saveNow() {
  saveLocal();
  cloudSave();
}

function showIntro() {
  openModal(`<h2>Deep Dig Heroes</h2>
    <div style="text-align:center"><img src="${spriteUrl(heroSprite(false), 5, 'intro:hero')}" alt="" style="width:80px;image-rendering:pixelated"></div>
    <p>Your miner digs and fights on their own. Coins keep coming in, even while the app is closed.</p>
    <p><b>Tap the monsters on the pad before their ring closes.</b> Each tap strikes and adds to your combo, and the combo multiplies all your damage, up to x6. Tap early for a PERFECT. A monster that escapes cuts your combo, and the faster you are, the faster they come.</p>
    <p>Spend coins in the <b>Forge</b>, open <b>Cases</b> for gear and pets, and put skill points into your build. Reach B25 to prestige for permanent power.</p>
    <div class="mbtns"><button class="btn gold" data-act="close">Start digging</button></div>`, { dismissable: true });
}

function loop(now) {
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (R.paused) {
    requestAnimationFrame(loop);
    return;
  }
  if (!(dt >= 0)) dt = 0;
  if (dt > 0.25) dt = 0.25;
  try {
    // Hit-stop: the world freezes for a few frames on big hits; input keeps working.
    if (R.hitstop > 0) {
      R.hitstop = Math.max(0, R.hitstop - dt);
      render(0);
    } else {
      step(dt);
      render(dt);
    }
    uiTick(dt);
  } catch (e) {
    console.error(e);
  }
  saveTimer += dt;
  if (saveTimer >= 5) {
    saveTimer = 0;
    saveLocal();
  }
  CLOUD.timer += dt;
  if (CLOUD.timer >= 60) {
    CLOUD.timer = 0;
    cloudSave();
  }
  requestAnimationFrame(loop);
}

function onVisibility() {
  if (document.hidden) {
    hiddenAt = Date.now();
    R.hiddenAt = hiddenAt;
    saveNow();
    releaseWake();
    return;
  }
  const away = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0;
  hiddenAt = 0;
  R.hiddenAt = 0;
  lastFrame = performance.now();
  ensureDay();
  autoBackup(JSON.parse(serialize()));
  // A real break means a new session: the tap pad warms up again from a gentler pace.
  if (away >= 300) startPaceSession();
  if (away >= 60) {
    const res = applyOffline(away);
    welcomeBack(away);
    if (res && res.coins > 0) queueModal(() => showWelcomeBack(res));
  } else if (away >= 10) {
    const res = applyOffline(away);
    if (res && res.coins > 0) toast(`+${fmt(res.coins)} coins while you were away`, 'gold', 'coin');
  }
  applyWakeLock();
  refreshAll(true);
  if (away >= 60) { loadReplies(); flushFeedback(); }
}

async function applyWakeLock() {
  try {
    if (S.settings.wake && !document.hidden && 'wakeLock' in navigator) {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } else {
      releaseWake();
    }
  } catch (e) {
    wakeLock = null;
  }
}

function releaseWake() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Framed copies (like the claude.ai preview) can't install offline support.
  if (window.self !== window.top) return;
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !local) return;
  try {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) {
    /* not available here */
  }
}

// When this page runs as a claude.ai artifact, also keep a private copy of the save
// in the player's own database row so progress survives cleared browser storage.
async function cloudInit() {
  try {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    if (!db || !user) return;
    const uid = await user.id();
    if (!uid) return;
    const ref = db.doc('data/users/' + uid + '/save');
    const snap = await ref.get();
    CLOUD.ref = ref;
    if (snap.exists) {
      const d = snap.data();
      if (d && typeof d.code === 'string' && (d.savedAt || 0) > (S.savedAt || 0) + 5000) {
        try {
          loadState(parseCode(d.code));
          saveLocal();
          refreshAll();
          toast('Loaded your newest save from your Claude account', 'good');
        } catch (e) {
          /* keep the local save */
        }
      }
    }
    CLOUD.ready = true;
    cloudSave();
  } catch (e) {
    CLOUD.ready = false;
  }
}

async function cloudSave() {
  if (!CLOUD.ready || !CLOUD.ref || CLOUD.busy) return;
  CLOUD.busy = true;
  try {
    const code = exportCode();
    await CLOUD.ref.set({ code, savedAt: S.savedAt, v: SAVE_VERSION });
  } catch (e) {
    if (e && ['invalid_argument', 'revoked', 'not_granted', 'capability_disabled', 'quota_exceeded'].includes(e.code)) {
      CLOUD.ready = false;
    }
  } finally {
    CLOUD.busy = false;
  }
}

function boot(hotData) {
  if (booted) return;
  booted = true;
  let base = loadLocal();
  if (hotData && hotData.save) {
    try {
      const hot = JSON.parse(hotData.save);
      if (!base || (hot.savedAt || 0) >= (base.savedAt || 0)) base = hot;
    } catch (e) {
      /* ignore a bad snapshot */
    }
  }
  if (base) autoBackup(base);
  let broken = false;
  try {
    loadState(base || freshState());
  } catch (e) {
    // A damaged save must never leave the game stuck on a frozen screen.
    console.error(e);
    broken = !!base;
    keepBrokenSave(base);
    loadState(freshState());
  }
  initCanvas($('#cv'));
  initIcons();
  bindInput();
  UI.forgeSeen = UPGRADES.filter(upgradeUnlocked).length;
  UI.nextBreak = S.settings.breakMin > 0 ? S.settings.breakMin * 60 : 0;
  showTab('fight');
  tapStart();

  const away = base ? (Date.now() - (S.lastSeen || Date.now())) / 1000 : 0;
  const offline = away >= 60 ? applyOffline(away) : null;
  if (base) welcomeBack(away);
  UI.booting = false;
  if (!base) queueModal(showIntro);
  if (broken) toast('Your save could not be read, so the game started fresh. A copy was kept.', 'bad');
  if (S.migrateNote) {
    const { rebuilt, fromV2 } = S.migrateNote;
    delete S.migrateNote;
    const kept = `Your ${rebuilt} skill ${rebuilt === 1 ? 'rank was' : 'ranks were'} rebuilt along the new paths, and the small nodes on the way are free${S.run.sp ? `. You have ${S.run.sp} ${S.run.sp === 1 ? 'point' : 'points'} to spend` : ''}. Respec any time to try a different route.`;
    queueModal(() => openModal(fromV2 ? `<h2>New: the skill web</h2>
      <p>Skills are now a web you grow from the middle. Each class (Fighter, Tycoon, Gambler, Miner) splits into three branches, like Coins, XP and Speed, and each branch forks toward named skills. Own a whole branch to unlock its Mastery. ${kept}</p>
      <p>Prestige now gives <b>power</b> (permanent damage that grows with the level you reach) and <b>cores</b> to spend in the new Prestige tree, including locks that keep chosen skills through every prestige. Your cores so far became power, and you also kept them to spend.</p>
      <p>Cases now come in Tool and Pet versions, and every odds number shows the raw chance, with no luck mixed in.</p>
      <div class="mbtns"><button class="btn gold" data-act="openSkills">Let's see</button></div>` : `<h2>Skill web redesigned</h2>
      <p>Each class now splits into three branches (like Coins, XP and Speed) that fork toward named skills, and owning a whole branch unlocks its Mastery. ${kept}</p>
      <div class="mbtns"><button class="btn gold" data-act="openSkills">Let's see</button></div>`, { dismissable: true }));
  }
  if (S.settled) {
    const { from, to } = S.settled;
    delete S.settled;
    queueModal(() => openModal(`<h2>The mine got tougher</h2>
      <p>Monsters now get much stronger with every floor, so the climb is slower and each new floor means more. Big combos also count for far more now: fast, accurate tapping can push your multiplier past x20.</p>
      <p>Your miner moved up from B${from} to B${to}, where it can keep digging. Your best floor and leaderboard records stay.</p>
      <div class="mbtns"><button class="btn gold" data-act="close">Dig in</button></div>`, { dismissable: true }));
  }
  if (S.bonusRound) toast(`Your double-it round is still on: ${BONUS_TAPS} taps in a row`, 'purple');
  if (offline && offline.coins > 0) queueModal(() => showWelcomeBack(offline));
  if (!S.daily.claimed) queueModal(showDailyPopup);

  saveLocal();
  applyWakeLock();
  // Opened in the background (restored tab): the drill is idle until the player looks at it.
  if (document.hidden) {
    hiddenAt = Date.now();
    R.hiddenAt = hiddenAt;
  }
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', saveNow);
  requestAnimationFrame(t => {
    lastFrame = t;
    requestAnimationFrame(loop);
  });
  cloudInit();
  registerSW();
  loadReplies();
  flushFeedback();
  setTimeout(() => sendScore(false), 5000);
  tmStart('open', away);
  tmFlush(false);
  window.DDH_BOOTED = true;
}

// A small handle for automated testing and debugging from the console.
window.DDH = {
  get state() { return S; }, runtime: R, step, recalc, saveLocal, exportCode, parseCode, loadState,
  buyUpgrade, learnSkill, openCase, equipItem, equipPet, mergeAllPets, doPrestige, canPrestige,
  tapHit, tapMiss, collectOre, applyOffline, idleRates, claimDaily, claimQuest, claimAchievement,
  upgradeQuote, caseCost, bestCaseTier, itemStats, comboMult, get stats() { return ST; },
};

(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try { hot.snapshot(() => ({ save: serialize() })); } catch (e) { /* optional */ }
  }
  if (hot && typeof hot.ready === 'function') {
    try { hot.ready(data => boot(data || {})); } catch (e) { boot({}); }
    setTimeout(() => boot((hot && hot.data) || {}), 1500);
  } else {
    boot((hot && hot.data) || {});
  }
})();
