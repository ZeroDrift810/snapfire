/**
 * Scheme artifact renderer — the sellable goods.
 *
 * Turns a SchemeBuild into branded deliverables:
 *   - renderSchemeCardPng: a portrait "Scheme Identity" card (PNG) for in-Discord preview.
 *   - renderSchemePdf: a multi-page PDF (identity card + custom-playbook roadmap + engine-rendered
 *     diagrams of the core concepts) for the downloadable product.
 * The card + roadmap pages are composed as SVG and rasterized with resvg + the bundled Barlow font
 * (same pipeline as the playcall diagrams); the concept diagrams come from the HimkageVision engine.
 * pdf-lib (pure JS) stitches the pages.
 */

import { Resvg } from '@resvg/resvg-js';
import { PDFDocument, rgb } from 'pdf-lib';
import { Engine, FONT_FILES } from '../playcall/engine';
import { renderPlayPng } from '../playcall/render';
import { getScheme, getTempo } from './data';
import { balance, conceptsByBucket, CORE_TARGET, roadmap, SchemeBuild } from './builder';

const W = 1080;
const H = 1350;
const GOLD = '#e6b400';
const BG = '#0b0f17';
const PANEL = '#141c2b';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
const charW = (s: string, size: number) => s.length * size * 0.56;

function svgToPng(svg: string, width = W): Buffer {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Barlow' },
    background: BG,
  })
    .render()
    .asPng();
}

/** Flow a set of pill chips left-to-right, wrapping; returns svg + the new y cursor. */
function chips(items: string[], x0: number, y0: number, maxX: number, fill: string): { svg: string; y: number } {
  let s = '';
  let x = x0;
  let y = y0;
  const h = 50;
  const fs = 26;
  for (const it of items) {
    const w = charW(it, fs) + 36;
    if (x + w > maxX) {
      x = x0;
      y += h + 14;
    }
    s += `<rect x="${x}" y="${y}" width="${w.toFixed(0)}" height="${h}" rx="${h / 2}" fill="${fill}" fill-opacity="0.16" stroke="${fill}" stroke-opacity="0.5" stroke-width="2"/>`;
    s += `<text x="${(x + w / 2).toFixed(0)}" y="${y + 34}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#ffffff" font-family="Barlow">${esc(it)}</text>`;
    x += w + 14;
  }
  return { svg: s, y: y + h };
}

function cardSvg(b: SchemeBuild): string {
  const scheme = (b.schemeId ? getScheme(b.schemeId)?.name : 'Custom Scheme') ?? 'Custom Scheme';
  const tempo = (b.tempoId ? getTempo(b.tempoId)?.name : 'Tempo not set') ?? 'Tempo not set';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${BG}"/>`;
  s += `<rect x="0" y="0" width="${W}" height="12" fill="${GOLD}"/>`;
  // header
  s += `<text x="64" y="92" font-size="26" font-weight="800" fill="${GOLD}" font-family="Barlow" letter-spacing="4">iMoveChainz  ·  SCHEME IDENTITY</text>`;
  s += `<text x="64" y="184" font-size="78" font-weight="800" fill="#ffffff" font-family="Barlow">${esc(scheme.toUpperCase())}</text>`;
  s += `<text x="64" y="232" font-size="30" font-weight="700" fill="#9fb0c6" font-family="Barlow">${esc(tempo)}  ·  ${b.concepts.length}/${CORE_TARGET} core concepts</text>`;
  s += `<line x1="64" y1="266" x2="${W - 64}" y2="266" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="2"/>`;

  // bucket sections
  let y = 326;
  for (const g of conceptsByBucket(b)) {
    s += `<text x="64" y="${y}" font-size="26" font-weight="800" fill="${GOLD}" font-family="Barlow" letter-spacing="2">${esc(g.label.toUpperCase())}</text>`;
    const c = chips(g.concepts.map((x) => x.name), 64, y + 18, W - 64, '#5ec8ff');
    s += c.svg;
    y = c.y + 40;
  }

  // balance line
  const bal = balance(b).filter((bk) => bk.count > 0);
  const allOk = bal.every((bk) => bk.status === 'ok');
  y = Math.max(y, H - 320);
  s += `<rect x="48" y="${y}" width="${W - 96}" height="${H - 64 - y - 24}" rx="18" fill="${PANEL}"/>`;
  s += `<text x="80" y="${y + 56}" font-size="26" font-weight="800" fill="${GOLD}" font-family="Barlow" letter-spacing="2">${allOk ? 'BALANCED  ·  WITHIN RANGE' : 'BALANCE CHECK'}</text>`;
  s += `<text x="80" y="${y + 100}" font-size="24" font-weight="700" fill="#cdd8e8" font-family="Barlow">${esc(bal.map((bk) => `${bk.label.split(' ')[0]} ${bk.count}`).join('   ·   '))}</text>`;
  const rm = roadmap(b).slice(0, 3).map((r) => r.formation);
  s += `<text x="80" y="${y + 152}" font-size="26" font-weight="800" fill="${GOLD}" font-family="Barlow" letter-spacing="2">BUILD IT IN</text>`;
  s += `<text x="80" y="${y + 196}" font-size="26" font-weight="700" fill="#ffffff" font-family="Barlow">${esc(rm.join('   ·   ') || '—')}</text>`;

  s += `<text x="64" y="${H - 36}" font-size="22" font-weight="700" fill="#6b7a90" font-family="Barlow">iMoveChainz Lab  ·  Real Football Strategy</text>`;
  s += `</svg>`;
  return s;
}

