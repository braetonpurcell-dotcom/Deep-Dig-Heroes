'use strict';
// HTML interface: HUD, tabs, the math keypad, modals, toasts and the case-opening reel.

const UI = {
  tab: 'fight', bagView: 'gear', branch: 'brawler', skillInfo: null,
  tickerUntil: 0, goalIdx: 0, goalT: 0,
  modalOpen: false, modalOpts: null, modalQueue: [],
  lastOpen: null, reelRaf: 0, reelTimer: 0, modalId: 0, nextBreak: 0, forgeSeen: 0, booting: true,
  hudT: 0, slowT: 0, holdToasts: false, heldToasts: [],
};

// ---------- small builders ----------
function icon(name, cls = 'ic') {
  return `<img class="${cls}" src="${iconUrl(name)}" alt="">`;
}
function costHtml(n, ic = 'coin') {
  return `<span class="cost">${icon(ic, '')}${fmt(n)}</span>`;
}
function statVal(k, v) {
  if (k === 'crit') return '+' + (Math.round(v * 1000) / 10) + '%';
  return fmtPct(v);
}
function statText(k, v) {
  return `${statVal(k, v)} ${STATS[k].name.toLowerCase()}`;
}
function upgradeIconUrl(u) {
  if (u.icon === 'pick') return spriteUrl(pickSprite(0), 4, 'upg:pick');
  return iconUrl(u.icon);
}
// Wear condition and what it does to the item's stats, e.g. "Factory New · +18% stats".
function wearHtml(it) {
  const pct = Math.round((quality(it.fl) - 1) * 100);
  const cls = pct > 0 ? 'wear-up' : pct < 0 ? 'wear-down' : '';
  return `${wearName(it.fl)} · <span class="${cls}">${pct > 0 ? '+' : ''}${pct}% stats</span>`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---------- toasts ----------
function toast(text, kind = '', ic = null) {
  if (UI.holdToasts) {
    UI.heldToasts.push([text, kind, ic]);
    return;
  }
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = (ic ? icon(ic, '') : '') + `<span>${escapeHtml(text)}</span>`;
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove(); // two at most, so the HUD and boss timer stay readable
  setTimeout(() => el.remove(), 2600);
}

function releaseToasts() {
  UI.holdToasts = false;
  let held = UI.heldToasts.splice(0);
  // Several new index entries from one opening become a single toast.
  const entries = held.filter(([, k]) => k === 'purple index');
  if (entries.length > 1) {
    held = held.filter(([, k]) => k !== 'purple index');
    held.unshift([`${entries.length} new index entries: +${entries.length}% damage and coins`, 'purple', 'star']);
  }
  held.forEach(([t, k, i], n) => setTimeout(() => toast(t, k, i), 350 + n * 250));
}

// ---------- modal ----------
function queueModal(fn) {
  if (UI.modalOpen) UI.modalQueue.push(fn);
  else fn();
}

function openModal(html, opts = {}) {
  const m = $('#modal');
  const sheet = m.querySelector('.sheet');
  sheet.innerHTML = html;
  sheet.scrollTop = 0;
  m.hidden = false;
  UI.modalOpen = true;
  UI.modalOpts = opts;
  UI.modalId++;
  if (opts.onOpen) opts.onOpen(sheet);
}

function closeModal() {
  if (!UI.modalOpen) return;
  const opts = UI.modalOpts;
  cancelAnimationFrame(UI.reelRaf);
  clearTimeout(UI.reelTimer);
  UI.reelRaf = 0;
  UI.reelTimer = 0;
  $('#modal').hidden = true;
  UI.modalOpen = false;
  UI.modalOpts = null;
  if (UI.holdToasts) releaseToasts();
  if (opts && opts.onClose) opts.onClose();
  refreshAll();
  pumpModalQueue();
}

function pumpModalQueue() {
  const next = UI.modalQueue.shift();
  if (!next) return;
  setTimeout(() => {
    if (UI.modalOpen) { UI.modalQueue.unshift(next); return; }
    next();
    if (!UI.modalOpen) pumpModalQueue(); // that entry chose not to show anything
  }, 150);
}

// ---------- tabs ----------
function showTab(name) {
  if (UI.tab === 'bag' && name !== 'bag') markItemsSeen();
  UI.tab = name;
  for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.tab === name);
  for (const s of $$('#panel > .tab')) s.hidden = s.id !== 'tab-' + name;
  $('#panel').scrollTop = 0;
  if (name === 'forge') UI.forgeSeen = UPGRADES.filter(upgradeUnlocked).length;
  buildTab(name);
}

function buildTab(name = UI.tab) {
  if (name === 'fight') updateFight(true);
  else if (name === 'forge') buildForge();
  else if (name === 'skills') buildSkills();
  else if (name === 'cases') buildCases();
  else if (name === 'bag') buildBag();
  else if (name === 'quests') buildQuests();
  else if (name === 'more') buildMore();
}

// gentle: keep a save code the player is pasting (More tab) instead of rebuilding over it.
function refreshAll(gentle = false) {
  updateHud();
  updateFloorBar();
  updateBadges();
  const box = $('#importBox');
  if (gentle && UI.tab === 'more' && box && !box.hidden) return;
  buildTab();
}

// ---------- HUD and floor bar ----------
function effectiveDps() {
  let d = ST.dps * comboMult();
  if (R.frenzyT > 0) d *= 3;
  if (S.math.streak === 0) d *= ST.goldDrill;
  return d;
}

function updateHud() {
  $('#hCoins').textContent = fmt(S.coins);
  $('#hKeys').textContent = fmt(S.keys);
  $('#hCores').textContent = fmt(S.cores);
  $('#hScrap').textContent = fmt(S.scrap);
  $('#hLvl').textContent = S.run.level;
  $('#hXp').style.width = Math.min(100, (S.run.xp / xpNeed(S.run.level)) * 100) + '%';
  $('#hDps').textContent = fmt(effectiveDps());
}

function updateFloorBar() {
  const f = S.run.floor;
  $('#fName').textContent = 'B' + f + (isBossFloor(f) ? ' · Boss' : '');
  $('#fBiome').textContent = biomeName(f) + (S.run.maxFloor > f ? ` · best this run B${S.run.maxFloor}` : '');
  $('#fUp').disabled = f <= 1;
  $('#fDown').disabled = f >= S.run.maxFloor;
  const auto = $('#fAuto');
  auto.classList.toggle('on', S.run.auto);
  auto.setAttribute('aria-pressed', S.run.auto ? 'true' : 'false');
  auto.textContent = S.run.auto ? 'Auto' : 'Farm';
  const retry = canRetryBoss();
  const waiting = bossWaiting();
  $('#fBoss').hidden = !retry;
  $('#fFight').hidden = !waiting;
  auto.hidden = retry || waiting;
  $('#fPrestige').hidden = !canPrestige();
}

function setDot(tab, on) {
  const b = $(`#tabs button[data-tab="${tab}"] .dot`);
  if (b) b.classList.toggle('show', !!on);
}

function updateBadges() {
  const c = claimableCounts();
  setDot('fight', bossWaiting() && UI.tab !== 'fight');
  setDot('skills', S.run.sp > 0);
  setDot('cases', freeCrateReady() || S.keys > 0);
  setDot('bag', S.gear.bag.some(it => it.isNew) || mergeablePets() > 0);
  setDot('quests', c.daily + c.quests + c.bonus + c.ach > 0);
  setDot('more', canPrestige());
  setDot('forge', UPGRADES.filter(upgradeUnlocked).length > UI.forgeSeen);
}

// ---------- fight tab ----------
function setTicker(text, kind = '', ms = 1800) {
  const t = $('#ticker');
  t.textContent = text;
  t.className = 'ticker ' + kind;
  UI.tickerUntil = performance.now() + ms;
}

function goalMessages() {
  const out = [];
  if (bossWaiting()) return [['A boss blocks the way. Your miner farms this floor until you tap Fight boss.', 'gold']];
  if (canPrestige()) out.push([`Prestige ready: +${prestigeGain()} cores in the More tab`, 'gold']);
  if (S.run.sp > 0) out.push([`${plural(S.run.sp, 'skill point')} to spend in Skills`, 'gold']);
  const c = claimableCounts();
  if (c.daily + c.quests + c.bonus + c.ach > 0) out.push(['Rewards are waiting in Quests', 'gold']);
  if (freeCrateReady()) out.push(['Your free crate is ready in Cases', 'gold']);
  const nextU = UPGRADES.find(u => !upgradeUnlocked(u));
  if (nextU) out.push([`A new Forge upgrade unlocks at B${nextU.unlock}`, '']);
  const f = S.run.floor;
  if (!isBossFloor(f)) {
    const nb = Math.ceil(f / 10) * 10;
    out.push([`Boss at B${nb}, ${plural(nb - f, 'floor')} to go`, '']);
  }
  if (S.prestiges === 0 && S.run.maxFloor < 25) out.push(['Reach B25 to unlock prestige', '']);
  const toEpic = epicPityLeft();
  if (toEpic <= 3) out.push([`Epic or better guaranteed within ${plural(toEpic, 'case')}`, '']);
  out.push([`Level ${S.run.level + 1} in ${fmt(Math.max(0, xpNeed(S.run.level) - S.run.xp))} XP`, '']);
  if (S.math.streak === 0) out.push(['Answer problems to strike and build a combo', '']);
  return out;
}

function rotateGoal(dt) {
  if (R.bonusRound || performance.now() < UI.tickerUntil) return;
  UI.goalT -= dt;
  if (UI.goalT > 0) return;
  UI.goalT = 5;
  const msgs = goalMessages();
  UI.goalIdx = (UI.goalIdx + 1) % msgs.length;
  const [text, kind] = msgs[UI.goalIdx];
  const t = $('#ticker');
  t.textContent = text;
  t.className = 'ticker ' + kind;
}

