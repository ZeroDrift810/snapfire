/**
 * Engine-resolved outcome grader.
 *
 * The old playcall games rolled a hand-authored 16-cell matrix of invented numbers. This one
 * grades the matchup from what the engine actually resolved on the field:
 *   - runs read the BOX COUNT, the DOUBLE TEAMS at the point of attack, and any UNBLOCKED
 *     defender sitting in the lane (all measured off the resolved blocking assignments + carry).
 *   - passes read the PROTECTION (free rushers the offense failed to pick up = pressure) and the
 *     canon concept-vs-coverage matchup tags from the corpus (concept.beats / beaten_by).
 * Those signals set an expected value + variance + event chances; an injectable RNG rolls it.
 * Nothing here is fabricated football: every input is a measurement of the engine's output or a
 * tag from the verified corpus.
 */

import { OffenseCall, DefenseCall } from './catalog';
import {
  PlayModel,
  boxCount,
  doubleTeamsAtPOA,
  unblockedAtPOA,
  freeRushers,
  getConcept,
} from './engine';

export type OutcomeKind = 'BIG_GAIN' | 'GAIN' | 'NO_GAIN' | 'LOSS' | 'SACK' | 'INT' | 'FUMBLE';

export interface Outcome {
  kind: OutcomeKind;
  yards: number;
  /** True for explosive plays (20+), used for flavor and stat tracking. */
  explosive: boolean;
  /** Whether possession changes (INT / lost fumble). */
  turnover: boolean;
  /** Broadcast-style one-liner (no jargon, no em dashes). */
  text: string;
  /** Short "why it happened" tag tying the result to the matchup, for the teaching layer. */
  why: string;
}

const QUICK_CONCEPTS = new Set(['slants', 'mesh', 'flood']); // ball comes out vs pressure

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function kindFromYards(yards: number): OutcomeKind {
  if (yards >= 20) return 'BIG_GAIN';
  if (yards >= 3) return 'GAIN';
  if (yards >= 1) return 'GAIN';
  if (yards === 0) return 'NO_GAIN';
  return 'LOSS';
}

// ---------------------------------------------------------------------------
// RUN grading
// ---------------------------------------------------------------------------

function gradeRun(off: OffenseCall, def: DefenseCall, model: PlayModel, rng: () => number): Outcome {
  const box = boxCount(model);
  const unblocked = unblockedAtPOA(model);
  const doubles = doubleTeamsAtPOA(model);

  // Expected yards from the geometry the engine resolved.
  let ev = 4.3;
  ev += (6.5 - box) * 0.85; // light box = grass, loaded box = wall
  ev += doubles * 1.15; // movement at the point of attack
  ev -= unblocked * 2.4; // a free hat in the lane
  if (def.blitz) ev += 0.6; // a blitz that misses the gap springs it (variance handles the miss)

  // Variance: blitzes and outside runs are boomier; inside runs are steadier.
  let sd = 3.4;
  if (def.blitz) sd += 2.2;
  if (off.key === 'outside-zone' || off.key === 'read-option') sd += 1.3;

  // Event chances scaled by the matchup.
  const fumbleChance = 0.015 + (box >= 7 ? 0.015 : 0); // big collisions in a loaded box
  const stuffPressure = unblocked >= 2 && box >= 7;

  // Fumble check first (a fumble is a lost-ball event regardless of yardage).
  if (rng() < fumbleChance) {
    return {
      kind: 'FUMBLE',
      yards: gauss(rng, 0, 2),
      explosive: false,
      turnover: true,
      text: 'Ball is OUT. The defense falls on it.',
      why: `${box}-man box got a hat on the ball.`,
    };
  }

  let yards = Math.round(gauss(rng, ev, sd));
  if (stuffPressure && yards > 0 && rng() < 0.5) yards = -gauss(rng, 1, 1.5); // free hat blows it up
  yards = clamp(yards, -7, 78);

  const kind = kindFromYards(yards);
  const explosive = yards >= 20;
  return {
    kind,
    yards,
    explosive,
    turnover: false,
    text: runText(off, kind, yards, rng),
    why: runWhy(box, doubles, unblocked, def),
  };
}

function runWhy(box: number, doubles: number, unblocked: number, def: DefenseCall): string {
  if (unblocked >= 2) return `${unblocked} free defenders in the lane vs a ${box}-man box.`;
  if (doubles >= 2) return `${doubles} double teams moved the ${box}-man front.`;
  if (box <= 6) return `Light ${box}-man box, room to run.`;
  if (def.blitz) return `Ran into the ${def.label} pressure.`;
  return `${box}-man box, blocks held up.`;
}

