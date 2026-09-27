import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { FEED_BASE_COST, FEED_COST_GROWTH } from '../core/balance';
import { upgradeEffect } from './upgrades';

export interface FeedQuote {
  /** Levels that will be gained. */
  levels: number;
  /** Total plankton cost. */
  cost: number;
}

/** Plankton cost to raise a creature from `level` to `level + 1`. */
export function feedCostAt(state: GameState, level: number): number {
  return FEED_BASE_COST * Math.pow(FEED_COST_GROWTH, level - 1) * upgradeEffect(state, 'rich_brine');
}

/**
 * Cost of buying `count` levels starting from the creature's current level.
 * With `count = 'max'`, buys as many levels as the player can afford (at least a quote for 1).
 */
export function quoteFeed(state: GameState, creature: Creature, count: number | 'max'): FeedQuote {
  const budget = state.resources.plankton;
  let levels = 0;
  let cost = 0;
  const limit = count === 'max' ? Infinity : count;
  while (levels < limit) {
    const next = feedCostAt(state, creature.level + levels);
    if (count === 'max' && cost + next > budget) break;
    cost += next;
    levels++;
  }
  if (levels === 0) return { levels: 1, cost: feedCostAt(state, creature.level) };
  return { levels, cost };
}

/** Feed a creature. Returns true when levels were bought. */
export function feedCreature(state: GameState, creature: Creature, count: number | 'max'): boolean {
  const quote = quoteFeed(state, creature, count);
  if (quote.cost > state.resources.plankton) return false;
  state.resources.plankton -= quote.cost;
  creature.level += quote.levels;
  return true;
}
