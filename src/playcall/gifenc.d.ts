/**
 * Minimal ambient types for gifenc (the package ships no .d.ts). Only the surface we use:
 * a streaming encoder + palette quantize/apply. See https://github.com/mattdesl/gifenc.
 */
declare module 'gifenc' {
  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: number[][]; delay?: number; transparent?: boolean; repeat?: number; dispose?: number }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(opts?: { auto?: boolean }): GifEncoder;
  export function quantize(rgba: Uint8Array, maxColors: number, opts?: Record<string, unknown>): number[][];
  export function applyPalette(rgba: Uint8Array, palette: number[][], format?: string): Uint8Array;
}
