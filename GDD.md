# Brinewerk — Game Design Document

## Concept

Brinewerk is a retro-styled incremental game about cultivating an ecosystem of procedurally generated marine creatures in a tide pool. The player actively collects floating plankton, acquires creatures from the tides, and uses them as multipliers to scale production. Visual style is chunky pixel art with GPU shader effects for rare specimens.

Tone: scientific, slightly weird, deeply systemic. Think Dwarf Fortress meets a marine biology textbook printed on a dot matrix printer.

## Creature Types

Five base phyla, each with distinct visual rendering and gameplay role:

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
- **Role**: Structural. Unlocks new pool slots through reef building.
- **Special trait**: Branches/Density — determines structure quality

### Nucleid (◇)
- **Appearance**: Geometric polygon rings, concentric layers, rotating facets
- **Role**: Explorers. Best success rate on expeditions, produce Minerite.
- **Special trait**: Facets/Rings — more complex = better expedition outcomes

### Craboid (⬣)
- **Appearance**: Top-down crab silhouette — oval/trapezoidal/hexagonal shell, two raised claws, 4–10 segmented side legs, stalked eyes. ~30% exhibit fiddler-style claw asymmetry (one oversized claw).
- **Role**: Solid plankton producers (0.9× multiplier). Ecological generalists.
- **Special traits**: Legs — number of walking legs per side (2–5); Claws — pincer size and reach.

## Genetics System

### Genotype

Every creature has a set of gene values (0.0 to 1.0 floats) that map to phenotypic traits. Trait values follow a **bell curve distribution** (Irwin-Hall, mean of 3 uniforms) — most creatures cluster around average, while extreme values (near 0 or 1) are naturally rare and valuable.

**Universal traits** (all types):
- `arms` — appendage count (visual + production scaling)
- `size` — creature dimensions
- `fatness` — body proportions
- `spikes` — defensive protrusions (defense against predators)
- `pattern` — visual complexity (0 = solid, 4 = multi-layered)
- `glow` — bioluminescence (Lux production when > 0.5)
- `eyes` — 0-3 eyes (purely cosmetic... or is it?)
- `wobble` — animation intensity

**Type-specific traits:**
- Blobid: `tentacles`
- Corallid: `branches`, `density`
- Nucleid: `facets`, `rings`
- Craboid: `legs`, `claws`

