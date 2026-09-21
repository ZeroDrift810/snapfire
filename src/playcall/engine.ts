/**
 * Playcall engine adapter.
 *
 * Thin typed wrapper over the vendored HimkageVision play engine (engine/play-engine.core.js)
 * and its corpus (engine/play-data.js, generated from HimkageVision/data/*.json). The engine
 * is the canonical, test-verified source of football geometry: it resolves a chosen offensive
 * play against any defensive front + coverage into real blocking assignments, routes, coverage
 * drops and a ball-carrier path. We treat its output as the ground truth the grader reads, and
 * its SVG as the diagram the bot renders. Nothing here invents football.
 *
 * The engine is plain CommonJS with no build step; it is required at runtime from PROJECT_ROOT
 * so it survives `tsc` (it is not compiled into dist/) exactly like data/ and content/ are.
 */

import * as path from 'path';

// PROJECT_ROOT: src/playcall -> ../.. = repo root (same in dev via tsx and prod via dist/playcall).
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const ENGINE_DIR = path.join(PROJECT_ROOT, 'engine');
export const FONT_FILES = [
  path.join(ENGINE_DIR, 'fonts', 'PlayartSans.ttf'),
  path.join(ENGINE_DIR, 'fonts', 'PlayartSans-Bold.ttf'),
];

// ---------------------------------------------------------------------------
// Engine + corpus types (the surface we use; the engine exposes more)
// ---------------------------------------------------------------------------

export type Dir = 1 | -1;
export type Assignment = [from: string, to: string, kind: string];

export interface CoverageEnt {
  id: string;
  kind: 'deep' | 'drop' | 'man' | 'rush';
  pts: { x: number; y: number }[];
  bubble?: { x: number; y: number; rx: number; ry: number };
  lock?: string;
}

export interface RouteEnt {
  id: string;
  route: string;
  pts: { x: number; y: number }[];
}

export interface DefToken {
  x: number;
  y: number;
  t: string;
  role: 'DL' | 'LB' | 'DB';
}
export interface OffToken {
  x: number;
  y: number;
}

/** The resolved play model returned by resolvePlay / resolvePass. */
export interface PlayModel {
  key: string;
  kind?: 'pass';
  name: string;
  term: string;
  desc: string;
  A: Assignment[];
  C: CoverageEnt[] | null;
  R?: RouteEnt[];
  X?: { owner: string; kind: string; pts: { x: number; y: number }[] }[] | null;
  carry: { x: number; y: number }[] | null;
  carrier?: string | null;
  ball?: { x: number; y: number }[] | null;
  drop?: { x: number; y: number }[];
  primary?: string;
  OFF: Record<string, OffToken>;
  DEF: Record<string, DefToken>;
  dir: Dir;
  formKey: string;
  frontKey: string;
  coverage: string | null;
  motion: string | null;
}

export interface SchemeDef {
  name: string;
  term: string;
  desc: string;
  family: string;
  rules?: string;
  back_profile?: string;
  best_vs?: string[];
  weak_vs?: string[];
}

export interface ConceptDef {
  display_name: string;
  term: string;
  family: string;
  drop?: string;
  desc: string;
  beats?: string[]; // coverage keys this concept attacks
  beaten_by?: string[]; // coverage keys that take it away
}

export interface CoverageDef {
  display_name: string;
  term: string;
  family: 'zone' | 'man';
  deep: number;
  man: boolean;
  hole?: boolean;
  rules?: string;
  beats?: string[];
  beaten_by?: string[];
}

export interface FrontDef {
  display_name: string;
  family: string;
  personnel?: string;
  technique_string?: string;
  notes?: string;
  beats?: string[];
  beaten_by?: string[];
}

interface EngineApi {
  SCHEMES: string[];
  FRONT_KEYS: string[];
  COVERAGE_KEYS: string[];
  CONCEPT_KEYS: string[];
  FORMATIONS: Record<string, () => Record<string, OffToken>>;
  FRONTS: Record<string, () => Record<string, DefToken>>;
  resolvePlay(form: string, front: string, scheme: string, dir: number, cov?: string | null, motion?: string | null): PlayModel;
  resolvePass(form: string, front: string, concept: string, dir: number, cov?: string | null): PlayModel;
  resolveShell(form: string, front: string, cov: string, dir: number): PlayModel;
  classifyRun(name: string): { scheme: string; motion: string | null; weak: boolean };
  classifyPass(name: string, type?: string): string;
  renderSVG(model: PlayModel, g: number, idn?: string, noVig?: boolean): string;
}

interface PlayData {
  fronts: Record<string, FrontDef & { players: Record<string, DefToken> }>;
  formations: Record<string, { players: Record<string, OffToken> }>;
  schemes: Record<string, SchemeDef>;
  coverages: Record<string, CoverageDef>;
  concepts: Record<string, ConceptDef>;
  routes: Record<string, unknown>;
  plays: { page: number; slot: number; btn: string; type: string; name: string; formation: string; fav: boolean }[];
}

/* eslint-disable @typescript-eslint/no-var-requires */
export const Engine: EngineApi = require(path.join(ENGINE_DIR, 'play-engine.core.js'));
export const Corpus: PlayData = require(path.join(ENGINE_DIR, 'play-data.js'));
/* eslint-enable @typescript-eslint/no-var-requires */

// ---------------------------------------------------------------------------
// Corpus accessors
// ---------------------------------------------------------------------------

export const getScheme = (key: string): SchemeDef | undefined => Corpus.schemes[key];
export const getConcept = (key: string): ConceptDef | undefined => Corpus.concepts[key];
export const getCoverage = (key: string): CoverageDef | undefined => Corpus.coverages[key];
export const getFront = (key: string): FrontDef | undefined => Corpus.fronts[key];

