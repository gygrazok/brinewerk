import { type PixelGrid, setPixel } from '../pixel-grid';

/**
 * Pixel-level shadow/echo: draws a dark offset copy of the creature behind it,
 * creating a ghostly double that trails with a slight time-varying offset.
 */
export function applyShadowEffect(grid: PixelGrid, time: number): void {
  // Shadow offset oscillates: 3-6 pixels in each axis
  const ox = Math.round(Math.sin(time * 0.8) * 2 + 4);
  const oy = Math.round(Math.cos(time * 0.6) * 2 + 4);

  // Collect current body pixels first (avoid modifying during iteration)
  const bodyPixels: [number, number, string][] = [];
  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    bodyPixels.push([x, y, grid[key]]);
  }

  // Draw shadow underneath — only where no body pixel exists
  for (const [x, y, color] of bodyPixels) {
    const sx = x + ox, sy = y + oy;
    const sk = `${sx},${sy}`;
    if (!grid[sk]) {
      // Darken the original color: extract RGB, multiply by 0.3
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const dr = Math.round(r * 0.3);
      const dg = Math.round(g * 0.3);
      const db = Math.round(b * 0.3);
      const dark = '#' + ((1 << 24) | (dr << 16) | (dg << 8) | db).toString(16).slice(1);
      setPixel(grid, sx, sy, dark);
    }
  }
}
