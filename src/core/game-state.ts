import type { Creature } from '../creatures/creature';
import type { CoordKey } from '../systems/coords';
import { toKey } from '../systems/coords';

const SAVE_KEY = 'brinewerk_save';
const CURRENT_SAVE_VERSION = 2;

export interface PoolSlot {
  creatureId: string | null;
}

export interface SparsePool {
  slots: Record<CoordKey, PoolSlot>;
}

export type UpgradeType = 'algae_colony';

export interface UpgradeNode {
  id: string;
  row: number; // top-left of the 2x2 block
  col: number;
  upgradeType: UpgradeType | null;
}

export interface GameState {
  saveVersion: number;
  creatures: Creature[];
  pool: SparsePool;
  resources: { plankton: number; minerite: number; lux: number };
  upgradeNodes: UpgradeNode[];
  shore: Creature[];
  lastSaveTimestamp: number;
  lastTideTimestamp: number;
  totalPlaytime: number; // seconds
}

export function createDefaultState(): GameState {
  const pool: SparsePool = { slots: {} };
  pool.slots[toKey(0, 0)] = { creatureId: null };

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    creatures: [],
    pool,
    resources: { plankton: 0, minerite: 0, lux: 0 },
    upgradeNodes: [],
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
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** Migrate old save formats to current version */
function migrateState(data: Record<string, unknown>): GameState {
  const version = (data.saveVersion as number) ?? 1;

  if (version < 2) {
    // V1 → V2: dense pool[][] → SparsePool, structures → upgradeNodes
    const oldPool = data.pool as { creatureId: string | null }[][] | undefined;
    const newPool: SparsePool = { slots: {} };

    if (Array.isArray(oldPool)) {
      for (let r = 0; r < oldPool.length; r++) {
        for (let c = 0; c < oldPool[r].length; c++) {
          const slot = oldPool[r][c];
          // Skip slots occupied by structures (struct:xxx)
          if (slot.creatureId && slot.creatureId.startsWith('struct:')) {
            newPool.slots[toKey(r, c)] = { creatureId: null };
          } else {
            newPool.slots[toKey(r, c)] = { creatureId: slot.creatureId };
          }
        }
      }
    } else {
      // Fallback: single slot
      newPool.slots[toKey(0, 0)] = { creatureId: null };
    }

    // Refund structure costs as plankton
    const oldStructures = data.structures as { id: string; type: string; row: number; col: number }[] | undefined;
    const resources = data.resources as { plankton: number; minerite: number; lux: number };
    if (oldStructures && oldStructures.length > 0) {
      resources.plankton += oldStructures.length * 500; // refund ALGAE_COLONY_COST
    }

    data.pool = newPool;
    data.upgradeNodes = [];
    data.saveVersion = CURRENT_SAVE_VERSION;
    delete data.structures;
  }

  return data as unknown as GameState;
}
