# Economy & Registry

Incremental core: plankton feeds creatures, creatures produce plankton, release and
registration turn creatures into long-term progress. All constants live in
`src/core/balance.ts`; upgrade definitions in `src/systems/upgrades.ts`.

## Production

```
creature plankton/s = geneticRate × level × 2^milestones × globalMul
geneticRate         = TYPE_MUL × 2^(3·(size−0.5)) × 2^(3·(primary−0.5))
globalMul           = fertile_waters × pearl_bloom × mineral_feed × registry
```

- `primary` is the type's production gene (`PRODUCTION_GENE` in `creatures/production.ts`):
  arms, tentacles, density, facets, claws.
- Milestones (`LEVEL_MILESTONES`) double output at 10, 25, 50, 75, 100, 150, ...
- Minerite (deep slots, after Deep Drilling) and lux (shallow slots, always on) scale with
  `sqrt(level)` and the registry multiplier. Every creature produces a little lux;
  Bioluminescence multiplies it by `1 + 2 × level × glow`.
- Plankton clumps are worth `base + 2 s of passive income`, times Plankton Surge
  (`planktonClumpValue` in `economy/production-engine.ts`).

## Feeding

`systems/feeding.ts`. Level L → L+1 costs `20 × 1.22^(L−1) × rich_brine`. `quoteFeed`
supports ×N and "max affordable". The panel shows Feed / ×10 / Max.

Tuning reference (greedy simulation, 50% active collection): levels 20 at 5 min,
~50 at 1 h, plateau around 60-70 without release/registry multipliers.

## Growth stages & species materials

`systems/growth.ts`. A creature's level is capped by its stage: caps are the milestone
levels (10, 25, 50, 75, 100, 150, ... then +100). Feeding stops at the cap; a stage-up
raises it and costs `stageUpCostFor(stage)` material of the creature's own species:
1, 2, 3, 5, 8, 12, 17, 23, ... (Spicules, Gel, Calcite, Prisms, Chitin; `MATERIAL_NAMES`).

Material comes only from releasing that species and is a fixed `1 + <Species> Harvest level`
per creature, regardless of level or rarity (as candy per transfer in Pokémon GO): material
counts sacrificed duplicates, nacre repays investment. Shore creatures can be released
directly (uses the tide's pickup).

Each species has a Harvest upgrade (+1 material per release per level, nacre, 5 levels),
hidden until its "Mature <Species>" achievement: reach Lv 100 (`MATURE_LEVEL`) with that species.
Feature-unlock pattern: `isSpeciesMature(state, type)` reads `state.achievements`.
Design intent: plankton feeding stays the between-stages loop; the decision moves to
which creature gets the scarce material, and duplicates of a species gain value.

## Release (nacre)

`nacre = (level/10)² × (1 + 2·deviation) × rareTierMul × nacre_refinement`

Quadratic in level while feeding cost is exponential, so each creature has an
optimal release point. Nacre buys slots (`2 × 3^(tier−1)`) and nacre upgrades.

## Shore & rarity

Everything below lives in `systems/rarity.ts` (`getSpawnContext`) and is derived from
upgrades and the Collection; only the pity counter is stored.

- **Rare chance**: 3% + Rare Lure + Glow Lure, per creature.
- **Tiers unlock through the Collection** (`RARE_TIER_UNLOCK`): tier 2 rolls once 3 tier-1
  specimens are registered, tier 3 once 8 tier-2 specimens are. No announcement; the
  Collection shows progress toward the next locked tier.
- **Hidden pity** (`state.rarePity`): consecutive shore batches (tides and refreshes)
  without a rare. When the next batch would reach `RARE_PITY_BATCHES − Tide Omen` (8, down
  to 5) one random creature is forced rare. Not shown in the UI.
- **Unseen priority**: effects whose species × effect key was never sighted weigh ×3
  (`UNSEEN_RARE_WEIGHT`) in the effect pick.
- Refresh cost: `max(100, 30 s of income) × 2^refreshesThisTide`, reset on natural tide.
- Rare refresh: 10 coral, one random creature guaranteed rare.

## Uniques

`creatures/uniques.ts` (catalogue), `rendering/uniques/` (one hand-drawn renderer per
unique, `(time) → PixelGrid`, facing right), `systems/uniques.ts` (rolls).

- Five one-off creatures with no genotype, level or production. They only fill the
  Collection's Unique row (not part of the 125 registry slots or its multiplier).
- Each shore creature rolls `1e-5 × 100^completion` (1 in 100K at 0% Collection, 1 in 1K
  at 100%), outside pity and tier gates. A hit sets `state.shoreUnique`, which waits on the
  shore across tides until collected; collecting does not use the tide's pickup.
- Found uniques wander the pool as decorative sprites on the layer right above the seabed,
  behind slots, creatures and labels (`ui/unique-wanderers.ts`).

## Zoological registry

`systems/registry.ts`, UI in `ui/registry-modal.ts`. Player-facing name: **Collection**
(code identifiers keep `registry`).

- One slot per `type:rare` key (`common` for no effect): 125 slots. `REGISTRY_SLOTS`
  is built from `raresForType`, so type-restricted effects are respected automatically.
- Registering removes the creature from the pool permanently; an occupied slot is replaced
  and the previous specimen discarded.
- Specimen bonus: `REGISTRY_TIER_BONUS[tier] × (1 + 2·deviation)` (common 5%, tier 1 10%,
  tier 2 25%, tier 3 50%). Bonuses add up into one global multiplier.
- `state.sightings` records every combination seen on the shore; the grid shows sighted
  and unknown slots differently.
- Registration shares the release unlock gate (`isRegistryUnlocked`).
- Registry and sightings are meant to survive the future Great Tide prestige.

## Adding an upgrade

Append to `UPGRADES` with `costFn` (use `geometric(base, growth)` for repeatables),
`effectFn`, optional `costResource` and `visible`. Read it with `upgradeEffect(state, id)`.
The shop hides upgrades whose `visible` returns false and re-renders when the visible set changes.
