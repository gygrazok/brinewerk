import type { GameState } from '../core/game-state';
import { type Creature, getRareInfo } from '../creatures/creature';
import {
  LEVEL_MILESTONES, STAGE_COST_BASE, STAGE_COST_GROWTH, STAGE_CAP_STEP_AFTER_LAST,
  MATERIAL_LEVEL_DIVISOR, MATERIAL_RARE_TIER_MULTIPLIERS,
} from '../core/balance';
import { upgradeEffect } from './upgrades';

/**
 * Growth stages: a creature's level is capped by its stage. Caps coincide with the
 * production milestones (10, 25, 50, ...), then grow by a fixed step. Raising the stage
 * costs material of the creature's own species, obtained by releasing that species.
 */

/** Level cap of a given stage (stage 0 = cap 10). */
export function stageCap(stage: number): number {
  if (stage < LEVEL_MILESTONES.length) return LEVEL_MILESTONES[stage];
  const last = LEVEL_MILESTONES[LEVEL_MILESTONES.length - 1];
  return last + (stage - LEVEL_MILESTONES.length + 1) * STAGE_CAP_STEP_AFTER_LAST;
}

export function levelCap(creature: Creature): number {
  return stageCap(creature.stage);
}

export function isAtCap(creature: Creature): boolean {
  return creature.level >= levelCap(creature);
}

/** Species material needed to go from the creature's stage to the next. */
export function stageUpCost(creature: Creature): number {
  return Math.ceil(STAGE_COST_BASE * Math.pow(STAGE_COST_GROWTH, creature.stage));
}

export function canStageUp(state: GameState, creature: Creature): boolean {
  return isAtCap(creature) && state.materials[creature.type] >= stageUpCost(creature);
}

/** Spend species material to raise the level cap. Returns true on success. */
export function stageUp(state: GameState, creature: Creature): boolean {
  if (!canStageUp(state, creature)) return false;
  state.materials[creature.type] -= stageUpCost(creature);
  creature.stage++;
  return true;
}

/** Species material returned by releasing a creature: grows with level, scaled by rarity. */
export function materialYield(creature: Creature, state: GameState): number {
  const rareMul = creature.rare ? MATERIAL_RARE_TIER_MULTIPLIERS[getRareInfo(creature.rare).tier] : 1;
  const base = 1 + creature.level / MATERIAL_LEVEL_DIVISOR;
  return Math.floor(base * rareMul * upgradeEffect(state, 'tidal_salvage'));
}
