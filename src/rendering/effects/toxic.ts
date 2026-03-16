import { type PixelGrid, GRID_SIZE, setPixel } from '../pixel-grid';
import { rgbHex, effectHash } from './util';

const MAX_BUBBLES = 6;
const BUBBLE_LIFE = 1.8;

interface ToxicBubble {
  x: number;
  startY: number;
  birthTime: number;
  dx: number;
  speed: number;
  size: number;
}

/** Per-creature toxic bubble state, keyed by creature id */
const bubbleState = new Map<string, ToxicBubble[]>();

/**
 * Pixel-level toxic bubbles rising from creature body.
 * Spawns small green bubbles that float upward with slight lateral drift.
 */
export function applyToxicEffect(grid: PixelGrid, time: number, creatureId: string): void {
  // Find top pixels per column (surface of the body)
  const topPixels = new Map<number, number>();
  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    const cur = topPixels.get(x);
    if (cur === undefined || y < cur) {
      topPixels.set(x, y);
    }
  }

  if (topPixels.size === 0) return;

  // Get or create bubble array for this creature
  let bubbles = bubbleState.get(creatureId);
  if (!bubbles) {
    bubbles = [];
    bubbleState.set(creatureId, bubbles);
  }

  // Remove expired bubbles
  bubbles = bubbles.filter(b => (time - b.birthTime) < BUBBLE_LIFE);

  // Spawn new bubbles occasionally
  const spawnCheck = effectHash(Math.floor(time * 3), creatureId.length);
  const spawnCheck2 = effectHash(Math.floor(time * 5 + 0.5), creatureId.length + 7);
  const columns = Array.from(topPixels.keys());

  if (bubbles.length < MAX_BUBBLES && spawnCheck > 0.55) {
    const ci = Math.floor(effectHash(time * 17.3, creatureId.length + 3) * columns.length);
    const x = columns[ci];
    const y = topPixels.get(x)!;

    bubbles.push({
      x,
      startY: y - 1,
      birthTime: time,
      dx: (effectHash(time * 7.1, x) - 0.5) * 3,
      speed: 3 + effectHash(time * 13.7, x + 1) * 4,
      size: effectHash(time * 19.3, x + 2) > 0.6 ? 2 : 1,
    });
  }
  if (bubbles.length < MAX_BUBBLES && spawnCheck2 > 0.65) {
    const ci = Math.floor(effectHash(time * 23.1, creatureId.length + 11) * columns.length);
    const x = columns[ci];
    const y = topPixels.get(x)!;

    bubbles.push({
      x,
      startY: y - 1,
      birthTime: time,
      dx: (effectHash(time * 11.3, x + 5) - 0.5) * 3,
      speed: 3 + effectHash(time * 9.7, x + 6) * 4,
      size: 1,
    });
  }

  bubbleState.set(creatureId, bubbles);

  // Render each bubble
  for (const b of bubbles) {
    const age = time - b.birthTime;
    const t = age / BUBBLE_LIFE;

    const bx = Math.round(b.x + b.dx * age);
    const by = Math.round(b.startY - b.speed * age);

    // Fade: full opacity in middle, fade at start and end
    const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
    if (fade <= 0) continue;

    // Green color with brightness variation
    const brightness = 0.6 + 0.4 * fade;
    const gr = Math.round(30 * brightness);
    const gg = Math.round(200 * brightness + Math.sin(time * 6 + b.x) * 30);
    const gb = Math.round(40 * brightness);
    const col = rgbHex(gr, Math.min(255, gg), gb);

    if (b.size === 2) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const px = bx + dx, py = by + dy;
        if (!grid[`${px},${py}`] && px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
          setPixel(grid, px, py, col);
        }
      }
    } else {
      if (!grid[`${bx},${by}`] && bx >= 0 && bx < GRID_SIZE && by >= 0 && by < GRID_SIZE) {
        setPixel(grid, bx, by, col);
      }
    }
  }
}
