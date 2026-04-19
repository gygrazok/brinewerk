import type { ResourceBundle, SeabedPool } from '../core/game-state';
import { SeededRng } from '../util/prng';
import { baseLayer1TerrainY } from './terrain';
import {
  COLLECTIBLE_SPAWN_INTERVAL,
  COLLECTIBLE_SPAWN_JITTER,
  COLLECTIBLE_DRIFT_SPEED,
  COLLECTIBLE_DRIFT_SPEED_JITTER,
  COLLECTIBLE_WOBBLE_AMP,
  COLLECTIBLE_WOBBLE_FREQ,
  COLLECTIBLE_MAX_AGE,
  COLLECTIBLE_MAGNET_SPEED,
  COLLECTIBLE_PLANKTON_BASE,
  COLLECTIBLE_PLANKTON_JITTER,
  COLLECTIBLE_MAX_ACTIVE,
  CORAL_SPAWN_INTERVAL,
  CORAL_SPAWN_JITTER,
  CORAL_BASE_AMOUNT,
  CORAL_AMOUNT_JITTER,
  CORAL_MAX_ACTIVE,
  CORAL_CLICK_RADIUS,
} from '../core/balance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for a collectible resource type (extensible registry). */
export interface CollectibleTypeConfig {
  /** Which resource key this type awards */
  resource: keyof ResourceBundle;
  /** Base amount per clump */
  baseAmount: number;
  /** Random ± jitter on amount */
  amountJitter: number;
  /** Spawn weight relative to other types (higher = more frequent) */
  spawnWeight: number;
  /** How this collectible is gathered: 'magnet' = proximity auto-collect, 'click' = deliberate tap */
  collectMode: 'magnet' | 'click';
}

/** Runtime state of a single floating collectible. */
export interface Collectible {
  id: number;
  typeKey: string;
  config: CollectibleTypeConfig;
  x: number;
  y: number;
  /** Base Y position before wobble (used for sine offset) */
  baseY: number;
  vx: number;
  amount: number;
  age: number;
  /** Seed for sprite generation and wobble phase */
  seed: number;
  state: 'drifting' | 'magnetized' | 'collected';
  /** Time spent in magnetized state (for acceleration) */
  magnetTime: number;
}

