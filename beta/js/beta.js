'use strict';
// Test copy only (made by tools/beta.js, never promoted to the live game).
// Every save key gets a "ddh-beta:" prefix, so this copy can't read or overwrite the real save.
(function () {
  const P = 'ddh-beta:';
  const proto = Storage.prototype;
  const get = proto.getItem, set = proto.setItem, del = proto.removeItem;
  const mine = s => { try { return s === window.localStorage; } catch (e) { return false; } };
  proto.getItem = function (k) { return get.call(this, mine(this) ? P + k : k); };
  proto.setItem = function (k, v) { return set.call(this, mine(this) ? P + k : k, v); };
  proto.removeItem = function (k) { return del.call(this, mine(this) ? P + k : k); };
})();
// Test scores stay off the real leaderboard (main.js calls sendScore by its global name).
window.addEventListener('DOMContentLoaded', () => {
  if (typeof sendScore === 'function') sendScore = async () => {};
  const tag = document.createElement('div');
  tag.textContent = 'BETA';
  tag.setAttribute('style', 'position:fixed;left:4px;bottom:4px;z-index:50;pointer-events:none;font:12px sans-serif;color:#ff6b9d;opacity:.8');
  document.body.appendChild(tag);
});
