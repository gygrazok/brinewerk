import type { SeabedPool, SeabedSlot } from '../core/game-state';
import { DEPTH_SHALLOW_MAX, DEPTH_TERRAIN_MARGIN, WORLD_WIDTH, WORLD_HEIGHT } from '../core/balance';
import { baseLayer1TerrainY } from './terrain';

export type SlotDepth = 'shallow' | 'mid' | 'deep';

/** Classify a slot by its vertical position. Drives minerite (deep) / lux (shallow) production. */
export function getSlotDepth(slot: SeabedSlot): SlotDepth {
  if (slot.y <= DEPTH_SHALLOW_MAX) return 'shallow';
  if (slot.y >= baseLayer1TerrainY(slot.x, WORLD_WIDTH, WORLD_HEIGHT) - DEPTH_TERRAIN_MARGIN) return 'deep';
  return 'mid';
}

/** Get a slot by its ID */
export function getSlotById(pool: SeabedPool, id: string): SeabedSlot | undefined {
  return pool.slots[id];
}

/** All slots (unlocked and locked) */
export function allSlots(pool: SeabedPool): SeabedSlot[] {
  return Object.values(pool.slots);
}

/** Only unlocked slots */
export function unlockedSlots(pool: SeabedPool): SeabedSlot[] {
  return Object.values(pool.slots).filter(s => s.unlocked);
}

/** Only locked slots */
export function lockedSlots(pool: SeabedPool): SeabedSlot[] {
  return Object.values(pool.slots).filter(s => !s.unlocked);
}

/** Hit-test: find the nearest slot within hitRadius of world point (wx, wy).
 *  Searches all slots (locked + unlocked) so locked slots can be clicked to unlock. */
export function worldToSlot(pool: SeabedPool, wx: number, wy: number, hitRadius: number): SeabedSlot | null {
  const r2 = hitRadius * hitRadius;
  let best: SeabedSlot | null = null;
  let bestDist = Infinity;
  for (const slot of Object.values(pool.slots)) {
    const dx = slot.x - wx;
    const dy = slot.y - wy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestDist) {
      bestDist = d2;
      best = slot;
    }
  }
  return best;
}
