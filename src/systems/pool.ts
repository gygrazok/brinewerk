import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getSlotById, unlockedSlots } from './coords';
import { getSlotUnlockCost } from '../core/balance';

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
