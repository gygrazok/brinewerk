import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { calculateAdjacencyBonus } from '../systems/pool';
import { getStructureBonus } from './structures';

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  let totalPlanktonPerSec = 0;

  for (let r = 0; r < state.pool.length; r++) {
    for (let c = 0; c < state.pool[r].length; c++) {
      const slot = state.pool[r][c];
      if (!slot.creatureId || slot.creatureId.startsWith('struct:')) continue;
      const creature = state.creatures.find((cr) => cr.id === slot.creatureId);
      if (!creature) continue;

      const adjacencyBonus = calculateAdjacencyBonus(state, r, c);
      const structureBonus = getStructureBonus(state, r, c);
      totalPlanktonPerSec += calculateProduction(creature, adjacencyBonus + structureBonus);
    }
  }

  state.resources.plankton += totalPlanktonPerSec * deltaSec;
}

/** Get current total plankton/s rate */
export function getTotalProductionRate(state: GameState): number {
  let total = 0;
  for (let r = 0; r < state.pool.length; r++) {
    for (let c = 0; c < state.pool[r].length; c++) {
      const slot = state.pool[r][c];
      if (!slot.creatureId || slot.creatureId.startsWith('struct:')) continue;
      const creature = state.creatures.find((cr) => cr.id === slot.creatureId);
      if (!creature) continue;
      const adjacencyBonus = calculateAdjacencyBonus(state, r, c);
      const structureBonus = getStructureBonus(state, r, c);
      total += calculateProduction(creature, adjacencyBonus + structureBonus);
    }
  }
  return total;
}
