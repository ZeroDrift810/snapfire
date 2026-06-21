/**
 * Smoke test: validates all routing, buttons, and content with no Discord connection.
 *
 * Part A  Graph closure: from the public hub, walk every button and select menu the UI
 *         can emit (including related-link "goto" jumps). Every id must route, every
 *         payload must be a valid Discord message, and select picks must open a real page.
 * Part B  Exhaustive content: build the detail view for every card (all tracks) and every
 *         scheme. Every "related" link must resolve (no dead buttons). Every scheme that
 *         names play art must attach a real file.
 * Part C  Structure: assert there is no slash-command surface left in the codebase.
 *
 * Exits non-zero on any failure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadKnowledgeBases, getAllSchemes } from '../src/knowledge/loader';
import { loadCards, getCards, resolveCard, cardStats, CARD_TRACKS } from '../src/content/cards';
import { buildHubPublic, buildDetail, ViewPayload } from '../src/ui/views';
import { resolve } from '../src/router';
import { DEFAULT_FILTER, Track } from '../src/ui/ids';
import { AUTOPOST_ITEMS, BUILDERS } from '../src/engagement/items';
import { buildOperatorHub, operatorActionIds } from '../src/operator/operator';
import { buildDirView, buildOverView, buildStartView, buildTurnView } from '../src/playcall/views';
import { chooseOffense, getGame, newGame, resolveAsDefense, resolveDown } from '../src/playcall/game';
import { OFFENSE, DEFENSE } from '../src/playcall/catalog';
import { Dir } from '../src/playcall/engine';
import { loadSchemeData, allSchemes, allTempos } from '../src/scheme/data';
import { newBuild, setScheme, setTempo, setGroupConcepts, groupConcepts } from '../src/scheme/builder';
import { buildSetupView, buildConceptView, buildIdentityView } from '../src/scheme/views';

const errors: string[] = [];
let routesTested = 0;
let detailsTested = 0;
let relatedChecked = 0;

function fail(msg: string) {
  errors.push(msg);
}

// --- payload introspection ------------------------------------------------

function extractComponents(payload: ViewPayload): {
  buttons: string[];
  selects: { id: string; firstValue?: string }[];
} {
  const buttons: string[] = [];
  const selects: { id: string; firstValue?: string }[] = [];
  for (const row of payload.components as any[]) {
    for (const comp of row.components ?? []) {
      const type = comp.data?.type;
      const cid = comp.data?.custom_id;
      if (type === 3) {
        const opts = (comp.options ?? []) as any[];
        if (cid) selects.push({ id: cid, firstValue: opts[0]?.data?.value });
      } else if (type === 2) {
        if (cid) buttons.push(cid);
      }
    }
  }
  return { buttons, selects };
}

function embedLength(d: any): number {
  let n = 0;
  if (d.title) n += d.title.length;
  if (d.description) n += d.description.length;
  if (d.footer?.text) n += d.footer.text.length;
  for (const f of d.fields ?? []) n += (f.name?.length ?? 0) + (f.value?.length ?? 0);
  return n;
}

/** Mirrors the Discord form-body rules the API enforces, including custom_id uniqueness. */
function validatePayload(payload: ViewPayload, label: string) {
  if (!payload.embeds || payload.embeds.length < 1) fail(`${label}: no embed`);
  for (const e of payload.embeds ?? []) {
    const d = (e as any).data ?? {};
    if (d.title && d.title.length > 256) fail(`${label}: embed title > 256`);
    if (d.description && d.description.length > 4096) fail(`${label}: description > 4096`);
    if (d.footer?.text && d.footer.text.length > 2048) fail(`${label}: footer > 2048`);
    const fields = d.fields ?? [];
    if (fields.length > 25) fail(`${label}: > 25 fields`);
    for (const f of fields) {
      if (!f.name || !f.name.length) fail(`${label}: empty field name`);
      if (!f.value || !f.value.length) fail(`${label}: empty field value`);
      if (f.name && f.name.length > 256) fail(`${label}: field name > 256`);
      if (f.value && f.value.length > 1024) fail(`${label}: field value > 1024`);
    }
    if (embedLength(d) > 6000) fail(`${label}: embed total > 6000`);
  }

  if (!Array.isArray(payload.components)) {
    fail(`${label}: no components array`);
    return;
  }
  if (payload.components.length > 5) fail(`${label}: > 5 action rows`);

  const ids: string[] = [];
  for (const row of payload.components as any[]) {
    const comps = row.components ?? [];
    if (comps.length < 1) fail(`${label}: empty action row`);
    if (comps.length > 5) fail(`${label}: action row > 5 components`);
    const hasSelect = comps.some((c: any) => c.data?.type === 3);
    if (hasSelect && comps.length !== 1) fail(`${label}: select must be alone in its row`);
    for (const c of comps) {
      const type = c.data?.type;
      const cid = c.data?.custom_id;
      if (cid) {
        ids.push(cid);
        if (cid.length > 100) fail(`${label}: custom_id > 100 (${cid})`);
      }
      if (type === 2) {
        const lbl = c.data?.label;
        if (lbl && lbl.length > 80) fail(`${label}: button label > 80`);
        if (c.data?.style !== 5 && !cid) fail(`${label}: non-link button missing custom_id`);
      } else if (type === 3) {
        const opts = (c.options ?? []) as any[];
        if (opts.length < 1) fail(`${label}: select with 0 options`);
        if (opts.length > 25) fail(`${label}: select > 25 options`);
        const values = new Set<string>();
        for (const o of opts) {
          const v = o.data?.value;
          if (v === undefined) fail(`${label}: option missing value`);
          else {
            if (values.has(v)) fail(`${label}: duplicate option value "${v}"`);
            values.add(v);
            if (v.length > 100) fail(`${label}: option value > 100`);
          }
          if (o.data?.label && o.data.label.length > 100) fail(`${label}: option label > 100`);
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) fail(`${label}: DUPLICATE custom_id across message: ${id}`);
    seen.add(id);
  }
}

const NOT_FOUND_TITLE = 'Not in the book yet';
function detailIsBroken(payload: ViewPayload): boolean {
  return (payload.embeds?.[0] as any)?.data?.title === NOT_FOUND_TITLE;
}

// --- Part A: graph closure -------------------------------------------------

function partA() {
  type Node = { id: string; kind: 'button' | 'select'; value?: string };
  const visited = new Set<string>();
  const queue: Node[] = [];

  const pub = buildHubPublic();
  validatePayload(pub, 'public-hub');
  for (const b of extractComponents(pub).buttons) queue.push({ id: b, kind: 'button' });

  // Seed the engagement autoposts: validate each message and walk its buttons too.
  for (const key of AUTOPOST_ITEMS) {
    const msg = BUILDERS[key]();
    const payload = { embeds: msg.embeds, components: msg.components, attachments: [] } as ViewPayload;
    validatePayload(payload, `autopost:${key}`);
    for (const b of extractComponents(payload).buttons) queue.push({ id: b, kind: 'button' });
  }

  while (queue.length) {
    const node = queue.shift()!;
    const key = `${node.kind}|${node.id}|${node.value ?? ''}`;
    if (visited.has(key)) continue;
    visited.add(key);

    // Playcall + Scheme Builder are side-effecting (handled outside resolve(), like the operator
    // hub). They do not nav-route; they are exercised in Part F / Part G.
    if (node.id.startsWith('imc:pc:') || node.id.startsWith('imc:sb:')) continue;

    const resolved = resolve(node.id, node.value);
    routesTested++;
    if (!resolved) {
      fail(`unrouted ${node.kind}: ${node.id}${node.value ? ` (value=${node.value})` : ''}`);
      continue;
    }

    const label = `${node.id}${node.value ? `#${node.value}` : ''}`;
    validatePayload(resolved.payload, label);
    if (node.kind === 'select' && detailIsBroken(resolved.payload)) {
      fail(`select ${node.id} value=${node.value} -> broken detail`);
    }
    if (node.id.startsWith('imc:open:') && resolved.mode !== 'open') {
      fail(`${node.id}: expected mode "open"`);
    }

    const { buttons, selects } = extractComponents(resolved.payload);
    for (const b of buttons) queue.push({ id: b, kind: 'button' });
    for (const s of selects) {
      if (!s.firstValue) {
        fail(`select ${s.id} has no options`);
        continue;
      }
      queue.push({ id: s.id, kind: 'select', value: s.firstValue });
    }
  }
}

// --- Part B: exhaustive content -------------------------------------------

function partB() {
  let cardImagesChecked = 0;
  for (const track of CARD_TRACKS) {
    for (const card of getCards(track)) {
      detailsTested++;
      const p = buildDetail(track as Track, card.id, DEFAULT_FILTER[track as Track], 0);
      if (detailIsBroken(p)) fail(`card detail broke: ${track}:${card.id}`);
      validatePayload(p, `${track}:${card.id}`);
      if ((card as any).image) {
        cardImagesChecked++;
        if (!p.files || p.files.length !== 1) {
          fail(`card ${track}:${card.id} names image "${(card as any).image}" but no attachment was built`);
        }
      }
      for (const rid of card.related ?? []) {
        relatedChecked++;
        if (!resolveCard(rid)) fail(`DEAD related link: ${track}:${card.id} -> ${rid}`);
      }
    }
  }
  let imagesChecked = 0;
  for (const s of getAllSchemes()) {
    detailsTested++;
    const p = buildDetail('playbook', s.name, s.system.toLowerCase(), 0);
    if (detailIsBroken(p)) fail(`scheme detail broke: ${s.name}`);
    validatePayload(p, `playbook:${s.name}`);
    if (s.image_file) {
      imagesChecked++;
      if (!p.files || p.files.length !== 1) {
        fail(`scheme ${s.name} names art "${s.image_file}" but no attachment was built`);
      }
    }
  }
  console.log(`   related links verified: ${relatedChecked}`);
  console.log(`   play-art attachments verified: ${imagesChecked}`);
  console.log(`   card diagrams verified: ${cardImagesChecked}`);
}

// --- Part C: no slash surface ---------------------------------------------

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
}

// --- Operator hub: side-effecting, owner-gated, must NOT nav-route ---------

function partOperator() {
  const hub = buildOperatorHub();
  const payload = { embeds: hub.embeds, components: hub.components, attachments: [] } as ViewPayload;
  validatePayload(payload, 'operator-hub');
  const ids = extractComponents(payload).buttons;
  const allowed = new Set(operatorActionIds());
  for (const id of ids) {
    if (!allowed.has(id)) fail(`operator hub has unexpected button: ${id}`);
    // op buttons are handled in a dedicated side-effecting path; they must NOT resolve
    // through the navigation router (that would mean a misrouted/duplicate handler).
    if (resolve(id) !== null) fail(`operator button ${id} should not resolve via the nav router`);
  }
  for (const want of allowed) {
    if (!ids.includes(want)) fail(`operator hub missing button: ${want}`);
  }
}

function partC() {
  const root = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(root, 'src', 'commands'))) fail('src/commands still exists');
  if (fs.existsSync(path.join(root, 'src', 'deploy-commands.ts'))) fail('src/deploy-commands.ts still exists');
  const forbidden = [
    'SlashCommandBuilder',
    'isChatInputCommand',
    'Routes.applicationCommands',
    'Routes.applicationGuildCommands',
    'interaction.respond(',
  ];
  const files: string[] = [];
  walk(path.join(root, 'src'), files);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf-8');
    for (const token of forbidden) {
      if (text.includes(token)) fail(`forbidden token "${token}" in ${path.relative(root, f)}`);
    }
  }
}