function runText(off: OffenseCall, kind: OutcomeKind, yards: number, rng: () => number): string {
  if (kind === 'BIG_GAIN') return pick(rng, [`${off.label} HITS! The back breaks the second level for ${yards}.`, `Crease wide open. ${yards} yards and gone.`]);
  if (kind === 'LOSS') return pick(rng, [`Stuffed in the backfield for ${yards}.`, `Met at the line. ${yards} on the run.`]);
  if (kind === 'NO_GAIN') return 'Wall of bodies. No gain.';
  return pick(rng, [`${off.label} for ${yards}.`, `Back follows his blocks for ${yards}.`]);
}

// ---------------------------------------------------------------------------
// PASS grading
// ---------------------------------------------------------------------------

function gradePass(off: OffenseCall, def: DefenseCall, model: PlayModel, rng: () => number): Outcome {
  const free = freeRushers(model).length;
  const concept = getConcept(off.key);
  const beats = concept?.beats?.includes(def.coverage) ?? false; // canon: this concept attacks this shell
  const beaten = concept?.beaten_by?.includes(def.coverage) ?? false; // canon: this shell takes it away
  const quick = QUICK_CONCEPTS.has(off.key);

  // Pressure: free rushers the protection did not pick up. Quick game beats it (hot answer).
  let sackChance = clamp(0.04 + 0.17 * free, 0, 0.62);
  if (quick) sackChance *= 0.4;

  if (rng() < sackChance) {
    return {
      kind: 'SACK',
      yards: -Math.round(gauss(rng, 7, 2)),
      explosive: false,
      turnover: false,
      text: pick(rng, ['Pressure gets home. SACK.', 'No time. Wrapped up for the sack.']),
      why: `${free} free rusher${free === 1 ? '' : 's'} the protection could not block.`,
    };
  }

  // Expected yards from the canon matchup.
  let ev = 6.4;
  if (beats) ev += 4.2; // attacking the shell's soft spot
  if (beaten) ev -= 4.0; // throwing where the coverage has help
  if (free > 0 && !quick) ev -= 1.6 * free; // rushed throw

  let sd = 6.2;
  if (off.key === 'four-verticals' || off.key === 'smash') sd += 2.0; // shot plays are boomy
  if (quick) sd -= 1.4;

  // Interception: elevated when you throw into the shell that beats you, especially shots.
  let intChance = 0.025;
  if (beaten) intChance += 0.06;
  if (def.coverage === 'cover-1' || def.coverage === 'cover-0') intChance += 0.015; // tight man, contested
  if (quick) intChance *= 0.6;
  intChance = clamp(intChance, 0, 0.16);

  if (rng() < intChance) {
    return {
      kind: 'INT',
      yards: 0,
      explosive: false,
      turnover: true,
      text: pick(rng, ['Jumped! INTERCEPTED.', 'Throws it right to the help. Picked off.']),
      why: beaten ? `${off.label} threw into ${defCovName(def)} help.` : `Contested throw vs ${defCovName(def)}.`,
    };
  }

  let yards = Math.round(gauss(rng, ev, sd));
  if (yards < 0) yards = 0; // an incompletion, not a loss (sacks are handled above)
  yards = clamp(yards, 0, 80);

  const kind: OutcomeKind = yards === 0 ? 'NO_GAIN' : kindFromYards(yards);
  const explosive = yards >= 20;
  return {
    kind,
    yards,
    explosive,
    turnover: false,
    text: passText(off, kind, yards, rng),
    why: beats ? `${off.label} beat ${defCovName(def)} where it is soft.` : beaten ? `${defCovName(def)} had it covered.` : `Worked it vs ${defCovName(def)}.`,
  };
}

function defCovName(def: DefenseCall): string {
  return def.label;
}

function passText(off: OffenseCall, kind: OutcomeKind, yards: number, rng: () => number): string {
  if (kind === 'BIG_GAIN') return pick(rng, [`SHOT CONNECTS! ${off.label} for ${yards}.`, `Behind the coverage. ${yards}-yard strike.`]);
  if (kind === 'NO_GAIN') return pick(rng, ['Broken up. Incomplete.', 'Coverage there. Falls incomplete.']);
  return pick(rng, [`${off.label} good for ${yards}.`, `Catch and turn upfield for ${yards}.`]);
}

// ---------------------------------------------------------------------------
// public
// ---------------------------------------------------------------------------

export function gradePlay(off: OffenseCall, def: DefenseCall, model: PlayModel, rng: () => number = Math.random): Outcome {
  return off.kind === 'run' ? gradeRun(off, def, model, rng) : gradePass(off, def, model, rng);
}

// --- small stats helpers (deterministic via injected rng) ------------------

/** Box-Muller normal sample with the injected uniform RNG. */
function gauss(rng: () => number, mean: number, sd: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * sd;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
