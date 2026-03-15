import type { GameState } from '../core/game-state';
import { ALGAE_COLONY_COST, ALGAE_COLONY_MULTIPLIER } from '../core/balance';

export enum StructureType {
  AlgaeColony = 'algae_colony',
}

export interface Structure {
  id: string;
  type: StructureType;
  row: number;
  col: number;
}

let _nextStructId = 0;

/** Check if player can build an Algae Colony */
export function canBuildAlgaeColony(state: GameState): boolean {
  return state.resources.plankton >= ALGAE_COLONY_COST;
}

/** Build an Algae Colony in a pool slot (slot must be empty) */
export function buildAlgaeColony(state: GameState, row: number, col: number): boolean {
  if (!canBuildAlgaeColony(state)) return false;

  const slot = state.pool[row]?.[col];
  if (!slot || slot.creatureId !== null) return false;

  state.resources.plankton -= ALGAE_COLONY_COST;

  const structure: Structure = {
    id: `s_${Date.now()}_${_nextStructId++}`,
    type: StructureType.AlgaeColony,
    row,
    col,
  };

  if (!state.structures) state.structures = [];
  state.structures.push(structure);

  // Mark slot as occupied by structure
  slot.creatureId = `struct:${structure.id}`;

  return true;
}

/** Get structure bonus multiplier for a pool slot from adjacent structures */
export function getStructureBonus(state: GameState, row: number, col: number): number {
  if (!state.structures) return 0;

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let bonus = 0;

  for (const [dr, dc] of directions) {
    const r = row + dr, c = col + dc;
    const adjacentStructure = state.structures.find((s) => s.row === r && s.col === c);
    if (adjacentStructure?.type === StructureType.AlgaeColony) {
      bonus += ALGAE_COLONY_MULTIPLIER - 1; // +100% = 2x multiplier
    }
  }

  return bonus;
}
