# DEVLOG — iMoveChainz Bot (snapfire)

Append-only record of non-trivial fixes, decisions, and gotchas. Newest on top.

## 2026-06-13 — New `situational` track: 7 Xando Madden-tactics teaching cards  [content, ui]
**What:** Added the first new teaching track since the rebuild began, `situational` 🎯 (orange),
for Madden pressure & tactics, so the advanced Xando Football content does not pollute the clean
fundamentals tracks. Seven cards in `content/situational.json`: Disguised Manual Rush (the "sike"),
Attack the Protection, Nickel 3-3 Odd Blitz Bucket, Nickel Edge Blitz 2 (trap-2), Penny 3-3-5 "3
High", Stubby & Seahawk vs Trips, Cover 6 Willie vs Trips/Bunch TE. Authored from the parent repo's
verified docs (`knowledge/verified/xando-*.md`), which were mined from the creator's video
walkthroughs.
**Wiring:** a new track touches three typed `Record<Track>` maps that the compiler enforces, plus
runtime lists: `src/content/cards.ts` (CardTrack, CARD_TRACKS, FILES, RESOLVE_ORDER, cards init,
cardStats), `src/ui/ids.ts` (Track, TRACKS, TRACK_LABEL/EMOJI/BLURB, FACETS, DEFAULT_FILTER,
isTrack), `src/ui/views.ts` (TRACK_COLOR, HUB_ORDER). `isCardTrack` needed no change (it is
`!== 'playbook'`, so a new card track is automatic).
**Verification:** `npm run smoke` PASS (264 routes, 990 detail pages, 319 related links, **0 dead
buttons**) and `tsc --noEmit` clean. All 7 cards' related links resolve to existing ids
(coverages, fronts, glossary, and each other).
**Files:** content/situational.json (new), src/content/cards.ts, src/ui/ids.ts, src/ui/views.ts.
**Gotcha:** Related links silently drop if the target id does not exist, the smoke test is the
only thing that flags them, so run it after any content edit. The 7 cards lifted the card total to
100 (52 terms / 12 coverages / 11 concepts / 7 fronts / 11 usering / 7 situational). Data loads
once at boot; a restart is needed for the new track to show live.

## 2026-06-12 — Stripped the fabricated playbook data down to its trustworthy foundation  [data]
**Symptom:** The playbook's route/read/strategy text was machine-generated and wrong across ~880 of 890 plays (run plays described as pass RPOs, routes that don't match the play art). The bot has no active users, so wrong data is pure liability.
**Decision (Himkage):** "Wrong data is of no use. Save what is of use, we will rebuild it right based on the foundation that remains."
**Fix:** Stripped `routes`/`reads`/`usage_notes` from the 880 unverified schemes, keeping only the trustworthy foundation (`name`, `display_name`, `system`, `formation_family`, `image_file`). Kept the 10 transcript-verified entries whole and tagged them `verified: true` (power read x5, jet power read, escort power read toss, 01 trap x3). Cleared `Concept_Knowledge.json` (267) and `Coverage_Knowledge.json` (62) to `[]`: fabricated and never rendered (slash-era dead weight; real concept/coverage teaching is in `content/*.json`). No render change needed: `schemeDetail` only adds text sections when the fields exist, so stripped plays render as title + formation + play art automatically. New `data/REBUILD-STATUS.md` documents the foundation, the verified set, and the rebuild plan (art + engine + clinic transcripts).
**Verification:** `npm run smoke` PASS: 248 routes, 983 detail pages, 890/890 play-art attachments, 0 dead buttons. Every play still navigates and shows its diagram.
**Files:** data/Scheme_Knowledge.json, data/Concept_Knowledge.json, data/Coverage_Knowledge.json, data/REBUILD-STATUS.md.
**Gotcha:** Old fabricated data is preserved in git history (pre-strip commits) as the backstop, nothing is truly lost. The play art is the ground truth for assignments; the rebuild reads it, cross-checks the HimkageVision engine, and sources the "why" from clinic transcripts. 122 duplicate scheme names must get unique slugs before per-play content lands.

## STANDING GOTCHAS