// --- Part E: emoji skin tone (every person/hand emoji must use the dark tone 🏿) ----
function partEmoji() {
  const root = path.resolve(__dirname, '..');
  const files: string[] = [];
  walk(path.join(root, 'src'), files);
  for (const f of fs.readdirSync(path.join(root, 'content'))) {
    if (f.endsWith('.json')) files.push(path.join(root, 'content', f));
  }
  // skin-tone-capable base emoji we actually use / might add (runner, ninja, hands, people, athletes)
  const BASE = /[\u{1F3C3}\u{1F977}\u{1F44B}\u{1F4AA}\u{1F91D}\u{270A}\u{1F64C}\u{1F44D}\u{1F44E}\u{1F64F}\u{270D}\u{1F919}\u{1F448}\u{1F449}\u{261D}\u{1F446}\u{1F447}\u{1F91E}\u{1F44F}\u{1F590}\u{1F44C}\u{1F9D1}\u{1F468}\u{1F469}\u{1F64B}\u{1F926}\u{1F937}\u{1F3CB}\u{1F3CC}\u{26F9}\u{1F938}\u{1F93E}\u{1F3C4}\u{1F3CA}\u{1F6A3}\u{1F6B4}\u{1F6B5}]/u;
  const LIGHT = /[\u{1F3FB}-\u{1F3FE}]/u; // any non-dark skin tone modifier
  const DARK = '\u{1F3FF}';
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
      // a base emoji must be immediately followed by the dark modifier
      const re = new RegExp(BASE.source + '(?!\\u{1F3FF})', 'gu');
      if (re.test(line)) fail(`bare/non-dark skin-tone emoji at ${path.relative(root, file)}:${i + 1} (must use ${DARK})`);
      if (LIGHT.test(line)) fail(`light/medium skin-tone emoji at ${path.relative(root, file)}:${i + 1} (must use ${DARK})`);
    });
  }
}