function updateProblem() {
  const p = R.prob;
  if (!p) return;
  $('#pQ').textContent = p.text;
  $('#pEq').textContent = p.prompt === '?' ? '=' : p.prompt.replace(' ?', '');
  updateAnswerBox();
  const useChoices = S.settings.answer === 'choices';
  $('#keypad').hidden = useChoices;
  $('#choices').hidden = !useChoices;
  if (useChoices) {
    $('#choices').innerHTML = R.choices.map(v => `<button data-choice="${v}">${v}</button>`).join('');
  }
}

function updateAnswerBox() {
  const a = $('#pA');
  a.textContent = R.input;
  a.classList.toggle('empty', R.input === '');
}

function updateFight(full = false) {
  if (full) updateProblem();
  const streak = S.math.streak;
  const mult = $('#cMult');
  mult.textContent = '×' + comboMult().toFixed(2);
  mult.classList.toggle('zero', streak === 0);
  const fill = $('#cFill');
  fill.style.width = Math.min(100, (Math.min(streak, ST.comboCap) / ST.comboCap) * 100) + '%';
  fill.classList.toggle('fading', streak > 0 && R.time - R.lastAnswer > ST.decay - 2);
  $('#cStreak').textContent = `${streak}/${ST.comboCap}`;
  $('#cLv').textContent = Math.floor(S.math.rating);
  const p = R.prob;
  if (p) {
    const el = R.time - R.probStart;
    const T = targetTime(p.tier);
    const qT = T * 0.6;
    const bar = $('#pTimer');
    if (el < qT) { bar.style.width = (1 - el / qT) * 100 + '%'; bar.className = ''; }
    else if (el < T) { bar.style.width = (1 - (el - qT) / (T - qT)) * 100 + '%'; bar.className = 'slow'; }
    else { bar.style.width = '100%'; bar.className = 'late'; }
  }
  // The double-it progress lives in the ticker line, so the keypad never loses space to it.
  if (R.bonusRound && performance.now() >= UI.tickerUntil) {
    const t = $('#ticker');
    const msg = `Double it: ${R.bonusRound.done}/${R.bonusRound.need} correct in a row, no mistakes`;
    if (t.textContent !== msg) { t.textContent = msg; t.className = 'ticker gold'; }
  }
}

function keyInput(k) {
  if (!R.prob || UI.modalOpen || MG.active) return;
  if (k === 'clear') R.input = '';
  else if (k === 'back') R.input = R.input.slice(0, -1);
  else {
    if (R.input.length >= 6) return;
    R.input += k;
  }
  updateAnswerBox();
  const need = String(R.prob.answer).length;
  if (/^\d$/.test(k) && R.input.length >= need) submitAnswer(Number(R.input));
}

on('problem', () => { if (UI.tab === 'fight') updateProblem(); });

on('answer', res => {
  const card = $('#mathcard');
  card.classList.remove('flash-good', 'flash-bad');
  void card.offsetWidth;
  card.classList.add(res.ok ? 'flash-good' : 'flash-bad');
  if (res.ok) {
    SFX.correct(res.streak);
    if (res.quick) SFX.quick();
    vibrate(12);
    const msg = res.mega ? `MEGA strike! Streak ${res.streak}`
      : res.quick ? `Quick! ${res.dt.toFixed(1)}s, strike ×1.5`
        : `Correct in ${res.dt.toFixed(1)}s`;
    setTicker(msg, 'good', 1400);
  } else {
    SFX.wrong();
    vibrate(60);
    const lost = res.lost ? `, streak −${res.lost}` : '';
    setTicker(res.skipped ? `Skipped: ${res.text} = ${res.answer}` : `${res.text} = ${res.answer}${lost}`, 'bad', 2600);
  }
  if (res.bonus) {
    if (res.bonus.won) {
      toast(`Doubled! +${fmt(res.bonus.reward.coins)} coins`, 'gold', 'coin');
      SFX.claim();
    } else {
      toast('Bonus round missed. You kept the normal reward.', 'bad');
    }
  }
  updateFight(true);
});

// ---------- forge ----------
function upgradeEffect(u) {
  const L = upgradeLevel(u.id);
  switch (u.id) {
    case 'sharpen': {
      const next = (Math.floor(L / 25) + 1) * 25;
      return `Base damage ${fmt(sharpenDamage(L))} · next ×2 at Lv ${next}`;
    }
    case 'brain': return `Strikes ${fmtPct(0.1 * L)}`;
    case 'fury': return `Attack speed ${fmtPct(0.04 * L)}`;
    case 'magnet': return `Coins ${fmtPct(0.1 * L)}`;
    case 'crit': return `Crit chance ${(ST.critChance * 100).toFixed(1)}%`;
    case 'critdmg': return `Crits hit ×${ST.critMult.toFixed(2)}`;
    case 'scholar': return `XP ${fmtPct(0.1 * L)}`;
    default: return '';
  }
}

function buildForge() {
  const amt = S.settings.buyAmt;
  let h = `<div class="seg" role="group" aria-label="Buy amount">${['1', '10', 'max'].map(a =>
    `<button data-act="buyAmt" data-v="${a}" class="${amt === a ? 'on' : ''}">${a === 'max' ? 'Max' : '×' + a}</button>`).join('')}</div>`;
  h += '<div class="list">';
  for (const u of UPGRADES) {
    if (!upgradeUnlocked(u)) {
      h += `<div class="item locked"><div class="ico">?</div><div class="txt"><div class="name">Locked</div><div class="desc">Reach B${u.unlock} to unlock</div></div><div></div></div>`;
      continue;
    }
    const L = upgradeLevel(u.id);
    h += `<div class="item"><div class="ico"><img src="${upgradeIconUrl(u)}" alt=""></div>
      <div class="txt"><div class="name">${u.name} <small>Lv ${L}${u.max ? '/' + u.max : ''}</small></div>
      <div class="desc">${u.desc}</div><div class="desc" data-eff="${u.id}">${upgradeEffect(u)}</div></div>
      <button class="btn gold buy" data-act="buy" data-id="${u.id}"></button></div>`;
  }
  h += '</div>';
  $('#tab-forge').innerHTML = h;
  refreshForge();
}

function refreshForge() {
  for (const b of $$('#tab-forge [data-act="buy"]')) {
    const u = UPGRADES.find(x => x.id === b.dataset.id);
    const q = upgradeQuote(u, S.settings.buyAmt);
    let html;
    if (q.maxed) {
      html = 'Maxed';
      b.disabled = true;
    } else {
      b.disabled = !q.afford;
      html = `<span>Buy${q.n > 1 ? ' ×' + q.n : ''}</span><small>${costHtml(q.cost)}</small>`;
    }
    if (b._h !== html) {
      b.innerHTML = html;
      b._h = html;
    }
  }
}

// ---------- skills ----------
// Why a skill can't take a point right now, or '' if it can.
function skillBlock(id) {
  const n = SKILL_INDEX[id];
  if (skillRank(id) >= n.max) return 'Maxed out.';
  if (branchPoints(n.branch) < TIER_REQ[n.tier]) return `Put ${TIER_REQ[n.tier]} points into this branch first.`;
  if (S.run.sp <= 0) return 'No skill points left. Level up to earn more.';
  return '';
}

function skillInfoHtml(id) {
  const n = SKILL_INDEX[id];
  const b = BRANCHES.find(x => x.id === n.branch);
  const block = skillBlock(id);
  return `<div class="row"><div class="grow"><b style="color:${b.color}">${n.name}</b> <span class="muted">${skillRank(id)}/${n.max}</span><br>
    <span class="small">${n.desc}</span>${block ? `<br><span class="small" style="color:var(--bad)">${block}</span>` : ''}</div>
    ${block ? '' : `<button class="btn gold small" data-act="learnSkill" data-id="${id}">Learn +1</button>`}</div>`;
}

function buildSkills() {
  const b = BRANCHES.find(x => x.id === UI.branch);
  const pts = branchPoints(b.id);
  let h = `<div class="row"><div class="grow"><b style="color:var(--gold)">${S.run.sp}</b> ${S.run.sp === 1 ? 'skill point' : 'skill points'}
    <span class="muted small">· earn 1 per level</span></div><button class="btn small" data-act="respec">Respec (free)</button></div>`;
  h += `<div class="seg">${BRANCHES.map(x =>
    `<button data-act="branch" data-v="${x.id}" class="${x.id === UI.branch ? 'on' : ''}"><span style="color:${x.color}">${x.name}</span> ${branchPoints(x.id)}</button>`).join('')}</div>`;
  h += `<div class="card branchhead"><span class="small">${b.blurb}</span><span class="small muted">Passive: ${b.passive} (now ${pts})</span></div>`;
  h += `<div class="card nodeinfo" id="nodeInfo">${UI.skillInfo && SKILL_INDEX[UI.skillInfo].branch === b.id
    ? skillInfoHtml(UI.skillInfo)
    : '<span class="muted small">Tap a skill to read it, then press Learn to spend a point. Respec is free, so try different builds.</span>'}</div>`;
  h += '<div class="tiers">';
  for (let t = 0; t < 4; t++) {
    const nodes = b.nodes.filter(n => n.tier === t);
    const locked = pts < TIER_REQ[t];
    h += `<div class="tierlabel">Tier ${t + 1}${t ? ` · needs ${TIER_REQ[t]} points in ${b.name}` : ''}</div>
      <div class="nodes ${nodes.length === 1 ? 'one' : ''}">`;
    for (const n of nodes) {
      const rank = skillRank(n.id);
      const cls = [canLearn(n.id) ? 'can' : '', locked ? 'locked' : '', rank >= n.max ? 'maxed' : '', UI.skillInfo === n.id ? 'sel' : ''].join(' ');
      h += `<button class="node ${cls}" style="--branch:${b.color}" data-act="skill" data-id="${n.id}" aria-pressed="${UI.skillInfo === n.id}">
        <span class="nn">${n.name}</span><span class="nd">${n.desc}</span>
        <span class="pips">${Array.from({ length: n.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span></button>`;
    }
    h += '</div>';
  }
  h += '</div>';
  $('#tab-skills').innerHTML = h;
}

