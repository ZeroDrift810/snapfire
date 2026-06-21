/**
 * Playcall grader simulation harness.
 *
 * Validates that the engine-resolved grader produces sane, differentiated outcomes across the
 * full offense x defense catalog: it resolves each matchup through the real engine and rolls the
 * grader N times with a seeded RNG, then prints average yards, explosive rate, and turnover rate.
 * Run: npx tsx scripts/sim-playcall.ts [N]
 */

import { OFFENSE, DEFENSE } from '../src/playcall/catalog';
import { resolveRun, resolvePass, Dir } from '../src/playcall/engine';
import { gradePlay, Outcome } from '../src/playcall/grade';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = Number.parseInt(process.argv[2] ?? '4000', 10);
const rng = mulberry32(20260620);

function summarize(samples: Outcome[]) {
  const n = samples.length;
  const avg = samples.reduce((s, o) => s + o.yards, 0) / n;
  const expl = samples.filter((o) => o.explosive).length / n;
  const to = samples.filter((o) => o.turnover).length / n;
  const sack = samples.filter((o) => o.kind === 'SACK').length / n;
  const neg = samples.filter((o) => o.yards < 0).length / n;
  return { avg, expl, to, sack, neg };
}

console.log(`\nPlaycall grader sim — ${N} rolls per matchup (dir alternates)\n`);
const header = ['OFFENSE \\ DEFENSE', ...DEFENSE.map((d) => d.id.padStart(8))].join(' ');
console.log(header);
console.log('-'.repeat(header.length));

for (const off of OFFENSE) {
  const cells: string[] = [];
  for (const def of DEFENSE) {
    const samples: Outcome[] = [];
    for (let i = 0; i < N; i++) {
      const dir: Dir = i % 2 === 0 ? 1 : -1;
      const model = off.kind === 'run' ? resolveRun(off.form, def.front, off.key, dir, def.coverage, off.motion ?? null) : resolvePass(off.form, def.front, off.key, dir, def.coverage);
      samples.push(gradePlay(off, def, model, rng));
    }
    const s = summarize(samples);
    cells.push(s.avg.toFixed(1).padStart(8));
  }
  console.log([`${off.id} (${off.kind})`.padEnd(17), ...cells].join(' '));
}

console.log('\nKey matchup spot-checks (avg yds / explosive% / TO% / sack%):');
function spot(offId: string, defId: string) {
  const off = OFFENSE.find((o) => o.id === offId)!;
  const def = DEFENSE.find((d) => d.id === defId)!;
  const samples: Outcome[] = [];
  for (let i = 0; i < N; i++) {
    const dir: Dir = i % 2 === 0 ? 1 : -1;
    const model = off.kind === 'run' ? resolveRun(off.form, def.front, off.key, dir, def.coverage, off.motion ?? null) : resolvePass(off.form, def.front, off.key, dir, def.coverage);
    samples.push(gradePlay(off, def, model, rng));
  }
  const s = summarize(samples);
  console.log(`  ${off.label.padEnd(16)} vs ${def.label.padEnd(16)}  ${s.avg.toFixed(1).padStart(5)}  ${(s.expl * 100).toFixed(0).padStart(3)}%  ${(s.to * 100).toFixed(0).padStart(3)}%  ${(s.sack * 100).toFixed(0).padStart(3)}%`);
}
spot('verts', 'base3'); // beats cover-3 -> should be strong
spot('verts', 'quarters'); // beaten_by cover-4 -> should be weak / picky
spot('smash', 'nickel2'); // beats cover-2 -> strong
spot('smash', 'quarters'); // beaten_by cover-4 -> weak
spot('iz', 'bear0'); // run into loaded blitz box -> boom/bust, low avg, neg-heavy
spot('iz', 'quarters'); // run vs light box -> strong
spot('power', 'prevent'); // run vs soft prevent -> strong
spot('slants', 'fire1'); // quick vs pressure -> beats the blitz, low sack
spot('verts', 'fire1'); // shot vs pressure -> sack-prone
spot('mesh', 'man1'); // mesh rubs man -> good
console.log('');
