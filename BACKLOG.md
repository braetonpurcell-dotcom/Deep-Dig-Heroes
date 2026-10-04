# Backlog

Ideas parked to come back to. Newest first.

## Pace of new islands and prestige at high prestige counts (parked 2026-10-04)

Brachell wants the mid and late game to move faster: new islands should arrive sooner, and prestiging
at higher prestige counts should come around sooner.

- Two play styles to balance for: Tropical prestiges again and again as soon as it is allowed, while
  Brachell pushes until hitting the power wall before prestiging.
- Look at both with the sim (`tools/playtest/sim.js`: `stallSec` for the wall-pusher, an early
  `prestigeAt` for the spammer) and the players' telemetry.
- Since V2 dev.26 each island is 100 floors (its own cave) and you sail between them, so island
  pacing is now one island per 100 floors.
- Questions to answer: how long each island takes to reach for each style, how the prestige
  requirement grows with prestige count, and whether spamming beats pushing or the other way round.
- Brachell's rule for the fix: the deeper you push before prestiging, the bigger the reward should be.
  Working hard on a run should pay more than quick resets (for example, prestige rewards that grow
  faster than linearly with the depth reached past the prestige requirement).

## Island customization (2026-10-04)

Started in V2 dev.26: an armor stand (shows an outfit) and a doghouse (a pet sits outside) by your house.
The goal is letting players decorate their whole island: more pieces, and placing them where they like.

## Next art pass: the rest of the game at the 24px look (2026-10-04)

The miner, the outfits and the pets are drawn at 24px (Game Boy Color style) as of V2 dev.25. Still at
the old size: monsters and bosses, rocks and ores, gear and UI icons, the cave scenery, and the
island buildings. Bring them up to match so the whole game shares one look.
