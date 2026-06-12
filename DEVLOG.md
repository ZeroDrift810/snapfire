# DEVLOG — iMoveChainz Bot (snapfire)

Append-only record of non-trivial fixes, decisions, and gotchas. Newest on top.

## STANDING GOTCHAS

- **Scheme lookup is by `name`, and names are NOT unique.** 122 of the 890 scheme names are duplicates (e.g. `snapfire_power_read` exists 5 times across formations). `schemeDetail` and `getSchemeByName` return the FIRST match, so duplicate-named entries beyond the first are unreachable in the detail view. Any future per-formation content needs unique slugs first.
- **Removing a command surface does not remove it from Discord.** Registered application commands persist until an explicit empty `PUT` to the API. The button-only rewrite (de9d400) left `/concept`, `/coverage`, `/scheme` registered globally for 5 days; every use surfaced as "This interaction failed" with nothing in the bot logs (the router silently ignores non-button interactions by design).
- **Knowledge data loads once at boot.** Data edits in `data/*.json` and `content/*.json` need a restart (the `deploy` tool handles this).
- **Deploy is `git reset --hard`.** Host-local edits (OpenClaw touches `OPENCLAW-OPERATING-GUIDE.md`, `recap.txt`) get wiped. Back up to `~/host-edit-backups/` on the host before deploying if they matter.
- The scheme route/read data in `data/Scheme_Knowledge.json` was machine-generated and is NOT uniformly trustworthy. Verify against sourced transcripts (`C:\iMoveChainz\knowledge\transcripts\`) before treating an entry as truth.

---

## 2026-06-12 — Power Read family was fabricated RPO data; stale slash commands caused interaction failures  [data, discord]
**Symptom:** Power Read rendered with a slant pass option ("if he stays in box, throw slant"); players also hit "This interaction failed" with zero errors in the bot logs.
**Root cause:** Two separate issues. (1) All 7 power-read scheme entries (5x Power Read, Jet Power Read, Escort Power Read Toss) plus 3 Concept entries carried invented RPO content; Power Read is a run-run option (inverted veer): unblocked end man is the read key, crash = give the sweep/jet/toss, sit = QB power keep through the B gap. (2) The Jun 7 button-only rewrite removed all slash handling but never deregistered `/concept`, `/coverage`, `/scheme` from Discord, so they sat in the picker failing on every use.
**Fix:** Rewrote the 10 entries from the sourced gap-scheme transcript (`knowledge/transcripts/Power.txt`); renamed concepts "Power Read RPO" -> "Power Read (Inverted Veer)" and "Jet Power Read RPO" -> "Jet Power Read", family RPO -> RUN (commit 1e8470d, deployed). Wiped global commands via `PUT []`, verified the only guild (1453638779276361770) had none. Reposted hub + operator hub panels, deleted the superseded Jun 6 panel messages.
**Files:** `data/Scheme_Knowledge.json`, `data/Concept_Knowledge.json`.
**Gotcha:** Both standing gotchas above came from this: deregister commands when removing a surface, and treat machine-generated scheme data as unverified until checked against a transcript.
