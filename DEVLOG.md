# DEVLOG — iMoveChainz Bot (snapfire)

Append-only record of non-trivial fixes, decisions, and gotchas. Newest on top.

## 2026-06-19 — Phase 2: enrich teaching cards from the mined docs  [content]
**What:** Added sourced teaching to the cards the Phase-1 verified docs cover. Fronts 7 -> 16 with a
"How to use it" section (3-3-5 family, 4-2-5 Over G/Under, goal-line 6-2, Nickel 3-3 dbl-mug, from
335-defense + defense-strategy-and-fronts + pressure-method). Concepts 12 -> 22 (levels, dagger, mills,
scissors, switch, spacing, snag, post-wheel, rpo-slant, hb-screen, from offensive-foundations +
air-raid-concepts).
**Files:** content/fronts.json, content/concepts.json. tools/enrich-front-cards.js, enrich-concepts-wave2.js.
**Verification:** smoke green, 95 diagrams, 0 dead buttons.
**Gotcha:** Honesty rule, fronts/concepts with NO source keep their structural card + diagram and get
NO invented strategy. 33 fronts (4-3/3-4/dime families) and the 4 concept variants stay structural by
design, that is the correct complete state, not a gap to fabricate.

## 2026-06-19 — P1 (run): sourced coaching on 11 of 12 run cards  [content, knowledge]
**What:** Mined the zone-run-system + run-game collections (correct files this time: zone-run-system
= media-06-18-04-17-*) into knowledge/verified/run-game.md, then added faithful Coaching notes to 11
run cards (all but draw, which has no source). Deep on inside-zone/outside-zone/power/trap/read-option/
power-read; concise textbook notes for counter/duo/iso/speed-option/toss.
**Files:** content/runs.json (11 enriched).
**Verification:** smoke green, 95 diagrams, 0 dead buttons.
**Gotcha:** Honesty rule held: draw got NO notes (not in the corpus). media-06-18-04-17-05 is a
byte-for-byte duplicate of -03 (a capture dup worth cleaning later).

