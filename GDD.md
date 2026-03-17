# Brinewerk — Game Design Document

## Concept

Brinewerk is a retro-styled idle game about cultivating an ecosystem of procedurally generated marine creatures. The player manages a tide pool, breeds creatures, expands production chains, and explores deeper biomes. Visual style is chunky pixel art with GPU shader effects for rare specimens.

Tone: scientific, slightly weird, deeply systemic. Think Dwarf Fortress meets a marine biology textbook printed on a dot matrix printer.

## Creature Types

Four base phyla, each with distinct visual rendering and gameplay role:

### Stellarid (✦)
- **Appearance**: Radial star shape, variable arm count (3-8), spikes, patterns
- **Role**: Primary Plankton producers. Workhorse of the early game.
- **Special trait**: Arms — more arms = higher base filtration rate

### Blobid (◎)
- **Appearance**: Jellyfish dome with hanging tentacles, fringe, translucent patterns
- **Role**: Passive producers with unique visual style.
- **Special trait**: Tentacles — cosmetic, affects tentacle count and animation

### Corallid (❋)
- **Appearance**: Branching coral structure with sub-branches and tip blooms
- **Role**: Structural. Required to build Reef structures, unlocks new pool slots.
- **Special trait**: Branches/Density — determines structure quality when used for building

### Nucleid (◇)
- **Appearance**: Geometric polygon rings, concentric layers, rotating facets
- **Role**: Explorers. Best success rate on expeditions, produce Minerite.
- **Special trait**: Facets/Rings — more complex = better expedition outcomes

## Genetics System

### Genotype

Every creature has a set of gene values (0.0 to 1.0 floats) that map to phenotypic traits:

**Universal traits** (all types):
- `arms` — appendage count (visual + production scaling)
- `size` — creature dimensions (affects slot requirements at higher tiers)
- `fatness` — body proportions
- `spikes` — defensive protrusions (expedition survival bonus)
- `pattern` — visual complexity (0 = solid, 4 = multi-layered)
- `glow` — bioluminescence (Lux production when > 0.5)
- `eyes` — 0-3 eyes (purely cosmetic... or is it?)
- `wobble` — animation intensity

**Type-specific traits:**
- Blobid: `tentacles`
- Corallid: `branches`, `density`
- Nucleid: `facets`, `rings`

**Palette genes**: Two palette indices that determine body/accent/outline colors. Inherited independently.

**Species gene**: Determines creature type. Usually inherited from parents; 15% chimera chance on cross-type breeding.

### Inheritance

On breeding, each gene is resolved independently:
- 40% chance: take parent A's value
- 40% chance: take parent B's value
- 20% chance: average of both parents ± random offset

**Mutation**: 8% chance per gene to randomize completely, regardless of parents.

### Rare Effects

Rare visual effects are rolled at birth. Each is a GPU shader applied to the creature's sprite.

| Effect | Chance | Visual | Gameplay Bonus |
|---|---|---|---|
| Metallic ⚙ | 8% | Desaturated + specular highlight bands | +20% Minerite output |
| Glitch ▦ | 5% | Scanline displacement, chromatic aberration, pixel noise | Expedition: can "glitch" past dangers |
| On Fire 🔥 | 5% | Flame particles rising from edges, orange tint | +30% Plankton but damages adjacent non-Fire creatures slowly |
| Frost ❄ | 5% | Cool tint, ice crystals on edges | Slows adjacent creatures' timers (good for breeding duration) |
| Shiny ✨ | 5% | Traveling light wave, cross sparkles | 2x discovery value in Bestiary |
| Starry ★ | 4% | Dark cosmic body with internal twinkling stars | +50% Lux output |
| Toxic ☣ | 4% | Green shift, dripping particles | Poisons adjacent creatures (reduces output) but immune to expedition loss |
| Phantom 👻 | 4% | Phase transparency, horizontal drift | Can occupy same slot as another creature |

