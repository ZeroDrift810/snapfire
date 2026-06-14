/**
 * Knowledge Base Loader - Loads JSON data with graceful error handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConceptKnowledge, CoverageKnowledge, SchemeKnowledge } from './types';

let concepts: ConceptKnowledge[] = [];
let coverages: CoverageKnowledge[] = [];
let schemes: SchemeKnowledge[] = [];
let isLoaded = false;

// Get the directory where THIS file is located, then go up to project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function loadJsonFile<T>(filePath: string, dataName: string): T[] {
  try {
    console.log(`   Loading from: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Knowledge file not found: ${filePath}`);
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      console.error(`❌ ${dataName}: Expected array, got ${typeof data}`);
      return [];
    }
    console.log(`   ✓ Loaded ${data.length} ${dataName} entries`);
    return data as T[];
  } catch (error) {
    console.error(`❌ Error loading ${dataName}:`, error);
    return [];
  }
}

export function loadKnowledgeBases(): void {
  if (isLoaded) return;
  console.log('📚 Loading iMoveChainz Knowledge Bases...');
  console.log(`   Project root: ${PROJECT_ROOT}`);

  const dataDir = path.join(PROJECT_ROOT, 'data');

  concepts = loadJsonFile<ConceptKnowledge>(path.join(dataDir, 'Concept_Knowledge.json'), 'Concepts');
  coverages = loadJsonFile<CoverageKnowledge>(path.join(dataDir, 'Coverage_Knowledge.json'), 'Coverages');
  schemes = loadJsonFile<SchemeKnowledge>(path.join(dataDir, 'Scheme_Knowledge.json'), 'Schemes');

  // Concept_Knowledge.json and Coverage_Knowledge.json are intentionally empty: the
  // fabricated data was stripped (see data/REBUILD-STATUS.md), and the real concept/
  // coverage teaching now lives in content/*.json. So only an empty SCHEMES set is a
  // real failure; the empty concepts/coverages are expected and must not raise an alarm.
  if (schemes.length === 0) {
    console.error('❌ ERROR: Scheme_Knowledge.json loaded 0 entries (playbook + play art will be empty)');
  } else if (concepts.length === 0 || coverages.length === 0) {
    console.log('   (Concepts/Coverages intentionally empty, stripped; teaching is in content/*.json)');
  }

  isLoaded = true;
  console.log('✅ Knowledge base loading complete\n');
}

/** Re-read the data/*.json knowledge bases in place (for hot-reload without a restart). */
export function reloadKnowledgeBases(): void {
  isLoaded = false;
  loadKnowledgeBases();
}

export function getConceptByName(name: string): ConceptKnowledge | null {
  const search = name.toLowerCase().trim();
  return concepts.find(c => c.name.toLowerCase() === search) || null;
}

export function getCoverageByName(name: string): CoverageKnowledge | null {
  const search = name.toLowerCase().trim();
  return coverages.find(c => c.name.toLowerCase() === search) || null;
}

export function getSchemeByName(name: string): SchemeKnowledge | null {
  return schemes.find(s => s.name === name.toLowerCase().trim()) || null;
}

export function searchConcepts(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return concepts.map(c => c.name).slice(0, 25);
  return concepts.filter(c => c.name.toLowerCase().includes(q)).map(c => c.name).slice(0, 25);
}

export function searchCoverages(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return coverages.map(c => c.name).slice(0, 25);
  return coverages.filter(c => c.name.toLowerCase().includes(q)).map(c => c.name).slice(0, 25);
}

export function searchSchemes(query: string): Array<{ name: string; value: string }> {
  const q = query.toLowerCase().trim();
  const filtered = !q ? schemes : schemes.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.display_name.toLowerCase().includes(q) ||
    s.system.toLowerCase().includes(q)
  );
  return filtered.map(s => ({
    name: `[${s.system}] ${s.display_name}`,
    value: s.name
  })).slice(0, 25);
}

export function getAllConcepts(): ConceptKnowledge[] {
  return concepts;
}

export function getAllCoverages(): CoverageKnowledge[] {
  return coverages;
}

export function getAllSchemes(): SchemeKnowledge[] {
  return schemes;
}

export function getKnowledgeStats() {
  return {
    concepts: concepts.length,
    coverages: coverages.length,
    schemes: schemes.length,
    snapfire: schemes.filter(s => s.system === 'SNAPFIRE').length,
    shinobi: schemes.filter(s => s.system === 'SHINOBI').length,
    isLoaded
  };
}