- **Scheme lookup is by `name`, and names are NOT unique.** 122 of the 890 scheme names are duplicates (e.g. `snapfire_power_read` exists 5 times across formations). `schemeDetail` and `getSchemeByName` return the FIRST match, so duplicate-named entries beyond the first are unreachable in the detail view. Any future per-formation content needs unique slugs first.
- **Removing a command surface does not remove it from Discord.** Registered application commands persist until an explicit empty `PUT` to the API. The button-only rewrite (de9d400) left `/concept`, `/coverage`, `/scheme` registered globally for 5 days; every use surfaced as "This interaction failed" with nothing in the bot logs (the router silently ignores non-button interactions by design).
- **Knowledge data loads once at boot.** Data edits in `data/*.json` and `content/*.json` need a restart (the `deploy` tool handles this).
- **Deploy is `git reset --hard`.** Host-local edits (OpenClaw touches `OPENCLAW-OPERATING-GUIDE.md`, `recap.txt`) get wiped. Back up to `~/host-edit-backups/` on the host before deploying if they matter.
- The scheme route/read data in `data/Scheme_Knowledge.json` was machine-generated and is NOT uniformly trustworthy. Verify against sourced transcripts (`C:\iMoveChainz\knowledge\transcripts\`) before treating an entry as truth.

---

## 2026-06-12 — Run-play data audit: 87 of 94 pure-run scheme entries carry fabricated pass content  [data]
**Symptom:** Power Read and 01 Trap both turned out to be invented RPO/pass-sell content; audited the rest of the playbook for the same disease.
**Root cause:** The machine-generated scheme data systematically dressed run plays in pass clothing: clear-out verticals on handoffs, "checkdown/hot" template reads, "kill to pass" audibles, wrong front guidance.
**Fix (partial):** Fixed from sourced transcripts so far: power read family (7 schemes, 3 concepts, commit 1e8470d) and 01 Trap (3 schemes, 2 concepts, commit e9f8bbc). Remaining ~84 run entries are listed by concept in the audit (biggest: Inside Zone 15, Duo 7, Read Option 6, HB Power 4, HB Stretch 3, QB Zone 3, HB Quick Base 3, plus ~40 singletons). Rewrite per concept family as transcripts land.
**Files:** `data/Scheme_Knowledge.json`, `data/Concept_Knowledge.json`.
**Gotcha:** Audit heuristic that found these: offense-only entries with pure-run display names whose routes/reads/usage_notes contain pass vocabulary. Shinobi (defense) "Trap/Slant" names are coverages and line stunts, not suspects.

## 2026-06-12 — Power Read family was fabricated RPO data; stale slash commands caused interaction failures  [data, discord]
**Symptom:** Power Read rendered with a slant pass option ("if he stays in box, throw slant"); players also hit "This interaction failed" with zero errors in the bot logs.
**Root cause:** Two separate issues. (1) All 7 power-read scheme entries (5x Power Read, Jet Power Read, Escort Power Read Toss) plus 3 Concept entries carried invented RPO content; Power Read is a run-run option (inverted veer): unblocked end man is the read key, crash = give the sweep/jet/toss, sit = QB power keep through the B gap. (2) The Jun 7 button-only rewrite removed all slash handling but never deregistered `/concept`, `/coverage`, `/scheme` from Discord, so they sat in the picker failing on every use.
**Fix:** Rewrote the 10 entries from the sourced gap-scheme transcript (`knowledge/transcripts/Power.txt`); renamed concepts "Power Read RPO" -> "Power Read (Inverted Veer)" and "Jet Power Read RPO" -> "Jet Power Read", family RPO -> RUN (commit 1e8470d, deployed). Wiped global commands via `PUT []`, verified the only guild (1453638779276361770) had none. Reposted hub + operator hub panels, deleted the superseded Jun 6 panel messages.
**Files:** `data/Scheme_Knowledge.json`, `data/Concept_Knowledge.json`.
**Gotcha:** Both standing gotchas above came from this: deregister commands when removing a surface, and treat machine-generated scheme data as unverified until checked against a transcript.