## 2026-06-19 — Crop diagrams to the play + drop the redundant in-art title  [content, ui]
**What:** Every card diagram was a tiny cluster in a huge empty field, and the in-art title (e.g.
"INSIDE ZONE / BANG-BEND-BOUNCE") duplicated the embed header. tools/render-diagrams.js re-renders
ALL card images (49 fronts, 7 coverages, 26 concepts, 12 runs) cropped to the union bounding box of
the token positions across the animation + route points + coverage zone-bubble extents, padded 40px,
with model.name/model.term blanked so the title band is gone. Image-only: card JSON (and the air-raid
coaching notes) untouched. tools/rasterize-diagrams.py emits PNG for fronts/coverages, looping GIF for
concepts/runs.
**Files:** assets/card_art/* (all 95 regenerated), mint-front-run-fit.png synced to the cropped mint.
**Verification:** smoke green, 95 diagrams, 0 dead buttons. Inside-zone GIF 973x700 -> 867x420 (play
fills the frame); ~13MB total card_art.
**Gotcha:** The crop bbox must include coverage zone ELLIPSES (e.bubble.rx/ry), not just token x/y, or
the deep thirds clip at the top. For animation the bbox is the UNION across all frames so the view does
not pan/zoom. Engine exposes buildModel + positionsAt for the coordinates.

## 2026-06-19 — Animated GIF diagrams on Run Game + Concept cards  [content, ui]
**What:** Converted the 12 run + 26 concept card diagrams from static PNG to animated GIF (the play
develops). The engine renderSVG(model, g) takes a progress g in [0,1]; animate-cards.js sweeps g into
frame SVGs, stitch-gifs.py rasterizes (PyMuPDF dpi 70) + Pillow stitches a looping GIF (hold the
finished play 1.2s). Fronts (static alignment) and coverages (zone-bubble still reads best) stay PNG.
**Files:** content/runs.json + content/concepts.json (image .png->.gif), assets/card_art/{run,concept}-*.gif
(38 new; the .png removed), src/ui/views.ts (attach honors the file extension so a .gif renders animated).
**Verification:** tsc clean, smoke green (95 diagrams, 0 dead buttons). GIFs ~270-305 KB each.
**Gotcha:** Discord animates an attachment by EXTENSION, the attach name was hardcoded diagram.png;
now it derives .gif/.png from card.image. GIF size scales with frames x dpi; 9-11 frames at dpi 70
keeps each well under the 8MB embed cap.

## 2026-06-19 — P1 (partial): sourced air-raid coaching on 12 concept cards  [content, knowledge]
**What:** First OFFENSIVE sourced teaching. Mined the air-raid collection (Subtonic) into the
parent repo verified doc air-raid-offense.md, then added faithful, paraphrased "Coaching notes"
sections to 12 marquee concept cards (drive, mesh, smash, flood, shallow-cross, stick, corner-flat,
four-verticals, curls, slants, wr-screen, rpo-bubble). Engine basics + diagram + sourced why.
**Files:** content/concepts.json (12 enriched).
**Verification:** smoke green, 95 diagrams, 0 dead buttons.
**Gotcha:** Collection names != filenames. The air-raid-concepts collection is media-06-18-06-01-*
files, the air-raid collection is Air-raid-*.txt. When mining a collection, resolve its real files
via collections.json items, do not assume files are named after the collection.

## 2026-06-19 — P3: coverage shell diagrams on 7 cards  [content]
**What:** Added engine shell diagrams (resolveShell) to the 7 coverage cards whose id matches an
engine coverage (cover-0/1/2/2-man/3/4/6). The 5 variants (tampa-2, palms, cover-1-robber,
cover-3-match, cover-9) stay text-only, drawing them as a base shell would mislabel the picture.
**Files:** content/coverages.json, assets/card_art/coverage-*.png (7).
**Verification:** smoke green, 95 card diagrams, 0 dead buttons.
**Gotcha:** Coverage shells render the cleanest of all diagram types (static zone bubbles), unlike
route concepts/runs which develop busier. resolveShell(form, front, coverage) + override model.name.

## 2026-06-19 — P2 offense scaffold: concepts 11->30, new Run Game track (12)  [content, ui]
**What:** Mirrored the front backfill onto offense. Pass concepts 11 -> 30 (26 engine concepts
diagrammed + sourced from `concepts.json` desc/term/routes/beats/beaten_by, plus 4 preserved
variants); added a brand-new **Run Game** track (🏃 teal) with all 12 engine run schemes, sourced
from `schemes.json` (desc/rules/back_profile) + diagrams. Tracks wired in `src/ui/ids.ts`,
`src/content/cards.ts`, `src/ui/views.ts`.
**Files:** `content/concepts.json` (30), `content/runs.json` (new, 12), `assets/card_art/concept-*.png`
(26), `assets/card_art/run-*.png` (12), `src/ui/ids.ts`, `src/content/cards.ts`, `src/ui/views.ts`.
**Verification:** clean `tsc` build + `npm run smoke` green (88 card diagrams, 505 related links,
0 dead buttons).
**Gotcha:** Adding a track means SEVEN exhaustive maps: Track union + TRACKS + TRACK_LABEL/EMOJI/
BLURB + FACETS + DEFAULT_FILTER + isTrack (ids.ts), CardTrack + CARD_TRACKS + FILES + RESOLVE_ORDER +
the `cards` init object + cardStats (cards.ts), TRACK_COLOR + HUB_ORDER (views.ts). tsx (smoke) is
lenient about missing keys; `tsc` (the deploy build) is NOT, so always run `npm run build` before
deploy. Concept diagrams render busier than front alignment boards; per-concept formations
(from render-harness) make them readable. The hub now has 8 tracks, RE-POST the hub after deploy.

## 2026-06-19 — Front track backfilled 7 -> 49 (every CFB26 front, diagrammed)  [content]
**What:** The `front` track had 7 family stubs; the engine knows 49 fronts. Generated a card +
an engine diagram for all 49 (`tools/backfill-front-cards.js` in the parent repo, reads
`HimkageVision/data/fronts.json`). Each card carries ONLY data-derived truth, personnel, family,
technique string, and an alignment-by-level breakdown read straight from the engine, plus an
accurate g=0 diagram titled with the front. The 7 pre-existing cards kept their ids (external
related links in glossary/situational point at them) AND their authored teaching (Strengths /
What beats it), merged after the structural sections.
**Files:** `content/fronts.json` (7 -> 49), `assets/card_art/front-*.png` (49 new).
**Verification:** `npm run smoke` green, "front cards 49 / card diagrams verified: 50 / 0 dead
buttons"; `tools/canon-check.js` shows engine 49 / cards 49.
**Gotcha:** NO fabricated strategy prose (the rule that scrapped the old playbook data). Strengths/
weaknesses were NOT invented; only the 7 sourced fronts have them. Early draft derived "even/odd
front" and a coverage shell from the geometry, both could be WRONG (the engine tags the Jack edge
as DL, so 3-3-5 Mint counted as "4-down"), so all derived interpretation was stripped, leaving only
authoritative engine fields. Diagrams: render at g=0 and override `model.name`/`model.term` to the
front name + technique string (else the board is titled with the offense's scheme, "INSIDE ZONE").

## 2026-06-19 — Teaching cards can carry diagrams; first one on mint-front-run-fit  [content, ui]
**What:** Teaching cards were text-only (only the Playbook track attached art). Added an optional
`image` field to the `Card` type, mirrored the scheme-detail attach logic into `cardDetail`
(`assets/card_art/<image>` -> `embed.setImage('attachment://diagram.png')`), and extended the smoke
test to verify a card naming an image actually attaches one. First diagram: `mint-front-run-fit`
gets `assets/card_art/mint-front-run-fit.png`, an engine-generated 3-3-5 Mint vs inside-zone
alignment board (NT 0-tech, DTs 4i, two-high shell).
**Files:** `src/content/cards.ts`, `src/ui/views.ts`, `scripts/smoke-test.ts`,
`content/situational.json`, `assets/card_art/mint-front-run-fit.png` (new).
**Verification:** `npm run smoke` green, "card diagrams verified: 1".
**Gotcha:** Card diagrams must be ORIGINAL art (canon: paraphrase, never republish), so they come
from the HimkageVision engine (`render-card.js`), NOT from captured video frames. The PNG lives in
the bot repo (deploy ships it); `assets/` is tracked, not gitignored.

## 2026-06-19 — situational card: `mint-front-run-fit` (3-3-5 inside-zone run fit)  [content]
**What:** Authored the 8th situational card, `mint-front-run-fit` ("Stop Inside Zone from
Two-High (the Mint Front)"). Mined from the parent repo's `335-defense` collection (27-part
course) into `knowledge/verified/335-defense.md`, then authored here. Teaches the 3-3-5 thesis:
delete inside zone's four-way go one gap at a time from a five-man box, no blitz, while staying
two-high. Related links to `penny-3-high`, `nickel-3-3-odd-bucket`, `b-gap`.
**Files:** `content/situational.json`.
**Verification:** `npm run smoke` green (264 routes, 322 related links, 0 dead buttons, 8
situational cards). First real-deal deploy test of newly-ingested knowledge end to end.
**Gotcha:** This card is the only one authored from a 27-part course so far. The rest of the
335 knowledge is captured in the parent repo's verified doc + AUTHORING-BACKLOG but not yet
carded. Don't assume the bot "knows" the whole course from this one card.

## 2026-06-13 — New `situational` track: 7 Madden-tactics teaching cards  [content, ui]
**What:** Added the first new teaching track since the rebuild began, `situational` 🎯 (orange),
for Madden pressure & tactics, so the advanced Madden tactics content does not pollute the clean
fundamentals tracks. Seven cards in `content/situational.json`: Disguised Manual Rush (the "sike"),
Attack the Protection, Nickel 3-3 Odd Blitz Bucket, Nickel Edge Blitz 2 (trap-2), Penny 3-3-5 "3
High", Stubby & Seahawk vs Trips, Cover 6 Willie vs Trips/Bunch TE. Authored from the parent repo's
verified docs (`knowledge/verified/*.md`), which were mined from the creator's video
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
