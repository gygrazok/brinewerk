import { type PixelGrid, setPixel } from '../pixel-grid';
import { disc, fillEllipse, outline } from './draw';

const SHELL_LIGHT = '#f2e2c4';
const SHELL_STRIPE = '#b0582c';
const SUTURE = '#6a3418';
const APERTURE = '#3a1c10';
const HOOD = '#8a4a2a';
const HOOD_SPOT = '#d8a878';
const TENTACLE = '#e8b890';
const TENTACLE_DARK = '#c08060';
const OUTLINE = '#24120a';

/** Chambered nautilus: striped spiral shell on the left, hood and tentacles facing right. */
export function renderNautilus(time: number): PixelGrid {
  const grid: PixelGrid = {};
  const bob = Math.round(Math.sin(time * 1.5));
  const cx = 20, cy = 25 + bob, R = 15;

  // Shell: tiger stripes radiating from the umbilicus, fading toward the aperture
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > R) continue;
      const a = Math.atan2(dy, dx);
      const band = Math.floor((a + Math.PI) / (Math.PI * 2) * 16 + r * 0.18) % 2 === 0;
      const striped = band && dx < 6 && r > 4;
      setPixel(grid, cx + dx, cy + dy, striped ? SHELL_STRIPE : SHELL_LIGHT);
    }
  }

  // Spiral suture: r grows with angle, winding into the centre
  for (let th = 0; th < Math.PI * 4; th += 0.04) {
    const r = 1 + th * 1.05;
    if (r > R - 1) break;
    setPixel(grid, cx + Math.cos(th + Math.PI) * r, cy + Math.sin(th + Math.PI) * r, SUTURE);
  }

  // Aperture on the right side of the shell
  fillEllipse(grid, cx + 11, cy + 2, 5, 9, APERTURE);

  // Tentacles: rows of short waving strands
  for (let i = 0; i < 7; i++) {
    const sy = cy - 1 + i * 1.6;
    const len = 9 + ((i * 5) % 4) * 2;
    for (let t = 0; t < len; t++) {
      const wave = Math.sin(t * 0.5 - time * 3 + i * 1.3) * (t / len) * 2;
      setPixel(grid, cx + 14 + t, sy + wave + t * (i - 3) * 0.08, t % 3 === 0 ? TENTACLE_DARK : TENTACLE);
    }
  }

  // Hood over the tentacles, with spots
  fillEllipse(grid, cx + 14, cy - 6, 6, 4, HOOD);
  setPixel(grid, cx + 12, cy - 8, HOOD_SPOT);
  setPixel(grid, cx + 15, cy - 7, HOOD_SPOT);
  setPixel(grid, cx + 17, cy - 5, HOOD_SPOT);

  // Eye
  disc(grid, cx + 16, cy - 1, 1.2, '#000000');
  setPixel(grid, cx + 17, cy - 2, '#ffffff');

  outline(grid, OUTLINE);
  return grid;
}
