import type { Creature } from '../creatures/creature';
import type { UniqueId } from '../creatures/uniques';
import { CreatureType } from '../creatures/types';
import { SEABED_SLOTS } from '../systems/seabed-layout';

const SAVE_KEY = 'brinewerk_save';
const CURRENT_SAVE_VERSION = 16;

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

/** Species materials, one counter per creature type. */
export type MaterialBundle = Record<CreatureType, number>;

export function emptyMaterials(): MaterialBundle {
  const m = {} as MaterialBundle;
  for (const t of Object.values(CreatureType)) m[t] = 0;
  return m;
}

export interface GameState {
  saveVersion: number;
  seabedSeed: number;
  creatures: Creature[];
  pool: SeabedPool;
  resources: ResourceBundle;
  /** Species materials from release, spent on growth stages */
  materials: MaterialBundle;
  shore: Creature[];
  lastSaveTimestamp: number;
  lastTideTimestamp: number;
  totalPlaytime: number; // seconds
  /** Whether the player already took a creature this tide (limits to 1 per tide) */
  shoreTaken: boolean;
  /** Paid shore refreshes since the last natural tide (drives refresh cost escalation) */
  shoreRefreshes: number;
  /** Upgrade levels: upgradeId → current level (0 = not purchased) */
  upgrades: Record<string, number>;
  /** Completed achievements: achievementId → true */
  achievements: Record<string, boolean>;
  /** Zoological registry: one specimen per `type:rare` key (see systems/registry.ts) */
  registry: Record<string, Creature>;
  /** Registry keys the player has seen at least once (shore or pool) */
  sightings: Record<string, boolean>;
  /** Hidden pity: consecutive shore batches without a rare (see systems/rarity.ts) */
  rarePity: number;
  /** Unique creatures found: uniqueId → true */
  uniques: Record<string, boolean>;
  /** Unique waiting on the shore until collected (survives tides) */
  shoreUnique: UniqueId | null;
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
    materials: emptyMaterials(),
    shore: [],
    lastSaveTimestamp: Date.now(),
    lastTideTimestamp: Date.now(),
    totalPlaytime: 0,
    shoreTaken: false,
    shoreRefreshes: 0,
    upgrades: {},
    achievements: {},
    registry: {},
    sightings: {},
    rarePity: 0,
    uniques: {},
    shoreUnique: null,
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

  // V5 → V6: rareChance/unlockedRares fields (dropped again in v14, now derived from upgrades)
  if ((data.saveVersion as number) < 6) {
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
    data.saveVersion = 8;
  }

  // V8 → V9: add upgrades record for the upgrade system
  if ((data.saveVersion as number) < 9) {
    const d = data as Record<string, unknown>;
    if (d.upgrades === undefined) d.upgrades = {};
    data.saveVersion = 9;
  }

  // V9 → V10: add achievements record, migrate releaseUnlocked to achievement
  if ((data.saveVersion as number) < 10) {
    const d = data as Record<string, unknown>;
    if (d.achievements === undefined) d.achievements = {};
    if (d.releaseUnlocked === true) {
      (d.achievements as Record<string, boolean>)['tide_pool_keeper'] = true;
    }
    data.saveVersion = 10;
  }

  // V10 → V11: re-apply seabed layout (x/y/theme/tier) to each slot while
  // preserving unlocked state and creatureId. Needed when slot positions
  // change (e.g., classifying certain slots as "deep" by moving them onto the terrain).
  if ((data.saveVersion as number) < 11) {
    const pool = data.pool as SeabedPool | undefined;
    if (pool?.slots) {
      for (const def of SEABED_SLOTS) {
        const existing = pool.slots[def.id];
        if (existing) {
          existing.x = def.x;
          existing.y = def.y;
          existing.theme = def.theme;
          existing.tier = def.tier;
        } else {
          pool.slots[def.id] = { ...def, creatureId: null };
        }
      }
    }
    data.saveVersion = 11;
  }

  // V11 → V12: drop releaseUnlocked field — now derived from achievements.
  // V9→V10 already mirrored a true value into achievements.tide_pool_keeper.
  if ((data.saveVersion as number) < 12) {
    delete (data as Record<string, unknown>).releaseUnlocked;
    data.saveVersion = 12;
  }

