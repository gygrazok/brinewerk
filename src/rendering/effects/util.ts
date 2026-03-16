/** RGB → hex string */
export function rgbHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Simple deterministic hash, returns 0-1 */
export function effectHash(a: number, b: number): number {
  return ((Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1 + 1) % 1;
}
