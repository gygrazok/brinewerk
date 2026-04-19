# Tranche 3 — Opportunistic Refactors

> **For agentic workers:** This is a **backlog**, not a linear plan. Each item is a self-contained refactor triggered when you next touch the affected area. Pick up an item only when a new feature or bugfix brings you into that code — don't schedule a dedicated session for these.

**Goal:** Gradually reduce duplication and structural debt flagged in the 2026-04-19 review, without blocking feature work on a big-bang refactor.

**Architecture principle:** *Boy-scout rule* — when a feature lands in one of these areas, apply the relevant refactor in the same branch as the feature, in a separate preceding commit. Keeps each change focused and bisect-friendly.

**Branching:** Each item can be done on the feature branch that triggers it, or on a dedicated `refactor/<item>` branch if pursued standalone. No single tranche-3 branch.

---

## Item A: Extract `ui/modal.ts` helper

**Trigger:** Next time you add a new modal, or touch two of { `shore-modal.ts`, `upgrade-modal.ts`, `achievement-modal.ts`, `creature-panel.ts` } in the same change.

**Duplication:** All four modals reimplement: `modalOpen` flag, `AbortController` lifecycle, overlay/panel DOM creation, `.open` class + 250–300 ms `setTimeout` teardown, responsive `@media 641px` CSS, `injectStyles()`.

**Proposed API:**
```ts
// src/ui/modal.ts
export interface ModalController {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  destroy(): void;
}
export function createModal(opts: {
  id: string;
  title: string;
  render: (body: HTMLElement) => void;
  onClose?: () => void;
}): ModalController;
```

**Steps:** Implement helper → migrate one modal as proof → migrate the others one at a time in follow-up commits.

**Validation:** Open/close animation identical, escape-key still closes, no listener leaks under HMR.

---

## Item B: Extract body-pixel helper for creature renderers

**Trigger:** Next time you add a new creature type or modify the body pattern logic in one of the 4 existing renderers.

**Duplication:** `stellarid.ts`, `blobid.ts`, `corallid.ts`, `nucleid.ts` all share the preamble (`getPalette(p1,p2)`, `size`, `fatness`, `pattern`, `wobble` derived from genes) and a tri-branch pattern-gated body fill.

**Proposed API:** in `pixel-grid.ts` or a new `rendering/body-fill.ts`:
```ts
export function buildBodyPixel(
  dx: number,
  dy: number,
  seed: number,
  pattern: PatternKind,
  pal: Palette,
  pal2: Palette,
): number; // packed RGBA or hex string, matching PixelGrid type
```

**Validation:** Each migrated renderer must produce pixel-identical output for the same genotype (can snapshot-test informally by eyeballing a seeded set of creatures).

---

## Item C: Extract `approxTerrainY` to a shared module

**Trigger:** Next time you modify depth/terrain logic in any of: `systems/coords.ts:12-26`, `rendering/seabed-bg.ts:103-113`, `systems/collectibles.ts:158-165`.

**Problem:** Layer-1 terrain profile is hand-duplicated three times with three different approximations and smoothstep variants — silent drift between "deep" classification and the actual rendered seabed is a bug waiting to happen.

**Steps:** Create `src/systems/terrain.ts` exporting `approxTerrainY(x: number, worldW: number, worldH: number): number`. Pick the most correct of the three existing implementations (the one used by `seabed-bg.ts` is the visual ground-truth). Migrate the other two call sites to import it.

**Validation:** `npm run build` + verify depth-gated slots still light up the same ones they do today, and collectibles spawn on the sand.

---

## Item D: Unify `tickProduction` and `getProductionRates`

**Trigger:** Next time you change a production rule (new resource, new upgrade, depth-gated yield change).

**Problem:** `src/economy/production-engine.ts` has ~90% overlap between the two exported functions — same loop, same upgrade lookups, same depth classification, differing only in whether to accumulate into state or return a rate snapshot.

**Proposed refactor:** Extract `perSlotYield(slot, creature, flags): ProductionRates` as a pure function. `tickProduction(state, dt)` sums and applies. `getProductionRates(state) = tickProduction(state, 0)` semantically, or a thin wrapper that doesn't mutate.

**Validation:** Before/after numerical equality on production rates; HUD shows same rates; resources accumulate at same pace.

---

## Item E: Derive `releaseUnlocked` instead of storing it

**Trigger:** Next time you add a second achievement that unlocks a feature, OR when the next save-migration is being written anyway.

**Problem:** `state.releaseUnlocked` duplicates `state.achievements['tide_pool_keeper']`. It will drift the instant a second feature-unlock achievement lands.

**Steps:**
1. Add selector `isReleaseUnlocked(state): boolean` in `systems/achievements.ts` or a new `systems/unlocks.ts`.
2. Replace all reads of `state.releaseUnlocked` with the selector.
3. Bump `CURRENT_SAVE_VERSION` (v11 → v12), add migration that drops `releaseUnlocked` from the state object.
4. Remove the field from `GameState` interface.

