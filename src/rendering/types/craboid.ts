import type { Genotype } from '../../creatures/creature';
import { type PixelGrid, setPixel, addEyes, fillCircle } from '../pixel-grid';
import { type BodyStyle, bodyStyle, bodyPixelColor } from '../body-style';

/**
 * Top-down crab-like creature.
 *
 * Anatomy: a wide oval shell, two claws raised forward (north), N segmented
 * legs per side extending outward, and two short eyestalks on the front of the
 * shell. 30% of craboids exhibit fiddler-style claw asymmetry (one oversized,
 * one shrunken), driven deterministically from the seed.
 *
 * Gene mapping:
 *  - `size`, `fatness`  → shell footprint and aspect ratio
 *  - `legs`             → legs per side (2..5)
 *  - `claws`            → base claw size
 *  - `spikes`           → shell-rim spikes
 *  - `pattern`          → shell fill variation + shape morph (oval → trapezoid → hex)
 *  - `wobble`           → leg scuttle + pincer open/close amplitude
 *  - `eyes`, `glow`     → handled by shared helpers / sprite-level glow
 */
export function renderCraboid(genes: Genotype, time: number, seed: number): PixelGrid {
  const grid: PixelGrid = {};
  const style = bodyStyle(genes, seed);
  const { pal, pal2, pattern, wobble } = style;
  const cx = 25, cy = 27;

  const size = 10 + Math.floor(genes.size * 12);
  const fatness = 0.3 + genes.fatness * 0.7;
  // Shell is wider on the X axis than the Y axis — typical top-down crab silhouette.
  const hw = Math.max(5, Math.round(size * 0.55 * (0.7 + fatness * 0.6)));
  const hh = Math.max(4, Math.round(size * 0.38 * (0.7 + fatness * 0.5)));
  const spikes = Math.round(genes.spikes * 3);

  const legsPerSide = 2 + Math.round(genes.legs * 3); // 2..5
  const legLen = Math.round(size * 0.55 + genes.legs * size * 0.25);

  // Claw anatomy is split into forearm (propodus stalk) and pincer (palm + fingers).
  // The `claws` gene and the fiddler asymmetry drive the *pincer* primarily —
  // that's the visual mass that gives fiddler-style craboids their signature.
  const forearmBase = size * 0.30;
  const pincerBase = size * 0.35 * (0.45 + genes.claws * 1.15);
  const pincerCap = size * 0.77;

  // Fiddler-crab asymmetry: ~30% of craboids have one oversized pincer.
  const asymRoll = (seed % 100) / 100;
  const isAsymmetric = asymRoll < 0.30;
  const bigSideRight = (seed & 1) === 0;
  const pincerBig = 2.2;
  const pincerSmall = 0.5;
  const rightPincer = Math.min(
    pincerCap,
    isAsymmetric ? pincerBase * (bigSideRight ? pincerBig : pincerSmall) : pincerBase,
  );
  const leftPincer = Math.min(
    pincerCap,
    isAsymmetric ? pincerBase * (bigSideRight ? pincerSmall : pincerBig) : pincerBase,
  );
  // Forearm barely reacts to the asymmetry — the dramatic bulk lives in the pincer.
  const rightForearm = isAsymmetric ? forearmBase * (bigSideRight ? 1.15 : 0.95) : forearmBase;
  const leftForearm = isAsymmetric ? forearmBase * (bigSideRight ? 0.95 : 1.15) : forearmBase;

  // --- Legs (behind body, drawn first) ---
  drawLegs(grid, style, cx, cy, hw, hh, legsPerSide, legLen, spikes, time);

  // --- Shell ---
  drawShell(grid, style, cx, cy, hw, hh);

  // --- Shell rim spikes ---
  if (spikes >= 1) {
    const spikeCount = 6 + spikes * 2;
    for (let i = 0; i < spikeCount; i++) {
      const a = (i / spikeCount) * Math.PI * 2;
      const sx = Math.cos(a) * hw;
      const sy = Math.sin(a) * hh;
      for (let s = 1; s <= spikes; s++) {
        const ext = 1 + s * 0.18;
        setPixel(
          grid,
          cx + Math.round(sx * ext),
          cy + Math.round(sy * ext),
          s === spikes ? pal.outline : pal2.accent,
        );
      }
    }
  }

  // --- Central ridge (very patterned shells) ---
  if (pattern >= 4) {
    for (let dy = -hh + 1; dy <= hh - 1; dy += 2) {
      setPixel(grid, cx, cy + dy, pal2.accent);
    }
  }

  // --- Claws (in front of body) ---
  drawClaw(grid, style, cx, cy, hw, hh, -1, leftForearm, leftPincer, time, wobble);
  drawClaw(grid, style, cx, cy, hw, hh, +1, rightForearm, rightPincer, time, wobble);

  // --- Eyestalks + eyes ---
  // Stalks sit at ±2 to align with addEyes' hardcoded ±2 spacing.
  const stalkBaseY = cy - Math.round(hh * 0.85);
  const stalkHeight = 2;
  const stalkTopY = stalkBaseY - stalkHeight;
  for (const stalkX of [cx - 2, cx + 2]) {
    for (let sy = 0; sy <= stalkHeight; sy++) {
      setPixel(grid, stalkX, stalkBaseY - sy, pal.outline);
    }
  }
  // addEyes places primary eyes at (cx±2, cy-1); calling with cy=stalkTopY+1 lands them on top of the stalks.
  addEyes(grid, cx, stalkTopY + 1, genes, pal);

  return grid;
}

