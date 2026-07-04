/**
 * Playsheet builder — turn a declared scheme into call-sheet sections.
 *
 * Reproduces the SchemeGuide Field & Shell + Conceptual call sheets, but AUTO-FILLED from the
 * scheme's concepts using the engine's canon coverage matchups: a pass concept lands in
 * "2 HIGH BEATERS" or "1 HIGH BEATERS" based on which shells its engine concept actually beats;
 * runs fill "LIGHT BOX"/"SHORT YARDAGE"; deep/medium fill "3RD & LONG"; RPO/screens fill "SCREENS".
 * The blank variant emits the same labelled sections with empty cells (a sellable template).
 */

import { getConcept as engineConcept } from '../playcall/engine';
import { Concept } from './data';
import { conceptsByBucket, SchemeBuild } from './builder';

const ONE_HIGH = ['cover-1', 'cover-3'];
const TWO_HIGH = ['cover-2', 'cover-4', 'cover-6'];

export interface Cell {
  concept: string;
  play: string; // a representative call (M24 reference) or the concept itself
}
export interface Section {
  title: string;
  cells: Cell[];
}
export interface Sheet {
  kind: 'field-shell' | 'conceptual';
  scheme: string;
  tempo: string;
  columns: Section[][]; // grouped into visual columns
}

function cellFor(c: Concept): Cell {
  return { concept: c.name, play: c.examples[0]?.play ?? c.name };
}

function beatsShells(c: Concept): { one: boolean; two: boolean } {
  if (c.side === 'run' || !c.engineConcept) return { one: false, two: false };
  const beats = engineConcept(c.engineConcept)?.beats ?? [];
  return { one: beats.some((b) => ONE_HIGH.includes(b)), two: beats.some((b) => TWO_HIGH.includes(b)) };
}

function concepts(b: SchemeBuild): Concept[] {
  return conceptsByBucket(b).flatMap((g) => g.concepts);
}

/** Field & Shell sheet: drive starters, screens, the 2-high / 1-high / light-box open-field grid,
 * short yardage, and third-and-long. */
export function fieldShellSheet(b: SchemeBuild): Sheet {
  const cs = concepts(b);
  const runs = cs.filter((c) => c.side === 'run');
  const passes = cs.filter((c) => c.side === 'pass');

  const twoHigh = passes.filter((c) => beatsShells(c).two).map(cellFor);
  const oneHigh = passes.filter((c) => beatsShells(c).one).map(cellFor);
  const neutral = passes.filter((c) => { const s = beatsShells(c); return !s.one && !s.two; }).map(cellFor);
  // a pass that beats neither named shell still belongs somewhere; drop it into both columns thin
  if (oneHigh.length < 2) oneHigh.push(...neutral.slice(0, 2));
  if (twoHigh.length < 2) twoHigh.push(...neutral.slice(0, 2));

  const lightBox = runs.map(cellFor);
  const screens = cs.filter((c) => c.bucket === 'rpo' || /screen/i.test(c.engineConcept ?? '')).map(cellFor);
  const shortYardage = cs.filter((c) => c.bucket === 'gap_run' || c.bucket === 'pa').map(cellFor);
  const thirdLong = cs.filter((c) => c.bucket === 'deep' || c.bucket === 'medium').map(cellFor);
  const driveStarters = [runs[0], passes.find((c) => c.bucket === 'quick'), passes.find((c) => c.bucket === 'medium')].filter(Boolean).map((c) => cellFor(c as Concept));

  return {
    kind: 'field-shell',
    scheme: b.schemeId ?? 'custom',
    tempo: b.tempoId ?? '',
    columns: [
      [
        { title: 'DRIVE STARTERS', cells: driveStarters },
        { title: '2 HIGH BEATERS', cells: twoHigh },
      ],
      [
        { title: '1 HIGH BEATERS', cells: oneHigh },
        { title: 'LIGHT BOX', cells: lightBox },
      ],
      [
        { title: 'SCREENS', cells: screens },
        { title: 'SHORT YARDAGE', cells: shortYardage },
        { title: '3RD & LONG', cells: thirdLong },
      ],
    ],
  };
}

/** Conceptual sheet: runs / quicks / dropback + openers / short yardage / third-and-long. */
export function conceptualSheet(b: SchemeBuild): Sheet {
  const cs = concepts(b);
  const runs = cs.filter((c) => c.side === 'run').map(cellFor);
  const quicks = cs.filter((c) => c.bucket === 'quick' || c.bucket === 'rpo').map(cellFor);
  const dropback = cs.filter((c) => c.bucket === 'medium' || c.bucket === 'deep' || c.bucket === 'pa').map(cellFor);
  const openers = cs.slice(0, 6).map(cellFor);
  const shortYardage = cs.filter((c) => c.bucket === 'gap_run' || c.bucket === 'pa').map(cellFor);
  const thirdLong = cs.filter((c) => c.bucket === 'deep' || c.bucket === 'medium').map(cellFor);
  return {
    kind: 'conceptual',
    scheme: b.schemeId ?? 'custom',
    tempo: b.tempoId ?? '',
    columns: [[{ title: 'RUNS', cells: runs }], [{ title: 'QUICKS', cells: quicks }], [{ title: 'DROPBACK', cells: dropback }], [{ title: 'OPENERS', cells: openers }, { title: 'SHORT YARDAGE', cells: shortYardage }, { title: '3RD & LONG', cells: thirdLong }]],
  };
}

/** Replace every cell with an empty one (the blank, sellable template) while keeping the labels. */
export function blankSheet(sheet: Sheet, rowsPerSection = 8): Sheet {
  return {
    ...sheet,
    columns: sheet.columns.map((col) => col.map((sec) => ({ title: sec.title, cells: Array.from({ length: rowsPerSection }, () => ({ concept: '', play: '' })) }))),
  };
}
