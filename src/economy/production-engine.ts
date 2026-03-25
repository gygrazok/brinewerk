import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { unlockedSlots } from '../systems/coords';
import { getUpgradeLevel, getUpgradeEffect } from '../systems/upgrades';

/** Cached creature-id lookup map — invalidated when creatures array is mutated */
let cachedMap: Map<string, GameState['creatures'][0]> | null = null;
let cachedLen = -1;

/** Build a fast creature-id lookup map, reusing cache if creatures array hasn't changed */
function getCreatureMap(state: GameState): Map<string, GameState['creatures'][0]> {
  if (cachedMap && cachedLen === state.creatures.length) return cachedMap;
  const map = new Map<string, GameState['creatures'][0]>();
  for (const c of state.creatures) map.set(c.id, c);
  cachedMap = map;
  cachedLen = state.creatures.length;
  return map;
}

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  let totalPlanktonPerSec = 0;
  const creatureMap = getCreatureMap(state);
  const fertileMultiplier = getUpgradeEffect('fertile_waters', getUpgradeLevel(state, 'fertile_waters'));

  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;

    const prod = calculateProduction(creature);
    totalPlanktonPerSec += prod;
    creature.lifetimePlankton += prod * deltaSec * fertileMultiplier;
  }

  state.resources.plankton += totalPlanktonPerSec * deltaSec * fertileMultiplier;
}

/** Get current total plankton/s rate */
export function getTotalProductionRate(state: GameState): number {
  let total = 0;
  const creatureMap = getCreatureMap(state);
  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;
    total += calculateProduction(creature);
  }
  const fertileMultiplier = getUpgradeEffect('fertile_waters', getUpgradeLevel(state, 'fertile_waters'));
  return total * fertileMultiplier;
}
