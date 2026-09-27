import type { GameState } from '../core/game-state';
import { type Creature, type RareEffect, type SpawnContext, rareIdsForTiers } from '../creatures/creature';
import { DEFAULT_RARE_CHANCE, RARE_TIER_UNLOCK, RARE_PITY_BATCHES, UNSEEN_RARE_WEIGHT } from '../core/balance';
import { upgradeEffect } from './upgrades';
import { getRegisteredCountOfTier, isSighted, registryKey } from './registry';

/** Highest rare tier that can be gated by the Collection. */
const MAX_RARE_TIER = 3;

/** Registered tier-(t-1) specimens toward unlocking tier t. */
export function getTierUnlockProgress(state: GameState, tier: number): { have: number; need: number } {
  return { have: getRegisteredCountOfTier(state, tier - 1), need: RARE_TIER_UNLOCK[tier] };
}

/**
 * Rare tiers the player can currently roll. Tier 1 always; each further tier opens once
 * enough specimens of the previous tier are in the Collection (RARE_TIER_UNLOCK).
 */
export function getUnlockedRareTiers(state: GameState): Set<number> {
  const tiers = new Set([1]);
  for (let tier = 2; tier <= MAX_RARE_TIER; tier++) {
    const { have, need } = getTierUnlockProgress(state, tier);
    if (have < need) break;
    tiers.add(tier);
  }
  return tiers;
}

/** Chance that a freshly spawned creature carries a rare effect. */
export function getRareChance(state: GameState): number {
  return DEFAULT_RARE_CHANCE + upgradeEffect(state, 'rare_lure') + upgradeEffect(state, 'glow_lure');
}

/** Rare-less shore batches after which the next batch is guaranteed a rare. */
export function getPityThreshold(state: GameState): number {
  return RARE_PITY_BATCHES - upgradeEffect(state, 'tide_omen');
}

/** True when the next shore batch must contain a rare (hidden pity counter reached). */
export function isPityDue(state: GameState): boolean {
  return state.rarePity + 1 >= getPityThreshold(state);
}

/** Update the hidden pity counter after a shore batch. */
export function recordBatchRarity(state: GameState, creatures: readonly Creature[]): void {
  state.rarePity = creatures.some((c) => c.rare) ? 0 : state.rarePity + 1;
}

/** Rare-roll parameters for `spawnCreature`, derived from upgrades and the Collection. */
export function getSpawnContext(state: GameState): SpawnContext {
  return {
    rareChance: getRareChance(state),
    unlockedRares: rareIdsForTiers(getUnlockedRareTiers(state)),
    // Never-sighted species × effect combinations are favoured, so the Collection fills steadily
    rareWeight: (type, rare) =>
      isSighted(state, registryKey(type, rare.id as RareEffect)) ? rare.weight : rare.weight * UNSEEN_RARE_WEIGHT,
  };
}
