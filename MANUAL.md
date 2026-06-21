# iMoveChainz Bot Manual

The button-driven Discord teaching bot (football IQ for Madden/CFB): players tap a hub panel
to navigate terms, coverages, concepts, fronts, usering, and the playbook with in-game art.

> This is the operator manual (how you run and update it). `README.md` covers setup +
> how players use it; `OPENCLAW-OPERATING-GUIDE.md` is the agent-facing ops sheet;
> `data/REBUILD-STATUS.md` is the playbook-data rebuild state. History: `DEVLOG.md`.

## Problem it solves

Players in the Discord want to learn football (what a coverage is, how to beat it, how to
user a DB). The bot serves that as a tap-through hub: no slash commands, private teaching
sessions, play breakdowns with the matching in-game art.

## When to reach for it

- Shipping a change (code or data) to the live bot.
- Posting the hub panel into a new channel.
- Posting an engagement item, checking logs, or diagnosing a player-reported issue.

## Prerequisites

- The bot runs on the **t740 (always on)** — nothing to power on.
- To deploy a change: it must be **committed and pushed to GitHub first** (deploy is a
  git-checkout, not a copy).
- Local dev/validation needs Node >= 18 here; no Discord connection needed for `npm run smoke`.

## Where it runs

- Host: the t740, `/home/himkage/imovechainz-bot`, PM2 process **`imovechainz`**.
- Repo: github `ZeroDrift810/snapfire` (this folder).
- Ship changes with **`deploy imovechainz`** from this PC (fetch + reset + `npm ci` + build +
  PM2 restart). See `~/.deploy/README.md`.

## Use cases (step by step)

### 1. Ship a change (code or data)
1. Make the change here. **Always** run `npm run smoke` (validates every route/button + renders
   every card/scheme offline, no Discord needed). Don't ship a red smoke.
2. `git add <paths>` (never `-A`), commit, `git push`.
3. `deploy imovechainz` from PowerShell. It resets the t740 to origin, builds, and restarts PM2.
4. Confirm: `ssh exe "pm2 logs imovechainz --lines 30 --nostream"` shows it online with the
   expected loaded counts.

### 2. Post the hub panel to a channel (one time per channel)
1. Set `HUB_CHANNEL_ID` in `.env` (right-click the channel → Copy ID).
2. `npm run post-hub`. The buttons are stateless, so the running bot handles taps afterward —
   no re-posting. (On the host: `HUB_CHANNEL_ID=<id> npm run post-hub`.)

### 3. Post an engagement item
- `npm run autopost -- <item> [channelId]` (e.g. `term-of-the-day`, `coverage-of-the-week`,
  `beat-this-look`). Deterministic by date.

### 4. Check status / logs
- `ssh exe "pm2 status"` and `ssh exe "pm2 logs imovechainz --lines 100 --nostream"`.

### 5. Update the playbook data (the rebuild)
- The playbook text was machine-fabricated and stripped to its trustworthy foundation (play
  art + names). Before regenerating any play data, read **`data/REBUILD-STATUS.md`** and the
  **`FOOTBALL-KNOWLEDGE-CANON.md`** (the engine is the authority). Only `verified:true` entries
  carry real route/read text.

### 6. Playcall game (engine-resolved drive vs the bot)
- Players tap **🎮 Playcall** on the hub to start a private drive: they are SnapFire offense, the
  Shinobi bot defends. Each down they pick a play and a side; the bot answers with a front +
  coverage; the HimkageVision engine resolves the real matchup, the grader scores it from the
  geometry (box count, blocks, pressure) + the canon concept/coverage tags, and a **live diagram of
  that exact matchup** is rendered (engine SVG to PNG via the bundled Barlow font). No static art.
- It is in-memory (one drive per player, no database) and side-effecting, so it is handled outside
  the pure router. Validate it with `npm run smoke` (Part F plays full drives and renders diagrams)
  and balance-check the grader with `npm run sim:playcall`.
- The play engine + corpus are vendored at **`engine/`** (from `../HimkageVision`). To re-sync after
  a HimkageVision data change: there run `node build-data.js`, then copy `play-engine.core.js` +
  `play-data.js` into `engine/`. Fonts live in `engine/fonts/` (OFL Barlow, shipped in the repo).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "This interaction failed" for a player | Likely a stale registered slash command (the bot is button-only). Deregister via an empty `PUT` to Discord's commands API. (Caused this once; see DEVLOG 2026-06-12.) |
| A play's reads look wrong / made up | The old scheme text was fabricated and stripped; only the play art + verified entries are trustworthy. See `data/REBUILD-STATUS.md`. |
| Host is behind after editing | Deploy is git-based: commit + push, then `deploy imovechainz`. Editing the host directly gets wiped by the next deploy. |
| Data edit not live | Knowledge loads once at boot; a restart is required (`deploy` handles it). |
| Buttons on an old panel do nothing | Their customIds predate a rewrite; re-post the hub (`npm run post-hub`). |

## Related

- Playcall game (beta build doc): `docs/playcall-beta.md`.
- Setup + player flow: `README.md`. Agent ops: `OPENCLAW-OPERATING-GUIDE.md`.
- Data truth + rebuild: `data/REBUILD-STATUS.md`, `../FOOTBALL-KNOWLEDGE-CANON.md`.
- History: `DEVLOG.md`. Cross-session (for Claude): `imovechainz-bot-data` memory.
- Deploy tool: `~/.deploy/README.md`.
