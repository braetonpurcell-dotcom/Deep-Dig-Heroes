# Changelog

Newest first. Each `## vX.Y.Z` section becomes a GitHub release with the game files of that exact version.
Older entries name the commit they belong to; the newest entry uses whatever commit sets that version in `js/version.js`.

## v1.7.0
- Math is gone. Fights now use the tap pad: monsters pop up on a cave wall inside a shrinking ring, and you tap them before the ring closes. Each tap is a strike and +1 combo; tap in the first half of the ring for a PERFECT (40% harder). A monster that escapes cuts your combo by 20%.
- The combo multiplies all your damage, including the miner's own swings, up to x6. The higher it is, the faster the rings close (1.6s at x1, about 0.6s at x4) and the more monsters show at once, so your multiplier settles wherever your reactions hold up.
- Active play is now far stronger than idle: in the balance sim an active player reaches about B95 in 15 minutes against B32 left idle. Golden Drill (the idle capstone) drops from x2.5 to x1.5.
- Quests and achievements are about tapping now: "Tap N monsters", "Land N PERFECT taps", higher combo goals, and new achievements for taps and for reaching x2, x3, x4.5 and x6. Old math quests are replaced on load; achievements you already claimed keep their trophies.
- Renamed for the tap pad: Power Tap (was Brain Amp), Quick Hands, Tap strike; Iron Mind now softens escapes; Overdrive lands a MEGA strike every 25th tap. The "Double it" bonus round is 20 taps in a row without an escape.

## v1.6.0
- Pets merge all the way to Singularity. Up to Mythic it still takes 3 copies; past that each step takes more: 5 Mythic make an Exotic, then 7, 9, 11, 13 and 15.
- Auto-salvage can be set to any rarity, from Commons up to "Eclipse and below" (in More and on the auto-roll card). It never scraps an upgrade over the gear you have equipped.
- Bag tools: pick any rarity for bulk Salvage (locked items are always kept) and sort the bag by Newest, Rarity or Best by type.

## v1.5.1
- Lock button on every item (top right of the item popup). Locked items can't be salvaged, are skipped by the bulk Salvage buttons, and are never scrapped to make room in a full bag. Locked items show a small padlock in the bag.

## v1.5.0
- Six new rarities above Mythic: Exotic (1 in 500), Divine (1 in 2,500), Celestial (1 in 10,000), Cosmic (1 in 50,000), Eclipse (1 in 250,000) and Singularity (1 in 1,000,000). Their damage and coin stats are huge jumps (a Singularity pickaxe can carry a run about 15 floors past its wall), while luck and side stats only creep up so one lucky pull can't snowball.
- Every item on the case reel shows its odds, combining rarity and wear the way CS2 does: wear is picked as Factory New 3%, Minimal Wear 24%, Field-Tested 33%, Well-Worn 24%, Battle-Scarred 16%. A Divine Factory New is 1 in 83,333; a Factory New Singularity is 1 in 33 million.
- 21 materials, a new one every 10 floors of your deepest floor, so there is always a better version of every item further down. Old items keep their name and power.
- Auto-roll: opens cases back to back (about 2 a second) while the game is open, pauses in the background, scraps low rarities if you want, and stops on the rarity you pick or when coins run out.
- Cases cost half as much and the price only rises 0.5% per case instead of 3.5%, so hundreds of rolls are possible.
- Rarest pulls per slot and all-time, kept forever through prestige (Bag › Index). Every prestige also adds +10% luck.
- Honest reel: the items next to the winner are real rolls. About 1 reel in 15 shows a super-rare sliding past early, never right next to the winner.
- Rarity art: rarer items get more color. Rare+ trims, Legendary+ inlays, Mythic+ glowing outlines, Exotic+ sparkles and pulsing, Celestial+ moving multi-color sheens and names, Singularity the full rainbow. Exotic+ gear or pets give your miner an aura.
- Exotic+ pulls get a full-screen reveal, a fanfare and a long buzz, and the reel slows down more the rarer the win.
- New achievements for each new rarity, and the index grows to 99 entries.

## v1.4.0
- While a boss waits for you, your miner keeps farming that floor's regular enemies instead of standing still. Tap Fight boss whenever you're ready; the boss steps in and the duel starts. Offline earnings use the same floor.
- Gear no longer shows the raw float number. Items show their wear and what it does to their stats instead, e.g. "Factory New · +18% stats" in green or "Battle-Scarred · -15% stats" in red.

## v1.3.0
- Game feel pass based on game-feel and reward research: hits now freeze for a split second (hitstop), the screen shake is smoother, and big hits, crits and kills get stronger haptics.
- Correct answers climb a musical scale as your streak grows, with harmony on later laps. Sounds vary slightly each time so they never get stale.
- Streak ranks at 5, 10, 25, 50 and 100 with a flash, chord and buzz. Losing a streak of 3 or more plays a soft break sound.
- Bosses become ENRAGED at half health.
- Tap the mine for little fidget pops.
- New settings: Juice (Low/Med/High) and Screen shake on/off. Low turns off hitstop.

## v1.2.0
- Four brain mini-games in the mine's theme: Spark Vein (reaction time), Crystal Echo (sequence memory), Ore Code (number memory) and Ore Order (chimp test).
- Boss fights are now active duels: a boss waits until you tap Fight boss, then you play one of the mini-games. Each round you win is a big strike; three mistakes or running out of time and the boss escapes. Offline progress stops at the next boss.
- About a third of lucky ores are now runes: tap one to play a mini-game until your first mistake. Rewards grow with every round, with keys from round 4.
- Personal bests for each mini-game.

## v1.1.0
- Skills: every skill shows what it does on its card. Tapping a skill selects it, and points are only spent with the Learn button.
- Scrapping asks first: the bulk Salvage buttons and scrapping an Epic or better item both need a confirmation.
- 34 bug fixes from a full review (details on issue #1): boss floors can't trap you in Farm mode, offline earnings are no longer lost or over-paid, damaged saves can't freeze the game, a full bag no longer scraps rare drops, case prices stay current, the keypad fits small screens and sideways phones, and more.
- Your progress is backed up automatically before every game update and once a day. Restore any of the last 15 backups from More → Backups.
- Added a "Back up now" button.
- The More tab shows the game version.
- Every version of the game is saved on GitHub as its own release.

## v1.0.1
Commit: 13554a9
- New font (Jersey 10) so numbers are easy to read. The old font drew 5 almost like S.

## v1.0.0
Commit: f1460c0
- First release.
