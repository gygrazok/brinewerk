import type { GameState } from '../core/game-state';
import {
  type Creature, type RareEffect,
  calculateTraitDeviation, getRareInfo, raresForType,
} from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { REGISTRY_TIER_BONUS, REGISTRY_DEVIATION_SCALE } from '../core/balance';
import { findCreatureSlot, removeCreature } from './pool';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One registry entry: a single slot per species × rare-effect combination. */
export interface RegistrySlotDef {
  key: string;
  type: CreatureType;
  rare: RareEffect | null;
  /** 0 = common (no rare effect), 1-3 = rare tier. */
  tier: number;
}

// ---------------------------------------------------------------------------
// Slot catalogue
// ---------------------------------------------------------------------------

export function registryKey(type: CreatureType, rare: RareEffect | null): string {
  return `${type}:${rare ?? 'common'}`;
}

/** Every registry slot, grouped by type (common first, then rares in tier order). */
export const REGISTRY_SLOTS: readonly RegistrySlotDef[] = Object.values(CreatureType).flatMap((type) => [
  { key: registryKey(type, null), type, rare: null, tier: 0 },
  ...raresForType(type)
    .slice()
    .sort((a, b) => a.tier - b.tier)
    .map((r) => ({ key: registryKey(type, r.id as RareEffect), type, rare: r.id as RareEffect, tier: r.tier })),
]);

export function registryKeyOf(creature: Pick<Creature, 'type' | 'rare'>): string {
  return registryKey(creature.type, creature.rare);
}

// ---------------------------------------------------------------------------
// Bonuses
// ---------------------------------------------------------------------------

/** Components of a specimen's bonus: tier base (fraction) and gene-quality multiplier. */
export function specimenBonusParts(creature: Creature): { tierBonus: number; qualityMul: number } {
  const tier = creature.rare ? getRareInfo(creature.rare).tier : 0;
  return {
    tierBonus: REGISTRY_TIER_BONUS[tier],
    qualityMul: 1 + REGISTRY_DEVIATION_SCALE * calculateTraitDeviation(creature),
  };
}

/** Production bonus (fraction, e.g. 0.12 = +12%) a specimen grants while registered. */
export function specimenBonus(creature: Creature): number {
  const { tierBonus, qualityMul } = specimenBonusParts(creature);
  return tierBonus * qualityMul;
}

/** One-line formula for tooltips: "Tier base +10% × gene quality ×1.42". */
export function specimenBonusFormula(creature: Creature): string {
  const { tierBonus, qualityMul } = specimenBonusParts(creature);
  return `Tier base +${Math.round(tierBonus * 100)}% × gene quality ×${qualityMul.toFixed(2)}`;
}

/** Global production multiplier from all registered specimens. */
export function getRegistryMultiplier(state: GameState): number {
  let bonus = 0;
  for (const specimen of Object.values(state.registry)) bonus += specimenBonus(specimen);
  return 1 + bonus;
}

export function getRegisteredCount(state: GameState): number {
  return Object.keys(state.registry).length;
}

/** Registered specimens of a given tier (0 = common, 1-3 = rare tier). */
export function getRegisteredCountOfTier(state: GameState, tier: number): number {
  let n = 0;
  for (const specimen of Object.values(state.registry)) {
    if ((specimen.rare ? getRareInfo(specimen.rare).tier : 0) === tier) n++;
  }
  return n;
}

/** Fraction of registry slots filled, 0-1. */
export function getCollectionCompletion(state: GameState): number {
  return getRegisteredCount(state) / REGISTRY_SLOTS.length;
}

// ---------------------------------------------------------------------------
// Sightings & registration
// ---------------------------------------------------------------------------

/** Mark a creature's combination as seen (revealed in the registry grid). */
export function recordSighting(state: GameState, creature: Pick<Creature, 'type' | 'rare'>): void {
  state.sightings[registryKeyOf(creature)] = true;
}

export function isSighted(state: GameState, key: string): boolean {
  return state.sightings[key] === true || key in state.registry;
}

/** Specimen currently occupying this creature's registry slot, if any. */
export function getRegisteredSpecimen(state: GameState, creature: Pick<Creature, 'type' | 'rare'>): Creature | null {
  return state.registry[registryKeyOf(creature)] ?? null;
}

/**
 * Store a creature in the registry, replacing any previous specimen of the same combination.
 * If the creature sits in the pool it is removed from its slot. Returns the replaced specimen.
 */
export function registerCreature(state: GameState, creature: Creature): Creature | null {
  const slotId = findCreatureSlot(state, creature.id);
  if (slotId) removeCreature(state, slotId);
  state.creatures = state.creatures.filter((c) => c.id !== creature.id);

  const key = registryKeyOf(creature);
  const previous = state.registry[key] ?? null;
  state.registry[key] = creature;
  state.sightings[key] = true;
  return previous;
}