function drawShell(
  grid: PixelGrid,
  style: BodyStyle,
  cx: number, cy: number,
  hw: number, hh: number,
): void {
  const { pattern } = style;
  const stripeHook = (_dx: number, dy: number): boolean => ((dy + 2) % 3) === 0;
  const highlightHook = (dx: number, dy: number): boolean => Math.abs(dx) < 2 && dy < 0;

  for (let dy = -hh - 1; dy <= hh + 1; dy++) {
    for (let dx = -hw - 1; dx <= hw + 1; dx++) {
      const nx = dx / hw;
      const ny = dy / hh;

      // Shell shape morphs with pattern gene:
      //  pattern < 2 → classic ellipse
      //  pattern == 2 → trapezoidal (narrower toward front)
      //  pattern >= 3 → angular, hex-ish
      let rSq: number;
      if (pattern >= 3) {
        // Approximate hexagon: |nx|*0.866 + 0.5*|ny| vs |ny|
        const hexR = Math.max(Math.abs(nx) * 0.92, Math.abs(nx) * 0.55 + Math.abs(ny) * 0.95);
        rSq = hexR * hexR;
      } else if (pattern === 2) {
        const widthFactor = 0.75 + 0.25 * ((ny + 1) / 2);
        const adjX = nx / widthFactor;
        rSq = adjX * adjX + ny * ny;
      } else {
        rSq = nx * nx + ny * ny;
      }

      if (rSq <= 1.0) {
        const edge = rSq > 0.78;
        setPixel(
          grid,
          cx + dx,
          cy + dy,
          bodyPixelColor(style, dx, dy, edge, { stripe: stripeHook, highlight: highlightHook }),
        );
      }
    }
  }
}

function drawLegs(
  grid: PixelGrid,
  style: BodyStyle,
  cx: number, cy: number,
  hw: number, hh: number,
  legsPerSide: number,
  legLen: number,
  spikes: number,
  time: number,
): void {
  const { pal, wobble } = style;

  for (const side of [-1, 1] as const) {
    for (let i = 0; i < legsPerSide; i++) {
      const t = legsPerSide === 1 ? 0.5 : i / (legsPerSide - 1);
      // Distribute leg roots from just behind the front of the shell to near the back.
      const baseDy = Math.round(-hh * 0.15 + t * hh * 1.1);
      const baseDx = Math.round(side * hw * 0.85);
      const baseX = cx + baseDx;
      const baseY = cy + baseDy;

      // Scuttling gait: opposite phase left vs right, staggered per leg index.
      const walkPhase = time * 2.4 + i * 1.3 + (side > 0 ? 0 : Math.PI);
      const sway = Math.sin(walkPhase) * wobble * 0.18;
      // Base outward angle; front legs lean forward, rear legs backward.
      const baseAngle = (side > 0 ? 0 : Math.PI) + (t - 0.5) * 0.6;
      const angle1 = baseAngle + sway;

      const seg1Len = Math.max(2, Math.round(legLen * 0.5));
      const seg2Len = Math.max(2, Math.round(legLen * 0.5));

      // First segment (thigh) — slightly thick.
      for (let s = 0; s <= seg1Len; s++) {
        const lx = baseX + Math.round(Math.cos(angle1) * s);
        const ly = baseY + Math.round(Math.sin(angle1) * s);
        setPixel(grid, lx, ly, pal.outline);
        if (s > 0 && s < seg1Len) {
          const px = baseX + Math.round(Math.cos(angle1) * s - Math.sin(angle1) * 0.7);
          const py = baseY + Math.round(Math.sin(angle1) * s + Math.cos(angle1) * 0.7);
          setPixel(grid, px, py, pal.body);
        }
      }

      const elbowX = baseX + Math.round(Math.cos(angle1) * seg1Len);
      const elbowY = baseY + Math.round(Math.sin(angle1) * seg1Len);

      // Elbow joint highlight (1 pixel).
      setPixel(grid, elbowX, elbowY, pal.accent);

      // Second segment (shin) — bends downward.
      const bend = side > 0 ? 0.9 : -0.9;
      const angle2 = angle1 + bend + Math.cos(walkPhase) * wobble * 0.08;

      for (let s = 1; s <= seg2Len; s++) {
        const lx = elbowX + Math.round(Math.cos(angle2) * s);
        const ly = elbowY + Math.round(Math.sin(angle2) * s);
        setPixel(grid, lx, ly, pal.outline);
      }

      // Optional pointed tip if spikes are pronounced.
      if (spikes >= 2) {
        const tipX = elbowX + Math.round(Math.cos(angle2) * (seg2Len + 1));
        const tipY = elbowY + Math.round(Math.sin(angle2) * (seg2Len + 1));
        setPixel(grid, tipX, tipY, pal.accent);
      }
    }
  }
}

