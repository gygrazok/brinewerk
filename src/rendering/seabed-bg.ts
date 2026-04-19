import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import { getRenderSettings } from './render-settings';
import { GRID_SIZE } from './pixel-grid';
import { SeededRng, seededNoise } from '../util/prng';

/**
 * Uniform pixel density across all pixel-art elements.
 * Creatures: 40-grid canvas rendered at BLOCK_PX=3, displayed at 64px → 64/40 = 1.6 world px per grid unit.
 * Sand, decorations, and all pixel-art share this same density.
 */
const WORLD_PX = 64 / GRID_SIZE; // 1.6

/** Canvas pixels per grid unit (for rendering offscreen canvases at high internal resolution) */
const RENDER_PX = 3;

// --- Sand background ---

/**
 * Depth bands: each band covers a vertical range and has a base color.
 * Bands are painted as full horizontal stripes with slight undulation,
 * giving a layered sediment look rather than per-pixel noise.
 */
const DEPTH_BANDS: { t: number; r: number; g: number; b: number }[] = [
  { t: 0.00, r: 18, g: 42, b: 52 },   // shallow — visible teal
  { t: 0.12, r: 16, g: 38, b: 48 },
  { t: 0.25, r: 14, g: 34, b: 44 },
  { t: 0.38, r: 13, g: 30, b: 40 },
  { t: 0.50, r: 12, g: 26, b: 36 },
  { t: 0.62, r: 10, g: 22, b: 32 },
  { t: 0.75, r: 9,  g: 18, b: 28 },
  { t: 0.88, r: 8,  g: 14, b: 22 },
  { t: 1.00, r: 6,  g: 10, b: 16 },   // deep — dark
];

function lerpBandColor(t: number): [number, number, number] {
  // Clamp
  if (t <= 0) return [DEPTH_BANDS[0].r, DEPTH_BANDS[0].g, DEPTH_BANDS[0].b];
  if (t >= 1) {
    const last = DEPTH_BANDS[DEPTH_BANDS.length - 1];
    return [last.r, last.g, last.b];
  }
  // Find surrounding bands
  for (let i = 0; i < DEPTH_BANDS.length - 1; i++) {
    const a = DEPTH_BANDS[i];
    const b = DEPTH_BANDS[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return [
        Math.round(a.r + (b.r - a.r) * f),
        Math.round(a.g + (b.g - a.g) * f),
        Math.round(a.b + (b.b - a.b) * f),
      ];
    }
  }
  const last = DEPTH_BANDS[DEPTH_BANDS.length - 1];
  return [last.r, last.g, last.b];
}

/**
 * Smoothstep helper for plateau blending.
 */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * How "rocky" a pixel-column is: 1.0 at far edges, 0.0 in center.
 */
function getRockiness(x: number, w: number): number {
  const t = x / w;
  if (t < 0.3) return Math.max(0, 1 - t / 0.3);
  if (t > 0.7) return Math.max(0, (t - 0.7) / 0.3);
  return 0;
}

/**
 * Terrain wave phase offsets — derived from the seabed seed so each
 * playthrough has a unique terrain silhouette.  Set once per background
 * creation via `initTerrainPhases()`.
 */
let tp = { p1a: 0, p1b: 1.5, p2a: 2.0, p2b: 0.7, p3a: 3.5, p3b: 1.2 };

function initTerrainPhases(seed: number): void {
  const rng = new SeededRng(seed);
  tp = {
    p1a: rng.float(0, Math.PI * 2),
    p1b: rng.float(0, Math.PI * 2),
    p2a: rng.float(0, Math.PI * 2),
    p2b: rng.float(0, Math.PI * 2),
    p3a: rng.float(0, Math.PI * 2),
    p3b: rng.float(0, Math.PI * 2),
  };
}

/**
 * Terrain profiles: three layers.
 * Layer 1 (upper): rocky cliff at edges, sandy shelf in center.
 * Layer 2 (middle): deeper ledge with different rock color.
 * Layer 3 (deepest): bottom shelf.
 * All have gentle seed-based undulation.
 */
function getLayer1Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.3));
  const rightP = smoothstep(Math.max(0, (t - 0.7) / 0.3));
  const plateau = Math.max(leftP, rightP);

  // Upper layer: 0.55h at corners, 0.80h at center
  const baseY = 0.80 - plateau * 0.25;
  const wave = Math.sin(x * 0.04 + tp.p1a) * 0.012 + Math.sin(x * 0.09 + tp.p1b) * 0.006;
  return Math.floor(h * (baseY + wave));
}

function getLayer2Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.35));
  const rightP = smoothstep(Math.max(0, (t - 0.65) / 0.35));
  const plateau = Math.max(leftP, rightP);

  // Middle layer: 0.72h at corners, 0.90h at center
  const baseY = 0.90 - plateau * 0.18;
  const wave = Math.sin(x * 0.05 + tp.p2a) * 0.008 + Math.sin(x * 0.12 + tp.p2b) * 0.005;
  return Math.floor(h * (baseY + wave));
}

