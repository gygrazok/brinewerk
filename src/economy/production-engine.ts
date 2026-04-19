import type { GameState } from '../core/game-state';
import { calculateProduction } from '../creatures/production';
import { calculateTraitDeviation } from '../creatures/creature';
import { unlockedSlots, getSlotDepth } from '../systems/coords';
import { getUpgradeLevel, getUpgradeEffect } from '../systems/upgrades';
import { MINERITE_BASE_RATE, LUX_BASE_RATE } from '../core/balance';

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

export interface ProductionRates {
  plankton: number;
  minerite: number;
  lux: number;
}

/** Compute current per-second production rates for plankton, minerite, lux. */
export function getProductionRates(state: GameState): ProductionRates {
  const creatureMap = getCreatureMap(state);
  const fertileMul = getUpgradeEffect('fertile_waters', getUpgradeLevel(state, 'fertile_waters'));
  const deepDrilling = getUpgradeLevel(state, 'deep_drilling') > 0;
  const biolum = getUpgradeLevel(state, 'bioluminescence') > 0;

  let plankton = 0;
  let minerite = 0;
  let lux = 0;

  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;

    plankton += calculateProduction(creature);

    const depth = getSlotDepth(slot);
    if (deepDrilling && depth === 'deep') {
      minerite += MINERITE_BASE_RATE * calculateTraitDeviation(creature);
    }
    if (biolum && depth === 'shallow') {
      lux += LUX_BASE_RATE * Math.max(0, creature.genes.glow - 0.5) * 2;
    }
  }

  return {
    plankton: plankton * fertileMul,
    minerite,
    lux,
  };
}

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  const creatureMap = getCreatureMap(state);
  const fertileMul = getUpgradeEffect('fertile_waters', getUpgradeLevel(state, 'fertile_waters'));
  const deepDrilling = getUpgradeLevel(state, 'deep_drilling') > 0;
  const biolum = getUpgradeLevel(state, 'bioluminescence') > 0;

  let totalPlankton = 0;
  let totalMinerite = 0;
  let totalLux = 0;

  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;

    const prod = calculateProduction(creature);
    totalPlankton += prod;
    creature.lifetimePlankton += prod * deltaSec * fertileMul;

    const depth = getSlotDepth(slot);
    if (deepDrilling && depth === 'deep') {
      totalMinerite += MINERITE_BASE_RATE * calculateTraitDeviation(creature);
    }
    if (biolum && depth === 'shallow') {
      totalLux += LUX_BASE_RATE * Math.max(0, creature.genes.glow - 0.5) * 2;
    }
  }

  state.resources.plankton += totalPlankton * deltaSec * fertileMul;
  state.resources.minerite += totalMinerite * deltaSec;
  state.resources.lux += totalLux * deltaSec;
}

/** Backwards-compat: total plankton per second (used by HUD/tests). */
export function getTotalProductionRate(state: GameState): number {
  return getProductionRates(state).plankton;
}
