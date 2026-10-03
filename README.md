# Deep Dig Heroes

A pixel-art idle miner for phones where tapping monsters powers your attacks. It runs fully offline once it has loaded, with no accounts, ads or network calls.

## Play it offline on your phone

**Install it like an app (recommended)**
1. Turn on GitHub Pages once: in this repo go to Settings → Pages, set Source to "Deploy from a branch", pick `main` and `/ (root)`, then Save. The first deploy takes a minute or two.
2. Open https://braetonpurcell-dotcom.github.io/Deep-Dig-Heroes/ on your phone once while you have signal.
3. Add it to your home screen. On iPhone, use Share → Add to Home Screen. On Android, use the browser menu → Install app.
4. From then on it launches with no service at all, including in airplane mode. When you're online it quietly picks up new versions.

**One file, no hosting**
Run `node tools/build-single.js deep-dig-heroes.html` and send that file to your phone (AirDrop, email, Drive). Open it from the Files app. Progress is stored in that browser only, so use **More → Copy save code** to back it up.

## How it plays

- **Dig and fight.** Your miner attacks on their own. Clear 6 enemies to go one floor deeper. Every 10th floor is a boss: tap Fight boss to duel it in a mini-game (3 lives, 45 seconds).
- **Tap strikes.** Monsters pop up on the tap pad inside a shrinking ring. Tap one before the ring closes to strike and add to your combo; tap in the first half for a PERFECT. A monster that escapes cuts the combo. The combo multiplies all damage up to ×6, and the higher it is, the faster the rings close and the more monsters show at once.
- **Forge.** Spend coins on permanent upgrades for the current run. New upgrades unlock as you go deeper.
- **Skills.** You earn 1 point per level. The tree has three branches: Brawler for active play, Tycoon for idle play and coins, and Gambler for luck and cases. Respec is free.
- **Cases.** CS2-style spinning reels drop gear and pets in 5 rarities, from Common to Mythic. Pity timers guarantee Epic+ and Legendary+ drops. Gear has float values and random substats. Compare the numbers yourself to choose a build.
- **Pets.** Pets follow you into the mine and add bonuses. Merge 3 of the same pet and rarity into 1 of the next rarity.
- **Prestige.** From B25 you can collapse the mine to earn cores, each worth +10% damage forever. Prestiging also unlocks stronger case tiers and extra pet slots.
- **Come-back rewards.** These include offline earnings (and you can double them by tapping 20 monsters in a row), a 7-day login streak, 3 daily quests, a free crate every 4 hours, 45 achievements and a 45-entry collection index.
- **Stats.** More → Stats shows play time per day. An optional break reminder is in Settings and is off by default.

## Code map

| File | What it holds |
| --- | --- |
| `js/data.js` | Tables: biomes, enemies, upgrades, skill tree, gear, pets, cases, quests, achievements |
| `js/engine.js` | Rules and formulas. Balance knobs live in `TUNE` at the top |
| `js/sprites.js` | Pixel art as text grids, built into canvases at startup |
| `js/render.js` | The 160×96 pixel scene, bitmap font, particles and screen shake |
| `js/ui.js` | HUD, tabs, the case reel and popups |
| `js/tappad.js` | The tap pad: spawning monsters, rings, hits and escapes |
| `js/minigames.js` | The four mini-games, boss duels and rune challenges |
| `js/main.js` | Boot, game loop, autosave, offline earnings and service worker |
| `js/version.js` | The game version. Bump it for every release |
| `js/backup.js` | Automatic save backups on the device |
| `sw.js` | Offline cache. List any new file here |

Saves go to `localStorage` every 5 seconds and when the app is hidden. When the game runs as a claude.ai artifact it also keeps a private copy of the save in the player's own row of the artifact's database.

`window.DDH` exposes the state and core functions for testing from the browser console.

## Versions

After changing `js/version.js`, run `node tools/stamp-version.js` so every script and stylesheet in `index.html` carries the new `?v=` and the offline cache picks up a clean set.


Every release is saved on GitHub under Releases, so any old version can be viewed or downloaded.
To ship a new version: bump `GAME_VERSION` in `js/version.js`, add a matching `## vX.Y.Z` section at the top of `CHANGELOG.md`, and bump `CACHE` in `sw.js`. When that lands on `main`, the "Save each version" workflow creates the release.

On the phone, the game backs up your progress before every update and once a day (More → Backups).

## Credits

Jersey 10 font by the Soft Type Project Authors, under the SIL Open Font License 1.1 (`fonts/OFL.txt`).

## Test copies (beta and v2)

There are three copies of the game:

| Copy | Folder | Link | What it's for |
|---|---|---|---|
| Live | root | https://braetonpurcell-dotcom.github.io/Deep-Dig-Heroes/ | What everyone plays |
| Beta | `beta/` | https://braetonpurcell-dotcom.github.io/Deep-Dig-Heroes/beta/ | The next v1 update: bug fixes and features, promoted to live when ready |
| V2 | `v2/` | https://braetonpurcell-dotcom.github.io/Deep-Dig-Heroes/v2/ | The version 2 overhaul (new UI), built in the background over time |

Beta and V2 each:

- have their own save (stored under a `ddh-beta:` or `ddh-v2:` prefix). On the first visit it starts as a copy of your real save; tap the BETA or V2 tag at the top to copy your real save in again. The real save is never changed.
- have their own offline copy and home-screen icon ("Dig BETA", "Dig V2").
- never post to the leaderboard.
- never create a release when pushed (only the root `js/version.js` and `CHANGELOG.md` do that).

Commands (the channel defaults to `beta`):

- `node tools/beta.js reset beta` (or `v2`) replaces that folder with a fresh copy of the live game.
- `node tools/beta.js pull v2 js/engine.js` copies live files into a test copy, to carry a v1 fix over into v2 (or beta). Pull only files v2 hasn't redesigned, or merge by hand.
- `node tools/beta.js promote v2` (or `beta`) copies that folder's game files over the live game; then release as usual (bump `js/version.js`, run `node tools/stamp-version.js`, add a CHANGELOG section).
- After changing a test copy's version, stamp it with `node tools/stamp-version.js beta` (or `v2`).
