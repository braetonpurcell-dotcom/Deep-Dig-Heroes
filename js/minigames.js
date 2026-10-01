'use strict';
// Four brain mini-games in the mine's theme. They run in the Fight tab in place of the
// math keypad, either as a boss duel (3 lives, each win strikes the boss) or as a rune
// challenge from a lucky ore (play until the first mistake, rewards grow with each round).

const MG_INFO = {
  reaction: { name: 'Spark Vein', how: 'Wait for the vein to glow gold, then tap it as fast as you can.' },
  sequence: { name: 'Crystal Echo', how: 'Watch the crystals light up, then tap them in the same order.' },
  number: { name: 'Ore Code', how: 'Memorize the number before it fades, then type it in.' },
  chimp: { name: 'Ore Order', how: 'Tap the ores from 1 upward. After your first tap the numbers hide.' },
};

const MG = { active: null };

function mgLater(run, fn, ms) {
  const t = setTimeout(() => {
    if (run.alive && MG.active === run) fn();
  }, ms);
  run.timers.push(t);
}

function mgStage() { return $('#mgStage'); }

function startMinigame(game, mode) {
  stopMinigame();
  const run = { game, mode, level: 1, alive: true, timers: [], busy: false };
  MG.active = run;
  $('#tab-fight').classList.add('in-mg');
  run.win = (quality, best, label) => mgWin(run, quality, best, label);
  run.lose = msg => mgLose(run, msg);
  mgShell(run);
  mgLater(run, () => mgRound(run), 500);
  return run;
}

function stopMinigame() {
  const run = MG.active;
  if (!run) return;
  run.alive = false;
  run.timers.forEach(clearTimeout);
  MG.active = null;
  $('#tab-fight').classList.remove('in-mg');
  $('#arena').innerHTML = '';
  updateFight(true);
}

function mgShell(run) {
  const info = MG_INFO[run.game];
  const duel = run.mode === 'duel';
  $('#arena').innerHTML = `<div class="card mg-head">
      <div class="row"><div class="grow"><b class="mg-title">${duel ? 'Boss duel: ' : 'Rune: '}${info.name}</b>
        <div class="small muted">${info.how}</div></div>
        <button class="skip" data-mg="quit">${duel ? 'Give up' : 'Stop'}</button></div>
      <div class="row small mg-status"><span id="mgLives"></span><span class="grow" id="mgRound"></span><span id="mgBest"></span></div>
    </div>
    <div id="mgStage" class="mg-stage"></div>
    <div id="mgNote" class="ticker"></div>`;
  mgStatus(run);
}

function mgStatus(run) {
  const lives = $('#mgLives');
  if (!lives) return;
  if (run.mode === 'duel' && R.duel) {
    lives.innerHTML = Array.from({ length: DUEL_LIVES }, (_, i) => `<i class="mg-heart ${i < R.duel.lives ? 'on' : ''}"></i>`).join('');
  } else lives.textContent = 'One mistake ends it';
  $('#mgRound').textContent = `Round ${run.level}`;
  const b = S.mg[run.game];
  $('#mgBest').textContent = b ? `Best ${run.game === 'reaction' ? b + ' ms' : b}` : '';
}

function mgNote(text, kind = '') {
  const n = $('#mgNote');
  if (n) { n.textContent = text; n.className = 'ticker ' + kind; }
}

function mgRound(run) {
  run.busy = false;
  mgStatus(run);
  ({ reaction: roundReaction, sequence: roundSequence, number: roundNumber, chimp: roundChimp })[run.game](run);
}

function mgWin(run, quality, best, label) {
  if (run.busy) return;
  run.busy = true;
  const record = recordMinigame(run.game, best);
  SFX.correct(run.level + 2);
  vibrate(12);
  mgNote(`${label}${record ? ' · new personal best!' : ''}`, 'good');
  if (run.mode === 'duel') duelHit(quality);
  run.level++;
  if (MG.active === run) mgLater(run, () => mgRound(run), 750);
}

