# Tranche 2 — Performance: Pixel Grid Hot Path

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Validation command is `npm run build`. Manual perf validation via `npm run dev` + browser devtools Performance tab, sampling the render loop with ~50 creatures placed.

**Goal:** Verify and (if confirmed) eliminate the per-frame pixel-grid regeneration in `updateCreatureVisual`, which the 2026-04-19 review flagged as the biggest framerate hotspot for the 50-creatures-at-60fps target.

**Architecture:** Cache the base pixel grid on each creature visual at creation time. Per-frame work shrinks to: (1) running rare-effect overlays on a copy of the cached grid, (2) writing into a persistent `ImageData` tied to the visual, (3) skipping the GPU reupload entirely for creatures whose shader-less rare did not mutate the grid this frame. Secondarily, replace the `Record<string,string>` grid representation with a packed typed array to remove per-pixel string allocations inside effects.

**Tech Stack:** TypeScript, PixiJS v8, GLSL filters. Browser-side DevTools for perf validation. No unit tests (project convention).

**Branch:** `perf/pixel-grid-hotpath` (created by executor before Task 1 — separate branch from Tranche 1).

**Risk level:** Medium-high — touches rendering hot path and all pixel-effect modules. Each task ends in a build + manual visual smoke test. Keep commits small so bisect is cheap.

---

## Task 1: Validate the claim (profile before optimizing)

**Files:**
- Read-only: `src/rendering/creature-renderer.ts:139-160`
- Read-only: `src/rendering/pixel-grid.ts:88`
- Read-only: `src/rendering/effects/*.ts`

Do not refactor before confirming. It's possible the agent misread the hot path.

- [ ] **Step 1**: Read `updateCreatureVisual` in `src/rendering/creature-renderer.ts` end-to-end. Trace: is a fresh `PixelGrid` built every call? Is `renderGridToCanvas` called every call? Is `texture.source.update()` called every call?
- [ ] **Step 2**: Read `renderGridToCanvas` in `src/rendering/pixel-grid.ts`. Confirm whether it allocates a new `ImageData` each invocation.
- [ ] **Step 3**: Open `npm run dev` in a browser. With ~20+ creatures placed, open DevTools → Performance, record 5 seconds of steady-state gameplay. Look at the top self-time entries under the render tick. Note the top 3 self-time functions in the plan (write them here for reference before proceeding).
- [ ] **Step 4**: Decide:
  - If the hot path matches the claim: continue to Task 2.
  - If not: **stop here**. Write findings in `docs/superpowers/plans/2026-04-19-tranche-2-findings.md`, commit, and close the branch. The other Tranche 2 tasks are only worth doing if the hypothesis is confirmed.

## Task 2: Cache base pixel grid on creature visual

**Files:**
- Modify: `src/rendering/creature-renderer.ts`

Add a `baseGrid` field on the per-creature visual structure. Populate at creation (first `updateCreatureVisual` call or a new `createCreatureVisual`), reuse every subsequent frame.

- [ ] **Step 1**: Locate the visual struct/interface that `updateCreatureVisual` mutates (likely called `CreatureVisual` or similar — grep its definition). Add a nullable field:
  ```ts
  baseGrid?: PixelGrid;
  ```
- [ ] **Step 2**: At the top of `updateCreatureVisual`, before any pixel work:
  ```ts
  if (!visual.baseGrid) {
    visual.baseGrid = buildPixelGridForCreature(creature);
  }
  ```
  `buildPixelGridForCreature` is whatever function currently produces the grid — extract it if it's inline.
- [ ] **Step 3**: Replace the per-frame grid build with a shallow copy of `visual.baseGrid`, because rare effects mutate in place:
  ```ts
  const grid: PixelGrid = { ...visual.baseGrid };
  ```
  (If `PixelGrid` shape changes in Task 5, revisit this copy strategy.)
- [ ] **Step 4**: Run `npm run build`. Run `npm run dev`, place a handful of creatures of each type, verify visuals render identically to `main`.
- [ ] **Step 5**: Commit: `perf(render): cache base pixel grid per creature visual`.

## Task 3: Reuse a single `ImageData` per visual

**Files:**
- Modify: `src/rendering/pixel-grid.ts` (`renderGridToCanvas`)
- Modify: `src/rendering/creature-renderer.ts`

Every `renderGridToCanvas` call currently allocates a fresh `Uint8ClampedArray(BLOCK_PX*BLOCK_PX*4)` via `createImageData`. Attach one `ImageData` to the visual and mutate its buffer in place.

- [ ] **Step 1**: Add to the visual struct:
  ```ts
  imageData?: ImageData;
  ```
- [ ] **Step 2**: Change `renderGridToCanvas` signature to accept an optional reusable buffer:
  ```ts
  export function renderGridToCanvas(
    grid: PixelGrid,
    ctx: CanvasRenderingContext2D,
    imageData?: ImageData,
  ): ImageData {
    // existing logic, but when imageData is provided, overwrite its .data in place instead of creating new
  }
  ```
  Return the `ImageData` so the caller can cache it on first use.
- [ ] **Step 3**: In `updateCreatureVisual`, pass `visual.imageData` in and capture the returned value back into `visual.imageData`.
- [ ] **Step 4**: Run `npm run build`. Smoke-test in browser. Confirm no visual regressions on rare-effect creatures (fire/frost/toxic/electric/shadow).
- [ ] **Step 5**: Commit: `perf(render): reuse ImageData buffer per creature visual`.

## Task 4: Skip `texture.source.update()` when grid didn't change

