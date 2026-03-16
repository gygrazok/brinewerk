import type { Genotype } from '../../creatures/creature';
import { getPalette } from '../palette';
import { type PixelGrid, setPixel, fillCircle, addEyes, spatialRandom } from '../pixel-grid';

export function renderCorallid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const pal = getPalette(genes.palette1);
  const pal2 = getPalette(genes.palette2);
  const cx = 20, cy = 20;
  const size = 10 + Math.floor(genes.size * 10);
  const branches = 2 + Math.round(genes.branches * 4);
  const density = 0.3 + genes.density * 0.7;
  const pattern = Math.round(genes.pattern * 4);
  const wobble = genes.wobble * 3;
  const spiky = genes.spikes > 0.5;

  // --- Base / trunk (wider, tapered) ---
  const baseW = Math.max(3, Math.round(size * 0.3));
  const baseH = Math.round(size * 0.35);
  const baseY = size * 0.45;

  for (let dy = 0; dy < baseH; dy++) {
    const taper = Math.round(baseW * (1 - dy / baseH * 0.3));
    for (let dx = -taper; dx <= taper; dx++) {
      const edge = Math.abs(dx) >= taper || dy === 0;
      let c = edge ? pal.outline : pal.body;
      if (!edge && pattern >= 3 && dy % 3 === 0) c = pal.accent;
      setPixel(grid, cx + dx, cy + baseY - dy, c);
    }
  }

  // Root tendrils at the bottom
  const rootCount = 2 + Math.round(genes.arms * 2);
  for (let i = 0; i < rootCount; i++) {
    const rx = cx + Math.round((i - (rootCount - 1) / 2) * (baseW * 0.8));
    const rAngle = Math.PI / 2 + (spatialRandom(i, 77, seed) - 0.5) * 0.6;
    const rLen = 2 + Math.round(spatialRandom(i, 88, seed) * 3);
    for (let t = 0; t < rLen; t++) {
      setPixel(
        grid,
        Math.round(rx + Math.cos(rAngle) * t),
        Math.round(cy + baseY + 1 + Math.sin(rAngle) * t),
        pal.outline,
      );
    }
  }

  // --- Branch drawing ---
  function drawBranch(sx: number, sy: number, angle: number, len: number, depth: number): void {
    const sway = Math.sin(time * 1.2 + depth * 3 + sx * 0.5) * wobble * 0.08;

    for (let t = 0; t < len; t++) {
      const bx = Math.round(sx + Math.cos(angle + sway) * t);
      const by = Math.round(sy + Math.sin(angle + sway) * t);
      const maxW = depth === 0 ? 3 : 2;
      const w = Math.max(1, Math.round((1 - t / len) * maxW * density));

      for (let s = -w; s <= w; s++) {
        const ppx = bx + Math.round(-Math.sin(angle) * s);
        const ppy = by + Math.round(Math.cos(angle) * s);
        const edge = Math.abs(s) >= w || t === len - 1;
        let c = edge ? pal.outline : pal.body;
        if (!edge && pattern >= 1 && t % 3 === 0) c = pal.accent;
        if (!edge && pattern >= 2 && spatialRandom(bx, by, seed) > 0.65) c = pal2.body;
        setPixel(grid, ppx, ppy, c);
      }

      // Tip decoration
      if (t === len - 1) {
        if (depth > 0) {
          const tipR = spiky ? 1 : 2;
          fillCircle(grid, bx, by, tipR, pattern >= 3 ? pal2.accent : pal.accent, pal.outline);
        } else if (spiky) {
          for (let sp = 1; sp <= 3; sp++) {
            setPixel(
              grid,
              Math.round(bx + Math.cos(angle) * sp),
              Math.round(by + Math.sin(angle) * sp),
              pal.accent,
            );
          }
        } else {
          fillCircle(grid, bx, by, 3, pal.accent, pal.outline);
          if (pattern >= 4) setPixel(grid, bx, by, pal2.accent);
        }
      }
    }
  }

  // --- Main branches from top of trunk ---
  const topY = cy + baseY - baseH;
  for (let i = 0; i < branches; i++) {
    const spread = 1.4 / branches;
    const angle = -Math.PI / 2 + (i - (branches - 1) / 2) * spread;
    const centerFactor = 1 - Math.abs(i - (branches - 1) / 2) / branches * 0.3;
    const len = Math.round(size * (0.7 + spatialRandom(i, 1, seed) * 0.5) * centerFactor);
    drawBranch(cx, topY, angle, len, 0);

    // Sub-branches along each main branch
    const subCount = Math.round(density * 3) + 1;
    for (let j = 0; j < subCount; j++) {
      const t = Math.round(len * (0.3 + j * 0.2));
      if (t >= len) break;
      const subAngle = angle + (j % 2 === 0 ? 0.6 : -0.6)
        + (spatialRandom(i * 10 + j, 2, seed) - 0.5) * 0.3;
      const subLen = Math.round(len * (0.35 + spatialRandom(i * 10 + j, 3, seed) * 0.25));
      drawBranch(
        Math.round(cx + Math.cos(angle) * t),
        Math.round(topY + Math.sin(angle) * t),
        subAngle,
        subLen,
        1,
      );
    }
  }

  // --- Eyes on trunk (uses shared addEyes for big-eye support) ---
  addEyes(grid, cx, Math.round(cy + size * 0.3), genes, pal);

  return grid;
}
