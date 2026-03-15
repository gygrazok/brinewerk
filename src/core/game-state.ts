import type { Creature } from '../creatures/creature';
import type { Structure } from '../economy/structures';

const SAVE_KEY = 'brinewerk_save';
const POOL_SIZE = 3;

export interface PoolSlot {
  creatureId: string | null;
}

export interface GameState {
  creatures: Creature[];
  pool: PoolSlot[][];
  resources: { plankton: number; minerite: number; lux: number };
  structures: Structure[];
  shore: Creature[];
  lastSaveTimestamp: number;
  lastTideTimestamp: number;
  totalPlaytime: number; // seconds
}

export function createDefaultState(): GameState {
  const pool: PoolSlot[][] = [];
  for (let r = 0; r < POOL_SIZE; r++) {
    const row: PoolSlot[] = [];
    for (let c = 0; c < POOL_SIZE; c++) {
      row.push({ creatureId: null });
    }
    pool.push(row);
  }

  return {
    creatures: [],
    pool,
    resources: { plankton: 0, minerite: 0, lux: 0 },
    structures: [],
    shore: [],
    lastSaveTimestamp: Date.now(),
    lastTideTimestamp: Date.now(),
    totalPlaytime: 0,
  };
}

export function saveState(state: GameState): void {
  state.lastSaveTimestamp = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
