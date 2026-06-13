# OpenClaw Operating Guide: iMoveChainz Bot

> For an OpenClaw agent operating this bot over SSH. Read this fully before acting.
> Fill in the placeholders (`<...>`) once, then treat the commands below as the only
> sanctioned way to operate the bot.

## What this bot is

A button-driven Discord teaching bot. There are NO slash commands. Players open a posted
hub panel and tap through six tracks (Terms, Coverages, Concepts, Fronts, Usering,
Playbook). Knowledge lives in `content/*.json` (authored) and `data/` + `assets/` (schemes
+ play art).

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
- Authored knowledge is sourced from the iMoveChainz V2 system. Do not invent football
  facts. If a fact is not in the source material, flag it for the human, do not guess.

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
