'use strict';
// In-game feedback: a player name, a Feedback button, and a "Your feedback" list with replies.
// Notes are posted to a Google Form (the inbox; no keys live in this public code). Replies come
// back through feedback/replies.json in the repo, keyed by feedback id. Unsent notes wait on the
// phone and go out the next time the game is online.

// The "Deep Dig Heroes Feedback" Google Form: its public formResponse URL and question entry ids.
let FEEDBACK_FORM = {
  action: 'https://docs.google.com/forms/d/e/1FAIpQLSdQRsEDB5PyPI0UuJ6tgBSe2q3zckr_QmFoViBZXIj0rrR7ng/formResponse',
  fields: {
    id: 'entry.2041969518',
    player: 'entry.1473776147',
    type: 'entry.689527602',
    message: 'entry.1040787197',
    replyTo: 'entry.1064139938',
    info: 'entry.377246766',
  },
};

const FB_TYPES = [['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']];
const FB = { replies: {}, type: 'idea', commentOn: null };

function playerName() { return (S.profile && S.profile.name) || ''; }
function fbId() { return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }
function fbDevice() {
  const ua = navigator.userAgent;
  return /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Computer';
}
function fbInfo() { return `v${GAME_VERSION} · ${fbDevice()} · B${S.run.floor} (best B${S.stats.bestFloor}) · prestige ${S.prestiges}`; }

// ---------- sending ----------
async function postEntry(e, parentId = null) {
  if (!FEEDBACK_FORM || !navigator.onLine) return false;
  const f = FEEDBACK_FORM.fields;
  const body = new URLSearchParams();
  body.set(f.id, e.id);
  body.set(f.player, playerName() || 'Unnamed');
  body.set(f.type, e.type || 'comment');
  body.set(f.message, e.text);
  body.set(f.replyTo, parentId || '');
  body.set(f.info, fbInfo());
  try {
    // Google Forms answers without CORS headers, so the reply is unreadable; reaching it is enough.
    await fetch(FEEDBACK_FORM.action, { method: 'POST', mode: 'no-cors', body });
    return true;
  } catch (err) {
    return false;
  }
}

async function flushFeedback() {
  if (!FEEDBACK_FORM || FB.flushing) return;
  FB.flushing = true;
  let sent = 0;
  for (const item of S.feedback) {
    if (!item.sent && await postEntry(item)) { item.sent = true; sent++; }
    for (const c of item.comments) if (!c.sent && await postEntry(c, item.id)) { c.sent = true; sent++; }
  }
  FB.flushing = false;
  if (sent) { saveLocal(); if (UI.modalOpen && $('#fbList')) renderFbList(); }
}

function addFeedback(type, text) {
  const item = { id: fbId(), type, text: text.slice(0, 2000), at: Date.now(), sent: false, comments: [] };
  S.feedback.unshift(item);
  if (S.feedback.length > 50) S.feedback.length = 50;
  saveLocal();
  flushFeedback();
  return item;
}

function addComment(item, text) {
  const c = { id: fbId(), text: text.slice(0, 2000), at: Date.now(), sent: false };
  item.comments.push(c);
  saveLocal();
  flushFeedback();
}

