/** Phase 1 balance constants */

/** Tide timing (seconds) */
export const TIDE_INTERVAL_MIN = 180; // 3 min
export const TIDE_INTERVAL_MAX = 300; // 5 min

/** Base production: Stellarid ~1 plankton/s with average genes */
export const BASE_PRODUCTION_MULTIPLIER = 1.0;

/** Shore pickup costs */
export const PICKUP_BASE_COST = 30;
export const PICKUP_SIZE_SCALE = 20;
export const PICKUP_ARMS_SCALE = 10;
export const PICKUP_RARE_MULTIPLIER = 2.5;

/** Algae Colony */
export const ALGAE_COLONY_COST = 500;
export const ALGAE_COLONY_MULTIPLIER = 2.0; // 2x adjacent plankton output

/** Blobid symbiosis */
export const BLOBID_SYMBIOSIS_BASE = 0.15; // +15% minimum
export const BLOBID_SYMBIOSIS_SCALE = 0.10; // +10% per tentacles gene

/** Initial game state */
export const INITIAL_PLANKTON = 50;