function mgLose(run, msg) {
  if (run.busy) return;
  run.busy = true;
  SFX.wrong();
  vibrate(60);
  mgNote(msg, 'bad');
  if (run.mode === 'duel') {
    duelMiss(); // may end the duel, which stops the mini-game
    if (MG.active === run) mgLater(run, () => mgRound(run), 1100);
    return;
  }
  const reached = run.level - 1;
  mgLater(run, () => {
    const rw = runeReward(reached);
    $('#mgStage').innerHTML = `<div class="mg-result"><div class="big-gain">${icon('coin', '')} +${fmt(rw.coins)}</div>
      ${rw.keys ? `<div class="mg-keys">${icon('key', '')} +${plural(rw.keys, 'key')}</div>` : ''}
      <p class="small muted">You cleared ${plural(reached, 'round')}. Rewards grow with every round you clear.</p>
      <button class="btn gold wide" data-mg="quit">Collect</button></div>`;
    SFX.claim();
  }, 900);
}

// Taps on the arena go through one pointerdown handler so input never waits for a click.
function mgPointer(e) {
  const run = MG.active;
  const t = e.target.closest('[data-mg]');
  if (!run || !t) return;
  e.preventDefault();
  audioUnlock();
  if (t.dataset.mg === 'quit') {
    if (run.mode === 'duel' && R.duel) bossFailed();
    stopMinigame();
    return;
  }
  if (run.onTap) run.onTap(t);
}

// ---------- Spark Vein: reaction time ----------
function roundReaction(run) {
  mgStage().innerHTML = '<button class="mg-vein wait" data-mg="vein"><span>Wait for the glow…</span></button>';
  const vein = mgStage().firstChild;
  let goAt = 0;
  let done = false;
  mgLater(run, () => {
    if (done) return;
    goAt = performance.now();
    vein.className = 'mg-vein go';
    vein.innerHTML = '<span>TAP!</span>';
    SFX.tick(1);
    mgLater(run, () => {
      if (done) return;
      done = true;
      run.lose('Too slow. Tap the moment it glows.');
    }, 1500);
  }, rand(1500, 4000));
  run.onTap = () => {
    if (done) return;
    done = true;
    if (!goAt) {
      vein.className = 'mg-vein early';
      vein.innerHTML = '<span>Too soon!</span>';
      run.lose('Too soon. Wait for the gold glow.');
      return;
    }
    const ms = Math.round(performance.now() - goAt);
    vein.innerHTML = `<span>${ms} ms</span>`;
    run.win(clamp((650 - ms) / 300, 0.3, 1.6), ms, `${ms} ms`);
  };
}

// ---------- Crystal Echo: sequence memory ----------
function roundSequence(run) {
  const len = 2 + run.level;
  const seq = [];
  for (let i = 0; i < len; i++) {
    let c;
    do c = randi(0, 8); while (c === seq[i - 1]);
    seq.push(c);
  }
  mgStage().innerHTML = `<div class="mg-grid g3">${Array.from({ length: 9 }, (_, i) =>
    `<button class="mg-crystal c${i % 3}" data-mg="cell" data-i="${i}"></button>`).join('')}</div>`;
  const cells = $$('#mgStage .mg-crystal');
  const lit = (c, ms = 260) => {
    c.classList.add('lit');
    mgLater(run, () => c.classList.remove('lit'), ms);
  };
  const step = Math.max(300, 560 - run.level * 25);
  let watching = true;
  mgNote('Watch…');
  seq.forEach((c, k) => mgLater(run, () => { lit(cells[c], step * 0.6); SFX.mgNote(c); }, 300 + k * step));
  mgLater(run, () => { watching = false; mgNote(`Your turn: ${len} crystals`); }, 300 + len * step);
  let pos = 0;
  run.onTap = t => {
    if (watching || run.busy) return;
    const i = Number(t.dataset.i);
    lit(cells[i], 180);
    if (i !== seq[pos]) {
      lit(cells[seq[pos]], 600);
      run.lose('Wrong crystal');
      return;
    }
    pos++;
    SFX.mgNote(i);
    if (pos === len) run.win(1 + 0.08 * (len - 3), len, `${len} in a row`);
  };
}

