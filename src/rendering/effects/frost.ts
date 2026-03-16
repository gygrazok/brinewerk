import { type PixelGrid, GRID_SIZE, setPixel } from '../pixel-grid';
import { rgbHex, effectHash } from './util';

const MAX_TWINKLES = 8;
const TWINKLE_LIFE = 1.2;

interface Twinkle {
  x: number;
  y: number;
  birthTime: number;
  brightness: number; // 0.5–1.0
}

const SPAWN_INTERVAL = 0.3; // seconds between spawns

interface TwinkleCtx { twinkles: Twinkle[]; lastSpawnTime: number; }

/** Per-creature twinkle state */
const twinkleState = new Map<string, TwinkleCtx>();

/** Remove state for a creature that no longer exists */
export function cleanupFrostState(creatureId: string): void {
  twinkleState.delete(creatureId);
}

/**
 * Pixel-level frost twinkles: small "+" shapes that appear and fade
 * around the creature body edges.
 */
export function applyFrostEffect(grid: PixelGrid, time: number, creatureId: string): void {
  // Find edge pixels (pixels adjacent to empty space)
  const edgePixels: [number, number][] = [];
  for (const key in grid) {
    const [x, y] = key.split(',').map(Number);
    // Check if any neighbor is empty → this is an edge pixel
    const hasEmpty =
      !grid[`${x - 1},${y}`] ||
      !grid[`${x + 1},${y}`] ||
      !grid[`${x},${y - 1}`] ||
      !grid[`${x},${y + 1}`];
    if (hasEmpty) {
      edgePixels.push([x, y]);
    }
  }

  if (edgePixels.length === 0) return;

  let ctx = twinkleState.get(creatureId);
  if (!ctx) {
    ctx = { twinkles: [], lastSpawnTime: 0 };
    twinkleState.set(creatureId, ctx);
  }

  // Remove expired
  ctx.twinkles = ctx.twinkles.filter(t => (time - t.birthTime) < TWINKLE_LIFE);

  // Spawn on cooldown — guaranteed regular spawns, no hash gating
  if (ctx.twinkles.length < MAX_TWINKLES && (time - ctx.lastSpawnTime) >= SPAWN_INTERVAL) {
    ctx.lastSpawnTime = time;

    // Pick a random edge pixel using time-based hash for variety
    const seed = Math.floor(time * 100);
    const ei = Math.floor(effectHash(seed, edgePixels.length) * edgePixels.length);
    const [ex, ey] = edgePixels[ei];

    // Offset away from body by 1-2 pixels
    const ox = Math.round((effectHash(seed * 11.3, ex) - 0.5) * 4);
    const oy = Math.round((effectHash(seed * 13.1, ey) - 0.5) * 4);

    ctx.twinkles.push({
      x: ex + ox,
      y: ey + oy,
      birthTime: time,
      brightness: 0.5 + effectHash(seed * 7.7, ex + ey) * 0.5,
    });
  }

  // Render each twinkle as a "+" shape
  for (const t of ctx.twinkles) {
    const age = time - t.birthTime;
    const norm = age / TWINKLE_LIFE;

    // Fade in fast, fade out slow
    const fade = norm < 0.2 ? norm / 0.2 : (1 - norm) / 0.8;
    if (fade <= 0) continue;

    const b = t.brightness * fade;
    // Cool white-blue color
    const r = Math.round(150 * b + 100 * b);
    const g = Math.round(200 * b + 55 * b);
    const blue = Math.round(255 * b);
    const col = rgbHex(Math.min(255, r), Math.min(255, g), Math.min(255, blue));

    // Draw "+" shape: center + 4 arms (1px each)
    const pixels: [number, number][] = [
      [t.x, t.y],         // center
      [t.x - 1, t.y],     // left
      [t.x + 1, t.y],     // right
      [t.x, t.y - 1],     // up
      [t.x, t.y + 1],     // down
    ];

    for (const [px, py] of pixels) {
      if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
        setPixel(grid, px, py, col);
      }
    }
  }
}