// Tapping a skill only selects it; points are spent with the Learn button.
function tapSkill(id) {
  UI.skillInfo = id;
  SFX.click();
  buildSkills();
}

function doLearnSkill(id) {
  UI.skillInfo = id;
  if (learnSkill(id)) SFX.buy();
  else SFX.error();
  buildSkills();
}

// ---------- cases ----------
// Opens left until the pity guarantee kicks in. Pity Pact can lower the threshold below the
// current counter, in which case the very next open is guaranteed.
function epicPityLeft() { return Math.max(1, ST.epicPity - S.pity.epic); }

function buildCases() {
  const odds = rarityOdds();
  const best = bestCaseTier();
  const ready = freeCrateReady();
  let h = `<div class="card"><div class="pity">
      <div>Epic+ guaranteed in <b>${epicPityLeft()}</b></div>
      <div>Legendary+ in <b>${Math.max(1, LEGENDARY_PITY - S.pity.leg)}</b></div></div>
    <div class="odds" style="margin-top:6px">${RARITY.map((r, i) =>
      `<span class="tc${i}">${r.name} ${(odds[i] * 100).toFixed(odds[i] < 0.01 ? 2 : 1)}%</span>`).join('')}</div>
    <div class="small muted" style="margin-top:4px">Luck ${fmtPct(Math.max(0, ST.luck))} · 3 in 10 drops are pets</div></div>`;
  h += `<div class="card casecard"><div class="chest"><img src="${chestUrl(best)}" alt=""></div><div>
      <b>Free ${CASES[best - 1].name}</b><div class="small muted" id="freeTimer">${ready ? 'Ready now' : 'Next in ' + fmtClock((S.freeCrateAt - Date.now()) / 1000)}</div>
      <div class="casebtns"><button class="btn good" data-act="openFree" ${ready ? '' : 'disabled'}>Open free crate</button></div></div></div>`;
  for (const c of CASES) {
    if (!caseUnlocked(c)) {
      h += `<div class="card casecard" style="opacity:.55"><div class="chest"><img src="${chestUrl(c.tier)}" alt=""></div><div>
        <b>${c.name}</b><div class="small muted">Unlocks at prestige ${c.prestige}. Stats roughly ${Math.pow(3, c.tier - 1)}× a Copper Crate.</div></div></div>`;
      continue;
    }
    const cost = caseCost(c);
    h += `<div class="card casecard"><div class="chest"><img src="${chestUrl(c.tier)}" alt=""></div><div>
      <b>${c.name}</b> <span class="small muted">Tier ${c.tier}</span>
      <div class="casebtns">
        <button class="btn gold" data-act="openCase" data-t="${c.tier}" data-n="1" data-cost="${cost}">Open ${costHtml(cost)}</button>
        <button class="btn gold" data-act="openCase" data-t="${c.tier}" data-n="10" data-cost="${cost * 10}">×10 ${costHtml(cost * 10)}</button>
        <button class="btn purple" data-act="openKey" data-t="${c.tier}">${icon('key', '')} Use key</button>
      </div></div></div>`;
  }
  $('#tab-cases').innerHTML = h;
  refreshCases();
}

// Case prices follow the deepest floor of the run, which keeps changing while the miner digs,
// so every price on screen (Cases tab and the 'Open another' button) is re-quoted live.
function refreshCaseButtons() {
  for (const b of $$('[data-act="openCase"], [data-act="again"][data-t]')) {
    const c = CASES[Number(b.dataset.t) - 1];
    if (!c) continue;
    const n = Number(b.dataset.n) || 1;
    const cost = caseCost(c) * n;
    if (Number(b.dataset.cost) !== cost) {
      b.dataset.cost = cost;
      b.innerHTML = `${b.dataset.act === 'again' ? 'Open another' : n > 1 ? '×' + n : 'Open'} ${costHtml(cost)}`;
    }
    b.disabled = S.coins < cost;
  }
}

function refreshCases() {
  refreshCaseButtons();
  for (const b of $$('#tab-cases [data-act="openKey"]')) b.disabled = S.keys < 1;
  const ft = $('#freeTimer');
  if (ft) {
    const ready = freeCrateReady();
    const txt = ready ? 'Ready now' : 'Next in ' + fmtClock((S.freeCrateAt - Date.now()) / 1000);
    if (ft.textContent !== txt) ft.textContent = txt;
    const btn = $('#tab-cases [data-act="openFree"]');
    if (btn) btn.disabled = !ready;
  }
}

function dropView(d) {
  if (d.kind === 'pet') return { img: petUrl(d.sp), r: d.r, label: PETS[d.sp].name };
  const it = d.item;
  return { img: gearUrl(it.slot, it.t, it.r), r: it.r, label: SLOTS[it.slot].name };
}

function decoy(tier, forceR = null) {
  const r = forceR == null ? weightedIndex(rarityWeights(0)) : forceR;
  if (Math.random() < PET_CHANCE) {
    const sp = weightedPick(PET_IDS, id => PETS[id].weight);
    return { img: petUrl(sp), r, label: PETS[sp].name };
  }
  const slot = weightedPick(SLOT_IDS, s => SLOTS[s].weight);
  return { img: gearUrl(slot, tier, r), r, label: SLOTS[slot].name };
}

function tileHtml(v, extra = '') {
  return `<div class="tile rc${v.r} ${extra}"><img src="${v.img}" alt=""><small>${v.label}</small></div>`;
}

function caseLabel(ctx) {
  const c = CASES[ctx.tier - 1];
  if (ctx.method === 'free') return 'Free ' + c.name;
  if (ctx.method === 'reward') return ctx.title || 'Reward Crate';
  return c.name;
}

function startOpen(tier, method, n = 1) {
  audioUnlock();
  UI.holdToasts = true;
  const drops = openCase(tier, method, n);
  if (!drops) {
    releaseToasts();
    SFX.error();
    toast(method === 'key' ? 'You need a key. Bosses, quests and lucky ores drop them.' : 'Not enough coins yet.', 'bad');
    return;
  }
  UI.lastOpen = { tier, method, n };
  if (n > 1) showMulti(drops, { tier, method });
  else showReel(drops, { tier, method });
  updateHud();
}

function showReel(drops, ctx) {
  const N = 46;
  const WIN = 38;
  const TILE = 80;
  const entries = [];
  for (let i = 0; i < N; i++) entries.push(decoy(ctx.tier));
  const win = drops[0];
  entries[WIN] = dropView(win);
  if (win.r < 3 && Math.random() < 0.45) {
    const side = Math.random() < 0.65 ? 1 : -1;
    entries[WIN + side] = decoy(ctx.tier, Math.random() < 0.75 ? 3 : 4);
  }
  const html = `<h2>${escapeHtml(caseLabel(ctx))}</h2>
    <div class="reelwrap" id="reelWrap"><div class="reel" id="reel">${entries.map(e => tileHtml(e)).join('')}</div><div class="marker"></div></div>
    <div id="reelResult" class="result"><p class="small muted" style="text-align:center">Tap the reel to skip</p></div>`;
  openModal(html, {
    dismissable: false,
    onOpen(sheet) {
      const wrap = $('#reelWrap', sheet);
      const reel = $('#reel', sheet);
      const W = wrap.clientWidth;
      const land = WIN * TILE + rand(6, 70);
      const target = -(land - W / 2);
      const start = rand(-20, 0);
      const dur = 4600;
      const t0 = performance.now();
      let lastIdx = -1;
      let done = false;
      let skip = false;
      wrap.addEventListener('pointerdown', () => { skip = true; });
      const frame = now => {
        let t = (now - t0) / dur;
        if (skip) t = 1;
        t = Math.min(1, t);
        const e = 1 - Math.pow(1 - t, 4);
        const x = start + (target - start) * e;
        reel.style.transform = `translateX(${x}px)`;
        const idx = Math.floor((W / 2 - x) / TILE);
        if (idx !== lastIdx && !skip) {
          lastIdx = idx;
          SFX.tick(t);
        }
        if (t >= 1 && !done) {
          done = true;
          reel.children[WIN].classList.add('win');
          revealResult(drops, ctx);
          return;
        }
        UI.reelRaf = requestAnimationFrame(frame);
      };
      UI.reelRaf = requestAnimationFrame(frame);
    },
  });
}

function againButton(ctx) {
  if (ctx.method === 'free' || ctx.method === 'reward') return '';
  const c = CASES[ctx.tier - 1];
  if (ctx.method === 'key') {
    return S.keys > 0 ? `<button class="btn purple" data-act="again">${icon('key', '')} Open another (${S.keys} left)</button>` : '';
  }
  const n = UI.lastOpen ? UI.lastOpen.n : 1;
  const cost = caseCost(c) * n;
  return `<button class="btn gold" data-act="again" data-t="${c.tier}" data-n="${n}" data-cost="${cost}" ${S.coins < cost ? 'disabled' : ''}>Open another ${costHtml(cost)}</button>`;
}

