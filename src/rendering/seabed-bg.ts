import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import { getRenderSettings } from './render-settings';
import { GRID_SIZE } from './pixel-grid';

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
 * Terrain profiles: two layers.
 * Layer 1 (upper): rocky cliff at edges, sandy shelf in center.
 * Layer 2 (lower): deeper ledge with different rock color, ~15% below layer 1.
 * Both have gentle (not jagged) undulation.
 */
function getLayer1Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.3));
  const rightP = smoothstep(Math.max(0, (t - 0.7) / 0.3));
  const plateau = Math.max(leftP, rightP);

  // Upper layer: 0.55h at corners, 0.80h at center
  const baseY = 0.80 - plateau * 0.25;
  // Gentle smooth undulation only (no per-pixel noise)
  const wave = Math.sin(x * 0.04) * 0.012 + Math.sin(x * 0.09 + 1.5) * 0.006;
  return Math.floor(h * (baseY + wave));
}

function getLayer2Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.35));
  const rightP = smoothstep(Math.max(0, (t - 0.65) / 0.35));
  const plateau = Math.max(leftP, rightP);

  // Middle layer: 0.72h at corners, 0.90h at center
  const baseY = 0.90 - plateau * 0.18;
  const wave = Math.sin(x * 0.05 + 2.0) * 0.008 + Math.sin(x * 0.12 + 0.7) * 0.005;
  return Math.floor(h * (baseY + wave));
}

function getLayer3Profile(x: number, w: number, h: number): number {
  const t = x / w;
  const leftP = smoothstep(Math.max(0, 1 - t / 0.4));
  const rightP = smoothstep(Math.max(0, (t - 0.6) / 0.4));
  const plateau = Math.max(leftP, rightP);

  // Deepest layer: 0.85h at corners, 0.96h at center
  const baseY = 0.96 - plateau * 0.11;
  const wave = Math.sin(x * 0.06 + 3.5) * 0.006 + Math.sin(x * 0.14 + 1.2) * 0.004;
  return Math.floor(h * (baseY + wave));
}

