# OpenClaw Operating Guide: iMoveChainz Bot

> For an OpenClaw agent operating this bot over SSH. Read this fully before acting.
> Fill in the placeholders (`<...>`) once, then treat the commands below as the only
> sanctioned way to operate the bot.

## What this bot is

A button-driven Discord teaching bot. There are NO slash commands. Players open a posted
hub panel and tap through seven tracks: Terms 📖, Coverages 🛡️, Concepts 📘, Fronts 🧱,
Usering 🎮, Playbook 🏈, and Situational 🎯 (Madden pressure & tactics, added 2026-06-13).
Knowledge lives in `content/*.json` (authored cards, 100 across the 6 card tracks) and
`data/` + `assets/` (schemes + play art, the Playbook track).

The newest track, **Situational** 🎯, holds Madden scheme/tactics content (disguised manual
rush, the Nickel 3-3 Odd blitz bucket, trap-2, Penny 3 High, the quarters-vs-trips checks).
It was authored from the verified football knowledge, see the canon section below.

## Football knowledge: what is trustworthy (the canon)

The project keeps a single source of truth for football facts: `FOOTBALL-KNOWLEDGE-CANON.md`
(in the parent iMoveChainz repo on the workstation, not on this host). Respect this trust
order whenever you touch content or answer a football question:

1. **The HimkageVision play engine is the declared authority** for everything it models:
   coverages (the 7 base shells), fronts, formations, routes, pass concepts, run schemes, and
   their geometry. It is executable and test-verified (5.77M checks, 0 failures). When a bot
   card and the engine disagree on something the engine models, the engine wins.
2. **Play art** (real in-game screenshots in `assets/play_art/`) is authoritative for a
   specific play's actual assignments, it beats even the engine for that one instance.
3. **Bot teaching cards** (`content/*.json`) are authoritative ONLY where the engine does not
   reach: terminology (glossary), usering technique, the coverage/concept variants the engine
   does not model, and **Madden situational tactics** (the `situational` track).
4. **Raw research** (transcripts, CSVs, PDFs) is INPUT ONLY: a lead, never a fact, until a
   human promotes it into a verified doc or a card. Never cite it as truth.

Promoted, verified knowledge lives in the parent repo's `knowledge/verified/`: the Wide 9
install and the **Madden 3-High & pressure system** (`pressure-method.md`,
`coverage-vs-trips.md`, `penny-3-high.md`). The bot's `situational` cards were
authored from those verified docs. If you are unsure whether a football claim is trustworthy,
it must trace to the engine, play art, or a verified doc, if it only lives in a raw
transcript, flag it for the human, do not post it.

**Expected, not a bug:** `data/Concept_Knowledge.json` and `data/Coverage_Knowledge.json` are
intentionally empty (the fabricated data was stripped, see `data/REBUILD-STATUS.md`); the real
concept/coverage teaching is in `content/*.json`. The boot warning "Concepts: 0, Coverages: 0"
is expected. Likewise most `data/Scheme_Knowledge.json` route/read text was stripped as
machine-fabricated, only the 10 `verified: true` schemes carry trustworthy text. Do not try to
"fix" the empty files or treat stripped scheme text as fact.

## Your role (read this first)

You (OpenClaw) are the **private operator and assistant**, NOT the public-facing bot. The
deterministic, button-driven bot is what players talk to. You feed it, run it, post for it,
and patch it, from a private/staff context. Do not insert yourself as the thing players
chat with, and never expose your shell/SSH access to a public player channel. Players tap
the bot. Only the human operator talks to you.

## Where it lives

- Host: runs **on exe-host** (the same t740 as EXE), under PM2. Deployed 2026-06-06.
- Path: `/home/himkage/imovechainz-bot`
- PM2 process name: `imovechainz` (auto-starts on boot via `pm2-himkage` systemd unit)
- Who manages it: the host shell as `himkage` (passwordless sudo). The connected Claude Code
  reaches it via `ssh exe`. EXE's own container is sandboxed (no host access), so EXE does
  NOT run these commands; it coordinates and drafts, the host operator runs the ops.
- Channels (Snap Fire): player hub + engagement `#the-lab` (1512630970371543160); ops
  `#openclaw-ops` (1512649603718058044). Use #the-lab for any test post, never a player channel.

## Remote desktop / host access