function dropDetailHtml(d) {
  if (d.kind === 'pet') {
    const def = PETS[d.sp];
    const inParty = petEquippedCount(d.sp, d.r) > 0;
    const full = S.pets.eq.length >= petSlots();
    const where = inParty ? 'In your party.' : full ? 'Party full: swap pets in Bag › Pets.' : '';
    const merge = d.r < 4 ? 'Merge 3 into the next rarity.' : 'Top rarity.';
    return `<div class="rname tc${d.r}">${RARITY[d.r].name} ${def.name}</div>
      <div class="rsub">${petBonusText(d.sp, d.r)}</div>
      <div class="rsub">You own ${S.pets.inv[d.sp][d.r]}. ${where} ${merge}</div>`;
  }
  const it = d.item;
  const lines = itemStats(it).map(s => `<div class="statline"><span>${STATS[s.k].name}</span><b>${statVal(s.k, s.v)}</b></div>`).join('');
  let note = '';
  if (d.autoEquipped) note = '<div class="rsub" style="color:var(--good)">Equipped in your empty slot</div>';
  else if (d.salvaged) note = `<div class="rsub">Auto-salvaged for ${d.salvaged} scrap</div>`;
  else if (d.madeRoom) note = `<div class="rsub">Bag full: scrapped your ${d.madeRoom.name} (+${d.madeRoom.scrap} scrap) to make room</div>`;
  const eq = S.gear.eq[it.slot];
  let cmp = '';
  if (!d.autoEquipped && eq && eq !== it) {
    cmp = `<div class="small muted" style="margin-top:4px">Equipped: ${RARITY[eq.r].name} ${itemName(eq)}${eq.lv ? ' +' + eq.lv : ''}</div>`
      + itemStats(eq).map(s => `<div class="statline small muted"><span>${STATS[s.k].name}</span><span>${statVal(s.k, s.v)}</span></div>`).join('');
  }
  return `<div class="rname tc${it.r}">${RARITY[it.r].name} ${itemName(it)}</div>
    <div class="rsub">${wearHtml(it)}</div>${lines}${note}${cmp}`;
}

function revealResult(drops, ctx) {
  const win = drops[0];
  releaseToasts();
  SFX.reveal(win.r);
  if (win.r >= 2) vibrate(win.r >= 3 ? [40, 50, 40, 50, 120] : [30, 40, 60]);
  if (win.r >= 3) toast(`${RARITY[win.r].name} drop!`, 'gold');
  let h = dropDetailHtml(win);
  const extra = drops.slice(1);
  for (const d of extra) {
    const v = dropView(d);
    h += `<div class="small" style="text-align:center;margin-top:4px">Bonus drop: <span class="tc${v.r}">${RARITY[v.r].name} ${d.kind === 'pet' ? PETS[d.sp].name : itemName(d.item)}</span></div>`;
  }
  let actions = '';
  if (win.kind === 'gear' && !win.autoEquipped && !win.salvaged && findItem(win.item.id)) {
    actions += `<button class="btn good" data-act="equipItem" data-id="${win.item.id}">Equip</button>`;
    actions += `<button class="btn" data-act="salvage" data-id="${win.item.id}">Salvage +${scrapValue(win.item)}</button>`;
  }
  if (win.kind === 'pet' && petAvailable(win.sp, win.r) > 0 && S.pets.eq.length < petSlots()) {
    actions += `<button class="btn good" data-act="petToParty" data-sp="${win.sp}" data-r="${win.r}">Add to party</button>`;
  }
  actions += againButton(ctx);
  actions += '<button class="btn" data-act="close">Close</button>';
  const box = $('#reelResult');
  if (box) box.innerHTML = `${h}<div class="mbtns">${actions}</div>`;
  if (UI.modalOpts) UI.modalOpts.dismissable = true;
}

function showMulti(drops, ctx) {
  const views = drops.map(dropView);
  const html = `<h2>${escapeHtml(caseLabel(ctx))} ×${UI.lastOpen ? UI.lastOpen.n : drops.length}</h2>
    <div class="grid10" id="grid10">${views.map(v => tileHtml(v, 'hide')).join('')}</div>
    <div id="multiResult" class="result"></div>`;
  openModal(html, {
    dismissable: false,
    onOpen(sheet) {
      const tiles = $$('#grid10 .tile', sheet);
      const myId = UI.modalId;
      let i = 0;
      const next = () => {
        if (!UI.modalOpen || UI.modalId !== myId) return;
        if (i < tiles.length) {
          tiles[i].classList.remove('hide');
          SFX.tick(i / tiles.length);
          if (views[i].r >= 2) tiles[i].classList.add('win');
          i++;
          UI.reelTimer = setTimeout(next, 120);
          return;
        }
        const best = Math.max(...views.map(v => v.r));
        releaseToasts();
        SFX.reveal(best);
        if (best >= 2) vibrate([30, 40, 80]);
        const counts = [0, 0, 0, 0, 0];
        views.forEach(v => counts[v.r]++);
        const equipped = drops.filter(d => d.autoEquipped).length;
        const salvaged = drops.filter(d => d.salvaged).reduce((a, d) => a + d.salvaged, 0);
        const room = drops.filter(d => d.madeRoom);
        const roomScrap = room.reduce((a, d) => a + d.madeRoom.scrap, 0);
        const box = $('#multiResult', sheet);
        box.innerHTML = `<div class="odds" style="justify-content:center">${counts.map((n, r) => n ? `<span class="tc${r}">${n} ${RARITY[r].name}</span>` : '').join('')}</div>
          ${equipped ? `<div class="rsub" style="color:var(--good)">${plural(equipped, 'item')} equipped in empty slots</div>` : ''}
          ${salvaged ? `<div class="rsub">Auto-salvaged for ${salvaged} scrap</div>` : ''}
          ${room.length ? `<div class="rsub">Bag full: scrapped ${plural(room.length, 'weaker item')} (+${roomScrap} scrap) to make room</div>` : ''}
          <div class="rsub">Check the Bag tab to compare and equip.</div>
          <div class="mbtns">${againButton(ctx)}<button class="btn" data-act="close">Close</button></div>`;
        if (UI.modalOpts) UI.modalOpts.dismissable = true;
      };
      next();
    },
  });
}

// ---------- bag ----------
function buildBag() {
  let h = `<div class="seg">${[['gear', 'Gear'], ['pets', 'Pets'], ['index', 'Index']].map(([k, l]) =>
    `<button data-act="bagView" data-v="${k}" class="${UI.bagView === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (UI.bagView === 'gear') h += gearViewHtml();
  else if (UI.bagView === 'pets') h += petsViewHtml();
  else h += indexViewHtml();
  $('#tab-bag').innerHTML = h;
}

function gearViewHtml() {
  let h = '<div class="eqrow">';
  for (const slot of SLOT_IDS) {
    const it = S.gear.eq[slot];
    if (!it) {
      h += `<div class="eqslot"><img src="${gearUrl(slot, 1, 0, true)}" alt=""><span class="sn">${SLOTS[slot].name}</span><span class="sv muted">Empty</span></div>`;
      continue;
    }
    const main = itemStats(it)[0];
    h += `<button class="eqslot rc${it.r}" data-act="item" data-id="${it.id}"><img src="${gearUrl(it.slot, it.t, it.r)}" alt="">
      <span class="sn">${SLOTS[slot].name}${it.lv ? ' +' + it.lv : ''}</span><span class="sv">${statText(main.k, main.v)}</span></button>`;
  }
  h += '</div>';
  h += `<div class="row small">${icon('scrap', '')}<span><b>${fmt(S.scrap)}</b> scrap · bag ${S.gear.bag.length}/${BAG_SIZE}</span></div>
    <div class="mbtns"><button class="btn small" data-act="salvageBelow" data-r="1">Salvage Commons</button>
    <button class="btn small" data-act="salvageBelow" data-r="2">Salvage Commons + Rares</button></div>`;
  if (!S.gear.bag.length) {
    h += '<div class="card muted small">Your bag is empty. Open cases to find pickaxes, helmets and charms. Compare the numbers and equip the best ones.</div>';
  } else {
    h += '<div class="baggrid">';
    for (const it of S.gear.bag) {
      h += `<button class="bagtile rc${it.r}" data-act="item" data-id="${it.id}" aria-label="${RARITY[it.r].name} ${itemName(it)}">
        <img src="${gearUrl(it.slot, it.t, it.r)}" alt=""><span class="tr">T${it.t}</span>${it.lv ? `<span class="lv">+${it.lv}</span>` : ''}${it.isNew ? '<span class="new">NEW</span>' : ''}</button>`;
    }
    h += '</div>';
  }
  return h;
}

function partyBonusText() {
  const add = {};
  for (const p of S.pets.eq) for (const k in PETS[p.sp].stats) add[k] = (add[k] || 0) + PETS[p.sp].stats[k] * PET_POWER[p.r];
  const parts = Object.entries(add).map(([k, v]) => statText(k, v));
  return parts.length ? parts.join(', ') : 'none yet';
}

