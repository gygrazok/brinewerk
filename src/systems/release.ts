import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { NACRE_CONVERSION_RATE, NACRE_RARE_COMMON_MUL, NACRE_RARE_UNCOMMON_MUL, NACRE_RARE_RARE_MUL } from '../core/balance';
import { findCreatureSlot, removeCreature } from './pool';
import { getUpgradeLevel, getUpgradeEffect } from './upgrades';

/** Calculate nacre yield for releasing a creature */
export function calculateNacreYield(creature: Creature, state?: GameState): number {
  const baseNacre = creature.lifetimePlankton / NACRE_CONVERSION_RATE;

  let rareMul = 1;
  if (creature.rare) {
    const info = getRareInfo(creature.rare);
    if (info.tier === 1) rareMul = NACRE_RARE_COMMON_MUL;
    else if (info.tier === 2) rareMul = NACRE_RARE_UNCOMMON_MUL;
    else rareMul = NACRE_RARE_RARE_MUL; // tier 3
  }

  const nacreMul = state ? getUpgradeEffect('nacre_refinement', getUpgradeLevel(state, 'nacre_refinement')) : 1;
  return Math.floor(baseNacre * rareMul * nacreMul);
}

/** Release a creature from the pool. Returns nacre gained, or 0 if release failed. */
export function releaseCreature(state: GameState, creatureId: string): number {
  const slotId = findCreatureSlot(state, creatureId);
  if (!slotId) return 0;

  const creature = state.creatures.find(c => c.id === creatureId);
  if (!creature) return 0;

  const nacre = calculateNacreYield(creature, state);

  // Remove from slot
  removeCreature(state, slotId);
  // Remove from creatures array
  state.creatures = state.creatures.filter(c => c.id !== creatureId);

  state.resources.nacre += nacre;
  return nacre;
}