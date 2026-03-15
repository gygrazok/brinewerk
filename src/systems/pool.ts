import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { getSlot, setSlot, allSlots, slotCount, getExpansionCandidates } from './coords';
import { getExpansionCost } from '../core/balance';

/** Place a creature in a specific pool slot */
export function placeCreature(state: GameState, creature: Creature, row: number, col: number): boolean {
  const slot = getSlot(state.pool, row, col);
  if (!slot || slot.creatureId !== null) return false;

  // Add creature to creatures array if not already there
  if (!state.creatures.find((c) => c.id === creature.id)) {
    state.creatures.push(creature);
  }

  slot.creatureId = creature.id;
  return true;
}

/** Remove a creature from the pool */
export function removeCreature(state: GameState, row: number, col: number): Creature | null {
  const slot = getSlot(state.pool, row, col);
  if (!slot || !slot.creatureId) return null;

  const creature = state.creatures.find((c) => c.id === slot.creatureId) ?? null;
  slot.creatureId = null;
  return creature;
}

/** Get orthogonally adjacent creatures for a given slot */
export function getAdjacentCreatures(state: GameState, row: number, col: number): Creature[] {
  const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const adjacent: Creature[] = [];

  for (const [dr, dc] of directions) {
    const slot = getSlot(state.pool, row + dr, col + dc);
    if (slot?.creatureId) {
      const creature = state.creatures.find((cr) => cr.id === slot.creatureId);
      if (creature) adjacent.push(creature);
    }
  }

  return adjacent;
}

/** Calculate adjacency bonus for a slot (Blobid symbiosis) */
export function calculateAdjacencyBonus(state: GameState, row: number, col: number): number {
  const adjacent = getAdjacentCreatures(state, row, col);
  let bonus = 0;

  for (const adj of adjacent) {
    if (adj.type === CreatureType.Blobid) {
      // Blobid symbiosis: +15-25% based on tentacles gene
      bonus += 0.15 + adj.genes.tentacles * 0.10;
    }
  }

  return bonus;
}

/** Find the slot position [row, col] of a creature in the pool */
export function findCreatureSlot(state: GameState, creatureId: string): [number, number] | null {
  for (const [r, c, slot] of allSlots(state.pool)) {
    if (slot.creatureId === creatureId) return [r, c];
  }
  return null;
}

/** Find first empty slot in the pool */
export function findEmptySlot(state: GameState): [number, number] | null {
  for (const [r, c, slot] of allSlots(state.pool)) {
    if (slot.creatureId === null) return [r, c];
  }
  return null;
}

/** Get creature at a specific slot */
export function getCreatureAt(state: GameState, row: number, col: number): Creature | null {
  const slot = getSlot(state.pool, row, col);
  if (!slot?.creatureId) return null;
  return state.creatures.find((c) => c.id === slot.creatureId) ?? null;
}

/** Expand the pool by adding a new slot at (r, c). Deducts resources. */
export function expandPool(state: GameState, r: number, c: number): boolean {
  // Validate this is a valid expansion candidate
  const candidates = getExpansionCandidates(state.pool);
  const isCandidate = candidates.some(([cr, cc]) => cr === r && cc === c);
  if (!isCandidate) return false;

  // Check cost
  const cost = getExpansionCost(slotCount(state.pool));
  if (state.resources.plankton < cost.plankton) return false;
  if (state.resources.minerite < cost.minerite) return false;
  if (state.resources.lux < cost.lux) return false;

  // Deduct cost
  state.resources.plankton -= cost.plankton;
  state.resources.minerite -= cost.minerite;
  state.resources.lux -= cost.lux;

  // Add slot
  setSlot(state.pool, r, c, { creatureId: null });
  return true;
}
