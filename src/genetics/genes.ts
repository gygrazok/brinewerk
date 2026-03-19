import type { Genotype } from '../creatures/creature';

/**
 * Bell-curve distribution via Irwin-Hall (mean of 3 uniforms).
 * Produces values concentrated around 0.5, with extremes (near 0 or 1) being rare.
 * Result is clamped to [0, 1].
 */
function bellCurve(rng: () => number): number {
  const sum = rng() + rng() + rng();
  return Math.max(0, Math.min(1, sum / 3));
}

/** Generate a random genotype using the provided PRNG.
 *  Gameplay traits use a bell curve (extremes are rare).
 *  Palette genes stay uniform (they're color indices, not quality). */
export function randomGenotype(rng: () => number): Genotype {
  return {
    arms: bellCurve(rng),
    size: bellCurve(rng),
    fatness: bellCurve(rng),
    spikes: bellCurve(rng),
    pattern: bellCurve(rng),
    glow: bellCurve(rng),
    eyes: bellCurve(rng),
    wobble: bellCurve(rng),
    tentacles: bellCurve(rng),
    branches: bellCurve(rng),
    density: bellCurve(rng),
    facets: bellCurve(rng),
    rings: bellCurve(rng),
    palette1: rng(),
    palette2: rng(),
  };
}
