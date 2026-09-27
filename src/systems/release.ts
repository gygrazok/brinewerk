import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { calculateTraitDeviation, getRareInfo } from '../creatures/creature';
import {
  NACRE_LEVEL_DIVISOR, NACRE_DEVIATION_SCALE, NACRE_RARE_TIER_MULTIPLIERS,
} from '../core/balance';
import { findCreatureSlot, removeCreature } from './pool';
import { upgradeEffect } from './upgrades';
import { materialYield } from './growth';

/** Nacre yield for releasing a creature: quadratic in level, scaled by trait quality and rarity. */
export function calculateNacreYield(creature: Creature, state: GameState): number {
  const levelPart = Math.pow(creature.level / NACRE_LEVEL_DIVISOR, 2);
  const qualityMul = 1 + NACRE_DEVIATION_SCALE * calculateTraitDeviation(creature);
  const rareMul = creature.rare ? NACRE_RARE_TIER_MULTIPLIERS[getRareInfo(creature.rare).tier] : 1;
  return Math.floor(levelPart * qualityMul * rareMul * upgradeEffect(state, 'nacre_refinement'));
}

/** Credit nacre and species material for a released creature (pool or shore). */
export function grantReleaseRewards(state: GameState, creature: Creature): void {
  state.resources.nacre += calculateNacreYield(creature, state);
  state.materials[creature.type] += materialYield(creature, state);
}

/** Release a creature from the pool. Returns true on success. */
export function releaseCreature(state: GameState, creatureId: string): boolean {
  const slotId = findCreatureSlot(state, creatureId);
  if (!slotId) return false;

  const creature = state.creatures.find(c => c.id === creatureId);
  if (!creature) return false;

  grantReleaseRewards(state, creature);
  removeCreature(state, slotId);
  state.creatures = state.creatures.filter(c => c.id !== creatureId);
  return true;
}
