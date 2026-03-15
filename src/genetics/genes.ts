import type { Genotype } from '../creatures/creature';

/** Generate a random genotype using the provided PRNG */
export function randomGenotype(rng: () => number): Genotype {
  return {
    arms: rng(),
    size: rng(),
    fatness: rng(),
    spikes: rng(),
    pattern: rng(),
    glow: rng(),
    eyes: rng(),
    wobble: rng(),
    tentacles: rng(),
    branches: rng(),
    density: rng(),
    facets: rng(),
    rings: rng(),
    palette1: rng(),
    palette2: rng(),
  };
}
