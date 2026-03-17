import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { calculateAdjacencyBonus } from '../systems/pool';
import { unlockedSlots } from '../systems/coords';

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  let totalPlanktonPerSec = 0;

  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = state.creatures.find(cr => cr.id === slot.creatureId);
    if (!creature) continue;

    const adjacencyBonus = calculateAdjacencyBonus(state, slot.id);
    const prod = calculateProduction(creature, adjacencyBonus);
    totalPlanktonPerSec += prod;
    creature.lifetimePlankton += prod * deltaSec;
  }

  state.resources.plankton += totalPlanktonPerSec * deltaSec;
}

/** Get current total plankton/s rate */
export function getTotalProductionRate(state: GameState): number {
  let total = 0;
  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = state.creatures.find(cr => cr.id === slot.creatureId);
    if (!creature) continue;
    const adjacencyBonus = calculateAdjacencyBonus(state, slot.id);
    total += calculateProduction(creature, adjacencyBonus);
  }
  return total;
}
