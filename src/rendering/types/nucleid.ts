import type { Genotype } from '../../creatures/creature';
import { getPalette } from '../palette';
import { type PixelGrid, setPixel, fillCircle, addEyes, spatialRandom } from '../pixel-grid';

export function renderNucleid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const pal = getPalette(genes.palette1);
  const pal2 = getPalette(genes.palette2);
  const cx = 20, cy = 20;
  const facets = 3 + Math.floor(genes.facets * 6);
  const rings = 1 + Math.floor(genes.rings * 3);
  const size = 8 + Math.floor(genes.size * 10);
  const pattern = Math.round(genes.pattern * 4);
  const spikes = Math.round(genes.spikes * 3);
  const wobble = genes.wobble * 3;

  for (let r = rings; r >= 0; r--) {
    const radius = Math.round((size * 0.6) * ((r + 1) / (rings + 1)));
    const isOuter = r === rings;
    const c1 = r % 2 === 0 ? pal.body : pal.accent;
    const c2 = r % 2 === 0 ? pal2.body : pal.body;
    const rot = time * 0.3 * (r % 2 === 0 ? 1 : -1) * wobble * 0.2;

    for (let dy = -radius - 2; dy <= radius + 2; dy++) {
      for (let dx = -radius - 2; dx <= radius + 2; dx++) {
        const ad = Math.sqrt(dx * dx + dy * dy);
        if (ad > radius + 1) continue;
        const a = Math.atan2(dy, dx) + rot;
        const sect = (2 * Math.PI) / facets;
        const rem = ((a % sect) + sect) % sect;
        const polyR = radius * Math.cos(Math.PI / facets) / Math.cos(rem - Math.PI / facets);

        if (ad <= Math.abs(polyR) + 0.5) {
          const edge = ad > Math.abs(polyR) - 1.2;
          let c = edge ? pal.outline : (pattern >= 2 && spatialRandom(dx, dy, seed) > 0.8 ? c2 : c1);
          if (!edge && pattern >= 1 && (Math.abs(dx) + Math.abs(dy)) % 4 === 0) c = pal.accent;
          setPixel(grid, cx + dx, cy + dy, c);
        }
      }
    }

    // Vertex dots + spikes
    for (let i = 0; i < facets; i++) {
      const a = (i / facets) * Math.PI * 2 + rot;
      setPixel(grid, cx + Math.round(Math.cos(a) * radius), cy + Math.round(Math.sin(a) * radius), pal.accent);

      if (spikes >= 1 && isOuter) {
        for (let s2 = 1; s2 <= spikes + 1; s2++) {
          setPixel(
            grid,
            cx + Math.round(Math.cos(a) * (radius + s2)),
            cy + Math.round(Math.sin(a) * (radius + s2)),
            s2 === spikes + 1 ? pal.outline : pal2.accent,
          );
        }
      }
    }

    // Radial lines between rings
    if (r < rings && pattern >= 3) {
      const outerR = Math.round((size * 0.6) * ((r + 2) / (rings + 1)));
      for (let i = 0; i < facets; i++) {
        const a = (i / facets) * Math.PI * 2 + rot;
        for (let t = radius; t < outerR; t += 2) {
          setPixel(grid, cx + Math.round(Math.cos(a) * t), cy + Math.round(Math.sin(a) * t), pal.outline);
        }
      }
    }
  }

  // Center
  fillCircle(grid, cx, cy, 2, pattern >= 4 ? pal2.accent : pal.accent, pal.outline);
  addEyes(grid, cx, cy, genes, pal);
  return grid;
}