function getLayer3Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.4));
  const rightP = smoothstep(Math.max(0, (t - 0.6) / 0.4));
  const plateau = Math.max(leftP, rightP);

  // Deepest layer: 0.85h at corners, 0.96h at center
  const baseY = 0.96 - plateau * 0.11;
  const wave = Math.sin(x * 0.06 + tp.p3a) * 0.006 + Math.sin(x * 0.14 + tp.p3b) * 0.004;
  return Math.floor(h * (baseY + wave));
}

/** Create an offscreen sand texture with three-layer terrain.
 *  Terrain phases must be initialised via `initTerrainPhases(seed)` before calling. */
function createSandTexture(worldW: number, worldH: number): Texture {
  const canvas = document.createElement('canvas');
  const w = Math.ceil(worldW / WORLD_PX);
  const h = Math.ceil(worldH / WORLD_PX);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Layer 1 rock palette (grey-teal)
  const rock1Dark:  [number, number, number][] = [[14, 22, 26], [12, 20, 24], [16, 24, 28]];
  const rock1Mid:   [number, number, number][] = [[22, 34, 40], [26, 38, 44], [20, 32, 38]];
  const rock1Light: [number, number, number][] = [[34, 50, 58], [38, 54, 62], [30, 46, 54]];

  // Layer 2 rock palette (warmer, mossy tones)
  const rock2Dark:  [number, number, number][] = [[12, 20, 18], [14, 22, 16], [10, 18, 16]];
  const rock2Mid:   [number, number, number][] = [[20, 32, 28], [24, 36, 30], [18, 30, 26]];
  const rock2Light: [number, number, number][] = [[30, 44, 38], [34, 48, 42], [28, 42, 36]];

  // Layer 3 rock palette (deep purple-brown, encrusted)
  const rock3Dark:  [number, number, number][] = [[14, 14, 20], [12, 12, 18], [16, 14, 22]];
  const rock3Mid:   [number, number, number][] = [[22, 22, 32], [26, 24, 36], [20, 20, 30]];
  const rock3Light: [number, number, number][] = [[32, 32, 44], [36, 34, 48], [28, 30, 42]];

  // Sand palette
  const sandBase: [number, number, number] = [22, 30, 24];

  // Precompute profiles
  const profile1 = new Int32Array(w);
  const profile2 = new Int32Array(w);
  const profile3 = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    profile1[x] = getLayer1Profile(x, w, h);
    profile2[x] = getLayer2Profile(x, w, h);
    profile3[x] = getLayer3Profile(x, w, h);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t1 = profile1[x];
      const t2 = profile2[x];
      const t3 = profile3[x];
      const rockiness = getRockiness(x, w);

      if (y < t1) {
        // === WATER ZONE ===
        const wave = Math.sin(x * 0.02) * 0.03 + Math.sin(x * 0.007 + 1.3) * 0.02;
        const t = y / h + wave;
        const [cr, cg, cb] = lerpBandColor(t);
        const v = ((seededNoise(x * 3 + y * 7) - 0.5) * 2) | 0;
        ctx.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`;

      } else if (y <= t1 + 1) {
        paintEdge(ctx, x, y, rockiness, rock1Light, sandBase);

      } else if (y < t2) {
        const depth = y - t1;
        paintGround(ctx, x, y, depth, rockiness,
          rock1Light, rock1Mid, rock1Dark, sandBase);

      } else if (y <= t2 + 1) {
        paintEdge(ctx, x, y, rockiness, rock2Light, sandBase);

      } else if (y < t3) {
        const depth = y - t2;
        paintGround(ctx, x, y, depth, rockiness,
          rock2Light, rock2Mid, rock2Dark, sandBase);

      } else if (y <= t3 + 1) {
        paintEdge(ctx, x, y, rockiness, rock3Light, sandBase);

      } else {
        const depth = y - t3;
        paintGround(ctx, x, y, depth, rockiness,
          rock3Light, rock3Mid, rock3Dark, sandBase);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return Texture.from({ resource: canvas, scaleMode: 'nearest' });
}

function paintEdge(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  rockiness: number,
  rockLight: [number, number, number][],
  sandBase: [number, number, number],
): void {
  if (rockiness > 0.1) {
    const n = seededNoise(x * 5 + y * 3 + 300);
    const ci = Math.floor(n * rockLight.length) % rockLight.length;
    const [r, g, b] = rockLight[ci];
    ctx.fillStyle = `rgb(${r + 6},${g + 6},${b + 6})`;
  } else {
    const n = seededNoise(x * 5 + y * 11 + 500);
    const v = Math.floor((n - 0.5) * 3);
    ctx.fillStyle = `rgb(${sandBase[0] + 10 + v},${sandBase[1] + 12 + v},${sandBase[2] + 8 + v})`;
  }
}

function paintGround(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, depth: number,
  rockiness: number,
  rockLight: [number, number, number][],
  rockMid: [number, number, number][],
  rockDark: [number, number, number][],
  sandBase: [number, number, number],
): void {
  const n = seededNoise(x * 7 + y * 13 + 50);
  let rr: number, rg: number, rb: number;
  if (depth <= 3) {
    const ci = Math.floor(n * rockLight.length) % rockLight.length;
    [rr, rg, rb] = rockLight[ci];
  } else if (depth <= 8) {
    const ci = Math.floor(n * rockMid.length) % rockMid.length;
    [rr, rg, rb] = rockMid[ci];
  } else {
    const ci = Math.floor(n * rockDark.length) % rockDark.length;
    [rr, rg, rb] = rockDark[ci];
  }
  // Crevice noise
  const crevice = seededNoise(x * 11 + y * 17 + 900) < 0.06 ? -5 : 0;
  rr += crevice; rg += crevice; rb += crevice;

  // Sand color
  const sn = seededNoise(x * 5 + y * 11 + 500);
  const sv = Math.floor((sn - 0.5) * 4);
  const sr = sandBase[0] + sv;
  const sg = sandBase[1] + sv;
  const sb = sandBase[2] + sv + Math.floor(sn * 2);

  // Blend rock ↔ sand
  const rk = rockiness * rockiness;
  const fr = Math.round(sr + (rr - sr) * rk);
  const fg = Math.round(sg + (rg - sg) * rk);
  const fb = Math.round(sb + (rb - sb) * rk);
  ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
}

// --- Pixel-art decorations ---

interface DecorationDef {
  x: number;
  y: number;
  type: 'rock' | 'coral' | 'algae' | 'shell' | 'pebbles' | 'sponge';
  size: number; // grid units — display size = size * WORLD_PX world px
  seed: number;
}

// --- Decoration placement rules per layer/zone ---

interface PlacementRule {
  type: DecorationDef['type'];
  count: number;          // how many to spawn in this zone
  sizeMin: number;        // grid units
  sizeMax: number;
  yOffsetMin: number;     // offset below the terrain profile line (world px)
  yOffsetMax: number;
}

/** Cliff-side rules (rocky edges, x < 500 or x > 1420) */
const CLIFF_RULES_L1: PlacementRule[] = [
  { type: 'rock',   count: 4, sizeMin: 24, sizeMax: 34, yOffsetMin: 0,  yOffsetMax: 40 },
  { type: 'algae',  count: 6, sizeMin: 40, sizeMax: 60, yOffsetMin: -10, yOffsetMax: 60 },
  { type: 'sponge', count: 3, sizeMin: 16, sizeMax: 20, yOffsetMin: 10, yOffsetMax: 50 },
];

const CLIFF_RULES_L2: PlacementRule[] = [
  { type: 'rock',   count: 3, sizeMin: 20, sizeMax: 26, yOffsetMin: 0,  yOffsetMax: 30 },
  { type: 'algae',  count: 4, sizeMin: 36, sizeMax: 50, yOffsetMin: -10, yOffsetMax: 50 },
  { type: 'sponge', count: 2, sizeMin: 14, sizeMax: 16, yOffsetMin: 10, yOffsetMax: 40 },
];

const CLIFF_RULES_L3: PlacementRule[] = [
  { type: 'rock',   count: 2, sizeMin: 18, sizeMax: 24, yOffsetMin: 0,  yOffsetMax: 20 },
  { type: 'algae',  count: 3, sizeMin: 30, sizeMax: 42, yOffsetMin: -10, yOffsetMax: 40 },
  { type: 'sponge', count: 1, sizeMin: 12, sizeMax: 14, yOffsetMin: 5,  yOffsetMax: 25 },
];

/** Center/floor rules (sandy zone, x 500–1420) */
const FLOOR_RULES_L1: PlacementRule[] = [
  { type: 'rock',    count: 3, sizeMin: 18, sizeMax: 22, yOffsetMin: -10, yOffsetMax: 20 },
  { type: 'pebbles', count: 5, sizeMin: 10, sizeMax: 14, yOffsetMin: 0,  yOffsetMax: 30 },
  { type: 'shell',   count: 4, sizeMin: 10, sizeMax: 12, yOffsetMin: 0,  yOffsetMax: 30 },
  { type: 'algae',   count: 3, sizeMin: 24, sizeMax: 30, yOffsetMin: -10, yOffsetMax: 15 },
  { type: 'sponge',  count: 1, sizeMin: 10, sizeMax: 12, yOffsetMin: 0,  yOffsetMax: 15 },
];

const FLOOR_RULES_L2: PlacementRule[] = [
  { type: 'rock',    count: 2, sizeMin: 16, sizeMax: 20, yOffsetMin: -5, yOffsetMax: 15 },
  { type: 'pebbles', count: 3, sizeMin: 10, sizeMax: 12, yOffsetMin: 0,  yOffsetMax: 20 },
  { type: 'shell',   count: 2, sizeMin: 10, sizeMax: 10, yOffsetMin: 0,  yOffsetMax: 20 },
  { type: 'algae',   count: 2, sizeMin: 22, sizeMax: 28, yOffsetMin: -5, yOffsetMax: 10 },
  { type: 'sponge',  count: 1, sizeMin: 10, sizeMax: 12, yOffsetMin: 0,  yOffsetMax: 10 },
];

const FLOOR_RULES_L3: PlacementRule[] = [
  { type: 'rock',    count: 2, sizeMin: 14, sizeMax: 18, yOffsetMin: -5, yOffsetMax: 10 },
  { type: 'algae',   count: 2, sizeMin: 18, sizeMax: 24, yOffsetMin: -5, yOffsetMax: 8 },
  { type: 'sponge',  count: 1, sizeMin: 8,  sizeMax: 10, yOffsetMin: 0,  yOffsetMax: 8 },
];

/**
 * Procedurally generate decoration list from a seed.
 * Uses terrain profiles to place decorations at correct y positions.
 * Mirrors structure left↔right for natural cliff symmetry.
 */
function generateDecorations(seed: number, worldW: number, worldH: number): DecorationDef[] {
  const rng = new SeededRng(seed);
  const decos: DecorationDef[] = [];
  let nextSeed = 0;

  // Helper: get terrain y (world px) at a given world x
  const gridW = Math.ceil(worldW / WORLD_PX);
  const gridH = Math.ceil(worldH / WORLD_PX);
  const profileY1 = (wx: number) => getLayer1Profile(wx / WORLD_PX, gridW, gridH) * WORLD_PX;
  const profileY2 = (wx: number) => getLayer2Profile(wx / WORLD_PX, gridW, gridH) * WORLD_PX;
  const profileY3 = (wx: number) => getLayer3Profile(wx / WORLD_PX, gridW, gridH) * WORLD_PX;

  const profiles = [profileY1, profileY2, profileY3];

  // Minimum distance between decorations (world px) to avoid clumping
  const MIN_DIST = 50;

  function tooClose(x: number, y: number): boolean {
    for (const d of decos) {
      const dx = d.x - x;
      const dy = d.y - y;
      if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return true;
    }
    return false;
  }

  function placeInZone(
    rules: PlacementRule[],
    xMin: number,
    xMax: number,
    profileFn: (wx: number) => number,
  ) {
    for (const rule of rules) {
      let placed = 0;
      let attempts = 0;
      while (placed < rule.count && attempts < rule.count * 6) {
        attempts++;
        const x = Math.floor(rng.float(xMin, xMax));
        const terrainY = profileFn(x);
        const yOff = rng.float(rule.yOffsetMin, rule.yOffsetMax);
        const y = Math.floor(terrainY + yOff);

        // Skip if out of bounds or too close to another decoration
        if (y < 0 || y > worldH) continue;
        if (tooClose(x, y)) continue;

        const size = rng.int(rule.sizeMin, rule.sizeMax);
        decos.push({ x, y, type: rule.type, size, seed: nextSeed++ });
        placed++;
      }
    }
  }

  // -- Layer 1 --
  // Left cliff (x 30–470)
  placeInZone(CLIFF_RULES_L1, 30, 470, profiles[0]);
  // Right cliff (mirrored, x 1450–1890)
  placeInZone(CLIFF_RULES_L1, 1450, 1890, profiles[0]);
  // Center floor
  placeInZone(FLOOR_RULES_L1, 500, 1420, profiles[0]);

  // -- Layer 2 --
  placeInZone(CLIFF_RULES_L2, 40, 400, profiles[1]);
  placeInZone(CLIFF_RULES_L2, 1520, 1880, profiles[1]);
  placeInZone(FLOOR_RULES_L2, 450, 1470, profiles[1]);

  // -- Layer 3 --
  placeInZone(CLIFF_RULES_L3, 50, 380, profiles[2]);
  placeInZone(CLIFF_RULES_L3, 1540, 1870, profiles[2]);
  placeInZone(FLOOR_RULES_L3, 500, 1420, profiles[2]);

  return decos;
}

function renderDecoration(def: DecorationDef): HTMLCanvasElement {
  const canvasPx = def.size * RENDER_PX;
  const canvas = document.createElement('canvas');
  canvas.width = canvasPx;
  canvas.height = canvasPx;
  const ctx = canvas.getContext('2d')!;
  const s = def.size;
  const rng = (i: number) => seededNoise(def.seed * 100 + i);

  switch (def.type) {
    case 'rock': drawRock(ctx, s, rng); break;
    case 'coral': drawCoral(ctx, s, rng); break;
    case 'algae': drawAlgae(ctx, s, rng); break;
    case 'shell': drawShell(ctx, s, rng); break;
    case 'pebbles': drawPebbles(ctx, s, rng); break;
    case 'sponge': drawSponge(ctx, s, rng); break;
  }
  return canvas;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * RENDER_PX, y * RENDER_PX, RENDER_PX, RENDER_PX);
}

function drawRock(ctx: CanvasRenderingContext2D, s: number, rng: (i: number) => number) {
  // Amorphous rock: build irregular silhouette using overlapping blobs
  // with noise-perturbed radii, then shade with depth/edge detection.
  const darkColors = ['#101c22', '#0e1a20', '#121e26', '#0c1820'];
  const midColors  = ['#1a2a30', '#1e3038', '#223640', '#192830'];
  const lightColors = ['#2a3e48', '#2e4450', '#324a56', '#263a44'];
  const outline = '#080e12';

  // Generate 2-4 overlapping blobs to form irregular shape
  const blobCount = 2 + Math.floor(rng(0) * 3);
  const blobs: { cx: number; cy: number; rx: number; ry: number }[] = [];

  for (let b = 0; b < blobCount; b++) {
    // Each blob has a different center offset and radii
    const bcx = Math.floor(s * (0.3 + rng(b * 7 + 1) * 0.4));
    const bcy = Math.floor(s * (0.35 + rng(b * 7 + 2) * 0.35));
    const brx = Math.floor(s * (0.15 + rng(b * 7 + 3) * 0.22));
    const bry = Math.floor(s * (0.12 + rng(b * 7 + 4) * 0.2));
    blobs.push({ cx: bcx, cy: bcy, rx: brx, ry: bry });
  }

  // Build a boolean grid for the rock silhouette (with noisy edge)
  const filled: boolean[][] = Array.from({ length: s }, () => Array(s).fill(false));

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      for (const blob of blobs) {
        const dx = x - blob.cx;
        const dy = y - blob.cy;
        const d = (dx * dx) / (blob.rx * blob.rx) + (dy * dy) / (blob.ry * blob.ry);
        // Perturb the boundary with noise for jagged edges
        const angle = Math.atan2(dy, dx);
        const noise = rng(Math.floor(angle * 10 + 500) + blob.cx * 3) * 0.5 + 0.75;
        if (d < noise) {
          filled[y][x] = true;
        }
      }
    }
  }

  // Render pixels with edge detection for outline, height for shading
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      if (!filled[y][x]) continue;

      // Check if this is an edge pixel
      const isEdge =
        x === 0 || y === 0 || x === s - 1 || y === s - 1 ||
        !filled[y - 1][x] || !filled[y + 1]?.[x] ||
        !filled[y][x - 1] || !filled[y][x + 1];

      if (isEdge) {
        px(ctx, x, y, outline);
      } else {
        // Shade based on vertical position in the rock (top = lighter)
        // Find top of rock at this x column
        let topY = y;
        for (let ty = y - 1; ty >= 0; ty--) {
          if (filled[ty][x]) topY = ty; else break;
        }
        const depth = y - topY;
        const n = rng(x * 7 + y * 13 + 50);
        if (depth <= 2) {
          // Top highlight
          const ci = Math.floor(n * lightColors.length) % lightColors.length;
          px(ctx, x, y, lightColors[ci]);
        } else if (depth <= 5) {
          // Mid tone
          const ci = Math.floor(n * midColors.length) % midColors.length;
          px(ctx, x, y, midColors[ci]);
        } else {
          // Deep shadow
          const ci = Math.floor(n * darkColors.length) % darkColors.length;
          px(ctx, x, y, darkColors[ci]);
        }
      }
    }
  }
}

function drawCoral(ctx: CanvasRenderingContext2D, s: number, rng: (i: number) => number) {
  const cx = Math.floor(s / 2);
  const base = s - 2;
  const branchColors = ['#8b2252', '#a0336a', '#c44488', '#6b1a42'];
  const tipColor = '#e066aa';

  // Trunk
  const trunkH = Math.floor(s * 0.4);
  for (let y = base; y > base - trunkH; y--) {
    const ci = Math.floor(rng(y * 3) * branchColors.length) % branchColors.length;
    px(ctx, cx, y, branchColors[ci]);
    if (rng(y * 5) > 0.5) px(ctx, cx - 1, y, branchColors[ci]);
  }

  // Branches
  const branches = 2 + Math.floor(rng(1) * 3);
  for (let b = 0; b < branches; b++) {
    const startY = base - Math.floor(trunkH * (0.3 + rng(b * 10) * 0.6));
    const dir = rng(b * 10 + 1) > 0.5 ? 1 : -1;
    const len = 2 + Math.floor(rng(b * 10 + 2) * (s * 0.3));
    let bx = cx;
    let by = startY;
    for (let i = 0; i < len; i++) {
      bx += dir;
      if (rng(b * 10 + i + 30) > 0.4) by--;
      const ci = Math.floor(rng(b * 10 + i) * branchColors.length) % branchColors.length;
      px(ctx, bx, by, branchColors[ci]);
      if (i === len - 1) px(ctx, bx, by, tipColor);
    }
  }
}

function drawAlgae(ctx: CanvasRenderingContext2D, s: number, rng: (i: number) => number) {
  const strands = 2 + Math.floor(rng(0) * 3);
  const darkColors = ['#1a5c3a', '#1a5030', '#165a34'];
  const midColors = ['#1e6b44', '#228050', '#1c7a48'];
  const tipColor = '#2aa060';
  const highlightColor = '#34c070';

  for (let st = 0; st < strands; st++) {
    let cx = Math.floor(s * 0.15 + rng(st * 10) * s * 0.7);
    // Each strand starts at a slightly different y — staggered roots
    const yOffset = Math.floor(rng(st * 10 + 50) * Math.min(6, s * 0.1));
    const base = s - 1 - yOffset;
    // Height uses 65-90% of available space
    const available = base + 1;
    const height = Math.floor(available * (0.65 + rng(st * 10 + 1) * 0.25));
    // Width: 2-4 pixels depending on size, thicker at base
    const maxWidth = Math.max(2, Math.min(4, Math.floor(s * 0.08)));

    for (let i = 0; i < height; i++) {
      const t = i / height; // 0 = base, 1 = tip
      // Taper: full width at base, 1px at tip
      const w = Math.max(1, Math.round(maxWidth * (1 - t * 0.7)));
      // Color: darker at base, lighter toward tip
      const colors = t < 0.3 ? darkColors : t < 0.75 ? midColors : [tipColor];
      const ci = Math.floor(rng(st * 10 + i + 5) * colors.length) % colors.length;
      const color = colors[ci];

      // Draw width pixels centered on cx
      for (let dx = 0; dx < w; dx++) {
        const px_x = cx + dx - Math.floor(w / 2);
        px(ctx, px_x, base - i, color);
      }

      // Gentle sway — strand wanders left/right
      if (rng(st * 10 + i + 20) > 0.6) cx += rng(st * 10 + i + 30) > 0.5 ? 1 : -1;
    }

    // Bright tip
    px(ctx, cx, base - height, highlightColor);
    if (maxWidth >= 2) px(ctx, cx - 1, base - height + 1, tipColor);

    // Optional leaf blades on taller strands
    if (height > 10) {
      const leaves = 1 + Math.floor(rng(st * 10 + 40) * 3);
      for (let l = 0; l < leaves; l++) {
        const ly = Math.floor(height * (0.3 + rng(st * 10 + l * 5 + 42) * 0.5));
        const dir = rng(st * 10 + l * 5 + 43) > 0.5 ? 1 : -1;
        const leafLen = 2 + Math.floor(rng(st * 10 + l * 5 + 44) * 3);
        for (let li = 0; li < leafLen; li++) {
          const lci = Math.floor(rng(st * 10 + l * 5 + li + 45) * midColors.length) % midColors.length;
          px(ctx, cx + dir * (li + 1), base - ly - li, midColors[lci]);
        }
      }
    }
  }
}

function drawShell(ctx: CanvasRenderingContext2D, s: number, _rng: (i: number) => number) {
  const cx = Math.floor(s / 2);
  const cy = Math.floor(s / 2);
  const r = Math.floor(s * 0.3);
  const colors = ['#c8b89a', '#b8a888', '#d8c8aa', '#a89878'];
  const outline = '#887868';

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        const angle = Math.atan2(dy, dx);
        const stripe = Math.floor((angle + d * 0.5) * 2);
        const ci = Math.abs(stripe) % colors.length;
        if (d > r - 1) {
          px(ctx, cx + dx, cy + dy, outline);
        } else {
          px(ctx, cx + dx, cy + dy, colors[ci]);
        }
      }
    }
  }
}

function drawPebbles(ctx: CanvasRenderingContext2D, s: number, rng: (i: number) => number) {
  const count = 3 + Math.floor(rng(0) * 4);
  const colors = ['#2a3640', '#1e2a32', '#34424c', '#283238'];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng(i * 3 + 1) * (s - 2)) + 1;
    const y = Math.floor(rng(i * 3 + 2) * (s - 2)) + 1;
    const ci = Math.floor(rng(i * 3 + 3) * colors.length) % colors.length;
    px(ctx, x, y, colors[ci]);
    if (rng(i * 3 + 4) > 0.5) px(ctx, x + 1, y, colors[ci]);
  }
}

function drawSponge(ctx: CanvasRenderingContext2D, s: number, rng: (i: number) => number) {
  const cx = Math.floor(s / 2);
  const base = s - 2;
  const bodyColors = ['#8a6a30', '#9a7a3a', '#7a5a28', '#aa8a44'];
  const poreColor = '#5a4218';
  const highlight = '#baa050';

  // Tubular body — slightly tapered oval
  const bodyH = Math.floor(s * 0.55);
  const baseW = Math.floor(s * 0.3);

  for (let y = 0; y < bodyH; y++) {
    const progress = y / bodyH; // 0 = top, 1 = bottom
    const w = Math.max(2, Math.floor(baseW * (0.6 + progress * 0.4)));
    for (let dx = -w; dx <= w; dx++) {
      const py = base - y;
      const ci = Math.floor(rng(dx * 7 + y * 13 + 10) * bodyColors.length) % bodyColors.length;
      // Outline
      if (Math.abs(dx) >= w - 1) {
        px(ctx, cx + dx, py, poreColor);
      } else {
        px(ctx, cx + dx, py, bodyColors[ci]);
      }
    }
  }

  // Pores (dark dots scattered on body)
  const poreCount = 3 + Math.floor(rng(50) * 5);
  for (let i = 0; i < poreCount; i++) {
    const py = base - Math.floor(rng(i * 3 + 60) * (bodyH - 2)) - 1;
    const pw = Math.floor(baseW * (0.6 + ((base - py) / bodyH) * 0.4));
    const pxOff = Math.floor((rng(i * 3 + 61) - 0.5) * pw * 1.5);
    px(ctx, cx + pxOff, py, poreColor);
  }

  // Opening at top (osculum) — lighter ring
  const topY = base - bodyH + 1;
  const topW = Math.floor(baseW * 0.55);
  for (let dx = -topW; dx <= topW; dx++) {
    if (Math.abs(dx) >= topW - 1) {
      px(ctx, cx + dx, topY, highlight);
    } else {
      px(ctx, cx + dx, topY, poreColor);
    }
  }
}

// --- Ambient particles ---

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface AmbientParticles {
  particles: Particle[];
  gfx: Graphics;
  worldW: number;
  worldH: number;
}

const MAX_PARTICLES = 80;

function createAmbientParticles(worldW: number, worldH: number): AmbientParticles {
  const gfx = new Graphics();
  const particles: Particle[] = [];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push(spawnParticle(worldW, worldH, true));
  }

  return { particles, gfx, worldW, worldH };
}

/** Module-level RNG for ambient particles (visual-only, seeded from timestamp) */
let particleRng = new SeededRng(Date.now() | 0);

function spawnParticle(worldW: number, worldH: number, randomY: boolean): Particle {
  return {
    x: particleRng.float(0, worldW),
    y: randomY ? particleRng.float(0, worldH) : worldH + particleRng.float(0, 40),
    vx: (particleRng.next() - 0.5) * 12,
    vy: -(8 + particleRng.next() * 18),
    size: 2 + particleRng.next() * 3,
    alpha: 0.3 + particleRng.next() * 0.35,
    life: 0,
    maxLife: 8 + particleRng.next() * 15,
  };
}

function updateAmbientParticles(ap: AmbientParticles, dt: number): void {
  const settings = getRenderSettings();
  if (!settings.ambientParticles) {
    ap.gfx.visible = false;
    return;
  }
  ap.gfx.visible = true;

  for (let i = 0; i < ap.particles.length; i++) {
    const p = ap.particles[i];
    p.x += (p.vx + Math.sin(p.life * 1.2 + i * 0.7) * 6) * dt;
    p.y += p.vy * dt;
    p.life += dt;

    if (p.x < -10) p.x = ap.worldW + 10;
    if (p.x > ap.worldW + 10) p.x = -10;

    if (p.life >= p.maxLife || p.y < -40) {
      ap.particles[i] = spawnParticle(ap.worldW, ap.worldH, false);
    }
  }

  ap.gfx.clear();
  for (const p of ap.particles) {
    const fadeIn = Math.min(p.life / 0.8, 1.0);
    const fadeOut = Math.max(1.0 - (p.life / p.maxLife), 0.0);
    const a = p.alpha * fadeIn * fadeOut;
    const color = p.size > 3.5 ? 0x6aaa9f : 0x4a8a8f;
    ap.gfx.circle(p.x, p.y, p.size);
    ap.gfx.fill({ color, alpha: a });
  }
}

// --- Light rays ---

interface LightRays {
  container: Container;
  rays: Graphics[];
  time: number;
  _rayDefs: { x: number; baseX: number; w: number; angle: number; alpha: number }[];
}

function createLightRays(): LightRays {
  const container = new Container();
  const rays: Graphics[] = [];

  const rayDefs = [
    { x: 280,  baseX: 280,  w: 100, angle: -0.15, alpha: 0.08 },
    { x: 780,  baseX: 780,  w: 140, angle: -0.08, alpha: 0.07 },
    { x: 1320, baseX: 1320, w: 120, angle: -0.12, alpha: 0.06 },
    { x: 1700, baseX: 1700, w: 100, angle: -0.2,  alpha: 0.05 },
  ];

  for (const rd of rayDefs) {
    const ray = new Graphics();
    ray.rect(-rd.w * 0.3, -50, rd.w * 0.6, 300);
    ray.fill({ color: 0x7eeee4, alpha: rd.alpha });
    ray.rect(-rd.w * 0.5, 250, rd.w, 400);
    ray.fill({ color: 0x7eeee4, alpha: rd.alpha * 0.5 });
    ray.rect(-rd.w * 0.4, 600, rd.w * 0.8, 250);
    ray.fill({ color: 0x4acac4, alpha: rd.alpha * 0.3 });
    ray.x = rd.x;
    ray.y = 0;
    ray.rotation = rd.angle;
    container.addChild(ray);
    rays.push(ray);
  }

  return { container, rays, time: 0, _rayDefs: rayDefs };
}

function updateLightRays(lr: LightRays, dt: number): void {
  const settings = getRenderSettings();
  if (!settings.lightRays) {
    lr.container.visible = false;
    return;
  }
  lr.container.visible = true;
  lr.time += dt;

  for (let i = 0; i < lr.rays.length; i++) {
    const ray = lr.rays[i];
    ray.alpha = 0.5 + Math.sin(lr.time * 0.2 + i * 2.1) * 0.3;
    const baseDef = lr._rayDefs[i];
    if (baseDef) {
      ray.x = baseDef.baseX + Math.sin(lr.time * 0.15 + i * 1.5) * 30;
    }
  }
}

// --- Swaying decoration tracking ---

interface SwayingDeco {
  sprite: Sprite;
  seed: number;       // for phase variation
  amplitude: number;  // max skew radians
  speed: number;      // oscillation speed
}

// --- Seabed background assembly ---

export interface SeabedBackground {
  container: Container;
  sandSprite: Sprite;
  decoContainer: Container;
  ambientParticles: AmbientParticles;
  lightRays: LightRays;
  swayingDecos: SwayingDeco[];
  time: number;
}

export function createSeabedBackground(worldW: number, worldH: number, seabedSeed: number): SeabedBackground {
  // Derive terrain wave phases from seed — affects profiles used by both
  // the sand texture and decoration placement
  initTerrainPhases(seabedSeed);

  const container = new Container();
  const settings = getRenderSettings();

  // Sand layer
  const sandTex = createSandTexture(worldW, worldH);
  const sandSprite = new Sprite(sandTex);
  sandSprite.width = worldW;
  sandSprite.height = worldH;
  sandSprite.visible = settings.sandBackground;
  container.addChild(sandSprite);

  // Decorations layer — procedurally generated from seed
  const decorations = generateDecorations(seabedSeed, worldW, worldH);
  const decoContainer = new Container();
  decoContainer.visible = settings.decorations;
  const swayingDecos: SwayingDeco[] = [];

  for (const def of decorations) {
    const canvas = renderDecoration(def);
    const tex = Texture.from({ resource: canvas, scaleMode: 'nearest' });
    const sprite = new Sprite(tex);

    // Display size: grid units × WORLD_PX → uniform pixel density with creatures
    const displaySize = def.size * WORLD_PX;

    const swayable = def.type === 'algae' || def.type === 'coral';

    if (swayable) {
      // Anchor at bottom-center so sway rotates from the base
      sprite.anchor.set(0.5, 1.0);
      sprite.x = def.x;
      sprite.y = def.y + displaySize / 2;
    } else {
      sprite.x = def.x - displaySize / 2;
      sprite.y = def.y - displaySize / 2;
    }

    sprite.width = displaySize;
    sprite.height = displaySize;
    decoContainer.addChild(sprite);

    if (swayable) {
      const isAlgae = def.type === 'algae';
      swayingDecos.push({
        sprite,
        seed: def.seed,
        amplitude: isAlgae ? 0.08 : 0.04,  // algae sways more than coral
        speed: isAlgae ? 0.8 : 0.5,
      });
    }
  }
  container.addChild(decoContainer);

  // Light rays
  const lightRays = createLightRays();
  container.addChild(lightRays.container);

  // Ambient particles
  const ambientParticles = createAmbientParticles(worldW, worldH);
  container.addChild(ambientParticles.gfx);

  return { container, sandSprite, decoContainer, ambientParticles, lightRays, swayingDecos, time: 0 };
}

/** Destroy all textures and children in a seabed background */
export function destroySeabedBackground(bg: SeabedBackground): void {
  // Destroy sand texture
  bg.sandSprite.texture.destroy(true);
  bg.sandSprite.destroy();

  // Destroy each decoration sprite and its texture
  for (const child of bg.decoContainer.children) {
    if (child instanceof Sprite) {
      child.texture.destroy(true);
    }
    child.destroy();
  }
  bg.decoContainer.destroy();

  // Destroy light rays and ambient particles
  bg.lightRays.container.destroy({ children: true });
  bg.ambientParticles.gfx.destroy();

  bg.container.destroy();
}

export function updateSeabedBackground(bg: SeabedBackground, dt: number): void {
  const settings = getRenderSettings();
  bg.sandSprite.visible = settings.sandBackground;
  bg.decoContainer.visible = settings.decorations;
  bg.time += dt;

  // Animate swaying decorations (algae, coral)
  if (settings.decorations) {
    for (const deco of bg.swayingDecos) {
      // Smooth sinusoidal sway using skew.x (leans left/right from base)
      const phase = deco.seed * 1.7;
      deco.sprite.skew.x = Math.sin(bg.time * deco.speed + phase) * deco.amplitude;
    }
  }

  updateAmbientParticles(bg.ambientParticles, dt);
  updateLightRays(bg.lightRays, dt);
}