function roadmapSvg(b: SchemeBuild): string {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  s += `<rect width="${W}" height="${H}" fill="${BG}"/><rect x="0" y="0" width="${W}" height="12" fill="${GOLD}"/>`;
  s += `<text x="64" y="100" font-size="46" font-weight="800" fill="${GOLD}" font-family="Barlow">CUSTOM PLAYBOOK ROADMAP</text>`;
  s += `<text x="64" y="146" font-size="26" font-weight="700" fill="#9fb0c6" font-family="Barlow">Formations that carry your concepts, with reference plays.</text>`;
  let y = 220;
  for (const r of roadmap(b).slice(0, 6)) {
    s += `<rect x="48" y="${y}" width="${W - 96}" height="64" rx="12" fill="${PANEL}"/>`;
    s += `<text x="76" y="${y + 42}" font-size="30" font-weight="800" fill="#ffffff" font-family="Barlow">${esc(r.formation)}</text>`;
    s += `<text x="${W - 76}" y="${y + 42}" text-anchor="end" font-size="24" font-weight="700" fill="${GOLD}" font-family="Barlow">${r.conceptCount} concepts · ${r.total} plays</text>`;
    y += 80;
  }
  y += 20;
  s += `<text x="64" y="${y}" font-size="30" font-weight="800" fill="${GOLD}" font-family="Barlow">REFERENCE PLAYS (M24)</text>`;
  y += 44;
  for (const g of conceptsByBucket(b)) {
    for (const c of g.concepts) {
      if (y > H - 70) break;
      const ex = c.examples.slice(0, 3).map((e) => e.play).join(', ');
      if (!ex) continue;
      s += `<text x="64" y="${y}" font-size="24" font-weight="800" fill="#9fb0c6" font-family="Barlow">${esc(c.name)}:</text>`;
      s += `<text x="${64 + charW(c.name + ':', 24) + 16}" y="${y}" font-size="24" font-weight="600" fill="#cdd8e8" font-family="Barlow">${esc(ex)}</text>`;
      y += 38;
    }
  }
  s += `<text x="64" y="${H - 36}" font-size="22" font-weight="700" fill="#6b7a90" font-family="Barlow">iMoveChainz Lab  ·  Real Football Strategy</text></svg>`;
  return s;
}

export function renderSchemeCardPng(b: SchemeBuild): Buffer {
  return svgToPng(cardSvg(b));
}

/** Resolve an engine model for a concept's engine key (run scheme or pass concept). */
function conceptModel(engineConcept: string | null) {
  if (!engineConcept) return null;
  try {
    if (Engine.SCHEMES.includes(engineConcept)) return Engine.resolvePlay('i-form-pro', '4-3-over', engineConcept, 1, 'cover-3', null);
    if (Engine.CONCEPT_KEYS.includes(engineConcept)) return Engine.resolvePass('shotgun-empty-trey', '4-3-over', engineConcept, 1, 'cover-3');
  } catch {
    return null;
  }
  return null;
}

export async function renderSchemePdf(b: SchemeBuild): Promise<Buffer> {
  const pdf = await PDFDocument.create();

  // Page 1: identity card. Page 2: roadmap.
  for (const svg of [cardSvg(b), roadmapSvg(b)]) {
    const png = await pdf.embedPng(svgToPng(svg));
    const page = pdf.addPage([W, H]);
    page.drawImage(png, { x: 0, y: 0, width: W, height: H });
  }

  // Page 3+: core-concept diagrams from the engine, 2-up grid.
  const diagrams: { label: string; png: Buffer }[] = [];
  for (const g of conceptsByBucket(b)) {
    for (const c of g.concepts) {
      const m = conceptModel(c.engineConcept);
      if (!m) continue;
      try {
        diagrams.push({ label: c.name, png: renderPlayPng(m, 0.6) });
      } catch {
        /* skip a concept that fails to render */
      }
    }
  }
  const perPage = 4;
  for (let i = 0; i < diagrams.length; i += perPage) {
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 12, width: W, height: 12, color: rgb(0.902, 0.706, 0) });
    const slice = diagrams.slice(i, i + perPage);
    for (let j = 0; j < slice.length; j++) {
      const d = slice[j];
      const img = await pdf.embedPng(d.png);
      const col = j % 2;
      const row = Math.floor(j / 2);
      const cellW = (W - 96) / 2;
      const imgW = cellW;
      const imgH = imgW * (720 / 1000);
      const x = 48 + col * cellW;
      const yTop = H - 80 - row * (imgH + 70);
      page.drawImage(img, { x, y: yTop - imgH, width: imgW, height: imgH });
    }
  }

  return Buffer.from(await pdf.save());
}
