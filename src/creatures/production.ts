import type { Creature, Genotype } from './creature';
import { CreatureType, TYPE_MULTIPLIERS } from './types';
import { PROD_GENE_EXPONENT, LEVEL_MILESTONES } from '../core/balance';

/** Type-specific gene that drives production alongside `size`. */
export const PRODUCTION_GENE: Record<CreatureType, keyof Genotype> = {
  [CreatureType.Stellarid]: 'arms',
  [CreatureType.Blobid]: 'tentacles',
  [CreatureType.Corallid]: 'density',
  [CreatureType.Nucleid]: 'facets',
  [CreatureType.Craboid]: 'claws',
};

/** Plankton/s of a level-1 creature: depends only on type and genes. */
export function calculateGeneticRate(creature: Pick<Creature, 'type' | 'genes'>): number {
  const size = creature.genes.size;
  const primary = creature.genes[PRODUCTION_GENE[creature.type]];
  return (
    TYPE_MULTIPLIERS[creature.type] *
    Math.pow(2, PROD_GENE_EXPONENT * (size - 0.5)) *
    Math.pow(2, PROD_GENE_EXPONENT * (primary - 0.5))
  );
}

/** Number of milestones reached at a given level. */
export function milestonesReached(level: number): number {
  let n = 0;
  for (const m of LEVEL_MILESTONES) if (level >= m) n++;
  return n;
}

/** Next milestone level above `level`, or null when all are reached. */
export function nextMilestone(level: number): number | null {
  return LEVEL_MILESTONES.find((m) => m > level) ?? null;
}

/** Level contribution to production: level × 2^milestones. */
export function levelMultiplier(level: number): number {
  return level * Math.pow(2, milestonesReached(level));
}

/** Plankton per second for a single creature, before global multipliers. */
export function calculateProduction(creature: Creature): number {
  return calculateGeneticRate(creature) * levelMultiplier(creature.level);
}
