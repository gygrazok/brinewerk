import type { GameState } from '../core/game-state';
import { rareIdsForTiers, type SpawnContext } from '../creatures/creature';
import { DEFAULT_RARE_CHANCE } from '../core/balance';
import { getUpgradeLevel, upgradeEffect } from './upgrades';

/** Rare tiers the player can currently roll: tier 1 always, 2 and 3 via upgrades. */
export function getUnlockedRareTiers(state: GameState): Set<number> {
  const tiers = new Set([1]);
  if (getUpgradeLevel(state, 'strange_tides') > 0) tiers.add(2);
  if (getUpgradeLevel(state, 'abyssal_legends') > 0) tiers.add(3);
  return tiers;
}

/** Chance that a freshly spawned creature carries a rare effect. */
export function getRareChance(state: GameState): number {
  return DEFAULT_RARE_CHANCE + upgradeEffect(state, 'rare_lure') + upgradeEffect(state, 'glow_lure');
}

/** Rare-roll parameters for `spawnCreature`, derived from upgrades. */
export function getSpawnContext(state: GameState): SpawnContext {
  return {
    rareChance: getRareChance(state),
    unlockedRares: rareIdsForTiers(getUnlockedRareTiers(state)),
  };
}