// --- Part F: playcall game (side-effecting; play a full simulated drive) ----

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

let pcDrivesPlayed = 0;
let pcPlaysResolved = 0;
let pcDiagramsRendered = 0;

function partPlaycall() {
  // Validate the side chooser, the opening views, and the offense direction view.
  validatePayload(buildStartView(), 'playcall:start');
  const g0 = newGame('smoke-user', 'offense');
  validatePayload(buildTurnView(g0), 'playcall:open-off');
  chooseOffense(g0, OFFENSE[0].id);
  validatePayload(buildDirView(g0, OFFENSE[0].id), 'playcall:dir');
  validatePayload(buildTurnView(newGame('smoke-user', 'defense')), 'playcall:open-def');

  // Play full OFFENSE drives with a seeded RNG; every resolved play renders a live diagram.
  for (let s = 0; s < 4; s++) {
    const rng = mulberry32(1000 + s * 7);
    const g = newGame('smoke-user', 'offense');
    let guard = 0;
    while (g.status !== 'over' && guard++ < 40) {
      const off = OFFENSE[Math.floor(rng() * OFFENSE.length)];
      if (!chooseOffense(g, off.id)) break;
      const dir: Dir = rng() < 0.5 ? -1 : 1;
      if (!resolveDown(g, dir, rng)) break;
      pcPlaysResolved++;
      const live = getGame('smoke-user')!;
      const view = live.status === 'over' ? buildOverView(live) : buildTurnView(live);
      if (!view.files || view.files.length !== 1) fail(`playcall: offense play built no diagram (seed ${s})`);
      else pcDiagramsRendered++;
      validatePayload(view, `playcall:off:${s}`);
    }
    if (g.status !== 'over') fail(`playcall: offense drive ${s} never ended (guard hit)`);
    validatePayload(buildOverView(g), `playcall:off-over:${s}`);
    pcDrivesPlayed++;
  }

  // Play full DEFENSE drives (bot offense; you call front+coverage each down).
  for (let s = 0; s < 3; s++) {
    const rng = mulberry32(5000 + s * 11);
    const g = newGame('smoke-user', 'defense');
    let guard = 0;
    while (g.status !== 'over' && guard++ < 40) {
      const def = DEFENSE[Math.floor(rng() * DEFENSE.length)];
      if (!resolveAsDefense(g, def.id, rng)) break;
      pcPlaysResolved++;
      const live = getGame('smoke-user')!;
      const view = live.status === 'over' ? buildOverView(live) : buildTurnView(live);
      if (!view.files || view.files.length !== 1) fail(`playcall: defense play built no diagram (seed ${s})`);
      else pcDiagramsRendered++;
      validatePayload(view, `playcall:def:${s}`);
    }
    if (g.status !== 'over') fail(`playcall: defense drive ${s} never ended (guard hit)`);
    validatePayload(buildOverView(g), `playcall:def-over:${s}`);
    pcDrivesPlayed++;
  }
}

