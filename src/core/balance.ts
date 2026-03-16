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

/** Blobid symbiosis */
export const BLOBID_SYMBIOSIS_BASE = 0.15; // +15% minimum
export const BLOBID_SYMBIOSIS_SCALE = 0.10; // +10% per tentacles gene

/** Initial game state */
export const INITIAL_PLANKTON = 50;

/** Upgrade: Algae Colony */
export const UPGRADE_ALGAE_COLONY_COST = 200;
export const UPGRADE_ALGAE_COLONY_BONUS = 0.25; // +25% production

/**
 * Slot unlock cost by tier (position-based).
 * Inner slots (tier 1) are cheap; outer slots (tier 4) require all 3 resources.
 * Tier 0 slots are free (starter, unlocked by default).
 */
export function getSlotUnlockCost(tier: number): import('./game-state').ResourceBundle {
  switch (tier) {
    case 0:  return { plankton: 0,    minerite: 0,   lux: 0 };
    case 1:  return { plankton: 100,  minerite: 0,   lux: 0 };
    case 2:  return { plankton: 400,  minerite: 40,  lux: 0 };
    case 3:  return { plankton: 1200, minerite: 150, lux: 20 };
    case 4:  return { plankton: 3500, minerite: 400, lux: 80 };
    default: return { plankton: 5000, minerite: 500, lux: 100 };
  }
}
