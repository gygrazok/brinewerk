import type { ResourceBundle } from '../core/game-state';
import { SeededRng } from '../util/prng';
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

function spawnCollectible(mgr: CollectibleManager, worldW: number, worldH: number): Collectible {
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
): CollectedResources {
  const collected: CollectedResources = { plankton: 0, minerite: 0, lux: 0, nacre: 0, events: [] };
  const magnetSnapDist = 5;
  const hasValidMouse = !isNaN(mouseX) && !isNaN(mouseY);

  // --- Spawn ---
  mgr.spawnTimer += dt;
  if (mgr.spawnTimer >= mgr.nextSpawnAt && mgr.items.length < COLLECTIBLE_MAX_ACTIVE) {
    mgr.items.push(spawnCollectible(mgr, worldW, worldH));
    mgr.spawnTimer = 0;
    mgr.nextSpawnAt = COLLECTIBLE_SPAWN_INTERVAL + mgr.rng.float(-COLLECTIBLE_SPAWN_JITTER, COLLECTIBLE_SPAWN_JITTER);
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
      // Horizontal drift
      c.x += c.vx * dt;
      // Vertical wobble (sine wave around baseY)
      c.y = c.baseY + Math.sin(c.age * COLLECTIBLE_WOBBLE_FREQ * Math.PI * 2 + c.seed) * COLLECTIBLE_WOBBLE_AMP;

      // Check mouse proximity
      if (hasValidMouse) {
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

    // Remove if off-screen left or too old
    if (c.x < -40 || c.age > COLLECTIBLE_MAX_AGE) {
      mgr.items.splice(i, 1);
    }
  }

  return collected;
}

/** Destroy all collectibles (for HMR or context loss). */
export function clearCollectibles(mgr: CollectibleManager): void {
  mgr.items.length = 0;
  mgr.spawnTimer = 0;
}
