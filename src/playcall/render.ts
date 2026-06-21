/**
 * Live play-diagram renderer.
 *
 * Turns a resolved engine model into a PNG buffer using the engine's own SVG output
 * (HimkageVision house style) rasterized with @resvg/resvg-js and the bundled Barlow
 * font, so the diagram matches the EXACT matchup that was just played (your call vs the
 * front + coverage the opponent picked). No pre-baked / static art: every diagram is the
 * engine drawing the real geometry. Results are cached by matchup+progress because the
 * same call recurs across a drive and resvg is the slowest step.
 */

import { Resvg } from '@resvg/resvg-js';
import { Engine, FONT_FILES, PlayModel } from './engine';

const PNG_CACHE = new Map<string, Buffer>();
const CACHE_LIMIT = 200;

function cacheKey(model: PlayModel, g: number): string {
  return [model.kind === 'pass' ? 'P' : 'R', model.formKey, model.frontKey, model.key, model.dir, model.coverage ?? '-', model.motion ?? '-', g.toFixed(2)].join('|');
}

/**
 * Render the play to a PNG buffer at animation progress g (0 = pre-snap alignment,
 * 1 = fully developed). Default 0.62 catches the play at the mesh / break point, which
 * reads best as a single still.
 */
export function renderPlayPng(model: PlayModel, g = 0.62): Buffer {
  const key = cacheKey(model, g);
  const hit = PNG_CACHE.get(key);
  if (hit) return hit;

  const svg = Engine.renderSVG(model, g, '', true);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1000 },
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: 'Barlow' },
    background: '#0b0f17',
  });
  const png = resvg.render().asPng();

  if (PNG_CACHE.size >= CACHE_LIMIT) {
    const oldest = PNG_CACHE.keys().next().value;
    if (oldest) PNG_CACHE.delete(oldest);
  }
  PNG_CACHE.set(key, png);
  return png;
}

export function clearRenderCache(): void {
  PNG_CACHE.clear();
}
