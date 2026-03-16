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

/** Pool expansion costs by slot count tier */
export function getExpansionCost(currentSlotCount: number): import('./game-state').ResourceBundle {
  if (currentSlotCount < 4) return { plankton: 50, minerite: 0, lux: 0 };
  if (currentSlotCount < 9) return { plankton: 150, minerite: 0, lux: 0 };
  if (currentSlotCount < 16) return { plankton: 500, minerite: 50, lux: 0 };
  if (currentSlotCount < 25) return { plankton: 2000, minerite: 200, lux: 0 };
  return { plankton: 5000, minerite: 500, lux: 50 };
}
