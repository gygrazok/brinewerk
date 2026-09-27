import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { LEVEL_MILESTONES, STAGE_CAP_STEP_AFTER_LAST, stageUpCostFor } from '../core/balance';
import { upgradeEffect, harvestUpgradeId } from './upgrades';

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
  return stageUpCostFor(creature.stage);
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

/**
 * Species material returned by releasing a creature: 1, plus the species' Harvest upgrade level.
 * Independent of the creature's level or rarity: investment is repaid in nacre, not material.
 */
export function materialYield(creature: Creature, state: GameState): number {
  return 1 + upgradeEffect(state, harvestUpgradeId(creature.type));
}
