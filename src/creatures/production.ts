import type { Creature } from './creature';
import { TYPE_MULTIPLIERS } from './types';
import {
  PROD_SIZE_BASE, PROD_SIZE_SCALE,
  PROD_ARMS_BASE, PROD_ARMS_SCALE,
} from '../core/balance';

/** Calculate plankton per second for a single creature */
export function calculateProduction(creature: Creature, adjacencyBonus: number): number {
  const base =
    TYPE_MULTIPLIERS[creature.type] *
    (PROD_SIZE_BASE + creature.genes.size * PROD_SIZE_SCALE) *
    (PROD_ARMS_BASE + creature.genes.arms * PROD_ARMS_SCALE);

  return base * (1 + adjacencyBonus);
}