/** Create an offscreen sand texture with three-layer terrain */
export function createSandTexture(worldW: number, worldH: number): Texture {
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

function seededNoise(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// --- Pixel-art decorations ---

interface DecorationDef {
  x: number;
  y: number;
  type: 'rock' | 'coral' | 'algae' | 'shell' | 'pebbles' | 'sponge';
  size: number; // grid units — display size = size * WORLD_PX world px
  seed: number;
}

/**
 * Decoration positions for 1920×1080 seabed.
 * Grid sizes are in grid units; display size = size × 1.6 world px.
 * Sizes here are ~1.875× larger than before to compensate for smaller pixel density.
 */
const DECORATIONS: DecorationDef[] = [
  // =====================================================================
  // ROCKS — accent boulders sitting on the terrain (not the ground itself,
  // which is painted in the background texture)
  // =====================================================================
  // Left cliff accent rocks (on top of the rocky cliff)
  { x: 80,   y: 660,  type: 'rock',    size: 34, seed: 200 },
  { x: 200,  y: 720,  type: 'rock',    size: 28, seed: 201 },
  { x: 320,  y: 780,  type: 'rock',    size: 24, seed: 202 },
  { x: 50,   y: 780,  type: 'rock',    size: 30, seed: 203 },
  // Right cliff accent rocks
  { x: 1840, y: 660,  type: 'rock',    size: 34, seed: 210 },
  { x: 1700, y: 720,  type: 'rock',    size: 28, seed: 211 },
  { x: 1580, y: 780,  type: 'rock',    size: 24, seed: 212 },
  { x: 1870, y: 780,  type: 'rock',    size: 30, seed: 213 },
  // Mid-floor scattered boulders
  { x: 700,  y: 920,  type: 'rock',    size: 20, seed: 1 },
  { x: 1200, y: 940,  type: 'rock',    size: 22, seed: 4 },
  { x: 960,  y: 960,  type: 'rock',    size: 18, seed: 5 },

  // =====================================================================
  // PEBBLE CLUSTERS — on the sandy floor
  // =====================================================================
  { x: 500,  y: 960,  type: 'pebbles', size: 14, seed: 40 },
  { x: 800,  y: 980,  type: 'pebbles', size: 12, seed: 42 },
  { x: 1100, y: 960,  type: 'pebbles', size: 14, seed: 45 },
  { x: 1400, y: 970,  type: 'pebbles', size: 12, seed: 46 },
  { x: 600,  y: 1000, type: 'pebbles', size: 10, seed: 230 },
  { x: 1300, y: 1000, type: 'pebbles', size: 10, seed: 231 },

  // =====================================================================
  // SHELLS — on the sandy floor
  // =====================================================================
  { x: 680,  y: 960,  type: 'shell',   size: 12, seed: 30 },
  { x: 1050, y: 980,  type: 'shell',   size: 10, seed: 32 },
  { x: 1350, y: 950,  type: 'shell',   size: 12, seed: 33 },
  { x: 860,  y: 1000, type: 'shell',   size: 10, seed: 35 },

  // =====================================================================
  // CORALS — on cliff edges (terrain line) and rocky ledges
  // Left cliff: terrain ~y600-700, right cliff similar
  // =====================================================================
  // Left cliff corals
  { x: 120,  y: 640,  type: 'coral',   size: 24, seed: 60 },
  { x: 250,  y: 700,  type: 'coral',   size: 20, seed: 61 },
  { x: 60,   y: 700,  type: 'coral',   size: 18, seed: 63 },
  { x: 180,  y: 760,  type: 'coral',   size: 16, seed: 64 },
  { x: 350,  y: 800,  type: 'coral',   size: 22, seed: 62 },
  { x: 420,  y: 840,  type: 'coral',   size: 14, seed: 240 },
  // Right cliff corals
  { x: 1800, y: 640,  type: 'coral',   size: 22, seed: 65 },
  { x: 1680, y: 700,  type: 'coral',   size: 24, seed: 66 },
  { x: 1870, y: 700,  type: 'coral',   size: 18, seed: 68 },
  { x: 1760, y: 760,  type: 'coral',   size: 16, seed: 69 },
  { x: 1560, y: 800,  type: 'coral',   size: 20, seed: 67 },
  { x: 1500, y: 840,  type: 'coral',   size: 14, seed: 241 },
  // Sandy floor corals (sparse, smaller)
  { x: 700,  y: 920,  type: 'coral',   size: 16, seed: 70 },
  { x: 1200, y: 930,  type: 'coral',   size: 18, seed: 71 },

  // =====================================================================
  // ALGAE — rooted on cliff edges, large at corners (foreground)
  // =====================================================================
  // Left cliff algae (large, rooted at terrain line)
  { x: 40,   y: 640,  type: 'algae',   size: 56, seed: 80 },
  { x: 150,  y: 680,  type: 'algae',   size: 60, seed: 81 },
  { x: 280,  y: 740,  type: 'algae',   size: 50, seed: 82 },
  { x: 380,  y: 800,  type: 'algae',   size: 46, seed: 83 },
  { x: 90,   y: 720,  type: 'algae',   size: 54, seed: 84 },
  { x: 450,  y: 860,  type: 'algae',   size: 40, seed: 85 },
  // Right cliff algae (large, rooted at terrain line)
  { x: 1880, y: 640,  type: 'algae',   size: 56, seed: 86 },
  { x: 1750, y: 680,  type: 'algae',   size: 60, seed: 87 },
  { x: 1620, y: 740,  type: 'algae',   size: 50, seed: 88 },
  { x: 1530, y: 800,  type: 'algae',   size: 46, seed: 89 },
  { x: 1830, y: 720,  type: 'algae',   size: 54, seed: 90 },
  { x: 1460, y: 860,  type: 'algae',   size: 40, seed: 91 },
  // Sandy floor algae (smaller, sparser)
  { x: 600,  y: 920,  type: 'algae',   size: 30, seed: 92 },
  { x: 1000, y: 930,  type: 'algae',   size: 28, seed: 93 },
  { x: 1300, y: 920,  type: 'algae',   size: 26, seed: 94 },

  // =====================================================================
  // SPONGES — on layer 1 cliff faces
  // =====================================================================
  { x: 160,  y: 700,  type: 'sponge',  size: 18, seed: 100 },
  { x: 300,  y: 760,  type: 'sponge',  size: 16, seed: 101 },
  { x: 70,   y: 760,  type: 'sponge',  size: 20, seed: 102 },
  { x: 1760, y: 700,  type: 'sponge',  size: 18, seed: 103 },
  { x: 1620, y: 760,  type: 'sponge',  size: 16, seed: 104 },
  { x: 1860, y: 760,  type: 'sponge',  size: 20, seed: 105 },
  { x: 850,  y: 940,  type: 'sponge',  size: 12, seed: 109 },

  // =====================================================================
  // LAYER 2 DECORATIONS — on the lower ledge
  // Layer 2 terrain: ~y780 at edges, ~y1000 at center
  // =====================================================================

  // Layer 2 rocks (accent boulders on the lower ledge)
  { x: 100,  y: 800,  type: 'rock',    size: 26, seed: 300 },
  { x: 250,  y: 840,  type: 'rock',    size: 22, seed: 301 },
  { x: 1820, y: 800,  type: 'rock',    size: 26, seed: 302 },
  { x: 1660, y: 840,  type: 'rock',    size: 22, seed: 303 },
  { x: 600,  y: 980,  type: 'rock',    size: 18, seed: 304 },
  { x: 1300, y: 1000, type: 'rock',    size: 20, seed: 305 },

  // Layer 2 corals (on lower ledge edge, slightly different y)
  { x: 80,   y: 800,  type: 'coral',   size: 20, seed: 310 },
  { x: 200,  y: 830,  type: 'coral',   size: 18, seed: 311 },
  { x: 340,  y: 860,  type: 'coral',   size: 16, seed: 312 },
  { x: 1840, y: 800,  type: 'coral',   size: 20, seed: 313 },
  { x: 1720, y: 830,  type: 'coral',   size: 18, seed: 314 },
  { x: 1580, y: 860,  type: 'coral',   size: 16, seed: 315 },
  { x: 560,  y: 980,  type: 'coral',   size: 14, seed: 316 },
  { x: 1100, y: 1000, type: 'coral',   size: 16, seed: 317 },

  // Layer 2 algae (rooted on lower ledge, big at corners)
  { x: 50,   y: 800,  type: 'algae',   size: 50, seed: 320 },
  { x: 180,  y: 840,  type: 'algae',   size: 46, seed: 321 },
  { x: 300,  y: 870,  type: 'algae',   size: 42, seed: 322 },
  { x: 1870, y: 800,  type: 'algae',   size: 50, seed: 323 },
  { x: 1740, y: 840,  type: 'algae',   size: 46, seed: 324 },
  { x: 1600, y: 870,  type: 'algae',   size: 42, seed: 325 },
  { x: 480,  y: 960,  type: 'algae',   size: 28, seed: 326 },
  { x: 1400, y: 980,  type: 'algae',   size: 26, seed: 327 },

  // Layer 2 sponges
  { x: 140,  y: 830,  type: 'sponge',  size: 16, seed: 330 },
  { x: 370,  y: 880,  type: 'sponge',  size: 14, seed: 331 },
  { x: 1780, y: 830,  type: 'sponge',  size: 16, seed: 332 },
  { x: 1550, y: 880,  type: 'sponge',  size: 14, seed: 333 },
  { x: 750,  y: 1000, type: 'sponge',  size: 12, seed: 334 },

  // Layer 2 pebbles (on the lower sandy zone)
  { x: 500,  y: 1010, type: 'pebbles', size: 12, seed: 340 },
  { x: 900,  y: 1020, type: 'pebbles', size: 10, seed: 341 },
  { x: 1250, y: 1010, type: 'pebbles', size: 12, seed: 342 },

  // Layer 2 shells
  { x: 650,  y: 1010, type: 'shell',   size: 10, seed: 350 },
  { x: 1150, y: 1020, type: 'shell',   size: 10, seed: 351 },

  // =====================================================================
  // LAYER 3 DECORATIONS — deepest ledge
  // Layer 3 terrain: ~y920 at edges, ~y1040 at center
  // =====================================================================

  // Layer 3 rocks
  { x: 120,  y: 930,  type: 'rock',    size: 24, seed: 400 },
  { x: 280,  y: 950,  type: 'rock',    size: 20, seed: 401 },
  { x: 1800, y: 930,  type: 'rock',    size: 24, seed: 402 },
  { x: 1640, y: 950,  type: 'rock',    size: 20, seed: 403 },
  { x: 700,  y: 1050, type: 'rock',    size: 16, seed: 404 },
  { x: 1200, y: 1050, type: 'rock',    size: 18, seed: 405 },

  // Layer 3 corals (deep, encrusted)
  { x: 100,  y: 930,  type: 'coral',   size: 18, seed: 410 },
  { x: 240,  y: 960,  type: 'coral',   size: 16, seed: 411 },
  { x: 1820, y: 930,  type: 'coral',   size: 18, seed: 412 },
  { x: 1680, y: 960,  type: 'coral',   size: 16, seed: 413 },
  { x: 800,  y: 1050, type: 'coral',   size: 12, seed: 414 },

  // Layer 3 algae (deep, smaller)
  { x: 60,   y: 940,  type: 'algae',   size: 42, seed: 420 },
  { x: 200,  y: 960,  type: 'algae',   size: 38, seed: 421 },
  { x: 350,  y: 980,  type: 'algae',   size: 34, seed: 422 },
  { x: 1860, y: 940,  type: 'algae',   size: 42, seed: 423 },
  { x: 1720, y: 960,  type: 'algae',   size: 38, seed: 424 },
  { x: 1560, y: 980,  type: 'algae',   size: 34, seed: 425 },
  { x: 550,  y: 1050, type: 'algae',   size: 24, seed: 426 },
  { x: 1350, y: 1050, type: 'algae',   size: 22, seed: 427 },

  // Layer 3 sponges
  { x: 160,  y: 950,  type: 'sponge',  size: 14, seed: 430 },
  { x: 1760, y: 950,  type: 'sponge',  size: 14, seed: 431 },
  { x: 950,  y: 1060, type: 'sponge',  size: 10, seed: 432 },
];

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

export interface AmbientParticles {
  particles: Particle[];
  gfx: Graphics;
  worldW: number;
  worldH: number;
}

const MAX_PARTICLES = 80;

export function createAmbientParticles(worldW: number, worldH: number): AmbientParticles {
  const gfx = new Graphics();
  const particles: Particle[] = [];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push(spawnParticle(worldW, worldH, true));
  }

  return { particles, gfx, worldW, worldH };
}

function spawnParticle(worldW: number, worldH: number, randomY: boolean): Particle {
  return {
    x: Math.random() * worldW,
    y: randomY ? Math.random() * worldH : worldH + Math.random() * 40,
    vx: (Math.random() - 0.5) * 12,
    vy: -(8 + Math.random() * 18),
    size: 2 + Math.random() * 3,
    alpha: 0.3 + Math.random() * 0.35,
    life: 0,
    maxLife: 8 + Math.random() * 15,
  };
}

export function updateAmbientParticles(ap: AmbientParticles, dt: number): void {
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

export interface LightRays {
  container: Container;
  rays: Graphics[];
  time: number;
  _rayDefs: { x: number; baseX: number; w: number; angle: number; alpha: number }[];
}

export function createLightRays(): LightRays {
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

export function updateLightRays(lr: LightRays, dt: number): void {
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

export function createSeabedBackground(worldW: number, worldH: number): SeabedBackground {
  const container = new Container();
  const settings = getRenderSettings();

  // Sand layer
  const sandTex = createSandTexture(worldW, worldH);
  const sandSprite = new Sprite(sandTex);
  sandSprite.width = worldW;
  sandSprite.height = worldH;
  sandSprite.visible = settings.sandBackground;
  container.addChild(sandSprite);

  // Decorations layer
  const decoContainer = new Container();
  decoContainer.visible = settings.decorations;
  const swayingDecos: SwayingDeco[] = [];

  for (const def of DECORATIONS) {
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