function petsViewHtml() {
  const slots = petSlots();
  let h = `<div class="card"><h3>Party ${S.pets.eq.length}/${slots}</h3><div class="petslots">`;
  for (let i = 0; i < 4; i++) {
    if (i >= slots) {
      h += `<div class="petslot lockedslot"><small>Prestige ${i === 2 ? 1 : 3}</small></div>`;
      continue;
    }
    const p = S.pets.eq[i];
    if (!p) {
      h += '<div class="petslot"><small>Empty</small></div>';
      continue;
    }
    h += `<button class="petslot full rc${p.r}" data-act="unequipPet" data-i="${i}" aria-label="Send ${PETS[p.sp].name} back">
      <img src="${petUrl(p.sp)}" alt=""><small>${RARITY[p.r].name}</small></button>`;
  }
  h += `</div><div class="small muted" style="margin-top:6px">Party bonus: ${partyBonusText()}. Tap a party pet to send it back.</div></div>`;
  const merges = mergeablePets();
  h += `<div class="row"><div class="grow small muted">Merge 3 of the same pet and rarity into 1 of the next rarity.</div>
    <button class="btn good small" data-act="mergeAll" ${merges ? '' : 'disabled'}>Merge all</button></div>`;
  h += '<div class="petgrid">';
  let any = false;
  for (const sp of PET_IDS) {
    const inv = S.pets.inv[sp];
    if (!inv.some(n => n > 0)) continue;
    any = true;
    h += `<div class="card petrow"><div class="pic"><img src="${petUrl(sp)}" alt=""></div><div>
      <b>${PETS[sp].name}</b> <span class="small muted">${petBonusText(sp, 0)} at Common</span><div class="chips">`;
    for (let r = 0; r < 5; r++) {
      if (!inv[r]) continue;
      const eqn = petEquippedCount(sp, r);
      const canMerge = r < 4 && inv[r] - eqn >= 3;
      h += `<button class="pchip rc${r} ${eqn ? 'eq' : ''}" data-act="pet" data-sp="${sp}" data-r="${r}">${RARITY[r].name} ×${inv[r]}${canMerge ? ' · merge' : ''}</button>`;
    }
    h += '</div></div></div>';
  }
  if (!any) h += '<div class="card small muted">No pets yet. About 3 in 10 case drops are pets, and they follow you into the mine.</div>';
  h += '</div>';
  return h;
}

function indexViewHtml() {
  const n = collectionCount();
  let h = `<div class="card small">Found <b>${n}/45</b>. Each entry adds +1% damage and coins forever (now ${fmtPct(n * COLLECTION_BONUS)}).</div>`;
  h += '<div class="h3">Pets</div>';
  for (const sp of PET_IDS) {
    h += '<div class="index">';
    for (let r = 0; r < 5; r++) {
      const got = S.coll[`pet:${sp}:${r}`];
      h += `<div class="rc${r} ${got ? 'got' : ''}" title="${got ? RARITY[r].name + ' ' + PETS[sp].name : '???'}"><img src="${petUrl(sp, !got)}" alt=""></div>`;
    }
    h += '</div>';
  }
  h += '<div class="h3">Gear</div>';
  for (const slot of SLOT_IDS) {
    h += '<div class="index">';
    for (let r = 0; r < 5; r++) {
      const got = S.coll[`gear:${slot}:${r}`];
      h += `<div class="rc${r} ${got ? 'got' : ''}" title="${got ? RARITY[r].name + ' ' + SLOTS[slot].name : '???'}"><img src="${gearUrl(slot, Math.min(5, r + 1), r, !got)}" alt=""></div>`;
    }
    h += '</div>';
  }
  return h;
}

function showItem(id) {
  const f = findItem(id);
  if (!f) return;
  const it = f.it;
  it.isNew = false;
  const lines = itemStats(it).map(s => `<div class="statline"><span>${STATS[s.k].name}</span><b>${statVal(s.k, s.v)}</b></div>`).join('');
  const eq = S.gear.eq[it.slot];
  let cmp = '';
  if (f.where === 'bag' && eq) {
    cmp = `<div class="card"><div class="small muted">Equipped: <span class="tc${eq.r}">${RARITY[eq.r].name} ${itemName(eq)}${eq.lv ? ' +' + eq.lv : ''}</span></div>`
      + itemStats(eq).map(s => `<div class="statline small"><span>${STATS[s.k].name}</span><span>${statVal(s.k, s.v)}</span></div>`).join('') + '</div>';
  }
  const rc = reforgeCost(it);
  const maxed = it.lv >= MAX_ITEM_LEVEL;
  let actions = '';
  if (f.where === 'bag') actions += `<button class="btn good" data-act="equipItem" data-id="${it.id}">Equip</button>`;
  actions += `<button class="btn" data-act="reforge" data-id="${it.id}" ${maxed || S.scrap < rc ? 'disabled' : ''}>${maxed ? 'Max level' : `Reforge +1 ${costHtml(rc, 'scrap')}`}</button>`;
  if (f.where === 'bag') actions += `<button class="btn bad" data-act="salvage" data-id="${it.id}">Salvage +${scrapValue(it)}</button>`;
  else actions += `<button class="btn" data-act="unequip" data-slot="${it.slot}">Unequip</button>`;
  actions += '<button class="btn" data-act="close">Close</button>';
  openModal(`<div class="result"><div style="text-align:center"><img src="${gearUrl(it.slot, it.t, it.r)}" alt="" style="width:64px;image-rendering:pixelated"></div>
    <div class="rname tc${it.r}">${RARITY[it.r].name} ${itemName(it)}${it.lv ? ' +' + it.lv : ''}</div>
    <div class="rsub">Tier ${it.t} · ${wearHtml(it)}</div>
    ${lines}<div class="rsub">Reforging adds +10% to every stat (max +${MAX_ITEM_LEVEL}).</div></div>${cmp}
    <div class="mbtns">${actions}</div>`, { dismissable: true });
}

function showPet(sp, r) {
  const n = S.pets.inv[sp][r];
  const eqn = petEquippedCount(sp, r);
  const avail = n - eqn;
  const canAdd = avail > 0 && S.pets.eq.length < petSlots();
  const canMerge = r < 4 && avail >= 3;
  openModal(`<div class="result"><div style="text-align:center"><img src="${petUrl(sp)}" alt="" style="width:64px;image-rendering:pixelated"></div>
    <div class="rname tc${r}">${RARITY[r].name} ${PETS[sp].name}</div>
    <div class="rsub">${petBonusText(sp, r)}</div>
    <div class="rsub">You own ${n}${eqn ? `, ${eqn} in your party` : ''}${r < 4 ? `. Merge 3 into a ${RARITY[r + 1].name} (${petBonusText(sp, r + 1)}).` : '.'}</div></div>
    <div class="mbtns">
      <button class="btn good" data-act="petToParty" data-sp="${sp}" data-r="${r}" ${canAdd ? '' : 'disabled'}>${S.pets.eq.length >= petSlots() ? 'Party full' : 'Add to party'}</button>
      ${r < 4 ? `<button class="btn purple" data-act="mergePet" data-sp="${sp}" data-r="${r}" ${canMerge ? '' : 'disabled'}>Merge 3</button>` : ''}
      <button class="btn" data-act="close">Close</button></div>`, { dismissable: true });
}

// ---------- quests ----------
function dailyIcon(rw) {
  if (rw.keys) return 'key';
  if (rw.coinMinutes) return 'coin';
  if (rw.scrap) return 'scrap';
  if (rw.boostMinutes) return 'bolt';
  return 'star';
}

function achRow(a, state) {
  return `<div class="ach ${state}"><div><div class="an">${a.name}</div><div class="ad">${a.desc} · ${plural(a.keys, 'key')} + 2% power</div></div>
    ${state === 'ready' ? `<button class="btn gold small" data-act="claimAch" data-id="${a.id}">Claim</button>` : state === 'claimed' ? '<span class="small muted">Done</span>' : ''}</div>`;
}

// The tab is rebuilt whenever something claimable changes (see refreshQuests), so progress,
// Claim buttons and freshly unlocked achievements never go stale while the player watches.
function questsSignature() {
  const c = claimableCounts();
  return [S.daily.day, S.daily.claimed, S.daily.streak, S.quests.day, S.quests.bonus,
    S.quests.list.map(q => `${q.prog}/${q.claimed ? 1 : 0}`).join(','), c.ach, S.trophies].join('|');
}

function refreshQuests() {
  const sig = questsSignature();
  if (sig !== UI.questsSig) buildQuests();
}

function buildQuests() {
  UI.questsSig = questsSignature();
  const streak = Math.max(1, S.daily.streak);
  const cur = (streak - 1) % 7;
  const week = Math.floor((streak - 1) / 7);
  let h = `<div class="card"><h3>Daily login · ${plural(streak, 'day')} in a row</h3><div class="days">`;
  for (let i = 0; i < 7; i++) {
    const rw = DAILY_REWARDS[i];
    const cls = i < cur || (i === cur && S.daily.claimed) ? 'done' : i === cur ? 'today' : '';
    h += `<div class="day ${cls}"><b>Day ${i + 1}</b>${icon(dailyIcon(rw), '')}<span>${dailyRewardLabel(week * 7 + i + 1)}</span></div>`;
  }
  h += '</div><div style="margin-top:8px">';
  if (S.daily.claimed) h += '<div class="small muted">Come back tomorrow to keep your streak. Missing a day resets it to Day 1.</div>';
  else h += `<button class="btn gold wide" data-act="claimDaily">Claim day ${cur + 1}: ${dailyRewardLabel(streak)}</button>`;
  h += '</div></div>';

  h += '<div class="card"><h3>Daily quests</h3><div class="list">';
  S.quests.list.forEach((q, i) => {
    const def = QUEST_INDEX[q.id];
    const done = q.prog >= q.target;
    h += `<div class="quest"><div><div class="small">${def.text(q.target)}</div>
      <div class="bar"><i style="width:${Math.min(100, (q.prog / q.target) * 100)}%"></i></div>
      <div class="small muted">${fmt(q.prog)}/${fmt(q.target)} · 2 keys + 25 scrap</div></div>
      ${q.claimed ? '<span class="small muted">Done</span>' : `<button class="btn small ${done ? 'gold' : ''}" data-act="claimQuest" data-i="${i}" ${done ? '' : 'disabled'}>Claim</button>`}</div>`;
  });
  h += '</div><div style="margin-top:8px">';
  if (S.quests.bonus) h += '<div class="small muted">Daily chest opened. New quests arrive at midnight.</div>';
  else h += `<button class="btn purple wide" data-act="questBonus" ${questBonusReady() ? '' : 'disabled'}>Claim all 3 to open an Epic+ crate</button>`;
  h += '</div></div>';

  const ready = ACHIEVEMENTS.filter(a => S.ach.done[a.id] && !S.ach.claimed[a.id]);
  const open = ACHIEVEMENTS.filter(a => !S.ach.done[a.id]);
  const claimed = ACHIEVEMENTS.filter(a => S.ach.claimed[a.id]);
  h += `<div class="card"><h3>Achievements · ${claimed.length}/${ACHIEVEMENTS.length}</h3>
    <div class="small muted" style="margin-bottom:6px">Each one claimed adds +2% damage and coins forever (now ${fmtPct(S.trophies * TROPHY_BONUS)}).</div><div class="list">`;
  for (const a of ready) h += achRow(a, 'ready');
  for (const a of open.slice(0, 10)) h += achRow(a, '');
  if (open.length > 10) h += `<div class="small muted">${open.length - 10} more to unlock</div>`;
  for (const a of claimed) h += achRow(a, 'claimed');
  h += '</div></div>';
  $('#tab-quests').innerHTML = h;
}

