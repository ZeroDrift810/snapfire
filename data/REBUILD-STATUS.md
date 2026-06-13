# Playbook data: rebuild status

> 2026-06-12: the playbook's route/read/strategy text was machine-generated and
> wrong (a run play described as a pass RPO, routes that don't match the play art).
> It was stripped. This file is the source of truth for what remains and how the
> rebuild works. Old fabricated data is preserved in git history (pre-strip commits).

## The foundation that remains (trustworthy)

Per scheme in `Scheme_Knowledge.json`, only these fields are real:

| Field | Source | Trust |
|-------|--------|-------|
| `name`, `display_name` | in-game play name | yes |
| `system` (SnapFire / Shinobi) | branding | yes |
| `formation_family` | in-game formation | yes |
| `image_file` -> `assets/play_art/*.png` | real in-game screenshot | **ground truth** |

The **play art is the assignments**: it draws every route and block. All 890 plays
have art. `master_data/offense_complete_v2.json` is reliable ONLY for the
name <-> formation <-> image mapping, never its `route_tree` (same bad batch).

The authored teaching cards (`content/*.json`: glossary, coverages, concepts,
fronts, usering) were NOT machine-generated and are untouched. Engagement autoposts
draw only from those, so they stay clean.

## Status

- **Verified, full content (10 schemes):** all entries named `snapfire_power_read` (5),
  `snapfire_jet_power_read` (1), `snapfire_escort_power_read_toss` (1),
  `snapfire_01_trap` (3). Each carries `verified: true` plus corrected routes/reads/
  usage_notes sourced from `knowledge/transcripts/Power.txt` and `01trap.txt`.
- **Stripped to foundation (880 schemes):** no routes/reads/usage_notes. They render
  as title + formation + play art. `schemeDetail` only shows text sections when the
  fields exist, so this is automatic and honest.
- **Cleared (dead weight):** `Concept_Knowledge.json` (267) and `Coverage_Knowledge.json`
  (62) were fabricated and never rendered (slash-era leftovers). Emptied to `[]`.
  Real concept/coverage teaching lives in `content/*.json`.

## Rebuild plan (the right way, from data we already hold)

1. **Assignments** for the 880: vision pass over each play-art PNG to transcribe the
   real routes/blocks. Cross-check against HimkageVision's `play-engine.core.js`
   (`classifyRun` / `classifyPass` + `resolvePlay`): test-verified, models give/keep
   option paths, no fabrication. Engine says what the play IS; the art verifies the
   specific Madden rendition.
2. **The "why" (reads, strategy):** from coaching-clinic transcripts via the media
   pipeline. Classify each teaching point:
   - CONCEPT (scheme / coverage / leverage / recognition) -> use directly, transfers to the game
   - MECHANIC (real action -> game input, e.g. "hold X to keep the QB power") -> only with in-game verification, put in a Coach's Key field
   - TECHNIQUE (footwork, pad level, drills) -> drop, no game mapping
   Verification anchor stays in-game (play art + Himkage's own gameplay clips).
   Paraphrase, never republish.
3. **Unique slugs first:** 122 of 890 names are duplicates (`snapfire_power_read`
   appears 5x). Lookup returns the FIRST match, so other formation variants are
   unreachable in the detail view. Assign stable per-formation slugs before per-play
   content work.

Set `verified: true` on each entry as it is rebuilt and checked. The render can later
badge verified plays or gate any future "reads" section on the flag.
