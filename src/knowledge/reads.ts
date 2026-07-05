/**
 * Canon read table for pass plays. Source: the HimkageVision engine's `*` primary read (the
 * ball-flight target, calibrated against card art) + `beats` + the coaching `term`, baked into
 * data/concept-reads.json. A pass play whose name contains a canonical concept name (Four
 * Verticals, Stick, Smash, Mesh...) inherits that concept's read; everything else shows nothing.
 * This is deliberately NOT a per-play invented progression — only what canon actually gives us.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ConceptRead {
  name: string;      // concept display name, e.g. "FOUR VERTICALS"
  primary: string;   // the * route (ball-flight target), e.g. "seam"
  term: string;      // coaching phrase, e.g. "STICK > FLAT > QUICK TRIANGLE"
  beats: string[];   // coverage keys, e.g. ["cover-3","cover-1"]
  card: string | null; // concept-track card id with the full IF-THEN read, if one exists
}

const DATA_PATH = path.resolve(__dirname, '..', '..', 'data', 'concept-reads.json');

let READS: Record<string, ConceptRead> | null = null;
// concept names sorted longest-first so "shallow cross" wins over a stray "cross" substring
let ORDER: { key: string; norm: string }[] = [];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function loadReads(): void {
  READS = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) as Record<string, ConceptRead>;
  ORDER = Object.entries(READS)
    .map(([key, r]) => ({ key, norm: norm(r.name) }))
    .sort((a, b) => b.norm.length - a.norm.length);
}

function reads(): Record<string, ConceptRead> {
  if (!READS) loadReads();
  return READS as Record<string, ConceptRead>;
}

/** Canon read for a play by name, or null if the play isn't a known concept. Whole-word match. */
export function readForPlay(playName: string): ConceptRead | null {
  if (!READS) loadReads();
  const hay = ` ${norm(playName)} `;
  for (const { key, norm: cn } of ORDER) {
    if (cn && hay.includes(` ${cn} `)) return reads()[key];
  }
  return null;
}

/** cover-3 -> "Cover 3", cover-2-man -> "Cover 2 Man". */
export function prettyCoverage(k: string): string {
  return k
    .split('-')
    .map((w) => (w === 'cover' ? 'Cover' : w.length <= 3 && /\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
