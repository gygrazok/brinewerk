/**
 * Shared terrain silhouette approximations.
 *
 * Used to be hand-duplicated in coords.ts (slot depth classification),
 * collectibles.ts (coral spawn placement), and seabed-bg.ts (visual render).
 * Drift between them risked mis-classifying slot depth or spawning corals
 * inside the visual terrain — centralising the formula prevents that.
 */

/**
 * Base y-coordinate of the upper terrain silhouette (layer 1), in world pixels.
 *
 * Does NOT include per-seed wave noise — that only matters for visuals, and
 * gameplay code needs a deterministic answer. `seabed-bg.ts` adds its wave
 * on top of this base when rendering.
 */
export function baseLayer1TerrainY(x: number, worldW: number, worldH: number): number {
  const t = x / worldW;
  let edge = 0;
  if (t < 0.3) edge = 1 - t / 0.3;
  else if (t > 0.7) edge = (t - 0.7) / 0.3;
  const smooth = edge * edge * (3 - 2 * edge);
  return (0.80 - smooth * 0.25) * worldH;
}
