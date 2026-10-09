'use strict';
// Automatic save backups: on this device, one before every game update and one per day; and off the
// phone, a copy sent to the game's private Google Sheet (see sendCloudBackup) so progress lost with the
// phone's storage (cleared site data, a new phone) can be restored.

const BACKUP_INDEX = 'ddh-backups';
const BACKUP_KEEP = 15;
const DAY_MS = 24 * 3600 * 1000;

function backupList() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_INDEX)) || [];
  } catch (e) {
    return [];
  }
}

function makeBackup(raw, reason) {
  if (!raw || !raw.run) return false;
  const list = backupList();
  const entry = {
    id: 'ddh-backup-' + Date.now(),
    at: Date.now(),
    reason,
    version: raw.gameVersion || '1.0.0',
    floor: (raw.stats && raw.stats.bestFloor) || 1,
    prestiges: raw.prestiges || 0,
  };
  try {
    localStorage.setItem(entry.id, JSON.stringify(raw));
    list.unshift(entry);
    while (list.length > BACKUP_KEEP) localStorage.removeItem(list.pop().id);
    localStorage.setItem(BACKUP_INDEX, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

// Called with the save as it was on disk, before this version touches it.
function autoBackup(raw) {
  if (!raw || !raw.run) return;
  const from = raw.gameVersion || '1.0.0';
  if (from !== GAME_VERSION) {
    makeBackup(raw, `Before update to v${GAME_VERSION}`);
    return;
  }
  const last = backupList()[0];
  if (!last || Date.now() - last.at > DAY_MS) makeBackup(raw, 'Daily backup');
}

function loadBackup(id) {
  try {
    return JSON.parse(localStorage.getItem(id));
  } catch (e) {
    return null;
  }
}

// ---------- off the phone ----------
// About once an hour of play, after every prestige, and when the game opens if the last one is more
// than 12 hours old, a copy of the save goes through the feedback form to the game's private sheet,
// tagged "backup" (only the leaderboard tab of that sheet is public). Only named players send one, so
// the copy can be found by name. The bag is trimmed to its best items to keep it within a sheet cell.
const CLOUD_BACKUP_PLAY = 3600; // seconds of play between backups
const CLOUD_BACKUP_STALE = 12 * 3600 * 1000;
const CLOUD_BACKUP_BAG = 80;
const CLOUD_BACKUP_MAX = 45000; // a Google Sheets cell holds 50,000 characters
function backupCode() {
  const o = JSON.parse(serialize());
  if (o.gear && Array.isArray(o.gear.bag) && o.gear.bag.length > CLOUD_BACKUP_BAG) {
    o.gear.bag = o.gear.bag.slice().sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || b.r - a.r || b.t - a.t).slice(0, CLOUD_BACKUP_BAG);
  }
  const json = JSON.stringify(o);
  return 'DDH1.' + b64encode(json) + '.' + hashStr(json).toString(36);
}
async function sendCloudBackup(reason) {
  if (typeof FEEDBACK_FORM === 'undefined' || !FEEDBACK_FORM || !navigator.onLine || !playerName()) return false;
  const code = backupCode();
  if (code.length > CLOUD_BACKUP_MAX) return false;
  const f = FEEDBACK_FORM.fields, body = new URLSearchParams();
  body.set(f.id, 'bk-' + Date.now().toString(36));
  body.set(f.player, playerName());
  body.set(f.type, 'backup');
  body.set(f.message, code);
  body.set(f.replyTo, '');
  body.set(f.info, reason + ' · ' + fbInfo());
  try {
    await fetch(FEEDBACK_FORM.action, { method: 'POST', mode: 'no-cors', body });
    S.cloudBk.play = 0;
    S.cloudBk.at = Date.now();
    return true;
  } catch (e) {
    return false;
  }
}
// Once a second while the game is open and visible.
function cloudBackupTick() {
  if (!S || !S.cloudBk || document.hidden) return;
  if (++S.cloudBk.play >= CLOUD_BACKUP_PLAY) sendCloudBackup('hourly');
}
function cloudBackupOnOpen() {
  if (S && S.cloudBk && S.stats.bestFloor > 1 && Date.now() - S.cloudBk.at > CLOUD_BACKUP_STALE) sendCloudBackup('opened');
}
setInterval(cloudBackupTick, 1000);
