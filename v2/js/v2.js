'use strict';
// Test copy only (made by tools/beta.js, never promoted to the live game).
// Every save key gets a "ddh-v2:" prefix, so this copy can't read or overwrite the real save.
(function () {
  const P = 'ddh-v2:';
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
    window.DDH_TEST_RECOPY = () => {
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
  tag.textContent = 'V2';
  tag.setAttribute('style', 'position:fixed;left:50%;top:0;transform:translateX(-50%);z-index:50;font:11px sans-serif;color:#62c9ff;opacity:.85;padding:2px 6px');
  tag.title = 'Tap to copy your real save into this test copy again';
  tag.addEventListener('click', () => {
    if (!confirm('Replace your V2 progress with a fresh copy of your real save? (Your real save is not changed.)')) return;
    window.removeEventListener('pagehide', saveNow);
    document.removeEventListener('visibilitychange', onVisibility);
    if (window.DDH_TEST_RECOPY && window.DDH_TEST_RECOPY()) location.reload();
    else alert('No real save found on this phone.');
  });
  document.body.appendChild(tag);
});
