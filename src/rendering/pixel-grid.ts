import type { Palette } from './palette';
import type { Genotype } from '../creatures/creature';

export const GRID_SIZE = 50;
export const BLOCK_PX = 2;
export const CANVAS_PX = GRID_SIZE * BLOCK_PX;

export type PixelGrid = Record<string, string>;

export function setPixel(grid: PixelGrid, x: number, y: number, color: string): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
    grid[`${x},${y}`] = color;
  }
}

export function fillCircle(
  grid: PixelGrid,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  outline?: string,
): void {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        setPixel(grid, cx + dx, cy + dy, outline && d > r - 1.2 ? outline : fill);
      }
    }
  }
}

export function fillEllipse(
  grid: PixelGrid,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        setPixel(grid, cx + dx, cy + dy, color);
      }
    }
  }
}

export function addEyes(
  grid: PixelGrid,
  cx: number,
  cy: number,
  genes: Genotype,
  pal: Palette,
): void {
  const ec = Math.round(genes.eyes * 3);
  const big = genes.eyes >= 0.7; // high trait → 2×2 eyes
  const pos: [number, number][] = [];
  if (ec >= 1) pos.push([cx - 2, cy - 1]);
  if (ec >= 2) pos.push([cx + 2, cy - 1]);
  if (ec >= 3) pos.push([cx, cy + 1]);
  for (const [ex, ey] of pos) {
    if (big) {
      // 2×2 eye: 3 dark pixels + 1 white highlight (top-right)
      setPixel(grid, ex, ey, '#000000');
      setPixel(grid, ex + 1, ey, '#000000');
      setPixel(grid, ex, ey - 1, '#000000');
      setPixel(grid, ex + 1, ey - 1, '#ffffff');
    } else {
      setPixel(grid, ex, ey, '#ffffff');
      setPixel(grid, ex, ey - 1, pal.outline);
    }
  }
}

/** Render pixel grid onto a canvas context */
export function renderGridToCanvas(grid: PixelGrid, ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = grid[key];
    ctx.fillRect(x * BLOCK_PX, y * BLOCK_PX, BLOCK_PX, BLOCK_PX);
  }
}

/** Re-export for creature type renderers that need seeded noise per pixel */
export { spatialRandom } from '../util/prng';
