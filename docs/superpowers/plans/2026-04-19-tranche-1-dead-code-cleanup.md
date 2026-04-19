# Tranche 1 — Dead Code Cleanup

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Validation command is `npm run build` (project has no test framework per CLAUDE.md).

**Goal:** Remove confirmed-dead exports, orphan shader files, and legacy API shims surfaced by the 2026-04-19 code review, before adding new features.

**Architecture:** Pure deletions plus one call-site migration. No behavior changes, no save format changes, no new dependencies. Validation: `tsc && vite build` (via `npm run build`) must pass clean.

**Tech Stack:** TypeScript (strict), Vite, PixiJS — no tests to update because there's no test framework.

**Branch:** `chore/code-cleanup-tranche-1` (created by executor before Task 1).

---

## Task 1: Drop unused exports in `systems/coords.ts`

**Files:**
- Modify: `src/systems/coords.ts`

Confirmed zero importers via grep for `slotCount`, `getNextUnlockableSlots`, `getNearbySlots`.

- [ ] **Step 1**: Open `src/systems/coords.ts`, delete the three functions `slotCount` (~line 49), `getNextUnlockableSlots` (~line 54), `getNearbySlots` (~line 62) and any now-unused imports they pulled in.
- [ ] **Step 2**: Run `npm run build`. Expected: PASS.
- [ ] **Step 3**: Stage only `src/systems/coords.ts`.

## Task 2: Drop unused exports in genetics/traits, achievements, production, pixel-grid

**Files:**
- Modify: `src/genetics/traits.ts`
- Modify: `src/systems/achievements.ts`
- Modify: `src/economy/production-engine.ts`
- Modify: `src/rendering/pixel-grid.ts`

- [ ] **Step 1**: Delete `export const PALETTE_TRAITS` in `src/genetics/traits.ts:13`.
- [ ] **Step 2**: Delete `export function isAchievementCompleted` in `src/systems/achievements.ts:67`.
- [ ] **Step 3**: Delete `export function getTotalProductionRate` in `src/economy/production-engine.ts:97`.
- [ ] **Step 4**: Delete `export function fillEllipse` in `src/rendering/pixel-grid.ts:36`. (Keep `setPixel`, `spatialRandom` re-export, and the rest — only `fillEllipse` is dead.)
- [ ] **Step 5**: Run `npm run build`. Expected: PASS. If any import breaks, it means the grep missed something — restore the symbol and skip that deletion.

## Task 3: Remove render-settings preset machinery

**Files:**
- Modify: `src/rendering/render-settings.ts`

The preset API (`setRenderSetting`, `applyPreset`, `RenderPreset`, `PRESETS`) is never invoked — only `loadRenderSettings` and `getRenderSettings` are used.

- [ ] **Step 1**: In `src/rendering/render-settings.ts`, delete:
  - `export type RenderPreset` (~line 25)
  - `const PRESETS` (~line 27)
  - `export function setRenderSetting` (~line 47)
  - `export function applyPreset` (~line 52)
- [ ] **Step 2**: Run `npm run build`. Expected: PASS.

## Task 4: Delete orphan shader files

**Files:**
- Delete: `src/rendering/shaders/glow.glsl`
- Delete: `src/rendering/shaders/outline.glsl`

Confirmed neither file is referenced anywhere in `src/` (not in `shader-loader.ts`, not in `RareEffect` union).

- [ ] **Step 1**: Delete `src/rendering/shaders/glow.glsl`.
- [ ] **Step 2**: Delete `src/rendering/shaders/outline.glsl`.
- [ ] **Step 3**: Run `npm run build`. Expected: PASS (Vite GLSL plugin only bundles what's imported).

## Task 5: Un-export internal-only seabed background helpers

**Files:**
- Modify: `src/rendering/seabed-bg.ts`

`createAmbientParticles`, `updateAmbientParticles`, `createLightRays`, `updateLightRays` are called only inside the same file. Dropping `export` tightens the module surface without changing behavior.

- [ ] **Step 1**: In `src/rendering/seabed-bg.ts`, remove the `export` keyword from:
  - `createAmbientParticles` (~line 723)
  - `updateAmbientParticles` (~line 750)
  - `createLightRays` (~line 792)
  - `updateLightRays` (~line 821)
- [ ] **Step 2**: Also drop `export` from their associated `interface` types (`AmbientParticles`, `LightRays`) if nothing outside the file references them — grep first.
- [ ] **Step 3**: Run `npm run build`. Expected: PASS. If an external import breaks, re-add `export` on the offending symbol only.

## Task 6: Remove positional overload of `createCreature`

**Files:**
- Modify: `src/creatures/creature.ts:182-216`
- Modify: `src/ui/debug-menu.ts:144`

Only one caller uses the legacy positional form (`debug-menu.ts:144`). Migrate it and simplify the signature.

- [ ] **Step 1**: In `src/ui/debug-menu.ts:144`, change
  ```ts
  const creature = createCreature(type, undefined, rare);
  ```
  to
  ```ts
  const creature = createCreature({ type, forceRare: rare });
  ```
- [ ] **Step 2**: In `src/creatures/creature.ts`, replace the `createCreature` signature + opts-normalization block (lines ~182-193) with:
  ```ts
  export function createCreature(opts: CreateCreatureOpts = {}): Creature {
    const finalSeed = opts.seed ?? ((Date.now() + _nextId * 7919) & 0x7fffffff);
  ```
  Keep the rest of the body (from `const types = ...` onward) unchanged — it already reads from `opts.*`.
- [ ] **Step 3**: Run `npm run build`. Expected: PASS.

## Task 7: Update CLAUDE.md save version reference

**Files:**
- Modify: `CLAUDE.md`

CLAUDE.md says "currently v4" but `CURRENT_SAVE_VERSION` in `game-state.ts` is 11.

- [ ] **Step 1**: In `CLAUDE.md`, find the line under "State Management": `Save versioning with migration chain (currently v4)`. Replace `v4` with `v11`.
- [ ] **Step 2**: No build step required — pure doc change.

## Task 8: Final validation and commit

- [ ] **Step 1**: Run `npm run build` once more end-to-end. Expected: PASS with no warnings beyond baseline.
- [ ] **Step 2**: Run `git diff --stat` to sanity-check the blast radius (should be ~8 files, mostly deletions).
- [ ] **Step 3**: Stage all modified files and commit:
  ```bash
  git add -u
  git commit -m "$(cat <<'EOF'
  chore: remove dead code and legacy shims (tranche 1)

  Drops unused exports (slot helpers, PALETTE_TRAITS, isAchievementCompleted,
  getTotalProductionRate, fillEllipse, render preset API), orphan shader
  files (glow.glsl, outline.glsl), positional createCreature overload, and
  un-exports internal-only seabed helpers. Also sync CLAUDE.md save version
  note (v4 -> v11).

  No behavior changes. Surfaces cleaned before upcoming features.
  EOF
  )"
  ```
- [ ] **Step 4**: Done. Do not push — user will review and push manually.

---

## Out of scope for this tranche

- Pixel grid caching / perf work → Tranche 2
- Modal helper extraction, creatures Map, pool-view split → Tranche 3
- `state.releaseUnlocked` derivation → Tranche 3 (needs save migration)
