/**
 * Playcall drive game — in-memory state machine.
 *
 * Two modes, same engine + grader + resolution path:
 *   - OFFENSE: you are SnapFire, you call a play + side each down, the Shinobi bot defends. You try
 *     to move the chains and score.
 *   - DEFENSE: you are Shinobi, the SnapFire bot has the ball and calls plays, you pick the front +
 *     coverage each down (one tap, no direction). You try to force stops and takeaways before they
 *     score.
 * No database: one drive per user in a Map (fits this lean, button-driven bot). PvP later swaps the
 * bot pick for a second player on the same applyPlay() core.
 */

import { getOffense, getDefense, botPickDefense, botPickOffense, DefenseCall, OffenseCall } from './catalog';
import { Dir, PlayModel, resolvePass, resolveRun } from './engine';
import { gradePlay, Outcome } from './grade';

export type GameMode = 'offense' | 'defense';

export interface PlayRecord {
  downAtSnap: number;
  toGoAtSnap: number;
  ballOn: number; // spot at the snap (line of scrimmage)
  off: OffenseCall;
  def: DefenseCall;
  dir: Dir;
  model: PlayModel;
  outcome: Outcome;
  gainTo: number; // spot after the play
  note: string; // "TOUCHDOWN", "FIRST DOWN", "TURNOVER ON DOWNS", "2nd & 6", ...
}

export type DriveStatus = 'live' | 'await_dir' | 'over';

export interface Game {
  userId: string;
  mode: GameMode;
  ballOn: number; // 0 = own goal, 100 = opponent goal (always from the offense's view)
  down: number;
  toGo: number;
  status: DriveStatus;
  points: number; // points scored on the drive by whoever has the ball
  plays: PlayRecord[];
  pendingOff?: string; // offense mode: chosen play id, awaiting direction
  last?: PlayRecord;
  endline?: string;
  startedAt: number;
}

const GAMES = new Map<string, Game>();

export function getGame(userId: string): Game | undefined {
  return GAMES.get(userId);
}

export function newGame(userId: string, mode: GameMode): Game {
  const g: Game = {
    userId,
    mode,
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

// --- OFFENSE mode: two-step (pick play, then direction) --------------------

export function chooseOffense(g: Game, offId: string): boolean {
  if (g.mode !== 'offense' || g.status !== 'live') return false;
  if (!getOffense(offId)) return false;
  g.pendingOff = offId;
  g.status = 'await_dir';
  return true;
}

export function resolveDown(g: Game, dir: Dir, rng: () => number = Math.random): PlayRecord | null {
  if (g.mode !== 'offense' || g.status !== 'await_dir' || !g.pendingOff) return null;
  const off = getOffense(g.pendingOff)!;
  const def = botPickDefense({ down: g.down, toGo: g.toGo, ballOn: g.ballOn }, rng);
  g.pendingOff = undefined;
  return applyPlay(g, off, def, dir, rng);
}

// --- DEFENSE mode: one-step (pick front + coverage; bot has the ball) -------

export function resolveAsDefense(g: Game, defId: string, rng: () => number = Math.random): PlayRecord | null {
  if (g.mode !== 'defense' || g.status !== 'live') return null;
  const def = getDefense(defId);
  if (!def) return null;
  const { off, dir } = botPickOffense({ down: g.down, toGo: g.toGo, ballOn: g.ballOn }, rng);
  return applyPlay(g, off, def, dir, rng);
}

// --- shared resolution: engine resolve -> grade -> apply field + downs ------

function firstDownDistance(ballOn: number): number {
  return ballOn >= 90 ? 100 - ballOn : 10;
}

function applyPlay(g: Game, off: OffenseCall, def: DefenseCall, dir: Dir, rng: () => number): PlayRecord {
  const model = off.kind === 'run' ? resolveRun(off.form, def.front, off.key, dir, def.coverage, off.motion ?? null) : resolvePass(off.form, def.front, off.key, dir, def.coverage);
  const outcome = gradePlay(off, def, model, rng);

  const downAtSnap = g.down;
  const toGoAtSnap = g.toGo;
  const before = g.ballOn;
  let gainTo = before + outcome.yards;
  let note = '';
  const defended = g.mode === 'defense'; // player perspective for the endline copy

  if (outcome.turnover) {
    note = outcome.kind === 'INT' ? 'INTERCEPTED' : 'FUMBLE LOST';
    g.status = 'over';
    g.endline = defended ? 'Takeaway. You got the ball back.' : outcome.kind === 'INT' ? 'Picked off. Drive over.' : 'Fumble lost. Drive over.';
  } else if (gainTo >= 100) {
    note = 'TOUCHDOWN';
    g.points += 7;
    gainTo = 100;
    g.status = 'over';
    g.endline = defended ? 'They punched it in. Touchdown allowed.' : `Touchdown. ${g.plays.length + 1} plays, cash it.`;
  } else if (gainTo <= 0) {
    note = 'SAFETY';
    gainTo = 0;
    g.status = 'over';
    g.endline = defended ? 'Safety. You stuffed them in the end zone.' : 'Tackled in your own end zone. Safety.';
  } else {
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
      g.endline = defended ? 'Fourth-down stop. Get off the field.' : 'Came up short on fourth down. Drive over.';
    } else {
      g.ballOn = gainTo;
      g.down += 1;
      g.toGo = Math.max(1, g.toGo - gained);
      note = `${ordinal(g.down)} & ${g.toGo}`;
    }
  }

  const rec: PlayRecord = { downAtSnap, toGoAtSnap, ballOn: before, off, def, dir, model, outcome, gainTo, note };
  g.plays.push(rec);
  g.last = rec;
  if (g.status !== 'over') g.status = 'live';
  return rec;
}

// --- formatting helpers ----------------------------------------------------

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

export function fieldLabel(ballOn: number): string {
  if (ballOn === 50) return 'midfield';
  if (ballOn < 50) return `your ${ballOn}`;
  return `OPP ${100 - ballOn}`;
}

export function situationLine(g: Game): string {
  const goalToGo = g.ballOn >= 90 && g.toGo >= 100 - g.ballOn;
  const dist = goalToGo ? 'goal' : g.toGo;
  return `${ordinal(g.down)} & ${dist} at ${fieldLabel(g.ballOn)}`;
}

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
