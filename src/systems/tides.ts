import type { GameState } from '../core/game-state';
import { type Creature, spawnCreature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import {
  TIDE_INTERVAL_MIN, TIDE_INTERVAL_MAX,
  SHORE_REFRESH_COST, SHORE_RARE_REFRESH_COST,
} from '../core/balance';
import { allSlots } from './coords';
import { mulberry32 } from '../util/prng';
import { getUpgradeLevel, getUpgradeEffect } from './upgrades';

/** Creature types available from tides */
const TIDE_TYPES = [CreatureType.Stellarid, CreatureType.Blobid, CreatureType.Corallid, CreatureType.Nucleid, CreatureType.Craboid];

/** Generate shore creatures. If forceRareOnFirst is true, the first creature is guaranteed rare. */
function generateShoreCreatures(state: GameState, forceRareOnFirst = false): Creature[] {
  const rng = mulberry32(Date.now());
  const creatures: Creature[] = [];
  const shoreCount = getUpgradeEffect('bountiful_shore', getUpgradeLevel(state, 'bountiful_shore'));
  for (let i = 0; i < shoreCount; i++) {
    const type = TIDE_TYPES[Math.floor(rng() * TIDE_TYPES.length)];
    if (forceRareOnFirst && i === 0) {
      creatures.push(spawnCreature({ rareChance: 1.0, unlockedRares: state.unlockedRares }, { type }));
    } else {
      creatures.push(spawnCreature(state, { type }));
    }
  }
  return creatures;
}

/** Check if a new tide should arrive */
export function checkTide(state: GameState, now: number): boolean {
  const elapsed = (now - state.lastTideTimestamp) / 1000;
  const rng = mulberry32(state.lastTideTimestamp);
  const swiftMul = getUpgradeEffect('swift_tides', getUpgradeLevel(state, 'swift_tides'));
  const interval = (TIDE_INTERVAL_MIN + rng() * (TIDE_INTERVAL_MAX - TIDE_INTERVAL_MIN)) * swiftMul;

  if (elapsed < interval) return false;

  state.shore = generateShoreCreatures(state);
  state.lastTideTimestamp = now;
  state.shoreTaken = false;
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

/** Refresh shore with new random creatures (costs plankton) */
export function refreshShore(state: GameState): boolean {
  if (state.resources.plankton < SHORE_REFRESH_COST) return false;
  state.resources.plankton -= SHORE_REFRESH_COST;
  state.shore = generateShoreCreatures(state);
  state.shoreTaken = false;
  return true;
}

/** Refresh shore with guaranteed rare creature (costs coral) */
export function rareRefreshShore(state: GameState): boolean {
  if (state.resources.coral < SHORE_RARE_REFRESH_COST) return false;
  state.resources.coral -= SHORE_RARE_REFRESH_COST;
  state.shore = generateShoreCreatures(state, true);
  state.shoreTaken = false;
  return true;
}

/** Flush current shore and trigger a new tide immediately */
export function flushTide(state: GameState): void {
  state.shore = generateShoreCreatures(state);
  state.lastTideTimestamp = Date.now();
  state.shoreTaken = false;
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
    state.shore = TIDE_TYPES.map((type) => spawnCreature(state, { type }));
    state.lastTideTimestamp = Date.now();
    state.shoreTaken = false;
  }
}
