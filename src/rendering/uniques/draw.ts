import { type PixelGrid, setPixel, GRID_SIZE } from '../pixel-grid';

/** Drawing primitives for the hand-drawn unique creatures (50×50 grid, facing right). */

export function fillEllipse(grid: PixelGrid, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) setPixel(grid, cx + dx, cy + dy, color);
    }
  }
}

export function disc(grid: PixelGrid, cx: number, cy: number, r: number, color: string): void {
  fillEllipse(grid, cx, cy, r, r, color);
}

/** 1-px line (DDA, rounded). */
export function line(grid: PixelGrid, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    setPixel(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
  }
}

/** Line of discs with radius interpolated from r0 to r1. */
export function thickLine(
  grid: PixelGrid, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, color: string,
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(grid, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t, color);
  }
}

/** Point on a quadratic Bézier curve. */
export function bezier(
  p0: [number, number], p1: [number, number], p2: [number, number], t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

/** Draw a 1-px dark border around every filled pixel (4-neighbourhood). */
export function outline(grid: PixelGrid, color: string): void {
  const filled = new Set(Object.keys(grid));
  for (const key of filled) {
    const comma = key.indexOf(',');
    const x = +key.slice(0, comma);
    const y = +key.slice(comma + 1);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
      if (!filled.has(`${nx},${ny}`)) grid[`${nx},${ny}`] = color;
    }
  }
}

/** Scale a "#rrggbb" colour's channels by `f` (<1 darkens, >1 lightens, clamped). */
export function shade(hex: string, f: number): string {
  const v = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.min(255, Math.round(((v >> s) & 0xff) * f)).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