**Files:**
- Modify: `src/rendering/creature-renderer.ts`
- Read-only: `src/rendering/effects/*.ts`

Many creatures have no rare or a shader-driven rare — their base grid never changes after caching. The GPU reupload for those is pure waste.

- [ ] **Step 1**: Classify rare effects into `MUTATES_GRID` vs `NO_MUTATE`. Pixel-level effects (frost, toxic, electric, shadow, and anything else under `src/rendering/effects/`) mutate. Shader-based rares do not. Add a small registry next to `TYPE_RENDERERS`:
  ```ts
  const GRID_MUTATING_RARES: ReadonlySet<RareEffect> = new Set([
    'frost', 'toxic', 'electric', 'shadow', /* whichever else */
  ]);
  ```
- [ ] **Step 2**: In `updateCreatureVisual`, only regenerate/reupload when `creature.rare && GRID_MUTATING_RARES.has(creature.rare)`. For all other creatures, upload once on first paint, then skip.
- [ ] **Step 3**: Add a `visual.textureUploaded: boolean` flag so the first-paint upload still happens once.
- [ ] **Step 4**: Run `npm run build`. In browser, verify:
  - Plain (non-rare) creature renders correctly and stays rendered over time.
  - Shader rares (whichever are still present after cleanup — check `RareEffect` union) animate correctly via GPU shader.
  - Grid-mutating rares (frost/toxic/etc.) still animate.
- [ ] **Step 5**: Commit: `perf(render): skip texture reupload for static-grid creatures`.

## Task 5 (optional, larger): Pack `PixelGrid` into a typed array

**Files:**
- Modify: `src/rendering/pixel-grid.ts` (`PixelGrid` type, `setPixel`, helpers, `renderGridToCanvas`)
- Modify: All files in `src/rendering/effects/*.ts`
- Modify: All files in `src/rendering/types/*.ts`

`PixelGrid = Record<string, string>` with `"x,y"` keys allocates a template string in every `setPixel` and forces `key.split(',').map(Number)` in every effect. Replace with a packed int layout.

**Only undertake if Task 1-4 profiling still shows pixel-effect iteration as a top offender.** This touches every creature renderer and every effect, so it's the largest task.

- [ ] **Step 1**: Define new `PixelGrid`:
  ```ts
  export interface PixelGrid {
    width: number;
    height: number;
    /** packed RGBA; 0 = transparent/absent */
    data: Uint32Array;
  }
  export function setPixel(g: PixelGrid, x: number, y: number, rgba: number): void {
    g.data[y * g.width + x] = rgba;
  }
  export function getPixel(g: PixelGrid, x: number, y: number): number {
    return g.data[y * g.width + x];
  }
  ```
- [ ] **Step 2**: Migrate each `src/rendering/types/*.ts` renderer to use the new API — they currently call `setPixel(grid, x, y, colorHex)`; convert the hex to packed RGBA once per renderer (helper `hexToRgba32`).
- [ ] **Step 3**: Migrate `renderGridToCanvas` to a tight `for` loop over `data` indices, writing directly into `imageData.data`.
- [ ] **Step 4**: Migrate each `src/rendering/effects/*.ts` to iterate `data` by index rather than `for (const key in grid)`. Remove all `key.split(',')` calls.
- [ ] **Step 5**: Run `npm run build`. Smoke-test every creature type and every rare effect in browser. This is the highest-risk visual regression window — eyeball carefully.
- [ ] **Step 6**: Commit: `perf(render): pack PixelGrid into Uint32Array, remove string keys`.

## Task 6: Fix HUD innerHTML thrash

**Files:**
- Modify: `src/ui/hud.ts` (`updateHud`, ~line 36)
- Modify: `src/ui/shore-modal.ts` (`renderShoreButton`, ~line 65)

`updateHud` replaces `resList.innerHTML` every tick (1 Hz), which forces DOM re-parse and layout. Same with the shore button.

- [ ] **Step 1**: In `hud.ts`, build the resource row DOM once on first call, cache `<span class="res-value">` and `<span class="res-rate">` refs per resource key on a module-level `Map<ResourceKey, {value: HTMLElement; rate: HTMLElement}>`. On subsequent calls, only set `textContent`.
- [ ] **Step 2**: Apply the same pattern to `renderShoreButton` — mount once from `main.ts:init`, then `renderShoreButton(state)` only updates textContent.
- [ ] **Step 3**: Run `npm run build`. Smoke-test: resources tick up correctly, shore button count updates on tide arrivals.
- [ ] **Step 4**: Commit: `perf(ui): cache HUD DOM refs, avoid innerHTML thrash`.

## Task 7: Final validation

- [ ] **Step 1**: Re-run the browser profile from Task 1, Step 3. Compare top self-time entries. Document the before/after in the commit message of the final commit (or a short `PERF-NOTES.md` if changes are extensive).
- [ ] **Step 2**: `npm run build` one final time. No warnings.
- [ ] **Step 3**: Confirm `main` still works by checking out `main` briefly, running dev, then returning to branch — sanity check that regressions are on-branch only.
- [ ] **Step 4**: Do not merge automatically — surface PR-readiness to user for review.

---

## Out of scope for this tranche

- Modal helper, approxTerrainY extraction, creatures Map, pool-view split → Tranche 3
- `unlockedSlots()` array allocation caching (medium-impact, low-frequency) → defer unless profile flags it

## Rollback plan

Each task ends in a standalone commit. If any regression is spotted post-merge, revert the specific commit — tasks 2/3/4 are stacked but each is self-contained (adding a field then using it).
