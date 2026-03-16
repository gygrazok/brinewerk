import { type PixelGrid, GRID_SIZE, setPixel } from '../pixel-grid';
import { rgbHex } from './util';

/**
 * Pixel-level fire strands rising from creature body (POC style).
 * Finds top pixels per column and generates animated strands going upward.
 */
export function applyFireEffect(grid: PixelGrid, time: number): void {
  // Find top pixel (minimum y) for each x column
  const topPixels = new Map<number, number>();
  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    const cur = topPixels.get(x);
    if (cur === undefined || y < cur) {
      topPixels.set(x, y);
    }
  }

  // Generate fire strands from each top pixel
  for (const [x, y] of topPixels) {
    // Variable strand height: 3-7 pixels, animated
    const fireH = 3 + Math.round(
      Math.sin(x * 2.3 + time * 5) * 2 +
      Math.cos(x * 1.7 + time * 3) * 2
    );

    for (let f = 1; f <= fireH; f++) {
      const flicker = Math.sin(time * 8 + x * 3 + f * 2) * 0.5 + 0.5;
      const ox = Math.round(Math.sin(time * 4 + f + x) * 1.5);
      const intensity = 1 - f / fireH;

      // Color: red base, green varies with intensity/flicker, dim blue
      const fr = 255;
      const fg = Math.round(60 + intensity * 180 * flicker);
      const fb = Math.round(intensity * 30);

      const px = x + ox;
      const py = y - f;
      const fk = `${px},${py}`;
      // Only place fire where no body pixel exists
      if (!grid[fk] && px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
        setPixel(grid, px, py, rgbHex(fr, fg, fb));
      }
    }
  }
}
