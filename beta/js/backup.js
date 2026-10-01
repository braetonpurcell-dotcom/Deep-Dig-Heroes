'use strict';
// Automatic save backups on this device: one before every game update and one per day.

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
