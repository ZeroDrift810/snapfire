/**
 * Teaching-card content loader.
 *
 * Loads the authored knowledge (glossary, coverages, concepts, fronts, usering)
 * from content/*.json. These cards carry the real, sourced teaching content from
 * the iMoveChainz V2 system. The Playbook track (schemes + play art) is handled
 * separately by the existing knowledge loader.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Section {
  heading: string;
  body: string;
}

export interface Card {
  id: string;
  name: string;
  subtitle?: string;
  sections: Section[];
  related?: string[];
  tags?: string[];
  /** Optional diagram filename in assets/card_art/ (engine-generated, original art). */
  image?: string;
}

export type CardTrack = 'glossary' | 'coverage' | 'concept' | 'front' | 'usering' | 'situational';

export const CARD_TRACKS: CardTrack[] = ['glossary', 'coverage', 'concept', 'front', 'usering', 'situational'];

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const FILES: Record<CardTrack, string> = {
  glossary: 'glossary.json',
  coverage: 'coverages.json',
  concept: 'concepts.json',
  front: 'fronts.json',
  usering: 'usering.json',
  situational: 'situational.json',
};

// Resolution order for cross-track related links: prefer the fuller cards,
// fall back to the glossary definition.
const RESOLVE_ORDER: CardTrack[] = ['coverage', 'concept', 'front', 'usering', 'situational', 'glossary'];

const cards: Record<CardTrack, Card[]> = {
  glossary: [],
  coverage: [],
  concept: [],
  front: [],
  usering: [],
  situational: [],
};

let loaded = false;

export function loadCards(): void {
  if (loaded) return;
  for (const track of CARD_TRACKS) {
    const fp = path.join(PROJECT_ROOT, 'content', FILES[track]);
    try {
      if (!fs.existsSync(fp)) {
        console.error(`❌ Content file not found: ${fp}`);
        cards[track] = [];
        continue;
      }
      const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      cards[track] = Array.isArray(data) ? (data as Card[]) : [];
      console.log(`   ✓ Loaded ${cards[track].length} ${track} cards`);
    } catch (err) {
      console.error(`❌ Error loading ${track} cards:`, err);
      cards[track] = [];
    }
  }
  loaded = true;
}

/** Re-read all content/*.json in place (for hot-reload without a restart). */
export function reloadCards(): void {
  loaded = false;
  for (const t of CARD_TRACKS) cards[t] = [];
  loadCards();
}

export function getCards(track: CardTrack): Card[] {
  return cards[track];
}

export function getCard(track: CardTrack, id: string): Card | null {
  return cards[track].find((c) => c.id === id) || null;
}

/** Resolve a related-link id to whichever track owns it (fuller cards win). */
export function resolveCard(id: string): { track: CardTrack; card: Card } | null {
  for (const track of RESOLVE_ORDER) {
    const card = cards[track].find((c) => c.id === id);
    if (card) return { track, card };
  }
  return null;
}

export function cardStats(): Record<CardTrack, number> {
  return {
    glossary: cards.glossary.length,
    coverage: cards.coverage.length,
    concept: cards.concept.length,
    front: cards.front.length,
    usering: cards.usering.length,
    situational: cards.situational.length,
  };
}
