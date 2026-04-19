/**
 * Shared style primitives for creature pixel-art renderers.
 *
 * Every type-specific renderer starts with the same palette/pattern/wobble
 * derivation from the genotype; the circular-body types (stellarid, blobid)
 * additionally share a tri-branch pattern-gated body-fill formula. These
 * helpers consolidate both so a new creature type can reuse the look
 * without re-deriving the constants.
 *
 * Renderers whose body fill is geometry-specific (corallid branch paths,
 * nucleid ring parity) still consume `bodyStyle()` for the preamble but
 * keep their own fill loops — the fill helper wouldn't fit cleanly.
 */

import type { Genotype } from '../creatures/creature';
import { type Palette, getPalette } from './palette';
import { spatialRandom } from '../util/prng';

export interface BodyStyle {
  pal: Palette;
  pal2: Palette;
  /** Pattern level quantised to 0..4 from `genes.pattern`. */
  pattern: number;
  /** Wobble animation amplitude derived from `genes.wobble` (~0..3). */
  wobble: number;
  /** Seed used for spatialRandom-based colour noise. */
  seed: number;
}

/** Derive the shared style constants from a genotype + creature seed. */
export function bodyStyle(genes: Genotype, seed: number): BodyStyle {
  return {
    pal: getPalette(genes.palette1),
    pal2: getPalette(genes.palette2),
    pattern: Math.round(genes.pattern * 4),
    wobble: genes.wobble * 3,
    seed,
  };
}

/** Predicate over a local (dx, dy) offset — used to parameterise body-fill pattern hooks. */
export type PatternHook = (dx: number, dy: number) => boolean;

const NEVER: PatternHook = () => false;

export interface BodyFillHooks {
  /** When `pattern >= 1` and this returns true → use `pal.accent`. */
  stripe?: PatternHook;
  /** When `pattern >= 3` and this returns true → use `pal2.accent`. */
  highlight?: PatternHook;
  /** spatialRandom threshold above which `pattern >= 2` uses `pal2.body`. Default 0.75. */
  noiseThreshold?: number;
}

/**
 * Pick the colour for a filled body pixel in the stellarid/blobid style.
 * `edge` is caller-determined (geometry-dependent) — `true` always yields
 * `pal.outline`. For the interior the decision is:
 *  - base: `pal.body`
 *  - `pattern >= 1` and `stripe(dx, dy)` → `pal.accent`
 *  - `pattern >= 2` and spatialRandom(dx, dy, seed) > threshold → `pal2.body`
 *  - `pattern >= 3` and `highlight(dx, dy)` → `pal2.accent`
 *
 * Each rule can override the previous one (same order as the original inline logic),
 * so pass hooks that don't overlap unless you want the later rule to win.
 */
export function bodyPixelColor(
  style: BodyStyle,
  dx: number,
  dy: number,
  edge: boolean,
  hooks: BodyFillHooks = {},
): string {
  if (edge) return style.pal.outline;

  const stripe = hooks.stripe ?? NEVER;
  const highlight = hooks.highlight ?? NEVER;
  const noiseThreshold = hooks.noiseThreshold ?? 0.75;

  let c = style.pal.body;
  if (style.pattern >= 1 && stripe(dx, dy)) c = style.pal.accent;
  if (style.pattern >= 2 && spatialRandom(dx, dy, style.seed) > noiseThreshold) c = style.pal2.body;
  if (style.pattern >= 3 && highlight(dx, dy)) c = style.pal2.accent;
  return c;
}