function drawClaw(
  grid: PixelGrid,
  style: BodyStyle,
  cx: number, cy: number,
  hw: number, hh: number,
  side: -1 | 1,
  forearmLen: number,
  pincerSize: number,
  time: number,
  wobble: number,
): void {
  if (pincerSize < 1.0) return;

  // Shoulder: front corner of the shell on this side.
  const shoulderX = cx + Math.round(side * hw * 0.55);
  const shoulderY = cy - Math.round(hh * 0.45);

  // Forearm stays in the classic up-and-outward pose regardless of pincer size.
  const forearmBaseAngle = -Math.PI / 2 + side * 0.6;
  const forearmSway = Math.sin(time * 1.2 + side * 0.5) * wobble * 0.08;
  const forearmAngle = forearmBaseAngle + forearmSway;

  const fLen = Math.max(3, Math.round(forearmLen));
  const fW = Math.max(1, Math.round(forearmLen * 0.22 + pincerSize * 0.08));

  // Forearm — moderate tapered tube from shoulder to wrist.
  for (let t = 0; t <= fLen; t++) {
    const taper = 1 - (t / fLen) * 0.25;
    const w = Math.max(1, Math.round(fW * taper));
    for (let s = -w; s <= w; s++) {
      const px = shoulderX + Math.round(Math.cos(forearmAngle) * t - Math.sin(forearmAngle) * s);
      const py = shoulderY + Math.round(Math.sin(forearmAngle) * t + Math.cos(forearmAngle) * s);
      const edge = Math.abs(s) === w || t === 0;
      setPixel(grid, px, py, edge ? style.pal.outline : style.pal.body);
    }
  }

  const wristX = shoulderX + Math.round(Math.cos(forearmAngle) * fLen);
  const wristY = shoulderY + Math.round(Math.sin(forearmAngle) * fLen);

  // Pincer rotates around the wrist INWARD as it grows — big fiddler pincers
  // curl across the front of the body while the forearm stays put.
  const inwardPull = Math.min(0.9, Math.max(0, (pincerSize - 4) * 0.09));
  const pincerAngle = forearmAngle - side * inwardPull;

  // Smaller palm — a modest round "hand" that anchors the pincer.
  const palmR = Math.max(2, Math.round(pincerSize * 0.35));
  const palmCx = wristX + Math.round(Math.cos(pincerAngle) * palmR * 0.7);
  const palmCy = wristY + Math.round(Math.sin(pincerAngle) * palmR * 0.7);

  // Palm is drawn FIRST. Both fingers sit above it.
  fillCircle(grid, palmCx, palmCy, palmR, style.pal.body, style.pal.outline);

  const openPhase = time * 1.8 + side * 0.4;
  const openWobble = Math.sin(openPhase) * wobble;

  // --- Dactyl (index finger): big, curved, emerges from the OUTER edge of the palm. ---
  // Base sits on the palm rim at ~60° from the pincer axis, toward the outer perp.
  const dactylBaseAngle = pincerAngle + side * (Math.PI / 3);
  const dactylBaseX = palmCx + Math.round(Math.cos(dactylBaseAngle) * palmR);
  const dactylBaseY = palmCy + Math.round(Math.sin(dactylBaseAngle) * palmR);

  // The dactyl starts pointing roughly radially outward from the palm (so its
  // base blends with the palm edge), then curves strongly inward over its length
  // to form the hook-shaped upper jaw.
  const dactylStartAngle = dactylBaseAngle - side * 0.15;
  const dactylEndAngle = pincerAngle - side * (0.55 - openWobble * 0.12);

  const dactylLen = Math.max(5, Math.round(pincerSize * 1.0));
  const dactylBaseW = Math.max(1, Math.round(pincerSize * 0.22));
  drawCurvedFinger(
    grid, style,
    dactylBaseX, dactylBaseY,
    dactylStartAngle, dactylEndAngle,
    dactylLen, dactylBaseW,
  );

  // --- Pollex (thumb): small, emerges from the middle of the palm toward the inner side. ---
  const pollexBaseX = palmCx + Math.round(Math.cos(pincerAngle) * palmR * 0.15);
  const pollexBaseY = palmCy + Math.round(Math.sin(pincerAngle) * palmR * 0.15);
  const pollexAngle = pincerAngle - side * (0.35 - openWobble * 0.08);

  const pollexLen = Math.max(3, Math.round(pincerSize * 0.55));
  const pollexBaseW = Math.max(1, Math.round(pincerSize * 0.15));
  // Clip outlines that would fall inside the palm so no dark line shows through
  // the palm body.
  drawClippedFinger(
    grid, style,
    pollexBaseX, pollexBaseY,
    pollexAngle, pollexLen, pollexBaseW,
    palmCx, palmCy, palmR - 1,
  );
}

