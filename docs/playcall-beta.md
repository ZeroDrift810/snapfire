# Playcall — Beta Build Document

**Status:** Beta (v0.1)
**Build:** `main` @ `b8b5e48`
**Date:** 2026-06-21
**Host:** t740 (PM2 `imovechainz`), live.

A button-driven football play-calling game inside the iMoveChainz teaching bot. You call plays against
the bot, the **HimkageVision play engine** resolves the real matchup, and a **live animated diagram** of
that exact snap is drawn for you. Outcomes are graded from the actual football geometry the engine
produces, not from a hand-written table of made-up numbers.

> Read order: this is the beta status + design doc. `MANUAL.md` is how to run/update the bot;
> `DEVLOG.md` has the build history + gotchas; `src/playcall/` is the code.

---

## 1. What it is (and why it is different)

Most "play call" mini-games roll a fixed matrix of invented outcomes. This one is **engine-resolved**:

- The same engine that powers the HimkageVision telestrator (49 fronts, 43 formations, 12 run schemes,
  26 pass concepts, 7 coverages, 455 real plays) resolves your call against the front + coverage that
  was actually called: who blocks whom, which gaps are sealed, which zones are vacated, who comes free.
- The **grader reads that geometry** (box count, double-teams and unblocked defenders at the point of
  attack for runs; free rushers the protection missed for passes) plus the **canon matchup tags** from
  the verified corpus (a concept's `beats` / `beaten_by` coverages) to set an expected value + variance
  + event chances, then rolls it.
- Nothing about the football is fabricated. Every input is a measurement of the engine's output or a tag
  from the canon (`FOOTBALL-KNOWLEDGE-CANON.md`).

This is the same principle as the bot's data rebuild: the engine is the authority, not invented text.

---

## 2. How to play

Tap **🎮 Playcall** on the hub. Pick a side:

### Offense (SnapFire)
1. **Call your play** from the menu (5 runs, 5 passes).
2. **Pick a side** (Left / Right).
3. The Shinobi bot answers with a front + coverage, the engine resolves it, and you get the result +
   the animated diagram. Field position and downs advance.
4. Move the chains and **score** before the drive dies (turnover or downs).

### Defense (Shinobi)
1. The SnapFire bot has the ball. **Call your defense** (front + coverage) from the menu (one tap, no
   direction).
2. The engine resolves the bot's play vs your call. You **win by forcing stops and takeaways** before
   they score.

A drive is one possession: 1st & 10 at your own 25, real field position and downs, ends on
touchdown / turnover (interception, fumble) / turnover on downs / safety.

---

## 3. What you see (visuals)

Every resolved snap renders a **live animated GIF** of the exact matchup, in the HimkageVision house
style (green turf, navy offense, maroon defense with technique labels, white T-cap blocks, orange
pullers, cyan stalk blocks, red ball-carrier, yellow coverage drops, ball flight). Nothing is pre-baked.

Decorated with the real drive state:

- **Numbered yard lines** at the correct positions for the snap (10-20-30-40-50-40...).
- The blue **line of scrimmage** and a yellow **first-down line**.
- The **end zone** band when the opponent goal is in view.
- A slam-in **event banner** on the finish: `TOUCHDOWN`, `FIRST DOWN`, `BIG PLAY`, `SACK`, `STUFFED`,
  `INTERCEPTED`, `FUMBLE`, `TURNOVER ON DOWNS`, `SAFETY` (color-coded).

---

## 4. The catalog (beta hands)

A tight, legible deck on each side (the tabletop-football model). Every entry maps to real engine keys.

**SnapFire offense (10):** Inside Zone, Power O, Outside Zone, Counter GT, Read Option (runs);
Four Verticals, Mesh, Smash, Flood, Slants (passes).

**Shinobi defense (8):** Cover 3 Base, Cover 2, Quarters, Cover 1 Robber, Cover 6, A-Gap Fire (blitz),
Bear Zero (blitz), Prevent.

The bot picks the other side with a down/distance-aware, disguised AI (blitz on passing downs, load the
box in short yardage, soften on long-and-late).

---

## 5. Architecture

```
engine/                         vendored HimkageVision engine (canon source of truth)
  play-engine.core.js           resolver + SVG renderer (CommonJS, no build step)
  play-data.js                  corpus (fronts/formations/schemes/coverages/concepts/plays)
  fonts/PlayartSans*.ttf        Barlow (OFL), bundled for deterministic headless text
src/playcall/
  engine.ts     typed adapter + geometry analysis (box count, free rushers, POA leverage)
  grade.ts      engine-resolved outcome model (the heart) — injectable RNG
  catalog.ts    the offense/defense hands + the bot AIs
  field.ts      broadcast field overlay (yard numbers, LOS, first-down line, end zone) + event banners
  render.ts     engine SVG -> animated GIF (resvg per frame + gifenc), cached
  game.ts       in-memory drive state machine (both modes, shared applyPlay)
  views.ts      ViewPayload builders (start chooser, per-down view, drive-over)
  handler.ts    imc:pc:* dispatch (deferred-then-editReply so the ~2s render never trips Discord)
```

Key decisions:

- The engine is **required at runtime from `engine/`** (repo root), not compiled into `dist/`, exactly
  like `data/` and `content/` are read, so it survives `tsc`.
- Diagrams are rendered live with `@resvg/resvg-js` + a **bundled Barlow font** (`loadSystemFonts:false`)
  so headless hosts render text identically.
- The handler **defers the interaction** (instant ack) before rendering, then `editReply`s the GIF, so a
  ~1.7s render can never fail Discord's 3-second response limit.
- State is **in-memory** (one drive per user). No database; fits the lean bot.

---

## 6. Verification

- `npm run smoke` — walks the whole bot graph and, in Part F, plays full drives in **both modes** and
  renders a live diagram for every snap (all payloads validated to Discord's form rules).
- `npm run sim:playcall` — rolls the grader 4000x per matchup and prints average yards / explosive% /
  turnover% / sack%. The matrix is football-correct: e.g. Four Verticals ~10 yds vs Cover 3 (canon
  beats) but ~3.7 vs Quarters (canon beaten_by); quick game eats pressure while shots get sacked; runs
  are walled by Bear Zero and pop vs Prevent; Read Option beats the loaded box.

---

## 7. Known limitations (beta)

- **Solo vs the bot only.** No player-vs-player yet (the resolution path is built to drop PvP in: swap
  the bot pick for a second player's pick).
- **One drive at a time.** No quarters, no clock, no game score across drives, no special teams
  (punt / field goal / kickoff), no two-minute logic.
- **Curated hands**, not the full 455 plays / 49 fronts. The engine supports them; the game exposes a
  tuned subset for legibility.
- **No persistence / stats.** Drives live in memory and are lost on restart; no win/loss record or
  leaderboard yet.
- **No roster integration.** Outcomes use scheme/coverage geometry, not real player ratings (the bot has
  no league DB). Diagrams use generic position labels.
- **Not yet QA'd by tapping in live Discord** by the author. Verified offline (smoke, sim, visual
  spot-checks) and confirmed a clean live boot. Tester feedback wanted on the real interaction loop.

---

## 8. Roadmap (post-beta candidates)

1. **PvP**: two players, simultaneous secret pick, same engine resolution.
2. **Persistence + stats**: drive history, W/L, a leaderboard, an Elo/skill rating.
3. **Full game**: quarters, clock, score across possessions, special teams (the fake/kick sub-game).
4. **Big Action cards**: a limited hand of momentum cards (audible, play-action, broken tackle) for a
   resource-management layer.
5. **Wider catalog** and **formation x concept layering** (pick formation, then concept) for depth.
6. **Roster-aware outcomes** if/when a league data source is wired in.

---

## 9. Beta testing + feedback

- Play several drives on **each** side. Watch for: a result that does not match the diagram, a field
  number that looks wrong for the spot, a banner that misfires, a tap that errors or hangs, or the
  diagram failing to show.
- To watch it live while testing: `ssh exe "pm2 logs imovechainz"`.
- Balance feedback (a matchup that feels too strong/weak) is most useful with the situation
  (down/distance/spot) and the two calls. The grader is tunable in `src/playcall/grade.ts`.

---

## 10. Ops

- Ship: commit + push `main`, then `deploy imovechainz` (git reset to origin/main, `npm ci`, build, PM2
  restart). No hub re-post needed once the 🎮 Playcall button is on the posted hub.
- Re-sync the engine after a HimkageVision data change: there run `node build-data.js`, then copy
  `play-engine.core.js` + `play-data.js` into `engine/` (see `engine/README.md`).
