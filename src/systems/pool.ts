import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';

/** Place a creature in a specific pool slot */
export function placeCreature(state: GameState, creature: Creature, row: number, col: number): boolean {
  if (row < 0 || row >= state.pool.length || col < 0 || col >= state.pool[0].length) return false;
  if (state.pool[row][col].creatureId !== null) return false;

  // Add creature to creatures array if not already there
  if (!state.creatures.find((c) => c.id === creature.id)) {
    state.creatures.push(creature);
  }

  state.pool[row][col].creatureId = creature.id;
  return true;
}

/** Remove a creature from the pool */
export function removeCreature(state: GameState, row: number, col: number): Creature | null {
  const slot = state.pool[row]?.[col];
  if (!slot || !slot.creatureId) return null;

  const creature = state.creatures.find((c) => c.id === slot.creatureId) ?? null;
  slot.creatureId = null;
  return creature;
}

/** Get orthogonally adjacent creatures for a given slot */
export function getAdjacentCreatures(state: GameState, row: number, col: number): Creature[] {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const adjacent: Creature[] = [];

  for (const [dr, dc] of directions) {
    const r = row + dr, c = col + dc;
    const slot = state.pool[r]?.[c];
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
  for (let r = 0; r < state.pool.length; r++) {
    for (let c = 0; c < state.pool[r].length; c++) {
      if (state.pool[r][c].creatureId === creatureId) return [r, c];
    }
  }
  return null;
}

/** Find first empty slot in the pool */
export function findEmptySlot(state: GameState): [number, number] | null {
  for (let r = 0; r < state.pool.length; r++) {
    for (let c = 0; c < state.pool[r].length; c++) {
      if (state.pool[r][c].creatureId === null) return [r, c];
    }
  }
  return null;
}

/** Get creature at a specific slot */
export function getCreatureAt(state: GameState, row: number, col: number): Creature | null {
  const slot = state.pool[row]?.[col];
  if (!slot?.creatureId) return null;
  return state.creatures.find((c) => c.id === slot.creatureId) ?? null;
}