/**
 * Curved finger: direction interpolates linearly from `startAngle` to `endAngle`
 * along its length, walking one pixel per step. Width stays flat for the first
 * quarter (so the emergence from the palm reads as a thick finger) then tapers
 * to a 1-pixel tip. Used for the dactyl.
 */
function drawCurvedFinger(
  grid: PixelGrid,
  style: BodyStyle,
  sx: number, sy: number,
  startAngle: number, endAngle: number,
  len: number,
  baseW: number,
): void {
  const { pal, pal2 } = style;
  let x = sx;
  let y = sy;
  for (let t = 0; t <= len; t++) {
    const u = len > 0 ? t / len : 0;
    const taper = u < 0.25 ? 1.0 : Math.max(0, (1.0 - u) / 0.75);
    const w = Math.round(baseW * taper);
    const angle = startAngle + (endAngle - startAngle) * u;

    for (let s = -w; s <= w; s++) {
      const px = Math.round(x - Math.sin(angle) * s);
      const py = Math.round(y + Math.cos(angle) * s);
      const edge = Math.abs(s) === w;
      setPixel(grid, px, py, edge ? pal.outline : pal.body);
    }

    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  // Accent tip.
  setPixel(grid, Math.round(x), Math.round(y), pal2.accent);
}

/**
 * Straight tapered finger, clipped so that outline pixels falling inside a
 * given circle (the palm) are skipped — the body pixels still merge with the
 * palm body so there's no visible seam, but no dark outline cuts through the
 * palm. Used for the pollex, whose base sits inside the palm.
 */
function drawClippedFinger(
  grid: PixelGrid,
  style: BodyStyle,
  bx: number, by: number,
  angle: number,
  len: number,
  baseW: number,
  clipCx: number, clipCy: number, clipR: number,
): void {
  const { pal, pal2 } = style;
  const clipR2 = clipR * clipR;
  for (let t = 0; t <= len; t++) {
    const u = len > 0 ? t / len : 0;
    const taper = 1 - u;
    const w = Math.max(0, Math.round(baseW * taper));
    for (let s = -w; s <= w; s++) {
      const px = bx + Math.cos(angle) * t - Math.sin(angle) * s;
      const py = by + Math.sin(angle) * t + Math.cos(angle) * s;
      const edge = Math.abs(s) === w || t === len;
      const dx = px - clipCx;
      const dy = py - clipCy;
      const insideClip = dx * dx + dy * dy < clipR2;
      if (insideClip && edge) continue;
      setPixel(grid, Math.round(px), Math.round(py), edge ? pal.outline : pal.body);
    }
  }
  // Accent tip.
  const tipX = Math.round(bx + Math.cos(angle) * len);
  const tipY = Math.round(by + Math.sin(angle) * len);
  setPixel(grid, tipX, tipY, pal2.accent);
}
