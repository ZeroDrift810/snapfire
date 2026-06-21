# DEVLOG — iMoveChainz Bot (snapfire)

Append-only record of non-trivial fixes, decisions, and gotchas. Newest on top.

## 2026-06-21 — Scheme Builder: "Build Identity Card" crashed live  [scheme, bug]
**Symptom:** Tapping "Build Identity Card" returned the generic "Something glitched on that tap."
Live logs: `ReferenceError: Cannot access 'exports' before initialization` at buildIdentityView
(views.ts:140).
**Root cause:** I named a local `const exports` for the export button row. In the prod CommonJS build
(tsc -> `node dist`) that shadows the module-level `exports` binding and creates a TDZ, so the function
threw on entry. The `tsx`-based smoke + `tsc --noEmit` BOTH passed because tsx transpiles to ESM-style
where `exports` is not the live binding; only the real CJS `dist` build trips it.
**Fix:** renamed `exports` -> `exportRow`. Verified the FIX against the prod path: `tsc` build, then
`require('./dist/scheme/views.js').buildIdentityView(...)` returns cleanly. Added a shadowing scan
(`grep -nE '(const|let|var) (exports|module|require|__dirname|__filename)'` over src/) — no other hits.
**Gotcha:** Never name a variable `exports`/`module`/`require` (CJS bindings). And the smoke test runs via
tsx, which does NOT catch CJS-only runtime errors; for anything subtle, sanity-call the compiled `dist/`
output, not just the tsx path.

## 2026-06-21 — Scheme artifacts: branded image + multi-page PDF  [feature, scheme, render]
**What:** `src/scheme/render.ts` turns a built scheme into the sellable goods: a branded portrait
"Scheme Identity" card (PNG) and a multi-page PDF (page 1 card, page 2 custom-playbook roadmap +
M24 reference plays, pages 3+ the core concepts drawn by the HimkageVision engine, 4-up). Card +
roadmap pages are composed as SVG and rasterized with resvg + bundled Barlow (same pipeline as the
playcall diagrams); pdf-lib (pure JS) stitches the pages and lays out the engine concept PNGs.
Wired into the builder: the identity card has **Export Card** + **Export PDF** buttons that defer an
ephemeral reply and deliver the file.
**Files:** src/scheme/render.ts, src/scheme/views.ts (export buttons), src/scheme/handler.ts (export
+ defer + AttachmentBuilder), scripts/smoke-test.ts (Part G renders the card PNG), package.json (+pdf-lib).
**Verification:** tsc clean; smoke green (card PNG renders). POC generated for West Coast Zone Run:
109KB card + 705KB 5-page PDF in ~4.3s (the PDF time is the ~12 engine concept renders).
**Gotchas:** (1) Barlow has no ⚖ glyph (rendered tofu) — keep artifact text to plain ASCII + ASCII
punctuation. (2) A concept's engine key can be a run SCHEME or a pass CONCEPT; pick the resolver by
`Engine.SCHEMES.includes(k)` vs `Engine.CONCEPT_KEYS.includes(k)`, not by the concept's run/pass side
(e.g. RPO: Option is side=run but maps to the rpo-bubble pass concept). (3) Export defers a fresh
ephemeral reply (not an update) so the identity card message stays and the artifact arrives alongside.