export function resolveRun(form: string, front: string, scheme: string, dir: Dir, cov: string | null, motion: string | null = null): PlayModel {
  return Engine.resolvePlay(form, front, scheme, dir, cov, motion);
}
export function resolvePass(form: string, front: string, concept: string, dir: Dir, cov: string | null): PlayModel {
  return Engine.resolvePass(form, front, concept, dir, cov);
}

// ---------------------------------------------------------------------------
// Geometry analysis — what the grader reads out of a resolved model.
// These are measurements of the engine's output, not new football rules.
// ---------------------------------------------------------------------------

const LOS = 500;

/**
 * Box defenders, counted the way a QB counts them pre-snap.
 *
 *  - ON THE LINE in a numbered technique (0-9, incl. 2i / 4i): part of the front, so in the box by
 *    definition. That includes a 9-technique outside the tight end, which is how the 46 Bear's
 *    walked-up WILL counts and the Bear is the 8-man front it is famous for.
 *  - OFF THE BALL (LB letters, a $ safety, a safety the coverage rolled down): in the box when
 *    inside run-fit depth AND between the offense's end men on the line, allowing one gap outside.
 *  - So a NICKEL / APEX outside the end man is NOT in the box. Textbook (nickel): he "fills the
 *    alley between the LB and the CB ... Without the nickel in run support, the defense has only
 *    6 defenders in the box."
 *
 * This replaced a fixed window of x 330..670 around the center of the field. That measured the
 * field, not the formation: the Bear's 9-tech at x678 missed it by 8px (so the 8-man front
 * counted 7) while a nickel apex at x330 landed exactly on its edge and counted. The end men move
 * with the formation (an attached TE extends the box), which is the actual definition.
 * The coverage's part (a single-high shell rolling a safety down) happens in the engine now,
 * before this ever runs: see presnapShell in play-engine.core.js.
 */
export function boxCount(model: PlayModel): number {
  const OFF = model.OFF as Record<string, { x: number; y: number }>;
  const line = ['LT', 'LG', 'C', 'RG', 'RT'].filter((id) => OFF[id]).map((id) => OFF[id].x);
  if (OFF.TE && line.length) {
    const nearest = Math.min(...line.map((x) => Math.abs(OFF.TE.x - x)));
    if (nearest <= 60) line.push(OFF.TE.x); // attached TE is an end man; a detached one is a receiver
  }
  const L = Math.min(...line);
  const R = Math.max(...line);
  const gap = OFF.LT && OFF.RT ? Math.abs(OFF.RT.x - OFF.LT.x) / 4 : 46; // one OL split

  let n = 0;
  for (const id of Object.keys(model.DEF)) {
    const d = model.DEF[id];
    if (d.role === 'DL' || /^\d/.test(String(d.t ?? ''))) {
      n++; // on the ball in a technique
      continue;
    }
    if (d.y >= 360 && d.x >= L - gap && d.x <= R + gap) n++; // off-ball, inside the end men
  }
  return n;
}

/** Defenders the offense actually blocks (the `to` ids in the assignment array). */
export function blockedDefenders(model: PlayModel): Set<string> {
  return new Set(model.A.map((a) => a[1]));
}

/**
 * Rushers the protection did NOT pick up (pass game): a direct pressure signal.
 * Rushers = DL plus LBs mugged on the LOS (y>=440), minus everyone a blocker is set on.
 */
export function freeRushers(model: PlayModel): string[] {
  const blocked = blockedDefenders(model);
  return Object.keys(model.DEF).filter((id) => {
    const d = model.DEF[id];
    const isRusher = d.role === 'DL' || (d.role === 'LB' && d.y >= 440);
    return isRusher && !blocked.has(id);
  });
}

/**
 * Unblocked defenders sitting in the run's point of attack. The carry path's aiming
 * point (its second-to-last interior point) defines the lane; any box defender near that
 * x who is not blocked is a problem. Intentional read keys (read/option schemes leave a
 * man free by design) are excluded so a designed read does not read as a bust.
 */
export function unblockedAtPOA(model: PlayModel): number {
  if (!model.carry || model.carry.length < 2) return 0;
  const aim = model.carry[Math.max(1, model.carry.length - 2)];
  const blocked = blockedDefenders(model);
  const readKey = model.X && model.X.length ? null : null; // option keys live in X, never in A, handled by design
  let n = 0;
  for (const id of Object.keys(model.DEF)) {
    const d = model.DEF[id];
    if (d.role === 'DB') continue;
    if (blocked.has(id)) continue;
    if (id === readKey) continue;
    // near the lane horizontally and at or in front of the aiming depth
    if (Math.abs(d.x - aim.x) <= 70 && d.y <= LOS + 40) n++;
  }
  // option schemes intentionally leave one front defender unblocked (the read/pitch key)
  if (model.key === 'read-option' || model.key === 'speed-option' || model.key === 'power-read') n = Math.max(0, n - 1);
  return n;
}

/** Double-teams created at the point of attack (two blockers on one defender = movement). */
export function doubleTeamsAtPOA(model: PlayModel): number {
  const counts: Record<string, number> = {};
  for (const [, to, kind] of model.A) {
    if (kind === 'stalk') continue;
    counts[to] = (counts[to] || 0) + 1;
  }
  return Object.values(counts).filter((c) => c >= 2).length;
}

/** The defense sent more rushers than the offense kept in to block (a true overload). */
export function pressureMargin(model: PlayModel): number {
  return freeRushers(model).length;
}
