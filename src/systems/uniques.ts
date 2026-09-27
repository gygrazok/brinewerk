import type { GameState } from '../core/game-state';
import { UNIQUES, type UniqueId } from '../creatures/uniques';
import { UNIQUE_CHANCE_MIN, UNIQUE_CHANCE_MAX } from '../core/balance';
import { getCollectionCompletion } from './registry';

/**
 * Unique creatures: rolled per shore creature, independent of rare tiers and pity.
 * A rolled unique waits on the shore (across tides) until the player collects it.
 */

/** Spawn chance per shore creature: 1 in 100,000 at 0% Collection, 1 in 1,000 at 100%. */
export function getUniqueChance(state: GameState): number {
  return UNIQUE_CHANCE_MIN * Math.pow(UNIQUE_CHANCE_MAX / UNIQUE_CHANCE_MIN, getCollectionCompletion(state));
}

export function isUniqueFound(state: GameState, id: UniqueId): boolean {
  return state.uniques[id] === true;
}

export function getFoundUniques(state: GameState): UniqueId[] {
  return UNIQUES.filter((u) => isUniqueFound(state, u.id)).map((u) => u.id);
}

/** Roll once per shore creature; on a hit, a not-yet-found unique appears on the shore. */
export function rollShoreUnique(state: GameState, rng: () => number, rolls: number): void {
  if (state.shoreUnique) return;
  const pool = UNIQUES.filter((u) => !isUniqueFound(state, u.id));
  if (pool.length === 0) return;
  const chance = getUniqueChance(state);
  for (let i = 0; i < rolls; i++) {
    if (rng() < chance) {
      state.shoreUnique = pool[Math.floor(rng() * pool.length)].id;
      return;
    }
  }
}

/** Move the shore unique into the Collection. Returns its id, or null if none was waiting. */
export function collectShoreUnique(state: GameState): UniqueId | null {
  const id = state.shoreUnique;
  if (!id) return null;
  state.uniques[id] = true;
  state.shoreUnique = null;
  return id;
}