**Validation:** Achievements screen still works, release button still gates correctly, old saves load and strip the field cleanly.

---

## Item F: Switch `state.creatures` to `Record<string, Creature>`

**Trigger:** Next time you hit an O(n) `state.creatures.find(c => c.id === …)` bug, or when pool-view gets touched for a new interaction (multi-select, breeding, etc.).

**Problem:** Flat array forces O(n) `.find()` in hot paths. The production engine's lookup cache keyed on `state.creatures.length` will silently fail under swap-in-place semantics.

**Steps:**
1. Change `GameState.creatures: Creature[]` → `creatures: Record<string, Creature>`.
2. Migrate all call sites — `.find(c => c.id === id)` becomes `creatures[id]`; iteration becomes `Object.values(creatures)`.
3. Delete `cachedMap` machinery in `production-engine.ts`.
4. Save migration v12 (or whatever's current) to convert array → record on load.
5. Audit `shore` and `pool.slots[].creatureId` references — those stay as IDs, just read through the record.

**Validation:** Build + place/release/swap loop tested manually. Saves round-trip correctly.

**Risk:** Medium. Touches 10+ files. Keep it as a single PR, bisect-friendly.

---

## Item G: Split `pool-view.ts`

**Trigger:** Next time you add a new pool interaction (multi-select, drag-and-drop breeding, zoom gesture changes) or hit a bug in pan/zoom/slot-draw.

**Problem:** 836-line file with viewport, input (pointer+touch+wheel), drag/drop, slot drawing, slot glow, cost text, camera pan animation, creature sync, and viewport culling all mixed.

**Proposed split:**
- `src/ui/pool-view/input.ts` — pointer+touch+wheel
- `src/ui/pool-view/camera.ts` — pan/clamp/zoom math + animation
- `src/ui/pool-view/slot-graphics.ts` — draw/highlight/lock/cost
- `src/ui/pool-view/sync.ts` — `syncPoolVisuals` / `syncSlotGlow`
- `src/ui/pool-view/index.ts` — orchestrator, public `PoolView` surface

**Side benefit:** Fix the `main.ts:137` leak (`poolView._collectibleLayer.addChild(...)`) by exposing an official `addOverlay(layer)` method.

**Validation:** Manual smoke test of all pool interactions post-split — no behavior change expected.

---

## Item H: Movement-rare pivot registry

**Trigger:** Next time you add a rare effect with non-standard pivoting, OR when touching any of the 3 call sites.

**Problem:** `'rotating' | 'pulse' | 'tiny' | 'upside-down'` string-matched identically in `pool-view.ts:584,604`, `creature-renderer.ts:175-206`, `creature-preview.ts:58-73`. Adding a movement rare requires editing 3 files.

**Proposed registry:** Add a `pivotMode?: 'center' | 'bottom' | 'inverted' | 'scaled'` field on `RareInfo` (in the existing `RARE_EFFECTS` table). All three call sites read from `getRareInfo(rare).pivotMode` instead of matching strings.

**Validation:** Rotating/pulse/tiny/upside-down still visually pivot as they do today.

---

## Item I: Hardcoded creature types in debug menu

**Trigger:** Next time you add a new `CreatureType`, OR next time you touch `debug-menu.ts`.

**Problem:** `src/ui/debug-menu.ts:70-75` hardcodes `<option value="stellarid">` etc. in an HTML string. Adding a new type silently forgets to expose it in debug.

**Fix:** Populate the `<select>` with `Object.values(CreatureType).map(t => \`<option value="${t}">${CREATURE_NAMES[t]}</option>\`).join('')` — pattern already used for the rare dropdown below it.

**Validation:** Debug menu lists all types, including any newly-added one.

---

## Item J: Runtime validation on `loadState`

**Trigger:** Next time a save-format bug wastes debugging time, OR when investigating a reported NaN.

**Problem:** `src/core/game-state.ts:272` does `return data as unknown as GameState` after a shallow key-presence check only. Corrupted saves produce mysterious NaNs downstream.

**Fix:** Validate critical invariants before returning: `pool.slots` is an object keyed by slot id, each `creature.genes` has expected numeric fields, etc. On failure: log, fall back to default state. Don't install a full schema validator — just the fields whose corruption is noisy.

**Validation:** Normal saves load fine. Hand-edited broken save in devtools triggers the fallback cleanly.

---

## Triage hints

If you have an unrelated feature to build and want to knock out one of these cheaply:

| Feature area | Cheap item(s) to bundle |
|--------------|-------------------------|
| New modal (settings, stats, etc.) | A |
| New creature type | B, I |
| Terrain / depth change | C |
| Production balance tweak | D |
| Any achievement work | E |
| Any pool interaction work | F (maybe), G |
| New rare effect | H |
| Save format change | E (free migration piggyback), J |

---

## Deliberately not in this backlog

- HUD innerHTML thrash and other perf items → Tranche 2 (dedicated perf work)
- Dead code removals → Tranche 1 (already done)
- Documentation rewrites
- New features (this is a cleanup backlog, not a roadmap)
