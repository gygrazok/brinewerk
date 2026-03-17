import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { getSlotById, unlockedSlots, getNearbySlots } from './coords';
import { getSlotUnlockCost, BLOBID_SYMBIOSIS_BASE, BLOBID_SYMBIOSIS_SCALE } from '../core/balance';

/** Adjacency radius for proximity-based bonuses (px in world space) */
const ADJACENCY_RADIUS = 120;

/** Place a creature in a specific seabed slot */
export function placeCreature(state: GameState, creature: Creature, slotId: string): boolean {
  const slot = getSlotById(state.pool, slotId);
  if (!slot || !slot.unlocked || slot.creatureId !== null) return false;

  if (!state.creatures.find(c => c.id === creature.id)) {
    state.creatures.push(creature);
  }

  slot.creatureId = creature.id;
  return true;
}

/** Remove a creature from a seabed slot */
export function removeCreature(state: GameState, slotId: string): Creature | null {
  const slot = getSlotById(state.pool, slotId);
  if (!slot || !slot.creatureId) return null;

  const creature = state.creatures.find(c => c.id === slot.creatureId) ?? null;
  slot.creatureId = null;
  return creature;
}

/** Get creature at a specific slot */
export function getCreatureAt(state: GameState, slotId: string): Creature | null {
  const slot = getSlotById(state.pool, slotId);
  if (!slot?.creatureId) return null;
  return state.creatures.find(c => c.id === slot.creatureId) ?? null;
}

/** Get creatures in nearby slots (proximity-based adjacency) */
export function getAdjacentCreatures(state: GameState, slotId: string): Creature[] {
  const nearby = getNearbySlots(state.pool, slotId, ADJACENCY_RADIUS);
  const result: Creature[] = [];
  for (const ns of nearby) {
    if (ns.creatureId) {
      const creature = state.creatures.find(c => c.id === ns.creatureId);
      if (creature) result.push(creature);
    }
  }
  return result;
}

/** Calculate adjacency bonus for a slot (Blobid symbiosis) */
export function calculateAdjacencyBonus(state: GameState, slotId: string): number {
  const adjacent = getAdjacentCreatures(state, slotId);
  let bonus = 0;
  for (const adj of adjacent) {
    if (adj.type === CreatureType.Blobid) {
      bonus += BLOBID_SYMBIOSIS_BASE + adj.genes.tentacles * BLOBID_SYMBIOSIS_SCALE;
    }
  }
  return bonus;
}

/** Find the slot ID where a creature is placed */
export function findCreatureSlot(state: GameState, creatureId: string): string | null {
  for (const slot of unlockedSlots(state.pool)) {
    if (slot.creatureId === creatureId) return slot.id;
  }
  return null;
}

/** Find first empty unlocked slot */
export function findEmptySlot(state: GameState): string | null {
  for (const slot of unlockedSlots(state.pool)) {
    if (slot.creatureId === null) return slot.id;
  }
  return null;
}

/** Unlock a locked seabed slot. Deducts Nacre. */
export function expandPool(state: GameState, slotId: string): boolean {
  const slot = getSlotById(state.pool, slotId);
  if (!slot || slot.unlocked) return false;

  const cost = getSlotUnlockCost(slot.tier);
  if (state.resources.nacre < cost.nacre) return false;

  state.resources.nacre -= cost.nacre;

  slot.unlocked = true;
  return true;
}
