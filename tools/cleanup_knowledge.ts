/**
 * Cleanup Script for Concept and Coverage Knowledge Bases
 * Fixes: underscores, truncated names, jammed words, casing
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// MAPPING: Truncated concepts → Full names
// ============================================================================

const CONCEPT_FIXES: Record<string, string> = {
  'FOUR': 'Four Verticals',
  'FOUR_VERTS': 'Four Verticals',
  'FOUR_VERTICALS': 'Four Verticals',
  'VERTICALS': 'Four Verticals',
  'DEEP': 'Deep Crossers',
  'DEEP_DIG': 'Deep Dig',
  'DEEP_COMEBACK': 'Deep Comeback',
  'QUICK': 'Quick Game',
  'QUICK_SLANTS': 'Quick Slants',
  'HOT': 'Hot Routes',
  'PICK': 'Pick Plays',
  'RUB': 'Rub Routes',
  'MESH': 'Mesh Concept',
  'SMASH': 'Smash Concept',
  'FLOOD': 'Flood Concept',
  'BUNCH': 'Bunch Formation',
  'CROSSING': 'Crossing Routes',
  'SLOT': 'Slot Routes',
  'SEAM': 'Seam Routes',
  'CORNER': 'Corner Routes',
  'STICK': 'Stick Concept',
  'OPTION': 'Option Routes',
  'POWER': 'Power Run',
  'PLAY': 'Play Action',
  'OS': 'Outside Runs',
  'MAN': 'Man Coverage',
  'ZONE': 'Zone Coverage',
  'BLITZ': 'Blitz Pressure',
  'FADE': 'Fade Routes',
  'COMEBACK': 'Comeback Routes',
};

// ============================================================================
// JAMMED WORD FIXES
// ============================================================================

const JAMMED_FIXES: Record<string, string> = {
  'DOUBLESSMASH': 'Double Smash',
  'SPOTTRIANGLE': 'Spot Triangle',
  'TRAILFOLLOW': 'Trail Follow',
  'SLOT_DRIVELEVELS': 'Slot Drive Levels',
  'MESH_MILLS': 'Mesh Mills',
  'QUARTERQUARTERHALF': 'Quarter Quarter Half',
  'ROBBERTAMPA': 'Robber Tampa',
  'COVER_0GOAL': 'Cover 0 Goal',
  'COVER_0COVER': 'Cover 0 Cover',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanName(name: string): string {
  let cleaned = name;

  // Fix known jammed words first
  for (const [jammed, fixed] of Object.entries(JAMMED_FIXES)) {
    cleaned = cleaned.replace(new RegExp(jammed, 'gi'), fixed.toUpperCase().replace(/ /g, '_'));
  }

  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, ' ');

  // Handle concatenated coverage names like "COVER 0GOAL LINE MAN"
  cleaned = cleaned.replace(/(\d)([A-Z])/g, '$1 $2');

  // Title case
  cleaned = cleaned
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Keep certain words lowercase unless first
      const lowerWords = ['with', 'and', 'or', 'the', 'to', 'vs', 'on'];
      if (lowerWords.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  // Ensure first letter is capitalized
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Fix common patterns
  cleaned = cleaned
    .replace(/\bCover (\d)/g, 'Cover $1')
    .replace(/\bRpo\b/g, 'RPO')
    .replace(/\bTe\b/g, 'TE')
    .replace(/\bHb\b/g, 'HB')
    .replace(/\bQb\b/g, 'QB')
    .replace(/\bWr\b/g, 'WR')
    .replace(/\bRb\b/g, 'RB')
    .replace(/\bLb\b/g, 'LB')
    .replace(/\bDb\b/g, 'DB')
    .replace(/\bDl\b/g, 'DL')
    .replace(/\bFs\b/g, 'FS')
    .replace(/\bSs\b/g, 'SS')
    .replace(/\bMofo\b/g, 'MOFO')
    .replace(/\bMofc\b/g, 'MOFC')
    .replace(/\b5man\b/gi, '5-Man')
    .replace(/\b3deep\b/gi, '3-Deep')
    .replace(/\b2deep\b/gi, '2-Deep')
    .replace(/\b3under\b/gi, '3-Under')
    .replace(/\bMike\b/g, 'MIKE')
    .replace(/\bSam\b/g, 'SAM')
    .replace(/\bWill\b/g, 'WILL');

  return cleaned.trim();
}

function fixConceptReference(concept: string): string {
  // Check if it's a known truncated concept
  const upper = concept.toUpperCase().trim();
  if (CONCEPT_FIXES[upper]) {
    return CONCEPT_FIXES[upper];
  }

  // Otherwise clean the name
  return cleanName(concept);
}

// ============================================================================
// COVERAGE CLEANUP
// ============================================================================

function cleanCoverages() {
  const filePath = path.join(process.cwd(), 'data', 'Coverage_Knowledge.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`\nCleaning ${data.length} coverages...`);

  const cleaned = data.map((coverage: any) => {
    return {
      name: cleanName(coverage.name),
      shell: coverage.shell,
      strengths: coverage.strengths,
      weaknesses: coverage.weaknesses,
      beaten_by_concepts: coverage.beaten_by_concepts.map((c: string) => fixConceptReference(c)),
    };
  });

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`  ✓ Saved cleaned coverages`);

  // Show examples
  console.log('\n  Examples:');
  for (let i = 0; i < Math.min(5, cleaned.length); i++) {
    console.log(`    "${data[i].name}" → "${cleaned[i].name}"`);
    if (data[i].beaten_by_concepts.length > 0) {
      console.log(`      beaten_by: "${data[i].beaten_by_concepts[0]}" → "${cleaned[i].beaten_by_concepts[0]}"`);
    }
  }
}

// ============================================================================
// CONCEPT CLEANUP
// ============================================================================

function cleanConcepts() {
  const filePath = path.join(process.cwd(), 'data', 'Concept_Knowledge.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`\nCleaning ${data.length} concepts...`);

  const cleaned = data.map((concept: any) => {
    return {
      name: cleanName(concept.name),
      family: concept.family,
      core_idea: concept.core_idea,
      best_vs: concept.best_vs.map((c: string) => cleanName(c)),
      weak_vs: concept.weak_vs.map((c: string) => cleanName(c)),
    };
  });

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf-8');
  console.log(`  ✓ Saved cleaned concepts`);

  // Show examples
  console.log('\n  Examples:');
  for (let i = 0; i < Math.min(5, cleaned.length); i++) {
    console.log(`    "${data[i].name}" → "${cleaned[i].name}"`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('');
  console.log('='.repeat(80));
  console.log('iMoveChainz Knowledge Base Cleanup');
  console.log('='.repeat(80));

  cleanCoverages();
  cleanConcepts();

  console.log('\n' + '='.repeat(80));
  console.log('Cleanup complete!');
  console.log('='.repeat(80));
  console.log('');
}

main();