**Palette genes**: Two palette indices that determine body/accent/outline colors. Uniformly distributed (not bell curve — they're color indices, not quality).

**Species gene**: Determines creature type. Usually inherited from parents; 15% chimera chance on cross-type breeding.

### Trait Deviation & Creature Value

A creature's value is measured by how much its traits deviate from the bell curve average (0.5). A perfectly average creature is cheap; one with extreme traits in multiple genes is expensive and powerful. This creates a natural rarity gradient without explicit rarity tiers for the creatures themselves — the genetics system produces rarity organically.

### Inheritance

On breeding, each gene is resolved independently:
- 40% chance: take parent A's value
- 40% chance: take parent B's value
- 20% chance: average of both parents ± random offset

**Mutation**: 8% chance per gene to randomize completely, regardless of parents.

### Rare Effects

Rare visual effects are GPU shaders applied to creature sprites. The system uses a **tiered unlock model**:

**Base rare chance**: 1% per creature (upgradeable via prestige and upgrades).

When a creature rolls rare, the effect is picked from the player's **unlocked pool** using weighted random selection. New effects are unlocked through upgrades, prestige, and progression.

#### Tier 1 — Starter Rares (unlocked by default)

| Effect | Weight | Visual |
|---|---|---|
| Metallic ⚙ | 10 | Desaturated + specular highlight bands |
| Shiny ✨ | 10 | Traveling light wave, cross sparkles |

#### Tier 2 — Uncommon Rares (unlocked via upgrades)

| Effect | Weight | Visual |
|---|---|---|
| Glitch ▦ | 8 | Scanline displacement, chromatic aberration |
| On Fire 🔥 | 8 | Flame particles rising from edges, orange tint |
| Frost ❄ | 8 | Cool tint, ice crystals on edges |
| Rotating 🌀 | 8 | Slow rotation (Stellarid/Nucleid only) |
| Upside Down 🔃 | 8 | Vertical flip (Blobid/Corallid only) |
| Wave ∿ | 8 | Horizontal wave distortion |
| Nebula ★ | 6 | Dark cosmic body with internal twinkling stars |
| Toxic ☣ | 6 | Green shift, dripping particles |
| Phantom 👻 | 6 | Phase transparency, horizontal drift |
| Rainbow 🌈 | 6 | Cycling color shift |
| Electric ⚡ | 6 | Crackling energy arcs |
| Pulse ♥ | 6 | Rhythmic size pulsing |

#### Tier 3 — Legendary Rares (late-game unlocks)

| Effect | Weight | Visual |
|---|---|---|
| Hologram ◇ | 5 | Semi-transparent holographic shimmer |
| Negative ◑ | 5 | Inverted colors |
| Shadow ▒ | 5 | Dark silhouette with glowing edges |
| Tiny • | 5 | Miniaturized version |
| Holy ✤ | 4 | Centered light rays and aura glow |
| X-Ray ☢ | 4 | Skeletal/wireframe view |
| Thermal 🌡 | 4 | Heat map color gradient |
| CRT ▪ | 3 | Scanline + curvature + phosphor glow |
| Caustic ≋ | 3 | Underwater light caustics |
| Stained Glass ⬡ | 3 | Faceted colored glass look |
| Liquify 💧 | 3 | Melting/dripping distortion |

**Rare inheritance**: If one parent has a rare effect, 25% chance the child inherits it. Two rare parents can produce a new random rare (10% chance).

**Pickup cost scaling**: Rare creatures cost more to pick up from the shore, multiplied by tier (x2 for tier 1, x3 for tier 2, x5 for tier 3).

## Economy

### Design Philosophy

The economy should feel like a **boardgame resource management system**: every turn (tide cycle) the player has limited resources and must allocate them across competing needs. There's never enough to do everything — you must choose. Good choices compound, bad choices waste scarce cycles.

Key principles:
- **No resource is luck-gated**: every resource can be obtained through deliberate play, not RNG
- **Rare creatures are a bonus, not a requirement**: progression is driven by trait quality and smart allocation
- **Every resource creates a tension**: spending it on A means not spending it on B
- **Position matters**: where you place a creature changes what it produces

### Resources

Six resources, unlocked progressively. Each has a distinct **source mechanic**, **sink**, and **tension**.

---

**Plankton** 🟢 — *The flow* (available from start)

- **Source**: Floating collectible clumps that drift across the pool. Collected actively by moving the cursor near them.
- **Multiplied by**: Creatures in the pool. Each creature acts as a multiplier on plankton collection — more creatures with better traits = each clump is worth more.
- **Sinks**: Picking up creatures from the shore, basic production upgrades (collection radius, spawn frequency, clump size).
- **Tension**: Spend now on a mediocre creature (immediate multiplier) or save for a better one next tide? Buy an upgrade that helps collection, or stockpile for an expensive rare creature?

```
Collected value = clump_base × (1 + sum_of_creature_multipliers)
Creature multiplier = type_multiplier × size_factor × arms_factor × upgrade_bonuses
```

---

**Nacre** ⚬ — *The sacrifice* (unlocked after filling all tier-0 starter slots)

- **Source**: Releasing creatures from the pool. Yield based on: creature's lifetime in the pool × trait deviation × rare tier bonus. A creature with extreme traits kept for a long time yields a lot of nacre.
- **Sinks**: Unlocking new seabed slots (exponential cost per tier), structural upgrades (shore capacity, tide frequency, new slot tiers).
- **Tension**: The core dilemma. Keeping a creature = ongoing production multiplier. Releasing it = one-time nacre for permanent expansion. A great creature is worth more both ways, which makes the choice harder, not easier. Timing matters: release too early and you lose nacre (low lifetime), too late and you've delayed your expansion.

---

**Minerite** 🔵 — *The depths* (unlocked mid-game via upgrade)

- **Source**: Produced passively by creatures placed in **deep slots** (lower part of the seabed). Production rate scales with the creature's trait deviation — better creatures produce more minerite regardless of type. Unlocked as a resource when the player purchases the "Deep Drilling" upgrade with nacre.
- **Also appears as**: Rare floating collectible clumps (blue) once unlocked, mixed in with plankton at low frequency.
- **Sinks**: Breeding costs, expedition fuel, mid-tier upgrades (trait floor boost, unlock rare tier 2).
- **Tension**: Deep slots produce minerite but are further from where plankton spawns (top/middle of pool), so creatures placed deep contribute less to plankton collection multiplier. The player must decide: maximize plankton flow (creatures near the surface) or diversify into minerite (creatures at depth)?

---

**Lux** ✨ — *The surface* (unlocked late-game via upgrade)

- **Source**: Produced passively by creatures placed in **shallow slots** (upper part of the seabed, near the water surface). Production rate scales with the creature's glow trait — high glow = more lux. Unlocked when the player purchases the "Bioluminescence" upgrade with minerite.
- **Also appears as**: Rare floating collectible clumps (golden) once unlocked, very low frequency.
- **Sinks**: Prestige preparation (boosting fossil quality), guaranteed rare effect on next breed, unlock rare tier 3, late-game production multipliers.
- **Tension**: Shallow slots are prime real estate for plankton collection (close to where clumps drift), but lux production requires glow-heavy creatures which may not be the best plankton multipliers. Surface vs. depth creates a **vertical allocation puzzle**: the player distributes creatures across the water column, balancing three competing outputs (plankton multiplier, minerite, lux).

---

**Coral** 🪸 — *The seabed harvest* (available from start)

- **Source**: Coral formations sprout periodically on the seabed floor (one every ~4-6 minutes). Unlike plankton, they are **stationary** and must be collected with a **deliberate click/tap** — no proximity magnet. Up to 3 coral formations can be present at once; uncollected corals persist until clicked.
- **Yield**: 1-3 Coral per pickup (base 2). Amount upgradeable.
- **Spawn frequency**: Upgradeable — base interval is 4-6 minutes, reduced by upgrades.
- **Sinks**: TBD — future uses may include reef construction upgrades, cosmetic unlocks, or creature mutation catalysts.
- **Tension**: Coral spawns are rare and valuable, but the player must actively notice and click them on the seabed. Zoomed out, they're easy to miss among the terrain. Spawn rate upgrades compete with other resource sinks.
- **Visual**: Pink/magenta branching pixel art formations that appear on the seabed floor, matching the game's coral palette.

---

**Fossils** 🦴 — *The legacy* (prestige currency)

- **Source**: Obtained only during the Great Tide (prestige reset). Amount based on total pool quality at the moment of reset: sum of all creatures' trait deviations + rare bonuses + total lifetime production.
- **Sinks**: Permanent upgrades that persist across runs — base rare chance increase, trait floor (minimum trait values on new creatures), starter slot count, starting plankton, tide frequency boost.
- **Tension**: Prestige now or keep growing? Every moment you wait, your pool quality increases (more fossils), but you're also delaying the permanent bonuses that would make the next run faster. Classic prestige timing dilemma.

---

### The Vertical Allocation Puzzle

The seabed is not just a bag of slots — it's a **vertical space** where position determines output:

```
Surface (shallow slots)  →  Best for plankton multiplier (near collectible drift path)
                             Lux production (glow creatures)

Middle (mid slots)       →  Balanced — moderate plankton multiplier
                             No special resource

Deep (deep slots)        →  Worst for plankton multiplier (far from collectibles)
                             Minerite production (any creature)
```

This creates a spatial resource allocation problem similar to worker placement in boardgames. With limited slots at each depth, the player must decide:
- Which creatures go shallow (maximize plankton flow OR lux)?
- Which go deep (sacrifice plankton for minerite)?
- Which go middle (balanced, safe)?

Rearranging creatures between slots is free but costs **attention and strategic thought** — the boardgame feel. Every tide brings new creatures that might fit better in a specific depth, prompting re-evaluation of the whole layout.

### The Tide Cycle as a "Turn"

Each tide arrival functions like a **turn** in a boardgame:

1. **Income phase**: Collect any accumulated minerite/lux from pool creatures
2. **Market phase**: Evaluate the new shore creatures — stats, traits, cost
3. **Acquisition phase**: Spend plankton to pick up 0-4 creatures (can you afford the good ones?)
4. **Allocation phase**: Place new creatures in slots, potentially rearranging existing ones
5. **Release phase**: Optionally release creatures for nacre (to fund slot unlocks or save for upgrades)
6. **Upgrade phase**: Spend accumulated resources on upgrades
7. **Production phase**: Between tides, collect plankton actively while pool produces minerite/lux passively

This cycle gives structure to the incremental gameplay. The player isn't just clicking — they're making allocation decisions each "turn" that compound over time.

## The Tide Pool (Main Play Area)

The pool is a scattered collection of **seabed slots** distributed across a vertical water column. Slots are positioned organically across the world space and have visual themes (rock, coral, shell, anemone, vent).

### Slot System

- Slots are pre-defined at fixed world positions with different visual themes
- Each slot has a **tier** (0 = starter, free; higher tiers cost Nacre to unlock)
- Unlock costs grow exponentially: 1, 2, 4, 8... Nacre per tier
- Slot **vertical position** determines secondary resource output (shallow = lux, deep = minerite)
- The player's strategic choices: **which creatures to keep**, **where to place them**, and **when to release**

### Floating Collectibles

Resource clumps drift across the pool from right to left, concentrated in the upper/middle portion of the water column:

- **Plankton** (green): Always present, primary income. Spawn rate and value scale with upgrades. Drift horizontally; collected via cursor proximity (magnet).
- **Minerite** (blue): Appears after unlocking Deep Drilling. Lower frequency, spawns mid-to-deep. Same magnet collection.
- **Lux** (golden): Appears after unlocking Bioluminescence. Rare, spawns near the surface. Same magnet collection.
- **Coral** (pink): Always present but rare (~every 4-6 min). Spawns as stationary formations on the seabed floor. Must be **clicked/tapped deliberately** — no magnet. Awards 1-3 Coral per pickup.

Plankton, minerite, and lux are collected by moving the cursor near them — they magnetize and are absorbed on contact. Coral requires a deliberate click. All collectibles show a floating popup on pickup.

### Zoom & Pan

The pool view supports zoom and pan:
- **Zoom**: Mouse wheel / pinch gesture. Range: 0.5× to 2.0×.
- **Pan**: Click-drag / touch-drag. Clamped to keep the pool within view.
- Zoom in to inspect creature details and shader effects up close; zoom out to see the full layout.

## Creature Acquisition

### 1. Tides (Primary, All Game)

Every 3-5 minutes, a tide arrives and deposits 1-4 random creatures on the Shore. The initial tide always spawns one of each phylum (4 creatures) so the player sees all types immediately.

**Picking up a creature costs Plankton.** Cost scales with the creature's **trait deviation** from average (more exceptional = more expensive) and rare tier multiplier. The player must evaluate each creature and decide which are worth the investment.

Uncollected creatures wash away when the next tide arrives.

### 2. Breeding (Mid Game, Strategic)

The player selects two creatures from the pool to breed. Both parents are occupied during incubation (not contributing to production).

**Cost**:
- Resource cost in Minerite
- Both parent creatures unavailable during incubation
- Optional: spend Lux to guarantee a rare effect on the offspring

**Outcome**:
- One offspring with inherited genetics (see Genetics System)
- Parents return to the pool after incubation

The key tension: breeding removes two multipliers from the pool temporarily. The player must decide if the potential offspring is worth the lost production — and which slot depth to sacrifice (surface producers? deep miners?).

### 3. Expeditions (Late Game, Risk/Reward)

Send a creature out of the pool to explore. The creature is unavailable during the expedition.

Expedition parameters:
- **Duration**: 1-8 hours depending on destination
- **Reward**: New creature, rare resources, trait fragments, or nothing
- **Risk**: Small chance (5-15%) the creature doesn't return, or returns mutated
- **Trait matching**: Creatures with traits matching the destination have better outcomes (e.g., Nucleid with high facets excels in Crystal Caves)

## Progression

### Phase 1 — The Shallows (0-2 hours)

Player starts with 4 creatures on the shore (one of each type) and enough plankton to pick up the cheapest. Learns basic mechanics: collect floating plankton, buy creatures from shore, place them to boost collection. Creature release unlocks once all starter slots are filled, introducing the Nacre economy.

Only resource: Plankton. All slots are shallow/mid — no depth strategy yet.

Goal: Fill starter slots, unlock first expansion slots with Nacre, reach 6+ creatures.

### Phase 2 — The Depths Open (2-8 hours)

Player has enough nacre to unlock deeper slots. "Deep Drilling" upgrade becomes available (costs nacre), unlocking Minerite as a resource. Deep slots appear on the seabed. First depth allocation decisions: put a creature down deep for minerite, or keep everyone shallow for plankton?

Blue minerite clumps start floating in the lower part of the pool. Breeding becomes available (costs minerite). Tier 2 rare effects can be unlocked with nacre.

Goal: Unlock Deep Drilling, first breeding attempt, start stockpiling minerite, expand to 12+ creatures.

### Phase 3 — Bioluminescence (8-24 hours)

"Bioluminescence" upgrade (costs minerite) unlocks Lux production from shallow glow-creatures. The vertical allocation puzzle is now fully active: shallow = lux, middle = balanced, deep = minerite. Golden lux clumps appear rarely near the surface.

Expeditions unlock. Tier 3 legendary rares can be purchased with lux. Full economy running.

Goal: First expedition, unlock legendary rares, complete vertical allocation strategy, 15+ creatures.

### Phase 4 — The Abyss (24+ hours)

All systems active. Optimization phase — the player hunts for perfect trait combinations, fine-tunes depth allocation, completes the Bestiary, and pushes pool quality to maximum before prestige.

Goal: Maximize pool quality, complete Bestiary sections, prepare for prestige.

### Prestige — The Great Tide

A massive tide sweeps the entire pool clean. The player receives **Fossils** based on total pool quality at the moment of reset.

**Fossils buy permanent upgrades:**
- Increased base rare chance (find rares more often)
- Trait floor (new creatures never have traits below X — shifts the bell curve upward)
- Extra starter slots (begin next run with more free slots)
- Starting plankton bonus
- Tide frequency boost (more creatures per hour)
- Unlock deeper biome slots (new depths with better minerite yields)

**Kept across prestige:**
- Bestiary discoveries
- Fossil upgrades
- Unlocked rare tiers

**Reset:**
- All creatures, resources (plankton, nacre, minerite, lux, coral), slot unlocks
- Production upgrades (non-fossil)

Each prestige should feel significantly faster than the previous run. The trait floor increase is particularly impactful: first run, most creatures are average; after a few prestiges, even "bad" creatures have decent traits, and exceptional ones are truly spectacular.

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
Regular creature delivery every 3-5 minutes. The game's heartbeat.

### Red Tide (Periodic)
Every 12-24 hours. +500% Plankton collection for 2 hours. Time to stockpile.

### Bioluminescent Bloom (Periodic)
Every 18-36 hours. All creatures gain temporary glow. Lux production spikes.

### Deep Current (Rare)
Random. Brings a guaranteed rare creature to the shore, but pickup cost is 5x normal.

### Predator Warning (Negative)
Random. A predator threatens the pool. Player must sacrifice one creature or lose production for 4 hours. Creatures with high spikes trait are immune.

## Visual Style

Retro pixel art, chunky blocks, limited palette per creature. Inspired by Ginormo Sword, early Flash games, and DOS-era management sims.

- Creatures: Procedurally generated pixel art, 3px block size, ~40x40 pixel canvas per creature
- UI: Pixel font (Press Start 2P), dark ocean palette (#060e12 background), teal/cyan accents
- Rare effects: GLSL shaders — the primary visual differentiator and collector's incentive
- Pool: Scattered seabed slots with themed visuals, creatures idle-animating in place
- Collectibles: Small pixel-art plankton clumps drifting across the pool with floating pickup popups; coral formations sprout on the seabed floor as click-to-collect targets
- Minimal animation budget: wobble, glow pulse, shader effects handle visual interest

## Audio Direction (Future)

Ambient underwater atmosphere. Muffled, deep. Occasional bubble sounds on resource ticks. Distinct chime for rare creature arrivals. Tidal whoosh for tide events. No music during idle — just the pool humming.

## Platform

- Web only (HTML5 Canvas + WebGL)
- Target: Desktop browsers, functional on mobile (touch zoom/pan)
- Published on itch.io as free-to-play
- No server, no accounts, no monetization
- Save to localStorage, JSON export for backup
