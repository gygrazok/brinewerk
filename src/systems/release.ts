import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { NACRE_CONVERSION_RATE, NACRE_RARE_COMMON_MUL, NACRE_RARE_UNCOMMON_MUL, NACRE_RARE_RARE_MUL } from '../core/balance';
import { findCreatureSlot, removeCreature } from './pool';
import { unlockedSlots } from './coords';

/** Calculate nacre yield for releasing a creature */
export function calculateNacreYield(creature: Creature): number {
  const baseNacre = creature.lifetimePlankton / NACRE_CONVERSION_RATE;

  let rareMul = 1;
  if (creature.rare) {
    const info = getRareInfo(creature.rare);
    if (info.tier === 1) rareMul = NACRE_RARE_COMMON_MUL;
    else if (info.tier === 2) rareMul = NACRE_RARE_UNCOMMON_MUL;
    else rareMul = NACRE_RARE_RARE_MUL; // tier 3
  }

  return Math.floor(baseNacre * rareMul);
}

/** Release a creature from the pool. Returns nacre gained, or 0 if release failed. */
export function releaseCreature(state: GameState, creatureId: string): number {
  const slotId = findCreatureSlot(state, creatureId);
  if (!slotId) return 0;

  const creature = state.creatures.find(c => c.id === creatureId);
  if (!creature) return 0;

  const nacre = calculateNacreYield(creature);

  // Remove from slot
  removeCreature(state, slotId);
  // Remove from creatures array
  state.creatures = state.creatures.filter(c => c.id !== creatureId);

  state.resources.nacre += nacre;
  return nacre;
}

/** Check if all tier-0 slots are filled (unlock condition for release) */
export function checkReleaseUnlock(state: GameState): boolean {
  if (state.releaseUnlocked) return false; // already unlocked

  const tier0Slots = unlockedSlots(state.pool).filter(s => s.tier === 0);
  const allFilled = tier0Slots.length > 0 && tier0Slots.every(s => s.creatureId !== null);

  if (allFilled) {
    state.releaseUnlocked = true;
    return true; // just unlocked
  }
  return false;
}
