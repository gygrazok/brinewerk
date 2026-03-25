import type { Creature } from '../creatures/creature';
import { SEABED_SLOTS } from '../systems/seabed-layout';
import { DEFAULT_RARE_CHANCE, DEFAULT_UNLOCKED_RARE_IDS } from './balance';

const SAVE_KEY = 'brinewerk_save';
const CURRENT_SAVE_VERSION = 8;

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

export type ResourceBundle = { plankton: number; minerite: number; lux: number; nacre: number; coral: number };

export interface GameState {
  saveVersion: number;
  seabedSeed: number;
  creatures: Creature[];
  pool: SeabedPool;
  resources: ResourceBundle;
  shore: Creature[];
  lastSaveTimestamp: number;
  lastTideTimestamp: number;
  totalPlaytime: number; // seconds
  /** True once all tier-0 slots have been filled (unlocks creature release) */
  releaseUnlocked: boolean;
  /** Current chance of spawning any rare creature (upgradeable, default 1%) */
  rareChance: number;
  /** Set of rare effect IDs currently in the spawn pool */
  unlockedRares: string[];
  /** Whether the player already took a creature this tide (limits to 1 per tide) */
  shoreTaken: boolean;
}

export function createDefaultState(): GameState {
  const pool: SeabedPool = { slots: {}, worldWidth: 1920, worldHeight: 1080 };
  for (const def of SEABED_SLOTS) {
    pool.slots[def.id] = { ...def, creatureId: null };
  }

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    seabedSeed: (Date.now() * 2654435761) & 0x7fffffff,
    creatures: [],
    pool,
    resources: { plankton: 0, minerite: 0, lux: 0, nacre: 0, coral: 0 },
    shore: [],
    lastSaveTimestamp: Date.now(),
    lastTideTimestamp: Date.now(),
    totalPlaytime: 0,
    releaseUnlocked: false,
    rareChance: DEFAULT_RARE_CHANCE,
    unlockedRares: [...DEFAULT_UNLOCKED_RARE_IDS],
    shoreTaken: false,
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
    delete data.upgradeNodes;
    delete data.upgradeAnchors;
    data.saveVersion = 3;
  }

  // V3 → V4: add seabedSeed for procedural decoration generation
  if ((data.saveVersion as number) < 4) {
    data.seabedSeed = (Date.now() * 2654435761) & 0x7fffffff;
    data.saveVersion = 4;
  }

  // V4 → V5: add nacre resource, lifetimePlankton per creature, releaseUnlocked flag
  if ((data.saveVersion as number) < 5) {
    const resources = data.resources as Record<string, number>;
    if (resources.nacre === undefined) resources.nacre = 0;

    const creatures = data.creatures as { lifetimePlankton?: number }[];
    for (const c of creatures) {
      if (c.lifetimePlankton === undefined) c.lifetimePlankton = 0;
    }
    const shore = data.shore as { lifetimePlankton?: number }[];
    for (const c of shore) {
      if (c.lifetimePlankton === undefined) c.lifetimePlankton = 0;
    }

    if ((data as Record<string, unknown>).releaseUnlocked === undefined) {
      (data as Record<string, unknown>).releaseUnlocked = false;
    }

    data.saveVersion = 5;
  }

  // V5 → V6: add rareChance and unlockedRares for tiered rare system
  if ((data.saveVersion as number) < 6) {
    const d = data as Record<string, unknown>;
    if (d.rareChance === undefined) d.rareChance = DEFAULT_RARE_CHANCE;
    if (d.unlockedRares === undefined) d.unlockedRares = [...DEFAULT_UNLOCKED_RARE_IDS];
    data.saveVersion = 6;
  }

  // V6 → V7: add coral resource
  if ((data.saveVersion as number) < 7) {
    const resources = data.resources as Record<string, number>;
    if (resources.coral === undefined) resources.coral = 0;
    data.saveVersion = 7;
  }

  // V7 → V8: add shoreTaken flag for 1-per-tide pickup limit
  if ((data.saveVersion as number) < 8) {
    const d = data as Record<string, unknown>;
    if (d.shoreTaken === undefined) d.shoreTaken = false;
    data.saveVersion = CURRENT_SAVE_VERSION;
  }

  // Validate critical fields exist after migration
  const gs = data as Record<string, unknown>;
  if (
    typeof gs.saveVersion !== 'number' ||
    !Array.isArray(gs.creatures) ||
    typeof gs.pool !== 'object' || gs.pool === null ||
    typeof gs.resources !== 'object' || gs.resources === null
  ) {
    throw new Error('Corrupted save: missing required GameState fields');
  }
  return data as unknown as GameState;
}
