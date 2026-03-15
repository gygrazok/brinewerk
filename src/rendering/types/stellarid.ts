import type { Genotype } from '../../creatures/creature';
import { getPalette } from '../palette';
import { type PixelGrid, setPixel, addEyes, _sr } from '../pixel-grid';

export function renderStellarid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const pal = getPalette(genes.palette1);
  const pal2 = getPalette(genes.palette2);
  const cx = 20, cy = 20;
  const armCount = 3 + Math.floor(genes.arms * 6);
  const size = 8 + Math.floor(genes.size * 10);
  const fatness = 0.3 + genes.fatness * 0.7;
  const bodyR = Math.round(size * 0.35 * fatness + 2);
  const spikes = Math.round(genes.spikes * 3);
  const pattern = Math.round(genes.pattern * 4);
  const wobble = genes.wobble * 3;

  // Arms
  for (let i = 0; i < armCount; i++) {
    const baseAngle = (i / armCount) * Math.PI * 2 - Math.PI / 2;
    const angle = baseAngle + Math.sin(time * 2 + i * 1.5) * wobble * 0.06;
    const armLen = size;
    const armW = Math.max(2, Math.round(size * 0.22 * fatness));

    for (let t = 0; t <= armLen; t++) {
      const taper = 1 - (t / armLen) * 0.7;
      const w = Math.max(1, Math.round(armW * taper));
      const ax = Math.cos(angle) * (bodyR - 1 + t);
      const ay = Math.sin(angle) * (bodyR - 1 + t);
      const px = -Math.sin(angle);
      const py = Math.cos(angle);

      for (let s = -w; s <= w; s++) {
        const edge = Math.abs(s) >= w || t === armLen;
        let c = edge ? pal.outline : pal.body;
        if (!edge && pattern >= 2 && t % 4 < 2) c = pal.accent;
        setPixel(grid, cx + Math.round(ax + px * s), cy + Math.round(ay + py * s), c);
      }

      if (spikes >= 1 && t % Math.max(3, 7 - spikes) === 0 && t > 2 && t < armLen - 1) {
        for (let s2 = 1; s2 <= Math.min(spikes + 1, 4); s2++) {
          const side = t % 2 === 0 ? 1 : -1;
          setPixel(
            grid,
            cx + Math.round(ax + px * (w + s2) * side),
            cy + Math.round(ay + py * (w + s2) * side),
            s2 === Math.min(spikes + 1, 4) ? pal.outline : pal2.accent,
          );
        }
      }
    }
  }

  // Body
  for (let dy = -bodyR - 1; dy <= bodyR + 1; dy++) {
    for (let dx = -bodyR - 1; dx <= bodyR + 1; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= bodyR) {
        const o = d > bodyR - 1.2;
        let c = o ? pal.outline : pal.body;
        if (!o && pattern >= 1 && (dx + dy) % 3 === 0) c = pal.accent;
        if (!o && pattern >= 2 && _sr(dx, dy, seed) > 0.75) c = pal2.body;
        if (!o && pattern >= 3 && Math.abs(dx) < 2) c = pal2.accent;
        setPixel(grid, cx + dx, cy + dy, c);
      }
    }
  }

  addEyes(grid, cx, cy, genes, pal);
  return grid;
}
