const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000; // 24h cap

export interface Clock {
  /** Seconds since last tick */
  delta: number;
  /** Total elapsed seconds since game start */
  elapsed: number;
  /** Real timestamp (ms) of last update */
  lastTimestamp: number;
}

export function createClock(): Clock {
  return { delta: 0, elapsed: 0, lastTimestamp: Date.now() };
}

/** Calculate offline elapsed time (capped at 24h), returns seconds */
export function calculateOfflineElapsed(lastSaveTimestamp: number): number {
  const now = Date.now();
  const raw = now - lastSaveTimestamp;
  return Math.min(Math.max(raw, 0), MAX_OFFLINE_MS) / 1000;
}

/** Update clock from PixiJS ticker delta (in seconds) */
export function tickClock(clock: Clock, deltaSec: number): void {
  clock.delta = deltaSec;
  clock.elapsed += deltaSec;
  clock.lastTimestamp = Date.now();
}
