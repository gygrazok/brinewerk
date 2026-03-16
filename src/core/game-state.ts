import type { Creature } from '../creatures/creature';
import { SEABED_SLOTS } from '../systems/seabed-layout';

const SAVE_KEY = 'brinewerk_save';
const CURRENT_SAVE_VERSION = 4;

// --- Seabed pool (v3+) ---

export type SlotTheme = 'rock' | 'coral' | 'shell' | 'anemone' | 'vent';

export interface SeabedSlot {
  id: string;
  x: number;
  y: number;
  creatureId: string | null;
  unlocked: boolean;
  theme: SlotTheme;
  tier: number;
}

export interface SeabedPool {
  slots: Record<string, SeabedSlot>;
  worldWidth: number;
  worldHeight: number;
}

export type UpgradeType = 'algae_colony';

export interface UpgradeAnchor {
  id: string;
  x: number;
  y: number;
  upgradeType: UpgradeType | null;
}

export interface GameState {
  saveVersion: number;
  seabedSeed: number;
  creatures: Creature[];
  pool: SeabedPool;
  resources: { plankton: number; minerite: number; lux: number };
  upgradeAnchors: UpgradeAnchor[];
  shore: Creature[];
  lastSaveTimestamp: number;
  lastTideTimestamp: number;
  totalPlaytime: number; // seconds
}

export function createDefaultState(): GameState {
  const pool: SeabedPool = { slots: {}, worldWidth: 1920, worldHeight: 1080 };
  for (const def of SEABED_SLOTS) {
    pool.slots[def.id] = { ...def, creatureId: null };
  }

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    seabedSeed: Math.floor(Math.random() * 2_147_483_647),
    creatures: [],
    pool,
    resources: { plankton: 0, minerite: 0, lux: 0 },
    upgradeAnchors: [],
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

  // V1 → V2: dense pool[][] → SparsePool (intermediate step)
  if (version < 2) {
    const oldPool = data.pool as { creatureId: string | null }[][] | undefined;
    const sparseSlots: Record<string, { creatureId: string | null }> = {};

    if (Array.isArray(oldPool)) {
      for (let r = 0; r < oldPool.length; r++) {
        for (let c = 0; c < oldPool[r].length; c++) {
          const slot = oldPool[r][c];
          const cid = slot.creatureId && slot.creatureId.startsWith('struct:') ? null : slot.creatureId;
          sparseSlots[`${r},${c}`] = { creatureId: cid };
        }
      }
    } else {
      sparseSlots['0,0'] = { creatureId: null };
    }

    // Refund structure costs
    const oldStructures = data.structures as { length: number } | undefined;
    const resources = data.resources as { plankton: number; minerite: number; lux: number };
    if (oldStructures && oldStructures.length > 0) {
      resources.plankton += oldStructures.length * 500;
    }

    data.pool = { slots: sparseSlots };
    data.upgradeNodes = [];
    data.saveVersion = 2;
    delete data.structures;
  }

  // V2 → V3: SparsePool (grid) → SeabedPool (scattered slots)
  if ((data.saveVersion as number) < 3) {
    const oldPool = data.pool as { slots: Record<string, { creatureId: string | null }> };
    const oldCreatureIds: string[] = [];

    // Collect creature IDs from old grid slots
    for (const slot of Object.values(oldPool.slots)) {
      if (slot.creatureId) oldCreatureIds.push(slot.creatureId);
    }

    // Build new SeabedPool from layout, mapping old creatures to first N slots
    const newPool: SeabedPool = { slots: {}, worldWidth: 1920, worldHeight: 1080 };
    let creatureIdx = 0;
    for (const def of SEABED_SLOTS) {
      const cid = creatureIdx < oldCreatureIds.length ? oldCreatureIds[creatureIdx] : null;
      // Unlock enough slots for existing creatures, plus starter slots
      const needsUnlock = cid !== null || def.tier === 0;
      newPool.slots[def.id] = {
        ...def,
        creatureId: cid,
        unlocked: needsUnlock || def.unlocked,
      };
      if (cid !== null) creatureIdx++;
    }

    // Refund old upgrade nodes as plankton
    const oldNodes = data.upgradeNodes as unknown[] | undefined;
    if (oldNodes && oldNodes.length > 0) {
      const resources = data.resources as { plankton: number };
      resources.plankton += oldNodes.length * 200;
    }

    data.pool = newPool;
    data.upgradeAnchors = [];
    delete data.upgradeNodes;
    data.saveVersion = 3;
  }

  // V3 → V4: add seabedSeed for procedural decoration generation
  if ((data.saveVersion as number) < 4) {
    data.seabedSeed = Math.floor(Math.random() * 2_147_483_647);
    data.saveVersion = CURRENT_SAVE_VERSION;
  }

  return data as unknown as GameState;
}