// ---------- replies ----------
async function loadReplies() {
  try {
    const res = await fetch('../feedback/replies.json?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) FB.replies = await res.json();
  } catch (e) {
    /* offline: keep what we have */
  }
  updateFbDot();
}
function repliesFor(id) { return Array.isArray(FB.replies[id]) ? FB.replies[id] : []; }
function unreadReplies() {
  let n = 0;
  for (const item of S.feedback) n += Math.max(0, repliesFor(item.id).length - (S.fbSeen[item.id] || 0));
  return n;
}
function updateFbDot() {
  const b = $('#fbBtn');
  if (b) b.classList.toggle('has-dot', unreadReplies() > 0);
}

// ---------- screens ----------
function askName(then) {
  openModal(`<h2>What should we call you?</h2>
    <p class="small muted" style="text-align:center">Your name shows on the feedback you send, so the developer knows who said it.</p>
    <input type="text" id="fbNameInput" maxlength="20" autocomplete="nickname" placeholder="Your name" value="${escapeHtml(playerName())}">
    <div class="mbtns"><button class="btn gold" data-fb="saveName" data-then="${then || ''}">Save</button><button class="btn" data-act="close">Cancel</button></div>`,
  { dismissable: true, onOpen(sheet) { const i = $('#fbNameInput', sheet); i.focus(); } });
}

function saveName(then) {
  const v = ($('#fbNameInput').value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (!v) { toast('Type a name first', 'bad'); return; }
  S.profile.name = v;
  saveLocal();
  closeModal();
  toast(`Hi, ${v}!`, 'good');
  if (then === 'feedback') openFeedback();
  if (then === 'board') openBoard();
  if (UI.tab === 'more') buildMore();
}

function fmtWhen(t) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fbItemHtml(item) {
  const typeName = (FB_TYPES.find(t => t[0] === item.type) || [0, 'Note'])[1];
  const pending = !item.sent || item.comments.some(c => !c.sent);
  const replies = repliesFor(item.id);
  const thread = [
    ...item.comments.map(c => ({ who: playerName() || 'You', text: c.text, at: c.at, mine: true })),
    ...replies.map(r => ({ who: r.from || 'Developer', text: r.text, at: r.at ? Date.parse(r.at) : 0, mine: false })),
  ].sort((a, b) => a.at - b.at);
  return `<div class="fbitem">
    <div class="row small"><b class="grow">${typeName}</b><span class="muted">${fmtWhen(item.at)} · ${pending ? 'waiting to send' : 'sent'}</span></div>
    <div class="fbtext">${escapeHtml(item.text)}</div>
    ${thread.map(m => `<div class="fbreply ${m.mine ? 'mine' : ''}"><b class="who">${escapeHtml(m.who)}</b>${escapeHtml(m.text)}</div>`).join('')}
    ${FB.commentOn === item.id
      ? `<textarea id="fbCommentText" rows="2" maxlength="2000" placeholder="Add a comment"></textarea>
         <div class="mbtns"><button class="btn small gold" data-fb="sendComment" data-id="${item.id}">Send comment</button><button class="btn small" data-fb="cancelComment">Cancel</button></div>`
      : `<button class="btn small" data-fb="comment" data-id="${item.id}">Comment</button>`}
  </div>`;
}

function renderFbList() {
  const box = $('#fbList');
  if (!box) return;
  box.innerHTML = S.feedback.length
    ? S.feedback.map(fbItemHtml).join('')
    : '<p class="small muted">Nothing sent yet. Bugs, ideas, anything that felt slow or confusing: it all helps.</p>';
}

function openFeedback() {
  if (!playerName()) { askName('feedback'); return; }
  for (const item of S.feedback) S.fbSeen[item.id] = repliesFor(item.id).length;
  updateFbDot();
  openModal(`<h2>Feedback</h2>
    <div class="row small"><span class="grow muted">Sending as <b>${escapeHtml(playerName())}</b></span><button class="btn small" data-fb="name">Change</button></div>
    <div class="seg">${FB_TYPES.map(([k, l]) => `<button data-fb="type" data-v="${k}" class="${FB.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <textarea id="fbText" rows="4" maxlength="2000" placeholder="What happened, or what would you like?"></textarea>
    <button class="btn gold wide" data-fb="send">Send</button>
    ${FEEDBACK_FORM ? '' : '<p class="small muted">Feedback is saved on this phone and sends once the inbox is connected.</p>'}
    <div class="h3">Your feedback</div>
    <div id="fbList"></div>
    <div class="mbtns"><button class="btn" data-act="close">Close</button></div>`, { dismissable: true });
  renderFbList();
  saveLocal();
  loadReplies().then(() => { if ($('#fbList')) renderFbList(); });
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-fb]');
  if (!el || el.disabled) return;
  audioUnlock();
  const a = el.dataset.fb;
  if (a === 'open') openFeedback();
  else if (a === 'name') askName(UI.modalOpen && $('#fbList') ? 'feedback' : '');
  else if (a === 'saveName') saveName(el.dataset.then);
  else if (a === 'type') { FB.type = el.dataset.v; for (const b of $$('[data-fb="type"]')) b.classList.toggle('on', b === el); }
  else if (a === 'send') {
    const t = $('#fbText');
    const text = (t.value || '').trim();
    if (!text) { toast('Type your feedback first', 'bad'); return; }
    addFeedback(FB.type, text);
    t.value = '';
    SFX.claim();
    toast(FEEDBACK_FORM && navigator.onLine ? 'Thanks! Feedback sent.' : 'Saved. It sends when you are online.', 'good');
    renderFbList();
  } else if (a === 'comment') { FB.commentOn = el.dataset.id; renderFbList(); const c = $('#fbCommentText'); if (c) c.focus(); }
  else if (a === 'cancelComment') { FB.commentOn = null; renderFbList(); }
  else if (a === 'sendComment') {
    const item = S.feedback.find(i => i.id === el.dataset.id);
    const text = (($('#fbCommentText') || {}).value || '').trim();
    if (!item || !text) return;
    addComment(item, text);
    FB.commentOn = null;
    SFX.claim();
    renderFbList();
  }
});
window.addEventListener('online', flushFeedback);