  // V12 → V13: add legs/claws genes for craboid. Backfill on every existing
  // creature (pool + shore) with a bell-curve roll derived from the creature's
  // own seed so results are deterministic across reloads.
  if ((data.saveVersion as number) < 13) {
    const backfill = (cs: { seed?: number; genes?: Record<string, number> }[]): void => {
      for (const c of cs) {
        if (!c.genes) continue;
        const seed = (c.seed ?? 0) ^ 0x10b517;
        let s = seed >>> 0;
        const rand = (): number => {
          s = (s + 0x6D2B79F5) >>> 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const bell = (): number => Math.max(0, Math.min(1, (rand() + rand() + rand()) / 3));
        if (c.genes.legs === undefined) c.genes.legs = bell();
        if (c.genes.claws === undefined) c.genes.claws = bell();
      }
    };
    const creatures = (data.creatures as unknown as { seed?: number; genes?: Record<string, number> }[]) ?? [];
    const shore = (data.shore as unknown as { seed?: number; genes?: Record<string, number> }[]) ?? [];
    backfill(creatures);
    backfill(shore);
    data.saveVersion = 13;
  }

  // V13 → V14: incremental core. Creatures gain a feeding level (lifetimePlankton
  // dropped: nacre now derives from level); rare chance and unlocked rare tiers
  // are derived from upgrades; add registry, sightings and refresh escalation.
  if ((data.saveVersion as number) < 14) {
    const d = data as Record<string, unknown>;
    const toLevelled = (cs: Record<string, unknown>[]): void => {
      for (const c of cs) {
        if (c.level === undefined) c.level = 1;
        delete c.lifetimePlankton;
      }
    };
    toLevelled((d.creatures as Record<string, unknown>[]) ?? []);
    toLevelled((d.shore as Record<string, unknown>[]) ?? []);
    delete d.rareChance;
    delete d.unlockedRares;
    if (d.shoreRefreshes === undefined) d.shoreRefreshes = 0;
    if (d.registry === undefined) d.registry = {};
    if (d.sightings === undefined) {
      // Seed sightings with owned + shore creatures (key format: systems/registry.ts registryKey)
      const sightings: Record<string, boolean> = {};
      for (const c of [...((d.creatures as Record<string, unknown>[]) ?? []), ...((d.shore as Record<string, unknown>[]) ?? [])]) {
        sightings[`${c.type}:${c.rare ?? 'common'}`] = true;
      }
      d.sightings = sightings;
    }
    data.saveVersion = 14;
  }

  // V14 → V15: growth stages. Each creature gets the stage whose cap first reaches its
  // level (caps = 10, 25, 50, 75, 100, 150, ... as in balance LEVEL_MILESTONES), and the
  // save gains a species-material inventory.
  if ((data.saveVersion as number) < 15) {
    const d = data as Record<string, unknown>;
    const caps = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
    const stageFor = (level: number): number => {
      let s = 0;
      while ((caps[s] ?? 500 + (s - caps.length + 1) * 100) < level) s++;
      return s;
    };
    const registry = (d.registry as Record<string, Record<string, unknown>>) ?? {};
    for (const c of [
      ...((d.creatures as Record<string, unknown>[]) ?? []),
      ...((d.shore as Record<string, unknown>[]) ?? []),
      ...Object.values(registry),
    ]) {
      if (c.stage === undefined) c.stage = stageFor((c.level as number) ?? 1);
    }
    if (d.materials === undefined) d.materials = emptyMaterials();
    data.saveVersion = 15;
  }

  // V15 → V16: rare tiers unlock through the Collection. The Strange Tides / Abyssal
  // Legends purchases are refunded (15 nacre, 100 lux); add pity counter and uniques.
  if ((data.saveVersion as number) < 16) {
    const d = data as Record<string, unknown>;
    const upgrades = (d.upgrades as Record<string, number>) ?? {};
    const resources = d.resources as ResourceBundle;
    if (upgrades.strange_tides) resources.nacre += 15;
    if (upgrades.abyssal_legends) resources.lux += 100;
    delete upgrades.strange_tides;
    delete upgrades.abyssal_legends;
    if (d.rarePity === undefined) d.rarePity = 0;
    if (d.uniques === undefined) d.uniques = {};
    if (d.shoreUnique === undefined) d.shoreUnique = null;
    data.saveVersion = 16;
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
