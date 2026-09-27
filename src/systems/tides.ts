import type { GameState } from '../core/game-state';
import { type Creature, spawnCreature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import {
  TIDE_INTERVAL_MIN, TIDE_INTERVAL_MAX,
  SHORE_REFRESH_COST, SHORE_REFRESH_RATE_SECONDS, SHORE_REFRESH_ESCALATION,
  SHORE_RARE_REFRESH_COST,
} from '../core/balance';
import { allSlots } from './coords';
import { mulberry32 } from '../util/prng';
import { getUpgradeLevel, getUpgradeEffect } from './upgrades';
import { getSpawnContext, isPityDue, recordBatchRarity } from './rarity';
import { rollShoreUnique } from './uniques';
import { recordSighting } from './registry';
import { getProductionRates } from '../economy/production-engine';

/** Creature types available from tides */
const TIDE_TYPES = [CreatureType.Stellarid, CreatureType.Blobid, CreatureType.Corallid, CreatureType.Nucleid, CreatureType.Craboid];

/**
 * Generate a shore batch. One random creature is guaranteed rare when `forceRare` is set
 * or the hidden pity counter is due. Each creature also rolls for a unique.
 */
function generateShoreCreatures(state: GameState, forceRare = false): Creature[] {
  const rng = mulberry32(Date.now());
  const ctx = getSpawnContext(state);
  const creatures: Creature[] = [];
  const shoreCount = getUpgradeEffect('bountiful_shore', getUpgradeLevel(state, 'bountiful_shore'));
  const forcedIndex = forceRare || isPityDue(state) ? Math.floor(rng() * shoreCount) : -1;
  for (let i = 0; i < shoreCount; i++) {
    const type = TIDE_TYPES[Math.floor(rng() * TIDE_TYPES.length)];
    const rareChance = i === forcedIndex ? 1.0 : ctx.rareChance;
    creatures.push(spawnCreature({ ...ctx, rareChance }, { type }));
  }
  recordBatchRarity(state, creatures);
  rollShoreUnique(state, rng, creatures.length);
  for (const c of creatures) recordSighting(state, c);
  return creatures;
}

/** Replace the shore with a fresh batch and re-open the pickup. */
function setShore(state: GameState, creatures: Creature[]): void {
  state.shore = creatures;
  state.shoreTaken = false;
}

/** Check if a new tide should arrive */
export function checkTide(state: GameState, now: number): boolean {
  const elapsed = (now - state.lastTideTimestamp) / 1000;
  const rng = mulberry32(state.lastTideTimestamp);
  const swiftMul = getUpgradeEffect('swift_tides', getUpgradeLevel(state, 'swift_tides'));
  const interval = (TIDE_INTERVAL_MIN + rng() * (TIDE_INTERVAL_MAX - TIDE_INTERVAL_MIN)) * swiftMul;

  if (elapsed < interval) return false;

  setShore(state, generateShoreCreatures(state));
  state.lastTideTimestamp = now;
  state.shoreRefreshes = 0;
  return true;
}

/** Returns seconds remaining until next tide (approximate, uses interval midpoint) */
export function getTideTimeRemaining(state: GameState): number {
  const elapsed = (Date.now() - state.lastTideTimestamp) / 1000;
  const swiftMul = getUpgradeEffect('swift_tides', getUpgradeLevel(state, 'swift_tides'));
  const midInterval = ((TIDE_INTERVAL_MIN + TIDE_INTERVAL_MAX) / 2) * swiftMul;
  return Math.max(0, midInterval - elapsed);
}

/** Returns true if the tide interval has elapsed (tide is ready) */
export function isTideReady(state: GameState): boolean {
  const elapsed = (Date.now() - state.lastTideTimestamp) / 1000;
  const swiftMul = getUpgradeEffect('swift_tides', getUpgradeLevel(state, 'swift_tides'));
  return elapsed >= TIDE_INTERVAL_MIN * swiftMul;
}

/** Pick up a creature from shore (free, limited to 1 per tide) */
export function pickUpCreature(state: GameState, shoreIndex: number): Creature | null {
  if (state.shoreTaken) return null;
  if (shoreIndex < 0 || shoreIndex >= state.shore.length) return null;

  const creature = state.shore[shoreIndex];
  state.shore.splice(shoreIndex, 1);
  state.shoreTaken = true;
  return creature;
}

/**
 * Plankton cost of the next shore refresh: the larger of a flat floor and a slice
 * of passive income, doubled for every refresh already bought this tide.
 */
export function getRefreshCost(state: GameState): number {
  const base = Math.max(SHORE_REFRESH_COST, getProductionRates(state).plankton * SHORE_REFRESH_RATE_SECONDS);
  return Math.ceil(base * Math.pow(SHORE_REFRESH_ESCALATION, state.shoreRefreshes));
}

/** Refresh shore with new random creatures (costs plankton) */
export function refreshShore(state: GameState): boolean {
  const cost = getRefreshCost(state);
  if (state.resources.plankton < cost) return false;
  state.resources.plankton -= cost;
  state.shoreRefreshes++;
  setShore(state, generateShoreCreatures(state));
  return true;
}

/** Refresh shore with guaranteed rare creature (costs coral) */
export function rareRefreshShore(state: GameState): boolean {
  if (state.resources.coral < SHORE_RARE_REFRESH_COST) return false;
  state.resources.coral -= SHORE_RARE_REFRESH_COST;
  setShore(state, generateShoreCreatures(state, true));
  return true;
}

/** Flush current shore and trigger a new tide immediately */
export function flushTide(state: GameState): void {
  setShore(state, generateShoreCreatures(state));
  state.lastTideTimestamp = Date.now();
  state.shoreRefreshes = 0;
}

/** Force a tide immediately (debug / manual trigger) */
export function forceTide(state: GameState): void {
  flushTide(state);
}

/** Force a tide (for initial game start) */
export function forceInitialTide(state: GameState): void {
  const hasPoolCreatures = allSlots(state.pool).some(s => s.creatureId !== null);

  if (hasPoolCreatures) return; // already playing

  // New game — spawn one of each type so the player sees all phyla
  if (state.shore.length === 0) {
    const ctx = getSpawnContext(state);
    const creatures = TIDE_TYPES.map((type) => spawnCreature(ctx, { type }));
    for (const c of creatures) recordSighting(state, c);
    setShore(state, creatures);
    state.lastTideTimestamp = Date.now();
  }
}
