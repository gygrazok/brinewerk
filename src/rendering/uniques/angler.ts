import { type PixelGrid, setPixel } from '../pixel-grid';
import { bezier, disc, fillEllipse, line, outline } from './draw';

const BODY = '#3e2c52';
const BODY_LIGHT = '#5c4674';
const BELLY = '#7a6090';
const FIN = '#2a1c3a';
const MOUTH = '#5a1020';
const TOOTH = '#f4f0e0';
const STALK = '#6a5480';
const OUTLINE = '#120a1a';

/** Deep-sea anglerfish: round dark body, fanged jaw facing right, glowing lure on a stalk. */
export function renderAngler(time: number): PixelGrid {
  const grid: PixelGrid = {};
  const bob = Math.round(Math.sin(time * 1.2) * 1.5);
  const cx = 22, cy = 29 + bob;

  // Tail fin (left) and dorsal spines
  const flap = Math.sin(time * 3) * 2;
  for (let i = -5; i <= 5; i++) line(grid, cx - 12, cy, cx - 19, cy + i * 1.2 + flap * 0.4, FIN);
  for (let i = 0; i < 4; i++) line(grid, cx - 6 + i * 3, cy - 10, cx - 8 + i * 3, cy - 14, FIN);

  // Body
  fillEllipse(grid, cx, cy, 13, 11, BODY);
  fillEllipse(grid, cx - 2, cy - 4, 8, 5, BODY_LIGHT);
  fillEllipse(grid, cx, cy + 6, 9, 4, BELLY);

  // Jaw: open wedge on the right with teeth along both edges
  const gape = 3 + Math.round((Math.sin(time * 1.3) + 1) * 0.8);
  for (let x = cx + 5; x <= cx + 14; x++) {
    const open = (x - cx - 5) / 9 * gape;
    for (let y = cy + 1 - open; y <= cy + 2 + open; y++) setPixel(grid, x, y, MOUTH);
  }
  for (let x = cx + 7; x <= cx + 14; x += 2) {
    const open = (x - cx - 5) / 9 * gape;
    setPixel(grid, x, cy + 1 - open, TOOTH);
    setPixel(grid, x, cy + 2 + open, TOOTH);
    setPixel(grid, x + 1, cy + 2 - open * 0.4, TOOTH);
  }

  // Pectoral fin
  const fin = Math.sin(time * 4) * 1.5;
  line(grid, cx - 2, cy + 3, cx - 6, cy + 8 + fin, FIN);
  line(grid, cx - 1, cy + 3, cx - 4, cy + 9 + fin, FIN);

  // Eye
  disc(grid, cx + 5, cy - 4, 1.5, '#e8e8f0');
  setPixel(grid, cx + 6, cy - 4, '#000000');

  outline(grid, OUTLINE);

  // Lure stalk and bulb, drawn after the outline so the glow stays crisp
  const sway = Math.sin(time * 1.6) * 2;
  const p0: [number, number] = [cx + 1, cy - 11];
  const p1: [number, number] = [cx + 6, cy - 24];
  const p2: [number, number] = [cx + 15 + sway, cy - 17];
  for (let t = 0; t <= 1; t += 0.04) {
    const [x, y] = bezier(p0, p1, p2, t);
    setPixel(grid, x, y, STALK);
  }
  const pulse = (Math.sin(time * 3) + 1) / 2;
  const [bx, by] = p2;
  const halo = pulse > 0.5 ? '#80ffe0' : '#40a090';
  disc(grid, bx, by + 2, 3, halo);
  disc(grid, bx, by + 2, 2, pulse > 0.5 ? '#fffbd0' : '#f0e070');
  setPixel(grid, bx - 1, by + 1, '#ffffff');

  return grid;
}
