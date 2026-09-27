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
- Minerite (deep slots) and lux (shallow slots) scale with `sqrt(level)` and the registry multiplier.
- Plankton clumps are worth `base + 2 s of passive income`, times Plankton Surge
  (`planktonClumpValue` in `economy/production-engine.ts`).

## Feeding

`systems/feeding.ts`. Level L → L+1 costs `20 × 1.22^(L−1) × rich_brine`. `quoteFeed`
supports ×N and "max affordable". The panel shows Feed / ×10 / Max.

Tuning reference (greedy simulation, 50% active collection): levels 20 at 5 min,
~50 at 1 h, plateau around 60-70 without release/registry multipliers.

## Release (nacre)

`nacre = (level/10)² × (1 + 2·deviation) × rareTierMul × nacre_refinement`

Quadratic in level while feeding cost is exponential, so each creature has an
optimal release point. Nacre buys slots (`2 × 3^(tier−1)`) and nacre upgrades.

## Shore & rarity

- Rare chance and unlocked tiers are derived from upgrades (`systems/rarity.ts`,
  `getSpawnContext`), never stored in state. Tier 2: Strange Tides; tier 3: Abyssal Legends.
- Refresh cost: `max(100, 30 s of income) × 2^refreshesThisTide`, reset on natural tide.
- Rare refresh: 10 coral, first creature guaranteed rare.

## Zoological registry

`systems/registry.ts`, UI in `ui/registry-modal.ts`.

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