**Rare inheritance**: If one parent has a rare effect, 25% chance the child inherits it. Two rare parents can produce a new random rare (10% chance). Breeding two of the same rare never guarantees the child gets it — keeps them precious.

**Future**: Double-rare creatures (< 1% chance) with combined shader effects.

## Economy

### Resources

Three resources form an interconnected economy:

**Plankton** 🟢 — Base currency. Produced by all creatures passively. Used to expand the pool, pick up tide creatures, and buy Tier 1 upgrades.

**Minerite** 🔵 — Mid-game currency. Produced primarily by Nucleids and Tier 2+ upgrades. Used for advanced upgrades, skill tree nodes, expeditions.

**Lux** 🟡 — Premium currency. Produced only by creatures with glow > 0.5 and Tier 3 upgrades. Used for prestige, late skill tree, and guaranteeing rare effects on breeding.

### Production Chain

Each creature in the pool produces resources per second based on its traits:

```
Base output = type_multiplier × size × relevant_trait_value
Upgrade bonus = multiplier from nearby node upgrades
Skill tree bonus = global multipliers from Phylogenesis
Final output = base × (1 + upgrade) × (1 + skill)
```

## The Tide Pool (Main Play Area)

The pool is an expandable grid where creatures are placed.

### Expandable Grid

The player starts with a **single creature slot (1×1)**. On each edge of the grid where an empty cell is adjacent to an occupied one, a **"+" expansion button** appears. Clicking it pays a resource cost to unlock that cell.

**Expansion costs** are paid in **Nacre** (obtained by releasing creatures) and grow exponentially by tier:
- Tier 1 (near center): 1 Nacre
- Tier 2 (spreading out): 2 Nacre
- Tier 3 (periphery): 4 Nacre
- Tier 4 (edges/deep): 8 Nacre

This creates a release-to-expand loop: the player must sacrifice creatures to earn Nacre, then spend Nacre to unlock new slots for future creatures.

**Grid shape is freeform**: the player chooses where to expand. They can grow horizontally, vertically, in an L-shape, or as a compact square. Compact shapes are optimal because they create more upgrade node intersections, but the player is free to build however they want.

**Maximum theoretical size**: 10×10 (100 creature slots). This is more than enough — most players will reach 5×5 to 7×7 before prestige.

The grid is tracked as a **sparse set of (row, col) coordinates** rather than a dense 2D array. Only unlocked cells exist.

### Upgrade Nodes (Intersection Slots)

Whenever **four creature slots form a 2×2 square**, an **upgrade node** appears at their shared intersection point. This node is a smaller diamond-shaped slot between the four creature cells.

Clicking an upgrade node opens a modal with available upgrades to install. Each node holds one upgrade at a time (can be swapped).

**Phase 1 upgrades** (Plankton cost):
- **Algae Colony**: +25% Plankton production for the 4 adjacent creatures
- **Current Filter**: +15% production for all adjacent creatures + small Minerite trickle
- **Biolamp**: +20% Lux production for adjacent glow creatures

**Later upgrades** (Minerite / Lux cost):
- **Thermal Vent**: Produces Minerite passively, scales with adjacent creature count
- **Resonance Crystal**: Adjacent creatures' rare effects are 50% stronger
- **Breeding Den**: Allows the 4 adjacent creatures to breed (required for breeding)
- **Expedition Beacon**: Adjacent creatures can be sent on expeditions

Upgrade nodes create a **spatial puzzle**: the player must plan their grid expansion to maximize useful 2×2 clusters and position the right creatures around the right upgrades.

### Zoom & Pan

The pool view supports **zoom and pan** to accommodate the growing grid:

- **Zoom**: Mouse wheel / pinch gesture. Range: 0.5× to 2.0×. Default zoom auto-adjusts to fit the current grid.
- **Pan**: Click-drag / touch-drag. Clamped to keep the grid within view (with some padding).
- **Auto-center**: On first load and after expansion, the view smoothly centers on the grid.
- Zoom in to inspect creature details and shader effects up close; zoom out to see the full grid layout.

