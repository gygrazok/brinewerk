import type { Genotype } from '../../creatures/creature';
import { getPalette } from '../palette';
import { type PixelGrid, setPixel, fillCircle, spatialRandom } from '../pixel-grid';

export function renderCorallid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const pal = getPalette(genes.palette1);
  const pal2 = getPalette(genes.palette2);
  const cx = 20, cy = 20;
  const size = 8 + Math.floor(genes.size * 10);
  const branches = 2 + Math.round(genes.branches * 3);
  const density = 0.3 + genes.density * 0.7;
  const pattern = Math.round(genes.pattern * 4);
  const wobble = genes.wobble * 3;

  // Base/trunk
  const baseW = Math.max(2, Math.round(size * 0.2));
  const baseH = Math.round(size * 0.3);
  const baseY = size * 0.5;

  for (let dy = 0; dy < baseH; dy++) {
    for (let dx = -baseW; dx <= baseW; dx++) {
      setPixel(
        grid, cx + dx, cy + baseY - dy,
        Math.abs(dx) >= baseW || dy === 0 ? pal.outline : pal.body,
      );
    }
  }

  // Branch drawing
  function drawBranch(sx: number, sy: number, angle: number, len: number, depth: number): void {
    const sway = Math.sin(time * 1.2 + depth * 3 + sx * 0.5) * wobble * 0.08;

    for (let t = 0; t < len; t++) {
      const bx = Math.round(sx + Math.cos(angle + sway) * t);
      const by = Math.round(sy + Math.sin(angle + sway) * t);
      const w = Math.max(1, Math.round((1 - t / len) * (depth === 0 ? 3 : 2) * density));

      for (let s = -w; s <= w; s++) {
        const ppx = bx + Math.round(-Math.sin(angle) * s);
        const ppy = by + Math.round(Math.cos(angle) * s);
        const edge = Math.abs(s) >= w || t === len - 1;
        let c = edge ? pal.outline : pal.body;
        if (!edge && pattern >= 1 && t % 3 === 0) c = pal.accent;
        if (!edge && pattern >= 2 && spatialRandom(bx, by, seed) > 0.7) c = pal2.body;
        setPixel(grid, ppx, ppy, c);
      }

      if (t === len - 1 && depth > 0) {
        fillCircle(grid, bx, by, 2, pattern >= 3 ? pal2.accent : pal.accent, pal.outline);
      }
    }
  }

  const topY = cy + baseY - baseH;
  for (let i = 0; i < branches; i++) {
    const angle = -Math.PI / 2 + (i - (branches - 1) / 2) * (1.2 / branches);
    const len = Math.round(size * (0.6 + spatialRandom(i, 1, seed) * 0.4));
    drawBranch(cx, topY, angle, len, 0);

    for (let j = 0; j < Math.round(density * 3); j++) {
      const t = Math.round(len * (0.4 + j * 0.2));
      drawBranch(
        Math.round(cx + Math.cos(angle) * t),
        Math.round(topY + Math.sin(angle) * t),
        angle + (j % 2 === 0 ? 0.5 : -0.5),
        Math.round(len * 0.4),
        1,
      );
    }
  }

  // Eyes on trunk
  const ec = Math.round(genes.eyes * 3);
  if (ec >= 1) {
    setPixel(grid, cx - 1, Math.round(cy + size * 0.35), '#ffffff');
    setPixel(grid, cx - 1, Math.round(cy + size * 0.35) - 1, pal.outline);
  }
  if (ec >= 2) {
    setPixel(grid, cx + 1, Math.round(cy + size * 0.35), '#ffffff');
    setPixel(grid, cx + 1, Math.round(cy + size * 0.35) - 1, pal.outline);
  }

  return grid;
}
