import type { Creature } from './creature';
import { TYPE_MULTIPLIERS } from './types';

/** Calculate plankton per second for a single creature */
export function calculateProduction(creature: Creature, adjacencyBonus: number): number {
  const base =
    TYPE_MULTIPLIERS[creature.type] *
    (0.5 + creature.genes.size * 0.5) *
    (0.8 + creature.genes.arms * 0.4);

  return base * (1 + adjacencyBonus);
}
