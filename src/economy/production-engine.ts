import type { GameState, SeabedSlot } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { calculateProduction } from '../creatures/production';
import { calculateTraitDeviation } from '../creatures/creature';
import { unlockedSlots, getSlotDepth } from '../systems/coords';
import { getUpgradeLevel, upgradeEffect } from '../systems/upgrades';
import { getRegistryMultiplier } from '../systems/registry';
import { MINERITE_BASE_RATE, LUX_BASE_RATE, BIOLUM_GLOW_BONUS, COLLECTIBLE_PLANKTON_RATE_SECONDS } from '../core/balance';

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
  /** Global multiplier on plankton (upgrades × registry). */
  planktonMul: number;
  /** Global multiplier on minerite and lux (registry). */
  secondaryMul: number;
  deepDrilling: boolean;
  /** Bioluminescence level: scales each creature's lux by its glow gene. */
  biolumLevel: number;
}

/** Product of every global plankton multiplier: upgrades and registry. */
export function getPlanktonMultiplier(state: GameState): number {
  return (
    upgradeEffect(state, 'fertile_waters') *
    upgradeEffect(state, 'pearl_bloom') *
    upgradeEffect(state, 'mineral_feed') *
    getRegistryMultiplier(state)
  );
}

function getProductionFlags(state: GameState): ProductionFlags {
  return {
    planktonMul: getPlanktonMultiplier(state),
    secondaryMul: getRegistryMultiplier(state),
    deepDrilling: getUpgradeLevel(state, 'deep_drilling') > 0,
    biolumLevel: getUpgradeLevel(state, 'bioluminescence'),
  };
}

/** Per-slot yield with global multipliers applied. */
function computeSlotYield(slot: SeabedSlot, creature: Creature, flags: ProductionFlags): ProductionRates {
  const plankton = calculateProduction(creature) * flags.planktonMul;
  const levelScale = Math.sqrt(creature.level) * flags.secondaryMul;
  let minerite = 0;
  let lux = 0;
  const depth = getSlotDepth(slot);
  if (flags.deepDrilling && depth === 'deep') {
    minerite = MINERITE_BASE_RATE * calculateTraitDeviation(creature) * levelScale;
  }
  if (depth === 'shallow') {
    const glowMul = 1 + BIOLUM_GLOW_BONUS * flags.biolumLevel * creature.genes.glow;
    lux = LUX_BASE_RATE * glowMul * levelScale;
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
  return { plankton, minerite, lux };
}

/** Rates a single creature would produce in a given slot, with global multipliers. */
export function getCreatureRates(state: GameState, slot: SeabedSlot, creature: Creature): ProductionRates {
  return computeSlotYield(slot, creature, getProductionFlags(state));
}

/** Value of a plankton clump with `baseAmount`: base plus a slice of passive income, times Plankton Surge. */
export function planktonClumpValue(state: GameState, baseAmount: number): number {
  const passive = getProductionRates(state).plankton;
  return (baseAmount + passive * COLLECTIBLE_PLANKTON_RATE_SECONDS) * upgradeEffect(state, 'plankton_surge');
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
  });
  state.resources.plankton += totalPlankton * deltaSec;
  state.resources.minerite += totalMinerite * deltaSec;
  state.resources.lux += totalLux * deltaSec;
}