### Pool Strategy

With the expandable grid and upgrade nodes, the player faces layered decisions:
- **Expansion direction**: Grow compact (more upgrade nodes) or spread out (cheaper, but fewer synergies)?
- **Creature placement**: Which creatures go next to which upgrade nodes?
- **Upgrade selection**: Which upgrade fits this cluster of 4 creatures best?
- **Risk management**: Balance creature variety against production efficiency

## Creature Acquisition

Three channels, each with a different trade-off. Creatures should always feel meaningful to acquire.

### 1. Tides (Passive, Early Game)

Every 3-5 minutes (accelerated for Phase 1; later 2-4 hours real time), a tide arrives and deposits 1-3 random creatures on the Shore. The shore has 3-4 slots. Creatures on the shore persist until the next tide — uncollected ones wash away.

**Picking up a creature costs Plankton** (acclimatization cost). Cost scales with creature quality: more traits, rare effects = more expensive. The player must choose which to keep and which to let go.

The tide pool's biome determines the creature pool. Early game only gets Stellarids and Blobids; Corallids and Nucleids appear after unlocking specific biomes.

### 2. Expeditions (Mid Game, Risk/Reward)

Unlocked after installing an Expedition Beacon upgrade node. Send a creature adjacent to the beacon out of the pool to explore. The creature is unavailable for production during the expedition.

Expedition parameters:
- **Duration**: 1-8 hours depending on destination
- **Reward**: New creature, rare resources, trait fragments, or nothing
- **Risk**: Small chance (5-15%) the creature doesn't return, or returns mutated (random gene shift)
- **Trait matching**: Creatures with traits matching the destination have better outcomes (e.g., Nucleid with high facets excels in Crystal Caves)

Destinations unlock progressively with biome expansion.

### 3. Breeding (Late Game, Strategic)

Unlocked after installing a Breeding Den upgrade node. The two creatures adjacent to the den (player chooses which pair) enter the breeding process.

**Cost**:
- Both parent creatures are occupied for 4-12 hours (not producing resources)
- Resource cost in Minerite
- Optional: spend Lux to boost rare effect chance

**Outcome**:
- One offspring with inherited genetics (see Genetics System)
- Parents return to the pool after incubation

The key tension: breeding removes two producers from the pool for hours. This is a significant economic hit, especially early. The player must decide if the potential offspring is worth the lost production.

## Progression

### Phase 1 — The Shallows (0-2 hours)

Player starts with a single creature slot and one creature. Learns basic mechanics: creature produces Plankton, Plankton buys grid expansion. First tide arrives with 2 creatures. Player expands grid, places creatures. First upgrade node appears when they have a 2×2 grid.

Goal: Expand to 3×3, install first Algae Colony upgrade, fill pool to 6+ creatures.

### Phase 2 — Reef Building (2-8 hours)

Enough creatures and resources to unlock Minerite production. Corallids become available via tides. More upgrade nodes with advanced options. Expedition Beacon becomes available.

Goal: First expedition, expand to 4×4+, reach 12+ creatures, start Minerite economy.

### Phase 3 — Deep Currents (8-24 hours)

Expeditions bring in Nucleids and rare creatures. Minerite economy opens up. Skill tree becomes meaningful. Breeding Den upgrade unlocked.

Goal: First breeding, unlock Phylogenesis skill tree, discover 10+ Bestiary entries.

### Phase 4 — The Abyss (24+ hours)

Full economy running. Prestige (Fossilization) becomes available. Abyss biome creatures. Double-rare breeding attempts. Optimization and collection completion.

Goal: First prestige, complete Bestiary sections, optimize grid layout for maximum output.

### Prestige — Fossilization

Sacrifice the entire pool to "fossilize" the ecosystem. The player keeps:
- Bestiary discoveries (permanent)
- Phylogenesis Abyss branch nodes (permanent)
- A "fossil bonus" based on pool quality at fossilization (permanent multiplier)

