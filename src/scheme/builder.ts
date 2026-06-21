/**
 * Scheme Identity build state + roadmap.
 *
 * In-memory per user (one build at a time): the authoring flow declares a base scheme, tempo, and
 * up to ~12 core concepts, then we derive the "custom playbook roadmap" (which formations carry the
 * most of your concepts, with example plays) and a balance check against the recommended per-bucket
 * counts. The resulting SchemeBuild is what the artifact renderer + content library consume.
 */

import { allBuckets, conceptsInBucket, Concept, getConcept } from './data';

export const CORE_TARGET = 12; // the soft cap from the Scheme 101 declaration process

// Concept pickers are grouped so each select stays under Discord's 25-option limit.
export const GROUPS: { id: 'run' | 'qpa' | 'pass'; label: string; buckets: string[] }[] = [
  { id: 'run', label: 'Run game (Gap / Zone / Option-RPO)', buckets: ['gap_run', 'zone_run', 'rpo'] },
  { id: 'qpa', label: 'Quick game + Play action', buckets: ['quick', 'pa'] },
  { id: 'pass', label: 'Dropback pass (Medium / Deep)', buckets: ['medium', 'deep'] },
];

export function groupConcepts(groupId: 'run' | 'qpa' | 'pass'): Concept[] {
  const g = GROUPS.find((x) => x.id === groupId)!;
  return g.buckets.flatMap((b) => conceptsInBucket(b));
}

export interface SchemeBuild {
  userId: string;
  schemeId?: string;
  tempoId?: string;
  concepts: string[]; // concept ids, declaration order preserved
  createdAt: number;
}

const BUILDS = new Map<string, SchemeBuild>();

export const getBuild = (userId: string): SchemeBuild | undefined => BUILDS.get(userId);
export function newBuild(userId: string): SchemeBuild {
  const b: SchemeBuild = { userId, concepts: [], createdAt: Date.now() };
  BUILDS.set(userId, b);
  return b;
}
export function setScheme(b: SchemeBuild, schemeId: string): void {
  b.schemeId = schemeId;
}
export function setTempo(b: SchemeBuild, tempoId: string): void {
  b.tempoId = tempoId;
}

/** Replace the concepts that belong to a picker group with the new selection (others untouched). */
export function setGroupConcepts(b: SchemeBuild, groupId: 'run' | 'qpa' | 'pass', conceptIds: string[]): void {
  const groupIds = new Set(groupConcepts(groupId).map((c) => c.id));
  const kept = b.concepts.filter((id) => !groupIds.has(id));
  const added = conceptIds.filter((id) => groupIds.has(id));
  b.concepts = [...kept, ...added];
}

export interface BucketBalance {
  id: string;
  label: string;
  count: number;
  recommended: [number, number];
  status: 'ok' | 'low' | 'high';
}

export function balance(b: SchemeBuild): BucketBalance[] {
  return allBuckets().map((bk) => {
    const count = b.concepts.filter((id) => getConcept(id)?.bucket === bk.id).length;
    const [lo, hi] = bk.recommended;
    const status: BucketBalance['status'] = count < lo ? 'low' : count > hi ? 'high' : 'ok';
    return { id: bk.id, label: bk.label, count, recommended: bk.recommended, status };
  });
}

export interface RoadmapFormation {
  formation: string;
  conceptCount: number; // how many of your concepts this formation carries
  total: number; // total tagged plays
}

/** Custom playbook roadmap: rank formations by how many of your chosen concepts they carry. */
export function roadmap(b: SchemeBuild): RoadmapFormation[] {
  const byFormation = new Map<string, { concepts: Set<string>; total: number }>();
  for (const id of b.concepts) {
    const c = getConcept(id);
    if (!c) continue;
    for (const [form, n] of Object.entries(c.formations)) {
      const e = byFormation.get(form) ?? { concepts: new Set<string>(), total: 0 };
      e.concepts.add(id);
      e.total += n;
      byFormation.set(form, e);
    }
  }
  return [...byFormation.entries()]
    .map(([formation, e]) => ({ formation, conceptCount: e.concepts.size, total: e.total }))
    .sort((a, z) => z.conceptCount - a.conceptCount || z.total - a.total);
}

export function conceptsByBucket(b: SchemeBuild): { bucket: string; label: string; concepts: Concept[] }[] {
  return allBuckets()
    .map((bk) => ({ bucket: bk.id, label: bk.label, concepts: b.concepts.map((id) => getConcept(id)!).filter((c) => c && c.bucket === bk.id) }))
    .filter((g) => g.concepts.length > 0);
}

export function isComplete(b: SchemeBuild): boolean {
  return Boolean(b.tempoId) && b.concepts.length >= 1;
}