// ---------- more ----------
function settingRow(label, control, note = '') {
  return `<div class="setting"><div>${label}${note ? `<div class="small muted">${note}</div>` : ''}</div>${control}</div>`;
}
function toggleBtn(key) {
  const on = !!S.settings[key];
  return `<button class="toggle ${on ? 'on' : ''}" data-act="toggle" data-k="${key}" aria-pressed="${on}">${on ? 'On' : 'Off'}</button>`;
}
function segBtns(key, options) {
  return `<div class="seg">${options.map(([v, l]) =>
    `<button data-act="setting" data-k="${key}" data-v="${v}" class="${String(S.settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}

function buildMore() {
  const gain = prestigeGain();
  const can = canPrestige();
  const nextCase = CASES.find(c => c.prestige === S.prestiges + 1);
  let h = `<div class="card prestige-card"><h3>Prestige: collapse the mine</h3>
    <p class="small">Start over at B1 and keep your gear, pets, keys, scrap and cores. Each core adds +10% damage forever.</p>
    <div style="margin:8px 0"><div class="small muted">Deepest this run: B${S.run.maxFloor}</div>
    <div class="big">+${gain} cores</div><div class="small muted">You have ${S.cores} (+${S.cores * 10}% damage)</div></div>
    ${nextCase ? `<div class="small">Your next prestige unlocks the ${nextCase.name}.</div>` : ''}
    ${S.prestiges < 3 ? `<div class="small">Prestige ${S.prestiges < 1 ? 1 : 3} adds a pet slot.</div>` : ''}
    <button class="btn purple wide" data-act="askPrestige" ${can ? '' : 'disabled'} style="margin-top:8px">${can ? 'Prestige now' : 'Reach B25 to prestige'}</button></div>`;

  const st = S.stats;
  const tries = st.correct + st.wrong;
  const days = Object.keys(st.days).sort().slice(-7).reverse();
  h += `<div class="card"><h3>Stats</h3><div class="stats">
    <span>Played today</span><span>${fmtTime(st.days[dateKey()] || 0)}</span>
    <span>This session</span><span>${fmtTime(R.session)}</span>
    <span>Total play time</span><span>${fmtTime(st.playTime)}</span>
    <span>Deepest floor</span><span>B${st.bestFloor}</span>
    <span>Problems solved</span><span>${fmt(st.correct)}</span>
    <span>Accuracy</span><span>${tries ? ((st.correct / tries) * 100).toFixed(1) + '%' : '-'}</span>
    <span>Average answer</span><span>${st.correct ? (st.answerTime / st.correct).toFixed(2) + 's' : '-'}</span>
    <span>Fastest answer</span><span>${st.fastest ? st.fastest.toFixed(2) + 's' : '-'}</span>
    <span>Best streak</span><span>${st.bestStreak}</span>
    <span>Math level</span><span>${Math.floor(S.math.rating)} · ${MATH_TIERS[Math.floor(S.math.rating)]}</span>
    <span>Enemies defeated</span><span>${fmt(st.kills)}</span>
    <span>Bosses defeated</span><span>${fmt(st.bosses)}</span>
    <span>Cases opened</span><span>${fmt(st.cases)}</span>
    <span>Best drop</span><span>${st.bestDrop >= 0 ? RARITY[st.bestDrop].name : '-'}</span>
    <span>Biggest hit</span><span>${fmt(st.maxHit)}</span>
    <span>Coins earned</span><span>${fmt(st.coinsEarned)}</span>
    <span>Prestiges</span><span>${S.prestiges}</span></div>
    ${days.length ? `<div class="h3" style="margin-top:10px">Last 7 days</div><div class="stats">${days.map(d => `<span>${d}</span><span>${fmtTime(st.days[d])}</span>`).join('')}</div>` : ''}</div>`;

  const fixed = S.settings.mathMode === 'fixed';
  h += `<div class="card"><h3>Settings</h3>
    ${settingRow('Sound', toggleBtn('sound'))}
    ${settingRow('Vibration', toggleBtn('vibe'), 'Android only. iPhones do not allow web vibration.')}
    ${settingRow('Juice', segBtns('juice', [['low', 'Low'], ['med', 'Med'], ['high', 'High']]), 'How strong hits, freezes and particles feel.')}
    ${settingRow('Screen shake', toggleBtn('shake'))}
    ${settingRow('Answer with', segBtns('answer', [['keypad', 'Keypad'], ['choices', 'Choices']]), 'The keypad trains your brain harder.')}
    ${settingRow('Math difficulty', segBtns('mathMode', [['adaptive', 'Adaptive'], ['fixed', 'Fixed']]), fixed ? MATH_TIERS[S.settings.mathTier] : 'Gets harder as you get faster.')}
    ${fixed ? settingRow('Fixed level', `<div class="seg"><button data-act="mathTier" data-v="-1">−</button><button class="on">Lv ${S.settings.mathTier}</button><button data-act="mathTier" data-v="1">+</button></div>`) : ''}
    ${settingRow('Auto-salvage', segBtns('autoSalvage', [[0, 'Off'], [1, 'Com'], [2, 'Rare'], [3, 'Epic']]), 'Scrap new gear at or below this rarity.')}
    ${settingRow('Keep screen awake', toggleBtn('wake'), 'Handy for idling. Uses more battery.')}
    ${settingRow('Break reminder', segBtns('breakMin', [[0, 'Off'], [30, '30m'], [60, '60m'], [90, '90m']]))}
  </div>`;

  h += `<div class="card"><h3>Save</h3>
    <p class="small muted">Progress saves on this device every few seconds${CLOUD.ready ? ' and to your Claude account' : ''}. Copy a save code to back it up or move it to another phone.</p>
    <div class="mbtns" style="margin-top:8px"><button class="btn" data-act="copySave">Copy save code</button><button class="btn" data-act="showImport">Load a code</button></div>
    <textarea id="exportText" hidden readonly aria-label="Your save code"></textarea>
    <div id="importBox" hidden><textarea id="importText" aria-label="Paste a save code" placeholder="Paste a code that starts with DDH1."></textarea>
    <div class="mbtns" style="margin-top:6px"><button class="btn good" data-act="doImport">Load this save</button></div></div>
    <div class="mbtns" style="margin-top:8px"><button class="btn bad" data-act="askReset">Reset game</button></div></div>`;
  const backups = backupList();
  h += `<div class="card"><h3>Backups</h3>
    <p class="small muted">A copy of your progress is saved automatically before every game update and once a day. The newest ${BACKUP_KEEP} are kept on this device.</p>
    <div class="list" style="margin-top:8px">${backups.length ? backups.map(b => `<div class="ach"><div><div class="an">v${escapeHtml(b.version)} · ${new Date(b.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
      <div class="ad">${escapeHtml(b.reason)} · deepest B${b.floor} · ${plural(b.prestiges, 'prestige')}</div></div>
      <button class="btn small" data-act="askRestore" data-id="${b.id}">Restore</button></div>`).join('') : '<div class="small muted">No backups yet.</div>'}</div>
    <div class="mbtns" style="margin-top:8px"><button class="btn" data-act="backupNow">Back up now</button></div></div>`;
  h += `<div class="card small muted">Deep Dig Heroes v${GAME_VERSION}. Font: Jersey 10, SIL Open Font License. Works offline once it has loaded.</div>`;
  $('#tab-more').innerHTML = h;
}

// ---------- popups ----------
function showWelcomeBack(res) {
  // Earned in a run that has since been collapsed by prestige: those coins are gone with it.
  if (res.runStarted && res.runStarted !== S.run.started) return;
  const html = `<h2>Welcome back</h2>
    <p style="text-align:center">Your drill kept digging for ${fmtTime(res.capped)}${res.sec > res.capped ? ` (max ${fmtTime(ST.offlineCap)})` : ''}.</p>
    <div class="big-gain">${icon('coin', '')} +${fmt(res.coins)}</div>
    <div class="kv"><span>XP</span><span>+${fmt(res.xp)}</span><span>Enemies defeated</span><span>${fmt(res.kills)}</span><span>Offline rate</span><span>${Math.round(ST.offlineRate * 100)}%</span></div>
    <p class="small muted">Double it: answer 5 problems in a row without a mistake.</p>
    <div class="mbtns"><button class="btn purple" data-act="startBonus">Double it</button><button class="btn good" data-act="close">Collect</button></div>`;
  UI.pendingBonus = { coins: res.coins, xp: res.xp };
  openModal(html, { dismissable: true });
}

function showDailyPopup() {
  if (S.daily.claimed) return;
  const streak = Math.max(1, S.daily.streak);
  const cur = (streak - 1) % 7;
  const rw = DAILY_REWARDS[cur];
  openModal(`<h2>Day ${streak} login reward</h2>
    <div style="text-align:center">${icon(dailyIcon(rw), '')}</div>
    <div class="big-gain">${dailyRewardLabel(streak)}</div>
    <p class="small muted" style="text-align:center">${streak > 1 ? `${streak} days in a row. ` : ''}Come back tomorrow for Day ${streak + 1}. Missing a day resets the streak.</p>
    <div class="mbtns"><button class="btn gold" data-act="claimDaily">Claim</button></div>`, { dismissable: true });
}

function doClaimDaily() {
  if (S.daily.claimed) return;
  closeModal();
  UI.holdToasts = true;
  const res = claimDaily();
  if (!res || !res.drops) releaseToasts();
  if (!res) return;
  SFX.claim();
  if (res.drops) {
    UI.lastOpen = null;
    showReel(res.drops, { tier: bestCaseTier(), method: 'reward', title: 'Daily Epic+ Crate' });
  } else {
    let msg = 'Claimed ' + res.label;
    if (res.coins) msg = `+${fmt(res.coins)} coins`;
    if (res.keys) msg = `+${res.keys} keys`;
    if (res.scrap) msg = `+${res.scrap} scrap`;
    if (res.boost) msg = `2× coins for ${res.boost} minutes`;
    toast(msg, 'gold', res.keys ? 'key' : res.scrap ? 'scrap' : 'coin');
  }
  refreshAll();
}

function showBreakReminder() {
  openModal(`<h2>${fmtTime(R.session)} played</h2>
    <p style="text-align:center">You asked for a reminder. Your drill keeps earning while you're away.</p>
    <div class="mbtns"><button class="btn good" data-act="close">Keep playing</button></div>`, { dismissable: true });
}

// ---------- events from the engine ----------
on('bossDown', ({ keys, name }) => {
  if (keys) toast(`${name} defeated! +${plural(keys, 'key')}`, 'gold', 'key');
});
on('treasure', () => toast('Treasure Mole caught! +1 key', 'gold', 'key'));
on('questDone', ({ text }) => { toast('Quest complete: ' + text, 'good', 'scroll'); SFX.claim(); });
on('achievement', a => { toast('Achievement: ' + a.name, 'gold', 'trophy'); SFX.claim(); });
on('collection', ({ count }) => toast(`New index entry ${count}/45: +1% damage and coins`, 'purple index', 'star'));
on('bestFloor', ({ floor }) => {
  const u = UPGRADES.find(x => x.unlock === floor);
  if (u) toast('New Forge upgrade: ' + u.name, 'good', 'anvil');
  if (floor === 25 && S.prestiges === 0) toast('Prestige unlocked! See the More tab.', 'purple', 'core');
});
on('bossFail', () => setTicker('The boss escaped. Farm here, then tap Retry boss.', 'bad', 4000));
on('dailyAuto', res => {
  let what = res.label;
  if (res.keys) what = `+${res.keys} keys`;
  else if (res.coins) what = `+${fmt(res.coins)} coins`;
  else if (res.scrap) what = `+${res.scrap} scrap`;
  else if (res.boost) what = `2× coins for ${res.boost} minutes`;
  else if (res.drops) what = res.drops.map(d => `${RARITY[d.r].name} ${d.kind === 'pet' ? PETS[d.sp].name : itemName(d.item)}`).join(', ') + ' (see your Bag)';
  toast(`Yesterday's login reward collected for you: ${what}`, 'gold', res.keys ? 'key' : res.scrap ? 'scrap' : res.drops ? 'chest' : 'coin');
});
on('floor', () => updateFloorBar());
on('newDay', () => { if (!UI.booting) queueModal(showDailyPopup); });

// ---------- input ----------
function handleAction(el) {
  const a = el.dataset.act;
  const d = el.dataset;
  switch (a) {
    case 'close': closeModal(); break;
    case 'buyAmt': S.settings.buyAmt = d.v; buildForge(); break;
    case 'buy':
      if (buyUpgrade(d.id)) { SFX.buy(); buildForge(); updateHud(); } else SFX.error();
      break;
    case 'branch': UI.branch = d.v; buildSkills(); break;
    case 'skill': tapSkill(d.id); break;
    case 'learnSkill': doLearnSkill(d.id); break;
    case 'respec': {
      const n = respecSkills();
      toast(n ? `Refunded ${plural(n, 'point')}` : 'Nothing to refund', '');
      buildSkills();
      break;
    }
    case 'openCase': startOpen(Number(d.t), 'coins', Number(d.n)); break;
    case 'openKey': startOpen(Number(d.t), 'key', 1); break;
    case 'openFree': startOpen(bestCaseTier(), 'free', 1); break;
    case 'again': {
      const lo = UI.lastOpen;
      closeModal();
      if (lo) startOpen(lo.tier, lo.method, lo.n);
      break;
    }
    case 'bagView': if (UI.bagView === 'gear') markItemsSeen(); UI.bagView = d.v; buildBag(); break;
    case 'item': showItem(Number(d.id)); break;
    case 'equipItem':
      if (equipItem(Number(d.id))) { SFX.buy(); toast('Equipped', 'good'); }
      closeModal();
      break;
    case 'unequip':
      if (!unequipItem(d.slot)) toast('Your bag is full', 'bad');
      closeModal();
      break;
    case 'salvage': {
      const f = findItem(Number(d.id));
      if (f && f.it.r >= 2 && !d.ok) { askSalvage(f.it); break; }
      const v = salvageItem(Number(d.id));
      if (v) { SFX.coin(); toast(`+${v} scrap`, '', 'scrap'); }
      closeModal();
      break;
    }
    case 'reforge': {
      const id = Number(d.id);
      if (reforgeItem(id)) { SFX.buy(); showItem(id); } else SFX.error();
      break;
    }
    case 'salvageBelow': {
      if (!d.ok) { askSalvageBelow(Number(d.r)); break; }
      closeModal();
      const r = salvageBelow(Number(d.r));
      toast(r.n ? `Salvaged ${plural(r.n, 'item')} for ${r.total} scrap` : 'Nothing to salvage', r.n ? '' : 'bad', 'scrap');
      buildBag();
      break;
    }
    case 'pet': showPet(d.sp, Number(d.r)); break;
    case 'petToParty':
      if (equipPet(d.sp, Number(d.r))) { SFX.buy(); toast(`${PETS[d.sp].name} joined your party`, 'good'); }
      else toast('Your party is full. Send a pet back first.', 'bad');
      closeModal();
      break;
    case 'unequipPet': unequipPet(Number(d.i)); buildBag(); break;
    case 'mergePet':
      if (mergePet(d.sp, Number(d.r))) { SFX.reveal(Number(d.r) + 1); toast(`Merged into a ${RARITY[Number(d.r) + 1].name} ${PETS[d.sp].name}!`, 'purple'); }
      closeModal();
      break;
    case 'mergeAll': {
      const n = mergeAllPets();
      if (n) { SFX.reveal(2); toast(`${plural(n, 'merge')} done`, 'purple'); }
      buildBag();
      break;
    }
    case 'claimDaily': doClaimDaily(); break;
    case 'claimQuest':
      if (claimQuest(Number(d.i))) { SFX.claim(); toast('+2 keys, +25 scrap', 'gold', 'key'); }
      buildQuests();
      break;
    case 'questBonus': {
      UI.holdToasts = true;
      const drops = claimQuestBonus();
      if (!drops) releaseToasts();
      if (drops) { UI.lastOpen = null; showReel(drops, { tier: bestCaseTier(), method: 'reward', title: 'Daily Chest' }); }
      break;
    }
    case 'claimAch':
      if (claimAchievement(d.id)) { SFX.claim(); toast('Claimed! +2% damage and coins', 'gold', 'trophy'); }
      buildQuests();
      break;
    case 'askPrestige': askPrestige(); break;
    case 'doPrestige': {
      const res = doPrestige();
      if (res) UI.pendingBonus = null;
      closeModal();
      if (res) {
        SFX.levelup();
        banner('MINE COLLAPSED', `+${res.gain} CORES`, '#b76dff', 2.6);
        toast(`+${res.gain} cores. Damage is now +${S.cores * 10}%`, 'purple', 'core');
        if (res.newCase) toast(`Unlocked: ${res.newCase}`, 'gold', 'chest');
        if (res.newSlot) toast('New pet slot unlocked', 'good');
        showTab('fight');
      }
      break;
    }
    case 'toggle':
      S.settings[d.k] = !S.settings[d.k];
      if (d.k === 'wake') applyWakeLock();
      if (d.k === 'sound' && S.settings.sound) audioUnlock();
      buildMore();
      break;
    case 'setting': {
      const cur = S.settings[d.k];
      S.settings[d.k] = typeof cur === 'number' ? Number(d.v) : d.v;
      if (d.k === 'breakMin') UI.nextBreak = R.session + Number(d.v) * 60;
      if (d.k === 'answer' || d.k === 'mathMode') newProblem();
      buildMore();
      break;
    }
    case 'mathTier':
      S.settings.mathTier = clamp(S.settings.mathTier + Number(d.v), 1, 12);
      newProblem();
      buildMore();
      break;
    case 'copySave': copySave(); break;
    case 'showImport': $('#importBox').hidden = false; $('#importText').focus(); break;
    case 'doImport': doImport(); break;
    case 'askReset': askReset(); break;
    case 'backupNow':
      toast(makeBackup(JSON.parse(serialize()), 'Saved by you') ? 'Backup saved' : 'Could not save a backup on this device', '');
      buildMore();
      break;
    case 'askRestore': askRestore(d.id); break;
    case 'doRestore': doRestore(d.id); break;
    case 'doReset': doReset(); break;
    case 'startBonus':
      if (UI.pendingBonus) startBonusRound(UI.pendingBonus);
      UI.pendingBonus = null;
      closeModal();
      showTab('fight');
      break;
    default: break;
  }
  updateHud();
  updateFloorBar();
  updateBadges();
}

function askPrestige() {
  if (!canPrestige()) return;
  const gain = prestigeGain();
  const nextCase = CASES.find(c => c.prestige === S.prestiges + 1);
  openModal(`<h2>Collapse the mine?</h2>
    <div class="big-gain" style="color:var(--gambler)">+${gain} cores</div>
    <div class="kv"><span>Damage bonus</span><span>+${S.cores * 10}% → +${(S.cores + gain) * 10}%</span>
    <span>You keep</span><span>gear, pets, keys, scrap</span><span>You reset</span><span>coins, floor, Forge, level, skills</span></div>
    ${nextCase ? `<p class="small">Unlocks the ${nextCase.name}.</p>` : ''}
    ${S.prestiges === 0 || S.prestiges === 2 ? '<p class="small">Adds a pet slot.</p>' : ''}
    <div class="mbtns"><button class="btn purple" data-act="doPrestige">Prestige</button><button class="btn" data-act="close">Not yet</button></div>`, { dismissable: true });
}

function askSalvage(it) {
  openModal(`<h2>Scrap this item?</h2>
    <p style="text-align:center"><span class="tc${it.r}">${RARITY[it.r].name} ${itemName(it)}${it.lv ? ' +' + it.lv : ''}</span> turns into ${scrapValue(it)} scrap. This can't be undone.</p>
    <div class="mbtns"><button class="btn bad" data-act="salvage" data-id="${it.id}" data-ok="1">Scrap it</button><button class="btn" data-act="close">Keep it</button></div>`, { dismissable: true });
}

function askSalvageBelow(r) {
  const items = S.gear.bag.filter(it => it.r < r);
  if (!items.length) { toast('Nothing to salvage', 'bad', 'scrap'); return; }
  const total = items.reduce((a, it) => a + scrapValue(it), 0);
  const names = r > 1 ? 'Common and Rare' : 'Common';
  const leveled = items.filter(it => it.lv > 0).length;
  openModal(`<h2>Scrap ${plural(items.length, 'item')}?</h2>
    <p style="text-align:center">Every ${names} item in your bag turns into ${total} scrap. Equipped gear is safe.${leveled ? ` ${leveled} of them ${leveled === 1 ? 'is' : 'are'} reforged.` : ''} This can't be undone.</p>
    <div class="mbtns"><button class="btn bad" data-act="salvageBelow" data-r="${r}" data-ok="1">Scrap ${items.length}</button><button class="btn" data-act="close">Cancel</button></div>`, { dismissable: true });
}

function askRestore(id) {
  const b = backupList().find(x => x.id === id);
  if (!b) return;
  openModal(`<h2>Restore this backup?</h2>
    <p>v${escapeHtml(b.version)} from ${new Date(b.at).toLocaleString()}, deepest B${b.floor}.</p>
    <p class="small muted">Your current progress is backed up first, so you can switch back.</p>
    <div class="mbtns"><button class="btn good" data-act="doRestore" data-id="${b.id}">Restore</button><button class="btn" data-act="close">Cancel</button></div>`, { dismissable: true });
}

function doRestore(id) {
  const raw = loadBackup(id);
  closeModal();
  if (!raw || !raw.run) {
    toast('That backup could not be read', 'bad');
    return;
  }
  makeBackup(JSON.parse(serialize()), 'Before restoring a backup');
  loadState(raw);
  saveNow();
  newProblem();
  showTab('fight');
  toast('Backup restored', 'good');
}

function askReset() {
  openModal(`<h2>Reset everything?</h2>
    <p>This deletes your progress on this device. Copy a save code first if you might want it back.</p>
    <input type="text" id="resetConfirm" autocomplete="off" placeholder="Type RESET to confirm" aria-label="Type RESET to confirm">
    <div class="mbtns"><button class="btn bad" id="resetBtn" data-act="doReset" disabled>Reset game</button><button class="btn" data-act="close">Cancel</button></div>`, {
    dismissable: true,
    onOpen(sheet) {
      const inp = $('#resetConfirm', sheet);
      inp.addEventListener('input', () => { $('#resetBtn', sheet).disabled = inp.value.trim().toUpperCase() !== 'RESET'; });
    },
  });
}

function doReset() {
  const inp = $('#resetConfirm');
  if (!inp || inp.value.trim().toUpperCase() !== 'RESET') return;
  loadState(freshState());
  R.session = 0;
  saveNow();
  closeModal();
  newProblem();
  showTab('fight');
  toast('Fresh start. Good luck down there.', 'good');
}

function copySave() {
  const code = exportCode();
  const ta = $('#exportText');
  ta.hidden = false;
  ta.value = code;
  const fallback = () => {
    ta.focus();
    ta.select();
    toast('Select the code and copy it', '');
  };
  try {
    navigator.clipboard.writeText(code).then(() => toast('Save code copied', 'good'), fallback);
  } catch (e) {
    fallback();
  }
}

function doImport() {
  const txt = $('#importText').value;
  try {
    const obj = parseCode(txt);
    loadState(obj);
    saveNow();
    newProblem();
    toast('Save loaded', 'good');
    showTab('fight');
  } catch (e) {
    toast(e.message || 'That code did not work', 'bad');
  }
}

function bindInput() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled) {
      audioUnlock();
      handleAction(el);
      return;
    }
    const tab = e.target.closest('#tabs button');
    if (tab) {
      audioUnlock();
      showTab(tab.dataset.tab);
      return;
    }
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      audioUnlock();
      if (R.prob && !UI.modalOpen) submitAnswer(Number(choice.dataset.choice));
      return;
    }
    // Taps are handled on pointerdown. The click that follows the same press is ignored, however
    // long the finger stayed down, so a key never types twice. Keyboard and assistive-tech
    // activation have no pointerdown and still reach keyInput here.
    const key = e.target.closest('[data-key]');
    if (key) {
      if (key._pressed) { key._pressed = false; return; }
      keyInput(key.dataset.key);
    }
  });

  // Keypad on pointerdown so fast typing never waits for a click.
  $('#keypad').addEventListener('pointerdown', e => {
    const key = e.target.closest('[data-key]');
    if (!key) return;
    e.preventDefault();
    key._pressed = true;
    audioUnlock();
    key.classList.add('press');
    setTimeout(() => key.classList.remove('press'), 90);
    keyInput(key.dataset.key);
  });
  $('#keypad').addEventListener('pointercancel', () => {
    for (const k of $$('#keypad [data-key]')) k._pressed = false;
  });

  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal' && UI.modalOpts && UI.modalOpts.dismissable) closeModal();
  });

  $('#cv').addEventListener('pointerdown', e => {
    audioUnlock();
    canvasTap(e.clientX, e.clientY);
  });

  $('#fUp').addEventListener('click', () => { moveFloor(-1); updateFloorBar(); });
  $('#fDown').addEventListener('click', () => { moveFloor(1); updateFloorBar(); });
  $('#fAuto').addEventListener('click', () => { setAuto(!S.run.auto); updateFloorBar(); });
  $('#fBoss').addEventListener('click', () => { retryBoss(); updateFloorBar(); });
  $('#fFight').addEventListener('click', fightBoss);
  $('#arena').addEventListener('pointerdown', mgPointer);
  $('#fPrestige').addEventListener('click', () => { audioUnlock(); askPrestige(); });
  $('#skip').addEventListener('click', () => { audioUnlock(); skipProblem(); });

  document.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('[data-key]')) e.target.closest('[data-key]')._pressed = false;
    if (e.key === 'Escape' && UI.modalOpen && UI.modalOpts && UI.modalOpts.dismissable) { closeModal(); return; }
    if (UI.tab !== 'fight' || UI.modalOpen) return;
    if (/^\d$/.test(e.key)) { audioUnlock(); keyInput(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { keyInput('back'); e.preventDefault(); }
    else if (e.key === 'Delete') { keyInput('clear'); e.preventDefault(); }
  });
}

function initIcons() {
  for (const img of $$('img[data-icon]')) {
    const name = img.dataset.icon;
    img.src = name === 'chest' ? chestUrl(1) : iconUrl(name);
  }
}

// Called every frame with the frame time.
function uiTick(dt) {
  UI.hudT -= dt;
  if (UI.hudT <= 0) {
    UI.hudT = 0.12;
    updateHud();
    if (UI.tab === 'fight') updateFight();
  }
  UI.slowT -= dt;
  if (UI.slowT <= 0) {
    UI.slowT = 0.5;
    updateFloorBar();
    updateBadges();
    if (UI.tab === 'forge') refreshForge();
    else if (UI.tab === 'cases') refreshCases();
    else if (UI.tab === 'quests') refreshQuests();
    if (UI.modalOpen) refreshCaseButtons();
  }
  if (UI.tab === 'fight') rotateGoal(dt);
  if (S.settings.breakMin > 0 && R.session >= UI.nextBreak) {
    UI.nextBreak = R.session + S.settings.breakMin * 60;
    queueModal(showBreakReminder);
  }
}
