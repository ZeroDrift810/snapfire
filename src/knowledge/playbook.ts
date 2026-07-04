/**
 * CFB playbook loader — the real, scraped, in-game-accurate play library.
 *
 * Source: data/cfb-playbook.json, generated from the HimkageVision play-art index.
 * Shape: a side -> set -> formation -> play[] tree. Every play is trustworthy:
 * the real in-game name, its formation, the diagram art, and (defense) the coverage class.
 * There are NO fabricated routes/reads/usage_notes — the diagram IS the assignment.
 *
 * Navigation is index-based so customIds stay short (Discord's 100-char cap):
 * side (O|D) -> setIdx -> formIdx -> playIdx, each an offset into a stable sorted list.
 *
 * Game-tagged (CFB27 today). Madden 27 drops into the same pipeline: scrape -> index ->
 * regenerate this file, no code change.
 */
import * as fs from 'fs';
import * as path from 'path';

export type Side = 'OFF' | 'DEF';

export interface PlayNode {
  name: string;
  art: string;
  type?: string;      // offense: RUN | PASS
  coverage?: string;  // defense: BLITZ | ZONE | MATCH | MAN
}

interface PlaybookFile {
  game: string;
  source: string;
  art_base: string;
  counts: Record<string, number>;
  tree: Record<Side, Record<string, Record<string, PlayNode[]>>>;
}

const DATA_PATH = path.resolve(__dirname, '..', '..', 'data', 'cfb-playbook.json');

let DATA: PlaybookFile | null = null;
// Cache the ordered set/formation key lists per side so index lookups are stable + cheap.
let SET_KEYS: Record<Side, string[]> = { OFF: [], DEF: [] };

export function loadPlaybook(): void {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  DATA = JSON.parse(raw) as PlaybookFile;
  SET_KEYS = {
    OFF: Object.keys(DATA.tree.OFF).sort(),
    DEF: Object.keys(DATA.tree.DEF).sort(),
  };
}

function data(): PlaybookFile {
  if (!DATA) loadPlaybook();
  return DATA as PlaybookFile;
}

export function playbookGame(): string {
  return data().game;
}

export function playbookCounts(): Record<string, number> {
  return data().counts;
}

/** side key -> human label. */
export const SIDE_LABEL: Record<Side, string> = { OFF: 'Offense', DEF: 'Defense' };

/** The two sides, for the top-level pick. */
export function sides(): Side[] {
  return ['OFF', 'DEF'];
}

/** Ordered set (offense) / front (defense) names for a side. */
export function sets(side: Side): string[] {
  return SET_KEYS[side];
}

export function setName(side: Side, setIdx: number): string | null {
  return SET_KEYS[side][setIdx] ?? null;
}

/** Ordered formation names within a set. */
export function formations(side: Side, setIdx: number): string[] {
  const s = setName(side, setIdx);
  if (!s) return [];
  return Object.keys(data().tree[side][s]).sort();
}

export function formationName(side: Side, setIdx: number, formIdx: number): string | null {
  return formations(side, setIdx)[formIdx] ?? null;
}

/** Plays within a formation (already sorted at generation time). */
export function plays(side: Side, setIdx: number, formIdx: number): PlayNode[] {
  const s = setName(side, setIdx);
  const f = formationName(side, setIdx, formIdx);
  if (!s || !f) return [];
  return data().tree[side][s][f] ?? [];
}

export function play(side: Side, setIdx: number, formIdx: number, playIdx: number): PlayNode | null {
  return plays(side, setIdx, formIdx)[playIdx] ?? null;
}

/**
 * Absolute path to a play's diagram, or null if the art dir/file isn't present locally.
 * Art dir is configurable (CFB_ART_DIR) so it can live outside the repo; defaults to the
 * bot's own assets/play_art_cfb (branded copies, since the bot is user-facing).
 */
export function artPath(node: PlayNode): string | null {
  const dir = process.env.CFB_ART_DIR
    ? process.env.CFB_ART_DIR
    : path.resolve(__dirname, '..', '..', 'assets', 'play_art_cfb');
  const p = path.join(dir, node.art);
  return fs.existsSync(p) ? p : null;
}
