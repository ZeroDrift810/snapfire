/**
 * Live play-diagram renderer.
 *
 * Turns a resolved engine model into an ANIMATED GIF (the play developing) using the engine's own
 * SVG output (HimkageVision house style) rasterized per frame with @resvg/resvg-js + the bundled
 * Barlow font, then encoded to GIF with gifenc (pure JS, no native deps). The diagram matches the
 * EXACT matchup that was just played and animates the snap from alignment to finish, the same way
 * the bot's teaching-card diagrams animate. No pre-baked art: every GIF is the engine drawing the
 * real geometry. Results are cached by matchup because the same call recurs across a drive and
 * rendering 11 frames is the slowest step (the handler defers the interaction to cover it).
 */

import { Resvg } from '@resvg/resvg-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { Engine, FONT_FILES, PlayModel } from './engine';

// Frame count + width are env-tunable (read lazily) so the smoke test can render cheaply
// (PLAYCALL_GIF_FRAMES=3) while production animates smoothly. Width 760 keeps GIFs ~300KB.
const gifWidth = (): number => Number.parseInt(process.env.PLAYCALL_GIF_WIDTH ?? '760', 10);
const gifFrames = (): number => Math.max(2, Number.parseInt(process.env.PLAYCALL_GIF_FRAMES ?? '11', 10));

const GIF_CACHE = new Map<string, Buffer>();
const PNG_CACHE = new Map<string, Buffer>();
const CACHE_LIMIT = 200;

function key(model: PlayModel): string {
  return [model.kind === 'pass' ? 'P' : 'R', model.formKey, model.frontKey, model.key, model.dir, model.coverage ?? '-', model.motion ?? '-'].join('|');
}

function lruSet(cache: Map<string, Buffer>, k: string, v: Buffer): Buffer {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(k, v);
  return v;
}

function rasterize(model: PlayModel, g: number, width: number): { pixels: Buffer; width: number; height: number } {
  const svg = Engine.renderSVG(model, g, '', true);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Barlow' },
    background: '#0b0f17',
  });
  const img = r.render();
  return { pixels: Buffer.from(img.pixels), width: img.width, height: img.height };
}

/** Progress values for the animation: ease into the snap, then hold the finished play. */
function frameSchedule(n: number): { g: number; delay: number }[] {
  const out: { g: number; delay: number }[] = [];
  const moving = n - 2; // last two are the hold
  for (let i = 0; i < moving; i++) {
    const t = i / (moving - 1);
    out.push({ g: t, delay: 95 });
  }
  out.push({ g: 1, delay: 260 });
  out.push({ g: 1, delay: 900 }); // hold the finished play before the loop restarts
  return out;
}

/** Render the play to an animated GIF buffer (the snap developing, looping). */
export function renderPlayGif(model: PlayModel): Buffer {
  const k = key(model);
  const hit = GIF_CACHE.get(k);
  if (hit) return hit;

  const width = gifWidth();
  const schedule = frameSchedule(gifFrames());
  const enc = GIFEncoder();
  // One global palette built from the fullest frame: stable field colors, no inter-frame flicker.
  const full = rasterize(model, 1, width);
  const palette = quantize(full.pixels, 256);

  schedule.forEach((f, i) => {
    const img = i === schedule.length - 1 || f.g === 1 ? full : rasterize(model, f.g, width);
    const index = applyPalette(img.pixels, palette);
    enc.writeFrame(index, img.width, img.height, { palette: i === 0 ? palette : undefined, delay: f.delay });
  });
  enc.finish();
  return lruSet(GIF_CACHE, k, Buffer.from(enc.bytes()));
}

/** Single still PNG at progress g (kept for any non-animated use; the game uses the GIF). */
export function renderPlayPng(model: PlayModel, g = 0.62): Buffer {
  const k = `${key(model)}@${g.toFixed(2)}`;
  const hit = PNG_CACHE.get(k);
  if (hit) return hit;
  const svg = Engine.renderSVG(model, g, '', true);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1000 },
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Barlow' },
    background: '#0b0f17',
  })
    .render()
    .asPng();
  return lruSet(PNG_CACHE, k, png);
}

export function clearRenderCache(): void {
  GIF_CACHE.clear();
  PNG_CACHE.clear();
}
