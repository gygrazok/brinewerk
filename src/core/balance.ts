/** Game balance constants */

/** Rare effect system */
export const DEFAULT_RARE_CHANCE = 0.03; // 3% base chance of any rare (raised by lure upgrades)

/** Shore mechanics */
export const SHORE_CREATURE_COUNT = 2;                     // creatures per tide
export const SHORE_REFRESH_COST = 100;                     // minimum plankton cost to refresh shore
/** Refresh cost also scales with income: this many seconds of passive plankton production. */
export const SHORE_REFRESH_RATE_SECONDS = 30;
/** Each refresh within the same tide multiplies the next refresh cost by this factor. */
export const SHORE_REFRESH_ESCALATION = 2;
export const SHORE_RARE_REFRESH_COST = 10;                 // coral cost for rare-guaranteed refresh

/** Tide timing (seconds) */
export const TIDE_INTERVAL_MIN = 180; // 3 min
export const TIDE_INTERVAL_MAX = 300; // 5 min

/**
 * Genetic production rate: TYPE_MUL * 2^(GENE_EXPONENT * (size - 0.5)) * 2^(GENE_EXPONENT * (primary - 0.5)).
 * An average creature (genes 0.5) yields TYPE_MUL; each gene at 1.0 multiplies it by 2^(GENE_EXPONENT/2).
 */
export const PROD_GENE_EXPONENT = 3;

/** Feeding: level L → L+1 costs FEED_BASE_COST * FEED_COST_GROWTH^(L-1) plankton. */
export const FEED_BASE_COST = 20;
export const FEED_COST_GROWTH = 1.22;
/** Reaching each of these levels doubles the creature's production. They are also the growth-stage level caps. */
export const LEVEL_MILESTONES: readonly number[] = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];

/** Growth stages: cap step once the milestone list is exhausted. */
export const STAGE_CAP_STEP_AFTER_LAST = 100;
/** Stage-up cost in species material: STAGE_COST_BASE * STAGE_COST_GROWTH^stage (2, 5, 13, 32, 79, ...). */
export const STAGE_COST_BASE = 2;
export const STAGE_COST_GROWTH = 2.5;
/** Species material from release: floor((1 + level / MATERIAL_LEVEL_DIVISOR) * rareMul). */
export const MATERIAL_LEVEL_DIVISOR = 10;
export const MATERIAL_RARE_TIER_MULTIPLIERS: Record<number, number> = { 1: 1.5, 2: 2, 3: 3 };

/** Initial game state */
export const INITIAL_PLANKTON = 50;

/** Nacre / creature release: nacre = (level / NACRE_LEVEL_DIVISOR)^2 * (1 + NACRE_DEVIATION_SCALE * deviation) * rareMul */
export const NACRE_LEVEL_DIVISOR = 10;
export const NACRE_DEVIATION_SCALE = 2;
export const NACRE_RARE_TIER_MULTIPLIERS: Record<number, number> = { 1: 1.5, 2: 2, 3: 3 };

/** Zoological registry: per-specimen production bonus by rare tier (0 = common), scaled by (1 + REGISTRY_DEVIATION_SCALE * deviation). */
export const REGISTRY_TIER_BONUS: Record<number, number> = { 0: 0.05, 1: 0.10, 2: 0.25, 3: 0.50 };
export const REGISTRY_DEVIATION_SCALE = 2;


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
/** Each plankton clump is also worth this many seconds of passive plankton production. */
export const COLLECTIBLE_PLANKTON_RATE_SECONDS = 2;
export const COLLECTIBLE_PLANKTON_JITTER = 3;          // random ± amount
export const COLLECTIBLE_MAX_ACTIVE = 15;              // max simultaneous clumps
export const COLLECTIBLE_SPRITE_SIZE = 10;             // pixel grid resolution
export const COLLECTIBLE_DISPLAY_SIZE = 48;            // on-screen world px
export const COLLECTIBLE_FADE_IN_DIST = 50;            // px from spawn edge to full alpha

/** Coral collectibles (click-to-collect, seabed-stationary) */
export const CORAL_SPAWN_INTERVAL = 300;                 // seconds between spawns (~5 min)
export const CORAL_SPAWN_JITTER = 60;                    // random ± jitter (so 4–6 min range)
export const CORAL_BASE_AMOUNT = 2;                      // base coral per pickup
export const CORAL_AMOUNT_JITTER = 1;                    // random ± (so 1–3 range)
export const CORAL_MAX_ACTIVE = 3;                       // max simultaneous coral on seabed
export const CORAL_SPRITE_SIZE = 14;                     // pixel grid resolution (slightly bigger than plankton)
export const CORAL_DISPLAY_SIZE = 56;                    // on-screen world px
export const CORAL_CLICK_RADIUS = 40;                    // click hit-test radius in world px

/** Depth classification. Shallow is a flat y threshold; deep is terrain-relative
 *  (a slot is deep when it sits on/near the seabed floor, which varies with x). */
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
export const DEPTH_SHALLOW_MAX = 350;
/** A slot counts as deep when its y is within this many world px of the seabed profile. */
export const DEPTH_TERRAIN_MARGIN = 30;

/** Passive minerite/s per deep slot, multiplied by the creature's trait deviation (0-1) and sqrt(level). */
export const MINERITE_BASE_RATE = 0.1;
/** Passive lux/s of any creature in a shallow slot, multiplied by sqrt(level). */
export const LUX_BASE_RATE = 0.01;
/** Bioluminescence: each level multiplies a creature's lux by (1 + BIOLUM_GLOW_BONUS * glow). */
export const BIOLUM_GLOW_BONUS = 2;

/**
 * Slot unlock cost by tier (position-based).
 * Cost is in Nacre only, growing exponentially: 2 * 3^(tier-1).
 * Tier 0 slots are free (starter, unlocked by default).
 */
export function getSlotUnlockCost(tier: number): import('./game-state').ResourceBundle {
  if (tier <= 0) return { plankton: 0, minerite: 0, lux: 0, nacre: 0, coral: 0 };
  const nacre = 2 * Math.pow(3, tier - 1); // 2, 6, 18, 54
  return { plankton: 0, minerite: 0, lux: 0, nacre, coral: 0 };
}