// ---------- Ore Code: number memory ----------
function roundNumber(run) {
  const digits = 2 + run.level;
  let num = String(randi(1, 9));
  while (num.length < digits) num += randi(0, 9);
  const showMs = 1000 + 600 * digits;
  mgStage().innerHTML = `<div class="mg-number">${num}</div><div class="timer"><i id="mgFade" style="width:100%"></i></div>`;
  requestAnimationFrame(() => {
    const bar = $('#mgFade');
    if (bar) { bar.style.transition = `width ${showMs}ms linear`; bar.style.width = '0%'; }
  });
  let typed = '';
  run.onTap = null;
  mgLater(run, () => {
    mgStage().innerHTML = `<div class="mg-number typed" id="mgTyped">&nbsp;</div>
      <div class="mg-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0'].map(k =>
        `<button data-mg="key" data-k="${k}" class="${k === 'del' ? 'fn' : ''}">${k === 'del' ? '⌫' : k}</button>`).join('')}</div>`;
    mgNote(`Type the ${digits}-digit number`);
    run.onTap = t => {
      if (run.busy) return;
      const k = t.dataset.k;
      if (k === 'del') typed = typed.slice(0, -1);
      else typed += k;
      $('#mgTyped').textContent = typed || ' ';
      if (typed.length === digits) {
        if (typed === num) run.win(1 + 0.08 * (digits - 3), digits, `${digits} digits`);
        else run.lose(`It was ${num}`);
      }
    };
  }, showMs);
}

// ---------- Ore Order: chimp test ----------
function roundChimp(run) {
  const n = Math.min(20, 3 + run.level);
  const spots = shuffle(Array.from({ length: 20 }, (_, i) => i)).slice(0, n);
  const at = {};
  spots.forEach((cell, k) => { at[cell] = k + 1; });
  mgStage().innerHTML = `<div class="mg-grid g5">${Array.from({ length: 20 }, (_, i) => at[i]
    ? `<button class="mg-ore" data-mg="ore" data-n="${at[i]}">${at[i]}</button>`
    : '<span class="mg-empty"></span>').join('')}</div>`;
  mgNote(`Tap 1 to ${n} in order`);
  let next = 1;
  run.onTap = t => {
    if (run.busy) return;
    const v = Number(t.dataset.n);
    if (v !== next) {
      $('#mgStage .mg-grid').classList.remove('masked');
      t.classList.add('bad');
      run.lose(`That was ${v}. Next was ${next}.`);
      return;
    }
    if (next === 1) $('#mgStage .mg-grid').classList.add('masked');
    t.classList.add('done');
    SFX.tick(next / n);
    next++;
    if (next > n) run.win(1 + 0.08 * (n - 4), n, `${n} ores`);
  };
}

// ---------- wiring ----------
function fightBoss() {
  if (!bossWaiting()) return;
  audioUnlock();
  if (UI.tab !== 'fight') showTab('fight');
  const d = startBossDuel();
  if (d) startMinigame(d.game, 'duel');
  updateFloorBar();
}

on('spawn', () => { if (isBossFloor(S.run.floor)) updateFloorBar(); });
on('consolation', ({ coins }) => toast(`Consolation ore: +${fmt(coins)} coins`, 'gold', 'coin'));
on('duelMiss', () => { if (MG.active) mgStatus(MG.active); });
on('duelEnd', ({ won }) => {
  if (MG.active && MG.active.mode === 'duel') stopMinigame();
  if (won) toast('Boss down!', 'gold', 'trophy');
  updateFloorBar();
});
on('rune', ({ game }) => {
  if (UI.modalOpen) closeModal();
  showTab('fight');
  startMinigame(game, 'rune');
  SFX.ore();
  vibrate(30);
});
