import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { unlockedSlots } from '../systems/coords';

/** Build a fast creature-id lookup map */
function buildCreatureMap(state: GameState): Map<string, typeof state.creatures[0]> {
  const map = new Map<string, typeof state.creatures[0]>();
  for (const c of state.creatures) map.set(c.id, c);
  return map;
}

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  let totalPlanktonPerSec = 0;
  const creatureMap = buildCreatureMap(state);

  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;

    const prod = calculateProduction(creature);
    totalPlanktonPerSec += prod;
    creature.lifetimePlankton += prod * deltaSec;
  }

  state.resources.plankton += totalPlanktonPerSec * deltaSec;
}

/** Get current total plankton/s rate */
export function getTotalProductionRate(state: GameState): number {
  let total = 0;
  const creatureMap = buildCreatureMap(state);
  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;
    total += calculateProduction(creature);
  }
  return total;
}
