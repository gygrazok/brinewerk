const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/**
 * Compact number formatting for incremental-scale values.
 * < 1000 → plain (with `decimals` below 10), then K/M/B/... suffixes, then exponent notation.
 */
export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 1000) {
    return abs < 10 && decimals > 0 ? n.toFixed(decimals) : Math.floor(n).toString();
  }
  let tier = Math.floor(Math.log10(abs) / 3);
  let scaled = n / Math.pow(1000, tier);
  // 999.99K rounds to "1000K": promote to the next suffix instead
  if (Math.abs(scaled) >= 999.5) {
    tier++;
    scaled /= 1000;
  }
  if (tier >= SUFFIXES.length) return n.toExponential(2).replace('+', '');
  const digits = Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0;
  return scaled.toFixed(digits) + SUFFIXES[tier];
}

/** Format a multiplier as "×1.25" (or "×12.3K" at scale). */
export function formatMultiplier(m: number): string {
  return `×${m < 1000 ? m.toFixed(m < 10 ? 2 : 1) : formatNumber(m)}`;
}

/** Format a fractional bonus (0.25) as "+25%". */
export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  return `+${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}