Connection and remote-desktop details are kept out of this synced doc on purpose. They live in
the operator's local access runbook (`ACCESS.md` on the workstation, gitignored), not here.

## The only commands you should run

Run these on the bot host (over SSH). Prefer the `imc-ops` wrapper if it is installed.

| Intent | Command |
|---|---|
| Type-check / compile | `npm run build` |
| Validate routing, buttons, content (offline) | `npm run smoke` |
| Restart (PM2) | `pm2 restart <name>` |
| Post the hub panel to a channel | `HUB_CHANNEL_ID=<id> npm run post-hub` |
| Post an engagement item | `npm run autopost -- <item> [channelId]` |
| Read recent logs (PM2) | `pm2 logs <name> --lines 100 --nostream` |
| Status | `pm2 status` |

## The golden rule: verify before you restart

Before ANY restart or deploy:
1. `npm run build` — must succeed (no TypeScript errors).
2. `npm run smoke` — must print `✅ PASS`. The smoke test walks every route and button,
   renders every card and scheme, verifies every "tap to learn" link resolves, and checks
   there is no slash-command surface.
3. ONLY if both pass, restart. If smoke fails, DO NOT restart. Report the exact failure
   lines back to the human and stop.

## Hard rules for any content or copy change

These are non-negotiable for this product:
- NO slash commands. The bot is button-only. Never add a slash command or copy that tells
  a user to type a slash command.
- NO placeholders. Every button must lead to real content. A dead/"coming soon" button is
  a bug the smoke test will catch.
- User-facing copy: no em dashes, never the word "AI". Teach the football, do not talk
  about the tool. (This is the teaching product's voice. Marketing is separate, see below.)
- Authored knowledge follows the canon (see "Football knowledge: what is trustworthy"
  above). Do not invent football facts. A claim must trace to the engine, play art, or a
  verified doc, if it only lives in a raw transcript, flag it for the human, do not guess.

## Posting

- Teaching hub: `npm run post-hub` (above). The buttons are stateless, so post once per
  channel; the running bot handles taps forever.
- Marketing / hype posts are a SEPARATE product from this teaching bot. Do not post the
  in-bot lesson copy as marketing. Pull marketing copy from the marketing source, and keep
  the hype voice out of the bot itself.

## Engagement autoposts

Recurring community content, built from the same `content/*.json` knowledge. Deterministic
(date-based rotation), so they stay on-message and never improvise football. Post with:

```
npm run autopost -- term-of-the-day      [channelId]
npm run autopost -- coverage-of-the-week [channelId]
npm run autopost -- beat-this-look       [channelId]
```

- **term-of-the-day** rotates a glossary term daily. **coverage-of-the-week** rotates a
  coverage weekly. **beat-this-look** poses a coverage as a challenge with a reveal button.
- The buttons deep-link the player into a private (ephemeral) teaching session, so the
  channel stays clean.
- This is your scheduled-engagement engine. You decide cadence (start light: a daily term,
  a weekly coverage, a few Beat This Look challenges a week) and which channel. You can also
  write the announcement copy around a drop. Keep the teaching voice; hype is the separate
  marketing product.
- Run these on your heartbeats/cron, or trigger them on request.

## Operator Control Hub (how requests reach you)

The human operator has a staff-only button panel in Discord. Its "delegate" buttons post
an instruction into the channel you watch (`OPENCLAW_CHANNEL_ID`), each prefixed:

```
🦞 Operator request: <what to do>
```

When you see one, do exactly that task, following all the rules in this guide (verify
before restart, approval gate for outward-facing actions, teaching voice for copy). The
panel's other buttons are "direct" actions the bot runs itself (posting engagement); you do
not need to do anything for those.

## Approval gate (outward-facing actions)

Treat these as requiring explicit human approval before you do them:
- Restarting a PRODUCTION bot instance.
- Posting to any production/player Discord channel.
- Any post to social media.

For these, draft the action (the exact command or the exact post text) and send it to the
human for a yes before executing. Routine, reversible, test-channel actions can proceed.

## If something breaks

1. Capture the error (`pm2 logs <name> --lines 100 --nostream`).
2. Reproduce locally with `npm run smoke` and `npm run build` if it is a code issue.
3. Fix, re-run smoke (must PASS), then restart.
4. Report what broke, what you changed, and the smoke result.
