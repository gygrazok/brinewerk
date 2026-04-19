import type { GameState, SeabedSlot } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { calculateProduction } from '../creatures/production';
import { calculateTraitDeviation } from '../creatures/creature';
import { unlockedSlots, getSlotDepth } from '../systems/coords';
import { getUpgradeLevel, getUpgradeEffect } from '../systems/upgrades';
import { MINERITE_BASE_RATE, LUX_BASE_RATE } from '../core/balance';

/** Cached creature-id lookup map — invalidated when creatures array is mutated */
let cachedMap: Map<string, Creature> | null = null;
let cachedLen = -1;

/** Build a fast creature-id lookup map, reusing cache if creatures array hasn't changed */
function getCreatureMap(state: GameState): Map<string, Creature> {
  if (cachedMap && cachedLen === state.creatures.length) return cachedMap;
  const map = new Map<string, Creature>();
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

interface ProductionFlags {
  fertileMul: number;
  deepDrilling: boolean;
  biolum: boolean;
}

function getProductionFlags(state: GameState): ProductionFlags {
  return {
    fertileMul: getUpgradeEffect('fertile_waters', getUpgradeLevel(state, 'fertile_waters')),
    deepDrilling: getUpgradeLevel(state, 'deep_drilling') > 0,
    biolum: getUpgradeLevel(state, 'bioluminescence') > 0,
  };
}

/**
 * Per-slot yield before the fertile-waters plankton multiplier.
 * Plankton is returned raw so callers can apply fertileMul once at the end
 * (either to the live sum or to per-creature lifetime tracking).
 */
function computeSlotYield(slot: SeabedSlot, creature: Creature, flags: ProductionFlags): ProductionRates {
  const plankton = calculateProduction(creature);
  let minerite = 0;
  let lux = 0;
  const depth = getSlotDepth(slot);
  if (flags.deepDrilling && depth === 'deep') {
    minerite = MINERITE_BASE_RATE * calculateTraitDeviation(creature);
  }
  if (flags.biolum && depth === 'shallow') {
    lux = LUX_BASE_RATE * Math.max(0, creature.genes.glow - 0.5) * 2;
  }
  return { plankton, minerite, lux };
}

/** Iterate occupied slots, calling `visit` with the slot and creature. */
function forEachProducingSlot(
  state: GameState,
  visit: (slot: SeabedSlot, creature: Creature) => void,
): void {
  const creatureMap = getCreatureMap(state);
  for (const slot of unlockedSlots(state.pool)) {
    if (!slot.creatureId) continue;
    const creature = creatureMap.get(slot.creatureId);
    if (!creature) continue;
    visit(slot, creature);
  }
}

/** Compute current per-second production rates for plankton, minerite, lux. */
export function getProductionRates(state: GameState): ProductionRates {
  const flags = getProductionFlags(state);
  let plankton = 0;
  let minerite = 0;
  let lux = 0;
  forEachProducingSlot(state, (slot, creature) => {
    const y = computeSlotYield(slot, creature, flags);
    plankton += y.plankton;
    minerite += y.minerite;
    lux += y.lux;
  });
  return { plankton: plankton * flags.fertileMul, minerite, lux };
}

/** Advance resource production for one tick */
export function tickProduction(state: GameState, deltaSec: number): void {
  const flags = getProductionFlags(state);
  let totalPlankton = 0;
  let totalMinerite = 0;
  let totalLux = 0;
  forEachProducingSlot(state, (slot, creature) => {
    const y = computeSlotYield(slot, creature, flags);
    totalPlankton += y.plankton;
    totalMinerite += y.minerite;
    totalLux += y.lux;
    creature.lifetimePlankton += y.plankton * deltaSec * flags.fertileMul;
  });
  state.resources.plankton += totalPlankton * deltaSec * flags.fertileMul;
  state.resources.minerite += totalMinerite * deltaSec;
  state.resources.lux += totalLux * deltaSec;
}