// --- Part G: scheme builder (side-effecting; build a scheme end to end) -----

let sbViewsValidated = 0;

function partScheme() {
  loadSchemeData();
  if (allSchemes().length < 1) fail('scheme builder: no schemes loaded (run tools/ingest-playbook-creator.py)');
  const b = newBuild('smoke-sb');
  validatePayload(buildSetupView(b), 'scheme:setup-empty');
  sbViewsValidated++;
  setScheme(b, allSchemes()[0].id);
  setTempo(b, allTempos()[0].id);
  validatePayload(buildSetupView(b), 'scheme:setup');
  sbViewsValidated++;

  // pick a couple concepts from each group, validate the running concept view each time
  for (const g of ['run', 'qpa', 'pass'] as const) {
    const ids = groupConcepts(g).slice(0, g === 'pass' ? 4 : 2).map((c) => c.id);
    setGroupConcepts(b, g, ids);
    validatePayload(buildConceptView(b), `scheme:concepts-${g}`);
    sbViewsValidated++;
  }
  // the identity card with the roadmap must render
  const card = buildIdentityView(b);
  validatePayload(card, 'scheme:identity');
  sbViewsValidated++;
  const hasRoadmap = (card.embeds[0] as any).data.fields?.some((f: any) => /roadmap/i.test(f.name));
  if (!hasRoadmap) fail('scheme builder: identity card has no playbook roadmap');
}

