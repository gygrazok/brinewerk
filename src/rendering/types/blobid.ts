import type { Genotype } from '../../creatures/creature';
import { getPalette } from '../palette';
import { type PixelGrid, setPixel, addEyes, _sr } from '../pixel-grid';

export function renderBlobid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const pal = getPalette(genes.palette1);
  const pal2 = getPalette(genes.palette2);
  const cx = 20, cy = 12;
  const size = 8 + Math.floor(genes.size * 10);
  const fatness = 0.3 + genes.fatness * 0.7;
  const bodyR = Math.round(size * 0.45 * fatness + 3);
  const hw = bodyR, hh = Math.round(bodyR * 1.3);
  const pattern = Math.round(genes.pattern * 4);
  const tentacles = 2 + Math.round(genes.tentacles * 6);
  const wobble = genes.wobble * 3;

  // Dome
  for (let dy = -hh - 1; dy <= 1; dy++) {
    for (let dx = -hw - 1; dx <= hw + 1; dx++) {
      const nx = dx / hw, ny = dy / hh;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d <= 1.0) {
        const o = d > 0.85;
        let c = o ? pal.outline : pal.body;
        if (!o && pattern >= 1 && Math.abs(dy) % 3 === 0) c = pal.accent;
        if (!o && pattern >= 2 && _sr(dx, dy, seed) > 0.8) c = pal2.body;
        if (!o && pattern >= 3 && dy < -hh * 0.5 && Math.abs(dx) < hw * 0.3) c = pal2.accent;
        setPixel(grid, cx + dx, cy + dy, c);
      }
    }
  }

  // Fringe
  for (let dx = -hw + 1; dx <= hw - 1; dx++) {
    setPixel(grid, cx + dx, cy + 1, pal.accent);
    setPixel(grid, cx + dx, cy + 2, pal.outline);
  }

  // Tentacles
  for (let i = 0; i < tentacles; i++) {
    const tx = cx + Math.round(-hw + 2 + (i / (tentacles - 1 || 1)) * (hw * 2 - 4));
    const tLen = Math.round(size * 0.8 + _sr(i, 0, seed) * size * 0.5);
    const sway = Math.sin(time * 1.8 + i * 2.1) * wobble * 1.2;

    for (let t = 0; t < tLen; t++) {
      const ox = Math.round(tx + Math.sin(t * 0.3 + time + i) * sway);
      const py = cy + 3 + t;
      setPixel(grid, ox, py, t % 3 === 0 ? pal.accent : t === tLen - 1 ? pal.outline : pal.body);
      if (t % 2 === 0) setPixel(grid, ox + 1, py, pal.outline);
    }
  }

  addEyes(grid, cx, cy - Math.round(hh * 0.3), genes, pal);
  return grid;
}
