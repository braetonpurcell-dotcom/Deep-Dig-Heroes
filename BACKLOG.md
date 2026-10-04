# Backlog

Ideas parked to come back to. Newest first.

## Pace of new islands and prestige at high prestige counts (worked on 2026-10-04, draft `pacing-draft`)

Sims (`tools/playtest/sim.js`, personas A/C/E, styles: spam at B25, prestige after 30s/120s/300s
without a new floor) showed spamming at B25 earned more power than pushing, and runs grew from about
5 to 30+ minutes as prestiges piled up because every run re-climbed from B1. Draft fix:
- Power from a run = 0.2 x (floors past your strength)^2. Strength is powerFloors() plus 10 free
  floors. Quick resets that never get past your strength pay nothing, and twice the depth pays 4x.
- Each run starts at the first floor of the island (past Starfall, the 100-floor stretch) halfway
  between your strength and your record, so run length stays flat.
- Open: the sim's "pusher" waits 5 minutes at the wall with no progress, which no depth-based reward
  can pay for, so prestiging when progress stalls is still the fastest way. Deeper single runs do
  pay much more. Numbers cap near B2300 (1e300 health), reached after roughly 40+ hours at this pace.

## Island customization (2026-10-04)

Started in V2 dev.26: an armor stand (shows an outfit) and a doghouse (a pet sits outside) by your house.
The goal is letting players decorate their whole island: more pieces, and placing them where they like.

## Next art pass: the rest of the game at the 24px look (2026-10-04)

The miner, the outfits and the pets are drawn at 24px (Game Boy Color style) as of V2 dev.25. Still at
the old size: monsters and bosses, rocks and ores, gear and UI icons, the cave scenery, and the
island buildings. Bring them up to match so the whole game shares one look.