/** Manager holding all active collectibles and spawn timing. */
export interface CollectibleManager {
  items: Collectible[];
  spawnTimer: number;
  nextSpawnAt: number;
  /** Separate spawn timer for coral (much longer interval) */
  coralSpawnTimer: number;
  coralNextSpawnAt: number;
  idCounter: number;
  rng: SeededRng;
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const COLLECTIBLE_TYPES: Record<string, CollectibleTypeConfig> = {
  plankton: {
    resource: 'plankton',
    baseAmount: COLLECTIBLE_PLANKTON_BASE,
    amountJitter: COLLECTIBLE_PLANKTON_JITTER,
    spawnWeight: 1,
    collectMode: 'magnet',
  },
  coral: {
    resource: 'coral',
    baseAmount: CORAL_BASE_AMOUNT,
    amountJitter: CORAL_AMOUNT_JITTER,
    spawnWeight: 0, // not in the drift-spawner pool — uses its own timer
    collectMode: 'click',
  },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCollectibleManager(seed: number): CollectibleManager {
  const rng = new SeededRng(seed);
  return {
    items: [],
    spawnTimer: 0,
    nextSpawnAt: COLLECTIBLE_SPAWN_INTERVAL + rng.float(-COLLECTIBLE_SPAWN_JITTER, COLLECTIBLE_SPAWN_JITTER),
    coralSpawnTimer: 0,
    // First coral spawns sooner (30-60s) so player sees one early
    coralNextSpawnAt: 30 + rng.float(0, 30),
    idCounter: 0,
    rng,
  };
}

// ---------------------------------------------------------------------------
// Weighted type selection
// ---------------------------------------------------------------------------

function pickType(rng: SeededRng): [string, CollectibleTypeConfig] {
  const entries = Object.entries(COLLECTIBLE_TYPES);
  const totalWeight = entries.reduce((s, [, c]) => s + c.spawnWeight, 0);
  let roll = rng.float(0, totalWeight);
  for (const [key, cfg] of entries) {
    roll -= cfg.spawnWeight;
    if (roll <= 0) return [key, cfg];
  }
  return entries[entries.length - 1];
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

function spawnDriftCollectible(mgr: CollectibleManager, worldW: number, worldH: number): Collectible {
  const [typeKey, config] = pickType(mgr.rng);
  const amount = Math.max(1, Math.round(config.baseAmount + mgr.rng.float(-config.amountJitter, config.amountJitter)));
  const margin = 80;
  const y = mgr.rng.float(margin, worldH - margin);
  const speed = COLLECTIBLE_DRIFT_SPEED + mgr.rng.float(-COLLECTIBLE_DRIFT_SPEED_JITTER, COLLECTIBLE_DRIFT_SPEED_JITTER);

  return {
    id: mgr.idCounter++,
    typeKey,
    config,
    x: worldW + 20, // spawn just off-screen right
    y,
    baseY: y,
    vx: -speed, // drift left
    amount,
    age: 0,
    seed: mgr.rng.int(0, 2_147_483_647),
    state: 'drifting',
    magnetTime: 0,
  };
}

/** Check if a position is too close to any slot (within exclusion radius). */
function overlapsSlot(x: number, y: number, pool: SeabedPool): boolean {
  const SLOT_EXCLUSION = 70; // slightly less than slot visual size (80px)
  for (const slot of Object.values(pool.slots)) {
    const dx = x - slot.x;
    const dy = y - slot.y;
    if (dx * dx + dy * dy < SLOT_EXCLUSION * SLOT_EXCLUSION) return true;
  }
  return false;
}

/** Spawn a stationary coral collectible on the seabed terrain. */
function spawnCoralCollectible(mgr: CollectibleManager, worldW: number, worldH: number, pool?: SeabedPool): Collectible {
  const config = COLLECTIBLE_TYPES.coral;
  const amount = Math.max(1, Math.round(config.baseAmount + mgr.rng.float(-config.amountJitter, config.amountJitter)));

  // Try up to 10 positions to find one that doesn't overlap a slot
  const margin = 100;
  let x = 0;
  let y = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    x = mgr.rng.float(margin, worldW - margin);
    const terrainTop = Math.floor(baseLayer1TerrainY(x, worldW, worldH));
    // Spawn anywhere from terrain surface down to near bottom
    y = mgr.rng.float(terrainTop + 10, worldH - 15);
    if (!pool || !overlapsSlot(x, y, pool)) break;
  }

  return {
    id: mgr.idCounter++,
    typeKey: 'coral',
    config,
    x,
    y,
    baseY: y,
    vx: 0, // stationary
    amount,
    age: 0,
    seed: mgr.rng.int(0, 2_147_483_647),
    state: 'drifting', // 'drifting' but vx=0, just sitting there
    magnetTime: 0,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** A single collection event with position (for floating popups). */
export interface CollectionEvent {
  x: number;
  y: number;
  resource: keyof import('../core/game-state').ResourceBundle;
  amount: number;
}

/** Collected resource totals returned per frame. */
export interface CollectedResources {
  plankton: number;
  minerite: number;
  lux: number;
  nacre: number;
  coral: number;
  /** Individual collection events this frame (for visual feedback) */
  events: CollectionEvent[];
}

/**
 * Advance the collectible system by `dt` seconds.
 * Returns the total resources collected this frame.
 *
 * @param mouseX  Mouse X in world space (NaN if mouse is outside canvas)
 * @param mouseY  Mouse Y in world space
 * @param collectRadius  Collection proximity in world px
 */
export function updateCollectibles(
  mgr: CollectibleManager,
  dt: number,
  worldW: number,
  worldH: number,
  mouseX: number,
  mouseY: number,
  collectRadius: number,
  pool?: SeabedPool,
  coralSpawnMul?: number,
): CollectedResources {
  const collected: CollectedResources = { plankton: 0, minerite: 0, lux: 0, nacre: 0, coral: 0, events: [] };
  const magnetSnapDist = 5;
  const hasValidMouse = !isNaN(mouseX) && !isNaN(mouseY);

  // --- Spawn drifting collectibles (plankton etc.) ---
  mgr.spawnTimer += dt;
  if (mgr.spawnTimer >= mgr.nextSpawnAt && mgr.items.length < COLLECTIBLE_MAX_ACTIVE) {
    mgr.items.push(spawnDriftCollectible(mgr, worldW, worldH));
    mgr.spawnTimer = 0;
    mgr.nextSpawnAt = COLLECTIBLE_SPAWN_INTERVAL + mgr.rng.float(-COLLECTIBLE_SPAWN_JITTER, COLLECTIBLE_SPAWN_JITTER);
  }

  // --- Spawn coral collectibles (separate timer) ---
  mgr.coralSpawnTimer += dt;
  const coralCount = mgr.items.filter(c => c.typeKey === 'coral').length;
  if (mgr.coralSpawnTimer >= mgr.coralNextSpawnAt && coralCount < CORAL_MAX_ACTIVE) {
    mgr.items.push(spawnCoralCollectible(mgr, worldW, worldH, pool));
    mgr.coralSpawnTimer = 0;
    mgr.coralNextSpawnAt = (CORAL_SPAWN_INTERVAL + mgr.rng.float(-CORAL_SPAWN_JITTER, CORAL_SPAWN_JITTER)) * (coralSpawnMul ?? 1);
  }

  // --- Update each collectible ---
  for (let i = mgr.items.length - 1; i >= 0; i--) {
    const c = mgr.items[i];
    c.age += dt;

    if (c.state === 'collected') {
      // Already collected — remove
      mgr.items.splice(i, 1);
      continue;
    }

    if (c.state === 'drifting') {
      // Horizontal drift + vertical wobble (magnet-mode only; click-mode stays stationary)
      c.x += c.vx * dt;
      if (c.config.collectMode === 'magnet') {
        c.y = c.baseY + Math.sin(c.age * COLLECTIBLE_WOBBLE_FREQ * Math.PI * 2 + c.seed) * COLLECTIBLE_WOBBLE_AMP;
      }

      // Check mouse proximity (magnet-mode collectibles only)
      if (c.config.collectMode === 'magnet' && hasValidMouse) {
        const dx = c.x - mouseX;
        const dy = c.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < collectRadius) {
          c.state = 'magnetized';
        }
      }
    }

    if (c.state === 'magnetized') {
      if (!hasValidMouse) {
        // Mouse left the canvas — revert to drifting
        c.state = 'drifting';
        c.baseY = c.y;
        c.magnetTime = 0;
      } else {
        c.magnetTime += dt;
        const dx = mouseX - c.x;
        const dy = mouseY - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < magnetSnapDist) {
          // Collected!
          c.state = 'collected';
          collected[c.config.resource] += c.amount;
          collected.events.push({ x: c.x, y: c.y, resource: c.config.resource, amount: c.amount });
        } else {
          // Accelerating magnetism: starts gentle, ramps up exponentially
          const accel = 1 + c.magnetTime * 4; // 1x at start → 5x after 1s
          const speed = COLLECTIBLE_MAGNET_SPEED * accel * dt;
          c.x += (dx / dist) * Math.min(speed, dist);
          c.y += (dy / dist) * Math.min(speed, dist);
        }
      }
    }

    // Remove if off-screen left or too old (click-mode collectibles don't expire)
    if (c.x < -40 || (c.config.collectMode === 'magnet' && c.age > COLLECTIBLE_MAX_AGE)) {
      mgr.items.splice(i, 1);
    }
  }

  return collected;
}

/** Force-spawn a coral collectible (debug). */
export function forceSpawnCoral(mgr: CollectibleManager, worldW: number, worldH: number, pool?: SeabedPool): void {
  mgr.items.push(spawnCoralCollectible(mgr, worldW, worldH, pool));
}

/**
 * Try to collect a click-mode collectible at the given world position.
 * Returns the collection event if something was collected, null otherwise.
 */
export function clickCollect(mgr: CollectibleManager, worldX: number, worldY: number): CollectionEvent | null {
  for (const c of mgr.items) {
    if (c.config.collectMode !== 'click' || c.state === 'collected') continue;
    const dx = c.x - worldX;
    const dy = c.y - worldY;
    if (dx * dx + dy * dy < CORAL_CLICK_RADIUS * CORAL_CLICK_RADIUS) {
      c.state = 'collected';
      return { x: c.x, y: c.y, resource: c.config.resource, amount: c.amount };
    }
  }
  return null;
}

/** Destroy all collectibles (for HMR or context loss). */
export function clearCollectibles(mgr: CollectibleManager): void {
  mgr.items.length = 0;
  mgr.spawnTimer = 0;
}
