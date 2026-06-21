/**
 * The playable hands.
 *
 * A drive game cannot offer all 455 plays x 49 fronts x 7 coverages, so we curate a tight,
 * legible deck on each side (the tabletop-football model: a small set of meaningful calls you
 * outguess your opponent with). Every entry maps to REAL engine keys, so picking it resolves
 * a real play / front+coverage and renders the real diagram. SnapFire = offense, Shinobi =
 * defense, matching the bot's two systems.
 */

import { Dir } from './engine';

export interface OffenseCall {
  id: string;
  label: string; // user-facing, no jargon
  emoji: string;
  kind: 'run' | 'pass';
  form: string; // engine formation key
  key: string; // engine scheme key (run) or concept key (pass)
  motion?: string | null;
  blurb: string;
}

export interface DefenseCall {
  id: string;
  label: string;
  emoji: string;
  front: string; // engine front key
  coverage: string; // engine coverage key
  blitz: boolean;
  /** When the bot likes this call: 'run' = short yardage / run downs, 'pass' = obvious pass, 'any' = base. */
  lean: 'run' | 'pass' | 'any';
  blurb: string;
}

// --- SnapFire offense: 5 runs + 5 passes across the spectrum ---------------
export const OFFENSE: OffenseCall[] = [
  { id: 'iz', label: 'Inside Zone', emoji: '🏃🏿', kind: 'run', form: 'gun-te', key: 'inside-zone', blurb: 'Bang it in the A gap, bend off the double team.' },
  { id: 'power', label: 'Power O', emoji: '🏃🏿', kind: 'run', form: 'i-form-pro', key: 'power', blurb: 'Down blocks, kick the edge, guard pulls to the Mike.' },
  { id: 'stretch', label: 'Outside Zone', emoji: '🏃🏿', kind: 'run', form: 'gun-te', key: 'outside-zone', blurb: 'Reach the edge, press it, then bend or bounce.' },
  { id: 'counter', label: 'Counter GT', emoji: '🏃🏿', kind: 'run', form: 'i-form-pro', key: 'counter', blurb: 'Two pullers: guard kicks, tackle wraps the backer.' },
  { id: 'option', label: 'Read Option', emoji: '🏃🏿', kind: 'run', form: 'gun-te', key: 'read-option', blurb: 'Read the backside end: give or keep.' },
  { id: 'verts', label: 'Four Verticals', emoji: '🎯', kind: 'pass', form: 'shotgun-empty-trey', key: 'four-verticals', blurb: 'Stretch the deep zones, win a seam.' },
  { id: 'mesh', label: 'Mesh', emoji: '🎯', kind: 'pass', form: 'gun-te', key: 'mesh', blurb: 'Dual shallow crossers, rub man coverage off.' },
  { id: 'smash', label: 'Smash', emoji: '🎯', kind: 'pass', form: 'shotgun-ace-slot', key: 'smash', blurb: 'Hi-low the corner: hitch under, corner over.' },
  { id: 'flood', label: 'Flood', emoji: '🎯', kind: 'pass', form: 'shotgun-bunch-str-offset', key: 'flood', blurb: 'Three levels to one side, beat the zone rotation.' },
  { id: 'slants', label: 'Slants', emoji: '🎯', kind: 'pass', form: 'shotgun-empty-trey', key: 'slants', blurb: 'Quick rhythm in-breakers, beat pressure and off coverage.' },
];

// --- Shinobi defense: fronts + coverages with clear identities -------------
export const DEFENSE: DefenseCall[] = [
  { id: 'base3', label: 'Cover 3 Base', emoji: '🛡️', front: '4-3-over', coverage: 'cover-3', blitz: false, lean: 'any', blurb: 'Four-man rush, three deep, four under. Sound everywhere.' },
  { id: 'nickel2', label: 'Cover 2', emoji: '🛡️', front: 'nickel-over', coverage: 'cover-2', blitz: false, lean: 'any', blurb: 'Two deep halves, corners squat the flats.' },
  { id: 'quarters', label: 'Quarters', emoji: '🛡️', front: 'nickel-over', coverage: 'cover-4', blitz: false, lean: 'pass', blurb: 'Four deep, match the verticals. Kills shots.' },
  { id: 'man1', label: 'Cover 1 Robber', emoji: '🥷🏿', front: '4-3-over', coverage: 'cover-1', blitz: false, lean: 'pass', blurb: 'Man across with a free safety. Loaded box.' },
  { id: 'cloud6', label: 'Cover 6', emoji: '🛡️', front: '4-3-over', coverage: 'cover-6', blitz: false, lean: 'any', blurb: 'Quarter-quarter-half, set the strength.' },
  { id: 'fire1', label: 'A-Gap Fire', emoji: '🔥', front: 'nickel-3-3-dbl-mug', coverage: 'cover-1', blitz: true, lean: 'pass', blurb: 'Double mug the A gaps, bring pressure, man behind it.' },
  { id: 'bear0', label: 'Bear Zero', emoji: '🔥', front: '46-bear', coverage: 'cover-0', blitz: true, lean: 'run', blurb: 'Load the box, no deep help, send the house.' },
  { id: 'prevent', label: 'Prevent', emoji: '🧱', front: 'prevent-3-deep', coverage: 'cover-3', blitz: false, lean: 'pass', blurb: 'Three deep, soft and back. Give up the short stuff.' },
];

export const getOffense = (id: string): OffenseCall | undefined => OFFENSE.find((o) => o.id === id);
export const getDefense = (id: string): DefenseCall | undefined => DEFENSE.find((d) => d.id === id);

// ---------------------------------------------------------------------------
// Shinobi bot defense AI: down/distance aware, with disguise (not deterministic).
// ---------------------------------------------------------------------------

export interface DriveSituation {
  down: number; // 1-4
  toGo: number; // yards to first down/goal
  ballOn: number; // yard line 1-99 (own goal = 0)
}

/** Weighted pick of a defense call for the bot, given the situation. */
export function botPickDefense(sit: DriveSituation, rng: () => number = Math.random): DefenseCall {
  const shortYardage = sit.toGo <= 2;
  const longYardage = sit.toGo >= 8;
  const passingDown = sit.down >= 3 && sit.toGo >= 5;
  const redZone = sit.ballOn >= 80;

  const weights: Record<string, number> = {};
  for (const d of DEFENSE) weights[d.id] = 1; // baseline: anything is possible (disguise)

  // Situational leans on top of the baseline.
  if (shortYardage || redZone) {
    weights.bear0 += 3;
    weights.man1 += 2;
    weights.base3 += 1;
  }
  if (passingDown) {
    weights.fire1 += 3;
    weights.quarters += 2;
    weights.man1 += 2;
    weights.bear0 -= 0.5;
  }
  if (longYardage && !passingDown) {
    weights.quarters += 1.5;
    weights.nickel2 += 1.5;
    weights.prevent += 1;
  }
  if (sit.down <= 2 && sit.toGo >= 3 && sit.toGo <= 7) {
    weights.base3 += 2;
    weights.cloud6 += 1.5;
    weights.nickel2 += 1;
  }
  // Late, deep: lean prevent only on true long-and-late, otherwise keep it honest.
  if (sit.toGo >= 15) weights.prevent += 2;

  const pool = DEFENSE.map((d) => ({ d, w: Math.max(0.1, weights[d.id]) }));
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= p.w;
    if (r <= 0) return p.d;
  }
  return pool[0].d;
}

/** Bot offensive-side direction pick (kept simple: lean to the call's natural strength). */
export function pickDir(rng: () => number = Math.random): Dir {
  return rng() < 0.5 ? 1 : -1;
}
