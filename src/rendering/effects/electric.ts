import { type PixelGrid, GRID_SIZE, setPixel } from '../pixel-grid';
import { rgbHex, effectHash } from './util';

/**
 * Pixel-level electric arcs crackling along the creature's outline.
 * Finds border pixels (adjacent to empty space) and spawns short-lived
 * spark chains that jump between nearby border points.
 */
export function applyElectricEffect(grid: PixelGrid, time: number): void {
  // Find border pixels (occupied pixels with at least one empty neighbor)
  const border: [number, number][] = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of dirs) {
      const nk = `${x + dx},${y + dy}`;
      if (!grid[nk] && x + dx >= 0 && x + dx < GRID_SIZE && y + dy >= 0 && y + dy < GRID_SIZE) {
        border.push([x, y]);
        break;
      }
    }
  }

  if (border.length < 4) return;

  // Generate 2-4 spark chains at different phases
  const sparkCount = 2 + Math.floor(effectHash(Math.floor(time * 3), 99) * 3);

  for (let s = 0; s < sparkCount; s++) {
    // Each spark has a brief lifespan — only visible for ~0.15s of each 0.5s cycle
    const phase = time * 2 + s * 1.7;
    const active = (phase % 1) < 0.3;
    if (!active) continue;

    // Pick a starting border pixel based on time + spark index
    const seed = Math.floor(time * 6 + s * 37);
    const startIdx = Math.floor(effectHash(seed, s * 13) * border.length);
    let [cx, cy] = border[startIdx];

    // Draw a chain of 3-6 pixels jumping to nearby border points
    const chainLen = 3 + Math.floor(effectHash(seed, s * 7) * 4);
    for (let i = 0; i < chainLen; i++) {
      // Spark color: white core, blue/cyan edges
      const brightness = 1 - i / chainLen * 0.4;
      const r = Math.round(180 * brightness + 75);
      const g = Math.round(220 * brightness + 35);
      const b = 255;

      // Place spark pixel just outside the body
      for (const [dx, dy] of dirs) {
        const sx = cx + dx, sy = cy + dy;
        if (!grid[`${sx},${sy}`] && sx >= 0 && sx < GRID_SIZE && sy >= 0 && sy < GRID_SIZE) {
          setPixel(grid, sx, sy, rgbHex(r, g, b));
          break;
        }
      }

      // Jump to a nearby border pixel
      const jump = Math.floor(effectHash(seed + i, s * 11 + i) * Math.min(border.length, 8));
      const nextIdx = (startIdx + jump + i * 3) % border.length;
      [cx, cy] = border[nextIdx];
    }
  }
}
