import type { SeabedPool, SeabedSlot } from '../core/game-state';
import { DEPTH_SHALLOW_MAX, DEPTH_TERRAIN_MARGIN, WORLD_WIDTH, WORLD_HEIGHT } from '../core/balance';

export type SlotDepth = 'shallow' | 'mid' | 'deep';

/**
 * Approximates Layer 1 terrain y at a given x, mirroring the profile used
 * by `seabed-bg.ts` (edge plateaus dip 0.55h at corners, 0.80h at center).
 * Used for gameplay classification — a slot counts as "deep" when it sits
 * on/below this line. Does not include per-playthrough wave noise.
 */
function approxTerrainY(x: number): number {
  const t = x / WORLD_WIDTH;
  let edge = 0;
  if (t < 0.3) edge = 1 - t / 0.3;
  else if (t > 0.7) edge = (t - 0.7) / 0.3;
  const smooth = edge * edge * (3 - 2 * edge);
  return (0.80 - smooth * 0.25) * WORLD_HEIGHT;
}

/** Classify a slot by its vertical position. Drives minerite (deep) / lux (shallow) production. */
export function getSlotDepth(slot: SeabedSlot): SlotDepth {
  if (slot.y <= DEPTH_SHALLOW_MAX) return 'shallow';
  if (slot.y >= approxTerrainY(slot.x) - DEPTH_TERRAIN_MARGIN) return 'deep';
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

/** Count of unlocked slots */
export function slotCount(pool: SeabedPool): number {
  return unlockedSlots(pool).length;
}

/** Get the next tier of unlockable slots (lowest tier among locked slots) */
export function getNextUnlockableSlots(pool: SeabedPool): SeabedSlot[] {
  const locked = lockedSlots(pool);
  if (locked.length === 0) return [];
  const minTier = Math.min(...locked.map(s => s.tier));
  return locked.filter(s => s.tier === minTier);
}

/** Get nearby unlocked slots within a given radius (Euclidean distance) */
export function getNearbySlots(pool: SeabedPool, slotId: string, radius: number): SeabedSlot[] {
  const source = pool.slots[slotId];
  if (!source) return [];
  const r2 = radius * radius;
  const result: SeabedSlot[] = [];
  for (const slot of Object.values(pool.slots)) {
    if (slot.id === slotId || !slot.unlocked) continue;
    const dx = slot.x - source.x;
    const dy = slot.y - source.y;
    if (dx * dx + dy * dy <= r2) result.push(slot);
  }
  return result;
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