The player restarts with:
- A new egg choice (can pick a different species)
- Faster early game due to permanent bonuses
- Access to deeper biome creatures earlier
- New Abyss-tier skill tree nodes unlocked

Each prestige should feel significantly faster than the previous run, opening new strategic options.

## Skill Tree — Phylogenesis

Shaped like a phylogenetic tree. Three main branches:

### Adaptation (Production)

Focus: Make creatures produce more.
- Efficient Filtration: +15% Plankton per node (5 nodes)
- Colony Density: Expansion cost -20% per node
- Deep Specialization: Creatures producing a single resource get 3x output
- Ecosystem Harmony: Biodiversity bonus — each unique species type adds +10% global output

### Mutation (Breeding)

Focus: Better breeding outcomes.
- Genetic Instability: +5% mutation chance per node
- Dominant Amplification: Rare traits inherited 10% more often per node
- Polyploidy: Offspring can inherit traits from both parents simultaneously
- Chimera Synthesis: Cross-type breeding always produces a new type (not parent types)
- Trait Locking: Choose one gene to guarantee inheritance before breeding

### Abyss (Prestige / Endgame)

Focus: Permanent power, unlocked mainly after first prestige.
- Pressure Adaptation: Unlock abyssal creature variants (stronger base stats)
- Advanced Bioluminescence: Lux production scales exponentially with glow level
- Fossilization Efficiency: Better fossil bonuses on prestige
- Convergent Evolution: Unlock synthetic traits not found in nature
- Primordial Memory: Start each run with a random rare creature

## Bestiary

A grid of all possible creature variations. Entries unlock when the player owns or has owned a creature matching the criteria:
- Each type × palette combination
- Each rare effect per type
- Each significant trait threshold (e.g., "8-armed Stellarid", "Bioluminescent Blobid")
- Special entries for double-rares, chimeras, max-stat creatures

Undiscovered entries show as dark silhouettes. Discovered entries show the creature's pixel art with name and stats. Shiny creatures count as 2 discoveries.

Bestiary completion percentage gives a small global production bonus.

## Events

### Tides (Core)
Regular creature delivery every 2-4 hours. The game's heartbeat.

### Red Tide (Periodic)
Every 12-24 hours. +500% Plankton production for 2 hours. Time to stockpile.

### Bioluminescent Bloom (Periodic)
Every 18-36 hours. All creatures gain temporary glow. Lux production spikes.

### Deep Current (Rare)
Random. Brings a guaranteed rare creature to the shore, but acclimatization cost is 5x normal.

### Predator Warning (Negative)
Random. A predator threatens the pool. Player must sacrifice one creature or lose production for 4 hours. Creatures with high spikes are immune.

## Visual Style

Retro pixel art, chunky blocks, limited palette per creature. Inspired by Ginormo Sword, early Flash games, and DOS-era management sims.

- Creatures: Procedurally generated pixel art, 3px block size, ~40x40 pixel canvas per creature
- UI: Pixel font (Press Start 2P), dark ocean palette (#060e12 background), teal/cyan accents
- Rare effects: GLSL shaders — the primary visual differentiator and collector's incentive
- Pool: Top-down grid view with zoom/pan, creatures idle-animating in their slots
- Upgrade nodes: Small diamond icons at 2×2 intersections, visually distinct from creature slots
- Expansion buttons: "+" icons on grid edges, pulsing subtly to attract attention
- Minimal animation budget: wobble, glow pulse, shader effects handle visual interest

## Audio Direction (Future)

Ambient underwater atmosphere. Muffled, deep. Occasional bubble sounds on resource ticks. Distinct chime for rare creature arrivals. Tidal whoosh for tide events. No music during idle — just the pool humming.

## Platform

- Web only (HTML5 Canvas + WebGL)
- Target: Desktop browsers, functional on mobile (touch zoom/pan)
- Published on itch.io as free-to-play
- No server, no accounts, no monetization
- Save to localStorage, JSON export for backup
