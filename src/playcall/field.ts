/**
 * Broadcast field overlay + event banner.
 *
 * The engine draws the play on an abstract field (LOS fixed at y=500, generic decorative yard
 * lines). This module post-processes the engine's SVG string to make it a REAL field tied to the
 * drive: numbered yard lines at the correct absolute positions, the blue line of scrimmage, the
 * yellow first-down line, and the opponent end zone when it is in view. It also bakes a slam-in
 * outcome banner (TOUCHDOWN / SACK / INTERCEPTED ...) into the final GIF frames, the same pattern
 * the Kunai shinobi game uses. All by string injection, so the engine stays untouched.
 *
 * Geometry (from the engine spec): LOS y=500, downfield = decreasing y, 5 yards = 52px.
 */

const LOS = 500;
const PX_PER_YD = 52 / 5; // 10.4

// The constant border rect the engine emits last in its field block; we inject the overlay right
// after it so the field markings sit ABOVE the turf but BELOW the play art and tokens.
const BORDER_RECT = '<rect x="30" y="0" width="940" height="720" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="3"/>';
// The engine's own full-width decorative yard lines (misaligned to absolute yards); strip them so
// our aligned, numbered lines are the only grid.
const ENGINE_YARDLINE = /<line x1="30" y1="[\d.]+" x2="970" y2="[\d.]+" stroke="#ffffff" stroke-opacity="0\.5" stroke-width="2"\/>/g;

export interface FieldCtx {
  ballOn: number; // 0-100, line of scrimmage
  toGo: number; // yards to the first-down marker
  event?: EventBanner | null;
}

export interface EventBanner {
  text: string;
  color: string;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Absolute yard line -> screen y. */
function yOf(yard: number, ballOn: number): number {
  return LOS - (yard - ballOn) * PX_PER_YD;
}

function fieldOverlay(ballOn: number, toGo: number): string {
  let s = '';

  // End zone: the opponent goal line is at yard 100. Draw the zone (100 -> 110) above it when visible.
  const yGoal = yOf(100, ballOn);
  if (yGoal > 6) {
    const yTop = Math.max(0, yGoal - 10 * PX_PER_YD);
    s += `<rect x="30" y="${yTop.toFixed(1)}" width="940" height="${(yGoal - yTop).toFixed(1)}" fill="#16324f" fill-opacity="0.72"/>`;
    s += `<line x1="30" y1="${yGoal.toFixed(1)}" x2="970" y2="${yGoal.toFixed(1)}" stroke="#ffffff" stroke-width="4"/>`;
    const yc = (yTop + yGoal) / 2;
    s += `<text x="500" y="${(yc + 11).toFixed(1)}" text-anchor="middle" font-size="34" font-weight="800" fill="#ffffff" fill-opacity="0.85" font-family="Barlow" letter-spacing="6">END ZONE</text>`;
  }

  // Aligned yard lines every 5; numbers (10-50-40...) every 10 along both sidelines.
  for (let L = 5; L <= 95; L += 5) {
    const y = yOf(L, ballOn);
    if (y < 8 || y > 714) continue;
    const ten = L % 10 === 0;
    s += `<line x1="30" y1="${y.toFixed(1)}" x2="970" y2="${y.toFixed(1)}" stroke="#ffffff" stroke-opacity="${ten ? 0.5 : 0.22}" stroke-width="${ten ? 2.5 : 1.5}"/>`;
    if (ten) {
      const num = L <= 50 ? L : 100 - L;
      s += `<text x="80" y="${(y + 7).toFixed(1)}" text-anchor="middle" font-size="22" font-weight="800" fill="#ffffff" fill-opacity="0.66" font-family="Barlow">${num}</text>`;
      s += `<text x="920" y="${(y + 7).toFixed(1)}" text-anchor="middle" font-size="22" font-weight="800" fill="#ffffff" fill-opacity="0.66" font-family="Barlow">${num}</text>`;
    }
  }

  // First-down line (yellow) at ballOn + toGo.
  const yFD = yOf(ballOn + toGo, ballOn);
  if (yFD > 8 && yFD < 714) {
    s += `<line x1="30" y1="${yFD.toFixed(1)}" x2="970" y2="${yFD.toFixed(1)}" stroke="#ffd23b" stroke-width="3.5" stroke-opacity="0.95"/>`;
  }
  return s;
}

/** Slam-in outcome banner, scaled by t (0 -> hidden, 1 -> full). Drawn on top of everything. */
function bannerOverlay(b: EventBanner, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  const scale = (0.55 + Math.min(1, u * 4) * 0.45).toFixed(3);
  const op = Math.min(1, u * 3).toFixed(2);
  const w = Math.max(360, b.text.length * 42 + 80);
  return (
    `<g transform="translate(500,286)"><g transform="scale(${scale})">` +
    `<rect x="${(-w / 2).toFixed(0)}" y="-52" width="${w.toFixed(0)}" height="104" rx="16" fill="#0b0f17" fill-opacity="${(0.5 * Number(op)).toFixed(2)}" stroke="${b.color}" stroke-opacity="${op}" stroke-width="3"/>` +
    `<text x="0" y="22" text-anchor="middle" font-size="66" font-weight="800" fill="${b.color}" fill-opacity="${op}" font-family="Barlow" stroke="#0b0f17" stroke-width="1.5" letter-spacing="2">${esc(b.text)}</text>` +
    `</g></g>`
  );
}

/**
 * Decorate one engine SVG frame: strip the engine's loose yard lines, inject the real field
 * markings under the play, and (when bannerT > 0 and an event is set) slam the banner on top.
 */
export function decorate(svg: string, ctx: FieldCtx, bannerT = 0): string {
  let out = svg.replace(ENGINE_YARDLINE, '');
  out = out.replace(BORDER_RECT, BORDER_RECT + fieldOverlay(ctx.ballOn, ctx.toGo));
  if (ctx.event && bannerT > 0) out = out.replace('</svg>', bannerOverlay(ctx.event, bannerT) + '</svg>');
  return out;
}

// ---------------------------------------------------------------------------
// Event derivation: outcome -> banner (text + color). Priority high to low.
// ---------------------------------------------------------------------------

const C = { gold: '#ffd23b', yellow: '#f5e050', cyan: '#5ec8ff', orange: '#ff9a3c', red: '#ff5a4a', green: '#57f287' };

export function eventFor(note: string, kind: string, explosive: boolean, isRun: boolean): EventBanner | null {
  if (note === 'TOUCHDOWN') return { text: 'TOUCHDOWN', color: C.gold };
  if (note === 'SAFETY') return { text: 'SAFETY', color: C.red };
  if (kind === 'INT') return { text: 'INTERCEPTED', color: C.red };
  if (kind === 'FUMBLE') return { text: 'FUMBLE', color: C.red };
  if (kind === 'SACK') return { text: 'SACK', color: C.orange };
  if (note === 'TURNOVER ON DOWNS') return { text: 'TURNOVER ON DOWNS', color: C.red };
  if (note.startsWith('FIRST DOWN')) return { text: 'FIRST DOWN', color: C.yellow };
  if (explosive) return { text: 'BIG PLAY', color: C.cyan };
  if (isRun && (kind === 'LOSS' || kind === 'NO_GAIN')) return { text: 'STUFFED', color: C.orange };
  return null;
}
