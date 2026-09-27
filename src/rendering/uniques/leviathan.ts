import { type PixelGrid, setPixel } from '../pixel-grid';
import { fillEllipse, line, outline } from './draw';

const BACK = '#1d5566';
const BODY = '#2a8a9a';
const BELLY = '#9fe0d0';
const FIN = '#e05a3a';
const FIN_TIP = '#ffa060';
const EYE = '#ffe040';
const OUTLINE = '#0a2228';

/** Sea serpent: long undulating body with a red dorsal crest, horned head facing right. */
export function renderLeviathan(time: number): PixelGrid {
  const grid: PixelGrid = {};
  const spine = (x: number): number => 27 + Math.sin(x * 0.2 - time * 2.2) * 5 * Math.min(1, (44 - x) / 12);
  const tailX = 3, neckX = 38;

  // Dorsal crest (behind the body)
  for (let x = tailX + 5; x < neckX; x += 3) {
    const h = 1 + (x - tailX) / (neckX - tailX) * 3.5;
    const top = spine(x) - h;
    const len = 3 + Math.round(Math.sin(x * 0.7) + 1);
    const lean = Math.sin(time * 2 + x * 0.3) * 0.6;
    for (let i = 1; i <= len; i++) setPixel(grid, x - i * 0.4 + lean * i * 0.3, top - i, i === len ? FIN_TIP : FIN);
  }

  // Body: thickens from tail to neck, dark back, light belly
  for (let x = tailX; x <= neckX; x++) {
    const h = 1 + (x - tailX) / (neckX - tailX) * 3.5;
    const y = spine(x);
    for (let dy = -Math.round(h); dy <= Math.round(h); dy++) {
      const c = dy < -h * 0.35 ? BACK : dy > h * 0.35 ? BELLY : BODY;
      setPixel(grid, x, y + dy, c);
    }
  }

  // Tail fluke
  const ty = spine(tailX);
  line(grid, tailX, ty, tailX - 3, ty - 4, FIN);
  line(grid, tailX, ty, tailX - 3, ty + 4, FIN);
  line(grid, tailX + 1, ty, tailX - 2, ty - 3, FIN);
  line(grid, tailX + 1, ty, tailX - 2, ty + 3, FIN);

  // Head
  const hy = spine(neckX);
  fillEllipse(grid, neckX + 4, hy - 1, 6, 4.5, BODY);
  fillEllipse(grid, neckX + 4, hy - 3, 5, 2, BACK);
  fillEllipse(grid, neckX + 6, hy + 2, 4, 1.5, BELLY);
  // Horns sweeping back
  line(grid, neckX + 2, hy - 5, neckX - 3, hy - 10, FIN);
  line(grid, neckX + 4, hy - 5, neckX + 1, hy - 11, FIN);
  setPixel(grid, neckX - 3, hy - 10, FIN_TIP);
  setPixel(grid, neckX + 1, hy - 11, FIN_TIP);
  // Mouth line with teeth
  line(grid, neckX + 5, hy + 1, neckX + 10, hy + 1, OUTLINE);
  setPixel(grid, neckX + 7, hy + 2, '#ffffff');
  setPixel(grid, neckX + 9, hy + 2, '#ffffff');
  // Eye
  setPixel(grid, neckX + 6, hy - 2, EYE);
  setPixel(grid, neckX + 7, hy - 2, '#000000');

  outline(grid, OUTLINE);
  return grid;
}
