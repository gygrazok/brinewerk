import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { calculateTraitDeviation, getRareInfo } from '../creatures/creature';
import {
  NACRE_LEVEL_DIVISOR, NACRE_DEVIATION_SCALE, NACRE_RARE_TIER_MULTIPLIERS,
} from '../core/balance';
import { findCreatureSlot, removeCreature } from './pool';
import { upgradeEffect } from './upgrades';

/** Nacre yield for releasing a creature: quadratic in level, scaled by trait quality and rarity. */
export function calculateNacreYield(creature: Creature, state: GameState): number {
  const levelPart = Math.pow(creature.level / NACRE_LEVEL_DIVISOR, 2);
  const qualityMul = 1 + NACRE_DEVIATION_SCALE * calculateTraitDeviation(creature);
  const rareMul = creature.rare ? NACRE_RARE_TIER_MULTIPLIERS[getRareInfo(creature.rare).tier] : 1;
  return Math.floor(levelPart * qualityMul * rareMul * upgradeEffect(state, 'nacre_refinement'));
}

/** Release a creature from the pool. Returns nacre gained, or 0 if release failed. */
export function releaseCreature(state: GameState, creatureId: string): number {
  const slotId = findCreatureSlot(state, creatureId);
  if (!slotId) return 0;

  const creature = state.creatures.find(c => c.id === creatureId);
  if (!creature) return 0;

  const nacre = calculateNacreYield(creature, state);

  removeCreature(state, slotId);
  state.creatures = state.creatures.filter(c => c.id !== creatureId);

  state.resources.nacre += nacre;
  return nacre;
}
