import { type PixelGrid, setPixel } from '../pixel-grid';
import { fillEllipse, line, thickLine, outline, shade } from './draw';

const SEGMENTS = ['#2fa860', '#2f80d0', '#e04848', '#f09020', '#30c0b0', '#8050d0'];
const CARAPACE = '#48b070';
const CLAW = '#f06848';
const CLUB = '#ffb040';
const LEG = '#e88060';
const EYE = '#f0e040';
const EYE_BAND = '#303040';
const FAN = ['#2f80d0', '#e04848'];
const OUTLINE = '#0e1c24';

/** Mantis shrimp: long rainbow-segmented body, stalked eyes and folded clubs facing right. */
export function renderMantis(time: number): PixelGrid {
  const grid: PixelGrid = {};
  const cy = 28 + Math.round(Math.sin(time * 1.3));
  const tailX = 9, headX = 36;

  // Walking legs (behind body), paddling in sequence
  for (let i = 0; i < 6; i++) {
    const lx = tailX + 6 + i * 4;
    const swing = Math.sin(time * 6 - i * 0.9) * 1.5;
    line(grid, lx, cy + 3, lx + swing, cy + 7, LEG);
  }

  // Tail fan
  const fanFlare = Math.sin(time * 2) * 0.8;
  for (let i = -3; i <= 3; i++) {
    line(grid, tailX + 1, cy, tailX - 6, cy + i * (1.6 + fanFlare * 0.2), FAN[(i + 3) % 2]);
  }

  // Segmented abdomen: overlapping plates, lit on top, shaded at each plate's back edge
  for (let x = tailX; x <= headX; x++) {
    const t = (x - tailX) / (headX - tailX);
    const h = 2.5 + t * 3;
    const arch = Math.sin(t * Math.PI) * -1.5;
    const segIdx = Math.floor((x - tailX) / 5);
    const seg = SEGMENTS[segIdx % SEGMENTS.length];
    const back = (x - tailX) % 5 === 4;
    const top = -Math.round(h), bottom = Math.round(h * 0.7);
    for (let dy = top; dy <= bottom; dy++) {
      let c = back ? shade(seg, 0.62) : seg;
      if (dy === top) c = shade(seg, 1.35);
      else if (dy === bottom) c = shade(seg, 0.75);
      setPixel(grid, x, cy + arch + dy, c);
    }
  }

  // Carapace (head shield) with a pointed rostrum
  fillEllipse(grid, headX + 4, cy - 1, 6, 4.5, CARAPACE);
  fillEllipse(grid, headX + 3, cy - 3, 4, 1.5, shade(CARAPACE, 1.3));
  line(grid, headX + 9, cy - 2, headX + 12, cy - 1, CARAPACE);

  // Raptorial claws folded under the head, club tip snapping forward now and then
  const strike = Math.max(0, Math.sin(time * 1.1)) ** 8 * 4;
  thickLine(grid, headX + 4, cy + 3, headX + 9 + strike, cy + 5, 1, 1, CLAW);
  thickLine(grid, headX + 9 + strike, cy + 5, headX + 6 + strike, cy + 8, 1, 0.8, CLAW);
  fillEllipse(grid, headX + 6 + strike, cy + 8, 1.5, 1, CLUB);

  // Eye stalks with banded compound eyes
  const look = Math.sin(time * 0.9);
  for (const [sx, ex] of [[headX + 7, headX + 10], [headX + 5, headX + 4]]) {
    line(grid, sx, cy - 4, ex + look, cy - 8, CARAPACE);
    fillEllipse(grid, ex + look, cy - 10, 1.5, 2.5, EYE);
    line(grid, ex + look - 1, cy - 10, ex + look + 1, cy - 10, EYE_BAND);
  }

  // Antennae
  line(grid, headX + 10, cy - 3, headX + 13, cy - 13, CLUB);
  line(grid, headX + 11, cy - 2, headX + 13, cy - 7, CLUB);

  outline(grid, OUTLINE);
  return grid;
}
