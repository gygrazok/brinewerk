import { type PixelGrid, setPixel } from '../pixel-grid';
import { disc, fillEllipse, line, thickLine, outline } from './draw';

const BODY = '#e0a840';
const STRIPE = '#a86a20';
const LEAF = '#7ab040';
const LEAF_LIGHT = '#c0e060';
const SNOUT = '#c88a30';
const OUTLINE = '#2a1a08';

/** Spine from head (top) to curled tail, with body radius per point. */
const SPINE: [number, number, number][] = [
  [30, 11, 3], [28, 16, 2.5], [25, 21, 3.5], [24, 26, 4.5], [25, 31, 4], [27, 35, 3],
  [28, 39, 2], [27, 43, 1.5], [24, 45, 1.2], [21, 43, 1], [22, 40, 1],
];
/** Spine indices carrying leafy appendages and their direction (-1 left, 1 right). */
const LEAVES: [number, number, number][] = [
  [1, -1, 6], [1, 1, 5], [2, -1, 8], [3, 1, 7], [3, -1, 9], [4, 1, 6], [5, -1, 7], [6, 1, 5], [7, -1, 5],
];

/** Leafy sea dragon: upright golden body, tube snout facing right, swaying leaf fronds. */
export function renderSeaDragon(time: number): PixelGrid {
  const grid: PixelGrid = {};
  const bob = Math.sin(time * 1.1) * 1.2;
  const pts = SPINE.map(([x, y, r], i): [number, number, number] => [x + Math.sin(time * 1.4 + i * 0.5) * 0.6, y + bob, r]);

  // Leaf fronds (behind body): a stem that forks into two lobes
  LEAVES.forEach(([idx, dir, len], i) => {
    const [x, y] = pts[idx];
    const sway = Math.sin(time * 2 + i * 1.7) * 1.5;
    const ex = x + dir * len, ey = y - 2 + sway;
    line(grid, x, y, ex, ey, LEAF);
    disc(grid, ex, ey - 1, 1.2, LEAF_LIGHT);
    disc(grid, ex - dir * 2, ey + 2, 1, LEAF);
  });

  // Body along the spine
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, r0] = pts[i];
    const [x1, y1, r1] = pts[i + 1];
    thickLine(grid, x0, y0, x1, y1, r0, r1, BODY);
  }
  // Bony ridges across the trunk
  for (let i = 2; i < 7; i++) {
    const [x, y, r] = pts[i];
    line(grid, x - r + 1, y, x + r - 1, y + 1, STRIPE);
  }

  // Head and tube snout
  const [hx, hy] = pts[0];
  fillEllipse(grid, hx, hy, 4, 3, BODY);
  thickLine(grid, hx + 3, hy + 1, hx + 13, hy + 2, 1.2, 0.8, SNOUT);
  setPixel(grid, hx + 14, hy + 2, SNOUT);
  line(grid, hx - 2, hy - 3, hx - 5, hy - 7, LEAF);
  disc(grid, hx - 5, hy - 8, 1, LEAF_LIGHT);
  setPixel(grid, hx + 1, hy - 1, '#000000');
  setPixel(grid, hx + 2, hy - 2, '#ffffff');

  outline(grid, OUTLINE);
  return grid;
}
