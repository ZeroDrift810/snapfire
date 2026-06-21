/**
 * Playcall drive game — in-memory state machine.
 *
 * v1 is a solo drive: you are SnapFire offense, the Shinobi bot is the defense. You start
 * 1st & 10 at your own 25 and call plays down by down; the bot answers with a front + coverage;
 * the engine resolves the matchup and the grader scores it; field position, downs and the result
 * advance until you score or the drive ends (turnover or downs). No database: state lives in a
 * Map keyed by user id (one active drive per user), which fits this lean, button-driven bot.
 * PvP is a later layer (swap the bot pick for a second player's pick); the resolution path is the
 * same.
 */

import { getOffense, botPickDefense, DefenseCall, OffenseCall } from './catalog';
import { Dir, PlayModel, resolvePass, resolveRun } from './engine';
import { gradePlay, Outcome } from './grade';

export interface PlayRecord {
  down: number;
  toGo: number;
  ballOn: number;
  off: OffenseCall;
  def: DefenseCall;
  dir: Dir;
  model: PlayModel;
  outcome: Outcome;
  gainTo: number; // ballOn after the play
  note: string; // "TOUCHDOWN", "1ST DOWN", "TURNOVER ON DOWNS", etc.
}

export type DriveStatus = 'live' | 'await_dir' | 'over';

export interface Game {
  userId: string;
  ballOn: number; // 0 = own goal, 100 = opponent goal
  down: number;
  toGo: number;
  status: DriveStatus;
  points: number;
  plays: PlayRecord[];
  pendingOff?: string; // offense id chosen, awaiting direction
  last?: PlayRecord; // most recent resolved play (for the result view)
  endline?: string; // final headline when over
  startedAt: number;
}

const GAMES = new Map<string, Game>();

export function getGame(userId: string): Game | undefined {
  return GAMES.get(userId);
}

export function newGame(userId: string): Game {
  const g: Game = {
    userId,
    ballOn: 25,
    down: 1,
    toGo: 10,
    status: 'live',
    points: 0,
    plays: [],
    startedAt: Date.now(),
  };
  GAMES.set(userId, g);
  return g;
}

export function endGame(userId: string): void {
  GAMES.delete(userId);
}

/** Player selected an offensive call; we now need a direction. */
export function chooseOffense(g: Game, offId: string): boolean {
  if (g.status !== 'live') return false;
  if (!getOffense(offId)) return false;
  g.pendingOff = offId;
  g.status = 'await_dir';
  return true;
}

/** Goal-to-go distance helper: never let toGo run past the goal line. */
function firstDownDistance(ballOn: number): number {
  return ballOn >= 90 ? 100 - ballOn : 10;
}

/**
 * Resolve the down: bot picks defense, engine resolves the matchup, grader scores it, then
 * we apply field position, downs and end conditions. Returns the play record.
 */
export function resolveDown(g: Game, dir: Dir, rng: () => number = Math.random): PlayRecord | null {
  if (g.status !== 'await_dir' || !g.pendingOff) return null;
  const off = getOffense(g.pendingOff)!;
  const def = botPickDefense({ down: g.down, toGo: g.toGo, ballOn: g.ballOn }, rng);

  const model = off.kind === 'run' ? resolveRun(off.form, def.front, off.key, dir, def.coverage, off.motion ?? null) : resolvePass(off.form, def.front, off.key, dir, def.coverage);
  const outcome = gradePlay(off, def, model, rng);

  const before = g.ballOn;
  let gainTo = before + outcome.yards;
  let note = '';

  if (outcome.turnover) {
    note = outcome.kind === 'INT' ? 'INTERCEPTED' : 'FUMBLE LOST';
    g.status = 'over';
    g.endline = outcome.kind === 'INT' ? 'Picked off. Drive over.' : 'Fumble lost. Drive over.';
  } else if (gainTo >= 100) {
    note = 'TOUCHDOWN';
    g.points += 7;
    gainTo = 100;
    g.status = 'over';
    g.endline = `TOUCHDOWN. ${g.plays.length + 1} plays, drive of your life.`;
  } else if (gainTo <= 0) {
    note = 'SAFETY';
    gainTo = 0;
    g.status = 'over';
    g.endline = 'Tackled in your own end zone. Safety.';
  } else {
    // normal play: update chains
    const gained = gainTo - before;
    if (gained >= g.toGo) {
      g.ballOn = gainTo;
      g.down = 1;
      g.toGo = firstDownDistance(gainTo);
      note = gainTo >= 90 ? 'FIRST DOWN (goal to go)' : 'FIRST DOWN';
    } else if (g.down >= 4) {
      g.ballOn = gainTo;
      g.status = 'over';
      note = 'TURNOVER ON DOWNS';
      g.endline = 'Came up short on fourth down. Drive over.';
    } else {
      g.ballOn = gainTo;
      g.down += 1;
      g.toGo = Math.max(1, g.toGo - gained);
      note = `${ordinal(g.down)} & ${g.toGo === 100 - g.ballOn && g.ballOn >= 90 ? 'goal' : g.toGo}`;
    }
  }

  const rec: PlayRecord = { down: g.down, toGo: g.toGo, ballOn: before, off, def, dir, model, outcome, gainTo, note };
  g.plays.push(rec);
  g.last = rec;
  g.pendingOff = undefined;
  if (g.status !== 'over') g.status = 'live';
  return rec;
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** "your 25", "OPP 30", "midfield" from a 0-100 ball position. */
export function fieldLabel(ballOn: number): string {
  if (ballOn === 50) return 'midfield';
  if (ballOn < 50) return `your ${ballOn}`;
  return `OPP ${100 - ballOn}`;
}

/** "1st & 10 at your 25" / "3rd & goal at OPP 4". */
export function situationLine(g: Game): string {
  const goalToGo = g.ballOn >= 90 && g.toGo >= 100 - g.ballOn;
  const dist = goalToGo ? 'goal' : g.toGo;
  return `${ordinal(g.down)} & ${dist} at ${fieldLabel(g.ballOn)}`;
}

/** Periodically clear out abandoned drives so the Map does not grow unbounded. */
export function sweepStaleGames(maxAgeMs = 60 * 60 * 1000): number {
  const now = Date.now();
  let removed = 0;
  for (const [uid, g] of GAMES) {
    if (now - g.startedAt > maxAgeMs) {
      GAMES.delete(uid);
      removed++;
    }
  }
  return removed;
}
