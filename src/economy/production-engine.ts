import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { calculateAdjacencyBonus } from '../systems/pool';
import { getUpgradeBonus } from './upgrades';
import { allSlots } from '../systems/coords';

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  let totalPlanktonPerSec = 0;

  for (const [r, c, slot] of allSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = state.creatures.find((cr) => cr.id === slot.creatureId);
    if (!creature) continue;

    const adjacencyBonus = calculateAdjacencyBonus(state, r, c);
    const upgradeBonus = getUpgradeBonus(state, r, c);
    totalPlanktonPerSec += calculateProduction(creature, adjacencyBonus + upgradeBonus);
  }

  state.resources.plankton += totalPlanktonPerSec * deltaSec;
}

/** Get current total plankton/s rate */
export function getTotalProductionRate(state: GameState): number {
  let total = 0;
  for (const [r, c, slot] of allSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = state.creatures.find((cr) => cr.id === slot.creatureId);
    if (!creature) continue;
    const adjacencyBonus = calculateAdjacencyBonus(state, r, c);
    const upgradeBonus = getUpgradeBonus(state, r, c);
    total += calculateProduction(creature, adjacencyBonus + upgradeBonus);
  }
  return total;
}