## 2026-06-21 — Scheme Builder: ingest the M24 Playbook Creator + authoring flow  [feature, scheme, data]
**What:** New `src/scheme/` feature, foundation for a planned premium product line (sell schemes /
playsheets / playbooks as a gated, image+PDF content library). (1) **Ingest** the SchemeGuide M24
Playbook Creator workbook (`tools/ingest-playbook-creator.py`) into `data/scheme/*.json`: the 35-concept
declaration taxonomy bucketed (Gap/Zone/Option-RPO/PA/Quick/Medium/Deep) with per-bucket recommended
counts, offensive schemes/tempos/formations, the defensive vocabulary, and an aggregated concept ->
formation / example-play map mined from the 4,709-row OFF Play Log. The taxonomy is evergreen; the M24
play names are kept as REFERENCE only; each concept carries a HimkageVision engine key so artifacts can
render the real diagram. (2) **Scheme Identity Builder**: a button-driven authoring flow (base scheme +
tempo -> pick up to 12 core concepts in 3 grouped multi-selects -> a Scheme Identity card with concepts
by bucket, a balance check vs the recommended ranges, and a custom-playbook roadmap ranking formations
by how many of your concepts they carry). In-memory per user.
**Files:** tools/ingest-playbook-creator.py, data/scheme/*.json (concepts/buckets/schemes/tempos/
formations/defense), src/scheme/{data,builder,views,handler}.ts, src/router.ts (+imc:sb dispatch),
src/ui/views.ts (hub button), src/index.ts (boot load), scripts/smoke-test.ts (Part G).
**Verification:** tsc clean; smoke green (Part G: 35 concepts loaded, 6 builder views validated, identity
card + roadmap built). Sample card: West Coast Zone Run, Pro Style, balanced 12, Shotgun/Singleback top
of the roadmap.
**Gotchas:** (1) The OFF Play Log uses ~50 finer concept labels; the ingest maps them onto the 35
declaration concepts (PA Shot->PA Shots, Iso->Dive, Jet Sweep->Sweep, Portland->Switch, etc.) before
aggregating. (2) Discord selects cap at 25 options, so the 35 concepts are split into 3 group selects
(run / quick+PA / pass); current picks are re-shown via per-option `default:true`. (3) Scheme builder is
side-effecting, handled outside resolve() like playcall; Part A of the smoke skips `imc:sb:`.
**Next (not yet built):** render schemes/playsheets to branded image + PDF; a gated content library with
Discord-role entitlement (the commercial layer).

## 2026-06-21 — Playcall: defense mode + broadcast field + event banners  [game, ui, render]
**What:** Four upgrades. (1) **Play defense:** a side chooser (Offense/Defense) at drive start; in
defense mode the SnapFire bot has the ball (`botPickOffense`, down/distance aware), you pick a front +
coverage each down (one tap, no direction), and you win by forcing stops/takeaways. Shared `applyPlay`
core resolves both modes; headlines + win framing flip by mode. (2) **Real yard markers:** the engine
field is abstract, so `field.ts` post-processes its SVG, strips the engine's misaligned yard lines, and
draws numbered lines at the correct absolute positions for the snap. (3) **End zone** band drawn when
the opponent goal is in view, plus the blue LOS and a yellow first-down line at ballOn+toGo. (4) **Event
banners** baked into the final GIF frames (Kunai shinobi pattern): TOUCHDOWN / FIRST DOWN / BIG PLAY /
SACK / STUFFED / INTERCEPTED / FUMBLE / TURNOVER / SAFETY, color-coded, slam-in scale.
**Files:** src/playcall/field.ts (new: overlay + banner + eventFor), render.ts (decorate per frame +
ctx in cache key), game.ts (mode + applyPlay + resolveAsDefense + toGoAtSnap/downAtSnap on the record),
catalog.ts (botPickOffense), views.ts (start chooser, buildTurnView for both modes, offense/defense
selects), handler.ts (start:off/def + defpick routing), scripts/smoke-test.ts (Part F covers both modes).
**Verification:** tsc clean; smoke green (Part F: 7 drives across both modes, 29 live diagrams). Visual
spot-checks: red-zone TD shows the end zone + numbers counting down + TOUCHDOWN slam; midfield shows the
fold (50->40->30) + yellow first-down line + no end zone; sack/INT banners correct.
**Gotchas:** (1) Field overlay must be injected AFTER the engine's border rect (above turf, below art/
tokens) and the engine's own `stroke-opacity="0.5"` yard lines stripped first, or you get a moire of two
misaligned grids. Yard numbers go at the sidelines (x~80/920) so tokens (center) never hide them.
(2) The banner depends on the OUTCOME (not just the matchup), so ballOn/toGo/event are part of the GIF
cache key now; same matchup at a different spot/result is a different render. (3) Downfield = decreasing
y, 5 yds = 52px; numbers fold L<=50?L:100-L and skip the goal lines.

## 2026-06-21 — Playcall: animate the diagrams (live GIF) + defer the interaction  [game, ui, render]
**Symptom:** Playcall diagrams shipped as a single still PNG; the play did not animate (the rest of
the bot's card diagrams are GIFs, so a still looked broken).
**Fix:** `renderPlayGif()` sweeps the engine's progress g 0->1, rasterizes each frame with resvg, and
encodes a looping GIF with `gifenc` (pure JS, no native dep) using one global palette built from the
final frame (no inter-frame flicker). Views attach `play.gif` (Discord animates by extension). Frame
count + width are env-tunable (`PLAYCALL_GIF_FRAMES`/`_WIDTH`, read lazily) so smoke renders cheap
3-frame GIFs. Production: 11 frames @ 760px, ~210-330KB, ~1.7s cold / cached instant.
**Files:** src/playcall/render.ts (renderPlayGif + cache), src/playcall/views.ts (diagram -> gif),
src/playcall/handler.ts (defer-then-editReply), src/playcall/gifenc.d.ts, scripts/smoke-test.ts
(Part F cheap-render env), package.json (+gifenc).
**Gotcha:** An 11-frame GIF renders in ~1.7s, OVER Discord's 3-second interaction limit. The handler
now `deferReply`/`deferUpdate` FIRST (instant ack, lifts the limit to ~15 min), then builds the
payload (which renders) and `editReply`s it. `deliver()` takes a thunk so the render runs AFTER the
ack, never before. Launch-from-public-message defers an ephemeral reply; in-game taps defer an update
so the same private message is edited in place.

## 2026-06-20 — Playcall: engine-resolved drive game with live HimkageVision art  [feature, game, engine]
**What:** New button-driven mini-game `src/playcall/`. You are SnapFire offense, the Shinobi bot
is the defense; you call a play + side each down, the bot answers with a front + coverage, and the
HimkageVision play engine resolves the real matchup. Outcomes are NOT a hand-authored matrix: the
grader reads what the engine actually drew (box count, double-teams + unblocked defenders at the
point of attack for runs; free rushers the protection missed + the canon concept.beats / beaten_by
coverage tags for passes) into an expected-value + variance + event model, rolled with an injectable
RNG. Every resolved snap renders a LIVE diagram of that exact matchup (engine SVG -> PNG), never a
pre-baked image. Single-drive vs the bot for v1 (field position, downs, TD / turnover / downs); PvP
is a later layer (swap the bot pick for a second player, same resolution path).
**Files:** engine/ (vendored play-engine.core.js + play-data.js from HimkageVision, + OFL Barlow
fonts under engine/fonts), src/playcall/{engine,render,catalog,grade,game,views,handler}.ts,
scripts/sim-playcall.ts (grader balance harness), src/router.ts + src/ui/views.ts (hub launch
button + pc dispatch), scripts/smoke-test.ts (Part F: plays 6 full drives, renders 45 live diagrams),
package.json (+@resvg/resvg-js, sim:playcall script).
**Verification:** tsc clean. Smoke green (296 routes, 1064 detail pages, Part F 6 drives / 45 plays /
45 live diagrams, 0 dead buttons). Grader sim (4000 rolls/matchup) is football-correct: Four Verts
10.0 yds vs Cover 3 (canon beats) but 3.7 vs Quarters (canon beaten_by); Smash 9.8 vs Cover 2;
quick game eats pressure (Slants 8% sack vs the A-gap fire) while shots do not (Four Verts 21%);
runs walled to ~3.0 vs Bear Zero, ~5.8 vs Prevent; Read Option beats the loaded box because the
engine leaves the read key unblocked by design.
**Gotchas:** (1) The engine is plain CommonJS with no build step; it is required at runtime from
PROJECT_ROOT/engine (NOT compiled into dist/), exactly like data/ and content/ are read, so it
survives `tsc`. (2) HimkageVision only emits SVG (its rasterizer is a Python/PyMuPDF tool, unusable
in the bot); runtime PNG comes from @resvg/resvg-js with a BUNDLED font (Barlow, OFL) and
loadSystemFonts:false so headless hosts render text deterministically. (3) The engine leaves option
read keys unblocked on purpose; unblockedAtPOA() subtracts one for read/speed-option/power-read so a
designed read does not score as a busted block. (4) To re-sync vendored engine after a HimkageVision
data change: rebuild play-data.js there (node build-data.js) and copy play-engine.core.js +
play-data.js into engine/.

## 2026-06-19 — Phase 4: cleanup + final QA gate  [data, content]
**What:** (1) Deduped 354 scheme name slugs so all 890 are unique and every formation variant is
reachable (the list/select keys on name; dup names hid variants). display_name unchanged. (2) Fixed the
startup log to include the run track. (3) Quarantined media-06-18-04-17-05 (byte-dup of -03).
**Final QA:** canon-check fronts 49/49, concepts 30>=26, coverages 12>=7; mine-status 137/137 (0 raw);
schemes 890 unique slugs, 16 verified; engine test 5.77M checks / 0 failures; smoke green, 0 dead buttons.
**Status:** Phases 0/1/2/4 complete. Phase 3 (art-by-art scheme rebuild) is the staged long game:
batch 1 done (16/890), 874 remain, continue family by family with rebuild-schemes-batch.js (art wins).

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
