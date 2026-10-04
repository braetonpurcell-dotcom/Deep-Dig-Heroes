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
- Each prestige needs a deeper floor: B25, then 25 + 15 x prestiges^0.8 rounded to 5 (B40, B50, B60, B70,
  B80 ... B120 at 10, B370 at 50, B620 at 100), and never less than 25 floors past your strength. Its last
  3 floors are Gate floors (monsters 1.3x / 1.69x / 2.2x health); reaching it shows PRESTIGE UNLOCKED and
  pays 3 keys + 1 per 2 prestiges. Tried and dropped: a flat strength bonus per unlock and an
  "overdrive" multiplier for floors past the gate (both made spamming or pushing run away).
- Sims (6 h, persona C): prestige-at-unlock B648, quick B896, 2-min stall B707, 5-min stall B494; idle
  players (no taps) still progress (B130-270) but much slower; one idle sim stalled at B41.
  20 h: progress slows down instead of running away (B1150-1450). Numbers cap near B2300.

## Island customization (2026-10-04)

Started in V2 dev.26: an armor stand (shows an outfit) and a doghouse (a pet sits outside) by your house.
The goal is letting players decorate their whole island: more pieces, and placing them where they like.

## Next art pass: the rest of the game at the 24px look (2026-10-04)

The miner, the outfits and the pets are drawn at 24px (Game Boy Color style) as of V2 dev.25. Still at
the old size: monsters and bosses, rocks and ores, gear and UI icons, the cave scenery, and the
island buildings. Bring them up to match so the whole game shares one look.
