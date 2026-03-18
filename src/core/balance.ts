/** Phase 1 balance constants */

/** Tide timing (seconds) */
export const TIDE_INTERVAL_MIN = 180; // 3 min
export const TIDE_INTERVAL_MAX = 300; // 5 min

/** Production formula: base = TYPE_MUL * (SIZE_BASE + size * SIZE_SCALE) * (ARMS_BASE + arms * ARMS_SCALE) */
export const PROD_SIZE_BASE = 0.5;
export const PROD_SIZE_SCALE = 0.5;
export const PROD_ARMS_BASE = 0.8;
export const PROD_ARMS_SCALE = 0.4;

/** Shore pickup costs */
export const PICKUP_BASE_COST = 30;
export const PICKUP_SIZE_SCALE = 20;
export const PICKUP_ARMS_SCALE = 10;
export const PICKUP_RARE_MULTIPLIER = 2.5;

/** Initial game state */
export const INITIAL_PLANKTON = 50;

/** Nacre / creature release */
export const NACRE_CONVERSION_RATE = 100; // plankton produced per 1 nacre
export const NACRE_RARE_COMMON_MUL = 1.5; // rare chance >= 5%
export const NACRE_RARE_UNCOMMON_MUL = 2.0; // rare chance 4-5%
export const NACRE_RARE_RARE_MUL = 3.0; // rare chance < 4%


/** Floating collectibles */
export const COLLECTIBLE_SPAWN_INTERVAL = 3.0;       // seconds between spawns
export const COLLECTIBLE_SPAWN_JITTER = 1.5;          // random ± jitter on interval
export const COLLECTIBLE_DRIFT_SPEED = 30;             // px/sec base horizontal
export const COLLECTIBLE_DRIFT_SPEED_JITTER = 15;      // random ± speed variation
export const COLLECTIBLE_WOBBLE_AMP = 8;               // vertical sine amplitude (px)
export const COLLECTIBLE_WOBBLE_FREQ = 0.5;            // vertical wobble Hz
export const COLLECTIBLE_MAX_AGE = 30;                 // seconds before despawn
export const COLLECTIBLE_COLLECT_RADIUS = 60;          // base mouse proximity (px)
export const COLLECTIBLE_MAGNET_SPEED = 200;           // base magnetism speed (px/sec), accelerates over time
export const COLLECTIBLE_PLANKTON_BASE = 5;            // base plankton per clump
export const COLLECTIBLE_PLANKTON_JITTER = 3;          // random ± amount
export const COLLECTIBLE_MAX_ACTIVE = 15;              // max simultaneous clumps
export const COLLECTIBLE_SPRITE_SIZE = 10;             // pixel grid resolution
export const COLLECTIBLE_DISPLAY_SIZE = 48;            // on-screen world px
export const COLLECTIBLE_FADE_IN_DIST = 50;            // px from spawn edge to full alpha

/**
 * Slot unlock cost by tier (position-based).
 * Cost is in Nacre only, growing exponentially: 2^(tier-1).
 * Tier 0 slots are free (starter, unlocked by default).
 */
export function getSlotUnlockCost(tier: number): import('./game-state').ResourceBundle {
  if (tier <= 0) return { plankton: 0, minerite: 0, lux: 0, nacre: 0 };
  const nacre = Math.pow(2, tier - 1); // 1, 2, 4, 8, ...
  return { plankton: 0, minerite: 0, lux: 0, nacre };
}
