/**
 * Scheme Builder data loader.
 *
 * Loads the ingested SchemeGuide taxonomy (data/scheme/*.json, produced by
 * tools/ingest-playbook-creator.py from the M24 Playbook Creator). The 35-concept declaration
 * taxonomy, buckets + recommended counts, schemes/tempos/formations and the defensive vocabulary
 * are evergreen; the per-concept example plays are M24 REFERENCE and each concept carries the
 * HimkageVision engine key so artifacts can render the real diagram.
 */

import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve(__dirname, '..', '..', 'data', 'scheme');

export interface ConceptExample {
  play: string;
  formation: string | null;
}
export interface Concept {
  id: string;
  name: string;
  bucket: string;
  bucketLabel: string;
  side: 'run' | 'pass';
  engineConcept: string | null;
  formations: Record<string, number>;
  examples: ConceptExample[];
}
export interface Bucket {
  id: string;
  label: string;
  recommended: [number, number];
}
export interface NamedItem {
  id: string;
  name: string;
}
export interface DefenseVocab {
  shells: string[];
  coverages: string[];
  coverageTypes: string[];
  base: string[];
  schemes: string[];
  fronts: string[];
  formations: string[];
}

interface Store {
  concepts: Concept[];
  buckets: Bucket[];
  schemes: NamedItem[];
  tempos: NamedItem[];
  formations: string[];
  defense: DefenseVocab;
}

let store: Store | null = null;

function readJson<T>(file: string, fallback: T): T {
  try {
    const fp = path.join(DIR, file);
    if (!fs.existsSync(fp)) {
      console.error(`❌ Scheme data missing: ${fp}`);
      return fallback;
    }
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T;
  } catch (e) {
    console.error(`❌ Scheme data load failed for ${file}:`, e);
    return fallback;
  }
}

export function loadSchemeData(): void {
  store = {
    concepts: readJson<Concept[]>('concepts.json', []),
    buckets: readJson<Bucket[]>('buckets.json', []),
    schemes: readJson<NamedItem[]>('schemes.json', []),
    tempos: readJson<NamedItem[]>('tempos.json', []),
    formations: readJson<string[]>('formations.json', []),
    defense: readJson<DefenseVocab>('defense.json', { shells: [], coverages: [], coverageTypes: [], base: [], schemes: [], fronts: [], formations: [] }),
  };
  console.log(`   ✓ Loaded scheme builder: ${store.concepts.length} concepts, ${store.schemes.length} schemes, ${store.tempos.length} tempos`);
}

function data(): Store {
  if (!store) loadSchemeData();
  return store!;
}

export const allConcepts = (): Concept[] => data().concepts;
export const conceptsInBucket = (bucket: string): Concept[] => data().concepts.filter((c) => c.bucket === bucket);
export const getConcept = (id: string): Concept | undefined => data().concepts.find((c) => c.id === id);
export const allBuckets = (): Bucket[] => data().buckets;
export const getBucket = (id: string): Bucket | undefined => data().buckets.find((b) => b.id === id);
export const allSchemes = (): NamedItem[] => data().schemes;
export const getScheme = (id: string): NamedItem | undefined => data().schemes.find((s) => s.id === id);
export const allTempos = (): NamedItem[] => data().tempos;
export const getTempo = (id: string): NamedItem | undefined => data().tempos.find((t) => t.id === id);
export const offFormations = (): string[] => data().formations;
export const defenseVocab = (): DefenseVocab => data().defense;
