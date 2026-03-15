import type { PoolSlot, SparsePool } from '../core/game-state';

export type CoordKey = `${number},${number}`;

export function toKey(r: number, c: number): CoordKey {
  return `${r},${c}`;
}

export function fromKey(key: CoordKey): [number, number] {
  const [r, c] = key.split(',').map(Number);
  return [r, c];
}

export function hasSlot(pool: SparsePool, r: number, c: number): boolean {
  return toKey(r, c) in pool.slots;
}

export function getSlot(pool: SparsePool, r: number, c: number): PoolSlot | undefined {
  return pool.slots[toKey(r, c)];
}

export function setSlot(pool: SparsePool, r: number, c: number, slot: PoolSlot): void {
  pool.slots[toKey(r, c)] = slot;
}

/** Iterate all slots as [row, col, slot] */
export function allSlots(pool: SparsePool): [number, number, PoolSlot][] {
  const result: [number, number, PoolSlot][] = [];
  for (const key of Object.keys(pool.slots) as CoordKey[]) {
    const [r, c] = fromKey(key);
    result.push([r, c, pool.slots[key]]);
  }
  return result;
}

export function getGridBounds(pool: SparsePool): { minR: number; maxR: number; minC: number; maxC: number } {
  const keys = Object.keys(pool.slots) as CoordKey[];
  if (keys.length === 0) return { minR: 0, maxR: 0, minC: 0, maxC: 0 };

  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of keys) {
    const [r, c] = fromKey(key);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC };
}

export function slotCount(pool: SparsePool): number {
  return Object.keys(pool.slots).length;
}

/** Get cells adjacent to existing slots that don't exist yet (expansion candidates) */
export function getExpansionCandidates(pool: SparsePool): [number, number][] {
  const candidates = new Set<CoordKey>();
  const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const key of Object.keys(pool.slots) as CoordKey[]) {
    const [r, c] = fromKey(key);
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      // Clamp to max 10x10 theoretical grid (-5..4 or similar, but we just check bounds dynamically)
      const nk = toKey(nr, nc);
      if (!(nk in pool.slots)) {
        // Check 10x10 limit
        const bounds = getGridBounds(pool);
        const newMinR = Math.min(bounds.minR, nr);
        const newMaxR = Math.max(bounds.maxR, nr);
        const newMinC = Math.min(bounds.minC, nc);
        const newMaxC = Math.max(bounds.maxC, nc);
        if (newMaxR - newMinR < 10 && newMaxC - newMinC < 10) {
          candidates.add(nk);
        }
      }
    }
  }

  return [...candidates].map(fromKey);
}

/** Get positions where 4 slots form a 2x2 block — upgrade node at top-left corner */
export function getUpgradeNodePositions(pool: SparsePool): [number, number][] {
  const positions: [number, number][] = [];
  const checked = new Set<CoordKey>();

  for (const key of Object.keys(pool.slots) as CoordKey[]) {
    const [r, c] = fromKey(key);

    // Check if this slot is the top-left of a 2x2
    const tlKey = toKey(r, c);
    if (!checked.has(tlKey)) {
      checked.add(tlKey);
      if (
        hasSlot(pool, r, c) &&
        hasSlot(pool, r, c + 1) &&
        hasSlot(pool, r + 1, c) &&
        hasSlot(pool, r + 1, c + 1)
      ) {
        positions.push([r, c]);
      }
    }

    // Also check if this slot is top-right, bottom-left, or bottom-right of a 2x2
    for (const [dr, dc] of [[-1, 0], [0, -1], [-1, -1]] as [number, number][]) {
      const tr = r + dr;
      const tc = c + dc;
      const k = toKey(tr, tc);
      if (!checked.has(k)) {
        checked.add(k);
        if (
          hasSlot(pool, tr, tc) &&
          hasSlot(pool, tr, tc + 1) &&
          hasSlot(pool, tr + 1, tc) &&
          hasSlot(pool, tr + 1, tc + 1)
        ) {
          positions.push([tr, tc]);
        }
      }
    }
  }

  return positions;
}
