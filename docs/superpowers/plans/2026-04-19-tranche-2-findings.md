# Tranche 2 — Task 1 findings (code-reading validation)

**Branch:** `perf/pixel-grid-hotpath` (from `main`).

## Claim as stated in the plan
> `updateCreatureVisual` regenerates the pixel grid every frame for every on-screen creature, `renderGridToCanvas` allocates a fresh `ImageData`, and `texture.source.update()` fires every frame.

## Code reading result

**Confirmed** — `src/rendering/creature-renderer.ts:139-160`:
- Line 143-144: `renderer(genes, time, seed)` builds a new `PixelGrid` each call.
- Line 152: `renderGridToCanvas` calls `ctx.createImageData(...)` each invocation (`pixel-grid.ts:88`) — fresh `Uint8ClampedArray(BLOCK_PX*BLOCK_PX*4)` per call.
- Line 156: `visual.texture.source.update()` unconditionally.
- The comment on line 138 literally admits "re-render pixel grid every frame (like POC)".
- `ARCHITECTURE.md` claim "Pixel grid → Pixi Texture (offscreen canvas upload, **one-time**)" is aspirational/outdated.

**But there's a complication the agent missed:** grep for `time` in `src/rendering/types/*.ts` shows every renderer uses `time` to animate the grid itself:
- `stellarid.ts:21` — `Math.sin(time * 2 + i * 1.5) * wobble * 0.06` on arm angles
- `nucleid.ts:22` — `time * 0.3 * (r % 2 === 0 ? 1 : -1) * wobble * 0.2` on ring rotation
- `corallid.ts:50` — `Math.sin(time * 1.2 + ...) * wobble * 0.08` on branch sway
- `blobid.ts:44,47` — `Math.sin(time * 1.8 + ...) * wobble * 1.2` on tentacle sway

The wobble amplitude is gated by `genes.wobble` but the trig computation runs regardless. So the grid is intentionally animated — a naive "cache grid at creation" breaks wobble animation for all creatures.

## Revised strategy

| Plan task | Status | Revision |
|-----------|--------|----------|
| **T2** Cache base grid per visual | ✗ Invalid as written | Replace with conditional caching: creatures with `genes.wobble < WOBBLE_CACHE_THRESHOLD` → cache once. High-wobble creatures → regenerate but at reduced cadence (30Hz via frame-skip). |
| **T3** Reuse `ImageData` per visual | ✓ Still valid — biggest win for any creature that still regenerates | No change. This alone kills the per-frame ~28KB allocation in `renderGridToCanvas`. |
| **T4** Skip `texture.source.update()` for static | ✓ Still valid for cached-grid creatures | Applies to creatures that T2 classified as static AND don't have a grid-mutating rare effect. |
| **T5** Pack `PixelGrid` to `Uint32Array` | ✓ Still valid | Independent optimisation; cuts string-key overhead in effects and `setPixel`. Still optional/largest. |
| **T6** HUD `innerHTML` thrash | ✓ Still valid | Unrelated to pixel grid. Cheap win. |

## Proposed execution order for this branch

1. **T3 first** (lowest risk, no classification logic needed) — reuse one `ImageData` per visual. Works for both cached and regenerated creatures.
2. **T6** (orthogonal, cheap) — HUD/shore-button DOM refs.
3. **T2 revised** — add `genes.wobble < 0.05` fast path + frame-cadence throttle for the rest. `WOBBLE_CACHE_THRESHOLD` should be empirical (tune once implemented).
4. **T4 revised** — follows from T2: for cached creatures without grid-mutating rare, set `textureUploaded` once, skip thereafter.
5. **T5** (optional) — only if post-T2/T3/T4 profile still shows effect iteration as a top offender.
6. **Final browser profile** — user drives (recording a 5s steady-state gameplay sample).

## Open question for user

Do we care about wobble animation being at 60Hz? If 30Hz (or 20Hz) is visually acceptable, a simpler fix is:

> Cache base grid for ALL creatures at creation; regenerate only every 2nd or 3rd frame for creatures with non-trivial wobble; reuse the `ImageData` buffer.

This collapses T2 and T4 into a single simpler change, with one tunable: regeneration frequency. Visual testing required either way.

**Recommendation:** go with the simpler approach above unless the user insists wobble must be silky-smooth at 60Hz.
