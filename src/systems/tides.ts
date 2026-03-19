import type { GameState } from '../core/game-state';
import { type Creature, spawnCreature, calculateTraitDeviation, getRareInfo } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import {
  TIDE_INTERVAL_MIN, TIDE_INTERVAL_MAX,
  PICKUP_BASE_COST, PICKUP_DEVIATION_SCALE, PICKUP_RARE_TIER_MULTIPLIERS,
} from '../core/balance';
import { allSlots } from './coords';

const SHORE_CAPACITY = 4;

/** Creature types available from tides */
const TIDE_TYPES = [CreatureType.Stellarid, CreatureType.Blobid, CreatureType.Corallid, CreatureType.Nucleid];

/** Generate 1-3 random tide creatures using state's rare settings */
function generateTideCreatures(state: GameState): Creature[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const creatures: Creature[] = [];
  for (let i = 0; i < Math.min(count, SHORE_CAPACITY); i++) {
    const type = TIDE_TYPES[Math.floor(Math.random() * TIDE_TYPES.length)];
    creatures.push(spawnCreature(state, { type }));
  }
  return creatures;
}

/** Check if a new tide should arrive */
export function checkTide(state: GameState, now: number): boolean {
  const elapsed = (now - state.lastTideTimestamp) / 1000;
  const interval = TIDE_INTERVAL_MIN + Math.random() * (TIDE_INTERVAL_MAX - TIDE_INTERVAL_MIN);

  if (elapsed < interval) return false;

  state.shore = generateTideCreatures(state);
  state.lastTideTimestamp = now;
  return true;
}

/** Calculate plankton cost to pick up a creature from shore.
 *  Cost scales with how much the creature's traits deviate from average (rarer = pricier). */
export function calculatePickupCost(creature: Creature): number {
  const deviation = calculateTraitDeviation(creature); // 0 = average, 1 = max extreme
  let cost = PICKUP_BASE_COST + deviation * PICKUP_DEVIATION_SCALE;

  // Rare creatures cost more based on tier
  if (creature.rare) {
    const info = getRareInfo(creature.rare);
    cost *= PICKUP_RARE_TIER_MULTIPLIERS[info.tier] ?? 1;
  }

  return Math.round(cost);
}

/** Pick up a creature from the shore (removes it from shore, doesn't place in pool) */
export function pickUpCreature(state: GameState, shoreIndex: number): Creature | null {
  if (shoreIndex < 0 || shoreIndex >= state.shore.length) return null;

  const creature = state.shore[shoreIndex];
  const cost = calculatePickupCost(creature);

  if (state.resources.plankton < cost) return null;

  state.resources.plankton -= cost;
  state.shore.splice(shoreIndex, 1);
  return creature;
}

/** Force a tide immediately (debug / manual trigger) */
export function forceTide(state: GameState): void {
  state.shore = generateTideCreatures(state);
  state.lastTideTimestamp = Date.now();
}

/** Force a tide (for initial game start) */
export function forceInitialTide(state: GameState): void {
  const hasPoolCreatures = allSlots(state.pool).some(s => s.creatureId !== null);

  if (hasPoolCreatures) return; // already playing

  // No creatures in pool — spawn one of each type so the player sees all phyla
  if (state.shore.length === 0) {
    state.shore = TIDE_TYPES.map((type) => spawnCreature(state, { type }));
    state.lastTideTimestamp = Date.now();
  }

  // Always ensure enough plankton to pick up the cheapest shore creature + first expansion
  if (state.shore.length > 0) {
    const cheapest = Math.min(...state.shore.map(calculatePickupCost));
    state.resources.plankton = Math.max(state.resources.plankton, cheapest + 80);
  }
}