// --- run -------------------------------------------------------------------

console.log('iMoveChainz smoke test');
console.log('='.repeat(60));
loadKnowledgeBases();
loadCards();
const cs = cardStats();
console.log(`   cards: ${cs.glossary} terms, ${cs.coverage} coverages, ${cs.concept} concepts, ${cs.front} fronts, ${cs.usering} usering`);
console.log('');

console.log('Part A: walking the button graph...');
partA();
console.log(`   routes exercised: ${routesTested}`);

console.log('Part B: rendering every card + scheme...');
partB();
console.log(`   detail pages rendered: ${detailsTested}`);

console.log('Part C: checking for slash-command surface...');
partC();
console.log('   structure checked');

console.log('Part D: validating the operator hub...');
partOperator();
console.log('   operator hub checked');

console.log('Part E: emoji skin tone (dark 🏿, non-negotiable)...');
partEmoji();
console.log('   emoji skin tone checked');

console.log('Part F: playcall game (simulated drives + live diagrams)...');
// Render small, few-frame GIFs here: we are validating the pipeline + payloads, not visual polish.
process.env.PLAYCALL_GIF_FRAMES = process.env.PLAYCALL_GIF_FRAMES ?? '3';
process.env.PLAYCALL_GIF_WIDTH = process.env.PLAYCALL_GIF_WIDTH ?? '380';
partPlaycall();
console.log(`   playcall: ${pcDrivesPlayed} drives, ${pcPlaysResolved} plays resolved, ${pcDiagramsRendered} live diagrams rendered`);

console.log('Part G: scheme builder (declare + roadmap)...');
partScheme();
console.log(`   scheme builder: ${sbViewsValidated} views validated, identity card + roadmap built`);

console.log('');
console.log('='.repeat(60));
if (errors.length) {
  console.log(`❌ FAILED with ${errors.length} issue(s):`);
  for (const e of errors.slice(0, 60)) console.log(`   - ${e}`);
  if (errors.length > 60) console.log(`   ...and ${errors.length - 60} more`);
  process.exit(1);
} else {
  console.log('✅ PASS');
  console.log(`   ${routesTested} routes, ${detailsTested} detail pages, ${relatedChecked} related links, 0 dead buttons, no slash surface.`);
  process.exit(0);
}
