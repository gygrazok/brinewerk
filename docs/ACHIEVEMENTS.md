# Achievements

Data-driven registry in `src/systems/achievements.ts`. Each achievement is one
entry in `ACHIEVEMENTS[]`; the game loop polls all unmet conditions once per
second. No per-achievement code wiring is required.

## Adding a new achievement

Append to `ACHIEVEMENTS` in `src/systems/achievements.ts`:

```ts
{
  id: 'nacre_hoarder',                           // stable string key, stored in save
  name: 'Nacre Hoarder',
  description: 'Accumulate 1000 nacre',
  icon: '⚬',
  condition: (state) => state.resources.nacre >= 1000,
  reward: { type: 'bonus', label: '+10% nacre from release' },
}
```

Fields:
- `id` — **immutable**. It ends up in `state.achievements[id]` on every save. Renaming breaks saves.
- `condition(state)` — must be **pure and cheap** (see performance below). Runs at ~1 Hz.
- `reward` — display-only in the achievement modal. Any gameplay effect must be read via a selector (see feature-unlock pattern below).
- `onComplete(state)` — optional, fires exactly once when a condition first becomes true. Use only for non-derivable side effects (e.g. spawning a congratulatory coral).

### Do not use `onComplete` to mirror the completed state into another field

Duplicating `state.achievements[id]` into a `someFeatureUnlocked: boolean` on
`GameState` creates drift the instant a second feature-unlock ships. The
`state.releaseUnlocked` field existed from v5 to v12 and was always redundant
with `state.achievements.tide_pool_keeper`. See the feature-unlock pattern
below for the correct shape.

## Trigger: polling, not events

Checked from `src/core/game-loop.ts` via a 1-second accumulator:

```ts
achievementTimer += deltaSec;
if (achievementTimer >= 1) {
  achievementTimer = 0;
  const newAchievements = checkAchievements(state);
  if (newAchievements.length > 0) onAchievementCallbacks.forEach((cb) => cb(newAchievements));
}
```

`checkAchievements` skips already-completed ones (idempotent) and returns the
newly-completed list for the game loop to forward to the toast + modal UI.

### Why polling for this game

| | Polling (current) | Event-based |
|-|-|-|
| Add a new achievement | One entry in `ACHIEVEMENTS[]` | Identify + emit event at every relevant gameplay site |
| Retroactive on save load | Works automatically on next tick | Requires replaying or explicit re-check on load |
| Compound conditions | `a && b && c` in predicate | Explicit state accumulation per event |
| Time-based conditions | Natural (`totalPlaytime > 3600`) | Requires internal timer anyway |
| Latency | Up to 1 s | Instant |
| CPU cost | O(conditions) per second on a tiny state | O(1) per matching event |

For an idle game with ~20-ish achievements and a small state (~50 creatures
max), the CPU cost is negligible and the 1 s latency is imperceptible on a
toast. Polling wins on developer ergonomics. Keep it.

### When to switch to event-based or hybrid

Only when one of these actually hurts:

- A condition requires historical tracking that isn't in state (e.g. "three
  rare pickups in a row without missing one"). Solution is hybrid: increment a
  counter in state at the event, keep the `>=` check in the polled `condition`.
- Profiler shows `checkAchievements` as hot. Unlikely at this scale.
- A condition is a derived counter expensive to recompute (iterating thousands
  of items). Store the counter in state, increment at the source event, read in
  `condition` as a cheap numeric comparison.

## Feature-unlock pattern

When an achievement unlocks a feature, store only in `state.achievements` and
expose a named selector — **do not add a boolean to `GameState`**.

```ts
// systems/achievements.ts
export const RELEASE_UNLOCK_ACHIEVEMENT_ID = 'tide_pool_keeper';

export function isReleaseUnlocked(state: GameState): boolean {
  return state.achievements[RELEASE_UNLOCK_ACHIEVEMENT_ID] === true;
}
```

Consumers read through the selector:

```ts
// ui/hud.ts — nacre visibility
{ key: 'nacre', icon: '⚬', visible: (s) => isReleaseUnlocked(s) },

// main.ts — panel gating
const panelOpts = { releaseUnlocked: isReleaseUnlocked(state), ... };
```

The achievement definition needs no `onComplete` — the entry in
`state.achievements` is the source of truth. Zero-cost, no drift, no save
migration needed when adding another unlock (the achievement id is already
persisted).

## Performance: keep `condition()` cheap

Polled at 1 Hz. Acceptable:

- Arithmetic on primitive state fields (`state.resources.coral >= 500`)
- `Object.values(...).filter(...).length` over pool slots (≤25) or achievements
- Short `Array.some` / `Array.every` on `state.creatures` while it stays small

Avoid:

- Iterating historical logs / unbounded arrays — accumulate a counter instead.
- Deep object walks, regex over long strings, JSON parsing — keep these out.
- Calling expensive selectors (`getProductionRates`, full pool scans) from
  within `condition`. If you need them, cache the derived value in state at
  the point it mutates (e.g. inside `tickProduction`).

### Counter pattern for "lifetime X" achievements

Don't compute `totalCreaturesEverSpawned` by counting arrays — it doesn't
survive shore discards. Add a field to `GameState`, bump the save version,
and increment at the spawn site:

```ts
// game-state.ts
totalCreaturesSpawned: number;   // monotonic counter

// tides.ts (or wherever creatures are minted)
state.totalCreaturesSpawned += 1;

// achievements.ts
{
  id: 'collector',
  condition: (s) => s.totalCreaturesSpawned >= 100,
  ...
}
```

The increment is effectively event-based; the check stays poll-based. Best of
both.

## Save format

- `state.achievements: Record<string, boolean>` — added in save v10.
- v9 → v10 migration mirrored the legacy `releaseUnlocked` flag into
  `achievements.tide_pool_keeper`.
- v11 → v12 migration dropped the legacy flag entirely; `isReleaseUnlocked`
  reads from `achievements` only.

When adding achievements that introduce new state fields (e.g. lifetime
counters): bump `CURRENT_SAVE_VERSION` and add a migration step that
initialises the field to 0 for existing saves. See the pattern in
`src/core/game-state.ts` → `migrateState`.

## UI integration

- **Toast**: `src/ui/achievement-toast.ts`, triggered by `onAchievement`
  callback registered in `main.ts`. Fire-and-forget, auto-dismisses.
- **Modal**: `src/ui/achievement-modal.ts`, opened from the bottom bar
  achievements button. Rebuilds card list from `ACHIEVEMENTS[]` on every
  open; re-renders when `updateAchievementModal(state)` is called each
  second while visible.

No wiring is required for a new achievement — both surfaces discover it
through `ACHIEVEMENTS[]` automatically.
