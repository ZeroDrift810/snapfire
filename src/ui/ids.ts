/**
 * customId grammar + track/facet definitions for the button-driven teaching UI.
 *
 * Tracks:
 *   glossary  📖  authored term definitions
 *   coverage  🛡️  defensive coverage shells (correct + how to beat each)
 *   concept   📘  offensive concepts (with the conflict-defender read)
 *   front     🧱  defensive fronts (with what beats each)
 *   usering   🎮  the iMoveChainz DB-usering system
 *   playbook  🏈  SnapFire/Shinobi schemes with play art
 *   situational 🎯  Madden pressure & tactics (disguised rush, the bucket, the checks)
 *
 * Grammar (colon-delimited, under the "imc" namespace, well under Discord's 100 char cap):
 *   imc:open:<track>                 public-hub button -> opens a private session
 *   imc:hub                          session hub view
 *   imc:list:<track>:<filter>:<page> browse list (also "back to list")
 *   imc:pg:<track>:<filter>:<dir>:<page>  pager button (dir = p|n, keeps ids unique)
 *   imc:pick:<track>:<filter>:<page> select menu -> value carries the chosen id
 *   imc:goto:<id>                    related-link button -> jump to that card in its track
 *
 * There are NO slash commands anywhere in this bot.
 */

export type Track = 'glossary' | 'coverage' | 'concept' | 'run' | 'front' | 'usering' | 'playbook' | 'situational';

export interface Facet {
  token: string;
  label: string;
}

export const TRACKS: Track[] = ['glossary', 'coverage', 'concept', 'run', 'front', 'usering', 'playbook', 'situational'];

export const TRACK_LABEL: Record<Track, string> = {
  glossary: 'Terms',
  coverage: 'Coverages',
  concept: 'Concepts',
  run: 'Run Game',
  front: 'Fronts',
  usering: 'Usering',
  playbook: 'Playbook',
  situational: 'Situational',
};

export const TRACK_EMOJI: Record<Track, string> = {
  glossary: '📖',
  coverage: '🛡️',
  concept: '📘',
  run: '🏃🏿',
  front: '🧱',
  usering: '🎮',
  playbook: '🏈',
  situational: '🎯',
};

export const TRACK_BLURB: Record<Track, string> = {
  glossary: 'Plain-language definitions. Tap any term to learn it.',
  coverage: 'Read the shell, find the void, learn how to beat it.',
  concept: 'Offensive concepts and the one defender each one reads.',
  run: 'Run schemes: how the blocks fit and where the ball hits.',
  front: 'Defensive fronts and what beats them.',
  usering: 'The iMoveChainz way to user the sticks: play the DBs.',
  playbook: 'SnapFire offense and Shinobi defense, matched to the in-game art.',
  situational: 'Madden pressure and tactics: disguised rushes, the bucket, the checks.',
};

/** Filter facets per track. Only the playbook splits by system; cards browse with a single list. */
export const FACETS: Record<Track, Facet[]> = {
  glossary: [],
  coverage: [],
  concept: [],
  run: [],
  front: [],
  usering: [],
  situational: [],
  playbook: [
    { token: 'snapfire', label: '🔥 SnapFire' },
    { token: 'shinobi', label: '🥷🏿 Shinobi' },
  ],
};

export const DEFAULT_FILTER: Record<Track, string> = {
  glossary: 'all',
  coverage: 'all',
  concept: 'all',
  run: 'all',
  front: 'all',
  usering: 'all',
  situational: 'all',
  playbook: 'snapfire',
};

export const PAGE_SIZE = 25;

export const ID = {
  openTrack: (t: Track) => `imc:open:${t}`,
  hub: 'imc:hub',
  list: (t: Track, f: string, p: number) => `imc:list:${t}:${f}:${p}`,
  page: (t: Track, f: string, dir: 'p' | 'n', p: number) => `imc:pg:${t}:${f}:${dir}:${p}`,
  pick: (t: Track, f: string, p: number) => `imc:pick:${t}:${f}:${p}`,
  goto: (id: string) => `imc:goto:${id}`,
  // Public-safe deep link: open a specific card in a private (ephemeral) session.
  // Used by autopost engagement messages on public channels.
  show: (t: Track, id: string) => `imc:show:${t}:${id}`,
  // Operator control hub actions (owner-gated, side-effecting; handled outside resolve()).
  op: (action: string) => `imc:op:${action}`,
};

export function isTrack(v: string): v is Track {
  return (
    v === 'glossary' ||
    v === 'coverage' ||
    v === 'concept' ||
    v === 'run' ||
    v === 'front' ||
    v === 'usering' ||
    v === 'playbook' ||
    v === 'situational'
  );
}

export function isCardTrack(t: Track): boolean {
  return t !== 'playbook';
}

export function parseId(id: string): string[] {
  return id.split(':');
}
