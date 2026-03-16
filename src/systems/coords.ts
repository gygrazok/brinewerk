import type { SeabedPool, SeabedSlot } from '../core/game-state';

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
